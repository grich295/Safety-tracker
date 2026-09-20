/* Safety Tracker v2.11.6 - cleaner asbestos upload/review/lookup workflow */
'use strict';
(function(){
  if(window.__SAFETY_ASBESTOS_WORKFLOW_V2116)return;
  window.__SAFETY_ASBESTOS_WORKFLOW_V2116=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,120);return;}
    install(core);
  }

  function install(core){
    const st=core.state,sb=core.sb;
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const isFullAdmin=()=>st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&st.uiMode!=='user'&&!st.offline;
    let stateTimer=0,renderBusy=false;

    function latest(rows,fn){
      return rows.filter(fn).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;
    }

    async function workflowData(){
      const [sr,br,er,cr]=await Promise.all([
        sb.from('asbestos_source_documents_v280').select('id,title,document_type,import_status,active,created_at').eq('active',true).order('created_at',{ascending:false}),
        sb.from('asbestos_import_batches_v21080').select('id,source_document_id,detected_document_type,status,item_count,proposed_location_count,warning_count,raw_metadata,created_at').order('created_at',{ascending:false}),
        sb.from('asbestos_register_entries_v280').select('id,record_kind,lifecycle_status,identification_status,source_document_id,active').eq('active',true),
        sb.from('asbestos_location_coverage_v21086').select('id,source_document_id,coverage_status,active').eq('active',true)
      ]);
      if(sr.error||br.error||er.error||cr.error)throw(sr.error||br.error||er.error||cr.error);

      const sources=sr.data||[],batches=br.data||[],entries=er.data||[],coverage=cr.data||[];
      const amp=latest(sources,s=>s.document_type==='AMP');
      const survey=latest(sources,s=>['MANAGEMENT_SURVEY','R_AND_D_SURVEY','REINSPECTION'].includes(s.document_type));
      const surveyBatch=survey?latest(batches,b=>b.source_document_id===survey.id):null;
      const ampBatch=amp?latest(batches,b=>b.source_document_id===amp.id):null;

      let items=[];
      if(surveyBatch){
        const ir=await sb.from('asbestos_import_items_v21080')
          .select('id,record_kind,lifecycle_event,identification_status,review_status,external_ref')
          .eq('import_id',surveyBatch.id).order('item_no');
        if(ir.error)throw ir.error;
        items=ir.data||[];
      }

      const itemCounts={
        acm:items.filter(x=>x.record_kind==='ACM').length,
        clear:items.filter(x=>x.record_kind==='NON_ACM'||x.identification_status==='NOT_DETECTED').length,
        noAccess:items.filter(x=>x.record_kind==='NO_ACCESS').length,
        review:items.filter(x=>x.review_status==='REVIEW').length
      };
      const current=entries.filter(x=>['PRESENT','UNKNOWN'].includes(String(x.lifecycle_status||'PRESENT').toUpperCase()));
      const currentAcm=current.filter(x=>x.record_kind!=='NO_ACCESS');
      const currentNoAccess=current.filter(x=>x.record_kind==='NO_ACCESS');
      const surveyCoverage=survey?coverage.filter(x=>x.source_document_id===survey.id):[];
      const clearLocations=surveyCoverage.filter(x=>x.coverage_status==='SURVEYED_NO_ACM').length;

      return {sources,batches,entries,coverage,amp,survey,ampBatch,surveyBatch,items,itemCounts,currentAcm,currentNoAccess,clearLocations};
    }

    function stepHtml(n,title,status,tone,body){
      return `<div class="asb-flow-step-v2116 ${tone}">
        <div class="asb-flow-step-num-v2116">${n}</div>
        <div><strong>${esc(title)}</strong><div class="asb-flow-status-v2116">${esc(status)}</div><div class="muted">${esc(body)}</div></div>
      </div>`;
    }

    async function renderAdminWorkflow(){
      if(renderBusy||!isFullAdmin())return;
      const list=$('asbestosSourceAdminList');
      if(!list)return;
      const card=list.closest('.section-card');if(!card)return;
      renderBusy=true;
      try{
        const d=await workflowData();
        let panel=$('asbestosWorkflowV2116');
        if(!panel){
          panel=document.createElement('div');
          panel.id='asbestosWorkflowV2116';
          panel.className='asb-workflow-v2116';
          const hint=card.querySelector('.hint-box');
          if(hint)hint.insertAdjacentElement('afterend',panel);
          else card.insertAdjacentElement('afterbegin',panel);
        }

        const ampOk=d.amp?.import_status==='APPROVED';
        const surveyApproved=d.survey?.import_status==='APPROVED'||d.surveyBatch?.status==='APPROVED';
        const surveyReady=d.surveyBatch?.status==='REVIEW_READY';
        const cat=d.surveyBatch?.raw_metadata?.location_catalogue||{};
        const locCount=Number(cat.unique_count??d.surveyBatch?.proposed_location_count??0);
        const breakdown=d.surveyBatch
          ?`${locCount} location${locCount===1?'':'s'} · ${d.itemCounts.acm} ACM/presumed · ${d.itemCounts.clear} surveyed clear · ${d.itemCounts.noAccess} no access`
          :'Upload the current management survey.';

        const s1=stepHtml(1,'Management Plan',
          ampOk?'Approved':d.amp?'Needs review':'Not loaded',
          ampOk?'green':d.amp?'amber':'neutral',
          'Controls and references only. The AMP does not create operational site locations.');

        const s2=stepHtml(2,'Survey',
          surveyApproved?'Published':surveyReady?'Ready to review':d.survey?'Analysing / review required':'Not loaded',
          surveyApproved?'green':surveyReady?'amber':d.survey?'amber':'neutral',
          breakdown);

        const live=d.currentAcm.length+d.currentNoAccess.length;
        const s3=stepHtml(3,'Live register & lookup',
          live?`${d.currentAcm.length} ACM/presumed · ${d.currentNoAccess.length} no access`:(surveyApproved?'No current ACM records':'Waiting for survey publication'),
          live?'green':surveyApproved?'green':'neutral',
          surveyApproved?`${d.clearLocations} surveyed-no-ACM location${d.clearLocations===1?'':'s'} recorded. Location checks and evidence can now be used.`:'Nothing becomes live until the survey is reviewed and published.');

        let actions='';
        if(surveyReady){
          actions+=`<button type="button" class="primary" data-asb-v2116-review="${esc(d.surveyBatch.id)}">Review & publish survey</button>`;
        }
        if(surveyApproved){
          actions+=`<button type="button" class="secondary" data-asb-v2116-open-lookup>Test Asbestos Lookup</button>`;
        }

        panel.innerHTML=`<div class="row-between"><div><h3>Asbestos setup — 3 clear steps</h3><p class="muted">Plan first, survey second, then publish the live register. Only the survey creates locations/register data.</p></div></div>
          <div class="asb-flow-grid-v2116">${s1}${s2}${s3}</div>
          ${actions?`<div class="actions">${actions}</div>`:''}`;
      }catch(e){
        console.warn('v2.11.6 workflow status',e);
      }finally{renderBusy=false}
    }

    async function renderLookupStatus(){
      const view=$('asbestosView'),summary=$('asbestosLookupSummary'),sel=$('asbestosLocationSelect');
      if(!view||!summary||!sel)return;
      try{
        const d=await workflowData();
        const surveyApproved=d.survey?.import_status==='APPROVED'||d.surveyBatch?.status==='APPROVED';
        if(sel.value)return; // selected-location result is rendered by the normal lookup
        if(!surveyApproved&&d.surveyBatch?.status==='REVIEW_READY'){
          const cat=d.surveyBatch.raw_metadata?.location_catalogue||{};
          const n=Number(cat.unique_count??d.surveyBatch.proposed_location_count??0);
          summary.innerHTML=`<div class="pending-use-warning"><strong>Survey loaded but not published yet.</strong><br>${n} locations are ready for Admin review. The live lookup will remain empty until <strong>Review & publish survey</strong> is completed.</div>`;
        }else if(surveyApproved){
          summary.innerHTML=`<div class="success-note"><strong>Register live.</strong><br>${d.currentAcm.length} current ACM/presumed record${d.currentAcm.length===1?'':'s'} · ${d.currentNoAccess.length} no-access/incomplete · ${d.clearLocations} surveyed-no-ACM location${d.clearLocations===1?'':'s'}. Select the exact work location above.</div>`;
        }else{
          summary.innerHTML='<div class="pending-use-warning"><strong>No published asbestos survey yet.</strong><br>Upload and publish the current survey before relying on location lookup.</div>';
        }
      }catch(e){console.warn('v2.11.6 lookup state',e)}
    }

    function simplifyLookup(){
      const view=$('asbestosView');if(!view)return;
      const p=view.querySelector('.page-heading .muted');
      if(p)p.textContent='Start with the exact work location. Use the advanced whole-floor / multiple-area check only when the job genuinely covers more than one area.';
      const select=$('asbestosLocationSelect');
      const card=select?.closest('.section-card');
      if(card&&!card.querySelector('.asb-simple-help-v2116')){
        const h=document.createElement('div');
        h.className='hint-box asb-simple-help-v2116';
        h.innerHTML='<strong>Simple check:</strong> 1. Select where you will work. 2. Read the result and source evidence. 3. The register check is logged automatically.';
        card.insertAdjacentElement('afterbegin',h);
      }
      collapseMulti();
    }

    function collapseMulti(){
      const sec=$('asbestosMultiLookupV21080');if(!sec)return;
      if(sec.dataset.v2116==='1')return;
      sec.dataset.v2116='1';
      const h=sec.querySelector('h3');if(h)h.textContent='Advanced: whole floor / multiple areas';
      const p=sec.querySelector('p');if(p)p.textContent='Use this only when the work scope covers a whole floor or several separate areas.';
      const btn=document.createElement('button');
      btn.type='button';btn.className='secondary';btn.dataset.asbV2116MultiToggle='1';btn.textContent='Open multi-area check';
      (p||h)?.insertAdjacentElement('afterend',btn);
      const body=document.createElement('div');
      body.className='asb-multi-body-v2116';body.hidden=true;
      const move=[...sec.children].filter(x=>x!==h&&x!==p&&x!==btn);
      move.forEach(x=>body.appendChild(x));
      sec.appendChild(body);
    }

    async function friendlyApprove(id){
      if(!isFullAdmin())return;
      const br=await sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single();
      if(br.error){core.toast?.(br.error.message);return}
      const b=br.data;
      const sr=await sb.from('asbestos_source_documents_v280').select('id,title,document_type').eq('id',b.source_document_id).single();
      if(sr.error){core.toast?.(sr.error.message);return}
      const source=sr.data;
      const ir=await sb.from('asbestos_import_items_v21080').select('record_kind,identification_status,review_status').eq('import_id',id);
      if(ir.error){core.toast?.(ir.error.message);return}
      const items=ir.data||[];
      const acm=items.filter(x=>x.record_kind==='ACM').length;
      const clear=items.filter(x=>x.record_kind==='NON_ACM'||x.identification_status==='NOT_DETECTED').length;
      const noAccess=items.filter(x=>x.record_kind==='NO_ACCESS').length;
      const cat=b.raw_metadata?.location_catalogue||{};
      const locs=Number(cat.unique_count??b.proposed_location_count??0);

      const amp=source.document_type==='AMP';
      const msg=amp
        ?`Approve this Asbestos Management Plan?\n\nIt will store management controls and references only.\nIt will NOT create site locations or asbestos register findings.`
        :`Publish this reviewed asbestos survey?\n\n${locs} locations\n${acm} ACM / presumed findings\n${clear} surveyed with no asbestos detected\n${noAccess} no-access / incomplete\n\nAfter publishing, these become available in Asbestos Lookup and contractor checks.`;
      if(!confirm(msg))return;

      try{
        const r=await sb.rpc('approve_asbestos_import_v21081',{p_import_id:id});
        if(r.error)throw r.error;
        try{$('modal')?.close()}catch(_e){}
        try{await core.loadAll?.()}catch(_e){}
        try{await window.SafetyAsbestosV21080?.refresh?.()}catch(_e){}
        await renderAdminWorkflow();
        await renderLookupStatus();
        core.toast?.(amp?'Management Plan approved. No site locations were created.':`Survey published: ${locs} locations · ${acm} ACM/presumed · ${clear} clear · ${noAccess} no-access.`);
      }catch(e){
        console.error('v2.11.6 asbestos approval',e);
        core.toast?.(e?.message||'Could not publish asbestos import.');
      }
    }

    function scheduleRender(){
      clearTimeout(stateTimer);
      stateTimer=setTimeout(()=>{
        renderAdminWorkflow();
        if($('asbestosView')?.classList.contains('active-view')){
          renderLookupStatus();simplifyLookup();
        }
      },100);
    }

    window.addEventListener('click',e=>{
      const approve=e.target.closest?.('[data-asb80-approve],[data-cat86-approve],[data-cat88-approve]');
      if(approve){
        e.preventDefault();e.stopImmediatePropagation();
        friendlyApprove(approve.dataset.cat88Approve||approve.dataset.cat86Approve||approve.dataset.asb80Approve);
        return;
      }
      const rev=e.target.closest?.('[data-asb-v2116-review]');
      if(rev){
        e.preventDefault();e.stopImmediatePropagation();
        if(window.SafetyAsbestosV21080?.review)window.SafetyAsbestosV21080.review(rev.dataset.asbV2116Review);
        return;
      }
      const open=e.target.closest?.('[data-asb-v2116-open-lookup]');
      if(open){
        e.preventDefault();e.stopImmediatePropagation();
        document.querySelector('#mainNav button[data-view="asbestos"]')?.click();
        return;
      }
      const multi=e.target.closest?.('[data-asb-v2116-multi-toggle]');
      if(multi){
        e.preventDefault();e.stopImmediatePropagation();
        const body=$('asbestosMultiLookupV21080')?.querySelector('.asb-multi-body-v2116');
        if(body){
          body.hidden=!body.hidden;
          multi.textContent=body.hidden?'Open multi-area check':'Close multi-area check';
        }
        return;
      }
      if(e.target.closest?.('#mainNav button[data-view="asbestos"]')){
        setTimeout(()=>{renderLookupStatus();simplifyLookup();},180);
      }
      if(e.target.closest?.('[data-admin-tile-v21083="asbestos"],[data-asb80-review],[data-asb87-reanalyse],#uploadAsbestosSourceBtn')){
        [250,900,1800].forEach(ms=>setTimeout(scheduleRender,ms));
      }
    },true);

    document.addEventListener('change',e=>{
      if(e.target?.id==='asbestosLocationSelect')setTimeout(()=>{renderLookupStatus();simplifyLookup();},80);
    },true);

    const style=document.createElement('style');
    style.id='asbestosWorkflowStylesV2116';
    style.textContent=`
      .asb-workflow-v2116{margin:12px 0 16px;padding:14px;border:1px solid var(--border,#475569);border-radius:14px}
      .asb-workflow-v2116 h3{margin:0 0 4px}
      .asb-flow-grid-v2116{display:grid;gap:9px;margin-top:12px}
      .asb-flow-step-v2116{display:grid;grid-template-columns:38px 1fr;gap:10px;align-items:start;padding:11px;border:1px solid var(--border,#475569);border-radius:12px}
      .asb-flow-step-num-v2116{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:900;background:#374151}
      .asb-flow-step-v2116.green{border-color:#178044}
      .asb-flow-step-v2116.green .asb-flow-step-num-v2116{background:#14532d}
      .asb-flow-step-v2116.amber{border-color:#b7791f}
      .asb-flow-step-v2116.amber .asb-flow-step-num-v2116{background:#78350f}
      .asb-flow-status-v2116{font-weight:800;margin:2px 0 3px}
      .asb-simple-help-v2116{margin-bottom:10px}
      .asb-multi-body-v2116[hidden]{display:none!important}
      #asbestosMultiLookupV21080 > button[data-asb-v2116-multi-toggle]{margin-top:8px}
      @media(max-width:760px){
        .asb-workflow-v2116{padding:11px}
        .asb-flow-step-v2116{grid-template-columns:34px 1fr;padding:10px}
      }
    `;
    document.head.appendChild(style);

    [250,800,1600,3000].forEach(ms=>setTimeout(scheduleRender,ms));
    window.addEventListener('pageshow',()=>setTimeout(scheduleRender,180));

    window.SafetyAsbestosWorkflowV2116={
      refresh:scheduleRender,
      approve:friendlyApprove,
      simplify:simplifyLookup
    };
  }

  boot();
})();
