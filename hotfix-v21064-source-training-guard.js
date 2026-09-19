/* Safety Tracker v2.10.64 CLEAN
   Guard auto-managed source training so only approved/current controlled versions can be active.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21064_BOOT_REQUESTED)return;
  window.__SAFETY_V21064_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof loadAll==='function' &&
      !!window.SafetyPackVersionAwarenessV21063 &&
      !!window.__SAFETY_V21063_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21064_INSTALLED)return;
    window.__SAFETY_V21064_INSTALLED=true;

    const BUILD='2.10.64';
    const core={loadAll};
    let checked=false;

    const manager64=()=>{try{return !!isManager()}catch(_e){return false}};
    const online64=()=>!state.offline&&navigator.onLine;

    async function cleanup64(){
      if(checked||!manager64()||!online64())return 0;
      checked=true;
      try{
        const r=await sb.rpc('cleanup_unapproved_auto_training_v21064');
        if(r.error){console.warn('Source training cleanup',r.error);return 0}
        return Number(r.data||0);
      }catch(e){
        console.warn('Source training cleanup',e);
        return 0;
      }
    }

    loadAll=async function(){
      let out=await core.loadAll.apply(this,arguments);
      const cleaned=await cleanup64();
      if(cleaned>0){
        out=await core.loadAll.apply(this,arguments);
        try{toast(`${cleaned} invalid legacy source-training record${cleaned===1?' was':'s were'} archived.`)}catch(_e){}
      }
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    cleanup64();

    window.SafetySourceTrainingGuardV21064={
      BUILD,
      cleanup:cleanup64
    };
  }

  boot();
})();
