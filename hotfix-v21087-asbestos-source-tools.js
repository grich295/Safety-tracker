/* Safety Tracker v2.10.87 - asbestos re-analysis + guarded TEST/DEMO delete */
'use strict';
(function(){
  if(window.__ASBESTOS_SOURCE_TOOLS_V21087)return;
  window.__ASBESTOS_SOURCE_TOOLS_V21087=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const parser=window.AsbestosCatalogueParserV21086;
    if(!core||!core.state||!core.sb||!parser){setTimeout(boot,120);return;}
    install(core,parser);
  }

  function install(core,parser){
    const st=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    const isAdmin=()=>st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&!(st.offline||st.uiMode==='user');
    const testRx=/(^|[^a-z0-9])(test|demo)([^a-z0-9]|$)/i;

    function isExplicitTest(s){
      return testRx.test(String(s?.title||''))||testRx.test(String(s?.file_name||''));
    }

    async function readPdf(blob){
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,pages=[];
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),tc=await page.getTextContent();
        const raw=tc.items.map(i=>({s:clean(i.str),x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0)})).filter(i=>i.s);
        const rows=[];
        for(const it of raw){let r=rows.find(x=>Math.abs(x.y-it.y)<2.5);if(!r){r={y:it.y,a:[]};rows.push(r)}r.a.push(it)}
        rows.sort((a,b)=>b.y-a.y);
        const lines=rows.map(r=>r.a.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' '));
        pages.push({page:n,lines,text:lines.join('\n')});
      }
      return pages;
    }

    async function sourceBlob(source){
      let path=null;
      if(source.linked_document_version_id){
        const vr=await sb.from('document_versions').select('storage_path').eq('id',source.linked_document_version_id).single();
        if(vr.error)throw vr.error;
        path=vr.data?.storage_path||null;
      }
      if(!path)path=source.storage_path||null;
      if(!path)throw new Error('No stored PDF is linked to this source.');
      const d=await sb.storage.from('safety-files').download(path);
      if(d.error||!d.data)throw(d.error||new Error('Could not download stored PDF.'));
      return d.data;
    }

    async function freshSource(id){
      const r=await sb.from('asbestos_source_documents_v280').select('*').eq('id',id).single();
      if(r.error)throw r.error;
      return r.data;
    }

    async function removePreviousReanalysis(sourceId){
      const r=await sb.from('asbestos_import_batches_v21080')
        .select('id')
        .eq('source_document_id',sourceId)
        .eq('parser_name','BROWSER_REANALYSIS_V21087')
        .in('status',['DRAFT','REVIEW_READY']);
      if(r.error)throw r.error;
      const ids=(r.data||[]).map(x=>x.id);
      if(ids.length){
        const d=await sb.from('asbestos_import_batches_v21080').delete().in('id',ids);
        if(d.error)throw d.error;
      }
    }

    async function reanalyse(id){
      if(!isAdmin())return toast('Admin access required.');
      if(st.offline||!navigator.onLine)return toast('Reconnect before re-analysing an asbestos source.');

      let source;
      try{
        source=await freshSource(id);
        const status=$('asbestosSourceAdminStatus');
        if(status){status.hidden=false;status.textContent='Re-analysing '+source.title+' from its stored controlled PDF…';}

        const blob=await sourceBlob(source);
        const pages=await readPdf(blob);
        await removePreviousReanalysis(source.id);

        const tops=(st.siteLocations||[]).filter(x=>!x.parent_id&&x.active!==false).map(x=>x.name);
        const cat=parser.extractLocationCatalogue(pages,[],tops);
        const amp=source.document_type==='AMP'?parser.extractAmpSummary(pages):null;

        const warnings=[];
        if(cat.completeness_state==='MISMATCH'){
          warnings.push(`Location total mismatch: source declares ${cat.declared_count} ${cat.declared_kind}, but ${cat.declared_kind==='rooms'?cat.room_count:cat.unique_count} were extracted.`);
        }
        if(cat.completeness_state==='NO_DECLARED_TOTAL' && source.document_type!=='AMP'){
          warnings.push('No declared location total was found. Check the extracted location catalogue and confirm it before approval.');
        }
        if(cat.unresolved_count)warnings.push(`${cat.unresolved_count} extracted location(s) need review.`);

        const rawMeta={
          reanalysis_mode:'EXISTING_CONTROLLED_SOURCE',
          source_file_name:source.file_name||null,
          page_count:pages.length,
          storage_mode:'REUSE_EXISTING_CONTROLLED_COPY',
          location_catalogue:{
            source_candidate_count:cat.source_candidate_count,
            unique_count:cat.unique_count,
            room_count:cat.room_count,
            duplicate_mentions:cat.duplicate_mentions,
            unresolved_count:cat.unresolved_count,
            declared_count:cat.declared_count,
            declared_kind:cat.declared_kind,
            completeness_state:source.document_type==='AMP'&&cat.unique_count===0?'AMP_NOT_LOCATION_REGISTER':cat.completeness_state,
            reviewer_confirmed:source.document_type==='AMP'&&cat.unique_count===0
          }
        };
        if(amp)rawMeta.amp_summary=amp;

        const b=await sb.from('asbestos_import_batches_v21080').insert({
          source_document_id:source.id,
          source_hash:source.source_hash,
          detected_document_type:source.detected_document_type||source.document_type,
          parser_name:'BROWSER_REANALYSIS_V21087',
          status:'REVIEW_READY',
          item_count:0,
          proposed_location_count:cat.unique_count,
          warning_count:warnings.length,
          raw_metadata:rawMeta,
          warnings,
          created_by:st.user.id
        }).select().single();
        if(b.error)throw b.error;

        for(let i=0;i<cat.rows.length;i+=100){
          const chunk=cat.rows.slice(i,i+100).map((x,j)=>({
            import_id:b.data.id,
            location_no:i+j+1,
            raw_location:x.raw_location,
            location_path:x.location_path,
            proposed_location_types:x.proposed_location_types,
            source_page:x.source_page||null,
            coverage_status:x.coverage_status,
            confidence:x.confidence,
            review_status:x.review_status,
            raw_data:{source_kind:x.source_kind,reanalysis:true}
          }));
          if(chunk.length){
            const ins=await sb.from('asbestos_import_locations_v21086').insert(chunk);
            if(ins.error)throw ins.error;
          }
        }

        if(status)status.textContent=`Re-analysis ready: ${cat.unique_count} unique location(s), ${cat.room_count} room(s), ${cat.unresolved_count} needing review.`;
        if(window.SafetyAsbestosCatalogueV21086?.showReview)await window.SafetyAsbestosCatalogueV21086.showReview(b.data.id);
        else toast('Re-analysis completed and is ready for review.');
      }catch(e){
        console.error('Asbestos re-analysis',e);
        toast(e?.message||'Could not re-analyse asbestos source.');
      }
    }

    async function deleteTest(id){
      if(!isAdmin())return toast('Admin access required.');
      let source;
      try{source=await freshSource(id);}catch(e){return toast(e.message);}
      if(!isExplicitTest(source))return toast('Delete is only available for explicitly labelled TEST or DEMO sources.');

      const ok=confirm(
        `Permanently delete TEST/DEMO source "${source.title}"?\n\n`+
        `This removes its test asbestos register data, test history, extracted evidence and its controlled PDF when that PDF is not used elsewhere.`
      );
      if(!ok)return;

      try{
        const r=await sb.rpc('delete_test_asbestos_source_v21087',{p_source_id:id});
        if(r.error)throw r.error;
        const result=r.data||{},paths=Array.isArray(result.storage_paths)?result.storage_paths.filter(Boolean):[];

        let storageWarnings=0;
        for(let i=0;i<paths.length;i+=100){
          const rm=await sb.storage.from('safety-files').remove(paths.slice(i,i+100));
          if(rm.error){storageWarnings++;console.warn('TEST storage cleanup',rm.error);}
        }

        await core.loadAll();
        await window.SafetyAsbestosCatalogueV21086?.decorateSources?.();
        setTimeout(decorate,100);

        const removed=[
          `${result.deleted_register_entries||0} test ACM record(s)`,
          `${result.deleted_register_events||0} test history event(s)`,
          `${result.deleted_snippets||0} evidence snippet(s)`
        ].join(', ');
        toast(storageWarnings
          ? `TEST data deleted (${removed}). Some orphaned storage files need cleanup.`
          : `TEST data deleted: ${removed}.`);
      }catch(e){
        console.error('Delete TEST asbestos source',e);
        toast(e?.message||'Could not delete TEST asbestos source.');
      }
    }

    function decorate(){
      const list=$('asbestosSourceAdminList');
      if(!list||!isAdmin())return;

      const rows=[...(st.asbestosSources||[])].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      const cards=Array.from(list.querySelectorAll(':scope > .item-card'));

      cards.forEach((card,i)=>{
        const source=rows[i];
        if(!source)return;
        card.dataset.asbestosSourceId=source.id;

        let tools=card.querySelector('.asb-source-tools-v21087');
        if(!tools){
          tools=document.createElement('div');
          tools.className='row asb-source-tools-v21087';
          card.appendChild(tools);
        }

        const test=isExplicitTest(source);
        tools.innerHTML=
          `<button type="button" class="secondary small" data-asb87-reanalyse="${esc(source.id)}">Re-analyse</button>`+
          (test?`<button type="button" class="danger small" data-asb87-delete-test="${esc(source.id)}">Delete TEST</button>`:'');
      });
    }

    document.addEventListener('click',e=>{
      const re=e.target.closest?.('[data-asb87-reanalyse]');
      if(re){e.preventDefault();e.stopImmediatePropagation();reanalyse(re.dataset.asb87Reanalyse);return;}

      const del=e.target.closest?.('[data-asb87-delete-test]');
      if(del){e.preventDefault();e.stopImmediatePropagation();deleteTest(del.dataset.asb87DeleteTest);return;}
    },true);

    let timer=0;
    const adminList=()=>document.getElementById('asbestosSourceAdminList');
    const observe=()=>{
      const list=adminList();if(!list)return setTimeout(observe,250);
      new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorate,50);}).observe(list,{childList:true,subtree:false});
      decorate();
    };
    observe();
    [300,900,1800,3000].forEach(ms=>setTimeout(decorate,ms));
    window.addEventListener('pageshow',()=>setTimeout(decorate,100));

    window.SafetyAsbestosSourceToolsV21087={reanalyse,deleteTest,decorate,isExplicitTest};
  }

  boot();
})();