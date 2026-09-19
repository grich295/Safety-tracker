/* Safety Tracker v2.10.74 - clean multi-section Register PDF */
'use strict';
(function(){
  if(window.__SAFETY_V21074_REGISTER_PDF_PAGES)return;
  window.__SAFETY_V21074_REGISTER_PDF_PAGES=true;

  function cleanTitleForReference74(ref,title){
    const r=String(ref||'').trim();
    const t=String(title||'').trim();
    if(!r||!t)return t;
    const escaped=r.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return t.replace(new RegExp('^'+escaped+'\\s*[-–—:]\\s*','i'),'').trim()||t;
  }

  function sectionRows74(kind){
    if(kind==='TOOLBOX_TALK'){
      return (typeof registerToolboxRows==='function'?registerToolboxRows():[]).map(t=>{
        const ref=typeof trainingReference==='function'?(trainingReference(t)||''):(t.reference||'');
        const f=typeof latestTrainingFile==='function'?latestTrainingFile(t.id):null;
        return [
          ref,
          cleanTitleForReference74(ref,t.name||''),
          '—',
          'Training-controlled',
          f&&f.created_at&&typeof fmtDate==='function'?fmtDate(f.created_at):'—',
          t.review_date&&typeof fmtDate==='function'?fmtDate(t.review_date):'—'
        ];
      });
    }

    const docs=typeof registerDocumentRows==='function'?registerDocumentRows(kind):[];
    return docs.map(d=>{
      const v=typeof approvedCurrentVersion==='function'?approvedCurrentVersion(d.id):null;
      const ref=d.reference||'';
      return [
        ref,
        typeof documentDisplayTitle==='function'?documentDisplayTitle(d):(d.title||''),
        v?.version_label||'',
        typeof versionApprovalLabel==='function'?versionApprovalLabel(v,d):'Approved/current',
        v?.issue_date&&typeof fmtDate==='function'?fmtDate(v.issue_date):'—',
        kind==='SDS'?'—':(v?.review_date&&typeof fmtDate==='function'?fmtDate(v.review_date):'—')
      ];
    });
  }

  function newRegisterPdf74(){
    if(!window.jspdf?.jsPDF)throw new Error('PDF library did not load.');
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const sections=[
      ['RISK_ASSESSMENT','Risk Assessments'],
      ['COSHH','COSHH Risk Assessments'],
      ['SSW','Safe Systems of Work'],
      ['SDS','MSDS / Safety Data Sheets'],
      ['TOOLBOX_TALK','Toolbox Talks']
    ];
    const generated=new Date().toLocaleString('en-GB');

    sections.forEach(([kind,label],index)=>{
      if(index>0)doc.addPage();

      doc.setFontSize(15);
      doc.text('Safety Tracker Approved / Current Document Register',12,14);
      doc.setFontSize(12);
      doc.text(label,12,22);
      doc.setFontSize(7.5);
      doc.text(`Generated ${generated} · Approved/current records only`,12,28);

      const body=sectionRows74(kind);
      doc.autoTable({
        head:[['Reference','Title','Version','Status','Issue / file date','Review date']],
        body:body.length?body:[['—','No approved/current items registered.','','','','']],
        startY:33,
        theme:'grid',
        styles:{
          fontSize:7,
          cellPadding:1.8,
          valign:'top',
          overflow:'linebreak'
        },
        headStyles:{
          fillColor:[218,232,242],
          textColor:[20,30,40],
          fontStyle:'bold'
        },
        columnStyles:{
          0:{cellWidth:30},
          1:{cellWidth:'auto'},
          2:{cellWidth:20},
          3:{cellWidth:34},
          4:{cellWidth:30},
          5:{cellWidth:30}
        },
        margin:{left:12,right:12,bottom:14}
      });
    });

    const pages=doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      const h=doc.internal.pageSize.getHeight();
      const w=doc.internal.pageSize.getWidth();
      doc.setFontSize(7);
      doc.text(`Safety Tracker · Page ${i} of ${pages}`,w-12,h-7,{align:'right'});
    }

    const date=(typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10));
    doc.save(`safety-document-register-${date}.pdf`);
  }

  try{
    documentRegisterPdf=function(){
      try{return newRegisterPdf74()}
      catch(e){
        try{return (window.toast||window.SafetyTrackerV2?.toast)?.('Register PDF failed: '+(e?.message||e))}
        catch(_e){throw e}
      }
    };
    window.documentRegisterPdf=documentRegisterPdf;
  }catch(_e){
    window.documentRegisterPdf=newRegisterPdf74;
  }

  window.SafetyRegisterPdfV21074={download:newRegisterPdf74};
})();
