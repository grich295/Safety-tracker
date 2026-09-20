Safety Tracker v2.11.7 CLEAN — ASBESTOS HISTORY + SOURCE LIBRARY

NO DATABASE MIGRATION REQUIRED.

Adds:
- Historical bulk import with NO fixed 30-file limit.
- Sequential one-file-at-a-time analysis so 50/100+ files do not all load into memory together.
- Existing 50 MB maximum remains per individual PDF.
- Duplicate PDFs are skipped.
- Failed files do not stop the batch.
- Nothing is auto-published.
- Type/date/version pre-detection for each historical PDF.
- Searchable Source Library with type/year/status filters.
- Oldest-first default for chronological history review.
- Pagination: 20 reports per page.
- Open full original PDF.
- Download original PDF again.
- Download all filtered source PDFs as ZIP parts.
- Large ZIP exports split at 10 PDFs or about 150 MB per part.
- Review / Re-analyse / Delete TEST actions retained.

UPLOAD TO REPOSITORY ROOT:
1. hotfix-v21107-asbestos-history-library.js  NEW
2. config.js                                   REPLACE
3. version.json                                REPLACE

After upload:
Admin & Setup -> Asbestos & Locations
You should see Historical bulk import and Asbestos Source Library / History.
