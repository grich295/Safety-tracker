/* Safety Tracker v2.10.56 CLEAN
   Small additive review-audit build:
   - exposes existing formal controlled-document review history
   - adds equivalent formal review/audit history for approved Toolbox Talks
   - no approved/current content is edited in place
*/
'use strict';
(function(){
  if(window.__SAFETY_V21056_BOOT_REQUESTED)return;
  window.__SAFETY_V21056_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof showDocDetails==='function' &&
      typeof showTrainingDetails==='function' &&
      typeof showDocumentReview==='function' &&
      typeof approvedCurrentVersion==='function' &&
      typeof latestTrainingFile==='function' &&
      typeof trainingKind==='function' &&
      typeof trainingApprovalStatus==='function' &&
      typeof openModal==='function' &&
      typeof refresh==='function' &&
      !!window.SafetyTrackerV2 &&
      !!window.__SAFETY_V21055_INSTALLED
    );
    if(!ready){setTimeout(boot,90);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21056_INSTALLED)return;
    window.__SAFETY_V21056_INSTALLED=true;

    const BUILD='2.10.56';
    const REVIEW_TABLE='training_controlled_reviews_v21056';
    const core={
      showDocDetails,
      showTrainingDetails
    };

    const $56=id=>document.getElementById(id);
    const esc56=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean56=v=>String(v??'').replace(/\s+/g,' ').trim();
    const isManager56=()=>{try{return !!isManager()}catch(_e){return false}};
    const toast56=msg=>{try{return toast(msg)}catch(_e){console.log(msg)}};
    const fmtDate56=v=>{try{return fmtDate(v)}catch(_e){return v?new Date(v).toLocaleDateString('en-GB'):'—'}};
    const fmtDateTime56=v=>{try{return fmtDateTime(v)}catch(_e){return v?new Date(v).toLocaleString('en-GB'):'—'}};
    const today56=()=>{try{return todayISO()}catch(_e){return new Date().toISOString().slice(0,10)}};
    const plusYear56=v=>{try{return plusYear(v)}catch(_e){const d=new Date((v||today56())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)}};

    function outcomeLabel56(v){
      return ({
        NO_CHANGE:'Reviewed — no change required',
        NEW_VERSION_REQUIRED:'New version required',
        OTHER_ACTION:'Other action required'
      })[String(v||'').toUpperCase()]||String(v||'Review');
    }

    function reasonLabel56(v){
      return ({
        SCHEDULED_REVIEW:'Scheduled review',
        INCIDENT_NEAR_MISS:'Incident / near miss',
        PROCESS_EQUIPMENT_CHANGE:'Process / equipment change',
        AUDIT_FINDING:'Audit finding',
        LEGISLATION_GUIDANCE_CHANGE:'Legislation / guidance change',
        LINKED_DOCUMENT_CHANGE:'Linked document change',
        OTHER:'Other'
      })[String(v||'').toUpperCase()]||String(v||'Controlled review');
    }

    function documentReviewRows56(docId){
      const versionIds=new Set((state.versions||[]).filter(v=>v.document_id===docId).map(v=>v.id));
      return (state.documentReviews||[])
        .filter(r=>r.document_id===docId||versionIds.has(r.document_version_id))
        .sort((a,b)=>new Date(b.reviewed_at||b.created_at||0)-new Date(a.reviewed_at||a.created_at||0));
    }

    function documentReviewHistoryHtml56(docId){
      const rows=documentReviewRows56(docId);
      if(!rows.length)return '<div class="muted">No formal controlled reviews recorded yet.</div>';
      return `<div class="card-list review56-history">${rows.map(r=>{
        const who=r.signature_name||(()=>{try{return personName(r.reviewer_id)}catch(_e){return 'Authenticated reviewer'}})();
        return `<div class="item-card compact">
          <div class="row-between"><strong>${esc56(outcomeLabel56(r.outcome))}</strong><span class="badge complete">${esc56(fmtDateTime56(r.reviewed_at||r.created_at))}</span></div>
          <div class="meta"><span>Reviewed by ${esc56(who)}</span><span>Version ${esc56(r.version_snapshot||'—')}</span>${r.next_review_date?`<span>Next review ${esc56(fmtDate56(r.next_review_date))}</span>`:''}</div>
          ${r.review_note?`<div class="muted review56-note">${esc56(r.review_note)}</div>`:''}
        </div>`;
      }).join('')}</div>`;
    }

    function enhanceDocDetails56(id){
      const d=(state.documents||[]).find(x=>x.id===id);
      const body=$56('modalBody');
      if(!d||!body||String(d.doc_type||'').toUpperCase()==='SDS'||$56('formalReviewHistoryV21056'))return;
      const section=document.createElement('div');
      section.id='formalReviewHistoryV21056';
      section.className='section-card review56-section';
      section.innerHTML=`<div class="row-between"><div><h4>Formal review history</h4><p class="muted">Reviews are logged even when the approved content remains unchanged. A no-change review does not create a new version.</p></div>${isManager56()&&approvedCurrentVersion(id)?`<button type="button" class="secondary" data-review56-doc="${esc56(id)}">Review current version</button>`:''}</div>${documentReviewHistoryHtml56(id)}`;
      const versionHeading=[...body.querySelectorAll('h4')].find(x=>/version history/i.test(x.textContent||''));
      if(versionHeading)versionHeading.insertAdjacentElement('beforebegin',section);
      else body.appendChild(section);
    }

    showDocDetails=function(id){
      const out=core.showDocDetails.apply(this,arguments);
      setTimeout(()=>enhanceDocDetails56(id),0);
      return out;
    };
    try{window.showDocDetails=showDocDetails}catch(_e){}

    async function loadTbtReviews56(id){
      try{
        const r=await sb.from(REVIEW_TABLE).select('*').eq('training_session_id',id).order('reviewed_at',{ascending:false});
        if(r.error)throw r.error;
        return r.data||[];
      }catch(e){
        console.warn('TBT review history',e);
        return [];
      }
    }

    function tbtReviewHistoryHtml56(rows){
      if(!rows.length)return '<div class="muted">No formal Toolbox Talk reviews recorded yet.</div>';
      return `<div class="card-list review56-history">${rows.map(r=>`
        <div class="item-card compact">
          <div class="row-between"><strong>${esc56(outcomeLabel56(r.outcome))}</strong><span class="badge complete">${esc56(fmtDateTime56(r.reviewed_at))}</span></div>
          <div class="meta"><span>Reviewed by ${esc56(r.reviewer_name_snapshot||'Authenticated reviewer')}</span><span>${esc56(reasonLabel56(r.review_reason))}</span>${r.next_review_date?`<span>Next review ${esc56(fmtDate56(r.next_review_date))}</span>`:''}</div>
          ${r.review_note?`<div class="muted review56-note">${esc56(r.review_note)}</div>`:''}
        </div>`).join('')}</div>`;
    }

    async function enhanceTrainingDetails56(id){
      const t=(state.training||[]).find(x=>x.id===id);
      const body=$56('modalBody');
      if(!t||!body||String(trainingKind(t)||'').toUpperCase()!=='TOOLBOX_TALK'||$56('tbtFormalReviewV21056'))return;
      const section=document.createElement('div');
      section.id='tbtFormalReviewV21056';
      section.className='section-card review56-section';
      const approved=['APPROVED','LEGACY'].includes(String(trainingApprovalStatus(t)||'').toUpperCase())&&t.status!=='ARCHIVED';
      section.innerHTML=`<div class="row-between"><div><h4>Formal review history</h4><p class="muted">A review is logged even when this Toolbox Talk remains suitable without modification.</p></div>${isManager56()&&approved?`<button type="button" class="secondary" data-review56-tbt="${esc56(id)}">Review current TBT</button>`:''}</div><div id="tbtReviewHistoryRowsV21056"><div class="muted">Loading review history…</div></div>`;
      body.appendChild(section);
      const rows=await loadTbtReviews56(id);
      const host=$56('tbtReviewHistoryRowsV21056');
      if(host&&$56('tbtFormalReviewV21056'))host.innerHTML=tbtReviewHistoryHtml56(rows);
    }

    showTrainingDetails=function(id){
      const out=core.showTrainingDetails.apply(this,arguments);
      setTimeout(()=>enhanceTrainingDetails56(id),0);
      return out;
    };
    try{window.showTrainingDetails=showTrainingDetails}catch(_e){}

    function showTbtReview56(id){
      if(!isManager56())return toast56('Manager or Admin access required.');
      const t=(state.training||[]).find(x=>x.id===id);
      if(!t||String(trainingKind(t)||'').toUpperCase()!=='TOOLBOX_TALK')return;
      if(!['APPROVED','LEGACY'].includes(String(trainingApprovalStatus(t)||'').toUpperCase())||t.status==='ARCHIVED')return toast56('Only an approved/current Toolbox Talk can have a formal controlled review.');
      const f=latestTrainingFile(id);
      const next=plusYear56(today56());
      openModal('Controlled Toolbox Talk review',`
        <p><strong>${esc56(trainingReference(t)?trainingReference(t)+' - '+t.name:t.name)}</strong></p>
        <div class="hint-box">This records the formal management review of the current Toolbox Talk. If it is still suitable, keep the current controlled item and record <strong>No change required</strong>. Do not create a replacement version just to prove it was reviewed.</div>
        ${f?`<div class="row"><button type="button" class="secondary" data-open-training-file="${esc56(f.id)}">Open current Toolbox Talk PDF</button></div>`:''}
        <div class="form-grid">
          <label>Reason for review
            <select id="tbtReviewReasonV21056">
              <option value="SCHEDULED_REVIEW">Scheduled review</option>
              <option value="LINKED_DOCUMENT_CHANGE">Linked RA / COSHH / SSW change</option>
              <option value="INCIDENT_NEAR_MISS">Incident / near miss</option>
              <option value="PROCESS_EQUIPMENT_CHANGE">Process / equipment change</option>
              <option value="AUDIT_FINDING">Audit finding</option>
              <option value="LEGISLATION_GUIDANCE_CHANGE">Legislation / guidance change</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>Outcome
            <select id="tbtReviewOutcomeV21056">
              <option value="NO_CHANGE">Reviewed — no change required</option>
              <option value="NEW_VERSION_REQUIRED">New version required</option>
              <option value="OTHER_ACTION">Other action required</option>
            </select>
          </label>
          <label id="tbtNextReviewWrapV21056">Next review date<input id="tbtNextReviewDateV21056" type="date" value="${esc56(next)}"></label>
          <label class="full">Review note<textarea id="tbtReviewNoteV21056" rows="4" placeholder="Optional for no change. Explain what needs changing if action is required."></textarea></label>
          <div class="hint-box full"><strong>Audit record:</strong> your signed-in account, name, date/time, outcome and next review date are retained. The current TBT is not modified in place.</div>
          <label class="check-row full"><input id="tbtReviewAckV21056" type="checkbox"> I confirm I have reviewed the current Toolbox Talk and the recorded outcome is accurate.</label>
        </div>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-save-review56-tbt="${esc56(id)}">Save controlled review</button></div>
      `);
      const sync=()=>{
        const noChange=$56('tbtReviewOutcomeV21056')?.value==='NO_CHANGE';
        if($56('tbtNextReviewWrapV21056'))$56('tbtNextReviewWrapV21056').hidden=!noChange;
      };
      $56('tbtReviewOutcomeV21056')?.addEventListener('change',sync);
      sync();
    }

    async function saveTbtReview56(id){
      if(!$56('tbtReviewAckV21056')?.checked)return toast56('Tick the review confirmation first.');
      const t=(state.training||[]).find(x=>x.id===id);
      if(!t)return;
      const outcome=$56('tbtReviewOutcomeV21056')?.value||'NO_CHANGE';
      const reason=$56('tbtReviewReasonV21056')?.value||'SCHEDULED_REVIEW';
      const note=clean56($56('tbtReviewNoteV21056')?.value);
      const next=outcome==='NO_CHANGE'?($56('tbtNextReviewDateV21056')?.value||null):null;
      if(outcome==='NO_CHANGE'&&!next)return toast56('Choose the next review date.');
      if(outcome!=='NO_CHANGE'&&note.length<5)return toast56('Add a short note explaining the action required.');
      const reviewer=clean56(state.profile?.display_name||state.user?.email||'Authenticated reviewer');
      const r=await sb.rpc('record_training_controlled_review_v21056',{
        p_training_session_id:id,
        p_outcome:outcome,
        p_review_reason:reason,
        p_review_note:note||null,
        p_next_review_date:next,
        p_reviewer_name:reviewer,
        p_review_context:'CONTROLLED_REVIEW',
        p_source_trigger_document_id:null,
        p_source_trigger_version_id:null,
        p_training_impact:null
      });
      if(r.error)return toast56(r.error.message||'Could not save the Toolbox Talk review.');
      try{
        const f=latestTrainingFile(id);
        if(f&&typeof logDocumentActivity==='function'){
          await logDocumentActivity('CONTROLLED_REVIEW',{
            ...activityTrainingFileSnapshot(f),
            source_context:'CONTROLLED_REVIEW'
          },{
            reason,
            outcome,
            next_review_date:next,
            review_note:note||null
          },false);
        }
      }catch(e){console.warn('TBT review activity audit',e)}
      try{closeModal()}catch(_e){}
      await refresh(outcome==='NO_CHANGE'?'Toolbox Talk review logged — current item remains suitable.':outcome==='NEW_VERSION_REQUIRED'?'Toolbox Talk review logged — a replacement version is required.':'Toolbox Talk review logged — follow-up action required.');
    }

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');
      if(!b)return;
      if(b.dataset.review56Doc){
        e.preventDefault();e.stopImmediatePropagation();
        return showDocumentReview(b.dataset.review56Doc);
      }
      if(b.dataset.review56Tbt){
        e.preventDefault();e.stopImmediatePropagation();
        return showTbtReview56(b.dataset.review56Tbt);
      }
      if(b.dataset.saveReview56Tbt){
        e.preventDefault();e.stopImmediatePropagation();
        return saveTbtReview56(b.dataset.saveReview56Tbt);
      }
    },true);

    if(!document.getElementById('reviewAuditStylesV21056')){
      const s=document.createElement('style');
      s.id='reviewAuditStylesV21056';
      s.textContent=`
        .review56-section{margin-top:12px}.review56-section>.row-between{align-items:flex-start;gap:12px}
        .review56-section h4{margin:0 0 4px}.review56-section p{margin:0}
        .review56-history{margin-top:10px}.review56-note{white-space:pre-line;margin-top:6px}
        @media(max-width:680px){.review56-section>.row-between{display:block}.review56-section>.row-between button{width:100%;margin-top:9px}}
      `;
      document.head.appendChild(s);
    }

    window.SafetyReviewAuditV21056={
      BUILD,
      documentReviewRows:documentReviewRows56,
      loadTbtReviews:loadTbtReviews56,
      showTbtReview:showTbtReview56
    };
  }

  boot();
})();
