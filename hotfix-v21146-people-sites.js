/* Safety Tracker v2.11.46 CLEAN
   Sites + People & Access consolidation.
   Rules:
   - Global People directory shows shared Inventory/Energy users.
   - A new Safety site starts with ONLY the Admin who creates it.
   - Shared users are NOT automatically added to a new site.
   - Site user assignment is explicit and site-specific.
   - Viewer Access setup is hidden from Admin.
   - No whole-page/admin child-list MutationObservers are allowed to repaint the UI.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21146)return;
  window.__SAFETY_V21146=true;

  const ParentObserver=window.MutationObserver;
  if(typeof ParentObserver==='function' && !window.__SAFETY_V21146_OBSERVER_GUARD){
    window.__SAFETY_V21146_OBSERVER_GUARD=true;
    class StableObserverV21146{
      constructor(cb){this._inner=new ParentObserver(cb)}
      observe(target,opts){
        const id=target?.id||'';
        if(opts?.childList && opts?.subtree && (
          target===document.body || id==='appView' || id==='adminView' || id==='peopleView'
        )) return;
        return this._inner.observe(target,opts);
      }
      disconnect(){return this._inner.disconnect()}
      takeRecords(){return this._inner.takeRecords()}
    }
    window.MutationObserver=StableObserverV21146;
  }

  let api=null,state=null,sb=null,booted=false,pending=null;
  let sites=[],siteStatus=[],siteAccess=[],sharedUsers=[],currentSiteId=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toLowerCase();

  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';

  function toast(msg){try{api?.toast?.(msg)}catch(_e){console.log(msg)}}

  // Early intercept so legacy Admin routing cannot swallow these buttons.
  document.addEventListener('click',e=>{
    const s=e.target.closest?.('[data-v21146-sites]');
    if(s){
      e.preventDefault();e.stopImmediatePropagation();
      pending='sites'; if(booted)openSites(); return;
    }
    const p=e.target.closest?.('[data-v21146-people]');
    if(p){
      e.preventDefault();e.stopImmediatePropagation();
      pending='people'; if(booted)openPeople(); return;
    }
  },true);

  function installStyles(){
    if($('safetyV21146Styles'))return;
    const s=document.createElement('style');
    s.id='safetyV21146Styles';
    s.textContent=`
      #adminView [data-admin-tile-v21083="viewer"],
      #adminView [data-admin-section-v21083="viewer"],
      #safetySitesAdminV21139,#siteManagementV21142,#sitesV21144View,#peopleV21144View,
      #sitesV21145View,#peopleV21145View,#sharedAppDirectoryV21143{display:none!important}
      .admin-shortcuts-v21146{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}
      .admin-shortcut-v21146{border:1px solid var(--border,#475569);border-radius:14px;background:var(--card,#1f1f1f);color:inherit;padding:14px;text-align:left;min-height:92px}
      .admin-shortcut-v21146 strong{display:block;font-size:1.05rem;margin-bottom:4px}
      .admin-shortcut-v21146 small{color:var(--muted,#a6b1c2);line-height:1.35}
      .standalone-back-v21146{margin:0 0 14px}
      .site-title-v21146{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .site-card-v21146 p{margin:7px 0 0}
      .app-badges-v21146{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .site-assigned-v21146{margin-top:7px}
      .setup-grid-v21146{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
      .setup-grid-v21146>div{display:flex;gap:9px}
      .setup-grid-v21146 b{flex:0 0 30px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#243b53}
      .setup-grid-v21146 span{display:flex;flex-direction:column}
      .setup-grid-v21146 small{color:var(--muted,#94a3b8)}
      .site-user-row-v21146{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border,#334155)}
      .site-user-row-v21146:last-child{border-bottom:0}
      @media(max-width:700px){
        .admin-shortcuts-v21146{grid-template-columns:1fr 1fr}
        .setup-grid-v21146{grid-template-columns:1fr}
        .row-between.site-row-v21146,.row-between.people-head-v21146{display:block}
        .site-row-v21146>button,.people-head-v21146>button{width:100%;margin-top:9px}
      }
    `;
    document.head.appendChild(s);
  }

  function injectAdminShortcuts(){
    if(!isAdmin())return;
    const view=$('adminView');
    if(!view)return;

    // Remove Viewer Access tile each time legacy Admin landing re-renders.
    view.querySelectorAll('[data-admin-tile-v21083="viewer"]').forEach(x=>x.remove());

    let box=$('adminShortcutsV21146');
    if(!box){
      box=document.createElement('div');
      box.id='adminShortcutsV21146';
      box.className='admin-shortcuts-v21146';
      box.innerHTML=`
        <button class="admin-shortcut-v21146" type="button" data-v21146-sites>
          <strong>Sites</strong>
          <small>Create and manage sites. New sites start with the setup Admin only.</small>
        </button>
        <button class="admin-shortcut-v21146" type="button" data-v21146-people>
          <strong>People & Access</strong>
          <small>See all app users, Safety access and site assignments.</small>
        </button>`;
    }

    const landing=$('adminHomeV21083');
    if(landing && box.parentElement!==landing){
      const head=landing.querySelector('.admin-home-head-v21083');
      if(head)head.insertAdjacentElement('afterend',box);
      else landing.insertAdjacentElement('afterbegin',box);
    }
  }

  function ensureSitesView(){
    let v=$('sitesV21146View');
    if(v)return v;
    v=document.createElement('section');
    v.id='sitesV21146View';
    v.className='view';
    v.innerHTML=`
      <div class="page-heading">
        <div><h2>Sites</h2><p class="muted">Each site has its own people and Safety records.</p></div>
        <button class="primary" type="button" data-v21146-create-site>Create site</button>
      </div>
      <button class="secondary standalone-back-v21146" type="button" data-v21146-admin-home>← Admin sections</button>
      <div id="sitesV21146Content"></div>`;
    ($('appView')||document.querySelector('main')||document.body).appendChild(v);
    return v;
  }

  function ensurePeopleView(){
    let v=$('peopleV21146View');
    if(v)return v;
    v=document.createElement('section');
    v.id='peopleV21146View';
    v.className='view';
    v.innerHTML=`
      <div class="page-heading">
        <div><h2>People & Access</h2><p class="muted">All app users. Safety and site access are assigned separately.</p></div>
        <button class="primary" type="button" data-v21146-create-safety>Create Safety user</button>
      </div>
      <button class="secondary standalone-back-v21146" type="button" data-v21146-admin-home>← Admin sections</button>
      <div id="peopleV21146Content"></div>`;
    ($('appView')||document.querySelector('main')||document.body).appendChild(v);
    return v;
  }

  function showStandalone(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    $(id)?.classList.add('active-view');
    document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('active',b.dataset.view==='admin'));
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_e){}
  }

  async function loadSites(){
    const [s,st,a,cur]=await Promise.all([
      sb.from('organisation_sites_v21137').select('*').order('name'),
      sb.from('site_module_status_v21138').select('*'),
      sb.from('app_site_access_v21137').select('*').eq('module_key','safety'),
      sb.rpc('current_safety_site_v21138')
    ]);
    if(!s.error)sites=s.data||[];
    if(!st.error)siteStatus=st.data||[];
    if(!a.error)siteAccess=a.data||[];
    if(!cur.error)currentSiteId=cur.data||null;
  }

  const statusFor=id=>siteStatus.find(x=>x.site_id===id&&x.module_key==='safety')||null;
  const assignmentsFor=id=>siteAccess.filter(x=>x.site_id===id&&x.enabled!==false);

  function localName(id){
    const p=(state?.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||'Safety user';
  }

  function renderSites(){
    const box=$('sitesV21146Content'); if(!box)return;
    const active=sites.filter(x=>x.active!==false);
    box.innerHTML=`
      <div class="stats-grid">
        <div class="stat-card"><strong>${active.length}</strong><span>Sites</span></div>
        <div class="stat-card"><strong>${active.filter(x=>statusFor(x.id)?.status==='READY').length}</strong><span>Ready</span></div>
        <div class="stat-card"><strong>${active.filter(x=>(statusFor(x.id)?.status||'SETUP_REQUIRED')==='SETUP_REQUIRED').length}</strong><span>Setup required</span></div>
      </div>
      <div class="hint-box"><strong>New-site rule:</strong> only the Admin who creates a site is assigned initially. Existing Inventory/Energy users are not added to that site.</div>
      <div class="card-list">
        ${active.map(site=>{
          const st=statusFor(site.id),status=st?.status||'SETUP_REQUIRED';
          const assigned=assignmentsFor(site.id);
          const names=assigned.map(x=>localName(x.user_id));
          return `<div class="item-card site-card-v21146">
            <div class="row-between site-row-v21146">
              <div>
                <div class="site-title-v21146">
                  <strong>${esc(site.name)}</strong>
                  <span class="badge ${status==='READY'?'complete':'due'}">${esc(status==='READY'?'Ready':'Setup required')}</span>
                  ${site.id===currentSiteId?'<span class="badge complete">Current</span>':''}
                </div>
                <div class="meta site-assigned-v21146">
                  <span>${assigned.length} assigned Safety user${assigned.length===1?'':'s'}</span>
                  ${names.length?`<span>${esc(names.join(', '))}</span>`:''}
                </div>
                <p class="muted">${esc(st?.note||'')}</p>
              </div>
              <div class="actions">
                <button class="secondary" type="button" data-v21146-manage-site-users="${esc(site.id)}">Manage people</button>
                ${status==='READY'&&site.id!==currentSiteId?`<button class="secondary" type="button" data-v21146-open-site="${esc(site.id)}">Open site</button>`:''}
              </div>
            </div>
          </div>`;
        }).join('')||'<div class="empty">No sites found.</div>'}
      </div>
      <div class="section-card">
        <h3>Setup order</h3>
        <div class="setup-grid-v21146">
          <div><b>1</b><span><strong>Create</strong><small>Setup Admin only.</small></span></div>
          <div><b>2</b><span><strong>Configure</strong><small>Departments, locations and equipment.</small></span></div>
          <div><b>3</b><span><strong>Add people</strong><small>Explicitly assign only those who need this site.</small></span></div>
          <div><b>4</b><span><strong>Open</strong><small>Use the site once setup is ready.</small></span></div>
        </div>
      </div>`;
  }

  async function openSites(){
    if(!isAdmin())return;
    ensureSitesView();
    await loadSites();
    renderSites();
    showStandalone('sitesV21146View');
  }

  function createSiteModal(){
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Create new site';
    body.innerHTML=`
      <div class="section-card">
        <h3>New Safety site</h3>
        <p class="muted">Only your Admin account is assigned initially. No other users or operational records are copied.</p>
      </div>
      <div class="form-grid">
        <label>Site name<input id="newSiteNameV21146" autocomplete="off" placeholder="e.g. Southampton Hotel"></label>
        <label>Timezone<select id="newSiteTimezoneV21146"><option value="Europe/London">Europe/London</option></select></label>
      </div>
      <label class="check-row"><input id="newSiteConfirmV21146" type="checkbox"> Start this site with only my Admin account and clear records.</label>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21146-save-site>Create site</button>
      </div>`;
    if(!modal.open)modal.showModal();
    setTimeout(()=>$('newSiteNameV21146')?.focus(),50);
  }

  async function saveSite(btn){
    const name=clean($('newSiteNameV21146')?.value);
    if(!name)return toast('Enter a site name.');
    if(!$('newSiteConfirmV21146')?.checked)return toast('Confirm the clean site setup.');
    const old=btn.textContent;btn.disabled=true;btn.textContent='Creating…';
    const {error}=await sb.rpc('create_clean_safety_site_v21138',{
      p_name:name,p_timezone:$('newSiteTimezoneV21146')?.value||'Europe/London'
    });
    if(error){btn.disabled=false;btn.textContent=old;return toast(error.message)}
    try{$('modal')?.close()}catch(_e){}
    await loadSites();renderSites();
    toast(`${name} created. Only your Admin account is assigned.`);
  }

  async function switchSite(id){
    const {error}=await sb.rpc('set_current_safety_site_v21138',{p_site_id:id});
    if(error)return toast(error.message);
    location.reload();
  }

  function manageSiteUsersModal(siteId){
    const site=sites.find(x=>x.id===siteId);
    if(!site)return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent=`${site.name} — people`;

    const assigned=new Set(assignmentsFor(siteId).map(x=>x.user_id));
    const creatorId=site.created_by||null;
    const local=(state?.people||[]).filter(p=>p.active!==false);

    body.innerHTML=`
      <div class="hint-box">
        <strong>Site-specific access:</strong> only checked Safety accounts can access this site.
        Inventory/Energy users are not added automatically.
      </div>
      <div class="section-card">
        ${local.map(p=>{
          const locked=p.id===creatorId;
          return `<label class="site-user-row-v21146">
            <input type="checkbox" class="site-user-check-v21146" value="${esc(p.id)}"
              ${assigned.has(p.id)?'checked':''} ${locked?'disabled':''}>
            <span><strong>${esc(p.display_name||p.email||'Safety user')}</strong>
              <small>${esc(p.report_only?'viewer':p.role||'user')}${locked?' · setup Admin':''}</small>
            </span>
          </label>`;
        }).join('')||'<div class="empty">No active Safety accounts.</div>'}
      </div>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21146-save-site-users="${esc(siteId)}">Save site access</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveSiteUsers(siteId,btn){
    const site=sites.find(x=>x.id===siteId); if(!site)return;
    const selected=new Set([...document.querySelectorAll('.site-user-check-v21146:checked')].map(x=>x.value));
    if(site.created_by)selected.add(site.created_by);

    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    try{
      for(const p of (state?.people||[]).filter(x=>x.active!==false)){
        const enabled=selected.has(p.id);
        const current=assignmentsFor(siteId).find(x=>x.user_id===p.id);
        const role=String(current?.role_override||p.role||'user').toLowerCase();
        const {error}=await sb.rpc('set_safety_site_access_v21137',{
          p_user_id:p.id,p_site_id:siteId,p_enabled:enabled,p_role_override:role,p_is_home:false
        });
        if(error)throw error;
      }
      try{$('modal')?.close()}catch(_e){}
      await loadSites();renderSites();
      toast('Site people updated.');
    }catch(e){
      btn.disabled=false;btn.textContent=old;
      toast(e?.message||'Could not save site access.');
    }
  }

  function localSafetyMatch(u){
    const people=state?.people||[];
    const email=norm(u.email),username=norm(u.login_username);
    return people.find(p=>
      (email && norm(p.email)===email) ||
      (username && norm(p.login_username)===username)
    )||null;
  }

  function appBadge(label,on,role){
    if(!on)return `<span class="badge neutral">${esc(label)} OFF</span>`;
    return `<span class="badge complete">${esc(label)}: ${esc(role||'user')}</span>`;
  }

  async function loadSharedUsers(){
    const {data,error}=await sb.from('shared_app_users_v21143').select('*').order('display_name');
    if(error){console.warn(error);sharedUsers=[]}
    else sharedUsers=data||[];
  }

  function renderPeople(){
    const box=$('peopleV21146Content'); if(!box)return;
    const local=state?.people||[];
    const activeShared=sharedUsers.filter(x=>x.active!==false);

    box.innerHTML=`
      <div class="stats-grid">
        <div class="stat-card"><strong>${activeShared.length}</strong><span>Active app users</span></div>
        <div class="stat-card"><strong>${activeShared.filter(x=>!!localSafetyMatch(x)).length}</strong><span>With Safety account</span></div>
        <div class="stat-card"><strong>${local.filter(x=>x.active!==false).length}</strong><span>Active Safety accounts</span></div>
      </div>

      <div class="section-card">
        <div class="row-between people-head-v21146">
          <div><h3>All app users</h3><p class="muted">Global directory. These people are not automatically added to any site.</p></div>
          <button class="secondary" type="button" data-v21146-refresh-users>Refresh users</button>
        </div>
        <div class="card-list">
          ${sharedUsers.map(u=>{
            const s=localSafetyMatch(u);
            return `<div class="item-card compact">
              <strong>${esc(u.display_name||u.login_username||u.email||'User')}</strong>
              <div class="meta">${u.email?`<span>${esc(u.email)}</span>`:''}</div>
              <div class="app-badges-v21146">
                ${appBadge('Inventory',u.inventory_enabled,u.inventory_role)}
                ${appBadge('Energy',u.energy_enabled,u.energy_role)}
                ${s?appBadge('Safety',s.active!==false,s.report_only?'viewer':s.role||'user'):'<span class="badge due">Safety OFF</span>'}
              </div>
            </div>`;
          }).join('')||'<div class="empty">No shared users found.</div>'}
        </div>
      </div>

      <div class="section-card">
        <h3>Safety accounts</h3>
        <p class="muted">Only these accounts can be assigned to a Safety site.</p>
        <div class="card-list">
          ${local.map(p=>`<div class="item-card compact">
            <strong>${esc(p.display_name||p.email||'Safety user')}</strong>
            <div class="meta"><span class="badge ${p.active!==false?'complete':'neutral'}">${p.active!==false?'Active':'Disabled'}</span><span>${esc(p.report_only?'viewer':p.role||'user')}</span></div>
          </div>`).join('')||'<div class="empty">No Safety accounts found.</div>'}
        </div>
      </div>`;
  }

  async function openPeople(){
    if(!isManager())return;
    ensurePeopleView();
    await loadSharedUsers();
    renderPeople();
    showStandalone('peopleV21146View');
  }

  async function refreshUsers(btn){
    const old=btn.textContent;btn.disabled=true;btn.textContent='Refreshing…';
    try{
      const {error}=await sb.functions.invoke('sync-shared-user-directory-v21143',{body:{action:'sync'}});
      if(error)throw error;
      await loadSharedUsers();renderPeople();toast('User directory refreshed.');
    }catch(e){
      await loadSharedUsers();renderPeople();
      toast('Existing shared user directory loaded.');
    }finally{btn.disabled=false;btn.textContent=old}
  }

  function adminHome(){
    document.querySelector('#mainNav button[data-view="admin"]')?.click();
    [80,220].forEach(ms=>setTimeout(()=>{
      try{window.SafetyAdminSectionsV21083?.home?.()}catch(_e){}
      injectAdminShortcuts();
    },ms));
  }

  function installEvents(){
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-v21146-admin-home]')){
        e.preventDefault();e.stopImmediatePropagation();adminHome();return;
      }
      if(e.target.closest?.('[data-v21146-create-site]')){
        e.preventDefault();e.stopImmediatePropagation();createSiteModal();return;
      }
      const save=e.target.closest?.('[data-v21146-save-site]');
      if(save){e.preventDefault();e.stopImmediatePropagation();saveSite(save);return}
      const open=e.target.closest?.('[data-v21146-open-site]');
      if(open){e.preventDefault();e.stopImmediatePropagation();switchSite(open.dataset.v21146OpenSite);return}
      const manage=e.target.closest?.('[data-v21146-manage-site-users]');
      if(manage){e.preventDefault();e.stopImmediatePropagation();manageSiteUsersModal(manage.dataset.v21146ManageSiteUsers);return}
      const saveUsers=e.target.closest?.('[data-v21146-save-site-users]');
      if(saveUsers){e.preventDefault();e.stopImmediatePropagation();saveSiteUsers(saveUsers.dataset.v21146SaveSiteUsers,saveUsers);return}
      const refresh=e.target.closest?.('[data-v21146-refresh-users]');
      if(refresh){e.preventDefault();e.stopImmediatePropagation();refreshUsers(refresh);return}
      if(e.target.closest?.('[data-v21146-create-safety]')){
        e.preventDefault();e.stopImmediatePropagation();
        $('inviteUserBtn')?.click();return;
      }
      if(e.target.closest?.('#mainNav button[data-view="admin"],[data-management-stable-action="view:admin"]')){
        [80,220,500].forEach(ms=>setTimeout(injectAdminShortcuts,ms));
      }
    },true);

    window.addEventListener('pageshow',()=>setTimeout(injectAdminShortcuts,120));
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb||!window.SafetyAdminSectionsV21083){
      setTimeout(boot,100);return;
    }
    state=api.state;sb=api.sb;
    if(!state.user)return;

    booted=true;
    installStyles();
    ensureSitesView();
    ensurePeopleView();
    installEvents();

    [80,220,600].forEach(ms=>setTimeout(injectAdminShortcuts,ms));

    if(pending==='sites'){pending=null;openSites()}
    else if(pending==='people'){pending=null;openPeople()}

    window.SafetyPeopleSitesV21146={openSites,openPeople};
  }

  boot().catch(e=>console.warn('Safety v2.11.46',e));
})();
