Safety Tracker v2.11.25 CLEAN — ADMIN APPROVAL + STABILITY

USE THIS PACKAGE INSTEAD OF v2.11.24 IF v2.11.24 HAS NOT BEEN UPLOADED YET.
If v2.11.24 is already live, this package carries its fixes forward.

ADMIN APPROVAL RULE
Any full Admin may approve/review any SCOPED controlled document or Toolbox Talk.

The H&S Manager / Department Manager / responsible-position setting is for:
- ownership;
- reminders;
- review responsibility;
- follow-up;
- reporting.

It no longer blocks an Admin from approving the document.

The app will now show:
"Admin approval: Any Admin may approve or review this controlled document..."

SCOPE STILL REQUIRED
A controlled document still needs a valid audience/scope:
- Everyone / whole hotel, or
- relevant Department(s)/audience.

This is not an approval-permission restriction; it is required so Safety Tracker knows
who the document/training applies to.

STABILITY CARRIED FORWARD
v2.11.24 freeze repairs remain included.

ADDITIONAL STABILITY REPAIR
The legacy v2.10.90 approval module has its own modalBody MutationObserver which rewrites
the approval hint inside its callback. v2.11.25 loads a lightweight governor BEFORE that
legacy module so its self-created mutations cannot form a feedback loop.

No SQL required.

UPLOAD / REPLACE ALL FILES IN THIS ZIP AT THE REPOSITORY ROOT.
Then fully close/reopen Safety Tracker so old observers from the previous page session are gone.
