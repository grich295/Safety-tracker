Safety Tracker v2.10.95 CLEAN — REPAIR-ONLY UPDATE
20 September 2026

This is NOT a fresh rebuild and does NOT reset app data.
It sits on top of the current v2.10.94 CLEAN build.

UPLOAD / REPLACE THESE FILES IN THE ROOT OF grich295/Safety-tracker:
1. config.js
2. version.json
3. hotfix-v21095-repair-bundle.js

No SQL migration is required.
Do not delete or replace the existing v2.10.94 and earlier hotfix files.

Repairs included:
- Site Locations refreshes from Supabase when the section is opened and after asbestos catalogue approval, so newly published floors/rooms (including Room 214) do not remain hidden behind stale in-memory data.
- Reports detail pages have a reliable Management back route.
- Contractor asbestos acknowledgement is reset when the work location changes and is tied to the exact selected location; relevant live ACM source/page evidence is shown where available.
- Explicit TEST/DEMO asbestos sources consistently receive Delete TEST, including re-analysis review views, using the source ID instead of fragile card-order matching.

After upload, reload Safety Tracker. The displayed build should read v2.10.95 CLEAN.
