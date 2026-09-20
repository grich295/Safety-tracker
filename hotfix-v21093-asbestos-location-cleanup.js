/* Safety Tracker v2.10.93 - asbestos location parser cleanup + stale TEST card refresh */
'use strict';
(function(){
  if(window.__ASBESTOS_LOCATION_CLEANUP_V21093)return;
  window.__ASBESTOS_LOCATION_CLEANUP_V21093=true;

  function boot(){
    const core=window.SafetyTrackerV2, parser=window.AsbestosCatalogueParserV21086;
    if(!core||!core.state||!core.sb||!parser||!parser.extractLocationCatalogue){setTimeout(boot,100);return;}
    install(core,parser);
  }

  function install(core,parser){
    const st=core.state,sb=core.sb;
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const oldExtract=parser.extractLocationCatalogue.bind(parser);
    const rank={UNKNOWN:0,LISTED:1,SURVEYED_NO_ACM:2,SURVEYED_ACM:3,NO_ACCESS:4,OUTSIDE_SCOPE:1};
    const norm=v=>clean(v).replace(/[.;:,]+$/,'').trim();
    const key=p=>(p||[]).map(x=>norm(x).toLowerCase()).join('>');
    const types=p=>(p||[]).map((x,i)=>i===0?(/guest[ -]?rooms?/i.test(x)?'GUEST_ROOMS':'AREA'):/\bfloor\b/i.test(x)?'FLOOR':/^(?:room|bedroom|suite)\b/i.test(x)?'ROOM':'AREA');
    const prose=s=>/\b(?:must|should|expected to|for testing|test proof|example only|example:|e\.g\.)\b/i.test(clean(s));

    function sanitise(result){
      const map=new Map();
      for(const rec0 of result.rows||[]){
        const raw=clean(rec0.raw_location);
        if(!raw||prose(raw))continue;

        const range=raw.match(/^(.*?)\s*(?:>|›)\s*Rooms?\s+(\d{1,4})\s*[-–]\s*(\d{1,4})\s*$/i);
        if(range){
          const a=Number(range[2]),b=Number(range[3]),parent=(rec0.location_path||[]).slice(0,-1).map(norm).filter(Boolean);
          if(parent.length&&b>=a&&b-a<=500){
            for(let n=a;n<=b;n++){
              const p=parent.concat('Room '+n),k=key(p),rec={...rec0,raw_location:p.join(' > '),location_path:p,proposed_location_types:types(p),confidence:Math.max(Number(rec0.confidence||0),.96),review_status:'READY',source_kind:'ROOM_RANGE_EXPANSION'};
              const old=map.get(k);
              if(!old)map.set(k,rec);
              else if((rank[rec.coverage_status]||0)>(rank[old.coverage_status]||0))old.coverage_status=rec.coverage_status;
            }
          }
          continue;
        }

        const p=(rec0.location_path||[]).map(norm).filter(Boolean);
        if(!p.length||p.some(prose)||p[0].length>80)continue;
        const rec={...rec0,raw_location:raw,location_path:p,proposed_location_types:types(p)},k=key(p),old=map.get(k);
        if(!old)map.set(k,rec);
        else if((rank[rec.coverage_status]||0)>(rank[old.coverage_status]||0))old.coverage_status=rec.coverage_status;
      }

      const rows=[...map.values()].sort((a,b)=>key(a.location_path).localeCompare(key(b.location_path),undefined,{numeric:true}));
      const roomCount=rows.filter(r=>{const t=r.proposed_location_types||[];return t[t.length-1]==='ROOM'}).length;
      const unresolved=rows.filter(r=>r.review_status==='REVIEW').length;
      const declared=result.declared_count==null?null:Number(result.declared_count);
      let state='NO_DECLARED_TOTAL';
      if(declared!=null)state=(result.declared_kind==='rooms'?roomCount:rows.length)===declared?'VERIFIED':'MISMATCH';
      return {...result,rows,unique_count:rows.length,room_count:roomCount,unresolved_count:unresolved,completeness_state:state};
    }

    parser.extractLocationCatalogue=function(pages,items,tops){return sanitise(oldExtract(pages,items,tops))};
    if(window.SafetyAsbestosFullAnalysisV21088)window.SafetyAsbestosFullAnalysisV21088.extractLocationCatalogue=parser.extractLocationCatalogue;

    async function syncSourceCards(){
      if(!navigator.onLine||!st.user)return;
      try{
        const r=await sb.from('asbestos_source_documents_v280').select('*').order('created_at',{ascending:false});
        if(r.error)return;
        const rows=r.data||[],ids=new Set(rows.map(x=>x.id));
        st.asbestosSources=rows;
        document.querySelectorAll('[data-asb87-delete-test],[data-asb87-reanalyse]').forEach(btn=>{
          const id=btn.dataset.asb87DeleteTest||btn.dataset.asb87Reanalyse;
          if(id&&!ids.has(id))btn.closest('.item-card')?.remove();
        });
        try{await window.SafetyAsbestosV21080?.refresh?.()}catch(_e){}
        try{window.SafetyAsbestosCatalogueV21086?.decorateSources?.()}catch(_e){}
        try{window.SafetyAsbestosSourceToolsV21087?.decorate?.()}catch(_e){}
      }catch(e){console.warn('Asbestos source sync',e)}
    }

    document.addEventListener('pointerdown',e=>{
      const btn=e.target.closest?.('[data-asb87-delete-test]');
      if(!btn)return;
      const id=btn.dataset.asb87DeleteTest;
      setTimeout(async()=>{
        try{
          const r=await sb.from('asbestos_source_documents_v280').select('id').eq('id',id).maybeSingle();
          if(!r.error&&!r.data){
            st.asbestosSources=(st.asbestosSources||[]).filter(x=>x.id!==id);
            btn.closest('.item-card')?.remove();
            await syncSourceCards();
          }
        }catch(_e){}
      },900);
      setTimeout(syncSourceCards,1800);
    },true);

    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-admin-tile-v21083="asbestos"],[data-view="admin"],[data-management-tile-key="admin"]'))setTimeout(syncSourceCards,120);
    },true);
    window.addEventListener('pageshow',()=>setTimeout(syncSourceCards,160));
    [500,1600,3200].forEach(ms=>setTimeout(syncSourceCards,ms));

    window.SafetyAsbestosLocationCleanupV21093={syncSourceCards,sanitise};
  }
  boot();
})();