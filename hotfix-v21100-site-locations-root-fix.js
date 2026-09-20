/* Safety Tracker v2.11.0 - Site Locations root routing/search fix */
'use strict';
(function(){
  if(window.__SAFETY_SITE_LOCATIONS_ROOT_FIX_V2110)return;
  window.__SAFETY_SITE_LOCATIONS_ROOT_FIX_V2110=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const view=document.getElementById('adminView');
    if(!core||!core.state||!view){
      setTimeout(boot,120);return;
    }
    install(core,view);
  }

  function install(core,view){
    const st=core.state;
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let query='';
    let renderTimer=0;
    let installTimer=0;

    function locationCard(){
      return Array.from(view.children).find(el=>{
        if(!el.classList?.contains('section-card'))return false;
        const t=String(el.querySelector('h3')?.textContent||'').trim().toLowerCase();
        return t==='site locations'||t==='site locations & rooms';
      })||null;
    }

    function permanentlyClassify(){
      const card=locationCard();
      if(!card)return;
      card.dataset.adminSectionV21083='locations';

      // v2.10.83 has a legacy exact-title map:
      // "site locations" -> "asbestos".
      // Rename the visible heading so that old mapper can never reclaim it.
      const h=card.querySelector('h3');
      if(h && String(h.textContent||'').trim().toLowerCase()==='site locations'){
        h.textContent='Site Locations & Rooms';
      }
    }

    const locById=id=>(st.siteLocations||[]).find(x=>x.id===id)||null;
    function locPath(id){
      const parts=[];let x=locById(id),guard=0;
      while(x&&guard++<30){
        parts.unshift(x.name||'');
        x=x.parent_id?locById(x.parent_id):null;
      }
      return parts.filter(Boolean).join(' > ');
    }

    function matches(){
      const q=query.trim().toLowerCase();
      if(!q)return [];
      return (st.siteLocations||[])
        .filter(x=>x.active!==false)
        .map(x=>({
          row:x,
          path:locPath(x.id),
          type:String(x.location_type||'AREA').replaceAll('_',' ')
        }))
        .filter(x=>(x.path+' '+x.type).toLowerCase().includes(q))
        .sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true}))
        .slice(0,100);
    }

    function renderResults(){
      const tree=document.querySelector('#siteLocationList .site-location-tree-v21090');
      if(!tree)return;
      const root=tree.querySelector('.site-tree-root-v21090');
      let results=tree.querySelector('.site-search-results-v2110');

      if(!query.trim()){
        if(results)results.remove();
        if(root)root.hidden=false;
        return;
      }

      if(root)root.hidden=true;
      const rows=matches();

      if(!results){
        results=document.createElement('div');
        results.className='site-search-results-v2110';
        if(root)root.insertAdjacentElement('beforebegin',results);
        else tree.appendChild(results);
      }

      results.innerHTML=
        `<div class="hint-box site-search-summary-v2110"><strong>${rows.length} matching location${rows.length===1?'':'s'}</strong>${rows.length===100?' (first 100 shown)':''}</div>`+
        (rows.length?rows.map(({row,path,type})=>`
          <div class="item-card compact site-search-row-v2110">
            <div class="row-between">
              <div class="site-search-copy-v2110">
                <strong>${esc(row.name||'Location')}</strong>
                <div class="muted">${esc(path)}</div>
                <div class="meta">
                  <span>${esc(type)}</span>
                  <span class="badge complete">Active</span>
                </div>
              </div>
              <div class="row">
                <button type="button" class="secondary small" data-edit-site-location="${esc(row.id)}">Edit</button>
              </div>
            </div>
          </div>`).join(''):'<div class="empty">No matching locations.</div>');
    }

    function scheduleResults(){
      clearTimeout(renderTimer);
      renderTimer=setTimeout(renderResults,35);
    }

    function installStableSearch(){
      permanentlyClassify();

      const tree=document.querySelector('#siteLocationList .site-location-tree-v21090');
      if(!tree)return;
      const toolbar=tree.querySelector('.site-tree-toolbar-v21090');
      if(!toolbar)return;

      // Disable the v2.10.90 search input so its old document-level listener
      // cannot redraw the entire tree on every keystroke.
      const old=toolbar.querySelector('#siteLocationTreeSearchV21090');
      if(old){
        old.id='siteLocationTreeSearchV21090Disabled';
        old.hidden=true;
        old.setAttribute('aria-hidden','true');
        old.tabIndex=-1;
      }

      let input=toolbar.querySelector('#siteLocationTreeSearchV2110');
      if(!input){
        input=document.createElement('input');
        input.id='siteLocationTreeSearchV2110';
        input.type='search';
        input.placeholder='Search room, floor or area…';
        input.autocomplete='off';
        input.autocapitalize='off';
        input.spellcheck=false;
        input.value=query;
        toolbar.insertAdjacentElement('afterbegin',input);

        input.addEventListener('input',()=>{
          query=input.value||'';
          scheduleResults();
        });

        input.addEventListener('search',()=>{
          query=input.value||'';
          scheduleResults();
        });
      }

      if(input.value!==query)input.value=query;
      renderResults();
    }

    function scheduleInstall(){
      clearTimeout(installTimer);
      installTimer=setTimeout(installStableSearch,30);
    }

    // Only react when the whole location tree is replaced. Search result
    // changes happen inside the tree and deliberately do not retrigger this.
    const list=document.getElementById('siteLocationList');
    if(list){
      new MutationObserver(scheduleInstall).observe(list,{childList:true,subtree:false});
    }

    // Keep the card's permanent classification if Admin content is rebuilt.
    // This observer does NOT render or hide anything.
    new MutationObserver(()=>{
      permanentlyClassify();
    }).observe(view,{childList:true,subtree:false});

    document.addEventListener('click',e=>{
      const tile=e.target.closest?.('[data-admin-tile-v21083="locations"]');
      if(tile){
        permanentlyClassify();
        [60,180,450].forEach(ms=>setTimeout(installStableSearch,ms));
      }

      if(e.target.closest?.('[data-site-tree-expand-all],[data-site-tree-collapse-all],[data-site-tree-toggle]')){
        setTimeout(installStableSearch,60);
      }
    },true);

    const style=document.createElement('style');
    style.id='siteLocationsRootFixStylesV2110';
    style.textContent=`
      #siteLocationTreeSearchV2110{width:100%;min-width:0}
      #siteLocationTreeSearchV21090Disabled{display:none!important}
      .site-search-results-v2110{display:grid;gap:7px;margin-top:10px}
      .site-search-summary-v2110{margin-bottom:2px}
      .site-search-row-v2110{margin:0}
      .site-search-copy-v2110{min-width:0}
      .site-search-copy-v2110 strong,
      .site-search-copy-v2110 .muted{overflow-wrap:anywhere}
      @media(max-width:760px){
        .site-search-row-v2110 .row-between{align-items:flex-start}
        .site-search-row-v2110 button{min-height:38px}
      }
    `;
    document.head.appendChild(style);

    [120,350,800,1600].forEach(ms=>setTimeout(()=>{
      permanentlyClassify();
      installStableSearch();
    },ms));

    window.addEventListener('pageshow',()=>setTimeout(()=>{
      permanentlyClassify();
      installStableSearch();
    },150));

    window.SafetySiteLocationsRootFixV2110={
      refresh:installStableSearch,
      classify:permanentlyClassify
    };
  }

  boot();
})();
