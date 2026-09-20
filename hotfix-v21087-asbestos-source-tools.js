/* Safety Tracker v2.10.88 - full existing-source re-analysis + TEST delete */
'use strict';
(function(){
  if(window.__ASBESTOS_SOURCE_TOOLS_V21087)return;
  window.__ASBESTOS_SOURCE_TOOLS_V21087=true;

  function boot(){
    var core=window.SafetyTrackerV2,parser=window.AsbestosCatalogueParserV21086;
    if(!core||!core.state||!core.sb||!parser||!parser.extractSurveyItems||!window.SafetyAsbestosFullAnalysisV21088){setTimeout(boot,120);return;}
    install(core,parser);
  }

  function install(core,parser){
    var st=core.state,sb=core.sb,$=function(id){return document.getElementById(id);};
    var clean=function(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();};
    var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
    var toast=function(m){try{core.toast(m);}catch(_e){}};
    var isAdmin=function(){return st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&!(st.offline||st.uiMode==='user');};
    var testRx=/(^|[^a-z0-9])(test|demo)([^a-z0-9]|$)/i;

    function isExplicitTest(s){return testRx.test(String(s&&s.title||''))||testRx.test(String(s&&s.file_name||''));}

    async function readPdf(blob){
      var pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,pages=[];
      for(var n=1;n<=pdf.numPages;n++){
        var page=await pdf.getPage(n),tc=await page.getTextContent(),
            items=tc.items.map(function(i){return {s:clean(i.str),x:Number(i.transform&&i.transform[4]||0),y:Number(i.transform&&i.transform[5]||0)};}).filter(function(i){return i.s;}),
            rows=[];
        items.forEach(function(it){
          var r=rows.find(function(x){return Math.abs(x.y-it.y)<2.5;});
          if(!r){r={y:it.y,a:[]};rows.push(r);}r.a.push(it);
        });
        rows.sort(function(a,b){return b.y-a.y;});
        var lineObjs=rows.map(function(r){
          var a=r.a.sort(function(a,b){return a.x-b.x;});
          return {text:a.map(function(i){return i.s;}).join(' '),x:a.length?a[0].x:0,y:r.y};
        });
        pages.push({n:n,page:n,lineObjs:lineObjs,lines:lineObjs.map(function(r){return r.text;}),text:lineObjs.map(function(r){return r.text;}).join('\n')});
      }
      return pages;
    }

    async function sourceBlob(source){
      var path=null;
      if(source.linked_document_version_id){
        var vr=await sb.from('document_versions').select('storage_path').eq('id',source.linked_document_version_id).single();
        if(vr.error)throw vr.error;path=vr.data&&vr.data.storage_path||null;
      }
      if(!path)path=source.storage_path||null;
      if(!path)throw new Error('No stored PDF is linked to this source.');
      var d=await sb.storage.from('safety-files').download(path);
      if(d.error||!d.data)throw(d.error||new Error('Could not download stored PDF.'));
      return d.data;
    }

    async function freshSource(id){
      var r=await sb.from('asbestos_source_documents_v280').select('*').eq('id',id).single();
      if(r.error)throw r.error;return r.data;
    }

    async function removePreviousReanalysis(sourceId){
      var r=await sb.from('asbestos_import_batches_v21080').select('id,parser_name,status').eq('source_document_id',sourceId).in('status',['DRAFT','REVIEW_READY']);
      if(r.error)throw r.error;
      var ids=(r.data||[]).filter(function(x){return ['BROWSER_REANALYSIS_V21087','BROWSER_FULL_REANALYSIS_V21088'].indexOf(x.parser_name)>=0;}).map(function(x){return x.id;});
      if(ids.length){
        var d=await sb.from('asbestos_import_batches_v21080').delete().in('id',ids);
        if(d.error)throw d.error;
      }
    }

    function norm(v){return clean(v).toLowerCase();}
    var compareFields=['raw_location','material','asbestos_type','identification_status','extent','condition','surface_treatment','material_assessment','priority_assessment','risk_rating','management_action','action_due_text','sample_reference','notes'];

    function compareItem(item,existing){
      if(!existing)return {status:'NEW',changed_fields:[]};
      var changed=[];
      compareFields.forEach(function(k){
        var incoming=item[k],current=(k==='raw_location'?null:existing[k]);
        if(k==='raw_location')return;
        if(incoming!=null&&clean(incoming)!==''&&norm(incoming)!==norm(current))changed.push(k.replaceAll('_',' '));
      });
      if(item.source_page&&String(item.source_page)!==String(existing.source_page||''))changed.push('source page');
      return {status:changed.length?'CHANGED':'UNCHANGED',changed_fields:changed};
    }

    async function stageLocations(batch,source,pages,items){
      var tops=(st.siteLocations||[]).filter(function(x){return !x.parent_id&&x.active!==false;}).map(function(x){return x.name;});
      var cat=parser.extractLocationCatalogue(pages,items||[],tops);
      await sb.from('asbestos_import_locations_v21086').delete().eq('import_id',batch.id);
      for(var i=0;i<cat.rows.length;i+=100){
        var rows=cat.rows.slice(i,i+100).map(function(x,j){return {
          import_id:batch.id,location_no:i+j+1,raw_location:x.raw_location,
          location_path:x.location_path,proposed_location_types:x.proposed_location_types,
          source_page:x.source_page||null,coverage_status:x.coverage_status,
          confidence:x.confidence,review_status:x.review_status,raw_data:{source_kind:x.source_kind,reanalysis:true}
        };});
        if(rows.length){
          var r=await sb.from('asbestos_import_locations_v21086').insert(rows);if(r.error)throw r.error;
        }
      }
      return cat;
    }

    async function stageSurveyItems(batch,source,pages){
      var tops=(st.siteLocations||[]).filter(function(x){return !x.parent_id&&x.active!==false;}).map(function(x){return x.name;});
      var items=parser.extractSurveyItems(pages,tops),refs=items.map(function(x){return x.external_ref;}).filter(Boolean);
      var sourceQ=await sb.from('asbestos_register_entries_v280').select('*').eq('active',true).eq('source_document_id',source.id);
      if(sourceQ.error)throw sourceQ.error;
      var matchRows=[].concat(sourceQ.data||[]);
      if(refs.length){
        var matchQ=await sb.from('asbestos_register_entries_v280').select('*').eq('active',true).in('record_ref',refs);
        if(matchQ.error)throw matchQ.error;
        (matchQ.data||[]).forEach(function(x){if(!matchRows.some(function(y){return y.id===x.id;}))matchRows.push(x);});
      }
      var byRef=new Map(matchRows.filter(function(x){return x.record_ref;}).map(function(x){return [String(x.record_ref).toLowerCase(),x];}));
      var extractedRefs=new Set(refs.map(function(x){return String(x).toLowerCase();}));
      var missing=(sourceQ.data||[]).filter(function(x){return x.record_ref&&!extractedRefs.has(String(x.record_ref).toLowerCase());});
      var counts={UNCHANGED:0,CHANGED:0,NEW:0};

      var created=[];
      for(var i=0;i<items.length;i++){
        var x=items[i],existing=x.external_ref?byRef.get(String(x.external_ref).toLowerCase()):null,cmp=compareItem(x,existing);
        counts[cmp.status]=(counts[cmp.status]||0)+1;
        var r=await sb.from('asbestos_import_items_v21080').insert({
          import_id:batch.id,item_no:i+1,external_ref:x.external_ref,source_page:x.source_page,
          record_kind:x.record_kind,lifecycle_event:x.lifecycle_event,event_date:null,
          raw_location:x.raw_location,location_path:x.location_path,proposed_location_types:x.proposed_location_types,
          location_confidence:x.location_confidence,precise_location:x.precise_location,
          applies_to_descendants:x.applies_to_descendants,material:x.material,asbestos_type:x.asbestos_type,
          identification_status:x.identification_status,extent:x.extent,condition:x.condition,
          surface_treatment:x.surface_treatment,material_assessment:x.material_assessment,
          priority_assessment:x.priority_assessment,risk_rating:x.risk_rating,
          management_action:x.management_action,action_due_date:x.action_due_date,action_due_text:x.action_due_text,
          accessibility:x.accessibility,sample_reference:x.sample_reference,notes:x.notes,
          match_entry_id:existing&&existing.id||null,confidence:x.confidence,
          review_status:x.review_status,raw_data:{excerpt:x.excerpt,comparison:cmp}
        }).select().single();
        if(r.error)throw r.error;created.push(r.data);
      }
      return {
        parsed:items,created:created,
        comparison:{
          unchanged_count:counts.UNCHANGED||0,changed_count:counts.CHANGED||0,new_count:counts.NEW||0,
          missing_existing_count:missing.length,missing_existing_refs:missing.map(function(x){return x.record_ref;}).filter(Boolean),
          missing_existing_confirmed:missing.length===0
        }
      };
    }

    async function reanalyse(id){
      if(!isAdmin())return toast('Admin access required.');
      if(st.offline||!navigator.onLine)return toast('Reconnect before re-analysing an asbestos source.');
      try{
        var source=await freshSource(id),status=$('asbestosSourceAdminStatus');
        if(status){status.hidden=false;status.textContent='Full re-analysis: '+source.title+'…';}
        var blob=await sourceBlob(source),pages=await readPdf(blob);
        await removePreviousReanalysis(source.id);

        var amp=source.document_type==='AMP'?parser.extractAmpSummary(pages):null;
        var survey=source.document_type!=='AMP'?parser.extractSurveySummary(pages):null;
        var provisional=await sb.from('asbestos_import_batches_v21080').insert({
          source_document_id:source.id,source_hash:source.source_hash,
          detected_document_type:source.detected_document_type||source.document_type,
          parser_name:'BROWSER_FULL_REANALYSIS_V21088',status:'REVIEW_READY',
          item_count:0,proposed_location_count:0,warning_count:0,
          raw_metadata:{
            reanalysis_mode:'FULL_EXISTING_SOURCE_V21088',
            source_file_name:source.file_name||null,page_count:pages.length,
            storage_mode:'REUSE_EXISTING_CONTROLLED_COPY',
            amp_summary:amp||undefined,survey_summary:survey||undefined
          },
          warnings:[],created_by:st.user.id
        }).select().single();
        if(provisional.error)throw provisional.error;
        var batch=provisional.data,itemResult={parsed:[],created:[],comparison:{unchanged_count:0,changed_count:0,new_count:0,missing_existing_count:0,missing_existing_refs:[],missing_existing_confirmed:true}};

        if(source.document_type!=='AMP')itemResult=await stageSurveyItems(batch,source,pages);
        var cat=await stageLocations(batch,source,pages,itemResult.parsed);

        var comparison=itemResult.comparison;
        if(amp&&Array.isArray(amp.register_refs)){
          var liveRefs=new Set((st.asbestosEntries||[]).filter(function(x){return x.active!==false&&x.record_ref;}).map(function(x){return String(x.record_ref).toUpperCase();}));
          comparison.amp_missing_live_refs=amp.register_refs.filter(function(x){return !liveRefs.has(String(x).toUpperCase());});
          comparison.amp_live_match_count=amp.register_refs.length-comparison.amp_missing_live_refs.length;
        }

        var warnings=[];
        var surveyType=['MANAGEMENT_SURVEY','R_AND_D_SURVEY','REINSPECTION'].indexOf(source.document_type)>=0;
        if(surveyType&&cat.completeness_state==='MISMATCH')warnings.push('Location count mismatch: approval is blocked until resolved.');
        if(surveyType&&cat.completeness_state==='NO_DECLARED_TOTAL')warnings.push('No declared location total found: review and confirm the extracted catalogue.');
        if(cat.unresolved_count)warnings.push(cat.unresolved_count+' extracted location(s) need review.');
        if(comparison.missing_existing_count)warnings.push(comparison.missing_existing_count+' existing ACM record(s) were not found by the fresh extraction; they will not be deleted automatically.');

        var meta={
          reanalysis_mode:'FULL_EXISTING_SOURCE_V21088',
          source_file_name:source.file_name||null,page_count:pages.length,
          storage_mode:'REUSE_EXISTING_CONTROLLED_COPY',
          location_catalogue:{
            source_candidate_count:cat.source_candidate_count,unique_count:cat.unique_count,room_count:cat.room_count,
            duplicate_mentions:cat.duplicate_mentions,unresolved_count:cat.unresolved_count,
            declared_count:cat.declared_count,declared_kind:cat.declared_kind,
            completeness_state:source.document_type==='AMP'&&cat.unique_count===0?'AMP_NOT_LOCATION_REGISTER':cat.completeness_state,
            reviewer_confirmed:source.document_type==='AMP'||cat.completeness_state==='VERIFIED'
          },
          comparison:comparison
        };
        if(amp)meta.amp_summary=amp;if(survey)meta.survey_summary=survey;

        var u=await sb.from('asbestos_import_batches_v21080').update({
          item_count:itemResult.created.length,proposed_location_count:cat.unique_count,
          warning_count:warnings.length,warnings:warnings,raw_metadata:meta,updated_at:new Date().toISOString()
        }).eq('id',batch.id).select().single();
        if(u.error)throw u.error;

        if(status)status.textContent='Full re-analysis ready: '+itemResult.created.length+' finding(s), '+cat.unique_count+' location(s), '+warnings.length+' warning(s).';
        await window.SafetyAsbestosFullAnalysisV21088.showReview(batch.id);
      }catch(e){
        console.error('Full asbestos re-analysis',e);toast(e&&e.message||'Could not re-analyse asbestos source.');
      }
    }

    async function deleteTest(id){
      if(!isAdmin())return toast('Admin access required.');
      var source;try{source=await freshSource(id);}catch(e){return toast(e.message);}
      if(!isExplicitTest(source))return toast('Delete is only available for explicitly labelled TEST or DEMO sources.');
      if(!confirm('Permanently delete TEST/DEMO source "'+source.title+'"?\n\nThis removes its test asbestos register data, test history, extracted evidence and its controlled PDF when that PDF is not used elsewhere.'))return;
      try{
        var r=await sb.rpc('delete_test_asbestos_source_v21087',{p_source_id:id});if(r.error)throw r.error;
        var result=r.data||{},paths=Array.isArray(result.storage_paths)?result.storage_paths.filter(Boolean):[],storageWarnings=0;
        for(var i=0;i<paths.length;i+=100){
          var rm=await sb.storage.from('safety-files').remove(paths.slice(i,i+100));
          if(rm.error){storageWarnings++;console.warn('TEST storage cleanup',rm.error);}
        }
        await core.loadAll();setTimeout(decorate,100);
        toast(storageWarnings?'TEST data deleted. Some orphaned storage files need cleanup.':'TEST data deleted.');
      }catch(e){console.error('Delete TEST asbestos source',e);toast(e&&e.message||'Could not delete TEST asbestos source.');}
    }

    function decorate(){
      var list=$('asbestosSourceAdminList');if(!list||!isAdmin())return;
      var rows=[].concat(st.asbestosSources||[]).sort(function(a,b){return new Date(b.created_at||0)-new Date(a.created_at||0);});
      var cards=Array.from(list.querySelectorAll(':scope > .item-card'));
      cards.forEach(function(card,i){
        var source=rows[i];if(!source)return;
        var tools=card.querySelector('.asb-source-tools-v21087');
        if(!tools){tools=document.createElement('div');tools.className='row asb-source-tools-v21087';card.appendChild(tools);}
        tools.innerHTML='<button type="button" class="secondary small" data-asb87-reanalyse="'+esc(source.id)+'">Re-analyse</button>'+
          (isExplicitTest(source)?'<button type="button" class="danger small" data-asb87-delete-test="'+esc(source.id)+'">Delete TEST</button>':'');
      });
    }

    document.addEventListener('click',function(e){
      var re=e.target.closest&&e.target.closest('[data-asb87-reanalyse]');
      if(re){e.preventDefault();e.stopImmediatePropagation();reanalyse(re.dataset.asb87Reanalyse);return;}
      var del=e.target.closest&&e.target.closest('[data-asb87-delete-test]');
      if(del){e.preventDefault();e.stopImmediatePropagation();deleteTest(del.dataset.asb87DeleteTest);return;}
    },true);

    var timer=0;
    function observe(){
      var list=$('asbestosSourceAdminList');if(!list)return setTimeout(observe,250);
      new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(decorate,50);}).observe(list,{childList:true,subtree:false});
      decorate();
    }
    observe();[300,900,1800,3000].forEach(function(ms){setTimeout(decorate,ms);});
    window.addEventListener('pageshow',function(){setTimeout(decorate,100);});

    window.SafetyAsbestosSourceToolsV21087={reanalyse:reanalyse,deleteTest:deleteTest,decorate:decorate,isExplicitTest:isExplicitTest};
  }

  boot();
})();