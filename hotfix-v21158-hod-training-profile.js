/* Safety Tracker v2.11.58 CLEAN
   Profile permissions:
   - One Head of Department (HOD) per department, enforced in the database.
   - HOD is selected from the person's profile and automatically becomes that
     department's responsible Department Manager.
   - The HOD department is taken from the person's Main/Default position.
   - Multiple Supervisors are allowed; Supervisor remains an ordinary position/title.
   - "Can carry out instructor-led training" is shown clearly in Profile permissions.
*/
'use strict';
(function(){
  if(window.__SAFETY_PROFILE_PERMISSIONS_V21158)return;
  window.__SAFETY_PROFILE_PERMISSIONS_V21158=true;

  let api=null,state=null,sb=null;
  let links=[],caps=[],hods=[];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const admin=()=>String(state?.profile?.role||'').toLowerCase()==='admin' &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';
  const toast=msg=>{try{api?.toast?.(msg)}catch(_e){console.log(msg)}};

  function personName(id){
    const p=(state?.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||'User';
  }

  async function loadBadges(){
    if(!sb||!state?.user)return;
    const [l,c,h]=await Promise.all([
      sb.from('shared_safety_user_links_v21148').select('*'),
      sb.from('app_user_capabilities_v21137')
        .select('*')
        .eq('module_key','safety')
        .eq('capability_key','training_instructor')
        .eq('scope_type','APP')
        .eq('scope_id',''),
      sb.from('safety_responsibilities_v21069')
        .select('*')
        .eq('responsibility_type','DEPARTMENT_MANAGER')
        .eq('active',true)
    ]);
    links=l.error?[]:(l.data||[]);
    caps=c.error?[]:(c.data||[]);
    hods=h.error?[]:(h.data||[]);
  }

  function linkedSafetyId(sourceId){
    return links.find(x=>x.source_user_id===sourceId)?.safety_user_id||null;
  }
  function instructorOn(userId){
    return caps.some(x=>x.user_id===userId&&x.enabled===true);
  }
  function hodOn(userId){
    return hods.some(x=>x.user_id===userId);
  }

  function permissionBadges(userId){
    if(!userId)return '<span class="badge neutral">Safety access required</span>';
    return `
      <span class="badge ${hodOn(userId)?'complete':'neutral'}">${hodOn(userId)?'HOD':'Not HOD'}</span>
      <span class="badge ${instructorOn(userId)?'complete':'neutral'}">${instructorOn(userId)?'Training instructor':'Instructor OFF'}</span>`;
  }

  function decoratePeopleCards(){
    if(!admin())return;
    const root=$('peopleV21149Content');
    if(!root)return;

    root.querySelectorAll('[data-v21149-edit-shared]').forEach(btn=>{
      const sourceId=btn.dataset.v21149EditShared;
      const userId=linkedSafetyId(sourceId);
      const card=btn.closest('.item-card');
      if(!card)return;

      let wrap=card.querySelector('.profile-permissions-v21158');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.className='profile-permissions-v21158';
        const row=btn.closest('.people-card-row-v21149');
        row?.insertAdjacentElement('afterend',wrap);
      }
      wrap.innerHTML=`
        <div class="profile-permission-badges-v21158">${permissionBadges(userId)}</div>
        ${userId
          ? `<button class="secondary profile-permission-btn-v21158" type="button" data-v21158-profile-user="${esc(userId)}">Profile permissions</button>`
          : '<span class="muted">Give Safety access first, then set HOD / instructor permission.</span>'}`;
    });

    root.querySelectorAll('[data-v21149-edit-safety]').forEach(btn=>{
      const userId=btn.dataset.v21149EditSafety;
      const card=btn.closest('.item-card');
      if(!card)return;
      let wrap=card.querySelector('.profile-permissions-v21158');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.className='profile-permissions-v21158';
        const row=btn.closest('.people-card-row-v21149');
        row?.insertAdjacentElement('afterend',wrap);
      }
      wrap.innerHTML=`
        <div class="profile-permission-badges-v21158">${permissionBadges(userId)}</div>
        <button class="secondary profile-permission-btn-v21158" type="button" data-v21158-profile-user="${esc(userId)}">Profile permissions</button>`;
    });
  }

  async function profileState(userId){
    const r=await sb.rpc('user_profile_permissions_v21158',{p_user_id:userId});
    if(r.error)throw r.error;
    return Array.isArray(r.data)?r.data[0]:r.data;
  }

  async function openProfilePermissions(userId){
    if(!admin())return;
    let x;
    try{x=await profileState(userId)}catch(e){return toast(e.message)}
    if(!x)return toast('Profile not found.');

    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Profile permissions';

    const hasDepartment=!!x.primary_department_id;
    const replacing=x.current_department_hod_user_id &&
      x.current_department_hod_user_id!==userId;

    body.innerHTML=`
      <div class="section-card">
        <h3>${esc(x.display_name||personName(userId))}</h3>
        <div class="meta">
          <span>Main position: ${esc(x.primary_position_name||'Not set')}</span>
          <span>Main department: ${esc(x.primary_department_name||'Not set')}</span>
        </div>
      </div>

      <div class="section-card permission-highlight-v21158">
        <h4>Head of Department (HOD)</h4>
        <label class="check-row">
          <input id="profileIsHodV21158" type="checkbox" ${x.is_hod?'checked':''} ${hasDepartment?'':'disabled'}>
          Head of Department (HOD) for ${esc(x.primary_department_name||'Main/Default department')}
        </label>
        ${hasDepartment
          ? `<p class="muted"><strong>One HOD only:</strong> the app enforces one active HOD per department. Selecting this automatically makes this person the Department Manager / responsible owner for ${esc(x.primary_department_name)}.</p>`
          : '<div class="hint-box"><strong>Set a Main/Default position first.</strong> HOD is automatically tied to that position’s department.</div>'}
        ${replacing
          ? `<div class="danger-note"><strong>Current HOD:</strong> ${esc(x.current_department_hod_name||'Another person')}. Saving with HOD ticked will replace them as the single HOD for this department.</div>`
          : ''}
      </div>

      <div class="section-card permission-highlight-v21158">
        <h4>Instructor-led training</h4>
        <label class="check-row instructor-toggle-v21158">
          <input id="profileCanTrainV21158" type="checkbox" ${x.can_carry_out_training?'checked':''}>
          <strong>Can carry out instructor-led training</strong>
        </label>
        <p class="muted">
          Tick this for a Supervisor or other suitable person without making them a Safety Manager.
          They can deliver instructor-led training for people in their own Department(s).
          The HOD / Department Manager still owns completion responsibility unless manually overridden.
        </p>
      </div>

      <div class="hint-box">
        <strong>Supervisors:</strong> there can be multiple Supervisors in the same department.
        Supervisor is a normal position/title and does not make somebody HOD automatically.
        Tick <strong>Can carry out instructor-led training</strong> for any Supervisor who is authorised to train.
      </div>

      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21158-save-profile="${esc(userId)}">Save profile permissions</button>
      </div>`;

    if(!modal.open)modal.showModal();
  }

  async function saveProfilePermissions(userId,btn){
    const isHod=!!$('profileIsHodV21158')?.checked;
    const canTrain=!!$('profileCanTrainV21158')?.checked;

    let current;
    try{current=await profileState(userId)}catch(e){return toast(e.message)}
    if(
      isHod &&
      current?.current_department_hod_user_id &&
      current.current_department_hod_user_id!==userId
    ){
      const ok=confirm(
        `${current.primary_department_name} already has ${current.current_department_hod_name||'another person'} as HOD.\n\n`+
        `Continue and replace them with ${current.display_name}? There can only be one HOD per department.`
      );
      if(!ok)return;
    }

    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    const r=await sb.rpc('set_profile_operational_permissions_v21158',{
      p_user_id:userId,
      p_is_hod:isHod,
      p_can_carry_out_training:canTrain
    });
    if(r.error){btn.disabled=false;btn.textContent=old;return toast(r.error.message)}

    try{$('modal')?.close()}catch(_e){}
    await loadBadges();
    decoratePeopleCards();
    decorateHodAdminSection();
    try{await window.SafetyGroupsV21155?.reload?.()}catch(_e){}
    try{await window.SafetyInstructorResponsibilityV21156?.reload?.()}catch(_e){}
    toast('Profile permissions saved.');
  }

  async function decorateHodAdminSection(){
    if(!admin())return;
    const card=$('positionsResponsibilities69');
    if(!card)return;
    const heading=[...card.querySelectorAll('h4')].find(h=>
      /department responsible managers/i.test(h.textContent||'') ||
      /^heads of department/i.test(h.textContent||'')
    );
    const section=heading?.closest('.section-card');
    if(!section)return;

    const [deps,resps]=await Promise.all([
      sb.from('departments').select('id,name,active').eq('active',true).order('name'),
      sb.from('safety_responsibilities_v21069')
        .select('department_id,user_id')
        .eq('responsibility_type','DEPARTMENT_MANAGER')
        .eq('active',true)
    ]);
    if(deps.error||resps.error)return;

    section.innerHTML=`
      <h4>Heads of Department (HOD)</h4>
      <p class="muted">
        There can be <strong>one HOD per department</strong>. Set or change HOD from
        <strong>People & Access → Profile permissions</strong>. The person's Main/Default position chooses the department automatically.
        Multiple Supervisors are allowed.
      </p>
      <div class="card-list">
        ${(deps.data||[]).map(d=>{
          const r=(resps.data||[]).find(x=>x.department_id===d.id);
          return `<div class="item-card compact">
            <div class="row-between">
              <div><strong>${esc(d.name)}</strong><div class="muted">${r?`HOD: ${esc(personName(r.user_id))}`:'HOD not assigned'}</div></div>
              <span class="badge ${r?'complete':'due'}">${r?'1 HOD':'Needs HOD'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="actions">
        <button class="secondary" type="button" data-v21158-open-people>Open People & Access</button>
      </div>`;
  }

  function helpCard(){
    const grid=document.querySelector('#helpContent .role-help-grid');
    if(!grid||grid.querySelector('[data-help-profile-permissions-v21158]')||!admin())return;
    const el=document.createElement('article');
    el.className='role-help-action help-v21150-card';
    el.dataset.helpProfilePermissionsV21158='1';
    el.dataset.helpV21150Search='hod head department supervisor training instructor profile permissions';
    el.innerHTML=`
      <div class="role-help-action-copy">
        <span class="role-help-group">Sites & access</span>
        <h3>HOD & training instructor permissions</h3>
        <p>Each department can have one HOD, selected from the person's profile. Multiple Supervisors are allowed. Tick Can carry out instructor-led training for authorised Supervisors or other trainers.</p>
      </div>
      <button class="primary role-help-go" type="button" data-v21158-open-people>Go there</button>`;
    grid.appendChild(el);
  }

  function openPeople(){
    if(window.SafetyPeopleSitesV21149?.openPeople)window.SafetyPeopleSitesV21149.openPeople();
    else window.SafetyPeopleSitesV21146?.openPeople?.();
    [120,350,700].forEach(ms=>setTimeout(async()=>{
      await loadBadges();
      decoratePeopleCards();
    },ms));
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      const p=e.target.closest?.('[data-v21158-profile-user]');
      if(p){
        e.preventDefault();e.stopImmediatePropagation();
        openProfilePermissions(p.dataset.v21158ProfileUser);return;
      }
      const save=e.target.closest?.('[data-v21158-save-profile]');
      if(save){
        e.preventDefault();e.stopImmediatePropagation();
        saveProfilePermissions(save.dataset.v21158SaveProfile,save);return;
      }
      if(e.target.closest?.('[data-v21158-open-people]')){
        e.preventDefault();e.stopImmediatePropagation();openPeople();return;
      }

      if(e.target.closest?.(
        '[data-v21149-people],'+
        '#mainNav button[data-view="people"],'+
        '[data-v21149-refresh-users]'
      )){
        [150,400,900].forEach(ms=>setTimeout(async()=>{
          await loadBadges();
          decoratePeopleCards();
        },ms));
      }

      if(e.target.closest?.('#mainNav button[data-view="admin"]')){
        [220,550,1000].forEach(ms=>setTimeout(decorateHodAdminSection,ms));
      }

      if(e.target.closest?.('#mainNav button[data-view="help"]')){
        [200,500,1000].forEach(ms=>setTimeout(helpCard,ms));
      }
    },true);

    window.addEventListener('pageshow',()=>{
      [180,500,1200].forEach(ms=>setTimeout(async()=>{
        await loadBadges();
        decoratePeopleCards();
        decorateHodAdminSection();
        helpCard();
      },ms));
    });
  }

  function styles(){
    if($('profilePermissionsStylesV21158'))return;
    const s=document.createElement('style');
    s.id='profilePermissionsStylesV21158';
    s.textContent=`
      .profile-permissions-v21158{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--border,#334155)}
      .profile-permission-badges-v21158{display:flex;gap:6px;flex-wrap:wrap}
      .profile-permission-btn-v21158{min-height:42px}
      .permission-highlight-v21158{border-width:2px}
      .instructor-toggle-v21158{font-size:1.05rem}
      @media(max-width:700px){
        .profile-permissions-v21158{display:block}
        .profile-permission-btn-v21158{width:100%;margin-top:8px}
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
    await loadBadges();
    installEvents();
    [160,450,1000].forEach(ms=>setTimeout(()=>{
      decoratePeopleCards();
      decorateHodAdminSection();
      helpCard();
    },ms));
    window.SafetyProfilePermissionsV21158={
      open:openProfilePermissions,
      refresh:async()=>{await loadBadges();decoratePeopleCards();decorateHodAdminSection()}
    };
  }

  boot().catch(e=>console.warn('Profile permissions v2.11.58',e));
})();
/* Safety Tracker v2.11.64 CLEAN
   Document packs + configurable annual cycle + group-only TBT top-ups + Manager department mode.
   - Whole pack annual acknowledgement uses a Manager/Admin-selected month/day (default 1 Jan).
   - New starter grace remains configurable (60/90 days in UI).
   - Individual pack files keep their own review schedules and version history.
   - TBT top-ups are configured per Group only; no individual frequency setting.
   - Instructor-led creator/uploader self-completion uses an audited exception and requires trainer authority.
   - Admin can switch to Manager mode to see/control only their primary Department; Admin mode remains full-site.
*/
'use strict';
(function(){
  if(window.__SAFETY_PACK_TBT_MANAGER_V21164)return;
  window.__SAFETY_PACK_TBT_MANAGER_V21164=true;

  let api,state,sb;
  let packs=[],items=[],versions=[],audiences=[],myRequirements=[];
  let groups=[],groupMembers=[],positions=[],tbtSettings=[],tbtPool=[],tbtSchedule=[];
  let managerDocIds=new Set(),managerTrainingIds=new Set(),resolvedGroups=new Map();
  let primaryDepartment=null;
  let filterQueued=false;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const toast=m=>{try{api?.toast?.(m)}catch(_e){console.log(m)}};
  const today=()=>new Date().toISOString().slice(0,10);
  const actualRole=()=>String(state?.profile?.role||'').toLowerCase();
  const actualAdmin=()=>actualRole()==='admin'&&state?.profile?.report_only!==true;
  const actualManager=()=>['admin','manager'].includes(actualRole())&&state?.profile?.report_only!==true;
  const scopedManagerMode=()=>actualRole()==='manager'||(actualAdmin()&&state?.uiMode==='manager');
  const modeKey=()=>`safetyManagerModeV21164:${state?.user?.id||'unknown'}`;
  const deptName=()=>primaryDepartment?.department_name||'Department';
  const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
  const person=id=>{const p=(state?.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'User'};
  const departmentMembers=()=>new Set((state?.userDepartments||[]).filter(x=>x.department_id===primaryDepartment?.department_id).map(x=>x.user_id));
  const isManagerUi=()=>actualManager()&&state?.uiMode!=='user';

  function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
  function safeFileName(v){return String(v||'file').replace(/[^a-z0-9._-]+/gi,'-').replace(/-+/g,'-').slice(0,120)}
  async function sha256(file){if(!crypto?.subtle)return null;const b=await file.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function docxText(file){
    if(!/\.docx$/i.test(file.name))return '';
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());
      const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      let eocd=-1;
      for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
        if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}
      }
      if(eocd<0)return '';
      const entries=dv.getUint16(eocd+10,true),centralOffset=dv.getUint32(eocd+16,true);
      let pos=centralOffset,out='';
      for(let n=0;n<entries&&pos+46<=bytes.length;n++){
        if(dv.getUint32(pos,true)!==0x02014b50)break;
        const method=dv.getUint16(pos+10,true),compSize=dv.getUint32(pos+20,true);
        const nameLen=dv.getUint16(pos+28,true),extraLen=dv.getUint16(pos+30,true),commentLen=dv.getUint16(pos+32,true);
        const localOffset=dv.getUint32(pos+42,true);
        const name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nameLen));
        if(/^word\/(document|header\d*|footer\d*)\.xml$/i.test(name)&&localOffset+30<=bytes.length&&dv.getUint32(localOffset,true)===0x04034b50){
          const ln=dv.getUint16(localOffset+26,true),le=dv.getUint16(localOffset+28,true);
          const start=localOffset+30+ln+le,compressed=bytes.slice(start,start+compSize);
          let raw;
          if(method===0)raw=compressed;
          else if(method===8&&typeof DecompressionStream==='function'){
            const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            raw=new Uint8Array(await new Response(stream).arrayBuffer());
          }else{pos+=46+nameLen+extraLen+commentLen;continue}
          const xml=new TextDecoder('utf-8').decode(raw);
          const prepared=xml.replace(/<w:tab[^>]*\/>/gi,'\t').replace(/<w:br[^>]*\/>/gi,'\n').replace(/<\/w:p>/gi,'\n');
          const doc=new DOMParser().parseFromString(prepared,'application/xml');
          out+=' '+(doc.documentElement?.textContent||'');
        }
        pos+=46+nameLen+extraLen+commentLen;
      }
      return clean(out).slice(0,1000000);
    }catch(e){console.warn('DOCX text extraction',e);return ''}
  }
  async function storageUpload(packId,file,prefix=''){
    const path=`document-packs/${packId}/${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}-${safeFileName(prefix+file.name)}`;
    const r=await sb.storage.from('safety-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
    if(r.error)throw r.error;
    return path;
  }
  async function storageDownload(path,name){
    const r=await sb.storage.from('safety-files').download(path);
    if(r.error)throw r.error;
    downloadBlob(r.data,name||path.split('/').pop()||'document');
  }

  function currentPackVersion(itemId){
    return versions.filter(v=>v.item_id===itemId).sort((a,b)=>(b.version_no||0)-(a.version_no||0)||new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;
  }
  function packItems(packId){return items.filter(i=>i.pack_id===packId&&i.active!==false).sort((a,b)=>(b.is_main===true)-(a.is_main===true)||(a.sort_order||0)-(b.sort_order||0)||String(a.title||'').localeCompare(String(b.title||'')))}
  function packAudienceLabel(packId){
    const rows=audiences.filter(a=>a.pack_id===packId);
    if(!rows.length)return 'Not assigned';
    if(rows.some(x=>x.target_type==='EVERYONE'))return 'Everyone';
    const bits=[];
    const ds=rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>(state.departments||[]).find(d=>d.id===x.department_id)?.name).filter(Boolean);
    const gs=rows.filter(x=>x.target_type==='GROUP').map(x=>groups.find(g=>g.id===x.group_id)?.name).filter(Boolean);
    const ps=rows.filter(x=>x.target_type==='POSITION').map(x=>positions.find(p=>p.id===x.position_id)?.name).filter(Boolean);
    const us=rows.filter(x=>x.target_type==='USER').map(x=>person(x.user_id));
    if(ds.length)bits.push(ds.join(', '));if(gs.length)bits.push('Groups: '+gs.join(', '));if(ps.length)bits.push('Positions: '+ps.join(', '));if(us.length)bits.push('People: '+us.join(', '));
    return bits.join(' · ')||'Assigned';
  }
  function annualDateLabel(p){
    const y=new Date().getFullYear(),m=String(p.annual_ack_month||1).padStart(2,'0'),d=String(p.annual_ack_day||1).padStart(2,'0');
    return fmtDate(`${y}-${m}-${d}`);
  }
  function packRelevant(p){
    if(!scopedManagerMode())return true;
    if(!primaryDepartment)return false;
    const rows=audiences.filter(a=>a.pack_id===p.id);
    return p.created_by===state.user?.id||rows.some(a=>a.target_type==='EVERYONE'||(a.target_type==='DEPARTMENT'&&a.department_id===primaryDepartment.department_id));
  }

  async function loadPrimaryDepartment(){
    const local=(state.userDepartments||[]).filter(x=>x.user_id===state.user?.id).sort((a,b)=>(b.is_primary===true)-(a.is_primary===true)||new Date(a.assigned_at||0)-new Date(b.assigned_at||0))[0];
    if(local){
      const d=(state.departments||[]).find(x=>x.id===local.department_id);
      primaryDepartment={department_id:local.department_id,department_name:d?.name||'Department'};
      return;
    }
    const r=await sb.rpc('my_primary_department_v21164');
    if(!r.error&&r.data?.[0])primaryDepartment=r.data[0];
  }

  async function loadManagerScope(){
    managerDocIds=new Set();managerTrainingIds=new Set();
    if(!scopedManagerMode()||!primaryDepartment?.department_id)return;
    const [d,t]=await Promise.all([
      sb.rpc('manager_scope_documents_v21164',{p_department_id:primaryDepartment.department_id}),
      sb.rpc('manager_scope_training_v21164',{p_department_id:primaryDepartment.department_id})
    ]);
    if(!d.error)managerDocIds=new Set((d.data||[]).map(x=>x.document_id));
    if(!t.error)managerTrainingIds=new Set((t.data||[]).map(x=>x.training_session_id));
  }

  async function loadGroups(){
    if(!isManagerUi())return;
    const [g,m,p]=await Promise.all([
      sb.from('safety_groups_v21155').select('*').eq('active',true).order('name'),
      sb.from('safety_group_members_v21155').select('*').eq('active',true),
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name')
    ]);
    groups=g.error?[]:(g.data||[]);groupMembers=m.error?[]:(m.data||[]);positions=p.error?[]:(p.data||[]);
    resolvedGroups.clear();
    await Promise.all(groups.map(async x=>{const r=await sb.rpc('group_resolved_users_v21155',{p_group_id:x.id});resolvedGroups.set(x.id,r.error?[]:(r.data||[]))}));
  }
  function managerAllowedGroup(g){
    if(!scopedManagerMode())return true;
    const members=resolvedGroups.get(g.id)||[];
    const dept=departmentMembers();
    return members.length>0&&members.every(x=>dept.has(x.user_id));
  }

  async function loadAll(){
    if(!sb||!state?.user)return;
    if(actualManager())try{await sb.rpc('ensure_document_pack_requirements_v21164')}catch(_e){}
    try{await sb.rpc('sync_tbt_topups_v21163')}catch(_e){}
    await loadPrimaryDepartment();
    const [p,i,v,a,r]=await Promise.all([
      sb.from('document_packs_v21160').select('*').eq('active',true).order('title'),
      sb.from('document_pack_items_v21160').select('*').eq('active',true),
      sb.from('document_pack_item_versions_v21160').select('*'),
      sb.from('document_pack_audiences_v21160').select('*'),
      sb.rpc('my_document_pack_requirements_v21163')
    ]);
    packs=p.error?[]:(p.data||[]);items=i.error?[]:(i.data||[]);versions=v.error?[]:(v.data||[]);audiences=a.error?[]:(a.data||[]);myRequirements=r.error?[]:(r.data||[]);
    if(isManagerUi()){
      await loadGroups();
      const [s,pl,sc]=await Promise.all([
        sb.from('tbt_group_settings_v21163').select('*'),
        sb.from('tbt_group_pool_v21163').select('*').eq('active',true),
        sb.from('tbt_group_schedule_v21163').select('*').gte('schedule_year',new Date().getFullYear()).order('scheduled_date')
      ]);
      tbtSettings=s.error?[]:(s.data||[]);tbtPool=pl.error?[]:(pl.data||[]);tbtSchedule=sc.error?[]:(sc.data||[]);
    }
    await loadManagerScope();
  }

  /* ---------------- Manager/Admin department mode ---------------- */
  function installModeButton(){
    const chip=document.querySelector('.topbar .user-chip');if(!chip)return;
    let b=$('departmentManagerModeBtnV21164');
    if(!b){
      b=document.createElement('button');b.id='departmentManagerModeBtnV21164';b.type='button';b.className='ghost small top-ghost';
      const userMode=$('adminUserModeBtn');if(userMode)userMode.insertAdjacentElement('beforebegin',b);else chip.appendChild(b);
    }
    b.hidden=!actualAdmin();
    b.textContent=state.uiMode==='manager'?'Return to Admin':'Switch to Manager';
    b.title=state.uiMode==='manager'?'Return to full Admin view':`Show only ${deptName()} documents, training and controls`;
    const u=$('adminUserModeBtn');if(u&&state.uiMode==='manager')u.hidden=true;
  }
  async function toggleManagerMode(){
    if(!actualAdmin())return;
    if(state.uiMode==='manager'){
      state.uiMode='full';try{localStorage.removeItem(modeKey())}catch{}
    }else{
      await loadPrimaryDepartment();
      if(!primaryDepartment?.department_id)return toast('Set your Main/Default Department before using Manager mode.');
      state.uiMode='manager';try{localStorage.setItem(modeKey(),'manager')}catch{}
    }
    await loadManagerScope();applyModeUi();queueFilter();renderPackManager();renderTbtGroupPanel();
    toast(state.uiMode==='manager'?`Manager mode — ${deptName()} only.`:'Admin mode — all departments visible.');
  }
  function applyModeUi(){
    document.body.classList.toggle('department-manager-mode-v21164',scopedManagerMode());installModeButton();
    const role=$('currentUserRole');if(role&&scopedManagerMode())role.textContent=`Manager · ${deptName()}`;
    const adminNav=document.querySelector('#mainNav button[data-view="admin"]');if(adminNav&&scopedManagerMode())adminNav.hidden=true;
    const peopleNav=document.querySelector('#mainNav button[data-view="people"]');if(peopleNav)peopleNav.hidden=scopedManagerMode();
    const reportsNav=document.querySelector('#mainNav button[data-view="reports"]');if(reportsNav&&scopedManagerMode())reportsNav.hidden=true;
    let b=$('managerModeBannerV21164');
    if(scopedManagerMode()){
      if(!b){b=document.createElement('div');b.id='managerModeBannerV21164';b.className='hint-box manager-mode-banner-v21164';$('mainNav')?.insertAdjacentElement('afterend',b)}
      b.innerHTML=`<strong>Manager mode:</strong> ${esc(deptName())} only. Department-owned and site-wide documents/training are shown. Switch back to Admin for every department.`;
    }else b?.remove();
  }
  function queueFilter(){if(filterQueued)return;filterQueued=true;requestAnimationFrame(()=>{filterQueued=false;applyDepartmentFilters()})}
  function cardPersonAllowed(card){
    const allowed=departmentMembers();if(!allowed.size)return false;
    const names=[...allowed].map(id=>person(id).toLowerCase()),text=(card.textContent||'').toLowerCase();
    return names.some(n=>n&&text.includes(n));
  }
  function applyDepartmentFilters(){
    if(!scopedManagerMode())return;
    for(const rootId of ['documentsList','docFolderContentsV21119']){
      const root=$(rootId);if(!root)continue;
      root.querySelectorAll('.item-card').forEach(card=>{
        const id=card.querySelector('[data-doc-details]')?.dataset.docDetails||card.querySelector('[data-new-version]')?.dataset.newVersion||'';
        if(id)card.hidden=!managerDocIds.has(id);
      });
    }
    const tr=$('trainingList');if(tr)tr.querySelectorAll('.item-card').forEach(card=>{
      const b=card.querySelector('[data-view-training],[data-assign-training]');const id=b?.dataset.viewTraining||b?.dataset.assignTraining||'';if(id)card.hidden=!managerTrainingIds.has(id);
    });
    const cp=$('complianceList');if(cp)cp.querySelectorAll('.item-card').forEach(card=>card.hidden=!cardPersonAllowed(card));
    const ins=$('instructorList');if(ins)ins.querySelectorAll('.item-card').forEach(card=>card.hidden=!cardPersonAllowed(card));
    const stats=$('documentApprovalOverview');if(stats)stats.hidden=true;
    const ts=$('trainingStats');if(ts)ts.hidden=true;
  }

  /* ---------------- Document pack manager ---------------- */
  function ensurePackPanel(){
    if(!isManagerUi())return;const view=$('documentsView');if(!view)return;
    let box=$('documentPacksPanelV21164');if(!box){box=document.createElement('div');box.id='documentPacksPanelV21164';box.className='section-card';const list=$('documentsList');if(list)list.insertAdjacentElement('beforebegin',box);else view.appendChild(box)}
    renderPackManager();
  }
  function renderPackManager(){
    const box=$('documentPacksPanelV21164');if(!box||!isManagerUi())return;const rows=packs.filter(packRelevant);
    box.innerHTML=`
      <div class="row-between pack-head-v21164"><div><h3>Document Packs</h3><p class="muted">Controlled Word packs such as the Crisis Management Plan. Each file has its own review cycle; the whole pack has one annual acknowledgement date.</p></div><button class="primary" type="button" data-v21164-new-pack>New pack</button></div>
      <div class="card-list">${rows.map(p=>{const its=packItems(p.id),due=its.filter(i=>i.next_review_date&&i.next_review_date<today()).length;return `<div class="item-card pack-card-v21164"><div class="row-between"><div><strong>${esc(p.title)}</strong><div class="meta"><span>${its.length} file${its.length===1?'':'s'}</span><span>Annual: ${esc(annualDateLabel(p))}</span><span>Grace: ${esc(p.new_starter_grace_days||90)} days</span><span>Revision ${esc(p.approved_revision||p.revision||1)}</span>${due?`<span class="badge overdue">${due} review overdue</span>`:'<span class="badge complete">Review dates OK</span>'}</div><div class="muted">Assigned: ${esc(packAudienceLabel(p.id))}</div></div><span class="badge ${p.approved_revision>0?'complete':'due'}">${p.approved_revision>0?'Approved':'Draft'}</span></div><div class="row action-bar"><button class="primary" type="button" data-v21164-manage-pack="${esc(p.id)}">Manage pack</button><button class="secondary" type="button" data-v21164-pack-audience="${esc(p.id)}">Assign to</button><button class="ghost" type="button" data-v21164-pack-audit="${esc(p.id)}">Audit CSV</button></div></div>`}).join('')||'<div class="empty">No document packs in this view.</div>'}</div>`;
  }
  function openNewPack(){
    const y=new Date().getFullYear();
    openModal('New document pack',`<div class="form-grid"><label class="full">Pack title<input id="packTitleV21164" placeholder="e.g. Crisis Management Plan"></label><label class="full">Description<textarea id="packDescriptionV21164"></textarea></label><label>Annual whole-pack sign-off date<input id="packAnnualDateV21164" type="date" value="${y}-01-01"></label><label>Recent starter grace<select id="packGraceV21164"><option value="60">60 days</option><option value="90" selected>90 days</option></select></label><label>Default file review<select id="packDefaultReviewV21164"><option value="3">3 months</option><option value="6">6 months</option><option value="12" selected>12 months</option><option value="24">24 months</option></select></label></div><div class="hint-box"><strong>Annual date is editable.</strong> January is only the default. Individual file reviews never reset this annual pack cycle.</div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-create-pack>Create pack</button></div>`);
  }
  async function createPack(btn){
    const title=clean($('packTitleV21164')?.value),description=clean($('packDescriptionV21164')?.value);if(!title)return toast('Enter a pack title.');
    const date=$('packAnnualDateV21164')?.value||new Date().getFullYear()+'-01-01',d=new Date(date+'T00:00:00'),grace=Number($('packGraceV21164')?.value||90),review=Number($('packDefaultReviewV21164')?.value||12);
    btn.disabled=true;const old=btn.textContent;btn.textContent='Creating…';
    try{
      const r=await sb.rpc('create_document_pack_v21163',{p_title:title,p_description:description||null,p_grace_days:grace,p_default_review_months:review});if(r.error)throw r.error;const id=r.data;
      const s=await sb.rpc('set_document_pack_annual_cycle_v21164',{p_pack_id:id,p_month:d.getMonth()+1,p_day:d.getDate(),p_grace_days:grace});if(s.error)throw s.error;
      if(scopedManagerMode()&&primaryDepartment?.department_id){const a=await sb.from('document_pack_audiences_v21160').insert({pack_id:id,target_type:'DEPARTMENT',department_id:primaryDepartment.department_id,due_days:14,created_by:state.user.id});if(a.error)throw a.error}
      closeModal();await loadAll();ensurePackPanel();openManagePack(id);
    }catch(e){toast(e.message||'Could not create pack.');btn.disabled=false;btn.textContent=old}
  }
  async function openManagePack(packId){
    await loadAll();const p=packs.find(x=>x.id===packId);if(!p)return toast('Pack not found.');if(scopedManagerMode()&&!packRelevant(p))return toast('This pack is outside your Department Manager scope.');
    const y=new Date().getFullYear(),date=`${y}-${String(p.annual_ack_month||1).padStart(2,'0')}-${String(p.annual_ack_day||1).padStart(2,'0')}`;
    openModal('Manage document pack',`<div class="section-card"><div class="row-between"><div><h3>${esc(p.title)}</h3><p class="muted">${esc(p.description||'Controlled document pack')}</p></div><span class="badge ${p.approved_revision>0?'complete':'due'}">${p.approved_revision>0?'Approved revision '+p.approved_revision:'Draft'}</span></div><div class="form-grid"><label>Annual whole-pack date<input id="packEditAnnualDateV21164" type="date" value="${esc(date)}"></label><label>Recent starter grace<select id="packEditGraceV21164"><option value="60" ${Number(p.new_starter_grace_days)===60?'selected':''}>60 days</option><option value="90" ${Number(p.new_starter_grace_days)!==60?'selected':''}>90 days</option></select></label></div><div class="actions"><button class="secondary" type="button" data-v21164-save-pack-cycle="${esc(packId)}">Save annual cycle</button><button class="secondary" type="button" data-v21164-pack-audience="${esc(packId)}">Assign to</button>${p.approved_revision>0?'':`<button class="primary" type="button" data-v21164-approve-pack="${esc(packId)}">Approve current pack</button>`}</div></div><div class="section-card"><h4>Bulk upload Word files</h4><p class="muted">Upload the whole folder selection in one go. DOCX text is indexed for pack search; the original Word file stays downloadable/editable.</p><div class="form-grid"><label class="full">Word files<input id="packBulkFilesV21164" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple></label><label>Review frequency<select id="packBulkReviewV21164"><option value="3">3 months</option><option value="6">6 months</option><option value="12" selected>12 months</option><option value="24">24 months</option></select></label><label class="check-row"><input id="packFirstMainV21164" type="checkbox" checked> First selected file is the main/index file</label></div><div id="packUploadProgressV21164" class="message" hidden></div><div class="actions"><button class="primary" type="button" data-v21164-bulk-upload="${esc(packId)}">Upload selected files</button></div></div><div class="section-card"><div class="row-between"><div><h4>Pack files</h4><p class="muted">Each file has independent review frequency/version history. Updating one file does not reset the whole pack annual date.</p></div><input id="packSearchV21164" placeholder="Search pack text or file title"></div><div id="packFilesListV21164" class="card-list"></div></div>`);
    renderPackFileList(packId);$('packSearchV21164')?.addEventListener('input',()=>renderPackFileList(packId));
  }
  function renderPackFileList(packId){
    const root=$('packFilesListV21164');if(!root)return;const q=clean($('packSearchV21164')?.value).toLowerCase();
    const rows=packItems(packId).filter(i=>{const v=currentPackVersion(i.id);return !q||`${i.title||''} ${v?.file_name||''} ${v?.search_text||''}`.toLowerCase().includes(q)});
    root.innerHTML=rows.map(i=>{const v=currentPackVersion(i.id),over=i.next_review_date&&i.next_review_date<today();return `<div class="item-card compact ${over?'traffic-red':''}"><div class="row-between"><div><strong>${esc(i.title)}</strong>${i.is_main?'<span class="badge complete">Main/index</span>':''}<div class="meta"><span>v${esc(v?.version_no||1)}</span><span>Review every ${esc(i.review_frequency_value)} ${esc(String(i.review_frequency_unit||'MONTHS').toLowerCase())}</span><span>Next ${fmtDate(i.next_review_date)}</span>${over?'<span class="badge overdue">Overdue</span>':''}</div><div class="muted">${v?.search_text?'Searchable DOCX text indexed':'File retained; text index unavailable'}</div></div></div><div class="row action-bar"><button class="primary" type="button" data-v21164-download-pack-version="${esc(v?.id||'')}">Download Word</button><button class="secondary" type="button" data-v21164-replace-pack-file="${esc(i.id)}">Upload new version</button><button class="ghost" type="button" data-v21164-pack-review-settings="${esc(i.id)}">Review schedule</button><button class="ghost" type="button" data-v21164-pack-reviewed="${esc(i.id)}">Reviewed — no change</button></div></div>`}).join('')||'<div class="empty">No matching pack files.</div>';
  }
  async function bulkUpload(packId,btn){
    const fs=[...($('packBulkFilesV21164')?.files||[])];if(!fs.length)return toast('Select Word files first.');const review=Number($('packBulkReviewV21164')?.value||12),firstMain=!!$('packFirstMainV21164')?.checked,progress=$('packUploadProgressV21164');if(progress){progress.hidden=false;progress.className='message'}
    btn.disabled=true;const old=btn.textContent;let ok=0;const failed=[];
    for(let n=0;n<fs.length;n++){
      const f=fs[n];if(progress)progress.textContent=`Uploading ${n+1} of ${fs.length}: ${f.name}`;
      try{const text=await docxText(f),hash=await sha256(f),path=await storageUpload(packId,f);const r=await sb.rpc('register_document_pack_item_v21163',{p_pack_id:packId,p_title:f.name.replace(/\.(docx?|DOCX?)$/,''),p_relative_path:null,p_is_main:firstMain&&n===0,p_review_value:review,p_review_unit:'MONTHS',p_storage_path:path,p_file_name:f.name,p_mime_type:f.type||null,p_file_extension:(f.name.split('.').pop()||'').toLowerCase(),p_file_size_bytes:f.size,p_search_text:text||null,p_content_sha256:hash});if(r.error)throw r.error;ok++}catch(e){failed.push(`${f.name}: ${e.message||e}`)}
      await new Promise(res=>setTimeout(res,30));
    }
    btn.disabled=false;btn.textContent=old;await loadAll();renderPackFileList(packId);renderPackManager();if(progress){progress.className=failed.length?'danger-note':'success-note';progress.textContent=failed.length?`${ok} uploaded; ${failed.length} failed. ${failed.slice(0,3).join(' | ')}`:`${ok} files uploaded successfully.`}
  }
  async function savePackCycle(packId,btn){
    const date=$('packEditAnnualDateV21164')?.value,grace=Number($('packEditGraceV21164')?.value||90);if(!date)return toast('Choose an annual date.');const d=new Date(date+'T00:00:00');btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';const r=await sb.rpc('set_document_pack_annual_cycle_v21164',{p_pack_id:packId,p_month:d.getMonth()+1,p_day:d.getDate(),p_grace_days:grace});btn.disabled=false;btn.textContent=old;if(r.error)return toast(r.error.message);await loadAll();renderPackManager();toast('Annual pack sign-off date updated. Individual file review dates were not changed.');
  }
  async function approvePack(packId,btn){btn.disabled=true;const old=btn.textContent;btn.textContent='Approving…';const r=await sb.rpc('finalize_document_pack_v21163',{p_pack_id:packId,p_approval_note:'Approved through Safety Tracker'});btn.disabled=false;btn.textContent=old;if(r.error)return toast(r.error.message);await loadAll();closeModal();ensurePackPanel();toast('Pack approved. Initial/new-starter acknowledgement is active.')}
  async function openPackAudience(packId){
    await loadAll();const p=packs.find(x=>x.id===packId);if(!p)return;const existing=audiences.filter(a=>a.pack_id===packId),everyone=existing.some(x=>x.target_type==='EVERYONE'),due=existing[0]?.due_days||14;
    const deps=(state.departments||[]).filter(d=>d.active!==false&&(scopedManagerMode()?d.id===primaryDepartment?.department_id:true)),people=(state.people||[]).filter(x=>x.active!==false&&x.report_only!==true&&(!scopedManagerMode()||departmentMembers().has(x.id))),allowedGroups=groups.filter(managerAllowedGroup);
    openModal('Assign document pack',`<p><strong>${esc(p.title)}</strong></p><div class="form-grid"><label>Due within<input id="packAudienceDueV21164" type="number" min="1" max="365" value="${esc(due)}"> days</label></div>${scopedManagerMode()?`<div class="hint-box"><strong>Manager scope:</strong> assignment is limited to ${esc(deptName())}.</div>`:''}<label class="check-row"><input id="packAudienceEveryoneV21164" type="checkbox" ${everyone?'checked':''} ${scopedManagerMode()?'disabled':''}> Everyone / whole site</label><details open><summary>Departments</summary><div class="checkbox-list">${deps.map(d=>`<label class="check-row"><input class="pack-aud-dept-v21164" type="checkbox" value="${esc(d.id)}" ${existing.some(x=>x.target_type==='DEPARTMENT'&&x.department_id===d.id)?'checked':''}>${esc(d.name)}</label>`).join('')}</div></details>${scopedManagerMode()?'':`<details><summary>Positions</summary><div class="checkbox-list">${positions.map(x=>`<label class="check-row"><input class="pack-aud-pos-v21164" type="checkbox" value="${esc(x.id)}" ${existing.some(a=>a.target_type==='POSITION'&&a.position_id===x.id)?'checked':''}>${esc(x.name)}</label>`).join('')}</div></details>`}<details><summary>Groups</summary><div class="checkbox-list">${allowedGroups.map(g=>`<label class="check-row"><input class="pack-aud-group-v21164" type="checkbox" value="${esc(g.id)}" ${existing.some(a=>a.target_type==='GROUP'&&a.group_id===g.id)?'checked':''}>${esc(g.name)}</label>`).join('')||'No eligible groups.'}</div></details><details><summary>Specific people</summary><div class="checkbox-list">${people.map(x=>`<label class="check-row"><input class="pack-aud-user-v21164" type="checkbox" value="${esc(x.id)}" ${existing.some(a=>a.target_type==='USER'&&a.user_id===x.id)?'checked':''}>${esc(x.display_name||x.email)}</label>`).join('')}</div></details><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-save-pack-audience="${esc(packId)}">Save assignment</button></div>`);
  }
  async function savePackAudience(packId,btn){
    const due=Math.max(1,Math.min(365,Number($('packAudienceDueV21164')?.value||14))),rows=[];
    if(!scopedManagerMode()&&$('packAudienceEveryoneV21164')?.checked)rows.push({pack_id:packId,target_type:'EVERYONE',due_days:due,created_by:state.user.id});else{document.querySelectorAll('.pack-aud-dept-v21164:checked').forEach(x=>rows.push({pack_id:packId,target_type:'DEPARTMENT',department_id:x.value,due_days:due,created_by:state.user.id}));document.querySelectorAll('.pack-aud-pos-v21164:checked').forEach(x=>rows.push({pack_id:packId,target_type:'POSITION',position_id:x.value,due_days:due,created_by:state.user.id}));document.querySelectorAll('.pack-aud-group-v21164:checked').forEach(x=>rows.push({pack_id:packId,target_type:'GROUP',group_id:x.value,due_days:due,created_by:state.user.id}));document.querySelectorAll('.pack-aud-user-v21164:checked').forEach(x=>rows.push({pack_id:packId,target_type:'USER',user_id:x.value,due_days:due,created_by:state.user.id}))}
    if(!rows.length)return toast('Choose at least one Department, Group, Position or person.');btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';const del=await sb.from('document_pack_audiences_v21160').delete().eq('pack_id',packId);if(del.error){btn.disabled=false;btn.textContent=old;return toast(del.error.message)}const ins=await sb.from('document_pack_audiences_v21160').insert(rows);btn.disabled=false;btn.textContent=old;if(ins.error)return toast(ins.error.message);await loadAll();closeModal();renderPackManager();toast('Pack assignment updated.');
  }
  async function openReplacePackFile(itemId){
    const i=items.find(x=>x.id===itemId);if(!i)return;openModal('Upload new file version',`<p><strong>${esc(i.title)}</strong></p><div class="form-grid"><label class="full">Replacement Word file<input id="packReplacementFileV21164" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label><label>Change type<select id="packChangeClassV21164"><option value="ADMIN_MINOR">Minor/admin change — no new acknowledgement</option><option value="MATERIAL_FILE">Material change — acknowledge this file only</option><option value="MAJOR_PACK">Major pack-wide change — whole pack acknowledgement</option></select></label><label class="full">Reason<textarea id="packChangeReasonV21164" placeholder="What changed and why?"></textarea></label><label>Incident/reference<input id="packIncidentRefV21164" placeholder="Optional"></label></div><div class="hint-box">A material update affects this file only. It does not reset the normal annual whole-pack cycle. Use Major pack-wide change only when the whole pack genuinely needs re-acknowledgement.</div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-save-replacement="${esc(itemId)}">Upload version</button></div>`);
  }
  async function saveReplacement(itemId,btn){
    const f=$('packReplacementFileV21164')?.files?.[0];if(!f)return toast('Choose the replacement Word file.');const i=items.find(x=>x.id===itemId);if(!i)return;const cls=$('packChangeClassV21164')?.value||'ADMIN_MINOR',reason=clean($('packChangeReasonV21164')?.value),incident=clean($('packIncidentRefV21164')?.value);if(cls!=='ADMIN_MINOR'&&!reason)return toast('Enter the reason for the content change.');btn.disabled=true;const old=btn.textContent;btn.textContent='Uploading…';
    try{const text=await docxText(f),hash=await sha256(f),path=await storageUpload(i.pack_id,f,'v-');const r=await sb.rpc('replace_document_pack_item_v21163',{p_item_id:itemId,p_storage_path:path,p_file_name:f.name,p_mime_type:f.type||null,p_file_extension:(f.name.split('.').pop()||'').toLowerCase(),p_file_size_bytes:f.size,p_search_text:text||null,p_content_sha256:hash,p_change_classification:cls,p_change_reason:reason||null,p_incident_reference:incident||null});if(r.error)throw r.error;await loadAll();closeModal();renderPackManager();toast('New file version recorded. Pack annual cycle remains unchanged unless Major pack-wide change was selected.')}catch(e){toast(e.message||'Version upload failed.');btn.disabled=false;btn.textContent=old}
  }
  function openReviewSchedule(itemId){const i=items.find(x=>x.id===itemId);if(!i)return;openModal('File review schedule',`<p><strong>${esc(i.title)}</strong></p><div class="form-grid"><label>Every<input id="packReviewValueV21164" type="number" min="1" value="${esc(i.review_frequency_value||12)}"></label><label>Unit<select id="packReviewUnitV21164"><option value="MONTHS" ${i.review_frequency_unit==='MONTHS'?'selected':''}>Months</option><option value="YEARS" ${i.review_frequency_unit==='YEARS'?'selected':''}>Years</option><option value="DAYS" ${i.review_frequency_unit==='DAYS'?'selected':''}>Days</option></select></label><label>Next review date<input id="packNextReviewV21164" type="date" value="${esc(i.next_review_date||'')}"></label></div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-save-review-schedule="${esc(itemId)}">Save schedule</button></div>`)}
  async function saveReviewSchedule(itemId,btn){const value=Number($('packReviewValueV21164')?.value||12),unit=$('packReviewUnitV21164')?.value||'MONTHS',next=$('packNextReviewV21164')?.value||null;btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';const r=await sb.rpc('set_document_pack_item_review_v21164',{p_item_id:itemId,p_value:value,p_unit:unit,p_next_review_date:next});btn.disabled=false;btn.textContent=old;if(r.error)return toast(r.error.message);await loadAll();closeModal();renderPackManager();toast('File review schedule updated.')}
  async function reviewedNoChange(itemId){const note=prompt('Optional review note:','Reviewed — no content change')??null;if(note===null)return;const r=await sb.rpc('review_document_pack_item_no_change_v21163',{p_item_id:itemId,p_note:clean(note)||null});if(r.error)return toast(r.error.message);await loadAll();renderPackManager();toast('Review recorded. No acknowledgement was triggered.')}
  async function downloadPackVersion(versionId){const v=versions.find(x=>x.id===versionId);if(!v)return toast('File version not found.');try{await storageDownload(v.storage_path,v.file_name)}catch(e){toast(e.message||'Download failed.')}}
  async function downloadPackAudit(packId){
    const p=packs.find(x=>x.id===packId);if(!p)return;const [a,s]=await Promise.all([sb.rpc('document_pack_audit_report_v21162',{p_pack_id:packId}),sb.rpc('document_pack_snapshot_report_v21163',{p_pack_id:packId})]);if(a.error)return toast(a.error.message);
    const head=['row_type','pack_title','person_name','person_email','department_name','file_title','file_name','file_version','pack_revision','event_type','event_date','due_date','status','change_classification','acknowledgement_requirement','change_reason','incident_reference','detail'],lines=[head.join(',')];for(const x of a.data||[])lines.push(head.map(k=>csvEscape(x[k])).join(','));for(const x of s.error?[]:(s.data||[]))lines.push(['ACK_SNAPSHOT',p.title,x.person_name,x.person_email,'',x.item_title,x.file_name,x.version_no,x.pack_revision,x.requirement_type+'_'+x.trigger_type,x.acknowledged_at,'','SNAPSHOT','','','','',x.content_sha256||''].map(csvEscape).join(','));downloadBlob(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}),`${safeFileName(p.title)}-audit-${today()}.csv`);toast('Pack audit CSV downloaded.');
  }

  /* ---------------- User pack acknowledgements ---------------- */
  function ensureMyPackPanel(){const view=$('hsTrainingView');if(!view)return;let box=$('myPackRequirementsV21164');if(!box){box=document.createElement('div');box.id='myPackRequirementsV21164';box.className='section-card';const tiles=$('hsTrainingTiles');if(tiles)tiles.insertAdjacentElement('beforebegin',box);else view.prepend(box)}renderMyPackRequirements()}
  function renderMyPackRequirements(){const box=$('myPackRequirementsV21164');if(!box)return;const rows=myRequirements.filter(x=>!x.acknowledged_at);box.hidden=!rows.length;if(!rows.length){box.innerHTML='';return}box.innerHTML=`<div class="row-between"><div><h3>Document pack acknowledgements</h3><p class="muted">Whole-pack annual sign-offs and individual material file updates appear here.</p></div><span class="badge due">${rows.length} due</span></div><div class="card-list">${rows.map(r=>`<div class="item-card ${r.status==='OVERDUE'?'traffic-red':'traffic-amber'}"><div class="row-between"><div><strong>${esc(r.pack_title)}</strong><div>${r.requirement_type==='FILE'?esc(r.item_title||'Updated file'):'Whole pack'}</div><div class="meta"><span>${esc(r.trigger_type.replaceAll('_',' '))}</span><span>Due ${fmtDate(r.due_date)}</span></div></div><span class="badge ${r.status==='OVERDUE'?'overdue':'due'}">${esc(r.status)}</span></div><div class="row action-bar"><button class="primary" type="button" data-v21164-open-requirement="${esc(r.requirement_id)}">Open & acknowledge</button></div></div>`).join('')}</div>`}
  async function openRequirement(reqId){
    const r=myRequirements.find(x=>x.requirement_id===reqId);if(!r)return;const p=packs.find(x=>x.id===r.pack_id);if(!p)return toast('Pack not available.');const list=r.requirement_type==='FILE'?packItems(p.id).filter(i=>i.id===r.item_id):packItems(p.id);const files=list.map(i=>{const v=r.requirement_type==='FILE'&&r.item_version_id?versions.find(x=>x.id===r.item_version_id):currentPackVersion(i.id);return {i,v}}).filter(x=>x.v);
    openModal(r.requirement_type==='FILE'?'Updated pack file':'Document pack acknowledgement',`<div class="section-card"><h3>${esc(p.title)}</h3><p class="muted">${r.requirement_type==='FILE'?'Read the changed file below.':'Open the files you need and confirm the current approved pack.'}</p></div><div class="card-list">${files.map(({i,v})=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(i.title)}</strong><div class="meta"><span>v${esc(v.version_no)}</span>${i.is_main?'<span class="badge complete">Main/index</span>':''}</div></div><button class="secondary" type="button" data-v21164-download-pack-version="${esc(v.id)}">Open / download Word</button></div></div>`).join('')}</div><label class="check-row"><input id="packAckConfirmV21164" type="checkbox"> I confirm I have read and understood the assigned controlled content.</label><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-ack-requirement="${esc(reqId)}">Acknowledge</button></div>`);
  }
  async function acknowledgeRequirement(reqId,btn){if(!$('packAckConfirmV21164')?.checked)return toast('Tick the acknowledgement first.');btn.disabled=true;const old=btn.textContent;btn.textContent='Recording…';const r=await sb.rpc('acknowledge_document_pack_requirement_v21163',{p_requirement_id:reqId,p_text:'I have read and understood the assigned controlled content.'});btn.disabled=false;btn.textContent=old;if(r.error)return toast(r.error.message);await loadAll();closeModal();renderMyPackRequirements();toast('Acknowledgement recorded with the exact pack/file version snapshot.')}

  /* ---------------- Group-only TBT top-ups ---------------- */
  function ensureTbtGroupPanel(){if(!isManagerUi())return;const view=$('instructorView');if(!view)return;let box=$('tbtGroupTopupsV21164');if(!box){box=document.createElement('div');box.id='tbtGroupTopupsV21164';box.className='section-card';const stats=$('instructorStats');if(stats)stats.insertAdjacentElement('beforebegin',box);else view.prepend(box)}renderTbtGroupPanel()}
  function renderTbtGroupPanel(){
    const box=$('tbtGroupTopupsV21164');if(!box||!isManagerUi())return;const gs=groups.filter(managerAllowedGroup);
    box.innerHTML=`<div class="row-between"><div><h3>Toolbox Talk top-ups — Group settings</h3><p class="muted">TBTs are additional reminder training. Frequency is set for a Group only — never per individual — and dates/topics are spread unpredictably through the year.</p></div></div><div class="card-list">${gs.map(g=>{const s=tbtSettings.find(x=>x.group_id===g.id),freq=s?.frequency_per_year||0,sch=tbtSchedule.filter(x=>x.group_id===g.id&&x.schedule_year===new Date().getFullYear()&&x.status!=='CANCELLED');return `<div class="item-card compact"><div class="row-between"><div><strong>${esc(g.name)}</strong><div class="meta"><span>${freq?freq+' top-up'+(freq===1?'':'s')+' / year':'Top-ups off'}</span><span>${sch.length} scheduled this year</span></div></div><button class="secondary" type="button" data-v21164-tbt-group="${esc(g.id)}">Settings</button></div></div>`}).join('')||'<div class="empty">No eligible groups in this Manager scope.</div>'}</div>`;
  }
  function approvedTbtPool(){return (state.training||[]).filter(t=>String(t.session_type||'').toUpperCase()==='TOOLBOX_TALK'&&t.status==='ACTIVE'&&['APPROVED','LEGACY'].includes(String(t.approval_status||''))&&String(t.source_kind||'').toUpperCase()!=='TBT_TOPUP'&&(!scopedManagerMode()||managerTrainingIds.has(t.id)))}
  async function openTbtGroup(groupId){
    const g=groups.find(x=>x.id===groupId);if(!g||!managerAllowedGroup(g))return toast('That Group is outside your Manager scope.');const setting=tbtSettings.find(x=>x.group_id===groupId),freq=setting?.frequency_per_year||0,pool=new Set(tbtPool.filter(x=>x.group_id===groupId).map(x=>x.training_session_id)),talks=approvedTbtPool(),schedule=tbtSchedule.filter(x=>x.group_id===groupId&&x.schedule_year===new Date().getFullYear()&&x.status!=='CANCELLED');
    openModal('TBT Group top-ups',`<div class="section-card"><h3>${esc(g.name)}</h3><p class="muted">This setting applies to the Group as a whole. Members receive the same selected top-up TBT for each scheduled slot.</p></div><div class="form-grid"><label>Top-ups per year<input id="tbtGroupFreqV21164" type="number" min="0" max="12" value="${esc(freq)}"></label></div><div class="section-card"><h4>Approved TBT pool</h4><p class="muted">The scheduler rotates through these approved Toolbox Talks and avoids individual frequency settings.</p><div class="checkbox-list tbt-pool-v21164">${talks.map(t=>`<label class="check-row"><input class="tbt-pool-choice-v21164" type="checkbox" value="${esc(t.id)}" ${pool.has(t.id)?'checked':''}>${esc((t.reference?t.reference+' - ':'')+t.name)}</label>`).join('')||'<div class="empty">No approved Toolbox Talks are available in this scope yet.</div>'}</div></div><div class="section-card"><h4>This year's schedule</h4><div class="card-list">${schedule.map(s=>{const t=(state.training||[]).find(x=>x.id===s.source_tbt_training_id);return `<div class="item-card compact"><strong>${fmtDate(s.scheduled_date)}</strong> · ${esc(t?.reference||t?.name||'TBT')} <span class="badge ${s.status==='COMPLETE'?'complete':'due'}">${esc(s.status)}</span></div>`}).join('')||'<div class="empty">No schedule generated yet.</div>'}</div></div><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-save-tbt-group="${esc(groupId)}">Save & regenerate schedule</button></div>`);
  }
  async function saveTbtGroup(groupId,btn){const freq=Math.max(0,Math.min(12,Number($('tbtGroupFreqV21164')?.value||0))),ids=[...document.querySelectorAll('.tbt-pool-choice-v21164:checked')].map(x=>x.value);if(freq>0&&!ids.length)return toast('Choose at least one approved TBT for this Group.');btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';const r=await sb.rpc('set_tbt_group_topup_v21163',{p_group_id:groupId,p_frequency:freq,p_training_ids:ids});btn.disabled=false;btn.textContent=old;if(r.error)return toast(r.error.message);await loadAll();closeModal();renderTbtGroupPanel();toast(freq?`Group top-ups set to ${freq} per year.`:'Group TBT top-ups switched off.')}

  /* ---------------- Creator/uploader instructor exception ---------------- */
  function assignmentFromCard(card){const b=card?.querySelector('[data-sign-training],[data-open-required-training],[data-training-exception]');return b?.dataset.signTraining||b?.dataset.openRequiredTraining||b?.dataset.trainingException||null}
  function addSelfExceptionButtons(){
    if(!actualManager())return;const user=state.user?.id;if(!user)return;
    for(const root of [$('hsTrainingList'),$('trainingList')].filter(Boolean))root.querySelectorAll('.item-card').forEach(card=>{if(card.querySelector('[data-v21164-self-exception]'))return;const aid=assignmentFromCard(card);if(!aid)return;const a=(state.trainingAssignments||[]).find(x=>x.id===aid&&x.user_id===user&&x.active!==false);if(!a)return;const t=(state.training||[]).find(x=>x.id===a.training_session_id);if(!t)return;const method=a.delivery_method_override||t.delivery_method;if(method!=='INSTRUCTOR_LED')return;const created=t.created_by===user,uploaded=(state.trainingFiles||[]).some(f=>f.training_session_id===t.id&&f.uploaded_by===user),completed=(state.trainingSignoffs||[]).some(s=>s.training_assignment_id===aid&&s.user_id===user);if((created||uploaded)&&!completed){const row=card.querySelector('.action-bar')||card.querySelector('.row');if(!row)return;const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21164SelfException=aid;b.textContent='Trainer self-completion';row.appendChild(b)}});
  }
  function openSelfException(aid){openModal('Instructor-led self-completion exception',`<div class="hint-box"><strong>Restricted exception.</strong> This is only accepted when you created or uploaded this training, it is assigned to you, and you are authorised to deliver instructor-led training for the assignment. The exception is retained in the audit trail.</div><label>Reason<textarea id="selfExceptionReasonV21164" placeholder="e.g. Authorised trainer and creator completing own required briefing"></textarea></label><div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21164-save-self-exception="${esc(aid)}">Record exception</button></div>`)}
  async function saveSelfException(aid,btn){const reason=clean($('selfExceptionReasonV21164')?.value);if(reason.length<10)return toast('Enter a clear exception reason.');btn.disabled=true;const old=btn.textContent;btn.textContent='Recording…';const r=await sb.rpc('training_self_exception_v21163',{p_assignment_id:aid,p_reason:reason});btn.disabled=false;btn.textContent=old;if(r.error)return toast(r.error.message);closeModal();await api.refresh?.('Instructor-led self-completion exception recorded.');setTimeout(addSelfExceptionButtons,250)}

  /* ---------------- Events / observers ---------------- */
  function openModal(title,html){const m=$('modal'),t=$('modalTitle'),b=$('modalBody');if(!m||!b)return;if(t)t.textContent=title;b.innerHTML=html;if(!m.open)m.showModal()}
  function closeModal(){try{$('modal')?.close()}catch(_e){}}
  function installEvents(){
    window.addEventListener('click',e=>{
      const mode=e.target.closest?.('#departmentManagerModeBtnV21164');if(mode){e.preventDefault();e.stopImmediatePropagation();toggleManagerMode();return}
      if(e.target.closest?.('[data-v21164-new-pack]')){e.preventDefault();openNewPack();return}
      if(e.target.closest?.('[data-v21164-create-pack]')){e.preventDefault();createPack(e.target.closest('[data-v21164-create-pack]'));return}
      const mp=e.target.closest?.('[data-v21164-manage-pack]');if(mp){e.preventDefault();openManagePack(mp.dataset.v21164ManagePack);return}
      const cyc=e.target.closest?.('[data-v21164-save-pack-cycle]');if(cyc){e.preventDefault();savePackCycle(cyc.dataset.v21164SavePackCycle,cyc);return}
      const up=e.target.closest?.('[data-v21164-bulk-upload]');if(up){e.preventDefault();bulkUpload(up.dataset.v21164BulkUpload,up);return}
      const ap=e.target.closest?.('[data-v21164-approve-pack]');if(ap){e.preventDefault();approvePack(ap.dataset.v21164ApprovePack,ap);return}
      const aud=e.target.closest?.('[data-v21164-pack-audience]');if(aud){e.preventDefault();openPackAudience(aud.dataset.v21164PackAudience);return}
      const saud=e.target.closest?.('[data-v21164-save-pack-audience]');if(saud){e.preventDefault();savePackAudience(saud.dataset.v21164SavePackAudience,saud);return}
      const dl=e.target.closest?.('[data-v21164-download-pack-version]');if(dl){e.preventDefault();downloadPackVersion(dl.dataset.v21164DownloadPackVersion);return}
      const rep=e.target.closest?.('[data-v21164-replace-pack-file]');if(rep){e.preventDefault();openReplacePackFile(rep.dataset.v21164ReplacePackFile);return}
      const sr=e.target.closest?.('[data-v21164-save-replacement]');if(sr){e.preventDefault();saveReplacement(sr.dataset.v21164SaveReplacement,sr);return}
      const rs=e.target.closest?.('[data-v21164-pack-review-settings]');if(rs){e.preventDefault();openReviewSchedule(rs.dataset.v21164PackReviewSettings);return}
      const srs=e.target.closest?.('[data-v21164-save-review-schedule]');if(srs){e.preventDefault();saveReviewSchedule(srs.dataset.v21164SaveReviewSchedule,srs);return}
      const rv=e.target.closest?.('[data-v21164-pack-reviewed]');if(rv){e.preventDefault();reviewedNoChange(rv.dataset.v21164PackReviewed);return}
      const audit=e.target.closest?.('[data-v21164-pack-audit]');if(audit){e.preventDefault();downloadPackAudit(audit.dataset.v21164PackAudit);return}
      const req=e.target.closest?.('[data-v21164-open-requirement]');if(req){e.preventDefault();openRequirement(req.dataset.v21164OpenRequirement);return}
      const ack=e.target.closest?.('[data-v21164-ack-requirement]');if(ack){e.preventDefault();acknowledgeRequirement(ack.dataset.v21164AckRequirement,ack);return}
      const tg=e.target.closest?.('[data-v21164-tbt-group]');if(tg){e.preventDefault();openTbtGroup(tg.dataset.v21164TbtGroup);return}
      const stg=e.target.closest?.('[data-v21164-save-tbt-group]');if(stg){e.preventDefault();saveTbtGroup(stg.dataset.v21164SaveTbtGroup,stg);return}
      const ex=e.target.closest?.('[data-v21164-self-exception],[data-training-exception]');if(ex&&actualManager()){e.preventDefault();e.stopImmediatePropagation();openSelfException(ex.dataset.v21164SelfException||ex.dataset.trainingException);return}
      const sex=e.target.closest?.('[data-v21164-save-self-exception]');if(sex){e.preventDefault();saveSelfException(sex.dataset.v21164SaveSelfException,sex);return}
      if(e.target.closest?.('#mainNav button[data-view="documents"]'))setTimeout(()=>{ensurePackPanel();queueFilter()},120);
      if(e.target.closest?.('#mainNav button[data-view="hsTraining"]'))setTimeout(()=>{ensureMyPackPanel();addSelfExceptionButtons()},120);
      if(e.target.closest?.('#mainNav button[data-view="instructor"]'))setTimeout(()=>{ensureTbtGroupPanel();queueFilter()},160);
      if(e.target.closest?.('#mainNav button[data-view="training"],#mainNav button[data-view="compliance"]'))setTimeout(()=>{queueFilter();addSelfExceptionButtons()},140);
    },true);
    for(const id of ['documentsList','docFolderContentsV21119','trainingList','complianceList','instructorList','hsTrainingList']){const root=$(id);if(root&&typeof MutationObserver==='function')new MutationObserver(()=>{queueFilter();if(id==='hsTrainingList'||id==='trainingList')addSelfExceptionButtons()}).observe(root,{childList:true,subtree:true})}
    window.addEventListener('pageshow',()=>setTimeout(async()=>{await loadAll();applyModeUi();ensurePackPanel();ensureMyPackPanel();ensureTbtGroupPanel();queueFilter();addSelfExceptionButtons()},250));
  }
  function installStyles(){if($('packTbtManagerStylesV21164'))return;const s=document.createElement('style');s.id='packTbtManagerStylesV21164';s.textContent=`.pack-head-v21164{gap:12px;align-items:flex-start}#packFilesListV21164 .item-card .badge{margin-left:8px}.tbt-pool-v21164{max-height:300px;overflow:auto}.department-manager-mode-v21164 #mainNav button[data-view="admin"],.department-manager-mode-v21164 #mainNav button[data-view="people"],.department-manager-mode-v21164 #mainNav button[data-view="reports"],.department-manager-mode-v21164 .admin-only{display:none!important}.manager-mode-banner-v21164{margin:8px auto;max-width:1400px}@media(max-width:700px){.pack-head-v21164{display:block}.pack-head-v21164>button{width:100%;margin-top:8px}#packFilesListV21164 .action-bar button{flex:1 1 45%}}`;document.head.appendChild(s)}
  async function boot(){
    api=window.SafetyTrackerV2;if(!api?.state||!api?.sb){setTimeout(boot,120);return}state=api.state;sb=api.sb;if(!state.user)return;
    if(actualAdmin())try{if(localStorage.getItem(modeKey())==='manager'&&state.uiMode!=='user')state.uiMode='manager'}catch(_e){}
    installStyles();await loadAll();applyModeUi();ensurePackPanel();ensureMyPackPanel();ensureTbtGroupPanel();installEvents();queueFilter();addSelfExceptionButtons();[250,700,1400].forEach(ms=>setTimeout(()=>{applyModeUi();queueFilter();addSelfExceptionButtons()},ms));
    window.SafetyPackTbtManagerV21164={reload:async()=>{await loadAll();renderPackManager();renderMyPackRequirements();renderTbtGroupPanel();queueFilter()},openPack:openManagePack};
  }
  boot().catch(e=>console.warn('Safety Tracker v2.11.64 pack/TBT/Manager mode',e));
})();
