/* Safety Tracker v1.7.1 patch
   Requires app-v161.js and bulk-import-v161.js to be loaded first.
   Documents = controlled source library. RA/COSHH/SSW learning/sign-off = Training.
*/
(() => {
'use strict';

const V171='1.7.1';
const refRx=/\b(?:RA|COSHH|SSW|PROC)-\d{3}\b/gi;
const tbtRx=/\bTBT-\d{3}\b/i;
const sourceDocTypes=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
const originals={
  loadAll,
  refresh,
  renderDocuments,
  renderTraining,
  showNewDocument,
  showNewTraining,
  saveTraining,
  showTrainingDetails,
  showDocumentLinks,
  downloadBackup: typeof downloadBackup==='function'?downloadBackup:null,
  downloadFullBackup: typeof downloadFullBackup==='function'?downloadFullBackup:null
};

state.trainingDocumentLinks=state.trainingDocumentLinks||[];
state.v171SchemaReady=false;
let syncBusy=false;

const plusYear=iso=>{const d=new Date((iso||todayISO())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)};
const createdDate=x=>x?.created_at?new Date(x.created_at).toLocaleDateString('sv-SE',{timeZone:'Europe/London'}):todayISO();
const kindOf=t=>t?.source_kind || t?.session_type || 'OTHER';
const kindLabel=k=>({RISK_ASSESSMENT:'Risk Assessment',COSHH:'COSHH Assessment',SSW:'Safe System of Work',TOOLBOX_TALK:'Toolbox Talk',INDUCTION:'Induction',REFRESHER:'Refresher',AD_HOC:'Ad-hoc training',OTHER:'Other training'})[k]||String(k||'Training').replaceAll('_',' ');
const sourceDelivery=docType=>docType==='SSW'?'INSTRUCTOR_LED':'SELF_TRAINING';
const sourceName=d=>`${d.reference?d.reference+' - ':''}${d.title}`;
const trainingLinks=tId=>(state.trainingDocumentLinks||[]).filter(l=>l.training_session_id===tId);
const linkedTrainingDocs=tId=>trainingLinks(tId).map(l=>({link:l,doc:state.documents.find(d=>d.id===l.document_id)})).filter(x=>x.doc);
const sourceForTraining=t=>state.documents.find(d=>d.id===t?.source_document_id)||linkedTrainingDocs(t?.id).find(x=>x.link.link_role==='SOURCE')?.doc||null;
const currentV=d=>d?currentVersion(d.id):null;
const uniq=a=>[...new Set(a.filter(Boolean))];
const htmlDate=d=>d||'';

function trainingReference(t){
  if(t?.reference)return t.reference;
  const m=String(t?.name||'').match(/\bTBT-\d{3}\b/i);
  return m?m[0].toUpperCase():'';
}
function trainingSearchText(t){
  const docs=linkedTrainingDocs(t.id).map(x=>`${x.doc.reference||''} ${x.doc.title}`).join(' ');
  return `${t.name||''} ${t.reference||''} ${t.description||''} ${docs}`.toLowerCase();
}
function presetFor(value,unit){
  if(!value||!unit)return '';
  const p=`${Number(value)}|${unit}`;
  return ['3|MONTHS','6|MONTHS','12|MONTHS','24|MONTHS'].includes(p)?p:'CUSTOM';
}
function renewalFields(prefix,value=null,unit=null){
  const p=presetFor(value,unit);
  return `<label>Sign-off / refresher frequency<select id="${prefix}RenewalPreset">
    <option value="" ${!p?'selected':''}>One-off only</option>
    <option value="3|MONTHS" ${p==='3|MONTHS'?'selected':''}>Every 3 months</option>
    <option value="6|MONTHS" ${p==='6|MONTHS'?'selected':''}>Every 6 months</option>
    <option value="12|MONTHS" ${p==='12|MONTHS'?'selected':''}>Every 12 months</option>
    <option value="24|MONTHS" ${p==='24|MONTHS'?'selected':''}>Every 24 months</option>
    <option value="CUSTOM" ${p==='CUSTOM'?'selected':''}>Custom</option>
  </select></label>
  <div id="${prefix}CustomRenewal" class="full" ${p==='CUSTOM'?'':'hidden'}><div class="form-grid">
    <label>Every<input id="${prefix}RenewalValue" type="number" min="1" value="${p==='CUSTOM'?esc(value||''):''}"></label>
    <label>Unit<select id="${prefix}RenewalUnit"><option ${unit==='DAYS'?'selected':''}>DAYS</option><option ${unit==='MONTHS'||!unit?'selected':''}>MONTHS</option><option ${unit==='YEARS'?'selected':''}>YEARS</option></select></label>
  </div></div>`;
}
function getRenewal(prefix){
  const p=$(prefix+'RenewalPreset')?.value||'';
  if(!p)return {value:null,unit:null};
  if(p==='CUSTOM')return {value:Number($(prefix+'RenewalValue')?.value)||null,unit:$(prefix+'RenewalUnit')?.value||'MONTHS'};
  const [v,u]=p.split('|');return {value:Number(v),unit:u};
}

async function loadAll171(){
  await originals.loadAll();
  const r=await sb.from('training_document_links').select('*');
  if(r.error){
    state.trainingDocumentLinks=[];
    state.v171SchemaReady=false;
  }else{
    state.trainingDocumentLinks=r.data||[];
    state.v171SchemaReady=true;
  }
  updateTrainingFilter();
  injectV171UI();
}
loadAll=loadAll171;

function updateTrainingFilter(){
  const el=$('trainingTypeFilter');if(!el)return;
  const keep=el.value;
  const kinds=['RISK_ASSESSMENT','COSHH','SSW','TOOLBOX_TALK','INDUCTION','REFRESHER','AD_HOC','OTHER'];
  el.innerHTML='<option value="">All types</option>'+kinds.map(k=>`<option value="${k}">${esc(kindLabel(k))}</option>`).join('');
  if(kinds.includes(keep))el.value=keep;
}

function injectV171UI(){
  document.querySelector('.topbar .version')?.replaceChildren(document.createTextNode('v'+V171));
  const dp=$('documentsView')?.querySelector('.page-heading .muted');if(dp)dp.textContent='Controlled source library: RA, COSHH, SSW, SDS, policies and procedures. Training/sign-off is managed in Training.';
  const tp=$('trainingView')?.querySelector('.page-heading .muted');if(tp)tp.textContent='All learning and acknowledgement activity, including RA, COSHH, SSW and Toolbox Talks.';
  const pp=$('peopleView')?.querySelector('.page-heading .muted');if(pp)pp.textContent='Manage active users. Assign learning from the Training area.';
  const mp=$('mySafetyView')?.querySelector('.page-heading .muted');if(mp)mp.textContent='Your assigned safety training and acknowledgements.';

  const admin=$('adminView');

}

function renderDocuments171(){
  const q=($('documentSearch')?.value||'').toLowerCase(),type=$('documentTypeFilter')?.value||'',status=$('documentStatusFilter')?.value||'ACTIVE';
  let rows=state.documents.filter(d=>(!q||`${d.title} ${d.reference||''}`.toLowerCase().includes(q))&&(!type||d.doc_type===type)&&(!status||d.status===status));
  rows.sort((a,b)=>(a.reference||a.title).localeCompare(b.reference||b.title,undefined,{numeric:true}));
  const list=$('documentsList');if(!list)return;
  list.innerHTML=rows.length?rows.map(d=>{
    const v=currentVersion(d.id),links=linksForDocument(d.id),overdue=v?.review_date&&v.review_date<todayISO(),soon=v?.review_date&&v.review_date>=todayISO()&&v.review_date<=daysFromNow(30);
    const reviewFlag=d.review_required?`<span class="badge overdue">Review required</span>`:overdue?`<span class="badge overdue">Review overdue</span>`:soon?`<span class="badge due">Review due soon</span>`:'';
    return `<div class="item-card"><div class="row-between"><div><h3>${esc(d.reference?d.reference+' - '+d.title:d.title)}</h3><div class="meta"><span class="badge">${esc(docTypeLabel(d.doc_type))}</span><span>Version ${esc(v?.version_label||'—')}</span><span>Issue: ${fmtDate(v?.issue_date)}</span><span>Review: ${fmtDate(v?.review_date)}</span>${reviewFlag}</div></div><span class="badge">${links.length} link${links.length===1?'':'s'}</span></div>
      ${d.review_required&&d.review_reason?`<div class="request-note">${esc(d.review_reason)}</div>`:''}
      <div class="row">${v?btn('Open','secondary',`data-open-doc="${v.id}"`):''}${btn('Links','secondary',`data-doc-links="${d.id}"`)}${btn('Details','ghost',`data-doc-details="${d.id}"`)}${isManager()&&d.doc_type!=='SDS'?btn('Review','ghost',`data-record-doc-review="${d.id}"`):''}${isManager()?btn('New version','primary',`data-new-version="${d.id}"`):''}${isManager()?btn(d.status==='ARCHIVED'?'Restore':'Archive','ghost',`data-toggle-doc="${d.id}"`):''}</div></div>`;
  }).join(''):'<div class="empty">No controlled documents found.</div>';
}
renderDocuments=renderDocuments171;

function renderTraining171(){
  const q=($('trainingSearch')?.value||'').toLowerCase(),type=$('trainingTypeFilter')?.value||'';
  let rows=state.training.filter(t=>t.status!=='ARCHIVED'&&(!q||trainingSearchText(t).includes(q))&&(!type||kindOf(t)===type));
  rows.sort((a,b)=>String(trainingReference(a)||a.name).localeCompare(String(trainingReference(b)||b.name),undefined,{numeric:true}));
  const list=$('trainingList');if(!list)return;
  list.innerHTML=rows.length?rows.map(t=>{
    const assigns=state.trainingAssignments.filter(a=>a.training_session_id===t.id&&a.active!==false),signs=state.trainingSignoffs.filter(s=>assigns.some(a=>a.id===s.training_assignment_id)),done=new Set(signs.map(s=>s.user_id)).size;
    const overdue=t.review_date&&t.review_date<todayISO(),src=sourceForTraining(t),ref=trainingReference(t),flag=t.review_required?'<span class="badge overdue">Linked document changed</span>':overdue?'<span class="badge overdue">Review overdue</span>':'';
    return `<div class="item-card"><div class="row-between"><div><h3>${esc(ref&& !String(t.name).toUpperCase().includes(ref)?ref+' - '+t.name:t.name)}</h3><div class="meta"><span class="badge">${esc(kindLabel(kindOf(t)))}</span><span>${deliveryText(t.delivery_method||defaultTrainingDelivery(t.session_type))}</span><span>${renewalText(t.renewal_value,t.renewal_unit)}</span><span>Review: ${fmtDate(t.review_date)}</span>${t.auto_managed?'<span class="badge">Auto-managed</span>':''}${flag}</div></div><span class="badge">${done}/${assigns.length} signed</span></div>
      ${src?`<div class="muted">Source: ${esc(src.reference||'')} ${esc(src.title)}</div>`:''}${t.review_required&&t.review_reason?`<div class="request-note">${esc(t.review_reason)}</div>`:''}
      <div class="row">${btn('View','secondary',`data-view-training="${t.id}"`)}${isManager()?btn('Assign','secondary',`data-assign-training="${t.id}"`)+btn('Edit','ghost',`data-v171-edit-training="${t.id}"`)+btn('Archive','ghost',`data-archive-training="${t.id}"`):''}</div></div>`;
  }).join(''):'<div class="empty">No training found.</div>';
}
renderTraining=renderTraining171;

function showNewDocument171(){
  originals.showNewDocument();
  const issue=$('docIssue'),review=$('docReview'),type=$('docType');
  if(issue&&!issue.value)issue.value=todayISO();
  const setReview=()=>{if(!review||!type)return;if(type.value==='SDS')review.value='';else if(!review.value)review.value=plusYear(issue?.value||todayISO())};
  setReview();
  issue?.addEventListener('change',()=>{if(type?.value!=='SDS')review.value=plusYear(issue.value||todayISO())});
  type?.addEventListener('change',setReview);
}
showNewDocument=showNewDocument171;

function docPickerHtml(prefix){
  const docs=state.documents.filter(d=>d.status!=='ARCHIVED').sort((a,b)=>(a.reference||a.title).localeCompare(b.reference||b.title,undefined,{numeric:true}));
  return `<div class="full"><label>Link relevant controlled documents<input id="${prefix}DocSearch" placeholder="Search by RA/COSHH/SSW/SDS reference or title"></label><div id="${prefix}DocChoices" class="checkbox-list" style="margin-top:8px">${docs.map(d=>`<label class="check-row v171-doc-choice" data-search="${esc(`${d.doc_type} ${d.reference||''} ${d.title}`.toLowerCase())}"><input type="checkbox" class="${prefix}-doc-link" value="${d.id}"><span><strong>${esc(d.reference||docTypeLabel(d.doc_type))}</strong> · ${esc(d.title)} <span class="muted">(${esc(docTypeLabel(d.doc_type))})</span></span></label>`).join('')}</div></div>`;
}
function setupDocPicker(prefix){
  const input=$(prefix+'DocSearch');if(!input)return;
  input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();document.querySelectorAll(`#${prefix}DocChoices .v171-doc-choice`).forEach(x=>x.hidden=!!q&&!x.dataset.search.includes(q))});
}

