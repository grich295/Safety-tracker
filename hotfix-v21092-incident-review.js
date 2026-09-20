/* Safety Tracker v2.10.92 - non-personal incident / near-miss review triggers */
'use strict';
(function(){
  if(window.__INCIDENT_REVIEW_V21092)return;
  window.__INCIDENT_REVIEW_V21092=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,120);return;}
    install(core);
  }

  function install(core){
    const state=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
    const fmtDateTime=v=>v?new Date(v).toLocaleString('en-GB'):'—';
    const today=()=>new Date().toISOString().slice(0,10);
    const role=()=>String(state.profile?.role||'').toLowerCase();
    const reportViewer=()=>state.profile?.report_only===true;
    const manager=()=>!reportViewer()&&['admin','manager'].includes(role())&&!(role()==='admin'&&(state.offline||state.uiMode==='user'));
    const admin=()=>manager()&&role()==='admin';

    const S={categories:[],triggers:[],docs:[],training:[],docMaps:[],trainingMaps:[],selected:null};
    const category=id=>S.categories.find(x=>x.id===id)||null;
    const documentBy=id=>(state.documents||[]).find(x=>x.id===id)||null;
    const trainingBy=id=>(state.training||[]).find(x=>x.id===id)||null;
    const department=id=>(state.departments||[]).find(x=>x.id===id)||null;
    const location=id=>(state.siteLocations||[]).find(x=>x.id===id)||null;
    const label=x=>clean((x?.reference?x.reference+' - ':'')+(x?.title||x?.name||'Untitled'));
    const person=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Manager'};
    function locationPath(id){const out=[];let x=location(id),g=0;while(x&&g++<30){out.unshift(x.name);x=x.parent_id?location(x.parent_id):null}return out.join(' > ')}
    const statusText=v=>({TRIGGERED:'Triggered',REVIEW_IN_PROGRESS:'Review in progress',ACTIONS_OUTSTANDING:'Actions / training outstanding',COMPLETE:'Complete',CANCELLED:'Cancelled'})[v]||String(v||'').replaceAll('_',' ');
    const decisionText=v=>({NO_CHANGE:'No change required',CONTROLS_UPDATE:'Controls need updating',NEW_VERSION_REQUIRED:'New version required',RETRAIN_REQUIRED:'Training / refresher required',DOCUMENT_UNSUITABLE:'Document not currently suitable',TRAINING_UNSUITABLE:'Training not currently suitable'})[v]||String(v||'').replaceAll('_',' ');
    const traffic=v=>v==='COMPLETE'?'green':v==='ACTIONS_OUTSTANDING'?'red':v==='CANCELLED'?'neutral':'amber';

    async function load(){
      if(!state.user||state.offline||!navigator.onLine)return;
      const rs=await Promise.all([
        sb.from('incident_review_categories_v21092').select('*').order('sort_order').order('name'),
        sb.from('incident_review_triggers_v21092').select('*').order('trigger_date',{ascending:false}).order('created_at',{ascending:false}),
        sb.from('incident_review_document_impacts_v21092').select('*').order('created_at'),
        sb.from('incident_review_training_impacts_v21092').select('*').order('created_at'),
        sb.from('incident_review_category_documents_v21092').select('*'),
        sb.from('incident_review_category_training_v21092').select('*')
      ]);
      const err=rs.find(r=>r.error)?.error;if(err)throw err;
      [S.categories,S.triggers,S.docs,S.training,S.docMaps,S.trainingMaps]=rs.map(r=>r.data||[]);
    }

    function triggerCounts(id){
      const all=S.docs.filter(x=>x.trigger_id===id).concat(S.training.filter(x=>x.trigger_id===id));
      return {
        open:all.filter(x=>x.match_strength==='REQUIRED'&&x.review_status==='OPEN').length,
        actions:all.filter(x=>x.action_status==='OPEN').length,
        suggestions:all.filter(x=>x.match_strength==='SUGGESTED'&&x.review_status==='OPEN').length,
        reviewed:all.filter(x=>x.review_status==='COMPLETE').length
      };
    }

    function openModal(title,html){
      const d=$('modal'),h=$('modalTitle'),b=$('modalBody');
      if(h)h.textContent=title;if(b)b.innerHTML=html;if(d&&!d.open)d.showModal();
    }
    function closeModal(){try{$('modal')?.close()}catch(_e){}}

    function ensureTile(){
      if(!manager())return;
      const grid=document.querySelector('.management-tile-grid-v21079');if(!grid)return;
      let b=grid.querySelector('[data-inc92-open]');
      if(!b){b=document.createElement('button');b.type='button';b.className='management-tile-v21079';b.dataset.inc92Open='1';grid.appendChild(b)}
      const n=S.triggers.filter(x=>!['COMPLETE','CANCELLED'].includes(x.status)).length;
      b.innerHTML='<span class="management-tile-icon-v21079" aria-hidden="true">⚠</span>'+(n?`<span class="management-tile-count-v21079">${n}</span>`:'')+'<strong>Incident Review</strong><span>Trigger H&amp;S reviews after an incident or near miss — no casualty data stored here.</span>';
    }

    function ensurePanel(){
      const view=$('reportsView');if(!view)return null;
      let p=$('incidentReviewPanelV21092');
      if(!p){p=document.createElement('section');p.id='incidentReviewPanelV21092';p.className='incident-review-panel-v21092';view.appendChild(p)}
      return p;
    }

    function openHub(){
      if(!manager())return;
      try{window.showView?.('reports')}catch(_e){}
      const view=$('reportsView');if(!view)return;
      view.classList.remove('management-home-active-v21079');view.classList.add('incident-review-active-v21092');S.selected=null;
      load().then(()=>{render();ensureTile()}).catch(e=>toast(e.message||'Could not load incident review triggers.'));
    }
    function backManagement(){
      $('reportsView')?.classList.remove('incident-review-active-v21092');S.selected=null;
      try{window.SafetyManagementTilesV21079?.open?.()}catch(_e){}
    }

    function render(){
      const p=ensurePanel();if(!p||!manager())return;
      if(S.selected)return renderDetail(S.selected);
      const open=S.triggers.filter(x=>!['COMPLETE','CANCELLED'].includes(x.status)).length;
      const act=S.triggers.filter(x=>x.status==='ACTIONS_OUTSTANDING').length;
      const done=S.triggers.filter(x=>x.status==='COMPLETE').length;
      p.innerHTML=`<div class="row-between inc92-head"><div><button class="secondary small" data-inc92-management>← Management</button><h2>Incident / near-miss review triggers</h2><p class="muted">Use your existing incident system for names, witnesses, medical information and investigation statements. Safety Tracker only records the H&amp;S review trigger and resulting control/training actions.</p></div><div class="row"><button class="primary" data-inc92-new>New review trigger</button>${admin()?'<button class="secondary" data-inc92-categories>Manage categories</button>':''}</div></div>
      <div class="stats-grid"><div><strong>${open}</strong><span>Open triggers</span></div><div><strong>${act}</strong><span>Actions outstanding</span></div><div><strong>${done}</strong><span>Completed</span></div></div>
      <div class="hint-box"><strong>No person is linked to a trigger.</strong> If retraining is required, the existing document/training audience drives it — not an injured-person field.</div>
      <div class="card-list">${S.triggers.length?S.triggers.map(t=>{
        const c=category(t.category_id),n=triggerCounts(t.id),deps=(t.department_ids||[]).map(id=>department(id)?.name).filter(Boolean),locs=(t.location_ids||[]).map(locationPath).filter(Boolean),tr=traffic(t.status);
        return `<div class="item-card traffic-${tr}"><div class="row-between"><div><strong>${esc(t.external_ref||('Review trigger · '+fmtDate(t.trigger_date)))}</strong><div class="meta"><span>${esc(c?.name||'Incident review')}</span><span>${fmtDate(t.trigger_date)}</span><span>${deps.length?esc(deps.join(' + ')):'Site-wide'}</span></div>${locs.length?`<div class="muted">${esc(locs.join(' · '))}</div>`:''}${t.short_note?`<div class="muted">${esc(t.short_note)}</div>`:''}</div><span class="badge ${tr==='green'?'complete':tr==='red'?'overdue':'due'}">${esc(statusText(t.status))}</span></div><div class="meta"><span>${n.open} review${n.open===1?'':'s'} open</span><span>${n.actions} action${n.actions===1?'':'s'} open</span><span>${n.suggestions} suggestion${n.suggestions===1?'':'s'}</span></div><div class="row"><button class="primary" data-inc92-open-trigger="${t.id}">${t.status==='COMPLETE'?'Open report':'Continue review'}</button></div></div>`;
      }).join(''):'<div class="empty">No incident review triggers yet.</div>'}</div>`;
    }

    function newTrigger(){
      const cats=S.categories.filter(x=>x.active!==false),deps=(state.departments||[]).filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name))),locs=(state.siteLocations||[]).filter(x=>x.active!==false).sort((a,b)=>locationPath(a.id).localeCompare(locationPath(b.id),undefined,{numeric:true}));
      openModal('New incident / near-miss review trigger',`<div class="danger-note"><strong>Do not enter casualty or personal information.</strong> Keep names, witnesses, medical information and investigation statements in the normal incident system.</div><div class="form-grid"><label>External incident reference<input id="inc92Ref" maxlength="80" placeholder="e.g. INC-2458"></label><label>Date<input id="inc92Date" type="date" value="${today()}"></label><label class="full">Category<select id="inc92Category"><option value="">Select category</option>${cats.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><label class="full">Short non-personal note<textarea id="inc92Note" maxlength="500" rows="3" placeholder="e.g. Electrical incident during maintenance task — no personal details here."></textarea></label></div>
      <div class="section-card"><h4>Affected department(s)</h4><p class="muted">Leave all unticked for whole-site. Select one or more for department-specific events.</p><div class="checkbox-list inc92-check-list">${deps.map(d=>`<label class="check-row"><input type="checkbox" class="inc92-dept" value="${d.id}"> ${esc(d.name)}</label>`).join('')}</div></div>
      <div class="section-card"><h4>Affected location(s) <span class="muted">optional</span></h4><input id="inc92LocSearch" type="search" placeholder="Search room, floor or area…"><div class="checkbox-list inc92-scroll">${locs.map(l=>`<label class="check-row inc92-loc-row" data-search="${esc(locationPath(l.id).toLowerCase())}"><input type="checkbox" class="inc92-loc" value="${l.id}"> ${esc(locationPath(l.id))}</label>`).join('')}</div></div><div class="actions"><button class="ghost" data-close-modal>Cancel</button><button class="primary" data-inc92-save-trigger>Create review trigger</button></div>`);
    }

    async function saveTrigger(){
      const cid=$('inc92Category')?.value,date=$('inc92Date')?.value;if(!cid)return toast('Choose a category.');if(!date)return toast('Enter the incident / near-miss date.');
      const r=await sb.rpc('create_incident_review_trigger_v21092',{p_external_ref:clean($('inc92Ref')?.value)||null,p_trigger_date:date,p_category_id:cid,p_department_ids:[...document.querySelectorAll('.inc92-dept:checked')].map(x=>x.value),p_location_ids:[...document.querySelectorAll('.inc92-loc:checked')].map(x=>x.value),p_short_note:clean($('inc92Note')?.value)||null});
      if(r.error)return toast(r.error.message);closeModal();await load();S.selected=r.data?.id;render();ensureTile();toast(`Trigger created: ${r.data?.required_documents||0} required document(s), ${r.data?.required_training||0} required training item(s), ${(r.data?.suggested_documents||0)+(r.data?.suggested_training||0)} suggestion(s).`);
    }

    function docImpact(x){
      const d=documentBy(x.document_id);if(!d)return '';
      if(x.match_strength==='SUGGESTED'&&x.review_status==='OPEN')return `<div class="item-card compact traffic-amber"><div class="row-between"><div><strong>${esc(label(d))}</strong><div class="meta"><span>${esc(d.doc_type)}</span><span>Suggested · ${esc(x.match_basis.replaceAll('_',' '))}</span>${!x.scope_match?'<span>Outside selected department scope</span>':''}</div></div><span class="badge due">Suggestion</span></div><div class="row"><button class="secondary small" data-inc92-open-doc="${d.id}">Open</button><button class="primary small" data-inc92-include="DOCUMENT|${x.id}">Include review</button><button class="ghost small" data-inc92-dismiss="DOCUMENT|${x.id}">Dismiss</button></div></div>`;
      const tr=x.action_status==='OPEN'?'red':x.review_status==='OPEN'?'amber':'green';
      return `<div class="item-card compact traffic-${tr}"><div class="row-between"><div><strong>${esc(label(d))}</strong><div class="meta"><span>${esc(d.doc_type)}</span>${x.decision?`<span>${esc(decisionText(x.decision))}</span>`:''}</div></div><span class="badge ${tr==='green'?'complete':tr==='red'?'overdue':'due'}">${x.action_status==='OPEN'?'Action outstanding':x.review_status==='OPEN'?'Review required':'Reviewed'}</span></div>${x.decision_note?`<div class="muted">${esc(x.decision_note)}</div>`:''}${x.action_note?`<div class="success-note inc92-compact"><strong>Action complete:</strong> ${esc(x.action_note)}</div>`:''}<div class="row"><button class="secondary small" data-inc92-open-doc="${d.id}">Open current</button>${x.review_status==='OPEN'?`<button class="primary small" data-inc92-review-doc="${x.id}">Record review decision</button>`:''}${x.action_status==='OPEN'?`<button class="primary small" data-inc92-complete-action="DOCUMENT|${x.id}">Mark action complete</button>`:''}</div></div>`;
    }

    function trainingImpact(x){
      const t=trainingBy(x.training_session_id);if(!t)return '';
      if(x.match_strength==='SUGGESTED'&&x.review_status==='OPEN')return `<div class="item-card compact traffic-amber"><div class="row-between"><div><strong>${esc(label(t))}</strong><div class="meta"><span>${esc(t.session_type)}</span><span>Suggested · ${esc(x.match_basis.replaceAll('_',' '))}</span>${!x.scope_match?'<span>Outside selected department scope</span>':''}</div></div><span class="badge due">Suggestion</span></div><div class="row"><button class="secondary small" data-inc92-open-training="${t.id}">Open</button><button class="primary small" data-inc92-include="TRAINING|${x.id}">Include review</button><button class="ghost small" data-inc92-dismiss="TRAINING|${x.id}">Dismiss</button></div></div>`;
      const tr=x.action_status==='OPEN'?'red':x.review_status==='OPEN'?'amber':'green';
      return `<div class="item-card compact traffic-${tr}"><div class="row-between"><div><strong>${esc(label(t))}</strong><div class="meta"><span>${esc(t.session_type)}</span>${x.decision?`<span>${esc(decisionText(x.decision))}</span>`:''}</div></div><span class="badge ${tr==='green'?'complete':tr==='red'?'overdue':'due'}">${x.action_status==='OPEN'?'Training action outstanding':x.review_status==='OPEN'?'Review required':'Reviewed'}</span></div>${x.decision_note?`<div class="muted">${esc(x.decision_note)}</div>`:''}${x.action_note?`<div class="success-note inc92-compact"><strong>Action complete:</strong> ${esc(x.action_note)}</div>`:''}<div class="row"><button class="secondary small" data-inc92-open-training="${t.id}">Open training</button>${x.review_status==='OPEN'?`<button class="primary small" data-inc92-review-training="${x.id}">Record review decision</button>`:''}${x.action_status==='OPEN'?`<button class="primary small" data-inc92-complete-action="TRAINING|${x.id}">Mark action complete</button>`:''}</div></div>`;
    }

    function renderDetail(id){
      const p=ensurePanel(),t=S.triggers.find(x=>x.id===id);if(!p||!t){S.selected=null;return render()}
      const c=category(t.category_id),d=S.docs.filter(x=>x.trigger_id===id),trn=S.training.filter(x=>x.trigger_id===id),n=triggerCounts(id),deps=(t.department_ids||[]).map(x=>department(x)?.name).filter(Boolean),locs=(t.location_ids||[]).map(locationPath).filter(Boolean),canClose=!['COMPLETE','CANCELLED'].includes(t.status)&&!n.open&&!n.actions&&!n.suggestions;
      p.innerHTML=`<div class="row-between inc92-head"><div><button class="secondary small" data-inc92-back-list>← Review triggers</button><h2>${esc(t.external_ref||('Incident review · '+fmtDate(t.trigger_date)))}</h2><div class="meta"><span>${esc(c?.name||'Incident review')}</span><span>${fmtDate(t.trigger_date)}</span><span>${deps.length?esc(deps.join(' + ')):'Site-wide'}</span></div></div><span class="badge ${traffic(t.status)==='green'?'complete':traffic(t.status)==='red'?'overdue':'due'}">${esc(statusText(t.status))}</span></div><div class="hint-box"><strong>External incident record stays in the other system.</strong> No casualty, witness or medical details are stored in this trigger.</div>${locs.length?`<div class="section-card"><strong>Affected location(s)</strong><div class="muted">${esc(locs.join(' · '))}</div></div>`:''}${t.short_note?`<div class="section-card"><strong>Non-personal trigger note</strong><div>${esc(t.short_note)}</div></div>`:''}<div class="stats-grid"><div><strong>${n.open}</strong><span>Reviews open</span></div><div><strong>${n.actions}</strong><span>Actions open</span></div><div><strong>${n.suggestions}</strong><span>Suggestions to clear</span></div></div><div class="section-card"><h3>Controlled documents</h3><p class="muted">Required items must be reviewed by the responsible H&amp;S/Department Manager. Suggestions can be included or dismissed.</p><div class="card-list">${d.length?d.map(docImpact).join(''):'<div class="empty">No controlled documents identified.</div>'}</div></div><div class="section-card"><h3>Training / Toolbox Talks</h3><p class="muted">Any retraining action uses the existing audience; the incident itself is not linked to an employee.</p><div class="card-list">${trn.length?trn.map(trainingImpact).join(''):'<div class="empty">No training items identified.</div>'}</div></div><div class="section-card"><h3>Close-out / report</h3>${t.status==='COMPLETE'?`<div class="success-note"><strong>Complete ${fmtDateTime(t.completed_at)}</strong><br>${esc(t.closure_note||'Review closed.')}</div>`:canClose?'<div class="success-note">All required reviews/actions are resolved. This trigger can now be closed.</div>':'<div class="pending-use-warning">Resolve every required review, action and suggestion before closing.</div>'}<div class="row"><button class="secondary" data-inc92-report="${t.id}">Download Incident Review PDF</button>${t.status!=='COMPLETE'?`<button class="primary" data-inc92-close="${t.id}" ${canClose?'':'disabled'}>Complete review trigger</button>`:''}</div></div>`;
    }

    function reviewModal(kind,id){
      const x=kind==='DOCUMENT'?S.docs.find(v=>v.id===id):S.training.find(v=>v.id===id);if(!x)return;
      const item=kind==='DOCUMENT'?documentBy(x.document_id):trainingBy(x.training_session_id);
      const opts=kind==='DOCUMENT'?[['NO_CHANGE','No change required'],['CONTROLS_UPDATE','Controls need updating'],['NEW_VERSION_REQUIRED','New version required'],['RETRAIN_REQUIRED','Training / refresher required'],['DOCUMENT_UNSUITABLE','Document not currently suitable']]:[['NO_CHANGE','No change required'],['RETRAIN_REQUIRED','Retraining / refresher required'],['NEW_VERSION_REQUIRED','New version / revised TBT required'],['TRAINING_UNSUITABLE','Training not currently suitable']];
      openModal('Record incident-trigger review decision',`<div class="hint-box"><strong>${esc(label(item))}</strong><br>This is the H&amp;S response to the trigger, not an accident investigation statement.</div><div class="form-grid"><label>Decision<select id="inc92Decision"><option value="">Choose</option>${opts.map(o=>`<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select></label><label class="full">Factual review note<textarea id="inc92DecisionNote" rows="4"></textarea></label></div><div class="actions"><button class="ghost" data-close-modal>Cancel</button><button class="primary" data-inc92-save-decision="${kind}|${id}">Save decision</button></div>`);
    }
    async function saveDecision(payload){const [kind,id]=payload.split('|'),decision=$('inc92Decision')?.value,note=clean($('inc92DecisionNote')?.value);if(!decision)return toast('Choose a decision.');if(note.length<5)return toast('Add a short factual review note.');const r=await sb.rpc(kind==='DOCUMENT'?'decide_incident_document_impact_v21092':'decide_incident_training_impact_v21092',{p_impact_id:id,p_decision:decision,p_note:note});if(r.error)return toast(r.error.message);closeModal();await load();render();ensureTile();toast('Review decision saved.')}
    async function includeDismiss(payload,include){const [kind,id]=payload.split('|'),r=await sb.rpc('set_incident_impact_inclusion_v21092',{p_target_type:kind,p_impact_id:id,p_include:include});if(r.error)return toast(r.error.message);await load();render();ensureTile();toast(include?'Suggestion added to required review.':'Suggestion dismissed.')}
    function actionModal(payload){openModal('Complete incident-review action',`<div class="hint-box">Only mark this complete when the resulting control/document/training action has actually been completed.</div><label>Completion note<textarea id="inc92ActionNote" rows="4"></textarea></label><div class="actions"><button class="ghost" data-close-modal>Cancel</button><button class="primary" data-inc92-save-action="${payload}">Mark complete</button></div>`)}
    async function saveAction(payload){const [kind,id]=payload.split('|'),note=clean($('inc92ActionNote')?.value);if(note.length<5)return toast('Add a short completion note.');const r=await sb.rpc('complete_incident_impact_action_v21092',{p_target_type:kind,p_impact_id:id,p_note:note});if(r.error)return toast(r.error.message);closeModal();await load();render();ensureTile();toast('Resulting action marked complete.')}
    function closeTriggerModal(id){openModal('Complete incident review trigger',`<div class="success-note">All required reviews, actions and suggestions are resolved.</div><label>Closure note<textarea id="inc92ClosureNote" rows="4"></textarea></label><div class="actions"><button class="ghost" data-close-modal>Cancel</button><button class="primary" data-inc92-save-close="${id}">Complete &amp; close</button></div>`)}
    async function saveClose(id){const note=clean($('inc92ClosureNote')?.value);if(note.length<5)return toast('Add a short closure note.');const r=await sb.rpc('close_incident_review_trigger_v21092',{p_trigger_id:id,p_closure_note:note});if(r.error)return toast(r.error.message);closeModal();await load();render();ensureTile();toast('Incident review trigger completed.')}

    function openDoc(id){const v=core.approvedCurrentVersion?.(id);if(!v)return toast('No approved/current document version is available.');try{window.openDocument?.(v.id)}catch(_e){}}
    function openTraining(id){try{if(typeof window.showTrainingDetails==='function')return window.showTrainingDetails(id);window.showView?.('training');toast('Open the item from H&S Training.')}catch(_e){}}

    function categoryList(){
      if(!admin())return;
      openModal('Incident review categories',`<div class="hint-box"><strong>Editable preset mappings.</strong> Mapped documents/TBTs are automatically required. Strong keywords can auto-identify matching titles; broader keywords create suggestions.</div><div class="row"><button class="primary" data-inc92-new-category>New category</button></div><div class="card-list" style="margin-top:10px">${S.categories.map(c=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(c.name)}</strong><div class="meta"><span>${esc(c.code)}</span><span>${S.docMaps.filter(x=>x.category_id===c.id).length} mapped docs</span><span>${S.trainingMaps.filter(x=>x.category_id===c.id).length} mapped training/TBT</span></div></div><span class="badge ${c.active===false?'neutral':'complete'}">${c.active===false?'Disabled':'Active'}</span></div><div class="row"><button class="secondary small" data-inc92-edit-category="${c.id}">Edit / map</button></div></div>`).join('')}</div>`);
    }
    function editCategory(id=''){
      if(!admin())return;
      const c=id?category(id):null,md=new Set(S.docMaps.filter(x=>x.category_id===id).map(x=>x.document_id)),mt=new Set(S.trainingMaps.filter(x=>x.category_id===id).map(x=>x.training_session_id)),docs=(state.documents||[]).filter(x=>x.status!=='ARCHIVED').sort((a,b)=>label(a).localeCompare(label(b),undefined,{numeric:true})),trs=(state.training||[]).filter(x=>x.status!=='ARCHIVED').sort((a,b)=>label(a).localeCompare(label(b),undefined,{numeric:true}));
      openModal(c?'Edit incident review category':'New incident review category',`<div class="form-grid"><label>Code<input id="inc92CatCode" value="${esc(c?.code||'')}" ${c?'readonly':''}></label><label>Name<input id="inc92CatName" value="${esc(c?.name||'')}"></label><label class="full">Description<textarea id="inc92CatDesc" rows="2">${esc(c?.description||'')}</textarea></label><label class="full">Strong auto-match keywords <span class="muted">one per line</span><textarea id="inc92CatAuto" rows="4">${esc((c?.auto_keywords||[]).join('\n'))}</textarea></label><label class="full">Suggestion keywords <span class="muted">one per line</span><textarea id="inc92CatSuggest" rows="4">${esc((c?.suggestion_keywords||[]).join('\n'))}</textarea></label><label class="check-row full"><input id="inc92CatActive" type="checkbox" ${c?.active===false?'':'checked'}> Active</label></div><div class="section-card"><h4>Always require these controlled documents</h4><input id="inc92DocMapSearch" type="search" placeholder="Search documents…"><div class="checkbox-list inc92-scroll">${docs.map(d=>`<label class="check-row inc92-doc-map" data-search="${esc(label(d).toLowerCase())}"><input type="checkbox" class="inc92-doc-map-input" value="${d.id}" ${md.has(d.id)?'checked':''}> ${esc(label(d))} <span class="muted">${esc(d.doc_type)}</span></label>`).join('')}</div></div><div class="section-card"><h4>Always require these training / Toolbox Talks</h4><input id="inc92TrainingMapSearch" type="search" placeholder="Search training…"><div class="checkbox-list inc92-scroll">${trs.map(t=>`<label class="check-row inc92-training-map" data-search="${esc(label(t).toLowerCase())}"><input type="checkbox" class="inc92-training-map-input" value="${t.id}" ${mt.has(t.id)?'checked':''}> ${esc(label(t))} <span class="muted">${esc(t.session_type)}</span></label>`).join('')}</div></div><div class="actions"><button class="ghost" data-inc92-categories>Back</button><button class="primary" data-inc92-save-category="${id}">Save category &amp; mappings</button></div>`);
    }
    const keywords=v=>String(v||'').split(/\n|,/).map(clean).filter(Boolean);
    async function saveCategory(id){
      if(!admin())return;const code=clean($('inc92CatCode')?.value).toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,''),name=clean($('inc92CatName')?.value);if(!code||!name)return toast('Category code and name are required.');const payload={code,name,description:clean($('inc92CatDesc')?.value)||null,auto_keywords:keywords($('inc92CatAuto')?.value),suggestion_keywords:keywords($('inc92CatSuggest')?.value),active:!!$('inc92CatActive')?.checked,updated_by:state.user.id,updated_at:new Date().toISOString()};let cid=id;
      if(id){const r=await sb.from('incident_review_categories_v21092').update(payload).eq('id',id).select().single();if(r.error)return toast(r.error.message);cid=r.data.id}else{payload.created_by=state.user.id;const r=await sb.from('incident_review_categories_v21092').insert(payload).select().single();if(r.error)return toast(r.error.message);cid=r.data.id}
      const a=await sb.from('incident_review_category_documents_v21092').delete().eq('category_id',cid);if(a.error)return toast(a.error.message);const b=await sb.from('incident_review_category_training_v21092').delete().eq('category_id',cid);if(b.error)return toast(b.error.message);
      const docs=[...document.querySelectorAll('.inc92-doc-map-input:checked')].map(x=>({category_id:cid,document_id:x.value,match_mode:'REQUIRED',created_by:state.user.id})),trs=[...document.querySelectorAll('.inc92-training-map-input:checked')].map(x=>({category_id:cid,training_session_id:x.value,match_mode:'REQUIRED',created_by:state.user.id}));if(docs.length){const r=await sb.from('incident_review_category_documents_v21092').insert(docs);if(r.error)return toast(r.error.message)}if(trs.length){const r=await sb.from('incident_review_category_training_v21092').insert(trs);if(r.error)return toast(r.error.message)}await load();categoryList();toast('Incident review category saved.')
    }

    function pdfReport(id){
      const t=S.triggers.find(x=>x.id===id),PDF=window.jspdf?.jsPDF;if(!t||!PDF)return toast('PDF library is not available.');const pdf=new PDF({unit:'mm',format:'a4'}),c=category(t.category_id),deps=(t.department_ids||[]).map(x=>department(x)?.name).filter(Boolean).join(' + ')||'Site-wide',locs=(t.location_ids||[]).map(locationPath).filter(Boolean).join(' · ')||'Not specified';let y=16;pdf.setFontSize(16);pdf.text('Incident Review Report',14,y);y+=8;pdf.setFontSize(9);[['External incident reference',t.external_ref||'Not supplied'],['Incident / near-miss date',fmtDate(t.trigger_date)],['Category',c?.name||'Incident review'],['Scope',deps],['Location(s)',locs],['Safety Tracker status',statusText(t.status)]].forEach(r=>{pdf.setFont(undefined,'bold');pdf.text(r[0]+':',14,y);pdf.setFont(undefined,'normal');const lines=pdf.splitTextToSize(String(r[1]),125);pdf.text(lines,65,y);y+=Math.max(5,lines.length*4)});if(t.short_note){y+=2;pdf.setFont(undefined,'bold');pdf.text('Non-personal trigger note:',14,y);y+=5;pdf.setFont(undefined,'normal');const lines=pdf.splitTextToSize(t.short_note,180);pdf.text(lines,14,y);y+=lines.length*4+3}
      const dr=S.docs.filter(x=>x.trigger_id===id).map(x=>[label(documentBy(x.document_id)),x.match_strength,x.review_status,x.decision?decisionText(x.decision):'—',x.action_status,x.decision_note||x.action_note||'']),tr=S.training.filter(x=>x.trigger_id===id).map(x=>[label(trainingBy(x.training_session_id)),x.match_strength,x.review_status,x.decision?decisionText(x.decision):'—',x.action_status,x.decision_note||x.action_note||'']);pdf.autoTable({startY:y+2,head:[['Controlled document','Match','Review','Decision','Action','Note']],body:dr,styles:{fontSize:7,cellPadding:1.5},headStyles:{fontSize:7}});y=pdf.lastAutoTable.finalY+6;pdf.autoTable({startY:y,head:[['Training / TBT','Match','Review','Decision','Action','Note']],body:tr,styles:{fontSize:7,cellPadding:1.5},headStyles:{fontSize:7}});y=pdf.lastAutoTable.finalY+7;if(y>260){pdf.addPage();y=16}pdf.setFontSize(9);pdf.setFont(undefined,'bold');pdf.text('Closure',14,y);y+=5;pdf.setFont(undefined,'normal');const close=pdf.splitTextToSize(t.closure_note||'Review trigger remains open.',180);pdf.text(close,14,y);y+=close.length*4+5;pdf.setFontSize(8);pdf.setTextColor(90);pdf.text('Safety Tracker stores this as a non-personal H&S review trigger. Casualty, witness, medical and incident investigation details belong in the separate incident system.',14,y,{maxWidth:180});pdf.save(`${(t.external_ref||('incident-review-'+t.trigger_date)).replace(/[^A-Za-z0-9._-]+/g,'-')}-H&S-review.pdf`);
    }

    document.addEventListener('input',e=>{const q=clean(e.target?.value).toLowerCase();if(e.target?.id==='inc92LocSearch')document.querySelectorAll('.inc92-loc-row').forEach(x=>x.hidden=!!q&&!x.dataset.search.includes(q));if(e.target?.id==='inc92DocMapSearch')document.querySelectorAll('.inc92-doc-map').forEach(x=>x.hidden=!!q&&!x.dataset.search.includes(q));if(e.target?.id==='inc92TrainingMapSearch')document.querySelectorAll('.inc92-training-map').forEach(x=>x.hidden=!!q&&!x.dataset.search.includes(q))},true);
    document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;if(b.dataset.inc92Open!==undefined){e.preventDefault();e.stopImmediatePropagation();return openHub()}if(b.dataset.inc92Management!==undefined){e.preventDefault();e.stopImmediatePropagation();return backManagement()}if(b.dataset.inc92New!==undefined){e.preventDefault();e.stopImmediatePropagation();return newTrigger()}if(b.dataset.inc92SaveTrigger!==undefined){e.preventDefault();e.stopImmediatePropagation();return saveTrigger()}if(b.dataset.inc92OpenTrigger){e.preventDefault();e.stopImmediatePropagation();S.selected=b.dataset.inc92OpenTrigger;return render()}if(b.dataset.inc92BackList!==undefined){e.preventDefault();e.stopImmediatePropagation();S.selected=null;return render()}if(b.dataset.inc92ReviewDoc){e.preventDefault();e.stopImmediatePropagation();return reviewModal('DOCUMENT',b.dataset.inc92ReviewDoc)}if(b.dataset.inc92ReviewTraining){e.preventDefault();e.stopImmediatePropagation();return reviewModal('TRAINING',b.dataset.inc92ReviewTraining)}if(b.dataset.inc92SaveDecision){e.preventDefault();e.stopImmediatePropagation();return saveDecision(b.dataset.inc92SaveDecision)}if(b.dataset.inc92Include){e.preventDefault();e.stopImmediatePropagation();return includeDismiss(b.dataset.inc92Include,true)}if(b.dataset.inc92Dismiss){e.preventDefault();e.stopImmediatePropagation();return includeDismiss(b.dataset.inc92Dismiss,false)}if(b.dataset.inc92CompleteAction){e.preventDefault();e.stopImmediatePropagation();return actionModal(b.dataset.inc92CompleteAction)}if(b.dataset.inc92SaveAction){e.preventDefault();e.stopImmediatePropagation();return saveAction(b.dataset.inc92SaveAction)}if(b.dataset.inc92Close){e.preventDefault();e.stopImmediatePropagation();return closeTriggerModal(b.dataset.inc92Close)}if(b.dataset.inc92SaveClose){e.preventDefault();e.stopImmediatePropagation();return saveClose(b.dataset.inc92SaveClose)}if(b.dataset.inc92Report){e.preventDefault();e.stopImmediatePropagation();return pdfReport(b.dataset.inc92Report)}if(b.dataset.inc92OpenDoc){e.preventDefault();e.stopImmediatePropagation();return openDoc(b.dataset.inc92OpenDoc)}if(b.dataset.inc92OpenTraining){e.preventDefault();e.stopImmediatePropagation();return openTraining(b.dataset.inc92OpenTraining)}if(b.dataset.inc92Categories!==undefined){e.preventDefault();e.stopImmediatePropagation();return categoryList()}if(b.dataset.inc92NewCategory!==undefined){e.preventDefault();e.stopImmediatePropagation();return editCategory()}if(b.dataset.inc92EditCategory){e.preventDefault();e.stopImmediatePropagation();return editCategory(b.dataset.inc92EditCategory)}if(b.dataset.inc92SaveCategory!==undefined){e.preventDefault();e.stopImmediatePropagation();return saveCategory(b.dataset.inc92SaveCategory||'')}},true);

    const style=document.createElement('style');style.id='incidentReviewStylesV21092';style.textContent=`#reportsView.incident-review-active-v21092>*{display:none!important}#reportsView.incident-review-active-v21092>#incidentReviewPanelV21092{display:block!important}.incident-review-panel-v21092{display:none}.inc92-head{gap:12px;align-items:flex-start;margin-bottom:14px}.inc92-head h2{margin:8px 0 4px}.inc92-check-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.inc92-scroll{max-height:310px;overflow:auto;border:1px solid var(--border,#475569);border-radius:10px;padding:8px;margin-top:8px}.inc92-compact{padding:7px 9px;margin-top:7px}@media(max-width:700px){.inc92-head{display:block}.inc92-head>.row{margin-top:10px}.inc92-check-list{grid-template-columns:1fr}}`;document.head.appendChild(style);
    new MutationObserver(()=>setTimeout(ensureTile,50)).observe(document.body,{childList:true,subtree:true});
    load().then(ensureTile).catch(e=>console.warn('Incident review',e));[300,900,1800].forEach(ms=>setTimeout(ensureTile,ms));window.addEventListener('pageshow',()=>load().then(ensureTile).catch(()=>{}));
    window.SafetyIncidentReviewV21092={open:openHub,reload:async()=>{await load();render();ensureTile()}};
  }
  boot();
})();
