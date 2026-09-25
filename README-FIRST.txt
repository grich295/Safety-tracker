SAFETY TRACKER v2.11.49

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21149-access-click-fix.js
- version.json

NO DATABASE CHANGE IS REQUIRED.

ROOT CAUSE:
The shared users were loading correctly, but the Give Safety access / Edit access
buttons were being swallowed by older document-level People/Admin click handlers
before the v2.11.48 access handler could run.

FIX:
v2.11.49 handles the access actions at WINDOW CAPTURE level. That runs before
all of the older document click handlers, so the buttons open and save reliably.

EXPECTED:
- Safety > People & Access
- Every shared Inventory/Energy user has either:
    GIVE SAFETY ACCESS
  or
    EDIT ACCESS
- Tap it and choose:
    Safety ON/OFF
    Role
    Working view
    Home site
    Explicit Safety site checkboxes
- Existing Inventory users are never assigned to a new site automatically.
