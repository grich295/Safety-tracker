/* Safety Tracker v2.10.29 administrator training-exception hotfix */
'use strict';

showTrainingException=function(id){
  if(!isAdmin())return toast('Admin access is required for a training exception.');
  const a=state.trainingAssignments.find(x=>x.id===id),t=state.training.find(x=>x.id===a?.training_session_id);if(!a||!t)return;
  const deps=trainingDependencyState(t);if(!deps.ready)return toast(trainingDependencyMessage(t));
  if(a.user_id!==state.user?.id)return toast('A training exception can only be completed for your own assignment.');
  const status=assignmentStatus(a,t);if(status.code==='COMPLETED')return toast('This training assignment is already complete.');if(status.method!=='INSTRUCTOR_LED')return toast('The exception is only available for instructor-led training.');if(status.ready)return toast('Instructor attendance has already been confirmed. Use Sign attendance instead.');
  if(!requiredTrainingMaterialOpened(a,t))return toast(`Open the required current training file before using the exception: ${requiredTrainingMaterialLabel(a,t)}`);
  const mats=requiredTrainingMaterials(a,t),opened=mats.filter(m=>trainingMaterialOpenedSince(m,a)).length;
  openModal('Complete training as admin exception',`<p><strong>${esc(t.name)}</strong></p><div class="success-note">✓ Required training material opened and recorded (${opened}/${mats.length||1}).</div><div class="hint-box"><strong>Administrator exception.</strong> Use this only for your own instructor-led assignment when an independent instructor confirmation is not available. The reason, your authenticated identity and date/time are retained as separate compliance evidence. This does not create an instructor attendance record.</div><label>Reason for exception<textarea id="trainingExceptionReason" rows="4" minlength="10" placeholder="Enter at least 10 characters explaining why instructor confirmation is unavailable."></textarea><span id="trainingExceptionValidation" class="muted">Minimum 10 characters.</span></label><div class="hint-box"><strong>Authenticated acknowledgement.</strong> Your signed-in account, date and time are recorded automatically. No drawn signature is required.</div><label class="check-row"><input id="trainingExceptionAck" type="checkbox"> I confirm this is my own training assignment and the exception reason is accurate.</label><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Complete as exception','danger',`id="trainingExceptionSubmit" data-confirm-training-exception="${id}"`)}</div>`);
  const reasonBox=$('trainingExceptionReason'),validation=$('trainingExceptionValidation');reasonBox?.addEventListener('input',()=>{const n=clean(reasonBox.value).length;if(validation)validation.textContent=n>=10?`✓ Reason entered (${n} characters)`:`Minimum 10 characters (${n}/10).`});
};

confirmTrainingException=async function(id){
  if(!isAdmin())return toast('Admin access is required for a training exception.');
  const a=state.trainingAssignments.find(x=>x.id===id),t=state.training.find(x=>x.id===a?.training_session_id);if(!a||!t||a.user_id!==state.user?.id)return toast('This exception can only be used for your own assignment.');
  const deps=trainingDependencyState(t);if(!deps.ready)return toast(trainingDependencyMessage(t));
  const status=assignmentStatus(a,t);if(status.code==='COMPLETED')return toast('This training assignment is already complete.');if(status.method!=='INSTRUCTOR_LED'||status.ready)return toast('This assignment is not eligible for an administrator exception.');
  if(!requiredTrainingMaterialOpened(a,t))return toast(`Open the required current training file before using the exception: ${requiredTrainingMaterialLabel(a,t)}`);
  const reason=clean($('trainingExceptionReason')?.value),sigName=clean(state.profile?.display_name||state.user?.email||'Authenticated user');
  if(reason.length<10){const v=$('trainingExceptionValidation');if(v)v.textContent=`Reason is too short (${reason.length}/10). Enter at least 10 characters.`;return toast('Exception reason must be at least 10 characters.');}
  if(!$('trainingExceptionAck')?.checked)return toast('Tick the exception confirmation first.');
  const statement='Administrator training exception: I confirm this is my own instructor-led training assignment. I have reviewed/completed the required training content and controls. An independent instructor confirmation is not available for the recorded reason, so I am using the administrator exception.';
  const submit=$('trainingExceptionSubmit');if(submit){submit.disabled=true;submit.textContent='Saving…'}
  const r=await sb.from('training_exceptions').insert({training_assignment_id:id,training_session_id:t.id,user_id:state.user.id,reason,statement_snapshot:statement,signature_data:'ACK:'+state.user.id+':'+new Date().toISOString(),signature_name:sigName});
  if(r.error){if(submit){submit.disabled=false;submit.textContent='Complete as exception'}const raw=String(r.error.message||'');if(raw.includes('Open the required current training file'))return toast(`Open all required training material before completing: ${requiredTrainingMaterialLabel(a,t)}`);if(raw.includes('controlled source')||raw.includes('approved/current'))return toast(trainingDependencyMessage(t)||raw);return toast(raw.includes('training_exceptions')?'Training exception could not be saved. Refresh once and try again; if it remains, check the database migration.':raw)}
  if(t.source_document_id){const v=state.versions.find(x=>x.id===t.source_document_version_id)||currentVersion(t.source_document_id);if(v)await logDocumentActivity('TRAINING_COMPLETED',{...activityVersionSnapshot(v),training_session_id:t.id,source_context:'TRAINING',metadata:{completion_mode:'ADMIN_EXCEPTION'}},null,false)}else{const f=latestTrainingFile(t.id);if(f)await logDocumentActivity('TRAINING_COMPLETED',{...activityTrainingFileSnapshot(f),source_context:'TRAINING',metadata:{completion_mode:'ADMIN_EXCEPTION'}},null,false)}
  closeModal();await refresh('Training completed using the administrator exception.');
};

if(typeof renderHelp==='function'){
  const renderHelpV21029=renderHelp;
  renderHelp=function(){const r=renderHelpV21029.apply(this,arguments);const h=$('helpContent');if(h)h.innerHTML=h.innerHTML.replaceAll('v2.10.28 CLEAN','v2.10.29 CLEAN');return r;};
}
window.__SAFETY_HOTFIX='v2.10.29-live';
