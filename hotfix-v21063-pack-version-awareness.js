/* Safety Tracker v2.10.63 CLEAN
   Make training-pack method decisions version-aware for every linked document.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21063_BOOT_REQUESTED)return;
  window.__SAFETY_V21063_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof loadAll==='function' &&
      typeof approvedCurrentVersion==='function' &&
      !!window.SafetyTrainingPacksV21055 &&
      !!window.SafetyRevisionTrainingImpactV21062 &&
      !!window.__SAFETY_V21062_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21063_INSTALLED)return;
    window.__SAFETY_V21063_INSTALLED=true;

    const BUILD='2.10.63';
    const STALE_SENTINEL='00000000-0000-0000-0000-000000000063';
    const core={loadAll};

    function same63(a,b){
      const A=[...(a||[])].map(x=>x==null?null:String(x));
      const B=[...(b||[])].map(x=>x==null?null:String(x));
      return A.length===B.length&&A.every((x,i)=>x===B[i]);
    }

    function snapshotState63(row){
      if(!row)return {valid:false,reason:'No decision'};
      if(!row._v63OriginalPackDocumentIds){
        row._v63OriginalPackDocumentIds=[...(row.pack_document_ids||[])];
      }
      const ids=row._v63OriginalPackDocumentIds;
      const saved=[...(row.pack_document_version_ids||[])];
      const current=ids.map(id=>{
        try{return approvedCurrentVersion(id)?.id||null}
        catch(_e){return null}
      });

      if(!saved.length)return {
        valid:false,
        reason:'This pack decision predates linked-version snapshots.',
        saved,current,ids
      };
      if(saved.length!==ids.length)return {
        valid:false,
        reason:'The pack version snapshot is incomplete.',
        saved,current,ids
      };
      if(!same63(saved,current))return {
        valid:false,
        reason:'One or more linked controlled-document versions changed.',
        saved,current,ids
      };
      return {valid:true,reason:'All linked controlled-document versions still match the recorded pack decision.',saved,current,ids};
    }

    function applyVersionValidity63(){
      const rows=state.trainingPackDecisions55||[];
      let stale=0;
      for(const row of rows){
        if(!row._v63OriginalPackDocumentIds){
          row._v63OriginalPackDocumentIds=[...(row.pack_document_ids||[])];
        }

        // Always restore the DB value first so repeated refreshes do not
        // accumulate the in-memory invalidation sentinel.
        row.pack_document_ids=[...row._v63OriginalPackDocumentIds];

        const check=snapshotState63(row);
        row._v63VersionValid=check.valid;
        row._v63VersionStale=!check.valid;
        row._v63VersionReason=check.reason;

        if(!check.valid){
          // v2.10.55 and v2.10.60 already treat a document-ID mismatch as a
          // stale pack decision. Add an in-memory-only impossible UUID so those
          // existing guarded paths also invalidate this decision when the IDs
          // are unchanged but a linked document VERSION changed.
          row.pack_document_ids.push(STALE_SENTINEL);
          stale++;
        }
      }
      state.trainingPackVersionStaleCount63=stale;
      return stale;
    }

    loadAll=async function(){
      const out=await core.loadAll.apply(this,arguments);
      applyVersionValidity63();
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    function enhancePackWarning63(){
      const rows=(state.trainingPackDecisions55||[]).filter(r=>r._v63VersionStale);
      if(!rows.length)return;
      const body=document.getElementById('modalBody');
      if(!body||document.getElementById('packVersionWarning63'))return;
      const staleShown=body.querySelector('.pending-use-warning');
      if(!staleShown)return;
      const box=document.createElement('div');
      box.id='packVersionWarning63';
      box.className='pending-use-warning';
      box.innerHTML='<strong>Linked version changed:</strong> this pack method decision no longer applies because at least one controlled document in the pack has moved to a different approved version. Review and save the pack method again.';
      staleShown.insertAdjacentElement('afterend',box);
    }

    const observer=new MutationObserver(()=>enhancePackWarning63());
    observer.observe(document.body,{childList:true,subtree:true});

    // The page may already have completed its first load before this additive
    // hotfix installs, so validate the currently loaded decision array now.
    applyVersionValidity63();

    window.SafetyPackVersionAwarenessV21063={
      BUILD,
      apply:applyVersionValidity63,
      check:snapshotState63
    };
  }

  boot();
})();
