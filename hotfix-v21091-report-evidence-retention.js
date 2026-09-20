/* Safety Tracker v2.10.91 - position-scoped reporting, evidence filtering, people retention */
'use strict';
(function(){
  if(window.__REPORT_EVIDENCE_RETENTION_V21091)return;
  window.__REPORT_EVIDENCE_RETENTION_V21091=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const posApi=window.SafetyPositionsResponsibilitiesV21069;
    if(!core||!core.state||!core.sb||!posApi){setTimeout(boot,120);return;}
    install(core,posApi);
  }

  function install(core,posApi){
    const state=core.state,sb=core.sb;
    const $=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    const personName=id=>{
      const p=(state.people||[]).find(x=>x.id===id);
      return p?.display_name||p?.email||'User';
    };
    const deptName=id=>(state.departments||[]).find(x=>x.id===id)?.name||'Department';
    const activeDeptIdsForUser=uid=>(state.userDepartments||[]).filter(x=>x.user_id===uid).map(x=>x.department_id).filter(Boolean);

    let scopeMeta={positions:[],userPositions:[],responsibilities:[]};
    let reportScope=null;
    let retentionRows=[];
    let peopleFilter='ACTIVE';
    let peopleSearch='';

    /* ------------------------------------------------------------
       Position-aware report scope
       ------------------------------------------------------------ */
    async function loadScopeMeta(){
      try{
        const [p,u,r]=await Promise.all([
          sb.from('safety_positions_v21069').select('*').eq('active',true),
          sb.from('safety_user_positions_v21069').select('*').eq('active',true),
          sb.from('safety_responsibilities_v21069').select('*').eq('active',true)
        ]);
        scopeMeta={positions:p.data||[],userPositions:u.data||[],responsibilities:r.data||[]};
      }catch(e){console.warn('Report scope metadata',e)}
      if(!reportScope)reportScope=defaultReportScope();
    }

    function currentUserPositionDeptIds(){
      const uid=state.user?.id,out=new Set();
      const posMap=new Map(scopeMeta.positions.map(x=>[x.id,x]));
      for(const row of scopeMeta.userPositions){
        if(row.user_id!==uid)continue;
        const p=posMap.get(row.position_id);
        if(p?.primary_department_id)out.add(p.primary_department_id);
      }
      for(const r of scopeMeta.responsibilities){
        if(r.user_id===uid&&r.responsibility_type==='DEPARTMENT_MANAGER'&&r.department_id)out.add(r.department_id);
      }
      for(const d of activeDeptIdsForUser(uid))out.add(d);
      return [...out];
    }

    function isCurrentHsManager(){
      return scopeMeta.responsibilities.some(r=>r.user_id===state.user?.id&&r.responsibility_type==='HS_MANAGER'&&r.active!==false);
    }

    function defaultReportScope(){
      const deps=currentUserPositionDeptIds();
      if(deps.length===1)return 'DEPT:'+deps[0];
      if(deps.length>1)return 'MY_POSITIONS';
      if(isCurrentHsManager())return 'ALL';
      const own=activeDeptIdsForUser(state.user?.id);
      if(own.length===1)return 'DEPT:'+own[0];
      if(own.length>1)return 'MY_POSITIONS';
      return 'ALL';
    }

    function reportDeptIds(scope=reportScope){
      if(!scope||scope==='ALL')return null;
      if(scope==='MY_POSITIONS')return new Set(currentUserPositionDeptIds());
      if(scope.startsWith('DEPT:'))return new Set([scope.slice(5)]);
      return null;
    }

    function reportScopeLabel(scope=reportScope){
      if(!scope||scope==='ALL')return 'All site';
      if(scope==='MY_POSITIONS'){
        const names=[...reportDeptIds(scope)].map(deptName);
        return names.length?'My positions · '+names.join(' + '):'My positions';
      }
      if(scope.startsWith('DEPT:'))return deptName(scope.slice(5));
      return 'All site';
    }

    function userIdsForScope(scope=reportScope){
      if(!scope||scope==='ALL')return new Set((state.people||[]).map(p=>p.id));
      const deps=reportDeptIds(scope)||new Set(),out=new Set();
      for(const row of state.userDepartments||[]){
        if(deps.has(row.department_id))out.add(row.user_id);
      }
      return out;
    }

    function documentIdsForScope(scope=reportScope){
      if(!scope||scope==='ALL')return new Set((state.documents||[]).map(d=>d.id));
      const deps=reportDeptIds(scope)||new Set(),users=userIdsForScope(scope),out=new Set();
      const byDoc=new Map();
      for(const a of state.documentAudiences||[]){
        if(!byDoc.has(a.document_id))byDoc.set(a.document_id,[]);
        byDoc.get(a.document_id).push(a);
      }
      for(const d of state.documents||[]){
        const rows=byDoc.get(d.id)||[];
        if(rows.some(a=>a.target_type==='EVERYONE')){out.add(d.id);continue}
        if(rows.some(a=>a.target_type==='DEPARTMENT'&&deps.has(a.department_id))){out.add(d.id);continue}
        if(rows.some(a=>a.target_type==='PERSON'&&users.has(a.user_id))){out.add(d.id);continue}
      }
      return out;
    }

    function firstAidBoxIdsForScope(scope=reportScope){
      if(!scope||scope==='ALL')return new Set((state.firstAidBoxes||[]).map(x=>x.id));
      const deps=reportDeptIds(scope)||new Set();
      return new Set((state.firstAidBoxes||[]).filter(x=>deps.has(x.department_id)).map(x=>x.id));
    }

    const scopedKeys=[
      'people','userDepartments','trainingAssignments','trainingSignoffs','trainingExceptions','trainingConfirmations',
      'awarenessAssignments','awarenessActivity','ppeAssignments','ppeChecks','ppeCheckItems',
      'firstAidBoxes','firstAidBoxItems','firstAidChecks','firstAidCheckItems',
      'documents','versions','documentReviews','documentActivity','documentAudiences',
      'documentLinks','trainingDocumentLinks'
    ];

    function applyScopedState(scope=reportScope){
      if(!scope||scope==='ALL')return null;
      const saved={};
      for(const k of scopedKeys)saved[k]=state[k];

      const users=userIdsForScope(scope),docs=documentIdsForScope(scope),boxes=firstAidBoxIdsForScope(scope);
      const assignments=(state.trainingAssignments||[]).filter(a=>users.has(a.user_id));
      const assignmentIds=new Set(assignments.map(a=>a.id));
      const checkIds=new Set((state.ppeChecks||[]).filter(c=>users.has(c.user_id)).map(c=>c.id));
      const faChecks=(state.firstAidChecks||[]).filter(c=>boxes.has(c.box_id)||users.has(c.assigned_user_id)||users.has(c.submitted_by));
      const faCheckIds=new Set(faChecks.map(c=>c.id));
      const versionIds=new Set((state.versions||[]).filter(v=>docs.has(v.document_id)).map(v=>v.id));

      state.people=(state.people||[]).filter(p=>users.has(p.id));
      state.userDepartments=(state.userDepartments||[]).filter(x=>users.has(x.user_id));
      state.trainingAssignments=assignments;
      state.trainingSignoffs=(state.trainingSignoffs||[]).filter(x=>users.has(x.user_id)||assignmentIds.has(x.training_assignment_id));
      state.trainingExceptions=(state.trainingExceptions||[]).filter(x=>users.has(x.user_id)||assignmentIds.has(x.training_assignment_id));
      state.trainingConfirmations=(state.trainingConfirmations||[]).filter(x=>users.has(x.user_id)||assignmentIds.has(x.assignment_id));
      state.awarenessAssignments=(state.awarenessAssignments||[]).filter(x=>users.has(x.user_id));
      state.awarenessActivity=(state.awarenessActivity||[]).filter(x=>users.has(x.user_id));
      state.ppeAssignments=(state.ppeAssignments||[]).filter(x=>users.has(x.user_id));
      state.ppeChecks=(state.ppeChecks||[]).filter(x=>users.has(x.user_id));
      state.ppeCheckItems=(state.ppeCheckItems||[]).filter(x=>checkIds.has(x.check_id));
      state.firstAidBoxes=(state.firstAidBoxes||[]).filter(x=>boxes.has(x.id));
      state.firstAidBoxItems=(state.firstAidBoxItems||[]).filter(x=>boxes.has(x.box_id));
      state.firstAidChecks=faChecks;
      state.firstAidCheckItems=(state.firstAidCheckItems||[]).filter(x=>faCheckIds.has(x.check_id));
      state.documents=(state.documents||[]).filter(d=>docs.has(d.id));
      state.versions=(state.versions||[]).filter(v=>docs.has(v.document_id));
      state.documentReviews=(state.documentReviews||[]).filter(r=>docs.has(r.document_id)||versionIds.has(r.document_version_id));
      state.documentActivity=(state.documentActivity||[]).filter(a=>users.has(a.user_id)&&(a.document_id?docs.has(a.document_id):true));
      state.documentAudiences=(state.documentAudiences||[]).filter(a=>docs.has(a.document_id));
      state.documentLinks=(state.documentLinks||[]).filter(l=>docs.has(l.source_document_id)&&docs.has(l.target_document_id));
      state.trainingDocumentLinks=(state.trainingDocumentLinks||[]).filter(l=>docs.has(l.document_id));
      return saved;
    }

    function restoreScopedState(saved){
      if(!saved)return;
      for(const [k,v] of Object.entries(saved))state[k]=v;
    }

    function withScopeSync(fn,scope=reportScope){
      const saved=applyScopedState(scope);
      try{return fn()}finally{restoreScopedState(saved)}
    }
    async function withScope(fn,scope=reportScope){
      const saved=applyScopedState(scope);
      try{return await fn()}finally{restoreScopedState(saved)}
    }

    function reportScopeOptions(){
      const mine=currentUserPositionDeptIds(),active=(state.departments||[]).filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
      const opts=[];
      if(mine.length>1)opts.push(`<option value="MY_POSITIONS">My positions · ${mine.map(deptName).join(' + ')}</option>`);
      for(const d of active)opts.push(`<option value="DEPT:${d.id}">${esc(d.name)}</option>`);
      opts.push('<option value="ALL">All site</option>');
      return opts.join('');
    }

    function ensureReportScopeUi(){
      const view=$('reportsView');if(!view||core.isReportViewer?.())return;
      let box=$('reportScopeCardV21091');
      if(!box){
        box=document.createElement('div');
        box.id='reportScopeCardV21091';
        box.className='section-card report-manager-content report-scope-v21091';
        const stats=$('reportStats');
        stats?.insertAdjacentElement('beforebegin',box);
      }
      box.innerHTML=`<div class="row-between"><div><h3>Reporting scope</h3><p class="muted">Defaults from your active position(s). A person may hold multiple positions; use My positions for the combined departments, or switch to another department / All site when required.</p></div></div>
        <div class="form-grid"><label>Show reports for<select id="reportScopeSelectV21091">${reportScopeOptions()}</select></label>
        <div class="hint-box"><strong>Current scope:</strong> ${esc(reportScopeLabel())}. Export buttons below use this same scope.</div></div>`;
      const sel=$('reportScopeSelectV21091');
      if(sel){
        if([...sel.options].some(o=>o.value===reportScope))sel.value=reportScope;
        else{reportScope=defaultReportScope();sel.value=reportScope}
      }
    }

    const baseRenderReports=window.renderReports;
    if(typeof baseRenderReports==='function'){
      window.renderReports=function(){
        const out=withScopeSync(()=>baseRenderReports.apply(this,arguments));
        ensureReportScopeUi();
        return out;
      };
    }

    const baseActivity=window.renderDocumentActivityReport;
    if(typeof baseActivity==='function'){
      window.renderDocumentActivityReport=function(){
        return withScopeSync(()=>baseActivity.apply(this,arguments));
      };
    }

    document.addEventListener('change',e=>{
      if(e.target?.id==='reportScopeSelectV21091'){
        reportScope=e.target.value||'ALL';
        try{window.renderReports()}catch(err){console.warn(err)}
      }
    },true);

    async function scopedReportAction(id){
      const scope=reportScope||'ALL';
      const label=reportScopeLabel(scope);
      if(id==='outstandingPdfBtn')return withScope(()=>window.downloadReport?.('outstanding'),scope);
      if(id==='trainingMatrixPdfBtn')return withScope(()=>window.downloadReport?.('matrix'),scope);
      if(id==='trainingSignoffsPdfBtn')return withScope(()=>window.downloadReport?.('signoffs'),scope);
      if(id==='reviewDatesPdfBtn')return withScope(()=>window.downloadReport?.('reviews'),scope);
      if(id==='trainingExcelBtn')return withScope(()=>window.downloadTrainingExcel?.(),scope);
      if(id==='generatePpeReportBtn')return withScope(()=>window.runPpeReportButton?.(),scope);
      if(id==='generateFirstAidReportBtn')return withScope(()=>window.downloadFirstAidReport?.(),scope);
      if(id==='documentActivityPdfBtn')return withScope(()=>window.downloadDocumentActivityPdf?.(),scope);
      if(id==='generateMonthlyReportBtn'){
        const b=$('generateMonthlyReportBtn'),value=$('monthlyReportMonth')?.value||'';
        if(b){b.disabled=true;b.textContent='Generating…'}
        try{
          const report=await withScope(()=>window.generateMonthlySafetyReport?.(value,{download:true,archive:true}),scope);
          if(report?.id&&scope!=='ALL'){
            const summary={...(report.summary||{}),report_scope:scope,report_scope_label:label};
            const u=await sb.from('generated_reports').update({summary}).eq('id',report.id);
            if(!u.error)report.summary=summary;
          }
          return report;
        }finally{
          if(b){b.disabled=false;b.textContent='Generate monthly report'}
        }
      }
      return null;
    }

    const scopedButtons=new Set([
      'outstandingPdfBtn','trainingMatrixPdfBtn','trainingExcelBtn','trainingSignoffsPdfBtn',
      'reviewDatesPdfBtn','generateMonthlyReportBtn','generatePpeReportBtn','generateFirstAidReportBtn',
      'documentActivityPdfBtn'
    ]);
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b||!scopedButtons.has(b.id))return;
      e.preventDefault();e.stopImmediatePropagation();
      scopedReportAction(b.id).catch(err=>{console.error(err);toast(err?.message||'Could not create scoped report.')});
    },true);

    /* ------------------------------------------------------------
       Evidence Pack: person first, then only relevant documents/training
       ------------------------------------------------------------ */
    function evidenceBaseDocumentIds(personId){
      const deps=new Set(activeDeptIdsForUser(personId)),out=new Set();
      const rowsByDoc=new Map();
      for(const a of state.documentAudiences||[]){
        if(!rowsByDoc.has(a.document_id))rowsByDoc.set(a.document_id,[]);
        rowsByDoc.get(a.document_id).push(a);
      }
      for(const d of state.documents||[]){
        if(d.status==='ARCHIVED')continue;
        const rows=rowsByDoc.get(d.id)||[];
        if(rows.some(a=>a.target_type==='EVERYONE')||
           rows.some(a=>a.target_type==='PERSON'&&a.user_id===personId)||
           rows.some(a=>a.target_type==='DEPARTMENT'&&deps.has(a.department_id))){
          out.add(d.id);
        }
      }
      const assignedTrainingIds=new Set((state.trainingAssignments||[]).filter(a=>a.user_id===personId&&a.active!==false).map(a=>a.training_session_id));
      for(const t of state.training||[]){
        if(assignedTrainingIds.has(t.id)&&t.source_document_id)out.add(t.source_document_id);
      }
      for(const h of state.historicalDocAssignments||[]){
        if(h.user_id===personId&&h.document_id)out.add(h.document_id);
      }
      return out;
    }

    function expandSupportingDocs(seed){
      const out=new Set(seed),queue=[...seed].map(id=>({id,depth:0}));
      while(queue.length){
        const cur=queue.shift();if(cur.depth>=3)continue;
        for(const l of state.documentLinks||[]){
          let other=null;
          if(l.source_document_id===cur.id)other=l.target_document_id;
          else if(l.target_document_id===cur.id)other=l.source_document_id;
          if(!other||out.has(other))continue;
          const d=(state.documents||[]).find(x=>x.id===other);
          if(!d||d.status==='ARCHIVED')continue;
          out.add(other);queue.push({id:other,depth:cur.depth+1});
        }
      }
      return out;
    }

    function evidenceAllowedTraining(personId,allowedDocs){
      const deps=new Set(activeDeptIdsForUser(personId)),out=new Set();
      const assigned=new Set((state.trainingAssignments||[]).filter(a=>a.user_id===personId&&a.active!==false).map(a=>a.training_session_id));
      for(const t of state.training||[]){
        if(t.status==='ARCHIVED'||t.source_document_id)continue;
        if(assigned.has(t.id)){out.add(t.id);continue}
        const rows=(state.trainingAudiences||[]).filter(a=>a.training_session_id===t.id);
        if(rows.some(a=>a.target_type==='EVERYONE')||
           rows.some(a=>a.target_type==='PERSON'&&a.user_id===personId)||
           rows.some(a=>a.target_type==='DEPARTMENT'&&deps.has(a.department_id))){
          out.add(t.id);continue;
        }
        if((state.trainingDocumentLinks||[]).some(l=>l.training_session_id===t.id&&allowedDocs.has(l.document_id)))out.add(t.id);
      }
      return out;
    }

    function applyEvidencePersonScope(){
      const person=$('evidencePerson');
      if(!person)return;
      const pid=person.value||'',body=$('modalBody');
      let note=$('evidencePersonScopeNoteV21091');
      if(!note){
        note=document.createElement('div');
        note.id='evidencePersonScopeNoteV21091';
        note.className='hint-box';
        const grid=person.closest('.form-grid');
        grid?.insertAdjacentElement('afterend',note);
      }
      const generate=body?.querySelector('[data-generate-evidence-selected]');

      if(!pid){
        note.innerHTML='<strong>Select the person first.</strong> Safety Tracker will then show only documents assigned directly to them, their department(s), Everyone/site-wide requirements, and supporting documents linked to those assigned controls.';
        body?.querySelectorAll('.evidence-choice').forEach(x=>{x.hidden=true});
        if(generate)generate.disabled=true;
        return;
      }

      const base=evidenceBaseDocumentIds(pid),allowedDocs=expandSupportingDocs(base),allowedTraining=evidenceAllowedTraining(pid,allowedDocs);
      let visibleDocs=0,visibleTraining=0;

      body?.querySelectorAll('.evidence-doc-choice').forEach(input=>{
        const allowed=allowedDocs.has(input.value);
        input.dataset.personAllowed=allowed?'1':'0';
        const row=input.closest('.evidence-choice');
        if(!allowed){input.checked=false;row.hidden=true}
        else visibleDocs++;
      });
      body?.querySelectorAll('.evidence-training-choice').forEach(input=>{
        const allowed=allowedTraining.has(input.value);
        input.dataset.personAllowed=allowed?'1':'0';
        const row=input.closest('.evidence-choice');
        if(!allowed){input.checked=false;row.hidden=true}
        else visibleTraining++;
      });

      const p=(state.people||[]).find(x=>x.id===pid);
      const deps=activeDeptIdsForUser(pid).map(deptName);
      note.innerHTML=`<strong>${esc(p?.display_name||p?.email||'Selected person')}</strong> · ${esc(deps.join(' + ')||'No department')}<br>
        Showing ${visibleDocs} relevant controlled/supporting document${visibleDocs===1?'':'s'} and ${visibleTraining} relevant standalone training / Toolbox Talk item${visibleTraining===1?'':'s'}.`;

      if(generate)generate.disabled=false;
      setTimeout(()=>{
        try{window.updateEvidenceSelectedSummary?.();window.updateEvidenceMissingLinks?.()}catch(_e){}
        body?.querySelectorAll('.evidence-group').forEach(g=>{
          const n=[...g.querySelectorAll('.evidence-choice')].filter(x=>!x.hidden).length;
          g.hidden=!n;
          const count=g.querySelector('.evidence-group-count');if(count)count.textContent=String(n);
        });
      },0);
    }

    const baseEvidenceFilter=window.applyEvidencePickerFilters;
    if(typeof baseEvidenceFilter==='function'){
      window.applyEvidencePickerFilters=function(){
        const out=baseEvidenceFilter.apply(this,arguments);
        const pid=$('evidencePerson')?.value||'';
        if(pid){
          document.querySelectorAll('.evidence-choice').forEach(row=>{
            const input=row.querySelector('input[data-person-allowed]');
            if(input?.dataset.personAllowed==='0')row.hidden=true;
          });
          document.querySelectorAll('.evidence-group').forEach(g=>{
            const visible=[...g.querySelectorAll('.evidence-choice')].filter(x=>!x.hidden);
            g.hidden=!visible.length;
          });
        }else{
          document.querySelectorAll('.evidence-choice').forEach(row=>row.hidden=true);
        }
        return out;
      };
    }

    function decorateEvidenceModal(){
      const modal=$('modal');
      if(!modal?.open||!$('evidencePerson'))return;
      applyEvidencePersonScope();
    }

    document.addEventListener('change',e=>{
      if(e.target?.id==='evidencePerson')setTimeout(()=>{try{window.applyEvidencePickerFilters?.()}catch(_e){};applyEvidencePersonScope()},0);
      if(e.target?.closest?.('.evidence-choice'))setTimeout(applyEvidencePersonScope,0);
    },true);

    const modalBody=$('modalBody');
    if(modalBody)new MutationObserver(()=>setTimeout(decorateEvidenceModal,20)).observe(modalBody,{childList:true,subtree:true});

    /* ------------------------------------------------------------
       People: Active default + disabled / retention review
       ------------------------------------------------------------ */
    async function loadRetention(){
      try{
        const r=await sb.rpc('people_retention_review_v21091');
        if(r.error)throw r.error;
        retentionRows=r.data||[];
      }catch(e){console.warn('People retention review',e);retentionRows=[]}
    }
    const retentionFor=id=>retentionRows.find(x=>x.user_id===id)||null;

    function retentionLabel(r){
      if(!r)return {label:'Retention review unavailable',traffic:'amber'};
      if(r.retention_status==='RECOMMEND_DELETE_ANONYMISE')return {label:'Recommend delete / anonymise',traffic:'red'};
      if(r.retention_status==='RETENTION_HOLD')return {label:'Retention hold',traffic:'amber'};
      if(r.retention_status==='REVIEW_DISABLED_DATE')return {label:'Retention date needs review',traffic:'amber'};
      return {label:r.recommend_after?'Retain until '+new Date(r.recommend_after+'T00:00:00').toLocaleDateString('en-GB'):'Retain',traffic:'neutral'};
    }

    function ensurePeopleToolbar(){
      const list=$('peopleList');if(!list)return;
      let box=$('peopleFiltersV21091');
      if(!box){
        box=document.createElement('div');
        box.id='peopleFiltersV21091';
        box.className='section-card people-filters-v21091';
        list.insertAdjacentElement('beforebegin',box);
      }
      box.innerHTML=`<div class="filters">
        <input id="peopleSearchV21091" type="search" placeholder="Search people…" value="${esc(peopleSearch)}">
        <select id="peopleStatusV21091">
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
          <option value="RECOMMEND">Recommended delete / anonymise</option>
          <option value="ALL">All</option>
        </select>
      </div>
      <div class="hint-box"><strong>Disabled ≠ delete.</strong> General Safety Tracker evidence defaults to a 6-year retention review period. Specific legal/statutory records can require longer retention and override deletion. The app only recommends review; it never deletes a person automatically.</div>`;
      const s=$('peopleStatusV21091');if(s)s.value=peopleFilter;
    }

    function decoratePeople(){
      const list=$('peopleList');if(!list)return;
      ensurePeopleToolbar();

      const ordered=[...(state.people||[])].sort((a,b)=>(a.active===false)-(b.active===false)||String(a.display_name||a.email).localeCompare(String(b.display_name||b.email)));
      const cards=[...list.querySelectorAll(':scope > .item-card')];

      cards.forEach((card,i)=>{
        const p=ordered[i];if(!p)return;
        card.dataset.personIdV21091=p.id;
        card.dataset.personActiveV21091=p.active===false?'0':'1';

        let extra=card.querySelector('.retention-v21091');
        if(p.active===false){
          const r=retentionFor(p.id),lab=retentionLabel(r);
          if(!extra){extra=document.createElement('div');extra.className='retention-v21091';card.appendChild(extra);}
          extra.innerHTML=`<div class="retention-status-v21091 traffic-${lab.traffic}">
            <strong>${esc(lab.label)}</strong>
            <div class="meta">
              ${p.disabled_at?`<span>Disabled ${new Date(p.disabled_at).toLocaleDateString('en-GB')}</span>`:''}
              ${r?.latest_evidence_at?`<span>Latest evidence ${new Date(r.latest_evidence_at).toLocaleDateString('en-GB')}</span>`:'<span>No personal safety evidence date found</span>'}
              ${r?.evidence_count!=null?`<span>${r.evidence_count} evidence event${Number(r.evidence_count)===1?'':'s'} considered</span>`:''}
            </div>
            <button type="button" class="ghost small" data-retention-details-v21091="${p.id}">Retention details</button>
          </div>`;
        }else if(extra)extra.remove();

        const text=(p.display_name||'')+' '+(p.email||'');
        const matchSearch=!peopleSearch||text.toLowerCase().includes(peopleSearch.toLowerCase());
        const rr=retentionFor(p.id);
        const matchStatus=
          peopleFilter==='ALL'||
          (peopleFilter==='ACTIVE'&&p.active!==false)||
          (peopleFilter==='DISABLED'&&p.active===false)||
          (peopleFilter==='RECOMMEND'&&p.active===false&&rr?.retention_status==='RECOMMEND_DELETE_ANONYMISE');
        card.hidden=!(matchSearch&&matchStatus);
      });
    }

    const baseRenderPeople=window.renderPeople;
    if(typeof baseRenderPeople==='function'){
      window.renderPeople=function(){
        const out=baseRenderPeople.apply(this,arguments);
        setTimeout(decoratePeople,0);
        return out;
      };
    }

    document.addEventListener('input',e=>{
      if(e.target?.id==='peopleSearchV21091'){
        peopleSearch=e.target.value||'';decoratePeople();
      }
    },true);
    document.addEventListener('change',e=>{
      if(e.target?.id==='peopleStatusV21091'){
        peopleFilter=e.target.value||'ACTIVE';decoratePeople();
      }
    },true);
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-retention-details-v21091]');
      if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const id=b.dataset.retentionDetailsV21091,p=(state.people||[]).find(x=>x.id===id),r=retentionFor(id);
      if(!p)return;
      const lab=retentionLabel(r);
      const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
      if(title)title.textContent='Retention review';
      if(body)body.innerHTML=`<div class="section-card"><h3>${esc(p.display_name||p.email)}</h3>
        <div class="meta"><span>${esc(lab.label)}</span>${p.disabled_at?`<span>Disabled ${new Date(p.disabled_at).toLocaleDateString('en-GB')}</span>`:''}</div>
        <p><strong>General Safety Tracker policy:</strong> ${esc(r?.retention_years||6)} years from the later of the disable date or latest personal safety evidence held in this app.</p>
        ${r?.latest_evidence_at?`<p><strong>Latest evidence considered:</strong> ${new Date(r.latest_evidence_at).toLocaleString('en-GB')}</p>`:''}
        ${r?.recommend_after?`<p><strong>Retention review date:</strong> ${new Date(r.recommend_after+'T00:00:00').toLocaleDateString('en-GB')}</p>`:''}
        ${r?.hold_reason?`<div class="pending-use-warning"><strong>Retention hold:</strong> ${esc(r.hold_reason)}${r.hold_until?' · until '+new Date(r.hold_until+'T00:00:00').toLocaleDateString('en-GB'):' · no end date'}</div>`:''}
        <div class="hint-box"><strong>Before deleting/anonymising:</strong> check whether any external or statutory record still requires the person to remain identifiable. Examples include asbestos/COSHH health-surveillance records with long statutory retention. Safety Tracker does not automatically delete people.</div>
      </div><div class="actions"><button type="button" class="primary" data-close-modal>Close</button></div>`;
      if(modal&&!modal.open)modal.showModal();
    },true);

    /* Keep decorations alive after refresh / navigation. */
    let timer=0;
    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{ensureReportScopeUi();decorateEvidenceModal();decoratePeople()},60)});
    observer.observe(document.body,{childList:true,subtree:true});

    Promise.all([loadScopeMeta(),loadRetention()]).then(()=>{
      reportScope=defaultReportScope();
      try{window.renderReports?.()}catch(_e){}
      try{window.renderPeople?.()}catch(_e){}
      ensureReportScopeUi();decoratePeople();
    });

    window.addEventListener('pageshow',()=>{
      Promise.all([loadScopeMeta(),loadRetention()]).then(()=>{
        if(!reportScope)reportScope=defaultReportScope();
        setTimeout(()=>{ensureReportScopeUi();decoratePeople();decorateEvidenceModal()},80);
      });
    });

    const style=document.createElement('style');
    style.id='reportEvidenceRetentionStylesV21091';
    style.textContent=`
      .report-scope-v21091{margin-bottom:12px}
      .people-filters-v21091{margin-bottom:12px}
      .retention-v21091{margin-top:10px;border-top:1px solid var(--border,#475569);padding-top:9px}
      .retention-status-v21091{border-left:4px solid var(--border,#475569);padding:8px 10px;border-radius:8px}
      .retention-status-v21091.traffic-red{border-left-color:#d33;background:rgba(150,20,20,.08)}
      .retention-status-v21091.traffic-amber{border-left-color:#b7791f;background:rgba(180,120,20,.08)}
      .retention-status-v21091.traffic-neutral{border-left-color:#7b8794}
      @media(max-width:760px){.report-scope-v21091 .form-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    window.SafetyReportEvidenceRetentionV21091={
      reload:async()=>{await Promise.all([loadScopeMeta(),loadRetention()]);reportScope=defaultReportScope();ensureReportScopeUi();decoratePeople()},
      reportScopeLabel,
      applyEvidencePersonScope,
      decoratePeople
    };
  }

  boot();
})();
