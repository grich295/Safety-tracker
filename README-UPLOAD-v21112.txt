Safety Tracker v2.11.12 CLEAN — MANAGEMENT SCROLL GUARD

No SQL/database change.

Upload to repository root:
1. hotfix-v21112-management-scroll-guard.js
2. config.js (replace)
3. version.json (replace)

What this changes:
- Management top tab no longer renders the full Reports screen underneath the tile landing.
- While the Management tile landing is visible, old programmatic scroll-to-top calls are blocked.
- Android/Samsung layout jumps which move upward without a user scroll are restored.
- Finger scrolling, mouse-wheel scrolling and keyboard scrolling still work normally.
- Reports, Calendar and Knowledge detail screens are unaffected once you open them.
- Adds overflow-anchor protection to the Management landing.

Test:
Open Management, scroll halfway down, take your finger off the screen and wait 10 seconds.
It should stay in exactly the same place.
