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

/* Safety Tracker v2.10.38 - role-aware action Help with direct Go there buttons */
(function(){
  const core=window.SafetyTrackerV2;
  if(!core||!core.state)return;

  const hstate=core.state;
  const h$=id=>document.getElementById(id);
  const hesc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const hclean=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const htoast=msg=>{try{return (window.toast||core.toast)?.(msg)}catch(_e){console.log(msg)}};

  function hApplyVersion(){
    if(window.SAFETY_BUILD){
      window.SAFETY_BUILD.version='2.10.38';
      window.SAFETY_BUILD.label='2.10.38 CLEAN';
      window.SAFETY_BUILD.build='21038';
      try{window.applySafetyBuildLabel?.()}catch(_e){}
    }
    document.querySelectorAll('.build-badge').forEach(el=>el.textContent='Safety Tracker v2.10.38 CLEAN');
    document.querySelectorAll('.dashboard-version').forEach(el=>el.textContent='v2.10.38 CLEAN');
    document.querySelectorAll('.brand-line .version,.demo-brand-line .version').forEach(el=>el.textContent='v2.10.38');
  }
  [0,350,1200].forEach(ms=>setTimeout(hApplyVersion,ms));
  document.addEventListener('DOMContentLoaded',hApplyVersion,{once:true});

  function hRole(){
    try{
      if(typeof isAdmin==='function'&&isAdmin())return 'admin';
      if(typeof isManager==='function'&&isManager())return 'manager';
    }catch(_e){}
    return 'user';
  }

  function hCanView(view){
    try{return typeof canAccessView==='function'?canAccessView(view):true}catch(_e){return true}
  }

  const ACTIONS=[
    // User / day-to-day
    {id:'my-safety',roles:['user','manager','admin'],group:'Everyday',title:'See what I need to do',desc:'Open your live safety dashboard and outstanding items.',view:'mySafety',keywords:'my safety due overdue traffic lights actions'},
    {id:'hs-training',roles:['user','manager','admin'],group:'Training',title:'Complete H&S training',desc:'Open your assigned RA, COSHH RA, SSW and Toolbox Talk training.',view:'hsTraining',keywords:'training risk assessment coshh ssw toolbox talk complete sign'},
    {id:'standalone-training',roles:['user','manager','admin'],group:'Training',title:'Open standalone training',desc:'Policies, inductions, refreshers and other non-document-driven training.',view:'training',keywords:'standalone training induction refresher policy'},
    {id:'monthly-knowledge',roles:['user','manager','admin'],group:'Training',title:'Monthly Knowledge Check',desc:'Go straight to this month’s random safety questions and status.',view:'mySafety',anchor:'[id^="monthlyKnowledgeCardV"]',keywords:'monthly questions quiz knowledge check difficulty random'},
    {id:'awareness',roles:['user','manager','admin'],group:'Everyday',title:'Safety Awareness',desc:'Open your current safety awareness reading and status.',view:'awareness',keywords:'awareness reading annual refresher'},
    {id:'checklists',roles:['user','manager','admin'],group:'Checks',title:'Open safety checklists',desc:'PPE, First Aid and custom recurring checks in one place.',view:'checklists',keywords:'checklists checks ppe first aid custom recurring'},
    {id:'ppe',roles:['user','manager','admin'],group:'Checks',title:'Complete PPE check',desc:'Open the monthly PPE check directly.',view:'ppe',keywords:'ppe monthly missing damaged replacement'},
    {id:'first-aid',roles:['user','manager','admin'],group:'Checks',title:'Complete First Aid check',desc:'Open assigned First Aid box checks directly.',view:'firstAid',keywords:'first aid monthly box check missing low expired damaged'},
    {id:'onsite',roles:['user','manager','admin'],group:'Contractors',title:"Who's On Site",desc:'Open current contractor attendance and permit status.',view:'onsite',keywords:'contractor onsite on site permit ptw evacuation'},
    {id:'asbestos-user',roles:['user','manager','admin'],group:'Work controls',title:'Asbestos Lookup',desc:'Open the location-based asbestos lookup when access is available.',view:'asbestos',keywords:'asbestos acm survey amp location maintenance',conditional:()=>hCanView('asbestos')},

    // Manager
    {id:'documents',roles:['manager','admin'],group:'Documents',title:'Review safety documents',desc:'Open controlled RA, COSHH RA, SSW, TBT and SDS records.',view:'documents',keywords:'documents approve review register versions ra coshh ssw tbt sds'},
    {id:'approvals',roles:['manager','admin'],group:'Documents',title:'Document approvals',desc:'Jump to the pending/current document-control overview.',view:'documents',anchor:'#documentApprovalOverview',keywords:'approve pending document approval current review'},
    {id:'create-doc',roles:['manager','admin'],group:'Documents',title:'Create a safety document',desc:'Open Risk Assessment, COSHH RA, SSW and Toolbox Talk creation.',view:'creator',keywords:'create document ra coshh ssw toolbox tbt'},
    {id:'people',roles:['manager','admin'],group:'People',title:'People & assignments',desc:'Open users and their safety assignments.',view:'people',keywords:'people users assignment department training person'},
    {id:'compliance',roles:['manager','admin'],group:'Management',title:'Compliance overview',desc:'Open team training and safety compliance status.',view:'compliance',keywords:'compliance matrix team status overdue due'},
    {id:'monthly-team',roles:['manager','admin'],group:'Training',title:'Monthly Knowledge team status',desc:'Jump directly to monthly knowledge-check completion for the team.',view:'compliance',anchor:'[id^="monthlyKnowledgeComplianceCardV"]',keywords:'monthly questions team results compliance knowledge'},
    {id:'instructor',roles:['manager','admin'],group:'Training',title:'Instructor / group attendance',desc:'Open instructor-led training and attendance recording.',view:'instructor',keywords:'instructor attendance group toolbox training'},
    {id:'reports',roles:['manager','admin'],group:'Reports',title:'Open Reports',desc:'Open compliance reports and archived evidence.',view:'reports',keywords:'reports pdf excel archive'},
    {id:'evidence-pack',roles:['manager','admin'],group:'Reports',title:'Build a Person Evidence Pack',desc:'Jump directly to the evidence-pack builder.',view:'reports',anchor:'.evidence-report-section',click:'#evidencePackBtn',keywords:'evidence pack person training documents proof'},
    {id:'ptw-reports',roles:['manager','admin'],group:'Reports',title:'Contractor Permit reports',desc:'Jump directly to PTW/contractor reporting.',view:'reports',anchor:'.contractor-report-section',keywords:'contractor permit ptw report csv pdf'},
    {id:'review-questions',roles:['manager','admin'],group:'Training',title:'Review generated monthly questions',desc:'Open the question reviewer for current safety material.',view:'compliance',custom:'review-questions',keywords:'review questions monthly quiz generated correct answers'},

    // Admin
    {id:'admin-home',roles:['admin'],group:'Admin setup',title:'Admin controls',desc:'Open the main Safety Tracker administration area.',view:'admin',keywords:'admin settings setup'},
    {id:'add-user',roles:['admin'],group:'Admin setup',title:'Add a user',desc:'Open People and start the invite-user form.',view:'people',click:'#inviteUserBtn',keywords:'add user invite employee person new user'},
    {id:'departments',roles:['admin'],group:'Admin setup',title:'Departments',desc:'Jump directly to department setup.',view:'admin',anchor:'#departmentList',closest:'.section-card',keywords:'department create edit assign users'},
    {id:'viewer',roles:['admin'],group:'Admin setup',title:'Guest / Viewer access',desc:'Jump directly to viewer-account controls.',view:'admin',anchor:'#viewerAccessAdminCard',keywords:'guest viewer username password expiry access'},
    {id:'new-viewer',roles:['admin'],group:'Admin setup',title:'Create a Viewer account',desc:'Open the new temporary Viewer account form immediately.',view:'admin',click:'[data-new-viewer]',keywords:'create viewer guest username password'},
    {id:'monthly-settings',roles:['admin'],group:'Training',title:'Monthly Knowledge settings',desc:'Jump directly to ON/OFF, question count and difficulty settings.',view:'admin',anchor:'[id^="monthlyKnowledgeAdminCardV"]',keywords:'monthly questions settings on off difficulty number'},
    {id:'document-switch',roles:['admin'],group:'Documents',title:'Document Creation ON/OFF',desc:'Jump directly to the Document Creation switch.',view:'admin',anchor:'#adminDocumentCreationToggleBtn',closest:'.section-card',keywords:'document creation switch on off'},
    {id:'checklist-builder',roles:['admin'],group:'Checks',title:'Checklist Builder',desc:'Open the custom Checklist Builder directly.',view:'checklists',custom:'checklist-builder',keywords:'custom checklist builder create new questions checks'},
    {id:'new-checklist',roles:['admin'],group:'Checks',title:'Create a new checklist',desc:'Open a blank custom checklist setup form.',view:'checklists',custom:'new-checklist',keywords:'new checklist create custom recurring adhoc'},
    {id:'site-locations',roles:['admin'],group:'Admin setup',title:'Site locations',desc:'Jump directly to the location hierarchy used by PTW and asbestos.',view:'admin',anchor:'#siteLocationList',closest:'.section-card',keywords:'site locations floor room area ptw asbestos'},
    {id:'asbestos-sources',roles:['admin'],group:'Admin setup',title:'Asbestos source documents',desc:'Jump directly to AMP, survey and reinspection uploads.',view:'admin',anchor:'#asbestosSourceAdminList',closest:'.section-card',keywords:'asbestos source amp survey upload reinspection'},
    {id:'force-sync',roles:['admin'],group:'System',title:'Force Sync & Review',desc:'Jump directly to the repair/synchronisation control.',view:'admin',anchor:'#forceSyncBtn',closest:'.section-card',keywords:'force sync review repair links training'},
    {id:'bulk-import',roles:['admin'],group:'System',title:'Bulk Import',desc:'Jump directly to bulk PDF analysis and import.',view:'admin',anchor:'#bulkImportFiles',closest:'.section-card',keywords:'bulk import pdf upload documents'},
    {id:'storage-cleanup',roles:['admin'],group:'System',title:'Storage Cleanup',desc:'Jump directly to the orphan-file storage scan.',view:'admin',anchor:'#storageCleanupBtn',closest:'.section-card',keywords:'storage cleanup orphan files'},
    {id:'diagnostics',roles:['admin'],group:'System',title:'Build diagnostics',desc:'Jump directly to current build and system diagnostics.',view:'admin',anchor:'#buildDiagnostics',closest:'.section-card',keywords:'diagnostics version build schema errors system'}
  ];

  function hAllowedActions(){
    const role=hRole();
    return ACTIONS.filter(a=>a.roles.includes(role)||(
      role==='admin'&&a.roles.includes('manager')
    )||(
      role==='manager'&&a.roles.includes('user')
    )||(
      role==='admin'&&a.roles.includes('user')
    )).filter(a=>!a.conditional||a.conditional()).filter(a=>!a.view||hCanView(a.view));
  }

  function hRoleLabel(){
    const role=hRole();
    if(role==='admin')return 'Admin Help';
    if(role==='manager')return 'Manager Help';
    return 'User Help';
  }

  function hCard(a){
    return `<article class="role-help-action" data-help-search="${hesc(hclean([a.title,a.desc,a.group,a.keywords].join(' ')))}">
      <div class="role-help-action-copy"><span class="role-help-group">${hesc(a.group)}</span><h3>${hesc(a.title)}</h3><p>${hesc(a.desc)}</p></div>
      <button class="primary role-help-go" type="button" data-role-help-go="${hesc(a.id)}">Go there</button>
    </article>`;
  }

  function hRender(){
    const root=h$('helpContent');
    if(!root)return;
    const actions=hAllowedActions();
    const role=hRole();
    root.innerHTML=`<div class="role-help-shell">
      <div class="role-help-hero">
        <div><span class="role-help-role">${hesc(hRoleLabel())}</span><h3>What do you want to do?</h3><p>Search for the task. Safety Tracker will take you directly to the right screen or control.</p></div>
        <div class="role-help-search-wrap"><input id="roleHelpSearch" type="search" autocomplete="off" placeholder="Try: add user, monthly questions, PPE, viewer, SDS, PTW…"><button id="roleHelpClear" class="ghost small" type="button">Clear</button></div>
      </div>
      <div id="roleHelpNoResults" class="hint-box" hidden>No matching help action. Try a shorter word such as <strong>training</strong>, <strong>checklist</strong>, <strong>document</strong> or <strong>contractor</strong>.</div>
      <div id="roleHelpActions" class="role-help-grid">${actions.map(hCard).join('')}</div>
      <div class="help-card role-help-note"><h3>Traffic-light colours</h3><p><strong>Green</strong> = complete/current. <strong>Amber</strong> = due or action required. <strong>Red</strong> = overdue/problem. <strong>Grey</strong> = inactive, historical or switched off.</p></div>
      <div class="help-card role-help-note"><h3>Safety notice</h3><p>Safety Tracker supports safety management and record keeping. It does not replace current legislation, approved risk controls, manufacturer instructions, competent supervision or site-specific judgement.</p></div>
    </div>`;

    const search=h$('roleHelpSearch'),clear=h$('roleHelpClear'),no=h$('roleHelpNoResults');
    const filter=()=>{
      const q=hclean(search?.value||'');
      let shown=0;
      root.querySelectorAll('.role-help-action').forEach(card=>{
        const ok=!q||String(card.dataset.helpSearch||'').includes(q);
        card.hidden=!ok;if(ok)shown++;
      });
      if(no)no.hidden=shown!==0;
    };
    search?.addEventListener('input',filter);
    clear?.addEventListener('click',()=>{if(search){search.value='';search.focus()}filter()});
    root.querySelectorAll('[data-role-help-go]').forEach(b=>b.addEventListener('click',()=>hGo(b.dataset.roleHelpGo)));
  }

  async function hWaitFor(selector,{click=false,closest='',tries=14,delay=120}={}){
    for(let i=0;i<tries;i++){
      let el=document.querySelector(selector);
      if(el){
        if(closest)el=el.closest(closest)||el;
        try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(_e){}
        if(click){setTimeout(()=>{try{el.click()}catch(_e){}},80)}
        return el;
      }
      await new Promise(r=>setTimeout(r,delay));
    }
    return null;
  }

  function hMonthlyModule(){
    return core.monthlyKnowledgeV21037||core.monthlyKnowledgeV21036||core.monthlyKnowledgeV21035||null;
  }

  async function hCustomAction(action){
    if(action==='review-questions'){
      const mod=hMonthlyModule();
      if(mod?.review){mod.review();return true}
      return false;
    }
    if(action==='checklist-builder'){
      const tab=await hWaitFor('[data-cc-tab="builder"]',{tries:20,delay:150});
      if(tab){tab.click();await hWaitFor('#ccPanelBody',{tries:10});return true}
      return false;
    }
    if(action==='new-checklist'){
      const tab=await hWaitFor('[data-cc-tab="builder"]',{tries:20,delay:150});
      if(tab)tab.click();
      const add=await hWaitFor('[data-cc-new]',{tries:20,delay:150});
      if(add){add.click();return true}
      return false;
    }
    return false;
  }

  async function hGo(id){
    const a=ACTIONS.find(x=>x.id===id);
    if(!a)return;
    if(a.view&&!hCanView(a.view))return htoast('That area is not available for your current role.');
    try{
      if(a.view){
        if(typeof showView==='function')showView(a.view);
        else document.querySelector(`#mainNav button[data-view="${a.view}"]`)?.click();
      }
      await new Promise(r=>setTimeout(r,100));

      if(a.custom){
        const ok=await hCustomAction(a.custom);
        if(!ok)htoast('The destination is still loading. Open Help and try Go there again.');
        return;
      }

      if(a.click){
        const el=await hWaitFor(a.click,{click:true,tries:16,delay:120});
        if(!el)htoast('The destination is still loading. Open Help and try Go there again.');
        return;
      }

      if(a.anchor){
        const el=await hWaitFor(a.anchor,{closest:a.closest||'',tries:16,delay:120});
        if(!el)htoast('The destination is open, but that control is still loading.');
      }
    }catch(e){
      console.error('Role Help navigation',e);
      htoast('Could not open that area: '+(e?.message||e));
    }
  }

  const hRenderHelp=hRender;
  try{renderHelp=hRenderHelp}catch(_e){}
  window.renderHelp=hRenderHelp;

  document.addEventListener('click',e=>{
    const b=e.target.closest('#mainNav button[data-view="help"]');
    if(b)setTimeout(hRender,40);
  },true);

  const style=document.createElement('style');
  style.id='roleAwareHelpStylesV21038';
  style.textContent=`
    .role-help-shell{display:grid;gap:14px}
    .role-help-hero{display:grid;gap:14px;padding:16px;border:1px solid #d8e0e6;border-radius:14px;background:#f7fafc}
    .role-help-role{display:inline-flex;padding:5px 9px;border-radius:999px;background:#17324d;color:#fff;font-weight:800;font-size:.8rem}
    .role-help-hero h3{margin:8px 0 4px}.role-help-hero p{margin:0;color:#5f6f7f}
    .role-help-search-wrap{display:flex;gap:8px;align-items:center}.role-help-search-wrap input{flex:1;min-width:0}
    .role-help-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
    .role-help-action{border:1px solid #d8e0e6;border-radius:12px;padding:14px;background:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:12px}
    .role-help-action h3{margin:4px 0 5px;font-size:1rem}.role-help-action p{margin:0;color:#607182;line-height:1.45}
    .role-help-group{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;font-weight:800;color:#5b7185}
    .role-help-go{width:100%;min-height:42px}.role-help-note{margin:0}
    @media(max-width:640px){.role-help-grid{grid-template-columns:1fr}.role-help-search-wrap{align-items:stretch}.role-help-search-wrap .ghost{flex:0 0 auto}}
  `;
  document.head.appendChild(style);

  setTimeout(()=>{
    hApplyVersion();
    const active=document.querySelector('#helpView.active-view');
    if(active)hRender();
  },450);

  core.roleAwareHelpV21038={render:hRender,go:hGo,actions:ACTIONS};
})();

