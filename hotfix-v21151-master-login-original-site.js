/* Safety Tracker v2.11.51 CLEAN
   Master login + original-site adoption.
   - Safety now authenticates against the shared Inventory/Energy master account.
   - Same email/username + same password; no separate Safety password.
   - Safety still receives its own short-lived internal session so existing RLS/data remains intact.
   - Giving Safety access provisions/links an internal Safety identity without creating a second credential.
   - Main Hotel is explicitly shown as the Original Site.
*/
'use strict';
(function(){
  if(window.__SAFETY_MASTER_LOGIN_V21151)return;
  window.__SAFETY_MASTER_LOGIN_V21151=true;

  const MASTER_URL='https://zgmcxgumdsssngfgtmth.supabase.co';
  const MASTER_KEY='sb_publishable_wRTwr1ZohznS-VLUjoSz2w_Nbv4qiZj';
  const MASTER_LOGIN=`${MASTER_URL}/functions/v1/master-login-v21151`;
  const MASTER_RESET_REDIRECT='https://grich295.github.io/inventory-tracker/';

  let api=null,state=null,sb=null;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toLowerCase();

  function showAuth(msg){
    const box=$('authMessage');
    if(box){box.hidden=false;box.textContent=msg}
    else console.log(msg);
  }
  function toast(msg){try{api?.toast?.(msg)}catch(_e){console.log(msg)}}
  function admin(){
    return String(state?.profile?.role||'').toLowerCase()==='admin' &&
      state?.profile?.report_only!==true &&
      state?.uiMode!=='user';
  }

  function decorateLogin(){
    const input=$('loginEmail');
    if(input){
      input.type='text';
      input.autocomplete='username';
      input.placeholder='Email or username';
      const label=input.previousElementSibling;
      if(label?.tagName==='LABEL')label.textContent='Email or username';
    }
    const forgot=$('forgotPasswordBtn');
    if(forgot)forgot.textContent='Forgot shared password';
    const form=$('loginForm');
    if(form && !form.querySelector('.master-login-note-v21151')){
      const note=document.createElement('div');
      note.className='hint-box master-login-note-v21151';
      note.innerHTML='<strong>One login:</strong> use the same email/username and password as Inventory/Energy.';
      form.insertAdjacentElement('afterbegin',note);
    }
  }

  async function masterLogin(identifier,password){
    const res=await fetch(MASTER_LOGIN,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':MASTER_KEY},
      body:JSON.stringify({identifier,password})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data?.access_token)throw new Error(data?.error||'Shared sign-in failed.');
    return data;
  }

  async function handleSafetyLogin(e){
    if(e.target?.id!=='loginForm')return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const identifier=clean($('loginEmail')?.value);
    const password=$('loginPassword')?.value||'';
    const btn=$('loginSubmitBtn');
    const boot=$('loginBootStatus');
    if(!identifier||!password)return showAuth('Enter your email/username and password.');

    if(btn){btn.disabled=true;btn.textContent='Signing in…'}
    if(boot)boot.textContent='Checking shared login…';
    const msg=$('authMessage');if(msg)msg.hidden=true;

    try{
      const master=await masterLogin(identifier,password);
      const {data:exchange,error:exchangeError}=await sb.functions.invoke(
        'exchange-master-session-v21151',
        {body:{master_access_token:master.access_token}}
      );
      if(exchangeError)throw exchangeError;
      if(exchange?.error)throw new Error(exchange.error);
      if(!exchange?.token_hash)throw new Error('Safety session could not be created.');

      const {data,error}=await sb.auth.verifyOtp({
        token_hash:exchange.token_hash,
        type:'magiclink'
      });
      if(error||!data?.session)throw error||new Error('Safety session was not created.');

      sessionStorage.setItem('safetyMasterLoginV21151','1');
      location.reload();
    }catch(err){
      if(boot)boot.textContent='Ready to sign in.';
      showAuth(err?.message||'Sign-in failed.');
      if(btn){btn.disabled=false;btn.textContent='Sign in'}
    }
  }

  async function handleForgot(e){
    const btn=e.target.closest?.('#forgotPasswordBtn');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const identifier=clean($('loginEmail')?.value);
    if(!identifier)return showAuth('Enter your email address or username first.');
    if(!identifier.includes('@')){
      return showAuth('Username-only account: ask an Admin to reset your shared password. The reset applies to every app.');
    }

    try{
      const master=window.supabase.createClient(MASTER_URL,MASTER_KEY,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
      const {error}=await master.auth.resetPasswordForEmail(identifier,{
        redirectTo:MASTER_RESET_REDIRECT
      });
      if(error)throw error;
      showAuth('Shared password reset email sent. The new password will be used for Inventory, Energy and Safety.');
    }catch(err){
      showAuth(err?.message||'Could not send the shared password reset email.');
    }
  }

  /* -------- Shared user -> Safety access (no second password) -------- */
  async function loadAccessContext(sourceId){
    const [user,link,sites,siteRows,mods]=await Promise.all([
      sb.from('shared_app_users_v21143').select('*').eq('source_user_id',sourceId).maybeSingle(),
      sb.from('shared_safety_user_links_v21148').select('*').eq('source_user_id',sourceId).maybeSingle(),
      sb.from('organisation_sites_v21137').select('*').eq('active',true).order('name'),
      sb.from('app_site_access_v21137').select('*').eq('module_key','safety'),
      sb.from('app_module_access_v21137').select('*').eq('module_key','safety')
    ]);
    const shared=user.data;
    const safetyUserId=link.data?.safety_user_id||null;
    const module=safetyUserId?(mods.data||[]).find(x=>x.user_id===safetyUserId):null;
    const assigned=safetyUserId?(siteRows.data||[]).filter(x=>x.user_id===safetyUserId&&x.enabled!==false):[];
    return {shared,safetyUserId,module,sites:sites.data||[],assigned};
  }

  function siteChecks(ctx){
    const assigned=new Set(ctx.assigned.map(x=>x.site_id));
    return ctx.sites.map(s=>{
      const locked=ctx.safetyUserId && s.created_by===ctx.safetyUserId;
      return `<label class="check-row master-site-row-v21151">
        <input class="master-site-check-v21151" type="checkbox" value="${esc(s.id)}"
          ${assigned.has(s.id)||locked?'checked':''} ${locked?'disabled':''}>
        <span><strong>${esc(s.name)}</strong>${s.is_original_site?' · Original site':''}${locked?' · Setup Admin':''}</span>
      </label>`;
    }).join('')||'<div class="empty">No Safety sites configured.</div>';
  }

  async function openSharedAccess(sourceId){
    if(!admin())return;
    const ctx=await loadAccessContext(sourceId);
    if(!ctx.shared)return toast('Shared user not found.');

    const role=String(ctx.module?.role_override||'user').toLowerCase();
    const view=String(ctx.module?.preferred_view||(['admin','manager'].includes(role)?'full':'user')).toLowerCase();
    const enabled=ctx.module?.enabled!==false && !!ctx.safetyUserId;
    const home=ctx.module?.home_site_id||'';

    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent=enabled?'Edit Safety access':'Give Safety access';

    body.innerHTML=`
      <div class="section-card">
        <h3>${esc(ctx.shared.display_name||ctx.shared.login_username||ctx.shared.email||'User')}</h3>
        <div class="meta">
          ${ctx.shared.email?`<span>${esc(ctx.shared.email)}</span>`:''}
          ${ctx.shared.login_username?`<span>Username: ${esc(ctx.shared.login_username)}</span>`:''}
        </div>
        <div class="hint-box"><strong>Shared login:</strong> no separate Safety password is created. This person uses the same login and password as Inventory/Energy.</div>
      </div>

      <div class="form-grid">
        <label class="check-row">
          <input id="masterSafetyEnabledV21151" type="checkbox" ${enabled?'checked':''}>
          Safety Tracker access
        </label>
        <label>Safety role
          <select id="masterSafetyRoleV21151">
            <option value="user" ${role==='user'?'selected':''}>User</option>
            <option value="manager" ${role==='manager'?'selected':''}>Manager</option>
            <option value="admin" ${role==='admin'?'selected':''}>Admin</option>
            <option value="viewer" ${role==='viewer'?'selected':''}>Viewer / Reviewer</option>
          </select>
        </label>
        <label>Default working view
          <select id="masterSafetyViewV21151">
            <option value="user" ${view==='user'?'selected':''}>User</option>
            <option value="full" ${view==='full'?'selected':''}>Full role view</option>
            <option value="viewer" ${view==='viewer'?'selected':''}>Viewer</option>
          </select>
        </label>
        <label>Home site
          <select id="masterSafetyHomeV21151">
            <option value="">No home site</option>
            ${ctx.sites.map(s=>`<option value="${esc(s.id)}" ${home===s.id?'selected':''}>${esc(s.name)}${s.is_original_site?' · Original site':''}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="section-card">
        <h4>Safety sites</h4>
        <p class="muted">Tick only the sites this person needs. New sites never inherit existing users.</p>
        <div>${siteChecks(ctx)}</div>
      </div>

      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21151-save-master-access="${esc(sourceId)}">Save access</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveSharedAccess(sourceId,btn){
    const enabled=!!$('masterSafetyEnabledV21151')?.checked;
    const role=$('masterSafetyRoleV21151')?.value||'user';
    const preferred=$('masterSafetyViewV21151')?.value||'user';
    const home=$('masterSafetyHomeV21151')?.value||null;
    const siteIds=[...document.querySelectorAll('.master-site-check-v21151:checked')].map(x=>x.value);
    if(home&&!siteIds.includes(home))siteIds.push(home);

    btn.disabled=true;
    const old=btn.textContent;
    btn.textContent='Saving…';
    try{
      const {data,error}=await sb.functions.invoke('manage-master-safety-access-v21151',{
        body:{
          source_user_id:sourceId,
          enabled,
          role,
          preferred_view:preferred,
          home_site_id:home,
          site_ids:siteIds
        }
      });
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      try{$('modal')?.close()}catch(_e){}
      toast('Safety access updated. The user keeps their existing shared login and password.');
      setTimeout(()=>{
        if(window.SafetyPeopleSitesV21149?.openPeople)window.SafetyPeopleSitesV21149.openPeople();
        else window.SafetyPeopleSitesV21146?.openPeople?.();
      },100);
    }catch(err){
      btn.disabled=false;
      btn.textContent=old;
      toast(err?.message||'Could not update Safety access.');
    }
  }

  /* -------- Original site -------- */
  async function decorateOriginalSite(){
    const container=$('sitesV21149Content')||$('sitesV21146Content');
    if(!container||container.querySelector('.original-site-summary-v21151'))return;
    const {data}=await sb.from('organisation_sites_v21137')
      .select('*')
      .eq('is_original_site',true)
      .eq('active',true)
      .maybeSingle();
    if(!data)return;

    const card=document.createElement('div');
    card.className='hint-box original-site-summary-v21151';
    card.innerHTML=`<strong>Original site:</strong> ${esc(data.name)} is now adopted as the original live Safety site. Existing records stay with this site; nothing is copied into new sites.`;
    container.insertAdjacentElement('afterbegin',card);

    // If a legacy renderer somehow omitted it, show a visible site card too.
    if(!norm(container.textContent).includes(norm(data.name))){
      const c=document.createElement('div');
      c.className='item-card';
      c.innerHTML=`<div class="site-title-v21151"><strong>${esc(data.name)}</strong><span class="badge complete">Original site</span><span class="badge complete">Ready</span></div><p class="muted">Existing live Safety records belong to this site.</p>`;
      card.insertAdjacentElement('afterend',c);
    }
  }

  function decorateSiteTile(){
    const tile=document.querySelector('[data-v21149-sites],[data-v21146-sites]');
    if(!tile||tile.querySelector('.original-site-tile-note-v21151'))return;
    const small=tile.querySelector('small');
    if(small)small.textContent='Main Hotel is the original site. Create and manage additional sites here.';
  }

  /* Window capture runs before v2.11.49 access handlers. */
  window.addEventListener('submit',e=>{
    if(e.target?.id==='loginForm')handleSafetyLogin(e);
  },true);

  window.addEventListener('click',e=>{
    if(e.target.closest?.('#forgotPasswordBtn')){handleForgot(e);return}

    const edit=e.target.closest?.('[data-v21149-edit-shared]');
    if(edit){
      e.preventDefault();e.stopImmediatePropagation();
      openSharedAccess(edit.dataset.v21149EditShared);
      return;
    }

    const save=e.target.closest?.('[data-v21151-save-master-access]');
    if(save){
      e.preventDefault();e.stopImmediatePropagation();
      saveSharedAccess(save.dataset.v21151SaveMasterAccess,save);
      return;
    }

    if(e.target.closest?.('[data-v21149-sites],[data-v21146-sites]')){
      setTimeout(decorateOriginalSite,180);
      setTimeout(decorateOriginalSite,550);
    }
  },true);

  function installStyles(){
    if($('masterLoginStylesV21151'))return;
    const s=document.createElement('style');
    s.id='masterLoginStylesV21151';
    s.textContent=`
      .master-login-note-v21151{margin:8px 0 12px}
      .master-site-row-v21151{align-items:flex-start}
      .original-site-summary-v21151{margin-bottom:12px}
      .site-title-v21151{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    `;
    document.head.appendChild(s);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,100);return}
    state=api.state;sb=api.sb;
    installStyles();
    decorateLogin();
    decorateSiteTile();

    [150,450,1000,2200].forEach(ms=>setTimeout(()=>{
      decorateLogin();
      decorateSiteTile();
      decorateOriginalSite();
    },ms));

    window.addEventListener('pageshow',()=>{
      setTimeout(decorateLogin,100);
      setTimeout(decorateOriginalSite,220);
    });

    window.SafetyMasterLoginV21151={
      openSharedAccess,
      decorateOriginalSite
    };
  }
  boot();
})();
