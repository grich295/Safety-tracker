/* Safety Tracker v2.11.26 - nested scroll isolation */
'use strict';
(function(){
  if(window.__SAFETY_SCROLL_ISOLATION_V21126)return;
  window.__SAFETY_SCROLL_ISOLATION_V21126=true;

  const selectors=[
    '.modal form',
    '.checkbox-list',
    '.link-results',
    '.ppe-catalogue-list',
    '.creator-source-list',
    '.demo-modal-card'
  ].join(',');

  function scrollable(el){
    if(!el)return false;
    const s=getComputedStyle(el);
    return /(auto|scroll)/.test(s.overflowY||'') && el.scrollHeight>el.clientHeight+2;
  }

  function nearest(target){
    const el=target?.closest?.(selectors);
    return scrollable(el)?el:null;
  }

  function canConsume(el,dy){
    if(!el||!dy)return false;
    if(dy<0)return el.scrollTop>0;
    return el.scrollTop+el.clientHeight<el.scrollHeight-1;
  }

  window.addEventListener('wheel',e=>{
    const el=nearest(e.target);
    if(el&&canConsume(el,e.deltaY))e.stopPropagation();
  },{capture:true,passive:true});

  let touchY=null;
  window.addEventListener('touchstart',e=>{
    touchY=e.touches?.[0]?.clientY??null;
  },{capture:true,passive:true});

  window.addEventListener('touchmove',e=>{
    const el=nearest(e.target);
    const y=e.touches?.[0]?.clientY;
    if(!el||touchY===null||typeof y!=='number')return;
    const dy=touchY-y;
    touchY=y;
    if(canConsume(el,dy))e.stopPropagation();
  },{capture:true,passive:true});

  const style=document.createElement('style');
  style.id='safetyScrollIsolationStylesV21126';
  style.textContent=`
    .modal form,
    .checkbox-list,
    .link-results,
    .ppe-catalogue-list,
    .creator-source-list,
    .demo-modal-card{
      overscroll-behavior:contain!important;
      -webkit-overflow-scrolling:touch;
    }
    html,body{overscroll-behavior-y:none}
  `;
  document.head.appendChild(style);
})();