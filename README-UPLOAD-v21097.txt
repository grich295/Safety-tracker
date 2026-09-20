Safety Tracker v2.10.97 CLEAN — SITE LOCATIONS DISPLAY REPAIR
20 September 2026

This is a small repair-only update. It does not reset data.

WHY v2.10.96 STILL LOOKED THE SAME
The live database was correct (261 active locations, 250 rooms and Room 214),
but the older Admin section renderer was re-applying the hidden attribute after
the dedicated Site Locations tile tried to display the card.

v2.10.97 fixes that conflict definitively:
- Site Locations is forced visible when its Admin tile is selected.
- Older Admin render passes can no longer hide it.
- The location tree is refreshed directly from Supabase.
- A LIVE LOCATION CHECK banner shows active locations, room count and Room 214 status.
- A Refresh button is included for an immediate live re-check.

DATABASE
The v2.10.96 database migration is already applied. No SQL is required for v2.10.97.
The TEST source cleanup protection remains in place.

UPLOAD / REPLACE IN REPOSITORY ROOT
1. hotfix-v21097-site-locations-display.js   (new)
2. config.js                                 (replace)
3. version.json                              (replace)

TEST BEFORE DELETING THE TEST SURVEY
Management > Admin & Setup > Site Locations

Expected live banner:
261 active locations · 250 rooms · Room 214 found

The tree should include:
Guest Rooms > 2nd Floor > Room 214

Do not delete the TEST survey until the location tree is visibly confirmed.
