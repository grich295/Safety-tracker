/* Safety Tracker v2.11.37 CLEAN - People & Access
   - Username or email sign-in.
   - Username-only accounts use a private internal auth email and a one-time temporary password.
   - Admin/Manager can switch to a simple day-to-day User view without changing real permissions.
   - Safety app access, role, preferred view, home/additional sites and optional capabilities are separate.
   - Existing Department/Position/H&S/PPE/First Aid responsibility records remain separate and are not erased.
*/
'use strict';
(function(){
  if(window.__SAFETY_PEOPLE_ACCESS_V21137)return;
  window.__SAFETY_PEOPLE_ACCESS_V21137=true;

  let api,state,sb,accessRows=[],siteRows=[],capRows=[];
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>clean(v).toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,50);
  const internalEmail=u=>`${slug(u)}@users.invalid`;
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true;
  const isManagerBase=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true;
  const accessFor=id=>accessRows.find(x=>x.user_id===id&&x.module_key==='safety')||null;
  const sitesFor=id=>siteRows.filter(x=>x.user_id===id&&x.module_key==='safety');
  const capsFor=id=>capRows.filter(x=>x.user_id===id&&x.module_key==='safety'&&x.enabled!==false);
  const person=id=>(state.people||[]).find(x=>x.id===id)||null;
  const personName=id=>{const p=person(id);return p?.display_name||p?.login_username||p?.email||'User'};
  const generatedPassword=()=>{const words=['River','Maple','Harbour','Copper','Oak','Stone','Glass','Blue'];return `${words[Math.floor(Math.random()*words.length)]}-${Math.floor(1000+Math.random()*9000)}-${words[Math.floor(Math.random()*words.length)]}!`;};
  const userViewKey=()=>`safetyTrackerWorkingViewV21137:${state.user?.id||'unknown'}`;
  const userViews=new Set(['mySafety','training','hsTraining','awareness','checklists','onsite','asbestos','help']);

  function openModal(title,html){
    if(typeof window.openModal==='function')return window.openModal(title,html);
    const m=$('modal'),t=$('modalTitle'),b=$('modalBody');if(t)t.textContent=title;if(b)b.innerHTML=html;if(m&&!m.open)m.showModal();
  }
  function closeModal(){try{$('modal')?.close()}catch(_e){}}
  function toast(msg){try{api.toast?.(msg)}catch(_e){alert(msg)}}

  async function loadAccess(){
    if(!state?.user)return;
    const jobs=[
      sb.from('app_module_access_v21137').select('*'),
      sb.from('app_site_access_v21137').select('*'),
      sb.from('organisation_sites_v21137').select('*').order('name'),
      sb.from('app_user_capabilities_v21137').select('*')
    ];
    const [a,s,sites,c]=await Promise.all(jobs);
    if(!a.error)accessRows=a.data||[];
    if(!s.error)siteRows=s.data||[];
    if(!sites.error)state.organisationSitesV21137=sites.data||[];
    if(!c.error)capRows=c.data||[];
  }

  function showAuthMessage(msg){const m=$('authMessage');if(m){m.hidden=false;m.textContent=msg}}
  function normaliseLogin(v){const x=clean(v).toLowerCase();return x.includes('@')?x:internalEmail(x)}
  function decorateLogin(){
    const input=$('loginEmail');if(!input)return;
    input.type='text';input.autocomplete='username';input.placeholder='Email or username';
    const label=input.closest('label');if(label&&label.firstChild)label.firstChild.textContent='Email or username';
  }
  async function interceptLogin(e){
    if(e.target?.id!=='loginForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    const ident=clean($('loginEmail')?.value),pw=$('loginPassword')?.value||'';
    if(!ident||!pw)return showAuthMessage('Enter your email/username and password.');
    const btn=$('loginSubmitBtn');if(btn){btn.disabled=true;btn.textContent='Signing in…'}
    const {data,error}=await sb.auth.signInWithPassword({email:normaliseLogin(ident),password:pw});
    if(error){if(btn){btn.disabled=false;btn.textContent='Sign in'};return showAuthMessage(error.message)}
    if(!data?.session){if(btn){btn.disabled=false;btn.textContent='Sign in'};return showAuthMessage('Sign-in did not create a session.')}
  }
  async function interceptForgot(e){
    const b=e.target.closest?.('#forgotPasswordBtn');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    const ident=clean($('loginEmail')?.value);
    if(!ident)return showAuthMessage('Enter your email address or username first.');
    if(!ident.includes('@'))return showAuthMessage('Username-only account: ask an Admin to reset your password. They can issue a new temporary password; your old password can never be viewed.');
    const redirectTo=`${location.origin}${location.pathname}?recovery=1`;
    const {error}=await sb.auth.resetPasswordForEmail(ident.toLowerCase(),{redirectTo});
    showAuthMessage(error?error.message:'Password reset email sent. Use the newest email only.');
  }

  function applyWorkingView(){
    if(!isManagerBase())return;
    let mode='full';try{mode=localStorage.getItem(userViewKey())==='user'?'user':'full'}catch(_e){}
    document.documentElement.classList.toggle('safety-working-user-v21137',mode==='user');
    const btn=$('adminUserModeBtn');if(btn){btn.hidden=false;btn.textContent=mode==='user'?`Return to ${String(state.profile.role).toLowerCase()==='admin'?'Admin':'Manager'}`:'Switch to User';btn.title='Changes the day-to-day interface only. Your real permissions and audit identity do not change.'}
    const banner=$('workingViewBannerV21137');
    if(mode==='user'){
      if(!banner){const d=document.createElement('div');d.id='workingViewBannerV21137';d.className='offline-banner';d.innerHTML=`<strong>User view:</strong> day-to-day Safety screens only. Your ${esc(state.profile.role)} access is unchanged.`;$('mainNav')?.insertAdjacentElement('afterend',d)}
      document.querySelectorAll('#mainNav [data-view]').forEach(b=>{b.hidden=!userViews.has(b.dataset.view)});
      const current=document.querySelector('.view.active-view')?.id?.replace(/View$/,'')||'';
      if(current&&!userViews.has(current)){document.querySelector('#mainNav [data-view="mySafety"]')?.click()}
    }else{
      banner?.remove();
      try{window.applyViewModeUi?.()}catch(_e){}
    }
    const role=$('currentUserRole');if(role)role.textContent=mode==='user'?`${state.profile.role} · User view`:state.profile.role;
  }
  function toggleWorkingView(e){
    const b=e.target.closest?.('#adminUserModeBtn');if(!b||!isManagerBase())return;
    e.preventDefault();e.stopImmediatePropagation();
    let mode='full';try{mode=localStorage.getItem(userViewKey())==='user'?'user':'full'}catch(_e){}
    const next=mode==='user'?'full':'user';try{localStorage.setItem(userViewKey(),next)}catch(_e){}
    applyWorkingView();toast(next==='user'?'User view on — account permissions unchanged.':'Management view restored.');
  }

  function accessRoleLabel(a,p){return a?.role_override|| (p?.report_only?'viewer':p?.role)||'user'}
  function decoratePeople(){
    const list=$('peopleList');if(!list)return;
    const heading=$('peopleView')?.querySelector('.page-heading p');if(heading)heading.textContent='People & Access — account, app access, role, sites, departments, positions and responsibilities.';
    const invite=$('inviteUserBtn');if(invite&&isAdmin()){invite.textContent='Create user';invite.dataset.v21137CreateUser='1'}
    for(const card of list.querySelectorAll('.item-card')){
      const edit=card.querySelector('[data-set-role]');const id=edit?.dataset.setRole;if(!id)continue;
      const p=person(id),a=accessFor(id),meta=card.querySelector('.meta');
      if(meta&&!meta.querySelector('.pa-access-v21137')){
        const s=document.createElement('span');s.className=`badge pa-access-v21137 ${a?.enabled===false?'due':'complete'}`;s.textContent=a?.enabled===false?'Safety access OFF':`Safety: ${accessRoleLabel(a,p)}`;meta.appendChild(s);
        if(p?.login_username){const u=document.createElement('span');u.className='pa-username-v21137';u.textContent=`Username: ${p.login_username}`;meta.appendChild(u)}
      }
      const actions=card.querySelector('.action-bar');if(actions&&isAdmin()&&!actions.querySelector('[data-v21137-access-user]')){const b=document.createElement('button');b.type='button';b.className='primary';b.dataset.v21137AccessUser=id;b.textContent='Access';actions.prepend(b)}
    }
  }

  function siteOptions(selected=''){const rows=state.organisationSitesV21137||[];return '<option value="">No home site yet</option>'+rows.filter(x=>x.active!==false).map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('')}
  const capChoices=[['reports','Reports'],['document_approver','Document approver'],['instructor','Instructor'],['contractor_permits','Contractor / PTW'],['asbestos','Asbestos access']];

  function showAccessEditor(id){
    if(!isAdmin())return;const p=person(id);if(!p)return;
    const a=accessFor(id)||{enabled:true,role_override:p.report_only?'viewer':p.role,preferred_view:['admin','manager'].includes(p.role)?'full':'user',home_site_id:null};
    const existingCaps=new Set(capsFor(id).filter(x=>x.scope_type==='APP').map(x=>x.capability_key));
    const extraSites=new Set(sitesFor(id).filter(x=>x.enabled!==false&&!x.is_home).map(x=>x.site_id));
    const siteChecks=(state.organisationSitesV21137||[]).filter(x=>x.active!==false).map(s=>`<label class="check-row"><input type="checkbox" class="pa-extra-site-v21137" value="${esc(s.id)}" ${extraSites.has(s.id)?'checked':''}>${esc(s.name)}</label>`).join('');
    const capChecks=capChoices.map(([k,l])=>`<label class="check-row"><input type="checkbox" class="pa-cap-v21137" value="${k}" ${existingCaps.has(k)?'checked':''}>${esc(l)}</label>`).join('');
    openModal('People & Access',`<div class="section-card"><h3>${esc(p.display_name||p.email||p.login_username||'User')}</h3><div class="meta">${p.email?`<span>${esc(p.email)}</span>`:''}${p.login_username?`<span>Username: ${esc(p.login_username)}</span>`:''}</div></div><div class="form-grid">
      <label class="check-row"><input id="paEnabledV21137" type="checkbox" ${a.enabled!==false?'checked':''}> Safety Tracker access</label>
      <label>Safety role<select id="paRoleV21137"><option value="user" ${accessRoleLabel(a,p)==='user'?'selected':''}>User</option><option value="manager" ${accessRoleLabel(a,p)==='manager'?'selected':''}>Manager</option><option value="admin" ${accessRoleLabel(a,p)==='admin'?'selected':''}>Admin</option><option value="viewer" ${accessRoleLabel(a,p)==='viewer'?'selected':''}>Viewer / Reviewer</option></select></label>
      <label>Default working view<select id="paViewV21137"><option value="user" ${a.preferred_view==='user'?'selected':''}>User</option><option value="full" ${a.preferred_view==='full'?'selected':''}>Full role view</option><option value="viewer" ${a.preferred_view==='viewer'?'selected':''}>Viewer</option></select></label>
      <label>Home site<select id="paHomeSiteV21137">${siteOptions(a.home_site_id||'')}</select></label>
    </div><div class="section-card"><h4>Additional sites</h4><p class="muted">Prepared for multi-site use. Site-level record filtering will be enabled as each module becomes site-aware.</p><div class="checkbox-list">${siteChecks||'No additional sites configured.'}</div></div><div class="section-card"><h4>Extra app capabilities</h4><p class="muted">These are additional responsibilities, not a replacement for the main role. Department Manager, H&S Manager, PPE and First Aid responsibility remain in their dedicated controls.</p><div class="checkbox-list">${capChecks}</div></div><div class="actions">${p.login_username?`<button class="secondary" type="button" data-v21137-reset-password="${esc(id)}">Reset password</button>`:''}<button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21137-save-access="${esc(id)}">Save access</button></div>`);
  }

  async function saveAccess(id,button){
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const enabled=!!$('paEnabledV21137')?.checked,role=$('paRoleV21137')?.value||'user',view=$('paViewV21137')?.value||'user',home=$('paHomeSiteV21137')?.value||null;
    const r=await sb.rpc('set_safety_user_access_v21137',{p_user_id:id,p_enabled:enabled,p_role:role,p_preferred_view:view,p_home_site_id:home});
    if(r.error){button.disabled=false;button.textContent=old;return toast(r.error.message)}
    const selectedSites=new Set([...document.querySelectorAll('.pa-extra-site-v21137:checked')].map(x=>x.value));
    for(const s of state.organisationSitesV21137||[]){if(s.id===home)continue;const sr=await sb.rpc('set_safety_site_access_v21137',{p_user_id:id,p_site_id:s.id,p_enabled:selectedSites.has(s.id),p_role_override:null,p_is_home:false});if(sr.error){button.disabled=false;button.textContent=old;return toast(sr.error.message)}}
    const selectedCaps=new Set([...document.querySelectorAll('.pa-cap-v21137:checked')].map(x=>x.value));
    for(const [key] of capChoices){const cr=await sb.rpc('set_safety_capability_v21137',{p_user_id:id,p_capability_key:key,p_enabled:selectedCaps.has(key),p_scope_type:'APP',p_scope_id:''});if(cr.error){button.disabled=false;button.textContent=old;return toast(cr.error.message)}}
    closeModal();await loadAccess();await api.refresh?.('People & Access updated.');setTimeout(decoratePeople,80);
  }

  function showCreateUser(){
    if(!isAdmin())return;const temp=generatedPassword();const sites=siteOptions((state.organisationSitesV21137||[])[0]?.id||'');
    openModal('Create user',`<div class="form-grid"><label>Name<input id="paCreateName"></label><label>Email (optional)<input id="paCreateEmail" type="email" placeholder="Leave blank if they do not have email"></label><label>Username (optional)<input id="paCreateUsername" autocomplete="off" placeholder="e.g. jsmith"></label><label>Temporary password<input id="paCreatePassword" value="${esc(temp)}"><span class="muted">Required for username-only accounts. Shown once; user must change it at first sign-in.</span></label><label>Role<select id="paCreateRole"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="viewer">Viewer / Reviewer</option></select></label><label>Home site<select id="paCreateHome">${sites}</select></label><label>Department<select id="paCreateDepartment"><option value="">No department</option>${(state.departments||[]).filter(d=>d.active!==false).map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label></div><div class="hint-box"><strong>No email?</strong> Give the person their username and temporary password. If they forget it, an Admin resets it here; the existing password is never retrievable.</div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21137-create-user>Create user</button></div>`)
  }

  async function callManage(body){
    const {data,error}=await sb.functions.invoke('manage-user-access-v21137',{body});if(error)throw error;return data||{};
  }
  async function createUser(button){
    const name=clean($('paCreateName')?.value),email=clean($('paCreateEmail')?.value).toLowerCase(),username=slug($('paCreateUsername')?.value),password=$('paCreatePassword')?.value||'',role=$('paCreateRole')?.value||'user',home=$('paCreateHome')?.value||null,department=$('paCreateDepartment')?.value||null;
    if(!name)return toast('Name is required.');if(!email&&!username)return toast('Enter an email address or username.');if(!email&&password.length<10)return toast('Username-only accounts need a temporary password of at least 10 characters.');
    button.disabled=true;button.textContent='Creating…';
    try{
      const out=await callManage({action:'create',display_name:name,email:email||null,username:username||null,temporary_password:password,primary_role:role,apps:[{app:'safety',enabled:true,role,preferred_view:['admin','manager'].includes(role)?'full':role==='viewer'?'viewer':'user',home_site_id:home}],redirect_to:`${location.origin}${location.pathname}?invite=1`});
      if(department&&out.user_id){const d=await sb.rpc('set_user_department_v230',{p_user_id:out.user_id,p_department_id:department});if(d.error)throw d.error}
      closeModal();await api.refresh?.('User created.');await loadAccess();
      if(!email)openModal('Username account created',`<div class="success-note"><strong>Give these details to ${esc(name)} now.</strong></div><p>Username: <strong>${esc(username)}</strong><br>Temporary password: <strong>${esc(password)}</strong></p><p class="muted">The password cannot be displayed later. The user must choose a new password at first sign-in.</p><div class="actions"><button class="primary" type="button" data-close-modal>Close</button></div>`);
      else toast(`Access email sent to ${email}.`);
    }catch(e){button.disabled=false;button.textContent='Create user';toast(e.message||String(e))}
  }
  async function resetPassword(id){
    const pw=generatedPassword();const entered=prompt(`New temporary password for ${personName(id)}:`,pw);if(!entered)return;if(entered.length<10)return toast('Temporary password must be at least 10 characters.');
    try{await callManage({action:'reset_password',user_id:id,temporary_password:entered});openModal('Password reset',`<div class="success-note"><strong>Temporary password created.</strong></div><p>User: <strong>${esc(personName(id))}</strong><br>Temporary password: <strong>${esc(entered)}</strong></p><p class="muted">Copy it now. The user must change it at next sign-in and the old password cannot be viewed.</p><div class="actions"><button class="primary" type="button" data-close-modal>Close</button></div>`)}catch(e){toast(e.message||String(e))}
  }

  async function enforceOwnAccess(){
    await loadAccess();const a=accessFor(state.user?.id);if(a&&a.enabled===false){toast('Your Safety Tracker access has been disabled.');await sb.auth.signOut();return false}return true;
  }

  function install(){
    const oldPeople=window.renderPeople;if(typeof oldPeople==='function')window.renderPeople=function(){const out=oldPeople.apply(this,arguments);setTimeout(decoratePeople,0);return out};
    document.addEventListener('submit',interceptLogin,true);
    document.addEventListener('click',e=>{
      interceptForgot(e);
      toggleWorkingView(e);
      const create=e.target.closest?.('[data-v21137-create-user]');if(create){e.preventDefault();e.stopImmediatePropagation();createUser(create);return}
      const invite=e.target.closest?.('#inviteUserBtn,[data-v21137-create-user-btn]');if(invite&&isAdmin()){e.preventDefault();e.stopImmediatePropagation();showCreateUser();return}
      const access=e.target.closest?.('[data-v21137-access-user]');if(access){e.preventDefault();e.stopImmediatePropagation();showAccessEditor(access.dataset.v21137AccessUser);return}
      const save=e.target.closest?.('[data-v21137-save-access]');if(save){e.preventDefault();e.stopImmediatePropagation();saveAccess(save.dataset.v21137SaveAccess,save);return}
      const reset=e.target.closest?.('[data-v21137-reset-password]');if(reset){e.preventDefault();e.stopImmediatePropagation();resetPassword(reset.dataset.v21137ResetPassword);return}
      if(e.target.closest?.('[data-view="people"]'))setTimeout(decoratePeople,160);
    },true);
    const obs=new MutationObserver(()=>{decorateLogin();applyWorkingView();if($('peopleView')?.classList.contains('active-view'))decoratePeople()});obs.observe(document.body,{childList:true,subtree:true});
    decorateLogin();
    [100,350,800].forEach(ms=>setTimeout(()=>{applyWorkingView();decoratePeople()},ms));
  }

  async function boot(){
    api=window.SafetyTrackerV2;if(!api?.state||!api?.sb){setTimeout(boot,120);return}state=api.state;sb=api.sb;
    const style=document.createElement('style');style.textContent=`.safety-working-user-v21137 #mainNav [data-view="documents"],.safety-working-user-v21137 #mainNav [data-view="creator"],.safety-working-user-v21137 #mainNav [data-view="people"],.safety-working-user-v21137 #mainNav [data-view="compliance"],.safety-working-user-v21137 #mainNav [data-view="instructor"],.safety-working-user-v21137 #mainNav [data-view="reports"],.safety-working-user-v21137 #mainNav [data-view="admin"]{display:none!important}.pa-access-v21137{margin-left:4px}`;document.head.appendChild(style);
    install();
    if(state.user)await enforceOwnAccess();
    window.addEventListener('online',()=>state.user&&enforceOwnAccess().catch(()=>{}));
  }
  boot();
})();
