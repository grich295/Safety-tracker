/* Safety Tracker v2.11.42 CLEAN - Sites user interface
   Adds a first-class Sites tile to Admin & Setup and a proper site-management UI.
   Uses the existing clean-site backend from v2.11.38.
   No body-wide MutationObserver is used.
*/
'use strict';
(function(){
  if(window.__SAFETY_SITES_UI_V21142)return;
  window.__SAFETY_SITES_UI_V21142=true;

  let api,state,sb;
  let sites=[],statusRows=[],accessRows=[],currentSiteId=null,loading=false;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true &&
    state?.uiMode!=='user';

  function toast(msg){
    try{api?.toast?.(msg)}catch(_e){alert(msg)}
  }

  async function loadSites(){
    if(loading||!state?.user)return;
    loading=true;
    try{
      const [s,st,a,cur]=await Promise.all([
        sb.from('organisation_sites_v21137').select('*').order('name'),
        sb.from('site_module_status_v21138').select('*'),
        sb.from('app_site_access_v21137').select('*').eq('module_key','safety'),
        sb.rpc('current_safety_site_v21138')
      ]);
      if(!s.error)sites=s.data||[];
      if(!st.error)statusRows=st.data||[];
      if(!a.error)accessRows=a.data||[];
      if(!cur.error)currentSiteId=cur.data||null;
    }finally{
      loading=false;
    }
  }

  const statusFor=id=>statusRows.find(x=>x.site_id===id&&x.module_key==='safety')||null;
  const assignedCount=id=>new Set(
    accessRows.filter(x=>x.site_id===id&&x.enabled!==false).map(x=>x.user_id)
  ).size;

  function statusLabel(status){
    if(status==='READY')return 'Ready';
    if(status==='SETUP_REQUIRED')return 'Setup required';
    if(status==='DISABLED')return 'Disabled';
    return 'Setup required';
  }

  function statusClass(status){
    if(status==='READY')return 'complete';
    if(status==='DISABLED')return 'neutral';
    return 'due';
  }

  function ensureTile(){
    if(!isAdmin())return;
    const grid=document.querySelector('#adminHomeV21083 .admin-tile-grid-v21083');
    if(!grid||grid.querySelector('[data-admin-tile-v21083="sites"]'))return;

    const button=document.createElement('button');
    button.type='button';
    button.className='admin-tile-v21083 sites-tile-v21142';
    button.dataset.adminTileV21083='sites';
    button.innerHTML=
      '<span class="admin-tile-icon-v21083" aria-hidden="true">⌂</span>'+
      '<span class="admin-tile-copy-v21083">'+
        '<strong>Sites</strong>'+
        '<small>Create sites, see setup status and manage access.</small>'+
      '</span>';
    grid.insertAdjacentElement('afterbegin',button);
  }

  function siteCard(site){
    const st=statusFor(site.id);
    const status=st?.status||'SETUP_REQUIRED';
    const current=site.id===currentSiteId;
    const ready=status==='READY';
    const people=assignedCount(site.id);

    return `<div class="site-card-v21142">
      <div class="site-card-main-v21142">
        <div class="site-title-row-v21142">
          <strong>${esc(site.name)}</strong>
          <span class="badge ${statusClass(status)}">${esc(statusLabel(status))}</span>
          ${current?'<span class="badge complete">Current site</span>':''}
        </div>
        <div class="meta">
          <span>${people} assigned user${people===1?'':'s'}</span>
          <span>${esc(site.timezone||'Europe/London')}</span>
        </div>
        <p class="muted">${esc(st?.note||(
          ready
            ? 'Operational Safety site.'
            : 'Clean site shell. Operational records have not been copied from another site.'
        ))}</p>
      </div>
      <div class="site-card-actions-v21142">
        ${ready&&!current?`<button class="secondary" type="button" data-v21142-open-site="${esc(site.id)}">Open site</button>`:''}
        ${!ready?'<span class="site-protected-v21142">Protected until setup is ready</span>':''}
      </div>
    </div>`;
  }

  function renderPanel(){
    if(!isAdmin())return;
    const view=$('adminView');
    if(!view)return;

    let panel=$('siteManagementV21142');
    if(!panel){
      panel=document.createElement('section');
      panel.id='siteManagementV21142';
      panel.className='section-card sites-section-v21142';
      panel.dataset.adminSectionV21083='sites';
      view.appendChild(panel);
    }

    panel.innerHTML=`
      <div class="row-between sites-head-v21142">
        <div>
          <h3>Sites</h3>
          <p class="muted">Create and manage hotel sites. Every new site starts clean and separate from Main Hotel.</p>
        </div>
        <button class="primary" type="button" data-v21142-create-site>Create new site</button>
      </div>

      <div class="site-summary-v21142">
        <div class="stat-card"><strong>${sites.filter(x=>x.active!==false).length}</strong><span>Sites</span></div>
        <div class="stat-card"><strong>${sites.filter(x=>statusFor(x.id)?.status==='READY').length}</strong><span>Ready</span></div>
        <div class="stat-card"><strong>${sites.filter(x=>statusFor(x.id)?.status==='SETUP_REQUIRED').length}</strong><span>Setup required</span></div>
      </div>

      <div class="hint-box site-clean-note-v21142">
        <strong>Clean-start rule:</strong> a new site does not receive Main Hotel documents, training,
        PPE/First Aid records, asbestos information, contractors, checks or history.
        Admin access is added automatically; other people are assigned only when required.
      </div>

      <div class="sites-list-v21142">
        ${sites.filter(x=>x.active!==false).map(siteCard).join('')||'<div class="empty">No sites configured.</div>'}
      </div>

      <div class="section-card setup-guide-v21142">
        <h4>New-site setup</h4>
        <div class="setup-steps-v21142">
          <div class="setup-step-v21142"><span>1</span><div><strong>Create site</strong><small>Creates a completely clean Safety site shell.</small></div></div>
          <div class="setup-step-v21142"><span>2</span><div><strong>Assign people</strong><small>Choose who needs Safety access at that site.</small></div></div>
          <div class="setup-step-v21142"><span>3</span><div><strong>Configure site</strong><small>Departments, locations and Safety equipment are created for that hotel only.</small></div></div>
          <div class="setup-step-v21142"><span>4</span><div><strong>Open for use</strong><small>The site becomes selectable only when its Safety setup is safely isolated and ready.</small></div></div>
        </div>
        <div class="actions">
          <button class="secondary" type="button" data-v21142-people>People & Access</button>
        </div>
      </div>`;
  }

  function openCreateModal(){
    if(!isAdmin())return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;

    if(title)title.textContent='Create new Safety site';
    body.innerHTML=`
      <div class="section-card">
        <h3>New hotel / site</h3>
        <p class="muted">This creates a clean site. Existing Safety records are never copied across.</p>
      </div>
      <div class="form-grid">
        <label>Site name
          <input id="siteNameV21142" autocomplete="off" placeholder="e.g. Southampton Hotel">
        </label>
        <label>Timezone
          <select id="siteTimezoneV21142">
            <option value="Europe/London" selected>Europe/London</option>
          </select>
        </label>
      </div>
      <div class="clean-start-list-v21142">
        <strong>The new site starts with:</strong>
        <div>✓ Clean Safety site shell</div>
        <div>✓ Admin access</div>
        <div>✓ Default Safety structure only</div>
        <div>— No documents or training history copied</div>
        <div>— No PPE or First Aid records copied</div>
        <div>— No asbestos or contractor history copied</div>
      </div>
      <label class="check-row">
        <input id="siteCleanConfirmV21142" type="checkbox">
        I understand this site starts with clear operational records.
      </label>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21142-confirm-create>Create site</button>
      </div>`;
    if(!modal.open)modal.showModal();
    setTimeout(()=>$('siteNameV21142')?.focus(),50);
  }

  async function createSite(button){
    const name=clean($('siteNameV21142')?.value);
    const timezone=$('siteTimezoneV21142')?.value||'Europe/London';
    const confirmed=!!$('siteCleanConfirmV21142')?.checked;

    if(!name)return toast('Enter the site name.');
    if(name.length<2)return toast('Enter a valid site name.');
    if(!confirmed)return toast('Confirm that the new site should start with clear records.');

    button.disabled=true;
    const old=button.textContent;
    button.textContent='Creating…';

    const {error}=await sb.rpc('create_clean_safety_site_v21138',{
      p_name:name,
      p_timezone:timezone
    });

    if(error){
      button.disabled=false;
      button.textContent=old;
      return toast(error.message);
    }

    try{$('modal')?.close()}catch(_e){}
    await loadSites();
    renderPanel();
    ensureTile();
    toast(`${name} created. It has clear records and is protected in Setup required until ready.`);
  }

  async function switchSite(id){
    if(!id)return;
    const {error}=await sb.rpc('set_current_safety_site_v21138',{p_site_id:id});
    if(error)return toast(error.message);
    location.reload();
  }

  function openPeople(){
    const b=document.querySelector('#mainNav [data-view="people"]');
    if(b)b.click();
    else toast('People & Access is not available in this view.');
  }

  function installStyles(){
    if($('sitesStylesV21142'))return;
    const s=document.createElement('style');
    s.id='sitesStylesV21142';
    s.textContent=`
      #safetySitesAdminV21139{display:none!important}
      .sites-tile-v21142 .admin-tile-icon-v21083{font-size:1.35rem}
      .sites-section-v21142[hidden]{display:none!important}
      .sites-head-v21142{gap:14px;align-items:flex-start}
      .site-summary-v21142{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
      .site-summary-v21142 .stat-card{min-height:auto;padding:13px}
      .site-summary-v21142 .stat-card strong{display:block;font-size:1.45rem}
      .site-summary-v21142 .stat-card span{color:var(--muted,#94a3b8)}
      .sites-list-v21142{display:grid;gap:10px;margin:14px 0}
      .site-card-v21142{border:1px solid var(--border,#475569);border-radius:14px;padding:14px;display:flex;gap:12px;justify-content:space-between;align-items:center;background:var(--card,#1f1f1f)}
      .site-title-row-v21142{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .site-title-row-v21142>strong{font-size:1.05rem}
      .site-card-main-v21142{min-width:0}
      .site-card-main-v21142 p{margin:7px 0 0}
      .site-card-actions-v21142{flex:0 0 auto}
      .site-protected-v21142{display:inline-block;padding:7px 9px;border-radius:9px;background:rgba(180,120,20,.12);color:#f0c980;font-size:.8rem;font-weight:700}
      .setup-guide-v21142{margin-top:16px}
      .setup-steps-v21142{display:grid;gap:9px;margin:10px 0}
      .setup-step-v21142{display:flex;gap:10px;align-items:flex-start}
      .setup-step-v21142>span{flex:0 0 30px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#243b53;color:#fff;font-weight:900}
      .setup-step-v21142>div{display:flex;flex-direction:column;gap:2px}
      .setup-step-v21142 small{color:var(--muted,#94a3b8);line-height:1.35}
      .clean-start-list-v21142{margin:12px 0;padding:12px;border:1px solid var(--border,#475569);border-radius:12px;display:grid;gap:5px}
      @media(max-width:700px){
        .sites-head-v21142{display:block}
        .sites-head-v21142 button{width:100%;margin-top:10px}
        .site-summary-v21142{grid-template-columns:1fr 1fr}
        .site-card-v21142{display:block}
        .site-card-actions-v21142{margin-top:10px}
      }
    `;
    document.head.appendChild(s);
  }

  function refreshUi(){
    installStyles();
    ensureTile();
    renderPanel();
  }

  function installEvents(){
    document.addEventListener('click',e=>{
      const create=e.target.closest?.('[data-v21142-create-site]');
      if(create){e.preventDefault();e.stopImmediatePropagation();openCreateModal();return}

      const confirm=e.target.closest?.('[data-v21142-confirm-create]');
      if(confirm){e.preventDefault();e.stopImmediatePropagation();createSite(confirm);return}

      const open=e.target.closest?.('[data-v21142-open-site]');
      if(open){e.preventDefault();e.stopImmediatePropagation();switchSite(open.dataset.v21142OpenSite);return}

      if(e.target.closest?.('[data-v21142-people]')){
        e.preventDefault();e.stopImmediatePropagation();openPeople();return;
      }

      if(e.target.closest?.(
        '#mainNav [data-view="admin"],'+
        '[data-management-stable-action="view:admin"],'+
        '[data-management-tile-key="admin"],'+
        '#adminSectionBackV21083'
      )){
        setTimeout(refreshUi,100);
        setTimeout(refreshUi,350);
      }
    },true);

    window.addEventListener('pageshow',()=>{
      setTimeout(async()=>{
        await loadSites();
        refreshUi();
      },150);
    });
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb||!window.SafetyAdminSectionsV21083){
      setTimeout(boot,120);
      return;
    }
    state=api.state;
    sb=api.sb;
    if(!state.user)return;

    await loadSites();
    installStyles();
    refreshUi();
    installEvents();

    // Finite retries only. No MutationObserver: avoids the mobile flicker issue.
    [250,700,1400].forEach(ms=>setTimeout(refreshUi,ms));

    window.SafetySitesV21142={
      reload:async()=>{await loadSites();refreshUi()},
      openCreate:openCreateModal
    };
  }

  boot().catch(e=>console.warn('Safety Sites v2.11.42',e));
})();
