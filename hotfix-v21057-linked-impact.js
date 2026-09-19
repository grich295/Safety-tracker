/* Safety Tracker v2.10.57 CLEAN
   Small additive linked RA/COSHH impact-review workflow.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21057_BOOT_REQUESTED)return;
  window.__SAFETY_V21057_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof openModal==='function' &&
      typeof closeModal==='function' &&
      typeof approvedCurrentVersion==='function' &&
      typeof latestTrainingFile==='function' &&
      typeof trainingKind==='function' &&
      typeof trainingReference==='function' &&
      typeof showNewVersion==='function' &&
      typeof openDocument==='function' &&
      typeof openTrainingFile==='function' &&
      !!window.SafetyTrackerV2?.documentChangeImpactV21040 &&
      !!window.__SAFETY_V21056_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21057_INSTALLED)return;
    window.__SAFETY_V21057_INSTALLED=true;

    const BUILD='2.10.57',TABLE='linked_impact_reviews_v21057';
    const core=window.SafetyTrackerV2;
    let reviews57=[],loading57=null,observer57=null;

    const $57=id=>document.getElementById(id);
    const esc57=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean57=v=>String(v??'').replace(/\s+/g,' ').trim();
    const manager57=()=>{try{return !!isManager()}catch(_e){return false}};
    const toast57=msg=>{try{return toast(msg)}catch(_e){console.log(msg)}};
    const fmt57=v=>{try{return fmtDate(v)}catch(_e){return v?new Date(v).toLocaleDateString('en-GB'):'—'}};
    const fmtDT57=v=>{try{return fmtDateTime(v)}catch(_e){return v?new Date(v).toLocaleString('en-GB'):'—'}};
    const title57=d=>{try{return documentDisplayTitle(d)}catch(_e){return d?.title||''}};
    const ref57=d=>d?.reference||d?.title||'Document';
    const today57=()=>{try{return todayISO()}catch(_e){return new Date().toISOString().slice(0,10)}};
    const plusYear57=v=>{try{return plusYear(v)}catch(_e){const d=new Date((v||today57())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)}};
    const safe57=s=>clean57(s).replace(/[<>:"/\\|?*]+/g,'-').slice(0,110)||'toolbox-talk';

    function impactCandidates57(){
      const m=core.documentChangeImpactV21040;
      try{return Array.isArray(m?.candidates)?m.candidates:(m?.get?.candidates||[])}catch(_e){return []}
    }
    function candidate57(versionId){return impactCandidates57().find(c=>c?.version?.id===versionId)||null}

    async function loadReviews57(force=false){
      if(loading57&&!force)return loading57;
      if(!navigator.onLine||state.offline)return reviews57;
      loading57=(async()=>{
        try{
          const r=await sb.from(TABLE).select('*').order('reviewed_at',{ascending:false});
          if(!r.error)reviews57=r.data||[];
          else console.warn('Linked impact reviews',r.error);
        }catch(e){console.warn('Linked impact reviews',e)}
        finally{loading57=null}
        return reviews57;
      })();
      return loading57;
    }

    function directLinkedDocs57(docId){
      const map=new Map();
      for(const l of (state.documentLinks||[])){
        let other=null;
        if(l.source_document_id===docId)other=l.target_document_id;
        else if(l.target_document_id===docId)other=l.source_document_id;
        if(!other)continue;
        const d=(state.documents||[]).find(x=>x.id===other&&x.status!=='ARCHIVED');
        if(d)map.set(d.id,d);
      }
      return [...map.values()];
    }

    function targets57(c){
      if(!c||!['RISK_ASSESSMENT','COSHH'].includes(String(c.doc?.doc_type||'').toUpperCase()))return [];
      const ssws=directLinkedDocs57(c.doc.id).filter(d=>String(d.doc_type||'').toUpperCase()==='SSW');
      const relevantDocIds=new Set([c.doc.id,...ssws.map(d=>d.id)]);
      const tbtIds=new Set();
      for(const l of (state.trainingDocumentLinks||[])){
        if(relevantDocIds.has(l.document_id))tbtIds.add(l.training_session_id);
      }
      for(const t of (c.training||[])){
        if(String(trainingKind(t)||'').toUpperCase()==='TOOLBOX_TALK')tbtIds.add(t.id);
      }
      const tbts=(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&String(trainingKind(t)||'').toUpperCase()==='TOOLBOX_TALK'&&tbtIds.has(t.id));
      return [
        ...ssws.map(d=>({kind:'DOCUMENT',id:d.id,doc:d})),
        ...tbts.map(t=>({kind:'TRAINING',id:t.id,training:t}))
      ];
    }

    function latestReview57(sourceVersionId,target){
      return reviews57.find(r=>r.source_version_id===sourceVersionId&&(
        (target.kind==='DOCUMENT'&&r.target_kind==='DOCUMENT'&&r.target_document_id===target.id)||
        (target.kind==='TRAINING'&&r.target_kind==='TRAINING'&&r.target_training_session_id===target.id)
      ))||null;
    }

    function targetLabel57(t){
      if(t.kind==='DOCUMENT')return `${ref57(t.doc)} - ${title57(t.doc)}`;
      return `${trainingReference(t.training)||'TBT'} - ${t.training.name||'Toolbox Talk'}`;
    }

    function targetCurrent57(t){
      if(t.kind==='DOCUMENT'){
        const v=approvedCurrentVersion(t.id);
        return v?`Current v${v.version_label||'—'} · review ${fmt57(v.review_date)}`:'No approved/current version';
      }
      const f=latestTrainingFile(t.id);
      return `${['APPROVED','LEGACY'].includes(String(trainingApprovalStatus(t.training)||'').toUpperCase())?'Approved/current':'Not approved'}${t.training.review_date?' · review '+fmt57(t.training.review_date):''}${f?' · '+f.file_name:''}`;
    }

    function pendingReplacement57(t){
      if(t.kind==='DOCUMENT'){
        try{const p=pendingApprovalVersion(t.id);return p?`Replacement v${p.version_label||'—'} pending approval`:''}catch(_e){return ''}
      }
      const p=(state.training||[]).find(x=>x.replaces_training_session_id===t.id&&x.status!=='ARCHIVED'&&String(x.approval_status||'').toUpperCase()==='PENDING');
      return p?'Replacement Toolbox Talk pending approval':'';
    }

    function reviewStatus57(sourceVersionId,t){
      const r=latestReview57(sourceVersionId,t);
      const pending=pendingReplacement57(t);
      if(pending)return {traffic:'amber',label:pending,row:r};
      if(!r)return {traffic:'amber',label:'Review required',row:null};
      if(r.outcome==='NO_CHANGE')return {traffic:'green',label:`Reviewed · no change · ${fmtDT57(r.reviewed_at)}`,row:r};
      return {traffic:'red',label:'New version required',row:r};
    }

    function enhancePanel57(){
      if(!manager57())return;
      const panel=$57('documentChangeImpactPanelV21040');
      if(!panel)return;
      panel.querySelectorAll('[data-impact-version]').forEach(card=>{
        const versionId=card.dataset.impactVersion,c=candidate57(versionId);
        if(!c||!['RISK_ASSESSMENT','COSHH'].includes(String(c.doc?.doc_type||'').toUpperCase()))return;
        const targets=targets57(c);if(!targets.length)return;
        const actions=card.querySelector('.actions');if(!actions||actions.querySelector('[data-impact57-open]'))return;
        const unresolved=targets.filter(t=>reviewStatus57(versionId,t).traffic!=='green').length;
        const b=document.createElement('button');b.type='button';b.className=unresolved?'primary':'secondary';b.dataset.impact57Open=versionId;
        b.textContent=unresolved?`Review linked SSW / TBT (${unresolved})`:'Linked SSW / TBT reviewed';
        actions.appendChild(b);
      });
    }

    function observe57(){
      if(observer57)return;
      observer57=new MutationObserver(()=>enhancePanel57());
      observer57.observe(document.body,{childList:true,subtree:true});
      [0,400,1200,3000].forEach(ms=>setTimeout(enhancePanel57,ms));
    }

    async function openImpact57(versionId){
      if(!manager57())return toast57('Manager or Admin access required.');
      await loadReviews57();
      const c=candidate57(versionId);if(!c)return toast57('This impact review has refreshed. Reopen Documents and try again.');
      const targets=targets57(c);if(!targets.length)return toast57('No linked SSW or Toolbox Talk was found.');
      const unresolved=targets.filter(t=>reviewStatus57(versionId,t).traffic!=='green');
      const rows=targets.map(t=>{
        const st=reviewStatus57(versionId,t),pending=pendingReplacement57(t);
        const badge=st.traffic==='green'?'complete':st.traffic==='red'?'overdue':'due';
        return `<div class="item-card compact traffic-${st.traffic}">
          <div class="row-between"><div><strong>${esc57(targetLabel57(t))}</strong><div class="meta"><span>${esc57(t.kind==='DOCUMENT'?'SSW':'Toolbox Talk')}</span><span>${esc57(targetCurrent57(t))}</span></div></div><span class="badge ${badge}">${esc57(st.label)}</span></div>
          ${st.row?.review_note?`<div class="muted impact57-note">${esc57(st.row.review_note)}</div>`:''}
          <div class="actions">
            <button type="button" class="ghost" data-impact57-open-target="${t.kind}|${t.id}">Open current</button>
            <button type="button" class="secondary" data-impact57-review="${versionId}|${t.kind}|${t.id}">Review · keep as-is</button>
            <button type="button" class="primary" data-impact57-modify="${versionId}|${t.kind}|${t.id}">${pending?'Open replacement route':'Modify / new version'}</button>
          </div>
        </div>`;
      }).join('');
      openModal('Linked SSW / Toolbox Talk impact',`
        <div class="hint-box"><strong>${esc57(c.doc.reference||'')} · ${esc57(title57(c.doc))} · replacement v${esc57(c.version.version_label||'—')}</strong><br>
        Review the linked working documents here. Keeping an item unchanged is still logged with reviewer and date. No new version is created unless you choose Modify.</div>
        <div class="card-list impact57-list">${rows}</div>
        ${unresolved.length>1?`<div class="section-card"><strong>Minor change shortcut</strong><p class="muted">Use this only if you have checked every unresolved item above and they all remain suitable as written.</p><button type="button" class="secondary" data-impact57-all="${esc57(versionId)}">Review all unresolved · no change</button></div>`:''}
        <div class="actions"><button type="button" class="ghost" data-close-modal>Close</button></div>
      `);
    }

    function parseTarget57(payload){
      const parts=String(payload||'').split('|');
      return {versionId:parts[0],kind:parts[1],id:parts[2]};
    }

    function findTarget57(c,kind,id){return targets57(c).find(t=>t.kind===kind&&t.id===id)||null}

    function showKeep57(payload){
      const x=parseTarget57(payload),c=candidate57(x.versionId),t=c&&findTarget57(c,x.kind,x.id);if(!c||!t)return toast57('Linked item not found.');
      openModal('Review linked item · no change',`
        <p><strong>${esc57(targetLabel57(t))}</strong></p>
        <div class="hint-box">Confirm that you checked the current approved item against <strong>${esc57(c.doc.reference||title57(c.doc))} v${esc57(c.version.version_label||'—')}</strong> and it remains suitable without modification. This creates a permanent review record.</div>
        <label>Optional review note<textarea id="impact57Note" rows="3" placeholder="e.g. Controls unchanged; current SSW remains suitable."></textarea></label>
        <label class="check-row"><input id="impact57Ack" type="checkbox"> I confirm I reviewed the current linked item and no content change is required.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-impact57-save-keep="${esc57(payload)}">Save review</button></div>
      `);
    }

    async function record57(c,t,outcome,note=''){
      const reviewer=clean57(state.profile?.display_name||state.user?.email||'Authenticated reviewer');
      return await sb.rpc('record_linked_impact_review_v21057',{
        p_source_document_id:c.doc.id,
        p_source_version_id:c.version.id,
        p_target_kind:t.kind,
        p_target_id:t.id,
        p_outcome:outcome,
        p_review_note:clean57(note)||null,
        p_reviewer_name:reviewer
      });
    }

    async function saveKeep57(payload){
      if(!$57('impact57Ack')?.checked)return toast57('Tick the review confirmation first.');
      const x=parseTarget57(payload),c=candidate57(x.versionId),t=c&&findTarget57(c,x.kind,x.id);if(!c||!t)return;
      const r=await record57(c,t,'NO_CHANGE',$57('impact57Note')?.value||'');
      if(r.error)return toast57(r.error.message||'Could not save the linked review.');
      await loadReviews57(true);
      try{await loadAll()}catch(_e){}
      openImpact57(x.versionId);
      toast57('Review logged — current linked item remains suitable.');
    }

    function showModify57(payload){
      const x=parseTarget57(payload),c=candidate57(x.versionId),t=c&&findTarget57(c,x.kind,x.id);if(!c||!t)return toast57('Linked item not found.');
      if(t.kind==='DOCUMENT'){
        openModal('Modify linked SSW',`
          <p><strong>${esc57(targetLabel57(t))}</strong></p>
          <div class="hint-box">The current approved SSW stays in use until its replacement is reviewed and approved. The review decision is logged against the RA/COSHH replacement that triggered it.</div>
          <label>What needs changing?<textarea id="impact57ModifyNote" rows="3" placeholder="Briefly record why a new SSW version is required."></textarea></label>
          <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-impact57-confirm-modify="${esc57(payload)}">Continue to replacement version</button></div>
        `);
      }else{
        const pending=(state.training||[]).find(q=>q.replaces_training_session_id===t.id&&q.status!=='ARCHIVED'&&String(q.approval_status||'').toUpperCase()==='PENDING');
        if(pending){closeModal();setTimeout(()=>showTrainingDetails(pending.id),20);return}
        openModal('Create replacement Toolbox Talk',`
          <p><strong>${esc57(targetLabel57(t))}</strong></p>
          <div class="hint-box">Upload the replacement TBT here. The current approved TBT remains live until the replacement is opened and approved. On approval the existing TBT is archived automatically and its audience/assignments transfer to the replacement.</div>
          <label>What needs changing?<textarea id="impact57ModifyNote" rows="3" placeholder="Briefly record why the TBT needs updating."></textarea></label>
          <label>Replacement Toolbox Talk PDF<input id="impact57TbtFile" type="file" accept="application/pdf,.pdf"></label>
          <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-impact57-create-tbt="${esc57(payload)}">Upload replacement TBT</button></div>
        `);
      }
    }

    async function confirmModifyDoc57(payload){
      const note=clean57($57('impact57ModifyNote')?.value);if(note.length<5)return toast57('Add a short note explaining what needs changing.');
      const x=parseTarget57(payload),c=candidate57(x.versionId),t=c&&findTarget57(c,x.kind,x.id);if(!c||!t)return;
      const r=await record57(c,t,'NEW_VERSION_REQUIRED',note);if(r.error)return toast57(r.error.message||'Could not record the linked review.');
      await loadReviews57(true);
      try{await loadAll()}catch(_e){}
      closeModal();
      setTimeout(()=>showNewVersion(t.id),40);
    }

    function audienceSelection57(trainingId){
      const rows=(state.trainingAudiences||[]).filter(x=>x.training_session_id===trainingId);
      let everyone=rows.some(x=>x.target_type==='EVERYONE');
      const departmentIds=rows.filter(x=>x.target_type==='DEPARTMENT'&&x.department_id).map(x=>x.department_id);
      let userIds=rows.filter(x=>x.target_type==='PERSON'&&x.user_id).map(x=>x.user_id);
      let dueDays=Number(rows.find(x=>x.due_days)?.due_days||14);
      if(!everyone&&!departmentIds.length&&!userIds.length){
        userIds=[...new Set((state.trainingAssignments||[]).filter(a=>a.training_session_id===trainingId&&a.active!==false).map(a=>a.user_id).filter(Boolean))];
      }
      return {everyone,departmentIds,userIds,dueDays};
    }

    async function createReplacementTbt57(payload){
      const note=clean57($57('impact57ModifyNote')?.value),file=$57('impact57TbtFile')?.files?.[0];
      if(note.length<5)return toast57('Add a short note explaining what needs changing.');
      if(!file)return toast57('Choose the replacement Toolbox Talk PDF.');
      const x=parseTarget57(payload),c=candidate57(x.versionId),tgt=c&&findTarget57(c,x.kind,x.id),old=tgt?.training;if(!c||!old)return;
      const a=audienceSelection57(old.id);if(!a.everyone&&!a.departmentIds.length&&!a.userIds.length)return toast57('The existing Toolbox Talk has no audience to copy. Add an audience before replacing it.');
      const sessionPayload={
        name:old.name,session_type:'TOOLBOX_TALK',description:old.description||null,delivered_date:null,
        trainer_name:null,trainer_user_id:state.user.id,review_date:plusYear57(today57()),
        renewal_value:old.renewal_value||12,renewal_unit:old.renewal_unit||'MONTHS',status:'ACTIVE',
        created_by:state.user.id,delivery_method:'INSTRUCTOR_LED',default_due_date:daysFromNow(14),
        approval_status:'PENDING',reference:trainingReference(old)||old.reference||null,source_kind:'TOOLBOX_TALK',
        source_document_id:null,source_document_version_id:null,auto_managed:false,review_required:false,review_reason:null,
        schedule_mode:old.schedule_mode||'RECURRING',replaces_training_session_id:old.id
      };
      const ins=await sb.from('training_sessions').insert(sessionPayload).select().single();
      if(ins.error)return toast57(ins.error.message);
      const nt=ins.data,path=`training/${nt.id}/${crypto.randomUUID()}-${safe57(file.name)}`;
      let uploaded=false;
      try{
        const up=await sb.storage.from('safety-files').upload(path,file,{contentType:file.type||'application/pdf'});
        if(up.error)throw up.error;uploaded=true;
        const fr=await sb.from('training_files').insert({training_session_id:nt.id,file_name:file.name,storage_path:path,uploaded_by:state.user.id,content_text_sha256:await hashPdf(file)});
        if(fr.error)throw fr.error;
        for(const l of (state.trainingDocumentLinks||[]).filter(q=>q.training_session_id===old.id)){
          const lr=await sb.from('training_document_links').insert({training_session_id:nt.id,document_id:l.document_id,link_role:l.link_role||'RELATED',created_by:state.user.id});
          if(lr.error)console.warn('Copy TBT link',lr.error);
        }
        const ar=await sb.rpc('set_training_session_audience_v239',{
          p_training_session_id:nt.id,p_everyone:a.everyone,p_department_ids:a.departmentIds,p_user_ids:a.userIds,p_due_days:a.dueDays
        });
        if(ar.error)throw ar.error;
        const rr=await record57(c,tgt,'NEW_VERSION_REQUIRED',note);
        if(rr.error)throw rr.error;
      }catch(e){
        console.warn('Replacement TBT',e);
        try{if(uploaded)await sb.storage.from('safety-files').remove([path])}catch(_e){}
        try{await sb.from('training_sessions').delete().eq('id',nt.id)}catch(_e){}
        return toast57(e?.message||'Could not create the replacement Toolbox Talk.');
      }
      await loadReviews57(true);
      closeModal();
      await refresh('Replacement Toolbox Talk uploaded as Pending approval. The current approved TBT remains in use until the replacement is approved.');
      setTimeout(()=>showTrainingDetails(nt.id),120);
    }

    function showAll57(versionId){
      const c=candidate57(versionId);if(!c)return;
      const targets=targets57(c).filter(t=>reviewStatus57(versionId,t).traffic!=='green');
      if(!targets.length)return toast57('All linked items are already reviewed.');
      openModal('Review all linked items · no change',`
        <div class="hint-box"><strong>${targets.length} linked item${targets.length===1?'':'s'}</strong> will be recorded as reviewed and still suitable against ${esc57(c.doc.reference||title57(c.doc))} v${esc57(c.version.version_label||'—')}.</div>
        <div class="card-list">${targets.map(t=>`<div class="item-card compact"><strong>${esc57(targetLabel57(t))}</strong></div>`).join('')}</div>
        <label>Optional review note<textarea id="impact57AllNote" rows="3" placeholder="e.g. Minor wording update only; linked controls remain unchanged."></textarea></label>
        <label class="check-row"><input id="impact57AllAck" type="checkbox"> I confirm I checked every item listed above and each remains suitable without modification.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-impact57-save-all="${esc57(versionId)}">Save all reviews</button></div>
      `);
    }

    async function saveAll57(versionId){
      if(!$57('impact57AllAck')?.checked)return toast57('Tick the confirmation first.');
      const c=candidate57(versionId);if(!c)return;
      const targets=targets57(c).filter(t=>reviewStatus57(versionId,t).traffic!=='green'),note=$57('impact57AllNote')?.value||'';
      for(const t of targets){
        const r=await record57(c,t,'NO_CHANGE',note);
        if(r.error)return toast57(`${targetLabel57(t)}: ${r.error.message||'review could not be saved'}`);
      }
      await loadReviews57(true);
      try{await loadAll()}catch(_e){}
      openImpact57(versionId);
      toast57(`${targets.length} linked review${targets.length===1?'':'s'} logged — no content changes required.`);
    }

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b)return;
      if(b.dataset.impact57Open){e.preventDefault();e.stopImmediatePropagation();return openImpact57(b.dataset.impact57Open)}
      if(b.dataset.impact57OpenTarget){
        e.preventDefault();e.stopImmediatePropagation();
        const [kind,id]=b.dataset.impact57OpenTarget.split('|');
        if(kind==='DOCUMENT'){const v=approvedCurrentVersion(id);return v?openDocument(v.id):toast57('No approved/current SSW file found.')}
        const f=latestTrainingFile(id);return f?openTrainingFile(f.id):toast57('No current Toolbox Talk file found.');
      }
      if(b.dataset.impact57Review){e.preventDefault();e.stopImmediatePropagation();return showKeep57(b.dataset.impact57Review)}
      if(b.dataset.impact57SaveKeep){e.preventDefault();e.stopImmediatePropagation();return saveKeep57(b.dataset.impact57SaveKeep)}
      if(b.dataset.impact57Modify){e.preventDefault();e.stopImmediatePropagation();return showModify57(b.dataset.impact57Modify)}
      if(b.dataset.impact57ConfirmModify){e.preventDefault();e.stopImmediatePropagation();return confirmModifyDoc57(b.dataset.impact57ConfirmModify)}
      if(b.dataset.impact57CreateTbt){e.preventDefault();e.stopImmediatePropagation();return createReplacementTbt57(b.dataset.impact57CreateTbt)}
      if(b.dataset.impact57All){e.preventDefault();e.stopImmediatePropagation();return showAll57(b.dataset.impact57All)}
      if(b.dataset.impact57SaveAll){e.preventDefault();e.stopImmediatePropagation();return saveAll57(b.dataset.impact57SaveAll)}
    },true);

    if(!document.getElementById('impact57Styles')){
      const s=document.createElement('style');s.id='impact57Styles';s.textContent=`
        .impact57-list{margin-top:12px}.impact57-note{margin:7px 0;white-space:pre-line}
        .impact57-list .actions{flex-wrap:wrap}
        @media(max-width:680px){.impact57-list .actions{display:grid;grid-template-columns:1fr}.impact57-list .actions button{width:100%}}
      `;document.head.appendChild(s);
    }

    loadReviews57().then(()=>{observe57();enhancePanel57()});
    window.SafetyLinkedImpactV21057={BUILD,loadReviews:loadReviews57,targets:targets57,open:openImpact57};
  }

  boot();
})();
