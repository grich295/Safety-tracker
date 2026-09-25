Safety Tracker v2.11.19 CLEAN — CUSTOM DOCUMENT FOLDERS + DEPARTMENT LEADS

THIS REPLACES THE EARLIER v2.11.19 ZIP.
If you have not uploaded v2.11.19 yet, use only this amended package.

DATABASE
Both required Supabase migrations have ALREADY been applied directly.
Do not run SQL manually.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21119-generic-document-folders.js
2. hotfix-v21119-department-leads.js
3. config.js (replace)
4. version.json (replace)

DEPARTMENT LEAD
People > Invite user:
- choose Role / access as normal;
- choose Department as normal;
- tick "Department lead for the selected department" when appropriate.

People > Edit user:
- keep Primary/Additional departments;
- a separate Department Lead section lets Admin mark which of those departments the person leads.

IMPORTANT
Department Lead is NOT the same as the app Manager role.
Examples:
- User + Front desk + Department Lead = Front Desk lead, normal User app permissions.
- Manager + Front desk + Department Lead = Front Desk lead plus Manager app permissions.
- Manager + Front desk without Department Lead = Manager app permissions, but not recorded as Front Desk lead.

A Department Lead must belong to the department they lead.

Department cards show the assigned lead name(s), and People cards show any Department Lead responsibilities.

GENERIC DOCUMENT FOLDERS
The same package also includes:
- custom folders inside Documents;
- plain Information / Policy / Procedure documents;
- reusable controlled templates;
- review date and normal controlled approval/review;
- review responsibility and approval responsibility fields;
- required readers by Everyone / Department / specific people;
- My Safety > Documents to read;
- exact-version open/read audit history.

No duplicate report or separate app is added.
