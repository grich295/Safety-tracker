/* Safety Tracker v2.10.9 correction patch
   Fixes My Safety dashboard behaviour:
   - status tiles are navigation buttons
   - no individual training cards show on the home dashboard by default
   - clicking a status tile opens that status section
   - category buttons then filter COSHH RA / RA / SSW / TBT / Safety Awareness / Other
   This patch loads the existing v2.10.8 patch, which in turn loads v2.10.7 baseline.
*/
'use strict';

(() => {
  const BASE_PATCH = 'app-v2108.js?v=2108';
  const VERSION = '2.10.9';

  function loadBasePatch() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BASE_PATCH;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load Safety Tracker v2.10.8 patch.'));
      document.head.appendChild(s);
    });
  }

  function injectCss() {
    const style = document.createElement('style');
    style.id = 'st2109Styles';
    style.textContent = `
      #mySafetyList.st2109-home-hidden{display:none!important}
      .st2109-section-wrap{margin-top:14px}
      .st2109-back{
        display:inline-flex;align-items:center;gap:6px;
        border:0;border-radius:10px;padding:10px 12px;
        background:#26384b;color:#fff;font-weight:800;
        margin-bottom:10px
      }
      .st2109-section-title{
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin:0 0 10px
      }
      .st2109-section-title strong{font-size:1.05rem}
    `;
    document.head.appendChild(style);
  }

  function updateVersion() {
    document.querySelectorAll('.version,.build-badge,.dashboard-version,.brand-line .version,.demo-brand-line .version')
      .forEach(el => {
        const t = el.textContent || '';
        el.textContent = /v\d+\.\d+\.\d+/i.test(t)
          ? t.replace(/v\d+\.\d+\.\d+/i,'v'+VERSION)
          : (el.classList.contains('version') ? 'v'+VERSION : t);
      });
  }

  function forceHomeState() {
    const stats = document.getElementById('mySafetyStats');
    const list = document.getElementById('mySafetyList');
    const drill = document.getElementById('st2108TrainingDrill');
    if (!stats || !list) return;

    const selected = stats.dataset.st2108Status || '';
    if (!selected) {
      list.classList.add('st2109-home-hidden');
      list.hidden = true;
      if (drill) {
        drill.innerHTML = '';
        drill.hidden = true;
      }
    } else {
      list.classList.remove('st2109-home-hidden');
      if (drill) drill.hidden = false;
    }
  }

  function addSectionBackButton() {
    const stats = document.getElementById('mySafetyStats');
    const drill = document.getElementById('st2108TrainingDrill');
    if (!stats || !drill) return;

    const selected = stats.dataset.st2108Status || '';
    if (!selected) return;

    if (!drill.querySelector('[data-st2109-back]')) {
      drill.insertAdjacentHTML('afterbegin',
        `<button type="button" class="st2109-back" data-st2109-back>← Back to training summary</button>`);
    }
  }

  function install() {
    updateVersion();

    const oldRender = window.renderMySafety;
    if (typeof oldRender === 'function') {
      window.renderMySafety = function(...args) {
        const r = oldRender.apply(this,args);
        setTimeout(() => {
          try {
            forceHomeState();
            addSectionBackButton();
            updateVersion();
          } catch(e) {
            console.warn('v2.10.9 My Safety correction',e);
          }
        },0);
        return r;
      };
    }

    document.addEventListener('click', e => {
      const status = e.target.closest('[data-st2108-status]');
      if (status) {
        setTimeout(() => {
          try {
            const list = document.getElementById('mySafetyList');
            if (list) {
              list.classList.remove('st2109-home-hidden');
              list.hidden = false;
            }
            const drill = document.getElementById('st2108TrainingDrill');
            if (drill) drill.hidden = false;
            addSectionBackButton();
          } catch {}
        },0);
        return;
      }

      const back = e.target.closest('[data-st2109-back]');
      if (back) {
        e.preventDefault();
        e.stopPropagation();

        const stats = document.getElementById('mySafetyStats');
        if (stats) delete stats.dataset.st2108Status;

        const drill = document.getElementById('st2108TrainingDrill');
        if (drill) {
          delete drill.dataset.st2108Category;
          drill.innerHTML = '';
          drill.hidden = true;
        }

        try { window.renderMySafety?.(); } catch {}
        return;
      }
    }, true);

    setTimeout(() => {
      try {
        forceHomeState();
        updateVersion();
      } catch {}
    }, 500);
  }

  injectCss();
  loadBasePatch().then(install).catch(console.error);
})();
