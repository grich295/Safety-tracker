/* Safety Tracker v2.11.33 - Owner Department + department PPE / First Aid responsibility
   - RA/COSHH/SSW, Policy/Procedure/Information and Toolbox Talk approvals require an Owner Department.
   - Owner Department is separate from the Training/read audience; owner is automatically included unless Everyone is selected.
   - Existing approved controlled documents and Toolbox Talks can change Owner Department without replacing evidence.
   - Admin enables PPE / First Aid per Department during Department setup.
   - Department Manager / H&S Manager assigns the responsible person from that Department.
   - Department First Aid responsible person becomes the monthly default unless a box has a specific override.
   - Department PPE responsible person can see and action open PPE issues for their Department.
*/
'use strict';
(function(){
  if(window.__SAFETY_OWNER_DEPARTMENT_FUNCTIONS_V21133)return;
  window.__SAFETY_OWNER_DEPARTMENT_FUNCTIONS_V21133=true;

  let api,state,sb;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formalTypes=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
  const genericOwnerTypes=new Set(['POLICY','PROCEDURE','OTHER']);
  const documentOwnerTypes=new Set([...formalTypes,...genericOwnerTypes]);

  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isFormal=d=>formalTypes.has(String(d?.doc_type||'').toUpperCase());
  const isOwnerDocument=d=>documentOwnerTypes.has(String(d?.doc_type||'').toUpperCase());
  const isGenericOwnerDocument=d=>genericOwnerTypes.has(String(d?.doc_type||'').toUpperCase());
  const isToolboxTalk=t=>String(t?.source_kind||t?.session_type||'').toUpperCase()==='TOOLBOX_TALK'&&t?.auto_managed!==true;
  const person=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Not assigned'};
  const department=id=>(state.departments||[]).find(x=>x.id===id)||null;
  const departmentName=id=>department(id)?.name||'Not set';
  const activeDepartments=()=> (state.departments||[]).filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activePeople=()=> (state.people||[]).filter(p=>p.active!==false&&p.report_only!==true).sort((a,b)=>String(p.display_name||p.email||'').localeCompare(String(b.display_name||b.email||'')));
  const memberIds=depId=>new Set((state.userDepartments||[]).filter(x=>x.department_id===depId).map(x=>x.user_id));
  const departmentMembers=depId=>{const ids=memberIds(depId);return activePeople().filter(p=>ids.has(p.id));};
  const userDepartmentIds=uid=>(state.userDepartments||[]).filter(x=>x.user_id===uid).map(x=>x.department_id);

  function responsibilityRows(){return state.responsibilities69||[]}
  function hsManagerRow(){return responsibilityRows().find(x=>x.active!==false&&x.responsibility_type==='HS_MANAGER'&&!x.department_id)||null}
  function deptManagerRow(depId){return responsibilityRows().find(x=>x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER'&&x.department_id===depId)||null}
  function canManageDepartmentLocal(depId){
    if(isAdmin())return true;
    const uid=state.user?.id;
    return !!uid&&(hsManagerRow()?.user_id===uid||deptManagerRow(depId)?.user_id===uid);
  }
  function managedDepartments(){return activeDepartments().filter(d=>canManageDepartmentLocal(d.id))}
  function allowedOwnerDepartments(d){
    if(isAdmin()||hsManagerRow()?.user_id===state.user?.id)return activeDepartments();
    const ids=new Set(responsibilityRows().filter(x=>x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER'&&x.user_id===state.user?.id&&x.department_id).map(x=>x.department_id));
    if(d?.owner_department_id)ids.add(d.owner_department_id);
    return activeDepartments().filter(x=>ids.has(x.id));
  }
  function ownerManagerLabel(d){
    if(!d?.owner_department_id)return 'Owner department not set';
    const r=deptManagerRow(d.owner_department_id);
    return r?.user_id?person(r.user_id):'Department Manager not assigned';
  }

  function ownerSelectOptions(d){
    const rows=allowedOwnerDepartments(d);
    const current=d?.owner_department_id||'';
    let html='<option value="">Select owner department</option>';
    html+=rows.map(x=>`<option value="${esc(x.id)}" ${x.id===current?'selected':''}>${esc(x.name)}</option>`).join('');
    if(current&&!rows.some(x=>x.id===current)){
      const dep=department(current);
      if(dep)html+=`<option value="${esc(dep.id)}" selected>${esc(dep.name)}${dep.active===false?' (archived)':''}</option>`;
    }
    return html;
  }

  function currentApprovalDocument(versionId=''){
    const action=$('modalBody')?.querySelector('[data-save-version-approval]');
    const id=versionId||action?.dataset.saveVersionApproval||'';
    const v=(state.versions||[]).find(x=>x.id===id);
    return {v,d:(state.documents||[]).find(x=>x.id===v?.document_id)};
  }

  function ownerSectionHtml(d,context='approval'){
    const manager=ownerManagerLabel(d);
    const generic=isGenericOwnerDocument(d);
    const help=context==='approval'
      ?`The Owner Department owns review, follow-up and compliance responsibility. It is separate from the ${generic?'required-reader':'Training'} audience below.`
      :`Change the department that owns this controlled document. ${generic?'Required readers':'Training'} can still include additional departments or people.`;
    return `<div id="ownerDepartmentSectionV21133" class="section-card owner-department-v21133">
      <div class="row-between"><div><h4>Owner Department</h4><p class="muted">${esc(help)}</p></div><span id="ownerDepartmentStatusV21133" class="badge ${d.owner_department_id?'complete':'due'}">${d.owner_department_id?esc(departmentName(d.owner_department_id)):'Required'}</span></div>
      <div class="form-grid">
        <label>Owner department
          <select id="ownerDepartmentV21133">${ownerSelectOptions(d)}</select>
          <span class="muted">The department's responsible manager owns the review/follow-up.</span>
        </label>
        <div class="hint-box"><strong>Current responsible manager:</strong> <span id="ownerManagerV21133">${esc(manager)}</span><br><span class="muted">The Owner Department is automatically added to the ${generic?'reader':'Training'} audience unless Everyone is selected.</span></div>
      </div>
      <div id="ownerPermissionV21133" class="message" hidden></div>
    </div>`;
  }

  function ensureOwnerInAudience(ownerId){
    if(!ownerId)return;
    if($('approvalAssignEveryone')?.checked)return;
    const box=[...document.querySelectorAll('.approval-department-choice')].find(x=>x.value===ownerId);
    if(box&&!box.checked){
      box.checked=true;
      box.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  function updateOwnerUi(d){
    const sel=$('ownerDepartmentV21133');if(!sel)return;
    const ownerId=sel.value||'';
    const status=$('ownerDepartmentStatusV21133');
    if(status){status.textContent=ownerId?departmentName(ownerId):'Required';status.className=`badge ${ownerId?'complete':'due'}`;}
    const mgr=$('ownerManagerV21133');
    if(mgr){const r=deptManagerRow(ownerId);mgr.textContent=ownerId?(r?.user_id?person(r.user_id):'Department Manager not assigned'):'Owner department not set';}
    ensureOwnerInAudience(ownerId);
    applyOwnerApprovalPermission(d);
  }

  function approvalScopePresent(){
    return !!($('approvalAssignEveryone')?.checked||document.querySelector('.approval-department-choice:checked')||document.querySelector('.approval-person-choice:checked'));
  }

  function applyOwnerApprovalPermission(d){
    const action=$('modalBody')?.querySelector('[data-save-version-approval]');
    if(!action||!d||!isOwnerDocument(d))return;
    const decision=$('approvalDecision')?.value||'APPROVED';
    if(decision!=='APPROVED')return;
    const ownerId=$('ownerDepartmentV21133')?.value||d.owner_department_id||'';
    const note=$('ownerPermissionV21133');
    if(!ownerId){
      action.disabled=true;action.title='Choose the Owner Department before approval.';
      if(note){note.hidden=false;note.className='danger-note';note.innerHTML='<strong>Owner Department required.</strong> Choose the department responsible for this document before approval.';}
      return;
    }
    ensureOwnerInAudience(ownerId);
    if(!approvalScopePresent()){
      action.disabled=true;action.title=`Set the ${isGenericOwnerDocument(d)?'reader':'Training'} scope before approval.`;
      return;
    }
    if(isAdmin()){
      action.disabled=false;action.removeAttribute('disabled');action.title='';
      if(note){note.hidden=false;note.className='success-note';note.innerHTML=`<strong>Owner:</strong> ${esc(departmentName(ownerId))}. Any Admin may approve; the department manager owns follow-up.`;}
      return;
    }
    const uid=state.user?.id;
    const hs=hsManagerRow()?.user_id===uid;
    const own=deptManagerRow(ownerId)?.user_id===uid;
    action.disabled=!(hs||own);
    action.title=action.disabled?'Only the Owner Department Manager, H&S Manager or an Admin can approve this document.':'';
    if(note){
      note.hidden=false;
      note.className=action.disabled?'danger-note':'success-note';
      note.innerHTML=action.disabled
        ?`<strong>${esc(departmentName(ownerId))} owner:</strong> ${esc(ownerManagerLabel({owner_department_id:ownerId}))}. Approval must be completed by that manager, the H&S Manager or an Admin.`
        :`<strong>Owner:</strong> ${esc(departmentName(ownerId))}. You are authorised to complete this approval.`;
    }
  }

  function decorateApprovalOwner(versionId){
    const body=$('modalBody'),action=body?.querySelector('[data-save-version-approval]');
    if(!body||!action)return;
    const {d}=currentApprovalDocument(versionId);if(!d||!isOwnerDocument(d))return;
    if(!$('ownerDepartmentSectionV21133')){
      const node=document.createElement('div');node.innerHTML=ownerSectionHtml(d,'approval');
      const section=node.firstElementChild;
      const training=$('approvalTrainingSchedule')||$('approvalAudienceSection')||[...body.querySelectorAll('.actions')].pop();
      if(training)training.insertAdjacentElement('beforebegin',section);else body.appendChild(section);
      $('ownerDepartmentV21133')?.addEventListener('change',()=>updateOwnerUi(d));
      $('approvalDecision')?.addEventListener('change',()=>setTimeout(()=>applyOwnerApprovalPermission(d),0));
    }
    updateOwnerUi(d);
    [80,220,500].forEach(ms=>setTimeout(()=>{ensureOwnerInAudience($('ownerDepartmentV21133')?.value||d.owner_department_id);applyOwnerApprovalPermission(d)},ms));
  }

  function decorateTrainingOwner(docId){
    const d=(state.documents||[]).find(x=>x.id===docId),body=$('modalBody');
    if(!d||!isFormal(d)||!body||!body.querySelector('[data-save-doc-audience]'))return;
    if(!$('ownerDepartmentSectionV21133')){
      const node=document.createElement('div');node.innerHTML=ownerSectionHtml(d,'training');
      const section=node.firstElementChild;
      const training=$('approvalTrainingSchedule')||$('approvalAudienceSection')||[...body.querySelectorAll('.actions')].pop();
      if(training)training.insertAdjacentElement('beforebegin',section);else body.appendChild(section);
      $('ownerDepartmentV21133')?.addEventListener('change',()=>updateOwnerUi(d));
    }
    updateOwnerUi(d);
  }

  async function persistOwner(docId,allowUnchanged=true){
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d||!isOwnerDocument(d))return true;
    const ownerId=$('ownerDepartmentV21133')?.value||d.owner_department_id||'';
    if(!ownerId){api.toast?.('Choose the Owner Department first.');return false;}
    ensureOwnerInAudience(ownerId);
    if(allowUnchanged&&d.owner_department_id===ownerId)return true;
    const due=Math.max(1,Math.min(365,Number($('approvalAssignDueDays')?.value||$('v21119CtrlDueDays')?.value||14)));
    const r=await sb.rpc('set_document_owner_department_v21133',{
      p_document_id:docId,
      p_department_id:ownerId,
      p_add_to_training_audience:true,
      p_due_days:due
    });
    if(r.error){api.toast?.(r.error.message||'Could not save Owner Department.');return false;}
    d.owner_department_id=ownerId;
    return true;
  }

  function decorateDocumentOwners(){
    const root=$('documentsList');if(!root)return;
    for(const card of root.querySelectorAll('.document-status-card')){
      const detail=card.querySelector('[data-doc-details]');
      const d=(state.documents||[]).find(x=>x.id===detail?.dataset.docDetails);if(!d||!isOwnerDocument(d))continue;
      const meta=card.querySelector('.meta');if(!meta)continue;
      let badge=meta.querySelector('.owner-department-badge-v21133');
      if(!badge){badge=document.createElement('span');badge.className='badge owner-department-badge-v21133';meta.appendChild(badge)}
      badge.className=`badge owner-department-badge-v21133 ${d.owner_department_id?'complete':'due'}`;
      badge.textContent=d.owner_department_id?`Owner: ${departmentName(d.owner_department_id)}`:'Owner department required';
      badge.title=d.owner_department_id?`Responsible manager: ${ownerManagerLabel(d)}`:'Open Assign to / approval and set the Owner Department';
    }
  }

  function decorateDocumentDetails(docId){
    const d=(state.documents||[]).find(x=>x.id===docId),body=$('modalBody');if(!d||!isOwnerDocument(d)||!body)return;
    if(body.querySelector('.owner-detail-v21133'))return;
    const box=document.createElement('div');box.className=`${d.owner_department_id?'success-note':'danger-note'} owner-detail-v21133`;
    box.innerHTML=d.owner_department_id
      ?`<strong>Owner Department:</strong> ${esc(departmentName(d.owner_department_id))}<br><span class="muted">Responsible manager: ${esc(ownerManagerLabel(d))}</span>`
      :'<strong>Owner Department not set.</strong> Set the department responsible for review and follow-up.';
    const first=body.firstElementChild; if(first)first.insertAdjacentElement('afterend',box);else body.prepend(box);
    const actions=[...body.querySelectorAll('.actions')].pop();
    if(actions&&!actions.querySelector('[data-v21133-edit-doc-owner]')){
      const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21133EditDocOwner=docId;b.textContent='Owner Department';actions.prepend(b);
    }
  }

  function showDocumentOwnerEditor(docId){
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d||!isOwnerDocument(d)||!isManager())return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');if(title)title.textContent='Owner Department';
    if(body)body.innerHTML=`<div class="section-card"><h3>${esc(d.reference?d.reference+' - ':'')}${esc(d.title||'Controlled document')}</h3><p class="muted">Owner Department controls review/follow-up responsibility. It does not remove any additional Training or reader audiences.</p></div>${ownerSectionHtml(d,'settings')}<div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-v21133-save-doc-owner="${esc(docId)}">Save owner</button></div>`;
    if(modal&&!modal.open)modal.showModal();
    $('ownerDepartmentV21133')?.addEventListener('change',()=>updateOwnerUi(d));updateOwnerUi(d);
  }

  async function saveDocumentOwnerEditor(docId,button){
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const ok=await persistOwner(docId,false);
    if(!ok){button.disabled=false;button.textContent=old;return;}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Owner Department updated. Existing Training/read audiences were retained and the owner was included where required.');
  }

  function trainingOwnerManagerLabel(t){
    if(!t?.owner_department_id)return 'Owner department not set';
    const r=deptManagerRow(t.owner_department_id);
    return r?.user_id?person(r.user_id):'Department Manager not assigned';
  }

  function trainingOwnerOptions(t){
    const rows=allowedOwnerDepartments(t),current=t?.owner_department_id||'';
    let html='<option value="">Select owner department</option>';
    html+=rows.map(x=>`<option value="${esc(x.id)}" ${x.id===current?'selected':''}>${esc(x.name)}</option>`).join('');
    if(current&&!rows.some(x=>x.id===current)){const d=department(current);if(d)html+=`<option value="${esc(d.id)}" selected>${esc(d.name)}${d.active===false?' (archived)':''}</option>`}
    return html;
  }

  function toolboxOwnerSectionHtml(t,context='approval'){
    const help=context==='approval'?'The Owner Department owns this Toolbox Talk review, follow-up and training compliance.':'Change the Department that owns this Toolbox Talk. The training audience can still include other departments or people.';
    return `<div id="tbtOwnerDepartmentSectionV21133" class="section-card owner-department-v21133"><div class="row-between"><div><h4>Owner Department</h4><p class="muted">${esc(help)}</p></div><span id="tbtOwnerDepartmentStatusV21133" class="badge ${t.owner_department_id?'complete':'due'}">${t.owner_department_id?esc(departmentName(t.owner_department_id)):'Required'}</span></div><div class="form-grid"><label>Owner department<select id="tbtOwnerDepartmentV21133">${trainingOwnerOptions(t)}</select><span class="muted">The Department Manager owns review/follow-up.</span></label><div class="hint-box"><strong>Current responsible manager:</strong> <span id="tbtOwnerManagerV21133">${esc(trainingOwnerManagerLabel(t))}</span><br><span class="muted">The Owner Department is automatically included in this Toolbox Talk audience unless Everyone is selected.</span></div></div><div id="tbtOwnerPermissionV21133" class="message" hidden></div></div>`;
  }

  function ensureTbtOwnerInAudience(ownerId,prefix='tbtApprovalAudience'){
    if(!ownerId)return;
    if($(prefix+'AssignEveryone')?.checked)return;
    const box=[...document.querySelectorAll('.'+prefix+'-department-choice')].find(x=>x.value===ownerId);
    if(box&&!box.checked){box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}))}
  }

  function tbtAudiencePresent(prefix='tbtApprovalAudience'){
    return !!($(prefix+'AssignEveryone')?.checked||document.querySelector('.'+prefix+'-department-choice:checked')||document.querySelector('.'+prefix+'-person-choice:checked'));
  }

  function applyTbtOwnerPermission(t,prefix='tbtApprovalAudience'){
    const action=$('modalBody')?.querySelector('[data-confirm-training-approval]');
    if(!action||!t||!isToolboxTalk(t))return;
    const ownerId=$('tbtOwnerDepartmentV21133')?.value||t.owner_department_id||'',note=$('tbtOwnerPermissionV21133');
    if(!ownerId){action.disabled=true;action.title='Choose the Owner Department before approval.';if(note){note.hidden=false;note.className='danger-note';note.innerHTML='<strong>Owner Department required.</strong> Choose who owns this Toolbox Talk.'}return}
    ensureTbtOwnerInAudience(ownerId,prefix);
    if(!tbtAudiencePresent(prefix)){action.disabled=true;action.title='Set the Toolbox Talk audience before approval.';return}
    if(isAdmin()){action.disabled=false;action.removeAttribute('disabled');action.title='';if(note){note.hidden=false;note.className='success-note';note.innerHTML=`<strong>Owner:</strong> ${esc(departmentName(ownerId))}. Any Admin may approve; the department manager owns follow-up.`}return}
    const uid=state.user?.id,ok=hsManagerRow()?.user_id===uid||deptManagerRow(ownerId)?.user_id===uid;
    action.disabled=!ok;action.title=ok?'':'Only the Owner Department Manager, H&S Manager or an Admin can approve this Toolbox Talk.';
    if(note){note.hidden=false;note.className=ok?'success-note':'danger-note';note.innerHTML=ok?`<strong>Owner:</strong> ${esc(departmentName(ownerId))}. You are authorised to approve this Toolbox Talk.`:`<strong>${esc(departmentName(ownerId))} owner:</strong> ${esc(trainingOwnerManagerLabel({owner_department_id:ownerId}))}. Approval must be completed by that manager, the H&S Manager or an Admin.`}
  }

  function updateTbtOwnerUi(t,prefix='tbtApprovalAudience'){
    const sel=$('tbtOwnerDepartmentV21133');if(!sel)return;const ownerId=sel.value||'';
    const st=$('tbtOwnerDepartmentStatusV21133');if(st){st.textContent=ownerId?departmentName(ownerId):'Required';st.className=`badge ${ownerId?'complete':'due'}`}
    const mgr=$('tbtOwnerManagerV21133');if(mgr){const r=deptManagerRow(ownerId);mgr.textContent=ownerId?(r?.user_id?person(r.user_id):'Department Manager not assigned'):'Owner department not set'}
    ensureTbtOwnerInAudience(ownerId,prefix);applyTbtOwnerPermission(t,prefix);
  }

  function decorateTrainingApprovalOwner(trainingId){
    const t=(state.training||[]).find(x=>x.id===trainingId),body=$('modalBody');if(!t||!isToolboxTalk(t)||!body||!body.querySelector('[data-confirm-training-approval]'))return;
    if(!$('tbtOwnerDepartmentSectionV21133')){const w=document.createElement('div');w.innerHTML=toolboxOwnerSectionHtml(t,'approval');const section=w.firstElementChild;const aud=$('tbtApprovalAudienceAudienceSection')||[...body.querySelectorAll('.actions')].pop();if(aud)aud.insertAdjacentElement('beforebegin',section);else body.appendChild(section);$('tbtOwnerDepartmentV21133')?.addEventListener('change',()=>updateTbtOwnerUi(t,'tbtApprovalAudience'))}
    updateTbtOwnerUi(t,'tbtApprovalAudience');[80,220,500].forEach(ms=>setTimeout(()=>updateTbtOwnerUi(t,'tbtApprovalAudience'),ms));
  }

  function decorateTrainingAudienceOwner(trainingId){
    const t=(state.training||[]).find(x=>x.id===trainingId),body=$('modalBody');if(!t||!isToolboxTalk(t)||!body||!body.querySelector('[data-save-training-audience]'))return;
    if(!$('tbtOwnerDepartmentSectionV21133')){const w=document.createElement('div');w.innerHTML=toolboxOwnerSectionHtml(t,'settings');const section=w.firstElementChild;const aud=$('editTrainAudienceAudienceSection')||[...body.querySelectorAll('.actions')].pop();if(aud)aud.insertAdjacentElement('beforebegin',section);else body.appendChild(section);$('tbtOwnerDepartmentV21133')?.addEventListener('change',()=>{const owner=$('tbtOwnerDepartmentV21133')?.value||'';const st=$('tbtOwnerDepartmentStatusV21133');if(st){st.textContent=owner?departmentName(owner):'Required';st.className=`badge ${owner?'complete':'due'}`}ensureTbtOwnerInAudience(owner,'editTrainAudience')})}
    ensureTbtOwnerInAudience($('tbtOwnerDepartmentV21133')?.value||t.owner_department_id,'editTrainAudience');
  }

  async function persistTrainingOwner(trainingId,prefix='tbtApprovalAudience',unchanged=true){
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!t||!isToolboxTalk(t))return true;
    const ownerId=$('tbtOwnerDepartmentV21133')?.value||t.owner_department_id||'';if(!ownerId){api.toast?.('Choose the Owner Department first.');return false}
    ensureTbtOwnerInAudience(ownerId,prefix);if(unchanged&&t.owner_department_id===ownerId)return true;
    const due=Math.max(1,Math.min(365,Number($(prefix+'AssignDueDays')?.value||14)));
    const r=await sb.rpc('set_training_owner_department_v21133',{p_training_session_id:trainingId,p_department_id:ownerId,p_add_to_audience:true,p_due_days:due});
    if(r.error){api.toast?.(r.error.message||'Could not save Toolbox Talk Owner Department.');return false}
    t.owner_department_id=ownerId;return true;
  }

  function decorateToolboxOwners(){
    const root=$('documentsList');if(!root)return;
    for(const card of root.querySelectorAll('.training-catalogue-card')){const b=card.querySelector('[data-view-training]'),t=(state.training||[]).find(x=>x.id===b?.dataset.viewTraining);if(!t||!isToolboxTalk(t))continue;const meta=card.querySelector('.meta');if(!meta)continue;let badge=meta.querySelector('.tbt-owner-badge-v21133');if(!badge){badge=document.createElement('span');badge.className='badge tbt-owner-badge-v21133';meta.appendChild(badge)}badge.className=`badge tbt-owner-badge-v21133 ${t.owner_department_id?'complete':'due'}`;badge.textContent=t.owner_department_id?`Owner: ${departmentName(t.owner_department_id)}`:'Owner department required'}
  }

  function decorateTrainingDetailsOwner(trainingId){
    const t=(state.training||[]).find(x=>x.id===trainingId),body=$('modalBody');if(!t||!isToolboxTalk(t)||!body||body.querySelector('.tbt-owner-detail-v21133'))return;
    const box=document.createElement('div');box.className=`${t.owner_department_id?'success-note':'danger-note'} tbt-owner-detail-v21133`;box.innerHTML=t.owner_department_id?`<strong>Owner Department:</strong> ${esc(departmentName(t.owner_department_id))}<br><span class="muted">Responsible manager: ${esc(trainingOwnerManagerLabel(t))}</span>`:'<strong>Owner Department not set.</strong> Use Assign to to set the Toolbox Talk owner.';const first=body.firstElementChild;if(first)first.insertAdjacentElement('afterend',box);else body.prepend(box);
  }

  function safetyFunctionSummary(d){
    const ppe=d.ppe_enabled?`PPE: ${d.ppe_responsible_user_id?person(d.ppe_responsible_user_id):'responsible person not assigned'}`:'PPE: off';
    const fa=d.first_aid_enabled?`First Aid: ${d.first_aid_responsible_user_id?person(d.first_aid_responsible_user_id):'responsible person not assigned'}`:'First Aid: off';
    return {ppe,fa};
  }

  function decorateDepartmentCards(){
    const root=$('departmentList');if(!root)return;
    for(const card of root.querySelectorAll('.item-card')){
      const edit=card.querySelector('[data-edit-department]');const id=edit?.dataset.editDepartment;if(!id)continue;
      const d=department(id);if(!d)continue;
      const meta=card.querySelector('.meta');
      if(meta&&!meta.querySelector('.dept-functions-v21133')){
        const wrap=document.createElement('span');wrap.className='dept-functions-v21133';
        const s=safetyFunctionSummary(d);
        wrap.innerHTML=`<span class="badge ${d.ppe_enabled?'complete':'neutral'}">${esc(s.ppe)}</span> <span class="badge ${d.first_aid_enabled?'complete':'neutral'}">${esc(s.fa)}</span>`;
        meta.appendChild(wrap);
      }
      const row=edit.closest('.row');
      if(row&&!row.querySelector('[data-dept-safety-v21133]')){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.deptSafetyV21133=id;b.textContent='Safety functions';row.prepend(b);
      }
    }
  }

  function decorateDepartmentEditor(id=''){
    const body=$('modalBody');if(!body||body.querySelector('#departmentFunctionsV21133'))return;
    const d=id?department(id):null;
    const box=document.createElement('div');box.id='departmentFunctionsV21133';box.className='section-card';
    box.innerHTML=`<h4>Department safety functions</h4><p class="muted">Choose which recurring functions belong to this Department. Once staff are assigned, the responsible Department Manager can choose the responsible person from within the Department.</p>
      <label class="check-row"><input id="departmentPpeEnabledV21133" type="checkbox" ${d?.ppe_enabled?'checked':''}> <strong>PPE responsibility / monthly PPE checks</strong></label>
      <label class="check-row"><input id="departmentFirstAidEnabledV21133" type="checkbox" ${d?.first_aid_enabled?'checked':''}> <strong>First Aid responsibility / monthly first-aid checks</strong></label>
      <div class="hint-box">Admin enables or disables the functions here. The Department Manager then assigns who is responsible from members of this Department.</div>`;
    const actions=[...body.querySelectorAll('.actions')].pop();if(actions)actions.insertAdjacentElement('beforebegin',box);else body.appendChild(box);
  }

  function responsibleOptions(depId,selected=''){
    const rows=departmentMembers(depId);
    return `<option value="">Not assigned</option>`+rows.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.display_name||p.email)}</option>`).join('');
  }

  function openDepartmentSafety(depId,focus=''){
    const d=department(depId);if(!d||!canManageDepartmentLocal(depId))return api.toast?.('You are not authorised to manage this Department.');
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent=`Department safety · ${d.name}`;
    const admin=isAdmin();
    if(body)body.innerHTML=`<div class="section-card"><h3>${esc(d.name)}</h3><p class="muted">Admin chooses which functions the Department uses. The responsible Department Manager / H&S Manager chooses the responsible person from current Department members.</p></div>
      <div class="form-grid">
        <label class="check-row"><input id="deptPpeEnabledV21133" type="checkbox" ${d.ppe_enabled?'checked':''} ${admin?'':'disabled'}> <strong>PPE function enabled</strong></label>
        <label>PPE responsible person<select id="deptPpePersonV21133" ${d.ppe_enabled?'':'disabled'}>${responsibleOptions(depId,d.ppe_responsible_user_id||'')}</select><span class="muted">Receives Department PPE responsibility and can action PPE issues for Department staff.</span></label>
        <label class="check-row"><input id="deptFaEnabledV21133" type="checkbox" ${d.first_aid_enabled?'checked':''} ${admin?'':'disabled'}> <strong>First Aid function enabled</strong></label>
        <label>First Aid responsible person<select id="deptFaPersonV21133" ${d.first_aid_enabled?'':'disabled'}>${responsibleOptions(depId,d.first_aid_responsible_user_id||'')}</select><span class="muted">Becomes the monthly default checker unless a First Aid box has its own override.</span></label>
      </div>
      ${admin?'':'<div class="hint-box">Only Admin can turn PPE / First Aid functions on or off. You can assign or change the responsible person for functions already enabled.</div>'}
      <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-save-dept-safety-v21133="${esc(depId)}">Save responsibility</button></div>`;
    if(modal&&!modal.open)modal.showModal();
    const sync=()=>{
      const ppe=!!$('deptPpeEnabledV21133')?.checked,fa=!!$('deptFaEnabledV21133')?.checked;
      if($('deptPpePersonV21133'))$('deptPpePersonV21133').disabled=!ppe;
      if($('deptFaPersonV21133'))$('deptFaPersonV21133').disabled=!fa;
    };
    $('deptPpeEnabledV21133')?.addEventListener('change',sync);$('deptFaEnabledV21133')?.addEventListener('change',sync);sync();
    if(focus==='PPE')$('deptPpePersonV21133')?.focus();if(focus==='FIRST_AID')$('deptFaPersonV21133')?.focus();
  }

  async function saveDepartmentSafety(depId,button){
    const d=department(depId);if(!d)return;
    const payload={
      p_department_id:depId,
      p_ppe_enabled:!!$('deptPpeEnabledV21133')?.checked,
      p_first_aid_enabled:!!$('deptFaEnabledV21133')?.checked,
      p_ppe_responsible_user_id:$('deptPpePersonV21133')?.value||null,
      p_first_aid_responsible_user_id:$('deptFaPersonV21133')?.value||null
    };
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const r=await sb.rpc('set_department_safety_functions_v21133',payload);
    if(r.error){button.disabled=false;button.textContent=old;return api.toast?.(r.error.message||'Could not save Department safety responsibility.');}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Department safety functions and responsibility updated.');
  }

  function functionCardsHtml(kind){
    const rows=managedDepartments();if(!rows.length)return '';
    return `<div class="section-card dept-function-manager-v21133"><div class="row-between"><div><h3>Department ${kind==='PPE'?'PPE':'First Aid'} responsibility</h3><p class="muted">Set the responsible person for Departments you manage. Admin controls whether the function is enabled.</p></div></div><div class="card-list">${rows.map(d=>{
      const enabled=kind==='PPE'?d.ppe_enabled:d.first_aid_enabled;
      const uid=kind==='PPE'?d.ppe_responsible_user_id:d.first_aid_responsible_user_id;
      return `<div class="item-card compact traffic-${enabled?(uid?'green':'amber'):'neutral'}"><div class="row-between"><div><strong>${esc(d.name)}</strong><div class="meta"><span class="badge ${enabled?'complete':'neutral'}">${enabled?'Enabled':'Not enabled'}</span><span>${enabled?(uid?`Responsible: ${esc(person(uid))}`:'Responsible person not assigned'):'Admin can enable this function'}</span></div></div><button type="button" class="secondary" data-dept-safety-v21133="${esc(d.id)}" data-dept-safety-focus="${kind}">${enabled?'Manage':'View setup'}</button></div></div>`;
    }).join('')}</div></div>`;
  }

  function responsiblePpeDepartments(){return activeDepartments().filter(d=>d.ppe_enabled&&d.ppe_responsible_user_id===state.user?.id)}
  function responsibleFaDepartments(){return activeDepartments().filter(d=>d.first_aid_enabled&&d.first_aid_responsible_user_id===state.user?.id)}
  function userInDepartments(uid,depIds){const ids=userDepartmentIds(uid);return ids.some(x=>depIds.has(x))}

  function openPpeIssueRowsForResponsible(){
    const deps=responsiblePpeDepartments();if(!deps.length)return [];
    const depIds=new Set(deps.map(d=>d.id));
    return (state.ppeCheckItems||[]).filter(i=>['MISSING','REPLACEMENT_REQUIRED'].includes(i.result)&&!['RESOLVED','NOT_REQUIRED'].includes(i.action_status||'OPEN')).map(i=>{
      const c=(state.ppeChecks||[]).find(x=>x.id===i.check_id);if(!c||!userInDepartments(c.user_id,depIds))return null;
      return {i,c,employee:person(c.user_id)};
    }).filter(Boolean);
  }

  function decoratePpeResponsibilities(){
    const view=$('ppeView');if(!view)return;
    let box=$('ppeDepartmentFunctionsV21133');if(box)box.remove();
    const managerHtml=isManager()?functionCardsHtml('PPE'):'';
    const owned=responsiblePpeDepartments(),issues=openPpeIssueRowsForResponsible();
    const responsibleHtml=owned.length?`<div class="section-card traffic-${issues.length?'amber':'green'}"><h3>Your Department PPE responsibility</h3><p class="muted">You are the PPE responsible person for ${esc(owned.map(d=>d.name).join(', '))}.</p><div class="card-list">${issues.length?issues.map(x=>`<div class="item-card compact traffic-red"><div class="row-between"><div><strong>${esc(x.employee)} · ${esc(x.i.ppe_name_snapshot||'PPE')}</strong><div class="meta"><span>${esc(x.i.result)}</span><span>${esc(x.i.comment||'No comment')}</span><span>${esc(x.i.action_status||'OPEN')}</span></div></div><button type="button" class="primary" data-v21133-ppe-issue="${esc(x.i.id)}">Update action</button></div></div>`).join(''):'<div class="success-note">No open PPE replacement/order issues for your Department.</div>'}</div></div>`:'';
    if(!managerHtml&&!responsibleHtml)return;
    box=document.createElement('div');box.id='ppeDepartmentFunctionsV21133';box.innerHTML=managerHtml+responsibleHtml;
    const list=$('ppeList');if(list)list.insertAdjacentElement('afterend',box);else view.appendChild(box);
  }

  function decorateFirstAidResponsibilities(){
    const view=$('firstAidView');if(!view)return;
    let box=$('firstAidDepartmentFunctionsV21133');if(box)box.remove();
    const managerHtml=isManager()?functionCardsHtml('FIRST_AID'):'';
    const owned=responsibleFaDepartments();
    const mine=(state.firstAidChecks||[]).filter(x=>x.assigned_user_id===state.user?.id&&!x.submitted_at);
    const responsibleHtml=owned.length?`<div class="section-card traffic-${mine.length?'amber':'green'}"><h3>Your Department First Aid responsibility</h3><p>You are the default First Aid checker for ${esc(owned.map(d=>d.name).join(', '))}. A box-specific override still takes priority where one is set.</p><div class="meta"><span class="badge ${mine.length?'due':'complete'}">${mine.length?mine.length+' check'+(mine.length===1?'':'s')+' outstanding':'No outstanding checks'}</span></div></div>`:'';
    if(!managerHtml&&!responsibleHtml)return;
    box=document.createElement('div');box.id='firstAidDepartmentFunctionsV21133';box.innerHTML=managerHtml+responsibleHtml;
    const list=$('firstAidList');if(list)list.insertAdjacentElement('afterend',box);else view.appendChild(box);
  }

  function showResponsiblePpeAction(id){
    const item=(state.ppeCheckItems||[]).find(x=>x.id===id),check=(state.ppeChecks||[]).find(x=>x.id===item?.check_id);if(!item||!check)return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');if(title)title.textContent='Department PPE action';
    if(body)body.innerHTML=`<p><strong>${esc(person(check.user_id))} · ${esc(item.ppe_name_snapshot||'PPE')}</strong></p><p>${esc(item.result)}${item.comment?` · ${esc(item.comment)}`:''}</p><div class="form-grid"><label>Action status<select id="v21133PpeActionStatus"><option value="OPEN" ${(item.action_status||'OPEN')==='OPEN'?'selected':''}>Open</option><option value="ORDERED" ${item.action_status==='ORDERED'?'selected':''}>Ordered</option><option value="RESOLVED" ${item.action_status==='RESOLVED'?'selected':''}>Resolved</option><option value="NOT_REQUIRED" ${item.action_status==='NOT_REQUIRED'?'selected':''}>Not required</option></select></label><label class="full">Action note<textarea id="v21133PpeActionNote">${esc(item.admin_note||'')}</textarea></label></div><div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-v21133-save-ppe-issue="${esc(id)}">Save action</button></div>`;
    if(modal&&!modal.open)modal.showModal();
  }

  async function saveResponsiblePpeAction(id,button){
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const r=await sb.rpc('resolve_ppe_check_item_department_v21133',{
      p_check_item_id:id,
      p_action_status:$('v21133PpeActionStatus')?.value||'OPEN',
      p_admin_note:clean($('v21133PpeActionNote')?.value)||null
    });
    if(r.error){button.disabled=false;button.textContent=old;return api.toast?.(r.error.message||'Could not update PPE action.');}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Department PPE action updated.');
  }

  function installFunctionWrappers(){
    const oldShowApproval=window.showVersionApproval;
    if(typeof oldShowApproval==='function')window.showVersionApproval=function(versionId){
      const out=oldShowApproval.apply(this,arguments);
      [0,70,180,420].forEach(ms=>setTimeout(()=>decorateApprovalOwner(versionId),ms));
      return out;
    };

    const oldSaveApproval=window.saveVersionApproval;
    if(typeof oldSaveApproval==='function')window.saveVersionApproval=async function(versionId){
      const {d}=currentApprovalDocument(versionId);
      if(d&&isOwnerDocument(d)&&($('approvalDecision')?.value||'APPROVED')==='APPROVED'){
        const ok=await persistOwner(d.id,false);if(!ok)return;
      }
      return oldSaveApproval.apply(this,arguments);
    };

    const oldShowAudience=window.showDocumentAudience;
    if(typeof oldShowAudience==='function')window.showDocumentAudience=function(docId){
      const out=oldShowAudience.apply(this,arguments);
      [0,70,180].forEach(ms=>setTimeout(()=>decorateTrainingOwner(docId),ms));
      return out;
    };

    const oldSaveAudience=window.saveDocumentAudience;
    if(typeof oldSaveAudience==='function')window.saveDocumentAudience=async function(docId){
      const d=(state.documents||[]).find(x=>x.id===docId);
      if(d&&isFormal(d)){
        const ok=await persistOwner(docId,true);if(!ok)return;
      }
      return oldSaveAudience.apply(this,arguments);
    };

    const oldShowTrainingApproval=window.showTrainingApproval;
    if(typeof oldShowTrainingApproval==='function')window.showTrainingApproval=function(trainingId){const out=oldShowTrainingApproval.apply(this,arguments);[0,70,180,420].forEach(ms=>setTimeout(()=>decorateTrainingApprovalOwner(trainingId),ms));return out};

    const oldConfirmTrainingApproval=window.confirmTrainingApproval;
    if(typeof oldConfirmTrainingApproval==='function')window.confirmTrainingApproval=async function(trainingId){const t=(state.training||[]).find(x=>x.id===trainingId);if(t&&isToolboxTalk(t)){const ok=await persistTrainingOwner(trainingId,'tbtApprovalAudience',false);if(!ok)return}return oldConfirmTrainingApproval.apply(this,arguments)};

    const oldShowAssignTraining=window.showAssignTraining;
    if(typeof oldShowAssignTraining==='function')window.showAssignTraining=function(trainingId){const out=oldShowAssignTraining.apply(this,arguments);[0,70,180].forEach(ms=>setTimeout(()=>decorateTrainingAudienceOwner(trainingId),ms));return out};

    const oldSaveTrainingAudience=window.saveTrainingAudience;
    if(typeof oldSaveTrainingAudience==='function')window.saveTrainingAudience=async function(trainingId){const t=(state.training||[]).find(x=>x.id===trainingId);if(t&&isToolboxTalk(t)){const ok=await persistTrainingOwner(trainingId,'editTrainAudience',true);if(!ok)return}return oldSaveTrainingAudience.apply(this,arguments)};

    const oldTrainingDetails=window.showTrainingDetails;
    if(typeof oldTrainingDetails==='function')window.showTrainingDetails=function(trainingId){const out=oldTrainingDetails.apply(this,arguments);setTimeout(()=>decorateTrainingDetailsOwner(trainingId),70);return out};

    const oldShowDepartment=window.showDepartmentEditor;
    if(typeof oldShowDepartment==='function')window.showDepartmentEditor=function(id=''){
      const out=oldShowDepartment.apply(this,arguments);setTimeout(()=>decorateDepartmentEditor(id),0);return out;
    };

    const oldSaveDepartment=window.saveDepartment;
    if(typeof oldSaveDepartment==='function')window.saveDepartment=async function(id=''){
      if(!isAdmin())return oldSaveDepartment.apply(this,arguments);
      const name=clean($('departmentName')?.value);if(!name)return api.toast?.('Department name is required.');
      const ppe=!!$('departmentPpeEnabledV21133')?.checked,fa=!!$('departmentFirstAidEnabledV21133')?.checked;
      const r=await sb.rpc('save_department_v230',{p_department_id:id||null,p_name:name});if(r.error)return api.toast?.(r.error.message);
      const depId=id||r.data;
      const existing=department(depId);
      const sr=await sb.rpc('set_department_safety_functions_v21133',{
        p_department_id:depId,
        p_ppe_enabled:ppe,
        p_first_aid_enabled:fa,
        p_ppe_responsible_user_id:ppe?(existing?.ppe_responsible_user_id||null):null,
        p_first_aid_responsible_user_id:fa?(existing?.first_aid_responsible_user_id||null):null
      });
      if(sr.error)return api.toast?.(`Department saved, but safety functions were not saved: ${sr.error.message}`);
      try{$('modal')?.close()}catch(_e){}
      await api.refresh?.(id?'Department updated.':'Department created. PPE / First Aid functions saved.');
    };

    const oldRenderAdmin=window.renderAdmin;
    if(typeof oldRenderAdmin==='function')window.renderAdmin=async function(){const out=await oldRenderAdmin.apply(this,arguments);setTimeout(decorateDepartmentCards,0);return out};

    const oldRenderDocuments=window.renderDocuments;
    if(typeof oldRenderDocuments==='function')window.renderDocuments=function(){const out=oldRenderDocuments.apply(this,arguments);setTimeout(()=>{decorateDocumentOwners();decorateToolboxOwners()},0);return out};

    const oldRenderPpe=window.renderPpe;
    if(typeof oldRenderPpe==='function')window.renderPpe=function(){const out=oldRenderPpe.apply(this,arguments);setTimeout(decoratePpeResponsibilities,0);return out};

    const oldRenderFirstAid=window.renderFirstAid;
    if(typeof oldRenderFirstAid==='function')window.renderFirstAid=function(){const out=oldRenderFirstAid.apply(this,arguments);setTimeout(decorateFirstAidResponsibilities,0);return out};

    const oldDetails=window.showDocDetails;
    if(typeof oldDetails==='function')window.showDocDetails=function(docId){const out=oldDetails.apply(this,arguments);setTimeout(()=>decorateDocumentDetails(docId),60);return out};
  }

  function installEvents(){
    document.addEventListener('click',e=>{
      const ds=e.target.closest?.('[data-dept-safety-v21133]');
      if(ds){e.preventDefault();e.stopImmediatePropagation();openDepartmentSafety(ds.dataset.deptSafetyV21133,ds.dataset.deptSafetyFocus||'');return;}
      const saveDs=e.target.closest?.('[data-save-dept-safety-v21133]');
      if(saveDs){e.preventDefault();e.stopImmediatePropagation();saveDepartmentSafety(saveDs.dataset.saveDeptSafetyV21133,saveDs);return;}
      const editOwner=e.target.closest?.('[data-v21133-edit-doc-owner]');
      if(editOwner){e.preventDefault();e.stopImmediatePropagation();showDocumentOwnerEditor(editOwner.dataset.v21133EditDocOwner);return;}
      const saveOwner=e.target.closest?.('[data-v21133-save-doc-owner]');
      if(saveOwner){e.preventDefault();e.stopImmediatePropagation();saveDocumentOwnerEditor(saveOwner.dataset.v21133SaveDocOwner,saveOwner);return;}
      const issue=e.target.closest?.('[data-v21133-ppe-issue]');
      if(issue){e.preventDefault();e.stopImmediatePropagation();showResponsiblePpeAction(issue.dataset.v21133PpeIssue);return;}
      const saveIssue=e.target.closest?.('[data-v21133-save-ppe-issue]');
      if(saveIssue){e.preventDefault();e.stopImmediatePropagation();saveResponsiblePpeAction(saveIssue.dataset.v21133SavePpeIssue,saveIssue);return;}
      const ap=e.target.closest?.('[data-approve-version]');if(ap)[40,120,300,650].forEach(ms=>setTimeout(()=>decorateApprovalOwner(ap.dataset.approveVersion),ms));
      const tap=e.target.closest?.('[data-approve-training]');if(tap)[40,120,300,650].forEach(ms=>setTimeout(()=>decorateTrainingApprovalOwner(tap.dataset.approveTraining),ms));
      const taud=e.target.closest?.('[data-assign-training]');if(taud)[40,120,300].forEach(ms=>setTimeout(()=>decorateTrainingAudienceOwner(taud.dataset.assignTraining),ms));
      const aud=e.target.closest?.('[data-edit-doc-audience]');if(aud)[40,120,300].forEach(ms=>setTimeout(()=>decorateTrainingOwner(aud.dataset.editDocAudience),ms));
      const det=e.target.closest?.('[data-doc-details]');if(det)setTimeout(()=>decorateDocumentDetails(det.dataset.docDetails),120);
      const tdet=e.target.closest?.('[data-view-training]');if(tdet)setTimeout(()=>decorateTrainingDetailsOwner(tdet.dataset.viewTraining),120);
      if(e.target.closest?.('[data-view="documents"]'))setTimeout(()=>{decorateDocumentOwners();decorateToolboxOwners()},140);
      if(e.target.closest?.('[data-view="ppe"]'))setTimeout(decoratePpeResponsibilities,140);
      if(e.target.closest?.('[data-view="firstAid"]'))setTimeout(decorateFirstAidResponsibilities,140);
      if(e.target.closest?.('[data-view="admin"]'))setTimeout(decorateDepartmentCards,160);
    },true);

    document.addEventListener('change',e=>{
      if(e.target?.id==='ownerDepartmentV21133'){
        const action=$('modalBody')?.querySelector('[data-save-version-approval]');
        if(action){const {d}=currentApprovalDocument(action.dataset.saveVersionApproval);if(d)updateOwnerUi(d)}
      }
      if(e.target?.id==='tbtOwnerDepartmentV21133'){const a=$('modalBody')?.querySelector('[data-confirm-training-approval]');const id=a?.dataset.confirmTrainingApproval;const t=(state.training||[]).find(x=>x.id===id);if(t)updateTbtOwnerUi(t,'tbtApprovalAudience')}
      if(e.target?.closest?.('#tbtApprovalAudienceAudienceSection')){const a=$('modalBody')?.querySelector('[data-confirm-training-approval]');const id=a?.dataset.confirmTrainingApproval;const t=(state.training||[]).find(x=>x.id===id);if(t)setTimeout(()=>applyTbtOwnerPermission(t,'tbtApprovalAudience'),0)}
      if(e.target?.closest?.('#approvalAudienceSection')){
        const action=$('modalBody')?.querySelector('[data-save-version-approval]');
        if(action){const {d}=currentApprovalDocument(action.dataset.saveVersionApproval);if(d)setTimeout(()=>applyOwnerApprovalPermission(d),0)}
      }
    },true);
  }

  function installStyles(){
    const s=document.createElement('style');s.id='ownerDepartmentFunctionsStylesV21133';s.textContent=`
      .owner-department-v21133{border-left:4px solid var(--primary,#2e6da4)}
      .dept-functions-v21133{display:flex;gap:5px;flex-wrap:wrap}
      .dept-function-manager-v21133{margin-top:12px}
      #ppeDepartmentFunctionsV21133,#firstAidDepartmentFunctionsV21133{margin-top:12px}
      @media(max-width:680px){.owner-department-v21133 .form-grid{grid-template-columns:1fr}.dept-functions-v21133{width:100%}}
    `;document.head.appendChild(s);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    installStyles();installFunctionWrappers();installEvents();
    [120,420,900].forEach(ms=>setTimeout(()=>{decorateDocumentOwners();decorateToolboxOwners();decorateDepartmentCards();decoratePpeResponsibilities();decorateFirstAidResponsibilities()},ms));
    window.SafetyOwnerDepartmentFunctionsV21133={
      decorateApprovalOwner,decorateTrainingOwner,decorateDocumentOwners,decorateToolboxOwners,decorateTrainingApprovalOwner,
      decorateDepartmentCards,decoratePpeResponsibilities,decorateFirstAidResponsibilities,
      openDepartmentSafety
    };
  }
  boot();
})();
