/* Safety Tracker v2.11.20 - approval schedule clarity + approval-time review date */
'use strict';
(function(){
  if(window.__SAFETY_APPROVAL_REVIEW_DATE_V21120)return;
  window.__SAFETY_APPROVAL_REVIEW_DATE_V21120=true;

  let api,state,sb;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const plusYear=iso=>{
    const d=new Date((iso||today())+'T12:00:00');
    d.setFullYear(d.getFullYear()+1);
    return d.toISOString().slice(0,10);
  };
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';

  function selectedTrainingScheduleText(){
    const sel=$('approvalTrainingRenewalPreset');
    if(!sel)return '';
    const opt=sel.options?.[sel.selectedIndex];
    if(!opt)return '';
    if(sel.value==='CUSTOM'){
      const n=$('approvalTrainingRenewalValue')?.value||'';
      const unit=String($('approvalTrainingRenewalUnit')?.value||'MONTHS').toLowerCase();
      return n?`Every ${n} ${unit}`:'Custom schedule';
    }
    return opt.textContent?.trim()||'';
  }

  function syncTrainingScheduleNote(){
    const section=$('approvalTrainingSchedule');
    if(!section)return;
    let note=$('approvalTrainingScheduleCurrentV21120');

    // Remove/neutralise any older hard-coded "Default: every 6 months..." helper.
    [...section.querySelectorAll('span,p,div')].forEach(el=>{
      if(el.id==='approvalTrainingScheduleCurrentV21120')return;
      const txt=(el.textContent||'').trim();
      if(/^Default:\s*every\s+6\s+months/i.test(txt) || /Manager\/Admin can change this/i.test(txt)){
        el.hidden=true;
      }
    });

    if(!note){
      note=document.createElement('p');
      note.id='approvalTrainingScheduleCurrentV21120';
      note.className='muted';
      const sel=$('approvalTrainingRenewalPreset');
      sel?.closest('label')?.appendChild(note);
      sel?.addEventListener('change',syncTrainingScheduleNote);
      $('approvalTrainingRenewalValue')?.addEventListener('input',syncTrainingScheduleNote);
      $('approvalTrainingRenewalUnit')?.addEventListener('change',syncTrainingScheduleNote);
    }
    if(note){
      const text=selectedTrainingScheduleText();
      note.textContent=text?`Current setting: ${text}. Manager/Admin can change this before approval.`:'Choose the training repeat schedule before approval.';
    }
  }

  function addReviewDateField(versionId){
    const v=(state.versions||[]).find(x=>x.id===versionId);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||d.doc_type==='SDS'||$('approvalReviewDate'))return;

    const form=$('approvalDecision')?.closest('.form-grid');
    if(!form)return;

    const review=v.review_date||plusYear(v.issue_date||today());
    const wrap=document.createElement('label');
    wrap.id='approvalReviewDateWrapV21120';
    wrap.innerHTML=`Next document review date
      <input id="approvalReviewDate" type="date" value="${esc(review)}">
      <span class="muted">Default is 12 months from the issue date. Change it here if this document needs a different review period.</span>`;

    const decision=$('approvalDecision')?.closest('label');
    if(decision)decision.insertAdjacentElement('afterend',wrap);
    else form.prepend(wrap);
  }

  function decorateApproval(versionId){
    addReviewDateField(versionId);
    syncTrainingScheduleNote();
  }

  function install(){
    const originalShow=window.showVersionApproval;
    if(typeof originalShow==='function'){
      window.showVersionApproval=function(versionId){
        const out=originalShow(versionId);
        setTimeout(()=>decorateApproval(versionId),0);
        return out;
      };
    }

    const originalSave=window.saveVersionApproval;
    if(typeof originalSave==='function'){
      window.saveVersionApproval=async function(versionId){
        if(!isManager())return originalSave(versionId);

        const v=(state.versions||[]).find(x=>x.id===versionId);
        const d=(state.documents||[]).find(x=>x.id===v?.document_id);
        const decision=$('approvalDecision')?.value;

        if(v&&d&&d.doc_type!=='SDS'&&decision==='APPROVED'){
          const review=$('approvalReviewDate')?.value||'';
          if(!review)return api.toast?.('Choose the next document review date before approval.');

          const up=await sb.from('document_versions').update({review_date:review}).eq('id',versionId);
          if(up.error)return api.toast?.(`Could not save review date: ${up.error.message}`);
          v.review_date=review;
        }

        return originalSave(versionId);
      };
    }

    // Extra safety for approval modals opened by older wrappers/hotfixes.
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-approve-version]');
      if(b)setTimeout(()=>decorateApproval(b.dataset.approveVersion),20);
    },true);

    window.SafetyApprovalReviewDateV21120={decorateApproval,syncTrainingScheduleNote};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    install();
  }
  boot();
})();