function showNewTraining171(){
  openModal('New training session',`<div class="form-grid">
    <label>Training name<input id="trainName"></label>
    <label>Type<select id="trainType"><option value="AD_HOC">Ad-hoc training</option><option value="TOOLBOX_TALK">Toolbox Talk</option><option value="INDUCTION">Induction</option><option value="REFRESHER">Refresher</option><option value="OTHER">Other</option></select></label>
    <label>Delivery method<select id="trainDelivery"><option value="SELF_TRAINING">Self-training</option><option value="INSTRUCTOR_LED">Instructor-led</option></select></label>
    <label>Default completion due date<input id="trainDefaultDue" type="date" value="${daysFromNow(14)}"></label>
    <label>Date delivered<input id="trainDate" type="date" value="${todayISO()}"></label>
    <label>Trainer / presenter<input id="trainTrainer" value="${esc(state.profile?.display_name||'')}"></label>
    <label>Review date<input id="trainReview" type="date" value="${plusYear(todayISO())}"></label>
    ${renewalFields('train')}
    <label class="full">Details<textarea id="trainDesc"></textarea></label>
    ${state.v171SchemaReady?docPickerHtml('train'):''}
    <label class="full">Upload supporting files<input id="trainFiles" type="file" multiple></label>
  </div><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Create training','primary','id="saveTraining"')}</div>`);
  const syncDelivery=()=>{$('trainDelivery').value=defaultTrainingDelivery($('trainType').value)};
  $('trainType')?.addEventListener('change',syncDelivery);syncDelivery();
  $('trainRenewalPreset')?.addEventListener('change',()=>{$('trainCustomRenewal').hidden=$('trainRenewalPreset').value!=='CUSTOM'});
  setupDocPicker('train');
}
showNewTraining=showNewTraining171;

