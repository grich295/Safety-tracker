/* Safety Tracker v2.11.25 - scoped modal observer governor
   Loaded early to prevent legacy modalBody childList observer feedback loops. */
'use strict';
(function(){
  if(window.__SAFETY_MODAL_OBSERVER_GOVERNOR_V21125)return;
  window.__SAFETY_MODAL_OBSERVER_GOVERNOR_V21125=true;

  const ParentObserver=window.MutationObserver;
  if(typeof ParentObserver!=='function')return;

  class ModalGovernedObserver {
    constructor(callback){
      this._callback=callback;
      this._target=null;
      this._modal=false;
      this._pending=false;
      this._timer=0;
      this._suppressedUntil=0;
      this._latest=[];
      this._inner=new ParentObserver((records)=>{
        if(!this._modal){
          try{this._callback(records,this)}catch(e){setTimeout(()=>{throw e},0)}
          return;
        }
        const now=performance.now();
        if(now<this._suppressedUntil)return;
        this._latest=records;
        if(this._pending)return;
        this._pending=true;
        clearTimeout(this._timer);
        this._timer=setTimeout(()=>{
          this._pending=false;
          if(performance.now()<this._suppressedUntil)return;
          const rows=this._latest;
          this._latest=[];
          try{this._callback(rows,this)}
          catch(e){setTimeout(()=>{throw e},0)}
          finally{
            // Legacy approval decorators rewrite innerHTML inside their own callback.
            // Ignore those self-created mutations long enough to stop feedback loops.
            this._suppressedUntil=performance.now()+500;
          }
        },120);
      });
    }
    observe(target,options){
      this._target=target;
      this._modal=!!(target?.id==='modalBody' && options?.childList && options?.subtree);
      return this._inner.observe(target,options);
    }
    disconnect(){
      clearTimeout(this._timer);
      this._pending=false;
      this._latest=[];
      return this._inner.disconnect();
    }
    takeRecords(){return this._inner.takeRecords()}
  }

  window.MutationObserver=ModalGovernedObserver;
})();
