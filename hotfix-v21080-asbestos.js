/* Safety Tracker v2.10.80 - asbestos importer and evidence */
'use strict';
(function(){
  if(window.__ASBESTOS_V21080)return; window.__ASBESTOS_V21080=true;
  function boot(){var c=window.SafetyTrackerV2;if(!c||!c.state||!c.sb)return setTimeout(boot,150);install(c);}
  function install(core){
    var st=core.state,sb=core.sb,$=function(id){return document.getElementById(id);};
    var clean=function(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();};
    var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
    var admin=function(){return st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&!(st.offline||st.uiMode==='user');};
    var toast=function(m){try{core.toast(m);}catch(_e){}};
    var today=function(){return new Date().toISOString().slice(0,10);};
    var uuid=function(){return crypto.randomUUID();};
    function modal(t,h){if(typeof window.openModal==='function')return window.openModal(t,h);var d=$('modal');$('modalTitle').textContent=t;$('modalBody').innerHTML=h;if(d&&!d.open)d.showModal();}
    function loc(id){return (st.siteLocations||[]).find(function(x){return x.id===id;})||null;}
    function locPath(id){var a=[],x=loc(id),g=0;while(x&&g++<30){a.unshift(x.name);x=x.parent_id?loc(x.parent_id):null;}return a.join(' > ')||'Unknown';}
    function sourceFor(e){return (st.asbestosSources||[]).find(function(x){return x.id===e.source_document_id;})||null;}

    function enhance(){
      var list=$('asbestosSourceAdminList'),card=list&&list.closest('.section-card');
      if(card&&admin()){
        var f=$('asbestosSourceFile');if(f){f.multiple=true;f.accept='application/pdf,.pdf';}
        var t=$('asbestosSourceType');if(t&&!t.dataset.asb80){t.dataset.asb80='1';t.innerHTML='<option value="AUTO">Auto-detect type</option><option value="AMP">Asbestos Management Plan</option><option value="MANAGEMENT_SURVEY">Management Survey</option><option value="R_AND_D_SURVEY">Refurbishment / Demolition Survey</option><option value="REINSPECTION">Reinspection</option><option value="LAB_RESULT">Lab / bulk analysis</option><option value="REMOVAL">Removal evidence</option><option value="CLEARANCE">Clearance evidence</option><option value="OTHER">Other asbestos document</option>';}
        var b=$('uploadAsbestosSourceBtn');if(b)b.textContent='Upload & analyse asbestos file(s)';
        var h=card.querySelector('.hint-box');if(h)h.innerHTML='<strong>Single-copy storage.</strong> The full PDF is stored once in controlled Documents. Asbestos Management keeps extracted findings, file/page references and small compressed evidence previews.';
        if(!$('asbestosImportQueueV21080')){var q=document.createElement('div');q.id='asbestosImportQueueV21080';q.style.marginTop='12px';card.appendChild(q);}
        renderQueue();
      }
      installMultiLookup();
    }

    function detectType(text,chosen){
      if(chosen&&chosen!=='AUTO')return chosen;var t=String(text||'').toLowerCase();
      if(/certificate of reoccupation|four[- ]stage clearance|clearance certificate/.test(t))return 'CLEARANCE';
      if(/asbestos removal|removal completion|remediation/.test(t))return 'REMOVAL';
      if(/bulk analysis|laboratory report|sample analysis/.test(t))return 'LAB_RESULT';
      if(/reinspection|re-inspection/.test(t))return 'REINSPECTION';
      if(/refurbishment.{0,35}demolition|demolition.{0,35}survey|refurbishment survey/.test(t))return 'R_AND_D_SURVEY';
      if(/asbestos management plan|management plan for asbestos/.test(t))return 'AMP';
      if(/management survey|asbestos survey|survey report/.test(t))return 'MANAGEMENT_SURVEY';
      return 'OTHER';
    }
    async function readPdf(file){
      var pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,pages=[];
      for(var n=1;n<=pdf.numPages;n++){
        var p=await pdf.getPage(n),tc=await p.getTextContent(),items=tc.items.map(function(i){return {s:clean(i.str),x:Number(i.transform&&i.transform[4]||0),y:Number(i.transform&&i.transform[5]||0)};}).filter(function(i){return i.s;}),rows=[];
        items.forEach(function(it){var r=rows.find(function(x){return Math.abs(x.y-it.y)<2.5;});if(!r){r={y:it.y,a:[]};rows.push(r);}r.a.push(it);});
        rows.sort(function(a,b){return b.y-a.y;});var lineObjs=rows.map(function(r){var a=r.a.sort(function(a,b){return a.x-b.x;});return {text:a.map(function(i){return i.s;}).join(' '),x:a.length?a[0].x:0};}),lines=lineObjs.map(function(r){return r.text;});
        pages.push({n:n,p:p,lines:lines,lineObjs:lineObjs,text:lines.join('\n')});
      }return {pdf:pdf,pages:pages};
    }
    var aliases=[
      ['raw_location',['location','area / location','room / area','room']],
      ['external_ref',['acm reference','item reference','reference','ref']],
      ['material',['material / product','material description','material','product type']],
      ['asbestos_type',['asbestos type','fibre type','fiber type']],
      ['identification_status',['identification status','result','status']],
      ['extent',['extent / quantity','extent','quantity']],
      ['condition',['condition / damage','condition','damage']],
      ['surface_treatment',['surface treatment']],['material_assessment',['material assessment']],['priority_assessment',['priority assessment']],
      ['risk_rating',['risk rating','risk category']],['management_action',['management action','recommended action','recommendation']],
      ['action_due_date',['action due date','due date']],['sample_reference',['sample reference','sample ref','sample no']],
      ['accessibility',['accessibility','access']],['applies_to_descendants',['applies to descendants','applies throughout','applies to sublocations']],['precise_location',['precise location','position within area','position']],['notes',['notes / comments','notes','comments']]
    ];
    function field(line){var s=clean(line);for(var i=0;i<aliases.length;i++){for(var j=0;j<aliases[i][1].length;j++){var a=aliases[i][1][j],rx=new RegExp('^'+a.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')+'\\s*[:\\-]?\\s*','i');if(rx.test(s))return {k:aliases[i][0],v:s.replace(rx,'').trim()};}}return null;}
    function normStatus(v){var s=String(v||'').toUpperCase();if(/NOT.?DETECTED|NEGATIVE|NO ASBESTOS/.test(s))return 'NOT_DETECTED';if(/STRONGLY/.test(s))return 'STRONGLY_PRESUMED';if(/CONFIRM|POSITIVE|DETECTED/.test(s))return 'CONFIRMED';return 'PRESUMED';}
    function pathFor(raw){
      var s=clean(raw).replace(/\s*[›>]\s*/g,' > '),bits=s.split(/\s+>\s+|\s+\/\s+/).map(clean).filter(Boolean);if(bits.length>1)return {a:bits,c:.96};
      var tops=(st.siteLocations||[]).filter(function(x){return !x.parent_id&&x.active!==false;}),low=s.toLowerCase(),top=tops.find(function(x){return low.indexOf(String(x.name||'').toLowerCase())>=0;});
      if(top){bits=[top.name];var fl=s.match(/((?:ground|basement|first|second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s+floor)/i),rm=s.match(/((?:room|bedroom|suite)\s*[-#]?\s*[A-Z]?\d+[A-Z]?)/i);if(fl)bits.push(fl[1]);if(rm)bits.push(rm[1]);return {a:bits,c:bits.length>1?.9:.99};}
      var floor=s.match(/((?:ground|basement|first|second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s+floor)/i),room=s.match(/((?:room|bedroom|suite)\s*[-#]?\s*[A-Z]?\d+[A-Z]?)/i);
      if(room){bits=['Guest Rooms'];if(floor)bits.push(floor[1]);bits.push(room[1]);return {a:bits,c:floor?.86:.72};}
      return {a:[s],c:.45};
    }
    function parsePage(p,type){
      var f={},cur=null,objs=p.lineObjs||p.lines.map(function(text){return {text:text,x:0};});objs.forEach(function(obj,idx){var line=obj.text,z=field(line);if(z){cur=z.k;if(z.v)f[cur]=clean((f[cur]?f[cur]+' ':'')+z.v);else if(idx>0){var prev=objs[idx-1],pf=field(prev.text);if(!pf&&prev.x>obj.x+80&&prev.text)f[cur]=clean(prev.text+' '+(f[cur]||''));}}else if(cur&&line&&!/^page\s+\d+/i.test(line))f[cur]=clean((f[cur]?f[cur]+' ':'')+line);});
      if(!f.material||!f.raw_location)return null;var status=normStatus(f.identification_status||f.asbestos_type),no=status==='NOT_DETECTED',na=/not accessed|no access|inaccessible/i.test((f.material||'')+' '+(f.notes||'')+' '+(f.accessibility||'')),path=pathFor(f.raw_location);
      return {external_ref:f.external_ref||null,source_page:String(p.n),record_kind:na?'NO_ACCESS':no?'NON_ACM':'ACM',lifecycle_event:na?'NO_ACCESS':no?'NEGATIVE':type==='REINSPECTION'?'REINSPECT':type==='LAB_RESULT'?'CONFIRM':type==='REMOVAL'?'REMOVE':type==='CLEARANCE'?'CLEAR':'ADD_PRESENT',raw_location:f.raw_location,location_path:path.a,proposed_location_types:path.a.map(function(x,i){return i===0?'AREA':/floor/i.test(x)?'FLOOR':/^(room|bedroom|suite)/i.test(x)?'ROOM':'AREA';}),location_confidence:path.c,precise_location:f.precise_location||null,material:f.material,asbestos_type:f.asbestos_type||null,identification_status:na?'PRESUMED':status,extent:f.extent||null,condition:f.condition||null,surface_treatment:f.surface_treatment||null,material_assessment:f.material_assessment||null,priority_assessment:f.priority_assessment||null,risk_rating:f.risk_rating||null,management_action:f.management_action||null,accessibility:f.accessibility||null,applies_to_descendants:/\byes\b|throughout|all/i.test(f.applies_to_descendants||''),sample_reference:f.sample_reference||null,notes:f.notes||null,confidence:.95,review_status:path.c>=.75?'READY':'REVIEW',excerpt:p.text.slice(0,6500)};
    }
    function parsePages(pages,type){var m=new Map();pages.forEach(function(p){var x=parsePage(p,type);if(!x)return;var k=(x.external_ref||'').toLowerCase()||((x.raw_location||'').toLowerCase()+'|'+(x.material||'').toLowerCase());if(!m.has(k))m.set(k,x);});return Array.from(m.values());}

    async function controlled(file,title,date,version,hash){
      var d=await sb.from('documents').insert({title:title,reference:null,doc_type:'ASBESTOS',status:'ACTIVE',resign_on_new_version:false,created_by:st.user.id,delivery_method:'SELF_TRAINING',review_required:false,training_schedule_mode:null}).select().single();if(d.error)throw d.error;
      var safe=(core.safeFileName?core.safeFileName(title):title.replace(/[^a-z0-9._-]+/gi,'-'))+'.pdf',path='documents/'+d.data.id+'/'+uuid()+'-'+safe,up=await sb.storage.from('safety-files').upload(path,file,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;
      var v=await sb.from('document_versions').insert({document_id:d.data.id,version_label:version||'1',issue_date:date||today(),storage_path:path,file_name:safe,notes:'Controlled asbestos source. Full PDF stored once.',status:'CURRENT',created_by:st.user.id,content_text_sha256:hash,approval_status:'APPROVED',approved_at:new Date().toISOString(),approved_by:st.user.id,approval_context:'ASBESTOS_SOURCE_UPLOAD'}).select().single();if(v.error)throw v.error;
      if(st.documents)st.documents.push(d.data);if(st.versions)st.versions.push(v.data);return {d:d.data,v:v.data};
    }
    async function snippet(pdf,pn,sourceId){
      try{var p=await pdf.getPage(pn),v0=p.getViewport({scale:1}),sc=Math.min(1.35,900/v0.width),vp=p.getViewport({scale:sc}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;var blob=await new Promise(function(r){c.toBlob(r,'image/jpeg',.5);});if(!blob)return null;var path='asbestos-snippets/'+sourceId+'/p'+pn+'-'+uuid()+'.jpg',u=await sb.storage.from('safety-files').upload(path,blob,{contentType:'image/jpeg',upsert:false});return u.error?null:{path:path,w:c.width,h:c.height};}catch(_e){return null;}
    }
    async function analyse(file,chosen,titleInput,dateInput,versionInput){
      var hash=null;try{hash=await core.hashPdf(file);}catch(_e){}
      if(hash){var du=await sb.from('asbestos_source_documents_v280').select('id,title').eq('source_hash',hash).eq('active',true).maybeSingle();if(!du.error&&du.data){toast('Already loaded: '+du.data.title);return null;}}
      var p=await readPdf(file),text=p.pages.map(function(x){return x.text;}).join('\n'),type=detectType(text,chosen),title=titleInput||file.name.replace(/\.pdf$/i,''),ctl=await controlled(file,title,dateInput,versionInput||'1',hash);
      var sr=await sb.from('asbestos_source_documents_v280').insert({document_type:type,title:title,document_date:dateInput||null,version_label:versionInput||'1',file_name:file.name,active:true,uploaded_by:st.user.id,source_hash:hash,import_status:/^(AMP|OTHER)$/.test(type)?'APPROVED':'ANALYSING',detected_document_type:type,linked_document_id:ctl.d.id,linked_document_version_id:ctl.v.id,notes:'Full PDF stored once in controlled Documents.'}).select().single();if(sr.error)throw sr.error;if(st.asbestosSources)st.asbestosSources.unshift(sr.data);
      if(/^(AMP|OTHER)$/.test(type))return {source:sr.data,id:null};
      var items=parsePages(p.pages,type),warn=[];if(!text.trim())warn.push('Image-only/scanned PDF: no searchable text found. Add findings manually or upload an OCR/searchable copy.');if(!items.length)warn.push('No structured findings extracted automatically. Add findings manually before approval.');
      var ba=await sb.from('asbestos_import_batches_v21080').insert({source_document_id:sr.data.id,source_hash:hash,detected_document_type:type,parser_name:'BROWSER_PDF_V21080',status:'REVIEW_READY',item_count:items.length,proposed_location_count:items.filter(function(x){return x.location_confidence<1;}).length,warning_count:warn.length,raw_metadata:{file_name:file.name,page_count:p.pages.length,storage_mode:'SINGLE_CONTROLLED_COPY'},warnings:warn,created_by:st.user.id}).select().single();if(ba.error)throw ba.error;
      var created=[];for(var i=0;i<items.length;i++){var x=items[i],r=await sb.from('asbestos_import_items_v21080').insert({import_id:ba.data.id,item_no:i+1,external_ref:x.external_ref,source_page:x.source_page,record_kind:x.record_kind,lifecycle_event:x.lifecycle_event,raw_location:x.raw_location,location_path:x.location_path,proposed_location_types:x.proposed_location_types,location_confidence:x.location_confidence,precise_location:x.precise_location,applies_to_descendants:x.applies_to_descendants,material:x.material,asbestos_type:x.asbestos_type,identification_status:x.identification_status,extent:x.extent,condition:x.condition,surface_treatment:x.surface_treatment,material_assessment:x.material_assessment,priority_assessment:x.priority_assessment,risk_rating:x.risk_rating,management_action:x.management_action,accessibility:x.accessibility,sample_reference:x.sample_reference,notes:x.notes,confidence:x.confidence,review_status:x.review_status,raw_data:{excerpt:x.excerpt}}).select().single();if(r.error)throw r.error;created.push(r.data);}
      var cache=new Map();for(var j=0;j<created.length;j++){var it=created[j],pn=Number(it.source_page||0);if(!pn)continue;var im=cache.get(pn);if(im===undefined){im=await snippet(p.pdf,pn,sr.data.id);cache.set(pn,im||null);}await sb.from('asbestos_evidence_snippets_v21080').insert({import_item_id:it.id,source_document_id:sr.data.id,source_page:pn,excerpt:String(it.raw_data&&it.raw_data.excerpt||'').slice(0,7000),image_storage_path:im&&im.path||null,image_mime:im?'image/jpeg':null,image_width:im&&im.w||null,image_height:im&&im.h||null,evidence_kind:'PAGE',created_by:st.user.id});}
      await sb.from('asbestos_source_documents_v280').update({import_status:'REVIEW_REQUIRED',extraction_summary:{parser:'BROWSER_PDF_V21080',page_count:p.pages.length,item_count:created.length,storage_mode:'SINGLE_CONTROLLED_COPY'}}).eq('id',sr.data.id);
      return {source:sr.data,id:ba.data.id};
    }

    async function upload(){
      if(!admin())return toast('Admin access required.');if(st.offline||!navigator.onLine)return toast('Reconnect before uploading asbestos files.');
      var files=Array.from($('asbestosSourceFile')&&$('asbestosSourceFile').files||[]);if(!files.length)return toast('Choose one or more PDF files.');
      var chosen=$('asbestosSourceType')&&$('asbestosSourceType').value||'AUTO',title=clean($('asbestosSourceTitle')&&$('asbestosSourceTitle').value),date=$('asbestosSourceDate')&&$('asbestosSourceDate').value||null,version=clean($('asbestosSourceVersion')&&$('asbestosSourceVersion').value)||'1',status=$('asbestosSourceAdminStatus'),last=null,ok=0;
      if(status){status.hidden=false;status.textContent='Analysing '+files.length+' file(s)…';}
      for(var i=0;i<files.length;i++){try{last=await analyse(files[i],chosen,files.length===1?title:'',date,version);ok++;if(status)status.textContent='Analysed '+(i+1)+'/'+files.length+': '+files[i].name;}catch(e){console.error(e);toast(files[i].name+': '+(e.message||'Import failed'));}}
      $('asbestosSourceFile').value='';await refresh();renderQueue();if(last&&last.id)review(last.id);else if(ok)toast(ok+' asbestos file(s) loaded.');
    }
    async function refresh(){var a=await Promise.all([sb.from('site_locations_v280').select('*').eq('active',true).order('sort_order'),sb.from('asbestos_source_documents_v280').select('*').order('created_at',{ascending:false}),sb.from('asbestos_register_entries_v280').select('*').eq('active',true)]);if(!a[0].error)st.siteLocations=a[0].data||[];if(!a[1].error)st.asbestosSources=a[1].data||[];if(!a[2].error)st.asbestosEntries=a[2].data||[];renderMulti();}
    async function renderQueue(){var q=$('asbestosImportQueueV21080');if(!q||!admin())return;var r=await sb.from('asbestos_import_batches_v21080').select('*').in('status',['DRAFT','REVIEW_READY']).order('created_at',{ascending:false}),rows=r.data||[];q.innerHTML=rows.map(function(x){var s=(st.asbestosSources||[]).find(function(z){return z.id===x.source_document_id;});return '<div class="item-card compact traffic-amber"><div class="row-between"><div><strong>'+esc(s&&s.title||'Asbestos import')+'</strong><div class="meta"><span>'+x.item_count+' extracted</span><span>'+x.warning_count+' warnings</span></div></div><button class="primary small" type="button" data-asb80-review="'+x.id+'">Review</button></div></div>';}).join('');}
    async function review(id){var a=await Promise.all([sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single(),sb.from('asbestos_import_items_v21080').select('*').eq('import_id',id).order('item_no')]);if(a[0].error||a[1].error)return toast((a[0].error||a[1].error).message);var b=a[0].data,items=a[1].data||[],un=items.filter(function(x){return x.review_status==='REVIEW';}).length,w=Array.isArray(b.warnings)?b.warnings:[];modal('Asbestos import review','<div class="hint-box"><strong>'+items.length+' record(s) extracted.</strong> '+(un?un+' need review.':'Ready to approve.')+'</div>'+(w.length?'<div class="pending-use-warning">'+w.map(esc).join('<br>')+'</div>':'')+'<div class="row"><button class="secondary" type="button" data-asb80-add="'+id+'">Add finding</button></div><div class="card-list">'+items.map(function(x){var p=Array.isArray(x.location_path)?x.location_path.join(' > '):'';return '<div class="item-card compact traffic-'+(x.review_status==='REVIEW'?'amber':'green')+'"><strong>'+esc(x.external_ref||('Item '+x.item_no))+' · '+esc(x.material)+'</strong><div class="meta"><span>'+esc(p||x.raw_location||'Location required')+'</span><span>page '+esc(x.source_page||'—')+'</span><span>'+esc(x.lifecycle_event)+'</span></div><button class="secondary small" type="button" data-asb80-edit="'+x.id+'">Review / edit</button></div>';}).join('')+'</div><div class="actions"><button class="primary" type="button" data-asb80-approve="'+id+'" '+(un||!items.length?'disabled':'')+'>Approve & publish</button></div>');}
    async function edit(id){var r=await sb.from('asbestos_import_items_v21080').select('*').eq('id',id).single();if(r.error)return toast(r.error.message);var x=r.data,p=Array.isArray(x.location_path)?x.location_path.join(' > '):'',np=prompt('Location hierarchy, e.g. Guest Rooms > 2nd Floor > Room 214',p||x.raw_location||'');if(np===null)return;var mat=prompt('Material / product',x.material||'');if(mat===null||!clean(mat))return;var ev=prompt('Lifecycle: ADD_PRESENT, CONFIRM, REINSPECT, REMOVE, CLEAR, NEGATIVE, NO_ACCESS',x.lifecycle_event||'ADD_PRESENT');if(ev===null)return;var page=prompt('Source page number',x.source_page||''),bits=clean(np).split(/\s*>\s*/).map(clean).filter(Boolean),types=bits.map(function(z,i){return i===0?'AREA':/floor/i.test(z)?'FLOOR':/^(room|bedroom|suite)/i.test(z)?'ROOM':'AREA';});var u=await sb.from('asbestos_import_items_v21080').update({raw_location:bits.join(' > '),location_path:bits,proposed_location_types:types,location_confidence:1,material:clean(mat),lifecycle_event:clean(ev).toUpperCase(),source_page:clean(page)||null,review_status:'READY',updated_at:new Date().toISOString()}).eq('id',id).select('import_id').single();if(u.error)return toast(u.error.message);review(u.data.import_id);}
    async function add(id){var c=await sb.from('asbestos_import_items_v21080').select('id',{count:'exact',head:true}).eq('import_id',id),n=(c.count||0)+1,r=await sb.from('asbestos_import_items_v21080').insert({import_id:id,item_no:n,record_kind:'ACM',lifecycle_event:'ADD_PRESENT',raw_location:'',location_path:[],proposed_location_types:[],material:'New finding',identification_status:'PRESUMED',confidence:0,review_status:'REVIEW'}).select().single();if(r.error)return toast(r.error.message);edit(r.data.id);}
    async function approve(id){if(!confirm('Approve this reviewed asbestos import and publish it to the live register?'))return;var r=await sb.rpc('approve_asbestos_import_v21081',{p_import_id:id});if(r.error)return toast(r.error.message);await refresh();try{await core.loadAll();}catch(_e){}await refresh();renderQueue();try{$('modal').close();}catch(_e){}toast('Asbestos import approved. Register, history and locations updated.');}

    async function openSource(payload){var p=String(payload).split('|'),sid=p[0],page=Math.max(1,Number(p[1]||1)),s=(st.asbestosSources||[]).find(function(x){return x.id===sid;});if(!s||!s.linked_document_version_id)return toast('Source document is not linked.');var v=(st.versions||[]).find(function(x){return x.id===s.linked_document_version_id;});if(!v){var q=await sb.from('document_versions').select('*').eq('id',s.linked_document_version_id).single();if(q.error)return toast(q.error.message);v=q.data;}var d=await sb.storage.from('safety-files').download(v.storage_path);if(d.error||!d.data)return toast('Could not open source PDF.');var base=URL.createObjectURL(d.data),w=window.open(base+'#page='+page,'_blank');if(!w)location.href=base+'#page='+page;setTimeout(function(){URL.revokeObjectURL(base);},180000);}
    async function evidence(id){var r=await sb.from('asbestos_evidence_snippets_v21080').select('*').eq('entry_id',id).order('source_page').limit(1);if(r.error)return toast(r.error.message);var x=r.data&&r.data[0];if(!x)return toast('No preview stored.');if(x.image_storage_path){var d=await sb.storage.from('safety-files').download(x.image_storage_path);if(!d.error&&d.data){var u=URL.createObjectURL(d.data);return modal('Asbestos evidence · page '+(x.source_page||'—'),'<img src="'+u+'" style="max-width:100%;height:auto"><p class="muted">'+esc(x.excerpt||'')+'</p>');}}modal('Asbestos evidence','<p>'+esc(x.excerpt||'No excerpt stored.')+'</p>');}

    function scoped(ids){var cm=new Map();(st.siteLocations||[]).forEach(function(l){var k=l.parent_id||'';if(!cm.has(k))cm.set(k,[]);cm.get(k).push(l.id);});var roots=new Set(ids),scope=new Set(ids),stack=ids.slice();while(stack.length){var x=stack.pop();(cm.get(x)||[]).forEach(function(c){if(!scope.has(c)){scope.add(c);stack.push(c);}});}var anc=new Set();ids.forEach(function(id){var x=loc(id)&&loc(id).parent_id,g=0;while(x&&g++<30){anc.add(x);x=loc(x)&&loc(x).parent_id;}});return (st.asbestosEntries||[]).filter(function(e){return e.active!==false&&['PRESENT','UNKNOWN'].indexOf(String(e.lifecycle_status||'PRESENT').toUpperCase())>=0&&(scope.has(e.location_id)||(e.applies_to_descendants&&anc.has(e.location_id)));});}
    function installMultiLookup(){var host=$('asbestosLookupList');if(!host)return;var sec=$('asbestosMultiLookupV21080');if(!sec){sec=document.createElement('div');sec.id='asbestosMultiLookupV21080';sec.className='section-card';sec.innerHTML='<h3>Whole floor / multiple area lookup</h3><p class="muted">Select one room, a whole floor, or several areas. A floor includes all rooms beneath it automatically.</p><select id="asbestosMultiSelectV21080" multiple size="8" style="width:100%"></select><div id="asbestosMultiSummaryV21080" style="margin-top:10px"></div><div id="asbestosMultiRowsV21080" class="card-list"></div>';host.parentNode.insertBefore(sec,host);$('asbestosMultiSelectV21080').addEventListener('change',renderMulti);}var s=$('asbestosMultiSelectV21080'),keep=Array.from(s.selectedOptions||[]).map(function(o){return o.value;});s.innerHTML=(st.siteLocations||[]).filter(function(l){return l.active!==false;}).map(function(l){return '<option value="'+esc(l.id)+'">'+esc(locPath(l.id))+'</option>';}).join('');Array.from(s.options).forEach(function(o){o.selected=keep.indexOf(o.value)>=0;});}
    function renderMulti(){var s=$('asbestosMultiSelectV21080');if(!s)return;var ids=Array.from(s.selectedOptions||[]).map(function(o){return o.value;}),sum=$('asbestosMultiSummaryV21080'),box=$('asbestosMultiRowsV21080');if(!ids.length){sum.innerHTML='<div class="hint-box">Select one or more work areas.</div>';box.innerHTML='';return;}var rows=scoped(ids);sum.innerHTML=rows.length?'<div class="danger-note"><strong>'+rows.length+' current known/presumed ACM record(s) apply.</strong></div>':'<div class="hint-box"><strong>No current ACM is recorded for this scope.</strong> This is not proof that asbestos is absent.</div>';box.innerHTML=rows.map(function(e){var src=sourceFor(e);return '<div class="item-card traffic-amber"><h4>'+esc(locPath(e.location_id))+' · '+esc(e.material)+'</h4><div class="meta"><span>'+esc(e.identification_status||'')+'</span>'+(e.condition?'<span>Condition: '+esc(e.condition)+'</span>':'')+'</div>'+(e.precise_location?'<p><strong>Position:</strong> '+esc(e.precise_location)+'</p>':'')+(src?'<p class="muted"><strong>Source:</strong> '+esc(src.title)+(e.source_page?' · page '+esc(e.source_page):'')+'</p><div class="row"><button class="secondary small" type="button" data-asb80-evidence="'+e.id+'">View evidence</button><button class="secondary small" type="button" data-asb80-source="'+src.id+'|'+(e.source_page||1)+'">Open source page</button></div>':'')+'</div>';}).join('');}

    document.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('#uploadAsbestosSourceBtn');if(b){e.preventDefault();e.stopImmediatePropagation();upload();return;}
      var r=e.target.closest&&e.target.closest('[data-asb80-review]');if(r){e.preventDefault();review(r.dataset.asb80Review);return;}
      var ed=e.target.closest&&e.target.closest('[data-asb80-edit]');if(ed){e.preventDefault();edit(ed.dataset.asb80Edit);return;}
      var ad=e.target.closest&&e.target.closest('[data-asb80-add]');if(ad){e.preventDefault();add(ad.dataset.asb80Add);return;}
      var ap=e.target.closest&&e.target.closest('[data-asb80-approve]');if(ap){e.preventDefault();approve(ap.dataset.asb80Approve);return;}
      var so=e.target.closest&&e.target.closest('[data-asb80-source]');if(so){e.preventDefault();openSource(so.dataset.asb80Source);return;}
      var ev=e.target.closest&&e.target.closest('[data-asb80-evidence]');if(ev){e.preventDefault();evidence(ev.dataset.asb80Evidence);return;}
    },true);
    [250,900,2200].forEach(function(ms){setTimeout(enhance,ms);});window.addEventListener('pageshow',function(){setTimeout(enhance,120);});
    window.SafetyAsbestosV21080={refresh:refresh,review:review,openSource:openSource};
  }
  boot();
})();
