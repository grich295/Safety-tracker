SAFETY TRACKER v2.11.42 - SITES USER INTERFACE

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21142-sites-ui.js
- version.json

No Supabase/database update is required.

What changes:
- Admin & Setup gets a clear SITES tile.
- Sites opens a dedicated management screen.
- CREATE NEW SITE opens a proper form instead of relying on prompts.
- New sites start with clear operational records.
- Site cards show READY / SETUP REQUIRED / CURRENT status and assigned-user count.
- READY sites can be opened from the Sites screen.
- SETUP REQUIRED sites remain protected until Safety site isolation is complete.
- People & Access is linked directly from the Sites screen.
- The older v2.11.39 injected Sites card is hidden so there is only one Sites interface.
- No body-wide MutationObserver is used, to avoid reintroducing the mobile flicker issue.
