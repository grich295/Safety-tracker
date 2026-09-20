/* Safety Tracker v2.11.9 - per-user access preferences layered on role defaults */
'use strict';
(function(){
  if(window.__SAFETY_USER_ACCESS_V2119)return;
  window.__SAFETY_USER_ACCESS_V2119=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,120);return}
    install(core);
  }

  function install(core){
    const st=core.state,$=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast?.(m)}catch(_e){}};

    const LABELS={
      mySafety:'My Safety',training:'Training',hsTraining:'H&S Training',documents:'Documents',
      creator:'Create Safety Doc',awareness:'Safety Awareness',checklists:'Checklists',ppe:'PPE Checks',
      firstAid:'First Aid Checks',onsite:"Who's On Site",asbestos:'Asbestos Lookup',people:'People',
      compliance:'Compliance',instructor:'Instructor',reports:'Reports',help:'Help'
    };
    const CORE=new Set(['mySafety','training','hsTraining','help']);
    const USER_DEFAULT=['mySafety','training','hsTraining','awareness','checklists','ppe','firstAid','onsite','help'];
    const USER_ALLOWED=[...USER_DEFAULT,'documents','asbestos'];
    const MANAGER_DEFAULT=['mySafety','training','hsTraining','documents','creator','awareness','checklists','ppe','firstAid','onsite','asbestos','people','compliance','instructor','reports','help'];

    function roleOf(p){
      if(p?.report_only===true)return'report_viewer';
      return String(p?.role||'user').toLowerCase();
    }
    function defaultsFor(role){
      if(role==='manager')return new Set(MANAGER_DEFAULT);
      if(role==='report_viewer')return new Set(['reports']);
      if(role==='admin')return new Set([...MANAGER_DEFAULT,'admin']);
      return new Set(USER_DEFAULT);
    }
    function allowedFor(role){
      if(role==='manager')return MANAGER_DEFAULT;
      if(role==='user')return USER_ALLOWED;
      return [];
    }
    function savedRows(uid){return (st.userViewPreferences||[]).filter(x=>x.user_id===uid)}
    function effectiveFor(uid,role){
      if(role==='admin')return defaultsFor('admin');
      if(role==='report_viewer')return defaultsFor('report_viewer');
      const rows=savedRows(uid);
      if(!rows.length)return defaultsFor(role);
      const out=new Set(rows.filter(x=>x.enabled!==false).map(x=>x.view_key));
      CORE.forEach(x=>out.add(x));
      return out;
    }
    function differsFromDefaults(uid,role){
      const a=effectiveFor(uid,role),b=defaultsFor(role);
      if(a.size!==b.size)return true;
      return [...a].some(x=>!b.has(x));
    }

    function renderAccessChoices(uid,role,reset=false){
      const host=$('v2119AccessChoices');
      if(!host)return;
      const p=(st.people||[]).find(x=>x.id===uid);
      const actualRole=roleOf(p);
      let enabled;
      if(reset||role!==actualRole)enabled=defaultsFor(role);
      else enabled=effectiveFor(uid,role);

      if(role==='admin'){
        host.innerHTML='<div class="hint-box"><strong>Admin:</strong> full Admin access is controlled by the Admin role and is not reduced with per-user preferences.</div>';
        return;
      }
      if(role==='report_viewer'){
        host.innerHTML='<div class="hint-box"><strong>Report Viewer:</strong> reports/download-only access is controlled by the Report Viewer role.</div>';
        return;
      }

      const defs=defaultsFor(role),allowed=allowedFor(role);
      host.innerHTML=`<div class="row-between"><div><h4>Access preferences</h4><p class="muted">Start with the normal ${esc(role==='manager'?'Manager':'User')} access, then change only this person's exceptions.</p></div><button type="button" class="ghost small" data-v2119-reset-access>Reset to role defaults</button></div>
        <div class="hint-box"><strong>Role defaults stay simple.</strong> A User can be given Documents or Asbestos Lookup as an extra. Manager screens can be hidden for an individual Manager without changing their role.</div>
        <div class="checkbox-list v2119-access-grid">
          ${allowed.map(k=>{
            const mandatory=CORE.has(k),def=defs.has(k),on=enabled.has(k);
            const note=mandatory?'Required':def?'Role default':'Optional extra';
            return `<label class="check-row v2119-access-row ${def?'role-default':'role-extra'}">
              <input type="checkbox" class="role-view-choice" value="${esc(k)}" ${on?'checked':''} ${mandatory?'disabled':''}>
              <span><strong>${esc(LABELS[k]||k)}</strong><small>${esc(note)}</small></span>
            </label>`;
          }).join('')}
        </div>
        ${role==='user'?'<div class="pending-use-warning"><strong>Asbestos Lookup exception:</strong> switching this on gives this named User asbestos lookup/evidence access even if they are not in the Maintenance department. It does not give Manager/Admin powers.</div>':''}`;
    }

    function decorateEditModal(uid){
      const role=$('roleSelect');
      if(!role)return;
      role.dataset.v2119Uid=uid;
      const old=[...document.querySelectorAll('#modalBody .section-card')].find(s=>/User Mode preferences/i.test(s.querySelector('h4')?.textContent||''));
      if(!old)return;
      old.innerHTML='<div id="v2119AccessChoices"></div>';
      renderAccessChoices(uid,role.value,false);
      if(!role.dataset.v2119Bound){
        role.dataset.v2119Bound='1';
        role.addEventListener('change',()=>renderAccessChoices(uid,role.value,true));
      }
    }

    function currentProfile(){
      return st.profile||null;
    }
    function currentEffective(){
      const p=currentProfile();
      return effectiveFor(st.user?.id,roleOf(p));
    }
    function canCurrent(view){
      const p=currentProfile(),role=roleOf(p);
      if(role==='admin')return true;
      return currentEffective().has(view);
    }
    function applyCurrentAccess(){
      const p=currentProfile();if(!p)return;
      const role=roleOf(p);
      if(role==='admin'||role==='report_viewer')return;
      const allowed=currentEffective();

      document.querySelectorAll('#mainNav button[data-view]').forEach(b=>{
        const key=b.dataset.view;
        if(!allowed.has(key))b.hidden=true;
        else if(key==='asbestos')b.hidden=false; // explicit named-user asbestos exception
      });

      // If a Manager has chosen a reduced interface, also hide direct view buttons.
      document.querySelectorAll('[data-view]').forEach(b=>{
        const key=b.dataset.view;
        if(key&&LABELS[key]&&!allowed.has(key)&&!b.closest('#mainNav'))b.hidden=true;
      });

      const active=document.querySelector('.view.active-view');
      const key=active?.id?.replace(/View$/,'');
      if(key&&LABELS[key]&&!allowed.has(key)){
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
        document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='mySafety'));
        $('mySafetyView')?.classList.add('active-view');
      }
    }

    function openAsbestosForExplicitUser(){
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
      document.querySelectorAll('#mainNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='asbestos'));
      $('asbestosView')?.classList.add('active-view');
      Promise.resolve(window.SafetyAsbestosV21080?.refresh?.()).catch(()=>{});
      setTimeout(()=>window.SafetyAsbestosIntelligenceV2118?.decorateLookup?.(),200);
    }

    function addPeopleAccessBadges(){
      if(roleOf(currentProfile())!=='admin')return;
      const cards=[...document.querySelectorAll('#peopleList .item-card')];
      const people=[...(st.people||[])].sort((a,b)=>(a.active===false)-(b.active===false)||String(a.display_name||a.email).localeCompare(String(b.display_name||b.email)));
      cards.forEach((card,i)=>{
        const p=people[i];if(!p||p.report_only===true||roleOf(p)==='admin')return;
        let badge=card.querySelector('.v2119-custom-access-badge');
        const custom=differsFromDefaults(p.id,roleOf(p));
        if(custom&&!badge){
          badge=document.createElement('span');badge.className='badge due v2119-custom-access-badge';badge.textContent='Custom access';
          card.querySelector('.meta')?.appendChild(badge);
        }else if(!custom&&badge)badge.remove();
      });
    }

    window.addEventListener('click',e=>{
      const edit=e.target.closest?.('[data-set-role]');
      if(edit){
        const uid=edit.dataset.setRole;
        setTimeout(()=>decorateEditModal(uid),40);
        return;
      }
      const reset=e.target.closest?.('[data-v2119-reset-access]');
      if(reset){
        e.preventDefault();
        const role=$('roleSelect'),uid=role?.dataset.v2119Uid;
        if(role&&uid)renderAccessChoices(uid,role.value,true);
        return;
      }
      const route=e.target.closest?.('[data-view]');
      if(route&&currentProfile()&&roleOf(currentProfile())!=='admin'){
        const key=route.dataset.view;
        if(key&&LABELS[key]&&!canCurrent(key)){
          e.preventDefault();e.stopImmediatePropagation();
          toast(`${LABELS[key]} is not enabled for this account.`);
          return;
        }
        if(key==='asbestos'&&roleOf(currentProfile())==='user'&&canCurrent('asbestos')){
          e.preventDefault();e.stopImmediatePropagation();
          openAsbestosForExplicitUser();
          return;
        }
      }
    },true);

    const observer=new MutationObserver(()=>{
      setTimeout(()=>{applyCurrentAccess();addPeopleAccessBadges()},20);
    });
    observer.observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
    [250,700,1500,3000].forEach(ms=>setTimeout(()=>{applyCurrentAccess();addPeopleAccessBadges()},ms));
    window.addEventListener('pageshow',()=>setTimeout(applyCurrentAccess,100));

    const style=document.createElement('style');
    style.textContent=`
      .v2119-access-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .v2119-access-row{align-items:flex-start;padding:10px;border:1px solid rgba(127,127,127,.22);border-radius:10px}
      .v2119-access-row span{display:flex;flex-direction:column;gap:2px}
      .v2119-access-row small{font-size:.78rem;opacity:.75}
      .v2119-access-row.role-extra{border-style:dashed}
      @media(max-width:620px){.v2119-access-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    window.SafetyUserAccessV2119={apply:applyCurrentAccess,effective:currentEffective};
  }
  boot();
})();
