SAFETY TRACKER v2.11.43

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21143-stability-shared-users.js
- version.json

DATABASE/BACKEND:
Already applied. Do not run SQL manually.
- Safety shared_app_users_v21143 mirror table created.
- Shared Inventory/Energy export edge function deployed.
- Safety admin-only sync edge function deployed.

WHAT THIS FIXES:
1. Remaining mobile flicker:
   Legacy hotfixes were still watching the entire BODY or #appView and changing
   the DOM they were observing. v2.11.43 blocks those whole-app observers.
   Scoped observers for modals and specific lists remain available.

2. Inventory users in Safety:
   Safety > People now has an "All app users" section.
   It lists the shared Inventory/Energy directory and badges each user's
   Inventory, Energy and Safety status.
   Admin opening Safety triggers a directory sync automatically.
   "Sync users" is also available manually.

IMPORTANT:
Seeing a user in All app users does NOT grant them Safety access. Safety auth
is still a separate Supabase project, so Safety access remains independently
controlled until authentication is consolidated across the apps.
