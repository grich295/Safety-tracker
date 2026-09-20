/* Safety Tracker v2.10.96 - Site Locations detail + TEST-created location cleanup verification */
'use strict';
(function(){
  if(window.__SAFETY_SITE_LOCATION_TEST_CLEANUP_V21096)return;
  window.__SAFETY_SITE_LOCATION_TEST_CLEANUP_V21096=true;

  function boot(){
    const core=window.SafetyTrackerV2,api=window.SafetyAdminSectionsV21083;
    if(!core||!core.state||!core.sb||!api||!document.getElementById('adminView')){
      setTimeout(boot,120);return;
    }
    install(core,api);
  }

  function install(core,api){
    const st=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    let locationMode=false,refreshBusy=false,enforceTimer=0;
    let beforeDeleteLocationCount=null;

    function siteLocationCard(){
      const view=$('adminView');if(!view)return null;
      return Array.from(view.children).find(el=>{
        if(!el.classList?.contains('section-card'))return false;
        const h=el.querySelector('h3');
        return String(h?.textContent||'').trim().toLowerCase()==='site locations';
      })||null;
    }

    function enforceLocationDetail(){
      if(!locationMode)return;
      const view=$('adminView'),card=siteLocationCard();if(!view||!card)return;
      if(card.dataset.adminSectionV21083!=='locations')card.dataset.adminSectionV21083='locations';
      const landing=$('adminHomeV21083'),back=$('adminSectionBackV21083');
      if(landing&&!landing.hidden)landing.hidden=true;
      if(back&&back.hidden)back.hidden=false;
      view.querySelectorAll(':scope > .section-card[data-admin-section-v21083]').forEach(x=>{
        const hide=x!==card;if(x.hidden!==hide)x.hidden=hide;
      });
      if(card.hidden)card.hidden=false;
      const list=$('siteLocationList');
      if(list&&!list.querySelector('.site-location-tree-v21090')){
        try{window.SafetyResponsibilityLocationV21090?.renderLocationTree?.()}catch(_e){}
      }
    }

    function scheduleEnforce(){
      clearTimeout(enforceTimer);
      enforceTimer=setTimeout(enforceLocationDetail,25);
    }

    async function refreshLocations(showMessage=false){
      if(refreshBusy||st.offline||!navigator.onLine||!st.user)return st.siteLocations?.length||0;
      refreshBusy=true;
      try{
        const r=await sb.from('site_locations_v280').select('*').order('sort_order',{ascending:true});
        if(r.error)throw r.error;
        st.siteLocations=r.data||[];
        try{window.SafetyResponsibilityLocationV21090?.renderLocationTree?.()}catch(_e){}
        enforceLocationDetail();
        if(showMessage){
          const rooms=st.siteLocations.filter(x=>x.active!==false&&x.location_type==='ROOM').length;
          toast(`Site Locations refreshed: ${st.siteLocations.filter(x=>x.active!==false).length} active location(s), ${rooms} room(s).`);
        }
        return st.siteLocations.filter(x=>x.active!==false).length;
      }catch(e){
        console.warn('v2.10.96 location refresh',e);
        if(showMessage)toast(e?.message||'Could not refresh Site Locations.');
        return st.siteLocations?.filter(x=>x.active!==false).length||0;
      }finally{refreshBusy=false;}
    }

    document.addEventListener('pointerdown',e=>{
      const locationTile=e.target.closest?.('[data-admin-tile-v21083="locations"]');
      if(locationTile){
        locationMode=true;
        [0,80,220,600].forEach(ms=>setTimeout(()=>{scheduleEnforce();if(ms===80)refreshLocations(false);},ms));
        return;
      }

      const adminBack=e.target.closest?.('#adminSectionBackV21083');
      const otherAdminTile=e.target.closest?.('[data-admin-tile-v21083]:not([data-admin-tile-v21083="locations"])');
      const leaveAdmin=e.target.closest?.('#mainNav button[data-view]:not([data-view="admin"]),[data-management-home-v21079]');
      if(adminBack||otherAdminTile||leaveAdmin)locationMode=false;

      const del=e.target.closest?.('[data-asb87-delete-test]');
      if(del)beforeDeleteLocationCount=(st.siteLocations||[]).filter(x=>x.active!==false).length;
    },true);

    const toastEl=$('toast');
    if(toastEl){
      new MutationObserver(()=>{
        const msg=String(toastEl.textContent||'').trim();
        if(!msg.startsWith('TEST data deleted.'))return;
        const before=beforeDeleteLocationCount;
        beforeDeleteLocationCount=null;
        setTimeout(async()=>{
          const after=await refreshLocations(false);
          if(Number.isFinite(before)&&before>after){
            const removed=before-after;
            const extra=` ${removed} TEST-only site location${removed===1?'':'s'} removed.`;
            if(!String(toastEl.textContent||'').includes('TEST-only site location'))toastEl.textContent=msg+extra;
          }
        },250);
      }).observe(toastEl,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
    }

    const adminView=$('adminView');
    if(adminView){
      new MutationObserver(()=>{if(locationMode)scheduleEnforce();})
        .observe(adminView,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-admin-section-v21083']});
    }

    [300,900,1800].forEach(ms=>setTimeout(()=>refreshLocations(false),ms));
    window.addEventListener('pageshow',()=>setTimeout(()=>refreshLocations(false),120));

    window.SafetySiteLocationTestCleanupV21096={refreshLocations,enforceLocationDetail};
  }

  boot();
})();
