Safety Tracker v2.11.67 — Management navigation stability
26 September 2026

UPLOAD TO THE ROOT OF THE Safety-tracker REPOSITORY AND REPLACE THE EXISTING FILES:
1. hotfix-v21158-hod-training-profile.js
2. version.json

README-FIRST.txt is for reference only.

NO SQL / DATABASE MIGRATION IS REQUIRED FOR v2.11.67.
The v2.11.66 database changes are already applied.

WHAT THIS FIXES
- Management tab always returns to the Management tile main menu.
- Stops the Management tab/detail screens from bouncing/skipping between the tile home and Reports.
- Calendar opens Calendar detail correctly.
- Reports & Evidence opens the detailed Reports screen correctly.
- Knowledge Checks opens its correct Management detail.
- Safety Actions opens the action section in Compliance.
- Compliance, People and Admin remain normal Management destinations.
- A single visible "← Management" button returns to the Management main menu.
- Android/browser Back from a Management detail returns to Management home first.
- Duplicate older Management back buttons are hidden.

NOT CHANGED IN THIS BUILD
- User view layout has intentionally not been altered yet. First confirm Management navigation is stable, then the User view can be assessed without this navigation fault confusing the comparison.
- People & Access / departments / HOD / Operational Overseer from v2.11.66 remain unchanged.
- Controlled document sets and review logic from v2.11.65 remain unchanged.
