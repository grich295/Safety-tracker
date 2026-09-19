/* Safety Tracker v2.10.72 - calendar display de-duplication */
'use strict';
(function(){
  if(window.__SAFETY_V21072_CALENDAR_DEDUPE)return;
  window.__SAFETY_V21072_CALENDAR_DEDUPE=true;

  function cleanRepeatedReference(text){
    const s=String(text||'').trim();
    // Example:
    // "SSW-001 · SSW-001 - Shower Head Descaler & Sanitiser"
    // becomes:
    // "SSW-001 · Shower Head Descaler & Sanitiser"
    return s.replace(
      /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\s*·\s*\1\s*[-–—:]\s*/i,
      '$1 · '
    );
  }

  function tidyCalendar(){
    const root=document.getElementById('safetyCalendarAgendaV21043');
    if(!root)return;
    root.querySelectorAll('.item-card strong').forEach(el=>{
      const next=cleanRepeatedReference(el.textContent);
      if(next!==el.textContent)el.textContent=next;
    });
  }

  const obs=new MutationObserver(()=>setTimeout(tidyCalendar,0));
  function start(){
    tidyCalendar();
    const root=document.getElementById('safetyCalendarAgendaV21043');
    if(root)obs.observe(root,{childList:true,subtree:true});
    else setTimeout(start,250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-nav-hub-action="management:calendar"], [data-nav-hub-key="calendar"], #calendarPrevV21043, #calendarNextV21043, #calendarTodayV21043, [data-calendar-day], #safetyCalendarClearDayV21043')){
      setTimeout(tidyCalendar,120);
    }
  },true);

  window.SafetyCalendarLabelDedupeV21072={cleanRepeatedReference,tidyCalendar};
})();
