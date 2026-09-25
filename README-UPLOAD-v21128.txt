Safety Tracker v2.11.28 BUILD PACK
25 September 2026

THIS FIX
The Department / Position / Person selection lists were still visually misaligned:
- checkbox separated from its label
- position holder text wrapped awkwardly
- three narrow columns were too cramped inside the approval modal
- horizontal/combined scrolling made the control feel unstable

v2.11.28 fixes BOTH:
1. Policy / Procedure approval scope
2. Folder / readers / responsibility controls

NEW LAYOUT
- Each audience type uses the full modal width.
- Checkbox stays in a fixed left column.
- Department / Position / Person text is left aligned.
- Position holder appears underneath the position title.
- No horizontal overflow.
- Inner lists scroll independently.
- Read-within-days and summary remain aligned.

CUMULATIVE
Includes:
- v2.11.26 scroll/freeze improvements
- v2.11.27 Policy/Procedure approval scope controls
- v2.11.28 alignment repair

UPLOAD
Add/replace these root files:
- hotfix-v21126-scroll-isolation.js
- hotfix-v21127-policy-procedure-approval-scope.js
- hotfix-v21128-generic-audience-layout.js
- version.json

Then replace the fallbackBuild + appAssets block near the bottom of index.html
with INDEX-BOOT-v21128.txt.

Expected version:
Safety Tracker v2.11.28 CLEAN

No SQL required.
