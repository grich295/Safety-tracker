/* Safety Tracker v1.8.0 architecture lock
   Load after app-v161.js, bulk-import-v161.js and app-v171-patch.js.
   IMPORTANT: does not replace or modify Force Sync & Review.
*/
(() => {
'use strict';
const V180='1.8.0';
const SOURCE_TYPES=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
const oldShowNewVersion=typeof showNewVersion==='function'?showNewVersion:null;
const oldRenderDocuments=typeof renderDocuments==='function'?renderDocuments:null;
const oldRefresh=typeof refresh==='function'?refresh:null;

const plusYear=iso=>{const d=new Date((iso||todayISO())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)};
function numericNextVersion(docId){
  const nums=state.versions.filter(v=>v.document_id===docId).map(v=>String(v.version_label||'').trim()).filter(v=>/^\d+$/.test(v)).map(Number);
  return String(nums.length?Math.max(...nums)+1:1);
}
function sourceDelivery(type){return type==='SSW'?'INSTRUCTOR_LED':'SELF_TRAINING'}
function sourceTrainingFor(docId){return state.training.find(t=>t.auto_managed===true&&t.source_document_id===docId&&t.status!=='ARCHIVED')||null}
function findCurrent(docId){return state.versions.find(v=>v.document_id===docId&&v.status==='CURRENT')||currentVersion(docId)}

function architectureBanner(){
  document.querySelector('.topbar .version')?.replaceChildren(document.createTextNode('v'+V180));
  const d=$('documentsView')?.querySelector('.page-heading .muted');
  if(d)d.textContent='Controlled document library only. Assignments and sign-offs are managed from Training.';
  const t=$('trainingView')?.querySelector('.page-heading .muted');
  if(t)t.textContent='All active learning and sign-off: RA, COSHH, SSW, Toolbox Talks, induction, refresher and ad-hoc training.';
}

function stripLegacyDocumentAssignmentUI(){
  document.querySelectorAll('[data-assign-doc],[data-save-doc-assignment],[data-sign-doc],[data-confirm-sign-doc]').forEach(el=>el.remove());
  document.querySelectorAll('#documentsList .item-card .meta span').forEach(el=>{
    if(/\bassigned\b/i.test(el.textContent||'')||/self-training|instructor-led/i.test(el.textContent||''))el.remove();
  });
}

// Render Documents normally through v1.7.1, then remove any legacy assignment controls if the old renderer leaks through.
if(oldRenderDocuments){
  renderDocuments=function(){oldRenderDocuments();stripLegacyDocumentAssignmentUI();architectureBanner();};
}

// Legacy direct assignment/sign-off buttons are blocked even if stale cached HTML is present.
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.assignDoc!==undefined||b.dataset.saveDocAssignment!==undefined||b.dataset.signDoc!==undefined||b.dataset.confirmSignDoc!==undefined){
    e.preventDefault();e.stopImmediatePropagation();
    toast('Documents are source files only. Assign the matching record from Training.');
  }
},true);

function showNewVersion180(docId){
  const d=state.documents.find(x=>x.id===docId),old=findCurrent(docId);if(!d)return;
  const next=numericNextVersion(docId),issue=todayISO(),review=d.doc_type==='SDS'?'':plusYear(issue);
  openModal('Upload new controlled version',`<p><strong>${esc(d.reference?d.reference+' - ':'' )}${esc(d.title)}</strong></p>
    <div class="hint-box"><strong>Version recognition:</strong> this remains the same controlled document. The old current version will be marked superseded and this upload becomes the current version. Training is updated separately and historical sign-offs are retained.</div>
    <div class="form-grid" style="margin-top:12px">
      <label>New version<input id="v180Version" value="${esc(next)}"></label>
      <label>Issue date<input id="v180Issue" type="date" value="${issue}"></label>
      ${d.doc_type==='SDS'?'<label>Review date<input value="Not required for SDS" disabled></label>':`<label>Review date<input id="v180Review" type="date" value="${review}"></label>`}
      <label class="full">Upload file<input id="v180File" type="file" accept="application/pdf,.pdf" required></label>
      <label class="full">Notes<textarea id="v180Notes" placeholder="Optional version/revision note"></textarea></label>
    </div>
    <div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Publish version','primary',`data-v180-publish-version="${docId}"`)}</div>`);
}
showNewVersion=showNewVersion180;

async function publishVersion180(docId){
  const d=state.documents.find(x=>x.id===docId),old=findCurrent(docId),file=$('v180File')?.files?.[0];
  if(!d||!file)return toast('Choose the new document file.');
  const version=($('v180Version')?.value||'').trim()||numericNextVersion(docId);
  const issue=$('v180Issue')?.value||todayISO();
  const review=d.doc_type==='SDS'?null:($('v180Review')?.value||plusYear(issue));
  if(state.versions.some(v=>v.document_id===docId&&String(v.version_label||'').trim().toLowerCase()===version.toLowerCase()))return toast(`Version ${version} already exists for this document.`);

  const path=`documents/${docId}/${crypto.randomUUID()}-${file.name}`;
  const up=await sb.storage.from('safety-files').upload(path,file);if(up.error)return toast(up.error.message);
  try{
    if(old){const r=await sb.from('document_versions').update({status:'SUPERSEDED'}).eq('id',old.id);if(r.error)throw r.error;}
    const payload={document_id:docId,version_label:version,issue_date:issue,review_date:review,delivery_method:sourceDelivery(d.doc_type),storage_path:path,file_name:file.name,notes:$('v180Notes')?.value.trim()||null,status:'CURRENT',created_by:state.user.id};
    const ins=await sb.from('document_versions').insert(payload).select().single();if(ins.error)throw ins.error;
    await sb.from('documents').update({resign_on_new_version:false,delivery_method:sourceDelivery(d.doc_type)}).eq('id',docId);
    closeModal();
    await refresh(`Version ${version} published. Linked training will use the new controlled version.`);
  }catch(err){
    await sb.storage.from('safety-files').remove([path]);
    if(old)await sb.from('document_versions').update({status:'CURRENT'}).eq('id',old.id);
    toast(err.message||'Could not publish the new version.');
  }
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.v180PublishVersion){e.preventDefault();e.stopImmediatePropagation();publishVersion180(b.dataset.v180PublishVersion);}
},true);

// Keep legacy rows historical only in the browser state as well.
async function enforceClientArchitecture(){
  if(!state.user)return;
  state.docAssignments.forEach(a=>a.active=false);
  architectureBanner();stripLegacyDocumentAssignmentUI();
  // Existing bulk importer checks resign_on_new_version before creating old-style assignments.
  // Keep it off in client state so changed-content imports flow directly to Training sync.
  state.documents.forEach(d=>d.resign_on_new_version=false);
}

if(oldRefresh){
  refresh=async function(msg){await oldRefresh(msg);await enforceClientArchitecture();};
}

function install(){architectureBanner();enforceClientArchitecture();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
