Safety Tracker v2.11.1 CLEAN — DUPLICATE SEARCH BAR CLEANUP

v2.11.0 search works, but an older Site Locations search input can still be
recreated by the legacy tree renderer, leaving two visible search bars.

v2.11.1:
- keeps the working v2.11.0 search unchanged
- hides every legacy Site Locations search input
- removes any old v2.10.98 result container
- guarantees only one search bar is visible
- no database changes

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21101-site-location-search-dedupe.js  NEW
2. config.js                                     REPLACE
3. version.json                                  REPLACE

After reload there should be one Site Locations search bar only.
