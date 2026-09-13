(()=>{
'use strict';
const VERSION='2.10.4';
const api=()=>window.SafetyTrackerV2||null;
const state=()=>api()?.state||{};
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const txt=n=>clean(n?.textContent||'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let lastAnalysis=null;
function toast(m){if(api()?.toast)return api().toast(m);const t=q('#toast');if(t){t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,4500)}}
function root(){return q('#modal[open]')||q('dialog[open]')||document}
function isCoshh(r){const s=txt(r);return /COSHH Risk Assessment/i.test(s)&&(/PPE required|People exposed|Typical duration|Quantity \/ amount/i.test(s))}
function field(rx,r){
 const controls=qa('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select',r);
 for(const l of qa('label',r)){
   if(!rx.test(txt(l))) continue;
   if(l.htmlFor){const byId=q('#'+CSS.escape(l.htmlFor),r);if(byId)return byId}
   const inside=q('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select',l);if(inside)return inside;
   // Many v2.10 creator fields render the label and control as siblings.
   let n=l.nextElementSibling,steps=0;
   while(n&&steps++<4){
     if(n.matches?.('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select'))return n;
     const nested=q?.call?null:null;
     const c=n.querySelector?.('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select');
     if(c)return c;
     if(n.matches?.('label'))break;
     n=n.nextElementSibling;
   }
   // Fall back to the first control after this label in document order within a nearby container.
   const box=l.closest('.form-grid,.stack,.section-card,.creator-step,.creator-form,.modal-body,form,div');
   if(box){
     const near=qa('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select',box)
       .find(c=>Boolean(l.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING));
     if(near)return near;
   }
 }
 return controls.find(f=>rx.test(`${f.id} ${f.name} ${f.placeholder} ${f.getAttribute('aria-label')||''}`))||null;
}
function setIfBlank(r,rx,val){const f=field(rx,r);if(!f||clean(f.value)||!clean(val))return false;f.value=val;f.dataset.coshhSuggested='1';f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));return true}
function docs(){return state().documents||[]}
function vers(){return state().versions||[]}
function currentVersion(d){return api()?.approvedCurrentVersion?.(d.id)||api()?.currentVersion?.(d.id)||vers().find(v=>v.document_id===d.id&&(['CURRENT','APPROVED'].includes(v.status)))||vers().filter(v=>v.document_id===d.id).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null}
function displayTitle(d){return api()?.documentDisplayTitle?.(d)||d?.title||d?.name||''}
function docType(d){return clean(d?.doc_type||d?.type||d?.document_type).toUpperCase()}
function nextRef(prefix='COSHH'){
 const used=new Set();
 for(const d of docs()){
   const ref=clean(d.reference||d.ref||'');
   const m=ref.match(new RegExp(`^${prefix}(?:[-_ ]|\\s)*(\\d+)$`,'i'))||ref.match(/^COSHH[-_ ]*RA[-_ ]*(\d+)$/i);
   if(m)used.add(Number(m[1]));
 }
 let n=1;while(used.has(n))n++;
 return `${prefix}-${String(n).padStart(3,'0')}`;
}
function enhanceRef(r){
 if(!isCoshh(r))return;
 let f=field(/^(COSHH\s*)?Reference\b/i,r)||qa('input',r).find(x=>/reference|ref/i.test(`${x.id} ${x.name} ${x.placeholder} ${x.getAttribute('aria-label')||''}`));
 const n=nextRef();

 // v2.10.x can render the creator without a visible reference control. Re-add a visible editable control.
 if(!f){
   let wrap=q('#coshhAssistReferenceWrap',r);
   if(!wrap){
     wrap=document.createElement('div');
     wrap.id='coshhAssistReferenceWrap';
     wrap.className='coshh-ref-fallback';
     wrap.innerHTML=`<label class="coshh-ref-label">COSHH reference</label><input id="coshhAssistReference" type="text" autocomplete="off"><div class="coshh-ref-suggestion"><strong>Recommended COSHH reference:</strong> <span>${esc(n)}</span> <button type="button" class="coshh-mini">Use</button><div class="coshh-small">Editable. Safety Tracker checks existing COSHH references and suggests the lowest unused number.</div></div>`;
     const titleField=field(/Document\s*\/\s*task title/i,r);
     const anchor=titleField?.closest('label')||titleField?.parentElement||q('.coshh-source-reader',r)||r.firstElementChild;
     if(anchor?.parentElement)anchor.parentElement.insertBefore(wrap,anchor);else r.prepend(wrap);
     q('button',wrap).onclick=()=>{const x=nextRef();q('span',wrap).textContent=x;const inp=q('#coshhAssistReference',wrap);inp.value=x;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.focus()};
   }
   f=q('#coshhAssistReference',r);
 }

 if(!f||f.dataset.coshhRef)return;
 f.dataset.coshhRef='1';
 if(!clean(f.value)||/^test$/i.test(clean(f.value))){f.value=n;f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}))}
 if(f.id==='coshhAssistReference')return;
 const d=document.createElement('div');d.className='coshh-ref-suggestion';
 d.innerHTML=`<strong>Recommended COSHH reference:</strong> <span>${esc(n)}</span> <button type="button" class="coshh-mini">Use</button><div class="coshh-small">Editable. Safety Tracker checks existing COSHH references and suggests the lowest unused number.</div>`;
 f.parentElement?.appendChild(d);
 q('button',d).onclick=()=>{const x=nextRef();q('span',d).textContent=x;f.value=x;f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));f.focus()};
}
function enhancePeople(r){
 if(!isCoshh(r))return;const f=field(/People exposed|who performs it/i,r);if(!f||f.dataset.peopleTicks)return;
 f.dataset.peopleTicks='1';f.style.display='none';
 const box=document.createElement('div');box.className='coshh-people-ticks';
 box.innerHTML=`<div class="coshh-small"><strong>People exposed / who performs it</strong> — tick all that apply.</div><div class="coshh-tick-grid"><label><input type="checkbox" value="Maintenance staff"> Maintenance staff</label><label><input type="checkbox" value="Other colleagues"> Other colleagues</label><label><input type="checkbox" value="Visitors / Guests"> Visitors / Guests</label><label><input type="checkbox" value="Contractors"> Contractors</label><label><input type="checkbox" value="Other"> Other</label></div><input data-other-person type="text" placeholder="Other people exposed" hidden>`;
 f.after(box);
 const sync=()=>{const checked=qa('input[type=checkbox]:checked',box),other=q('[data-other-person]',box),vals=checked.map(x=>x.value);const oc=qa('input[type=checkbox]',box).find(x=>x.value==='Other');other.hidden=!oc.checked;if(oc.checked&&clean(other.value))vals[vals.indexOf('Other')]=clean(other.value);f.value=vals.join('; ');f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}))};
 qa('input[type=checkbox]',box).forEach(x=>x.onchange=sync);q('[data-other-person]',box).oninput=sync;
 clean(f.value).split(';').map(clean).filter(Boolean).forEach(v=>{const c=qa('input[type=checkbox]',box).find(x=>x.value.toLowerCase()===v.toLowerCase());if(c)c.checked=true;else{const o=qa('input[type=checkbox]',box).find(x=>x.value==='Other');o.checked=true;q('[data-other-person]',box).value=v}});sync();
}
function sliceSection(t,n,next=n+1){
 const variants=[
  new RegExp(`(?:SECTION\\s*)?${n}\\s*[.:\\-]?\\s*(?:[A-Z][A-Z \\/&()-]{2,80})?[\\s\\S]*?(?=(?:SECTION\\s*)?${next}\\s*[.:\\-]|$)`,'i'),
  new RegExp(`(?:SECTION\\s*${n}|${n}\\.)[\\s\\S]*?(?=(?:SECTION\\s*${next}|${next}\\.)|$)`,'i')
 ];
 for(const rx of variants){const m=t.match(rx);if(m&&clean(m[0]).length>20)return clean(m[0])}
 return '';
}
function short(s,n=900){s=clean(s);return s.length<=n?s:s.slice(0,n).replace(/\s+\S*$/,'')+'…'}
function sentenceHits(s,rx,limit=6){const parts=String(s||'').split(/(?<=[.!?;])\s+/).map(clean).filter(Boolean);return parts.filter(x=>rx.test(x)).slice(0,limit)}
function analyse(t){
 const s1=sliceSection(t,1,2),s2=sliceSection(t,2,3),s4=sliceSection(t,4,5),s5=sliceSection(t,5,6),s6=sliceSection(t,6,7),s7=sliceSection(t,7,8),s8=sliceSection(t,8,9),s11=sliceSection(t,11,12),s13=sliceSection(t,13,14);
 const all=clean(t);
 const ppe=[];
 const glove=sentenceHits(s8,/glove|nitrile|butyl|neoprene|hand protection|EN\s*374/i,3);if(glove.length)ppe.push(...glove);
 const eye=sentenceHits(s8,/goggle|eye protection|eye\/face|safety glasses|face shield|EN\s*166/i,3);if(eye.length)ppe.push(...eye);
 const rpe=sentenceHits(s8,/respirator|respiratory protection|RPE|filter|mask|EN\s*14[0-9]{3}/i,3);if(rpe.length)ppe.push(...rpe);
 const clothing=sentenceHits(s8,/protective clothing|overall|apron|protective footwear|safety footwear/i,2);if(clothing.length)ppe.push(...clothing);
 let ppeText=[...new Set(ppe)].join(' ');
 if(!ppeText){
   if(/no special (?:protective )?equipment|no special requirements|not required under normal conditions|not normally required/i.test(s8)) ppeText='N/A – SDS Section 8 does not identify specific PPE beyond normal task controls. Confirm this remains suitable for the actual method of use.';
   else ppeText='Not clearly identified from SDS text – check Section 8 and confirm task-specific PPE before approval.';
 }
 const controlHits=sentenceHits(`${s7}. ${s8}`,/ventilat|local exhaust|avoid breathing|keep container|keep away|wash hands|hygiene|prevent contact|do not eat|do not drink|handling|storage|incompatib/i,10);
 const controls=controlHits.length?[...new Set(controlHits)].join(' '):'No clear handling/ventilation control was extracted automatically – review SDS Sections 7 and 8 and confirm controls.';
 const first=sentenceHits(s4,/inhal|skin|eye|ingest|medical|fresh air|wash|rinse|poison|doctor|physician/i,8);
 const fire=sentenceHits(s5,/extinguish|fire|foam|water spray|carbon dioxide|dry chemical|firefighter|combust/i,6);
 const spill=sentenceHits(s6,/spill|leak|contain|absorb|ventilat|drain|environment|clean up|collect/i,8);
 const emergency=[first.length&&`First aid: ${first.join(' ')}`,fire.length&&`Fire: ${fire.join(' ')}`,spill.length&&`Spill: ${spill.join(' ')}`].filter(Boolean).join(' | ')||'No clear emergency wording was extracted automatically – check SDS Sections 4, 5 and 6 before approval.';
 const routes=[];if(/inhal/i.test(s2+' '+s11+' '+s8))routes.push('inhalation');if(/skin|dermal/i.test(s2+' '+s11+' '+s8))routes.push('skin');if(/eye/i.test(s2+' '+s11+' '+s8))routes.push('eyes');if(/ingest|swallow|oral/i.test(s2+' '+s11))routes.push('ingestion');
 const exposure=`${routes.length?'Potential exposure routes identified: '+routes.join(', ')+'. ':'No exposure route was confidently identified automatically. '}${short(sentenceHits(s8,/ventilat|exposure limit|WEL|OEL|avoid breathing|respir/i,8).join(' '),700)}`.trim();
 const product=(s1.match(/(?:Product name|Product identifier|Trade name)\s*:?\s*([^.;]{3,120})/i)||[])[1]||'';
 const hHits=sentenceHits(s2,/H\d{3}|hazard statement|causes|harmful|toxic|flammable|corrosive|irritat|sensiti[sz]/i,12);
 const hazards=hHits.length?[...new Set(hHits)].join(' '):(s2?short(s2,950):'Hazard information was not extracted automatically – check SDS Section 2 before approval.');
 const useHits=sentenceHits(s1,/identified use|recommended use|use of the substance|use of the mixture/i,4);
 const use=useHits.join(' ')||'Use/application must be confirmed from the actual site task.';
 const methodHits=sentenceHits(s7,/handling|avoid|keep|use only|do not|ensure|prevent|wash|storage/i,8);
 const method=methodHits.length?methodHits.join('\n'):'Use the product in accordance with the SDS and the confirmed site task. Add the actual work sequence before approval.';
 return {product:clean(product),hazards:short(hazards,1200),ppe:short(ppeText,1000),emergency:short(emergency,1600),controls:short(controls,1300),method:short(method,1000),use:short(use,600),exposure:short(exposure,950),disposal:s13?short(s13,650):'Check SDS Section 13 and site waste arrangements.',flags:{flammable:/flammable|ignition|H22[2456]|aerosol/i.test(s2+' '+s5+' '+s7),corrosive:/corros|H31[48]/i.test(s2+' '+s11),sensitiser:/sensiti[sz]|H317|H334/i.test(s2+' '+s11),toxic:/toxic|H30[0-3]|H31[01]|H33[01]/i.test(s2+' '+s11)}};
}
function sdsSelect(r){const ss=qa('select',r);return ss.find(s=>/SDS|MSDS|source/i.test(txt(s.parentElement))&&[...s.options].some(o=>/SDS|MSDS|Safety Data/i.test(o.text)))||ss.find(s=>[...s.options].some(o=>/SDS|MSDS|Safety Data Sheet/i.test(o.text)))||null}
function sourceDoc(sel){if(!sel?.value)return null;let d=docs().find(x=>String(x.id)===String(sel.value));if(d)return d;const label=clean(sel.options?.[sel.selectedIndex]?.text);return docs().filter(x=>/SDS|MSDS/.test(docType(x))).find(x=>label.includes(x.reference||'')||label.toLowerCase().includes(displayTitle(x).toLowerCase()))||null}
async function localPdfText(blob){if(!window.pdfjsLib)throw new Error('PDF reader is unavailable.');const pdf=await window.pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise;let out='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),c=await p.getTextContent();out+='\n'+c.items.map(x=>x.str).join(' ')}return out}
function apply(r,a){
 const changes=[],missing=[];
 const specs=[
   [/Existing controls/i,a.controls,'Existing controls'],
   [/PPE required/i,a.ppe,'PPE'],
   [/Emergency\s*\/?\s*stop-work|Emergency arrangements|stop-work/i,a.emergency,'Emergency'],
   [/Safe method\s*\/?\s*key steps|Safe method|key steps/i,a.method,'Safe method'],
   [/How is the substance used|substance used/i,a.use,'Use'],
   [/Exposure routes\s*\/?\s*ventilation|Exposure routes|ventilation/i,a.exposure,'Exposure / ventilation'],
   [/Hazards?|Hazard information/i,a.hazards,'Hazards'],
   [/Disposal|waste/i,a.disposal,'Disposal']
 ];
 for(const [rx,val,name] of specs){
   const f=field(rx,r);
   if(!f){missing.push(name);continue}
   if(clean(f.value)){continue}
   f.value=val||'Not identified from SDS – confirm manually.';
   f.dataset.coshhSuggested='1';
   f.dispatchEvent(new Event('input',{bubbles:true}));
   f.dispatchEvent(new Event('change',{bubbles:true}));
   changes.push(name);
 }
 return {changes,missing};
}
function renderSummary(r,a,d,result){const changes=result?.changes||[],missing=result?.missing||[];let p=q('#coshhReadSummary',r);if(!p){p=document.createElement('div');p.id='coshhReadSummary';p.className='coshh-analysis-panel';q('[data-read-sds]',r)?.closest('.coshh-source-reader')?.after(p)}const found=[['Product',a.product||displayTitle(d)],['Hazards',a.hazards],['PPE',a.ppe],['Handling / controls',a.controls],['Emergency / first aid / spill',a.emergency],['Exposure / ventilation',a.exposure]].filter(x=>clean(x[1]));p.innerHTML=`<h4>SDS read result</h4><div class="coshh-found"><strong>Suggestions found:</strong><ul>${found.map(x=>`<li><strong>${esc(x[0])}:</strong> ${esc(short(x[1],240))}</li>`).join('')}</ul></div><div class="coshh-review"><strong>Fields populated:</strong> ${esc(changes.length?changes.join(', '):'none because existing entries were preserved')}.${missing.length?`<br><strong>Could not locate these form fields:</strong> ${esc(missing.join(', '))}.`:''}<br><strong>You must confirm:</strong> frequency, duration, quantity, people exposed, actual site method, work area, dilution and that each suggested control is correct for the intended use.</div><div class="coshh-responsibility"><strong>Assessment responsibility:</strong> Safety Tracker extracts and suggests information only. The person creating and approving the COSHH assessment remains responsible for checking the SDS and final assessment.</div>`}
const TASKS=[{rx:/work(?:ing)? at height|ladder|steps|overhead|above normal reach/i,terms:['working at height','work at height','ladder']},{rx:/manual handling|lifting|carry|heavy/i,terms:['manual handling']},{rx:/hot work|ignition|flammable|naked flame|spark/i,terms:['hot work']},{rx:/confined space|poorly ventilated|enclosed space/i,terms:['confined space']},{rx:/electrical|safe isolation|live equipment/i,terms:['electrical','safe isolation']},{rx:/slip|spill|wet floor/i,terms:['slips','trips','falls']},{rx:/outdoor|external|weather/i,terms:['working outdoors','outdoors']},{rx:/powered hand tool|drill|grinder|sander/i,terms:['powered hand tools','power tools']}];
function trainingRows(){return state().training||state().trainingItems||state().training_catalogue||[]}
function trySyncExistingLinkUI(r,row,checked){
 const needle=[row.id,row.ref,row.title].map(clean).filter(Boolean);
 for(const lab of qa('label',r)){
  const text=clean(txt(lab));if(!needle.some(n=>n&&text.toLowerCase().includes(n.toLowerCase())))continue;
  const cb=q('input[type=checkbox]',lab);if(cb){cb.checked=checked;cb.dispatchEvent(new Event('change',{bubbles:true}));return true}
 }
 for(const sel of qa('select[multiple]',r)){
  let hit=false;for(const o of [...sel.options])if(needle.some(n=>n&&clean(o.text).toLowerCase().includes(n.toLowerCase()))){o.selected=checked;hit=true}
  if(hit){sel.dispatchEvent(new Event('change',{bubbles:true}));return true}
 }
 return false;
}
function related(r,a){
 const src=`${txt(r)} ${a.hazards} ${a.controls} ${a.method}`;const pats=TASKS.filter(x=>x.rx.test(src));const titleMatch=(t,terms)=>terms.some(x=>clean(t).toLowerCase().includes(x));const rows=[];
 for(const d of docs()){
  const kind=docType(d);if(!['SSW','SAFE_SYSTEM_OF_WORK','RISK_ASSESSMENT','RA'].includes(kind)||String(d.status).toUpperCase()==='ARCHIVED')continue;
  const t=`${d.reference||''} ${displayTitle(d)}`;if(pats.some(p=>titleMatch(t,p.terms)))rows.push({id:d.id,kind:kind.includes('SSW')||kind.includes('SAFE_')?'SSW':'RA',ref:d.reference||'',title:displayTitle(d)});
 }
 for(const t of trainingRows()){
  const name=`${t.reference||''} ${t.name||t.title||''}`,kind=clean(t.source_kind||t.session_type||t.training_type).toUpperCase();
  if((kind.includes('TOOLBOX')||/\bTBT[-_ ]*\d+/i.test(name)||/toolbox talk/i.test(name))&&pats.some(p=>titleMatch(name,p.terms))) rows.push({id:t.id,kind:'TOOLBOX_TALK',ref:t.reference||name.match(/\bTBT[-_ ]*\d+/i)?.[0]||'',title:t.name||t.title||''});
 }
 let p=q('#coshhRelatedSuggestions',r);if(!p){p=document.createElement('div');p.id='coshhRelatedSuggestions';p.className='coshh-related-panel';q('#coshhReadSummary',r)?.after(p)}
 const high=Object.values(a.flags).some(Boolean);
 p.innerHTML=`<h4>Relevant SSW / Toolbox Talk</h4>${rows.length?`<p>Safety Tracker found existing documents that may apply. Tick the ones you want associated with this assessment.</p><div class="coshh-related-list">${rows.map((x,i)=>`<label class="coshh-related-item"><input type="checkbox" data-related-index="${i}"> <span><strong>${esc(x.ref||x.kind)}</strong> — ${esc(x.title)}</span></label>`).join('')}</div>`:'<p>No obvious existing task-specific SSW/TBT was found from the current information. You can still link one manually or create one if the task requires it.</p>'}<div class="coshh-decision-grid"><div><strong>Existing document suitable</strong><br>Link it. Do not create a chemical-specific copy just to add the product name.</div><div><strong>No suitable document</strong><br>Create a new SSW/TBT only where the work method or risk needs one.</div><div><strong>Existing document may need review</strong><br>${high?'The SDS contains higher-hazard indicators. Check whether these controls change the safe method before relying on an existing SSW/TBT.':'If the chemical changes ventilation, ignition control, PPE, isolation or work sequence, review/new-version the relevant SSW.'}</div></div><div id="coshhRelatedSelected" class="coshh-small">No related SSW/TBT selected yet.</div>`;
 const selected=new Set();
 qa('[data-related-index]',p).forEach(cb=>cb.addEventListener('change',()=>{const row=rows[Number(cb.dataset.relatedIndex)];if(cb.checked)selected.add(row);else selected.delete(row);trySyncExistingLinkUI(r,row,cb.checked);const out=q('#coshhRelatedSelected',p);out.textContent=selected.size?`Selected for linking: ${[...selected].map(x=>x.ref||x.title).join(', ')}`:'No related SSW/TBT selected yet.';r.dataset.coshhRelatedJson=JSON.stringify([...selected].map(x=>({id:x.id,kind:x.kind,reference:x.ref,title:x.title})));}));
}
async function readSds(r){
 const A=api();if(!A?.sb)throw new Error('Safety Tracker is not connected.');const sel=sdsSelect(r),d=sourceDoc(sel);if(!d)throw new Error('Select the linked SDS/MSDS first.');const v=currentVersion(d);if(!v?.storage_path)throw new Error('The selected SDS has no current stored PDF.');const b=q('[data-read-sds]',r);b.disabled=true;b.textContent='Reading SDS…';
 try{const res=await A.sb.storage.from('safety-files').download(v.storage_path);if(res.error||!res.data)throw new Error(res.error?.message||'Could not download linked SDS.');const text=await A.pdfTextFromBlob?.(res.data)||await localPdfText(res.data);lastAnalysis=analyse(text);const result=apply(r,lastAnalysis);renderSummary(r,lastAnalysis,d,result);related(r,lastAnalysis);toast(`SDS read. ${result.changes.length} field${result.changes.length===1?'':'s'} populated — review everything before approval.`)}finally{b.disabled=false;b.textContent='Read linked SDS & suggest controls'}
}
function enhanceReader(r){if(!isCoshh(r)||q('[data-read-sds]',r))return;const s=sdsSelect(r);if(!s)return;const b=document.createElement('div');b.className='coshh-source-reader';b.innerHTML='<strong>Read the linked SDS/MSDS</strong><p>Select the source SDS above, then read it. Safety Tracker will suggest hazards, PPE, handling, first aid, spill response, ventilation and related controls where supported by the SDS.</p><button type="button" class="primary" data-read-sds>Read linked SDS &amp; suggest controls</button>';s.parentElement?.after(b);q('[data-read-sds]',b).onclick=()=>readSds(r).catch(e=>toast(e.message||String(e)))}
function updateVersionBadges(){
 qa('.build-badge,.brand-line .version,.demo-brand-line .version').forEach(el=>{
   if(/2\.10\.[0-9]+/.test(el.textContent))el.textContent=el.textContent.replace(/2\.10\.[0-9]+/g,VERSION);
 });
 const brand=q('#appView .brand-line');
 if(brand){
   let v=q('.version',brand);
   if(!v){v=document.createElement('span');v.className='version';brand.appendChild(v)}
   v.textContent='v'+VERSION;
   v.style.display='inline-flex';
 }
}
function enhance(r=root()){updateVersionBadges();enhanceTemplateCreator(r);if(!isCoshh(r))return;enhanceRef(r);enhancePeople(r);enhanceReader(r)}

// -----------------------------------------------------------------------------
// v2.10.4 TEMPLATE-DRIVEN CREATOR
// Uses the structure of the existing document type/topic instead of one generic
// questionnaire. Existing live documents are used as topic/template examples.
// -----------------------------------------------------------------------------
let lastCreatorType='';
const TEMPLATE_CATALOGUE={
 RA:{
   label:'Risk Assessment',
   prefix:'RA',
   sections:[
     ['Task / activity','task','textarea'],
     ['Location / area','location','text'],
     ['People at risk','people','checks'],
     ['Hazards identified','hazards','textarea'],
     ['Existing control measures','controls','textarea'],
     ['Initial risk / why it matters','initialRisk','textarea'],
     ['Further controls / actions required','further','textarea'],
     ['Residual risk after controls','residualRisk','textarea'],
     ['Emergency / stop-work / reporting','emergency','textarea'],
     ['Relevant linked documents','links','textarea']
   ]
 },
 SSW:{
   label:'Safe System of Work',
   prefix:'SSW',
   sections:[
     ['Scope / task covered','task','textarea'],
     ['Relevant RA / COSHH / procedures','links','textarea'],
     ['Competence / authorisation required','competence','textarea'],
     ['PPE / tools / equipment','ppe','textarea'],
     ['Before starting / work-area controls','prestart','textarea'],
     ['Safe method / sequence of work','steps','textarea'],
     ['Stop-work conditions','stop','textarea'],
     ['Emergency / incident response','emergency','textarea'],
     ['Completion / housekeeping / hand-back','completion','textarea']
   ]
 },
 TOOLBOX_TALK:{
   label:'Toolbox Talk',
   prefix:'TBT',
   sections:[
     ['Topic / key message','keyMessage','textarea'],
     ['Relevant documents to discuss','links','textarea'],
     ['Main hazards / why this matters','hazards','textarea'],
     ['Key control points to discuss','controls','textarea'],
     ['Safe working reminders / do & don’t','steps','textarea'],
     ['PPE / work-area controls','ppe','textarea'],
     ['Emergency / stop-work / reporting','emergency','textarea'],
     ['Check-understanding questions','questions','textarea'],
     ['Actions / points raised','actions','textarea']
   ]
 },
 COSHH:{
   label:'COSHH Risk Assessment',
   prefix:'COSHH',
   sections:[]
 }
};
const TEMPLATE_TOPIC_HINTS={
 'working at height':['working at height','ladder','stepladder'],
 'manual handling':['manual handling','lifting','carry'],
 'powered hand tools':['powered hand tools','power tools','drill','grinder','sander'],
 'electrical equipment':['electrical equipment','electrical','safe isolation','lockout'],
 'general plumbing':['plumbing','taps','fittings','pipework'],
 'sanding':['sanding','painted surfaces'],
 'tiling':['tiling','tile removal','grouting'],
 'fan coil':['fan coil','fcu'],
 'ahu drive belts':['ahu','drive belts','belt tension'],
 'diesel sprinkler':['diesel sprinkler','sprinkler engine'],
 'pressure jet washer':['pressure jet washer','jet washer'],
 'hazardous paint':['hazardous paint','paint','brush','roller'],
 'spray adhesive':['spray adhesive','stick2'],
 'shower head':['shower head','descaling','sanitising'],
 'gas powered':['gas powered equipment'],
 'soldering':['soldering','soldering iron'],
 'asbestos':['asbestos']
};
function inferCreatorType(r){
 const s=txt(r);
 if(/Toolbox Talk/i.test(s))return 'TOOLBOX_TALK';
 if(/Safe System of Work/i.test(s))return 'SSW';
 if(/COSHH Risk Assessment/i.test(s))return 'COSHH';
 if(/Risk Assessment/i.test(s))return 'RA';
 return lastCreatorType||'';
}
function creatorDocsFor(type){
 const wanted=type==='TOOLBOX_TALK'?'TOOLBOX':type;
 const out=[];
 for(const d of docs()){
   const k=docType(d), title=`${d.reference||''} ${displayTitle(d)}`;
   const hit=
     type==='RA' ? (k==='RA'||k.includes('RISK_ASSESSMENT')) :
     type==='SSW' ? (k==='SSW'||k.includes('SAFE_SYSTEM')) :
     type==='COSHH' ? (k.includes('COSHH')) :
     (k.includes('TOOLBOX')||/\bTBT[-_ ]*\d+/i.test(title));
   if(hit&&String(d.status||'').toUpperCase()!=='ARCHIVED')out.push(d);
 }
 if(type==='TOOLBOX_TALK'){
   for(const t of trainingRows()){
     const name=`${t.reference||''} ${t.name||t.title||''}`;
     const k=clean(t.source_kind||t.training_type||t.session_type).toUpperCase();
     if(k.includes('TOOLBOX')||/\bTBT[-_ ]*\d+/i.test(name)||/toolbox talk/i.test(name)){
       out.push({id:t.id,reference:t.reference||name.match(/\bTBT[-_ ]*\d+/i)?.[0]||'',title:t.name||t.title||'',doc_type:'TOOLBOX_TALK',status:t.status||'ACTIVE'});
     }
   }
 }
 return out;
}
function tokens(s){
 return clean(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2&&!['the','and','for','with','from','use','using','work','safe','system','risk','assessment','toolbox','talk'].includes(x));
}
function similarity(a,b){
 const A=new Set(tokens(a)),B=new Set(tokens(b));let score=0;
 for(const x of A)if(B.has(x))score+=3;
 const al=clean(a).toLowerCase(),bl=clean(b).toLowerCase();
 for(const terms of Object.values(TEMPLATE_TOPIC_HINTS)){
   if(terms.some(x=>al.includes(x))&&terms.some(x=>bl.includes(x)))score+=8;
 }
 return score;
}
function nextGenericRef(type){
 const prefix=TEMPLATE_CATALOGUE[type]?.prefix||type;
 const used=new Set();
 for(const d of docs()){
   const m=clean(d.reference||d.ref||'').match(new RegExp(`^${prefix}[-_ ]*(\\d+)$`,'i'));
   if(m)used.add(Number(m[1]));
 }
 let n=1;while(used.has(n))n++;
 return `${prefix}-${String(n).padStart(3,'0')}`;
}
function templateMatches(type,title){
 const rows=creatorDocsFor(type).map(d=>({d,score:similarity(title,`${d.reference||''} ${displayTitle(d)}`)}))
   .sort((a,b)=>b.score-a.score);
 return rows.filter(x=>x.score>0).slice(0,6);
}
function inputForSection(sec){
 const [label,key,kind]=sec;
 if(kind==='checks'){
   return `<div class="template-checks" data-template-key="${key}">
    <label><input type="checkbox" value="Employees / colleagues"> Employees / colleagues</label>
    <label><input type="checkbox" value="Visitors / guests"> Visitors / guests</label>
    <label><input type="checkbox" value="Contractors"> Contractors</label>
    <label><input type="checkbox" value="Other"> Other</label>
    <input data-template-other="${key}" type="text" placeholder="Other people at risk" hidden>
   </div>`;
 }
 const tag=kind==='textarea'?'textarea':'input';
 return `<${tag} data-template-key="${key}" ${tag==='input'?'type="text"':''} placeholder="${esc(label)}"></${tag}>`;
}
function collectTemplateAnswers(panel,type){
 const out={};
 for(const sec of TEMPLATE_CATALOGUE[type].sections){
   const key=sec[1],kind=sec[2];
   if(kind==='checks'){
     const box=q(`[data-template-key="${key}"]`,panel);
     const vals=qa('input[type=checkbox]:checked',box).map(x=>x.value);
     const other=q(`[data-template-other="${key}"]`,box);
     if(other&&!other.hidden&&clean(other.value))vals[vals.indexOf('Other')]=clean(other.value);
     out[key]=vals.join('; ');
   }else out[key]=clean(q(`[data-template-key="${key}"]`,panel)?.value);
 }
 return out;
}
function previewHtml(type,ref,title,a,templateTitle,mode){
 const head=`<div class="template-doc-head"><div><strong>${esc(TEMPLATE_CATALOGUE[type].label.toUpperCase())}</strong><div>${esc(ref)} — ${esc(title||'Untitled draft')}</div></div><div>Version ${mode==='VERSION'?'next':'1'}</div></div>`;
 if(type==='RA')return head+`
   <div class="template-doc-row"><b>Task / activity</b><span>${esc(a.task||'To be completed')}</span></div>
   <div class="template-doc-row"><b>Location</b><span>${esc(a.location||'To be completed')}</span></div>
   <div class="template-doc-row"><b>People at risk</b><span>${esc(a.people||'To be completed')}</span></div>
   <table class="template-doc-table"><thead><tr><th>Hazards</th><th>Existing controls</th><th>Initial risk</th><th>Further controls</th><th>Residual risk</th></tr></thead><tbody><tr><td>${esc(a.hazards||'')}</td><td>${esc(a.controls||'')}</td><td>${esc(a.initialRisk||'')}</td><td>${esc(a.further||'')}</td><td>${esc(a.residualRisk||'')}</td></tr></tbody></table>
   <div class="template-doc-block"><b>Emergency / stop-work / reporting</b><p>${esc(a.emergency||'')}</p></div><div class="template-doc-block"><b>Relevant documents</b><p>${esc(a.links||'')}</p></div>`;
 if(type==='SSW')return head+`
   <div class="template-doc-row"><b>Relevant documents</b><span>${esc(a.links||'')}</span></div>
   <div class="template-doc-key"><b>KEY RULE / SCOPE:</b> ${esc(a.task||'To be completed')}</div>
   ${[['Competence / authorisation','competence'],['PPE / tools / equipment','ppe'],['Before starting','prestart'],['Safe method / sequence','steps'],['Stop-work conditions','stop'],['Emergency response','emergency'],['Completion / hand-back','completion']].map(([l,k],i)=>`<div class="template-doc-block"><b>${i+1}. ${esc(l)}</b><p>${esc(a[k]||'')}</p></div>`).join('')}`;
 if(type==='TOOLBOX_TALK')return head+`
   <div class="template-doc-row"><b>Relevant documents</b><span>${esc(a.links||'')}</span></div>
   <div class="template-doc-key"><b>KEY MESSAGE:</b> ${esc(a.keyMessage||'To be completed')}</div>
   ${[['Main hazards / why this matters','hazards'],['Key control points','controls'],['Safe working reminders','steps'],['PPE / work-area controls','ppe'],['Emergency / stop-work / reporting','emergency'],['Check-understanding questions','questions'],['Actions / points raised','actions']].map(([l,k],i)=>`<div class="template-doc-block"><b>${i+1}. ${esc(l)}</b><p>${esc(a[k]||'')}</p></div>`).join('')}
   <div class="template-signoff"><b>Training discussion and sign-off</b><p>This Toolbox Talk and all relevant linked documents must be read through or discussed before attendance/sign-off is recorded.</p></div>`;
 return head;
}
function syncTemplateToBase(r,type,a,title,ref){
 const attempts=[
   [/Document\s*\/\s*task title|Title/i,title],
   [/Reference/i,ref],
   [/What work\/use is being assessed|Scope|Task/i,a.task||a.keyMessage],
   [/Location/i,a.location],
   [/People exposed|People at risk/i,a.people],
   [/Existing controls|Control measures/i,a.controls],
   [/PPE/i,a.ppe],
   [/Emergency|stop-work/i,a.emergency],
   [/Safe method|key steps|sequence/i,a.steps||a.method],
   [/Relevant documents/i,a.links]
 ];
 let n=0;for(const [rx,val] of attempts)if(clean(val)&&setIfBlank(r,rx,val))n++;
 return n;
}
function renderTemplatePreview(panel,r,type){
 const title=clean(q('[data-template-title]',panel)?.value);
 const mode=q('input[name="templateMode"]:checked',panel)?.value||'NEW';
 const selected=q('[data-template-match]',panel);
 const templateTitle=selected?.value||'';
 const ref=clean(q('[data-template-ref]',panel)?.value)||nextGenericRef(type);
 const a=collectTemplateAnswers(panel,type);
 const prev=q('[data-template-preview]',panel);
 prev.innerHTML=previewHtml(type,ref,title,a,templateTitle,mode);
 prev.hidden=false;
 q('[data-template-apply]',panel).disabled=false;
 panel.dataset.templateDraft=JSON.stringify({type,mode,reference:ref,title,templateTitle,answers:a});
}
function enhanceTemplateCreator(r=root()){
 const type=inferCreatorType(r);if(!type||type==='COSHH'||!TEMPLATE_CATALOGUE[type])return;
 // Only enhance actual creator modal/form, not the whole page.
 const s=txt(r);
 if(!/Create|draft|Document|Toolbox|Safe System|Risk Assessment/i.test(s))return;
 if(q('#templateDrivenCreator',r))return;
 const panel=document.createElement('div');panel.id='templateDrivenCreator';panel.className='template-driven-creator';
 const titleGuess=clean(field(/Document\s*\/\s*task title|Title/i,r)?.value);
 const matches=templateMatches(type,titleGuess);
 const newRef=nextGenericRef(type);
 panel.innerHTML=`
 <div class="template-assist-head">
  <div><h4>${esc(TEMPLATE_CATALOGUE[type].label)} — template-driven assistant</h4>
  <p>Answer the questions used by this document type. Safety Tracker then lays the draft out in the same style/section order as the existing ${esc(TEMPLATE_CATALOGUE[type].label)} format.</p></div>
 </div>
 <div class="template-responsibility"><strong>Creator/approver responsibility:</strong> this is a drafting aid. Check the linked source documents, site conditions, hazards, controls and final wording before approval.</div>
 <div class="template-mode">
  <label><input type="radio" name="templateMode" value="EXISTING"> Use / link existing</label>
  <label><input type="radio" name="templateMode" value="VERSION"> Create new version from existing</label>
  <label><input type="radio" name="templateMode" value="NEW" checked> Create new document</label>
 </div>
 <div class="template-grid">
  <label>Document / task title<input data-template-title type="text" value="${esc(titleGuess)}" placeholder="Describe the task/topic"></label>
  <label>Reference<input data-template-ref type="text" value="${esc(newRef)}"></label>
  <label class="full">Closest existing ${esc(TEMPLATE_CATALOGUE[type].label)}<select data-template-match><option value="">No template selected yet</option>${matches.map(x=>`<option value="${esc(displayTitle(x.d))}">${esc(x.d.reference||'')} — ${esc(displayTitle(x.d))}</option>`).join('')}</select><span class="template-help">Used as the topic/format example. Choosing it does not overwrite the approved document.</span></label>
 </div>
 <div class="template-questionnaire">${TEMPLATE_CATALOGUE[type].sections.map(sec=>`<label class="${sec[2]==='textarea'?'full':''}"><span>${esc(sec[0])}</span>${inputForSection(sec)}</label>`).join('')}</div>
 <div class="template-actions"><button type="button" class="secondary" data-template-preview-btn>Build document preview</button><button type="button" class="primary" data-template-apply disabled>Apply answers to creator</button></div>
 <div class="template-doc-preview" data-template-preview hidden></div>`;
 const first=q('form',r)||q('#modalBody',r)||r;
 first.prepend(panel);
 // Other checkboxes reveal free text
 qa('.template-checks',panel).forEach(box=>qa('input[type=checkbox]',box).forEach(cb=>cb.addEventListener('change',()=>{
   const o=qa('input[type=checkbox]',box).find(x=>x.value==='Other'),inp=q('[data-template-other]',box);if(inp)inp.hidden=!(o&&o.checked);
 })));
 // Re-score templates when title changes.
 q('[data-template-title]',panel).addEventListener('input',e=>{
   const ms=templateMatches(type,e.target.value),sel=q('[data-template-match]',panel);
   const old=sel.value;sel.innerHTML=`<option value="">No template selected yet</option>`+ms.map(x=>`<option value="${esc(displayTitle(x.d))}">${esc(x.d.reference||'')} — ${esc(displayTitle(x.d))}</option>`).join('');
   if([...sel.options].some(o=>o.value===old))sel.value=old;
 });
 q('[data-template-preview-btn]',panel).onclick=()=>renderTemplatePreview(panel,r,type);
 q('[data-template-apply]',panel).onclick=()=>{
   let draft={};try{draft=JSON.parse(panel.dataset.templateDraft||'{}')}catch{}
   const n=syncTemplateToBase(r,type,draft.answers||{},draft.title||'',draft.reference||'');
   r.dataset.templateDrivenDraft=JSON.stringify(draft);
   toast(`Template draft prepared. ${n} existing creator field${n===1?'':'s'} filled where blank. Review before saving.`);
 };
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-creator-start]');
 if(b){lastCreatorType=clean(b.dataset.creatorStart).toUpperCase();setTimeout(()=>enhanceTemplateCreator(root()),120)}
},true);

new MutationObserver(()=>setTimeout(()=>enhance(),0)).observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('click',()=>setTimeout(()=>enhance(),50),true);document.addEventListener('change',()=>setTimeout(()=>enhance(),50),true);setTimeout(enhance,700);
window.SafetyTrackerCoshhAssist={version:VERSION,nextRef,analyse,enhance,get lastAnalysis(){return lastAnalysis}};
})();
