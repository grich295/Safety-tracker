Safety Tracker v2.11.13 CLEAN — CRASH STABILITY AUDIT REPAIR

AUDIT FINDINGS
1. v2.10.91 has a broad BODY MutationObserver whose callback rewrites
   reportScopeCardV21091 / peopleFiltersV21091 with innerHTML. That creates a new
   child mutation and can schedule itself again indefinitely.
2. v2.10.94 observes reportsView subtree and its callback rewrites
   reportScopeCardV21094 with innerHTML. This is another definite feedback loop.
3. v2.11.8 observes appView; when an asbestos stop warning is present it removes
   and recreates the warning, creating another observer cycle.
4. Many other additive builds use BODY/appView observers. Individually most
   stabilise after one decoration, but together they multiply work on every DOM change.
5. The previous config started every hotfix at DOMContentLoaded before the core app
   was guaranteed to exist. Each module then ran its own 120 ms boot polling timer.
6. v2.11.12 globally replaced window.scrollTo/window.scroll and
   Element.prototype.scrollIntoView. This was a symptom guard, not a good long-term
   fix, so v2.11.13 no longer loads it.

WHAT v2.11.13 DOES
- Loads the additive hotfix chain sequentially only after SafetyTrackerV2 and the
  baseline navigation are ready.
- Loads the runtime stability governor first.
- Broad BODY/appView/reportsView child-list observers are debounced and their own
  delayed DOM mutations are suppressed so they cannot self-loop.
- Narrow/specific observers continue normally.
- Keeps all existing feature hotfixes through v2.11.11.
- Does NOT load v2.11.12.
- Records up to 30 JavaScript errors/unhandled rejections locally in this browser.
- Build Diagnostics shows that runtime stability protection is active.

UPLOAD
1. hotfix-v21113-runtime-stability.js   NEW
2. config.js                            REPLACE
3. version.json                         REPLACE

NO SQL REQUIRED.

TEST
- Reopen the app after deployment.
- Leave the Management screen open and scroll around for at least 30 seconds.
- Open People -> Edit user, save an access change.
- Open Reports, then return to Management.
- Open Asbestos Lookup and select a location with a warning if available.
- The app should not continuously jump, freeze or crash.

If an ordinary JavaScript error still occurs, Admin -> Build Diagnostics will now
retain a local error count that can be used for the next targeted repair.
