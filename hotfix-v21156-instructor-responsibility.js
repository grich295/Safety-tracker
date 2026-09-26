/* Safety Tracker v2.11.56 CLEAN
   Instructor-led responsibility
   - Default owner: each employee's Department Manager.
   - Whole-site training is therefore split automatically by the trainee's primary department.
   - Manual responsibility override to another Manager / Admin / Department Manager.
   - Responsibility is ownership only: any authorised Manager/Admin can still deliver training.
   - Department Managers can use the Instructor view for their own departments without requiring full Manager access.
*/
'use strict';
(function(){
  if(window.__SAFETY_INSTRUCTOR_RESP_V21156)return;
  window.__SAFETY_INSTRUCTOR_RESP_V21156=true;

  let api=null,state=null,sb=null;
  let queue=[],eligibleManagers=[],myManagedDepartments=[];
  let mode='ALL';

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const toast=msg=>{try{api?.toast?.(msg)}catch(_e){console.log(msg)}};
  const isGlobalManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const isDeptManager=()=>myManagedDepartments.length>0;
  const canUseInstructor=()=>isGlobalManager()||isDeptManager();
  const todayISO=()=>new Date().toISOString().slice(0,10);
  const fmtDate=d=>d?new Date(String(d).length===10?d+'T00:00:00':d).toLocaleDateString('en-GB'):'—';

  async function loadData(){
    if(!sb||!state?.user)return;
    const [q,m,d]=await Promise.all([
      sb.rpc('instructor_queue_v21156'),
      sb.rpc('eligible_training_managers_v21156'),
      sb.rpc('my_department_manager_departments_v21156')
    ]);
    if(q.error)throw q.error;
    queue=q.data||[];
    eligibleManagers=m.error?[]:(m.data||[]);
    myManagedDepartments=d.error?[]:(d.data||[]);

    if(isDeptManager()) mode='MINE';
    else if(!isGlobalManager()) mode='MINE';
    else if(!['ALL','MINE'].includes(mode)) mode='ALL';
  }

  function currentRows(){
    const rows=queue.filter(x=>x.queue_status!=='COMPLETED');
    if(mode==='MINE')return rows.filter(x=>x.is_my_responsibility===true);
    return rows;
  }

  function statusMeta(row){
    if(row.queue_status==='AWAITING_ACK')return {label:'Waiting employee acknowledgement',traffic:'amber'};
    if(row.queue_status==='ABSENT')return {label:'Absent / training still required',traffic:'red'};
    if(row.queue_status==='OVERDUE')return {label:'Overdue · attendance needed',traffic:'red'};
    return {label:'Attendance needed',traffic:'amber'};
  }

  function ensureToolbar(){
    const view=$('instructorView');if(!view)return;
    let box=$('instructorResponsibilityToolbarV21156');
    if(!box){
      box=document.createElement('div');
      box.id='instructorResponsibilityToolbarV21156';
      box.className='section-card';
      const stats=$('instructorStats');
      stats?.insertAdjacentElement('afterend',box);
    }

    const options=isGlobalManager()
      ? `<select id="instructorResponsibilityModeV21156">
           <option value="MINE" ${mode==='MINE'?'selected':''}>My responsibility</option>
           <option value="ALL" ${mode==='ALL'?'selected':''}>All instructor-led training</option>
         </select>`
      : `<div class="hint-box"><strong>Department Manager view:</strong> showing the instructor-led training you are responsible for.</div>`;

    box.innerHTML=`
      <div class="row-between instructor-owner-toolbar-v21156">
        <div>
          <h3>Training responsibility</h3>
          <p class="muted">
            Department Manager is the default owner for each employee's instructor-led training.
            Any Manager/Admin may still deliver the session; the person who records attendance is stored as the actual instructor.
          </p>
        </div>
        ${options}
      </div>
      ${myManagedDepartments.length?`<div class="meta"><span>Your departments: ${esc(myManagedDepartments.map(x=>x.department_name).join(', '))}</span></div>`:''}`;

    $('instructorResponsibilityModeV21156')?.addEventListener('change',e=>{
      mode=e.target.value;
      render();
    });
  }

  function render(){
    if(!canUseInstructor())return;
    ensureToolbar();

    const rows=currentRows();
    const attendance=rows.filter(x=>['ATTENDANCE_NEEDED','OVERDUE','ABSENT'].includes(x.queue_status)).length;
    const overdue=rows.filter(x=>x.queue_status==='OVERDUE').length;
    const awaiting=rows.filter(x=>x.queue_status==='AWAITING_ACK').length;

    const stats=$('instructorStats');
    if(stats){
      stats.innerHTML=[
        ['Attendance needed',attendance,overdue?'red':attendance?'amber':'green'],
        ['Overdue',overdue,overdue?'red':'green'],
        ['Employee sign-off pending',awaiting,awaiting?'amber':'green']
      ].map(([l,v,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${v}</strong><span>${l}</span></div>`).join('');
    }

    const list=$('instructorList');
    if(list){
      list.innerHTML=rows.length?rows.map(row=>{
        const st=statusMeta(row);
        const canRecord=row.can_i_deliver===true && row.queue_status!=='AWAITING_ACK';
        const override=row.responsibility_source==='MANUAL_OVERRIDE';
        return `<div class="item-card traffic-card traffic-${st.traffic}">
          <div class="row-between instructor-row-v21156">
            <div>
              <strong>${esc(row.trainee_name)}</strong>
              <div>${esc((row.training_reference?row.training_reference+' - ':'')+row.training_name)}</div>
              <div class="meta">
                <span>${esc(row.department_name||'No department')}</span>
                ${row.due_date?`<span>Due ${fmtDate(row.due_date)}</span>`:''}
                <span class="badge ${override?'due':'complete'}">${esc(row.responsibility_label)}</span>
              </div>
              ${override&&row.override_reason?`<div class="muted">Override reason: ${esc(row.override_reason)}</div>`:''}
            </div>
            <span class="badge ${st.traffic==='red'?'overdue':'due'}">${esc(st.label)}</span>
          </div>
          <div class="row action-bar instructor-actions-v21156">
            ${row.queue_status==='AWAITING_ACK'
              ? '<span class="success-note compact-note">Attendance recorded — waiting for the employee acknowledgement.</span>'
              : canRecord?`<button class="primary" type="button" data-v21156-record="${esc(row.assignment_id)}">Record attendance</button>`:''}
            ${isGlobalManager()?`<button class="secondary" type="button" data-v21156-responsible="${esc(row.assignment_id)}">Change responsible</button>`:''}
          </div>
        </div>`;
      }).join(''):'<div class="success-note">No outstanding instructor-led training in this view.</div>';
    }

    const sel=$('groupTrainingSelect');
    if(sel){
      const seen=new Set(),opts=[];
      for(const r of rows){
        if(r.queue_status==='AWAITING_ACK'||seen.has(r.training_session_id))continue;
        seen.add(r.training_session_id);
        opts.push(`<option value="${esc(r.training_session_id)}">${esc((r.training_reference?r.training_reference+' - ':'')+r.training_name)}</option>`);
      }
      sel.innerHTML='<option value="">Select training</option>'+opts.join('');
    }
  }

  function showInstructorView(){
    if(!canUseInstructor())return;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='instructor'));
    $('instructorView')?.classList.add('active-view');
    render();
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_e){}
  }

  function exposeInstructorNav(){
    const b=document.querySelector('#mainNav button[data-view="instructor"]');
    if(b&&canUseInstructor())b.hidden=false;
  }

  function rowByAssignment(id){return queue.find(x=>x.assignment_id===id)||null}

  function showAttendance(id){
    const row=rowByAssignment(id);if(!row)return;
    if(!row.can_i_deliver)return toast('You are not authorised to deliver this training.');
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Record training attendance';
    body.innerHTML=`
      <p><strong>${esc(row.trainee_name)}</strong> · ${esc(row.training_name)}</p>
      <div class="hint-box">
        Default responsibility: <strong>${esc(row.responsibility_label)}</strong><br>
        You are recording this session as the actual instructor.
      </div>
      <div class="form-grid">
        <label>Training date<input id="attendanceDateV21156" type="date" value="${todayISO()}"></label>
        <label>Status
          <select id="attendanceStatusV21156">
            <option value="ATTENDED">Attended / training delivered</option>
            <option value="ABSENT">Absent / not attended</option>
          </select>
        </label>
        <label class="full">Instructor note<textarea id="attendanceNoteV21156"></textarea></label>
      </div>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21156-save-attendance="${esc(id)}">Save</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveAttendance(id,btn){
    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    const r=await sb.rpc('record_training_attendance_v21156',{
      p_assignment_id:id,
      p_delivery_date:$('attendanceDateV21156')?.value||todayISO(),
      p_attendance_status:$('attendanceStatusV21156')?.value||'ATTENDED',
      p_note:clean($('attendanceNoteV21156')?.value)||null
    });
    if(r.error){btn.disabled=false;btn.textContent=old;return toast(r.error.message)}
    try{$('modal')?.close()}catch(_e){}
    await loadData();render();
    toast('Attendance recorded. The signed-in manager is stored as the actual instructor.');
  }

  function showResponsible(id){
    const row=rowByAssignment(id);if(!row||!isGlobalManager())return;
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Training responsibility';

    const opts=eligibleManagers.map(m=>`<option value="${esc(m.user_id)}" ${row.override_manager_user_id===m.user_id?'selected':''}>${esc(m.display_name)} · ${esc(m.role_label)}</option>`).join('');
    body.innerHTML=`
      <div class="section-card">
        <h3>${esc(row.trainee_name)}</h3>
        <p>${esc(row.training_name)}</p>
        <div class="meta"><span>${esc(row.department_name||'No department')}</span></div>
      </div>

      <div class="hint-box">
        <strong>Automatic default:</strong>
        ${esc((row.default_manager_names||[]).length?(row.default_manager_names||[]).join(', ')+' · '+(row.department_name||'Department')+' manager':'Any Manager/Admin')}
        <br><br>
        Changing the responsible manager changes who owns/follows up the training. It does <strong>not</strong> stop another Manager/Admin delivering it.
      </div>

      <div class="form-grid">
        <label class="full">Responsible manager
          <select id="responsibleManagerV21156">
            <option value="">Automatic — Department Manager</option>
            ${opts}
          </select>
        </label>
        <label class="full">Override reason <span class="muted">optional</span>
          <textarea id="responsibleReasonV21156" placeholder="e.g. Duty Manager delivering this session">${esc(row.override_reason||'')}</textarea>
        </label>
      </div>

      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21156-save-responsible="${esc(id)}">Save responsibility</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveResponsible(id,btn){
    const manager=$('responsibleManagerV21156')?.value||null;
    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    const r=await sb.rpc('set_training_responsible_manager_v21156',{
      p_assignment_id:id,
      p_manager_user_id:manager,
      p_reason:clean($('responsibleReasonV21156')?.value)||null
    });
    if(r.error){btn.disabled=false;btn.textContent=old;return toast(r.error.message)}
    try{$('modal')?.close()}catch(_e){}
    await loadData();render();
    toast(manager?'Training responsibility overridden.':'Automatic Department Manager responsibility restored.');
  }

  function showGroupAttendance(trainingId){
    const rows=currentRows().filter(x=>x.training_session_id===trainingId && x.queue_status!=='AWAITING_ACK' && x.can_i_deliver===true);
    if(!rows.length)return toast('No eligible attendees in this view.');

    const training=rows[0];
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Group training attendance';
    body.innerHTML=`
      <p><strong>${esc((training.training_reference?training.training_reference+' - ':'')+training.training_name)}</strong></p>
      <p class="muted">Tick only the people covered by this session. Responsibility is shown for reference; the signed-in person will be recorded as the actual instructor.</p>
      <div class="row">
        <button class="ghost" type="button" data-v21156-select-all>Select all eligible</button>
        <button class="ghost" type="button" data-v21156-clear-all>Clear</button>
      </div>
      <div class="checkbox-list">
        ${rows.map(r=>`<label class="check-row">
          <input type="checkbox" class="group-attendee-v21156" value="${esc(r.assignment_id)}">
          <span style="flex:1">
            <strong>${esc(r.trainee_name)}</strong>
            <span class="muted" style="display:block">${esc(r.department_name||'No department')} · ${esc(r.responsibility_label)}${r.due_date?' · Due '+fmtDate(r.due_date):''}</span>
          </span>
        </label>`).join('')}
      </div>
      <div class="form-grid" style="margin-top:12px">
        <label>Training date<input id="groupTrainingDateV21156" type="date" value="${todayISO()}"></label>
        <label>Status
          <select id="groupTrainingStatusV21156">
            <option value="ATTENDED">Attended / training delivered</option>
            <option value="ABSENT">Absent / not attended</option>
          </select>
        </label>
        <label class="full">Instructor note<textarea id="groupTrainingNoteV21156"></textarea></label>
      </div>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21156-save-group="${esc(trainingId)}">Save selected</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveGroup(trainingId,btn){
    const ids=[...document.querySelectorAll('.group-attendee-v21156:checked')].map(x=>x.value);
    if(!ids.length)return toast('Tick at least one person.');
    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    const date=$('groupTrainingDateV21156')?.value||todayISO();
    const status=$('groupTrainingStatusV21156')?.value||'ATTENDED';
    const note=clean($('groupTrainingNoteV21156')?.value)||null;
    let done=0;
    for(const id of ids){
      const r=await sb.rpc('record_training_attendance_v21156',{
        p_assignment_id:id,p_delivery_date:date,p_attendance_status:status,p_note:note
      });
      if(r.error){btn.disabled=false;btn.textContent=old;return toast(`${done} saved; then stopped: ${r.error.message}`)}
      done++;
    }
    try{$('modal')?.close()}catch(_e){}
    await loadData();render();
    toast(status==='ATTENDED'?`${done} attendee${done===1?'':'s'} confirmed.`:'Absence recorded.');
  }

  function addHelp(){
    const grid=document.querySelector('#helpContent .role-help-grid');
    if(!grid||grid.querySelector('[data-help-instructor-resp-v21156]')||!canUseInstructor())return;
    const card=document.createElement('article');
    card.className='role-help-action help-v21150-card';
    card.dataset.helpInstructorRespV21156='1';
    card.dataset.helpV21150Search='instructor training department manager responsibility responsible override attendance whole site';
    card.innerHTML=`
      <div class="role-help-action-copy">
        <span class="role-help-group">Training</span>
        <h3>Instructor-led responsibility</h3>
        <p>For whole-site instructor-led training, each employee defaults to their Department Manager. A Manager/Admin can override the responsible person, but any authorised Manager/Admin may still deliver the session. The actual instructor is whoever records attendance.</p>
      </div>
      <button class="primary role-help-go" type="button" data-v21156-open-instructor>Go there</button>`;
    grid.appendChild(card);
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      const nav=e.target.closest?.('#mainNav button[data-view="instructor"]');
      if(nav&&canUseInstructor()){
        e.preventDefault();e.stopImmediatePropagation();
        showInstructorView();return;
      }

      if(e.target.closest?.('[data-v21156-open-instructor]')){
        e.preventDefault();e.stopImmediatePropagation();
        showInstructorView();return;
      }

      const record=e.target.closest?.('[data-single-attendance],[data-v21156-record]');
      if(record&&canUseInstructor()){
        e.preventDefault();e.stopImmediatePropagation();
        showAttendance(record.dataset.v21156Record||record.dataset.singleAttendance);return;
      }

      const resp=e.target.closest?.('[data-v21156-responsible]');
      if(resp){e.preventDefault();e.stopImmediatePropagation();showResponsible(resp.dataset.v21156Responsible);return}

      const save=e.target.closest?.('[data-v21156-save-attendance]');
      if(save){e.preventDefault();e.stopImmediatePropagation();saveAttendance(save.dataset.v21156SaveAttendance,save);return}

      const saveResp=e.target.closest?.('[data-v21156-save-responsible]');
      if(saveResp){e.preventDefault();e.stopImmediatePropagation();saveResponsible(saveResp.dataset.v21156SaveResponsible,saveResp);return}

      if(e.target.closest?.('#openGroupAttendanceBtn')&&canUseInstructor()){
        e.preventDefault();e.stopImmediatePropagation();
        const id=$('groupTrainingSelect')?.value;
        if(!id)return toast('Select training first.');
        showGroupAttendance(id);return;
      }

      if(e.target.closest?.('[data-v21156-select-all]')){
        e.preventDefault();document.querySelectorAll('.group-attendee-v21156').forEach(x=>x.checked=true);return;
      }
      if(e.target.closest?.('[data-v21156-clear-all]')){
        e.preventDefault();document.querySelectorAll('.group-attendee-v21156').forEach(x=>x.checked=false);return;
      }

      const saveGroupBtn=e.target.closest?.('[data-v21156-save-group]');
      if(saveGroupBtn){e.preventDefault();e.stopImmediatePropagation();saveGroup(saveGroupBtn.dataset.v21156SaveGroup,saveGroupBtn);return}

      if(e.target.closest?.('#mainNav button[data-view="help"]')){
        [180,450,900].forEach(ms=>setTimeout(addHelp,ms));
      }
    },true);

    window.addEventListener('pageshow',()=>{
      [120,350,900].forEach(ms=>setTimeout(()=>{exposeInstructorNav();addHelp()},ms));
    });
  }

  function styles(){
    if($('instructorRespStylesV21156'))return;
    const s=document.createElement('style');
    s.id='instructorRespStylesV21156';
    s.textContent=`
      .instructor-owner-toolbar-v21156{gap:12px;align-items:flex-start}
      .instructor-owner-toolbar-v21156 select{min-width:210px}
      .instructor-row-v21156{gap:10px;align-items:flex-start}
      @media(max-width:700px){
        .instructor-owner-toolbar-v21156,.instructor-row-v21156{display:block}
        .instructor-owner-toolbar-v21156 select{width:100%;margin-top:10px}
        .instructor-actions-v21156 button{flex:1}
      }
    `;
    document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,100);return}
    state=api.state;sb=api.sb;
    if(!state.user)return;
    styles();
    await loadData();
    if(!canUseInstructor())return;
    installEvents();
    exposeInstructorNav();
    [150,450,1000].forEach(ms=>setTimeout(()=>{exposeInstructorNav();addHelp()},ms));

    // If the signed-in Department Manager is not a global Safety Manager,
    // this is their only management-style view; other Manager/Admin areas remain hidden.
    window.SafetyInstructorResponsibilityV21156={
      reload:async()=>{await loadData();render()},
      open:showInstructorView
    };
  }

  boot().catch(e=>console.warn('Instructor responsibility v2.11.56',e));
})();
