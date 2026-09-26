SAFETY TRACKER v2.11.66 — PEOPLE / DEPARTMENT / OPERATIONAL OVERSIGHT
=====================================================================

UPLOAD
------
Upload these files to the ROOT of the existing Safety-tracker repository and replace the existing files with the same names:

1. hotfix-v21158-hod-training-profile.js
2. version.json
3. README-FIRST.txt

No config.js change is required. The existing loader already loads hotfix-v21158-hod-training-profile.js.

DATABASE
--------
The v2.11.66 database migrations have ALREADY been applied to the Safety Tracker Supabase project.
Do NOT run any SQL manually for this build.

WHAT v2.11.66 CHANGES
---------------------
People & Access is now the main place for person setup:
- Main Department is selected directly.
- Additional Departments are optional.
- Main Position / job title is selected separately.
- Additional Positions are optional.
- Changing Position no longer silently moves a person to another Department once their profile has been saved in the new editor.
- Official HOD remains one per Department and follows Main Department.
- Operational Overseer is a separate responsibility and can be assigned to any selected Departments.
- Operational Overseer does NOT replace the official HOD.
- Instructor-led training permission stays as a separate permission.
- Site access, role, working view, Department, Position and responsibilities are edited from one Person setup screen.

NEW USERS / SITES
-----------------
New Safety users created in People & Access default to the Safety site from which they are created as their Home Site.
Other site access can be added at creation or later.
The legacy Create User button is also redirected into the new person setup flow.

MANAGER / OPERATIONAL OVERSEER SCOPE
------------------------------------
A Manager/Operational Overseer can have more than one managed Department.
In Manager mode, when more than one Department is available, a Department Scope selector appears:
- All managed / overseen Departments
- or one specific Department

The official HOD still remains visible/responsible for their Department. Operational oversight adds management access and does not transfer HOD ownership.

COMPATIBILITY
-------------
The existing v2.11.58 HOD/instructor API is retained for older screens, but it now uses Main Department rather than deriving HOD Department from Main Position.
The file is cumulative and also contains the v2.11.64 and v2.11.65 functionality.
