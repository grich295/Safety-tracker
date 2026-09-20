/* Safety Tracker v2.10.89 - dedicated Site Locations Admin tile */
'use strict';
(function(){
  if(window.__SITE_LOCATION_TILE_V21089)return;
  window.__SITE_LOCATION_TILE_V21089=true;

  function boot(){
    var api=window.SafetyAdminSectionsV21083;
    var view=document.getElementById('adminView');
    if(!api||!view){setTimeout(boot,100);return;}
    install(api,view);
  }

  function install(api,view){
    function heading(card){
      var h=card.querySelector(':scope > h3, :scope > .row-between h3, h3');
      return String(h&&h.textContent||'').trim().toLowerCase();
    }

    function ensureLocationTile(){
      var grid=view.querySelector('.admin-tile-grid-v21083');
      if(!grid)return;

      var asbestos=grid.querySelector('[data-admin-tile-v21083="asbestos"]');
      if(asbestos){
        var strong=asbestos.querySelector('strong');
        var small=asbestos.querySelector('small');
        if(strong)strong.textContent='Asbestos Sources';
        if(small)small.textContent='Upload, review and re-analyse asbestos plans, surveys and evidence.';
      }

      var existing=grid.querySelector('[data-admin-tile-v21083="locations"]');
      if(existing)return;

      var btn=document.createElement('button');
      btn.type='button';
      btn.className='admin-tile-v21083';
      btn.dataset.adminTileV21083='locations';
      btn.innerHTML=
        '<span class="admin-tile-icon-v21083" aria-hidden="true">⌖</span>'+
        '<span class="admin-tile-copy-v21083">'+
          '<strong>Site Locations</strong>'+
          '<small>Manage floors, rooms, work areas and the hotel location hierarchy.</small>'+
        '</span>';

      if(asbestos&&asbestos.nextSibling)grid.insertBefore(btn,asbestos.nextSibling);
      else grid.appendChild(btn);
    }

    function classify(){
      Array.from(view.children).forEach(function(card){
        if(!card.classList||!card.classList.contains('section-card'))return;
        var h=heading(card);

        if(h==='site locations'){
          card.dataset.adminSectionV21083='locations';
        }else if(h==='asbestos source documents'){
          card.dataset.adminSectionV21083='asbestos';
        }
      });

      ensureLocationTile();
      try{api.render();}catch(e){console.warn('Location tile render',e);}
    }

    var timer=0;
    new MutationObserver(function(){
      clearTimeout(timer);
      timer=setTimeout(classify,40);
    }).observe(view,{childList:true,subtree:true});

    [0,100,350,900,1800].forEach(function(ms){setTimeout(classify,ms);});
    window.addEventListener('pageshow',function(){setTimeout(classify,100);});

    window.SafetySiteLocationTileV21089={refresh:classify};
  }

  boot();
})();