async function saveTraining171(){
  const name=$('trainName')?.value.trim();if(!name)return toast('Training name is required.');
  const r=getRenewal('train'),type=$('trainType').value;
  const payload={name,session_type:type,delivery_method:$('trainDelivery').value,description:$('trainDesc').value.trim()||null,delivered_date:$('trainDate').value||null,trainer_name:$('trainTrainer').value.trim()||null,trainer_user_id:state.user.id,review_date:$('trainReview').value||plusYear(todayISO()),default_due_date:$('trainDefaultDue').value||null,renewal_value:r.value,renewal_unit:r.unit,status:'ACTIVE',created_by:state.user.id};
  if(state.v171SchemaReady){payload.source_kind=type;payload.reference=type==='TOOLBOX_TALK'?(name.match(/\bTBT-\d{3}\b/i)?.[0]?.toUpperCase()||null):null;payload.auto_managed=false;}
  const {data:t,error}=await sb.from('training_sessions').insert(payload).select().single();if(error)return toast(error.message);
  for(const file of $('trainFiles')?.files||[]){const path=`training/${t.id}/${crypto.randomUUID()}-${file.name}`;const up=await sb.storage.from('safety-files').upload(path,file);if(!up.error)await sb.from('training_files').insert({training_session_id:t.id,file_name:file.name,storage_path:path,uploaded_by:state.user.id})}
  if(state.v171SchemaReady){for(const id of [...document.querySelectorAll('.train-doc-link:checked')].map(x=>x.value))await ensureTrainingDocLink(t.id,id,'RELATED')}
  closeModal();await refresh('Training created.');
}
saveTraining=saveTraining171;

