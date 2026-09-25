/* Safety Tracker v2.11.45 CLEAN
   Stable Admin/Sites/People consolidation.
   - Stops Admin whole-subtree observer feedback loops.
   - Sites opens as a standalone screen and cannot be swallowed by legacy Admin routing.
   - People & Access opens as a standalone screen showing all shared app users first.
   - Removes Viewer Access setup from Admin.
   - No body-wide MutationObserver is created here.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21145)return;
  window.__SAFETY_V21145=true;

  let api=null,state=null,sb=null;
  let sites=[],siteStatus=[],siteAccess=[],currentSiteId=null,sharedUsers=[];
  let pendingAction=null;
  let booted=false;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toLowerCase();

  /* -------------------------------------------------------------
     1) Install the stability boundary NOW, before legacy Admin modules.
     ------------------------------------------------------------- */
  const ParentObserver=window.MutationObserver;
  if(typeof ParentObserver==='function'&&!window.__SAFETY_V21145_OBSERVER_BOUNDARY){
    window.__SAFETY_V21145_OBSERVER_BOUNDARY=true;

    class SafetyStableObserverV21145 {
      constructor(callback){
        this._inner=new ParentObserver(callback);
      }
      observe(target,options){
        const child=options?.childList===true;
        const subtree=options?.subtree===true;
        const id=target?.id||'';

        // Legacy broad observers repeatedly modify the same DOM that they watch.
        // All affected modules also have startup/click/pageshow refreshes.
        if(child && subtree && (target===document.body || id==='appView'))return;

        // Admin has several overlapping classifiers/renderers. Blocking child-list
        // observation of the Admin root removes the mobile repaint loop. Attribute
        // observers and scoped modal/list observers remain available.
        if(child && id==='adminView')return;

        // Old People decorators can also rebuild filters/cards while a native
        // Android select is open.
        if(child && subtree && id==='peopleView')return;

        return this._inner.observe(target,options);
      }
      disconnect(){return this._inner.disconnect()}
      takeRecords(){return this._inner.takeRecords()}
    }
    window.MutationObserver=SafetyStableObserverV21145;
  }

  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true &&
    state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true &&
    state?.uiMode!=='user';

  function toast(msg){
    try{api?.toast?.(msg)}catch(_e){console.log(msg)}
  }

  /* -------------------------------------------------------------
     2) EARLY click interception.
     This handler is registered before legacy Admin routing, so Sites/People
     cannot be redirected to an empty Admin group.
     ------------------------------------------------------------- */
  document.addEventListener('click',e=>{
    const sitesHit=e.target.closest?.(
      '[data-v21145-sites-tile],.sites-tile-v21144,.sites-tile-v21142'
    );
    if(sitesHit){
      e.preventDefault();e.stopImmediatePropagation();
      pendingAction='sites';
      if(booted)openSites();
      return;
    }

    const peopleHit=e.target.closest?.(
      '[data-v21145-people-tile],'+
      '[data-management-stable-action="view:people"],'+
      '[data-management-tile-key="people"]'
    );
    if(peopleHit){
      e.preventDefault();e.stopImmediatePropagation();
      pendingAction='people';
      if(booted)openPeople();
      return;
    }
  },true);

  /* -------------------------------------------------------------
     3) Admin landing: Sites + People first, no Viewer Access.
     ------------------------------------------------------------- */
  function tidyAdminLanding(){
    if(!isAdmin())return;
    const landing=$('adminHomeV21083');
    const grid=landing?.querySelector('.admin-tile-grid-v21083');
    if(!grid)return;

    // Remove Viewer Access setup tile and hide its underlying Admin card.
    grid.querySelectorAll('[data-admin-tile-v21083="viewer"]').forEach(x=>x.remove());
    document.querySelectorAll('#adminView [data-admin-section-v21083="viewer"]').forEach(x=>{
      x.hidden=true;
      x.style.display='none';
    });

    // Remove old Sites variants so only one stable tile exists.
    grid.querySelectorAll(
      '.sites-tile-v21142,.sites-tile-v21144,[data-v21144-sites-tile],[data-v21142-sites-tile]'
    ).forEach(x=>x.remove());

    let sitesTile=grid.querySelector('[data-v21145-sites-tile]');
    if(!sitesTile){
      sitesTile=document.createElement('button');
      sitesTile.type='button';
      sitesTile.className='admin-tile-v21083 sites-tile-v21145';
      sitesTile.dataset.v21145SitesTile='1';
      sitesTile.innerHTML=
        '<span class="admin-tile-icon-v21083" aria-hidden="true">⌂</span>'+
        '<span class="admin-tile-copy-v21083"><strong>Sites</strong>'+
        '<small>Create sites, see setup status and manage access.</small></span>';
    }

    let peopleTile=grid.querySelector('[data-v21145-people-tile]');
    if(!peopleTile){
      peopleTile=document.createElement('button');
      peopleTile.type='button';
      peopleTile.className='admin-tile-v21083 people-tile-v21145';
      peopleTile.dataset.v21145PeopleTile='1';
      peopleTile.innerHTML=
        '<span class="admin-tile-icon-v21083" aria-hidden="true">♙</span>'+
        '<span class="admin-tile-copy-v21083"><strong>People & Access</strong>'+
        '<small>All app users, Safety access, roles and site access.</small></span>';
    }

    // Keep Sites and People as the first row.
    grid.prepend(peopleTile);
    grid.prepend(sitesTile);
  }

  /* -------------------------------------------------------------
     4) Standalone Sites screen.
     ------------------------------------------------------------- */
  const statusFor=id=>siteStatus.find(x=>x.site_id===id&&x.module_key==='safety')||null;
  const sitePeopleCount=id=>new Set(
    siteAccess.filter(x=>x.site_id===id&&x.enabled!==false).map(x=>x.user_id)
  ).size;

  function ensureSitesView(){
    let view=$('sitesV21145View');
    if(view)return view;

    view=document.createElement('section');
    view.id='sitesV21145View';
    view.className='view standalone-admin-view-v21145';
    view.innerHTML=`
      <div class="page-heading">
        <div>
          <h2>Sites</h2>
          <p class="muted">Create and manage hotel sites. New sites always start clean.</p>
        </div>
        <button class="primary" type="button" data-v21145-create-site>Create site</button>
      </div>
      <button class="secondary standalone-back-v21145" type="button" data-v21145-admin-home>← Admin sections</button>
      <div id="sitesV21145Content"></div>`;

    ($('appView')||document.querySelector('main')||document.body).appendChild(view);
    return view;
  }

  async function loadSites(){
    if(!state?.user)return;
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

  function statusLabel(v){
    if(v==='READY')return 'Ready';
    if(v==='DISABLED')return 'Disabled';
    return 'Setup required';
  }
  function statusClass(v){
    if(v==='READY')return 'complete';
    if(v==='DISABLED')return 'neutral';
    return 'due';
  }

  function renderSites(){
    const box=$('sitesV21145Content');
    if(!box)return;
    const active=sites.filter(x=>x.active!==false);

    box.innerHTML=`
      <div class="stats-grid">
        <div class="stat-card"><strong>${active.length}</strong><span>Sites</span></div>
        <div class="stat-card"><strong>${active.filter(x=>statusFor(x.id)?.status==='READY').length}</strong><span>Ready</span></div>
        <div class="stat-card"><strong>${active.filter(x=>(statusFor(x.id)?.status||'SETUP_REQUIRED')==='SETUP_REQUIRED').length}</strong><span>Setup required</span></div>
      </div>

      <div class="hint-box">
        <strong>Clean start:</strong> new sites do not receive Main Hotel documents, training,
        PPE, First Aid, asbestos, contractors, checks or history.
      </div>

      <div class="card-list sites-list-v21145">
        ${active.map(site=>{
          const st=statusFor(site.id);
          const status=st?.status||'SETUP_REQUIRED';
          const current=site.id===currentSiteId;
          const count=sitePeopleCount(site.id);
          return `<div class="item-card">
            <div class="row-between standalone-row-v21145">
              <div>
                <div class="standalone-title-v21145">
                  <strong>${esc(site.name)}</strong>
                  <span class="badge ${statusClass(status)}">${esc(statusLabel(status))}</span>
                  ${current?'<span class="badge complete">Current site</span>':''}
                </div>
                <div class="meta">
                  <span>${count} assigned user${count===1?'':'s'}</span>
                  <span>${esc(site.timezone||'Europe/London')}</span>
                </div>
                <p class="muted">${esc(st?.note||'')}</p>
              </div>
              ${status==='READY'&&!current
                ? `<button class="secondary" type="button" data-v21145-open-site="${esc(site.id)}">Open site</button>`
                : ''}
            </div>
          </div>`;
        }).join('')||'<div class="empty">No sites found.</div>'}
      </div>

      <div class="section-card">
        <h3>New-site setup</h3>
        <div class="setup-grid-v21145">
          <div><b>1</b><span><strong>Create site</strong><small>Creates a clean site shell.</small></span></div>
          <div><b>2</b><span><strong>Assign people</strong><small>Add only the people who need access.</small></span></div>
          <div><b>3</b><span><strong>Configure</strong><small>Set departments, locations and Safety equipment.</small></span></div>
          <div><b>4</b><span><strong>Open for use</strong><small>Site becomes selectable once its setup is ready.</small></span></div>
        </div>
        <div class="actions">
          <button class="secondary" type="button" data-v21145-open-people>People & Access</button>
        </div>
      </div>`;
  }

  async function openSites(){
    if(!isAdmin())return;
    ensureSitesView();
    await loadSites();
    renderSites();
    showStandalone('sitesV21145View');
  }

  function createSiteModal(){
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Create new site';
    body.innerHTML=`
      <div class="section-card">
        <h3>New Safety site</h3>
        <p class="muted">No existing operational records are copied from Main Hotel.</p>
      </div>
      <div class="form-grid">
        <label>Site name
          <input id="newSiteNameV21145" autocomplete="off" placeholder="e.g. Southampton Hotel">
        </label>
        <label>Timezone
          <select id="newSiteTimezoneV21145">
            <option value="Europe/London">Europe/London</option>
          </select>
        </label>
      </div>
      <label class="check-row">
        <input id="newSiteConfirmV21145" type="checkbox">
        I understand this site starts with clear records.
      </label>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21145-save-site>Create site</button>
      </div>`;
    if(!modal.open)modal.showModal();
    setTimeout(()=>$('newSiteNameV21145')?.focus(),40);
  }

  async function saveSite(btn){
    const name=clean($('newSiteNameV21145')?.value);
    const tz=$('newSiteTimezoneV21145')?.value||'Europe/London';
    if(!name)return toast('Enter a site name.');
    if(!$('newSiteConfirmV21145')?.checked)return toast('Confirm that the new site starts with clear records.');

    const old=btn.textContent;btn.disabled=true;btn.textContent='Creating…';
    const {error}=await sb.rpc('create_clean_safety_site_v21138',{p_name:name,p_timezone:tz});
    if(error){btn.disabled=false;btn.textContent=old;return toast(error.message)}
    try{$('modal')?.close()}catch(_e){}
    await loadSites();renderSites();
    toast(`${name} created with clear records.`);
  }

  async function switchSite(id){
    const {error}=await sb.rpc('set_current_safety_site_v21138',{p_site_id:id});
    if(error)return toast(error.message);
    location.reload();
  }

  /* -------------------------------------------------------------
     5) Standalone People & Access screen.
     ------------------------------------------------------------- */
  function ensurePeopleView(){
    let view=$('peopleV21145View');
    if(view)return view;

    view=document.createElement('section');
    view.id='peopleV21145View';
    view.className='view standalone-admin-view-v21145';
    view.innerHTML=`
      <div class="page-heading">
        <div>
          <h2>People & Access</h2>
          <p class="muted">All current app users, with Safety access shown separately.</p>
        </div>
        <button class="primary" type="button" data-v21145-create-safety-user>Create Safety user</button>
      </div>
      <button class="secondary standalone-back-v21145" type="button" data-v21145-admin-home>← Admin sections</button>
      <div id="peopleV21145Content"></div>`;

    ($('appView')||document.querySelector('main')||document.body).appendChild(view);
    return view;
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
    if(error){
      console.warn('Shared users',error);
      sharedUsers=[];
    }else sharedUsers=data||[];
  }

  async function refreshSharedUsers(button=null){
    if(!isAdmin())return;
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Refreshing…'}
    try{
      const {error}=await sb.functions.invoke('sync-shared-user-directory-v21143',{body:{action:'sync'}});
      if(error)throw error;
      await loadSharedUsers();
      renderPeople();
      toast('Shared app users refreshed.');
    }catch(e){
      console.warn('Shared user refresh',e);
      toast('Could not refresh the shared directory. Existing user list kept.');
    }finally{
      if(button){button.disabled=false;button.textContent=old||'Refresh users'}
    }
  }

  function renderPeople(){
    const box=$('peopleV21145Content');
    if(!box)return;

    const local=state?.people||[];
    const sharedActive=sharedUsers.filter(x=>x.active!==false);
    const linked=sharedUsers.filter(x=>!!localSafetyMatch(x));

    box.innerHTML=`
      <div class="stats-grid">
        <div class="stat-card"><strong>${sharedActive.length}</strong><span>Active app users</span></div>
        <div class="stat-card"><strong>${linked.length}</strong><span>Matched to Safety</span></div>
        <div class="stat-card"><strong>${local.filter(x=>x.active!==false).length}</strong><span>Active Safety accounts</span></div>
      </div>

      <div class="section-card">
        <div class="row-between standalone-head-v21145">
          <div>
            <h3>All app users</h3>
            <p class="muted">Inventory and Energy users appear here whether or not they have Safety access.</p>
          </div>
          <button class="secondary" type="button" data-v21145-refresh-users>Refresh users</button>
        </div>

        <div class="card-list shared-users-v21145">
          ${sharedUsers.map(u=>{
            const s=localSafetyMatch(u);
            return `<div class="item-card compact">
              <strong>${esc(u.display_name||u.login_username||u.email||'User')}</strong>
              <div class="meta">${u.email?`<span>${esc(u.email)}</span>`:''}</div>
              <div class="meta app-badges-v21145">
                ${appBadge('Inventory',u.inventory_enabled,u.inventory_role)}
                ${appBadge('Energy',u.energy_enabled,u.energy_role)}
                ${s
                  ? appBadge('Safety',s.active!==false,s.report_only?'viewer':s.role||'user')
                  : '<span class="badge due">Safety OFF</span>'}
              </div>
            </div>`;
          }).join('')||'<div class="empty">No shared app users found.</div>'}
        </div>
      </div>

      <div class="section-card">
        <h3>Safety accounts</h3>
        <p class="muted">These are the accounts that currently exist inside Safety Tracker.</p>
        <div class="card-list">
          ${local.map(p=>`<div class="item-card compact">
            <strong>${esc(p.display_name||p.email||'Safety user')}</strong>
            <div class="meta">
              <span class="badge ${p.active!==false?'complete':'neutral'}">${p.active!==false?'Active':'Disabled'}</span>
              <span>${esc(p.report_only?'viewer':p.role||'user')}</span>
              ${p.department_name?`<span>${esc(p.department_name)}</span>`:''}
            </div>
          </div>`).join('')||'<div class="empty">No Safety accounts found.</div>'}
        </div>
      </div>

      <div class="hint-box">
        <strong>App access is independent.</strong> Being an Inventory user does not automatically give somebody Safety access.
      </div>`;
  }

  async function openPeople(){
    if(!isManager())return;
    ensurePeopleView();
    await loadSharedUsers();
    renderPeople();
    showStandalone('peopleV21145View');
  }

  function showStandalone(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    $(id)?.classList.add('active-view');
    document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('active',b.dataset.view==='admin'));
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_e){}
  }

  function adminHome(){
    const b=document.querySelector('#mainNav button[data-view="admin"]');
    if(b)b.click();
    setTimeout(()=>{
      try{window.SafetyAdminSectionsV21083?.home?.()}catch(_e){}
      tidyAdminLanding();
    },80);
  }

  /* -------------------------------------------------------------
     6) UI events after boot.
     ------------------------------------------------------------- */
  function installEvents(){
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-v21145-admin-home]')){
        e.preventDefault();e.stopImmediatePropagation();adminHome();return;
      }
      if(e.target.closest?.('[data-v21145-create-site]')){
        e.preventDefault();e.stopImmediatePropagation();createSiteModal();return;
      }
      const save=e.target.closest?.('[data-v21145-save-site]');
      if(save){
        e.preventDefault();e.stopImmediatePropagation();saveSite(save);return;
      }
      const open=e.target.closest?.('[data-v21145-open-site]');
      if(open){
        e.preventDefault();e.stopImmediatePropagation();switchSite(open.dataset.v21145OpenSite);return;
      }
      if(e.target.closest?.('[data-v21145-open-people]')){
        e.preventDefault();e.stopImmediatePropagation();openPeople();return;
      }
      const refresh=e.target.closest?.('[data-v21145-refresh-users]');
      if(refresh){
        e.preventDefault();e.stopImmediatePropagation();refreshSharedUsers(refresh);return;
      }
      if(e.target.closest?.('[data-v21145-create-safety-user]')){
        e.preventDefault();e.stopImmediatePropagation();
        // Reuse the existing, already-secured Safety create-user flow.
        const old=$('inviteUserBtn');
        if(old)old.click();
        else toast('Safety user creation is not available in this build.');
        return;
      }

      if(e.target.closest?.('#mainNav button[data-view="admin"],[data-management-stable-action="view:admin"]')){
        [80,220].forEach(ms=>setTimeout(tidyAdminLanding,ms));
      }
    },true);

    window.addEventListener('pageshow',()=>setTimeout(tidyAdminLanding,120));
  }

  function installStyles(){
    if($('safetyV21145Styles'))return;
    const s=document.createElement('style');
    s.id='safetyV21145Styles';
    s.textContent=`
      #safetySitesAdminV21139,#siteManagementV21142,#sitesV21144View,#peopleV21144View,
      #sharedAppDirectoryV21143{display:none!important}
      #adminView [data-admin-section-v21083="viewer"]{display:none!important}
      .standalone-back-v21145{margin:0 0 14px}
      .standalone-title-v21145{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .standalone-row-v21145{gap:12px;align-items:flex-start}
      .standalone-row-v21145 p{margin:7px 0 0}
      .setup-grid-v21145{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
      .setup-grid-v21145>div{display:flex;gap:9px;align-items:flex-start}
      .setup-grid-v21145 b{flex:0 0 30px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#243b53}
      .setup-grid-v21145 span{display:flex;flex-direction:column;gap:2px}
      .setup-grid-v21145 small{color:var(--muted,#94a3b8)}
      .standalone-head-v21145{gap:10px;align-items:flex-start}
      .app-badges-v21145{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .sites-list-v21145,.shared-users-v21145{margin-top:12px}
      @media(max-width:700px){
        .standalone-row-v21145,.standalone-head-v21145{display:block}
        .standalone-row-v21145>button,.standalone-head-v21145>button{width:100%;margin-top:9px}
        .setup-grid-v21145{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb||!window.SafetyAdminSectionsV21083){
      setTimeout(boot,100);
      return;
    }
    state=api.state;
    sb=api.sb;
    if(!state.user)return;

    booted=true;
    installStyles();
    ensureSitesView();
    ensurePeopleView();
    installEvents();

    [80,220,650].forEach(ms=>setTimeout(tidyAdminLanding,ms));

    if(pendingAction==='sites'){pendingAction=null;openSites()}
    else if(pendingAction==='people'){pendingAction=null;openPeople()}

    window.SafetyStableAdminV21145={
      openSites,
      openPeople,
      tidy:tidyAdminLanding
    };
  }

  boot().catch(e=>console.warn('Safety v2.11.45',e));
})();
