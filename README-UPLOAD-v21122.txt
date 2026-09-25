Safety Tracker v2.11.22 CLEAN

USE THIS PACKAGE INSTEAD OF v2.11.21.

FIX 1 — TRAINING SCHEDULE
The approval screen could show only the Training schedule heading/description.
The cause was the old six-month helper cleanup hiding a parent form-grid.
v2.11.22 restores and protects:
- Initial training method
- Training repeat schedule
- Refresher method
The obsolete "Default: every 6 months" leaf text is removed without hiding controls.

FIX 2 — GENERIC DOCUMENT RESPONSIBILITY
The v2.11.21 replacement controls could fail to appear if the document modal
was opened before the long hotfix chain finished loading.
v2.11.22 decorates both new and already-open modals.

Generic documents now show:
- Responsible for review: dropdown of Positions + active People
- Responsible for approval: dropdown of Positions + active People
- Position entries show current holder where available
- Position responsibility follows the current holder

FIX 3 — READER PANEL
Who needs to read it? is tidied into:
- Everyone / whole hotel
- Departments
- Positions
- Specific people
The three detailed lists are collapsible.

FIX 4 — REVIEW FREQUENCY
Generic documents retain:
- Review frequency default 12 months
- 3 / 6 / 12 / 24 / 36 months + Custom
- Editable Next review date
- Same frequency controls at initial approval and controlled review

DATABASE
No new SQL is required for v2.11.22.
The v2.11.21 database changes are already applied.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21119-generic-document-folders.js
2. hotfix-v21119-department-leads.js
3. hotfix-v21120-approval-review-date.js (replace)
4. hotfix-v21121-generic-doc-controls.js (replace)
5. hotfix-v21122-approval-training-restore.js
6. config.js (replace)
7. version.json (replace)
