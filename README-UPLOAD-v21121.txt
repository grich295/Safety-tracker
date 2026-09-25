Safety Tracker v2.11.21 CLEAN

USE THIS PACKAGE INSTEAD OF v2.11.20.

DATABASE
The required Supabase migration has ALREADY been applied directly.
Do not run SQL manually.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21119-generic-document-folders.js
2. hotfix-v21119-department-leads.js
3. hotfix-v21120-approval-review-date.js
4. hotfix-v21121-generic-doc-controls.js
5. config.js (replace)
6. version.json (replace)

GENERIC DOCUMENT RESPONSIBILITY
- Responsible for review is now a dropdown.
- Responsible for approval is now a dropdown.
- Each dropdown lists configured Positions first, then active People.
- Position options show their current holder where available.
- Selecting a Position means responsibility follows whoever currently holds that position.
- Selecting a Person ties it to that named Safety Tracker user.

SUGGESTED RESPONSIBILITY
- Everyone / whole hotel: suggests configured H&S Manager.
- One department: suggests that department manager/lead, preferring the matching manager position.
- If no suitable owner is configured: suggests the document uploader.
- The suggestion can always be changed.

WHO NEEDS TO READ IT
The large reader area has been tidied into:
- Everyone / whole hotel
- Departments
- Positions
- Specific people
Departments, Positions and People are collapsible.
A Position assignment automatically applies to its current holder(s) and follows future holder changes.

REVIEW FREQUENCY
- Default: every 12 months.
- Presets: 3, 6, 12, 24, 36 months, plus Custom.
- Available when creating a generic controlled document.
- Available later in Folder / readers / responsibility controls.
- Available at initial document approval.
- Available during the formal controlled review.
- Changing the frequency recalculates Next review date.
- Manager/Admin can still override the exact next review date.

No existing document/training history is deleted.
