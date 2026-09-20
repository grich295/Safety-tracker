/* Safety Tracker v2.10.97 - definitive Site Locations display + live verification */
'use strict';
(function(){
  if(window.__SAFETY_SITE_LOCATIONS_V21097)return;
  window.__SAFETY_SITE_LOCATIONS_V21097=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const view=document.getElementById('adminView');
    if(!core||!core.state||!core.sb||!view){
      setTimeout(boot,120);return;
    }
    install(core,view);
  }

  function install(core,view){
    const st=core.state,sb=core.sb;
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let active=false,refreshing=false,timer=0;

    function card(){
      const c=Array.from(view.children).find(el=>{
        if(!el.classList?.contains('section-card'))return false;
        return String(el.querySelector('h3')?.textContent||'').trim().toLowerCase()==='site locations';
      })||null;
      if(c)c.classList.add('site-locations-card-v21097');
      return c;
    }

    function statusBox(){
      const c=card();if(!c)return null;
      let box=$('siteLocationLiveStatusV21097');
      if(!box){
        box=document.createElement('div');
        box.id='siteLocationLiveStatusV21097';
        box.className='hint-box site-location-live-v21097';
        const row=c.querySelector('.row-between');
        if(row)row.insertAdjacentElement('afterend',box);else c.prepend(box);
      }
      return box;
    }

    function counts(){
      const live=(st.siteLocations||[]).filter(x=>x.active!==false);
      const rooms=live.filter(x=>String(x.location_type||'').toUpperCase()==='ROOM');
      const room214=live.find(x=>/^(room\s*)?214$/i.test(String(x.room_label||x.name||'').trim()));
      return {active:live.length,rooms:rooms.length,room214};
    }

    function showStatus(message='',tone='green'){
      const b=statusBox();if(!b)return;
      if(message){
        b.className=(tone==='red'?'danger-note':tone==='amber'?'pending-use-warning':'success-note')+' site-location-live-v21097';
        b.innerHTML=message;
        return;
      }
      const n=counts();
      const ok=n.active>0&&n.rooms>0;
      b.className=(ok?'success-note':'pending-use-warning')+' site-location-live-v21097';
      b.innerHTML=
        `<strong>LIVE LOCATION CHECK:</strong> ${n.active} active location${n.active===1?'':'s'} · `+
        `${n.rooms} room${n.rooms===1?'':'s'} · `+
        `${n.room214?'<strong>Room 214 found ✓</strong>':'Room 214 not found'} `+
        `<button type="button" class="secondary small" data-v21097-refresh-locations>Refresh</button>`;
    }

    function forceVisible(){
      const c=card();if(!active||!c)return;
      view.classList.add('force-locations-v21097');
      c.hidden=false;
      c.removeAttribute('hidden');
      try{window.SafetyResponsibilityLocationV21090?.renderLocationTree?.()}catch(_e){}
      showStatus();
    }

    function scheduleForce(){
      clearTimeout(timer);
      timer=setTimeout(forceVisible,20);
    }

    async function refreshLocations(showToast=false){
      if(refreshing||st.offline||!navigator.onLine||!st.user){
        forceVisible();return false;
      }
      refreshing=true;
      try{
        showStatus('<strong>Refreshing live Site Locations…</strong>','amber');
        const r=await sb.from('site_locations_v280').select('*').order('sort_order',{ascending:true});
        if(r.error)throw r.error;
        st.siteLocations=r.data||[];
        try{window.SafetyResponsibilityLocationV21090?.renderLocationTree?.()}catch(_e){}
        forceVisible();
        const n=counts();
        showStatus();
        if(showToast)core.toast?.(`Site Locations: ${n.active} active, ${n.rooms} rooms${n.room214?', Room 214 found':''}.`);
        return true;
      }catch(e){
        console.error('v2.10.97 Site Locations refresh',e);
        showStatus(`<strong>Could not load live Site Locations.</strong><br>${esc(e?.message||'Unknown error')}`,'red');
        if(showToast)core.toast?.(e?.message||'Could not refresh Site Locations.');
        return false;
      }finally{
        refreshing=false;
      }
    }

    function activate(){
      active=true;
      view.classList.add('force-locations-v21097');
      [0,40,120,300,700].forEach(ms=>setTimeout(forceVisible,ms));
      setTimeout(()=>refreshLocations(false),80);
    }

    function deactivate(){
      active=false;
      view.classList.remove('force-locations-v21097');
    }

    document.addEventListener('click',e=>{
      const locationTile=e.target.closest?.('[data-admin-tile-v21083="locations"]');
      if(locationTile){
        activate();
        return; // allow original Admin routing to continue; CSS/display override wins afterwards
      }

      const refresh=e.target.closest?.('[data-v21097-refresh-locations]');
      if(refresh){
        e.preventDefault();e.stopImmediatePropagation();
        refreshLocations(true);
        return;
      }

      const back=e.target.closest?.('#adminSectionBackV21083');
      const otherTile=e.target.closest?.('[data-admin-tile-v21083]:not([data-admin-tile-v21083="locations"])');
      const leave=e.target.closest?.('#mainNav button[data-view]:not([data-view="admin"]),[data-management-home-v21079]');
      if(back||otherTile||leave)deactivate();
    },true);

    // Re-assert visibility after older Admin renderers toggle the hidden attribute.
    new MutationObserver(()=>{
      card();
      if(active)scheduleForce();
    }).observe(view,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-admin-section-v21083']});

    // Ensure the dedicated location tile/card exists and keep the tree current.
    [100,350,900,1800].forEach(ms=>setTimeout(()=>{
      try{window.SafetySiteLocationTileV21089?.refresh?.()}catch(_e){}
      card();
      if(active)forceVisible();
    },ms));

    window.addEventListener('pageshow',()=>setTimeout(()=>{
      card();
      if(active)refreshLocations(false);
    },120));

    const style=document.createElement('style');
    style.id='siteLocationsStylesV21097';
    style.textContent=`
      #adminView.force-locations-v21097 > .site-locations-card-v21097,
      #adminView.force-locations-v21097 > .site-locations-card-v21097[hidden]{
        display:block!important;
        visibility:visible!important;
      }
      .site-location-live-v21097{margin:10px 0 12px}
      .site-location-live-v21097 button{margin-left:8px}
    `;
    document.head.appendChild(style);

    window.SafetySiteLocationsV21097={activate,refreshLocations,forceVisible};
  }

  boot();
})();
