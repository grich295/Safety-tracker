/* Safety Tracker v2.10.84 - management/admin tile route hardening */
'use strict';
(function(){
  if(window.__TILE_ROUTES_V21084)return;
  window.__TILE_ROUTES_V21084=true;

  function boot(){
    var core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.navigationTidyV21044){
      setTimeout(boot,120);
      return;
    }
    install(core);
  }

  function install(core){
    var $=function(id){return document.getElementById(id);};
    var toast=function(msg){
      try{return core.toast(msg);}catch(_e){}
    };

    function show(view){
      try{
        if(typeof window.showView==='function'){
          window.showView(view);
          return true;
        }
        var b=document.querySelector('#mainNav button[data-view="'+view+'"]');
        if(b){b.click();return true;}
      }catch(e){
        console.error('Tile route',view,e);
      }
      toast('Could not open '+view+'.');
      return false;
    }

    function leaveManagementHome(){
      var r=$('reportsView');
      if(r)r.classList.remove('management-home-active-v21079');
    }

    function scrollToTarget(selector){
      var tries=0;
      function tick(){
        var el=document.querySelector(selector);
        if(el){
          try{el.scrollIntoView({behavior:'smooth',block:'start'});}catch(_e){}
          return;
        }
        if(++tries<20)setTimeout(tick,100);
      }
      setTimeout(tick,60);
    }

    function route(action,group,key){
      if(!action)return;

      /* Explicit view routes */
      if(action.indexOf('view:')===0){
        var view=action.split(':')[1];
        leaveManagementHome();
        show(view);
        return;
      }

      /* Documents routes can keep using the original helper except Bulk Upload,
         which needs to land in the compact Admin section. */
      if(action.indexOf('docs:')===0){
        if(action==='docs:bulk'){
          leaveManagementHome();
          show('admin');
          setTimeout(function(){
            if(window.SafetyAdminSectionsV21083&&typeof window.SafetyAdminSectionsV21083.open==='function'){
              window.SafetyAdminSectionsV21083.open('bulk');
            }else{
              scrollToTarget('#bulkImportFiles');
            }
          },100);
          return;
        }
        return originalGo(action,group,key);
      }

      /* Management landing tiles: every destination is explicit.
         No fallback to a shared "last section" or Knowledge route. */
      leaveManagementHome();

      if(action==='management:actions'){
        show('compliance');
        scrollToTarget('#unifiedSafetyActionsCardV21039');
        return;
      }
      if(action==='management:calendar'){
        show('reports');
        scrollToTarget('#safetyCalendarCardV21043');
        return;
      }
      if(action==='management:reports'){
        show('reports');
        scrollToTarget('#reportsView .page-heading');
        return;
      }
      if(action==='management:knowledge'){
        show('reports');
        scrollToTarget('#knowledgeHubV21051');
        return;
      }

      console.warn('Unknown tile route',action,group,key);
      toast('That menu section could not be opened.');
    }

    var originalGo=core.navigationTidyV21044.go;
    core.navigationTidyV21044.go=route;

    /* Also harden the visible landing tiles after any re-render by ensuring the
       data action matches the tile key. */
    var expected={
      actions:'management:actions',
      compliance:'view:compliance',
      people:'view:people',
      calendar:'management:calendar',
      reports:'management:reports',
      knowledge:'management:knowledge',
      admin:'view:admin'
    };

    function repairTileData(){
      document.querySelectorAll('[data-management-tile-key]').forEach(function(tile){
        var key=tile.dataset.managementTileKey;
        if(expected[key])tile.dataset.managementTileAction=expected[key];
      });
    }

    var observer=new MutationObserver(function(){setTimeout(repairTileData,0);});
    observer.observe(document.body,{childList:true,subtree:true});

    [0,150,500,1200,2500].forEach(function(ms){
      setTimeout(repairTileData,ms);
    });
    window.addEventListener('pageshow',function(){setTimeout(repairTileData,100);});

    window.SafetyTileRoutesV21084={
      route:route,
      repair:repairTileData
    };
  }

  boot();
})();
