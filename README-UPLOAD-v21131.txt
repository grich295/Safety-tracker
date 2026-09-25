Safety Tracker v2.11.31 BUILD PACK
25 September 2026

FIX 1 — APPROVAL SCOPE
The red "Scope required" warning could still appear without a usable Department selector.

v2.11.31 makes the final approval layer create the exact controls the core app expects:
- Everyone / whole hotel
- Departments
- Specific people
- Positions as well for Policy / Procedure / Information

For RA / COSHH / SSW, the panel uses the core formal-training IDs/classes, so the
existing approval/training logic and the older responsibility check both see the same
selection. This removes the mismatch where the warning said scope was required but the
scope picker was missing or ignored.

FIX 2 — NEXT REVIEW DATE
Every non-SDS Review & Approve modal gets:
- Document review frequency
- Next review date
These are rendered by the final layer and persisted before approval.

FIX 3 — MOVE / CLASSIFY ANY DOCUMENT
Admin/Manager gets a new "Move / classify" button on document cards.

At any time you can change:
- Document type/index:
  Risk Assessment
  COSHH Risk Assessment
  Safe System of Work
  SDS / MSDS
  Policy
  Procedure
  Other / Information
- Custom folder or back to the main index

This updates the same document record. PDF files, versions, approval history and links
stay attached; no re-upload is needed.

This is intended for records such as RA-029 if they have landed in the wrong section.

IMPORTANT LOADER CHANGE
Do NOT load:
- hotfix-v21127-policy-procedure-approval-scope.js
- hotfix-v21129-approval-modal-repair.js

v2.11.31 supersedes both to avoid competing approval capture/wrapper logic.

CARRIED FORWARD
- v2.11.26 scroll/freeze protection
- v2.11.28 reader layout
- v2.11.30 People filter dropdown stability

UPLOAD
Add/replace:
- hotfix-v21126-scroll-isolation.js
- hotfix-v21128-generic-audience-layout.js
- hotfix-v21130-people-filter-stability.js
- hotfix-v21131-approval-move-repair.js
- version.json

Replace fallbackBuild + appAssets in index.html with INDEX-BOOT-v21131.txt.

Expected version:
Safety Tracker v2.11.31 CLEAN

No SQL required.
