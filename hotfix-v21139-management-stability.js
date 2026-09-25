/* Safety Tracker v2.11.39 CLEAN
   Management navigation + dropdown stability repair.
   - Replaces the v2.11.38 body-wide site decorator with idempotent DOM updates.
   - Stops the site dropdown being rebuilt while it is open.
   - Resets Admin sub-sections back to Admin tiles whenever Admin is entered again.
   - Reinforces Management home tiles when returning from a management section.
   - Retains v2.11.38 clean-site creation/protection; no database change required.
*/
'use strict';
(function(){
  if(window.__SAFETY_MANAGEMENT_STABILITY_V21139)return;
  window.__SAFETY_MANAGEMENT_STABILITY_V21139=true;

  let api,state,sb,sites=[],statusRows=[],currentSiteId=null,queued=false,loading=false;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true;
  const statusFor=id=>statusRows.find(x=>x.site_id===id&&x.module_key==='safety')||null;
  const toast=msg=>{try{api?.toast?.(msg)}catch(_e){console.log(msg)}};

  async function loadSites(){
    if(loading||!state?.user)return;
    loading=true;
    try{
      const [s,st,cur]=await Promise.all([
        sb.from('organisation_sites_v21137').select('*').order('name'),
        sb.from('site_module_status_v21138').select('*'),
        sb.rpc('current_safety_site_v21138')
      ]);
      if(!s.error)sites=s.data||[];
      if(!st.error)statusRows=st.data||[];
      if(!cur.error)currentSiteId=cur.data||state?.profile?.home_site_id||null;
      state.organisationSitesV21138=sites;
      state.safetySiteStatusV21138=statusRows;
      state.currentSafetySiteV21138=currentSiteId;
    }finally{loading=false}
  }

  function decorateVersion(){
    document.querySelectorAll('.version,.dashboard-version,.build-badge').forEach(el=>{
      const wanted=el.classList.contains('build-badge')?'Safety Tracker v2.11.39 CLEAN':'v2.11.39';
      if(el.textContent!==wanted)el.textContent=wanted;
    });
  }

  async function switchReadySite(id){
    if(!id||id===currentSiteId)return;
    const {error}=await sb.rpc('set_current_safety_site_v21138',{p_site_id:id});
    if(error)return toast(error.message);
    location.reload();
  }

  function decorateTopbar(){
    if(!state?.user)return;
    const ready=sites.filter(s=>s.active!==false&&statusFor(s.id)?.status==='READY');
    const chip=document.querySelector('.user-chip');
    if(!chip||!ready.length)return;

    let wrap=$('safetySiteSwitcherV21139');
    if(!wrap){
      wrap=document.createElement('label');
      wrap.id='safetySiteSwitcherV21139';
      wrap.className='top-site-switcher-v21139';
      wrap.innerHTML='<span>Site</span><select id="safetySiteSelectV21139"></select>';
      chip.prepend(wrap);
    }

    const sel=$('safetySiteSelectV21139');
    if(!sel)return;
    const sig=[currentSiteId,...ready.map(s=>`${s.id}:${s.name}`)].join('|');

    // Key v2.11.39 repair: do not rebuild a native select while the user is using it.
    if(wrap.dataset.signature!==sig && document.activeElement!==sel){
      sel.innerHTML=ready.map(s=>`<option value="${esc(s.id)}" ${s.id===currentSiteId?'selected':''}>${esc(s.name)}</option>`).join('');
      wrap.dataset.signature=sig;
    }
    if(!sel.dataset.boundV21139){
      sel.dataset.boundV21139='1';
      sel.addEventListener('change',()=>switchReadySite(sel.value));
    }
  }

  function sitesCard(){
    return `<div class="section-card" id="safetySitesAdminV21139">
      <div class="row-between"><div><h3>Sites</h3><p class="muted">New sites start completely clean. No Main Hotel Safety records are copied.</p></div><button class="primary" type="button" data-v21139-new-site>New clean site</button></div>
      <div class="hint-box"><strong>Protection:</strong> new Safety sites stay in <b>SETUP REQUIRED</b> and cannot be opened operationally yet. This prevents Main Hotel documents, training and check history appearing in another site before full Safety site isolation is completed.</div>
      <div class="card-list" style="margin-top:12px">${sites.filter(s=>s.active!==false).map(s=>{
        const st=statusFor(s.id),ready=st?.status==='READY',cur=s.id===currentSiteId;
        return `<div class="item-card compact"><div class="row-between"><div><strong>${esc(s.name)}</strong><div class="meta"><span class="badge ${ready?'complete':'due'}">${esc(st?.status||'SETUP_REQUIRED')}</span>${cur?'<span class="badge complete">CURRENT</span>':''}</div><div class="muted">${esc(st?.note||'')}</div></div>${ready&&!cur?`<button class="secondary" type="button" data-v21139-open-site="${esc(s.id)}">Open</button>`:''}</div></div>`;
      }).join('')}</div>
    </div>`;
  }

  function decorateAdmin(){
    if(!isAdmin())return;
    const view=$('adminView');
    if(!view||$('safetySitesAdminV21139'))return;
    const heading=view.querySelector('.page-heading');
    heading?.insertAdjacentHTML('afterend',sitesCard());
  }

  async function createSite(){
    if(!isAdmin())return;
    const name=clean(prompt('New Safety site name:',''));
    if(!name)return;
    if(!confirm(`Create "${name}" as a clean Safety site shell?\n\nNo departments, documents, training, PPE, First Aid, asbestos or contractor records will be copied.`))return;
    const {error}=await sb.rpc('create_clean_safety_site_v21138',{p_name:name,p_timezone:'Europe/London'});
    if(error)return toast(error.message);
    await loadSites();
    $('safetySitesAdminV21139')?.remove();
    decorateAdmin();decorateTopbar();
    toast(`${name} created clean. Operational opening remains protected until Safety site isolation is completed.`);
  }

  function adminHome(){
    const view=$('adminView');
    if(!view?.classList.contains('active-view'))return;
    try{window.SafetyAdminSectionsV21083?.home?.()}catch(e){console.warn('Admin home repair',e)}
  }

  function managementHome(){
    const view=$('reportsView');
    if(!view?.classList.contains('active-view'))return;
    try{window.SafetyManagementStableV21111?.open?.()}catch(e){console.warn('Management home repair',e)}
  }

  function installNavigationRepair(){
    const adminView=$('adminView');
    const reportsView=$('reportsView');
    const Observer=window.MutationObserver;

    if(adminView&&typeof Observer==='function'){
      let wasActive=adminView.classList.contains('active-view');
      const mo=new Observer(()=>{
        const active=adminView.classList.contains('active-view');
        if(active&&!wasActive)setTimeout(adminHome,0);
        wasActive=active;
      });
      mo.observe(adminView,{attributes:true,attributeFilter:['class']});
    }

    if(reportsView&&typeof Observer==='function'){
      let wasActive=reportsView.classList.contains('active-view');
      const mo=new Observer(()=>{
        const active=reportsView.classList.contains('active-view');
        if(active&&!wasActive)setTimeout(managementHome,0);
        wasActive=active;
      });
      mo.observe(reportsView,{attributes:true,attributeFilter:['class']});
    }

    document.addEventListener('click',e=>{
      const adminEntry=e.target.closest?.(
        '#mainNav [data-view="admin"],'+
        '[data-management-stable-action="view:admin"],'+
        '[data-management-tile-key="admin"]'
      );
      if(adminEntry)setTimeout(adminHome,90);

      const managementEntry=e.target.closest?.(
        '#mainNav [data-view="reports"],'+
        '[data-management-stable-home],'+
        '.management-back-v21111,'+
        '.management-back-v21079,'+
        '[data-repair95-management-back]'
      );
      if(managementEntry)setTimeout(managementHome,90);
    },true);
  }

  function installStyles(){
    if($('safetyManagementStylesV21139'))return;
    const s=document.createElement('style');
    s.id='safetyManagementStylesV21139';
    s.textContent=`
      .top-site-switcher-v21139{display:flex;align-items:center;gap:5px;font-size:12px}
      .top-site-switcher-v21139 select{max-width:170px;pointer-events:auto!important;touch-action:manipulation}
      @media(max-width:720px){.top-site-switcher-v21139{width:100%;justify-content:flex-end}.top-site-switcher-v21139 select{max-width:150px}}
    `;
    document.head.appendChild(s);
  }

  function decorate(){
    queued=false;
    installStyles();decorateVersion();decorateTopbar();decorateAdmin();
  }
  function queue(){
    if(queued)return;
    queued=true;
    setTimeout(decorate,150);
  }

  document.addEventListener('click',e=>{
    const n=e.target.closest?.('[data-v21139-new-site]');
    if(n){e.preventDefault();createSite();return}
    const o=e.target.closest?.('[data-v21139-open-site]');
    if(o){e.preventDefault();switchReadySite(o.dataset.v21139OpenSite);return}
    queue();
  },true);

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    installNavigationRepair();
    loadSites().then(queue).catch(e=>console.warn('Safety management v2.11.39',e));

    // Idempotent body observer: unlike v2.11.38 it never rewrites an unchanged select.
    const Observer=window.MutationObserver;
    if(typeof Observer==='function'){
      const obs=new Observer(()=>queue());
      obs.observe(document.body,{childList:true,subtree:true});
    }
    window.addEventListener('pageshow',()=>{loadSites().then(queue).catch(()=>{});setTimeout(()=>{adminHome();managementHome()},120)});
  }
  boot();
})();
