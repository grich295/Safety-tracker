window.SAFETY_TRACKER_CONFIG = {
  supabaseUrl: "https://qvgcralroduuoptbnctt.supabase.co",
  supabaseKey: "sb_publishable_RNVM7b_qqOIUDdnVjZqtzg_JzTih75_"
};

(function(){
  if(window.__SAFETY_HOTFIX_LOADER_V21113_CONFIGURED)return;
  window.__SAFETY_HOTFIX_LOADER_V21113_CONFIGURED=true;

  const scripts=[
      ['hotfix-v21113-runtime-stability.js','v21113-runtime-stability'],
      ['hotfix-v21125-modal-observer-governor.js','v21125-modal-observer-governor'],
      ['hotfix-v21140-flicker-guard.js','v21140-flicker-guard'],
      ['hotfix-v21055-training-packs.js','v21055-training-packs'],
      ['hotfix-v21056-review-audit.js','v21056-review-audit'],
      ['hotfix-v21057-linked-impact.js','v21057-linked-impact'],
      ['hotfix-v21058-app-created-ssw-revision.js','v21058-ssw-revision'],
      ['hotfix-v21059-app-created-tbt-revision.js','v21059-tbt-revision'],
      ['hotfix-v21060-refresher-method.js','v21060-refresher-method'],
      ['hotfix-v21061-retrain-now.js','v21061-retrain-now'],
      ['hotfix-v21062-revision-training-impact.js','v21062-revision-training-impact'],
      ['hotfix-v21063-pack-version-awareness.js','v21063-pack-version-awareness'],
      ['hotfix-v21064-source-training-guard.js','v21064-source-training-guard'],
      ['hotfix-v21065-strictest-method-wins.js','v21065-strictest-method-wins'],
      ['hotfix-v21066-temporary-unsuitable.js','v21066-temporary-unsuitable'],
      ['hotfix-v21067-change-control-workflow.js','v21067-change-control-workflow'],
      ['hotfix-v21068-regression-hardening.js','v21068-regression-hardening'],
      ['hotfix-v21069-positions-responsibilities.js','v21071-hs-officer-notice'],
      ['hotfix-v21072-calendar-label-dedupe.js','v21072-calendar-label-dedupe'],
      ['hotfix-v21073-register-downloads.js','v21073-register-downloads'],
      ['hotfix-v21074-register-pdf-pages.js','v21074-register-pdf-pages'],
      ['hotfix-v21075-document-creation-toggle.js','v21075-document-creation-toggle'],
      ['hotfix-v21076-help-document-links.js','v21076-help-document-links'],
      ['hotfix-v21077-creator-employees.js','v21077-creator-employees'],
      ['hotfix-v21078-ssw-ppe-tools.js','v21078-ssw-ppe-tools'],
      ['hotfix-v21086-asbestos-catalogue.js','v21086-asbestos-catalogue'],
      ['hotfix-v21080-asbestos.js','v21081-asbestos-parser'],
      ['hotfix-v21082-asbestos-modal.js','v21082-asbestos-modal'],
      ['hotfix-v21083-admin-sections.js','v21103-admin-sections-location-fix'],
      ['hotfix-v21084-tile-routes.js','v21084-tile-routes'],
      ['hotfix-v21085-admin-grouping.js','v21103-admin-grouping-location-fix'],
      ['hotfix-v21088-asbestos-full-analysis.js','v21088-asbestos-full-analysis'],
      ['hotfix-v21087-asbestos-source-tools.js','v21088-asbestos-source-tools'],
      ['hotfix-v21089-site-location-tile.js','v21089-site-location-tile'],
      ['hotfix-v21090-responsibility-location-tree.js','v21090-responsibility-location-tree'],
      ['hotfix-v21091-report-evidence-retention.js','v21091-report-evidence-retention'],
      ['hotfix-v21092-incident-review.js','v21092-incident-review'],
      ['hotfix-v21093-asbestos-location-cleanup.js','v21093-asbestos-location-cleanup'],
      ['hotfix-v21094-report-scope.js','v21094-report-scope'],
      ['hotfix-v21095-repair-bundle.js','v21095-repair-bundle'],
      ['hotfix-v21096-site-location-test-cleanup.js','v21096-site-location-test-cleanup'],
      ['hotfix-v21102-site-location-search.js','v21103-authoritative-search'],
      ['hotfix-v21105-asbestos-evidence-audit.js','v21105-asbestos-evidence-audit'],
      ['hotfix-v21106-asbestos-workflow.js','v21106-asbestos-workflow'],
      ['hotfix-v21107-asbestos-history-library.js','v21107-asbestos-history-library'],
      ['hotfix-v21108-asbestos-intelligence.js','v21108-asbestos-intelligence'],
      ['hotfix-v21110-user-access-save-repair.js','v21110-user-access-save-repair'],
      ['hotfix-v21111-management-stability.js','v21111-management-stability'],
      ['hotfix-v21114-contractor-multi-area.js','v21114-contractor-multi-area'],
      ['hotfix-v21115-auto-link-repair.js','v21115-auto-link-repair'],
      ['hotfix-v21116-bulk-metadata.js','v21116-bulk-metadata'],
      ['hotfix-v21118-training-history-excel.js','v21118-training-history-excel'],
      ['hotfix-v21119-generic-document-folders.js','v21119-generic-document-folders'],
      ['hotfix-v21119-department-leads.js','v21119-department-leads'],
      ['hotfix-v21120-approval-review-date.js','v21120-approval-review-date'],
      ['hotfix-v21121-generic-doc-controls.js','v21121-generic-doc-controls'],
      ['hotfix-v21122-approval-training-restore.js','v21122-approval-training-restore'],
      ['hotfix-v21124-freeze-guard.js','v21124-freeze-guard'],
      ['hotfix-v21125-admin-approval.js','v21125-admin-approval'],
      ['hotfix-v21126-scroll-isolation.js','v21126-scroll-isolation'],
      ['hotfix-v21128-generic-audience-layout.js','v21128-generic-audience-layout'],
      ['hotfix-v21130-people-filter-stability.js','v21130-people-filter-stability'],
      ['hotfix-v21131-approval-move-repair.js','v21131-approval-move-repair'],
      ['hotfix-v21132-assignment-audit.js','v21132-assignment-audit'],
      ['hotfix-v21134-simple-owner.js','v21134-simple-owner'],
      ['hotfix-v21135-first-aid-equipment.js','v21135-first-aid-equipment'],
      ['hotfix-v21136-first-aid-default-types.js','v21136-first-aid-default-types'],
      ['hotfix-v21137-people-access.js','v21137-people-access'],
      ['hotfix-v21139-management-stability.js','v21139-management-stability']
  ];
  const loaded=new Set();
  let started=false;
  let waiter=0;

  function record(type,msg,extra){
    try{window.SafetyRuntimeStabilityV21113?.record?.(type,msg,extra)}catch(_e){}
  }

  function loadOne(src,token,attempt=0){
    return new Promise(resolve=>{
      if(loaded.has(src))return resolve(true);
      const existing=document.querySelector(`script[data-safety-loader-v21113="${src}"]`);
      if(existing?.dataset.loaded==='1'){loaded.add(src);return resolve(true)}
      const s=existing||document.createElement('script');
      if(!existing){
        const build=window.SAFETY_BUILD?.build_id||window.SAFETY_BUILD?.version||'v21140';
        s.src=`${src}?v=${encodeURIComponent(token+'-'+build)}`;
        s.async=false;
        s.dataset.safetyLoaderV21113=src;
        (document.body||document.head||document.documentElement).appendChild(s);
      }
      s.onload=()=>{s.dataset.loaded='1';loaded.add(src);resolve(true)};
      s.onerror=()=>{
        try{s.remove()}catch(_e){}
        if(attempt<1)setTimeout(()=>loadOne(src,token,attempt+1).then(resolve),500);
        else{record('hotfix-load-failed',src,'Loader continued after two attempts.');resolve(false)}
      };
    });
  }

  async function start(){
    if(started)return;
    const core=window.SafetyTrackerV2;
    if(!core||!core.navigationTidyV21044){
      clearTimeout(waiter);
      waiter=setTimeout(start,120);
      return;
    }
    started=true;
    window.__SAFETY_HOTFIX_LOADER_V21113_STARTED=true;
    for(const [src,token] of scripts)await loadOne(src,token);
    window.__SAFETY_HOTFIX_LOADER_V21113_COMPLETE=true;
    try{window.applySafetyBuildLabel?.()}catch(_e){}
  }

  setTimeout(start,0);
  window.addEventListener('pageshow',()=>{if(!started)setTimeout(start,0)},{once:true});
})();
