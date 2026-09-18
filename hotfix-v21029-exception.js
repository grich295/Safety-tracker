/* Safety Tracker v2.10.29 administrator training-exception hotfix */
'use strict';

showTrainingException=function(id){
  if(!isAdmin())return toast('Admin access is required for a training exception.');
  const a=state.trainingAssignments.find(x=>x.id===id),t=state.training.find(x=>x.id===a?.training_session_id);if(!a||!t)return;
  const deps=trainingDependencyState(t);if(!deps.ready)return toast(trainingDependencyMessage(t));
  if(a.user_id!==state.user?.id)return toast('A training exception can only be completed for your own assignment.');
  const status=assignmentStatus(a,t);if(status.code==='COMPLETED')return toast('This training assignment is already complete.');if(status.method!=='INSTRUCTOR_LED')return toast('The exception is only available for instructor-led training.');if(status.ready)return toast('Instructor attendance has already been confirmed. Use Sign attendance instead.');
  if(!requiredTrainingMaterialOpened(a,t))return toast(`Open the required current training file before using the exception: ${requiredTrainingMaterialLabel(a,t)}`);
  const mats=requiredTrainingMaterials(a,t),opened=mats.filter(m=>trainingMaterialOpenedSince(m,a)).length;
  openModal('Complete training as admin exception',`<p><strong>${esc(t.name)}</strong></p><div class="success-note">✓ Required training material opened and recorded (${opened}/${mats.length||1}).</div><div class="hint-box"><strong>Administrator exception.</strong> Use this only for your own instructor-led assignment when an independent instructor confirmation is not available. The reason, your authenticated identity and date/time are retained as separate compliance evidence. This does not create an instructor attendance record.</div><label>Reason for exception<textarea id="trainingExceptionReason" rows="4" minlength="10" placeholder="Enter at least 10 characters explaining why instructor confirmation is unavailable."></textarea><span id="trainingExceptionValidation" class="muted">Minimum 10 characters.</span></label><div class="hint-box"><strong>Authenticated acknowledgement.</strong> Your signed-in account, date and time are recorded automatically. No drawn signature is required.</div><label class="check-row"><input id="trainingExceptionAck" type="checkbox"> I confirm this is my own training assignment and the exception reason is accurate.</label><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Complete as exception','danger',`id="trainingExceptionSubmit" data-confirm-training-exception="${id}"`)}</div>`);
  const reasonBox=$('trainingExceptionReason'),validation=$('trainingExceptionValidation');reasonBox?.addEventListener('input',()=>{const n=clean(reasonBox.value).length;if(validation)validation.textContent=n>=10?`✓ Reason entered (${n} characters)`:`Minimum 10 characters (${n}/10).`});
};

confirmTrainingException=async function(id){
  if(!isAdmin())return toast('Admin access is required for a training exception.');
  const a=state.trainingAssignments.find(x=>x.id===id),t=state.training.find(x=>x.id===a?.training_session_id);if(!a||!t||a.user_id!==state.user?.id)return toast('This exception can only be used for your own assignment.');
  const deps=trainingDependencyState(t);if(!deps.ready)return toast(trainingDependencyMessage(t));
  const status=assignmentStatus(a,t);if(status.code==='COMPLETED')return toast('This training assignment is already complete.');if(status.method!=='INSTRUCTOR_LED'||status.ready)return toast('This assignment is not eligible for an administrator exception.');
  if(!requiredTrainingMaterialOpened(a,t))return toast(`Open the required current training file before using the exception: ${requiredTrainingMaterialLabel(a,t)}`);
  const reason=clean($('trainingExceptionReason')?.value),sigName=clean(state.profile?.display_name||state.user?.email||'Authenticated user');
  if(reason.length<10){const v=$('trainingExceptionValidation');if(v)v.textContent=`Reason is too short (${reason.length}/10). Enter at least 10 characters.`;return toast('Exception reason must be at least 10 characters.');}
  if(!$('trainingExceptionAck')?.checked)return toast('Tick the exception confirmation first.');
  const statement='Administrator training exception: I confirm this is my own instructor-led training assignment. I have reviewed/completed the required training content and controls. An independent instructor confirmation is not available for the recorded reason, so I am using the administrator exception.';
  const submit=$('trainingExceptionSubmit');if(submit){submit.disabled=true;submit.textContent='Saving…'}
  const r=await sb.from('training_exceptions').insert({training_assignment_id:id,training_session_id:t.id,user_id:state.user.id,reason,statement_snapshot:statement,signature_data:'ACK:'+state.user.id+':'+new Date().toISOString(),signature_name:sigName});
  if(r.error){if(submit){submit.disabled=false;submit.textContent='Complete as exception'}const raw=String(r.error.message||'');if(raw.includes('Open the required current training file'))return toast(`Open all required training material before completing: ${requiredTrainingMaterialLabel(a,t)}`);if(raw.includes('controlled source')||raw.includes('approved/current'))return toast(trainingDependencyMessage(t)||raw);return toast(raw.includes('training_exceptions')?'Training exception could not be saved. Refresh once and try again; if it remains, check the database migration.':raw)}
  if(t.source_document_id){const v=state.versions.find(x=>x.id===t.source_document_version_id)||currentVersion(t.source_document_id);if(v)await logDocumentActivity('TRAINING_COMPLETED',{...activityVersionSnapshot(v),training_session_id:t.id,source_context:'TRAINING',metadata:{completion_mode:'ADMIN_EXCEPTION'}},null,false)}else{const f=latestTrainingFile(t.id);if(f)await logDocumentActivity('TRAINING_COMPLETED',{...activityTrainingFileSnapshot(f),source_context:'TRAINING'},null,false)}
  closeModal();await refresh('Training completed using the administrator exception.');
};

