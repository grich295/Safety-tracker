/* Safety Tracker v2.10.58 CLEAN
   Small additive in-app revision workflow for Safety Tracker-created SSWs.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21058_BOOT_REQUESTED)return;
  window.__SAFETY_V21058_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof showDocDetails==='function' &&
      typeof creatorGenerateAndImport==='function' &&
      typeof showCreatorWizard==='function' &&
      typeof creatorPdf==='function' &&
      typeof creatorDocDbType==='function' &&
      typeof creatorNextRef==='function' &&
      typeof nextVersionLabel==='function' &&
      typeof pendingApprovalVersion==='function' &&
      typeof approvedCurrentVersion==='function' &&
      typeof safeFileName==='function' &&
      typeof hashPdf==='function' &&
      typeof refresh==='function' &&
      !!window.SafetyLinkedImpactV21057 &&
      !!window.__SAFETY_V21057_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21058_INSTALLED)return;
    window.__SAFETY_V21058_INSTALLED=true;

    const BUILD='2.10.58';
    const base={
      creatorGenerateAndImport,
      showDocDetails
    };
    let drafts58=[],loading58=null,observer58=null;

    const $58=id=>document.getElementById(id);
    const clean58=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc58=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const toast58=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const title58=d=>{try{return documentDisplayTitle(d)}catch(_e){return d?.title||''}};
    const today58=()=>{try{return todayISO()}catch(_e){return new Date().toISOString().slice(0,10)}};
    const plusYear58=v=>{try{return plusYear(v)}catch(_e){const d=new Date((v||today58())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)}};
    const manager58=()=>{try{return !!isManager()}catch(_e){return false}};

    async function loadDraftLinks58(force=false){
      if(loading58&&!force)return loading58;
      if(!navigator.onLine||state.offline)return drafts58;
      loading58=(async()=>{
        try{
          const r=await sb.from('document_creation_drafts')
            .select('id,doc_type,title,source_document_ids,questionnaire,recommendation,status,created_by,created_at,updated_at,imported_document_id,imported_training_session_id,imported_version_id,revision_of_draft_id,revision_target_document_id,revision_target_training_session_id')
            .order('updated_at',{ascending:false}).limit(300);
          if(!r.error)drafts58=r.data||[];
          else console.warn('Creator revision links',r.error);
        }catch(e){console.warn('Creator revision links',e)}
        finally{loading58=null}
        return drafts58;
      })();
      return loading58;
    }

    function draftForDocument58(docId){
      return drafts58.find(d=>d.imported_document_id===docId&&String(d.doc_type||'').toUpperCase()==='SSW'&&d.status==='IMPORTED')||null;
    }

    async function getDraft58(id){
      let d=drafts58.find(x=>x.id===id);
      if(d)return d;
      const r=await sb.from('document_creation_drafts').select('*').eq('id',id).single();
      return r.error?null:r.data;
    }

    async function linkNormalImport58(draftBefore){
      if(!draftBefore||draftBefore.revision_target_document_id||draftBefore.revision_target_training_session_id)return;
      const q=draftBefore.questionnaire||{},ref=clean58(q.reference);
      if(!ref)return;
      const type=String(draftBefore.doc_type||'').toUpperCase();
      try{
        if(type==='TOOLBOX_TALK'){
          const tr=await sb.from('training_sessions').select('id,created_at').eq('reference',ref).eq('session_type','TOOLBOX_TALK').order('created_at',{ascending:false}).limit(1);
          const t=tr.data?.[0];if(!t)return;
          const fr=await sb.from('training_files').select('id').eq('training_session_id',t.id).order('created_at',{ascending:false}).limit(1);
          await sb.from('document_creation_drafts').update({imported_training_session_id:t.id,updated_at:new Date().toISOString()}).eq('id',draftBefore.id);
        }else{
          const dbType=creatorDocDbType(type);
          const dr=await sb.from('documents').select('id,created_at').eq('reference',ref).eq('doc_type',dbType).order('created_at',{ascending:false}).limit(1);
          const doc=dr.data?.[0];if(!doc)return;
          const vr=await sb.from('document_versions').select('id').eq('document_id',doc.id).order('created_at',{ascending:false}).limit(1);
          await sb.from('document_creation_drafts').update({
            imported_document_id:doc.id,
            imported_version_id:vr.data?.[0]?.id||null,
            updated_at:new Date().toISOString()
          }).eq('id',draftBefore.id);
        }
      }catch(e){console.warn('Link creator import',e)}
      await loadDraftLinks58(true);
    }

    async function importSswRevision58(d){
      if(!manager58())return toast58('Manager or Admin access required.');
      const targetId=d.revision_target_document_id;
      const target=(state.documents||[]).find(x=>x.id===targetId);
      if(!target||String(target.doc_type||'').toUpperCase()!=='SSW')return toast58('Revision target SSW was not found.');
      if(pendingApprovalVersion(target.id))return toast58('A replacement SSW version is already pending approval. Complete that review first.');
      if(!window.jspdf?.jsPDF)return toast58('PDF library did not load.');

      const q={...(d.questionnaire||{})};
      q.reference=target.reference||q.reference||creatorNextRef('SSW');
      q.version=nextVersionLabel(target.id);
      const working={...d,title:target.title||d.title,questionnaire:q};
      const made=creatorPdf(working),blob=made.doc.output('blob');
      const ver=q.version,name=`${safeFileName((target.reference||'SSW')+'-'+title58(target))}-v${safeFileName(ver)}.pdf`;
      const path=`documents/${target.id}/${crypto.randomUUID()}-${name}`;
      const newHash=await hashPdf(blob);
      const current=approvedCurrentVersion(target.id);

      const up=await sb.storage.from('safety-files').upload(path,blob,{contentType:'application/pdf'});
      if(up.error)return toast58(up.error.message);

      const vr=await sb.from('document_versions').insert({
        document_id:target.id,
        version_label:ver,
        issue_date:today58(),
        review_date:plusYear58(today58()),
        delivery_method:target.delivery_method||current?.delivery_method||'INSTRUCTOR_LED',
        storage_path:path,
        file_name:name,
        notes:`Generated by Safety Tracker v${BUILD} from an in-app SSW revision draft. Previous approved version retained until this replacement is approved.`,
        status:current?'SUPERSEDED':'CURRENT',
        approval_status:'PENDING',
        content_text_sha256:newHash,
        created_by:state.user.id
      }).select().single();

      if(vr.error){
        try{await sb.storage.from('safety-files').remove([path])}catch(_e){}
        return toast58(vr.error.message);
      }

      await sb.from('document_creation_drafts').update({
        status:'IMPORTED',
        imported_document_id:target.id,
        imported_version_id:vr.data.id,
        updated_at:new Date().toISOString()
      }).eq('id',d.id);

      try{closeModal()}catch(_e){}
      await loadDraftLinks58(true);
      await refresh(`SSW ${target.reference||''} v${ver} created as Pending approval. The previous approved version remains in use.`);
      try{showView('documents')}catch(_e){}
    }

    creatorGenerateAndImport=async function(id){
      const d=await getDraft58(id);
      if(d?.revision_target_document_id&&String(d.doc_type||'').toUpperCase()==='SSW'){
        return importSswRevision58(d);
      }
      const out=await base.creatorGenerateAndImport.apply(this,arguments);
      await linkNormalImport58(d);
      return out;
    };
    try{window.creatorGenerateAndImport=creatorGenerateAndImport}catch(_e){}

    function linkedSourceIds58(docId,fallback=[]){
      const out=[];
      for(const l of (state.documentLinks||[])){
        let other=null;
        if(l.source_document_id===docId)other=l.target_document_id;
        else if(l.target_document_id===docId)other=l.source_document_id;
        if(!other)continue;
        const d=(state.documents||[]).find(x=>x.id===other);
        if(d&&['RISK_ASSESSMENT','COSHH'].includes(String(d.doc_type||'').toUpperCase()))out.push(d.id);
      }
      return [...new Set(out.length?out:(fallback||[]))];
    }

    function impactCandidate58(versionId){
      const m=window.SafetyTrackerV2?.documentChangeImpactV21040;
      try{return (m?.candidates||[]).find(c=>c?.version?.id===versionId)||null}catch(_e){return null}
    }

    async function alreadyImpactFlagged58(sourceVersionId,targetDocId){
      try{
        const r=await sb.from('linked_impact_reviews_v21057').select('id').eq('source_version_id',sourceVersionId).eq('target_kind','DOCUMENT').eq('target_document_id',targetDocId).eq('outcome','NEW_VERSION_REQUIRED').limit(1);
        return !!r.data?.length;
      }catch{return false}
    }

    async function flagImpact58(sourceVersionId,targetDocId,note){
      if(!sourceVersionId)return;
      if(await alreadyImpactFlagged58(sourceVersionId,targetDocId))return;
      const c=impactCandidate58(sourceVersionId);if(!c)return;
      const reviewer=clean58(state.profile?.display_name||state.user?.email||'Authenticated reviewer');
      const r=await sb.rpc('record_linked_impact_review_v21057',{
        p_source_document_id:c.doc.id,
        p_source_version_id:c.version.id,
        p_target_kind:'DOCUMENT',
        p_target_id:targetDocId,
        p_outcome:'NEW_VERSION_REQUIRED',
        p_review_note:note||'In-app SSW revision started.',
        p_reviewer_name:reviewer
      });
      if(r.error)console.warn('Impact revision flag',r.error);
    }

    function showStartRevision58(docId,sourceVersionId=''){
      const target=(state.documents||[]).find(x=>x.id===docId);
      const sourceDraft=draftForDocument58(docId);
      if(!target||!sourceDraft)return toast58('This SSW was not created in Safety Tracker, so use the normal replacement PDF route.');
      if(pendingApprovalVersion(docId))return toast58('A replacement SSW version is already pending approval.');
      openModal('Edit SSW in app · new version',`
        <p><strong>${esc58(target.reference||'SSW')} - ${esc58(title58(target))}</strong></p>
        <div class="hint-box">Safety Tracker will copy the last in-app SSW content into a new revision draft. Edit only what changed. The current approved version is not altered and stays live until the replacement is approved.</div>
        <label>Reason for revision<textarea id="revision58Reason" rows="3" placeholder="e.g. Updated control following COSHH revision."></textarea></label>
        <label class="check-row"><input id="revision58Ack" type="checkbox"> Create a new draft from the current in-app SSW. Do not edit the approved version in place.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-revision58-start="${esc58(docId)}|${esc58(sourceVersionId)}">Open revision draft</button></div>
      `);
    }

    async function startRevision58(payload){
      if(!$58('revision58Ack')?.checked)return toast58('Tick the confirmation first.');
      const [docId,sourceVersionId='']=String(payload||'').split('|');
      const reason=clean58($58('revision58Reason')?.value);
      if(reason.length<5)return toast58('Add a short reason for the revision.');
      const target=(state.documents||[]).find(x=>x.id===docId),source=draftForDocument58(docId);
      if(!target||!source)return toast58('The source creator draft could not be found.');
      if(pendingApprovalVersion(docId))return toast58('A replacement version is already pending approval.');

      await flagImpact58(sourceVersionId,docId,reason);

      const oldQ=source.questionnaire||{},q=JSON.parse(JSON.stringify(oldQ));
      q.reference=target.reference||q.reference||'';
      q.version=nextVersionLabel(docId);
      q.title=target.title||q.title||source.title||'';
      q.revisionReason=reason;
      const srcIds=linkedSourceIds58(docId,source.source_document_ids||[]);
      const payloadRow={
        doc_type:'SSW',
        title:target.title||source.title,
        source_document_ids:srcIds,
        questionnaire:q,
        recommendation:{...(source.recommendation||{}),revision:true,revision_reason:reason},
        status:'DRAFT',
        created_by:state.user.id,
        revision_of_draft_id:source.id,
        revision_target_document_id:docId,
        updated_at:new Date().toISOString()
      };
      const r=await sb.from('document_creation_drafts').insert(payloadRow).select().single();
      if(r.error)return toast58(r.error.message);
      drafts58.unshift(r.data);
      try{closeModal()}catch(_e){}
      setTimeout(()=>showCreatorWizard('SSW',r.data),30);
    }

    function enhanceImpactModal58(){
      if(!manager58())return;
      document.querySelectorAll('button[data-impact57-modify]').forEach(baseBtn=>{
        const raw=baseBtn.dataset.impact57Modify||'',parts=raw.split('|');
        if(parts[1]!=='DOCUMENT')return;
        const docId=parts[2],sourceVersionId=parts[0];
        if(!draftForDocument58(docId))return;
        const parent=baseBtn.parentElement;if(!parent||parent.querySelector('[data-revision58-impact]'))return;
        const b=document.createElement('button');b.type='button';b.className='secondary';
        b.dataset.revision58Impact=`${docId}|${sourceVersionId}`;
        b.textContent='Edit in app → new version';
        parent.insertBefore(b,baseBtn);
      });
    }

    function enhanceDocDetails58(id){
      if(!manager58())return;
      const d=(state.documents||[]).find(x=>x.id===id);
      const body=$58('modalBody');
      if(!d||!body||String(d.doc_type||'').toUpperCase()!=='SSW'||!draftForDocument58(id)||$58('revision58DocButton'))return;
      const box=document.createElement('div');
      box.id='revision58DocButton';
      box.className='section-card';
      box.innerHTML=`<div class="row-between"><div><strong>In-app controlled source</strong><div class="muted">This SSW was created in Safety Tracker. A revision can reuse the existing structured content instead of uploading a replacement PDF manually.</div></div><button type="button" class="secondary" data-revision58-doc="${esc58(id)}">Edit in app → new version</button></div>`;
      body.insertAdjacentElement('afterbegin',box);
    }

    showDocDetails=function(id){
      const out=base.showDocDetails.apply(this,arguments);
      setTimeout(()=>enhanceDocDetails58(id),0);
      return out;
    };
    try{window.showDocDetails=showDocDetails}catch(_e){}

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b)return;
      if(b.dataset.revision58Impact){
        e.preventDefault();e.stopImmediatePropagation();
        const [docId,sourceVersionId]=b.dataset.revision58Impact.split('|');
        return showStartRevision58(docId,sourceVersionId);
      }
      if(b.dataset.revision58Doc){
        e.preventDefault();e.stopImmediatePropagation();
        return showStartRevision58(b.dataset.revision58Doc,'');
      }
      if(b.dataset.revision58Start){
        e.preventDefault();e.stopImmediatePropagation();
        return startRevision58(b.dataset.revision58Start);
      }
    },true);

    function observe58(){
      if(observer58)return;
      observer58=new MutationObserver(()=>enhanceImpactModal58());
      observer58.observe(document.body,{childList:true,subtree:true});
      [0,500,1500,3000].forEach(ms=>setTimeout(enhanceImpactModal58,ms));
    }

    loadDraftLinks58().then(observe58);

    window.SafetyCreatorRevisionV21058={
      BUILD,
      load:loadDraftLinks58,
      draftForDocument:draftForDocument58,
      start:showStartRevision58
    };
  }

  boot();
})();
