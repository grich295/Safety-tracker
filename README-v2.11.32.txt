Safety Tracker v2.11.32 CLEAN — PATCH
25 September 2026

ROOT CAUSE FOUND
The repository already contained the v2.11.26 / v2.11.28 / v2.11.30 / v2.11.31 hotfix files, but config.js only loaded hotfixes through v2.11.25. That meant the v2.11.31 approval-scope and Move/classify fixes never ran in the live app even though version.json showed v2.11.31.

UPLOAD / REPLACE THESE 3 FILES IN THE REPOSITORY ROOT:
1. config.js                (replace existing)
2. version.json             (replace existing)
3. hotfix-v21132-assignment-audit.js  (new)

The existing repository must also retain these already-present files:
- hotfix-v21126-scroll-isolation.js
- hotfix-v21128-generic-audience-layout.js
- hotfix-v21130-people-filter-stability.js
- hotfix-v21131-approval-move-repair.js

DO NOT load the superseded v2.11.27 or v2.11.29 approval hotfixes.

WHAT v2.11.32 DOES
- The approval modal now receives the v2.11.31 Everyone / Department / Person scope controls, removing the red Scope required dead-end shown in the screenshot.
- RA / COSHH / SSW approved document cards use a consistent Assign to button.
- Toolbox Talk and standalone Training audience buttons are labelled Assign to.
- Policy / Procedure / Other/Information documents expose Assign to; their existing reader controls support Department / Position / Person / Everyone.
- Document and Training detail views expose Assign to where relevant.
- Move / classify is kept visible on document cards and custom-folder cards.
- Move / classify can change the document type/index (RA, COSHH, SSW, SDS/MSDS, Policy, Procedure, Other/Information) and custom folder without re-uploading; the v2.11.31 code preserves the same document record, versions, stored PDF, approval history and links.
- SDS/MSDS deliberately remains reference-only rather than being assigned as training.

NO SQL REQUIRED.

After GitHub Pages deploys, hard refresh once (Ctrl+F5). The header should show Safety Tracker v2.11.32 CLEAN.
