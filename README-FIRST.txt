SAFETY TRACKER v2.11.53 - LOGIN SESSION FIX

Upload ALL files in this ZIP to the Safety Tracker repository root.

LIVE LOGS CONFIRMED:
- Shared Inventory/Energy password login: HTTP 200
- Safety access check: HTTP 200
- Safety OTP verification: HTTP 200
- Immediately after that, Safety data calls: HTTP 401

ROOT CAUSE:
The new Safety session was stored under Supabase's default browser key, but the
Safety core uses:
  safety-tracker-supabase-auth-v2914

After reload the core could not see the session it had just created, so it fell
back to "Restoring sign-in...".

FIX:
v2.11.53 uses the exact same auth storage key as app-v21028.js and explicitly
persists the exchanged session before reloading. It also removes the duplicated
"One login" panel.

No Supabase/database changes are required.
