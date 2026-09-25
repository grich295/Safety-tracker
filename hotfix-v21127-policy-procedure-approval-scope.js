/* Safety Tracker v2.11.27 - Policy / Procedure approval scope controls */
'use strict';
(function(){
  if(window.__SAFETY_GENERIC_APPROVAL_SCOPE_V21127)return;
  window.__SAFETY_GENERIC_APPROVAL_SCOPE_V21127=true;

  let api,state,sb;
  let positions=[];
  let activeVersionId='';
  let activeDocumentId='';
  let saving=false;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]||c));
  const genericTypes=new Set(['POLICY','PROCEDURE','OTHER']);

  function isGenericDocument(d){
    if(!d)return false;
    return genericTypes.has(String(d.doc_type||'').toUpperCase()) || String(d.content_mode||'').toUpperCase()==='PLAIN_TEXT';
  }

  function activeDepartments(){
    return (state.departments||[]).filter(x=>x.active!==false)
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }

  function activePeople(){
    return (state.people||[]).filter(x=>x.active!==false&&x.report_only!==true)
      .sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  }

  function activePositions(){
    return (positions||[]).filter(x=>x.active!==false)
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }

  async function loadPositions(){
    try{
      const r=await sb.from('safety_positions_v21069').select('*').eq('active',true).order('name');
      if(!r.error)positions=r.data||[];
    }catch(_e){}
  }

  async function loadAudience(documentId){
    try{
      const r=await sb.from('document_read_audiences_v21119').select('*').eq('document_id',documentId);
      if(r.error)return [];
      return r.data||[];
    }catch(_e){return []}
  }

  function selection(){
    return {
      everyone:!!$('genericApprovalEveryoneV21127')?.checked,
      departments:[...document.querySelectorAll('[data-generic-approval-dep-v21127]:checked')].map(x=>x.value),
      positions:[...document.querySelectorAll('[data-generic-approval-position-v21127]:checked')].map(x=>x.value),
      users:[...document.querySelectorAll('[data-generic-approval-user-v21127]:checked')].map(x=>x.value),
      dueDays:Math.max(0,Math.min(3650,Number($('genericApprovalDueDaysV21127')?.value)||14))
    };
  }

  function hasScope(sel=selection()){
    return !!(sel.everyone||sel.departments.length||sel.positions.length||sel.users.length);
  }

  function summaryText(sel=selection()){
    if(sel.everyone)return 'Everyone / whole hotel';
    const bits=[];
    if(sel.departments.length)bits.push(`${sel.departments.length} department${sel.departments.length===1?'':'s'}`);
    if(sel.positions.length)bits.push(`${sel.positions.length} position${sel.positions.length===1?'':'s'}`);
    if(sel.users.length)bits.push(`${sel.users.length} specific ${sel.users.length===1?'person':'people'}`);
    return bits.join(' + ')||'No reader scope selected';
  }

  function renderAudience(rows){
    const everyone=rows.some(x=>x.target_type==='EVERYONE');
    const depSet=new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const posSet=new Set(rows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const userSet=new Set(rows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    const due=Number(rows[0]?.due_days||14);

    const depHtml=activeDepartments().map(d=>
      `<label class="check-row"><input type="checkbox" data-generic-approval-dep-v21127 value="${esc(d.id)}" ${depSet.has(d.id)?'checked':''}> ${esc(d.name)}</label>`
    ).join('')||'<span class="muted">No active departments.</span>';

    const posHtml=activePositions().map(p=>
      `<label class="check-row"><input type="checkbox" data-generic-approval-position-v21127 value="${esc(p.id)}" ${posSet.has(p.id)?'checked':''}> ${esc(p.name)}</label>`
    ).join('')||'<span class="muted">No positions configured.</span>';

    const peopleHtml=activePeople().map(p=>
      `<label class="check-row"><input type="checkbox" data-generic-approval-user-v21127 value="${esc(p.id)}" ${userSet.has(p.id)?'checked':''}> ${esc(p.display_name||p.email||'User')}</label>`
    ).join('')||'<span class="muted">No active users.</span>';

    return `<div id="genericApprovalScopeV21127" class="section-card generic-approval-scope-v21127">
      <div class="row-between">
        <div>
          <h4>Policy / Procedure scope</h4>
          <p class="muted">Choose who must read this controlled document. This is the document scope used for approval and future read acknowledgements; it is not formal RA/COSHH/SSW training.</p>
        </div>
        <label class="check-row"><input id="genericApprovalEveryoneV21127" type="checkbox" ${everyone?'checked':''}> <strong>Everyone / whole hotel</strong></label>
      </div>
      <div class="generic-approval-grid-v21127">
        <details ${depSet.size?'open':''}><summary>Departments${depSet.size?` · ${depSet.size}`:''}</summary><div class="checkbox-list">${depHtml}</div></details>
        <details ${posSet.size?'open':''}><summary>Positions${posSet.size?` · ${posSet.size}`:''}</summary><div class="checkbox-list">${posHtml}</div></details>
        <details ${userSet.size?'open':''}><summary>Specific people${userSet.size?` · ${userSet.size}`:''}</summary><div class="checkbox-list">${peopleHtml}</div></details>
      </div>
      <div class="row-between generic-approval-footer-v21127">
        <label>Read within (days)<input id="genericApprovalDueDaysV21127" type="number" min="0" max="3650" value="${due}"></label>
        <div id="genericApprovalSummaryV21127" class="hint-box"></div>
      </div>
    </div>`;
  }

  function syncUi(){
    const box=$('genericApprovalScopeV21127');
    if(!box)return;
    const sel=selection();
    const disabled=sel.everyone;
    box.querySelectorAll('[data-generic-approval-dep-v21127],[data-generic-approval-position-v21127],[data-generic-approval-user-v21127]')
      .forEach(x=>x.disabled=disabled);

    const sum=$('genericApprovalSummaryV21127');
    if(sum)sum.innerHTML=hasScope(sel)
      ?`<strong>Scope set:</strong> ${esc(summaryText(sel))}`
      :'<strong>Scope required.</strong> Choose Everyone, at least one Department, Position or specific person.';

    const decision=$('approvalDecision')?.value||'APPROVED';
    box.hidden=decision!=='APPROVED';

    // Replace the older responsibility warning for generic controlled documents.
    const hint=$('responsibilityApprovalHintV21090');
    const action=document.querySelector('#modalBody [data-save-version-approval]');
    if(decision!=='APPROVED'){
      if(action){action.disabled=false;action.title='';}
      return;
    }

    if(hint){
      hint.className=hasScope(sel)?'success-note':'danger-note';
      hint.innerHTML=hasScope(sel)
        ?`<strong>Document scope:</strong> ${esc(summaryText(sel))}. Approval will be recorded against the authenticated Manager/Admin.`
        :'<strong>Scope required.</strong> Choose Everyone, a Department, Position or specific person before this approval.';
    }
    if(action){
      action.disabled=!hasScope(sel);
      action.title=hasScope(sel)?'':'Set the Policy / Procedure scope before approval.';
    }
  }

  async function saveAudience(documentId){
    const sel=selection();
    if(!hasScope(sel))throw new Error('Choose Everyone, a Department, Position or specific person before approval.');

    const del=await sb.from('document_read_audiences_v21119').delete().eq('document_id',documentId);
    if(del.error)throw del.error;

    const rows=[];
    if(sel.everyone){
      rows.push({document_id:documentId,target_type:'EVERYONE',due_days:sel.dueDays,created_by:state.user.id});
    }else{
      for(const id of sel.departments)rows.push({document_id:documentId,target_type:'DEPARTMENT',department_id:id,due_days:sel.dueDays,created_by:state.user.id});
      for(const id of sel.positions)rows.push({document_id:documentId,target_type:'POSITION',position_id:id,due_days:sel.dueDays,created_by:state.user.id});
      for(const id of sel.users)rows.push({document_id:documentId,target_type:'USER',user_id:id,due_days:sel.dueDays,created_by:state.user.id});
    }

    if(rows.length){
      const ins=await sb.from('document_read_audiences_v21119').insert(rows);
      if(ins.error)throw ins.error;
    }

    // Keep any loaded client-side audience collections coherent for later screens.
    if(Array.isArray(state.documentReadAudiences)){
      state.documentReadAudiences=state.documentReadAudiences.filter(x=>x.document_id!==documentId).concat(rows);
    }
    return rows;
  }

  async function decorate(versionId){
    const body=$('modalBody');
    const modal=$('modal');
    if(!body||!modal?.open)return;

    const action=body.querySelector('[data-save-version-approval]');
    const id=versionId||action?.dataset.saveVersionApproval||'';
    if(!id)return;

    const v=(state.versions||[]).find(x=>x.id===id);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||!isGenericDocument(d))return;

    activeVersionId=id;
    activeDocumentId=d.id;

    if(!$('genericApprovalScopeV21127')){
      await loadPositions();
      const rows=await loadAudience(d.id);
      const actions=[...body.querySelectorAll('.actions')].pop();
      const holder=document.createElement('div');
      holder.innerHTML=renderAudience(rows);
      const panel=holder.firstElementChild;
      if(actions)actions.insertAdjacentElement('beforebegin',panel);
      else body.appendChild(panel);

      panel.addEventListener('change',syncUi);
      $('approvalDecision')?.addEventListener('change',syncUi);
    }

    // Older decorators can run after us. Re-apply a few times without a DOM observer.
    [0,80,220,500].forEach(ms=>setTimeout(syncUi,ms));
  }

  async function handleApprovalClick(e){
    const btn=e.target.closest?.('#modalBody [data-save-version-approval]');
    if(!btn||saving)return;

    const versionId=btn.dataset.saveVersionApproval;
    const v=(state.versions||[]).find(x=>x.id===versionId);
    const d=(state.documents||[]).find(x=>x.id===v?.document_id);
    if(!v||!d||!isGenericDocument(d))return;

    // Returning for changes does not require a reader scope change.
    if(($('approvalDecision')?.value||'APPROVED')!=='APPROVED')return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if(!$('approvalAck')?.checked){
      api.toast?.('Tick the confirmation first.');
      return;
    }
    if(!hasScope()){
      api.toast?.('Choose Everyone, a Department, Position or specific person before approval.');
      syncUi();
      return;
    }

    saving=true;
    const old=btn.textContent;
    btn.disabled=true;
    btn.textContent='Saving scope…';
    try{
      await saveAudience(d.id);
      btn.textContent='Approving…';

      // The base approval RPC does not need the generic reader audience as parameters;
      // that audience is stored separately above.
      const fn=window.saveVersionApproval;
      if(typeof fn!=='function')throw new Error('Approval function is unavailable. Refresh the page and try again.');
      await fn(versionId);
    }catch(err){
      api.toast?.(err?.message||'Could not save the Policy / Procedure scope.');
      btn.disabled=false;
      btn.textContent=old;
      saving=false;
      return;
    }
    saving=false;
  }

  function install(){
    const style=document.createElement('style');
    style.id='genericApprovalScopeStylesV21127';
    style.textContent=`
      .generic-approval-scope-v21127{margin-top:12px}
      .generic-approval-grid-v21127{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
      .generic-approval-grid-v21127 details{border:1px solid var(--border,#d7dee7);border-radius:10px;overflow:hidden}
      .generic-approval-grid-v21127 summary{cursor:pointer;font-weight:700;padding:10px 12px}
      .generic-approval-grid-v21127 .checkbox-list{border:0;border-top:1px solid var(--border,#d7dee7);border-radius:0;max-height:180px}
      .generic-approval-footer-v21127{align-items:end;margin-top:10px}
      .generic-approval-footer-v21127 label{max-width:180px}
      @media(max-width:850px){.generic-approval-grid-v21127{grid-template-columns:1fr}}
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

    document.addEventListener('click',e=>{
      const open=e.target.closest?.('[data-approve-version]');
      if(open){
        const id=open.dataset.approveVersion;
        [40,120,300].forEach(ms=>setTimeout(()=>decorate(id),ms));
      }
    },false);

    // Capture only the generic approval save click, save its scope first, then call
    // the normal approval function. RA/COSHH/SSW/SDS flows remain untouched.
    document.addEventListener('click',handleApprovalClick,true);

    window.SafetyGenericApprovalScopeV21127={
      decorate,
      selection,
      syncUi
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