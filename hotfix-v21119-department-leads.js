/* Safety Tracker v2.11.19 amendment - Department Lead assignment */
'use strict';
(function(){
  if(window.__SAFETY_DEPARTMENT_LEADS_V21119)return;
  window.__SAFETY_DEPARTMENT_LEADS_V21119=true;

  let api,state,sb,leads=[];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const isAdmin=()=>state?.profile?.role==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const activeDepartments=()=> (state.departments||[]).filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activePeople=()=> (state.people||[]).filter(p=>p.active!==false&&p.report_only!==true);
  const personName=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Unknown user'};

  async function loadLeads(){
    if(!isAdmin()&&!['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()))return;
    const r=await sb.from('department_leads_v21119').select('*');
    if(!r.error){
      leads=r.data||[];
      state.departmentLeadsV21119=leads;
    }else console.warn('Department leads v2.11.19',r.error);
  }

  function leadIdsForUser(uid){return leads.filter(x=>x.user_id===uid).map(x=>x.department_id)}
  function leadNamesForDepartment(did){return leads.filter(x=>x.department_id===did).map(x=>personName(x.user_id)).filter(Boolean)}
  function belongsToDepartment(uid,did){return (state.userDepartments||[]).some(x=>x.user_id===uid&&x.department_id===did)}

  async function setUserLeads(uid,departmentIds){
    const r=await sb.rpc('set_user_department_leads_v21119',{
      p_user_id:uid,
      p_department_ids:[...new Set((departmentIds||[]).filter(Boolean))]
    });
    if(r.error)throw r.error;
    await loadLeads();
  }

  function appendInviteLeadControl(){
    const body=$('modalBody'),dept=$('inviteDepartment');
    if(!body||!dept||$('inviteDepartmentLead'))return;
    const role=$('inviteRole');
    const hint=body.querySelector('.hint-box');
    const wrap=document.createElement('div');
    wrap.className='section-card full';
    wrap.id='inviteDepartmentLeadWrap';
    wrap.innerHTML=`<label class="check-row"><input id="inviteDepartmentLead" type="checkbox"> <strong>Department lead for the selected department</strong></label>
      <p class="muted">This is separate from Role / access. A User, Manager or Admin can be the Department Lead. It records responsibility for that department; it does not automatically give wider app permissions.</p>`;
    if(hint)hint.insertAdjacentElement('beforebegin',wrap); else body.querySelector('.form-grid')?.appendChild(wrap);

    const sync=()=>{
      const report=role?.value==='report_viewer';
      const noDept=!dept.value;
      const box=$('inviteDepartmentLead');
      if(box){
        box.disabled=report||noDept;
        if(box.disabled)box.checked=false;
      }
      wrap.style.opacity=(report||noDept)?'.6':'1';
    };
    dept.addEventListener('change',sync); role?.addEventListener('change',sync); sync();
  }

  function appendEditLeadControls(userId){
    const body=$('modalBody');
    if(!body||$('editDepartmentLeadSection'))return;
    const current=new Set(leadIdsForUser(userId));
    const section=document.createElement('div');
    section.className='section-card';
    section.id='editDepartmentLeadSection';
    section.innerHTML=`<h4>Department Lead</h4>
      <p class="muted">Choose the department(s) this person leads. They must also belong to the department. This is separate from their app Role / access.</p>
      <div class="checkbox-list">${activeDepartments().map(d=>`<label class="check-row"><input type="checkbox" class="v21119-dept-lead-choice" value="${d.id}" ${current.has(d.id)?'checked':''}>${esc(d.name)}</label>`).join('')||'No departments configured.'}</div>`;
    const action=body.querySelector('.actions');
    if(action)action.insertAdjacentElement('beforebegin',section); else body.appendChild(section);
  }

  function selectedMembershipsFromEdit(){
    const primary=$('roleDepartment')?.value||'';
    const extras=[...document.querySelectorAll('.role-extra-dept:checked')].map(x=>x.value);
    return new Set([primary,...extras].filter(Boolean));
  }

  function selectedLeadIdsFromEdit(){
    return [...document.querySelectorAll('.v21119-dept-lead-choice:checked')].map(x=>x.value);
  }

  function decorateDepartments(){
    const list=$('departmentList');if(!list)return;
    list.querySelectorAll('[data-edit-department]').forEach(btn=>{
      const did=btn.dataset.editDepartment,card=btn.closest('.item-card');
      if(!card||card.querySelector(`[data-v21119-dept-leads="${did}"]`))return;
      const names=leadNamesForDepartment(did);
      const meta=card.querySelector('.meta');
      if(meta){
        const span=document.createElement('span');
        span.dataset.v21119DeptLeads=did;
        span.textContent=names.length?`Lead: ${names.join(', ')}`:'Lead: not assigned';
        meta.prepend(span);
      }
    });
  }

  function decoratePeople(){
    const list=$('peopleList');if(!list)return;
    list.querySelectorAll('[data-set-role]').forEach(btn=>{
      const uid=btn.dataset.setRole,card=btn.closest('.item-card');
      if(!card||card.querySelector(`[data-v21119-user-lead="${uid}"]`))return;
      const ids=leadIdsForUser(uid);
      if(!ids.length)return;
      const names=ids.map(id=>(state.departments||[]).find(d=>d.id===id)?.name).filter(Boolean);
      const meta=card.querySelector('.meta');
      if(meta&&names.length){
        const span=document.createElement('span');
        span.dataset.v21119UserLead=uid;
        span.textContent=`Department Lead: ${names.join(', ')}`;
        meta.appendChild(span);
      }
    });
  }

  function installPatches(){
    const originalSendInvite=window.sendInvite;
    if(typeof originalSendInvite==='function'){
      window.sendInvite=async function(){
        const email=clean($('inviteEmail')?.value).toLowerCase();
        const dept=$('inviteDepartment')?.value||'';
        const makeLead=!!$('inviteDepartmentLead')?.checked;
        await originalSendInvite();
        if(!makeLead||!dept||!email)return;
        try{
          let p=null;
          if(typeof window.findProfileByEmail==='function')p=await window.findProfileByEmail(email);
          if(!p){
            for(let i=0;i<8&&!p;i++){
              const r=await sb.from('profiles').select('*').ilike('email',email).limit(1);
              p=r.data?.[0]||null;
              if(!p)await new Promise(resolve=>setTimeout(resolve,350));
            }
          }
          if(!p)return api.toast?.('User invited. Department Lead can be set from People once the new profile finishes creating.');
          await setUserLeads(p.id,[dept]);
          api.toast?.(`Invitation sent. ${personName(p.id)} is set as Department Lead.`);
        }catch(e){
          console.warn('Department Lead invite assignment',e);
          api.toast?.(`User invited, but Department Lead was not saved: ${e.message||e}`);
        }
      };
    }

    const originalShowSetRole=window.showSetRole;
    if(typeof originalShowSetRole==='function'){
      window.showSetRole=function(id){
        originalShowSetRole(id);
        appendEditLeadControls(id);
      };
    }

    const originalSaveRole=window.saveRole;
    if(typeof originalSaveRole==='function'){
      window.saveRole=async function(id){
        const requested=$('roleSelect')?.value||'user';
        const membership=selectedMembershipsFromEdit();
        let leadIds=selectedLeadIdsFromEdit();
        if(requested==='report_viewer')leadIds=[];
        const invalid=leadIds.filter(x=>!membership.has(x));
        if(invalid.length){
          const names=invalid.map(x=>(state.departments||[]).find(d=>d.id===x)?.name||'department').join(', ');
          return api.toast?.(`Department Lead must also belong to that department. Add ${names} as Primary/Additional department or untick Department Lead.`);
        }
        await originalSaveRole(id);
        try{
          await setUserLeads(id,leadIds);
          if(typeof window.renderPeople==='function')window.renderPeople();
          if(typeof window.renderDepartments==='function')window.renderDepartments();
          api.toast?.(leadIds.length?'User details and Department Lead responsibility updated.':'User details updated.');
        }catch(e){
          console.warn('Department Lead user save',e);
          api.toast?.(`User details saved, but Department Lead could not be updated: ${e.message||e}`);
        }
      };
    }

    const originalRenderDepartments=window.renderDepartments;
    if(typeof originalRenderDepartments==='function'){
      window.renderDepartments=function(){
        originalRenderDepartments();
        loadLeads().then(decorateDepartments).catch(console.warn);
      };
    }

    const originalRenderPeople=window.renderPeople;
    if(typeof originalRenderPeople==='function'){
      window.renderPeople=function(){
        originalRenderPeople();
        loadLeads().then(decoratePeople).catch(console.warn);
      };
    }

    // The Invite User button already has a direct base listener, so augment its modal
    // immediately after the existing handler opens it.
    document.addEventListener('click',e=>{
      const invite=e.target.closest?.('#inviteUserBtn');
      if(invite)setTimeout(appendInviteLeadControl,0);
      const setRole=e.target.closest?.('[data-set-role]');
      if(setRole)setTimeout(()=>appendEditLeadControls(setRole.dataset.setRole),0);
    },true);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    await loadLeads();
    installPatches();
    decorateDepartments();decoratePeople();
    window.SafetyDepartmentLeadsV21119={load:loadLeads,setUserLeads,leadIdsForUser,leadNamesForDepartment};
  }
  boot();
})();
