/* Safety Tracker v2.11.44 CLEAN
   - Stable standalone Sites page: no dependency on Admin section grouping.
   - Shared Inventory/Energy users visible at the top of Safety > People.
   - Early observer boundary blocks known Admin feedback observers before legacy hotfixes install.
   - No whole-page MutationObserver is created by this module.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21144)return;
  window.__SAFETY_V21144=true;

  /* -------------------------------------------------------------
     1. EARLY STABILITY BOUNDARY
     ------------------------------------------------------------- */
  const ParentObserver=window.MutationObserver;
  if(typeof ParentObserver==='function' && !window.__SAFETY_V21144_OBSERVER_BOUNDARY){
    window.__SAFETY_V21144_OBSERVER_BOUNDARY=true;

    class StableObserverV21144 {
      constructor(callback){
        this._inner=new ParentObserver(callback);
        try{this._src=Function.prototype.toString.call(callback)}catch(_e){this._src=''}
      }
      observe(target,options){
        const child=options?.childList===true;
        const subtree=options?.subtree===true;
        const id=target?.id||'';

        // Existing body/#appView decorators have finite startup/click/page hooks too.
        // Their broad observers can repaint the same DOM they just changed.
        if(child && subtree && (target===document.body || id==='appView'))return;

        // Admin accumulated several section classifiers that observe the whole
        // admin subtree then re-render/reclassify the same subtree. Block only
        // those callback shapes; keep attribute-only and modal/list observers.
        if(child && subtree && id==='adminView'){
          const s=this._src||'';
          if(
            /setTimeout\s*\(\s*render/.test(s) ||
            /setTimeout\s*\(\s*classify/.test(s) ||
            /refreshDecorations/.test(s) ||
            /scheduleEnforce/.test(s)
          ) return;
        }

        return this._inner.observe(target,options);
      }
      disconnect(){return this._inner.disconnect()}
      takeRecords(){return this._inner.takeRecords()}
    }
    window.MutationObserver=StableObserverV21144;
  }

  let api,state,sb;
  let sites=[],siteStatus=[],siteAccess=[],currentSiteId=null,sharedUsers=[];
  let loadingSites=false;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toLowerCase();

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
     2. SITES: STANDALONE VIEW
     ------------------------------------------------------------- */
  const statusFor=id=>siteStatus.find(x=>x.site_id===id&&x.module_key==='safety')||null;
  const usersForSite=id=>new Set(siteAccess.filter(x=>x.site_id===id&&x.enabled!==false).map(x=>x.user_id)).size;

  function ensureSitesTile(){
    if(!isAdmin())return;
    const grid=document.querySelector('#adminHomeV21083 .admin-tile-grid-v21083');
    if(!grid)return;

    // Remove/convert the v2.11.42 tile so the legacy Admin-section router cannot
    // send it to an empty grouped section.
    let tile=grid.querySelector('.sites-tile-v21142,[data-v21144-sites-tile]');
    if(!tile){
      tile=document.createElement('button');
      tile.type='button';
      tile.className='admin-tile-v21083 sites-tile-v21144';
      tile.innerHTML=
        '<span class="admin-tile-icon-v21083" aria-hidden="true">⌂</span>'+
        '<span class="admin-tile-copy-v21083">'+
          '<strong>Sites</strong>'+
          '<small>Create sites, see setup status and manage access.</small>'+
        '</span>';
      grid.insertAdjacentElement('afterbegin',tile);
    }

    tile.removeAttribute('data-admin-tile-v21083');
    tile.dataset.v21144SitesTile='1';
    tile.classList.add('sites-tile-v21144');
  }

  function ensureSitesView(){
    let view=$('sitesV21144View');
    if(view)return view;

    view=document.createElement('section');
    view.id='sitesV21144View';
    view.className='view';
    view.innerHTML=`
      <div class="page-heading sites-page-head-v21144">
        <div>
          <h2>Sites</h2>
          <p class="muted">Create and manage Safety Tracker sites.</p>
        </div>
        <button class="primary admin-only" type="button" data-v21144-create-site>Create site</button>
      </div>
      <button class="secondary sites-back-v21144" type="button" data-v21144-sites-back>← Admin sections</button>
      <div id="sitesV21144Content"></div>`;
    const app=$('appView')||document.querySelector('main')||document.body;
    app.appendChild(view);
    return view;
  }

  async function loadSites(){
    if(loadingSites||!state?.user)return;
    loadingSites=true;
    try{
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
    }finally{loadingSites=false}
  }

  function siteStatusLabel(v){
    if(v==='READY')return 'Ready';
    if(v==='DISABLED')return 'Disabled';
    return 'Setup required';
  }
  function siteStatusClass(v){
    if(v==='READY')return 'complete';
    if(v==='DISABLED')return 'neutral';
    return 'due';
  }

  function renderSites(){
    const box=$('sitesV21144Content');
    if(!box)return;
    const active=sites.filter(s=>s.active!==false);
    const ready=active.filter(s=>statusFor(s.id)?.status==='READY').length;
    const setup=active.filter(s=>(statusFor(s.id)?.status||'SETUP_REQUIRED')==='SETUP_REQUIRED').length;

    box.innerHTML=`
      <div class="stats-grid sites-stats-v21144">
        <div class="stat-card"><strong>${active.length}</strong><span>Sites</span></div>
        <div class="stat-card"><strong>${ready}</strong><span>Ready</span></div>
        <div class="stat-card"><strong>${setup}</strong><span>Setup required</span></div>
      </div>

      <div class="hint-box">
        <strong>Clean start:</strong> new sites do not inherit Main Hotel documents, training,
        PPE, First Aid, asbestos, contractor, check or history records.
      </div>

      <div class="card-list sites-list-v21144">
        ${active.map(site=>{
          const st=statusFor(site.id);
          const status=st?.status||'SETUP_REQUIRED';
          const current=site.id===currentSiteId;
          const people=usersForSite(site.id);
          return `<div class="item-card site-card-v21144">
            <div class="row-between site-card-row-v21144">
              <div>
                <div class="site-name-v21144">
                  <strong>${esc(site.name)}</strong>
                  <span class="badge ${siteStatusClass(status)}">${esc(siteStatusLabel(status))}</span>
                  ${current?'<span class="badge complete">Current</span>':''}
                </div>
                <div class="meta">
                  <span>${people} assigned user${people===1?'':'s'}</span>
                  <span>${esc(site.timezone||'Europe/London')}</span>
                </div>
                <p class="muted">${esc(st?.note||(
                  status==='READY'
                    ? 'Operational Safety site.'
                    : 'Clean site shell. Operational use remains protected until setup is ready.'
                ))}</p>
              </div>
              <div class="site-actions-v21144">
                ${status==='READY'&&!current
                  ? `<button class="secondary" type="button" data-v21144-open-site="${esc(site.id)}">Open site</button>`
                  : ''}
              </div>
            </div>
          </div>`;
        }).join('')||'<div class="empty">No sites have been created yet.</div>'}
      </div>

      <div class="section-card">
        <h3>New-site setup</h3>
        <div class="setup-grid-v21144">
          <div><b>1</b><span><strong>Create</strong><small>Clean site shell only.</small></span></div>
          <div><b>2</b><span><strong>People</strong><small>Assign only the people who need that site.</small></span></div>
          <div><b>3</b><span><strong>Configure</strong><small>Create that hotel's departments, locations and equipment.</small></span></div>
          <div><b>4</b><span><strong>Open</strong><small>Site becomes selectable when Safety setup is ready.</small></span></div>
        </div>
        <div class="actions"><button class="secondary" type="button" data-v21144-people>People & Access</button></div>
      </div>`;
  }

  async function openSites(){
    if(!isAdmin())return;
    ensureSitesView();
    await loadSites();
    renderSites();

    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    $('sitesV21144View')?.classList.add('active-view');
    document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('active',b.dataset.view==='admin'));
    window.scrollTo({top:0,behavior:'auto'});
  }

  function backToAdmin(){
    const admin=document.querySelector('#mainNav button[data-view="admin"]');
    if(admin)admin.click();
    setTimeout(()=>{
      try{window.SafetyAdminSectionsV21083?.home?.()}catch(_e){}
      ensureSitesTile();
    },80);
  }

  function createSiteModal(){
    if(!isAdmin())return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Create new site';
    body.innerHTML=`
      <div class="section-card">
        <h3>New Safety site</h3>
        <p class="muted">The new hotel starts with clear operational records. Nothing is copied from Main Hotel.</p>
      </div>
      <div class="form-grid">
        <label>Site name
          <input id="siteNameV21144" autocomplete="off" placeholder="e.g. Southampton Hotel">
        </label>
        <label>Timezone
          <select id="siteTimezoneV21144"><option value="Europe/London">Europe/London</option></select>
        </label>
      </div>
      <div class="hint-box">
        <strong>Starts clear:</strong> no documents, training history, PPE, First Aid,
        asbestos, contractor records or checks are copied.
      </div>
      <label class="check-row">
        <input id="siteConfirmV21144" type="checkbox">
        I understand this new site starts with clear records.
      </label>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21144-save-site>Create site</button>
      </div>`;
    if(!modal.open)modal.showModal();
    setTimeout(()=>$('siteNameV21144')?.focus(),60);
  }

  async function saveSite(button){
    const name=clean($('siteNameV21144')?.value);
    const tz=$('siteTimezoneV21144')?.value||'Europe/London';
    if(!name)return toast('Enter a site name.');
    if(!$('siteConfirmV21144')?.checked)return toast('Confirm the clean-start rule first.');

    button.disabled=true;
    const old=button.textContent;
    button.textContent='Creating…';

    const {error}=await sb.rpc('create_clean_safety_site_v21138',{
      p_name:name,
      p_timezone:tz
    });

    if(error){
      button.disabled=false;button.textContent=old;
      return toast(error.message);
    }
    try{$('modal')?.close()}catch(_e){}
    await loadSites();
    renderSites();
    toast(`${name} created with clear records.`);
  }

  async function switchSite(id){
    const {error}=await sb.rpc('set_current_safety_site_v21138',{p_site_id:id});
    if(error)return toast(error.message);
    location.reload();
  }

  /* -------------------------------------------------------------
     3. PEOPLE: SHARED APP DIRECTORY FIRST, LOCAL SAFETY ACCOUNTS SECOND
     ------------------------------------------------------------- */
  function localSafetyMatch(u){
    const people=state?.people||[];
    const email=norm(u.email),username=norm(u.login_username);
    return people.find(p=>
      (email && norm(p.email)===email) ||
      (username && norm(p.login_username)===username)
    )||null;
  }

  function badge(app,on,role){
    if(!on)return `<span class="badge neutral">${esc(app)} OFF</span>`;
    return `<span class="badge complete">${esc(app)}: ${esc(role||'user')}</span>`;
  }

  async function loadSharedPeople(){
    if(!isManager())return;
    const {data,error}=await sb.from('shared_app_users_v21143').select('*').order('display_name');
    if(error){
      console.warn('Shared People',error);
      return;
    }
    sharedUsers=data||[];
    renderSharedPeople();
  }

  function renderSharedPeople(){
    if(!isManager())return;
    const view=$('peopleView'),stats=$('peopleStats'),list=$('peopleList');
    if(!view||!stats||!list)return;

    const heading=view.querySelector('.page-heading p');
    if(heading)heading.textContent='People & Access — all app users, Safety accounts, roles, sites and responsibilities.';

    let panel=$('sharedPeopleV21144');
    if(!panel){
      panel=document.createElement('section');
      panel.id='sharedPeopleV21144';
      panel.className='section-card shared-people-v21144';
      stats.insertAdjacentElement('beforebegin',panel);
    }

    const active=sharedUsers.filter(x=>x.active!==false);
    const safetyLinked=sharedUsers.filter(x=>!!localSafetyMatch(x));
    panel.innerHTML=`
      <div class="row-between shared-people-head-v21144">
        <div>
          <h3>All app users</h3>
          <p class="muted">Inventory and Energy users are shown here even when they do not have Safety access.</p>
        </div>
        <span class="badge complete">${active.length} active</span>
      </div>
      <div class="shared-people-summary-v21144">
        <span>${sharedUsers.length} shared user${sharedUsers.length===1?'':'s'}</span>
        <span>${safetyLinked.length} matched to Safety</span>
      </div>
      <div class="card-list">
        ${active.map(u=>{
          const sp=localSafetyMatch(u);
          return `<div class="item-card compact">
            <strong>${esc(u.display_name||u.login_username||u.email||'User')}</strong>
            <div class="meta shared-badges-v21144">
              ${badge('Inventory',u.inventory_enabled,u.inventory_role)}
              ${badge('Energy',u.energy_enabled,u.energy_role)}
              ${sp
                ? badge('Safety',sp.active!==false,sp.report_only?'viewer':sp.role||'user')
                : '<span class="badge due">Safety OFF</span>'}
            </div>
          </div>`;
        }).join('')||'<div class="empty">No shared users available.</div>'}
      </div>
      <div class="hint-box">
        <strong>Safety access stays separate.</strong> A person can appear here because they use Inventory
        without automatically receiving access to Safety.
      </div>`;

    let label=$('safetyAccountsLabelV21144');
    if(!label){
      label=document.createElement('div');
      label.id='safetyAccountsLabelV21144';
      label.className='people-local-label-v21144';
      stats.insertAdjacentElement('beforebegin',label);
    }
    label.innerHTML='<h3>Safety accounts</h3><p class="muted">Only people who currently have a Safety Tracker account are counted below.</p>';

    // Remove old v2.11.43 duplicate if present.
    $('sharedAppDirectoryV21143')?.remove();
  }

  function openPeople(){
    document.querySelector('#mainNav button[data-view="people"]')?.click();
    setTimeout(loadSharedPeople,100);
  }

  /* -------------------------------------------------------------
     4. EVENTS / BOOT
     ------------------------------------------------------------- */
  function installStyles(){
    if($('safetyV21144Styles'))return;
    const s=document.createElement('style');
    s.id='safetyV21144Styles';
    s.textContent=`
      #safetySitesAdminV21139,#siteManagementV21142,#sharedAppDirectoryV21143{display:none!important}
      .sites-back-v21144{margin:0 0 14px}
      .sites-stats-v21144{margin-bottom:12px}
      .site-name-v21144{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .site-card-v21144 p{margin:7px 0 0}
      .site-card-row-v21144{gap:10px}
      .setup-grid-v21144{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
      .setup-grid-v21144>div{display:flex;gap:9px;align-items:flex-start}
      .setup-grid-v21144 b{flex:0 0 30px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#243b53}
      .setup-grid-v21144 span{display:flex;flex-direction:column;gap:2px}
      .setup-grid-v21144 small{color:var(--muted,#94a3b8)}
      .shared-people-v21144{margin:12px 0}
      .shared-people-head-v21144{gap:10px;align-items:flex-start}
      .shared-people-summary-v21144{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted,#94a3b8);margin:8px 0 12px}
      .shared-badges-v21144{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .people-local-label-v21144{margin:16px 0 8px}
      .people-local-label-v21144 h3{margin:0 0 4px}
      .people-local-label-v21144 p{margin:0}
      @media(max-width:700px){
        .site-card-row-v21144,.shared-people-head-v21144{display:block}
        .site-actions-v21144{margin-top:10px}
        .setup-grid-v21144{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  function installEvents(){
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-v21144-sites-tile]')){
        e.preventDefault();e.stopImmediatePropagation();
        openSites();
        return;
      }
      if(e.target.closest?.('[data-v21144-sites-back]')){
        e.preventDefault();e.stopImmediatePropagation();
        backToAdmin();
        return;
      }
      if(e.target.closest?.('[data-v21144-create-site]')){
        e.preventDefault();e.stopImmediatePropagation();
        createSiteModal();
        return;
      }
      const save=e.target.closest?.('[data-v21144-save-site]');
      if(save){
        e.preventDefault();e.stopImmediatePropagation();
        saveSite(save);
        return;
      }
      const open=e.target.closest?.('[data-v21144-open-site]');
      if(open){
        e.preventDefault();e.stopImmediatePropagation();
        switchSite(open.dataset.v21144OpenSite);
        return;
      }
      if(e.target.closest?.('[data-v21144-people]')){
        e.preventDefault();e.stopImmediatePropagation();
        openPeople();
        return;
      }

      if(e.target.closest?.('#mainNav button[data-view="admin"],[data-management-stable-action="view:admin"]')){
        setTimeout(ensureSitesTile,100);
        setTimeout(ensureSitesTile,350);
      }
      if(e.target.closest?.('#mainNav button[data-view="people"],[data-management-stable-action="view:people"]')){
        setTimeout(loadSharedPeople,120);
        setTimeout(renderSharedPeople,400);
      }
    },true);

    window.addEventListener('pageshow',()=>{
      setTimeout(ensureSitesTile,150);
      setTimeout(()=>{
        if($('peopleView')?.classList.contains('active-view'))loadSharedPeople();
      },220);
    });
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

    installStyles();
    ensureSitesView();
    installEvents();

    // Finite refreshes only.
    [100,350,900].forEach(ms=>setTimeout(ensureSitesTile,ms));
    await loadSharedPeople();

    window.SafetySitesPeopleV21144={
      openSites,
      reloadSites:async()=>{await loadSites();renderSites()},
      reloadPeople:loadSharedPeople
    };
  }

  boot().catch(e=>console.warn('Safety v2.11.44',e));
})();
