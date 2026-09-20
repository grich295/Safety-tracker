/* Safety Tracker v2.10.82 - asbestos modal focus fix */
'use strict';
(function(){
  if(window.__ASBESTOS_MODAL_V21082)return;
  window.__ASBESTOS_MODAL_V21082=true;

  function install(){
    var dialog=document.getElementById('modal');
    var title=document.getElementById('modalTitle');
    if(!dialog||!title){setTimeout(install,120);return;}

    var style=document.getElementById('asbestosModalStyleV21082');
    if(!style){
      style=document.createElement('style');
      style.id='asbestosModalStyleV21082';
      style.textContent=`
        #modal.asbestos-focus-v21082{
          background:var(--panel,#fff);
          color:var(--text,#17212b);
          opacity:1;
          isolation:isolate;
          overscroll-behavior:contain;
          box-shadow:0 28px 80px rgba(0,0,0,.62);
        }
        #modal.asbestos-focus-v21082::backdrop{
          background:rgba(0,0,0,.92);
          backdrop-filter:blur(4px);
          -webkit-backdrop-filter:blur(4px);
        }
        #modal.asbestos-focus-v21082 form{
          background:var(--panel,#fff);
          opacity:1;
          overscroll-behavior:contain;
        }
        @media (max-width:700px){
          #modal.asbestos-focus-v21082{
            width:100vw;
            max-width:100vw;
            height:100dvh;
            max-height:100dvh;
            margin:0;
            border-radius:0;
          }
          #modal.asbestos-focus-v21082 form{
            box-sizing:border-box;
            height:100%;
            max-height:100dvh;
            overflow:auto;
            padding:14px 12px calc(18px + env(safe-area-inset-bottom));
          }
          #modal.asbestos-focus-v21082 .modal-head{
            position:sticky;
            top:0;
            z-index:2;
            background:var(--panel,#fff);
            padding:4px 0 10px;
          }
          #modal.asbestos-focus-v21082 .actions{
            position:sticky;
            bottom:0;
            z-index:2;
            background:var(--panel,#fff);
            padding:10px 0 max(6px,env(safe-area-inset-bottom));
          }
        }
      `;
      document.head.appendChild(style);
    }

    function sync(){
      var t=(title.textContent||'').trim().toLowerCase();
      var asbestos =
        t.includes('asbestos import review') ||
        t.includes('review asbestos finding') ||
        t.includes('asbestos evidence');
      dialog.classList.toggle('asbestos-focus-v21082',asbestos && dialog.open);
    }

    new MutationObserver(sync).observe(title,{childList:true,subtree:true,characterData:true});
    new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']});
    dialog.addEventListener('close',function(){dialog.classList.remove('asbestos-focus-v21082');});
    sync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
