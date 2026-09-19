/* Safety Tracker v2.10.68 CLEAN
   Final regression hardening for linked update-required training and replacement lineage.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21068_BOOT_REQUESTED)return;
  window.__SAFETY_V21068_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof loadAll==='function' &&
      typeof trainingDependencyState==='function' &&
      typeof trainingDependencyMessage==='function' &&
      typeof assignmentStatus==='function' &&
      typeof assignmentTraffic==='function' &&
      typeof trainingCatalogueTraffic==='function' &&
      typeof showTrainingDetails==='function' &&
      typeof approvedCurrentVersion==='function' &&
      typeof pendingApprovalVersion==='function' &&
      !!window.SafetyChangeControlWorkspaceV21067 &&
      !!window.SafetyTemporaryUnsuitableV21066 &&
      !!window.__SAFETY_V21067_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21068_INSTALLED)return;
    window.__SAFETY_V21068_INSTALLED=true;

    const BUILD='2.10.68';
    const core={
      loadAll,
      trainingDependencyState,
      trainingDependencyMessage,
      assignmentStatus,
      assignmentTraffic,
      trainingCatalogueTraffic,
      showTrainingDetails,
      renderInstructor:typeof renderInstructor==='function'?renderInstructor:null
    };

    state.trainingControlBlocks68=state.trainingControlBlocks68||[];
    state.linkedImpactReviews68=state.linkedImpactReviews68||[];
    let loading68=null,reviewsLoading68=null,observer68=null,decorating68=false;

    const $68=id=>document.getElementById(id);
    const esc68=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const manager68=()=>{try{return !!isManager()}catch(_e){return false}};
    const approval68=t=>String(t?.approval_status||'').toUpperCase();

    async function loadBlocks68(force=false){
      if(loading68&&!force)return loading68;
      if(!state.user||state.offline||!navigator.onLine)return state.trainingControlBlocks68;
      loading68=(async()=>{
        try{
          const r=await sb.rpc('get_training_control_blocks_v21068');
          if(!r.error)state.trainingControlBlocks68=r.data||[];
          else console.warn('Training control blocks',r.error);
        }catch(e){console.warn('Training control blocks',e)}
        finally{loading68=null}
        return state.trainingControlBlocks68;
      })();
      return loading68;
    }

    async function loadReviews68(force=false){
      if(!manager68())return state.linkedImpactReviews68;
      if(reviewsLoading68&&!force)return reviewsLoading68;
      if(!state.user||state.offline||!navigator.onLine)return state.linkedImpactReviews68;
      reviewsLoading68=(async()=>{
        try{
          const r=await sb.from('linked_impact_reviews_v21057').select('*').order('reviewed_at',{ascending:false});
          if(!r.error)state.linkedImpactReviews68=r.data||[];
          else console.warn('Linked impact review display',r.error);
        }catch(e){console.warn('Linked impact review display',e)}
        finally{reviewsLoading68=null}
        return state.linkedImpactReviews68;
      })();
      return reviewsLoading68;
    }

    loadAll=async function(){
      const out=await core.loadAll.apply(this,arguments);
      await Promise.all([loadBlocks68(true),loadReviews68(true)]);
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    function tempBlock68(t){
      try{return window.SafetyTemporaryUnsuitableV21066?.blockForTraining?.(t)||null}
      catch(_e){return null}
    }

    function updateBlock68(t){
      if(!t||tempBlock68(t))return null;
      const row=(state.trainingControlBlocks68||[]).find(x=>x.training_session_id===t.id);
      if(!row)return null;
      const reason=String(row.block_reason||'');
      if(/^Temporarily unsuitable:/i.test(reason))return null;
      return row;
    }

    trainingDependencyState=function(t){
      const base=core.trainingDependencyState.apply(this,arguments);
      const b=updateBlock68(t);
      if(!b)return base;
      return {
        ...base,
        ready:false,
        blocked_update_required:true,
        update_required_reason:b.block_reason,
        reasons:[...(base.reasons||[]),b.block_reason]
      };
    };
    try{window.trainingDependencyState=trainingDependencyState}catch(_e){}

    trainingDependencyMessage=function(t){
      const b=updateBlock68(t);
      if(b)return `Blocked — a linked controlled item requires replacement before training can continue. ${b.block_reason}`;
      return core.trainingDependencyMessage.apply(this,arguments);
    };
    try{window.trainingDependencyMessage=trainingDependencyMessage}catch(_e){}

    assignmentStatus=function(a,t){
      const base=core.assignmentStatus.apply(this,arguments);
      const b=updateBlock68(t);
      if(!b)return base;
      return {
        ...base,
        code:'BLOCKED_UPDATE_REQUIRED',
        label:'Blocked · controlled update required',
        badge:'overdue',
        ready:false,
        update_required_reason:b.block_reason
      };
    };
    try{window.assignmentStatus=assignmentStatus}catch(_e){}

    assignmentTraffic=function(status,depsReady=true){
      if(status?.code==='BLOCKED_UPDATE_REQUIRED')return 'red';
      return core.assignmentTraffic.apply(this,arguments);
    };
    try{window.assignmentTraffic=assignmentTraffic}catch(_e){}

    trainingCatalogueTraffic=function(t){
      if(updateBlock68(t))return 'red';
      return core.trainingCatalogueTraffic.apply(this,arguments);
    };
    try{window.trainingCatalogueTraffic=trainingCatalogueTraffic}catch(_e){}

    showTrainingDetails=function(id){
      const out=core.showTrainingDetails.apply(this,arguments);
      setTimeout(()=>{
        const t=(state.training||[]).find(x=>x.id===id),b=updateBlock68(t),body=$68('modalBody');
        if(!b||!body||$68('updateRequiredBanner68'))return;
        const box=document.createElement('div');
        box.id='updateRequiredBanner68';
        box.className='danger-note';
        box.innerHTML=`<strong>CONTROLLED UPDATE REQUIRED — TRAINING PAUSED</strong><br>${esc68(b.block_reason)}<br><span class="muted">The current file remains readable for reference, but no new completion, attendance, exception or ad-hoc retraining can be recorded until the replacement is approved.</span>`;
        body.insertAdjacentElement('afterbegin',box);
        body.querySelectorAll('[data-retrain61-start],[data-training-exception],[data-single-attendance]').forEach(x=>x.remove());
      },0);
      return out;
    };
    try{window.showTrainingDetails=showTrainingDetails}catch(_e){}

    if(core.renderInstructor){
      renderInstructor=function(){
        const out=core.renderInstructor.apply(this,arguments);
        queueMicrotask(()=>{
          document.querySelectorAll('#instructorList button[data-single-attendance]').forEach(b=>{
            const a=(state.trainingAssignments||[]).find(x=>x.id===b.dataset.singleAttendance);
            const t=(state.training||[]).find(x=>x.id===a?.training_session_id);
            if(!updateBlock68(t))return;
            b.disabled=true;b.classList.remove('primary');b.classList.add('secondary');
            b.textContent='Blocked — update required';
          });
        });
        return out;
      };
      try{window.renderInstructor=renderInstructor}catch(_e){}
    }

    function candidates68(){
      const m=window.SafetyTrackerV2?.documentChangeImpactV21040;
      try{return Array.isArray(m?.candidates)?m.candidates:(m?.get?.candidates||[])}catch(_e){return []}
    }
    function candidate68(versionId){return candidates68().find(c=>c?.version?.id===versionId)||null}

    function allTargets68(c){
      try{return window.SafetyLinkedImpactV21057?.targets?.(c)||[]}catch(_e){return []}
    }

    function canonicalTargets68(c){
      const all=allTargets68(c);
      const ids=new Set(all.filter(t=>t.kind==='TRAINING').map(t=>t.id));
      return all.filter(t=>{
        if(t.kind!=='TRAINING')return true;
        const prior=t.training?.replaces_training_session_id;
        // While both old and pending replacement are live, show/count the old
        // controlled item once. The replacement is its follow-up, not a new impact.
        return !(prior&&ids.has(prior));
      });
    }

    function latestDirectReview68(versionId,target){
      return (state.linkedImpactReviews68||[]).find(r=>
        r.source_version_id===versionId &&
        (
          (target.kind==='DOCUMENT'&&r.target_kind==='DOCUMENT'&&r.target_document_id===target.id) ||
          (target.kind==='TRAINING'&&r.target_kind==='TRAINING'&&r.target_training_session_id===target.id)
        )
      )||null;
    }

    function lineageReview68(versionId,target){
      if(target.kind!=='TRAINING')return null;
      const oldId=target.training?.replaces_training_session_id;
      if(!oldId)return null;
      const r=(state.linkedImpactReviews68||[]).find(x=>
        x.source_version_id===versionId &&
        x.target_kind==='TRAINING' &&
        x.target_training_session_id===oldId &&
        x.outcome==='NEW_VERSION_REQUIRED'
      );
      return r?{...r,_lineage:true}:null;
    }

    function pendingReplacement68(target){
      if(target.kind==='DOCUMENT'){
        try{return pendingApprovalVersion(target.id)||null}catch(_e){return null}
      }
      return (state.training||[]).find(t=>
        t.replaces_training_session_id===target.id &&
        t.status!=='ARCHIVED' &&
        approval68(t)==='PENDING'
      )||null;
    }

    function blockForTarget68(versionId,target){
      return (state.suitabilityBlocks66||[]).find(b=>
        b.source_version_id===versionId &&
        (
          (target.kind==='DOCUMENT'&&b.target_kind==='DOCUMENT'&&b.target_document_id===target.id) ||
          (target.kind==='TRAINING'&&b.target_kind==='TRAINING'&&b.target_training_session_id===target.id)
        )
      )||null;
    }

    function targetState68(versionId,target){
      const b=blockForTarget68(versionId,target);
      if(b)return {key:'blocked',traffic:'red',label:'Temporarily blocked',reason:b.reason};

      let r=latestDirectReview68(versionId,target);
      if(!r)r=lineageReview68(versionId,target);
      if(!r)return {key:'review',traffic:'amber',label:'Review required'};

      if(r.outcome==='NO_CHANGE')
        return {key:'resolved',traffic:'green',label:'Reviewed · remains suitable',review:r};

      if(r.outcome==='NEW_VERSION_REQUIRED'){
        if(target.kind==='DOCUMENT'){
          const current=approvedCurrentVersion(target.id);
          if(r.target_document_version_id&&current?.id&&current.id!==r.target_document_version_id)
            return {key:'resolved',traffic:'green',label:`Replacement v${current.version_label||'—'} approved · resolved`,review:r};
          const pending=pendingReplacement68(target);
          if(pending)return {key:'pending',traffic:'amber',label:`Replacement v${pending.version_label||'—'} pending approval`,review:r};
          return {key:'update',traffic:'red',label:'Replacement required · training paused',review:r};
        }

        if(r._lineage){
          if(['APPROVED','LEGACY'].includes(approval68(target.training)))
            return {key:'resolved',traffic:'green',label:'Replacement TBT approved · resolved',review:r};
          if(approval68(target.training)==='PENDING')
            return {key:'pending',traffic:'amber',label:'Replacement TBT pending approval',review:r};
        }

        const pending=pendingReplacement68(target);
        if(pending)return {key:'pending',traffic:'amber',label:'Replacement TBT pending approval',review:r};
        if(target.training?.status==='ARCHIVED')
          return {key:'resolved',traffic:'green',label:'Replacement approved · resolved',review:r};
        return {key:'update',traffic:'red',label:'Replacement TBT required · training paused',review:r};
      }

      return {key:'review',traffic:'amber',label:'Review required',review:r};
    }

    function hideDuplicateReplacementCards68(c){
      const all=allTargets68(c);
      const ids=new Set(all.filter(t=>t.kind==='TRAINING').map(t=>t.id));
      document.querySelectorAll('#modalBody button[data-impact57-modify]').forEach(btn=>{
        const [versionId,kind,id]=String(btn.dataset.impact57Modify||'').split('|');
        if(versionId!==c.version.id||kind!=='TRAINING')return;
        const t=all.find(x=>x.kind==='TRAINING'&&x.id===id);
        if(t?.training?.replaces_training_session_id&&ids.has(t.training.replaces_training_session_id)){
          const card=btn.closest('.item-card');if(card)card.hidden=true;
        }
      });
    }

    function decorateImpactCards68(c){
      hideDuplicateReplacementCards68(c);
      document.querySelectorAll('#modalBody button[data-impact57-modify]').forEach(btn=>{
        const [versionId,kind,id]=String(btn.dataset.impact57Modify||'').split('|');
        if(versionId!==c.version.id)return;
        const target=allTargets68(c).find(t=>t.kind===kind&&t.id===id);
        const card=btn.closest('.item-card');
        if(!target||!card||card.hidden)return;
        const st=targetState68(versionId,target);

        card.classList.remove('traffic-green','traffic-amber','traffic-red');
        card.classList.add(`traffic-${st.traffic}`);
        const badge=card.querySelector('.row-between > .badge');
        if(badge){
          badge.className=`badge ${st.traffic==='green'?'complete':st.traffic==='red'?'overdue':'due'}`;
          badge.textContent=st.label;
        }

        card.querySelector('.regression68-status')?.remove();
        if(st.key==='resolved'){
          const note=document.createElement('div');note.className='success-note regression68-status';
          note.textContent='Replacement lineage recognised — this linked impact is resolved and does not need reviewing again.';
          card.querySelector('.actions')?.insertAdjacentElement('beforebegin',note);
          card.querySelectorAll('[data-impact57-review],[data-impact57-modify],[data-revision58-impact],[data-revision59-impact],[data-block66-start]').forEach(x=>x.style.display='none');
        }else if(st.key==='update'){
          const note=document.createElement('div');note.className='danger-note regression68-status';
          note.textContent='Training on the current item is paused until its required replacement is approved.';
          card.querySelector('.actions')?.insertAdjacentElement('beforebegin',note);
        }
      });
    }

    function decoratePanelButtons68(){
      if(!manager68())return;
      document.querySelectorAll('#documentChangeImpactPanelV21040 button[data-impact57-open]').forEach(btn=>{
        const versionId=btn.dataset.impact57Open,c=candidate68(versionId);
        if(!c)return;
        const states=canonicalTargets68(c).map(t=>targetState68(versionId,t));
        const open=states.filter(s=>s.key!=='resolved').length;
        const red=states.filter(s=>s.traffic==='red').length;
        btn.className=open?(red?'danger':'primary'):'secondary';
        btn.textContent=open?`Linked SSW / TBT follow-up (${open})`:'Linked SSW / TBT resolved';
      });
    }

    function decorateWorkspace68(c){
      const box=$68('changeControlWorkspace67');if(!box)return;
      const states=canonicalTargets68(c).map(t=>targetState68(c.version.id,t));
      const resolved=states.filter(s=>s.key==='resolved').length;
      const pending=states.filter(s=>s.key==='pending').length;
      const blocked=states.filter(s=>s.key==='blocked').length;
      const update=states.filter(s=>s.key==='update').length;
      const review=states.filter(s=>s.key==='review').length;
      const total=states.length;

      const steps=box.querySelectorAll('.workflow67-step');
      const step3=steps[2],step4=steps[3];
      const sourceApproved=String(c.version.approval_status||'PENDING').toUpperCase()==='APPROVED';
      const hasDecision=!!(state.revisionTrainingImpactManager62||[]).find(r=>r.new_version_id===c.version.id&&r.decision_status!=='VOID');
      const controlled=review===0&&update===0;
      const allResolved=total===0||resolved===total;
      const traffic=blocked||update?'red':review||pending?'amber':'green';

      if(step3){
        step3.classList.remove('traffic-green','traffic-amber','traffic-red');
        step3.classList.add(`traffic-${traffic}`);
        const bits=[];
        if(total)bits.push(`${resolved}/${total} resolved`);
        if(pending)bits.push(`${pending} replacement pending`);
        if(blocked)bits.push(`${blocked} temporarily blocked`);
        if(update)bits.push(`${update} replacement not started`);
        if(review)bits.push(`${review} review required`);
        if(!total)bits.push('No linked SSW/TBT found');
        const copy=step3.querySelector('.workflow67-copy > div');if(copy)copy.textContent=bits.join(' · ');
        const badge=step3.querySelector('.badge');if(badge){
          badge.className=`badge ${traffic==='green'?'complete':traffic==='red'?'overdue':'due'}`;
          badge.textContent=allResolved?'Resolved':blocked?'Blocked':update?'Update required':'Follow-up';
        }
      }

      if(step4){
        const ready=hasDecision&&controlled;
        const s4traffic=sourceApproved&&allResolved?'green':ready?'amber':'red';
        step4.classList.remove('traffic-green','traffic-amber','traffic-red');
        step4.classList.add(`traffic-${s4traffic}`);
        const copy=step4.querySelector('.workflow67-copy > div');
        if(copy)copy.textContent=sourceApproved
          ?(allResolved?'Replacement source is authorised and linked follow-up is complete.':'Replacement source is authorised; controlled linked follow-up remains open.')
          :(ready?'Training impact is decided and any open linked follow-up is controlled; complete the exact-file approval.':'Finish the training-impact/link review actions above before relying on the replacement.');
        const badge=step4.querySelector('.badge');if(badge){
          badge.className=`badge ${s4traffic==='green'?'complete':s4traffic==='red'?'overdue':'due'}`;
          badge.textContent=sourceApproved?(allResolved?'Complete':'Follow-up open'):(ready?'Ready':'Waiting');
        }
      }

      const head=box.querySelector('.workflow67-head > .badge');
      if(head){
        const overallTraffic=sourceApproved&&allResolved?'green':blocked||update?'red':'amber';
        head.className=`badge ${overallTraffic==='green'?'complete':overallTraffic==='red'?'overdue':'due'}`;
        head.textContent=sourceApproved?(allResolved?'Complete':'Approved · follow-up open'):(hasDecision&&controlled?'Ready for approval':'Action required');
      }
    }

    async function decorate68(){
      if(decorating68||!manager68())return;
      const body=$68('modalBody');
      decorating68=true;
      try{
        decoratePanelButtons68();
        if(!body)return;
        const btn=body.querySelector('button[data-impact57-modify]');
        const versionId=String(btn?.dataset.impact57Modify||'').split('|')[0]||'';
        if(!versionId)return;
        const c=candidate68(versionId);if(!c)return;
        await loadReviews68();
        decorateImpactCards68(c);
        decorateWorkspace68(c);
      }finally{decorating68=false}
    }

    function observe68(){
      if(observer68)return;
      observer68=new MutationObserver(()=>{setTimeout(decorate68,0)});
      observer68.observe(document.body,{childList:true,subtree:true});
      [0,300,900,1800].forEach(ms=>setTimeout(decorate68,ms));
    }

    if(!document.getElementById('regression68Styles')){
      const s=document.createElement('style');s.id='regression68Styles';s.textContent=`
        .regression68-status{margin:8px 0}
        #updateRequiredBanner68{margin-bottom:12px}
      `;document.head.appendChild(s);
    }

    Promise.all([loadBlocks68(),loadReviews68()]).then(()=>{
      observe68();
      try{renderMySafety();renderHsTraining();if(core.renderInstructor)renderInstructor();if(typeof renderCompliance==='function'&&manager68())renderCompliance()}catch(_e){}
    });

    window.SafetyRegressionHardeningV21068={
      BUILD,
      loadBlocks:loadBlocks68,
      loadReviews:loadReviews68,
      updateBlockForTraining:updateBlock68,
      targetState:targetState68
    };
  }

  boot();
})();
