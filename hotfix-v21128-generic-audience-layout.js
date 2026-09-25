/* Safety Tracker v2.11.28 - generic audience alignment / modal layout */
'use strict';
(function(){
  if(window.__SAFETY_GENERIC_AUDIENCE_LAYOUT_V21128)return;
  window.__SAFETY_GENERIC_AUDIENCE_LAYOUT_V21128=true;

  const style=document.createElement('style');
  style.id='safetyGenericAudienceLayoutStylesV21128';
  style.textContent=`
    /*
      Generic Policy / Procedure reader controls were inheriting broad label/grid
      rules, which separated checkboxes from their labels and made position-holder
      text wrap awkwardly. Keep these selectors deliberately scoped to the modal.
    */

    #modalBody .v21123-reader-grid,
    #modalBody .v21121-reader-grid,
    #modalBody .generic-approval-grid-v21127{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:10px!important;
      width:100%!important;
      min-width:0!important;
    }

    #modalBody .v21123-reader-box,
    #modalBody .v21121-reader-group,
    #modalBody .generic-approval-grid-v21127 details{
      width:100%!important;
      min-width:0!important;
      overflow:hidden!important;
    }

    #modalBody .v21123-reader-box summary,
    #modalBody .v21121-reader-group summary,
    #modalBody .generic-approval-grid-v21127 summary{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:10px!important;
      width:100%!important;
      min-width:0!important;
      padding:10px 12px!important;
      text-align:left!important;
    }

    #modalBody .generic-audience-v21119,
    #modalBody .generic-approval-grid-v21127 .checkbox-list{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:0!important;
      width:100%!important;
      min-width:0!important;
      max-height:220px!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding:4px 8px!important;
      overscroll-behavior:contain!important;
    }

    #modalBody .generic-audience-v21119 > label,
    #modalBody .generic-approval-grid-v21127 .checkbox-list > label,
    #modalBody .generic-approval-scope-v21127 > .row-between > label.check-row{
      display:grid!important;
      grid-template-columns:22px minmax(0,1fr)!important;
      align-items:start!important;
      justify-content:start!important;
      column-gap:9px!important;
      row-gap:0!important;
      width:100%!important;
      min-width:0!important;
      margin:0!important;
      padding:8px 6px!important;
      text-align:left!important;
    }

    #modalBody .generic-audience-v21119 > label + label,
    #modalBody .generic-approval-grid-v21127 .checkbox-list > label + label{
      border-top:1px solid rgba(120,135,150,.16)!important;
    }

    #modalBody .generic-audience-v21119 input[type="checkbox"],
    #modalBody .generic-approval-grid-v21127 input[type="checkbox"],
    #modalBody .generic-approval-scope-v21127 > .row-between > label.check-row input[type="checkbox"]{
      grid-column:1!important;
      width:18px!important;
      min-width:18px!important;
      height:18px!important;
      margin:2px 0 0!important;
      padding:0!important;
      justify-self:start!important;
      align-self:start!important;
    }

    #modalBody .generic-audience-v21119 > label > span,
    #modalBody .generic-approval-grid-v21127 .checkbox-list > label{
      min-width:0!important;
      text-align:left!important;
      overflow-wrap:anywhere!important;
      word-break:normal!important;
      line-height:1.3!important;
    }

    #modalBody .generic-audience-v21119 > label > span{
      grid-column:2!important;
      display:block!important;
    }

    #modalBody .generic-audience-v21119 > label > span > strong{
      display:block!important;
      text-align:left!important;
      line-height:1.25!important;
    }

    #modalBody .generic-audience-v21119 > label > span > .muted{
      display:block!important;
      margin-top:2px!important;
      text-align:left!important;
      line-height:1.25!important;
      overflow-wrap:anywhere!important;
    }

    #modalBody .v21123-native-controls .row-between,
    #modalBody .v21121-reader-panel .row-between,
    #modalBody .generic-approval-scope-v21127 > .row-between{
      gap:10px!important;
      flex-wrap:wrap!important;
    }

    #modalBody .v21123-read-days,
    #modalBody .v21121-reader-footer,
    #modalBody .generic-approval-footer-v21127{
      width:100%!important;
      min-width:0!important;
    }

    #modalBody .generic-approval-footer-v21127{
      display:grid!important;
      grid-template-columns:minmax(150px,220px) minmax(0,1fr)!important;
      gap:10px!important;
      align-items:end!important;
    }

    @media(max-width:620px){
      #modalBody .generic-approval-footer-v21127{
        grid-template-columns:1fr!important;
      }
      #modalBody .generic-audience-v21119,
      #modalBody .generic-approval-grid-v21127 .checkbox-list{
        max-height:180px!important;
      }
    }
  `;
  document.head.appendChild(style);

  window.SafetyGenericAudienceLayoutV21128={active:true};
})();