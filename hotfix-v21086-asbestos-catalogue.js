/* Safety Tracker v2.10.86 - full asbestos location catalogue + AMP review */
'use strict';
(function(global){
  if(global.__ASBESTOS_CATALOGUE_V21086)return;
  global.__ASBESTOS_CATALOGUE_V21086=true;

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const pathKey=a=>(a||[]).map(x=>clean(x).toLowerCase()).join('>');
  const floorRx=/\b(lower ground|ground|basement|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|\d+(?:st|nd|rd|th))\s+floor\b/i;
  const roomWordRx=/^(?:room|bedroom|suite)\s*[-#:]?\s*([A-Z]?\d{1,4}[A-Z]?)\b/i;

  function coverageFromText(s){
    s=String(s||'');
    if(/not accessed|no access|inaccessible|unable to access/i.test(s))return 'NO_ACCESS';
    if(/no\s+(?:acm|asbestos)|not detected|negative|non[- ]?acm/i.test(s))return 'SURVEYED_NO_ACM';
    if(/\bacm\b|confirmed asbestos|presumed asbestos|asbestos present|positive/i.test(s))return 'SURVEYED_ACM';
    return 'LISTED';
  }
  function typesFor(path){
    return (path||[]).map((x,i)=>i===0
      ? (/guest[ -]?rooms?/i.test(x)?'GUEST_ROOMS':'AREA')
      : floorRx.test(x)?'FLOOR'
      : /^(?:room|bedroom|suite)\b/i.test(x)?'ROOM'
      : 'AREA');
  }
  function pathForRaw(raw,existingTopNames=[]){
    const s=clean(raw).replace(/\s*[›>]\s*/g,' > ');
    const direct=s.split(/\s+>\s+|\s+\/\s+/).map(clean).filter(Boolean);
    if(direct.length>1)return direct;
    const low=s.toLowerCase();
    const top=(existingTopNames||[]).find(n=>low.includes(String(n).toLowerCase()));
    const floor=(s.match(floorRx)||[])[0]||null;
    const room=(s.match(/(?:room|bedroom|suite)\s*[-#:]?\s*[A-Z]?\d{1,4}[A-Z]?/i)||[])[0]||null;
    if(top){
      const a=[top]; if(floor&&!a.some(x=>x.toLowerCase()===floor.toLowerCase()))a.push(floor); if(room)a.push(room);
      return a;
    }
    if(room){const a=['Guest Rooms'];if(floor)a.push(floor);a.push(room);return a;}
    if(floor)return ['Guest Rooms',floor];
    return s?[s]:[];
  }
  function declaredLocationTotal(text){
    const rules=[
      {kind:'rooms',rx:/\btotal\s+(?:guest\s+)?rooms?\s*[:\-]?\s*(\d{1,4})\b/i},
      {kind:'rooms',rx:/\brooms?\s+surveyed\s*[:\-]?\s*(\d{1,4})\b/i},
      {kind:'locations',rx:/\btotal\s+locations?\s*[:\-]?\s*(\d{1,4})\b/i},
      {kind:'locations',rx:/\blocations?\s+surveyed\s*[:\-]?\s*(\d{1,4})\b/i}
    ];
    for(const r of rules){const m=String(text||'').match(r.rx);if(m)return {kind:r.kind,count:Number(m[1])};}
    return null;
  }
  function extractLocationCatalogue(pages,items=[],existingTopNames=[]){
    const map=new Map(); let mentions=0;
    const add=(path,page,raw,coverage='LISTED',confidence=.95,kind='SOURCE')=>{
      path=(path||[]).map(clean).filter(Boolean); if(!path.length)return;
      mentions++;
      const k=pathKey(path),old=map.get(k);
      const rec={raw_location:clean(raw)||path.join(' > '),location_path:path,proposed_location_types:typesFor(path),
        source_page:String(page||''),coverage_status:coverage,confidence,review_status:confidence>=.75?'READY':'REVIEW',
        source_kind:kind};
      if(!old){map.set(k,rec);return;}
      const rank={UNKNOWN:0,LISTED:1,SURVEYED_NO_ACM:2,SURVEYED_ACM:3,NO_ACCESS:4,OUTSIDE_SCOPE:1};
      if((rank[coverage]||0)>(rank[old.coverage_status]||0))old.coverage_status=coverage;
      if(confidence>old.confidence){old.confidence=confidence;old.review_status=confidence>=.75?'READY':'REVIEW';}
      if(!old.source_page&&page)old.source_page=String(page);
    };

    for(const it of items||[]){
      const path=Array.isArray(it.location_path)?it.location_path:pathForRaw(it.raw_location,existingTopNames);
      add(path,it.source_page,it.raw_location,
          it.record_kind==='NO_ACCESS'?'NO_ACCESS':it.record_kind==='NON_ACM'?'SURVEYED_NO_ACM':'SURVEYED_ACM',
          Number(it.location_confidence||.98),'ACM_FINDING');
    }

    const allText=(pages||[]).map(p=>p.text||'').join('\n');
    const declared=declaredLocationTotal(allText);

    for(const p of pages||[]){
      const lines=p.lines||String(p.text||'').split(/\r?\n/);
      const pageText=String(p.text||lines.join('\n'));
      const scheduleContext=/room schedule|location schedule|survey schedule|locations surveyed|rooms surveyed|accommodation schedule|asbestos register/i.test(pageText);
      let currentFloor=null;
      for(let i=0;i<lines.length;i++){
        const line=clean(lines[i]); if(!line)continue;
        const fl=line.match(floorRx);
        if(fl && line.length<70)currentFloor=fl[0];

        const labelled=line.match(/^(?:location|area\s*\/\s*location|room\s*\/\s*area|survey location)\s*[:\-]\s*(.+)$/i);
        if(labelled){
          const path=pathForRaw(labelled[1],existingTopNames);
          add(path,p.page||p.n,labelled[1],coverageFromText(line),.98,'LABELLED_LOCATION');
          continue;
        }

        if(/[>›]/.test(line) && /room|floor|guest/i.test(line)){
          const path=pathForRaw(line,existingTopNames);
          add(path,p.page||p.n,line,coverageFromText(line),.98,'HIERARCHY');
          continue;
        }

        const range=line.match(/^rooms?\s+(\d{1,4})\s*[-–]\s*(\d{1,4})\b/i);
        if(range && currentFloor){
          let a=Number(range[1]),b=Number(range[2]);
          if(b>=a && b-a<=500){
            for(let n=a;n<=b;n++)add(['Guest Rooms',currentFloor,'Room '+n],p.page||p.n,line,coverageFromText(line),.97,'ROOM_RANGE');
          }
          continue;
        }

        const explicit=line.match(roomWordRx);
        if(explicit){
          const path=['Guest Rooms']; if(currentFloor)path.push(currentFloor); path.push('Room '+explicit[1]);
          add(path,p.page||p.n,line,coverageFromText(line),currentFloor?.98:.82,'EXPLICIT_ROOM');
          continue;
        }

        if(scheduleContext && currentFloor){
          const bare=line.match(/^(\d{1,4}[A-Z]?)\s+(?:surveyed|inspected|no\s+(?:acm|asbestos)|acm\b|not accessed|inaccessible|clear|negative|presumed|confirmed)/i);
          if(bare){
            add(['Guest Rooms',currentFloor,'Room '+bare[1]],p.page||p.n,line,coverageFromText(line),.96,'SCHEDULE_ROW');
            continue;
          }
        }
      }
    }

    const rows=[...map.values()].sort((a,b)=>pathKey(a.location_path).localeCompare(pathKey(b.location_path)));
    const roomCount=rows.filter(r=>(r.proposed_location_types||[]).at(-1)==='ROOM').length;
    const unresolved=rows.filter(r=>r.review_status==='REVIEW').length;
    let completeness='NO_DECLARED_TOTAL';
    if(declared){
      const observed=declared.kind==='rooms'?roomCount:rows.length;
      completeness=observed===declared.count?'VERIFIED':'MISMATCH';
    }
    return {
      rows,
      source_candidate_count:mentions,
      unique_count:rows.length,
      room_count:roomCount,
      duplicate_mentions:Math.max(0,mentions-rows.length),
      unresolved_count:unresolved,
      declared_count:declared?.count??null,
      declared_kind:declared?.kind??null,
      completeness_state:completeness,
      reviewer_confirmed:false
    };
  }

  function extractAmpSummary(pages){
    const lines=(pages||[]).flatMap(p=>(p.lines||String(p.text||'').split(/\r?\n/)).map(clean)).filter(Boolean);
    const value=(labels)=>{
      for(const line of lines){
        for(const label of labels){
          const rx=new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:\\-]\\s*(.+)$','i');
          const m=line.match(rx); if(m&&clean(m[1]))return clean(m[1]);
        }
      }
      return null;
    };
    const text=lines.join('\n');
    const section=(words)=>{
      const rx=new RegExp('(?:'+words.join('|')+')\\s*[:\\-]?\\s*([\\s\\S]{0,900})','i');
      const m=text.match(rx); return m?clean(m[1]).slice(0,700):null;
    };
    return {
      document_reference:value(['Document reference','Document ref','Reference','Report reference','Report no']),
      issue_date:value(['Issue date','Date issued','Document date']),
      review_date:value(['Review date','Next review','Review due']),
      site:value(['Site','Property','Premises']),
      prepared_by:value(['Prepared by','Author','Prepared for']),
      dutyholder:value(['Dutyholder','Accountable person','Responsible person']),
      asbestos_coordinator:value(['Asbestos coordinator','Asbestos manager','Coordinator']),
      deputy:value(['Deputy','Deputy asbestos coordinator']),
      survey_provider:value(['Survey provider','Surveyor','Survey company']),
      source_survey:value(['Source survey','Referenced survey','Survey reference']),
      management_objectives:section(['management objectives','objectives']),
      contractor_controls:section(['contractor controls','work controls','permit to work']),
      monitoring:section(['monitoring','reinspection','condition monitoring']),
      emergency_procedure:section(['emergency procedure','disturbance procedure','suspected asbestos']),
      review_closeout:section(['review and closeout','review arrangements','plan review'])
    };
  }

  global.AsbestosCatalogueParserV21086={extractLocationCatalogue,extractAmpSummary,pathForRaw,coverageFromText,declaredLocationTotal};

  if(typeof window==='undefined'||typeof document==='undefined')return;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,40);return;}
    install(core);
  }

  function install(core){
    const st=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    const isAdmin=()=>st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&!(st.offline||st.uiMode==='user');

    async function readPdf(fileOrBlob){
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await fileOrBlob.arrayBuffer())}).promise,pages=[];
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),tc=await page.getTextContent();
        const raw=tc.items.map(i=>({s:clean(i.str),x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0)})).filter(i=>i.s);
        const rows=[];
        for(const it of raw){let r=rows.find(x=>Math.abs(x.y-it.y)<2.5);if(!r){r={y:it.y,a:[]};rows.push(r)}r.a.push(it)}
        rows.sort((a,b)=>b.y-a.y);
        const lines=rows.map(r=>r.a.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' '));
        pages.push({page:n,lines,text:lines.join('\n')});
      }
      return pages;
    }

    function modal(title,html){
      if(typeof window.openModal==='function')return window.openModal(title,html);
      const d=$('modal'); if($('modalTitle'))$('modalTitle').textContent=title;if($('modalBody'))$('modalBody').innerHTML=html;if(d&&!d.open)d.showModal();
    }
    function closeModal(){try{$('modal')?.close()}catch(_e){}}

    async function sourceByHash(hash,startedAt){
      for(let i=0;i<60;i++){
        const r=await sb.from('asbestos_source_documents_v280').select('*').eq('source_hash',hash).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(!r.error&&r.data){
          const t=new Date(r.data.created_at||0).getTime();
          if(!startedAt||t>=startedAt-5000||r.data.import_status!=='APPROVED')return r.data;
        }
        await new Promise(res=>setTimeout(res,350));
      }
      return null;
    }

    async function batchForSource(sourceId){
      const r=await sb.from('asbestos_import_batches_v21080').select('*').eq('source_document_id',sourceId).order('created_at',{ascending:false}).limit(1).maybeSingle();
      return r.error?null:r.data;
    }

    async function stageCatalogue(batch,source,pages,items){
      const tops=(st.siteLocations||[]).filter(x=>!x.parent_id&&x.active!==false).map(x=>x.name);
      const cat=extractLocationCatalogue(pages,items,tops);
      await sb.from('asbestos_import_locations_v21086').delete().eq('import_id',batch.id);
      for(let i=0;i<cat.rows.length;i+=100){
        const rows=cat.rows.slice(i,i+100).map((x,j)=>({
          import_id:batch.id,location_no:i+j+1,raw_location:x.raw_location,
          location_path:x.location_path,proposed_location_types:x.proposed_location_types,
          source_page:x.source_page||null,coverage_status:x.coverage_status,
          confidence:x.confidence,review_status:x.review_status,
          raw_data:{source_kind:x.source_kind}
        }));
        if(rows.length){const r=await sb.from('asbestos_import_locations_v21086').insert(rows);if(r.error)throw r.error;}
      }
      const oldMeta=batch.raw_metadata&&typeof batch.raw_metadata==='object'?batch.raw_metadata:{};
      const raw_metadata={...oldMeta,location_catalogue:{
        source_candidate_count:cat.source_candidate_count,unique_count:cat.unique_count,room_count:cat.room_count,
        duplicate_mentions:cat.duplicate_mentions,unresolved_count:cat.unresolved_count,
        declared_count:cat.declared_count,declared_kind:cat.declared_kind,
        completeness_state:cat.completeness_state,reviewer_confirmed:false
      }};
      const warnings=Array.isArray(batch.warnings)?[...batch.warnings]:[];
      if(cat.completeness_state==='MISMATCH')warnings.push(`Location total mismatch: source declares ${cat.declared_count} ${cat.declared_kind}, but ${cat.declared_kind==='rooms'?cat.room_count:cat.unique_count} unique were extracted.`);
      if(cat.completeness_state==='NO_DECLARED_TOTAL')warnings.push('The source does not declare a total room/location count. Review and confirm the extracted location catalogue before approval.');
      if(cat.unresolved_count)warnings.push(`${cat.unresolved_count} extracted location(s) need review.`);
      const uniqueWarnings=[...new Set(warnings)];
      const u=await sb.from('asbestos_import_batches_v21080').update({
        proposed_location_count:cat.unique_count,warning_count:uniqueWarnings.length,warnings:uniqueWarnings,
        raw_metadata,updated_at:new Date().toISOString()
      }).eq('id',batch.id).select().single();
      if(u.error)throw u.error;
      return u.data;
    }

    async function ensureAmpBatch(source,pages){
      let batch=await batchForSource(source.id);
      const summary=extractAmpSummary(pages);
      if(!batch||batch.status==='APPROVED'){
        const r=await sb.from('asbestos_import_batches_v21080').insert({
          source_document_id:source.id,source_hash:source.source_hash,detected_document_type:'AMP',
          parser_name:'BROWSER_AMP_V21086',status:'REVIEW_READY',item_count:0,proposed_location_count:0,
          warning_count:0,raw_metadata:{amp_summary:summary},warnings:[],created_by:st.user.id
        }).select().single();
        if(r.error)throw r.error;batch=r.data;
      }else{
        const meta=batch.raw_metadata&&typeof batch.raw_metadata==='object'?batch.raw_metadata:{};
        const r=await sb.from('asbestos_import_batches_v21080').update({raw_metadata:{...meta,amp_summary:summary},updated_at:new Date().toISOString()}).eq('id',batch.id).select().single();
        if(r.error)throw r.error;batch=r.data;
      }
      await sb.from('asbestos_source_documents_v280').update({
        import_status:'REVIEW_REQUIRED',
        extraction_summary:{...(source.extraction_summary||{}),amp_summary:summary,parser:'BROWSER_AMP_V21086'},
        updated_at:new Date().toISOString()
      }).eq('id',source.id);
      return batch;
    }

    async function postProcessFile(file,startedAt){
      let hash=null;try{hash=await core.hashPdf(file)}catch(_e){}
      if(!hash)return;
      const source=await sourceByHash(hash,startedAt);if(!source)return;
      let batch=await batchForSource(source.id);
      const pages=await readPdf(file);
      if(source.detected_document_type==='AMP'||source.document_type==='AMP'){
        batch=await ensureAmpBatch(source,pages);
      }else if(!batch||!['DRAFT','REVIEW_READY'].includes(batch.status)){
        return;
      }
      const ir=await sb.from('asbestos_import_items_v21080').select('*').eq('import_id',batch.id).order('item_no');
      if(ir.error)throw ir.error;
      batch=await stageCatalogue(batch,source,pages,ir.data||[]);
      await showReview(batch.id);
      await decorateSources();
    }

    async function processExistingAmp(sourceId){
      if(!isAdmin())return;
      const sr=await sb.from('asbestos_source_documents_v280').select('*').eq('id',sourceId).single();if(sr.error)return toast(sr.error.message);
      const s=sr.data;if(!s.linked_document_version_id)return toast('This AMP is not linked to its controlled document version.');
      const vr=await sb.from('document_versions').select('*').eq('id',s.linked_document_version_id).single();if(vr.error)return toast(vr.error.message);
      const d=await sb.storage.from('safety-files').download(vr.data.storage_path);if(d.error||!d.data)return toast(d.error?.message||'Could not open the controlled AMP.');
      try{
        const pages=await readPdf(d.data);
        let batch=await ensureAmpBatch(s,pages);
        const ir=await sb.from('asbestos_import_items_v21080').select('*').eq('import_id',batch.id);
        batch=await stageCatalogue(batch,s,pages,ir.data||[]);
        showReview(batch.id);
      }catch(e){console.error(e);toast(e.message||'Could not analyse AMP.')}
    }

    function ampHtml(summary){
      const fields=[
        ['Document reference',summary?.document_reference],['Issue date',summary?.issue_date],['Review date',summary?.review_date],
        ['Site',summary?.site],['Prepared by',summary?.prepared_by],['Dutyholder / responsible person',summary?.dutyholder],
        ['Asbestos coordinator',summary?.asbestos_coordinator],['Deputy',summary?.deputy],
        ['Survey provider',summary?.survey_provider],['Source survey',summary?.source_survey]
      ].filter(x=>x[1]);
      const long=[
        ['Management objectives',summary?.management_objectives],['Contractor/work controls',summary?.contractor_controls],
        ['Monitoring / reinspection',summary?.monitoring],['Emergency/disturbance procedure',summary?.emergency_procedure],
        ['Review / closeout',summary?.review_closeout]
      ].filter(x=>x[1]);
      return '<div class="section-card"><h3>Management Plan details</h3>'+
        (fields.length?'<div class="form-grid">'+fields.map(x=>`<div><strong>${esc(x[0])}</strong><div>${esc(x[1])}</div></div>`).join('')+'</div>':'<div class="pending-use-warning">No structured AMP details were confidently extracted. Review the controlled source before approval.</div>')+
        long.map(x=>`<div style="margin-top:10px"><strong>${esc(x[0])}</strong><p>${esc(x[1])}</p></div>`).join('')+
        '</div>';
    }

    async function showReview(id){
      const [br,ir,lr]=await Promise.all([
        sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single(),
        sb.from('asbestos_import_items_v21080').select('*').eq('import_id',id).order('item_no'),
        sb.from('asbestos_import_locations_v21086').select('*').eq('import_id',id).order('location_no')
      ]);
      if(br.error||ir.error||lr.error)return toast((br.error||ir.error||lr.error).message);
      const b=br.data,items=ir.data||[],locs=lr.data||[],meta=b.raw_metadata||{},cat=meta.location_catalogue||{},amp=meta.amp_summary||{};
      const source=(st.asbestosSources||[]).find(x=>x.id===b.source_document_id);
      const itemReview=items.filter(x=>x.review_status==='REVIEW').length;
      const locReview=locs.filter(x=>x.review_status==='REVIEW').length;
      const needsConfirm=cat.completeness_state==='NO_DECLARED_TOTAL'&&!cat.reviewer_confirmed;
      const mismatch=cat.completeness_state==='MISMATCH';
      const block=itemReview||locReview||needsConfirm||mismatch;
      const unresolved=locs.filter(x=>x.review_status==='REVIEW');
      const sample=unresolved.length?unresolved:locs.slice(0,12);
      let catStatus='';
      if(cat.completeness_state==='VERIFIED')catStatus=`<div class="success-note"><strong>Location count verified:</strong> ${cat.declared_count} declared / ${cat.declared_kind==='rooms'?cat.room_count:cat.unique_count} extracted.</div>`;
      else if(mismatch)catStatus=`<div class="danger-note"><strong>Location mismatch:</strong> source declares ${esc(cat.declared_count)} ${esc(cat.declared_kind)}, but ${esc(cat.declared_kind==='rooms'?cat.room_count:cat.unique_count)} were extracted. Approval is blocked.</div>`;
      else if(needsConfirm)catStatus=`<div class="pending-use-warning"><strong>No declared location total found.</strong> ${esc(cat.unique_count||0)} unique locations (${esc(cat.room_count||0)} rooms) were extracted. Confirm the catalogue after checking the source.</div>`;
      else if(cat.completeness_state==='NO_DECLARED_TOTAL')catStatus=`<div class="success-note"><strong>Location catalogue manually confirmed:</strong> ${esc(cat.unique_count||0)} unique locations.</div>`;

      modal(source?.document_type==='AMP'?'Review Asbestos Management Plan':'Asbestos import review',
        `<div class="hint-box"><strong>${esc(source?.title||'Asbestos source')}</strong><br>`+
        `${items.length} ACM/finding record(s) · ${locs.length} unique location(s) · ${esc(cat.duplicate_mentions||0)} duplicate location mention(s) collapsed.</div>`+
        (source?.document_type==='AMP'?ampHtml(amp):'')+
        catStatus+
        (locs.length?`<div class="section-card"><h3>Location catalogue</h3><p class="muted">Showing ${sample.length}${sample.length<locs.length?' of '+locs.length:''}. Any amber location must be corrected before approval.</p>`+
          sample.map(x=>`<div class="item-card compact traffic-${x.review_status==='REVIEW'?'amber':'green'}"><div class="row-between"><div><strong>${esc((x.location_path||[]).join(' > ')||x.raw_location)}</strong><div class="meta"><span>${esc(x.coverage_status)}</span><span>page ${esc(x.source_page||'—')}</span></div></div>${x.review_status==='REVIEW'?`<button type="button" class="secondary small" data-cat86-edit-location="${x.id}">Review</button>`:''}</div></div>`).join('')+
          `</div>`:'')+
        (items.length?`<div class="section-card"><h3>ACM/register findings</h3><p>${items.length-itemReview} ready · ${itemReview} need review.</p></div>`:'')+
        `<div class="actions">`+
          (needsConfirm?`<button type="button" class="secondary" data-cat86-confirm="${id}">Confirm location catalogue</button>`:'')+
          `<button type="button" class="primary" data-cat86-approve="${id}" ${block?'disabled':''}>Approve & publish</button>`+
        `</div>`
      );
    }

    async function editLocation(id){
      const r=await sb.from('asbestos_import_locations_v21086').select('*').eq('id',id).single();if(r.error)return toast(r.error.message);
      const x=r.data,old=(x.location_path||[]).join(' > ');
      const p=prompt('Correct location hierarchy',old||x.raw_location||'');if(p===null)return;
      const path=clean(p).split(/\s*>\s*/).map(clean).filter(Boolean);if(!path.length)return toast('Location is required.');
      const cov=prompt('Coverage: LISTED, SURVEYED_ACM, SURVEYED_NO_ACM, NO_ACCESS, OUTSIDE_SCOPE, UNKNOWN',x.coverage_status||'LISTED');if(cov===null)return;
      const u=await sb.from('asbestos_import_locations_v21086').update({
        raw_location:path.join(' > '),location_path:path,proposed_location_types:typesFor(path),
        coverage_status:clean(cov).toUpperCase(),confidence:1,review_status:'READY',updated_at:new Date().toISOString()
      }).eq('id',id).select('import_id').single();
      if(u.error)return toast(u.error.message);showReview(u.data.import_id);
    }

    async function confirmCatalogue(id){
      const r=await sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single();if(r.error)return toast(r.error.message);
      const meta=r.data.raw_metadata||{},cat={...(meta.location_catalogue||{}),reviewer_confirmed:true};
      const u=await sb.from('asbestos_import_batches_v21080').update({raw_metadata:{...meta,location_catalogue:cat},updated_at:new Date().toISOString()}).eq('id',id);
      if(u.error)return toast(u.error.message);showReview(id);
    }

    async function approve(id){
      if(!confirm('Approve this reviewed asbestos import and publish its findings, management data and approved locations?'))return;
      const r=await sb.rpc('approve_asbestos_import_v21081',{p_import_id:id});
      if(r.error)return toast(r.error.message);
      closeModal();
      try{await core.refresh()}catch(_e){}
      const x=r.data||{};
      toast(`Approved: ${x.location_catalog_count||0} location(s), ${x.new_entries||0} new ACM record(s), ${x.updated_entries||0} update(s).`);
      setTimeout(decorateSources,200);
    }

    async function renderAmpReviewPanel(){
      const list=$('asbestosSourceAdminList');if(!list||!isAdmin())return;
      let panel=$('asbestosAmpReviewPanelV21086');
      if(!panel){panel=document.createElement('div');panel.id='asbestosAmpReviewPanelV21086';panel.style.marginTop='12px';list.parentElement?.insertBefore(panel,list);}
      const rows=(st.asbestosSources||[]).filter(s=>s.active!==false&&s.document_type==='AMP'&&!(s.extraction_summary&&s.extraction_summary.amp_summary));
      panel.innerHTML=rows.length?`<div class="pending-use-warning"><strong>${rows.length} AMP source${rows.length===1?'':'s'} need structured review.</strong><br>`+
        rows.map(s=>`<button type="button" class="secondary small" style="margin:8px 6px 0 0" data-cat86-review-amp="${s.id}">Review ${esc(s.title)}</button>`).join('')+
        `</div>`:'';
    }

    async function decorateSources(){
      const list=$('asbestosSourceAdminList');if(!list)return;
      await renderAmpReviewPanel();
      const cards=Array.from(list.querySelectorAll('.item-card'));
      const rows=[...(st.asbestosSources||[])].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      cards.forEach((card,i)=>{
        const s=rows[i];if(!s)return;
        card.classList.remove('traffic-neutral','traffic-green','traffic-amber','traffic-red');
        const good=s.active!==false&&s.import_status==='APPROVED'&&(s.document_type!=='AMP'||!!s.extraction_summary?.amp_summary);
        card.classList.add(s.active===false?'traffic-neutral':good?'traffic-green':s.import_status==='FAILED'?'traffic-red':'traffic-amber');
        let badge=card.querySelector('.cat86-source-status');
        if(!badge){badge=document.createElement('span');badge.className='badge cat86-source-status';card.querySelector('.meta')?.appendChild(badge);}
        if(badge){
          badge.textContent=s.active===false?'ARCHIVED':good?(s.document_type==='AMP'?'AMP REVIEWED':'APPROVED REGISTER SOURCE'):'REVIEW REQUIRED';
          badge.className='badge cat86-source-status '+(good?'complete':s.active===false?'neutral':'due');
        }
      });
    }

    function openAsbestosVisibleTab(e){
      const b=e.target.closest?.('#mainNav button[data-view="asbestos"]');if(!b)return false;
      const visible=!b.hidden&&getComputedStyle(b).display!=='none';if(!visible)return false;
      if(core.canAccessView('asbestos'))return false;
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
      document.querySelectorAll('#mainNav button').forEach(x=>x.classList.toggle('active',x===b));
      $('asbestosView')?.classList.add('active-view');
      Promise.resolve(window.SafetyAsbestosV21080?.refresh?.()).catch(()=>{});
      return true;
    }

    document.addEventListener('click',function(e){
      if(openAsbestosVisibleTab(e))return;

      const upload=e.target.closest?.('#uploadAsbestosSourceBtn');
      if(upload&&isAdmin()){
        const files=Array.from($('asbestosSourceFile')?.files||[]);
        const startedAt=Date.now();
        if(files.length)setTimeout(async()=>{
          for(const f of files){try{await postProcessFile(f,startedAt)}catch(err){console.error('Catalogue post-process',err);toast(err.message||'Could not build location catalogue.')}}
        },250);
        return; // allow the existing v2.10.80 uploader to store/extract the file
      }

      const rev=e.target.closest?.('[data-asb80-review]');
      if(rev){e.preventDefault();e.stopImmediatePropagation();showReview(rev.dataset.asb80Review);return;}
      const app=e.target.closest?.('[data-asb80-approve],[data-cat86-approve]');
      if(app){e.preventDefault();e.stopImmediatePropagation();approve(app.dataset.cat86Approve||app.dataset.asb80Approve);return;}
      const conf=e.target.closest?.('[data-cat86-confirm]');
      if(conf){e.preventDefault();e.stopImmediatePropagation();confirmCatalogue(conf.dataset.cat86Confirm);return;}
      const loc=e.target.closest?.('[data-cat86-edit-location]');
      if(loc){e.preventDefault();e.stopImmediatePropagation();editLocation(loc.dataset.cat86EditLocation);return;}
      const amp=e.target.closest?.('[data-cat86-review-amp]');
      if(amp){e.preventDefault();e.stopImmediatePropagation();processExistingAmp(amp.dataset.cat86ReviewAmp);return;}
    },true);

    [300,900,2000].forEach(ms=>setTimeout(decorateSources,ms));
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-view="admin"],[data-management-tile-key="admin"]'))setTimeout(decorateSources,180);
    },true);

    global.SafetyAsbestosCatalogueV21086={showReview,decorateSources,processExistingAmp};
  }
  boot();
})(typeof window!=='undefined'?window:globalThis);
