/* Safety Tracker v2.11.54 CACHE RECOVERY
   The phone was still serving v2.11.52 after v2.11.53 was uploaded.
   Clear stale Safety caches once, then allow the current service worker to rebuild.
*/
(function(){
  if(window.__SAFETY_CACHE_RECOVERY_V21154)return;
  window.__SAFETY_CACHE_RECOVERY_V21154=true;
  try{
    const done=sessionStorage.getItem('safety-cache-recovery-v21154')==='1';
    if(!done){
      sessionStorage.setItem('safety-cache-recovery-v21154','1');
      if(window.caches?.keys){
        caches.keys().then(keys=>Promise.all(
          keys.filter(k=>/^safety-(?:shell|runtime)-/i.test(k)).map(k=>caches.delete(k))
        )).catch(()=>{});
      }
      if(navigator.serviceWorker?.getRegistrations){
        navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(
          regs.filter(r=>{
            const u=r.active?.scriptURL||r.waiting?.scriptURL||r.installing?.scriptURL||'';
            return /\/Safety-tracker\//i.test(u);
          }).map(r=>r.update().catch(()=>{}))
        )).catch(()=>{});
      }
    }
  }catch(_e){}
})();

window.SAFETY_TRACKER_CONFIG = {
  supabaseUrl: "https://qvgcralroduuoptbnctt.supabase.co",
  supabaseKey: "sb_publishable_RNVM7b_qqOIUDdnVjZqtzg_JzTih75_"
};

