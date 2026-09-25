/* Safety Tracker v2.11.36 CLEAN
   Makes Eye Wash Station a first-class default option in First Aid Equipment.
   - Shows separate Add First Aid Box and Add Eye Wash Station buttons.
   - Eye Wash opens preselected with the recommended starter checklist enabled.
   - Department and exact physical location remain required before save.
*/
'use strict';
(function(){
  if(window.__SAFETY_FIRST_AID_DEFAULT_TYPES_V21136)return;
  window.__SAFETY_FIRST_AID_DEFAULT_TYPES_V21136=true;

  let api,state;
  const $=id=>document.getElementById(id);

  function firstAidEnabledDepartments(){
    return (state?.departments||[]).filter(d=>d.active!==false&&d.first_aid_enabled===true);
  }

  function openNew(type){
    const fa=window.SafetyFirstAidEquipmentV21135;
    if(!fa?.showEquipmentEditor)return api?.toast?.('First Aid Equipment is still loading. Try again.');
    fa.showEquipmentEditor('');
    setTimeout(()=>{
      const typeSel=$('faEquipmentTypeV21135');
      if(typeSel){
        typeSel.value=type;
        typeSel.dispatchEvent(new Event('change',{bubbles:true}));
      }
      const name=$('faEquipmentNameV21135');
      if(name&&!String(name.value||'').trim()){
        name.value=type==='EYE_WASH_STATION'?'Eye Wash Station':'First Aid Box';
      }
      const starter=$('faApplyDefaultV21135');
      if(starter)starter.checked=true;
      const loc=$('faEquipmentLocationV21135');
      if(loc)loc.focus();
    },20);
  }

  function decorate(){
    const area=$('firstAidManagerArea');if(!area)return;
    const firstCard=area.querySelector('.section-card');if(!firstCard)return;
    const row=firstCard.querySelector('.row-between');if(!row)return;
    const old=row.querySelector('[data-first-aid-new-box]');
    if(!old)return;

    let actions=old.closest('.row');
    if(!actions){
      actions=document.createElement('div');
      actions.className='row';
      old.insertAdjacentElement('beforebegin',actions);
      actions.appendChild(old);
    }

    old.textContent='Add First Aid Box';
    old.removeAttribute('data-first-aid-new-box');
    old.dataset.v21136AddFirstAidBox='';
    old.className='primary';

    if(!actions.querySelector('[data-v21136-add-eyewash]')){
      const eye=document.createElement('button');
      eye.type='button';
      eye.className='secondary';
      eye.dataset.v21136AddEyewash='';
      eye.textContent='Add Eye Wash Station';
      actions.appendChild(eye);
    }

    const enabled=firstAidEnabledDepartments().length>0;
    for(const b of actions.querySelectorAll('[data-v21136-add-first-aid-box],[data-v21136-add-eyewash]')){
      b.disabled=!enabled;
      b.title=enabled?'':'Enable First Aid for a Department first.';
    }

    let note=firstCard.querySelector('.default-equipment-note-v21136');
    if(!note){
      note=document.createElement('div');
      note.className='hint-box default-equipment-note-v21136';
      note.innerHTML='<strong>Default equipment types:</strong> First Aid Box and Eye Wash Station. Eye Wash starts with the recommended 1 litre total sealed sterile-water/saline supply; you can personalise the checklist after saving. Exact location is required.';
      row.insertAdjacentElement('afterend',note);
    }
  }

  function install(){
    document.addEventListener('click',e=>{
      const box=e.target.closest?.('[data-v21136-add-first-aid-box]');
      if(box){e.preventDefault();e.stopImmediatePropagation();openNew('FIRST_AID_BOX');return}
      const eye=e.target.closest?.('[data-v21136-add-eyewash]');
      if(eye){e.preventDefault();e.stopImmediatePropagation();openNew('EYE_WASH_STATION');return}
      if(e.target.closest?.('[data-view="firstAid"]'))setTimeout(decorate,180);
    },true);
    [150,450,900].forEach(ms=>setTimeout(decorate,ms));
    window.SafetyFirstAidDefaultTypesV21136={decorate,openNew};
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!window.SafetyFirstAidEquipmentV21135){setTimeout(boot,120);return}
    state=api.state;
    install();
  }
  boot();
})();
