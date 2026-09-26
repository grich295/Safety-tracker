Safety Tracker v2.11.71 — APPROVAL SAVE RELIABILITY

Upload these files to the ROOT of the Safety-tracker GitHub repository and replace the existing files:
1. hotfix-v21136-first-aid-default-types.js
2. version.json

WHAT THIS FIXES
- 'Save approval decision' now has a deterministic click handler.
- Admin approval is kept enabled unless the document scope/audience is genuinely missing.
- Any validation or save failure is shown inside the approval modal, not hidden behind it.
- Existing v2.11.70 and all prior cumulative features are retained.

DATABASE
- No SQL / Supabase migration is required for v2.11.71.
