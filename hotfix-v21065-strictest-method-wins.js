/* Safety Tracker v2.10.65 CLEAN
   Ensure the strictest current training-method requirement always wins.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21065_BOOT_REQUESTED)return;
  window.__SAFETY_V21065_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof effectiveTrainingMethod==='function' &&
      typeof assignmentStatus==='function' &&
      typeof latestTrainingCompletion==='function' &&
      typeof latestTrainingConfirmation==='function' &&
      typeof trainingEvents==='function' &&
      typeof showVersionApproval==='function' &&
      !!window.SafetyRevisionTrainingImpactV21062 &&
      !!window.SafetyRefresherMethodV21060 &&
      !!window.SafetySourceTrainingGuardV21064 &&
      !!window.__SAFETY_V21064_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21065_INSTALLED)return;
    window.__SAFETY_V21065_INSTALLED=true;

    const BUILD='2.10.65';
    const core={
      effectiveTrainingMethod,
      assignmentStatus,
      showVersionApproval
    };

    const kind65=t=>{
      try{return String(trainingKind(t)||'').toUpperCase()}
      catch(_e){return String(t?.source_kind||t?.session_type||'').toUpperCase()}
    };

    function strictInstructor65(t,a){
      if(!t)return false;
      if(kind65(t)==='TOOLBOX_TALK')return true;
      if(a?.delivery_method_override==='INSTRUCTOR_LED')return true;
      try{
        if(window.SafetyRefresherMethodV21060?.packForcesInstructor?.(a,t))return true;
      }catch(_e){}
      return false;
    }

    effectiveTrainingMethod=function(t,a){
      const base=core.effectiveTrainingMethod.apply(this,arguments);
      return strictInstructor65(t,a)?'INSTRUCTOR_LED':base;
    };
    try{window.effectiveTrainingMethod=effectiveTrainingMethod}catch(_e){}

    function evidenceAssignment65(a,evidence){
      if(!a||!evidence)return a||null;
      const id=evidence._revisionCarryFromAssignmentId;
      if(!id)return a;
      return (state.trainingAssignments||[]).find(x=>x.id===id)||a;
    }

    function evidenceWasInstructor65(a,evidence){
      if(!a||!evidence)return false;
      const sourceA=evidenceAssignment65(a,evidence);
      const completion=latestTrainingCompletion(sourceA);
      if(completion?.exception)return true;
      const signedAt=evidence.signed_at||evidence.completed_at;
      if(!signedAt)return false;
      return (trainingEvents(sourceA)||[]).some(ev=>
        (ev.attendance_status||'ATTENDED')==='ATTENDED' &&
        new Date(ev.confirmed_at||0)<=new Date(signedAt)
      );
    }

    assignmentStatus=function(a,t){
      const r=core.assignmentStatus.apply(this,arguments);
      if(!a||!t||!strictInstructor65(t,a)||r.code!=='COMPLETED')return r;

      const completion=latestTrainingCompletion(a);
      const evidence=completion?.evidence;
      if(evidenceWasInstructor65(a,evidence))return {...r,method:'INSTRUCTOR_LED'};

      const c=latestTrainingConfirmation(a);
      const evidenceAt=evidence?.signed_at||evidence?.completed_at||null;
      const fresh=!!c&&(!evidenceAt||new Date(c.confirmed_at||0)>new Date(evidenceAt));
      if(fresh){
        return {
          ...r,
          code:'READY_TO_SIGN',
          label:'Ready to sign · instructor-led',
          badge:'due',
          ready:true,
          method:'INSTRUCTOR_LED'
        };
      }

      const overdue=r.due&&new Date(r.due)<new Date();
      return {
        ...r,
        code:overdue?'OVERDUE':'AWAITING_INSTRUCTOR',
        label:overdue?'Overdue · instructor-led required':'Instructor-led training required',
        badge:overdue?'overdue':'due',
        ready:false,
        method:'INSTRUCTOR_LED'
      };
    };
    try{window.assignmentStatus=assignmentStatus}catch(_e){}

    function addPrecedenceNote65(){
      const sec=document.getElementById('revisionTrainingImpactSection62');
      if(!sec||document.getElementById('strictMethodNote65'))return;
      const note=document.createElement('div');
      note.id='strictMethodNote65';
      note.className='hint-box';
      note.innerHTML='<strong>Strictest requirement wins:</strong> choosing Self-training or No retraining for this revision does not weaken a current Instructor-led requirement from a linked training pack or individual training override.';
      sec.appendChild(note);
    }

    showVersionApproval=function(versionId){
      const out=core.showVersionApproval.apply(this,arguments);
      [40,180,500].forEach(ms=>setTimeout(addPrecedenceNote65,ms));
      return out;
    };
    try{window.showVersionApproval=showVersionApproval}catch(_e){}

    const observer=new MutationObserver(()=>addPrecedenceNote65());
    observer.observe(document.body,{childList:true,subtree:true});

    window.SafetyStrictestMethodV21065={
      BUILD,
      strictInstructor:strictInstructor65,
      evidenceWasInstructor:evidenceWasInstructor65
    };
  }

  boot();
})();
