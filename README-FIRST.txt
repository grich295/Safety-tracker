SAFETY TRACKER v2.11.54 - CACHE + LOGIN RECOVERY

Upload ALL files in this ZIP to the Safety Tracker repository root.

WHAT I CONFIRMED:
The GitHub repository already contained v2.11.53, but the phone screenshot was
still showing v2.11.52. The phone was therefore running cached Safety files.

LIVE AUTH LOGS ALSO SHOW:
- Shared Inventory/Energy password accepted (200)
- Safety access check accepted (200)
- Safety OTP/session verification accepted (200)
- Old page then made Safety data requests without the new session (401)

v2.11.54:
- changes the Safety service-worker cache generation
- deletes previous Safety shell/runtime caches
- makes config.js and version.json network/no-store while online
- keeps the v2.11.53 exact Safety auth storage-key fix
- suppresses the duplicate One login panel

IMPORTANT:
After upload, fully close the Safety Tracker browser/PWA once and reopen it.
The first reopen updates the service worker. If it still displays v2.11.52,
close it once more and reopen: the newly activated worker will then serve v2.11.54.

No SQL/Supabase changes are required.
