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
        <strong>People & Access → Edit person</strong>. HOD uses the person's Main Department; job Position is separate.
        Operational Overseer can cover selected Departments without replacing their official HOD. Multiple Supervisors are allowed.
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
        <h3>Person, HOD, oversight & instructor setup</h3>
        <p>Use People & Access → Edit person to set Main Department, Position, one official HOD, selected Operational Overseer Departments and instructor permission. Position does not silently change Department.</p>
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
  const activeManagerDepartmentIds=()=>{
    const external=window.SafetyDepartmentScopeV21166?.activeIds?.()||[];
    if(external.length)return external;
    return primaryDepartment?.department_id?[primaryDepartment.department_id]:[];
  };
  const deptName=()=>window.SafetyDepartmentScopeV21166?.label?.()||primaryDepartment?.department_name||'Department';
  const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
  const person=id=>{const p=(state?.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'User'};
  const departmentMembers=()=>{const ids=new Set(activeManagerDepartmentIds());return new Set((state?.userDepartments||[]).filter(x=>ids.has(x.department_id)).map(x=>x.user_id))};
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
    const ids=new Set(activeManagerDepartmentIds());
    if(!ids.size)return false;
    const rows=audiences.filter(a=>a.pack_id===p.id);
    return p.created_by===state.user?.id||rows.some(a=>a.target_type==='EVERYONE'||(a.target_type==='DEPARTMENT'&&ids.has(a.department_id)));
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
    if(!scopedManagerMode())return;
    const ids=activeManagerDepartmentIds();if(!ids.length)return;
    let d,t;
    if(window.SafetyDepartmentScopeV21166){
      [d,t]=await Promise.all([
        sb.rpc('manager_scope_documents_v21166',{p_department_ids:ids}),
        sb.rpc('manager_scope_training_v21166',{p_department_ids:ids})
      ]);
    }else{
      [d,t]=await Promise.all([
        sb.rpc('manager_scope_documents_v21164',{p_department_id:ids[0]}),
        sb.rpc('manager_scope_training_v21164',{p_department_id:ids[0]})
      ]);
    }
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
      if(!activeManagerDepartmentIds().length)return toast('Set a Main Department before using Manager mode.');
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
      if(scopedManagerMode()){
        const deptRows=activeManagerDepartmentIds().map(department_id=>({pack_id:id,target_type:'DEPARTMENT',department_id,due_days:14,created_by:state.user.id}));
        if(deptRows.length){const a=await sb.from('document_pack_audiences_v21160').insert(deptRows);if(a.error)throw a.error}
      }
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
    const scopeIds=new Set(activeManagerDepartmentIds());
    const deps=(state.departments||[]).filter(d=>d.active!==false&&(scopedManagerMode()?scopeIds.has(d.id):true)),people=(state.people||[]).filter(x=>x.active!==false&&x.report_only!==true&&(!scopedManagerMode()||departmentMembers().has(x.id))),allowedGroups=groups.filter(managerAllowedGroup);
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

/* Safety Tracker v2.11.65 CLEAN
   Controlled document-set setup inside Edit folder.
   - Folder-level annual staff sign-off + annual file-review deadline.
   - Overall review owner and default file reviewer by person or position/title.
   - All set dates/frequencies/grace/overlap/audience settings editable in-app.
   - Every file has its own Review control and audit history; no bulk review completion.
   - Files inherit the annual review by default. Individual files can override to monthly/quarterly/custom periodic review.
   - When a periodic review overlaps the annual review, the annual review takes priority and satisfies both.
   - File audience can inherit the document-set audience or be overridden by department/position/group/person.
*/
'use strict';
(function(){
  if(window.__SAFETY_DOCUMENT_SET_REVIEW_V21165)return;
  window.__SAFETY_DOCUMENT_SET_REVIEW_V21165=true;

  let api=null,state=null,sb=null;
  let folders=[],packs=[],items=[],versions=[],packAudiences=[],itemAudiences=[],positions=[],positionDepartments=[],userPositions=[],groups=[],reviewRecords=[],reviewTasks=[];
  const groupUsers=new Map();
  let reloadBusy=false;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const today=()=>new Date().toISOString().slice(0,10);
  const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
  const role=()=>String(state?.profile?.role||'').toLowerCase();
  const isManagerUi=()=>['admin','manager'].includes(role())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const departmentManagerMode=()=>role()==='manager'||(role()==='admin'&&state?.uiMode==='manager');
  const toast=m=>{try{api?.toast?.(m)}catch(_e){console.log(m)}};
  const person=id=>{const p=(state?.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||'User'};
  const primaryDepartmentId=()=>{
    const rows=(state?.userDepartments||[]).filter(x=>x.user_id===state?.user?.id);
    return (rows.find(x=>x.is_primary)||rows[0])?.department_id||null;
  };
  const activeDepartmentIds=()=>{
    const external=window.SafetyDepartmentScopeV21166?.activeIds?.()||[];
    return external.length?external:(primaryDepartmentId()?[primaryDepartmentId()]:[]);
  };
  const userDepartmentIds=uid=>(state?.userDepartments||[]).filter(x=>x.user_id===uid).map(x=>x.department_id);
  const positionName=id=>positions.find(x=>x.id===id)?.name||'Position';
  const packForFolder=id=>packs.find(x=>x.folder_id===id)||null;
  const folderById=id=>folders.find(x=>x.id===id)||null;
  const itemById=id=>items.find(x=>x.id===id)||null;
  const packById=id=>packs.find(x=>x.id===id)||null;
  const itemsForPack=id=>items.filter(x=>x.pack_id===id&&x.active!==false).sort((a,b)=>(b.is_main===true)-(a.is_main===true)||(a.sort_order||0)-(b.sort_order||0)||String(a.title||'').localeCompare(String(b.title||'')));
  const latestVersion=id=>versions.filter(v=>v.item_id===id).sort((a,b)=>(b.version_no||0)-(a.version_no||0)||new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;

  function openModal(title,html){
    const m=$('modal'),h=$('modalTitle'),b=$('modalBody');if(!m||!b)return;
    if(h)h.textContent=title;b.innerHTML=html;
    try{if(!m.open)m.showModal()}catch(_e){m.setAttribute('open','')}
  }
  function closeModal(){try{$('modal')?.close()}catch(_e){$('modal')?.removeAttribute('open')}}

  function positionDepartmentIds(id){
    const ids=positionDepartments.filter(x=>x.position_id===id).map(x=>x.department_id);
    const p=positions.find(x=>x.id===id);if(p?.primary_department_id&&!ids.includes(p.primary_department_id))ids.push(p.primary_department_id);
    return ids;
  }
  function holderNames(positionId){
    return userPositions.filter(x=>x.position_id===positionId&&x.active!==false).map(x=>person(x.user_id)).filter(Boolean);
  }
  function scopedPeople(){
    let rows=(state?.people||[]).filter(x=>x.active!==false&&x.report_only!==true);
    if(departmentManagerMode()){
      const deps=new Set(activeDepartmentIds());rows=rows.filter(x=>userDepartmentIds(x.id).some(id=>deps.has(id)));
    }
    return rows.sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  }
  function scopedPositions(){
    let rows=positions.filter(x=>x.active!==false);
    if(departmentManagerMode()){
      const deps=new Set(activeDepartmentIds());rows=rows.filter(x=>positionDepartmentIds(x.id).some(id=>deps.has(id)));
    }
    return rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }
  function scopedDepartments(){
    let rows=(state?.departments||[]).filter(x=>x.active!==false);
    if(departmentManagerMode()){const deps=new Set(activeDepartmentIds());rows=rows.filter(x=>deps.has(x.id))}
    return rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }
  function scopedGroups(){
    let rows=groups.filter(x=>x.active!==false);
    if(departmentManagerMode()){
      const deps=new Set(activeDepartmentIds());
      rows=rows.filter(g=>{
        const users=groupUsers.get(g.id)||[];return users.length&&users.every(u=>userDepartmentIds(u.user_id).some(id=>deps.has(id)));
      });
    }
    return rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }

  function responsibilityValue(userId,positionId,inherit=false){
    if(inherit&&!userId&&!positionId)return 'INHERIT';
    if(positionId)return `POSITION:${positionId}`;
    if(userId)return `USER:${userId}`;
    return inherit?'INHERIT':'';
  }
  function responsibilityOptions(selected='',includeInherit=false){
    const pos=scopedPositions().map(x=>{
      const holders=holderNames(x.id);
      return `<option value="POSITION:${x.id}" ${selected===`POSITION:${x.id}`?'selected':''}>${esc(x.name)}${holders.length?` — ${esc(holders.join(', '))}`:' — vacant'}</option>`;
    }).join('');
    const people=scopedPeople().map(x=>`<option value="USER:${x.id}" ${selected===`USER:${x.id}`?'selected':''}>${esc(x.display_name||x.email)}</option>`).join('');
    return `${includeInherit?`<option value="INHERIT" ${selected==='INHERIT'?'selected':''}>Inherit document-set default</option>`:''}<option value="" ${!selected?'selected':''}>Not assigned</option><optgroup label="Positions / titles">${pos}</optgroup><optgroup label="Named people">${people}</optgroup>`;
  }
  function parseResponsibility(value){
    if(!value||value==='INHERIT')return {user_id:null,position_id:null};
    const [t,id]=String(value).split(':');
    return t==='USER'?{user_id:id,position_id:null}:t==='POSITION'?{user_id:null,position_id:id}:{user_id:null,position_id:null};
  }
  function responsibilityLabel(userId,positionId,fallback='Not assigned'){
    if(positionId)return positionName(positionId);
    if(userId)return person(userId);
    return fallback;
  }
  function effectiveItemReviewer(i,p){
    return responsibilityLabel(i.review_responsible_user_id||p?.default_item_reviewer_user_id||p?.overall_review_responsible_user_id,
      i.review_responsible_position_id||p?.default_item_reviewer_position_id||p?.overall_review_responsible_position_id,'Not assigned');
  }

  function safeAnnualDate(year,month,day){
    const last=new Date(year,month,0).getDate();
    return new Date(year,month-1,Math.min(Math.max(1,Number(day)||1),last),12,0,0);
  }
  function nextOccurrence(month,day){
    const now=new Date();let y=now.getFullYear();let d=safeAnnualDate(y,month,day);
    const t=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12,0,0);
    if(d<t)d=safeAnnualDate(y+1,month,day);
    return d.toISOString().slice(0,10);
  }
  function reviewOccurrence(signoffIso,reviewMonth,reviewDay){
    const sign=new Date(signoffIso+'T12:00:00');let d=safeAnnualDate(sign.getFullYear(),reviewMonth,reviewDay);
    if(d>=sign)d=safeAnnualDate(sign.getFullYear()-1,reviewMonth,reviewDay);
    return d.toISOString().slice(0,10);
  }
  function minusOneMonth(iso){
    const d=new Date(iso+'T12:00:00');const targetMonth=d.getMonth()-1;const day=d.getDate();
    const first=new Date(d.getFullYear(),targetMonth,1,12);const last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    return new Date(first.getFullYear(),first.getMonth(),Math.min(day,last),12).toISOString().slice(0,10);
  }
  function presetFor(value,unit,annual=false){
    if(annual)return 'ANNUAL_ONLY';
    const key=`${Number(value)||0}|${String(unit||'MONTHS').toUpperCase()}`;
    return ({'1|MONTHS':'MONTHLY','3|MONTHS':'QUARTERLY','6|MONTHS':'SIX_MONTHLY','12|MONTHS':'TWELVE_MONTHLY'})[key]||'CUSTOM';
  }
  function presetValues(preset,value=3,unit='MONTHS'){
    if(preset==='MONTHLY')return {mode:'PERIODIC_OVERRIDE',value:1,unit:'MONTHS'};
    if(preset==='QUARTERLY')return {mode:'PERIODIC_OVERRIDE',value:3,unit:'MONTHS'};
    if(preset==='SIX_MONTHLY')return {mode:'PERIODIC_OVERRIDE',value:6,unit:'MONTHS'};
    if(preset==='TWELVE_MONTHLY')return {mode:'PERIODIC_OVERRIDE',value:12,unit:'MONTHS'};
    if(preset==='ANNUAL_ONLY')return {mode:'ANNUAL_ONLY',value:12,unit:'MONTHS'};
    return {mode:'PERIODIC_OVERRIDE',value:Math.max(1,Number(value)||3),unit:String(unit||'MONTHS').toUpperCase()};
  }
  function addInterval(iso,value,unit){
    const d=new Date((iso||today())+'T12:00:00'),n=Math.max(1,Number(value)||1),u=String(unit||'MONTHS').toUpperCase();
    if(u==='DAYS')d.setDate(d.getDate()+n);else if(u==='YEARS')d.setFullYear(d.getFullYear()+n);else d.setMonth(d.getMonth()+n);
    return d.toISOString().slice(0,10);
  }

  function audienceHtml(prefix,rows=[],inheritOption=false,inherit=true){
    const everyone=rows.some(x=>x.target_type==='EVERYONE');
    const deps=new Set(rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>x.department_id));
    const poss=new Set(rows.filter(x=>x.target_type==='POSITION').map(x=>x.position_id));
    const grps=new Set(rows.filter(x=>x.target_type==='GROUP').map(x=>x.group_id));
    const users=new Set(rows.filter(x=>x.target_type==='USER').map(x=>x.user_id));
    const body=`<div id="${prefix}AudienceBody" ${inheritOption&&inherit?'hidden':''}>
      <label class="check-row"><input id="${prefix}Everyone" type="checkbox" ${everyone?'checked':''} ${departmentManagerMode()?'disabled':''}> <strong>Everyone / whole site</strong></label>
      <div class="v21165-audience-grid">
        <details class="v21165-audience-box" ${deps.size?'open':''}><summary>Departments${deps.size?` · ${deps.size}`:''}</summary><div class="generic-audience-v21119">${scopedDepartments().map(d=>`<label><input type="checkbox" data-${prefix}-dep value="${esc(d.id)}" ${deps.has(d.id)?'checked':''}> <span>${esc(d.name)}</span></label>`).join('')||'<span class="muted">No departments.</span>'}</div></details>
        <details class="v21165-audience-box" ${poss.size?'open':''}><summary>Positions / roles${poss.size?` · ${poss.size}`:''}</summary><div class="generic-audience-v21119">${scopedPositions().map(p=>`<label><input type="checkbox" data-${prefix}-position value="${esc(p.id)}" ${poss.has(p.id)?'checked':''}> <span>${esc(p.name)}</span></label>`).join('')||'<span class="muted">No positions.</span>'}</div></details>
        <details class="v21165-audience-box" ${grps.size?'open':''}><summary>Groups${grps.size?` · ${grps.size}`:''}</summary><div class="generic-audience-v21119">${scopedGroups().map(g=>`<label><input type="checkbox" data-${prefix}-group value="${esc(g.id)}" ${grps.has(g.id)?'checked':''}> <span>${esc(g.name)}</span></label>`).join('')||'<span class="muted">No groups.</span>'}</div></details>
        <details class="v21165-audience-box" ${users.size?'open':''}><summary>Specific people${users.size?` · ${users.size}`:''}</summary><div class="generic-audience-v21119">${scopedPeople().map(p=>`<label><input type="checkbox" data-${prefix}-user value="${esc(p.id)}" ${users.has(p.id)?'checked':''}> <span>${esc(p.display_name||p.email)}</span></label>`).join('')||'<span class="muted">No people.</span>'}</div></details>
      </div>
    </div>`;
    return `${inheritOption?`<label class="check-row"><input id="${prefix}Inherit" type="checkbox" ${inherit?'checked':''}> Inherit document-set audience</label>`:''}${body}`;
  }
  function readAudience(prefix,inheritOption=false){
    const inherit=inheritOption?!!$(`${prefix}Inherit`)?.checked:false;
    return {
      inherit,
      everyone:!!$(`${prefix}Everyone`)?.checked,
      departments:[...document.querySelectorAll(`[data-${prefix}-dep]:checked`)].map(x=>x.value),
      positions:[...document.querySelectorAll(`[data-${prefix}-position]:checked`)].map(x=>x.value),
      groups:[...document.querySelectorAll(`[data-${prefix}-group]:checked`)].map(x=>x.value),
      users:[...document.querySelectorAll(`[data-${prefix}-user]:checked`)].map(x=>x.value)
    };
  }
  function audienceSummary(rows=[]){
    if(!rows.length)return 'Not assigned';
    if(rows.some(x=>x.target_type==='EVERYONE'))return 'Everyone';
    const parts=[];
    const d=rows.filter(x=>x.target_type==='DEPARTMENT').map(x=>(state.departments||[]).find(y=>y.id===x.department_id)?.name).filter(Boolean);
    const p=rows.filter(x=>x.target_type==='POSITION').map(x=>positionName(x.position_id)).filter(Boolean);
    const g=rows.filter(x=>x.target_type==='GROUP').map(x=>groups.find(y=>y.id===x.group_id)?.name).filter(Boolean);
    const u=rows.filter(x=>x.target_type==='USER').map(x=>person(x.user_id));
    if(d.length)parts.push(d.join(', '));if(p.length)parts.push('Roles: '+p.join(', '));if(g.length)parts.push('Groups: '+g.join(', '));if(u.length)parts.push('People: '+u.join(', '));
    return parts.join(' · ')||'Assigned';
  }

  async function loadData(){
    if(reloadBusy||!sb||!state?.user)return;reloadBusy=true;
    try{
      try{await sb.rpc('ensure_document_pack_requirements_v21165',{p_pack_id:null})}catch(_e){}
      const [f,p,i,v,pa,ia,pos,pd,up,g,rr,rt]=await Promise.all([
        sb.from('document_folders_v21119').select('*').eq('active',true).order('sort_order').order('name'),
        sb.from('document_packs_v21160').select('*').not('folder_id','is',null),
        sb.from('document_pack_items_v21160').select('*'),
        sb.from('document_pack_item_versions_v21160').select('*'),
        sb.from('document_pack_audiences_v21160').select('*'),
        sb.from('document_pack_item_audiences_v21165').select('*'),
        sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
        sb.from('safety_position_departments_v21069').select('*'),
        sb.from('safety_user_positions_v21069').select('*').eq('active',true),
        sb.from('safety_groups_v21155').select('*').eq('active',true).order('name'),
        sb.from('document_pack_item_reviews_v21165').select('*').order('completed_at',{ascending:false}).limit(2000),
        sb.rpc('my_document_pack_review_tasks_v21165')
      ]);
      folders=f.error?[]:(f.data||[]);packs=p.error?[]:(p.data||[]);items=i.error?[]:(i.data||[]);versions=v.error?[]:(v.data||[]);
      packAudiences=pa.error?[]:(pa.data||[]);itemAudiences=ia.error?[]:(ia.data||[]);positions=pos.error?[]:(pos.data||[]);positionDepartments=pd.error?[]:(pd.data||[]);userPositions=up.error?[]:(up.data||[]);groups=g.error?[]:(g.data||[]);reviewRecords=rr.error?[]:(rr.data||[]);reviewTasks=rt.error?[]:(rt.data||[]);
      groupUsers.clear();
      if(departmentManagerMode()&&groups.length){
        await Promise.all(groups.map(async x=>{const r=await sb.rpc('group_resolved_users_v21155',{p_group_id:x.id});groupUsers.set(x.id,r.error?[]:(r.data||[]))}));
      }
    }finally{reloadBusy=false}
  }

  async function savePackAudience(packId,selection,dueDays){
    const del=await sb.from('document_pack_audiences_v21160').delete().eq('pack_id',packId);if(del.error)throw del.error;
    const rows=[];
    if(selection.everyone&&!departmentManagerMode())rows.push({pack_id:packId,target_type:'EVERYONE',due_days:dueDays,created_by:state.user.id});
    else{
      for(const id of selection.departments)rows.push({pack_id:packId,target_type:'DEPARTMENT',department_id:id,due_days:dueDays,created_by:state.user.id});
      for(const id of selection.positions)rows.push({pack_id:packId,target_type:'POSITION',position_id:id,due_days:dueDays,created_by:state.user.id});
      for(const id of selection.groups)rows.push({pack_id:packId,target_type:'GROUP',group_id:id,due_days:dueDays,created_by:state.user.id});
      for(const id of selection.users)rows.push({pack_id:packId,target_type:'USER',user_id:id,due_days:dueDays,created_by:state.user.id});
    }
    if(rows.length){const ins=await sb.from('document_pack_audiences_v21160').insert(rows);if(ins.error)throw ins.error}
  }

  async function openFolderEditor(folderId=''){
    if(!isManagerUi())return;
    await loadData();
    const f=folderId?folderById(folderId):null,p=f?packForFolder(f.id):null,enabled=f?!!f.controlled_set_enabled:false;
    const signoff=p?nextOccurrence(p.annual_ack_month||1,p.annual_ack_day||1):nextOccurrence(1,31);
    const review=p?reviewOccurrence(signoff,p.annual_review_month||12,p.annual_review_day||31):minusOneMonth(signoff);
    const overall=responsibilityValue(p?.overall_review_responsible_user_id,p?.overall_review_responsible_position_id,false);
    const defaultReviewer=responsibilityValue(p?.default_item_reviewer_user_id,p?.default_item_reviewer_position_id,true);
    const defaultPreset=presetFor(p?.default_review_frequency_value||12,p?.default_review_frequency_unit||'MONTHS',(p?.default_item_review_schedule_mode||'ANNUAL_ONLY')==='ANNUAL_ONLY');
    const aud=p?packAudiences.filter(x=>x.pack_id===p.id):[];
    const due=aud[0]?.due_days||14;
    openModal(f?'Edit folder':'New document folder',`<div class="form-grid v21165-folder-setup">
      <label>Folder name<input id="v21165FolderName" value="${esc(f?.name||'')}" placeholder="e.g. Crisis management plan"></label>
      <label class="full">Description<textarea id="v21165FolderDescription" placeholder="What belongs in this folder?">${esc(f?.description||'')}</textarea></label>
      <label>Sort order<input id="v21165FolderSort" type="number" value="${Number(f?.sort_order||0)}"></label>
      <label class="check-row full v21165-control-switch"><input id="v21165ControlledSet" type="checkbox" ${enabled?'checked':''}> <strong>Controlled document set</strong> — annual review and annual staff sign-off</label>
    </div>
    <div id="v21165ControlledSetFields" ${enabled?'':'hidden'}>
      <div class="section-card"><h4>Annual document-set cycle</h4><p class="muted">Every active file is reviewed individually. The annual staff sign-off only becomes ready after the required file reviews are complete.</p>
        <div class="form-grid">
          <label>Annual staff sign-off due date<input id="v21165AnnualSignoff" type="date" value="${esc(signoff)}"><span class="muted">Recurring every year; fully adjustable.</span></label>
          <label>Annual file-review deadline<input id="v21165AnnualReview" type="date" value="${esc(review)}"><span class="muted">Defaults to one month before sign-off; can be changed independently.</span></label>
          <label>Annual review can start this many days before deadline<input id="v21165ReviewWindow" type="number" min="0" max="366" value="${Number(p?.annual_review_window_days??45)}"></label>
          <label>Recent-starter grace (days)<input id="v21165StarterGrace" type="number" min="0" max="365" value="${Number(p?.new_starter_grace_days??90)}"><span class="muted">0 disables the grace.</span></label>
          <label>Overall responsible for annual review<select id="v21165OverallResponsible">${responsibilityOptions(overall,false)}</select><span class="muted">Named person or position/title.</span></label>
          <label>Default reviewer for individual files<select id="v21165DefaultReviewer">${responsibilityOptions(defaultReviewer,true)}</select><span class="muted">Each file can override this.</span></label>
          <label>Default file review schedule<select id="v21165DefaultSchedule"><option value="ANNUAL_ONLY" ${defaultPreset==='ANNUAL_ONLY'?'selected':''}>Annual only — inherit set deadline</option><option value="MONTHLY" ${defaultPreset==='MONTHLY'?'selected':''}>Monthly</option><option value="QUARTERLY" ${defaultPreset==='QUARTERLY'?'selected':''}>Quarterly</option><option value="SIX_MONTHLY" ${defaultPreset==='SIX_MONTHLY'?'selected':''}>Every 6 months</option><option value="TWELVE_MONTHLY" ${defaultPreset==='TWELVE_MONTHLY'?'selected':''}>Every 12 months</option><option value="CUSTOM" ${defaultPreset==='CUSTOM'?'selected':''}>Custom…</option></select><span class="muted">New files default to annual. Individual files can be monthly/quarterly/custom.</span></label>
          <div id="v21165DefaultCustom" class="form-grid full" ${defaultPreset==='CUSTOM'?'':'hidden'}><label>Every<input id="v21165DefaultValue" type="number" min="1" value="${Number(p?.default_review_frequency_value||3)}"></label><label>Unit<select id="v21165DefaultUnit"><option value="DAYS" ${p?.default_review_frequency_unit==='DAYS'?'selected':''}>Days</option><option value="MONTHS" ${p?.default_review_frequency_unit!=='DAYS'&&p?.default_review_frequency_unit!=='YEARS'?'selected':''}>Months</option><option value="YEARS" ${p?.default_review_frequency_unit==='YEARS'?'selected':''}>Years</option></select></label></div>
          <label>Annual / periodic overlap rule<select id="v21165OverlapMode"><option value="SAME_MONTH" ${(p?.review_overlap_mode||'SAME_MONTH')==='SAME_MONTH'?'selected':''}>Same calendar month — annual takes priority</option><option value="DAYS" ${p?.review_overlap_mode==='DAYS'?'selected':''}>Within a number of days</option><option value="NEVER" ${p?.review_overlap_mode==='NEVER'?'selected':''}>Never combine</option></select></label>
          <label id="v21165OverlapDaysWrap" ${p?.review_overlap_mode==='DAYS'?'':'hidden'}>Overlap window (days)<input id="v21165OverlapDays" type="number" min="0" max="366" value="${Number(p?.review_overlap_days??31)}"></label>
          <label class="check-row full"><input id="v21165RequireAllReviews" type="checkbox" ${p?.require_all_reviews_before_signoff===false?'':'checked'}> Require all active files to complete their annual review before the overall annual sign-off opens</label>
        </div>
      </div>
      <div class="section-card"><h4>Who signs / acknowledges the document set?</h4><p class="muted">Use the normal assignment options. Manager mode is restricted to the manager's own department.</p>${audienceHtml('v21165Set',aud,false,false)}<label>Initial / material-change acknowledgement due within (days)<input id="v21165AudienceDue" type="number" min="1" max="365" value="${Number(due)}"></label></div>
      <div class="hint-box"><strong>Review rule:</strong> there is no “review all files” action. Each file must be opened and reviewed individually. If a monthly/quarterly review overlaps the annual review under the rule above, the annual review satisfies both so nobody reviews the same file twice.</div>
    </div>
    <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21165-save-folder-set="${esc(folderId)}">Save folder</button></div>`);

    let reviewManual=false;
    $('v21165AnnualReview')?.addEventListener('change',()=>{reviewManual=true});
    $('v21165AnnualSignoff')?.addEventListener('change',()=>{if(!reviewManual&&$('v21165AnnualReview'))$('v21165AnnualReview').value=minusOneMonth($('v21165AnnualSignoff').value)});
    const sync=()=>{if($('v21165ControlledSetFields'))$('v21165ControlledSetFields').hidden=!$('v21165ControlledSet')?.checked};
    $('v21165ControlledSet')?.addEventListener('change',sync);sync();
    $('v21165DefaultSchedule')?.addEventListener('change',()=>{if($('v21165DefaultCustom'))$('v21165DefaultCustom').hidden=$('v21165DefaultSchedule').value!=='CUSTOM'});
    $('v21165OverlapMode')?.addEventListener('change',()=>{if($('v21165OverlapDaysWrap'))$('v21165OverlapDaysWrap').hidden=$('v21165OverlapMode').value!=='DAYS'});
  }

  async function saveFolderSet(folderId,button){
    const name=clean($('v21165FolderName')?.value),description=clean($('v21165FolderDescription')?.value)||null,sort=Number($('v21165FolderSort')?.value)||0,enabled=!!$('v21165ControlledSet')?.checked;
    if(!name)return toast('Folder name is required.');
    const signoff=$('v21165AnnualSignoff')?.value||nextOccurrence(1,31),review=$('v21165AnnualReview')?.value||minusOneMonth(signoff);
    if(enabled&&new Date(review+'T12:00:00')>=new Date(signoff+'T12:00:00'))return toast('The annual file-review deadline must be before the annual staff sign-off date.');
    const signD=new Date(signoff+'T12:00:00'),reviewD=new Date(review+'T12:00:00');
    const overall=parseResponsibility($('v21165OverallResponsible')?.value||''),def=parseResponsibility($('v21165DefaultReviewer')?.value||'INHERIT');
    const preset=$('v21165DefaultSchedule')?.value||'ANNUAL_ONLY',pv=presetValues(preset,$('v21165DefaultValue')?.value,$('v21165DefaultUnit')?.value);
    const aud=readAudience('v21165Set',false),due=Math.max(1,Math.min(365,Number($('v21165AudienceDue')?.value)||14));
    if(departmentManagerMode()&&aud.everyone)return toast('Manager mode cannot assign a document set to Everyone. Switch to Admin for site-wide assignment.');
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    try{
      const r=await sb.rpc('save_document_folder_set_v21165',{
        p_folder_id:folderId||null,p_name:name,p_description:description,p_sort_order:sort,p_controlled_set_enabled:enabled,
        p_annual_signoff_month:signD.getMonth()+1,p_annual_signoff_day:signD.getDate(),p_annual_review_month:reviewD.getMonth()+1,p_annual_review_day:reviewD.getDate(),
        p_grace_days:Math.max(0,Math.min(365,Number($('v21165StarterGrace')?.value)||0)),p_default_review_mode:pv.mode,p_default_review_value:pv.value,p_default_review_unit:pv.unit,
        p_overall_review_user_id:overall.user_id,p_overall_review_position_id:overall.position_id,p_default_reviewer_user_id:def.user_id,p_default_reviewer_position_id:def.position_id,
        p_overlap_mode:$('v21165OverlapMode')?.value||'SAME_MONTH',p_overlap_days:Math.max(0,Math.min(366,Number($('v21165OverlapDays')?.value)||31)),
        p_annual_review_window_days:Math.max(0,Math.min(366,Number($('v21165ReviewWindow')?.value)||45)),p_require_all_reviews:!!$('v21165RequireAllReviews')?.checked
      });
      if(r.error)throw r.error;
      const packId=r.data?.pack_id||null;
      if(enabled&&packId)await savePackAudience(packId,aud,due);
      if(enabled&&packId)await sb.rpc('ensure_document_pack_requirements_v21165',{p_pack_id:packId});
      closeModal();await loadData();
      try{await window.SafetyGenericDocumentsV21119?.refresh?.()}catch(_e){}
      try{await window.SafetyPackTbtManagerV21164?.reload?.()}catch(_e){}
      setTimeout(()=>decorateFolderWorkspace(),180);
      toast(enabled?'Controlled document-set settings saved.':'Folder saved. Controlled-set rules are switched off but retained.');
    }catch(e){toast(e.message||'Could not save folder settings.');button.disabled=false;button.textContent=old}
  }

  async function annualOverview(packId){
    try{await sb.rpc('ensure_document_pack_cycles_v21165',{p_pack_id:packId})}catch(_e){}
    const r=await sb.rpc('document_pack_annual_overview_v21165',{p_pack_id:packId});
    return r.error?null:(Array.isArray(r.data)?r.data[0]:r.data);
  }
  function reviewScheduleText(i){
    if(i.review_schedule_mode!=='PERIODIC_OVERRIDE')return 'Annual only';
    const p=presetFor(i.review_frequency_value,i.review_frequency_unit,false);
    if(p==='MONTHLY')return 'Monthly';if(p==='QUARTERLY')return 'Quarterly';if(p==='SIX_MONTHLY')return 'Every 6 months';if(p==='TWELVE_MONTHLY')return 'Every 12 months';
    return `Every ${i.review_frequency_value||1} ${String(i.review_frequency_unit||'MONTHS').toLowerCase()}`;
  }
  function currentAnnualReview(i,cycleYear){return reviewRecords.find(r=>r.item_id===i.id&&r.cycle_year===cycleYear&&r.annual_satisfied===true)||null}

  async function decorateFolderWorkspace(){
    const root=$('docFolderContentsV21119');if(!root)return;
    const edit=root.querySelector('[data-v21119-edit-folder]');if(!edit)return;
    await loadData();
    const folderId=edit.dataset.v21119EditFolder,f=folderById(folderId),p=packForFolder(folderId);
    root.querySelector('#controlledSetSummaryV21165')?.remove();root.querySelector('#controlledSetFilesV21165')?.remove();
    if(!f?.controlled_set_enabled||!p)return;
    const ov=await annualOverview(p.id),its=itemsForPack(p.id);
    const reviewed=ov?.annual_reviewed_items||0,total=ov?.total_items??its.length,ready=!!ov?.ready;
    const summary=document.createElement('div');summary.id='controlledSetSummaryV21165';summary.className=`section-card v21165-set-summary traffic-${ready?'green':(ov?.review_due_date&&ov.review_due_date<today()?'red':'amber')}`;
    summary.innerHTML=`<div class="row-between"><div><h4>Controlled document set</h4><div class="meta"><span>Annual file review: ${reviewed}/${total}</span><span>Review deadline ${fmtDate(ov?.review_due_date)}</span><span>Annual staff sign-off ${fmtDate(ov?.signoff_due_date)}</span><span>Owner: ${esc(responsibilityLabel(p.overall_review_responsible_user_id,p.overall_review_responsible_position_id,'Not assigned'))}</span></div><div class="muted">Audience: ${esc(audienceSummary(packAudiences.filter(x=>x.pack_id===p.id)))}</div></div><span class="badge ${ready?'complete':'due'}">${ready?'Ready for annual sign-off':`${Math.max(0,total-reviewed)} file review${total-reviewed===1?'':'s'} outstanding`}</span></div><div class="row action-bar"><button class="primary" type="button" data-v21165-open-pack="${esc(p.id)}">Manage files / versions</button><button class="secondary" type="button" data-v21165-edit-linked-folder="${esc(folderId)}">Document-set settings</button></div>`;
    const head=root.querySelector('.row-between');if(head)head.insertAdjacentElement('afterend',summary);else root.prepend(summary);

    if(its.length){root.querySelector('.empty')?.setAttribute('hidden','');}
    const files=document.createElement('div');files.id='controlledSetFilesV21165';files.className='section-card';
    files.innerHTML=`<div class="row-between"><div><h4>Controlled set files</h4><p class="muted">Every file has its own review control. No bulk review sign-off is available.</p></div><span class="badge neutral">${its.length} file${its.length===1?'':'s'}</span></div><div class="card-list">${its.map(i=>{
      const v=latestVersion(i.id),annual=currentAnnualReview(i,ov?.cycle_year),annualDue=ov?.review_due_date,periodic=i.review_schedule_mode==='PERIODIC_OVERRIDE'?i.next_review_date:null;
      const annualOver=annualDue&&!annual&&annualDue<today(),periodicOver=periodic&&periodic<today();
      const traffic=annualOver||periodicOver?'red':annual?'green':'amber';
      return `<div class="item-card compact traffic-${traffic}"><div class="row-between"><div><strong>${esc(i.title)}</strong>${i.is_main?'<span class="badge complete">Main/index</span>':''}<div class="meta"><span>v${esc(v?.version_no||1)}</span><span>${esc(reviewScheduleText(i))}</span><span>Annual ${annual?'reviewed '+fmtDate(annual.completed_at):'due '+fmtDate(annualDue)}</span>${periodic?`<span>Periodic ${fmtDate(periodic)}</span>`:''}<span>Reviewer: ${esc(effectiveItemReviewer(i,p))}</span></div>${i.review_reason?`<div class="muted">Review reason: ${esc(i.review_reason)}</div>`:''}</div><span class="badge ${annual?'complete':annualOver?'overdue':'due'}">${annual?'Annual reviewed':annualOver?'Annual overdue':'Annual review pending'}</span></div><div class="row action-bar"><button class="primary" type="button" data-v21165-review-item="${esc(i.id)}">Review</button>${v?`<button class="secondary" type="button" data-v21165-download-version="${esc(v.id)}">Download Word</button>`:''}<button class="ghost" type="button" data-v21165-open-pack="${esc(p.id)}">Versions / replace file</button></div></div>`;
    }).join('')||'<div class="empty">No files uploaded yet. Use Manage files / versions to bulk upload the Word documents.</div>'}</div>`;
    root.appendChild(files);
  }

  async function downloadVersion(versionId){
    const v=versions.find(x=>x.id===versionId);if(!v)return toast('File version not found.');
    const r=await sb.storage.from('safety-files').download(v.storage_path);if(r.error)return toast(r.error.message);
    const a=document.createElement('a');a.href=URL.createObjectURL(r.data);a.download=v.file_name||'document';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  }

  function fileAudienceSummary(i,p){
    const rows=itemAudiences.filter(x=>x.item_id===i.id);return rows.length?audienceSummary(rows):`Inherits set: ${audienceSummary(packAudiences.filter(x=>x.pack_id===p.id))}`;
  }
  async function openItemReview(itemId){
    await loadData();const i=itemById(itemId),p=i?packById(i.pack_id):null;if(!i||!p)return toast('Document file not found.');
    const [ctxR,canR]=await Promise.all([
      sb.rpc('document_pack_item_review_context_v21165',{p_item_id:itemId}),
      sb.rpc('document_pack_reviewer_matches_v21165',{p_item_id:itemId,p_user_id:state.user.id})
    ]);
    const ctx=ctxR.error?null:(Array.isArray(ctxR.data)?ctxR.data[0]:ctxR.data),canComplete=!canR.error&&!!canR.data,canManage=isManagerUi();
    const rows=itemAudiences.filter(x=>x.item_id===itemId),inherit=rows.length===0;
    const preset=presetFor(i.review_frequency_value,i.review_frequency_unit,i.review_schedule_mode!=='PERIODIC_OVERRIDE');
    const reviewer=responsibilityValue(i.review_responsible_user_id,i.review_responsible_position_id,true);
    const recent=reviewRecords.filter(x=>x.item_id===itemId).slice(0,8);
    const annualOpen=ctx&&!ctx.annual_satisfied&&today()>=ctx.annual_review_open_date&&today()<=ctx.annual_signoff_due_date;
    const periodicDue=ctx?.periodic_due_date&&today()>=ctx.periodic_due_date;
    let counts='Ad-hoc review — does not replace a scheduled annual/periodic review.';
    if(annualOpen&&ctx?.periodic_overlap)counts='<strong>Annual review takes priority:</strong> this review will satisfy both the annual and overlapping periodic review. No duplicate review will be required.';
    else if(annualOpen)counts='<strong>Annual review:</strong> this completion will satisfy the current annual file review.';
    else if(periodicDue)counts='<strong>Periodic review:</strong> this completion will satisfy the periodic review. The annual review remains separate unless it overlaps.';
    else if(ctx?.annual_satisfied)counts='Current annual review is already complete. A review now is ad-hoc unless a periodic review is due.';

    openModal(`Review · ${i.title}`,`<div class="section-card"><div class="row-between"><div><h3>${esc(i.title)}</h3><div class="meta"><span>${esc(reviewScheduleText(i))}</span><span>Annual deadline ${fmtDate(ctx?.annual_review_due_date)}</span><span>Annual sign-off ${fmtDate(ctx?.annual_signoff_due_date)}</span><span>Audience: ${esc(fileAudienceSummary(i,p))}</span></div></div><span class="badge ${ctx?.annual_satisfied?'complete':'due'}">${ctx?.annual_satisfied?'Annual reviewed':'Annual review pending'}</span></div></div>
      ${canManage?`<div class="section-card"><h4>File review settings</h4><p class="muted">This file is always part of the set's annual review. Add a periodic override only when it also needs monthly/quarterly/other reviews.</p><div class="form-grid">
        <label>Review schedule<select id="v21165ItemSchedule"><option value="ANNUAL_ONLY" ${preset==='ANNUAL_ONLY'?'selected':''}>Inherit annual document-set review only</option><option value="MONTHLY" ${preset==='MONTHLY'?'selected':''}>Monthly + annual</option><option value="QUARTERLY" ${preset==='QUARTERLY'?'selected':''}>Quarterly + annual</option><option value="SIX_MONTHLY" ${preset==='SIX_MONTHLY'?'selected':''}>Every 6 months + annual</option><option value="TWELVE_MONTHLY" ${preset==='TWELVE_MONTHLY'?'selected':''}>Every 12 months + annual</option><option value="CUSTOM" ${preset==='CUSTOM'?'selected':''}>Custom periodic + annual</option></select></label>
        <div id="v21165ItemCustom" class="form-grid full" ${preset==='CUSTOM'?'':'hidden'}><label>Every<input id="v21165ItemReviewValue" type="number" min="1" value="${Number(i.review_frequency_value||3)}"></label><label>Unit<select id="v21165ItemReviewUnit"><option value="DAYS" ${i.review_frequency_unit==='DAYS'?'selected':''}>Days</option><option value="MONTHS" ${i.review_frequency_unit!=='DAYS'&&i.review_frequency_unit!=='YEARS'?'selected':''}>Months</option><option value="YEARS" ${i.review_frequency_unit==='YEARS'?'selected':''}>Years</option></select></label></div>
        <label id="v21165NextPeriodicWrap" ${preset==='ANNUAL_ONLY'?'hidden':''}>Next periodic review date<input id="v21165NextPeriodic" type="date" value="${esc(ctx?.periodic_due_date||addInterval(today(),3,'MONTHS'))}"><span class="muted">Annual review can absorb this occurrence if the configured overlap rule applies.</span></label>
        <label>Responsible reviewer<select id="v21165ItemReviewer">${responsibilityOptions(reviewer,true)}</select><span class="muted">Inherit uses the document-set default reviewer/owner.</span></label>
        <label class="full">Review reason / purpose<textarea id="v21165ItemReason" placeholder="Why this file is reviewed at this frequency">${esc(i.review_reason||'')}</textarea></label>
      </div><div class="section-card nested"><h4>Who does this file apply to?</h4>${audienceHtml('v21165Item',rows,true,inherit)}</div><div class="actions"><button class="secondary" type="button" data-v21165-save-item-settings="${esc(itemId)}">Save file settings</button></div></div>`:''}
      <div class="section-card"><h4>Complete this file review</h4><div class="hint-box">${counts}</div>${!annualOpen&&!ctx?.annual_satisfied&&canManage?`<label class="check-row"><input id="v21165ForceAnnual" type="checkbox"> Count this early review toward the current annual cycle (manager override)</label>`:''}<div class="form-grid"><label>Review outcome<select id="v21165ReviewOutcome"><option value="NO_CHANGE">Reviewed — no change</option><option value="MINOR_AMENDMENT">Minor amendment / admin update</option><option value="MATERIAL_AMENDMENT">Material amendment required</option><option value="NEW_VERSION_REQUIRED">New version required before annual sign-off</option><option value="RETIRED">Retire this file from the set</option></select></label><label class="full">Review comments<textarea id="v21165ReviewComments" placeholder="What was checked, findings, actions or reason"></textarea></label></div><div class="actions">${canComplete?`<button class="primary" type="button" data-v21165-complete-review="${esc(itemId)}">Complete this file review</button>`:'<span class="danger-note">You are not the assigned reviewer for this file.</span>'}</div></div>
      <div class="section-card"><h4>Review history</h4><div class="card-list">${recent.map(r=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(String(r.review_kind||'REVIEW').replaceAll('_',' '))}</strong> · ${esc(String(r.outcome||'').replaceAll('_',' '))}<div class="meta"><span>${fmtDate(r.completed_at)}</span><span>${esc(person(r.completed_by))}</span>${r.annual_satisfied?'<span class="badge complete">Annual satisfied</span>':''}${r.periodic_satisfied?'<span class="badge complete">Periodic satisfied</span>':''}</div>${r.comments?`<div class="muted">${esc(r.comments)}</div>`:''}</div></div></div>`).join('')||'<div class="empty">No review history yet.</div>'}</div></div>`);
    $('v21165ItemSchedule')?.addEventListener('change',()=>{const v=$('v21165ItemSchedule').value;if($('v21165ItemCustom'))$('v21165ItemCustom').hidden=v!=='CUSTOM';if($('v21165NextPeriodicWrap'))$('v21165NextPeriodicWrap').hidden=v==='ANNUAL_ONLY'});
    $('v21165ItemInherit')?.addEventListener('change',()=>{if($('v21165ItemAudienceBody'))$('v21165ItemAudienceBody').hidden=$('v21165ItemInherit').checked});
  }

  async function saveItemSettings(itemId,button){
    const i=itemById(itemId);if(!i)return;
    const preset=$('v21165ItemSchedule')?.value||'ANNUAL_ONLY',pv=presetValues(preset,$('v21165ItemReviewValue')?.value,$('v21165ItemReviewUnit')?.value),resp=parseResponsibility($('v21165ItemReviewer')?.value||'INHERIT'),aud=readAudience('v21165Item',true);
    if(!aud.inherit&&!aud.everyone&&!aud.departments.length&&!aud.positions.length&&!aud.groups.length&&!aud.users.length)return toast('Choose who this file applies to, or tick Inherit document-set audience.');
    button.disabled=true;const old=button.textContent;button.textContent='Saving…';
    const r=await sb.rpc('set_document_pack_item_controls_v21165',{
      p_item_id:itemId,p_schedule_mode:pv.mode,p_review_value:pv.value,p_review_unit:pv.unit,p_next_periodic_review_date:pv.mode==='PERIODIC_OVERRIDE'?($('v21165NextPeriodic')?.value||null):null,
      p_review_responsible_user_id:resp.user_id,p_review_responsible_position_id:resp.position_id,p_review_reason:clean($('v21165ItemReason')?.value)||null,
      p_inherit_pack_audience:aud.inherit,p_everyone:aud.everyone,p_department_ids:aud.departments,p_position_ids:aud.positions,p_group_ids:aud.groups,p_user_ids:aud.users
    });
    if(r.error){button.disabled=false;button.textContent=old;return toast(r.error.message)}
    await loadData();toast('File review settings saved.');await openItemReview(itemId);setTimeout(()=>decorateFolderWorkspace(),120);
  }

  async function completeReview(itemId,button){
    const outcome=$('v21165ReviewOutcome')?.value||'NO_CHANGE',comments=clean($('v21165ReviewComments')?.value)||null,force=!!$('v21165ForceAnnual')?.checked;
    if(outcome==='RETIRED'&&!confirm('Retire this file from the controlled set? Its history will be retained.'))return;
    button.disabled=true;const old=button.textContent;button.textContent='Recording…';
    const r=await sb.rpc('complete_document_pack_item_review_v21165',{p_item_id:itemId,p_outcome:outcome,p_comments:comments,p_force_annual:force});
    if(r.error){button.disabled=false;button.textContent=old;return toast(r.error.message)}
    closeModal();await loadData();try{await window.SafetyPackTbtManagerV21164?.reload?.()}catch(_e){};renderReviewTasks();setTimeout(()=>decorateFolderWorkspace(),120);
    toast(outcome==='MATERIAL_AMENDMENT'||outcome==='NEW_VERSION_REQUIRED'?'Review recorded. Annual sign-off remains blocked until the required update is completed and reviewed.':'Individual file review recorded.');
  }

  async function openLinkedPack(packId){
    try{await window.SafetyPackTbtManagerV21164?.openPack?.(packId)}catch(e){toast(e.message||'Could not open document set.');return}
    [80,200,450].forEach(ms=>setTimeout(()=>decorateManagePackModal(packId),ms));
  }
  function decorateManagePackModal(packId){
    const p=packById(packId);if(!p)return;
    const linked=!!p.folder_id;
    const annual=$('packEditAnnualDateV21164');
    if(linked&&annual){
      annual.disabled=true;if($('packEditGraceV21164'))$('packEditGraceV21164').disabled=true;
      const save=document.querySelector(`[data-v21164-save-pack-cycle="${CSS.escape(packId)}"]`);if(save)save.hidden=true;
      let note=$('v21165PackSetupNote');if(!note){note=document.createElement('div');note.id='v21165PackSetupNote';note.className='hint-box';note.innerHTML=`<strong>Document-set dates and responsibility:</strong> manage these from the folder's <strong>Edit folder</strong> screen so annual review, annual sign-off, owner, overlap rule and audience stay together. <button class="secondary" type="button" data-v21165-edit-linked-folder="${esc(p.folder_id)}">Open folder settings</button>`;annual.closest('.section-card')?.appendChild(note)}
    }
    const root=$('packFilesListV21164');if(!root)return;
    root.querySelectorAll('.item-card').forEach(card=>{
      const old1=card.querySelector('[data-v21164-pack-review-settings]'),old2=card.querySelector('[data-v21164-pack-reviewed]');
      const itemId=old1?.dataset.v21164PackReviewSettings||old2?.dataset.v21164PackReviewed||card.querySelector('[data-v21164-replace-pack-file]')?.dataset.v21164ReplacePackFile;
      if(old1)old1.hidden=true;if(old2)old2.hidden=true;if(!itemId)return;
      const row=card.querySelector('.action-bar');if(row&&!row.querySelector('[data-v21165-review-item]')){const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21165ReviewItem=itemId;b.textContent='Review';row.insertBefore(b,row.children[1]||null)}
    });
  }

  function ensureReviewTasksPanel(){
    const view=$('hsTrainingView')||$('mySafetyView');if(!view)return null;
    let box=$('documentReviewTasksV21165');if(!box){box=document.createElement('div');box.id='documentReviewTasksV21165';box.className='section-card';const before=$('myPackRequirementsV21164')||view.firstElementChild;if(before)before.insertAdjacentElement('afterend',box);else view.prepend(box)}
    return box;
  }
  function renderReviewTasks(){
    const box=ensureReviewTasksPanel();if(!box)return;
    box.hidden=!reviewTasks.length;if(!reviewTasks.length){box.innerHTML='';return}
    box.innerHTML=`<div class="row-between"><div><h3>Document reviews assigned to you</h3><p class="muted">Each file is reviewed separately. Annual and periodic reviews are combined automatically when the document-set overlap rule applies.</p></div><span class="badge due">${reviewTasks.length} due / upcoming</span></div><div class="card-list">${reviewTasks.map(t=>{
      const annualDue=!t.annual_satisfied&&today()>=t.annual_review_open_date,periodic=!!t.periodic_due;const tr=(t.annual_review_due_date<today()&&!t.annual_satisfied)||(t.periodic_due_date&&t.periodic_due_date<today())?'red':'amber';
      return `<div class="item-card compact traffic-${tr}"><div class="row-between"><div><strong>${esc(t.pack_title)} · ${esc(t.item_title)}</strong><div class="meta">${annualDue?`<span>Annual due ${fmtDate(t.annual_review_due_date)}</span>`:''}${periodic?`<span>Periodic ${fmtDate(t.periodic_due_date)}</span>`:''}${t.periodic_overlap?'<span class="badge complete">One review satisfies both</span>':''}</div></div><button class="primary" type="button" data-v21165-review-item="${esc(t.item_id)}">Review file</button></div></div>`;
    }).join('')}</div>`;
  }

  async function refreshUi(){await loadData();renderReviewTasks();setTimeout(()=>decorateFolderWorkspace(),80)}

  function installEvents(){
    window.addEventListener('click',e=>{
      const nf=e.target.closest?.('[data-v21119-new-folder]');if(nf){e.preventDefault();e.stopImmediatePropagation();openFolderEditor();return}
      const ef=e.target.closest?.('[data-v21119-edit-folder]');if(ef){e.preventDefault();e.stopImmediatePropagation();openFolderEditor(ef.dataset.v21119EditFolder);return}
      const linked=e.target.closest?.('[data-v21165-edit-linked-folder]');if(linked){e.preventDefault();e.stopImmediatePropagation();openFolderEditor(linked.dataset.v21165EditLinkedFolder);return}
      const sf=e.target.closest?.('[data-v21165-save-folder-set]');if(sf){e.preventDefault();e.stopImmediatePropagation();saveFolderSet(sf.dataset.v21165SaveFolderSet,sf);return}
      const op=e.target.closest?.('[data-v21165-open-pack]');if(op){e.preventDefault();e.stopImmediatePropagation();openLinkedPack(op.dataset.v21165OpenPack);return}
      const ri=e.target.closest?.('[data-v21165-review-item]');if(ri){e.preventDefault();e.stopImmediatePropagation();openItemReview(ri.dataset.v21165ReviewItem);return}
      const sis=e.target.closest?.('[data-v21165-save-item-settings]');if(sis){e.preventDefault();e.stopImmediatePropagation();saveItemSettings(sis.dataset.v21165SaveItemSettings,sis);return}
      const cr=e.target.closest?.('[data-v21165-complete-review]');if(cr){e.preventDefault();e.stopImmediatePropagation();completeReview(cr.dataset.v21165CompleteReview,cr);return}
      const dv=e.target.closest?.('[data-v21165-download-version]');if(dv){e.preventDefault();e.stopImmediatePropagation();downloadVersion(dv.dataset.v21165DownloadVersion);return}
      const folder=e.target.closest?.('[data-v21119-open-folder]');if(folder)setTimeout(()=>decorateFolderWorkspace(),180);
      const manage=e.target.closest?.('[data-v21164-manage-pack]');if(manage)setTimeout(()=>decorateManagePackModal(manage.dataset.v21164ManagePack),180);
      const nav=e.target.closest?.('#mainNav button[data-view]');if(nav&&['documents','hsTraining','mySafety'].includes(nav.dataset.view))setTimeout(()=>refreshUi(),180);
    },true);
    const modal=$('modal');if(modal&&typeof MutationObserver==='function')new MutationObserver(()=>{
      const cyc=document.querySelector('[data-v21164-save-pack-cycle]');if(cyc)setTimeout(()=>decorateManagePackModal(cyc.dataset.v21164SavePackCycle),20);
    }).observe(modal,{childList:true,subtree:true});
    const folderRoot=$('docFolderWorkspaceV21119');if(folderRoot&&typeof MutationObserver==='function')new MutationObserver(()=>setTimeout(()=>decorateFolderWorkspace(),40)).observe(folderRoot,{childList:true,subtree:true});
    window.addEventListener('pageshow',()=>setTimeout(()=>refreshUi(),220));
  }

  function installStyles(){
    if($('documentSetReviewStylesV21165'))return;const s=document.createElement('style');s.id='documentSetReviewStylesV21165';s.textContent=`
      .v21165-control-switch{padding:12px;border:1px solid var(--border,#334155);border-radius:10px}
      .v21165-audience-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
      .v21165-audience-box{border:1px solid var(--border,#334155);border-radius:9px;overflow:hidden}
      .v21165-audience-box summary{padding:9px 10px;font-weight:700;cursor:pointer}
      .v21165-audience-box .generic-audience-v21119{border:0;border-top:1px solid var(--border,#334155);border-radius:0;max-height:180px}
      .v21165-set-summary{margin:12px 0;border-width:2px}
      .section-card.nested{margin:12px 0 0}
      #controlledSetFilesV21165{margin-top:12px}
      #documentReviewTasksV21165{margin-top:12px}
      @media(max-width:720px){.v21165-audience-grid{grid-template-columns:1fr}.v21165-folder-setup{grid-template-columns:1fr}.v21165-set-summary .row-between{display:block}.v21165-set-summary .action-bar button{width:100%}}
    `;document.head.appendChild(s);
  }

  async function boot(){
    api=window.SafetyTrackerV2;if(!api?.state||!api?.sb){setTimeout(boot,120);return}state=api.state;sb=api.sb;if(!state.user)return;
    installStyles();await loadData();installEvents();renderReviewTasks();[180,500,1100].forEach(ms=>setTimeout(()=>decorateFolderWorkspace(),ms));
    window.SafetyDocumentSetReviewV21165={reload:refreshUi,openFolder:openFolderEditor,openReview:openItemReview};
  }
  boot().catch(e=>console.warn('Safety Tracker v2.11.65 document-set review',e));
})();
/* Safety Tracker v2.11.66 CLEAN
   People, department and responsibility simplification.
   - Main Department is selected directly and is independent from job Position.
   - Main Position + optional additional Positions remain available without silently changing Department.
   - Official HOD stays one per Department.
   - Operational Overseer is a separate, multi-Department responsibility and never replaces the HOD.
   - New Safety users default to the Safety site from which they are created.
   - Manager mode can show all managed/overseen Departments or one selected Department.
*/
'use strict';
(function(){
  if(window.__SAFETY_PEOPLE_SCOPE_V21166)return;
  window.__SAFETY_PEOPLE_SCOPE_V21166=true;

  let api=null,state=null,sb=null;
  let departments=[],positions=[],profiles=[],userDepartments=[],userPositions=[],responsibilities=[],overseers=[];
  let sites=[],siteAccess=[],moduleAccess=[],sharedUsers=[],sharedLinks=[];
  let scopeRows=[],scopeSelection='ALL',currentSiteId=null;
  let peopleObserver=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toLowerCase();
  const toast=m=>{try{api?.toast?.(m)}catch(_e){console.log(m)}};
  const isAdmin=()=>String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isManager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const scopeKey=()=>`safetyDepartmentScopeV21166:${state?.user?.id||'unknown'}`;

  function openModal(title,html){
    const m=$('modal'),h=$('modalTitle'),b=$('modalBody');if(!m||!b)return;
    if(h)h.textContent=title;b.innerHTML=html;
    try{if(!m.open)m.showModal()}catch(_e){m.setAttribute('open','')}
  }
  function closeModal(){try{$('modal')?.close()}catch(_e){$('modal')?.removeAttribute('open')}}

  function personName(id){const p=profiles.find(x=>x.id===id)||(state?.people||[]).find(x=>x.id===id);return p?.display_name||p?.email||p?.login_username||'User'}
  function departmentName(id){return departments.find(x=>x.id===id)?.name||'Department'}
  function positionName(id){return positions.find(x=>x.id===id)?.name||'Position'}
  function profileById(id){return profiles.find(x=>x.id===id)||(state?.people||[]).find(x=>x.id===id)||null}
  function moduleFor(id){return moduleAccess.find(x=>x.user_id===id&&x.module_key==='safety')||null}
  function siteRowsFor(id){return siteAccess.filter(x=>x.user_id===id&&x.module_key==='safety'&&x.enabled!==false)}
  function mainDepartmentFor(id){const rows=userDepartments.filter(x=>x.user_id===id);return (rows.find(x=>x.is_primary)||rows[0])?.department_id||null}
  function mainPositionFor(id){const rows=userPositions.filter(x=>x.user_id===id&&x.active!==false);return (rows.find(x=>x.is_primary)||rows[0])?.position_id||null}
  function hodDepartmentFor(id){return responsibilities.find(x=>x.user_id===id&&x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER')?.department_id||null}
  function oversightFor(id){return overseers.filter(x=>x.user_id===id&&x.active!==false).map(x=>x.department_id)}

  async function loadData(){
    const [d,p,pr,ud,up,r,o,s,sa,ma,sh,sl,cur]=await Promise.all([
      sb.from('departments').select('*').eq('active',true).order('name'),
      sb.from('safety_positions_v21069').select('*').eq('active',true).order('name'),
      sb.from('profiles').select('id,display_name,email,login_username,role,active,report_only').order('display_name'),
      sb.from('user_departments').select('*'),
      sb.from('safety_user_positions_v21069').select('*').eq('active',true),
      sb.from('safety_responsibilities_v21069').select('*').eq('active',true),
      sb.from('safety_operational_overseers_v21166').select('*').eq('active',true),
      sb.from('organisation_sites_v21137').select('*').eq('active',true).order('name'),
      sb.from('app_site_access_v21137').select('*').eq('module_key','safety'),
      sb.from('app_module_access_v21137').select('*').eq('module_key','safety'),
      sb.from('shared_app_users_v21143').select('*').order('display_name'),
      sb.from('shared_safety_user_links_v21148').select('*'),
      sb.rpc('current_safety_site_v21138')
    ]);
    if(!d.error)departments=d.data||[];
    if(!p.error)positions=p.data||[];
    if(!pr.error)profiles=pr.data||[];else profiles=state?.people||[];
    if(!ud.error)userDepartments=ud.data||[];
    if(!up.error)userPositions=up.data||[];
    if(!r.error)responsibilities=r.data||[];
    if(!o.error)overseers=o.data||[];
    if(!s.error)sites=s.data||[];
    if(!sa.error)siteAccess=sa.data||[];
    if(!ma.error)moduleAccess=ma.data||[];
    if(!sh.error)sharedUsers=sh.data||[];
    if(!sl.error)sharedLinks=sl.data||[];
    if(!cur.error)currentSiteId=cur.data||null;

    if(!currentSiteId){
      const mine=moduleFor(state?.user?.id);currentSiteId=mine?.home_site_id||sites.find(x=>x.is_original_site)?.id||sites[0]?.id||null;
    }
  }

  async function loadScope(){
    const r=await sb.rpc('my_manager_scope_departments_v21166');
    scopeRows=r.error?[]:(r.data||[]);
    let saved='';try{saved=localStorage.getItem(scopeKey())||''}catch(_e){}
    if(saved==='ALL'&&scopeRows.length>1)scopeSelection='ALL';
    else if(scopeRows.some(x=>x.department_id===saved))scopeSelection=saved;
    else if(scopeRows.length>1)scopeSelection='ALL';
    else scopeSelection=scopeRows[0]?.department_id||'ALL';
  }
  function activeScopeIds(){
    if(scopeSelection==='ALL')return scopeRows.map(x=>x.department_id);
    return scopeRows.some(x=>x.department_id===scopeSelection)?[scopeSelection]:scopeRows.slice(0,1).map(x=>x.department_id);
  }
  function scopeLabel(){
    const ids=activeScopeIds();
    if(scopeSelection==='ALL'&&ids.length>1)return 'All managed departments';
    return departmentName(ids[0])||'Department';
  }
  async function setScope(value){
    scopeSelection=value;
    try{localStorage.setItem(scopeKey(),value)}catch(_e){}
    decorateManagerBanner();
    await window.SafetyPackTbtManagerV21164?.reload?.();
    await window.SafetyDocumentSetReviewV21165?.reload?.();
    decorateManagerBanner();decoratePeopleUi();
    toast(`Manager scope: ${scopeLabel()}.`);
  }

  window.SafetyDepartmentScopeV21166={
    activeIds:activeScopeIds,
    label:scopeLabel,
    rows:()=>scopeRows.slice(),
    selected:()=>scopeSelection,
    set:setScope,
    reload:async()=>{await loadScope();decorateManagerBanner()}
  };

  function decorateManagerBanner(){
    const managerMode=String(state?.profile?.role||'').toLowerCase()==='manager'||(String(state?.profile?.role||'').toLowerCase()==='admin'&&state?.uiMode==='manager');
    const banner=$('managerModeBannerV21164');
    if(!managerMode||!banner||scopeRows.length<2){$('managerScopePickerV21166')?.remove();return}
    let wrap=$('managerScopePickerV21166');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='managerScopePickerV21166';wrap.className='manager-scope-picker-v21166';banner.appendChild(wrap);
    }
    wrap.innerHTML=`<label><strong>Department scope</strong><select id="managerScopeSelectV21166"><option value="ALL" ${scopeSelection==='ALL'?'selected':''}>All managed / overseen departments</option>${scopeRows.map(x=>`<option value="${esc(x.department_id)}" ${scopeSelection===x.department_id?'selected':''}>${esc(x.department_name)}${x.is_hod?' · HOD':''}${x.is_operational_overseer?' · oversight':''}</option>`).join('')}</select></label><small>HOD responsibility remains with each department's official HOD. Operational oversight adds access; it does not replace the HOD.</small>`;
    $('managerScopeSelectV21166')?.addEventListener('change',e=>setScope(e.target.value));
  }

  function roleValue(p,ma){return String(ma?.role_override||(p?.report_only?'viewer':p?.role)||'user').toLowerCase()}
  function roleOptions(selected){return `<option value="user" ${selected==='user'?'selected':''}>User</option><option value="manager" ${selected==='manager'?'selected':''}>Manager</option><option value="admin" ${selected==='admin'?'selected':''}>Admin</option><option value="viewer" ${selected==='viewer'?'selected':''}>Viewer / Reviewer</option>`}
  function viewOptions(selected){return `<option value="user" ${selected==='user'?'selected':''}>User</option><option value="full" ${selected==='full'?'selected':''}>Full role view</option><option value="viewer" ${selected==='viewer'?'selected':''}>Viewer</option>`}
  function departmentOptions(selected=''){return `<option value="">Not assigned</option>${departments.map(d=>`<option value="${esc(d.id)}" ${selected===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}`}
  function positionOptions(selected=''){return `<option value="">No main position</option>${positions.map(p=>`<option value="${esc(p.id)}" ${selected===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}`}
  function siteOptions(selected='',allowBlank=true){return `${allowBlank?'<option value="">No home site</option>':''}${sites.map(s=>`<option value="${esc(s.id)}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}`}

  function departmentChecks(selected=[],main=''){
    const set=new Set(selected||[]);
    return departments.filter(d=>d.id!==main).map(d=>`<label class="check-row"><input class="v21166-additional-department" type="checkbox" value="${esc(d.id)}" ${set.has(d.id)?'checked':''}> <span>${esc(d.name)}</span></label>`).join('')||'<span class="muted">No other departments.</span>';
  }
  function positionChecks(selected=[],main=''){
    const set=new Set(selected||[]);
    return positions.filter(p=>p.id!==main).map(p=>`<label class="check-row"><input class="v21166-additional-position" type="checkbox" value="${esc(p.id)}" ${set.has(p.id)?'checked':''}> <span>${esc(p.name)}</span></label>`).join('')||'<span class="muted">No other positions.</span>';
  }
  function oversightChecks(selected=[]){
    const set=new Set(selected||[]);
    return departments.map(d=>{
      const hod=responsibilities.find(r=>r.department_id===d.id&&r.active!==false&&r.responsibility_type==='DEPARTMENT_MANAGER');
      return `<label class="check-row"><input class="v21166-overseer-department" type="checkbox" value="${esc(d.id)}" ${set.has(d.id)?'checked':''}> <span><strong>${esc(d.name)}</strong>${hod?` <span class="muted">· HOD: ${esc(personName(hod.user_id))}</span>`:' <span class="muted">· HOD not assigned</span>'}</span></label>`;
    }).join('');
  }
  function siteChecks(userId,selectedIds=[],home=''){
    const selected=new Set(selectedIds||[]);
    return sites.map(s=>`<label class="check-row"><input class="v21166-site" type="checkbox" value="${esc(s.id)}" ${selected.has(s.id)||home===s.id?'checked':''}> <span>${esc(s.name)}${home===s.id?' <span class="muted">· home</span>':''}</span></label>`).join('')||'<span class="muted">No sites configured.</span>';
  }

  async function structureFor(userId){
    const r=await sb.rpc('person_structure_v21166',{p_user_id:userId});
    if(r.error)throw r.error;
    return r.data||{};
  }

  async function openPersonEditor(userId){
    if(!isAdmin())return;
    await loadData();
    const p=profileById(userId);if(!p)return toast('User not found.');
    let st={};try{st=await structureFor(userId)}catch(e){return toast(e.message||'Could not load person setup.')}
    const ma=moduleFor(userId)||{};
    const role=roleValue(p,ma),view=ma.preferred_view||(['admin','manager'].includes(role)?'full':role==='viewer'?'viewer':'user');
    const home=ma.home_site_id||siteRowsFor(userId).find(x=>x.is_home)?.site_id||null;
    const assignedSites=siteRowsFor(userId).map(x=>x.site_id);
    const mainDep=st.primary_department_id||mainDepartmentFor(userId)||'';
    const addDeps=st.additional_department_ids||userDepartments.filter(x=>x.user_id===userId&&!x.is_primary).map(x=>x.department_id);
    const mainPos=st.primary_position_id||mainPositionFor(userId)||'';
    const addPos=st.additional_position_ids||userPositions.filter(x=>x.user_id===userId&&x.active!==false&&!x.is_primary).map(x=>x.position_id);
    const over=st.operational_overseer_department_ids||oversightFor(userId);
    const hod=!!st.is_hod;
    const trainer=!!st.can_carry_out_training;
    const existingHod=mainDep?responsibilities.find(x=>x.department_id===mainDep&&x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER'):null;

    openModal('Person setup & access',`<div class="section-card"><div class="row-between"><div><h3>${esc(p.display_name||p.email||p.login_username||'User')}</h3><div class="meta">${p.email?`<span>${esc(p.email)}</span>`:''}${p.login_username?`<span>Username: ${esc(p.login_username)}</span>`:''}</div></div><span class="badge ${p.active!==false?'complete':'neutral'}">${p.active!==false?'Active':'Disabled'}</span></div></div>
      <div class="section-card v21166-editor-section"><h4>1 · Access & site</h4><div class="form-grid">
        <label class="check-row"><input id="v21166Enabled" type="checkbox" ${ma.enabled!==false&&p.active!==false?'checked':''}> Safety Tracker access</label>
        <label>Role<select id="v21166Role">${roleOptions(role)}</select></label>
        <label>Default working view<select id="v21166View">${viewOptions(view)}</select></label>
        <label>Home site<select id="v21166HomeSite">${siteOptions(home,true)}</select><span class="muted">New users default to the site they are created from.</span></label>
      </div><details><summary>Additional site access</summary><div class="checkbox-list v21166-check-list">${siteChecks(userId,assignedSites,home)}</div></details></div>

      <div class="section-card v21166-editor-section"><h4>2 · Department</h4><p class="muted">Department is selected directly. Changing a job position will not silently move the person to another department.</p><div class="form-grid">
        <label>Main Department<select id="v21166MainDepartment">${departmentOptions(mainDep)}</select></label>
      </div><details ${addDeps.length?'open':''}><summary>Additional Departments</summary><div id="v21166AdditionalDepartments" class="checkbox-list v21166-check-list">${departmentChecks(addDeps,mainDep)}</div></details></div>

      <div class="section-card v21166-editor-section"><h4>3 · Position / title</h4><p class="muted">Position describes the person's job. It does not control their Department after this profile is saved.</p><div class="form-grid">
        <label>Main Position<select id="v21166MainPosition">${positionOptions(mainPos)}</select></label>
      </div><details ${addPos.length?'open':''}><summary>Additional Positions</summary><div id="v21166AdditionalPositions" class="checkbox-list v21166-check-list">${positionChecks(addPos,mainPos)}</div></details></div>

      <div class="section-card v21166-editor-section"><h4>4 · Responsibilities & permissions</h4>
        <label class="check-row"><input id="v21166Hod" type="checkbox" ${hod?'checked':''}> <span><strong>Official Head of Department (HOD)</strong><small>One official HOD per Department. Uses the Main Department above.</small></span></label>
        <div id="v21166HodWarning" class="hint-box" ${existingHod&&existingHod.user_id!==userId?'':'hidden'}>${existingHod&&existingHod.user_id!==userId?`Current HOD for ${esc(departmentName(mainDep))}: <strong>${esc(personName(existingHod.user_id))}</strong>. Saving with HOD ticked will replace them.`:''}</div>
        <label class="check-row"><input id="v21166Overseer" type="checkbox" ${over.length?'checked':''}> <span><strong>Operational Overseer</strong><small>Extra management access for selected Departments. Does not replace their HOD.</small></span></label>
        <div id="v21166OverseerDepartments" class="checkbox-list v21166-check-list" ${over.length?'':'hidden'}>${oversightChecks(over)}</div>
        <label class="check-row"><input id="v21166Trainer" type="checkbox" ${trainer?'checked':''}> <span><strong>Can carry out instructor-led training</strong><small>Allows authorised instructor-led delivery and the audited creator/uploader self-completion exception.</small></span></label>
      </div>

      <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21166-save-person="${esc(userId)}">Save person</button></div>`);
    wirePersonEditor(userId);
  }

  function wirePersonEditor(userId){
    const dep=$('v21166MainDepartment'),pos=$('v21166MainPosition'),over=$('v21166Overseer'),role=$('v21166Role'),home=$('v21166HomeSite');
    dep?.addEventListener('change',()=>{
      const selected=[...document.querySelectorAll('.v21166-additional-department:checked')].map(x=>x.value);
      const root=$('v21166AdditionalDepartments');if(root)root.innerHTML=departmentChecks(selected,dep.value);
      refreshHodWarning(userId);
    });
    pos?.addEventListener('change',()=>{
      const selected=[...document.querySelectorAll('.v21166-additional-position:checked')].map(x=>x.value);
      const root=$('v21166AdditionalPositions');if(root)root.innerHTML=positionChecks(selected,pos.value);
    });
    over?.addEventListener('change',()=>{const root=$('v21166OverseerDepartments');if(root)root.hidden=!over.checked});
    role?.addEventListener('change',syncViewerResponsibilityState);syncViewerResponsibilityState();
    home?.addEventListener('change',()=>{
      if(!home.value)return;
      const c=document.querySelector(`.v21166-site[value="${CSS.escape(home.value)}"]`);if(c)c.checked=true;
    });
  }
  function syncViewerResponsibilityState(){
    const viewer=$('v21166Role')?.value==='viewer';
    for(const id of ['v21166Hod','v21166Overseer','v21166Trainer']){const el=$(id);if(el){if(viewer)el.checked=false;el.disabled=viewer}}
    const root=$('v21166OverseerDepartments');if(root)root.hidden=viewer||!$('v21166Overseer')?.checked;
  }
  function refreshHodWarning(userId){
    const dep=$('v21166MainDepartment')?.value||'',box=$('v21166HodWarning');if(!box)return;
    const h=responsibilities.find(x=>x.department_id===dep&&x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER');
    if(h&&h.user_id!==userId){box.hidden=false;box.innerHTML=`Current HOD for ${esc(departmentName(dep))}: <strong>${esc(personName(h.user_id))}</strong>. Saving with HOD ticked will replace them.`}
    else{box.hidden=true;box.textContent=''}
  }

  async function savePerson(userId,btn){
    if(!isAdmin())return;
    const enabled=!!$('v21166Enabled')?.checked,role=$('v21166Role')?.value||'user',view=$('v21166View')?.value||'user',home=$('v21166HomeSite')?.value||null;
    const mainDepartment=$('v21166MainDepartment')?.value||null,additionalDepartments=[...document.querySelectorAll('.v21166-additional-department:checked')].map(x=>x.value);
    const mainPosition=$('v21166MainPosition')?.value||null,additionalPositions=[...document.querySelectorAll('.v21166-additional-position:checked')].map(x=>x.value);
    const isHod=role!=='viewer'&&!!$('v21166Hod')?.checked;
    const over=role!=='viewer'&&$('v21166Overseer')?.checked?[...document.querySelectorAll('.v21166-overseer-department:checked')].map(x=>x.value):[];
    const trainer=role!=='viewer'&&!!$('v21166Trainer')?.checked;
    const selectedSites=new Set([...document.querySelectorAll('.v21166-site:checked')].map(x=>x.value));if(home)selectedSites.add(home);
    if(isHod&&!mainDepartment)return toast('Choose a Main Department before making this person HOD.');
    if(!mainPosition&&additionalPositions.length)return toast('Choose a Main Position before adding additional positions.');
    const currentHod=mainDepartment?responsibilities.find(x=>x.department_id===mainDepartment&&x.active!==false&&x.responsibility_type==='DEPARTMENT_MANAGER'):null;
    if(isHod&&currentHod&&currentHod.user_id!==userId&&!confirm(`${personName(currentHod.user_id)} is currently HOD for ${departmentName(mainDepartment)}. Replace them?`))return;

    btn.disabled=true;const old=btn.textContent;btn.textContent='Saving…';
    try{
      let r=await sb.rpc('set_safety_user_access_v21137',{p_user_id:userId,p_enabled:enabled,p_role:role,p_preferred_view:view,p_home_site_id:home});if(r.error)throw r.error;
      for(const s of sites){
        const creatorLocked=s.created_by===userId;
        r=await sb.rpc('set_safety_site_access_v21137',{p_user_id:userId,p_site_id:s.id,p_enabled:enabled&&(selectedSites.has(s.id)||creatorLocked),p_role_override:role,p_is_home:enabled&&s.id===home});if(r.error)throw r.error;
      }
      r=await sb.rpc('save_person_structure_v21166',{
        p_user_id:userId,
        p_primary_department_id:mainDepartment,
        p_additional_department_ids:additionalDepartments,
        p_primary_position_id:mainPosition,
        p_additional_position_ids:additionalPositions,
        p_is_hod:isHod,
        p_operational_overseer_department_ids:over,
        p_can_carry_out_training:trainer
      });if(r.error)throw r.error;
      closeModal();await loadData();await loadScope();await refreshPeopleSurface();await window.SafetyPackTbtManagerV21164?.reload?.();await window.SafetyDocumentSetReviewV21165?.reload?.();decorateManagerBanner();toast('Person, Department, Position and responsibilities updated.');
    }catch(e){btn.disabled=false;btn.textContent=old;toast(e?.message||'Could not save person setup.')}
  }

  function generatedPassword(){const w=['Harbour','Maple','River','Copper','Oak','Stone','Blue','Glass'];return `${w[Math.floor(Math.random()*w.length)]}-${Math.floor(1000+Math.random()*9000)}-${w[Math.floor(Math.random()*w.length)]}!`}
  function suggestedUsername(v){const base=clean(v||'user').toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,40);return base.length>=3?base:`user${Math.floor(1000+Math.random()*9000)}`}
  function defaultCreateSite(){return currentSiteId||moduleFor(state?.user?.id)?.home_site_id||sites.find(x=>x.is_original_site)?.id||sites[0]?.id||''}

  function newPersonStructureHtml(seed={}){
    const site=defaultCreateSite(),username=suggestedUsername(seed.login_username||seed.display_name||seed.email?.split('@')[0]||'user'),password=generatedPassword(),hasEmail=!!clean(seed.email);
    return `<div class="section-card"><h3>${seed.source_user_id?'Give this app user Safety access':'Create new Safety person'}</h3><p class="muted">The new account defaults to <strong>${esc(departmentName('')&&site?sites.find(x=>x.id===site)?.name||'the current site':'the current site')}</strong>. You can add other sites now or later.</p></div>
      <div class="section-card"><h4>1 · Account</h4><div class="form-grid">
        <label>Display name<input id="v21166NewName" value="${esc(seed.display_name||'')}"></label>
        <label>Email<input id="v21166NewEmail" type="email" value="${esc(seed.email||'')}"></label>
        <label>Role<select id="v21166NewRole">${roleOptions('user')}</select></label>
        <label>Default working view<select id="v21166NewView">${viewOptions('user')}</select></label>
        <label>Home site<select id="v21166NewHome">${siteOptions(site,false)}</select></label>
      </div>
      <div class="form-grid"><label class="check-row"><input type="radio" name="v21166LoginMethod" value="email" ${hasEmail?'checked':''}> Email invitation</label><label class="check-row"><input type="radio" name="v21166LoginMethod" value="username" ${hasEmail?'':'checked'}> Username + temporary password</label></div>
      <div id="v21166UsernameFields" class="form-grid" ${hasEmail?'hidden':''}><label>Username<input id="v21166NewUsername" value="${esc(username)}"></label><label>Temporary password<input id="v21166NewPassword" value="${esc(password)}"></label></div>
      <details><summary>Additional site access</summary><div class="checkbox-list v21166-check-list">${sites.map(s=>`<label class="check-row"><input class="v21166-new-site" type="checkbox" value="${esc(s.id)}" ${s.id===site?'checked':''}> ${esc(s.name)}</label>`).join('')}</div></details></div>
      <div class="section-card"><h4>2 · Department</h4><div class="form-grid"><label>Main Department<select id="v21166NewDepartment">${departmentOptions('')}</select></label></div><details><summary>Additional Departments</summary><div id="v21166NewAdditionalDepartments" class="checkbox-list v21166-check-list">${departmentChecks([], '')}</div></details></div>
      <div class="section-card"><h4>3 · Position / title</h4><p class="muted">Position does not control Department.</p><div class="form-grid"><label>Main Position<select id="v21166NewPosition">${positionOptions('')}</select></label></div><details><summary>Additional Positions</summary><div id="v21166NewAdditionalPositions" class="checkbox-list v21166-check-list">${positionChecks([], '')}</div></details></div>
      <div class="section-card"><h4>4 · Responsibilities</h4><label class="check-row"><input id="v21166NewHod" type="checkbox"> Official HOD of Main Department</label><label class="check-row"><input id="v21166NewOverseer" type="checkbox"> Operational Overseer</label><div id="v21166NewOverseerDepartments" class="checkbox-list v21166-check-list" hidden>${oversightChecks([])}</div><label class="check-row"><input id="v21166NewTrainer" type="checkbox"> Can carry out instructor-led training</label></div>
      <div class="actions"><button class="ghost" type="button" data-close-modal>Cancel</button><button class="primary" type="button" data-v21166-create-person-save data-source-id="${esc(seed.source_user_id||'')}">Create person</button></div>`;
  }

  async function openCreatePerson(seed={}){
    if(!isAdmin())return;await loadData();openModal(seed.source_user_id?'Give Safety access':'Create new person',newPersonStructureHtml(seed));
    const loginSync=()=>{const method=document.querySelector('input[name="v21166LoginMethod"]:checked')?.value||'email';const fields=$('v21166UsernameFields');if(fields)fields.hidden=method!=='username'};
    document.querySelectorAll('input[name="v21166LoginMethod"]').forEach(x=>x.addEventListener('change',loginSync));loginSync();
    $('v21166NewDepartment')?.addEventListener('change',e=>{const root=$('v21166NewAdditionalDepartments');if(root)root.innerHTML=departmentChecks([...root.querySelectorAll('input:checked')].map(x=>x.value),e.target.value)});
    $('v21166NewPosition')?.addEventListener('change',e=>{const root=$('v21166NewAdditionalPositions');if(root)root.innerHTML=positionChecks([...root.querySelectorAll('input:checked')].map(x=>x.value),e.target.value)});
    $('v21166NewOverseer')?.addEventListener('change',e=>{const root=$('v21166NewOverseerDepartments');if(root)root.hidden=!e.target.checked});
    $('v21166NewRole')?.addEventListener('change',()=>{const viewer=$('v21166NewRole').value==='viewer';for(const id of ['v21166NewHod','v21166NewOverseer','v21166NewTrainer']){const el=$(id);if(el){if(viewer)el.checked=false;el.disabled=viewer}}const root=$('v21166NewOverseerDepartments');if(root)root.hidden=viewer||!$('v21166NewOverseer')?.checked});
    $('v21166NewHome')?.addEventListener('change',e=>{const c=document.querySelector(`.v21166-new-site[value="${CSS.escape(e.target.value)}"]`);if(c)c.checked=true});
  }

  async function createPerson(btn){
    const name=clean($('v21166NewName')?.value),email=clean($('v21166NewEmail')?.value),role=$('v21166NewRole')?.value||'user',view=$('v21166NewView')?.value||'user',home=$('v21166NewHome')?.value||defaultCreateSite();
    const method=document.querySelector('input[name="v21166LoginMethod"]:checked')?.value||(email?'email':'username');
    const username=clean($('v21166NewUsername')?.value)||suggestedUsername(name||email),password=$('v21166NewPassword')?.value||generatedPassword();
    const mainDepartment=$('v21166NewDepartment')?.value||null,additionalDepartments=[...document.querySelectorAll('#v21166NewAdditionalDepartments input:checked')].map(x=>x.value);
    const mainPosition=$('v21166NewPosition')?.value||null,additionalPositions=[...document.querySelectorAll('#v21166NewAdditionalPositions input:checked')].map(x=>x.value);
    const isHod=role!=='viewer'&&!!$('v21166NewHod')?.checked,over=role!=='viewer'&&$('v21166NewOverseer')?.checked?[...document.querySelectorAll('#v21166NewOverseerDepartments input:checked')].map(x=>x.value):[],trainer=role!=='viewer'&&!!$('v21166NewTrainer')?.checked;
    const selectedSites=new Set([...document.querySelectorAll('.v21166-new-site:checked')].map(x=>x.value));if(home)selectedSites.add(home);
    if(!name)return toast('Enter the person\'s name.');
    if(method==='email'&&!email)return toast('Enter an email address or choose Username + temporary password.');
    if(isHod&&!mainDepartment)return toast('Choose a Main Department before making this person HOD.');
    if(!mainPosition&&additionalPositions.length)return toast('Choose a Main Position before adding additional positions.');

    btn.disabled=true;const old=btn.textContent;btn.textContent='Creating…';
    try{
      const payload={action:'create',display_name:name,email:method==='email'?email:'',username:method==='username'?username:'',temporary_password:method==='username'?password:'',primary_role:role,apps:[{app:'safety',enabled:true,role,preferred_view:view,home_site_id:home||null}],redirect_to:`${location.origin}${location.pathname}?set-password=1`};
      const fr=await sb.functions.invoke('manage-user-access-v21137',{body:payload});if(fr.error)throw fr.error;if(fr.data?.error)throw new Error(fr.data.error);const userId=fr.data?.user_id;if(!userId)throw new Error('Safety account was not returned.');
      const sourceId=btn.dataset.sourceId||'';
      if(sourceId){const link=await sb.rpc('link_shared_user_to_safety_v21149',{p_source_user_id:sourceId,p_safety_user_id:userId});if(link.error)throw link.error}
      let r=await sb.rpc('set_safety_user_access_v21137',{p_user_id:userId,p_enabled:true,p_role:role,p_preferred_view:view,p_home_site_id:home||null});if(r.error)throw r.error;
      if(!home){const dr=await sb.rpc('default_new_safety_user_site_v21166',{p_user_id:userId,p_role:role,p_preferred_view:view});if(dr.error)throw dr.error;currentSiteId=dr.data||currentSiteId}
      const finalHome=home||currentSiteId;
      if(finalHome)selectedSites.add(finalHome);
      for(const s of sites){r=await sb.rpc('set_safety_site_access_v21137',{p_user_id:userId,p_site_id:s.id,p_enabled:selectedSites.has(s.id),p_role_override:role,p_is_home:s.id===finalHome});if(r.error)throw r.error}
      r=await sb.rpc('save_person_structure_v21166',{p_user_id:userId,p_primary_department_id:mainDepartment,p_additional_department_ids:additionalDepartments,p_primary_position_id:mainPosition,p_additional_position_ids:additionalPositions,p_is_hod:isHod,p_operational_overseer_department_ids:over,p_can_carry_out_training:trainer});if(r.error)throw r.error;
      await loadData();await refreshPeopleSurface();
      if(method==='username'){
        openModal('Safety access created',`<div class="success-note"><strong>Account created for ${esc(name)}.</strong></div><div class="section-card"><p><strong>Username:</strong> ${esc(username)}</p><p><strong>Temporary password:</strong> ${esc(password)}</p><p><strong>Home site:</strong> ${esc(sites.find(x=>x.id===finalHome)?.name||'Current site')}</p><p class="muted">Give the temporary password to the user securely. They should change it after signing in.</p></div><div class="actions"><button class="primary" type="button" data-close-modal>Done</button></div>`);
      }else{closeModal();toast(`Safety invitation created. Home site: ${sites.find(x=>x.id===finalHome)?.name||'current site'}.`)}
    }catch(e){btn.disabled=false;btn.textContent=old;toast(e?.message||'Could not create person.')}
  }

  function linkedSafetyId(sourceId){return sharedLinks.find(x=>x.source_user_id===sourceId)?.safety_user_id||null}
  function resolvedSafetyUser(u){
    const linked=linkedSafetyId(u.source_user_id);if(linked)return profileById(linked);
    const email=norm(u.email),username=norm(u.login_username);
    return profiles.find(p=>(email&&norm(p.email)===email)||(username&&norm(p.login_username)===username))||null;
  }
  async function openSharedPerson(sourceId){
    await loadData();const u=sharedUsers.find(x=>x.source_user_id===sourceId);if(!u)return toast('App user not found.');const p=resolvedSafetyUser(u);if(p)return openPersonEditor(p.id);return openCreatePerson(u);
  }

  function decoratePeopleUi(){
    const root=$('peopleV21149View')||$('peopleV21148View')||$('peopleV21146View')||$('peopleV21145View');if(!root)return;
    const create=root.querySelector('[data-v21149-create-safety],[data-v21148-create-safety],[data-v21146-create-safety],[data-v21145-create-safety-user]');
    if(create){['v21149CreateSafety','v21148CreateSafety','v21146CreateSafety','v21145CreateSafetyUser'].forEach(k=>delete create.dataset[k]);create.dataset.v21166CreatePerson='1';create.textContent='Create new person'}
    root.querySelectorAll('[data-v21149-edit-safety],[data-v21148-edit-safety]').forEach(b=>{
      const id=b.dataset.v21149EditSafety||b.dataset.v21148EditSafety;delete b.dataset.v21149EditSafety;delete b.dataset.v21148EditSafety;b.dataset.v21166EditPerson=id;b.textContent='Edit person';
    });
    root.querySelectorAll('[data-v21149-edit-shared],[data-v21148-edit-shared]').forEach(b=>{
      const id=b.dataset.v21149EditShared||b.dataset.v21148EditShared;delete b.dataset.v21149EditShared;delete b.dataset.v21148EditShared;b.dataset.v21166EditShared=id;b.textContent=b.textContent.includes('Give')?'Give Safety access':'Edit person';
    });
    root.querySelectorAll('.profile-permissions-v21158').forEach(x=>x.remove());
    root.querySelectorAll('[data-v21166-edit-person]').forEach(b=>{
      const p=profileById(b.dataset.v21166EditPerson),card=b.closest('.item-card');if(!p||!card)return;
      let row=card.querySelector('.v21166-person-summary');if(!row){row=document.createElement('div');row.className='meta v21166-person-summary';b.closest('.row-between')?.querySelector('div')?.appendChild(row)}
      const dep=mainDepartmentFor(p.id),pos=mainPositionFor(p.id),hod=hodDepartmentFor(p.id),over=oversightFor(p.id);
      if(row)row.innerHTML=`${dep?`<span>Main Department: ${esc(departmentName(dep))}</span>`:'<span class="badge due">No Main Department</span>'}${pos?`<span>Position: ${esc(positionName(pos))}</span>`:''}${hod?'<span class="badge complete">HOD</span>':''}${over.length?`<span>Operational oversight: ${esc(over.map(departmentName).join(', '))}</span>`:''}`;
    });
  }

  function updateAdminResponsibilityCopy(){
    const card=$('positionsResponsibilities69');if(!card)return;
    const heading=[...card.querySelectorAll('h4')].find(h=>/heads of department/i.test(h.textContent||''));const section=heading?.closest('.section-card');if(!section)return;
    let note=section.querySelector('.v21166-responsibility-note');if(!note){note=document.createElement('div');note.className='hint-box v21166-responsibility-note';section.insertAdjacentElement('afterbegin',note)}
    note.innerHTML='<strong>Simplified responsibility setup:</strong> set Main Department, Position, official HOD, Operational Overseer departments and instructor permission from <strong>People & Access → Edit person</strong>. Position no longer silently changes Department.';
    [...section.querySelectorAll('p.muted')].forEach(p=>{if(/Main\/Default position chooses the department automatically/i.test(p.textContent||''))p.hidden=true});
  }

  async function refreshPeopleSurface(){
    try{await window.SafetyPeopleSitesV21149?.openPeople?.()}catch(_e){}
    [30,120,300].forEach(ms=>setTimeout(decoratePeopleUi,ms));
    try{await window.SafetyProfilePermissionsV21158?.refresh?.()}catch(_e){}
    setTimeout(decoratePeopleUi,80);
  }

  function installObservers(){
    const attach=()=>{
      const root=$('peopleV21149Content')||$('peopleV21148Content')||$('peopleV21146Content')||$('peopleV21145Content');
      if(!root||peopleObserver)return;
      peopleObserver=new MutationObserver(()=>{decoratePeopleUi()});peopleObserver.observe(root,{childList:true,subtree:true});
    };
    [100,300,700,1400].forEach(ms=>setTimeout(()=>{attach();decoratePeopleUi();decorateManagerBanner();updateAdminResponsibilityCopy()},ms));
  }

  function installStyles(){
    if($('peopleScopeStylesV21166'))return;const s=document.createElement('style');s.id='peopleScopeStylesV21166';s.textContent=`
      #peopleV21149View .profile-permissions-v21158,#peopleV21148View .profile-permissions-v21158{display:none!important}
      .v21166-editor-section{margin-top:12px}
      .v21166-check-list{max-height:240px;overflow:auto;border:1px solid var(--border,#334155);border-radius:9px;padding:9px;margin-top:8px}
      .v21166-check-list .check-row{padding:7px 3px;border-bottom:1px solid var(--border,#334155)}
      .v21166-check-list .check-row:last-child{border-bottom:0}
      .manager-scope-picker-v21166{margin-top:8px;display:flex;gap:10px;align-items:end;flex-wrap:wrap}
      .manager-scope-picker-v21166 label{min-width:min(420px,100%);display:grid;gap:4px}
      .manager-scope-picker-v21166 select{min-height:42px}
      .manager-scope-picker-v21166 small{max-width:720px}
      .v21166-person-summary{margin-top:6px}
      @media(max-width:720px){.manager-scope-picker-v21166{display:block}.manager-scope-picker-v21166 label{width:100%}.v21166-editor-section .form-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }

  function installEvents(){
    window.addEventListener('click',e=>{
      const edit=e.target.closest?.('[data-v21166-edit-person]');if(edit){e.preventDefault();e.stopImmediatePropagation();openPersonEditor(edit.dataset.v21166EditPerson);return}
      const shared=e.target.closest?.('[data-v21166-edit-shared]');if(shared){e.preventDefault();e.stopImmediatePropagation();openSharedPerson(shared.dataset.v21166EditShared);return}
      if(e.target.closest?.('[data-v21166-create-person],#inviteUserBtn')){e.preventDefault();e.stopImmediatePropagation();openCreatePerson();return}
      const save=e.target.closest?.('[data-v21166-save-person]');if(save){e.preventDefault();e.stopImmediatePropagation();savePerson(save.dataset.v21166SavePerson,save);return}
      const create=e.target.closest?.('[data-v21166-create-person-save]');if(create){e.preventDefault();e.stopImmediatePropagation();createPerson(create);return}
      if(e.target.closest?.('[data-v21149-people],#mainNav button[data-view="people"],[data-v21149-refresh-users],#mainNav button[data-view="admin"]')){
        [80,220,500].forEach(ms=>setTimeout(async()=>{await loadData();decoratePeopleUi();decorateManagerBanner();updateAdminResponsibilityCopy()},ms));
      }
      if(e.target.closest?.('#departmentManagerModeBtnV21164'))[120,300].forEach(ms=>setTimeout(()=>{decorateManagerBanner()},ms));
    },true);
    window.addEventListener('pageshow',()=>setTimeout(async()=>{await loadData();await loadScope();decoratePeopleUi();decorateManagerBanner();updateAdminResponsibilityCopy();await window.SafetyPackTbtManagerV21164?.reload?.();await window.SafetyDocumentSetReviewV21165?.reload?.()},260));
  }

  async function boot(){
    api=window.SafetyTrackerV2;if(!api?.state||!api?.sb){setTimeout(boot,120);return}state=api.state;sb=api.sb;if(!state.user)return;
    installStyles();await loadData();await loadScope();installEvents();installObservers();decoratePeopleUi();decorateManagerBanner();updateAdminResponsibilityCopy();
    await window.SafetyPackTbtManagerV21164?.reload?.();await window.SafetyDocumentSetReviewV21165?.reload?.();decorateManagerBanner();
    window.SafetyPeopleDepartmentScopeV21166={reload:async()=>{await loadData();await loadScope();decoratePeopleUi();decorateManagerBanner()},open:openPersonEditor,create:openCreatePerson};
  }
  boot().catch(e=>console.warn('Safety Tracker v2.11.66 People/Department/Operational Overseer',e));
})();
/* Safety Tracker v2.11.67 CLEAN
   Management navigation stability.
   - Management tab always opens the Management tile home.
   - Management detail tiles route explicitly without bouncing back to the tile home.
   - Every "← Management" control returns to the tile home deterministically.
   - Android/browser Back from Calendar / Reports / Knowledge returns to Management home first.
   - Removes duplicate legacy Management back buttons from view.
*/
'use strict';
(function(){
  if(window.__SAFETY_MANAGEMENT_NAV_V21167)return;
  window.__SAFETY_MANAGEMENT_NAV_V21167=true;

  let api=null,state=null,installed=false,bypassTop=false,detailSeq=0;
  const $=id=>document.getElementById(id);
  const manager=()=>{
    const p=state?.profile;
    if(!p||p.report_only===true)return false;
    const r=String(p.role||'').toLowerCase();
    return ['admin','manager'].includes(r) && !(r==='admin'&&(state?.offline||state?.uiMode==='user'));
  };

  function topButton(name){return document.querySelector(`#mainNav button[data-view="${name}"]`)}

  function activateViewDom(name){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active-view',v.id===name+'View'));
    document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  }

  function baseShow(name){
    try{
      if(typeof window.showView==='function'){
        window.showView(name);
        return true;
      }
    }catch(e){console.warn('v2.11.67 showView fallback',e)}
    const b=topButton(name);
    if(!b)return false;
    bypassTop=true;
    try{b.click()}finally{bypassTop=false}
    return true;
  }

  function removeHomeClasses(){
    const r=$('reportsView');
    if(!r)return;
    r.classList.remove('management-home-active-v21111','management-home-active-v21079');
    r.dataset.managementV21167='detail';
  }

  function ensureBackButtons(){
    if(!manager())return;
    ['reports','compliance','people','admin'].forEach(name=>{
      if(name==='admin'&&String(state?.profile?.role||'').toLowerCase()!=='admin')return;
      const view=$(name+'View');if(!view)return;
      let b=view.querySelector('.management-back-v21167');
      if(!b){
        b=document.createElement('button');
        b.type='button';
        b.className='secondary management-back-v21167';
        b.dataset.managementHomeV21167='1';
        b.textContent='← Management';
        const h=view.querySelector('.page-heading');
        if(h)h.insertAdjacentElement('afterend',b);else view.insertAdjacentElement('afterbegin',b);
      }
    });
  }

  function forceHome(){
    if(!manager())return;
    const r=$('reportsView');if(!r)return;
    try{window.SafetyManagementStableV21111?.render?.()}catch(_e){}
    activateViewDom('reports');
    r.classList.remove('management-home-active-v21079');
    r.classList.add('management-home-active-v21111');
    r.dataset.managementV21167='home';
    ensureBackButtons();
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(_e){}
  }

  function scheduleHome(){
    [0,30,100,240].forEach(ms=>setTimeout(forceHome,ms));
  }

  function openHome(){
    if(!manager())return;
    detailSeq++;
    try{
      if(history.state?.managementDetailV21167||history.state?.managementFromV21167){
        history.back();
        scheduleHome();
        return;
      }
    }catch(_e){}
    baseShow('reports');
    scheduleHome();
  }

  function scrollTarget(selector,seq){
    if(!selector)return;
    let tries=0;
    const tick=()=>{
      if(seq!==detailSeq)return;
      const el=document.querySelector(selector);
      if(el){
        try{el.scrollIntoView({behavior:'auto',block:'start'})}catch(_e){}
        return;
      }
      if(++tries<15)setTimeout(tick,80);
    };
    setTimeout(tick,20);
  }

  function pushSameViewDetail(kind){
    try{
      const st=history.state||{};
      if(st?.managementDetailV21167===kind)return;
      history.pushState({...st,safetyTracker:true,view:'reports',modal:false,guard:false,managementDetailV21167:kind},'',location.href);
    }catch(_e){}
  }

  function openReportsDetail(kind,selector){
    if(!manager())return;
    const seq=++detailSeq;
    baseShow('reports');
    [0,35,110,220].forEach(ms=>setTimeout(()=>{
      if(seq!==detailSeq)return;
      activateViewDom('reports');
      removeHomeClasses();
      ensureBackButtons();
    },ms));
    // Calendar / Reports / Knowledge all live inside reportsView. Give them their
    // own history entry so the device Back button returns to Management home first.
    setTimeout(()=>{if(seq===detailSeq)pushSameViewDetail(kind)},10);
    scrollTarget(selector,seq);
  }

  function openOtherView(name,selector=null){
    if(!manager())return;
    const seq=++detailSeq;
    baseShow(name);
    setTimeout(()=>{
      if(seq!==detailSeq)return;
      try{
        const st=history.state||{};
        history.replaceState({...st,managementFromV21167:true},'',location.href);
      }catch(_e){}
    },10);
    [0,40,120].forEach(ms=>setTimeout(()=>{
      if(seq!==detailSeq)return;
      activateViewDom(name);
      ensureBackButtons();
    },ms));
    scrollTarget(selector,seq);
  }

  function route(action,key){
    const a=String(action||'');
    if(a.startsWith('view:')){
      openOtherView(a.split(':')[1]);
      return;
    }
    if(a==='management:actions'){
      openOtherView('compliance','#unifiedSafetyActionsCardV21039');
      return;
    }
    if(a==='management:calendar'){
      openReportsDetail('calendar','#safetyCalendarCardV21043');
      return;
    }
    if(a==='management:reports'){
      openReportsDetail('reports','#reportsView .page-heading');
      return;
    }
    if(a==='management:knowledge'){
      openReportsDetail('knowledge','#knowledgeHubV21051');
      return;
    }
    console.warn('Safety v2.11.67 unknown Management route',a,key||'');
    try{api?.toast?.('That Management section could not be opened.')}catch(_e){}
  }

  function install(){
    if(installed)return;installed=true;
    ensureBackButtons();

    // Window capture is intentional: this is the single authoritative Management
    // router and therefore runs before older document-level Management handlers.
    window.addEventListener('click',e=>{
      const top=e.target.closest?.('#mainNav button[data-view="reports"]');
      if(top&&manager()&&!bypassTop){
        e.preventDefault();e.stopImmediatePropagation();
        openHome();
        return;
      }

      const back=e.target.closest?.(
        '[data-management-home-v21167],.management-back-v21167,'+
        '[data-management-stable-home],.management-back-v21111,'+
        '[data-management-home-v21079],.management-back-v21079,'+
        '[data-repair95-management-back]'
      );
      if(back&&manager()){
        e.preventDefault();e.stopImmediatePropagation();
        if(history.state?.managementDetailV21167||history.state?.managementFromV21167){
          history.back();
          setTimeout(forceHome,80);
        }else openHome();
        return;
      }

      const tile=e.target.closest?.('[data-management-stable-action],[data-management-tile-action]');
      if(tile&&manager()){
        e.preventDefault();e.stopImmediatePropagation();
        const action=tile.dataset.managementStableAction||tile.dataset.managementTileAction||'';
        const key=tile.dataset.managementStableKey||tile.dataset.managementTileKey||'';
        route(action,key);
        return;
      }
    },true);

    window.addEventListener('popstate',()=>{
      // Core navigation owns the actual history transition. Once it has restored
      // reportsView, make reports=Management home for Manager/Admin accounts.
      setTimeout(()=>{
        if(!manager())return;
        const st=history.state;
        if(st?.view==='reports'&&!st?.managementDetailV21167)forceHome();
      },0);
      setTimeout(()=>{
        if(!manager())return;
        const st=history.state;
        if(st?.view==='reports'&&!st?.managementDetailV21167)forceHome();
      },100);
    });

    window.addEventListener('pageshow',()=>setTimeout(()=>{
      ensureBackButtons();
      const r=$('reportsView');
      if(r?.classList.contains('active-view')&&!history.state?.managementDetailV21167)forceHome();
    },180));

    const style=document.createElement('style');
    style.id='managementNavigationStylesV21167';
    style.textContent=`
      .management-back-v21079,.management-back-v21111,[data-repair95-management-back]{display:none!important}
      .management-back-v21167{margin:0 0 14px}
      #reportsView.management-home-active-v21111>.management-back-v21167{display:none!important}
    `;
    document.head.appendChild(style);

    window.SafetyManagementNavigationV21167={home:openHome,route,repair:()=>{ensureBackButtons();forceHome()}};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state){setTimeout(boot,100);return}
    state=api.state;
    if(!state.user){setTimeout(boot,160);return}
    install();
  }
  boot();
})();
