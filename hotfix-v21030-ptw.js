/* Safety Tracker v2.10.30 PTW quick-entry hotfix */
'use strict';
(function(){
  const CONTROL_IDS=[
    'cpBarrier','cpSigns','cpPpe','cpAccess','cpAreaSafe','cpTools','cpElecIso','cpOtherIso',
    'cpFirePrec','cpExtinguisher','cpCoshh','cpManual','cpHeight','cpGuests','cpHousekeeping','cpEmergency'
  ];

  function notify(msg){
    try{ if(typeof window.toast==='function') return window.toast(msg); }catch(_e){}
    const t=document.getElementById('toast');
    if(t){ t.textContent=msg; t.hidden=false; setTimeout(()=>{t.hidden=true},3500); }
  }

  function setValue(select,value){
    if(!select) return;
    select.value=value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    syncRow(select);
    updateSummary();
  }

  function syncRow(select){
    const wrap=select?.closest('.ptw-quick-row');
    if(!wrap) return;
    wrap.querySelectorAll('.ptw-choice').forEach(btn=>{
      const active=btn.dataset.value===select.value;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
    });
    wrap.classList.toggle('ptw-yes',select.value==='YES');
    wrap.classList.toggle('ptw-no',select.value==='NO');
    wrap.classList.toggle('ptw-na',select.value==='NA');
  }

  function updateSummary(){
    const section=document.getElementById('cpPtwControlsSection');
    if(!section) return;
    const values=CONTROL_IDS.map(id=>document.getElementById(id)?.value).filter(Boolean);
    const yes=values.filter(v=>v==='YES').length;
    const no=values.filter(v=>v==='NO').length;
    const na=values.filter(v=>v==='NA').length;
    const summary=section.querySelector('#cpPtwQuickSummary');
    if(summary){
      summary.innerHTML=`<strong>${yes}</strong> Yes · <strong>${na}</strong> N/A · <strong>${no}</strong> No`;
      summary.classList.toggle('has-no',no>0);
    }
    const actionHint=section.querySelector('#cpPtwNoActionHint');
    if(actionHint) actionHint.hidden=no===0;
  }

  function buildQuickRow(select){
    if(!select||select.dataset.ptwQuick==='1') return;
    const label=select.closest('label');
    if(!label) return;
    select.dataset.ptwQuick='1';

    if(!select.value) select.value='NA';

    label.classList.add('ptw-quick-row');
    select.classList.add('ptw-original-select');
    select.hidden=true;
    select.setAttribute('aria-hidden','true');

    const group=document.createElement('div');
    group.className='ptw-choices';
    group.setAttribute('role','group');
    group.setAttribute('aria-label','Permit to Work control');
    group.innerHTML=`
      <button type="button" class="ptw-choice ptw-choice-na" data-value="NA">N/A</button>
      <button type="button" class="ptw-choice ptw-choice-yes" data-value="YES">Yes</button>
      <button type="button" class="ptw-choice ptw-choice-no" data-value="NO">No</button>`;
    group.addEventListener('click',e=>{
      const btn=e.target.closest('.ptw-choice');
      if(!btn) return;
      setValue(select,btn.dataset.value);
    });
    label.appendChild(group);
    syncRow(select);
  }

  function ensureHeader(section){
    if(section.querySelector('#cpPtwQuickTools')) return;
    const h3=section.querySelector('h3');
    const tools=document.createElement('div');
    tools.id='cpPtwQuickTools';
    tools.className='ptw-quick-tools';
    tools.innerHTML=`
      <div>
        <strong>Quick entry</strong>
        <div class="muted">All controls start as N/A. Tap Yes or No only where the control applies.</div>
      </div>
      <div class="ptw-quick-actions">
        <button type="button" class="secondary" id="cpPtwSetAllNa">Set all to N/A</button>
        <span id="cpPtwQuickSummary" class="ptw-quick-summary"></span>
      </div>`;
    if(h3) h3.insertAdjacentElement('afterend',tools); else section.prepend(tools);
    tools.querySelector('#cpPtwSetAllNa')?.addEventListener('click',()=>{
      CONTROL_IDS.forEach(id=>setValue(document.getElementById(id),'NA'));
      const ack=document.getElementById('cpPtwQuickConfirm'); if(ack) ack.checked=false;
      notify('All PTW pre-start controls set to N/A. Change any that apply.');
    });
  }

  function ensureFooter(section){
    if(section.querySelector('#cpPtwQuickConfirmWrap')) return;
    const wrap=document.createElement('div');
    wrap.id='cpPtwQuickConfirmWrap';
    wrap.className='ptw-quick-confirm-wrap';
    wrap.innerHTML=`
      <div id="cpPtwNoActionHint" class="danger-note" hidden><strong>One or more controls are marked No.</strong> Resolve them before the PTW can be submitted and record any action in Additional precautions / safety actions taken.</div>
      <label class="check-row ptw-quick-confirm"><input id="cpPtwQuickConfirm" type="checkbox"> I have reviewed the pre-start controls and changed every applicable item from N/A.</label>`;
    section.appendChild(wrap);
  }

  function enhance(){
    const section=document.getElementById('cpPtwControlsSection');
    if(!section) return;
    ensureHeader(section);
    CONTROL_IDS.forEach(id=>buildQuickRow(document.getElementById(id)));
    ensureFooter(section);
    updateSummary();
  }

  function installStyles(){
    if(document.getElementById('ptwQuickStyles')) return;
    const s=document.createElement('style');
    s.id='ptwQuickStyles';
    s.textContent=`
      .ptw-quick-tools{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin:8px 0 18px;padding:12px;border:1px solid #d7e0e7;border-radius:12px;background:#f7fafc}
      .ptw-quick-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .ptw-quick-summary{font-weight:700;color:#334155;white-space:nowrap}
      .ptw-quick-summary.has-no{color:#b42318}
      .ptw-quick-row{display:block!important;padding:12px;border:1px solid #dde4ea;border-radius:14px;background:#fff}
      .ptw-quick-row.ptw-yes{border-color:#7bc49a;background:#f4fbf6}
      .ptw-quick-row.ptw-no{border-color:#e48a84;background:#fff5f4}
      .ptw-quick-row.ptw-na{border-color:#d7dee5;background:#f8fafc}
      .ptw-choices{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
      .ptw-choice{min-height:48px;border:2px solid #cbd5df;border-radius:12px;background:#fff;color:#1f2937;font-weight:800;font-size:16px;padding:8px 10px}
      .ptw-choice.active{box-shadow:0 0 0 2px rgba(23,50,77,.08)}
      .ptw-choice-na.active{background:#e9eef3;border-color:#8a99a8;color:#263646}
      .ptw-choice-yes.active{background:#e8f7ee;border-color:#2e8b57;color:#17643b}
      .ptw-choice-no.active{background:#fdebea;border-color:#c53b32;color:#9b231b}
      .ptw-quick-confirm-wrap{margin-top:16px}
      .ptw-quick-confirm{padding:12px;border-radius:12px;background:#f7fafc;border:1px solid #d7e0e7}
      @media (max-width:560px){.ptw-quick-tools{display:block}.ptw-quick-actions{margin-top:10px}.ptw-choice{min-height:52px;font-size:17px}}
    `;
    document.head.appendChild(s);
  }

  document.addEventListener('click',e=>{
    const submit=e.target.closest('button[data-contractor-submit]');
    if(!submit) return;
    const section=document.getElementById('cpPtwControlsSection');
    if(!section||section.hidden) return;
    enhance();
    const ack=document.getElementById('cpPtwQuickConfirm');
    if(!ack?.checked){
      e.preventDefault();
      e.stopImmediatePropagation();
      notify('Confirm that you reviewed the PTW pre-start controls before completing sign-in.');
      ack?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    const no=CONTROL_IDS.some(id=>document.getElementById(id)?.value==='NO');
    if(no){
      const txt=(document.getElementById('cpAdditionalActions')?.value||'').trim();
      if(!txt){
        e.preventDefault();
        e.stopImmediatePropagation();
        notify('Record the action taken for any PTW control marked No.');
        document.getElementById('cpAdditionalActions')?.scrollIntoView({behavior:'smooth',block:'center'});
      }
    }
  },true);

  installStyles();
  enhance();
  const observer=new MutationObserver(()=>enhance());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('change',e=>{
    if(e.target?.classList?.contains('cp-high-risk')||e.target?.id==='cpHotWorkRequired'||e.target?.id==='cpNoHighRisk') setTimeout(enhance,0);
  });
})();
