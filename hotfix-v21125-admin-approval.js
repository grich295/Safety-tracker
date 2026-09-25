/* Safety Tracker v2.11.25 - Admin approval permission repair */
'use strict';
(function(){
  if(window.__SAFETY_ADMIN_APPROVAL_V21125)return;
  window.__SAFETY_ADMIN_APPROVAL_V21125=true;

  const api=window.SafetyTrackerV2;
  const state=api?.state;
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'
    && state?.profile?.report_only!==true
    && state?.uiMode!=='user';

  function apply(){
    if(!isAdmin())return;
    const modal=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!modal?.open||!body)return;

    const action=
      body.querySelector('[data-save-version-approval]') ||
      body.querySelector('[data-save-doc-review]') ||
      body.querySelector('[data-confirm-training-approval]');
    if(!action)return;

    const hint=body.querySelector('#responsibilityApprovalHintV21090');
    const txt=(hint?.textContent||'').trim();

    // Scope is still required because it controls who the document/training applies to.
    // Responsibility-owner assignment is NOT an Admin permission gate.
    if(/^Scope required\./i.test(txt)){
      action.disabled=true;
      action.title='Set the document scope/audience before approval.';
      return;
    }

    action.disabled=false;
    action.removeAttribute('disabled');
    action.title='';

    if(hint){
      hint.className='success-note';
      hint.innerHTML='<strong>Admin approval:</strong> Any Admin may approve or review this controlled document. Assigned H&amp;S / Department responsibility is used for ownership, reminders and follow-up; it does not restrict Admin approval permission.';
    }
  }

  function applyBurst(){
    [0,60,180,450,900].forEach(ms=>setTimeout(apply,ms));
  }

  // Direct wrappers for the main controlled-document flows.
  for(const name of ['showVersionApproval','showDocumentReview']){
    const fn=window[name];
    if(typeof fn==='function'){
      window[name]=function(){
        const out=fn.apply(this,arguments);
        applyBurst();
        return out;
      };
    }
  }

  // Cover Toolbox Talk / other approval buttons and audience changes without a DOM observer.
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-approve-version],[data-review-doc],[data-training-approval],[data-confirm-training-approval]')){
      applyBurst();
    }
  },false);

  document.addEventListener('change',e=>{
    if(e.target.closest?.('#approvalAudienceSection,#tbtApprovalAudienceAudienceSection')){
      setTimeout(apply,80);
      setTimeout(apply,300);
    }
  },false);

  window.SafetyAdminApprovalV21125={apply,applyBurst};
})();
