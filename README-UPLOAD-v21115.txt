Safety Tracker v2.11.15 CLEAN — AUTO-LINK REPAIR + CLEAN DOCUMENT WORKSPACE

DATABASE RESET ALREADY COMPLETED
- Removed 128 non-asbestos controlled Documents.
- Removed their 148 document versions.
- Removed document links, reviews, activity/history and creator drafts.
- Removed all 77 old Training sessions and their assignments/sign-offs/approvals/files/quiz data.
- Removed the 148 old non-asbestos document storage records and 19 Training storage records.
- PRESERVED all 29 asbestos source Documents and their 29 controlled PDF versions.
- PRESERVED asbestos register/history/source data.
- Users, departments, access settings, PPE, First Aid, PTW/contractor data and other app configuration were not reset.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21115-auto-link-repair.js
2. config.js (replace)
3. version.json (replace)

AUTO-LINK REPAIR
- Force Sync & Review now actually reads the PDFs again.
- Detects direct stated relationships under wording such as:
  Related Documents, Linked Documents, References, See Also, Refer To, Supporting Documents, etc.
- Recognises references such as RA-###, COSHH-###, SSW-###, TBT-###, SDS/MSDS references.
- Keeps pairwise links only; it does NOT transitively link every document in a pack.
- COSHH/SDS product-name matching remains supported by the existing matcher.
- Missing referenced documents are flagged [LINK_SYNC].
- When the missing document is uploaded later, a full scan creates the link and clears that LINK_SYNC warning automatically.
- Bulk Import uses the repaired full scan at the end.
- Normal document upload, replacement upload, standalone Training upload and Creator import trigger an automatic reconciliation after upload.
- Generic link scanning excludes ASBESTOS source PDFs.

NO SQL TO RUN.
