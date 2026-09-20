/* Safety Tracker v2.10.88 - full asbestos document analysis + reconciliation review */
'use strict';
(function(){
  if(window.__ASBESTOS_FULL_ANALYSIS_V21088)return;
  window.__ASBESTOS_FULL_ANALYSIS_V21088=true;

  function boot(){
    var base=window.AsbestosCatalogueParserV21086;
    var core=window.SafetyTrackerV2;
    if(!base||!core||!core.sb||!core.state){setTimeout(boot,80);return;}
    install(base,core);
  }

  function install(base,core){
    var sb=core.sb,st=core.state,$=function(id){return document.getElementById(id);};
    var clean=function(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();};
    var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
    var toast=function(m){try{core.toast(m);}catch(_e){}};

    function isoDate(v){
      var s=clean(v);if(!s)return null;
      var months='January February March April May June July August September October November December'.split(' ');
      var m=s.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
      if(m){
        var mi=months.findIndex(function(x){return x.toLowerCase()===m[2].toLowerCase();})+1;
        return m[3]+'-'+String(mi).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
      }
      m=s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
      return m?m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0'):null;
    }

    function allLines(pages){
      return (pages||[]).flatMap(function(p){
        return (p.lines||[]).map(function(t){return {page:p.n||p.page,text:clean(t)};});
      }).filter(function(x){return x.text;});
    }

    function labelValues(pages,specs){
      var rows=allLines(pages),out={},arr=[];
      Object.keys(specs).forEach(function(k){specs[k].forEach(function(a){arr.push({k:k,a:a});});});
      arr.sort(function(a,b){return b.a.length-a.a.length;});
      rows.forEach(function(row){
        for(var i=0;i<arr.length;i++){
          var x=arr[i];if(out[x.k])continue;
          var rx=new RegExp('^'+x.a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\s*[:\\-]\\s*|\\s+)(.+)$','i');
          var m=row.text.match(rx);
          if(m&&clean(m[1])){out[x.k]=clean(m[1]);break;}
        }
      });
      return out;
    }

    var boiler=/^(?:TEST \/ DEMO ONLY|Safety Tracker test dataset|Asbestos Management Plan - Test Dataset|Asbestos Management Survey - Test Dataset|Page \d+|END OF TEST DOCUMENT|END OF TEST SURVEY)/i;
    var ampHeadings=[
      /^Purpose and scope$/i,/^(?:Test )?location hierarchy$/i,/^Management objectives$/i,
      /^Responsibilities\b/i,/^Source survey$/i,/^Asbestos register summary/i,
      /^Control procedure before maintenance or contractor work$/i,
      /^Condition monitoring and action priorities$/i,
      /^Emergency \/ accidental disturbance test workflow$/i,/^Review and test closure$/i
    ];
    var surveyHeadings=[
      /^\d+\.\s+Survey purpose$/i,/^\d+\.\s+Survey scope and limitations$/i,
      /^\d+\.\s+Location schedule$/i,/^\d+\.\s+Register summary$/i,/^Detailed finding\b/i
    ];

    function sectionText(pages,startPatterns,headings){
      var rows=allLines(pages),start=-1;
      for(var i=0;i<rows.length;i++){
        if(startPatterns.some(function(rx){return rx.test(rows[i].text);})){start=i+1;break;}
      }
      if(start<0)return null;
      var vals=[];
      for(var j=start;j<rows.length;j++){
        var t=rows[j].text;
        if(boiler.test(t))continue;
        if(headings.some(function(rx){return rx.test(t);}))break;
        if(t==='')continue;
        vals.push(t.replace(/^[•▪◦]\s*/,''));
      }
      return clean(vals.join(' '))||null;
    }

    function extractLocationListSection(pages){
      var rows=allLines(pages),out=[],inSec=false,allHeads=ampHeadings.concat(surveyHeadings);
      for(var i=0;i<rows.length;i++){
        var t=rows[i].text;
        if(/^(?:\d+\.\s*)?(?:test\s+)?location (?:schedule|hierarchy)$/i.test(t)){inSec=true;continue;}
        if(inSec&&allHeads.some(function(rx){return rx.test(t);})){break;}
        if(!inSec||boiler.test(t)||t==='')continue;
        t=clean(t.replace(/^[•▪◦]\s*/,''));
        if(!t||/[.!?]$/.test(t)||t.length>90)continue;
        if(/^[A-Z][A-Za-z0-9 &/'()\-]+$/.test(t))out.push(t);
      }
      return Array.from(new Set(out));
    }

    function extractAmpSummary(pages){
      var kv=labelValues(pages,{
        document_reference:['Document reference','Document ref','Report reference','Reference'],
        version:['Version','Revision'],issue_date:['Issue date','Date issued','Document date'],
        review_date:['Review date','Next review','Review due'],site:['Site','Property','Premises'],
        prepared_by:['Prepared by','Author'],status:['Status'],
        dutyholder:['Dutyholder / accountable role','Dutyholder','Accountable role','Responsible person'],
        asbestos_coordinator:['Asbestos coordinator','Asbestos manager','Coordinator'],
        deputy:['Deputy asbestos coordinator','Deputy'],
        survey_provider:['Survey provider','Survey company','Surveyor'],
        testing_note:['Testing note']
      });
      var text=allLines(pages).map(function(x){return x.text;}).join('\n');
      var refs=Array.from(new Set((text.match(/\bASB-\d{3,}\b/gi)||[]).map(function(x){return x.toUpperCase();})));
      var src=sectionText(pages,[/^Source survey$/i],ampHeadings);
      var sm=src&&src.match(/\b(ASB-[A-Z0-9-]+)\b(?:,?\s*version\s*([A-Z0-9.]+))?(?:,?\s*dated\s*([^.;]+))?/i);
      return Object.assign({},kv,{
        issue_date_iso:isoDate(kv.issue_date),review_date_iso:isoDate(kv.review_date),
        purpose_scope:sectionText(pages,[/^Purpose and scope$/i],ampHeadings),
        location_hierarchy:extractLocationListSection(pages),
        source_survey:src,source_survey_reference:sm?sm[1]:null,
        source_survey_version:sm?(sm[2]||null):null,source_survey_date_iso:sm?isoDate(sm[3]):null,
        management_objectives:sectionText(pages,[/^Management objectives$/i],ampHeadings),
        contractor_controls:sectionText(pages,[/^Control procedure before maintenance or contractor work$/i],ampHeadings),
        monitoring:sectionText(pages,[/^Condition monitoring and action priorities$/i],ampHeadings),
        emergency_procedure:sectionText(pages,[/^Emergency \/ accidental disturbance test workflow$/i],ampHeadings),
        review_closeout:sectionText(pages,[/^Review and test closure$/i],ampHeadings),
        register_refs:refs,register_ref_count:refs.length
      });
    }

    function extractSurveySummary(pages){
      var kv=labelValues(pages,{
        survey_reference:['Survey reference','Report reference','Reference'],
        survey_type:['Survey type','Type of survey'],version:['Version','Revision'],
        survey_date:['Survey date','Inspection date'],report_date:['Report date','Issue date'],
        site:['Site','Property','Premises'],surveyor:['Surveyor','Surveyed by'],status:['Status']
      });
      return Object.assign({},kv,{
        survey_date_iso:isoDate(kv.survey_date),report_date_iso:isoDate(kv.report_date),
        purpose:sectionText(pages,[/^\d+\.\s+Survey purpose$/i],surveyHeadings),
        scope_limitations:sectionText(pages,[/^\d+\.\s+Survey scope and limitations$/i],surveyHeadings),
        location_schedule:extractLocationListSection(pages)
      });
    }

    var aliases=[
      ['raw_location',['area / location','room / area','location','room']],
      ['external_ref',['acm reference','item reference','reference','item ref','ref']],
      ['material',['material / product','material description','product type','material']],
      ['asbestos_type',['asbestos type','asbestos fibre','asbestos fiber','fibre type','fiber type']],
      ['identification_status',['identification status','result','status']],
      ['extent',['extent / quantity','quantity','extent']],['condition',['condition / damage','condition','damage']],
      ['surface_treatment',['surface treatment']],['material_assessment',['material assessment']],
      ['priority_assessment',['priority assessment']],['risk_rating',['risk rating','risk category']],
      ['management_action',['management action','recommended action','recommendation']],
      ['action_due_text',['action due date','due date','review due']],
      ['sample_reference',['sample / evidence','sample reference','sample ref','sample no','sample number']],
      ['accessibility',['accessibility','access']],
      ['applies_to_descendants',['applies to descendants','applies throughout','applies to sublocations']],
      ['precise_location',['precise location','position within area','position']],
      ['notes',['notes / comments','comments','notes']]
    ];
    var aliasRows=[];aliases.forEach(function(row){row[1].forEach(function(a){aliasRows.push({k:row[0],a:a});});});
    aliasRows.sort(function(a,b){return b.a.length-a.a.length;});

    function field(line){
      var s=clean(line);
      for(var i=0;i<aliasRows.length;i++){
        var a=aliasRows[i],rx=new RegExp('^'+a.a.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')+'(?=\\s|:|\\-|$)\\s*[:\\-]?\\s*','i');
        if(rx.test(s))return {k:a.k,v:s.replace(rx,'').trim()};
      }
      return null;
    }
    function normStatus(v){
      var s=String(v||'').toUpperCase();
      if(/NOT.?DETECTED|NEGATIVE|NO ASBESTOS/.test(s))return 'NOT_DETECTED';
      if(/STRONGLY/.test(s))return 'STRONGLY_PRESUMED';
      if(/CONFIRM|POSITIVE|DETECTED/.test(s))return 'CONFIRMED';
      return 'PRESUMED';
    }
    function stopLine(s){return /^(?:source page\b|detailed finding\b|test \/ demo|safety tracker test dataset|asbestos management survey|survey conclusion\b|end of test survey)/i.test(clean(s));}
    function pathFor(raw,tops){
      var s=clean(raw).replace(/\s*[›>]\s*/g,' > '),bits=s.split(/\s+>\s+|\s+\/\s+/).map(clean).filter(Boolean);
      if(bits.length>1)return {a:bits,c:.96};
      var low=s.toLowerCase(),top=(tops||[]).find(function(x){return low.indexOf(String(x).toLowerCase())>=0;});
      var floorRx=/((?:ground|lower ground|basement|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|\d+(?:st|nd|rd|th))\s+floor)/i;
      var roomRx=/((?:room|bedroom|suite)\s*[-#]?\s*[A-Z]?\d+[A-Z]?)/i;
      if(top){
        bits=[top];var fl=s.match(floorRx),rm=s.match(roomRx);if(fl)bits.push(fl[1]);if(rm)bits.push(rm[1]);
        return {a:bits,c:bits.length>1?.9:.99};
      }
      var floor=s.match(floorRx),room=s.match(roomRx);
      if(room){bits=['Guest Rooms'];if(floor)bits.push(floor[1]);bits.push(room[1]);return {a:bits,c:floor?.86:.72};}
      return {a:[s],c:.45};
    }

    function parseSurveyPage(p,tops){
      var f={},objs=p.lineObjs||p.lines.map(function(text,idx){return {text:text,x:0,y:-idx*12};}),anchors=[];
      for(var i=0;i<objs.length;i++){
        var line=clean(objs[i].text),z=field(line);
        if(z)anchors.push({idx:i,k:z.k,x:Number(objs[i].x||0),y:Number(objs[i].y||0),parts:z.v?[{y:Number(objs[i].y||0),idx:i,text:z.v}]:[]});
      }
      if(!anchors.length)return null;
      for(var j=0;j<objs.length;j++){
        var obj=objs[j],txt=clean(obj.text);if(!txt||field(txt)||stopLine(txt))continue;
        var best=null,bestDist=1e9;
        for(var a=0;a<anchors.length;a++){
          var an=anchors[a];if(Number(obj.x||0)<=an.x+55)continue;
          var dist=Math.abs(Number(obj.y||0)-an.y);if(dist>34)continue;
          if(dist<bestDist){best=an;bestDist=dist;}
        }
        if(best)best.parts.push({y:Number(obj.y||0),idx:j,text:txt});
      }
      anchors.forEach(function(an){
        if(!an.parts.length)return;
        an.parts.sort(function(a,b){return a.y===b.y?a.idx-b.idx:b.y-a.y;});
        var value=clean(an.parts.map(function(x){return x.text;}).join(' '));
        if(value)f[an.k]=clean((f[an.k]?f[an.k]+' ':'')+value);
      });
      if(!f.material||!f.raw_location)return null;
      var status=normStatus(f.identification_status||f.asbestos_type),
          no=status==='NOT_DETECTED',
          na=/not accessed|no access|inaccessible/i.test((f.material||'')+' '+(f.notes||'')+' '+(f.accessibility||'')),
          path=pathFor(f.raw_location,tops||[]),
          dueDate=isoDate(f.action_due_text);
      return {
        external_ref:f.external_ref||null,source_page:String(p.n||p.page),
        record_kind:na?'NO_ACCESS':no?'NON_ACM':'ACM',
        lifecycle_event:na?'NO_ACCESS':no?'NEGATIVE':'ADD_PRESENT',
        raw_location:f.raw_location,location_path:path.a,
        proposed_location_types:path.a.map(function(x,i){return i===0?(/guest rooms/i.test(x)?'GUEST_ROOMS':'AREA'):/floor/i.test(x)?'FLOOR':/^(room|bedroom|suite)/i.test(x)?'ROOM':'AREA';}),
        location_confidence:path.c,precise_location:f.precise_location||null,
        material:f.material,asbestos_type:f.asbestos_type||null,identification_status:na?'PRESUMED':status,
        extent:f.extent||null,condition:f.condition||null,surface_treatment:f.surface_treatment||null,
        material_assessment:f.material_assessment||null,priority_assessment:f.priority_assessment||null,
        risk_rating:f.risk_rating||null,management_action:f.management_action||null,
        action_due_date:dueDate,action_due_text:f.action_due_text||null,accessibility:f.accessibility||null,
        applies_to_descendants:/\byes\b|throughout|all/i.test(f.applies_to_descendants||''),
        sample_reference:f.sample_reference||null,notes:f.notes||null,confidence:.95,
        review_status:path.c>=.75?'READY':'REVIEW',excerpt:p.text.slice(0,6500)
      };
    }

    function extractSurveyItems(pages,tops){
      var m=new Map();
      (pages||[]).forEach(function(p){
        var x=parseSurveyPage(p,tops||[]);if(!x)return;
        var k=(x.external_ref||'').toLowerCase()||((x.raw_location||'').toLowerCase()+'|'+(x.material||'').toLowerCase());
        if(!m.has(k))m.set(k,x);
      });
      return Array.from(m.values());
    }

    function enhancedCatalogue(pages,items,tops){
      var result=base.extractLocationCatalogue(pages,items||[],tops||[]);
      var rows=result.rows||[],seen=new Map(rows.map(function(r){return [(r.location_path||[]).map(function(x){return clean(x).toLowerCase();}).join('>'),r];}));
      extractLocationListSection(pages).forEach(function(raw){
        var path=base.pathForRaw?base.pathForRaw(raw,tops||[]):pathFor(raw,tops||[]).a;
        var k=path.map(function(x){return clean(x).toLowerCase();}).join('>');
        if(seen.has(k))return;
        var types=path.map(function(x,i){return i===0?(/guest rooms/i.test(x)?'GUEST_ROOMS':'AREA'):/floor/i.test(x)?'FLOOR':/^(room|bedroom|suite)/i.test(x)?'ROOM':'AREA';});
        var rec={raw_location:raw,location_path:path,proposed_location_types:types,source_page:null,coverage_status:'LISTED',confidence:.98,review_status:'READY',source_kind:'LOCATION_SECTION'};
        rows.push(rec);seen.set(k,rec);
      });
      result.rows=rows;result.unique_count=rows.length;
      result.room_count=rows.filter(function(r){var a=r.proposed_location_types||[];return a[a.length-1]==='ROOM';}).length;
      return result;
    }

    window.AsbestosCatalogueParserV21086=Object.assign({},base,{
      extractAmpSummary:extractAmpSummary,
      extractSurveySummary:extractSurveySummary,
      extractSurveyItems:extractSurveyItems,
      extractLocationCatalogue:enhancedCatalogue,
      extractLocationListSection:extractLocationListSection,
      isoDateV21088:isoDate
    });

    var originalShowReview=window.SafetyAsbestosCatalogueV21086&&window.SafetyAsbestosCatalogueV21086.showReview;

    function detailGrid(fields){
      var rows=fields.filter(function(x){return x[1];});
      if(!rows.length)return '';
      return '<div class="form-grid">'+rows.map(function(x){return '<div><strong>'+esc(x[0])+'</strong><div>'+esc(x[1])+'</div></div>';}).join('')+'</div>';
    }

    function longSection(title,text){
      return text?'<div style="margin-top:12px"><strong>'+esc(title)+'</strong><p>'+esc(text)+'</p></div>':'';
    }

    async function fullReview(id){
      var a=await Promise.all([
        sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single(),
        sb.from('asbestos_import_items_v21080').select('*').eq('import_id',id).order('item_no'),
        sb.from('asbestos_import_locations_v21086').select('*').eq('import_id',id).order('location_no')
      ]);
      if(a[0].error||a[1].error||a[2].error)return toast((a[0].error||a[1].error||a[2].error).message);
      var b=a[0].data,items=a[1].data||[],locs=a[2].data||[],meta=b.raw_metadata||{};
      if(String(meta.reanalysis_mode||'').indexOf('FULL_EXISTING_SOURCE')!==0){
        if(originalShowReview)return originalShowReview(id);
      }
      var sr=await sb.from('asbestos_source_documents_v280').select('*').eq('id',b.source_document_id).single();
      if(sr.error)return toast(sr.error.message);
      var source=sr.data,amp=meta.amp_summary||{},survey=meta.survey_summary||{},cmp=meta.comparison||{},cat=meta.location_catalogue||{};
      var itemReview=items.filter(function(x){return x.review_status==='REVIEW';}).length;
      var locReview=locs.filter(function(x){return x.review_status==='REVIEW';}).length;
      var surveyType=['MANAGEMENT_SURVEY','R_AND_D_SURVEY','REINSPECTION'].indexOf(source.document_type)>=0;
      var needsCat=surveyType&&cat.completeness_state==='NO_DECLARED_TOTAL'&&!cat.reviewer_confirmed;
      var mismatch=surveyType&&cat.completeness_state==='MISMATCH';
      var missing=Number(cmp.missing_existing_count||0),needsMissing=missing>0&&!cmp.missing_existing_confirmed;
      var blocked=!!(itemReview||locReview||needsCat||mismatch||needsMissing);

      var intro='<div class="hint-box"><strong>'+esc(source.title)+'</strong><br>'+
        items.length+' ACM/finding record(s) · '+locs.length+' unique location(s) · '+esc(cat.duplicate_mentions||0)+' duplicate location mention(s) collapsed.</div>';

      var doc='';
      if(source.document_type==='AMP'){
        doc='<div class="section-card"><h3>Management Plan details</h3>'+
          detailGrid([
            ['Document reference',amp.document_reference],['Version',amp.version],['Issue date',amp.issue_date],
            ['Review date',amp.review_date],['Site',amp.site],['Prepared by',amp.prepared_by],['Status',amp.status],
            ['Dutyholder / accountable role',amp.dutyholder],['Asbestos coordinator',amp.asbestos_coordinator],
            ['Deputy',amp.deputy],['Survey provider',amp.survey_provider],
            ['Source survey reference',amp.source_survey_reference],['Source survey version',amp.source_survey_version]
          ])+
          longSection('Purpose and scope',amp.purpose_scope)+
          longSection('Management objectives',amp.management_objectives)+
          longSection('Source survey',amp.source_survey)+
          longSection('Contractor / maintenance controls',amp.contractor_controls)+
          longSection('Condition monitoring / priorities',amp.monitoring)+
          longSection('Emergency / accidental disturbance procedure',amp.emergency_procedure)+
          longSection('Review / closure',amp.review_closeout)+
          (amp.register_ref_count!=null?'<div class="hint-box"><strong>Register cross-check:</strong> '+esc(amp.register_ref_count)+' ACM reference(s) listed in the AMP.'+
             (cmp.amp_missing_live_refs&&cmp.amp_missing_live_refs.length?' Missing from live register: '+esc(cmp.amp_missing_live_refs.join(', '))+'.':' All listed references currently exist in the live register.')+'</div>':'')+
          '</div>';
      }else{
        doc='<div class="section-card"><h3>Survey details</h3>'+
          detailGrid([
            ['Survey reference',survey.survey_reference],['Survey type',survey.survey_type],['Version',survey.version],
            ['Survey date',survey.survey_date],['Report date',survey.report_date],['Site',survey.site],
            ['Surveyor',survey.surveyor],['Status',survey.status]
          ])+
          longSection('Survey purpose',survey.purpose)+
          longSection('Scope and limitations',survey.scope_limitations)+
          '</div>';
      }

      var cmpHtml='';
      if(source.document_type!=='AMP'){
        cmpHtml='<div class="section-card"><h3>Re-analysis comparison</h3>'+
          '<div class="meta"><span>'+Number(cmp.unchanged_count||0)+' unchanged</span><span>'+Number(cmp.changed_count||0)+' changed</span><span>'+Number(cmp.new_count||0)+' new</span><span>'+missing+' missing from fresh extraction</span></div>'+
          (missing?'<div class="danger-note"><strong>'+missing+' existing ACM record(s) were not found in the fresh extraction.</strong><br>They will NOT be deleted automatically.'+
            (cmp.missing_existing_refs&&cmp.missing_existing_refs.length?'<br>'+esc(cmp.missing_existing_refs.join(', ')):'')+'</div>':'')+
          '</div>';
      }

      var catHtml='';
      if(cat.completeness_state==='VERIFIED'){
        catHtml='<div class="success-note"><strong>Location count verified:</strong> '+esc(cat.declared_count)+' declared / '+esc(cat.declared_kind==='rooms'?cat.room_count:cat.unique_count)+' extracted.</div>';
      }else if(mismatch){
        catHtml='<div class="danger-note"><strong>Location mismatch:</strong> source declares '+esc(cat.declared_count)+' '+esc(cat.declared_kind)+', but '+esc(cat.declared_kind==='rooms'?cat.room_count:cat.unique_count)+' were extracted. Approval is blocked.</div>';
      }else if(needsCat){
        catHtml='<div class="pending-use-warning"><strong>No declared location total found.</strong> '+esc(cat.unique_count||0)+' unique location(s), including '+esc(cat.room_count||0)+' room(s), were extracted. Confirm the catalogue after checking the source.</div>';
      }else if(cat.unique_count!=null){
        catHtml='<div class="success-note"><strong>Location catalogue:</strong> '+esc(cat.unique_count||0)+' unique location(s), including '+esc(cat.room_count||0)+' room(s).</div>';
      }

      var locSample=locs.filter(function(x){return x.review_status==='REVIEW';});
      if(!locSample.length)locSample=locs.slice(0,12);
      var locHtml=locs.length?'<div class="section-card"><h3>Location catalogue</h3><p class="muted">Showing '+locSample.length+(locSample.length<locs.length?' of '+locs.length:'')+'.</p>'+
        locSample.map(function(x){return '<div class="item-card compact traffic-'+(x.review_status==='REVIEW'?'amber':'green')+'"><strong>'+esc((x.location_path||[]).join(' > ')||x.raw_location)+'</strong><div class="meta"><span>'+esc(x.coverage_status)+'</span><span>page '+esc(x.source_page||'—')+'</span></div>'+(x.review_status==='REVIEW'?'<button type="button" class="secondary small" data-cat86-edit-location="'+x.id+'">Review</button>':'')+'</div>';}).join('')+
        '</div>':'';

      var itemHtml=items.length?'<div class="section-card"><h3>ACM / finding extraction</h3>'+
        items.map(function(x){
          var cp=x.raw_data&&x.raw_data.comparison||{},status=cp.status||'NEW';
          var tone=status==='CHANGED'?'amber':status==='NEW'?'amber':'green';
          return '<div class="item-card compact traffic-'+tone+'"><strong>'+esc(x.external_ref||('Item '+x.item_no))+' · '+esc(x.material)+'</strong>'+
            '<div class="meta"><span>'+esc((x.location_path||[]).join(' > ')||x.raw_location)+'</span><span>page '+esc(x.source_page||'—')+'</span><span>'+esc(status)+'</span></div>'+
            (cp.changed_fields&&cp.changed_fields.length?'<div class="muted">Changed: '+esc(cp.changed_fields.join(', '))+'</div>':'')+
            '<button type="button" class="secondary small" data-asb80-edit="'+x.id+'">Review / edit</button></div>';
        }).join('')+'</div>':'';

      var actions='<div class="actions">'+
        (needsCat?'<button type="button" class="secondary" data-cat88-confirm-catalogue="'+id+'">Confirm location catalogue</button>':'')+
        (needsMissing?'<button type="button" class="secondary" data-cat88-confirm-missing="'+id+'">Keep missing existing records</button>':'')+
        '<button type="button" class="primary" data-cat88-approve="'+id+'" '+(blocked?'disabled':'')+'>Approve re-analysis</button></div>';

      var modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
      if(title)title.textContent=source.document_type==='AMP'?'Review Asbestos Management Plan':'Review full asbestos survey re-analysis';
      if(body)body.innerHTML=intro+doc+cmpHtml+catHtml+locHtml+itemHtml+actions;
      if(modal&&!modal.open)modal.showModal();
    }

    async function confirmCatalogue(id){
      var r=await sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single();if(r.error)return toast(r.error.message);
      var meta=r.data.raw_metadata||{},cat=Object.assign({},meta.location_catalogue||{},{reviewer_confirmed:true});
      var u=await sb.from('asbestos_import_batches_v21080').update({raw_metadata:Object.assign({},meta,{location_catalogue:cat}),updated_at:new Date().toISOString()}).eq('id',id);
      if(u.error)return toast(u.error.message);fullReview(id);
    }

    async function confirmMissing(id){
      var r=await sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single();if(r.error)return toast(r.error.message);
      var meta=r.data.raw_metadata||{},cmp=Object.assign({},meta.comparison||{},{missing_existing_confirmed:true});
      var u=await sb.from('asbestos_import_batches_v21080').update({raw_metadata:Object.assign({},meta,{comparison:cmp}),updated_at:new Date().toISOString()}).eq('id',id);
      if(u.error)return toast(u.error.message);fullReview(id);
    }

    async function approveReanalysis(id){
      if(!confirm('Approve this full re-analysis? Existing ACMs will be reconciled, genuinely new findings may be added, and missing existing records will not be deleted automatically.'))return;
      var r=await sb.rpc('approve_asbestos_reanalysis_v21088',{p_import_id:id});
      if(r.error)return toast(r.error.message);
      try{$('modal').close();}catch(_e){}
      try{await core.loadAll();}catch(_e){}
      var x=r.data||{};
      toast('Re-analysis approved: '+(x.reconciled_entries||0)+' reconciled, '+(x.new_entries||0)+' new, '+(x.location_catalog_count||0)+' location(s).');
    }

    if(window.SafetyAsbestosCatalogueV21086)window.SafetyAsbestosCatalogueV21086.showReview=fullReview;

    document.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('[data-cat88-approve]');
      if(a){e.preventDefault();e.stopImmediatePropagation();approveReanalysis(a.dataset.cat88Approve);return;}
      var c=e.target.closest&&e.target.closest('[data-cat88-confirm-catalogue]');
      if(c){e.preventDefault();e.stopImmediatePropagation();confirmCatalogue(c.dataset.cat88ConfirmCatalogue);return;}
      var m=e.target.closest&&e.target.closest('[data-cat88-confirm-missing]');
      if(m){e.preventDefault();e.stopImmediatePropagation();confirmMissing(m.dataset.cat88ConfirmMissing);return;}
    },true);

    window.SafetyAsbestosFullAnalysisV21088={
      extractAmpSummary:extractAmpSummary,
      extractSurveySummary:extractSurveySummary,
      extractSurveyItems:extractSurveyItems,
      extractLocationCatalogue:enhancedCatalogue,
      showReview:fullReview
    };
  }

  boot();
})();