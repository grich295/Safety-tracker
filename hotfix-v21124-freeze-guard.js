/* Safety Tracker v2.11.24 - passive freeze diagnostics */
'use strict';
(function(){
  if(window.__SAFETY_FREEZE_GUARD_V21124)return;
  window.__SAFETY_FREEZE_GUARD_V21124=true;

  const KEY='safety_long_tasks_v21124';

  function save(row){
    try{
      const rows=JSON.parse(localStorage.getItem(KEY)||'[]');
      rows.push(row);
      while(rows.length>20)rows.shift();
      localStorage.setItem(KEY,JSON.stringify(rows));
    }catch(_e){}
  }

  try{
    if('PerformanceObserver' in window){
      const po=new PerformanceObserver(list=>{
        for(const e of list.getEntries()){
          if(Number(e.duration||0)>=250){
            save({
              at:new Date().toISOString(),
              duration_ms:Math.round(e.duration||0),
              view:document.querySelector('.view.active-view')?.id||'',
              modal:document.getElementById('modal')?.open===true
            });
          }
        }
      });
      po.observe({type:'longtask',buffered:true});
    }
  }catch(_e){}

  window.SafetyFreezeGuardV21124={
    diagnostics:()=>{
      try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_e){return []}
    },
    clear:()=>{try{localStorage.removeItem(KEY)}catch(_e){}}
  };
})();
