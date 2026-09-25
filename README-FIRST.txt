SAFETY TRACKER v2.11.52 - LOGIN FIX

Upload ALL files in this ZIP to the Safety Tracker repository root.

ROOT CAUSE:
v2.11.51 put the shared-login code inside the delayed hotfix loader.
At the login screen that module was not running, so pressing Sign in never
called the shared Inventory/Energy master login or the Safety session exchange.

FIX:
v2.11.52 puts the shared-login handler directly inside config.js, which the
login page always loads before the Safety core.

USE:
Sign in to Safety with the SAME email/username and SAME password you currently
use for Inventory/Energy.

No database or Supabase changes are required. The v2.11.51 backend functions
and Original Site database changes are already deployed.
