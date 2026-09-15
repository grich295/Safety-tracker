Safety Tracker v2.10.27 - Checklist layout hotfix
15 September 2026

ROOT CAUSE
The current app creates checklist buttons with the classes dashboard-tiles and dashboard-tile, but the deployed styles-v21019.css does not contain definitions for those classes. The browser therefore renders the two checklist buttons as near-default inline-looking controls, causing labels/counts to run together on mobile.

THIS HOTFIX
Replace the existing styles-v21019.css in the Safety-tracker repository with the file in this ZIP.

The fix:
- gives PPE Checks and First Aid Checks proper card styling;
- keeps the title and count/status on separate lines;
- stacks cards full width on screens up to 760px;
- keeps two columns on wider screens;
- adds proper padding, touch area, focus state and traffic-light dot layout.

No SQL/database migration is required.
This is intentionally a CSS-only hotfix over v2.10.27 so it does not alter current Safety Tracker logic or data.