function showEditTraining(id){
  const t=state.training.find(x=>x.id===id);if(!t)return;
  const auto=t.auto_managed===true,src=sourceForTraining(t);
  openModal('Edit training',`<div class="form-grid">
    <label class="full">Training name<input id="editTrainName" value="${esc(t.name)}" ${auto?'readonly':''}></label>
    <label>Category<input value="${esc(kindLabel(kindOf(t)))}" readonly></label>
    <label>Reference<input value="${esc(trainingReference(t)||'—')}" readonly></label>
    <label>Delivery method<select id="editTrainDelivery" ${auto?'disabled':''}><option value="SELF_TRAINING" ${t.delivery_method==='SELF_TRAINING'?'selected':''}>Self-training</option><option value="INSTRUCTOR_LED" ${t.delivery_method==='INSTRUCTOR_LED'?'selected':''}>Instructor-led</option></select></label>
    <label>Review date<input id="editTrainReview" type="date" value="${htmlDate(t.review_date)}"></label>
    ${renewalFields('editTrain',t.renewal_value,t.renewal_unit)}
    <label class="full">Details<textarea id="editTrainDesc" ${auto?'readonly':''}>${esc(t.description||'')}</textarea></label>
    <label class="check-row full"><input id="editTrainApplyAssignments" type="checkbox" checked> Apply refresher frequency to current active assignees as well.</label>
    ${t.review_required?'<label class="check-row full"><input id="editTrainClearReview" type="checkbox"> I have reviewed the linked-document change; clear the review flag when saving.</label>':''}
  </div>${src?`<div class="request-note">Auto-managed from ${esc(src.reference||'')} ${esc(src.title)}. Name and delivery method follow the controlled source.</div>`:''}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save changes','primary',`data-v171-save-training="${id}"`)}</div>`);
  $('editTrainRenewalPreset')?.addEventListener('change',()=>{$('editTrainCustomRenewal').hidden=$('editTrainRenewalPreset').value!=='CUSTOM'});
}

async function saveEditTraining(id){
  const t=state.training.find(x=>x.id===id);if(!t)return;const r=getRenewal('editTrain');
  const payload={review_date:$('editTrainReview').value||null,renewal_value:r.value,renewal_unit:r.unit};
  if(!t.auto_managed){payload.name=$('editTrainName').value.trim()||t.name;payload.delivery_method=$('editTrainDelivery').value;payload.description=$('editTrainDesc').value.trim()||null;}
  if(state.v171SchemaReady&&$('editTrainClearReview')?.checked){payload.review_required=false;payload.review_reason=null;}
  const {error}=await sb.from('training_sessions').update(payload).eq('id',id);if(error)return toast(error.message);
  if($('editTrainApplyAssignments')?.checked){
    const active=state.trainingAssignments.filter(a=>a.training_session_id===id&&a.active!==false);
    for(const a of active){const {error:e}=await sb.from('training_assignments').update({renewal_value:r.value,renewal_unit:r.unit}).eq('id',a.id);if(e)return toast(e.message)}
  }
  closeModal();await refresh('Training updated.');
}

function showTrainingDetails171(id){
  originals.showTrainingDetails(id);
  const body=$('modalBody'),t=state.training.find(x=>x.id===id);if(!body||!t)return;
  const rows=linkedTrainingDocs(id),src=sourceForTraining(t);
  const fallback=uniq((String(t.description||'').match(refRx)||[]).map(x=>x.toUpperCase())).map(ref=>state.documents.find(d=>String(d.reference||'').toUpperCase()===ref)).filter(Boolean);
  const docs=rows.length?rows.map(x=>x.doc):fallback;
  const panel=document.createElement('div');panel.className='section-card';panel.innerHTML=`<div class="section-title"><h3>Linked controlled documents</h3>${isManager()?btn('Edit training','ghost',`data-v171-edit-training="${id}"`):''}</div>${src?`<p><strong>Source:</strong> ${esc(src.reference||'')} ${esc(src.title)}</p>`:''}<div class="row">${docs.length?uniq(docs.map(d=>d.id)).map(docId=>{const d=state.documents.find(x=>x.id===docId),v=currentVersion(docId);return v?btn(`${d.reference||docTypeLabel(d.doc_type)} · ${d.title}`,'ghost',`data-open-doc="${v.id}"`):''}).join(''):'<span class="muted">No controlled documents linked yet.</span>'}</div>${t.review_required&&t.review_reason?`<div class="request-note" style="margin-top:10px">${esc(t.review_reason)}</div>`:''}`;
  body.prepend(panel);
}
showTrainingDetails=showTrainingDetails171;

