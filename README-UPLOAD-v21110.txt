Safety Tracker v2.11.10 CLEAN — USER ACCESS SAVE / MOBILE STABILITY REPAIR

No new database migration is required.

Upload to repository root:
1. hotfix-v21110-user-access-save-repair.js
2. config.js (replace)
3. version.json (replace)

Important:
- v2.11.9 hotfix is intentionally no longer loaded by config.js.
- The old file can remain in the repo; it will not execute.
- Reopen/refresh the app after deployment.

Expected test:
Admin -> People -> Edit user
The section should say Access preferences (not User Mode preferences).
Change one option -> Save changes.
The button should show Saving…, the modal should close, and the preference should persist.
