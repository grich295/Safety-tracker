/* Safety Tracker v2.10.75 - Document Creation toggle key fix */
'use strict';
(function(){
  if(window.__SAFETY_V21075_DOC_CREATION_TOGGLE)return;
  window.__SAFETY_V21075_DOC_CREATION_TOGGLE=true;

  function boot(){
    const ready=
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof isManager==='function' &&
      typeof documentCreationEnabled==='function' &&
      typeof updateDocumentCreationUi==='function' &&
      typeof loadAll==='function' &&
      typeof toast==='function' &&
      typeof DOC_CREATION_SETTING!=='undefined';
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    async function toggleDocumentCreation75(){
      if(!isManager())return;
      if(state.offline||!navigator.onLine)return toast('Reconnect before changing Document Creation.');

      const next=!documentCreationEnabled();
      const payload={
        setting_key:DOC_CREATION_SETTING,
        setting_value:String(next),
        updated_at:new Date().toISOString()
      };

      const buttons=[...document.querySelectorAll('[data-toggle-document-creation]')];
      buttons.forEach(b=>b.disabled=true);

      try{
        const existing=(state.settings||[]).find(s=>s.setting_key===DOC_CREATION_SETTING);
        let r;

        // safety_tracker_settings is keyed by setting_key, not by an id column.
        // The previous code looked for existing.id, so it tried to INSERT an
        // already-existing key and raised safety_tracker_settings_pkey.
        if(existing){
          r=await sb.from('safety_tracker_settings')
            .update({
              setting_value:String(next),
              updated_at:payload.updated_at
            })
            .eq('setting_key',DOC_CREATION_SETTING)
            .select()
            .maybeSingle();
        }else{
          r=await sb.from('safety_tracker_settings')
            .insert(payload)
            .select()
            .maybeSingle();
        }

        if(r?.error)throw r.error;

        // Update immediately, then reload so every view uses the saved value.
        if(existing){
          existing.setting_value=String(next);
          existing.updated_at=payload.updated_at;
        }else if(r?.data){
          state.settings.push(r.data);
        }

        updateDocumentCreationUi();
        await loadAll();
        updateDocumentCreationUi();
        toast(`Document Creation turned ${next?'ON':'OFF'}. Existing records are unchanged.`);
      }catch(e){
        console.error('Document Creation toggle failed',e);
        toast('Could not change Document Creation. '+(e?.message||'Please refresh and try again.'));
      }finally{
        buttons.forEach(b=>b.disabled=false);
      }
    }

    try{toggleDocumentCreation=toggleDocumentCreation75}catch(_e){}
    window.toggleDocumentCreation=toggleDocumentCreation75;
    window.SafetyDocumentCreationToggleV21075={toggle:toggleDocumentCreation75};
  }

  boot();
})();
