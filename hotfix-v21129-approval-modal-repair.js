/* Safety Tracker v2.11.29
   Final approval-modal repair:
   - Policy / Procedure / Information reader scope uses robust native checkboxes.
   - Review frequency + Next review date are always present for non-SDS approvals.
   - Generic reader scope is saved before approval.
   - Does not alter RA/COSHH/SSW formal training audience logic.
*/
'use strict';
(function(){
  if(window.__SAFETY_APPROVAL_MODAL_REPAIR_V21129)return;
  window.__SAFETY_APPROVAL_MODAL_REPAIR_V21129=true;

  let api,state,sb;
  let positions=[];
  let genericSaving=false;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
  const today=()=>new Date().toISOString().slice(0,10);

  function isGenericDocument(d){
    if(!d)return false;
    const t=String(d.doc_type||'').toUpperCase();
    return ['POLICY','PROCEDURE','OTHER'].includes(t) ||
      String(d.content_mode||'').toUpperCase()==='PLAIN_TEXT';
  }

  function isSds(d){
    return String(d?.doc_type||'').toUpperCase()==='SDS';
  }

  function addInterval(iso,value,unit){
    const d=new Date((iso||today())+'T12:00:00');
    const n=Math.max(1,Number(value)||12);
    if(unit==='DAYS')d.setDate(d.getDate()+n);
    else if(unit==='YEARS')d.setFullYear(d.getFullYear()+n);
    else d.setMonth(d.getMonth()+n);
    return d.toISOString().slice(0,10);
  }

  function reviewFrequency(d){
    const value=Number(d?.review_frequency_value||0);
    const unit=String(d?.review_frequency_unit||'').toUpperCase();
    return {
      value:value>0?value:12,
      unit:['DAYS','MONTHS','YEARS'].includes(unit)?unit:'MONTHS'
    };
  }

  function presetFor(freq){
    const k=`${freq.value}|${freq.unit}`;
    return ['3|MONTHS','6|MONTHS','12|MONTHS','24|MONTHS','36|MONTHS','1|YEARS','2|YEARS','3|YEARS'].includes(k)?k:'CUSTOM';
  }

  function approvalFrequency(){
    const preset=$('approvalReviewFrequencyV21129')?.value||'12|MONTHS';
    if(preset==='CUSTOM'){
      return {
        value:Math.max(1,Number($('approvalReviewFrequencyValueV21129')?.value)||12),
        unit:$('approvalReviewFrequencyUnitV21129')?.value||'MONTHS'
      };
    }
    const [v,u]=preset.split('|');
    return {value:Number(v)||12,unit:u||'MONTHS'};
  }

  function ensureReviewControls(versionId){
    const body=$('modalBody');
    const action=body?.querySelector('[data-save-version-approval]');
    if(!body||!action)return;

    const id=versionId||action.dataset.saveVersionApproval;
    const v=(state.versions||[]).find(x=>x.id===id);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||isSds(d))return;

    const decision=$('approvalDecision');
    const decisionLabel=decision?.closest('label');
    const form=decision?.closest('.form-grid');
    if(!decisionLabel||!form)return;

    const freq=reviewFrequency(d);
    const preset=presetFor(freq);
    const currentDate=v.review_date||addInterval(v.issue_date||today(),freq.value,freq.unit);

    // Remove competing/partial older injected controls, then render one final set.
    const oldWrap=$('approvalReviewDateWrapV21120');
    if(oldWrap && !$('approvalReviewControlsV21129')) oldWrap.remove();

    if(!$('approvalReviewControlsV21129')){
      const wrap=document.createElement('div');
      wrap.id='approvalReviewControlsV21129';
      wrap.className='full approval-review-controls-v21129';
      wrap.innerHTML=`
        <div class="form-grid">
          <label>Document review frequency
            <select id="approvalReviewFrequencyV21129">
              <option value="3|MONTHS" ${preset==='3|MONTHS'?'selected':''}>Every 3 months</option>
              <option value="6|MONTHS" ${preset==='6|MONTHS'?'selected':''}>Every 6 months</option>
              <option value="12|MONTHS" ${preset==='12|MONTHS'?'selected':''}>Every 12 months</option>
              <option value="24|MONTHS" ${preset==='24|MONTHS'?'selected':''}>Every 24 months</option>
              <option value="36|MONTHS" ${preset==='36|MONTHS'?'selected':''}>Every 36 months</option>
              <option value="CUSTOM" ${preset==='CUSTOM'?'selected':''}>Custom…</option>
            </select>
            <span class="muted">Default is 12 months; Manager/Admin can change it before approval.</span>
          </label>

          <label>Next review date
            <input id="approvalReviewDate" type="date" value="${esc(currentDate)}">
            <span class="muted">Calculated from the issue date and review frequency. The exact date can be overridden.</span>
          </label>

          <div id="approvalReviewCustomV21129" class="form-grid full" ${preset==='CUSTOM'?'':'hidden'}>
            <label>Every
              <input id="approvalReviewFrequencyValueV21129" type="number" min="1" max="1200" value="${freq.value}">
            </label>
            <label>Unit
              <select id="approvalReviewFrequencyUnitV21129">
                <option value="DAYS" ${freq.unit==='DAYS'?'selected':''}>Days</option>
                <option value="MONTHS" ${freq.unit==='MONTHS'?'selected':''}>Months</option>
                <option value="YEARS" ${freq.unit==='YEARS'?'selected':''}>Years</option>
              </select>
            </label>
          </div>
        </div>`;
      decisionLabel.insertAdjacentElement('afterend',wrap);

      const recalc=()=>{
        const f=approvalFrequency();
        const custom=$('approvalReviewCustomV21129');
        if(custom)custom.hidden=$('approvalReviewFrequencyV21129')?.value!=='CUSTOM';
        const date=$('approvalReviewDate');
        if(date)date.value=addInterval(v.issue_date||today(),f.value,f.unit);
      };
      $('approvalReviewFrequencyV21129')?.addEventListener('change',recalc);
      $('approvalReviewFrequencyValueV21129')?.addEventListener('input',recalc);
      $('approvalReviewFrequencyUnitV21129')?.addEventListener('change',recalc);
    }
  }

  async function loadPositions(){
    try{
      const r=await sb.from('safety_positions_v21069').select('*').eq('active',true).order('name');
      if(!r.error)positions=r.data||[];
    }catch(_e){}
  }

  async function loadReaderAudience(documentId){
    try{
      const r=await sb.from('document_read_audiences_v21119').select('*').eq('document_id',documentId);
      return r.error?[]:(r.data||[]);
    }catch(_e){return []}
  }

  function departments(){
    return (state.departments||[]).filter(x=>x.active!==false)
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }
  function people(){
    return (state.people||[]).filter(x=>x.active!==false&&x.report_only!==true)
      .sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  }

  function rowHtml(kind,id,label,checked,sub=''){
    const inputId=`genericScopeV21129_${kind}_${String(id).replace(/[^A-Za-z0-9_-]/g,'_')}`;
    return `<div class="generic-scope-row-v21129">
      <input id="${esc(inputId)}" type="checkbox" data-generic-scope-v21129="${esc(kind)}" value="${esc(id)}" ${checked?'checked':''}>
      <label for="${esc(inputId)}"><strong>${esc(label)}</strong>${sub?`<span>${esc(sub)}</span>`:''}</label>
    </div>`;
  }

  function audienceSelection(){
    return {
      everyone:!!$('genericScopeEveryoneV21129')?.checked,
      departments:[...document.querySelectorAll('[data-generic-scope-v21129="department"]:checked')].map(x=>x.value),
      positions:[...document.querySelectorAll('[data-generic-scope-v21129="position"]:checked')].map(x=>x.value),
      users:[...document.querySelectorAll('[data-generic-scope-v21129="user"]:checked')].map(x=>x.value),
      dueDays:Math.max(0,Math.min(3650,Number($('genericScopeDueDaysV21129')?.value)||14))
    };
  }

  function hasGenericScope(sel=audienceSelection()){
    return !!(sel.everyone||sel.departments.length||sel.positions.length||sel.users.length);
  }

  function genericScopeSummary(sel=audienceSelection()){
    if(sel.everyone)return 'Everyone / whole hotel';
    const bits=[];
    if(sel.departments.length)bits.push(`${sel.departments.length} department${sel.departments.length===1?'':'s'}`);
    if(sel.positions.length)bits.push(`${sel.positions.length} position${sel.positions.length===1?'':'s'}`);
    if(sel.users.length)bits.push(`${sel.users.length} specific ${sel.users.length===1?'person':'people'}`);
    return bits.join(' + ')||'No scope selected';
  }

  function syncGenericScope(){
    const panel=$('genericScopePanelV21129');
    if(!panel)return;
    const sel=audienceSelection();
    const everyone=sel.everyone;

    panel.querySelectorAll('[data-generic-scope-v21129]')
      .forEach(x=>x.disabled=everyone);

    const summary=$('genericScopeSummaryV21129');
    if(summary){
      summary.className=hasGenericScope(sel)?'success-note':'danger-note';
      summary.innerHTML=hasGenericScope(sel)
        ?`<strong>Scope set:</strong> ${esc(genericScopeSummary(sel))}`
        :'<strong>Scope required.</strong> Choose Everyone, a Department, Position or specific person.';
    }

    const approved=($('approvalDecision')?.value||'APPROVED')==='APPROVED';
    panel.hidden=!approved;

    const action=document.querySelector('#modalBody [data-save-version-approval]');
    if(action && approved){
      action.disabled=!hasGenericScope(sel);
      action.title=hasGenericScope(sel)?'':'Set the Policy / Procedure reader scope before approval.';
    }

    const hint=$('responsibilityApprovalHintV21090');
    if(hint && approved){
      hint.className=hasGenericScope(sel)?'success-note':'danger-note';
      hint.innerHTML=hasGenericScope(sel)
        ?`<strong>Document scope:</strong> ${esc(genericScopeSummary(sel))}. Any full Admin may approve; Manager approval follows normal permissions.`
        :'<strong>Scope required.</strong> Choose Everyone, a Department, Position or specific person before approval.';
    }
  }

  async function ensureGenericScope(versionId){
    const body=$('modalBody');
    const action=body?.querySelector('[data-save-version-approval]');
    if(!body||!action)return;
    const id=versionId||action.dataset.saveVersionApproval;
    const v=(state.versions||[]).find(x=>x.id===id);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||!isGenericDocument(d))return;

    // v2.11.29 replaces the v2.11.27 panel completely.
    $('genericApprovalScopeV21127')?.remove();
    if($('genericScopePanelV21129')){
      syncGenericScope();
      return;
    }

    await loadPositions();
    const rows=await loadReaderAudience(d.id);
    const everyone=rows.some(x=>x.target_type==='EVERYONE');
    const depSet=new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const posSet=new Set(rows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const userSet=new Set(rows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    const dueDays=Number(rows[0]?.due_days||14);

    const depRows=departments().map(x=>rowHtml('department',x.id,x.name,depSet.has(x.id))).join('')
      || '<div class="muted">No active departments.</div>';
    const posRows=(positions||[]).filter(x=>x.active!==false).map(x=>rowHtml('position',x.id,x.name,posSet.has(x.id))).join('')
      || '<div class="muted">No positions configured.</div>';
    const userRows=people().map(x=>rowHtml('user',x.id,x.display_name||x.email||'User',userSet.has(x.id))).join('')
      || '<div class="muted">No active users.</div>';

    const panel=document.createElement('div');
    panel.id='genericScopePanelV21129';
    panel.className='section-card';
    panel.innerHTML=`
      <div class="row-between generic-scope-head-v21129">
        <div>
          <h4>Policy / Procedure scope</h4>
          <p class="muted">Choose who must read and acknowledge this document. This does not create RA/COSHH/SSW formal training.</p>
        </div>
        <div class="generic-scope-row-v21129 generic-scope-everyone-v21129">
          <input id="genericScopeEveryoneV21129" type="checkbox" ${everyone?'checked':''}>
          <label for="genericScopeEveryoneV21129"><strong>Everyone / whole hotel</strong></label>
        </div>
      </div>

      <details open class="generic-scope-group-v21129">
        <summary>Departments</summary>
        <div class="generic-scope-list-v21129">${depRows}</div>
      </details>

      <details class="generic-scope-group-v21129">
        <summary>Positions</summary>
        <div class="generic-scope-list-v21129">${posRows}</div>
      </details>

      <details class="generic-scope-group-v21129">
        <summary>Specific people</summary>
        <div class="generic-scope-list-v21129">${userRows}</div>
      </details>

      <div class="generic-scope-footer-v21129">
        <label>Read within (days)
          <input id="genericScopeDueDaysV21129" type="number" min="0" max="3650" value="${dueDays}">
        </label>
        <div id="genericScopeSummaryV21129"></div>
      </div>`;

    const actions=[...body.querySelectorAll('.actions')].pop();
    if(actions)actions.insertAdjacentElement('beforebegin',panel);
    else body.appendChild(panel);

    panel.addEventListener('change',syncGenericScope);
    $('approvalDecision')?.addEventListener('change',syncGenericScope);

    // Explicit click handling for labels/rows avoids the previous unreliable
    // inherited checkbox/label layout behaviour.
    panel.addEventListener('click',e=>{
      const row=e.target.closest?.('.generic-scope-row-v21129');
      if(!row || e.target.matches('input,label'))return;
      const cb=row.querySelector('input[type="checkbox"]');
      if(cb && !cb.disabled){
        cb.checked=!cb.checked;
        cb.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });

    syncGenericScope();
  }

  async function saveGenericAudience(documentId){
    const sel=audienceSelection();
    if(!hasGenericScope(sel))throw new Error('Choose Everyone, a Department, Position or specific person.');

    const del=await sb.from('document_read_audiences_v21119').delete().eq('document_id',documentId);
    if(del.error)throw del.error;

    const rows=[];
    if(sel.everyone){
      rows.push({
        document_id:documentId,target_type:'EVERYONE',
        due_days:sel.dueDays,created_by:state.user.id
      });
    }else{
      for(const id of sel.departments)rows.push({
        document_id:documentId,target_type:'DEPARTMENT',department_id:id,
        due_days:sel.dueDays,created_by:state.user.id
      });
      for(const id of sel.positions)rows.push({
        document_id:documentId,target_type:'POSITION',position_id:id,
        due_days:sel.dueDays,created_by:state.user.id
      });
      for(const id of sel.users)rows.push({
        document_id:documentId,target_type:'USER',user_id:id,
        due_days:sel.dueDays,created_by:state.user.id
      });
    }

    if(rows.length){
      const ins=await sb.from('document_read_audiences_v21119').insert(rows);
      if(ins.error)throw ins.error;
    }
  }

  async function persistReviewSettings(versionId){
    const v=(state.versions||[]).find(x=>x.id===versionId);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||isSds(d))return;

    const decision=$('approvalDecision')?.value;
    if(decision!=='APPROVED')return;

    const reviewDate=$('approvalReviewDate')?.value||'';
    if(!reviewDate)throw new Error('Choose the next review date before approval.');

    const freq=approvalFrequency();
    const du=await sb.from('documents').update({
      review_frequency_value:freq.value,
      review_frequency_unit:freq.unit
    }).eq('id',d.id);
    if(du.error)throw du.error;

    const vu=await sb.from('document_versions').update({
      review_date:reviewDate
    }).eq('id',v.id);
    if(vu.error)throw vu.error;

    d.review_frequency_value=freq.value;
    d.review_frequency_unit=freq.unit;
    v.review_date=reviewDate;
  }

  async function decorate(versionId){
    ensureReviewControls(versionId);
    await ensureGenericScope(versionId);
    // Other older decorators can run after modal open, so re-assert the final UI.
    [70,220,500].forEach(ms=>setTimeout(()=>{
      ensureReviewControls(versionId);
      syncGenericScope();
    },ms));
  }

  function install(){
    const style=document.createElement('style');
    style.id='approvalModalRepairStylesV21129';
    style.textContent=`
      #modalBody .approval-review-controls-v21129{
        grid-column:1/-1;
        width:100%;
        margin:0;
      }
      #modalBody .approval-review-controls-v21129>.form-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      #modalBody .generic-scope-head-v21129{
        align-items:flex-start;
        flex-wrap:wrap;
      }
      #modalBody .generic-scope-group-v21129{
        width:100%;
        border:1px solid var(--border,#d7dee7);
        border-radius:10px;
        overflow:hidden;
        margin-top:9px;
      }
      #modalBody .generic-scope-group-v21129 summary{
        cursor:pointer;
        padding:10px 12px;
        font-weight:750;
        text-align:left;
      }
      #modalBody .generic-scope-list-v21129{
        display:grid;
        grid-template-columns:1fr;
        max-height:230px;
        overflow-y:auto;
        overflow-x:hidden;
        overscroll-behavior:contain;
        border-top:1px solid var(--border,#d7dee7);
        padding:4px 8px;
      }
      #modalBody .generic-scope-row-v21129{
        display:grid!important;
        grid-template-columns:22px minmax(0,1fr)!important;
        gap:9px!important;
        align-items:start!important;
        width:100%!important;
        min-width:0!important;
        padding:8px 6px!important;
        margin:0!important;
        cursor:pointer;
      }
      #modalBody .generic-scope-row-v21129 + .generic-scope-row-v21129{
        border-top:1px solid rgba(120,135,150,.16);
      }
      #modalBody .generic-scope-row-v21129 input[type="checkbox"]{
        width:18px!important;
        height:18px!important;
        min-width:18px!important;
        margin:2px 0 0!important;
        padding:0!important;
        pointer-events:auto!important;
        cursor:pointer!important;
        opacity:1!important;
        position:static!important;
      }
      #modalBody .generic-scope-row-v21129 label{
        display:block!important;
        width:auto!important;
        min-width:0!important;
        margin:0!important;
        padding:0!important;
        text-align:left!important;
        cursor:pointer!important;
        pointer-events:auto!important;
        line-height:1.3!important;
      }
      #modalBody .generic-scope-row-v21129 label strong{
        display:block;
        text-align:left;
      }
      #modalBody .generic-scope-row-v21129 label span{
        display:block;
        margin-top:2px;
        color:var(--muted,#667585);
        font-weight:400;
        overflow-wrap:anywhere;
      }
      #modalBody .generic-scope-everyone-v21129{
        width:auto!important;
        min-width:220px!important;
        border:1px solid var(--border,#d7dee7);
        border-radius:10px;
      }
      #modalBody .generic-scope-footer-v21129{
        display:grid;
        grid-template-columns:minmax(150px,220px) minmax(0,1fr);
        gap:10px;
        align-items:end;
        margin-top:10px;
      }

      @media(max-width:680px){
        #modalBody .approval-review-controls-v21129>.form-grid,
        #modalBody .generic-scope-footer-v21129{
          grid-template-columns:1fr;
        }
        #modalBody .generic-scope-everyone-v21129{
          width:100%!important;
        }
      }
    `;
    document.head.appendChild(style);

    const originalShow=window.showVersionApproval;
    if(typeof originalShow==='function'){
      window.showVersionApproval=function(versionId){
        const out=originalShow.apply(this,arguments);
        [0,60,180].forEach(ms=>setTimeout(()=>decorate(versionId),ms));
        return out;
      };
    }

    // Always decorate after opening an approval modal, even if another wrapper
    // replaced showVersionApproval later in the chain.
    document.addEventListener('click',e=>{
      const open=e.target.closest?.('[data-approve-version]');
      if(open){
        const id=open.dataset.approveVersion;
        [30,100,260,600].forEach(ms=>setTimeout(()=>decorate(id),ms));
      }
    },false);

    // Final generic approval handler. v2.11.27 is deliberately NOT loaded in
    // this build so there is only one capture handler for Policy/Procedure scope.
    document.addEventListener('click',async e=>{
      const btn=e.target.closest?.('#modalBody [data-save-version-approval]');
      if(!btn||genericSaving)return;

      const versionId=btn.dataset.saveVersionApproval;
      const v=(state.versions||[]).find(x=>x.id===versionId);
      const d=(state.documents||[]).find(x=>x.id===v?.document_id);
      if(!v||!d||!isGenericDocument(d))return;

      if(($('approvalDecision')?.value||'APPROVED')!=='APPROVED')return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if(!$('approvalAck')?.checked){
        api.toast?.('Tick the confirmation first.');
        return;
      }
      if(!hasGenericScope()){
        api.toast?.('Choose Everyone, a Department, Position or specific person before approval.');
        syncGenericScope();
        return;
      }

      genericSaving=true;
      const old=btn.textContent;
      btn.disabled=true;
      try{
        btn.textContent='Saving scope…';
        await saveGenericAudience(d.id);

        btn.textContent='Saving review date…';
        await persistReviewSettings(versionId);

        btn.textContent='Approving…';
        const fn=window.saveVersionApproval;
        if(typeof fn!=='function')throw new Error('Approval function is unavailable. Refresh once and try again.');
        await fn(versionId);
      }catch(err){
        api.toast?.(err?.message||'Could not complete approval.');
        btn.disabled=false;
        btn.textContent=old;
      }finally{
        genericSaving=false;
      }
    },true);

    window.SafetyApprovalModalRepairV21129={
      decorate,
      ensureReviewControls,
      ensureGenericScope,
      audienceSelection,
      syncGenericScope
    };
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;
    sb=api.sb;
    install();
  }

  boot();
})();