/* v2.11.54 DIRECT SHARED LOGIN
   This runs immediately from config.js at the login screen.
   Do not move it back into the delayed hotfix loader.
*/
(function(){
  if(window.__SAFETY_DIRECT_SHARED_LOGIN_V21154)return;
  window.__SAFETY_DIRECT_SHARED_LOGIN_V21154=true;

  const MASTER_URL='https://zgmcxgumdsssngfgtmth.supabase.co';
  const MASTER_KEY='sb_publishable_wRTwr1ZohznS-VLUjoSz2w_Nbv4qiZj';
  const SAFETY_URL='https://qvgcralroduuoptbnctt.supabase.co';
  const SAFETY_KEY='sb_publishable_RNVM7b_qqOIUDdnVjZqtzg_JzTih75_';
  const MASTER_LOGIN=MASTER_URL+'/functions/v1/master-login-v21151';
  const EXCHANGE=SAFETY_URL+'/functions/v1/exchange-master-session-v21151';
  const RESET_REDIRECT='https://grich295.github.io/inventory-tracker/';

  let safetyClient=null;
  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

  function client(){
    if(safetyClient)return safetyClient;
    if(!window.supabase)return null;
    safetyClient=window.supabase.createClient(SAFETY_URL,SAFETY_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        storage:window.localStorage,
        storageKey:'safety-tracker-supabase-auth-v2914'
      }
    });
    return safetyClient;
  }

  function show(msg){
    const box=$('authMessage');
    if(box){box.hidden=false;box.textContent=msg}
    else console.warn(msg);
  }

  function decorate(){
    const input=$('loginEmail');
    if(input){
      input.type='text';
      input.autocomplete='username';
      input.placeholder='Email or username';
      const label=input.closest('label');
      if(label){
        for(const n of [...label.childNodes]){
          if(n.nodeType===Node.TEXT_NODE){n.textContent='Email or username';break}
        }
      }
    }
    const form=$('loginForm');
    document.querySelectorAll('.master-login-note-v21151').forEach(x=>x.remove());
    if(form&&!form.querySelector('.master-login-note-v21154')){
      const note=document.createElement('div');
      note.className='hint-box master-login-note-v21154';
      note.innerHTML='<strong>One login:</strong> use the same email/username and password as Inventory/Energy.';
      form.insertAdjacentElement('afterbegin',note);
    }
    const forgot=$('forgotPasswordBtn');
    if(forgot)forgot.textContent='Forgot shared password?';
  }

  async function post(url,body,key){
    const r=await fetch(url,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':key},
      body:JSON.stringify(body)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.error||data?.message||('Request failed '+r.status));
    return data;
  }

  async function signIn(identifier,password){
    const master=await post(MASTER_LOGIN,{identifier,password},MASTER_KEY);
    if(!master?.access_token)throw new Error('Shared login did not return a valid session.');

    const exchange=await post(EXCHANGE,{master_access_token:master.access_token},SAFETY_KEY);
    if(!exchange?.token_hash)throw new Error(exchange?.error||'Safety access is not enabled for this account.');

    const sb=client();
    if(!sb)throw new Error('Safety sign-in is still loading. Refresh once.');
    const {data,error}=await sb.auth.verifyOtp({
      token_hash:exchange.token_hash,
      type:'magiclink'
    });
    if(error)throw error;
    if(!data?.session)throw new Error('Safety session was not created.');

    const {data:persisted,error:persistError}=await sb.auth.setSession({
      access_token:data.session.access_token,
      refresh_token:data.session.refresh_token
    });
    if(persistError)throw persistError;
    if(!persisted?.session)throw new Error('Safety session could not be persisted.');
    return persisted.session;
  }

  async function handleSubmit(e){
    if(e.target?.id!=='loginForm')return;
    e.preventDefault();
    e.stopImmediatePropagation();

    decorate();
    const identifier=clean($('loginEmail')?.value);
    const password=$('loginPassword')?.value||'';
    if(!identifier||!password)return show('Enter your email/username and password.');

    const box=$('authMessage');if(box)box.hidden=true;
    const btn=$('loginSubmitBtn');
    const boot=$('loginBootStatus');
    if(btn){btn.disabled=true;btn.textContent='Signing in…'}
    if(boot)boot.textContent='Checking shared login…';

    try{
      await signIn(identifier,password);
      if(boot)boot.textContent='Signed in. Opening Safety Tracker…';
      location.reload();
    }catch(err){
      console.error('Safety shared login',err);
      if(boot)boot.textContent='Ready to sign in.';
      show(err?.message||'Sign-in failed.');
      if(btn){btn.disabled=false;btn.textContent='Sign in'}
    }
  }

  async function handleForgot(e){
    if(!e.target.closest?.('#forgotPasswordBtn'))return;
    e.preventDefault();
    e.stopImmediatePropagation();

    decorate();
    const identifier=clean($('loginEmail')?.value);
    if(!identifier)return show('Enter your email address or username first.');
    if(!identifier.includes('@')){
      return show('Username-only account: ask an Admin to reset the shared password. That reset applies to Inventory, Energy and Safety.');
    }

    try{
      const master=window.supabase.createClient(MASTER_URL,MASTER_KEY,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
      const {error}=await master.auth.resetPasswordForEmail(identifier,{redirectTo:RESET_REDIRECT});
      if(error)throw error;
      show('Shared password reset email sent. The new password is used for Inventory, Energy and Safety.');
    }catch(err){
      show(err?.message||'Could not send the shared password reset email.');
    }
  }

  // config.js is loaded before the Safety core, so these capture handlers
  // always win over the old Safety-specific login handlers.
  window.addEventListener('submit',handleSubmit,true);
  window.addEventListener('click',handleForgot,true);

  document.addEventListener('DOMContentLoaded',decorate,{once:true});
  window.addEventListener('pageshow',()=>setTimeout(decorate,40));
  [40,150,400,900,1800].forEach(ms=>setTimeout(decorate,ms));
})();

