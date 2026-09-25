Safety Tracker v2.11.23 CLEAN — NATIVE GENERIC DOCUMENT CONTROLS

Use this instead of v2.11.22.

The previous approach decorated the modal after it opened. Your live screenshots showed
the original modal could still appear. v2.11.23 changes the generic-folder feature itself,
so the correct controls are now rendered natively from the start.

Folder / readers / responsibility:
- Responsible for review = dropdown of Positions + active People
- Responsible for approval = dropdown of Positions + active People
- Position options display current holder(s)
- Review frequency = 3/6/12/24/36 months or Custom; default 12 months
- Next review date = calculated but editable
- Reader area = Everyone / whole hotel plus collapsible Departments, Positions and Specific people
- Position reader rules follow current holder(s)

The same controls are used when creating a new plain document/template.

The v2.11.22 Training schedule visibility repair remains included.

Database: no new SQL required. v2.11.21 database changes are already live.

Upload/replace the files in this ZIP at repository root.
