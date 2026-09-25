/* Safety Tracker v2.11.47 CLEAN
   - Fixes shared Inventory/Energy users visibility in Safety People.
   - Redirects all People entry points to the consolidated People & Access screen.
   - Replaces department-wide incident/policy review with targeted document review.
   - Relevant RA/COSHH/SSW/etc are chosen directly; only directly linked docs/TBT/training
     are pulled in automatically. No whole department is flagged.
*/
'use strict';
(function(){
  if(window.__SAFETY_V21147)return;
  window.__SAFETY_V21147=true;

  let api=null,state=null,sb=null,categories=[];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toLowerCase();
  const today=()=>new Date().toISOString().slice(0,10);
  const manager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase()) &&
    state?.profile?.report_only!==true && state?.uiMode!=='user';

  function toast(msg){try{api?.toast?.(msg)}catch(_e){console.log(msg)}}

  function docTypeLabel(t){
    return ({
      RISK_ASSESSMENT:'RA',
      COSHH:'COSHH RA',
      SSW:'SSW',
      SDS:'SDS',
      POLICY:'Policy',
      PROCEDURE:'Procedure',
      OTHER:'Other'
    })[String(t||'').toUpperCase()]||String(t||'Document');
  }

  function reviewDocs(){
    const priority={RISK_ASSESSMENT:0,COSHH:1,SSW:2,POLICY:3,PROCEDURE:4,OTHER:5,SDS:6};
    return (state?.documents||[])
      .filter(d=>String(d.status||'').toUpperCase()!=='ARCHIVED')
      .filter(d=>['RISK_ASSESSMENT','COSHH','SSW','POLICY','PROCEDURE','OTHER','SDS'].includes(String(d.doc_type||'').toUpperCase()))
      .sort((a,b)=>{
        const pa=priority[String(a.doc_type||'').toUpperCase()]??99;
        const pb=priority[String(b.doc_type||'').toUpperCase()]??99;
        if(pa!==pb)return pa-pb;
        return String(a.reference||a.title||'').localeCompare(String(b.reference||b.title||''),undefined,{numeric:true});
      });
  }

  async function loadCategories(){
    if(categories.length)return categories;
    const {data,error}=await sb.from('incident_review_categories_v21092').select('id,name,active,sort_order').eq('active',true).order('sort_order').order('name');
    if(!error)categories=data||[];
    return categories;
  }

  function modalHtml(){
    const docs=reviewDocs();
    const locs=(state?.siteLocations||[]).filter(x=>x.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    return `
      <div class="danger-note">
        <strong>Do not enter accident, medical or personal details here.</strong>
        This screen only records which controlled Safety documents need reviewing.
      </div>

      <div class="form-grid">
        <label>Reason
          <select id="targetReviewReasonV21147">
            <option value="Relevant accident / incident">Relevant accident / incident</option>
            <option value="Near miss">Near miss</option>
            <option value="Significant change">Significant change</option>
            <option value="Other review trigger">Other review trigger</option>
          </select>
        </label>
        <label>Date
          <input id="targetReviewDateV21147" type="date" value="${today()}">
        </label>
        <label>External reference <span class="muted">optional</span>
          <input id="targetReviewRefV21147" maxlength="80" placeholder="e.g. INC-2458">
        </label>
        <label>Category
          <select id="targetReviewCategoryV21147">
            <option value="">Other / not specified</option>
            ${categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <label class="full">Short non-personal note <span class="muted">optional</span>
          <textarea id="targetReviewNoteV21147" maxlength="500" rows="2" placeholder="e.g. Review controls after electrical incident — no names or medical details."></textarea>
        </label>
      </div>

      <div class="section-card">
        <h4>Relevant controlled document(s)</h4>
        <p class="muted">
          Select only the RA, COSHH RA, SSW or other document actually relevant to the event.
          Directly linked controlled documents and linked TBT/training are added automatically.
          <strong>No department-wide review is created.</strong>
        </p>
        <input id="targetReviewSearchV21147" type="search" placeholder="Search reference or title…">
        <div class="target-review-docs-v21147">
          ${docs.map(d=>{
            const text=`${d.reference||''} ${d.title||''} ${docTypeLabel(d.doc_type)}`.toLowerCase();
            return `<label class="check-row target-review-doc-row-v21147" data-search="${esc(text)}">
              <input type="checkbox" class="target-review-doc-v21147" value="${esc(d.id)}">
              <span>
                <strong>${esc(d.reference||docTypeLabel(d.doc_type))}${d.title?' — '+esc(d.title):''}</strong>
                <small>${esc(docTypeLabel(d.doc_type))}</small>
              </span>
            </label>`;
          }).join('')||'<div class="empty">No active controlled documents found.</div>'}
        </div>
      </div>

      ${locs.length?`<div class="section-card">
        <h4>Location <span class="muted">optional</span></h4>
        <select id="targetReviewLocationV21147">
          <option value="">Not specified</option>
          ${locs.map(l=>`<option value="${esc(l.id)}">${esc(l.name||'Location')}</option>`).join('')}
        </select>
      </div>`:''}

      <div id="targetReviewStatusV21147" class="message" hidden></div>
      <div class="actions">
        <button class="ghost" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="button" data-v21147-create-targeted>Create targeted review</button>
      </div>`;
  }

  async function openTargetReview(){
    if(!manager())return;
    await loadCategories();
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||!body)return;
    if(title)title.textContent='Targeted incident / policy review';
    body.innerHTML=modalHtml();
    if(!modal.open)modal.showModal();
  }

  async function createTargetReview(btn){
    const ids=[...document.querySelectorAll('.target-review-doc-v21147:checked')].map(x=>x.value);
    if(!ids.length)return toast('Select at least one relevant RA, COSHH RA, SSW or other controlled document.');

    const date=$('targetReviewDateV21147')?.value;
    if(!date)return toast('Enter the review trigger date.');

    btn.disabled=true;
    const old=btn.textContent;
    btn.textContent='Creating…';

    const reason=$('targetReviewReasonV21147')?.value||'Relevant accident / incident';
    const note=clean($('targetReviewNoteV21147')?.value);
    const combined=note?`${reason} — ${note}`:reason;
    const loc=$('targetReviewLocationV21147')?.value||null;

    const {data,error}=await sb.rpc('create_targeted_incident_review_v21147',{
      p_external_ref:clean($('targetReviewRefV21147')?.value)||null,
      p_trigger_date:date,
      p_primary_document_ids:ids,
      p_short_note:combined,
      p_category_id:$('targetReviewCategoryV21147')?.value||null,
      p_location_ids:loc?[loc]:[]
    });

    if(error){
      btn.disabled=false;btn.textContent=old;
      return toast(error.message);
    }

    const status=$('targetReviewStatusV21147');
    if(status){
      status.hidden=false;
      status.className='message success';
      status.innerHTML=`Review created: <strong>${Number(data?.selected_documents||ids.length)}</strong> selected document(s), <strong>${Number(data?.related_documents||0)}</strong> directly related document(s), and <strong>${Number(data?.linked_training||0)}</strong> linked TBT/training item(s).`;
    }

    btn.textContent='Created';
    try{await window.SafetyIncidentReviewV21092?.reload?.()}catch(_e){}
    toast('Targeted review created. No whole department was flagged.');
  }

  function decorateExistingPolicyCard(){
    const headings=[...document.querySelectorAll('h2,h3,h4')];
    const h=headings.find(x=>norm(x.textContent)==='trigger a policy review');
    if(!h)return;
    const card=h.closest('.section-card,.card')||h.parentElement;
    if(!card||card.dataset.v21147Targeted==='1')return;
    card.dataset.v21147Targeted='1';
    card.innerHTML=`
      <h3>Trigger a targeted policy / document review</h3>
      <p class="muted">
        Use this after a relevant accident/incident, near miss or significant change.
        Choose only the relevant RA/COSHH RA/SSW or other controlled document.
        Directly linked documents and TBT/training are included automatically.
      </p>
      <div class="hint-box"><strong>No department-wide review:</strong> this action will not flag every document owned by Maintenance, Housekeeping, Kitchen or another department.</div>
      <div class="actions">
        <button class="primary" type="button" data-v21147-open-targeted>Select relevant documents</button>
      </div>`;
  }

  function redirectPeopleEntry(e){
    const hit=e.target.closest?.(
      '#mainNav [data-view="people"],'+
      '[data-management-stable-action="view:people"],'+
      '[data-management-tile-key="people"]'
    );
    if(!hit)return false;
    if(!window.SafetyPeopleSitesV21146?.openPeople)return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.SafetyPeopleSitesV21146.openPeople();
    return true;
  }

  // Capture registered before v2.10.92's click listener because this file is loaded earlier.
  document.addEventListener('click',e=>{
    if(redirectPeopleEntry(e))return;

    if(e.target.closest?.('[data-inc92-new]')){
      e.preventDefault();e.stopImmediatePropagation();
      openTargetReview();return;
    }
    if(e.target.closest?.('[data-v21147-open-targeted]')){
      e.preventDefault();e.stopImmediatePropagation();
      openTargetReview();return;
    }
    const create=e.target.closest?.('[data-v21147-create-targeted]');
    if(create){
      e.preventDefault();e.stopImmediatePropagation();
      createTargetReview(create);return;
    }

    // Finite refresh when navigation changes; never observe the whole DOM.
    if(e.target.closest?.('#mainNav button,[data-management-tile-key],[data-management-stable-action]')){
      [120,450,1100].forEach(ms=>setTimeout(decorateExistingPolicyCard,ms));
    }
  },true);

  document.addEventListener('input',e=>{
    if(e.target?.id!=='targetReviewSearchV21147')return;
    const q=norm(e.target.value);
    document.querySelectorAll('.target-review-doc-row-v21147').forEach(row=>{
      row.hidden=!!q&&!String(row.dataset.search||'').includes(q);
    });
  },true);

  function installStyles(){
    if($('targetReviewStylesV21147'))return;
    const s=document.createElement('style');
    s.id='targetReviewStylesV21147';
    s.textContent=`
      .target-review-docs-v21147{
        max-height:340px;
        overflow:auto;
        border:1px solid var(--border,#475569);
        border-radius:10px;
        padding:8px;
        margin-top:8px
      }
      .target-review-doc-row-v21147{align-items:flex-start}
      .target-review-doc-row-v21147 span{display:flex;flex-direction:column;gap:2px}
      .target-review-doc-row-v21147 small{color:var(--muted,#94a3b8)}
    `;
    document.head.appendChild(s);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){
      setTimeout(boot,100);return;
    }
    state=api.state;sb=api.sb;
    installStyles();

    // The shared People mirror now has SELECT permission; force one finite reload
    // when the consolidated People screen already exists.
    [150,600,1500,3200].forEach(ms=>setTimeout(()=>{
      decorateExistingPolicyCard();
      try{
        if(document.getElementById('peopleV21146View')?.classList.contains('active-view')){
          window.SafetyPeopleSitesV21146?.openPeople?.();
        }
      }catch(_e){}
    },ms));

    window.addEventListener('pageshow',()=>setTimeout(decorateExistingPolicyCard,180));

    window.SafetyTargetedIncidentReviewV21147={open:openTargetReview};
  }

  boot();
})();
