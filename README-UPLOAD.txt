SAFETY TRACKER v2.10.28 HOTFIX
Baseline: v2.10.27
Date: 16 September 2026

WHAT THIS FIXES
1. Fixes: "Action failed: previousMonthValue is not defined".
2. Changes the approved-document button from "Training audience" to "Training settings".
3. Shows the current training method and repeat frequency on the document card.
4. The Training settings modal now saves BOTH:
   - training method (Self-training / Instructor-led)
   - training repeat schedule (One-off / 3 / 6 / 12 / 24 months / Custom)
   - training audience / department / people / completion due period
5. Changed renewal frequency is propagated to the auto-managed training session and active assignments.
6. Next renewal remains based on each person's latest completed/sign-off date.
7. Document review date remains separate from training renewal frequency.
8. No SQL/database migration is required for this patch; it uses fields/RPCs already present in v2.10.27.

TO DEPLOY
- Upload safety-v21028-hotfix.js to the root of the Safety-tracker GitHub repository.
- Replace version.json with the version in this folder.
- In index.html, use index-bottom-v21028.txt to update the bottom build/script block so the hotfix is loaded immediately after app-v21027.js.
- Commit the changes and reload the live app.

CHECK AFTER DEPLOYMENT
A. Version should show v2.10.28 CLEAN.
B. Documents > an approved RA/COSHH RA/SSW should show "Training settings".
C. Open Training settings; choose e.g. Every 6 months; save; reopen and confirm it remains 6 months.
D. For someone with previous completed training, their next due date should be latest completion + the selected repeat period.
E. Reports should open without the previousMonthValue error.

TOOLBOX TALKS
Toolbox Talks are training sessions in the current v2.10.27 architecture rather than sourceDocTypes (RA/COSHH/SSW). Their frequency remains editable from the Training item > Edit screen, which already uses the same One-off / 3 / 6 / 12 / 24 / Custom selector.
