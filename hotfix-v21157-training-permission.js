/* Safety Tracker v2.11.57 - profile training permission
   Adds "Can carry out instructor-led training" to the existing Safety account editor.
   Shared-account editor support is built into the updated v2.11.51 helper.
*/
'use strict';
(function(){
  if(window.__SAFETY_TRAINING_PERMISSION_PROFILE_V21157)return;
  window.__SAFETY_TRAINING_PERMISSION_PROFILE_V21157=true;

  let api,state,sb,baseRpc;
  const $=id=>document.getElementById(id);
  const toast=msg=>{try{api?.toast?.(msg)}catch(_e){console.log(msg)}};

  async function capabilityFor(userId){
    const r=await sb.from('app_user_capabilities_v21137')
      .select('enabled')
      .eq('user_id',userId)
      .eq('module_key','safety')
      .eq('capability_key','training_instructor')
      .eq('scope_type','APP')
      .eq('scope_id','')
      .maybeSingle();
    return !r.error&&r.data?.enabled===true;
  }

  async function decorateLocalAccessModal(){
    const body=$('modalBody');if(!body||!$('modal')?.open)return;
    if(body.querySelector('#localCanDeliverTrainingV21157'))return;

    const save=body.querySelector('[data-v21149-save-access]');
    if(!save)return;
    const userId=save.dataset.v21149SaveAccess;
    if(!userId)return;

    const on=await capabilityFor(userId);
    if(!body.contains(save)||body.querySelector('#localCanDeliverTrainingV21157'))return;

    const card=document.createElement('div');
    card.className='section-card training-permission-card-v21157';
    card.innerHTML=`
      <h4>Training permission</h4>
      <label class="check-row">
        <input id="localCanDeliverTrainingV21157" type="checkbox" ${on?'checked':''} data-user-id="${userId}">
        Can carry out instructor-led training
      </label>
      <p class="muted">Use this for Supervisors or other suitable people without giving full Manager access. They can deliver training for people in their own Department(s). Department Manager remains the default responsible owner.</p>`;
    const actions=save.closest('.actions');
    actions?.insertAdjacentElement('beforebegin',card);
  }

  function installRpcBridge(){
    if(sb.__trainingPermissionV21157)return;
    sb.__trainingPermissionV21157=true;
    baseRpc=sb.rpc.bind(sb);
    sb.rpc=async function(name,args={},options){
      const result=await baseRpc(name,args,options);
      if(
        name==='set_safety_user_access_v21137' &&
        !result?.error &&
        $('modal')?.open &&
        $('localCanDeliverTrainingV21157') &&
        args?.p_user_id
      ){
        const cap=await baseRpc('set_safety_capability_v21137',{
          p_user_id:args.p_user_id,
          p_capability_key:'training_instructor',
          p_enabled:!!$('localCanDeliverTrainingV21157')?.checked,
          p_scope_type:'APP',
          p_scope_id:''
        });
        if(cap?.error)toast(cap.error.message||'Safety access saved, but training permission could not be updated.');
      }
      return result;
    };
  }

  function install(){
    const body=$('modalBody');
    if(body){
      const obs=new MutationObserver(()=>setTimeout(decorateLocalAccessModal,0));
      obs.observe(body,{childList:true,subtree:true});
    }
    window.addEventListener('click',e=>{
      if(e.target.closest?.('[data-v21149-edit-safety]')){
        [100,250,500].forEach(ms=>setTimeout(decorateLocalAccessModal,ms));
      }
    },true);
  }

  function boot(){
    api=window.SafetyTrackerV2;
    if(!api?.state||!api?.sb){setTimeout(boot,100);return}
    state=api.state;sb=api.sb;
    if(!state.user)return;
    installRpcBridge();
    install();
  }
  boot();
})();
