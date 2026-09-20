Safety Tracker v2.11.8 CLEAN — ASBESTOS INTELLIGENCE

DATABASE
The Supabase migration `safety_v2118_asbestos_intelligence_chronology` has ALREADY BEEN APPLIED.
Do not run SQL manually.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21108-asbestos-intelligence.js   NEW
2. config.js                                 REPLACE
3. version.json                              REPLACE

WHAT v2.11.8 ADDS
- HSE-informed phrase/rules engine for GB asbestos survey history.
- Recognises:
  * confirmed / known ACM
  * presumed / strongly presumed / suspect / treat-as-asbestos wording
  * no access / inaccessible / not inspected / excluded survey areas
  * encapsulated / sealed / enclosed / overlaid / covered / boxed-in / beneath / behind / remains in situ
  * removal completed vs removal only recommended/planned
  * Certificate for Reoccupation / 4-stage clearance / passed / failed clearance
  * no asbestos detected / negative wording
  * damaged / friable / delaminated / debris / poor-condition wording
  * chrysotile, amosite, crocidolite, tremolite, anthophyllite, actinolite
  * loose fill, sprayed coating, lagging/thermal insulation, AIB, millboard,
    asbestos cement, textured coating, floor tiles/mastic, roofing felt,
    paper/felt, ropes/textiles and gaskets.

- KNOWN/PRESUMED/NO-ACCESS items are highly visible at survey review.
- Existing live ACMs at a surveyed location which are missing from the new
  findings are shown as red "not accounted for" concerns and remain live.
- Covered/encapsulated/overlaid asbestos stays PRESENT and gets a persistent:
  NO DRILLING / CUTTING / SCREWING / LIFTING / DISTURBANCE restriction.
- Critical survey concerns require explicit reviewer acknowledgement.
- Conflicting wording blocks approval until manually reviewed.
- Source date is mandatory before publishing chronological history.
- Older backfilled reports cannot overwrite a newer dated live register state.
- Historical ACMs found only in old evidence are retained as unresolved/potentially
  present until the history explains them.
- Source Library defaults to NEWEST FIRST, matching the agreed rollout.
- Existing legacy approval buttons route through the v2.11.8 chronology guard.

IMPORTANT
The phrase engine assists review; it does not determine legal work category,
licensing requirements, or replace the competent surveyor/source report.
