Safety Tracker v2.10.96 CLEAN — REPAIR-ONLY UPDATE
20 September 2026

This is NOT a rebuild and does NOT reset live Safety Tracker data.

DATABASE — ALREADY DONE
- The v2.10.96 Supabase migration has been applied directly.
- The current TEST 250-room proof has 255 TEST-created locations tracked safely:
  250 rooms + 5 floor nodes.
- The original Guest Rooms parent is protected and is NOT marked as TEST-created.
- Delete TEST now removes only TEST-created locations that remain unused/unshared.
- Any location used by genuine asbestos evidence, another source, a contractor permit or an incident review is retained automatically.

UPLOAD / REPLACE IN THE ROOT OF grich295/Safety-tracker
1. hotfix-v21096-site-location-test-cleanup.js   (NEW)
2. config.js                                    (REPLACE)
3. version.json                                 (REPLACE)

No SQL needs to be copied or run manually.

VERIFY IN THIS ORDER
1. Reload Safety Tracker and confirm v2.10.96 CLEAN.
2. Management > Admin & Setup > Site Locations.
   The tree must display instead of the blank screen.
   BEFORE deleting the TEST proof it should show 261 active locations and 250 rooms.
3. Search/expand to Guest Rooms > 2nd Floor > Room 214.
4. Go to Asbestos Sources and delete TEST_Asbestos_Management_Survey_250_Room_Location_Proof.
5. Re-open Site Locations. The 250 TEST rooms and 5 TEST floors should be gone.
   The six original top-level locations remain.
6. Upload/approve the genuine asbestos survey.
   Its approved locations should then populate Site Locations automatically.
7. Check a genuine room in Asbestos Lookup and Contractor Sign-in.
   Relevant current ACM details and source/page evidence should match the genuine survey.