function showDocumentLinks171(docId){
  const d=state.documents.find(x=>x.id===docId);if(!d)return;
  const links=linksForDocument(docId),available=state.documents.filter(x=>x.id!==docId&&x.status!=='ARCHIVED').sort((a,b)=>(a.reference||a.title).localeCompare(b.reference||b.title,undefined,{numeric:true}));
  openModal('Linked documents',`<div class="stack"><p><strong>${esc(d.reference?d.reference+' - '+d.title:d.title)}</strong> · ${esc(docTypeLabel(d.doc_type))}</p>
  <div><strong>Current links</strong><div class="card-list">${links.length?links.map(l=>{const other=otherDocForLink(l,docId);return `<div class="item-card compact"><div class="row-between"><span><strong>${esc(other?.reference||docTypeLabel(other?.doc_type))}</strong> · ${esc(other?.title||'Unknown')}</span><span class="badge">${esc(linkTypeLabel(l.link_type))}</span></div>${isManager()?`<div class="row">${btn('Remove','danger',`data-remove-doc-link="${l.id}"`)}</div>`:''}</div>`}).join(''):'<span class="muted">No links yet.</span>'}</div></div>
  ${isManager()?`<div class="section-card"><strong>Add link</strong><label>Search<input id="v171DocLinkSearch" placeholder="Type RA-044, product name, SSW title, SDS name…"></label><div id="v171DocLinkChoices" class="card-list" style="max-height:330px;overflow:auto;margin-top:10px">${available.map(x=>`<div class="item-card compact v171-link-choice" data-search="${esc(`${x.doc_type} ${x.reference||''} ${x.title}`.toLowerCase())}"><div class="row-between"><span><strong>${esc(x.reference||docTypeLabel(x.doc_type))}</strong> · ${esc(x.title)}</span><span class="badge">${esc(docTypeLabel(x.doc_type))}</span></div><div class="row">${btn('Add link','primary',`data-v171-add-doc-link="${docId}|${x.id}"`)}</div></div>`).join('')}</div><p class="muted">Search results show the full reference and document title. Relationship type is detected automatically.</p></div>`:''}</div>`);
  $('v171DocLinkSearch')?.addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.v171-link-choice').forEach(x=>x.hidden=!!q&&!x.dataset.search.includes(q))});
}
showDocumentLinks=showDocumentLinks171;

async function addDocumentLinkDirect(docId,otherId){
  const a=state.documents.find(x=>x.id===docId),b=state.documents.find(x=>x.id===otherId);if(!a||!b)return;
  if(pairExists(docId,otherId)){toast('These documents are already linked.');return;}
  const rel=inferLinkType(a,b),{data,error}=await sb.from('document_links').insert({source_document_id:rel.source.id,target_document_id:rel.target.id,link_type:rel.type,created_by:state.user.id}).select().single();
  if(error)return toast(error.message);if(data)state.documentLinks.push(data);await refresh('Documents linked.');showDocumentLinks171(docId);
}
function pairExists(a,b){return state.documentLinks.some(l=>(l.source_document_id===a&&l.target_document_id===b)||(l.source_document_id===b&&l.target_document_id===a))}

async function ensureTrainingDocLink(trainingId,docId,role='RELATED'){
  if(!state.v171SchemaReady||!trainingId||!docId)return 0;
  const ex=state.trainingDocumentLinks.find(l=>l.training_session_id===trainingId&&l.document_id===docId);
  if(ex){if(ex.link_role!==role&&role==='SOURCE'){const {error}=await sb.from('training_document_links').update({link_role:'SOURCE'}).eq('id',ex.id);if(!error)ex.link_role='SOURCE';}return 0;}
  const {data,error}=await sb.from('training_document_links').insert({training_session_id:trainingId,document_id:docId,link_role:role,created_by:state.user.id}).select().single();
  if(error){console.warn('training_document_links',error);return 0;}if(data)state.trainingDocumentLinks.push(data);return 1;
}

