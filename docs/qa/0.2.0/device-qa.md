# Device QA: v0.2.0 (staging)

HANDOFF §12 L5, write path. Both phones, script 0.2.0, staging.

| | |
|---|---|
| Phones | Jordan's iPhone (iOS 18.1.1), Lindsay's iPhone (iOS 27.0.1) |
| App | v0.2.0 (`f58fd12`), script 0.2.0 (deployment version 4), staging |
| Date | Oct 20, 2026, about 10:08–10:11 PM PT |

## Run 1

Both phones updated to 0.2.0 through the in-app Update button. Both reported "all tests passed". The sheet and `_SyncLog` were checked afterward.

| ID | Check | Result | Evidence |
|---|---|---|---|
| DQ-04 (ticks) | 3 ticks per phone, then the sheet has exactly 6 changed rows and both phones match | **Partial: sync correct, offline not exercised** | Checklists: exactly the 6 Packing rows are ticked, each with the right Done by and Done at. `_SyncLog`: 6 `applied` lines, one per op, no duplicates. But every op reached the script 2–8 s after its tap (the client time is in the opId), so neither phone was offline. Most likely Wi-Fi stayed on under Airplane Mode (iOS remembers it) |
| DQ-05 | Same item on both phones; the later change wins on both | **Partial: outcome correct, out-of-order case not exercised** | Walking shoes: Lindsay ticked (10:10:31 PT) and unticked (10:10:35), Jordan ticked (10:10:43), then Lindsay unticked (10:11:18). All 4 were `applied` in time order, the final state is unticked on both phones and in the sheet, and Updated at is 10:11:18. Because both phones were online, no older op arrived after a newer one, so the `stale` path didn't run on a device. That path passes in live L2 and the unit tests |
| DQ-11 | Update keeps queued ops | Partial | Both phones updated 0.1.4 → 0.2.0 with the Update button. There were no queued ops at the time (0.1.4 has no outbox); covered by the E2E update-prompt test |
| DQ-14 | At least 5 GB free | Jordan: open | Blocks PROD |

## Run 2: pass

About 10:16–10:19 PM PT, with Airplane Mode **and Wi-Fi off** (Offline pill confirmed on both phones). Both phones unticked their three backpack items offline, reopened the app, and saw the changes kept. Lindsay ticked the shoes; 30 s later Jordan ticked and unticked them. Jordan reconnected first, Lindsay about 30 s later.

| ID | Check | Result | Evidence |
|---|---|---|---|
| DQ-04 (ticks) | Offline changes on both phones; the sheet has exactly the changed rows and both phones match | **Pass** | Jordan's ops were made at 10:16:41–10:17:56 and reached the script at 10:18:10; Lindsay's were made at 10:16:45–47 and reached it at 10:18:39. So they waited on the phones and went in one batch each. All 6 backpack rows are unticked, with Updated at set to each tap time. `_SyncLog` has one line per op and no duplicates. (Jordan also ticked and unticked a charger row: 2 ops, final unticked) |
| DQ-05 | Same item on both phones; the later change wins on both | **Pass** | Jordan's untick (10:17:56) reached the sheet first. Lindsay's older tick arrived 30 s later and came back **`stale`**, so it changed nothing. The shoes are unticked in the sheet and on both phones |
| AC-L1 | A change shows on the other phone | Pass, with a lag | Jordan's phone still showed Lindsay's three ticks until his next sync: it had pulled at 10:18:10, before her changes arrived. After Sync now, everything matched. Phones refresh on open, on returning to the app, on Sync now, or every 5 minutes, so another phone's change can take up to 5 minutes to show |

**Result:** the write path works on both phones. DQ-04 (ticks) and DQ-05 pass. The expenses half of DQ-04 comes with Budget (v0.3.0).
