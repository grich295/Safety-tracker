/* Safety Tracker v2.10.79 - Management landing tiles */
'use strict';
(function(){
  if(window.__SAFETY_V21079_MANAGEMENT_TILES)return;
  window.__SAFETY_V21079_MANAGEMENT_TILES=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core?.state || !core.navigationTidyV21044){setTimeout(boot,120);return;}
    install(core);
  }

  function install(core){
    const state=core.state;
    const $=id=>document.getElementById(id);
    const role=()=>String(state.profile?.role||'').toLowerCase();
    const isReportViewer=()=>state.profile?.report_only===true;
    const isManager=()=>!isReportViewer()&&['admin','manager'].includes(role())&&!(role()==='admin'&&(state.offline||state.uiMode==='user'));
    const isAdmin=()=>isManager()&&role()==='admin';

    function tiles(){
      return [
        {key:'actions',icon:'!',title:'Safety Actions',desc:'Overdue and due actions in one place.',action:'management:actions'},
        {key:'compliance',icon:'✓',title:'Compliance',desc:'Team training and safety status.',action:'view:compliance'},
        {key:'people',icon:'👥',title:'People & Positions',desc:'Users, positions and assignments.',action:'view:people'},
        {key:'calendar',icon:'▣',title:'Calendar',desc:'Reviews, training, checks and PTW dates.',action:'management:calendar'},
        {key:'reports',icon:'▤',title:'Reports & Evidence',desc:'Evidence packs, reports, exports and archive.',action:'management:reports'},
        {key:'knowledge',icon:'?',title:'Knowledge Checks',desc:'Monthly questions and knowledge review.',action:'management:knowledge'},
        {key:'admin',icon:'⚙',title:'Admin & Setup',desc:'Departments, responsibilities, viewers and system controls.',action:'view:admin',adminOnly:true}
      ].filter(x=>!x.adminOnly||isAdmin());
    }

    function actionCount(){
      try{
        const rows=core.unifiedSafetyActionsV21039?.actions||[];
        return rows.filter(x=>['RED','AMBER'].includes(String(x.priority||'').toUpperCase())).length;
      }catch(_e){return 0}
    }

    function renderHome(){
      const view=$('reportsView');
      if(!view||!isManager())return;
      let home=$('managementHomeV21079');
      if(!home){
        home=document.createElement('section');
        home.id='managementHomeV21079';
        home.className='management-home-v21079';
        view.insertAdjacentElement('afterbegin',home);
      }

      home.innerHTML=`
        <div class="management-home-head-v21079">
          <h2>Management</h2>
          <p>Choose a section. Detailed information stays inside that section instead of filling one long management page.</p>
        </div>
        <div class="management-tile-grid-v21079">
          ${tiles().map(t=>{
            const count=t.key==='actions'?`<span class="management-tile-count-v21079">${actionCount()}</span>`:'';
            return `<button type="button" class="management-tile-v21079" data-management-tile-action="${t.action}" data-management-tile-key="${t.key}">
              <span class="management-tile-icon-v21079" aria-hidden="true">${t.icon}</span>
              ${count}
              <strong>${t.title}</strong>
              <span>${t.desc}</span>
            </button>`;
          }).join('')}
        </div>`;
    }

    function activateHome(){
      if(!isManager())return;
      const view=$('reportsView');
      if(!view)return;
      renderHome();
      view.classList.add('management-home-active-v21079');
      try{window.scrollTo({top:0,behavior:'smooth'})}catch(_e){}
    }

    function deactivateHome(){
      $('reportsView')?.classList.remove('management-home-active-v21079');
    }

    function showViewSafe(name){
      try{
        if(typeof window.showView==='function')window.showView(name);
        else document.querySelector(`#mainNav button[data-view="${name}"]`)?.click();
      }catch(_e){}
    }

    function go(action,key){
      deactivateHome();
      try{
        core.navigationTidyV21044.go(action,'management',key);
      }catch(e){
        if(action.startsWith('view:'))showViewSafe(action.split(':')[1]);
        else console.warn('Management tile navigation',e);
      }
    }

    function ensureBackButtons(){
      if(!isManager())return;
      ['reports','compliance','people','admin'].forEach(name=>{
        if(name==='admin'&&!isAdmin())return;
        const view=$(name+'View');
        if(!view||view.querySelector('.management-back-v21079'))return;
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='secondary management-back-v21079';
        btn.dataset.managementHomeV21079='1';
        btn.textContent='← Management';
        const heading=view.querySelector('.page-heading');
        if(heading)heading.insertAdjacentElement('afterend',btn);
        else view.insertAdjacentElement('afterbegin',btn);
      });
    }

    function tidyManagementHubs(){
      document.querySelectorAll('.nav-hub-v21044[data-nav-hub="management"]').forEach(h=>h.hidden=true);
    }

    function maintain(){
      ensureBackButtons();
      tidyManagementHubs();
      if($('reportsView')?.classList.contains('management-home-active-v21079'))renderHome();
    }

    document.addEventListener('click',e=>{
      // Top-level Management tab: show the clean tile landing page.
      const top=e.target.closest?.('#mainNav button[data-view="reports"]');
      if(top&&isManager()&&!isReportViewer()){
        e.preventDefault();
        e.stopImmediatePropagation();
        showViewSafe('reports');
        setTimeout(activateHome,50);
        return;
      }

      const tile=e.target.closest?.('[data-management-tile-action]');
      if(tile){
        e.preventDefault();
        e.stopImmediatePropagation();
        go(tile.dataset.managementTileAction,tile.dataset.managementTileKey);
        return;
      }

      if(e.target.closest?.('[data-management-home-v21079]')){
        e.preventDefault();
        e.stopImmediatePropagation();
        showViewSafe('reports');
        setTimeout(activateHome,50);
      }
    },true);

    // If another route opens one of the detailed Management screens,
    // make sure it displays as a detail page rather than the tile landing page.
    const observer=new MutationObserver(()=>setTimeout(maintain,0));
    const main=document.querySelector('main')||document.body;
    observer.observe(main,{childList:true,subtree:true});

    const style=document.createElement('style');
    style.id='managementTilesStylesV21079';
    style.textContent=`
      .nav-hub-v21044[data-nav-hub="management"]{display:none!important}

      .management-home-v21079{display:none}
      #reportsView.management-home-active-v21079>.management-home-v21079{display:block}
      #reportsView.management-home-active-v21079>.page-heading,
      #reportsView.management-home-active-v21079>.management-back-v21079,
      #reportsView.management-home-active-v21079>.stats-grid,
      #reportsView.management-home-active-v21079>.section-card,
      #reportsView.management-home-active-v21079>.button-grid,
      #reportsView.management-home-active-v21079>.report-manager-content,
      #reportsView.management-home-active-v21079>#reportArchiveList{
        display:none!important
      }

      .management-home-head-v21079{margin:4px 0 18px}
      .management-home-head-v21079 h2{margin:0 0 6px;font-size:2rem}
      .management-home-head-v21079 p{margin:0;color:var(--muted,#94a3b8);font-size:1rem;line-height:1.45}

      .management-tile-grid-v21079{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
        margin-bottom:24px
      }
      .management-tile-v21079{
        position:relative;
        min-height:170px;
        border:1px solid var(--border,#475569);
        border-radius:18px;
        background:var(--card,#1f1f1f);
        color:inherit;
        padding:20px;
        text-align:left;
        display:flex;
        flex-direction:column;
        justify-content:flex-end;
        gap:7px;
        cursor:pointer
      }
      .management-tile-v21079:hover,
      .management-tile-v21079:focus-visible{
        border-color:#7aa7d2;
        box-shadow:0 0 0 2px rgba(74,124,170,.18)
      }
      .management-tile-icon-v21079{
        position:absolute;
        top:17px;
        left:19px;
        width:48px;
        height:48px;
        border-radius:14px;
        display:grid;
        place-items:center;
        background:#243b53;
        color:#fff;
        font-size:1.55rem;
        font-weight:900
      }
      .management-tile-count-v21079{
        position:absolute;
        top:17px;
        right:18px;
        min-width:38px;
        height:38px;
        padding:0 9px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:#5a3710;
        color:#ffd28a;
        font-weight:900
      }
      .management-tile-v21079 strong{font-size:1.25rem;line-height:1.15}
      .management-tile-v21079>span:last-child{color:var(--muted,#a6b1c2);line-height:1.35}
      .management-back-v21079{margin:0 0 14px}

      @media(max-width:620px){
        .management-tile-grid-v21079{grid-template-columns:1fr;gap:12px}
        .management-tile-v21079{min-height:145px;padding:18px}
        .management-tile-icon-v21079{width:44px;height:44px}
      }
    `;
    document.head.appendChild(style);

    [0,250,800,1800].forEach(ms=>setTimeout(maintain,ms));
    window.addEventListener('pageshow',()=>setTimeout(maintain,120));

    window.SafetyManagementTilesV21079={
      open:()=>{showViewSafe('reports');setTimeout(activateHome,50)},
      render:renderHome
    };
  }

  boot();
})();
