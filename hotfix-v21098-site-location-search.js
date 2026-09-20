/* Safety Tracker v2.10.99 patch of v2.10.98 - stable Site Locations search for mobile */
'use strict';
(function(){
  if(window.__SAFETY_SITE_LOCATION_SEARCH_V21098)return;
  window.__SAFETY_SITE_LOCATION_SEARCH_V21098=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!document.getElementById('adminView')){
      setTimeout(boot,120);return;
    }
    install(core);
  }

  function install(core){
    const st=core.state;
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let query='';
    let installTimer=0;

    const locById=id=>(st.siteLocations||[]).find(x=>x.id===id)||null;

    function locPath(id){
      const out=[];let x=locById(id),guard=0;
      while(x&&guard++<30){
        out.unshift(x.name||'');
        x=x.parent_id?locById(x.parent_id):null;
      }
      return out.filter(Boolean).join(' > ');
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
      let results=tree.querySelector('.site-search-results-v21098');

      if(!query.trim()){
        if(results)results.remove();
        if(root)root.hidden=false;
        return;
      }

      if(root)root.hidden=true;
      const rows=matches();

      if(!results){
        results=document.createElement('div');
        results.className='site-search-results-v21098';
        if(root)root.insertAdjacentElement('beforebegin',results);
        else tree.appendChild(results);
      }

      results.innerHTML=
        `<div class="hint-box site-search-summary-v21098"><strong>${rows.length} matching location${rows.length===1?'':'s'}</strong>${rows.length===100?' (first 100 shown)':''}</div>`+
        (rows.length?rows.map(({row,path,type})=>`
          <div class="item-card compact site-search-row-v21098">
            <div class="row-between">
              <div class="site-search-copy-v21098">
                <strong>${esc(row.name||'Location')}</strong>
                <div class="muted">${esc(path)}</div>
                <div class="meta"><span>${esc(type)}</span><span class="badge complete">Active</span></div>
              </div>
              <div class="row">
                <button type="button" class="secondary small" data-edit-site-location="${esc(row.id)}">Edit</button>
              </div>
            </div>
          </div>`).join(''):'<div class="empty">No matching locations.</div>');
    }

    function installStableSearch(){
      const tree=document.querySelector('#siteLocationList .site-location-tree-v21090');
      if(!tree)return;

      const toolbar=tree.querySelector('.site-tree-toolbar-v21090');
      if(!toolbar)return;

      const legacy=toolbar.querySelector('#siteLocationTreeSearchV21090');
      if(legacy){
        legacy.id='siteLocationTreeSearchV21090Legacy';
        legacy.hidden=true;
        legacy.setAttribute('aria-hidden','true');
        legacy.tabIndex=-1;
      }

      let stable=toolbar.querySelector('#siteLocationTreeSearchV21098');
      if(!stable){
        stable=document.createElement('input');
        stable.id='siteLocationTreeSearchV21098';
        stable.type='search';
        stable.placeholder='Search room, floor or area…';
        stable.autocomplete='off';
        stable.autocapitalize='off';
        stable.spellcheck=false;
        stable.value=query;
        toolbar.insertAdjacentElement('afterbegin',stable);

        stable.addEventListener('input',()=>{
          query=stable.value||'';
          renderResults();
        });

        stable.addEventListener('search',()=>{
          query=stable.value||'';
          renderResults();
        });
      }else if(stable.value!==query){
        stable.value=query;
      }

      renderResults();
    }

    function scheduleInstall(){
      clearTimeout(installTimer);
      installTimer=setTimeout(installStableSearch,30);
    }

    const list=document.getElementById('siteLocationList');
    if(list){
      // IMPORTANT v2.10.99: only react when the whole tree is replaced.
      // Search-result mutations happen inside the tree and must not trigger
      // another search installation/render cycle.
      new MutationObserver(scheduleInstall).observe(list,{childList:true,subtree:false});
    }

    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-admin-tile-v21083="locations"]')){
        [100,300,700].forEach(ms=>setTimeout(installStableSearch,ms));
      }
      if(e.target.closest?.('[data-site-tree-expand-all],[data-site-tree-collapse-all],[data-site-tree-toggle]')){
        setTimeout(installStableSearch,50);
      }
    },true);

    const style=document.createElement('style');
    style.id='siteLocationSearchStylesV21098';
    style.textContent=`
      #siteLocationTreeSearchV21098{
        min-width:0;
        width:100%;
      }
      #siteLocationTreeSearchV21090Legacy{display:none!important}
      .site-search-results-v21098{display:grid;gap:7px;margin-top:10px}
      .site-search-summary-v21098{margin-bottom:2px}
      .site-search-row-v21098{margin:0}
      .site-search-copy-v21098{min-width:0}
      .site-search-copy-v21098 strong,
      .site-search-copy-v21098 .muted{overflow-wrap:anywhere}
      @media(max-width:760px){
        .site-search-row-v21098 .row-between{align-items:flex-start}
        .site-search-row-v21098 button{min-height:38px}
      }
    `;
    document.head.appendChild(style);

    [150,450,1000,2000].forEach(ms=>setTimeout(installStableSearch,ms));
    window.addEventListener('pageshow',()=>setTimeout(installStableSearch,150));

    window.SafetySiteLocationSearchV21098={
      refresh:installStableSearch,
      clear:()=>{query='';const s=document.getElementById('siteLocationTreeSearchV21098');if(s)s.value='';renderResults();}
    };
  }

  boot();
})();
