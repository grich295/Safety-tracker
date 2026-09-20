Safety Tracker v2.11.3 CLEAN — SITE LOCATIONS ADMIN ROOT FIX

ROOT CAUSE CONFIRMED
v2.10.85 had this broad rule:
  asbestos source OR site location -> asbestos

So even after newer code correctly classified Site Locations as "locations",
v2.10.85 changed it back to "asbestos" and called the Admin renderer. The
result was the blank Admin detail screen shown in the screenshot.

v2.11.3 fixes the original files:
- v2.10.83: "Site locations" -> locations
- v2.10.83: "Site Locations & Rooms" -> locations
- v2.10.85: asbestos source -> asbestos
- v2.10.85: site location -> locations
- v2.11.2 search remains authoritative
- search observer watches only whole-tree replacement, not its own results
- no SQL/database change

UPLOAD / REPLACE IN REPOSITORY ROOT
1. hotfix-v21083-admin-sections.js          REPLACE
2. hotfix-v21085-admin-grouping.js          REPLACE
3. hotfix-v21102-site-location-search.js    REPLACE
4. config.js                                REPLACE
5. version.json                             REPLACE

TEST
Management > Admin & Setup > Site Locations
Expected:
- Site Locations card is visible, not blank
- one search bar
- type 101
- keyboard stays open
- normal 261-location tree hides during search
- Room 101 result is shown with its full path
