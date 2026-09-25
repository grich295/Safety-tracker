/* Safety Tracker v2.11.40 - mobile flicker guard
   Targets the two late body-wide DOM observers introduced by People & Access
   and Management stability. They repeatedly re-ran UI decorators after their
   own DOM changes, which can make the whole Admin/Management page visibly
   flicker and can collapse native Android dropdowns.
*/
'use strict';
(function(){
  if(window.__SAFETY_FLICKER_GUARD_V21140)return;
  window.__SAFETY_FLICKER_GUARD_V21140=true;

  function install(){
    // Wait until the two existing observer governors have installed first.
    if(!window.__SAFETY_RUNTIME_STABILITY_V21113 ||
       !window.__SAFETY_MODAL_OBSERVER_GOVERNOR_V21125){
      setTimeout(install,25);
      return;
    }
    if(window.__SAFETY_FLICKER_GUARD_V21140_INSTALLED)return;
    window.__SAFETY_FLICKER_GUARD_V21140_INSTALLED=true;

    const ParentObserver=window.MutationObserver;
    if(typeof ParentObserver!=='function')return;

    class FlickerSafeObserver {
      constructor(callback){
        this._callback=callback;
        this._inner=new ParentObserver(callback);
        let src='';
        try{src=Function.prototype.toString.call(callback)}catch(_e){}
        // Only suppress the known late feedback observers. Do not interfere
        // with scoped modal, People-list, Admin-section or other observers.
        this._suppressBody=
          /applyWorkingView/.test(src) ||
          (/decorateLogin/.test(src) && /decoratePeople/.test(src)) ||
          /^\s*\(?\s*\)?\s*=>\s*queue\(\)\s*$/.test(src) ||
          /=>\s*\{\s*queue\(\)\s*;?\s*\}/.test(src);
      }
      observe(target,options){
        const broadBody =
          target===document.body &&
          options?.childList===true &&
          options?.subtree===true;
        if(broadBody && this._suppressBody){
          // Intentionally do not attach this observer. Both affected modules
          // already have finite startup timers and click/navigation handlers.
          return;
        }
        return this._inner.observe(target,options);
      }
      disconnect(){return this._inner.disconnect()}
      takeRecords(){return this._inner.takeRecords()}
    }

    window.MutationObserver=FlickerSafeObserver;

    // Keep native controls isolated from card/navigation capture handlers.
    document.addEventListener('pointerdown',e=>{
      if(e.target?.matches?.('select,input,textarea,option')){
        e.stopPropagation();
      }
    },true);

    const style=document.createElement('style');
    style.id='safetyFlickerGuardStylesV21140';
    style.textContent=`
      #adminView select,#adminView input,#adminView textarea,
      #reportsView select,#reportsView input,#reportsView textarea,
      #peopleView select,#peopleView input,#peopleView textarea{
        pointer-events:auto!important;
        touch-action:manipulation!important;
      }
      #adminView.active-view,#reportsView.active-view,#peopleView.active-view{
        contain:layout style;
      }
    `;
    document.head.appendChild(style);

    try{
      window.SafetyRuntimeStabilityV21113?.record?.(
        'v21140-flicker-guard',
        'Late body-wide People/Management DOM observers disabled.',
        'Native dropdown stability guard active.'
      );
    }catch(_e){}
  }

  install();
})();
