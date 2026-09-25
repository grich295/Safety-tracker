/* Safety Tracker v2.11.21 - generic-document responsibility selectors, position audiences, review frequency */
'use strict';
(function(){
  if(window.__SAFETY_GENERIC_DOC_CONTROLS_V21121)return;
  window.__SAFETY_GENERIC_DOC_CONTROLS_V21121=true;

  let api,state,sb;
  let positions=[],positionDepartments=[],userPositions=[],responsibilities=[],departmentLeads=[],audiences=[];
  let loadPromise=null,decorating=false;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const clean=s=>String(s??'').replace(/\r/g,'').trim();
  const today=()=>new Date().toISOString().slice(0,10);
  const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
  const activePeople=()=> (state.people||[]).filter(p=>p.active!==false&&p.report_only!==true)
    .sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  const activeDepartments=()=> (state.departments||[]).filter(d=>d.active!==false)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const activePositions=()=> positions.filter(p=>p.active!==false)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const personName=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Unknown user'};
  const departmentName=id=>(state.departments||[]).find(x=>x.id===id)?.name||'';
  const positionName=id=>positions.find(x=>x.id===id)?.name||'';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';

  async function loadReferenceData(force=false){
    if(loadPromise&&!force)return loadPromise;
    loadPromise=(async()=>{
      const qs=await Promise.all([
        sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
        sb.from('safety_position_departments_v21069').select('*'),
        sb.from('safety_user_positions_v21069').select('*').eq('active',true),
        sb.from('safety_responsibilities_v21069').select('*').eq('active',true),
        sb.from('department_leads_v21119').select('*'),
        sb.from('document_read_audiences_v21119').select('*')
      ]);
      if(!qs[0].error)positions=qs[0].data||[];
      if(!qs[1].error)positionDepartments=qs[1].data||[];
      if(!qs[2].error)userPositions=qs[2].data||[];
      if(!qs[3].error)responsibilities=qs[3].data||[];
      if(!qs[4].error)departmentLeads=qs[4].data||[];
      if(!qs[5].error)audiences=qs[5].data||[];
      state.positions69=positions;
      state.positionDepartments69=positionDepartments;
      state.userPositions69=userPositions;
      state.responsibilities69=responsibilities;
    })().finally(()=>{loadPromise=null});
    return loadPromise;
  }

  function mainPositionForUser(uid){
    const rows=userPositions.filter(x=>x.user_id===uid&&x.active!==false);
    return rows.find(x=>x.is_primary)||rows[0]||null;
  }
  function positionDepartmentIds(pid){
    const ids=positionDepartments.filter(x=>x.position_id===pid).map(x=>x.department_id);
    const p=positions.find(x=>x.id===pid);
    if(p?.primary_department_id&&!ids.includes(p.primary_department_id))ids.push(p.primary_department_id);
    return ids;
  }
  function currentHolders(pid){
    return userPositions.filter(x=>x.position_id===pid&&x.active!==false).map(x=>x.user_id);
  }
  function personLabel(uid){
    const p=(state.people||[]).find(x=>x.id===uid);
    const mp=mainPositionForUser(uid);
    const pos=mp?positionName(mp.position_id):'';
    return `${p?.display_name||p?.email||'User'}${pos?` — ${pos}`:''}`;
  }

  function responsibilityValueForDoc(d,kind){
    if(!d)return '';
    const posId=kind==='review'?d.review_responsible_position_id:d.approval_responsible_position_id;
    const userId=kind==='review'?d.review_responsible_user_id:d.approval_responsible_user_id;
    if(posId&&positions.some(p=>p.id===posId))return `POSITION:${posId}`;
    if(userId&&(state.people||[]).some(p=>p.id===userId))return `USER:${userId}`;
    const legacy=clean(kind==='review'?d.review_responsibility:d.approval_responsibility).toLowerCase();
    if(legacy){
      const pos=positions.find(p=>clean(p.name).toLowerCase()===legacy);
      if(pos)return `POSITION:${pos.id}`;
      const user=(state.people||[]).find(p=>clean(p.display_name||p.email).toLowerCase()===legacy);
      if(user)return `USER:${user.id}`;
    }
    return '';
  }

  function responsibilityOptions(selected=''){
    const posOpts=activePositions().map(p=>{
      const holders=currentHolders(p.id).map(personName).filter(Boolean);
      const dep=departmentName(p.primary_department_id);
      const suffix=[dep,holders.length?`Holder: ${holders.join(', ')}`:'Vacant'].filter(Boolean).join(' · ');
      return `<option value="POSITION:${p.id}" ${selected===`POSITION:${p.id}`?'selected':''}>${esc(p.name)}${suffix?` — ${esc(suffix)}`:''}</option>`;
    }).join('');
    const userOpts=activePeople().map(p=>
      `<option value="USER:${p.id}" ${selected===`USER:${p.id}`?'selected':''}>${esc(personLabel(p.id))}</option>`
    ).join('');
    return `<option value="">Not assigned</option>
      <optgroup label="Positions">${posOpts||'<option disabled>No positions configured</option>'}</optgroup>
      <optgroup label="People">${userOpts||'<option disabled>No active users</option>'}</optgroup>`;
  }

  function responsibilityPayload(value,kind){
    const out={
      [`${kind}_responsibility`]:null,
      [`${kind}_responsible_user_id`]:null,
      [`${kind}_responsible_position_id`]:null
    };
    if(!value)return out;
    const [type,id]=String(value).split(':');
    if(type==='POSITION'){
      out[`${kind}_responsible_position_id`]=id||null;
      out[`${kind}_responsibility`]=positionName(id)||null;
    }else if(type==='USER'){
      out[`${kind}_responsible_user_id`]=id||null;
      out[`${kind}_responsibility`]=personName(id)||null;
    }
    return out;
  }

  function preferredPositionForUser(uid,depId=''){
    const rows=userPositions.filter(x=>x.user_id===uid&&x.active!==false);
    const matching=rows.find(x=>positionDepartmentIds(x.position_id).includes(depId));
    return matching||rows.find(x=>x.is_primary)||rows[0]||null;
  }

  function scopeSuggestion(sel){
    if(sel.everyone){
      const hs=responsibilities.find(x=>x.responsibility_type==='HS_MANAGER'&&!x.department_id&&x.active!==false);
      if(hs?.user_id)return `USER:${hs.user_id}`;
      const hsPos=activePositions().find(p=>/\b(h\s*&\s*s|health\s*(and|&)\s*safety|safety\s+manager)\b/i.test(p.name||''));
      if(hsPos)return `POSITION:${hsPos.id}`;
      return state.user?.id?`USER:${state.user.id}`:'';
    }
    if(sel.departments.length===1){
      const dep=sel.departments[0];
      const mgr=responsibilities.find(x=>x.responsibility_type==='DEPARTMENT_MANAGER'&&x.department_id===dep&&x.active!==false);
      const lead=departmentLeads.find(x=>x.department_id===dep);
      const uid=mgr?.user_id||lead?.user_id||'';
      if(uid){
        const up=preferredPositionForUser(uid,dep);
        if(up)return `POSITION:${up.position_id}`;
        return `USER:${uid}`;
      }
      const managerPosition=activePositions().find(p=>
        positionDepartmentIds(p.id).includes(dep)&&/\b(manager|head|lead)\b/i.test(p.name||'')
      );
      if(managerPosition)return `POSITION:${managerPosition.id}`;
    }
    return state.user?.id?`USER:${state.user.id}`:'';
  }

  function addInterval(iso,value,unit){
    const d=new Date((iso||today())+'T12:00:00');
    const n=Math.max(1,Number(value)||12);
    if(unit==='DAYS')d.setDate(d.getDate()+n);
    else if(unit==='YEARS')d.setFullYear(d.getFullYear()+n);
    else d.setMonth(d.getMonth()+n);
    return d.toISOString().slice(0,10);
  }

  function inferredFrequency(d){
    const value=Number(d?.review_frequency_value||0);
    const unit=d?.review_frequency_unit||'';
    if(value&&unit)return {value,unit};
    return {value:12,unit:'MONTHS'};
  }

  function frequencyPreset(freq){
    const key=`${Number(freq?.value||12)}|${freq?.unit||'MONTHS'}`;
    return ['3|MONTHS','6|MONTHS','12|MONTHS','24|MONTHS','36|MONTHS','1|YEARS','2|YEARS','3|YEARS'].includes(key)?key:'CUSTOM';
  }

  function reviewFrequencyHtml(prefix,freq={value:12,unit:'MONTHS'}){
    const preset=frequencyPreset(freq);
    return `<label>Review frequency
      <select id="${prefix}ReviewFrequencyPreset">
        <option value="3|MONTHS" ${preset==='3|MONTHS'?'selected':''}>Every 3 months</option>
        <option value="6|MONTHS" ${preset==='6|MONTHS'?'selected':''}>Every 6 months</option>
        <option value="12|MONTHS" ${preset==='12|MONTHS'?'selected':''}>Every 12 months</option>
        <option value="24|MONTHS" ${preset==='24|MONTHS'?'selected':''}>Every 24 months</option>
        <option value="36|MONTHS" ${preset==='36|MONTHS'?'selected':''}>Every 36 months</option>
        <option value="CUSTOM" ${preset==='CUSTOM'?'selected':''}>Custom…</option>
      </select>
      <span class="muted">Default is every 12 months. Manager/Admin can override it.</span>
    </label>
    <div id="${prefix}ReviewFrequencyCustom" class="form-grid full" ${preset==='CUSTOM'?'':'hidden'}>
      <label>Every<input id="${prefix}ReviewFrequencyValue" type="number" min="1" max="1200" value="${preset==='CUSTOM'?Number(freq.value||12):Number(freq.value||12)}"></label>
      <label>Unit<select id="${prefix}ReviewFrequencyUnit">
        <option value="DAYS" ${freq.unit==='DAYS'?'selected':''}>Days</option>
        <option value="MONTHS" ${freq.unit==='MONTHS'?'selected':''}>Months</option>
        <option value="YEARS" ${freq.unit==='YEARS'?'selected':''}>Years</option>
      </select></label>
    </div>`;
  }

  function getFrequency(prefix){
    const p=$(`${prefix}ReviewFrequencyPreset`)?.value||'12|MONTHS';
    if(p==='CUSTOM'){
      return {
        value:Math.max(1,Number($(`${prefix}ReviewFrequencyValue`)?.value)||12),
        unit:$(`${prefix}ReviewFrequencyUnit`)?.value||'MONTHS'
      };
    }
    const [v,u]=p.split('|');
    return {value:Number(v)||12,unit:u||'MONTHS'};
  }

  function wireFrequency(prefix,baseDateId,nextDateId){
    const preset=$(`${prefix}ReviewFrequencyPreset`),custom=$(`${prefix}ReviewFrequencyCustom`);
    const recalc=()=>{
      const f=getFrequency(prefix);
      const next=$(nextDateId),base=$(baseDateId)?.value||today();
      if(next)next.value=addInterval(base,f.value,f.unit);
    };
    preset?.addEventListener('change',()=>{
      if(custom)custom.hidden=preset.value!=='CUSTOM';
      recalc();
    });
    $(`${prefix}ReviewFrequencyValue`)?.addEventListener('input',recalc);
    $(`${prefix}ReviewFrequencyUnit`)?.addEventListener('change',recalc);
    $(baseDateId)?.addEventListener('change',recalc);
  }

  function selectedRowsForDocument(docId){
    return audiences.filter(x=>x.document_id===docId);
  }

  function audienceState(prefix){
    return {
      everyone:!!$(`${prefix}Everyone`)?.checked,
      departments:[...document.querySelectorAll(`[data-${prefix}-dep]:checked`)].map(x=>x.value),
      positions:[...document.querySelectorAll(`[data-${prefix}-position]:checked`)].map(x=>x.value),
      users:[...document.querySelectorAll(`[data-${prefix}-user]:checked`)].map(x=>x.value),
      dueDays:Math.max(0,Math.min(3650,Number($(`${prefix}DueDays`)?.value)||14))
    };
  }

  function compactAudienceHtml(prefix,rows=[],dueDays=14){
    const everyone=rows.some(x=>x.target_type==='EVERYONE');
    const depSet=new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const posSet=new Set(rows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const userSet=new Set(rows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    const depItems=activeDepartments().map(d=>`<label><input type="checkbox" data-${prefix}-dep value="${d.id}" ${depSet.has(d.id)?'checked':''}><span>${esc(d.name)}</span></label>`).join('');
    const posItems=activePositions().map(p=>{
      const holders=currentHolders(p.id).map(personName).filter(Boolean);
      return `<label><input type="checkbox" data-${prefix}-position value="${p.id}" ${posSet.has(p.id)?'checked':''}><span><strong>${esc(p.name)}</strong>${holders.length?` <span class="muted">· ${esc(holders.join(', '))}</span>`:' <span class="muted">· vacant</span>'}</span></label>`;
    }).join('');
    const userItems=activePeople().map(p=>`<label><input type="checkbox" data-${prefix}-user value="${p.id}" ${userSet.has(p.id)?'checked':''}><span>${esc(personLabel(p.id))}</span></label>`).join('');
    return `<div class="full v21121-reader-panel" data-v21121-audience="${prefix}">
      <div class="row-between"><div><h4>Who needs to read it?</h4><p class="muted">Reading is an acknowledgement, not formal training. Positions automatically follow the current holder(s).</p></div>
      <label class="check-row v21121-everyone"><input id="${prefix}Everyone" type="checkbox" ${everyone?'checked':''}> <strong>Everyone / whole hotel</strong></label></div>
      <div class="v21121-reader-grid">
        <details class="v21121-reader-group" ${depSet.size?'open':''}><summary>Departments <span data-v21121-count="${prefix}-dep">${depSet.size||''}</span></summary><div class="generic-audience-v21119">${depItems||'<span class="muted">No departments.</span>'}</div></details>
        <details class="v21121-reader-group" ${posSet.size?'open':''}><summary>Positions <span data-v21121-count="${prefix}-position">${posSet.size||''}</span></summary><div class="generic-audience-v21119">${posItems||'<span class="muted">No positions.</span>'}</div></details>
        <details class="v21121-reader-group" ${userSet.size?'open':''}><summary>Specific people <span data-v21121-count="${prefix}-user">${userSet.size||''}</span></summary><div class="generic-audience-v21119">${userItems||'<span class="muted">No active users.</span>'}</div></details>
      </div>
      <div class="v21121-reader-footer">
        <label>Read within <span class="v21121-inline-number"><input id="${prefix}DueDays" type="number" min="0" max="3650" value="${Number(dueDays)||14}"> days</span></label>
        <div id="${prefix}AudienceSummary" class="muted"></div>
      </div>
    </div>`;
  }

  function updateAudienceUi(prefix){
    const s=audienceState(prefix);
    document.querySelectorAll(`[data-${prefix}-dep],[data-${prefix}-position],[data-${prefix}-user]`).forEach(x=>x.disabled=s.everyone);
    for(const type of ['dep','position','user']){
      const count=document.querySelectorAll(`[data-${prefix}-${type}]:checked`).length;
      const el=document.querySelector(`[data-v21121-count="${prefix}-${type}"]`);
      if(el)el.textContent=count?String(count):'';
    }
    const box=$(`${prefix}AudienceSummary`);
    if(box){
      if(s.everyone)box.textContent='Everyone / whole hotel will receive the read requirement.';
      else{
        const bits=[];
        if(s.departments.length)bits.push(`${s.departments.length} department${s.departments.length===1?'':'s'}`);
        if(s.positions.length)bits.push(`${s.positions.length} position${s.positions.length===1?'':'s'}`);
        if(s.users.length)bits.push(`${s.users.length} specific person${s.users.length===1?'':'s'}`);
        box.textContent=bits.length?`Selected: ${bits.join(' + ')}`:'No required readers selected yet.';
      }
    }
  }

  function applySuggestedResponsibility(prefix,force=false){
    const rev=$(`${prefix}ReviewResponsible`),app=$(`${prefix}ApprovalResponsible`);
    if(!rev||!app)return;
    const suggestion=scopeSuggestion(audienceState(prefix));
    for(const sel of [rev,app]){
      if(force||sel.dataset.manual!=='1'){
        if([...sel.options].some(o=>o.value===suggestion))sel.value=suggestion;
      }
    }
  }

  function wireAudience(prefix){
    const panel=document.querySelector(`[data-v21121-audience="${prefix}"]`);
    if(!panel)return;
    panel.addEventListener('change',e=>{
      updateAudienceUi(prefix);
      if(e.target.matches(`#${prefix}Everyone,[data-${prefix}-dep],[data-${prefix}-position],[data-${prefix}-user]`)){
        applySuggestedResponsibility(prefix,false);
      }
    });
    updateAudienceUi(prefix);
  }

  async function saveAudience(docId,sel){
    const del=await sb.from('document_read_audiences_v21119').delete().eq('document_id',docId);
    if(del.error)throw del.error;
    const rows=[];
    if(sel.everyone)rows.push({document_id:docId,target_type:'EVERYONE',due_days:sel.dueDays,created_by:state.user.id});
    if(!sel.everyone){
      for(const id of sel.departments)rows.push({document_id:docId,target_type:'DEPARTMENT',department_id:id,due_days:sel.dueDays,created_by:state.user.id});
      for(const id of sel.positions)rows.push({document_id:docId,target_type:'POSITION',position_id:id,due_days:sel.dueDays,created_by:state.user.id});
      for(const id of sel.users)rows.push({document_id:docId,target_type:'USER',user_id:id,due_days:sel.dueDays,created_by:state.user.id});
    }
    if(rows.length){
      const ins=await sb.from('document_read_audiences_v21119').insert(rows);
      if(ins.error)throw ins.error;
    }
    audiences=audiences.filter(x=>x.document_id!==docId).concat(rows);
  }

  function makePdfBlob(meta,content){
    const JsPDF=window.jspdf?.jsPDF;
    if(!JsPDF)throw new Error('PDF library did not load. Refresh and try again.');
    const doc=new JsPDF({unit:'mm',format:'a4'}),left=15,right=15,width=210-left-right;
    let y=17;
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('SAFETY TRACKER — CONTROLLED DOCUMENT',left,y);
    y+=8;doc.setFontSize(16);
    const titleLines=doc.splitTextToSize(meta.title||'Untitled document',width);
    doc.text(titleLines,left,y);y+=titleLines.length*7+2;
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    const details=[meta.reference?`Reference: ${meta.reference}`:null,`Version: ${meta.version}`,`Issue date: ${fmtDate(meta.issue)}`].filter(Boolean).join('   |   ');
    doc.text(details,left,y);y+=8;doc.line(left,y,210-right,y);y+=7;doc.setFontSize(10);
    for(const raw of String(content||'').replace(/\r/g,'').split('\n')){
      const wrapped=doc.splitTextToSize(raw||' ',width),need=Math.max(5,wrapped.length*5);
      if(y+need>278){doc.addPage();y=18}
      doc.text(wrapped,left,y);y+=need;
    }
    const pages=doc.getNumberOfPages();
    for(let p=1;p<=pages;p++){
      doc.setPage(p);doc.setFontSize(8);doc.setTextColor(100);
      doc.text(`Controlled copy — check Safety Tracker for current approval/review status. Page ${p} of ${pages}`,left,292);
      doc.setTextColor(0);
    }
    return doc.output('blob');
  }

  function responsibilityFields(prefix,d=null){
    const review=responsibilityValueForDoc(d,'review'),approval=responsibilityValueForDoc(d,'approval');
    return `<label>Responsible for review
      <select id="${prefix}ReviewResponsible">${responsibilityOptions(review)}</select>
      <span class="muted">Choose a position or a person. A position follows whoever currently holds it.</span>
    </label>
    <label>Responsible for approval
      <select id="${prefix}ApprovalResponsible">${responsibilityOptions(approval)}</select>
      <span class="muted">Suggested automatically from scope, but can be changed.</span>
    </label>`;
  }

  function selectedResponsibilityPayload(prefix){
    return {
      ...responsibilityPayload($(`${prefix}ReviewResponsible`)?.value||'','review'),
      ...responsibilityPayload($(`${prefix}ApprovalResponsible`)?.value||'','approval')
    };
  }

  function replaceLabelInput(inputId,newHtml){
    const input=$(inputId),label=input?.closest('label');
    if(label)label.outerHTML=newHtml;
  }

  async function decorateCreateModal(){
    const oldSave=document.querySelector('[data-v21119-save-plain]');
    if(!oldSave||oldSave.dataset.v21121Decorated==='1')return;
    await loadReferenceData(true);
    const sourceId=oldSave.dataset.templateSource||'';
    const source=sourceId?(state.documents||[]).find(x=>x.id===sourceId):null;
    const rows=sourceId?selectedRowsForDocument(sourceId):[];
    const due=rows[0]?.due_days||14;
    const freq=inferredFrequency(source);

    replaceLabelInput('v21119ReviewOwner',responsibilityFields('v21121Create',source).split('</label>')[0]+'</label>');
    replaceLabelInput('v21119ApprovalOwner',responsibilityFields('v21121Create',source).split('</label>')[1]+'</label>');

    const reviewDate=$('v21119DocReview');
    if(reviewDate){
      const label=reviewDate.closest('label');
      label?.insertAdjacentHTML('beforebegin',reviewFrequencyHtml('v21121Create',freq));
      if(!reviewDate.value)reviewDate.value=addInterval($('v21119DocIssue')?.value||today(),freq.value,freq.unit);
      label?.querySelector('span')?.remove();
    }

    const oldPanel=[...document.querySelectorAll('#modalBody .full')].find(el=>el.querySelector('h4')?.textContent?.trim()==='Who needs to read it?');
    if(oldPanel)oldPanel.outerHTML=compactAudienceHtml('v21121Create',rows,due);

    const rev=$('v21121CreateReviewResponsible'),app=$('v21121CreateApprovalResponsible');
    [rev,app].forEach(sel=>sel?.addEventListener('change',()=>{sel.dataset.manual='1'}));
    wireAudience('v21121Create');
    wireFrequency('v21121Create','v21119DocIssue','v21119DocReview');
    if(!responsibilityValueForDoc(source,'review')&&!responsibilityValueForDoc(source,'approval'))applySuggestedResponsibility('v21121Create',true);

    oldSave.removeAttribute('data-v21119-save-plain');
    oldSave.dataset.v21121SavePlain='1';
    oldSave.dataset.templateSource=sourceId;
    oldSave.dataset.v21121Decorated='1';
  }

  async function decorateControlsModal(){
    const oldSave=document.querySelector('[data-v21119-save-controls]');
    if(!oldSave||oldSave.dataset.v21121Decorated==='1')return;
    await loadReferenceData(true);
    const docId=oldSave.dataset.v21119SaveControls;
    const d=(state.documents||[]).find(x=>x.id===docId);
    if(!d)return;
    const rows=selectedRowsForDocument(docId),due=rows[0]?.due_days||14,freq=inferredFrequency(d);
    const v=api.pendingApprovalVersion(d.id)||api.approvedCurrentVersion(d.id)||api.currentVersion(d.id);

    replaceLabelInput('v21119CtrlReviewOwner',responsibilityFields('v21121Ctrl',d).split('</label>')[0]+'</label>');
    replaceLabelInput('v21119CtrlApprovalOwner',responsibilityFields('v21121Ctrl',d).split('</label>')[1]+'</label>');

    const templateLabel=$('v21119CtrlTemplate')?.closest('label');
    if(templateLabel){
      templateLabel.insertAdjacentHTML('afterend',`${reviewFrequencyHtml('v21121Ctrl',freq)}
        <label>Next review date<input id="v21121CtrlReviewDate" type="date" value="${esc(v?.review_date||addInterval(today(),freq.value,freq.unit))}">
        <span class="muted">Changing the frequency recalculates this date; you can still override the date.</span></label>`);
    }

    const oldPanel=[...document.querySelectorAll('#modalBody .full')].find(el=>el.querySelector('h4')?.textContent?.trim()==='Who needs to read it?');
    if(oldPanel)oldPanel.outerHTML=compactAudienceHtml('v21121Ctrl',rows,due);

    const rev=$('v21121CtrlReviewResponsible'),app=$('v21121CtrlApprovalResponsible');
    [rev,app].forEach(sel=>sel?.addEventListener('change',()=>{sel.dataset.manual='1'}));
    wireAudience('v21121Ctrl');
    wireFrequency('v21121Ctrl','v21121CtrlBaseDate','v21121CtrlReviewDate');

    // Controls do not show an issue date; use today's date as the base for a changed recurring review frequency.
    const hidden=document.createElement('input');hidden.type='hidden';hidden.id='v21121CtrlBaseDate';hidden.value=today();
    document.getElementById('modalBody')?.appendChild(hidden);

    oldSave.removeAttribute('data-v21119-save-controls');
    oldSave.dataset.v21121SaveControls=docId;
    oldSave.dataset.v21121Decorated='1';
  }

  async function savePlain(btn){
    const folder_id=$('v21119DocFolder')?.value||null;
    const title=clean($('v21119DocTitle')?.value),reference=clean($('v21119DocRef')?.value).toUpperCase()||null;
    const doc_type=$('v21119DocKind')?.value||'OTHER',issue=$('v21119DocIssue')?.value||today();
    const freq=getFrequency('v21121Create');
    const review=$('v21119DocReview')?.value||addInterval(issue,freq.value,freq.unit);
    const is_template=!!$('v21119IsTemplate')?.checked,content=clean($('v21119DocContent')?.value);
    const audience=audienceState('v21121Create');
    const resp=selectedResponsibilityPayload('v21121Create');
    if(!folder_id)return api.toast?.('Choose a folder.');
    if(!title)return api.toast?.('Document title is required.');
    if(!content)return api.toast?.('Add some document content.');

    btn.disabled=true;const oldText=btn.textContent;btn.textContent='Creating…';
    try{
      const documentId=crypto.randomUUID(),versionId=crypto.randomUUID(),version='1';
      const base=api.safeFileName(reference||title),file_name=`${base}-v1.pdf`,storage_path=`documents/${documentId}/${versionId}-${file_name}`;
      const pdf=makePdfBlob({title,reference,version,issue},content);
      const dIns=await sb.from('documents').insert({
        id:documentId,title,reference,doc_type,status:'ACTIVE',created_by:state.user.id,
        folder_id,is_template,content_mode:'PLAIN_TEXT',
        review_frequency_value:freq.value,review_frequency_unit:freq.unit,
        ...resp,created_from_document_id:btn.dataset.templateSource||null
      });
      if(dIns.error)throw dIns.error;
      const up=await sb.storage.from('safety-files').upload(storage_path,pdf,{contentType:'application/pdf'});
      if(up.error){await sb.from('documents').delete().eq('id',documentId);throw up.error}
      const vIns=await sb.from('document_versions').insert({
        id:versionId,document_id:documentId,version_label:'1',issue_date:issue,review_date:review,
        storage_path,file_name,notes:'Created in Safety Tracker plain document editor v2.11.21.',
        status:'CURRENT',approval_status:'PENDING',created_by:state.user.id,editable_content:content,content_format:'PLAIN_TEXT'
      });
      if(vIns.error){
        await sb.storage.from('safety-files').remove([storage_path]);
        await sb.from('documents').delete().eq('id',documentId);
        throw vIns.error;
      }
      await saveAudience(documentId,audience);
      try{$('modal')?.close()}catch(_e){}
      await api.refresh('Plain controlled document created as v1 Pending approval.');
      await loadReferenceData(true);
      window.SafetyGenericDocumentsV21119?.refresh?.();
    }catch(e){api.toast?.(e.message||'Could not create document.')}
    finally{btn.disabled=false;btn.textContent=oldText}
  }

  async function saveControls(btn){
    const docId=btn.dataset.v21121SaveControls;
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d)return;
    const freq=getFrequency('v21121Ctrl'),resp=selectedResponsibilityPayload('v21121Ctrl');
    const reviewDate=$('v21121CtrlReviewDate')?.value||addInterval(today(),freq.value,freq.unit);
    btn.disabled=true;const oldText=btn.textContent;btn.textContent='Saving…';
    try{
      const payload={
        folder_id:$('v21119CtrlFolder')?.value||null,
        is_template:!!$('v21119CtrlTemplate')?.checked,
        review_frequency_value:freq.value,review_frequency_unit:freq.unit,
        ...resp
      };
      const up=await sb.from('documents').update(payload).eq('id',docId);
      if(up.error)throw up.error;
      await saveAudience(docId,audienceState('v21121Ctrl'));
      const v=api.pendingApprovalVersion(docId)||api.approvedCurrentVersion(docId)||api.currentVersion(docId);
      if(v&&reviewDate){
        const vr=await sb.from('document_versions').update({review_date:reviewDate}).eq('id',v.id);
        if(vr.error)throw vr.error;
      }
      try{$('modal')?.close()}catch(_e){}
      await api.refresh('Document readers, responsibilities and review frequency updated.');
      await loadReferenceData(true);
      window.SafetyGenericDocumentsV21119?.refresh?.();
    }catch(e){api.toast?.(e.message||'Could not save document controls.')}
    finally{btn.disabled=false;btn.textContent=oldText}
  }

  function addStyles(){
    if($('genericDocControlsStyleV21121'))return;
    const s=document.createElement('style');s.id='genericDocControlsStyleV21121';s.textContent=`
      .v21121-reader-panel{border:1px solid var(--border,#d7dee7);border-radius:12px;padding:12px;margin-top:4px}
      .v21121-reader-panel h4{margin:0 0 3px}
      .v21121-reader-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
      .v21121-reader-group{border:1px solid var(--border,#d7dee7);border-radius:10px;background:var(--card,#fff)}
      .v21121-reader-group summary{cursor:pointer;font-weight:700;padding:10px 12px;display:flex;justify-content:space-between;gap:8px}
      .v21121-reader-group summary span:not(:empty){min-width:22px;text-align:center;border-radius:999px;padding:1px 7px;background:rgba(80,110,140,.12)}
      .v21121-reader-group .generic-audience-v21119{border:0;border-top:1px solid var(--border,#d7dee7);border-radius:0;max-height:180px}
      .v21121-reader-footer{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:10px}
      .v21121-reader-footer label{margin:0}.v21121-inline-number{display:inline-flex;align-items:center;gap:5px}
      .v21121-inline-number input{width:86px}
      .v21121-everyone{white-space:nowrap;margin:0}
      #modalBody select[id$="Responsible"]{min-height:44px}
      @media(max-width:850px){.v21121-reader-grid{grid-template-columns:1fr}.v21121-reader-group .generic-audience-v21119{max-height:150px}}
    `;
    document.head.appendChild(s);
  }

  function decorateApprovalFrequency(versionId){
    const v=(state.versions||[]).find(x=>x.id===versionId),d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||d.doc_type==='SDS'||$('approvalReviewFrequencyPreset'))return;
    const freq=inferredFrequency(d),date=$('approvalReviewDate'),dateLabel=date?.closest('label');
    if(!dateLabel)return;
    dateLabel.insertAdjacentHTML('beforebegin',reviewFrequencyHtml('approval',freq));
    wireFrequency('approval','approvalReviewFrequencyBase','approvalReviewDate');
    const hidden=document.createElement('input');hidden.type='hidden';hidden.id='approvalReviewFrequencyBase';hidden.value=v.issue_date||today();
    dateLabel.parentElement?.appendChild(hidden);
  }

  function decorateControlledReviewFrequency(docId){
    const d=(state.documents||[]).find(x=>x.id===docId);
    if(!d||d.doc_type==='SDS'||$('controlledReviewReviewFrequencyPreset'))return;
    const freq=inferredFrequency(d),next=$('nextReviewDate'),label=next?.closest('label');
    if(!label)return;
    label.insertAdjacentHTML('beforebegin',reviewFrequencyHtml('controlledReview',freq));
    const hidden=document.createElement('input');hidden.type='hidden';hidden.id='controlledReviewReviewFrequencyBase';hidden.value=today();
    label.parentElement?.appendChild(hidden);
    wireFrequency('controlledReview','controlledReviewReviewFrequencyBase','nextReviewDate');
    if(next)next.value=addInterval(today(),freq.value,freq.unit);
  }

  function patchApprovalAndReview(){
    const originalShowApproval=window.showVersionApproval;
    if(typeof originalShowApproval==='function'){
      window.showVersionApproval=function(versionId){
        const out=originalShowApproval(versionId);
        setTimeout(()=>decorateApprovalFrequency(versionId),0);
        return out;
      };
    }
    const originalSaveApproval=window.saveVersionApproval;
    if(typeof originalSaveApproval==='function'){
      window.saveVersionApproval=async function(versionId){
        const v=(state.versions||[]).find(x=>x.id===versionId),d=(state.documents||[]).find(x=>x.id===v?.document_id);
        if(d&&d.doc_type!=='SDS'&&$('approvalReviewFrequencyPreset')){
          const f=getFrequency('approval');
          const r=await sb.from('documents').update({review_frequency_value:f.value,review_frequency_unit:f.unit}).eq('id',d.id);
          if(r.error)return api.toast?.(`Could not save review frequency: ${r.error.message}`);
          d.review_frequency_value=f.value;d.review_frequency_unit=f.unit;
        }
        return originalSaveApproval(versionId);
      };
    }
    const originalShowReview=window.showDocumentReview;
    if(typeof originalShowReview==='function'){
      window.showDocumentReview=function(docId){
        const out=originalShowReview(docId);
        setTimeout(()=>decorateControlledReviewFrequency(docId),0);
        return out;
      };
    }
    const originalSaveReview=window.saveDocumentReview;
    if(typeof originalSaveReview==='function'){
      window.saveDocumentReview=async function(docId){
        const d=(state.documents||[]).find(x=>x.id===docId);
        if(d&&$('controlledReviewReviewFrequencyPreset')){
          const f=getFrequency('controlledReview');
          const r=await sb.from('documents').update({review_frequency_value:f.value,review_frequency_unit:f.unit}).eq('id',docId);
          if(r.error)return api.toast?.(`Could not save review frequency: ${r.error.message}`);
          d.review_frequency_value=f.value;d.review_frequency_unit=f.unit;
        }
        return originalSaveReview(docId);
      };
    }
  }

  async function decorateModal(){
    if(decorating)return;
    const body=$('modalBody');if(!body)return;
    decorating=true;
    try{
      if(body.querySelector('[data-v21119-save-plain]'))await decorateCreateModal();
      else if(body.querySelector('[data-v21119-save-controls]'))await decorateControlsModal();
      const av=body.querySelector('[data-save-version-approval]');
      if(av)decorateApprovalFrequency(av.dataset.saveVersionApproval);
      const rv=body.querySelector('[data-save-doc-review]');
      if(rv)decorateControlledReviewFrequency(rv.dataset.saveDocReview);
    }catch(e){console.warn('v2.11.21 modal decoration',e)}
    finally{decorating=false}
  }

  function install(){
    addStyles();
    patchApprovalAndReview();

    const body=$('modalBody');
    if(body){
      let timer=0;
      new MutationObserver(()=>{
        clearTimeout(timer);
        timer=setTimeout(decorateModal,20);
      }).observe(body,{childList:true,subtree:true});
    }

    document.addEventListener('click',e=>{
      const create=e.target.closest?.('[data-v21121-save-plain]');
      if(create){e.preventDefault();e.stopImmediatePropagation();savePlain(create);return}
      const controls=e.target.closest?.('[data-v21121-save-controls]');
      if(controls){e.preventDefault();e.stopImmediatePropagation();saveControls(controls);return}
    },true);

    loadReferenceData(true).catch(console.warn);
    window.SafetyGenericDocControlsV21121={loadReferenceData,decorateModal,audienceState};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb||!window.SafetyGenericDocumentsV21119){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    install();
  }
  boot();
})();
