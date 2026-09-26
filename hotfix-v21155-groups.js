/* Safety Tracker v2.11.55 CLEAN
   Dynamic Groups
   - Built-in Department Managers group (auto membership from responsibility records)
   - Custom groups containing specific people, position titles and/or departments
   - Groups can be selected anywhere the current Training / Awareness audience picker is used
   - Group membership stays live: changes to titles, departments or Department Manager responsibility
     automatically recalculate audience assignments in the database.
*/
'use strict';
(function(){
  if(window.__SAFETY_GROUPS_V21155)return;
  window.__SAFETY_GROUPS_V21155=true;

  let api=null,state=null,sb=null;
  let groups=[],groupMembers=[],positions=[],currentSiteId=null;
  let originalRpc=null;
  const resolved=new Map();

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const manager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const admin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const people=()=>[...(state?.people||[])].filter(p=>p.active!==false&&p.report_only!==true)
    .sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  const departments=()=>[...(state?.departments||[])].filter(d=>d.active!==false)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const toast=msg=>{try{api?.toast?.(msg)}catch(_e){console.log(msg)}};

  function personName(id){
    const p=(state?.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||'User';
  }
  function positionName(id){
    return positions.find(x=>x.id===id)?.name||'Position';
  }
  function departmentName(id){
    return (state?.departments||[]).find(x=>x.id===id)?.name||'Department';
  }

  async function loadGroups(){
    if(!sb)return;
    const cur=await sb.rpc('current_safety_site_v21138');
    currentSiteId=cur.error?null:cur.data||null;

    const [g,m,p]=await Promise.all([
      sb.from('safety_groups_v21155').select('*').eq('active',true).order('group_type').order('name'),
      sb.from('safety_group_members_v21155').select('*').eq('active',true),
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name')
    ]);
    groups=(g.data||[]).filter(x=>!currentSiteId||x.site_id===currentSiteId);
    groupMembers=m.data||[];
    positions=p.data||[];

    resolved.clear();
    await Promise.all(groups.map(async g=>{
      const r=await sb.rpc('group_resolved_users_v21155',{p_group_id:g.id});
      resolved.set(g.id,r.error?[]:(r.data||[]));
    }));
  }

  function groupCount(id){return (resolved.get(id)||[]).length}
  function groupNames(id){return (resolved.get(id)||[]).map(x=>x.display_name||x.email).filter(Boolean)}
  function groupLabel(g){
    return g.group_type==='SYSTEM'&&g.system_key==='DEPARTMENT_MANAGERS'
      ? 'Department Managers'
      : g.name;
  }

  /* ---------------- Groups management view ---------------- */
  function ensureGroupsView(){
    let v=$('groupsV21155View');
    if(v)return v;
    v=document.createElement('section');
    v.id='groupsV21155View';
    v.className='view';
    v.innerHTML=`
      <div class="page-heading">
        <div>
          <h2>Groups</h2>
          <p class="muted">Create reusable audiences for training, information and future assignments.</p>
        </div>
        <button class="primary" type="button" data-v21155-new-group>New group</button>
      </div>
      <button class="secondary groups-back-v21155" type="button" data-v21155-groups-back>← Management</button>
      <div id="groupsV21155Content"></div>`;
    ($('appView')||document.querySelector('main')||document.body).appendChild(v);
    return v;
  }

  function memberSummary(g){
    if(g.group_type==='SYSTEM'){
      return 'Automatically includes everyone currently assigned as a Department Manager.';
    }
    const rows=groupMembers.filter(m=>m.group_id===g.id&&m.active!==false);
    const bits=[];
    const users=rows.filter(x=>x.member_type==='USER');
    const pos=rows.filter(x=>x.member_type==='POSITION');
    const deps=rows.filter(x=>x.member_type==='DEPARTMENT');
    if(users.length)bits.push(`${users.length} named ${users.length===1?'person':'people'}`);
    if(pos.length)bits.push(`${pos.length} job title${pos.length===1?'':'s'}`);
    if(deps.length)bits.push(`${deps.length} department${deps.length===1?'':'s'}`);
    return bits.join(' · ')||'No membership rules yet.';
  }

  function renderGroups(){
    const root=$('groupsV21155Content');if(!root)return;
    const system=groups.filter(g=>g.group_type==='SYSTEM');
    const custom=groups.filter(g=>g.group_type==='CUSTOM');

    root.innerHTML=`
      <div class="hint-box">
        <strong>Department Managers is automatic.</strong> When somebody is made or removed as a Department Manager,
        this group updates automatically. Any Training / Safety Awareness assigned to the group follows the change.
      </div>

      <div class="section-card">
        <h3>Automatic groups</h3>
        <div class="card-list">
          ${system.map(g=>groupCard(g)).join('')||'<div class="empty">No automatic groups.</div>'}
        </div>
      </div>

      <div class="section-card">
        <div class="row-between groups-head-v21155">
          <div><h3>Custom groups</h3><p class="muted">Build a group from job titles, named people and/or whole departments.</p></div>
          <button class="primary" type="button" data-v21155-new-group>New group</button>
        </div>
        <div class="card-list">
          ${custom.map(g=>groupCard(g)).join('')||'<div class="empty">No custom groups yet.</div>'}
        </div>
      </div>`;
  }

  function groupCard(g){
    const names=groupNames(g.id);
    const sample=names.slice(0,5).join(', ');
    const more=Math.max(0,names.length-5);
    return `<div class="item-card group-card-v21155">
      <div class="row-between group-row-v21155">
        <div>
          <div class="group-title-v21155">
            <strong>${esc(groupLabel(g))}</strong>
            ${g.group_type==='SYSTEM'?'<span class="badge complete">Automatic</span>':'<span class="badge">Custom</span>'}
            <span class="badge ${groupCount(g.id)?'complete':'neutral'}">${groupCount(g.id)} matched</span>
          </div>
          <p class="muted">${esc(g.description||memberSummary(g))}</p>
          <div class="meta">${sample?`<span>${esc(sample)}${more?` + ${more} more`:''}</span>`:'<span>No current members</span>'}</div>
          ${g.group_type==='CUSTOM'?`<div class="meta"><span>${esc(memberSummary(g))}</span></div>`:''}
        </div>
        <div class="actions">
          <button class="secondary" type="button" data-v21155-view-group="${esc(g.id)}">View members</button>
          ${g.group_type==='CUSTOM'?`<button class="secondary" type="button" data-v21155-edit-group="${esc(g.id)}">Edit</button>`:''}
        </div>
      </div>
    </div>`;
  }

  async function openGroups(){
    if(!manager())return toast('Groups are available to Managers and Admin.');
    ensureGroupsView();
    await loadGroups();
    renderGroups();
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    $('groupsV21155View')?.classList.add('active-view');
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_e){}
  }

  function openGroupMembers(id){
    const g=groups.find(x=>x.id===id);if(!g)return;
    const rows=resolved.get(id)||[];
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent=`${groupLabel(g)} — members`;
    body.innerHTML=`
      <div class="section-card">
        <p>${esc(g.description||memberSummary(g))}</p>
        <div class="meta"><span>${rows.length} active ${rows.length===1?'member':'members'}</span></div>
      </div>
      <div class="card-list">
        ${rows.map(p=>`<div class="item-card compact"><strong>${esc(p.display_name||p.email||'User')}</strong>${p.email?`<div class="meta"><span>${esc(p.email)}</span></div>`:''}</div>`).join('')||'<div class="empty">No current members.</div>'}
      </div>
      <div class="actions"><button class="primary" type="button" data-close-modal>Done</button></div>`;
    if(!modal.open)modal.showModal();
  }

  function choicesHtml(items,selected,cls,labelFn){
    return items.map(x=>`<label class="check-row">
      <input type="checkbox" class="${cls}" value="${esc(x.id)}" ${selected.has(x.id)?'checked':''}>
      <span>${esc(labelFn(x))}</span>
    </label>`).join('')||'<span class="muted">None available.</span>';
  }

  function editGroup(id=null){
    const g=id?groups.find(x=>x.id===id):null;
    if(g?.group_type==='SYSTEM')return openGroupMembers(id);
    const members=id?groupMembers.filter(x=>x.group_id===id&&x.active!==false):[];
    const users=new Set(members.filter(x=>x.member_type==='USER').map(x=>x.user_id));
    const pos=new Set(members.filter(x=>x.member_type==='POSITION').map(x=>x.position_id));
    const deps=new Set(members.filter(x=>x.member_type==='DEPARTMENT').map(x=>x.department_id));

    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent=g?'Edit group':'New group';
    body.innerHTML=`
      <div class="form-grid">
        <label class="full">Group name
          <input id="groupNameV21155" maxlength="80" value="${esc(g?.name||'')}" placeholder="e.g. Fire Wardens, Duty Managers">
        </label>
        <label class="full">Description <span class="muted">optional</span>
          <textarea id="groupDescriptionV21155" rows="2" maxlength="300">${esc(g?.description||'')}</textarea>
        </label>
      </div>

      <div class="hint-box">
        You can combine any of these rules. For example, a group can contain everyone with the
        <strong>Duty Manager</strong> title plus two specifically named people.
      </div>

      <div class="audience-grid group-editor-grid-v21155">
        <div>
          <h4>Job titles</h4>
          <div class="checkbox-list group-choice-list-v21155">
            ${choicesHtml(positions,pos,'group-position-v21155',x=>x.name)}
          </div>
        </div>
        <div>
          <h4>Specific people</h4>
          <div class="checkbox-list group-choice-list-v21155">
            ${choicesHtml(people(),users,'group-user-v21155',x=>x.display_name||x.email||'User')}
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4>Whole departments <span class="muted">optional</span></h4>
        <div class="checkbox-list group-choice-list-v21155">
          ${choicesHtml(departments(),deps,'group-department-v21155',x=>x.name)}
        </div>
      </div>

      <div id="groupPreviewV21155" class="hint-box">
        Save the group to calculate its live matched members.
      </div>

      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21155-save-group="${esc(id||'')}">Save group</button>
      </div>`;
    if(!modal.open)modal.showModal();
  }

  async function saveGroup(id,btn){
    const name=clean($('groupNameV21155')?.value);
    if(name.length<2)return toast('Enter a group name.');
    const userIds=[...document.querySelectorAll('.group-user-v21155:checked')].map(x=>x.value);
    const positionIds=[...document.querySelectorAll('.group-position-v21155:checked')].map(x=>x.value);
    const departmentIds=[...document.querySelectorAll('.group-department-v21155:checked')].map(x=>x.value);
    if(!userIds.length&&!positionIds.length&&!departmentIds.length)return toast('Choose at least one person, job title or department.');

    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    const r=await sb.rpc('save_safety_group_v21155',{
      p_group_id:id||null,
      p_name:name,
      p_description:clean($('groupDescriptionV21155')?.value)||null,
      p_user_ids:userIds,
      p_position_ids:positionIds,
      p_department_ids:departmentIds
    });
    if(r.error){btn.disabled=false;btn.textContent=old;return toast(r.error.message)}
    try{$('modal')?.close()}catch(_e){}
    await loadGroups();renderGroups();
    toast('Group saved. Any group-based training/information assignments have been recalculated.');
  }

  /* ---------------- Audience integration ---------------- */
  function selectedAudienceGroupIds(){
    return [...document.querySelectorAll('#modalBody .audience-group-choice-v21155:checked')].map(x=>x.value);
  }

  function audienceContext(){
    const modal=$('modalBody');if(!modal)return null;
    let b;
    if((b=modal.querySelector('[data-save-doc-audience]')))return {kind:'DOCUMENT',id:b.dataset.saveDocAudience};
    if((b=modal.querySelector('[data-save-training-audience]')))return {kind:'TRAINING',id:b.dataset.saveTrainingAudience};
    if((b=modal.querySelector('[data-confirm-training-approval]')))return {kind:'TRAINING',id:b.dataset.confirmTrainingApproval};
    if((b=modal.querySelector('[data-save-awareness-assignments]')))return {kind:'AWARENESS',id:b.dataset.saveAwarenessAssignments};
    if((b=modal.querySelector('[data-save-version-approval]'))){
      const v=(state?.versions||[]).find(x=>x.id===b.dataset.saveVersionApproval);
      return v?{kind:'DOCUMENT',id:v.document_id}:null;
    }
    if(modal.querySelector('[data-create-document]'))return {kind:'NEW_DOCUMENT',id:null};
    return null;
  }

  async function currentAudienceGroups(ctx){
    if(!ctx||ctx.kind==='NEW_DOCUMENT')return [];
    let table,key;
    if(ctx.kind==='DOCUMENT'){table='document_training_audiences';key='document_id'}
    if(ctx.kind==='TRAINING'){table='training_session_audiences';key='training_session_id'}
    if(ctx.kind==='AWARENESS'){table='awareness_item_audiences';key='awareness_item_id'}
    if(!table)return [];
    const r=await sb.from(table).select('group_id,target_type').eq(key,ctx.id).eq('target_type','GROUP');
    return r.error?[]:(r.data||[]).map(x=>x.group_id).filter(Boolean);
  }

  async function decorateAudienceSections(){
    if(!manager()||!groups.length)return;
    const modal=$('modalBody');if(!modal)return;
    const ctx=audienceContext();
    if(!ctx)return;

    const sections=[...modal.querySelectorAll('[id$="AudienceSection"]')];
    if(!sections.length)return;
    const selected=new Set(await currentAudienceGroups(ctx));

    for(const section of sections){
      if(section.dataset.groupsV21155==='1')continue;
      section.dataset.groupsV21155='1';

      const box=document.createElement('div');
      box.className='groups-audience-v21155';
      box.innerHTML=`
        <div class="groups-audience-head-v21155">
          <h5>Groups</h5>
          <button class="ghost small" type="button" data-v21155-manage-groups>Manage groups</button>
        </div>
        <p class="muted">Select a reusable group. Membership stays live when titles, names or Department Manager responsibilities change.</p>
        <div class="checkbox-list">
          ${groups.map(g=>`<label class="check-row">
            <input type="checkbox" class="audience-group-choice-v21155" value="${esc(g.id)}" ${selected.has(g.id)?'checked':''}>
            <span><strong>${esc(groupLabel(g))}</strong> <span class="muted">· ${groupCount(g.id)} current member${groupCount(g.id)===1?'':'s'}${g.group_type==='SYSTEM'?' · automatic':''}</span></span>
          </label>`).join('')||'<span class="muted">No groups available.</span>'}
        </div>`;
      const summary=section.querySelector('[id$="AudienceSummary"]');
      if(summary)summary.insertAdjacentElement('beforebegin',box);
      else section.appendChild(box);

      const everyone=section.querySelector('input[id$="AssignEveryone"]');
      const sync=()=>{
        const off=!!everyone?.checked;
        box.querySelectorAll('.audience-group-choice-v21155').forEach(x=>x.disabled=off);
      };
      section.addEventListener('change',sync);
      sync();
    }
  }

  function installRpcBridge(){
    if(!sb||sb.__groupsRpcV21155)return;
    sb.__groupsRpcV21155=true;
    originalRpc=sb.rpc.bind(sb);

    sb.rpc=function(name,args={},options){
      const groupIds=selectedAudienceGroupIds();

      if(name==='set_document_training_audience_v230'){
        return originalRpc('set_document_training_audience_v21155',{
          p_document_id:args.p_document_id,
          p_everyone:args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupIds,
          p_due_days:args.p_due_days
        },options);
      }

      if(name==='set_training_session_audience_v239'){
        return originalRpc('set_training_session_audience_v21155',{
          p_training_session_id:args.p_training_session_id,
          p_everyone:args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupIds,
          p_due_days:args.p_due_days
        },options);
      }

      if(name==='set_awareness_item_audience_v239'){
        return originalRpc('set_awareness_item_audience_v21155',{
          p_awareness_item_id:args.p_awareness_item_id,
          p_everyone:args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupIds
        },options);
      }

      if(name==='decide_document_version_with_training_schedule_ack_v281'){
        return originalRpc('decide_document_version_with_training_schedule_ack_v21155',{
          p_document_version_id:args.p_document_version_id,
          p_decision:args.p_decision,
          p_context:args.p_context,
          p_note:args.p_note,
          p_everyone:args.p_everyone,
          p_department_ids:args.p_department_ids||[],
          p_user_ids:args.p_user_ids||[],
          p_group_ids:groupIds,
          p_due_days:args.p_due_days,
          p_delivery_method:args.p_delivery_method,
          p_renewal_value:args.p_renewal_value,
          p_renewal_unit:args.p_renewal_unit
        },options);
      }

      return originalRpc(name,args,options);
    };

    // Existing core validation understands Everyone / Department / Person.
    // Treat a selected group as a valid audience too.
    if(typeof window.audienceSelectionValid==='function'&&!window.__audienceValidGroupsV21155){
      window.__audienceValidGroupsV21155=true;
      const base=window.audienceSelectionValid;
      window.audienceSelectionValid=function(a){
        return base(a)||selectedAudienceGroupIds().length>0;
      };
    }
  }

  /* ---------------- Shortcuts + help ---------------- */
  function addShortcuts(){
    if(!manager())return;
    const adminBox=$('adminShortcutsV21149')||$('adminShortcutsV21146');
    if(adminBox&&!adminBox.querySelector('[data-v21155-open-groups]')){
      const b=document.createElement('button');
      b.type='button';
      b.className='admin-shortcut-v21149';
      b.dataset.v21155OpenGroups='1';
      b.innerHTML='<strong>Groups</strong><small>Department Managers + custom groups for Training and information.</small>';
      adminBox.appendChild(b);
    }
  }

  function addHelp(){
    const grid=document.querySelector('#helpContent .role-help-grid');
    if(!grid||grid.querySelector('[data-help-groups-v21155]')||!manager())return;
    const card=document.createElement('article');
    card.className='role-help-action help-v21150-card';
    card.dataset.helpGroupsV21155='1';
    card.dataset.helpV21150Search='groups department managers custom titles people training audience information';
    card.innerHTML=`
      <div class="role-help-action-copy">
        <span class="role-help-group">Sites & access</span>
        <h3>Groups</h3>
        <p>Use the automatic Department Managers group or create custom groups from job titles, named people and departments. Groups can be selected in Training and Safety Awareness audiences.</p>
      </div>
      <button class="primary role-help-go" type="button" data-v21155-open-groups>Go there</button>`;
    grid.appendChild(card);
  }

  function backToManagement(){
    document.querySelector('#mainNav button[data-view="admin"]')?.click();
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      if(e.target.closest?.('[data-v21155-open-groups],[data-v21155-manage-groups]')){
        e.preventDefault();e.stopImmediatePropagation();openGroups();return;
      }
      if(e.target.closest?.('[data-v21155-groups-back]')){
        e.preventDefault();e.stopImmediatePropagation();backToManagement();return;
      }
      if(e.target.closest?.('[data-v21155-new-group]')){
        e.preventDefault();e.stopImmediatePropagation();editGroup();return;
      }
      const view=e.target.closest?.('[data-v21155-view-group]');
      if(view){e.preventDefault();e.stopImmediatePropagation();openGroupMembers(view.dataset.v21155ViewGroup);return}
      const edit=e.target.closest?.('[data-v21155-edit-group]');
      if(edit){e.preventDefault();e.stopImmediatePropagation();editGroup(edit.dataset.v21155EditGroup);return}
      const save=e.target.closest?.('[data-v21155-save-group]');
      if(save){e.preventDefault();e.stopImmediatePropagation();saveGroup(save.dataset.v21155SaveGroup||null,save);return}

      if(e.target.closest?.('#mainNav button[data-view="admin"]')){
        [100,300,700].forEach(ms=>setTimeout(addShortcuts,ms));
      }
      if(e.target.closest?.('#mainNav button[data-view="help"]')){
        [180,450,900].forEach(ms=>setTimeout(addHelp,ms));
      }

      // Audience modals are generated after the click, so decorate after finite delays.
      if(e.target.closest?.(
        '[data-assign-training],[data-show-awareness-assignments],[data-review-training],'+
        '[data-version-approval],[data-doc-audience],[data-new-document],[data-edit-document]'
      )){
        [120,350,700].forEach(ms=>setTimeout(decorateAudienceSections,ms));
      }
    },true);

    // Scoped modal observer only. It never observes body/#appView, avoiding the mobile flicker issue.
    const body=$('modalBody');
    if(body){
      const obs=new MutationObserver(()=>{
        if($('modal')?.open)setTimeout(decorateAudienceSections,0);
      });
      obs.observe(body,{childList:true,subtree:true});
    }

    window.addEventListener('pageshow',()=>{
      setTimeout(addShortcuts,180);
      setTimeout(addHelp,260);
    });
  }

  function installStyles(){
    if($('groupsStylesV21155'))return;
    const s=document.createElement('style');
    s.id='groupsStylesV21155';
    s.textContent=`
      .groups-back-v21155{margin:0 0 14px}
      .group-title-v21155{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .group-row-v21155{gap:12px;align-items:flex-start}
      .group-card-v21155 p{margin:7px 0}
      .group-choice-list-v21155{max-height:280px;overflow:auto}
      .groups-audience-v21155{margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#475569)}
      .groups-audience-head-v21155{display:flex;justify-content:space-between;gap:8px;align-items:center}
      .groups-audience-head-v21155 h5{margin:0}
      @media(max-width:700px){
        .group-row-v21155,.groups-head-v21155{display:block}
        .group-row-v21155>.actions,.groups-head-v21155>button{width:100%;margin-top:9px}
        .group-row-v21155>.actions button{flex:1}
        .group-editor-grid-v21155{grid-template-columns:1fr!important}
      }
    `;
    document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,100);return}
    state=api.state;sb=api.sb;
    if(!state.user)return;

    installStyles();
    ensureGroupsView();
    await loadGroups();
    installRpcBridge();
    installEvents();

    [120,350,900].forEach(ms=>setTimeout(()=>{
      addShortcuts();
      addHelp();
      decorateAudienceSections();
    },ms));

    window.SafetyGroupsV21155={open:openGroups,reload:async()=>{await loadGroups();renderGroups()}};
  }

  boot().catch(e=>console.warn('Safety groups v2.11.55',e));
})();
