/* Safety Tracker v2.10.76 - Help document shortcut routing */
'use strict';
(function(){
  if(window.__SAFETY_V21076_HELP_DOC_LINKS)return;
  window.__SAFETY_V21076_HELP_DOC_LINKS=true;

  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const notify=msg=>{
    try{return (window.toast||window.SafetyTrackerV2?.toast)?.(msg)}
    catch(_e){console.log(msg)}
  };

  function setValue(id,value){
    const el=document.getElementById(id);
    if(el)el.value=value;
    return el;
  }

  async function openDocuments76(mode='library'){
    try{
      if(typeof window.showView==='function')window.showView('documents');
      else if(typeof showView==='function')showView('documents');
      else document.querySelector('#mainNav button[data-view="documents"]')?.click();

      await wait(60);

      if(typeof state!=='undefined'){
        state.documentIndex='ALL';
      }
      setValue('documentSearch','');
      setValue('documentTypeFilter','');

      if(mode==='approvals')setValue('documentStatusFilter','PENDING');
      else setValue('documentStatusFilter','ACTIVE');

      try{if(typeof renderDocuments==='function')renderDocuments()}catch(_e){}

      await wait(100);

      if(mode==='approvals'){
        const target=document.getElementById('documentApprovalOverview');
        if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
      }else{
        document.getElementById('documentsView')?.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }catch(e){
      console.error('Help document shortcut',e);
      notify('Could not open Documents. '+(e?.message||'Please try again.'));
    }
  }

  async function openCreator76(){
    try{
      if(typeof documentCreationEnabled==='function'&&!documentCreationEnabled()){
        notify('Document Creation is currently OFF. Turn it on in Admin first.');
        return;
      }

      if(typeof window.showView==='function')window.showView('creator');
      else if(typeof showView==='function')showView('creator');
      else document.querySelector('#mainNav button[data-view="creator"]')?.click();

      await wait(60);
      try{if(typeof renderCreator==='function')renderCreator()}catch(_e){}
      await wait(60);
      document.getElementById('creatorView')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){
      console.error('Help create document shortcut',e);
      notify('Could not open Create Safety Document. '+(e?.message||'Please try again.'));
    }
  }

  async function openCreationSwitch76(){
    try{
      if(typeof window.showView==='function')window.showView('admin');
      else if(typeof showView==='function')showView('admin');
      else document.querySelector('#mainNav button[data-view="admin"]')?.click();

      for(let i=0;i<16;i++){
        const target=document.getElementById('adminDocumentCreationToggleBtn');
        if(target){
          (target.closest('.section-card')||target).scrollIntoView({behavior:'smooth',block:'center'});
          return;
        }
        await wait(120);
      }
      notify('Admin opened, but the Document Creation control is still loading.');
    }catch(e){
      console.error('Help document switch shortcut',e);
      notify('Could not open the Document Creation control. '+(e?.message||'Please try again.'));
    }
  }

  // The older Help module kept a private reference to the pre-navigation
  // showView function. Intercept only the document Help cards and route them
  // through the current live navigation instead.
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-role-help-go]');
    if(!b)return;
    const id=b.dataset.roleHelpGo;
    if(!['documents','approvals','create-doc','document-switch'].includes(id))return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if(id==='documents')return void openDocuments76('library');
    if(id==='approvals')return void openDocuments76('approvals');
    if(id==='create-doc')return void openCreator76();
    if(id==='document-switch')return void openCreationSwitch76();
  },true);

  window.SafetyHelpDocumentLinksV21076={
    openDocuments:openDocuments76,
    openCreator:openCreator76,
    openCreationSwitch:openCreationSwitch76
  };
})();
