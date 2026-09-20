/* Safety Tracker v2.10.95 - repair bundle: live locations, management back route, scoped asbestos acknowledgement, TEST delete coverage */
'use strict';
(function(){
  if(window.__SAFETY_REPAIR_BUNDLE_V21095)return;
  window.__SAFETY_REPAIR_BUNDLE_V21095=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,120);return;}
    install(core);
  }

  function install(core){
    const st=core.state,sb=core.sb;
    const $=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    const isAdmin=()=>st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&!(st.offline||st.uiMode==='user');
    const isManager=()=>st.profile&&st.profile.report_only!==true&&['admin','manager'].includes(String(st.profile.role||'').toLowerCase())&&!(String(st.profile.role||'').toLowerCase()==='admin'&&(st.offline||st.uiMode==='user'));
    const loc=id=>(st.siteLocations||[]).find(x=>x.id===id)||null;
    function locPath(id){
      const out=[];let x=loc(id),guard=0;
      while(x&&guard++<30){out.unshift(x.name);x=x.parent_id?loc(x.parent_id):null;}
      return out.join(' > ')||'Selected location';
    }

    /* ------------------------------------------------------------------
       1. Site Locations: refresh directly from Supabase whenever the
       locations section is opened and after asbestos catalogue approval.
       This prevents the six-location stale in-memory view after a survey
       has published the full hotel room catalogue (including Room 214).
       ------------------------------------------------------------------ */
    let locationRefreshBusy=false;
    async function refreshSiteLocations(silent=true){
      if(locationRefreshBusy||st.offline||!navigator.onLine||!st.user)return false;
      locationRefreshBusy=true;
      try{
        const r=await sb.from('site_locations_v280').select('*').order('sort_order',{ascending:true});
        if(r.error)throw r.error;
        st.siteLocations=r.data||[];
        try{window.SafetyResponsibilityLocationV21090?.renderLocationTree?.()}catch(_e){}
        try{window.SafetySiteLocationTileV21089?.refresh?.()}catch(_e){}
        rebuildOpenLocationSelects();
        if(!silent)toast(`Site Locations refreshed: ${st.siteLocations.length} location${st.siteLocations.length===1?'':'s'}.`);
        return true;
      }catch(e){
        console.warn('v2.10.95 Site Locations refresh',e);
        if(!silent)toast(e?.message||'Could not refresh Site Locations.');
        return false;
      }finally{locationRefreshBusy=false;}
    }

    function activeLocationOptions(){
      return (st.siteLocations||[])
        .filter(x=>x.active!==false)
        .map(x=>({id:x.id,label:locPath(x.id)}))
        .sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
    }
    function rebuildSelect(id,blankLabel){
      const el=$(id);if(!el)return;
      const keep=el.value,rows=activeLocationOptions();
      el.innerHTML=`<option value="">${esc(blankLabel)}</option>`+rows.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
      if(keep&&rows.some(x=>x.id===keep))el.value=keep;
    }
    function rebuildOpenLocationSelects(){
      rebuildSelect('asbestosLocationSelect','Select location');
      rebuildSelect('cpLocation','Select location');
      rebuildSelect('aoLocation','Select location');
    }
    function scheduleLocationRefresh(){
      [180,700,1600,3200].forEach(ms=>setTimeout(()=>refreshSiteLocations(true),ms));
    }

    /* ------------------------------------------------------------------
       2. Contractor asbestos acknowledgement: changing work location now
       clears the previous acknowledgement and names the exact selected
       scope. Current live register evidence is shown with source/page.
       ------------------------------------------------------------------ */
    function relevantAsbestos(locationId){
      if(!locationId)return [];
      const ancestors=new Set();let x=loc(locationId)?.parent_id,guard=0;
      while(x&&guard++<30){ancestors.add(x);x=loc(x)?.parent_id||null;}
      return (st.asbestosEntries||[]).filter(e=>e.active!==false&&(e.location_id===locationId||(e.applies_to_descendants&&ancestors.has(e.location_id))));
    }
    function scopeEvidenceHtml(locationId){
      const path=locPath(locationId),rows=relevantAsbestos(locationId);
      if(!rows.length){
        return `<div class="hint-box repair95-scope-evidence"><strong>Selected work scope: ${esc(path)}</strong><br>No active known/presumed ACM entry is currently recorded for this selected scope. This does not confirm asbestos-free status; stop work if suspect material is encountered.</div>`;
      }
      return `<div class="danger-note repair95-scope-evidence"><strong>Selected work scope: ${esc(path)}</strong><br>${rows.length} known/presumed ACM entr${rows.length===1?'y is':'ies are'} relevant to this scope.</div>`+
        rows.slice(0,12).map(e=>{
          const src=(st.asbestosSources||[]).find(s=>s.id===e.source_document_id);
          const source=src?.title||'Asbestos source';
          return `<div class="item-card compact repair95-scope-evidence"><strong>${esc(e.material||'Asbestos register item')}</strong><div class="meta"><span>${esc(e.identification_status||'')}</span>${e.condition?`<span>${esc(e.condition)}</span>`:''}</div><div class="muted">Source: ${esc(source)}${e.source_page?` · page ${esc(e.source_page)}`:''}</div>${e.management_action?`<div>${esc(e.management_action)}</div>`:''}</div>`;
        }).join('')+(rows.length>12?`<div class="muted repair95-scope-evidence">+ ${rows.length-12} more relevant ACM entr${rows.length-12===1?'y':'ies'}.</div>`:'');
    }
    function updateContractorScope(locationId,resetAck=true){
      const id=locationId||$('cpLocation')?.value;
      if(!id)return;
      const result=$('cpAsbestosResult'),ack=$('cpAsbestosAck');
      if(resetAck&&ack)ack.checked=false;
      if(result&&st.asbestosEntries?.length){
        result.querySelectorAll('.repair95-scope-evidence').forEach(x=>x.remove());
        result.insertAdjacentHTML('beforeend',scopeEvidenceHtml(id));
      }
      const current=$('cpAsbestosAck');
      const label=current?.closest('label');
      if(label){
        const rows=relevantAsbestos(id),path=locPath(id),checked=current.checked;
        label.innerHTML=`<input id="cpAsbestosAck" type="checkbox" ${checked?'checked':''}> I have reviewed the asbestos/location information presented for <strong>${esc(path)}</strong>${rows.length?` including the <strong>${rows.length} relevant known/presumed ACM entr${rows.length===1?'y':'ies'}</strong> shown above`:''}. I understand it covers known or presumed asbestos in the current records only. If I uncover suspected asbestos, or conditions differ from the information provided, I will stop work, prevent disturbance and report it before continuing.`;
      }
    }

    /* ------------------------------------------------------------------
       3. Management / Reports back route: always return to the Management
       landing tiles instead of leaving Reports in a stale detail route.
       ------------------------------------------------------------------ */
    function openManagementHome(){
      try{
        if(window.SafetyManagementTilesV21079?.open){window.SafetyManagementTilesV21079.open();return;}
        document.querySelector('#mainNav button[data-view="reports"]')?.click();
      }catch(e){console.warn('v2.10.95 Management return',e);}
    }
    function ensureReportsBack(){
      if(!isManager())return;
      const view=$('reportsView');if(!view)return;
      let b=view.querySelector('.management-back-v21079');
      if(!b){
        b=document.createElement('button');b.type='button';b.className='secondary management-back-v21079';b.textContent='← Management';
        const heading=view.querySelector('.page-heading');
        if(heading)heading.insertAdjacentElement('afterend',b);else view.insertAdjacentElement('afterbegin',b);
      }
      b.dataset.repair95ManagementBack='1';
    }

    /* ------------------------------------------------------------------
       4. Delete TEST: attach the existing chain-delete action by source ID,
       not by card position. This keeps Delete TEST available on every
       explicit TEST/DEMO source even after re-render/re-analysis ordering.
       ------------------------------------------------------------------ */
    function explicitTest(s){
      try{if(window.SafetyAsbestosSourceToolsV21087?.isExplicitTest)return !!window.SafetyAsbestosSourceToolsV21087.isExplicitTest(s);}catch(_e){}
      return /\b(?:test|demo)\b/i.test([s?.title,s?.file_name,s?.notes,s?.version_label].filter(Boolean).join(' '));
    }
    function sourceIdFromCard(card){
      const selectors=['[data-asb87-reanalyse]','[data-open-asbestos-source]','[data-archive-asbestos-source]','[data-cat86-review-amp]'];
      for(const q of selectors){
        const b=card.querySelector(q);if(!b)continue;
        const d=b.dataset;
        return d.asb87Reanalyse||d.openAsbestosSource||d.archiveAsbestosSource||d.cat86ReviewAmp||null;
      }
      return null;
    }
    function decorateTestSourceCards(){
      if(!isAdmin())return;
      const list=$('asbestosSourceAdminList');if(!list)return;
      list.querySelectorAll('.item-card').forEach(card=>{
        const id=sourceIdFromCard(card);if(!id)return;
        const source=(st.asbestosSources||[]).find(s=>s.id===id);if(!source||!explicitTest(source))return;
        if(card.querySelector(`[data-asb87-delete-test="${CSS.escape(id)}"]`))return;
        let tools=card.querySelector('.asb-source-tools-v21087,.row');
        if(!tools){tools=document.createElement('div');tools.className='row asb-source-tools-v21087';card.appendChild(tools);}
        const b=document.createElement('button');b.type='button';b.className='danger small';b.dataset.asb87DeleteTest=id;b.textContent='Delete TEST';tools.appendChild(b);
      });
    }
    async function addDeleteToReview(importId){
      if(!isAdmin()||!importId)return;
      try{
        const br=await sb.from('asbestos_import_batches_v21080').select('source_document_id').eq('id',importId).maybeSingle();
        if(br.error||!br.data?.source_document_id)return;
        const source=(st.asbestosSources||[]).find(s=>s.id===br.data.source_document_id);
        if(!source||!explicitTest(source))return;
        const body=$('modalBody');if(!body||body.querySelector(`[data-asb87-delete-test="${CSS.escape(source.id)}"]`))return;
        let actions=body.querySelector('.actions:last-of-type');
        if(!actions){actions=document.createElement('div');actions.className='actions';body.appendChild(actions);}
        const b=document.createElement('button');b.type='button';b.className='danger';b.dataset.asb87DeleteTest=source.id;b.textContent='Delete TEST source';actions.insertAdjacentElement('afterbegin',b);
      }catch(e){console.warn('v2.10.95 TEST review decoration',e);}
    }

    document.addEventListener('change',e=>{
      if(e.target?.id==='cpLocation'){
        const id=e.target.value;
        if(id){setTimeout(()=>updateContractorScope(id,true),80);setTimeout(()=>updateContractorScope(id,false),500);}
      }
    },true);

    document.addEventListener('click',e=>{
      const t=e.target;
      if(t.closest?.('[data-admin-tile-v21083="locations"]'))scheduleLocationRefresh();
      if(t.closest?.('[data-cat86-approve],[data-asb80-approve],[data-cat88-approve]'))scheduleLocationRefresh();
      if(t.closest?.('#newContractorStaffBtn,[data-contractor-route]'))setTimeout(()=>{refreshSiteLocations(true);setTimeout(()=>updateContractorScope($('cpLocation')?.value,false),350);},100);

      const back=t.closest?.('[data-repair95-management-back],.management-back-v21079');
      if(back&&isManager()){
        e.preventDefault();e.stopImmediatePropagation();openManagementHome();return;
      }

      const reportTile=t.closest?.('[data-management-tile-action="management:reports"]');
      if(reportTile)setTimeout(ensureReportsBack,120);

      const review=t.closest?.('[data-asb80-review],[data-cat86-review]');
      if(review){
        const id=review.dataset.asb80Review||review.dataset.cat86Review;
        [120,350,800].forEach(ms=>setTimeout(()=>addDeleteToReview(id),ms));
      }
    },true);

    const bodyObserver=new MutationObserver(()=>{
      setTimeout(()=>{decorateTestSourceCards();ensureReportsBack();},35);
    });
    bodyObserver.observe(document.body,{childList:true,subtree:true});

    [300,900,1800,3200].forEach(ms=>setTimeout(()=>{
      refreshSiteLocations(true);
      decorateTestSourceCards();
      ensureReportsBack();
    },ms));
    window.addEventListener('pageshow',()=>setTimeout(()=>{
      refreshSiteLocations(true);decorateTestSourceCards();ensureReportsBack();
    },120));

    const style=document.createElement('style');
    style.id='repairBundleStylesV21095';
    style.textContent='.repair95-scope-evidence{margin-top:8px}.repair95-scope-evidence.item-card{margin-top:7px}';
    document.head.appendChild(style);

    window.SafetyRepairBundleV21095={
      refreshSiteLocations,
      updateContractorScope,
      decorateTestSourceCards,
      ensureReportsBack
    };
  }
  boot();
})();
