Safety Tracker v2.11.29 BUILD PACK
25 September 2026

FIXES IN THIS BUILD

1) POLICY / PROCEDURE DEPARTMENT SELECTION
v2.11.27 is no longer loaded.
v2.11.29 replaces that selector with a fresh native checkbox implementation.

The approval modal now supports:
- Everyone / whole hotel
- Departments
- Positions
- Specific people
- Read within (days)

Selections use explicit checkbox IDs + labels and pointer-safe styling.
They are saved to document_read_audiences_v21119 BEFORE approval.

2) NEXT REVIEW DATE RESTORED
Every non-SDS Review & Approve modal now contains:
- Document review frequency
- Next review date

The date is calculated from the issue date and selected review frequency,
but the exact date can be overridden.

Both review frequency and next review date are saved during approval.

3) TRAINING APPROVAL NOT CHANGED
RA / COSHH / SSW formal training controls remain separate and unchanged.
The restored review date is the DOCUMENT review date, not the training
refresher schedule.

4) CARRIED FORWARD
- v2.11.26 scroll/freeze protection
- v2.11.28 generic-reader layout alignment

IMPORTANT
Do NOT load hotfix-v21127-policy-procedure-approval-scope.js in v2.11.29.
The supplied INDEX-BOOT-v21129.txt intentionally removes it, because having
two generic approval capture handlers is a likely source of the selector issue.

UPLOAD
Add/replace:
- hotfix-v21126-scroll-isolation.js
- hotfix-v21128-generic-audience-layout.js
- hotfix-v21129-approval-modal-repair.js
- version.json

Then replace fallbackBuild + appAssets near the bottom of index.html with:
- INDEX-BOOT-v21129.txt

Expected version:
Safety Tracker v2.11.29 CLEAN

No SQL required.
