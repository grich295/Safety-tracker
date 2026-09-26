/* Safety Tracker v2.11.36 CLEAN
   Makes Eye Wash Station a first-class default option in First Aid Equipment.
   - Shows separate Add First Aid Box and Add Eye Wash Station buttons.
   - Eye Wash opens preselected with the recommended starter checklist enabled.
   - Department and exact physical location remain required before save.
*/
'use strict';
(function(){
  if(window.__SAFETY_FIRST_AID_DEFAULT_TYPES_V21136)return;
  window.__SAFETY_FIRST_AID_DEFAULT_TYPES_V21136=true;

  let api,state;
  const $=id=>document.getElementById(id);

  function firstAidEnabledDepartments(){
    return (state?.departments||[]).filter(d=>d.active!==false&&d.first_aid_enabled===true);
  }

  function openNew(type){
    const fa=window.SafetyFirstAidEquipmentV21135;
    if(!fa?.showEquipmentEditor)return api?.toast?.('First Aid Equipment is still loading. Try again.');
    fa.showEquipmentEditor('');
    setTimeout(()=>{
      const typeSel=$('faEquipmentTypeV21135');
      if(typeSel){
        typeSel.value=type;
        typeSel.dispatchEvent(new Event('change',{bubbles:true}));
      }
      const name=$('faEquipmentNameV21135');
      if(name&&!String(name.value||'').trim()){
        name.value=type==='EYE_WASH_STATION'?'Eye Wash Station':'First Aid Box';
      }
      const starter=$('faApplyDefaultV21135');
      if(starter)starter.checked=true;
      const loc=$('faEquipmentLocationV21135');
      if(loc)loc.focus();
    },20);
  }

  function decorate(){
    const area=$('firstAidManagerArea');if(!area)return;
    const firstCard=area.querySelector('.section-card');if(!firstCard)return;
    const row=firstCard.querySelector('.row-between');if(!row)return;
    const old=row.querySelector('[data-first-aid-new-box]');
    if(!old)return;

    let actions=old.closest('.row');
    if(!actions){
      actions=document.createElement('div');
      actions.className='row';
      old.insertAdjacentElement('beforebegin',actions);
      actions.appendChild(old);
    }

    old.textContent='Add First Aid Box';
    old.removeAttribute('data-first-aid-new-box');
    old.dataset.v21136AddFirstAidBox='';
    old.className='primary';

    if(!actions.querySelector('[data-v21136-add-eyewash]')){
      const eye=document.createElement('button');
      eye.type='button';
      eye.className='secondary';
      eye.dataset.v21136AddEyewash='';
      eye.textContent='Add Eye Wash Station';
      actions.appendChild(eye);
    }

    const enabled=firstAidEnabledDepartments().length>0;
    for(const b of actions.querySelectorAll('[data-v21136-add-first-aid-box],[data-v21136-add-eyewash]')){
      b.disabled=!enabled;
      b.title=enabled?'':'Enable First Aid for a Department first.';
    }

    let note=firstCard.querySelector('.default-equipment-note-v21136');
    if(!note){
      note=document.createElement('div');
      note.className='hint-box default-equipment-note-v21136';
      note.innerHTML='<strong>Default equipment types:</strong> First Aid Box and Eye Wash Station. Eye Wash starts with the recommended 1 litre total sealed sterile-water/saline supply; you can personalise the checklist after saving. Exact location is required.';
      row.insertAdjacentElement('afterend',note);
    }
  }

  function install(){
    document.addEventListener('click',e=>{
      const box=e.target.closest?.('[data-v21136-add-first-aid-box]');
      if(box){e.preventDefault();e.stopImmediatePropagation();openNew('FIRST_AID_BOX');return}
      const eye=e.target.closest?.('[data-v21136-add-eyewash]');
      if(eye){e.preventDefault();e.stopImmediatePropagation();openNew('EYE_WASH_STATION');return}
      if(e.target.closest?.('[data-view="firstAid"]'))setTimeout(decorate,180);
    },true);
    [150,450,900].forEach(ms=>setTimeout(decorate,ms));
    window.SafetyFirstAidDefaultTypesV21136={decorate,openNew};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!window.SafetyFirstAidEquipmentV21135){setTimeout(boot,120);return}
    state=api.state;
    install();
  }
  boot();
})();

