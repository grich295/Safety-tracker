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
