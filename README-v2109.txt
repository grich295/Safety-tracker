Safety Tracker v2.10.9 CORRECTION

This fixes the Training / My Safety dashboard behaviour shown in the screenshot.

Correct behaviour:
- Home screen shows the four status tiles only:
  Complete
  Action required
  Overdue / blocked
  Awaiting instructor
- Individual training cards are NOT shown underneath by default.
- Tapping a status tile opens that section.
- The section then shows category filters:
  COSHH RA
  Risk Assessments
  SSW
  Toolbox Talks
  Safety Awareness
  Other Training
- A Back to training summary button returns to the clean tile-only dashboard.
- Version label updated to v2.10.9.

This patch depends on:
- app-v2108.js
- app-v2107.js
and your existing Safety Tracker supporting files.

INSTALL
1. Keep app-v2107.js and app-v2108.js in the repository.
2. Upload app-v2109.js.
3. In index.html change:
   <script src="app-v2108.js"></script>
   to:
   <script src="app-v2109.js"></script>
4. Update visible static version text to v2.10.9 if present.
5. Commit/deploy and hard-refresh/reopen the app.

No Supabase migration is required for this correction.
