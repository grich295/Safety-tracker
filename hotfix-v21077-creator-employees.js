/* Safety Tracker v2.10.77 - Creator people-at-risk wording */
'use strict';
(function(){
  if(window.__SAFETY_V21077_CREATOR_PEOPLE)return;
  window.__SAFETY_V21077_CREATOR_PEOPLE=true;

  function boot(){
    const ready=
      typeof creatorPeopleOptions==='function' &&
      typeof esc==='function';
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    creatorPeopleOptions=function(selected=''){
      const raw=String(selected||'')
        .split(/\s*;\s*/)
        .map(x=>x.trim())
        .filter(Boolean);

      // Backward compatibility for older creator drafts:
      // "Maintenance staff" and/or "Other hotel employees" now map to the
      // single clearer category "Employees".
      const normalized=raw.map(v=>{
        if(v==='Maintenance staff'||v==='Other hotel employees')return 'Employees';
        return v;
      });

      const set=new Set(normalized);
      const rows=[
        'Employees',
        'Contractors',
        'Guests / members of public',
        'Young persons',
        'Other'
      ];
      const otherValue=(normalized.find(x=>x.startsWith('Other:'))||'')
        .replace(/^Other:\s*/,'');

      return `<div class="creator-people-checks">${
        rows.map(v=>`<label class="check-row"><input type="checkbox" class="creator-person" value="${esc(v)}" ${
          set.has(v)||([...set].some(x=>x.startsWith('Other:'))&&v==='Other')?'checked':''
        }> ${esc(v)}</label>`).join('')
      }<label class="full creator-other-person" ${
        [...set].some(x=>x.startsWith('Other:'))?'':'hidden'
      }>Other people exposed<input id="creatorPeopleOther" value="${esc(otherValue)}"></label></div>`;
    };

    try{window.creatorPeopleOptions=creatorPeopleOptions}catch(_e){}
  }

  boot();
})();
