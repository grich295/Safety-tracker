/* Safety Tracker v2.11.7 - asbestos history import + source library */
'use strict';
(function(){
  if(window.__SAFETY_ASBESTOS_HISTORY_V2117)return;
  window.__SAFETY_ASBESTOS_HISTORY_V2117=true;
  function boot(){const c=window.SafetyTrackerV2;if(!c||!c.state||!c.sb)return setTimeout(boot,120);install(c);}
  function install(core){
    const st=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const toast=m=>{try{core.toast?.(m)}catch(_e){}};
    const admin=()=>st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&st.uiMode!=='user'&&!st.offline;
    const MAX=50*1024*1024,PAGE=20;
    let busy=false,internal=false,queue=[],bound=false;
    let lib={sources:[],batches:[],versions:new Map(),page:1,sort:'OLD',search:'',type:'',year:'',status:''};

    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    function fmt(v){if(!v)return'Date not detected';const d=new Date(String(v).length===10?v+'T12:00:00':v);return isNaN(d)?String(v):d.toLocaleDateString('en-GB')}
    function bfmt(n){const u=['B','KB','MB','GB'];let x=n||0,i=0;while(x>=1024&&i<3){x/=1024;i++}return`${i?x.toFixed(x<10?1:0):x} ${u[i]}`}
    function safe(v){return clean(v||'asbestos-report').replace(/[<>:"/\\|?*]+/g,'-').slice(0,120)||'asbestos-report'}
    function dl(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},30000)}
    function tl(t){return({AMP:'Management Plan',MANAGEMENT_SURVEY:'Management Survey',R_AND_D_SURVEY:'R&D Survey',REINSPECTION:'Reinspection',LAB_RESULT:'Lab / bulk analysis',REMOVAL:'Removal evidence',CLEARANCE:'Clearance evidence',OTHER:'Other'})[t]||t||'Unknown'}
    function latest(sid){return lib.batches.filter(x=>x.source_document_id===sid).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null}
    function sk(s,b){if(s.active===false)return'ARCHIVED';if(b&&['DRAFT','REVIEW_READY'].includes(b.status))return'REVIEW';if(s.import_status==='ANALYSING')return'ANALYSING';if(s.import_status==='FAILED')return'FAILED';if(s.import_status==='APPROVED'||b?.status==='APPROVED')return'APPROVED';return'REVIEW'}
    function sm(k){return({APPROVED:['Published / approved','green'],REVIEW:['Review required','amber'],ANALYSING:['Analysing','amber'],FAILED:['Failed','red'],ARCHIVED:['Archived','neutral']})[k]||['Review required','amber']}

    async function head(file){
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[],lim=Math.min(5,pdf.numPages);
      for(let n=1;n<=lim;n++){const p=await pdf.getPage(n),tc=await p.getTextContent();out.push((tc.items||[]).map(x=>x.str||'').join(' '))}
      return{text:clean(out.join('\n')),pages:pdf.numPages}
    }
    function dtype(text){const t=String(text||'').toLowerCase();if(/certificate of reoccupation|four[- ]stage clearance|clearance certificate/.test(t))return'CLEARANCE';if(/asbestos removal|removal completion|remediation/.test(t))return'REMOVAL';if(/bulk analysis|laboratory report|sample analysis|certificate of analysis/.test(t))return'LAB_RESULT';if(/reinspection|re-inspection|re inspection/.test(t))return'REINSPECTION';if(/refurbishment.{0,45}demolition|demolition.{0,45}survey|refurbishment survey/.test(t))return'R_AND_D_SURVEY';if(/asbestos management plan|management plan for asbestos/.test(t))return'AMP';if(/management survey|asbestos survey|survey report/.test(t))return'MANAGEMENT_SURVEY';return'OTHER'}
    function iso(v){const s=clean(v).replace(/(\d)(st|nd|rd|th)\b/gi,'$1');let m=s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;m=s.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})\b/);if(m&&+m[1]<=31&&+m[2]<=12)return`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;m=s.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);if(m){const a=['january','february','march','april','may','june','july','august','september','october','november','december'];return`${m[3]}-${String(a.indexOf(m[2].toLowerCase())+1).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`}return null}
    function ddate(text){for(const l of['survey date','inspection date','reinspection date','re-inspection date','clearance date','removal date','report date','issue date','date issued','document date','date of report']){const m=String(text||'').match(new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:\\-]?\\s*([^\\n]{0,50})','i'));if(m){const d=iso(m[1]);if(d)return d}}const all=String(text||'').match(/\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/. -]\d{1,2}[/. -]\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/ig)||[];for(const x of all){const d=iso(x);if(d)return d}return null}
    function dver(text){const m=String(text||'').match(/\b(?:version|revision|rev)\s*[:#-]?\s*([A-Za-z0-9._-]{1,20})\b/i);return m?m[1]:'1'}
    async function inspect(file){const h=await head(file);return{type:dtype(h.text),date:ddate(h.text),version:dver(h.text),pages:h.pages}}

    function ensure(){
      const raw=$('asbestosSourceAdminList');if(!raw||!admin())return;const card=raw.closest('.section-card');if(!card)return;
      let bulk=$('asbestosHistoryBulkV2117');
      if(!bulk){bulk=document.createElement('div');bulk.id='asbestosHistoryBulkV2117';bulk.className='section-card';bulk.innerHTML=`
        <div class="row-between"><div><h3>Historical bulk import</h3><p class="muted">Select all historical asbestos PDFs you have. There is no 30-file limit: files are analysed one at a time so large histories do not overload the browser.</p></div></div>
        <div class="hint-box"><strong>Safe staging:</strong> duplicates are skipped, nothing publishes automatically, and one failed file does not stop the rest. Maximum 50 MB per PDF.</div>
        <label>Historical PDF files<input id="asbestosHistoryFilesV2117" type="file" accept="application/pdf,.pdf" multiple></label>
        <div id="asbestosHistorySelectionV2117" class="muted" style="margin-top:8px">No files selected.</div>
        <div class="actions"><button id="asbestosHistoryStartV2117" class="primary" type="button">Analyse & stage history</button><button id="asbestosHistoryClearV2117" class="ghost" type="button">Clear</button></div>
        <div id="asbestosHistoryProgressV2117" hidden><div class="asb-prog-v2117"><div id="asbestosHistoryBarV2117"></div></div><div id="asbestosHistoryProgressTextV2117" class="muted"></div></div>
        <div id="asbestosHistoryStatsV2117" class="stats-grid"></div>
        <details><summary>Batch details</summary><div id="asbestosHistoryQueueV2117" class="card-list" style="margin-top:10px"></div></details>`;
        card.insertAdjacentElement('afterend',bulk)}
      let panel=$('asbestosSourceLibraryV2117');
      if(!panel){panel=document.createElement('div');panel.id='asbestosSourceLibraryV2117';panel.className='section-card';panel.innerHTML=`
        <div class="row-between"><div><h3>Asbestos Source Library / History</h3><p class="muted">Complete original reports are retained here. Search, review, open and download any original PDF.</p></div><button class="secondary small" type="button" data-lib-refresh-v2117>Refresh</button></div>
        <div id="asbestosLibSummaryV2117" class="hint-box"></div>
        <div class="filters asb-filters-v2117"><input id="asbestosLibSearchV2117" placeholder="Search title or file"><select id="asbestosLibTypeV2117"><option value="">All types</option></select><select id="asbestosLibYearV2117"><option value="">All years</option></select><select id="asbestosLibStatusV2117"><option value="">All statuses</option><option value="REVIEW">Review required</option><option value="APPROVED">Published / approved</option><option value="ANALYSING">Analysing</option><option value="FAILED">Failed</option><option value="ARCHIVED">Archived</option></select><select id="asbestosLibSortV2117"><option value="OLD">Oldest first</option><option value="NEW">Newest first</option></select></div>
        <div class="actions"><button class="secondary" type="button" data-lib-export-v2117>Download filtered reports</button></div><div id="asbestosLibExportV2117" class="muted"></div>
        <div id="asbestosLibListV2117" class="card-list"></div><div id="asbestosLibPagerV2117" class="row-between" style="margin-top:12px"></div>`;
        bulk.insertAdjacentElement('afterend',panel)}
      raw.hidden=true;const q=$('asbestosImportQueueV21080');if(q)q.hidden=true;
      bind();selection();load();
    }
    function bind(){if(bound)return;bound=true;
      $('asbestosHistoryFilesV2117')?.addEventListener('change',selection);
      $('asbestosHistoryStartV2117')?.addEventListener('click',start);
      $('asbestosHistoryClearV2117')?.addEventListener('click',()=>{if(busy)return toast('Wait for the current historical batch to finish.');$('asbestosHistoryFilesV2117').value='';queue=[];selection();renderQ()});
      ['asbestosLibSearchV2117','asbestosLibTypeV2117','asbestosLibYearV2117','asbestosLibStatusV2117','asbestosLibSortV2117'].forEach(id=>$(id)?.addEventListener(id.includes('Search')?'input':'change',()=>{lib.search=clean($('asbestosLibSearchV2117')?.value).toLowerCase();lib.type=$('asbestosLibTypeV2117')?.value||'';lib.year=$('asbestosLibYearV2117')?.value||'';lib.status=$('asbestosLibStatusV2117')?.value||'';lib.sort=$('asbestosLibSortV2117')?.value||'OLD';lib.page=1;renderLib()}));
    }
    function selection(){const fs=Array.from($('asbestosHistoryFilesV2117')?.files||[]),tot=fs.reduce((a,f)=>a+f.size,0),big=fs.filter(f=>f.size>MAX).length,e=$('asbestosHistorySelectionV2117');if(e)e.innerHTML=fs.length?`<strong>${fs.length} PDFs selected</strong> · ${esc(bfmt(tot))}${big?` · <strong>${big} over 50 MB will be skipped</strong>`:''}`:'No files selected.'}
    function qs(){const n=k=>queue.filter(x=>x.status===k).length;return{total:queue.length,loaded:n('LOADED'),dup:n('DUPLICATE'),fail:n('FAILED'),wait:n('WAITING')+n('PROCESSING')}}
    function renderQ(){const s=qs(),g=$('asbestosHistoryStatsV2117'),l=$('asbestosHistoryQueueV2117');if(g)g.innerHTML=[['Selected',s.total,'neutral'],['Loaded',s.loaded,'green'],['Duplicates',s.dup,'neutral'],['Failed',s.fail,'red'],['Waiting',s.wait,'amber']].map(x=>`<div class="stat traffic-${x[2]}"><span class="traffic-dot"></span><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('');if(l)l.innerHTML=queue.map((x,i)=>`<div class="item-card compact traffic-${x.status==='LOADED'?'green':x.status==='FAILED'?'red':x.status==='PROCESSING'?'amber':'neutral'}"><div class="row-between"><strong>${i+1}. ${esc(x.file.name)}</strong><span>${esc(x.status)}</span></div><div class="muted">${esc(x.meta?[tl(x.meta.type),x.meta.date?fmt(x.meta.date):'date needs review',x.meta.pages?x.meta.pages+' pages':null].filter(Boolean).join(' · '):bfmt(x.file.size))}</div>${x.msg?`<div class="muted">${esc(x.msg)}</div>`:''}</div>`).join('')}
    function progress(done,total,text){const box=$('asbestosHistoryProgressV2117'),bar=$('asbestosHistoryBarV2117'),t=$('asbestosHistoryProgressTextV2117');if(box)box.hidden=false;if(bar)bar.style.width=`${total?Math.round(done/total*100):0}%`;if(t)t.textContent=text}

    async function duplicate(hash){if(!hash)return null;const r=await sb.from('asbestos_source_documents_v280').select('*').eq('source_hash',hash).eq('active',true).limit(1);if(r.error)throw r.error;return r.data?.[0]||null}
    function setFile(file){const d=new DataTransfer();d.items.add(file);$('asbestosSourceFile').files=d.files}
    function setMeta(file,m){const t=$('asbestosSourceType');if(t)t.value=[...t.options].some(o=>o.value===m.type)?m.type:'AUTO';$('asbestosSourceTitle').value=file.name.replace(/\.pdf$/i,'');$('asbestosSourceDate').value=m.date||'';$('asbestosSourceVersion').value=m.version||'1'}
    function fire(){internal=true;try{$('uploadAsbestosSourceBtn').click()}finally{internal=false}}
    async function waitSource(hash,name,since){
      const end=Date.now()+120000;let s=null,b=null;
      while(Date.now()<end){
        let q=sb.from('asbestos_source_documents_v280').select('*').eq('active',true);q=hash?q.eq('source_hash',hash):q.eq('file_name',name).gte('created_at',since);
        const r=await q.order('created_at',{ascending:false}).limit(1);if(!r.error&&r.data?.length)s=r.data[0];
        if(s){const br=await sb.from('asbestos_import_batches_v21080').select('*').eq('source_document_id',s.id).order('created_at',{ascending:false}).limit(1);if(!br.error&&br.data?.length)b=br.data[0];if(['AMP','OTHER'].includes(s.document_type)){if(b?.raw_metadata?.amp_summary||['APPROVED','REVIEW_REQUIRED'].includes(s.import_status))return{s,b}}else if(b&&['REVIEW_READY','APPROVED'].includes(b.status)){if(b.raw_metadata?.location_catalogue||!['MANAGEMENT_SURVEY','R_AND_D_SURVEY','REINSPECTION'].includes(s.document_type))return{s,b}}}
        await sleep(700)
      }
      if(s)return{s,b};throw new Error('Upload did not finish within two minutes.')
    }
    async function start(){if(busy)return;const files=Array.from($('asbestosHistoryFilesV2117')?.files||[]);if(!files.length)return toast('Choose historical PDFs first.');busy=true;queue=files.map(file=>({file,status:'WAITING',msg:'',meta:null}));renderQ();const btn=$('asbestosHistoryStartV2117');btn.disabled=true;btn.textContent='Analysing history…';
      for(let i=0;i<queue.length;i++){const x=queue[i],f=x.file;x.status='PROCESSING';x.msg='Reading document details…';renderQ();progress(i,queue.length,`Analysing ${i+1} of ${queue.length}: ${f.name}`);
        try{if(f.size>MAX)throw new Error(`File is ${bfmt(f.size)}; maximum is 50 MB.`);x.meta=await inspect(f);x.msg='Checking for duplicate…';renderQ();const hash=await core.hashPdf(f),du=await duplicate(hash);if(du){x.status='DUPLICATE';x.msg=`Already stored as ${du.title}. No second copy created.`;continue}setFile(f);setMeta(f,x.meta);const since=new Date().toISOString();x.msg=`Uploading as ${tl(x.meta.type)}${x.meta.date?' · '+fmt(x.meta.date):' · date needs review'}…`;renderQ();fire();const r=await waitSource(hash,f.name,since);x.status='LOADED';x.msg=r.b?.status==='REVIEW_READY'?'Stored safely. Staged for review — not published.':'Stored safely in Source Library.';try{if($('modal')?.open)$('modal').close()}catch(_e){}}
        catch(e){console.error('Asbestos history import',e);x.status='FAILED';x.msg=e?.message||'Import failed.'}
        renderQ()
      }
      const s=qs();progress(queue.length,queue.length,`Finished: ${s.loaded} loaded · ${s.dup} duplicates · ${s.fail} failed`);busy=false;btn.disabled=false;btn.textContent='Analyse & stage history';$('asbestosSourceFile').value='';$('asbestosSourceTitle').value='';$('asbestosSourceDate').value='';$('asbestosSourceVersion').value='';const t=$('asbestosSourceType');if(t&&[...t.options].some(o=>o.value==='AUTO'))t.value='AUTO';try{await core.loadAll?.()}catch(_e){}try{await window.SafetyAsbestosV21080?.refresh?.()}catch(_e){}await load();toast(`History finished: ${s.loaded} loaded, ${s.dup} duplicates, ${s.fail} failed.`)
    }

    async function load(){if(!admin()||!$('asbestosSourceLibraryV2117'))return;const [s,b]=await Promise.all([sb.from('asbestos_source_documents_v280').select('*').order('created_at',{ascending:false}),sb.from('asbestos_import_batches_v21080').select('id,source_document_id,status,item_count,proposed_location_count,warning_count,raw_metadata,warnings,created_at').order('created_at',{ascending:false})]);if(s.error||b.error)return;lib.sources=s.data||[];lib.batches=b.data||[];
      const ts=$('asbestosLibTypeV2117'),ys=$('asbestosLibYearV2117');if(ts){const k=ts.value,types=[...new Set(lib.sources.map(x=>x.document_type).filter(Boolean))].sort();ts.innerHTML='<option value="">All types</option>'+types.map(x=>`<option value="${esc(x)}">${esc(tl(x))}</option>`).join('');ts.value=k}if(ys){const k=ys.value,years=[...new Set(lib.sources.map(x=>String(x.document_date||x.created_at||'').slice(0,4)).filter(x=>/^\d{4}$/.test(x)))].sort().reverse();ys.innerHTML='<option value="">All years</option>'+years.map(x=>`<option>${x}</option>`).join('');ys.value=k}renderLib()
    }
    function filtered(){let r=[...lib.sources];if(lib.search)r=r.filter(s=>`${s.title||''} ${s.file_name||''} ${tl(s.document_type)}`.toLowerCase().includes(lib.search));if(lib.type)r=r.filter(s=>s.document_type===lib.type);if(lib.year)r=r.filter(s=>String(s.document_date||s.created_at||'').slice(0,4)===lib.year);if(lib.status)r=r.filter(s=>sk(s,latest(s.id))===lib.status);r.sort((a,b)=>{const da=new Date(a.document_date||a.created_at||0),db=new Date(b.document_date||b.created_at||0);return lib.sort==='NEW'?db-da:da-db});return r}
    function renderLib(){const rows=filtered(),list=$('asbestosLibListV2117'),sum=$('asbestosLibSummaryV2117'),pager=$('asbestosLibPagerV2117');if(!list)return;const rev=rows.filter(s=>sk(s,latest(s.id))==='REVIEW').length;sum.innerHTML=`<strong>${rows.length} full report${rows.length===1?'':'s'}</strong> matching filters · ${rev} awaiting review. Original PDFs are stored once in private Safety Tracker storage.`;const pages=Math.max(1,Math.ceil(rows.length/PAGE));lib.page=Math.min(lib.page,pages);const page=rows.slice((lib.page-1)*PAGE,lib.page*PAGE);list.innerHTML=page.length?page.map(s=>{const b=latest(s.id),key=sk(s,b),[label,tone]=sm(key),cat=b?.raw_metadata?.location_catalogue||{},bits=[tl(s.document_type),fmt(s.document_date||s.created_at),s.version_label?`v${s.version_label}`:null,b?.item_count!=null?`${b.item_count} findings`:null,cat.unique_count!=null?`${cat.unique_count} locations`:null].filter(Boolean).join(' · '),review=b&&['DRAFT','REVIEW_READY'].includes(b.status)?`<button class="primary small" data-lib-review-v2117="${b.id}">Review</button>`:'',more=[];if(window.SafetyAsbestosSourceToolsV21087?.reanalyse)more.push(`<button class="secondary small" data-lib-reanalyse-v2117="${s.id}">Re-analyse</button>`);if(window.SafetyAsbestosSourceToolsV21087?.isExplicitTest?.(s))more.push(`<button class="danger small" data-lib-delete-v2117="${s.id}">Delete TEST</button>`);return`<div class="item-card compact traffic-${tone}"><div class="row-between"><div><strong>${esc(s.title||s.file_name||'Asbestos report')}</strong><div class="meta"><span>${esc(bits)}</span><span class="badge ${tone==='green'?'complete':tone==='neutral'?'neutral':tone==='red'?'overdue':'due'}">${esc(label)}</span></div></div></div><div class="muted">${esc(s.file_name||'Original PDF')}</div><div class="actions">${review}<button class="secondary small" data-lib-open-v2117="${s.id}">Open full report</button><button class="secondary small" data-lib-download-v2117="${s.id}">Download PDF</button>${more.length?`<details><summary>More</summary><div class="actions">${more.join('')}</div></details>`:''}</div></div>`}).join(''):'<div class="muted">No reports match these filters.</div>';pager.innerHTML=`<button class="ghost small" data-lib-page-v2117="${lib.page-1}" ${lib.page<=1?'disabled':''}>Previous</button><span>Page ${lib.page} of ${pages}</span><button class="ghost small" data-lib-page-v2117="${lib.page+1}" ${lib.page>=pages?'disabled':''}>Next</button>`}
    async function ver(s){if(!s.linked_document_version_id)throw new Error('Stored controlled PDF link is missing.');if(lib.versions.has(s.linked_document_version_id))return lib.versions.get(s.linked_document_version_id);const r=await sb.from('document_versions').select('id,storage_path,file_name').eq('id',s.linked_document_version_id).single();if(r.error)throw r.error;lib.versions.set(r.data.id,r.data);return r.data}
    async function blob(s){const v=await ver(s),r=await sb.storage.from('safety-files').download(v.storage_path);if(r.error||!r.data)throw(r.error||new Error('Download failed'));return{blob:r.data,v}}
    async function open(id){const s=lib.sources.find(x=>x.id===id);if(!s)return;try{const x=await blob(s),u=URL.createObjectURL(x.blob),w=window.open(u,'_blank');if(!w)location.href=u;setTimeout(()=>URL.revokeObjectURL(u),180000)}catch(e){toast(e.message)}}
    async function download(id){const s=lib.sources.find(x=>x.id===id);if(!s)return;try{const x=await blob(s);dl(x.blob,x.v.file_name||s.file_name||safe(s.title)+'.pdf')}catch(e){toast(e.message)}}
    function csv(v){return`"${String(v??'').replaceAll('"','""')}"`}
    async function exportAll(){const rows=filtered().filter(s=>s.active!==false);if(!rows.length)return toast('No reports match these filters.');if(!window.JSZip)return toast('ZIP support unavailable.');if(!confirm(`Download ${rows.length} report${rows.length===1?'':'s'}? Large libraries are split into manageable ZIP parts.`))return;const stat=$('asbestosLibExportV2117');let zip=new JSZip(),items=[],size=0,parts=[],ok=0,fail=0;
      async function flush(){if(!items.length)return;zip.file('manifest.csv',['Date,Type,Title,Version,Original file,Status'].concat(items.map(({s})=>[s.document_date||'',tl(s.document_type),s.title||'',s.version_label||'',s.file_name||'',sk(s,latest(s.id))].map(csv).join(','))).join('\n'));parts.push(await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}));zip=new JSZip();items=[];size=0}
      for(let i=0;i<rows.length;i++){const s=rows[i];try{const x=await blob(s);if(items.length&&(items.length>=10||size+x.blob.size>150*1024*1024))await flush();let name=x.v.file_name||s.file_name||safe(s.title)+'.pdf';zip.file(`${s.document_date||'undated'}_${safe(tl(s.document_type))}_${safe(name)}`,x.blob);items.push({s});size+=x.blob.size;ok++}catch(e){fail++}if(stat)stat.textContent=`Preparing ${i+1} of ${rows.length}…`}await flush();for(let i=0;i<parts.length;i++){dl(parts[i],`Asbestos-Source-Library${parts.length>1?`-part-${i+1}-of-${parts.length}`:''}.zip`);if(parts.length>1)await sleep(600)}if(stat)stat.textContent=`Downloaded ${ok} report${ok===1?'':'s'}${fail?` · ${fail} failed`:''}.`}
    window.addEventListener('click',e=>{
      const orig=e.target.closest?.('#uploadAsbestosSourceBtn');if(orig&&busy&&!internal){e.preventDefault();e.stopImmediatePropagation();toast('Historical batch is already running.');return}
      const x=e.target.closest?.('[data-lib-refresh-v2117]');if(x){e.preventDefault();load();return}
      const r=e.target.closest?.('[data-lib-review-v2117]');if(r){e.preventDefault();e.stopImmediatePropagation();window.SafetyAsbestosCatalogueV21086?.showReview?.(r.dataset.libReviewV2117)||window.SafetyAsbestosV21080?.review?.(r.dataset.libReviewV2117);return}
      const o=e.target.closest?.('[data-lib-open-v2117]');if(o){e.preventDefault();open(o.dataset.libOpenV2117);return}
      const d=e.target.closest?.('[data-lib-download-v2117]');if(d){e.preventDefault();download(d.dataset.libDownloadV2117);return}
      if(e.target.closest?.('[data-lib-export-v2117]')){e.preventDefault();exportAll();return}
      const p=e.target.closest?.('[data-lib-page-v2117]');if(p&&!p.disabled){e.preventDefault();lib.page=Math.max(1,+p.dataset.libPageV2117||1);renderLib();return}
      const re=e.target.closest?.('[data-lib-reanalyse-v2117]');if(re){e.preventDefault();window.SafetyAsbestosSourceToolsV21087?.reanalyse?.(re.dataset.libReanalyseV2117);setTimeout(load,1500);return}
      const de=e.target.closest?.('[data-lib-delete-v2117]');if(de){e.preventDefault();window.SafetyAsbestosSourceToolsV21087?.deleteTest?.(de.dataset.libDeleteV2117);setTimeout(load,1500);return}
      if(e.target.closest?.('[data-view="admin"],[data-admin-tile-v21083="asbestos"]'))setTimeout(ensure,200)
    },true);
    const style=document.createElement('style');style.textContent=`.asb-prog-v2117{height:10px;background:rgba(128,128,128,.25);border-radius:999px;overflow:hidden;margin-top:12px}#asbestosHistoryBarV2117{height:100%;width:0;background:#2e7d32}.asb-filters-v2117{display:grid;grid-template-columns:minmax(180px,2fr) repeat(4,minmax(120px,1fr));gap:8px;margin-top:12px}@media(max-width:850px){.asb-filters-v2117{grid-template-columns:1fr 1fr}.asb-filters-v2117 input{grid-column:1/-1}}@media(max-width:520px){.asb-filters-v2117{grid-template-columns:1fr}.asb-filters-v2117 input{grid-column:auto}}`;document.head.appendChild(style);
    new MutationObserver(()=>{if(admin())setTimeout(ensure,40)}).observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
    [300,900,1800,3200].forEach(ms=>setTimeout(ensure,ms));window.addEventListener('pageshow',()=>setTimeout(ensure,180));
    window.SafetyAsbestosHistoryV2117={refresh:load,open,download};
  }
  boot();
})();
