/* Safety Tracker v2.10.78 - SSW PPE checklist + separate tools/equipment */
'use strict';
(function(){
  if(window.__SAFETY_V21078_SSW_PPE_TOOLS)return;
  window.__SAFETY_V21078_SSW_PPE_TOOLS=true;

  function boot(){
    const ready=
      typeof creatorQuestionnaireHtml==='function' &&
      typeof creatorCollect==='function' &&
      typeof creatorPdf==='function' &&
      typeof activePpeItems==='function' &&
      typeof esc==='function' &&
      typeof clean==='function';
    if(!ready){setTimeout(boot,100);return;}
    install();
  }

  function install(){
    function parseLegacyPpe78(q){
      const selected=new Set(Array.isArray(q?.ppeItems)?q.ppeItems.map(String):[]);
      const free=String(q?.ppe||'').trim();
      const names=(typeof activePpeItems==='function'?activePpeItems():[])
        .map(x=>String(x.name||'').trim())
        .filter(Boolean);

      for(const name of names){
        if(free && free.toLowerCase().includes(name.toLowerCase()))selected.add(name);
      }

      const leftovers=free
        .split(/\n|;/)
        .map(x=>x.trim())
        .filter(Boolean)
        .filter(x=>!names.some(n=>x.toLowerCase()===n.toLowerCase()));

      return {selected,notes:leftovers.join('\n')};
    }

    function ppeChecklistHtml78(q){
      const parsed=parseLegacyPpe78(q||{});
      const items=typeof activePpeItems==='function'?activePpeItems():[];

      return `<div class="full creator-ppe-catalogue-v21078">
        <strong>PPE required</strong>
        <div class="muted">Tick the approved PPE required for this Safe System of Work. This list comes from the live PPE catalogue used by Monthly PPE Checks.</div>
        <div class="creator-ppe-checks-v21078">
          ${items.length?items.map(i=>`<label class="check-row">
            <input type="checkbox" class="creator-ppe-choice-v21078" value="${esc(i.name||'')}" ${parsed.selected.has(String(i.name||''))?'checked':''}>
            <span><strong>${esc(i.name||'PPE')}</strong>${i.code?` <span class="muted">(${esc(i.code)})</span>`:''}</span>
          </label>`).join(''):'<div class="empty">No active PPE is currently set up in the PPE catalogue.</div>'}
        </div>
        <label class="full">PPE notes / special requirement
          <textarea id="creatorPpeNotesV21078" placeholder="Optional: specific type, standard, grade or task-specific detail">${esc(q?.ppeNotes||parsed.notes||'')}</textarea>
        </label>
      </div>`;
    }

    const originalQuestionnaire78=creatorQuestionnaireHtml;
    creatorQuestionnaireHtml=function(type,d={}){
      let html=originalQuestionnaire78.apply(this,arguments);
      if(type!=='SSW')return html;

      const q=d?.questionnaire||{};
      const old=`<label class="full">PPE / tools / equipment<textarea id="creatorPpe">${esc(q.ppe||'')}</textarea></label>`;
      const replacement=`${ppeChecklistHtml78(q)}
        <label class="full">Tools / equipment
          <textarea id="creatorToolsV21078" placeholder="List the tools and equipment required. Put each item on a new line.">${esc(q.tools||'')}</textarea>
        </label>`;

      if(html.includes(old))html=html.replace(old,replacement);
      return html;
    };
    try{window.creatorQuestionnaireHtml=creatorQuestionnaireHtml}catch(_e){}

    const originalCollect78=creatorCollect;
    creatorCollect=function(){
      const q=originalCollect78.apply(this,arguments);
      if(typeof creatorWorking!=='undefined' && creatorWorking?.type==='SSW'){
        const selected=[...document.querySelectorAll('.creator-ppe-choice-v21078:checked')]
          .map(x=>clean(x.value))
          .filter(Boolean);
        const notes=clean(document.getElementById('creatorPpeNotesV21078')?.value);
        const tools=clean(document.getElementById('creatorToolsV21078')?.value);

        q.ppeItems=selected;
        q.ppeNotes=notes;
        q.ppe=[selected.join('\n'),notes].filter(Boolean).join('\n');
        q.tools=tools;
      }
      return q;
    };
    try{window.creatorCollect=creatorCollect}catch(_e){}

    const originalPdf78=creatorPdf;
    creatorPdf=function(d){
      if(d?.doc_type!=='SSW')return originalPdf78.apply(this,arguments);

      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({unit:'mm',format:'a4'});
      const q=d.questionnaire||{};
      const type=d.doc_type;
      const ref=q.reference||creatorNextRef(type);
      const version=q.version||'1';
      const template=creatorTemplateName(q.template_id);

      creatorPdfHeader(doc,type,ref,d.title,version,template);
      let y=38;

      doc.autoTable({
        startY:y,
        theme:'grid',
        styles:{fontSize:8,cellPadding:2},
        body:[
          ['Department','Maintenance'],
          ['Scope / task',q.task||''],
          ['Location',q.location||''],
          ['People affected',q.people||''],
          ['Relevant documents',creatorSourceRefs(d)]
        ],
        columnStyles:{0:{fontStyle:'bold',cellWidth:47}}
      });
      y=doc.lastAutoTable.finalY+6;

      y=creatorAddTextSection(doc,y,'1. Competence / authorisation',q.competence);
      y=creatorAddTextSection(doc,y,'2. PPE required',q.ppe);
      y=creatorAddTextSection(doc,y,'3. Tools / equipment',q.tools);
      y=creatorAddTextSection(doc,y,'4. Before starting / work-area controls',q.prestart);
      y=creatorAddTextSection(doc,y,'5. Safe method / sequence of work',q.steps);
      y=creatorAddTextSection(doc,y,'6. Stop-work conditions',q.stop);
      y=creatorAddTextSection(doc,y,'7. Emergency / incident response',q.emergency);
      y=creatorAddTextSection(doc,y,'8. Completion / housekeeping / hand-back',q.completion);
      y=creatorAddTextSection(doc,y,'Source evidence',q.sourceEvidence);

      return {doc,ref,version};
    };
    try{window.creatorPdf=creatorPdf}catch(_e){}

    const originalCreateRelated78=creatorCreateRelated;
    creatorCreateRelated=function(payload){
      try{
        const [id,type]=String(payload||'').split('|');
        const d=(typeof creatorDraftCache!=='undefined'?creatorDraftCache:[]).find(x=>x.id===id);
        if(type==='SSW' && d){
          const rec=d.recommendation||{};
          const recommended=rec.sswRecommended;
          const old=d.questionnaire||{};
          const q={
            title:d.title,
            task:old.task||'',
            location:old.location||'',
            frequency:old.frequency||'',
            people:old.people||'',
            hazards:old.hazards||'',
            controls:old.controls||'',
            ppe:old.ppe||'',
            ppeItems:Array.isArray(old.ppeItems)?old.ppeItems:[],
            ppeNotes:old.ppeNotes||'',
            tools:old.tools||'',
            emergency:old.emergency||'',
            steps:old.steps||'',
            sourceEvidence:old.sourceEvidence||'',
            flags:old.flags||{},
            overrideReason:recommended?'Recommended by Safety Tracker':'Created by Manager/Admin override despite not being automatically recommended'
          };
          return showCreatorWizard(type,{
            doc_type:type,
            title:d.title,
            source_document_ids:[...(d.source_document_ids||[])],
            questionnaire:q,
            recommendation:{}
          });
        }
      }catch(e){
        console.warn('SSW related creator carry-forward',e);
      }
      return originalCreateRelated78.apply(this,arguments);
    };
    try{window.creatorCreateRelated=creatorCreateRelated}catch(_e){}

    const style=document.createElement('style');
    style.id='creatorPpeToolsStyleV21078';
    style.textContent=`
      .creator-ppe-catalogue-v21078{display:grid;gap:10px}
      .creator-ppe-checks-v21078{display:grid;gap:8px;margin-top:4px}
      .creator-ppe-checks-v21078 .check-row{margin:0;padding:10px 12px;border:1px solid var(--border,#4a4f57);border-radius:10px}
      @media(min-width:720px){
        .creator-ppe-checks-v21078{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);

    window.SafetySswPpeToolsV21078={ppeChecklistHtml:ppeChecklistHtml78};
  }

  boot();
})();