function docForAssignment(a){const v=state.versions.find(x=>x.id===a.document_version_id);return v?state.documents.find(d=>d.id===v.document_id):null}
async function copyAssignmentToTraining(a,trainingId,seen){
  if(!a||seen.has(a.user_id))return 0;seen.add(a.user_id);
  const payload={training_session_id:trainingId,user_id:a.user_id,due_date:a.due_date||daysFromNow(14),renewal_value:a.renewal_value,renewal_unit:a.renewal_unit,assigned_by:state.user.id,active:true};
  if(Object.prototype.hasOwnProperty.call(a,'delivery_method_override'))payload.delivery_method_override=a.delivery_method_override||null;
  const {error}=await sb.from('training_assignments').insert(payload);if(error){console.warn('Assignment migration',error);return 0;}return 1;
}
async function createSourceTraining(d,v,prior=null){
  const delivery=sourceDelivery(d.doc_type),payload={name:sourceName(d),session_type:'OTHER',delivery_method:delivery,description:`Controlled document training. Source: ${d.reference||''} - ${d.title}. Automatically managed by Safety Tracker v${V171}.`,delivered_date:null,trainer_name:null,trainer_user_id:state.user.id,review_date:v.review_date||plusYear(v.issue_date||createdDate(v)),default_due_date:daysFromNow(14),renewal_value:d.default_renewal_value||null,renewal_unit:d.default_renewal_unit||null,status:'ACTIVE',created_by:state.user.id,reference:d.reference||null,source_kind:d.doc_type,source_document_id:d.id,source_document_version_id:v.id,auto_managed:true,review_required:false,review_reason:null};
  const {data:t,error}=await sb.from('training_sessions').insert(payload).select().single();if(error){console.warn('Source training create',d.reference,error);return {changes:0,training:null};}
  let changes=1;state.training.push(t);changes+=await ensureTrainingDocLink(t.id,d.id,'SOURCE');
  const seen=new Set();
  if(prior){
    for(const a of state.trainingAssignments.filter(x=>x.training_session_id===prior.id&&x.active!==false)){changes+=await copyAssignmentToTraining(a,t.id,seen);await sb.from('training_assignments').update({active:false}).eq('id',a.id);changes++;}
    await sb.from('training_sessions').update({status:'ARCHIVED'}).eq('id',prior.id);prior.status='ARCHIVED';changes++;
  }
  for(const a of state.docAssignments.filter(x=>x.active!==false&&docForAssignment(x)?.id===d.id)){
    changes+=await copyAssignmentToTraining(a,t.id,seen);const {error:e}=await sb.from('document_assignments').update({active:false}).eq('id',a.id);if(!e){a.active=false;changes++;}
  }
  return {changes,training:t};
}

async function syncSourceTrainings(){
  let changes=0;
  for(const d of state.documents.filter(d=>d.status!=='ARCHIVED'&&sourceDocTypes.has(d.doc_type))){
    const v=currentVersion(d.id);if(!v)continue;
    let active=state.training.find(t=>t.auto_managed===true&&t.source_document_id===d.id&&t.status!=='ARCHIVED');
    if(!active||active.source_document_version_id!==v.id){const r=await createSourceTraining(d,v,active||null);changes+=r.changes;active=r.training||active;}
    if(!active)continue;
    const desired={name:sourceName(d),reference:d.reference||null,source_kind:d.doc_type,source_document_id:d.id,source_document_version_id:v.id,delivery_method:sourceDelivery(d.doc_type),review_date:v.review_date||plusYear(v.issue_date||createdDate(v)),auto_managed:true};
    const dirty=Object.entries(desired).some(([k,val])=>String(active[k]??'')!==String(val??''));
    if(dirty){const {error}=await sb.from('training_sessions').update(desired).eq('id',active.id);if(!error){Object.assign(active,desired);changes++;}}
    changes+=await ensureTrainingDocLink(active.id,d.id,'SOURCE');
    for(const l of linksForDocument(d.id)){const other=otherDocForLink(l,d.id);if(other)changes+=await ensureTrainingDocLink(active.id,other.id,'RELATED')}
  }
  return changes;
}

async function normaliseDefaults(){
  let changes=0;
  for(const v of state.versions.filter(v=>v.status==='CURRENT')){
    const d=state.documents.find(x=>x.id===v.document_id),patch={};
    if(!v.issue_date)patch.issue_date=createdDate(v);
    if(d?.doc_type!=='SDS'&&!v.review_date)patch.review_date=plusYear(v.issue_date||patch.issue_date||createdDate(v));
    if(Object.keys(patch).length){const {error}=await sb.from('document_versions').update(patch).eq('id',v.id);if(!error){Object.assign(v,patch);changes++;}}
  }
  for(const t of state.training.filter(t=>t.status!=='ARCHIVED')){
    const patch={};if(!t.review_date)patch.review_date=plusYear(createdDate(t));
    if(t.session_type==='TOOLBOX_TALK'&&state.v171SchemaReady){if(!t.source_kind)patch.source_kind='TOOLBOX_TALK';if(!t.reference){const m=String(t.name||'').match(tbtRx);if(m)patch.reference=m[0].toUpperCase();}}
    if(Object.keys(patch).length){const {error}=await sb.from('training_sessions').update(patch).eq('id',t.id);if(!error){Object.assign(t,patch);changes++;}}
  }
  return changes;
}

function refsInText(text){return uniq((String(text||'').match(refRx)||[]).map(x=>x.toUpperCase()))}
async function syncTrainingLinksFromDescriptions(){
  let changes=0;for(const t of state.training.filter(t=>t.status!=='ARCHIVED'))for(const ref of refsInText(t.description)){const d=state.documents.find(x=>String(x.reference||'').toUpperCase()===ref);if(d)changes+=await ensureTrainingDocLink(t.id,d.id,'RELATED')}return changes;
}

