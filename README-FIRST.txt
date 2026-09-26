SAFETY TRACKER v2.11.69

UPLOAD THESE FILES TO THE ROOT OF THE Safety-tracker GITHUB REPOSITORY AND REPLACE THE EXISTING FILES:

1. hotfix-v21136-first-aid-default-types.js
2. version.json

No SQL is required for v2.11.69.

FIXES
- Instructor no longer disappears after another page/menu refresh. It remains visible for:
  • Admin/Manager in their normal management view
  • official HOD / Department Manager
  • anyone with “Can carry out instructor-led training” enabled
- Instructor authority is rechecked after profile/access changes and normal navigation.
- If instructor permission becomes available after the instructor module first loaded, the module can recover once without a full code change.
- Users → Edit setup now stops older click handlers, reports a visible error if opening fails, and has a fallback if a rebuilt user card misses the first click handler.
- Create User gets the same reliable opening/error handling.

This is cumulative and keeps the v2.11.68 Departments / Positions / Users setup hub.
