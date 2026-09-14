/* Safety Tracker v2.10.8 patch-loader
   Loads v2.10.7 baseline, then applies:
   - cleaner My Safety dashboard with clickable status/category drill-down
   - prominent Pending Approval manager/admin shortcut
   - version labels aligned to v2.10.8
   Database RLS fix for safety_tracker_settings/document approvals is applied separately in Supabase.
*/
'use strict';

(() => {
  const BASE_APP = 'app-v2107.js';
  const VERSION = '2.10.8';
  const BUILD = 'v2108-training-dashboard-pending-approval-20260914';

  function loadBase() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BASE_APP + '?base=2107';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + BASE_APP));
      document.head.appendChild(s);
    });
  }

  function injectStyles() {
    const css = `
      .st2108-click-stat{width:100%;text-align:left;border:0;background:transparent;padding:0;color:inherit}
      .st2108-click-stat .stat{height:100%;margin:0;transition:transform .12s ease,box-shadow .12s ease}
      .st2108-click-stat:hover .stat,.st2108-click-stat:focus .stat{transform:translateY(-1px);box-shadow:0 6px 18px rgba(18,42,66,.10)}
      .st2108-click-stat.active .stat{outline:3px solid rgba(23,50,77,.18);outline-offset:2px}
      .st2108-training-drill{margin:0 0 16px}
      .st2108-category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px}
      .st2108-category-btn{border:1px solid var(--border,#d7dee6);border-radius:13px;background:#fff;padding:12px;text-align:left;font-weight:800;color:var(--ink,#17324d)}
      .st2108-category-btn span{display:block;font-size:12px;font-weight:600;color:#667585;margin-top:4px}
      .st2108-category-btn.active{border-color:var(--ink,#17324d);box-shadow:0 0 0 2px rgba(23,50,77,.12)}
      .st2108-placeholder{padding:18px;border:1px dashed var(--border,#d7dee6);border-radius:12px;background:#fff;color:#667585;text-align:center}
      .st2108-pending-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px;padding:14px 16px;border:2px solid #e0a21a;border-left-width:8px;border-radius:14px;background:#fff8e8}
      .st2108-pending-banner strong{font-size:1.02rem}
      .st2108-pending-count{font-size:1.6rem;font-weight:900;color:#8c5b00;min-width:48px;text-align:center}
      .st2108-pending-open{border:0;border-radius:10px;padding:10px 13px;background:#17324d;color:#fff;font-weight:800;white-space:nowrap}
      @media(max-width:760px){
        .st2108-pending-banner{align-items:flex-start;flex-wrap:wrap}
        .st2108-pending-open{width:100%}
        .st2108-category-grid{grid-template-columns:1fr 1fr}
      }
    `;
    const style = document.createElement('style');
    style.id = 'st2108Styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function updateVisibleVersion() {
    try {
      document.querySelectorAll('.version,.build-badge,.dashboard-version').forEach(el => {
        const t = el.textContent || '';
        if (/Safety Tracker/i.test(t)) {
          el.textContent = t.replace(/v\d+\.\d+\.\d+/i, 'v' + VERSION);
        } else if (/v\d+\.\d+\.\d+/i.test(t)) {
          el.textContent = t.replace(/v\d+\.\d+\.\d+/i, 'v' + VERSION);
        }
      });
      document.querySelectorAll('.brand-line .version,.demo-brand-line .version').forEach(el => el.textContent = 'v' + VERSION);
      window.__SAFETY_TRACKER_PATCH_VERSION = VERSION;
      window.__SAFETY_TRACKER_PATCH_BUILD = BUILD;
    } catch {}
  }

  function categoryForTraining(t) {
    try {
      if (!t) return 'OTHER';
      if (t.source_document_id && window.state?.documents) {
        const d = state.documents.find(x => x.id === t.source_document_id);
        const type = String(d?.doc_type || '').toUpperCase();
        if (type === 'COSHH') return 'COSHH';
        if (type === 'RISK_ASSESSMENT') return 'RA';
        if (type === 'SSW') return 'SSW';
        if (type === 'TOOLBOX_TALK') return 'TBT';
      }
      const k = String((typeof trainingKind === 'function' ? trainingKind(t) : (t.session_type || t.source_kind || ''))).toUpperCase();
      if (k.includes('TOOLBOX')) return 'TBT';
      if (k.includes('COSHH')) return 'COSHH';
      if (k === 'SSW' || k.includes('SAFE_SYSTEM')) return 'SSW';
      if (k.includes('RISK')) return 'RA';
      if (k.includes('AWARENESS')) return 'AWARENESS';
      return 'OTHER';
    } catch { return 'OTHER'; }
  }

  const categoryLabels = {
    ALL:'All',
    COSHH:'COSHH RA',
    RA:'Risk Assessments',
    SSW:'SSW',
    TBT:'Toolbox Talks',
    AWARENESS:'Safety Awareness',
    OTHER:'Other Training'
  };

  function statusMatches(row, key) {
    const code = row.status?.code || '';
    if (key === 'COMPLETE') return code === 'COMPLETED';
    if (key === 'OVERDUE') return code === 'OVERDUE' || row.traffic === 'red';
    if (key === 'WAITING') return code === 'AWAITING_INSTRUCTOR';
    return code !== 'COMPLETED';
  }

  function enhanceMySafety() {
    const statsBox = document.getElementById('mySafetyStats');
    const list = document.getElementById('mySafetyList');
    if (!statsBox || !list || !window.state) return;

    let rows = [];
    try {
      if (typeof myActiveAssignments === 'function') {
        rows = myActiveAssignments()
          .map(x => ({...x, status: assignmentStatus(x.a,x.t)}))
          .map(x => ({...x, traffic: assignmentTraffic(x.status, trainingDependencyState(x.t).ready)}))
          .sort((a,b) => trafficPriority(a.traffic)-trafficPriority(b.traffic) || String(a.t?.name||'').localeCompare(String(b.t?.name||'')));
      }
    } catch (e) {
      console.warn('v2.10.8 dashboard enhancement could not classify training', e);
      return;
    }

    const cards = [...list.children].filter(x => x.classList?.contains('item-card'));
    cards.forEach((card, i) => {
      const row = rows[i];
      if (!row) return;
      card.dataset.st2108Category = categoryForTraining(row.t);
      card.dataset.st2108Code = row.status?.code || '';
      card.dataset.st2108Traffic = row.traffic || '';
    });

    const counts = {
      COMPLETE: rows.filter(r => statusMatches(r,'COMPLETE')).length,
      ACTION: rows.filter(r => statusMatches(r,'ACTION')).length,
      OVERDUE: rows.filter(r => statusMatches(r,'OVERDUE')).length,
      WAITING: rows.filter(r => statusMatches(r,'WAITING')).length
    };

    const selected = statsBox.dataset.st2108Status || '';
    const tile = (key,label,value,traffic) =>
      `<button type="button" class="st2108-click-stat ${selected===key?'active':''}" data-st2108-status="${key}">
        <div class="stat traffic-${traffic}"><strong>${value}</strong><span>${label}</span></div>
      </button>`;

    statsBox.innerHTML =
      tile('ACTION','Action required',counts.ACTION,counts.OVERDUE?'red':counts.ACTION?'amber':'green') +
      tile('OVERDUE','Overdue / blocked',counts.OVERDUE,counts.OVERDUE?'red':'green') +
      tile('WAITING','Awaiting instructor',counts.WAITING,counts.WAITING?'amber':'green') +
      tile('COMPLETE','Complete',counts.COMPLETE,'green');

    let drill = document.getElementById('st2108TrainingDrill');
    if (!drill) {
      drill = document.createElement('div');
      drill.id = 'st2108TrainingDrill';
      drill.className = 'st2108-training-drill';
      list.parentNode.insertBefore(drill, list);
    }

    if (!selected) {
      drill.innerHTML = `<div class="st2108-placeholder">Select one of the training status buttons above.</div>`;
      list.hidden = true;
      return;
    }

    const eligible = rows.filter(r => statusMatches(r, selected));
    const catCounts = {};
    eligible.forEach(r => {
      const c = categoryForTraining(r.t);
      catCounts[c] = (catCounts[c] || 0) + 1;
    });
    let selectedCat = drill.dataset.st2108Category || 'ALL';
    if (selectedCat !== 'ALL' && !catCounts[selectedCat]) selectedCat = 'ALL';
    drill.dataset.st2108Category = selectedCat;

    const catOrder = ['ALL','COSHH','RA','SSW','TBT','AWARENESS','OTHER'];
    const catButtons = catOrder
      .filter(c => c === 'ALL' || catCounts[c])
      .map(c => {
        const count = c === 'ALL' ? eligible.length : (catCounts[c]||0);
        return `<button type="button" class="st2108-category-btn ${selectedCat===c?'active':''}" data-st2108-category="${c}">
          ${categoryLabels[c]}<span>${count} item${count===1?'':'s'}</span>
        </button>`;
      }).join('');

    drill.innerHTML = `<div class="section-card"><strong>${selected==='ACTION'?'Action required':selected==='OVERDUE'?'Overdue / blocked':selected==='WAITING'?'Awaiting instructor':'Complete'}</strong>
      <div class="st2108-category-grid">${catButtons}</div></div>`;

    let visible = 0;
    cards.forEach((card, i) => {
      const row = rows[i];
      const okStatus = !!row && statusMatches(row, selected);
      const okCat = selectedCat === 'ALL' || card.dataset.st2108Category === selectedCat;
      card.hidden = !(okStatus && okCat);
      if (!card.hidden) visible++;
    });
    list.hidden = visible === 0;
    if (!visible) {
      drill.insertAdjacentHTML('beforeend', `<div class="st2108-placeholder">No training items in this section.</div>`);
    }
  }

  function pendingCount() {
    try {
      return (state.versions || []).filter(v =>
        v.status === 'CURRENT' &&
        String(v.approval_status || 'PENDING').toUpperCase() === 'PENDING'
      ).length;
    } catch { return 0; }
  }

  function enhanceDocuments() {
    if (typeof isManager === 'function' && !isManager()) return;
    const view = document.getElementById('documentsView');
    if (!view) return;
    let banner = document.getElementById('st2108PendingBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'st2108PendingBanner';
      const heading = view.querySelector('.page-heading');
      if (heading?.nextSibling) view.insertBefore(banner, heading.nextSibling);
      else view.prepend(banner);
    }
    const n = pendingCount();
    banner.className = 'st2108-pending-banner';
    banner.innerHTML = `<div><strong>Pending Approval</strong><div class="muted">${n ? 'Documents are waiting for Admin/Manager review.' : 'No documents are waiting for approval.'}</div></div>
      <div class="st2108-pending-count">${n}</div>
      <button type="button" class="st2108-pending-open" data-st2108-open-pending ${n?'':'disabled'}>Open pending approvals</button>`;
  }

  function installOverrides() {
    const oldMySafety = window.renderMySafety;
    if (typeof oldMySafety === 'function') {
      window.renderMySafety = function(...args) {
        const r = oldMySafety.apply(this,args);
        try { updateVisibleVersion(); enhanceMySafety(); } catch(e){ console.warn('v2.10.8 My Safety patch',e); }
        return r;
      };
    }

    const oldDocuments = window.renderDocuments;
    if (typeof oldDocuments === 'function') {
      window.renderDocuments = function(...args) {
        const r = oldDocuments.apply(this,args);
        try { updateVisibleVersion(); enhanceDocuments(); } catch(e){ console.warn('v2.10.8 Documents patch',e); }
        return r;
      };
    }

    document.addEventListener('click', e => {
      const status = e.target.closest('[data-st2108-status]');
      if (status) {
        e.preventDefault(); e.stopPropagation();
        const box = document.getElementById('mySafetyStats');
        if (box) box.dataset.st2108Status = status.dataset.st2108Status;
        const drill = document.getElementById('st2108TrainingDrill');
        if (drill) drill.dataset.st2108Category = 'ALL';
        try { window.renderMySafety?.(); } catch {}
        return;
      }

      const cat = e.target.closest('[data-st2108-category]');
      if (cat) {
        e.preventDefault(); e.stopPropagation();
        const drill = document.getElementById('st2108TrainingDrill');
        if (drill) drill.dataset.st2108Category = cat.dataset.st2108Category;
        try { enhanceMySafety(); } catch {}
        return;
      }

      const pending = e.target.closest('[data-st2108-open-pending]');
      if (pending) {
        e.preventDefault(); e.stopPropagation();
        try {
          if (window.state) state.documentIndex = 'ALL';
          const statusFilter = document.getElementById('documentStatusFilter');
          if (statusFilter) statusFilter.value = 'PENDING';
          window.renderDocuments?.();
          document.getElementById('pendingApprovalPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
        } catch (err) {
          console.warn('v2.10.8 pending approval shortcut', err);
        }
        return;
      }
    }, true);

    updateVisibleVersion();
    setTimeout(() => {
      try { if (document.getElementById('mySafetyView')?.classList.contains('active-view')) window.renderMySafety?.(); } catch {}
      try { enhanceDocuments(); } catch {}
      updateVisibleVersion();
    }, 350);
  }

  injectStyles();
  loadBase()
    .then(installOverrides)
    .catch(err => {
      console.error(err);
      const m = document.getElementById('authMessage');
      if (m) { m.hidden = false; m.textContent = err.message; }
    });
})();
