(()=>{
'use strict';
const VERSION='2.10.2';
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
 for(const l of qa('label',r)){if(rx.test(txt(l))){const f=q('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select',l);if(f)return f}}
 return qa('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select',r).find(f=>rx.test(`${f.id} ${f.name} ${f.placeholder}`))||null;
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
 const f=field(/^(COSHH\s*)?Reference\b/i,r)||qa('input',r).find(x=>/reference|ref/i.test(`${x.id} ${x.name} ${x.placeholder}`));
 if(!f||f.dataset.coshhRef)return;
 f.dataset.coshhRef='1';const n=nextRef();
 if(!clean(f.value)||/^test$/i.test(clean(f.value))){f.value=n;f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}))}
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
 const changes=[];
 for(const [rx,val,name] of [[/Existing controls/i,a.controls,'Existing controls'],[/PPE required/i,a.ppe,'PPE'],[/Emergency|stop-work/i,a.emergency,'Emergency'],[/Safe method|key steps/i,a.method,'Safe method'],[/How is the substance used/i,a.use,'Use'],[/Exposure routes|ventilation/i,a.exposure,'Exposure / ventilation'],[/Hazards?/i,a.hazards,'Hazards'],[/Disposal|waste/i,a.disposal,'Disposal']]) if(setIfBlank(r,rx,val))changes.push(name);
 return changes;
}
function renderSummary(r,a,d,changes){let p=q('#coshhReadSummary',r);if(!p){p=document.createElement('div');p.id='coshhReadSummary';p.className='coshh-analysis-panel';q('[data-read-sds]',r)?.closest('.coshh-source-reader')?.after(p)}const found=[['Product',a.product||displayTitle(d)],['Hazards',a.hazards],['PPE',a.ppe],['Handling / controls',a.controls],['Emergency / first aid / spill',a.emergency],['Exposure / ventilation',a.exposure]].filter(x=>clean(x[1]));p.innerHTML=`<h4>SDS read result</h4><div class="coshh-found"><strong>Suggestions found:</strong><ul>${found.map(x=>`<li><strong>${esc(x[0])}:</strong> ${esc(short(x[1],240))}</li>`).join('')}</ul></div><div class="coshh-review"><strong>Fields populated:</strong> ${esc(changes.length?changes.join(', '):'none because existing entries were preserved')}.<br><strong>You must confirm:</strong> frequency, duration, quantity, people exposed, actual site method, work area, dilution and that each suggested control is correct for the intended use.</div><div class="coshh-responsibility"><strong>Assessment responsibility:</strong> Safety Tracker extracts and suggests information only. The person creating and approving the COSHH assessment remains responsible for checking the SDS and final assessment.</div>`}
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
 try{const res=await A.sb.storage.from('safety-files').download(v.storage_path);if(res.error||!res.data)throw new Error(res.error?.message||'Could not download linked SDS.');const text=await A.pdfTextFromBlob?.(res.data)||await localPdfText(res.data);lastAnalysis=analyse(text);const changes=apply(r,lastAnalysis);renderSummary(r,lastAnalysis,d,changes);related(r,lastAnalysis);toast(`SDS read. ${changes.length} field${changes.length===1?'':'s'} populated — review everything before approval.`)}finally{b.disabled=false;b.textContent='Read linked SDS & suggest controls'}
}
function enhanceReader(r){if(!isCoshh(r)||q('[data-read-sds]',r))return;const s=sdsSelect(r);if(!s)return;const b=document.createElement('div');b.className='coshh-source-reader';b.innerHTML='<strong>Read the linked SDS/MSDS</strong><p>Select the source SDS above, then read it. Safety Tracker will suggest hazards, PPE, handling, first aid, spill response, ventilation and related controls where supported by the SDS.</p><button type="button" class="primary" data-read-sds>Read linked SDS &amp; suggest controls</button>';s.parentElement?.after(b);q('[data-read-sds]',b).onclick=()=>readSds(r).catch(e=>toast(e.message||String(e)))}
function updateVersionBadges(){
 qa('.build-badge,.brand-line .version,.demo-brand-line .version').forEach(el=>{if(/2\.10\.0|2\.10\.1/.test(el.textContent))el.textContent=el.textContent.replace(/2\.10\.[01]/g,VERSION)});
}
function enhance(r=root()){updateVersionBadges();if(!isCoshh(r))return;enhanceRef(r);enhancePeople(r);enhanceReader(r)}
new MutationObserver(()=>setTimeout(()=>enhance(),0)).observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('click',()=>setTimeout(()=>enhance(),50),true);document.addEventListener('change',()=>setTimeout(()=>enhance(),50),true);setTimeout(enhance,700);
window.SafetyTrackerCoshhAssist={version:VERSION,nextRef,analyse,enhance,get lastAnalysis(){return lastAnalysis}};
})();
