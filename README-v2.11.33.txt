SAFETY TRACKER v2.11.33 CLEAN
Owner Department + Department PPE / First Aid responsibilities
25 September 2026

UPLOAD TO THE ROOT OF grich295/Safety-tracker
Replace/add these files:
1. config.js                         REPLACE
2. version.json                     REPLACE
3. hotfix-v21133-owner-department-functions.js   ADD

The Supabase database changes have ALREADY BEEN APPLIED to the live Safety Tracker project.
DO NOT paste or run SQL for this update.

EXPECTED HEADER AFTER DEPLOYMENT
Safety Tracker v2.11.33 CLEAN

WHAT CHANGED

1) OWNER DEPARTMENT ON CONTROLLED SAFETY ITEMS
Owner Department is now explicit rather than being inferred only from the audience.
It is used for:
- Risk Assessments
- COSHH Risk Assessments
- Safe Systems of Work
- Policies
- Procedures
- Other / Information controlled documents
- Controlled Toolbox Talks

SDS / MSDS remains reference-only and does not require an Owner Department.

For a new RA / COSHH RA / SSW / Policy / Procedure / Information document:
- Review & Approve shows Owner Department.
- Approval cannot be completed without an Owner Department.
- The Department Manager owns review, follow-up and compliance responsibility.
- Admin can still approve any controlled document.
- The H&S Manager can approve across departments.
- A normal Manager can approve where they are the responsible manager for the Owner Department.

For a Toolbox Talk:
- Review & Approve Toolbox Talk also requires Owner Department.
- The owner is automatically included in the Toolbox Talk audience unless Everyone is selected.

2) OWNER IS SEPARATE FROM WHO NEEDS TRAINING / READING
Owner Department does NOT limit the audience.
Example:
  Owner Department: Maintenance
  Training applies to: Maintenance + Housekeeping + a specific person

The Owner Department is automatically included in the relevant Training/read audience unless Everyone is selected.
Extra departments/people remain independently selectable.

Existing approved RA / COSHH RA / SSW items can change Owner Department from Assign to / Training settings.
Document Details also has an Owner Department control so Policy/Procedure/Information ownership can be changed without a new PDF version.
Existing evidence, version history and training completion history are retained.

3) EXISTING DATA BACKFILL
Where an existing RA / COSHH RA / SSW had exactly one Department audience, that Department was safely backfilled as the Owner Department.
Everyone/multi-department documents were deliberately not guessed and remain to be confirmed by Admin/Manager.
Existing Toolbox Talks with a single Department audience can also be backfilled; other Toolbox Talks show Owner Department required until confirmed.

4) DEPARTMENT SETUP — PPE / FIRST AID
Admin -> Departments now supports two department functions:
- PPE responsibility / monthly PPE checks
- First Aid responsibility / monthly first-aid checks

Admin decides whether each function is enabled for a Department.
This is deliberately separate from choosing the responsible employee.

5) DEPARTMENT MANAGER / H&S MANAGER RESPONSIBILITY
For a Department they manage, the Department Manager or H&S Manager can select:
- PPE responsible person
- First Aid responsible person

The selectable person must be an active member of that Department.
Admin can also set/change these people.

6) FIRST AID DEFAULT RESPONSIBILITY
Monthly First Aid assignment priority is now:
1. Box-specific responsible person, if a box has an override.
2. Department First Aid responsible person.
3. Random active Department member as fallback.

Changing the Department First Aid responsible person also reassigns the current month's unsubmitted checks where the box does not have its own override.
Box-specific overrides and historical completed checks are retained.

7) PPE RESPONSIBILITY
The Department PPE responsible person can:
- See open Missing / Replacement Required PPE issues for staff in their Department.
- Mark the action Open / Ordered / Resolved / Not Required.
- Add an action note.

This does not make that person an Admin and does not expose Admin controls.
Existing Admin/Manager PPE management continues to work.

8) EXISTING v2.11.32 FIXES RETAINED
- Assign to is consistent across controlled documents and Training.
- Move / classify remains available so a document can be moved between RA/COSHH/SSW/SDS/Policy/Procedure/Other and custom folders without re-uploading.
- Version/PDF/history/links remain attached to the same document record.
- Approval scope and Next Review Date fixes remain loaded.

DATABASE STATUS
Applied directly to Supabase project: Safety tracker
Applied migrations:
- safety_v21133_owner_department_functions
- safety_v21133_rpc_permissions
- safety_v21133_owner_department_tbt_generic

New database capabilities include:
- documents.owner_department_id
- training_sessions.owner_department_id for controlled Toolbox Talks
- departments.ppe_enabled
- departments.first_aid_enabled
- departments.ppe_responsible_user_id
- departments.first_aid_responsible_user_id
- Department-safe RPCs and PPE read/action permissions

SECURITY CHECK
The new SECURITY DEFINER RPCs were explicitly revoked from anon/public execution and granted to authenticated users only. Each RPC then checks the signed-in user's role/responsibility before allowing a change.

QUICK TEST AFTER DEPLOYMENT
A. Open a pending RA/COSHH RA/SSW -> Review & Approve.
   Confirm Owner Department appears above Training and selecting an owner also selects that Department in the Training audience.
B. Open a pending Policy/Procedure -> Review & Approve.
   Confirm Owner Department and reader scope both appear.
C. Open a pending Toolbox Talk -> Review & Approve.
   Confirm Owner Department appears and is included in the TBT audience.
D. Admin -> Departments -> edit/create a Department.
   Confirm PPE and First Aid enable switches appear.
E. Open PPE or First Aid as the responsible Department Manager/H&S Manager.
   Confirm Department responsibility setup is available and only Department members can be chosen.
F. Check a First Aid box with no box-specific default.
   Confirm the next monthly check uses the Department First Aid responsible person.

If the browser has the old build cached, refresh once after GitHub Pages has deployed. The header should then show v2.11.33 CLEAN.
