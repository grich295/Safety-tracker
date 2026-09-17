/* Safety Tracker v2.10.31 PTW stability hotfix + v2.10.33 PTW report privacy */
'use strict';
(function(){
  const core=window.SafetyTrackerV2;
  if(!core) return;
  const state=core.state;
  const sb=core.sb;
  const originalShowPortal=window.showContractorPortal;
  const originalReview=window.reviewPermitAfterSubmit;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const notify=msg=>{try{if(typeof window.toast==='function')return window.toast(msg)}catch(_e){} const t=$('toast');if(t){t.textContent=msg;t.hidden=false;setTimeout(()=>t.hidden=true,4000)}};
  const withTimeout=(promise,ms,message)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);

  function localLocationPath(id){
    const bits=[];let cur=(state.siteLocations||[]).find(x=>x.id===id),guard=0;
    while(cur&&guard++<20){bits.unshift(cur.name);cur=cur.parent_id?(state.siteLocations||[]).find(x=>x.id===cur.parent_id):null}
    return bits.join(' › ')||'Unknown location';
  }
  function asbestosRowsForLocation(id){
    const locs=state.siteLocations||[], parent=new Map(locs.map(x=>[x.id,x.parent_id]));
    const ancestors=new Set();let cur=parent.get(id),guard=0;
    while(cur&&guard++<20){ancestors.add(cur);cur=parent.get(cur)}
    return (state.asbestosEntries||[]).filter(e=>e.active!==false&&(e.location_id===id||(e.applies_to_descendants&&ancestors.has(e.location_id))));
  }
  function renderLocalAsbestos(id){
    const out=$('cpAsbestosResult'); if(!out) return;
    const loaded=(state.asbestosEntries||[]).some(x=>x.active!==false)||(state.asbestosSources||[]).some(x=>x.active!==false);
    const rows=asbestosRowsForLocation(id);
    if(!loaded){
      out.innerHTML='<div class="pending-use-warning"><strong>AMP/survey register not loaded yet.</strong> Do not assume the area is asbestos-free. Follow the stop-work rule for suspect material.</div>';
      return;
    }
    if(!rows.length){
      out.innerHTML='<div class="hint-box"><strong>No known ACM is recorded for this selected location in the current register.</strong><br>This does not confirm the area is asbestos-free. Stop work if suspect material is encountered.</div>';
      return;
    }
    out.innerHTML=rows.map(x=>`<div class="item-card compact traffic-amber"><strong>${esc(x.material||'Asbestos register item')}</strong><div class="meta"><span>${esc(x.identification_status||'')}</span><span>${esc(x.condition||'')}</span></div>${x.management_action?`<div>${esc(x.management_action)}</div>`:''}</div>`).join('');
  }

  window.showContractorPortal=async function(route='STAFF'){
    if(!state.user) return notify('Staff sign-in is required.');
    route='STAFF';
    const auth=$('authView'),app=$('appView'),demo=$('demoView'),view=$('contractorView'),box=$('contractorPortalContent');
    if(auth)auth.hidden=true;if(app)app.hidden=true;if(demo)demo.hidden=true;if(view)view.hidden=false;
    if(!box) return;
    box.innerHTML='<div class="loading-note"><strong>Preparing PTW form…</strong></div>';
    try{
      if(!(state.siteLocations||[]).length){
        const q=await withTimeout(sb.from('site_locations_v280').select('*').eq('active',true).order('sort_order').order('name'),8000,'PTW locations took too long to load. Check the connection and try again.');
        if(q.error) throw q.error;
        state.siteLocations=q.data||[];
      }
      const loaded=(state.asbestosEntries||[]).some(x=>x.active!==false)||(state.asbestosSources||[]).some(x=>x.active!==false);
      if(typeof window.renderContractorForm!=='function') throw new Error('PTW form code is not available. Refresh Safety Tracker once.');
      window.renderContractorForm(route,loaded);
      window.scrollTo({top:0,behavior:'auto'});
    }catch(e){
      console.error('PTW portal load',e);
      box.innerHTML=`<div class="danger-note"><strong>PTW form could not be opened.</strong><br>${esc(e?.message||'Unknown error')}</div><div class="actions"><button class="primary" type="button" id="ptwRetryOpen">Try again</button></div>`;
      $('ptwRetryOpen')?.addEventListener('click',()=>window.showContractorPortal('STAFF'),{once:true});
    }
  };

  document.addEventListener('change',e=>{
    if(e.target?.id!=='cpLocation') return;
    e.stopImmediatePropagation();
    const id=e.target.value;
    if(!id){const out=$('cpAsbestosResult');if(out)out.textContent='Select the work location to check the current register.';return}
    renderLocalAsbestos(id);
  },true);

  async function loadPermitOnly(id){
    const existing=(state.contractorPermits||[]).find(p=>p.id===id);
    if(existing?.work_description&&existing?.contractor_signin_signature) return existing;
    const q=await withTimeout(sb.from('contractor_permits_v280').select('*').eq('id',id).single(),10000,'PTW details took too long to load. Check the connection and try again.');
    if(q.error) throw q.error;
    const p=q.data;
    const i=(state.contractorPermits||[]).findIndex(x=>x.id===id);
    if(i>=0) state.contractorPermits[i]=p; else state.contractorPermits.push(p);
    try{
      const ev=await withTimeout(sb.from('contractor_permit_events_v280').select('*').eq('permit_id',id).order('occurred_at',{ascending:true}),7000,'PTW history load timed out.');
      if(!ev.error){state.contractorPermitEvents=(state.contractorPermitEvents||[]).filter(x=>x.permit_id!==id).concat(ev.data||[])}
    }catch(_e){}
    return p;
  }

  async function reviewFast(id,button){
    if(!id) return;
    const oldText=button?.textContent||'Review PTW now';
    if(button){button.disabled=true;button.textContent='Checking PTW…'}
    const modal=$('modal');
    if(modal?.open && !$('modalBody')?.textContent?.trim()) try{modal.close()}catch(_e){}
    try{
      await loadPermitOnly(id);
      if(typeof window.showPermitApproval!=='function') throw new Error('PTW approval screen is unavailable. Refresh Safety Tracker once.');
      window.showPermitApproval(id,true);
    }catch(e){
      console.error('PTW review',e);
      notify(e?.message||'Could not load the submitted PTW.');
      const box=$('contractorPortalContent');
      if(box){
        const existing=box.querySelector('#ptwReviewError');existing?.remove();
        const note=document.createElement('div');note.id='ptwReviewError';note.className='danger-note';note.innerHTML=`<strong>PTW review did not open.</strong><br>${esc(e?.message||'Please try again.')}`;
        box.appendChild(note);
      }
    }finally{
      if(button&&document.contains(button)){button.disabled=false;button.textContent=oldText}
    }
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('button[data-contractor-review-ptw]');
    if(!b) return;
    e.preventDefault();e.stopImmediatePropagation();
    reviewFast(b.dataset.contractorReviewPtw,b);
  },true);

  window.reviewPermitAfterSubmit=async function(id){return reviewFast(id,null)};
  window.__safetyPtwOriginalShowPortal=originalShowPortal;
  window.__safetyPtwOriginalReview=originalReview;
})();

