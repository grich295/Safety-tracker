/* Safety Tracker v2.11.43 CLEAN
   1) Global mobile flicker stabiliser for legacy hotfix observers.
   2) Shared Inventory/Energy People directory shown inside Safety > People.
   Database + edge sync backend already applied.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21143)return;
  window.__SAFETY_V21143=true;

  /* -------------------------------------------------------------
     A. Stop legacy whole-app observer feedback loops.
     ------------------------------------------------------------- */
  (function installObserverBoundary(){
    if(window.__SAFETY_V21143_OBSERVER_BOUNDARY)return;
    window.__SAFETY_V21143_OBSERVER_BOUNDARY=true;

    const ParentObserver=window.MutationObserver;
    if(typeof ParentObserver!=='function')return;

    class ScopedObserverV21143 {
      constructor(callback){
        this._inner=new ParentObserver(callback);
      }
      observe(target,options){
        const broad =
          options?.childList===true &&
          options?.subtree===true &&
          (
            target===document.body ||
            target?.id==='appView'
          );

        // The app accumulated several legacy decorators watching the whole BODY
        // or entire #appView and then changing the same DOM they were watching.
        // They all also have finite startup/page/click refreshes, so suppressing
        // the broad observer removes the mobile repaint loop without removing
        // the feature itself.
        if(broad){
          window.__SAFETY_V21143_BLOCKED_OBSERVERS=
            Number(window.__SAFETY_V21143_BLOCKED_OBSERVERS||0)+1;
          return;
        }
        return this._inner.observe(target,options);
      }
      disconnect(){return this._inner.disconnect()}
      takeRecords(){return this._inner.takeRecords()}
    }

    window.MutationObserver=ScopedObserverV21143;
  })();

  /* -------------------------------------------------------------
     B. Shared People directory.
     ------------------------------------------------------------- */
  let api,state,sb,sharedUsers=[],syncing=false;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().toLowerCase();
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true &&
    state?.uiMode!=='user';
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true &&
    state?.uiMode!=='user';

  function toast(msg){
    try{api?.toast?.(msg)}catch(_e){console.log(msg)}
  }

  function safetyMatch(u){
    const people=state?.people||[];
    const email=norm(u.email), username=norm(u.login_username);
    return people.find(p=>{
      if(email && norm(p.email)===email)return true;
      if(username && norm(p.login_username)===username)return true;
      return false;
    })||null;
  }

  function roleBadge(app,enabled,role){
    if(!enabled)return `<span class="badge neutral">${esc(app)} OFF</span>`;
    return `<span class="badge complete">${esc(app)}: ${esc(role||'user')}</span>`;
  }

  function safetyBadge(u){
    const p=safetyMatch(u);
    if(!p)return '<span class="badge due">Safety OFF</span>';
    if(p.active===false)return '<span class="badge neutral">Safety disabled</span>';
    return `<span class="badge complete">Safety: ${esc(p.report_only?'viewer':p.role||'user')}</span>`;
  }

  function filteredSharedUsers(){
    const status=$('peopleStatusV21091')?.value||'ACTIVE';
    if(status==='DISABLED')return sharedUsers.filter(u=>u.active===false);
    if(status==='RECOMMEND')return [];
    if(status==='ALL')return sharedUsers;
    return sharedUsers.filter(u=>u.active!==false);
  }

  function renderSharedDirectory(){
    const view=$('peopleView');
    const list=$('peopleList');
    if(!view||!list||!isManager())return;

    let box=$('sharedAppDirectoryV21143');
    if(!box){
      box=document.createElement('section');
      box.id='sharedAppDirectoryV21143';
      box.className='section-card shared-directory-v21143';

      const filters=$('peopleFiltersV21091');
      if(filters)filters.insertAdjacentElement('afterend',box);
      else list.insertAdjacentElement('beforebegin',box);
    }

    const rows=filteredSharedUsers();
    const safetyCount=sharedUsers.filter(u=>!!safetyMatch(u)).length;
    const activeCount=sharedUsers.filter(u=>u.active!==false).length;

    box.innerHTML=`
      <div class="row-between shared-directory-head-v21143">
        <div>
          <h3>All app users</h3>
          <p class="muted">Shared Inventory/Energy user directory. Users appear here even when Safety access is OFF.</p>
        </div>
        ${isAdmin()?'<button class="secondary" type="button" data-v21143-sync-users>Sync users</button>':''}
      </div>
      <div class="meta shared-directory-summary-v21143">
        <span>${activeCount} active shared user${activeCount===1?'':'s'}</span>
        <span>${safetyCount} already linked to a Safety account</span>
      </div>
      <div class="card-list">
        ${rows.map(u=>`
          <div class="item-card compact shared-user-card-v21143">
            <div class="row-between">
              <div>
                <strong>${esc(u.display_name||u.login_username||u.email||'User')}</strong>
                <div class="meta">
                  ${u.login_username?`<span>Username: ${esc(u.login_username)}</span>`:''}
                  ${u.email?`<span>${esc(u.email)}</span>`:''}
                </div>
                <div class="meta shared-app-badges-v21143">
                  ${roleBadge('Inventory',u.inventory_enabled,u.inventory_role)}
                  ${roleBadge('Energy',u.energy_enabled,u.energy_role)}
                  ${safetyBadge(u)}
                </div>
              </div>
            </div>
          </div>`).join('') || '<div class="empty">No users match this People filter.</div>'}
      </div>
      <div class="hint-box">
        <strong>App access is separate.</strong> Showing an Inventory/Energy user here does not automatically give them Safety access.
        Safety accounts remain controlled independently until authentication is consolidated across the apps.
      </div>`;
  }

  async function loadShared(){
    if(!isManager())return;
    const {data,error}=await sb.from('shared_app_users_v21143').select('*').order('display_name');
    if(error){
      console.warn('Shared app directory',error);
      return;
    }
    sharedUsers=data||[];
    renderSharedDirectory();
  }

  async function syncShared(button=null){
    if(!isAdmin()||syncing)return;
    syncing=true;
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Syncing…'}
    try{
      const {data,error}=await sb.functions.invoke('sync-shared-user-directory-v21143',{body:{action:'sync'}});
      if(error)throw error;
      await loadShared();
      toast(`${Number(data?.users||sharedUsers.length)} shared app users synced.`);
    }catch(e){
      toast(e?.message||'Could not sync shared app users.');
      console.warn('Shared user sync',e);
    }finally{
      syncing=false;
      if(button){button.disabled=false;button.textContent=old||'Sync users'}
    }
  }

  function installPeopleHooks(){
    document.addEventListener('click',e=>{
      const sync=e.target.closest?.('[data-v21143-sync-users]');
      if(sync){
        e.preventDefault();
        e.stopImmediatePropagation();
        syncShared(sync);
        return;
      }
      if(e.target.closest?.(
        '#mainNav [data-view="people"],'+
        '[data-management-stable-action="view:people"]'
      )){
        setTimeout(loadShared,120);
        setTimeout(renderSharedDirectory,360);
      }
    },true);

    document.addEventListener('change',e=>{
      if(e.target?.id==='peopleStatusV21091')setTimeout(renderSharedDirectory,0);
    },false);

    window.addEventListener('pageshow',()=>setTimeout(loadShared,200));
  }

  function installStyles(){
    if($('safetyV21143Styles'))return;
    const s=document.createElement('style');
    s.id='safetyV21143Styles';
    s.textContent=`
      .shared-directory-v21143{margin:12px 0}
      .shared-directory-head-v21143{gap:10px;align-items:flex-start}
      .shared-directory-summary-v21143{margin:8px 0 12px}
      .shared-app-badges-v21143{margin-top:7px;gap:6px;display:flex;flex-wrap:wrap}
      .shared-user-card-v21143{overflow:hidden}
      @media(max-width:700px){
        .shared-directory-head-v21143{display:block}
        .shared-directory-head-v21143 button{width:100%;margin-top:9px}
      }
    `;
    document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){
      setTimeout(boot,100);
      return;
    }
    state=api.state;
    sb=api.sb;
    if(!state.user)return;

    installStyles();
    installPeopleHooks();

    // Admin opening the app refreshes the shared directory once. Managers read
    // the last successful sync without being given cross-app admin permissions.
    if(isAdmin())await syncShared();
    else await loadShared();

    try{
      window.SafetyRuntimeStabilityV21113?.record?.(
        'v21143-stability',
        `Blocked ${Number(window.__SAFETY_V21143_BLOCKED_OBSERVERS||0)} legacy whole-app DOM observers.`,
        'Shared app People directory enabled.'
      );
    }catch(_e){}

    window.SafetySharedPeopleV21143={
      reload:loadShared,
      sync:syncShared
    };
  }

  boot().catch(e=>console.warn('Safety v2.11.43',e));
})();
