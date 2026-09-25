Safety Tracker v2.11.30 BUILD PACK
25 September 2026

FIX
People screen filter dropdown:
  Active / Disabled / Recommended delete-anonymise / All

The menu was opening then immediately closing, making it impossible to select.

CAUSE
The legacy People retention decorator repeatedly rebuilds the toolbar HTML.
That replaces the native <select> element while its dropdown is open, which
causes the browser to close the option list immediately.

v2.11.30:
- preserves the focused People status/search control during People-view refreshes
- preserves the selected status value
- stops People-card click handlers receiving clicks intended for the filter
- does NOT prevent native select behaviour
- keeps search focus/caret stable during background refreshes

CUMULATIVE
Carries forward:
- v2.11.26 scroll/freeze protection
- v2.11.28 reader layout
- v2.11.29 Policy/Procedure scope + approval next review date repair

UPLOAD
Add/replace:
- hotfix-v21126-scroll-isolation.js
- hotfix-v21128-generic-audience-layout.js
- hotfix-v21129-approval-modal-repair.js
- hotfix-v21130-people-filter-stability.js
- version.json

Replace fallbackBuild + appAssets in index.html with INDEX-BOOT-v21130.txt.

Expected version:
Safety Tracker v2.11.30 CLEAN

No SQL required.
