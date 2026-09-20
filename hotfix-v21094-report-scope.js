/* Safety Tracker v2.10.94 - whole Reports scope + department-correct exports */
'use strict';
(function(){
  if(window.__REPORT_SCOPE_V21094)return;
  window.__REPORT_SCOPE_V21094=true;

  function boot(){
    const core=window.SafetyTrackerV2;
    if(!core||!core.state||!core.sb){setTimeout(boot,120);return;}
    install(core);
  }

  function install(core){
    const state=core.state,sb=core.sb,$=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const toast=m=>{try{core.toast(m)}catch(_e){}};
    const today=()=>new Date().toISOString().slice(0,10);
    const fmtDate=v=>v?new Date(String(v).length===10?v+'T00:00:00':v).toLocaleDateString('en-GB'):'—';
    const fmtDateTime=v=>v?new Date(v).toLocaleString('en-GB'):'—';
    const person=id=>(state.people||state.profiles||[]).find(x=>x.id===id)||null;
    const personName=id=>{const p=person(id);return p?.display_name||p?.email||'Unknown person'};
    const dept=id=>(state.departments||[]).find(x=>x.id===id)||null;
    const deptName=id=>dept(id)?.name||'Department';

    let meta={positions:[],userPositions:[],responsibilities:[]};
    let reportScope=null;
    let installing=true;

    /* ---- Department membership: always use user_departments, never profile.department_id. ---- */
    function userDeptIds(uid){
      return [...new Set((state.userDepartments||[])
        .filter(x=>x.user_id===uid&&x.department_id)
        .map(x=>x.department_id))];
    }
    function userDeptNames(uid){
      return userDeptIds(uid)
        .map(deptName)
        .filter(Boolean)
        .sort((a,b)=>a.localeCompare(b))
        .join(' + ') || 'No department';
    }

    function currentPositionDeptIds(){
      const uid=state.user?.id,out=new Set(),posMap=new Map(meta.positions.map(x=>[x.id,x]));
      for(const row of meta.userPositions){
        if(row.user_id!==uid||row.active===false)continue;
        const p=posMap.get(row.position_id);
        if(p?.primary_department_id)out.add(p.primary_department_id);
      }
      for(const r of meta.responsibilities){
        if(r.user_id===uid&&r.active!==false&&r.responsibility_type==='DEPARTMENT_MANAGER'&&r.department_id)out.add(r.department_id);
      }
      for(const id of userDeptIds(uid))out.add(id);
      return [...out];
    }
    function defaultScope(){
      const ids=currentPositionDeptIds();
      if(ids.length===1)return 'DEPT:'+ids[0];
      if(ids.length>1)return 'MY_POSITIONS';
      return 'ALL';
    }

    function scopeDeptIds(scope=reportScope){
      if(!scope||scope==='ALL'||scope.startsWith('PERSON:'))return null;
      if(scope==='MY_POSITIONS')return new Set(currentPositionDeptIds());
      if(scope.startsWith('DEPT:'))return new Set([scope.slice(5)]);
      return null;
    }
    function scopePersonId(scope=reportScope){
      return scope&&scope.startsWith('PERSON:')?scope.slice(7):null;
    }
    function scopeLabel(scope=reportScope){
      if(!scope||scope==='ALL')return 'Whole hotel';
      if(scope==='MY_POSITIONS'){
        const names=currentPositionDeptIds().map(deptName);
        return 'My positions'+(names.length?' · '+names.join(' + '):'');
      }
      if(scope.startsWith('DEPT:'))return deptName(scope.slice(5));
      if(scope.startsWith('PERSON:')){
        const uid=scope.slice(7);
        return personName(uid)+' · '+userDeptNames(uid);
      }
      return 'Whole hotel';
    }
    function scopeSlug(){
      return scopeLabel().replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'Whole-hotel';
    }

    function userIdsForScope(scope=reportScope){
      if(!scope||scope==='ALL')return new Set((state.people||state.profiles||[]).map(p=>p.id));
      const pid=scopePersonId(scope);
      if(pid)return new Set([pid]);
      const deps=scopeDeptIds(scope)||new Set(),out=new Set();
      for(const row of state.userDepartments||[])if(deps.has(row.department_id))out.add(row.user_id);
      return out;
    }

    function documentIdsForScope(scope=reportScope){
      if(!scope||scope==='ALL')return new Set((state.documents||[]).map(d=>d.id));
      const users=userIdsForScope(scope),deps=scopePersonId(scope)
        ? new Set(userDeptIds(scopePersonId(scope)))
        : (scopeDeptIds(scope)||new Set());
      const out=new Set(),byDoc=new Map();
      for(const a of state.documentAudiences||[]){
        if(!byDoc.has(a.document_id))byDoc.set(a.document_id,[]);
        byDoc.get(a.document_id).push(a);
      }
      for(const d of state.documents||[]){
        const rows=byDoc.get(d.id)||[];
        if(rows.some(a=>a.target_type==='EVERYONE')){out.add(d.id);continue}
        if(rows.some(a=>a.target_type==='DEPARTMENT'&&deps.has(a.department_id))){out.add(d.id);continue}
        if(rows.some(a=>a.target_type==='PERSON'&&users.has(a.user_id))){out.add(d.id);continue}
      }
      return out;
    }

    function documentScopeLabel(documentId){
      const rows=(state.documentAudiences||[]).filter(a=>a.document_id===documentId);
      if(!rows.length)return 'Scope required';
      if(rows.some(a=>a.target_type==='EVERYONE'))return 'Whole hotel';
      const deps=[...new Set(rows.filter(a=>a.target_type==='DEPARTMENT'&&a.department_id).map(a=>deptName(a.department_id)))];
      const ppl=[...new Set(rows.filter(a=>a.target_type==='PERSON'&&a.user_id).map(a=>personName(a.user_id)))];
      return deps.concat(ppl).join(' + ')||'Scope required';
    }

    const scopedKeys=[
      'people','profiles','userDepartments',
      'trainingAssignments','trainingSignoffs','trainingExceptions','trainingConfirmations',
      'awarenessAssignments','awarenessActivity',
      'ppeAssignments','ppeChecks','ppeCheckItems',
      'firstAidBoxes','firstAidBoxItems','firstAidChecks','firstAidCheckItems',
      'documents','versions','documentReviews','documentActivity','documentAudiences',
      'documentLinks','trainingDocumentLinks'
    ];

    function applyScope(scope=reportScope){
      if(!scope||scope==='ALL')return null;
      const saved={};for(const k of scopedKeys)saved[k]=state[k];

      const users=userIdsForScope(scope),docs=documentIdsForScope(scope);
      const personId=scopePersonId(scope),deps=personId?new Set(userDeptIds(personId)):(scopeDeptIds(scope)||new Set());

      const assignments=(state.trainingAssignments||[]).filter(a=>users.has(a.user_id));
      const assignmentIds=new Set(assignments.map(a=>a.id));
      const ppeChecks=(state.ppeChecks||[]).filter(c=>users.has(c.user_id));
      const ppeCheckIds=new Set(ppeChecks.map(c=>c.id));

      let firstAidChecks,firstAidBoxes;
      if(personId){
        firstAidChecks=(state.firstAidChecks||[]).filter(c=>c.assigned_user_id===personId||c.submitted_by===personId);
        const boxIds=new Set(firstAidChecks.map(c=>c.box_id).filter(Boolean));
        firstAidBoxes=(state.firstAidBoxes||[]).filter(b=>boxIds.has(b.id)||b.default_user_id===personId);
      }else{
        firstAidBoxes=(state.firstAidBoxes||[]).filter(b=>deps.has(b.department_id));
        const boxIds=new Set(firstAidBoxes.map(b=>b.id));
        firstAidChecks=(state.firstAidChecks||[]).filter(c=>boxIds.has(c.box_id));
      }
      const faCheckIds=new Set(firstAidChecks.map(c=>c.id));
      const versionIds=new Set((state.versions||[]).filter(v=>docs.has(v.document_id)).map(v=>v.id));

      if(Array.isArray(state.people))state.people=state.people.filter(p=>users.has(p.id));
      if(Array.isArray(state.profiles))state.profiles=state.profiles.filter(p=>users.has(p.id));
      state.userDepartments=(state.userDepartments||[]).filter(x=>users.has(x.user_id));
      state.trainingAssignments=assignments;
      state.trainingSignoffs=(state.trainingSignoffs||[]).filter(x=>users.has(x.user_id)||assignmentIds.has(x.training_assignment_id));
      state.trainingExceptions=(state.trainingExceptions||[]).filter(x=>users.has(x.user_id)||assignmentIds.has(x.training_assignment_id));
      state.trainingConfirmations=(state.trainingConfirmations||[]).filter(x=>users.has(x.user_id)||assignmentIds.has(x.assignment_id));
      state.awarenessAssignments=(state.awarenessAssignments||[]).filter(x=>users.has(x.user_id));
      state.awarenessActivity=(state.awarenessActivity||[]).filter(x=>users.has(x.user_id));
      state.ppeAssignments=(state.ppeAssignments||[]).filter(x=>users.has(x.user_id));
      state.ppeChecks=ppeChecks;
      state.ppeCheckItems=(state.ppeCheckItems||[]).filter(x=>ppeCheckIds.has(x.check_id));
      state.firstAidBoxes=firstAidBoxes;
      state.firstAidBoxItems=(state.firstAidBoxItems||[]).filter(x=>firstAidBoxes.some(b=>b.id===x.box_id));
      state.firstAidChecks=firstAidChecks;
      state.firstAidCheckItems=(state.firstAidCheckItems||[]).filter(x=>faCheckIds.has(x.check_id));
      state.documents=(state.documents||[]).filter(d=>docs.has(d.id));
      state.versions=(state.versions||[]).filter(v=>docs.has(v.document_id));
      state.documentReviews=(state.documentReviews||[]).filter(r=>docs.has(r.document_id)||versionIds.has(r.document_version_id));
      state.documentActivity=(state.documentActivity||[]).filter(a=>{
        if(a.document_id)return docs.has(a.document_id);
        return !a.user_id||users.has(a.user_id);
      });
      state.documentAudiences=(state.documentAudiences||[]).filter(a=>docs.has(a.document_id));
      state.documentLinks=(state.documentLinks||[]).filter(l=>docs.has(l.source_document_id)&&docs.has(l.target_document_id));
      state.trainingDocumentLinks=(state.trainingDocumentLinks||[]).filter(l=>docs.has(l.document_id));
      return saved;
    }
    function restoreScope(saved){if(saved)for(const [k,v] of Object.entries(saved))state[k]=v}
    function scopedSync(fn){const s=applyScope();try{return fn()}finally{restoreScope(s)}}
    async function scopedAsync(fn){const s=applyScope();try{return await fn()}finally{restoreScope(s)}}

    async function loadMeta(){
      try{
        const [p,u,r]=await Promise.all([
          sb.from('safety_positions_v21069').select('*').eq('active',true),
          sb.from('safety_user_positions_v21069').select('*').eq('active',true),
          sb.from('safety_responsibilities_v21069').select('*').eq('active',true)
        ]);
        meta={positions:p.data||[],userPositions:u.data||[],responsibilities:r.data||[]};
      }catch(e){console.warn('Report scope metadata',e)}
      if(!reportScope)reportScope=defaultScope();
    }

    function scopeOptions(){
      const active=(state.departments||[]).filter(d=>d.active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
      const activePeople=(state.people||state.profiles||[]).filter(p=>p.active!==false&&p.report_only!==true).sort((a,b)=>personName(a.id).localeCompare(personName(b.id)));
      const disabled=(state.people||state.profiles||[]).filter(p=>p.active===false&&p.report_only!==true).sort((a,b)=>personName(a.id).localeCompare(personName(b.id)));
      const mine=currentPositionDeptIds();
      let html='<optgroup label="Hotel">';
      if(mine.length>1)html+='<option value="MY_POSITIONS">My positions · '+esc(mine.map(deptName).join(' + '))+'</option>';
      html+='<option value="ALL">Whole hotel</option></optgroup>';
      html+='<optgroup label="Departments">'+active.map(d=>`<option value="DEPT:${d.id}">${esc(d.name)}</option>`).join('')+'</optgroup>';
      html+='<optgroup label="People - active">'+activePeople.map(p=>`<option value="PERSON:${p.id}">${esc(personName(p.id))} · ${esc(userDeptNames(p.id))}</option>`).join('')+'</optgroup>';
      if(disabled.length)html+='<optgroup label="People - disabled">'+disabled.map(p=>`<option value="PERSON:${p.id}">${esc(personName(p.id))} · ${esc(userDeptNames(p.id))}</option>`).join('')+'</optgroup>';
      return html;
    }

    function hideLegacyScope(){
      const old=$('reportScopeCardV21091');if(old)old.hidden=true;
    }
    function ensureScopeUi(){
      const view=$('reportsView');if(!view)return;
      hideLegacyScope();
      let box=$('reportScopeCardV21094');
      if(!box){
        box=document.createElement('div');
        box.id='reportScopeCardV21094';
        box.className='section-card report-manager-content report-scope-v21094';
        const stats=$('reportStats');
        if(stats)stats.insertAdjacentElement('beforebegin',box);else view.prepend(box);
      }
      box.innerHTML=`<div class="row-between"><div><h3>Report scope</h3>
        <p class="muted">This filter controls the whole Reports section — screen totals, PDFs and Excel exports.</p></div></div>
        <div class="form-grid"><label>Show reports for
          <select id="reportScopeSelectV21094">${scopeOptions()}</select>
        </label>
        <div class="hint-box"><strong>Current scope:</strong> ${esc(scopeLabel())}<br>
        Person reports use that person's actual department membership. Department is no longer read from the profile record.</div></div>`;
      const sel=$('reportScopeSelectV21094');
      if(sel){
        if([...sel.options].some(o=>o.value===reportScope))sel.value=reportScope;
        else{reportScope=defaultScope();sel.value=reportScope}
      }
    }

    /* Neutralise v2.10.91's private scope so it doesn't double-filter this build. */
    const legacySel=$('reportScopeSelectV21091');
    if(legacySel&&legacySel.value!=='ALL'){
      legacySel.value='ALL';
      legacySel.dispatchEvent(new Event('change',{bubbles:true}));
    }

    const previousRender=window.renderReports;
    if(typeof previousRender==='function'){
      window.renderReports=function(){
        const out=scopedSync(()=>previousRender.apply(this,arguments));
        ensureScopeUi();hideLegacyScope();syncEvidencePersonOptions();
        return out;
      };
    }

    /* ---------------- PDF helpers ---------------- */
    function pdfBase(title,subtitle=''){
      if(!window.jspdf?.jsPDF)throw new Error('PDF library did not load. Refresh and try again.');
      const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      doc.setFontSize(18);doc.text(title,14,15);
      doc.setFontSize(9);
      const bits=[subtitle,`Scope: ${scopeLabel()}`,`Generated ${new Date().toLocaleString('en-GB')}`,`Safety Tracker v${window.APP_VERSION||''}`].filter(Boolean);
      doc.text(bits.join(' · '),14,22);
      return doc;
    }
    function trainingRef(t){return window.trainingReference?.(t)||t?.reference||''}
    function trainingKindLabel(t){return window.kindLabel?.(window.trainingKind?.(t))||String(t?.session_type||t?.training_kind||'Training').replaceAll('_',' ')}
    function methodLabel(m){return window.deliveryText?.(m)||String(m||'').replaceAll('_',' ')}
    function currentVersion(id){return window.currentVersion?.(id)||window.approvedCurrentVersion?.(id)||(state.versions||[]).find(v=>v.document_id===id&&v.status==='CURRENT')||null}
    function assignmentStatusSafe(a,t){
      try{return window.assignmentStatus?.(a,t)||{code:'ASSIGNED',label:'Assigned',due:a.due_date,method:a.delivery_method||t?.delivery_method}}catch(_e){return {code:'ASSIGNED',label:'Assigned',due:a.due_date,method:a.delivery_method||t?.delivery_method}}
    }
    function reportTrainingRows(){
      return (state.trainingAssignments||[]).filter(a=>a.active!==false).map(a=>{
        const t=(state.training||[]).find(x=>x.id===a.training_session_id);if(!t)return null;
        return {a,t,st:assignmentStatusSafe(a,t),person:personName(a.user_id),department:userDeptNames(a.user_id)};
      }).filter(Boolean);
    }

    const originalDownloadReport=window.downloadReport;
    window.downloadReport=function(kind){
      return scopedSync(()=>{
        try{
          let doc,name;
          if(kind==='outstanding'){
            const rows=reportTrainingRows().filter(x=>x.st.code!=='COMPLETED');
            doc=pdfBase('Safety Tracker - Outstanding Actions');
            doc.autoTable({head:[['Person','Department','Training','Status','Delivery','Due']],body:rows.length?rows.map(x=>[
              x.person,x.department,trainingRef(x.t)?`${trainingRef(x.t)} - ${x.t.name}`:x.t.name,
              String(x.st.label||x.st.code),methodLabel(x.st.method),fmtDate(x.st.due)
            ]):[['No outstanding training actions','','','','','']],startY:28,styles:{fontSize:7},margin:{left:14,right:14}});
            let y=(doc.lastAutoTable?.finalY||55)+8;
            const overdue=(state.documents||[]).map(d=>({d,v:currentVersion(d.id)})).filter(x=>x.v?.review_date&&new Date(x.v.review_date+'T23:59:59')<new Date());
            if(y>170){doc.addPage();y=14}
            doc.setFontSize(11);doc.text('Overdue document reviews',14,y);
            doc.autoTable({head:[['Reference','Document','Applies to','Version','Review date']],body:overdue.length?overdue.map(x=>[
              x.d.reference||'',x.d.title||'',documentScopeLabel(x.d.id),x.v.version_label||'',fmtDate(x.v.review_date)
            ]):[['None','','','','']],startY:y+3,styles:{fontSize:7},margin:{left:14,right:14}});
            name=`Safety-Tracker-Outstanding-${scopeSlug()}-${today()}.pdf`;
          }else if(kind==='matrix'){
            const rows=reportTrainingRows();
            doc=pdfBase('Safety Tracker - Training Matrix');
            doc.autoTable({head:[['Person','Department','Training','Type','Method','Status','Due']],body:rows.length?rows.map(x=>[
              x.person,x.department,trainingRef(x.t)?`${trainingRef(x.t)} - ${x.t.name}`:x.t.name,
              trainingKindLabel(x.t),methodLabel(x.st.method),x.st.label||x.st.code,fmtDate(x.st.due)
            ]):[['No training assignments','','','','','','']],startY:28,styles:{fontSize:6.8},margin:{left:14,right:14}});
            name=`Safety-Tracker-Training-Matrix-${scopeSlug()}-${today()}.pdf`;
          }else if(kind==='signoffs'){
            const rows=(state.trainingSignoffs||[]).slice().sort((a,b)=>new Date(b.signed_at||0)-new Date(a.signed_at||0));
            doc=pdfBase('Safety Tracker - Training Confirmations');
            doc.autoTable({head:[['Person','Department','Training','Acknowledged by','Completed','Method']],body:rows.length?rows.map(r=>{
              const a=(state.trainingAssignments||[]).find(x=>x.id===r.training_assignment_id);
              const t=(state.training||[]).find(x=>x.id===a?.training_session_id);
              return [personName(a?.user_id),userDeptNames(a?.user_id),t?(trainingRef(t)?`${trainingRef(t)} - ${t.name}`:t.name):'Training record',
                r.signature_name||r.signed_name||personName(a?.user_id),fmtDateTime(r.signed_at),methodLabel(assignmentStatusSafe(a,t).method)];
            }):[['No training sign-offs','','','','','']],startY:28,styles:{fontSize:6.8},margin:{left:14,right:14}});
            name=`Safety-Tracker-Training-Signoffs-${scopeSlug()}-${today()}.pdf`;
          }else if(kind==='reviews'){
            const rows=(state.documents||[]).map(d=>({d,v:currentVersion(d.id)})).filter(x=>x.v).sort((a,b)=>String(a.v.review_date||'9999').localeCompare(String(b.v.review_date||'9999')));
            doc=pdfBase('Safety Tracker - Document Review Dates');
            doc.autoTable({head:[['Reference','Document','Applies to','Type','Version','Issue date','Review date','Status']],body:rows.length?rows.map(x=>{
              const rd=x.v.review_date;let status='No review date';
              if(rd){const dd=Math.ceil((new Date(rd+'T23:59:59')-new Date())/86400000);status=dd<0?'Overdue':dd<=30?'Due within 30 days':'Current'}
              return [x.d.reference||'',x.d.title||'',documentScopeLabel(x.d.id),String(x.d.doc_type||'').replaceAll('_',' '),x.v.version_label||'',fmtDate(x.v.issue_date),fmtDate(rd),status];
            }):[['No controlled documents','','','','','','','']],startY:28,styles:{fontSize:6.5},margin:{left:14,right:14}});
            name=`Safety-Tracker-Review-Dates-${scopeSlug()}-${today()}.pdf`;
          }else if(originalDownloadReport){
            return originalDownloadReport(kind);
          }else throw new Error('Unknown report type.');
          doc.save(name);toast('Report downloaded.');
        }catch(e){console.error(e);toast(`Report failed: ${e?.message||e}`)}
      });
    };

    /* ---------------- Excel: actual department membership + scope sheet ---------------- */
    window.downloadTrainingExcel=async function(){
      const b=$('trainingExcelBtn');
      if(!window.ExcelJS)return toast('Excel library did not load. Refresh and try again.');
      if(b){b.disabled=true;b.textContent='Creating Excel…'}
      try{
        await scopedAsync(async()=>{
          const wb=new ExcelJS.Workbook();wb.creator='Safety Tracker';wb.created=new Date();
          const info=wb.addWorksheet('Report Info');
          info.columns=[{width:24},{width:70}];
          info.addRows([
            ['Report','Safety Tracker Training Report'],
            ['Scope',scopeLabel()],
            ['Generated',new Date().toLocaleString('en-GB')],
            ['Department source','User department membership (supports multiple departments)']
          ]);
          info.getColumn(1).font={bold:true};

          const ws=wb.addWorksheet('Training Report',{views:[{state:'frozen',ySplit:1}]});
          ws.columns=[
            {header:'Person',key:'person',width:28},{header:'Department',key:'department',width:28},{header:'Reference',key:'reference',width:18},
            {header:'Training / Document',key:'training',width:42},{header:'Type',key:'type',width:22},{header:'Method',key:'method',width:18},
            {header:'Status',key:'status',width:18},{header:'Due Date',key:'due',width:15},{header:'Completed Date',key:'completed',width:18},
            {header:'Version',key:'version',width:14},{header:'Acknowledged by',key:'signed',width:24},{header:'Instructor',key:'instructor',width:24}
          ];
          const rows=reportTrainingRows().slice().sort((a,b)=>a.person.localeCompare(b.person)||String(a.t?.name||'').localeCompare(String(b.t?.name||'')));
          for(const x of rows){
            const sign=(state.trainingSignoffs||[]).filter(z=>z.training_assignment_id===x.a.id).sort((a,b)=>new Date(b.signed_at||0)-new Date(a.signed_at||0))[0];
            const att=(state.trainingAttendance||state.instructorAttendance||[]).filter(z=>z.training_assignment_id===x.a.id||z.assignment_id===x.a.id).sort((a,b)=>new Date(b.attended_at||b.created_at||0)-new Date(a.attended_at||a.created_at||0))[0];
            const v=x.t?.source_document_id?currentVersion(x.t.source_document_id):null;
            ws.addRow({
              person:x.person,department:x.department,reference:trainingRef(x.t)||'',training:x.t?.name||'',type:trainingKindLabel(x.t),
              method:methodLabel(x.st.method),status:x.st.label||x.st.code||'',due:x.st.due?new Date(x.st.due):null,
              completed:sign?.signed_at?new Date(sign.signed_at):null,version:v?.version_label||x.t?.version_label||'',
              signed:sign?.signature_name||sign?.signed_name||'',instructor:att?.instructor_name||att?.recorded_by_name||''
            });
          }
          ws.autoFilter={from:'A1',to:'L1'};
          ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
          ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17324D'}};
          ws.getRow(1).height=24;
          ws.eachRow((row,rowNumber)=>{row.alignment={vertical:'top',wrapText:true};if(rowNumber>1)row.eachCell(c=>c.protection={locked:true})});
          ws.getColumn('due').numFmt='dd/mm/yyyy';ws.getColumn('completed').numFmt='dd/mm/yyyy hh:mm';
          await ws.protect('SafetyTrackerReport',{autoFilter:true,selectLockedCells:true,selectUnlockedCells:true,formatCells:false,formatColumns:false,formatRows:false,insertRows:false,deleteRows:false,insertColumns:false,deleteColumns:false});
          const bytes=await wb.xlsx.writeBuffer();
          const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
          if(window.downloadBlob)window.downloadBlob(blob,`Safety-Tracker-Training-${scopeSlug()}-${today()}.xlsx`);
          else{
            const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`Safety-Tracker-Training-${scopeSlug()}-${today()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);
          }
          toast('Training Excel report downloaded with department and report scope.');
        });
      }catch(e){console.error(e);toast(`Excel report failed: ${e?.message||e}`)}
      finally{if(b){b.disabled=false;b.textContent='Training Excel Report'}}
    };

    /* All other Reports exports use the same selected scope. */
    const originals={
      generateMonthlySafetyReport:window.generateMonthlySafetyReport,
      runPpeReportButton:window.runPpeReportButton,
      downloadFirstAidReport:window.downloadFirstAidReport,
      downloadDocumentActivityPdf:window.downloadDocumentActivityPdf,
      monthlySafetyReportDoc:window.monthlySafetyReportDoc,
      monthlyPpeReportDoc:window.monthlyPpeReportDoc,
      reportPdfBase:window.reportPdfBase
    };

    if(typeof originals.reportPdfBase==='function'){
      window.reportPdfBase=function(title,subtitle=''){
        const s=[subtitle,`Scope: ${scopeLabel()}`].filter(Boolean).join(' · ');
        return originals.reportPdfBase(title,s);
      };
    }
    if(typeof originals.monthlySafetyReportDoc==='function'){
      window.monthlySafetyReportDoc=function(value){
        const out=originals.monthlySafetyReportDoc(value);
        try{out.doc.setFontSize(8);out.doc.text(`Scope: ${scopeLabel()}`,205,21)}catch(_e){}
        return out;
      };
    }
    if(typeof originals.monthlyPpeReportDoc==='function'){
      window.monthlyPpeReportDoc=function(value){
        const out=originals.monthlyPpeReportDoc(value);
        try{out.doc.setFontSize(8);out.doc.text(`Scope: ${scopeLabel()}`,205,21)}catch(_e){}
        return out;
      };
    }
    if(typeof originals.generateMonthlySafetyReport==='function'){
      window.generateMonthlySafetyReport=async function(value,opts){
        const report=await scopedAsync(()=>originals.generateMonthlySafetyReport(value,opts));
        if(report?.id){
          try{
            const summary={...(report.summary||{}),report_scope_v21094:reportScope,report_scope_label:scopeLabel()};
            await sb.from('generated_reports').update({summary}).eq('id',report.id);
            report.summary=summary;
          }catch(_e){}
        }
        return report;
      };
    }
    if(typeof originals.runPpeReportButton==='function'){
      window.runPpeReportButton=function(){return scopedAsync(()=>originals.runPpeReportButton.apply(this,arguments))};
    }
    if(typeof originals.downloadFirstAidReport==='function'){
      window.downloadFirstAidReport=function(){return scopedSync(()=>originals.downloadFirstAidReport.apply(this,arguments))};
    }

    window.downloadDocumentActivityPdf=function(){
      return scopedSync(()=>{
        try{
          const rows=(state.documentActivity||[]).slice().sort((a,b)=>new Date(b.occurred_at||0)-new Date(a.occurred_at||0));
          const doc=pdfBase('Safety Tracker - Document Activity Audit');
          doc.autoTable({head:[['Date / time','Person','Department','Action','Reference','Document','Version']],body:rows.length?rows.map(a=>[
            fmtDateTime(a.occurred_at),personName(a.user_id),a.user_id?userDeptNames(a.user_id):'—',
            String(a.action||'').replaceAll('_',' '),a.document_reference||'',a.document_title||a.file_name||'',a.version_label||''
          ]):[['No document activity','','','','','','']],startY:28,styles:{fontSize:6.7},margin:{left:14,right:14}});
          doc.save(`Safety-Tracker-Document-Activity-${scopeSlug()}-${today()}.pdf`);toast('Document activity report downloaded.');
        }catch(e){console.error(e);toast(`Document activity report failed: ${e?.message||e}`)}
      });
    };

    /* Evidence Pack follows the current report scope until a person is chosen. */
    function syncEvidencePersonOptions(){
      const sel=$('evidencePerson');if(!sel)return;
      const allowed=userIdsForScope();
      const exact=scopePersonId();
      for(const o of [...sel.options]){
        if(!o.value)continue;
        const ok=reportScope==='ALL'||allowed.has(o.value);
        o.disabled=!ok;o.hidden=!ok;
      }
      if(exact&&[...sel.options].some(o=>o.value===exact)){
        sel.value=exact;
        sel.dispatchEvent(new Event('change',{bubbles:true}));
      }else if(sel.value&&!allowed.has(sel.value)){
        sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    const modalBody=$('modalBody');
    if(modalBody)new MutationObserver(()=>setTimeout(syncEvidencePersonOptions,20)).observe(modalBody,{childList:true,subtree:true});

    document.addEventListener('change',e=>{
      if(e.target?.id==='reportScopeSelectV21094'){
        reportScope=e.target.value||'ALL';
        try{window.renderReports?.()}catch(err){console.warn(err)}
        syncEvidencePersonOptions();
      }
    },true);

    const observer=new MutationObserver(()=>setTimeout(()=>{ensureScopeUi();hideLegacyScope()},50));
    const reports=$('reportsView');if(reports)observer.observe(reports,{childList:true,subtree:true});

    loadMeta().then(()=>{
      reportScope=defaultScope();
      installing=false;
      try{window.renderReports?.()}catch(_e){ensureScopeUi()}
    });
    window.addEventListener('pageshow',()=>loadMeta().then(()=>{if(!reportScope)reportScope=defaultScope();setTimeout(()=>{try{window.renderReports?.()}catch(_e){ensureScopeUi()}},80)}));

    const style=document.createElement('style');
    style.id='reportScopeStylesV21094';
    style.textContent=`
      #reportScopeCardV21091{display:none!important}
      .report-scope-v21094{margin-bottom:12px}
      .report-scope-v21094 select{width:100%}
      @media(max-width:760px){.report-scope-v21094 .form-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    window.SafetyReportScopeV21094={
      getScope:()=>reportScope,
      getScopeLabel:scopeLabel,
      departmentsForUser:userDeptNames,
      setScope:v=>{reportScope=v||'ALL';window.renderReports?.()}
    };
  }
  boot();
})();