/* Safety Tracker v2.11.58 CLEAN
   Profile permissions:
   - One Head of Department (HOD) per department, enforced in the database.
   - HOD is selected from the person's profile and automatically becomes that
     department's responsible Department Manager.
   - The HOD department is taken from the person's Main/Default position.
   - Multiple Supervisors are allowed; Supervisor remains an ordinary position/title.
   - "Can carry out instructor-led training" is shown clearly in Profile permissions.
*/
'use strict';
(function(){
  if(window.__SAFETY_PROFILE_PERMISSIONS_V21158)return;
  window.__SAFETY_PROFILE_PERMISSIONS_V21158=true;

  let api=null,state=null,sb=null;
  let links=[],caps=[],hods=[];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const admin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const toast=msg=>{try{api?.toast?.(msg)}catch(_e){console.log(msg)}};

  function personName(id){
    const p=(state?.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||'User';
  }

  async function loadBadges(){
    if(!sb||!state?.user)return;
    const [l,c,h]=await Promise.all([
      sb.from('shared_safety_user_links_v21148').select('*'),
      sb.from('app_user_capabilities_v21137')
        .select('*')
        .eq('module_key','safety')
        .eq('capability_key','training_instructor')
        .eq('scope_type','APP')
        .eq('scope_id',''),
      sb.from('safety_responsibilities_v21069')
        .select('*')
        .eq('responsibility_type','DEPARTMENT_MANAGER')
        .eq('active',true)
    ]);
    links=l.error?[]:(l.data||[]);
    caps=c.error?[]:(c.data||[]);
    hods=h.error?[]:(h.data||[]);
  }

  function linkedSafetyId(sourceId){
    return links.find(x=>x.source_user_id===sourceId)?.safety_user_id||null;
  }
  function instructorOn(userId){
    return caps.some(x=>x.user_id===userId&&x.enabled===true);
  }
  function hodOn(userId){
    return hods.some(x=>x.user_id===userId);
  }

  function permissionBadges(userId){
    if(!userId)return '<span class="badge neutral">Safety access required</span>';
    return `
      <span class="badge ${hodOn(userId)?'complete':'neutral'}">${hodOn(userId)?'HOD':'Not HOD'}</span>
      <span class="badge ${instructorOn(userId)?'complete':'neutral'}">${instructorOn(userId)?'Training instructor':'Instructor OFF'}</span>`;
  }

  function decoratePeopleCards(){
    if(!admin())return;
    const root=$('peopleV21149Content');
    if(!root)return;

    root.querySelectorAll('[data-v21149-edit-shared]').forEach(btn=>{
      const sourceId=btn.dataset.v21149EditShared;
      const userId=linkedSafetyId(sourceId);
      const card=btn.closest('.item-card');
      if(!card)return;

      let wrap=card.querySelector('.profile-permissions-v21158');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.className='profile-permissions-v21158';
        const row=btn.closest('.people-card-row-v21149');
        row?.insertAdjacentElement('afterend',wrap);
      }
      wrap.innerHTML=`
        <div class="profile-permission-badges-v21158">${permissionBadges(userId)}</div>
        ${userId
          ? `<button class="secondary profile-permission-btn-v21158" type="button" data-v21158-profile-user="${esc(userId)}">Profile permissions</button>`
          : '<span class="muted">Give Safety access first, then set HOD / instructor permission.</span>'}`;
    });

    root.querySelectorAll('[data-v21149-edit-safety]').forEach(btn=>{
      const userId=btn.dataset.v21149EditSafety;
      const card=btn.closest('.item-card');
      if(!card)return;
      let wrap=card.querySelector('.profile-permissions-v21158');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.className='profile-permissions-v21158';
        const row=btn.closest('.people-card-row-v21149');
        row?.insertAdjacentElement('afterend',wrap);
      }
      wrap.innerHTML=`
        <div class="profile-permission-badges-v21158">${permissionBadges(userId)}</div>
        <button class="secondary profile-permission-btn-v21158" type="button" data-v21158-profile-user="${esc(userId)}">Profile permissions</button>`;
    });
  }

  async function profileState(userId){
    const r=await sb.rpc('user_profile_permissions_v21158',{p_user_id:userId});
    if(r.error)throw r.error;
    return Array.isArray(r.data)?r.data[0]:r.data;
  }

  async function openProfilePermissions(userId){
    if(!admin())return;
    let x;
    try{x=await profileState(userId)}catch(e){return toast(e.message)}
    if(!x)return toast('Profile not found.');

    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Profile permissions';

    const hasDepartment=!!x.primary_department_id;
    const replacing=x.current_department_hod_user_id &&
      x.current_department_hod_user_id!==userId;

    body.innerHTML=`
      <div class="section-card">
        <h3>${esc(x.display_name||personName(userId))}</h3>
        <div class="meta">
          <span>Main position: ${esc(x.primary_position_name||'Not set')}</span>
          <span>Main department: ${esc(x.primary_department_name||'Not set')}</span>
        </div>
      </div>

      <div class="section-card permission-highlight-v21158">
        <h4>Head of Department (HOD)</h4>
        <label class="check-row">
          <input id="profileIsHodV21158" type="checkbox" ${x.is_hod?'checked':''} ${hasDepartment?'':'disabled'}>
          Head of Department (HOD) for ${esc(x.primary_department_name||'Main/Default department')}
        </label>
        ${hasDepartment
          ? `<p class="muted"><strong>One HOD only:</strong> the app enforces one active HOD per department. Selecting this automatically makes this person the Department Manager / responsible owner for ${esc(x.primary_department_name)}.</p>`
          : '<div class="hint-box"><strong>Set a Main/Default position first.</strong> HOD is automatically tied to that position’s department.</div>'}
        ${replacing
          ? `<div class="danger-note"><strong>Current HOD:</strong> ${esc(x.current_department_hod_name||'Another person')}. Saving with HOD ticked will replace them as the single HOD for this department.</div>`
          : ''}
      </div>

      <div class="section-card permission-highlight-v21158">
        <h4>Instructor-led training</h4>
        <label class="check-row instructor-toggle-v21158">
          <input id="profileCanTrainV21158" type="checkbox" ${x.can_carry_out_training?'checked':''}>
          <strong>Can carry out instructor-led training</strong>
        </label>
        <p class="muted">
          Tick this for a Supervisor or other suitable person without making them a Safety Manager.
          They can deliver instructor-led training for people in their own Department(s).
          The HOD / Department Manager still owns completion responsibility unless manually overridden.
        </p>
      </div>

      <div class="hint-box">
        <strong>Supervisors:</strong> there can be multiple Supervisors in the same department.
        Supervisor is a normal position/title and does not make somebody HOD automatically.
        Tick <strong>Can carry out instructor-led training</strong> for any Supervisor who is authorised to train.
      </div>

      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21158-save-profile="${esc(userId)}">Save profile permissions</button>
      </div>`;

    if(!modal.open)modal.showModal();
  }

  async function saveProfilePermissions(userId,btn){
    const isHod=!!$('profileIsHodV21158')?.checked;
    const canTrain=!!$('profileCanTrainV21158')?.checked;

    let current;
    try{current=await profileState(userId)}catch(e){return toast(e.message)}
    if(
      isHod &&
      current?.current_department_hod_user_id &&
      current.current_department_hod_user_id!==userId
    ){
      const ok=confirm(
        `${current.primary_department_name} already has ${current.current_department_hod_name||'another person'} as HOD.\n\n`+
        `Continue and replace them with ${current.display_name}? There can only be one HOD per department.`
      );
      if(!ok)return;
    }

    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    const r=await sb.rpc('set_profile_operational_permissions_v21158',{
      p_user_id:userId,
      p_is_hod:isHod,
      p_can_carry_out_training:canTrain
    });
    if(r.error){btn.disabled=false;btn.textContent=old;return toast(r.error.message)}

    try{$('modal')?.close()}catch(_e){}
    await loadBadges();
    decoratePeopleCards();
    decorateHodAdminSection();
    try{await window.SafetyGroupsV21155?.reload?.()}catch(_e){}
    try{await window.SafetyInstructorResponsibilityV21156?.reload?.()}catch(_e){}
    toast('Profile permissions saved.');
  }

  async function decorateHodAdminSection(){
    if(!admin())return;
    const card=$('positionsResponsibilities69');
    if(!card)return;
    const heading=[...card.querySelectorAll('h4')].find(h=>
      /department responsible managers/i.test(h.textContent||'') ||
      /^heads of department/i.test(h.textContent||'')
    );
    const section=heading?.closest('.section-card');
    if(!section)return;

    const [deps,resps]=await Promise.all([
      sb.from('departments').select('id,name,active').eq('active',true).order('name'),
      sb.from('safety_responsibilities_v21069')
        .select('department_id,user_id')
        .eq('responsibility_type','DEPARTMENT_MANAGER')
        .eq('active',true)
    ]);
    if(deps.error||resps.error)return;

    section.innerHTML=`
      <h4>Heads of Department (HOD)</h4>
      <p class="muted">
        There can be <strong>one HOD per department</strong>. Set or change HOD from
        <strong>People & Access → Profile permissions</strong>. The person's Main/Default position chooses the department automatically.
        Multiple Supervisors are allowed.
      </p>
      <div class="card-list">
        ${(deps.data||[]).map(d=>{
          const r=(resps.data||[]).find(x=>x.department_id===d.id);
          return `<div class="item-card compact">
            <div class="row-between">
              <div><strong>${esc(d.name)}</strong><div class="muted">${r?`HOD: ${esc(personName(r.user_id))}`:'HOD not assigned'}</div></div>
              <span class="badge ${r?'complete':'due'}">${r?'1 HOD':'Needs HOD'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="actions">
        <button class="secondary" type="button" data-v21158-open-people>Open People & Access</button>
      </div>`;
  }

  function helpCard(){
    const grid=document.querySelector('#helpContent .role-help-grid');
    if(!grid||grid.querySelector('[data-help-profile-permissions-v21158]')||!admin())return;
    const el=document.createElement('article');
    el.className='role-help-action help-v21150-card';
    el.dataset.helpProfilePermissionsV21158='1';
    el.dataset.helpV21150Search='hod head department supervisor training instructor profile permissions';
    el.innerHTML=`
      <div class="role-help-action-copy">
        <span class="role-help-group">Sites & access</span>
        <h3>HOD & training instructor permissions</h3>
        <p>Each department can have one HOD, selected from the person's profile. Multiple Supervisors are allowed. Tick Can carry out instructor-led training for authorised Supervisors or other trainers.</p>
      </div>
      <button class="primary role-help-go" type="button" data-v21158-open-people>Go there</button>`;
    grid.appendChild(el);
  }

  function openPeople(){
    if(window.SafetyPeopleSitesV21149?.openPeople)window.SafetyPeopleSitesV21149.openPeople();
    else window.SafetyPeopleSitesV21146?.openPeople?.();
    [120,350,700].forEach(ms=>setTimeout(async()=>{
      await loadBadges();
      decoratePeopleCards();
    },ms));
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      const p=e.target.closest?.('[data-v21158-profile-user]');
      if(p){
        e.preventDefault();e.stopImmediatePropagation();
        openProfilePermissions(p.dataset.v21158ProfileUser);return;
      }
      const save=e.target.closest?.('[data-v21158-save-profile]');
      if(save){
        e.preventDefault();e.stopImmediatePropagation();
        saveProfilePermissions(save.dataset.v21158SaveProfile,save);return;
      }
      if(e.target.closest?.('[data-v21158-open-people]')){
        e.preventDefault();e.stopImmediatePropagation();openPeople();return;
      }

      if(e.target.closest?.(
        '[data-v21149-people],'+
        '#mainNav button[data-view="people"],'+
        '[data-v21149-refresh-users]'
      )){
        [150,400,900].forEach(ms=>setTimeout(async()=>{
          await loadBadges();
          decoratePeopleCards();
        },ms));
      }

      if(e.target.closest?.('#mainNav button[data-view="admin"]')){
        [220,550,1000].forEach(ms=>setTimeout(decorateHodAdminSection,ms));
      }

      if(e.target.closest?.('#mainNav button[data-view="help"]')){
        [200,500,1000].forEach(ms=>setTimeout(helpCard,ms));
      }
    },true);

    window.addEventListener('pageshow',()=>{
      [180,500,1200].forEach(ms=>setTimeout(async()=>{
        await loadBadges();
        decoratePeopleCards();
        decorateHodAdminSection();
        helpCard();
      },ms));
    });
  }

  function styles(){
    if($('profilePermissionsStylesV21158'))return;
    const s=document.createElement('style');
    s.id='profilePermissionsStylesV21158';
    s.textContent=`
      .profile-permissions-v21158{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--border,#334155)}
      .profile-permission-badges-v21158{display:flex;gap:6px;flex-wrap:wrap}
      .profile-permission-btn-v21158{min-height:42px}
      .permission-highlight-v21158{border-width:2px}
      .instructor-toggle-v21158{font-size:1.05rem}
      @media(max-width:700px){
        .profile-permissions-v21158{display:block}
        .profile-permission-btn-v21158{width:100%;margin-top:8px}
      }
    `;
    document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,100);return}
    state=api.state;sb=api.sb;
    if(!state.user)return;
    styles();
    await loadBadges();
    installEvents();
    [160,450,1000].forEach(ms=>setTimeout(()=>{
      decoratePeopleCards();
      decorateHodAdminSection();
      helpCard();
    },ms));
    window.SafetyProfilePermissionsV21158={
      open:openProfilePermissions,
      refresh:async()=>{await loadBadges();decoratePeopleCards();decorateHodAdminSection()}
    };
  }

  boot().catch(e=>console.warn('Profile permissions v2.11.58',e));
})();
