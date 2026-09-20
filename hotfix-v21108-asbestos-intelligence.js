/* Safety Tracker v2.11.8 - HSE-informed asbestos phrase intelligence + chronology-safe review */
'use strict';
(function(){
  if(window.__SAFETY_ASBESTOS_INTELLIGENCE_V2118)return;
  window.__SAFETY_ASBESTOS_INTELLIGENCE_V2118=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,120);return}
    install(core);
  }

  function install(core){
    const st=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const admin=()=>st.profile&&st.profile.report_only!==true&&String(st.profile.role||'').toLowerCase()==='admin'&&st.uiMode!=='user'&&!st.offline;
    const toast=m=>{try{core.toast?.(m)}catch(_e){}};
    let opening=false;

    function fmtDate(v){
      if(!v)return 'Not set';
      const d=new Date(String(v).length===10?v+'T12:00:00':v);
      return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('en-GB');
    }
    function locPath(id,rows){
      const by=new Map((rows||[]).map(x=>[x.id,x])),a=[];let x=by.get(id),n=0;
      while(x&&n++<30){a.unshift(x.name);x=x.parent_id?by.get(x.parent_id):null}
      return a.join(' > ');
    }
    function pathKey(v){return norm(Array.isArray(v)?v.join(' > '):v)}
    function materialWords(v){
      const stop=new Set(['asbestos','containing','material','acm','the','and','with','within','to','of','in','on','at','existing','suspect','presumed','confirmed']);
      return new Set(norm(v).split(' ').filter(x=>x.length>2&&!stop.has(x)));
    }
    function similarity(a,b){
      const A=materialWords(a),B=materialWords(b);if(!A.size||!B.size)return 0;
      let hit=0;A.forEach(x=>{if(B.has(x))hit++});
      return hit/Math.min(A.size,B.size);
    }
    function group(v){
      const t=norm(v);
      if(/\bloose fill\b|\bcavity insulation\b/.test(t))return'LOOSE_FILL';
      if(/\bsprayed (coating|insulation|asbestos)\b|\bflock\b/.test(t))return'SPRAYED_COATING';
      if(/\b(pipe|boiler) lagging\b|\bthermal insulation\b/.test(t))return'THERMAL_INSULATION_LAGGING';
      if(/\baib\b|\basbestos insulating board\b|\basbestos insulation board\b/.test(t))return'AIB';
      if(/\bmillboard\b/.test(t))return'MILLBOARD';
      if(/\basbestos cement\b|\bcement (sheet|panel|roof|flue|duct|gutter|downpipe|tank|cistern|soffit|fascia)\b/.test(t))return'ASBESTOS_CEMENT';
      if(/\btextured (decorative )?coating\b|\bartex\b/.test(t))return'TEXTURED_COATING';
      if(/\b(vinyl|thermoplastic) floor\b|\bfloor tile\b|\bbitumen adhesive\b|\bblack mastic\b|\bflooring mastic\b|\bstair nosing\b|\basbestos screed\b/.test(t))return'FLOORING_TILE_MASTIC';
      if(/\broofing felt\b|\bbitumen felt\b|\bdamp proof/.test(t))return'ROOFING_FELT_BITUMEN';
      if(/\basbestos paper\b|\bpaper backing\b|\basbestos felt\b/.test(t))return'PAPER_FELT';
      if(/\brope seal\b|\basbestos rope\b|\byarn\b|\bwoven cloth\b|\btextile\b/.test(t))return'TEXTILE_ROPE_YARN';
      if(/\bgasket\b|\bwasher\b|\brope cord\b/.test(t))return'GASKET_WASHER';
      return'OTHER_OR_UNCLASSIFIED';
    }
    function genericSample(v){return /^(n\/?a|none|no (real )?sample|not sampled|not applicable|presumed)$/i.test(clean(v))}
    function detectionDate(text){
      const s=String(text||'');
      const labels=['survey date','inspection date','reinspection date','re-inspection date','report date','issue date','date of report','removal date','clearance date'];
      for(const l of labels){
        const m=s.match(new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:\\-]?\\s*([^\\n]{0,45})','i'));
        if(m){const d=parseDate(m[1]);if(d)return d}
      }
      return null;
    }
    function parseDate(v){
      const s=clean(v).replace(/(\d)(st|nd|rd|th)\b/gi,'$1');
      let m=s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
      m=s.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})\b/);
      if(m&&+m[1]<=31&&+m[2]<=12)return`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
      m=s.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
      if(m){const a=['january','february','march','april','may','june','july','august','september','october','november','december'];return`${m[3]}-${String(a.indexOf(m[2].toLowerCase())+1).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`}
      return null;
    }

    async function enrich(id){
      const r=await sb.rpc('asbestos_enrich_import_v2118',{p_import_id:id});
      if(r.error)throw r.error;
      return r.data||{};
    }

    async function loadReview(id){
      await enrich(id);
      const [br,ir,lr,er,sr,sl]=await Promise.all([
        sb.from('asbestos_import_batches_v21080').select('*').eq('id',id).single(),
        sb.from('asbestos_import_items_v21080').select('*').eq('import_id',id).order('item_no'),
        sb.from('asbestos_import_locations_v21086').select('*').eq('import_id',id).order('location_no'),
        sb.from('asbestos_register_entries_v280').select('*').eq('active',true),
        sb.from('asbestos_source_documents_v280').select('*'),
        sb.from('site_locations_v280').select('*').eq('active',true)
      ]);
      const err=br.error||ir.error||lr.error||er.error||sr.error||sl.error;if(err)throw err;
      const b=br.data,source=(sr.data||[]).find(x=>x.id===b.source_document_id);
      return {b,source,items:ir.data||[],locs:lr.data||[],entries:er.data||[],sources:sr.data||[],locations:sl.data||[]};
    }

    async function autoMatch(d){
      const entryPath=new Map(d.entries.map(e=>[e.id,pathKey(locPath(e.location_id,d.locations))]));
      const sourceDate=d.source?.document_date||null;
      let changed=0;
      for(const i of d.items){
        if(i.match_entry_id||i.review_status==='SKIP')continue;
        const ip=pathKey(i.location_path||i.raw_location),ig=group(`${i.material||''} ${(i.raw_data?.excerpt)||''}`);
        let cand=[];
        if(clean(i.external_ref))cand=d.entries.filter(e=>clean(e.record_ref).toLowerCase()===clean(i.external_ref).toLowerCase());
        if(cand.length!==1&&clean(i.sample_reference)&&!genericSample(i.sample_reference))cand=d.entries.filter(e=>clean(e.sample_reference).toLowerCase()===clean(i.sample_reference).toLowerCase());
        if(cand.length!==1&&ip){
          cand=d.entries.filter(e=>{
            if(entryPath.get(e.id)!==ip)return false;
            const sim=similarity(i.material,e.material),eg=group(e.material||'');
            const threshold=i.record_kind==='NON_ACM'?0.76:0.58;
            return sim>=threshold||(ig!=='OTHER_OR_UNCLASSIFIED'&&ig===eg&&sim>=0.35);
          });
        }
        if(cand.length===1){
          const e=cand[0],intel={...(i.raw_data?.intelligence||{}),
            historical_match_entry_id:e.id,
            historical_match_basis:clean(i.external_ref)&&clean(e.record_ref).toLowerCase()===clean(i.external_ref).toLowerCase()?'RECORD_REFERENCE':
              clean(i.sample_reference)&&clean(e.sample_reference).toLowerCase()===clean(i.sample_reference).toLowerCase()?'SAMPLE_REFERENCE':'LOCATION_AND_MATERIAL',
            historical_match_existing_status:e.lifecycle_status,
            chronological_backfill:!!(sourceDate&&e.last_inspected_date&&sourceDate<e.last_inspected_date)
          };
          const u=await sb.from('asbestos_import_items_v21080').update({
            match_entry_id:e.id,raw_data:{...(i.raw_data||{}),intelligence:intel},updated_at:new Date().toISOString()
          }).eq('id',i.id);
          if(!u.error)changed++;
        }
      }
      if(changed)await enrich(d.b.id);
      return changed;
    }

    function concernRows(d){
      const live=d.entries.filter(e=>['PRESENT','UNKNOWN'].includes(String(e.lifecycle_status||'').toUpperCase())&&e.record_kind!=='NON_ACM');
      const ep=new Map(live.map(e=>[e.id,pathKey(locPath(e.location_id,d.locations))]));
      const matched=new Set(d.items.map(i=>i.match_entry_id).filter(Boolean));
      const itemPaths=new Set(d.items.map(i=>pathKey(i.location_path||i.raw_location)).filter(Boolean));
      const coveragePaths=new Set(d.locs.map(l=>pathKey(l.location_path||l.raw_location)).filter(Boolean));
      const allPaths=new Set([...itemPaths,...coveragePaths]);
      return live.filter(e=>allPaths.has(ep.get(e.id))&&!matched.has(e.id));
    }
    function knownAt(d,item){
      const ip=pathKey(item.location_path||item.raw_location);
      if(!ip)return[];
      return d.entries.filter(e=>['PRESENT','UNKNOWN'].includes(String(e.lifecycle_status||'').toUpperCase())&&e.record_kind!=='NON_ACM'&&pathKey(locPath(e.location_id,d.locations))===ip);
    }
    function sourceFor(d,e){return d.sources.find(s=>s.id===e.source_document_id)||null}

    function badge(label,tone='due'){return`<span class="badge ${tone}">${esc(label)}</span>`}
    function intelBadges(i){
      const x=i.raw_data?.intelligence||{},a=[];
      if(x.confirmed_present)a.push(badge('KNOWN / CONFIRMED ACM','overdue'));
      if(x.presumed_present)a.push(badge('PRESUMED ACM','overdue'));
      if(x.no_access_or_not_inspected)a.push(badge('NO ACCESS / NOT INSPECTED','overdue'));
      if(x.covered_or_encapsulated_in_situ)a.push(badge('REMAINS IN SITU · COVERED / ENCAPSULATED','overdue'));
      if(x.high_damage_or_friable_wording)a.push(badge('DAMAGE / FRIABLE WORDING','overdue'));
      if(x.explicit_removal_complete)a.push(badge('REMOVAL-COMPLETE WORDING','complete'));
      if(x.clearance_passed)a.push(badge('CLEARANCE / REOCCUPATION WORDING','complete'));
      if(x.clearance_failed)a.push(badge('FAILED CLEARANCE WORDING','overdue'));
      if(x.negative_no_asbestos)a.push(badge('NO ASBESTOS DETECTED','complete'));
      if(x.conflicting_wording)a.push(badge('CONFLICT — MANUAL REVIEW','overdue'));
      if(x.material_group&&x.material_group!=='OTHER_OR_UNCLASSIFIED')a.push(badge(x.material_group.replaceAll('_',' '),'neutral'));
      if(x.fibre_type_normalized&&x.fibre_type_normalized!=='NOT_STATED')a.push(badge(x.fibre_type_normalized.replaceAll('_',' '),'neutral'));
      return a.join('');
    }
    function safetyPanel(i,known){
      const x=i.raw_data?.intelligence||{};
      if(x.covered_or_encapsulated_in_situ)return`<div class="danger-note asb-v2118-stop"><strong>KNOWN/PRESUMED ACM REMAINS IN SITU.</strong><br>Covered, overlaid, enclosed or encapsulated is <strong>not removal</strong>. No drilling, cutting, screwing, lifting, chasing or disturbance unless the asbestos controls for that work are specifically authorised.</div>`;
      if(x.no_access_or_not_inspected)return`<div class="danger-note asb-v2118-stop"><strong>NO ACCESS / NOT INSPECTED.</strong><br>Treat the area as potentially containing asbestos until suitable information is obtained. Do not carry on with intrusive work on the basis of this survey result.</div>`;
      if(x.confirmed_present||x.presumed_present)return`<div class="danger-note asb-v2118-stop"><strong>${x.confirmed_present?'KNOWN':'PRESUMED'} ACM.</strong><br>This must remain visible in the register and be checked before work that could disturb it.</div>`;
      if(known.length&&x.negative_no_asbestos)return`<div class="danger-note asb-v2118-stop"><strong>HISTORICAL KNOWN ACM MATCHES THIS LOCATION.</strong><br>The new item says no asbestos detected. Check that it genuinely accounts for the same material. Removal/clearance evidence may still be missing.</div>`;
      if(known.length)return`<div class="danger-note asb-v2118-stop"><strong>KNOWN HISTORICAL ACM AT THIS LOCATION.</strong><br>${known.length} live historical register item${known.length===1?'':'s'} already apply here. They will not disappear merely because this report was uploaded later.</div>`;
      return'';
    }

    async function review(id){
      if(opening||!admin())return;opening=true;
      try{
        let d=await loadReview(id);
        const matched=await autoMatch(d);
        if(matched)d=await loadReview(id);
        const concerns=concernRows(d),meta=d.b.raw_metadata||{},intel=meta.intelligence||{};
        const critical=Number(intel.critical_count||0),conflicts=Number(intel.conflict_count||0);
        const ack=meta.intelligence_acknowledgement||{},ackAt=ack.at?new Date(ack.at):null;
        const latestUpdate=d.items.reduce((m,i)=>Math.max(m,new Date(i.updated_at||0).getTime()),0);
        const ackValid=critical===0||!!(ack.acknowledged&&ackAt&&ackAt.getTime()>=latestUpdate);
        const itemReview=d.items.filter(i=>i.review_status==='REVIEW').length;
        const locReview=d.locs.filter(i=>i.review_status==='REVIEW').length;
        const cat=meta.location_catalogue||{};
        const locationBlock=locReview||cat.completeness_state==='MISMATCH'||(cat.completeness_state==='NO_DECLARED_TOTAL'&&!cat.reviewer_confirmed);
        const missingDate=!d.source?.document_date&&!['AMP','OTHER'].includes(d.source?.document_type);
        const combined=d.items.map(i=>i.raw_data?.excerpt||'').join('\n');
        const suggested=missingDate?detectionDate(combined):null;

        const top=`<div class="asb-v2118-review-head">
          <div class="row-between"><div><h3>Asbestos safety review</h3><p class="muted">HSE-informed phrase recognition is an aid to review. It does not replace a competent surveyor, laboratory result or the source report.</p></div>${badge('HSE GB RULESET v2.11.8','neutral')}</div>
          <div class="stats-grid">
            <div class="stat traffic-red"><span class="traffic-dot"></span><strong>${critical}</strong><span>Known / presumed / no-access concerns</span></div>
            <div class="stat traffic-red"><span class="traffic-dot"></span><strong>${conflicts}</strong><span>Wording conflicts</span></div>
            <div class="stat traffic-amber"><span class="traffic-dot"></span><strong>${concerns.length}</strong><span>Historical ACMs not accounted for</span></div>
            <div class="stat traffic-neutral"><span class="traffic-dot"></span><strong>${d.items.length}</strong><span>Extracted findings</span></div>
          </div>
        </div>`;

        const dateBox=missingDate?`<div class="danger-note"><strong>Document date is required before publication.</strong><br>The date controls newest-first history and prevents an older report overwriting a newer live position.
          ${suggested?`<div class="actions"><button class="secondary" data-v2118-use-date="${esc(d.source.id)}" data-v2118-date="${esc(suggested)}" data-v2118-import="${esc(id)}">Use detected date ${esc(fmtDate(suggested))}</button></div>`:'<br><strong>No reliable date was detected automatically.</strong> Set the date on the source before approval.'}
        </div>`:`<div class="success-note"><strong>Source date:</strong> ${esc(fmtDate(d.source.document_date))}. Upload order will not override newer dated evidence.</div>`;

        const hist=concerns.length?`<div class="section-card asb-v2118-known"><h3>🔴 KNOWN historical ACM locations not accounted for in this report</h3>
          <div class="danger-note"><strong>These records remain live.</strong> Omission from a newer survey is not treated as removal.</div>
          ${concerns.map(e=>{const s=sourceFor(d,e);return`<div class="item-card traffic-red"><strong>${esc(locPath(e.location_id,d.locations))} · ${esc(e.material||'ACM')}</strong><div class="meta"><span>${esc(e.identification_status||e.lifecycle_status)}</span>${e.record_ref?`<span>${esc(e.record_ref)}</span>`:''}${s?`<span>${esc(s.title)}${e.source_page?' · page '+esc(e.source_page):''}</span>`:''}</div></div>`}).join('')}
        </div>`:'';

        const findings=`<div class="section-card"><div class="row-between"><div><h3>Extracted findings</h3><p class="muted">Every known, presumed, inaccessible or covered-in-situ item is highlighted before publication.</p></div><button class="secondary small" data-v2118-detailed="${esc(id)}">Open detailed editor</button></div>
          <div class="card-list">${d.items.map(i=>{
            const known=knownAt(d,i),x=i.raw_data?.intelligence||{},path=(Array.isArray(i.location_path)?i.location_path.join(' > '):i.raw_location)||'Location required';
            const tone=(x.critical_review||known.length)?'red':x.negative_no_asbestos?'green':i.review_status==='REVIEW'?'amber':'neutral';
            const match=i.match_entry_id?d.entries.find(e=>e.id===i.match_entry_id):null;
            return`<div class="item-card traffic-${tone}">
              <div class="row-between"><div><strong>${esc(i.external_ref||('Item '+i.item_no))} · ${esc(i.material||'Material not extracted')}</strong><div class="meta"><span>${esc(path)}</span><span>page ${esc(i.source_page||'—')}</span><span>${esc(i.lifecycle_event)}</span></div></div></div>
              <div class="meta asb-v2118-badges">${intelBadges(i)}</div>
              ${safetyPanel(i,known)}
              ${match?`<div class="pending-use-warning"><strong>Matched to existing register item:</strong> ${esc(match.record_ref||match.material||match.id)} · current status ${esc(match.lifecycle_status||'')}${x.chronological_backfill?' · <strong>OLDER BACKFILL — newer live state protected</strong>':''}</div>`:''}
              ${i.precise_location?`<p><strong>Precise position:</strong> ${esc(i.precise_location)}</p>`:''}
              ${i.condition?`<p><strong>Condition:</strong> ${esc(i.condition)}</p>`:''}
              ${i.surface_treatment?`<p><strong>Surface treatment:</strong> ${esc(i.surface_treatment)}</p>`:''}
              ${i.management_action?`<p><strong>Source action:</strong> ${esc(i.management_action)}</p>`:''}
              <div class="actions"><button class="secondary small" data-v2118-source="${esc(d.source.id)}|${esc(i.source_page||1)}">Open source page</button></div>
            </div>`;
          }).join('')}</div>
        </div>`;

        const ackBox=critical?`<div class="${ackValid?'success-note':'danger-note'}"><strong>${ackValid?'Safety concerns acknowledged':'Reviewer acknowledgement required'}</strong><br>${critical} finding${critical===1?'':'s'} contain known/presumed/no-access/covered/damaged wording. ${ackValid?'They remain visible in the source history and register.':'Review the highlighted items and acknowledge them before publication.'}
          ${!ackValid?`<div class="actions"><button class="primary" data-v2118-ack="${esc(id)}">I have reviewed the highlighted asbestos concerns</button></div>`:''}
        </div>`:'';

        const block=missingDate||itemReview||locationBlock||conflicts||!ackValid||!d.items.length;
        const reasons=[
          missingDate?'document date missing':null,
          itemReview?`${itemReview} finding${itemReview===1?'':'s'} need manual review`:null,
          locationBlock?'location catalogue needs review':null,
          conflicts?`${conflicts} wording conflict${conflicts===1?'':'s'} need manual resolution`:null,
          !ackValid?'highlighted concerns not acknowledged':null,
          !d.items.length?'no findings extracted':null
        ].filter(Boolean);

        openModalV2118('Asbestos import safety review',top+dateBox+hist+findings+ackBox+
          (reasons.length?`<div class="danger-note"><strong>Publication blocked:</strong> ${esc(reasons.join(' · '))}</div>`:'')+
          `<div class="actions"><button class="secondary" data-v2118-detailed="${esc(id)}">Detailed editor</button><button class="primary" data-v2118-approve="${esc(id)}" ${block?'disabled':''}>Approve & publish</button></div>`);
      }catch(e){console.error('v2.11.8 asbestos review',e);toast(e?.message||'Could not open asbestos safety review.')}
      finally{opening=false}
    }

    function openModalV2118(title,html){
      if(typeof window.openModal==='function'){window.openModal(title,html);return}
      const m=$('modal');if(!m)return;const t=$('modalTitle'),b=$('modalBody');if(t)t.textContent=title;if(b)b.innerHTML=html;if(!m.open)m.showModal();
    }

    async function setDate(sourceId,date,importId){
      const src=await sb.from('asbestos_source_documents_v280').update({document_date:date,updated_at:new Date().toISOString()}).eq('id',sourceId).select('linked_document_version_id').single();
      if(src.error)return toast(src.error.message);
      if(src.data?.linked_document_version_id)await sb.from('document_versions').update({issue_date:date}).eq('id',src.data.linked_document_version_id);
      toast(`Source date set to ${fmtDate(date)}.`);
      review(importId);
    }
    async function acknowledge(id){
      const r=await sb.rpc('acknowledge_asbestos_intelligence_v2118',{p_import_id:id});
      if(r.error)return toast(r.error.message);
      toast('Highlighted asbestos concerns acknowledged for this reviewed version.');
      review(id);
    }
    async function approve(id){
      const r=await sb.rpc('approve_asbestos_import_v2118',{p_import_id:id});
      if(r.error)return toast(r.error.message);
      try{$('modal')?.close()}catch(_e){}
      try{await core.loadAll?.()}catch(_e){}
      try{await window.SafetyAsbestosV21080?.refresh?.()}catch(_e){}
      try{await window.SafetyAsbestosHistoryV2117?.refresh?.()}catch(_e){}
      const x=r.data||{};
      toast(`Published. ${x.new_entries||0} new · ${x.updated_entries||0} updated · ${x.chronology_guard_restored||0} newer live state protected.`);
    }

    function patchButtons(){
      document.querySelectorAll('[data-lib-review-v2117]').forEach(b=>{b.dataset.v2118Review=b.dataset.libReviewV2117;b.removeAttribute('data-lib-review-v2117')});
      document.querySelectorAll('[data-asb-v2116-review]').forEach(b=>{b.dataset.v2118Review=b.dataset.asbV2116Review;b.removeAttribute('data-asb-v2116-review')});
      const sort=$('asbestosLibSortV2117');
      if(sort&&!sort.dataset.v2118Default){
        sort.dataset.v2118Default='1';
        sort.value='NEW';
        sort.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }

    function scopedEntries(locationId){
      const locs=st.siteLocations||[],by=new Map(locs.map(x=>[x.id,x])),anc=new Set(),x0=by.get(locationId);let x=x0?.parent_id,n=0;
      while(x&&n++<30){anc.add(x);x=by.get(x)?.parent_id}
      return (st.asbestosEntries||[]).filter(e=>e.active!==false&&['PRESENT','UNKNOWN'].includes(String(e.lifecycle_status||'PRESENT').toUpperCase())&&(e.location_id===locationId||(e.applies_to_descendants&&anc.has(e.location_id))));
    }
    function decorateLookup(){
      const sel=$('asbestosLocationSelect'),sum=$('asbestosLookupSummary');if(!sel||!sum||!sel.value)return;
      const rows=scopedEntries(sel.value),covered=rows.filter(e=>e.evidence?.intelligence?.covered_or_encapsulated_in_situ||/remains in situ|no drilling, cutting, screwing/i.test(e.management_action||'')),
        unresolved=rows.filter(e=>e.evidence?.historical_unresolved),noAccess=rows.filter(e=>e.record_kind==='NO_ACCESS');
      let box=$('asbestosV2118Stop');if(box)box.remove();
      if(!covered.length&&!unresolved.length&&!noAccess.length)return;
      box=document.createElement('div');box.id='asbestosV2118Stop';box.className='danger-note asb-v2118-stop';
      if(covered.length)box.innerHTML=`<strong>⛔ KNOWN ACM REMAINS IN SITU / COVERED OR ENCAPSULATED.</strong><br>No drilling, cutting, screwing, lifting or disturbance unless asbestos controls are specifically authorised.`;
      else if(noAccess.length)box.innerHTML=`<strong>⛔ NO ACCESS / INCOMPLETE ASBESTOS INFORMATION.</strong><br>Do not continue intrusive work until the area has suitable asbestos information.`;
      else box.innerHTML=`<strong>⛔ UNRESOLVED HISTORICAL ACM.</strong><br>An older report identifies asbestos which has not yet been reconciled against newer evidence. Treat it as potentially present and do not disturb.`;
      sum.insertAdjacentElement('afterend',box);
    }

    window.addEventListener('click',e=>{
      const r=e.target.closest?.('[data-v2118-review],[data-asb80-review]');
      if(r&&admin()){
        e.preventDefault();e.stopImmediatePropagation();review(r.dataset.v2118Review||r.dataset.asb80Review);return;
      }
      const legacyApprove=e.target.closest?.('[data-asb80-approve],[data-cat86-approve]');
      if(legacyApprove&&admin()){
        e.preventDefault();e.stopImmediatePropagation();review(legacyApprove.dataset.asb80Approve||legacyApprove.dataset.cat86Approve);return;
      }
      const ack=e.target.closest?.('[data-v2118-ack]');if(ack){e.preventDefault();acknowledge(ack.dataset.v2118Ack);return}
      const ap=e.target.closest?.('[data-v2118-approve]');if(ap&&!ap.disabled){e.preventDefault();approve(ap.dataset.v2118Approve);return}
      const det=e.target.closest?.('[data-v2118-detailed]');if(det){e.preventDefault();window.SafetyAsbestosV21080?.review?.(det.dataset.v2118Detailed);return}
      const src=e.target.closest?.('[data-v2118-source]');if(src){e.preventDefault();window.SafetyAsbestosV21080?.openSource?.(src.dataset.v2118Source);return}
      const dt=e.target.closest?.('[data-v2118-use-date]');if(dt){e.preventDefault();setDate(dt.dataset.v2118UseDate,dt.dataset.v2118Date,dt.dataset.v2118Import);return}
    },true);

    document.addEventListener('change',e=>{if(e.target?.id==='asbestosLocationSelect')setTimeout(decorateLookup,180)},true);
    const obs=new MutationObserver(()=>{patchButtons();setTimeout(decorateLookup,40)});
    obs.observe(document.getElementById('appView')||document.body,{childList:true,subtree:true});
    [250,700,1500,3000].forEach(ms=>setTimeout(()=>{patchButtons();decorateLookup()},ms));

    const style=document.createElement('style');
    style.textContent=`
      .asb-v2118-stop{border-width:3px!important;font-size:1rem}
      .asb-v2118-known{border:3px solid var(--danger,#b42318)}
      .asb-v2118-badges{display:flex!important;flex-wrap:wrap;gap:6px;margin:8px 0}
      .asb-v2118-review-head .stats-grid{margin:12px 0}
    `;
    document.head.appendChild(style);

    window.SafetyAsbestosIntelligenceV2118={review,enrich,decorateLookup};
  }
  boot();
})();
