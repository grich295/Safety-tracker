/* Safety Tracker v2.11.49 CLEAN
   Sites + People & Access consolidation.
   Rules:
   - Global People directory shows shared Inventory/Energy users and lets Admin grant/edit Safety access.
   - A new Safety site starts with ONLY the Admin who creates it.
   - Shared users are NOT automatically added to a new site.
   - Site user assignment is explicit and site-specific.
   - Viewer Access setup is hidden from Admin.
   - No whole-page/admin child-list MutationObservers are allowed to repaint the UI.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21149)return;
  window.__SAFETY_V21149=true;

  const ParentObserver=window.MutationObserver;
  if(typeof ParentObserver==='function' && !window.__SAFETY_V21149_OBSERVER_GUARD){
    window.__SAFETY_V21149_OBSERVER_GUARD=true;
    class StableObserverV21149{
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
    window.MutationObserver=StableObserverV21149;
  }

  let api=null,state=null,sb=null,booted=false,pending=null;
  let sites=[],siteStatus=[],siteAccess=[],sharedUsers=[],sharedLinks=[],moduleAccess=[],safetyProfiles=[],currentSiteId=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toLowerCase();

  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';

  function toast(msg){try{api?.toast?.(msg)}catch(_e){console.log(msg)}}

  // v2.11.49: ACCESS ACTIONS MUST WIN BEFORE LEGACY DOCUMENT CLICK HANDLERS.
  // Window capture runs before document capture regardless of listener registration order.
  // This fixes the visible buttons that were being swallowed by older People/Admin handlers.
  window.addEventListener('click',e=>{
    const editShared=e.target.closest?.('[data-v21149-edit-shared]');
    if(editShared){
      e.preventDefault();e.stopImmediatePropagation();
      if(!booted)return toast('People & Access is still loading.');
      openSharedAccessEditor(editShared.dataset.v21149EditShared);
      return;
    }

    const editSafety=e.target.closest?.('[data-v21149-edit-safety]');
    if(editSafety){
      e.preventDefault();e.stopImmediatePropagation();
      if(!booted)return toast('People & Access is still loading.');
      openSafetyAccessEditor(editSafety.dataset.v21149EditSafety);
      return;
    }

    const createAccess=e.target.closest?.('[data-v21149-create-access]');
    if(createAccess){
      e.preventDefault();e.stopImmediatePropagation();
      createSharedSafetyAccess(createAccess.dataset.v21149CreateAccess,createAccess);
      return;
    }

    const saveAccess=e.target.closest?.('[data-v21149-save-access]');
    if(saveAccess){
      e.preventDefault();e.stopImmediatePropagation();
      saveSafetyAccess(saveAccess.dataset.v21149SaveAccess,saveAccess);
      return;
    }

    const resetPw=e.target.closest?.('[data-v21149-reset-password]');
    if(resetPw){
      e.preventDefault();e.stopImmediatePropagation();
      resetTemporaryPassword(resetPw.dataset.v21149ResetPassword,resetPw);
      return;
    }

    const refresh=e.target.closest?.('[data-v21149-refresh-users]');
    if(refresh){
      e.preventDefault();e.stopImmediatePropagation();
      refreshUsers(refresh);
      return;
    }
  },true);


  // Early intercept so legacy Admin routing cannot swallow these buttons.
  document.addEventListener('click',e=>{
    const s=e.target.closest?.('[data-v21149-sites]');
    if(s){
      e.preventDefault();e.stopImmediatePropagation();
      pending='sites'; if(booted)openSites(); return;
    }
    const p=e.target.closest?.('[data-v21149-people]');
    if(p){
      e.preventDefault();e.stopImmediatePropagation();
      pending='people'; if(booted)openPeople(); return;
    }
  },true);

  function installStyles(){
    if($('safetyV21149Styles'))return;
    const s=document.createElement('style');
    s.id='safetyV21149Styles';
    s.textContent=`
      #adminView [data-admin-tile-v21083="viewer"],
      #adminView [data-admin-section-v21083="viewer"],
      #safetySitesAdminV21139,#siteManagementV21142,#sitesV21144View,#peopleV21144View,
      #sitesV21145View,#peopleV21145View,#sharedAppDirectoryV21143{display:none!important}
      .admin-shortcuts-v21149{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}
      .admin-shortcut-v21149{border:1px solid var(--border,#475569);border-radius:14px;background:var(--card,#1f1f1f);color:inherit;padding:14px;text-align:left;min-height:92px}
      .admin-shortcut-v21149 strong{display:block;font-size:1.05rem;margin-bottom:4px}
      .admin-shortcut-v21149 small{color:var(--muted,#a6b1c2);line-height:1.35}
      .standalone-back-v21149{margin:0 0 14px}
      .site-title-v21149{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .site-card-v21149 p{margin:7px 0 0}
      .app-badges-v21149{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .site-assigned-v21149{margin-top:7px}
      .setup-grid-v21149{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
      .setup-grid-v21149>div{display:flex;gap:9px}
      .setup-grid-v21149 b{flex:0 0 30px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#243b53}
      .setup-grid-v21149 span{display:flex;flex-direction:column}
      .setup-grid-v21149 small{color:var(--muted,#94a3b8)}
      .site-user-row-v21149{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border,#334155)}
      .site-user-row-v21149:last-child{border-bottom:0}
      .people-card-row-v21149{gap:10px;align-items:flex-start}
      .people-card-row-v21149>button{flex:0 0 auto}
      .pa-username-fields-v21149[hidden]{display:none!important}
      .access-btn-v21149{min-height:44px;white-space:nowrap}
      @media(max-width:700px){
        .people-card-row-v21149{display:block!important}
        .access-btn-v21149{width:100%;margin-top:10px}
      }


      @media(max-width:700px){
        .admin-shortcuts-v21149{grid-template-columns:1fr 1fr}
        .setup-grid-v21149{grid-template-columns:1fr}
        .row-between.site-row-v21149,.row-between.people-head-v21149{display:block}
        .site-row-v21149>button,.people-head-v21149>button{width:100%;margin-top:9px}
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

    let box=$('adminShortcutsV21149');
    if(!box){
      box=document.createElement('div');
      box.id='adminShortcutsV21149';
      box.className='admin-shortcuts-v21149';
      box.innerHTML=`
        <button class="admin-shortcut-v21149" type="button" data-v21149-sites>
          <strong>Sites</strong>
          <small>Create and manage sites. New sites start with the setup Admin only.</small>
        </button>
        <button class="admin-shortcut-v21149" type="button" data-v21149-people>
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
    let v=$('sitesV21149View');
    if(v)return v;
    v=document.createElement('section');
    v.id='sitesV21149View';
    v.className='view';
    v.innerHTML=`
      <div class="page-heading">
        <div><h2>Sites</h2><p class="muted">Each site has its own people and Safety records.</p></div>
        <button class="primary" type="button" data-v21149-create-site>Create site</button>
      </div>
      <button class="secondary standalone-back-v21149" type="button" data-v21149-admin-home>← Admin sections</button>
      <div id="sitesV21149Content"></div>`;
    ($('appView')||document.querySelector('main')||document.body).appendChild(v);
    return v;
  }

  function ensurePeopleView(){
    let v=$('peopleV21149View');
    if(v)return v;
    v=document.createElement('section');
    v.id='peopleV21149View';
    v.className='view';
    v.innerHTML=`
      <div class="page-heading">
        <div><h2>People & Access</h2><p class="muted">All app users. Safety and site access are assigned separately.</p></div>
        <button class="primary" type="button" data-v21149-create-safety>Create new person</button>
      </div>
      <button class="secondary standalone-back-v21149" type="button" data-v21149-admin-home>← Admin sections</button>
      <div id="peopleV21149Content"></div>`;
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
    const box=$('sitesV21149Content'); if(!box)return;
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
          return `<div class="item-card site-card-v21149">
            <div class="row-between site-row-v21149">
              <div>
                <div class="site-title-v21149">
                  <strong>${esc(site.name)}</strong>
                  <span class="badge ${status==='READY'?'complete':'due'}">${esc(status==='READY'?'Ready':'Setup required')}</span>
                  ${site.id===currentSiteId?'<span class="badge complete">Current</span>':''}
                </div>
                <div class="meta site-assigned-v21149">
                  <span>${assigned.length} assigned Safety user${assigned.length===1?'':'s'}</span>
                  ${names.length?`<span>${esc(names.join(', '))}</span>`:''}
                </div>
                <p class="muted">${esc(st?.note||'')}</p>
              </div>
              <div class="actions">
                <button class="secondary" type="button" data-v21149-manage-site-users="${esc(site.id)}">Manage people</button>
                ${status==='READY'&&site.id!==currentSiteId?`<button class="secondary" type="button" data-v21149-open-site="${esc(site.id)}">Open site</button>`:''}
              </div>
            </div>
          </div>`;
        }).join('')||'<div class="empty">No sites found.</div>'}
      </div>
      <div class="section-card">
        <h3>Setup order</h3>
        <div class="setup-grid-v21149">
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
    showStandalone('sitesV21149View');
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
        <label>Site name<input id="newSiteNameV21149" autocomplete="off" placeholder="e.g. Southampton Hotel"></label>
        <label>Timezone<select id="newSiteTimezoneV21149"><option value="Europe/London">Europe/London</option></select></label>
      </div>
      <label class="check-row"><input id="newSiteConfirmV21149" type="checkbox"> Start this site with only my Admin account and clear records.</label>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21149-save-site>Create site</button>
      </div>`;
    if(!modal.open)modal.showModal();
    setTimeout(()=>$('newSiteNameV21149')?.focus(),50);
  }

  async function saveSite(btn){
    const name=clean($('newSiteNameV21149')?.value);
    if(!name)return toast('Enter a site name.');
    if(!$('newSiteConfirmV21149')?.checked)return toast('Confirm the clean site setup.');
    const old=btn.textContent;btn.disabled=true;btn.textContent='Creating…';
    const {error}=await sb.rpc('create_clean_safety_site_v21138',{
      p_name:name,p_timezone:$('newSiteTimezoneV21149')?.value||'Europe/London'
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
          return `<label class="site-user-row-v21149">
            <input type="checkbox" class="site-user-check-v21149" value="${esc(p.id)}"
              ${assigned.has(p.id)?'checked':''} ${locked?'disabled':''}>
            <span><strong>${esc(p.display_name||p.email||'Safety user')}</strong>
              <small>${esc(p.report_only?'viewer':p.role||'user')}${locked?' · setup Admin':''}</small>
            </span>
          </label>`;
        }).join('')||'<div class="empty">No active Safety accounts.</div>'}
      </div>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21149-save-site-users="${esc(siteId)}">Save site access</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveSiteUsers(siteId,btn){
    const site=sites.find(x=>x.id===siteId); if(!site)return;
    const selected=new Set([...document.querySelectorAll('.site-user-check-v21149:checked')].map(x=>x.value));
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


  function profileById(id){
    return safetyProfiles.find(p=>p.id===id) || (state?.people||[]).find(p=>p.id===id) || null;
  }

  function linkedSafetyId(sourceId){
    return sharedLinks.find(x=>x.source_user_id===sourceId)?.safety_user_id||null;
  }

  function resolvedSafetyUser(u){
    const linked=linkedSafetyId(u.source_user_id);
    if(linked)return profileById(linked);
    const email=norm(u.email),username=norm(u.login_username);
    return safetyProfiles.find(p=>
      (email && norm(p.email)===email) ||
      (username && norm(p.login_username)===username)
    ) || null;
  }

  function moduleAccessFor(userId){
    return moduleAccess.find(x=>x.user_id===userId&&x.module_key==='safety')||null;
  }

  function accessSitesFor(userId){
    return siteAccess.filter(x=>x.user_id===userId&&x.module_key==='safety'&&x.enabled!==false);
  }

  function siteLabel(id){
    return sites.find(s=>s.id===id)?.name||'Site';
  }

  function generatedPassword(){
    const words=['Harbour','Maple','River','Copper','Oak','Stone','Blue','Glass'];
    return `${words[Math.floor(Math.random()*words.length)]}-${Math.floor(1000+Math.random()*9000)}-${words[Math.floor(Math.random()*words.length)]}!`;
  }

  function suggestedUsername(u){
    const base=clean(u.login_username||u.display_name||u.email?.split('@')[0]||'user')
      .toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,40);
    return base.length>=3?base:`user${Math.floor(1000+Math.random()*9000)}`;
  }

  function localSafetyMatch(u){
    return resolvedSafetyUser(u);
  }

  function appBadge(label,on,role){
    if(!on)return `<span class="badge neutral">${esc(label)} OFF</span>`;
    return `<span class="badge complete">${esc(label)}: ${esc(role||'user')}</span>`;
  }

  async function loadSharedUsers(){
    const [shared,links,mods,profiles,siteRows,siteList]=await Promise.all([
      sb.from('shared_app_users_v21143').select('*').order('display_name'),
      sb.from('shared_safety_user_links_v21149').select('*'),
      sb.from('app_module_access_v21137').select('*').eq('module_key','safety'),
      sb.from('profiles').select('id,display_name,email,login_username,role,active,report_only'),
      sb.from('app_site_access_v21137').select('*').eq('module_key','safety'),
      sb.from('organisation_sites_v21137').select('*').order('name')
    ]);
    if(!shared.error)sharedUsers=shared.data||[]; else console.warn('Shared users',shared.error);
    if(!links.error)sharedLinks=links.data||[]; else console.warn('Shared links',links.error);
    if(!mods.error)moduleAccess=mods.data||[]; else console.warn('Module access',mods.error);
    if(!profiles.error)safetyProfiles=profiles.data||[]; else safetyProfiles=state?.people||[];
    if(!siteRows.error)siteAccess=siteRows.data||[];
    if(!siteList.error)sites=siteList.data||sites;
  }

  function renderPeople(){
    const box=$('peopleV21149Content'); if(!box)return;
    const local=safetyProfiles.length?safetyProfiles:(state?.people||[]);
    const activeShared=sharedUsers.filter(x=>x.active!==false);

    box.innerHTML=`
      <div class="stats-grid">
        <div class="stat-card"><strong>${activeShared.length}</strong><span>Active app users</span></div>
        <div class="stat-card"><strong>${activeShared.filter(x=>!!resolvedSafetyUser(x)).length}</strong><span>With Safety account</span></div>
        <div class="stat-card"><strong>${local.filter(x=>x.active!==false).length}</strong><span>Active Safety accounts</span></div>
      </div>

      <div class="section-card">
        <div class="row-between people-head-v21149">
          <div>
            <h3>All app users</h3>
            <p class="muted">Global Inventory/Energy directory. Safety and site access are granted separately.</p>
          </div>
          <button class="secondary" type="button" data-v21149-refresh-users>Refresh users</button>
        </div>

        <div class="card-list">
          ${sharedUsers.map(u=>{
            const s=resolvedSafetyUser(u);
            const ma=s?moduleAccessFor(s.id):null;
            const assigned=s?accessSitesFor(s.id):[];
            const safetyOn=!!s && ma?.enabled!==false && s.active!==false;
            const safetyRole=ma?.role_override||(s?.report_only?'viewer':s?.role)||'user';
            return `<div class="item-card compact">
              <div class="row-between people-card-row-v21149">
                <div>
                  <strong>${esc(u.display_name||u.login_username||u.email||'User')}</strong>
                  <div class="meta">${u.email?`<span>${esc(u.email)}</span>`:''}${u.login_username?`<span>Username: ${esc(u.login_username)}</span>`:''}</div>
                  <div class="app-badges-v21149">
                    ${appBadge('Inventory',u.inventory_enabled,u.inventory_role)}
                    ${appBadge('Energy',u.energy_enabled,u.energy_role)}
                    ${safetyOn?appBadge('Safety',true,safetyRole):'<span class="badge due">Safety OFF</span>'}
                  </div>
                  ${assigned.length?`<div class="meta"><span>Safety sites: ${esc(assigned.map(x=>siteLabel(x.site_id)).join(', '))}</span></div>`:'<div class="meta"><span>No Safety site assigned</span></div>'}
                </div>
                ${isAdmin()?`<button class="primary access-btn-v21149" type="button" data-v21149-edit-shared="${esc(u.source_user_id)}">${s?'Edit access':'Give Safety access'}</button>`:''}
              </div>
            </div>`;
          }).join('')||'<div class="empty">No shared users found.</div>'}
        </div>
      </div>

      <div class="section-card">
        <h3>Safety accounts</h3>
        <p class="muted">Accounts that exist inside Safety Tracker. Site access remains explicit.</p>
        <div class="card-list">
          ${local.map(p=>{
            const ma=moduleAccessFor(p.id);
            const assigned=accessSitesFor(p.id);
            return `<div class="item-card compact">
              <div class="row-between people-card-row-v21149">
                <div>
                  <strong>${esc(p.display_name||p.email||p.login_username||'Safety user')}</strong>
                  <div class="meta">
                    <span class="badge ${p.active!==false&&ma?.enabled!==false?'complete':'neutral'}">${p.active!==false&&ma?.enabled!==false?'Active':'Disabled'}</span>
                    <span>${esc(ma?.role_override||(p.report_only?'viewer':p.role||'user'))}</span>
                    ${assigned.length?`<span>${esc(assigned.map(x=>siteLabel(x.site_id)).join(', '))}</span>`:'<span>No site</span>'}
                  </div>
                </div>
                ${isAdmin()?`<button class="secondary access-btn-v21149" type="button" data-v21149-edit-safety="${esc(p.id)}">Edit access</button>`:''}
              </div>
            </div>`;
          }).join('')||'<div class="empty">No Safety accounts found.</div>'}
        </div>
      </div>`;
  }


  function siteChecksHtml(userId=null){
    const assigned=new Set(userId?accessSitesFor(userId).map(x=>x.site_id):[]);
    return sites.filter(x=>x.active!==false).map(s=>{
      const creatorLocked=!!userId && s.created_by===userId;
      return `<label class="site-user-row-v21149">
        <input type="checkbox" class="pa-site-v21149" value="${esc(s.id)}" ${assigned.has(s.id)||creatorLocked?'checked':''} ${creatorLocked?'disabled':''}>
        <span><strong>${esc(s.name)}</strong><small>${creatorLocked?'Setup Admin · cannot remove':'Assign this Safety site'}</small></span>
      </label>`;
    }).join('')||'<div class="empty">No sites configured.</div>';
  }

  function homeSiteOptions(userId=null){
    const ma=userId?moduleAccessFor(userId):null;
    return `<option value="">No home site</option>`+sites.filter(x=>x.active!==false).map(s=>
      `<option value="${esc(s.id)}" ${ma?.home_site_id===s.id?'selected':''}>${esc(s.name)}</option>`
    ).join('');
  }

  async function openSharedAccessEditor(sourceId){
    if(!isAdmin())return;
    await loadSharedUsers();
    const u=sharedUsers.find(x=>x.source_user_id===sourceId);
    if(!u)return toast('Shared user not found.');
    const safety=resolvedSafetyUser(u);

    if(safety)return openSafetyAccessEditor(safety.id,sourceId);

    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Give Safety access';

    const username=suggestedUsername(u);
    const temp=generatedPassword();
    const hasEmail=!!clean(u.email);

    body.innerHTML=`
      <div class="section-card">
        <h3>${esc(u.display_name||u.email||u.login_username||'User')}</h3>
        <div class="meta">${u.email?`<span>${esc(u.email)}</span>`:''}${u.login_username?`<span>Username: ${esc(u.login_username)}</span>`:''}</div>
      </div>

      <div class="form-grid">
        <label>Safety role
          <select id="paNewRoleV21149">
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer / Reviewer</option>
          </select>
        </label>
        <label>Default working view
          <select id="paNewViewV21149">
            <option value="user">User</option>
            <option value="full">Full role view</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <label>Home site
          <select id="paNewHomeV21149">${homeSiteOptions()}</select>
        </label>
      </div>

      <div class="section-card">
        <h4>Safety sites</h4>
        <p class="muted">Nothing is selected automatically. Tick only the site(s) this person should access.</p>
        <div class="checkbox-list">${siteChecksHtml()}</div>
      </div>

      <div class="section-card">
        <h4>Login method</h4>
        ${hasEmail?`<label class="check-row"><input type="radio" name="paLoginMethodV21149" value="email" checked> Email invitation to ${esc(u.email)}</label>`:''}
        <label class="check-row"><input type="radio" name="paLoginMethodV21149" value="username" ${hasEmail?'':'checked'}> Username + temporary password</label>
        <div class="form-grid pa-username-fields-v21149" ${hasEmail?'hidden':''}>
          <label>Username<input id="paNewUsernameV21149" value="${esc(username)}" autocomplete="off"></label>
          <label>Temporary password<input id="paNewPasswordV21149" value="${esc(temp)}" autocomplete="off"></label>
        </div>
        <p class="muted">Username-only accounts use Admin password reset if they forget their password. Email accounts can use normal password recovery.</p>
      </div>

      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21149-create-access="${esc(sourceId)}">Create Safety access</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function createSharedSafetyAccess(sourceId,btn){
    const u=sharedUsers.find(x=>x.source_user_id===sourceId);
    if(!u)return;
    const role=$('paNewRoleV21149')?.value||'user';
    const view=$('paNewViewV21149')?.value||'user';
    const home=$('paNewHomeV21149')?.value||null;
    const selected=new Set([...document.querySelectorAll('.pa-site-v21149:checked')].map(x=>x.value));
    if(home)selected.add(home);

    const method=document.querySelector('input[name="paLoginMethodV21149"]:checked')?.value||(u.email?'email':'username');
    const username=clean($('paNewUsernameV21149')?.value)||suggestedUsername(u);
    const password=$('paNewPasswordV21149')?.value||generatedPassword();

    btn.disabled=true;const old=btn.textContent;btn.textContent='Creating…';
    try{
      const payload={
        action:'create',
        display_name:u.display_name||u.login_username||u.email||'User',
        email:method==='email'?clean(u.email):'',
        username:method==='username'?username:'',
        temporary_password:method==='username'?password:'',
        primary_role:role,
        apps:[{app:'safety',enabled:true,role,preferred_view:view,home_site_id:null}],
        redirect_to:`${location.origin}${location.pathname}?set-password=1`
      };
      const {data,error}=await sb.functions.invoke('manage-user-access-v21137',{body:payload});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      const userId=data?.user_id;
      if(!userId)throw new Error('Safety account was not returned.');

      const link=await sb.rpc('link_shared_user_to_safety_v21149',{p_source_user_id:sourceId,p_safety_user_id:userId});
      if(link.error)throw link.error;

      const access=await sb.rpc('set_safety_user_access_v21137',{
        p_user_id:userId,p_enabled:true,p_role:role,p_preferred_view:view,p_home_site_id:home
      });
      if(access.error)throw access.error;

      for(const site of sites.filter(x=>x.active!==false)){
        const enabled=selected.has(site.id);
        const sr=await sb.rpc('set_safety_site_access_v21137',{
          p_user_id:userId,p_site_id:site.id,p_enabled:enabled,p_role_override:role,p_is_home:site.id===home
        });
        if(sr.error)throw sr.error;
      }

      if(method==='username'){
        bodyCredentialResultV21149(u,username,password);
        await loadSharedUsers();renderPeople();
      }else{
        try{$('modal')?.close()}catch(_e){}
        await loadSharedUsers();renderPeople();
        toast('Safety invitation sent and access created.');
      }
    }catch(e){
      btn.disabled=false;btn.textContent=old;
      toast(e?.message||'Could not create Safety access.');
    }
  }

  function bodyCredentialResultV21149(u,username,password){
    const body=$('modalBody'),title=$('modalTitle');
    if(title)title.textContent='Safety access created';
    if(!body)return;
    body.innerHTML=`
      <div class="success-note"><strong>Safety account created for ${esc(u.display_name||username)}.</strong></div>
      <div class="section-card">
        <h3>Give these details to the user</h3>
        <p><strong>Username:</strong> ${esc(username)}</p>
        <p><strong>Temporary password:</strong> ${esc(password)}</p>
        <p class="muted">This temporary password is shown here so you can pass it to the user. They should change it after signing in.</p>
      </div>
      <div class="actions"><button class="primary" type="button" data-close-modal>Done</button></div>`;
  }

  async function openSafetyAccessEditor(userId,sourceId=null){
    if(!isAdmin())return;
    await loadSharedUsers();
    const p=profileById(userId);
    if(!p)return toast('Safety account not found.');
    const ma=moduleAccessFor(userId)||{enabled:true,role_override:p.report_only?'viewer':p.role,preferred_view:['admin','manager'].includes(p.role)?'full':'user',home_site_id:null};
    const role=ma.role_override||(p.report_only?'viewer':p.role)||'user';

    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Edit Safety access';

    body.innerHTML=`
      <div class="section-card">
        <h3>${esc(p.display_name||p.email||p.login_username||'Safety user')}</h3>
        <div class="meta">${p.email?`<span>${esc(p.email)}</span>`:''}${p.login_username?`<span>Username: ${esc(p.login_username)}</span>`:''}</div>
      </div>

      <div class="form-grid">
        <label class="check-row"><input id="paEnabledV21149" type="checkbox" ${ma.enabled!==false?'checked':''}> Safety Tracker access</label>
        <label>Safety role
          <select id="paRoleV21149">
            <option value="user" ${role==='user'?'selected':''}>User</option>
            <option value="manager" ${role==='manager'?'selected':''}>Manager</option>
            <option value="admin" ${role==='admin'?'selected':''}>Admin</option>
            <option value="viewer" ${role==='viewer'?'selected':''}>Viewer / Reviewer</option>
          </select>
        </label>
        <label>Default working view
          <select id="paViewV21149">
            <option value="user" ${ma.preferred_view==='user'?'selected':''}>User</option>
            <option value="full" ${ma.preferred_view==='full'?'selected':''}>Full role view</option>
            <option value="viewer" ${ma.preferred_view==='viewer'?'selected':''}>Viewer</option>
          </select>
        </label>
        <label>Home site<select id="paHomeV21149">${homeSiteOptions(userId)}</select></label>
      </div>

      <div class="section-card">
        <h4>Safety sites</h4>
        <p class="muted">Tick only the sites this person should access. A site's setup Admin cannot be removed from that site here.</p>
        <div class="checkbox-list">${siteChecksHtml(userId)}</div>
      </div>

      <div class="actions">
        ${p.login_username?`<button class="secondary" type="button" data-v21149-reset-password="${esc(userId)}">Reset temporary password</button>`:''}
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21149-save-access="${esc(userId)}" data-source-id="${esc(sourceId||'')}">Save access</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveSafetyAccess(userId,btn){
    const p=profileById(userId);if(!p)return;
    const enabled=!!$('paEnabledV21149')?.checked;
    const role=$('paRoleV21149')?.value||'user';
    const view=$('paViewV21149')?.value||'user';
    const home=$('paHomeV21149')?.value||null;
    const selected=new Set([...document.querySelectorAll('.pa-site-v21149:checked')].map(x=>x.value));
    if(home)selected.add(home);

    // Site creator access is always preserved.
    for(const site of sites){
      if(site.created_by===userId)selected.add(site.id);
    }

    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    try{
      const r=await sb.rpc('set_safety_user_access_v21137',{
        p_user_id:userId,p_enabled:enabled,p_role:role,p_preferred_view:view,p_home_site_id:home
      });
      if(r.error)throw r.error;

      for(const site of sites.filter(x=>x.active!==false)){
        const sr=await sb.rpc('set_safety_site_access_v21137',{
          p_user_id:userId,p_site_id:site.id,
          p_enabled:enabled&&selected.has(site.id),
          p_role_override:role,
          p_is_home:enabled&&site.id===home
        });
        if(sr.error)throw sr.error;
      }

      try{$('modal')?.close()}catch(_e){}
      await loadSharedUsers();renderPeople();
      toast('Safety access updated.');
    }catch(e){
      btn.disabled=false;btn.textContent=old;
      toast(e?.message||'Could not save Safety access.');
    }
  }

  async function resetTemporaryPassword(userId,btn){
    const p=profileById(userId);if(!p)return;
    const password=generatedPassword();
    if(!confirm(`Set a new temporary password for ${p.display_name||p.login_username||'this user'}?`))return;

    btn.disabled=true;const old=btn.textContent;btn.textContent='Resetting…';
    try{
      const {data,error}=await sb.functions.invoke('manage-user-access-v21137',{
        body:{action:'reset_password',user_id:userId,temporary_password:password}
      });
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      const body=$('modalBody'),title=$('modalTitle');
      if(title)title.textContent='Temporary password reset';
      if(body)body.innerHTML=`
        <div class="success-note"><strong>Temporary password created.</strong></div>
        <div class="section-card"><p><strong>User:</strong> ${esc(p.login_username||p.display_name||'User')}</p><p><strong>Temporary password:</strong> ${esc(password)}</p><p class="muted">Give this to the user securely. They should change it after signing in.</p></div>
        <div class="actions"><button class="primary" type="button" data-close-modal>Done</button></div>`;
    }catch(e){
      btn.disabled=false;btn.textContent=old;toast(e?.message||'Could not reset password.');
    }
  }

  async function openPeople(){
    if(!isManager())return;
    ensurePeopleView();
    await loadSharedUsers();
    renderPeople();
    showStandalone('peopleV21149View');
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

      if(e.target.closest?.('[data-v21149-admin-home]')){
        e.preventDefault();e.stopImmediatePropagation();adminHome();return;
      }
      if(e.target.closest?.('[data-v21149-create-site]')){
        e.preventDefault();e.stopImmediatePropagation();createSiteModal();return;
      }
      const save=e.target.closest?.('[data-v21149-save-site]');
      if(save){e.preventDefault();e.stopImmediatePropagation();saveSite(save);return}
      const open=e.target.closest?.('[data-v21149-open-site]');
      if(open){e.preventDefault();e.stopImmediatePropagation();switchSite(open.dataset.v21149OpenSite);return}
      const manage=e.target.closest?.('[data-v21149-manage-site-users]');
      if(manage){e.preventDefault();e.stopImmediatePropagation();manageSiteUsersModal(manage.dataset.v21149ManageSiteUsers);return}
      const saveUsers=e.target.closest?.('[data-v21149-save-site-users]');
      if(saveUsers){e.preventDefault();e.stopImmediatePropagation();saveSiteUsers(saveUsers.dataset.v21149SaveSiteUsers,saveUsers);return}
      const refresh=e.target.closest?.('[data-v21149-refresh-users]');
      if(refresh){e.preventDefault();e.stopImmediatePropagation();refreshUsers(refresh);return}
      if(e.target.closest?.('[data-v21149-create-safety]')){
        e.preventDefault();e.stopImmediatePropagation();
        $('inviteUserBtn')?.click();return;
      }
      if(e.target.closest?.('#mainNav button[data-view="admin"],[data-management-stable-action="view:admin"]')){
        [80,220,500].forEach(ms=>setTimeout(injectAdminShortcuts,ms));
      }
    },true);


    document.addEventListener('change',e=>{
      if(e.target?.name==='paLoginMethodV21149'){
        const fields=document.querySelector('.pa-username-fields-v21149');
        if(fields)fields.hidden=e.target.value!=='username';
      }
    },false);

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

    window.SafetyPeopleSitesV21149={openSites,openPeople};
    window.SafetyPeopleSitesV21146=window.SafetyPeopleSitesV21149;
  }

  boot().catch(e=>console.warn('Safety v2.11.49',e));
})();
