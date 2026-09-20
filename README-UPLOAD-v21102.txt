Safety Tracker v2.11.2 CLEAN — AUTHORITATIVE SITE LOCATIONS SEARCH

Screenshot diagnosis:
The search field accepted text such as 101, but the full 261-location tree
remained visible. The old v2.10.90 document-level capture listener was still
receiving the input event and controlling the tree.

v2.11.2 fixes the original event conflict:
- only one Site Locations search input is allowed
- every legacy search input is removed
- the new input is intercepted at WINDOW CAPTURE
- this runs before the old DOCUMENT CAPTURE listener
- the old renderer therefore cannot redraw the tree on each keystroke
- only the lightweight matching-results area is updated
- query text remains in the same input
- Android keyboard remains open
- Site Locations remains its own Admin section
- no SQL/database changes

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21102-site-location-search.js   NEW
2. config.js                               REPLACE
3. version.json                            REPLACE

The older v2.11.0/v2.11.1 files may remain in GitHub. The new config.js no
longer loads those workaround files.

TEST
Open Site Locations and type 101.
Expected:
- one search bar
- keyboard stays open
- full 261-location tree disappears while searching
- result should be Room 101 with its full path
- clearing the search restores the normal tree