/* v2.10.33 PTW report privacy: mask routine report identity, preserve original signed PTW */
(function(){
  const core=window.SafetyTrackerV2;
  if(!core?.state) return;

  if(window.SAFETY_BUILD){
    window.SAFETY_BUILD.version='2.10.33';
    window.SAFETY_BUILD.label='2.10.33 CLEAN';
    window.SAFETY_BUILD.build='21033';
    try{window.applySafetyBuildLabel?.()}catch(_e){}
  }
  try{core.APP_VERSION='2.10.33'}catch(_e){}

  const state=core.state;
  const originals={
    preview:window.renderPermitReportPreview||core.renderPermitReportPreview,
    pdf:window.downloadPermitReportPdf||core.downloadPermitReportPdf,
    csv:window.downloadPermitReportCsv||core.downloadPermitReportCsv,
    pdfDoc:window.permitReportPdfDoc
  };
  const $=id=>document.getElementById(id);
  const notify=msg=>{try{if(typeof window.toast==='function')return window.toast(msg)}catch(_e){} const t=$('toast');if(t){t.textContent=msg;t.hidden=false;setTimeout(()=>t.hidden=true,4000)}};

  function isManagerOrAdmin(){
    const p=state.profile||{};
    return p.report_only!==true&&['admin','manager'].includes(String(p.role||'').toLowerCase());
  }
  function maskPiece(piece){
    const chars=Array.from(String(piece||''));
    if(!chars.length) return '';
    if(chars.length===1) return chars[0]+'**';
    return chars[0]+'*'.repeat(Math.max(2,chars.length-1));
  }
  function maskName(name){
    const value=String(name||'').trim();
    if(!value) return '';
    return value.split(/(\s+|[-’'])/u).map(part=>/^(\s+|[-’'])$/u.test(part)?part:maskPiece(part)).join('');
  }
  function maskPermit(p){
    if(!p) return p;
    return {...p,
      contractor_name:maskName(p.contractor_name),
      contractor_signin_signed_name:maskName(p.contractor_signin_signed_name),
      contractor_signout_signed_name:maskName(p.contractor_signout_signed_name),
      contractor_signin_signature:null,
      contractor_signout_signature:null
    };
  }
  function includeFullIdentity(){return isManagerOrAdmin()&&$('permitReportFullIdentity')?.checked===true;}
  function withProtectedPermitState(fn){
    if(includeFullIdentity()) return fn();
    const originalPermits=state.contractorPermits;
    state.contractorPermits=(originalPermits||[]).map(maskPermit);
    try{return fn()}finally{state.contractorPermits=originalPermits}
  }
  function stampPrivacyFooter(result){
    if(includeFullIdentity()) return result;
    const doc=result?.doc||result;
    if(!doc?.getNumberOfPages||!doc?.setPage||!doc?.text) return result;
    try{
      const pages=doc.getNumberOfPages();
      for(let i=1;i<=pages;i++){
        doc.setPage(i);doc.setFontSize?.(7);
        doc.text('Privacy: contractor names are masked and digital signature images are omitted from this report. Full details remain in the original PTW record.',10,204,{maxWidth:275});
      }
    }catch(_e){}
    return result;
  }
  function renderPreviewProtected(){
    if(typeof originals.preview!=='function') return notify('PTW report preview is unavailable. Refresh Safety Tracker once.');
    const result=withProtectedPermitState(()=>originals.preview());ensurePrivacyControl();return result;
  }
  function downloadPdfProtected(){
    if(typeof originals.pdf!=='function') return notify('PTW PDF report is unavailable. Refresh Safety Tracker once.');
    if(includeFullIdentity()){notify('Full contractor identity/signatures enabled for this evidence export.');return originals.pdf();}
    return withProtectedPermitState(()=>originals.pdf());
  }
  function downloadCsvProtected(){
    if(typeof originals.csv!=='function') return notify('PTW CSV report is unavailable. Refresh Safety Tracker once.');
    if(includeFullIdentity()){notify('Full contractor identity enabled for this evidence export.');return originals.csv();}
    return withProtectedPermitState(()=>originals.csv());
  }
  if(typeof originals.pdfDoc==='function'){
    window.permitReportPdfDoc=function(){const result=withProtectedPermitState(()=>originals.pdfDoc());return stampPrivacyFooter(result);};
  }
  window.renderPermitReportPreview=renderPreviewProtected;
  window.downloadPermitReportPdf=downloadPdfProtected;
  window.downloadPermitReportCsv=downloadCsvProtected;
  core.renderPermitReportPreview=renderPreviewProtected;
  core.downloadPermitReportPdf=downloadPdfProtected;
  core.downloadPermitReportCsv=downloadCsvProtected;
  core.maskPtwReportName=maskName;

  function ensurePrivacyControl(){
    const anchor=$('permitReportCompany')||$('permitReportPreviewBtn')||$('permitReportPdfBtn');
    if(!anchor) return;
    if($('permitReportPrivacyBox')){
      const full=$('permitReportFullIdentity');if(full) full.closest('.ptw-full-identity-row').hidden=!isManagerOrAdmin();return;
    }
    const box=document.createElement('div');
    box.id='permitReportPrivacyBox';box.className='hint-box ptw-report-privacy-box';
    box.innerHTML=`<strong>Contractor privacy in PTW reports</strong>
      <div>Routine previews, PDF reports and CSV exports mask the contractor's first/last name (for example <strong>John Smith → J*** S****</strong>) and omit digital signature images. The original signed PTW record is not changed and keeps the full name and signatures.</div>
      <label class="check-row ptw-full-identity-row" style="margin-top:10px" ${isManagerOrAdmin()?'':'hidden'}>
        <input id="permitReportFullIdentity" type="checkbox"> Include full contractor names and digital signatures in this evidence export
      </label>
      <div id="permitReportPrivacyState" class="muted" style="margin-top:6px">Default: privacy-masked report.</div>`;
    const container=anchor.closest('.section-card')||anchor.parentElement;
    if(container){const filters=anchor.closest('.filters');if(filters) filters.insertAdjacentElement('afterend',box);else container.insertBefore(box,container.firstChild?.nextSibling||null);}
    $('permitReportFullIdentity')?.addEventListener('change',e=>{
      const stateText=$('permitReportPrivacyState');
      if(e.target.checked){
        if(!isManagerOrAdmin()){e.target.checked=false;return notify('Only Admin/Manager can include full contractor identity in PTW report exports.');}
        if(stateText) stateText.innerHTML='<strong>Evidence mode:</strong> full contractor identity/signatures will be included until this box is unticked or the page is refreshed.';
        notify('Full-identity PTW evidence export enabled.');
      }else{
        if(stateText) stateText.textContent='Default: privacy-masked report.';notify('PTW reports returned to privacy-masked mode.');
      }
      renderPreviewProtected();
    });
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.id==='permitReportPreviewBtn'){e.preventDefault();e.stopImmediatePropagation();renderPreviewProtected();$('permitReportSummary')?.scrollIntoView?.({behavior:'smooth',block:'start'});notify('Contractor permit report preview updated.');return;}
    if(button.id==='permitReportPdfBtn'){e.preventDefault();e.stopImmediatePropagation();downloadPdfProtected();return;}
    if(button.id==='permitReportCsvBtn'){e.preventDefault();e.stopImmediatePropagation();downloadCsvProtected();}
  },true);
  function installStyles(){
    if($('ptwReportPrivacyStyles'))return;
    const style=document.createElement('style');style.id='ptwReportPrivacyStyles';style.textContent=`
      .ptw-report-privacy-box{margin:12px 0;border-left:4px solid #5b7185}
      .ptw-report-privacy-box>div{margin-top:6px;line-height:1.45}
      .ptw-full-identity-row{background:#fff8e6;border:1px solid #e2be63;padding:10px;border-radius:10px}
      .ptw-full-identity-row input{width:auto;min-width:auto}`;document.head.appendChild(style);
  }
  installStyles();ensurePrivacyControl();
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'))ensurePrivacyControl();});
  observer.observe(document.body,{childList:true,subtree:true});
})();
