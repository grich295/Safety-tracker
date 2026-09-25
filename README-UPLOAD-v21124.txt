Safety Tracker v2.11.24 CLEAN — FREEZE / STABILITY REPAIR

Use this instead of v2.11.23.

FOUND IN THE RECENT CHANGES
1. v2.11.21 added a MutationObserver on modalBody.
2. v2.11.22 added another MutationObserver on modalBody.
3. v2.11.23 attached a change listener to the persistent modalBody every time the
   generic-document creator opened. Those handlers accumulated instead of disappearing.

CHANGES
- Removed both recent modalBody MutationObservers.
- Approval Training schedule recovery now runs only when approval opens.
- Approval/formal-review frequency controls still work via direct function/click hooks.
- Generic-document creation attaches its listener only to that temporary form.
  Closing/replacing the modal removes it automatically.
- Generic document forms no longer refetch all seven supporting tables on every open
  when Positions/Folders are already loaded.
- Added passive browser long-task diagnostics only. It does not poll and does not
  observe or rewrite the DOM.

ALL v2.11.23 FUNCTIONALITY REMAINS
- Position/People dropdowns for review and approval responsibility
- Departments / Positions / Specific people reader assignment
- Review frequency and Next review date
- Generic folders/templates
- Training approval method/repeat/refresher controls

DATABASE
No SQL required.

UPLOAD/REPLACE THE FILES IN THIS ZIP AT REPOSITORY ROOT.
