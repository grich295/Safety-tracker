/* Safety Tracker v2.11.4 - Management always returns to tile home */
'use strict';
(function(){
  if(window.__SAFETY_MANAGEMENT_HOME_RESET_V2114)return;
  window.__SAFETY_MANAGEMENT_HOME_RESET_V2114=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const view=document.getElementById('reportsView');
    if(!core||!core.state||!view){setTimeout(boot,120);return;}
    install(core,view);
  }

  function install(core,view){
    let explicitDetail=false;
    let timer=0;

    function allowed(){
      const p=core.state?.profile;
      if(!p||p.report_only===true)return false;
      const r=String(p.role||'').toLowerCase();
      return r==='admin'||r==='manager';
    }

    function showHome(){
      if(!allowed())return;
      explicitDetail=false;
      try{
        if(window.SafetyManagementTilesV21079?.open){
          window.SafetyManagementTilesV21079.open();
          return;
        }
      }catch(_e){}
      try{window.showView?.('reports')}catch(_e){}
      view.classList.add('management-home-active-v21079');
    }

    function scheduleHome(){
      clearTimeout(timer);
      [0,40,120,300].forEach(ms=>setTimeout(()=>{if(!explicitDetail)showHome();},ms));
    }

    function detail(){
      explicitDetail=true;
      view.classList.remove('management-home-active-v21079');
    }

    /* Run before older document click handlers. */
    window.addEventListener('click',e=>{
      const top=e.target.closest?.('#mainNav button[data-view="reports"]');
      if(top&&allowed()){
        explicitDetail=false;
        setTimeout(scheduleHome,0);
        return;
      }

      const back=e.target.closest?.('[data-management-home-v21079],.management-back-v21079,[data-repair95-management-back]');
      if(back&&allowed()){
        explicitDetail=false;
        setTimeout(scheduleHome,0);
        return;
      }

      const tile=e.target.closest?.('[data-management-tile-action]');
      if(tile){
        const action=String(tile.dataset.managementTileAction||'');
        if(['management:reports','management:calendar','management:knowledge'].includes(action))detail();
        else explicitDetail=false;
      }
    },true);

    window.addEventListener('popstate',()=>{
      explicitDetail=false;
      setTimeout(()=>{if(view.classList.contains('active-view'))scheduleHome();},30);
    });

    let was=view.classList.contains('active-view');
    new MutationObserver(()=>{
      const now=view.classList.contains('active-view');
      if(now&&!was&&!explicitDetail)scheduleHome();
      if(!now&&was)explicitDetail=false;
      was=now;
    }).observe(view,{attributes:true,attributeFilter:['class']});

    window.SafetyManagementHomeResetV2114={home:showHome,detail};
  }

  boot();
})();
