window.SAFETY_TRACKER_CONFIG = {
  supabaseUrl: "https://qvgcralroduuoptbnctt.supabase.co",
  supabaseKey: "sb_publishable_RNVM7b_qqOIUDdnVjZqtzg_JzTih75_"
};

(function(){const f=(src,key)=>{if(window[key])return;window[key]=true;const load=()=>{if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(`data-${key}`,'1');s.onerror=()=>{try{s.remove()}catch(_e){};setTimeout(load,1200)};(document.body||document.head||document.documentElement).appendChild(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();};
f('hotfix-v21055-training-packs.js?v=v21055-training-packs-20260919','safety-v21055');
f('hotfix-v21056-review-audit.js?v=v21056-review-audit-20260919','safety-v21056');
f('hotfix-v21057-linked-impact.js?v=v21057-linked-impact-20260919','safety-v21057');
f('hotfix-v21058-app-created-ssw-revision.js?v=v21058-ssw-revision-20260919','safety-v21058');
f('hotfix-v21059-app-created-tbt-revision.js?v=v21059-tbt-revision-20260919','safety-v21059');
f('hotfix-v21060-refresher-method.js?v=v21060-refresher-method-20260919','safety-v21060');
})();
