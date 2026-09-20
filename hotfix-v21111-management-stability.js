/* Safety Tracker v2.11.11 - stable Management landing, no forced scroll / no DOM observer loop */
'use strict';
(function(){
  if(window.__SAFETY_MANAGEMENT_STABLE_V21111)return;
  window.__SAFETY_MANAGEMENT_STABLE_V21111=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.navigationTidyV21044){setTimeout(boot,120);return}
    install(core);
  }

  function install(core){
    const st=core.state,$=id=>document.getElementById(id);
    let detail=false;

    const role=()=>String(st.profile?.role||'').toLowerCase();
    const reportViewer=()=>st.profile?.report_only===true;
    const manager=()=>!reportViewer()&&['admin','manager'].includes(role())&&!(role()==='admin'&&(st.offline||st.uiMode==='user'));
    const admin=()=>manager()&&role()==='admin';

    function tiles(){
      return[
        {key:'actions',icon:'!',title:'Safety Actions',desc:'Overdue and due actions in one place.',action:'management:actions'},
        {key:'compliance',icon:'✓',title:'Compliance',desc:'Team training and safety status.',action:'view:compliance'},
        {key:'people',icon:'👥',title:'People & Positions',desc:'Users, positions and assignments.',action:'view:people'},
        {key:'calendar',icon:'▣',title:'Calendar',desc:'Reviews, training, checks and PTW dates.',action:'management:calendar'},
        {key:'reports',icon:'▤',title:'Reports & Evidence',desc:'Evidence packs, reports, exports and archive.',action:'management:reports'},
        {key:'knowledge',icon:'?',title:'Knowledge Checks',desc:'Monthly questions and knowledge review.',action:'management:knowledge'},
        {key:'admin',icon:'⚙',title:'Admin & Setup',desc:'Departments, responsibilities, viewers and system controls.',action:'view:admin',adminOnly:true}
      ].filter(x=>!x.adminOnly||admin());
    }

    function actionCount(){
      try{
        const rows=core.unifiedSafetyActionsV21039?.actions||[];
        return rows.filter(x=>['RED','AMBER'].includes(String(x.priority||'').toUpperCase())).length;
      }catch(_e){return 0}
    }

    function render(){
      const view=$('reportsView');if(!view||!manager())return;
      let home=$('managementHomeV21111');
      if(!home){
        home=document.createElement('section');
        home.id='managementHomeV21111';
        home.className='management-home-v21111';
        view.insertAdjacentElement('afterbegin',home);
      }
      const sig=`${admin()?'A':'M'}:${actionCount()}`;
      if(home.dataset.sig===sig&&home.childElementCount)return;
      home.dataset.sig=sig;
      home.innerHTML=`<div class="management-home-head-v21111"><h2>Management</h2><p>Choose a section. Detailed information stays inside that section instead of filling one long management page.</p></div>
        <div class="management-tile-grid-v21111">${tiles().map(t=>`<button type="button" class="management-tile-v21111" data-management-stable-action="${t.action}" data-management-stable-key="${t.key}">
          <span class="management-tile-icon-v21111" aria-hidden="true">${t.icon}</span>
          ${t.key==='actions'?`<span class="management-tile-count-v21111">${actionCount()}</span>`:''}
          <strong>${t.title}</strong><span>${t.desc}</span>
        </button>`).join('')}</div>`;
    }

    function home(){
      if(!manager())return;
      render();
      detail=false;
      $('reportsView')?.classList.add('management-home-active-v21111');
      // Intentionally do not scroll. Keep the user's current position stable.
    }

    function leaveHome(){
      detail=true;
      $('reportsView')?.classList.remove('management-home-active-v21111');
    }

    function showReportsViewWithoutFlash(){
      render();
      home();
      const view=$('reportsView');if(!view)return;
      // Make the Management tile state visible before the base nav handler runs.
      view.classList.add('management-home-active-v21111');
    }

    function go(action,key){
      leaveHome();
      try{core.navigationTidyV21044.go(action,'management',key)}
      catch(e){
        console.warn('Management navigation',e);
        if(action.startsWith('view:')){
          const name=action.split(':')[1];
          document.querySelector(`#mainNav button[data-view="${name}"]`)?.click();
        }
      }
    }

    function ensureBack(){
      if(!manager())return;
      ['reports','compliance','people','admin'].forEach(name=>{
        if(name==='admin'&&!admin())return;
        const view=$(name+'View');if(!view)return;
        let b=view.querySelector('.management-back-v21111');
        if(b)return;
        b=document.createElement('button');b.type='button';b.className='secondary management-back-v21111';
        b.dataset.managementStableHome='1';b.textContent='← Management';
        const h=view.querySelector('.page-heading');
        if(h)h.insertAdjacentElement('afterend',b);else view.insertAdjacentElement('afterbegin',b);
      });
    }

    // Prepare the new landing once. No MutationObserver and no recurring render loop.
    render();ensureBack();

    window.addEventListener('click',e=>{
      const top=e.target.closest?.('#mainNav button[data-view="reports"]');
      if(top&&manager()&&!reportViewer()){
        showReportsViewWithoutFlash();
        // Do not stop the normal nav event; it still owns history/back behaviour.
        return;
      }

      const tile=e.target.closest?.('[data-management-stable-action]');
      if(tile){
        e.preventDefault();e.stopImmediatePropagation();
        go(tile.dataset.managementStableAction,tile.dataset.managementStableKey);
        return;
      }

      const back=e.target.closest?.('[data-management-stable-home],.management-back-v21079,[data-repair95-management-back]');
      if(back&&manager()){
        e.preventDefault();e.stopImmediatePropagation();
        document.querySelector('#mainNav button[data-view="reports"]')?.click();
        requestAnimationFrame(home);
        return;
      }
    },true);

    // If Management becomes active through browser navigation, show the landing once.
    window.addEventListener('popstate',()=>{
      setTimeout(()=>{
        const view=$('reportsView');
        if(view?.classList.contains('active-view')&&!detail)home();
      },0);
    });

    window.addEventListener('pageshow',()=>{setTimeout(()=>{render();ensureBack()},100)});

    const style=document.createElement('style');
    style.id='managementStableStylesV21111';
    style.textContent=`
      .nav-hub-v21044[data-nav-hub="management"]{display:none!important}
      .management-home-v21111{display:none}
      #reportsView.management-home-active-v21111>.management-home-v21111{display:block!important}
      #reportsView.management-home-active-v21111>.page-heading,
      #reportsView.management-home-active-v21111>.management-back-v21079,
      #reportsView.management-home-active-v21111>.management-back-v21111,
      #reportsView.management-home-active-v21111>.stats-grid,
      #reportsView.management-home-active-v21111>.section-card,
      #reportsView.management-home-active-v21111>.button-grid,
      #reportsView.management-home-active-v21111>.report-manager-content,
      #reportsView.management-home-active-v21111>#reportArchiveList{display:none!important}

      .management-home-head-v21111{margin:4px 0 18px}
      .management-home-head-v21111 h2{margin:0 0 6px;font-size:2rem}
      .management-home-head-v21111 p{margin:0;color:var(--muted,#94a3b8);font-size:1rem;line-height:1.45}
      .management-tile-grid-v21111{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:24px}
      .management-tile-v21111{position:relative;min-height:170px;border:1px solid var(--border,#475569);border-radius:18px;background:var(--card,#1f1f1f);color:inherit;padding:20px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end;gap:7px;cursor:pointer}
      .management-tile-v21111 strong{font-size:1.25rem;line-height:1.15}
      .management-tile-v21111>span:last-child{color:var(--muted,#a6b1c2);line-height:1.35}
      .management-tile-icon-v21111{position:absolute;top:17px;left:19px;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#243b53;color:#fff;font-size:1.55rem;font-weight:900}
      .management-tile-count-v21111{position:absolute;top:17px;right:18px;min-width:38px;height:38px;padding:0 9px;border-radius:999px;display:grid;place-items:center;background:#5a3710;color:#ffd28a;font-weight:900}
      .management-back-v21111{margin:0 0 14px}
      @media(max-width:620px){.management-tile-grid-v21111{grid-template-columns:1fr;gap:12px}.management-tile-v21111{min-height:145px;padding:18px}.management-tile-icon-v21111{width:44px;height:44px}}
    `;
    document.head.appendChild(style);

    // Compatibility for older repair code that calls the old object name.
    window.SafetyManagementTilesV21079={open:()=>{
      const b=document.querySelector('#mainNav button[data-view="reports"]');
      if(b)b.click();else home();
    },render};
    window.SafetyManagementStableV21111={open:home,render};
  }
  boot();
})();
