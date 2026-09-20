/* Safety Tracker v2.11.5 - asbestos User access, evidence snapshots and audit trail */
'use strict';
(function(){
  if(window.__SAFETY_ASBESTOS_EVIDENCE_AUDIT_V2115)return;
  window.__SAFETY_ASBESTOS_EVIDENCE_AUDIT_V2115=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    const view=document.getElementById('asbestosView');
    if(!core||!core.state||!core.sb||!view){
      setTimeout(boot,120);return;
    }
    install(core,view);
  }

  function install(core,view){
    const st=core.state,sb=core.sb;
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const uniq=a=>[...new Set((a||[]).filter(Boolean))];
    const toast=m=>{try{core.toast?.(m)}catch(_e){}};
    let evidenceBusy=false;
    let contractorPreviewToken=0;
    let accessTimer=0;
    const signedCache=new Map();

    function actualRole(){return String(st.profile?.role||'').toLowerCase()}
    function actualManager(){return st.profile&&st.profile.report_only!==true&&['admin','manager'].includes(actualRole())}
    function maintenanceEligible(){
      if(!st.user||!st.profile||st.profile.report_only===true)return false;
      if(actualManager())return true;
      const ids=new Set((st.userDepartments||[]).filter(x=>x.user_id===st.user.id).map(x=>x.department_id));
      return (st.departments||[]).some(d=>ids.has(d.id)&&d.active!==false&&String(d.name||'').trim().toLowerCase()==='maintenance');
    }

    function ensureUserAsbestosAccess(){
      if(!maintenanceEligible())return false;
      const uid=st.user.id;
      let row=(st.userViewPreferences||[]).find(x=>x.user_id===uid&&x.view_key==='asbestos');
      if(row)row.enabled=true;
      else{
        if(!Array.isArray(st.userViewPreferences))st.userViewPreferences=[];
        st.userViewPreferences.push({user_id:uid,view_key:'asbestos',enabled:true,updated_at:new Date().toISOString(),updated_by:uid});
      }
      const nav=$('asbestosNavBtn');
      if(nav)nav.hidden=false;
      return true;
    }

    function scheduleAccess(){
      clearTimeout(accessTimer);
      accessTimer=setTimeout(ensureUserAsbestosAccess,30);
    }

    function loc(id){return (st.siteLocations||[]).find(x=>x.id===id)||null}
    function locPath(id){
      const bits=[];let x=loc(id),g=0;
      while(x&&g++<30){bits.unshift(x.name||'');x=x.parent_id?loc(x.parent_id):null}
      return bits.filter(Boolean).join(' > ');
    }

    function currentRows(locationId){
      if(!locationId)return [];
      const ancestors=new Set();let x=loc(locationId)?.parent_id,g=0;
      while(x&&g++<30){ancestors.add(x);x=loc(x)?.parent_id||null}
      return (st.asbestosEntries||[]).filter(e=>{
        if(e.active===false)return false;
        const life=String(e.lifecycle_status||'PRESENT').toUpperCase();
        if(!['PRESENT','UNKNOWN'].includes(life))return false;
        return e.location_id===locationId||(e.applies_to_descendants&&ancestors.has(e.location_id));
      });
    }

    function sourceFor(id){return (st.asbestosSources||[]).find(s=>s.id===id)||null}
    function pageNo(v){const m=String(v??'').match(/\d+/);return m?Number(m[0]):null}

    async function logAccess(kind,locationId,rows,status,details={}){
      if(!maintenanceEligible())return null;
      const rr=Array.isArray(rows)?rows:[];
      const params={
        p_view_kind:kind,
        p_location_id:locationId||null,
        p_location_path:locationId?locPath(locationId):null,
        p_result_status:status||null,
        p_entry_ids:uniq(rr.map(x=>x.id)),
        p_source_document_ids:uniq(rr.map(x=>x.source_document_id)),
        p_source_pages:uniq(rr.map(x=>x.source_page!=null?String(x.source_page):null)),
        p_details:{...details,entry_count:rr.length,client_build:'2.11.5'}
      };
      const r=await sb.rpc('log_asbestos_register_view_v2115',params);
      if(r.error)throw r.error;
      return r.data||null;
    }

    async function signed(path){
      if(!path)return null;
      const cached=signedCache.get(path);
      if(cached&&cached.expires>Date.now())return cached.url;
      const r=await sb.storage.from('safety-files').createSignedUrl(path,900);
      if(r.error||!r.data?.signedUrl)return null;
      signedCache.set(path,{url:r.data.signedUrl,expires:Date.now()+12*60*1000});
      return r.data.signedUrl;
    }

    async function snippetRows(entryIds){
      const ids=uniq(entryIds);
      if(!ids.length)return [];
      const out=[];
      for(let i=0;i<ids.length;i+=80){
        const r=await sb.from('asbestos_evidence_snippets_v21080')
          .select('id,entry_id,source_document_id,source_page,excerpt,image_storage_path,image_mime,image_width,image_height,evidence_kind')
          .in('entry_id',ids.slice(i,i+80))
          .order('source_page',{ascending:true});
        if(r.error)throw r.error;
        out.push(...(r.data||[]));
      }
      return out;
    }

    async function evidenceMapFor(rows){
      const snippets=await snippetRows(rows.map(x=>x.id));
      const map=new Map();
      for(const sn of snippets){
        if(!map.has(sn.entry_id)||(!map.get(sn.entry_id).image_storage_path&&sn.image_storage_path))map.set(sn.entry_id,sn);
      }
      for(const [id,sn] of map){
        sn.preview_url=sn.image_storage_path?await signed(sn.image_storage_path):null;
      }
      return map;
    }

    function ensureDialog(){
      let d=$('asbestosEvidenceDialogV2115');
      if(d)return d;
      d=document.createElement('dialog');
      d.id='asbestosEvidenceDialogV2115';
      d.className='asb-evidence-dialog-v2115';
      d.innerHTML=`<div class="asb-evidence-dialog-inner-v2115">
        <div class="row-between"><strong id="asbEvidenceDialogTitleV2115">Source evidence</strong><button type="button" class="ghost small" data-asb-evidence-close>Close</button></div>
        <img id="asbEvidenceDialogImageV2115" alt="Asbestos source page snapshot">
        <div id="asbEvidenceDialogMetaV2115" class="muted"></div>
      </div>`;
      document.body.appendChild(d);
      return d;
    }

    function openEvidence(url,title,meta){
      const d=ensureDialog(),img=$('asbEvidenceDialogImageV2115');
      if(img)img.src=url||'';
      const t=$('asbEvidenceDialogTitleV2115');if(t)t.textContent=title||'Source evidence';
      const m=$('asbEvidenceDialogMetaV2115');if(m)m.textContent=meta||'';
      if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','open');
    }

    async function sourceStoragePath(source){
      if(!source)return null;
      if(source.linked_document_version_id){
        const r=await sb.from('document_versions').select('storage_path').eq('id',source.linked_document_version_id).maybeSingle();
        if(!r.error&&r.data?.storage_path)return r.data.storage_path;
      }
      return source.storage_path||null;
    }

    async function openSourcePage(sourceId,page,locationId,entry){
      const src=sourceFor(sourceId);
      if(!src)return toast('Asbestos source document is not available.');
      try{
        await logAccess('SOURCE_OPEN',locationId,entry?[entry]:[],entry?'SOURCE_PAGE_OPEN':'SOURCE_OPEN',{source_id:sourceId,page:String(page||'')});
      }catch(e){console.warn('Asbestos source-open audit',e)}
      try{
        const path=await sourceStoragePath(src);
        if(!path)throw new Error('Stored source PDF not found.');
        const r=await sb.storage.from('safety-files').download(path);
        if(r.error||!r.data)throw(r.error||new Error('Could not open source PDF.'));
        const url=URL.createObjectURL(r.data);
        const target=page?url+'#page='+encodeURIComponent(page):url;
        const w=window.open(target,'_blank');
        if(!w)location.href=target;
        setTimeout(()=>URL.revokeObjectURL(url),180000);
      }catch(e){toast(e?.message||'Could not open asbestos source PDF.')}
    }

    function statusForRows(rows){
      if(!rows.length)return 'NO_CURRENT_ACM';
      if(rows.some(x=>String(x.record_kind||'ACM').toUpperCase()==='NO_ACCESS'))return 'INCOMPLETE_INFORMATION';
      return 'ACM_INFORMATION_SHOWN';
    }

    async function renderEnhancedLookup(doLog=false){
      const sel=$('asbestosLocationSelect'),list=$('asbestosLookupList'),summary=$('asbestosLookupSummary');
      if(!sel||!list)return;
      const id=sel.value;
      if(!id)return;
      const rows=currentRows(id);
      let map=new Map();
      try{map=await evidenceMapFor(rows)}catch(e){console.warn('Asbestos evidence lookup',e)}

      list.innerHTML=rows.map(e=>{
        const src=sourceFor(e.source_document_id);
        const sn=map.get(e.id);
        const page=e.source_page||sn?.source_page||null;
        const title=src?.title||'Asbestos source';
        const thumb=sn?.preview_url?`
          <button type="button" class="asb-evidence-thumb-v2115" data-asb-evidence-open="${esc(e.id)}" data-asb-evidence-url="${esc(sn.preview_url)}" data-asb-evidence-title="${esc(e.material||'Asbestos evidence')}" data-asb-evidence-meta="${esc(title+(page?' · page '+page:''))}">
            <img src="${esc(sn.preview_url)}" alt="Source page snapshot for ${esc(e.material||'asbestos record')}">
            <span>Tap to enlarge source snapshot</span>
          </button>`:
          `<div class="asb-evidence-missing-v2115">Source page snapshot ${page?'for page '+esc(page):''} is not stored yet.</div>`;
        const sourceButton=src?`<button type="button" class="secondary small" data-asb-source-page="${esc(src.id)}" data-asb-source-page-no="${esc(page||'')}" data-asb-entry-id="${esc(e.id)}">Open source${page?' · page '+esc(page):''}</button>`:'';
        return `<div class="item-card traffic-card traffic-amber asb-entry-v2115">
          <h4>${esc(e.material||'Asbestos register item')}</h4>
          <div class="meta">
            ${e.identification_status?`<span>${esc(e.identification_status)}</span>`:''}
            ${e.asbestos_type?`<span>${esc(e.asbestos_type)}</span>`:''}
            ${e.condition?`<span>Condition: ${esc(e.condition)}</span>`:''}
          </div>
          ${e.precise_location?`<p><strong>Precise location:</strong> ${esc(e.precise_location)}</p>`:''}
          ${e.extent?`<p><strong>Extent:</strong> ${esc(e.extent)}</p>`:''}
          ${e.management_action?`<p><strong>Management action:</strong> ${esc(e.management_action)}</p>`:''}
          ${src?`<p class="muted"><strong>Source:</strong> ${esc(title)}${page?' · page '+esc(page):''}</p>`:''}
          ${thumb}
          ${sourceButton?`<div class="actions">${sourceButton}</div>`:''}
        </div>`;
      }).join('');

      if(doLog){
        try{
          await logAccess('LOOKUP',id,rows,statusForRows(rows),{screen:'ASBESTOS_LOOKUP'});
          let note=$('asbestosLookupAuditNoteV2115');
          if(!note){
            note=document.createElement('div');
            note.id='asbestosLookupAuditNoteV2115';
            note.className='success-note asb-audit-note-v2115';
            summary?.insertAdjacentElement('afterend',note);
          }
          note.innerHTML=`<strong>Register check logged.</strong> ${esc(locPath(id))} · ${new Date().toLocaleString('en-GB')}`;
          setTimeout(renderAuditCard,150);
        }catch(e){
          console.error('Asbestos lookup audit log failed',e);
          toast('Asbestos information shown, but the register-view audit log could not be saved.');
          let note=$('asbestosLookupAuditNoteV2115');
          if(!note){
            note=document.createElement('div');note.id='asbestosLookupAuditNoteV2115';
            summary?.insertAdjacentElement('afterend',note);
          }
          note.className='danger-note asb-audit-note-v2115';
          note.innerHTML='<strong>Audit log failed.</strong> The asbestos information is visible, but this lookup was not recorded.';
        }
      }
    }

    async function renderAuditCard(){
      let card=$('asbestosAccessAuditCardV2115');
      const show=actualManager()&&st.uiMode!=='user'&&!st.offline;
      if(!show){if(card)card.hidden=true;return}
      if(!card){
        card=document.createElement('div');
        card.id='asbestosAccessAuditCardV2115';
        card.className='section-card';
        card.innerHTML=`<div class="row-between"><div><h3>Asbestos register access log</h3><p class="muted">Who checked the register, when, which location and what was shown.</p></div><button type="button" class="secondary small" data-asb-audit-refresh>Refresh</button></div><div id="asbestosAccessAuditListV2115" class="card-list"><div class="muted">Loading…</div></div>`;
        view.appendChild(card);
      }
      card.hidden=false;
      const list=$('asbestosAccessAuditListV2115');if(!list)return;
      const r=await sb.from('asbestos_register_access_log_v2115')
        .select('id,viewed_at,user_id,view_kind,location_path,result_status,entry_ids,source_document_ids,source_pages,details')
        .order('viewed_at',{ascending:false}).limit(50);
      if(r.error){list.innerHTML=`<div class="danger-note">${esc(r.error.message)}</div>`;return}
      const name=id=>{
        const p=(st.people||[]).find(x=>x.id===id);
        if(p)return p.display_name||p.email||'User';
        if(st.profile?.id===id)return st.profile.display_name||st.profile.email||'User';
        return 'User';
      };
      list.innerHTML=(r.data||[]).length?(r.data||[]).map(x=>{
        const label=String(x.view_kind||'LOOKUP').replaceAll('_',' ');
        const pages=(x.source_pages||[]).length?' · page'+((x.source_pages||[]).length===1?' ':'s ')+(x.source_pages||[]).join(', '):'';
        return `<div class="item-card compact">
          <div class="row-between"><strong>${esc(name(x.user_id))}</strong><span>${esc(new Date(x.viewed_at).toLocaleString('en-GB'))}</span></div>
          <div>${esc(label)} · ${esc(x.location_path||'No location')}</div>
          <div class="muted">${esc(x.result_status||'')}${pages?esc(pages):''} · ${(x.entry_ids||[]).length} register entr${(x.entry_ids||[]).length===1?'y':'ies'}</div>
        </div>`;
      }).join(''):'<div class="muted">No asbestos register checks have been logged yet.</div>';
    }

    async function renderPageJpeg(pdf,page){
      const pg=await pdf.getPage(page);
      const base=pg.getViewport({scale:1});
      const scale=Math.max(1,Math.min(1.8,1000/Math.max(1,base.width)));
      const vp=pg.getViewport({scale});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      await pg.render({canvasContext:ctx,viewport:vp}).promise;
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create source snapshot.')),'image/jpeg',0.74));
      return {blob,width:canvas.width,height:canvas.height};
    }

    async function existingSnippetsFor(ids){
      return await snippetRows(ids);
    }

    async function buildMissingEvidence(manual=false){
      if(evidenceBusy)return;
      if(!actualManager()||st.uiMode==='user'||st.offline||!navigator.onLine)return;
      if(!window.pdfjsLib){if(manual)toast('PDF renderer is not available.');return}
      const entries=(st.asbestosEntries||[]).filter(e=>{
        if(e.active===false||!e.source_document_id||!pageNo(e.source_page))return false;
        const life=String(e.lifecycle_status||'PRESENT').toUpperCase();
        if(!['PRESENT','UNKNOWN'].includes(life))return false;
        if(String(e.record_kind||'ACM').toUpperCase()==='NON_ACM')return false;
        if(String(e.identification_status||'').toUpperCase()==='NOT_DETECTED')return false;
        return true;
      });
      if(!entries.length){if(manual)toast('No current ACM/source pages need snapshots.');return}

      evidenceBusy=true;
      const btn=$('asbestosEvidenceRepairBtnV2115');
      if(btn){btn.disabled=true;btn.textContent='Building snapshots…'}
      try{
        const existing=await existingSnippetsFor(entries.map(e=>e.id));
        const byEntryPage=new Map(existing.map(x=>[x.entry_id+'|'+String(x.source_page),x]));
        const missing=entries.filter(e=>{
          const p=pageNo(e.source_page),x=byEntryPage.get(e.id+'|'+String(p));
          return !(x&&x.image_storage_path);
        });
        if(!missing.length){if(manual)toast('All current asbestos source snapshots are already stored.');return}

        const groups=new Map();
        for(const e of missing){
          const p=pageNo(e.source_page),k=e.source_document_id+'|'+p;
          if(!groups.has(k))groups.set(k,{sourceId:e.source_document_id,page:p,entries:[]});
          groups.get(k).entries.push(e);
        }

        let made=0,failed=0;
        const pdfCache=new Map();
        for(const g of groups.values()){
          try{
            const src=sourceFor(g.sourceId);if(!src)throw new Error('Source document not loaded.');
            let pdf=pdfCache.get(g.sourceId);
            if(!pdf){
              const path=await sourceStoragePath(src);if(!path)throw new Error('Stored source PDF not found.');
              const dl=await sb.storage.from('safety-files').download(path);
              if(dl.error||!dl.data)throw(dl.error||new Error('Could not download source PDF.'));
              pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await dl.data.arrayBuffer())}).promise;
              pdfCache.set(g.sourceId,pdf);
            }
            if(g.page<1||g.page>pdf.numPages)throw new Error('Source page is outside the PDF page range.');
            const img=await renderPageJpeg(pdf,g.page);
            const path=`asbestos/evidence/${g.sourceId}/page-${g.page}.jpg`;
            const up=await sb.storage.from('safety-files').upload(path,img.blob,{contentType:'image/jpeg',upsert:true});
            if(up.error)throw up.error;

            for(const e of g.entries){
              const old=byEntryPage.get(e.id+'|'+String(g.page));
              const payload={
                entry_id:e.id,
                source_document_id:g.sourceId,
                source_page:g.page,
                excerpt:`Source page snapshot · ${e.material||'Asbestos register item'}${e.precise_location?' · '+e.precise_location:''}`.slice(0,1500),
                image_storage_path:path,
                image_mime:'image/jpeg',
                image_width:img.width,
                image_height:img.height,
                evidence_kind:'PAGE',
                created_by:st.user?.id||null
              };
              let wr;
              if(old?.id)wr=await sb.from('asbestos_evidence_snippets_v21080').update(payload).eq('id',old.id);
              else wr=await sb.from('asbestos_evidence_snippets_v21080').insert(payload);
              if(wr.error)throw wr.error;
              made++;
            }
          }catch(e){failed++;console.error('Asbestos evidence snapshot build',g,e)}
        }
        signedCache.clear();
        if($('asbestosLocationSelect')?.value)await renderEnhancedLookup(false);
        toast(failed?`Built ${made} asbestos source snapshot${made===1?'':'s'}; ${failed} page group${failed===1?'':'s'} needs review.`:`Built ${made} asbestos source snapshot${made===1?'':'s'}.`);
      }finally{
        evidenceBusy=false;
        if(btn){btn.disabled=false;btn.textContent='Build / repair source snapshots'}
      }
    }

    function ensureEvidenceButton(){
      let b=$('asbestosEvidenceRepairBtnV2115');
      const show=actualManager()&&st.uiMode!=='user'&&!st.offline;
      if(!show){if(b)b.hidden=true;return}
      if(!b){
        b=document.createElement('button');
        b.type='button';b.id='asbestosEvidenceRepairBtnV2115';b.className='secondary small';
        b.dataset.asbEvidenceRepair='1';b.textContent='Build / repair source snapshots';
        const head=view.querySelector('.page-heading');
        if(head)head.appendChild(b);else view.insertAdjacentElement('afterbegin',b);
      }
      b.hidden=false;
    }

    async function enhanceContractorPreview(locationId){
      const token=++contractorPreviewToken;
      if(!locationId||!maintenanceEligible())return;
      try{
        const r=await sb.functions.invoke('contractor-permit',{body:{action:'asbestos_preview',location_ids:[locationId]}});
        if(token!==contractorPreviewToken)return;
        if(r.error||r.data?.error)throw(r.error||new Error(r.data.error));
        const a=r.data||{},rows=Array.isArray(a.rows)?a.rows:[];
        const result=$('cpAsbestosResult');if(!result)return;
        result.querySelectorAll('.asb-contractor-evidence-v2115').forEach(x=>x.remove());
        if(rows.length){
          const html=`<div class="asb-contractor-evidence-v2115"><h4>Source evidence</h4>`+rows.map(x=>{
            const src=x.source||{},ev=x.evidence||{},page=x.source_page||ev.page||null;
            const thumb=ev.preview_url?`<button type="button" class="asb-evidence-thumb-v2115" data-asb-remote-evidence="${esc(x.id)}" data-asb-evidence-url="${esc(ev.preview_url)}" data-asb-evidence-title="${esc(x.material||'Asbestos evidence')}" data-asb-evidence-meta="${esc((src.title||'Asbestos source')+(page?' · page '+page:''))}"><img src="${esc(ev.preview_url)}" alt="Asbestos source evidence"><span>Tap to enlarge</span></button>`:`<div class="asb-evidence-missing-v2115">Source page snapshot not available yet.</div>`;
            return `<div class="item-card compact"><strong>${esc(x.material||'Asbestos register item')}</strong><div class="muted">${esc(src.title||'Asbestos source')}${page?' · page '+esc(page):''}</div>${thumb}</div>`;
          }).join('')+'</div>';
          result.insertAdjacentHTML('beforeend',html);
        }
        await logAccess('CONTRACTOR_LOOKUP',locationId,rows,a.status||statusForRows(rows),{screen:'CONTRACTOR_SIGNIN'});
      }catch(e){
        console.warn('Contractor asbestos evidence/audit enhancement',e);
      }
    }

    document.addEventListener('change',e=>{
      if(e.target?.id==='asbestosLocationSelect'){
        const id=e.target.value;
        if(id)setTimeout(()=>renderEnhancedLookup(true),90);
      }
      if(e.target?.id==='cpLocation'){
        const id=e.target.value;
        if(id)setTimeout(()=>enhanceContractorPreview(id),260);
      }
    },true);

    window.addEventListener('click',e=>{
      const asbNav=e.target.closest?.('#asbestosNavBtn,[data-view="asbestos"]');
      if(asbNav){
        ensureUserAsbestosAccess();
        setTimeout(()=>{ensureEvidenceButton();renderAuditCard();if(actualManager()&&st.uiMode!=='user')buildMissingEvidence(false);},350);
      }
      const switcher=e.target.closest?.('#adminUserModeBtn');
      if(switcher)setTimeout(()=>{ensureUserAsbestosAccess();ensureEvidenceButton();renderAuditCard();},180);

      const repair=e.target.closest?.('[data-asb-evidence-repair]');
      if(repair){e.preventDefault();e.stopImmediatePropagation();buildMissingEvidence(true);return}

      const refresh=e.target.closest?.('[data-asb-audit-refresh]');
      if(refresh){e.preventDefault();e.stopImmediatePropagation();renderAuditCard();return}

      const close=e.target.closest?.('[data-asb-evidence-close]');
      if(close){
        e.preventDefault();
        const d=$('asbestosEvidenceDialogV2115');if(d?.open)d.close();else d?.removeAttribute('open');
        return;
      }

      const thumb=e.target.closest?.('[data-asb-evidence-open],[data-asb-remote-evidence]');
      if(thumb){
        e.preventDefault();e.stopImmediatePropagation();
        const id=thumb.dataset.asbEvidenceOpen||thumb.dataset.asbRemoteEvidence;
        const entry=(st.asbestosEntries||[]).find(x=>x.id===id)||null;
        const locationId=$('asbestosLocationSelect')?.value||$('cpLocation')?.value||entry?.location_id||null;
        openEvidence(thumb.dataset.asbEvidenceUrl,thumb.dataset.asbEvidenceTitle,thumb.dataset.asbEvidenceMeta);
        logAccess('EVIDENCE_OPEN',locationId,entry?[entry]:[],entry?'EVIDENCE_OPEN':'EVIDENCE_OPEN',{entry_id:id}).catch(err=>console.warn('Evidence-open audit',err));
        return;
      }

      const source=e.target.closest?.('[data-asb-source-page]');
      if(source){
        e.preventDefault();e.stopImmediatePropagation();
        const entry=(st.asbestosEntries||[]).find(x=>x.id===source.dataset.asbEntryId)||null;
        openSourcePage(source.dataset.asbSourcePage,source.dataset.asbSourcePageNo,$('asbestosLocationSelect')?.value||entry?.location_id||null,entry);
        return;
      }

      const approve=e.target.closest?.('[data-cat88-approve],[data-asb80-approve],[data-cat86-approve]');
      if(approve&&actualManager()){
        [1800,4500].forEach(ms=>setTimeout(async()=>{
          try{await core.loadAll?.();ensureUserAsbestosAccess();await buildMissingEvidence(false)}catch(err){console.warn('Post-approval evidence build',err)}
        },ms));
      }
    },true);

    const style=document.createElement('style');
    style.id='asbestosEvidenceAuditStylesV2115';
    style.textContent=`
      .asb-evidence-thumb-v2115{
        width:100%;max-width:420px;padding:0;margin:10px 0;border:1px solid var(--border,#475569);
        border-radius:12px;overflow:hidden;background:var(--card,#1f1f1f);color:inherit;text-align:left
      }
      .asb-evidence-thumb-v2115 img{display:block;width:100%;max-height:260px;object-fit:contain;background:#fff}
      .asb-evidence-thumb-v2115 span{display:block;padding:8px 10px;font-weight:700}
      .asb-evidence-missing-v2115{margin:8px 0;padding:9px 10px;border:1px dashed var(--border,#475569);border-radius:10px;color:var(--muted,#a6b1c2)}
      .asb-audit-note-v2115{margin:10px 0}
      .asb-evidence-dialog-v2115{width:min(96vw,900px);max-height:92vh;padding:0;border:1px solid var(--border,#475569);border-radius:16px;background:var(--card,#1f1f1f);color:inherit}
      .asb-evidence-dialog-inner-v2115{padding:14px;display:grid;gap:10px}
      .asb-evidence-dialog-v2115 img{display:block;max-width:100%;max-height:76vh;margin:auto;background:#fff}
      .asb-contractor-evidence-v2115{margin-top:12px}
      @media(max-width:760px){
        .asb-evidence-thumb-v2115{max-width:none}
        .asb-evidence-dialog-v2115{width:98vw}
      }
    `;
    document.head.appendChild(style);

    new MutationObserver(()=>{
      scheduleAccess();
      ensureEvidenceButton();
    }).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});

    [0,200,700,1600,3200].forEach(ms=>setTimeout(()=>{
      ensureUserAsbestosAccess();
      ensureEvidenceButton();
      if(view.classList.contains('active-view'))renderAuditCard();
    },ms));
    window.addEventListener('pageshow',()=>setTimeout(()=>{
      ensureUserAsbestosAccess();ensureEvidenceButton();if(view.classList.contains('active-view'))renderAuditCard();
    },150));

    window.SafetyAsbestosEvidenceAuditV2115={
      ensureAccess:ensureUserAsbestosAccess,
      renderLookup:renderEnhancedLookup,
      buildEvidence:buildMissingEvidence,
      audit:renderAuditCard
    };
  }

  boot();
})();
