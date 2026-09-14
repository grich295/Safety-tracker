Safety Tracker v2.10.8 UPDATE

This update is based on the v2.10.7 CLEAN app.

Included:
- Cleaner My Safety screen.
- The four summary tiles are now clickable:
  * Action required
  * Overdue / blocked
  * Awaiting instructor
  * Complete
- Training is then grouped into:
  * COSHH RA
  * Risk Assessments
  * SSW
  * Toolbox Talks
  * Safety Awareness
  * Other Training
- The long training list is hidden until a status/category is selected.
- Admin/Manager gets a clear Pending Approval banner and count on Documents.
- Pending Approval opens the Pending filter and scrolls to the approval area.
- Normal Users continue to see approved/current assigned training only. Supabase RLS already enforces this.
- Document Creation ON/OFF database RLS fix has already been applied directly to Supabase.
- Visible build/version labels are updated to v2.10.8.

INSTALL

Keep these existing live files:
- app-v2107.js
- config.js
- styles-v2107.css
- all other current Safety Tracker files

1. Upload app-v2108.js to the root of the Safety-tracker GitHub repository.
2. Open index.html.
3. At the bottom, change:
     <script src="app-v2107.js"></script>
   to:
     <script src="app-v2108.js"></script>
4. Update any static v2.10.7 text in index.html to v2.10.8 if you want the new number visible before JavaScript loads.
   The patch also updates the visible version labels once the app starts.
5. Commit the changes and allow GitHub Pages / Cloudflare to redeploy.

IMPORTANT
Do not delete app-v2107.js. v2.10.8 intentionally loads it as the stable baseline, then applies the agreed UI update on top.

Supabase project used for the database fixes:
qvgcralroduuoptbnctt
