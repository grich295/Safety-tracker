/* Safety Tracker v2.10.31 PTW stability hotfix */
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

  // Open the contractor/PTW form from data already loaded in the signed-in app.
  // This removes the edge-function round trip that could leave Android devices
  // sitting on a blank/loading sheet before the form appeared.
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

  // Stop the original location handler from waiting on the permit Edge Function.
  // The same current asbestos/location rows are already present in app state.
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
    }catch(_e){/* history is helpful but must not block approval */}
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

  // Capture the review click before the old handler calls loadAll(), which reloads
  // the entire Safety Tracker and was the main cause of the apparent freeze.
  document.addEventListener('click',e=>{
    const b=e.target.closest('button[data-contractor-review-ptw]');
    if(!b) return;
    e.preventDefault();e.stopImmediatePropagation();
    reviewFast(b.dataset.contractorReviewPtw,b);
  },true);

  // If another part of the app calls the function directly, use the fast path too.
  window.reviewPermitAfterSubmit=async function(id){return reviewFast(id,null)};

  // Keep the original functions available for diagnostics/fallback without using them normally.
  window.__safetyPtwOriginalShowPortal=originalShowPortal;
  window.__safetyPtwOriginalReview=originalReview;
})();
