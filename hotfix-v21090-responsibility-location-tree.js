/* Safety Tracker v2.10.90 - location tree + accountable H&S review ownership */
'use strict';
(function(){
  if(window.__RESPONSIBILITY_LOCATION_TREE_V21090)return;
  window.__RESPONSIBILITY_LOCATION_TREE_V21090=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const resp=window.SafetyPositionsResponsibilitiesV21069;
    if(!core||!core.state||!core.sb||!resp){setTimeout(boot,120);return;}
    install(core,resp);
  }

  function install(core,resp){
    const state=core.state,sb=core.sb;
    const $=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const today=()=>new Date().toISOString().slice(0,10);
    const in30=()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().slice(0,10)};
    const fmt=d=>d?new Date(String(d).length===10?d+'T00:00:00':d).toLocaleDateString('en-GB'):'—';

    /* ------------------------------------------------------------------
       RPC ownership hardening.
       Existing UI code keeps working, but approval/review/audience calls are
       transparently routed through the v2.10.90 responsibility-enforcing RPCs.
       ------------------------------------------------------------------ */
    if(!sb.__responsibilityRpcV21090){
      const rawRpc=sb.rpc.bind(sb);
      const map={
        decide_document_version_with_ack_v281:'decide_document_version_with_ack_v21090',
        decide_document_version_with_training_schedule_ack_v281:'decide_document_version_with_training_schedule_ack_v21090',
        record_document_review:'record_document_review_v21090',
        set_document_training_audience_v230:'set_document_training_audience_v21090',
        set_training_session_audience_v239:'set_training_session_audience_v21090',
        approve_training_session:'approve_training_session_v21090'
      };
      sb.rpc=function(fn,args,options){
        return rawRpc(map[fn]||fn,args,options);
      };
      sb.__responsibilityRpcV21090=true;
    }

    /* ------------------------------------------------------------------
       Location tree
       ------------------------------------------------------------------ */
    const expanded=new Set();
    let searchText='';
    let showArchived=false;
    let treeTimer=0;

    const locById=id=>(state.siteLocations||[]).find(x=>x.id===id)||null;
    function locPath(id){
      const out=[];let x=locById(id),guard=0;
      while(x&&guard++<30){out.unshift(x.name);x=x.parent_id?locById(x.parent_id):null;}
      return out.join(' > ');
    }
    function childrenOf(parentId){
      return (state.siteLocations||[])
        .filter(x=>(x.parent_id||null)===(parentId||null)&&(showArchived||x.active!==false))
        .sort((a,b)=>(a.active!==false?0:1)-(b.active!==false?0:1)||(a.sort_order||0)-(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true}));
    }
    function descendants(id){
      let n=0,rooms=0;
      const walk=pid=>{
        for(const c of childrenOf(pid)){n++;if(c.location_type==='ROOM')rooms++;walk(c.id);}
      };
      walk(id);return {all:n,rooms};
    }
    function nodeMatches(x,q){
      if(!q)return true;
      const hay=(locPath(x.id)+' '+(x.location_type||'')).toLowerCase();
      if(hay.includes(q))return true;
      return childrenOf(x.id).some(c=>nodeMatches(c,q));
    }
    function rowHtml(x,depth,q){
      if(!nodeMatches(x,q))return '';
      const kids=childrenOf(x.id).filter(c=>nodeMatches(c,q));
      const has=kids.length>0;
      const forced=!!q;
      const open=forced||expanded.has(x.id);
      const counts=descendants(x.id);
      const type=String(x.location_type||'AREA').replaceAll('_',' ');
      const archived=x.active===false;
      const pad=Math.min(depth,6)*15;
      return `
        <div class="site-tree-node-v21090 ${archived?'site-tree-archived-v21090':''}">
          <div class="site-tree-row-v21090" style="--tree-pad:${pad}px">
            <button type="button" class="site-tree-toggle-v21090" ${has?'data-site-tree-toggle="'+x.id+'"':'disabled aria-hidden="true"'}>${has?(open?'▾':'▸'):'·'}</button>
            <div class="site-tree-main-v21090">
              <strong>${esc(x.name)}</strong>
              <div class="meta">
                <span>${esc(type)}</span>
                ${has?`<span>${kids.length} direct</span>`:''}
                ${counts.rooms?`<span>${counts.rooms} room${counts.rooms===1?'':'s'} below</span>`:''}
                <span class="badge ${archived?'neutral':'complete'}">${archived?'Archived':'Active'}</span>
              </div>
            </div>
            <div class="site-tree-actions-v21090">
              <button type="button" class="secondary small" data-edit-site-location="${x.id}">Edit</button>
              ${!archived?`<button type="button" class="ghost small" data-site-tree-add="${x.id}">+ Child</button>`:''}
              <button type="button" class="${archived?'primary':'ghost'} small" data-toggle-site-location="${x.id}">${archived?'Restore':'Archive'}</button>
            </div>
          </div>
          ${has&&open?`<div class="site-tree-children-v21090">${kids.map(c=>rowHtml(c,depth+1,q)).join('')}</div>`:''}
        </div>`;
    }

    function renderLocationTree(force=false){
      const box=$('siteLocationList');
      if(!box)return;
      if(!force&&box.querySelector('.site-location-tree-v21090'))return;

      const rows=(state.siteLocations||[]).filter(x=>showArchived||x.active!==false);
      const roots=childrenOf(null);
      const floors=rows.filter(x=>x.location_type==='FLOOR').length;
      const rooms=rows.filter(x=>x.location_type==='ROOM').length;
      const q=clean(searchText).toLowerCase();

      box.innerHTML=`
        <div class="site-location-tree-v21090">
          <div class="site-tree-toolbar-v21090">
            <input id="siteLocationTreeSearchV21090" type="search" placeholder="Search room, floor or area…" value="${esc(searchText)}">
            <button type="button" class="secondary small" data-site-tree-expand-all>Expand all</button>
            <button type="button" class="ghost small" data-site-tree-collapse-all>Collapse all</button>
            <label class="check-row site-tree-archived-toggle-v21090"><input id="siteTreeShowArchivedV21090" type="checkbox" ${showArchived?'checked':''}> Show archived</label>
          </div>
          <div class="hint-box"><strong>${rows.length} location${rows.length===1?'':'s'}</strong> · ${roots.length} top level · ${floors} floor${floors===1?'':'s'} · ${rooms} room${rooms===1?'':'s'}. Locations imported from asbestos surveys appear here only after review/approval.</div>
          <div class="site-tree-root-v21090">
            ${roots.length?roots.map(x=>rowHtml(x,0,q)).join(''):'<div class="empty">No site locations.</div>'}
          </div>
        </div>`;
    }

    function ensureTree(){
      const box=$('siteLocationList');
      if(!box)return;
      if(!box.querySelector('.site-location-tree-v21090'))renderLocationTree(true);
    }

    function attachTreeObserver(){
      const box=$('siteLocationList');
      if(!box)return setTimeout(attachTreeObserver,250);
      new MutationObserver(()=>{
        clearTimeout(treeTimer);
        treeTimer=setTimeout(ensureTree,40);
      }).observe(box,{childList:true});
      ensureTree();
    }

    document.addEventListener('click',e=>{
      const tog=e.target.closest?.('[data-site-tree-toggle]');
      if(tog){
        e.preventDefault();e.stopImmediatePropagation();
        const id=tog.dataset.siteTreeToggle;
        if(expanded.has(id))expanded.delete(id);else expanded.add(id);
        renderLocationTree(true);return;
      }
      if(e.target.closest?.('[data-site-tree-expand-all]')){
        e.preventDefault();e.stopImmediatePropagation();
        (state.siteLocations||[]).forEach(x=>{if(childrenOf(x.id).length)expanded.add(x.id);});
        renderLocationTree(true);return;
      }
      if(e.target.closest?.('[data-site-tree-collapse-all]')){
        e.preventDefault();e.stopImmediatePropagation();
        expanded.clear();renderLocationTree(true);return;
      }
      const add=e.target.closest?.('[data-site-tree-add]');
      if(add){
        e.preventDefault();e.stopImmediatePropagation();
        const parent=locById(add.dataset.siteTreeAdd);
        document.querySelector('[data-new-site-location]')?.click();
        setTimeout(()=>{
          const ps=$('siteLocationParent'),ts=$('siteLocationType');
          if(ps)ps.value=parent?.id||'';
          if(ts)ts.value=parent?.location_type==='GUEST_ROOMS'?'FLOOR':parent?.location_type==='FLOOR'?'ROOM':'AREA';
        },80);
        return;
      }
    },true);

    document.addEventListener('input',e=>{
      if(e.target?.id==='siteLocationTreeSearchV21090'){
        searchText=e.target.value||'';
        renderLocationTree(true);
        setTimeout(()=>{const s=$('siteLocationTreeSearchV21090');if(s){s.focus();s.setSelectionRange(searchText.length,searchText.length);}},0);
      }
    },true);
    document.addEventListener('change',e=>{
      if(e.target?.id==='siteTreeShowArchivedV21090'){
        showArchived=!!e.target.checked;renderLocationTree(true);
      }
    },true);

    /* ------------------------------------------------------------------
       Responsibility / due calculations
       ------------------------------------------------------------------ */
    function audienceScope(rows,kindKey){
      if(!rows.length)return {type:'UNSCOPED',departmentId:null};
      const everyone=rows.some(x=>x.target_type==='EVERYONE');
      const deps=[...new Set(rows.filter(x=>x.target_type==='DEPARTMENT'&&x.department_id).map(x=>x.department_id))];
      if(everyone||deps.length!==1)return {type:'SITE',departmentId:null};
      return {type:'DEPARTMENT',departmentId:deps[0]};
    }
    function docScope(id){
      return audienceScope((state.documentAudiences||[]).filter(x=>x.document_id===id),'document_id');
    }
    function tbtScope(id){
      return audienceScope((state.trainingAudiences||[]).filter(x=>x.training_session_id===id),'training_session_id');
    }
    function ownerFor(scope){
      if(scope.type==='UNSCOPED')return {userId:null,label:'Scope required',missing:true};
      if(scope.type==='SITE'){
        const r=resp.currentResponsibility('HS_MANAGER');
        return {userId:r?.user_id||null,label:r?.user_id?personLabel(r.user_id):'H&S Manager not assigned',missing:!r?.user_id};
      }
      const r=resp.currentResponsibility('DEPARTMENT_MANAGER',scope.departmentId);
      return {userId:r?.user_id||null,label:r?.user_id?personLabel(r.user_id):'Department Manager not assigned',missing:!r?.user_id};
    }
    function personLabel(id){
      const p=(state.people||[]).find(x=>x.id===id);
      return p?.display_name||p?.email||'Assigned manager';
    }
    function deptLabel(id){
      return (state.departments||[]).find(x=>x.id===id)?.name||'Department';
    }
    function docLabel(d){return clean((d.reference?d.reference+' - ':'')+(d.title||'Controlled document'));}
    function versionsFor(id){return (state.versions||[]).filter(v=>v.document_id===id);}
    function pendingVersion(id){return versionsFor(id).filter(v=>String(v.approval_status||'').toUpperCase()==='PENDING').sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;}
    function approvedCurrent(id){return versionsFor(id).find(v=>v.status==='CURRENT'&&String(v.approval_status||'').toUpperCase()==='APPROVED')||versionsFor(id).filter(v=>String(v.approval_status||'').toUpperCase()==='APPROVED').sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null;}

    function documentDueItem(d){
      const scope=docScope(d.id);
      if(scope.type==='UNSCOPED')return {kind:'DOCUMENT',label:docLabel(d),traffic:'red',status:'Scope required',date:null,scope};
      const pv=pendingVersion(d.id);
      if(pv)return {kind:'DOCUMENT',label:docLabel(d),traffic:'amber',status:'Pending approval',date:pv.issue_date||pv.created_at,scope};
      const v=approvedCurrent(d.id);
      if(!v)return {kind:'DOCUMENT',label:docLabel(d),traffic:'red',status:'No approved/current version',date:null,scope};
      if(d.review_required)return {kind:'DOCUMENT',label:docLabel(d),traffic:'red',status:'Review required',date:v.review_date,scope};
      if(v.review_date&&v.review_date<today())return {kind:'DOCUMENT',label:docLabel(d),traffic:'red',status:'Review overdue',date:v.review_date,scope};
      if(v.review_date&&v.review_date<=in30())return {kind:'DOCUMENT',label:docLabel(d),traffic:'amber',status:'Review due soon',date:v.review_date,scope};
      return null;
    }
    function tbtDueItem(t){
      const scope=tbtScope(t.id);
      const ref=t.reference?`${t.reference} - `:'';
      const label=clean(ref+(t.name||'Toolbox Talk'));
      if(scope.type==='UNSCOPED')return {kind:'TBT',label,traffic:'red',status:'Scope required',date:null,scope};
      const ap=String(t.approval_status||'').toUpperCase();
      if(ap==='PENDING')return {kind:'TBT',label,traffic:'amber',status:'Pending approval',date:t.created_at,scope};
      if(t.review_required)return {kind:'TBT',label,traffic:'red',status:'Review required',date:t.review_date,scope};
      if(t.review_date&&t.review_date<today())return {kind:'TBT',label,traffic:'red',status:'Review overdue',date:t.review_date,scope};
      if(t.review_date&&t.review_date<=in30())return {kind:'TBT',label,traffic:'amber',status:'Review due soon',date:t.review_date,scope};
      return null;
    }
    function allDueItems(){
      const docs=(state.documents||[]).filter(d=>d.status!=='ARCHIVED'&&['RISK_ASSESSMENT','COSHH','SSW'].includes(String(d.doc_type||'').toUpperCase())).map(documentDueItem).filter(Boolean);
      const tbts=(state.training||[]).filter(t=>t.status!=='ARCHIVED'&&String(t.source_kind||t.session_type||'').toUpperCase()==='TOOLBOX_TALK').map(tbtDueItem).filter(Boolean);
      return docs.concat(tbts);
    }
    function scopeItems(type,dep=null){
      return allDueItems().filter(x=>type==='SITE'?x.scope.type==='SITE':x.scope.type==='DEPARTMENT'&&x.scope.departmentId===dep);
    }
    function unscopedItems(){return allDueItems().filter(x=>x.scope.type==='UNSCOPED');}

    function addRenewal(date,value,unit){
      if(!date||!value||!unit)return null;
      const d=new Date(date);
      if(unit==='DAYS')d.setDate(d.getDate()+Number(value));
      else if(unit==='YEARS')d.setFullYear(d.getFullYear()+Number(value));
      else d.setMonth(d.getMonth()+Number(value));
      return d;
    }
    function trainingCounts(depId){
      const activeUsers=new Set(
        (state.userDepartments||[])
          .filter(x=>x.department_id===depId)
          .map(x=>x.user_id)
          .filter(uid=>(state.people||[]).some(p=>p.id===uid&&p.active!==false&&p.report_only!==true))
      );
      let overdue=0,action=0,current=0;
      for(const a of (state.trainingAssignments||[])){
        if(a.active===false||!activeUsers.has(a.user_id))continue;
        const t=(state.training||[]).find(x=>x.id===a.training_session_id);
        if(!t||t.status==='ARCHIVED')continue;
        const sign=(state.trainingSignoffs||[]).filter(s=>s.training_assignment_id===a.id).sort((x,y)=>new Date(y.signed_at||0)-new Date(x.signed_at||0))[0]||null;
        let due=null;
        if(!sign)due=a.due_date?new Date(a.due_date+'T23:59:59'):new Date();
        else if(a.renewal_value&&a.renewal_unit)due=addRenewal(sign.signed_at,a.renewal_value,a.renewal_unit);

        if(!sign){
          if(due&&due<new Date())overdue++;else action++;
        }else if(due){
          if(due<new Date())overdue++;
          else{const d30=new Date();d30.setDate(d30.getDate()+30);if(due<=d30)action++;else current++;}
        }else current++;
      }
      return {overdue,action,current,total:overdue+action+current};
    }

    function dueListHtml(items,max=6){
      const ordered=items.slice().sort((a,b)=>(a.traffic==='red'?0:1)-(b.traffic==='red'?0:1)||String(a.date||'9999').localeCompare(String(b.date||'9999')));
      if(!ordered.length)return '<div class="success-note compact-note-v21090">No document reviews or approvals currently due.</div>';
      return `<div class="responsibility-due-list-v21090">${
        ordered.slice(0,max).map(x=>`<div class="responsibility-due-row-v21090 traffic-${x.traffic}"><div><strong>${esc(x.label)}</strong><div class="meta"><span>${esc(x.status)}</span>${x.date?`<span>${fmt(x.date)}</span>`:''}</div></div></div>`).join('')
      }${ordered.length>max?`<div class="muted">+ ${ordered.length-max} more due item${ordered.length-max===1?'':'s'}</div>`:''}</div>`;
    }

    function responsibilitySummaryHtml(type,dep=null){
      const items=scopeItems(type,dep);
      const red=items.filter(x=>x.traffic==='red').length,amber=items.filter(x=>x.traffic==='amber').length;
      const owner=ownerFor(type==='SITE'?{type:'SITE'}:{type:'DEPARTMENT',departmentId:dep});
      const training=type==='DEPARTMENT'?trainingCounts(dep):null;
      const traffic=owner.missing||red?'red':amber||(training&&(training.overdue||training.action))?'amber':'green';
      return `<div class="responsibility-summary-v21090 traffic-${traffic}">
        ${owner.missing?`<div class="danger-note"><strong>${esc(owner.label)}.</strong> Required reviews/approvals are blocked until this responsibility is assigned.</div>`:
          `<div class="success-note compact-note-v21090"><strong>Approval/review owner:</strong> ${esc(owner.label)}</div>`}
        <div class="responsibility-stats-v21090">
          <div><strong>${red}</strong><span>Overdue / blocked</span></div>
          <div><strong>${amber}</strong><span>Due / pending</span></div>
          ${training?`<div><strong>${training.overdue}</strong><span>Training overdue</span></div><div><strong>${training.action}</strong><span>Training action</span></div>`:
          `<div><strong>Dept managers</strong><span>Own staff training</span></div>`}
        </div>
        ${dueListHtml(items)}
      </div>`;
    }

    function decorateResponsibilities(){
      const card=$('positionsResponsibilities69');
      if(!card)return;

      if(!card.querySelector('.responsibility-rule-v21090')){
        const hint=document.createElement('div');
        hint.className='hint-box responsibility-rule-v21090';
        hint.innerHTML='<strong>Approval responsibility:</strong> Whole-hotel / Everyone or multi-department RA, COSHH RA, SSW and Toolbox Talk → <strong>H&S Manager</strong>. One-department material → that <strong>Department Manager</strong>. Department Managers remain responsible for training completion within their own department.';
        const first=card.querySelector('.hint-box');
        if(first)first.insertAdjacentElement('afterend',hint);else card.prepend(hint);
      }

      const unscoped=unscopedItems();
      let scopeWarn=card.querySelector('#unscopedHsDocumentsV21090');
      if(unscoped.length){
        if(!scopeWarn){scopeWarn=document.createElement('div');scopeWarn.id='unscopedHsDocumentsV21090';card.querySelector('.responsibility-rule-v21090')?.insertAdjacentElement('afterend',scopeWarn);}
        scopeWarn.className='danger-note';
        scopeWarn.innerHTML=`<strong>${unscoped.length} controlled H&S item${unscoped.length===1?' has':'s have'} no scope assigned.</strong><br>Set each to Everyone/site-wide or the correct Department before its next review/approval.`;
      }else if(scopeWarn)scopeWarn.remove();

      const hsSelect=$('hsManager69');
      const hsSection=hsSelect?.closest('.section-card');
      if(hsSection){
        let box=hsSection.querySelector('.responsibility-summary-v21090-wrap');
        if(!box){box=document.createElement('div');box.className='responsibility-summary-v21090-wrap';hsSection.appendChild(box);}
        box.innerHTML=responsibilitySummaryHtml('SITE');
      }

      for(const dep of (state.departments||[]).filter(d=>d.active!==false)){
        const sel=$('deptManager69_'+dep.id),row=sel?.closest('.item-card');
        if(!row)continue;
        let box=row.querySelector('.responsibility-summary-v21090-wrap');
        if(!box){box=document.createElement('div');box.className='responsibility-summary-v21090-wrap';row.appendChild(box);}
        box.innerHTML=responsibilitySummaryHtml('DEPARTMENT',dep.id);
      }
    }

    function scopeFromApprovalModal(){
      const everyone=$('approvalAssignEveryone');
      if(everyone){
        const deps=[...document.querySelectorAll('.approval-department-choice:checked')].map(x=>x.value);
        return everyone.checked||deps.length!==1?{type:'SITE'}:{type:'DEPARTMENT',departmentId:deps[0]};
      }
      const tEveryone=$('tbtApprovalAudienceAssignEveryone');
      if(tEveryone){
        const deps=[...document.querySelectorAll('.tbtApprovalAudience-department-choice:checked')].map(x=>x.value);
        return tEveryone.checked||deps.length!==1?{type:'SITE'}:{type:'DEPARTMENT',departmentId:deps[0]};
      }
      return null;
    }
    function decorateApprovalModal(){
      const modal=$('modal'),body=$('modalBody');
      if(!modal?.open||!body)return;
      const saveVersion=body.querySelector('[data-save-version-approval]');
      const saveReview=body.querySelector('[data-save-doc-review]');
      const saveTbt=body.querySelector('[data-confirm-training-approval]');
      if(!saveVersion&&!saveReview&&!saveTbt)return;

      let scope=scopeFromApprovalModal();
      if(!scope&&saveVersion){
        const v=(state.versions||[]).find(x=>x.id===saveVersion.dataset.saveVersionApproval);
        if(v)scope=docScope(v.document_id);
      }
      if(!scope&&saveReview)scope=docScope(saveReview.dataset.saveDocReview);
      if(!scope&&saveTbt)scope=tbtScope(saveTbt.dataset.confirmTrainingApproval);
      scope=scope||{type:'UNSCOPED'};

      const owner=ownerFor(scope);
      let hint=body.querySelector('#responsibilityApprovalHintV21090');
      if(!hint){hint=document.createElement('div');hint.id='responsibilityApprovalHintV21090';const actions=[...body.querySelectorAll('.actions')].pop();if(actions)actions.insertAdjacentElement('beforebegin',hint);else body.appendChild(hint);}
      const scopeName=scope.type==='SITE'?'Site-wide / multi-department':scope.type==='DEPARTMENT'?deptLabel(scope.departmentId):'Scope not set';
      const current=state.user?.id===owner.userId;
      hint.className=scope.type==='UNSCOPED'||owner.missing||!current?'danger-note':'success-note';
      hint.innerHTML=scope.type==='UNSCOPED'
        ?'<strong>Scope required.</strong> Choose Everyone/site-wide or the correct Department before this review/approval.'
        :owner.missing
          ?`<strong>${esc(scopeName)}:</strong> ${esc(owner.label)}. This decision is blocked until the responsibility is assigned.`
          :`<strong>${esc(scopeName)} approval owner:</strong> ${esc(owner.label)}.${current?' You are the assigned responsible manager.':' This decision must be completed by that responsible manager.'}`;

      const action=saveVersion||saveReview||saveTbt;
      if(action){
        action.disabled=scope.type==='UNSCOPED'||owner.missing||!current;
        action.title=action.disabled?'Only the assigned responsible manager can complete this decision.':'';
      }
    }

    const modal=$('modal'),body=$('modalBody');
    if(body)new MutationObserver(()=>setTimeout(decorateApprovalModal,0)).observe(body,{childList:true,subtree:true});
    document.addEventListener('change',e=>{
      if(e.target?.closest?.('#approvalAudienceSection,#tbtApprovalAudienceAudienceSection'))setTimeout(decorateApprovalModal,0);
    },true);

    /* Re-decorate after the original Admin/Positions module refreshes. */
    function refreshDecorations(){
      ensureTree();
      decorateResponsibilities();
      decorateApprovalModal();
    }
    [250,700,1400,2500].forEach(ms=>setTimeout(refreshDecorations,ms));
    window.addEventListener('pageshow',()=>setTimeout(refreshDecorations,120));
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-admin-tile-v21083="locations"],[data-admin-tile-v21083="departments"],[data-management-tile-key="admin"],[data-view="admin"]'))setTimeout(refreshDecorations,120);
    },true);

    const admin=$('adminView');
    if(admin)new MutationObserver(()=>{clearTimeout(treeTimer);treeTimer=setTimeout(refreshDecorations,80);}).observe(admin,{childList:true,subtree:true});

    const style=document.createElement('style');
    style.id='responsibilityLocationStylesV21090';
    style.textContent=`
      .site-tree-toolbar-v21090{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
      .site-tree-toolbar-v21090 input[type="search"]{flex:1 1 240px;min-width:0}
      .site-tree-archived-toggle-v21090{margin:0}
      .site-tree-row-v21090{
        display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;
        padding:10px 8px 10px calc(8px + var(--tree-pad));border-bottom:1px solid var(--border,#3f4854)
      }
      .site-tree-node-v21090:last-child>.site-tree-row-v21090{border-bottom:0}
      .site-tree-toggle-v21090{width:32px;height:32px;padding:0;border:0;background:transparent;color:inherit;font-size:1.15rem}
      .site-tree-toggle-v21090:disabled{opacity:.45}
      .site-tree-main-v21090{min-width:0}
      .site-tree-main-v21090 strong{display:block;overflow-wrap:anywhere}
      .site-tree-actions-v21090{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .site-tree-children-v21090{border-left:2px solid rgba(111,155,197,.22)}
      .site-tree-archived-v21090>.site-tree-row-v21090{opacity:.68}
      .responsibility-summary-v21090-wrap{width:100%;margin-top:10px}
      .responsibility-summary-v21090{border-top:1px solid var(--border,#475569);padding-top:10px}
      .compact-note-v21090{padding:8px 10px}
      .responsibility-stats-v21090{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:9px 0}
      .responsibility-stats-v21090>div{border:1px solid var(--border,#475569);border-radius:10px;padding:8px;display:flex;flex-direction:column}
      .responsibility-stats-v21090 strong{font-size:1.15rem}
      .responsibility-stats-v21090 span{font-size:.72rem;color:var(--muted,#a6b1c2);line-height:1.2}
      .responsibility-due-list-v21090{display:grid;gap:6px}
      .responsibility-due-row-v21090{border:1px solid var(--border,#475569);border-left-width:4px;border-radius:9px;padding:8px 10px}
      .responsibility-due-row-v21090.traffic-red{border-left-color:#d33}
      .responsibility-due-row-v21090.traffic-amber{border-left-color:#b7791f}
      .responsibility-due-row-v21090.traffic-green{border-left-color:#2f855a}
      @media(max-width:760px){
        .site-tree-row-v21090{grid-template-columns:30px minmax(0,1fr);padding-left:calc(4px + var(--tree-pad))}
        .site-tree-actions-v21090{grid-column:2;justify-content:flex-start}
        .site-tree-actions-v21090 button{font-size:.78rem;padding:7px 9px}
        .responsibility-stats-v21090{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);

    attachTreeObserver();

    window.SafetyResponsibilityLocationV21090={
      renderLocationTree:()=>renderLocationTree(true),
      decorateResponsibilities,
      decorateApprovalModal
    };
  }

  boot();
})();