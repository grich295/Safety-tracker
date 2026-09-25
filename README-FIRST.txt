SAFETY TRACKER v2.11.45 CLEAN

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21145-stable-admin-sites-people.js
- version.json

NO DATABASE CHANGE IS REQUIRED.

This build deliberately removes these superseded frontend layers from the loader:
- v2.11.37 People & Access
- v2.11.39 Management stability
- v2.11.40 flicker guard
- v2.11.41 People flicker guard
- v2.11.42 Sites UI
- v2.11.43 shared-users UI
- v2.11.44 Sites/People UI

Their backend/database work is retained.

v2.11.45 now owns this area:
- Stops the legacy Admin/body child-list observer repaint loops.
- Adds stable standalone SITES and PEOPLE & ACCESS screens.
- Puts Sites and People & Access first on Admin sections.
- Removes VIEWER ACCESS setup from Admin.
- Sites must show Main Hotel immediately.
- People & Access must show the 5 shared Inventory/Energy users plus Safety accounts.
- Create Safety user reuses the existing secure Safety create-user flow.
