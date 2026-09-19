window.SAFETY_TRACKER_CONFIG = {
  supabaseUrl: "https://qvgcralroduuoptbnctt.supabase.co",
  supabaseKey: "sb_publishable_RNVM7b_qqOIUDdnVjZqtzg_JzTih75_"
};

// v2.10.55 additive training-pack hotfix loader.
(function(){
  if(window.__SAFETY_V21055_SCRIPT_REQUESTED)return;
  window.__SAFETY_V21055_SCRIPT_REQUESTED=true;
  const load=()=>{
    if(document.querySelector('script[data-safety-v21055]'))return;
    const s=document.createElement('script');
    s.src='hotfix-v21055-training-packs.js?v=v21055-training-packs-20260919';
    s.async=false;s.dataset.safetyV21055='1';
    s.onerror=()=>{try{s.remove()}catch(_e){};setTimeout(load,1200);};
    (document.body||document.head||document.documentElement).appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

// v2.10.56 review-audit hotfix loader.
(function(){
  if(window.__SAFETY_V21056_SCRIPT_REQUESTED)return;
  window.__SAFETY_V21056_SCRIPT_REQUESTED=true;
  const load=()=>{
    if(document.querySelector('script[data-safety-v21056]'))return;
    const s=document.createElement('script');
    s.src='hotfix-v21056-review-audit.js?v=v21056-review-audit-20260919';
    s.async=false;s.dataset.safetyV21056='1';
    s.onerror=()=>{try{s.remove()}catch(_e){};setTimeout(load,1200);};
    (document.body||document.head||document.documentElement).appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

// v2.10.57 linked impact-review hotfix loader.
(function(){
  if(window.__SAFETY_V21057_SCRIPT_REQUESTED)return;
  window.__SAFETY_V21057_SCRIPT_REQUESTED=true;
  const load=()=>{
    if(document.querySelector('script[data-safety-v21057]'))return;
    const s=document.createElement('script');
    s.src='hotfix-v21057-linked-impact.js?v=v21057-linked-impact-20260919';
    s.async=false;s.dataset.safetyV21057='1';
    s.onerror=()=>{try{s.remove()}catch(_e){};setTimeout(load,1200);};
    (document.body||document.head||document.documentElement).appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

// v2.10.58 in-app SSW revision hotfix loader.
(function(){
  if(window.__SAFETY_V21058_SCRIPT_REQUESTED)return;
  window.__SAFETY_V21058_SCRIPT_REQUESTED=true;
  const load=()=>{
    if(document.querySelector('script[data-safety-v21058]'))return;
    const s=document.createElement('script');
    s.src='hotfix-v21058-app-created-ssw-revision.js?v=v21058-ssw-revision-20260919';
    s.async=false;s.dataset.safetyV21058='1';
    s.onerror=()=>{try{s.remove()}catch(_e){};setTimeout(load,1200);};
    (document.body||document.head||document.documentElement).appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
