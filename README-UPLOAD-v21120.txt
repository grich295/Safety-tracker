Safety Tracker v2.11.20 CLEAN

USE THIS PACKAGE INSTEAD OF THE PREVIOUS AMENDED v2.11.19 PACKAGE.

DATABASE
All required database migrations for Generic Documents and Department Leads have already been applied.
No SQL needs to be run.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21119-generic-document-folders.js
2. hotfix-v21119-department-leads.js
3. hotfix-v21120-approval-review-date.js
4. config.js (replace)
5. version.json (replace)

APPROVAL SCREEN FIX
- Removes the misleading hard-coded "Default: every 6 months" text.
- The helper now follows the actual Training repeat schedule selected in the dropdown.
- Example: if dropdown is Every 12 months, helper says Current setting: Every 12 months.
- Manager/Admin can still override the repeat schedule.

DOCUMENT REVIEW DATE
- Non-SDS approval now includes "Next document review date".
- Default: 12 months from the document issue date if no date is already stored.
- Manager/Admin can override the date before approving.
- The chosen date is written to the pending document version before it becomes approved/current.
- SDS/MSDS remains exempt from this normal document review-date field.

ALSO INCLUDED
- Custom Documents folders and plain controlled documents/templates.
- Department Lead assignment separate from app Role/access.
