Safety Tracker v2.11.19 CLEAN — CUSTOM DOCUMENT FOLDERS + PLAIN CONTROLLED DOCUMENTS

DATABASE
The required Supabase migration has ALREADY been applied directly.
Do not run SQL manually.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21119-generic-document-folders.js
2. config.js (replace)
3. version.json (replace)

WHAT CHANGES

DOCUMENTS > DOCUMENT FOLDERS
Managers/Admins can:
- create their own folders;
- add plain controlled Information, Policy or Procedure documents;
- mark a document as a reusable Template;
- paste/type plain text directly into Safety Tracker;
- create a new document from an approved template;
- edit a plain document by creating a controlled replacement version;
- choose the folder;
- record Responsible for review as a name or job title;
- record Responsible for approval as a name or job title;
- select required readers as Everyone, Departments and/or specific people;
- set how many days readers have to acknowledge it.

CONTROLLED WORKFLOW
A newly created plain document is v1 Pending approval.
It uses the existing Safety Tracker controlled-document approval and controlled-review workflow.
The pending PDF must be opened before approval.
A replacement plain-text version remains pending while the approved/current version stays in use.

MY SAFETY > DOCUMENTS TO READ
Assigned generic controlled documents appear automatically.
The user must open the exact approved/current version first.
Mark as read then writes the existing Document Activity REVIEWED audit event.
A later approved version becomes a new read requirement because acknowledgements are version-specific.

TEMPLATES
Templates are still controlled documents.
An approved template can be used as the starting text for a new document.

RESPONSIBILITY
The app displays the expected review/approval responsibility (free text name or role/title).
The actual reviewer/approver is still captured from the authenticated Manager/Admin account when the action is completed.

Existing RA/COSHH/SSW/SDS/TBT behaviour is unchanged.
