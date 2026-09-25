/* Safety Tracker v2.11.41 - People page flicker/dropdown root fix
   The remaining flicker was traced to v2.10.91:
   - its body-wide MutationObserver repeatedly called decoratePeople()
   - decoratePeople() called ensurePeopleToolbar()
   - ensurePeopleToolbar() replaced the Search/Status controls with innerHTML each time
   This is especially visible on Android and collapses an open native select.

   This guard loads BEFORE v2.10.91 and:
   1) blocks that specific body-wide feedback observer (plus the later People/Management broad observers),
   2) prevents the v2.10.91 People filter toolbar from being rebuilt once its controls already exist.
   Scoped observers, modal observers and normal People rendering remain enabled.
*/
'use strict';
(function(){
  if(window.__SAFETY_PEOPLE_FLICKER_ROOT_V21141)return;
  window.__SAFETY_PEOPLE_FLICKER_ROOT_V21141=true;

  function install(){
    if(!window.__SAFETY_RUNTIME_STABILITY_V21113 ||
       !window.__SAFETY_MODAL_OBSERVER_GOVERNOR_V21125){
      setTimeout(install,25);
      return;
    }
    if(window.__SAFETY_PEOPLE_FLICKER_ROOT_V21141_INSTALLED)return;
    window.__SAFETY_PEOPLE_FLICKER_ROOT_V21141_INSTALLED=true;

    const ParentObserver=window.MutationObserver;
    if(typeof ParentObserver==='function'){
      class PeopleStableObserver {
        constructor(callback){
          this._callback=callback;
          this._inner=new ParentObserver(callback);
          let src='';
          try{src=Function.prototype.toString.call(callback)}catch(_e){}
          this._blockBroadBody =
            (/ensureReportScopeUi/.test(src) && /decoratePeople/.test(src)) ||
            (/decorateLogin/.test(src) && /applyWorkingView/.test(src)) ||
            /^\s*\(?\s*\)?\s*=>\s*queue\(\)\s*$/.test(src) ||
            /=>\s*\{\s*queue\(\)\s*;?\s*\}/.test(src);
        }
        observe(target,options){
          const broadBody =
            target===document.body &&
            options?.childList===true &&
            options?.subtree===true;
          if(broadBody && this._blockBroadBody)return;
          return this._inner.observe(target,options);
        }
        disconnect(){return this._inner.disconnect()}
        takeRecords(){return this._inner.takeRecords()}
      }
      window.MutationObserver=PeopleStableObserver;
    }

    // v2.10.91 uses box.innerHTML=... every time decoratePeople() runs.
    // Keep the existing native controls alive once created.
    try{
      const proto=Element.prototype;
      const desc=Object.getOwnPropertyDescriptor(proto,'innerHTML');
      if(desc?.get && desc?.set && !proto.__safetyPeopleInnerHtmlV21141){
        Object.defineProperty(proto,'__safetyPeopleInnerHtmlV21141',{
          value:true,configurable:true
        });
        Object.defineProperty(proto,'innerHTML',{
          configurable:desc.configurable,
          enumerable:desc.enumerable,
          get:desc.get,
          set:function(value){
            try{
              if(this?.id==='peopleFiltersV21091' &&
                 this.querySelector?.('#peopleSearchV21091') &&
                 this.querySelector?.('#peopleStatusV21091') &&
                 String(value||'').includes('peopleSearchV21091') &&
                 String(value||'').includes('peopleStatusV21091')){
                return;
              }
            }catch(_e){}
            return desc.set.call(this,value);
          }
        });
      }
    }catch(e){
      console.warn('People filter stability setter',e);
    }

    // Native controls must never be treated as card/navigation taps.
    const stopNative=e=>{
      if(e.target?.matches?.('#peopleSearchV21091,#peopleStatusV21091,#peopleFiltersV21091 option')){
        e.stopPropagation();
      }
    };
    document.addEventListener('pointerdown',stopNative,true);
    document.addEventListener('click',stopNative,true);

    const style=document.createElement('style');
    style.id='safetyPeopleStableStylesV21141';
    style.textContent=`
      #peopleFiltersV21091 input,
      #peopleFiltersV21091 select{
        pointer-events:auto!important;
        touch-action:manipulation!important;
      }
      #peopleView.active-view{
        overflow-anchor:none!important;
      }
    `;
    document.head.appendChild(style);

    // Finite lifecycle refreshes replace the removed broad observers.
    const refresh=()=>{
      try{window.SafetyReportEvidenceRetentionV21091?.decoratePeople?.()}catch(_e){}
      try{window.SafetyPeopleFilterStabilityV21130?.markStable?.()}catch(_e){}
    };
    document.addEventListener('click',e=>{
      if(e.target.closest?.('#mainNav [data-view="people"],[data-management-stable-action="view:people"],.management-back-v21111')){
        setTimeout(refresh,120);
        setTimeout(refresh,450);
      }
    },false);
    window.addEventListener('pageshow',()=>setTimeout(refresh,180));

    try{
      window.SafetyRuntimeStabilityV21113?.record?.(
        'v21141-people-flicker-root',
        'v2.10.91 broad People observer and repeated filter-toolbar replacement guarded.',
        'Android native select/search stability repair active.'
      );
    }catch(_e){}
  }

  install();
})();
