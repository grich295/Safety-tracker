/* Safety Tracker v2.11.50 CLEAN
   Help refresh + obvious PPE setup.
   - Replaces the stale role-help content with current app workflows.
   - Removes obsolete Viewer Access setup help.
   - Adds a first-class PPE Setup shortcut in Admin and on Monthly PPE Checks.
   - Adds a standalone PPE Setup screen: Department enable/responsibility -> PPE catalogue/audience -> monthly checks.
   - No whole-page MutationObserver.
*/
'use strict';
(function(){
  if(window.__SAFETY_HELP_PPE_V21150)return;
  window.__SAFETY_HELP_PPE_V21150=true;

  let api,state;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const role=()=>String(state?.profile?.role||'user').toLowerCase();
  const admin=()=>role()==='admin'&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const manager=()=>['admin','manager'].includes(role())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';

  function toast(msg){try{api?.toast?.(msg)}catch(_e){console.log(msg)}}
  function person(id){
    const p=(state?.people||[]).find(x=>x.id===id);
    return p?.display_name||p?.email||p?.login_username||'Not assigned';
  }
  function activeDepartments(){
    return [...(state?.departments||[])].filter(d=>d.active!==false)
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }
  function canManageDepartment(id){
    if(admin())return true;
    const rs=state?.responsibilities69||[];
    if(rs.some(r=>r.active!==false&&r.responsibility_type==='HS_MANAGER'&&!r.department_id&&r.user_id===state?.user?.id))return true;
    return rs.some(r=>r.active!==false&&r.responsibility_type==='DEPARTMENT_MANAGER'&&r.department_id===id&&r.user_id===state?.user?.id);
  }

  function goView(view){
    const nav=document.querySelector(`#mainNav button[data-view="${view}"]`);
    if(nav){nav.click();return true}
    return false;
  }

  /* ---------------- PPE SETUP ---------------- */
  function ensurePpeSetupView(){
    let v=$('ppeSetupV21150View');
    if(v)return v;
    v=document.createElement('section');
    v.id='ppeSetupV21150View';
    v.className='view';
    v.innerHTML=`
      <div class="page-heading">
        <div>
          <h2>PPE Setup</h2>
          <p class="muted">One place to configure Department responsibility, PPE items, assignments and monthly checks.</p>
        </div>
      </div>
      <button class="secondary ppe-setup-back-v21150" type="button" data-v21150-ppe-back>← Admin / Management</button>
      <div id="ppeSetupContentV21150"></div>`;
    ($('appView')||document.querySelector('main')||document.body).appendChild(v);
    return v;
  }

  function departmentCards(){
    const deps=activeDepartments().filter(d=>admin()||canManageDepartment(d.id));
    if(!deps.length)return '<div class="empty">No Departments available for your current role.</div>';
    return deps.map(d=>{
      const on=d.ppe_enabled===true;
      const responsible=d.ppe_responsible_user_id?person(d.ppe_responsible_user_id):'Not assigned';
      return `<div class="item-card compact traffic-${on?(d.ppe_responsible_user_id?'green':'amber'):'neutral'}">
        <div class="row-between ppe-dept-row-v21150">
          <div>
            <strong>${esc(d.name)}</strong>
            <div class="meta">
              <span class="badge ${on?'complete':'neutral'}">PPE ${on?'ON':'OFF'}</span>
              <span>${on?`Responsible: ${esc(responsible)}`:'No monthly PPE responsibility for this Department'}</span>
            </div>
          </div>
          <button class="secondary" type="button" data-v21150-configure-ppe-dept="${esc(d.id)}">${on?'Edit setup':'Enable / setup'}</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderPpeSetup(){
    const root=$('ppeSetupContentV21150');if(!root)return;
    const deps=activeDepartments();
    const enabled=deps.filter(d=>d.ppe_enabled===true);
    const responsible=enabled.filter(d=>d.ppe_responsible_user_id);
    const ppeItems=(state?.ppeItems||[]).filter(x=>x.active!==false);
    const assignments=(state?.ppeAssignments||[]).filter(x=>x.active!==false);

    root.innerHTML=`
      <div class="stats-grid">
        <div class="stat traffic-${enabled.length?'green':'neutral'}"><span class="traffic-dot"></span><strong>${enabled.length}</strong><span>Departments with PPE ON</span></div>
        <div class="stat traffic-${enabled.length===responsible.length?'green':'amber'}"><span class="traffic-dot"></span><strong>${responsible.length}/${enabled.length}</strong><span>Responsible person set</span></div>
        <div class="stat traffic-${ppeItems.length?'green':'amber'}"><span class="traffic-dot"></span><strong>${ppeItems.length}</strong><span>Active PPE items</span></div>
      </div>

      <div class="section-card">
        <div class="ppe-step-v21150"><span>1</span><div><h3>Department PPE responsibility</h3><p>Turn PPE ON only for Departments that need it and choose the responsible person from that Department.</p></div></div>
        <div class="card-list">${departmentCards()}</div>
      </div>

      <div class="section-card">
        <div class="ppe-step-v21150"><span>2</span><div><h3>PPE catalogue & assignments</h3><p>Create the PPE items and assign them to Everyone, Departments or specific people. Those assignments drive the employee's monthly check.</p></div></div>
        <div class="meta"><span>${ppeItems.length} active PPE item${ppeItems.length===1?'':'s'}</span><span>${assignments.length} active assignment${assignments.length===1?'':'s'}</span></div>
        <div class="actions">
          ${admin()?'<button class="primary" type="button" data-v21150-ppe-catalogue>Manage PPE catalogue & assignments</button>':''}
          <button class="secondary" type="button" data-v21150-open-ppe>Open Monthly PPE Checks</button>
        </div>
      </div>

      <div class="section-card">
        <div class="ppe-step-v21150"><span>3</span><div><h3>Monthly checks</h3><p>Assigned employees complete their PPE availability/condition check by the 28th. Missing or replacement-required items stay in the action/order list until resolved.</p></div></div>
        <div class="hint-box"><strong>Simple rule:</strong> Department PPE ON decides who owns the Department PPE process. The PPE catalogue/audience decides which PPE each person actually checks.</div>
      </div>

      <div class="section-card">
        <h3>Related setup</h3>
        <div class="actions">
          ${admin()?'<button class="secondary" type="button" data-v21150-open-departments>Departments</button>':''}
          <button class="secondary" type="button" data-v21150-open-first-aid>First Aid / Eye Wash setup</button>
        </div>
      </div>`;
  }

  function openPpeSetup(){
    if(!manager())return toast('PPE setup is available to Managers and Admin.');
    ensurePpeSetupView();
    renderPpeSetup();
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
    $('ppeSetupV21150View')?.classList.add('active-view');
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_e){}
  }

  function addPpeSetupShortcuts(){
    if(!manager())return;

    // Admin landing shortcut beside Sites/People.
    const box=$('adminShortcutsV21149');
    if(box&&!box.querySelector('[data-v21150-open-ppe-setup]')){
      const b=document.createElement('button');
      b.type='button';b.className='admin-shortcut-v21149';
      b.dataset.v21150OpenPpeSetup='1';
      b.innerHTML='<strong>PPE Setup</strong><small>Department PPE, responsible person, catalogue and assignments.</small>';
      box.appendChild(b);
    }

    // Monthly PPE page button.
    const head=document.querySelector('#ppeView .page-heading');
    if(head&&!head.querySelector('[data-v21150-open-ppe-setup]')){
      const b=document.createElement('button');
      b.type='button';b.className='secondary';
      b.dataset.v21150OpenPpeSetup='1';
      b.textContent='PPE Setup';
      head.appendChild(b);
    }
  }

  async function openPpeCatalogue(){
    if(!admin())return toast('Only Admin can change the PPE catalogue and audience.');
    goView('ppe');
    for(let i=0;i<16;i++){
      await new Promise(r=>setTimeout(r,120));
      const b=document.querySelector('[data-manage-ppe-catalogue]');
      if(b){b.click();return}
    }
    toast('PPE page opened, but the catalogue button is still loading.');
  }

  /* ---------------- CURRENT HELP ---------------- */
  const HELP=[
    {id:'ppe-setup',roles:['manager','admin'],group:'Checks',title:'Set up PPE',desc:'Enable PPE for a Department, choose the responsible person, then manage the PPE catalogue and assignments.',keywords:'ppe setup department responsible catalogue assign audience monthly',action:'ppeSetup'},
    {id:'ppe-check',roles:['user','manager','admin'],group:'Checks',title:'Complete a monthly PPE check',desc:'Open your assigned monthly PPE check. Checks are due by the 28th.',keywords:'ppe monthly check missing damaged replacement 28th',view:'ppe'},
    {id:'first-aid-setup',roles:['manager','admin'],group:'Checks',title:'First Aid / Eye Wash setup',desc:'Open First Aid Equipment Checks. Departments can have First Aid ON/OFF; add First Aid Boxes or Eye Wash Stations with exact locations.',keywords:'first aid eyewash eye wash box equipment department location setup',view:'firstAid'},
    {id:'checklists',roles:['user','manager','admin'],group:'Checks',title:'Safety checklists',desc:'Open recurring PPE, First Aid and custom checklist work.',keywords:'checklists recurring checks',view:'checklists'},

    {id:'sites',roles:['admin'],group:'Sites & access',title:'Create or manage sites',desc:'Open Sites. New sites start with clear records and only the Admin who creates the site is assigned initially.',keywords:'site new hotel clean setup multi site admin',action:'sites'},
    {id:'people',roles:['manager','admin'],group:'Sites & access',title:'People & Access',desc:'See all app users. Safety access, role and site access are granted separately; Inventory users are not automatically added to a Safety site.',keywords:'people user access inventory safety role site username password',action:'people'},
    {id:'password',roles:['admin'],group:'Sites & access',title:'User login / password access',desc:'Open People & Access to give Safety access, choose sites/role, or reset a temporary password for username-only accounts.',keywords:'forgot password reset username login access',action:'people'},
    {id:'departments',roles:['admin'],group:'Sites & access',title:'Departments',desc:'Create real operational Departments and configure PPE / First Aid functions and responsibilities.',keywords:'department ppe first aid responsibility manager',action:'departments'},

    {id:'my-safety',roles:['user','manager','admin'],group:'Everyday',title:'My Safety',desc:'See your live safety dashboard, assignments and outstanding actions.',keywords:'my safety due overdue traffic light',view:'mySafety'},
    {id:'hs-training',roles:['user','manager','admin'],group:'Training',title:'Complete H&S training',desc:'Open assigned RA, COSHH RA, SSW and Toolbox Talk training.',keywords:'training ra coshh ssw toolbox tbt complete',view:'hsTraining'},
    {id:'monthly-knowledge',roles:['user','manager','admin'],group:'Training',title:'Monthly Knowledge Check',desc:'Open this month’s safety knowledge questions.',keywords:'monthly knowledge questions quiz',view:'mySafety'},
    {id:'instructor',roles:['manager','admin'],group:'Training',title:'Instructor / group attendance',desc:'Record attendance for instructor-led SSW, Toolbox Talk and other sessions.',keywords:'instructor attendance group',view:'instructor'},
    {id:'compliance',roles:['manager','admin'],group:'Training',title:'Compliance overview',desc:'Review training completion, outstanding items and renewal status.',keywords:'compliance overdue training team',view:'compliance'},

    {id:'documents',roles:['manager','admin'],group:'Documents',title:'Controlled documents',desc:'Open RA, COSHH RA, SSW, TBT, SDS, policy and procedure records, versions and approvals.',keywords:'documents ra coshh ssw tbt sds policy procedure versions approval',view:'documents'},
    {id:'create-doc',roles:['manager','admin'],group:'Documents',title:'Create a safety document',desc:'Create RA, COSHH RA, SSW or Toolbox Talk when document creation is enabled.',keywords:'create ra coshh ssw tbt document',view:'creator'},
    {id:'owner',roles:['manager','admin'],group:'Documents',title:'Document owner vs audience',desc:'Owner is Site-wide/H&S Manager or one real Department. Training/read audience is separate and can be Everyone, Departments or people.',keywords:'owner audience department site wide everyone assign training',view:'documents'},
    {id:'incident-review',roles:['manager','admin'],group:'Documents',title:'Targeted incident / policy review',desc:'Select only the relevant RA/COSHH RA/SSW/etc. Directly linked documents and linked TBT/training are included; a whole Department is not flagged.',keywords:'incident near miss policy review targeted relevant ra coshh ssw',action:'incidentReview'},

    {id:'onsite',roles:['user','manager','admin'],group:'Contractors',title:"Who's On Site / PTW",desc:'See current contractor attendance, permits and evacuation headcount.',keywords:'contractor onsite ptw permit key access',view:'onsite'},
    {id:'asbestos',roles:['user','manager','admin'],group:'Work controls',title:'Asbestos Lookup',desc:'Check known/presumed asbestos information by work location before intrusive work.',keywords:'asbestos acm survey amp location',view:'asbestos'},
    {id:'locations',roles:['admin'],group:'Work controls',title:'Site locations',desc:'Manage floors, rooms and work areas used by asbestos and contractor workflows.',keywords:'location floor room area',action:'departmentsLocations'},

    {id:'reports',roles:['manager','admin'],group:'Reports',title:'Reports & Evidence Packs',desc:'Open reports, evidence packs, contractor reports and archived evidence.',keywords:'reports evidence pack download pdf excel',view:'reports'},
    {id:'backup',roles:['admin'],group:'System',title:'Backup Safety Tracker',desc:'Open Admin/System backup controls for JSON or Full Backup ZIP.',keywords:'backup zip json restore system',action:'backup'},
    {id:'bulk',roles:['admin'],group:'System',title:'Bulk document import',desc:'Open Admin bulk PDF analysis/import.',keywords:'bulk import upload pdf',action:'bulk'},
    {id:'sync',roles:['admin'],group:'System',title:'Force Sync & Repair',desc:'Open the synchronisation and repair controls.',keywords:'sync repair links titles',action:'sync'}
  ];

  function allowedHelp(){
    const r=role();
    return HELP.filter(h=>h.roles.includes(r)||(r==='admin'&&h.roles.includes('manager'))||(r==='manager'&&h.roles.includes('user'))||(r==='admin'&&h.roles.includes('user')));
  }

  function helpCard(h){
    return `<article class="role-help-action help-v21150-card" data-help-v21150-search="${esc(clean([h.title,h.desc,h.group,h.keywords].join(' ')).toLowerCase())}">
      <div class="role-help-action-copy"><span class="role-help-group">${esc(h.group)}</span><h3>${esc(h.title)}</h3><p>${esc(h.desc)}</p></div>
      <button class="primary role-help-go" type="button" data-v21150-help-go="${esc(h.id)}">Go there</button>
    </article>`;
  }

  function renderHelpV21150(){
    const root=$('helpContent');if(!root)return;
    const rows=allowedHelp();
    root.innerHTML=`
      <div class="role-help-shell">
        <div class="role-help-hero">
          <div>
            <span class="role-help-role">${esc(admin()?'Admin Help':manager()?'Manager Help':'User Help')}</span>
            <h3>Current Safety Tracker help</h3>
            <p>Updated for sites, shared People & Access, Department PPE/First Aid responsibility, Eye Wash Stations, targeted incident reviews and the current document workflow.</p>
          </div>
          <div class="role-help-search-wrap">
            <input id="helpSearchV21150" type="search" autocomplete="off" placeholder="Try: PPE setup, site, password, eye wash, incident review…">
            <button id="helpClearV21150" class="ghost small" type="button">Clear</button>
          </div>
        </div>

        <div class="hint-box"><strong>PPE setup:</strong> Admin/Manager → <strong>PPE Setup</strong>. First enable the Department PPE function/responsible person, then create and assign PPE items. Employee checks are generated from those assignments.</div>

        <div id="helpNoResultsV21150" class="hint-box" hidden>No matching help item. Try a shorter phrase such as <strong>PPE</strong>, <strong>site</strong>, <strong>training</strong> or <strong>incident</strong>.</div>
        <div class="role-help-grid">${rows.map(helpCard).join('')}</div>

        <div class="help-card role-help-note">
          <h3>Current access rule</h3>
          <p>People & Access is the global directory. A user can exist in Inventory without Safety. New Safety sites start with the Admin who creates them; other users are added explicitly.</p>
        </div>
        <div class="help-card role-help-note">
          <h3>Traffic-light colours</h3>
          <p><strong>Green</strong> = complete/current. <strong>Amber</strong> = action due. <strong>Red</strong> = overdue/problem. <strong>Grey</strong> = inactive, historical or switched off.</p>
        </div>
      </div>`;

    const input=$('helpSearchV21150'),no=$('helpNoResultsV21150');
    const filter=()=>{
      const q=clean(input?.value||'').toLowerCase();
      let shown=0;
      root.querySelectorAll('[data-help-v21150-search]').forEach(card=>{
        const ok=!q||String(card.dataset.helpV21150Search||'').includes(q);
        card.hidden=!ok;if(ok)shown++;
      });
      if(no)no.hidden=shown!==0;
    };
    input?.addEventListener('input',filter);
    $('helpClearV21150')?.addEventListener('click',()=>{if(input){input.value='';input.focus()}filter()});
  }

  async function helpGo(id){
    const h=HELP.find(x=>x.id===id);if(!h)return;
    if(h.view){goView(h.view);return}
    switch(h.action){
      case 'ppeSetup': openPpeSetup(); return;
      case 'sites':
        if(window.SafetyPeopleSitesV21149?.openSites)window.SafetyPeopleSitesV21149.openSites();
        else if(window.SafetyPeopleSitesV21146?.openSites)window.SafetyPeopleSitesV21146.openSites();
        return;
      case 'people':
        if(window.SafetyPeopleSitesV21149?.openPeople)window.SafetyPeopleSitesV21149.openPeople();
        else if(window.SafetyPeopleSitesV21146?.openPeople)window.SafetyPeopleSitesV21146.openPeople();
        return;
      case 'incidentReview':
        if(window.SafetyTargetedIncidentReviewV21147?.open)window.SafetyTargetedIncidentReviewV21147.open();
        else toast('Open Management and choose the incident / policy review control.');
        return;
      case 'departments':
        goView('admin');
        setTimeout(()=>document.querySelector('[data-admin-tile-v21083="departments"]')?.click(),150);
        return;
      case 'departmentsLocations':
        goView('admin');
        setTimeout(()=>document.querySelector('[data-admin-tile-v21083="locations"]')?.click(),150);
        return;
      case 'backup':
        goView('admin');
        setTimeout(()=>{
          const el=[...document.querySelectorAll('#adminView h3,#adminView h2')].find(x=>/backup/i.test(x.textContent||''))?.closest('.section-card');
          el?.scrollIntoView({behavior:'smooth',block:'center'});
        },220);
        return;
      case 'bulk':
        goView('admin');
        setTimeout(()=>document.querySelector('#bulkImportFiles')?.closest('.section-card')?.scrollIntoView({behavior:'smooth',block:'center'}),220);
        return;
      case 'sync':
        goView('admin');
        setTimeout(()=>document.querySelector('#forceSyncBtn')?.closest('.section-card')?.scrollIntoView({behavior:'smooth',block:'center'}),220);
        return;
    }
  }

  function installEvents(){
    // Window capture so setup/help shortcuts win over older Admin routing.
    window.addEventListener('click',e=>{
      if(e.target.closest?.('[data-v21150-open-ppe-setup]')){
        e.preventDefault();e.stopImmediatePropagation();openPpeSetup();return;
      }
      const cfg=e.target.closest?.('[data-v21150-configure-ppe-dept]');
      if(cfg){
        e.preventDefault();e.stopImmediatePropagation();
        window.SafetySimpleOwnerV21134?.departmentSafetyEditor?.(cfg.dataset.v21150ConfigurePpeDept,'PPE');
        return;
      }
      if(e.target.closest?.('[data-v21150-ppe-catalogue]')){
        e.preventDefault();e.stopImmediatePropagation();openPpeCatalogue();return;
      }
      if(e.target.closest?.('[data-v21150-open-ppe]')){
        e.preventDefault();e.stopImmediatePropagation();goView('ppe');return;
      }
      if(e.target.closest?.('[data-v21150-open-first-aid]')){
        e.preventDefault();e.stopImmediatePropagation();goView('firstAid');return;
      }
      if(e.target.closest?.('[data-v21150-open-departments]')){
        e.preventDefault();e.stopImmediatePropagation();helpGo('departments');return;
      }
      if(e.target.closest?.('[data-v21150-ppe-back]')){
        e.preventDefault();e.stopImmediatePropagation();
        document.querySelector('#mainNav button[data-view="admin"]')?.click();
        return;
      }
      const hg=e.target.closest?.('[data-v21150-help-go]');
      if(hg){
        e.preventDefault();e.stopImmediatePropagation();helpGo(hg.dataset.v21150HelpGo);return;
      }

      if(e.target.closest?.('#mainNav button[data-view="help"]')){
        [60,180,450].forEach(ms=>setTimeout(renderHelpV21150,ms));
      }
      if(e.target.closest?.('#mainNav button[data-view="admin"],[data-management-stable-action="view:admin"]')){
        [100,300,700].forEach(ms=>setTimeout(addPpeSetupShortcuts,ms));
      }
      if(e.target.closest?.('#mainNav button[data-view="ppe"]')){
        [100,300].forEach(ms=>setTimeout(addPpeSetupShortcuts,ms));
      }
    },true);

    window.addEventListener('pageshow',()=>{
      setTimeout(addPpeSetupShortcuts,180);
      if($('helpView')?.classList.contains('active-view'))setTimeout(renderHelpV21150,180);
    });
  }

  function installStyles(){
    if($('helpPpeStylesV21150'))return;
    const s=document.createElement('style');
    s.id='helpPpeStylesV21150';
    s.textContent=`
      .ppe-setup-back-v21150{margin:0 0 14px}
      .ppe-step-v21150{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
      .ppe-step-v21150>span{flex:0 0 34px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#17324d;color:#fff;font-weight:900}
      .ppe-step-v21150 h3{margin:0 0 4px}.ppe-step-v21150 p{margin:0;color:var(--muted,#94a3b8)}
      .ppe-dept-row-v21150{gap:10px;align-items:flex-start}
      .help-v21150-card{min-height:190px}
      #ppeView .page-heading>[data-v21150-open-ppe-setup]{flex:0 0 auto}
      @media(max-width:700px){
        .ppe-dept-row-v21150{display:block}
        .ppe-dept-row-v21150>button{width:100%;margin-top:9px}
        #ppeView .page-heading>[data-v21150-open-ppe-setup]{width:100%;margin-top:8px}
      }
    `;
    document.head.appendChild(s);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state){setTimeout(boot,100);return}
    state=api.state;
    installStyles();
    ensurePpeSetupView();
    installEvents();

    // Current help replaces the legacy role-help renderer after it has initialised.
    try{window.renderHelp=renderHelpV21150}catch(_e){}
    try{renderHelp=renderHelpV21150}catch(_e){}

    [150,500,1200].forEach(ms=>setTimeout(()=>{
      addPpeSetupShortcuts();
      if($('helpView')?.classList.contains('active-view'))renderHelpV21150();
    },ms));

    window.SafetyHelpPpeV21150={renderHelp:renderHelpV21150,openPpeSetup};
  }
  boot();
})();
