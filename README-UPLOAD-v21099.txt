Safety Tracker v2.10.99 CLEAN — ANDROID SITE LOCATION SEARCH STABILITY

Cause found:
Two watchers were fighting the new search:
1. v2.10.97 rebuilt the complete Site Locations tree whenever any child content changed.
2. v2.10.98 watched its own search-result mutations and repeatedly re-ran installation.

That destroyed/replaced the active input, so Android closed the keyboard.

v2.10.99 fixes both:
- v2.10.97 only rebuilds the location tree when it is actually missing, or after an intentional live data refresh.
- v2.10.97 no longer watches every subtree/search-result mutation.
- v2.10.98 only watches for replacement of the whole tree.
- Search result changes no longer trigger another render/install loop.
- The same search input stays mounted and focused while typing.

UPLOAD / REPLACE IN REPOSITORY ROOT:
1. hotfix-v21097-site-locations-display.js   REPLACE
2. hotfix-v21098-site-location-search.js     REPLACE
3. config.js                                 REPLACE
4. version.json                              REPLACE

No SQL/database changes.

Test:
Open Site Locations, tap Search, type 214 continuously.
The keyboard should remain open for all three characters and the result should show:
Guest Rooms > 2nd Floor > Room 214