function productWords(s){const stop=new Set(['safety','data','sheet','sds','msds','coshh','assessment','risk','the','and','for','product','manufacturer','trade','uk','gb','pure','white']);return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(x=>x.length>2&&!stop.has(x))}
function similarity(a,b){const A=productWords(a),B=productWords(b);if(!A.length||!B.length)return 0;const set=new Set(B),common=A.filter(x=>set.has(x));return common.length/Math.max(2,Math.min(A.length,B.length))}
async function syncSdsCoshh(){
  let changes=0;const sds=state.documents.filter(d=>d.status!=='ARCHIVED'&&d.doc_type==='SDS'),coshh=state.documents.filter(d=>d.status!=='ARCHIVED'&&d.doc_type==='COSHH');
  for(const s of sds){if(coshh.some(c=>pairExists(s.id,c.id)))continue;const scored=coshh.map(c=>({c,score:similarity(s.title,c.title)})).sort((a,b)=>b.score-a.score);if(scored[0]?.score>=0.60&&(scored.length===1||scored[0].score-scored[1].score>=0.15)){const rel=inferLinkType(s,scored[0].c),{data,error}=await sb.from('document_links').insert({source_document_id:rel.source.id,target_document_id:rel.target.id,link_type:rel.type,created_by:state.user.id}).select().single();if(!error&&data){state.documentLinks.push(data);changes++;}}}
  return changes;
}

async function pdfTextFromStorage(path){
  if(!path||!window.pdfjsLib)return '';
  const {data,error}=await sb.storage.from('safety-files').download(path);if(error||!data)return '';
  const pdf=await pdfjsLib.getDocument({data:(await data.arrayBuffer()).slice(0)}).promise,out=[];
  for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),c=await pg.getTextContent();out.push((c.items||[]).map(i=>i.str||'').join(' '))}return out.join(' ');
}
async function linkRefsForDocument(d,v){
  let changes=0;try{const text=await pdfTextFromStorage(v.storage_path);for(const ref of refsInText(text)){if(ref===String(d.reference||'').toUpperCase())continue;const other=state.documents.find(x=>String(x.reference||'').toUpperCase()===ref);if(!other||pairExists(d.id,other.id))continue;const rel=inferLinkType(d,other),{data,error}=await sb.from('document_links').insert({source_document_id:rel.source.id,target_document_id:rel.target.id,link_type:rel.type,created_by:state.user.id}).select().single();if(!error&&data){state.documentLinks.push(data);changes++;}}await sb.from('document_versions').update({links_scanned_at:new Date().toISOString()}).eq('id',v.id);v.links_scanned_at=new Date().toISOString();}catch(e){console.warn('Document link scan',d.reference,e)}return changes;
}
async function linkRefsForTraining(t,f){
  let changes=0;try{const text=await pdfTextFromStorage(f.storage_path);for(const ref of refsInText(text)){const d=state.documents.find(x=>String(x.reference||'').toUpperCase()===ref);if(d)changes+=await ensureTrainingDocLink(t.id,d.id,'RELATED')}await sb.from('training_files').update({links_scanned_at:new Date().toISOString()}).eq('id',f.id);f.links_scanned_at=new Date().toISOString();}catch(e){console.warn('Training link scan',t.name,e)}return changes;
}
async function scanFiles(mode='recent',progress=()=>{}){
  let changes=0,scanned=0;const cutoff=Date.now()-15*60*1000;
  const docs=state.documents.filter(d=>d.status!=='ARCHIVED');
  for(const d of docs){const v=currentVersion(d.id);if(!v?.storage_path)continue;const recent=new Date(v.created_at||0).getTime()>=cutoff;if(mode!=='full'&&(!recent||v.links_scanned_at))continue;progress(`Scanning controlled document ${++scanned}: ${d.reference||d.title}`);changes+=await linkRefsForDocument(d,v)}
  const latestFiles=new Map();for(const f of state.trainingFiles){const old=latestFiles.get(f.training_session_id);if(!old||new Date(f.created_at||0)>new Date(old.created_at||0))latestFiles.set(f.training_session_id,f)}
  for(const t of state.training.filter(t=>t.status!=='ARCHIVED')){const f=latestFiles.get(t.id);if(!f?.storage_path)continue;const recent=new Date(f.created_at||0).getTime()>=cutoff;if(mode!=='full'&&(!recent||f.links_scanned_at))continue;progress(`Scanning training file ${++scanned}: ${t.name}`);changes+=await linkRefsForTraining(t,f)}
  return {changes,scanned};
}

function latestReviewTime(docId){const ids=new Set(state.versions.filter(v=>v.document_id===docId).map(v=>v.id));const r=state.documentReviews.filter(x=>ids.has(x.document_version_id)).sort((a,b)=>new Date(b.reviewed_at)-new Date(a.reviewed_at))[0];return r?.reviewed_at||null}
async function propagateReviewFlags(){
  let changes=0;
  for(const l of state.documentLinks.filter(l=>['SDS_TO_COSHH','COSHH_TO_SSW','RA_TO_SSW'].includes(l.link_type))){
    const source=state.documents.find(d=>d.id===l.source_document_id),target=state.documents.find(d=>d.id===l.target_document_id),sv=currentV(source),tv=currentV(target);if(!source||!target||!sv||!tv)continue;
    const baseline=Math.max(new Date(tv.created_at||0).getTime(),new Date(latestReviewTime(target.id)||0).getTime());
    if(new Date(sv.created_at||0).getTime()>baseline&&!target.review_required){const reason=`${source.reference||source.title} has a newer controlled version. Review ${target.reference||target.title} and linked training.`;const {error}=await sb.from('documents').update({review_required:true,review_reason:reason,review_flagged_at:new Date().toISOString(),review_flagged_by_document_id:source.id}).eq('id',target.id);if(!error){target.review_required=true;target.review_reason=reason;changes++;}}
  }
  if(state.v171SchemaReady){
    for(const t of state.training.filter(t=>t.status!=='ARCHIVED'&&!t.auto_managed)){
      const newer=linkedTrainingDocs(t.id).filter(x=>{const v=currentVersion(x.doc.id);return v&&new Date(v.created_at||0)>new Date(t.created_at||0)});
      if(newer.length&&!t.review_required){const refs=newer.slice(0,3).map(x=>x.doc.reference||x.doc.title).join(', '),reason=`Linked controlled document${newer.length===1?' has':'s have'} changed since this training was created: ${refs}. Review the training content/links.`;const {error}=await sb.from('training_sessions').update({review_required:true,review_reason:reason}).eq('id',t.id);if(!error){t.review_required=true;t.review_reason=reason;changes++;}}
    }
  }
  return changes;
}

