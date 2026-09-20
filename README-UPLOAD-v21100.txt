Safety Tracker v2.11.0 CLEAN — SITE LOCATIONS ROOT FIX

This replaces the v2.10.97/v2.10.98 workaround chain.

ROOT CAUSE
The legacy Admin section renderer still mapped the exact heading "Site locations"
to the Asbestos section. Every search-results DOM change woke the Admin observer,
which reclassified/hid the Site Locations card. Android then lost focus and the
search/keyboard reset after each character.

V2.11.0
- Stops loading the v2.10.97 and v2.10.98 workaround scripts.
- Permanently classifies Site Locations as its own Admin section.
- Changes the displayed heading to "Site Locations & Rooms" so the legacy exact-title
  mapper cannot reclaim it as Asbestos.
- Disables the legacy v2.10.90 search input.
- Adds one stable search input that never redraws itself while typing.
- Search updates only the results area.
- Existing location tree, Edit actions and TEST cleanup remain intact.
- No SQL required.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21100-site-locations-root-fix.js   NEW
2. config.js                                  REPLACE
3. version.json                               REPLACE

The old v2.10.97 and v2.10.98 files may remain in the repository; config.js no
longer loads them.

TEST
Open Management > Admin & Setup > Site Locations.
Tap search and type 214 normally.
Expected:
- field keeps "214"
- keyboard stays open
- no screen/card flicker
- result shows Guest Rooms > 2nd Floor > Room 214
