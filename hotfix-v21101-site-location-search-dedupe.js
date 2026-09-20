/* Safety Tracker v2.11.1 - remove duplicate legacy Site Locations search bars */
'use strict';
(function(){
  if(window.__SAFETY_SITE_LOCATION_SEARCH_DEDUPE_V2111)return;
  window.__SAFETY_SITE_LOCATION_SEARCH_DEDUPE_V2111=true;

  function clean(){
    const tree=document.querySelector('#siteLocationList .site-location-tree-v21090');
    if(!tree)return;

    const toolbar=tree.querySelector('.site-tree-toolbar-v21090');
    if(!toolbar)return;

    /* v2.11.0 is the only search input allowed to remain visible. */
    toolbar.querySelectorAll('input[type="search"]').forEach(input=>{
      if(input.id==='siteLocationTreeSearchV2110')return;
      input.hidden=true;
      input.setAttribute('aria-hidden','true');
      input.tabIndex=-1;
    });

    /* Remove any old lightweight results left by v2.10.98. */
    tree.querySelectorAll('.site-search-results-v21098').forEach(el=>el.remove());
  }

  let timer=0;
  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(clean,20);
  }

  const list=document.getElementById('siteLocationList');
  if(list){
    new MutationObserver(schedule).observe(list,{childList:true,subtree:true});
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-admin-tile-v21083="locations"]')){
      [50,150,350,700].forEach(ms=>setTimeout(clean,ms));
    }
  },true);

  const style=document.createElement('style');
  style.id='siteLocationSearchDedupeStylesV2111';
  style.textContent=`
    #siteLocationList .site-tree-toolbar-v21090 input[type="search"]:not(#siteLocationTreeSearchV2110){
      display:none!important;
    }
    #siteLocationList .site-search-results-v21098{
      display:none!important;
    }
  `;
  document.head.appendChild(style);

  [100,300,800,1600].forEach(ms=>setTimeout(clean,ms));
  window.addEventListener('pageshow',()=>setTimeout(clean,120));

  window.SafetySiteLocationSearchDedupeV2111={clean};
})();
