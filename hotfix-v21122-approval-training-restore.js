/* Safety Tracker v2.11.24 - lean approval training recovery */
'use strict';
(function(){
  if(window.__SAFETY_APPROVAL_TRAINING_RESTORE_V21122)return;
  window.__SAFETY_APPROVAL_TRAINING_RESTORE_V21122=true;

  function restore(){
    const section=document.getElementById('approvalTrainingSchedule');
    if(!section)return;

    const delivery=document.getElementById('approvalTrainingDelivery');
    const repeat=document.getElementById('approvalTrainingRenewalPreset');

    for(const field of [delivery,repeat]){
      if(!field)continue;
      field.hidden=false;
      const label=field.closest('label');
      if(label)label.hidden=false;
      const grid=field.closest('.form-grid');
      if(grid)grid.hidden=false;
    }

    [...section.querySelectorAll('span,p')].forEach(el=>{
      if(el.id==='approvalTrainingScheduleCurrentV21120'||el.children.length)return;
      const txt=(el.textContent||'').trim();
      if(/^Default:\s*every\s+6\s+months/i.test(txt))el.hidden=true;
    });

    const custom=document.getElementById('approvalTrainingCustomRenewal');
    if(custom&&repeat)custom.hidden=repeat.value!=='CUSTOM';

    const note=document.getElementById('approvalTrainingScheduleCurrentV21120');
    if(note)note.hidden=false;
  }

  const original=window.showVersionApproval;
  if(typeof original==='function'){
    window.showVersionApproval=function(versionId){
      const out=original(versionId);
      setTimeout(restore,0);
      setTimeout(restore,80);
      return out;
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-approve-version]')){
      setTimeout(restore,40);
    }
  },false);

  window.SafetyApprovalTrainingRestoreV21122={restore};
})();
