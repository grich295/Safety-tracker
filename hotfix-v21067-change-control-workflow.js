/* Safety Tracker v2.10.67 CLEAN
   Consolidate RA/COSHH change control into one Manager workspace.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21067_BOOT_REQUESTED)return;
  window.__SAFETY_V21067_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof openDocument==='function' &&
      typeof showVersionApproval==='function' &&
      typeof pdfTextFromBlob==='function' &&
      !!window.SafetyLinkedImpactV21057 &&
      !!window.SafetyRevisionTrainingImpactV21062 &&
      !!window.SafetyTemporaryUnsuitableV21066 &&
      !!window.__SAFETY_V21066_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21067_INSTALLED)return;
    window.__SAFETY_V21067_INSTALLED=true;

    const BUILD='2.10.67';
    const IMPACT_TABLE='document_revision_training_impacts_v21062';
    let observer67=null,enhancing67=false;
    const riskCache67=new Map();

    const $67=id=>document.getElementById(id);
    const esc67=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean67=v=>String(v??'').replace(/\s+/g,' ').trim();
    const toast67=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const manager67=()=>{try{return !!isManager()}catch(_e){return false}};
    const method67=m=>m==='INSTRUCTOR_LED'?'Instructor-led':m==='SELF_TRAINING'?'Self-training':'Manager judgement';
    const impact67=i=>({NO_RETRAIN:'No retraining required',SELF_TRAINING:'Self-training required',INSTRUCTOR_LED:'Instructor-led retraining required'})[i]||'Not decided';

    function candidates67(){
      const m=window.SafetyTrackerV2?.documentChangeImpactV21040;
      try{return Array.isArray(m?.candidates)?m.candidates:(m?.get?.candidates||[])}catch(_e){return []}
    }
    function candidate67(versionId){return candidates67().find(c=>c?.version?.id===versionId)||null}

    function modalVersionId67(){
      const b=document.querySelector('#modalBody button[data-impact57-modify],#modalBody button[data-impact57-review]');
      const raw=b?.dataset?.impact57Modify||b?.dataset?.impact57Review||'';
      return String(raw).split('|')[0]||'';
    }

    function pendingReplacement67(target){
      if(target.kind==='DOCUMENT'){
        try{return !!pendingApprovalVersion(target.id)}catch(_e){return false}
      }
      return (state.training||[]).some(t=>
        t.replaces_training_session_id===target.id &&
        t.status!=='ARCHIVED' &&
        String(t.approval_status||'').toUpperCase()==='PENDING'
      );
    }

    function activeBlock67(versionId,target){
      return (state.suitabilityBlocks66||[]).find(b=>
        b.source_version_id===versionId &&
        (
          (target.kind==='DOCUMENT'&&b.target_kind==='DOCUMENT'&&b.target_document_id===target.id) ||
          (target.kind==='TRAINING'&&b.target_kind==='TRAINING'&&b.target_training_session_id===target.id)
        )
      )||null;
    }

    async function linkedReviews67(versionId){
      try{
        const r=await sb.from('linked_impact_reviews_v21057').select('*').eq('source_version_id',versionId).order('reviewed_at',{ascending:false});
        return r.error?[]:(r.data||[]);
      }catch(_e){return []}
    }

    function latestReview67(rows,target){
      return rows.find(r=>
        (target.kind==='DOCUMENT'&&r.target_kind==='DOCUMENT'&&r.target_document_id===target.id) ||
        (target.kind==='TRAINING'&&r.target_kind==='TRAINING'&&r.target_training_session_id===target.id)
      )||null;
    }

    async function decision67(versionId){
      const local=(state.revisionTrainingImpactManager62||[]).find(r=>r.new_version_id===versionId&&r.decision_status!=='VOID');
      if(local)return local;
      try{
        const r=await sb.from(IMPACT_TABLE).select('*').eq('new_version_id',versionId).neq('decision_status','VOID').order('decided_at',{ascending:false}).limit(1);
        return r.error?null:(r.data?.[0]||null);
      }catch(_e){return null}
    }

    function parseResidual67(text){
      const raw=String(text||'').replace(/×/g,'x'),lower=raw.toLowerCase(),scores=[];
      let m;
      const pair=/\b([1-5])\s*[x*]\s*([1-5])(?:\s*=\s*(\d{1,2}))?/g;
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
      const score=scores.length?Math.max(...scores):null;
      const band=score==null?'UNKNOWN':score<=4?'LOW':score<=9?'MEDIUM':'HIGH';
      const recommended=band==='HIGH'?'INSTRUCTOR_LED':band==='LOW'?'SELF_TRAINING':'MANAGER_JUDGEMENT';
      return {score,band,recommended};
    }

    async function risk67(c){
      if(!c?.version)return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Risk guidance unavailable.'};
      if(riskCache67.has(c.version.id))return riskCache67.get(c.version.id);
      const promise=(async()=>{
        if(!c.version.storage_path||state.offline||!navigator.onLine)
          return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Residual-risk guidance unavailable while offline.'};
        try{
          const r=await sb.storage.from('safety-files').download(c.version.storage_path);
          if(r.error||!r.data)throw r.error||new Error('File unavailable');
          const text=await pdfTextFromBlob(r.data),x=parseResidual67(text);
          return {
            ...x,
            basis:x.score!=null
              ?`Highest residual/post-control score read from replacement v${c.version.version_label||'—'}: ${x.score}/25.`
              :`No reliable residual/post-control score was found in replacement v${c.version.version_label||'—'}; Manager judgement is required.`
          };
        }catch(e){
          console.warn('Change-control risk guidance',e);
          return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Safety Tracker could not reliably read residual risk from the replacement assessment.'};
        }
      })();
      riskCache67.set(c.version.id,promise);
      return promise;
    }

    function statusCard67(n,title,text,traffic,badge){
      const badgeClass=traffic==='green'?'complete':traffic==='red'?'overdue':'due';
      return `<div class="workflow67-step traffic-${traffic}">
        <div class="workflow67-number">${n}</div>
        <div class="workflow67-copy"><strong>${esc67(title)}</strong><div>${esc67(text)}</div></div>
        <span class="badge ${badgeClass}">${esc67(badge)}</span>
      </div>`;
    }

    function targetHandled67(versionId,target,reviews){
      const b=activeBlock67(versionId,target);
      if(b)return {handled:false,blocked:true,label:'Temporarily blocked'};
      const r=latestReview67(reviews,target);
      if(!r)return {handled:false,blocked:false,label:'Review required'};
      if(r.outcome==='NO_CHANGE')return {handled:true,blocked:false,label:'Reviewed · remains suitable'};
      if(r.outcome==='NEW_VERSION_REQUIRED'){
        return {handled:true,blocked:false,label:pendingReplacement67(target)?'Replacement pending':'New version required'};
      }
      return {handled:false,blocked:false,label:'Review required'};
    }

    async function renderWorkspace67(){
      if(enhancing67||!manager67())return;
      const body=$67('modalBody'),versionId=modalVersionId67();
      if(!body||!versionId||$67('changeControlWorkspace67'))return;
      const c=candidate67(versionId);
      if(!c||!['RISK_ASSESSMENT','COSHH'].includes(String(c.doc?.doc_type||'').toUpperCase()))return;

      enhancing67=true;
      try{
        const [reviews,decision,risk]=await Promise.all([linkedReviews67(versionId),decision67(versionId),risk67(c)]);
        const targets=window.SafetyLinkedImpactV21057?.targets?.(c)||[];
        const handled=targets.map(t=>targetHandled67(versionId,t,reviews));
        const handledCount=handled.filter(x=>x.handled).length;
        const blockedCount=handled.filter(x=>x.blocked).length;
        const sourceStatus=String(c.version.approval_status||'PENDING').toUpperCase();
        const sourceApproved=sourceStatus==='APPROVED';
        const hasDecision=!!decision;
        const linksDone=handledCount===targets.length&&blockedCount===0;
        const ready=hasDecision&&linksDone;
        const overall=sourceApproved&&ready?'Complete':ready?'Ready for final approval':'Action required';
        const overallTraffic=sourceApproved&&ready?'green':blockedCount?'red':'amber';

        const wrap=document.createElement('div');
        wrap.id='changeControlWorkspace67';
        wrap.className='section-card workflow67';
        wrap.innerHTML=`
          <div class="row-between workflow67-head">
            <div><h3>Change-control workspace</h3><p class="muted">One place to review the replacement assessment, its training impact and all linked SSW/TBT actions.</p></div>
            <span class="badge ${overallTraffic==='green'?'complete':overallTraffic==='red'?'overdue':'due'}">${esc67(overall)}</span>
          </div>
          <div class="workflow67-steps">
            ${statusCard67(1,'Replacement assessment',sourceApproved?`v${c.version.version_label||'—'} is approved/current.`:`v${c.version.version_label||'—'} is pending approval.`,sourceApproved?'green':'amber',sourceApproved?'Approved':'Pending')}
            ${statusCard67(2,'Training impact',hasDecision?impact67(decision.impact):'Choose what this revision requires now.',hasDecision?'green':'amber',hasDecision?'Decided':'Required')}
            ${statusCard67(3,'Linked SSW / TBT',targets.length?`${handledCount} of ${targets.length} reviewed/handled${blockedCount?`; ${blockedCount} temporarily blocked`:''}.`:'No linked SSW/TBT found.',blockedCount?'red':linksDone?'green':'amber',blockedCount?'Blocked':linksDone?'Reviewed':'Review')}
            ${statusCard67(4,'Final authorisation',sourceApproved?'Replacement source is authorised.':ready?'Linked review and training impact are ready; complete the controlled approval.':'Finish the actions above before final approval.',sourceApproved?'green':ready?'amber':'amber',sourceApproved?'Complete':ready?'Ready':'Waiting')}
          </div>
          <div class="row workflow67-source-actions">
            <button type="button" class="secondary" data-workflow67-open-source="${esc67(versionId)}">${sourceApproved?'Open approved source':'Open replacement source'}</button>
            ${!sourceApproved?`<button type="button" class="primary" data-workflow67-final-approval="${esc67(versionId)}">${ready?'Review & approve source':'Open approval screen'}</button>`:''}
          </div>
          <div class="workflow67-training">
            <h4>Training impact of this revision</h4>
            <div id="workflow67Risk" class="workflow67-risk traffic-${risk.band==='HIGH'?'red':risk.band==='LOW'?'green':'amber'}">
              <strong>${risk.recommended==='INSTRUCTOR_LED'?'Recommend Instructor-led':risk.recommended==='SELF_TRAINING'?'Recommend Self-training':'Manager judgement required'}</strong>
              <div class="meta"><span>Residual risk: ${esc67(risk.score!=null?risk.score+'/25 · '+risk.band:risk.band)}</span></div>
              <div class="muted">${esc67(risk.basis)}</div>
            </div>
            <div class="form-grid">
              <label class="full">Training impact
                <select id="workflow67Impact" ${sourceApproved?'disabled':''}>
                  <option value="">Choose training impact</option>
                  <option value="NO_RETRAIN" ${decision?.impact==='NO_RETRAIN'?'selected':''}>No retraining required — current training remains valid</option>
                  <option value="SELF_TRAINING" ${decision?.impact==='SELF_TRAINING'?'selected':''}>Self-training required — read and acknowledge new version</option>
                  <option value="INSTRUCTOR_LED" ${decision?.impact==='INSTRUCTOR_LED'?'selected':''}>Instructor-led retraining required</option>
                </select>
              </label>
              <label class="full">Reason
                <textarea id="workflow67Reason" rows="3" ${sourceApproved?'disabled':''} placeholder="Record why this training response is suitable.">${esc67(decision?.decision_reason||'')}</textarea>
              </label>
              <label id="workflow67OverrideWrap" class="full" hidden>Why is Instructor-led retraining not required against the high-risk recommendation?
                <textarea id="workflow67Override" rows="3" ${sourceApproved?'disabled':''}>${esc67(decision?.override_reason||'')}</textarea>
              </label>
            </div>
            ${sourceApproved
              ?`<div class="success-note">Recorded decision: <strong>${esc67(impact67(decision?.impact))}</strong>${decision?.decider_name_snapshot?` · ${esc67(decision.decider_name_snapshot)}`:''}</div>`
              :`<div class="row"><button type="button" class="primary" data-workflow67-save-impact="${esc67(versionId)}">Save training-impact decision</button></div>`}
            <div class="hint-box"><strong>Strictest requirement still wins:</strong> this revision decision cannot weaken an Instructor-led requirement from a current linked training pack or individual override.</div>
          </div>
          <div class="workflow67-linked-head"><h4>Linked controlled items</h4><p class="muted">Use the existing cards below to open, keep as-is, modify, edit in app, temporarily block or clear a block. Every decision remains separately audited.</p></div>
        `;
        body.insertAdjacentElement('afterbegin',wrap);

        const syncOverride=()=>{
          const val=$67('workflow67Impact')?.value||'',ow=$67('workflow67OverrideWrap');
          if(ow)ow.hidden=!(risk.recommended==='INSTRUCTOR_LED'&&(val==='NO_RETRAIN'||val==='SELF_TRAINING'));
        };
        $67('workflow67Impact')?.addEventListener('change',syncOverride);
        syncOverride();
      }finally{
        enhancing67=false;
      }
    }

    async function saveImpact67(versionId){
      const c=candidate67(versionId);if(!c)return toast67('Change-control item has refreshed. Reopen it and try again.');
      const impact=$67('workflow67Impact')?.value||'',reason=clean67($67('workflow67Reason')?.value),override=clean67($67('workflow67Override')?.value);
      if(!impact)return toast67('Choose the training impact of this revision.');
      if(reason.length<5)return toast67('Add a short reason for the training-impact decision.');
      const risk=await risk67(c);
      if(risk.recommended==='INSTRUCTOR_LED'&&(impact==='NO_RETRAIN'||impact==='SELF_TRAINING')&&override.length<10)
        return toast67('Record why Instructor-led retraining is not required against the high-risk recommendation.');

      const r=await sb.rpc('record_pending_revision_training_impact_v21062',{
        p_new_version_id:c.version.id,
        p_impact:impact,
        p_residual_risk_score:risk.score,
        p_risk_band:risk.band||'UNKNOWN',
        p_recommended_method:risk.recommended||'MANAGER_JUDGEMENT',
        p_recommendation_basis:risk.basis||null,
        p_decision_reason:reason,
        p_override_reason:override||null,
        p_decider_name:clean67(state.profile?.display_name||state.user?.email||'Authenticated Manager')
      });
      if(r.error)return toast67(r.error.message||'Could not save the training-impact decision.');

      try{await window.SafetyRevisionTrainingImpactV21062.load()}catch(_e){}
      toast67('Revision training-impact decision saved.');
      const body=$67('modalBody');if(body)$67('changeControlWorkspace67')?.remove();
      renderWorkspace67();
    }

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b)return;
      if(b.dataset.workflow67OpenSource){
        e.preventDefault();e.stopImmediatePropagation();
        return openDocument(b.dataset.workflow67OpenSource);
      }
      if(b.dataset.workflow67FinalApproval){
        e.preventDefault();e.stopImmediatePropagation();
        return showVersionApproval(b.dataset.workflow67FinalApproval);
      }
      if(b.dataset.workflow67SaveImpact){
        e.preventDefault();e.stopImmediatePropagation();
        return saveImpact67(b.dataset.workflow67SaveImpact);
      }
    },true);

    function observe67(){
      if(observer67)return;
      observer67=new MutationObserver(()=>renderWorkspace67());
      observer67.observe(document.body,{childList:true,subtree:true});
      [0,250,700,1500].forEach(ms=>setTimeout(renderWorkspace67,ms));
    }

    if(!document.getElementById('workflow67Styles')){
      const s=document.createElement('style');s.id='workflow67Styles';s.textContent=`
        .workflow67{margin-bottom:14px}.workflow67-head{gap:10px}.workflow67-head h3{margin-bottom:3px}
        .workflow67-steps{display:grid;gap:7px;margin:10px 0}.workflow67-step{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;padding:9px 10px;border:1px solid #dbe3e8;border-radius:10px}
        .workflow67-step.traffic-green{border-color:#82c79e;background:#f4fbf6}.workflow67-step.traffic-amber{border-color:#e5bd6b;background:#fffaf0}.workflow67-step.traffic-red{border-color:#e18d88;background:#fff5f4}
        .workflow67-number{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#e9eef2;font-weight:700}.workflow67-copy>div{font-size:.9rem;color:#5d6870;margin-top:2px}
        .workflow67-source-actions{margin:10px 0;flex-wrap:wrap}.workflow67-training{border-top:1px solid #dde5ea;margin-top:12px;padding-top:12px}.workflow67-risk{padding:10px;border:1px solid #dbe3e8;border-radius:10px;margin:8px 0 12px}
        .workflow67-risk.traffic-green{border-color:#82c79e;background:#f4fbf6}.workflow67-risk.traffic-amber{border-color:#e5bd6b;background:#fffaf0}.workflow67-risk.traffic-red{border-color:#e18d88;background:#fff5f4}
        .workflow67-linked-head{border-top:1px solid #dde5ea;margin-top:13px;padding-top:12px}.workflow67-linked-head h4{margin-bottom:2px}
        @media(max-width:680px){.workflow67-step{grid-template-columns:30px 1fr}.workflow67-step>.badge{grid-column:2;justify-self:start}.workflow67-source-actions{display:grid;grid-template-columns:1fr}.workflow67-source-actions button{width:100%}}
      `;document.head.appendChild(s);
    }

    observe67();

    window.SafetyChangeControlWorkspaceV21067={
      BUILD,
      render:renderWorkspace67
    };
  }

  boot();
})();