if(typeof renderHelp==='function'){
  const renderHelpV21029=renderHelp;
  renderHelp=function(){const r=renderHelpV21029.apply(this,arguments);const h=$('helpContent');if(h)h.innerHTML=h.innerHTML.replaceAll('v2.10.28 CLEAN','v2.10.29 CLEAN');return r;};
}
window.__SAFETY_HOTFIX='v2.10.29-live';

/* Safety Tracker v2.10.36 - automatic flexible monthly knowledge checks */
(function(){
  const core=window.SafetyTrackerV2;
  if(!core||!core.sb||!core.state)return;

  const KVER='2.10.37';
  const ksb=core.sb, ks=core.state;
  const k$=id=>document.getElementById(id);
  const kesc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const kclean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const ktoast=msg=>{try{return (window.toast||core.toast)?.(msg)}catch(_e){console.log(msg)}};
  const kIsAdmin=()=>ks.profile?.report_only!==true&&String(ks.profile?.role||'').toLowerCase()==='admin';
  const kIsManager=()=>ks.profile?.report_only!==true&&['admin','manager'].includes(String(ks.profile?.role||'').toLowerCase());
  const kDelay=ms=>new Promise(r=>setTimeout(r,ms));
  const kPdfCache=new Map();
  let kQuiz=null,kBuildBusy=false,kAutoTimer=null,kLastAutoScan=0,kMyLoading=false,kAdminLoading=false,kTeamLoading=false;

  function kApplyVersion(){
    if(window.SAFETY_BUILD){
      window.SAFETY_BUILD.version=KVER;
      window.SAFETY_BUILD.label=KVER+' CLEAN';
      window.SAFETY_BUILD.build='21037';
      try{window.applySafetyBuildLabel?.()}catch(_e){}
    }
    document.querySelectorAll('.build-badge').forEach(el=>el.textContent='Safety Tracker v'+KVER+' CLEAN');
    document.querySelectorAll('.dashboard-version').forEach(el=>el.textContent='v'+KVER+' CLEAN');
    document.querySelectorAll('.brand-line .version,.demo-brand-line .version').forEach(el=>el.textContent='v'+KVER);
  }
  [0,350,1000,2500].forEach(ms=>setTimeout(kApplyVersion,ms));
  document.addEventListener('DOMContentLoaded',kApplyVersion,{once:true});

  function kLatestTrainingFile(id){
    return (ks.trainingFiles||[]).filter(x=>x.training_session_id===id)
      .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;
  }

  function kSourceFor(t){
    if(t?.source_document_version_id){
      const v=(ks.versions||[]).find(x=>x.id===t.source_document_version_id);
      if(v?.storage_path)return {key:'DV:'+v.id,path:v.storage_path,label:v.file_name||v.version_label||t.name};
    }
    const f=kLatestTrainingFile(t?.id);
    if(f?.storage_path)return {key:'TF:'+f.id,path:f.storage_path,label:f.file_name||t.name};
    return null;
  }

  function kSentenceScore(s){
    const x=s.toLowerCase();let n=0;
    ['must ','must not','do not','never ','required','stop work','immediately','before ','after ','ensure ','wear ','isolate','report ','emergency','first aid','fire','ppe','rpe','hazard','risk','exposure','ventilation','storage','dispose','spill','manual handling','work at height','asbestos','electrical','gas','hot work','eye protection','gloves','respirator'].forEach(k=>{if(x.includes(k))n+=2});
    if(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|ml|l|kg|g|°c|c|minutes?|mins?|hours?|days?|months?|years?|%)\b/i.test(s))n+=3;
    if(/\b(if|when|before|after|where|unless|except|only when|provided that)\b/i.test(s))n+=1;
    return n;
  }

  function kDifficulty(s){
    const numeric=/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|ml|l|kg|g|°c|c|minutes?|mins?|hours?|days?|months?|years?|%)\b/i.test(s);
    const hardRule=/\b(unless|except|only when|provided that|at least|not more than|maximum|minimum|within|no later than)\b/i.test(s);
    const conds=(s.match(/\b(if|when|before|after|where|unless|except)\b/gi)||[]).length;
    if(numeric||hardRule||conds>=2||s.length>175)return 'HARD';
    if(s.length<=115&&/\b(must|must not|do not|never|wear|ensure|stop work|report|isolate|required)\b/i.test(s))return 'EASY';
    return 'STANDARD';
  }

  function kCandidates(text){
    const raw=String(text||'').replace(/\r/g,'\n').replace(/[\t ]+/g,' ').replace(/\n{2,}/g,'\n');
    const pieces=raw.split(/(?<=[.!?])\s+|\n+/).map(kclean).filter(Boolean);
    const seen=new Set(),rows=[];
    pieces.forEach((s,idx)=>{
      if(s.length<38||s.length>280||!/\b[a-z]{4,}\b/i.test(s))return;
      if(/^page\s+\d+/i.test(s)||/^version\b/i.test(s)||/^reference\b/i.test(s)||/^copyright\b/i.test(s))return;
      const letters=(s.match(/[A-Za-z]/g)||[]).length,caps=(s.match(/[A-Z]/g)||[]).length;
      if(letters>15&&caps/letters>.86&&s.length<120)return;
      const key=s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      if(!key||seen.has(key))return;seen.add(key);
      rows.push({s,idx,score:kSentenceScore(s),difficulty:kDifficulty(s)});
    });
    if(!rows.length)return [];
    const useful=rows.filter(r=>r.score>=2),pool=useful.length>=8?useful:rows;
    const max=Math.max(1,...pool.map(r=>r.idx));
    const buckets=Array.from({length:8},()=>[]);
    pool.forEach(r=>buckets[Math.min(7,Math.floor((r.idx/max)*8))].push(r));
    buckets.forEach(b=>b.sort((a,z)=>z.score-a.score||a.idx-z.idx));
    const out=[];let round=0;
    while(out.length<36&&round<8){
      let added=false;
      for(const b of buckets){if(b[round]){out.push(b[round]);added=true;if(out.length>=36)break}}
      if(!added)break;round++;
    }
    return out;
  }

  function kMutateNumber(s,factor){
    return s.replace(/\b(\d+(?:\.\d+)?)\s*(mm|cm|m|ml|l|kg|g|°c|c|minutes?|mins?|hours?|days?|months?|years?|%)\b/i,(m,n,u)=>{
      const x=Number(n);if(!Number.isFinite(x))return m;
      let y=factor>1?(x<2?x+1:x*2):(x<=2?x+2:Math.max(.5,x/2));
      y=Math.round(y*100)/100;return y+' '+u;
    });
  }

  function kMutate(s,variant){
    if(/\b\d+(?:\.\d+)?\s*(?:mm|cm|m|ml|l|kg|g|°c|c|minutes?|mins?|hours?|days?|months?|years?|%)\b/i.test(s)){
      const n=kMutateNumber(s,variant===1?2:.5);if(n!==s)return n;
    }
    const swaps=variant===1?[
      [/\bmust not\b/i,'may'],[/\bmust\b/i,'may'],[/\bdo not\b/i,'do'],[/\bnever\b/i,'always'],
      [/\bbefore\b/i,'after'],[/\bminimum\b/i,'maximum'],[/\brequired\b/i,'optional'],[/\bstop work\b/i,'continue work']
    ]:[
      [/\bmust not\b/i,'must'],[/\bmust\b/i,'must not'],[/\bdo not\b/i,'always'],[/\balways\b/i,'never'],
      [/\bafter\b/i,'before'],[/\bmaximum\b/i,'minimum'],[/\bensure\b/i,'avoid'],[/\bwear\b/i,'remove']
    ];
    for(const [re,repl] of swaps){if(re.test(s)){const x=s.replace(re,repl);if(x!==s)return x}}
    return variant===1?'This requirement is optional and can be ignored when convenient.':'No action is needed until after the task is complete.';
  }

  const kPerms=[[0,1,2],[1,0,2],[2,1,0],[0,2,1],[1,2,0],[2,0,1]];
  function kQuestionPrompt(diff){
    if(diff==='EASY')return 'Which basic safety instruction is stated in the current safety file?';
    if(diff==='HARD')return 'Which exact condition, limit or detailed instruction is stated in the current safety file?';
    return 'Which control is correctly stated in the current safety file?';
  }

  function kGenerateQuestions(text){
    return kCandidates(text).map((row,idx)=>{
      const correct=row.s,diff=row.difficulty;
      let w1=kMutate(correct,1),w2=kMutate(correct,2);
      if(kclean(w1).toLowerCase()===kclean(correct).toLowerCase())w1='This requirement is optional.';
      if(kclean(w2).toLowerCase()===kclean(correct).toLowerCase()||kclean(w2).toLowerCase()===kclean(w1).toLowerCase())w2='The opposite action should be taken.';
      const p=kPerms[(idx+correct.length)%kPerms.length],opts=[correct,w1,w2],mixed=p.map(i=>opts[i]);
      return {
        question_text:kQuestionPrompt(diff),
        option_a:mixed[0],option_b:mixed[1],option_c:mixed[2],
        correct_option:['A','B','C'][p.indexOf(0)],
        source_excerpt:correct,difficulty:diff
      };
    }).slice(0,36);
  }

  async function kBuildBank(t){
    const src=kSourceFor(t);if(!src)throw new Error('No current safety PDF is attached.');
    let questions=kPdfCache.get(src.key);
    if(!questions){
      const dl=await ksb.storage.from('safety-files').download(src.path);
      if(dl.error||!dl.data)throw new Error(dl.error?.message||'Could not download the current safety PDF.');
      const text=await core.pdfTextFromBlob(dl.data);
      questions=kGenerateQuestions(text);
      if(questions.length<3)throw new Error('The PDF did not contain enough clear safety instructions to create a question bank.');
      kPdfCache.set(src.key,questions);
    }
    const r=await ksb.rpc('replace_training_quiz_bank_v21034',{
      p_training_session_id:t.id,p_source_key:src.key,p_questions:questions
    });
    if(r.error)throw new Error(r.error.message);
    return Number(r.data||questions.length);
  }

  async function kBankStatus(){
    const r=await ksb.rpc('training_quiz_bank_status_v21034');
    if(r.error)throw new Error(r.error.message);
    return r.data||[];
  }
  async function kSettings(){
    const r=await ksb.rpc('get_monthly_knowledge_settings_v21035');
    if(r.error)throw new Error(r.error.message);
    return r.data||{enabled:false,questions_per_month:3,difficulty:'MIXED'};
  }
  async function kStatus(){
    const r=await ksb.rpc('monthly_knowledge_status_v21035');
    if(r.error)throw new Error(r.error.message);
    return r.data||{};
  }
  async function kHistory(){
    const r=await ksb.rpc('monthly_knowledge_history_v21035',{p_user_id:null});
    if(r.error)throw new Error(r.error.message);
    return r.data||[];
  }

  function kDifficultyLabel(v){
    return ({EASY:'Easy',STANDARD:'Standard',HARD:'Hard',MIXED:'Mixed'})[String(v||'').toUpperCase()]||'Mixed';
  }
  function kDifficultyHelp(v){
    return ({
      EASY:'Core rules, PPE and straightforward do/don’t instructions.',
      STANDARD:'Normal task controls, safe steps and expected responses.',
      HARD:'Exact limits, timings, conditions, exceptions and detailed controls.',
      MIXED:'A balanced mixture of Easy, Standard and Hard questions where the assigned material supports it.'
    })[String(v||'MIXED').toUpperCase()];
  }

  function kStatusUi(s){
    const code=String(s?.status||'OFF');
    if(code==='CURRENT')return {klass:'traffic-green',title:'Completed',text:`${Number(s.questions_required||3)}/${Number(s.questions_required||3)} required questions completed for ${s.month_label||'this month'}.`};
    if(code==='OVERDUE')return {klass:'traffic-red',title:'Overdue',text:'Last month was missed. Complete this month’s knowledge check now.'};
    if(code==='DUE')return {klass:'traffic-amber',title:'Due this month',text:`Complete ${Number(s.questions_required||3)} random ${kDifficultyLabel(s.difficulty).toLowerCase()} questions from your current assigned safety information.`};
    if(code==='PREPARING')return {klass:'traffic-amber',title:'Preparing',text:'Your current safety material is being added to the automatic question bank. You are not marked overdue while questions are unavailable.'};
    return {klass:'traffic-neutral',title:'Switched off',text:'Monthly knowledge checks are currently switched off. No check is due.'};
  }

  async function kRenderMyCard(){
    if(kMyLoading||!ks.user||ks.profile?.report_only===true)return;
    const view=k$('mySafetyView');if(!view)return;
    let card=k$('monthlyKnowledgeCardV21037');
    if(!card){
      card=document.createElement('div');
      card.id='monthlyKnowledgeCardV21037';
      card.className='section-card monthly-knowledge-card';
      const anchor=k$('mySafetyStats');
      anchor?.insertAdjacentElement('afterend',card)||view.appendChild(card);
    }
    kMyLoading=true;
    try{
      card.innerHTML='<div class="muted">Loading monthly knowledge check…</div>';
      const [s,h]=await Promise.all([kStatus(),kHistory().catch(()=>[])]);
      const ui=kStatusUi(s),needed=Number(s.questions_required||3);
      const hist=h.slice(0,6).map(x=>`<span class="knowledge-history-pill ${x.passed?'good':'bad'}">${new Date(x.month_start+'T00:00:00').toLocaleDateString(undefined,{month:'short',year:'numeric'})}: ${x.passed?'✓ '+x.best_score+'/'+x.best_total:'Not passed'}</span>`).join('');
      card.className='section-card monthly-knowledge-card '+ui.klass;
      card.innerHTML=`<div class="row-between"><div><h3>Monthly Knowledge Check</h3><p class="muted">${kesc(ui.text)}</p></div><span class="knowledge-status-badge">${kesc(ui.title)}</span></div>
        <div class="knowledge-rule"><strong>${needed} random question${needed===1?'':'s'} · 3 choices each · all correct to complete.</strong><br>Difficulty: <strong>${kesc(kDifficultyLabel(s.difficulty))}</strong>. ${kesc(kDifficultyHelp(s.difficulty))}<br><span class="muted">This does not change formal training renewal dates.</span></div>
        ${hist?`<div class="knowledge-history">${hist}</div>`:''}
        <div class="actions">${s.enabled&&s.status!=='CURRENT'&&s.status!=='PREPARING'?`<button class="primary" id="takeMonthlyKnowledgeBtn" type="button">Take this month’s ${needed} question${needed===1?'':'s'}</button>`:''}</div>`;
      k$('takeMonthlyKnowledgeBtn')?.addEventListener('click',kOpenMonthlyQuiz);
    }catch(e){
      card.className='section-card monthly-knowledge-card traffic-red';
      card.innerHTML=`<div class="danger-note">Monthly knowledge check could not load: ${kesc(e.message||e)}</div>`;
    }finally{kMyLoading=false}
  }

  function kQuestionHtml(q,n,total){
    const opts=[['A',q.option_a],['B',q.option_b],['C',q.option_c]];
    const topic=kclean((q.training_reference?`${q.training_reference} - `:'')+(q.training_name||'Safety training'));
    return `<div class="knowledge-question"><div class="knowledge-q-head"><span>Question ${n} of ${total}</span><small>${kesc(topic)} · ${kesc(kDifficultyLabel(q.difficulty))}</small></div><strong>${kesc(q.question_text)}</strong><div class="knowledge-options">${opts.map(([key,val])=>`<label class="knowledge-option"><input type="radio" name="kq_${kesc(q.question_id)}" value="${key}"><span><b>${key}.</b> ${kesc(val)}</span></label>`).join('')}</div></div>`;
  }

  async function kOpenMonthlyQuiz(){
    const button=k$('takeMonthlyKnowledgeBtn');if(button){button.disabled=true;button.textContent='Preparing questions…'}
    try{
      let r=await ksb.rpc('get_monthly_knowledge_quiz_v21035');
      if(r.error)throw new Error(r.error.message);
      let q=r.data||{};
      if(!q.enabled)return ktoast('Monthly knowledge checks are switched off.');
      if(q.completed){await kRenderMyCard();return ktoast('This month’s knowledge check is already complete.')}
      if(!q.bank_ready){
        if(kIsManager()){
          await kAutoBuildMissing(true);
          r=await ksb.rpc('get_monthly_knowledge_quiz_v21035');
          if(r.error)throw new Error(r.error.message);
          q=r.data||{};
        }
      }
      if(!q.bank_ready||!Array.isArray(q.questions)||!q.questions.length){
        return ktoast('Your question bank is still being prepared automatically. You are not marked overdue while it is unavailable.');
      }
      const total=q.questions.length;
      kQuiz={issueId:q.issue_id,questions:q.questions};
      openModal('Monthly Knowledge Check',`<div class="hint-box"><strong>${total} random ${kesc(kDifficultyLabel(q.difficulty))} question${total===1?'':'s'} for this month.</strong> Choose one answer for each. You need ${Number(q.required_score||total)}/${total}. Wrong answers show the safety topic to review, and a retry uses another random set where possible.</div><div class="knowledge-question-list">${q.questions.map((x,i)=>kQuestionHtml(x,i+1,total)).join('')}</div><div id="monthlyKnowledgeResult" class="message" hidden></div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" id="submitMonthlyKnowledgeBtn">Check answers</button></div>`);
      setTimeout(()=>{
        k$('submitMonthlyKnowledgeBtn')?.addEventListener('click',kSubmitMonthlyQuiz);
        const modal=k$('modal'),body=k$('modalBody');
        try{if(modal)modal.scrollTop=0;if(body)body.scrollTop=0;}catch(_e){}
      },0);
    }catch(e){ktoast('Could not start monthly knowledge check: '+(e.message||e))}
    finally{if(button){button.disabled=false;button.textContent='Take monthly knowledge check'}}
  }

  async function kSubmitMonthlyQuiz(){
    if(!kQuiz)return;
    const answers=kQuiz.questions.map(q=>{
      const picked=document.querySelector(`input[name="kq_${String(q.question_id)}"]:checked`);
      return {question_id:q.question_id,selected:picked?.value||''};
    });
    if(answers.some(x=>!x.selected))return ktoast('Answer every question.');
    const btn=k$('submitMonthlyKnowledgeBtn');if(btn){btn.disabled=true;btn.textContent='Checking…'}
    const r=await ksb.rpc('submit_monthly_knowledge_quiz_v21035',{p_issue_id:kQuiz.issueId,p_answers:answers});
    if(r.error){if(btn){btn.disabled=false;btn.textContent='Check answers'}return ktoast(r.error.message)}
    const out=r.data||{},box=k$('monthlyKnowledgeResult');
    if(out.passed){
      if(box){box.hidden=false;box.className='success-note';box.innerHTML=`<strong>${Number(out.score||0)}/${Number(out.total||0)} correct.</strong> Monthly knowledge check completed.`}
      kQuiz=null;
      setTimeout(async()=>{try{closeModal()}catch(_e){};await kRenderMyCard();await kRefreshAdmin();await kRenderTeamCard()},650);
      return;
    }
    const wrong=(out.results||[]).filter(x=>!x.correct);
    if(box){
      box.hidden=false;box.className='danger-note';
      box.innerHTML=`<strong>${Number(out.score||0)}/${Number(out.total||0)} correct.</strong><br>Review ${wrong.length===1?'this safety topic':'these safety topics'} before trying again:<div class="knowledge-review-list">${wrong.map(x=>`<button type="button" class="secondary small" data-review-knowledge-assignment="${kesc(x.training_assignment_id||'')}">Review ${kesc(x.topic||'safety information')}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-review-knowledge-assignment]').forEach(b=>b.addEventListener('click',async()=>{
        const id=b.dataset.reviewKnowledgeAssignment;if(!id)return;
        try{closeModal();await core.openRequiredTrainingMaterial(id)}catch(e){ktoast(e.message||e)}
      }));
    }
    if(btn){
      btn.disabled=false;btn.textContent='Try another random set';
      btn.onclick=async()=>{try{closeModal()}catch(_e){};kQuiz=null;await kOpenMonthlyQuiz()};
    }
    await kRenderMyCard();
  }

  async function kBuildRows(rows,{silent=false}={}){
    if(kBuildBusy||!kIsManager()||!rows.length)return {ok:0,failed:0};
    kBuildBusy=true;let ok=0,failed=0;
    try{
      for(let i=0;i<rows.length;i++){
        const row=rows[i],t=(ks.training||[]).find(x=>x.id===row.training_session_id);
        const progress=k$('monthlyKnowledgeAdminProgress');
        if(progress&&!silent)progress.innerHTML=`<div class="hint-box"><strong>Automatically building ${i+1} of ${rows.length}</strong><br>${kesc(t?.name||row.training_name)}</div>`;
        if(!t){failed++;continue}
        try{await kBuildBank(t);ok++}catch(e){console.warn('Knowledge question bank build failed',t.name,e);failed++}
        await kDelay(80);
      }
      return {ok,failed};
    }finally{kBuildBusy=false}
  }

  async function kBuildMissing(manual=false){
    if(!kIsManager())return;
    try{
      const rows=await kBankStatus(),targets=rows.filter(x=>!x.ready);
      if(!targets.length){if(manual)ktoast('All current question banks are ready.');return {ok:0,failed:0}}
      const result=await kBuildRows(targets,{silent:!manual});
      if(manual)ktoast(`Question-bank build finished: ${result.ok} ready${result.failed?`, ${result.failed} need review`:''}.`);
      await kRefreshAdmin();await kRenderMyCard();await kRenderTeamCard();
      return result;
    }catch(e){if(manual)ktoast(e.message||e);return {ok:0,failed:1}}
  }

  async function kAutoBuildMissing(force=false){
    if(!kIsManager()||kBuildBusy||!navigator.onLine)return;
    const now=Date.now();if(!force&&now-kLastAutoScan<90000)return;kLastAutoScan=now;
    let settings;try{settings=await kSettings()}catch(_e){return}
    if(!settings.enabled)return;
    try{
      const rows=await kBankStatus(),targets=rows.filter(x=>!x.ready);
      if(!targets.length)return;
      await kBuildRows(targets,{silent:true});
      await kRenderMyCard();await kRefreshAdmin();await kRenderTeamCard();
    }catch(e){console.warn('Automatic monthly question-bank update failed',e)}
  }

  async function kReviewQuestions(){
    if(!kIsManager())return;
    let rows;try{rows=await kBankStatus()}catch(e){return ktoast(e.message||e)}
    openModal('Review monthly knowledge questions',`<div class="hint-box"><strong>Automatically generated from current controlled safety PDFs.</strong> The correct answer shown in green is the source statement. Remove any unsuitable question. New/superseding safety material is picked up automatically and gets a fresh bank.</div><label>Safety training<select id="monthlyQuestionReviewSelect"><option value="">Select training</option>${rows.map(r=>`<option value="${kesc(r.training_session_id)}">${kesc(r.training_name)} · ${Number(r.question_count||0)} questions</option>`).join('')}</select></label><div id="monthlyQuestionReviewList" class="card-list" style="margin-top:12px"></div><div class="actions"><button class="ghost" type="button" data-close-modal>Close</button></div>`);
    setTimeout(()=>k$('monthlyQuestionReviewSelect')?.addEventListener('change',e=>kLoadReview(e.target.value)),0);
  }

  async function kLoadReview(trainingId){
    const el=k$('monthlyQuestionReviewList');if(!el)return;
    if(!trainingId){el.innerHTML='';return}
    el.innerHTML='<div class="muted">Loading questions…</div>';
    const r=await ksb.rpc('list_training_quiz_questions_v21034',{p_training_session_id:trainingId});
    if(r.error){el.innerHTML=`<div class="danger-note">${kesc(r.error.message)}</div>`;return}
    const rows=r.data||[];
    el.innerHTML=rows.length?rows.map((q,i)=>{
      const correct=q.correct_option==='A'?q.option_a:q.correct_option==='B'?q.option_b:q.option_c;
      return `<div class="item-card compact"><div class="row-between"><strong>${i+1}. ${kesc(q.question_text)}</strong><button class="ghost small" type="button" data-remove-monthly-question="${kesc(q.id)}" data-training-id="${kesc(trainingId)}">Remove</button></div><div class="success-note" style="margin-top:7px"><strong>Correct:</strong> ${kesc(correct)}</div><div class="muted"><strong>Source wording:</strong> ${kesc(q.source_excerpt||'')}</div></div>`;
    }).join(''):'<div class="empty">No current questions for this training.</div>';
    el.querySelectorAll('[data-remove-monthly-question]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Remove this question from the active random question bank?'))return;
      const x=await ksb.rpc('set_training_quiz_question_active_v21034',{p_question_id:b.dataset.removeMonthlyQuestion,p_active:false});
      if(x.error)return ktoast(x.error.message);
      await kLoadReview(b.dataset.trainingId);await kRefreshAdmin();await kRenderMyCard();await kRenderTeamCard();
    }));
  }

  async function kToggleEnabled(){
    if(!kIsAdmin())return ktoast('Admin access required.');
    const s=await kSettings(),next=!s.enabled,word=next?'ON':'OFF';
    if(!confirm(`Switch Monthly Knowledge Checks ${word}?${next?'\n\nThis starts with the current month only. No earlier backlog will be created. Questions from new applicable safety material will then be added automatically.':'\n\nNo user will be due or overdue while switched off. Existing results remain saved.'}`))return;
    const r=await ksb.rpc('set_monthly_knowledge_enabled_v21035',{p_enabled:next});
    if(r.error)return ktoast(r.error.message);
    ktoast(`Monthly Knowledge Checks switched ${word}.`);
    await kRefreshAdmin();await kRenderMyCard();await kRenderTeamCard();
    if(next)setTimeout(()=>kAutoBuildMissing(true),150);
  }

  async function kSaveConfig(){
    if(!kIsAdmin())return ktoast('Admin access required.');
    const q=Math.max(1,Math.min(10,Number(k$('monthlyKnowledgeQuestionCount')?.value||3)));
    const d=String(k$('monthlyKnowledgeDifficulty')?.value||'MIXED').toUpperCase();
    const r=await ksb.rpc('set_monthly_knowledge_config_v21036',{p_questions_per_month:q,p_difficulty:d});
    if(r.error)return ktoast(r.error.message);
    ktoast(`Monthly knowledge check updated: ${q} question${q===1?'':'s'}, ${kDifficultyLabel(d)} difficulty.`);
    await kRefreshAdmin();await kRenderMyCard();await kRenderTeamCard();
    setTimeout(()=>kAutoBuildMissing(true),150);
  }

  async function kRefreshAdmin(){
    const card=k$('monthlyKnowledgeAdminCardV21037');if(!card||!kIsAdmin()||kAdminLoading)return;
    kAdminLoading=true;
    try{
      const [settings,banks,teamResp]=await Promise.all([
        kSettings(),kBankStatus().catch(()=>[]),ksb.rpc('monthly_knowledge_team_status_v21035')
      ]);
      const team=teamResp.error?[]:(teamResp.data||[]);
      const ready=banks.filter(x=>x.ready).length,missing=banks.length-ready;
      const current=team.filter(x=>x.status==='CURRENT').length,due=team.filter(x=>x.status==='DUE').length,over=team.filter(x=>x.status==='OVERDUE').length,prep=team.filter(x=>x.status==='PREPARING').length;
      const readyPeople=team.filter(x=>!['PREPARING','OFF'].includes(x.status)).length;
      const pct=readyPeople?Math.round(current/readyPeople*100):0;

      const toggle=k$('monthlyKnowledgeToggleBtn');
      if(toggle){toggle.textContent=`Monthly Knowledge Checks: ${settings.enabled?'ON':'OFF'}`;toggle.className=settings.enabled?'primary knowledge-toggle-on':'secondary knowledge-toggle-off'}
      const qc=k$('monthlyKnowledgeQuestionCount');if(qc)qc.value=String(settings.questions_per_month||3);
      const df=k$('monthlyKnowledgeDifficulty');if(df)df.value=String(settings.difficulty||'MIXED');
      const help=k$('monthlyKnowledgeDifficultyHelp');if(help)help.textContent=kDifficultyHelp(settings.difficulty);

      const stateEl=k$('monthlyKnowledgeSwitchState');
      if(stateEl)stateEl.innerHTML=settings.enabled?`<div class="success-note"><strong>ON.</strong> ${Number(settings.questions_per_month||3)} ${kesc(kDifficultyLabel(settings.difficulty))} question${Number(settings.questions_per_month||3)===1?'':'s'} per person each month. Ready-user completion: <strong>${pct}%</strong>.</div>`:'<div class="hint-box"><strong>OFF.</strong> No monthly check is due and nobody is marked overdue. Previous results are retained.</div>';

      const bankEl=k$('monthlyKnowledgeBankStats');
      if(bankEl)bankEl.innerHTML=`<div class="stats-grid"><div class="stat traffic-${missing?'amber':'green'}"><strong>${ready}</strong><span>Question banks ready</span></div><div class="stat traffic-${missing?'red':'green'}"><strong>${missing}</strong><span>Waiting for automatic build</span></div></div><div class="muted" style="margin-top:6px">Automatic generation is ${settings.enabled?'<strong>active</strong> while an Admin/Manager is signed in':'paused while the feature is OFF'}. New approved/current assigned safety material is detected automatically.</div>`;

      const teamEl=k$('monthlyKnowledgeTeamStats');
      if(teamEl)teamEl.innerHTML=`<div class="stats-grid"><div class="stat traffic-green"><strong>${current}</strong><span>Complete</span></div><div class="stat traffic-amber"><strong>${due}</strong><span>Due</span></div><div class="stat traffic-red"><strong>${over}</strong><span>Overdue</span></div><div class="stat traffic-neutral"><strong>${prep}</strong><span>Preparing</span></div></div>`;

      const list=k$('monthlyKnowledgeTeamList');
      if(list)list.innerHTML=team.length?team.map(x=>`<div class="item-row knowledge-team-row"><div><strong>${kesc(x.display_name)}</strong><div class="muted">${x.last_attempt_at?`Last attempt ${new Date(x.last_attempt_at).toLocaleDateString()} · ${Number(x.last_score??0)}/${Number(x.last_total??x.questions_required??0)}`:'No attempt this month'} · ${Number(x.questions_required||settings.questions_per_month||3)} ${kesc(kDifficultyLabel(x.difficulty||settings.difficulty))}</div></div><span class="badge knowledge-${String(x.status).toLowerCase()}">${kesc(x.status==='CURRENT'?'Complete':x.status==='PREPARING'?'Preparing':x.status==='OVERDUE'?'Overdue':x.status==='DUE'?'Due':'Off')}</span></div>`).join(''):'<div class="muted">No active users.</div>';
    }catch(e){
      const stateEl=k$('monthlyKnowledgeSwitchState');if(stateEl)stateEl.innerHTML=`<div class="danger-note">${kesc(e.message||e)}</div>`;
    }finally{kAdminLoading=false}
  }

  function kEnsureAdminCard(){
    if(!kIsAdmin())return;
    const view=k$('adminView');if(!view||k$('monthlyKnowledgeAdminCardV21037'))return;
    const card=document.createElement('div');card.className='section-card';card.id='monthlyKnowledgeAdminCardV21037';
    card.innerHTML=`<div class="row-between"><div><h3>Monthly Knowledge Checks</h3><p class="muted">Automatic monthly testing using each person’s current assigned safety information.</p></div><button type="button" class="secondary" id="monthlyKnowledgeToggleBtn">Monthly Knowledge Checks</button></div>
      <div id="monthlyKnowledgeSwitchState" style="margin-top:10px"><div class="muted">Loading setting…</div></div>
      <div class="form-grid" style="margin-top:12px">
        <label>Questions per month<input id="monthlyKnowledgeQuestionCount" type="number" min="1" max="10" step="1" value="3"><span class="muted">Choose 1 to 10. All questions must be correct.</span></label>
        <label>Difficulty<select id="monthlyKnowledgeDifficulty"><option value="EASY">Easy</option><option value="STANDARD">Standard</option><option value="HARD">Hard</option><option value="MIXED">Mixed</option></select><span id="monthlyKnowledgeDifficultyHelp" class="muted"></span></label>
      </div>
      <div class="actions"><button class="primary" type="button" id="saveMonthlyKnowledgeConfigBtn">Save question settings</button><button class="secondary" type="button" id="reviewMonthlyQuestionsBtn">Review generated questions</button><button class="ghost" type="button" id="buildMonthlyQuestionBanksBtn">Run automatic scan now</button></div>
      <div class="hint-box"><strong>Fully automatic:</strong> approved/current RA, COSHH RA, SSW, Toolbox Talk and other applicable training sources are picked up through existing user/department assignments. New items and new versions automatically enter the question-bank scan; superseded versions stop being used. SDS/MSDS is not tested as unrelated standalone training.</div>
      <div class="hint-box"><strong>Switch behaviour:</strong> OFF means no one is due/overdue and history is retained. Turning ON starts with the current month only — no backlog.</div>
      <div id="monthlyKnowledgeAdminProgress"></div><div id="monthlyKnowledgeBankStats" style="margin-top:12px"></div><div id="monthlyKnowledgeTeamStats" style="margin-top:12px"></div><div id="monthlyKnowledgeTeamList" class="card-list" style="margin-top:12px"></div>`;
    const first=view.querySelector('.section-card');first?.insertAdjacentElement('afterend',card)||view.appendChild(card);
    k$('monthlyKnowledgeToggleBtn')?.addEventListener('click',kToggleEnabled);
    k$('saveMonthlyKnowledgeConfigBtn')?.addEventListener('click',kSaveConfig);
    k$('reviewMonthlyQuestionsBtn')?.addEventListener('click',kReviewQuestions);
    k$('buildMonthlyQuestionBanksBtn')?.addEventListener('click',()=>kBuildMissing(true));
    k$('monthlyKnowledgeDifficulty')?.addEventListener('change',e=>{const h=k$('monthlyKnowledgeDifficultyHelp');if(h)h.textContent=kDifficultyHelp(e.target.value)});
    kRefreshAdmin();
  }

  async function kRenderTeamCard(){
    if(!kIsManager()||kTeamLoading)return;
    const view=k$('complianceView');if(!view)return;
    let card=k$('monthlyKnowledgeComplianceCardV21037');
    if(!card){
      card=document.createElement('div');card.id='monthlyKnowledgeComplianceCardV21037';card.className='section-card';
      const stats=k$('complianceStats');stats?.insertAdjacentElement('afterend',card)||view.appendChild(card);
    }
    kTeamLoading=true;
    try{
      const [settings,resp]=await Promise.all([kSettings(),ksb.rpc('monthly_knowledge_team_status_v21035')]);
      if(resp.error)throw new Error(resp.error.message);
      const rows=resp.data||[],complete=rows.filter(x=>x.status==='CURRENT').length,due=rows.filter(x=>x.status==='DUE').length,over=rows.filter(x=>x.status==='OVERDUE').length,prep=rows.filter(x=>x.status==='PREPARING').length;
      const ready=rows.filter(x=>!['PREPARING','OFF'].includes(x.status)).length,pct=ready?Math.round(complete/ready*100):0;
      card.innerHTML=`<div class="row-between"><div><h3>Monthly Knowledge Checks</h3><p class="muted">${settings.enabled?`${pct}% of ready users complete · ${Number(settings.questions_per_month||3)} ${kesc(kDifficultyLabel(settings.difficulty))} question${Number(settings.questions_per_month||3)===1?'':'s'} per month`:'Currently switched off by Admin'}</p></div><span class="badge ${settings.enabled?'complete':'muted'}">${settings.enabled?'ON':'OFF'}</span></div><div class="stats-grid"><div class="stat traffic-green"><strong>${complete}</strong><span>Complete</span></div><div class="stat traffic-amber"><strong>${due}</strong><span>Due</span></div><div class="stat traffic-red"><strong>${over}</strong><span>Overdue</span></div><div class="stat traffic-neutral"><strong>${prep}</strong><span>Preparing</span></div></div>`;
    }catch(e){card.innerHTML=`<div class="danger-note">Could not load monthly knowledge status: ${kesc(e.message||e)}</div>`}
    finally{kTeamLoading=false}
  }

  function kEnsureCards(){
    if(!ks.user||ks.profile?.report_only===true)return;
    kRenderMyCard();
    if(kIsAdmin())kEnsureAdminCard();
    if(kIsManager())kRenderTeamCard();
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.view==='mySafety')setTimeout(kRenderMyCard,50);
    if(b.dataset.view==='admin')setTimeout(kEnsureAdminCard,50);
    if(b.dataset.view==='compliance')setTimeout(kRenderTeamCard,50);
  },true);

  // Do not observe the whole DOM here. Re-rendering the knowledge card changes
  // child nodes, which would trigger the observer again and can cause Android
  // screen flicker. Refresh only on startup, navigation and returning to app.
  setTimeout(kEnsureCards,450);
  setTimeout(kEnsureCards,1600);
  window.addEventListener('pageshow',()=>setTimeout(kEnsureCards,80));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(kEnsureCards,120);
  });
  setTimeout(()=>kAutoBuildMissing(true),2500);
  kAutoTimer=setInterval(()=>kAutoBuildMissing(false),120000);

  const style=document.createElement('style');
  style.id='monthlyKnowledgeStylesV21037';
  style.textContent=`
    .monthly-knowledge-card{border-left:5px solid #94a3b8}
    .monthly-knowledge-card.traffic-green{border-left-color:#2d6a4f}.monthly-knowledge-card.traffic-amber{border-left-color:#d89414}.monthly-knowledge-card.traffic-red{border-left-color:#b42318}
    .knowledge-status-badge{font-weight:800;padding:6px 10px;border-radius:999px;background:#eef2f5}
    .knowledge-rule{margin-top:10px;padding:10px;border-radius:10px;background:#f6f8fa;line-height:1.5}
    .knowledge-history{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.knowledge-history-pill{padding:5px 8px;border-radius:999px;font-size:.8rem;background:#eef2f5}.knowledge-history-pill.good{background:#e8f6ec}.knowledge-history-pill.bad{background:#fdecec}
    .knowledge-question-list{display:grid;gap:14px;margin:14px 0}.knowledge-question{border:1px solid #d7e0e7;border-radius:12px;padding:14px;background:#fff}.knowledge-q-head{display:flex;justify-content:space-between;gap:10px;font-size:.82rem;color:#607182;font-weight:700;margin-bottom:7px}.knowledge-q-head small{text-align:right}
    .knowledge-options{display:grid;gap:8px;margin-top:10px}.knowledge-option{display:flex;gap:10px;align-items:flex-start;border:1px solid #d8e0e6;border-radius:10px;padding:11px;cursor:pointer;background:#fafcfd}.knowledge-option:has(input:checked){border-color:#2d6a4f;background:#ecf8f1}.knowledge-option input{width:auto;min-width:auto;margin-top:3px}.knowledge-option span{line-height:1.4}
    .knowledge-review-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.knowledge-toggle-on{background:#2d6a4f!important}.knowledge-team-row{align-items:center}.knowledge-current{background:#e8f6ec}.knowledge-due{background:#fff3d6}.knowledge-overdue{background:#fdecec}.knowledge-preparing{background:#eef2f5}
    @media(max-width:640px){.knowledge-question{padding:12px}.knowledge-option{padding:12px}.knowledge-q-head{display:block}.knowledge-q-head small{display:block;text-align:left;margin-top:3px}}
  `;
  document.head.appendChild(style);

  core.monthlyKnowledgeV21037={
    render:kRenderMyCard,autoBuild:()=>kAutoBuildMissing(true),review:kReviewQuestions,
    refreshAdmin:kRefreshAdmin,saveConfig:kSaveConfig
  };
})();
