/* Safety Tracker v2.11.31 - final approval scope + move/classify documents
   - Universal approval scope panel using the core approval IDs/classes.
   - RA/COSHH/SSW scope always has Everyone / Department / People controls.
   - Policy/Procedure/Other additionally supports Positions.
   - Review frequency + Next review date always shown on non-SDS approval.
   - Any document can be moved to a folder and/or reclassified at any time.
*/
'use strict';
(function(){
  if(window.__SAFETY_APPROVAL_MOVE_REPAIR_V21131)return;
  window.__SAFETY_APPROVAL_MOVE_REPAIR_V21131=true;

  let api,state,sb;
  let positions=[];
  let folders=[];
  let saving=false;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const today=()=>new Date().toISOString().slice(0,10);
  const formalTypes=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
  const genericTypes=new Set(['POLICY','PROCEDURE','OTHER']);

  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())
    && state?.profile?.report_only!==true && state?.uiMode!=='user';

  function isSds(d){return String(d?.doc_type||'').toUpperCase()==='SDS'}
  function isFormal(d){return formalTypes.has(String(d?.doc_type||'').toUpperCase())}
  function isGeneric(d){
    const t=String(d?.doc_type||'').toUpperCase();
    return genericTypes.has(t)||String(d?.content_mode||'').toUpperCase()==='PLAIN_TEXT';
  }

  function addInterval(iso,value,unit){
    const d=new Date((iso||today())+'T12:00:00');
    const n=Math.max(1,Number(value)||12);
    if(unit==='DAYS')d.setDate(d.getDate()+n);
    else if(unit==='YEARS')d.setFullYear(d.getFullYear()+n);
    else d.setMonth(d.getMonth()+n);
    return d.toISOString().slice(0,10);
  }

  async function loadAux(){
    const jobs=[
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
      sb.from('document_folders_v21119').select('*').order('sort_order').order('name')
    ];
    const [p,f]=await Promise.all(jobs);
    if(!p.error)positions=p.data||[];
    if(!f.error)folders=f.data||[];
  }

  async function loadGenericAudience(documentId){
    try{
      const r=await sb.from('document_read_audiences_v21119').select('*').eq('document_id',documentId);
      return r.error?[]:(r.data||[]);
    }catch(_e){return []}
  }

  function activeDepartments(){
    return (state.departments||[]).filter(x=>x.active!==false)
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }
  function activePeople(){
    return (state.people||[]).filter(x=>x.active!==false&&x.report_only!==true)
      .sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  }

  function readerRow(id, cls, label, checked=false, sub=''){
    const safe=String(id).replace(/[^A-Za-z0-9_-]/g,'_');
    const inputId=`approvalScopeV21131_${cls}_${safe}`;
    return `<div class="approval-scope-row-v21131">
      <input id="${esc(inputId)}" type="checkbox" class="${esc(cls)}" value="${esc(id)}" ${checked?'checked':''}>
      <label for="${esc(inputId)}"><strong>${esc(label)}</strong>${sub?`<span>${esc(sub)}</span>`:''}</label>
    </div>`;
  }

  function formalExistingAudience(documentId){
    const rows=(state.documentAudiences||[]).filter(x=>x.document_id===documentId);
    return {
      everyone:rows.some(x=>x.target_type==='EVERYONE'),
      deps:new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id)),
      users:new Set(rows.filter(x=>['USER','PERSON'].includes(String(x.target_type||'').toUpperCase())).map(x=>x.user_id)),
      dueDays:Number(rows[0]?.due_days||14)
    };
  }

  async function ensureScopePanel(versionId){
    const body=$('modalBody');
    const action=body?.querySelector('[data-save-version-approval]');
    if(!body||!action)return;
    const id=versionId||action.dataset.saveVersionApproval;
    const v=(state.versions||[]).find(x=>x.id===id);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||isSds(d))return;

    // If the core formal-training audience exists, keep it and make sure it is visible.
    // For generic docs or missing formal controls, v2.11.31 supplies the final panel.
    if(isFormal(d) && $('approvalAudienceSection')){
      const section=$('approvalAudienceSection');
      section.hidden=($('approvalDecision')?.value||'APPROVED')!=='APPROVED';
      section.style.display=section.hidden?'none':'block';
      return;
    }

    // Replace earlier generic/fallback panels so only one scope UI is active.
    $('genericScopePanelV21129')?.remove();
    $('genericApprovalScopeV21127')?.remove();
    if($('approvalAudienceSectionV21131')){
      syncScopeUi(d);
      return;
    }

    await loadAux();
    const existing=isFormal(d)?formalExistingAudience(d.id):null;
    const genericRows=isGeneric(d)?await loadGenericAudience(d.id):[];
    const everyone=isFormal(d)?existing.everyone:genericRows.some(x=>x.target_type==='EVERYONE');
    const depSet=isFormal(d)?existing.deps:new Set(genericRows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const userSet=isFormal(d)?existing.users:new Set(genericRows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    const posSet=new Set(genericRows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const dueDays=isFormal(d)?existing.dueDays:Number(genericRows[0]?.due_days||14);

    const depRows=activeDepartments().map(x=>
      readerRow(x.id,'approval-department-choice',x.name,depSet.has(x.id))
    ).join('')||'<div class="muted">No active departments.</div>';

    const personRows=activePeople().map(x=>
      readerRow(x.id,'approval-person-choice',x.display_name||x.email||'User',userSet.has(x.id))
    ).join('')||'<div class="muted">No active users.</div>';

    const positionRows=isGeneric(d)
      ? ((positions||[]).filter(x=>x.active!==false).map(x=>
          readerRow(x.id,'approval-position-choice-v21131',x.name,posSet.has(x.id))
        ).join('')||'<div class="muted">No positions configured.</div>')
      : '';

    const panel=document.createElement('div');
    panel.id='approvalAudienceSectionV21131';
    panel.className='section-card approval-audience-card';
    panel.innerHTML=`
      <div class="row-between approval-scope-head-v21131">
        <div>
          <h4>${isFormal(d)?'Assignment / training scope':'Document reader scope'}</h4>
          <p class="muted">${isFormal(d)
            ?'Choose who requires this controlled document/training when it is approved.'
            :'Choose who must read and acknowledge this Policy/Procedure/Information document.'}</p>
        </div>
        <div class="approval-scope-row-v21131 approval-scope-everyone-v21131">
          <input id="approvalAssignEveryone" type="checkbox" ${everyone?'checked':''}>
          <label for="approvalAssignEveryone"><strong>Everyone / whole hotel</strong></label>
        </div>
      </div>

      <details open class="approval-scope-group-v21131">
        <summary>Departments</summary>
        <div class="approval-scope-list-v21131">${depRows}</div>
      </details>

      ${isGeneric(d)?`<details class="approval-scope-group-v21131">
        <summary>Positions</summary>
        <div class="approval-scope-list-v21131">${positionRows}</div>
      </details>`:''}

      <details class="approval-scope-group-v21131">
        <summary>Specific people</summary>
        <div class="approval-scope-list-v21131">${personRows}</div>
      </details>

      <div class="approval-scope-footer-v21131">
        <label>${isFormal(d)?'Completion due after assignment':'Read within'} (days)
          <input id="approvalAssignDueDays" type="number" min="0" max="3650" value="${dueDays}">
        </label>
        <div id="approvalAudienceSummary" class="hint-box"></div>
      </div>`;

    // Core responsibility logic expects #approvalAudienceSection specifically.
    panel.dataset.v21131='1';
    panel.setAttribute('data-core-scope-section','1');
    panel.id='approvalAudienceSection';

    const actions=[...body.querySelectorAll('.actions')].pop();
    if(actions)actions.insertAdjacentElement('beforebegin',panel);
    else body.appendChild(panel);

    panel.addEventListener('change',()=>syncScopeUi(d));
    $('approvalDecision')?.addEventListener('change',()=>syncScopeUi(d));
    syncScopeUi(d);
  }

  function scopeSelection(){
    return {
      everyone:!!$('approvalAssignEveryone')?.checked,
      departments:[...document.querySelectorAll('.approval-department-choice:checked')].map(x=>x.value),
      positions:[...document.querySelectorAll('.approval-position-choice-v21131:checked')].map(x=>x.value),
      users:[...document.querySelectorAll('.approval-person-choice:checked')].map(x=>x.value),
      dueDays:Math.max(0,Math.min(3650,Number($('approvalAssignDueDays')?.value)||14))
    };
  }

  function hasScope(s=scopeSelection()){
    return !!(s.everyone||s.departments.length||s.positions.length||s.users.length);
  }

  function scopeLabel(s=scopeSelection()){
    if(s.everyone)return 'Everyone / whole hotel';
    const bits=[];
    if(s.departments.length)bits.push(`${s.departments.length} department${s.departments.length===1?'':'s'}`);
    if(s.positions.length)bits.push(`${s.positions.length} position${s.positions.length===1?'':'s'}`);
    if(s.users.length)bits.push(`${s.users.length} specific ${s.users.length===1?'person':'people'}`);
    return bits.join(' + ')||'No scope selected';
  }

  function syncScopeUi(d){
    const section=$('approvalAudienceSection');
    if(!section)return;
    const approved=($('approvalDecision')?.value||'APPROVED')==='APPROVED';
    section.hidden=!approved;
    section.style.display=approved?'block':'none';
    if(!approved)return;

    const s=scopeSelection();
    section.querySelectorAll('.approval-department-choice,.approval-position-choice-v21131,.approval-person-choice')
      .forEach(x=>x.disabled=s.everyone);

    const summary=$('approvalAudienceSummary');
    if(summary)summary.innerHTML=hasScope(s)
      ?`<strong>Scope set:</strong> ${esc(scopeLabel(s))}`
      :'<strong>Scope required.</strong> Choose Everyone, a Department, Position or specific person.';

    const hint=$('responsibilityApprovalHintV21090');
    if(hint){
      hint.className=hasScope(s)?'success-note':'danger-note';
      hint.innerHTML=hasScope(s)
        ?`<strong>Scope:</strong> ${esc(scopeLabel(s))}.`
        :'<strong>Scope required.</strong> Choose Everyone/site-wide or the correct Department before this review/approval.';
    }

    const action=document.querySelector('#modalBody [data-save-version-approval]');
    if(action){
      action.disabled=!hasScope(s);
      action.title=hasScope(s)?'':'Set the document scope before approval.';
    }
  }

  function reviewFreq(d){
    const v=Number(d?.review_frequency_value||0)||12;
    const u=String(d?.review_frequency_unit||'MONTHS').toUpperCase();
    return {value:v,unit:['DAYS','MONTHS','YEARS'].includes(u)?u:'MONTHS'};
  }

  function selectedReviewFreq(){
    const p=$('approvalReviewFrequencyV21131')?.value||'12|MONTHS';
    if(p==='CUSTOM')return {
      value:Math.max(1,Number($('approvalReviewFrequencyValueV21131')?.value)||12),
      unit:$('approvalReviewFrequencyUnitV21131')?.value||'MONTHS'
    };
    const [v,u]=p.split('|');return {value:Number(v)||12,unit:u||'MONTHS'};
  }

  function ensureReviewControls(versionId){
    const body=$('modalBody'),action=body?.querySelector('[data-save-version-approval]');
    if(!body||!action)return;
    const id=versionId||action.dataset.saveVersionApproval;
    const v=(state.versions||[]).find(x=>x.id===id);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||isSds(d))return;

    // Remove partial older fields and replace with one deterministic final control.
    $('approvalReviewControlsV21129')?.remove();
    $('approvalReviewDateWrapV21120')?.remove();
    const oldFreq=$('approvalReviewFrequencyPreset')?.closest('label');
    if(oldFreq)oldFreq.remove();
    if($('approvalReviewControlsV21131'))return;

    const freq=reviewFreq(d);
    const key=`${freq.value}|${freq.unit}`;
    const preset=['3|MONTHS','6|MONTHS','12|MONTHS','24|MONTHS','36|MONTHS','1|YEARS','2|YEARS','3|YEARS'].includes(key)?key:'CUSTOM';
    const review=v.review_date||addInterval(v.issue_date||today(),freq.value,freq.unit);

    const wrap=document.createElement('div');
    wrap.id='approvalReviewControlsV21131';
    wrap.className='full';
    wrap.innerHTML=`<div class="form-grid">
      <label>Document review frequency
        <select id="approvalReviewFrequencyV21131">
          <option value="3|MONTHS" ${preset==='3|MONTHS'?'selected':''}>Every 3 months</option>
          <option value="6|MONTHS" ${preset==='6|MONTHS'?'selected':''}>Every 6 months</option>
          <option value="12|MONTHS" ${preset==='12|MONTHS'?'selected':''}>Every 12 months</option>
          <option value="24|MONTHS" ${preset==='24|MONTHS'?'selected':''}>Every 24 months</option>
          <option value="36|MONTHS" ${preset==='36|MONTHS'?'selected':''}>Every 36 months</option>
          <option value="CUSTOM" ${preset==='CUSTOM'?'selected':''}>Custom…</option>
        </select>
      </label>
      <label>Next review date
        <input id="approvalReviewDate" type="date" value="${esc(review)}">
      </label>
      <div id="approvalReviewCustomV21131" class="form-grid full" ${preset==='CUSTOM'?'':'hidden'}>
        <label>Every<input id="approvalReviewFrequencyValueV21131" type="number" min="1" value="${freq.value}"></label>
        <label>Unit<select id="approvalReviewFrequencyUnitV21131">
          <option value="DAYS" ${freq.unit==='DAYS'?'selected':''}>Days</option>
          <option value="MONTHS" ${freq.unit==='MONTHS'?'selected':''}>Months</option>
          <option value="YEARS" ${freq.unit==='YEARS'?'selected':''}>Years</option>
        </select></label>
      </div>
    </div>`;

    const decision=$('approvalDecision')?.closest('label');
    decision?.insertAdjacentElement('afterend',wrap);

    const recalc=()=>{
      const custom=$('approvalReviewCustomV21131');
      if(custom)custom.hidden=$('approvalReviewFrequencyV21131')?.value!=='CUSTOM';
      const f=selectedReviewFreq(),date=$('approvalReviewDate');
      if(date)date.value=addInterval(v.issue_date||today(),f.value,f.unit);
    };
    $('approvalReviewFrequencyV21131')?.addEventListener('change',recalc);
    $('approvalReviewFrequencyValueV21131')?.addEventListener('input',recalc);
    $('approvalReviewFrequencyUnitV21131')?.addEventListener('change',recalc);
  }

  async function persistGenericAudience(documentId){
    const s=scopeSelection();
    if(!hasScope(s))throw new Error('Choose Everyone, a Department, Position or specific person before approval.');
    const del=await sb.from('document_read_audiences_v21119').delete().eq('document_id',documentId);
    if(del.error)throw del.error;
    const rows=[];
    if(s.everyone){
      rows.push({document_id:documentId,target_type:'EVERYONE',due_days:s.dueDays,created_by:state.user.id});
    }else{
      for(const id of s.departments)rows.push({document_id:documentId,target_type:'DEPARTMENT',department_id:id,due_days:s.dueDays,created_by:state.user.id});
      for(const id of s.positions)rows.push({document_id:documentId,target_type:'POSITION',position_id:id,due_days:s.dueDays,created_by:state.user.id});
      for(const id of s.users)rows.push({document_id:documentId,target_type:'USER',user_id:id,due_days:s.dueDays,created_by:state.user.id});
    }
    if(rows.length){
      const ins=await sb.from('document_read_audiences_v21119').insert(rows);
      if(ins.error)throw ins.error;
    }
  }

  async function persistReview(versionId){
    const v=(state.versions||[]).find(x=>x.id===versionId);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||isSds(d)||($('approvalDecision')?.value||'APPROVED')!=='APPROVED')return;
    const date=$('approvalReviewDate')?.value||'';
    if(!date)throw new Error('Choose the next review date before approval.');
    const f=selectedReviewFreq();
    const a=await sb.from('documents').update({review_frequency_value:f.value,review_frequency_unit:f.unit}).eq('id',d.id);
    if(a.error)throw a.error;
    const b=await sb.from('document_versions').update({review_date:date}).eq('id',v.id);
    if(b.error)throw b.error;
    d.review_frequency_value=f.value;d.review_frequency_unit=f.unit;v.review_date=date;
  }

  async function decorateApproval(versionId){
    ensureReviewControls(versionId);
    await ensureScopePanel(versionId);
    const v=(state.versions||[]).find(x=>x.id===versionId);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(d)syncScopeUi(d);
    [100,300,650].forEach(ms=>setTimeout(()=>{
      ensureReviewControls(versionId);
      if(d)syncScopeUi(d);
    },ms));
  }

  function docTypeOptions(selected){
    const types=[
      ['RISK_ASSESSMENT','Risk Assessment'],
      ['COSHH','COSHH Risk Assessment'],
      ['SSW','Safe System of Work'],
      ['SDS','SDS / MSDS'],
      ['POLICY','Policy'],
      ['PROCEDURE','Procedure'],
      ['OTHER','Other / Information']
    ];
    return types.map(([v,l])=>`<option value="${v}" ${String(selected||'')===v?'selected':''}>${l}</option>`).join('');
  }

  function folderOptions(selected){
    return `<option value="">No custom folder / main index</option>`+
      (folders||[]).map(f=>`<option value="${esc(f.id)}" ${String(selected||'')===String(f.id)?'selected':''}>${esc(f.name)}</option>`).join('');
  }

  async function openMoveModal(docId){
    if(!isManager())return;
    await loadAux();
    const d=(state.documents||[]).find(x=>x.id===docId);
    if(!d)return;
    const title=$('modalTitle'),body=$('modalBody'),modal=$('modal');
    if(title)title.textContent='Move / classify document';
    if(body)body.innerHTML=`<div class="section-card">
      <h3>${esc(d.reference?d.reference+' - ':'')}${esc(d.title||'Document')}</h3>
      <p class="muted">Move this record without re-uploading it. Version history, approval history, links and stored PDF files remain attached to the same document record.</p>
    </div>
    <div class="form-grid">
      <label>Document type / index
        <select id="moveDocTypeV21131">${docTypeOptions(d.doc_type)}</select>
      </label>
      <label>Folder
        <select id="moveDocFolderV21131">${folderOptions(d.folder_id||'')}</select>
      </label>
    </div>
    <div class="hint-box"><strong>Classification change:</strong> changing between RA/COSHH/SSW and a non-training document changes how Safety Tracker treats future training/approval requirements. Existing evidence/history is retained.</div>
    <div class="actions">
      <button type="button" class="ghost" data-close-modal>Cancel</button>
      <button type="button" class="primary" data-save-move-doc-v21131="${esc(d.id)}">Save move</button>
    </div>`;
    if(modal&&!modal.open)modal.showModal();
  }

  async function saveMove(docId,btn){
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d)return;
    const doc_type=$('moveDocTypeV21131')?.value||d.doc_type;
    const folder_id=$('moveDocFolderV21131')?.value||null;
    btn.disabled=true;const old=btn.textContent;btn.textContent='Moving…';
    try{
      const r=await sb.from('documents').update({doc_type,folder_id}).eq('id',docId).select().maybeSingle();
      if(r.error)throw r.error;
      d.doc_type=doc_type;d.folder_id=folder_id;
      try{$('modal')?.close()}catch(_e){}
      await api.refresh?.('Document moved / reclassified.');
      try{window.renderDocuments?.()}catch(_e){}
      try{window.SafetyGenericDocumentsV21119?.refresh?.()}catch(_e){}
    }catch(e){
      api.toast?.(e?.message||'Could not move document.');
      btn.disabled=false;btn.textContent=old;
    }
  }

  function addMoveButtons(){
    if(!isManager())return;
    const containers=[document.getElementById('documentsList'),document.getElementById('docFolderContentsV21119')].filter(Boolean);
    for(const root of containers){
      for(const card of root.querySelectorAll('.item-card')){
        if(card.querySelector('[data-move-doc-v21131]'))continue;
        const ref=card.querySelector('[data-doc-details]');
        const docId=ref?.dataset.docDetails;
        if(!docId)continue;
        const row=ref.closest('.row')||card.querySelector('.row');
        if(!row)continue;
        const b=document.createElement('button');
        b.type='button';b.className='ghost';b.dataset.moveDocV21131=docId;b.textContent='Move / classify';
        row.appendChild(b);
      }
    }

    const body=$('modalBody');
    if(body && $('modal')?.open && !body.querySelector('[data-move-doc-v21131]')){
      const detailBtn=body.querySelector('[data-new-version],[data-toggle-doc],[data-doc-activity]');
      const id=detailBtn?.dataset.newVersion||detailBtn?.dataset.toggleDoc||detailBtn?.dataset.docActivity;
      const actions=[...body.querySelectorAll('.actions')].pop();
      if(id&&actions){
        const b=document.createElement('button');
        b.type='button';b.className='ghost';b.dataset.moveDocV21131=id;b.textContent='Move / classify';
        actions.prepend(b);
      }
    }
  }

  function install(){
    const style=document.createElement('style');
    style.id='approvalMoveStylesV21131';
    style.textContent=`
      #modalBody .approval-scope-head-v21131{align-items:flex-start;flex-wrap:wrap}
      #modalBody .approval-scope-group-v21131{border:1px solid var(--border,#d7dee7);border-radius:10px;overflow:hidden;margin-top:9px}
      #modalBody .approval-scope-group-v21131 summary{cursor:pointer;padding:10px 12px;font-weight:750}
      #modalBody .approval-scope-list-v21131{display:grid;grid-template-columns:1fr;max-height:230px;overflow-y:auto;overflow-x:hidden;border-top:1px solid var(--border,#d7dee7);padding:4px 8px;overscroll-behavior:contain}
      #modalBody .approval-scope-row-v21131{display:grid!important;grid-template-columns:22px minmax(0,1fr)!important;gap:9px!important;align-items:start!important;width:100%!important;padding:8px 6px!important;margin:0!important}
      #modalBody .approval-scope-row-v21131 input[type="checkbox"]{width:18px!important;height:18px!important;min-width:18px!important;margin:2px 0 0!important;position:static!important;opacity:1!important;pointer-events:auto!important}
      #modalBody .approval-scope-row-v21131 label{display:block!important;min-width:0!important;margin:0!important;padding:0!important;text-align:left!important;cursor:pointer!important}
      #modalBody .approval-scope-row-v21131 label strong{display:block}
      #modalBody .approval-scope-row-v21131 label span{display:block;color:var(--muted,#667585);margin-top:2px}
      #modalBody .approval-scope-everyone-v21131{width:auto!important;min-width:220px!important;border:1px solid var(--border,#d7dee7);border-radius:10px}
      #modalBody .approval-scope-footer-v21131{display:grid;grid-template-columns:minmax(150px,220px) minmax(0,1fr);gap:10px;align-items:end;margin-top:10px}
      #modalBody #approvalReviewControlsV21131>.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media(max-width:680px){
        #modalBody .approval-scope-footer-v21131,
        #modalBody #approvalReviewControlsV21131>.form-grid{grid-template-columns:1fr}
        #modalBody .approval-scope-everyone-v21131{width:100%!important}
      }
    `;
    document.head.appendChild(style);

    const originalShow=window.showVersionApproval;
    if(typeof originalShow==='function'){
      window.showVersionApproval=function(versionId){
        const out=originalShow.apply(this,arguments);
        [0,60,180].forEach(ms=>setTimeout(()=>decorateApproval(versionId),ms));
        return out;
      };
    }

    const previousSave=window.saveVersionApproval;
    if(typeof previousSave==='function'){
      window.saveVersionApproval=async function(versionId){
        if(saving)return;
        const v=(state.versions||[]).find(x=>x.id===versionId);
        const d=(state.documents||[]).find(x=>x.id===v?.document_id);
        if(!v||!d)return previousSave.apply(this,arguments);

        const approved=($('approvalDecision')?.value||'APPROVED')==='APPROVED';
        if(approved && !isSds(d) && !hasScope()){
          api.toast?.('Choose Everyone, a Department, Position or specific person before approval.');
          syncScopeUi(d);return;
        }

        saving=true;
        try{
          if(approved && isGeneric(d))await persistGenericAudience(d.id);
          if(approved && !isSds(d))await persistReview(versionId);
          return await previousSave.apply(this,arguments);
        }catch(e){
          api.toast?.(e?.message||'Could not complete approval.');
        }finally{saving=false}
      };
    }

    document.addEventListener('click',e=>{
      const open=e.target.closest?.('[data-approve-version]');
      if(open){
        const id=open.dataset.approveVersion;
        [30,100,280,650].forEach(ms=>setTimeout(()=>decorateApproval(id),ms));
      }
      const move=e.target.closest?.('[data-move-doc-v21131]');
      if(move){
        e.preventDefault();e.stopImmediatePropagation();
        openMoveModal(move.dataset.moveDocV21131);
      }
      const save=e.target.closest?.('[data-save-move-doc-v21131]');
      if(save){
        e.preventDefault();e.stopImmediatePropagation();
        saveMove(save.dataset.saveMoveDocV21131,save);
      }
    },true);

    // Keep Move / classify available after list renders without polling.
    const docs=$('documentsView');
    if(docs && typeof MutationObserver==='function'){
      new MutationObserver(()=>queueMicrotask(addMoveButtons)).observe(docs,{childList:true,subtree:true});
    }
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-view="documents"],[data-doc-details],[data-v21119-open-folder],[data-v21119-all-docs]')){
        setTimeout(addMoveButtons,80);
      }
    },false);
    setTimeout(addMoveButtons,300);

    window.SafetyApprovalMoveRepairV21131={decorateApproval,addMoveButtons,openMoveModal};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    install();
  }
  boot();
})();