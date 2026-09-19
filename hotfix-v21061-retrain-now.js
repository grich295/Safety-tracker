/* Safety Tracker v2.10.61 CLEAN
   Ad-hoc instructor-led Retrain now with separate audit evidence.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21061_BOOT_REQUESTED)return;
  window.__SAFETY_V21061_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof loadAll==='function' &&
      typeof renderMySafety==='function' &&
      typeof renderHsTraining==='function' &&
      typeof showTrainingDetails==='function' &&
      typeof trainingAssignmentDue==='function' &&
      typeof requiredTrainingMaterials==='function' &&
      typeof openRequiredTrainingMaterial==='function' &&
      typeof addRenewal==='function' &&
      !!window.SafetyTrainingPacksV21055 &&
      !!window.SafetyRefresherMethodV21060 &&
      !!window.__SAFETY_V21060_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21061_INSTALLED)return;
    window.__SAFETY_V21061_INSTALLED=true;

    const BUILD='2.10.61',TABLE='training_retraining_events_v21061';
    const core={
      loadAll,
      renderMySafety,
      renderHsTraining,
      showTrainingDetails,
      trainingAssignmentDue
    };

    state.retrainingEvents61=state.retrainingEvents61||[];

    const $61=id=>document.getElementById(id);
    const esc61=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean61=v=>String(v??'').replace(/\s+/g,' ').trim();
    const toast61=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const fmt61=v=>{try{return fmtDate(v)}catch(_e){return v?new Date(v).toLocaleDateString('en-GB'):'—'}};
    const fmtDT61=v=>{try{return fmtDateTime(v)}catch(_e){return v?new Date(v).toLocaleString('en-GB'):'—'}};
    const today61=()=>{try{return todayISO()}catch(_e){return new Date().toISOString().slice(0,10)}};
    const manager61=()=>{try{return !!isManager()}catch(_e){return false}};
    const person61=id=>{try{return personName(id)}catch(_e){return (state.people||[]).find(p=>p.id===id)?.display_name||'User'}};

    function reasonLabel61(v){
      return ({
        OBSERVED_PROCEDURE_GAP:'Observed gap in procedure',
        CONTROL_NOT_FOLLOWED:'Control not followed correctly',
        SUPERVISION_WEAKNESS:'Supervision identified a weakness',
        PROCESS_EQUIPMENT_CHANGE:'Process / equipment change',
        MANAGER_REQUESTED_REFRESHER:'Manager-requested refresher',
        OTHER:'Other factual reason'
      })[v]||v||'Retraining';
    }

    async function loadEvents61(){
      if(!state.user||state.offline||!navigator.onLine)return state.retrainingEvents61;
      try{
        const r=await sb.from(TABLE).select('*').order('created_at',{ascending:false});
        if(!r.error)state.retrainingEvents61=r.data||[];
        else console.warn('Retraining events',r.error);
      }catch(e){console.warn('Retraining events',e)}
      return state.retrainingEvents61;
    }

    loadAll=async function(){
      const out=await core.loadAll.apply(this,arguments);
      await loadEvents61();
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    function eventsForAssignment61(id){
      return (state.retrainingEvents61||[]).filter(e=>e.assignment_id===id)
        .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    }

    function eventsForTraining61(id){
      return (state.retrainingEvents61||[]).filter(e=>e.training_session_id===id)
        .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    }

    function latestCounting61(a){
      return eventsForAssignment61(a.id).find(e=>
        e.status==='COMPLETED' &&
        e.attendance_status==='ATTENDED' &&
        e.counts_as_scheduled_refresher===true
      )||null;
    }

    trainingAssignmentDue=function(a,s){
      const base=core.trainingAssignmentDue.apply(this,arguments);
      if(!a||!s||!a.renewal_value||!a.renewal_unit)return base;
      const e=latestCounting61(a);
      if(!e)return base;
      const eTs=new Date(e.completed_at||e.acknowledged_at||e.delivery_date||0).getTime();
      const sTs=new Date(s.signed_at||s.completed_at||0).getTime();
      if(eTs<=sTs)return base;
      return addRenewal(e.delivery_date,a.renewal_value,a.renewal_unit)||base;
    };
    try{window.trainingAssignmentDue=trainingAssignmentDue}catch(_e){}

    function prereq61(a,t){
      try{
        const api=window.SafetyTrainingPacksV21055;
        return api?.prerequisiteState55?api.prerequisiteState55(a,t):{ready:true,blocked:[]};
      }catch(_e){return {ready:true,blocked:[]}}
    }

    function openEvent61(a){
      return eventsForAssignment61(a.id).find(e=>e.status==='AWAITING_ACK')||null;
    }

    function materialOpenedAfter61(e,a,t){
      const mats=requiredTrainingMaterials(a,t);
      if(!mats.length)return true;
      const cutoff=new Date(e.created_at||0).getTime(),uid=state.user?.id;
      return mats.every(m=>(state.documentActivity||[]).some(x=>
        x.user_id===uid &&
        x.action==='OPENED' &&
        x.source_context==='TRAINING_ASSIGNMENT' &&
        x.training_session_id===a.training_session_id &&
        new Date(x.occurred_at||0).getTime()>cutoff &&
        (
          (m.kind==='DOCUMENT'&&m.version&&x.document_version_id===m.version.id) ||
          (m.kind==='TRAINING_FILE'&&m.file&&x.training_file_id===m.file.id)
        )
      ));
    }

    function myPending61(){
      return (state.retrainingEvents61||[]).filter(e=>e.user_id===state.user?.id&&e.status==='AWAITING_ACK');
    }

    function injectMySafety61(){
      const view=$61('mySafetyView'),stats=$61('mySafetyStats');
      if(!view||!stats)return;
      $61('retrain61MySafety')?.remove();
      const rows=myPending61();
      if(!rows.length)return;
      const box=document.createElement('div');
      box.id='retrain61MySafety';
      box.className='section-card retrain61-alert traffic-amber';
      box.innerHTML=`<div class="row-between"><div><h3>Retraining acknowledgement required</h3><p class="muted">${rows.length} instructor-led retraining record${rows.length===1?' is':'s are'} waiting for your acknowledgement.</p></div><button type="button" class="primary" data-retrain61-open-hs>Open H&amp;S Training</button></div>`;
      stats.insertAdjacentElement('afterend',box);
    }

    function pendingCards61(){
      const rows=myPending61();
      if(!rows.length)return '';
      return `<div id="retrain61Pending" class="section-card retrain61-pending"><div class="row-between"><div><h3>Additional retraining to acknowledge</h3><p class="muted">These are separate instructor-led retraining events. They do not replace the normal training record unless the Manager marked the event as counting as the scheduled refresher.</p></div><span class="badge due">${rows.length} action required</span></div><div class="card-list">${rows.map(e=>{
        const a=(state.trainingAssignments||[]).find(x=>x.id===e.assignment_id);
        const t=(state.training||[]).find(x=>x.id===e.training_session_id);
        const opened=a&&t?materialOpenedAfter61(e,a,t):false;
        return `<div class="item-card traffic-card traffic-amber">
          <div class="row-between"><div><strong>${esc61(e.training_reference_snapshot?e.training_reference_snapshot+' - '+e.training_name_snapshot:e.training_name_snapshot)}</strong>
          <div class="meta"><span>Instructor-led retraining</span><span>Delivered ${esc61(fmt61(e.delivery_date))}</span><span>${esc61(reasonLabel61(e.reason_code))}</span></div></div><span class="badge due">Awaiting your acknowledgement</span></div>
          <div class="muted">${esc61(e.reason_detail)}</div>
          <div class="row action-bar">
            ${a&&t?`<button type="button" class="${opened?'training-doc-opened':'training-doc-required'}" data-retrain61-open-material="${esc61(e.id)}">${opened?'Current material opened ✓':'Open current training material'}</button>`:''}
            <button type="button" class="primary" data-retrain61-ack="${esc61(e.id)}">Acknowledge retraining</button>
          </div>
        </div>`;
      }).join('')}</div></div>`;
    }

    renderMySafety=function(){
      const out=core.renderMySafety.apply(this,arguments);
      setTimeout(injectMySafety61,0);
      return out;
    };
    try{window.renderMySafety=renderMySafety}catch(_e){}

    renderHsTraining=function(){
      const out=core.renderHsTraining.apply(this,arguments);
      setTimeout(()=>{
        const list=$61('hsTrainingList');if(!list)return;
        $61('retrain61Pending')?.remove();
        const html=pendingCards61();if(!html)return;
        const wrap=document.createElement('div');wrap.innerHTML=html;
        list.insertAdjacentElement('beforebegin',wrap.firstElementChild);
      },0);
      return out;
    };
    try{window.renderHsTraining=renderHsTraining}catch(_e){}

    function showRetrainNow61(trainingId){
      if(!manager61())return toast61('Manager or Admin access required.');
      if(state.offline||!navigator.onLine)return toast61('Reconnect before recording retraining.');
      const t=(state.training||[]).find(x=>x.id===trainingId);
      if(!t||t.status==='ARCHIVED')return toast61('Active training item not found.');
      const assigns=(state.trainingAssignments||[]).filter(a=>a.training_session_id===trainingId&&a.active!==false);
      if(!assigns.length)return toast61('No active assignees are available for retraining.');

      const opts=assigns.map(a=>{
        const ps=prereq61(a,t),open=openEvent61(a),disabled=!ps.ready||!!open;
        const note=open?' · acknowledgement already pending':!ps.ready?' · prerequisites incomplete':'';
        return `<option value="${esc61(a.id)}" ${disabled?'disabled':''}>${esc61(person61(a.user_id)+note)}</option>`;
      }).join('');

      openModal('Retrain now',`
        <div class="hint-box"><strong>${esc61(trainingReference(t)?trainingReference(t)+' - '+t.name:t.name)}</strong><br>
        Record additional instructor-led retraining even when the normal assignment is still current. This creates a separate audit event and does not change the default training method.</div>
        <div class="form-grid">
          <label>Person<select id="retrain61Assignment"><option value="">Select person</option>${opts}</select></label>
          <label>Training date<input id="retrain61Date" type="date" max="${esc61(today61())}" value="${esc61(today61())}"></label>
          <label>Attendance<select id="retrain61Attendance"><option value="ATTENDED">Attended / retraining delivered</option><option value="ABSENT">Absent / did not attend</option></select></label>
          <label>Reason<select id="retrain61Reason">
            <option value="OBSERVED_PROCEDURE_GAP">Observed gap in procedure</option>
            <option value="CONTROL_NOT_FOLLOWED">Control not followed correctly</option>
            <option value="SUPERVISION_WEAKNESS">Supervision identified a weakness</option>
            <option value="PROCESS_EQUIPMENT_CHANGE">Process / equipment change</option>
            <option value="MANAGER_REQUESTED_REFRESHER">Manager-requested refresher</option>
            <option value="OTHER">Other factual reason</option>
          </select></label>
          <label class="full">Factual reason / detail<textarea id="retrain61Detail" rows="3" placeholder="Briefly record why this additional retraining was required."></textarea></label>
          <label class="full">Optional instructor note<textarea id="retrain61Note" rows="3" placeholder="Optional training points, demonstration or follow-up note."></textarea></label>
          <label class="check-row full"><input id="retrain61Counts" type="checkbox"> <strong>Counts as scheduled refresher — Yes</strong>. If ticked, the next due date will move from the successful retraining date after the employee acknowledges it. Leave unticked to keep the existing scheduled due date unchanged.</label>
        </div>
        <div class="hint-box">An attended event remains <strong>Awaiting employee acknowledgement</strong> until that person opens the current training material and confirms the retraining themselves. An absence is kept as an audit event and never resets the normal schedule.</div>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-retrain61-save="${esc61(trainingId)}">Save retraining attendance</button></div>
      `);

      const attendance=$61('retrain61Attendance'),counts=$61('retrain61Counts');
      attendance?.addEventListener('change',()=>{if(counts){counts.disabled=attendance.value==='ABSENT';if(counts.disabled)counts.checked=false}});
    }

    async function saveRetrain61(trainingId){
      const aid=$61('retrain61Assignment')?.value||'',a=(state.trainingAssignments||[]).find(x=>x.id===aid);
      const t=(state.training||[]).find(x=>x.id===trainingId);
      if(!a||!t)return toast61('Select a person.');
      const ps=prereq61(a,t);
      if(!ps.ready)return toast61(`Retraining blocked — complete prerequisite training first: ${(ps.blocked||[]).map(x=>x.doc?.reference||'prerequisite').join(', ')}`);
      if(openEvent61(a))return toast61('This person already has retraining awaiting acknowledgement.');
      const detail=clean61($61('retrain61Detail')?.value),note=clean61($61('retrain61Note')?.value);
      if(detail.length<5)return toast61('Add a short factual reason for the retraining.');
      const attendance=$61('retrain61Attendance')?.value||'ATTENDED';
      const counts=attendance==='ATTENDED'&&!!$61('retrain61Counts')?.checked;
      const r=await sb.rpc('record_training_retraining_v21061',{
        p_assignment_id:a.id,
        p_reason_code:$61('retrain61Reason')?.value||'OTHER',
        p_reason_detail:detail,
        p_manager_note:note||null,
        p_counts_as_scheduled_refresher:counts,
        p_delivery_date:$61('retrain61Date')?.value||today61(),
        p_attendance_status:attendance,
        p_instructor_name:clean61(state.profile?.display_name||state.user?.email||'Authenticated instructor')
      });
      if(r.error)return toast61(r.error.message||'Could not record retraining.');
      closeModal();
      await refresh(attendance==='ABSENT'?'Retraining absence recorded. The normal training schedule is unchanged.':counts?'Retraining recorded. Employee acknowledgement is required before the refresher date resets.':'Retraining recorded. Employee acknowledgement is required; the normal scheduled due date will remain unchanged.');
    }

    function showAck61(eventId){
      const e=(state.retrainingEvents61||[]).find(x=>x.id===eventId);
      if(!e||e.user_id!==state.user?.id||e.status!=='AWAITING_ACK')return toast61('This retraining event is not awaiting your acknowledgement.');
      const a=(state.trainingAssignments||[]).find(x=>x.id===e.assignment_id),t=(state.training||[]).find(x=>x.id===e.training_session_id);
      if(!a||!t)return toast61('Training assignment not found.');
      const opened=materialOpenedAfter61(e,a,t);
      openModal('Acknowledge retraining',`
        <p><strong>${esc61(e.training_reference_snapshot?e.training_reference_snapshot+' - '+e.training_name_snapshot:e.training_name_snapshot)}</strong></p>
        <div class="meta"><span>Retraining date ${esc61(fmt61(e.delivery_date))}</span><span>Instructor ${esc61(e.instructor_name_snapshot)}</span></div>
        <div class="hint-box"><strong>Reason recorded:</strong> ${esc61(reasonLabel61(e.reason_code))}<br>${esc61(e.reason_detail)}</div>
        <div class="${opened?'success-note':'pending-use-warning'}">${opened?'✓ Current training material opened after this retraining was recorded.':'Open the current training material before acknowledging this retraining.'}</div>
        <div class="row"><button type="button" class="secondary" data-retrain61-open-material="${esc61(e.id)}">${opened?'Open material again':'Open current training material'}</button></div>
        <div class="hint-box"><strong>Schedule effect:</strong> ${e.counts_as_scheduled_refresher?'This will count as the scheduled refresher. After acknowledgement, the next due date is calculated from the retraining delivery date.':'This is additional/remedial retraining only. Your existing scheduled refresher due date is not changed.'}</div>
        <label class="check-row"><input id="retrain61AckCheck" type="checkbox"> I confirm I attended this additional instructor-led retraining, understood the relevant controls, and had the opportunity to ask questions.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-retrain61-confirm="${esc61(e.id)}">Confirm retraining</button></div>
      `);
    }

    async function confirmAck61(eventId){
      const e=(state.retrainingEvents61||[]).find(x=>x.id===eventId);
      const a=(state.trainingAssignments||[]).find(x=>x.id===e?.assignment_id),t=(state.training||[]).find(x=>x.id===e?.training_session_id);
      if(!e||!a||!t)return;
      if(!materialOpenedAfter61(e,a,t))return toast61('Open the current training material after the retraining event before acknowledging it.');
      if(!$61('retrain61AckCheck')?.checked)return toast61('Tick the retraining acknowledgement first.');
      const r=await sb.rpc('acknowledge_training_retraining_v21061',{
        p_event_id:eventId,
        p_acknowledgement_name:clean61(state.profile?.display_name||state.user?.email||'Authenticated user')
      });
      if(r.error)return toast61(r.error.message||'Could not save the retraining acknowledgement.');
      closeModal();
      await refresh(e.counts_as_scheduled_refresher?'Retraining acknowledged. The next scheduled due date now runs from the retraining date.':'Retraining acknowledged. Your existing scheduled due date is unchanged.');
    }

    async function openMaterial61(eventId){
      const e=(state.retrainingEvents61||[]).find(x=>x.id===eventId);
      const a=(state.trainingAssignments||[]).find(x=>x.id===e?.assignment_id);
      if(!e||!a)return toast61('Retraining assignment not found.');
      await openRequiredTrainingMaterial(a.id);
      await loadEvents61();
      renderMySafety();renderHsTraining();
      if($61('modal')?.open&&$61('retrain61AckCheck'))showAck61(eventId);
    }

    function historyHtml61(trainingId){
      const rows=eventsForTraining61(trainingId);
      if(!rows.length)return '<div class="muted">No additional retraining events recorded.</div>';
      return `<div class="card-list retrain61-history">${rows.map(e=>{
        const status=e.status==='COMPLETED'?'Completed':e.status==='ABSENT'?'Absent':'Awaiting acknowledgement';
        const badge=e.status==='COMPLETED'?'complete':e.status==='ABSENT'?'overdue':'due';
        return `<div class="item-card compact">
          <div class="row-between"><div><strong>${esc61(e.user_name_snapshot)}</strong><div class="meta"><span>${esc61(fmt61(e.delivery_date))}</span><span>${esc61(reasonLabel61(e.reason_code))}</span><span>Instructor ${esc61(e.instructor_name_snapshot)}</span></div></div><span class="badge ${badge}">${esc61(status)}</span></div>
          <div class="muted">${esc61(e.reason_detail)}</div>
          <div class="meta"><span>${e.counts_as_scheduled_refresher?'Counts as scheduled refresher':'Additional retraining · schedule unchanged'}</span>${e.acknowledged_at?`<span>Acknowledged ${esc61(fmtDT61(e.acknowledged_at))}</span>`:''}</div>
          ${e.manager_note?`<div class="muted">Note: ${esc61(e.manager_note)}</div>`:''}
        </div>`;
      }).join('')}</div>`;
    }

    showTrainingDetails=function(id){
      const out=core.showTrainingDetails.apply(this,arguments);
      setTimeout(()=>{
        const t=(state.training||[]).find(x=>x.id===id),body=$61('modalBody');
        if(!t||!body||$61('retrain61Details'))return;
        const assigns=(state.trainingAssignments||[]).filter(a=>a.training_session_id===id&&a.active!==false);
        const sec=document.createElement('div');sec.id='retrain61Details';sec.className='section-card';
        sec.innerHTML=`<div class="row-between"><div><h4>Additional retraining</h4><p class="muted">Instructor-led retraining can be recorded at any time without changing the normal training method.</p></div>${manager61()&&assigns.length?`<button type="button" class="primary" data-retrain61-start="${esc61(id)}">Retrain now</button>`:''}</div>${manager61()?historyHtml61(id):''}`;
        body.appendChild(sec);
      },0);
      return out;
    };
    try{window.showTrainingDetails=showTrainingDetails}catch(_e){}

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b)return;
      if(b.dataset.retrain61OpenHs){
        e.preventDefault();e.stopImmediatePropagation();
        try{showView('hsTraining')}catch(_e){}
        return;
      }
      if(b.dataset.retrain61Start){
        e.preventDefault();e.stopImmediatePropagation();
        return showRetrainNow61(b.dataset.retrain61Start);
      }
      if(b.dataset.retrain61Save){
        e.preventDefault();e.stopImmediatePropagation();
        return saveRetrain61(b.dataset.retrain61Save);
      }
      if(b.dataset.retrain61Ack){
        e.preventDefault();e.stopImmediatePropagation();
        return showAck61(b.dataset.retrain61Ack);
      }
      if(b.dataset.retrain61Confirm){
        e.preventDefault();e.stopImmediatePropagation();
        return confirmAck61(b.dataset.retrain61Confirm);
      }
      if(b.dataset.retrain61OpenMaterial){
        e.preventDefault();e.stopImmediatePropagation();
        return openMaterial61(b.dataset.retrain61OpenMaterial);
      }
    },true);

    if(!document.getElementById('retrain61Styles')){
      const s=document.createElement('style');s.id='retrain61Styles';s.textContent=`
        .retrain61-alert{margin-top:12px}.retrain61-pending{margin-bottom:14px}
        .retrain61-history{margin-top:10px}.retrain61-history .item-card{margin-bottom:8px}
        @media(max-width:680px){.retrain61-alert>.row-between,.retrain61-pending>.row-between,#retrain61Details>.row-between{display:block}.retrain61-alert button,#retrain61Details>.row-between button{width:100%;margin-top:9px}}
      `;document.head.appendChild(s);
    }

    loadEvents61().then(()=>{try{renderMySafety();renderHsTraining()}catch(_e){}});

    window.SafetyRetrainNowV21061={
      BUILD,
      load:loadEvents61,
      eventsForTraining:eventsForTraining61,
      show:showRetrainNow61
    };
  }

  boot();
})();
