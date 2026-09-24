Safety Tracker v2.11.16 CLEAN — BULK METADATA REPAIR

LIVE BUG FOUND
- COSHH product/substance title was being read from the label row:
  "Brand: Where is SDS (Safety Data Sheet) stored? Substance Details"
- The generic importer was taking the first word after ANY "Version" in the whole
  assessment, so examples became v6, v04, v9.1 and even "is".
- Live audit also found RA-028/RA-029 and one SDS item were not classified reliably.

DATABASE ACTION ALREADY DONE
- All current pending single-version Documents were normalised to v1.
- Nothing was approved automatically.

UPLOAD
1. hotfix-v21116-bulk-metadata.js
2. config.js (replace)
3. version.json (replace)

AFTER UPLOAD
- Do NOT approve the current COSHH batch yet.
- Go to Documents / Bulk Import and press "Repair pending import metadata".
- The repair reads the stored first page geometrically and attempts to recover the
  Name of Substance value from the actual table cell.
- Any COSHH title it cannot read confidently is changed to the COSHH reference and
  flagged for manual title confirmation before approval.
- Future bulk analysis automatically repairs the preview before import.
- Import is blocked when metadata still looks unsafe.

No SQL to run.
