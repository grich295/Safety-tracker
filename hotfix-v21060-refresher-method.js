/* Safety Tracker v2.10.60 CLEAN
   Separate initial training method from scheduled refresher method.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21060_BOOT_REQUESTED)return;
  window.__SAFETY_V21060_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof approvalTrainingScheduleHtml==='function' &&
      typeof saveDocumentAudience==='function' &&
      typeof saveVersionApproval==='function' &&
      typeof showEditTraining==='function' &&
      typeof saveTrainingEdit==='function' &&
      typeof showTrainingDetails==='function' &&
      typeof effectiveTrainingMethod==='function' &&
      typeof assignmentStatus==='function' &&
      typeof latestTrainingCompletion==='function' &&
      typeof trainingAssignmentDue==='function' &&
      typeof trainingKind==='function' &&
      !!window.SafetyTrainingPacksV21055 &&
      !!window.__SAFETY_V21059_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21060_INSTALLED)return;
    window.__SAFETY_V21060_INSTALLED=true;

    const BUILD='2.10.60';
    const core={
      approvalTrainingScheduleHtml,
      saveDocumentAudience,
      saveVersionApproval,
      showEditTraining,
      saveTrainingEdit,
      showTrainingDetails,
      effectiveTrainingMethod,
      assignmentStatus
    };

    const $60=id=>document.getElementById(id);
    const esc60=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean60=v=>String(v??'').replace(/\s+/g,' ').trim();
    const toast60=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const kind60=t=>{try{return String(trainingKind(t)||'').toUpperCase()}catch(_e){return String(t?.source_kind||t?.session_type||'').toUpperCase()}};
    const managerName60=()=>clean60(state.profile?.display_name||state.user?.email||'Authenticated Manager');
    const modalOpen60=()=>!!$60('modal')?.open;
    const methodText60=m=>m==='INSTRUCTOR_LED'?'Instructor-led':'Self-training';
    const sourceDoc60=t=>t?.source_document_id?(state.documents||[]).find(d=>d.id===t.source_document_id)||null:null;

    function defaultRefresher60(tOrDoc){
      const kind=String(tOrDoc?.doc_type||tOrDoc?.source_kind||tOrDoc?.session_type||'').toUpperCase();
      if(kind==='TOOLBOX_TALK')return 'INSTRUCTOR_LED';
      return tOrDoc?.refresher_delivery_method||tOrDoc?.delivery_method||(kind==='SSW'?'INSTRUCTOR_LED':'SELF_TRAINING');
    }

    function sameIds60(a,b){
      const A=[...(a||[])].map(String).sort(),B=[...(b||[])].map(String).sort();
      return A.length===B.length&&A.every((x,i)=>x===B[i]);
    }

    function packForcesInstructor60(a,t){
      if(!a||!t)return false;
      if(kind60(t)==='TOOLBOX_TALK')return true;
      const api=window.SafetyTrainingPacksV21055;
      if(!api?.assignedPacks55)return false;
      let packs=[];try{packs=api.assignedPacks55(a.user_id)||[]}catch(_e){return false}
      const did=t.source_document_id||null;
      const decisions=state.trainingPackDecisions55||[];
      for(const p of packs){
        const contains=(did&&p.docIds?.includes(did))||(kind60(t)==='TOOLBOX_TALK'&&p.trainingIds?.includes(t.id));
        if(!contains)continue;
        const current=approvedCurrentVersion(p.root.id);
        const row=decisions.find(x=>x.root_document_id===p.root.id);
        if(!row||!current)continue;
        const valid=row.root_document_version_id===current.id &&
          sameIds60(row.pack_document_ids,p.docIds) &&
          sameIds60(row.pack_training_ids,p.trainingIds);
        if(valid&&row.selected_method==='INSTRUCTOR_LED')return true;
      }
      return false;
    }

    function storedRefresher60(t,a){
      if(kind60(t)==='TOOLBOX_TALK')return 'INSTRUCTOR_LED';
      if(a?.delivery_method_override==='INSTRUCTOR_LED')return 'INSTRUCTOR_LED';
      if(a?.delivery_method_override==='SELF_TRAINING')return 'SELF_TRAINING';
      const d=sourceDoc60(t);
      return t?.refresher_delivery_method||d?.refresher_delivery_method||t?.delivery_method||d?.delivery_method||'SELF_TRAINING';
    }

    effectiveTrainingMethod=function(t,a){
      const initial=core.effectiveTrainingMethod(t,a);
      if(!t)return initial;
      if(kind60(t)==='TOOLBOX_TALK')return 'INSTRUCTOR_LED';
      const completion=a?latestTrainingCompletion(a)?.evidence:null;
      if(!completion)return initial;
      if(packForcesInstructor60(a,t))return 'INSTRUCTOR_LED';
      return storedRefresher60(t,a);
    };
    try{window.effectiveTrainingMethod=effectiveTrainingMethod}catch(_e){}

    assignmentStatus=function(a,t){
      const r=core.assignmentStatus(a,t);
      if(!a||!t)return r;

      // A future refresher-method upgrade must not retrospectively invalidate
      // training that is still current. It takes effect only when renewal is due.
      const completion=latestTrainingCompletion(a),s=completion?.evidence;
      if(s&&kind60(t)!=='TOOLBOX_TALK'&&!packForcesInstructor60(a,t)){
        const due=trainingAssignmentDue(a,s);
        const renewalDue=!!(a.renewal_value&&due&&new Date(due)<=new Date());
        const previousMethod=core.effectiveTrainingMethod(t,a);
        const futureMethod=effectiveTrainingMethod(t,a);
        if(!renewalDue&&previousMethod==='SELF_TRAINING'&&futureMethod==='INSTRUCTOR_LED'&&r.code!=='COMPLETED'){
          return {
            ...r,
            code:'COMPLETED',
            label:completion.exception?'Completed · admin exception':'Completed',
            badge:'complete',
            due,
            s,
            exception:completion.exception||null,
            method:previousMethod,
            ready:false
          };
        }
      }
      return r;
    };
    try{window.assignmentStatus=assignmentStatus}catch(_e){}

    function refresherSelectHtml60(value,locked=false,id='approvalRefresherMethod'){
      const v=locked?'INSTRUCTOR_LED':(value||'SELF_TRAINING');
      return `<label>Refresher method<select id="${id}" ${locked?'disabled':''}>
        <option value="SELF_TRAINING" ${v==='SELF_TRAINING'?'selected':''}>Self-training</option>
        <option value="INSTRUCTOR_LED" ${v==='INSTRUCTOR_LED'?'selected':''}>Instructor-led</option>
      </select>${locked?'<span class="muted">Toolbox Talks are always instructor-led.</span>':'<span class="muted">Used when the scheduled repeat/refresher becomes due. It does not change training that is still current.</span>'}</label>`;
    }

    approvalTrainingScheduleHtml=function(d){
      if(!documentUsesFormalTraining(d))return '';
      const delivery=d.delivery_method||sourceDelivery(d.doc_type);
      const rv=d.default_renewal_value||null,ru=d.default_renewal_unit||null;
      const refresher=d.refresher_delivery_method||delivery;
      return `<div id="approvalTrainingSchedule" class="section-card">
        <h4>Training schedule</h4>
        <p class="muted">Set the initial method, repeat frequency, then how future scheduled refreshers will be delivered.</p>
        <div class="form-grid">
          <label>Initial training method<select id="approvalTrainingDelivery">
            <option value="SELF_TRAINING" ${delivery==='SELF_TRAINING'?'selected':''}>Self-training</option>
            <option value="INSTRUCTOR_LED" ${delivery==='INSTRUCTOR_LED'?'selected':''}>Instructor-led</option>
          </select></label>
          ${renewalFields('approvalTraining',rv,ru,true,d.training_schedule_mode)}
          ${refresherSelectHtml60(refresher,false)}
        </div>
      </div>`;
    };
    try{window.approvalTrainingScheduleHtml=approvalTrainingScheduleHtml}catch(_e){}

    async function setDocRefresher60(docId,method){
      if(!docId||!method)return {error:null};
      const r=await sb.rpc('set_document_refresher_method_v21060',{
        p_document_id:docId,
        p_method:method,
        p_changed_by_name:managerName60()
      });
      if(!r.error){
        const d=(state.documents||[]).find(x=>x.id===docId);if(d)d.refresher_delivery_method=method;
        (state.training||[]).filter(t=>t.source_document_id===docId&&t.status!=='ARCHIVED').forEach(t=>t.refresher_delivery_method=method);
      }
      return r;
    }

    async function setTrainingRefresher60(trainingId,method){
      if(!trainingId||!method)return {error:null};
      const r=await sb.rpc('set_training_refresher_method_v21060',{
        p_training_session_id:trainingId,
        p_method:method,
        p_changed_by_name:managerName60()
      });
      if(!r.error){
        const t=(state.training||[]).find(x=>x.id===trainingId);if(t)t.refresher_delivery_method=method;
      }
      return r;
    }

    saveDocumentAudience=async function(id){
      const method=$60('approvalRefresherMethod')?.value||null;
      const wasOpen=modalOpen60();
      const out=await core.saveDocumentAudience.apply(this,arguments);
      if(wasOpen&&modalOpen60())return out;
      if(method){
        const r=await setDocRefresher60(id,method);
        if(r.error)return toast60(`Training settings saved, but refresher method failed: ${r.error.message}`);
        await refresh('Training settings updated, including refresher method.');
      }
      return out;
    };
    try{window.saveDocumentAudience=saveDocumentAudience}catch(_e){}

    saveVersionApproval=async function(versionId){
      const method=$60('approvalRefresherMethod')?.value||null;
      const decision=$60('approvalDecision')?.value||null;
      const vBefore=(state.versions||[]).find(v=>v.id===versionId);
      const docId=vBefore?.document_id||null;
      const wasOpen=modalOpen60();
      const out=await core.saveVersionApproval.apply(this,arguments);
      if(wasOpen&&modalOpen60())return out;
      const vAfter=(state.versions||[]).find(v=>v.id===versionId);
      if(decision==='APPROVED'&&method&&docId&&String(vAfter?.approval_status||'').toUpperCase()==='APPROVED'){
        const r=await setDocRefresher60(docId,method);
        if(r.error)return toast60(`Document approved, but refresher method failed: ${r.error.message}`);
        await refresh('Document approved and refresher method saved.');
      }
      return out;
    };
    try{window.saveVersionApproval=saveVersionApproval}catch(_e){}

    showEditTraining=function(id){
      const out=core.showEditTraining.apply(this,arguments);
      setTimeout(()=>{
        const t=(state.training||[]).find(x=>x.id===id),body=$60('modalBody');
        if(!t||!body||$60('editTrainRefresherMethod'))return;
        const locked=kind60(t)==='TOOLBOX_TALK';
        const d=sourceDoc60(t);
        const current=locked?'INSTRUCTOR_LED':(t.refresher_delivery_method||d?.refresher_delivery_method||t.delivery_method||'SELF_TRAINING');
        const schedule=$60('editTrainRenewalPreset')?.closest('.form-grid')||body.querySelector('.form-grid');
        if(!schedule)return;
        const wrap=document.createElement('div');wrap.className='full refresher60-edit';
        wrap.innerHTML=`<div class="form-grid">${refresherSelectHtml60(current,locked,'editTrainRefresherMethod')}</div>`;
        const details=$60('editTrainDesc')?.closest('label');
        if(details)details.insertAdjacentElement('beforebegin',wrap);else schedule.appendChild(wrap);
      },0);
      return out;
    };
    try{window.showEditTraining=showEditTraining}catch(_e){}

    saveTrainingEdit=async function(id){
      const tBefore=(state.training||[]).find(x=>x.id===id);
      const locked=kind60(tBefore)==='TOOLBOX_TALK';
      const method=locked?'INSTRUCTOR_LED':($60('editTrainRefresherMethod')?.value||null);
      const wasOpen=modalOpen60();
      const out=await core.saveTrainingEdit.apply(this,arguments);
      if(wasOpen&&modalOpen60())return out;
      if(method){
        let r;
        if(tBefore?.auto_managed&&tBefore.source_document_id)r=await setDocRefresher60(tBefore.source_document_id,method);
        else r=await setTrainingRefresher60(id,method);
        if(r.error)return toast60(`Training saved, but refresher method failed: ${r.error.message}`);
        await refresh(`Training updated. Future scheduled refreshers: ${methodText60(method)}.`);
      }
      return out;
    };
    try{window.saveTrainingEdit=saveTrainingEdit}catch(_e){}

    showTrainingDetails=function(id){
      const out=core.showTrainingDetails.apply(this,arguments);
      setTimeout(()=>{
        const t=(state.training||[]).find(x=>x.id===id),body=$60('modalBody');
        if(!t||!body||$60('refresher60Details'))return;
        const d=sourceDoc60(t),locked=kind60(t)==='TOOLBOX_TALK';
        const initial=locked?'INSTRUCTOR_LED':(t.delivery_method||d?.delivery_method||'SELF_TRAINING');
        const refresher=locked?'INSTRUCTOR_LED':(t.refresher_delivery_method||d?.refresher_delivery_method||initial);
        const box=document.createElement('div');box.id='refresher60Details';box.className='section-card';
        box.innerHTML=`<h4>Training method & refresher</h4><div class="meta">
          <span>Initial: <strong>${esc60(methodText60(initial))}</strong></span>
          <span>Scheduled refresher: <strong>${esc60(methodText60(refresher))}</strong></span>
          ${locked?'<span class="badge complete">TBT · instructor-led always</span>':''}
        </div><p class="muted">Changing the refresher method does not cancel a completion that is still current. The selected refresher method applies when the next scheduled repeat becomes due.</p>`;
        body.appendChild(box);
      },0);
      return out;
    };
    try{window.showTrainingDetails=showTrainingDetails}catch(_e){}

    if(!document.getElementById('refresher60Styles')){
      const s=document.createElement('style');s.id='refresher60Styles';s.textContent=`
        .refresher60-edit{margin-top:4px}
        #refresher60Details .meta{gap:10px}
        #approvalRefresherMethod:disabled,#editTrainRefresherMethod:disabled{opacity:.8}
      `;document.head.appendChild(s);
    }

    window.SafetyRefresherMethodV21060={
      BUILD,
      packForcesInstructor:packForcesInstructor60,
      storedRefresher:storedRefresher60,
      setDocument:setDocRefresher60,
      setTraining:setTrainingRefresher60
    };
  }

  boot();
})();
