Safety Tracker v2.11.70 — MANAGEMENT HOME + MOBILE TILE FIX

Upload these 3 files to the ROOT of the Safety-tracker GitHub repository and replace the existing versions:

1. hotfix-v21158-hod-training-profile.js
2. hotfix-v21136-first-aid-default-types.js
3. version.json

No SQL / Supabase migration is required.

WHAT THIS FIXES
- Management now behaves as a true home button. Tapping Management clears any open Management detail/setup state and opens the Management tile menu directly.
- The in-page “← Management” controls do the same thing and no longer depend on browser-history timing.
- Android/browser Back can still use normal history, but the visible Management controls are deterministic.
- Departments / Positions / Users setup tiles are laid out correctly on phone screens. Their D / P / U icons now sit above the title instead of covering the first letters.
- Preserves v2.11.69 Instructor visibility and User Edit/Create fixes and all earlier v2.11.68 setup work.
