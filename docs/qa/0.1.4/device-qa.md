# Device QA: v0.1.4 (staging)

HANDOFF §12 L5, second phone. Jordan's phone (iOS 18.1.1) ran 0.1.2 on Oct 15 (`docs/qa/0.1.2/device-qa.md`).

| | |
|---|---|
| Phone | Lindsay's iPhone |
| iOS | 27.0.1 (Safari reports the frozen `iPhone OS 18_7` user agent) |
| App | v0.1.4, script 0.2.0 (redeployed the same evening; the 0.1.4 app reads it unchanged), staging |
| Date | Oct 20, 2026, about 9:50–10:00 PM PT |
| Mode | Home-screen app, fresh install |

**How it was run:** Lindsay followed the 39-step install and QA list, with Jordan doing the sheet edit for steps 22–24. Results came back through Jordan as exceptions only: one note (step 31), the step 14 answer, her iOS version and the spike results. The other steps had no problem reported. There were no per-step notes or screenshots.

| ID | Check | Result | Notes |
|---|---|---|---|
| DQ-01 | Add to Home Screen; opens full-screen; correct icon and name | Pass | Steps 1–5; spike S1 also passes |
| DQ-02 | Paste setup code inside the installed app; pick phone owner | Pass | Steps 6–11; spike S4 passes |
| DQ-03 | Force-quit, airplane mode, reopen: everything renders | Pass | Steps 20–21; spike S2 (3 opens, persistent storage granted) and S3 (offline, controlled by the worker) pass |
| DQ-04 | Offline expenses and ticks on both phones | Not run | Needs v0.2.0 on both phones |
| DQ-05 | Same checklist item toggled offline on both phones | Not run | Needs v0.2.0 on both phones |
| DQ-06 | Edit in the Google Sheets app; the phone updates | Pass | Steps 22–24: Jordan's " TEST" edit showed after Sync now. One phone; Jordan's phone not rechecked |
| DQ-07 | Captive portal / dead endpoint | Pass (dead network only) | Step 21 with Airplane Mode on. A real captive-portal Wi-Fi comes later (stubbed EC-20 tests cover it) |
| DQ-08 | Directions, Translate, GO, phone links open and return | Pass, one known limit | Step 31: Directions opened Google Maps on the web, which said no routes were available. That's expected from the US: the link routes from the current location, and a transit route only shows once in Japan (spike run 1, L1). Steps 32–33 returned with no problem reported. Spike: L1–L3 and L5–L10 pass; **L4 (Translate app) failed**, likely because the Translate app isn't installed yet (see follow-ups) |
| DQ-09 | Allergy and hotel cards legible; wake lock or brightness hint | Pass | Steps 17–18; spike S9 wake lock passes |
| DQ-10 | Large Text, Bold Text, Low Power Mode, cellular only | Pass | Steps 25–30: no problem reported |
| DQ-11 | New version → "Update available" → update keeps queued ops | Not run | Runs with the 0.2.0 push (the E2E update-prompt test passes) |
| DQ-12 | Location allowed and denied on Nearby | Not run | Nearby arrives in v0.4; spike S7 got a fix (11 m, 1.4 s) |
| DQ-13 | Japanese audio offline | **Watch** | Spike S8: no Japanese voices listed, though playback finished. Recheck before v0.4 (phrases) |
| DQ-14 | At least 5 GB free | Pass (this phone) | Spike S2 quota about 39 GB |

**Step 14 (✈ on the white disc):** plain black, not a color emoji, so no SVG plane is needed for iOS 27.

**Issues found:** none new in the app. Follow-ups: the Translate app (L4) and Japanese voices (S8), both in `docs/spikes.md`.
