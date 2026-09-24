/* Safety Tracker v2.11.15 - controlled-document auto-link repair */
'use strict';
(function(){
  if(window.__SAFETY_AUTO_LINK_REPAIR_V21115)return;
  window.__SAFETY_AUTO_LINK_REPAIR_V21115=true;

  function boot(){
    const api=window.SafetyTrackerV2;
    if(!api||!api.state||!api.sb||typeof api.pdfTextFromBlob!=='function'){
      setTimeout(boot,120);return;
    }
    install(api);
  }

  function install(api){
    const state=api.state,sb=api.sb;
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const canon=v=>api.canonicalRef?.(v)||clean(v).toUpperCase();

    function trainingRef(t){
      return clean(t?.reference)||((String(t?.name||'').match(/\bTBT-\d{3,4}\b/i)||[])[0]||'').toUpperCase();
    }
    function activeTraining(){
      return (state.training||[]).filter(t=>t.status!=='ARCHIVED');
    }
    function pairExists(a,b){
      return (state.documentLinks||[]).some(l=>
        (l.source_document_id===a&&l.target_document_id===b)||
        (l.source_document_id===b&&l.target_document_id===a)
      );
    }
    function inferLinkType(a,b){
      if(!a||!b)return null;
      if(a.doc_type==='SDS'&&b.doc_type==='COSHH')return {source:a,target:b,type:'SDS_TO_COSHH'};
      if(a.doc_type==='COSHH'&&b.doc_type==='SDS')return {source:b,target:a,type:'SDS_TO_COSHH'};
      if(a.doc_type==='COSHH'&&b.doc_type==='SSW')return {source:a,target:b,type:'COSHH_TO_SSW'};
      if(a.doc_type==='SSW'&&b.doc_type==='COSHH')return {source:b,target:a,type:'COSHH_TO_SSW'};
      if(a.doc_type==='RISK_ASSESSMENT'&&b.doc_type==='SSW')return {source:a,target:b,type:'RA_TO_SSW'};
      if(a.doc_type==='SSW'&&b.doc_type==='RISK_ASSESSMENT')return {source:b,target:a,type:'RA_TO_SSW'};
      return {source:a,target:b,type:'RELATED'};
    }

    function linkContextText(text){
      const raw=clean(text);
      const markers=/\b(?:RELATED DOCUMENTS?|LINKED DOCUMENTS?|ASSOCIATED DOCUMENTS?|REFERENCE DOCUMENTS?|REFERENCES?|SUPPORTING DOCUMENTS?|RELEVANT DOCUMENTS?|APPLICABLE DOCUMENTS?|DOCUMENTS? REFERENCED|SEE ALSO|REFER TO|REFERRED TO|LINKED TO|ASSOCIATED WITH|RELATED CONTROLS?|SUPPORTING CONTROLS?|RELATED ASSESSMENTS?|RELEVANT RA(?:S)?|RELEVANT RISK ASSESSMENTS?|RELEVANT COSHH(?: RISK ASSESSMENTS?)?|APPLICABLE RA(?:S)?|APPLICABLE RISK ASSESSMENTS?|APPLICABLE COSHH(?: RISK ASSESSMENTS?)?|SUPPORTING (?:RA|RISK ASSESSMENTS?|COSHH(?: RISK ASSESSMENTS?)?|SSW|SAFE SYSTEMS? OF WORK|TBT|TOOLBOX TALKS?|DOCUMENTS?|CONTROLS?)|RELATED (?:RA|RISK ASSESSMENTS?|COSHH(?: RISK ASSESSMENTS?)?|SSW|SAFE SYSTEMS? OF WORK|TBT|TOOLBOX TALKS?|CONTROLS?)|LINKED (?:RA|RISK ASSESSMENTS?|COSHH(?: RISK ASSESSMENTS?)?|SSW|SAFE SYSTEMS? OF WORK|TBT|TOOLBOX TALKS?)|(?:RA|RISK ASSESSMENT|COSHH|SSW|SAFE SYSTEM OF WORK|TBT|TOOLBOX TALK) REFERENCES?)\b/gi;
      const chunks=[];let m;
      while((m=markers.exec(raw))!==null){
        chunks.push(raw.slice(Math.max(0,m.index-140),Math.min(raw.length,m.index+760)));
        if(chunks.length>=50)break;
      }
      return chunks.join(' | ');
    }

    function declaredRefs(text,owner=null){
      const ctx=linkContextText(text);
      const refs=new Set((api.refsInText?.(ctx)||[]).map(canon).filter(Boolean));
      const own=canon(owner?.reference||'');
      if(own)refs.delete(own);
      return [...refs];
    }
    function docByRef(ref){
      const c=canon(ref);
      return (state.documents||[]).find(d=>d.status!=='ARCHIVED'&&d.doc_type!=='ASBESTOS'&&canon(d.reference||'')===c)||null;
    }
    function trainingByRef(ref){
      const c=canon(ref);
      return activeTraining().find(t=>canon(trainingRef(t))===c)||null;
    }
    function unresolvedRefs(text,owner=null){
      return declaredRefs(text,owner).filter(ref=>!docByRef(ref)&&!trainingByRef(ref));
    }

    async function setLinkSyncFlag(row,table,refs){
      const current=String(row.review_reason||'');
      if(refs.length){
        const reason=`[LINK_SYNC] Referenced controlled document${refs.length===1?'':'s'} not found: ${refs.join(', ')}. Upload the missing document or correct the reference.`;
        if(row.review_required===true&&current===reason)return 0;
        const r=await sb.from(table).update({review_required:true,review_reason:reason}).eq('id',row.id);
        if(r.error)throw r.error;
        row.review_required=true;row.review_reason=reason;
        return 1;
      }
      if(row.review_required===true&&current.startsWith('[LINK_SYNC]')){
        const r=await sb.from(table).update({review_required:false,review_reason:null}).eq('id',row.id);
        if(r.error)throw r.error;
        row.review_required=false;row.review_reason=null;
        return 1;
      }
      return 0;
    }

    function versionsToScan(doc){
      const approved=api.approvedCurrentVersion?.(doc.id);
      if(approved?.storage_path)return [approved];
      return (state.versions||[])
        .filter(v=>v.document_id===doc.id&&v.storage_path&&api.versionApprovalStatus?.(v)==='PENDING')
        .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))
        .slice(0,1);
    }

    async function scanDocument(doc,version){
      if(!version?.storage_path)return {changes:0,missing:0};
      let changes=0;
      const dl=await sb.storage.from('safety-files').download(version.storage_path);
      if(dl.error||!dl.data)throw dl.error||new Error('Could not read stored PDF');
      const text=await api.pdfTextFromBlob(dl.data);

      for(const match of (api.declaredDocumentMatches?.(text,doc)||[])){
        const other=match.doc;
        if(!other||other.doc_type==='ASBESTOS'||pairExists(doc.id,other.id))continue;
        const rel=inferLinkType(doc,other);
        if(!rel?.source||!rel?.target)continue;
        const ins=await sb.from('document_links').insert({
          source_document_id:rel.source.id,
          target_document_id:rel.target.id,
          link_type:rel.type,
          created_by:state.user?.id||null
        }).select().single();
        if(!ins.error){
          state.documentLinks.push(ins.data);
          changes++;
        }else if(!/duplicate|unique/i.test(ins.error.message||'')){
          throw ins.error;
        }
      }

      for(const ref of declaredRefs(text,doc)){
        const t=trainingByRef(ref);
        if(t&&canon(trainingRef(t)).startsWith('TBT-')){
          changes+=await api.ensureTrainingDocLink(t.id,doc.id,'RELATED');
        }
      }

      const missing=unresolvedRefs(text,doc);
      changes+=await setLinkSyncFlag(doc,'documents',missing);

      const u=await sb.from('document_versions').update({
        links_scanned_at:new Date().toISOString()
      }).eq('id',version.id);
      if(u.error)throw u.error;

      return {changes,missing:missing.length};
    }

    async function scanTraining(training,file){
      if(!file?.storage_path)return {changes:0,missing:0};
      let changes=0;
      const dl=await sb.storage.from('safety-files').download(file.storage_path);
      if(dl.error||!dl.data)throw dl.error||new Error('Could not read stored training PDF');
      const text=await api.pdfTextFromBlob(dl.data);

      for(const match of (api.declaredDocumentMatches?.(text,null)||[])){
        const d=match.doc;
        if(d&&d.doc_type!=='ASBESTOS'){
          changes+=await api.ensureTrainingDocLink(training.id,d.id,'RELATED');
        }
      }

      const missing=unresolvedRefs(text,null);
      changes+=await setLinkSyncFlag(training,'training_sessions',missing);

      const u=await sb.from('training_files').update({
        links_scanned_at:new Date().toISOString()
      }).eq('id',file.id);
      if(u.error)throw u.error;
      return {changes,missing:missing.length};
    }

    async function scanControlledFiles(mode='recent',progress=()=>{}){
      const cutoff=Date.now()-20*60*1000;
      let changes=0,scanned=0,missing=0;

      const docs=(state.documents||[]).filter(d=>d.status!=='ARCHIVED'&&d.doc_type!=='ASBESTOS');
      for(const d of docs){
        for(const v of versionsToScan(d)){
          const recent=new Date(v.created_at||0).getTime()>=cutoff;
          if(mode!=='full'&&(!recent||v.links_scanned_at))continue;
          progress(`Reading declared links in ${d.reference||d.title}${api.versionApprovalStatus?.(v)==='PENDING'?' (pending version)':''}…`);
          try{
            const r=await scanDocument(d,v);
            changes+=r.changes;missing+=r.missing;scanned++;
          }catch(e){
            console.warn('v2.11.15 document link scan',d.id,e);
          }
        }
      }

      const latest=new Map();
      for(const f of (state.trainingFiles||[])){
        const old=latest.get(f.training_session_id);
        if(!old||new Date(f.created_at||0)>new Date(old.created_at||0))latest.set(f.training_session_id,f);
      }
      for(const t of activeTraining()){
        const f=latest.get(t.id);
        if(!f?.storage_path)continue;
        const recent=new Date(f.created_at||0).getTime()>=cutoff;
        if(mode!=='full'&&(!recent||f.links_scanned_at))continue;
        progress(`Reading declared links in training file ${t.name}…`);
        try{
          const r=await scanTraining(t,f);
          changes+=r.changes;missing+=r.missing;scanned++;
        }catch(e){
          console.warn('v2.11.15 training link scan',t.id,e);
        }
      }

      return {changes,scanned,missing};
    }

    async function repairedRunSafetySync({scan='recent',progress=()=>{},rebuildLinks=false}={}){
      if(state.syncBusy)return {changes:0,scanned:0,missing:0};
      state.syncBusy=true;
      let changes=0,scanned=0,missing=0;
      try{
        progress('Applying issue/review date defaults…');
        if(typeof normaliseDefaults==='function')changes+=await normaliseDefaults();

        if(scan==='full'||rebuildLinks){
          if(typeof repairRaTitles==='function'){
            progress('Checking Risk Assessment titles…');
            const rr=await repairRaTitles({silent:true,refreshAfter:false,progress});
            changes+=rr?.changed||0;
          }
          if(typeof repairSdsTitles==='function'){
            progress('Checking SDS/MSDS product titles…');
            const sr=await repairSdsTitles({silent:true,refreshAfter:false,progress});
            changes+=sr?.changed||0;
          }
        }

        progress('Reading document-to-document links stated inside the PDFs…');
        const lr=await scanControlledFiles(scan,progress);
        changes+=lr.changes;scanned+=lr.scanned;missing+=lr.missing;

        progress('Synchronising approved RA/COSHH/SSW Training records…');
        if(typeof syncSourceTrainings==='function')changes+=await syncSourceTrainings();

        if(typeof propagateReviewFlags==='function'){
          progress('Checking linked-document change impacts…');
          changes+=await propagateReviewFlags();
        }

        return {changes,scanned,missing};
      }finally{
        state.syncBusy=false;
      }
    }

    runSafetySync=repairedRunSafetySync;
    window.runSafetySync=repairedRunSafetySync;
    api.runSafetySync=repairedRunSafetySync;

    async function repairedForceSync(){
      if(typeof isAdmin==='function'&&!isAdmin())return;
      const b=document.getElementById('forceSyncBtn');
      const s=document.getElementById('forceSyncStatus');
      if(b)b.disabled=true;
      if(s){s.hidden=false;s.textContent='Starting Force Sync & Review…'}
      try{
        await api.loadAll();
        const r=await repairedRunSafetySync({
          scan:'full',
          rebuildLinks:true,
          progress:m=>{if(s)s.textContent=m}
        });
        await api.loadAll();
        if(s)s.textContent=`Force Sync complete. ${r.scanned} PDF${r.scanned===1?'':'s'} checked for declared links; ${r.changes} update${r.changes===1?'':'s'} applied${r.missing?`; ${r.missing} unresolved reference${r.missing===1?'':'s'} still flagged`:''}.`;
        try{renderDocuments()}catch(_e){}
        try{renderTraining()}catch(_e){}
        try{renderAdmin()}catch(_e){}
        api.toast?.(`Force Sync checked ${r.scanned} PDF${r.scanned===1?'':'s'} and repaired document links.`);
      }catch(e){
        console.error('v2.11.15 Force Sync',e);
        if(s)s.textContent=`Force Sync failed: ${e?.message||e}`;
        api.toast?.('Force Sync failed.');
      }finally{
        if(b)b.disabled=false;
      }
    }
    forceSyncFromUI=repairedForceSync;
    window.forceSyncFromUI=repairedForceSync;

    let autoBusy=false;
    async function autoLinkAfterUpload(label='Upload'){
      if(autoBusy||state.offline||!navigator.onLine)return;
      autoBusy=true;
      try{
        await api.loadAll();
        const r=await repairedRunSafetySync({scan:'full',rebuildLinks:true});
        await api.loadAll();
        if(r.scanned||r.changes||r.missing){
          api.toast?.(`${label}: links checked automatically — ${r.changes} update${r.changes===1?'':'s'}${r.missing?`, ${r.missing} unresolved reference${r.missing===1?'':'s'} flagged`:''}.`);
        }
      }catch(e){
        console.warn('v2.11.15 automatic link scan',e);
      }finally{
        autoBusy=false;
      }
    }

    function wrapAsyncGlobal(name,label){
      const original=window[name];
      if(typeof original!=='function'||original.__v21115Wrapped)return;
      const wrapped=async function(){
        const result=await original.apply(this,arguments);
        await autoLinkAfterUpload(label);
        return result;
      };
      wrapped.__v21115Wrapped=true;
      window[name]=wrapped;
      try{eval(`${name}=wrapped`)}catch(_e){}
    }

    wrapAsyncGlobal('createDocumentRecord','Document upload');
    wrapAsyncGlobal('publishVersionFromModal','Replacement version');
    wrapAsyncGlobal('createTraining','Training upload');
    wrapAsyncGlobal('creatorGenerateAndImport','Created document');

    window.SafetyAutoLinkRepairV21115={
      sync:repairedRunSafetySync,
      scan:scanControlledFiles,
      auto:()=>autoLinkAfterUpload('Manual link scan')
    };
  }
  boot();
})();
