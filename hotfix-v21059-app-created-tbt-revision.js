/* Safety Tracker v2.10.59 CLEAN
   Small additive in-app revision workflow for Safety Tracker-created Toolbox Talks.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21059_BOOT_REQUESTED)return;
  window.__SAFETY_V21059_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof creatorGenerateAndImport==='function' &&
      typeof showCreatorWizard==='function' &&
      typeof creatorPdf==='function' &&
      typeof showTrainingDetails==='function' &&
      typeof trainingKind==='function' &&
      typeof trainingReference==='function' &&
      typeof latestTrainingFile==='function' &&
      typeof hashPdf==='function' &&
      typeof refresh==='function' &&
      !!window.SafetyCreatorRevisionV21058 &&
      !!window.SafetyLinkedImpactV21057 &&
      !!window.__SAFETY_V21058_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21059_INSTALLED)return;
    window.__SAFETY_V21059_INSTALLED=true;

    const BUILD='2.10.59';
    const base={
      creatorGenerateAndImport,
      showTrainingDetails
    };
    let drafts59=[],loading59=null,observer59=null;

    const $59=id=>document.getElementById(id);
    const clean59=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc59=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const toast59=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const manager59=()=>{try{return !!isManager()}catch(_e){return false}};
    const today59=()=>{try{return todayISO()}catch(_e){return new Date().toISOString().slice(0,10)}};
    const plusYear59=v=>{try{return plusYear(v)}catch(_e){const d=new Date((v||today59())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)}};
    const safe59=s=>{try{return safeFileName(s)}catch(_e){return clean59(s).replace(/[<>:"/\\|?*]+/g,'-').slice(0,110)||'toolbox-talk'}};

    function nextDraftVersion59(v){
      const s=clean59(v||'1');
      const m=s.match(/^(.*?)(\d+)([^0-9]*)$/);
      if(!m)return '2';
      return `${m[1]}${Number(m[2])+1}${m[3]}`;
    }

    async function loadDrafts59(force=false){
      if(loading59&&!force)return loading59;
      if(!navigator.onLine||state.offline)return drafts59;
      loading59=(async()=>{
        try{
          const r=await sb.from('document_creation_drafts')
            .select('id,doc_type,title,source_document_ids,questionnaire,recommendation,status,created_by,created_at,updated_at,imported_document_id,imported_training_session_id,imported_version_id,revision_of_draft_id,revision_target_document_id,revision_target_training_session_id')
            .order('updated_at',{ascending:false}).limit(300);
          if(!r.error)drafts59=r.data||[];
          else console.warn('TBT creator revisions',r.error);
        }catch(e){console.warn('TBT creator revisions',e)}
        finally{loading59=null}
        return drafts59;
      })();
      return loading59;
    }

    async function getDraft59(id){
      const local=drafts59.find(x=>x.id===id);
      if(local)return local;
      const r=await sb.from('document_creation_drafts').select('*').eq('id',id).single();
      return r.error?null:r.data;
    }

    function draftForTraining59(trainingId){
      return drafts59.find(d=>
        d.imported_training_session_id===trainingId &&
        String(d.doc_type||'').toUpperCase()==='TOOLBOX_TALK' &&
        d.status==='IMPORTED'
      )||null;
    }

    function pendingReplacement59(trainingId){
      return (state.training||[]).find(t=>
        t.replaces_training_session_id===trainingId &&
        t.status!=='ARCHIVED' &&
        String(t.approval_status||'').toUpperCase()==='PENDING'
      )||null;
    }

    function audience59(trainingId){
      const rows=(state.trainingAudiences||[]).filter(x=>x.training_session_id===trainingId);
      const everyone=rows.some(x=>x.target_type==='EVERYONE');
      const departmentIds=rows.filter(x=>x.target_type==='DEPARTMENT'&&x.department_id).map(x=>x.department_id);
      let userIds=rows.filter(x=>x.target_type==='PERSON'&&x.user_id).map(x=>x.user_id);
      const dueDays=Number(rows.find(x=>x.due_days)?.due_days||14);
      if(!everyone&&!departmentIds.length&&!userIds.length){
        userIds=[...new Set((state.trainingAssignments||[]).filter(a=>a.training_session_id===trainingId&&a.active!==false).map(a=>a.user_id).filter(Boolean))];
      }
      return {everyone,departmentIds,userIds,dueDays};
    }

    function sourceIds59(trainingId,fallback=[]){
      const ids=(state.trainingDocumentLinks||[]).filter(x=>x.training_session_id===trainingId).map(x=>x.document_id).filter(Boolean);
      return [...new Set(ids.length?ids:(fallback||[]))];
    }

    async function impactFlag59(sourceVersionId,trainingId,note){
      if(!sourceVersionId)return;
      try{
        const existing=await sb.from('linked_impact_reviews_v21057')
          .select('id').eq('source_version_id',sourceVersionId).eq('target_kind','TRAINING')
          .eq('target_training_session_id',trainingId).eq('outcome','NEW_VERSION_REQUIRED').limit(1);
        if(existing.data?.length)return;
      }catch(_e){}
      const mod=window.SafetyTrackerV2?.documentChangeImpactV21040;
      let c=null;try{c=(mod?.candidates||[]).find(x=>x?.version?.id===sourceVersionId)||null}catch(_e){}
      if(!c)return;
      const reviewer=clean59(state.profile?.display_name||state.user?.email||'Authenticated reviewer');
      const r=await sb.rpc('record_linked_impact_review_v21057',{
        p_source_document_id:c.doc.id,
        p_source_version_id:c.version.id,
        p_target_kind:'TRAINING',
        p_target_id:trainingId,
        p_outcome:'NEW_VERSION_REQUIRED',
        p_review_note:note||'In-app Toolbox Talk revision started.',
        p_reviewer_name:reviewer
      });
      if(r.error)console.warn('TBT impact revision flag',r.error);
    }

    function showStart59(trainingId,sourceVersionId=''){
      if(!manager59())return toast59('Manager or Admin access required.');
      const t=(state.training||[]).find(x=>x.id===trainingId);
      const src=draftForTraining59(trainingId);
      if(!t||String(trainingKind(t)||'').toUpperCase()!=='TOOLBOX_TALK'||!src)
        return toast59('This Toolbox Talk was not created in Safety Tracker, so use the normal replacement PDF route.');
      if(pendingReplacement59(trainingId))
        return toast59('A replacement Toolbox Talk is already pending approval.');

      openModal('Edit Toolbox Talk in app · new version',`
        <p><strong>${esc59(trainingReference(t)||'TBT')} - ${esc59(t.name||'Toolbox Talk')}</strong></p>
        <div class="hint-box">Safety Tracker will copy the current in-app Toolbox Talk content into a new revision draft. Edit only what changed. The approved TBT remains live until the replacement is approved. Every TBT version remains instructor-led.</div>
        <label>Reason for revision<textarea id="revision59Reason" rows="3" placeholder="e.g. Updated control following COSHH revision."></textarea></label>
        <label class="check-row"><input id="revision59Ack" type="checkbox"> Create a new draft from the current in-app TBT and keep the approved TBT unchanged until replacement approval.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-revision59-start="${esc59(trainingId)}|${esc59(sourceVersionId)}">Open revision draft</button></div>
      `);
    }

    async function start59(payload){
      if(!$59('revision59Ack')?.checked)return toast59('Tick the confirmation first.');
      const [trainingId,sourceVersionId='']=String(payload||'').split('|');
      const reason=clean59($59('revision59Reason')?.value);
      if(reason.length<5)return toast59('Add a short reason for the revision.');

      const t=(state.training||[]).find(x=>x.id===trainingId),src=draftForTraining59(trainingId);
      if(!t||!src)return toast59('The source creator draft could not be found.');
      if(pendingReplacement59(trainingId))return toast59('A replacement Toolbox Talk is already pending approval.');

      await impactFlag59(sourceVersionId,trainingId,reason);

      const q=JSON.parse(JSON.stringify(src.questionnaire||{}));
      q.reference=trainingReference(t)||t.reference||q.reference||'';
      q.version=nextDraftVersion59(q.version||'1');
      q.title=t.name||q.title||src.title||'';
      q.revisionReason=reason;

      const row={
        doc_type:'TOOLBOX_TALK',
        title:t.name||src.title,
        source_document_ids:sourceIds59(trainingId,src.source_document_ids||[]),
        questionnaire:q,
        recommendation:{...(src.recommendation||{}),revision:true,revision_reason:reason},
        status:'DRAFT',
        created_by:state.user.id,
        revision_of_draft_id:src.id,
        revision_target_training_session_id:trainingId,
        updated_at:new Date().toISOString()
      };

      const r=await sb.from('document_creation_drafts').insert(row).select().single();
      if(r.error)return toast59(r.error.message);
      drafts59.unshift(r.data);
      try{closeModal()}catch(_e){}
      setTimeout(()=>showCreatorWizard('TOOLBOX_TALK',r.data),30);
    }

    async function importRevision59(d){
      if(!manager59())return toast59('Manager or Admin access required.');
      const old=(state.training||[]).find(x=>x.id===d.revision_target_training_session_id);
      if(!old||String(trainingKind(old)||'').toUpperCase()!=='TOOLBOX_TALK')return toast59('Revision target Toolbox Talk was not found.');
      if(pendingReplacement59(old.id))return toast59('A replacement Toolbox Talk is already pending approval.');
      if(!window.jspdf?.jsPDF)return toast59('PDF library did not load.');

      const q={...(d.questionnaire||{})};
      q.reference=trainingReference(old)||old.reference||q.reference||'';
      q.version=q.version||nextDraftVersion59(draftForTraining59(old.id)?.questionnaire?.version||'1');
      const working={...d,title:old.name||d.title,questionnaire:q};
      const made=creatorPdf(working),blob=made.doc.output('blob');
      const name=`${safe59((q.reference||'TBT')+'-'+(old.name||'Toolbox Talk'))}-v${safe59(q.version)}.pdf`;
      const a=audience59(old.id);
      if(!a.everyone&&!a.departmentIds.length&&!a.userIds.length)return toast59('The current Toolbox Talk has no audience to copy.');

      const ins=await sb.from('training_sessions').insert({
        name:old.name,
        session_type:'TOOLBOX_TALK',
        delivery_method:'INSTRUCTOR_LED',
        description:old.description||q.task||null,
        review_date:plusYear59(today59()),
        renewal_value:old.renewal_value||12,
        renewal_unit:old.renewal_unit||'MONTHS',
        schedule_mode:old.schedule_mode||'RECURRING',
        status:'ACTIVE',
        created_by:state.user.id,
        reference:trainingReference(old)||old.reference||null,
        source_kind:'TOOLBOX_TALK',
        auto_managed:false,
        approval_status:'PENDING',
        default_due_date:daysFromNow(14),
        replaces_training_session_id:old.id,
        review_required:false,
        review_reason:null,
        trainer_user_id:state.user.id
      }).select().single();
      if(ins.error)return toast59(ins.error.message);

      const nt=ins.data,path=`training/${nt.id}/${crypto.randomUUID()}-${name}`;
      let uploaded=false;
      try{
        const up=await sb.storage.from('safety-files').upload(path,blob,{contentType:'application/pdf'});
        if(up.error)throw up.error;
        uploaded=true;

        const fr=await sb.from('training_files').insert({
          training_session_id:nt.id,
          file_name:name,
          storage_path:path,
          uploaded_by:state.user.id,
          content_text_sha256:await hashPdf(blob)
        }).select().single();
        if(fr.error)throw fr.error;

        for(const l of (state.trainingDocumentLinks||[]).filter(x=>x.training_session_id===old.id)){
          const lr=await sb.from('training_document_links').insert({
            training_session_id:nt.id,
            document_id:l.document_id,
            link_role:l.link_role||'RELATED',
            created_by:state.user.id
          });
          if(lr.error)console.warn('Copy TBT document link',lr.error);
        }

        const ar=await sb.rpc('set_training_session_audience_v239',{
          p_training_session_id:nt.id,
          p_everyone:a.everyone,
          p_department_ids:a.departmentIds,
          p_user_ids:a.userIds,
          p_due_days:a.dueDays
        });
        if(ar.error)throw ar.error;

        const dr=await sb.from('document_creation_drafts').update({
          status:'IMPORTED',
          imported_training_session_id:nt.id,
          updated_at:new Date().toISOString()
        }).eq('id',d.id);
        if(dr.error)throw dr.error;
      }catch(e){
        console.warn('In-app TBT revision import',e);
        try{if(uploaded)await sb.storage.from('safety-files').remove([path])}catch(_e){}
        try{await sb.from('training_sessions').delete().eq('id',nt.id)}catch(_e){}
        return toast59(e?.message||'Could not create replacement Toolbox Talk.');
      }

      try{closeModal()}catch(_e){}
      await loadDrafts59(true);
      await refresh(`Replacement ${q.reference||'Toolbox Talk'} v${q.version} created as Pending approval. The existing approved TBT remains live until approval.`);
      setTimeout(()=>showTrainingDetails(nt.id),120);
    }

    creatorGenerateAndImport=async function(id){
      const d=await getDraft59(id);
      if(d?.revision_target_training_session_id&&String(d.doc_type||'').toUpperCase()==='TOOLBOX_TALK'){
        return importRevision59(d);
      }
      return base.creatorGenerateAndImport.apply(this,arguments);
    };
    try{window.creatorGenerateAndImport=creatorGenerateAndImport}catch(_e){}

    function enhanceTrainingDetails59(id){
      if(!manager59())return;
      const t=(state.training||[]).find(x=>x.id===id),body=$59('modalBody');
      if(!t||!body||String(trainingKind(t)||'').toUpperCase()!=='TOOLBOX_TALK'||!draftForTraining59(id)||$59('revision59TrainingButton'))return;
      const box=document.createElement('div');box.id='revision59TrainingButton';box.className='section-card';
      box.innerHTML=`<div class="row-between"><div><strong>In-app controlled source</strong><div class="muted">This Toolbox Talk was created in Safety Tracker. Create the next version by editing the existing structured content rather than rebuilding it.</div></div><button type="button" class="secondary" data-revision59-training="${esc59(id)}">Edit in app → new version</button></div>`;
      body.insertAdjacentElement('afterbegin',box);
    }

    showTrainingDetails=function(id){
      const out=base.showTrainingDetails.apply(this,arguments);
      setTimeout(()=>enhanceTrainingDetails59(id),0);
      return out;
    };
    try{window.showTrainingDetails=showTrainingDetails}catch(_e){}

    function enhanceImpact59(){
      if(!manager59())return;
      document.querySelectorAll('button[data-impact57-modify]').forEach(baseBtn=>{
        const parts=String(baseBtn.dataset.impact57Modify||'').split('|');
        if(parts[1]!=='TRAINING')return;
        const sourceVersionId=parts[0],trainingId=parts[2];
        if(!draftForTraining59(trainingId))return;
        const parent=baseBtn.parentElement;if(!parent||parent.querySelector('[data-revision59-impact]'))return;
        const b=document.createElement('button');b.type='button';b.className='secondary';
        b.dataset.revision59Impact=`${trainingId}|${sourceVersionId}`;
        b.textContent='Edit in app → new version';
        parent.insertBefore(b,baseBtn);
      });
    }

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b)return;
      if(b.dataset.revision59Training){
        e.preventDefault();e.stopImmediatePropagation();
        return showStart59(b.dataset.revision59Training,'');
      }
      if(b.dataset.revision59Impact){
        e.preventDefault();e.stopImmediatePropagation();
        const [trainingId,sourceVersionId]=b.dataset.revision59Impact.split('|');
        return showStart59(trainingId,sourceVersionId);
      }
      if(b.dataset.revision59Start){
        e.preventDefault();e.stopImmediatePropagation();
        return start59(b.dataset.revision59Start);
      }
    },true);

    function observe59(){
      if(observer59)return;
      observer59=new MutationObserver(()=>enhanceImpact59());
      observer59.observe(document.body,{childList:true,subtree:true});
      [0,500,1500,3000].forEach(ms=>setTimeout(enhanceImpact59,ms));
    }

    loadDrafts59().then(observe59);

    window.SafetyTbtCreatorRevisionV21059={
      BUILD,
      load:loadDrafts59,
      draftForTraining:draftForTraining59,
      start:showStart59
    };
  }

  boot();
})();
