/* Safety Tracker v2.10.62 CLEAN
   Replacement-version training impact: no retraining / self / instructor-led.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21062_BOOT_REQUESTED)return;
  window.__SAFETY_V21062_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof loadAll==='function' &&
      typeof showVersionApproval==='function' &&
      typeof saveVersionApproval==='function' &&
      typeof showDocDetails==='function' &&
      typeof latestTrainingCompletion==='function' &&
      typeof effectiveTrainingMethod==='function' &&
      typeof assignmentStatus==='function' &&
      typeof trainingAssignmentDue==='function' &&
      typeof trainingKind==='function' &&
      typeof pdfTextFromBlob==='function' &&
      !!window.SafetyRetrainNowV21061 &&
      !!window.__SAFETY_V21061_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21062_INSTALLED)return;
    window.__SAFETY_V21062_INSTALLED=true;

    const BUILD='2.10.62';
    const TABLE='document_revision_training_impacts_v21062';
    const TRAINABLE=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
    const core={
      loadAll,
      showVersionApproval,
      saveVersionApproval,
      showDocDetails,
      latestTrainingCompletion,
      effectiveTrainingMethod,
      assignmentStatus,
      trainingAssignmentDue
    };

    state.revisionTrainingImpacts62=state.revisionTrainingImpacts62||[];
    state.revisionTrainingImpactManager62=state.revisionTrainingImpactManager62||[];
    const riskCache62=new Map();

    const $62=id=>document.getElementById(id);
    const clean62=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc62=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const toast62=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const fmt62=v=>{try{return fmtDate(v)}catch(_e){return v?new Date(v).toLocaleDateString('en-GB'):'—'}};
    const fmtDT62=v=>{try{return fmtDateTime(v)}catch(_e){return v?new Date(v).toLocaleString('en-GB'):'—'}};
    const manager62=()=>{try{return !!isManager()}catch(_e){return false}};
    const methodText62=m=>m==='INSTRUCTOR_LED'?'Instructor-led':m==='SELF_TRAINING'?'Self-training':'Manager judgement';
    const impactText62=i=>({
      NO_RETRAIN:'No retraining required',
      SELF_TRAINING:'Self-training required',
      INSTRUCTOR_LED:'Instructor-led retraining required'
    })[i]||i||'—';

    async function loadImpacts62(){
      if(!state.user||state.offline||!navigator.onLine)return state.revisionTrainingImpacts62;
      try{
        const r=await sb.rpc('get_training_revision_impacts_v21062');
        if(!r.error)state.revisionTrainingImpacts62=r.data||[];
        else console.warn('Revision training impacts',r.error);
        if(manager62()){
          const m=await sb.from(TABLE).select('*').order('decided_at',{ascending:false}).limit(500);
          if(!m.error)state.revisionTrainingImpactManager62=m.data||[];
        }
      }catch(e){console.warn('Revision training impacts',e)}
      return state.revisionTrainingImpacts62;
    }

    loadAll=async function(){
      const out=await core.loadAll.apply(this,arguments);
      await loadImpacts62();
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    function activeImpactForTraining62(t){
      if(!t?.source_document_version_id)return null;
      return (state.revisionTrainingImpacts62||[]).find(r=>r.new_version_id===t.source_document_version_id)||null;
    }

    function previousTraining62(t,impact){
      if(!t||!impact)return null;
      const rows=(state.training||[]).filter(x=>
        x.source_document_id===t.source_document_id &&
        x.source_document_version_id===impact.previous_version_id
      );
      rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      return rows[0]||null;
    }

    function previousAssignment62(a,t,impact){
      const pt=previousTraining62(t,impact);
      if(!pt)return null;
      return (state.trainingAssignments||[]).find(x=>
        x.training_session_id===pt.id &&
        x.user_id===a.user_id
      )||null;
    }

    function carried62(a){
      if(!a)return null;
      const t=(state.training||[]).find(x=>x.id===a.training_session_id);
      const impact=activeImpactForTraining62(t);
      if(!t||!impact||impact.impact!=='NO_RETRAIN')return null;
      const pa=previousAssignment62(a,t,impact);
      if(!pa)return null;
      const prior=core.latestTrainingCompletion(pa);
      if(!prior?.evidence)return null;
      return {t,impact,priorAssignment:pa,prior};
    }

    latestTrainingCompletion=function(a){
      const own=core.latestTrainingCompletion(a);
      if(own?.evidence)return own;
      const c=carried62(a);
      if(!c)return own;
      const e={
        ...c.prior.evidence,
        _revisionCarry:true,
        _revisionCarryFromAssignmentId:c.priorAssignment.id,
        _revisionCarryFromVersionId:c.impact.previous_version_id,
        _revisionCarryToVersionId:c.impact.new_version_id
      };
      return {evidence:e,exception:c.prior.exception||null};
    };
    try{window.latestTrainingCompletion=latestTrainingCompletion}catch(_e){}

    trainingAssignmentDue=function(a,s){
      if(a&&s?._revisionCarry&&s._revisionCarryFromAssignmentId){
        const currentCounting=(state.retrainingEvents61||[]).find(e=>
          e.assignment_id===a.id &&
          e.status==='COMPLETED' &&
          e.attendance_status==='ATTENDED' &&
          e.counts_as_scheduled_refresher===true
        );
        if(currentCounting){
          const carryTs=new Date(s.signed_at||s.completed_at||0).getTime();
          const eventTs=new Date(currentCounting.completed_at||currentCounting.acknowledged_at||currentCounting.delivery_date||0).getTime();
          if(eventTs>carryTs && a.renewal_value && a.renewal_unit){
            return addRenewal(currentCounting.delivery_date,a.renewal_value,a.renewal_unit);
          }
        }
        const pa=(state.trainingAssignments||[]).find(x=>x.id===s._revisionCarryFromAssignmentId);
        if(pa){
          const prior=core.latestTrainingCompletion(pa);
          if(prior?.evidence)return core.trainingAssignmentDue(pa,prior.evidence);
        }
      }
      return core.trainingAssignmentDue.apply(this,arguments);
    };
    try{window.trainingAssignmentDue=trainingAssignmentDue}catch(_e){}

    effectiveTrainingMethod=function(t,a){
      if(!t)return core.effectiveTrainingMethod.apply(this,arguments);
      const impact=activeImpactForTraining62(t);
      if(!impact)return core.effectiveTrainingMethod.apply(this,arguments);

      // Revision impact controls the one-off requirement created by this new
      // version. After the person completes that requirement, v2.10.60's
      // normal refresher method controls future scheduled renewals again.
      const own=a?core.latestTrainingCompletion(a):null;
      if(!own?.evidence){
        if(impact.impact==='SELF_TRAINING')return 'SELF_TRAINING';
        if(impact.impact==='INSTRUCTOR_LED')return 'INSTRUCTOR_LED';
      }
      return core.effectiveTrainingMethod.apply(this,arguments);
    };
    try{window.effectiveTrainingMethod=effectiveTrainingMethod}catch(_e){}

    assignmentStatus=function(a,t){
      const r=core.assignmentStatus.apply(this,arguments);
      if(!a||!t)return r;
      const c=carried62(a);
      if(!c)return r;
      const completion=latestTrainingCompletion(a),s=completion?.evidence;
      if(!s)return r;
      const due=trainingAssignmentDue(a,s);
      const renewalDue=!!(a.renewal_value&&a.renewal_unit&&due&&new Date(due)<=new Date());
      if(!renewalDue){
        return {
          ...r,
          code:'COMPLETED',
          label:'Completed · carried forward (no retraining required)',
          badge:'complete',
          due,
          s,
          exception:completion.exception||null,
          ready:false
        };
      }
      return r;
    };
    try{window.assignmentStatus=assignmentStatus}catch(_e){}

    function parseResidual62(text){
      const raw=String(text||'').replace(/×/g,'x');
      const lower=raw.toLowerCase(),scores=[];
      const pair=/\b([1-5])\s*[x*]\s*([1-5])(?:\s*=\s*(\d{1,2}))?/g;
      let m;
      while((m=pair.exec(raw))){
        const context=lower.slice(Math.max(0,m.index-180),Math.min(lower.length,m.index+220));
        if(/residual|post[-\s]?control|after\s+(?:all\s+)?controls?|remaining\s+risk|risk\s+after\s+controls/.test(context)){
          const score=Number(m[3]||Number(m[1])*Number(m[2]));
          if(score>=1&&score<=25)scores.push(score);
        }
      }
      const numeric=/(?:residual|post[-\s]?control|after\s+(?:all\s+)?controls?|remaining)\s+(?:risk|risk\s+rating|score|rating)[^0-9]{0,30}\b([1-9]|1\d|2[0-5])\b/gi;
      while((m=numeric.exec(raw))){
        const score=Number(m[1]);if(score>=1&&score<=25)scores.push(score);
      }
      let wordBand='';
      const word=/(?:residual|post[-\s]?control|after\s+(?:all\s+)?controls?|remaining)\s+(?:risk|risk\s+rating|rating)[^a-z]{0,25}\b(low|medium|moderate|high|very\s+high)\b/i.exec(raw);
      if(word)wordBand=/high/i.test(word[1])?'HIGH':/medium|moderate/i.test(word[1])?'MEDIUM':'LOW';
      const score=scores.length?Math.max(...scores):null;
      const band=score!=null?(score<=4?'LOW':score<=9?'MEDIUM':'HIGH'):(wordBand||'UNKNOWN');
      const recommended=band==='HIGH'?'INSTRUCTOR_LED':band==='LOW'?'SELF_TRAINING':'MANAGER_JUDGEMENT';
      return {score,band,recommended};
    }

    async function pendingRisk62(v,d){
      if(!v||!d)return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'No pending version available.'};
      if(String(d.doc_type).toUpperCase()==='SSW'){
        return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'SSW revision impact requires Manager judgement using the linked assessments, task complexity and competence.'};
      }
      if(riskCache62.has(v.id))return riskCache62.get(v.id);
      const promise=(async()=>{
        if(!v.storage_path||state.offline||!navigator.onLine)return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Residual risk could not be read while offline.'};
        try{
          const r=await sb.storage.from('safety-files').download(v.storage_path);
          if(r.error||!r.data)throw r.error||new Error('File unavailable');
          const text=await pdfTextFromBlob(r.data),x=parseResidual62(text);
          const basis=x.score!=null
            ?`Highest residual/post-control score read from pending v${v.version_label||'—'}: ${x.score}/25.`
            :x.band!=='UNKNOWN'
              ?`Residual risk band read from pending v${v.version_label||'—'}: ${x.band}.`
              :`No reliable residual/post-control score was found in pending v${v.version_label||'—'}.`;
          return {...x,basis};
        }catch(e){
          console.warn('Pending revision risk analysis',e);
          return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Safety Tracker could not reliably read a residual risk score from the pending assessment.'};
        }
      })();
      riskCache62.set(v.id,promise);
      return promise;
    }

    function existingPendingDecision62(versionId){
      return (state.revisionTrainingImpactManager62||[]).find(r=>r.new_version_id===versionId&&r.decision_status==='PENDING')||null;
    }

    function riskCard62(r){
      const traffic=r.band==='HIGH'?'red':r.band==='LOW'?'green':'amber';
      const score=r.score!=null?`${r.score}/25 · ${r.band}`:r.band;
      const recommendation=r.recommended==='INSTRUCTOR_LED'?'Recommend Instructor-led':r.recommended==='SELF_TRAINING'?'Recommend Self-training':'Manager judgement required';
      return `<div id="revisionRiskCard62" class="revision62-risk traffic-${traffic}">
        <strong>${esc62(recommendation)}</strong>
        <div class="meta"><span>Residual risk: ${esc62(score)}</span></div>
        <div class="muted">${esc62(r.basis)}</div>
        <div class="muted">Internal Safety Tracker guidance only. The Manager remains responsible for the training decision.</div>
      </div>`;
    }

    function syncOverride62(r){
      const impact=$62('revisionTrainingImpact62')?.value||'';
      const wrap=$62('revisionOverrideWrap62');
      if(!wrap)return;
      wrap.hidden=!(r?.recommended==='INSTRUCTOR_LED'&&(impact==='NO_RETRAIN'||impact==='SELF_TRAINING'));
    }

    async function injectApprovalImpact62(versionId){
      if(!manager62())return;
      const v=(state.versions||[]).find(x=>x.id===versionId),d=(state.documents||[]).find(x=>x.id===v?.document_id);
      const body=$62('modalBody');
      if(!v||!d||!body||!TRAINABLE.has(String(d.doc_type||'').toUpperCase())||$62('revisionTrainingImpactSection62'))return;
      const current=approvedCurrentVersion(d.id);
      if(!current||current.id===v.id)return;

      const prior=existingPendingDecision62(v.id);
      const section=document.createElement('div');
      section.id='revisionTrainingImpactSection62';
      section.className='section-card revision62-section';
      section.innerHTML=`
        <h4>Training impact of this revision</h4>
        <p class="muted">This is separate from the normal refresher frequency. Decide what this replacement version requires now.</p>
        <div class="meta"><span>Previous approved version: <strong>v${esc62(current.version_label||'—')}</strong></span><span>Previous/default training: <strong>${esc62(methodText62(d.delivery_method||sourceDelivery(d.doc_type)))}</strong></span></div>
        <div id="revisionRiskHost62"><div class="hint-box">Reading the pending version for training guidance…</div></div>
        <div class="form-grid">
          <label class="full">Training impact
            <select id="revisionTrainingImpact62">
              <option value="">Choose training impact</option>
              <option value="NO_RETRAIN" ${prior?.impact==='NO_RETRAIN'?'selected':''}>No retraining required — existing current training remains valid</option>
              <option value="SELF_TRAINING" ${prior?.impact==='SELF_TRAINING'?'selected':''}>Self-training required — read and acknowledge the new version</option>
              <option value="INSTRUCTOR_LED" ${prior?.impact==='INSTRUCTOR_LED'?'selected':''}>Instructor-led retraining required</option>
            </select>
          </label>
          <label class="full">Reason for this decision
            <textarea id="revisionTrainingReason62" rows="3" placeholder="e.g. Minor wording change only; controls and working method are unchanged.">${esc62(prior?.decision_reason||'')}</textarea>
          </label>
          <label id="revisionOverrideWrap62" class="full" hidden>Reason for not using Instructor-led retraining against the high-risk recommendation
            <textarea id="revisionOverrideReason62" rows="3" placeholder="Explain why the lower training response is suitable.">${esc62(prior?.override_reason||'')}</textarea>
            <span class="muted">This justification is retained in the management audit trail.</span>
          </label>
        </div>
        <div class="hint-box"><strong>No retraining required</strong> does not create a false new sign-off. Anyone already current keeps their existing completion and original refresher due date. Anyone who was not current still has to complete the current training.</div>
      `;
      const actions=body.querySelector('.actions');
      if(actions)actions.insertAdjacentElement('beforebegin',section);else body.appendChild(section);

      const risk=await pendingRisk62(v,d);
      const host=$62('revisionRiskHost62');
      if(host&&$62('revisionTrainingImpactSection62'))host.innerHTML=riskCard62(risk);
      syncOverride62(risk);
      $62('revisionTrainingImpact62')?.addEventListener('change',()=>syncOverride62(risk));
    }

    showVersionApproval=function(versionId){
      const out=core.showVersionApproval.apply(this,arguments);
      setTimeout(()=>injectApprovalImpact62(versionId),0);
      return out;
    };
    try{window.showVersionApproval=showVersionApproval}catch(_e){}

    async function preRecordImpact62(versionId){
      const v=(state.versions||[]).find(x=>x.id===versionId),d=(state.documents||[]).find(x=>x.id===v?.document_id);
      if(!v||!d||!TRAINABLE.has(String(d.doc_type||'').toUpperCase()))return {ok:true};
      const current=approvedCurrentVersion(d.id);
      if(!current||current.id===v.id)return {ok:true};

      const impact=$62('revisionTrainingImpact62')?.value||'';
      const reason=clean62($62('revisionTrainingReason62')?.value);
      if(!impact)return {ok:false,message:'Choose the training impact of this replacement version.'};
      if(reason.length<5)return {ok:false,message:'Add a short reason for the revision training decision.'};

      const risk=await pendingRisk62(v,d);
      const override=clean62($62('revisionOverrideReason62')?.value);
      if(risk.recommended==='INSTRUCTOR_LED'&&(impact==='NO_RETRAIN'||impact==='SELF_TRAINING')&&override.length<10){
        return {ok:false,message:'Record why Instructor-led retraining is not required against the high-risk recommendation.'};
      }

      const r=await sb.rpc('record_pending_revision_training_impact_v21062',{
        p_new_version_id:v.id,
        p_impact:impact,
        p_residual_risk_score:risk.score,
        p_risk_band:risk.band||'UNKNOWN',
        p_recommended_method:risk.recommended||'MANAGER_JUDGEMENT',
        p_recommendation_basis:risk.basis||null,
        p_decision_reason:reason,
        p_override_reason:override||null,
        p_decider_name:clean62(state.profile?.display_name||state.user?.email||'Authenticated Manager')
      });
      if(r.error)return {ok:false,message:r.error.message||'Could not save the revision training decision.'};
      return {ok:true,impact};
    }

    saveVersionApproval=async function(versionId){
      const decision=$62('approvalDecision')?.value||'';
      if(decision==='APPROVED'){
        const pre=await preRecordImpact62(versionId);
        if(!pre.ok)return toast62(pre.message);
      }
      const out=await core.saveVersionApproval.apply(this,arguments);
      await loadImpacts62();
      try{renderMySafety();renderHsTraining()}catch(_e){}
      return out;
    };
    try{window.saveVersionApproval=saveVersionApproval}catch(_e){}

    function managerHistory62(docId){
      return (state.revisionTrainingImpactManager62||[])
        .filter(r=>r.document_id===docId&&r.decision_status!=='PENDING')
        .sort((a,b)=>new Date(b.decided_at||0)-new Date(a.decided_at||0));
    }

    function historyHtml62(docId){
      const rows=managerHistory62(docId);
      if(!rows.length)return '<div class="muted">No replacement-version training impact decisions recorded yet.</div>';
      return `<div class="card-list revision62-history">${rows.map(r=>{
        const oldV=(state.versions||[]).find(v=>v.id===r.previous_version_id);
        const newV=(state.versions||[]).find(v=>v.id===r.new_version_id);
        const traffic=r.impact==='NO_RETRAIN'?'green':r.impact==='SELF_TRAINING'?'amber':'red';
        return `<div class="item-card compact traffic-${traffic}">
          <div class="row-between"><div><strong>${esc62(impactText62(r.impact))}</strong><div class="meta"><span>v${esc62(oldV?.version_label||'—')} → v${esc62(newV?.version_label||'—')}</span><span>${esc62(fmtDT62(r.decided_at))}</span><span>${esc62(r.decider_name_snapshot||'Manager')}</span></div></div><span class="badge ${r.decision_status==='ACTIVE'?'complete':'due'}">${esc62(r.decision_status)}</span></div>
          <div class="muted">${esc62(r.decision_reason)}</div>
          ${r.risk_band?`<div class="meta"><span>Risk ${esc62(r.residual_risk_score!=null?r.residual_risk_score+'/25 · '+r.risk_band:r.risk_band)}</span><span>Guidance: ${esc62(methodText62(r.recommended_method))}</span></div>`:''}
          ${r.override_reason?`<div class="muted">Override justification: ${esc62(r.override_reason)}</div>`:''}
        </div>`;
      }).join('')}</div>`;
    }

    showDocDetails=function(id){
      const out=core.showDocDetails.apply(this,arguments);
      setTimeout(()=>{
        if(!manager62())return;
        const d=(state.documents||[]).find(x=>x.id===id),body=$62('modalBody');
        if(!d||!body||!TRAINABLE.has(String(d.doc_type||'').toUpperCase())||$62('revisionImpactHistory62'))return;
        const sec=document.createElement('div');
        sec.id='revisionImpactHistory62';
        sec.className='section-card';
        sec.innerHTML=`<h4>Revision training-impact history</h4><p class="muted">Shows what training response was deliberately selected each time an approved controlled version was replaced.</p>${historyHtml62(id)}`;
        body.appendChild(sec);
      },0);
      return out;
    };
    try{window.showDocDetails=showDocDetails}catch(_e){}

    if(!document.getElementById('revision62Styles')){
      const s=document.createElement('style');s.id='revision62Styles';s.textContent=`
        .revision62-section{margin-top:12px}.revision62-risk{padding:12px;border:1px solid #d7e0e7;border-radius:12px;margin:10px 0}
        .revision62-risk.traffic-red{border-color:#e48a84;background:#fff5f4}.revision62-risk.traffic-green{border-color:#7bc49a;background:#f4fbf6}.revision62-risk.traffic-amber{border-color:#e6bd68;background:#fffaf0}
        .revision62-history{margin-top:10px}.revision62-history .item-card{margin-bottom:8px}
      `;document.head.appendChild(s);
    }

    loadImpacts62();

    window.SafetyRevisionTrainingImpactV21062={
      BUILD,
      load:loadImpacts62,
      impactForTraining:activeImpactForTraining62,
      carried:carried62
    };
  }

  boot();
})();
