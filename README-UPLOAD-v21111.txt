Safety Tracker v2.11.11 CLEAN — MANAGEMENT STABILITY

No SQL/database change.

Upload to repository root:
1. hotfix-v21111-management-stability.js
2. config.js (replace)
3. version.json (replace)

config.js intentionally no longer loads:
- hotfix-v21079-management-tiles.js
- hotfix-v21104-management-home-reset.js

Those old files can remain in the repository; they simply will not execute.

Fixes:
- old long Management page briefly showing before tiles
- Management repeatedly pulling/scrolling the page back to the top
- old Management DOM observer continuously re-rendering the tile home
- repeated delayed Management-home resets

Test:
Open Management, scroll down the tile page and leave it for several seconds.
It should remain where you put it and the old Management screen should not flash first.