(function(){
  if(window.__SAFETY_HOTFIX_LOADER_V21113_CONFIGURED)return;
  window.__SAFETY_HOTFIX_LOADER_V21113_CONFIGURED=true;

  const scripts=[
      ['hotfix-v21113-runtime-stability.js','v21113-runtime-stability'],
      ['hotfix-v21125-modal-observer-governor.js','v21125-modal-observer-governor'],
      ['hotfix-v21151-master-login-original-site.js','v21151-master-login-original-site'],
      ['hotfix-v21149-access-click-fix.js','v21149-access-click-fix'],
      ['hotfix-v21150-help-ppe-setup.js','v21150-help-ppe-setup'],
      ['hotfix-v21155-groups.js','v21155-groups'],
      ['hotfix-v21157-instructor-permission.js','v21157-instructor-permission'],
      ['hotfix-v21158-hod-training-profile.js','v21158-hod-training-profile'],
      ['hotfix-v21055-training-packs.js','v21055-training-packs'],
      ['hotfix-v21056-review-audit.js','v21056-review-audit'],
      ['hotfix-v21057-linked-impact.js','v21057-linked-impact'],
      ['hotfix-v21058-app-created-ssw-revision.js','v21058-ssw-revision'],
      ['hotfix-v21059-app-created-tbt-revision.js','v21059-tbt-revision'],
      ['hotfix-v21060-refresher-method.js','v21060-refresher-method'],
      ['hotfix-v21061-retrain-now.js','v21061-retrain-now'],
      ['hotfix-v21062-revision-training-impact.js','v21062-revision-training-impact'],
      ['hotfix-v21063-pack-version-awareness.js','v21063-pack-version-awareness'],
      ['hotfix-v21064-source-training-guard.js','v21064-source-training-guard'],
      ['hotfix-v21065-strictest-method-wins.js','v21065-strictest-method-wins'],
      ['hotfix-v21066-temporary-unsuitable.js','v21066-temporary-unsuitable'],
      ['hotfix-v21067-change-control-workflow.js','v21067-change-control-workflow'],
      ['hotfix-v21068-regression-hardening.js','v21068-regression-hardening'],
      ['hotfix-v21069-positions-responsibilities.js','v21071-hs-officer-notice'],
      ['hotfix-v21072-calendar-label-dedupe.js','v21072-calendar-label-dedupe'],
      ['hotfix-v21073-register-downloads.js','v21073-register-downloads'],
      ['hotfix-v21074-register-pdf-pages.js','v21074-register-pdf-pages'],
      ['hotfix-v21075-document-creation-toggle.js','v21075-document-creation-toggle'],
      ['hotfix-v21076-help-document-links.js','v21076-help-document-links'],
      ['hotfix-v21077-creator-employees.js','v21077-creator-employees'],
      ['hotfix-v21078-ssw-ppe-tools.js','v21078-ssw-ppe-tools'],
      ['hotfix-v21086-asbestos-catalogue.js','v21086-asbestos-catalogue'],
      ['hotfix-v21080-asbestos.js','v21081-asbestos-parser'],
      ['hotfix-v21082-asbestos-modal.js','v21082-asbestos-modal'],
      ['hotfix-v21083-admin-sections.js','v21103-admin-sections-location-fix'],
      ['hotfix-v21084-tile-routes.js','v21084-tile-routes'],
      ['hotfix-v21085-admin-grouping.js','v21103-admin-grouping-location-fix'],
      ['hotfix-v21088-asbestos-full-analysis.js','v21088-asbestos-full-analysis'],
      ['hotfix-v21087-asbestos-source-tools.js','v21088-asbestos-source-tools'],
      ['hotfix-v21089-site-location-tile.js','v21089-site-location-tile'],
      ['hotfix-v21090-responsibility-location-tree.js','v21090-responsibility-location-tree'],
      ['hotfix-v21091-report-evidence-retention.js','v21091-report-evidence-retention'],
      ['hotfix-v21147-users-targeted-incident-review.js','v21147-users-targeted-incident-review'],
      ['hotfix-v21092-incident-review.js','v21092-incident-review'],
      ['hotfix-v21093-asbestos-location-cleanup.js','v21093-asbestos-location-cleanup'],
      ['hotfix-v21094-report-scope.js','v21094-report-scope'],
      ['hotfix-v21095-repair-bundle.js','v21095-repair-bundle'],
      ['hotfix-v21096-site-location-test-cleanup.js','v21096-site-location-test-cleanup'],
      ['hotfix-v21102-site-location-search.js','v21103-authoritative-search'],
      ['hotfix-v21105-asbestos-evidence-audit.js','v21105-asbestos-evidence-audit'],
      ['hotfix-v21106-asbestos-workflow.js','v21106-asbestos-workflow'],
      ['hotfix-v21107-asbestos-history-library.js','v21107-asbestos-history-library'],
      ['hotfix-v21108-asbestos-intelligence.js','v21108-asbestos-intelligence'],
      ['hotfix-v21110-user-access-save-repair.js','v21110-user-access-save-repair'],
      ['hotfix-v21111-management-stability.js','v21111-management-stability'],
      ['hotfix-v21114-contractor-multi-area.js','v21114-contractor-multi-area'],
      ['hotfix-v21115-auto-link-repair.js','v21115-auto-link-repair'],
      ['hotfix-v21116-bulk-metadata.js','v21116-bulk-metadata'],
      ['hotfix-v21118-training-history-excel.js','v21118-training-history-excel'],
      ['hotfix-v21119-generic-document-folders.js','v21119-generic-document-folders'],
      ['hotfix-v21119-department-leads.js','v21119-department-leads'],
      ['hotfix-v21120-approval-review-date.js','v21120-approval-review-date'],
      ['hotfix-v21121-generic-doc-controls.js','v21121-generic-doc-controls'],
      ['hotfix-v21122-approval-training-restore.js','v21122-approval-training-restore'],
      ['hotfix-v21124-freeze-guard.js','v21124-freeze-guard'],
      ['hotfix-v21125-admin-approval.js','v21125-admin-approval'],
      ['hotfix-v21126-scroll-isolation.js','v21126-scroll-isolation'],
      ['hotfix-v21128-generic-audience-layout.js','v21128-generic-audience-layout'],
      ['hotfix-v21130-people-filter-stability.js','v21130-people-filter-stability'],
      ['hotfix-v21131-approval-move-repair.js','v21131-approval-move-repair'],
      ['hotfix-v21132-assignment-audit.js','v21132-assignment-audit'],
      ['hotfix-v21134-simple-owner.js','v21134-simple-owner'],
      ['hotfix-v21135-first-aid-equipment.js','v21135-first-aid-equipment'],
      ['hotfix-v21136-first-aid-default-types.js','v21136-first-aid-default-types'],
  ];
  const loaded=new Set();
  let started=false;
  let waiter=0;

  function record(type,msg,extra){
    try{window.SafetyRuntimeStabilityV21113?.record?.(type,msg,extra)}catch(_e){}
  }

  function loadOne(src,token,attempt=0){
    return new Promise(resolve=>{
      if(loaded.has(src))return resolve(true);
      const existing=document.querySelector(`script[data-safety-loader-v21113="${src}"]`);
      if(existing?.dataset.loaded==='1'){loaded.add(src);return resolve(true)}
      const s=existing||document.createElement('script');
      if(!existing){
        const build=window.SAFETY_BUILD?.build_id||window.SAFETY_BUILD?.version||'v21158';
        s.src=`${src}?v=${encodeURIComponent(token+'-'+build)}`;
        s.async=false;
        s.dataset.safetyLoaderV21113=src;
        (document.body||document.head||document.documentElement).appendChild(s);
      }
      s.onload=()=>{s.dataset.loaded='1';loaded.add(src);resolve(true)};
      s.onerror=()=>{
        try{s.remove()}catch(_e){}
        if(attempt<1)setTimeout(()=>loadOne(src,token,attempt+1).then(resolve),500);
        else{record('hotfix-load-failed',src,'Loader continued after two attempts.');resolve(false)}
      };
    });
  }

  async function start(){
    if(started)return;
    const core=window.SafetyTrackerV2;
    if(!core||!core.navigationTidyV21044){
      clearTimeout(waiter);
      waiter=setTimeout(start,120);
      return;
    }
    started=true;
    window.__SAFETY_HOTFIX_LOADER_V21113_STARTED=true;
    for(const [src,token] of scripts)await loadOne(src,token);
    window.__SAFETY_HOTFIX_LOADER_V21113_COMPLETE=true;
    try{window.applySafetyBuildLabel?.()}catch(_e){}
  }

  setTimeout(start,0);
  window.addEventListener('pageshow',()=>{if(!started)setTimeout(start,0)},{once:true});
})();
