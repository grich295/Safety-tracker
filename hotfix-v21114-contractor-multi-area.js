/* Safety Tracker v2.11.14 - contractor multi-area selector + asbestos risk colouring */
'use strict';
(function(){
  if(window.__SAFETY_CONTRACTOR_MULTI_AREA_V21114)return;
  window.__SAFETY_CONTRACTOR_MULTI_AREA_V21114=true;

  function boot(){
    if(typeof renderContractorForm!=='function' ||
       typeof submitContractorPortal!=='function' ||
       typeof invokePermit!=='function' ||
       !window.SafetyTrackerV2?.state){
      setTimeout(boot,120);
      return;
    }
    install();
  }

  function install(){
    const st=window.SafetyTrackerV2.state;
    const $x=id=>document.getElementById(id);
    const escx=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toastx=m=>{try{toast(m)}catch(_e){window.SafetyTrackerV2?.toast?.(m)}};

    const baseRender=renderContractorForm;
    const baseSubmit=submitContractorPortal;
    const baseInvoke=invokePermit;

    let selected=new Set();
    let risk=new Map();
    let inventoryPreview=null;
    let selectedPreview=null;
    let previewSeq=0;
    let inventorySeq=0;

    function activeLocations(){
      return (st.siteLocations||[]).filter(x=>x.active!==false);
    }
    function byId(){
      return new Map(activeLocations().map(x=>[x.id,x]));
    }
    function pathFor(id){
      try{return locationPath(id)||''}catch(_e){}
      const map=byId(),bits=[];let x=map.get(id),g=0;
      while(x&&g++<30){bits.unshift(x.name);x=x.parent_id?map.get(x.parent_id):null}
      return bits.join(' > ');
    }
    function ancestorIds(id){
      const map=byId(),out=[];let x=map.get(id),g=0;
      while(x?.parent_id&&g++<30){out.push(x.parent_id);x=map.get(x.parent_id)}
      return out;
    }
    function descendantIds(id){
      const rows=activeLocations(),children=new Map();
      rows.forEach(x=>{
        const k=x.parent_id||'';
        if(!children.has(k))children.set(k,[]);
        children.get(k).push(x.id);
      });
      const out=[],stack=[id],seen=new Set([id]);
      while(stack.length){
        const cur=stack.pop();
        for(const child of (children.get(cur)||[])){
          if(seen.has(child))continue;
          seen.add(child);out.push(child);stack.push(child);
        }
      }
      return out;
    }
    function setRisk(id,status,detail=''){
      const priority={KNOWN:5,NO_ACCESS:5,KNOWN_WITHIN:4,UNSURVEYED:3,CLEAR:1};
      const old=risk.get(id);
      if(!old || (priority[status]||0)>(priority[old.status]||0)){
        risk.set(id,{status,detail});
      }
    }
    function riskLabel(r){
      if(!r)return {label:'',tone:'neutral'};
      if(r.status==='KNOWN')return {label:'KNOWN ACM',tone:'red'};
      if(r.status==='NO_ACCESS')return {label:'NO ACCESS / INCOMPLETE',tone:'red'};
      if(r.status==='KNOWN_WITHIN')return {label:'KNOWN ACM WITHIN AREA',tone:'red'};
      if(r.status==='UNSURVEYED')return {label:'SURVEY COVERAGE INCOMPLETE',tone:'amber'};
      if(r.status==='CLEAR')return {label:'SURVEYED · NO CURRENT ACM',tone:'green'};
      return {label:'',tone:'neutral'};
    }
    function isRed(id){
      const s=risk.get(id)?.status;
      return ['KNOWN','NO_ACCESS','KNOWN_WITHIN'].includes(s);
    }

    async function loadRiskInventory(){
      const seq=++inventorySeq;
      const ids=activeLocations().map(x=>x.id);
      risk.clear();
      if(!ids.length){renderSelectionSummary();return}

      try{
        const a=await baseInvoke('asbestos_preview',{location_ids:ids});
        if(seq!==inventorySeq)return;
        inventoryPreview=a;

        (a.surveyed_no_acm_rooms||[]).forEach(x=>setRisk(x.id,'CLEAR'));
        (a.uncovered_rooms||[]).forEach(x=>setRisk(x.id,'UNSURVEYED'));
        (a.incomplete_rooms||[]).forEach(x=>setRisk(x.id,'NO_ACCESS'));
        (a.affected_rooms||[]).forEach(x=>setRisk(x.id,'KNOWN'));

        for(const row of (a.rows||[])){
          const status=String(row.record_kind||'').toUpperCase()==='NO_ACCESS'?'NO_ACCESS':'KNOWN';
          if(row.location_id)setRisk(row.location_id,status,row.material||'');
          if(row.applies_to_descendants&&row.location_id){
            descendantIds(row.location_id).forEach(id=>setRisk(id,status,row.material||''));
          }
        }

        /* Selecting a parent/floor means the work scope includes its children,
           so flag the parent red if any child contains a known/no-access item. */
        const redIds=[...risk.entries()]
          .filter(([,r])=>['KNOWN','NO_ACCESS'].includes(r.status))
          .map(([id])=>id);
        redIds.forEach(id=>{
          ancestorIds(id).forEach(aid=>{
            if(!['KNOWN','NO_ACCESS'].includes(risk.get(aid)?.status||'')){
              setRisk(aid,'KNOWN_WITHIN');
            }
          });
        });
      }catch(e){
        console.warn('v2.11.14 location risk inventory',e);
      }finally{
        if(seq===inventorySeq){
          renderSelectionSummary();
          refreshOpenPicker();
        }
      }
    }

    function makePickerHtml(){
      const rows=activeLocations()
        .slice()
        .sort((a,b)=>pathFor(a.id).localeCompare(pathFor(b.id)));

      return `<div class="section-card cp-location-picker-v21114">
        <div class="row-between">
          <div>
            <h3>Select work areas</h3>
            <p class="muted">Select every room/area covered by this job. Known or unresolved asbestos locations are highlighted red before you continue.</p>
          </div>
          <span id="cpLocationCountV21114" class="badge neutral">${selected.size} selected</span>
        </div>
        <input id="cpLocationSearchV21114" type="search" placeholder="Search room, floor or area…" autocomplete="off">
        <div id="cpLocationRowsV21114" class="cp-location-rows-v21114">
          ${rows.map(loc=>{
            const r=risk.get(loc.id),lab=riskLabel(r),checked=selected.has(loc.id);
            return `<label class="cp-location-row-v21114 traffic-${lab.tone}" data-cp-location-row-v21114 data-search="${escx(pathFor(loc.id).toLowerCase())}">
              <input type="checkbox" data-cp-location-choice-v21114 value="${escx(loc.id)}" ${checked?'checked':''}>
              <span class="cp-location-copy-v21114">
                <strong>${escx(pathFor(loc.id))}</strong>
                <small>${escx(String(loc.location_type||'AREA').replaceAll('_',' '))}</small>
              </span>
              ${lab.label?`<span class="badge ${lab.tone==='red'?'overdue':lab.tone==='amber'?'due':lab.tone==='green'?'complete':'neutral'}">${escx(lab.label)}</span>`:''}
            </label>`;
          }).join('')}
        </div>
        <div class="actions">
          <button type="button" class="ghost" data-cp-locations-cancel-v21114>Cancel</button>
          <button type="button" class="primary" data-cp-locations-apply-v21114>Use selected areas</button>
        </div>
      </div>`;
    }

    function openPicker(){
      const modal=$x('modal'),title=$x('modalTitle'),body=$x('modalBody');
      if(!modal||!body)return;
      if(title)title.textContent='Work areas';
      body.innerHTML=makePickerHtml();
      if(!modal.open)modal.showModal();
      setTimeout(()=>$x('cpLocationSearchV21114')?.focus({preventScroll:true}),50);
    }

    function refreshOpenPicker(){
      const rows=$x('cpLocationRowsV21114');
      if(!rows)return;
      const search=$x('cpLocationSearchV21114')?.value||'';
      const body=$x('modalBody');
      if(!body)return;
      const oldScroll=rows.scrollTop;
      const checked=new Set([...body.querySelectorAll('[data-cp-location-choice-v21114]:checked')].map(x=>x.value));
      const oldSelected=selected;
      selected=checked;
      body.innerHTML=makePickerHtml();
      selected=oldSelected;
      const searchEl=$x('cpLocationSearchV21114');
      if(searchEl){searchEl.value=search;filterPicker(search)}
      const newRows=$x('cpLocationRowsV21114');
      if(newRows)newRows.scrollTop=oldScroll;
    }

    function filterPicker(value){
      const q=String(value||'').trim().toLowerCase();
      document.querySelectorAll('[data-cp-location-row-v21114]').forEach(row=>{
        row.hidden=!!q&&!String(row.dataset.search||'').includes(q);
      });
    }

    function selectedIds(){
      return [...selected].filter(id=>activeLocations().some(x=>x.id===id));
    }

    function renderSelectionSummary(){
      const box=$x('cpLocationSelectedV21114');
      const count=$x('cpLocationButtonCountV21114');
      if(count)count.textContent=selected.size?`${selected.size} selected`:'Choose areas';
      if(!box)return;

      const ids=selectedIds();
      if(!ids.length){
        box.className='hint-box';
        box.innerHTML='<strong>No work areas selected.</strong> Select every area covered by the job.';
        return;
      }

      const red=ids.filter(isRed);
      const amber=ids.filter(id=>risk.get(id)?.status==='UNSURVEYED');
      box.className=red.length?'danger-note':amber.length?'pending-use-warning':'hint-box';
      box.innerHTML=`<strong>${ids.length} work area${ids.length===1?'':'s'} selected.</strong>
        ${red.length?`<br><strong>⛔ ${red.length} selected area${red.length===1?'':'s'} contain known/unresolved asbestos information.</strong>`:''}
        ${amber.length?`<br>${amber.length} selected area${amber.length===1?' has':'s have'} incomplete survey coverage.`:''}
        <div class="cp-selected-list-v21114">
          ${ids.map(id=>{
            const r=riskLabel(risk.get(id));
            return `<div class="cp-selected-chip-v21114 traffic-${r.tone}">
              <span>${escx(pathFor(id))}</span>
              ${r.label?`<strong>${escx(r.label)}</strong>`:''}
              <button type="button" class="ghost small" data-cp-location-remove-v21114="${escx(id)}">Remove</button>
            </div>`;
          }).join('')}
        </div>`;
    }

    async function refreshSelectedPreview(){
      const ids=selectedIds();
      const result=$x('cpAsbestosResult');
      const ack=$x('cpAsbestosAck');
      const seq=++previewSeq;
      selectedPreview=null;

      if(ack){ack.checked=false;ack.disabled=true}
      if(!ids.length){
        if(result)result.innerHTML='<div class="pending-use-warning"><strong>Select at least one work area.</strong></div>';
        return;
      }

      if(result)result.innerHTML='Checking asbestos information for all selected work areas…';
      try{
        const a=await baseInvoke('asbestos_preview',{location_ids:ids});
        if(seq!==previewSeq)return;
        selectedPreview=a;

        const redSelected=ids.filter(isRed);
        let html='';
        if(redSelected.length){
          html+=`<div class="danger-note"><strong>⛔ KNOWN / UNRESOLVED ASBESTOS INFORMATION IN SELECTED WORK SCOPE.</strong><br>
          ${redSelected.map(id=>escx(pathFor(id))).join('<br>')}
          <br><br>Do not drill, cut, sand, scrape, chase, lift or otherwise disturb relevant building fabric until the asbestos information and task controls have been reviewed.</div>`;
        }

        if(a.status==='NOT_LOADED'){
          html+='<div class="pending-use-warning"><strong>AMP/survey register not loaded yet.</strong> Do not assume any selected area is asbestos-free. Stop work if suspect material is encountered.</div>';
        }else if(a.status==='IMPORT_REVIEW_REQUIRED'||a.status==='REGISTER_NOT_READY'){
          html+='<div class="danger-note"><strong>Asbestos register is not ready for reliance.</strong> A source/import still needs review.</div>';
        }else if(a.status==='LOCATION_INFORMATION_INCOMPLETE'){
          html+='<div class="danger-note"><strong>Asbestos information is incomplete for part of this work scope.</strong> Treat inaccessible/uninspected areas as potentially containing asbestos.</div>';
        }

        if((a.rows||[]).length){
          html+=(a.rows||[]).map(x=>`<div class="item-card compact traffic-red">
            <strong>${escx(x.location_path||pathFor(x.location_id))}</strong>
            <div><strong>${escx(x.material||'Asbestos register item')}</strong></div>
            <div class="meta"><span>${escx(x.identification_status||x.record_kind||'')}</span>${x.condition?`<span>${escx(x.condition)}</span>`:''}</div>
            ${x.management_action?`<div>${escx(x.management_action)}</div>`:''}
            ${x.source_page?`<div class="muted">Source page ${escx(x.source_page)}</div>`:''}
          </div>`).join('');
        }else if(!redSelected.length){
          html+='<div class="hint-box"><strong>No current ACM record was returned for the selected work scope.</strong><br>This is not a declaration that the building fabric is asbestos-free. Stop work if suspect material or different conditions are encountered.</div>';
        }

        const roomBits=[];
        if(Number(a.room_count||0))roomBits.push(`${a.room_count} room${Number(a.room_count)===1?'':'s'} in scope`);
        if(Number(a.acm_room_count||0))roomBits.push(`${a.acm_room_count} with known/presumed ACM`);
        if(Number(a.incomplete_room_count||0))roomBits.push(`${a.incomplete_room_count} incomplete/no-access`);
        if(roomBits.length)html+=`<div class="hint-box"><strong>Scope summary:</strong> ${escx(roomBits.join(' · '))}</div>`;

        if(result)result.innerHTML=html;
        if(ack)ack.disabled=false;
      }catch(e){
        if(seq!==previewSeq)return;
        if(result)result.innerHTML=`<div class="danger-note"><strong>Could not verify all selected areas.</strong><br>${escx(e?.message||e)}</div>`;
      }
    }

    function applySelection(ids){
      selected=new Set(ids);
      const hidden=$x('cpLocation');
      const list=selectedIds();
      if(hidden)hidden.value=list[0]||'';
      renderSelectionSummary();
      refreshSelectedPreview();
    }

    function enhanceForm(){
      const select=$x('cpLocation');
      if(!select||$x('cpLocationsV21114'))return;

      const label=select.closest('label');
      if(label)label.hidden=true;

      const wrap=document.createElement('div');
      wrap.id='cpLocationsV21114';
      wrap.className='full cp-locations-v21114';
      wrap.innerHTML=`<label>Work areas</label>
        <button id="cpLocationsButtonV21114" type="button" class="secondary cp-locations-button-v21114" data-cp-locations-open-v21114>
          Select one or more work areas
          <span id="cpLocationButtonCountV21114" class="badge neutral">Choose areas</span>
        </button>
        <div id="cpLocationSelectedV21114" class="hint-box"><strong>No work areas selected.</strong> Select every area covered by the job.</div>`;

      (label||select).insertAdjacentElement('afterend',wrap);

      selected=new Set(select.value?[select.value]:[]);
      selectedPreview=null;
      inventoryPreview=null;
      risk.clear();

      const ack=$x('cpAsbestosAck');
      if(ack){ack.checked=false;ack.disabled=true}

      renderSelectionSummary();
      loadRiskInventory().then(()=>{
        renderSelectionSummary();
        if(selected.size)refreshSelectedPreview();
      });
    }

    renderContractorForm=function(route,asbestosLoaded){
      const out=baseRender.apply(this,arguments);
      enhanceForm();
      return out;
    };
    try{window.renderContractorForm=renderContractorForm}catch(_e){}

    submitContractorPortal=async function(route){
      const ids=selectedIds();
      if(!ids.length)return toastx('Select at least one work area.');
      if(!selectedPreview?.scope_fingerprint){
        return toastx('Wait for the asbestos/location check to finish before signing in.');
      }

      const previewIds=[...(selectedPreview.selected_location_ids||[])].sort();
      const nowIds=[...ids].sort();
      if(JSON.stringify(previewIds)!==JSON.stringify(nowIds)){
        return toastx('The selected work areas changed. Review the asbestos/location information again.');
      }

      const hidden=$x('cpLocation');
      if(hidden)hidden.value=ids[0];

      const originalInvoke=invokePermit;
      invokePermit=async function(action,payload={}){
        if(action==='submit_public'||action==='submit_staff'){
          const first=activeLocations().find(x=>x.id===ids[0]);
          payload={
            ...payload,
            location_ids:ids,
            location_text:ids.map(pathFor).join(' · '),
            work_scope_type:ids.length>1
              ?'MULTIPLE'
              :(first?.location_type==='ROOM'?'GUEST_ROOM'
                :first?.location_type==='FLOOR'?'GUEST_FLOOR'
                :first?.location_type==='GUEST_ROOMS'?'ALL_GUEST_ROOMS':'LOCATION'),
            asbestos_scope_fingerprint:selectedPreview.scope_fingerprint
          };
        }
        return originalInvoke(action,payload);
      };
      try{
        return await baseSubmit.apply(this,arguments);
      }finally{
        invokePermit=originalInvoke;
      }
    };
    try{window.submitContractorPortal=submitContractorPortal}catch(_e){}

    document.addEventListener('click',e=>{
      const open=e.target.closest?.('[data-cp-locations-open-v21114]');
      if(open){e.preventDefault();e.stopImmediatePropagation();openPicker();return}

      const cancel=e.target.closest?.('[data-cp-locations-cancel-v21114]');
      if(cancel){e.preventDefault();e.stopImmediatePropagation();try{$x('modal')?.close()}catch(_e){}return}

      const apply=e.target.closest?.('[data-cp-locations-apply-v21114]');
      if(apply){
        e.preventDefault();e.stopImmediatePropagation();
        const ids=[...document.querySelectorAll('[data-cp-location-choice-v21114]:checked')].map(x=>x.value);
        applySelection(ids);
        try{$x('modal')?.close()}catch(_e){}
        return;
      }

      const remove=e.target.closest?.('[data-cp-location-remove-v21114]');
      if(remove){
        e.preventDefault();e.stopImmediatePropagation();
        const ids=selectedIds().filter(id=>id!==remove.dataset.cpLocationRemoveV21114);
        applySelection(ids);
        return;
      }
    },true);

    document.addEventListener('input',e=>{
      if(e.target?.id==='cpLocationSearchV21114')filterPicker(e.target.value);
    },true);

    const style=document.createElement('style');
    style.id='contractorMultiAreaStylesV21114';
    style.textContent=`
      .cp-locations-v21114{display:grid;gap:8px}
      .cp-locations-button-v21114{width:100%;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left}
      .cp-selected-list-v21114{display:grid;gap:7px;margin-top:10px}
      .cp-selected-chip-v21114{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--border,#475569);border-radius:10px}
      .cp-selected-chip-v21114.traffic-red{border-color:#d33;background:rgba(160,25,25,.10)}
      .cp-selected-chip-v21114.traffic-amber{border-color:#b7791f;background:rgba(180,120,20,.08)}
      .cp-selected-chip-v21114.traffic-green{border-color:#2d6a4f;background:rgba(45,106,79,.08)}
      .cp-location-picker-v21114{margin:0}
      .cp-location-rows-v21114{max-height:58vh;overflow:auto;display:grid;gap:7px;margin:10px 0;padding-right:2px}
      .cp-location-row-v21114{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--border,#475569);border-radius:12px}
      .cp-location-row-v21114.traffic-red{border:2px solid #d33;background:rgba(160,25,25,.12)}
      .cp-location-row-v21114.traffic-amber{border-color:#b7791f;background:rgba(180,120,20,.08)}
      .cp-location-row-v21114.traffic-green{border-color:#2d6a4f}
      .cp-location-copy-v21114{display:flex;flex-direction:column;gap:3px;min-width:0}
      .cp-location-copy-v21114 strong{overflow-wrap:anywhere}
      .cp-location-copy-v21114 small{color:var(--muted,#a6b1c2)}
      @media(max-width:620px){
        .cp-location-row-v21114{grid-template-columns:auto minmax(0,1fr)}
        .cp-location-row-v21114>.badge{grid-column:2;justify-self:start}
        .cp-selected-chip-v21114{grid-template-columns:1fr}
        .cp-selected-chip-v21114 button{justify-self:start}
      }
    `;
    document.head.appendChild(style);

    /* If the contractor form was already open when this hotfix finished loading. */
    setTimeout(enhanceForm,50);

    window.SafetyContractorMultiAreaV21114={
      selected:()=>selectedIds(),
      refreshRisks:loadRiskInventory,
      refreshPreview:refreshSelectedPreview
    };
  }

  boot();
})();
