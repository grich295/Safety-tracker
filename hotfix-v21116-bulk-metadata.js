/* Safety Tracker v2.11.16 - bulk import metadata guard / COSHH field repair */
'use strict';
(function(){
  if(window.__SAFETY_BULK_METADATA_V21116)return;
  window.__SAFETY_BULK_METADATA_V21116=true;

  function boot(){
    const api=window.SafetyTrackerV2;
    if(!api||!api.state||!api.sb||!window.pdfjsLib){
      setTimeout(boot,120);
      return;
    }
    install(api);
  }

  function install(api){
    const st=api.state,sb=api.sb,$=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const toast=m=>{try{api.toast?.(m)}catch(_e){}};

    function suspiciousCoshhTitle(v){
      const s=clean(v);
      return !s ||
        /^COSHH-\d{3}$/i.test(s) ||
        /Brand:\s*Where is SDS/i.test(s) ||
        /^Substance Details$/i.test(s) ||
        /^Name of Substance/i.test(s) ||
        /COSHH Risk Assessment Form/i.test(s);
    }

    function rowsFromContent(content){
      const toks=(content.items||[])
        .map(x=>({
          text:clean(x.str),
          x:Number(x.transform?.[4]||0),
          y:Number(x.transform?.[5]||0),
          w:Number(x.width||0)
        }))
        .filter(x=>x.text);
      toks.sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x);

      const rows=[];
      for(const t of toks){
        let row=rows.find(r=>Math.abs(r.y-t.y)<=2.5);
        if(!row){row={y:t.y,tokens:[]};rows.push(row)}
        row.tokens.push(t);
      }
      rows.forEach(r=>{
        r.tokens.sort((a,b)=>a.x-b.x);
        r.text=clean(r.tokens.map(x=>x.text).join(' '));
      });
      rows.sort((a,b)=>b.y-a.y);
      return rows;
    }

    function goodProduct(v){
      const s=clean(v).replace(/^[:\-–—\s]+/,'');
      if(s.length<3||s.length>180)return '';
      if(/^(?:Name of Substance|Brand|Where is SDS|Substance Details|Form|COSHH|SS HSMS|Maintenance|Page \d+|Version\b|Yes$|No$|N\/A$)/i.test(s))return '';
      return s;
    }

    function titleFromRows(rows){
      for(const row of rows){
        const m=row.text.match(/\bName\s+of\s+Substance\s*:?\s*(.+?)(?=\s+Brand\s*:|\s+Where\s+is\s+(?:the\s+)?SDS|$)/i);
        if(m){
          const v=goodProduct(m[1]);
          if(v)return v;
        }
      }

      const labelRow=rows.find(r=>/\bName\s+of\s+Substance\b/i.test(r.text));
      if(labelRow){
        const nameToken=labelRow.tokens.find(t=>/\bName\b/i.test(t.text))||labelRow.tokens[0];
        const brandToken=labelRow.tokens.find(t=>/\bBrand\b/i.test(t.text));
        const x0=(nameToken?.x||0)-4;
        const x1=brandToken?.x ? brandToken.x-4 : x0+260;

        const same=goodProduct(labelRow.tokens
          .filter(t=>t.x>x0+20&&t.x<x1&&!/Name\s+of\s+Substance/i.test(t.text))
          .map(t=>t.text).join(' '));
        if(same)return same;

        const start=rows.indexOf(labelRow);
        for(let i=start+1;i<Math.min(rows.length,start+10);i++){
          const candidate=goodProduct(rows[i].tokens
            .filter(t=>t.x>=x0&&t.x<x1)
            .map(t=>t.text).join(' '));
          if(candidate)return candidate;
        }
      }

      const si=rows.findIndex(r=>/\bSubstance\s+Details\b/i.test(r.text));
      if(si>=0){
        for(let i=si+1;i<Math.min(rows.length,si+12);i++){
          const v=goodProduct(rows[i].text);
          if(v)return v;
        }
      }
      return '';
    }

    function versionFromRows(rows,ref){
      if(!ref)return '1';
      const escaped=String(ref).replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
      const rx=new RegExp('\\b'+escaped+'\\b.*?\\b(?:Version|Ver\\.?|V)\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)','i');
      for(const row of rows){
        const m=row.text.match(rx);
        if(m)return m[1];
      }
      return '1';
    }

    async function metadataFromBlob(blob,ref,pageNo=1){
      const ab=await blob.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
      const page=await pdf.getPage(Math.max(1,Math.min(pageNo,pdf.numPages)));
      const content=await page.getTextContent();
      const rows=rowsFromContent(content);
      return {
        title:titleFromRows(rows),
        version:versionFromRows(rows,ref),
        text:clean(rows.map(r=>r.text).join(' '))
      };
    }

    async function repairPreview(){
      const cards=[...document.querySelectorAll('#bulkImportPreview [data-index]')];
      const files=[...($('bulkImportFiles')?.files||[])];
      if(!cards.length||!files.length)return;

      let changed=0,unresolved=0;
      for(const card of cards){
        const kind=String(card.dataset.kind||'');
        const ref=clean(card.querySelector('.bulk-ref')?.value).toUpperCase();
        const mode=card.querySelector('.bulk-mode')?.value||'';
        const titleInput=card.querySelector('.bulk-title');
        const versionInput=card.querySelector('.bulk-version');

        if(mode==='CREATE'&&versionInput&&versionInput.value!=='1'){
          versionInput.value='1';
          versionInput.dispatchEvent(new Event('change',{bubbles:true}));
          changed++;
        }

        if(kind!=='COSHH')continue;

        const meta=card.querySelector('.meta span')?.textContent||'';
        const mm=meta.match(/^(.+?)\s+·\s+pages\s+(\d+)-(\d+)/i);
        const file=files.find(f=>f.name===mm?.[1]);
        const pageNo=Number(mm?.[2]||1);

        if(!file){
          unresolved++;
          continue;
        }

        try{
          const parsed=await metadataFromBlob(file,ref,pageNo);
          if(titleInput&&parsed.title&&!suspiciousCoshhTitle(parsed.title)){
            if(titleInput.value!==parsed.title){
              titleInput.value=parsed.title;
              titleInput.dispatchEvent(new Event('change',{bubbles:true}));
              changed++;
            }
          }else if(titleInput&&suspiciousCoshhTitle(titleInput.value)){
            titleInput.value=ref||'COSHH title needs review';
            titleInput.dispatchEvent(new Event('change',{bubbles:true}));
            unresolved++;
          }

          if(mode==='CREATE'&&versionInput){
            const v=parsed.version||'1';
            versionInput.value=v;
            versionInput.dispatchEvent(new Event('change',{bubbles:true}));
          }
        }catch(e){
          console.warn('v2.11.16 preview metadata repair',e);
          unresolved++;
        }
      }

      const status=$('bulkImportStatus');
      if(status){
        status.hidden=false;
        status.textContent += ` Metadata check: ${changed} field${changed===1?'':'s'} corrected${unresolved?`; ${unresolved} title${unresolved===1?'':'s'} still need manual review`:''}.`;
      }
    }

    async function repairPending(){
      if(st.profile?.role!=='admin')return toast('Admin access required.');
      if(st.offline||!navigator.onLine)return toast('Reconnect before repairing pending metadata.');

      await api.loadAll();
      const pending=(st.documents||[]).filter(d=>{
        const v=api.pendingApprovalVersion?.(d.id);
        return !!v && (d.doc_type==='COSHH'||suspiciousCoshhTitle(d.title));
      });
      if(!pending.length)return toast('No pending COSHH metadata needs repair.');

      const btn=$('repairPendingMetadataV21116');
      if(btn){btn.disabled=true;btn.textContent='Repairing…'}

      let fixed=0,needs=0;
      try{
        for(let i=0;i<pending.length;i++){
          const d=pending[i],v=api.pendingApprovalVersion(d.id);
          if(!v?.storage_path)continue;
          if(btn)btn.textContent=`Repairing ${i+1}/${pending.length}…`;

          const dl=await sb.storage.from('safety-files').download(v.storage_path);
          if(dl.error||!dl.data){needs++;continue}

          let parsed;
          try{parsed=await metadataFromBlob(dl.data,d.reference||'',1)}
          catch(e){console.warn('v2.11.16 stored metadata repair',d.id,e);needs++;continue}

          const patch={};
          if(parsed.title&&!suspiciousCoshhTitle(parsed.title))patch.title=parsed.title;
          else if(suspiciousCoshhTitle(d.title)){
            patch.title=d.reference||d.title;
            patch.review_required=true;
            patch.review_reason='[IMPORT_METADATA] COSHH product/substance name could not be read reliably. Confirm the title from the PDF before approval.';
            needs++;
          }

          const ur=await sb.from('documents').update(patch).eq('id',d.id);
          if(ur.error)throw ur.error;

          const uv=await sb.from('document_versions').update({
            version_label:parsed.version||'1'
          }).eq('id',v.id);
          if(uv.error)throw uv.error;
          fixed++;
        }

        await api.loadAll();
        try{renderDocuments()}catch(_e){}
        toast(`Pending COSHH metadata checked: ${fixed} repaired${needs?`, ${needs} need title confirmation`:''}.`);
      }finally{
        if(btn){btn.disabled=false;btn.textContent='Repair pending import metadata'}
      }
    }

    function addRepairButton(){
      if($('repairPendingMetadataV21116'))return;
      const anchor=$('bulkImportStatus')||$('bulkImportPreview');
      if(!anchor)return;
      const box=document.createElement('div');
      box.className='actions';
      box.innerHTML='<button id="repairPendingMetadataV21116" type="button" class="secondary">Repair pending import metadata</button>';
      anchor.insertAdjacentElement('afterend',box);
      $('repairPendingMetadataV21116')?.addEventListener('click',repairPending);
    }

    function validateBeforeImport(){
      const cards=[...document.querySelectorAll('#bulkImportPreview [data-index]')];
      const problems=[];
      for(const card of cards){
        const selected=card.querySelector('.bulk-select')?.checked;
        const mode=card.querySelector('.bulk-mode')?.value;
        if(!selected||mode==='SKIP')continue;

        const kind=String(card.dataset.kind||'');
        const ref=clean(card.querySelector('.bulk-ref')?.value).toUpperCase();
        const title=clean(card.querySelector('.bulk-title')?.value);
        const version=clean(card.querySelector('.bulk-version')?.value);

        if(kind==='COSHH'&&(!/^COSHH-\d{3}$/i.test(ref)||suspiciousCoshhTitle(title))){
          problems.push(`${ref||'COSHH item'}: title/reference needs review`);
        }
        if(kind==='COSHH'&&/^RA-\d{3}$/i.test(ref)){
          problems.push(`${ref}: detected as COSHH but reference is an RA`);
        }
        if(kind==='OTHER'&&/^(?:RA|SDS)-\d{3}$/i.test(title)){
          problems.push(`${title}: document type was not identified reliably`);
        }
        if(mode==='CREATE'&&version!=='1'){
          problems.push(`${ref||title}: new first version must be v1`);
        }
      }
      return problems;
    }

    document.addEventListener('click',e=>{
      if(e.target.closest?.('#bulkAnalyzeBtn')){
        const start=Date.now();
        const timer=setInterval(()=>{
          const status=$('bulkImportStatus')?.textContent||'';
          if(/Analysis complete/i.test(status)){
            clearInterval(timer);
            repairPreview().catch(err=>console.warn('v2.11.16 preview repair',err));
          }else if(Date.now()-start>90000){
            clearInterval(timer);
          }
        },300);
        return;
      }

      const imp=e.target.closest?.('#bulkImportBtn');
      if(imp){
        const problems=validateBeforeImport();
        if(problems.length){
          e.preventDefault();
          e.stopImmediatePropagation();
          toast(`Import stopped: ${problems[0]}${problems.length>1?` (+${problems.length-1} more)`:''}.`);
          return;
        }
      }
    },true);

    [300,900,1800,3500].forEach(ms=>setTimeout(addRepairButton,ms));

    window.SafetyBulkMetadataV21116={
      repairPending,
      repairPreview,
      metadataFromBlob
    };
  }

  boot();
})();
