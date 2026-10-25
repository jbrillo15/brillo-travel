# PROD smoke test: v0.2.1

RUNBOOK B7 (first PROD setup). Both phones, script 0.2.1, prod.

| | |
|---|---|
| Phones | Jordan's iPhone, Lindsay's iPhone |
| App | v0.2.1 (`ccb6078`), script 0.2.1 (first prod deployment), prod |
| Date | Oct 25, 2026, about 11:50 AM PT |

| ID | Check | Result | Evidence |
|---|---|---|---|
| B7 13a | Pasted script matches the repo | Pass | SHA-1 of `Code.gs` and `Parse.gs` in the editor matched `server/Code.gs` and `js/parse.js` (compared in the page) |
| B7 30 | Site serves the release; private files stay private | Pass | `js/config.js` and `sw.js` byte-identical to the repo; HANDOFF.md, STATUS.md, NEXT-AGENT.md and private/ return 404 |
| B7 32 | Settings on each phone | Pass | Both phones: prod, app 0.2.1, script 0.2.1, no Data health errors |
| DQ-03 / DQ-04 (B7 33) | Tick on one phone shows on the other after Sync now; untick the same way | Pass | One Pre-trip item ticked on Jordan's phone, seen ticked on Lindsay's after Sync now, then unticked and seen unticked |
| B7 34 | Sheet read-back (read only) | Pass | Every row with content in the synced tabs now has an ID (Phrases has no rows yet). The test item reads Done FALSE, blank Done by, Updated at today. `_SyncLog` has 2 ops from `jordan-iphone`, both `applied`. Compared with the backup taken at the start of B7, the only changes are the new ID cells, that row's Updated at, and the 2 `_SyncLog` lines. The old tabs are unchanged |

Notes:
- The new-deployment dialog failed twice ("Something went wrong") with two Google accounts signed in to Chrome. It worked in an Incognito window signed in to one account.
- Apps Script's project list lagged behind the rename; the project opens reliably from the sheet's Extensions → Apps Script.
