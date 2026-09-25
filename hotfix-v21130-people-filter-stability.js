/* Safety Tracker v2.11.30 - People filter dropdown stability
   Prevents the People toolbar from being replaced while a native select/search
   control is being used. The old v2.10.91 decorator rebuilt innerHTML on every
   decoration/DOM refresh, which collapses an open <select> immediately.
*/
'use strict';
(function(){
  if(window.__SAFETY_PEOPLE_FILTER_STABILITY_V21130)return;
  window.__SAFETY_PEOPLE_FILTER_STABILITY_V21130=true;

  let lastStatus='ACTIVE';
  let lastSearch='';

  const $=id=>document.getElementById(id);

  function readCurrent(){
    const s=$('peopleStatusV21091');
    const q=$('peopleSearchV21091');
    if(s)lastStatus=s.value||lastStatus;
    if(q)lastSearch=q.value??lastSearch;
  }

  function markStable(){
    const box=$('peopleFiltersV21091');
    if(!box)return;
    box.dataset.stableV21130='1';

    const s=$('peopleStatusV21091');
    const q=$('peopleSearchV21091');

    if(s){
      s.dataset.peopleStableV21130='1';
      if(document.activeElement!==s && lastStatus && s.value!==lastStatus){
        s.value=lastStatus;
      }
    }
    if(q){
      q.dataset.peopleStableV21130='1';
      if(document.activeElement!==q && q.value!==lastSearch){
        q.value=lastSearch;
      }
    }
  }

  /*
    Capture the user's intended value before legacy change/input handlers run.
    That way a later decoration can restore the same value without replacing
    the currently active element.
  */
  document.addEventListener('pointerdown',e=>{
    if(e.target?.id==='peopleStatusV21091'||e.target?.id==='peopleSearchV21091'){
      readCurrent();
      document.documentElement.classList.add('people-filter-interacting-v21130');
    }
  },true);

  document.addEventListener('focusin',e=>{
    if(e.target?.id==='peopleStatusV21091'||e.target?.id==='peopleSearchV21091'){
      readCurrent();
      document.documentElement.classList.add('people-filter-interacting-v21130');
    }
  },true);

  document.addEventListener('input',e=>{
    if(e.target?.id==='peopleSearchV21091'){
      lastSearch=e.target.value||'';
    }
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.id==='peopleStatusV21091'){
      lastStatus=e.target.value||'ACTIVE';
      // Do not let a subsequent decoration reset the newly selected value.
      requestAnimationFrame(markStable);
      setTimeout(markStable,80);
    }
  },true);

  document.addEventListener('focusout',e=>{
    if(e.target?.id==='peopleStatusV21091'||e.target?.id==='peopleSearchV21091'){
      readCurrent();
      setTimeout(()=>{
        document.documentElement.classList.remove('people-filter-interacting-v21130');
        markStable();
      },120);
    }
  },true);

  /*
    Key repair:
    The v2.10.91 toolbar lives immediately before #peopleList. If a legacy
    decoration replaces the toolbar while its search/select has focus, keep
    the active control alive by restoring it into the new toolbar.
  */
  let preserved=null;
  function preserveActiveControl(){
    const active=document.activeElement;
    if(!active || !['peopleStatusV21091','peopleSearchV21091'].includes(active.id))return;
    const box=$('peopleFiltersV21091');
    if(!box||!box.contains(active))return;

    readCurrent();
    preserved={
      id:active.id,
      node:active,
      selectionStart:typeof active.selectionStart==='number'?active.selectionStart:null,
      selectionEnd:typeof active.selectionEnd==='number'?active.selectionEnd:null
    };
  }

  /*
    A small scoped observer watches only the People view. It never rewrites the
    People cards. If the toolbar itself was replaced during interaction, it
    swaps the original focused native control back in immediately.
  */
  function repairAfterMutation(){
    const box=$('peopleFiltersV21091');
    if(!box)return;

    if(preserved){
      const replacement=$(preserved.id);
      if(replacement && replacement!==preserved.node){
        replacement.replaceWith(preserved.node);
        try{
          preserved.node.focus({preventScroll:true});
          if(preserved.id==='peopleSearchV21091' &&
             preserved.selectionStart!=null &&
             typeof preserved.node.setSelectionRange==='function'){
            preserved.node.setSelectionRange(preserved.selectionStart,preserved.selectionEnd);
          }
        }catch(_e){}
      }
    }
    markStable();
  }

  function bootObserver(){
    const view=$('peopleView');
    if(!view){setTimeout(bootObserver,150);return}

    const NativeObserver=window.MutationObserver;
    if(typeof NativeObserver==='function'){
      const mo=new NativeObserver(()=>{
        if(document.documentElement.classList.contains('people-filter-interacting-v21130')){
          preserveActiveControl();
          queueMicrotask(repairAfterMutation);
        }else{
          queueMicrotask(markStable);
        }
      });
      mo.observe(view,{childList:true,subtree:true});
    }

    [0,120,400,900].forEach(ms=>setTimeout(()=>{
      readCurrent();
      markStable();
    },ms));
  }

  /*
    Block pointer events from bubbling to card/view click handlers. Native
    select behaviour is retained because preventDefault is deliberately not used.
  */
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#peopleStatusV21091,#peopleSearchV21091')){
      e.stopPropagation();
    }
  },true);

  const style=document.createElement('style');
  style.id='peopleFilterStabilityStylesV21130';
  style.textContent=`
    #peopleFiltersV21091 select,
    #peopleFiltersV21091 input{
      pointer-events:auto!important;
      touch-action:manipulation;
    }
    html.people-filter-interacting-v21130 #peopleFiltersV21091{
      overflow-anchor:none!important;
    }
  `;
  document.head.appendChild(style);

  bootObserver();

  window.SafetyPeopleFilterStabilityV21130={
    markStable,
    readCurrent
  };
})();