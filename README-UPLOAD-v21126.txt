Safety Tracker v2.11.26 BUILD PACK
25 September 2026

Purpose
- Fix nested scrolling where inner lists/modals and the main page move together.
- Restore the intended runtime freeze protection.
- Ensure the existing v2.11 hotfix chain is actually loaded by index.html.
- Load MutationObserver governors before the legacy/additive application code.
- No Supabase SQL migration is required.

FILES
1. hotfix-v21126-scroll-isolation.js
   NEW root file.

2. version.json
   REPLACE the current root version.json.

3. INDEX-BOOT-v21126.txt
   Contains the exact replacement for the fallbackBuild + appAssets block near
   the bottom of index.html.

IMPORTANT
The current repository index.html only loads:
  config.js
  app-v21028.js
  hotfix-v21046-baseline.js
  bulk-import-v21028.js
  demo-v2100.js

That means the later v2.11 hotfix files exist in the repository but are not
executed. This pack corrects the loader order.

UPLOAD
- Add hotfix-v21126-scroll-isolation.js to repository root.
- Replace version.json with the supplied version.
- In index.html replace the existing 'const fallbackBuild={...};' and
  'const appAssets=[...];' blocks with INDEX-BOOT-v21126.txt.
- Commit/deploy.

Expected displayed version:
Safety Tracker v2.11.26 CLEAN

No SQL required.
