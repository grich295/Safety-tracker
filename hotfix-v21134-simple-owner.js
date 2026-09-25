/* Safety Tracker v2.11.34 CLEAN
   Simplified ownership model:
   - Owner is either Site-wide / H&S Manager OR one real Department.
   - H&S Manager is a responsibility, never a fake Department.
   - Owner and Training/read audience are separate controls.
   - PPE / First Aid are enabled per real Department and a responsible person
     is selected from members of that Department.
*/
'use strict';
(function(){
  if(window.__SAFETY_SIMPLE_OWNER_V21134)return;
  window.__SAFETY_SIMPLE_OWNER_V21134=true;

  let api,state,sb;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const ownerDocTypes=new Set(['RISK_ASSESSMENT','COSHH','SSW','POLICY','PROCEDURE','OTHER']);
  const formalTypes=new Set(['RISK_ASSESSMENT','COSHH','SSW']);

  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const activeDepartments=()=>[...(state.departments||[])].filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activePeople=()=>[...(state.people||[])].filter(p=>p.active!==false&&p.report_only!==true).sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  const department=id=>(state.departments||[]).find(d=>d.id===id)||null;
  const person=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Not assigned'};
  const responsibilityRows=()=>state.responsibilities69||[];
  const hsManager=()=>responsibilityRows().find(x=>x.active!==false&&x.responsibility_type==='HS_MANAGER'&&!x.department_id)||null;
  const departmentManager=depId=>responsibilityRows().find(x=>x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER'&&x.department_id===depId)||null;
  const isHsManager=()=>hsManager()?.user_id===state.user?.id;
  const managesDepartment=depId=>isAdmin()||isHsManager()||departmentManager(depId)?.user_id===state.user?.id;
  const managedDepartments=()=>activeDepartments().filter(d=>managesDepartment(d.id));
  const userDepartmentIds=uid=>(state.userDepartments||[]).filter(x=>x.user_id===uid).map(x=>x.department_id);
  const departmentMembers=depId=>{const ids=new Set((state.userDepartments||[]).filter(x=>x.department_id===depId).map(x=>x.user_id));return activePeople().filter(p=>ids.has(p.id))};
  const ownerScope=x=>String(x?.owner_scope||'').toUpperCase()||(x?.owner_department_id?'DEPARTMENT':'UNSET');
  const ownerLabel=x=>{
    const scope=ownerScope(x);
    if(scope==='SITE_WIDE')return 'Site-wide / H&S';
    if(scope==='DEPARTMENT')return department(x?.owner_department_id)?.name||'Department';
    return 'Owner not set';
  };
  const ownerResponsibleLabel=x=>{
    const scope=ownerScope(x);
    if(scope==='SITE_WIDE')return hsManager()?.user_id?person(hsManager().user_id):'H&S Manager not assigned';
    if(scope==='DEPARTMENT'){
      const r=departmentManager(x?.owner_department_id);
      return r?.user_id?person(r.user_id):'Department Manager not assigned';
    }
    return 'Not assigned';
  };
  const canChooseSiteWide=()=>isAdmin()||isHsManager();

  function ownerOptions(x){
    const currentScope=ownerScope(x),currentDep=x?.owner_department_id||'';
    let html='<option value="UNSET">Choose owner…</option>';
    if(canChooseSiteWide()||currentScope==='SITE_WIDE')html+=`<option value="SITE_WIDE" ${currentScope==='SITE_WIDE'?'selected':''}>Site-wide / H&S Manager</option>`;
    const allowed=(isAdmin()||isHsManager())?activeDepartments():managedDepartments();
    const seen=new Set();
    for(const d of allowed){seen.add(d.id);html+=`<option value="DEPARTMENT:${esc(d.id)}" ${currentScope==='DEPARTMENT'&&currentDep===d.id?'selected':''}>${esc(d.name)}</option>`}
    if(currentScope==='DEPARTMENT'&&currentDep&&!seen.has(currentDep)){
      const d=department(currentDep);
      if(d)html+=`<option value="DEPARTMENT:${esc(d.id)}" selected>${esc(d.name)}${d.active===false?' (archived)':''}</option>`;
    }
    return html;
  }

  function selectedOwner(prefix='docOwnerV21134'){
    const value=$(prefix)?.value||'UNSET';
    if(value==='SITE_WIDE')return {scope:'SITE_WIDE',departmentId:null};
    if(value.startsWith('DEPARTMENT:'))return {scope:'DEPARTMENT',departmentId:value.slice(11)};
    return {scope:'UNSET',departmentId:null};
  }

  function ownerSection(x,prefix='docOwnerV21134',kind='document'){
    const training=kind==='training';
    return `<div class="section-card simple-owner-v21134" data-owner-section-v21134>
      <div class="row-between">
        <div><h4>Owner / responsibility</h4><p class="muted">Choose <strong>Site-wide / H&S Manager</strong> or one real Department. This does <strong>not</strong> control who receives ${training?'this training':'Training/read assignments'}.</p></div>
        <span id="${prefix}Badge" class="badge ${ownerScope(x)==='UNSET'?'due':'complete'}">${esc(ownerLabel(x))}</span>
      </div>
      <div class="form-grid">
        <label>Owner
          <select id="${prefix}">${ownerOptions(x)}</select>
          <span class="muted">Departments stay as real hotel teams only. H&S Manager is a responsibility, not a Department.</span>
        </label>
        <div class="hint-box"><strong>Responsible person:</strong> <span id="${prefix}Responsible">${esc(ownerResponsibleLabel(x))}</span><br><span class="muted">Training / reader audience is set separately below.</span></div>
      </div>
    </div>`;
  }

  function wireOwner(prefix,x){
    const sel=$(prefix);if(!sel)return;
    const update=()=>{
      const o=selectedOwner(prefix);
      const badge=$(prefix+'Badge'),resp=$(prefix+'Responsible');
      if(badge){
        const label=o.scope==='SITE_WIDE'?'Site-wide / H&S':o.scope==='DEPARTMENT'?(department(o.departmentId)?.name||'Department'):'Owner not set';
        badge.textContent=label;badge.className=`badge ${o.scope==='UNSET'?'due':'complete'}`;
      }
      if(resp){
        if(o.scope==='SITE_WIDE')resp.textContent=hsManager()?.user_id?person(hsManager().user_id):'H&S Manager not assigned';
        else if(o.scope==='DEPARTMENT'){const r=departmentManager(o.departmentId);resp.textContent=r?.user_id?person(r.user_id):'Department Manager not assigned'}
        else resp.textContent='Not assigned';
      }
    };
    sel.addEventListener('change',update);update();
  }

  async function saveDocumentOwner(docId,prefix='docOwnerV21134',requireOwner=true){
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d)return false;
    const o=selectedOwner(prefix);
    if(o.scope==='UNSET'){
      if(requireOwner)api.toast?.('Choose Site-wide / H&S or an Owner Department first.');
      return !requireOwner;
    }
    const currentScope=ownerScope(d);
    if(currentScope===o.scope&&String(d.owner_department_id||'')===String(o.departmentId||''))return true;
    const r=await sb.rpc('set_document_owner_v21134',{p_document_id:docId,p_owner_scope:o.scope,p_department_id:o.departmentId});
    if(r.error){api.toast?.(r.error.message||'Could not save document owner.');return false}
    d.owner_scope=o.scope;d.owner_department_id=o.departmentId;
    return true;
  }

  async function saveTrainingOwner(trainingId,prefix='tbtOwnerV21134',requireOwner=true){
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!t)return false;
    const o=selectedOwner(prefix);
    if(o.scope==='UNSET'){
      if(requireOwner)api.toast?.('Choose Site-wide / H&S or an Owner Department first.');
      return !requireOwner;
    }
    const currentScope=ownerScope(t);
    if(currentScope===o.scope&&String(t.owner_department_id||'')===String(o.departmentId||''))return true;
    const r=await sb.rpc('set_training_owner_v21134',{p_training_session_id:trainingId,p_owner_scope:o.scope,p_department_id:o.departmentId});
    if(r.error){api.toast?.(r.error.message||'Could not save Toolbox Talk owner.');return false}
    t.owner_scope=o.scope;t.owner_department_id=o.departmentId;
    return true;
  }

  function approvalDocument(versionId){
    const v=(state.versions||[]).find(x=>x.id===versionId);
    return {v,d:(state.documents||[]).find(x=>x.id===v?.document_id)};
  }

  function decorateApproval(versionId){
    const body=$('modalBody'),save=body?.querySelector('[data-save-version-approval]');
    if(!body||!save)return;
    const {d}=approvalDocument(versionId||save.dataset.saveVersionApproval);
    if(!d||!ownerDocTypes.has(String(d.doc_type||'').toUpperCase()))return;
    if(body.querySelector('[data-owner-section-v21134]'))return;
    const node=document.createElement('div');node.innerHTML=ownerSection(d,'docOwnerV21134','document');
    const target=$('approvalTrainingSchedule')||$('approvalAudienceSection')||[...body.querySelectorAll('.actions')].pop();
    if(target)target.insertAdjacentElement('beforebegin',node.firstElementChild);else body.appendChild(node.firstElementChild);
    wireOwner('docOwnerV21134',d);
  }

  function decorateDocumentTrainingSettings(docId){
    const body=$('modalBody'),save=body?.querySelector('[data-save-doc-audience]');
    const d=(state.documents||[]).find(x=>x.id===docId);if(!body||!save||!d||!formalTypes.has(String(d.doc_type||'').toUpperCase()))return;
    if(body.querySelector('[data-owner-section-v21134]'))return;
    const node=document.createElement('div');node.innerHTML=ownerSection(d,'docOwnerV21134','document');
    const target=$('approvalTrainingSchedule')||$('approvalAudienceSection')||[...body.querySelectorAll('.actions')].pop();
    if(target)target.insertAdjacentElement('beforebegin',node.firstElementChild);else body.appendChild(node.firstElementChild);
    wireOwner('docOwnerV21134',d);
  }

  function decorateDocumentCards(){
    if(!isManager())return;
    const root=$('documentsList');if(!root)return;
    for(const card of root.querySelectorAll('.item-card')){
      const id=card.querySelector('[data-doc-details]')?.dataset.docDetails;if(!id)continue;
      const d=(state.documents||[]).find(x=>x.id===id);if(!d||!ownerDocTypes.has(String(d.doc_type||'').toUpperCase())||d.status==='ARCHIVED')continue;
      const meta=card.querySelector('.meta');
      if(meta){
        let b=meta.querySelector('.simple-owner-badge-v21134');
        if(!b){b=document.createElement('span');b.className='badge simple-owner-badge-v21134';meta.appendChild(b)}
        b.className=`badge simple-owner-badge-v21134 ${ownerScope(d)==='UNSET'?'due':'complete'}`;
        b.textContent=`Owner: ${ownerLabel(d)}`;
        b.title=`Responsible: ${ownerResponsibleLabel(d)}`;
      }
      const row=card.querySelector('.action-bar')||card.querySelector('.row');
      if(row&&!row.querySelector('[data-v21134-owner-doc]')){
        const b=document.createElement('button');b.type='button';b.className='ghost';b.dataset.v21134OwnerDoc=id;b.textContent='Owner';row.appendChild(b);
      }
    }
  }

  function openDocumentOwner(docId){
    if(!isManager())return;
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d||!ownerDocTypes.has(String(d.doc_type||'').toUpperCase()))return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent='Document owner';
    if(body)body.innerHTML=`<div class="section-card"><h3>${esc(d.reference?d.reference+' - ':'')}${esc(d.title||'Controlled document')}</h3><p class="muted">Ownership says who is responsible for review and follow-up. It does not change Training/read assignments.</p></div>${ownerSection(d,'docOwnerV21134','document')}<div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21134-save-owner-doc="${esc(docId)}">Save owner</button></div>`;
    if(modal&&!modal.open)modal.showModal();
    wireOwner('docOwnerV21134',d);
  }

  async function saveDocumentOwnerEditor(docId,button){
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const ok=await saveDocumentOwner(docId,'docOwnerV21134',true);
    if(!ok){button.disabled=false;button.textContent=old;return}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Document owner updated. Training/read audience was not changed.');
  }

  const isToolboxTalk=t=>String(t?.source_kind||t?.session_type||'').toUpperCase()==='TOOLBOX_TALK'&&t?.auto_managed!==true;

  function decorateTbtApproval(trainingId){
    const body=$('modalBody'),save=body?.querySelector('[data-confirm-training-approval]');
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!body||!save||!t||!isToolboxTalk(t))return;
    if(body.querySelector('[data-owner-section-v21134]'))return;
    const node=document.createElement('div');node.innerHTML=ownerSection(t,'tbtOwnerV21134','training');
    const target=body.querySelector('[id$="AudienceSection"]')||[...body.querySelectorAll('.actions')].pop();
    if(target)target.insertAdjacentElement('beforebegin',node.firstElementChild);else body.appendChild(node.firstElementChild);
    wireOwner('tbtOwnerV21134',t);
  }

  function decorateTbtAudience(trainingId){
    const body=$('modalBody'),save=body?.querySelector('[data-save-training-audience]');
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!body||!save||!t||!isToolboxTalk(t))return;
    if(body.querySelector('[data-owner-section-v21134]'))return;
    const node=document.createElement('div');node.innerHTML=ownerSection(t,'tbtOwnerV21134','training');
    const target=body.querySelector('[id$="AudienceSection"]')||[...body.querySelectorAll('.actions')].pop();
    if(target)target.insertAdjacentElement('beforebegin',node.firstElementChild);else body.appendChild(node.firstElementChild);
    wireOwner('tbtOwnerV21134',t);
  }

  function decorateTrainingDetails(trainingId){
    const body=$('modalBody'),t=(state.training||[]).find(x=>x.id===trainingId);if(!body||!t||!isToolboxTalk(t)||!isManager())return;
    if(!body.querySelector('.tbt-owner-note-v21134')){
      const n=document.createElement('div');n.className=`${ownerScope(t)==='UNSET'?'danger-note':'success-note'} tbt-owner-note-v21134`;n.innerHTML=`<strong>Owner:</strong> ${esc(ownerLabel(t))}<br><span class="muted">Responsible: ${esc(ownerResponsibleLabel(t))}</span>`;
      const first=body.firstElementChild;if(first)first.insertAdjacentElement('afterend',n);else body.prepend(n);
    }
    const actions=[...body.querySelectorAll('.actions')].pop();
    if(actions&&!actions.querySelector('[data-v21134-owner-training]')){
      const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21134OwnerTraining=trainingId;b.textContent='Owner';actions.prepend(b);
    }
  }

  function openTrainingOwner(trainingId){
    if(!isManager())return;
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!t||!isToolboxTalk(t))return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent='Toolbox Talk owner';
    if(body)body.innerHTML=`<div class="section-card"><h3>${esc(t.reference?t.reference+' - ':'')}${esc(t.name||'Toolbox Talk')}</h3><p class="muted">Owner responsibility and the Training audience are separate.</p></div>${ownerSection(t,'tbtOwnerV21134','training')}<div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21134-save-owner-training="${esc(trainingId)}">Save owner</button></div>`;
    if(modal&&!modal.open)modal.showModal();
    wireOwner('tbtOwnerV21134',t);
  }

  async function saveTrainingOwnerEditor(trainingId,button){
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const ok=await saveTrainingOwner(trainingId,'tbtOwnerV21134',true);
    if(!ok){button.disabled=false;button.textContent=old;return}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Toolbox Talk owner updated. Training audience was not changed.');
  }

  function decorateDepartmentEditor(id=''){
    if(!isAdmin())return;
    const body=$('modalBody');if(!body||body.querySelector('#departmentFunctionsV21134'))return;
    const d=id?department(id):null;
    const hint=body.querySelector('.hint-box');
    const box=document.createElement('div');box.id='departmentFunctionsV21134';box.className='section-card';
    box.innerHTML=`<h4>Department functions</h4><p class="muted">Only use these switches for real hotel Departments. H&S Manager is configured under Positions & Responsibilities, not here.</p><div class="form-grid"><label class="check-row"><input id="departmentPpeEnabledV21134" type="checkbox" ${d?.ppe_enabled?'checked':''}> Enable PPE responsibility for this Department</label><label class="check-row"><input id="departmentFirstAidEnabledV21134" type="checkbox" ${d?.first_aid_enabled?'checked':''}> Enable First Aid responsibility for this Department</label></div><div class="hint-box">After the Department has members, its Department Manager can choose the responsible PPE and First Aid person from that Department.</div>`;
    if(hint)hint.insertAdjacentElement('afterend',box);else body.querySelector('.actions')?.insertAdjacentElement('beforebegin',box);
  }

  async function saveDepartmentWithFunctions(id=''){
    if(!isAdmin())return;
    const name=clean($('departmentName')?.value);if(!name)return api.toast?.('Department name is required.');
    const ppe=!!$('departmentPpeEnabledV21134')?.checked,fa=!!$('departmentFirstAidEnabledV21134')?.checked;
    const r=await sb.rpc('save_department_v230',{p_department_id:id||null,p_name:name});if(r.error)return api.toast?.(r.error.message);
    const depId=id||r.data,existing=department(depId);
    const sr=await sb.rpc('set_department_safety_functions_v21133',{
      p_department_id:depId,
      p_ppe_enabled:ppe,
      p_first_aid_enabled:fa,
      p_ppe_responsible_user_id:ppe?(existing?.ppe_responsible_user_id||null):null,
      p_first_aid_responsible_user_id:fa?(existing?.first_aid_responsible_user_id||null):null
    });
    if(sr.error)return api.toast?.(`Department saved, but PPE / First Aid settings failed: ${sr.error.message}`);
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.(id?'Department updated.':'Department created. PPE / First Aid functions saved.');
  }

  function decorateDepartmentCards(){
    if(!isAdmin())return;
    const root=$('departmentList');if(!root)return;
    for(const card of root.querySelectorAll('.item-card')){
      const edit=card.querySelector('[data-edit-department]');if(!edit)continue;
      const d=department(edit.dataset.editDepartment);if(!d)continue;
      const meta=card.querySelector('.meta');
      if(meta&&!meta.querySelector('.dept-functions-badge-v21134')){
        const b=document.createElement('span');b.className='badge neutral dept-functions-badge-v21134';
        const enabled=[d.ppe_enabled?'PPE':'',d.first_aid_enabled?'First Aid':''].filter(Boolean);
        b.textContent=enabled.length?enabled.join(' + '):'PPE / First Aid off';meta.appendChild(b);
      }
      const row=card.querySelector('.row');
      if(row&&!row.querySelector('[data-dept-safety-v21134]')){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.deptSafetyV21134=d.id;b.textContent='Safety functions';row.prepend(b);
      }
    }
  }

  function departmentSafetyEditor(depId,focus=''){
    const d=department(depId);if(!d||!managesDepartment(depId))return;
    const members=departmentMembers(depId);
    const opts=selected=>'<option value="">Not assigned</option>'+members.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.display_name||p.email)}</option>`).join('');
    const admin=isAdmin(),modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent=`${d.name} · safety responsibility`;
    if(body)body.innerHTML=`<div class="section-card"><p class="muted">PPE and First Aid responsibility stays inside the real Department. The responsible person must be a current member of ${esc(d.name)}.</p></div>
      <div class="form-grid">
        <label class="check-row"><input id="deptPpeEnabledV21134" type="checkbox" ${d.ppe_enabled?'checked':''} ${admin?'':'disabled'}> PPE function enabled</label>
        <label>PPE responsible person<select id="deptPpePersonV21134">${opts(d.ppe_responsible_user_id||'')}</select><span class="muted">Handles Department PPE issues/replacement actions.</span></label>
        <label class="check-row"><input id="deptFaEnabledV21134" type="checkbox" ${d.first_aid_enabled?'checked':''} ${admin?'':'disabled'}> First Aid function enabled</label>
        <label>First Aid responsible person<select id="deptFaPersonV21134">${opts(d.first_aid_responsible_user_id||'')}</select><span class="muted">Becomes the monthly default checker unless a box has its own override.</span></label>
      </div>
      ${admin?'':'<div class="hint-box">Admin controls whether each function is enabled. As the Department Manager/H&S Manager you can choose the responsible person.</div>'}
      <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-save-dept-safety-v21134="${esc(depId)}">Save responsibility</button></div>`;
    if(modal&&!modal.open)modal.showModal();
    const sync=()=>{if($('deptPpePersonV21134'))$('deptPpePersonV21134').disabled=!$('deptPpeEnabledV21134')?.checked;if($('deptFaPersonV21134'))$('deptFaPersonV21134').disabled=!$('deptFaEnabledV21134')?.checked};
    $('deptPpeEnabledV21134')?.addEventListener('change',sync);$('deptFaEnabledV21134')?.addEventListener('change',sync);sync();
    if(focus==='PPE')$('deptPpePersonV21134')?.focus();if(focus==='FIRST_AID')$('deptFaPersonV21134')?.focus();
  }

  async function saveDepartmentSafety(depId,button){
    const d=department(depId);if(!d)return;
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const r=await sb.rpc('set_department_safety_functions_v21133',{
      p_department_id:depId,
      p_ppe_enabled:!!$('deptPpeEnabledV21134')?.checked,
      p_first_aid_enabled:!!$('deptFaEnabledV21134')?.checked,
      p_ppe_responsible_user_id:$('deptPpePersonV21134')?.value||null,
      p_first_aid_responsible_user_id:$('deptFaPersonV21134')?.value||null
    });
    if(r.error){button.disabled=false;button.textContent=old;return api.toast?.(r.error.message||'Could not save Department safety responsibility.')}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Department PPE / First Aid responsibility updated.');
  }

  function functionManagerCards(kind){
    if(!isManager())return '';
    const rows=managedDepartments();if(!rows.length)return '';
    return `<div class="section-card dept-functions-v21134"><div class="row-between"><div><h3>Department ${kind==='PPE'?'PPE':'First Aid'} responsibility</h3><p class="muted">Choose who is responsible inside Departments you manage.</p></div></div><div class="card-list">${rows.map(d=>{
      const enabled=kind==='PPE'?d.ppe_enabled:d.first_aid_enabled;
      const uid=kind==='PPE'?d.ppe_responsible_user_id:d.first_aid_responsible_user_id;
      return `<div class="item-card compact traffic-${enabled?(uid?'green':'amber'):'neutral'}"><div class="row-between"><div><strong>${esc(d.name)}</strong><div class="meta"><span class="badge ${enabled?'complete':'neutral'}">${enabled?'Enabled':'Not enabled'}</span><span>${enabled?(uid?`Responsible: ${esc(person(uid))}`:'Responsible person not assigned'):'Admin can enable this function'}</span></div></div><button class="secondary" type="button" data-dept-safety-v21134="${esc(d.id)}" data-dept-safety-focus="${kind}">${enabled?'Manage':'View setup'}</button></div></div>`;
    }).join('')}</div></div>`;
  }

  const responsiblePpeDepartments=()=>activeDepartments().filter(d=>d.ppe_enabled&&d.ppe_responsible_user_id===state.user?.id);
  const responsibleFirstAidDepartments=()=>activeDepartments().filter(d=>d.first_aid_enabled&&d.first_aid_responsible_user_id===state.user?.id);
  const userInDepSet=(uid,set)=>userDepartmentIds(uid).some(id=>set.has(id));

  function responsiblePpeIssues(){
    const deps=responsiblePpeDepartments(),set=new Set(deps.map(d=>d.id));if(!set.size)return [];
    return (state.ppeCheckItems||[]).filter(i=>['MISSING','REPLACEMENT_REQUIRED'].includes(i.result)&&!['RESOLVED','NOT_REQUIRED'].includes(i.action_status||'OPEN')).map(i=>{
      const c=(state.ppeChecks||[]).find(x=>x.id===i.check_id);return c&&userInDepSet(c.user_id,set)?{i,c}:null;
    }).filter(Boolean);
  }

  function decoratePpe(){
    const view=$('ppeView');if(!view)return;
    $('ppeDepartmentFunctionsV21134')?.remove();
    const managerHtml=functionManagerCards('PPE');
    const deps=responsiblePpeDepartments(),issues=responsiblePpeIssues();
    const mine=deps.length?`<div class="section-card traffic-${issues.length?'amber':'green'}"><h3>Your Department PPE responsibility</h3><p class="muted">Responsible for ${esc(deps.map(d=>d.name).join(', '))}.</p><div class="card-list">${issues.length?issues.map(x=>`<div class="item-card compact traffic-red"><div class="row-between"><div><strong>${esc(person(x.c.user_id))} · ${esc(x.i.ppe_name_snapshot||'PPE')}</strong><div class="meta"><span>${esc(x.i.result)}</span><span>${esc(x.i.comment||'No comment')}</span><span>${esc(x.i.action_status||'OPEN')}</span></div></div><button class="primary" type="button" data-v21134-ppe-issue="${esc(x.i.id)}">Update action</button></div></div>`).join(''):'<div class="success-note">No open PPE replacement/order issues for your Department.</div>'}</div></div>`:'';
    if(!managerHtml&&!mine)return;
    const box=document.createElement('div');box.id='ppeDepartmentFunctionsV21134';box.innerHTML=managerHtml+mine;
    const list=$('ppeList');if(list)list.insertAdjacentElement('afterend',box);else view.appendChild(box);
  }

  function decorateFirstAid(){
    const view=$('firstAidView');if(!view)return;
    $('firstAidDepartmentFunctionsV21134')?.remove();
    const managerHtml=functionManagerCards('FIRST_AID');
    const deps=responsibleFirstAidDepartments();
    const mine=deps.length?`<div class="section-card traffic-green"><h3>Your Department First Aid responsibility</h3><p class="muted">You are the default First Aid checker for ${esc(deps.map(d=>d.name).join(', '))}. A box-specific override still takes priority.</p></div>`:'';
    if(!managerHtml&&!mine)return;
    const box=document.createElement('div');box.id='firstAidDepartmentFunctionsV21134';box.innerHTML=managerHtml+mine;
    const list=$('firstAidList');if(list)list.insertAdjacentElement('afterend',box);else view.appendChild(box);
  }

  function openPpeIssue(id){
    const item=(state.ppeCheckItems||[]).find(x=>x.id===id),check=(state.ppeChecks||[]).find(x=>x.id===item?.check_id);if(!item||!check)return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent='Department PPE action';
    if(body)body.innerHTML=`<p><strong>${esc(person(check.user_id))} · ${esc(item.ppe_name_snapshot||'PPE')}</strong></p><p>${esc(item.result)}${item.comment?' · '+esc(item.comment):''}</p><div class="form-grid"><label>Action status<select id="ppeIssueStatusV21134"><option value="OPEN" ${(item.action_status||'OPEN')==='OPEN'?'selected':''}>Open</option><option value="ORDERED" ${item.action_status==='ORDERED'?'selected':''}>Ordered</option><option value="RESOLVED" ${item.action_status==='RESOLVED'?'selected':''}>Resolved</option><option value="NOT_REQUIRED" ${item.action_status==='NOT_REQUIRED'?'selected':''}>Not required</option></select></label><label class="full">Action note<textarea id="ppeIssueNoteV21134">${esc(item.admin_note||'')}</textarea></label></div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21134-save-ppe-issue="${esc(id)}">Save action</button></div>`;
    if(modal&&!modal.open)modal.showModal();
  }

  async function savePpeIssue(id,button){
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const r=await sb.rpc('resolve_ppe_check_item_department_v21133',{p_check_item_id:id,p_action_status:$('ppeIssueStatusV21134')?.value||'OPEN',p_admin_note:clean($('ppeIssueNoteV21134')?.value)||null});
    if(r.error){button.disabled=false;button.textContent=old;return api.toast?.(r.error.message||'Could not update PPE action.')}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('Department PPE action updated.');
  }

  function installWrappers(){
    const oldShowVersionApproval=window.showVersionApproval;
    if(typeof oldShowVersionApproval==='function')window.showVersionApproval=function(versionId){const out=oldShowVersionApproval.apply(this,arguments);[0,80,220].forEach(ms=>setTimeout(()=>decorateApproval(versionId),ms));return out};

    const oldSaveVersionApproval=window.saveVersionApproval;
    if(typeof oldSaveVersionApproval==='function')window.saveVersionApproval=async function(versionId){
      const {d}=approvalDocument(versionId);
      if(d&&ownerDocTypes.has(String(d.doc_type||'').toUpperCase())&&($('approvalDecision')?.value||'APPROVED')==='APPROVED'){
        const ok=await saveDocumentOwner(d.id,'docOwnerV21134',true);if(!ok)return;
      }
      return oldSaveVersionApproval.apply(this,arguments);
    };

    const oldShowDocumentAudience=window.showDocumentAudience;
    if(typeof oldShowDocumentAudience==='function')window.showDocumentAudience=function(docId){const out=oldShowDocumentAudience.apply(this,arguments);[0,80,220].forEach(ms=>setTimeout(()=>decorateDocumentTrainingSettings(docId),ms));return out};

    const oldSaveDocumentAudience=window.saveDocumentAudience;
    if(typeof oldSaveDocumentAudience==='function')window.saveDocumentAudience=async function(docId){
      const d=(state.documents||[]).find(x=>x.id===docId);
      if(d&&formalTypes.has(String(d.doc_type||'').toUpperCase())&&$('docOwnerV21134')){
        const ok=await saveDocumentOwner(docId,'docOwnerV21134',true);if(!ok)return;
      }
      return oldSaveDocumentAudience.apply(this,arguments);
    };

    const oldShowTrainingApproval=window.showTrainingApproval;
    if(typeof oldShowTrainingApproval==='function')window.showTrainingApproval=function(trainingId){const out=oldShowTrainingApproval.apply(this,arguments);[0,80,220].forEach(ms=>setTimeout(()=>decorateTbtApproval(trainingId),ms));return out};

    const oldConfirmTrainingApproval=window.confirmTrainingApproval;
    if(typeof oldConfirmTrainingApproval==='function')window.confirmTrainingApproval=async function(trainingId){
      const t=(state.training||[]).find(x=>x.id===trainingId);
      if(t&&isToolboxTalk(t)&&$('tbtOwnerV21134')){const ok=await saveTrainingOwner(trainingId,'tbtOwnerV21134',true);if(!ok)return}
      return oldConfirmTrainingApproval.apply(this,arguments);
    };

    const oldShowAssignTraining=window.showAssignTraining;
    if(typeof oldShowAssignTraining==='function')window.showAssignTraining=function(trainingId){const out=oldShowAssignTraining.apply(this,arguments);[0,80,220].forEach(ms=>setTimeout(()=>decorateTbtAudience(trainingId),ms));return out};

    const oldSaveTrainingAudience=window.saveTrainingAudience;
    if(typeof oldSaveTrainingAudience==='function')window.saveTrainingAudience=async function(trainingId){
      const t=(state.training||[]).find(x=>x.id===trainingId);
      if(t&&isToolboxTalk(t)&&$('tbtOwnerV21134')){const ok=await saveTrainingOwner(trainingId,'tbtOwnerV21134',true);if(!ok)return}
      return oldSaveTrainingAudience.apply(this,arguments);
    };

    const oldShowTrainingDetails=window.showTrainingDetails;
    if(typeof oldShowTrainingDetails==='function')window.showTrainingDetails=function(trainingId){const out=oldShowTrainingDetails.apply(this,arguments);setTimeout(()=>decorateTrainingDetails(trainingId),80);return out};

    const oldShowDepartmentEditor=window.showDepartmentEditor;
    if(typeof oldShowDepartmentEditor==='function')window.showDepartmentEditor=function(id=''){const out=oldShowDepartmentEditor.apply(this,arguments);setTimeout(()=>decorateDepartmentEditor(id),0);return out};

    if(typeof window.saveDepartment==='function')window.saveDepartment=saveDepartmentWithFunctions;

    const oldRenderAdmin=window.renderAdmin;
    if(typeof oldRenderAdmin==='function')window.renderAdmin=async function(){const out=await oldRenderAdmin.apply(this,arguments);setTimeout(decorateDepartmentCards,0);return out};

    const oldRenderDocuments=window.renderDocuments;
    if(typeof oldRenderDocuments==='function')window.renderDocuments=function(){const out=oldRenderDocuments.apply(this,arguments);setTimeout(decorateDocumentCards,0);return out};

    const oldRenderPpe=window.renderPpe;
    if(typeof oldRenderPpe==='function')window.renderPpe=function(){const out=oldRenderPpe.apply(this,arguments);setTimeout(decoratePpe,0);return out};

    const oldRenderFirstAid=window.renderFirstAid;
    if(typeof oldRenderFirstAid==='function')window.renderFirstAid=function(){const out=oldRenderFirstAid.apply(this,arguments);setTimeout(decorateFirstAid,0);return out};
  }

  function installEvents(){
    document.addEventListener('click',e=>{
      const owner=e.target.closest?.('[data-v21134-owner-doc]');if(owner){e.preventDefault();e.stopImmediatePropagation();openDocumentOwner(owner.dataset.v21134OwnerDoc);return}
      const saveOwner=e.target.closest?.('[data-v21134-save-owner-doc]');if(saveOwner){e.preventDefault();e.stopImmediatePropagation();saveDocumentOwnerEditor(saveOwner.dataset.v21134SaveOwnerDoc,saveOwner);return}
      const trainOwner=e.target.closest?.('[data-v21134-owner-training]');if(trainOwner){e.preventDefault();e.stopImmediatePropagation();openTrainingOwner(trainOwner.dataset.v21134OwnerTraining);return}
      const saveTrain=e.target.closest?.('[data-v21134-save-owner-training]');if(saveTrain){e.preventDefault();e.stopImmediatePropagation();saveTrainingOwnerEditor(saveTrain.dataset.v21134SaveOwnerTraining,saveTrain);return}
      const dep=e.target.closest?.('[data-dept-safety-v21134]');if(dep){e.preventDefault();e.stopImmediatePropagation();departmentSafetyEditor(dep.dataset.deptSafetyV21134,dep.dataset.deptSafetyFocus||'');return}
      const saveDep=e.target.closest?.('[data-save-dept-safety-v21134]');if(saveDep){e.preventDefault();e.stopImmediatePropagation();saveDepartmentSafety(saveDep.dataset.saveDeptSafetyV21134,saveDep);return}
      const issue=e.target.closest?.('[data-v21134-ppe-issue]');if(issue){e.preventDefault();e.stopImmediatePropagation();openPpeIssue(issue.dataset.v21134PpeIssue);return}
      const saveIssue=e.target.closest?.('[data-v21134-save-ppe-issue]');if(saveIssue){e.preventDefault();e.stopImmediatePropagation();savePpeIssue(saveIssue.dataset.v21134SavePpeIssue,saveIssue);return}
      const approve=e.target.closest?.('[data-approve-version]');if(approve)[50,140,320].forEach(ms=>setTimeout(()=>decorateApproval(approve.dataset.approveVersion),ms));
      const ta=e.target.closest?.('[data-approve-training]');if(ta)[50,140,320].forEach(ms=>setTimeout(()=>decorateTbtApproval(ta.dataset.approveTraining),ms));
      const aud=e.target.closest?.('[data-edit-doc-audience]');if(aud)[50,140,320].forEach(ms=>setTimeout(()=>decorateDocumentTrainingSettings(aud.dataset.editDocAudience),ms));
      const tr=e.target.closest?.('[data-assign-training]');if(tr)[50,140,320].forEach(ms=>setTimeout(()=>decorateTbtAudience(tr.dataset.assignTraining),ms));
      const td=e.target.closest?.('[data-view-training]');if(td)setTimeout(()=>decorateTrainingDetails(td.dataset.viewTraining),120);
      if(e.target.closest?.('[data-view="documents"]'))setTimeout(decorateDocumentCards,150);
      if(e.target.closest?.('[data-view="admin"]'))setTimeout(decorateDepartmentCards,150);
      if(e.target.closest?.('[data-view="ppe"]'))setTimeout(decoratePpe,150);
      if(e.target.closest?.('[data-view="firstAid"]'))setTimeout(decorateFirstAid,150);
    },true);
  }

  function installStyles(){
    const s=document.createElement('style');s.id='simpleOwnerStylesV21134';s.textContent=`
      .simple-owner-v21134{border-left:4px solid var(--primary,#2e6da4)}
      .dept-functions-v21134{margin-top:12px}
      #ppeDepartmentFunctionsV21134,#firstAidDepartmentFunctionsV21134{margin-top:12px}
      @media(max-width:720px){.simple-owner-v21134 .form-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    installStyles();installWrappers();installEvents();
    [120,420,900].forEach(ms=>setTimeout(()=>{decorateDocumentCards();decorateDepartmentCards();decoratePpe();decorateFirstAid()},ms));
    window.SafetySimpleOwnerV21134={decorateDocumentCards,decorateDepartmentCards,decoratePpe,decorateFirstAid,departmentSafetyEditor};
  }
  boot();
})();
