/* Safety Tracker v2.11.35 CLEAN
   First Aid Equipment expansion:
   - Keeps First Aid Boxes and adds Eye Wash Stations in the same monthly module.
   - Every item has a real Department plus a required specific physical location.
   - New First Aid Boxes can load the HSE L74 low-hazard suggested starter contents.
   - New Eye Wash Stations default to 2 x 500 ml sterile eyewash bottles (1 litre total),
     matching HSE guidance where mains tap water is not readily available for eye irrigation.
   - All starter quantities/items remain editable and can be personalised to the site's needs assessment.
   - Department First Aid responsibility and equipment-specific overrides remain supported.
*/
'use strict';
(function(){
  if(window.__SAFETY_FIRST_AID_EQUIPMENT_V21135)return;
  window.__SAFETY_FIRST_AID_EQUIPMENT_V21135=true;

  let api,state,sb;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const typeLabel=t=>({FIRST_AID_BOX:'First Aid Box',EYE_WASH_STATION:'Eye Wash Station',OTHER_FIRST_AID:'Other First Aid Equipment'})[String(t||'FIRST_AID_BOX').toUpperCase()]||'First Aid Equipment';
  const firstAidEnabledDepartments=()=>[...(state.departments||[])].filter(d=>d.active!==false&&d.first_aid_enabled===true).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const department=id=>(state.departments||[]).find(d=>d.id===id)||null;
  const equipment=id=>(state.firstAidBoxes||[]).find(x=>x.id===id)||null;
  const equipmentItems=id=>(state.firstAidBoxItems||[]).filter(x=>x.box_id===id&&x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.item_name||'').localeCompare(String(b.item_name||'')));
  const person=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Not assigned'};
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const responsibilities=()=>state.responsibilities69||[];
  const isHsManager=()=>responsibilities().some(r=>r.active!==false&&r.responsibility_type==='HS_MANAGER'&&!r.department_id&&r.user_id===state.user?.id);
  const managesDepartment=depId=>isAdmin()||isHsManager()||responsibilities().some(r=>r.active!==false&&r.responsibility_type==='DEPARTMENT_MANAGER'&&r.department_id===depId&&r.user_id===state.user?.id);
  const managedFirstAidDepartments=()=>firstAidEnabledDepartments().filter(d=>managesDepartment(d.id));
  const departmentMembers=depId=>{
    const ids=new Set((state.userDepartments||[]).filter(x=>x.department_id===depId).map(x=>x.user_id));
    return (state.people||[]).filter(p=>p.active!==false&&p.report_only!==true&&ids.has(p.id)).sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  };

  const HSE_BOX_NOTE='HSE L74 gives suggested low-hazard starter contents only. Your final contents should reflect the workplace first-aid needs assessment.';
  const HSE_EYE_NOTE='HSE guidance says that where mains tap water is not readily available for eye irrigation, provide at least 1 litre of sterile water or sterile normal saline (0.9%) in sealed disposable containers. Opened containers should not be reused and expired containers should not be used.';

  function updateModuleHeading(){
    const view=$('firstAidView');if(!view)return;
    const h=view.querySelector('.page-heading h2');if(h)h.textContent='Monthly First Aid Equipment Checks';
    const p=view.querySelector('.page-heading p');if(p)p.textContent='Department First Aid Boxes and Eye Wash Stations. Each item records exactly where it is kept and uses an editable monthly checklist.';
  }

  function departmentOptions(selected=''){
    const all=[...(state.departments||[])].filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    return '<option value="">Select Department</option>'+all.map(d=>{
      const on=d.first_aid_enabled===true;
      return `<option value="${esc(d.id)}" ${d.id===selected?'selected':''} ${!on&&d.id!==selected?'disabled':''}>${esc(d.name)}${on?'':' — First Aid off'}</option>`;
    }).join('');
  }

  function responsibleOptions(depId,selected=''){
    const d=department(depId),members=departmentMembers(depId);
    const defaultName=d?.first_aid_responsible_user_id?person(d.first_aid_responsible_user_id):'no Department default set';
    return `<option value="">Use Department default (${esc(defaultName)})</option>`+members.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.display_name||p.email)}</option>`).join('');
  }

  function typeGuidance(t){
    if(t==='EYE_WASH_STATION')return HSE_EYE_NOTE;
    if(t==='FIRST_AID_BOX')return HSE_BOX_NOTE;
    return 'Create the checklist needed for this First Aid equipment and tailor it to the site needs assessment.';
  }

  function showEquipmentEditor(id=''){
    if(!isManager())return;
    const x=id?equipment(id):null;
    const currentType=String(x?.equipment_type||'FIRST_AID_BOX').toUpperCase();
    const depId=x?.department_id||managedFirstAidDepartments()[0]?.id||firstAidEnabledDepartments()[0]?.id||'';
    const canManageCurrent=!id||managesDepartment(depId);
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent=x?`Edit ${typeLabel(currentType)}`:'Add First Aid Equipment';
    if(body)body.innerHTML=`
      <div class="section-card">
        <div class="row-between"><div><h3>${x?esc(x.name):'New First Aid equipment'}</h3><p class="muted">Keep the Department and exact physical location separate so staff know both who owns the check and where the equipment is kept.</p></div>${x?`<span class="badge complete">${esc(typeLabel(currentType))}</span>`:''}</div>
      </div>
      <div class="form-grid">
        <label>Equipment type
          <select id="faEquipmentTypeV21135">
            <option value="FIRST_AID_BOX" ${currentType==='FIRST_AID_BOX'?'selected':''}>First Aid Box</option>
            <option value="EYE_WASH_STATION" ${currentType==='EYE_WASH_STATION'?'selected':''}>Eye Wash Station</option>
            <option value="OTHER_FIRST_AID" ${currentType==='OTHER_FIRST_AID'?'selected':''}>Other First Aid Equipment</option>
          </select>
        </label>
        <label>Name<input id="faEquipmentNameV21135" value="${esc(x?.name||'')}" placeholder="e.g. Workshop Eye Wash Station"></label>
        <label>Department<select id="faEquipmentDepartmentV21135">${departmentOptions(depId)}</select></label>
        <label>Specific location / where kept<input id="faEquipmentLocationV21135" value="${esc(x?.location||'')}" placeholder="e.g. Maintenance workshop – wall beside sink"></label>
        <label>Responsible person override<select id="faEquipmentUserV21135">${responsibleOptions(depId,x?.default_user_id||'')}</select><span class="muted">Leave blank to use the Department First Aid responsible person. A specific equipment override takes priority.</span></label>
        <label class="full">Notes<textarea id="faEquipmentNotesV21135">${esc(x?.notes||'')}</textarea></label>
      </div>
      <div id="faEquipmentGuidanceV21135" class="hint-box"></div>
      ${x?.template_source?`<div class="meta"><span>Starter template: ${esc(x.template_source)}</span></div>`:''}
      ${!x?`<label class="check-row"><input id="faApplyDefaultV21135" type="checkbox" checked> Add the recommended starter checklist for this equipment type. You can edit quantities, add items or disable items afterwards.</label>`:''}
      ${x?`<div class="section-card"><div class="row-between"><div><h4>Editable checklist</h4><p class="muted">Personalise the starter list to your site and First Aid needs assessment.</p></div><div class="row"><button type="button" class="secondary" data-v21135-seed-defaults="${esc(x.id)}">Add missing recommended defaults</button><button type="button" class="secondary" data-first-aid-add-item="${esc(x.id)}">Add custom item</button></div></div><div class="card-list">${equipmentItems(x.id).map(i=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(i.item_name)}</strong><div class="meta"><span>Required ${Number(i.required_qty||0)}</span>${i.expiry_check?'<span>Expiry check</span>':''}${i.notes?`<span>${esc(i.notes)}</span>`:''}</div></div><button type="button" class="ghost" data-first-aid-edit-item="${esc(i.id)}">Edit</button></div></div>`).join('')||'<div class="empty">No checklist items yet.</div>'}</div></div>`:''}
      ${!canManageCurrent?'<div class="danger-note">You can view this equipment but only the responsible Department Manager, H&S Manager or Admin can save changes.</div>':''}
      <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-first-aid-save-box="${esc(id)}" ${canManageCurrent?'':'disabled'}>Save equipment</button></div>`;
    if(modal&&!modal.open)modal.showModal();

    const refreshGuidance=()=>{
      const type=$('faEquipmentTypeV21135')?.value||'FIRST_AID_BOX';
      const box=$('faEquipmentGuidanceV21135');if(box)box.innerHTML=`<strong>${type==='EYE_WASH_STATION'?'HSE eye-irrigation basis':'Checklist basis'}:</strong> ${esc(typeGuidance(type))}`;
      if(!x&&!clean($('faEquipmentNameV21135')?.value))$('faEquipmentNameV21135').placeholder=type==='EYE_WASH_STATION'?'e.g. Kitchen Eye Wash Station':type==='FIRST_AID_BOX'?'e.g. Reception First Aid Box':'e.g. First Aid Equipment';
    };
    const refreshPeople=()=>{
      const dep=$('faEquipmentDepartmentV21135')?.value||'';
      const sel=$('faEquipmentUserV21135');if(!sel)return;
      const keep=sel.value;sel.innerHTML=responsibleOptions(dep,keep);
      if(![...sel.options].some(o=>o.value===keep))sel.value='';
    };
    $('faEquipmentTypeV21135')?.addEventListener('change',refreshGuidance);
    $('faEquipmentDepartmentV21135')?.addEventListener('change',refreshPeople);
    refreshGuidance();refreshPeople();
  }

  async function saveEquipment(id=''){
    const type=$('faEquipmentTypeV21135')?.value||'FIRST_AID_BOX';
    const name=clean($('faEquipmentNameV21135')?.value);
    const dep=$('faEquipmentDepartmentV21135')?.value||'';
    const location=clean($('faEquipmentLocationV21135')?.value);
    const user=$('faEquipmentUserV21135')?.value||null;
    const notes=clean($('faEquipmentNotesV21135')?.value)||null;
    const applyDefault=!id&&!!$('faApplyDefaultV21135')?.checked;
    if(!name)return api.toast?.('Enter an equipment name.');
    if(!dep)return api.toast?.('Choose the Department responsible for this equipment.');
    if(!location)return api.toast?.('Enter the specific location / where the equipment is kept.');
    const button=$('modalBody')?.querySelector('[data-first-aid-save-box]');if(button){button.disabled=true;button.textContent='Saving…'}
    const r=await sb.rpc('save_first_aid_equipment_v21135',{
      p_equipment_id:id||null,
      p_name:name,
      p_equipment_type:type,
      p_location:location,
      p_department_id:dep,
      p_default_user_id:user,
      p_notes:notes,
      p_apply_default_template:applyDefault
    });
    if(r.error){if(button){button.disabled=false;button.textContent='Save equipment'}return api.toast?.(r.error.message||'Could not save First Aid equipment.');}
    const savedId=r.data;
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.(`${typeLabel(type)} saved. Location and Department responsibility recorded.`);
    if(!id&&savedId)setTimeout(()=>showEquipmentEditor(savedId),80);
  }

  function showChecklistItemEditor(id='',equipmentId=''){
    const i=(state.firstAidBoxItems||[]).find(x=>x.id===id),eq=equipment(equipmentId||i?.box_id);if(!eq)return;
    if(!managesDepartment(eq.department_id))return api.toast?.('You are not authorised to edit this Department checklist.');
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(title)title.textContent=i?'Edit checklist item':'Add checklist item';
    if(body)body.innerHTML=`<div class="section-card"><strong>${esc(eq.name)}</strong><div class="meta"><span>${esc(typeLabel(eq.equipment_type))}</span><span>${esc(eq.location||'Location not set')}</span></div></div><div class="form-grid"><label>Item / check<input id="faItemNameV21135" value="${esc(i?.item_name||'')}"></label><label>Required quantity<input id="faItemQtyV21135" type="number" min="0" value="${Number(i?.required_qty??1)}"></label><label class="check-row"><input id="faItemExpiryV21135" type="checkbox" ${i?.expiry_check?'checked':''}> Check expiry date</label><label class="check-row"><input id="faItemActiveV21135" type="checkbox" ${i?.active===false?'':'checked'}> Active</label><label class="full">Checklist note / guidance<textarea id="faItemNotesV21135">${esc(i?.notes||'')}</textarea></label></div><div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-first-aid-save-item="${esc(id)}" data-first-aid-box-id="${esc(eq.id)}">Save item</button></div>`;
    if(modal&&!modal.open)modal.showModal();
  }

  async function saveChecklistItem(id,equipmentId){
    const name=clean($('faItemNameV21135')?.value),qty=Number($('faItemQtyV21135')?.value||0);
    if(!name)return api.toast?.('Item name is required.');
    if(!Number.isFinite(qty)||qty<0)return api.toast?.('Required quantity must be zero or more.');
    const r=await sb.rpc('save_first_aid_equipment_item_v21135',{
      p_item_id:id||null,
      p_equipment_id:equipmentId,
      p_item_name:name,
      p_required_qty:qty,
      p_expiry_check:!!$('faItemExpiryV21135')?.checked,
      p_active:!!$('faItemActiveV21135')?.checked,
      p_notes:clean($('faItemNotesV21135')?.value)||null
    });
    if(r.error)return api.toast?.(r.error.message||'Could not save checklist item.');
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.('First Aid equipment checklist updated.');
    setTimeout(()=>showEquipmentEditor(equipmentId),80);
  }

  async function seedDefaults(id,button){
    const eq=equipment(id);if(!eq)return;
    if(button){button.disabled=true;button.textContent='Adding…'}
    const r=await sb.rpc('seed_first_aid_equipment_defaults_v21135',{p_equipment_id:id,p_only_missing:true});
    if(r.error){if(button){button.disabled=false;button.textContent='Add missing recommended defaults'}return api.toast?.(r.error.message||'Could not add defaults.');}
    try{$('modal')?.close()}catch(_e){}
    await api.refresh?.(`${Number(r.data||0)} recommended checklist item${Number(r.data||0)===1?'':'s'} added. Existing custom items were kept.`);
    setTimeout(()=>showEquipmentEditor(id),80);
  }

  function decorateManagerArea(){
    updateModuleHeading();
    const area=$('firstAidManagerArea');if(!area)return;
    const firstCard=area.querySelector('.section-card');
    if(firstCard){
      const h=firstCard.querySelector('h3');if(h)h.textContent='First Aid equipment';
      const p=firstCard.querySelector('p.muted');if(p)p.textContent='Each First Aid Box or Eye Wash Station belongs to a Department and must record the specific location where it is kept. Checklists and quantities are editable.';
      const add=firstCard.querySelector('[data-first-aid-new-box]');if(add){add.textContent='Add First Aid equipment';add.disabled=managedFirstAidDepartments().length===0;add.title=add.disabled?'Enable First Aid for a Department and assign management responsibility first.':'';}
      firstCard.querySelectorAll('[data-first-aid-edit-box]').forEach(btn=>{
        const eq=equipment(btn.dataset.firstAidEditBox),card=btn.closest('.item-card');if(!eq||!card)return;
        btn.textContent='Edit equipment & checklist';
        const meta=card.querySelector('.meta');
        if(meta&&!meta.querySelector('.fa-type-v21135')){
          const t=document.createElement('span');t.className='badge fa-type-v21135';t.textContent=typeLabel(eq.equipment_type);meta.prepend(t);
        }
        if(meta&&!meta.querySelector('.fa-location-v21135')){
          const loc=document.createElement('span');loc.className='fa-location-v21135';loc.innerHTML=`<strong>Location:</strong> ${esc(eq.location||'Location required')}`;meta.appendChild(loc);
        }
      });
    }
    const issuesCard=[...area.querySelectorAll('.section-card')].find(c=>/Needs to be Ordered/.test(c.textContent||''));
    if(issuesCard){const p=issuesCard.querySelector('p.muted');if(p)p.textContent='PPE and First Aid equipment failures stay actionable until received and replenished. Eye wash expiry/shortage issues use the same action list.';}
  }

  function decorateUserChecks(){
    updateModuleHeading();
    const list=$('firstAidList');if(!list)return;
    for(const card of list.querySelectorAll('.item-card')){
      const button=card.querySelector('[data-first-aid-check],[data-first-aid-view]');
      const checkId=button?.dataset.firstAidCheck||button?.dataset.firstAidView;if(!checkId)continue;
      const check=(state.firstAidChecks||[]).find(x=>x.id===checkId),eq=equipment(check?.box_id);if(!eq)continue;
      const meta=card.querySelector('.meta');
      if(meta&&!meta.querySelector('.fa-user-type-v21135')){const b=document.createElement('span');b.className='badge fa-user-type-v21135';b.textContent=typeLabel(eq.equipment_type);meta.prepend(b)}
    }
  }

  function decorateCheckModal(checkId){
    const c=(state.firstAidChecks||[]).find(x=>x.id===checkId),eq=equipment(c?.box_id),body=$('modalBody');if(!eq||!body)return;
    if($('modalTitle'))$('modalTitle').textContent=`Monthly ${typeLabel(eq.equipment_type)} Check`;
    if(eq.equipment_type==='EYE_WASH_STATION'&&!body.querySelector('.hse-eye-note-v21135')){
      const n=document.createElement('div');n.className='hint-box hse-eye-note-v21135';n.innerHTML=`<strong>HSE basis:</strong> ${esc(HSE_EYE_NOTE)} <strong>Site location:</strong> ${esc(eq.location||'Not recorded')}.`;
      body.insertAdjacentElement('afterbegin',n);
    }
  }

  function installWrappers(){
    const newShowEquipment=showEquipmentEditor,newSaveEquipment=saveEquipment,newShowItem=showChecklistItemEditor,newSaveItem=saveChecklistItem;
    try{window.showFirstAidBoxEditor=newShowEquipment;showFirstAidBoxEditor=newShowEquipment}catch(_e){}
    try{window.saveFirstAidBox=newSaveEquipment;saveFirstAidBox=newSaveEquipment}catch(_e){}
    try{window.showFirstAidItemEditor=newShowItem;showFirstAidItemEditor=newShowItem}catch(_e){}
    try{window.saveFirstAidItem=newSaveItem;saveFirstAidItem=newSaveItem}catch(_e){}

    const oldRender=window.renderFirstAid;
    if(typeof oldRender==='function'){
      const wrapped=function(){const out=oldRender.apply(this,arguments);setTimeout(()=>{decorateManagerArea();decorateUserChecks()},0);return out};
      try{window.renderFirstAid=wrapped;renderFirstAid=wrapped}catch(_e){}
    }

    const oldCheck=window.showFirstAidCheck;
    if(typeof oldCheck==='function'){
      const wrapped=function(id){const out=oldCheck.apply(this,arguments);setTimeout(()=>decorateCheckModal(id),0);return out};
      try{window.showFirstAidCheck=wrapped;showFirstAidCheck=wrapped}catch(_e){}
    }

    const oldView=window.viewFirstAidCheck;
    if(typeof oldView==='function'){
      const wrapped=function(id){const out=oldView.apply(this,arguments);setTimeout(()=>{const c=(state.firstAidChecks||[]).find(x=>x.id===id),eq=equipment(c?.box_id);if(eq&&$('modalTitle'))$('modalTitle').textContent=`${typeLabel(eq.equipment_type)} Check Record`;},0);return out};
      try{window.viewFirstAidCheck=wrapped;viewFirstAidCheck=wrapped}catch(_e){}
    }
  }

  function installEvents(){
    document.addEventListener('click',e=>{
      const seed=e.target.closest?.('[data-v21135-seed-defaults]');if(seed){e.preventDefault();seedDefaults(seed.dataset.v21135SeedDefaults,seed);return}
      if(e.target.closest?.('[data-view="firstAid"]'))setTimeout(()=>{decorateManagerArea();decorateUserChecks()},140);
    },true);
  }

  function installStyles(){
    const s=document.createElement('style');s.id='firstAidEquipmentStylesV21135';s.textContent=`
      #firstAidView .fa-location-v21135{flex-basis:100%}
      #modalBody #faEquipmentGuidanceV21135{margin-top:10px}
      @media(max-width:720px){#modalBody [data-v21135-seed-defaults]{width:100%}}
    `;document.head.appendChild(s);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    installStyles();installWrappers();installEvents();
    [120,420,900].forEach(ms=>setTimeout(()=>{decorateManagerArea();decorateUserChecks()},ms));
    window.SafetyFirstAidEquipmentV21135={showEquipmentEditor,decorateManagerArea,decorateUserChecks};
  }
  boot();
})();
