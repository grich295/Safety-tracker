/* Safety Tracker v2.11.13 - runtime stability governor
   Prevents broad DOM MutationObserver feedback loops from starving/crashing mobile browsers.
   Loaded BEFORE the additive hotfix chain. */
'use strict';
(function(){
  if(window.__SAFETY_RUNTIME_STABILITY_V21113)return;
  window.__SAFETY_RUNTIME_STABILITY_V21113=true;

  const BUILD='v2.11.13';
  const NativeMutationObserver=window.MutationObserver;
  const observerStats=[];
  const ERROR_KEY='safety_stability_errors_v21113';

  function safeText(v,max=1200){
    try{
      const s=String(v??'');
      return s.length>max?s.slice(0,max)+'…':s;
    }catch(_e){return ''}
  }

  function readErrors(){
    try{
      const x=JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');
      return Array.isArray(x)?x:[];
    }catch(_e){return []}
  }

  function record(type,message,extra){
    try{
      const rows=readErrors();
      rows.push({
        at:new Date().toISOString(),
        type:safeText(type,80),
        message:safeText(message,900),
        extra:safeText(extra,1400),
        build:String(window.SAFETY_BUILD?.version||BUILD)
      });
      while(rows.length>30)rows.shift();
      localStorage.setItem(ERROR_KEY,JSON.stringify(rows));
    }catch(_e){}
  }

  function broadTarget(target,options){
    if(!target||!options?.childList||!options?.subtree)return false;
    return target===document.body ||
      target.id==='appView' ||
      target.id==='reportsView';
  }

  if(typeof NativeMutationObserver==='function'){
    class GovernedMutationObserver {
      constructor(callback){
        if(typeof callback!=='function')throw new TypeError('MutationObserver callback must be a function');
        this._callback=callback;
        this._target=null;
        this._options=null;
        this._broad=false;
        this._pending=false;
        this._suppressedUntil=0;
        this._latest=[];
        this._timer=0;
        this._stat={
          id:observerStats.length+1,
          target:'',
          broad:false,
          native_batches:0,
          delivered:0,
          suppressed:0
        };
        observerStats.push(this._stat);

        this._native=new NativeMutationObserver((records)=>{
          this._stat.native_batches++;
          if(!this._broad){
            this._stat.delivered++;
            try{this._callback(records,this)}catch(e){record('observer-callback',e?.message||e,e?.stack||'');throw e}
            return;
          }

          const now=performance.now();
          if(now<this._suppressedUntil){
            this._stat.suppressed++;
            return;
          }

          this._latest=records;
          if(this._pending){
            this._stat.suppressed++;
            return;
          }

          this._pending=true;
          this._timer=setTimeout(()=>{
            this._pending=false;
            if(performance.now()<this._suppressedUntil){
              this._stat.suppressed++;
              return;
            }

            const rows=this._latest;
            this._latest=[];
            this._stat.delivered++;
            try{
              this._callback(rows,this);
            }catch(e){
              record('observer-callback',e?.message||e,e?.stack||'');
              setTimeout(()=>{throw e},0);
            }finally{
              /* The older additive modules often update innerHTML 40-80 ms after
                 their observer callback. Ignore those self-created mutations. */
              this._suppressedUntil=performance.now()+400;
            }
          },120);
        });
      }

      observe(target,options){
        this._target=target;
        this._options=options||{};
        this._broad=broadTarget(target,this._options);
        this._stat.target=target===document.body?'BODY':(target?.id||target?.tagName||'unknown');
        this._stat.broad=this._broad;
        return this._native.observe(target,options);
      }

      disconnect(){
        clearTimeout(this._timer);
        this._pending=false;
        this._latest=[];
        return this._native.disconnect();
      }

      takeRecords(){
        return this._native.takeRecords();
      }
    }

    window.MutationObserver=GovernedMutationObserver;
  }

  window.addEventListener('error',e=>{
    record('window-error',e?.message||'JavaScript error',
      `${e?.filename||''}:${e?.lineno||''}:${e?.colno||''}\n${e?.error?.stack||''}`);
  },true);

  window.addEventListener('unhandledrejection',e=>{
    const r=e?.reason;
    record('unhandled-rejection',r?.message||r||'Unhandled promise rejection',r?.stack||'');
  });

  function memorySnapshot(){
    const m=performance?.memory;
    if(!m)return null;
    return {
      used:m.usedJSHeapSize||0,
      total:m.totalJSHeapSize||0,
      limit:m.jsHeapSizeLimit||0
    };
  }

  function diagnostics(){
    return {
      build:BUILD,
      errors:readErrors(),
      observer_stats:observerStats.map(x=>({...x})),
      memory:memorySnapshot()
    };
  }

  function decorateDiagnostics(){
    const box=document.getElementById('buildDiagnostics');
    if(!box||document.getElementById('stabilityDiagV21113'))return;
    const d=document.createElement('div');
    d.id='stabilityDiagV21113';
    d.className='hint-box';
    d.style.marginTop='10px';
    const errs=readErrors().length;
    d.innerHTML=`<strong>Runtime stability ${BUILD}</strong><br>
      Broad DOM observer feedback protection is active.
      ${errs?`<br><strong>${errs}</strong> JavaScript error/rejection event${errs===1?'':'s'} retained locally for diagnostics.`:'<br>No retained JavaScript errors in this browser session history.'}`;
    box.appendChild(d);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-admin-tile-v21083="diagnostics"],[data-view="admin"]')){
      setTimeout(decorateDiagnostics,160);
    }
  },true);
  window.addEventListener('pageshow',()=>setTimeout(decorateDiagnostics,500));

  window.SafetyRuntimeStabilityV21113={
    BUILD,
    record,
    diagnostics,
    clearErrors:()=>{try{localStorage.removeItem(ERROR_KEY)}catch(_e){}}
  };
})();
