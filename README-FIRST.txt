SAFETY TRACKER v2.11.48

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21148-edit-shared-user-access.js
- version.json

DATABASE:
Already updated. Do not run SQL manually.
A shared-to-Safety account link table has been added so Inventory/Energy people
can be reliably connected to their Safety account even if they later use a
username-only login.

PEOPLE & ACCESS:
- Shared Inventory/Energy users now have a button:
  * GIVE SAFETY ACCESS if no Safety account exists
  * EDIT ACCESS once Safety exists
- Role can be User / Manager / Admin / Viewer.
- Working view can be User / Full / Viewer.
- Safety sites are explicit checkboxes.
- NO site is automatically ticked when giving access.
- A Home Site can be selected deliberately.
- New sites still start with only the Admin who created them.
- Existing site creator/Admin access is protected from accidental removal.
- Email users receive an invitation.
- Username-only users can be created with a temporary password.
- Username-only passwords can be reset by an Admin later.

The v2.11.47 targeted incident/document review is retained.
