/* Safety Tracker v2.10.55 CLEAN
   Linked training packs, per-user prerequisite sequencing, reusable completion evidence,
   TBT instructor-only enforcement, and RA/COSHH residual-risk training guidance.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21055_BOOT_REQUESTED)return;
  window.__SAFETY_V21055_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof assignmentStatus==='function' &&
      typeof effectiveTrainingMethod==='function' &&
      typeof renderHsTraining==='function' &&
      typeof showDocDetails==='function' &&
      typeof openModal==='function' &&
      !!window.SafetyTrackerV2 &&
      typeof window.openDocumentDownloadsV21054==='function'
    );
    if(!ready){setTimeout(boot,80);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21055_INSTALLED)return;
    window.__SAFETY_V21055_INSTALLED=true;

    const BUILD='2.10.55';
    const DECISION_TABLE='training_pack_decisions_v21055';
    const FOUNDATION_TYPES=new Set(['RISK_ASSESSMENT','COSHH']);
    const CHAIN_TYPES=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
    const riskCache=new Map();
    let decisions=[];
    let decisionsLoading=null;
    let tbtNormalised=false;

    const core={
      loadAll,
      renderHsTraining,
      renderInstructor:typeof renderInstructor==='function'?renderInstructor:null,
      renderHelp:typeof renderHelp==='function'?renderHelp:null,
      showDocDetails,
      showEditDocumentDetails:typeof showEditDocumentDetails==='function'?showEditDocumentDetails:null,
      effectiveTrainingMethod,
      assignmentStatus,
      signTraining:typeof signTraining==='function'?signTraining:null,
      confirmTrainingSign:typeof confirmTrainingSign==='function'?confirmTrainingSign:null,
      showTrainingException:typeof showTrainingException==='function'?showTrainingException:null,
      confirmTrainingException:typeof confirmTrainingException==='function'?confirmTrainingException:null,
      showSingleAttendance:typeof showSingleAttendance==='function'?showSingleAttendance:null,
      saveSingleAttendance:typeof saveSingleAttendance==='function'?saveSingleAttendance:null,
      showInstructorGroupAttendance:typeof showInstructorGroupAttendance==='function'?showInstructorGroupAttendance:null,
      saveGroupAttendance:typeof saveGroupAttendance==='function'?saveGroupAttendance:null
    };

    const clean55=v=>String(v??'').replace(/\s+/g,' ').trim();
    const kind55=t=>{try{return String(trainingKind(t)||'').toUpperCase()}catch(_e){return String(t?.source_kind||t?.session_type||'').toUpperCase()}};
    const docType55=d=>String(d?.doc_type||'').toUpperCase();
    const manager55=()=>{try{return !!isManager()}catch(_e){return false}};
    const online55=()=>!state.offline&&navigator.onLine;
    const toast55=msg=>{try{return toast(msg)}catch(_e){const el=document.getElementById('toast');if(el){el.textContent=msg;el.hidden=false;setTimeout(()=>el.hidden=true,3500)}}};
    const docTitle55=d=>{try{return documentDisplayTitle(d)||d?.title||''}catch(_e){return d?.title||''}};
    const ref55=d=>d?.reference||(()=>{try{return docTypeLabel(d?.doc_type)}catch(_e){return d?.doc_type||'Document'}})();
    const esc55=s=>{try{return esc(s)}catch(_e){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}};
    const fmt55=d=>{try{return fmtDate(d)}catch(_e){return d?new Date(d).toLocaleDateString('en-GB'):'—'}};

    async function loadDecisions55(){
      if(decisionsLoading)return decisionsLoading;
      if(!sb||!state.user||!online55())return decisions;
      decisionsLoading=(async()=>{
        try{
          const r=await sb.from(DECISION_TABLE).select('*').order('decided_at',{ascending:false});
          if(!r.error){decisions=r.data||[];state.trainingPackDecisions55=decisions;}
          else console.warn('Training pack decisions',r.error);
        }catch(e){console.warn('Training pack decisions',e)}
        finally{decisionsLoading=null;}
        return decisions;
      })();
      return decisionsLoading;
    }

    function approved55(docId){try{return approvedCurrentVersion(docId)}catch(_e){return null}}
    function activeSourceTraining55(docId){
      const approved=approved55(docId);
      const rows=(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&t.source_document_id===docId);
      rows.sort((a,b)=>{
        const ac=a.source_document_version_id===approved?.id?1:0,bc=b.source_document_version_id===approved?.id?1:0;
        return bc-ac||new Date(b.created_at||0)-new Date(a.created_at||0);
      });
      return rows[0]||null;
    }
    function assignmentFor55(trainingId,userId){return (state.trainingAssignments||[]).find(a=>a.training_session_id===trainingId&&a.user_id===userId&&a.active!==false)||null}
    function userHasRoot55(userId,rootId){const t=activeSourceTraining55(rootId);return !!(t&&assignmentFor55(t.id,userId))}

    function directLinkedDocs55(docId){
      const out=[];
      for(const l of (state.documentLinks||[])){
        let other=null;
        if(l.source_document_id===docId)other=l.target_document_id;
        else if(l.target_document_id===docId)other=l.source_document_id;
        if(!other)continue;
        const d=(state.documents||[]).find(x=>x.id===other);
        if(d&&d.status!=='ARCHIVED')out.push({doc:d,link:l});
      }
      return out;
    }

    function pack55(rootId){
      const root=(state.documents||[]).find(d=>d.id===rootId&&d.status!=='ARCHIVED');
      if(!root||!FOUNDATION_TYPES.has(docType55(root)))return null;
      const docs=[root];
      directLinkedDocs55(root.id).forEach(x=>{if(docType55(x.doc)==='SSW'&&!docs.some(d=>d.id===x.doc.id))docs.push(x.doc)});
      const docIds=new Set(docs.map(d=>d.id));
      const tbtIds=new Set((state.trainingDocumentLinks||[]).filter(l=>docIds.has(l.document_id)).map(l=>l.training_session_id));
      const tbts=(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&kind55(t)==='TOOLBOX_TALK'&&tbtIds.has(t.id));
      return {root,docs,tbts,docIds:[...docIds],trainingIds:tbts.map(t=>t.id)};
    }

    function assignedPacks55(userId){
      const roots=[];
      for(const a of (state.trainingAssignments||[])){
        if(a.user_id!==userId||a.active===false)continue;
        const t=(state.training||[]).find(x=>x.id===a.training_session_id&&x.status!=='ARCHIVED');
        if(!t?.source_document_id||!FOUNDATION_TYPES.has(kind55(t)))continue;
        const p=pack55(t.source_document_id);
        if(p&&(p.docs.length>1||p.tbts.length)&&!roots.some(x=>x.root.id===p.root.id))roots.push(p);
      }
      return roots.sort((a,b)=>String(ref55(a.root)).localeCompare(String(ref55(b.root)),undefined,{numeric:true}));
    }

    const sorted55=a=>[...(a||[])].map(String).sort();
    function sameIds55(a,b){const aa=sorted55(a),bb=sorted55(b);return aa.length===bb.length&&aa.every((x,i)=>x===bb[i])}
    function latestDecision55(rootId){return decisions.find(x=>x.root_document_id===rootId)||null}
    function decisionState55(rootId){
      const p=pack55(rootId),v=approved55(rootId),row=latestDecision55(rootId);
      if(!row)return {row:null,valid:false,stale:false,pack:p,version:v};
      const valid=!!(p&&v&&row.root_document_version_id===v.id&&sameIds55(row.pack_document_ids,p.docIds)&&sameIds55(row.pack_training_ids,p.trainingIds));
      return {row,valid,stale:!valid,pack:p,version:v};
    }

    function packsContainingTraining55(userId,t){
      if(!t)return [];
      const did=t.source_document_id||null;
      return assignedPacks55(userId).filter(p=>{
        if(did&&p.docIds.includes(did))return true;
        if(kind55(t)==='TOOLBOX_TALK'&&p.trainingIds.includes(t.id))return true;
        return false;
      });
    }

    function validDecisionForPack55(p){
      const ds=decisionState55(p.root.id);
      return ds.valid?ds.row:null;
    }

    function packRequiresInstructor55(a,t){
      if(!a||!t)return false;
      if(kind55(t)==='TOOLBOX_TALK')return true;
      for(const p of packsContainingTraining55(a.user_id,t)){
        const d=validDecisionForPack55(p);
        if(d?.selected_method==='INSTRUCTOR_LED')return true;
      }
      return false;
    }

    effectiveTrainingMethod=function(t,a){
      if(kind55(t)==='TOOLBOX_TALK')return 'INSTRUCTOR_LED';
      const base=core.effectiveTrainingMethod(t,a);
      if(a&&packRequiresInstructor55(a,t))return 'INSTRUCTOR_LED';
      return base;
    };
    try{window.effectiveTrainingMethod=effectiveTrainingMethod}catch(_e){}

    function completionInstructor55(a,evidence){
      if(!a||!evidence)return false;
      const completion=latestTrainingCompletion(a);
      if(completion?.exception&&(evidence?.id===completion.exception.id||!!evidence?.completed_at))return true;
      const signedAt=evidence.signed_at||evidence.completed_at;
      if(!signedAt)return false;
      return (trainingEvents(a)||[]).some(c=>(c.attendance_status||'ATTENDED')==='ATTENDED'&&new Date(c.confirmed_at||0)<=new Date(signedAt));
    }

    assignmentStatus=function(a,t){
      const s=core.assignmentStatus(a,t);
      if(!a||!t)return s;
      const method=effectiveTrainingMethod(t,a);
      if(method!=='INSTRUCTOR_LED')return {...s,method};
      if(s.code!=='COMPLETED')return {...s,method};
      const completion=latestTrainingCompletion(a),evidence=completion?.evidence;
      if(completionInstructor55(a,evidence))return {...s,method};
      const c=latestTrainingConfirmation(a),fresh=!!c&&(!evidence||new Date(c.confirmed_at||0)>new Date(evidence.signed_at||evidence.completed_at||0));
      if(fresh)return {...s,code:'READY_TO_SIGN',label:'Ready to sign · instructor-led',badge:'due',ready:true,method};
      const overdue=s.due&&new Date(s.due)<new Date();
      return {...s,code:overdue?'OVERDUE':'AWAITING_INSTRUCTOR',label:overdue?'Overdue · instructor-led required':'Instructor-led training required',badge:overdue?'overdue':'due',ready:false,method};
    };
    try{window.assignmentStatus=assignmentStatus}catch(_e){}

    function explicitRequiredDocs55(t){
      const out=[];
      for(const l of (state.trainingDocumentLinks||[])){
        if(l.training_session_id!==t.id||String(l.link_role||'').toUpperCase()!=='REQUIRED')continue;
        const d=(state.documents||[]).find(x=>x.id===l.document_id&&x.status!=='ARCHIVED');
        if(d&&CHAIN_TYPES.has(docType55(d))&&!out.some(x=>x.id===d.id))out.push(d);
      }
      return out;
    }

    function prerequisiteDocs55(a,t){
      if(!a||!t)return [];
      const k=kind55(t),map=new Map();
      const add=d=>{if(d&&CHAIN_TYPES.has(docType55(d)))map.set(d.id,d)};
      explicitRequiredDocs55(t).forEach(add);
      const packs=packsContainingTraining55(a.user_id,t);
      if(k==='SSW')packs.forEach(p=>add(p.root));
      if(k==='TOOLBOX_TALK')packs.forEach(p=>{add(p.root);p.docs.filter(d=>docType55(d)==='SSW').forEach(add)});
      if(t.source_document_id)map.delete(t.source_document_id);
      const rank=d=>docType55(d)==='RISK_ASSESSMENT'?1:docType55(d)==='COSHH'?2:3;
      return [...map.values()].sort((a1,b1)=>rank(a1)-rank(b1)||String(ref55(a1)).localeCompare(String(ref55(b1)),undefined,{numeric:true}));
    }

    function prerequisiteState55(a,t){
      const docs=prerequisiteDocs55(a,t),items=[];
      for(const d of docs){
        const v=approved55(d.id);
        if(!v){items.push({doc:d,ready:false,label:'document not approved/current'});continue}
        const pt=activeSourceTraining55(d.id);
        if(!pt||pt.source_document_version_id!==v.id){items.push({doc:d,ready:false,label:'current training record not available'});continue}
        const pa=assignmentFor55(pt.id,a.user_id);
        if(!pa){items.push({doc:d,training:pt,ready:false,label:'prerequisite training not assigned'});continue}
        const ps=assignmentStatus(pa,pt);
        if(ps.code!=='COMPLETED'){
          const label=ps.code==='OVERDUE'?'prerequisite refresher overdue':(ps.label||'prerequisite training outstanding');
          items.push({doc:d,training:pt,assignment:pa,status:ps,ready:false,label});continue;
        }
        items.push({doc:d,training:pt,assignment:pa,status:ps,ready:true,label:'completed/current'});
      }
      return {ready:items.every(x=>x.ready),items,blocked:items.filter(x=>!x.ready)};
    }

    function blockedText55(ps){return ps.ready?'':`Complete prerequisite training first: ${ps.blocked.map(x=>`${ref55(x.doc)} (${x.label})`).join('; ')}`}
    function guard55(id,action='complete this training'){
      const a=(state.trainingAssignments||[]).find(x=>x.id===id),t=(state.training||[]).find(x=>x.id===a?.training_session_id);
      if(!a||!t)return {ok:true,a,t,ps:{ready:true,items:[],blocked:[]}};
      const ps=prerequisiteState55(a,t);
      if(ps.ready)return {ok:true,a,t,ps};
      toast55(`Blocked — ${blockedText55(ps)}`);
      return {ok:false,a,t,ps,action};
    }

    function prerequisiteHtml55(ps){
      if(!ps.items.length)return '';
      const rows=ps.items.map(x=>`<div class="tp55-prereq-row ${x.ready?'is-complete':'is-blocked'}"><span class="tp55-dot">${x.ready?'✓':'!'}</span><span><strong>${esc55(ref55(x.doc))}</strong> · ${esc55(docTitle55(x.doc))}<br><span class="muted">${esc55(x.label)}</span></span></div>`).join('');
      return `<div class="tp55-prereq ${ps.ready?'is-ready':'is-blocked'}"><strong>${ps.ready?'Prerequisites complete':'Blocked — prerequisites first'}</strong>${rows}</div>`;
    }

    function itemForDoc55(d,userId){
      const t=activeSourceTraining55(d.id),a=t?assignmentFor55(t.id,userId):null,s=a&&t?assignmentStatus(a,t):null;
      return {type:'DOCUMENT',doc:d,training:t,assignment:a,status:s,method:t&&a?effectiveTrainingMethod(t,a):(d.delivery_method||'SELF_TRAINING')};
    }
    function itemForTbt55(t,userId){const a=assignmentFor55(t.id,userId),s=a?assignmentStatus(a,t):null;return {type:'TBT',training:t,assignment:a,status:s,method:'INSTRUCTOR_LED'}}
    function packItems55(p,userId){return [...p.docs.map(d=>itemForDoc55(d,userId)),...p.tbts.map(t=>itemForTbt55(t,userId))]}
    function itemLabel55(i){return i.type==='DOCUMENT'?`${ref55(i.doc)} - ${docTitle55(i.doc)}`:`${trainingReference(i.training)||'TBT'} - ${i.training.name||'Toolbox Talk'}`}
    function itemTraffic55(i){if(!i.assignment)return 'red';const s=i.status;if(!s)return 'red';if(s.code==='COMPLETED')return 'green';if(s.code==='OVERDUE')return 'red';const ps=prerequisiteState55(i.assignment,i.training);return ps.ready?'amber':'red'}
    function sharedPackCount55(item,userId){
      return assignedPacks55(userId).filter(p=>item.type==='DOCUMENT'?p.docIds.includes(item.doc.id):p.trainingIds.includes(item.training.id)).length;
    }

    function packStatus55(p,userId){
      const items=packItems55(p,userId),complete=items.filter(i=>i.assignment&&i.status?.code==='COMPLETED').length;
      const red=items.some(i=>itemTraffic55(i)==='red'),amber=items.some(i=>itemTraffic55(i)==='amber');
      return {items,complete,total:items.length,traffic:red?'red':amber?'amber':'green'};
    }

    function decisionSummary55(p){
      const ds=decisionState55(p.root.id);
      if(ds.valid)return {text:ds.row.selected_method==='INSTRUCTOR_LED'?'Instructor-led pack':'Self-training pack',traffic:ds.row.selected_method==='INSTRUCTOR_LED'?'amber':'green',row:ds.row};
      if(ds.stale)return {text:'Manager review required · pack/version changed',traffic:'amber',row:ds.row};
      return {text:'Manager method not reviewed yet',traffic:'amber',row:null};
    }

    function renderTrainingPacks55(){
      const view=document.getElementById('hsTrainingView'),tiles=document.getElementById('hsTrainingTiles');
      if(!view||!tiles||!state.user)return;
      let box=document.getElementById('trainingPacksV21055');
      if(!box){box=document.createElement('div');box.id='trainingPacksV21055';box.className='section-card tp55-packs';tiles.insertAdjacentElement('beforebegin',box)}
      const packs=assignedPacks55(state.user.id);
      if(!packs.length){box.hidden=true;return}
      box.hidden=false;
      const cards=packs.map(p=>{
        const st=packStatus55(p,state.user.id),ds=decisionSummary55(p);
        const shared=st.items.filter(i=>sharedPackCount55(i,state.user.id)>1).length;
        return `<div class="item-card traffic-${st.traffic}"><div class="row-between"><div><h4>${esc55(ref55(p.root))} · ${esc55(docTitle55(p.root))}</h4><div class="meta"><span class="badge">Linked training pack</span><span class="badge ${ds.traffic==='green'?'complete':'due'}">${esc55(ds.text)}</span><span>${st.complete}/${st.total} current</span>${shared?`<span>${shared} shared item${shared===1?'':'s'} reused</span>`:''}</div></div><span class="status-chip status-${st.traffic}">${st.traffic==='green'?'Current':st.traffic==='red'?'Blocked / overdue':'Action required'}</span></div><div class="row action-bar"><button type="button" class="secondary" data-tp55-open="${p.root.id}">Open pack</button>${manager55()?`<button type="button" class="ghost" data-tp55-manage="${p.root.id}">Training method</button>`:''}</div></div>`;
      }).join('');
      box.innerHTML=`<div class="row-between"><div><h3>Linked training packs</h3><p class="muted">RA/COSHH-led packs bundle linked SSW and Toolbox Talks. A current completion is reused wherever the same document appears, so it is not signed again unnecessarily.</p></div></div><div class="card-list">${cards}</div>`;
    }

    function decorateHsTraining55(){
      const list=document.getElementById('hsTrainingList');if(!list)return;
      list.querySelectorAll('.training-status-card').forEach(card=>{
        card.querySelector('.tp55-prereq')?.remove();card.classList.remove('tp55-blocked');
        const marker=card.querySelector('[data-open-required-training],[data-sign-training]');
        const id=marker?.dataset.openRequiredTraining||marker?.dataset.signTraining;
        if(!id)return;
        const a=(state.trainingAssignments||[]).find(x=>x.id===id),t=(state.training||[]).find(x=>x.id===a?.training_session_id);
        if(!a||!t||!['SSW','TOOLBOX_TALK'].includes(kind55(t)))return;
        const ps=prerequisiteState55(a,t);if(!ps.items.length)return;
        card.querySelector('.action-bar')?.insertAdjacentHTML('beforebegin',prerequisiteHtml55(ps));
        if(!ps.ready){
          card.classList.add('tp55-blocked');
          const btn=card.querySelector('[data-sign-training]');if(btn){btn.disabled=true;btn.classList.remove('primary');btn.classList.add('secondary');btn.textContent='Blocked — prerequisites first'}
        }
      });
    }

    renderHsTraining=function(){const out=core.renderHsTraining.apply(this,arguments);queueMicrotask(()=>{renderTrainingPacks55();decorateHsTraining55()});return out};
    try{window.renderHsTraining=renderHsTraining}catch(_e){}

    function showPack55(rootId){
      const p=pack55(rootId);if(!p||!state.user)return toast55('This linked training pack is not available.');
      const st=packStatus55(p,state.user.id),ds=decisionSummary55(p);
      const rows=st.items.map(i=>{
        const tr=itemTraffic55(i),status=i.assignment?(i.status?.label||'Outstanding'):'Not assigned',due=i.status?.due?` · Due ${fmt55(i.status.due)}`:'',shared=sharedPackCount55(i,state.user.id)>1;
        const prereq=i.assignment&&['SSW','TOOLBOX_TALK'].includes(kind55(i.training))?prerequisiteState55(i.assignment,i.training):null;
        const action=i.training?`<button type="button" class="ghost" data-view-training="${i.training.id}">${i.status?.code==='COMPLETED'?'Training record':'Open training'}</button>`:'';
        return `<div class="item-card compact traffic-${tr}"><div class="row-between"><div><strong>${esc55(itemLabel55(i))}</strong><div class="meta"><span>${i.type==='TBT'?'Toolbox Talk':esc55(docType55(i.doc)==='RISK_ASSESSMENT'?'Risk Assessment':docType55(i.doc)==='COSHH'?'COSHH RA':'SSW')}</span><span>${i.method==='INSTRUCTOR_LED'?'Instructor-led':'Self-training'}</span><span>${esc55(status)}${esc55(due)}</span></div></div><span class="status-chip status-${tr}">${tr==='green'?'Current':tr==='red'?'Blocked':'Action'}</span></div>${shared&&i.status?.code==='COMPLETED'?'<div class="success-note compact-note">Already completed/current — this evidence is reused in the other linked pack(s).</div>':''}${prereq&&!prereq.ready?prerequisiteHtml55(prereq):''}<div class="row action-bar">${action}</div></div>`;
      }).join('');
      openModal('Linked training pack',`<p><strong>${esc55(ref55(p.root))} · ${esc55(docTitle55(p.root))}</strong></p><div class="meta"><span class="badge ${ds.traffic==='green'?'complete':'due'}">${esc55(ds.text)}</span><span>${st.complete}/${st.total} current</span></div><div class="hint-box"><strong>Order:</strong> complete the relevant RA/COSHH first, then SSW, then Toolbox Talk. Toolbox Talks are always instructor-led. Current evidence is reused across packs while it remains valid.</div><div class="card-list">${rows}</div>`);
    }

    function parseResidual55(text){
      const raw=String(text||'').replace(/×/g,'x');
      const lower=raw.toLowerCase(),scores=[];
      const pair=/\b([1-5])\s*[x*]\s*([1-5])(?:\s*=\s*(\d{1,2}))?/g;
      let m;
      while((m=pair.exec(raw))){
        const context=lower.slice(Math.max(0,m.index-180),Math.min(lower.length,m.index+220));
        if(/residual|post[-\s]?control|after\s+(?:all\s+)?controls?|remaining\s+risk|risk\s+after\s+controls/.test(context)){
          const score=Number(m[3]||Number(m[1])*Number(m[2]));if(score>=1&&score<=25)scores.push(score);
        }
      }
      const numeric=/(?:residual|post[-\s]?control|after\s+(?:all\s+)?controls?|remaining)\s+(?:risk|risk\s+rating|score|rating)[^0-9]{0,30}\b([1-9]|1\d|2[0-5])\b/gi;
      while((m=numeric.exec(raw))){const score=Number(m[1]);if(score>=1&&score<=25)scores.push(score)}
      let wordBand='';
      const word=/(?:residual|post[-\s]?control|after\s+(?:all\s+)?controls?|remaining)\s+(?:risk|risk\s+rating|rating)[^a-z]{0,25}\b(low|medium|moderate|high|very\s+high)\b/i.exec(raw);
      if(word)wordBand=/high/i.test(word[1])?'HIGH':/medium|moderate/i.test(word[1])?'MEDIUM':'LOW';
      const score=scores.length?Math.max(...scores):null;
      const band=score!=null?(score<=4?'LOW':score<=9?'MEDIUM':'HIGH'):(wordBand||'UNKNOWN');
      const recommended=band==='HIGH'?'INSTRUCTOR_LED':band==='LOW'?'SELF_TRAINING':'MANAGER_JUDGEMENT';
      return {score,band,recommended};
    }

    async function riskAnalysis55(rootId){
      const p=pack55(rootId),v=approved55(rootId);
      if(!p||!v)return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'No approved/current RA or COSHH version was available.'};
      if(riskCache.has(v.id))return riskCache.get(v.id);
      const promise=(async()=>{
        if(!online55()||!v.storage_path)return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Risk score could not be read while offline.'};
        try{
          const r=await sb.storage.from('safety-files').download(v.storage_path);if(r.error||!r.data)throw r.error||new Error('File unavailable');
          const text=await pdfTextFromBlob(r.data),x=parseResidual55(text);
          const basis=x.score!=null?`Highest residual/post-control score read from ${p.root.reference||'the assessment'} v${v.version_label||'current'}: ${x.score}/25.`:x.band!=='UNKNOWN'?`Residual risk band read from ${p.root.reference||'the assessment'} v${v.version_label||'current'}: ${x.band}.`:`No reliable residual/post-control score was found in ${p.root.reference||'the assessment'} v${v.version_label||'current'}.`;
          return {...x,basis};
        }catch(e){console.warn('Training pack risk analysis',e);return {score:null,band:'UNKNOWN',recommended:'MANAGER_JUDGEMENT',basis:'Safety Tracker could not reliably read a residual risk score from the current assessment.'}}
      })();
      riskCache.set(v.id,promise);return promise;
    }

    function recommendationLabel55(r){return r.recommended==='INSTRUCTOR_LED'?'Recommend Instructor-led':r.recommended==='SELF_TRAINING'?'Recommend Self-training':'Manager judgement required'}
    function methodText55(v){return v==='INSTRUCTOR_LED'?'Instructor-led':'Self-training'}

    async function showPackManager55(rootId){
      if(!manager55())return toast55('Manager or Admin access required.');
      const p=pack55(rootId),v=approved55(rootId);if(!p||!v)return toast55('An approved/current RA or COSHH assessment is required before setting the pack method.');
      openModal('Training pack method',`<p><strong>${esc55(ref55(p.root))} · ${esc55(docTitle55(p.root))}</strong></p><div class="hint-box">Reading the approved assessment and linked pack…</div>`);
      const risk=await riskAnalysis55(rootId),ds=decisionState55(rootId),valid=ds.valid?ds.row:null;
      const fallback=p.root.delivery_method==='INSTRUCTOR_LED'?'INSTRUCTOR_LED':'SELF_TRAINING';
      const selected=valid?.selected_method||(risk.recommended==='INSTRUCTOR_LED'?'INSTRUCTOR_LED':risk.recommended==='SELF_TRAINING'?'SELF_TRAINING':fallback);
      const list=[...p.docs.map(d=>`<div class="tp55-pack-line"><strong>${esc55(ref55(d))}</strong><span>${esc55(docTitle55(d))}</span><span class="muted">${docType55(d)==='RISK_ASSESSMENT'?'RA':docType55(d)==='COSHH'?'COSHH RA':'SSW'}</span></div>`),...p.tbts.map(t=>`<div class="tp55-pack-line"><strong>${esc55(trainingReference(t)||'TBT')}</strong><span>${esc55(t.name||'Toolbox Talk')}</span><span class="muted">TBT · always instructor-led</span></div>`)].join('');
      const scoreText=risk.score!=null?`${risk.score}/25 · ${risk.band}`:risk.band;
      const stale=ds.stale?'<div class="pending-use-warning"><strong>Review required:</strong> the RA/COSHH version or linked pack has changed since the last training-method decision.</div>':'';
      const current=valid?`<div class="success-note">Current decision: <strong>${methodText55(valid.selected_method)}</strong> · ${fmt55(valid.decided_at)}${valid.override_reason?`<br>Recorded reason: ${esc55(valid.override_reason)}`:''}</div>`:'';
      const tbtNote=p.tbts.length?'<div class="hint-box"><strong>Toolbox Talk rule:</strong> every TBT remains instructor-led. The pack choice below sets the required level for its RA/COSHH/SSW items; TBT attendance is still recorded separately.</div>':'';
      document.getElementById('modalBody').innerHTML=`<p><strong>${esc55(ref55(p.root))} · ${esc55(docTitle55(p.root))}</strong></p>${stale}${current}<div class="tp55-risk traffic-${risk.band==='HIGH'?'red':risk.band==='LOW'?'green':'amber'}"><div><strong>${esc55(recommendationLabel55(risk))}</strong><div class="muted">Residual risk: ${esc55(scoreText)}</div></div><p>${esc55(risk.basis)}</p><p class="muted">Internal decision aid only: the score bands are Safety Tracker guidance, not an HSE scoring rule. The Manager remains responsible for choosing suitable information, instruction, training and supervision.</p></div>${tbtNote}<div class="section-card"><h4>Pack contents</h4>${list}</div><label>Training method for RA/COSHH/SSW in this pack<select id="tp55Method"><option value="SELF_TRAINING" ${selected==='SELF_TRAINING'?'selected':''}>Self-training</option><option value="INSTRUCTOR_LED" ${selected==='INSTRUCTOR_LED'?'selected':''}>Instructor-led</option></select></label><label id="tp55ReasonWrap" class="full" hidden>Reason for using self-training against an Instructor-led recommendation<textarea id="tp55Reason" rows="4" placeholder="Explain why self-training is suitable for this work and workforce.">${esc55(valid?.override_reason||'')}</textarea><span class="muted">This management decision is retained for audit. It is not an incident record.</span></label><div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-tp55-save="${rootId}">Save training method</button></div>`;
      const method=document.getElementById('tp55Method'),wrap=document.getElementById('tp55ReasonWrap');
      const sync=()=>{if(wrap)wrap.hidden=!(risk.recommended==='INSTRUCTOR_LED'&&method?.value==='SELF_TRAINING')};sync();method?.addEventListener('change',sync);
    }

    async function savePackDecision55(rootId){
      if(!manager55()||!online55())return toast55('A live Manager/Admin connection is required.');
      const p=pack55(rootId),v=approved55(rootId);if(!p||!v)return toast55('The pack changed. Close and reopen it.');
      const risk=await riskAnalysis55(rootId),method=document.getElementById('tp55Method')?.value||'SELF_TRAINING',reason=clean55(document.getElementById('tp55Reason')?.value);
      if(risk.recommended==='INSTRUCTOR_LED'&&method==='SELF_TRAINING'&&reason.length<10)return toast55('Enter a clear reason for choosing self-training against the high-risk recommendation.');
      const row={root_document_id:rootId,root_document_version_id:v.id,pack_document_ids:p.docIds,pack_training_ids:p.trainingIds,residual_risk_score:risk.score,risk_band:risk.band,recommended_method:risk.recommended,selected_method:method,recommendation_basis:risk.basis,override_reason:risk.recommended==='INSTRUCTOR_LED'&&method==='SELF_TRAINING'?reason:null,decided_by:state.user.id};
      const r=await sb.from(DECISION_TABLE).insert(row);if(r.error)return toast55(r.error.message||'Could not save the training-method decision.');
      await loadDecisions55();closeModal();await refresh(`Training pack set to ${methodText55(method)}. Toolbox Talks remain instructor-led.`);
    }

    function enhanceDocDetails55(id){
      if(!manager55())return;
      const p=pack55(id);if(!p||(p.docs.length<2&&!p.tbts.length))return;
      const body=document.getElementById('modalBody'),bar=body?.querySelector('.action-bar');if(!bar||bar.querySelector('[data-tp55-manage]'))return;
      const b=document.createElement('button');b.type='button';b.className='primary';b.dataset.tp55Manage=id;b.textContent='Training pack & method';bar.prepend(b);
    }
    showDocDetails=function(id){const out=core.showDocDetails.apply(this,arguments);setTimeout(()=>enhanceDocDetails55(id),0);return out};
    try{window.showDocDetails=showDocDetails}catch(_e){}

    if(core.showEditDocumentDetails){
      showEditDocumentDetails=function(id){
        const out=core.showEditDocumentDetails.apply(this,arguments);
        setTimeout(()=>{
          const d=(state.documents||[]).find(x=>x.id===id),body=document.getElementById('modalBody');if(!d||!body)return;
          if(FOUNDATION_TYPES.has(docType55(d))){const p=pack55(id);if(p&&(p.docs.length>1||p.tbts.length)){const note=document.createElement('div');note.className='hint-box tp55-edit-note';note.innerHTML='<strong>Linked training pack:</strong> use <em>Training pack & method</em> from Document details to record the risk-based pack decision. This document method remains the fallback where no current pack decision applies.';body.prepend(note)}}
          if(docType55(d)==='SSW'){const note=document.createElement('div');note.className='hint-box tp55-edit-note';note.innerHTML='<strong>Shared SSW:</strong> this master method is a fallback. Where the SSW is used in more than one linked RA/COSHH pack, the strictest current pack requirement for that employee applies.';body.prepend(note)}
        },0);
        return out;
      };
      try{window.showEditDocumentDetails=showEditDocumentDetails}catch(_e){}
    }

    async function normaliseTbt55(){
      if(tbtNormalised||!manager55()||!online55())return;tbtNormalised=true;
      try{
        const bad=(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&kind55(t)==='TOOLBOX_TALK'&&t.delivery_method!=='INSTRUCTOR_LED');
        for(const t of bad){await sb.from('training_sessions').update({delivery_method:'INSTRUCTOR_LED'}).eq('id',t.id);t.delivery_method='INSTRUCTOR_LED'}
        const ids=new Set((state.training||[]).filter(t=>t.status!=='ARCHIVED'&&kind55(t)==='TOOLBOX_TALK').map(t=>t.id));
        const overrides=(state.trainingAssignments||[]).filter(a=>a.active!==false&&ids.has(a.training_session_id)&&a.delivery_method_override==='SELF_TRAINING');
        for(const a of overrides){await sb.from('training_assignments').update({delivery_method_override:'INSTRUCTOR_LED',delivery_method_changed_at:new Date().toISOString(),delivery_method_changed_by:state.user.id,delivery_method_reason:'Toolbox Talks are instructor-led by company standard.'}).eq('id',a.id);a.delivery_method_override='INSTRUCTOR_LED'}
      }catch(e){console.warn('TBT instructor normalisation',e)}
    }

    loadAll=async function(){const out=await core.loadAll.apply(this,arguments);await loadDecisions55();setTimeout(()=>normaliseTbt55(),0);return out};
    try{window.loadAll=loadAll}catch(_e){}

    function wrapGuard(name,fn){if(!fn)return null;return function(id){const g=guard55(id,name);if(!g.ok)return;return fn.apply(this,arguments)}}
    if(core.signTraining){signTraining=wrapGuard('sign off',core.signTraining);try{window.signTraining=signTraining}catch(_e){}}
    if(core.confirmTrainingSign){confirmTrainingSign=wrapGuard('complete',core.confirmTrainingSign);try{window.confirmTrainingSign=confirmTrainingSign}catch(_e){}}
    if(core.showTrainingException){showTrainingException=wrapGuard('use an admin exception',core.showTrainingException);try{window.showTrainingException=showTrainingException}catch(_e){}}
    if(core.confirmTrainingException){confirmTrainingException=wrapGuard('complete by admin exception',core.confirmTrainingException);try{window.confirmTrainingException=confirmTrainingException}catch(_e){}}
    if(core.showSingleAttendance){showSingleAttendance=wrapGuard('record attendance',core.showSingleAttendance);try{window.showSingleAttendance=showSingleAttendance}catch(_e){}}
    if(core.saveSingleAttendance){saveSingleAttendance=wrapGuard('record attendance',core.saveSingleAttendance);try{window.saveSingleAttendance=saveSingleAttendance}catch(_e){}}

    if(core.showInstructorGroupAttendance){
      showInstructorGroupAttendance=function(trainingId){
        const out=core.showInstructorGroupAttendance.apply(this,arguments);
        setTimeout(()=>document.querySelectorAll('.group-attendee').forEach(cb=>{const a=(state.trainingAssignments||[]).find(x=>x.id===cb.value),t=(state.training||[]).find(x=>x.id===a?.training_session_id);if(!a||!t)return;const ps=prerequisiteState55(a,t);if(!ps.ready){cb.checked=false;cb.disabled=true;const line=cb.closest('.check-row');const muted=line?.querySelector('.muted');if(muted)muted.textContent=`Blocked · ${ps.blocked.map(x=>ref55(x.doc)).join(', ')} first`;line?.classList.add('tp55-disabled')}}),0);
        return out;
      };
      try{window.showInstructorGroupAttendance=showInstructorGroupAttendance}catch(_e){}
    }
    if(core.saveGroupAttendance){
      saveGroupAttendance=async function(trainingId){
        const ids=[...document.querySelectorAll('.group-attendee:checked')].map(x=>x.value),blocked=[];
        for(const id of ids){const g=guard55(id,'record attendance');if(!g.ok)blocked.push(g)}
        if(blocked.length)return toast55(`Attendance not saved. ${blocked.length} selected person${blocked.length===1?' has':'s have'} incomplete prerequisite training.`);
        return core.saveGroupAttendance.apply(this,arguments);
      };
      try{window.saveGroupAttendance=saveGroupAttendance}catch(_e){}
    }

    if(core.renderInstructor){
      renderInstructor=function(){const out=core.renderInstructor.apply(this,arguments);setTimeout(()=>{document.querySelectorAll('#instructorList [data-single-attendance]').forEach(btn=>{const id=btn.dataset.singleAttendance,a=(state.trainingAssignments||[]).find(x=>x.id===id),t=(state.training||[]).find(x=>x.id===a?.training_session_id);if(!a||!t)return;const ps=prerequisiteState55(a,t);if(!ps.ready){btn.classList.remove('primary');btn.classList.add('secondary');btn.textContent='Blocked · prerequisites';btn.closest('.item-card')?.classList.add('tp55-blocked')}})},0);return out};
      try{window.renderInstructor=renderInstructor}catch(_e){}
    }

    if(core.renderHelp){
      renderHelp=function(){
        const out=core.renderHelp.apply(this,arguments);setTimeout(()=>{
          const box=document.getElementById('helpContent');if(!box||document.getElementById('tp55Help'))return;
          const card=document.createElement('div');card.id='tp55Help';card.className='section-card';card.innerHTML='<h3>Linked training packs</h3><p>Linked RA/COSHH assessments can form training packs with their SSW and Toolbox Talks. Complete RA/COSHH first, then SSW, then TBT. Toolbox Talks are always instructor-led. Current document/version evidence is reused across packs while it remains valid.</p><p><strong>Manager method guide:</strong> Safety Tracker reads the residual/post-control RA or COSHH score where it can. Low risk recommends self-training, high risk recommends instructor-led, and medium/unclear cases require Manager judgement. A high-risk decision to use self-training requires a recorded reason.</p>';
          box.appendChild(card);
        },0);return out;
      };
      try{window.renderHelp=renderHelp}catch(_e){}
    }

    document.addEventListener('click',e=>{
      const el=e.target.closest('button');if(!el)return;
      if(el.dataset.tp55Open){e.preventDefault();e.stopImmediatePropagation();return showPack55(el.dataset.tp55Open)}
      if(el.dataset.tp55Manage){e.preventDefault();e.stopImmediatePropagation();return showPackManager55(el.dataset.tp55Manage)}
      if(el.dataset.tp55Save){e.preventDefault();e.stopImmediatePropagation();return savePackDecision55(el.dataset.tp55Save)}
    },true);

    if(!document.getElementById('tp55Styles')){
      const s=document.createElement('style');s.id='tp55Styles';s.textContent=`
        .tp55-packs{margin-bottom:16px}.tp55-prereq{margin:10px 0;padding:10px 12px;border:1px solid #d7e0e7;border-radius:12px;background:#f8fafc}.tp55-prereq.is-blocked{border-color:#e59a92;background:#fff6f5;color:#7a241d}.tp55-prereq-row{display:flex;gap:9px;align-items:flex-start;margin-top:7px;color:#334155}.tp55-prereq-row.is-blocked{color:#9b231b}.tp55-dot{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:50%;font-weight:800;background:#e8f7ee;color:#17643b}.tp55-prereq-row.is-blocked .tp55-dot{background:#fdebea;color:#9b231b}.tp55-blocked{border-color:#e48a84!important}.tp55-risk{padding:12px;border:1px solid #d7e0e7;border-radius:12px;margin:12px 0}.tp55-risk.traffic-red{border-color:#e48a84;background:#fff5f4}.tp55-risk.traffic-green{border-color:#7bc49a;background:#f4fbf6}.tp55-risk.traffic-amber{border-color:#e6bd68;background:#fffaf0}.tp55-pack-line{display:grid;grid-template-columns:minmax(80px,120px) 1fr auto;gap:10px;align-items:start;padding:9px 0;border-bottom:1px solid #edf1f4}.tp55-pack-line:last-child{border-bottom:0}.tp55-disabled{opacity:.7}.tp55-edit-note{margin-bottom:12px}@media(max-width:640px){.tp55-pack-line{grid-template-columns:1fr}.tp55-prereq{padding:12px}}
      `;document.head.appendChild(s);
    }

    window.SafetyTrainingPacksV21055={BUILD,pack55,assignedPacks55,prerequisiteState55,riskAnalysis55,loadDecisions55,showPack55,showPackManager55};
    setTimeout(async()=>{await loadDecisions55();try{renderHsTraining()}catch(_e){};normaliseTbt55()},250);
  }

  boot();
})();