/* Safety Tracker v2.11.68 CLEAN
   Simple Management setup hub.
   - Replaces the mixed People & Positions Management tile for Admin with three clear tiles:
     Departments, Positions and Users.
   - Departments and Positions have dedicated create/edit/archive screens.
   - Users is the single person-setup route: site, role, departments, positions,
     HOD, selected Operational Overseer departments, instructor permission, groups
     and a live review summary before save.
   - New users retain the v2.11.66 rule: current Safety site becomes Home Site by default.
   - Position department is a reporting/suggestion link only for users configured through
     the explicit person setup; changing position does not silently replace Main Department.
*/
'use strict';
(function(){
  if(window.__SAFETY_SETUP_HUB_V21168)return;
  window.__SAFETY_SETUP_HUB_V21168=true;

  let api,state,sb;
  let departments=[],positions=[],profiles=[],userDepartments=[],userPositions=[];
  let responsibilities=[],overseers=[],moduleAccess=[],siteAccess=[],sites=[];
  let groups=[],groupMembers=[],currentSiteId=null;
  let loading=false,decorateQueued=false;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const toast=m=>{try{api?.toast?.(m)}catch(_e){console.log(m)}};
  const role=()=>String(state?.profile?.role||'').toLowerCase();
  const isAdmin=()=>role()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const profile=id=>profiles.find(x=>x.id===id)||null;
  const personName=id=>{const p=profile(id);return p?.display_name||p?.email||p?.login_username||'User'};
  const departmentName=id=>departments.find(x=>x.id===id)?.name||'No department';
  const positionName=id=>positions.find(x=>x.id===id)?.name||'No position';
  const siteName=id=>sites.find(x=>x.id===id)?.name||'No site';
  const groupName=id=>groups.find(x=>x.id===id)?.name||'Group';
  const activeDepartments=()=>departments.filter(x=>x.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activePositions=()=>positions.filter(x=>x.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activeGroups=()=>groups.filter(x=>x.active!==false&&(!x.site_id||!currentSiteId||x.site_id===currentSiteId)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activeSites=()=>sites.filter(x=>x.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

  function mainDepartment(userId){return userDepartments.find(x=>x.user_id===userId&&x.is_primary)?.department_id||userDepartments.find(x=>x.user_id===userId)?.department_id||null}
  function additionalDepartments(userId){return userDepartments.filter(x=>x.user_id===userId&&!x.is_primary).map(x=>x.department_id)}
  function mainPosition(userId){return userPositions.find(x=>x.user_id===userId&&x.active!==false&&x.is_primary)?.position_id||userPositions.find(x=>x.user_id===userId&&x.active!==false)?.position_id||null}
  function additionalPositions(userId){return userPositions.filter(x=>x.user_id===userId&&x.active!==false&&!x.is_primary).map(x=>x.position_id)}
  function hodDepartment(userId){return responsibilities.find(x=>x.user_id===userId&&x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER')?.department_id||null}
  function overseerDepartments(userId){return overseers.filter(x=>x.user_id===userId&&x.active!==false).map(x=>x.department_id)}
  function moduleFor(userId){return moduleAccess.find(x=>x.user_id===userId&&x.module_key==='safety')||null}
  function siteRows(userId){return siteAccess.filter(x=>x.user_id===userId&&x.module_key==='safety'&&x.enabled!==false)}
  function directGroupIds(userId){return groupMembers.filter(x=>x.member_type==='USER'&&x.user_id===userId&&x.active!==false).map(x=>x.group_id)}
  function userCountForDepartment(id){return new Set(userDepartments.filter(x=>x.department_id===id).map(x=>x.user_id)).size}
  function userCountForPosition(id){return new Set(userPositions.filter(x=>x.position_id===id&&x.active!==false).map(x=>x.user_id)).size}
  function positionCountForDepartment(id){return activePositions().filter(x=>x.primary_department_id===id).length}

  async function loadData(force=false){
    if(loading&&!force)return;
    loading=true;
    try{
      const [d,p,pr,ud,up,r,o,ma,sa,s,g,gm,cur]=await Promise.all([
        sb.from('departments').select('*').order('name'),
        sb.from('safety_positions_v21069').select('*').order('name'),
        sb.from('profiles').select('*').order('display_name'),
        sb.from('user_departments').select('*'),
        sb.from('safety_user_positions_v21069').select('*'),
        sb.from('safety_responsibilities_v21069').select('*'),
        sb.from('safety_operational_overseers_v21166').select('*'),
        sb.from('app_module_access_v21137').select('*').eq('module_key','safety'),
        sb.from('app_site_access_v21137').select('*').eq('module_key','safety'),
        sb.from('organisation_sites_v21137').select('*').order('name'),
        sb.from('safety_groups_v21155').select('*').order('name'),
        sb.from('safety_group_members_v21155').select('*').eq('active',true),
        sb.rpc('current_safety_site_v21138')
      ]);
      if(!d.error)departments=d.data||[];
      if(!p.error)positions=p.data||[];
      if(!pr.error)profiles=pr.data||[];
      if(!ud.error)userDepartments=ud.data||[];
      if(!up.error)userPositions=up.data||[];
      if(!r.error)responsibilities=r.data||[];
      if(!o.error)overseers=o.data||[];
      if(!ma.error)moduleAccess=ma.data||[];
      if(!sa.error)siteAccess=sa.data||[];
      if(!s.error)sites=s.data||[];
      if(!g.error)groups=g.data||[];
      if(!gm.error)groupMembers=gm.data||[];
      if(!cur.error)currentSiteId=cur.data||currentSiteId;
    }finally{loading=false}
  }

  function managementGrid(){return document.querySelector('#managementHomeV21111 .management-tile-grid-v21111')||document.querySelector('#managementHomeV21079 .management-tile-grid-v21079')}
  function tileHtml(kind,title,desc,icon,legacy){
    const cls=legacy?'management-tile-v21079':'management-tile-v21111';
    const iconCls=legacy?'management-tile-icon-v21079':'management-tile-icon-v21111';
    return `<button type="button" class="${cls} v21168-setup-tile" data-v21168-setup="${kind}"><span class="${iconCls}" aria-hidden="true">${icon}</span><strong>${title}</strong><span>${desc}</span></button>`;
  }
  function decorateManagementTiles(){
    if(!isAdmin())return;
    const grid=managementGrid();if(!grid)return;
    grid.querySelectorAll('[data-management-stable-key="people"],[data-management-tile-key="people"],.v21168-setup-tile').forEach(x=>x.remove());
    const legacy=grid.classList.contains('management-tile-grid-v21079');
    const html=[
      tileHtml('departments','Departments','Create departments and see the official HOD, Operational Overseers, positions and people.', 'D',legacy),
      tileHtml('positions','Positions','Create job titles and their suggested Department. Position does not silently move a user.', 'P',legacy),
      tileHtml('users','Users','Create users and set everything they need in one place: sites, role, Department, Position, responsibilities and Groups.', 'U',legacy)
    ].join('');
    const calendar=grid.querySelector('[data-management-stable-key="calendar"],[data-management-tile-key="calendar"]');
    if(calendar)calendar.insertAdjacentHTML('beforebegin',html);else grid.insertAdjacentHTML('beforeend',html);
    const admin=grid.querySelector('[data-management-stable-key="admin"],[data-management-tile-key="admin"]');
    const text=admin?.querySelector('span:last-child');if(text)text.textContent='Other Safety Tracker settings and system controls.';
  }
  function queueDecorate(){if(decorateQueued)return;decorateQueued=true;setTimeout(()=>{decorateQueued=false;decorateManagementTiles()},60)}

  function reportsView(){return $('reportsView')}
  function panel(){
    const view=reportsView();if(!view)return null;
    let p=$('managementSetupV21168');
    if(!p){p=document.createElement('section');p.id='managementSetupV21168';p.className='management-setup-v21168';view.insertAdjacentElement('afterbegin',p)}
    return p;
  }
  function activateReports(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    reportsView()?.classList.add('active-view');
    document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='reports'));
  }
  function clearSetup(){const v=reportsView();if(v){v.classList.remove('v21168-setup-active');delete v.dataset.v21168Setup}const p=panel();if(p)p.innerHTML=''}
  function pushSetupHistory(kind){
    try{
      const st=history.state||{};
      if(st.v21168Setup===kind)return;
      history.pushState({...st,safetyTracker:true,view:'reports',modal:false,guard:false,managementDetailV21167:`setup-${kind}`,v21168Setup:kind},'',location.href);
    }catch(_e){}
  }
  async function openSetup(kind,{push=true}={}){
    if(!isAdmin())return toast('Admin access required.');
    await loadData(true);
    activateReports();
    const v=reportsView();if(!v)return;
    v.classList.remove('management-home-active-v21111','management-home-active-v21079');
    v.classList.add('v21168-setup-active');v.dataset.v21168Setup=kind;
    renderSetup(kind);
    if(push)pushSetupHistory(kind);
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_e){}
  }
  function backManagement(){
    clearSetup();
    window.SafetyManagementNavigationV21167?.home?.();
  }

  function setupHeading(title,desc,button=''){
    return `<div class="page-heading"><div><h2>${esc(title)}</h2><p class="muted">${esc(desc)}</p></div>${button}</div><button class="secondary v21168-back" type="button" data-v21168-back>← Management</button>`;
  }
  function renderSetup(kind){
    if(kind==='departments')renderDepartments();
    else if(kind==='positions')renderPositions();
    else renderUsers();
  }

  function renderDepartments(){
    const p=panel();if(!p)return;
    const rows=departments.slice().sort((a,b)=>(a.active===false)-(b.active===false)||String(a.name||'').localeCompare(String(b.name||'')));
    p.innerHTML=setupHeading('Departments','Create and maintain Departments. HOD and Operational Overseer assignments are made from Users.',`<button class="primary" type="button" data-v21168-new-department>Create Department</button>`)+
      `<div class="stats-grid"><div class="stat-card"><strong>${rows.filter(x=>x.active!==false).length}</strong><span>Active Departments</span></div><div class="stat-card"><strong>${profiles.filter(x=>x.active!==false&&x.report_only!==true).length}</strong><span>Active users</span></div></div>`+
      `<div class="card-list v21168-list">${rows.map(d=>{const hod=responsibilities.find(r=>r.active!==false&&r.responsibility_type==='DEPARTMENT_MANAGER'&&r.department_id===d.id);const ovs=[...new Set(overseers.filter(o=>o.active!==false&&o.department_id===d.id).map(o=>personName(o.user_id)))];return `<div class="item-card ${d.active===false?'v21168-inactive':''}"><div class="row-between"><div><strong>${esc(d.name)}</strong>${d.active===false?'<span class="badge neutral">Archived</span>':''}<div class="meta"><span>${userCountForDepartment(d.id)} people</span><span>${positionCountForDepartment(d.id)} positions</span></div><div class="v21168-responsibility-line"><span><b>HOD:</b> ${hod?esc(personName(hod.user_id)):'Not assigned'}</span><span><b>Operational oversight:</b> ${ovs.length?esc(ovs.join(', ')):'None'}</span></div></div><div class="actions"><button class="secondary" type="button" data-v21168-edit-department="${esc(d.id)}">Edit</button><button class="ghost" type="button" data-v21168-toggle-department="${esc(d.id)}" data-active="${d.active!==false?'1':'0'}">${d.active!==false?'Archive':'Restore'}</button></div></div></div>`}).join('')||'<div class="empty">No Departments yet.</div>'}</div>`;
  }

  function renderPositions(){
    const p=panel();if(!p)return;
    const rows=positions.slice().sort((a,b)=>(a.active===false)-(b.active===false)||String(a.name||'').localeCompare(String(b.name||'')));
    p.innerHTML=setupHeading('Positions','Create job titles. The Position Department is a suggestion/reporting link; the user\'s Main Department is selected separately.',`<button class="primary" type="button" data-v21168-new-position>Create Position</button>`)+
      `<div class="hint-box"><strong>Simple rule:</strong> Department answers “where they belong”; Position answers “what their job is”. Changing a Position does not silently change a user who has an explicit Main Department.</div>`+
      `<div class="card-list v21168-list">${rows.map(x=>`<div class="item-card ${x.active===false?'v21168-inactive':''}"><div class="row-between"><div><strong>${esc(x.name)}</strong>${x.active===false?'<span class="badge neutral">Archived</span>':''}<div class="meta"><span>${x.primary_department_id?`Suggested Department: ${esc(departmentName(x.primary_department_id))}`:'No suggested Department'}</span><span>${userCountForPosition(x.id)} people</span></div>${x.description?`<p class="muted">${esc(x.description)}</p>`:''}</div><div class="actions"><button class="secondary" type="button" data-v21168-edit-position="${esc(x.id)}">Edit</button><button class="ghost" type="button" data-v21168-toggle-position="${esc(x.id)}" data-active="${x.active!==false?'1':'0'}">${x.active!==false?'Archive':'Restore'}</button></div></div></div>`).join('')||'<div class="empty">No Positions yet.</div>'}</div>`;
  }

  function userMatchesSite(userId,siteFilter){if(!siteFilter||siteFilter==='ALL')return true;return siteAccess.some(x=>x.user_id===userId&&x.module_key==='safety'&&x.site_id===siteFilter&&x.enabled!==false)}
  function renderUsers(){
    const p=panel();if(!p)return;
    const existingFilter=$('v21168UserSiteFilter')?.value||currentSiteId||'ALL';
    const q=clean($('v21168UserSearch')?.value).toLowerCase();
    const rows=profiles.filter(x=>x.active!==false&&moduleFor(x.id)?.enabled!==false&&userMatchesSite(x.id,existingFilter)).filter(x=>!q||`${x.display_name||''} ${x.email||''} ${x.login_username||''} ${departmentName(mainDepartment(x.id))} ${positionName(mainPosition(x.id))}`.toLowerCase().includes(q)).sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
    const siteOpts=`<option value="ALL" ${existingFilter==='ALL'?'selected':''}>All sites</option>`+activeSites().map(s=>`<option value="${esc(s.id)}" ${existingFilter===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
    p.innerHTML=setupHeading('Users','Create a user or open one person to set everything they need in one place.',`<button class="primary" type="button" data-v21168-new-user>Create User</button>`)+
      `<div class="hint-box"><strong>User setup:</strong> Account & Site → Department → Position → Responsibilities & Permissions → Groups → Review & Save. New users default to the current site.</div>`+
      `<div class="form-grid v21168-user-filters"><label>Site<select id="v21168UserSiteFilter">${siteOpts}</select></label><label>Search<input id="v21168UserSearch" value="${esc(q)}" placeholder="Name, Department or Position"></label></div>`+
      `<div class="card-list v21168-list" id="v21168UserList">${rows.map(u=>{const dep=mainDepartment(u.id),pos=mainPosition(u.id),hod=hodDepartment(u.id),ovs=overseerDepartments(u.id),ma=moduleFor(u.id)||{},home=ma.home_site_id||siteRows(u.id).find(x=>x.is_home)?.site_id;const gs=directGroupIds(u.id);return `<div class="item-card"><div class="row-between"><div><strong>${esc(u.display_name||u.email||u.login_username||'User')}</strong><div class="meta"><span>${esc(ma.role_override||u.role||'user')}</span><span>${home?esc(siteName(home)):'No Home Site'}</span></div><div class="v21168-user-setup-summary">${dep?`<span>Main Department: <b>${esc(departmentName(dep))}</b></span>`:'<span class="badge due">No Main Department</span>'}${pos?`<span>Position: <b>${esc(positionName(pos))}</b></span>`:'<span class="badge due">No Main Position</span>'}${hod?'<span class="badge complete">Official HOD</span>':''}${ovs.length?`<span>Oversees: ${esc(ovs.map(departmentName).join(', '))}</span>`:''}${gs.length?`<span>Direct Groups: ${esc(gs.map(groupName).join(', '))}</span>`:''}</div></div><button class="secondary" type="button" data-v21168-edit-user="${esc(u.id)}">Edit setup</button></div></div>`}).join('')||'<div class="empty">No matching users.</div>'}</div>`;
    $('v21168UserSiteFilter')?.addEventListener('change',renderUsers);
    $('v21168UserSearch')?.addEventListener('input',renderUsers);
  }

  function openModal(title,html){const m=$('modal'),t=$('modalTitle'),b=$('modalBody');if(!m||!b)return;if(t)t.textContent=title;b.innerHTML=html;if(!m.open)m.showModal()}
  function closeModalSafe(){const m=$('modal');if(m?.open)m.close();try{if(history.state?.modal)history.back()}catch(_e){}}

  function openDepartmentEditor(id=''){
    const d=id?departments.find(x=>x.id===id):null;
    openModal(d?'Edit Department':'Create Department',`<div class="section-card"><label>Department name<input id="v21168DepartmentName" value="${esc(d?.name||'')}" maxlength="120"></label><p class="muted">The official HOD and any Operational Overseers are assigned from the Users setup so responsibility stays attached to a named person.</p></div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21168-save-department="${esc(id)}">${d?'Save Department':'Create Department'}</button></div>`);
    setTimeout(()=>$('v21168DepartmentName')?.focus(),30);
  }
  async function saveDepartment(id,btn){const name=clean($('v21168DepartmentName')?.value);if(!name)return toast('Enter a Department name.');btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';try{const r=await sb.rpc('save_department_v230',{p_department_id:id||null,p_name:name});if(r.error)throw r.error;closeModalSafe();await loadData(true);renderDepartments();toast(id?'Department updated.':'Department created.')}catch(e){btn.disabled=false;btn.textContent=old;toast(e.message||'Could not save Department.')}}
  async function toggleDepartment(id,active){const action=active?'archive':'restore';if(active&&!confirm(`Archive ${departmentName(id)}? Existing history is retained.`))return;const r=await sb.rpc('set_department_active_v230',{p_department_id:id,p_active:!active});if(r.error)return toast(r.error.message);await loadData(true);renderDepartments();toast(`Department ${action==='archive'?'archived':'restored'}.`)}

  function openPositionEditor(id=''){
    const x=id?positions.find(p=>p.id===id):null;
    const opts='<option value="">No suggested Department</option>'+activeDepartments().map(d=>`<option value="${esc(d.id)}" ${x?.primary_department_id===d.id?'selected':''}>${esc(d.name)}</option>`).join('');
    openModal(x?'Edit Position':'Create Position',`<div class="section-card"><div class="form-grid"><label>Position / job title<input id="v21168PositionName" value="${esc(x?.name||'')}" maxlength="160"></label><label>Suggested Department<select id="v21168PositionDepartment">${opts}</select></label></div><label>Description<textarea id="v21168PositionDescription" rows="3">${esc(x?.description||'')}</textarea></label><div class="hint-box"><strong>Important:</strong> this Department is a suggestion/reporting link for the Position. A user's Main Department is selected directly in User setup and remains independently editable.</div></div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21168-save-position="${esc(id)}">${x?'Save Position':'Create Position'}</button></div>`);
    setTimeout(()=>$('v21168PositionName')?.focus(),30);
  }
  async function savePosition(id,btn){const name=clean($('v21168PositionName')?.value),description=clean($('v21168PositionDescription')?.value),dep=$('v21168PositionDepartment')?.value||null;if(!name)return toast('Enter a Position name.');btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';try{const r=await sb.rpc('save_safety_position_v21069',{p_position_id:id||null,p_name:name,p_description:description||null,p_department_ids:dep?[dep]:[],p_primary_department_id:dep});if(r.error)throw r.error;closeModalSafe();await loadData(true);renderPositions();toast(id?'Position updated.':'Position created.')}catch(e){btn.disabled=false;btn.textContent=old;toast(e.message||'Could not save Position.')}}
  async function togglePosition(id,active){const x=positions.find(p=>p.id===id);if(active&&!confirm(`Archive ${x?.name||'this Position'}? Existing user history is retained.`))return;const r=await sb.rpc('set_safety_position_active_v21069',{p_position_id:id,p_active:!active});if(r.error)return toast(r.error.message);await loadData(true);renderPositions();toast(`Position ${active?'archived':'restored'}.`)}

  function selectedValues(selector){return [...document.querySelectorAll(selector)].filter(x=>x.checked).map(x=>x.value)}
  function modalSelection(isNew){
    const prefix=isNew?'v21166New':'v21166';
    const roleVal=$(prefix+'Role')?.value||'user';
    const home=$(prefix+(isNew?'Home':'HomeSite'))?.value||null;
    const mainDep=$(prefix+(isNew?'Department':'MainDepartment'))?.value||null;
    const mainPos=$(prefix+(isNew?'Position':'MainPosition'))?.value||null;
    const depSel=isNew?'#v21166NewAdditionalDepartments input:checked':'.v21166-additional-department:checked';
    const posSel=isNew?'#v21166NewAdditionalPositions input:checked':'.v21166-additional-position:checked';
    const overOn=$(prefix+'Overseer')?.checked&&roleVal!=='viewer';
    const overSel=isNew?'#v21166NewOverseerDepartments input:checked':'.v21166-overseer-department:checked';
    const sitesSel=isNew?'.v21166-new-site:checked':'.v21166-site:checked';
    return {
      role:roleVal,home,mainDep,mainPos,
      additionalDeps:selectedValues(depSel),additionalPos:selectedValues(posSel),
      hod:roleVal!=='viewer'&&!!$(prefix+'Hod')?.checked,
      overseer:overOn?selectedValues(overSel):[],
      trainer:roleVal!=='viewer'&&!!$(prefix+'Trainer')?.checked,
      sites:selectedValues(sitesSel),
      directGroups:roleVal==='viewer'?[]:selectedValues('.v21168-direct-group:checked')
    };
  }
  function inheritedGroupReason(groupId,s){
    const deps=new Set([s.mainDep,...s.additionalDeps].filter(Boolean));
    const pos=new Set([s.mainPos,...s.additionalPos].filter(Boolean));
    const matches=groupMembers.filter(m=>m.group_id===groupId&&m.active!==false&&((m.member_type==='DEPARTMENT'&&deps.has(m.department_id))||(m.member_type==='POSITION'&&pos.has(m.position_id))));
    if(!matches.length)return '';
    const bits=[];
    for(const m of matches){if(m.member_type==='DEPARTMENT')bits.push(departmentName(m.department_id));if(m.member_type==='POSITION')bits.push(positionName(m.position_id))}
    return [...new Set(bits)].join(', ');
  }
  function groupRows(selected=[],isNew=false){
    const set=new Set(selected);
    const s=modalSelection(isNew);
    return activeGroups().map(g=>{const reason=inheritedGroupReason(g.id,s);return `<label class="check-row v21168-group-row" data-group-id="${esc(g.id)}"><input class="v21168-direct-group" type="checkbox" value="${esc(g.id)}" ${set.has(g.id)?'checked':''}><span><strong>${esc(g.name)}</strong>${g.description?`<small>${esc(g.description)}</small>`:''}<small class="v21168-group-auto">${reason?`Automatic through ${esc(reason)} · direct tick optional`:'Direct assignment'}</small></span></label>`}).join('')||'<span class="muted">No active Groups for this site.</span>';
  }
  function updateGroupReasons(isNew){const s=modalSelection(isNew);document.querySelectorAll('.v21168-group-row').forEach(row=>{const reason=inheritedGroupReason(row.dataset.groupId,s),small=row.querySelector('.v21168-group-auto');if(small)small.textContent=reason?`Automatic through ${reason} · direct tick optional`:'Direct assignment'})}
  function updatePersonSummary(isNew){
    const box=$('v21168PersonSummary');if(!box)return;
    const s=modalSelection(isNew);
    const direct=s.directGroups.map(groupName);
    const automatic=activeGroups().filter(g=>inheritedGroupReason(g.id,s)).map(g=>g.name).filter(n=>!direct.includes(n));
    const home=siteName(s.home);
    const allDeps=[s.mainDep,...s.additionalDeps].filter(Boolean).map(departmentName);
    const allPos=[s.mainPos,...s.additionalPos].filter(Boolean).map(positionName);
    box.innerHTML=`<div class="v21168-review-grid"><div><small>Home Site</small><strong>${esc(home)}</strong></div><div><small>Role</small><strong>${esc(s.role)}</strong></div><div><small>Main Department</small><strong>${esc(s.mainDep?departmentName(s.mainDep):'Not set')}</strong></div><div><small>Main Position</small><strong>${esc(s.mainPos?positionName(s.mainPos):'Not set')}</strong></div></div><div class="v21168-review-lines"><span><b>Departments:</b> ${esc(allDeps.join(', ')||'None')}</span><span><b>Positions:</b> ${esc(allPos.join(', ')||'None')}</span><span><b>Responsibilities:</b> ${esc([s.hod?'Official HOD':'',s.overseer.length?`Operational Overseer — ${s.overseer.map(departmentName).join(', ')}`:'',s.trainer?'Instructor-led trainer':''].filter(Boolean).join(' · ')||'None')}</span><span><b>Direct Groups:</b> ${esc(direct.join(', ')||'None')}</span><span><b>Automatic Groups:</b> ${esc(automatic.join(', ')||'None')}</span><span><b>Site access:</b> ${esc([...new Set([s.home,...s.sites].filter(Boolean))].map(siteName).join(', ')||'None')}</span></div><div class="hint-box"><strong>Automatic assignments:</strong> document, training and Group audiences recalculate from the saved Department, Position and Group setup. You can edit every setting here later.</div>`;
    document.querySelectorAll('.v21168-direct-group').forEach(x=>x.disabled=s.role==='viewer');
  }
  function wireAugmentedModal(isNew){
    const body=$('modalBody');if(!body)return;
    const refresh=()=>{updateGroupReasons(isNew);updatePersonSummary(isNew)};
    body.addEventListener('change',refresh);
    body.addEventListener('input',e=>{if(e.target.matches('select,input[type="checkbox"],input[type="radio"]'))refresh()});
    refresh();
  }
  async function augmentPersonModal({userId=null,isNew=false}={}){
    await loadData(true);
    const actions=$('modalBody')?.querySelector('.actions:last-of-type');if(!actions)return;
    if($('v21168PersonGroups'))return;
    let direct=[];
    if(userId){const r=await sb.rpc('user_direct_groups_v21168',{p_user_id:userId});if(!r.error)direct=(r.data||[]).map(x=>x.group_id);else direct=directGroupIds(userId)}
    const group=document.createElement('div');group.id='v21168PersonGroups';group.className='section-card v21168-editor-section';group.innerHTML=`<h4>5 · Groups</h4><p class="muted">Tick Groups this person belongs to directly. Groups inherited automatically from their Department or Position are shown underneath.</p><div class="checkbox-list v21166-check-list">${groupRows(direct,isNew)}</div>`;actions.insertAdjacentElement('beforebegin',group);
    const review=document.createElement('div');review.id='v21168PersonReview';review.className='section-card v21168-editor-section';review.innerHTML='<h4>6 · Review & Save</h4><div id="v21168PersonSummary"></div>';actions.insertAdjacentElement('beforebegin',review);
    if(isNew){const b=actions.querySelector('[data-v21166-create-person-save]');if(b){b.removeAttribute('data-v21166-create-person-save');b.dataset.v21168CreateUser='1';b.textContent='Create User'}}
    else{const b=actions.querySelector('[data-v21166-save-person]');if(b){b.removeAttribute('data-v21166-save-person');b.dataset.v21168SaveUser=userId;b.textContent='Save User'}}
    wireAugmentedModal(isNew);
  }
  async function openEnhancedEdit(userId){
    try{
      const ctl=window.SafetyPeopleDepartmentScopeV21166;
      if(!ctl?.open){toast('User setup is still loading.');return false}
      await ctl.open(userId);
      const modal=$('modal');
      if(!modal?.open)throw new Error('The user editor did not open.');
      await augmentPersonModal({userId,isNew:false});
      if(!$('modalBody')?.querySelector('[data-v21168-save-user]'))throw new Error('The full user setup did not finish loading.');
      return true;
    }catch(e){
      console.error('Safety v2.11.69 Edit User',e);
      toast(e?.message||'Could not open User setup.');
      return false;
    }
  }
  async function openEnhancedCreate(){
    try{
      const ctl=window.SafetyPeopleDepartmentScopeV21166;
      if(!ctl?.create){toast('User setup is still loading.');return false}
      await ctl.create({});
      const modal=$('modal');
      if(!modal?.open)throw new Error('The new user editor did not open.');
      await augmentPersonModal({isNew:true});
      if(!$('modalBody')?.querySelector('[data-v21168-create-user]'))throw new Error('The full new-user setup did not finish loading.');
      return true;
    }catch(e){
      console.error('Safety v2.11.69 Create User',e);
      toast(e?.message||'Could not open new User setup.');
      return false;
    }
  }

  async function saveEnhancedExisting(userId,btn){
    const s=modalSelection(false),enabled=!!$('v21166Enabled')?.checked,view=$('v21166View')?.value||'user';
    if(s.hod&&!s.mainDep)return toast('Choose a Main Department before making this person HOD.');
    if(!s.mainPos&&s.additionalPos.length)return toast('Choose a Main Position before adding additional Positions.');
    const currentHod=s.mainDep?responsibilities.find(x=>x.department_id===s.mainDep&&x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER'):null;
    if(s.hod&&currentHod&&currentHod.user_id!==userId&&!confirm(`${personName(currentHod.user_id)} is currently HOD for ${departmentName(s.mainDep)}. Replace them?`))return;
    const selectedSites=new Set(s.sites);if(s.home)selectedSites.add(s.home);
    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    try{
      let r=await sb.rpc('set_safety_user_access_v21137',{p_user_id:userId,p_enabled:enabled,p_role:s.role,p_preferred_view:view,p_home_site_id:s.home});if(r.error)throw r.error;
      for(const site of activeSites()){
        const locked=site.created_by===userId;
        r=await sb.rpc('set_safety_site_access_v21137',{p_user_id:userId,p_site_id:site.id,p_enabled:enabled&&(selectedSites.has(site.id)||locked),p_role_override:s.role,p_is_home:enabled&&site.id===s.home});if(r.error)throw r.error;
      }
      r=await sb.rpc('save_person_structure_v21166',{p_user_id:userId,p_primary_department_id:s.mainDep,p_additional_department_ids:s.additionalDeps,p_primary_position_id:s.mainPos,p_additional_position_ids:s.additionalPos,p_is_hod:s.hod,p_operational_overseer_department_ids:s.overseer,p_can_carry_out_training:s.trainer});if(r.error)throw r.error;
      r=await sb.rpc('set_user_direct_groups_v21168',{p_user_id:userId,p_group_ids:s.role==='viewer'?[]:s.directGroups});if(r.error)throw r.error;
      closeModalSafe();await loadData(true);renderUsers();await window.SafetyPackTbtManagerV21164?.reload?.();await window.SafetyDocumentSetReviewV21165?.reload?.();toast('User setup updated.');
    }catch(e){btn.disabled=false;btn.textContent=old;toast(e.message||'Could not save User setup.')}
  }

  async function saveEnhancedNew(btn){
    const s=modalSelection(true),name=clean($('v21166NewName')?.value),email=clean($('v21166NewEmail')?.value),view=$('v21166NewView')?.value||'user';
    const method=document.querySelector('input[name="v21166LoginMethod"]:checked')?.value||(email?'email':'username');
    const username=clean($('v21166NewUsername')?.value),password=$('v21166NewPassword')?.value||'';
    if(!name)return toast('Enter the person\'s name.');
    if(method==='email'&&!email)return toast('Enter an email address or choose Username + temporary password.');
    if(method==='username'&&!username)return toast('Enter a username.');
    if(method==='username'&&!password)return toast('Enter a temporary password.');
    if(s.hod&&!s.mainDep)return toast('Choose a Main Department before making this person HOD.');
    if(!s.mainPos&&s.additionalPos.length)return toast('Choose a Main Position before adding additional Positions.');
    const selectedSites=new Set(s.sites);if(s.home)selectedSites.add(s.home);
    btn.disabled=true;const old=btn.textContent;btn.textContent='Creating…';
    try{
      const payload={action:'create',display_name:name,email:method==='email'?email:'',username:method==='username'?username:'',temporary_password:method==='username'?password:'',primary_role:s.role,apps:[{app:'safety',enabled:true,role:s.role,preferred_view:view,home_site_id:s.home||null}],redirect_to:`${location.origin}${location.pathname}?set-password=1`};
      const fr=await sb.functions.invoke('manage-user-access-v21137',{body:payload});if(fr.error)throw fr.error;if(fr.data?.error)throw new Error(fr.data.error);const userId=fr.data?.user_id;if(!userId)throw new Error('Safety account was not returned.');
      let home=s.home||currentSiteId;
      if(!home){const dr=await sb.rpc('default_new_safety_user_site_v21166',{p_user_id:userId,p_role:s.role,p_preferred_view:view});if(dr.error)throw dr.error;home=dr.data||null;currentSiteId=home||currentSiteId}
      if(home)selectedSites.add(home);
      let r=await sb.rpc('set_safety_user_access_v21137',{p_user_id:userId,p_enabled:true,p_role:s.role,p_preferred_view:view,p_home_site_id:home});if(r.error)throw r.error;
      for(const site of activeSites()){r=await sb.rpc('set_safety_site_access_v21137',{p_user_id:userId,p_site_id:site.id,p_enabled:selectedSites.has(site.id),p_role_override:s.role,p_is_home:site.id===home});if(r.error)throw r.error}
      r=await sb.rpc('save_person_structure_v21166',{p_user_id:userId,p_primary_department_id:s.mainDep,p_additional_department_ids:s.additionalDeps,p_primary_position_id:s.mainPos,p_additional_position_ids:s.additionalPos,p_is_hod:s.hod,p_operational_overseer_department_ids:s.overseer,p_can_carry_out_training:s.trainer});if(r.error)throw r.error;
      r=await sb.rpc('set_user_direct_groups_v21168',{p_user_id:userId,p_group_ids:s.role==='viewer'?[]:s.directGroups});if(r.error)throw r.error;
      await loadData(true);renderUsers();
      if(method==='username'){
        openModal('User created',`<div class="success-note"><strong>Account created for ${esc(name)}.</strong></div><div class="section-card"><p><strong>Username:</strong> ${esc(username)}</p><p><strong>Temporary password:</strong> ${esc(password)}</p><p><strong>Home Site:</strong> ${esc(siteName(home))}</p><p class="muted">Give the temporary password to the user securely. They should change it after signing in.</p></div><div class="actions"><button class="primary" type="button" data-close-modal>Done</button></div>`);
      }else{closeModalSafe();toast(`User created. Home Site: ${siteName(home)}.`)}
    }catch(e){btn.disabled=false;btn.textContent=old;toast(e.message||'Could not create User.')}
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      const setup=e.target.closest?.('[data-v21168-setup]');if(setup){e.preventDefault();e.stopImmediatePropagation();openSetup(setup.dataset.v21168Setup);return}
      if(e.target.closest?.('[data-v21168-back]')){e.preventDefault();e.stopImmediatePropagation();backManagement();return}
      if(e.target.closest?.('[data-v21168-new-department]')){e.preventDefault();openDepartmentEditor();return}
      const ed=e.target.closest?.('[data-v21168-edit-department]');if(ed){e.preventDefault();openDepartmentEditor(ed.dataset.v21168EditDepartment);return}
      const td=e.target.closest?.('[data-v21168-toggle-department]');if(td){e.preventDefault();toggleDepartment(td.dataset.v21168ToggleDepartment,td.dataset.active==='1');return}
      const sd=e.target.closest?.('[data-v21168-save-department]');if(sd){e.preventDefault();e.stopImmediatePropagation();saveDepartment(sd.dataset.v21168SaveDepartment,sd);return}
      if(e.target.closest?.('[data-v21168-new-position]')){e.preventDefault();openPositionEditor();return}
      const ep=e.target.closest?.('[data-v21168-edit-position]');if(ep){e.preventDefault();openPositionEditor(ep.dataset.v21168EditPosition);return}
      const tp=e.target.closest?.('[data-v21168-toggle-position]');if(tp){e.preventDefault();togglePosition(tp.dataset.v21168TogglePosition,tp.dataset.active==='1');return}
      const sp=e.target.closest?.('[data-v21168-save-position]');if(sp){e.preventDefault();e.stopImmediatePropagation();savePosition(sp.dataset.v21168SavePosition,sp);return}
      if(e.target.closest?.('[data-v21168-new-user]')){e.preventDefault();e.stopImmediatePropagation();void openEnhancedCreate();return}
      const eu=e.target.closest?.('[data-v21168-edit-user]');if(eu){e.preventDefault();e.stopImmediatePropagation();void openEnhancedEdit(eu.dataset.v21168EditUser);return}
      const su=e.target.closest?.('[data-v21168-save-user]');if(su){e.preventDefault();e.stopImmediatePropagation();saveEnhancedExisting(su.dataset.v21168SaveUser,su);return}
      const cu=e.target.closest?.('[data-v21168-create-user]');if(cu){e.preventDefault();e.stopImmediatePropagation();saveEnhancedNew(cu);return}
      if(e.target.closest?.('#mainNav button[data-view="reports"]'))setTimeout(queueDecorate,120);
    },true);

    window.addEventListener('popstate',()=>setTimeout(()=>{
      const st=history.state||{};
      if(st.v21168Setup&&isAdmin())openSetup(st.v21168Setup,{push:false});
      else if(reportsView()?.classList.contains('v21168-setup-active'))clearSetup();
      queueDecorate();
    },20));
    window.addEventListener('pageshow',()=>setTimeout(async()=>{await loadData(true);queueDecorate()},180));
  }

  function installStyles(){
    if($('setupHubStylesV21168'))return;
    const s=document.createElement('style');s.id='setupHubStylesV21168';s.textContent=`
      #reportsView.v21168-setup-active>*:not(#managementSetupV21168){display:none!important}
      #reportsView.v21168-setup-active>#managementSetupV21168{display:block!important}
      #managementSetupV21168{display:none}
      #reportsView.v21168-setup-active #managementSetupV21168{display:block}
      .v21168-back{margin:0 0 14px}
      .v21168-setup-tile{min-height:190px!important;padding:82px 20px 20px!important;justify-content:flex-start!important;gap:8px!important}
      .v21168-setup-tile>strong{display:block!important;margin:0!important;font-size:1.35rem!important;line-height:1.2!important}
      .v21168-setup-tile>span:last-child{display:block!important;line-height:1.45!important}
      .v21168-list .item-card{margin-bottom:10px}
      .v21168-inactive{opacity:.68}
      .v21168-responsibility-line,.v21168-user-setup-summary{display:flex;gap:8px 14px;flex-wrap:wrap;margin-top:7px;color:var(--muted,#a6b1c2)}
      .v21168-user-filters{margin:12px 0}
      .v21168-group-row span{display:flex;flex-direction:column;gap:2px}
      .v21168-group-row small{color:var(--muted,#94a3b8)}
      .v21168-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:8px 0}
      .v21168-review-grid>div{border:1px solid var(--border,#334155);border-radius:10px;padding:9px;display:flex;flex-direction:column;gap:3px}
      .v21168-review-grid small{color:var(--muted,#94a3b8)}
      .v21168-review-lines{display:grid;gap:6px;margin:10px 0}
      @media(max-width:700px){.v21168-setup-tile{min-height:0!important;padding:76px 18px 20px!important}.v21168-list .row-between{display:block}.v21168-list .actions,.v21168-list .row-between>button{width:100%;margin-top:9px}.v21168-list .actions button{flex:1 1 45%}.v21168-review-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb||!window.SafetyManagementNavigationV21167||!window.SafetyPeopleDepartmentScopeV21166){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;if(!state.user)return;
    installStyles();await loadData(true);installEvents();
    const obs=new MutationObserver(queueDecorate);const r=reportsView();if(r)obs.observe(r,{childList:true,subtree:true});
    [80,220,600,1200].forEach(ms=>setTimeout(queueDecorate,ms));
    if(history.state?.v21168Setup&&isAdmin())openSetup(history.state.v21168Setup,{push:false});
    window.SafetySetupHubV21168={open:openSetup,editUser:openEnhancedEdit,createUser:openEnhancedCreate,reload:async()=>{await loadData(true);renderSetup(reportsView()?.dataset.v21168Setup||'users');queueDecorate()}};
  }
  boot().catch(e=>console.warn('Safety Tracker v2.11.68 Setup Hub',e));
})();


/* Safety Tracker v2.11.69 CLEAN
   Instructor visibility + User editor reliability.
   - Keeps Instructor visible for Admin/Manager, HOD/Department Manager, or a user with
     "Can carry out instructor-led training" even after the core navigation refreshes.
   - Re-checks instructor authority after profile/access changes and on page/navigation events.
   - If the instructor module originally booted before permission was available, reloads that
     module once after authority is confirmed.
   - v2.11.68 User Edit/Create buttons now stop older handlers and surface any editor error.
*/
'use strict';
(function(){
  if(window.__SAFETY_INSTRUCTOR_USER_EDITOR_FIX_V21169)return;
  window.__SAFETY_INSTRUCTOR_USER_EDITOR_FIX_V21169=true;

  let api=null,state=null,sb=null,allowed=false,resolving=false,reloadAttempted=false,observer=null;
  const $=id=>document.getElementById(id);
  const toast=m=>{try{api?.toast?.(m)}catch(_e){console.log(m)}};
  const role=()=>String(state?.profile?.role||'').toLowerCase();
  const activeAccount=()=>!!state?.user&&state?.profile?.report_only!==true;
  const globalManager=()=>activeAccount()&&['admin','manager'].includes(role())&&!(role()==='admin'&&state?.uiMode==='user');

  function instructorButton(){return document.querySelector('#mainNav button[data-view="instructor"]')}
  function keepVisible(){
    const b=instructorButton();
    if(!b||!allowed)return;
    if(b.hidden)b.hidden=false;
    b.setAttribute('aria-hidden','false');
  }

  async function recoverInstructorModule(){
    if(!allowed||window.SafetyInstructorResponsibilityV21156||reloadAttempted)return;
    const old=document.querySelector('script[data-safety-loader-v21113="hotfix-v21157-instructor-permission.js"]');
    if(!old?.src)return;
    reloadAttempted=true;
    try{
      window.__SAFETY_INSTRUCTOR_RESP_V21157=false;
      const s=document.createElement('script');
      s.async=false;
      s.src=old.src+(old.src.includes('?')?'&':'?')+'repair=v21169';
      s.onload=()=>setTimeout(()=>{keepVisible();try{window.SafetyInstructorResponsibilityV21156?.reload?.()}catch(_e){}},120);
      s.onerror=()=>console.warn('Safety v2.11.69 could not reload instructor module');
      (document.body||document.head||document.documentElement).appendChild(s);
    }catch(e){console.warn('Safety v2.11.69 instructor module recovery',e)}
  }

  async function resolveAuthority(){
    if(resolving||!sb||!state?.user)return;
    resolving=true;
    try{
      if(globalManager())allowed=true;
      else{
        const [cap,hod]=await Promise.all([
          sb.rpc('my_training_instructor_access_v21157'),
          sb.rpc('my_department_manager_departments_v21156')
        ]);
        const row=cap.error?null:(Array.isArray(cap.data)?cap.data[0]:cap.data);
        allowed=activeAccount()&&(row?.can_carry_out_training===true||(!hod.error&&(hod.data||[]).length>0));
      }
      keepVisible();
      await recoverInstructorModule();
    }catch(e){console.warn('Safety v2.11.69 instructor authority',e)}
    finally{resolving=false}
  }

  function watchNav(){
    const nav=$('mainNav');if(!nav||observer)return;
    observer=new MutationObserver(muts=>{
      if(!allowed)return;
      for(const m of muts){
        if(m.type==='attributes'||m.type==='childList'){queueMicrotask(keepVisible);break}
      }
    });
    observer.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
  }

  function install(){
    watchNav();
    window.addEventListener('click',e=>{
      const edit=e.target.closest?.('[data-v21168-edit-user]');
      if(edit){
        // v2.11.68 normally handles this first. This is a defensive fallback for a stale/rebuilt card.
        setTimeout(()=>{
          if(!$('modal')?.open)window.SafetySetupHubV21168?.editUser?.(edit.dataset.v21168EditUser);
        },80);
      }
      if(e.target.closest?.('[data-v21168-save-user],[data-v21166-save-person],[data-v21158-save-profile],#mainNav button[data-view]')){
        setTimeout(resolveAuthority,180);
        setTimeout(keepVisible,420);
      }
    },true);
    window.addEventListener('pageshow',()=>{setTimeout(resolveAuthority,80);setTimeout(keepVisible,350)});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){resolveAuthority();setTimeout(keepVisible,120)}});
    [0,120,350,800,1600].forEach(ms=>setTimeout(()=>{resolveAuthority();keepVisible()},ms));
    window.SafetyInstructorVisibilityV21169={refresh:resolveAuthority,show:keepVisible};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,100);return}
    state=api.state;sb=api.sb;
    if(!state.user){setTimeout(boot,160);return}
    install();
  }
  boot();
})();

/* Safety Tracker v2.11.71 CLEAN
   Approval save reliability.
   - Prevents the older responsibility decorator from leaving an Admin approval button disabled.
   - Captures Save approval decision before older click handlers can interfere.
   - Calls the existing controlled-document approval routine directly.
   - Mirrors approval validation / database errors inside the open modal so mobile users can
     actually see why an approval was not saved instead of a toast appearing behind the dialog.
*/
'use strict';
(function(){
  if(window.__SAFETY_APPROVAL_SAVE_REPAIR_V21171)return;
  window.__SAFETY_APPROVAL_SAVE_REPAIR_V21171=true;

  let api=null,state=null,observer=null,repairQueued=false;
  const $=id=>document.getElementById(id);
  const actualAdmin=()=>{
    const p=state?.profile;
    return !!p && p.report_only!==true &&
      String(p.role||'').toLowerCase()==='admin' &&
      state?.uiMode!=='user';
  };

  function saveButton(){
    return document.querySelector('#modalBody [data-save-version-approval]');
  }
  function scopeBlocked(){
    const hint=$('responsibilityApprovalHintV21090');
    return /^Scope required\./i.test(String(hint?.textContent||'').trim());
  }
  function feedback(message,type='danger'){
    const body=$('modalBody');
    if(!body)return;
    let box=$('approvalSaveFeedbackV21171');
    if(!box){
      box=document.createElement('div');
      box.id='approvalSaveFeedbackV21171';
      const actions=[...body.querySelectorAll('.actions')].pop();
      if(actions)actions.insertAdjacentElement('beforebegin',box);
      else body.appendChild(box);
    }
    box.className=type==='success'?'success-note':'danger-note';
    box.innerHTML=`<strong>${type==='success'?'Approval saved':'Approval not saved'}</strong><br>${String(message||'Please check the required approval fields above.')}`;
    try{box.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_e){}
  }

  function enforceAdminApproval(){
    if(!actualAdmin())return;
    const modal=$('modal'),button=saveButton();
    if(!modal?.open||!button)return;
    if(scopeBlocked()){
      button.disabled=true;
      button.title='Set the document scope/audience before approval.';
      return;
    }
    button.disabled=false;
    button.removeAttribute('disabled');
    button.title='';
    const hint=$('responsibilityApprovalHintV21090');
    if(hint && !/Admin approval:/i.test(hint.textContent||'')){
      hint.className='success-note';
      hint.innerHTML='<strong>Admin approval:</strong> Any Admin may approve or review this controlled document. Assigned H&amp;S / Department responsibility is used for ownership, reminders and follow-up; it does not restrict Admin approval permission.';
    }
  }

  function queueRepair(){
    if(repairQueued)return;
    repairQueued=true;
    queueMicrotask(()=>{
      repairQueued=false;
      try{enforceAdminApproval()}catch(e){console.warn('Safety v2.11.71 approval button repair',e)}
    });
  }

  async function handleSave(button){
    if(button.dataset.v21171Saving==='1')return;
    const versionId=button.dataset.saveVersionApproval;
    const fn=window.saveVersionApproval;
    if(typeof fn!=='function'){
      feedback('The approval action is still loading. Close this window, reopen Review & approve, then try again.');
      return;
    }

    button.dataset.v21171Saving='1';
    const oldText=button.textContent;
    button.disabled=true;
    button.textContent='Saving approval…';
    feedback('Saving the approval decision…','success');

    let captured='';
    const originalToast=window.toast;
    const wrappedToast=function(message){
      captured=String(message||'');
      try{if(typeof originalToast==='function')originalToast(message)}catch(_e){}
      const ok=/approved|accepted|updated|current|recorded/i.test(captured) &&
        !/not |could not|failed|error|required|choose|tick|open the exact|no longer/i.test(captured);
      feedback(captured,ok?'success':'danger');
    };

    try{
      if(typeof originalToast==='function')window.toast=wrappedToast;
      await Promise.resolve(fn(versionId));

      // Successful approval closes the modal. If it is still open, surface a visible
      // explanation even when an older validation path did not produce a toast.
      await new Promise(resolve=>setTimeout(resolve,80));
      if($('modal')?.open && saveButton()){
        if(!captured){
          feedback('The approval has not been saved. Check that the pending file has been opened, the confirmation box is ticked, and the training schedule/audience above is complete.');
        }
      }
    }catch(e){
      console.error('Safety v2.11.71 approval save',e);
      feedback(e?.message||'The approval could not be saved. Please try again.');
    }finally{
      if(window.toast===wrappedToast)window.toast=originalToast;
      const live=saveButton();
      if(live){
        live.dataset.v21171Saving='';
        live.textContent=oldText||'Save approval decision';
        enforceAdminApproval();
        if(!actualAdmin())live.disabled=false;
      }
    }
  }

  function install(){
    const body=$('modalBody');
    if(body&&!observer){
      observer=new MutationObserver(queueRepair);
      observer.observe(body,{
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['disabled']
      });
    }

    window.addEventListener('pointerdown',e=>{
      if(e.target.closest?.('[data-save-version-approval]'))queueRepair();
    },true);

    window.addEventListener('click',e=>{
      const button=e.target.closest?.('[data-save-version-approval]');
      if(!button)return;
      const fn=window.saveVersionApproval;
      if(typeof fn!=='function')return; // let the core handler keep its normal fallback
      e.preventDefault();
      e.stopImmediatePropagation();
      void handleSave(button);
    },true);

    window.addEventListener('pageshow',()=>setTimeout(queueRepair,120));
    [80,220,500,900].forEach(ms=>setTimeout(queueRepair,ms));
    window.SafetyApprovalSaveRepairV21171={repair:enforceAdminApproval};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state){setTimeout(boot,100);return}
    state=api.state;
    if(!state.user){setTimeout(boot,160);return}
    install();
  }
  boot();
})();

/* Safety Tracker v2.11.72 CLEAN
   Modal feedback visibility + TBT assignment wording.
   - Mirrors toast/validation messages into any open modal so warnings are never hidden behind <dialog>.
   - Gives immediate approval blockers beside the Save approval decision button.
   - Clarifies that Group settings control only automatic TBT refresher frequency; normal TBT assignment remains available.
*/
'use strict';
(function(){
  if(window.__SAFETY_MODAL_FEEDBACK_TBT_V21172)return;
  window.__SAFETY_MODAL_FEEDBACK_TBT_V21172=true;
  const $=id=>document.getElementById(id);

  function messageKind(msg){
    const t=String(msg||'').toLowerCase();
    return /saved|approved|accepted|updated|complete|recorded|success/.test(t) &&
      !/not saved|not approved|failed|error|cannot|can't|could not|required|choose|tick|open /.test(t)
      ?'success':'danger';
  }
  function showModalMessage(msg,kind){
    const modal=$('modal'),body=$('modalBody');
    if(!modal?.open||!body||!String(msg||'').trim())return;
    let box=$('modalFeedbackV21172');
    if(!box){
      box=document.createElement('div');
      box.id='modalFeedbackV21172';
      const actions=[...body.querySelectorAll('.actions')].pop();
      if(actions)actions.insertAdjacentElement('beforebegin',box);else body.appendChild(box);
    }
    box.className=(kind||messageKind(msg))==='success'?'success-note':'danger-note';
    box.innerHTML=`<strong>${(kind||messageKind(msg))==='success'?'Status':'Action needed'}</strong><br>${String(msg)}`;
    box.hidden=false;
    try{box.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_e){}
  }
  function mirrorToast(){
    const t=$('toast');
    if(!t||t.hidden)return;
    const msg=String(t.textContent||'').trim();
    if(msg)showModalMessage(msg,messageKind(msg));
  }
  function approvalPrecheck(){
    const body=$('modalBody');
    if(!body?.querySelector('[data-save-version-approval]'))return true;
    const open=$('approvalOpenStatus');
    if(open && !/opened\s*✓?/i.test(String(open.textContent||''))){
      showModalMessage('Open the exact pending file using “Open pending file” before approving it.','danger');
      return false;
    }
    if($('approvalAck') && !$('approvalAck').checked){
      showModalMessage('Tick the confirmation that you reviewed the exact pending document.','danger');
      return false;
    }
    return true;
  }

  function tidyTbtCopy(){
    const box=$('tbtGroupTopupsV21164');
    if(box){
      const h=box.querySelector('h3');
      if(h)h.textContent='Toolbox Talk automatic refreshers';
      const p=box.querySelector('h3 + p');
      if(p)p.textContent='Optional automatic refresher frequency is set by Group. This does not restrict normal Toolbox Talk assignment — TBTs can still be assigned through the usual assignment controls just like other training.';
    }
    const title=$('modalTitle');
    const body=$('modalBody');
    if(title&&body&&/TBT Group top-ups/i.test(title.textContent||'')){
      title.textContent='TBT automatic refresher schedule';
      const paras=[...body.querySelectorAll('p.muted')];
      for(const p of paras){
        const t=p.textContent||'';
        if(/applies to the Group as a whole/i.test(t))p.textContent='This setting controls only the Group’s optional automatic refresher schedule. It does not change who a Toolbox Talk can be assigned to through the normal assignment controls.';
        if(/avoids individual frequency settings/i.test(t))p.textContent='The automatic scheduler rotates through the selected approved Toolbox Talks. Normal one-off or required TBT assignments remain unchanged.';
      }
    }
  }

  function install(){
    const toast=$('toast');
    if(toast){
      const obs=new MutationObserver(mirrorToast);
      obs.observe(toast,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','style','class']});
    }
    const modal=$('modal');
    if(modal){
      const obs=new MutationObserver(()=>{tidyTbtCopy();setTimeout(mirrorToast,0)});
      obs.observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    }
    const pageObs=new MutationObserver(tidyTbtCopy);
    pageObs.observe(document.body,{childList:true,subtree:true});

    window.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-save-version-approval]');
      if(b){
        // Do not stop the core save handler. We only surface the blocker in the open modal.
        approvalPrecheck();
        setTimeout(mirrorToast,30);setTimeout(mirrorToast,180);setTimeout(mirrorToast,600);
      }
    },true);
    [80,250,700,1400].forEach(ms=>setTimeout(tidyTbtCopy,ms));
    window.SafetyModalFeedbackTbtV21172={mirrorToast,tidyTbtCopy,showModalMessage};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Safety Tracker v2.11.72 CLEAN
   Controlled document-set setup cleanup + flexible responsibility assignment.
   - Rebuilds the folder/document-set editor into clear mobile-friendly sections.
   - Overall annual-review responsibility and default file-review responsibility support
     Everyone, Departments, Positions, Groups and specific people.
   - Keeps the sign-off/acknowledgement audience separate from review responsibility.
   - Mirrors toast/warning messages inside open modals so mobile users can see them.
   - Clarifies that TBT Group settings are only for optional automatic refresher scheduling;
     normal TBT assignment remains separate.
*/
'use strict';
(function(){
  if(window.__SAFETY_DOCUMENT_SET_RESP_UI_V21172)return;
  window.__SAFETY_DOCUMENT_SET_RESP_UI_V21172=true;

  let api=null,state=null,sb=null,observer=null,toastObserver=null,decorating=false;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const isManagerUi=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user'&&state?.uiMode!=='manager';
  const managerMode=()=>String(state?.uiMode||'').toLowerCase()==='manager' || String(state?.profile?.role||'').toLowerCase()==='manager';
  const todayIso=()=>new Date().toISOString().slice(0,10);

  function openModal(title,html){
    const m=$('modal'),h=$('modalTitle'),b=$('modalBody');if(!m||!b)return;
    if(h)h.textContent=title;b.innerHTML=html;
    try{if(!m.open)m.showModal()}catch(_e){m.setAttribute('open','')}
  }
  function closeModal(){try{$('modal')?.close()}catch(_e){$('modal')?.removeAttribute('open')}}
  function showInline(msg,type='danger'){
    const body=$('modalBody');if(!body||!$('modal')?.open)return;
    let box=$('modalInlineNoticeV21172');
    if(!box){
      box=document.createElement('div');box.id='modalInlineNoticeV21172';
      body.insertAdjacentElement('afterbegin',box);
    }
    box.className=type==='success'?'success-note v21172-inline-notice':'danger-note v21172-inline-notice';
    box.innerHTML=`<strong>${type==='success'?'Saved':'Check this'}</strong><br>${esc(msg)}`;
    try{box.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_e){}
  }
  function toast(msg){
    try{api?.toast?.(msg)}catch(_e){}
    if($('modal')?.open)showInline(msg,/saved|updated|complete|success/i.test(String(msg))?'success':'danger');
  }

  function safeDate(year,month,day){
    const last=new Date(year,month,0).getDate();
    return new Date(year,month-1,Math.min(Math.max(1,Number(day)||1),last),12,0,0);
  }
  function nextOccurrence(month,day){
    const now=new Date(),t=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12,0,0);let y=now.getFullYear();let d=safeDate(y,month,day);
    if(d<t)d=safeDate(++y,month,day);return d.toISOString().slice(0,10);
  }
  function reviewOccurrence(signoffIso,month,day){
    const sign=new Date(signoffIso+'T12:00:00');let d=safeDate(sign.getFullYear(),month,day);
    if(d>=sign)d=safeDate(sign.getFullYear()-1,month,day);return d.toISOString().slice(0,10);
  }
  function minusOneMonth(iso){
    const d=new Date(iso+'T12:00:00'),first=new Date(d.getFullYear(),d.getMonth()-1,1,12),last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    return new Date(first.getFullYear(),first.getMonth(),Math.min(d.getDate(),last),12).toISOString().slice(0,10);
  }
  function presetFor(value,unit,annual=false){
    if(annual)return 'ANNUAL_ONLY';
    const k=`${Number(value)||0}|${String(unit||'MONTHS').toUpperCase()}`;
    return ({'1|MONTHS':'MONTHLY','3|MONTHS':'QUARTERLY','6|MONTHS':'SIX_MONTHLY','12|MONTHS':'TWELVE_MONTHLY'})[k]||'CUSTOM';
  }
  function presetValues(preset,value,unit){
    if(preset==='MONTHLY')return {mode:'PERIODIC_OVERRIDE',value:1,unit:'MONTHS'};
    if(preset==='QUARTERLY')return {mode:'PERIODIC_OVERRIDE',value:3,unit:'MONTHS'};
    if(preset==='SIX_MONTHLY')return {mode:'PERIODIC_OVERRIDE',value:6,unit:'MONTHS'};
    if(preset==='TWELVE_MONTHLY')return {mode:'PERIODIC_OVERRIDE',value:12,unit:'MONTHS'};
    if(preset==='ANNUAL_ONLY')return {mode:'ANNUAL_ONLY',value:12,unit:'MONTHS'};
    return {mode:'PERIODIC_OVERRIDE',value:Math.max(1,Number(value)||3),unit:String(unit||'MONTHS').toUpperCase()};
  }

  async function scopeData(){
    const [d,p,pd,pr,ud,g,rt]=await Promise.all([
      sb.from('departments').select('*').eq('active',true).order('name'),
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
      sb.from('safety_position_departments_v21069').select('*'),
      sb.from('profiles').select('id,display_name,email,login_username,active,report_only').eq('active',true).order('display_name'),
      sb.from('user_departments').select('*'),
      sb.from('safety_groups_v21155').select('*').eq('active',true).order('name'),
      sb.from('document_pack_responsibility_targets_v21172').select('*')
    ]);
    let departments=d.error?[]:(d.data||[]),positions=p.error?[]:(p.data||[]),positionDepartments=pd.error?[]:(pd.data||[]),people=pr.error?(state?.people||[]):(pr.data||[]),userDepartments=ud.error?[]:(ud.data||[]),groups=g.error?[]:(g.data||[]),responsibilities=rt.error?[]:(rt.data||[]);
    people=people.filter(x=>x.active!==false&&x.report_only!==true);

    if(managerMode()&&!isAdmin()){
      const s=await sb.rpc('my_manager_scope_departments_v21166');
      const allowed=new Set((s.error?[]:(s.data||[])).map(x=>x.department_id));
      departments=departments.filter(x=>allowed.has(x.id));
      positions=positions.filter(x=>positionDepartments.some(y=>y.position_id===x.id&&allowed.has(y.department_id)) || allowed.has(x.primary_department_id));
      people=people.filter(x=>userDepartments.some(y=>y.user_id===x.id&&allowed.has(y.department_id)));
      const eligible=[];
      for(const gr of groups){
        const m=await sb.rpc('group_resolved_users_v21155',{p_group_id:gr.id});
        const rows=m.error?[]:(m.data||[]);
        if(rows.length&&rows.every(x=>people.some(p0=>p0.id===x.user_id)))eligible.push(gr);
      }
      groups=eligible;
    }
    return {departments,positions,people,groups,responsibilities};
  }

  function targetSummary(rows,ctx){
    if(!rows?.length)return 'Not assigned';
    if(rows.some(x=>x.target_type==='EVERYONE'))return 'Everyone';
    const bits=[];
    const ds=rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>ctx.departments.find(y=>y.id===x.department_id)?.name).filter(Boolean);
    const ps=rows.filter(x=>x.target_type==='POSITION').map(x=>ctx.positions.find(y=>y.id===x.position_id)?.name).filter(Boolean);
    const gs=rows.filter(x=>x.target_type==='GROUP').map(x=>ctx.groups.find(y=>y.id===x.group_id)?.name).filter(Boolean);
    const us=rows.filter(x=>x.target_type==='USER').map(x=>{const p=ctx.people.find(y=>y.id===x.user_id);return p?.display_name||p?.login_username||p?.email}).filter(Boolean);
    if(ds.length)bits.push(ds.join(', '));if(ps.length)bits.push('Positions: '+ps.join(', '));if(gs.length)bits.push('Groups: '+gs.join(', '));if(us.length)bits.push('People: '+us.join(', '));
    return bits.join(' · ')||'Assigned';
  }
  function picker(prefix,label,rows,ctx,help,allowEveryone=true){
    const everyone=rows.some(x=>x.target_type==='EVERYONE');
    const deps=new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const pos=new Set(rows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const grps=new Set(rows.filter(x=>x.target_type==='GROUP').map(x=>x.group_id));
    const users=new Set(rows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    return `<details class="v21172-assignment" ${rows.length?'open':''}>
      <summary><span><strong>${esc(label)}</strong><small>${esc(targetSummary(rows,ctx))}</small></span></summary>
      <div class="v21172-assignment-body">
        ${help?`<p class="muted">${esc(help)}</p>`:''}
        ${allowEveryone?`<label class="check-row v21172-everyone"><input id="${prefix}Everyone" type="checkbox" ${everyone?'checked':''} ${managerMode()&&!isAdmin()?'disabled':''}> <strong>Everyone / whole site</strong></label>`:''}
        <div class="v21172-choice-grid">
          <details><summary>Departments${deps.size?` · ${deps.size}`:''}</summary><div class="v21172-choice-list">${ctx.departments.map(x=>`<label><input type="checkbox" data-${prefix}-department value="${esc(x.id)}" ${deps.has(x.id)?'checked':''}> <span>${esc(x.name)}</span></label>`).join('')||'<span class="muted">None available.</span>'}</div></details>
          <details><summary>Positions${pos.size?` · ${pos.size}`:''}</summary><div class="v21172-choice-list">${ctx.positions.map(x=>`<label><input type="checkbox" data-${prefix}-position value="${esc(x.id)}" ${pos.has(x.id)?'checked':''}> <span>${esc(x.name)}</span></label>`).join('')||'<span class="muted">None available.</span>'}</div></details>
          <details><summary>Groups${grps.size?` · ${grps.size}`:''}</summary><div class="v21172-choice-list">${ctx.groups.map(x=>`<label><input type="checkbox" data-${prefix}-group value="${esc(x.id)}" ${grps.has(x.id)?'checked':''}> <span>${esc(x.name)}</span></label>`).join('')||'<span class="muted">None available.</span>'}</div></details>
          <details><summary>Specific people${users.size?` · ${users.size}`:''}</summary><div class="v21172-choice-list">${ctx.people.map(x=>`<label><input type="checkbox" data-${prefix}-user value="${esc(x.id)}" ${users.has(x.id)?'checked':''}> <span>${esc(x.display_name||x.login_username||x.email||'User')}</span></label>`).join('')||'<span class="muted">None available.</span>'}</div></details>
        </div>
      </div>
    </details>`;
  }
  function readPicker(prefix){
    return {
      everyone:!!$(`${prefix}Everyone`)?.checked,
      departments:[...document.querySelectorAll(`[data-${prefix}-department]:checked`)].map(x=>x.value),
      positions:[...document.querySelectorAll(`[data-${prefix}-position]:checked`)].map(x=>x.value),
      groups:[...document.querySelectorAll(`[data-${prefix}-group]:checked`)].map(x=>x.value),
      users:[...document.querySelectorAll(`[data-${prefix}-user]:checked`)].map(x=>x.value)
    };
  }
  function pickerHasAny(x){return !!(x.everyone||x.departments.length||x.positions.length||x.groups.length||x.users.length)}
  function packAudienceRows(aud){return (aud||[]).map(x=>({...x,target_type:x.target_type==='USER'?'USER':x.target_type}));}
  function oldResponsibilityRows(pack,kind){
    if(!pack)return [];
    if(kind==='OVERALL_REVIEW'){
      if(pack.overall_review_responsible_user_id)return [{target_type:'USER',user_id:pack.overall_review_responsible_user_id}];
      if(pack.overall_review_responsible_position_id)return [{target_type:'POSITION',position_id:pack.overall_review_responsible_position_id}];
    }else{
      if(pack.default_item_reviewer_user_id)return [{target_type:'USER',user_id:pack.default_item_reviewer_user_id}];
      if(pack.default_item_reviewer_position_id)return [{target_type:'POSITION',position_id:pack.default_item_reviewer_position_id}];
    }
    return [];
  }

  async function decorateFolderEditor(){
    if(decorating||!isManagerUi())return;
    const body=$('modalBody'),controlled=$('v21165ControlledSet');
    if(!body||!controlled||body.dataset.v21172==='1')return;
    decorating=true;
    try{
      const oldSave=body.querySelector('[data-v21165-save-folder-set]');
      if(!oldSave)return;
      const folderId=oldSave.dataset.v21165SaveFolderSet||'';
      const [ctx,fr,pr,ar]=await Promise.all([
        scopeData(),
        folderId?sb.from('document_folders_v21119').select('*').eq('id',folderId).maybeSingle():Promise.resolve({data:null}),
        folderId?sb.from('document_packs_v21160').select('*').eq('folder_id',folderId).maybeSingle():Promise.resolve({data:null}),
        folderId?sb.from('document_packs_v21160').select('id').eq('folder_id',folderId).maybeSingle():Promise.resolve({data:null})
      ]);
      const folder=fr?.data||null,pack=pr?.data||null,packId=pack?.id||ar?.data?.id||null;
      let audiences=[],resp=[];
      if(packId){
        const [a,r]=await Promise.all([
          sb.from('document_pack_audiences_v21160').select('*').eq('pack_id',packId),
          sb.from('document_pack_responsibility_targets_v21172').select('*').eq('pack_id',packId)
        ]);
        audiences=a.error?[]:(a.data||[]);resp=r.error?[]:(r.data||[]);
      }
      let overall=resp.filter(x=>x.responsibility_kind==='OVERALL_REVIEW');
      let defaults=resp.filter(x=>x.responsibility_kind==='DEFAULT_FILE_REVIEWER');
      if(!overall.length)overall=oldResponsibilityRows(pack,'OVERALL_REVIEW');
      if(!defaults.length)defaults=oldResponsibilityRows(pack,'DEFAULT_FILE_REVIEWER');

      const enabled=folder?!!folder.controlled_set_enabled:!!controlled.checked;
      const signoff=pack?nextOccurrence(pack.annual_ack_month||1,pack.annual_ack_day||31):(body.querySelector('#v21165AnnualSignoff')?.value||nextOccurrence(1,31));
      const review=pack?reviewOccurrence(signoff,pack.annual_review_month||12,pack.annual_review_day||31):(body.querySelector('#v21165AnnualReview')?.value||minusOneMonth(signoff));
      const defaultPreset=presetFor(pack?.default_review_frequency_value||12,pack?.default_review_frequency_unit||'MONTHS',(pack?.default_item_review_schedule_mode||'ANNUAL_ONLY')==='ANNUAL_ONLY');
      const due=audiences[0]?.due_days||14;

      body.dataset.v21172='1';
      body.innerHTML=`
        <div class="v21172-folder-head section-card">
          <div class="form-grid v21172-basic-grid">
            <label class="full">Folder name<input id="v21172FolderName" value="${esc(folder?.name||body.querySelector('#v21165FolderName')?.value||'')}" placeholder="e.g. Crisis management plan"></label>
            <label class="full">Description<textarea id="v21172FolderDescription" rows="2" placeholder="What belongs in this folder?">${esc(folder?.description||'')}</textarea></label>
            <label>Sort order<input id="v21172FolderSort" type="number" value="${Number(folder?.sort_order||0)}"></label>
          </div>
          <label class="check-row v21172-control-switch"><input id="v21172ControlledSet" type="checkbox" ${enabled?'checked':''}> <span><strong>Controlled document set</strong><small>Annual file review + staff acknowledgement</small></span></label>
        </div>

        <div id="v21172ControlledFields" ${enabled?'':'hidden'}>
          <section class="section-card v21172-section">
            <div class="v21172-section-title"><span class="v21172-step">1</span><div><h4>Annual cycle</h4><p class="muted">Set the review deadline and the later staff sign-off date.</p></div></div>
            <div class="form-grid v21172-two-col">
              <label>File-review deadline<input id="v21172AnnualReview" type="date" value="${esc(review)}"></label>
              <label>Staff sign-off due<input id="v21172AnnualSignoff" type="date" value="${esc(signoff)}"></label>
              <label>Review opens before deadline (days)<input id="v21172ReviewWindow" type="number" min="0" max="366" value="${Number(pack?.annual_review_window_days??45)}"></label>
              <label>Recent-starter grace (days)<input id="v21172StarterGrace" type="number" min="0" max="365" value="${Number(pack?.new_starter_grace_days??90)}"></label>
            </div>
          </section>

          <section class="section-card v21172-section">
            <div class="v21172-section-title"><span class="v21172-step">2</span><div><h4>Review responsibility</h4><p class="muted">Choose who owns the annual review and who normally reviews individual files.</p></div></div>
            ${picker('v21172Overall','Overall annual-review responsibility',overall,ctx,'Choose one or more standard assignment targets. This controls who is presented with the overall review responsibility.')}
            ${picker('v21172Default','Default reviewer for individual files',defaults,ctx,'Individual files can still override this default reviewer.')}
          </section>

          <section class="section-card v21172-section">
            <div class="v21172-section-title"><span class="v21172-step">3</span><div><h4>Who must acknowledge the set?</h4><p class="muted">This is separate from review responsibility.</p></div></div>
            ${picker('v21172Audience','Acknowledgement audience',packAudienceRows(audiences),ctx,'These people receive the controlled-set acknowledgement requirement.')}
            <label class="v21172-due">Initial / material-change acknowledgement due within <input id="v21172AudienceDue" type="number" min="1" max="365" value="${Number(due)}"> days</label>
          </section>

          <details class="section-card v21172-advanced">
            <summary><strong>Advanced review settings</strong><span>Default frequency, overlap rule and sign-off gate</span></summary>
            <div class="v21172-advanced-body form-grid v21172-two-col">
              <label>Default file review schedule<select id="v21172DefaultSchedule"><option value="ANNUAL_ONLY" ${defaultPreset==='ANNUAL_ONLY'?'selected':''}>Annual only</option><option value="MONTHLY" ${defaultPreset==='MONTHLY'?'selected':''}>Monthly + annual</option><option value="QUARTERLY" ${defaultPreset==='QUARTERLY'?'selected':''}>Quarterly + annual</option><option value="SIX_MONTHLY" ${defaultPreset==='SIX_MONTHLY'?'selected':''}>Every 6 months + annual</option><option value="TWELVE_MONTHLY" ${defaultPreset==='TWELVE_MONTHLY'?'selected':''}>Every 12 months + annual</option><option value="CUSTOM" ${defaultPreset==='CUSTOM'?'selected':''}>Custom periodic + annual</option></select></label>
              <div id="v21172DefaultCustom" class="form-grid full" ${defaultPreset==='CUSTOM'?'':'hidden'}><label>Every<input id="v21172DefaultValue" type="number" min="1" value="${Number(pack?.default_review_frequency_value||3)}"></label><label>Unit<select id="v21172DefaultUnit"><option value="DAYS" ${pack?.default_review_frequency_unit==='DAYS'?'selected':''}>Days</option><option value="MONTHS" ${pack?.default_review_frequency_unit!=='DAYS'&&pack?.default_review_frequency_unit!=='YEARS'?'selected':''}>Months</option><option value="YEARS" ${pack?.default_review_frequency_unit==='YEARS'?'selected':''}>Years</option></select></label></div>
              <label>Annual / periodic overlap<select id="v21172OverlapMode"><option value="SAME_MONTH" ${(pack?.review_overlap_mode||'SAME_MONTH')==='SAME_MONTH'?'selected':''}>Same month — annual counts for both</option><option value="DAYS" ${pack?.review_overlap_mode==='DAYS'?'selected':''}>Within a number of days</option><option value="NEVER" ${pack?.review_overlap_mode==='NEVER'?'selected':''}>Never combine</option></select></label>
              <label id="v21172OverlapDaysWrap" ${pack?.review_overlap_mode==='DAYS'?'':'hidden'}>Overlap window (days)<input id="v21172OverlapDays" type="number" min="0" max="366" value="${Number(pack?.review_overlap_days??31)}"></label>
              <label class="check-row full"><input id="v21172RequireAll" type="checkbox" ${pack?.require_all_reviews_before_signoff===false?'':'checked'}> Require all active files to complete annual review before staff sign-off opens</label>
            </div>
          </details>

          <div class="hint-box v21172-rule"><strong>Review rule:</strong> each file is reviewed individually. If a periodic review overlaps the annual review under the rule above, the annual review satisfies both.</div>
        </div>
        <div class="actions v21172-actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21172-save-folder-set="${esc(folderId)}">Save folder</button></div>`;

      const syncControlled=()=>{$('v21172ControlledFields').hidden=!$('v21172ControlledSet')?.checked};
      $('v21172ControlledSet')?.addEventListener('change',syncControlled);syncControlled();
      let reviewManual=false;
      $('v21172AnnualReview')?.addEventListener('change',()=>reviewManual=true);
      $('v21172AnnualSignoff')?.addEventListener('change',()=>{if(!reviewManual&&$('v21172AnnualReview'))$('v21172AnnualReview').value=minusOneMonth($('v21172AnnualSignoff').value)});
      $('v21172DefaultSchedule')?.addEventListener('change',()=>{$('v21172DefaultCustom').hidden=$('v21172DefaultSchedule').value!=='CUSTOM'});
      $('v21172OverlapMode')?.addEventListener('change',()=>{$('v21172OverlapDaysWrap').hidden=$('v21172OverlapMode').value!=='DAYS'});
      body.querySelectorAll('.v21172-assignment').forEach(box=>{
        const everyone=box.querySelector('.v21172-everyone input');
        const sync=()=>box.querySelectorAll('.v21172-choice-list input').forEach(x=>x.disabled=!!everyone?.checked);
        box.addEventListener('change',sync);sync();
      });
    }catch(e){console.error('v2.11.72 folder editor',e);showInline(e?.message||'Could not load the document-set setup.')}finally{decorating=false}
  }

  async function saveAudience(packId,selection,due){
    const del=await sb.from('document_pack_audiences_v21160').delete().eq('pack_id',packId);if(del.error)throw del.error;
    const rows=[];
    if(selection.everyone&&!managerMode())rows.push({pack_id:packId,target_type:'EVERYONE',due_days:due,created_by:state.user.id});
    else{
      selection.departments.forEach(id=>rows.push({pack_id:packId,target_type:'DEPARTMENT',department_id:id,due_days:due,created_by:state.user.id}));
      selection.positions.forEach(id=>rows.push({pack_id:packId,target_type:'POSITION',position_id:id,due_days:due,created_by:state.user.id}));
      selection.groups.forEach(id=>rows.push({pack_id:packId,target_type:'GROUP',group_id:id,due_days:due,created_by:state.user.id}));
      selection.users.forEach(id=>rows.push({pack_id:packId,target_type:'USER',user_id:id,due_days:due,created_by:state.user.id}));
    }
    if(rows.length){const ins=await sb.from('document_pack_audiences_v21160').insert(rows);if(ins.error)throw ins.error}
  }
  async function saveResponsibility(packId,kind,selection){
    const r=await sb.rpc('set_document_pack_responsibility_v21172',{
      p_pack_id:packId,p_responsibility_kind:kind,p_everyone:!!selection.everyone,
      p_department_ids:selection.departments,p_position_ids:selection.positions,p_group_ids:selection.groups,p_user_ids:selection.users
    });
    if(r.error)throw r.error;
  }

  async function saveFolder(button){
    const folderId=button.dataset.v21172SaveFolderSet||null;
    const name=clean($('v21172FolderName')?.value),description=clean($('v21172FolderDescription')?.value)||null,sort=Number($('v21172FolderSort')?.value)||0,enabled=!!$('v21172ControlledSet')?.checked;
    if(!name)return showInline('Folder name is required.');
    const signoff=$('v21172AnnualSignoff')?.value||nextOccurrence(1,31),review=$('v21172AnnualReview')?.value||minusOneMonth(signoff);
    if(enabled&&new Date(review+'T12:00:00')>=new Date(signoff+'T12:00:00'))return showInline('The annual file-review deadline must be before the staff sign-off date.');
    const overall=readPicker('v21172Overall'),def=readPicker('v21172Default'),aud=readPicker('v21172Audience');
    if(enabled&&!pickerHasAny(overall))return showInline('Choose who has overall annual-review responsibility.');
    if(enabled&&!pickerHasAny(def))return showInline('Choose the default reviewer for individual files.');
    if(enabled&&!pickerHasAny(aud))return showInline('Choose who must acknowledge the document set.');
    if(managerMode()&&(overall.everyone||def.everyone||aud.everyone))return showInline('Manager mode cannot assign Everyone / whole site. Switch to Admin for site-wide assignment.');
    const s=new Date(signoff+'T12:00:00'),rv=new Date(review+'T12:00:00'),pv=presetValues($('v21172DefaultSchedule')?.value||'ANNUAL_ONLY',$('v21172DefaultValue')?.value,$('v21172DefaultUnit')?.value);
    const due=Math.max(1,Math.min(365,Number($('v21172AudienceDue')?.value)||14));
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    try{
      const r=await sb.rpc('save_document_folder_set_v21165',{
        p_folder_id:folderId||null,p_name:name,p_description:description,p_sort_order:sort,p_controlled_set_enabled:enabled,
        p_annual_signoff_month:s.getMonth()+1,p_annual_signoff_day:s.getDate(),p_annual_review_month:rv.getMonth()+1,p_annual_review_day:rv.getDate(),
        p_grace_days:Math.max(0,Math.min(365,Number($('v21172StarterGrace')?.value)||0)),p_default_review_mode:pv.mode,p_default_review_value:pv.value,p_default_review_unit:pv.unit,
        p_overall_review_user_id:null,p_overall_review_position_id:null,p_default_reviewer_user_id:null,p_default_reviewer_position_id:null,
        p_overlap_mode:$('v21172OverlapMode')?.value||'SAME_MONTH',p_overlap_days:Math.max(0,Math.min(366,Number($('v21172OverlapDays')?.value)||31)),
        p_annual_review_window_days:Math.max(0,Math.min(366,Number($('v21172ReviewWindow')?.value)||45)),p_require_all_reviews:!!$('v21172RequireAll')?.checked
      });
      if(r.error)throw r.error;
      const packId=r.data?.pack_id||null;
      if(enabled&&packId){
        await Promise.all([
          saveResponsibility(packId,'OVERALL_REVIEW',overall),
          saveResponsibility(packId,'DEFAULT_FILE_REVIEWER',def)
        ]);
        await saveAudience(packId,aud,due);
        const er=await sb.rpc('ensure_document_pack_requirements_v21165',{p_pack_id:packId});if(er.error)throw er.error;
      }
      closeModal();
      try{await window.SafetyGenericDocumentsV21119?.refresh?.()}catch(_e){}
      try{await window.SafetyPackTbtManagerV21164?.reload?.()}catch(_e){}
      try{await window.SafetyDocumentSetReviewV21165?.reload?.()}catch(_e){}
      toast(enabled?'Controlled document-set settings saved.':'Folder saved. Controlled-set rules are switched off but retained.');
    }catch(e){console.error('v2.11.72 save folder',e);showInline(e?.message||'Could not save folder settings.');button.disabled=false;button.textContent=old}
  }

  function mirrorToast(){
    const t=$('toast');if(!t||!$('modal')?.open||t.hidden)return;
    const msg=clean(t.textContent);if(msg)showInline(msg,/saved|updated|complete|success/i.test(msg)?'success':'danger');
  }
  function installToastMirror(){
    const t=$('toast');if(!t||toastObserver)return;
    toastObserver=new MutationObserver(()=>setTimeout(mirrorToast,0));
    toastObserver.observe(t,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }
  function clarifyTbt(){
    const box=$('tbtGroupTopupsV21164');if(!box)return;
    const h=box.querySelector('h3'),p=box.querySelector('h3')?.parentElement?.querySelector('p');
    if(h)h.textContent='Optional automatic TBT refresher schedule';
    if(p)p.textContent='This section only controls extra automatic/random refresher scheduling for Groups. It does not restrict normal Toolbox Talk assignment, which remains separate in Training.';
    box.querySelectorAll('p.muted').forEach(x=>{if(/Frequency is set for a Group only|avoids individual frequency settings/i.test(x.textContent||''))x.textContent='Automatic refresher frequency is configured here for the selected Group. Normal TBT assignment is unaffected.'});
  }

  function installStyles(){
    if($('v21172Styles'))return;const s=document.createElement('style');s.id='v21172Styles';s.textContent=`
      .v21172-inline-notice{position:sticky;top:0;z-index:5;margin:0 0 12px}
      .v21172-folder-head{margin-bottom:12px}.v21172-basic-grid{grid-template-columns:minmax(0,1fr) 120px}
      .v21172-control-switch{margin-top:12px;padding:12px;border:1px solid var(--border,#475569);border-radius:10px;align-items:flex-start}
      .v21172-control-switch span{display:grid;gap:3px}.v21172-control-switch small{font-weight:400;color:var(--muted,#94a3b8)}
      .v21172-section{margin:12px 0}.v21172-section-title{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}.v21172-section-title h4{margin:0}.v21172-section-title p{margin:4px 0 0}
      .v21172-step{display:grid;place-items:center;min-width:30px;height:30px;border-radius:999px;background:var(--brand,#0b2b59);font-weight:800}
      .v21172-two-col{grid-template-columns:repeat(2,minmax(0,1fr))}
      .v21172-assignment{border:1px solid var(--border,#475569);border-radius:10px;margin:8px 0;overflow:hidden;background:rgba(255,255,255,.02)}
      .v21172-assignment>summary{cursor:pointer;padding:12px 14px;list-style:none}.v21172-assignment>summary::-webkit-details-marker{display:none}.v21172-assignment>summary span{display:grid;gap:4px}.v21172-assignment>summary small{color:var(--muted,#94a3b8);font-weight:400;white-space:normal}
      .v21172-assignment[open]>summary{border-bottom:1px solid var(--border,#475569)}.v21172-assignment-body{padding:12px}
      .v21172-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.v21172-choice-grid>details{border:1px solid var(--border,#475569);border-radius:8px;overflow:hidden}.v21172-choice-grid>details>summary{padding:9px 10px;font-weight:700;cursor:pointer}.v21172-choice-list{max-height:190px;overflow:auto;border-top:1px solid var(--border,#475569);padding:7px}.v21172-choice-list label{display:flex;gap:8px;padding:7px 5px;align-items:flex-start}.v21172-choice-list input{margin-top:3px}
      .v21172-due{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.v21172-due input{max-width:100px}
      .v21172-advanced{margin:12px 0;padding:0}.v21172-advanced>summary{cursor:pointer;padding:14px}.v21172-advanced>summary span{display:block;color:var(--muted,#94a3b8);font-weight:400;margin-top:3px}.v21172-advanced-body{padding:0 14px 14px}.v21172-rule{margin:12px 0}.v21172-actions{position:sticky;bottom:0;background:var(--panel,#111827);padding:10px 0 2px;z-index:4}
      @media(max-width:720px){.v21172-basic-grid,.v21172-two-col,.v21172-choice-grid{grid-template-columns:1fr}.v21172-section{padding:14px}.v21172-assignment>summary{padding:12px}.v21172-choice-list{max-height:160px}.v21172-actions button{flex:1}.v21172-step{min-width:28px;height:28px}}
    `;document.head.appendChild(s);
  }

  function install(){
    if(observer)return;
    installStyles();
    const body=$('modalBody');
    if(body){observer=new MutationObserver(()=>{
      if($('modal')?.open)setTimeout(decorateFolderEditor,0)
    });observer.observe(body,{childList:true,subtree:true})}
    window.addEventListener('click',e=>{
      const save=e.target.closest?.('[data-v21172-save-folder-set]');
      if(save){e.preventDefault();e.stopImmediatePropagation();void saveFolder(save);return}
      if(e.target.closest?.('[data-v21119-edit-folder],[data-v21119-new-folder],[data-v21165-edit-linked-folder]'))setTimeout(decorateFolderEditor,80);
    },true);
    window.addEventListener('pageshow',()=>setTimeout(decorateFolderEditor,300));
    [150,500,1200].forEach(ms=>setTimeout(decorateFolderEditor,ms));
    window.SafetyDocumentSetResponsibilityV21172={refresh:decorateFolderEditor};
  }

  function boot(){
    api=window.SafetyTrackerV2;if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;if(!state.user)return;install();
  }
  boot();
})();

/* Safety Tracker v2.11.73 CLEAN
   Training Hub / General & Operational Training / Position audiences.
   - Standardises Training audiences to Everyone / Departments / Positions / Groups / Specific people.
   - Adds General / Operational Training alongside H&S Training without mixing General items into H&S compliance.
   - Supports uploaded PDF training or version-controlled built-in training content.
   - Built-in content is editable in-app; every material change creates an auditable content version.
   - Supports Self-training and Instructor-led delivery.
   - Adds a full Training Register Excel report covering H&S + General training.
*/
'use strict';
(function(){
  if(window.__SAFETY_TRAINING_HUB_V21173)return;
  window.__SAFETY_TRAINING_HUB_V21173=true;

  let api=null,state=null,sb=null;
  let positions=[],userPositions=[],positionDepartments=[],groups=[],scopeDepartments=[];
  let currentContent=new Map(),viewedKeys=new Set();
  let rpcBase=null,observer=null;
  let trainingMode='HS';

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const today=()=>new Date().toISOString().slice(0,10);
  const plusYear=()=>{const d=new Date();d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)};
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const personName=id=>(state?.people||[]).find(x=>x.id===id)?.display_name||(state?.people||[]).find(x=>x.id===id)?.email||'User';
  const trainingDomain=t=>String(t?.training_domain||'H&S').toUpperCase()==='GENERAL'?'GENERAL':'H&S';
  const isGeneral=t=>trainingDomain(t)==='GENERAL';
  const safeName=n=>api?.safeFileName?api.safeFileName(n):String(n||'training.pdf').replace(/[^\w.\-]+/g,'-');
  const toast=m=>{try{api?.toast?.(m)}catch(_e){console.log(m)}};

  function openModal(title,html){
    const m=$('modal'),h=$('modalTitle'),b=$('modalBody');if(!m||!b)return;
    if(h)h.textContent=title;b.innerHTML=html;
    try{if(!m.open)m.showModal()}catch(_e){m.setAttribute('open','')}
  }
  function closeModal(){try{$('modal')?.close()}catch(_e){$('modal')?.removeAttribute('open')}}

  async function loadSupplemental(){
    const [p,up,pd,g,scope,cv,act]=await Promise.all([
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
      sb.from('safety_user_positions_v21069').select('*').eq('active',true),
      sb.from('safety_position_departments_v21069').select('*'),
      sb.from('safety_groups_v21155').select('*').eq('active',true).order('name'),
      sb.rpc('my_manager_scope_departments_v21166'),
      sb.from('training_content_versions_v21173').select('id,training_session_id,version_number,is_current,created_at').eq('is_current',true),
      sb.from('training_content_activity_v21173').select('training_assignment_id,content_version_id,user_id,occurred_at').eq('user_id',state.user.id)
    ]);
    positions=p.error?[]:(p.data||[]);
    userPositions=up.error?[]:(up.data||[]);
    positionDepartments=pd.error?[]:(pd.data||[]);
    groups=g.error?[]:(g.data||[]);
    scopeDepartments=scope.error?[]:(scope.data||[]);
    currentContent.clear();
    for(const x of (cv.error?[]:(cv.data||[])))currentContent.set(x.training_session_id,x);
    viewedKeys.clear();
    for(const x of (act.error?[]:(act.data||[])))viewedKeys.add(`${x.training_assignment_id}|${x.content_version_id}`);
  }

  function scopedPositions(){
    if(isAdmin())return positions;
    const ids=new Set((scopeDepartments||[]).map(x=>x.department_id));
    if(!ids.size)return positions;
    return positions.filter(p=>{
      const deps=positionDepartments.filter(x=>x.position_id===p.id).map(x=>x.department_id);
      return !deps.length||deps.some(d=>ids.has(d));
    });
  }
  function positionHolders(positionId){
    const ids=userPositions.filter(x=>x.position_id===positionId&&x.active!==false).map(x=>x.user_id);
    return [...new Set(ids)];
  }

  function selectedPositionIds(){
    return [...document.querySelectorAll('#modalBody .audience-position-choice-v21173:checked')].map(x=>x.value);
  }
  function selectedGroupIds(){
    return [...document.querySelectorAll('#modalBody .audience-group-choice-v21155:checked')].map(x=>x.value);
  }

  function audienceContext(){
    const modal=$('modalBody');if(!modal)return null;let b;
    if((b=modal.querySelector('[data-save-doc-audience]')))return {kind:'DOCUMENT',id:b.dataset.saveDocAudience};
    if((b=modal.querySelector('[data-save-training-audience]')))return {kind:'TRAINING',id:b.dataset.saveTrainingAudience};
    if((b=modal.querySelector('[data-confirm-training-approval]')))return {kind:'TRAINING',id:b.dataset.confirmTrainingApproval};
    if((b=modal.querySelector('[data-save-awareness-assignments]')))return {kind:'AWARENESS',id:b.dataset.saveAwarenessAssignments};
    if((b=modal.querySelector('[data-save-version-approval]'))){
      const v=(state.versions||[]).find(x=>x.id===b.dataset.saveVersionApproval);
      return v?{kind:'DOCUMENT',id:v.document_id}:null;
    }
    if(modal.querySelector('[data-create-document]'))return {kind:'NEW_DOCUMENT',id:null};
    return null;
  }
  async function selectedPositionsForContext(ctx){
    if(!ctx||!ctx.id)return [];
    let table,key;
    if(ctx.kind==='DOCUMENT'){table='document_training_audiences';key='document_id'}
    else if(ctx.kind==='TRAINING'){table='training_session_audiences';key='training_session_id'}
    else if(ctx.kind==='AWARENESS'){table='awareness_item_audiences';key='awareness_item_id'}
    else return [];
    const r=await sb.from(table).select('position_id,target_type').eq(key,ctx.id).eq('target_type','POSITION');
    return r.error?[]:(r.data||[]).map(x=>x.position_id).filter(Boolean);
  }
  async function decorateAudienceSections(){
    if(!isManager())return;
    const modal=$('modalBody');if(!modal)return;
    const sections=[...modal.querySelectorAll('[id$="AudienceSection"]')];
    if(!sections.length)return;
    const ctx=audienceContext();
    const selected=new Set(await selectedPositionsForContext(ctx));
    for(const section of sections){
      if(section.dataset.positionsV21173==='1')continue;
      section.dataset.positionsV21173='1';
      const grid=section.querySelector('.audience-grid');
      if(!grid)continue;
      const box=document.createElement('div');
      box.className='positions-audience-v21173';
      box.innerHTML=`<h5>Positions</h5><div class="checkbox-list">${scopedPositions().map(p=>{
        const n=positionHolders(p.id).length;
        return `<label class="check-row"><input type="checkbox" class="audience-position-choice-v21173" value="${esc(p.id)}" ${selected.has(p.id)?'checked':''}><span>${esc(p.name)} <span class="muted">· ${n} current holder${n===1?'':'s'}</span></span></label>`;
      }).join('')||'<span class="muted">No active positions.</span>'}</div>`;
      const people=grid.lastElementChild;
      if(people)grid.insertBefore(box,people);else grid.appendChild(box);
      const intro=section.querySelector('p.muted');
      if(intro&&/Choose/i.test(intro.textContent||''))intro.textContent='Choose Everyone, Departments, Positions, Groups and/or specific people. Future users matching a Department, Position or Group are assigned automatically.';
      const everyone=section.querySelector('input[id$="AssignEveryone"]');
      const sync=()=>box.querySelectorAll('input').forEach(x=>x.disabled=!!everyone?.checked);
      section.addEventListener('change',sync);sync();
    }
  }

  function installRpcBridge(){
    if(sb.__positionsAudienceV21173)return;
    sb.__positionsAudienceV21173=true;
    rpcBase=sb.rpc.bind(sb);
    sb.rpc=function(name,args={},options){
      const pos=selectedPositionIds(),groupsNow=selectedGroupIds();
      if(['set_document_training_audience_v230','set_document_training_audience_v21155'].includes(name)){
        return rpcBase('set_document_training_audience_v21173',{
          p_document_id:args.p_document_id,
          p_everyone:!!args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_position_ids:pos,
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupsNow,
          p_due_days:args.p_due_days
        },options);
      }
      if(['set_training_session_audience_v239','set_training_session_audience_v21155'].includes(name)){
        return rpcBase('set_training_session_audience_v21173',{
          p_training_session_id:args.p_training_session_id,
          p_everyone:!!args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_position_ids:pos,
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupsNow,
          p_due_days:args.p_due_days
        },options);
      }
      if(['set_awareness_item_audience_v239','set_awareness_item_audience_v21155'].includes(name)){
        return rpcBase('set_awareness_item_audience_v21173',{
          p_awareness_item_id:args.p_awareness_item_id,
          p_everyone:!!args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_position_ids:pos,
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupsNow
        },options);
      }
      if(['decide_document_version_with_training_schedule_ack_v281','decide_document_version_with_training_schedule_ack_v21155'].includes(name)){
        return rpcBase('decide_document_version_with_training_schedule_ack_v21173',{
          p_document_version_id:args.p_document_version_id,
          p_decision:args.p_decision,
          p_context:args.p_context,
          p_note:args.p_note,
          p_everyone:!!args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_position_ids:pos,
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupsNow,
          p_due_days:args.p_due_days,
          p_delivery_method:args.p_delivery_method,
          p_renewal_value:args.p_renewal_value,
          p_renewal_unit:args.p_renewal_unit
        },options);
      }
      return rpcBase(name,args,options);
    };
    if(typeof window.audienceSelectionValid==='function'&&!window.__positionsAudienceValidationV21173){
      window.__positionsAudienceValidationV21173=true;
      const base=window.audienceSelectionValid;
      window.audienceSelectionValid=function(a){
        return base(a)||selectedPositionIds().length>0||selectedGroupIds().length>0;
      };
    }
  }

  function scheduleHtml(prefix,value=null,unit=null,mode=null){
    const key=value&&unit?`${Number(value)}|${unit}`:'';
    const known=['3|MONTHS','6|MONTHS','12|MONTHS','24|MONTHS'];
    const preset=known.includes(key)?key:(key?'CUSTOM':(mode==='ONE_OFF'?'ONE_OFF':'12|MONTHS'));
    return `<label>Repeat schedule<select id="${prefix}Schedule"><option value="ONE_OFF" ${preset==='ONE_OFF'?'selected':''}>One-off</option><option value="3|MONTHS" ${preset==='3|MONTHS'?'selected':''}>Every 3 months</option><option value="6|MONTHS" ${preset==='6|MONTHS'?'selected':''}>Every 6 months</option><option value="12|MONTHS" ${preset==='12|MONTHS'?'selected':''}>Every 12 months</option><option value="24|MONTHS" ${preset==='24|MONTHS'?'selected':''}>Every 24 months</option><option value="CUSTOM" ${preset==='CUSTOM'?'selected':''}>Custom…</option></select></label><div id="${prefix}Custom" class="full" ${preset==='CUSTOM'?'':'hidden'}><div class="form-grid"><label>Every<input id="${prefix}Value" type="number" min="1" value="${preset==='CUSTOM'?esc(value||1):''}"></label><label>Unit<select id="${prefix}Unit"><option value="DAYS" ${unit==='DAYS'?'selected':''}>Days</option><option value="MONTHS" ${unit!=='DAYS'&&unit!=='YEARS'?'selected':''}>Months</option><option value="YEARS" ${unit==='YEARS'?'selected':''}>Years</option></select></label></div></div>`;
  }
  function readSchedule(prefix){
    const p=$(`${prefix}Schedule`)?.value||'12|MONTHS';
    if(p==='ONE_OFF')return {value:null,unit:null,mode:'ONE_OFF'};
    if(p==='CUSTOM')return {value:Math.max(1,Number($(`${prefix}Value`)?.value)||1),unit:$(`${prefix}Unit`)?.value||'MONTHS',mode:'RECURRING'};
    const [v,u]=p.split('|');return {value:Number(v),unit:u,mode:'RECURRING'};
  }
  function wireSchedule(prefix){
    $(`${prefix}Schedule`)?.addEventListener('change',()=>{$(`${prefix}Custom`).hidden=$(`${prefix}Schedule`).value!=='CUSTOM'});
  }

  function customAudienceHtml(prefix,rows=[]){
    const every=rows.some(x=>x.target_type==='EVERYONE');
    const deps=new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const poss=new Set(rows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const grps=new Set(rows.filter(x=>x.target_type==='GROUP').map(x=>x.group_id));
    const ppl=new Set(rows.filter(x=>x.target_type==='PERSON').map(x=>x.user_id));
    return `<div id="${prefix}Audience" class="section-card v21173-audience">
      <h4>Who needs this training?</h4>
      <p class="muted">Assignments stay live when Department, Position or Group membership changes.</p>
      <label class="check-row audience-everyone"><input id="${prefix}Everyone" type="checkbox" ${every?'checked':''}> <strong>Everyone</strong> — all current and future active users</label>
      <div class="form-grid"><label>Completion due after assignment<input id="${prefix}DueDays" type="number" min="1" max="365" value="${Number(rows.find(x=>x.due_days)?.due_days||14)}"><span class="muted">days</span></label></div>
      <div class="v21173-audience-grid">
        <details><summary>Departments</summary><div class="checkbox-list">${(state.departments||[]).filter(x=>x.active!==false).map(d=>`<label class="check-row"><input type="checkbox" class="${prefix}-dep" value="${esc(d.id)}" ${deps.has(d.id)?'checked':''}>${esc(d.name)}</label>`).join('')}</div></details>
        <details><summary>Positions</summary><div class="checkbox-list">${scopedPositions().map(p=>`<label class="check-row"><input type="checkbox" class="${prefix}-pos" value="${esc(p.id)}" ${poss.has(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</div></details>
        <details><summary>Groups</summary><div class="checkbox-list">${groups.map(g=>`<label class="check-row"><input type="checkbox" class="${prefix}-grp" value="${esc(g.id)}" ${grps.has(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')||'<span class="muted">No groups configured.</span>'}</div></details>
        <details><summary>Specific people</summary><div class="checkbox-list">${(state.people||[]).filter(x=>x.active!==false&&x.report_only!==true).map(p=>`<label class="check-row"><input type="checkbox" class="${prefix}-usr" value="${esc(p.id)}" ${ppl.has(p.id)?'checked':''}>${esc(p.display_name||p.email)}</label>`).join('')}</div></details>
      </div>
      <div id="${prefix}Summary" class="hint-box"></div>
    </div>`;
  }
  function readCustomAudience(prefix){
    return {
      everyone:!!$(`${prefix}Everyone`)?.checked,
      departments:[...document.querySelectorAll(`.${prefix}-dep:checked`)].map(x=>x.value),
      positions:[...document.querySelectorAll(`.${prefix}-pos:checked`)].map(x=>x.value),
      groups:[...document.querySelectorAll(`.${prefix}-grp:checked`)].map(x=>x.value),
      users:[...document.querySelectorAll(`.${prefix}-usr:checked`)].map(x=>x.value),
      dueDays:Math.max(1,Math.min(365,Number($(`${prefix}DueDays`)?.value||14)))
    };
  }
  function wireCustomAudience(prefix){
    const root=$(`${prefix}Audience`);if(!root)return;
    const update=()=>{
      const a=readCustomAudience(prefix);
      root.querySelectorAll(`.${prefix}-dep,.${prefix}-pos,.${prefix}-grp,.${prefix}-usr`).forEach(x=>x.disabled=a.everyone);
      const ids=new Set();
      if(a.everyone)(state.people||[]).filter(x=>x.active!==false&&x.report_only!==true).forEach(x=>ids.add(x.id));
      else{
        for(const u of a.users)ids.add(u);
        for(const p of a.positions)positionHolders(p).forEach(u=>ids.add(u));
        for(const d of a.departments)(state.userDepartments||[]).filter(x=>x.department_id===d).forEach(x=>ids.add(x.user_id));
      }
      const box=$(`${prefix}Summary`);
      if(box)box.innerHTML=ids.size?`<strong>${ids.size}+ current user${ids.size===1?'':'s'} matched.</strong> Group membership is also resolved automatically.`:'<strong>No audience selected.</strong>';
    };
    root.addEventListener('change',update);update();
  }

  function updateCreateMode(){
    const mode=$('v21173ContentMode')?.value||'BUILT_IN';
    const upload=$('v21173UploadWrap'),built=$('v21173BuiltInWrap');
    if(upload)upload.hidden=mode!=='UPLOAD';
    if(built)built.hidden=mode!=='BUILT_IN';
    const domain=$('v21173Domain')?.value||'H&S';
    if($('v21173TypeWrap'))$('v21173TypeWrap').hidden=domain==='GENERAL';
    if($('v21173CategoryWrap'))$('v21173CategoryWrap').hidden=domain!=='GENERAL';
  }

  function openCreateTraining(){
    if(!isManager())return;
    const defaultDomain=trainingMode==='GENERAL'?'GENERAL':'H&S';
    openModal('Create training',`
      <div class="hint-box"><strong>Two ways to build training:</strong> upload a PDF, or create the training in Safety Tracker. Built-in training is easier to amend because each edit creates a dated content version and keeps the previous text in history.</div>
      <div class="form-grid">
        <label>Training area<select id="v21173Domain"><option value="H&S" ${defaultDomain==='H&S'?'selected':''}>H&S Training</option><option value="GENERAL" ${defaultDomain==='GENERAL'?'selected':''}>General / Operational Training</option></select></label>
        <label id="v21173TypeWrap">H&S type<select id="v21173Type"><option value="INDUCTION">Induction</option><option value="REFRESHER">Refresher</option><option value="AD_HOC">Ad-hoc training</option><option value="OTHER" selected>Other H&S training</option></select></label>
        <label id="v21173CategoryWrap" ${defaultDomain==='GENERAL'?'':'hidden'}>Category<input id="v21173Category" placeholder="e.g. Front Office, Brand Standards, Customer Service"></label>
        <label>Training name<input id="v21173Name" placeholder="Training title"></label>
        <label>Reference <span class="muted">optional</span><input id="v21173Ref" placeholder="e.g. GEN-001"></label>
        <label>Delivery method<select id="v21173Delivery"><option value="SELF_TRAINING">Self-training</option><option value="INSTRUCTOR_LED">Instructor-led</option></select></label>
        <label>Training material<select id="v21173ContentMode"><option value="BUILT_IN">Create in Safety Tracker</option><option value="UPLOAD">Upload PDF training</option></select></label>
        <label>Review date<input id="v21173Review" type="date" value="${plusYear()}"></label>
        ${scheduleHtml('v21173Create',12,'MONTHS','RECURRING')}
        <label class="full">Description / instructions<textarea id="v21173Desc" rows="3" placeholder="Short description, purpose or instructor notes."></textarea></label>
      </div>
      <div id="v21173BuiltInWrap" class="section-card">
        <h4>Built-in training content</h4>
        <p class="muted">Paste or type the training below. This becomes version 1. Future edits create version 2, 3, etc., with the old version retained.</p>
        <textarea id="v21173Content" class="v21173-content-editor" rows="16" placeholder="Paste the training content here…"></textarea>
      </div>
      <div id="v21173UploadWrap" class="section-card" hidden>
        <h4>Uploaded training material</h4>
        <input id="v21173Files" type="file" accept="application/pdf,.pdf" multiple>
        <p class="muted">Self-training requires at least one PDF that the employee can open before completing the training. Instructor-led training may also use uploaded supporting PDFs.</p>
      </div>
      ${customAudienceHtml('v21173CreateAud')}
      <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21173-save-new-training>Create & assign training</button></div>`);
    wireSchedule('v21173Create');wireCustomAudience('v21173CreateAud');
    $('v21173Domain')?.addEventListener('change',updateCreateMode);
    $('v21173ContentMode')?.addEventListener('change',updateCreateMode);
    updateCreateMode();
  }

  async function saveNewTraining(btn){
    if(!isManager())return;
    const domain=$('v21173Domain')?.value||'H&S';
    const contentMode=$('v21173ContentMode')?.value||'BUILT_IN';
    const delivery=$('v21173Delivery')?.value||'SELF_TRAINING';
    const name=clean($('v21173Name')?.value),reference=clean($('v21173Ref')?.value).toUpperCase();
    const category=clean($('v21173Category')?.value),desc=clean($('v21173Desc')?.value);
    const type=domain==='GENERAL'?'OTHER':($('v21173Type')?.value||'OTHER');
    const schedule=readSchedule('v21173Create'),aud=readCustomAudience('v21173CreateAud');
    const files=[...($('v21173Files')?.files||[])];
    const body=String($('v21173Content')?.value||'').trim();
    if(!name)return toast('Training name is required.');
    if(!aud.everyone&&!aud.departments.length&&!aud.positions.length&&!aud.groups.length&&!aud.users.length)return toast('Choose Everyone, a Department, a Position, a Group, or a specific person.');
    if(contentMode==='BUILT_IN'&&!body)return toast('Paste or type the built-in training content.');
    if(contentMode==='UPLOAD'&&delivery==='SELF_TRAINING'&&!files.length)return toast('Self-training needs at least one PDF.');
    btn.disabled=true;const old=btn.textContent;btn.textContent='Creating…';
    let trainingId=null;
    try{
      const ins=await sb.from('training_sessions').insert({
        name,session_type:type,description:desc||null,delivery_method:delivery,
        review_date:$('v21173Review')?.value||plusYear(),renewal_value:schedule.value,renewal_unit:schedule.unit,
        schedule_mode:schedule.mode,status:'ACTIVE',created_by:state.user.id,reference:reference||null,
        source_kind:domain==='GENERAL'?'GENERAL_TRAINING':type,source_document_id:null,source_document_version_id:null,
        auto_managed:false,review_required:false,review_reason:null,training_domain:domain,
        training_category:domain==='GENERAL'?(category||'General / Operational'):null,content_mode:contentMode,content_revision:0
      }).select().single();
      if(ins.error)throw ins.error;
      trainingId=ins.data.id;

      if(contentMode==='BUILT_IN'){
        const vr=await sb.rpc('save_training_content_version_v21173',{
          p_training_session_id:trainingId,p_content_body:body,p_change_summary:'Initial training content'
        });
        if(vr.error)throw vr.error;
      }else{
        for(const f of files){
          const path=`training/${trainingId}/${crypto.randomUUID()}-${safeName(f.name)}`;
          const up=await sb.storage.from('safety-files').upload(path,f,{contentType:f.type||'application/pdf'});
          if(up.error)throw up.error;
          const fr=await sb.from('training_files').insert({
            training_session_id:trainingId,file_name:f.name,storage_path:path,uploaded_by:state.user.id,
            content_text_sha256:f.type==='application/pdf'&&api.hashPdf?await api.hashPdf(f):null
          });
          if(fr.error)throw fr.error;
        }
      }
      const ar=await sb.rpc('set_training_session_audience_v21173',{
        p_training_session_id:trainingId,p_everyone:aud.everyone,p_department_ids:aud.departments,
        p_position_ids:aud.positions,p_user_ids:aud.users,p_group_ids:aud.groups,p_due_days:aud.dueDays
      });
      if(ar.error)throw ar.error;
      closeModal();await api.refresh(domain==='GENERAL'?'General / Operational training created and assigned.':'H&S training created and assigned.');
      await loadSupplemental();enhanceAll();
    }catch(e){
      console.error('v2.11.73 create training',e);
      if(trainingId)try{await sb.from('training_sessions').delete().eq('id',trainingId)}catch(_e){}
      toast(e?.message||'Training could not be created.');
      btn.disabled=false;btn.textContent=old;
    }
  }

  async function openEnhancedEdit(trainingId){
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!t)return;
    const hist=t.content_mode==='BUILT_IN'?await sb.rpc('training_content_history_v21173',{p_training_session_id:t.id}):{data:[]};
    const rows=hist.error?[]:(hist.data||[]);
    const current=rows.find(x=>x.is_current)||rows[0]||null;
    const files=(state.trainingFiles||[]).filter(x=>x.training_session_id===t.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    openModal('Edit training',`
      <div class="form-grid">
        <label>Training area<select id="v21173EditDomain"><option value="H&S" ${trainingDomain(t)==='H&S'?'selected':''}>H&S Training</option><option value="GENERAL" ${isGeneral(t)?'selected':''}>General / Operational Training</option></select></label>
        <label>Category<input id="v21173EditCategory" value="${esc(t.training_category||'')}" placeholder="Category"></label>
        <label class="full">Training name<input id="v21173EditName" value="${esc(t.name||'')}"></label>
        <label>Delivery method<select id="v21173EditDelivery"><option value="SELF_TRAINING" ${t.delivery_method==='SELF_TRAINING'?'selected':''}>Self-training</option><option value="INSTRUCTOR_LED" ${t.delivery_method==='INSTRUCTOR_LED'?'selected':''}>Instructor-led</option></select></label>
        <label>Review date<input id="v21173EditReview" type="date" value="${esc(t.review_date||'')}"></label>
        ${scheduleHtml('v21173Edit',t.renewal_value,t.renewal_unit,t.schedule_mode)}
        <label class="full">Description / instructions<textarea id="v21173EditDesc" rows="3">${esc(t.description||'')}</textarea></label>
      </div>
      ${t.content_mode==='BUILT_IN'?`<div class="section-card"><div class="row-between"><div><h4>Built-in content · v${Number(current?.version_number||t.content_revision||1)}</h4><p class="muted">Changing the text creates a new version; the previous version is retained.</p></div></div><textarea id="v21173EditContent" class="v21173-content-editor" rows="16">${esc(current?.content_body||'')}</textarea><label>Change summary <span class="muted">required when text changes</span><input id="v21173ChangeSummary" placeholder="What changed and why?"></label></div>
      <details class="section-card"><summary><strong>Content version history (${rows.length})</strong></summary><div class="v21173-version-history">${rows.map(v=>`<details><summary>v${v.version_number}${v.is_current?' · current':''} · ${new Date(v.created_at).toLocaleString('en-GB')}</summary><div class="muted">${esc(v.change_summary||'No change summary recorded')}</div><pre>${esc(v.content_body)}</pre></details>`).join('')}</div></details>`:
      `<div class="section-card"><h4>Uploaded material</h4><p class="muted">${files.length?files.map(f=>`${esc(f.file_name)} · ${new Date(f.created_at).toLocaleDateString('en-GB')}`).join('<br>'):'No uploaded file found.'}</p><label>Add new / replacement PDF<input id="v21173EditFiles" type="file" accept="application/pdf,.pdf" multiple></label><p class="muted">New files become the latest training material; earlier files remain retained in the training record.</p></div>`}
      <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21173-save-training-edit="${esc(t.id)}">Save changes</button></div>`);
    wireSchedule('v21173Edit');
    if(t.content_mode==='BUILT_IN'&&current)$('v21173EditContent').dataset.original=current.content_body||'';
  }

  async function saveEnhancedEdit(trainingId,btn){
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!t)return;
    const schedule=readSchedule('v21173Edit'),name=clean($('v21173EditName')?.value);
    if(!name)return toast('Training name is required.');
    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    try{
      const domain=$('v21173EditDomain')?.value||trainingDomain(t);
      const up=await sb.from('training_sessions').update({
        name,training_domain:domain,training_category:domain==='GENERAL'?(clean($('v21173EditCategory')?.value)||'General / Operational'):null,
        delivery_method:$('v21173EditDelivery')?.value||t.delivery_method,
        review_date:$('v21173EditReview')?.value||null,renewal_value:schedule.value,renewal_unit:schedule.unit,
        schedule_mode:schedule.mode,description:clean($('v21173EditDesc')?.value)||null
      }).eq('id',trainingId);
      if(up.error)throw up.error;

      if(t.content_mode==='BUILT_IN'){
        const body=String($('v21173EditContent')?.value||'').trim(),orig=$('v21173EditContent')?.dataset.original||'';
        if(body!==orig){
          const summary=clean($('v21173ChangeSummary')?.value);
          if(!summary)throw new Error('Add a short change summary before saving the new content version.');
          const vr=await sb.rpc('save_training_content_version_v21173',{
            p_training_session_id:trainingId,p_content_body:body,p_change_summary:summary
          });
          if(vr.error)throw vr.error;
        }
      }else{
        for(const f of [...($('v21173EditFiles')?.files||[])]){
          const path=`training/${trainingId}/${crypto.randomUUID()}-${safeName(f.name)}`;
          const upf=await sb.storage.from('safety-files').upload(path,f,{contentType:f.type||'application/pdf'});if(upf.error)throw upf.error;
          const fr=await sb.from('training_files').insert({training_session_id:trainingId,file_name:f.name,storage_path:path,uploaded_by:state.user.id,content_text_sha256:f.type==='application/pdf'&&api.hashPdf?await api.hashPdf(f):null});if(fr.error)throw fr.error;
        }
      }
      closeModal();await api.refresh('Training updated. Built-in content history has been retained.');
      await loadSupplemental();enhanceAll();
    }catch(e){toast(e?.message||'Training could not be saved.');btn.disabled=false;btn.textContent=old}
  }

  async function openBuiltInContent(trainingId,assignmentId=null){
    const t=(state.training||[]).find(x=>x.id===trainingId);if(!t)return;
    const r=await sb.rpc('training_content_history_v21173',{p_training_session_id:trainingId});
    if(r.error)return toast(r.error.message);
    const rows=r.data||[],v=rows.find(x=>x.is_current)||rows[0];
    if(!v)return toast('Built-in training content is missing.');
    if(assignmentId){
      const a=(state.trainingAssignments||[]).find(x=>x.id===assignmentId);
      if(a?.user_id===state.user.id){
        const m=await sb.rpc('mark_training_content_viewed_v21173',{p_assignment_id:assignmentId});
        if(!m.error)viewedKeys.add(`${assignmentId}|${v.id}`);
      }
    }
    currentContent.set(trainingId,{id:v.id,training_session_id:trainingId,version_number:v.version_number,is_current:true,created_at:v.created_at});
    openModal(`${t.name} · v${v.version_number}`,`<div class="hint-box"><strong>${isGeneral(t)?'General / Operational Training':'H&S Training'}</strong> · ${esc(t.delivery_method==='INSTRUCTOR_LED'?'Instructor-led':'Self-training')}${t.training_category?` · ${esc(t.training_category)}`:''}</div><article class="v21173-training-reader">${esc(v.content_body)}</article><div class="muted">Content version ${v.version_number} · issued ${new Date(v.created_at).toLocaleString('en-GB')}</div><div class="actions"><button class="primary" type="button" data-close-modal>Done</button></div>`);
    setTimeout(enhanceAssignmentActions,80);
  }

  function assignmentViewed(a,t){
    const v=currentContent.get(t.id);if(!v)return false;
    return viewedKeys.has(`${a.id}|${v.id}`);
  }
  function effectiveMethod(a,t){
    try{return window.effectiveTrainingMethod?window.effectiveTrainingMethod(t,a):(a.delivery_method_override||t.delivery_method||'SELF_TRAINING')}catch(_e){return a.delivery_method_override||t.delivery_method||'SELF_TRAINING'}
  }
  function enhanceAssignmentActions(){
    for(const sign of document.querySelectorAll('[data-sign-training]')){
      const aid=sign.dataset.signTraining,a=(state.trainingAssignments||[]).find(x=>x.id===aid),t=(state.training||[]).find(x=>x.id===a?.training_session_id);
      if(!a||!t||t.content_mode!=='BUILT_IN')continue;
      const card=sign.closest('.item-card')||sign.parentElement;
      if(card&&!card.querySelector(`[data-v21173-open-content="${CSS.escape(t.id)}|${CSS.escape(a.id)}"]`)){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21173OpenContent=`${t.id}|${a.id}`;b.textContent=assignmentViewed(a,t)?'Training content opened ✓':'Open training content';sign.insertAdjacentElement('beforebegin',b);
      }
      if(effectiveMethod(a,t)==='SELF_TRAINING'&&!assignmentViewed(a,t)){
        sign.disabled=true;sign.title='Open the current built-in training content first.';
      }else{
        sign.disabled=false;sign.title='';
      }
    }
    for(const view of document.querySelectorAll('#trainingList [data-view-training]')){
      const tid=view.dataset.viewTraining,t=(state.training||[]).find(x=>x.id===tid);
      if(!t||t.content_mode!=='BUILT_IN')continue;
      const bar=view.parentElement;
      if(bar&&!bar.querySelector(`[data-v21173-open-content="${CSS.escape(t.id)}|"]`)){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21173OpenContent=`${t.id}|`;b.textContent='Open content';bar.insertBefore(b,view);
      }
    }
  }

  function decorateTrainingHub(){
    const view=$('trainingView');if(!view)return;
    const heading=view.querySelector('.page-heading');if(!heading)return;
    const h2=heading.querySelector('h2'),p=heading.querySelector('p.muted'),newBtn=$('newTrainingBtn');
    if(h2)h2.textContent=isManager()?'Training':'My Training';
    if(p)p.textContent=isManager()?'H&S and General / Operational training in one controlled training hub.':'Your assigned standalone H&S and General / Operational training.';
    if(newBtn)newBtn.textContent='Create training';
    let hub=$('trainingHubV21173');
    if(!hub){
      hub=document.createElement('div');hub.id='trainingHubV21173';hub.className='section-card v21173-training-hub';
      heading.insertAdjacentElement('afterend',hub);
    }
    hub.innerHTML=`<div class="v21173-hub-grid">
      <button type="button" class="${trainingMode==='HS'?'primary':'secondary'}" data-v21173-training-mode="HS"><strong>H&S Training</strong><small>Safety-related standalone training</small></button>
      <button type="button" class="${trainingMode==='GENERAL'?'primary':'secondary'}" data-v21173-training-mode="GENERAL"><strong>General / Operational</strong><small>Hotel, service, systems and role training</small></button>
      ${isManager()?`<button type="button" class="secondary" data-v21173-training-nav="instructor"><strong>Instructor</strong><small>Attendance and instructor-led completion</small></button><button type="button" class="secondary" data-v21173-training-nav="reports"><strong>Training Reports</strong><small>Full current and historical reporting</small></button>`:''}
    </div>`;
  }

  function trainingByCard(card){
    const b=card.querySelector('[data-view-training]');return b?(state.training||[]).find(x=>x.id===b.dataset.viewTraining):null;
  }
  function filterTrainingCards(){
    const list=$('trainingList');if(!list)return;
    let visible=0;
    for(const card of list.querySelectorAll('.item-card')){
      const t=trainingByCard(card);if(!t)continue;
      const show=trainingMode==='GENERAL'?isGeneral(t):!isGeneral(t);
      card.hidden=!show;if(show)visible++;
      if(show&&!card.querySelector('.v21173-domain-badge')){
        const meta=card.querySelector('.meta');if(meta){const s=document.createElement('span');s.className='badge v21173-domain-badge';s.textContent=isGeneral(t)?'General / Operational':'H&S';meta.prepend(s)}
      }
    }
    if(!visible&&list.querySelectorAll('.item-card').length){
      let e=$('v21173NoTraining');if(!e){e=document.createElement('div');e.id='v21173NoTraining';e.className='empty';list.appendChild(e)}e.textContent=trainingMode==='GENERAL'?'No General / Operational training matches this filter.':'No standalone H&S training matches this filter.';
    }else $('v21173NoTraining')?.remove();

    const stats=$('trainingStats');
    if(stats&&isManager()){
      const courses=(state.training||[]).filter(t=>!t.auto_managed&&String(t.session_type)!=='TOOLBOX_TALK'&&t.status!=='ARCHIVED'&&(trainingMode==='GENERAL'?isGeneral(t):!isGeneral(t)));
      const assigns=(state.trainingAssignments||[]).filter(a=>a.active!==false&&courses.some(t=>t.id===a.training_session_id));
      const statusRows=assigns.map(a=>{const t=courses.find(x=>x.id===a.training_session_id);let s=null;try{s=window.assignmentStatus?.(a,t)}catch(_e){}return {a,t,s}});
      const overdue=statusRows.filter(x=>x.s?.code==='OVERDUE').length;
      const outstanding=statusRows.filter(x=>x.s&&x.s.code!=='COMPLETED'&&x.s.code!=='OVERDUE').length;
      const complete=statusRows.filter(x=>x.s?.code==='COMPLETED').length;
      stats.innerHTML=[
        ['Courses',courses.length,'neutral'],['Complete',complete,'green'],['Outstanding',outstanding,outstanding?'amber':'green'],['Overdue',overdue,overdue?'red':'green']
      ].map(([l,n,tr])=>`<div class="stat traffic-${tr}"><span class="traffic-dot"></span><strong>${n}</strong><span>${l}</span></div>`).join('');
    }
  }

  function keepGeneralOutOfHsTraining(){
    const list=$('hsTrainingList');if(!list)return;
    for(const card of list.querySelectorAll('.item-card')){
      const b=card.querySelector('[data-view-training]'),t=b?(state.training||[]).find(x=>x.id===b.dataset.viewTraining):null;
      if(t&&isGeneral(t))card.remove();
    }
  }

  function installComplianceSeparation(){
    if(typeof window.complianceRows==='function'&&!window.__hsComplianceSeparatedV21173){
      window.__hsComplianceSeparatedV21173=true;
      const base=window.complianceRows;
      window.complianceRows=function(){return base().filter(x=>!isGeneral(x.t))};
    }
    if(typeof window.reportTrainingRows==='function'&&!window.__hsReportTrainingSeparatedV21173){
      window.__hsReportTrainingSeparatedV21173=true;
      const base=window.reportTrainingRows;
      window.reportTrainingRows=function(){return base().filter(x=>!isGeneral(x.t))};
    }
    if(typeof window.monthlyReportData==='function'&&!window.__hsMonthlySeparatedV21173){
      window.__hsMonthlySeparatedV21173=true;
      const base=window.monthlyReportData;
      window.monthlyReportData=function(value){
        const d=base(value);
        const keep=x=>{
          const tid=x?.training_session_id||x?.t?.id||x?.training?.id||x?.a?.training_session_id||
            (x?.training_assignment_id?(state.trainingAssignments||[]).find(a=>a.id===x.training_assignment_id)?.training_session_id:null);
          const t=(state.training||[]).find(z=>z.id===tid);return !t||!isGeneral(t);
        };
        for(const k of ['completions','overdue','awaitingInstructor','outstanding','newAssignments','exceptions','retrainingTriggered']){
          if(Array.isArray(d[k]))d[k]=d[k].filter(keep);
        }
        return d;
      };
      if(api)api.monthlyReportData=window.monthlyReportData;
    }
  }

  async function groupMembershipMap(){
    const out=new Map();
    await Promise.all(groups.map(async g=>{
      const r=await sb.rpc('group_resolved_users_v21155',{p_group_id:g.id});
      if(r.error)return;
      for(const u of (r.data||[])){
        const id=u.user_id||u.id;if(!id)continue;
        if(!out.has(id))out.set(id,[]);
        out.get(id).push(g.name);
      }
    }));
    return out;
  }
  function userDepartmentsText(uid){
    const ids=(state.userDepartments||[]).filter(x=>x.user_id===uid).map(x=>x.department_id);
    return [...new Set(ids.map(id=>(state.departments||[]).find(d=>d.id===id)?.name).filter(Boolean))].join(', ');
  }
  function userPositionsText(uid){
    const ids=userPositions.filter(x=>x.user_id===uid&&x.active!==false).map(x=>x.position_id);
    return [...new Set(ids.map(id=>positions.find(p=>p.id===id)?.name).filter(Boolean))].join(', ');
  }
  function renewalText(t,a){
    const n=Number(a?.renewal_value||t?.renewal_value||0),u=String(a?.renewal_unit||t?.renewal_unit||'').toLowerCase();
    return n&&u?`${n} ${u}${n===1?'':'s'}`:(t?.schedule_mode==='ONE_OFF'?'One-off':'');
  }
  function materialText(t){
    if(t.content_mode==='BUILT_IN')return `Built-in content v${Number(t.content_revision||currentContent.get(t.id)?.version_number||1)}`;
    const files=(state.trainingFiles||[]).filter(f=>f.training_session_id===t.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(files.length)return files.map(f=>f.file_name).join('; ');
    if(t.source_document_id){const d=(state.documents||[]).find(x=>x.id===t.source_document_id);return `Controlled document: ${d?.reference||d?.title||'source'}`}
    return '';
  }

  async function downloadFullTrainingRegister(btn){
    if(!isManager())return toast('Manager or Admin access required.');
    if(!window.ExcelJS)return toast('Excel library did not load. Refresh and try again.');
    btn.disabled=true;const old=btn.textContent;btn.textContent='Creating full register…';
    try{
      const [gm,sitesR,siteAccessR,historyR]=await Promise.all([
        groupMembershipMap(),
        sb.from('organisation_sites_v21137').select('id,name').eq('active',true),
        sb.from('app_site_access_v21137').select('user_id,site_id,enabled,module_key').eq('module_key','safety').eq('enabled',true),
        sb.from('training_content_versions_v21173').select('*').order('created_at',{ascending:false})
      ]);
      const sites=sitesR.error?[]:(sitesR.data||[]),access=siteAccessR.error?[]:(siteAccessR.data||[]),history=historyR.error?[]:(historyR.data||[]);
      const siteText=uid=>[...new Set(access.filter(x=>x.user_id===uid).map(x=>sites.find(s=>s.id===x.site_id)?.name).filter(Boolean))].join(', ');
      const wb=new ExcelJS.Workbook();wb.creator='Safety Tracker';wb.created=new Date();wb.title='Full Training Register';
      const style=ws=>{
        ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:'A1',to:`${ws.getRow(1).getCell(ws.columnCount).address.replace(/\d+/,'')}1`};
        ws.getRow(1).font={bold:true};ws.getRow(1).alignment={vertical:'middle'};ws.eachRow(r=>r.alignment={vertical:'top',wrapText:true});
      };
      const summary=wb.addWorksheet('Summary');
      summary.addRows([
        ['Generated',new Date().toLocaleString('en-GB')],
        ['H&S active assignments',(state.trainingAssignments||[]).filter(a=>a.active!==false&&!isGeneral((state.training||[]).find(t=>t.id===a.training_session_id))).length],
        ['General / Operational active assignments',(state.trainingAssignments||[]).filter(a=>a.active!==false&&isGeneral((state.training||[]).find(t=>t.id===a.training_session_id))).length],
        ['Built-in courses',(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&t.content_mode==='BUILT_IN').length],
        ['Uploaded courses',(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&t.content_mode!=='BUILT_IN').length]
      ]);
      summary.getColumn(1).width=38;summary.getColumn(2).width=30;summary.getColumn(1).font={bold:true};

      const current=wb.addWorksheet('Current Assignments');
      current.columns=[
        ['Site','site',24],['Person','person',28],['Departments','departments',28],['Positions','positions',28],['Groups','groups',30],
        ['Area','domain',20],['Category','category',22],['Reference','reference',16],['Training','training',40],['Method','method',18],
        ['Assigned','assigned',20],['Due','due',16],['Status','status',20],['Completed','completed',20],['Instructor','instructor',24],
        ['Renewal','renewal',18],['Evidence / material','material',42],['Assignment source','origin',18]
      ].map(([header,key,width])=>({header,key,width}));
      for(const a of (state.trainingAssignments||[]).filter(x=>x.active!==false)){
        const t=(state.training||[]).find(x=>x.id===a.training_session_id);if(!t)continue;
        let st={code:'',label:'',due:a.due_date,method:a.delivery_method_override||t.delivery_method};try{st=window.assignmentStatus?.(a,t)||st}catch(_e){}
        const sign=(state.trainingSignoffs||[]).filter(s=>s.training_assignment_id===a.id).sort((x,y)=>new Date(y.signed_at)-new Date(x.signed_at))[0];
        current.addRow({
          site:siteText(a.user_id),person:personName(a.user_id),departments:userDepartmentsText(a.user_id),positions:userPositionsText(a.user_id),groups:(gm.get(a.user_id)||[]).join(', '),
          domain:isGeneral(t)?'General / Operational':'H&S',category:t.training_category||'',reference:t.reference||'',training:t.name||'',
          method:String(st.method||t.delivery_method||'').replaceAll('_',' '),assigned:a.assigned_at?new Date(a.assigned_at):null,due:st.due?new Date(String(st.due).length===10?st.due+'T00:00:00':st.due):null,
          status:st.label||st.code||'',completed:sign?.signed_at?new Date(sign.signed_at):null,instructor:sign?.trainer_snapshot||t.trainer_name||'',
          renewal:renewalText(t,a),material:materialText(t),origin:a.assignment_origin||'MANUAL'
        });
      }
      current.getColumn('assigned').numFmt='dd/mm/yyyy hh:mm';current.getColumn('due').numFmt='dd/mm/yyyy';current.getColumn('completed').numFmt='dd/mm/yyyy hh:mm';style(current);

      const hist=wb.addWorksheet('Completion History');
      hist.columns=[
        ['Completed','completed',20],['Site','site',24],['Person','person',28],['Departments','departments',28],['Positions','positions',28],['Groups','groups',30],
        ['Area','domain',20],['Category','category',22],['Reference','reference',16],['Training','training',40],['Method','method',18],
        ['Instructor','instructor',24],['Acknowledged by','ack',24],['Material','material',42]
      ].map(([header,key,width])=>({header,key,width}));
      for(const s of [...(state.trainingSignoffs||[])].sort((a,b)=>new Date(b.signed_at)-new Date(a.signed_at))){
        const a=(state.trainingAssignments||[]).find(x=>x.id===s.training_assignment_id),t=(state.training||[]).find(x=>x.id===(s.training_session_id||a?.training_session_id)),uid=s.user_id||a?.user_id;if(!t||!uid)continue;
        hist.addRow({completed:s.signed_at?new Date(s.signed_at):null,site:siteText(uid),person:personName(uid),departments:userDepartmentsText(uid),positions:userPositionsText(uid),groups:(gm.get(uid)||[]).join(', '),domain:isGeneral(t)?'General / Operational':'H&S',category:t.training_category||'',reference:t.reference||'',training:s.training_name_snapshot||t.name||'',method:String(a?.delivery_method_override||t.delivery_method||'').replaceAll('_',' '),instructor:s.trainer_snapshot||t.trainer_name||'',ack:s.signature_name||personName(uid),material:materialText(t)});
      }
      hist.getColumn('completed').numFmt='dd/mm/yyyy hh:mm';style(hist);

      const cat=wb.addWorksheet('Course Register');
      cat.columns=[
        ['Area','domain',20],['Category','category',22],['Reference','reference',16],['Training','training',42],['Method','method',18],['Source','source',20],
        ['Content version','version',16],['Review date','review',16],['Schedule','schedule',18],['Status','status',14],['Active assignments','assigned',18]
      ].map(([header,key,width])=>({header,key,width}));
      for(const t of [...(state.training||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))){
        cat.addRow({domain:isGeneral(t)?'General / Operational':'H&S',category:t.training_category||'',reference:t.reference||'',training:t.name||'',method:String(t.delivery_method||'').replaceAll('_',' '),source:t.content_mode==='BUILT_IN'?'Built-in':t.source_document_id?'Controlled document':'Uploaded file',version:t.content_mode==='BUILT_IN'?`v${Number(t.content_revision||1)}`:(t.source_document_version_id||''),review:t.review_date?new Date(t.review_date+'T00:00:00'):null,schedule:renewalText(t,null),status:t.status||'',assigned:(state.trainingAssignments||[]).filter(a=>a.training_session_id===t.id&&a.active!==false).length});
      }
      cat.getColumn('review').numFmt='dd/mm/yyyy';style(cat);

      const changes=wb.addWorksheet('Built-in Change History');
      changes.columns=[
        ['Training','training',42],['Area','domain',20],['Content version','version',16],['Change summary','summary',52],['Changed by','by',28],['Changed at','at',20]
      ].map(([header,key,width])=>({header,key,width}));
      for(const v of history){
        const t=(state.training||[]).find(x=>x.id===v.training_session_id);if(!t)continue;
        changes.addRow({training:t.name||'',domain:isGeneral(t)?'General / Operational':'H&S',version:`v${v.version_number}`,summary:v.change_summary||'',by:personName(v.created_by),at:v.created_at?new Date(v.created_at):null});
      }
      changes.getColumn('at').numFmt='dd/mm/yyyy hh:mm';style(changes);

      const bytes=await wb.xlsx.writeBuffer();
      const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Safety-Tracker-Full-Training-Register-${today()}.xlsx`;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},30000);
      toast('Full Training Register downloaded.');
    }catch(e){console.error('v2.11.73 training report',e);toast(e?.message||'Training report failed.')}finally{btn.disabled=false;btn.textContent=old}
  }

  function decorateReports(){
    const grid=document.querySelector('#reportsView .button-grid.report-manager-content');if(!grid||grid.querySelector('[data-v21173-full-training-report]'))return;
    const b=document.createElement('button');b.type='button';b.className='primary';b.dataset.v21173FullTrainingReport='1';b.textContent='Full Training Register (Excel)';grid.appendChild(b);
  }

  function enhanceAll(){
    decorateTrainingHub();filterTrainingCards();keepGeneralOutOfHsTraining();decorateReports();enhanceAssignmentActions();
    if($('modal')?.open)setTimeout(decorateAudienceSections,0);
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      const create=e.target.closest?.('#newTrainingBtn');
      if(create&&isManager()){e.preventDefault();e.stopImmediatePropagation();openCreateTraining();return}

      const saveNew=e.target.closest?.('[data-v21173-save-new-training]');
      if(saveNew){e.preventDefault();e.stopImmediatePropagation();void saveNewTraining(saveNew);return}

      const edit=e.target.closest?.('[data-edit-training]');
      if(edit){
        const t=(state.training||[]).find(x=>x.id===edit.dataset.editTraining);
        if(t&&(t.content_mode==='BUILT_IN'||isGeneral(t))){
          e.preventDefault();e.stopImmediatePropagation();void openEnhancedEdit(t.id);return;
        }
      }
      const saveEdit=e.target.closest?.('[data-v21173-save-training-edit]');
      if(saveEdit){e.preventDefault();e.stopImmediatePropagation();void saveEnhancedEdit(saveEdit.dataset.v21173SaveTrainingEdit,saveEdit);return}

      const content=e.target.closest?.('[data-v21173-open-content]');
      if(content){
        e.preventDefault();e.stopImmediatePropagation();
        const [tid,aid]=String(content.dataset.v21173OpenContent||'').split('|');void openBuiltInContent(tid,aid||null);return;
      }

      const sign=e.target.closest?.('[data-sign-training]');
      if(sign){
        const aid=sign.dataset.signTraining,a=(state.trainingAssignments||[]).find(x=>x.id===aid),t=(state.training||[]).find(x=>x.id===a?.training_session_id);
        if(a&&t&&t.content_mode==='BUILT_IN'&&effectiveMethod(a,t)==='SELF_TRAINING'&&!assignmentViewed(a,t)){
          e.preventDefault();e.stopImmediatePropagation();void openBuiltInContent(t.id,a.id);return;
        }
      }

      const mode=e.target.closest?.('[data-v21173-training-mode]');
      if(mode){
        e.preventDefault();e.stopImmediatePropagation();trainingMode=mode.dataset.v21173TrainingMode==='GENERAL'?'GENERAL':'HS';
        try{localStorage.setItem('safetyTrainingModeV21173',trainingMode)}catch(_e){}
        decorateTrainingHub();filterTrainingCards();return;
      }
      const nav=e.target.closest?.('[data-v21173-training-nav]');
      if(nav){
        e.preventDefault();e.stopImmediatePropagation();
        const view=nav.dataset.v21173TrainingNav==='reports'?'reports':'instructor';
        document.querySelector(`#mainNav button[data-view="${view}"]`)?.click();return;
      }
      const report=e.target.closest?.('[data-v21173-full-training-report]');
      if(report){e.preventDefault();e.stopImmediatePropagation();void downloadFullTrainingRegister(report);return}

      const navBtn=e.target.closest?.('#mainNav button[data-view]');
      if(navBtn)setTimeout(enhanceAll,120);
    },true);

    const body=$('modalBody');
    if(body&&typeof MutationObserver==='function'){
      new MutationObserver(()=>{if($('modal')?.open)setTimeout(decorateAudienceSections,0)}).observe(body,{childList:true,subtree:true});
    }
    const app=$('appView')||document.body;
    if(app&&typeof MutationObserver==='function'&&!observer){
      let pending=false;
      observer=new MutationObserver(()=>{
        if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhanceAll()});
      });
      observer.observe(app,{childList:true,subtree:true});
    }
    window.addEventListener('pageshow',()=>setTimeout(enhanceAll,180));
  }

  function installStyles(){
    if($('trainingHubStylesV21173'))return;
    const s=document.createElement('style');s.id='trainingHubStylesV21173';s.textContent=`
      .v21173-hub-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .v21173-hub-grid button{min-height:92px;text-align:left;padding:14px}
      .v21173-hub-grid button strong,.v21173-hub-grid button small{display:block}
      .v21173-hub-grid button small{margin-top:6px;opacity:.8;line-height:1.35}
      .v21173-audience-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
      .v21173-audience-grid details{border:1px solid var(--border,#475569);border-radius:10px;overflow:hidden}
      .v21173-audience-grid summary{padding:10px 12px;font-weight:700;cursor:pointer}
      .v21173-audience-grid .checkbox-list{border-top:1px solid var(--border,#475569);max-height:220px;overflow:auto}
      .v21173-content-editor{width:100%;min-height:320px;white-space:pre-wrap}
      .v21173-training-reader{white-space:pre-wrap;line-height:1.65;font-size:1rem;padding:14px 2px}
      .v21173-version-history details{border-top:1px solid var(--border,#475569);padding:8px 0}
      .v21173-version-history pre{white-space:pre-wrap;max-height:300px;overflow:auto;font:inherit;background:rgba(255,255,255,.03);padding:10px;border-radius:8px}
      .positions-audience-v21173 .checkbox-list{max-height:220px;overflow:auto}
      @media(max-width:760px){
        .v21173-hub-grid{grid-template-columns:1fr 1fr}
        .v21173-audience-grid{grid-template-columns:1fr}
        .v21173-hub-grid button{min-height:84px}
        .v21173-content-editor{min-height:380px}
      }
    `;document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    if(!state.user){setTimeout(boot,160);return}
    try{trainingMode=localStorage.getItem('safetyTrainingModeV21173')==='GENERAL'?'GENERAL':'HS'}catch(_e){}
    installStyles();
    await loadSupplemental();
    installRpcBridge();
    installComplianceSeparation();
    installEvents();
    [100,350,850].forEach(ms=>setTimeout(enhanceAll,ms));
    window.SafetyTrainingHubV21173={reload:async()=>{await loadSupplemental();enhanceAll()},create:openCreateTraining,report:downloadFullTrainingRegister};
  }
  boot().catch(e=>console.warn('Safety Tracker v2.11.73 Training Hub',e));
})();

