Safety Tracker v2.11.72 — DOCUMENT SET / MODAL / TBT CLEANUP

Replace these 2 root files in the Safety-tracker repository:
1. hotfix-v21136-first-aid-default-types.js
2. version.json

DATABASE
The v2.11.72 responsibility-target database migration has already been applied. Do not run SQL.

FIXES / CHANGES
- Warning and validation messages are mirrored inside open modal windows so they are visible on mobile.
- Approval blockers such as not opening the pending file or not ticking the confirmation are shown inside the approval window.
- TBT Group controls are labelled as OPTIONAL AUTOMATIC REFRESHER scheduling only. Normal TBT assignment remains separate.
- Controlled document-set setup is reorganised into Annual cycle / Review responsibility / Acknowledgement audience / Advanced review settings.
- Overall annual-review responsibility now supports Everyone, Departments, Positions, Groups and specific people.
- Default file reviewer supports the same assignment targets.
- Acknowledgement audience remains separate so responsibility and sign-off requirements are not confused.
- Existing v2.11.65 annual review/sign-off rules, grace period, overlap logic and individual file review workflow are retained.
