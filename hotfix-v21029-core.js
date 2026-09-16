/* Safety Tracker v2.10.29 core hotfix on app-v21028.js */
'use strict';

documentTraffic=function(d){
  if(!d||d.status==='ARCHIVED')return 'neutral';
  const approved=approvedCurrentVersion(d.id),pending=pendingApprovalVersion(d.id),rejected=rejectedVersion(d.id);
  if(!approved&&rejected&&!pending)return 'red';
  if(pending)return 'red';
  if(!approved)return 'red';
  if(approved.review_date&&approved.review_date<todayISO())return 'red';
  if(d.review_required||(approved.review_date&&approved.review_date>=todayISO()&&approved.review_date<=daysFromNow(30)))return 'amber';
  return 'green';
};

documentApprovalSummary=function(d){
  const approved=approvedCurrentVersion(d?.id),pending=pendingApprovalVersion(d?.id);
  if(approved&&pending)return {ready:true,label:`${d?.doc_type==='SDS'?'Accepted':'Approved'} current · replacement pending`,traffic:'red',version:approved};
  if(approved)return {ready:true,label:d?.doc_type==='SDS'?'Accepted/current':'Approved/current',traffic:'green',version:approved};
  if(pending)return {ready:false,label:d?.doc_type==='SDS'?'Pending acceptance':'Pending approval',traffic:'red',version:pending};
  return {ready:false,label:'No approved/current version',traffic:'red',version:latestVersion(d?.id)};
};

trainingDependencyState=function(t){
  const reasons=[],required=[];
  if(!t)return {ready:false,reasons:['Training record not found'],required};
  if(t.source_document_id){
    const src=state.documents.find(d=>d.id===t.source_document_id),approved=approvedCurrentVersion(t.source_document_id);
    if(!approved||approved.id!==t.source_document_version_id)reasons.push(`${src?.reference||src?.title||'Controlled source'} is not approved/current`);
  }
  for(const l of trainingLinks(t.id).filter(x=>String(x.link_role||'').toUpperCase()==='REQUIRED')){
    if(l.document_id===t.source_document_id)continue;
    const d=state.documents.find(x=>x.id===l.document_id);if(!d)continue;
    const v=approvedCurrentVersion(d.id);required.push({link:l,doc:d,version:v});
    if(d.status==='ARCHIVED'||!v)reasons.push(`${d.reference||documentDisplayTitle(d)} is not approved/current`);
  }
  return {ready:reasons.length===0,reasons,required};
};

trainingDependencyMessage=function(t){
  const d=trainingDependencyState(t);
  return d.ready?'':`Training cannot be completed until all required controlled documents are approved/current: ${d.reasons.join('; ')}`;
};

requiredTrainingMaterials=function(a,t){
  if(!a||!t)return [];
  const out=[],seenDocs=new Set();
  if(t.source_document_id){
    const d=state.documents.find(x=>x.id===t.source_document_id);
    const v=state.versions.find(x=>x.id===t.source_document_version_id)||approvedCurrentVersion(t.source_document_id)||currentVersion(t.source_document_id);
    if(d){out.push({kind:'DOCUMENT',document:d,version:v||null,available:!!(d.status!=='ARCHIVED'&&v&&isVersionApproved(v)&&v.status==='CURRENT'),label:`${d.reference||docTypeLabel(d.doc_type)} - ${documentDisplayTitle(d)}`});seenDocs.add(d.id)}
  }else{
    const f=latestTrainingFile(t.id);
    if(f)out.push({kind:'TRAINING_FILE',file:f,available:true,label:f.file_name||t.name});
  }
  for(const l of trainingLinks(t.id).filter(x=>String(x.link_role||'').toUpperCase()==='REQUIRED')){
    if(seenDocs.has(l.document_id))continue;
    const d=state.documents.find(x=>x.id===l.document_id);if(!d)continue;
    const approved=approvedCurrentVersion(d.id),fallback=currentVersion(d.id)||latestVersion(d.id);
    out.push({kind:'DOCUMENT',document:d,version:approved||fallback||null,available:!!(d.status!=='ARCHIVED'&&approved),label:`${d.reference||docTypeLabel(d.doc_type)} - ${documentDisplayTitle(d)}`});seenDocs.add(d.id);
  }
  return out;
};

trainingCatalogueTraffic=function(t){
  if(t.status==='ARCHIVED')return 'neutral';
  if(trainingKind(t)==='TOOLBOX_TALK'){
    const a=trainingApprovalStatus(t);
    if(a==='PENDING')return 'red';
    if(!['APPROVED','LEGACY'].includes(a))return 'red';
  }
  if(!trainingSourceApproved(t))return 'amber';
  if(t.review_date&&t.review_date<todayISO())return 'red';
  if(t.review_required||(t.review_date&&t.review_date>=todayISO()&&t.review_date<=daysFromNow(30)))return 'amber';
  return 'green';
};