async function runSafetySync({scan='recent',progress=()=>{}}={}){
  if(syncBusy)return {changes:0,scanned:0};
  if(!state.v171SchemaReady)throw new Error('v1.7.1 database migration has not been run yet.');
  syncBusy=true;let changes=0,scanned=0;
  try{
    progress('Applying upload/review date defaults…');changes+=await normaliseDefaults();
    progress('Building RA/COSHH/SSW training records…');changes+=await syncSourceTrainings();
    progress('Repairing training links…');changes+=await syncTrainingLinksFromDescriptions();
    if(scan){const r=await scanFiles(scan,progress);changes+=r.changes;scanned+=r.scanned;}
    progress('Matching SDS to COSHH…');changes+=await syncSdsCoshh();
    progress('Checking dependent documents and training for review…');changes+=await propagateReviewFlags();
    return {changes,scanned};
  }finally{syncBusy=false;}
}

let refreshSyncGuard=false;
async function refresh171(msg){
  await originals.refresh(msg);
  if(!isManager()||!state.v171SchemaReady||refreshSyncGuard)return;
  refreshSyncGuard=true;
  try{
    const r=await runSafetySync({scan:'recent'});
    if(r.changes)await originals.refresh();
  }catch(e){console.warn('Automatic v1.7.1 sync',e)}finally{refreshSyncGuard=false;}
}
refresh=refresh171;

function backupPayload171(){return {exported_at:new Date().toISOString(),safety_tracker_version:V171,profiles:state.people,documents:state.documents,document_versions:state.versions,document_assignments:state.docAssignments,document_signoffs:state.docSignoffs,document_delivery_confirmations:state.docConfirmations,document_links:state.documentLinks,document_reviews:state.documentReviews,training_sessions:state.training,training_assignments:state.trainingAssignments,training_signoffs:state.trainingSignoffs,training_delivery_confirmations:state.trainingConfirmations,training_files:state.trainingFiles,training_document_links:state.trainingDocumentLinks}}
async function downloadBackup171(){downloadBlob(new Blob([JSON.stringify(backupPayload171(),null,2)],{type:'application/json'}),`safety-tracker-v171-backup-${todayISO()}.json`)}
async function downloadFullBackup171(){
  if(!window.JSZip)return toast('ZIP library did not load. Use JSON backup for now.');
  try{toast('Building full v1.7.1 backup…');const zip=new JSZip();zip.file('database/safety-tracker.json',JSON.stringify(backupPayload171(),null,2));const files=await listStorageRecursive('');for(const path of files){const {data,error}=await sb.storage.from('safety-files').download(path);if(!error&&data)zip.file(`files/${path}`,data)}const blob=await zip.generateAsync({type:'blob'});downloadBlob(blob,`safety-tracker-v171-full-backup-${todayISO()}.zip`);toast(`Full backup created (${files.length} files).`);}catch(e){toast(e.message||'Full backup failed.')}
}

function interceptClick(e){
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='newDocumentBtn'){e.preventDefault();e.stopImmediatePropagation();return showNewDocument171();}
  if(b.id==='newTrainingBtn'){e.preventDefault();e.stopImmediatePropagation();return showNewTraining171();}
  if(b.id==='backupBtn'){e.preventDefault();e.stopImmediatePropagation();return downloadBackup171();}
  if(b.id==='fullBackupBtn'){e.preventDefault();e.stopImmediatePropagation();return downloadFullBackup171();}
  if(b.dataset.v171EditTraining){e.preventDefault();e.stopImmediatePropagation();return showEditTraining(b.dataset.v171EditTraining);}
  if(b.dataset.v171SaveTraining){e.preventDefault();e.stopImmediatePropagation();return saveEditTraining(b.dataset.v171SaveTraining);}
  if(b.dataset.v171AddDocLink){e.preventDefault();e.stopImmediatePropagation();const [a,c]=b.dataset.v171AddDocLink.split('|');return addDocumentLinkDirect(a,c);}
}
document.addEventListener('click',interceptClick,true);

function lateInstall(){
  injectV171UI();updateTrainingFilter();
  ['documentSearch','documentTypeFilter','documentStatusFilter'].forEach(id=>$(id)?.addEventListener('input',renderDocuments171));
  ['trainingSearch','trainingTypeFilter'].forEach(id=>$(id)?.addEventListener('input',renderTraining171));
  if(state.user){renderDocuments171();renderTraining171();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lateInstall);else lateInstall();

})();
