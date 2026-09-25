SAFETY TRACKER v2.11.47

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21147-users-targeted-incident-review.js
- version.json

BACKEND/DATABASE:
Already updated. Do not run SQL manually.

USERS:
The shared Inventory/Energy directory already contains 5 current active users.
The missing SELECT permission has now been fixed, so Safety Admin/Manager can
actually read those rows in People & Access.
These users remain GLOBAL directory entries only. They are NOT automatically
assigned to a new site.

NEW SITE RULE:
A new Safety site still starts with ONLY the Admin who creates it.

INCIDENT / POLICY REVIEW:
The department-wide review selector is replaced by targeted document selection.
Choose only the relevant RA / COSHH RA / SSW / controlled document.
The backend then adds ONLY:
- those selected documents,
- documents directly linked to the selected documents,
- TBT/training directly linked to the selected/related documents.
It does NOT flag every document for a department.
SDS links are treated as suggested/reference review rather than mandatory
controlled-document review.
