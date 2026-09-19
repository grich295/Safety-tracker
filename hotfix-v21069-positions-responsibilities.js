/* Safety Tracker v2.10.71 CLEAN
   Manual positions, multiple-position cross-training, responsibility ownership
   and company 6-month training / annual controlled-review policy.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21069_BOOT_REQUESTED)return;
  window.__SAFETY_V21069_BOOT_REQUESTED=true;

  function boot(){
    const ready=(
      typeof state!=='undefined' &&
      typeof sb!=='undefined' &&
      typeof loadAll==='function' &&
      typeof renderAdmin==='function' &&
      typeof renderPeople==='function' &&
      typeof showSetRole==='function' &&
      typeof showDocDetails==='function' &&
      typeof refresh==='function' &&
      typeof openModal==='function' &&
      !!window.SafetyRegressionHardeningV21068 &&
      !!window.__SAFETY_V21068_INSTALLED
    );
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    if(window.__SAFETY_V21069_INSTALLED)return;
    window.__SAFETY_V21069_INSTALLED=true;

    const BUILD='2.10.71';
    const core={loadAll,renderAdmin,renderPeople,showSetRole,showDocDetails,saveRole,renderMySafety};
    let loading69=null,observer69=null;

    state.positions69=state.positions69||[];
    state.positionDepartments69=state.positionDepartments69||[];
    state.userPositions69=state.userPositions69||[];
    state.manualDepartments69=state.manualDepartments69||[];
    state.responsibilities69=state.responsibilities69||[];
    state.reviewTriggers69=state.reviewTriggers69||[];
    state.responsibilityNotices71=state.responsibilityNotices71||[];

    const $69=id=>document.getElementById(id);
    const esc69=v=>{try{return esc(v)}catch(_e){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};
    const clean69=v=>String(v??'').replace(/\s+/g,' ').trim();
    const admin69=()=>{try{return !!isAdmin()}catch(_e){return false}};
    const manager69=()=>{try{return !!isManager()}catch(_e){return false}};
    const toast69=m=>{try{return toast(m)}catch(_e){console.log(m)}};

    async function load69(force=false){
      if(loading69&&!force)return loading69;
      if(!state.user||state.offline||!navigator.onLine||!manager69())return;
      loading69=(async()=>{
        try{
          const qs=[
            sb.from('safety_positions_v21069').select('*').order('name'),
            sb.from('safety_position_departments_v21069').select('*'),
            sb.from('safety_user_positions_v21069').select('*').eq('active',true).order('assigned_at'),
            sb.from('safety_responsibilities_v21069').select('*').eq('active',true).order('assigned_at'),
            sb.from('safety_review_triggers_v21069').select('*').order('raised_at',{ascending:false}).limit(40)
          ];
          if(admin69())qs.push(sb.from('manual_user_departments_v21069').select('*'));
          const out=await Promise.all(qs);
          const names=['positions69','positionDepartments69','userPositions69','responsibilities69','reviewTriggers69','manualDepartments69'];
          out.forEach((r,i)=>{if(r.error)console.warn(names[i],r.error);else state[names[i]]=r.data||[]});
        }catch(e){console.warn('Positions & responsibilities',e)}
        finally{loading69=null}
      })();
      return loading69;
    }

    async function loadResponsibilityNotices71(){
      if(!state.user||state.offline||!navigator.onLine)return;
      try{
        const r=await sb.from('safety_responsibility_notifications_v21071')
          .select('*')
          .eq('user_id',state.user.id)
          .order('created_at',{ascending:false});
        if(!r.error)state.responsibilityNotices71=r.data||[];
      }catch(e){console.warn('H&S responsibility notice',e)}
    }

    loadAll=async function(){
      const out=await core.loadAll.apply(this,arguments);
      await Promise.all([load69(true),loadResponsibilityNotices71()]);
      return out;
    };
    try{window.loadAll=loadAll}catch(_e){}

    const position69=id=>state.positions69.find(x=>x.id===id)||null;
    const department69=id=>state.departments.find(x=>x.id===id)||null;
    const person69=id=>state.people.find(x=>x.id===id)||null;
    const activePositions69=()=>state.positions69.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    const positionDepartmentIds69=id=>state.positionDepartments69.filter(x=>x.position_id===id).map(x=>x.department_id);
    const userPositionRows69=uid=>state.userPositions69.filter(x=>x.user_id===uid&&x.active!==false);
    const mainPosition69=uid=>userPositionRows69(uid).find(x=>x.is_primary)||userPositionRows69(uid)[0]||null;
    const positionLabel69=id=>position69(id)?.name||'Unknown position';
    const personLabel69=id=>{const p=person69(id);return p?.display_name||p?.email||'Not assigned'};
    const deptLabel69=id=>department69(id)?.name||'Unknown department';
    const manualRows69=uid=>state.manualDepartments69.filter(x=>x.user_id===uid);
    const currentResponsibility69=(type,dep=null)=>state.responsibilities69.find(x=>x.active!==false&&x.responsibility_type===type&&(type==='HS_MANAGER'?x.department_id==null:x.department_id===dep))||null;

    function positionSummary69(uid){
      const rows=userPositionRows69(uid);
      if(!rows.length)return 'No positions';
      return rows.sort((a,b)=>(b.is_primary?1:0)-(a.is_primary?1:0)||positionLabel69(a.position_id).localeCompare(positionLabel69(b.position_id)))
        .map(x=>`${positionLabel69(x.position_id)}${x.is_primary?' (Main)':''}`).join(' + ');
    }

    function renderAdmin69(){
      if(!admin69())return;
      const depCard=$69('departmentList')?.closest('.section-card');
      if(!depCard)return;
      let card=$69('positionsResponsibilities69');
      if(!card){
        card=document.createElement('div');
        card.id='positionsResponsibilities69';
        card.className='section-card';
        depCard.insertAdjacentElement('afterend',card);
      }

      const people=state.people.filter(p=>p.active!==false&&p.report_only!==true)
        .sort((a,b)=>String(a.display_name||a.email).localeCompare(String(b.display_name||b.email)));
      const peopleOpts=(selected='')=>`<option value="">Not assigned</option>`+people.map(p=>{
        const main=mainPosition69(p.id),pos=main?positionLabel69(main.position_id):'No Main position';
        return `<option value="${p.id}" ${selected===p.id?'selected':''}>${esc69(p.display_name||p.email)} · ${esc69(pos)}</option>`;
      }).join('');

      const hs=currentResponsibility69('HS_MANAGER');
      const deptManagers=state.departments.filter(d=>d.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name)))
        .map(d=>{
          const r=currentResponsibility69('DEPARTMENT_MANAGER',d.id);
          return `<div class="item-card compact"><div class="row-between"><div><strong>${esc69(d.name)}</strong><div class="muted">Responsible manager for department-controlled H&S documents/training.</div></div><div class="row"><select id="deptManager69_${d.id}">${peopleOpts(r?.user_id||'')}</select><button type="button" class="secondary" data-save-dept-manager69="${d.id}">Save</button></div></div></div>`;
        }).join('')||'<div class="muted">Create departments first.</div>';

      const positionCards=state.positions69
        .slice().sort((a,b)=>(a.active===false)-(b.active===false)||String(a.name).localeCompare(String(b.name)))
        .map(p=>{
          const deps=positionDepartmentIds69(p.id).map(deptLabel69);
          const holders=state.userPositions69.filter(x=>x.position_id===p.id&&x.active!==false).length;
          return `<div class="item-card compact ${p.active===false?'traffic-neutral':''}"><div class="row-between"><div><strong>${esc69(p.name)}</strong><div class="meta"><span>${holders} current holder${holders===1?'':'s'}</span><span>${deps.length?esc69(deps.join(' + ')):'No departments linked'}</span>${p.primary_department_id?`<span>Main dept: ${esc69(deptLabel69(p.primary_department_id))}</span>`:''}<span class="badge ${p.active===false?'neutral':'complete'}">${p.active===false?'Archived':'Active'}</span></div>${p.description?`<div class="muted">${esc69(p.description)}</div>`:''}</div><div class="row"><button type="button" class="secondary" data-edit-position69="${p.id}">Edit</button><button type="button" class="${p.active===false?'primary':'ghost'}" data-toggle-position69="${p.id}">${p.active===false?'Restore':'Archive'}</button></div></div></div>`;
        }).join('')||'<div class="muted">No positions yet. Add only the positions your hotel actually uses.</div>';

      const recent=state.reviewTriggers69.slice(0,6).map(x=>{
        const dep=x.scope_type==='DEPARTMENT'?` · ${deptLabel69(x.department_id)}`:'';
        return `<div class="item-card compact"><strong>${esc69(String(x.trigger_type||'').replaceAll('_',' '))}</strong><div class="meta"><span>${esc69(x.scope_type)}${esc69(dep)}</span><span>${Number(x.affected_count||0)} item${Number(x.affected_count||0)===1?'':'s'} flagged</span><span>${esc69(fmtDateTime(x.raised_at))}</span></div></div>`;
      }).join('')||'<div class="muted">No policy review triggers have been recorded yet.</div>';

      card.innerHTML=`
        <div class="row-between"><div><h3>Positions & Responsibilities</h3><p class="muted">Create your own positions. Nothing is pre-set. A person can hold several positions for cross-training, with one marked Main/Default. Each position belongs to one department. Cross-training comes from assigning a user multiple positions, and those departments feed the existing training rules automatically.</p></div><button type="button" class="primary" data-new-position69>New position</button></div>
        <div class="hint-box"><strong>Document scope:</strong> every controlled RA/COSHH RA/SSW/TBT should have a clear scope — either <strong>Whole hotel / Everyone</strong> once, or the relevant <strong>Department</strong>. Do not duplicate whole-hotel documents into each department. Person-specific assignment is for genuine exceptions only.</div>
        <div class="section-card compact">
          <h4>Company H&S responsibility</h4>
          <p class="muted">The overall H&S Manager can also be a department manager or hold any other position.</p>
          <div class="row"><select id="hsManager69">${peopleOpts(hs?.user_id||'')}</select><button type="button" class="secondary" data-save-hs-manager69>Save H&S Manager</button></div>
        </div>
        <div class="section-card compact">
          <h4>Department responsible managers</h4>
          <div class="card-list">${deptManagers}</div>
        </div>
        <div class="section-card compact">
          <h4>Positions</h4>
          <div class="card-list">${positionCards}</div>
        </div>
        <div class="section-card compact">
          <h4>Company policy defaults & controls</h4>
          <div class="card-list">
            <div class="item-card compact traffic-green"><strong>Training frequency</strong><div class="muted">New training defaults to every 6 months to save setup time. Manager/Admin can change the frequency for each training item whenever required.</div></div>
            <div class="item-card compact traffic-green"><strong>Controlled-document review</strong><div class="muted">RA, COSHH RA, SSW and Toolbox Talk: at least annually.</div></div>
            <div class="item-card compact traffic-green"><strong>Manager change</strong><div class="muted">Changing an existing department responsible manager automatically flags ALL controlled RA/COSHH RA/SSW/TBT material assigned to that department for full review, after a warning confirmation. Changing the overall H&S Manager / Officer does NOT trigger a hotel-wide review; the new holder is notified that they are responsible for oversight, outstanding reviews and training/compliance actions.</div></div>
          </div>
        </div>
        <div class="section-card compact">
          <h4>Trigger a policy review</h4>
          <p class="muted">Use this after a relevant accident/incident or significant change. Safety Tracker records only the review trigger — do not enter accident, medical or personal details here.</p>
          <div class="form-grid">
            <label>Reason<select id="reviewTriggerReason69"><option value="ACCIDENT_INCIDENT">Relevant accident / incident</option><option value="SIGNIFICANT_CHANGE">Significant change</option><option value="MANAGEMENT_REVIEW">Management review</option></select></label>
            <label>Scope<select id="reviewTriggerScope69"><option value="COMPANY">Whole hotel / company</option><option value="DEPARTMENT">One department</option></select></label>
            <label id="reviewTriggerDepartmentWrap69" hidden>Department<select id="reviewTriggerDepartment69"><option value="">Select department</option>${state.departments.filter(d=>d.active!==false).map(d=>`<option value="${d.id}">${esc69(d.name)}</option>`).join('')}</select></label>
          </div>
          <div class="actions"><button type="button" class="danger" data-run-review-trigger69>Flag full review</button></div>
          <div class="card-list">${recent}</div>
        </div>`;
      const scope=$69('reviewTriggerScope69'),wrap=$69('reviewTriggerDepartmentWrap69');
      if(scope&&wrap)scope.onchange=()=>{wrap.hidden=scope.value!=='DEPARTMENT'};
    }

    renderAdmin=async function(){
      const out=await core.renderAdmin.apply(this,arguments);
      await load69();
      renderAdmin69();
      return out;
    };
    try{window.renderAdmin=renderAdmin}catch(_e){}

    function renderResponsibilityNotice71(){
      const view=$69('mySafetyView');if(!view)return;
      let box=$69('responsibilityNotice71');
      const notices=(state.responsibilityNotices71||[]).filter(x=>!x.acknowledged_at);
      if(!notices.length){if(box)box.remove();return}
      const n=notices[0];
      if(!box){
        box=document.createElement('div');
        box.id='responsibilityNotice71';
        box.className='section-card traffic-amber';
        const heading=view.querySelector('.page-heading');
        if(heading)heading.insertAdjacentElement('afterend',box);else view.insertAdjacentElement('afterbegin',box);
      }
      box.innerHTML=`<div class="row-between"><div><h3>H&S responsibility assigned</h3><p>${esc69(n.message)}</p><p class="muted">Assigned ${esc69(fmtDateTime(n.created_at))}</p></div><button type="button" class="primary" data-ack-responsibility71="${n.id}">Acknowledge</button></div>`;
    }

    renderMySafety=function(){
      const out=core.renderMySafety.apply(this,arguments);
      setTimeout(renderResponsibilityNotice71,0);
      return out;
    };
    try{window.renderMySafety=renderMySafety}catch(_e){}

    async function acknowledgeResponsibility71(id){
      const r=await sb.rpc('ack_safety_responsibility_notice_v21071',{p_notice_id:id});
      if(r.error)return toast69(r.error.message);
      await loadResponsibilityNotices71();
      renderResponsibilityNotice71();
      toast69('H&S responsibility acknowledged.');
    }

    function decoratePeople69(){
      if(!admin69())return;
      document.querySelectorAll('#peopleList button[data-set-role]').forEach(btn=>{
        const uid=btn.dataset.setRole,card=btn.closest('.item-card');
        if(!uid||!card)return;
        const meta=card.querySelector('.meta');
        if(meta&&!meta.querySelector('.positions69-badge')){
          const rows=userPositionRows69(uid);
          const b=document.createElement('span');
          b.className=`badge positions69-badge ${rows.length?'complete':'due'}`;
          b.textContent=rows.length?positionSummary69(uid):'No position assigned';
          meta.appendChild(b);
        }
        const bar=card.querySelector('.action-bar');
        if(bar&&!bar.querySelector('[data-user-positions69]')){
          const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.userPositions69=uid;b.textContent='Positions';bar.insertBefore(b,bar.firstChild);
        }
      });
    }

    renderPeople=function(){
      const out=core.renderPeople.apply(this,arguments);
      setTimeout(decoratePeople69,0);
      return out;
    };
    try{window.renderPeople=renderPeople}catch(_e){}

    function showUserPositions69(uid){
      if(!admin69())return;
      const p=person69(uid);if(!p)return;
      const current=userPositionRows69(uid),selected=new Set(current.map(x=>x.position_id)),main=current.find(x=>x.is_primary)?.position_id||'';
      const rows=activePositions69().map(pos=>{
        const deps=positionDepartmentIds69(pos.id).map(deptLabel69).join(' + ')||'No department';
        return `<div class="item-card compact position-choice69"><label class="check-row"><input type="checkbox" class="user-position-choice69" value="${pos.id}" ${selected.has(pos.id)?'checked':''}> <strong>${esc69(pos.name)}</strong> <span class="muted">· ${esc69(deps)}</span></label><label class="check-row"><input type="radio" name="mainPosition69" class="main-position-choice69" value="${pos.id}" ${main===pos.id?'checked':''} ${selected.has(pos.id)?'':'disabled'}> Main / Default</label></div>`;
      }).join('')||'<div class="muted">Create a position in Admin first.</div>';
      openModal('Positions · '+(p.display_name||p.email),`
        <div class="hint-box">Select every position this person actively covers. Cross-training is automatic because each selected position contributes its own department requirements. Choose exactly one Main/Default position when one or more positions are selected.</div>
        <div id="userPositionChoices69" class="card-list">${rows}</div>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-save-user-positions69="${uid}">Save positions</button></div>`);
      document.querySelectorAll('.user-position-choice69').forEach(cb=>cb.addEventListener('change',()=>{
        const radio=document.querySelector(`.main-position-choice69[value="${cb.value}"]`);
        if(radio){radio.disabled=!cb.checked;if(!cb.checked&&radio.checked)radio.checked=false}
        const checked=[...document.querySelectorAll('.user-position-choice69:checked')];
        const mains=[...document.querySelectorAll('.main-position-choice69:checked')];
        if(checked.length===1&&!mains.length){
          const r=document.querySelector(`.main-position-choice69[value="${checked[0].value}"]`);if(r)r.checked=true;
        }
      }));
    }

    async function saveUserPositions69(uid){
      const ids=[...document.querySelectorAll('.user-position-choice69:checked')].map(x=>x.value);
      const primary=document.querySelector('.main-position-choice69:checked')?.value||null;
      if(ids.length&&!primary)return toast69('Choose one Main/Default position.');
      const r=await sb.rpc('set_user_positions_v21069',{p_user_id:uid,p_position_ids:ids,p_primary_position_id:primary});
      if(r.error)return toast69(r.error.message);
      closeModal();await refresh('Positions saved. Department-based training has been recalculated automatically.');
    }

    function showPositionEditor69(id=''){
      if(!admin69())return;
      const p=id?position69(id):null;
      const depOpts=state.departments.filter(d=>d.active!==false).map(d=>`<option value="${d.id}" ${p?.primary_department_id===d.id?'selected':''}>${esc69(d.name)}</option>`).join('');
      openModal(p?'Edit position':'New position',`
        <div class="form-grid"><label>Position name<input id="positionName69" maxlength="120" value="${esc69(p?.name||'')}" placeholder="Enter your own position title"></label><label>Department<select id="positionDepartment69"><option value="">No department</option>${depOpts}</select></label><label class="full">Description / purpose<textarea id="positionDescription69" rows="3">${esc69(p?.description||'')}</textarea></label></div>
        <div class="hint-box"><strong>One position = one department.</strong> Cross-training is created by assigning the <strong>user multiple positions</strong>. Each extra position brings in that position's department requirements automatically.</div>
        <div class="actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="button" class="primary" data-save-position69="${id}">Save position</button></div>`);
    }

    async function savePosition69(id=''){
      const name=clean69($69('positionName69')?.value),description=clean69($69('positionDescription69')?.value);
      const department=$69('positionDepartment69')?.value||null;
      if(!name)return toast69('Position name is required.');
      const deps=department?[department]:[];
      const r=await sb.rpc('save_safety_position_v21069',{p_position_id:id||null,p_name:name,p_description:description||null,p_department_ids:deps,p_primary_department_id:department});
      if(r.error)return toast69(r.error.message);
      closeModal();await refresh(id?'Position updated. User cross-training has been recalculated.':'Position created.');
    }

    async function togglePosition69(id){
      const p=position69(id);if(!p)return;
      const r=await sb.rpc('set_safety_position_active_v21069',{p_position_id:id,p_active:p.active===false});
      if(r.error)return toast69(r.error.message);
      await refresh(p.active===false?'Position restored.':'Position archived. Existing history is retained.');
    }

    function departmentReviewCount69(dep){
      const docIds=new Set((state.documentAudiences||[])
        .filter(a=>a.target_type==='DEPARTMENT'&&a.department_id===dep)
        .map(a=>a.document_id));
      const docs=(state.documents||[]).filter(d=>docIds.has(d.id)&&d.status!=='ARCHIVED'&&['RISK_ASSESSMENT','COSHH','SSW'].includes(String(d.doc_type||'').toUpperCase()));
      const tbtIds=new Set((state.trainingAudiences||[])
        .filter(a=>a.target_type==='DEPARTMENT'&&a.department_id===dep)
        .map(a=>a.training_session_id));
      const tbts=(state.training||[]).filter(t=>tbtIds.has(t.id)&&t.status!=='ARCHIVED'&&String(t.source_kind||t.session_type||'').toUpperCase()==='TOOLBOX_TALK');
      return {docs:docs.length,tbts:tbts.length,total:docs.length+tbts.length};
    }

    async function setResponsibility69(type,dep=null,userId=null){
      const existing=currentResponsibility69(type,dep);
      const nextId=userId||null;

      if(type==='DEPARTMENT_MANAGER' && existing && existing.user_id!==nextId){
        const oldName=personLabel69(existing.user_id);
        const newName=nextId?personLabel69(nextId):'Not assigned';
        const count=departmentReviewCount69(dep);
        const ok=confirm(
          `WARNING — DEPARTMENT RESPONSIBLE MANAGER CHANGE

`+
          `Changing ${deptLabel69(dep)} from ${oldName} to ${newName} will automatically flag ALL controlled H&S material assigned to this department for full review.

`+
          `Currently matched: ${count.total} controlled item${count.total===1?'':'s'} (${count.docs} RA/COSHH/SSW + ${count.tbts} Toolbox Talk${count.tbts===1?'':'s'}).

`+
          `Existing approved versions remain current while the review is completed. No replacement versions are created automatically.

Continue?`
        );
        if(!ok)return;
      }

      if(type==='HS_MANAGER' && existing && existing.user_id!==nextId){
        const oldName=personLabel69(existing.user_id);
        const newName=nextId?personLabel69(nextId):'Not assigned';
        const ok=confirm(
          `Change overall H&S Manager / Officer from ${oldName} to ${newName}?

`+
          `This change will NOT trigger a full review of all hotel documents. `+
          `The new H&S Manager / Officer will receive a responsibility message telling them they are responsible for overseeing controlled H&S documents, outstanding reviews and training/compliance actions.

Continue?`
        );
        if(!ok)return;
      }

      const r=await sb.rpc('set_safety_responsibility_v21069',{p_responsibility_type:type,p_department_id:dep,p_user_id:nextId});
      if(r.error)return toast69(r.error.message);
      await refresh(type==='HS_MANAGER'
        ? 'H&S Manager / Officer responsibility saved. The new holder has been notified; no hotel-wide review was triggered.'
        : 'Department responsible manager saved. Any required department review flags have been created automatically.');
    }

    async function runReviewTrigger69(){
      const scope=$69('reviewTriggerScope69')?.value||'COMPANY',reason=$69('reviewTriggerReason69')?.value||'MANAGEMENT_REVIEW',dep=scope==='DEPARTMENT'?($69('reviewTriggerDepartment69')?.value||null):null;
      if(scope==='DEPARTMENT'&&!dep)return toast69('Select the department first.');
      const label=scope==='COMPANY'?'all controlled hotel H&S material':`the controlled H&S material for ${deptLabel69(dep)}`;
      if(!confirm(`Flag ${label} for full review? Only the review trigger is recorded; do not enter accident/personal details in Safety Tracker.`))return;
      const r=await sb.rpc('flag_safety_review_v21069',{p_scope_type:scope,p_department_id:dep,p_trigger_type:reason});
      if(r.error)return toast69(r.error.message);
      await refresh(`${Number(r.data||0)} controlled item${Number(r.data||0)===1?'':'s'} flagged for full review.`);
    }

    function decorateRoleEditor69(uid){
      if(!admin69())return;

      // Departments are now inherited from positions. Hide the old manual department
      // controls in the user editor so Admin assigns cross-training through positions.
      const deptSelect=$69('roleDepartment');
      if(deptSelect){
        const lab=deptSelect.closest('label');
        if(lab)lab.hidden=true;
      }
      const extraCb=document.querySelector('.role-extra-dept');
      if(extraCb){
        const section=extraCb.closest('.section-card');
        if(section)section.hidden=true;
      }

      const current=userPositionRows69(uid);
      const selected=new Set(current.map(x=>x.position_id));
      const main=current.find(x=>x.is_primary)?.position_id||'';
      const rows=activePositions69().map(pos=>{
        const dep=pos.primary_department_id?deptLabel69(pos.primary_department_id):'No department';
        return `<div class="item-card compact"><label class="check-row"><input type="checkbox" class="edit-user-position-choice69" value="${pos.id}" ${selected.has(pos.id)?'checked':''}> <strong>${esc69(pos.name)}</strong> <span class="muted">· ${esc69(dep)}</span></label><label class="check-row"><input type="radio" name="editUserMainPosition69" class="edit-user-main-position69" value="${pos.id}" ${main===pos.id?'checked':''} ${selected.has(pos.id)?'':'disabled'}> Main / Default position</label></div>`;
      }).join('')||'<div class="muted">No positions configured yet. Create positions in Admin → Positions & Responsibilities.</div>';

      const body=$69('modalBody');
      if(body&&!$69('editUserPositions69')){
        const sec=document.createElement('div');
        sec.id='editUserPositions69';
        sec.className='section-card';
        sec.innerHTML=`<h4>Positions / cross-training</h4><p class="muted">Assign this user every position they cover. Each position belongs to one department, so multiple positions automatically give the user the correct cross-department training. Choose one Main/Default position.</p><div class="card-list">${rows}</div>`;
        const viewHeading=[...body.querySelectorAll('.section-card h4')].find(x=>x.textContent.includes('User Mode preferences'));
        const viewSection=viewHeading?.closest('.section-card');
        if(viewSection)viewSection.insertAdjacentElement('beforebegin',sec);
        else body.querySelector('.actions')?.insertAdjacentElement('beforebegin',sec);

        sec.querySelectorAll('.edit-user-position-choice69').forEach(cb=>cb.addEventListener('change',()=>{
          const radio=sec.querySelector(`.edit-user-main-position69[value="${cb.value}"]`);
          if(radio){
            radio.disabled=!cb.checked;
            if(!cb.checked&&radio.checked)radio.checked=false;
          }
          const checked=[...sec.querySelectorAll('.edit-user-position-choice69:checked')];
          const mains=[...sec.querySelectorAll('.edit-user-main-position69:checked')];
          if(checked.length===1&&!mains.length){
            const r=sec.querySelector(`.edit-user-main-position69[value="${checked[0].value}"]`);
            if(r)r.checked=true;
          }
        }));
      }

      const oldHint=[...body?.querySelectorAll('.hint-box')||[]].find(x=>x.textContent.includes('Changing department membership'));
      if(oldHint)oldHint.innerHTML='<strong>User positions drive department training.</strong> The user may hold several positions for cross-training, but only one can be Main/Default. Existing sign-offs and evidence are retained.';
    }

    showSetRole=function(id){
      const out=core.showSetRole.apply(this,arguments);
      setTimeout(()=>decorateRoleEditor69(id),0);
      return out;
    };
    try{window.showSetRole=showSetRole}catch(_e){}

    saveRole=async function(id){
      if(admin69()&&$69('editUserPositions69')){
        const ids=[...document.querySelectorAll('.edit-user-position-choice69:checked')].map(x=>x.value);
        const primary=document.querySelector('.edit-user-main-position69:checked')?.value||null;
        if(ids.length&&!primary)return toast69('Choose one Main/Default position.');

        const pr=await sb.rpc('set_user_positions_v21069',{
          p_user_id:id,
          p_position_ids:ids,
          p_primary_position_id:primary
        });
        if(pr.error)return toast69(pr.error.message);

        // Once positions are being used, remove old manual department selections.
        // Effective departments are immediately rebuilt from the user's positions.
        if(ids.length){
          const dept=$69('roleDepartment');if(dept)dept.value='';
          document.querySelectorAll('.role-extra-dept').forEach(x=>x.checked=false);
        }
      }
      return core.saveRole.apply(this,arguments);
    };
    try{window.saveRole=saveRole}catch(_e){}

    function docResponsibilityHtml69(d){
      const rows=(state.documentAudiences||[]).filter(x=>x.document_id===d.id);
      const everyone=rows.some(x=>x.target_type==='EVERYONE');
      const deps=[...new Set(rows.filter(x=>x.target_type==='DEPARTMENT'&&x.department_id).map(x=>x.department_id))];
      const hs=currentResponsibility69('HS_MANAGER');
      const lines=[];
      if(everyone){
        lines.push(`<strong>Whole hotel / Everyone</strong> · overall H&S responsibility: ${esc69(hs?personLabel69(hs.user_id):'H&S Manager not assigned')}`);
      }else if(deps.length){
        for(const dep of deps){
          const r=currentResponsibility69('DEPARTMENT_MANAGER',dep);
          lines.push(`<strong>${esc69(deptLabel69(dep))}</strong> · responsible manager: ${esc69(r?personLabel69(r.user_id):'not assigned')}`);
        }
        lines.push(`Overall H&S oversight: ${esc69(hs?personLabel69(hs.user_id):'H&S Manager not assigned')}`);
      }else{
        lines.push(`Overall H&S oversight: ${esc69(hs?personLabel69(hs.user_id):'H&S Manager not assigned')}`);
      }
      return `<div id="docResponsibility69" class="section-card"><h4>Responsibility & company policy</h4><div class="card-list">${lines.map(x=>`<div class="item-card compact">${x}</div>`).join('')}</div>${['RISK_ASSESSMENT','COSHH','SSW'].includes(String(d.doc_type||'').toUpperCase())?'<div class="hint-box"><strong>Company standard:</strong> training defaults to every 6 months but Manager/Admin can change each training frequency; controlled-document review remains at least annual. Company-wide material should use Everyone once rather than duplicate copies in each department.</div>':''}</div>`;
    }

    showDocDetails=function(id){
      const out=core.showDocDetails.apply(this,arguments);
      setTimeout(()=>{
        if(!manager69())return;
        const d=(state.documents||[]).find(x=>x.id===id),body=$69('modalBody');
        if(!d||!body||$69('docResponsibility69'))return;
        const wrap=document.createElement('div');wrap.innerHTML=docResponsibilityHtml69(d);
        const el=wrap.firstElementChild;
        const actions=[...body.querySelectorAll('.actions')].pop();
        if(actions)actions.insertAdjacentElement('beforebegin',el);else body.appendChild(el);
      },60);
      return out;
    };
    try{window.showDocDetails=showDocDetails}catch(_e){}

    function defaultSixMonthUi69(prefix,forceNew=false){
      const sel=$69(prefix+'RenewalPreset');
      if(!sel)return;
      if(forceNew || !sel.value){
        sel.value='6|MONTHS';
        const custom=$69(prefix+'CustomRenewal');if(custom)custom.hidden=true;
      }
      sel.disabled=false;
      const parent=sel.closest('label')||sel.parentElement;
      if(parent&&!parent.querySelector('.policy69-inline')){
        const s=document.createElement('span');s.className='muted policy69-inline';
        s.textContent='Default: every 6 months. Manager/Admin can change this.';
        parent.appendChild(s);
      }
    }

    function decoratePolicyUi69(){
      const audience=$69('approvalAudienceSection');
      if(audience&&!$69('companyWideAudienceHint69')){
        const h=document.createElement('div');h.id='companyWideAudienceHint69';h.className='hint-box';
        h.innerHTML='<strong>Whole-hotel rule:</strong> select <strong>Everyone</strong> once for a company-wide document such as a whole-hotel slips/trips assessment. Do not create or assign duplicate department copies.';
        audience.insertAdjacentElement('afterbegin',h);
      }
      const newDocAudience=$69('newDocAudienceAudienceSection');
      if(newDocAudience&&!$69('companyWideNewDocHint69')){
        const h=document.createElement('div');h.id='companyWideNewDocHint69';h.className='hint-box';
        h.innerHTML='<strong>Whole-hotel rule:</strong> use Everyone once for company-wide material. Department audiences are for department-specific requirements.';
        newDocAudience.insertAdjacentElement('afterbegin',h);
      }

      const docType=$69('docType')?.value;
      if(['RISK_ASSESSMENT','COSHH','SSW'].includes(docType)){
        const isNewDoc=!!$69('docTitle')&&!$69('editDocTitle');
        defaultSixMonthUi69('doc',isNewDoc);
        const dt=$69('docType');
        if(dt&&!dt.dataset.default69){
          dt.dataset.default69='1';
          dt.addEventListener('change',()=>setTimeout(()=>{
            if(['RISK_ASSESSMENT','COSHH','SSW'].includes(dt.value))defaultSixMonthUi69('doc',true);
          },0));
        }
      }
      if($69('editDocRenewalPreset'))defaultSixMonthUi69('editDoc',false);
      if($69('approvalTrainingRenewalPreset'))defaultSixMonthUi69('approvalTraining',false);
      if($69('trainRenewalPreset'))defaultSixMonthUi69('train',!$69('editTrainName'));
      if($69('editTrainRenewalPreset'))defaultSixMonthUi69('editTrain',false);
    }

    function observe69(){
      if(observer69)return;
      observer69=new MutationObserver(()=>{setTimeout(decoratePolicyUi69,0)});
      observer69.observe(document.body,{childList:true,subtree:true});
      [0,300,900,1800].forEach(ms=>setTimeout(decoratePolicyUi69,ms));
    }

    document.addEventListener('click',e=>{
      const b=e.target.closest('button');
      if(!b)return;
      if(b.hasAttribute('data-new-position69')){e.preventDefault();showPositionEditor69();return}
      if(b.dataset.editPosition69){e.preventDefault();showPositionEditor69(b.dataset.editPosition69);return}
      if(b.dataset.togglePosition69){e.preventDefault();togglePosition69(b.dataset.togglePosition69);return}
      if(b.hasAttribute('data-save-position69')){e.preventDefault();savePosition69(b.dataset.savePosition69||'');return}
      if(b.dataset.userPositions69){e.preventDefault();showUserPositions69(b.dataset.userPositions69);return}
      if(b.dataset.saveUserPositions69){e.preventDefault();saveUserPositions69(b.dataset.saveUserPositions69);return}
      if(b.hasAttribute('data-save-hs-manager69')){e.preventDefault();setResponsibility69('HS_MANAGER',null,$69('hsManager69')?.value||null);return}
      if(b.dataset.saveDeptManager69){e.preventDefault();setResponsibility69('DEPARTMENT_MANAGER',b.dataset.saveDeptManager69,$69('deptManager69_'+b.dataset.saveDeptManager69)?.value||null);return}
      if(b.hasAttribute('data-run-review-trigger69')){e.preventDefault();runReviewTrigger69();return}
      if(b.dataset.ackResponsibility71){e.preventDefault();acknowledgeResponsibility71(b.dataset.ackResponsibility71);return}
    },true);

    Promise.all([load69(),loadResponsibilityNotices71()]).then(()=>{
      observe69();
      try{renderMySafety()}catch(_e){}
      if(admin69()){try{renderPeople();renderAdmin69()}catch(_e){}}
    });

    window.SafetyPositionsResponsibilitiesV21069={
      BUILD,
      load:load69,
      positionSummary:positionSummary69,
      currentResponsibility:currentResponsibility69
    };
  }

  boot();
})();
