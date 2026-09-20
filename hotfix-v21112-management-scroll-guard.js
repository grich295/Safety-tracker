/* Safety Tracker v2.11.12 - Management scroll guard / reports-render isolation */
'use strict';
(function(){
  if(window.__SAFETY_MANAGEMENT_SCROLL_GUARD_V21112)return;
  window.__SAFETY_MANAGEMENT_SCROLL_GUARD_V21112=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const view=document.getElementById('reportsView');
    const nav=document.getElementById('mainNav');
    if(!core||!core.state||!view||!nav||!window.SafetyManagementStableV21111){
      setTimeout(boot,120);return;
    }
    install(core,view,nav);
  }

  function install(core,view,nav){
    const st=core.state;
    const origScrollTo=window.scrollTo.bind(window);
    const origScroll=typeof window.scroll==='function'?window.scroll.bind(window):origScrollTo;
    const origScrollIntoView=Element.prototype.scrollIntoView;

    let manualUntil=0;
    let lastGoodY=window.scrollY||0;
    let restoring=false;
    let bypass=false;

    function manager(){
      const p=st.profile;
      if(!p||p.report_only===true)return false;
      const r=String(p.role||'').toLowerCase();
      return ['admin','manager'].includes(r)&&!(r==='admin'&&(st.offline||st.uiMode==='user'));
    }
    function homeActive(){
      return manager() &&
        view.classList.contains('active-view') &&
        view.classList.contains('management-home-active-v21111');
    }
    function markManual(ms=900){
      manualUntil=performance.now()+ms;
    }
    function manual(){
      return performance.now()<manualUntil;
    }
    function topFromArgs(args){
      if(!args?.length)return null;
      if(typeof args[0]==='object'&&args[0]!==null){
        const n=Number(args[0].top);
        return Number.isFinite(n)?n:null;
      }
      if(args.length>1){
        const n=Number(args[1]);
        return Number.isFinite(n)?n:null;
      }
      return null;
    }
    function setMode(on){
      document.documentElement.classList.toggle('management-scroll-guard-v21112',on);
      document.body.classList.toggle('management-scroll-guard-v21112',on);
      if(on){
        const a=document.activeElement;
        if(a&&a!==document.body&&typeof a.blur==='function'){
          try{a.blur()}catch(_e){}
        }
        lastGoodY=window.scrollY||0;
      }
    }
    function syncMode(){
      setMode(homeActive());
    }

    /* The Management tab is a landing page, not the Reports screen.
       Stop the base Reports click from rendering the full old reports page underneath
       the landing. This also avoids a large background DOM update on every entry. */
    window.addEventListener('click',function(e){
      const top=e.target.closest?.('#mainNav button[data-view="reports"]');
      if(!top||!manager())return;

      e.preventDefault();
      e.stopImmediatePropagation();

      try{window.SafetyManagementStableV21111.render?.()}catch(_e){}
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
      view.classList.add('active-view','management-home-active-v21111');
      nav.querySelectorAll('button[data-view]').forEach(b=>b.classList.toggle('active',b===top));

      try{
        const hs=history.state||{};
        if(!(hs.safetyTracker&&hs.view==='reports'&&hs.managementLandingV21112)){
          history.pushState(
            {safetyTracker:true,view:'reports',modal:false,guard:false,managementLandingV21112:true},
            '',location.href
          );
        }
      }catch(_e){}

      requestAnimationFrame(()=>{
        try{top.blur()}catch(_e){}
        lastGoodY=window.scrollY||0;
        syncMode();
      });
    },true);

    /* Do not allow old navigation/report helpers to pull the Management landing
       back to the top. Detail screens are untouched because the guard is active
       only while the tile landing itself is visible. */
    window.scrollTo=function(){
      const args=[...arguments];
      if(homeActive()&&!bypass&&!manual()){
        const y=topFromArgs(args);
        if(y!==null && y<(window.scrollY||0)-4)return;
      }
      return origScrollTo(...args);
    };
    window.scroll=function(){
      const args=[...arguments];
      if(homeActive()&&!bypass&&!manual()){
        const y=topFromArgs(args);
        if(y!==null && y<(window.scrollY||0)-4)return;
      }
      return origScroll(...args);
    };
    Element.prototype.scrollIntoView=function(){
      if(homeActive()&&!bypass&&!manual()){
        return;
      }
      return origScrollIntoView.apply(this,arguments);
    };

    /* Samsung/Android can also move the document after a background layout
       reflow without calling scrollTo/scrollIntoView. If the move was not caused
       by a finger/wheel/key scroll, restore the last user position. */
    window.addEventListener('scroll',()=>{
      const y=window.scrollY||0;
      if(!homeActive()){
        lastGoodY=y;
        return;
      }
      if(restoring)return;
      if(manual()){
        lastGoodY=y;
        return;
      }
      if(y<lastGoodY-14){
        const restoreY=lastGoodY;
        restoring=true;
        requestAnimationFrame(()=>{
          try{
            bypass=true;
            origScrollTo({top:restoreY,left:0,behavior:'auto'});
          }catch(_e){}
          finally{
            bypass=false;
            restoring=false;
          }
        });
        return;
      }
      lastGoodY=y;
    },{passive:true});

    ['touchmove','wheel'].forEach(type=>{
      window.addEventListener(type,()=>markManual(1200),{passive:true,capture:true});
    });
    window.addEventListener('keydown',e=>{
      if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Spacebar'].includes(e.key))markManual(1200);
    },true);

    /* Attribute-only observer: it watches one class value and does not inspect or
       rewrite the Management/Reports DOM. It simply enables/disables the guard. */
    new MutationObserver(syncMode).observe(view,{attributes:true,attributeFilter:['class']});

    window.addEventListener('popstate',()=>{
      setTimeout(()=>{
        if(history.state?.managementLandingV21112&&manager()){
          try{window.SafetyManagementStableV21111.render?.()}catch(_e){}
          document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
          view.classList.add('active-view','management-home-active-v21111');
          nav.querySelectorAll('button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='reports'));
        }
        syncMode();
      },0);
    });

    const style=document.createElement('style');
    style.id='managementScrollGuardStylesV21112';
    style.textContent=`
      html.management-scroll-guard-v21112,
      body.management-scroll-guard-v21112{
        scroll-behavior:auto!important;
        overflow-anchor:none!important
      }
      body.management-scroll-guard-v21112 #reportsView,
      body.management-scroll-guard-v21112 #managementHomeV21111{
        overflow-anchor:none!important;
        scroll-behavior:auto!important
      }
    `;
    document.head.appendChild(style);

    syncMode();
    window.SafetyManagementScrollGuardV21112={sync:syncMode,isActive:homeActive};
  }
  boot();
})();