/* Safety Tracker v2.10.39 - unified Safety Actions dashboard */
(function(){
  const core=window.SafetyTrackerV2;
  if(!core||!core.state||!core.sb)return;

  const ast=core.state, asb=core.sb;
  const a$=id=>document.getElementById(id);
  const aesc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const aclean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const aIsManager=()=>ast.profile?.report_only!==true&&['admin','manager'].includes(String(ast.profile?.role||'').toLowerCase());
  const aPerson=id=>{
    const p=(ast.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||'Unassigned';
  };
  const aToday=()=>new Date().toISOString().slice(0,10);
  const aFmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
  const aFmtDateTime=v=>v?new Date(v).toLocaleString('en-GB'):'—';
  const aToast=msg=>{try{return (window.toast||core.toast)?.(msg)}catch(_e){console.log(msg)}};

  let aLoading=false,aActions=[],aCustomLoadedAt=0,aCustomRuns=[],aCustomItems=[],aKnowledgeRows=[];

  function aApplyVersion(){
    if(window.SAFETY_BUILD){
      window.SAFETY_BUILD.version='2.10.39';
      window.SAFETY_BUILD.label='2.10.39 CLEAN';
      window.SAFETY_BUILD.build='21039';
      try{window.applySafetyBuildLabel?.()}catch(_e){}
    }
    document.querySelectorAll('.build-badge').forEach(el=>el.textContent='Safety Tracker v2.10.39 CLEAN');
    document.querySelectorAll('.dashboard-version').forEach(el=>el.textContent='v2.10.39 CLEAN');
    document.querySelectorAll('.brand-line .version,.demo-brand-line .version').forEach(el=>el.textContent='v2.10.39');
  }
  [0,500,1400,2800].forEach(ms=>setTimeout(aApplyVersion,ms));
  document.addEventListener('DOMContentLoaded',aApplyVersion,{once:true});

  function aPriority(priority){return String(priority||'AMBER').toUpperCase()==='RED'?'RED':'AMBER'}
  function aAction(x){return {
    id:x.id||crypto.randomUUID(),
    type:x.type||'Other',
    title:x.title||'Safety action',
    detail:x.detail||'',
    owner:x.owner||'Manager / Admin',
    due:x.due||'',
    dueLabel:x.dueLabel||'',
    status:x.status||'Open',
    priority:aPriority(x.priority),
    go:x.go||{view:'compliance'},
    sortDate:x.sortDate||x.due||'9999-12-31'
  }}

  function aLatestPendingVersion(docId){
    return (ast.versions||[]).filter(v=>v.document_id===docId&&String(v.approval_status||'').toUpperCase()==='PENDING')
      .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;
  }

  function aCurrentApprovedVersion(docId){
    try{
      if(typeof approvedCurrentVersion==='function')return approvedCurrentVersion(docId);
    }catch(_e){}
    return (ast.versions||[]).filter(v=>v.document_id===docId&&String(v.approval_status||'').toUpperCase()==='APPROVED')
      .sort((a,b)=>new Date(b.issue_date||b.created_at||0)-new Date(a.issue_date||a.created_at||0))[0]||null;
  }

  function aDocTitle(d){
    try{if(typeof documentDisplayTitle==='function')return documentDisplayTitle(d)}catch(_e){}
    return d?.title||d?.name||d?.reference||'Document';
  }

  function aCoreActions(){
    const out=[];
    const today=aToday();

    // Controlled documents: keep high-volume approval work as one clear action.
    const activeDocs=(ast.documents||[]).filter(d=>d.status!=='ARCHIVED');
    const pendingDocs=activeDocs.map(d=>({d,v:aLatestPendingVersion(d.id)})).filter(x=>x.v);
    if(pendingDocs.length){
      const oldest=pendingDocs.map(x=>x.v.created_at).filter(Boolean).sort()[0]||'';
      out.push(aAction({
        id:'docs-pending',
        type:'Documents',
        title:`${pendingDocs.length} controlled document${pendingDocs.length===1?'':'s'} awaiting approval / acceptance`,
        detail:'Open Documents to review the current pending versions. This is grouped so a large document upload does not swamp the action list.',
        owner:'Manager / Admin',
        dueLabel:'Review required',
        status:'Pending approval',
        priority:'AMBER',
        sortDate:oldest,
        go:{view:'documents'}
      }));
    }

    const overdueDocs=[],dueSoonDocs=[];
    for(const d of activeDocs){
      const v=aCurrentApprovedVersion(d.id);
      if(!v?.review_date)continue;
      const rd=String(v.review_date).slice(0,10);
      const diff=(new Date(rd+'T12:00:00')-new Date(today+'T12:00:00'))/86400000;
      if(diff<0)overdueDocs.push({d,v});
      else if(diff<=30)dueSoonDocs.push({d,v});
    }
    for(const x of overdueDocs){
      out.push(aAction({
        id:'doc-review-'+x.d.id,
        type:'Documents',
        title:`Document review overdue · ${x.d.reference||aDocTitle(x.d)}`,
        detail:aDocTitle(x.d),
        owner:'Manager / Admin',
        due:x.v.review_date,
        status:'Review overdue',
        priority:'RED',
        go:{view:'documents',docId:x.d.id,search:x.d.reference||aDocTitle(x.d)}
      }));
    }
    if(dueSoonDocs.length){
      const earliest=dueSoonDocs.map(x=>x.v.review_date).sort()[0];
      out.push(aAction({
        id:'docs-review-soon',
        type:'Documents',
        title:`${dueSoonDocs.length} document review${dueSoonDocs.length===1?'':'s'} due within 30 days`,
        detail:'Current approved documents approaching their review date.',
        owner:'Manager / Admin',
        due:earliest,
        status:'Review due soon',
        priority:'AMBER',
        go:{view:'documents'}
      }));
    }

    // Training: individual when manageable, grouped when many.
    const overdueTraining=[];
    for(const a of (ast.trainingAssignments||[])){
      if(a.active===false)continue;
      const t=(ast.training||[]).find(x=>x.id===a.training_session_id);
      if(!t||t.status==='ARCHIVED')continue;
      let st=null;
      try{if(typeof assignmentStatus==='function')st=assignmentStatus(a,t)}catch(_e){}
      if(st?.code==='OVERDUE')overdueTraining.push({a,t,st});
    }
    if(overdueTraining.length>12){
      const earliest=overdueTraining.map(x=>x.st.due||x.a.due_date).filter(Boolean).sort()[0]||'';
      out.push(aAction({
        id:'training-overdue-group',
        type:'Training',
        title:`${overdueTraining.length} overdue training assignment${overdueTraining.length===1?'':'s'}`,
        detail:'Open Compliance to work through the overdue training list.',
        owner:'Multiple people',
        due:earliest,
        status:'Overdue',
        priority:'RED',
        go:{view:'compliance',status:'OVERDUE'}
      }));
    }else{
      overdueTraining.forEach(x=>out.push(aAction({
        id:'training-'+x.a.id,
        type:'Training',
        title:`Overdue training · ${x.t.reference?x.t.reference+' - ':''}${x.t.name||'Training'}`,
        detail:'Training renewal or completion is overdue.',
        owner:aPerson(x.a.user_id),
        due:x.st.due||x.a.due_date,
        status:'Overdue',
        priority:'RED',
        go:{view:'compliance',personId:x.a.user_id,status:'OVERDUE'}
      })));
    }

    // PPE failures / replacements.
    const ppeBad=new Set(['REPLACEMENT_REQUIRED','MISSING','BROKEN','DAMAGED','USED']);
    for(const item of (ast.ppeCheckItems||[])){
      if(!ppeBad.has(String(item.result||'').toUpperCase()))continue;
      if(['RESOLVED','NOT_REQUIRED'].includes(String(item.action_status||'OPEN').toUpperCase()))continue;
      const check=(ast.ppeChecks||[]).find(x=>x.id===item.check_id);
      const red=['REPLACEMENT_REQUIRED','MISSING','BROKEN','DAMAGED'].includes(String(item.result||'').toUpperCase());
      out.push(aAction({
        id:'ppe-'+item.id,
        type:'PPE',
        title:`PPE action · ${item.ppe_name_snapshot||'PPE item'}`,
        detail:`${String(item.result||'Issue').replaceAll('_',' ')}${item.comment?' · '+item.comment:''}`,
        owner:aPerson(check?.user_id),
        due:check?.due_date,
        dueLabel:check?.due_date?'':'Action now',
        status:item.action_status||'OPEN',
        priority:red?'RED':'AMBER',
        go:{view:'ppe',clickSelectors:[`[data-ppe-action="${item.id}"]`,`[data-update-ppe-action="${item.id}"]`]}
      }));
    }

    // Outstanding PPE checks themselves.
    for(const check of (ast.ppeChecks||[])){
      if(check.submitted_at)continue;
      if(!check.due_date)continue;
      const overdue=String(check.due_date).slice(0,10)<today;
      out.push(aAction({
        id:'ppe-check-'+check.id,
        type:'PPE',
        title:`Monthly PPE check ${overdue?'overdue':'due'}`,
        detail:'Monthly PPE inspection has not been submitted.',
        owner:aPerson(check.user_id),
        due:check.due_date,
        status:overdue?'Overdue':'Due',
        priority:overdue?'RED':'AMBER',
        go:{view:'ppe'}
      }));
    }

    // First Aid failures / replenishment.
    const faBad=new Set(['LOW','MISSING','EXPIRED','DAMAGED']);
    for(const item of (ast.firstAidCheckItems||[])){
      if(!faBad.has(String(item.result||'').toUpperCase()))continue;
      if(['REPLENISHED','NOT_REQUIRED'].includes(String(item.action_status||'OPEN').toUpperCase()))continue;
      const check=(ast.firstAidChecks||[]).find(x=>x.id===item.check_id);
      const box=(ast.firstAidBoxes||[]).find(x=>x.id===check?.box_id);
      const red=['MISSING','EXPIRED','DAMAGED'].includes(String(item.result||'').toUpperCase());
      out.push(aAction({
        id:'fa-'+item.id,
        type:'First Aid',
        title:`First Aid action · ${item.item_name_snapshot||'First Aid item'}`,
        detail:`${box?.name||'First Aid box'} · ${String(item.result||'Issue').replaceAll('_',' ')}`,
        owner:aPerson(item.assigned_user_id||check?.assigned_user_id),
        due:check?.due_date,
        dueLabel:check?.due_date?'':'Replenish / resolve',
        status:item.action_status||'OPEN',
        priority:red?'RED':'AMBER',
        go:{view:'firstAid',clickSelectors:[`[data-first-aid-order="${item.id}"]`]}
      }));
    }

    // Due First Aid box checks.
    for(const check of (ast.firstAidChecks||[])){
      if(check.submitted_at||String(check.status||'').toUpperCase()!=='DUE')continue;
      const box=(ast.firstAidBoxes||[]).find(x=>x.id===check.box_id);
      const overdue=check.due_date&&String(check.due_date).slice(0,10)<today;
      out.push(aAction({
        id:'fa-check-'+check.id,
        type:'First Aid',
        title:`First Aid box check ${overdue?'overdue':'due'} · ${box?.name||'First Aid box'}`,
        detail:box?.location||'Monthly First Aid check',
        owner:aPerson(check.assigned_user_id),
        due:check.due_date,
        status:overdue?'Overdue':'Due',
        priority:overdue?'RED':'AMBER',
        go:{view:'firstAid'}
      }));
    }

    // PTW / contractor actions.
    for(const p of (ast.contractorPermits||[])){
      const company=p.contractor_company||'Contractor';
      const job=aclean(p.work_description||'Contractor work');
      if(p.status==='AWAITING_APPROVAL'){
        const late=!!(p.expected_start&&new Date(p.expected_start)<new Date());
        out.push(aAction({
          id:'ptw-approve-'+p.id,
          type:'PTW',
          title:`PTW awaiting Maintenance approval · ${company}`,
          detail:job,
          owner:'Maintenance',
          dueLabel:p.expected_start?aFmtDateTime(p.expected_start):'Before work starts',
          status:'Awaiting approval',
          priority:late?'RED':'AMBER',
          sortDate:p.expected_start||p.created_at,
          go:{view:'onsite',clickSelectors:[`[data-permit-approve="${p.id}"]`,`[data-permit-view="${p.id}"]`]}
        }));
      }
      if(p.status==='ACTIVE'&&p.expected_finish&&new Date(p.expected_finish)<new Date()){
        out.push(aAction({
          id:'ptw-overdue-'+p.id,
          type:'PTW',
          title:`Contractor over expected finish · ${company}`,
          detail:job,
          owner:'Maintenance',
          dueLabel:aFmtDateTime(p.expected_finish),
          status:'Check contractor status',
          priority:'RED',
          sortDate:p.expected_finish,
          go:{view:'onsite',clickSelectors:[`[data-permit-view="${p.id}"]`]}
        }));
      }
      if(p.status==='AWAITING_CLOSE'){
        out.push(aAction({
          id:'ptw-close-'+p.id,
          type:'PTW',
          title:`Contractor visit awaiting close-out · ${company}`,
          detail:job+(p.access_key_issued_at&&!p.access_key_returned_at?' · Key/card still outstanding':''),
          owner:'Maintenance',
          dueLabel:'Close-out required',
          status:'Awaiting close',
          priority:p.access_key_issued_at&&!p.access_key_returned_at?'RED':'AMBER',
          sortDate:p.contractor_signout_at||p.updated_at||p.created_at,
          go:{view:'onsite',clickSelectors:[`[data-permit-close="${p.id}"]`,`[data-permit-view="${p.id}"]`]}
        }));
      }
    }
    return out;
  }

  async function aLoadCustom(){
    if(Date.now()-aCustomLoadedAt<30000)return;
    aCustomLoadedAt=Date.now();
    try{
      const [runs,items]=await Promise.all([
        asb.from('custom_checklist_runs_v21032').select('*').order('due_date',{ascending:true}).limit(300),
        asb.from('custom_checklist_run_items_v21032').select('*').eq('is_issue',true).order('created_at',{ascending:false}).limit(1000)
      ]);
      if(runs.error)throw runs.error;
      if(items.error)throw items.error;
      aCustomRuns=runs.data||[];
      aCustomItems=items.data||[];
    }catch(e){
      console.warn('Unified Safety Actions custom checklist load',e);
      aCustomRuns=[];aCustomItems=[];
    }
  }

  async function aLoadKnowledge(){
    try{
      const r=await asb.rpc('monthly_knowledge_team_status_v21035');
      aKnowledgeRows=r.error?[]:(r.data||[]);
    }catch(_e){aKnowledgeRows=[]}
  }

  function aExtraActions(){
    const out=[],today=aToday();
    const runMap=new Map(aCustomRuns.map(r=>[r.id,r]));

    for(const run of aCustomRuns){
      if(run.submitted_at||String(run.status||'').toUpperCase()!=='DUE')continue;
      const overdue=!!(run.due_date&&String(run.due_date).slice(0,10)<today);
      out.push(aAction({
        id:'custom-run-'+run.id,
        type:'Checklist',
        title:`Custom checklist ${overdue?'overdue':'due'} · ${run.template_name_snapshot||'Checklist'}`,
        detail:run.location_snapshot||'Recurring safety check',
        owner:aPerson(run.assigned_user_id),
        due:run.due_date,
        status:overdue?'Overdue':'Due',
        priority:overdue?'RED':'AMBER',
        go:{view:'checklists',clickSelectors:[`[data-cc-open-run="${run.id}"]`]}
      }));
    }

    for(const item of aCustomItems){
      if(['RESOLVED','NOT_REQUIRED'].includes(String(item.action_status||'OPEN').toUpperCase()))continue;
      const run=runMap.get(item.run_id);
      const overdue=!!(run?.due_date&&String(run.due_date).slice(0,10)<today);
      out.push(aAction({
        id:'custom-action-'+item.id,
        type:'Checklist',
        title:`Checklist action · ${item.item_label_snapshot||'Safety check issue'}`,
        detail:`${run?.template_name_snapshot||'Custom checklist'}${item.action_label?' · '+item.action_label:item.note?' · '+item.note:''}`,
        owner:aPerson(run?.assigned_user_id),
        due:run?.due_date,
        dueLabel:run?.due_date?'':'Action required',
        status:item.action_status||'OPEN',
        priority:overdue?'RED':'AMBER',
        go:{view:'checklists',clickSelectors:[`[data-cc-action="${item.id}"]`]}
      }));
    }

    for(const row of aKnowledgeRows){
      if(row.status!=='OVERDUE')continue;
      out.push(aAction({
        id:'knowledge-'+row.user_id,
        type:'Knowledge',
        title:'Monthly Knowledge Check overdue',
        detail:`${Number(row.questions_required||3)} ${String(row.difficulty||'MIXED').toLowerCase()} question${Number(row.questions_required||3)===1?'':'s'} required.`,
        owner:row.display_name||aPerson(row.user_id),
        dueLabel:'Previous month missed',
        status:'Overdue',
        priority:'RED',
        go:{view:'compliance',anchor:'[id^="monthlyKnowledgeComplianceCardV"]'}
      }));
    }
    return out;
  }

  function aSort(rows){
    return rows.sort((a,b)=>{
      const pa=a.priority==='RED'?0:1,pb=b.priority==='RED'?0:1;
      if(pa!==pb)return pa-pb;
      const da=String(a.sortDate||''),db=String(b.sortDate||'');
      if(da!==db)return da.localeCompare(db);
      return String(a.type).localeCompare(String(b.type));
    });
  }

  async function aCollect(){
    await Promise.all([aLoadCustom(),aLoadKnowledge()]);
    return aSort([...aCoreActions(),...aExtraActions()]);
  }

  function aDueText(a){
    if(a.dueLabel)return a.dueLabel;
    return a.due?`Due ${aFmtDate(a.due)}`:'No fixed date';
  }

  function aRowHtml(a){
    const tr=a.priority==='RED'?'red':'amber';
    return `<div class="item-card compact safety-action-row traffic-${tr}" data-action-priority="${a.priority}" data-action-type="${aesc(a.type)}" data-action-search="${aesc((a.type+' '+a.title+' '+a.detail+' '+a.owner+' '+a.status).toLowerCase())}">
      <div class="row-between safety-action-row-head">
        <div><span class="safety-action-type">${aesc(a.type)}</span><strong>${aesc(a.title)}</strong><div class="muted">${aesc(a.detail)}</div></div>
        <span class="badge ${tr==='red'?'overdue':'due'}">${a.priority==='RED'?'High':'Action'}</span>
      </div>
      <div class="safety-action-meta"><span><b>Owner:</b> ${aesc(a.owner)}</span><span><b>When:</b> ${aesc(aDueText(a))}</span><span><b>Status:</b> ${aesc(a.status)}</span></div>
      <div class="actions"><button type="button" class="primary small" data-safety-action-go="${aesc(a.id)}">Go there</button></div>
    </div>`;
  }

  function aFilter(){
    const card=a$('unifiedSafetyActionsCardV21039');if(!card)return;
    const priority=String(a$('safetyActionPriorityFilter')?.value||'ALL');
    const type=String(a$('safetyActionTypeFilter')?.value||'ALL');
    const q=String(a$('safetyActionSearch')?.value||'').trim().toLowerCase();
    let shown=0;
    card.querySelectorAll('.safety-action-row').forEach(row=>{
      const okP=priority==='ALL'||row.dataset.actionPriority===priority;
      const okT=type==='ALL'||row.dataset.actionType===type;
      const okQ=!q||String(row.dataset.actionSearch||'').includes(q);
      row.hidden=!(okP&&okT&&okQ);if(okP&&okT&&okQ)shown++;
    });
    const none=a$('safetyActionNoMatches');if(none)none.hidden=shown!==0;
  }

  async function aRender(){
    if(!aIsManager()||aLoading)return;
    const view=a$('complianceView');if(!view)return;
    let card=a$('unifiedSafetyActionsCardV21039');
    if(!card){
      card=document.createElement('section');
      card.id='unifiedSafetyActionsCardV21039';
      card.className='section-card';
      const stats=a$('complianceStats');
      stats?.insertAdjacentElement('afterend',card)||view.prepend(card);
    }
    aLoading=true;
    try{
      card.innerHTML='<div class="muted">Loading unified Safety Actions…</div>';
      aActions=await aCollect();
      const red=aActions.filter(x=>x.priority==='RED').length,amber=aActions.filter(x=>x.priority==='AMBER').length;
      const types=[...new Set(aActions.map(x=>x.type))].sort();
      card.innerHTML=`<div class="row-between"><div><h3>Safety Actions</h3><p class="muted">One place for open safety work from documents, training, PPE, First Aid, checklists, contractor permits and monthly knowledge checks.</p></div><button id="refreshSafetyActionsBtn" type="button" class="secondary small">Refresh</button></div>
        <div class="stats-grid safety-action-stats">
          <div class="stat traffic-red"><strong>${red}</strong><span>High priority</span></div>
          <div class="stat traffic-amber"><strong>${amber}</strong><span>Action required</span></div>
          <div class="stat traffic-${aActions.length?'amber':'green'}"><strong>${aActions.length}</strong><span>Total open actions</span></div>
        </div>
        <div class="safety-action-filters">
          <label>Priority<select id="safetyActionPriorityFilter"><option value="ALL">All</option><option value="RED">High / red</option><option value="AMBER">Action / amber</option></select></label>
          <label>Type<select id="safetyActionTypeFilter"><option value="ALL">All types</option>${types.map(x=>`<option value="${aesc(x)}">${aesc(x)}</option>`).join('')}</select></label>
          <label class="safety-action-search-label">Search<input id="safetyActionSearch" type="search" placeholder="Person, document, checklist, PTW…"></label>
        </div>
        <div id="safetyActionNoMatches" class="hint-box" hidden>No matching open safety actions.</div>
        <div id="safetyActionList" class="card-list">${aActions.length?aActions.map(aRowHtml).join(''):'<div class="success-note"><strong>No open safety actions.</strong> Everything currently tracked here is clear.</div>'}</div>`;

      a$('refreshSafetyActionsBtn')?.addEventListener('click',async()=>{aCustomLoadedAt=0;await aRenderForce()});
      ['safetyActionPriorityFilter','safetyActionTypeFilter','safetyActionSearch'].forEach(id=>a$(id)?.addEventListener('input',aFilter));
      card.querySelectorAll('[data-safety-action-go]').forEach(b=>b.addEventListener('click',()=>aGo(b.dataset.safetyActionGo)));
      aRenderShortcut();
    }catch(e){
      card.innerHTML=`<div class="danger-note"><strong>Safety Actions could not load.</strong><br>${aesc(e?.message||e)}</div>`;
    }finally{aLoading=false}
  }

  async function aRenderForce(){
    aLoading=false;
    return aRender();
  }

  function aRenderShortcut(){
    if(!aIsManager())return;
    const view=a$('mySafetyView');if(!view)return;
    let box=a$('safetyActionsShortcutV21039');
    if(!box){
      box=document.createElement('div');box.id='safetyActionsShortcutV21039';
      const anchor=a$('mySafetyStats');anchor?.insertAdjacentElement('afterend',box)||view.prepend(box);
    }
    const red=aActions.filter(x=>x.priority==='RED').length,amber=aActions.filter(x=>x.priority==='AMBER').length;
    const tr=red?'red':amber?'amber':'green';
    const summary=red?`${red} high-priority · ${amber} other action${amber===1?'':'s'}`:amber?`${amber} action${amber===1?'':'s'} requiring attention`:'No open safety actions';
    box.innerHTML=`<button type="button" class="my-safety-onsite-button traffic-${tr}" id="openSafetyActionsBtnV21039"><span class="onsite-shortcut-main"><strong>Safety Actions</strong><span>${aesc(summary)}</span></span><span class="onsite-shortcut-status">${aActions.length}</span><span class="onsite-shortcut-action">Open</span></button>`;
    a$('openSafetyActionsBtnV21039')?.addEventListener('click',async()=>{
      try{if(typeof showView==='function')showView('compliance');else document.querySelector('#mainNav button[data-view="compliance"]')?.click()}catch(_e){}
      setTimeout(()=>a$('unifiedSafetyActionsCardV21039')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
    });
  }

  async function aWaitClick(selectors){
    for(let i=0;i<18;i++){
      for(const sel of selectors||[]){
        const el=document.querySelector(sel);
        if(el){try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(_e){};setTimeout(()=>el.click(),70);return true}
      }
      await new Promise(r=>setTimeout(r,120));
    }
    return false;
  }

  async function aGo(id){
    const a=aActions.find(x=>x.id===id);if(!a)return;
    const go=a.go||{};
    try{
      if(go.view){
        if(typeof showView==='function')showView(go.view);
        else document.querySelector(`#mainNav button[data-view="${go.view}"]`)?.click();
      }
      await new Promise(r=>setTimeout(r,120));

      if(go.search&&go.view==='documents'){
        const input=a$('documentSearch');
        if(input){input.value=go.search;input.dispatchEvent(new Event('input',{bubbles:true}))}
      }
      if(go.personId&&go.view==='compliance'){
        const p=a$('compliancePersonFilter');if(p){p.value=go.personId;p.dispatchEvent(new Event('input',{bubbles:true}))}
        const s=a$('complianceStatusFilter');if(s&&go.status){s.value=go.status;s.dispatchEvent(new Event('input',{bubbles:true}))}
      }else if(go.status&&go.view==='compliance'){
        const s=a$('complianceStatusFilter');if(s){s.value=go.status;s.dispatchEvent(new Event('input',{bubbles:true}))}
      }
      if(go.anchor){
        for(let i=0;i<15;i++){
          const el=document.querySelector(go.anchor);
          if(el){el.scrollIntoView({behavior:'smooth',block:'center'});return}
          await new Promise(r=>setTimeout(r,100));
        }
      }
      if(go.clickSelectors?.length){
        const clicked=await aWaitClick(go.clickSelectors);
        if(clicked)return;
      }
      if(go.view==='compliance'&&a$('unifiedSafetyActionsCardV21039'))a$('unifiedSafetyActionsCardV21039').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){aToast('Could not open action: '+(e?.message||e))}
  }

  function aAddHelpAction(){
    const mod=core.roleAwareHelpV21038;
    if(!mod?.actions||mod.actions.some(x=>x.id==='safety-actions'))return;
    mod.actions.push({
      id:'safety-actions',
      roles:['manager','admin'],
      group:'Management',
      title:'Safety Actions',
      desc:'Open the unified list of document, training, PPE, First Aid, checklist, PTW and knowledge actions.',
      view:'compliance',
      anchor:'#unifiedSafetyActionsCardV21039',
      keywords:'safety actions priorities red amber overdue ppe first aid checklist permit ptw documents training'
    });
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('#mainNav button[data-view]');
    if(!b)return;
    if(b.dataset.view==='compliance')setTimeout(aRender,60);
    if(b.dataset.view==='mySafety')setTimeout(async()=>{if(!aActions.length)await aRender();else aRenderShortcut()},80);
  },true);

  window.addEventListener('pageshow',()=>setTimeout(()=>{if(a$('complianceView')?.classList.contains('active-view'))aRenderForce()},150));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&a$('complianceView')?.classList.contains('active-view'))setTimeout(aRenderForce,180)});

  const style=document.createElement('style');
  style.id='unifiedSafetyActionsStylesV21039';
  style.textContent=`
    #unifiedSafetyActionsCardV21039{scroll-margin-top:10px}
    .safety-action-stats{margin-top:12px}
    .safety-action-filters{display:grid;grid-template-columns:180px 220px minmax(220px,1fr);gap:10px;margin:14px 0}
    .safety-action-filters label{margin:0}.safety-action-search-label{min-width:0}
    .safety-action-row{border-left-width:5px}.safety-action-row-head{align-items:flex-start;gap:10px}
    .safety-action-row-head>div{min-width:0}.safety-action-row-head strong{display:block;margin:4px 0}
    .safety-action-type{display:inline-flex;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#5d7284}
    .safety-action-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:.86rem;color:#4f6170}
    #safetyActionsShortcutV21039{margin-top:10px}
    @media(max-width:720px){.safety-action-filters{grid-template-columns:1fr}.safety-action-row-head{display:block}.safety-action-row-head .badge{display:inline-flex;margin-top:7px}}
  `;
  document.head.appendChild(style);

  setTimeout(()=>{
    aAddHelpAction();
    if(aIsManager()){
      aRender().then(aRenderShortcut);
    }
    aApplyVersion();
  },750);

  core.unifiedSafetyActionsV21039={render:aRenderForce,go:aGo,get actions(){return aActions}};
})();

