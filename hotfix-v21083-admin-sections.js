/* Safety Tracker v2.10.83 - compact Admin sections + modal status visibility */
'use strict';
(function(){
  if(window.__ADMIN_SECTIONS_V21083)return;
  window.__ADMIN_SECTIONS_V21083=true;

  function boot(){
    var core=window.SafetyTrackerV2;
    var view=document.getElementById('adminView');
    if(!core||!core.state||!view){setTimeout(boot,140);return;}
    install(core,view);
  }

  function install(core,view){
    var state=core.state;
    var detailKey=null;
    var sectionMap={
      'document creation':'document',
      'guest / viewer access':'viewer',
      'departments':'departments',
      'asbestos source documents':'asbestos',
      'site locations':'locations',
      'site locations & rooms':'locations',
      'force sync & review':'sync',
      'repair sds/msds titles':'sync',
      'repair risk assessment titles':'sync',
      'storage cleanup':'storage',
      'bulk import':'bulk',
      'scheduled reports':'scheduled',
      'build diagnostics':'diagnostics'
    };

    var tiles=[
      {key:'document',icon:'✎',title:'Document Creation',desc:'RA, COSHH, SSW and Toolbox Talk creation controls.'},
      {key:'viewer',icon:'◉',title:'Viewer Access',desc:'Temporary view-only accounts and preview mode.'},
      {key:'departments',icon:'▦',title:'Departments',desc:'Departments used for people and document assignment.'},
      {key:'asbestos',icon:'A',title:'Asbestos & Locations',desc:'Asbestos sources and the site location hierarchy.'},
      {key:'sync',icon:'↻',title:'Sync & Repair',desc:'Force Sync plus SDS and RA title repair tools.'},
      {key:'bulk',icon:'⇧',title:'Bulk Import',desc:'Analyse and import controlled PDF batches.'},
      {key:'storage',icon:'□',title:'Storage Cleanup',desc:'Find orphaned files without touching live evidence.'},
      {key:'scheduled',icon:'▣',title:'Scheduled Reports',desc:'Automatic weekly and monthly report schedules.'},
      {key:'diagnostics',icon:'⚙',title:'Build Diagnostics',desc:'Build version and technical diagnostics.'}
    ];

    function role(){return String(state.profile&&state.profile.role||'').toLowerCase();}
    function isAdmin(){
      return role()==='admin' &&
        state.profile &&
        state.profile.report_only!==true &&
        !(state.offline||state.uiMode==='user');
    }

    function identifyCards(){
      Array.from(view.children).forEach(function(el){
        if(!el.classList||!el.classList.contains('section-card'))return;
        var h=el.querySelector('h3');
        if(!h)return;
        var key=sectionMap[String(h.textContent||'').trim().toLowerCase()];
        if(key)el.dataset.adminSectionV21083=key;
      });
    }

    function ensureLanding(){
      var landing=document.getElementById('adminHomeV21083');
      if(landing)return landing;

      landing=document.createElement('section');
      landing.id='adminHomeV21083';
      landing.className='admin-home-v21083';
      landing.innerHTML=
        '<div class="admin-home-head-v21083">'+
          '<h3>Admin sections</h3>'+
          '<p>Choose a section. Only the controls you need are shown, instead of one long Admin page.</p>'+
        '</div>'+
        '<div class="admin-tile-grid-v21083">'+
          tiles.map(function(t){
            return '<button type="button" class="admin-tile-v21083" data-admin-tile-v21083="'+t.key+'">'+
              '<span class="admin-tile-icon-v21083" aria-hidden="true">'+t.icon+'</span>'+
              '<span class="admin-tile-copy-v21083"><strong>'+t.title+'</strong><small>'+t.desc+'</small></span>'+
            '</button>';
          }).join('')+
        '</div>';

      var heading=view.querySelector('.page-heading');
      if(heading)heading.insertAdjacentElement('afterend',landing);
      else view.insertAdjacentElement('afterbegin',landing);
      return landing;
    }

    function ensureBack(){
      var btn=document.getElementById('adminSectionBackV21083');
      if(btn)return btn;
      btn=document.createElement('button');
      btn.id='adminSectionBackV21083';
      btn.type='button';
      btn.className='secondary admin-section-back-v21083';
      btn.textContent='← Admin sections';
      btn.hidden=true;
      var landing=ensureLanding();
      landing.insertAdjacentElement('afterend',btn);
      return btn;
    }

    function render(){
      if(!isAdmin())return;
      identifyCards();
      var landing=ensureLanding(),back=ensureBack();
      var cards=view.querySelectorAll('.section-card[data-admin-section-v21083]');

      if(!detailKey){
        landing.hidden=false;
        back.hidden=true;
        cards.forEach(function(card){card.hidden=true;});
      }else{
        landing.hidden=true;
        back.hidden=false;
        cards.forEach(function(card){
          card.hidden=card.dataset.adminSectionV21083!==detailKey;
        });
      }
    }

    function openSection(key){
      detailKey=key;
      render();
      try{window.scrollTo({top:0,behavior:'smooth'});}catch(_e){}
    }

    function openHome(){
      detailKey=null;
      render();
      try{window.scrollTo({top:0,behavior:'smooth'});}catch(_e){}
    }

    document.addEventListener('click',function(e){
      var tile=e.target.closest&&e.target.closest('[data-admin-tile-v21083]');
      if(tile){
        e.preventDefault();
        e.stopImmediatePropagation();
        openSection(tile.dataset.adminTileV21083);
        return;
      }

      if(e.target.closest&&e.target.closest('#adminSectionBackV21083')){
        e.preventDefault();
        e.stopImmediatePropagation();
        openHome();
        return;
      }

      if(e.target.closest&&(
        e.target.closest('[data-management-tile-key="admin"]') ||
        e.target.closest('[data-view="admin"]')
      )){
        detailKey=null;
        setTimeout(render,80);
      }
    },true);

    var wasActive=view.classList.contains('active');
    var viewObserver=new MutationObserver(function(){
      var active=view.classList.contains('active');
      if(active&&!wasActive){detailKey=null;setTimeout(render,0);}
      if(!active&&wasActive)detailKey=null;
      wasActive=active;
    });
    viewObserver.observe(view,{attributes:true,attributeFilter:['class']});

    var contentTimer=0;
    var contentObserver=new MutationObserver(function(){
      if(!view.classList.contains('active')||!isAdmin())return;
      clearTimeout(contentTimer);
      contentTimer=setTimeout(render,80);
    });
    contentObserver.observe(view,{childList:true,subtree:true});

    function installModalToastMirror(){
      var dialog=document.getElementById('modal');
      var toast=document.getElementById('toast');
      if(!dialog||!toast)return;

      function mirror(){
        var open=dialog.open;
        var visible=!toast.hidden && String(toast.textContent||'').trim();
        var box=document.getElementById('modalToastV21083');

        if(open&&visible){
          if(!box){
            box=document.createElement('div');
            box.id='modalToastV21083';
            box.className='modal-toast-v21083';
            var form=dialog.querySelector('form')||dialog;
            var head=form.querySelector('.modal-head');
            if(head)head.insertAdjacentElement('afterend',box);
            else form.insertAdjacentElement('afterbegin',box);
          }
          box.textContent=toast.textContent;
          box.hidden=false;
        }else if(box){
          box.hidden=true;
        }
      }

      new MutationObserver(mirror).observe(toast,{
        attributes:true,
        childList:true,
        subtree:true,
        characterData:true,
        attributeFilter:['hidden']
      });
      new MutationObserver(mirror).observe(dialog,{
        attributes:true,
        attributeFilter:['open']
      });
      dialog.addEventListener('close',mirror);
      mirror();
    }

    var style=document.createElement('style');
    style.id='adminSectionsStylesV21083';
    style.textContent=`
      .admin-home-v21083{margin:0 0 22px}
      .admin-home-v21083[hidden]{display:none!important}
      .admin-home-head-v21083{margin:4px 0 14px}
      .admin-home-head-v21083 h3{margin:0 0 5px;font-size:1.3rem}
      .admin-home-head-v21083 p{margin:0;color:var(--muted,#a6b1c2);line-height:1.4}
      .admin-tile-grid-v21083{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .admin-tile-v21083{min-width:0;min-height:118px;border:1px solid var(--border,#475569);border-radius:16px;background:var(--card,#1f1f1f);color:inherit;padding:14px;text-align:left;display:flex;align-items:flex-start;gap:11px;cursor:pointer}
      .admin-tile-v21083:hover,.admin-tile-v21083:focus-visible{border-color:#6f9bc5;box-shadow:0 0 0 2px rgba(74,124,170,.18)}
      .admin-tile-icon-v21083{flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#243b53;color:#fff;font-size:1.2rem;font-weight:900}
      .admin-tile-copy-v21083{min-width:0;display:flex;flex-direction:column;gap:5px}
      .admin-tile-copy-v21083 strong{font-size:1rem;line-height:1.18}
      .admin-tile-copy-v21083 small{color:var(--muted,#a6b1c2);font-size:.82rem;line-height:1.3}
      .admin-section-back-v21083{margin:0 0 14px}
      .modal-toast-v21083{margin:0 0 12px;padding:11px 12px;border:1px solid #b97920;border-radius:10px;background:#3b2a13;color:#ffe0a6;font-weight:700;line-height:1.35}
      @media(max-width:760px){
        .admin-tile-grid-v21083{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .admin-tile-v21083{min-height:108px;padding:12px 10px;gap:8px;border-radius:14px}
        .admin-tile-icon-v21083{flex-basis:34px;width:34px;height:34px;border-radius:10px;font-size:1rem}
        .admin-tile-copy-v21083 strong{font-size:.93rem}
        .admin-tile-copy-v21083 small{font-size:.75rem}
      }
      @media(max-width:390px){
        .admin-tile-v21083{min-height:104px;padding:10px 8px}
        .admin-tile-copy-v21083 small{font-size:.71rem}
      }
    `;
    document.head.appendChild(style);

    installModalToastMirror();
    [0,250,800,1800].forEach(function(ms){setTimeout(render,ms);});
    window.addEventListener('pageshow',function(){setTimeout(render,120);});

    window.SafetyAdminSectionsV21083={
      home:openHome,
      open:openSection,
      render:render
    };
  }

  boot();
})();
