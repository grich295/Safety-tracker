Safety Tracker v2.10.98 CLEAN — SITE LOCATION SEARCH REPAIR

Problem fixed:
- Site Locations search rebuilt the whole location tree after every character.
- The search input itself was recreated during each render.
- On Android this caused severe typing lag and the keyboard to partly close/flicker.

v2.10.98:
- Uses a stable search input that remains focused while typing.
- Does not rebuild the whole tree per keystroke.
- Shows lightweight matching location results with full location paths.
- Keeps Edit available from search results.
- No database/SQL changes.

UPLOAD TO REPOSITORY ROOT:
1. hotfix-v21098-site-location-search.js  (new)
2. config.js                              (replace)
3. version.json                           (replace)

Then reload Safety Tracker and test Site Locations search.
