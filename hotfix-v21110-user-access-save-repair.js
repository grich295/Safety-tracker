/* Safety Tracker v2.11.10 - user access save + mobile stability repair */
'use strict';
(function(){
if(window.__SAFETY_USER_ACCESS_V21110)return;
window.__SAFETY_USER_ACCESS_V21110=true;
function boot(){const core=window.SafetyTrackerV2;if(!core||!core.state||!core.sb)return setTimeout(boot,120);install(core)}
function install(core){
const st=core.state,sb=core.sb,$=id=>document.getElementById(id),CFG=window.SAFETY_TRACKER_CONFIG||{};
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{try{core.toast?.(m)}catch(_e){}};
const LABELS={mySafety:'My Safety',training:'Training',hsTraining:'H&S Training',documents:'Documents',creator:'Create Safety Doc',awareness:'Safety Awareness',checklists:'Checklists',ppe:'PPE Checks',firstAid:'First Aid Checks',onsite:"Who's On Site",asbestos:'Asbestos Lookup',people:'People',compliance:'Compliance',instructor:'Instructor',reports:'Reports',help:'Help'};
const CORE=new Set(['mySafety','training','hsTraining','help']);
const USER_DEFAULT=['mySafety','training','hsTraining','awareness','checklists','ppe','firstAid','onsite','help'];
const USER_ALLOWED=[...USER_DEFAULT,'documents','asbestos'];
const MANAGER_DEFAULT=['mySafety','training','hsTraining','documents','creator','awareness','checklists','ppe','firstAid','onsite','asbestos','people','compliance','instructor','reports','help'];
function roleOf(p){if(p?.report_only===true)return'report_viewer';return String(p?.role||'user').toLowerCase()}
function defaults(role){if(role==='manager')return new Set(MANAGER_DEFAULT);if(role==='report_viewer')return new Set(['reports']);if(role==='admin')return new Set([...MANAGER_DEFAULT,'admin']);return new Set(USER_DEFAULT)}
function allowed(role){if(role==='manager')return MANAGER_DEFAULT;if(role==='user')return USER_ALLOWED;return[]}
function saved(uid){return(st.userViewPreferences||[]).filter(x=>x.user_id===uid)}
function effective(uid,role){if(role==='admin'||role==='report_viewer')return defaults(role);const rows=saved(uid);if(!rows.length)return defaults(role);const out=new Set(rows.filter(x=>x.enabled!==false).map(x=>x.view_key));CORE.forEach(k=>out.add(k));return out}
function renderAccess(uid,forceDefaults=false){
 const host=$('v21110AccessChoices'),sel=$('roleSelect');if(!host||!sel)return false;
 const p=(st.people||[]).find(x=>x.id===uid),role=sel.value,actual=roleOf(p),enabled=(forceDefaults||role!==actual)?defaults(role):effective(uid,role);
 if(role==='admin'){host.innerHTML='<div class="hint-box"><strong>Admin:</strong> full Admin access is controlled by the Admin role.</div>';return true}
 if(role==='report_viewer'){host.innerHTML='<div class="hint-box"><strong>Report Viewer:</strong> reports/download-only access is controlled by the Report Viewer role.</div>';return true}
 const defs=defaults(role);
 host.innerHTML=`<div class="row-between"><div><h4>Access preferences</h4><p class="muted">This person starts with normal ${role==='manager'?'Manager':'User'} access. Change only the exceptions you need.</p></div><button type="button" class="ghost small" data-v21110-reset>Reset to role defaults</button></div>
 <div class="checkbox-list v21110-grid">${allowed(role).map(k=>{const mandatory=CORE.has(k),on=enabled.has(k),def=defs.has(k);return `<label class="check-row v21110-row"><input type="checkbox" class="role-view-choice" value="${esc(k)}" ${on?'checked':''} ${mandatory?'disabled':''}><span><strong>${esc(LABELS[k]||k)}</strong><small>${mandatory?'Required':def?'Role default':'Optional extra'}</small></span></label>`}).join('')}</div>
 ${role==='user'?'<div class="hint-box"><strong>Optional extras for a User:</strong> Documents and Asbestos Lookup. Asbestos Lookup does not give Manager/Admin access.</div>':''}`;
 return true
}
function decorateEditor(uid,attempt=0){
 const body=$('modalBody'),sel=$('roleSelect');if(!body||!sel){if(attempt<4)setTimeout(()=>decorateEditor(uid,attempt+1),80);return}
 sel.dataset.v21110Uid=uid;
 let section=[...body.querySelectorAll('.section-card')].find(s=>/User Mode preferences|Access preferences/i.test(s.querySelector('h4')?.textContent||''));
 if(!section){section=document.createElement('div');section.className='section-card';const hint=[...body.children].find(x=>x.classList?.contains('hint-box'));if(hint)hint.insertAdjacentElement('beforebegin',section);else body.appendChild(section)}
 section.innerHTML='<div id="v21110AccessChoices"></div>';renderAccess(uid,false);
 if(!sel.dataset.v21110Bound){sel.dataset.v21110Bound='1';sel.addEventListener('change',()=>renderAccess(uid,true))}
}
async function edgeAction(body){
 const g=await sb.auth.getSession(),session=g?.data?.session;if(!session?.access_token)throw new Error('Session expired. Sign out and sign back in.');
 const res=await fetch(`${CFG.supabaseUrl}/functions/v1/invite-user`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':CFG.supabaseKey},body:JSON.stringify(body)});
 const raw=await res.text();let out={};try{out=raw?JSON.parse(raw):{}}catch(_e){out={error:raw}}if(!res.ok)throw new Error(out.error||out.message||`HTTP ${res.status}`);return out
}
async function saveUser(id,button){
 if(button?.dataset.saving==='1')return;
 const p=(st.people||[]).find(x=>x.id===id);if(!p)return toast('User record is no longer available. Refresh and try again.');
 const requested=$('roleSelect')?.value,departmentId=$('roleDepartment')?.value||null,currentAccess=roleOf(p),own=id===st.user?.id;
 const displayName=clean($('editUserName')?.value),email=clean($('editUserEmail')?.value).toLowerCase();
 if(!requested)return toast('Choose a role.');if(!displayName)return toast('Name is required.');if(!email||!/^\S+@\S+\.\S+$/.test(email))return toast('A valid email address is required.');if(own&&requested!==currentAccess)return toast('You cannot change your own role/access level.');
 const original=button?.textContent||'Save changes';
 try{
  if(button){button.dataset.saving='1';button.disabled=true;button.textContent='Saving…'}
  if(displayName!==clean(p.display_name)||email!==clean(p.email).toLowerCase())await edgeAction({action:'update_user',user_id:id,display_name:displayName,email});
  if(requested==='report_viewer'){
   if(own)throw new Error('You cannot change your own account to Report Viewer.');
   if(String(p.role||'user').toLowerCase()!=='user')await edgeAction({action:'set_role',user_id:id,role:'user'});
   let r=await sb.rpc('set_report_only_access_v224',{p_user_id:id,p_enabled:true});if(r.error)throw r.error;
   r=await sb.rpc('set_user_departments_v21022',{p_user_id:id,p_primary_department_id:null,p_additional_department_ids:[]});if(r.error)throw r.error;
  }else{
   if(p.report_only===true){const r=await sb.rpc('set_report_only_access_v224',{p_user_id:id,p_enabled:false});if(r.error)throw r.error}
   if(requested!==String(p.role||'user').toLowerCase()){if(own)throw new Error('You cannot change your own role/access level.');await edgeAction({action:'set_role',user_id:id,role:requested})}
   const extras=[...document.querySelectorAll('.role-extra-dept:checked')].map(x=>x.value).filter(x=>x&&x!==departmentId);
   let r=await sb.rpc('set_user_departments_v21022',{p_user_id:id,p_primary_department_id:departmentId||null,p_additional_department_ids:extras});if(r.error)throw r.error;
   if(requested!=='admin'){const views=[...document.querySelectorAll('.role-view-choice:checked')].map(x=>x.value);CORE.forEach(k=>{if(!views.includes(k))views.push(k)});r=await sb.rpc('set_user_view_preferences_v21022',{p_user_id:id,p_enabled_views:views});if(r.error)throw r.error}
  }
  if(typeof window.closeModal==='function')window.closeModal();else if($('modal')?.open)$('modal').close();
  await core.refresh?.('User details and access preferences saved.');setTimeout(applyCurrentAccess,80)
 }catch(err){console.error('v2.11.10 user save failed',err);toast(`Could not save user: ${err?.message||'Unknown error'}`)}
 finally{if(button&&document.body.contains(button)){button.dataset.saving='0';button.disabled=false;button.textContent=original}}
}
function currentEffective(){return effective(st.user?.id,roleOf(st.profile))}
function applyCurrentAccess(){const p=st.profile;if(!p)return;const role=roleOf(p);if(role==='admin'||role==='report_viewer')return;const set=currentEffective();document.querySelectorAll('#mainNav button[data-view]').forEach(b=>{const key=b.dataset.view;if(!key)return;if(!set.has(key))b.hidden=true;else if(key==='asbestos')b.hidden=false})}
function openExplicitAsbestos(){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='asbestos'));$('asbestosView')?.classList.add('active-view');Promise.resolve(window.SafetyAsbestosV21080?.refresh?.()).catch(()=>{});setTimeout(()=>window.SafetyAsbestosIntelligenceV2118?.decorateLookup?.(),180)}
window.addEventListener('click',e=>{
 const edit=e.target.closest?.('[data-set-role]');if(edit){const uid=edit.dataset.setRole;[0,80,220].forEach(ms=>setTimeout(()=>decorateEditor(uid),ms));return}
 const reset=e.target.closest?.('[data-v21110-reset]');if(reset){e.preventDefault();e.stopImmediatePropagation();const uid=$('roleSelect')?.dataset.v21110Uid;if(uid)renderAccess(uid,true);return}
 const save=e.target.closest?.('[data-save-role]');if(save){e.preventDefault();e.stopImmediatePropagation();saveUser(save.dataset.saveRole,save);return}
 const nav=e.target.closest?.('#mainNav button[data-view]');if(nav&&st.profile){const role=roleOf(st.profile);if(role!=='admin'&&role!=='report_viewer'){const key=nav.dataset.view,set=currentEffective();if(!set.has(key)){e.preventDefault();e.stopImmediatePropagation();toast(`${LABELS[key]||key} is not enabled for this account.`);return}if(key==='asbestos'&&role==='user'&&set.has('asbestos')){e.preventDefault();e.stopImmediatePropagation();openExplicitAsbestos();return}}}
},true);
window.addEventListener('pageshow',()=>setTimeout(applyCurrentAccess,120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(applyCurrentAccess,120)});
[300,800,1600,3500,8000,15000].forEach(ms=>setTimeout(applyCurrentAccess,ms));
const style=document.createElement('style');style.textContent=`.v21110-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v21110-row{align-items:flex-start;padding:10px;border:1px solid rgba(127,127,127,.22);border-radius:10px}.v21110-row span{display:flex;flex-direction:column;gap:2px}.v21110-row small{font-size:.78rem;opacity:.75}@media(max-width:620px){.v21110-grid{grid-template-columns:1fr}}`;document.head.appendChild(style);
window.SafetyUserAccessV21110={apply:applyCurrentAccess,decorate:decorateEditor}
}
boot()
})();
