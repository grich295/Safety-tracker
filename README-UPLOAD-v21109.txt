Safety Tracker v2.11.9 CLEAN — USER ACCESS PREFERENCES

DATABASE
The migration `safety_v2119_user_access_preferences` has ALREADY BEEN APPLIED.
Do not run SQL manually.

UPLOAD TO REPOSITORY ROOT
1. hotfix-v21109-user-access-preferences.js   NEW
2. config.js                                  REPLACE
3. version.json                               REPLACE

WHAT CHANGES
- Edit user now shows Access preferences based on the selected role.
- Normal User / Manager access is the starting point.
- Admin can change only that person's exceptions.
- Reset to role defaults button.
- Core pages cannot be removed:
  My Safety / Training / H&S Training / Help.
- User role can be given these supported extras:
  Documents
  Asbestos Lookup
- Explicit Asbestos Lookup access works even when that named User is not in
  Maintenance. It grants lookup/evidence access only, not Manager/Admin rights.
- Manager role can have individual manager screens hidden without changing role.
- People cards show "Custom access" when a user differs from role defaults.
- Fixes the missing set_user_view_preferences_v21022 database RPC.
- Adds Checklists correctly to the preference set.

TEST
Admin -> People -> Edit user.
Choose User or Manager and review Access preferences.
Turn on one extra for a User, save, then sign in as that account.
