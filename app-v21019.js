/* Safety Tracker v2.10.19 CLEAN - training evidence accuracy and outstanding fixes. */
'use strict';

const APP_VERSION='2.10.19';
const BUILD_ID='v21019-training-evidence-fix-20260914';
const SAFETY_APP_URL='https://grich295.github.io/Safety-tracker/';
const CFG=window.SAFETY_TRACKER_CONFIG||{};
const configured=!!(CFG.supabaseUrl&&CFG.supabaseKey&&!String(CFG.supabaseUrl).includes('PASTE_')&&!String(CFG.supabaseKey).includes('PASTE_'));

// Android/WebView pull-to-refresh can briefly lose or delay localStorage reads during a full reload.
// Keep the Supabase auth session in IndexedDB as a second durable store and fall back to localStorage.
const AUTH_DB_NAME='safety-tracker-auth-v288';
const AUTH_DB_STORE='kv';
const AUTH_RECOVERY_KEY='safetyTrackerAuthRecovery:v288';
const PROFILE_RECOVERY_PREFIX='safetyTrackerProfile:v288:';
function authDb(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(AUTH_DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(AUTH_DB_STORE))r.result.createObjectStore(AUTH_DB_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}catch(e){reject(e)}})}
async function authDbGet(key){const db=await authDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(AUTH_DB_STORE,'readonly'),rq=tx.objectStore(AUTH_DB_STORE).get(key);rq.onsuccess=()=>resolve(rq.result??null);rq.onerror=()=>reject(rq.error);tx.oncomplete=()=>db.close()})}
async function authDbSet(key,value){const db=await authDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(AUTH_DB_STORE,'readwrite');tx.objectStore(AUTH_DB_STORE).put(value,key);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function authDbRemove(key){const db=await authDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(AUTH_DB_STORE,'readwrite');tx.objectStore(AUTH_DB_STORE).delete(key);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)}})}
const durableAuthStorage={
  async getItem(key){try{const v=await authDbGet(key);if(v!=null)return v}catch{}try{const v=localStorage.getItem(key);if(v!=null){authDbSet(key,v).catch(()=>{});return v}}catch{}return null},
  async setItem(key,value){try{localStorage.setItem(key,value)}catch{}try{await authDbSet(key,value)}catch{}},
  async removeItem(key){try{localStorage.removeItem(key)}catch{}try{await authDbRemove(key)}catch{}}
};
const sb=configured?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'safety-tracker-supabase-auth-v2914'}}):null;
async function saveDurableSession(session){if(!session?.access_token||!session?.refresh_token)return;try{await authDbSet(AUTH_RECOVERY_KEY,JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token,saved_at:new Date().toISOString()}));navigator.storage?.persist?.().catch?.(()=>{})}catch{}}
async function clearDurableSession(){try{await authDbRemove(AUTH_RECOVERY_KEY)}catch{}}
async function recoverDurableSession(){try{const raw=await authDbGet(AUTH_RECOVERY_KEY);if(!raw)return null;const x=JSON.parse(raw);if(!x?.access_token||!x?.refresh_token)return null;const {data,error}=await sb.auth.setSession({access_token:x.access_token,refresh_token:x.refresh_token});if(error||!data?.session)return null;await saveDurableSession(data.session);return data.session}catch{return null}}
async function saveDurableProfile(profile){if(profile?.id)try{await authDbSet(PROFILE_RECOVERY_PREFIX+profile.id,JSON.stringify(profile))}catch{}}
async function readDurableProfile(uid){try{const raw=await authDbGet(PROFILE_RECOVERY_PREFIX+uid);return raw?JSON.parse(raw):null}catch{return null}}

async function clearAuthDbCompletely(){try{const db=await authDb();await new Promise((resolve,reject)=>{const tx=db.transaction(AUTH_DB_STORE,'readwrite');tx.objectStore(AUTH_DB_STORE).clear();tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)}})}catch{}}
let signOutInProgress=false;
async function forceLocalSignOut(){
  if(signOutInProgress)return;
  signOutInProgress=true;
  const uid=state.user?.id||null,button=$('signOutBtn');
  if(button){button.disabled=true;button.textContent='Signing out…'}
  try{
    // Remove every durable recovery copy first so an Android reload cannot restore this session.
    await clearAuthDbCompletely();
    try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if((k.startsWith('sb-')&&k.includes('auth-token'))||k.startsWith('safetyTrackerAuthRecovery:')||k.startsWith('safetyTrackerProfile:'))localStorage.removeItem(k)}}catch{}
    try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i)||'';if(k.startsWith('sb-')&&k.includes('auth-token'))sessionStorage.removeItem(k)}}catch{}
    try{await sb?.auth?.signOut({scope:'local'})}catch(e){console.warn('Supabase local sign-out failed; local credentials were still cleared.',e)}
    try{if(uid)await clearOfflineUserData(uid)}catch(e){console.warn('Offline user cleanup failed',e)}
    state.user=null;state.profile=null;state.uiMode='full';state.profileReloadAttempts=0;
    navigationReady=false;
    try{history.replaceState({},'',location.pathname)}catch{}
    showLogin();
    showAuthMessage('Signed out successfully.');
  }finally{
    signOutInProgress=false;
    if(button){button.disabled=false;button.textContent='Sign out'}
  }
}

const state={
  user:null,profile:null,uiMode:'full',offline:!navigator.onLine,offlineSnapshotAt:null,people:[],documents:[],versions:[],documentLinks:[],documentReviews:[],
  training:[],trainingAssignments:[],trainingSignoffs:[],trainingExceptions:[],trainingConfirmations:[],trainingFiles:[],trainingDocumentLinks:[],
  historicalDocAssignments:[],historicalDocSignoffs:[],historicalDocConfirmations:[],documentActivity:[],
  awarenessItems:[],awarenessAssignments:[],awarenessActivity:[],ppeItems:[],ppeAssignments:[],ppeChecks:[],ppeCheckItems:[],ppeAlertQueue:[],reportSchedules:[],generatedReports:[],reportEmailLog:[],
  departments:[],userDepartments:[],documentAudiences:[],trainingAudiences:[],awarenessAudiences:[],ppeAudiences:[],
  settings:[],siteLocations:[],asbestosSources:[],asbestosEntries:[],contractorPermits:[],contractorPermitEvents:[],loadErrors:{},syncBusy:false,documentIndex:'ALL',storageOrphans:[],profileReloadAttempts:0
};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const todayISO=()=>new Date().toISOString().slice(0,10);
const daysFromNow=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const plusYear=iso=>{const d=new Date((iso||todayISO())+'T12:00:00');d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10)};
const fmtDate=d=>d?new Date(String(d).length===10?d+'T00:00:00':d).toLocaleDateString('en-GB'):'—';
const fmtDateTime=d=>d?new Date(d).toLocaleString('en-GB'):'—';
const actualIsAdmin=()=>state.profile?.role==='admin'&&state.profile?.report_only!==true;
const actualIsManager=()=>['admin','manager'].includes(state.profile?.role)&&state.profile?.report_only!==true;
const isReportViewer=()=>state.profile?.report_only===true;
const isUserViewMode=()=>actualIsAdmin()&&(state.offline||state.uiMode==='user');
const effectiveRole=()=>isReportViewer()?'report_viewer':isUserViewMode()?'user':(state.profile?.role||'user');
const isManager=()=>['admin','manager'].includes(effectiveRole())&&!isReportViewer();
const isAdmin=()=>effectiveRole()==='admin'&&!isReportViewer();
const isStandardUser=()=>effectiveRole()==='user'&&!isReportViewer();
const canViewReports=()=>isManager()||isReportViewer();
const modeStorageKey=uid=>`safetyTrackerUiMode:${uid||'unknown'}`;
function preferredUiMode(){if(!actualIsAdmin())return 'full';try{return localStorage.getItem(modeStorageKey(state.user?.id))==='user'?'user':'full'}catch{return 'full'}}
const DOC_CREATION_SETTING='document_creation_enabled';
function settingValue(key,def=''){const row=state.settings.find(s=>s.setting_key===key);return row?.setting_value??def}
function documentCreationEnabled(){return String(settingValue(DOC_CREATION_SETTING,'true')).toLowerCase()!=='false'}
function updateDocumentCreationUi(){
  const enabled=documentCreationEnabled(),nav=document.querySelector('#mainNav button[data-view="creator"]');
  if(nav){nav.textContent='Create Safety Doc';nav.classList.toggle('creator-disabled',!enabled);nav.title=enabled?'Create a new controlled safety document.':'Document creation is currently disabled. Existing Documents, Register, links and Training remain available.';nav.hidden=!enabled;}
  document.querySelectorAll('[data-toggle-document-creation]').forEach(toggle=>{toggle.hidden=!isManager();toggle.textContent=`Document Creation: ${enabled?'ON':'OFF'}`;toggle.classList.toggle('danger',enabled);toggle.classList.toggle('primary',!enabled);});
  ['documentCreationStateNote','adminDocumentCreationStateNote'].forEach(id=>{const note=$(id);if(note){note.className=enabled?'success-note':'pending-use-warning';note.innerHTML=enabled?'<strong>Document creation is enabled.</strong> Managers/Admins can create new RA, COSHH RA, SSW and Toolbox Talk drafts.':'<strong>Document creation is OFF.</strong> Existing documents, approvals, Register, links and Training continue normally. Turn creation back on to start or generate new safety documents.';}});
  document.querySelectorAll('.creator-tile').forEach(b=>b.disabled=!enabled);
}
async function toggleDocumentCreation(){
  if(!isManager())return;const next=!documentCreationEnabled(),payload={setting_key:DOC_CREATION_SETTING,setting_value:String(next)};
  const existing=state.settings.find(s=>s.setting_key===DOC_CREATION_SETTING);let r;
  if(existing?.id)r=await sb.from('safety_tracker_settings').update({setting_value:String(next)}).eq('id',existing.id).select().maybeSingle();
  else r=await sb.from('safety_tracker_settings').insert(payload).select().maybeSingle();
  if(r?.error)return toast(r.error.message||'Could not change Document Creation setting.');
  await loadAll();updateDocumentCreationUi();toast(`Document Creation turned ${next?'ON':'OFF'}. Existing records are unchanged.`);
}
function requireDocumentCreation(){if(documentCreationEnabled())return true;toast('Document Creation is currently OFF. Existing documents and training are unaffected.');return false}

function applyViewModeUi(){
  const offline=state.offline||!navigator.onLine;
  document.querySelectorAll('.manager-only').forEach(el=>el.hidden=!isManager());
  document.querySelectorAll('.admin-only').forEach(el=>el.hidden=!isAdmin());
  document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.hidden=!canAccessView(b.dataset.view));
  const role=$('currentUserRole');if(role)role.textContent=isReportViewer()?'Report Viewer':isUserViewMode()?'User mode':actualIsAdmin()?'Admin':actualIsManager()?'Manager':'User';
  const sw=$('adminUserModeBtn');if(sw){sw.hidden=!actualIsAdmin();sw.disabled=offline;sw.textContent=isUserViewMode()?'Return to Admin':'Switch to User';sw.title=offline?'Offline mode is already restricted to the safe User view.':'Change only the interface; your account and audit identity stay Admin.'}
  const asbNav=$('asbestosNavBtn');if(asbNav)asbNav.hidden=!isMaintenanceUser();const nc=$('newContractorStaffBtn');if(nc)nc.hidden=isReportViewer()||offline;const ao=$('accessOnlyStaffBtn');if(ao)ao.hidden=isReportViewer()||offline;
  const banner=$('offlineBanner');if(banner){banner.hidden=!offline;banner.innerHTML=`<strong>Offline mode:</strong> saved My Safety, Awareness and PPE information is available read-only. Previously saved safety PDFs can be opened. Reconnect to sign, acknowledge, submit checks or use management functions.${state.offlineSnapshotAt?` <span>Saved ${fmtDateTime(state.offlineSnapshotAt)}</span>`:''}`}
  updateDocumentCreationUi();
}
function toggleAdminUserMode(){
  if(!actualIsAdmin())return;
  if(state.offline||!navigator.onLine)return toast('Offline mode already uses the safe User view. Reconnect to return to Admin mode.');
  state.uiMode=isUserViewMode()?'full':'user';
  try{localStorage.setItem(modeStorageKey(state.user?.id),state.uiMode)}catch{}
  applyViewModeUi();
  const target=canAccessView(currentViewName)?currentViewName:'mySafety';
  showView(target,{push:false});
  renderMySafety();renderAwareness();renderPpe();renderHelp();
  toast(state.uiMode==='user'?'User mode on — your account remains Admin.':'Admin mode restored.');
}
const isMaintenanceUser=()=>{if(isReportViewer())return false;if(actualIsAdmin()||actualIsManager())return true;const uid=state.user?.id;const dep=userDepartmentId(uid);return !!dep&&String(departmentName(dep)).toLowerCase()==='maintenance'};
const STANDARD_USER_VIEWS=new Set(['mySafety','hsTraining','awareness','ppe','onsite','help']);
const MANAGER_VIEWS=new Set(['mySafety','hsTraining','documents','creator','training','awareness','ppe','onsite','asbestos','people','compliance','instructor','reports','help']);
const ADMIN_VIEWS=new Set([...MANAGER_VIEWS,'admin']);
function canAccessView(name){if(isReportViewer())return name==='reports';if(name==='asbestos')return isMaintenanceUser();if(isAdmin())return ADMIN_VIEWS.has(name);if(isManager())return MANAGER_VIEWS.has(name);return STANDARD_USER_VIEWS.has(name)}
const activePeople=()=>state.people.filter(p=>p.active!==false&&p.report_only!==true);
const activeDepartments=()=>state.departments.filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
const departmentName=id=>state.departments.find(d=>d.id===id)?.name||'No department';
const userDepartmentRow=userId=>state.userDepartments.find(x=>x.user_id===userId)||null;
const userDepartmentId=userId=>userDepartmentRow(userId)?.department_id||null;
const userDepartmentName=userId=>{const id=userDepartmentId(userId);return id?departmentName(id):'No department'};
const audienceRowsForDocument=documentId=>state.documentAudiences.filter(x=>x.document_id===documentId);
const audienceTargetsForDocument=documentId=>{const rows=audienceRowsForDocument(documentId);return {everyone:rows.some(x=>x.target_type==='EVERYONE'),departmentIds:new Set(rows.filter(x=>x.target_type==='DEPARTMENT'&&x.department_id).map(x=>x.department_id)),userIds:new Set(rows.filter(x=>x.target_type==='PERSON'&&x.user_id).map(x=>x.user_id)),dueDays:Number(rows.find(x=>x.due_days)?.due_days||14)}};
function documentAudiencePeople(documentId){const a=audienceTargetsForDocument(documentId),people=activePeople();if(a.everyone)return people;return people.filter(p=>a.userIds.has(p.id)||(userDepartmentId(p.id)&&a.departmentIds.has(userDepartmentId(p.id))))}
function documentAudienceSummary(documentId){const a=audienceTargetsForDocument(documentId);if(!audienceRowsForDocument(documentId).length)return 'No automatic audience';if(a.everyone)return `Everyone · ${documentAudiencePeople(documentId).length} active user${documentAudiencePeople(documentId).length===1?'':'s'}`;const parts=[];if(a.departmentIds.size)parts.push(`${a.departmentIds.size} department${a.departmentIds.size===1?'':'s'}`);if(a.userIds.size)parts.push(`${a.userIds.size} person${a.userIds.size===1?'':'s'}`);parts.push(`${documentAudiencePeople(documentId).length} matched user${documentAudiencePeople(documentId).length===1?'':'s'}`);return parts.join(' · ')}
function audienceRowsFor(kind,id){const map={TRAINING:state.trainingAudiences,AWARENESS:state.awarenessAudiences,PPE:state.ppeAudiences};const key={TRAINING:'training_session_id',AWARENESS:'awareness_item_id',PPE:'ppe_item_id'}[kind];return (map[kind]||[]).filter(x=>x[key]===id)}
function audienceTargetsFromRows(rows){return {everyone:rows.some(x=>x.target_type==='EVERYONE'),departmentIds:new Set(rows.filter(x=>x.target_type==='DEPARTMENT'&&x.department_id).map(x=>x.department_id)),userIds:new Set(rows.filter(x=>x.target_type==='PERSON'&&x.user_id).map(x=>x.user_id)),dueDays:Number(rows.find(x=>x.due_days)?.due_days||14)}}
function genericAudienceHtml(prefix,rows=[],opts={}){const a=audienceTargetsFromRows(rows),showDue=opts.showDue!==false,heading=opts.heading||'Assignment audience',help=opts.help||'Choose who this applies to now. Department rules also apply automatically to future active users added to that department.';const deps=activeDepartments().map(d=>`<label class="check-row"><input type="checkbox" class="${prefix}-department-choice" value="${d.id}" ${a.departmentIds.has(d.id)?'checked':''}>${esc(d.name)}</label>`).join('')||'<span class="muted">No active departments. Create one in Admin → Departments.</span>';const ppl=activePeople().map(p=>`<label class="check-row"><input type="checkbox" class="${prefix}-person-choice" value="${p.id}" ${a.userIds.has(p.id)?'checked':''}>${esc(p.display_name||p.email)} <span class="muted">· ${esc(userDepartmentName(p.id))}</span></label>`).join('')||'<span class="muted">No active users.</span>';return `<div id="${prefix}AudienceSection" class="section-card approval-audience-card"><h4>${esc(heading)}</h4><p class="muted">${esc(help)}</p><label class="check-row audience-everyone"><input id="${prefix}AssignEveryone" type="checkbox" ${a.everyone?'checked':''}> <strong>Everyone</strong> — all current and future active users</label>${showDue?`<div class="form-grid"><label>Completion due after assignment<input id="${prefix}AssignDueDays" type="number" min="1" max="365" value="${a.dueDays||14}"><span class="muted">days</span></label></div>`:''}<div class="audience-grid"><div><h5>Departments</h5><div class="checkbox-list">${deps}</div></div><div><h5>Specific people</h5><div class="checkbox-list">${ppl}</div></div></div><div id="${prefix}AudienceSummary" class="hint-box"></div></div>`}
function genericAudienceSelection(prefix,showDue=true){return {everyone:!!$(prefix+'AssignEveryone')?.checked,departmentIds:[...document.querySelectorAll('.'+prefix+'-department-choice:checked')].map(x=>x.value),userIds:[...document.querySelectorAll('.'+prefix+'-person-choice:checked')].map(x=>x.value),dueDays:showDue?Math.max(1,Math.min(365,Number($(prefix+'AssignDueDays')?.value||14))):14}}
function wireGenericAudience(prefix,showDue=true){const section=$(prefix+'AudienceSection');if(!section)return;const update=()=>{const a=genericAudienceSelection(prefix,showDue),ids=new Set();document.querySelectorAll('.'+prefix+'-department-choice,.'+prefix+'-person-choice').forEach(x=>x.disabled=a.everyone);if(a.everyone)activePeople().forEach(p=>ids.add(p.id));else activePeople().forEach(p=>{const dep=userDepartmentId(p.id);if((dep&&a.departmentIds.includes(dep))||a.userIds.includes(p.id))ids.add(p.id)});const box=$(prefix+'AudienceSummary');if(box)box.innerHTML=ids.size?`<strong>${ids.size} active user${ids.size===1?'':'s'} matched.</strong> Department membership will keep this audience current automatically.`:'<strong>No audience selected.</strong> Choose Everyone, a Department, or a specific person before saving.'};section.addEventListener('change',update);update()}
function audienceSelectionValid(a){return !!(a?.everyone||a?.departmentIds?.length||a?.userIds?.length)}
function audienceSummaryFromRows(rows){const a=audienceTargetsFromRows(rows);if(!rows.length)return 'No audience';if(a.everyone)return 'Everyone';const bits=[];if(a.departmentIds.size)bits.push(`${a.departmentIds.size} department${a.departmentIds.size===1?'':'s'}`);if(a.userIds.size)bits.push(`${a.userIds.size} person${a.userIds.size===1?'':'s'}`);return bits.join(' + ')||'No audience'}
const sourceDocTypes=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
const trainingKinds=['RISK_ASSESSMENT','COSHH','SSW','TOOLBOX_TALK','INDUCTION','REFRESHER','AD_HOC','OTHER'];
const standaloneTrainingKinds=['INDUCTION','REFRESHER','AD_HOC','OTHER'];
const refRx=/\b(?:COSHH\s*RA|COSHHRA|COSHH|RA|SSW|TBT|PROC|SDS|MSDS)[\s_-]*\d{1,4}\b/gi;
const documentIndexDefs={
  RISK_ASSESSMENT:{title:'Risk Assessment Index',short:'Risk Assessments',description:'Controlled risk assessments, current versions and review dates.'},
  COSHH:{title:'COSHH Risk Assessment Index',short:'COSHH Risk Assessments',description:'COSHH assessments only — kept separate from manufacturer MSDS/Safety Data Sheets.'},
  SSW:{title:'Safe System of Work Index',short:'Safe Systems of Work',description:'Controlled SSW documents and current versions.'},
  SDS:{title:'MSDS / Safety Data Sheet Index',short:'MSDS / Safety Data Sheets',description:'Manufacturer safety data sheets only. These are reference documents, not COSHH risk assessments.'},
  TOOLBOX_TALK:{title:'Toolbox Talk Index',short:'Toolbox Talks',description:'Toolbox Talk source files are indexed here while completion and sign-off stay in Training.'}
};

function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,4200)}
function downloadBlob(blob,fileName){
  if(!(blob instanceof Blob))blob=new Blob([blob]);
  const name=safeFileName(String(fileName||'download')).replace(/-pdf$/i,'.pdf').replace(/-csv$/i,'.csv');
  const url=URL.createObjectURL(blob);
  try{
    const a=document.createElement('a');a.href=url;a.download=fileName||name||'download';a.rel='noopener';a.style.display='none';
    document.body.appendChild(a);a.click();setTimeout(()=>{try{a.remove()}catch{}try{URL.revokeObjectURL(url)}catch{}},30000);
  }catch(e){try{location.href=url}catch{}setTimeout(()=>{try{URL.revokeObjectURL(url)}catch{}},120000)}
}
function showAuthMessage(msg){$('authMessage').textContent=msg;$('authMessage').hidden=false}
function btn(label,cls='secondary',attrs=''){return `<button type="button" class="${cls}" ${attrs}>${esc(label)}</button>`}

function trafficPriority(t){return ({red:0,amber:1,green:2,neutral:3})[t]??4}
function statusChip(label,traffic='neutral'){return `<span class="status-chip status-${traffic}"><span class="status-dot" aria-hidden="true"></span>${esc(label)}</span>`}
function moreActions(html,label='More'){return html?`<details class="card-more"><summary>${esc(label)}</summary><div class="more-actions">${html}</div></details>`:''}
function assignmentTraffic(status,depsReady=true){if(!depsReady)return 'red';if(status?.code==='OVERDUE')return 'red';if(status?.code==='COMPLETED')return 'green';return 'amber'}
function trainingOperationalTraffic(t){
  const base=trainingCatalogueTraffic(t);
  if(base==='red'||base==='neutral')return base;
  const assigns=state.trainingAssignments.filter(a=>a.training_session_id===t.id&&a.active!==false);
  if(assigns.some(a=>assignmentStatus(a,t).code==='OVERDUE'))return 'red';
  if(base==='amber'||assigns.some(a=>assignmentStatus(a,t).code!=='COMPLETED'))return 'amber';
  return 'green';
}

// Installed Android PWAs can open with only one browser-history entry. Keep a
// protected in-app root plus normal view/modal entries so Back navigates within
// Safety Tracker instead of immediately closing the installed app.
let navigationReady=false;
let currentViewName='mySafety';
const safetyNavState=(extra={})=>({safetyTracker:true,view:currentViewName,modal:false,guard:false,...extra});
function seedSafetyNavigation(initialView){
  currentViewName=initialView||'mySafety';
  const st=history.state;
  if(!st?.safetyTracker){
    history.replaceState(safetyNavState({view:currentViewName,guard:true,modal:false}),'',location.href);
    history.pushState(safetyNavState({view:currentViewName,guard:false,modal:false}),'',location.href);
  }else if(st.guard){
    history.pushState(safetyNavState({view:currentViewName,guard:false,modal:false}),'',location.href);
  }else{
    history.replaceState({...st,...safetyNavState({view:currentViewName,guard:false,modal:false})},'',location.href);
  }
  navigationReady=true;
}
function openModal(title,html){
  const modal=$('modal');
  const wasOpen=!!modal?.open;
  $('modalTitle').textContent=title;
  $('modalBody').innerHTML=html;
  if(!wasOpen)modal.showModal();
  const form=modal?.querySelector('form');
  if(form)requestAnimationFrame(()=>{form.scrollTop=0;});
  if(navigationReady&&!wasOpen&&!history.state?.modal){
    history.pushState(safetyNavState({view:currentViewName,modal:true,guard:false}),'',location.href);
  }
}
function closeModal(fromPopstate=false){
  if($('modal')?.open)$('modal').close();
  if(!fromPopstate&&navigationReady&&history.state?.safetyTracker&&history.state.modal)history.back();
}
function handleSafetyPopstate(e){
  if(!navigationReady)return;
  if($('modal')?.open)closeModal(true);
  const st=e.state;
  const root=isReportViewer()?'reports':'mySafety';
  if(st?.safetyTracker){
    if(st.guard){
      currentViewName=root;
      showView(root,{push:false});
      history.pushState(safetyNavState({view:root,modal:false,guard:false}),'',location.href);
      return;
    }
    currentViewName=st.view||root;
    showView(currentViewName,{push:false});
    return;
  }
  currentViewName=root;
  showView(root,{push:false});
  history.pushState(safetyNavState({view:root,modal:false,guard:false}),'',location.href);
}
function docTypeLabel(type){return ({RISK_ASSESSMENT:'Risk Assessment',COSHH:'COSHH Risk Assessment',SSW:'Safe System of Work',SDS:'MSDS / Safety Data Sheet',POLICY:'Policy',PROCEDURE:'Procedure',OTHER:'Other'})[type]||String(type||'')}
function kindLabel(type){return ({RISK_ASSESSMENT:'Risk Assessment',COSHH:'COSHH Risk Assessment',SSW:'Safe System of Work',TOOLBOX_TALK:'Toolbox Talk',INDUCTION:'Induction',REFRESHER:'Refresher',AD_HOC:'Ad-hoc training',OTHER:'Policy / general H&S / other'})[type]||String(type||'Training').replaceAll('_',' ')}
function deliveryText(v){return v==='INSTRUCTOR_LED'?'Instructor-led':'Self-training'}
function defaultTrainingDelivery(type){return ['SSW','TOOLBOX_TALK','INDUCTION'].includes(type)?'INSTRUCTOR_LED':'SELF_TRAINING'}
function sourceDelivery(docType){return docType==='SSW'?'INSTRUCTOR_LED':'SELF_TRAINING'}
function defaultSourceRenewal(docType){return ['RISK_ASSESSMENT','COSHH'].includes(docType)?{value:12,unit:'MONTHS'}:{value:null,unit:null}}
function renewalText(v,u,onChangeOnly=false){return v&&u?`Every ${v} ${String(u).toLowerCase()}`:(onChangeOnly?'On change only':'One-off')}
function addRenewal(date,v,u){if(!date||!v||!u)return null;const d=new Date(date);if(u==='DAYS')d.setDate(d.getDate()+Number(v));if(u==='MONTHS')d.setMonth(d.getMonth()+Number(v));if(u==='YEARS')d.setFullYear(d.getFullYear()+Number(v));return d.toISOString()}
function versionApprovalStatus(v){return String(v?.approval_status||'APPROVED').toUpperCase()}
function isVersionApproved(v){return !!v&&versionApprovalStatus(v)==='APPROVED'}
function currentVersion(docId){return state.versions.find(v=>v.document_id===docId&&v.status==='CURRENT')||null}
function approvedCurrentVersion(docId){const v=currentVersion(docId);return isVersionApproved(v)?v:null}
function latestVersion(docId){return state.versions.filter(v=>v.document_id===docId).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null}
function pendingApprovalVersions(docId){return state.versions.filter(v=>v.document_id===docId&&versionApprovalStatus(v)==='PENDING').sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))}
function pendingApprovalVersion(docId){return pendingApprovalVersions(docId)[0]||null}
function rejectedVersion(docId){return state.versions.filter(v=>v.document_id===docId&&versionApprovalStatus(v)==='REJECTED').sort((a,b)=>new Date(b.approval_at||b.created_at||0)-new Date(a.approval_at||a.created_at||0))[0]||null}
function documentHasApprovedCurrent(d){return !!d&&d.status!=='ARCHIVED'&&!!approvedCurrentVersion(d.id)}
function trainingSourceVersion(t){return t?.source_document_version_id?state.versions.find(v=>v.id===t.source_document_version_id)||null:null}
function trainingSourceApproved(t){const v=trainingSourceVersion(t);return !v||isVersionApproved(v)}
function versionApprovalLabel(v,d=null){const st=versionApprovalStatus(v);if(st==='APPROVED')return d?.doc_type==='SDS'?'Accepted/current':'Approved/current';if(st==='PENDING')return d?.doc_type==='SDS'?'Pending acceptance':'Pending approval';if(st==='REJECTED')return d?.doc_type==='SDS'?'Not accepted':'Not approved';return st}
function documentTraffic(d){if(!d||d.status==='ARCHIVED')return 'neutral';const approved=approvedCurrentVersion(d.id),pending=pendingApprovalVersion(d.id),rejected=rejectedVersion(d.id);if(!approved&&rejected&&!pending)return 'red';if(pending)return 'amber';if(!approved)return 'red';if(approved.review_date&&approved.review_date<todayISO())return 'red';if(d.review_required||(approved.review_date&&approved.review_date>=todayISO()&&approved.review_date<=daysFromNow(30)))return 'amber';return 'green'}
function personName(id){const p=state.people.find(x=>x.id===id);return p?.display_name||p?.email||'Unknown user'}
function trainingReference(t){return t?.reference||(String(t?.name||'').match(/\bTBT-\d{3}\b/i)?.[0]?.toUpperCase()||'')}
function trainingKind(t){return t?.source_kind||t?.session_type||'OTHER'}
function sourceForTraining(t){return state.documents.find(d=>d.id===t?.source_document_id)||null}
function trainingLinks(tid){return state.trainingDocumentLinks.filter(l=>l.training_session_id===tid)}
function linkedTrainingDocs(tid){return trainingLinks(tid).map(l=>({link:l,doc:state.documents.find(d=>d.id===l.document_id)})).filter(x=>x.doc)}
function defaultTrainingLinkRole(doc,sourceId=null){if(!doc)return 'RELATED';if(doc.id===sourceId)return 'SOURCE';return ['COSHH','SSW'].includes(doc.doc_type)?'REQUIRED':'RELATED'}
function documentApprovalSummary(d){
  const approved=approvedCurrentVersion(d?.id),pending=pendingApprovalVersion(d?.id);
  if(approved&&pending)return {ready:true,label:`${d?.doc_type==='SDS'?'Accepted':'Approved'} current · replacement pending`,traffic:'amber',version:approved};
  if(approved)return {ready:true,label:d?.doc_type==='SDS'?'Accepted/current':'Approved/current',traffic:'green',version:approved};
  if(pending)return {ready:false,label:d?.doc_type==='SDS'?'Pending acceptance':'Pending approval',traffic:'amber',version:pending};
  return {ready:false,label:'No approved/current version',traffic:'red',version:latestVersion(d?.id)};
}
function trainingDependencyState(t){
  const reasons=[];
  if(!t)return {ready:false,reasons:['Training record not found'],required:[]};
  if(t.source_document_id){
    const src=state.documents.find(d=>d.id===t.source_document_id),approved=approvedCurrentVersion(t.source_document_id);
    if(!approved||approved.id!==t.source_document_version_id)reasons.push(`${src?.reference||src?.title||'Controlled source'} is not approved/current`);
  }
  return {ready:reasons.length===0,reasons,required:[]};
}
function trainingDependencyMessage(t){const d=trainingDependencyState(t);return d.ready?'':`Training is not live until its controlled source is approved/current: ${d.reasons.join('; ')}`}
function linksForDocument(did){return state.documentLinks.filter(l=>l.source_document_id===did||l.target_document_id===did)}
function otherDocForLink(link,did){return state.documents.find(d=>d.id===(link.source_document_id===did?link.target_document_id:link.source_document_id))}
function pairExists(a,b){return state.documentLinks.some(l=>(l.source_document_id===a&&l.target_document_id===b)||(l.source_document_id===b&&l.target_document_id===a))}
function inferLinkType(a,b){
  if(a?.doc_type==='SDS'&&b?.doc_type==='COSHH')return {source:a,target:b,type:'SDS_TO_COSHH'};
  if(a?.doc_type==='COSHH'&&b?.doc_type==='SDS')return {source:b,target:a,type:'SDS_TO_COSHH'};
  if(a?.doc_type==='COSHH'&&b?.doc_type==='SSW')return {source:a,target:b,type:'COSHH_TO_SSW'};
  if(a?.doc_type==='SSW'&&b?.doc_type==='COSHH')return {source:b,target:a,type:'COSHH_TO_SSW'};
  if(a?.doc_type==='RISK_ASSESSMENT'&&b?.doc_type==='SSW')return {source:a,target:b,type:'RA_TO_SSW'};
  if(a?.doc_type==='SSW'&&b?.doc_type==='RISK_ASSESSMENT')return {source:b,target:a,type:'RA_TO_SSW'};
  return {source:a,target:b,type:'RELATED'};
}
function linkTypeLabel(t){return ({SDS_TO_COSHH:'SDS/MSDS → COSHH',COSHH_TO_SSW:'COSHH → SSW',RA_TO_SSW:'RA → SSW',RELATED:'Related document'})[t]||t}

function canonicalRef(raw){
  const s=clean(raw).toUpperCase().replace(/_/g,' ').replace(/\s+/g,' ').replace(/^COSHH\s*RA\b/,'COSHH ').replace(/^COSHHRA\b/,'COSHH ');
  const m=s.match(/^(COSHH|RA|SSW|TBT|PROC|SDS|MSDS)[\s-]*(\d{1,4})$/);
  if(!m)return clean(raw).toUpperCase();
  const digits=m[2].length<3?m[2].padStart(3,'0'):m[2];
  const prefix=m[1]==='MSDS'?'SDS':m[1];
  return `${prefix}-${digits}`;
}
function normalisedPhrase(s){
  return clean(s).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function normalisedProductName(s){
  return normalisedPhrase(s)
    .replace(/\b(?:safety|data|sheet|sds|msds|coshh|risk|assessment|current|official|manufacturer|supplier|product|name|identifier|trade|brand|version|revision|date|gb|uk|en|eu|as|used)\b/g,' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|millilitres?|l|litres?|g|grams?|kg|kilograms?)\b/g,' ')
    .replace(/\s+/g,' ').trim();
}
function productMatchTokens(s){
  const stop=new Set(['safety','data','sheet','sds','msds','coshh','risk','assessment','current','official','manufacturer','supplier','product','name','identifier','trade','brand','version','revision','date','the','and','for','with','from','this','that','use','using','of','to','in','on','a','an','gb','uk','en','eu','as','used']);
  return normalisedPhrase(s).split(' ').filter(w=>w.length>1&&!stop.has(w)&&!/^(?:ml|kg|mg|litre|litres|gram|grams)$/.test(w));
}
function productNameMatchScore(a,b){
  const A=productMatchTokens(a),B=productMatchTokens(b);
  if(!A.length||!B.length)return 0;
  const na=normalisedProductName(a),nb=normalisedProductName(b);
  if(na&&nb&&(na===nb||na.includes(nb)||nb.includes(na)))return 1;
  const bs=new Set(B),common=[...new Set(A.filter(x=>bs.has(x)))];
  const coverage=common.length/Math.max(1,Math.min(new Set(A).size,new Set(B).size));
  const union=new Set([...A,...B]).size;
  const jaccard=common.length/Math.max(1,union);
  const distinctive=common.some(x=>x.length>=5||/\d/.test(x));
  if(!distinctive)return 0;
  return Math.min(0.99,coverage*0.78+jaccard*0.22);
}
function extractCoshhProductCandidates(text,owner=null){
  const raw=clean(text),out=[];
  if(owner?.title)out.push(owner.title);
  const patterns=[
    /\bName of Substance\s*:?\s*([\s\S]{3,140}?)(?=\s+Brand\s*:|\s+Where is SDS|\s+Substance Details|\s+Form\s*:)/ig,
    /\bCurrent\s+(?:[A-Za-z0-9&./'() -]+?\s+)?(?:GB(?:-en)?|UK|EU)?\s*SDS\s*:\s*([\s\S]{3,120}?)(?=\s+(?:product codes?|UFI|revision|version|classification|signal word|precautions|\bH\d{3}\b)|[.;])/ig,
    /\b(?:SDS|MSDS|Safety Data Sheet)\s+(?:for|covering)\s+([\s\S]{3,100}?)(?=[.;]|\s+(?:version|revision|dated|date)\b)/ig
  ];
  for(const rx of patterns){let m;while((m=rx.exec(raw))!==null){const c=cleanSdsCandidate(m[1]);if(c&&!isBadSdsTitle(c))out.push(c);if(out.length>=12)break}}
  return [...new Set(out.map(clean).filter(Boolean))];
}
function coshhMatchesSds(text,owner,sdsDoc){
  const aliases=[sdsDoc?.title,documentDisplayTitle(sdsDoc),stripPdfName(originalBulkSourceName(currentVersion(sdsDoc?.id)))].map(clean).filter(Boolean);
  const hay=normalisedProductName(text);
  let best=0;
  for(const alias of aliases){
    const na=normalisedProductName(alias);
    if(na&&na.length>=4&&hay.includes(na))best=Math.max(best,1);
  }
  const candidates=extractCoshhProductCandidates(text,owner);
  for(const c of candidates)for(const alias of aliases)best=Math.max(best,productNameMatchScore(c,alias));
  return best;
}
function significantLinkWords(s){
  const stop=new Set(['risk','assessment','coshh','safe','system','work','safety','data','sheet','msds','sds','document','documents','procedure','policy','version','the','and','for','with','from','this','that','use','using','of','to','in','on','a','an']);
  return normalisedPhrase(s).split(' ').filter(w=>w.length>2&&!stop.has(w));
}
function linkContextText(text){
  const raw=clean(text);
  // Only use text around wording that actually declares a relationship. This avoids
  // creating links merely because another document type is mentioned somewhere.
  const markers=/\b(?:RELATED DOCUMENTS?|LINKED DOCUMENTS?|ASSOCIATED DOCUMENTS?|REFERENCE DOCUMENTS?|REFERENCES?|SUPPORTING DOCUMENTS?|RELEVANT DOCUMENTS?|APPLICABLE DOCUMENTS?|DOCUMENTS? REFERENCED|SEE ALSO|REFER TO|REFERRED TO|LINKED TO|ASSOCIATED WITH|RELATED CONTROLS?|SUPPORTING CONTROLS?|RELATED ASSESSMENTS?|RELEVANT RA(?:S)?|RELEVANT RISK ASSESSMENTS?|RELEVANT COSHH(?: RISK ASSESSMENTS?)?|APPLICABLE RA(?:S)?|APPLICABLE RISK ASSESSMENTS?|APPLICABLE COSHH(?: RISK ASSESSMENTS?)?|SUPPORTING (?:RA|RISK ASSESSMENTS?|COSHH(?: RISK ASSESSMENTS?)?|SSW|SAFE SYSTEMS? OF WORK|TBT|TOOLBOX TALKS?|DOCUMENTS?|CONTROLS?)|RELATED (?:RA|RISK ASSESSMENTS?|COSHH(?: RISK ASSESSMENTS?)?|SSW|SAFE SYSTEMS? OF WORK|TBT|TOOLBOX TALKS?|CONTROLS?)|LINKED (?:RA|RISK ASSESSMENTS?|COSHH(?: RISK ASSESSMENTS?)?|SSW|SAFE SYSTEMS? OF WORK|TBT|TOOLBOX TALKS?)|(?:RA|RISK ASSESSMENT|COSHH|SSW|SAFE SYSTEM OF WORK|TBT|TOOLBOX TALK) REFERENCES?)\b/gi;
  const chunks=[]; let m;
  while((m=markers.exec(raw))!==null){
    chunks.push(raw.slice(Math.max(0,m.index-140),Math.min(raw.length,m.index+760)));
    if(chunks.length>=50)break;
  }
  return chunks.join(' | ');
}
function declaredRefsForLinking(text,owner=null){
  const refs=new Set(refsInText(linkContextText(text)));
  const ownerRef=canonicalRef(owner?.reference||'');
  if(ownerRef)refs.delete(ownerRef);
  return [...refs];
}
function referencedTrainingByRef(ref){
  const c=canonicalRef(ref);
  return activeTraining().find(t=>canonicalRef(trainingReference(t))===c)||null;
}
function referencedDocumentByRef(ref){
  const c=canonicalRef(ref);
  return state.documents.find(d=>d.status!=='ARCHIVED'&&canonicalRef(d.reference||'')===c)||null;
}
function missingDeclaredRefs(text,owner=null){
  return declaredRefsForLinking(text,owner).filter(ref=>!referencedDocumentByRef(ref)&&!referencedTrainingByRef(ref));
}
function textMentionsDocumentTitle(text,title){
  const hay=normalisedPhrase(text), needle=normalisedPhrase(title);
  if(!hay||!needle||needle.length<4)return false;
  const words=significantLinkWords(title);
  const distinctive=words.length>=2 || /\d/.test(needle) || needle.length>=12;
  return distinctive && hay.includes(needle);
}
function declaredDocumentMatches(text,owner=null){
  // Link discovery is independent of approval. Pending controlled documents can be
  // related immediately; approval controls whether Training is allowed to go live.
  const active=state.documents.filter(d=>d.status!=='ARCHIVED'&&d.id!==owner?.id);
  const refs=new Set(declaredRefsForLinking(text,owner));
  const contexts=linkContextText(text);
  const hasSdsCue=/\b(?:SDS|MSDS|SAFETY DATA SHEET|MATERIAL SAFETY DATA SHEET)\b/i.test(text);
  const out=[];
  for(const d of active){
    const cref=canonicalRef(d.reference||'');
    let reason='';
    if(cref&&refs.has(cref))reason='reference stated in linked/reference section';
    else if(textMentionsDocumentTitle(contexts,documentDisplayTitle(d)||d.title))reason='title stated in linked/reference section';
    else if(owner?.doc_type==='COSHH'&&d.doc_type==='SDS'&&hasSdsCue){
      const score=coshhMatchesSds(text,owner,d);
      if(score>=0.74)reason=`SDS/product name aligned with COSHH assessment (${Math.round(score*100)}% match)`;
    }
    if(reason)out.push({doc:d,reason});
  }
  return out;
}
function activeTraining(){return state.training.filter(t=>t.status!=='ARCHIVED')}

function looksLikeCoshhAssessment(text){
  const u=clean(text).toUpperCase();
  const named=/\bCOSHH\s+(?:RISK\s+)?ASSESSMENT\b|CONTROL OF SUBSTANCES HAZARDOUS TO HEALTH/.test(u);
  const assessmentSignals=[/RISK\s+(?:RATING|SCORE|LEVEL)/, /LIKELIHOOD/, /SEVERITY/, /CONTROL\s+MEASURES?/, /PERSONS?\s+(?:AT|EXPOSED TO)\s+RISK/, /ASSESS(?:ED|MENT)\s+BY/, /ADOPTED\s+BY/, /AFTER\s+CONTROLS?/].filter(rx=>rx.test(u)).length;
  if(/\bCOSHH\s+RISK\s+ASSESSMENT\b/.test(u))return true;
  return named && assessmentSignals>=2;
}
function looksLikeSafetyDataSheet(text){
  const u=clean(text).toUpperCase();
  if(looksLikeCoshhAssessment(u))return false;
  const heading=/\b(?:SAFETY DATA SHEET|MATERIAL SAFETY DATA SHEET|MSDS)\b/.test(u);
  const section1=/\b1\.1\s+(?:PRODUCT IDENTIFIER|PRODUCT NAME)|SECTION\s+1\s*[:.-]?\s*(?:IDENTIFICATION|IDENTIFICATION OF THE SUBSTANCE)/.test(u);
  const section2=/SECTION\s+2\s*[:.-]?\s*HAZARD|2\.1\s+CLASSIFICATION/.test(u);
  const section3=/SECTION\s+3\s*[:.-]?\s*COMPOSITION|3\.1\s+SUBSTANCES|3\.2\s+MIXTURES/.test(u);
  return heading && section1 && (section2||section3);
}
function classifySafetyPdfText(text){
  if(looksLikeCoshhAssessment(text))return 'COSHH';
  if(looksLikeSafetyDataSheet(text))return 'SDS';
  const u=clean(text).toUpperCase();
  if(/\bSAFE SYSTEM OF WORK\b|\bSSW\s+(?:REFERENCE|REF)\b/.test(u))return 'SSW';
  if(/\bTOOLBOX TALK\b|\bTBT\s+(?:REFERENCE|REF)\b/.test(u))return 'TOOLBOX_TALK';
  if(!/\bCOSHH\b/.test(u)&&(/\bRISK ASSESSMENT\b|\bRA\s+(?:REFERENCE|REF)\b/.test(u)))return 'RISK_ASSESSMENT';
  return null;
}


function activityActionLabel(action){return ({OPENED:'Opened',DOWNLOADED:'Downloaded',REVIEWED:'Reviewed',CONTROLLED_REVIEW:'Controlled review',TRAINING_COMPLETED:'Training completed'})[action]||String(action||'Activity').replaceAll('_',' ')}
function activityPersonName(a){const p=state.people.find(x=>x.id===a?.user_id);return p?.display_name||p?.email||a?.user_name_snapshot||a?.user_email_snapshot||'Unknown user'}
function activityTargetLabel(a){const ref=clean(a?.document_reference),title=clean(a?.document_title),ver=clean(a?.version_label);const base=ref&&title?`${ref} - ${title}`:(ref||title||clean(a?.file_name)||'Document');return ver?`${base} · v${ver}`:base}
function activityForDocument(docId){return state.documentActivity.filter(a=>a.document_id===docId).sort((a,b)=>new Date(b.occurred_at||0)-new Date(a.occurred_at||0))}
function activityForTraining(trainingId){return state.documentActivity.filter(a=>a.training_session_id===trainingId).sort((a,b)=>new Date(b.occurred_at||0)-new Date(a.occurred_at||0))}
function activityVersionSnapshot(v){const d=state.documents.find(x=>x.id===v?.document_id);return {document_id:d?.id||null,document_version_id:v?.id||null,document_reference:d?.reference||null,document_title:d?documentDisplayTitle(d):null,version_label:v?.version_label||null,file_name:v?.file_name||null}}
function activityTrainingFileSnapshot(f){const t=state.training.find(x=>x.id===f?.training_session_id);return {training_session_id:t?.id||null,training_file_id:f?.id||null,document_reference:t?trainingReference(t)||null:null,document_title:t?.name||null,version_label:null,file_name:f?.file_name||null}}
async function logDocumentActivity(action,snapshot={},metadata=null,showError=false){
  if(!sb||!state.user?.id)return null;
  const payload={user_id:state.user.id,user_name_snapshot:state.profile?.display_name||state.user?.email||null,user_email_snapshot:state.user?.email||state.profile?.email||null,action,source_context:snapshot.source_context||'DOCUMENT_LIBRARY',document_id:snapshot.document_id||null,document_version_id:snapshot.document_version_id||null,training_session_id:snapshot.training_session_id||null,training_file_id:snapshot.training_file_id||null,document_reference:snapshot.document_reference||null,document_title:snapshot.document_title||null,version_label:snapshot.version_label||null,file_name:snapshot.file_name||null,metadata:metadata||{}};
  const r=await sb.from('document_activity').insert(payload).select().single();
  if(r.error){console.warn('Document activity audit',r.error);if(showError)toast('Could not record document activity. Check the v2.1.2 document-activity SQL migration.');return null}
  state.documentActivity.unshift(r.data);return r.data;
}
async function downloadDocument(versionId){const v=state.versions.find(x=>x.id===versionId);if(!v?.storage_path)return toast('Stored PDF not found.');if(!isManager()&&(!isVersionApproved(v)||v.status!=='CURRENT'))return toast('Only the approved current version is available for use.');const r=await sb.storage.from('safety-files').download(v.storage_path);if(r.error||!r.data)return toast(r.error?.message||'Download failed.');downloadBlob(r.data,v.file_name||'safety-document.pdf');await logDocumentActivity('DOWNLOADED',{...activityVersionSnapshot(v),source_context:'DOCUMENT_LIBRARY'});}
function documentUsesFormalTraining(d){return !!d&&sourceDocTypes.has(d.doc_type)}
function hasOpenedVersion(versionId,userId=state.user?.id){return state.documentActivity.some(a=>a.user_id===userId&&a.document_version_id===versionId&&a.action==='OPENED')}
function showMarkDocumentReviewed(versionId){const v=state.versions.find(x=>x.id===versionId),d=state.documents.find(x=>x.id===v?.document_id);if(!v||!d)return;if(documentUsesFormalTraining(d))return toast('This controlled document is acknowledged through Training. Open it from the assigned training and complete the training sign-off instead.');if(!hasOpenedVersion(versionId))return toast('Open the file first. Safety Tracker must record the file was opened before it can be marked read/reviewed.');openModal('Mark file as read / reviewed',`<p><strong>${esc(d.reference?d.reference+' - '+documentDisplayTitle(d):documentDisplayTitle(d))}</strong> · v${esc(v.version_label||'—')}</p><div class="hint-box">For reference documents that are not formal training, this records that you opened and reviewed the file. It does <strong>not</strong> create a training completion.</div><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Confirm read / reviewed','primary',`data-confirm-doc-reviewed="${v.id}"`)}</div>`)}
async function confirmDocumentReviewed(versionId){const v=state.versions.find(x=>x.id===versionId),d=state.documents.find(x=>x.id===v?.document_id);if(!v||!d)return;if(documentUsesFormalTraining(d))return toast('RA, COSHH RA and SSW acknowledgements are completed through Training.');if(!hasOpenedVersion(versionId))return toast('Open the file first.');const row=await logDocumentActivity('REVIEWED',{...activityVersionSnapshot(v),source_context:'REFERENCE_DOCUMENT'},null,true);if(!row)return;closeModal();toast('Read / review recorded.');}
function activityCards(rows){return rows.length?rows.map(a=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(activityActionLabel(a.action))}</strong><div>${esc(activityTargetLabel(a))}</div><div class="meta"><span>${esc(activityPersonName(a))}</span><span>${fmtDateTime(a.occurred_at)}</span>${a.source_context?`<span>${esc(String(a.source_context).replaceAll('_',' ').toLowerCase())}</span>`:''}</div></div></div></div>`).join(''):'<div class="empty">No document activity recorded yet.</div>'}
function showDocumentActivity(docId){const d=state.documents.find(x=>x.id===docId);if(!d)return;const rows=activityForDocument(docId);openModal('Document activity',`<p><strong>${esc(d.reference?d.reference+' - '+documentDisplayTitle(d):documentDisplayTitle(d))}</strong></p><div class="muted">Opened, downloaded, reviewed and training-completion events are timestamped against the user and version.</div><div class="card-list" style="margin-top:1rem">${activityCards(rows)}</div>`)}
function showTrainingFileActivity(trainingId){const t=state.training.find(x=>x.id===trainingId);if(!t)return;openModal('File activity',`<p><strong>${esc(trainingReference(t)?trainingReference(t)+' - '+t.name:t.name)}</strong></p><div class="card-list">${activityCards(activityForTraining(trainingId))}</div>`)}
function filteredDocumentActivity(){const q=clean($('activitySearch')?.value).toLowerCase(),person=$('activityPersonFilter')?.value||'',action=$('activityActionFilter')?.value||'';return [...state.documentActivity].filter(a=>(!person||a.user_id===person)&&(!action||a.action===action)&&(!q||`${a.document_reference||''} ${a.document_title||''} ${a.file_name||''} ${activityPersonName(a)} ${activityActionLabel(a.action)}`.toLowerCase().includes(q))).sort((a,b)=>new Date(b.occurred_at||0)-new Date(a.occurred_at||0))}
function renderDocumentActivityReport(){const list=$('activityList'),stats=$('activityStats');if(!list||!stats)return;const rows=filteredDocumentActivity();stats.innerHTML=[['Events',rows.length,'neutral'],['Opened',rows.filter(x=>x.action==='OPENED').length,'neutral'],['Reviewed',rows.filter(x=>x.action==='REVIEWED'||x.action==='CONTROLLED_REVIEW').length,'green'],['Downloads',rows.filter(x=>x.action==='DOWNLOADED').length,'neutral']].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${n}</strong><span>${l}</span></div>`).join('');list.innerHTML=activityCards(rows)}
function downloadDocumentActivityPdf(){const rows=filteredDocumentActivity().map(a=>({date_time:fmtDateTime(a.occurred_at),user:activityPersonName(a),action:activityActionLabel(a.action),reference:a.document_reference||'',document:a.document_title||a.file_name||'',version:a.version_label||''}));pdfTable('Document Activity Audit',rows,`document-activity-audit-${todayISO()}.pdf`)}

function originalBulkSourceName(v){
  const m=String(v?.notes||'').match(/Bulk imported(?: changed content)? from (.+?), pages?\s+\d+/i);
  return m?clean(m[1]):'';
}
function stripPdfName(name){return clean(String(name||'').replace(/\.pdf$/i,'').replace(/[_-]+/g,' '))}
function isBadSdsTitle(title){
  const t=clean(title);
  if(!t)return true;
  if(/^(?:manufacturer\s+)?(?:material\s+)?safety data sheet$/i.test(t))return true;
  if(/^\d+\s*\/\s*\d+$/.test(t))return true;
  if(/^page\s+\d+(?:\s+of\s+\d+)?$/i.test(t))return true;
  if(/^(?:version|revision|revision date|print date|date of issue|section\s+\d+)\b/i.test(t))return true;
  if(/^[\W_\d]+$/.test(t))return true;
  if(t.length<3)return true;
  if(t.length<60&&/\)$/.test(t)&&!t.includes('('))return true;
  if(/^(?:product name|product identifier|product form|form of product|type of product|product type|physical state|trade name|name of product|chemical name|substance|mixture|article|liquid|solid|gas|aerosol|preparation|not applicable|n\/a|unknown)(?:\s*[:;-].*)?$/i.test(t))return true;
  if(/^(?:product|identifier|form|classification|supplier|manufacturer|details of the supplier|relevant identified uses)\s*:?$/i.test(t))return true;
  // Never expose a combined-pack/source filename as the SDS product title.
  if(/\b(?:sds\s+msds|msds\s+sds)\s+only\b/i.test(t)||/\bno\s+directory\b/i.test(t))return true;
  return false;
}
function cleanSdsCandidate(s){
  let t=clean(s).replace(/^[\s:;\-–—]+/,'').replace(/[\s|]+$/,'');
  t=t.replace(/^(?:Product name|Product identifier|Trade name|Name of product|Chemical name)\s*:?\s*/i,'');
  t=t.replace(/\s+\d+\s*\/\s*\d+\s*$/,'');
  // Stop at another Section 1 field label or metadata/regulatory text.
  t=t.replace(/\s+(?:Product form|Form of product|Type of product|Product code|Article(?: No\.?| number)?|Chemical name|UFI|REACH(?: registration)?|Relevant identified uses|Details of the supplier|Emergency telephone|1\.2\.?\b|SECTION\s+1\b|Revision(?: date)?|Version|Print date|Date of issue|According to|In accordance with|Conforms? to|COMMISSION REGULATION|REGULATION \(EU\)|REGULATION \(EC\)).*$/i,'');
  t=t.replace(/\s*[:;,-]?\s*1\.[12](?:\.\d+)?\s*$/i,'');
  t=t.replace(/[\s:;|,\-–—]+$/,'').trim();
  // Some manufacturer PDFs repeat the product name twice on the first page.
  // Collapse an exact duplicated phrase, e.g. "DIAMOND MATT ... WHITE DIAMOND MATT ... WHITE".
  const words=t.split(/\s+/).filter(Boolean);
  if(words.length>=4&&words.length%2===0){
    const h=words.length/2;
    if(words.slice(0,h).join(' ').toLowerCase()===words.slice(h).join(' ').toLowerCase())t=words.slice(0,h).join(' ');
  }
  if(t.length>140)t=t.slice(0,140).trim();
  return t;
}
function extractSdsProductName(text){
  const t=clean(text);
  // Prefer an explicit Product name value wherever it appears in Section 1.1.
  // This avoids titles being polluted by neighbouring labels such as
  // "Product form: Article" or "1.1 Product identifier".
  const explicitName=t.match(/\bProduct\s+name\s*:?\s*([\s\S]{2,180}?)(?=\s+(?:Product form|Form of product|Type of product|Product code|Article(?: No\.?| number)?|Chemical name|Trade name|UFI|REACH|1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\b))/i);
  if(explicitName){
    let c=cleanSdsCandidate(explicitName[1]);
    if(/^110\/111\/112\/G136\s*-\s*FLOOR PAINT \(ALL HOUSE COLOURS\)$/i.test(c))
      c='Coo-Var Floor Paint (All House Colours) - 110/111/112/G136';
    if(c&&!isBadSdsTitle(c))return c;
  }
  // First isolate Section 1.1. Many manufacturer sheets put "Product form"
  // before the actual Product name; never use those generic field values.
  const blockMatch=t.match(/\b1\.1\.?\s*Product identifier\b([\s\S]{0,900}?)(?=\b1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\s+2\b)/i);
  const block=blockMatch?blockMatch[1]:'';
  const fieldPatterns=[
    /\bGHS product identifier\s*:?\s*([\s\S]{2,220}?)(?=\s+(?:e-?mail address|Product use|Product form|Form of product|Type of product|Product code|Article(?: No\.?| number)?|Chemical name|Trade name|UFI|REACH|1\.3\.?\b|Details of the supplier|Date of previous issue|1\.4\b|Version|Telephone number|SECTION\b))/i,
    /\bProduct name\s*:?\s*([\s\S]{2,180}?)(?=\s+(?:Product form|Form of product|Type of product|Product code|Article(?: No\.?| number)?|Chemical name|Trade name|UFI|REACH|1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\b))/i,
    /\bTrade name\s*:?\s*([\s\S]{2,180}?)(?=\s+(?:Product form|Form of product|Type of product|Product code|Article(?: No\.?| number)?|Chemical name|UFI|REACH|1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\b))/i,
    /\bName of product\s*:?\s*([\s\S]{2,180}?)(?=\s+(?:Product form|Form of product|Type of product|Product code|Article(?: No\.?| number)?|UFI|REACH|1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\b))/i
  ];
  for(const scope of [block,t]){
    if(!scope)continue;
    for(const rx of fieldPatterns){const m=scope.match(rx);if(m){const c=cleanSdsCandidate(m[1]);if(c&&!isBadSdsTitle(c))return c}}
  }
  // Fallback only when Product identifier itself has a real value, not a field label.
  const fallbacks=[
    /\b1\.1\.?\s*Product identifier\s*:?\s*([\s\S]{3,180}?)(?=\s+(?:Product form|Form of product|Type of product|Product code|UFI|REACH|1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\b))/i,
    /\bProduct identifier\s*:?\s*([\s\S]{3,180}?)(?=\s+(?:Product form|Form of product|Type of product|Product code|UFI|REACH|1\.2\.?\b|Relevant identified uses|Details of the supplier|SECTION\b))/i,
    /\bSAFETY DATA SHEET\s+([\s\S]{3,110}?)(?=\s+\d+\s*\/\s*\d+\b)/i
  ];
  for(const rx of fallbacks){const m=t.match(rx);if(m){const c=cleanSdsCandidate(m[1]);if(c&&!isBadSdsTitle(c))return c}}
  return '';
}
function cleanRaTitleCandidate(value,ref=''){
  let t=clean(value);
  if(!t)return '';
  // legacy RAs commonly print "RA-007 - Title" directly below the heading.
  // Remove only the LEADING reference; older code removed everything after it.
  const refEsc=String(ref||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(refEsc)t=t.replace(new RegExp(`^\\s*${refEsc}\\s*[-–—:]?\\s*`,'i'),'').trim();
  t=t.replace(/^RISK\s+ASSESSMENT\s*/i,'').replace(/^TASK\s+RISK\s+ASSESSMENT\s*/i,'').trim();
  t=t.replace(/\s+(?:Marriott\s+Portsmouth|Adopted\s+on|Department\s*\/\s*job\s+title|RA\s+Reference|Location|Persons\s+at\s+risk|Task|Scope|Frequency|Linked\s+(?:controls|documents|assessments)|Related\s+(?:document|documents|assessments)|Chemical\s+controls|Typical\s+location|Fuel\s+handling|Existing\s+features)\b.*$/i,'').trim();
  if(!t||t.length<4||t.length>180)return '';
  if(/SHIELD\s+SAFETY|CONTROL\s+MEASURES|\bHAZARDS?\b|RISK\s+RATING|SEVERITY|LIKELIHOOD|PEOPLE\s+EXPOSED|Page\s+\d+|Version\b/i.test(t))return '';
  if(/^(?:Surface and Work Area Checks|Dust Control and PPE|Sanding Equipment|Product and COSHH Checks|Fire and Ventilation|Application and Spill Control|Access and Surface Preparation|Housekeeping and Waste|Storage, Waste and Completion)$/i.test(t))return '';
  if(/\b(?:Follow\s+RA-|Follow\s+SSW-|Follow\s+COSHH-|reposition\s+access\s+equipment|avoid\s+prolonged|keep\s+hands|wear\s+eye\s+protection)\b/i.test(t))return '';
  if(t.length>120&&/[.!?]/.test(t))return '';
  return t.replace(/\s+/g,' ').trim();
}
function extractRiskAssessmentTitle(text,ref=''){
  const raw=String(text||'').replace(/\r/g,'\n');
  const lines=raw.split(/\n+/).map(clean).filter(Boolean);
  // Most current legacy RAs expose the exact controlled title as
  // "RA-005 - Use of Hazardous Paint - Brush and Roller Application".
  if(ref){
    const refEsc=String(ref).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    for(const l of lines.slice(0,18)){
      const m=l.match(new RegExp(`^\\s*${refEsc}\\s*[-–—:]\\s*(.+)$`,'i'));
      if(m){const c=cleanRaTitleCandidate(m[1],ref);if(c)return c;}
    }
  }
  // Also accept any RA-xxx title line on the first page when the stored ref is blank.
  for(const l of lines.slice(0,18)){
    const m=l.match(/^\s*RA-\d{3}\s*[-–—:]\s*(.+)$/i);
    if(m){const c=cleanRaTitleCandidate(m[1],ref);if(c)return c;}
  }
  // TASK RISK ASSESSMENT (e.g. RA-004) prints the title immediately below the heading.
  let idx=lines.findIndex(x=>/^(?:TASK\s+)?RISK\s+ASSESSMENT$/i.test(x));
  if(idx>=0){
    const parts=[];
    for(let i=idx+1;i<Math.min(lines.length,idx+6);i++){
      const l=clean(lines[i]);
      if(!l)continue;
      if(/^(?:Department|Location|Persons\s+at\s+risk|Task|Scope|Frequency|Linked\s+(?:controls|documents|assessments)|Related\s+(?:document|documents|assessments)|Chemical\s+controls|Typical\s+location|Fuel\s+handling|Existing\s+features)\b/i.test(l))break;
      if(/SHIELD\s+SAFETY|Maintenance\s+RA|Page\s+\d+/i.test(l))continue;
      parts.push(l);
      const c=cleanRaTitleCandidate(parts.join(' '),ref);if(c)return c;
    }
  }
  // Legacy RA layout: title immediately before Marriott Portsmouth.
  const hotelIndex=lines.findIndex(x=>/^Marriott\s+Portsmouth$/i.test(x));
  if(hotelIndex>0){
    const parts=[];
    for(let i=hotelIndex-1;i>=0&&parts.length<3;i--){
      const l=clean(lines[i]);if(!l)continue;
      if(/SHIELD\s+SAFETY|(?:TASK\s+)?RISK\s+ASSESSMENT|Maintenance\s+RA|Page\s+\d+|SECTION\s+\d/i.test(l))break;
      if(/^Maintenance$/i.test(l))continue;
      parts.unshift(l);
    }
    const c=cleanRaTitleCandidate(parts.join(' '),ref);if(c)return c;
  }
  const flat=clean(raw);
  if(ref){
    const refEsc=String(ref).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const m=flat.match(new RegExp(`\\b${refEsc}\\s*[-–—:]\\s*(.{4,180}?)(?=\\s+(?:Department|Location|Scope|Task|Frequency|Linked|Related|Chemical|Typical|Fuel|Existing)\\b)`,'i'));
    if(m){const c=cleanRaTitleCandidate(m[1],ref);if(c)return c;}
  }
  return '';
}
async function pdfFirstPageTextFromBlob(blob){
  if(!blob||!window.pdfjsLib)return '';
  const pdf=await pdfjsLib.getDocument({data:(await blob.arrayBuffer()).slice(0)}).promise;
  if(!pdf.numPages)return '';
  const pg=await pdf.getPage(1),c=await pg.getTextContent();
  const out=[];let line='';
  for(const it of c.items||[]){const t=String(it.str||'').trim();if(t)line+=(line?' ':'')+t;if(it.hasEOL){if(clean(line))out.push(clean(line));line=''}}
  if(clean(line))out.push(clean(line));
  return out.join('\n');
}
async function repairRaTitles(options={}){
  const {silent=false,refreshAfter=true,progress=null}=options&&typeof options==='object'?options:{};
  if(!isAdmin()&&!state.user){if(!silent)toast('Admin access required.');return {changed:0,failed:0}}
  const docs=state.documents.filter(d=>d.status!=='ARCHIVED'&&d.doc_type==='RISK_ASSESSMENT');
  if(!docs.length){if(!silent)toast('No active Risk Assessments found.');return {changed:0,failed:0}}
  const status=$('raRepairStatus');if(!silent&&status){status.hidden=false;status.textContent=`Checking ${docs.length} Risk Assessment title${docs.length===1?'':'s'}…`}
  let changed=0,failed=0;
  for(let i=0;i<docs.length;i++){
    const d=docs[i],v=currentVersion(d.id);if(!v?.storage_path)continue;
    const msg=`Checking RA ${i+1} of ${docs.length}: ${d.reference||d.title}`;
    if(progress)progress(msg);if(!silent&&status)status.textContent=msg;
    try{
      const r=await sb.storage.from('safety-files').download(v.storage_path);if(r.error||!r.data){failed++;continue}
      const first=await pdfFirstPageTextFromBlob(r.data),extracted=extractRiskAssessmentTitle(first,d.reference||'');
      const finalTitle=extracted||clean(d.title);
      if(extracted&&clean(extracted)!==clean(d.title)){
        const u=await sb.from('documents').update({title:extracted}).eq('id',d.id);if(u.error){failed++;continue}
        d.title=extracted;changed++;
      }
      // Auto-managed Training must always mirror the corrected controlled-document title.
      const desiredName=`${d.reference?d.reference+' - ':''}${finalTitle}`;
      for(const t of state.training.filter(t=>t.auto_managed===true&&t.source_document_id===d.id&&t.status!=='ARCHIVED')){
        if(clean(t.name)!==clean(desiredName)){
          const u=await sb.from('training_sessions').update({name:desiredName}).eq('id',t.id);
          if(!u.error){t.name=desiredName;changed++;}
        }
      }
    }catch(e){console.warn('repairRaTitles',d.id,e);failed++}
  }
  if(refreshAfter)await refresh();
  if(!silent&&status){status.hidden=false;status.textContent=`Risk Assessment title/training alignment complete: ${changed} update${changed===1?'':'s'}${failed?`, ${failed} could not be read`:''}.`}
  if(!silent)toast(`${changed} Risk Assessment/document training update${changed===1?'':'s'} applied.`);
  return {changed,failed};
}
function documentDisplayTitle(d){
  if(!d)return '';
  if(d.doc_type!=='SDS'||!isBadSdsTitle(d.title))return d.title||'';
  // Never expose a combined-pack/source filename as an SDS title. If extraction has
  // not succeeded yet, show a neutral repair prompt until Force Sync reads Section 1.1.
  return 'SDS / MSDS (title needs repair)';
}
function sdsVersionsForTitleRepair(docId){
  // Pending-only documents used to be skipped because title repair looked only at CURRENT.
  // Prefer the newest pending version, then current, then any remaining versions.
  const all=state.versions.filter(v=>v.document_id===docId&&v.storage_path);
  return all.sort((a,b)=>{
    const rank=v=>versionApprovalStatus(v)==='PENDING'?3:(v.status==='CURRENT'?2:1);
    const r=rank(b)-rank(a);
    return r||new Date(b.created_at||0)-new Date(a.created_at||0);
  });
}
async function repairSdsTitles(options={}){
  const {silent=false,refreshAfter=true,progress=null}=options&&typeof options==='object'?options:{};
  if(!isAdmin()&&!state.user){if(!silent)toast('Admin access required.');return {changed:0,failed:0}}
  const docs=state.documents.filter(d=>d.status!=='ARCHIVED'&&d.doc_type==='SDS');
  if(!docs.length){if(!silent)toast('No active SDS/MSDS documents found.');return {changed:0,failed:0}}
  const status=$('sdsRepairStatus');if(!silent&&status){status.hidden=false;status.textContent=`Checking ${docs.length} SDS/MSDS title${docs.length===1?'':'s'}…`}
  let changed=0,failed=0;
  for(let i=0;i<docs.length;i++){
    const d=docs[i],versions=sdsVersionsForTitleRepair(d.id);if(!versions.length)continue;
    const msg=`Checking SDS/MSDS ${i+1} of ${docs.length}: ${documentDisplayTitle(d)}`;
    if(progress)progress(msg);if(!silent&&status)status.textContent=msg;
    let title='',readAny=false;
    try{
      for(const v of versions){
        const r=await sb.storage.from('safety-files').download(v.storage_path);
        if(r.error||!r.data)continue;
        readAny=true;
        const text=await pdfTextFromBlob(r.data);
        title=extractSdsProductName(text);
        if(title&&!isBadSdsTitle(title))break;
        title='';
      }
      if(!readAny){failed++;continue}
      if(title&&!isBadSdsTitle(title)&&clean(title)!==clean(d.title)){
        const u=await sb.from('documents').update({title}).eq('id',d.id);if(u.error){failed++;continue}
        d.title=title;changed++;
      }
    }catch(e){console.warn('repairSdsTitles',d.id,e);failed++}
  }
  if(refreshAfter)await refresh();
  if(!silent&&status){status.hidden=false;status.textContent=`SDS/MSDS title repair complete: ${changed} updated${failed?`, ${failed} could not be read`:''}.`}
  if(!silent)toast(`${changed} SDS/MSDS title${changed===1?'':'s'} updated.`);
  return {changed,failed};
}

async function loadTable(table,target,optional=false){
  const r=await sb.from(table).select('*');
  if(r.error){state.loadErrors[table]=r.error.message;if(!optional)console.warn(table,r.error);state[target]=[];return false}
  delete state.loadErrors[table];state[target]=r.data||[];return true;
}
const offlineSnapshotKey=uid=>`safetyTrackerOfflineSnapshot:v283:${uid||'unknown'}`;
const offlineFileCacheName=uid=>`safety-user-files-v283-${String(uid||'unknown').replace(/[^a-z0-9_-]/gi,'')}`;
function buildOfflineSnapshot(){
  const uid=state.user?.id;if(!uid||!state.profile)return null;
  const assignments=state.trainingAssignments.filter(a=>a.user_id===uid&&a.active!==false),assignmentIds=new Set(assignments.map(a=>a.id)),trainingIds=new Set(assignments.map(a=>a.training_session_id));
  const training=state.training.filter(t=>trainingIds.has(t.id));
  const trainingDocumentLinks=state.trainingDocumentLinks.filter(x=>trainingIds.has(x.training_session_id));
  const docIds=new Set(training.map(t=>t.source_document_id).filter(Boolean));trainingDocumentLinks.forEach(x=>x.document_id&&docIds.add(x.document_id));
  let changed=true;while(changed){changed=false;state.documentLinks.forEach(l=>{if(docIds.has(l.source_document_id)&&l.target_document_id&&!docIds.has(l.target_document_id)){docIds.add(l.target_document_id);changed=true}if(docIds.has(l.target_document_id)&&l.source_document_id&&!docIds.has(l.source_document_id)){docIds.add(l.source_document_id);changed=true}})}
  const documents=state.documents.filter(d=>docIds.has(d.id));
  const versions=state.versions.filter(v=>docIds.has(v.document_id)&&v.status==='CURRENT'&&isVersionApproved(v));
  const trainingFiles=state.trainingFiles.filter(f=>trainingIds.has(f.training_session_id));
  const awarenessAssignments=state.awarenessAssignments.filter(a=>a.user_id===uid&&a.active!==false),awarenessIds=new Set(awarenessAssignments.map(a=>a.awareness_item_id));
  const ppeAssignments=state.ppeAssignments.filter(a=>a.user_id===uid&&a.active!==false),ppeIds=new Set(ppeAssignments.map(a=>a.ppe_item_id));
  const ppeChecks=state.ppeChecks.filter(c=>c.user_id===uid),ppeCheckIds=new Set(ppeChecks.map(c=>c.id));
  return {savedAt:new Date().toISOString(),profile:state.profile,people:[state.profile],documents,versions,documentLinks:state.documentLinks.filter(l=>docIds.has(l.source_document_id)||docIds.has(l.target_document_id)),documentReviews:[],training,trainingAssignments:assignments,trainingSignoffs:state.trainingSignoffs.filter(s=>assignmentIds.has(s.training_assignment_id)),trainingExceptions:state.trainingExceptions.filter(s=>assignmentIds.has(s.training_assignment_id)),trainingConfirmations:state.trainingConfirmations.filter(c=>assignmentIds.has(c.assignment_id)),trainingFiles,trainingDocumentLinks,historicalDocAssignments:[],historicalDocSignoffs:[],historicalDocConfirmations:[],documentActivity:state.documentActivity.filter(a=>a.user_id===uid),awarenessItems:state.awarenessItems.filter(i=>awarenessIds.has(i.id)),awarenessAssignments,awarenessActivity:state.awarenessActivity.filter(a=>a.user_id===uid),ppeItems:state.ppeItems.filter(i=>ppeIds.has(i.id)),ppeAssignments,ppeChecks,ppeCheckItems:state.ppeCheckItems.filter(i=>ppeCheckIds.has(i.check_id)),ppeAlertQueue:[],reportSchedules:[],generatedReports:[],reportEmailLog:[],departments:state.departments,userDepartments:state.userDepartments.filter(x=>x.user_id===uid),documentAudiences:[],trainingAudiences:[],awarenessAudiences:[],ppeAudiences:[],settings:state.settings,siteLocations:state.siteLocations,asbestosSources:state.asbestosSources,asbestosEntries:state.asbestosEntries};
}
function saveOfflineSnapshot(){try{const snap=buildOfflineSnapshot();if(snap)localStorage.setItem(offlineSnapshotKey(state.user?.id),JSON.stringify(snap))}catch(e){console.warn('Offline snapshot save failed',e)}}
function restoreOfflineSnapshot(uid){try{const raw=localStorage.getItem(offlineSnapshotKey(uid));if(!raw)return false;const snap=JSON.parse(raw);if(!snap?.profile)return false;state.profile=snap.profile;for(const k of ['people','documents','versions','documentLinks','documentReviews','training','trainingAssignments','trainingSignoffs','trainingExceptions','trainingConfirmations','trainingFiles','trainingDocumentLinks','historicalDocAssignments','historicalDocSignoffs','historicalDocConfirmations','documentActivity','awarenessItems','awarenessAssignments','awarenessActivity','ppeItems','ppeAssignments','ppeChecks','ppeCheckItems','ppeAlertQueue','reportSchedules','generatedReports','reportEmailLog','departments','userDepartments','documentAudiences','trainingAudiences','awarenessAudiences','ppeAudiences','settings','siteLocations','asbestosSources','asbestosEntries'])state[k]=snap[k]||[];state.offlineSnapshotAt=snap.savedAt||null;populateFilters();return true}catch(e){console.warn('Offline snapshot restore failed',e);return false}}
async function cacheSafetyBlob(kind,id,blob){if(!blob||!state.user?.id||!('caches'in window))return;try{const c=await caches.open(offlineFileCacheName(state.user.id)),u=`${location.origin}${location.pathname}?offline-file=${encodeURIComponent(kind+':'+id)}`;await c.put(u,new Response(blob,{headers:{'Content-Type':blob.type||'application/pdf','Cache-Control':'private, max-age=31536000'}}))}catch(e){console.warn('Offline PDF cache failed',e)}}
async function cachedSafetyBlob(kind,id){if(!state.user?.id||!('caches'in window))return null;try{const c=await caches.open(offlineFileCacheName(state.user.id)),u=`${location.origin}${location.pathname}?offline-file=${encodeURIComponent(kind+':'+id)}`,r=await c.match(u);return r?await r.blob():null}catch{return null}}
async function clearOfflineUserData(uid){try{localStorage.removeItem(offlineSnapshotKey(uid));if('caches'in window)await caches.delete(offlineFileCacheName(uid))}catch{}}
async function warmOfflineFiles(){if(state.offline||!navigator.onLine||!state.user?.id)return;const jobs=[];for(const {a,t} of myActiveAssignments()){for(const m of requiredTrainingMaterials(a,t)){if(m.available===false)continue;if(m.kind==='DOCUMENT'&&m.version?.storage_path)jobs.push(['document',m.version.id,m.version.storage_path]);if(m.kind==='TRAINING_FILE'&&m.file?.storage_path)jobs.push(['training',m.file.id,m.file.storage_path])}}const seen=new Set();for(const [kind,id,path] of jobs.slice(0,30)){const key=kind+':'+id;if(seen.has(key))continue;seen.add(key);if(await cachedSafetyBlob(kind,id))continue;try{const r=await sb.storage.from('safety-files').download(path);if(!r.error&&r.data)await cacheSafetyBlob(kind,id,r.data)}catch{}}}
async function loadAll(){
  if(!sb)return;
  state.loadErrors={};
  await Promise.all([
    loadTable('profiles','people'),loadTable('documents','documents'),loadTable('document_versions','versions'),
    loadTable('document_links','documentLinks',true),loadTable('document_reviews','documentReviews',true),
    loadTable('training_sessions','training'),loadTable('training_assignments','trainingAssignments'),loadTable('training_signoffs','trainingSignoffs'),loadTable('training_exceptions','trainingExceptions',true),
    loadTable('training_delivery_confirmations','trainingConfirmations',true),loadTable('training_files','trainingFiles',true),
    loadTable('training_document_links','trainingDocumentLinks',true),loadTable('document_activity','documentActivity',true),
    loadTable('document_assignments','historicalDocAssignments',true),loadTable('document_signoffs','historicalDocSignoffs',true),loadTable('document_delivery_confirmations','historicalDocConfirmations',true),
    loadTable('safety_awareness_items','awarenessItems',true),loadTable('safety_awareness_assignments','awarenessAssignments',true),loadTable('safety_awareness_activity','awarenessActivity',true),
    loadTable('ppe_items','ppeItems',true),loadTable('ppe_assignments','ppeAssignments',true),loadTable('ppe_monthly_checks','ppeChecks',true),loadTable('ppe_monthly_check_items','ppeCheckItems',true),loadTable('ppe_alert_queue','ppeAlertQueue',true),
    loadTable('report_schedules','reportSchedules',true),loadTable('generated_reports','generatedReports',true),loadTable('report_email_log','reportEmailLog',true),
    loadTable('departments','departments',true),loadTable('user_departments','userDepartments',true),loadTable('document_training_audiences','documentAudiences',true),loadTable('training_session_audiences','trainingAudiences',true),loadTable('awareness_item_audiences','awarenessAudiences',true),loadTable('ppe_item_audiences','ppeAudiences',true),
    loadTable('safety_tracker_settings','settings',true),
    loadTable('site_locations_v280','siteLocations',true),loadTable('asbestos_source_documents_v280','asbestosSources',true),loadTable('asbestos_register_entries_v280','asbestosEntries',true),loadTable('contractor_permits_v280','contractorPermits',true),loadTable('contractor_permit_events_v280','contractorPermitEvents',true)
  ]);
  state.people.sort((a,b)=>String(a.display_name||a.email).localeCompare(String(b.display_name||b.email)));
  populateFilters();
  if(navigator.onLine){state.offline=false;saveOfflineSnapshot();setTimeout(()=>warmOfflineFiles().catch(()=>{}),50)}
}

async function loadReportViewerData(){
  if(!sb)return;
  state.loadErrors={};
  await Promise.all([
    loadTable('generated_reports','generatedReports',true),
    loadTable('safety_tracker_settings','settings',true),
    loadTable('site_locations_v280','siteLocations',true),loadTable('asbestos_source_documents_v280','asbestosSources',true),loadTable('asbestos_register_entries_v280','asbestosEntries',true),loadTable('contractor_permits_v280','contractorPermits',true),loadTable('contractor_permit_events_v280','contractorPermitEvents',true)
  ]);
  state.reportEmailLog=[];
}

function populateFilters(){
  const docTypes=['RISK_ASSESSMENT','COSHH','SSW','SDS','TOOLBOX_TALK','POLICY','PROCEDURE','OTHER'];
  if($('documentTypeFilter')){
    const el=$('documentTypeFilter'),keep=el.value;
    el.innerHTML='<option value="">All types</option>'+docTypes.map(x=>`<option value="${x}">${esc(x==='TOOLBOX_TALK'?'Toolbox Talk':docTypeLabel(x))}</option>`).join('');
    if([...el.options].some(o=>o.value===keep))el.value=keep;
  }
  const tOpts=trainingKinds.map(x=>`<option value="${x}">${esc(kindLabel(x))}</option>`).join('');
  if($('trainingTypeFilter')){
    const el=$('trainingTypeFilter'),keep=el.value;
    el.innerHTML='<option value="">All types</option>'+tOpts;
    if([...el.options].some(o=>o.value===keep))el.value=keep;
  }
  if($('complianceTypeFilter')){
    const el=$('complianceTypeFilter'),keep=el.value;
    el.innerHTML='<option value="">All training types</option>'+tOpts;
    if([...el.options].some(o=>o.value===keep))el.value=keep;
  }
  const peopleOpts=activePeople().map(p=>`<option value="${p.id}">${esc(p.display_name||p.email)}</option>`).join('');
  if($('compliancePersonFilter'))$('compliancePersonFilter').innerHTML='<option value="">All people</option>'+peopleOpts;
  if($('activityPersonFilter'))$('activityPersonFilter').innerHTML='<option value="">All people</option>'+peopleOpts;
  const instructor=activeTraining().filter(t=>state.trainingAssignments.some(a=>a.training_session_id===t.id&&a.active!==false&&effectiveTrainingMethod(t,a)==='INSTRUCTOR_LED')).sort((a,b)=>a.name.localeCompare(b.name));
  if($('groupTrainingSelect'))$('groupTrainingSelect').innerHTML='<option value="">Select training</option>'+instructor.map(t=>`<option value="${t.id}">${esc(trainingReference(t)?trainingReference(t)+' - '+t.name:t.name)}</option>`).join('');
}

function showView(name,{push=true}={}){
  if(!canAccessView(name))name=isReportViewer()?'reports':'mySafety';
  currentViewName=name;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
  document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  $(name+'View')?.classList.add('active-view');
  if(name==='mySafety')renderMySafety();if(name==='hsTraining')renderHsTraining();if(name==='documents')renderDocuments();if(name==='creator')renderCreator();if(name==='training')renderTraining();if(name==='awareness')renderAwareness();if(name==='ppe')renderPpe();if(name==='onsite')renderOnSite();if(name==='asbestos')renderAsbestosLookup();if(name==='people')renderPeople();if(name==='compliance')renderCompliance();if(name==='instructor')renderInstructor();if(name==='reports')renderReports();if(name==='admin')renderAdmin();if(name==='help')renderHelp();
  if(navigationReady&&push){
    const st=history.state;
    if(!(st?.safetyTracker&&!st.modal&&!st.guard&&st.view===name))history.pushState(safetyNavState({view:name,modal:false,guard:false}),'',location.href);
  }
}
async function refresh(msg){if(isReportViewer()){await loadReportViewerData();renderReports();if(msg)toast(msg);return}await loadAll();renderMySafety();if(isManager())renderDocuments();if(isManager())renderCreator();if(isManager())renderTraining();renderAwareness();renderPpe();renderOnSite();if(isMaintenanceUser())renderAsbestosLookup();if(isManager()){renderPeople();renderCompliance();renderInstructor();renderReports()}if(isAdmin())renderAdmin();if(msg)toast(msg)}

let actionRouterInstalled=false;
function installActionRouter(){
  if(actionRouterInstalled)return;
  actionRouterInstalled=true;
  document.addEventListener('click',e=>{
    Promise.resolve(globalClick(e)).catch(err=>{
      console.error('Safety Tracker button action failed',err);
      toast(`Action failed: ${err?.message||'unknown error'}`);
    });
  },true);
  window.__SAFETY_ACTION_ROUTER='v2.9.11-capture';
}

async function init(){
  const boot=$('loginBootStatus');if(boot)boot.textContent='Checking secure sign-in…';
  installActionRouter();
  if(new URLSearchParams(location.search).get('demo')==='1'){if(boot)boot.textContent='Starting safe demo…';return;}
  if(!configured){if(boot)boot.textContent='Configuration missing.';showAuthMessage('Safety Tracker config.js is missing or invalid. Re-upload the working Safety Tracker config.js, then reload.');return}
  const authParams=new URLSearchParams((location.hash||'').replace(/^#/,''));
  const authError=authParams.get('error_description')||new URLSearchParams(location.search).get('error_description');
  if(authError)showAuthMessage(decodeURIComponent(authError.replace(/\+/g,' ')));
  if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  $('loginForm').addEventListener('submit',login);$('contractorBackBtn')?.addEventListener('click',closeContractorPortal);$('forgotPasswordBtn').addEventListener('click',forgotPassword);$('signOutBtn')?.addEventListener('click',forceLocalSignOut);$('adminUserModeBtn')?.addEventListener('click',toggleAdminUserMode);
  $('completePasswordSetupBtn').addEventListener('click',completeMandatoryPasswordSetup);$('modalCloseBtn').addEventListener('click',closeModal);
  window.addEventListener('popstate',handleSafetyPopstate);
  $('mainNav').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(b)showView(b.dataset.view)});
  $('newDocumentBtn').addEventListener('click',showNewDocument);$('newContractorStaffBtn')?.addEventListener('click',()=>showContractorPortal('STAFF'));$('accessOnlyStaffBtn')?.addEventListener('click',()=>showAccessOnlyPortal());$('asbestosLocationSelect')?.addEventListener('change',renderAsbestosLookup);$('uploadAsbestosSourceBtn')?.addEventListener('click',uploadAsbestosSourceDocument);$('newTrainingBtn').addEventListener('click',showNewTraining);$('inviteUserBtn').addEventListener('click',showInviteUser);
  $('documentSearch').addEventListener('input',renderDocuments);
  $('documentTypeFilter').addEventListener('change',()=>{
    // In Register, keep the Register open and filter its sections.
    // In an individual index, switching the dropdown returns to the all-documents view
    // so the selected type can take effect immediately.
    if((state.documentIndex||'ALL')!=='REGISTER')state.documentIndex='ALL';
    renderDocuments();
  });
  $('documentStatusFilter').addEventListener('change',renderDocuments);
  $('documentIndexBackBtn')?.addEventListener('click',()=>{state.documentIndex='ALL';$('documentTypeFilter').value='';renderDocuments()});
  ['trainingSearch','trainingTypeFilter','trainingStatusFilter'].forEach(id=>$(id).addEventListener('input',renderTraining));
  ['awarenessSearch','awarenessStatusFilter'].forEach(id=>$(id)?.addEventListener('input',renderAwareness));
  ['ppeSearch','ppeStatusFilter'].forEach(id=>$(id)?.addEventListener('input',renderPpe));
  ['compliancePersonFilter','complianceTypeFilter','complianceStatusFilter'].forEach(id=>$(id).addEventListener('input',renderCompliance));
  ['activitySearch','activityPersonFilter','activityActionFilter'].forEach(id=>$(id)?.addEventListener('input',renderDocumentActivityReport));
  $('openGroupAttendanceBtn').addEventListener('click',()=>{const id=$('groupTrainingSelect').value;if(!id)return toast('Select training first.');showInstructorGroupAttendance(id)});
  $('forceSyncBtn')?.addEventListener('click',forceSyncFromUI);$('repairSdsTitlesBtn')?.addEventListener('click',repairSdsTitles);$('repairRaTitlesBtn')?.addEventListener('click',repairRaTitles);$('storageCleanupBtn')?.addEventListener('click',scanStorageCleanup);$('outstandingPdfBtn')?.addEventListener('click',()=>downloadReport('outstanding'));$('documentActivityPdfBtn')?.addEventListener('click',downloadDocumentActivityPdf);$('trainingMatrixPdfBtn')?.addEventListener('click',()=>downloadReport('matrix'));$('trainingExcelBtn')?.addEventListener('click',downloadTrainingExcel);$('trainingSignoffsPdfBtn')?.addEventListener('click',()=>downloadReport('signoffs'));$('reviewDatesPdfBtn')?.addEventListener('click',()=>downloadReport('reviews'));$('backupBtn')?.addEventListener('click',downloadBackup);$('fullBackupBtn')?.addEventListener('click',downloadFullBackup);
  $('generateMonthlyReportBtn')?.addEventListener('click',()=>runMonthlyReportButton());
  $('permitReportPreviewBtn')?.addEventListener('click',renderPermitReportPreview);$('permitReportPdfBtn')?.addEventListener('click',downloadPermitReportPdf);$('permitReportCsvBtn')?.addEventListener('click',downloadPermitReportCsv);
  $('generatePpeReportBtn')?.addEventListener('click',()=>runPpeReportButton());
  $('newReportScheduleBtn')?.addEventListener('click',showNewReportSchedule);$('evidencePackBtn')?.addEventListener('click',()=>showEvidencePackPicker());
  const recoveryRoute=new URLSearchParams(location.search).get('recovery')==='1';
  try{
    let session=null,sessionError=null;
    // Mobile pull-to-refresh can initialise the page before Android has made persisted auth storage/network ready.
    // Retry both the normal Supabase session and the independent IndexedDB recovery copy before deciding there is no login.
    for(let attempt=0;attempt<8&&!session;attempt++){
      try{const r=await sb.auth.getSession();session=r.data?.session||null;if(r.error)sessionError=r.error}catch(e){sessionError=e}
      if(!session){try{session=await recoverDurableSession()}catch{}}
      if(!session&&attempt<7)await new Promise(resolve=>setTimeout(resolve,250+attempt*150));
    }
    if(session){await saveDurableSession(session);if(recoveryRoute)showRecoveryPasswordSetup(session.user);else await enterApp(session.user)}
    else{
      let recoveryExists=false;try{recoveryExists=!!(await authDbGet(AUTH_RECOVERY_KEY))}catch{}
      if(recoveryExists&&!recoveryRoute){showSessionReconnect(null,'Your saved login is still on this phone. Safety Tracker is waiting for Android to restore the session; it will retry automatically.');setTimeout(()=>location.reload(),1800)}
      else{showLogin();if(recoveryRoute)showAuthMessage('This password reset link is invalid or has expired. Request a new reset email and use the newest link only.');}
    }
    if(boot&&!session)boot.textContent='Restoring sign-in…';
  }catch(e){if(boot)boot.textContent='Sign-in service error.';showLogin();showAuthMessage(e?.message||'Could not initialise sign-in. Refresh and try again.');}
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(session)await saveDurableSession(session);
    if((event==='PASSWORD_RECOVERY'||(recoveryRoute&&session))&&session){showRecoveryPasswordSetup(session.user);return}
    if(session&&(!state.user||state.user.id!==session.user.id))await enterApp(session.user);
    // A passive SIGNED_OUT event during Android pull-to-refresh is not treated as an intentional logout.
    // Only the Sign out button clears durable credentials. Retry recovery for several seconds first.
    if(event==='SIGNED_OUT'){
      if(signOutInProgress)return;
      let recovered=null;
      for(let attempt=0;attempt<8&&!recovered;attempt++){
        try{const r=await sb.auth.getSession();if(r.data?.session)recovered=r.data.session}catch{}
        if(!recovered)try{recovered=await recoverDurableSession()}catch{}
        if(!recovered&&attempt<7)await new Promise(resolve=>setTimeout(resolve,300+attempt*180));
      }
      if(recovered){await saveDurableSession(recovered);await enterApp(recovered.user);return}
      // Do not erase the recovery copy here. A transient mobile/network failure must not destroy a valid saved login.
      if(state.user){showSessionReconnect(state.user,'Your login is being restored after refresh. Safety Tracker will retry automatically.');setTimeout(()=>enterApp(state.user),1600);return}
      let recoveryExists=false;try{recoveryExists=!!(await authDbGet(AUTH_RECOVERY_KEY))}catch{}
      if(recoveryExists){showSessionReconnect(null,'Your saved login is still on this phone. Safety Tracker is reconnecting after refresh.');setTimeout(()=>location.reload(),2200);return}
      showLogin();
    }
  });
  if('serviceWorker'in navigator)window.addEventListener('load',async()=>{
    try{
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const r of regs){
        const url=r.active?.scriptURL||r.waiting?.scriptURL||r.installing?.scriptURL||'';
        if(url&&url.includes('/Safety-tracker/')&&!url.endsWith('/sw-v2105.js'))await r.unregister();
      }
      const r=await navigator.serviceWorker.register('./sw-v21019.js',{updateViaCache:'none'});
      await r.update().catch(()=>{});
    }catch(e){console.warn('Offline service worker',e)}
  });
  window.addEventListener('offline',()=>{state.offline=true;applyViewModeUi();if(state.user){showView('mySafety',{push:false});renderMySafety();renderAwareness();renderPpe();toast('Offline mode on — saved day-to-day safety information is read-only.')}});
  window.addEventListener('online',async()=>{if(!state.user)return;state.offline=false;try{await loadAll();state.uiMode=preferredUiMode();applyViewModeUi();showView(canAccessView(currentViewName)?currentViewName:'mySafety',{push:false});toast('Connection restored. Safety Tracker is live again.')}catch(e){state.offline=true;applyViewModeUi();toast('Connection is still unavailable. Remaining in offline mode.')}});
}
function showLogin(){$('appView').hidden=true;$('authView').hidden=false;$('loginForm').hidden=false;$('forgotPasswordBtn').hidden=false;$('passwordSetupArea').hidden=true}
function showSessionReconnect(user,message){$('appView').hidden=true;$('authView').hidden=false;$('loginForm').hidden=true;$('forgotPasswordBtn').hidden=true;$('passwordSetupArea').hidden=true;const m=$('authMessage');if(m){m.hidden=false;m.innerHTML=`<strong>Session retained</strong><br>${esc(message||'Reconnecting to Safety Tracker…')}<div class=\"row\" style=\"margin-top:12px\"><button id=\"sessionRetryBtn\" class=\"primary\" type=\"button\">Retry connection</button><button id=\"sessionSignOutBtn\" class=\"ghost\" type=\"button\">Sign out</button></div>`;$('sessionRetryBtn')?.addEventListener('click',()=>{state.profileReloadAttempts=0;enterApp(user)});$('sessionSignOutBtn')?.addEventListener('click',forceLocalSignOut)}}
async function login(e){e.preventDefault();$('authMessage').hidden=true;const btn=$('loginSubmitBtn'),boot=$('loginBootStatus');if(btn){btn.disabled=true;btn.textContent='Signing in…'}if(boot)boot.textContent='Signing in…';try{const {data,error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)throw error;if(!data?.session)throw new Error('Sign-in did not create a session.');await saveDurableSession(data.session);if(boot)boot.textContent='Signed in. Loading Safety Tracker…';await enterApp(data.user);}catch(err){if(boot)boot.textContent='Ready to sign in.';showAuthMessage(err?.message||'Sign-in failed.');}finally{if(btn){btn.disabled=false;btn.textContent='Sign in'}}}
async function forgotPassword(){
  const email=$('loginEmail')?.value.trim().toLowerCase();
  if(!email)return showAuthMessage('Enter your email address first.');
  const redirectTo=`${SAFETY_APP_URL}?recovery=1&build=280`;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
  showAuthMessage(error?error.message:'Password reset email sent. Use the newest reset email only, then choose a new password on the Safety Tracker page.');
}
function showPasswordReset(user=state.user){showRecoveryPasswordSetup(user)}
function showMandatoryPasswordSetup(user,mode='invite'){
  state.user=user;state.profile=null;
  $('appView').hidden=true;$('authView').hidden=false;$('loginForm').hidden=true;$('forgotPasswordBtn').hidden=true;$('passwordSetupArea').hidden=false;$('authMessage').hidden=true;
  $('passwordSetupArea').dataset.mode=mode;
  if($('passwordSetupTitle'))$('passwordSetupTitle').textContent=mode==='recovery'?'Choose a new password':'Set your password';
  if($('passwordSetupHelp'))$('passwordSetupHelp').textContent=mode==='recovery'?'Enter and confirm your new Safety Tracker password. After it is saved you will sign in again with the new password.':'Invited users must choose their own password before entering Safety Tracker.';
  if($('invitePassword'))$('invitePassword').value='';if($('invitePasswordConfirm'))$('invitePasswordConfirm').value='';
}
function showRecoveryPasswordSetup(user){showMandatoryPasswordSetup(user,'recovery')}
async function completeMandatoryPasswordSetup(){
  const p=$('invitePassword')?.value||'',c=$('invitePasswordConfirm')?.value||'',mode=$('passwordSetupArea')?.dataset.mode||'invite';
  if(!p||p.length<8)return showAuthMessage('Password must be at least 8 characters.');
  if(p!==c)return showAuthMessage('Passwords do not match.');
  const current=state.user?.user_metadata||{};
  const {data,error}=await sb.auth.updateUser({password:p,data:{...current,must_set_password:false,password_set_at:new Date().toISOString()}});
  if(error)return showAuthMessage(error.message);
  if(mode==='recovery'){
    try{history.replaceState(null,'',SAFETY_APP_URL)}catch{}
    const email=data?.user?.email||state.user?.email||'';
    await sb.auth.signOut();
    await clearDurableSession();
    showLogin();
    if($('loginEmail'))$('loginEmail').value=email;
    if($('loginPassword'))$('loginPassword').value='';
    showAuthMessage('Password changed successfully. Sign in with the new password.');
    return;
  }
  const {data:{user}}=await sb.auth.getUser();if(user)await enterApp(user)
}
async function enterApp(user){
  state.user=user;if(user?.user_metadata?.must_set_password===true)return showMandatoryPasswordSetup(user);
  state.offline=!navigator.onLine;
  let data=null,error=null;
  if(navigator.onLine){
    // A mobile pull-to-refresh can briefly report online before the network is ready.
    // Retry the profile lookup instead of signing the user out on a transient fetch failure.
    for(let attempt=0;attempt<3&&!data;attempt++){
      try{
        const r=await sb.from('profiles').select('*').eq('id',user.id).single();
        data=r.data;error=r.error;
      }catch(e){error=e}
      if(!data&&attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
    }
  }
  if((error||!data)&&restoreOfflineSnapshot(user.id)){
    state.offline=true;data=state.profile;
  }else if(error||!data){
    const durableProfile=await readDurableProfile(user.id);
    if(durableProfile){state.offline=true;data=durableProfile}
  }
  if(error||!data){
    state.profileReloadAttempts=(state.profileReloadAttempts||0)+1;
    showSessionReconnect(user,navigator.onLine?'Your login is still active. The phone has refreshed before the profile data finished loading. Safety Tracker will retry automatically.':'Your login is still active. Waiting for a connection to restore your saved Safety Tracker data.');
    if(state.profileReloadAttempts<=6)setTimeout(()=>enterApp(user),900+state.profileReloadAttempts*350);
    return;
  }
  state.profileReloadAttempts=0;
  if(data.active===false){showAuthMessage('This Safety Tracker account is disabled.');if(navigator.onLine){await sb.auth.signOut();await clearDurableSession()}return}
  state.profile=data;await saveDurableProfile(data);state.uiMode=preferredUiMode();
  if(!state.offline){if(isReportViewer())await loadReportViewerData();else await loadAll()}
  $('authView').hidden=true;$('appView').hidden=false;$('currentUserName').textContent=data.display_name||user.email;
  applyViewModeUi();
  const docIntro=$('documentsIntro');if(docIntro)docIntro.textContent='Controlled safety documents are reviewed and approved here. For RA, COSHH RA and SSW, training method, frequency, due period and audience are confirmed at approval; standalone unrelated training is managed in Training.';
  const docStatus=$('documentStatusFilter');if(docStatus&&isStandardUser()){docStatus.innerHTML='<option value="APPROVED">Approved/current</option>';docStatus.value='APPROVED';}
  const initialView=isReportViewer()?'reports':'mySafety';seedSafetyNavigation(initialView);showView(initialView,{push:false});
}

function latestTrainingSignoff(a){return state.trainingSignoffs.filter(s=>s.training_assignment_id===a.id).sort((x,y)=>new Date(y.signed_at||0)-new Date(x.signed_at||0))[0]||null}
function latestTrainingException(a){return state.trainingExceptions.filter(x=>x.training_assignment_id===a.id).sort((x,y)=>new Date(y.completed_at||0)-new Date(x.completed_at||0))[0]||null}
function latestTrainingCompletion(a){const signoff=latestTrainingSignoff(a),exception=latestTrainingException(a);if(!exception)return {evidence:signoff,exception:null};if(!signoff||new Date(exception.completed_at||0)>new Date(signoff.signed_at||0))return {evidence:{...exception,signed_at:exception.completed_at},exception};return {evidence:signoff,exception:null}}
function trainingEvents(a){return state.trainingConfirmations.filter(c=>c.assignment_id===a.id).sort((x,y)=>new Date(y.confirmed_at||0)-new Date(x.confirmed_at||0))}
function latestTrainingConfirmation(a){return trainingEvents(a).find(c=>(c.attendance_status||'ATTENDED')==='ATTENDED')||null}
function latestTrainingEvent(a){return trainingEvents(a)[0]||null}
function freshConfirmation(c,s){return !!c&&(!s||new Date(c.confirmed_at)>new Date(s.signed_at))}
function effectiveTrainingMethod(t,a){return a?.delivery_method_override||t?.delivery_method||defaultTrainingDelivery(trainingKind(t))}
function trainingAssignmentDue(a,s){if(!s)return a.due_date?new Date(a.due_date+'T23:59:59').toISOString():new Date().toISOString();const c=trainingEvents(a).find(x=>(x.attendance_status||'ATTENDED')==='ATTENDED'&&new Date(x.confirmed_at)<=new Date(s.signed_at));return addRenewal(c?.delivery_date||s.signed_at,a.renewal_value,a.renewal_unit)}
function assignmentStatus(a,t){
  const completion=latestTrainingCompletion(a),s=completion.evidence,exception=completion.exception,method=effectiveTrainingMethod(t,a),due=trainingAssignmentDue(a,s),c=latestTrainingConfirmation(a),event=latestTrainingEvent(a),renewalDue=!!(s&&a.renewal_value&&due&&new Date(due)<=new Date()),needs=!s||renewalDue;
  if(!needs)return {code:'COMPLETED',label:exception?'Completed · admin exception':'Completed',badge:'complete',due,s,exception,method,c,event,ready:false};
  if(due&&new Date(due)<new Date())return {code:'OVERDUE',label:'Overdue',badge:'overdue',due,s,exception,method,c,event,ready:freshConfirmation(c,s)};
  if(method==='INSTRUCTOR_LED'){
    if(freshConfirmation(c,s))return {code:'READY_TO_SIGN',label:'Ready to sign',badge:'due',due,s,exception,method,c,event,ready:true};
    if(event?.attendance_status==='ABSENT')return {code:'AWAITING_INSTRUCTOR',label:'Absent / awaiting new session',badge:'due',due,s,exception,method,c,event,ready:false};
    return {code:'AWAITING_INSTRUCTOR',label:'Awaiting instructor',badge:'due',due,s,exception,method,c,event,ready:false};
  }
  return {code:'OUTSTANDING',label:s?'Refresher due':'Not started',badge:'due',due,s,exception,method,c,event,ready:true};
}
function myActiveAssignments(){return state.trainingAssignments.filter(a=>a.user_id===state.user?.id&&a.active!==false).map(a=>({a,t:state.training.find(t=>t.id===a.training_session_id)})).filter(x=>x.t&&x.t.status!=='ARCHIVED'&&trainingSourceApproved(x.t))}
function renderMySafetyOnSiteShortcut(){
  const box=$('mySafetyOnSiteShortcut');if(!box)return;
  if(state.offline||!navigator.onLine){
    box.innerHTML=`<button type="button" class="my-safety-onsite-button traffic-neutral" data-my-safety-onsite><span class="onsite-shortcut-main"><strong>Who's On Site</strong><span>Live connection required to view current contractor attendance.</span></span><span class="onsite-shortcut-action">Open</span></button>`;
    return;
  }
  const rows=(state.contractorPermits||[]).filter(p=>['AWAITING_APPROVAL','ACTIVE','AWAITING_CLOSE'].includes(p.status));
  const activeRows=rows.filter(p=>p.status==='ACTIVE');
  const active=activeRows.length;
  const activePeople=activeRows.reduce((n,p)=>n+contractorTeamSize(p),0);
  const pending=rows.filter(p=>p.status==='AWAITING_APPROVAL').length;
  const close=rows.filter(p=>p.status==='AWAITING_CLOSE').length;
  const overdue=rows.filter(p=>p.status==='ACTIVE'&&p.expected_finish&&new Date(p.expected_finish)<new Date()).length;
  const traffic=overdue?'red':(pending||close?'amber':'green');
  let summary='No contractors currently signed in.';
  if(rows.length){const bits=[];if(active)bits.push(`${activePeople} people across ${active} team${active===1?'':'s'} on site`);if(pending)bits.push(`${pending} awaiting PTW approval`);if(close)bits.push(`${close} awaiting close-out`);if(overdue)bits.push(`${overdue} over expected finish`);summary=bits.join(' · ')}
  const label=overdue?'Action required':pending||close?'Check contractors':active?'Contractors on site':'No one signed in';
  box.innerHTML=`<button type="button" class="my-safety-onsite-button traffic-${traffic}" data-my-safety-onsite><span class="onsite-shortcut-main"><strong>Who's On Site</strong><span>${esc(summary)}</span></span><span class="onsite-shortcut-status">${esc(label)}</span><span class="onsite-shortcut-action">Open</span></button>`;
}


function outstandingAccessKeys(){
  return (state.contractorPermits||[]).filter(p=>p.access_key_issued_at&&!p.access_key_returned_at).sort((a,b)=>new Date(a.access_key_issued_at||a.created_at||0)-new Date(b.access_key_issued_at||b.created_at||0));
}
function renderMySafetyKeyShortcut(){
  const box=$('mySafetyKeyShortcut');if(!box)return;
  if(state.offline||!navigator.onLine){
    box.innerHTML=`<button type="button" class="my-safety-onsite-button key-shortcut-button traffic-neutral" data-my-safety-keys><span class="onsite-shortcut-main"><strong>🔑 Who Has Key</strong><span>Live connection required to view current key/card holders.</span></span><span class="onsite-shortcut-action">Open</span></button>`;
    return;
  }
  const keys=outstandingAccessKeys(),count=keys.length;
  const summary=count?`${count} key/card${count===1?'':'s'} currently issued.`:'No keys/cards currently issued.';
  const label=count?`${count} out`:'All returned';
  box.innerHTML=`<button type="button" class="my-safety-onsite-button key-shortcut-button ${count?'key-active':'key-clear'}" data-my-safety-keys><span class="onsite-shortcut-main"><strong>🔑 Who Has Key</strong><span>${esc(summary)}</span></span><span class="onsite-shortcut-status">${esc(label)}</span><span class="onsite-shortcut-action">Open</span></button>`;
}
function showWhoHasKey(){
  if(state.offline||!navigator.onLine)return toast('Reconnect to view current key/card holders.');
  const rows=outstandingAccessKeys();
  const cards=rows.map(p=>{const loc=p.access_key_area||p.location_text||((p.location_ids||[]).map(locationPath).join(', '))||'Area not recorded';return `<div class="item-card key-holder-card"><div class="row-between"><div><h4>🔑 ${esc(p.access_key_ref||'Key / card')}</h4><div class="meta"><span class="badge due">OUT</span><span>${esc(p.contractor_name||'Unknown holder')}</span>${p.contractor_company?`<span>${esc(p.contractor_company)}</span>`:''}</div></div></div><div class="permit-summary"><strong>Holder:</strong> ${esc(p.contractor_name||'Unknown')}<br><strong>Company:</strong> ${esc(p.contractor_company||'—')}<br><strong>Authorised area:</strong> ${esc(loc)}<br><strong>Issued:</strong> ${fmtDateTime(p.access_key_issued_at||p.created_at)}</div><div class="row">${btn('View visit','secondary',`data-permit-view="${p.id}"`)}${btn('Return key/card','primary',`data-key-return="${p.id}"`)}</div></div>`}).join('');
  openModal('Who Has Key',`<div class="hint-box"><strong>Live key / access register</strong><br>This shows every contractor or authorised visitor with a key/card currently recorded as issued and not yet returned.</div><div class="key-register-summary"><strong>${rows.length}</strong><span>key/card${rows.length===1?'':'s'} currently out</span></div><div class="card-list" style="margin-top:12px">${cards||'<div class="success-note">All recorded keys/cards have been returned.</div>'}</div><div class="actions">${btn('Close','ghost','data-close-modal')}${btn("Open Who's On Site",'secondary','data-my-safety-onsite')}</div>`);
}

let mySafetyStatusView='';
let mySafetyCategoryView='ALL';

function mySafetyCategory(t){
  const src=sourceForTraining(t);
  const type=String(src?.doc_type||'').toUpperCase();
  const kind=String(trainingKind(t)||'').toUpperCase();
  if(type==='COSHH'||kind==='COSHH')return 'COSHH';
  if(type==='RISK_ASSESSMENT'||kind==='RISK_ASSESSMENT'||kind==='RA')return 'RA';
  if(type==='SSW'||kind==='SSW'||kind.includes('SAFE_SYSTEM'))return 'SSW';
  if(type==='TOOLBOX_TALK'||kind==='TOOLBOX_TALK'||kind.includes('TOOLBOX'))return 'TBT';
  if(kind.includes('AWARENESS'))return 'AWARENESS';
  return 'OTHER';
}
function mySafetyStatusMatch(row,status){
  if(status==='COMPLETE')return row.status.code==='COMPLETED';
  if(status==='OVERDUE')return row.status.code==='OVERDUE'||row.traffic==='red';
  if(status==='WAITING')return row.status.code==='AWAITING_INSTRUCTOR';
  if(status==='ACTION')return row.status.code!=='COMPLETED';
  return false;
}
function setMySafetyStatus(status){mySafetyStatusView=status||'';mySafetyCategoryView='ALL';renderMySafety()}
function setMySafetyCategory(category){mySafetyCategoryView=category||'ALL';renderMySafety()}
function clearMySafetyStatus(){mySafetyStatusView='';mySafetyCategoryView='ALL';renderMySafety()}

function hsCategoryRows(){
  return myActiveAssignments().map(x=>({...x,status:assignmentStatus(x.a,x.t)})).map(x=>({...x,traffic:assignmentTraffic(x.status,trainingDependencyState(x.t).ready)})).sort((a,b)=>trafficPriority(a.traffic)-trafficPriority(b.traffic)||String(a.t.name||'').localeCompare(String(b.t.name||'')));
}
function categoryTraffic(rows){
  if(rows.some(r=>r.status.code==='OVERDUE'||r.traffic==='red'))return 'red';
  if(rows.some(r=>r.status.code!=='COMPLETED'))return 'amber';
  return rows.length?'green':'neutral';
}
function hsCategoryDefinitions(){return [['COSHH','COSHH RA'],['RA','Risk Assessments'],['SSW','SSW'],['TBT','Toolbox Talks'],['SDS','SDS / MSDS'],['AWARENESS','Safety Awareness'],['OTHER','Other Training']]}
let hsTrainingCategory='ALL';
function openHsTraining(category='ALL'){hsTrainingCategory=category||'ALL';showView('hsTraining')}
function renderMySafety(){
  renderMySafetyOnSiteShortcut();renderMySafetyKeyShortcut();
  const rows=hsCategoryRows(),completed=rows.filter(x=>x.status.code==='COMPLETED').length,overdue=rows.filter(x=>x.status.code==='OVERDUE'||x.traffic==='red').length,waiting=rows.filter(x=>x.status.code==='AWAITING_INSTRUCTOR').length,action=rows.filter(x=>x.status.code!=='COMPLETED').length;
  const stats=[['Complete',completed,'green'],['Action required',action,overdue?'red':action?'amber':'green'],['Overdue / blocked',overdue,overdue?'red':'green'],['Awaiting instructor',waiting,waiting?'amber':'green']];
  $('mySafetyStats').innerHTML=stats.map(([label,value,traffic])=>`<div class="stat traffic-${traffic}"><span class="traffic-dot"></span><strong>${value}</strong><span>${label}</span></div>`).join('');
  const sds=state.documents.filter(d=>d.doc_type==='SDS'&&d.status!=='ARCHIVED'&&approvedCurrentVersion(d.id));
  const tiles=hsCategoryDefinitions().map(([key,label])=>{let subset=key==='SDS'?[]:rows.filter(r=>mySafetyCategory(r.t)===key);let count=key==='SDS'?sds.length:subset.length;let traffic=key==='SDS'?(count?'green':'neutral'):categoryTraffic(subset);let outstanding=key==='SDS'?0:subset.filter(r=>r.status.code!=='COMPLETED').length;let note=key==='SDS'?`${count} reference sheet${count===1?'':'s'}`:count?`${outstanding} requiring action · ${count} assigned`:'Nothing assigned';return `<button type="button" class="my-safety-category-button traffic-${traffic}" data-open-hs-training="${key}"><span class="traffic-dot"></span><strong>${esc(label)}</strong><span>${esc(note)}</span></button>`}).join('');
  $('mySafetyCategoryTiles').innerHTML=tiles;
}
function hsTrainingAssignmentCard({a,t,status,traffic}){
  const src=sourceForTraining(t),deps=trainingDependencyState(t),materials=requiredTrainingMaterials(a,t),materialOpened=requiredTrainingMaterialOpened(a,t),unavailable=materials.filter(m=>m.available===false).length;
  const requiredBtn=materials.length?btn(materialOpened?'Safety document opened ✓':'Open safety document',materialOpened?'training-doc-opened':'training-doc-required',`data-open-required-training="${a.id}"`):'';
  const materialBadge=materials.length&&status.code!=='COMPLETED'&&unavailable?`<span class="badge overdue">Safety source unavailable</span>`:'';
  const mainAction=deps.ready&&status.code!=='COMPLETED'&&status.method==='SELF_TRAINING'&&materialOpened?btn('Confirm and complete','primary',`data-sign-training="${a.id}"`):deps.ready&&status.code==='READY_TO_SIGN'?btn('Confirm attendance','primary',`data-sign-training="${a.id}"`):'';
  const supportAction=deps.ready&&status.method==='SELF_TRAINING'&&status.code!=='COMPLETED'?btn('Need instructor help','secondary',`data-request-instructor="${a.id}"`):'';
  const adminException=deps.ready&&isAdmin()&&a.user_id===state.user?.id&&status.method==='INSTRUCTOR_LED'&&status.code!=='COMPLETED'&&!status.ready?btn('Complete as exception','danger',`data-training-exception="${a.id}"`):'';
  return `<div class="item-card training-status-card traffic-${traffic}"><div class="row-between"><div><h3>${esc(trainingReference(t)&&!t.name.toUpperCase().includes(trainingReference(t))?trainingReference(t)+' - '+t.name:t.name)}</h3><div class="meta"><span class="badge">${esc(kindLabel(trainingKind(t)))}</span><span>${esc(deliveryText(status.method))}</span><span class="badge ${!deps.ready?'overdue':status.badge}">${esc(!deps.ready?'Blocked':status.label)}</span>${status.due?`<span>Due ${fmtDate(status.due)}</span>`:''}${materialBadge}</div></div>${statusChip(!deps.ready?'Blocked':status.label,traffic)}</div>${src?`<div class="muted">Safety source: ${esc(src.reference||'')} ${esc(src.title)}</div>`:''}${!deps.ready?`<div class="pending-use-warning">${esc(trainingDependencyMessage(t))}</div>`:materials.length&&status.code!=='COMPLETED'&&!materialOpened?`<div class="request-note">Open the current approved safety document first. The completion button will then become the next action.</div>`:''}<div class="row action-bar">${deps.ready?requiredBtn:''}${mainAction}${adminException}${supportAction}${status.code==='COMPLETED'&&isStandardUser()?'':btn(status.code==='COMPLETED'?'Training record':'View training','ghost',`data-view-training="${t.id}"`)}</div></div>`;
}
function renderHsTraining(){
  const rows=hsCategoryRows(),sds=state.documents.filter(d=>d.doc_type==='SDS'&&d.status!=='ARCHIVED'&&approvedCurrentVersion(d.id));
  const defs=hsCategoryDefinitions();
  $('hsTrainingTiles').innerHTML=defs.map(([key,label])=>{const subset=key==='SDS'?[]:rows.filter(r=>mySafetyCategory(r.t)===key),count=key==='SDS'?sds.length:subset.length,traffic=key==='SDS'?(count?'green':'neutral'):categoryTraffic(subset);return `<button type="button" class="my-safety-category-button traffic-${traffic}${hsTrainingCategory===key?' active':''}" data-hs-training-category="${key}"><span class="traffic-dot"></span><strong>${esc(label)}</strong><span>${count} item${count===1?'':'s'}</span></button>`}).join('');
  const list=$('hsTrainingList');
  if(hsTrainingCategory==='ALL'){list.innerHTML='<div class="section-card"><h3>Select a section</h3><p class="muted">Choose a tile above to see your assigned training or SDS/MSDS reference sheets.</p></div>';return}
  if(hsTrainingCategory==='SDS'){list.innerHTML=sds.length?sds.map(d=>{const v=approvedCurrentVersion(d.id);return `<div class="item-card document-status-card traffic-green"><div class="row-between"><div><h3>${esc(d.reference?d.reference+' - '+documentDisplayTitle(d):documentDisplayTitle(d))}</h3><div class="meta"><span class="badge">SDS / MSDS</span><span>Reference document</span></div></div>${statusChip('Current','green')}</div><div class="row action-bar">${btn('Open current','primary',`data-open-doc="${v.id}"`)}</div></div>`}).join(''):'<div class="success-note">No current SDS/MSDS reference sheets are available to you.</div>';return}
  const filtered=rows.filter(r=>mySafetyCategory(r.t)===hsTrainingCategory);list.innerHTML=filtered.length?filtered.map(hsTrainingAssignmentCard).join(''):'<div class="success-note">Nothing assigned in this section.</div>';
}

function renderMyAwareness(){const statsEl=$('myAwarenessStats'),list=$('myAwarenessList');if(!statsEl||!list)return;if(state.loadErrors.safety_awareness_items){statsEl.innerHTML='';list.innerHTML='<div class="empty">Safety Awareness needs the v2.2.2+ SQL migration.</div>';return}const items=state.awarenessItems.filter(i=>i.active!==false&&awarenessAssignmentForUser(i.id));const statuses=items.map(i=>({item:i,status:awarenessStatus(i)}));const overdue=statuses.filter(x=>x.status.code==='OVERDUE').length,due=statuses.filter(x=>x.status.code==='DUE').length,current=statuses.filter(x=>x.status.code==='CURRENT').length;statsEl.innerHTML=[['Assigned',items.length,overdue?'red':due?'amber':'green'],['Up to date',current,'green'],['Due',due,due?'amber':'green'],['Overdue',overdue,overdue?'red':'green']].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${n}</strong><span>${l}</span></div>`).join('');const action=statuses.filter(x=>x.status.code!=='CURRENT').sort((a,b)=>(a.status.code==='OVERDUE'?-1:1));list.innerHTML=action.length?action.map(({item,status})=>`<div class="item-card awareness-card traffic-${status.traffic}"><div class="row-between"><div><h4>${esc(item.code?item.code+' - '+item.title:item.title)}</h4><div class="meta"><span class="badge ${status.code==='OVERDUE'?'overdue':'due'}">${esc(status.label)}</span>${status.due?`<span>Due ${fmtDate(status.due)}</span>`:''}</div></div></div><div class="row">${btn('Open guidance','primary',`data-open-awareness="${item.id}"`)}</div></div>`).join(''):'<div class="success-note">Your annual Safety Awareness reviews are up to date.</div>'}
function renderAwareness(){const list=$('awarenessList'),stats=$('awarenessStats');if(!list||!stats)return;if(state.loadErrors.safety_awareness_items){stats.innerHTML='';list.innerHTML='<div class="empty">Run the Safety Awareness SQL migration to enable Safety Awareness.</div>';return}const q=clean($('awarenessSearch')?.value).toLowerCase(),filter=$('awarenessStatusFilter')?.value||'';let items=state.awarenessItems.filter(i=>i.active!==false&&(!q||`${i.code||''} ${i.title||''} ${i.description||''}`.toLowerCase().includes(q)));if(!isManager())items=items.filter(i=>awarenessAssignmentForUser(i.id));items=items.filter(i=>{if(!filter)return true;const st=isManager()?awarenessAggregate(i):awarenessStatus(i);if(filter==='CURRENT')return st.traffic==='green';if(filter==='OVERDUE')return st.traffic==='red';if(filter==='DUE')return st.traffic==='amber';return true});const assigned=isManager()?state.awarenessAssignments.filter(a=>a.active!==false).length:items.length;const overdue=isManager()?state.awarenessItems.filter(i=>i.active!==false&&awarenessAggregate(i).traffic==='red').length:items.filter(i=>awarenessStatus(i).code==='OVERDUE').length;const due=isManager()?state.awarenessItems.filter(i=>i.active!==false&&awarenessAggregate(i).traffic==='amber').length:items.filter(i=>awarenessStatus(i).code==='DUE').length;stats.innerHTML=[['Topics',state.awarenessItems.filter(i=>i.active!==false).length,'green'],['Assignments',assigned,'green'],['Action required',due,due?'amber':'green'],['Overdue',overdue,overdue?'red':'green']].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${n}</strong><span>${l}</span></div>`).join('');list.innerHTML=items.length?items.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.title.localeCompare(b.title)).map(item=>{const own=awarenessStatus(item),agg=awarenessAggregate(item),display=isManager()?agg:own,assignedCount=isManager()?agg.assigned:1,currentCount=isManager()?agg.current:(own.code==='CURRENT'?1:0);return `<div class="item-card awareness-card traffic-${display.traffic}"><div class="row-between"><div><h3>${esc(item.code?item.code+' - '+item.title:item.title)}</h3><div class="meta"><span class="badge">Annual awareness</span><span>Version ${esc(item.version_label||'1.0')}</span><span>Review every ${Number(item.review_months||12)} months</span><span class="badge ${display.traffic==='red'?'overdue':display.traffic==='amber'?'due':display.traffic==='green'?'complete':''}">${esc(display.label)}</span></div></div>${isManager()?`<span class="badge">${currentCount}/${assignedCount} up to date</span>`:''}</div><p class="muted">${esc(item.description||'')}</p><div class="row">${btn('Open guidance','primary',`data-open-awareness="${item.id}"`)}${item.hse_url?`<a class="button-link secondary" href="${esc(item.hse_url)}" target="_blank" rel="noopener">Official HSE guidance</a>`:''}${isManager()?btn('Assign audience','secondary',`data-assign-awareness="${item.id}"`):''}</div></div>`}).join(''):'<div class="empty">No Safety Awareness topics match this filter.</div>'}
async function logAwareness(itemId,action){const item=awarenessItem(itemId);if(!item||!state.user)return null;const asn=awarenessAssignmentForUser(itemId,state.user.id);const payload={awareness_item_id:itemId,assignment_id:asn?.id||null,user_id:state.user.id,item_version_label:item.version_label||'1.0',action,occurred_at:new Date().toISOString()};const r=await sb.from('safety_awareness_activity').insert(payload).select().single();if(!r.error&&r.data)state.awarenessActivity.push(r.data);return r.error?null:r.data}
async function openAwareness(itemId){const item=awarenessItem(itemId);if(!item)return toast('Awareness topic not found.');await logAwareness(itemId,'OPENED');const assigned=!!awarenessAssignmentForUser(itemId),st=awarenessStatus(item);openModal(item.title,`<div class="awareness-sheet"><div class="awareness-kicker">Safety Awareness · ${esc(item.code||'Guidance')} · v${esc(item.version_label||'1.0')}</div><div class="hint-box"><strong>Purpose:</strong> refresher guidance and supporting evidence only. It does not replace formal training, task-specific risk assessment, COSHH assessment, SSW, supervision or competence requirements.</div><div class="awareness-guidance">${guidanceHtml(item.guidance_text)}</div>${item.hse_url?`<p><a class="button-link secondary" href="${esc(item.hse_url)}" target="_blank" rel="noopener">Open official HSE guidance</a></p>`:''}${assigned?`<div class="review-confirm-box"><label class="check-row"><input id="awarenessConfirm" type="checkbox"> I have read and understood this safety awareness guidance. I understand it supports, but does not replace, the relevant Risk Assessment, COSHH Assessment, Safe System of Work or formal training. If I am unsure how to carry out a task safely, I will stop and ask my manager.</label><div class="muted">This is an annual employee awareness acknowledgement, not formal training.</div></div>`:'<div class="request-note">This topic is not currently assigned to you. You can still read the guidance.</div>'}</div><div class="actions">${btn('Close','ghost','data-close-modal')}${assigned&&st.code!=='CURRENT'?btn('Confirm annual review','primary',`data-ack-awareness="${item.id}"`):assigned?'<span class="badge complete">Already up to date</span>':''}</div>`)}
async function acknowledgeAwareness(itemId){const item=awarenessItem(itemId),asn=awarenessAssignmentForUser(itemId);if(!item||!asn)return toast('This awareness topic is not assigned to you.');if(!$('awarenessConfirm')?.checked)return toast('Tick the confirmation before completing the annual review.');const opened=awarenessEvents(itemId).some(a=>a.action==='OPENED'&&String(a.item_version_label||'')===String(item.version_label||''));if(!opened)return toast('Open the guidance before acknowledging it.');const r=await logAwareness(itemId,'ACKNOWLEDGED');if(!r)return toast('Could not record the awareness review.');closeModal();await refresh('Safety Awareness review recorded. Next review is due in 12 months.')}
function showAwarenessAssignments(itemId){if(!isManager())return;const item=awarenessItem(itemId);if(!item)return;const rows=audienceRowsFor('AWARENESS',itemId);openModal(`Safety Awareness audience · ${item.title}`,`${genericAudienceHtml('awarenessAudience',rows,{showDue:false,heading:'Who needs this awareness review?',help:'Choose Everyone, Departments and/or specific people. Department membership is kept in sync automatically.'})}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save audience','primary',`data-save-awareness-assignments="${itemId}"`)}</div>`);wireGenericAudience('awarenessAudience',false)}
async function saveAwarenessAssignments(itemId){if(!isManager())return;const a=genericAudienceSelection('awarenessAudience',false);if(!audienceSelectionValid(a))return toast('Choose Everyone, at least one Department, or at least one specific person.');const r=await sb.rpc('set_awareness_item_audience_v239',{p_awareness_item_id:itemId,p_everyone:a.everyone,p_department_ids:a.departmentIds,p_user_ids:a.userIds});if(r.error)return toast(r.error.message);closeModal();await refresh(`Safety Awareness audience updated. ${Number(r.data||0)} assignment change${Number(r.data||0)===1?'':'s'} applied.`)}



// --- v2.2.3 configurable monthly PPE checks -----------------------------------------
function currentMonthValue(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function ppeMonthDate(value){return /^\d{4}-\d{2}$/.test(value||'')?`${value}-01`:null}
function ppeDueDate(value){const m=/^(\d{4})-(\d{2})$/.exec(value||'');if(!m)return null;return new Date(Number(m[1]),Number(m[2])-1,28,23,59,59,999)}
function ppeItem(id){return state.ppeItems.find(x=>x.id===id)||null}
function activePpeItems(){return state.ppeItems.filter(x=>x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.name).localeCompare(String(b.name)))}
function ppeAssignmentsForItem(id){return state.ppeAssignments.filter(a=>a.ppe_item_id===id&&a.active!==false)}
function assignedPpeForUser(userId=state.user?.id){const ids=new Set(state.ppeAssignments.filter(a=>a.user_id===userId&&a.active!==false).map(a=>a.ppe_item_id));return activePpeItems().filter(i=>ids.has(i.id))}
function ppeCheckForMonth(userId=state.user?.id,value=currentMonthValue()){const d=ppeMonthDate(value);return state.ppeChecks.filter(c=>c.user_id===userId&&String(c.check_month||'').slice(0,10)===d).sort((a,b)=>new Date(b.submitted_at||0)-new Date(a.submitted_at||0))[0]||null}
function ppeItemsForCheck(checkId){return state.ppeCheckItems.filter(x=>x.check_id===checkId)}
function ppeCheckStatus(userId=state.user?.id,value=currentMonthValue()){
  const assigned=assignedPpeForUser(userId),check=ppeCheckForMonth(userId,value),due=ppeDueDate(value);
  if(!assigned.length)return {code:'UNASSIGNED',label:'No PPE assigned',traffic:'neutral',assigned:0,check:null,due};
  if(check){const rows=ppeItemsForCheck(check.id),issues=rows.filter(x=>['REPLACEMENT_REQUIRED','MISSING'].includes(x.result));if(issues.length)return {code:'ISSUES',label:`${issues.length} PPE issue${issues.length===1?'':'s'} reported`,traffic:'red',assigned:assigned.length,check,due,issues};return {code:'COMPLETE',label:'Monthly PPE check complete',traffic:'green',assigned:assigned.length,check,due,issues:[]};}
  const now=new Date(),overdue=due&&now>due;return {code:overdue?'OVERDUE':'DUE',label:overdue?'Monthly PPE check overdue':'Monthly PPE check due',traffic:overdue?'red':'amber',assigned:assigned.length,check:null,due,issues:[]};
}
function ppeResultLabel(v){return ({GOOD:'Available & good condition',REPLACEMENT_REQUIRED:'Replacement required',MISSING:'Missing',NOT_APPLICABLE:'Not applicable'})[v]||v||'—'}
function ppeActionLabel(v){return ({OPEN:'Open',ORDERED:'Ordered',RESOLVED:'Resolved',NOT_REQUIRED:'Not required'})[v]||v||'—'}
function renderMyPpe(){const stats=$('myPpeStats'),list=$('myPpeList');if(!stats||!list)return;if(state.loadErrors.ppe_items){stats.innerHTML='';list.innerHTML='<div class="empty">Monthly PPE checks need the v2.2.3 SQL migration.</div>';return}const st=ppeCheckStatus(),items=assignedPpeForUser();stats.innerHTML=[['Assigned PPE',items.length,items.length?'green':'neutral'],['This month',st.code==='COMPLETE'?'Complete':st.code==='ISSUES'?'Issues':st.code==='OVERDUE'?'Overdue':'Due',st.traffic]].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${esc(n)}</strong><span>${l}</span></div>`).join('');if(!items.length){list.innerHTML='<div class="empty">No PPE is currently assigned to you.</div>';return}const issueNote=st.code==='ISSUES'?`<div class="danger-note">You reported PPE that is missing or needs replacement. Do not use damaged or unsuitable PPE. The issue is visible to Admin/Manager for action.</div>`:'';list.innerHTML=`<div class="item-card ppe-status-card traffic-${st.traffic}"><div class="row-between"><div><h4>${new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})} PPE check</h4><div class="meta"><span class="badge ${st.traffic==='red'?'overdue':st.traffic==='green'?'complete':'due'}">${esc(st.label)}</span><span>Due 28th of each month</span>${st.check?`<span>Signed ${fmtDateTime(st.check.submitted_at)}</span>`:''}</div></div></div>${issueNote}<div class="row">${st.check?btn('View check','secondary',`data-view-ppe-check="${st.check.id}"`):btn('Complete monthly PPE check','primary','data-start-ppe-check')}</div></div>`}
function ppeManagerMonthSummary(value=currentMonthValue()){const people=activePeople().filter(p=>assignedPpeForUser(p.id).length);const rows=people.map(p=>({p,s:ppeCheckStatus(p.id,value)}));return {people,rows,complete:rows.filter(x=>x.s.code==='COMPLETE').length,issues:rows.filter(x=>x.s.code==='ISSUES').length,overdue:rows.filter(x=>x.s.code==='OVERDUE').length,due:rows.filter(x=>x.s.code==='DUE').length}}
function renderPpe(){const list=$('ppeList'),stats=$('ppeStats'),manager=$('ppeManagerArea');if(!list||!stats)return;if(state.loadErrors.ppe_items){stats.innerHTML='';list.innerHTML='<div class="empty">Run the v2.2.3 SQL migration to enable Monthly PPE Checks.</div>';if(manager)manager.innerHTML='';return}const q=clean($('ppeSearch')?.value).toLowerCase(),filter=$('ppeStatusFilter')?.value||'',items=assignedPpeForUser(),st=ppeCheckStatus();stats.innerHTML=[['Assigned PPE',items.length,items.length?'green':'neutral'],['Monthly status',st.label,st.traffic],['Due date','28th',st.code==='OVERDUE'?'red':'green']].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${esc(n)}</strong><span>${l}</span></div>`).join('');let shown=items.filter(i=>!q||`${i.name||''} ${i.description||''}`.toLowerCase().includes(q));if(filter==='ISSUES'&&st.code!=='ISSUES')shown=[];if(filter==='DUE'&&!['DUE','OVERDUE'].includes(st.code))shown=[];if(filter==='COMPLETE'&&st.code!=='COMPLETE')shown=[];list.innerHTML=shown.length?`<div class="item-card ppe-status-card traffic-${st.traffic}"><div class="row-between"><div><h3>Your monthly PPE check</h3><div class="meta"><span class="badge ${st.traffic==='red'?'overdue':st.traffic==='green'?'complete':'due'}">${esc(st.label)}</span><span>Due ${fmtDate(st.due)}</span></div></div></div><div class="ppe-chip-list">${shown.map(i=>`<span class="badge">${esc(i.name)}</span>`).join('')}</div><div class="row">${st.check?btn('View submitted check','secondary',`data-view-ppe-check="${st.check.id}"`):btn('Complete monthly check','primary','data-start-ppe-check')}</div></div>`:'<div class="empty">No PPE items match this filter.</div>';if(manager&&isManager())renderPpeManagerArea()}
function renderPpeManagerArea(){const el=$('ppeManagerArea');if(!el||!isManager())return;const value=currentMonthValue(),sum=ppeManagerMonthSummary(value),openIssues=state.ppeCheckItems.filter(x=>['REPLACEMENT_REQUIRED','MISSING'].includes(x.result)&&!['RESOLVED','NOT_REQUIRED'].includes(x.action_status||'OPEN'));el.innerHTML=`<div class="section-card"><div class="row-between"><div><h3>Team PPE position</h3><p class="muted">Checks are due by the 28th so replacement orders can be prepared for the start of the following month.</p></div>${isAdmin()?btn('Manage PPE catalogue','primary','data-manage-ppe-catalogue'):''}</div><div class="stats-grid">${[['People assigned PPE',sum.people.length,'green'],['Complete',sum.complete,'green'],['Issues',sum.issues,sum.issues?'red':'green'],['Outstanding / overdue',sum.due+sum.overdue,sum.overdue?'red':sum.due?'amber':'green']].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${n}</strong><span>${l}</span></div>`).join('')}</div><div class="card-list">${sum.rows.map(({p,s})=>`<div class="item-card compact ppe-status-card traffic-${s.traffic}"><div class="row-between"><div><strong>${esc(p.display_name||p.email)}</strong><div class="meta"><span>${s.assigned} PPE item${s.assigned===1?'':'s'}</span><span class="badge ${s.traffic==='red'?'overdue':s.traffic==='green'?'complete':'due'}">${esc(s.label)}</span></div></div>${s.check?btn('View check','secondary',`data-view-ppe-check="${s.check.id}"`):''}</div></div>`).join('')}</div></div><div class="section-card"><div class="row-between"><div><h3>PPE ordering / action list</h3><p class="muted">Missing or replacement-required PPE stays here until Admin/Manager records it as ordered, resolved or not required.</p></div></div><div class="card-list">${openIssues.length?openIssues.map(r=>{const c=state.ppeChecks.find(x=>x.id===r.check_id),person=state.people.find(x=>x.id===c?.user_id);return `<div class="item-card compact traffic-red"><div class="row-between"><div><strong>${esc(person?.display_name||person?.email||'Employee')} · ${esc(r.ppe_name_snapshot||ppeItem(r.ppe_item_id)?.name||'PPE')}</strong><div class="meta"><span>${esc(ppeResultLabel(r.result))}</span><span>${esc(r.comment||'No comment')}</span><span>${esc(ppeActionLabel(r.action_status||'OPEN'))}</span></div></div>${btn('Update action','primary',`data-update-ppe-action="${r.id}"`)}</div></div>`}).join(''):'<div class="success-note">No open PPE replacement/order actions.</div>'}</div></div>`}
function showPpeCheck(){const items=assignedPpeForUser();if(!items.length)return toast('No PPE is assigned to you.');const existing=ppeCheckForMonth();if(existing)return viewPpeCheck(existing.id);openModal('Monthly PPE check',`<div class="hint-box"><strong>Due by the 28th each month.</strong> Check the PPE assigned to you so missing/damaged items can be ordered for the start of the following month. This does not replace the normal check before each use.</div><div class="ppe-check-grid">${items.map(i=>`<div class="ppe-check-row" data-ppe-row="${i.id}"><div><strong>${esc(i.name)}</strong><div class="muted">${esc(i.inspection_guidance||i.description||'Check that this item is available, suitable and in good condition.')}</div></div><label>Condition<select class="ppe-result"><option value="GOOD">Available & good condition</option><option value="REPLACEMENT_REQUIRED">Replacement required</option><option value="MISSING">Missing</option><option value="NOT_APPLICABLE">Not applicable</option></select></label><label>Comment<input class="ppe-comment" placeholder="Required if missing/replacement needed"></label></div>`).join('')}</div><div class="review-confirm-box"><p>I have checked the PPE assigned to me and recorded its availability and condition accurately. I will not use damaged or unsuitable PPE and will report any replacement required.</p><div class="hint-box"><strong>Authenticated acknowledgement.</strong> Your signed-in account, date and time are recorded automatically. No drawn signature is required.</div><label class="check-row"><input id="ppeAck" type="checkbox"> I confirm this monthly PPE check.</label></div><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Submit PPE check','primary','data-submit-ppe-check')}</div>`);}
async function submitPpeCheck(){const rows=[...document.querySelectorAll('[data-ppe-row]')].map(r=>({ppe_item_id:r.dataset.ppeRow,result:r.querySelector('.ppe-result')?.value||'GOOD',comment:clean(r.querySelector('.ppe-comment')?.value)}));for(const r of rows)if(['REPLACEMENT_REQUIRED','MISSING'].includes(r.result)&&r.comment.length<3)return toast('Add a short comment for each missing or replacement-required PPE item.');if(!$('ppeAck')?.checked)return toast('Tick the confirmation before submitting.');const sigName=state.profile?.display_name||state.user?.email||'Authenticated user',sig=`ACK:${state.user?.id||'user'}:${new Date().toISOString()}`,declaration='I have checked the PPE assigned to me and recorded its availability and condition accurately. I will not use damaged or unsuitable PPE and will report any replacement required.';const r=await sb.rpc('submit_monthly_ppe_check_v223',{p_check_month:ppeMonthDate(currentMonthValue()),p_signature_data:sig,p_signature_name:sigName,p_declaration:declaration,p_results:rows});if(r.error)return toast(r.error.message);closeModal();await refresh(rows.some(x=>['MISSING','REPLACEMENT_REQUIRED'].includes(x.result))?'PPE check submitted. An action has been raised for Admin/Manager.':'PPE check submitted.');}
function viewPpeCheck(id){const c=state.ppeChecks.find(x=>x.id===id);if(!c)return;const rows=ppeItemsForCheck(id),person=state.people.find(x=>x.id===c.user_id);openModal(`PPE check · ${person?.display_name||person?.email||'Employee'}`,`<div class="meta"><span>Month ${fmtDate(c.check_month)}</span><span>Submitted ${fmtDateTime(c.submitted_at)}</span><span class="badge ${c.status==='ISSUES'?'overdue':'complete'}">${esc(c.status||'COMPLETE')}</span></div><div class="card-list">${rows.map(r=>`<div class="item-card compact ${['MISSING','REPLACEMENT_REQUIRED'].includes(r.result)?'traffic-red':'traffic-green'}"><strong>${esc(r.ppe_name_snapshot||ppeItem(r.ppe_item_id)?.name||'PPE')}</strong><div class="meta"><span>${esc(ppeResultLabel(r.result))}</span>${r.comment?`<span>${esc(r.comment)}</span>`:''}${isManager()&&['MISSING','REPLACEMENT_REQUIRED'].includes(r.result)?`<span>Action: ${esc(ppeActionLabel(r.action_status||'OPEN'))}</span>`:''}</div></div>`).join('')}</div><div class="signature-readback"><strong>Acknowledged by:</strong> ${esc(c.signature_name||'')} · ${fmtDateTime(c.submitted_at)}</div><div class="actions">${isManager()||c.user_id===state.user?.id?btn('Download PDF','secondary',`data-download-ppe-check="${c.id}"`):''}${btn('Close','ghost','data-close-modal')}</div>`)}
function downloadPpeCheckPdf(id){if(!window.jspdf?.jsPDF)return toast('PDF library did not load.');const c=state.ppeChecks.find(x=>x.id===id);if(!c)return;const rows=ppeItemsForCheck(id),person=state.people.find(x=>x.id===c.user_id),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});doc.setFontSize(17);doc.text('Monthly PPE Check',14,16);doc.setFontSize(10);doc.text(`Employee: ${person?.display_name||person?.email||'Employee'}`,14,25);doc.text(`Month: ${fmtDate(c.check_month)} · Due: ${fmtDate(c.due_date)} · Submitted: ${fmtDateTime(c.submitted_at)}`,14,32);doc.text(`Status: ${c.status||''}`,14,39);doc.autoTable({head:[['PPE','Result','Comment','Action']],body:rows.map(r=>[r.ppe_name_snapshot||ppeItem(r.ppe_item_id)?.name||'',ppeResultLabel(r.result),r.comment||'',ppeActionLabel(r.action_status||'NOT_REQUIRED')]),startY:45,styles:{fontSize:8},margin:{left:14,right:14}});let y=(doc.lastAutoTable?.finalY||70)+10;doc.setFontSize(9);const declaration=doc.splitTextToSize(c.declaration||'',180);doc.text(declaration,14,y);y+=declaration.length*5+4;doc.text(`Signed name: ${c.signature_name||''}`,14,y);doc.text(`Signed: ${fmtDateTime(c.submitted_at)}`,14,y+6);try{if(c.signature_data)doc.addImage(c.signature_data,'PNG',14,y+10,70,22)}catch(e){}doc.save(`PPE-Check-${safeFileName(person?.display_name||person?.email||'employee')}-${String(c.check_month||'').slice(0,7)}.pdf`)}
function showPpeCatalogue(){if(!isAdmin())return;openModal('PPE Management',`<div class="row-between"><div><p class="muted">Add, edit, archive and assign PPE without a code update.</p></div>${btn('Add PPE','primary','data-edit-ppe-item="NEW"')}</div><div class="card-list ppe-catalogue-list">${activePpeItems().map(i=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(i.name)}</strong><div class="muted">${esc(i.description||'')}</div><div class="meta"><span>${ppeAssignmentsForItem(i.id).length} assigned</span></div></div><div class="row">${btn('Assign audience','secondary',`data-assign-ppe-item="${i.id}"`)}${btn('Edit','ghost',`data-edit-ppe-item="${i.id}"`)}</div></div></div>`).join('')||'<div class="empty">No PPE items yet.</div>'}</div><div class="actions">${btn('Close','ghost','data-close-modal')}</div>`)}
function editPpeItem(id){if(!isAdmin())return;const x=id==='NEW'?null:ppeItem(id);openModal(x?'Edit PPE':'Add PPE',`<div class="form-grid"><label>Name<input id="ppeItemName" value="${esc(x?.name||'')}"></label><label>Code<input id="ppeItemCode" value="${esc(x?.code||'')}"></label><label class="full">Description<textarea id="ppeItemDescription">${esc(x?.description||'')}</textarea></label><label class="full">Employee check guidance<textarea id="ppeItemGuidance" placeholder="What should the employee check each month?">${esc(x?.inspection_guidance||'')}</textarea></label><label>Sort order<input id="ppeItemSort" type="number" value="${Number(x?.sort_order||0)}"></label>${x?`<label class="check-row"><input id="ppeItemActive" type="checkbox" ${x.active===false?'':'checked'}> Active</label>`:''}</div>${x?'':genericAudienceHtml('newPpeAudience',[],{showDue:false,heading:'Who needs this PPE?',help:'Set the audience now so the PPE appears automatically on the correct users’ monthly checks.'})}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save PPE','primary',`data-save-ppe-item="${x?.id||''}"`)}</div>`);if(!x)wireGenericAudience('newPpeAudience',false)}
async function savePpeItem(id){if(!isAdmin())return;const name=clean($('ppeItemName')?.value),code=clean($('ppeItemCode')?.value).toUpperCase(),description=clean($('ppeItemDescription')?.value),inspection_guidance=clean($('ppeItemGuidance')?.value),sort_order=Number($('ppeItemSort')?.value||0),active=id?!!$('ppeItemActive')?.checked:true,audience=id?null:genericAudienceSelection('newPpeAudience',false);if(!name)return toast('Enter a PPE name.');if(audience&&!audienceSelectionValid(audience))return toast('Choose Everyone, at least one Department, or at least one specific person before creating this PPE item.');const payload={name,code:code||null,description,inspection_guidance,sort_order,active,updated_at:new Date().toISOString()};let r;if(id)r=await sb.from('ppe_items').update(payload).eq('id',id).select().single();else r=await sb.from('ppe_items').insert(payload).select().single();if(r.error)return toast(r.error.message);if(!id&&audience){const ar=await sb.rpc('set_ppe_item_audience_v239',{p_ppe_item_id:r.data.id,p_everyone:audience.everyone,p_department_ids:audience.departmentIds,p_user_ids:audience.userIds});if(ar.error)return toast(ar.error.message)}closeModal();await refresh(id?'PPE catalogue updated.':'PPE item created and assigned to its selected audience.');showPpeCatalogue()}
function showPpeAssignments(itemId){if(!isAdmin())return;const item=ppeItem(itemId);if(!item)return;const rows=audienceRowsFor('PPE',itemId);openModal(`PPE audience · ${item.name}`,`${genericAudienceHtml('ppeAudience',rows,{showDue:false,heading:'Who needs this PPE?',help:'Choose Everyone, Departments and/or specific people. Only matched PPE appears on each user’s monthly check.'})}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save audience','primary',`data-save-ppe-assignments="${itemId}"`)}</div>`);wireGenericAudience('ppeAudience',false)}
async function savePpeAssignments(itemId){if(!isAdmin())return;const a=genericAudienceSelection('ppeAudience',false);if(!audienceSelectionValid(a))return toast('Choose Everyone, at least one Department, or at least one specific person.');const r=await sb.rpc('set_ppe_item_audience_v239',{p_ppe_item_id:itemId,p_everyone:a.everyone,p_department_ids:a.departmentIds,p_user_ids:a.userIds});if(r.error)return toast(r.error.message);closeModal();await refresh(`PPE audience updated. ${Number(r.data||0)} assignment change${Number(r.data||0)===1?'':'s'} applied.`);showPpeCatalogue()}
function showPpeAction(id){if(!isManager())return;const r=state.ppeCheckItems.find(x=>x.id===id),c=state.ppeChecks.find(x=>x.id===r?.check_id),person=state.people.find(x=>x.id===c?.user_id);if(!r)return;openModal('Update PPE action',`<p><strong>${esc(person?.display_name||person?.email||'Employee')} · ${esc(r.ppe_name_snapshot||'PPE')}</strong></p><p>${esc(ppeResultLabel(r.result))}${r.comment?` · ${esc(r.comment)}`:''}</p><div class="form-grid"><label>Action status<select id="ppeActionStatus"><option value="OPEN" ${(r.action_status||'OPEN')==='OPEN'?'selected':''}>Open</option><option value="ORDERED" ${r.action_status==='ORDERED'?'selected':''}>Ordered</option><option value="RESOLVED" ${r.action_status==='RESOLVED'?'selected':''}>Resolved</option><option value="NOT_REQUIRED" ${r.action_status==='NOT_REQUIRED'?'selected':''}>Not required</option></select></label><label class="full">Manager note<textarea id="ppeActionNote">${esc(r.admin_note||'')}</textarea></label></div><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save action','primary',`data-save-ppe-action="${id}"`)}</div>`)}
async function savePpeAction(id){if(!isManager())return;const status=$('ppeActionStatus')?.value||'OPEN',note=clean($('ppeActionNote')?.value);const r=await sb.rpc('resolve_ppe_check_item_v223',{p_check_item_id:id,p_action_status:status,p_admin_note:note||null});if(r.error)return toast(r.error.message);closeModal();await refresh('PPE action updated.')}
function ppeReportData(value){const b=monthBounds(value);if(!b)throw new Error('Select a valid month.');const checkMonth=ppeMonthDate(value),checks=state.ppeChecks.filter(c=>String(c.check_month||'').slice(0,10)===checkMonth),checkIds=new Set(checks.map(c=>c.id)),items=state.ppeCheckItems.filter(i=>checkIds.has(i.check_id)),issues=items.filter(i=>['REPLACEMENT_REQUIRED','MISSING'].includes(i.result)),openIssues=issues.filter(i=>!['RESOLVED','NOT_REQUIRED'].includes(i.action_status||'OPEN')),assignedPeople=activePeople().filter(p=>assignedPpeForUser(p.id).length),submittedIds=new Set(checks.map(c=>c.user_id)),outstanding=assignedPeople.filter(p=>!submittedIds.has(p.id));return {b,checkMonth,checks,items,issues,openIssues,assignedPeople,outstanding}}

function reportPdfBase(title,subtitle=''){
  if(!window.jspdf?.jsPDF)throw new Error('PDF library did not load. Refresh and try again.');
  const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFontSize(18);doc.text(title,14,15);doc.setFontSize(9);doc.text(`${subtitle}${subtitle?' · ':''}Generated ${new Date().toLocaleString('en-GB')} · Safety Tracker v${APP_VERSION}`,14,22);
  return doc;
}
function reportTrainingRows(){
  return (state.trainingAssignments||[]).filter(a=>a.active!==false).map(a=>{const t=state.training.find(x=>x.id===a.training_session_id);if(!t)return null;const st=assignmentStatus(a,t);return {a,t,st,person:personName(a.user_id)}}).filter(Boolean);
}
function downloadReport(kind){
  try{
    let doc,name;
    if(kind==='outstanding'){
      const rows=reportTrainingRows().filter(x=>x.st.code!=='COMPLETED');
      doc=reportPdfBase('Safety Tracker - Outstanding Actions');
      doc.autoTable({head:[['Person','Training','Status','Delivery','Due']],body:rows.length?rows.map(x=>[x.person,trainingReference(x.t)?`${trainingReference(x.t)} - ${x.t.name}`:x.t.name,String(x.st.label||x.st.code),deliveryText(x.st.method),fmtDate(x.st.due)]):[['No outstanding training actions','','','','']],startY:28,styles:{fontSize:7.5},margin:{left:14,right:14}});
      let y=(doc.lastAutoTable?.finalY||55)+8;const overdueDocs=(state.documents||[]).map(d=>({d,v:currentVersion(d.id)})).filter(x=>x.v?.review_date&&new Date(x.v.review_date+'T23:59:59')<new Date());if(y>170){doc.addPage();y=14}doc.setFontSize(11);doc.text('Overdue document reviews',14,y);doc.autoTable({head:[['Reference','Document','Version','Review date']],body:overdueDocs.length?overdueDocs.map(x=>[x.d.reference||'',documentDisplayTitle(x.d),x.v.version_label||'',fmtDate(x.v.review_date)]):[['None','','','']],startY:y+3,styles:{fontSize:7.5},margin:{left:14,right:14}});name=`Safety-Tracker-Outstanding-Actions-${todayISO()}.pdf`;
    }else if(kind==='matrix'){
      const rows=reportTrainingRows();doc=reportPdfBase('Safety Tracker - Training Matrix');doc.autoTable({head:[['Person','Training','Type','Method','Status','Due']],body:rows.length?rows.map(x=>[x.person,trainingReference(x.t)?`${trainingReference(x.t)} - ${x.t.name}`:x.t.name,kindLabel(trainingKind(x.t)),deliveryText(x.st.method),x.st.label||x.st.code,fmtDate(x.st.due)]):[['No training assignments','','','','','']],startY:28,styles:{fontSize:7},margin:{left:14,right:14}});name=`Safety-Tracker-Training-Matrix-${todayISO()}.pdf`;
    }else if(kind==='signoffs'){
      const rows=(state.trainingSignoffs||[]).slice().sort((a,b)=>new Date(b.signed_at||0)-new Date(a.signed_at||0));doc=reportPdfBase('Safety Tracker - Training Confirmations');doc.autoTable({head:[['Person','Training','Acknowledged by','Completed','Method']],body:rows.length?rows.map(r=>{const a=state.trainingAssignments.find(x=>x.id===r.training_assignment_id),t=state.training.find(x=>x.id===a?.training_session_id);return [personName(a?.user_id),t?(trainingReference(t)?`${trainingReference(t)} - ${t.name}`:t.name):'Training record',r.signature_name||r.signed_name||personName(a?.user_id)||'',fmtDateTime(r.signed_at),deliveryText(effectiveTrainingMethod(t,a))]}):[['No training sign-offs','','','','']],startY:28,styles:{fontSize:7},margin:{left:14,right:14}});name=`Safety-Tracker-Training-Signoffs-${todayISO()}.pdf`;
    }else if(kind==='reviews'){
      const rows=(state.documents||[]).map(d=>({d,v:currentVersion(d.id)})).filter(x=>x.v).sort((a,b)=>String(a.v.review_date||'9999').localeCompare(String(b.v.review_date||'9999')));doc=reportPdfBase('Safety Tracker - Document Review Dates');doc.autoTable({head:[['Reference','Document','Type','Version','Issue date','Review date','Status']],body:rows.length?rows.map(x=>{const rd=x.v.review_date;let st='No review date';if(rd){const dd=Math.ceil((new Date(rd+'T23:59:59')-new Date())/86400000);st=dd<0?'Overdue':dd<=30?'Due within 30 days':'Current'}return [x.d.reference||'',documentDisplayTitle(x.d),docTypeLabel(x.d.document_type),x.v.version_label||'',fmtDate(x.v.issue_date),fmtDate(rd),st]}):[['No controlled documents','','','','','','']],startY:28,styles:{fontSize:7},margin:{left:14,right:14}});name=`Safety-Tracker-Review-Dates-${todayISO()}.pdf`;
    }else throw new Error('Unknown report type.');
    doc.save(name);toast('Report downloaded.');
  }catch(e){console.error(e);toast(`Report failed: ${e?.message||e}`)}
}
async function downloadTrainingExcel(){
  const b=$('trainingExcelBtn');
  if(!canViewReports())return toast('Reports access required.');
  if(!window.ExcelJS)return toast('Excel library did not load. Refresh and try again.');
  if(b){b.disabled=true;b.textContent='Creating Excel…'}
  try{
    const wb=new ExcelJS.Workbook();wb.creator='Safety Tracker';wb.created=new Date();
    const ws=wb.addWorksheet('Training Report',{views:[{state:'frozen',ySplit:1}]});
    ws.columns=[
      {header:'Person',key:'person',width:28},{header:'Department',key:'department',width:22},{header:'Reference',key:'reference',width:18},
      {header:'Training / Document',key:'training',width:42},{header:'Type',key:'type',width:22},{header:'Method',key:'method',width:18},
      {header:'Status',key:'status',width:18},{header:'Due Date',key:'due',width:15},{header:'Completed Date',key:'completed',width:18},
      {header:'Version',key:'version',width:14},{header:'Acknowledged by',key:'signed',width:24},{header:'Instructor',key:'instructor',width:24}
    ];
    const rows=reportTrainingRows().slice().sort((a,b)=>String(a.person||'').localeCompare(String(b.person||''))||String(a.t?.name||'').localeCompare(String(b.t?.name||'')));
    for(const x of rows){
      const p=(state.profiles||[]).find(z=>z.id===x.a.user_id)||{};
      const dep=(state.departments||[]).find(d=>d.id===p.department_id);
      const sign=(state.trainingSignoffs||[]).filter(z=>z.training_assignment_id===x.a.id).sort((a,b)=>new Date(b.signed_at||0)-new Date(a.signed_at||0))[0];
      const att=(state.trainingAttendance||state.instructorAttendance||[]).filter(z=>z.training_assignment_id===x.a.id||z.assignment_id===x.a.id).sort((a,b)=>new Date(b.attended_at||b.created_at||0)-new Date(a.attended_at||a.created_at||0))[0];
      const v=x.t?.source_document_id?currentVersion(x.t.source_document_id):null;
      ws.addRow({person:x.person,department:dep?.name||p.department_name||'',reference:trainingReference(x.t)||'',training:x.t?.name||'',type:kindLabel(trainingKind(x.t)),method:deliveryText(x.st.method),status:x.st.label||x.st.code||'',due:x.st.due?new Date(x.st.due):null,completed:sign?.signed_at?new Date(sign.signed_at):null,version:v?.version_label||x.t?.version_label||'',signed:sign?.signature_name||sign?.signed_name||'',instructor:att?.instructor_name||att?.recorded_by_name||''});
    }
    ws.autoFilter={from:'A1',to:'L1'};
    ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17324D'}};ws.getRow(1).alignment={vertical:'middle'};ws.getRow(1).height=24;
    ws.eachRow((row,rowNumber)=>{row.alignment={vertical:'top',wrapText:true};if(rowNumber>1){row.eachCell(c=>{c.protection={locked:true}})}});
    ws.getColumn('due').numFmt='dd/mm/yyyy';ws.getColumn('completed').numFmt='dd/mm/yyyy hh:mm';
    await ws.protect('SafetyTrackerReport',{autoFilter:true,sort:false,selectLockedCells:true,selectUnlockedCells:true,formatCells:false,formatColumns:false,formatRows:false,insertRows:false,deleteRows:false,insertColumns:false,deleteColumns:false});
    const bytes=await wb.xlsx.writeBuffer();downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`Safety-Tracker-Training-Report-${todayISO()}.xlsx`);toast('Locked training Excel report downloaded. Filters remain available.');
  }catch(e){console.error(e);toast(`Excel report failed: ${e?.message||e}`)}finally{if(b){b.disabled=false;b.textContent='Training Excel Report'}}
}
function backupSnapshot(){
  const omit=new Set(['user']);const out={generated_at:new Date().toISOString(),app_version:APP_VERSION,build_id:BUILD_ID,profile:state.profile||null,data:{}};
  for(const [k,v] of Object.entries(state)){if(omit.has(k)||k==='profile'||k==='loadErrors'||k==='syncBusy'||k==='storageOrphans'||k==='profileReloadAttempts')continue;if(Array.isArray(v)||v===null||['string','number','boolean'].includes(typeof v))out.data[k]=v}
  return out;
}
function downloadBackup(){try{const blob=new Blob([JSON.stringify(backupSnapshot(),null,2)],{type:'application/json'});downloadBlob(blob,`Safety-Tracker-backup-${todayISO()}.json`);toast('JSON backup downloaded.')}catch(e){console.error(e);toast(`Backup failed: ${e?.message||e}`)}}
async function downloadFullBackup(){
  const b=$('fullBackupBtn');if(b){b.disabled=true;b.textContent='Building backup…'}
  try{if(!window.JSZip)throw new Error('ZIP library did not load. Refresh and try again.');const zip=new JSZip();zip.file(`Safety-Tracker-backup-${todayISO()}.json`,JSON.stringify(backupSnapshot(),null,2));zip.file('README.txt',`Safety Tracker full backup\nVersion ${APP_VERSION}\nBuild ${BUILD_ID}\nGenerated ${new Date().toLocaleString('en-GB')}\n\nThis ZIP contains the structured Safety Tracker data backup. Controlled document files remain in Supabase Storage and should be retained under the normal document-control process.\n`);const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});downloadBlob(blob,`Safety-Tracker-full-backup-${todayISO()}.zip`);toast('Full backup ZIP downloaded.')}catch(e){console.error(e);toast(`Full backup failed: ${e?.message||e}`)}finally{if(b){b.disabled=false;b.textContent='Full backup ZIP'}}
}
function monthlyPpeReportDoc(value){if(!window.jspdf?.jsPDF)throw new Error('PDF library did not load.');const data=ppeReportData(value),{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});doc.setFontSize(18);doc.text('Safety Tracker - Monthly PPE Check Report',14,14);doc.setFontSize(9);doc.text(`${data.b.label} · Due 28th · Generated ${new Date().toLocaleString('en-GB')}`,14,21);doc.autoTable({head:[['Measure','Count']],body:[['Employees assigned PPE',data.assignedPeople.length],['Checks submitted',data.checks.length],['Checks outstanding',data.outstanding.length],['PPE issues reported',data.issues.length],['Open ordering/actions',data.openIssues.length]],startY:28,theme:'grid',styles:{fontSize:8}});let y=(doc.lastAutoTable?.finalY||55)+7;doc.setFontSize(11);doc.text('PPE checks',14,y);doc.autoTable({head:[['Employee','Submitted','Signed name','Status','Issues']],body:data.checks.length?data.checks.map(c=>{const issues=data.issues.filter(i=>i.check_id===c.id);return [personName(c.user_id),fmtDateTime(c.submitted_at),c.signature_name||'',c.status||'',issues.map(i=>`${i.ppe_name_snapshot}: ${ppeResultLabel(i.result)}`).join('; ')||'None']}):[['None','','','','']],startY:y+3,styles:{fontSize:7},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('Ordering / action list',14,y);doc.autoTable({head:[['Employee','PPE','Issue','Comment','Action']],body:data.issues.length?data.issues.map(i=>{const c=state.ppeChecks.find(x=>x.id===i.check_id);return [personName(c?.user_id),i.ppe_name_snapshot||ppeItem(i.ppe_item_id)?.name||'',ppeResultLabel(i.result),i.comment||'',ppeActionLabel(i.action_status||'OPEN')]}):[['None','','','','']],startY:y+3,styles:{fontSize:7},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(data.outstanding.length){if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('Outstanding monthly checks',14,y);doc.autoTable({head:[['Employee','Assigned PPE']],body:data.outstanding.map(p=>[p.display_name||p.email,assignedPpeForUser(p.id).map(i=>i.name).join(', ')]),startY:y+3,styles:{fontSize:7},margin:{left:14,right:14}})}return {doc,data}}
async function downloadMonthlyPpeReport(value){if(!isManager())throw new Error('Manager or Admin access required.');const {doc,data}=monthlyPpeReportDoc(value),fileName=`PPE-Checks-${data.b.value}.pdf`,blob=doc.output('blob');downloadBlob(blob,fileName);let archived=false;try{if(!state.loadErrors.generated_reports){const path=`reports/ppe/${data.b.value}/${crypto.randomUUID()}-${safeFileName(fileName)}`,up=await sb.storage.from('safety-files').upload(path,blob,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;const ins=await sb.from('generated_reports').insert({schedule_id:null,report_type:'MONTHLY_PPE',period_start:data.b.start.toISOString().slice(0,10),period_end:data.b.end.toISOString().slice(0,10),file_name:fileName,storage_path:path,status:'ARCHIVED',summary:{ppe_checks_submitted:data.checks.length,ppe_issues:data.issues.length,ppe_open_actions:data.openIssues.length,ppe_checks_outstanding:data.outstanding.length},generated_by:state.user.id}).select().single();if(ins.error)throw ins.error;state.generatedReports.unshift(ins.data);archived=true}}catch(e){console.warn('PPE report archive failed after download',e);toast('PPE PDF downloaded. Archive could not be saved: '+(e.message||'unknown error'));}renderReportArchive();if(archived)toast('Monthly PPE report downloaded and archived.');return {data,archived}}
async function runPpeReportButton(){const b=$('generatePpeReportBtn'),value=$('monthlyReportMonth')?.value||previousMonthValue();if(b){b.disabled=true;b.textContent='Creating PPE report…'}try{await downloadMonthlyPpeReport(value)}catch(e){console.error(e);toast(e.message||'Could not create PPE report.')}finally{if(b){b.disabled=false;b.textContent='Download PPE report'}}}

function monthBounds(value){const m=/^(\d{4})-(\d{2})$/.exec(value||'');if(!m)return null;const y=Number(m[1]),mo=Number(m[2])-1,start=new Date(y,mo,1,0,0,0,0),end=new Date(y,mo+1,0,23,59,59,999);return {value,year:y,month:mo+1,start,end,startISO:start.toISOString(),endISO:end.toISOString(),label:start.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}}
function inRange(date,b){if(!date||!b)return false;const d=new Date(date);return d>=b.start&&d<=b.end}
function trainingCompletionEventsForRange(b){const normal=state.trainingSignoffs.filter(s=>inRange(s.signed_at,b)).map(s=>({user_id:s.user_id,training_session_id:s.training_session_id,at:s.signed_at,method:'Training acknowledgement',signature_name:s.signature_name||'',exception:false}));const ex=state.trainingExceptions.filter(x=>inRange(x.completed_at,b)).map(x=>({user_id:x.user_id,training_session_id:x.training_session_id,at:x.completed_at,method:'Admin exception',signature_name:x.signature_name||'',exception:true}));return [...normal,...ex].sort((a,b)=>new Date(a.at)-new Date(b.at))}
function awarenessCompletionEventsForRange(b){return state.awarenessActivity.filter(a=>a.action==='ACKNOWLEDGED'&&inRange(a.occurred_at,b)).sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at))}
function latestCompletionAt(a,asOf){const sig=state.trainingSignoffs.filter(s=>s.training_assignment_id===a.id&&new Date(s.signed_at)<=asOf).map(s=>({at:s.signed_at})),exc=state.trainingExceptions.filter(x=>x.training_assignment_id===a.id&&new Date(x.completed_at)<=asOf).map(x=>({at:x.completed_at}));return [...sig,...exc].sort((x,y)=>new Date(y.at)-new Date(x.at))[0]||null}
function assignmentOverdueAt(a,t,asOf){if(a.active===false)return false;if(a.assigned_at&&new Date(a.assigned_at)>asOf)return false;const c=latestCompletionAt(a,asOf);if(!c){if(a.due_date)return new Date(a.due_date+'T23:59:59')<asOf;return false}if(a.renewal_value&&a.renewal_unit){const due=addRenewal(c.at,a.renewal_value,a.renewal_unit);return !!due&&new Date(due)<asOf}return false}
function assignmentStateAt(a,t,asOf){if(a.active===false||(a.assigned_at&&new Date(a.assigned_at)>asOf))return {active:false,code:'NOT_ACTIVE'};const c=latestCompletionAt(a,asOf),method=effectiveTrainingMethod(t,a);let due=null,needs=!c;if(c&&a.renewal_value&&a.renewal_unit){due=addRenewal(c.at,a.renewal_value,a.renewal_unit);needs=!!due&&new Date(due)<=asOf}else if(!c&&a.due_date){due=new Date(a.due_date+'T23:59:59').toISOString()}if(!needs)return {active:true,code:'COMPLETED',method,due};if(due&&new Date(due)<asOf)return {active:true,code:'OVERDUE',method,due};if(method==='INSTRUCTOR_LED')return {active:true,code:'AWAITING_INSTRUCTOR',method,due};return {active:true,code:'OUTSTANDING',method,due}}
function monthlyReportData(value){const b=monthBounds(value);if(!b)throw new Error('Select a valid month.');const completions=trainingCompletionEventsForRange(b),awareness=awarenessCompletionEventsForRange(b),approvals=state.versions.filter(v=>versionApprovalStatus(v)==='APPROVED'&&inRange(v.approval_at,b)),reviews=state.documentReviews.filter(r=>inRange(r.reviewed_at||r.created_at,b)),exceptions=completions.filter(x=>x.exception),newAssignments=state.trainingAssignments.filter(a=>a.active!==false&&inRange(a.assigned_at,b));const monthEndStates=state.trainingAssignments.map(a=>{const t=state.training.find(x=>x.id===a.training_session_id);return t&&t.status!=='ARCHIVED'?{a,t,s:assignmentStateAt(a,t,b.end)}:null}).filter(x=>x&&x.s.active),overdue=monthEndStates.filter(x=>x.s.code==='OVERDUE'),awaitingInstructor=monthEndStates.filter(x=>x.s.code==='AWAITING_INSTRUCTOR'),outstanding=monthEndStates.filter(x=>['OVERDUE','AWAITING_INSTRUCTOR','OUTSTANDING'].includes(x.s.code));const pending=pendingApprovalEntries(),approvedVersionIds=new Set(approvals.map(v=>v.id)),retrainingTriggered=state.trainingAssignments.filter(a=>{const t=state.training.find(x=>x.id===a.training_session_id);return a.active!==false&&t?.auto_managed&&approvedVersionIds.has(t.source_document_version_id)});const approvedDocs=state.documents.filter(d=>d.status!=='ARCHIVED').map(d=>({d,v:approvedCurrentVersion(d.id)})).filter(x=>x.v),reviewOverdue=approvedDocs.filter(x=>x.v.review_date&&new Date(x.v.review_date+'T23:59:59')<b.end),reviewDueSoon=approvedDocs.filter(x=>x.v.review_date&&new Date(x.v.review_date+'T23:59:59')>=b.end&&new Date(x.v.review_date+'T23:59:59')<=new Date(b.end.getTime()+30*86400000));const newVersions=approvals.filter(v=>state.versions.filter(x=>x.document_id===v.document_id).length>1),ppe=ppeReportData(value);return {b,completions,awareness,approvals,reviews,overdue,pending,exceptions,newAssignments,awaitingInstructor,outstanding,retrainingTriggered,reviewOverdue,reviewDueSoon,newVersions,ppe}}
function monthlySafetyReportDoc(value){if(!window.jspdf?.jsPDF)throw new Error('PDF library did not load.');const data=monthlyReportData(value),{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});const {b}=data;doc.setFontSize(18);doc.text('Safety Tracker - Monthly Safety Compliance Report',14,14);doc.setFontSize(9);doc.text(`${b.label} · Generated ${new Date().toLocaleString('en-GB')} · Safety Tracker v${APP_VERSION}`,14,21);doc.setFontSize(8);doc.text('This report is an evidence summary. Detailed person/document evidence remains available from Evidence Pack.',14,27);const summary=[['Training completed',data.completions.length],['New training assignments',data.newAssignments.length],['Awareness reviews',data.awareness.length],['PPE checks submitted',data.ppe.checks.length],['PPE issues reported',data.ppe.issues.length],['Open PPE ordering/actions',data.ppe.openIssues.length],['PPE checks outstanding',data.ppe.outstanding.length],['Overdue training at month end',data.overdue.length],['Awaiting instructor at month end',data.awaitingInstructor.length],['Retraining linked to new versions',data.retrainingTriggered.length],['Pending approvals now',data.pending.length],['Documents approved/accepted',data.approvals.length],['Controlled reviews',data.reviews.length],['New/replacement versions approved',data.newVersions.length],['Documents overdue review',data.reviewOverdue.length],['Documents due within 30 days',data.reviewDueSoon.length],['Admin exceptions',data.exceptions.length]];doc.autoTable({head:[['Measure','Count']],body:summary,startY:32,theme:'grid',styles:{fontSize:7.5,cellPadding:1.7},tableWidth:120});let y=(doc.lastAutoTable?.finalY||70)+7;doc.setFontSize(11);doc.text('Training completed during the month',14,y);doc.autoTable({head:[['Employee','Training','Type','Completed','Method']],body:data.completions.length?data.completions.map(c=>{const t=state.training.find(x=>x.id===c.training_session_id);return [personName(c.user_id),trainingReference(t)?`${trainingReference(t)} - ${t?.name||''}`:t?.name||'',kindLabel(trainingKind(t)),fmtDateTime(c.at),c.method]}):[['None','','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;doc.setFontSize(11);doc.text('Annual Safety Awareness completed during the month',14,y);doc.autoTable({head:[['Employee','Awareness topic','Version','Reviewed']],body:data.awareness.length?data.awareness.map(a=>{const i=awarenessItem(a.awareness_item_id);return [personName(a.user_id),i?`${i.code||''} ${i.title}`.trim():'Awareness item',a.item_version_label||'',fmtDateTime(a.occurred_at)]}):[['None','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('Monthly PPE checks',14,y);doc.autoTable({head:[['Employee','Submitted','Signed name','Status','Issues']],body:data.ppe.checks.length?data.ppe.checks.map(c=>{const issues=data.ppe.issues.filter(i=>i.check_id===c.id);return [personName(c.user_id),fmtDateTime(c.submitted_at),c.signature_name||'',c.status||'',issues.map(i=>`${i.ppe_name_snapshot}: ${ppeResultLabel(i.result)}`).join('; ')||'None']}):[['None','','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('PPE ordering / action list',14,y);doc.autoTable({head:[['Employee','PPE','Result','Comment','Action']],body:data.ppe.issues.length?data.ppe.issues.map(i=>{const c=state.ppeChecks.find(x=>x.id===i.check_id);return [personName(c?.user_id),i.ppe_name_snapshot||ppeItem(i.ppe_item_id)?.name||'',ppeResultLabel(i.result),i.comment||'',ppeActionLabel(i.action_status||'OPEN')]}):[['No PPE issues reported','','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('Outstanding training position at month end',14,y);doc.autoTable({head:[['Employee','Training','Status','Delivery','Due']],body:data.outstanding.length?data.outstanding.map(x=>[personName(x.a.user_id),trainingReference(x.t)?`${trainingReference(x.t)} - ${x.t.name}`:x.t.name,x.s.code.replaceAll('_',' '),deliveryText(x.s.method),fmtDate(x.s.due)]):[['None','','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('Document control activity during the month',14,y);const docRows=[...data.approvals.map(v=>{const d=state.documents.find(x=>x.id===v.document_id);return ['Approved/accepted',d?.reference||'',documentDisplayTitle(d),`v${v.version_label||''}`,fmtDateTime(v.approval_at),personName(v.approval_by)]}),...data.reviews.map(r=>{const v=state.versions.find(x=>x.id===r.document_version_id),d=state.documents.find(x=>x.id===v?.document_id);return ['Controlled review',d?.reference||'',documentDisplayTitle(d),`v${v?.version_label||''}`,fmtDateTime(r.reviewed_at||r.created_at),personName(r.reviewed_by||r.user_id)]})].sort((a,b)=>a[4].localeCompare(b[4]));doc.autoTable({head:[['Action','Reference','Document','Version','Date','Person']],body:docRows.length?docRows:[['None','','','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});y=(doc.lastAutoTable?.finalY||y)+7;if(y>165){doc.addPage();y=14}doc.setFontSize(11);doc.text('Document review status',14,y);const reviewRows=[...data.reviewOverdue.map(x=>['Overdue',x.d.reference||'',documentDisplayTitle(x.d),`v${x.v.version_label||''}`,fmtDate(x.v.review_date)]),...data.reviewDueSoon.map(x=>['Due within 30 days',x.d.reference||'',documentDisplayTitle(x.d),`v${x.v.version_label||''}`,fmtDate(x.v.review_date)])];doc.autoTable({head:[['Status','Reference','Document','Version','Review date']],body:reviewRows.length?reviewRows:[['None','','','','']],startY:y+3,styles:{fontSize:7,cellPadding:1.5},margin:{left:14,right:14}});return {doc,data}}
async function generateMonthlySafetyReport(value,opts={download:true,archive:true,scheduleId:null}){if(!isManager())throw new Error('Manager or Admin access required.');const status=$('monthlyReportStatus');if(status){status.hidden=false;status.textContent='Generating monthly report…'}const {doc,data}=monthlySafetyReportDoc(value),fileName=`Safety-Compliance-${data.b.value}.pdf`,blob=doc.output('blob');if(opts.download!==false)downloadBlob(blob,fileName);let report=null,archiveError=null;if(opts.archive!==false&&!state.loadErrors.generated_reports){try{const path=`reports/${data.b.value}/${crypto.randomUUID()}-${safeFileName(fileName)}`,up=await sb.storage.from('safety-files').upload(path,blob,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;const ins=await sb.from('generated_reports').insert({schedule_id:opts.scheduleId||null,report_type:'MONTHLY_SAFETY',period_start:data.b.start.toISOString().slice(0,10),period_end:data.b.end.toISOString().slice(0,10),file_name:fileName,storage_path:path,status:'ARCHIVED',summary:{training_completed:data.completions.length,awareness_completed:data.awareness.length,ppe_checks_submitted:data.ppe.checks.length,ppe_issues:data.ppe.issues.length,ppe_open_actions:data.ppe.openIssues.length,ppe_checks_outstanding:data.ppe.outstanding.length,training_overdue:data.overdue.length,pending_approvals:data.pending.length,documents_approved:data.approvals.length,controlled_reviews:data.reviews.length,admin_exceptions:data.exceptions.length},generated_by:state.user.id}).select().single();if(ins.error)throw ins.error;report=ins.data;state.generatedReports.unshift(report)}catch(e){archiveError=e;console.warn('Monthly report archive failed after download',e)}}renderReportArchive();if(status)status.textContent=archiveError?`${data.b.label} PDF downloaded. Archive could not be saved: ${archiveError.message||'unknown error'}`:`${data.b.label} report created${report?' and archived':''}. Training completed: ${data.completions.length}; awareness reviews: ${data.awareness.length}; PPE checks: ${data.ppe.checks.length}; PPE issues: ${data.ppe.issues.length}.`;toast(archiveError?'Monthly report downloaded; archive save failed.':'Monthly Safety Compliance Report created.');return report}
async function runMonthlyReportButton(){const b=$('generateMonthlyReportBtn'),value=$('monthlyReportMonth')?.value||previousMonthValue();if(b){b.disabled=true;b.textContent='Generating…'}try{await generateMonthlySafetyReport(value,{download:true,archive:true})}catch(e){console.error(e);const status=$('monthlyReportStatus');if(status){status.hidden=false;status.textContent=e.message||'Could not generate report.'}toast(e.message||'Could not generate monthly report.')}finally{if(b){b.disabled=false;b.textContent='Generate monthly report'}}}

async function downloadArchivedReport(id){const r=state.generatedReports.find(x=>x.id===id);if(!r?.storage_path)return toast('Stored report not found.');const d=await sb.storage.from('safety-files').download(r.storage_path);if(d.error||!d.data)return toast(d.error?.message||'Could not download report.');downloadBlob(d.data,r.file_name||'safety-report.pdf');try{await sb.from('report_download_activity').insert({report_id:r.id,user_id:state.user.id,file_name_snapshot:r.file_name||'safety-report.pdf'})}catch(e){console.warn('Report download audit',e)}}
function reportTypeLabel(v){return ({MONTHLY_SAFETY:'Monthly Safety',WEEKLY_SAFETY:'Weekly Safety',MONTHLY_PPE:'Monthly PPE'})[v]||String(v||'Report').replaceAll('_',' ')}
function renderReportArchive(){const el=$('reportArchiveList');if(!el)return;if(state.loadErrors.generated_reports){el.innerHTML='<div class="empty">Run the reporting SQL migration to enable the report archive.</div>';return}const rows=[...state.generatedReports].sort((a,b)=>new Date(b.generated_at||0)-new Date(a.generated_at||0)).slice(0,36);el.innerHTML=rows.length?rows.map(r=>{const logs=isReportViewer()?[]:state.reportEmailLog.filter(x=>x.report_id===r.id),sent=logs.filter(x=>x.status==='SENT').length,failed=logs.filter(x=>x.status==='FAILED').length;return `<div class="item-card compact"><div class="row-between"><div><strong>${esc(r.file_name||'Safety report')}</strong><div class="meta"><span class="badge">${esc(reportTypeLabel(r.report_type))}</span><span>${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}</span><span>Generated ${fmtDateTime(r.generated_at)}</span><span class="badge ${r.status==='EMAIL_FAILED'?'overdue':'complete'}">${esc(r.status||'ARCHIVED')}</span>${logs.length?`<span>${sent} emailed${failed?` · ${failed} failed`:''}</span>`:''}</div></div><div class="row">${btn('Download','secondary',`data-download-report="${r.id}"`)}${logs.length?btn('Email log','ghost',`data-report-email-log="${r.id}"`):''}</div></div></div>`}).join(''):'<div class="empty">No reports have been generated yet.</div>'}
function showReportEmailLog(reportId){const report=state.generatedReports.find(r=>r.id===reportId),rows=state.reportEmailLog.filter(x=>x.report_id===reportId).sort((a,b)=>new Date(b.sent_at||0)-new Date(a.sent_at||0));openModal('Report email log',`<p class="muted">${esc(report?.file_name||'Safety report')}</p><div class="card-list">${rows.length?rows.map(x=>`<div class="item-card compact"><div class="row-between"><div><strong>${esc(x.recipient)}</strong><div class="meta"><span>${fmtDateTime(x.sent_at)}</span><span class="badge ${x.status==='FAILED'?'overdue':'complete'}">${esc(x.status)}</span></div>${x.error_message?`<div class="muted">${esc(x.error_message)}</div>`:''}</div></div></div>`).join(''):'<div class="empty">No email attempts recorded.</div>'}</div><div class="actions">${btn('Close','primary','data-close-modal')}</div>`) }
function showNewReportSchedule(existingId=null){if(!isAdmin())return;const x=existingId?state.reportSchedules.find(r=>r.id===existingId):null;openModal(x?'Edit scheduled report':'New scheduled report',`<div class="form-grid"><label>Name<input id="reportScheduleName" value="${esc(x?.name||'Monthly Safety Compliance Report')}"></label><label>Frequency<select id="reportScheduleFrequency"><option value="MONTHLY" ${x?.frequency!=='WEEKLY'?'selected':''}>Monthly</option><option value="WEEKLY" ${x?.frequency==='WEEKLY'?'selected':''}>Weekly</option></select></label><label>Day of month<input id="reportScheduleDay" type="number" min="1" max="28" value="${Number(x?.day_of_month||1)}"></label><label>Weekly day<select id="reportScheduleWeekday"><option value="1" ${Number(x?.day_of_week||1)===1?'selected':''}>Monday</option><option value="2" ${Number(x?.day_of_week||1)===2?'selected':''}>Tuesday</option><option value="3" ${Number(x?.day_of_week||1)===3?'selected':''}>Wednesday</option><option value="4" ${Number(x?.day_of_week||1)===4?'selected':''}>Thursday</option><option value="5" ${Number(x?.day_of_week||1)===5?'selected':''}>Friday</option><option value="6" ${Number(x?.day_of_week||1)===6?'selected':''}>Saturday</option><option value="7" ${Number(x?.day_of_week||1)===7?'selected':''}>Sunday</option></select></label><label>Recipients<input id="reportScheduleRecipients" placeholder="name@example.com, manager@example.com" value="${esc((x?.recipients||[]).join(', '))}"></label><label class="check-row full"><input id="reportScheduleEnabled" type="checkbox" ${x?.enabled===false?'':'checked'}> Schedule enabled</label><label class="check-row full"><input id="reportScheduleEmail" type="checkbox" ${x?.email_enabled?'checked':''}> Email automatically when the server email runner is configured</label></div><div class="hint-box">Monthly reports cover the previous calendar month. The report is always archived. Email requires the optional Supabase Edge Function included in this build and a configured sender.</div><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Save schedule','primary',`data-save-report-schedule="${x?.id||''}"`)}</div>`)}
async function saveReportSchedule(id=''){if(!isAdmin())return;const name=clean($('reportScheduleName')?.value),frequency=$('reportScheduleFrequency')?.value||'MONTHLY',day=Math.min(28,Math.max(1,Number($('reportScheduleDay')?.value)||1)),recipients=clean($('reportScheduleRecipients')?.value).split(',').map(x=>x.trim()).filter(Boolean);if(!name)return toast('Schedule name is required.');const payload={name,frequency,day_of_month:day,day_of_week:Number($('reportScheduleWeekday')?.value)||1,recipients,enabled:!!$('reportScheduleEnabled')?.checked,email_enabled:!!$('reportScheduleEmail')?.checked,updated_at:new Date().toISOString()};let r;if(id)r=await sb.from('report_schedules').update(payload).eq('id',id);else r=await sb.from('report_schedules').insert({...payload,created_by:state.user.id});if(r.error)return toast(r.error.message);closeModal();await refresh('Scheduled report saved.')}
async function toggleReportSchedule(id){if(!isAdmin())return;const x=state.reportSchedules.find(r=>r.id===id);if(!x)return;const r=await sb.from('report_schedules').update({enabled:!x.enabled,updated_at:new Date().toISOString()}).eq('id',id);if(r.error)return toast(r.error.message);await refresh(`Scheduled report ${x.enabled?'disabled':'enabled'}.`)}
async function runReportSchedule(id){if(!isAdmin())return;const x=state.reportSchedules.find(r=>r.id===id);if(!x)return;if(x.frequency==='WEEKLY')return toast('Weekly schedules run through the automatic server report runner. Use Monthly for an immediate in-app test run.');const month=previousMonthValue(),report=await generateMonthlySafetyReport(month,{download:true,archive:true,scheduleId:null});if(report){await sb.from('report_schedules').update({last_run_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);await refresh('Scheduled report test run created and archived.')}}
function renderReportSchedules(){const el=$('reportScheduleList');if(!el||!isAdmin())return;if(state.loadErrors.report_schedules){el.innerHTML='<div class="empty">Run the reporting SQL migration to enable scheduled reports.</div>';return}const rows=[...state.reportSchedules].sort((a,b)=>String(a.name).localeCompare(String(b.name)));el.innerHTML=rows.length?rows.map(x=>`<div class="item-card schedule-card ${x.enabled?'traffic-green':'traffic-neutral'}"><div class="row-between"><div><h4>${esc(x.name)}</h4><div class="meta"><span class="badge">${esc(x.frequency||'MONTHLY')}</span><span>${x.frequency==='MONTHLY'?`Day ${Number(x.day_of_month||1)}`:`${['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][Number(x.day_of_week||1)]}`}</span><span>${(x.recipients||[]).length} recipient${(x.recipients||[]).length===1?'':'s'}</span><span>${x.email_enabled?'Email enabled':'Archive only'}</span>${x.last_run_at?`<span>Last run ${fmtDateTime(x.last_run_at)}</span>`:''}</div></div><span class="badge ${x.enabled?'complete':''}">${x.enabled?'Enabled':'Disabled'}</span></div><div class="row">${btn('Edit','secondary',`data-edit-report-schedule="${x.id}"`)}${btn(x.enabled?'Disable':'Enable','ghost',`data-toggle-report-schedule="${x.id}"`)}${btn('Run now','primary',`data-run-report-schedule="${x.id}"`)}</div></div>`).join(''):'<div class="empty">No scheduled reports yet.</div>'}


function locationById(id){return state.siteLocations.find(x=>x.id===id)||null}
function locationPath(id){const bits=[];let cur=locationById(id),guard=0;while(cur&&guard++<20){bits.unshift(cur.name);cur=cur.parent_id?locationById(cur.parent_id):null}return bits.join(' › ')||'Unknown location'}
function locationOptions(rows=state.siteLocations){return [...rows].filter(x=>x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.name).localeCompare(String(b.name))).map(x=>`<option value="${x.id}">${esc(locationPath(x.id))}</option>`).join('')}
function permitTraffic(p){if(p.status==='AWAITING_APPROVAL')return 'amber';if(p.status==='AWAITING_CLOSE')return 'amber';if(p.status==='ACTIVE'&&p.expected_finish&&new Date(p.expected_finish)<new Date())return 'red';if(p.status==='ACTIVE')return 'green';return 'neutral'}
function permitStatusLabel(p){if(p.status==='AWAITING_APPROVAL')return 'Awaiting Maintenance approval';if(p.status==='AWAITING_CLOSE')return 'Awaiting Maintenance close-out';if(p.status==='ACTIVE'&&p.expected_finish&&new Date(p.expected_finish)<new Date())return 'On site — expected finish passed';if(p.status==='ACTIVE')return 'On site / Active';if(p.status==='CLOSED')return 'Closed';return p.status||'Unknown'}
function contractorTeamSize(p){const direct=Number(p?.team_size||0);if(direct>1)return direct;const m=String(p?.contractor_signin_comments||'').match(/\[TEAM SIZE:\s*(\d+)\]/i);return m?Math.max(1,Number(m[1])||1):Math.max(1,direct||1)}
function contractorTeamLabel(p){const n=contractorTeamSize(p);return `${n} ${n===1?'person':'people'}`}
function renderOnSite(){const stats=$('onSiteStats'),list=$('onSiteList');if(!stats||!list)return;if(state.offline||!navigator.onLine){stats.innerHTML='';list.innerHTML='<div class="pending-use-warning"><strong>Live connection required.</strong><br>Who’s On Site is live attendance information and is not shown from an offline snapshot.</div>';return;}const rows=state.contractorPermits.filter(p=>['AWAITING_APPROVAL','ACTIVE','AWAITING_CLOSE'].includes(p.status)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));const pending=rows.filter(p=>p.status==='AWAITING_APPROVAL').length,activeRows=rows.filter(p=>p.status==='ACTIVE'),active=activeRows.length,activePeople=activeRows.reduce((n,p)=>n+contractorTeamSize(p),0),allPeople=rows.filter(p=>p.status!=='AWAITING_CLOSE').reduce((n,p)=>n+contractorTeamSize(p),0),overdue=rows.filter(p=>p.status==='ACTIVE'&&p.expected_finish&&new Date(p.expected_finish)<new Date()).length,close=rows.filter(p=>p.status==='AWAITING_CLOSE').length;stats.innerHTML=[['People on site',activePeople,overdue?'red':'green'],['Contractor teams',active,active?'green':'green'],['Awaiting PTW approval',pending,pending?'amber':'green'],['Awaiting close',close,close?'amber':'green'],['Evacuation headcount',allPeople,allPeople?'amber':'green']].map(([l,n,t])=>`<div class="stat traffic-${t}"><span class="traffic-dot"></span><strong>${n}</strong><span>${l}</span></div>`).join('');if(!rows.length){list.innerHTML='<div class="success-note">No contractors are currently signed in.</div>';return}list.innerHTML=rows.map(p=>{const t=permitTraffic(p),loc=(p.location_text||((p.location_ids||[]).map(locationPath).join(', ')))||'Location not recorded';let buttons='';if(p.status==='AWAITING_APPROVAL'&&isMaintenanceUser())buttons=btn('Review & approve PTW','primary',`data-permit-approve="${p.id}"`);else if(p.status==='ACTIVE')buttons=btn('Contractor sign out','primary',`data-permit-signout="${p.id}"`)+btn('Left without signing out','ghost',`data-permit-left="${p.id}"`);else if(p.status==='AWAITING_CLOSE'&&(isMaintenanceUser()||p.ptw_required===false))buttons=btn(p.ptw_required?'Maintenance close-out':'Close visit','primary',`data-permit-close="${p.id}"`);const typeBadge=p.ptw_required?'<span class="badge overdue">PTW</span>':(p.access_only_visit?'<span class="badge due">ACCESS ONLY</span>':'<span class="badge current">SITE SIGN-IN</span>');const keyOpen=p.access_key_issued_at&&!p.access_key_returned_at,keyBadge=keyOpen?`<span class="badge due">KEY ${esc(p.access_key_ref||'ISSUED')}</span>`:(p.access_key_returned_at?'<span class="badge complete">KEY RETURNED</span>':'');const keyButtons=keyOpen?btn('Return key/card','secondary',`data-key-return="${p.id}"`):btn('Issue key/card','secondary',`data-key-issue="${p.id}"`);const keyNotice=keyOpen?'<div class="pending-use-warning compact"><strong>Key/card outstanding.</strong> Return it before completing contractor sign-out.</div>':'';return `<div class="item-card traffic-${t}"><div class="row-between"><div><h4>${esc(p.contractor_name)} · ${esc(p.contractor_company)}</h4><div class="meta"><span class="status-chip status-${t}">${esc(permitStatusLabel(p))}</span><span>${esc(p.permit_no||'')}</span>${typeBadge}${keyBadge}${highRiskBadges(p)}${p.hot_work_required?'<span class="badge overdue">HOT WORK</span>':''}</div></div></div><div class="permit-summary"><strong>Team on site:</strong> ${esc(contractorTeamLabel(p))}<br><strong>Work:</strong> ${esc(p.work_description)}<br><strong>Location:</strong> ${esc(loc)}<br><strong>Signed in:</strong> ${fmtDateTime(p.created_at)}${p.signed_in_by_name?` · <strong>Signed in by:</strong> ${esc(p.signed_in_by_name)}`:''}${p.expected_finish?` · <strong>Expected finish:</strong> ${fmtDateTime(p.expected_finish)}`:''}</div>${keyNotice}<div class="row">${btn('View details','secondary',`data-permit-view="${p.id}"`)}${keyButtons}${buttons}</div></div>`}).join('')}

function permitEventRows(id){return (state.contractorPermitEvents||[]).filter(e=>e.permit_id===id).sort((a,b)=>new Date(a.occurred_at||0)-new Date(b.occurred_at||0))}
function showPermitDetails(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;const asb=Array.isArray(p.asbestos_snapshot)?p.asbestos_snapshot:[],types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[];openModal(`Permit ${p.permit_no||''}`,`<div class="section-card"><h3>${esc(p.contractor_name)} · ${esc(p.contractor_company)}</h3><div class="meta">${statusChip(permitStatusLabel(p),permitTraffic(p))}${highRiskBadges(p)}${p.hot_work_required?'<span class="badge overdue">HOT WORK PERMIT</span>':''}</div><p><strong>Team size:</strong> ${esc(contractorTeamLabel(p))}</p><p><strong>Work:</strong> ${esc(p.work_description)}</p><p><strong>PTW triggers:</strong> ${types.length?esc(types.map(highRiskLabel).join(' · ')):(p.high_risk_none_declared?'None – site sign-in only':'Not recorded')}</p>${p.high_risk_other?`<p><strong>Other high-risk work:</strong> ${esc(p.high_risk_other)}</p>`:''}<p><strong>Location:</strong> ${esc(p.location_text||((p.location_ids||[]).map(locationPath).join(', ')))}</p><p><strong>Expected finish:</strong> ${fmtDateTime(p.expected_finish)}</p>${p.access_key_required?`<p><strong>Key / access:</strong> ${p.access_key_issued_at&&!p.access_key_returned_at?'ISSUED':'RETURNED'} · ${esc(p.access_key_ref||'')} · ${esc(p.access_key_area||'')}</p>${p.guestroom_access_required?`<p><strong>Guestroom access declaration:</strong> ${p.guestroom_access_acknowledged?'Acknowledged':'Not acknowledged'}</p>`:''}`:'<p><strong>Key / access:</strong> Not required</p>'}<p><strong>Contractor sign-in:</strong> ${esc(p.contractor_signin_signed_name||'')} · ${fmtDateTime(p.created_at)}</p>${p.contractor_signin_comments?`<p><strong>Contractor comments:</strong> ${esc(p.contractor_signin_comments)}</p>`:''}${p.maintenance_approved_at?`<p><strong>Approved:</strong> ${esc(p.maintenance_approved_name||'')} · ${fmtDateTime(p.maintenance_approved_at)}</p>`:''}${p.maintenance_approval_comments?`<p><strong>Maintenance comments:</strong> ${esc(p.maintenance_approval_comments)}</p>`:''}${p.fire_info_acknowledged?`<p><strong>Fire/emergency info:</strong> Acknowledged</p>`:''}${p.pre_start_controls&&Object.keys(p.pre_start_controls).length?`<p><strong>Pre-start controls:</strong> ${esc(Object.entries(p.pre_start_controls).map(([k,v])=>k+' '+v).join(' · '))}</p>`:''}${p.pre_start_additional_actions?`<p><strong>Additional pre-start actions:</strong> ${esc(p.pre_start_additional_actions)}</p>`:''}${types.length?`<p><strong>High-risk controls:</strong> ${esc(types.map(x=>HIGH_RISK_CONTROL_TEXT[x]||highRiskLabel(x)).join(' · '))}</p>`:''}${p.contractor_signout_at?`<p><strong>Contractor sign-out:</strong> ${esc(p.contractor_signout_signed_name||'')} · ${fmtDateTime(p.contractor_signout_at)} · ${esc((p.completion_status||'').replaceAll('_',' '))}</p>`:''}${p.contractor_signout_comments?`<p><strong>Contractor completion comments:</strong> ${esc(p.contractor_signout_comments)}</p>`:''}${p.closeout_confirmed?`<p><strong>Work area close-out:</strong> Confirmed</p>`:''}${p.closeout_controls?.notes?`<p><strong>Close-out notes:</strong> ${esc(p.closeout_controls.notes)}</p>`:''}${p.left_without_signout?`<div class="danger-note"><strong>Closed by staff — contractor signature not obtained.</strong><br>${esc(p.left_without_signout_reason||'')}</div>`:''}</div><div class="section-card"><h4>Asbestos check used at sign-in</h4><p>${esc((p.asbestos_register_status||'').replaceAll('_',' '))}</p>${asb.length?asb.map(x=>`<div class="item-card compact"><strong>${esc(x.material)}</strong><div>${esc(locationPath(x.location_id))}</div><div class="muted">${esc(x.identification_status||'')} ${x.condition?'· '+esc(x.condition):''} ${x.management_action?'· '+esc(x.management_action):''}</div></div>`).join(''):'<div class="muted">No asbestos register entries were available for this permit snapshot.</div>'}</div><div class="section-card"><h4>Permit history</h4>${permitEventRows(id).map(e=>`<div class="qa-row"><span>${fmtDateTime(e.occurred_at)} · ${esc(e.action.replaceAll('_',' '))}${e.actor_name?' · '+esc(e.actor_name):''}</span>${e.comment?`<span class="muted">${esc(e.comment)}</span>`:''}</div>`).join('')||'<div class="muted">No events.</div>'}</div><div class="actions">${btn('Close','primary','data-close-modal')}</div>`)}
async function invokePermit(action,payload={}){const r=await sb.functions.invoke('contractor-permit',{body:{action,...payload}});if(r.error)throw new Error(r.error.message||'Permit service failed');if(r.data?.error)throw new Error(r.data.error);return r.data}
function contractorSignatureBlock(prefix,label='Contractor digital signature'){return `<div class="signature-wrap"><label>Signed name<input id="${prefix}SignatureName" autocomplete="name"></label><div class="signature-label">${esc(label)} — sign below with finger or mouse</div><canvas id="${prefix}SignaturePad" class="signature-pad"></canvas><div id="${prefix}SignatureStatus" class="signature-status">Signature not yet captured</div><div class="row">${btn('Clear signature','ghost',`id="${prefix}ClearSignature"`)}</div></div>`}
async function showContractorPortal(route='STAFF'){if(!state.user)return toast('Staff sign-in is required.');route='STAFF';$('authView').hidden=true;$('appView').hidden=true;$('demoView').hidden=true;$('contractorView').hidden=false;const box=$('contractorPortalContent');box.innerHTML='<div class="loading-note">Loading permit locations…</div>';try{const cfg=await invokePermit('public_config');state.siteLocations=cfg.locations||state.siteLocations;renderContractorForm(route,cfg.asbestosLoaded)}catch(e){box.innerHTML=`<div class="danger-note">${esc(e.message)}</div>`}}
function closeContractorPortal(){$('contractorView').hidden=true;if(state.user){$('appView').hidden=false;showView('onsite',{push:false})}else $('authView').hidden=false}
function permitControlSelect(id,label){return `<label>${esc(label)}<select id="${id}"><option value="">Select</option><option value="YES">Yes</option><option value="NA">N/A</option><option value="NO">No</option></select></label>`}
const HIGH_RISK_WORK_TYPES=[
  ['BUILDING_FABRIC','Building fabric disturbance (drilling / cutting / sanding / scraping / chasing / removal)'],
  ['ELECTRICAL','Electrical work / isolation'],
  ['GAS','Gas work'],
  ['MECHANICAL','Mechanical work (including heavy plumbing / plant systems)'],
  ['HOT_WORK','Hot work'],
  ['WORKING_AT_HEIGHT','Working at height / roof work'],
  ['CONFINED_SPACE','Confined space entry'],
  ['EXCAVATION','Excavation / ground works'],
  ['ASBESTOS_RELATED','Asbestos-related work'],
  ['DEMOLITION_STRUCTURAL','Demolition / structural work'],
  ['LIFTING','Lifting operations / lifting equipment'],
  ['LIFT_ELEVATOR','Lift / elevator work'],
  ['PRESSURE_SYSTEMS','Pressure systems'],
  ['FIRE_SYSTEMS','Fire alarm / fire systems / fire-stopping work'],
  ['OTHER','Other high-risk work']
];
const HIGH_RISK_CONTROL_TEXT={
  BUILDING_FABRIC:'The work area and asbestos information have been checked before disturbing the building fabric.',
  ELECTRICAL:'Electrical isolation / lock-off and safe working arrangements are confirmed.',
  GAS:'Gas competence, isolation and safe working arrangements are confirmed.',
  MECHANICAL:'Mechanical isolation, stored energy / pressure and heavy plant or pipework controls are confirmed.',
  HOT_WORK:'Hot-work controls below will be completed before the permit is submitted.',
  WORKING_AT_HEIGHT:'Safe access, fall prevention / protection, rescue arrangements and weather conditions are suitable.',
  CONFINED_SPACE:'A confined-space-specific assessment, atmospheric controls and rescue arrangements are in place.',
  EXCAVATION:'Underground services have been checked and excavation / collapse / edge protection controls are in place.',
  ASBESTOS_RELATED:'The asbestos-specific assessment, authorisation, competence and controls required for this work are in place.',
  DEMOLITION_STRUCTURAL:'Structural stability, work sequence, exclusion and temporary support controls are confirmed.',
  LIFTING:'A suitable lifting plan, lifting equipment and competent persons are in place.',
  LIFT_ELEVATOR:'Lift / elevator isolation, access control, pit/shaft hazards and rescue arrangements are confirmed.',
  PRESSURE_SYSTEMS:'The system is isolated, depressurised and stored energy is controlled.',
  FIRE_SYSTEMS:'Any effect on fire alarms, detection, fire doors or fire-stopping is authorised and reinstatement arrangements are confirmed.',
  OTHER:'Additional high-risk controls for the work described are confirmed.'
};
function highRiskLabel(code){return Object.fromEntries(HIGH_RISK_WORK_TYPES)[code]||String(code||'').replaceAll('_',' ')}
function highRiskSelected(){const rows=[...document.querySelectorAll('.cp-high-risk:checked')].map(x=>x.value);if($('cpHotWorkRequired')?.value==='YES')rows.push('HOT_WORK');return [...new Set(rows)]}
function updateHighRiskWorkUi(){
  const none=$('cpNoHighRisk'),selected=highRiskSelected();
  if(selected.length&&none)none.checked=false;
  const other=$('cpHighRiskOtherWrap');if(other)other.hidden=!selected.includes('OTHER');
  document.querySelectorAll('[data-high-risk-control]').forEach(el=>el.hidden=!selected.includes(el.dataset.highRiskControl));
  const hot=selected.includes('HOT_WORK'),hq=$('cpHotWorkQuestions'),hn=$('cpHotWorkNotSelected');
  if(hq)hq.hidden=!hot;if(hn)hn.hidden=hot;
  const ptw=selected.length>0,pre=$('cpPtwControlsSection'),ptwMsg=$('cpPtwRequiredMessage');
  if(pre)pre.hidden=!ptw;
  if(ptwMsg){const route=$('contractorPortalContent')?.dataset?.contractorRoute||'PUBLIC';const maint=route==='STAFF'&&isMaintenanceUser();ptwMsg.hidden=!ptw;ptwMsg.innerHTML=ptw?(maint?'<strong>Permit to Work required.</strong> You are signed in as an authorised Maintenance user. Complete the contractor sign-in, then review the full PTW and approve it before work starts.':'<strong>Permit to Work required.</strong> Maintenance must review and approve this job before work starts.'):''}
}
function highRiskBadges(p){
  const rows=Array.isArray(p?.high_risk_work_types)?p.high_risk_work_types:[];
  return rows.map(x=>`<span class="badge overdue">${esc(highRiskLabel(x))}</span>`).join('');
}
function showAccessOnlyPortal(){
  if(state.offline||!navigator.onLine)return toast('Reconnect before issuing a key/card.');
  const opts=locationOptions();
  openModal('Issue key / access only',`<div class="hint-box"><strong>No work / no Permit to Work.</strong><br>Use this when a contractor, visitor or other authorised person only needs temporary access or a key/card and is not carrying out work. This creates an Access Only visit on Who's On Site.</div><div class="form-grid"><label>Name<input id="aoName" autocomplete="name"></label><label>Company / organisation<input id="aoCompany"></label><label>Number of people in team (including lead)<input id="aoTeamSize" type="number" min="1" max="100" value="1" inputmode="numeric"></label><label class="full">Reason for access<input id="aoReason" placeholder="e.g. survey, inspection, quotation, room access"></label><label>Expected finish<input id="aoExpectedFinish" type="datetime-local"></label><label>Authorised location<select id="aoLocation"><option value="">Select location</option>${opts}</select></label><label>Key / card number<input id="aoKeyRef" placeholder="e.g. Master 4 / Card 12"></label><label class="full">Authorised area / rooms<input id="aoKeyArea" placeholder="e.g. Room 214 only"></label></div><label class="check-row"><input id="aoGuestroomRequired" type="checkbox"> Access includes a guestroom</label><div id="aoGuestroomDeclaration" hidden><label class="check-row"><input id="aoGuestroomAck" type="checkbox"> I will knock clearly and announce myself before entering a guestroom; use only authorised access; keep the door secured/open on deadlock while inside where appropriate; not sit or lie on beds; not use guestroom facilities, refreshments or guest belongings; never leave the guestroom door open or unsecured if I leave; secure the room when finished; keep the key/card secure and never lend it; report a lost key/card immediately; and return the key/card before leaving site.</label></div><label class="check-row"><input id="aoNoWorkAck" type="checkbox"> I confirm this is access only and I will not carry out work under this visit. If work is required, I will stop and complete the normal contractor sign-in / Permit to Work screening first.</label>${contractorSignatureBlock('aoSignin','Access-only acknowledgement signature')}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Issue key & sign in','primary','data-access-only-submit')}</div>`);
  setupSignaturePad('aoSigninSignaturePad','aoSigninClearSignature');
  $('aoGuestroomRequired')?.addEventListener('change',()=>{$('aoGuestroomDeclaration').hidden=!$('aoGuestroomRequired').checked;if(!$('aoGuestroomRequired').checked)$('aoGuestroomAck').checked=false});
}
async function submitAccessOnlyVisit(){
  const name=clean($('aoName')?.value),company=clean($('aoCompany')?.value),reason=clean($('aoReason')?.value),loc=$('aoLocation')?.value,keyRef=clean($('aoKeyRef')?.value),area=clean($('aoKeyArea')?.value),signed=clean($('aoSigninSignatureName')?.value),sig=signatureData('aoSigninSignaturePad'),guest=!!$('aoGuestroomRequired')?.checked,teamSize=Math.max(1,Math.min(100,Number($('aoTeamSize')?.value||1)||1));
  if(!name||!company||!reason||!loc||!keyRef||!area||!signed)return toast('Complete the name, company, reason, location, key/card, authorised area and signed name.');
  if(!$('aoNoWorkAck')?.checked)return toast('Confirm this is an access-only visit with no work being carried out.');
  if(guest&&!$('aoGuestroomAck')?.checked)return toast('Accept the guestroom access declaration.');
  if(!sig)return toast('Digital signature is required.');
  const payload={contractor_name:name,contractor_company:company,contractor_mobile:null,contractor_email:null,work_description:'ACCESS ONLY — '+reason,expected_finish:$('aoExpectedFinish')?.value?new Date($('aoExpectedFinish').value).toISOString():null,location_ids:[loc],location_text:locationPath(loc),work_scope_type:locationById(loc)?.location_type==='ROOM'?'GUEST_ROOM':'LOCATION',high_risk_work_types:[],high_risk_none_declared:true,high_risk_other:null,high_risk_controls:{},hot_work_required:false,hot_work_details:{},asbestos_acknowledged:true,fire_info_acknowledged:true,pre_start_controls:{},pre_start_additional_actions:'',contractor_signin_signature:sig,contractor_signin_signed_name:signed,contractor_signin_comments:`[TEAM SIZE: ${teamSize}] Lead signer responsible for team. · Access only / no work undertaken. Reason: ${reason}${guest?' · Guestroom access declaration accepted.':''}`};
  try{
    const r=await invokePermit('submit_staff',payload);
    let q=await sb.rpc('set_contractor_access_at_signin_v297',{p_permit_id:r.permit.id,p_signature_data:sig,p_signature_name:signed,p_access_required:true,p_key_ref:keyRef,p_access_area:area,p_guestroom_required:guest,p_guestroom_acknowledged:guest?!!$('aoGuestroomAck')?.checked:false});if(q.error)throw q.error;
    q=await sb.rpc('mark_contractor_access_only_v2911',{p_permit_id:r.permit.id});if(q.error)throw q.error;
    closeModal();await refresh('Access-only visit signed in and key/card issued.');showView('onsite',{push:false});
  }catch(e){toast(e.message||'Could not create access-only visit.')}
}
function renderContractorForm(route,asbestosLoaded){const box=$('contractorPortalContent');box.dataset.contractorRoute=route;const opts=locationOptions();box.innerHTML=`<div class="section-card"><h3>1. Contractor and work details</h3><div class="form-grid"><label>Contractor name<input id="cpName" autocomplete="name"></label><label>Company<input id="cpCompany"></label><label>Number of people in team (including lead)<input id="cpTeamSize" type="number" min="1" max="100" value="1" inputmode="numeric"></label><label class="full">Work description<textarea id="cpWorkDescription" placeholder="Describe the work being carried out"></textarea></label><label>Expected finish<input id="cpExpectedFinish" type="datetime-local"></label><label>Work location<select id="cpLocation"><option value="">Select location</option>${opts}</select></label></div><p class="muted">One lead contractor signs for the team and takes responsibility for the people included in this sign-in. The team number is used for evacuation headcount.</p></div>
<div class="section-card"><h3>2. Permit to Work screening</h3><p class="muted">Select every item that applies. Any selected item means a Permit to Work is required and Maintenance must approve it before work starts.</p><div class="high-risk-grid">${HIGH_RISK_WORK_TYPES.filter(([v])=>v!=='HOT_WORK').map(([v,l])=>`<label class="check-row"><input class="cp-high-risk" type="checkbox" value="${v}"> ${esc(l)}</label>`).join('')}<label class="check-row no-high-risk"><input id="cpNoHighRisk" type="checkbox"> No – none of these Permit to Work triggers apply</label></div><label id="cpHighRiskOtherWrap" hidden>Describe other high-risk work<input id="cpHighRiskOther" placeholder="Describe the high-risk work"></label><div id="cpPtwRequiredMessage" class="danger-note" hidden></div><div id="cpHighRiskControls" class="high-risk-controls">${HIGH_RISK_WORK_TYPES.filter(([v])=>v!=='HOT_WORK').map(([v])=>`<label class="check-row" data-high-risk-control="${v}" hidden><input id="hrc${v}" type="checkbox"> ${esc(HIGH_RISK_CONTROL_TEXT[v])}</label>`).join('')}</div></div>
<div id="cpAsbestosPanel" class="section-card"><h3>3. Asbestos / location check</h3><div id="cpAsbestosResult">${asbestosLoaded?'Select the work location to check the current register.':'<div class="pending-use-warning"><strong>AMP/survey register not loaded yet.</strong> The stop-work acknowledgement still applies.</div>'}</div><label class="check-row"><input id="cpAsbestosAck" type="checkbox"> I have reviewed the asbestos/location information presented for where I will work. I understand it covers <strong>known or presumed asbestos in the current records only</strong>. If I uncover suspected asbestos, or conditions differ from the information provided, I will stop work, prevent disturbance and report it before continuing.</label></div>
<div class="section-card"><h3>4. Site emergency & fire information</h3><div class="hint-box"><strong>Weekly fire alarm test:</strong> Thursday at 13:30.<br><strong>Emergency assembly point:</strong> Front car park.<br>If the fire alarm sounds outside the scheduled test, stop work, make the area safe if safe to do so, leave by the nearest safe exit and report to the front car park. Do not obstruct fire exits, escape routes, extinguishers, call points or fire doors. Any work that may affect fire detection must be declared and any authorised isolation must be reinstated before close-out.</div><label class="check-row"><input id="cpFireAck" type="checkbox"> I have been informed of the site fire alarm arrangements, the Thursday 13:30 weekly test and the front car park assembly point. I understand the evacuation procedure and will not interfere with fire safety systems or escape routes unless specifically authorised.</label></div>
<div class="section-card"><h3>5. Hot work</h3><label>Hot work permit required?<select id="cpHotWorkRequired"><option value="">Select Yes or No</option><option value="NO">No</option><option value="YES">Yes</option></select></label><div id="cpHotWorkNotSelected" class="muted">Select Yes for welding, grinding, brazing or other heat/spark-producing work. Yes automatically triggers a Permit to Work.</div><div id="cpHotWorkQuestions" hidden><div class="danger-note"><strong>HOT WORK SELECTED.</strong> Complete the additional hot-work controls below.</div><div class="form-grid"><label>Type of hot work<input id="cpHotType" placeholder="e.g. welding, grinding, brazing"></label><label>Exact hot-work location<input id="cpHotLocation"></label><label>Combustibles removed/protected?<select id="cpHotComb"><option value="">Select</option><option>Yes</option><option>No - controls recorded</option></select></label><label>Suitable extinguishers ready?<select id="cpHotExt"><option value="">Select</option><option>Yes</option><option>No</option></select></label><label>Fire detection / alarm impact checked?<select id="cpHotDetection"><option value="">Select</option><option>No isolation required</option><option>Isolation required and authorised</option></select></label><label>Fire watch required?<select id="cpHotWatch"><option value="">Select</option><option>No</option><option>Yes</option></select></label><label>Post-work fire check / watch<input id="cpHotPost" placeholder="e.g. 60 min fire watch"></label><label class="full">Additional hot-work controls<textarea id="cpHotNotes"></textarea></label></div></div></div>
<div class="section-card"><h3>6. Key / access control</h3><label>Is key/card access required?<select id="cpAccessKeyRequired"><option value="">Select Yes or No</option><option value="NO">No</option><option value="YES">Yes</option></select></label><div id="cpAccessKeyDetails" hidden><div class="hint-box"><strong>One sign-in, one record.</strong> Any key/card issued here is tied to this contractor visit and, where a PTW is required, to the same permit. The contractor signs once at the end of this form.</div><div class="form-grid"><label>Key / card number<input id="cpAccessKeyRef" placeholder="e.g. Master 4 / Card 12"></label><label>Authorised area / rooms<input id="cpAccessKeyArea" placeholder="e.g. Room 214 only"></label></div><label class="check-row"><input id="cpGuestroomRequired" type="checkbox"> Access includes a guestroom</label><div id="cpGuestroomDeclaration" hidden><label class="check-row"><input id="cpGuestroomAck" type="checkbox"> I will knock clearly and announce myself before entering a guestroom; use only authorised access; keep the door secured on the deadlock/open position while I am working where appropriate; not sit or lie on beds; not use guestroom facilities, refreshments or guest belongings; never leave the guestroom door open or unsecured if I leave the room; secure the room when finished; keep any key/card secure and never lend it to another person; report a lost key/card immediately; and return any issued key/card before leaving site.</label></div></div><p class="muted">For non-PTW visits this records access without creating a Permit to Work. For PTW jobs it forms part of the same contractor/permit record.</p></div>
<div id="cpPtwControlsSection" class="section-card" hidden><h3>7. Permit to Work pre-start controls</h3><div class="form-grid">${permitControlSelect('cpBarrier','Barriers / exclusion zone in place')}${permitControlSelect('cpSigns','Warning signage displayed')}${permitControlSelect('cpPpe','Correct PPE identified and in use')}${permitControlSelect('cpAccess','Safe access / egress confirmed')}${permitControlSelect('cpAreaSafe','Work area checked and made safe')}${permitControlSelect('cpTools','Tools / equipment suitable and inspected')}${permitControlSelect('cpElecIso','Electrical isolation / LOTO completed where required')}${permitControlSelect('cpOtherIso','Water / gas / plant isolation completed where required')}${permitControlSelect('cpFirePrec','Fire precautions in place')}${permitControlSelect('cpExtinguisher','Suitable extinguisher available where required')}${permitControlSelect('cpCoshh','COSHH information reviewed where chemicals are used')}${permitControlSelect('cpManual','Manual handling risks considered')}${permitControlSelect('cpHeight','Working-at-height controls in place')}${permitControlSelect('cpGuests','Public / guest protection considered')}${permitControlSelect('cpHousekeeping','Housekeeping / trip hazards controlled')}${permitControlSelect('cpEmergency','Emergency arrangements understood')}</div><label>Additional precautions / safety actions taken<textarea id="cpAdditionalActions" placeholder="e.g. area cordoned off, wet-floor signs placed, supply isolated and locked off"></textarea></label><div class="muted">Any item marked No must be resolved before Maintenance approval. N/A should only be used where the control genuinely does not apply.</div></div>
<div class="section-card"><h3>8. Contractor declaration</h3><div class="compliance-disclaimer"><strong>Compliance notice:</strong> This sign-in and signature support attendance, induction, access and Permit to Work records. They do not by themselves confirm legal compliance, competence, authorisation or that the work is safe to proceed. Required RAMS, permits, qualifications, insurance, supervision and safety controls remain the responsibility of the contractor and site management.</div><label>Contractor comments<textarea id="cpComments" placeholder="Optional comments before starting"></textarea></label>${contractorSignatureBlock('cpSignin','Contractor sign-in signature')}<div class="actions">${btn('Cancel','ghost','data-contractor-cancel')}${btn('Complete site sign-in','primary',`data-contractor-submit="${route}"`)}</div></div>`;
setupSignaturePad('cpSigninSignaturePad','cpSigninClearSignature');
document.querySelectorAll('.cp-high-risk').forEach(x=>x.addEventListener('change',updateHighRiskWorkUi));
$('cpHotWorkRequired')?.addEventListener('change',updateHighRiskWorkUi);
$('cpAccessKeyRequired')?.addEventListener('change',()=>{const yes=$('cpAccessKeyRequired').value==='YES';$('cpAccessKeyDetails').hidden=!yes;if(!yes){$('cpGuestroomRequired').checked=false;$('cpGuestroomDeclaration').hidden=true;$('cpGuestroomAck').checked=false}});
$('cpGuestroomRequired')?.addEventListener('change',()=>{$('cpGuestroomDeclaration').hidden=!$('cpGuestroomRequired').checked;if(!$('cpGuestroomRequired').checked)$('cpGuestroomAck').checked=false});
$('cpNoHighRisk').addEventListener('change',()=>{if($('cpNoHighRisk').checked){document.querySelectorAll('.cp-high-risk').forEach(x=>x.checked=false);if($('cpHotWorkRequired'))$('cpHotWorkRequired').value='NO'}updateHighRiskWorkUi()});
updateHighRiskWorkUi();
$('cpLocation').addEventListener('change',async()=>{const id=$('cpLocation').value;if(!id)return;$('cpAsbestosResult').innerHTML='Checking current register…';try{const a=await invokePermit('asbestos_preview',{location_ids:[id]});$('cpAsbestosResult').innerHTML=a.status==='NOT_LOADED'?'<div class="pending-use-warning"><strong>AMP/survey register not loaded yet.</strong> Do not assume the area is asbestos-free. Follow the stop-work rule for suspect material.</div>':a.rows?.length?a.rows.map(x=>`<div class="item-card compact traffic-amber"><strong>${esc(x.material)}</strong><div class="meta"><span>${esc(x.identification_status||'')}</span><span>${esc(x.condition||'')}</span></div>${x.management_action?`<div>${esc(x.management_action)}</div>`:''}</div>`).join(''):'<div class="hint-box"><strong>No known ACM is recorded for this selected location in the current register.</strong><br>This does not confirm the area is asbestos-free. Stop work if suspect material is encountered.</div>'}catch(e){$('cpAsbestosResult').innerHTML=`<div class="danger-note">${esc(e.message)}</div>`}})}
async function submitContractorPortal(route){const loc=$('cpLocation').value;if(!loc)return toast('Select the work location.');if(!$('cpAsbestosAck').checked)return toast('Complete the asbestos/location acknowledgement.');if(!$('cpFireAck').checked)return toast('Confirm the site fire and emergency information.');const hotAnswer=$('cpHotWorkRequired')?.value;if(!hotAnswer)return toast('Select Yes or No for Hot work permit required.');const accessAnswer=$('cpAccessKeyRequired')?.value;if(!accessAnswer)return toast('Select Yes or No for key/card access required.');const accessRequired=accessAnswer==='YES',guestroomRequired=accessRequired&&!!$('cpGuestroomRequired')?.checked;if(accessRequired&&(!clean($('cpAccessKeyRef')?.value)||!clean($('cpAccessKeyArea')?.value)))return toast('Enter the key/card number and authorised area.');if(guestroomRequired&&!$('cpGuestroomAck')?.checked)return toast('Accept the guestroom access declaration.');const types=highRiskSelected(),noneDeclared=!!$('cpNoHighRisk')?.checked;if(!noneDeclared&&!types.length)return toast('Select any Permit to Work trigger that applies, or confirm none apply.');if(noneDeclared&&types.length)return toast('Choose either Permit to Work triggers or No triggers apply.');const other=clean($('cpHighRiskOther')?.value);if(types.includes('OTHER')&&!other)return toast('Describe the other high-risk work.');const ptwRequired=types.length>0,highRiskControls={};for(const type of types){if(type==='HOT_WORK'){highRiskControls[type]=true;continue}const el=$(`hrc${type}`);if(!el?.checked)return toast(`Confirm the additional control for ${highRiskLabel(type)}.`);highRiskControls[type]=true}const sig=signatureData('cpSigninSignaturePad');if(!sig)return toast('Contractor digital signature is required.');const controls={};if(ptwRequired){const controlIds=['cpBarrier','cpSigns','cpPpe','cpAccess','cpAreaSafe','cpTools','cpElecIso','cpOtherIso','cpFirePrec','cpExtinguisher','cpCoshh','cpManual','cpHeight','cpGuests','cpHousekeeping','cpEmergency'];for(const id of controlIds){const v=$(id).value;if(!v)return toast('Complete every Permit to Work pre-start action as Yes, No or N/A.');if(v==='NO')return toast('Resolve any pre-start action marked No before submitting the Permit to Work.');controls[id.replace(/^cp/,'')]=v}}
if(types.includes('ELECTRICAL')&&controls.ElecIso!=='YES')return toast('Electrical work requires the electrical isolation / LOTO control to be confirmed Yes.');
if((types.includes('GAS')||types.includes('MECHANICAL')||types.includes('PRESSURE_SYSTEMS'))&&controls.OtherIso!=='YES')return toast('Gas, mechanical or pressure-system work requires the relevant isolation control to be confirmed Yes.');
if(types.includes('WORKING_AT_HEIGHT')&&controls.Height!=='YES')return toast('Working at height / roof work requires the working-at-height control to be confirmed Yes.');
const hot=types.includes('HOT_WORK');const teamSize=Math.max(1,Math.min(100,Number($('cpTeamSize')?.value||1)||1));const payload={contractor_name:clean($('cpName').value),contractor_company:clean($('cpCompany').value),contractor_mobile:null,contractor_email:null,work_description:clean($('cpWorkDescription').value),expected_finish:$('cpExpectedFinish').value?new Date($('cpExpectedFinish').value).toISOString():null,location_ids:[loc],location_text:locationPath(loc),work_scope_type:locationById(loc)?.location_type==='ROOM'?'GUEST_ROOM':locationById(loc)?.location_type==='FLOOR'?'GUEST_FLOOR':locationById(loc)?.location_type==='GUEST_ROOMS'?'ALL_GUEST_ROOMS':'LOCATION',high_risk_work_types:types,high_risk_none_declared:noneDeclared,high_risk_other:other||null,high_risk_controls:highRiskControls,hot_work_required:hot,hot_work_details:hot?{work_type:clean($('cpHotType').value),exact_location:clean($('cpHotLocation').value),combustibles_controlled:clean($('cpHotComb').value),extinguishers_ready:clean($('cpHotExt').value),fire_detection_checked:clean($('cpHotDetection').value),fire_watch_required:clean($('cpHotWatch').value),post_work_check:clean($('cpHotPost').value),notes:clean($('cpHotNotes').value)}:{},asbestos_acknowledged:true,fire_info_acknowledged:true,pre_start_controls:controls,pre_start_additional_actions:ptwRequired?clean($('cpAdditionalActions').value):'',contractor_signin_signature:sig,contractor_signin_signed_name:clean($('cpSigninSignatureName').value),contractor_signin_comments:clean(`[TEAM SIZE: ${teamSize}] Lead signer responsible for team.`+(clean($('cpComments').value)?' · '+clean($('cpComments').value):'')+(guestroomRequired?' · Guestroom access declaration accepted.':''))} ;if(!payload.contractor_name||!payload.contractor_company||!payload.work_description||!payload.contractor_signin_signed_name)return toast('Complete contractor name, company, work description and signed name.');try{const r=await invokePermit(route==='STAFF'?'submit_staff':'submit_public',payload);if(accessRequired){const {error:keyError}=await sb.rpc('set_contractor_access_at_signin_v297',{p_permit_id:r.permit.id,p_signature_data:sig,p_signature_name:payload.contractor_signin_signed_name,p_access_required:true,p_key_ref:clean($('cpAccessKeyRef').value),p_access_area:clean($('cpAccessKeyArea').value),p_guestroom_required:guestroomRequired,p_guestroom_acknowledged:guestroomRequired?!!$('cpGuestroomAck')?.checked:false});if(keyError)throw keyError;r.permit.access_key_required=true;r.permit.access_key_ref=clean($('cpAccessKeyRef').value);r.permit.access_key_area=clean($('cpAccessKeyArea').value);r.permit.access_key_issued_at=new Date().toISOString();r.permit.guestroom_access_required=guestroomRequired;r.permit.guestroom_access_acknowledged=guestroomRequired?!!$('cpGuestroomAck')?.checked:false}renderPermitApprovalStep(r.permit,route,r)}catch(e){toast(e.message)}}
function renderPermitApprovalStep(permit,route,result={}){const box=$('contractorPortalContent');if(!permit.ptw_required){box.innerHTML=`<div class="success-note"><strong>Contractor signed in.</strong><br>${esc(permit.permit_no)} is now active on Who's On Site. Fire/life-safety and asbestos information have been acknowledged. No Permit to Work trigger was selected.${permit.access_key_required?`<br><strong>Key/card issued:</strong> ${esc(permit.access_key_ref||'')} · ${esc(permit.access_key_area||'')}`:''}</div><div class="actions">${btn(route==='STAFF'?"Return to Who's On Site":'Finish','primary','data-contractor-cancel')}</div>`;return}
if(route==='STAFF'&&result.signer_is_maintenance){box.innerHTML=`<div class="danger-note"><strong>Permit to Work required — contractor must not start yet.</strong><br>${esc(permit.permit_no)} has been saved as Awaiting Maintenance approval.</div><div class="section-card"><h3>Maintenance review required</h3><p>You are signed in as an authorised Maintenance user. Tap <strong>Review PTW now</strong> to open the complete submitted permit and contractor signature. Review it, then electronically sign the approval with your authenticated account before the contractor starts work.</p><div class="actions">${btn("Review PTW now",'primary',`data-contractor-review-ptw="${permit.id}"`)}</div></div>`;return}
if(route==='STAFF'){box.innerHTML=`<div class="danger-note"><strong>Permit to Work required — do not start work.</strong><br>This contractor must now be taken to Maintenance for review and approval. Permit ${esc(permit.permit_no)} is visible in Who's On Site as Awaiting approval.</div><div class="actions">${btn("Return to Who's On Site",'primary','data-contractor-cancel')}</div>`;return}
box.innerHTML=`<div class="danger-note"><strong>Permit to Work required — do not start work.</strong><br>Permit ${esc(permit.permit_no)} is awaiting Maintenance approval. Please see Maintenance before starting.</div><div class="section-card"><h3>Maintenance approval</h3><p>A Maintenance user may approve here using their Safety Tracker login, or open the permit from Who's On Site.</p><label>Maintenance email<input id="cpMaintEmail" type="email" autocomplete="username"></label><label>Password<input id="cpMaintPassword" type="password" autocomplete="current-password"></label><label>Maintenance comments<textarea id="cpMaintApprovalComment"></textarea></label><div class="actions">${btn('Approve permit','primary',`data-contractor-approve-credentials="${permit.id}"`)}</div></div>`}
async function reviewPermitAfterSubmit(id){try{await loadAll();showPermitApproval(id,true)}catch(e){toast(e.message||'Could not load the submitted permit.')}}
async function approvePermitCredentials(id){try{const r=await invokePermit('approve_credentials',{permit_id:id,email:clean($('cpMaintEmail').value),password:$('cpMaintPassword').value,comment:clean($('cpMaintApprovalComment').value)});$('contractorPortalContent').innerHTML=`<div class="success-note"><strong>Permit approved.</strong><br>Approved by ${esc(r.approved_by||'Maintenance')}. The contractor is now shown as on site.</div><div class="actions">${btn('Finish','primary','data-contractor-cancel')}</div>`}catch(e){toast(e.message)}}
async function approvePermitSession(id){try{await invokePermit('approve_session',{permit_id:id,comment:clean($('cpMaintApprovalComment').value)});await loadAll();$('contractorPortalContent').innerHTML=`<div class="success-note"><strong>Permit approved.</strong> The contractor is now shown as on site.</div><div class="actions">${btn('Return to Who\'s On Site','primary','data-contractor-cancel')}</div>`}catch(e){toast(e.message)}}
function showPermitApproval(id,fromPortal=false){
  const p=state.contractorPermits.find(x=>x.id===id);if(!p)return toast('Permit could not be loaded.');
  const types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[],asb=Array.isArray(p.asbestos_snapshot)?p.asbestos_snapshot:[];
  const preLabels={Barrier:'Barriers / exclusion zone',Signs:'Warning signage',Ppe:'PPE',Access:'Safe access / egress',AreaSafe:'Work area safe',Tools:'Tools / equipment inspected',ElecIso:'Electrical isolation / LOTO',OtherIso:'Water / gas / plant isolation',FirePrec:'Fire precautions',Extinguisher:'Extinguisher',Coshh:'COSHH',Manual:'Manual handling',Height:'Working at height',Guests:'Guest / public protection',Housekeeping:'Housekeeping',Emergency:'Emergency arrangements'};
  const pre=Object.entries(p.pre_start_controls||{}).map(([k,v])=>`<div class="qa-row"><span>${esc(preLabels[k]||k)}</span><strong>${esc(v)}</strong></div>`).join('')||'<div class="muted">No PTW pre-start controls recorded.</div>';
  const hot=p.hot_work_required?Object.entries(p.hot_work_details||{}).filter(([,v])=>clean(v)).map(([k,v])=>`<div class="qa-row"><span>${esc(k.replaceAll('_',' '))}</span><strong>${esc(v)}</strong></div>`).join(''):'';
  const sig=String(p.contractor_signin_signature||'').startsWith('data:image/png;base64,')?`<div class="signature-review"><div class="muted">Contractor digital signature</div><img src="${p.contractor_signin_signature}" alt="Contractor sign-in signature" style="max-width:100%;height:auto;background:#fff;border-radius:8px;padding:8px"></div>`:'<div class="muted">Contractor signature image unavailable.</div>';
  const asbestosHtml=asb.length?asb.map(x=>`<div class="item-card compact"><strong>${esc(x.material||'Asbestos register item')}</strong><div>${esc(locationPath(x.location_id))}</div><div class="muted">${esc(x.identification_status||'')} ${x.condition?'· '+esc(x.condition):''} ${x.management_action?'· '+esc(x.management_action):''}${x.source_page?' · source page '+esc(x.source_page):''}</div></div>`).join(''):`<div class="${p.asbestos_register_status==='NOT_LOADED'?'danger-note':'hint-box'}"><strong>Asbestos register status:</strong> ${esc((p.asbestos_register_status||'Not recorded').replaceAll('_',' '))}<br>${p.asbestos_register_status==='NOT_LOADED'?'AMP/survey register was not loaded at sign-in. Do not treat the location as asbestos-free.':'No location-specific ACM entries were snapshotted for this permit.'}</div>`;
  openModal('Review & electronically sign PTW',`<input id="permitApprovalReturn" type="hidden" value="${fromPortal?'PORTAL':'APP'}"><div class="section-card"><h3>${esc(p.permit_no)} · ${esc(p.contractor_name)} · ${esc(p.contractor_company)}</h3><p><strong>Work:</strong> ${esc(p.work_description)}</p><p><strong>Location:</strong> ${esc(p.location_text||((p.location_ids||[]).map(locationPath).join(', ')))}</p><p><strong>Expected finish:</strong> ${fmtDateTime(p.expected_finish)}</p><p><strong>PTW triggers:</strong> ${types.length?esc(types.map(highRiskLabel).join(' · ')):'Not recorded'}</p>${p.high_risk_other?`<p><strong>Other high-risk work:</strong> ${esc(p.high_risk_other)}</p>`:''}${p.pre_start_additional_actions?`<p><strong>Additional precautions / actions:</strong> ${esc(p.pre_start_additional_actions)}</p>`:''}</div><div class="section-card"><h4>Contractor declarations</h4><p><strong>Fire / emergency information:</strong> ${p.fire_info_acknowledged?'Acknowledged':'Not acknowledged'}</p><p><strong>Asbestos / location acknowledgement:</strong> ${p.asbestos_acknowledged?'Acknowledged':'Not acknowledged'}</p><p><strong>Signed name:</strong> ${esc(p.contractor_signin_signed_name||'')} · ${fmtDateTime(p.created_at)}</p>${p.contractor_signin_comments?`<p><strong>Contractor comments:</strong> ${esc(p.contractor_signin_comments)}</p>`:''}${sig}</div><div class="section-card"><h4>PTW pre-start controls</h4>${pre}</div>${p.hot_work_required?`<div class="section-card traffic-red"><h4>Hot-work controls</h4>${hot||'<div class="danger-note">Hot work selected but detailed controls are not available.</div>'}</div>`:''}<div class="section-card"><h4>Asbestos check captured at sign-in</h4>${asbestosHtml}</div>${types.includes('CONFINED_SPACE')?'<div class="danger-note"><strong>CONFINED SPACE.</strong> Confirm the task-specific assessment, atmospheric controls and rescue arrangements before approval.</div>':''}${types.includes('ASBESTOS_RELATED')?'<div class="danger-note"><strong>ASBESTOS-RELATED WORK.</strong> Do not approve unless the asbestos-specific authorisation, competence and controls are confirmed.</div>':''}${types.includes('LIFT_ELEVATOR')?'<div class="danger-note"><strong>LIFT / ELEVATOR WORK.</strong> Confirm isolation, access control, pit/shaft hazards and rescue arrangements before approval.</div>':''}<label>Maintenance review comments<textarea id="permitApprovalComment" placeholder="Record any permit-specific checks, restrictions or instructions"></textarea></label><label class="check-row"><input id="permitApprovalAck" type="checkbox"> I have reviewed the complete PTW above, including the contractor declaration/signature, work location, asbestos information, fire/life-safety acknowledgement, selected PTW triggers and pre-start controls. I approve the work to start.</label><div class="hint-box"><strong>Electronic Maintenance sign-off:</strong> approving records your authenticated Safety Tracker identity, date and time against this permit.</div><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Approve & sign PTW','primary',`data-permit-confirm-approve="${id}"`)}</div>`)
}
async function confirmPermitApproval(id){if(!$('permitApprovalAck').checked)return toast('Tick the approval confirmation.');const ret=$('permitApprovalReturn')?.value||'APP';try{await invokePermit('approve_session',{permit_id:id,comment:clean($('permitApprovalComment').value)});closeModal();await loadAll();if(ret==='PORTAL'&&$('contractorPortalContent')){$('contractorPortalContent').innerHTML=`<div class="success-note"><strong>PTW approved and electronically signed.</strong><br>Your authenticated Maintenance identity, date and time have been recorded. The contractor may now start the approved work.</div><div class="actions">${btn("Return to Who's On Site",'primary','data-contractor-cancel')}</div>`}else{showView('onsite',{push:false});renderOnSite();toast('Contractor PTW approved and signed.')}}catch(e){toast(e.message)}}
function showIssueAccessKey(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;openModal('Issue access key / card',`<p><strong>${esc(p.contractor_name)} · ${esc(p.contractor_company)}</strong></p><div class="hint-box">This access control is separate from Permit to Work. Record the physical key/card issued and exactly where it may be used.</div><label>Key / card number<input id="accessKeyRef" placeholder="e.g. Master 4 / Card 12"></label><label>Authorised area / rooms<input id="accessKeyArea" value="${esc(p.location_text||'')}" placeholder="e.g. Room 214 only"></label><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Issue key/card','primary',`data-key-confirm-issue="${id}"`)}</div>`)}
async function confirmIssueAccessKey(id){const key=clean($('accessKeyRef')?.value),area=clean($('accessKeyArea')?.value);if(!key||!area)return toast('Enter the key/card number and authorised area.');const {error}=await sb.rpc('issue_contractor_access_key_v296',{p_permit_id:id,p_key_ref:key,p_access_area:area});if(error)return toast(error.message);closeModal();await refresh('Access key/card issued and recorded.')}
function showReturnAccessKey(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;openModal('Return access key / card',`<p><strong>${esc(p.access_key_ref||'Key/card')}</strong> · ${esc(p.contractor_name)}</p><p>Authorised area: ${esc(p.access_key_area||p.location_text||'Not recorded')}</p><label>Exception / lost key details (leave blank for normal return)<textarea id="accessKeyException" placeholder="Only use this if the key/card cannot be returned; record who was notified."></textarea></label><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Confirm returned / exception','primary',`data-key-confirm-return="${id}"`)}</div>`)}
async function confirmReturnAccessKey(id){const exception=clean($('accessKeyException')?.value);const {error}=await sb.rpc('return_contractor_access_key_v296',{p_permit_id:id,p_exception:exception||null});if(error)return toast(error.message);closeModal();await refresh(exception?'Access key exception recorded and closed.':'Access key/card returned.')}
function showContractorSignout(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;if(p.access_key_issued_at&&!p.access_key_returned_at)return toast('Return the issued access key/card before contractor sign-out.');const full=p.ptw_required!==false;const closeout=full?`<label class="check-row"><input id="coTidy" type="checkbox"> Work area left clean and tidy; waste, packaging and debris removed.</label><label class="check-row"><input id="coTools" type="checkbox"> Tools, equipment and materials removed or safely stored.</label><label class="check-row"><input id="coBarriers" type="checkbox"> Temporary barriers, cones and warning signs removed, or anything left in place has Maintenance agreement recorded below.</label><label class="check-row"><input id="coProtection" type="checkbox"> Temporary protection / coverings removed where applicable.</label><label class="check-row"><input id="coIsolations" type="checkbox"> Electrical, water, gas and plant isolations reinstated where applicable.</label><label class="check-row"><input id="coFire" type="checkbox"> Any fire detector / alarm isolations have been reinstated where applicable.</label><label class="check-row"><input id="coExits" type="checkbox"> Fire doors, exits and escape routes are unobstructed.</label><label class="check-row"><input id="coPanels" type="checkbox"> Access panels, ceiling tiles, covers and guards are refitted where applicable.</label><label class="check-row"><input id="coHazards" type="checkbox"> No new hazards have been left behind and the area is safe for normal use.</label>`:`<label class="check-row"><input id="coTidy" type="checkbox"> Work area left clean and tidy; waste and debris removed.</label><label class="check-row"><input id="coTools" type="checkbox"> Tools, equipment and materials removed or safely stored.</label><label class="check-row"><input id="coBarriers" type="checkbox"> Any temporary barriers, cones or warning signs have been removed, or agreed to remain.</label><label class="check-row"><input id="coHazards" type="checkbox"> No new hazards have been left behind and the area is safe for normal use.</label>`;openModal(full?'Contractor PTW sign out':'Contractor sign out',`<p><strong>${esc(p.contractor_name)} · ${esc(p.contractor_company)}</strong></p>${full?'<div class="hint-box"><strong>Permit to Work close-out.</strong> Complete all applicable reinstatement and housekeeping confirmations.</div>':'<div class="hint-box"><strong>Site sign-in close-out.</strong> Confirm the area has been left safe and tidy.</div>'}<label>Job status<select id="permitCompletionStatus"><option value="COMPLETED">Job completed</option><option value="FURTHER_WORK_REQUIRED">Further work required</option></select></label><div class="section-card"><h4>Work area close-out</h4>${closeout}<label>Anything left in place / close-out notes<textarea id="permitCloseoutNotes" placeholder="Record anything intentionally left in place and why"></textarea></label></div><label>Contractor comments<textarea id="permitContractorOutComments" placeholder="Add details if further work is required"></textarea></label>${contractorSignatureBlock('permitOut','Contractor sign-out signature')}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Contractor sign out','primary',`data-permit-confirm-signout="${id}"`)}</div>`);setupSignaturePad('permitOutSignaturePad','permitOutClearSignature')}
async function confirmContractorSignout(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;const full=p.ptw_required!==false,checks=full?['coTidy','coTools','coBarriers','coProtection','coIsolations','coFire','coExits','coPanels','coHazards']:['coTidy','coTools','coBarriers','coHazards'];if(checks.some(x=>!$(x)?.checked))return toast('Complete all required work area close-out confirmations before signing out.');const sig=signatureData('permitOutSignaturePad');if(!sig)return toast('Contractor sign-out signature is required.');const signed=clean($('permitOutSignatureName').value);if(!signed)return toast('Enter contractor signed name.');const closeout={tidy:true,tools_removed_or_safe:true,barriers_removed_or_agreed:true,no_new_hazards:true,notes:clean($('permitCloseoutNotes').value)};if(full){Object.assign(closeout,{temporary_protection_removed:true,isolations_reinstated:true,fire_isolations_reinstated:true,fire_routes_clear:true,panels_guards_refitted:true})}try{await invokePermit('contractor_finish',{permit_id:id,completion_status:$('permitCompletionStatus').value,contractor_signout_signature:sig,contractor_signout_signed_name:signed,contractor_signout_comments:clean($('permitContractorOutComments').value),closeout_controls:closeout,closeout_confirmed:true});await loadAll();showPermitClose(id)}catch(e){toast(e.message)}}
function showPermitClose(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;openModal(p.ptw_required?'Maintenance close-out':'Contractor visit close-out',`<p><strong>${esc(p.contractor_name)} · ${esc(p.contractor_company)}</strong></p><div class="success-note">Contractor sign-out captured${p.completion_status==='FURTHER_WORK_REQUIRED'?' — further work required':''}.</div><label>Maintenance close-out comments<textarea id="permitCloseComment"></textarea></label><label class="check-row"><input id="permitCloseAck" type="checkbox"> I have checked the work area, reviewed the contractor close-out and comments, and confirm the contractor has left site.</label><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Close permit','primary',`data-permit-confirm-close="${id}"`)}</div>`)}
async function confirmPermitClose(id){if(!$('permitCloseAck').checked)return toast('Tick the maintenance close-out confirmation.');try{await invokePermit('close_session',{permit_id:id,comment:clean($('permitCloseComment').value)});closeModal();await refresh('Contractor signed out and permit closed.')}catch(e){toast(e.message)}}
function showLeftWithoutSignout(id){const p=state.contractorPermits.find(x=>x.id===id);if(!p)return;if(p.access_key_issued_at&&!p.access_key_returned_at)return toast('An access key/card is still issued. Record its return or an exception first.');openModal('Contractor left without signing out',`<div class="danger-note">Use this only when the contractor has already left site and their digital sign-out signature cannot be obtained. The record will clearly state that staff closed the visit without the contractor signature.</div><label>Mandatory reason / comments<textarea id="permitLeftReason"></textarea></label><label class="check-row"><input id="permitLeftAck" type="checkbox"> I confirm this contractor has left site.</label><div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Confirm left site','danger',`data-permit-confirm-left="${id}"`)}</div>`)}
async function confirmLeftWithoutSignout(id){if(!$('permitLeftAck').checked)return toast('Tick the confirmation.');const reason=clean($('permitLeftReason').value);if(!reason)return toast('Enter the reason/comments.');try{await invokePermit('left_without_signout',{permit_id:id,reason});closeModal();await refresh('Permit closed by staff without contractor sign-out signature.')}catch(e){toast(e.message)}}

function renderAsbestosSourceAdmin(){
  const list=$('asbestosSourceAdminList');if(!list||!isAdmin())return;
  const rows=[...state.asbestosSources].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  if(!rows.length){list.innerHTML='<div class="muted">No AMP, survey or asbestos source document uploaded yet.</div>';return}
  list.innerHTML=rows.map(x=>`<div class="item-card compact traffic-${x.active===false?'neutral':'green'}"><div class="row-between"><div><strong>${esc(x.title)}</strong><div class="meta"><span>${esc(x.document_type||'OTHER')}</span>${x.document_date?`<span>${fmtDate(x.document_date)}</span>`:''}${x.version_label?`<span>${esc(x.version_label)}</span>`:''}<span>${x.active===false?'Archived':'Current source'}</span></div></div></div><div class="row">${x.storage_path?btn('Open PDF','secondary',`data-open-asbestos-source="${x.id}"`):''}${x.active!==false?btn('Archive','ghost',`data-archive-asbestos-source="${x.id}"`):''}</div></div>`).join('');
}
async function uploadAsbestosSourceDocument(){
  if(!isAdmin())return toast('Admin access required.');
  if(state.offline||!navigator.onLine)return toast('Reconnect before uploading an asbestos document.');
  const file=$('asbestosSourceFile')?.files?.[0],type=$('asbestosSourceType')?.value||'OTHER',title=clean($('asbestosSourceTitle')?.value),date=$('asbestosSourceDate')?.value||null,version=clean($('asbestosSourceVersion')?.value)||null,status=$('asbestosSourceAdminStatus');
  if(!file)return toast('Select the AMP or asbestos survey PDF.');
  if(file.type&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return toast('Upload a PDF file.');
  if(!title)return toast('Enter the document title.');
  if(status){status.hidden=false;status.textContent='Uploading asbestos source document…'}
  const name=`${safeFileName(title)}${version?'-'+safeFileName(version):''}.pdf`,path=`asbestos/${type.toLowerCase()}/${crypto.randomUUID()}-${name}`;
  try{
    const up=await sb.storage.from('safety-files').upload(path,file,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;
    const ins=await sb.from('asbestos_source_documents_v280').insert({document_type:type,title,document_date:date,version_label:version,storage_path:path,file_name:name,active:true,uploaded_by:state.user.id}).select().single();
    if(ins.error){await sb.storage.from('safety-files').remove([path]);throw ins.error}
    state.asbestosSources.unshift(ins.data);renderAsbestosSourceAdmin();renderAsbestosLookup();
    if($('asbestosSourceTitle'))$('asbestosSourceTitle').value='';if($('asbestosSourceVersion'))$('asbestosSourceVersion').value='';if($('asbestosSourceDate'))$('asbestosSourceDate').value='';if($('asbestosSourceFile'))$('asbestosSourceFile').value='';
    if(status)status.textContent='Uploaded. The source PDF is stored securely. When the survey is available, build/import the location register from this source so relevant ACMs appear in Asbestos Lookup and contractor permits.';
    toast('Asbestos source document uploaded.');
  }catch(e){console.error(e);if(status)status.textContent=e?.message||'Upload failed.';toast(e?.message||'Could not upload asbestos document.')}
}
async function openAsbestosSourceDocument(id){
  const x=state.asbestosSources.find(s=>s.id===id);if(!x?.storage_path)return toast('Stored asbestos PDF not found.');
  try{const r=await sb.storage.from('safety-files').download(x.storage_path);if(r.error||!r.data)throw(r.error||new Error('Download failed'));const url=URL.createObjectURL(r.data);const w=window.open(url,'_blank');if(!w)location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000)}catch(e){toast(e?.message||'Could not open asbestos PDF.')}
}
async function archiveAsbestosSourceDocument(id){
  if(!isAdmin())return toast('Admin access required.');
  const x=state.asbestosSources.find(s=>s.id===id);if(!x)return;
  if(!confirm(`Archive ${x.title}? The file and historical evidence will be retained.`))return;
  const r=await sb.from('asbestos_source_documents_v280').update({active:false}).eq('id',id);if(r.error)return toast(r.error.message);x.active=false;renderAsbestosSourceAdmin();renderAsbestosLookup();toast('Asbestos source archived.');
}

function renderAsbestosLookup(){if(!isMaintenanceUser())return;const sel=$('asbestosLocationSelect'),summary=$('asbestosLookupSummary'),list=$('asbestosLookupList');if(!sel||!summary||!list)return;const keep=sel.value;sel.innerHTML='<option value="">Select location</option>'+locationOptions();if(keep&&[...sel.options].some(o=>o.value===keep))sel.value=keep;const sources=state.asbestosSources.filter(x=>x.active!==false),entries=state.asbestosEntries.filter(x=>x.active!==false);if(!sources.length&&!entries.length){summary.innerHTML='<div class="pending-use-warning"><strong>Asbestos register awaiting AMP / survey upload.</strong><br>The lookup structure is ready, but no asbestos source records have been loaded yet.</div>';list.innerHTML='';return}if(!sel.value){summary.innerHTML=`<div class="hint-box"><strong>${entries.length} active asbestos register entr${entries.length===1?'y':'ies'}</strong> from ${sources.length} source document${sources.length===1?'':'s'}. Select a location to check before intrusive work.</div>`;list.innerHTML='';return}const id=sel.value;const ancestors=new Set();let cur=locationById(id)?.parent_id,guard=0;while(cur&&guard++<20){ancestors.add(cur);cur=locationById(cur)?.parent_id}const rows=entries.filter(e=>e.location_id===id||(e.applies_to_descendants&&ancestors.has(e.location_id)));summary.innerHTML=rows.length?`<div class="danger-note"><strong>${rows.length} known/presumed asbestos entr${rows.length===1?'y':'ies'} relevant to ${esc(locationPath(id))}.</strong> Review before work that could disturb building materials.</div>`:`<div class="hint-box"><strong>No known ACM is recorded for ${esc(locationPath(id))} in the current register.</strong><br>This does not confirm the area is asbestos-free. Stop work if suspect material is encountered.</div>`;list.innerHTML=rows.map(e=>{const src=state.asbestosSources.find(s=>s.id===e.source_document_id);return `<div class="item-card traffic-amber"><h4>${esc(e.material)}</h4><div class="meta"><span>${esc(e.identification_status||'')}</span>${e.asbestos_type?`<span>${esc(e.asbestos_type)}</span>`:''}${e.condition?`<span>Condition: ${esc(e.condition)}</span>`:''}</div>${e.extent?`<p><strong>Extent/location:</strong> ${esc(e.extent)}</p>`:''}${e.management_action?`<p><strong>Management action:</strong> ${esc(e.management_action)}</p>`:''}${src?`<p class="muted">Source: ${esc(src.title)}${e.source_page?' · page '+esc(e.source_page):''}</p>`:''}</div>`}).join('')}

async function globalClick(e){const el=e.target.closest('button');if(!el)return;if(el.dataset.openHsTraining!==undefined)return openHsTraining(el.dataset.openHsTraining||'ALL');if(el.dataset.hsTrainingCategory){hsTrainingCategory=el.dataset.hsTrainingCategory;renderHsTraining();return;}if(el.dataset.openChemicalLinking!==undefined)return showChemicalLinking();if(el.dataset.mySafetyStatus)return setMySafetyStatus(el.dataset.mySafetyStatus);if(el.dataset.mySafetyCategory)return setMySafetyCategory(el.dataset.mySafetyCategory);if(el.dataset.mySafetyBack!==undefined)return clearMySafetyStatus();if(el.dataset.toggleDocumentCreation!==undefined)return toggleDocumentCreation();if(el.dataset.creatorStart)return showCreatorWizard(el.dataset.creatorStart);if(el.dataset.creatorRefresh!==undefined)return renderCreator();if(el.dataset.creatorReadSources!==undefined)return creatorReadSources();if(el.dataset.creatorAnalyse!==undefined)return creatorAnalyseAndSave();if(el.dataset.creatorGenerate)return creatorGenerateAndImport(el.dataset.creatorGenerate);if(el.dataset.creatorOpenDraft)return creatorOpenDraft(el.dataset.creatorOpenDraft);if(el.dataset.creatorCreateRelated)return creatorCreateRelated(el.dataset.creatorCreateRelated);if(el.id==='evidencePackBtn'){e.preventDefault();e.stopPropagation();return showEvidencePackPicker();}if(el.id==='outstandingPdfBtn'){e.preventDefault();e.stopPropagation();return downloadReport('outstanding');}if(el.id==='trainingMatrixPdfBtn'){e.preventDefault();e.stopPropagation();return downloadReport('matrix');}if(el.id==='trainingExcelBtn'){e.preventDefault();e.stopPropagation();return downloadTrainingExcel();}if(el.id==='trainingSignoffsPdfBtn'){e.preventDefault();e.stopPropagation();return downloadReport('signoffs');}if(el.id==='reviewDatesPdfBtn'){e.preventDefault();e.stopPropagation();return downloadReport('reviews');}if(el.id==='backupBtn'){e.preventDefault();e.stopPropagation();return downloadBackup();}if(el.id==='fullBackupBtn'){e.preventDefault();e.stopPropagation();return downloadFullBackup();}if(el.id==='generateMonthlyReportBtn'){e.preventDefault();e.stopPropagation();return runMonthlyReportButton();}if(el.id==='generatePpeReportBtn'){e.preventDefault();e.stopPropagation();return runPpeReportButton();}if(el.id==='signOutBtn'){e.preventDefault();e.stopPropagation();return forceLocalSignOut();}if(el.id==='permitReportPreviewBtn'){e.preventDefault();e.stopPropagation();renderPermitReportPreview();$('permitReportSummary')?.scrollIntoView({behavior:'smooth',block:'start'});toast('Contractor permit report preview updated.');return}if(el.id==='permitReportPdfBtn'){e.preventDefault();e.stopPropagation();downloadPermitReportPdf();return}if(el.id==='permitReportCsvBtn'){e.preventDefault();e.stopPropagation();downloadPermitReportCsv();return}if((state.offline||!navigator.onLine)&&['startPpeCheck','submitPpeCheck','ackAwareness','signTraining','confirmTrainingSign','requestInstructor','confirmInstructorRequest','trainingException','confirmTrainingException'].some(k=>el.dataset[k]!==undefined)){toast('Offline mode is read-only for compliance actions. Reconnect before signing, acknowledging, requesting instructor changes or submitting PPE checks.');return;}if(el.dataset.mySafetyOnsite!==undefined){closeModal();showView('onsite');return}if(el.dataset.mySafetyKeys!==undefined){return showWhoHasKey()}if(el.dataset.viewAwareness!==undefined){showView('awareness');return}if(el.dataset.viewPpe!==undefined){showView('ppe');return}if(el.dataset.startPpeCheck!==undefined)return showPpeCheck();if(el.dataset.submitPpeCheck!==undefined)return submitPpeCheck();if(el.dataset.viewPpeCheck)return viewPpeCheck(el.dataset.viewPpeCheck);if(el.dataset.downloadPpeCheck)return downloadPpeCheckPdf(el.dataset.downloadPpeCheck);if(el.dataset.managePpeCatalogue!==undefined)return showPpeCatalogue();if(el.dataset.editPpeItem)return editPpeItem(el.dataset.editPpeItem);if(el.dataset.savePpeItem!==undefined)return savePpeItem(el.dataset.savePpeItem);if(el.dataset.assignPpeItem)return showPpeAssignments(el.dataset.assignPpeItem);if(el.dataset.savePpeAssignments)return savePpeAssignments(el.dataset.savePpeAssignments);if(el.dataset.updatePpeAction)return showPpeAction(el.dataset.updatePpeAction);if(el.dataset.savePpeAction)return savePpeAction(el.dataset.savePpeAction);if(el.dataset.openAwareness)return openAwareness(el.dataset.openAwareness);if(el.dataset.ackAwareness)return acknowledgeAwareness(el.dataset.ackAwareness);if(el.dataset.assignAwareness)return showAwarenessAssignments(el.dataset.assignAwareness);if(el.dataset.saveAwarenessAssignments)return saveAwarenessAssignments(el.dataset.saveAwarenessAssignments);if(el.dataset.downloadReport)return downloadArchivedReport(el.dataset.downloadReport);if(el.dataset.reportEmailLog)return showReportEmailLog(el.dataset.reportEmailLog);if(el.dataset.editReportSchedule)return showNewReportSchedule(el.dataset.editReportSchedule);if(el.dataset.saveReportSchedule!==undefined)return saveReportSchedule(el.dataset.saveReportSchedule);if(el.dataset.toggleReportSchedule)return toggleReportSchedule(el.dataset.toggleReportSchedule);if(el.dataset.runReportSchedule)return runReportSchedule(el.dataset.runReportSchedule);if(el.dataset.docIndex){state.documentIndex=el.dataset.docIndex;if($('documentTypeFilter'))$('documentTypeFilter').value=state.documentIndex==='REGISTER'?'':state.documentIndex;renderDocuments();return}if(el.dataset.downloadRegister!==undefined)return documentRegisterPdf();if(el.dataset.evidenceMode!==undefined){evidencePickerMode=el.dataset.evidenceMode||'ALL';applyEvidencePickerFilters();return}if(el.dataset.evidenceSelectDocs!==undefined)return setEvidenceChoices('.evidence-doc-choice',true);if(el.dataset.evidenceClearDocs!==undefined)return setEvidenceChoices('.evidence-doc-choice',false);if(el.dataset.evidenceSelectTraining!==undefined)return setEvidenceChoices('.evidence-training-choice',true);if(el.dataset.evidenceClearTraining!==undefined)return setEvidenceChoices('.evidence-training-choice',false);if(el.dataset.evidenceSelectAll!==undefined){setEvidenceChoices('.evidence-doc-choice',true);setEvidenceChoices('.evidence-training-choice',true);return;}if(el.dataset.closeModal!==undefined)return closeModal();if(el.dataset.createDocument!==undefined)return createDocumentRecord();if(el.dataset.addDocLink)return addDocumentLink(el.dataset.addDocLink);if(el.dataset.removeDocLink)return removeDocumentLink(el.dataset.removeDocLink);if(el.dataset.openRequiredTraining)return openRequiredTrainingMaterial(el.dataset.openRequiredTraining);if(el.dataset.openDoc)return openDocument(el.dataset.openDoc);if(el.dataset.downloadDoc)return downloadDocument(el.dataset.downloadDoc);if(el.dataset.markDocReviewed)return showMarkDocumentReviewed(el.dataset.markDocReviewed);if(el.dataset.confirmDocReviewed)return confirmDocumentReviewed(el.dataset.confirmDocReviewed);if(el.dataset.docActivity)return showDocumentActivity(el.dataset.docActivity);if(el.dataset.evidenceDoc)return showDocumentEvidencePack(el.dataset.evidenceDoc);if(el.dataset.generateEvidenceDoc)return generateEvidencePack('DOCUMENT',el.dataset.generateEvidenceDoc);if(el.dataset.evidenceTraining)return showTrainingEvidencePack(el.dataset.evidenceTraining);if(el.dataset.generateEvidenceTraining)return generateEvidencePack('TRAINING',el.dataset.generateEvidenceTraining);if(el.dataset.generateEvidenceSelected!==undefined)return generateSelectedEvidencePack();if(el.dataset.docDetails)return showDocDetails(el.dataset.docDetails);if(el.dataset.docLinks)return showDocumentLinks(el.dataset.docLinks);if(el.dataset.editDocControls)return showEditDocumentDetails(el.dataset.editDocControls);if(el.dataset.saveDocControls)return saveDocumentControls(el.dataset.saveDocControls);if(el.dataset.newVersion)return showNewVersion(el.dataset.newVersion);if(el.dataset.publishVersion)return publishVersionFromModal(el.dataset.publishVersion);if(el.dataset.toggleDoc)return showToggleDocument(el.dataset.toggleDoc);if(el.dataset.confirmToggleDoc)return toggleDocument(el.dataset.confirmToggleDoc);if(el.dataset.approveVersion)return showVersionApproval(el.dataset.approveVersion);if(el.dataset.saveVersionApproval)return saveVersionApproval(el.dataset.saveVersionApproval);if(el.dataset.editDocAudience)return showDocumentAudience(el.dataset.editDocAudience);if(el.dataset.saveDocAudience)return saveDocumentAudience(el.dataset.saveDocAudience);if(el.dataset.reviewDoc)return showDocumentReview(el.dataset.reviewDoc);if(el.dataset.saveDocReview)return saveDocumentReview(el.dataset.saveDocReview);if(el.dataset.deleteUnusedDoc)return showDeleteUnusedDocument(el.dataset.deleteUnusedDoc);if(el.dataset.confirmDeleteUnusedDoc)return deleteUnusedDocument(el.dataset.confirmDeleteUnusedDoc);if(el.dataset.deleteStorageOrphan)return deleteStorageOrphan(el.dataset.deleteStorageOrphan);if(el.dataset.deleteAllStorageOrphans!==undefined)return confirmDeleteAllStorageOrphans();if(el.dataset.confirmDeleteAllStorageOrphans!==undefined)return deleteAllStorageOrphans();if(el.dataset.saveTraining!==undefined)return saveTraining();if(el.dataset.viewTraining)return showTrainingDetails(el.dataset.viewTraining);if(el.dataset.openTrainingFile)return openTrainingFile(el.dataset.openTrainingFile);if(el.dataset.downloadTrainingFile)return downloadTrainingFile(el.dataset.downloadTrainingFile);if(el.dataset.trainingFileActivity)return showTrainingFileActivity(el.dataset.trainingFileActivity);if(el.dataset.approveTraining)return showTrainingApproval(el.dataset.approveTraining);if(el.dataset.confirmTrainingApproval)return confirmTrainingApproval(el.dataset.confirmTrainingApproval);if(el.dataset.assignTraining)return showAssignTraining(el.dataset.assignTraining);if(el.dataset.saveTrainingAudience)return saveTrainingAudience(el.dataset.saveTrainingAudience);if(el.dataset.editTraining)return showEditTraining(el.dataset.editTraining);if(el.dataset.saveTrainingEdit)return saveTrainingEdit(el.dataset.saveTrainingEdit);if(el.dataset.archiveTraining)return showArchiveTraining(el.dataset.archiveTraining);if(el.dataset.confirmArchiveTraining)return archiveTraining(el.dataset.confirmArchiveTraining);if(el.dataset.signTraining)return signTraining(el.dataset.signTraining);if(el.dataset.confirmTrainingSign)return confirmTrainingSign(el.dataset.confirmTrainingSign);if(el.dataset.trainingException)return showTrainingException(el.dataset.trainingException);if(el.dataset.confirmTrainingException)return confirmTrainingException(el.dataset.confirmTrainingException);if(el.dataset.requestInstructor)return requestInstructor(el.dataset.requestInstructor);if(el.dataset.confirmInstructorRequest)return confirmInstructorRequest(el.dataset.confirmInstructorRequest);if(el.dataset.saveGroupAttendance)return saveGroupAttendance(el.dataset.saveGroupAttendance);if(el.dataset.singleAttendance)return showSingleAttendance(el.dataset.singleAttendance);if(el.dataset.saveSingleAttendance)return saveSingleAttendance(el.dataset.saveSingleAttendance);if(el.dataset.newSiteLocation!==undefined)return showSiteLocationEditor();if(el.dataset.editSiteLocation)return showSiteLocationEditor(el.dataset.editSiteLocation);if(el.dataset.saveSiteLocation!==undefined)return saveSiteLocation(el.dataset.saveSiteLocation);if(el.dataset.toggleSiteLocation)return toggleSiteLocation(el.dataset.toggleSiteLocation);if(el.dataset.newDepartment!==undefined)return showDepartmentEditor();if(el.dataset.editDepartment)return showDepartmentEditor(el.dataset.editDepartment);if(el.dataset.saveDepartment!==undefined)return saveDepartment(el.dataset.saveDepartment);if(el.dataset.toggleDepartment)return toggleDepartment(el.dataset.toggleDepartment);if(el.dataset.sendInvite!==undefined)return sendInvite();if(el.dataset.setRole)return showSetRole(el.dataset.setRole);if(el.dataset.saveRole)return saveRole(el.dataset.saveRole);if(el.dataset.resendUser)return showResendUser(el.dataset.resendUser);if(el.dataset.confirmResendUser)return resendUserAccess(el.dataset.confirmResendUser);if(el.dataset.accessOnlySubmit!==undefined)return submitAccessOnlyVisit();if(el.dataset.keyIssue)return showIssueAccessKey(el.dataset.keyIssue);if(el.dataset.keyConfirmIssue)return confirmIssueAccessKey(el.dataset.keyConfirmIssue);if(el.dataset.keyReturn)return showReturnAccessKey(el.dataset.keyReturn);if(el.dataset.keyConfirmReturn)return confirmReturnAccessKey(el.dataset.keyConfirmReturn);if(el.dataset.permitView)return showPermitDetails(el.dataset.permitView);if(el.dataset.permitApprove)return showPermitApproval(el.dataset.permitApprove);if(el.dataset.permitConfirmApprove)return confirmPermitApproval(el.dataset.permitConfirmApprove);if(el.dataset.permitSignout)return showContractorSignout(el.dataset.permitSignout);if(el.dataset.permitConfirmSignout)return confirmContractorSignout(el.dataset.permitConfirmSignout);if(el.dataset.permitClose)return showPermitClose(el.dataset.permitClose);if(el.dataset.permitConfirmClose)return confirmPermitClose(el.dataset.permitConfirmClose);if(el.dataset.permitLeft)return showLeftWithoutSignout(el.dataset.permitLeft);if(el.dataset.permitConfirmLeft)return confirmLeftWithoutSignout(el.dataset.permitConfirmLeft);if(el.dataset.contractorReviewPtw)return reviewPermitAfterSubmit(el.dataset.contractorReviewPtw);if(el.dataset.contractorCancel!==undefined)return closeContractorPortal();if(el.dataset.contractorSubmit)return submitContractorPortal(el.dataset.contractorSubmit);if(el.dataset.contractorApproveCredentials)return approvePermitCredentials(el.dataset.contractorApproveCredentials);if(el.dataset.contractorApproveSession)return approvePermitSession(el.dataset.contractorApproveSession);if(el.dataset.openAsbestosSource)return openAsbestosSourceDocument(el.dataset.openAsbestosSource);if(el.dataset.archiveAsbestosSource)return archiveAsbestosSourceDocument(el.dataset.archiveAsbestosSource);if(el.dataset.toggleUser)return toggleUser(el.dataset.toggleUser);}


function permitReportCompanies(){return [...new Set((state.contractorPermits||[]).map(p=>clean(p.contractor_company)).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function permitReportFilters(){return {company:$('permitReportCompany')?.value||'',from:$('permitReportFrom')?.value||'',to:$('permitReportTo')?.value||'',status:$('permitReportStatus')?.value||'',workType:$('permitReportWorkType')?.value||''}}
function permitReportRows(){const f=permitReportFilters();if(f.from&&f.to&&f.from>f.to)throw new Error('The From date must be before the To date.');const start=f.from?new Date(f.from+'T00:00:00'):null,end=f.to?new Date(f.to+'T23:59:59.999'):null;return (state.contractorPermits||[]).filter(p=>{const d=new Date(p.expected_start||p.created_at||0),types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[];if(f.company&&clean(p.contractor_company)!==f.company)return false;if(start&&d<start)return false;if(end&&d>end)return false;if(f.status&&p.status!==f.status)return false;if(f.workType==='NONE'){if(types.length||!p.high_risk_none_declared)return false}else if(f.workType&&!types.includes(f.workType))return false;return true}).sort((a,b)=>new Date(b.expected_start||b.created_at||0)-new Date(a.expected_start||a.created_at||0))}
function permitReportStatusLabel(s){return ({AWAITING_APPROVAL:'Awaiting approval',ACTIVE:'Active',AWAITING_CLOSE:'Awaiting close-out',CLOSED:'Closed',CANCELLED:'Cancelled'})[s]||String(s||'')}
function permitReportTraffic(p){if(p.status==='ACTIVE'&&p.expected_finish&&new Date(p.expected_finish)<new Date())return 'red';if(p.status==='AWAITING_APPROVAL'||p.status==='AWAITING_CLOSE')return 'amber';if(p.status==='ACTIVE')return 'green';return 'neutral'}
function populatePermitReportCompanies(){const el=$('permitReportCompany');if(!el)return;const keep=el.value;el.innerHTML='<option value="">All companies</option>'+permitReportCompanies().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if([...el.options].some(o=>o.value===keep))el.value=keep}
function renderPermitReportPreview(){try{populatePermitReportCompanies();const rows=permitReportRows(),companies=new Set(rows.map(x=>clean(x.contractor_company)).filter(Boolean)),active=rows.filter(x=>x.status==='ACTIVE').length,closed=rows.filter(x=>x.status==='CLOSED').length,high=rows.filter(x=>(Array.isArray(x.high_risk_work_types)&&x.high_risk_work_types.length)).length;const stats=$('permitReportSummary');if(stats)stats.innerHTML=[{label:'Permits',value:rows.length,traffic:rows.length?'green':'neutral'},{label:'Companies',value:companies.size,traffic:'neutral'},{label:'Active/on site',value:active,traffic:active?'green':'neutral'},{label:'High-risk work',value:high,traffic:high?'amber':'neutral'},{label:'Closed',value:closed,traffic:'neutral'}].map(x=>`<div class="stat traffic-${x.traffic}"><span class="traffic-dot"></span><strong>${x.value}</strong><span>${x.label}</span></div>`).join('');const list=$('permitReportList');if(list)list.innerHTML=rows.length?rows.map(p=>{const types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[];return `<div class="item-card traffic-card traffic-${permitReportTraffic(p)}"><div class="row-between"><div><strong>${esc(p.permit_no||'Permit')} · ${esc(p.contractor_company||'')}</strong><div class="meta"><span>${esc(p.contractor_name||'')}</span><span>${fmtDateTime(p.expected_start||p.created_at)}</span><span>${esc(permitReportStatusLabel(p.status))}</span></div></div>${statusChip(permitReportStatusLabel(p.status),permitReportTraffic(p))}</div><p><strong>Work:</strong> ${esc(p.work_description||'')}</p><p><strong>Location:</strong> ${esc(p.location_text||'')}</p><p><strong>PTW triggers:</strong> ${types.length?esc(types.map(highRiskLabel).join(' · ')):(p.high_risk_none_declared?'None – site sign-in only':'Not recorded')}</p><div class="meta"><span>Approved: ${esc(p.maintenance_approved_name||'—')} ${p.maintenance_approved_at?'· '+fmtDateTime(p.maintenance_approved_at):''}</span><span>Signed out: ${p.contractor_signout_at?fmtDateTime(p.contractor_signout_at):'—'}</span><span>Closed: ${p.maintenance_closed_at?fmtDateTime(p.maintenance_closed_at):'—'}</span></div></div>`}).join(''):'<div class="empty">No contractor permits match these filters.</div>'}catch(e){toast(e.message||'Could not build contractor permit report.')}}
function permitReportFileBase(){const f=permitReportFilters(),parts=['Contractor-Permits',f.company||'All-Companies',f.from||'Any-Date',f.to||f.from||'Any-Date'];return safeFileName(parts.join('-'))||'Contractor-Permits'}
function permitReportPdfDoc(){
  if(!window.jspdf?.jsPDF)throw new Error('PDF library did not load.');
  const rows=permitReportRows(),f=permitReportFilters(),{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const yesNo=v=>v===true?'Yes':v===false?'No':'Not recorded';
  const asbStatusLabel=v=>({NOT_LOADED:'AMP / survey register not loaded',RECORDS_SHOWN:'Location-specific asbestos records shown',NO_RECORDS_FOR_LOCATION:'No location-specific records shown'})[v]||String(v||'Not recorded').replaceAll('_',' ');
  const preLabels={Barrier:'Barriers / exclusion zone',Signs:'Warning signage',Ppe:'PPE',Access:'Safe access / egress',AreaSafe:'Work area safe',Tools:'Tools / equipment suitable / inspected',ElecIso:'Electrical isolation / LOTO',OtherIso:'Water / gas / plant isolation',FirePrec:'Fire precautions',Extinguisher:'Extinguisher',Coshh:'COSHH',Manual:'Manual handling',Height:'Working at height',Guests:'Guest / public protection',Housekeeping:'Housekeeping',Emergency:'Emergency arrangements'};
  const closeLabels={tidy:'Work area clean / tidy and waste removed',tools_removed_or_safe:'Tools / equipment / materials removed or safe',barriers_removed_or_agreed:'Barriers / signs removed or agreed with Maintenance',temporary_protection_removed:'Temporary protection removed',isolations_reinstated:'Electrical / water / gas / plant isolations reinstated',fire_isolations_reinstated:'Fire alarm / detector isolations reinstated',fire_routes_clear:'Fire doors / exits / escape routes clear',panels_guards_refitted:'Panels / ceiling tiles / covers / guards refitted',no_new_hazards:'No new hazards left; area safe for normal use'};
  const hotLabels={work_type:'Hot-work type',exact_location:'Exact hot-work location',combustibles_controlled:'Combustibles controlled / removed',extinguishers_ready:'Suitable extinguisher(s) ready',fire_detection_checked:'Fire detection / isolation checked',fire_watch_required:'Fire-watch arrangements',post_work_check:'Post-work fire check',notes:'Hot-work notes'};
  const humanControls=(obj,labels)=>Object.entries(obj||{}).map(([k,v])=>[labels[k]||String(k).replaceAll('_',' '),typeof v==='boolean'?yesNo(v):String(v??'')]);

  doc.setFontSize(18);doc.text('Safety Tracker - Contractor Permit Report',14,14);
  doc.setFontSize(9);doc.text(`Company: ${f.company||'All companies'} · Date: ${f.from?fmtDate(f.from):'Any'} to ${f.to?fmtDate(f.to):(f.from?fmtDate(f.from):'Any')} · Generated ${new Date().toLocaleString('en-GB')}`,14,21);
  doc.setFontSize(8);doc.text(`Status: ${f.status?permitReportStatusLabel(f.status):'All'} · High-risk work: ${f.workType?(f.workType==='NONE'?'No listed high-risk work':highRiskLabel(f.workType)):'All'}`,14,27);
  doc.autoTable({head:[['Permit','Company','Contractor','Start','Finish','Status','Location','PTW / high-risk work','Approved by','Closed']],body:rows.length?rows.map(p=>{const types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[];return [p.permit_no||'',p.contractor_company||'',p.contractor_name||'',fmtDateTime(p.expected_start||p.created_at),p.expected_finish?fmtDateTime(p.expected_finish):'',permitReportStatusLabel(p.status),p.location_text||'',p.ptw_required?(types.length?types.map(highRiskLabel).join('; '):'PTW required'):'Site sign-in only',p.maintenance_approved_name||'',p.maintenance_closed_at?fmtDateTime(p.maintenance_closed_at):'']}):[['No matching permits','','','','','','','','','']],startY:33,styles:{fontSize:6.2,cellPadding:1.2,overflow:'linebreak'},headStyles:{fontSize:6.3},margin:{left:8,right:8}});

  if(!rows.length)return {doc,rows};

  for(const p of rows){
    doc.addPage();
    let y=14;
    const permitNo=p.permit_no||'Permit';
    const types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[];
    const asb=Array.isArray(p.asbestos_snapshot)?p.asbestos_snapshot:[];
    const addContinuationHeader=()=>{doc.setFontSize(8);doc.text(`${permitNo} - evidence record (continued)`,14,10);y=16};
    const ensure=(needed=28)=>{if(y+needed>195){doc.addPage();addContinuationHeader()}};
    const section=(title,bodyRows,opts={})=>{
      if(!bodyRows?.length)return;
      ensure(opts.space||32);doc.setFontSize(10);doc.text(title,14,y);y+=3;
      doc.autoTable({head:opts.head||[['Evidence item','Recorded evidence']],body:bodyRows,startY:y,styles:{fontSize:7.2,cellPadding:1.35,overflow:'linebreak',valign:'top'},headStyles:{fontSize:7.2},columnStyles:opts.columnStyles||{0:{cellWidth:62}},margin:{left:12,right:12,bottom:10},pageBreak:'auto'});
      y=(doc.lastAutoTable?.finalY||y)+6;
    };
    const signature=(title,dataUri,signedName,signedAt)=>{
      ensure(42);doc.setFontSize(10);doc.text(title,14,y);y+=5;doc.setFontSize(7.5);doc.text(`Signed name: ${signedName||'Not recorded'}${signedAt?` · ${fmtDateTime(signedAt)}`:''}`,14,y);y+=4;
      if(String(dataUri||'').startsWith('data:image/')){try{doc.addImage(dataUri,'PNG',14,y,58,22);y+=27}catch(e){doc.setFontSize(7);doc.text('Signature image could not be embedded in this copy.',14,y);y+=7}}
      else{doc.setFontSize(7);doc.text('Signature image not recorded.',14,y);y+=7}
    };

    doc.setFontSize(16);doc.text(`${permitNo} - ${p.ptw_required?'Permit to Work evidence record':'Contractor site sign-in evidence record'}`,14,y);y+=7;
    doc.setFontSize(8);doc.text('This section records the information, acknowledgements, controls and sign-offs captured against this contractor visit.',14,y);y+=7;

    section('1. Contractor visit and work scope',[
      ['Company',p.contractor_company||'Not recorded'],['Contractor',p.contractor_name||'Not recorded'],['Work description',p.work_description||'Not recorded'],['Location',p.location_text||((p.location_ids||[]).map(locationPath).join(', '))||'Not recorded'],['Signed in / start',fmtDateTime(p.expected_start||p.created_at)],['Expected finish',p.expected_finish?fmtDateTime(p.expected_finish):'Not recorded'],['Signed in by staff',p.signed_in_by_name||'Public contractor sign-in'],['PTW required',yesNo(!!p.ptw_required)],['PTW / high-risk triggers',types.length?types.map(highRiskLabel).join('; '):'None - site sign-in only'],['Other high-risk work',p.high_risk_other||'None recorded']
    ]);

    section('2. Fire / life-safety acknowledgement',[
      ['Fire and emergency information acknowledged',yesNo(p.fire_info_acknowledged)],['Acknowledged at',p.fire_info_acknowledged_at?fmtDateTime(p.fire_info_acknowledged_at):'Not recorded'],['Information presented',p.fire_info_text||'Not recorded'],['Contractor fire / emergency declaration','I have been informed of the site fire alarm arrangements, the Thursday 13:30 weekly test and the front car park assembly point. I understand the evacuation procedure and will not interfere with fire safety systems or escape routes unless specifically authorised.']
    ]);

    section('3. Asbestos / location acknowledgement',[
      ['Asbestos-related work trigger selected',types.includes('ASBESTOS_RELATED')?'Yes':'No'],['Asbestos / location information reviewed and acknowledged',yesNo(p.asbestos_acknowledged)],['Acknowledged at',p.asbestos_acknowledged_at?fmtDateTime(p.asbestos_acknowledged_at):'Not recorded'],['Register status at sign-in',asbStatusLabel(p.asbestos_register_status)],['Stop-work / asbestos acknowledgement',p.asbestos_ack_text||'Not recorded'],['Important interpretation',p.asbestos_register_status==='NO_RECORDS_FOR_LOCATION'?'No location-specific record shown does not mean asbestos-free.':p.asbestos_register_status==='NOT_LOADED'?'AMP / survey register was not loaded at sign-in; the area must not be treated as asbestos-free.':'The location-specific asbestos information shown at sign-in was snapshotted into this permit.']
    ]);
    if(asb.length)section('Asbestos records snapshotted at sign-in',asb.map(x=>[x.material||'Asbestos register item',`${x.identification_status||''}${x.asbestos_type?` · ${x.asbestos_type}`:''}${x.extent?` · extent: ${x.extent}`:''}${x.condition?` · condition: ${x.condition}`:''}${x.risk_rating?` · risk: ${x.risk_rating}`:''}${x.management_action?` · action: ${x.management_action}`:''}${x.source_page?` · source page: ${x.source_page}`:''}`]),{columnStyles:{0:{cellWidth:70}}});

    signature('4. Contractor sign-in declaration and signature',p.contractor_signin_signature,p.contractor_signin_signed_name,p.created_at);
    if(p.contractor_signin_comments)section('Contractor sign-in comments',[['Comments',p.contractor_signin_comments]]);

    if(p.ptw_required){
      section('5. Permit to Work pre-start controls',humanControls(p.pre_start_controls,preLabels));
      section('PTW trigger-specific confirmations',types.map(t=>[highRiskLabel(t),`${HIGH_RISK_CONTROL_TEXT[t]||highRiskLabel(t)} — ${p.high_risk_controls?.[t]===true?'Confirmed':'Not recorded'}`]));
      if(p.pre_start_additional_actions)section('Additional precautions / safety actions',[['Recorded actions',p.pre_start_additional_actions]]);
      if(p.hot_work_required)section('Hot-work controls',humanControls(p.hot_work_details,hotLabels));
      section('6. Maintenance PTW review / electronic approval',[
        ['Approved to start',p.maintenance_approved_at?'Yes':'No / not recorded'],['Approved by',p.maintenance_approved_name||'Not recorded'],['Approved at',p.maintenance_approved_at?fmtDateTime(p.maintenance_approved_at):'Not recorded'],['Approval method',p.maintenance_approval_method||'Not recorded'],['Maintenance review comments',p.maintenance_approval_comments||'None recorded'],['Maintenance approval declaration','I have reviewed the complete PTW, including the contractor declaration/signature, work location, asbestos information, fire/life-safety acknowledgement, selected PTW triggers and pre-start controls. I approve the work to start.'],['Electronic sign-off evidence',p.maintenance_approved_at?'Authenticated Safety Tracker account, identity, date and time recorded against this permit.':'No approval sign-off recorded.']
      ]);
    }

    if(p.contractor_signout_at||p.status==='CLOSED'||p.status==='AWAITING_CLOSE'){
      section(p.ptw_required?'7. Contractor sign-out and work-area close-out':'5. Contractor sign-out and work-area close-out',[
        ['Completion status',p.completion_status||'Not recorded'],['Contractor signed out at',p.contractor_signout_at?fmtDateTime(p.contractor_signout_at):'Not recorded'],['Close-out confirmed',yesNo(p.closeout_confirmed)],['Close-out confirmed at',p.closeout_confirmed_at?fmtDateTime(p.closeout_confirmed_at):'Not recorded'],['Contractor sign-out comments',p.contractor_signout_comments||'None recorded'],['Left without contractor sign-out',yesNo(!!p.left_without_signout)],['Reason if left without sign-out',p.left_without_signout_reason||'Not applicable']
      ]);
      section('Close-out controls',humanControls(p.closeout_controls,closeLabels));
      if(p.contractor_signout_at)signature('Contractor sign-out signature',p.contractor_signout_signature,p.contractor_signout_signed_name,p.contractor_signout_at);
      section(p.ptw_required?'8. Maintenance final close-out':'6. Staff final close-out',[
        ['Closed by',p.maintenance_closed_name||'Not yet closed'],['Closed at',p.maintenance_closed_at?fmtDateTime(p.maintenance_closed_at):'Not yet closed'],['Close-out comments',p.maintenance_close_comments||'None recorded']
      ]);
    }else{
      section(p.ptw_required?'7. Sign-out / close-out status':'5. Sign-out / close-out status',[['Current status',permitReportStatusLabel(p.status)],['Contractor sign-out','Not yet recorded'],['Final close-out','Not yet recorded']]);
    }
    const audit=permitEventRows(p.id);
    if(audit.length)section('Audit history',audit.map(e=>[fmtDateTime(e.occurred_at),`${String(e.action||'').replaceAll('_',' ')}${e.actor_name?` · ${e.actor_name}`:''}${e.comment?` · ${e.comment}`:''}`]),{head:[['Date / time','Recorded event']],columnStyles:{0:{cellWidth:48}}});
  }
  return {doc,rows}
}
function downloadPermitReportPdf(){try{const {doc}=permitReportPdfDoc(),fileName=`${permitReportFileBase()}.pdf`;downloadBlob(doc.output('blob'),fileName);toast('Contractor permit PDF download started.')}catch(e){console.error('contractor permit PDF',e);toast(e.message||'Could not create contractor permit PDF.')}}
function csvCell(v){const s=String(v??'');return '"'+s.replaceAll('"','""')+'"'}
function downloadPermitReportCsv(){try{const rows=permitReportRows(),head=['Permit','Company','Contractor','Work description','Location','Start','Expected finish','Status','PTW required','PTW / high-risk triggers','Other high-risk work','Fire / emergency acknowledged','Fire acknowledged at','Fire information presented','Asbestos-related work trigger','Asbestos / location acknowledged','Asbestos acknowledged at','Asbestos register status at sign-in','Asbestos stop-work acknowledgement','Asbestos records snapshot','Pre-start controls','Trigger-specific controls','Additional precautions / actions','Hot work required','Hot-work controls','Contractor sign-in signed name','Contractor sign-in time','Contractor sign-in comments','Signed in by staff','Maintenance approved by','Maintenance approved at','Maintenance approval method','Maintenance review comments','Completion status','Contractor sign-out signed name','Contractor signed out at','Contractor sign-out comments','Close-out controls','Close-out confirmed','Close-out confirmed at','Closed by','Closed at','Maintenance close-out comments','Left without sign-out','Left without sign-out reason'];const lines=[head.map(csvCell).join(',')];const objText=o=>Object.entries(o||{}).map(([k,v])=>`${k}: ${typeof v==='boolean'?(v?'Yes':'No'):String(v??'')}`).join('; ');for(const p of rows){const types=Array.isArray(p.high_risk_work_types)?p.high_risk_work_types:[],asb=Array.isArray(p.asbestos_snapshot)?p.asbestos_snapshot:[];lines.push([p.permit_no,p.contractor_company,p.contractor_name,p.work_description,p.location_text,p.expected_start||p.created_at,p.expected_finish,permitReportStatusLabel(p.status),p.ptw_required?'Yes':'No',types.length?types.map(highRiskLabel).join('; '):'None - site sign-in only',p.high_risk_other,p.fire_info_acknowledged?'Yes':'No',p.fire_info_acknowledged_at,p.fire_info_text,types.includes('ASBESTOS_RELATED')?'Yes':'No',p.asbestos_acknowledged?'Yes':'No',p.asbestos_acknowledged_at,p.asbestos_register_status,p.asbestos_ack_text,asb.map(x=>`${x.material||'item'}${x.identification_status?` (${x.identification_status})`:''}${x.management_action?` - ${x.management_action}`:''}${x.source_page?` [page ${x.source_page}]`:''}`).join('; '),objText(p.pre_start_controls),types.map(t=>`${highRiskLabel(t)}: ${HIGH_RISK_CONTROL_TEXT[t]||highRiskLabel(t)} - ${p.high_risk_controls?.[t]===true?'Confirmed':'Not recorded'}`).join('; '),p.pre_start_additional_actions,p.hot_work_required?'Yes':'No',objText(p.hot_work_details),p.contractor_signin_signed_name,p.created_at,p.contractor_signin_comments,p.signed_in_by_name,p.maintenance_approved_name,p.maintenance_approved_at,p.maintenance_approval_method,p.maintenance_approval_comments,p.completion_status,p.contractor_signout_signed_name,p.contractor_signout_at,p.contractor_signout_comments,objText(p.closeout_controls),p.closeout_confirmed?'Yes':'No',p.closeout_confirmed_at,p.maintenance_closed_name,p.maintenance_closed_at,p.maintenance_close_comments,p.left_without_signout?'Yes':'No',p.left_without_signout_reason].map(csvCell).join(','))}downloadBlob(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),`${permitReportFileBase()}.csv`);toast('Contractor permit CSV download started.')}catch(e){console.error('contractor permit CSV',e);toast(e.message||'Could not create contractor permit CSV.')}}


// ---- v2.10.8 Integrated Template-Driven Safety Document Creator ----------------
let creatorDraftCache=[];
let creatorWorking={type:'COSHH',draftId:null,sourceText:'',sourceIds:[],recommendation:null};
function creatorDocTypeLabel(t){return t==='RA'?'Risk Assessment':t==='COSHH'?'COSHH Risk Assessment':t==='SSW'?'Safe System of Work':'Toolbox Talk'}
function creatorDocDbType(t){return t==='RA'?'RISK_ASSESSMENT':t==='COSHH'?'COSHH':t==='SSW'?'SSW':'TOOLBOX_TALK'}
function creatorPeopleOptions(selected=''){
  const set=new Set(String(selected||'').split(/\s*;\s*/).map(x=>x.trim()).filter(Boolean));
  const rows=['Maintenance staff','Other hotel employees','Contractors','Guests / members of public','Young persons','Other'];
  return `<div class="creator-people-checks">${rows.map(v=>`<label class="check-row"><input type="checkbox" class="creator-person" value="${esc(v)}" ${set.has(v)||([...set].some(x=>x.startsWith('Other:'))&&v==='Other')?'checked':''}> ${esc(v)}</label>`).join('')}<label class="full creator-other-person" ${[...set].some(x=>x.startsWith('Other:'))?'':'hidden'}>Other people exposed<input id="creatorPeopleOther" value="${esc(([...set].find(x=>x.startsWith('Other:'))||'').replace(/^Other:\s*/,''))}"></label></div>`
}
function creatorSourceCandidates(t){
  if(t==='RA')return state.documents.filter(d=>d.archived!==true&&['RISK_ASSESSMENT','SSW','COSHH'].includes(d.doc_type));
  if(t==='COSHH')return state.documents.filter(d=>d.archived!==true&&d.doc_type==='SDS');
  if(t==='SSW')return state.documents.filter(d=>d.archived!==true&&['RISK_ASSESSMENT','COSHH'].includes(d.doc_type));
  return state.documents.filter(d=>d.archived!==true&&['RISK_ASSESSMENT','COSHH','SSW'].includes(d.doc_type));
}
function creatorTemplateCandidates(t){
  if(t==='TOOLBOX_TALK')return state.training.filter(x=>trainingKind(x)==='TOOLBOX_TALK'&&x.status!=='ARCHIVED').map(x=>({id:x.id,reference:trainingReference(x)||x.reference||'',title:x.name||x.title||'',kind:'TRAINING'}));
  const db=creatorDocDbType(t);return state.documents.filter(d=>d.archived!==true&&d.doc_type===db).map(d=>({id:d.id,reference:d.reference||'',title:documentDisplayTitle(d),kind:'DOCUMENT'}));
}
function creatorWords(s){return String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2&&!['the','and','for','with','from','risk','assessment','safe','system','work','toolbox','talk','coshh'].includes(x))}
function creatorSimilarity(a,b){const A=new Set(creatorWords(a)),B=new Set(creatorWords(b));let n=0;for(const x of A)if(B.has(x))n+=3;const aa=String(a||'').toLowerCase(),bb=String(b||'').toLowerCase();for(const k of ['height','ladder','manual handling','electrical','plumbing','paint','sanding','tiling','fan coil','ahu','diesel','pressure','asbestos','solder','spray','shower','descal'])if(aa.includes(k)&&bb.includes(k))n+=8;return n}
function creatorTemplateOptions(type,title,selected=''){
  const rows=creatorTemplateCandidates(type).map(x=>({...x,score:creatorSimilarity(title,`${x.reference} ${x.title}`)})).sort((a,b)=>b.score-a.score||String(a.reference||a.title).localeCompare(String(b.reference||b.title),undefined,{numeric:true}));
  return `<option value="">No existing template selected</option>`+rows.map((x,i)=>`<option value="${esc(x.kind+'|'+x.id)}" ${(selected===x.kind+'|'+x.id)||(!selected&&i===0&&x.score>0)?'selected':''}>${esc((x.reference?x.reference+' - ':'')+x.title)}${x.score>0?' · topic match':''}</option>`).join('')
}
function creatorRuleHtml(){return `<div class="creator-rule-list"><div><strong>Template-driven creator</strong><br><span class="muted">RA, COSHH RA, SSW and Toolbox Talk each have their own questions and generated document layout. Select the closest existing same-type document as the format/topic example.</span></div><div><strong>SSW advised</strong><br><span class="muted">Complex/multi-step work, isolation, powered equipment, work at height, hot work, significant chemical exposure, specialist controls or where a defined safe sequence is needed.</span></div><div><strong>TBT advised</strong><br><span class="muted">Instructor-led explanation is needed, significant controls must be discussed, a new/changed method is being introduced, several people perform the task, or an SSW needs briefing.</span></div><div><strong>Human review required</strong><br><span class="muted">The creator is a drafting aid. Manager/Admin must check source sheets, site conditions, controls and final wording before approval.</span></div></div>`}
async function renderCreator(){
  if(!isManager()||!$('creatorDraftList'))return;
  $('creatorRuleSummary').innerHTML=creatorRuleHtml();
  const r=await sb.from('document_creation_drafts').select('*').order('updated_at',{ascending:false}).limit(40);
  if(r.error){$('creatorDraftList').innerHTML=`<div class="empty">Could not load creator drafts: ${esc(r.error.message)}</div>`;return}
  creatorDraftCache=r.data||[];
  $('creatorDraftList').innerHTML=creatorDraftCache.length?creatorDraftCache.map(d=>`<div class="item-card"><div class="row-between"><div><strong>${esc(d.title||creatorDocTypeLabel(d.doc_type))}</strong><div class="meta"><span class="badge">${esc(creatorDocTypeLabel(d.doc_type))}</span><span>${esc(d.status||'DRAFT')}</span><span>Updated ${fmtDateTime(d.updated_at)}</span></div></div>${btn('Open','secondary',`data-creator-open-draft="${d.id}"`)}</div></div>`).join(''):'<div class="empty">No creator drafts yet.</div>';
}
function creatorCommonTop(type,d,q){
  const proposed=q.reference||creatorNextRef(type), template=q.template_id||'';
  return `<label class="full">Document / task title<input id="creatorTitle" value="${esc(d.title||q.title||'')}" placeholder="Describe the actual topic/task"></label>
  <label>Reference<input id="creatorReference" value="${esc(proposed)}"></label><label>Version<input id="creatorVersion" value="${esc(q.version||'1')}" placeholder="1"></label>
  <label class="full">Closest existing ${esc(creatorDocTypeLabel(type))} template<select id="creatorTemplate">${creatorTemplateOptions(type,d.title||q.title||'',template)}</select><span class="muted">Used as the same-type topic/format example. The approved existing document is not changed.</span></label>`
}
function creatorFlagsHtml(q){return `<div class="full creator-flags"><h4>Task factors used for SSW / Toolbox Talk advice</h4>${[['multi_step','Complex or multi-step task'],['isolation','Isolation / lock-off required'],['powered','Powered equipment / moving parts'],['height','Work at height / roof access'],['hotwork','Hot work / ignition source'],['significant_chemical','Significant chemical exposure potential'],['specialist','Specialist competence / permit / special control'],['new_method','New or changed method / unfamiliar task'],['group_task','Several people may perform this task'],['instructor_needed','Controls need instructor-led explanation']].map(([k,l])=>`<label class="check-row"><input type="checkbox" id="creatorFlag_${k}" ${q.flags?.[k]?'checked':''}> ${l}</label>`).join('')}</div>`}
function creatorSourceHtml(type,d,q){
  const src=creatorSourceCandidates(type), sourceIds=new Set(d.source_document_ids||[]);
  const srcRows=src.map(x=>`<label class="check-row creator-source-choice"><input type="checkbox" class="creator-source" value="${x.id}" ${sourceIds.has(x.id)?'checked':''}> <span><strong>${esc(x.reference||docTypeLabel(x.doc_type))}</strong> - ${esc(documentDisplayTitle(x))}</span></label>`).join('')||'<div class="empty">No suitable controlled source documents found.</div>';
  return `<div class="hint-box"><strong>Relevant controlled source documents</strong><br>${type==='COSHH'?'Select the applicable SDS/MSDS.':'Select the RA/COSHH/SSW documents that apply.'} Read them before completing the site-specific questions.</div><div id="creatorSourceChoices" class="creator-source-list">${srcRows}</div><div class="row"><button class="secondary" type="button" data-creator-read-sources>Read selected source sheets</button></div><div id="creatorSourceStatus" class="message" hidden></div>`
}
function creatorQuestionnaireHtml(type,d={}){
  const q=d.questionnaire||{};let fields='';
  if(type==='RA')fields=`${creatorCommonTop(type,d,q)}
    <label class="full">Task / activity being assessed<textarea id="creatorTask">${esc(q.task||'')}</textarea></label><label>Location / area<input id="creatorLocation" value="${esc(q.location||'')}"></label><label>Frequency / exposure<input id="creatorFrequency" value="${esc(q.frequency||'')}"></label>
    <div class="full"><strong>People at risk</strong>${creatorPeopleOptions(q.people)}</div>
    <label class="full">Hazards identified<textarea id="creatorHazards" placeholder="Describe the hazards arising from the task, equipment, environment and materials.">${esc(q.hazards||'')}</textarea></label>
    <label class="full">Existing control measures<textarea id="creatorControls">${esc(q.controls||'')}</textarea></label>
    <label>Initial severity (1-5)<input id="creatorInitialSeverity" type="number" min="1" max="5" value="${esc(q.initialSeverity||'')}"></label><label>Initial likelihood (1-5)<input id="creatorInitialLikelihood" type="number" min="1" max="5" value="${esc(q.initialLikelihood||'')}"></label>
    <label class="full">Further controls / actions required<textarea id="creatorFurtherControls">${esc(q.furtherControls||'')}</textarea></label>
    <label>Residual severity (1-5)<input id="creatorSeverity" type="number" min="1" max="5" value="${esc(q.severity||'')}"></label><label>Residual likelihood (1-5)<input id="creatorLikelihood" type="number" min="1" max="5" value="${esc(q.likelihood||'')}"></label>
    <label class="full">Emergency / stop-work / reporting<textarea id="creatorEmergency">${esc(q.emergency||'')}</textarea></label>`;
  else if(type==='COSHH')fields=`${creatorCommonTop(type,d,q)}
    <div class="full coshh-template-note hint-box"><strong>COSHH-specific assessment</strong><br>Select the SDS/MSDS above and press <strong>Read selected source sheets</strong>. Safety Tracker will pre-fill everything it can from the SDS. Review every suggestion and complete the site-use fields before approval.</div>
    <label class="full">Product / substance name<input id="creatorProductName" value="${esc(q.productName||'')}" placeholder="Populated from SDS Section 1 where possible"></label>
    <label class="full">What work/use is being assessed?<textarea id="creatorTask">${esc(q.task||'')}</textarea></label><label>Location / area<input id="creatorLocation" value="${esc(q.location||'')}"></label><label>Frequency<input id="creatorFrequency" value="${esc(q.frequency||'')}"></label><label>Typical duration<input id="creatorDuration" value="${esc(q.duration||'')}"></label><label>Quantity / amount<input id="creatorQuantity" value="${esc(q.quantity||'')}"></label>
    <div class="full"><strong>People exposed / who performs it</strong>${creatorPeopleOptions(q.people)}</div>
    <label>Physical form (from SDS)<select id="creatorPhysicalForm"><option value="">Select / confirm</option>${['Liquid','Powder','Granules','Paste','Gel','Aerosol','Solid','Gas','Foam','Other'].map(x=>`<option ${q.physicalForm===x?'selected':''}>${x}</option>`).join('')}</select><span class="muted">Suggested from the SDS where identifiable; confirm before approval.</span></label>
    <label>How is the substance used?<select id="creatorUseType"><option value="">Select</option>${['Undiluted / neat','Diluted','Mixed with another product','Applied by spray','Applied by brush / roller','Wiped / cleaned on','Poured / decanted','Other'].map(x=>`<option ${q.useType===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label id="creatorDilutionWrap" ${q.useType==='Diluted'?'':'hidden'}>Dilution ratio / concentration<input id="creatorDilution" value="${esc(q.dilution||'')}" placeholder="e.g. 1:10, 5%, as manufacturer"></label>
    <label class="full">Hazard classification / signal word / H-statements<textarea id="creatorHazards">${esc(q.hazards||'')}</textarea><span class="muted">Pre-filled from SDS Section 2 where readable.</span></label>
    <label class="full">Routes of exposure / health effects<textarea id="creatorExposure">${esc(q.exposure||'')}</textarea><span class="muted">Use inhalation, skin, eye and ingestion information from the SDS and actual site use.</span></label>
    <label class="full">Handling / engineering controls / ventilation<textarea id="creatorControls">${esc(q.controls||'')}</textarea><span class="muted">Pre-filled from SDS Sections 7 and 8 where readable; add site controls.</span></label>
    <div class="full coshh-subsection"><h4>PPE / RPE</h4><div class="form-grid">
      <label>Hand protection<input id="creatorPpeHands" value="${esc(q.ppeHands||'')}" placeholder="e.g. nitrile gloves"></label><label>Eye / face protection<input id="creatorPpeEyes" value="${esc(q.ppeEyes||'')}" placeholder="e.g. safety goggles"></label>
      <label>Respiratory protection<input id="creatorPpeResp" value="${esc(q.ppeResp||'')}" placeholder="None / type required"></label><label>Body / skin protection<input id="creatorPpeBody" value="${esc(q.ppeBody||'')}" placeholder="e.g. protective clothing"></label>
      <label class="full">Other PPE / PPE notes<textarea id="creatorPpe">${esc(q.ppe||'')}</textarea></label>
    </div></div>
    <label class="full">First aid measures<textarea id="creatorFirstAid">${esc(q.firstAid||'')}</textarea><span class="muted">Pre-filled from SDS Section 4 where readable.</span></label>
    <label class="full">Accidental release / spill response<textarea id="creatorSpill">${esc(q.spill||'')}</textarea><span class="muted">Pre-filled from SDS Section 6 where readable.</span></label>
    <label class="full">Storage requirements<textarea id="creatorStorage">${esc(q.storage||'')}</textarea><span class="muted">Pre-filled from SDS Section 7 where readable.</span></label>
    <label class="full">Fire-fighting / ignition precautions<textarea id="creatorFire">${esc(q.fire||'')}</textarea><span class="muted">Pre-filled from SDS Section 5 where readable.</span></label>
    <label class="full">Environmental precautions / disposal<textarea id="creatorEnvironmental">${esc(q.environmental||'')}</textarea><span class="muted">Pre-filled from SDS Sections 6, 12 and 13 where readable.</span></label>
    <label class="full">Additional site-specific controls / further actions<textarea id="creatorFurtherControls">${esc(q.furtherControls||'')}</textarea></label>
    <label>Initial severity (1-5)<input id="creatorInitialSeverity" type="number" min="1" max="5" value="${esc(q.initialSeverity||'')}"></label><label>Initial likelihood (1-5)<input id="creatorInitialLikelihood" type="number" min="1" max="5" value="${esc(q.initialLikelihood||'')}"></label>
    <label>Post-control severity (1-5)<input id="creatorSeverity" type="number" min="1" max="5" value="${esc(q.severity||'')}"></label><label>Post-control likelihood (1-5)<input id="creatorLikelihood" type="number" min="1" max="5" value="${esc(q.likelihood||'')}"></label>
    <label class="full">Emergency / stop-work / reporting arrangements<textarea id="creatorEmergency">${esc(q.emergency||'')}</textarea></label>`;
  else if(type==='SSW')fields=`${creatorCommonTop(type,d,q)}
    <label class="full">Scope / task covered<textarea id="creatorTask">${esc(q.task||'')}</textarea></label><label>Location / area<input id="creatorLocation" value="${esc(q.location||'')}"></label><label>Frequency<input id="creatorFrequency" value="${esc(q.frequency||'')}"></label>
    <div class="full"><strong>Who performs / may be affected</strong>${creatorPeopleOptions(q.people)}</div>
    <label class="full">Competence / authorisation required<textarea id="creatorCompetence">${esc(q.competence||'')}</textarea></label><label class="full">PPE / tools / equipment<textarea id="creatorPpe">${esc(q.ppe||'')}</textarea></label>
    <label class="full">Before starting / work-area controls<textarea id="creatorPrestart">${esc(q.prestart||'')}</textarea></label><label class="full">Safe method / sequence of work<textarea id="creatorSteps" placeholder="Put each important step on a new line.">${esc(q.steps||'')}</textarea></label><label class="full">Stop-work conditions<textarea id="creatorStop">${esc(q.stop||'')}</textarea></label><label class="full">Emergency / incident response<textarea id="creatorEmergency">${esc(q.emergency||'')}</textarea></label><label class="full">Completion / housekeeping / hand-back<textarea id="creatorCompletion">${esc(q.completion||'')}</textarea></label>`;
  else fields=`${creatorCommonTop(type,d,q)}
    <label class="full">Topic / key message<textarea id="creatorTask">${esc(q.task||q.keyMessage||'')}</textarea></label><div class="full"><strong>Who should attend / who performs the task</strong>${creatorPeopleOptions(q.people)}</div>
    <label class="full">Main hazards / why this matters<textarea id="creatorHazards">${esc(q.hazards||'')}</textarea></label><label class="full">Key control points to discuss<textarea id="creatorControls">${esc(q.controls||'')}</textarea></label><label class="full">Safe working reminders / do & don't<textarea id="creatorSteps">${esc(q.steps||'')}</textarea></label><label class="full">PPE / work-area controls<textarea id="creatorPpe">${esc(q.ppe||'')}</textarea></label><label class="full">Emergency / stop-work / reporting<textarea id="creatorEmergency">${esc(q.emergency||'')}</textarea></label><label class="full">Check-understanding questions<textarea id="creatorQuestions">${esc(q.questions||'')}</textarea></label><label class="full">Actions / points raised<textarea id="creatorActions">${esc(q.actions||'')}</textarea></label>`;
  return `${creatorSourceHtml(type,d,q)}<div class="form-grid creator-form">${fields}${creatorFlagsHtml(q)}<label class="full">Source-sheet evidence extracted<textarea id="creatorSourceEvidence" readonly>${esc(q.sourceEvidence||'')}</textarea></label></div>`
}
function wireCreatorForm(type,draft){if(type==='COSHH'){const use=$('creatorUseType'),wrap=$('creatorDilutionWrap');const syncUse=()=>{if(wrap)wrap.hidden=use?.value!=='Diluted'};use?.addEventListener('change',syncUse);syncUse();}
  const other=[...document.querySelectorAll('.creator-person')].find(x=>x.value==='Other'),row=document.querySelector('.creator-other-person');if(other&&row){const sync=()=>row.hidden=!other.checked;other.addEventListener('change',sync);sync()}
  const title=$('creatorTitle'),sel=$('creatorTemplate');if(title&&sel){let manual=false;sel.addEventListener('change',()=>manual=true);title.addEventListener('input',()=>{if(manual)return;sel.innerHTML=creatorTemplateOptions(type,title.value,sel.value)})}
}
function showCreatorWizard(type,draft=null){
  if(!isManager()||!requireDocumentCreation())return;creatorWorking={type,draftId:draft?.id||null,sourceText:draft?.questionnaire?.sourceEvidence||'',sourceIds:draft?.source_document_ids||[],recommendation:draft?.recommendation||null};
  openModal(`${draft?'Continue':'Create'} ${creatorDocTypeLabel(type)}`,`${creatorQuestionnaireHtml(type,draft||{})}<div class="actions">${btn('Cancel','ghost','data-close-modal')}${btn('Analyse & save draft','primary','data-creator-analyse')}</div>`);wireCreatorForm(type,draft)
}
function creatorOpenDraft(id){const d=creatorDraftCache.find(x=>x.id===id);if(d)showCreatorWizard(d.doc_type,d)}
function creatorSelectedSources(){return [...document.querySelectorAll('.creator-source:checked')].map(x=>x.value)}
function creatorSetIfBlank(id,value){const el=$(id);if(el&&!clean(el.value)&&clean(value))el.value=clean(value)}
function creatorSdsSection(text,n){
  const flat=String(text||'').replace(/\s+/g,' ').trim();
  const rx=new RegExp(`(?:SECTION\\s+${n}\\s*[:.\\-]?|\\b${n}\\.\\s+)([\\s\\S]*?)(?=(?:SECTION\\s+${n+1}\\s*[:.\\-]?|\\b${n+1}\\.\\s+)|$)`,'i');
  const m=flat.match(rx);return m?clean(m[1]).slice(0,5000):''
}
function creatorSdsSentences(text,rx,limit=8){
  const out=[];for(const m of String(text||'').matchAll(rx)){const v=clean(m[0]);if(v&&!out.includes(v))out.push(v);if(out.length>=limit)break}return out
}
function creatorJoinUnique(...parts){const seen=new Set(),out=[];for(const p of parts.flat()){const v=clean(p);if(v&&!seen.has(v.toLowerCase())){seen.add(v.toLowerCase());out.push(v)}}return out.join('\n')}
async function creatorReadSources(){
  const ids=creatorSelectedSources();if(!ids.length)return toast('Select at least one source document first.');const status=$('creatorSourceStatus');if(status){status.hidden=false;status.textContent='Reading selected source sheets and filling the COSHH assessment…'}
  const chunks=[],agg={haz:[],ppe:[],hands:[],eyes:[],resp:[],body:[],first:[],spill:[],storage:[],fire:[],env:[],controls:[],exposure:[],product:[],physical:[]};
  for(const id of ids){
    const d=state.documents.find(x=>x.id===id),v=approvedCurrentVersion(id)||currentVersion(id);if(!d||!v?.storage_path)continue;
    try{
      const r=await sb.storage.from('safety-files').download(v.storage_path);if(r.error||!r.data)continue;
      const raw=await pdfTextFromBlob(r.data),text=String(raw||'').replace(/\s+/g,' ').trim();
      const sec2=creatorSdsSection(text,2),sec4=creatorSdsSection(text,4),sec5=creatorSdsSection(text,5),sec6=creatorSdsSection(text,6),sec7=creatorSdsSection(text,7),sec8=creatorSdsSection(text,8),sec11=creatorSdsSection(text,11),sec12=creatorSdsSection(text,12),sec13=creatorSdsSection(text,13);
      const hs=creatorSdsSentences(sec2||text,/\bH\d{3}(?:\s*\+\s*H\d{3})?\b[^.;]{0,180}/gi,18);
      const classWords=creatorSdsSentences(sec2,/(?:Danger|Warning|signal word|classification[^.;]{0,180}|hazard statement[^.;]{0,180})/gi,10);
      const ppe=creatorSdsSentences(sec8||text,/(?:protective gloves|hand protection|eye protection|goggles|face shield|respiratory protection|protective clothing|skin protection|safety footwear)[^.;]{0,220}/gi,14);
      const hands=ppe.filter(x=>/glove|hand protection/i.test(x)),eyes=ppe.filter(x=>/eye|goggle|face shield/i.test(x)),resp=ppe.filter(x=>/respirat|mask|filter/i.test(x)),body=ppe.filter(x=>/clothing|skin protection|footwear|apron/i.test(x));
      const first=sec4?sec4.slice(0,1800):creatorJoinUnique(creatorSdsSentences(text,/(?:IF IN EYES|IF ON SKIN|IF INHALED|IF SWALLOWED)[^.;]{0,280}/gi,12));
      const spill=sec6?sec6.slice(0,1800):'';
      const storage=sec7?sec7.slice(0,1800):'';
      const fire=sec5?sec5.slice(0,1600):'';
      const env=creatorJoinUnique(sec12?sec12.slice(0,900):'',sec13?sec13.slice(0,900):'',creatorSdsSentences(sec6,/(?:environment|drain|watercourse|soil)[^.;]{0,220}/gi,6));
      const controls=creatorJoinUnique(creatorSdsSentences(sec8,/(?:ventilation|engineering control|local exhaust|exposure control)[^.;]{0,260}/gi,10),creatorSdsSentences(sec7,/(?:handling|avoid|keep away|do not)[^.;]{0,220}/gi,8));
      const exposure=creatorJoinUnique(creatorSdsSentences(sec11,/(?:inhalation|skin contact|eye contact|ingestion|respiratory|dermal)[^.;]{0,260}/gi,14));
      const product=extractSdsProductName(text)||documentDisplayTitle(d);
      const low=text.toLowerCase(),physical=low.includes('aerosol')?'Aerosol':low.includes('powder')?'Powder':low.includes('granule')?'Granules':low.includes('paste')?'Paste':low.includes('gel')?'Gel':low.includes('foam')?'Foam':low.includes('gas')?'Gas':low.includes('solid')?'Solid':low.includes('liquid')?'Liquid':'';
      agg.haz.push(...classWords,...hs);agg.ppe.push(...ppe);agg.hands.push(...hands);agg.eyes.push(...eyes);agg.resp.push(...resp);agg.body.push(...body);if(first)agg.first.push(first);if(spill)agg.spill.push(spill);if(storage)agg.storage.push(storage);if(fire)agg.fire.push(fire);if(env)agg.env.push(env);if(controls)agg.controls.push(controls);if(exposure)agg.exposure.push(exposure);if(product)agg.product.push(product);if(physical)agg.physical.push(physical);
      chunks.push(`${d.reference||''} ${documentDisplayTitle(d)}\nProduct: ${product||'Not identified – confirm manually'}\nHazards: ${creatorJoinUnique(classWords,hs)||'Not identified – confirm manually'}\nPPE: ${creatorJoinUnique(ppe)||'Not identified – confirm manually'}\nFirst aid: ${first||'Not identified – confirm manually'}\nSpill: ${spill||'Not identified – confirm manually'}\nStorage: ${storage||'Not identified – confirm manually'}`)
    }catch(e){console.warn('Creator source read',e)}
  }
  creatorWorking.sourceText=chunks.join('\n\n');creatorWorking.sourceIds=ids;if($('creatorSourceEvidence'))$('creatorSourceEvidence').value=creatorWorking.sourceText;
  if(creatorWorking.type==='COSHH'){
    creatorSetIfBlank('creatorProductName',agg.product[0]);
    if(agg.physical[0]&&$('creatorPhysicalForm')&&!$('creatorPhysicalForm').value)$('creatorPhysicalForm').value=agg.physical[0];
    creatorSetIfBlank('creatorHazards',creatorJoinUnique(agg.haz));
    creatorSetIfBlank('creatorPpe',creatorJoinUnique(agg.ppe));creatorSetIfBlank('creatorPpeHands',creatorJoinUnique(agg.hands));creatorSetIfBlank('creatorPpeEyes',creatorJoinUnique(agg.eyes));creatorSetIfBlank('creatorPpeResp',creatorJoinUnique(agg.resp));creatorSetIfBlank('creatorPpeBody',creatorJoinUnique(agg.body));
    creatorSetIfBlank('creatorFirstAid',creatorJoinUnique(agg.first));creatorSetIfBlank('creatorSpill',creatorJoinUnique(agg.spill));creatorSetIfBlank('creatorStorage',creatorJoinUnique(agg.storage));creatorSetIfBlank('creatorFire',creatorJoinUnique(agg.fire));creatorSetIfBlank('creatorEnvironmental',creatorJoinUnique(agg.env));creatorSetIfBlank('creatorControls',creatorJoinUnique(agg.controls));creatorSetIfBlank('creatorExposure',creatorJoinUnique(agg.exposure));
    creatorSetIfBlank('creatorEmergency',creatorJoinUnique(agg.first,agg.spill));
    const title=$('creatorTitle');if(title&&!clean(title.value)&&agg.product[0])title.value=agg.product[0];
  }
  if(status){status.textContent=chunks.length?`Read ${chunks.length} source document${chunks.length===1?'':'s'}. COSHH fields were pre-filled wherever readable. Review the SDS suggestions and complete any blank site-specific fields.`:'No readable PDF text could be extracted.'}toast(chunks.length?'SDS read and COSHH fields populated.':'Could not extract source text.')
}
function creatorCollectPeople(){let vals=[...document.querySelectorAll('.creator-person:checked')].map(x=>x.value);const other=clean($('creatorPeopleOther')?.value);if(vals.includes('Other')){vals=vals.filter(x=>x!=='Other');if(other)vals.push('Other: '+other)}return vals.join('; ')}
function creatorCollect(){
  const flags={};['multi_step','isolation','powered','height','hotwork','significant_chemical','specialist','new_method','group_task','instructor_needed'].forEach(k=>flags[k]=!!$(`creatorFlag_${k}`)?.checked);
  const val=id=>clean($(id)?.value);return {reference:val('creatorReference'),version:val('creatorVersion')||'1',template_id:val('creatorTemplate'),title:val('creatorTitle'),productName:val('creatorProductName'),task:val('creatorTask'),location:val('creatorLocation'),frequency:val('creatorFrequency'),duration:val('creatorDuration'),quantity:val('creatorQuantity'),people:creatorCollectPeople(),hazards:val('creatorHazards'),controls:val('creatorControls'),furtherControls:val('creatorFurtherControls'),ppe:val('creatorPpe'),ppeHands:val('creatorPpeHands'),ppeEyes:val('creatorPpeEyes'),ppeResp:val('creatorPpeResp'),ppeBody:val('creatorPpeBody'),firstAid:val('creatorFirstAid'),spill:val('creatorSpill'),storage:val('creatorStorage'),fire:val('creatorFire'),environmental:val('creatorEnvironmental'),emergency:val('creatorEmergency'),steps:val('creatorSteps'),physicalForm:val('creatorPhysicalForm'),useType:val('creatorUseType'),dilution:val('creatorDilution'),useMethod:[val('creatorUseType'),val('creatorDilution')].filter(Boolean).join(' — '),exposure:val('creatorExposure'),competence:val('creatorCompetence'),prestart:val('creatorPrestart'),stop:val('creatorStop'),completion:val('creatorCompletion'),questions:val('creatorQuestions'),actions:val('creatorActions'),initialSeverity:Number(val('creatorInitialSeverity')||0)||null,initialLikelihood:Number(val('creatorInitialLikelihood')||0)||null,severity:Number(val('creatorSeverity')||0)||null,likelihood:Number(val('creatorLikelihood')||0)||null,sourceEvidence:val('creatorSourceEvidence')||creatorWorking.sourceText||'',flags}
}
function creatorRecommendation(type,q){
  const f=q.flags||{},sswReasons=[],tbtReasons=[];
  if(['RA','COSHH'].includes(type)&&(f.multi_step||f.isolation||f.powered||f.height||f.hotwork||f.specialist||(type==='COSHH'&&f.significant_chemical)))sswReasons.push('The task needs a defined safe sequence or additional operational controls beyond the assessment.');
  if(type==='COSHH'&&q.frequency&&/daily|weekly|frequent|routine/i.test(q.frequency)&&f.significant_chemical)sswReasons.push('Frequent chemical use with significant exposure potential.');
  if(type==='SSW')sswReasons.push('You are creating an SSW directly.');
  if(f.instructor_needed||f.new_method||f.group_task||f.specialist||f.hotwork||f.height||f.isolation)tbtReasons.push('The controls should be discussed/instructed rather than only read.');
  if(sswReasons.length&&type!=='TOOLBOX_TALK')tbtReasons.push('An SSW is recommended and a briefing may be needed to confirm understanding of the safe sequence.');if(type==='TOOLBOX_TALK')tbtReasons.push('You are creating a Toolbox Talk directly.');return {sswRecommended:sswReasons.length>0,tbtRecommended:tbtReasons.length>0,sswReasons,tbtReasons}
}
async function creatorAnalyseAndSave(){
  const q=creatorCollect(),type=creatorWorking.type,ids=creatorSelectedSources();
  if(!q.title)return toast('Enter a document/task title.');
  if(!q.task)return toast(type==='TOOLBOX_TALK'?'Enter the Toolbox Talk topic/key message.':'Describe the actual work/use being assessed.');
  if(type==='COSHH'&&!ids.length)return toast('Select the applicable SDS/MSDS first.');

  const saveBtn=document.querySelector('[data-creator-analyse]');
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving draft…';}

  const recommendation=creatorRecommendation(type,q),
    payload={doc_type:type,title:q.title,source_document_ids:ids,questionnaire:q,recommendation,status:'DRAFT',created_by:state.user.id,updated_at:new Date().toISOString()};
  let r;
  if(creatorWorking.draftId)r=await sb.from('document_creation_drafts').update(payload).eq('id',creatorWorking.draftId).select().single();
  else r=await sb.from('document_creation_drafts').insert(payload).select().single();

  if(r.error){
    if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Analyse & save draft';}
    return toast(r.error.message);
  }

  creatorWorking.draftId=r.data.id;
  creatorWorking.recommendation=recommendation;
  creatorWorking.sourceIds=ids;
  creatorDraftCache=[r.data,...creatorDraftCache.filter(x=>x.id!==r.data.id)];

  // Android/Samsung browsers can keep an already-open <dialog> in the top layer
  // while newly-rendered content appears visually behind it. Close the creator
  // dialog first, then reopen the recommendation as a fresh top-layer dialog.
  const modal=$('modal');
  if(modal?.open)modal.close();
  requestAnimationFrame(()=>{
    showCreatorRecommendation(r.data);
    const form=$('modal')?.querySelector('form');
    if(form)form.scrollTop=0;
  });
  renderCreator();
}
function showCreatorRecommendation(d){const r=d.recommendation||{},type=d.doc_type,q=d.questionnaire||{};openModal('Safety document recommendation',`<div class="section-card"><h3>${esc(d.title)}</h3><div class="meta"><span class="badge">${esc(creatorDocTypeLabel(type))}</span><span>${esc(q.reference||creatorNextRef(type))}</span><span>Draft saved</span></div><p class="muted">Template: ${esc(creatorTemplateName(q.template_id)||'standard '+creatorDocTypeLabel(type)+' format')}</p></div><div class="creator-recommend ${r.sswRecommended?'traffic-amber':'traffic-green'}"><h3>Safe System of Work</h3><p><strong>${r.sswRecommended?'Recommended':'Not normally required from the answers given'}</strong></p>${r.sswReasons?.length?`<ul>${r.sswReasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">The assessment and existing controls appear sufficient for a simple task.</p>'}</div><div class="creator-recommend ${r.tbtRecommended?'traffic-amber':'traffic-green'}"><h3>Toolbox Talk</h3><p><strong>${r.tbtRecommended?'Recommended':'Not normally required from the answers given'}</strong></p>${r.tbtReasons?.length?`<ul>${r.tbtReasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">Self-reading/normal instruction appears proportionate from the answers given.</p>'}</div><div class="actions creator-actions">${btn(`Generate & import ${creatorDocTypeLabel(type)}`,'primary',`data-creator-generate="${d.id}"`)}${!['SSW','TOOLBOX_TALK'].includes(type)?btn(r.sswRecommended?'Create recommended SSW':'Create SSW anyway','secondary',`data-creator-create-related="${d.id}|SSW"`):''}${type!=='TOOLBOX_TALK'?btn(r.tbtRecommended?'Create recommended TBT':'Create TBT anyway','secondary',`data-creator-create-related="${d.id}|TOOLBOX_TALK"`):''}${btn('Back to edit','ghost',`data-creator-open-draft="${d.id}"`)}</div><div class="hint-box"><strong>Before approval:</strong> review the generated document against the selected template/source documents and actual site conditions.</div>`)}
function creatorTemplateName(id){if(!id)return '';const [kind,key]=String(id).split('|');if(kind==='TRAINING'){const t=state.training.find(x=>x.id===key);return t?(trainingReference(t)?trainingReference(t)+' - ':'')+(t.name||''):''}const d=state.documents.find(x=>x.id===key);return d?(d.reference?d.reference+' - ':'')+documentDisplayTitle(d):''}
function creatorCreateRelated(payload){const [id,type]=payload.split('|'),d=creatorDraftCache.find(x=>x.id===id);if(!d)return;const rec=d.recommendation||{},recommended=type==='SSW'?rec.sswRecommended:rec.tbtRecommended;const old=d.questionnaire||{},q={title:d.title,task:old.task||'',location:old.location||'',frequency:old.frequency||'',people:old.people||'',hazards:old.hazards||'',controls:old.controls||'',ppe:old.ppe||'',emergency:old.emergency||'',steps:old.steps||'',sourceEvidence:old.sourceEvidence||'',flags:old.flags||{},overrideReason:recommended?'Recommended by Safety Tracker':'Created by Manager/Admin override despite not being automatically recommended'};showCreatorWizard(type,{doc_type:type,title:d.title,source_document_ids:[...(d.source_document_ids||[])],questionnaire:q,recommendation:{}})}
function creatorNextRef(type){let prefix=type==='RA'?'RA':type==='COSHH'?'COSHH':type==='SSW'?'SSW':'TBT',nums=[];if(type==='TOOLBOX_TALK'){for(const t of state.training){const m=String(t.reference||trainingReference(t)||'').match(new RegExp(`^${prefix}-(\\d+)`,'i'));if(m)nums.push(+m[1])}}else{for(const d of state.documents){const m=String(d.reference||'').match(new RegExp(`^${prefix}-(\\d+)`,'i'));if(m)nums.push(+m[1])}}return `${prefix}-${String((Math.max(0,...nums)+1)).padStart(3,'0')}`}
function creatorPdfHeader(doc,type,ref,title,version,template){doc.setFillColor(218,232,242);doc.rect(12,10,186,25,'F');doc.setDrawColor(110);doc.rect(12,10,186,25);doc.setDrawColor(130);doc.setLineDashPattern([2,1],0);doc.rect(154,13,40,14);doc.setLineDashPattern([],0);doc.setFontSize(7);doc.setFont(undefined,'bold');doc.text('YOUR COMPANY',174,18,{align:'center'});doc.text('LOGO HERE',174,22,{align:'center'});doc.setFontSize(14);doc.text(type==='RA'?'RISK ASSESSMENT':type==='COSHH'?'COSHH RISK ASSESSMENT':type==='SSW'?'SAFE SYSTEM OF WORK':'TOOLBOX TALK',16,18);doc.setFontSize(10);doc.setFont(undefined,'normal');doc.text(`${ref} - ${title||''}`,16,26,{maxWidth:134});doc.setFontSize(8);doc.text(`Version ${version||'1'}  |  ${todayISO()}`,150,33,{align:'right'});if(template)doc.text(`Format/topic example: ${template}`,16,33,{maxWidth:128})}
function creatorAddTextSection(doc,y,heading,text){if(!clean(text))return y;if(y>250){doc.addPage();y=16}doc.setFillColor(236,242,247);doc.rect(14,y-4,182,7,'F');doc.setFontSize(10);doc.setFont(undefined,'bold');doc.text(heading,16,y+1);y+=7;doc.setFont(undefined,'normal');doc.setFontSize(8);const lines=doc.splitTextToSize(String(text),178);doc.text(lines,16,y);return y+lines.length*4+6}
function creatorGhsPictograms(text){const t=String(text||'').toUpperCase(),out=[];if(/H22[0-8]|H242|H250|H251|H260|H261/.test(t))out.push(['FLAME','GHS02']);if(/H314|H318|H290/.test(t))out.push(['CORROSIVE','GHS05']);if(/H300|H301|H310|H311|H330|H331/.test(t))out.push(['TOXIC','GHS06']);if(/H317|H334|H340|H350|H360|H370|H372/.test(t))out.push(['HEALTH','GHS08']);if(/H400|H410|H411|H412/.test(t))out.push(['ENVIRONMENT','GHS09']);if(/H302|H312|H315|H319|H332|H335|H336/.test(t))out.push(['IRRITANT','GHS07']);return [...new Map(out.map(x=>[x[1],x])).values()]}
function creatorDrawGhs(doc,y,text){const pics=creatorGhsPictograms(text);if(!pics.length)return y;doc.setFontSize(9);doc.setFont(undefined,'bold');doc.text('Hazard pictograms',16,y);let x=50;for(const [label,code] of pics){doc.setDrawColor(220,0,0);doc.setLineWidth(.8);doc.lines([[7,-7],[7,7],[-7,7],[-7,-7]],x,y+3,[1,1],'S',true);doc.setTextColor(20);doc.setFontSize(6);doc.text(code,x,y+2,{align:'center'});doc.setFontSize(5.5);doc.text(label,x,y+6,{align:'center'});x+=28}doc.setTextColor(0);return y+15}
function creatorPdf(d){
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),q=d.questionnaire||{},type=d.doc_type,ref=q.reference||creatorNextRef(type),version=q.version||'1',template=creatorTemplateName(q.template_id);creatorPdfHeader(doc,type,ref,d.title,version,template);let y=38;
  if(type==='RA'){
    doc.autoTable({startY:y,theme:'grid',styles:{fontSize:8,cellPadding:2},body:[['Department','Maintenance'],['Task / activity',q.task||''],['Location / area',q.location||''],['Frequency / exposure',q.frequency||''],['People at risk',q.people||'']],columnStyles:{0:{fontStyle:'bold',cellWidth:46}}});y=doc.lastAutoTable.finalY+6;
    const initial=q.initialSeverity&&q.initialLikelihood?`${q.initialSeverity} × ${q.initialLikelihood} = ${q.initialSeverity*q.initialLikelihood}`:'',res=q.severity&&q.likelihood?`${q.severity} × ${q.likelihood} = ${q.severity*q.likelihood}`:'';
    doc.autoTable({startY:y,theme:'grid',head:[['Hazards identified','Existing controls','Initial risk','Further controls / actions','Residual risk']],body:[[q.hazards||'',q.controls||'',initial,q.furtherControls||'',res]],styles:{fontSize:7,cellPadding:2,valign:'top'},headStyles:{fillColor:[218,232,242],textColor:[20,30,40]},columnStyles:{0:{cellWidth:39},1:{cellWidth:48},2:{cellWidth:25},3:{cellWidth:45},4:{cellWidth:25}}});y=doc.lastAutoTable.finalY+6;y=creatorAddTextSection(doc,y,'Emergency / stop-work / reporting',q.emergency);y=creatorAddTextSection(doc,y,'Relevant source evidence',q.sourceEvidence);
  }else if(type==='COSHH'){
    const initial=q.initialSeverity&&q.initialLikelihood?`${q.initialSeverity} × ${q.initialLikelihood} = ${q.initialSeverity*q.initialLikelihood}`:'',res=q.severity&&q.likelihood?`${q.severity} × ${q.likelihood} = ${q.severity*q.likelihood}`:'';
    doc.autoTable({startY:y,theme:'grid',styles:{fontSize:8,cellPadding:2},body:[['Department','Maintenance'],['Product / substance',q.productName||d.title||''],['Task / use',q.task||''],['Location',q.location||''],['Frequency',q.frequency||''],['Duration',q.duration||''],['Quantity',q.quantity||''],['People exposed',q.people||''],['Physical form',q.physicalForm||'Not identified from SDS – confirm manually'],['Use method / dilution',q.useMethod||''],['Initial risk',initial],['Post-control risk',res]],columnStyles:{0:{fontStyle:'bold',cellWidth:47}}});y=doc.lastAutoTable.finalY+6;
    y=creatorDrawGhs(doc,y,q.hazards);y=creatorAddTextSection(doc,y,'Hazard classification / signal word / H-statements',q.hazards);y=creatorAddTextSection(doc,y,'Routes of exposure / health effects',q.exposure);y=creatorAddTextSection(doc,y,'Handling / engineering controls / ventilation',q.controls);
    y=creatorAddTextSection(doc,y,'PPE - hand protection',q.ppeHands);y=creatorAddTextSection(doc,y,'PPE - eye / face protection',q.ppeEyes);y=creatorAddTextSection(doc,y,'RPE - respiratory protection',q.ppeResp);y=creatorAddTextSection(doc,y,'PPE - body / skin protection',q.ppeBody);y=creatorAddTextSection(doc,y,'Other PPE / PPE notes',q.ppe);
    y=creatorAddTextSection(doc,y,'First aid measures',q.firstAid);y=creatorAddTextSection(doc,y,'Accidental release / spill response',q.spill);y=creatorAddTextSection(doc,y,'Storage requirements',q.storage);y=creatorAddTextSection(doc,y,'Fire-fighting / ignition precautions',q.fire);y=creatorAddTextSection(doc,y,'Environmental precautions / disposal',q.environmental);y=creatorAddTextSection(doc,y,'Additional site-specific controls / further actions',q.furtherControls);y=creatorAddTextSection(doc,y,'Emergency / stop-work / reporting arrangements',q.emergency);y=creatorAddTextSection(doc,y,'SDS / source evidence',q.sourceEvidence);
  }else if(type==='SSW'){
    doc.autoTable({startY:y,theme:'grid',styles:{fontSize:8,cellPadding:2},body:[['Department','Maintenance'],['Scope / task',q.task||''],['Location',q.location||''],['People affected',q.people||''],['Relevant documents',creatorSourceRefs(d)]],columnStyles:{0:{fontStyle:'bold',cellWidth:47}}});y=doc.lastAutoTable.finalY+6;y=creatorAddTextSection(doc,y,'1. Competence / authorisation',q.competence);y=creatorAddTextSection(doc,y,'2. PPE / tools / equipment',q.ppe);y=creatorAddTextSection(doc,y,'3. Before starting / work-area controls',q.prestart);y=creatorAddTextSection(doc,y,'4. Safe method / sequence of work',q.steps);y=creatorAddTextSection(doc,y,'5. Stop-work conditions',q.stop);y=creatorAddTextSection(doc,y,'6. Emergency / incident response',q.emergency);y=creatorAddTextSection(doc,y,'7. Completion / housekeeping / hand-back',q.completion);y=creatorAddTextSection(doc,y,'Source evidence',q.sourceEvidence);
  }else{
    doc.autoTable({startY:y,theme:'grid',styles:{fontSize:8,cellPadding:2},body:[['Department','Maintenance'],['Topic / key message',q.task||''],['Who should attend',q.people||''],['Relevant documents',creatorSourceRefs(d)]],columnStyles:{0:{fontStyle:'bold',cellWidth:47}}});y=doc.lastAutoTable.finalY+6;y=creatorAddTextSection(doc,y,'1. Main hazards / why this matters',q.hazards);y=creatorAddTextSection(doc,y,'2. Key control points',q.controls);y=creatorAddTextSection(doc,y,"3. Safe working reminders / do & don't",q.steps);y=creatorAddTextSection(doc,y,'4. PPE / work-area controls',q.ppe);y=creatorAddTextSection(doc,y,'5. Emergency / stop-work / reporting',q.emergency);y=creatorAddTextSection(doc,y,'6. Check-understanding questions',q.questions);y=creatorAddTextSection(doc,y,'7. Actions / points raised',q.actions);if(y>220){doc.addPage();y=16}doc.autoTable({startY:y,theme:'grid',head:[['Attendee','Signature','Date']],body:Array.from({length:8},()=>['','','']),styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[218,232,242],textColor:[20,30,40]}})
  }
  return {doc,ref,version}
}
function creatorSourceRefs(d){return (d.source_document_ids||[]).map(id=>{const x=state.documents.find(v=>v.id===id);return x?`${x.reference||''} ${documentDisplayTitle(x)}`.trim():''}).filter(Boolean).join('; ')}
async function creatorGenerateAndImport(id){
  if(!isManager()||!requireDocumentCreation())return;const d=creatorDraftCache.find(x=>x.id===id)||(await sb.from('document_creation_drafts').select('*').eq('id',id).single()).data;if(!d)return toast('Creator draft not found.');if(!window.jspdf?.jsPDF)return toast('PDF library did not load.');const {doc,ref,version}=creatorPdf(d),blob=doc.output('blob'),q=d.questionnaire||{},name=`${safeFileName(ref+'-'+d.title)}-v${safeFileName(version)}.pdf`;
  if(d.doc_type==='TOOLBOX_TALK'){
    const ins=await sb.from('training_sessions').insert({name:d.title,session_type:'TOOLBOX_TALK',delivery_method:'INSTRUCTOR_LED',description:q.task||null,review_date:plusYear(todayISO()),renewal_value:12,renewal_unit:'MONTHS',status:'ACTIVE',created_by:state.user.id,reference:ref,source_kind:'TOOLBOX_TALK',auto_managed:false,approval_status:'PENDING'}).select().single();if(ins.error)return toast(ins.error.message);const path=`training/${ins.data.id}/${crypto.randomUUID()}-${name}`,up=await sb.storage.from('safety-files').upload(path,blob,{contentType:'application/pdf'});if(up.error)return toast(up.error.message);const fr=await sb.from('training_files').insert({training_session_id:ins.data.id,file_name:name,storage_path:path,uploaded_by:state.user.id,content_text_sha256:await hashPdf(blob)});if(fr.error)return toast(fr.error.message);for(const did of d.source_document_ids||[])await ensureTrainingDocLink(ins.data.id,did,'RELATED');
  }else{
    const docType=creatorDocDbType(d.doc_type),delivery=docType==='SSW'?'INSTRUCTOR_LED':'SELF_TRAINING',ins=await sb.from('documents').insert({reference:ref,title:d.title,doc_type:docType,status:'ACTIVE',created_by:state.user.id,delivery_method:delivery,default_renewal_value:12,default_renewal_unit:'MONTHS'}).select().single();if(ins.error)return toast(ins.error.message);const path=`documents/${ins.data.id}/${crypto.randomUUID()}-${name}`,up=await sb.storage.from('safety-files').upload(path,blob,{contentType:'application/pdf'});if(up.error){await sb.from('documents').delete().eq('id',ins.data.id);return toast(up.error.message)}const vr=await sb.from('document_versions').insert({document_id:ins.data.id,version_label:version,issue_date:todayISO(),review_date:plusYear(todayISO()),delivery_method:delivery,storage_path:path,file_name:name,notes:`Generated by Safety Tracker v${APP_VERSION} template-driven creator. Pending management review/approval.${q.template_id?' Format/topic example: '+creatorTemplateName(q.template_id):''}`,status:'CURRENT',approval_status:'PENDING',content_text_sha256:await hashPdf(blob),created_by:state.user.id}).select().single();if(vr.error)return toast(vr.error.message);for(const did of d.source_document_ids||[]){if(did===ins.data.id)continue;const rel=inferLinkType(ins.data,state.documents.find(x=>x.id===did));if(rel?.source&&rel?.target)await sb.from('document_links').insert({source_document_id:rel.source.id,target_document_id:rel.target.id,link_type:rel.type,created_by:state.user.id})}
  }
  await sb.from('document_creation_drafts').update({status:'IMPORTED',updated_at:new Date().toISOString()}).eq('id',id);closeModal();await refresh(`${creatorDocTypeLabel(d.doc_type)} created as ${ref} and imported Pending approval.`);showView('documents')
}
// -----------------------------------------------------------------------------

function renderReports(){
  document.querySelectorAll('.report-manager-content').forEach(el=>el.hidden=isReportViewer());
  if(isReportViewer()){
    const latest=[...state.generatedReports].sort((a,b)=>new Date(b.generated_at||0)-new Date(a.generated_at||0))[0];
    $('reportStats').innerHTML=[
      {label:'Reports available',value:state.generatedReports.length,traffic:state.generatedReports.length?'green':'neutral'},
      {label:'Latest',value:latest?fmtDate(latest.generated_at):'—',traffic:'neutral'}
    ].map(x=>`<div class="stat traffic-${x.traffic}"><span class="traffic-dot"></span><strong>${esc(x.value)}</strong><span>${x.label}</span></div>`).join('');
    renderReportArchive();return
  }
  const rows=complianceRows(),ppe=ppeManagerMonthSummary(currentMonthValue()),complete=rows.filter(r=>r.code==='COMPLETED').length,overdue=rows.filter(r=>r.code==='OVERDUE').length,action=rows.filter(r=>r.code!=='COMPLETED'&&r.code!=='OVERDUE').length;
  $('reportStats').innerHTML=[
    {label:'Compliant training',value:complete,traffic:'green'},
    {label:'Action required',value:action,traffic:action?'amber':'green'},
    {label:'Overdue training',value:overdue,traffic:overdue?'red':'green'},
    {label:'PPE issues',value:ppe.issues,traffic:ppe.issues?'red':'green'}
  ].map(x=>`<div class="stat traffic-${x.traffic}"><span class="traffic-dot"></span><strong>${x.value}</strong><span>${x.label}</span></div>`).join('');
  if($('monthlyReportMonth')&&!$('monthlyReportMonth').value)$('monthlyReportMonth').value=previousMonthValue();
  populatePermitReportCompanies();renderPermitReportPreview();renderReportArchive();renderDocumentActivityReport()
}
async function renderAdmin(){
  if(!$('buildDiagnostics'))return;
  renderReportSchedules();renderDepartments();renderAsbestosSourceAdmin();renderSiteLocations();
  let versionInfo=null;try{versionInfo=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json())}catch{}
  let regs=[];try{regs='serviceWorker' in navigator?await navigator.serviceWorker.getRegistrations():[]}catch{}
  const arch=state.settings.find(s=>s.setting_key==='architecture_version')?.setting_value||'not found',front=state.settings.find(s=>s.setting_key==='front_end_version')?.setting_value||'not found';
  const uiChecks=[
    ['Role navigation',STANDARD_USER_VIEWS.size===5&&MANAGER_VIEWS.has('documents')&&ADMIN_VIEWS.has('admin')],
    ['Traffic-light helpers',typeof statusChip==='function'&&typeof trafficPriority==='function'],
    ['Simplified User UI',!STANDARD_USER_VIEWS.has('documents')&&!STANDARD_USER_VIEWS.has('training')],
    ['Standalone Training split',standaloneTrainingKinds.length===4],
    ['Document approval training schedule',typeof showVersionApproval==='function'&&typeof saveVersionApproval==='function'],
    ['Hard button action router',window.__SAFETY_ACTION_ROUTER==='v2.9.1-capture'],
    ['Admin/User view switch',typeof toggleAdminUserMode==='function'&&typeof isUserViewMode==='function'],
    ['Offline snapshot + PDF cache',typeof restoreOfflineSnapshot==='function'&&typeof cachedSafetyBlob==='function'],
    ['Password recovery flow',typeof showRecoveryPasswordSetup==='function'],['Contractor permit flow',typeof renderOnSite==='function'&&typeof submitContractorPortal==='function'],['Asbestos lookup',typeof renderAsbestosLookup==='function'&&typeof isMaintenanceUser==='function']
  ];
  $('buildDiagnostics').innerHTML=`<div class="card-list"><div class="item-card compact traffic-card traffic-green"><div class="row-between"><span>Loaded JavaScript build</span><strong class="diagnostic-ok">v${APP_VERSION}</strong></div></div><div class="item-card compact traffic-card traffic-${versionInfo?.version===APP_VERSION?'green':'amber'}"><div class="row-between"><span>version.json</span><strong class="${versionInfo?.version===APP_VERSION?'diagnostic-ok':'diagnostic-warn'}">${esc(versionInfo?.version||'unavailable')}</strong></div></div><div class="item-card compact traffic-card traffic-${regs.length?'green':'amber'}"><div class="row-between"><span>Offline service worker</span><strong class="${regs.length?'diagnostic-ok':'diagnostic-warn'}">${regs.length?'Registered':'Not registered'}</strong></div><div class="muted">v2.9.1 uses a service worker to keep the app shell available offline and preserves the signed-in session across normal page refreshes.</div></div><div class="item-card compact"><div>Database architecture setting: <span class="codeish">${esc(arch)}</span></div><div>Front-end setting: <span class="codeish">${esc(front)}</span></div></div><div class="item-card compact"><div>Current URL: <span class="codeish">${esc(location.href)}</span></div><div>Build ID: <span class="codeish">${BUILD_ID}</span></div></div><div class="section-card compact"><h4>UI / workflow QA</h4>${uiChecks.map(([name,ok])=>`<div class="qa-row"><span>${esc(name)}</span>${statusChip(ok?'Pass':'Check',ok?'green':'red')}</div>`).join('')}</div>${Object.keys(state.loadErrors).length?`<div class="danger-note"><strong>Schema/load warnings</strong><br>${Object.entries(state.loadErrors).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join('<br>')}</div>`:'<div class="success-note">Core tables loaded with no reported schema errors.</div>'}</div>`
}

function renderHelp(){
  if(isStandardUser()){
    $('helpContent').innerHTML=`<div class="help-card"><h3>Health &amp; Safety disclaimer</h3><p>Safety Tracker is a management and record-keeping tool that supports maintenance health and safety processes. It does not itself certify legal compliance, competence, suitability of controls or that work is safe to proceed. Users remain responsible for current legislation, company procedures, manufacturer instructions, approved assessments, permits, training and site-specific controls.</p></div><div class="help-card"><h3>Editing approved documents</h3><p>Managers/Admins can edit controlled metadata such as title, reference, training method, refresher frequency, review date and audience without replacing the approved PDF. Changes to the document content use Create New Version so the previous approved version and evidence history are retained.</p></div><div class="help-card"><h3>Document Manager / direct links</h3><p>The Register is the central controlled-document view. Relationships are saved as direct document-to-document links only. Opening Links for a document shows only that document’s own direct relationships; linked documents do not automatically become linked to each other.</p></div><div class="help-card"><h3>Document Creation switch</h3><p>Managers/Admins can turn Document Creation ON or OFF from Admin. When OFF, the Create Safety Doc tile is hidden to save space and new generated/uploaded safety documents are blocked. Existing Documents, approvals, Register, links and Training remain available.</p></div><div class="help-card"><h3>Keep it simple</h3><p>Work from <strong>My Safety</strong>. Red means act now, amber means action is required, green means complete/current and grey means inactive or historical.</p></div><div class="help-card"><h3>My Safety</h3><p>Cards are automatically ordered with the most important actions first. Open the current approved safety document, complete the training or attendance step shown, then sign only when you understand it. Completed items remain available so you can reopen the current safety information later.</p></div><div class="help-card"><h3>Need help?</h3><p>Use <strong>Need instructor help</strong> when self-training is not enough. Ask your manager before carrying out the task if anything is unclear.</p></div><div class="help-card"><h3>Safety Awareness</h3><p>Complete awareness reading shown as amber or red. Green means that topic is up to date.</p></div><div class="help-card"><h3>PPE Checks</h3><p>Complete your monthly PPE check by the 28th and report anything missing, damaged or unsuitable.</p></div><div class="help-card"><h3>Who’s On Site</h3><p>A prominent Who's On Site shortcut is shown at the top of My Safety so current contractor attendance and PTW actions are easy to find. All signed-in staff can view current contractors and can sign contractors in. Site-sign-in-only visits can be closed by staff. Any job that triggers a Permit to Work is held for Maintenance approval and PTW close-out. Contractors do not receive access to the normal Safety Tracker app.</p></div><div class="help-card"><h3>Asbestos Lookup</h3><p>Maintenance users can check the asbestos register by work location whenever needed. Admins upload the AMP and latest asbestos survey under Admin → Asbestos source documents. Until source records and the location register are loaded, the lookup clearly states that the asbestos register is not yet loaded and the stop-work rule applies.</p></div><div class="help-card"><h3>Offline mode</h3><p>After you have signed in online once, your day-to-day My Safety, Awareness and PPE information can still be viewed offline. Previously saved safety PDFs can be opened. Compliance actions such as signing training, acknowledging awareness and submitting PPE checks wait until you reconnect.</p></div>`;
    return;
  }
  $('helpContent').innerHTML=`<div class="help-card"><h3>Health &amp; Safety disclaimer</h3><p>Safety Tracker is a management and record-keeping tool that supports maintenance health and safety processes. It does not itself certify legal compliance, competence, suitability of controls or that work is safe to proceed. Users remain responsible for current legislation, company procedures, manufacturer instructions, approved assessments, permits, training and site-specific controls.</p></div><div class="help-card"><h3>Editing approved documents</h3><p>Managers/Admins can edit controlled metadata such as title, reference, training method, refresher frequency, review date and audience without replacing the approved PDF. Changes to the document content use Create New Version so the previous approved version and evidence history are retained.</p></div><div class="help-card"><h3>Document Manager / direct links</h3><p>The Register is the central controlled-document view. Relationships are saved as direct document-to-document links only. Opening Links for a document shows only that document’s own direct relationships; linked documents do not automatically become linked to each other.</p></div><div class="help-card"><h3>Document Creation switch</h3><p>Managers/Admins can turn Document Creation ON or OFF from Admin. When OFF, the Create Safety Doc tile is hidden to save space and new generated/uploaded safety documents are blocked. Existing Documents, approvals, Register, links and Training remain available.</p></div><div class="help-card"><h3>Documents drive controlled training</h3><p>RA, COSHH RA and SSW documents are uploaded to Documents. At approval confirm training method, refresher frequency, completion due period and audience. The signed-in Manager/Admin then ticks the approval acknowledgement; their authenticated account, date and time are recorded automatically, so a separate drawn signature is not required. Safety Tracker then creates/updates the training schedule automatically. Toolbox Talks stay controlled through Documents and cannot be assigned until approved.</p></div><div class="help-card"><h3>Training = standalone training</h3><p>Use Training only for policies, inductions, refreshers, general H&amp;S briefings, equipment familiarisation or one-off training that is not driven by a controlled RA, COSHH RA, SSW or Toolbox Talk. Upload the PDF, choose Self-training or Instructor-led, set refresher frequency and assign Everyone, Departments and/or people.</p></div><div class="help-card"><h3>Evidence packs</h3><p>Evidence reporting is search-first and grouped for large document libraries. Selecting an SDS/MSDS, COSHH RA or Risk Assessment automatically suggests saved linked control documents and linked Toolbox Talks/training. Selected-only and Missing-links views help check the evidence set before creating the PDF.</p></div><div class="help-card"><h3>Contractor permit reports</h3><p>Reports can be filtered by contractor company, single date or date range, permit status and high-risk work type, then downloaded as PDF or CSV. The PDF includes a summary followed by a detailed evidence record for every contractor visit. It records the work description, location, PTW triggers, fire/life-safety acknowledgement, asbestos/location acknowledgement and register status, contractor signatures, pre-start and hot-work controls where applicable, Maintenance approval, sign-out, close-out controls and final close-out. The CSV exports the same evidence fields in data form.</p></div><div class="help-card"><h3>Contractor sign-in & Permit to Work</h3><p>Every contractor completes the site sign-in so fire/life-safety and asbestos information is always covered. The PTW screening then asks about building-fabric disturbance, electrical, gas, mechanical, hot work, work at height/roof, confined space, excavation, asbestos-related, demolition/structural, lifting, lift/elevator work, pressure systems and fire-system work. If none apply, the contractor is signed in without a PTW. If any apply, the job is held for Maintenance approval before work starts. Maintenance must open and review the full submitted PTW, including the contractor signature and recorded controls, before electronically signing approval. A contractor signed in by another department is clearly directed to Maintenance.</p></div><div class="help-card"><h3>Asbestos controls</h3><p>Permit locations drive the asbestos check. Upload the AMP and latest survey under Admin → Asbestos source documents. Once their location/register entries are built, relevant known/presumed asbestos is shown for the selected area/floor/room and snapshotted into the permit. Maintenance also has a separate Asbestos Lookup. The AWR-009 Asbestos Management &amp; HSE Compliance Review is assigned to the Maintenance department.</p></div><div class="help-card"><h3>Contractor personal data</h3><p>Contractor sign-in records collect only the information needed for site safety and permit control: contractor name, company, work, location and timing. Personal phone number and email are not collected in the contractor sign-in flow.</p></div><div class="help-card"><h3>Traffic-light rule</h3><p><strong>Green</strong> = current/compliant/complete. <strong>Amber</strong> = pending, due soon or an action is required. <strong>Red</strong> = overdue, blocked, not approved or a problem needing action. <strong>Grey</strong> = archived, disabled, inactive or historical. Cards and summary tiles use this rule consistently.</p></div><div class="help-card"><h3>Cleaner cards</h3><p>The main action stays visible. Less-used actions such as activity, details, archive and some administration controls are under <strong>More</strong> so mobile screens remain easy to use.</p></div><div class="help-card"><h3>Role access</h3><p>Users see My Safety, Safety Awareness, PPE Checks, Who's On Site, Who Has Key and Help. Managers additionally see Documents, standalone Training, People, Compliance, Instructor and Reports. Admins additionally see Admin controls. Report Viewer accounts see Reports only.</p></div><div class="help-card"><h3>Site locations</h3><p>Admin → Site locations controls the area/floor/room hierarchy used by Contractor Permits and Asbestos Lookup. Build Guest Rooms → Floor → Room as needed without changing the app.</p></div><div class="help-card"><h3>Departments</h3><p>Departments can be targeted at assignment time. Future active users added to a selected Department automatically inherit current training, awareness and PPE requirements while historical evidence is preserved.</p></div><div class="help-card"><h3>Admin / User mode switch</h3><p>Admins can use <strong>Switch to User</strong> in the header for normal day-to-day work. This changes only the interface; the account, audit identity and permissions in Supabase remain Admin. Return to Admin at any time while online.</p></div><div class="help-card"><h3>Who’s On Site</h3><p>A prominent Who's On Site shortcut is shown at the top of My Safety so current contractor attendance and PTW actions are easy to find. All signed-in staff can view current contractors and can sign contractors in. Site-sign-in-only visits can be closed by staff. Any job that triggers a Permit to Work is held for Maintenance approval and PTW close-out. Contractors do not receive access to the normal Safety Tracker app.</p></div><div class="help-card"><h3>Asbestos Lookup</h3><p>Maintenance users can check the asbestos register by work location whenever needed. Admins upload the AMP and latest asbestos survey under Admin → Asbestos source documents. Until source records and the location register are loaded, the lookup clearly states that the asbestos register is not yet loaded and the stop-work rule applies.</p></div><div class="help-card"><h3>Offline mode</h3><p>After one successful online sign-in, Safety Tracker keeps a minimal personal snapshot for offline use. My Safety, Awareness and PPE information stays available read-only, and required PDFs that have been saved on the device can be opened. Signatures, acknowledgements, PPE submissions and management changes always wait for a live connection.</p></div><div class="help-card"><h3>Demo mode</h3><p>The login screen includes <strong>Try Demo</strong>. Demo mode uses only fictional Example Hotel Ltd data, supports Admin/Manager/User/Report Viewer role switching and never writes demo changes to the live database. The direct marketing link can use <strong>?demo=1</strong>.</p></div><div class="help-card"><h3>Compliance & Instructor</h3><p>Compliance is ordered red → amber → green so overdue work appears first. Instructor shows only outstanding instructor-led work; after attendance is recorded it clearly shows when the employee acknowledgement is the remaining step.</p></div><div class="help-card"><h3>Password security</h3><p>Never share your Safety Tracker password. If you suspect someone else knows it, use Forgot password on the sign-in screen immediately.</p></div><div class="help-card"><h3>Staying signed in</h3><p>Normal browser refresh and pull-to-refresh keep your authenticated Safety Tracker session. Use Sign out only when you intend to end the session on that device.</p></div><div class="help-card"><h3>Version check</h3><p>The header must show <strong>v2.10.19 CLEAN</strong>.</p></div>`
}

window.SafetyTrackerV2={APP_VERSION,BUILD_ID,state,sb,loadAll,loadReportViewerData,refresh,isReportViewer,canViewReports,runSafetySync,hashPdf,sha256Text,pdfTextFromBlob,currentVersion,approvedCurrentVersion,pendingApprovalVersion,versionApprovalStatus,isVersionApproved,ensureTrainingDocLink,createSourceTraining,syncSourceTrainings,safeFileName,productWords,similarity,refsInText,canonicalRef,declaredDocumentMatches,nextVersionLabel,publishFileAsNewVersion,existingDocMatch,extractSdsProductName,extractCoshhProductCandidates,productNameMatchScore,documentDisplayTitle,repairSdsTitles,extractRiskAssessmentTitle,repairRaTitles,renderDocumentRegister,documentRegisterPdf,logDocumentActivity,requiredTrainingMaterial,requiredTrainingMaterials,requiredTrainingMaterialOpened,openRequiredTrainingMaterial,showTrainingException,showDocumentEvidencePack,showTrainingEvidencePack,generateEvidencePack,generateSelectedEvidencePack,renderAwareness,awarenessStatus,renderPpe,ppeCheckStatus,monthlyPpeReportDoc,generateMonthlySafetyReport,monthlyReportData,renderPermitReportPreview,downloadPermitReportPdf,downloadPermitReportCsv,classifySafetyPdfText,looksLikeCoshhAssessment,looksLikeSafetyDataSheet,toast};
init();
