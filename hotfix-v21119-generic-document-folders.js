/* Safety Tracker v2.11.19 - custom document folders + plain controlled documents/templates */
'use strict';
(function(){
  if(window.__SAFETY_GENERIC_DOCUMENTS_V21119)return;
  window.__SAFETY_GENERIC_DOCUMENTS_V21119=true;

  const VERSION='2.11.23';
  let api,state,sb;
  let folders=[],audiences=[],selectedFolderId=null,myReads=[];
  let positions=[],positionDepartments=[],userPositions=[],responsibilities=[],departmentLeads=[];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const clean=s=>String(s??'').replace(/\r/g,'').trim();
  const today=()=>new Date().toISOString().slice(0,10);
  const plusYear=iso=>{const d=new Date((iso||today())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)};
  const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const docTypeLabel=t=>({POLICY:'Policy',PROCEDURE:'Procedure',OTHER:'Information'})[t]||String(t||'Document').replaceAll('_',' ');
  const folderById=id=>folders.find(x=>x.id===id)||null;
  const currentApproved=d=>d?api.approvedCurrentVersion(d.id):null;
  const pending=d=>d?api.pendingApprovalVersion(d.id):null;

  function openModal(title,html){
    const dlg=$('modal'),head=$('modalTitle'),body=$('modalBody');
    if(!dlg||!head||!body)return;
    head.textContent=title;body.innerHTML=html;
    try{if(!dlg.open)dlg.showModal()}catch(_e){dlg.setAttribute('open','')}
  }
  function closeModal(){try{$('modal')?.close()}catch(_e){$('modal')?.removeAttribute('open')}}
  function toast(msg){api.toast?.(msg)}

  function addStyles(){
    if($('genericDocsStyleV21119'))return;
    const s=document.createElement('style');s.id='genericDocsStyleV21119';s.textContent=`
      .doc-folder-workspace-v21119{margin-top:12px}
      .doc-folder-grid-v21119{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px}
      .doc-folder-tile-v21119{appearance:none;text-align:left;border:1px solid var(--border,#d8dee6);border-radius:12px;padding:14px;background:var(--card,#fff);cursor:pointer}
      .doc-folder-tile-v21119 strong{display:block;font-size:1rem;margin-bottom:4px}.doc-folder-tile-v21119 small{display:block;opacity:.75}
      .doc-folder-tile-v21119.active{outline:2px solid #356aa0}
      .generic-doc-content-v21119{min-height:260px;white-space:pre-wrap;font-family:inherit}
      .generic-audience-v21119{display:grid;gap:8px;max-height:220px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:8px;padding:10px}
      .generic-audience-v21119 label{display:flex;gap:8px;align-items:flex-start}
      .generic-responsibility-v21119{margin-top:10px}
      .generic-read-card-v21119 .meta{margin-top:5px}
      .generic-folder-contents-v21119{margin-top:14px}
      .v21123-reader-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0}
      .v21123-reader-box{border:1px solid var(--border,#d8dee6);border-radius:10px;background:var(--card,#fff)}
      .v21123-reader-box summary{cursor:pointer;font-weight:700;padding:10px 12px}
      .v21123-reader-box .generic-audience-v21119{border:0;border-top:1px solid var(--border,#d8dee6);border-radius:0;max-height:180px}
      .v21123-read-days{max-width:180px}
      .v21123-native-controls select{min-height:44px}
      @media(max-width:720px){.doc-folder-grid-v21119{grid-template-columns:1fr 1fr}.generic-audience-v21119{max-height:180px}.v21123-reader-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  async function loadManagerData(){
    if(!isManager())return;
    const [f,a,p,pd,up,resp,dl]=await Promise.all([
      sb.from('document_folders_v21119').select('*').eq('active',true).order('sort_order').order('name'),
      sb.from('document_read_audiences_v21119').select('*'),
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
      sb.from('safety_position_departments_v21069').select('*'),
      sb.from('safety_user_positions_v21069').select('*').eq('active',true),
      sb.from('safety_responsibilities_v21069').select('*').eq('active',true),
      sb.from('department_leads_v21119').select('*')
    ]);
    if(!f.error)folders=f.data||[];
    if(!a.error)audiences=a.data||[];
    if(!p.error)positions=p.data||[];
    if(!pd.error)positionDepartments=pd.data||[];
    if(!up.error)userPositions=up.data||[];
    if(!resp.error)responsibilities=resp.data||[];
    if(!dl.error)departmentLeads=dl.data||[];
  }

  const positionName=id=>positions.find(x=>x.id===id)?.name||'';
  const personNameV21123=id=>{const p=(state.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'Unknown user'};
  function positionDepartmentIds(id){
    const ids=positionDepartments.filter(x=>x.position_id===id).map(x=>x.department_id);
    const p=positions.find(x=>x.id===id);
    if(p?.primary_department_id&&!ids.includes(p.primary_department_id))ids.push(p.primary_department_id);
    return ids;
  }
  function currentHolders(id){return userPositions.filter(x=>x.position_id===id&&x.active!==false).map(x=>x.user_id)}
  function primaryPosition(uid){
    const rows=userPositions.filter(x=>x.user_id===uid&&x.active!==false);
    return rows.find(x=>x.is_primary)||rows[0]||null;
  }
  function personOptionLabel(uid){
    const p=(state.people||[]).find(x=>x.id===uid),up=primaryPosition(uid),pos=up?positionName(up.position_id):'';
    return `${p?.display_name||p?.email||'User'}${pos?` — ${pos}`:''}`;
  }
  function responsibilityValue(d,kind){
    if(!d)return '';
    const posId=kind==='review'?d.review_responsible_position_id:d.approval_responsible_position_id;
    const userId=kind==='review'?d.review_responsible_user_id:d.approval_responsible_user_id;
    if(posId)return `POSITION:${posId}`;
    if(userId)return `USER:${userId}`;
    const legacy=clean(kind==='review'?d.review_responsibility:d.approval_responsibility).toLowerCase();
    if(legacy){
      const pos=positions.find(x=>clean(x.name).toLowerCase()===legacy);
      if(pos)return `POSITION:${pos.id}`;
      const user=(state.people||[]).find(x=>clean(x.display_name||x.email).toLowerCase()===legacy);
      if(user)return `USER:${user.id}`;
    }
    return '';
  }
  function responsibilityOptions(selected=''){
    const pos=positions.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(x=>{
      const holders=currentHolders(x.id).map(personNameV21123).filter(Boolean);
      return `<option value="POSITION:${x.id}" ${selected===`POSITION:${x.id}`?'selected':''}>${esc(x.name)}${holders.length?` — ${esc(holders.join(', '))}`:' — vacant'}</option>`;
    }).join('');
    const people=(state.people||[]).filter(x=>x.active!==false&&x.report_only!==true).sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||''))).map(x=>
      `<option value="USER:${x.id}" ${selected===`USER:${x.id}`?'selected':''}>${esc(personOptionLabel(x.id))}</option>`
    ).join('');
    return `<option value="">Not assigned</option><optgroup label="Positions">${pos}</optgroup><optgroup label="People">${people}</optgroup>`;
  }
  function responsibilityPayload(value,kind){
    const out={[`${kind}_responsibility`]:null,[`${kind}_responsible_user_id`]:null,[`${kind}_responsible_position_id`]:null};
    if(!value)return out;
    const [type,id]=String(value).split(':');
    if(type==='POSITION'){out[`${kind}_responsible_position_id`]=id;out[`${kind}_responsibility`]=positionName(id)||null}
    if(type==='USER'){out[`${kind}_responsible_user_id`]=id;out[`${kind}_responsibility`]=personNameV21123(id)||null}
    return out;
  }
  function suggestedResponsible(sel){
    if(sel.everyone){
      const hs=responsibilities.find(x=>x.responsibility_type==='HS_MANAGER'&&!x.department_id);
      if(hs?.user_id){
        const up=primaryPosition(hs.user_id);
        return up?`POSITION:${up.position_id}`:`USER:${hs.user_id}`;
      }
      const hp=positions.find(x=>/\b(h\s*&\s*s|health\s*(and|&)\s*safety|safety\s+manager)\b/i.test(x.name||''));
      if(hp)return `POSITION:${hp.id}`;
    }
    if(sel.departments.length===1){
      const dep=sel.departments[0];
      const resp=responsibilities.find(x=>x.responsibility_type==='DEPARTMENT_MANAGER'&&x.department_id===dep);
      const lead=departmentLeads.find(x=>x.department_id===dep);
      const uid=resp?.user_id||lead?.user_id;
      if(uid){
        const matching=userPositions.find(x=>x.user_id===uid&&x.active!==false&&positionDepartmentIds(x.position_id).includes(dep));
        const up=matching||primaryPosition(uid);
        return up?`POSITION:${up.position_id}`:`USER:${uid}`;
      }
      const managerPos=positions.find(x=>positionDepartmentIds(x.id).includes(dep)&&/\b(manager|head|lead)\b/i.test(x.name||''));
      if(managerPos)return `POSITION:${managerPos.id}`;
    }
    return state.user?.id?`USER:${state.user.id}`:'';
  }
  function addReviewInterval(base,value,unit){
    const d=new Date((base||today())+'T12:00:00'),n=Math.max(1,Number(value)||12);
    if(unit==='DAYS')d.setDate(d.getDate()+n);
    else if(unit==='YEARS')d.setFullYear(d.getFullYear()+n);
    else d.setMonth(d.getMonth()+n);
    return d.toISOString().slice(0,10);
  }
  function reviewFreq(d){return {value:Number(d?.review_frequency_value)||12,unit:d?.review_frequency_unit||'MONTHS'}}
  function reviewFrequencyHtml(prefix,d){
    const f=reviewFreq(d),key=`${f.value}|${f.unit}`,known=['3|MONTHS','6|MONTHS','12|MONTHS','24|MONTHS','36|MONTHS'],preset=known.includes(key)?key:'CUSTOM';
    return `<label>Review frequency<select id="${prefix}ReviewFreq">
      <option value="3|MONTHS" ${preset==='3|MONTHS'?'selected':''}>Every 3 months</option>
      <option value="6|MONTHS" ${preset==='6|MONTHS'?'selected':''}>Every 6 months</option>
      <option value="12|MONTHS" ${preset==='12|MONTHS'?'selected':''}>Every 12 months</option>
      <option value="24|MONTHS" ${preset==='24|MONTHS'?'selected':''}>Every 24 months</option>
      <option value="36|MONTHS" ${preset==='36|MONTHS'?'selected':''}>Every 36 months</option>
      <option value="CUSTOM" ${preset==='CUSTOM'?'selected':''}>Custom…</option></select>
      <span class="muted">Default 12 months; can be overridden.</span></label>
      <div id="${prefix}ReviewFreqCustom" class="form-grid full" ${preset==='CUSTOM'?'':'hidden'}>
        <label>Every<input id="${prefix}ReviewFreqValue" type="number" min="1" value="${f.value}"></label>
        <label>Unit<select id="${prefix}ReviewFreqUnit"><option value="DAYS" ${f.unit==='DAYS'?'selected':''}>Days</option><option value="MONTHS" ${f.unit==='MONTHS'?'selected':''}>Months</option><option value="YEARS" ${f.unit==='YEARS'?'selected':''}>Years</option></select></label>
      </div>`;
  }
  function getReviewFreq(prefix){
    const p=$(`${prefix}ReviewFreq`)?.value||'12|MONTHS';
    if(p==='CUSTOM')return {value:Math.max(1,Number($(`${prefix}ReviewFreqValue`)?.value)||12),unit:$(`${prefix}ReviewFreqUnit`)?.value||'MONTHS'};
    const [v,u]=p.split('|');return {value:Number(v)||12,unit:u||'MONTHS'};
  }
  function wireReviewFreq(prefix,baseId,nextId){
    const recalc=()=>{const f=getReviewFreq(prefix),next=$(nextId);if(next)next.value=addReviewInterval($(baseId)?.value||today(),f.value,f.unit)};
    $(`${prefix}ReviewFreq`)?.addEventListener('change',()=>{const custom=$(`${prefix}ReviewFreqCustom`);if(custom)custom.hidden=$(`${prefix}ReviewFreq`).value!=='CUSTOM';recalc()});
    $(`${prefix}ReviewFreqValue`)?.addEventListener('input',recalc);
    $(`${prefix}ReviewFreqUnit`)?.addEventListener('change',recalc);
    $(baseId)?.addEventListener('change',recalc);
  }

  function folderControlsHtml(){
    return `<div class="row">
      <button class="primary" type="button" data-v21119-new-folder>New folder</button>
      <button class="secondary" type="button" data-v21119-new-plain>New plain document / template</button>
      ${selectedFolderId?'<button class="ghost" type="button" data-v21119-all-docs>← All documents</button>':''}
    </div>`;
  }

  function folderCardsHtml(){
    if(!folders.length)return `<div class="empty">No custom folders yet. Create a folder for general information, procedures, templates or other controlled documents.</div>`;
    return `<div class="doc-folder-grid-v21119">${folders.map(f=>{
      const docs=state.documents.filter(d=>d.folder_id===f.id&&d.status!=='ARCHIVED');
      const templates=docs.filter(d=>d.is_template).length;
      return `<button type="button" class="doc-folder-tile-v21119 ${selectedFolderId===f.id?'active':''}" data-v21119-open-folder="${f.id}">
        <strong>📁 ${esc(f.name)}</strong>
        <small>${docs.length} document${docs.length===1?'':'s'}${templates?` · ${templates} template${templates===1?'':'s'}`:''}</small>
        ${f.description?`<small>${esc(f.description)}</small>`:''}
      </button>`;
    }).join('')}</div>`;
  }

  function statusForDoc(d){
    const p=pending(d),a=currentApproved(d);
    if(p)return {label:'Pending approval',traffic:'amber'};
    if(!a)return {label:'No approved version',traffic:'red'};
    if(a.review_date&&a.review_date<today())return {label:'Review overdue',traffic:'red'};
    return {label:'Approved/current',traffic:'green'};
  }

  function folderContentsHtml(){
    const f=folderById(selectedFolderId);
    if(!f)return '';
    const docs=state.documents.filter(d=>d.folder_id===f.id&&d.status!=='ARCHIVED')
      .sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    return `<div class="generic-folder-contents-v21119">
      <div class="row-between"><div><h4>📁 ${esc(f.name)}</h4><p class="muted">${esc(f.description||'Custom controlled-document folder.')}</p></div>
      <button class="ghost" type="button" data-v21119-edit-folder="${f.id}">Edit folder</button></div>
      <div class="card-list">${docs.length?docs.map(d=>{
        const st=statusForDoc(d),v=currentApproved(d)||pending(d)||api.currentVersion(d.id);
        return `<div class="item-card traffic-${st.traffic}">
          <div class="row-between"><div><h4>${d.is_template?'📄 Template · ':''}${esc(d.reference?d.reference+' - ':'')}${esc(d.title)}</h4>
          <div class="meta"><span class="badge">${esc(docTypeLabel(d.doc_type))}</span><span>${esc(st.label)}</span>${v?`<span>v${esc(v.version_label||'—')}</span>`:''}${v?.review_date?`<span>Review ${fmtDate(v.review_date)}</span>`:''}</div></div></div>
          ${(d.review_responsibility||d.approval_responsibility)?`<div class="meta generic-responsibility-v21119">${d.review_responsibility?`<span>Review: ${esc(d.review_responsibility)}</span>`:''}${d.approval_responsibility?`<span>Approve: ${esc(d.approval_responsibility)}</span>`:''}</div>`:''}
          <div class="row">
            <button class="secondary" type="button" data-doc-details="${d.id}">Details</button>
            ${d.content_mode==='PLAIN_TEXT'?`<button class="ghost" type="button" data-v21119-edit-text="${d.id}">Edit text / new version</button>`:''}
            <button class="ghost" type="button" data-v21119-controls="${d.id}">Folder / readers / responsibility</button>
            ${d.is_template&&v?.editable_content?`<button class="primary" type="button" data-v21119-use-template="${d.id}">Use template</button>`:''}
          </div>
        </div>`;
      }).join(''):'<div class="empty">This folder is empty.</div>'}</div>
    </div>`;
  }

  function ensureFolderWorkspace(){
    const view=$('documentsView');if(!view)return;
    let box=$('docFolderWorkspaceV21119');
    if(!isManager()){if(box)box.hidden=true;return}
    if(!box){
      box=document.createElement('div');box.id='docFolderWorkspaceV21119';box.className='section-card doc-folder-workspace-v21119';
      const filters=view.querySelector('.document-top-filters');
      if(filters)filters.insertAdjacentElement('afterend',box); else view.prepend(box);
    }
    box.hidden=false;
    box.innerHTML=`<div class="row-between"><div><h3>Document folders</h3><p class="muted">Create your own folders for general information, policies, procedures and reusable templates. Plain documents created here use the normal controlled approval, review and activity history.</p></div></div>
      ${folderControlsHtml()}${folderCardsHtml()}<div id="docFolderContentsV21119">${folderContentsHtml()}</div>`;
    applyFolderView();
  }

  function applyFolderView(){
    const hide=!!selectedFolderId;
    ['documentIndexGrid','documentIndexContext','documentsList'].forEach(id=>{const el=$(id);if(el)el.hidden=hide});
  }

  function audienceEditorHtml(prefix,selectedRows=[],dueDays=14){
    const every=selectedRows.some(x=>x.target_type==='EVERYONE');
    const deps=new Set(selectedRows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const poss=new Set(selectedRows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const users=new Set(selectedRows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    const depHtml=(state.departments||[]).filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(d=>
      `<label><input type="checkbox" data-${prefix}-dep value="${d.id}" ${deps.has(d.id)?'checked':''}> <span>${esc(d.name)}</span></label>`).join('');
    const posHtml=positions.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(p=>{
      const holders=currentHolders(p.id).map(personNameV21123).filter(Boolean);
      return `<label><input type="checkbox" data-${prefix}-position value="${p.id}" ${poss.has(p.id)?'checked':''}> <span><strong>${esc(p.name)}</strong>${holders.length?` <span class="muted">· ${esc(holders.join(', '))}</span>`:' <span class="muted">· vacant</span>'}</span></label>`;
    }).join('');
    const peopleHtml=(state.people||[]).filter(x=>x.active!==false&&x.report_only!==true).sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||''))).map(p=>
      `<label><input type="checkbox" data-${prefix}-user value="${p.id}" ${users.has(p.id)?'checked':''}> <span>${esc(personOptionLabel(p.id))}</span></label>`).join('');
    return `<div class="full v21123-native-controls"><div class="row-between"><div><h4>Who needs to read it?</h4><p class="muted">Assign by department, position or person. Position assignments follow the current position holder.</p></div><label class="check-row"><input id="${prefix}Everyone" type="checkbox" ${every?'checked':''}> <strong>Everyone / whole hotel</strong></label></div>
      <div class="v21123-reader-grid">
        <details class="v21123-reader-box" ${deps.size?'open':''}><summary>Departments${deps.size?` · ${deps.size}`:''}</summary><div class="generic-audience-v21119">${depHtml||'<span class="muted">No departments.</span>'}</div></details>
        <details class="v21123-reader-box" ${poss.size?'open':''}><summary>Positions${poss.size?` · ${poss.size}`:''}</summary><div class="generic-audience-v21119">${posHtml||'<span class="muted">No positions.</span>'}</div></details>
        <details class="v21123-reader-box" ${users.size?'open':''}><summary>Specific people${users.size?` · ${users.size}`:''}</summary><div class="generic-audience-v21119">${peopleHtml||'<span class="muted">No people.</span>'}</div></details>
      </div>
      <label class="v21123-read-days">Read within (days)<input id="${prefix}DueDays" type="number" min="0" max="3650" value="${Number(dueDays)||14}"></label>
    </div>`;
  }

  function readAudienceSelection(prefix){
    return {
      everyone:!!$(`${prefix}Everyone`)?.checked,
      departments:[...document.querySelectorAll(`[data-${prefix}-dep]:checked`)].map(x=>x.value),
      positions:[...document.querySelectorAll(`[data-${prefix}-position]:checked`)].map(x=>x.value),
      users:[...document.querySelectorAll(`[data-${prefix}-user]:checked`)].map(x=>x.value),
      dueDays:Math.max(0,Math.min(3650,Number($(`${prefix}DueDays`)?.value)||14))
    };
  }

  async function saveAudience(documentId,sel){
    const del=await sb.from('document_read_audiences_v21119').delete().eq('document_id',documentId);
    if(del.error)throw del.error;
    const rows=[];
    if(sel.everyone)rows.push({document_id:documentId,target_type:'EVERYONE',due_days:sel.dueDays,created_by:state.user.id});
    if(!sel.everyone){
      for(const id of sel.departments||[])rows.push({document_id:documentId,target_type:'DEPARTMENT',department_id:id,due_days:sel.dueDays,created_by:state.user.id});
      for(const id of sel.positions||[])rows.push({document_id:documentId,target_type:'POSITION',position_id:id,due_days:sel.dueDays,created_by:state.user.id});
      for(const id of sel.users||[])rows.push({document_id:documentId,target_type:'USER',user_id:id,due_days:sel.dueDays,created_by:state.user.id});
    }
    if(rows.length){
      const ins=await sb.from('document_read_audiences_v21119').insert(rows);
      if(ins.error)throw ins.error;
    }
    audiences=audiences.filter(x=>x.document_id!==documentId).concat(rows);
  }

  function showFolderEditor(id=''){
    const f=folderById(id);
    openModal(f?'Edit folder':'New document folder',`<div class="form-grid">
      <label>Folder name<input id="v21119FolderName" value="${esc(f?.name||'')}" placeholder="e.g. General Information"></label>
      <label class="full">Description<textarea id="v21119FolderDescription" placeholder="What belongs in this folder?">${esc(f?.description||'')}</textarea></label>
      <label>Sort order<input id="v21119FolderSort" type="number" value="${Number(f?.sort_order||0)}"></label>
    </div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21119-save-folder="${id}">Save folder</button></div>`);
  }

  async function saveFolder(id=''){
    const name=clean($('v21119FolderName')?.value),description=clean($('v21119FolderDescription')?.value)||null,sort_order=Number($('v21119FolderSort')?.value)||0;
    if(!name)return toast('Folder name is required.');
    let r;
    if(id)r=await sb.from('document_folders_v21119').update({name,description,sort_order,updated_at:new Date().toISOString()}).eq('id',id);
    else r=await sb.from('document_folders_v21119').insert({name,description,sort_order,created_by:state.user.id});
    if(r.error)return toast(r.error.message);
    closeModal();await loadManagerData();ensureFolderWorkspace();toast(id?'Folder updated.':'Folder created.');
  }

  function folderOptions(selected=''){
    return folders.map(f=>`<option value="${f.id}" ${f.id===selected?'selected':''}>${esc(f.name)}</option>`).join('');
  }

  function currentAudienceRows(docId){return audiences.filter(x=>x.document_id===docId)}

  async function showCreatePlain(templateId=''){
    if(!folders.length||!positions.length)await loadManagerData();
    if(!folders.length)return toast('Create a document folder first.');
    const t=templateId?state.documents.find(x=>x.id===templateId):null;
    const tv=t?(currentApproved(t)||api.currentVersion(t.id)):null;
    const content=tv?.editable_content||'';
    const selectedFolder=t?.folder_id||selectedFolderId||folders[0].id;
    const sourceAudience=t?currentAudienceRows(t.id):[];
    const due=sourceAudience[0]?.due_days||14,issue=today(),freq=reviewFreq(t),review=addReviewInterval(issue,freq.value,freq.unit);
    openModal(t?'Create document from template':'New plain controlled document / template',`<div class="form-grid v21123-native-controls" data-v21123-native-controls="1">
      <label>Folder<select id="v21119DocFolder">${folderOptions(selectedFolder)}</select></label>
      <label>Kind<select id="v21119DocKind"><option value="OTHER" ${t?.doc_type==='OTHER'?'selected':''}>Information</option><option value="POLICY" ${t?.doc_type==='POLICY'?'selected':''}>Policy</option><option value="PROCEDURE" ${t?.doc_type==='PROCEDURE'?'selected':''}>Procedure</option></select></label>
      <label>Title<input id="v21119DocTitle" placeholder="Document title"></label>
      <label>Reference (optional)<input id="v21119DocRef" placeholder="e.g. INFO-001"></label>
      <label>Issue date<input id="v21119DocIssue" type="date" value="${issue}"></label>
      ${reviewFrequencyHtml('v21123Create',t)}
      <label>Next review date<input id="v21119DocReview" type="date" value="${review}"><span class="muted">Calculated from review frequency; exact date can be changed.</span></label>
      <label>Responsible for review<select id="v21123CreateReviewResponsible">${responsibilityOptions(responsibilityValue(t,'review'))}</select><span class="muted">Position or named user.</span></label>
      <label>Responsible for approval<select id="v21123CreateApprovalResponsible">${responsibilityOptions(responsibilityValue(t,'approval'))}</select><span class="muted">Position or named user.</span></label>
      <label class="check-row full"><input id="v21119IsTemplate" type="checkbox"> Save this as a reusable template</label>
      <label class="full">Document content<textarea id="v21119DocContent" class="generic-doc-content-v21119" placeholder="Paste or type the document information here.">${esc(content)}</textarea></label>
      ${audienceEditorHtml('v21119Create',sourceAudience,due)}
    </div>
    <div class="hint-box">The first version is created as <strong>v1 Pending approval</strong>. It must be opened and approved through the normal controlled-document workflow before assigned readers can use it.</div>
    <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21119-save-plain data-template-source="${esc(templateId)}">Create pending document</button></div>`);
    wireReviewFreq('v21123Create','v21119DocIssue','v21119DocReview');
    const apply=()=>{
      const sel=readAudienceSelection('v21119Create'),s=suggestedResponsible(sel);
      const r=$('v21123CreateReviewResponsible'),a=$('v21123CreateApprovalResponsible');
      if(r&&!r.dataset.manual&&s)r.value=s;if(a&&!a.dataset.manual&&s)a.value=s;
    };
    $('v21123CreateReviewResponsible')?.addEventListener('change',e=>e.target.dataset.manual='1');
    $('v21123CreateApprovalResponsible')?.addEventListener('change',e=>e.target.dataset.manual='1');
    const createRoot=$('v21123CreateReviewResponsible')?.closest('[data-v21123-native-controls]');
    createRoot?.addEventListener('change',e=>{
      if(e.target.matches('#v21119CreateEveryone,[data-v21119Create-dep],[data-v21119Create-position]'))apply();
    });
    if(!t)apply();
  }

  function makePdfBlob(meta,content){
    const JsPDF=window.jspdf?.jsPDF;
    if(!JsPDF)throw new Error('PDF library did not load. Refresh and try again.');
    const doc=new JsPDF({unit:'mm',format:'a4'});
    const left=15,right=15,width=210-left-right;
    let y=17;
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('SAFETY TRACKER — CONTROLLED DOCUMENT',left,y);
    y+=8;doc.setFontSize(16);
    const titleLines=doc.splitTextToSize(meta.title||'Untitled document',width);
    doc.text(titleLines,left,y);y+=titleLines.length*7+2;
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    const details=[meta.reference?`Reference: ${meta.reference}`:null,`Version: ${meta.version}`,`Issue date: ${fmtDate(meta.issue)}`].filter(Boolean).join('   |   ');
    doc.text(details,left,y);y+=8;doc.line(left,y,210-right,y);y+=7;
    doc.setFontSize(10);
    const lines=String(content||'').replace(/\r/g,'').split('\n');
    for(const raw of lines){
      const line=raw||' ';
      const wrapped=doc.splitTextToSize(line,width);
      const need=Math.max(5,wrapped.length*5);
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

  async function savePlain(templateId=''){
    if(!isManager())return;
    const folder_id=$('v21119DocFolder')?.value||null,title=clean($('v21119DocTitle')?.value),reference=clean($('v21119DocRef')?.value).toUpperCase()||null;
    const doc_type=$('v21119DocKind')?.value||'OTHER',issue=$('v21119DocIssue')?.value||today();
    const freq=getReviewFreq('v21123Create'),review=$('v21119DocReview')?.value||addReviewInterval(issue,freq.value,freq.unit);
    const reviewSel=$('v21123CreateReviewResponsible')?.value||'',approvalSel=$('v21123CreateApprovalResponsible')?.value||'';
    const resp={...responsibilityPayload(reviewSel,'review'),...responsibilityPayload(approvalSel,'approval')};
    const is_template=!!$('v21119IsTemplate')?.checked,content=clean($('v21119DocContent')?.value);
    const aud=readAudienceSelection('v21119Create');
    if(!folder_id)return toast('Choose a folder.');
    if(!title)return toast('Document title is required.');
    if(!content)return toast('Add some document content.');
    const documentId=crypto.randomUUID(),versionId=crypto.randomUUID(),version='1';
    const base=api.safeFileName(reference||title),file_name=`${base}-v1.pdf`,storage_path=`documents/${documentId}/${versionId}-${file_name}`;
    const pdf=makePdfBlob({title,reference,version,issue},content);
    const dIns=await sb.from('documents').insert({
      id:documentId,title,reference,doc_type,status:'ACTIVE',created_by:state.user.id,
      folder_id,is_template,content_mode:'PLAIN_TEXT',review_frequency_value:freq.value,review_frequency_unit:freq.unit,...resp,
      created_from_document_id:templateId||null
    });
    if(dIns.error)return toast(dIns.error.message);
    const up=await sb.storage.from('safety-files').upload(storage_path,pdf,{contentType:'application/pdf'});
    if(up.error){await sb.from('documents').delete().eq('id',documentId);return toast(up.error.message)}
    const vIns=await sb.from('document_versions').insert({
      id:versionId,document_id:documentId,version_label:'1',issue_date:issue,review_date:review,
      storage_path,file_name,notes:`Created in Safety Tracker plain document editor v${VERSION}.`,
      status:'CURRENT',approval_status:'PENDING',created_by:state.user.id,editable_content:content,content_format:'PLAIN_TEXT'
    });
    if(vIns.error){
      await sb.storage.from('safety-files').remove([storage_path]);
      await sb.from('documents').delete().eq('id',documentId);
      return toast(vIns.error.message);
    }
    try{await saveAudience(documentId,aud)}catch(e){console.warn(e);toast('Document created, but the read audience could not be saved. Open its controls and try again.')}
    closeModal();await api.refresh('Plain controlled document created as v1 Pending approval.');await loadManagerData();selectedFolderId=folder_id;ensureFolderWorkspace();
  }

  async function showGenericControls(docId){
    if(!folders.length||!positions.length)await loadManagerData();
    const d=state.documents.find(x=>x.id===docId);if(!d)return;
    const rows=currentAudienceRows(docId),due=rows[0]?.due_days||14,v=pending(d)||currentApproved(d)||api.currentVersion(d.id),f=reviewFreq(d);
    openModal('Folder, readers & responsibility',`<div class="v21123-native-controls" data-v21123-native-controls="1"><p><strong>${esc(d.reference?d.reference+' - ':'')}${esc(d.title)}</strong></p><div class="form-grid">
      <label>Folder<select id="v21119CtrlFolder"><option value="">Unfiled</option>${folderOptions(d.folder_id||'')}</select></label>
      <label class="check-row"><input id="v21119CtrlTemplate" type="checkbox" ${d.is_template?'checked':''}> Reusable template</label>
      <label>Responsible for review<select id="v21123CtrlReviewResponsible">${responsibilityOptions(responsibilityValue(d,'review'))}</select><span class="muted">Choose a position or active user.</span></label>
      <label>Responsible for approval<select id="v21123CtrlApprovalResponsible">${responsibilityOptions(responsibilityValue(d,'approval'))}</select><span class="muted">Choose a position or active user.</span></label>
      ${reviewFrequencyHtml('v21123Ctrl',d)}
      <label>Next review date<input id="v21123CtrlReviewDate" type="date" value="${esc(v?.review_date||addReviewInterval(today(),f.value,f.unit))}"><span class="muted">Calculated from the frequency; exact date can be overridden.</span></label>
      <input id="v21123CtrlBaseDate" type="hidden" value="${esc(v?.issue_date||today())}">
      ${audienceEditorHtml('v21119Ctrl',rows,due)}
    </div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21119-save-controls="${docId}">Save controls</button></div></div>`);
    wireReviewFreq('v21123Ctrl','v21123CtrlBaseDate','v21123CtrlReviewDate');
  }

  async function saveGenericControls(docId){
    const d=state.documents.find(x=>x.id===docId);if(!d)return;
    const freq=getReviewFreq('v21123Ctrl'),reviewDate=$('v21123CtrlReviewDate')?.value||null;
    const resp={...responsibilityPayload($('v21123CtrlReviewResponsible')?.value||'','review'),...responsibilityPayload($('v21123CtrlApprovalResponsible')?.value||'','approval')};
    const payload={
      folder_id:$('v21119CtrlFolder')?.value||null,
      is_template:!!$('v21119CtrlTemplate')?.checked,
      review_frequency_value:freq.value,review_frequency_unit:freq.unit,...resp
    };
    const up=await sb.from('documents').update(payload).eq('id',docId);
    if(up.error)return toast(up.error.message);
    try{await saveAudience(docId,readAudienceSelection('v21119Ctrl'))}catch(e){return toast(e.message||'Could not save reader audience.')}
    const v=pending(d)||currentApproved(d)||api.currentVersion(d.id);
    if(v&&reviewDate){
      const vr=await sb.from('document_versions').update({review_date:reviewDate}).eq('id',v.id);
      if(vr.error)return toast(`Controls saved, but review date failed: ${vr.error.message}`);
    }
    closeModal();await api.refresh('Document folder, readers, responsibilities and review frequency updated.');await loadManagerData();ensureFolderWorkspace();
  }

  function showEditText(docId){
    const d=state.documents.find(x=>x.id===docId);if(!d||d.content_mode!=='PLAIN_TEXT')return;
    const p=pending(d),base=p||currentApproved(d)||api.currentVersion(d.id);
    if(!base?.editable_content)return toast('Editable plain-text source is not available for this document.');
    const isPending=api.versionApprovalStatus(base)==='PENDING';
    const next=isPending?base.version_label:api.nextVersionLabel(d.id);
    openModal(isPending?'Edit pending plain document':'Edit plain document — create new version',`<p><strong>${esc(d.reference?d.reference+' - ':'')}${esc(d.title)}</strong></p><div class="form-grid">
      <label>Version<input value="${esc(next)}" readonly></label>
      <label>Issue date<input id="v21119EditIssue" type="date" value="${esc(isPending?(base.issue_date||today()):today())}"></label>
      <label>Review date<input id="v21119EditReview" type="date" value="${esc(isPending?(base.review_date||plusYear(today())):plusYear(today()))}"></label>
      <label class="full">Document content<textarea id="v21119EditContent" class="generic-doc-content-v21119">${esc(base.editable_content||'')}</textarea></label>
    </div><div class="hint-box">${isPending?'This updates the existing pending version. It will still require approval.':'The approved/current version remains in use until this replacement is approved.'}</div>
    <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21119-save-edit="${docId}" data-version-id="${base.id}" data-pending="${isPending?'1':'0'}">${isPending?'Update pending version':'Create pending version'}</button></div>`);
  }

  async function saveEditText(docId,baseVersionId,isPending){
    const d=state.documents.find(x=>x.id===docId),base=state.versions.find(x=>x.id===baseVersionId);if(!d||!base)return;
    const content=clean($('v21119EditContent')?.value),issue=$('v21119EditIssue')?.value||today(),review=$('v21119EditReview')?.value||plusYear(issue);
    if(!content)return toast('Document content cannot be empty.');
    if(isPending){
      const pdf=makePdfBlob({title:d.title,reference:d.reference,version:base.version_label,issue},content);
      const up=await sb.storage.from('safety-files').upload(base.storage_path,pdf,{contentType:'application/pdf',upsert:true});
      if(up.error)return toast(up.error.message);
      const vr=await sb.from('document_versions').update({issue_date:issue,review_date:review,editable_content:content,content_format:'PLAIN_TEXT',notes:`Pending plain document updated in Safety Tracker v${VERSION}.`}).eq('id',base.id);
      if(vr.error)return toast(vr.error.message);
      closeModal();await api.refresh('Pending document updated. Open the PDF again before approval.');await loadManagerData();ensureFolderWorkspace();return;
    }
    if(pending(d))return toast('A replacement version is already pending approval.');
    const version=api.nextVersionLabel(d.id),versionId=crypto.randomUUID(),baseName=api.safeFileName(d.reference||d.title),file_name=`${baseName}-v${api.safeFileName(version)}.pdf`,storage_path=`documents/${d.id}/${versionId}-${file_name}`;
    const pdf=makePdfBlob({title:d.title,reference:d.reference,version,issue},content);
    const up=await sb.storage.from('safety-files').upload(storage_path,pdf,{contentType:'application/pdf'});
    if(up.error)return toast(up.error.message);
    const ins=await sb.from('document_versions').insert({
      id:versionId,document_id:d.id,version_label:version,issue_date:issue,review_date:review,storage_path,file_name,
      notes:`Edited in Safety Tracker plain document editor v${VERSION}.`,status:'SUPERSEDED',approval_status:'PENDING',
      created_by:state.user.id,editable_content:content,content_format:'PLAIN_TEXT'
    });
    if(ins.error){await sb.storage.from('safety-files').remove([storage_path]);return toast(ins.error.message)}
    closeModal();await api.refresh(`New version v${version} created Pending approval. Current approved version remains in use.`);await loadManagerData();ensureFolderWorkspace();
  }

  function audienceSummary(docId){
    const rows=currentAudienceRows(docId);if(!rows.length)return 'No required readers set';
    if(rows.some(x=>x.target_type==='EVERYONE'))return 'Everyone / whole hotel';
    const deps=rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>(state.departments||[]).find(d=>d.id===x.department_id)?.name).filter(Boolean);
    const poss=rows.filter(x=>x.target_type==='POSITION').map(x=>positionName(x.position_id)).filter(Boolean);
    const users=rows.filter(x=>x.target_type==='USER').map(x=>(state.people||[]).find(p=>p.id===x.user_id)?.display_name).filter(Boolean);
    return [...deps,...poss,...users].join(', ')||'Reader audience set';
  }

  function decorateDocumentModal(docId,mode='details'){
    if(!isManager())return;
    const d=state.documents.find(x=>x.id===docId),body=$('modalBody');if(!d||!body)return;
    if(body.querySelector('[data-v21119-responsibility-card]'))return;
    const f=folderById(d.folder_id);
    const box=document.createElement('div');box.dataset.v21119ResponsibilityCard='1';
    box.className='hint-box generic-responsibility-v21119';
    if(mode==='approval'){
      box.innerHTML=`<strong>Approval responsibility:</strong> ${esc(d.approval_responsibility||'Not specified')}<br><span class="muted">The actual approval is still recorded against the authenticated Manager/Admin who completes it.</span>`;
    }else if(mode==='review'){
      box.innerHTML=`<strong>Review responsibility:</strong> ${esc(d.review_responsibility||'Not specified')}<br><span class="muted">The actual controlled review is recorded against the authenticated Manager/Admin who completes it.</span>`;
    }else{
      box.innerHTML=`<strong>Folder:</strong> ${esc(f?.name||'Unfiled')}<br><strong>Readers:</strong> ${esc(audienceSummary(d.id))}<br><strong>Responsible for review:</strong> ${esc(d.review_responsibility||'Not specified')}<br><strong>Responsible for approval:</strong> ${esc(d.approval_responsibility||'Not specified')}<div class="row" style="margin-top:8px"><button class="ghost" type="button" data-v21119-controls="${d.id}">Edit folder / readers / responsibility</button>${d.content_mode==='PLAIN_TEXT'?`<button class="ghost" type="button" data-v21119-edit-text="${d.id}">Edit text / new version</button>`:''}</div>`;
    }
    body.prepend(box);
  }

  async function loadMyReads(){
    if(!state?.user?.id)return;
    const r=await sb.rpc('my_document_reads_v21119');
    if(r.error){console.warn('v2.11.19 my reads',r.error);return}
    myReads=r.data||[];
    renderMyReads();
  }

  function ensureMyReadsBox(){
    const view=$('mySafetyView');if(!view)return null;
    let box=$('myGenericReadsV21119');
    if(!box){
      box=document.createElement('div');box.id='myGenericReadsV21119';box.className='section-card';
      const cards=view.querySelectorAll('.section-card');const anchor=cards[cards.length-1];
      if(anchor)anchor.insertAdjacentElement('afterend',box);else view.appendChild(box);
    }
    return box;
  }

  function renderMyReads(){
    const box=ensureMyReadsBox();if(!box)return;
    if(!myReads.length){box.hidden=true;return}
    box.hidden=false;
    const now=today(),outstanding=myReads.filter(x=>!x.reviewed_at),overdue=outstanding.filter(x=>x.due_date&&x.due_date<now);
    box.innerHTML=`<div class="row-between"><div><h3>Documents to read</h3><p class="muted">General controlled information assigned to you. This is a read acknowledgement, not formal H&amp;S training.</p></div><div class="meta"><span>${outstanding.length} outstanding</span>${overdue.length?`<span class="badge overdue">${overdue.length} overdue</span>`:''}</div></div>
      <div class="card-list">${myReads.map(r=>{
        const done=!!r.reviewed_at,late=!done&&r.due_date&&r.due_date<now,traffic=done?'green':late?'red':'amber',label=done?'Read':late?'Overdue':'To read';
        return `<div class="item-card generic-read-card-v21119 traffic-${traffic}"><div class="row-between"><div><h4>${esc(r.reference?r.reference+' - ':'')}${esc(r.title)}</h4><div class="meta"><span class="badge ${done?'complete':late?'overdue':'due'}">${label}</span>${r.folder_name?`<span>📁 ${esc(r.folder_name)}</span>`:''}<span>v${esc(r.version_label||'')}</span>${r.due_date?`<span>Read by ${fmtDate(r.due_date)}</span>`:''}${r.reviewed_at?`<span>Read ${fmtDate(r.reviewed_at)}</span>`:''}</div></div></div>
          <div class="row"><button class="secondary" type="button" data-v21119-open-read="${r.version_id}">Open document</button>${!done?`<button class="primary" type="button" data-v21119-mark-read="${r.version_id}">Mark as read</button>`:''}</div></div>`;
      }).join('')}</div>`;
  }

  async function openAssigned(versionId){
    const r=myReads.find(x=>x.version_id===versionId);if(!r?.storage_path)return toast('Stored document not found.');
    if(!navigator.onLine)return toast('Reconnect to open this general document.');
    let popup=null;try{popup=window.open('about:blank','_blank')}catch(_e){}
    try{
      const dl=await sb.storage.from('safety-files').download(r.storage_path);
      if(dl.error||!dl.data)throw new Error(dl.error?.message||'Could not open document.');
      const url=URL.createObjectURL(dl.data);
      if(popup&&!popup.closed){popup.opener=null;popup.location.href=url}else window.location.href=url;
      setTimeout(()=>URL.revokeObjectURL(url),120000);
      await api.logDocumentActivity('OPENED',{document_id:r.document_id,document_version_id:r.version_id,document_reference:r.reference,document_title:r.title,version_label:r.version_label,file_name:r.file_name,source_context:'GENERIC_DOCUMENT_READ'});
      toast('Document opened. When you have read it, return and select Mark as read.');
    }catch(e){try{popup?.close()}catch(_e){}toast(e.message||'Could not open document.')}
  }

  async function markAssignedRead(versionId){
    const r=myReads.find(x=>x.version_id===versionId);if(!r)return;
    const opened=(state.documentActivity||[]).some(a=>a.user_id===state.user.id&&a.document_version_id===versionId&&a.action==='OPENED');
    if(!opened)return toast('Open the document first. Safety Tracker must record that the exact version was opened.');
    const row=await api.logDocumentActivity('REVIEWED',{document_id:r.document_id,document_version_id:r.version_id,document_reference:r.reference,document_title:r.title,version_label:r.version_label,file_name:r.file_name,source_context:'GENERIC_DOCUMENT_READ'},null,true);
    if(!row)return;
    await loadMyReads();toast('Read acknowledgement recorded.');
  }

  function refreshScreen(){
    if(isManager()){loadManagerData().then(()=>ensureFolderWorkspace()).catch(console.warn)}
    loadMyReads().catch(console.warn);
  }

  function install(){
    addStyles();
    ensureFolderWorkspace();
    refreshScreen();

    document.addEventListener('click',e=>{
      const t=e.target.closest?.('button,[data-v21119-open-folder]');
      if(!t)return;

      if(t.dataset.v21119NewFolder!==undefined){e.preventDefault();e.stopImmediatePropagation();showFolderEditor();return}
      if(t.dataset.v21119EditFolder){e.preventDefault();e.stopImmediatePropagation();showFolderEditor(t.dataset.v21119EditFolder);return}
      if(t.dataset.v21119SaveFolder!==undefined){e.preventDefault();e.stopImmediatePropagation();saveFolder(t.dataset.v21119SaveFolder);return}
      if(t.dataset.v21119OpenFolder){e.preventDefault();e.stopImmediatePropagation();selectedFolderId=t.dataset.v21119OpenFolder;ensureFolderWorkspace();return}
      if(t.dataset.v21119AllDocs!==undefined){e.preventDefault();e.stopImmediatePropagation();selectedFolderId=null;ensureFolderWorkspace();return}
      if(t.dataset.v21119NewPlain!==undefined){e.preventDefault();e.stopImmediatePropagation();showCreatePlain();return}
      if(t.dataset.v21119UseTemplate){e.preventDefault();e.stopImmediatePropagation();showCreatePlain(t.dataset.v21119UseTemplate);return}
      if(t.dataset.v21119SavePlain!==undefined){e.preventDefault();e.stopImmediatePropagation();savePlain(t.dataset.templateSource||'');return}
      if(t.dataset.v21119Controls){e.preventDefault();e.stopImmediatePropagation();showGenericControls(t.dataset.v21119Controls);return}
      if(t.dataset.v21119SaveControls){e.preventDefault();e.stopImmediatePropagation();saveGenericControls(t.dataset.v21119SaveControls);return}
      if(t.dataset.v21119EditText){e.preventDefault();e.stopImmediatePropagation();showEditText(t.dataset.v21119EditText);return}
      if(t.dataset.v21119SaveEdit){e.preventDefault();e.stopImmediatePropagation();saveEditText(t.dataset.v21119SaveEdit,t.dataset.versionId,t.dataset.pending==='1');return}
      if(t.dataset.v21119OpenRead){e.preventDefault();e.stopImmediatePropagation();openAssigned(t.dataset.v21119OpenRead);return}
      if(t.dataset.v21119MarkRead){e.preventDefault();e.stopImmediatePropagation();markAssignedRead(t.dataset.v21119MarkRead);return}

      const nav=t.closest?.('[data-view]');
      if(nav?.dataset.view==='documents'||nav?.dataset.view==='mySafety')setTimeout(refreshScreen,100);

      if(t.dataset.docDetails){const id=t.dataset.docDetails;setTimeout(()=>decorateDocumentModal(id,'details'),80)}
      if(t.dataset.approveVersion){const v=state.versions.find(x=>x.id===t.dataset.approveVersion);if(v)setTimeout(()=>decorateDocumentModal(v.document_id,'approval'),80)}
      if(t.dataset.reviewDoc){setTimeout(()=>decorateDocumentModal(t.dataset.reviewDoc,'review'),80)}
    },true);

    window.addEventListener('pageshow',()=>setTimeout(refreshScreen,150));
    window.SafetyGenericDocumentsV21119={refresh:refreshScreen,loadManagerData,loadMyReads};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,120);return}
    state=api.state;sb=api.sb;
    install();
  }
  boot();
})();
