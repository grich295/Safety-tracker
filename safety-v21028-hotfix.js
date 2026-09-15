/* Safety Tracker v2.10.28 hotfix overlay
 * Baseline: v2.10.27
 * - Fixes missing previousMonthValue()
 * - Makes document training frequency discoverable as "Training settings"
 * - Saves training method + repeat schedule from the Training settings modal
 * - Propagates changed renewal settings to active auto-managed assignments
 * - Keeps document review date independent from training renewal frequency
 */
(function(){
  'use strict';

  // v2.10.27 references this helper in Reports but does not define it.
  window.previousMonthValue = function previousMonthValue(){
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
  };

  function trainingFrequencyText(d){
    if(!d) return '';
    if(d.training_schedule_mode === 'ONE_OFF') return 'One-off';
    if(d.default_renewal_value && d.default_renewal_unit){
      try { return renewalText(d.default_renewal_value,d.default_renewal_unit,false); }
      catch(_) { return `Every ${d.default_renewal_value} ${String(d.default_renewal_unit).toLowerCase()}`; }
    }
    return 'Schedule not set';
  }

  function relabelDocumentTrainingSettings(){
    try{
      document.querySelectorAll('[data-edit-doc-audience]').forEach(function(b){
        b.textContent = 'Training settings';
        const id = b.dataset.editDocAudience;
        const d = (typeof state !== 'undefined' && state.documents) ? state.documents.find(x=>x.id===id) : null;
        const card = b.closest('.item-card');
        if(card && d){
          let line = card.querySelector('[data-v21028-training-frequency]');
          if(!line){
            line = document.createElement('div');
            line.className = 'muted';
            line.setAttribute('data-v21028-training-frequency','');
            const action = card.querySelector('.action-bar');
            if(action) card.insertBefore(line,action); else card.appendChild(line);
          }
          const method = d.delivery_method === 'INSTRUCTOR_LED' ? 'Instructor-led' : 'Self-training';
          line.textContent = `Training: ${method} · ${trainingFrequencyText(d)}`;
        }
      });
    }catch(e){ console.warn('v2.10.28 training-settings label',e); }
  }

  // Preserve the current renderer but improve the visible control after every render.
  if(typeof window.renderDocuments === 'function'){
    const renderDocumentsV21027 = window.renderDocuments;
    window.renderDocuments = function renderDocumentsV21028(){
      const result = renderDocumentsV21027.apply(this,arguments);
      relabelDocumentTrainingSettings();
      return result;
    };
  }

  // Replace the old "Training audience" modal with a true Training settings modal.
  window.showDocumentAudience = function showDocumentAudienceV21028(id){
    if(!isManager()) return;
    const d = state.documents.find(x=>x.id===id), v = approvedCurrentVersion(id);
    if(!d || !v) return toast('Only an approved/current document can have training settings.');
    if(!documentUsesFormalTraining(d)) return toast('Training settings apply to approved Risk Assessments, COSHH Risk Assessments and SSW documents.');

    openModal('Training settings',
      `<div class="section-card"><h3>${esc(d.reference?d.reference+' - '+documentDisplayTitle(d):documentDisplayTitle(d))}</h3>`+
      `<div class="meta"><span class="badge complete">Approved/current · v${esc(v.version_label||'—')}</span></div>`+
      `<div class="hint-box"><strong>Training settings are separate from the document review date.</strong> `+
      `Change the training method, refresher frequency and audience here. The approved PDF is not changed, and completed sign-offs/evidence are retained.</div></div>`+
      `${approvalTrainingScheduleHtml(d)}${approvalAudienceHtml(d)}`+
      `<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save training settings','primary',`data-save-doc-audience="${d.id}"`)}</div>`
    );
    wireRenewal('approvalTraining');
    wireApprovalAudience();
  };

  // v2.10.27 displayed a repeat-schedule selector in this modal but only saved the audience.
  // v2.10.28 persists both the schedule/method and audience, then syncs the generated training records.
  window.saveDocumentAudience = async function saveDocumentAudienceV21028(id){
    if(!isManager()) return;
    const d = state.documents.find(x=>x.id===id), v = approvedCurrentVersion(id);
    if(!d || !v) return toast('Approved/current document not found.');

    const schedule = getRenewal('approvalTraining');
    if(!schedule.mode) return toast('Choose a training repeat schedule before saving.');
    if(schedule.mode === 'RECURRING' && (!schedule.value || !schedule.unit)) return toast('Enter a valid training repeat schedule.');

    const delivery = $('approvalTrainingDelivery')?.value || d.delivery_method || sourceDelivery(d.doc_type);
    const audience = approvalAudienceSelection();

    const up = await sb.from('documents').update({
      delivery_method: delivery,
      default_renewal_value: schedule.value,
      default_renewal_unit: schedule.unit,
      training_schedule_mode: schedule.mode
    }).eq('id',id).select().maybeSingle();
    if(up.error) return toast(up.error.message);

    const ar = await sb.rpc('set_document_training_audience_v230',{
      p_document_id:id,
      p_everyone:audience.everyone,
      p_department_ids:audience.departmentIds,
      p_user_ids:audience.userIds,
      p_due_days:audience.dueDays
    });
    if(ar.error) return toast(`Training schedule saved, but audience update failed: ${ar.error.message}`);

    // Reload document defaults, propagate renewal settings to the auto-managed training session
    // and active assignments. assignmentStatus() calculates future renewal from the most recent
    // completion/sign-off, so changing 3/6/12 months recalculates the displayed next due date.
    await loadAll();
    let syncChanges = 0;
    try { syncChanges = Number(await syncSourceTrainings() || 0); }
    catch(e){ console.warn('v2.10.28 source training sync',e); }

    const sr = await sb.rpc('sync_training_audience_assignments_v230',{p_document_id:id,p_user_id:null});
    if(sr.error) return toast(`Training settings saved, but assignment sync failed: ${sr.error.message}`);

    closeModal();
    await refresh(`Training settings updated. ${Number(sr.data||0)} audience assignment change${Number(sr.data||0)===1?'':'s'} applied${syncChanges?` · ${syncChanges} training record update${syncChanges===1?'':'s'}`:''}.`);
  };

  // Relabel existing cards on initial load and any subsequent DOM rebuild.
  const observer = new MutationObserver(function(){ relabelDocumentTrainingSettings(); });
  function start(){
    relabelDocumentTrainingSettings();
    if(document.body) observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  // Apply visible build labels after the base app has loaded.
  try{
    if(window.SAFETY_BUILD){
      window.SAFETY_BUILD.version='2.10.28';
      window.SAFETY_BUILD.label='2.10.28 CLEAN';
      window.SAFETY_BUILD.build='21028';
      window.applySafetyBuildLabel?.();
    }
  }catch(e){ console.warn('v2.10.28 build label',e); }

  window.SafetyTrackerV21028Hotfix = true;
})();
