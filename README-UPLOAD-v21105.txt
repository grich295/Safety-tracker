Safety Tracker v2.11.5 CLEAN — ASBESTOS EVIDENCE + AUDIT

DATABASE MIGRATION
Already applied directly to Supabase:
- asbestos_register_access_log_v2115
- log_asbestos_register_view_v2115(...)
No manual SQL is required.

THIS BUILD CLOSES THE ASBESTOS LOOKUP GAPS

1. USER MODE ACCESS
Maintenance users always get Asbestos Lookup.
This includes an Admin account using Switch to User.
Non-maintenance standard users remain blocked.

2. PERMANENT REGISTER VIEW LOG
Each location check records:
- signed-in user
- date/time
- selected location/path
- result status
- asbestos register entry IDs shown
- source document IDs
- source page numbers

Evidence-image opens and source-PDF/page opens are also logged.
Admin/Manager full mode shows the latest 50 asbestos register access records.

3. SOURCE PAGE SNAPSHOTS
For current approved ACM/presumed/no-access entries with a source page:
- Admin/Manager automatically renders the relevant PDF page
- stores a compressed JPEG under asbestos/evidence/
- links it to asbestos_evidence_snippets_v21080
- reuses the same source-page image for entries on the same page
- TEST cleanup already removes linked evidence snippets/storage paths

A manual "Build / repair source snapshots" button is also available to Admin/Manager.

4. ASBESTOS LOOKUP DISPLAY
Each relevant record shows:
- material/status/type/condition
- precise location/extent where available
- management action
- source document + page
- source page snapshot thumbnail
- tap thumbnail to enlarge
- Open source/page button

5. CONTRACTOR CHECK
The contractor asbestos/location section gets the same source evidence thumbnails.
The contractor lookup itself is also audit logged.

UPLOAD TO SAFETY-TRACKER REPOSITORY ROOT
1. hotfix-v21105-asbestos-evidence-audit.js   NEW
2. config.js                                  REPLACE
3. version.json                               REPLACE

TEST ORDER
A. Switch Admin to User -> Asbestos Lookup must open.
B. Select a location -> green "Register check logged" message.
C. Return to Admin/Manager full mode -> Asbestos Lookup -> access log shows that lookup.
D. With a genuine approved survey containing ACMs, select its location:
   source/page must show; snapshot appears after automatic build or press Build / repair source snapshots.
E. Tap snapshot -> enlarged page image.
F. Open contractor sign-in, choose same location -> evidence thumbnail appears there too.
