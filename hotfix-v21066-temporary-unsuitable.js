/* Safety Tracker v2.10.66 CLEAN
   Temporarily unsuitable / block use for linked SSW and Toolbox Talk items.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21066_BOOT_REQUESTED)return;
  window.__SAFETY_V21066_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof loadAll==='function' &&
      typeof assignmentStatus==='function' &&
      typeof assignmentTraffic==='function' &&
      typeof trainingDependencyState==='function' &&
      typeof trainingDependencyMessage==='function' &&
      typeof documentTraffic==='function' &&
      typeof trainingCatalogueTraffic==='function' &&
      typeof showDocDetails==='function' &&
      typeof showTrainingDetails==='function' &&
      !!window.SafetyStrictestMethodV21065 &&
      !!window.SafetyLinkedImpactV21057 &&
      !!window.__SAFETY_V21065_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21066_INSTALLED)return;
    window.__SAFETY_V21066_INSTALLED=true;

    const BUILD='2.10.66',TABLE='linked_suitability_blocks_v21066';
    const core={
      loadAll,
      assignmentStatus,
      assignmentTraffic,
      trainingDependencyState,
      trainingDependencyMessage,
      documentTraffic,
      trainingCatalogueTraffic,
      showDocDetails,
      showTrainingDetails,
      signTraining:typeof signTraining==='function'?signTraining:null,
      confirmTrainingSign:typeof confirmTrainingSign==='function'?confirmTrainingSign:null,
      showTrainingException:typeof showTrainingException==='function'?showTrainingException:null,
      confirmTrainingException:typeof confirmTrainingException==='function'?confirmTrainingException:null,
      showSingleAttendance:typeof showSingleAttendance==='function'?showSingleAttendance:null,
      saveSingleAttendance:typeof saveSingleAttendance==='function'?saveSingleAttendance:null,
      showInstructorGroupAttendance:typeof showInstructorGroupAttendance==='function'?showInstructorGroupAttendance:null,
      saveGroupAttendance:typeof saveGroupAttendance==='function'?saveGroupAttendance:null
    };

    state.suitabilityBlocks66=state.suitabilityBlocks66||[];
    state.suitabilityBlockHistory66=state.suitabilityBlockHistory66||[];
    let loading66=null,observer66=null;

    const $66=id=>document.getElementById(id);
    const esc66=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean66=v=>String(v??'').replace(/\s+/g,' ').trim();
    const toast66=m=>{try{return toast(m)}catch(_e){console.log(m)}};
    const fmt66=v=>{try{return fmtDate(v)}catch(_e){return v?new Date(v).toLocaleDateString('en-GB'):'—'}};
    const fmtDT66=v=>{try{return fmtDateTime(v)}catch(_e){return v?new Date(v).toLocaleString('en-GB'):'—'}};
    const manager66=()=>{try{return !!isManager()}catch(_e){return false}};
    const reviewer66=()=>clean66(state.profile?.display_name||state.user?.email||'Authenticated Manager');

    async function loadBlocks66(force=false){
      if(loading66&&!force)return loading66;
      if(!state.user||state.offline||!navigator.onLine)return state.suitabilityBlocks66;
      loading66=(async()=>{
        try{
          const r=await sb.rpc('get_applicable_suitability_blocks_v21066');
          if(!r.error)state.suitabilityBlocks66=r.data||[];
          else console.warn('Suitability blocks',r.error);
          if(manager66()){
            const h=await sb.from(TABLE).select('*').order('blocked_at',{ascending:false}).limit(500);
            if(!h.error)state.suitabilityBlockHistory66=h.data||[];
          }
        }catch(e){console.warn('Suitability blocks',e)}
        finally{loading66=null}
        return state.suitabilityBlocks66;
      })();
      return loading66;
    }

    loadAll=async function(){
      const out=await core.loadAll.apply(this,arguments);
      await loadBlocks66(true);
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    function blockForDoc66(docId){
      return (state.suitabilityBlocks66||[]).find(b=>b.target_kind==='DOCUMENT'&&b.target_document_id===docId)||null;
    }

    function blockForTraining66(t){
      if(!t)return null;
      return (state.suitabilityBlocks66||[]).find(b=>
        (b.target_kind==='TRAINING'&&b.target_training_session_id===t.id) ||
        (b.target_kind==='DOCUMENT'&&t.source_document_id&&b.target_document_id===t.source_document_id)
      )||null;
    }

    function blockForTarget66(sourceVersionId,kind,id){
      return (state.suitabilityBlocks66||[]).find(b=>
        b.source_version_id===sourceVersionId &&
        (
          (kind==='DOCUMENT'&&b.target_kind==='DOCUMENT'&&b.target_document_id===id) ||
          (kind==='TRAINING'&&b.target_kind==='TRAINING'&&b.target_training_session_id===id)
        )
      )||null;
    }

    trainingDependencyState=function(t){
      const base=core.trainingDependencyState.apply(this,arguments);
      const b=blockForTraining66(t);
      if(!b)return base;
      return {
        ...base,
        ready:false,
        blocked_unsuitable:true,
        suitability_block:b,
        reasons:[...(base.reasons||[]),`Temporarily unsuitable for use: ${b.reason}`]
      };
    };
    try{window.trainingDependencyState=trainingDependencyState}catch(_e){}

    trainingDependencyMessage=function(t){
      const b=blockForTraining66(t);
      if(b)return `Temporarily blocked — this controlled item is not suitable for training/use until the block is cleared or a replacement is approved. Reason: ${b.reason}`;
      return core.trainingDependencyMessage.apply(this,arguments);
    };
    try{window.trainingDependencyMessage=trainingDependencyMessage}catch(_e){}

    assignmentStatus=function(a,t){
      const base=core.assignmentStatus.apply(this,arguments);
      const b=blockForTraining66(t);
      if(!b)return base;
      return {
        ...base,
        code:'BLOCKED_UNSUITABLE',
        label:'Temporarily blocked · not suitable for use',
        badge:'overdue',
        ready:false,
        suitability_block:b
      };
    };
    try{window.assignmentStatus=assignmentStatus}catch(_e){}

    assignmentTraffic=function(status,depsReady=true){
      if(status?.code==='BLOCKED_UNSUITABLE')return 'red';
      return core.assignmentTraffic.apply(this,arguments);
    };
    try{window.assignmentTraffic=assignmentTraffic}catch(_e){}

    documentTraffic=function(d){
      if(d&&blockForDoc66(d.id))return 'red';
      return core.documentTraffic.apply(this,arguments);
    };
    try{window.documentTraffic=documentTraffic}catch(_e){}

    trainingCatalogueTraffic=function(t){
      if(t&&blockForTraining66(t))return 'red';
      return core.trainingCatalogueTraffic.apply(this,arguments);
    };
    try{window.trainingCatalogueTraffic=trainingCatalogueTraffic}catch(_e){}

    function blockedAssignment66(id,action){
      const a=(state.trainingAssignments||[]).find(x=>x.id===id);
      const t=(state.training||[]).find(x=>x.id===a?.training_session_id);
      const b=blockForTraining66(t);
      if(!b)return false;
      toast66(`Blocked — ${action} is unavailable because this item is temporarily unsuitable for use. ${b.reason}`);
      return true;
    }

    function wrapAssignment66(fn,action){
      if(!fn)return null;
      return function(id){
        if(blockedAssignment66(id,action))return;
        return fn.apply(this,arguments);
      };
    }

    if(core.signTraining){signTraining=wrapAssignment66(core.signTraining,'sign-off');try{window.signTraining=signTraining}catch(_e){}}
    if(core.confirmTrainingSign){confirmTrainingSign=wrapAssignment66(core.confirmTrainingSign,'completion');try{window.confirmTrainingSign=confirmTrainingSign}catch(_e){}}
    if(core.showTrainingException){showTrainingException=wrapAssignment66(core.showTrainingException,'admin exception');try{window.showTrainingException=showTrainingException}catch(_e){}}
    if(core.confirmTrainingException){confirmTrainingException=wrapAssignment66(core.confirmTrainingException,'admin exception');try{window.confirmTrainingException=confirmTrainingException}catch(_e){}}
    if(core.showSingleAttendance){showSingleAttendance=wrapAssignment66(core.showSingleAttendance,'attendance recording');try{window.showSingleAttendance=showSingleAttendance}catch(_e){}}
    if(core.saveSingleAttendance){saveSingleAttendance=wrapAssignment66(core.saveSingleAttendance,'attendance recording');try{window.saveSingleAttendance=saveSingleAttendance}catch(_e){}}

    function blockedTrainingId66(trainingId,action){
      const t=(state.training||[]).find(x=>x.id===trainingId),b=blockForTraining66(t);
      if(!b)return false;
      toast66(`Blocked — ${action} is unavailable because this item is temporarily unsuitable for use. ${b.reason}`);
      return true;
    }

    if(core.showInstructorGroupAttendance){
      showInstructorGroupAttendance=function(trainingId){
        if(blockedTrainingId66(trainingId,'group attendance'))return;
        return core.showInstructorGroupAttendance.apply(this,arguments);
      };
      try{window.showInstructorGroupAttendance=showInstructorGroupAttendance}catch(_e){}
    }
    if(core.saveGroupAttendance){
      saveGroupAttendance=function(trainingId){
        if(blockedTrainingId66(trainingId,'group attendance'))return;
        return core.saveGroupAttendance.apply(this,arguments);
      };
      try{window.saveGroupAttendance=saveGroupAttendance}catch(_e){}
    }

    function historyForDoc66(id){
      return (state.suitabilityBlockHistory66||[]).filter(b=>b.target_kind==='DOCUMENT'&&b.target_document_id===id);
    }
    function historyForTraining66(id){
      return (state.suitabilityBlockHistory66||[]).filter(b=>b.target_kind==='TRAINING'&&b.target_training_session_id===id);
    }

    function historyHtml66(rows){
      if(!rows.length)return '';
      return `<div class="section-card block66-history"><h4>Temporary suitability block history</h4><div class="card-list">${rows.map(b=>`
        <div class="item-card compact traffic-${b.status==='ACTIVE'?'red':'green'}">
          <div class="row-between"><strong>${b.status==='ACTIVE'?'Temporarily unsuitable':'Block cleared'}</strong><span class="badge ${b.status==='ACTIVE'?'overdue':'complete'}">${esc66(b.status)}</span></div>
          <div class="muted">${esc66(b.reason)}</div>
          <div class="meta"><span>Blocked ${esc66(fmtDT66(b.blocked_at))}</span><span>By ${esc66(b.blocked_by_name_snapshot||'Manager')}</span></div>
          ${b.cleared_at?`<div class="meta"><span>Cleared ${esc66(fmtDT66(b.cleared_at))}</span><span>${esc66(b.cleared_reason||'Cleared')}</span></div>`:''}
        </div>`).join('')}</div></div>`;
    }

    function blockedBanner66(b){
      if(!b)return '';
      return `<div class="danger-note block66-banner"><strong>TEMPORARILY UNSUITABLE — DO NOT USE FOR WORK/TRAINING</strong><br>${esc66(b.reason)}<br><span class="muted">The controlled file remains readable for reference/history. Completion and attendance are blocked until this restriction is cleared or a replacement is approved.</span></div>`;
    }

    showDocDetails=function(id){
      const out=core.showDocDetails.apply(this,arguments);
      setTimeout(()=>{
        const body=$66('modalBody'),b=blockForDoc66(id);
        if(!body)return;
        if(b&&!$66('block66DocBanner')){
          const box=document.createElement('div');box.id='block66DocBanner';box.innerHTML=blockedBanner66(b);
          body.insertAdjacentElement('afterbegin',box);
        }
        if(manager66()&&!$66('block66DocHistory')){
          const rows=historyForDoc66(id);
          if(rows.length){
            const wrap=document.createElement('div');wrap.id='block66DocHistory';wrap.innerHTML=historyHtml66(rows);
            body.appendChild(wrap);
          }
        }
      },0);
      return out;
    };
    try{window.showDocDetails=showDocDetails}catch(_e){}

    showTrainingDetails=function(id){
      const out=core.showTrainingDetails.apply(this,arguments);
      setTimeout(()=>{
        const t=(state.training||[]).find(x=>x.id===id),body=$66('modalBody'),b=blockForTraining66(t);
        if(!body)return;
        if(b&&!$66('block66TrainingBanner')){
          const box=document.createElement('div');box.id='block66TrainingBanner';box.innerHTML=blockedBanner66(b);
          body.insertAdjacentElement('afterbegin',box);
        }
        if(b){
          body.querySelectorAll('[data-retrain61-start],[data-training-exception],[data-single-attendance]').forEach(x=>x.remove());
        }
        if(manager66()&&!$66('block66TrainingHistory')){
          const rows=historyForTraining66(id);
          if(rows.length){
            const wrap=document.createElement('div');wrap.id='block66TrainingHistory';wrap.innerHTML=historyHtml66(rows);
            body.appendChild(wrap);
          }
        }
      },0);
      return out;
    };
    try{window.showTrainingDetails=showTrainingDetails}catch(_e){}

    function impactCandidates66(){
      const m=window.SafetyTrackerV2?.documentChangeImpactV21040;
      try{return Array.isArray(m?.candidates)?m.candidates:(m?.get?.candidates||[])}catch(_e){return []}
    }
    function candidate66(versionId){return impactCandidates66().find(c=>c?.version?.id===versionId)||null}

    function enhanceImpact66(){
      if(!manager66())return;
      document.querySelectorAll('button[data-impact57-modify]').forEach(mod=>{
        const raw=mod.dataset.impact57Modify||'',parts=raw.split('|');
        if(parts.length<3)return;
        const [versionId,kind,id]=parts,card=mod.closest('.item-card');
        if(!card)return;
        const b=blockForTarget66(versionId,kind,id);
        let banner=card.querySelector('.block66-impact-status');
        if(b){
          if(!banner){
            banner=document.createElement('div');
            banner.className='danger-note block66-impact-status';
            const row=card.querySelector('.actions');
            if(row)row.insertAdjacentElement('beforebegin',banner);else card.appendChild(banner);
          }
          banner.innerHTML=`<strong>Temporarily unsuitable / blocked</strong><br>${esc66(b.reason)}`;
        }else if(banner){banner.remove()}

        const actions=card.querySelector('.actions');if(!actions)return;
        const old=actions.querySelector('[data-block66-start],[data-block66-clear]');if(old)old.remove();
        const btn=document.createElement('button');btn.type='button';
        if(b){
          btn.className='secondary';
          btn.dataset.block66Clear=`${b.id}|${versionId}`;
          btn.textContent='Clear temporary block';
        }else{
          btn.className='danger';
          btn.dataset.block66Start=raw;
          btn.textContent='Temporarily block';
        }
        actions.appendChild(btn);
      });
    }

    function parseImpact66(payload){
      const [versionId,kind,id]=String(payload||'').split('|');
      return {versionId,kind,id};
    }

    function targetLabel66(c,x){
      const targets=window.SafetyLinkedImpactV21057?.targets?.(c)||[];
      const t=targets.find(z=>z.kind===x.kind&&z.id===x.id);
      if(t?.kind==='DOCUMENT')return `${t.doc.reference||'SSW'} - ${t.doc.title||'Safe System of Work'}`;
      if(t?.kind==='TRAINING')return `${trainingReference(t.training)||'TBT'} - ${t.training.name||'Toolbox Talk'}`;
      return x.kind==='DOCUMENT'?'Linked SSW':'Linked Toolbox Talk';
    }

    function showBlock66(payload){
      const x=parseImpact66(payload),c=candidate66(x.versionId);if(!c)return toast66('Impact review has refreshed. Reopen it and try again.');
      openModal('Temporarily block linked item',`
        <p><strong>${esc66(targetLabel66(c,x))}</strong></p>
        <div class="danger-note"><strong>Temporary safety block</strong><br>Use this when the current linked SSW/TBT should not be used while its suitability is being resolved. The file remains available for reference, but training completion, attendance and dependent training will be blocked.</div>
        <label>Reason for temporary block<textarea id="block66Reason" rows="4" placeholder="Record the factual reason this current item is temporarily unsuitable."></textarea></label>
        <label class="check-row"><input id="block66Ack" type="checkbox"> I confirm this linked item should be temporarily treated as unsuitable for work/training until the block is cleared or a replacement is approved.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="danger" data-block66-save="${esc66(payload)}">Apply temporary block</button></div>
      `);
    }

    async function saveBlock66(payload){
      if(!$66('block66Ack')?.checked)return toast66('Tick the temporary-block confirmation first.');
      const reason=clean66($66('block66Reason')?.value);if(reason.length<5)return toast66('Add a short factual reason for the temporary block.');
      const x=parseImpact66(payload),c=candidate66(x.versionId);if(!c)return;
      const r=await sb.rpc('set_linked_suitability_block_v21066',{
        p_source_document_id:c.doc.id,
        p_source_version_id:c.version.id,
        p_target_kind:x.kind,
        p_target_id:x.id,
        p_reason:reason,
        p_reviewer_name:reviewer66()
      });
      if(r.error)return toast66(r.error.message||'Could not apply the temporary block.');
      closeModal();
      await loadAll();
      toast66('Temporary block applied. Training/use is blocked until cleared or a replacement is approved.');
      setTimeout(()=>window.SafetyLinkedImpactV21057?.open?.(x.versionId),60);
    }

    function showClear66(payload){
      const [blockId,versionId]=String(payload||'').split('|');
      const b=(state.suitabilityBlocks66||[]).find(x=>x.id===blockId);if(!b)return toast66('This temporary block is no longer active.');
      openModal('Clear temporary block',`
        <div class="hint-box"><strong>Current block reason:</strong><br>${esc66(b.reason)}</div>
        <label>Reason for clearing the block<textarea id="block66ClearReason" rows="4" placeholder="e.g. Reviewed again against the revised assessment; current SSW remains suitable."></textarea></label>
        <label class="check-row"><input id="block66ClearAck" type="checkbox"> I confirm the current item is now suitable to return to use/training.</label>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-block66-confirm-clear="${esc66(blockId)}|${esc66(versionId)}">Clear block</button></div>
      `);
    }

    async function clearBlock66(payload){
      if(!$66('block66ClearAck')?.checked)return toast66('Tick the confirmation first.');
      const [blockId,versionId]=String(payload||'').split('|'),reason=clean66($66('block66ClearReason')?.value);
      if(reason.length<5)return toast66('Add a short reason for clearing the block.');
      const r=await sb.rpc('clear_linked_suitability_block_v21066',{
        p_block_id:blockId,
        p_reason:reason,
        p_reviewer_name:reviewer66()
      });
      if(r.error)return toast66(r.error.message||'Could not clear the temporary block.');
      closeModal();
      await loadAll();
      toast66('Temporary block cleared. The audit record has been retained.');
      if(versionId)setTimeout(()=>window.SafetyLinkedImpactV21057?.open?.(versionId),60);
    }

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('button');if(!b)return;
      if(b.dataset.block66Start){
        e.preventDefault();e.stopImmediatePropagation();
        return showBlock66(b.dataset.block66Start);
      }
      if(b.dataset.block66Save){
        e.preventDefault();e.stopImmediatePropagation();
        return saveBlock66(b.dataset.block66Save);
      }
      if(b.dataset.block66Clear){
        e.preventDefault();e.stopImmediatePropagation();
        return showClear66(b.dataset.block66Clear);
      }
      if(b.dataset.block66ConfirmClear){
        e.preventDefault();e.stopImmediatePropagation();
        return clearBlock66(b.dataset.block66ConfirmClear);
      }
    },true);

    function observe66(){
      if(observer66)return;
      observer66=new MutationObserver(()=>enhanceImpact66());
      observer66.observe(document.body,{childList:true,subtree:true});
      [0,400,1000,2500].forEach(ms=>setTimeout(enhanceImpact66,ms));
    }

    if(!document.getElementById('block66Styles')){
      const s=document.createElement('style');s.id='block66Styles';s.textContent=`
        .block66-banner{margin-bottom:12px}.block66-impact-status{margin:8px 0}
        .block66-history{margin-top:12px}.block66-history .item-card{margin-bottom:8px}
        @media(max-width:680px){.block66-impact-status+.actions{display:grid;grid-template-columns:1fr}.block66-impact-status+.actions button{width:100%}}
      `;document.head.appendChild(s);
    }

    loadBlocks66().then(()=>{
      observe66();
      try{renderMySafety();renderHsTraining();if(typeof renderCompliance==='function'&&manager66())renderCompliance()}catch(_e){}
    });

    window.SafetyTemporaryUnsuitableV21066={
      BUILD,
      load:loadBlocks66,
      blockForTraining:blockForTraining66,
      blockForDocument:blockForDoc66
    };
  }

  boot();
})();
