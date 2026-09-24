/* Safety Tracker v2.11.18 - existing Training Excel Report becomes rolling tracker */
'use strict';
(function(){
  if(window.__SAFETY_TRAINING_HISTORY_EXCEL_V21118)return;
  window.__SAFETY_TRAINING_HISTORY_EXCEL_V21118=true;

  function boot(){
    const api=window.SafetyTrackerV2;
    if(!api||!api.state||typeof reportTrainingRows!=='function'||typeof assignmentStatus!=='function'){
      setTimeout(boot,120);
      return;
    }
    install(api);
  }

  function install(api){
    const state=api.state;
    const $=id=>document.getElementById(id);
    const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

    function departmentsFor(userId){
      const links=(state.userDepartments||[]).filter(x=>x.user_id===userId);
      const names=links.map(x=>(state.departments||[]).find(d=>d.id===x.department_id)?.name).filter(Boolean);
      if(names.length)return [...new Set(names)].join(', ');
      const p=(state.profiles||state.people||[]).find(x=>x.id===userId)||{};
      const dep=(state.departments||[]).find(d=>d.id===p.department_id);
      return dep?.name||p.department_name||'';
    }

    function versionLabelForTraining(t){
      if(!t)return '';
      const vid=t.source_document_version_id;
      if(vid){
        const v=(state.versions||[]).find(x=>x.id===vid);
        if(v?.version_label)return v.version_label;
      }
      if(t.source_document_id){
        try{
          const v=currentVersion(t.source_document_id);
          if(v?.version_label)return v.version_label;
        }catch(_e){}
      }
      return t.version_label||'';
    }

    function renewalText(a,t){
      const n=Number(a?.renewal_value||t?.renewal_value||0);
      const unit=clean(a?.renewal_unit||t?.renewal_unit||'');
      if(!n||!unit)return '';
      return `${n} ${unit.toLowerCase()}${n===1?'':'s'}`;
    }

    function safeDate(v){
      if(!v)return null;
      const d=new Date(v);
      return Number.isNaN(d.getTime())?null:d;
    }

    function monthKey(d){
      if(!d)return '';
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }

    function historyRows(){
      return (state.trainingSignoffs||[])
        .slice()
        .sort((a,b)=>new Date(a.signed_at||0)-new Date(b.signed_at||0))
        .map(s=>{
          const a=(state.trainingAssignments||[]).find(x=>x.id===s.training_assignment_id)
            || (state.trainingAssignments||[]).find(x=>x.training_session_id===s.training_session_id&&x.user_id===s.user_id);
          const t=(state.training||[]).find(x=>x.id===(s.training_session_id||a?.training_session_id));
          const userId=s.user_id||a?.user_id;
          const completed=safeDate(s.signed_at||s.delivered_date_snapshot);
          let nextDue=null;
          try{
            if(a&&completed){
              const due=trainingAssignmentDue(a,s);
              nextDue=safeDate(due);
            }
          }catch(_e){}
          const method=t&&a?effectiveTrainingMethod(t,a):(t?.delivery_method||'');
          return {
            person:personName(userId),
            department:departmentsFor(userId),
            reference:trainingReference(t)||'',
            training:s.training_name_snapshot||t?.name||'Training record',
            type:kindLabel(trainingKind(t)),
            method:deliveryText(method),
            completed,
            month:monthKey(completed),
            year:completed?completed.getFullYear():'',
            delivered:safeDate(s.delivered_date_snapshot||t?.delivered_date),
            version:versionLabelForTraining(t),
            acknowledged:s.signature_name||personName(userId)||'',
            instructor:s.trainer_snapshot||t?.trainer_name||'',
            renewal:renewalText(a,t),
            nextDue,
            assignmentActive:a?.active===false?'No':'Yes',
            trainingStatus:t?.status||''
          };
        });
    }

    function styleSheet(ws,lastCol){
      ws.views=[{state:'frozen',ySplit:1}];
      ws.autoFilter={from:'A1',to:`${lastCol}1`};
      const head=ws.getRow(1);
      head.font={bold:true,color:{argb:'FFFFFFFF'}};
      head.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17324D'}};
      head.alignment={vertical:'middle'};
      head.height=24;
      ws.eachRow((row,rowNumber)=>{
        row.alignment={vertical:'top',wrapText:true};
        if(rowNumber>1)row.eachCell(c=>{c.protection={locked:true}});
      });
    }

    async function protect(ws){
      await ws.protect('SafetyTrackerReport',{
        autoFilter:true,
        sort:false,
        selectLockedCells:true,
        selectUnlockedCells:true,
        formatCells:false,
        formatColumns:false,
        formatRows:false,
        insertRows:false,
        deleteRows:false,
        insertColumns:false,
        deleteColumns:false
      });
    }

    async function buildWorkbook(){
      const wb=new ExcelJS.Workbook();
      wb.creator='Safety Tracker';
      wb.created=new Date();
      wb.subject='Rolling training tracker';
      wb.title='Safety Tracker Training History';

      // Sheet 1: existing current-position report, kept in the same workbook.
      const current=wb.addWorksheet('Current Status');
      current.columns=[
        {header:'Person',key:'person',width:28},
        {header:'Department',key:'department',width:24},
        {header:'Reference',key:'reference',width:18},
        {header:'Training / Document',key:'training',width:42},
        {header:'Type',key:'type',width:22},
        {header:'Method',key:'method',width:18},
        {header:'Status',key:'status',width:18},
        {header:'Due Date',key:'due',width:15},
        {header:'Latest Completed Date',key:'completed',width:20},
        {header:'Version',key:'version',width:14},
        {header:'Acknowledged by',key:'signed',width:24},
        {header:'Instructor',key:'instructor',width:24},
        {header:'Renewal Period',key:'renewal',width:18}
      ];

      const rows=reportTrainingRows().slice().sort((a,b)=>
        String(a.person||'').localeCompare(String(b.person||''))||
        String(a.t?.name||'').localeCompare(String(b.t?.name||''))
      );

      for(const x of rows){
        const uid=x.a.user_id;
        const sign=(state.trainingSignoffs||[])
          .filter(z=>z.training_assignment_id===x.a.id)
          .sort((a,b)=>new Date(b.signed_at||0)-new Date(a.signed_at||0))[0];
        const confirmation=(state.trainingConfirmations||state.trainingDeliveryConfirmations||[])
          .filter(z=>z.assignment_id===x.a.id||z.training_assignment_id===x.a.id)
          .sort((a,b)=>new Date(b.confirmed_at||0)-new Date(a.confirmed_at||0))[0];
        const instructor=sign?.trainer_snapshot||x.t?.trainer_name||confirmation?.confirmed_by_name||'';

        current.addRow({
          person:x.person,
          department:departmentsFor(uid),
          reference:trainingReference(x.t)||'',
          training:x.t?.name||'',
          type:kindLabel(trainingKind(x.t)),
          method:deliveryText(x.st.method),
          status:x.st.label||x.st.code||'',
          due:x.st.due?safeDate(x.st.due):null,
          completed:sign?.signed_at?safeDate(sign.signed_at):null,
          version:versionLabelForTraining(x.t),
          signed:sign?.signature_name||'',
          instructor,
          renewal:renewalText(x.a,x.t)
        });
      }

      styleSheet(current,'M');
      current.getColumn('due').numFmt='dd/mm/yyyy';
      current.getColumn('completed').numFmt='dd/mm/yyyy hh:mm';
      await protect(current);

      // Sheet 2: permanent rolling history. Every sign-off is one row.
      const history=wb.addWorksheet('Training History');
      history.columns=[
        {header:'Completed Date',key:'completed',width:20},
        {header:'Completion Month',key:'month',width:17},
        {header:'Year',key:'year',width:10},
        {header:'Person',key:'person',width:28},
        {header:'Department',key:'department',width:24},
        {header:'Reference',key:'reference',width:18},
        {header:'Training / Document',key:'training',width:42},
        {header:'Type',key:'type',width:22},
        {header:'Method',key:'method',width:18},
        {header:'Version',key:'version',width:14},
        {header:'Acknowledged by',key:'acknowledged',width:24},
        {header:'Instructor',key:'instructor',width:24},
        {header:'Delivered Date',key:'delivered',width:16},
        {header:'Renewal Period',key:'renewal',width:18},
        {header:'Next Due Date',key:'nextDue',width:16},
        {header:'Assignment Active',key:'assignmentActive',width:16}
      ];

      const hist=historyRows();
      for(const x of hist)history.addRow(x);

      styleSheet(history,'P');
      history.getColumn('completed').numFmt='dd/mm/yyyy hh:mm';
      history.getColumn('delivered').numFmt='dd/mm/yyyy';
      history.getColumn('nextDue').numFmt='dd/mm/yyyy';
      await protect(history);

      // Keep a small summary in workbook properties rather than adding another report/sheet.
      wb.description=`Training History workbook. ${hist.length} historical completion record${hist.length===1?'':'s'} through ${new Date().toLocaleDateString('en-GB')}.`;
      return {wb,historyCount:hist.length,currentCount:rows.length};
    }

    async function downloadRollingTrainingExcel(){
      const b=$('trainingExcelBtn');
      if(typeof canViewReports==='function'&&!canViewReports())return api.toast?.('Reports access required.');
      if(!window.ExcelJS)return api.toast?.('Excel library did not load. Refresh and try again.');
      if(b){b.disabled=true;b.textContent='Creating Training History…'}
      try{
        const {wb,historyCount,currentCount}=await buildWorkbook();
        const bytes=await wb.xlsx.writeBuffer();
        downloadBlob(
          new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
          `Safety-Tracker-Training-History-${todayISO()}.xlsx`
        );
        api.toast?.(`Training History downloaded — ${historyCount} historical completion${historyCount===1?'':'s'} and ${currentCount} current assignment${currentCount===1?'':'s'}.`);
      }catch(e){
        console.error('v2.11.18 training tracker',e);
        api.toast?.(`Training Excel failed: ${e?.message||e}`);
      }finally{
        if(b){b.disabled=false;b.textContent='Training History (Excel)'}
      }
    }

    // Replace the existing report; do not add a second Excel report.
    const b=$('trainingExcelBtn');
    if(b)b.textContent='Training History (Excel)';

    // Capture phase stops the old downloadTrainingExcel click handlers.
    document.addEventListener('click',e=>{
      const btn=e.target.closest?.('#trainingExcelBtn');
      if(!btn)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      downloadRollingTrainingExcel();
    },true);

    window.SafetyTrainingHistoryExcelV21118={
      buildWorkbook,
      download:downloadRollingTrainingExcel,
      historyRows
    };
  }

  boot();
})();
