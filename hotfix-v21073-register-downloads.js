/* Safety Tracker v2.10.73 - SSW and Toolbox Talk register download shortcuts */
'use strict';
(function(){
  if(window.__SAFETY_V21073_REGISTER_DOWNLOADS)return;
  window.__SAFETY_V21073_REGISTER_DOWNLOADS=true;

  function enhance(){
    const toolbar=document.querySelector('#documentsList .register-toolbar');
    if(!toolbar)return;
    let actions=toolbar.querySelector('.register-extra-actions-v21053');
    if(!actions){
      actions=document.createElement('div');
      actions.className='register-extra-actions-v21053';
      toolbar.appendChild(actions);
    }

    if(!actions.querySelector('[data-reg73="ssw"]')){
      const b=document.createElement('button');
      b.type='button'; b.className='secondary';
      b.dataset.reg73='ssw'; b.textContent='SSW downloads';
      actions.appendChild(b);
    }
    if(!actions.querySelector('[data-reg73="tbt"]')){
      const b=document.createElement('button');
      b.type='button'; b.className='secondary';
      b.dataset.reg73='tbt'; b.textContent='TBT downloads';
      actions.appendChild(b);
    }
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-reg73]');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    const kind=b.dataset.reg73;
    if(typeof window.openDocumentDownloadsV21054!=='function'){
      try{return (window.toast||window.SafetyTrackerV2?.toast)?.('Downloads screen is not available. Refresh once and try again.')}catch(_e){return}
    }
    if(kind==='ssw')return window.openDocumentDownloadsV21054('SSW','APPROVED_CURRENT');
    if(kind==='tbt')return window.openDocumentDownloadsV21054('TOOLBOX_TALK','APPROVED_CURRENT');
  },true);

  const obs=new MutationObserver(()=>setTimeout(enhance,0));
  function start(){
    enhance();
    const root=document.getElementById('documentsList');
    if(root)obs.observe(root,{childList:true,subtree:true});
    else setTimeout(start,250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  [100,400,1000,2000].forEach(ms=>setTimeout(enhance,ms));

  window.SafetyRegisterDownloadsV21073={enhance};
})();
