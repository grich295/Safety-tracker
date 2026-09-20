/* Safety Tracker v2.10.85 - Admin dynamic-card grouping fix */
'use strict';
(function(){
  if(window.__ADMIN_GROUPING_V21085)return;
  window.__ADMIN_GROUPING_V21085=true;

  function boot(){
    var core=window.SafetyTrackerV2;
    var api=window.SafetyAdminSectionsV21083;
    var view=document.getElementById('adminView');
    if(!core||!api||!view){setTimeout(boot,120);return;}
    install(view,api);
  }

  function install(view,api){
    var labels={
      knowledge:{
        icon:'?',
        title:'Knowledge Check Setup',
        desc:'Monthly knowledge-check settings, status and administration.'
      },
      people:{
        icon:'👥',
        title:'People & Responsibilities',
        desc:'Admin-only position, responsibility and user setup controls.'
      },
      other:{
        icon:'⋯',
        title:'Additional Admin',
        desc:'Other administrative controls added by later modules.'
      }
    };

    function heading(card){
      var h=card.querySelector(':scope > h3, :scope > .row-between h3, h3');
      return String(h&&h.textContent||'').trim().toLowerCase();
    }

    function classify(card){
      var h=heading(card);

      if(h.includes('document creation'))return 'document';
      if(h.includes('guest')||h.includes('viewer access'))return 'viewer';
      if(h.includes('department'))return 'departments';

      if(h.includes('asbestos source')||h.includes('site location'))return 'asbestos';

      if(
        h.includes('force sync')||
        h.includes('repair sds')||
        h.includes('repair msds')||
        h.includes('repair risk assessment')||
        h.includes('repair ra title')
      )return 'sync';

      if(h.includes('storage cleanup'))return 'storage';
      if(h.includes('bulk import'))return 'bulk';
      if(h.includes('scheduled report'))return 'scheduled';
      if(h.includes('build diagnostic'))return 'diagnostics';

      if(h.includes('knowledge'))return 'knowledge';

      if(
        h.includes('position')||
        h.includes('responsibilit')||
        h.includes('health & safety officer')||
        h.includes('h&s officer')||
        h.includes('user management')||
        h.includes('user access')
      )return 'people';

      return 'other';
    }

    function directCards(){
      return Array.from(view.children).filter(function(el){
        return el.classList&&el.classList.contains('section-card');
      });
    }

    function ensureTile(key){
      if(!labels[key])return;
      var grid=view.querySelector('.admin-tile-grid-v21083');
      if(!grid)return;
      if(grid.querySelector('[data-admin-tile-v21083="'+key+'"]'))return;

      var t=labels[key];
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='admin-tile-v21083';
      btn.dataset.adminTileV21083=key;
      btn.innerHTML=
        '<span class="admin-tile-icon-v21083" aria-hidden="true">'+t.icon+'</span>'+
        '<span class="admin-tile-copy-v21083">'+
          '<strong>'+t.title+'</strong>'+
          '<small>'+t.desc+'</small>'+
        '</span>';
      grid.appendChild(btn);
    }

    function scan(){
      var groups=new Set();

      directCards().forEach(function(card){
        var key=classify(card);
        card.dataset.adminSectionV21083=key;
        groups.add(key);
      });

      ['knowledge','people','other'].forEach(function(key){
        if(groups.has(key))ensureTile(key);
      });

      /*
       * v2.10.83 hides every tagged card on the Admin landing page and,
       * in detail mode, displays only the selected tag. Before this fix,
       * older dynamic cards had no tag and therefore remained visible.
       */
      try{api.render();}catch(e){console.warn('Admin grouping render',e);}
    }

    var timer=0;
    var observer=new MutationObserver(function(mutations){
      var relevant=mutations.some(function(m){
        return m.type==='childList'&&m.addedNodes&&m.addedNodes.length;
      });
      if(!relevant)return;
      clearTimeout(timer);
      timer=setTimeout(scan,40);
    });
    observer.observe(view,{childList:true,subtree:false});

    /*
     * Some older modules add their Admin cards shortly after navigation,
     * so rescan at a few safe points as well.
     */
    [0,100,350,900,1800,3200].forEach(function(ms){setTimeout(scan,ms);});
    window.addEventListener('pageshow',function(){setTimeout(scan,100);});
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='visible')setTimeout(scan,100);
    });

    window.SafetyAdminGroupingV21085={scan:scan,classify:classify};
  }

  boot();
})();
