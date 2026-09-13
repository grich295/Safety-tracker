Safety Tracker v2.10.5 CLEAN - Integrated Template-Driven Creator

Based on the user's current Safety-tracker main repository.

Changes:
- Creator is integrated into app-v2105.js; the old COSHH DOM overlay is no longer loaded.
- Added Risk Assessment creator tile.
- RA, COSHH RA, SSW and Toolbox Talk each use different questions based on that document type.
- Each creator offers an existing same-type document as a topic/format example and scores title similarity.
- Generated PDF layout is different for RA, COSHH RA, SSW and TBT.
- RA generates a hazards / controls / initial risk / further controls / residual risk table.
- SSW generates competence, PPE/equipment, pre-start, safe sequence, stop-work, emergency and completion sections.
- TBT generates key message, hazards, discussion controls, reminders, PPE, emergency, understanding questions, actions and attendance table.
- COSHH keeps linked SDS/MSDS reading and now suggests extracted hazard, PPE, first-aid and storage/ventilation wording into blank fields.
- People exposed is multi-select tick boxes.
- Reference is visible/editable and auto-suggested.
- Generated items import as Pending approval; RA imports as RISK_ASSESSMENT, COSHH as COSHH, SSW as SSW, TBT as TOOLBOX_TALK.
- Main/login/demo/contractor visible version labels updated to v2.10.5 CLEAN.
- New cache-busting app/CSS/service-worker filenames.

No Supabase SQL migration is required for this build.
