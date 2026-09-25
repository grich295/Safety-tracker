SAFETY TRACKER v2.11.46

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21146-people-sites.js
- version.json

DATABASE:
Already updated. Do not run SQL manually.

FINAL USER MODEL:
- PEOPLE & ACCESS is the global directory.
- Existing Inventory/Energy users appear there even if Safety is OFF.
- They do NOT automatically appear as users of a new Safety site.
- A brand-new site starts with ONLY the Admin who created it.
- Site > Manage people explicitly assigns existing Safety accounts to that site.
- Inventory/Energy-only users must first be given Safety access before they can
  be assigned to a Safety site.
- Viewer Access setup is removed from Admin.
