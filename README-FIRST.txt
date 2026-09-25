SAFETY TRACKER v2.11.44

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21144-sites-people-stable.js
- version.json

BACKEND:
Already updated. The Safety shared user mirror now contains the 5 current
Inventory/Energy users. No SQL needs to be run manually.

FIXES:
1. Sites no longer uses the legacy Admin-section grouping that was opening an
   empty Admin page. The Sites tile opens its own standalone view.
2. Sites shows Main Hotel immediately and has a proper Create site button.
3. Safety > People now shows "All app users" at the TOP, before the local
   Safety account statistics, so Inventory users are immediately visible.
4. Existing Safety accounts remain a separate section underneath.
5. v2.11.44 installs its stability boundary before the legacy Admin decorators,
   blocking the known admin-subtree observer feedback loops.
6. v2.11.42 and v2.11.43 frontend UI scripts are no longer loaded. Their
   backend/database work remains intact.
