/* Safety Tracker v1.8.1 - Training architecture front-end correction
   Loaded AFTER app-v161.js and bulk-import-v161.js.
   Does not replace or modify Force Sync & Review.
*/
(() => {
'use strict';
const BUILD='1.8.1';
const TRAINING_TYPES=[
  ['RISK_ASSESSMENT','Risk Assessment'],
  ['COSHH','COSHH Assessment'],
  ['SSW','Safe System of Work'],
  ['TOOLBOX_TALK','Toolbox Talk'],
  ['INDUCTION','Induction'],
  ['REFRESHER','Refresher'],
  ['AD_HOC','Ad-hoc training'],
  ['OTHER','Other']
];
const DOC_TYPES={RISK_ASSESSMENT:'RISK_ASSESSMENT',COSHH:'COSHH',SSW:'SSW'};
const LABEL=Object.fromEntries(TRAINING_TYPES);

function el(id){return document.getElementById(id)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function isoToday(){return new Date().toISOString().slice(0,10)}
function addDaysISO(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function addYearISO(date){const d=new Date((date||isoToday())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)}
function methodFor(type){return (type==='SSW'||type==='TOOLBOX_TALK')?'INSTRUCTOR_LED':'SELF_TRAINING'}
function isControlledTraining(type){return Object.prototype.hasOwnProperty.call(DOC_TYPES,type)}
function currentVersionFor(docId){
  const versions=(state?.versions||[]).filter(v=>v.document_id===docId);
  return versions.find(v=>v.status==='CURRENT')||versions.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;
}
function activeDocsFor(type){
  const dt=DOC_TYPES[type];
  if(!dt)return [];
  return (state?.documents||[]).filter(d=>d.doc_type===dt&&d.status!=='ARCHIVED').sort((a,b)=>String(a.reference||a.title||'').localeCompare(String(b.reference||b.title||'')));
}
function docOption(d){
  const v=currentVersionFor(d.id);
  const ver=v?.version_label?` · v${v.version_label}`:'';
  return `<option value="${escapeHtml(d.id)}">${escapeHtml(d.reference?`${d.reference} — ${d.title}`:d.title)}${escapeHtml(ver)}</option>`;
}
function updateBuildLabel(){
  document.querySelectorAll('.version').forEach(x=>x.textContent='v'+BUILD);
  document.documentElement.dataset.safetyTrackerBuild=BUILD;
}
function updateTrainingFilter(){
  const f=el('trainingTypeFilter'); if(!f)return;
  const chosen=f.value;
  f.innerHTML='<option value="">All types</option>'+TRAINING_TYPES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  if([...f.options].some(o=>o.value===chosen))f.value=chosen;
}
function updateTrainingCopy(){
  const view=el('trainingView');
  const p=view?.querySelector('.page-heading .muted');
  if(p)p.textContent='RA, COSHH, SSW, toolbox talks, inductions, refreshers and ad-hoc training.';
  const people=el('peopleView')?.querySelector('.page-heading .muted');
  if(people)people.textContent='Assign training to active users. Controlled documents are linked from the Training record.';
  const my=el('mySafetyView')?.querySelector('.page-heading .muted');
  if(my)my.textContent='Your assigned safety training and sign-offs.';
}
function trainingOptions(selected='RISK_ASSESSMENT'){
  return TRAINING_TYPES.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');
}
function renewalOptions(){return '<option value="">One-off only</option><option value="3|MONTHS">Every 3 months</option><option value="6|MONTHS">Every 6 months</option><option value="12|MONTHS">Every 12 months</option><option value="24|MONTHS">Every 24 months</option><option value="CUSTOM">Custom</option>'}

function openV181Training(){
  const type='RISK_ASSESSMENT';
  openModal('New training session',`<div class="form-grid">
    <label>Training name<input id="v181TrainName" placeholder="Defaults from linked document"></label>
    <label>Type<select id="v181TrainType">${trainingOptions(type)}</select></label>
    <label id="v181SourceWrap" class="full">Controlled document<select id="v181SourceDoc"></select><span class="muted">Links this training to the CURRENT controlled document version.</span></label>
    <label>Delivery method<select id="v181TrainDelivery"><option value="SELF_TRAINING">Self-training</option><option value="INSTRUCTOR_LED">Instructor-led</option></select></label>
    <label>Default completion due date<input id="v181TrainDue" type="date" value="${addDaysISO(14)}"></label>
    <label>Date delivered<input id="v181TrainDate" type="date" value="${isoToday()}"></label>
    <label>Trainer / presenter<input id="v181TrainTrainer" value="${escapeHtml(state?.profile?.display_name||'')}"></label>
    <label>Review date<input id="v181TrainReview" type="date" value="${addYearISO(isoToday())}"></label>
    <label>Sign-off / refresher frequency<select id="v181RenewalPreset">${renewalOptions()}</select></label>
    <div id="v181CustomRenewal" class="full" hidden><div class="form-grid"><label>Every<input id="v181RenewalValue" type="number" min="1"></label><label>Unit<select id="v181RenewalUnit"><option>DAYS</option><option>MONTHS</option><option>YEARS</option></select></label></div></div>
    <label class="full">Details<textarea id="v181TrainDesc"></textarea></label>
    <label class="full">Upload supporting files<input id="v181TrainFiles" type="file" multiple></label>
  </div><div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" id="v181SaveTraining">Create training</button></div>`);

  const sync=()=>{
    const t=el('v181TrainType').value;
    el('v181TrainDelivery').value=methodFor(t);
    el('v181TrainDelivery').disabled=isControlledTraining(t)||t==='TOOLBOX_TALK';
    const wrap=el('v181SourceWrap'),sel=el('v181SourceDoc');
    wrap.hidden=!isControlledTraining(t);
    if(isControlledTraining(t)){
      const docs=activeDocsFor(t);
      sel.innerHTML='<option value="">Select controlled document</option>'+docs.map(docOption).join('');
    }else sel.innerHTML='';
  };
  el('v181TrainType').addEventListener('change',sync); sync();
  el('v181SourceDoc').addEventListener('change',()=>{
    const d=(state.documents||[]).find(x=>x.id===el('v181SourceDoc').value); if(!d)return;
    el('v181TrainName').value=d.reference?`${d.reference} - ${d.title}`:d.title;
    const v=currentVersionFor(d.id);
    if(v?.review_date)el('v181TrainReview').value=v.review_date;
  });
  el('v181RenewalPreset').addEventListener('change',()=>{el('v181CustomRenewal').hidden=el('v181RenewalPreset').value!=='CUSTOM'});
  el('v181SaveTraining').addEventListener('click',saveV181Training);
}

function renewalFromV181(){
  const p=el('v181RenewalPreset').value;
  if(!p)return {value:null,unit:null};
  if(p==='CUSTOM')return {value:Number(el('v181RenewalValue').value)||null,unit:el('v181RenewalUnit').value||null};
  const [value,unit]=p.split('|'); return {value:Number(value),unit};
}
async function saveV181Training(){
  const type=el('v181TrainType').value;
  const sourceId=isControlledTraining(type)?el('v181SourceDoc').value:null;
  if(isControlledTraining(type)&&!sourceId)return toast('Select the controlled document for this training.');
  const source=sourceId?(state.documents||[]).find(d=>d.id===sourceId):null;
  const version=source?currentVersionFor(source.id):null;
  const name=(el('v181TrainName').value||'').trim()||(source?(source.reference?`${source.reference} - ${source.title}`:source.title):'');
  if(!name)return toast('Training name is required.');
  const r=renewalFromV181();
  const typedDesc=(el('v181TrainDesc').value||'').trim();
  const sourceText=source?`Controlled source: ${source.reference||''}${source.reference?' — ':''}${source.title}${version?.version_label?` (version ${version.version_label})`:''}.`:'';
  const description=[sourceText,typedDesc].filter(Boolean).join(' ');
  const payload={
    name,
    session_type:type,
    delivery_method:methodFor(type),
    description:description||null,
    delivered_date:el('v181TrainDate').value||null,
    trainer_name:(el('v181TrainTrainer').value||'').trim()||null,
    trainer_user_id:state.user.id,
    review_date:el('v181TrainReview').value||null,
    default_due_date:el('v181TrainDue').value||null,
    renewal_value:r.value,
    renewal_unit:r.unit,
    status:'ACTIVE',
    created_by:state.user.id,
    reference:source?.reference||null,
    source_kind:type,
    source_document_id:source?.id||null,
    source_document_version_id:version?.id||null,
    auto_managed:!!source
  };
  const {data:t,error}=await sb.from('training_sessions').insert(payload).select().single();
  if(error)return toast(error.message);
  if(source){
    const link=await sb.from('training_document_links').upsert({training_session_id:t.id,document_id:source.id,link_role:'SOURCE',created_by:state.user.id},{onConflict:'training_session_id,document_id'});
    if(link.error)console.warn('Training source link',link.error);
  }
  const files=el('v181TrainFiles')?.files||[];
  for(const file of files){
    const path=`training/${t.id}/${crypto.randomUUID()}-${file.name}`;
    const up=await sb.storage.from('safety-files').upload(path,file);
    if(!up.error)await sb.from('training_files').insert({training_session_id:t.id,file_name:file.name,storage_path:path,uploaded_by:state.user.id});
  }
  closeModal();
  await refresh(`${LABEL[type]||'Training'} created.`);
}

function installButtonOverride(){
  const old=el('newTrainingBtn'); if(!old||old.dataset.v181==='1')return;
  const fresh=old.cloneNode(true);
  fresh.dataset.v181='1';
  old.replaceWith(fresh);
  fresh.addEventListener('click',openV181Training);
}
function install(){
  updateBuildLabel(); updateTrainingFilter(); updateTrainingCopy(); installButtonOverride();
  // Re-apply after app refresh/navigation changes without touching Force Sync.
  const observer=new MutationObserver(()=>{updateBuildLabel();installButtonOverride()});
  observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
