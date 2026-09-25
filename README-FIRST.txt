SAFETY TRACKER v2.11.40 SCREEN FLICKER FIX

Upload these 3 files to the Safety Tracker repository root:
- config.js
- hotfix-v21140-flicker-guard.js
- version.json

No Supabase/database update is needed.

Cause fixed:
The late People & Access and Management patches each created a body-wide
MutationObserver. Their callbacks changed UI/navigation DOM, which could
immediately trigger the same observer again. On Android this shows as the
whole Admin/Management screen flickering and can make a native select/dropdown
flash closed.

v2.11.40 blocks only those known late broad observers. Scoped observers used
for modals, People filters and Admin section content are left alone.
