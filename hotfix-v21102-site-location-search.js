/* Safety Tracker v2.11.3 patch of v2.11.2 - authoritative Site Locations mobile search */
'use strict';
(function(){
  if(window.__SAFETY_SITE_LOCATION_SEARCH_V2112)return;
  window.__SAFETY_SITE_LOCATION_SEARCH_V2112=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const view=document.getElementById('adminView');
    const list=document.getElementById('siteLocationList');
    if(!core||!core.state||!view||!list){
      setTimeout(boot,120);return;
    }
    install(core,view,list);
  }

  function install(core,view,list){
    const st=core.state;
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

    let query='';
    let ensureTimer=0;
    let resultTimer=0;

    function locationCard(){
      return Array.from(view.children).find(el=>{
        if(!el.classList?.contains('section-card'))return false;
        const h=String(el.querySelector('h3')?.textContent||'').trim().toLowerCase();
        return h==='site locations'||h==='site locations & rooms';
      })||null;
    }

    function classify(){
      const card=locationCard();
      if(card)card.dataset.adminSectionV21083='locations';
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

    function matchingRows(){
      const q=query.trim().toLowerCase();
      if(!q)return [];
      return (st.siteLocations||[])
        .filter(x=>x.active!==false)
        .map(row=>({
          row,
          path:locPath(row.id),
          type:String(row.location_type||'AREA').replaceAll('_',' ')
        }))
        .filter(x=>(x.path+' '+x.type).toLowerCase().includes(q))
        .sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true}))
        .slice(0,100);
    }

    function renderResults(){
      const tree=list.querySelector('.site-location-tree-v21090');
      if(!tree)return;
      const root=tree.querySelector('.site-tree-root-v21090');
      let results=tree.querySelector('.site-search-results-v2112');

      if(!query.trim()){
        if(results)results.remove();
        if(root)root.hidden=false;
        return;
      }

      if(root)root.hidden=true;
      const rows=matchingRows();

      if(!results){
        results=document.createElement('div');
        results.className='site-search-results-v2112';
        if(root)root.insertAdjacentElement('beforebegin',results);
        else tree.appendChild(results);
      }

      results.innerHTML=
        `<div class="hint-box site-search-summary-v2112"><strong>${rows.length} matching location${rows.length===1?'':'s'}</strong>${rows.length===100?' · first 100 shown':''}</div>`+
        (rows.length?rows.map(({row,path,type})=>`
          <div class="item-card compact site-search-row-v2112">
            <div class="row-between">
              <div class="site-search-copy-v2112">
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
      clearTimeout(resultTimer);
      resultTimer=setTimeout(renderResults,25);
    }

    function ensureSearch(){
      classify();

      const tree=list.querySelector('.site-location-tree-v21090');
      if(!tree)return;
      const toolbar=tree.querySelector('.site-tree-toolbar-v21090');
      if(!toolbar)return;

      toolbar.querySelectorAll('input[type="search"]').forEach(input=>{
        if(input.id!=='siteLocationTreeSearchV2112')input.remove();
      });

      let input=toolbar.querySelector('#siteLocationTreeSearchV2112');
      if(!input){
        input=document.createElement('input');
        input.id='siteLocationTreeSearchV2112';
        input.type='search';
        input.placeholder='Search room, floor or area…';
        input.autocomplete='off';
        input.autocapitalize='off';
        input.spellcheck=false;
        input.value=query;
        toolbar.insertAdjacentElement('afterbegin',input);
      }else if(input.value!==query){
        input.value=query;
      }

      tree.querySelectorAll('.site-search-results-v21098,.site-search-results-v2110').forEach(el=>el.remove());
      renderResults();
    }

    function scheduleEnsure(){
      clearTimeout(ensureTimer);
      ensureTimer=setTimeout(ensureSearch,20);
    }

    window.addEventListener('input',e=>{
      const input=e.target;
      if(!(input instanceof HTMLInputElement))return;
      if(input.id!=='siteLocationTreeSearchV2112')return;

      e.stopImmediatePropagation();
      query=input.value||'';
      scheduleResults();
    },true);

    window.addEventListener('search',e=>{
      const input=e.target;
      if(!(input instanceof HTMLInputElement))return;
      if(input.id!=='siteLocationTreeSearchV2112')return;

      e.stopImmediatePropagation();
      query=input.value||'';
      scheduleResults();
    },true);

    /* Only watch replacement of the whole tree. Search-result changes happen
       inside the tree and must not retrigger installation. */
    new MutationObserver(scheduleEnsure).observe(list,{childList:true,subtree:false});

    new MutationObserver(classify).observe(view,{childList:true,subtree:false});

    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-admin-tile-v21083="locations"]')){
        classify();
        [40,120,300,700].forEach(ms=>setTimeout(ensureSearch,ms));
      }
      if(e.target.closest?.('[data-site-tree-expand-all],[data-site-tree-collapse-all],[data-site-tree-toggle]')){
        setTimeout(ensureSearch,60);
      }
    },true);

    const style=document.createElement('style');
    style.id='siteLocationSearchStylesV2112';
    style.textContent=`
      #siteLocationTreeSearchV2112{width:100%;min-width:0}
      .site-search-results-v2112{display:grid;gap:7px;margin-top:10px}
      .site-search-summary-v2112{margin-bottom:2px}
      .site-search-row-v2112{margin:0}
      .site-search-copy-v2112{min-width:0}
      .site-search-copy-v2112 strong,
      .site-search-copy-v2112 .muted{overflow-wrap:anywhere}
      @media(max-width:760px){
        .site-search-row-v2112 .row-between{align-items:flex-start}
        .site-search-row-v2112 button{min-height:38px}
      }
    `;
    document.head.appendChild(style);

    [100,300,700,1400,2200].forEach(ms=>setTimeout(ensureSearch,ms));
    window.addEventListener('pageshow',()=>setTimeout(ensureSearch,120));

    window.SafetySiteLocationSearchV2112={
      refresh:ensureSearch,
      clear(){
        query='';
        const input=document.getElementById('siteLocationTreeSearchV2112');
        if(input)input.value='';
        renderResults();
      }
    };
  }

  boot();
})();
