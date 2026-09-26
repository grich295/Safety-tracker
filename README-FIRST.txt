SAFETY TRACKER v2.11.64 - PACK / GROUP TBT / MANAGER MODE

UPLOAD THESE FILES TO THE SAFETY TRACKER REPOSITORY ROOT AND REPLACE THE EXISTING FILES:
  1. hotfix-v21158-hod-training-profile.js
  2. version.json

WHY THE HOTFIX KEEPS THE v21158 FILENAME:
The current config.js already loads hotfix-v21158-hod-training-profile.js.
This v2.11.64 package replaces that loaded file with a cumulative version containing BOTH:
- the existing v2.11.58 HOD / instructor-profile permission controls; and
- the new v2.11.64 document-pack, Group TBT and Manager-mode controls.
This avoids changing config.js and keeps deployment small and safer.

DATABASE:
Already updated in the connected Safety Supabase project. Do not run SQL manually.

DOCUMENT PACKS:
- Bulk upload Word files (including large Crisis Management packs).
- Word files remain individually downloadable/editable and can be replaced one at a time.
- DOCX text is indexed for pack search where available.
- Each file has its own review frequency/date (3/6/12/24 months or custom via review controls).
- Whole-pack acknowledgement has a configurable annual date. 1 January is only the default.
- New-starter grace can be 60 or 90 days.
- If a recent starter completed the pack inside the grace window, the next fixed annual cycle can be waived rather than forcing a duplicate sign-off.
- Reviewed/no-change records the review without creating a new acknowledgement.
- Minor/admin version changes retain history without new acknowledgement.
- Material file change requires acknowledgement of that file only.
- Major pack-wide change deliberately creates a whole-pack acknowledgement.
- Annual acknowledgements store an exact snapshot of the file versions covered.
- Audit CSV includes pack/file/version/sign-off history and snapshot evidence.

TOOLBOX TALKS:
- TBTs are additional top-up/reminder training, not part of the RA/SSW sign-off chain.
- Frequency is configured by GROUP ONLY; there is no individual TBT frequency setting.
- Choose 0-12 top-ups per year for a Group and select the approved TBT pool.
- Dates/topics are spread through the year and rotated from the Group's approved pool.
- Manual TBT delivery remains available and does not reset RA/SSW/COSHH training schedules.

INSTRUCTOR SELF-COMPLETION:
- Preserved as an audited exception for instructor-led training.
- Only available when the assignment belongs to the logged-in person AND they created or uploaded that training AND they are authorised to deliver instructor-led training.
- A reason is mandatory and the exception remains in the audit trail.

ADMIN / MANAGER MODE:
- Admin mode: all departments, all controlled documents/training and site-wide controls.
- Switch to Manager: primary Department scope only.
- A normal Manager account automatically operates in Department scope.
- Department Manager view shows relevant department-owned/site-wide documents and training and limits pack/TBT group controls to the Department scope.
- Switch back to Admin to see/control every department.

VERSION:
2.11.64
