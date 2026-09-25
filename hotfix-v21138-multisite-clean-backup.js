/* Safety Tracker v2.11.38 CLEAN - Clean-site foundation
   - Adds Admin site register and clean-site creation.
   - New Safety sites create a shell only: no departments, documents, training, PPE, First Aid,
     asbestos, contractor or report history is copied.
   - Operational opening of a new Safety site is intentionally blocked while it is SETUP_REQUIRED.
     This prevents existing Main Hotel records being shown in a new site before full Safety row-level isolation.
   - Existing JSON and Full Backup ZIP remain available; site metadata is added to the backup state.
*/
'use strict';
(function(){
  if(window.__SAFETY_CLEAN_SITE_V21138)return;
  window.__SAFETY_CLEAN_SITE_V21138=true;

  let api,state,sb,sites=[],statusRows=[],currentSiteId=null,queued=false;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true;
  const statusFor=id=>statusRows.find(x=>x.site_id===id&&x.module_key==='safety')||null;
  const siteName=id=>sites.find(s=>s.id===id)?.name||'Safety site';

  function toast(msg){try{api?.toast?.(msg)}catch(_e){alert(msg)}}

  async function loadSites(){
    if(!state?.user)return;
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
  }

  function decorateVersion(){
    document.querySelectorAll('.version,.dashboard-version,.build-badge').forEach(el=>{
      if(el.classList.contains('build-badge'))el.textContent='Safety Tracker v2.11.38 CLEAN';
      else if(el.classList.contains('version'))el.textContent='v2.11.38';
    });
  }

  async function switchReadySite(id){
    const {error}=await sb.rpc('set_current_safety_site_v21138',{p_site_id:id});
    if(error)return toast(error.message);
    location.reload();
  }

  function decorateTopbar(){
    if(!state?.user)return;
    const ready=sites.filter(s=>s.active!==false&&statusFor(s.id)?.status==='READY');
    const chip=document.querySelector('.user-chip');if(!chip||!ready.length)return;
    let wrap=$('safetySiteSwitcherV21138');
    if(!wrap){wrap=document.createElement('label');wrap.id='safetySiteSwitcherV21138';wrap.className='top-site-switcher-v21138';wrap.innerHTML='<span>Site</span><select id="safetySiteSelectV21138"></select>';chip.prepend(wrap)}
    const sel=$('safetySiteSelectV21138');if(sel){sel.innerHTML=ready.map(s=>`<option value="${esc(s.id)}" ${s.id===currentSiteId?'selected':''}>${esc(s.name)}</option>`).join('');sel.onchange=()=>switchReadySite(sel.value)}
  }

  function sitesCard(){
    return `<div class="section-card" id="safetySitesAdminV21138">
      <div class="row-between"><div><h3>Sites</h3><p class="muted">New sites start completely clean. No Main Hotel Safety records are copied.</p></div><button class="primary" type="button" data-v21138-new-site>New clean site</button></div>
      <div class="hint-box"><strong>Protection:</strong> new Safety sites stay in <b>SETUP REQUIRED</b> and cannot be opened operationally yet. This deliberately prevents Main Hotel documents/training/check history appearing in a new site before the remaining Safety tables/RPCs have full site isolation.</div>
      <div class="card-list" style="margin-top:12px">${sites.filter(s=>s.active!==false).map(s=>{
        const st=statusFor(s.id),ready=st?.status==='READY',cur=s.id===currentSiteId;
        return `<div class="item-card compact"><div class="row-between"><div><strong>${esc(s.name)}</strong><div class="meta"><span class="badge ${ready?'complete':'due'}">${esc(st?.status||'SETUP_REQUIRED')}</span>${cur?'<span class="badge complete">CURRENT</span>':''}</div><div class="muted">${esc(st?.note||'')}</div></div>${ready&&!cur?`<button class="secondary" type="button" data-v21138-open-site="${esc(s.id)}">Open</button>`:''}</div></div>`;
      }).join('')}</div>
    </div>`;
  }

  function decorateAdmin(){
    if(!isAdmin())return;
    const view=$('adminView');if(!view||$('safetySitesAdminV21138'))return;
    const heading=view.querySelector('.page-heading');heading?.insertAdjacentHTML('afterend',sitesCard());
  }

  async function createSite(){
    if(!isAdmin())return;
    const name=clean(prompt('New Safety site name:',''));if(!name)return;
    if(!confirm(`Create "${name}" as a clean Safety site shell?\n\nNo departments, documents, training, PPE, First Aid, asbestos or contractor records will be copied.`))return;
    const {data,error}=await sb.rpc('create_clean_safety_site_v21138',{p_name:name,p_timezone:'Europe/London'});
    if(error)return toast(error.message);
    await loadSites();$('safetySitesAdminV21138')?.remove();decorateAdmin();decorateTopbar();
    toast(`${name} created clean. Operational opening remains protected until Safety site isolation is completed.`);
  }

  function installStyles(){
    if($('safetySitesStylesV21138'))return;
    const s=document.createElement('style');s.id='safetySitesStylesV21138';s.textContent=`
      .top-site-switcher-v21138{display:flex;align-items:center;gap:5px;font-size:12px}
      .top-site-switcher-v21138 select{max-width:170px}
      @media(max-width:720px){.top-site-switcher-v21138{width:100%;justify-content:flex-end}.top-site-switcher-v21138 select{max-width:150px}}
    `;document.head.appendChild(s);
  }

  function decorate(){queued=false;installStyles();decorateVersion();decorateTopbar();decorateAdmin()}
  function queue(){if(queued)return;queued=true;setTimeout(decorate,130)}

  document.addEventListener('click',e=>{
    const n=e.target.closest?.('[data-v21138-new-site]');if(n){e.preventDefault();createSite();return}
    const o=e.target.closest?.('[data-v21138-open-site]');if(o){e.preventDefault();switchReadySite(o.dataset.v21138OpenSite);return}
    queue();
  },true);

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    loadSites().then(queue).catch(e=>console.warn('Safety sites v2.11.38',e));
    const obs=new MutationObserver(queue);obs.observe(document.body,{childList:true,subtree:true});
  }
  boot();
})();
