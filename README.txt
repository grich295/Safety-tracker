Safety Tracker v2.10.9 CLEAN

Rebuilt from v2.10.7 CLEAN.

COSHH creator fixes:
- Restored a full PPE/RPE section: hand, eye/face, respiratory, body/skin and other PPE notes.
- Added product/substance, routes of exposure/health effects, first aid, spill response, storage, fire precautions, environmental/disposal and further-control fields.
- Added initial and post-control risk scoring.
- Read Selected Source Sheets now reads SDS sections and pre-populates COSHH fields wherever readable.
- SDS product name, physical form, H-statements/classification, PPE, first aid, spill, storage, fire/environmental information, ventilation/handling and exposure wording are suggested automatically.
- Generated COSHH PDF now includes all restored sections.
- Existing v2.10.7 contractor headcount, PTW, document control, training, demo, offline and reporting changes retained.

Upload these 3 files to the root of Safety-tracker GitHub:
1. index.html (rename index.html)
2. app-v2109.js
3. styles-v2109.css

No SQL migration is required for this rebuild.


v2.10.9 changes:
- Added Who Has Key shortcut on My Safety beside the live Who's On Site shortcut.
- Shortcut shows current outstanding key/card count.
- Opens a live key register showing holder, company, key/card reference, authorised area and issue time.
- Key/card can be returned directly from the register.
- Uses existing contractor access/key records; no Supabase SQL required.
