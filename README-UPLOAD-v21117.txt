Safety Tracker v2.11.17 CLEAN — ROLLING TRAINING EXCEL TRACKER

THIS CHANGES THE EXISTING REPORT.
It does NOT add another Training Excel report/button.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21117-training-excel-rolling.js
2. config.js (replace)
3. version.json (replace)

REPORTS > TRAINING EXCEL TRACKER
The existing Training Excel Report button becomes "Training Excel Tracker".

The workbook has two sheets:

1. CURRENT STATUS
- Same purpose as the existing Training Excel report.
- One row per current/active training assignment.
- Person
- Department
- Reference
- Training / Document
- Type
- Method
- Status
- Due Date
- Latest Completed Date
- Version
- Acknowledged by
- Instructor
- Renewal Period
- Filterable and frozen header.

2. TRAINING HISTORY
- Permanent rolling history.
- One row per stored training sign-off/completion.
- Old completion rows remain when a person later completes a refresher.
- Includes inactive/old assignments where a historical sign-off exists.
- Completed Date
- Completion Month (YYYY-MM)
- Year
- Person
- Department
- Reference
- Training / Document
- Type
- Method
- Version
- Acknowledged by
- Instructor
- Delivered Date
- Renewal Period
- Next Due Date
- Assignment Active
- Filterable and frozen header.

The filename is now:
Safety-Tracker-Training-Tracker-YYYY-MM-DD.xlsx

No SQL required.

When automatic monthly email is added, it should send THIS SAME rolling tracker format rather than creating a second training-report design.
