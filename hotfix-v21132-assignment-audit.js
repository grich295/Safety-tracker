/* Safety Tracker v2.11.32 - assignment + move/classify consistency */
'use strict';
(function(){
  if(window.__SAFETY_ASSIGNMENT_AUDIT_V21132)return;
  window.__SAFETY_ASSIGNMENT_AUDIT_V21132=true;
  let api,state;
  const $=id=>document.getElementById(id);
  const formal=new Set(['RISK_ASSESSMENT','COSHH','SSW']);
  const generic=new Set(['POLICY','PROCEDURE','OTHER']);
  const manager=()=>['admin','manager'].includes(String(state?.profile?.role||'').toLowerCase())&&state?.profile?.report_only!==true&&state?.uiMode!=='user';
  const isGeneric=d=>generic.has(String(d?.doc_type||'').toUpperCase())||String(d?.content_mode||'').toUpperCase()==='PLAIN_TEXT';
  const isFormal=d=>formal.has(String(d?.doc_type||'').toUpperCase());
  const docId=card=>card.querySelector('[data-doc-details]')?.dataset.docDetails||'';
  let queued=false;

  function labelButtons(root=document){
    if(!manager())return;
    root.querySelectorAll?.('[data-edit-doc-audience]').forEach(b=>{b.textContent='Assign to';b.title='Choose who requires this controlled document/training.'});
    root.querySelectorAll?.('[data-assign-training]').forEach(b=>{b.textContent='Assign to';b.title='Choose who requires this training.'});
    root.querySelectorAll?.('[data-v21119-controls]').forEach(b=>{b.textContent='Assign to';b.title='Choose required readers; folder and responsibility controls are also available here.'});
  }

  function decorateDocumentCards(){
    if(!manager())return;
    const root=$('documentsList');if(!root)return;
    for(const card of root.querySelectorAll('.item-card')){
      const id=docId(card);if(!id)continue;
      const d=(state.documents||[]).find(x=>x.id===id);if(!d||d.status==='ARCHIVED')continue;
      const row=card.querySelector('.action-bar')||card.querySelector('.row');if(!row)continue;
      if(isFormal(d)&&api.approvedCurrentVersion?.(id)&&!card.querySelector('[data-edit-doc-audience]')){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.editDocAudience=id;b.textContent='Assign to';row.prepend(b);
      }
      if(isGeneric(d)&&!card.querySelector('[data-v21119-controls]')){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21119Controls=id;b.textContent='Assign to';row.prepend(b);
      }
      if(!row.querySelector('[data-move-doc-v21131]')){
        const b=document.createElement('button');b.type='button';b.className='ghost';b.dataset.moveDocV21131=id;b.textContent='Move / classify';b.title='Move to another document section or custom folder without re-uploading.';row.appendChild(b);
      }
    }
  }

  function decorateFolderCards(){
    if(!manager())return;
    const root=$('docFolderContentsV21119');if(!root)return;
    labelButtons(root);
    for(const card of root.querySelectorAll('.item-card')){
      const id=docId(card);if(!id)continue;
      const row=card.querySelector('.row');if(!row)continue;
      if(!row.querySelector('[data-move-doc-v21131]')){
        const b=document.createElement('button');b.type='button';b.className='ghost';b.dataset.moveDocV21131=id;b.textContent='Move / classify';row.appendChild(b);
      }
    }
  }

  function decorateTraining(){labelButtons($('trainingView')||document);}

  function addDocumentDetailAssign(id){
    if(!manager())return;
    const body=$('modalBody'),d=(state.documents||[]).find(x=>x.id===id);if(!body||!d||d.status==='ARCHIVED'||String(d.doc_type||'').toUpperCase()==='SDS')return;
    if(body.querySelector('[data-v21132-detail-assign]'))return;
    const actions=[...body.querySelectorAll('.actions')].pop();if(!actions)return;
    const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.v21132DetailAssign='1';b.textContent='Assign to';
    if(isFormal(d))b.dataset.editDocAudience=id;else if(isGeneric(d))b.dataset.v21119Controls=id;else return;
    actions.prepend(b);
    if(!actions.querySelector('[data-move-doc-v21131]')){const m=document.createElement('button');m.type='button';m.className='ghost';m.dataset.moveDocV21131=id;m.textContent='Move / classify';actions.appendChild(m)}
  }

  function addTrainingDetailAssign(id){
    if(!manager())return;
    const body=$('modalBody'),t=(state.training||[]).find(x=>x.id===id);if(!body||!t||t.status==='ARCHIVED'||body.querySelector('[data-v21132-training-assign]'))return;
    const actions=document.createElement('div');actions.className='actions';actions.dataset.v21132TrainingAssign='1';
    const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='Assign to';
    if(t.auto_managed&&t.source_document_id)b.dataset.editDocAudience=t.source_document_id;else b.dataset.assignTraining=t.id;
    actions.appendChild(b);body.appendChild(actions);
  }

  function decorate(){queued=false;labelButtons();decorateDocumentCards();decorateFolderCards();decorateTraining()}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(decorate)}

  function install(){
    const style=document.createElement('style');style.id='assignmentAuditStylesV21132';style.textContent='.action-bar>[data-move-doc-v21131]{white-space:nowrap}';document.head.appendChild(style);
    document.addEventListener('click',e=>{
      const d=e.target.closest?.('[data-doc-details]');if(d)setTimeout(()=>addDocumentDetailAssign(d.dataset.docDetails),80);
      const t=e.target.closest?.('[data-view-training]');if(t)setTimeout(()=>addTrainingDetailAssign(t.dataset.viewTraining),80);
      if(e.target.closest?.('[data-view="documents"],[data-view="training"],[data-v21119-open-folder],[data-v21119-all-docs]'))setTimeout(queue,80);
    },true);
    for(const id of ['documentsView','trainingView']){const root=$(id);if(root&&typeof MutationObserver==='function')new MutationObserver(queue).observe(root,{childList:true,subtree:true})}
    [100,350,900].forEach(ms=>setTimeout(queue,ms));
    window.SafetyAssignmentAuditV21132={refresh:queue};
  }
  function boot(){api=window.SafetyTrackerV2;if(!api?.state){setTimeout(boot,120);return}state=api.state;install()}
  boot();
})();
