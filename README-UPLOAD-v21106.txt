Safety Tracker v2.11.6 CLEAN — CLEANER ASBESTOS WORKFLOW

DATABASE FIX ALREADY APPLIED
No SQL for you to run.

WHAT WAS WRONG
- A new "no asbestos detected" result from an initial survey was incorrectly
  treated like a later update and demanded an existing ACM match.
- The AMP had created bogus locations from headings such as Management controls
  and TEST.
- The advanced multi-area lookup dominated the normal lookup screen.

WHAT IS FIXED
- Initial survey negative findings publish correctly as surveyed/no-ACM results.
- Later lifecycle negative/removal/clearance actions still require the correct match.
- AMP = controls/references only. It no longer creates site locations.
- The bogus AMP-created locations and coverage were safely removed from live data.
- The current TEST survey is still REVIEW READY. Do not re-upload it.

NEW ADMIN FLOW
1. Management Plan
2. Survey
3. Live register & lookup

The Survey step shows exactly what was extracted.
For the current TEST survey:
- 10 locations
- 6 ACM / presumed
- 3 surveyed clear
- 1 no-access / incomplete

Before publication the app repeats those totals in a plain-English confirmation.

LOOKUP
- Simple exact-location check is the default.
- Pending survey status is explained instead of showing a confusing 0 count.
- Whole floor / multiple areas is collapsed under an Advanced button.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21106-asbestos-workflow.js  NEW
2. config.js                           REPLACE
3. version.json                        REPLACE

NEXT TEST
After upload:
Admin & Setup -> Asbestos & Locations -> Review & publish survey.
You should not get the "requires an existing asbestos record match" error.
