SAFETY TRACKER v2.11.41 PEOPLE FLICKER ROOT FIX

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21141-people-flicker-root.js
- version.json

No Supabase/database update is required.

This is a more specific fix than v2.11.40. The remaining People page flicker
was traced to the older v2.10.91 report/retention module, which both watched
the entire body and rebuilt the People Search/Status controls with innerHTML
every time it decorated the page. v2.11.41 stops that loop and keeps the same
native controls mounted while you use them.
