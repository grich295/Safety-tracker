Safety Tracker v2.11.14 CLEAN — CONTRACTOR MULTI-AREA + RED ASBESTOS LOCATIONS

NO SQL REQUIRED.
NO EDGE FUNCTION CHANGE REQUIRED.

The current contractor-permit backend already supports:
- location_ids[] with multiple locations
- work_scope_type = MULTIPLE
- asbestos preview across every selected location and descendants
- asbestos scope fingerprints
- multi-area asbestos snapshots and room summaries

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21114-contractor-multi-area.js
2. config.js (replace)
3. version.json (replace)

CHANGES
- Work location becomes "Work areas".
- Choose one or many rooms/areas.
- Searchable mobile-friendly location picker.
- Known/presumed ACM locations are RED.
- NO ACCESS / incomplete asbestos information is RED.
- A floor/parent area is RED when a known ACM exists somewhere inside that selected scope.
- Areas with incomplete survey coverage are AMBER.
- Surveyed/no-current-ACM rooms can show GREEN.
- The selected-area summary stays red when the work scope contains a known/incomplete area.
- Asbestos preview checks ALL selected areas together.
- Changing the area selection clears the asbestos acknowledgement and requires a fresh check.
- The asbestos scope fingerprint from the latest check is submitted with the permit, so the backend rejects a stale acknowledgement if the register/location scope changed.
- Existing PTW approval/review screen already supports multiple location_ids and combined location_text.

TEST
Open Contractor sign-in:
1. Tap Select one or more work areas.
2. Select two or more rooms.
3. Confirm the selected-area summary lists all of them.
4. If a known ACM/no-access area exists, its row and selected summary should be red.
5. Review asbestos information and complete the acknowledgement.
6. Submit and confirm PTW review shows all selected work locations.