/* Safety Tracker v2.10.40 - automatic document-change impact review */
(function(){
  const core=window.SafetyTrackerV2;
  if(!core||!core.state||!core.sb)return;

  const ist=core.state, isb=core.sb;
  const i$=id=>document.getElementById(id);
  const iesc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const iclean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const iIsManager=()=>ist.profile?.report_only!==true&&['admin','manager'].includes(String(ist.profile?.role||'').toLowerCase());
  const iPerson=id=>{
    const p=(ist.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||'Unknown user';
  };
  const iToast=msg=>{try{return (window.toast||core.toast)?.(msg)}catch(_e){console.log(msg)}};
  const BUILD_START='2026-09-18T00:00:00Z';
  let iBusy=false,iReviews=[],iCandidates=[];

  function iApplyVersion(){
    if(window.SAFETY_BUILD){
      window.SAFETY_BUILD.version='2.10.40';
      window.SAFETY_BUILD.label='2.10.40 CLEAN';
      window.SAFETY_BUILD.build='21040';
      try{window.applySafetyBuildLabel?.()}catch(_e){}
    }
    document.querySelectorAll('.build-badge').forEach(el=>el.textContent='Safety Tracker v2.10.40 CLEAN');
    document.querySelectorAll('.dashboard-version').forEach(el=>el.textContent='v2.10.40 CLEAN');
    document.querySelectorAll('.brand-line .version,.demo-brand-line .version').forEach(el=>el.textContent='v2.10.40');
  }
  [0,500,1600,3200].forEach(ms=>setTimeout(iApplyVersion,ms));
  document.addEventListener('DOMContentLoaded',iApplyVersion,{once:true});

  function iDocTitle(d){
    try{if(typeof documentDisplayTitle==='function')return documentDisplayTitle(d)}catch(_e){}
    return d?.title||d?.name||d?.reference||'Document';
  }
  function iTypeLabel(d){
    const m={RISK_ASSESSMENT:'RA',COSHH:'COSHH RA',SSW:'SSW',SDS:'SDS / MSDS',TOOLBOX_TALK:'Toolbox Talk'};
    return m[d?.doc_type]||String(d?.doc_type||'Document').replaceAll('_',' ');
  }
  function iApproval(v){return String(v?.approval_status||'').toUpperCase()}
  function iVersionTime(v){return v?.approval_at||v?.approved_at||v?.created_at||''}
  function iSortedVersions(docId){
    return (ist.versions||[]).filter(v=>v.document_id===docId).sort((a,b)=>new Date(iVersionTime(b)||0)-new Date(iVersionTime(a)||0));
  }
  function iApprovedCurrent(docId){
    try{if(typeof approvedCurrentVersion==='function')return approvedCurrentVersion(docId)}catch(_e){}
    return iSortedVersions(docId).find(v=>iApproval(v)==='APPROVED'&&v.status==='CURRENT')||
      iSortedVersions(docId).find(v=>iApproval(v)==='APPROVED')||null;
  }
  function iPending(docId){
    return iSortedVersions(docId).find(v=>iApproval(v)==='PENDING')||null;
  }
  function iHasOlderApproved(docId,versionId){
    return iSortedVersions(docId).some(v=>v.id!==versionId&&iApproval(v)==='APPROVED');
  }
  function iDirectLinks(docId){
    return (ist.documentLinks||[]).filter(l=>l.source_document_id===docId||l.target_document_id===docId);
  }
  function iOtherDoc(link,docId){
    const other=link.source_document_id===docId?link.target_document_id:link.source_document_id;
    return (ist.documents||[]).find(d=>d.id===other)||null;
  }
  function iTrainingForDocument(docId){
    const ids=new Set();
    (ist.training||[]).forEach(t=>{
      if(t.status==='ARCHIVED')return;
      if(t.source_document_id===docId)ids.add(t.id);
    });
    (ist.trainingDocumentLinks||[]).forEach(l=>{
      if(l.document_id===docId)ids.add(l.training_session_id);
    });
    return [...ids].map(id=>(ist.training||[]).find(t=>t.id===id)).filter(t=>t&&t.status!=='ARCHIVED');
  }
  function iAssignmentsForTraining(trainingIds){
    const set=new Set(trainingIds);
    return (ist.trainingAssignments||[]).filter(a=>a.active!==false&&set.has(a.training_session_id));
  }
  function iArr(v){return [...new Set((v||[]).filter(Boolean).map(String))].sort()}
  function iEqualArr(a,b){
    const aa=iArr(a),bb=iArr(b);
    return aa.length===bb.length&&aa.every((x,n)=>x===bb[n]);
  }
  function iSnapshotFor(doc,version,linkedDocs,training,assignments){
    return {
      source_document_id:doc.id,
      source_reference:doc.reference||'',
      source_title:iDocTitle(doc),
      source_version_id:version.id,
      source_version_label:version.version_label||'',
      linked_document_ids:iArr(linkedDocs.map(x=>x.id)),
      training_session_ids:iArr(training.map(x=>x.id)),
      active_assignment_ids:iArr(assignments.map(x=>x.id)),
      generated_at:new Date().toISOString()
    };
  }
  function iReviewFor(versionId){return iReviews.find(r=>r.source_version_id===versionId)||null}
  function iReviewCurrent(review,snapshot){
    const old=review?.impact_snapshot||{};
    return !!review&&
      iEqualArr(old.linked_document_ids,snapshot.linked_document_ids)&&
      iEqualArr(old.training_session_ids,snapshot.training_session_ids)&&
      iEqualArr(old.active_assignment_ids,snapshot.active_assignment_ids);
  }

  function iCandidate(doc,version,stage){
    const links=iDirectLinks(doc.id);
    const linkedDocs=links.map(l=>iOtherDoc(l,doc.id)).filter(d=>d&&d.status!=='ARCHIVED');
    const training=iTrainingForDocument(doc.id);
    const assignments=iAssignmentsForTraining(training.map(t=>t.id));
    const snapshot=iSnapshotFor(doc,version,linkedDocs,training,assignments);
    const review=iReviewFor(version.id);
    const current=iReviewCurrent(review,snapshot);
    const staleTraining=stage==='APPROVED'&&training.filter(t=>t.source_document_id===doc.id&&t.source_document_version_id&&t.source_document_version_id!==version.id);
    return {doc,version,stage,links,linkedDocs,training,assignments,snapshot,review,current,staleTraining};
  }

  function iCollect(){
    const out=[];
    for(const doc of (ist.documents||[]).filter(d=>d.status!=='ARCHIVED')){
      const pending=iPending(doc.id);
      if(pending&&iHasOlderApproved(doc.id,pending.id)){
        out.push(iCandidate(doc,pending,'PENDING'));
        continue;
      }
      const current=iApprovedCurrent(doc.id);
      if(!current||!iHasOlderApproved(doc.id,current.id))continue;
      const when=iVersionTime(current);
      if(!when||new Date(when)<new Date(BUILD_START))continue;
      out.push(iCandidate(doc,current,'APPROVED'));
    }
    return out.sort((a,b)=>{
      const ao=a.staleTraining.length?0:a.current?2:1,bo=b.staleTraining.length?0:b.current?2:1;
      if(ao!==bo)return ao-bo;
      return String(a.doc.reference||iDocTitle(a.doc)).localeCompare(String(b.doc.reference||iDocTitle(b.doc)),undefined,{numeric:true});
    });
  }

  async function iLoadReviews(){
    const r=await isb.from('document_change_impact_reviews_v21040').select('*').order('reviewed_at',{ascending:false});
    if(r.error)throw r.error;
    iReviews=r.data||[];
  }

  function iState(c){
    if(c.staleTraining.length)return {traffic:'red',label:'Training source mismatch',open:true};
    if(c.current)return {traffic:'green',label:c.review.outcome==='FOLLOW_UP_REQUIRED'?'Reviewed · follow-up recorded':'Impact reviewed',open:false};
    if(!c.linkedDocs.length&&!c.training.length)return {traffic:'green',label:'No linked impact found',open:false};
    return {traffic:'amber',label:c.stage==='PENDING'?'Review before approval':'Impact review required',open:true};
  }

  function iImpactCount(c){
    return c.linkedDocs.length+c.training.length;
  }

  function iCard(c){
    const st=iState(c);
    const linked=c.linkedDocs.slice(0,5).map(d=>`<span class="impact-chip">${iesc(d.reference||iTypeLabel(d))} · ${iesc(iDocTitle(d))}</span>`).join('');
    const train=c.training.slice(0,5).map(t=>`<span class="impact-chip">${iesc(t.reference||'Training')} · ${iesc(t.name||'Training')}</span>`).join('');
    const moreDocs=Math.max(0,c.linkedDocs.length-5),moreTrain=Math.max(0,c.training.length-5);
    return `<div class="item-card document-impact-card traffic-${st.traffic}" data-impact-version="${iesc(c.version.id)}">
      <div class="row-between">
        <div>
          <div class="impact-source-line"><span class="badge">${iesc(iTypeLabel(c.doc))}</span><strong>${iesc(c.doc.reference||'No reference')} · ${iesc(iDocTitle(c.doc))}</strong></div>
          <div class="meta"><span>Replacement v${iesc(c.version.version_label||'—')}</span><span>${c.stage==='PENDING'?'Pending approval / acceptance':'Approved/current replacement'}</span><span>${iImpactCount(c)} linked impact${iImpactCount(c)===1?'':'s'}</span><span>${c.assignments.length} active assignment${c.assignments.length===1?'':'s'}</span></div>
        </div>
        <span class="badge ${st.traffic==='red'?'overdue':st.traffic==='amber'?'due':'complete'}">${iesc(st.label)}</span>
      </div>
      ${c.staleTraining.length?`<div class="danger-note compact"><strong>Training still points to an older document version.</strong> Review/synchronise before relying on the new approved version.</div>`:''}
      ${c.linkedDocs.length?`<div class="impact-block"><strong>Direct linked documents</strong><div class="impact-chip-list">${linked}${moreDocs?`<span class="impact-chip">+${moreDocs} more</span>`:''}</div></div>`:'<div class="muted impact-empty">No direct linked documents.</div>'}
      ${c.training.length?`<div class="impact-block"><strong>Training affected</strong><div class="impact-chip-list">${train}${moreTrain?`<span class="impact-chip">+${moreTrain} more</span>`:''}</div></div>`:'<div class="muted impact-empty">No linked/current training sessions.</div>'}
      ${c.current&&c.review?.review_note?`<div class="success-note compact"><strong>Review note:</strong> ${iesc(c.review.review_note)}<br><span class="muted">${iesc(iPerson(c.review.reviewed_by))} · ${new Date(c.review.reviewed_at).toLocaleString('en-GB')}</span></div>`:''}
      <div class="actions">
        <button type="button" class="secondary" data-impact-open-source="${iesc(c.version.id)}">Open replacement PDF</button>
        <button type="button" class="secondary" data-impact-open-links="${iesc(c.doc.id)}">Open direct links</button>
        ${c.training.length?`<button type="button" class="secondary" data-impact-open-training="${iesc(c.training[0].id)}">Open affected training</button>`:''}
        ${(st.open||c.current)&&iImpactCount(c)>0?`<button type="button" class="${st.open?'primary':'ghost'}" data-impact-review="${iesc(c.version.id)}">${c.current?'Review again':'Review impact'}</button>`:''}
      </div>
    </div>`;
  }

  function iRenderPanel(){
    if(!iIsManager())return;
    const holder=i$('documentApprovalOverview')?.querySelector('.section-card');
    if(!holder)return;
    let panel=i$('documentChangeImpactPanelV21040');
    if(!panel){
      panel=document.createElement('div');
      panel.id='documentChangeImpactPanelV21040';
      const pending=i$('pendingApprovalPanel');
      pending?.insertAdjacentElement('afterend',panel)||holder.appendChild(panel);
    }
    const open=iCandidates.filter(c=>iState(c).open);
    const reviewed=iCandidates.filter(c=>c.current);
    const noImpact=iCandidates.filter(c=>!iState(c).open&&!c.current);
    panel.innerHTML=`<div class="impact-heading">
      <div><h3>Document Change Impact</h3><p class="muted">Replacement versions are checked automatically against <strong>direct document links</strong>, linked training and active assignments. Links are pairwise only — the app does not create indirect/cascading relationships.</p></div>
      <div class="impact-counts"><span class="badge ${open.some(c=>iState(c).traffic==='red')?'overdue':open.length?'due':'complete'}">${open.length} to review</span><span class="badge complete">${reviewed.length} reviewed</span></div>
    </div>
    ${iCandidates.length?`<div class="card-list document-impact-list">${iCandidates.map(iCard).join('')}</div>`:'<div class="success-note"><strong>No replacement-version impact reviews are currently due.</strong> New versions will appear here automatically when a document already has an approved version.</div>'}
    ${noImpact.length?`<div class="muted impact-footnote">${noImpact.length} replacement${noImpact.length===1?' has':'s have'} no direct linked document or training impact identified.</div>`:''}`;

    panel.querySelectorAll('[data-impact-open-source]').forEach(b=>b.addEventListener('click',()=>{
      const fake=document.createElement('button');fake.dataset.openDoc=b.dataset.impactOpenSource;fake.style.display='none';document.body.appendChild(fake);fake.click();fake.remove();
    }));
    panel.querySelectorAll('[data-impact-open-links]').forEach(b=>b.addEventListener('click',()=>{
      const fake=document.createElement('button');fake.dataset.docLinks=b.dataset.impactOpenLinks;fake.style.display='none';document.body.appendChild(fake);fake.click();fake.remove();
    }));
    panel.querySelectorAll('[data-impact-open-training]').forEach(b=>b.addEventListener('click',()=>{
      const fake=document.createElement('button');fake.dataset.viewTraining=b.dataset.impactOpenTraining;fake.style.display='none';document.body.appendChild(fake);fake.click();fake.remove();
    }));
    panel.querySelectorAll('[data-impact-review]').forEach(b=>b.addEventListener('click',()=>iOpenReview(b.dataset.impactReview)));
  }

  function iOpenReview(versionId){
    const c=iCandidates.find(x=>x.version.id===versionId);
    if(!c)return;
    const docs=c.linkedDocs.length?c.linkedDocs.map(d=>`<div class="qa-row"><span><strong>${iesc(d.reference||iTypeLabel(d))}</strong> · ${iesc(iDocTitle(d))}</span><span>${iesc(iTypeLabel(d))}</span></div>`).join(''):'<div class="muted">No direct linked documents.</div>';
    const training=c.training.length?c.training.map(t=>{
      const assigned=(ist.trainingAssignments||[]).filter(a=>a.active!==false&&a.training_session_id===t.id).length;
      return `<div class="qa-row"><span><strong>${iesc(t.reference||'Training')}</strong> · ${iesc(t.name||'Training')}</span><span>${assigned} assigned</span></div>`;
    }).join(''):'<div class="muted">No linked training.</div>';
    const note=c.review?.review_note||'';
    const html=`<div class="hint-box"><strong>Replacement version:</strong> ${iesc(c.doc.reference||'')} · ${iesc(iDocTitle(c.doc))} · v${iesc(c.version.version_label||'—')}<br>${c.stage==='PENDING'?'The existing approved version remains in use until this replacement is approved.':'This replacement is now approved/current.'}</div>
      <div class="section-card compact"><h4>Direct linked documents</h4>${docs}</div>
      <div class="section-card compact"><h4>Affected training</h4>${training}</div>
      ${c.staleTraining.length?`<div class="danger-note"><strong>${c.staleTraining.length} training source${c.staleTraining.length===1?' is':'s are'} still tied to an older version.</strong> Use the normal document/training sync controls before closing the follow-up.</div>`:''}
      <label>Review note<textarea id="impactReviewNoteV21040" rows="4" placeholder="Optional for no change; explain the follow-up if action is required.">${iesc(note)}</textarea></label>
      <div class="review-confirm-box"><label class="check-row"><input id="impactReviewAckV21040" type="checkbox"> I have reviewed the direct linked documents and training shown above against this replacement version.</label></div>
      <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="secondary" type="button" data-impact-save="FOLLOW_UP_REQUIRED" data-impact-version-id="${iesc(versionId)}">Follow-up required</button><button class="primary" type="button" data-impact-save="NO_LINKED_CHANGE" data-impact-version-id="${iesc(versionId)}">No linked changes needed</button></div>`;
    if(typeof openModal==='function')openModal('Document Change Impact Review',html);
    else if(window.openModal)window.openModal('Document Change Impact Review',html);
  }

  async function iSaveReview(versionId,outcome){
    const c=iCandidates.find(x=>x.version.id===versionId);
    if(!c)return;
    if(!i$('impactReviewAckV21040')?.checked)return iToast('Confirm that you reviewed the linked documents and training first.');
    const note=iclean(i$('impactReviewNoteV21040')?.value);
    if(outcome==='FOLLOW_UP_REQUIRED'&&note.length<5)return iToast('Add a short note explaining the follow-up required.');
    const payload={
      source_document_id:c.doc.id,
      source_version_id:c.version.id,
      outcome,
      review_note:note||null,
      impact_snapshot:c.snapshot,
      reviewed_by:ist.user.id,
      reviewed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const existing=iReviewFor(c.version.id);
    const r=existing
      ?await isb.from('document_change_impact_reviews_v21040').update(payload).eq('id',existing.id)
      :await isb.from('document_change_impact_reviews_v21040').insert(payload);
    if(r.error)return iToast(r.error.message||'Impact review could not be saved.');
    try{if(typeof closeModal==='function')closeModal()}catch(_e){}
    await iRefresh();
    iToast(outcome==='FOLLOW_UP_REQUIRED'?'Document impact reviewed — follow-up recorded.':'Document impact reviewed — no linked changes required.');
  }

  async function iRefresh(){
    if(!iIsManager()||iBusy)return;
    iBusy=true;
    try{
      await iLoadReviews();
      iCandidates=iCollect();
      iRenderPanel();
      iRenderSafetyAction();
      iAddHelpAction();
    }catch(e){
      console.warn('Document change impact review',e);
      const panel=i$('documentChangeImpactPanelV21040');
      if(panel)panel.innerHTML=`<div class="danger-note">Document Change Impact could not load: ${iesc(e?.message||e)}</div>`;
    }finally{iBusy=false}
  }

  function iOpenCount(){return iCandidates.filter(c=>iState(c).open).length}
  function iRedCount(){return iCandidates.filter(c=>iState(c).open&&iState(c).traffic==='red').length}

  function iRenderSafetyAction(){
    if(!iIsManager())return;
    const host=i$('unifiedSafetyActionsCardV21039');if(!host)return;
    let row=i$('documentImpactSafetyActionV21040');
    const open=iOpenCount(),red=iRedCount();
    if(!open){row?.remove();return}
    if(!row){
      row=document.createElement('div');row.id='documentImpactSafetyActionV21040';
      const list=i$('safetyActionList');
      list?.insertAdjacentElement('beforebegin',row)||host.appendChild(row);
    }
    row.className=`item-card compact traffic-${red?'red':'amber'} document-impact-action-summary`;
    row.innerHTML=`<div class="row-between"><div><span class="safety-action-type">Documents</span><strong>${open} document-change impact review${open===1?'':'s'} open</strong><div class="muted">Replacement documents have direct linked documents or training that need checking.</div></div><span class="badge ${red?'overdue':'due'}">${red?`${red} high`:'Action'}</span></div><div class="actions"><button type="button" class="primary small" id="openDocumentImpactFromActionsV21040">Go there</button></div>`;
    i$('openDocumentImpactFromActionsV21040')?.addEventListener('click',()=>{
      try{if(typeof showView==='function')showView('documents');else document.querySelector('#mainNav button[data-view="documents"]')?.click()}catch(_e){}
      setTimeout(()=>i$('documentChangeImpactPanelV21040')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
    });
  }

  function iAddHelpAction(){
    const mod=core.roleAwareHelpV21038;
    if(!mod?.actions||mod.actions.some(x=>x.id==='document-change-impact'))return;
    mod.actions.push({
      id:'document-change-impact',
      roles:['manager','admin'],
      group:'Documents',
      title:'Document Change Impact',
      desc:'Review direct linked documents and training affected by a replacement document version.',
      view:'documents',
      anchor:'#documentChangeImpactPanelV21040',
      keywords:'document change impact new version replacement linked documents training review'
    });
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    if(b.dataset.impactSave){
      e.preventDefault();e.stopPropagation();
      return iSaveReview(b.dataset.impactVersionId,b.dataset.impactSave);
    }
    if(b.dataset.view==='documents'||b.closest?.('[data-view="documents"]'))setTimeout(iRefresh,80);
    if(b.dataset.view==='compliance'||b.closest?.('[data-view="compliance"]'))setTimeout(iRenderSafetyAction,180);
  },true);

  window.addEventListener('pageshow',()=>setTimeout(()=>{
    if(i$('documentsView')?.classList.contains('active-view'))iRefresh();
    if(i$('complianceView')?.classList.contains('active-view'))iRenderSafetyAction();
  },160));

  const style=document.createElement('style');
  style.id='documentImpactStylesV21040';
  style.textContent=`
    #documentChangeImpactPanelV21040{margin-top:14px;scroll-margin-top:10px}
    .impact-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}
    .impact-heading h3{margin:0 0 4px}.impact-heading p{margin:0}
    .impact-counts{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .document-impact-card{border-left-width:5px}.impact-source-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .impact-block{margin-top:10px}.impact-chip-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}
    .impact-chip{display:inline-flex;padding:5px 8px;border-radius:999px;background:#eef3f6;font-size:.8rem;max-width:100%}
    .impact-empty{margin-top:8px}.impact-footnote{margin-top:8px}
    .document-impact-action-summary{margin:10px 0}
    @media(max-width:700px){.impact-heading{display:block}.impact-counts{justify-content:flex-start;margin-top:9px}.document-impact-card .row-between{display:block}.document-impact-card .row-between>.badge{display:inline-flex;margin-top:7px}}
  `;
  document.head.appendChild(style);

  setTimeout(()=>{
    iApplyVersion();
    iAddHelpAction();
    if(iIsManager())iRefresh();
  },900);

  core.documentChangeImpactV21040={refresh:iRefresh,get candidates(){return iCandidates}};
})();

/* Safety Tracker v2.10.41 - Monthly Knowledge analytics */
(function(){
  const core=window.SafetyTrackerV2;
  if(!core||!core.state||!core.sb)return;

  const mst=core.state, msb=core.sb;
  const m$=id=>document.getElementById(id);
  const mesc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const mIsManager=()=>mst.profile?.report_only!==true&&['admin','manager'].includes(String(mst.profile?.role||'').toLowerCase());
  const mToast=msg=>{try{return (window.toast||core.toast)?.(msg)}catch(_e){console.log(msg)}};
  let mBusy=false,mMonths=12,mData=null,mTeam=[];

  function mApplyVersion(){
    if(window.SAFETY_BUILD){
      window.SAFETY_BUILD.version='2.10.41';
      window.SAFETY_BUILD.label='2.10.41 CLEAN';
      window.SAFETY_BUILD.build='21041';
      try{window.applySafetyBuildLabel?.()}catch(_e){}
    }
    document.querySelectorAll('.build-badge').forEach(el=>el.textContent='Safety Tracker v2.10.41 CLEAN');
    document.querySelectorAll('.dashboard-version').forEach(el=>el.textContent='v2.10.41 CLEAN');
    document.querySelectorAll('.brand-line .version,.demo-brand-line .version').forEach(el=>el.textContent='v2.10.41');
  }
  [0,500,1700,3300].forEach(ms=>setTimeout(mApplyVersion,ms));
  document.addEventListener('DOMContentLoaded',mApplyVersion,{once:true});

  function mTrafficPercent(v){
    const n=Number(v||0);
    if(n>=80)return 'green';
    if(n>=60)return 'amber';
    return 'red';
  }
  function mTrafficWrong(wrong,answers){
    if(!Number(answers||0))return 'neutral';
    const acc=100-(100*Number(wrong||0)/Number(answers||1));
    return mTrafficPercent(acc);
  }
  function mFmtMonth(v){
    if(!v)return '—';
    return new Date(String(v).slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  }
  function mDifficulty(v){
    return ({EASY:'Easy',STANDARD:'Standard',HARD:'Hard',MIXED:'Mixed'})[String(v||'').toUpperCase()]||String(v||'Mixed');
  }

  async function mLoad(){
    const [a,t,s]=await Promise.all([
      msb.rpc('monthly_knowledge_analytics_v21041',{p_months:mMonths}),
      msb.rpc('monthly_knowledge_team_status_v21035'),
      msb.rpc('get_monthly_knowledge_settings_v21035')
    ]);
    if(a.error)throw new Error(a.error.message);
    if(t.error)throw new Error(t.error.message);
    if(s.error)throw new Error(s.error.message);
    mData=a.data||{};
    mTeam=t.data||[];
    return {settings:s.data||{}};
  }

  function mCurrentSummary(settings){
    const ready=mTeam.filter(x=>!['PREPARING','OFF'].includes(String(x.status||'')));
    const complete=ready.filter(x=>x.status==='CURRENT').length;
    const overdue=ready.filter(x=>x.status==='OVERDUE').length;
    const due=ready.filter(x=>x.status==='DUE').length;
    const pct=ready.length?Math.round(1000*complete/ready.length)/10:0;
    return {ready:ready.length,complete,overdue,due,pct,enabled:!!settings.enabled};
  }

  function mTopicRows(){
    const topics=Array.isArray(mData?.topics)?mData.topics:[];
    return topics.filter(x=>Number(x.wrong_answers||0)>0).slice(0,12);
  }

  function mRepeatRows(){
    const topics=Array.isArray(mData?.topics)?mData.topics:[];
    return topics.filter(x=>x.repeated_miss===true).slice(0,8);
  }

  function mRenderTopics(){
    const rows=mTopicRows(), repeats=mRepeatRows();
    const weak=m$('monthlyKnowledgeWeakTopicsV21041');
    if(weak){
      if(!rows.length){
        weak.innerHTML='<div class="success-note"><strong>No missed topics recorded in this period.</strong> More analytics will appear as monthly checks are completed.</div>';
      }else{
        weak.innerHTML=`<div class="card-list">${rows.map(x=>{
          const tr=mTrafficPercent(Number(x.accuracy_percent||0));
          return `<div class="item-card compact traffic-${tr}">
            <div class="row-between"><div><strong>${mesc(x.topic||'Safety topic')}</strong><div class="meta"><span>${Number(x.answers||0)} answer${Number(x.answers||0)===1?'':'s'}</span><span>${Number(x.wrong_answers||0)} missed</span><span>${Number(x.people||0)} people</span></div></div><span class="badge ${tr==='red'?'overdue':tr==='amber'?'due':'complete'}">${Number(x.accuracy_percent||0)}% correct</span></div>
          </div>`;
        }).join('')}</div>`;
      }
    }
    const repeat=m$('monthlyKnowledgeRepeatedMissesV21041');
    if(repeat){
      if(!repeats.length){
        repeat.innerHTML='<div class="hint-box"><strong>No repeated weak topic yet.</strong> A topic appears here only after it has been missed at least twice in the selected period.</div>';
      }else{
        repeat.innerHTML=repeats.map(x=>`<div class="item-card compact traffic-${mTrafficPercent(Number(x.accuracy_percent||0))}">
          <div class="row-between"><div><strong>${mesc(x.topic||'Safety topic')}</strong><div class="muted">${Number(x.wrong_answers||0)} incorrect answer${Number(x.wrong_answers||0)===1?'':'s'} from ${Number(x.people||0)} people.</div></div><span class="badge overdue">Repeated miss</span></div>
        </div>`).join('');
      }
    }
  }

  function mRenderDifficulty(){
    const el=m$('monthlyKnowledgeDifficultyAnalyticsV21041');if(!el)return;
    const rows=Array.isArray(mData?.difficulty)?mData.difficulty:[];
    if(!rows.length){el.innerHTML='<div class="muted">No difficulty data yet.</div>';return}
    el.innerHTML=rows.map(x=>{
      const pct=Number(x.accuracy_percent||0),tr=mTrafficPercent(pct);
      return `<div class="knowledge-analytics-bar-row">
        <div class="row-between"><strong>${mesc(mDifficulty(x.difficulty))}</strong><span>${pct}% correct · ${Number(x.answers||0)} answered</span></div>
        <div class="knowledge-analytics-bar"><span class="traffic-${tr}" style="width:${Math.max(0,Math.min(100,pct))}%"></span></div>
      </div>`;
    }).join('');
  }

  function mRenderMonthly(){
    const el=m$('monthlyKnowledgeMonthlyTrendV21041');if(!el)return;
    const rows=Array.isArray(mData?.monthly)?[...mData.monthly].reverse():[];
    if(!rows.length){el.innerHTML='<div class="muted">No monthly history yet.</div>';return}
    el.innerHTML=`<div class="knowledge-month-grid">${rows.map(x=>{
      const pct=Number(x.participant_completion_percent||0),tr=mTrafficPercent(pct);
      return `<div class="knowledge-month-cell traffic-${tr}">
        <strong>${mesc(mFmtMonth(x.month_start))}</strong>
        <span>${Number(x.completed_people||0)}/${Number(x.participants||0)} participants completed</span>
        <span>${Number(x.attempts||0)} attempt${Number(x.attempts||0)===1?'':'s'} · avg ${Number(x.average_score_percent||0)}%</span>
      </div>`;
    }).join('')}</div>`;
  }

  async function mRender(){
    if(!mIsManager()||mBusy)return;
    const view=m$('reportsView');if(!view)return;
    let card=m$('monthlyKnowledgeAnalyticsCardV21041');
    if(!card){
      card=document.createElement('section');
      card.id='monthlyKnowledgeAnalyticsCardV21041';
      card.className='section-card report-manager-content monthly-knowledge-analytics-section';
      const monthly=view.querySelector('.monthly-report-section');
      monthly?.insertAdjacentElement('afterend',card)||view.appendChild(card);
    }
    mBusy=true;
    try{
      card.innerHTML='<div class="muted">Loading Monthly Knowledge analytics…</div>';
      const {settings}=await mLoad();
      const s=mData?.summary||{},current=mCurrentSummary(settings);
      const firstRate=Number(s.first_try_pass_rate||0),avg=Number(s.average_score_percent||0);
      const answerCount=Number(s.answers||0),wrong=Number(s.wrong_answers||0);
      const wrongTraffic=mTrafficWrong(wrong,answerCount);
      card.innerHTML=`<div class="row-between">
          <div><h3>Monthly Knowledge Analytics</h3><p class="muted">Shows how the monthly checks are being completed and which safety subjects are being missed. This is a learning indicator, not a replacement for formal training/compliance status.</p></div>
          <div class="row"><label class="analytics-period-label">Period<select id="monthlyKnowledgeAnalyticsPeriodV21041"><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option></select></label><button id="refreshMonthlyKnowledgeAnalyticsV21041" class="secondary small" type="button">Refresh</button></div>
        </div>
        <div class="stats-grid knowledge-analytics-stats">
          <div class="stat traffic-${!current.enabled?'neutral':mTrafficPercent(current.pct)}"><strong>${current.enabled?current.pct+'%':'OFF'}</strong><span>Current-month completion</span></div>
          <div class="stat traffic-${Number(s.first_try_total||0)?mTrafficPercent(firstRate):'neutral'}"><strong>${Number(s.first_try_total||0)?firstRate+'%':'—'}</strong><span>Passed first attempt</span></div>
          <div class="stat traffic-${Number(s.attempts||0)?mTrafficPercent(avg):'neutral'}"><strong>${Number(s.attempts||0)?avg+'%':'—'}</strong><span>Average score</span></div>
          <div class="stat traffic-${answerCount?wrongTraffic:'neutral'}"><strong>${wrong}</strong><span>Incorrect answers</span></div>
        </div>
        <div class="hint-box"><strong>Current month:</strong> ${current.complete} complete · ${current.due} due · ${current.overdue} overdue · ${current.ready} people currently ready for a check. ${settings.enabled?'Monthly checks are ON.':'Monthly checks are OFF.'}</div>
        <div class="knowledge-analytics-two-col">
          <div><h4>Repeatedly missed topics</h4><p class="muted">Appears after the same topic has been answered incorrectly at least twice in the selected period.</p><div id="monthlyKnowledgeRepeatedMissesV21041"></div></div>
          <div><h4>Difficulty performance</h4><p class="muted">Correct-answer rate by Easy, Standard and Hard questions.</p><div id="monthlyKnowledgeDifficultyAnalyticsV21041"></div></div>
        </div>
        <div class="section-card compact knowledge-analytics-inner"><h4>Topics with incorrect answers</h4><div id="monthlyKnowledgeWeakTopicsV21041"></div></div>
        <div class="section-card compact knowledge-analytics-inner"><h4>Monthly history</h4><p class="muted">Historical percentage below is the percentage of people who attempted a check in that month and ultimately completed it. The current-month headline above uses the live expected/ready user list.</p><div id="monthlyKnowledgeMonthlyTrendV21041"></div></div>`;
      const period=m$('monthlyKnowledgeAnalyticsPeriodV21041');if(period)period.value=String(mMonths);
      period?.addEventListener('change',async e=>{mMonths=Number(e.target.value||12);await mRenderForce()});
      m$('refreshMonthlyKnowledgeAnalyticsV21041')?.addEventListener('click',mRenderForce);
      mRenderTopics();mRenderDifficulty();mRenderMonthly();
      mAddHelpAction();
    }catch(e){
      card.innerHTML=`<div class="danger-note"><strong>Monthly Knowledge analytics could not load.</strong><br>${mesc(e?.message||e)}</div>`;
    }finally{mBusy=false}
  }

  async function mRenderForce(){
    mBusy=false;
    return mRender();
  }

  function mAddHelpAction(){
    const mod=core.roleAwareHelpV21038;
    if(!mod?.actions||mod.actions.some(x=>x.id==='monthly-knowledge-analytics'))return;
    mod.actions.push({
      id:'monthly-knowledge-analytics',
      roles:['manager','admin'],
      group:'Reports',
      title:'Monthly Knowledge Analytics',
      desc:'See completion, scores, repeated weak topics and performance by question difficulty.',
      view:'reports',
      anchor:'#monthlyKnowledgeAnalyticsCardV21041',
      keywords:'monthly knowledge analytics questions scores weak topics wrong answers difficulty reports'
    });
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    if(b.dataset.view==='reports'||b.closest?.('[data-view="reports"]'))setTimeout(mRender,80);
  },true);

  window.addEventListener('pageshow',()=>setTimeout(()=>{
    if(m$('reportsView')?.classList.contains('active-view'))mRenderForce();
  },180));

  const style=document.createElement('style');
  style.id='monthlyKnowledgeAnalyticsStylesV21041';
  style.textContent=`
    #monthlyKnowledgeAnalyticsCardV21041{scroll-margin-top:10px}
    .analytics-period-label{margin:0;min-width:135px}
    .knowledge-analytics-stats{margin-top:12px}
    .knowledge-analytics-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
    .knowledge-analytics-inner{margin-top:14px}
    .knowledge-analytics-bar-row{margin:10px 0}.knowledge-analytics-bar{height:10px;background:#e7edf1;border-radius:999px;overflow:hidden;margin-top:5px}.knowledge-analytics-bar>span{display:block;height:100%;border-radius:999px}
    .knowledge-analytics-bar>span.traffic-green{background:#2d6a4f}.knowledge-analytics-bar>span.traffic-amber{background:#d89414}.knowledge-analytics-bar>span.traffic-red{background:#b42318}
    .knowledge-month-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.knowledge-month-cell{border:1px solid #d8e0e6;border-left-width:5px;border-radius:10px;padding:10px;display:grid;gap:3px}.knowledge-month-cell span{font-size:.82rem;color:#5f6f7f}
    @media(max-width:760px){.knowledge-analytics-two-col{grid-template-columns:1fr}#monthlyKnowledgeAnalyticsCardV21041>.row-between{display:block}#monthlyKnowledgeAnalyticsCardV21041>.row-between>.row{margin-top:10px;flex-wrap:wrap}.analytics-period-label{flex:1}}
  `;
  document.head.appendChild(style);

  setTimeout(()=>{
    mApplyVersion();
    mAddHelpAction();
    if(mIsManager()&&m$('reportsView')?.classList.contains('active-view'))mRender();
  },950);

  core.monthlyKnowledgeAnalyticsV21041={render:mRenderForce};
})();
