# Device QA: v0.1.2 (staging)

HANDOFF §12 L5. One phone so far; the second phone (iOS 26.x) runs when its owner is available.

| | |
|---|---|
| Phone | Jordan's iPhone |
| iOS | 18.1.1 (22B91). Stays on this version for the trip (no storage to update) |
| App | v0.1.2, script 0.1.0, staging |
| Date | Oct 15, 2026 |
| Mode | Home-screen app, fresh install |

**How it was run:** Jordan followed a 35-step checklist (install, setup, Cards, Trip, Settings version, hotel card, force-quit + airplane mode, then the spike retest). He reported the app run as a whole: "it worked and went well." There are no per-step notes and no screenshots, and the Settings version line wasn't reported separately.

| ID | Check | Result | Notes |
|---|---|---|---|
| DQ-01 | Add to Home Screen; opens full-screen; correct icon and name | Pass | Checklist steps 5–9 |
| DQ-02 | Paste setup code inside the installed app; pick phone owner | Pass | Steps 10–13: owner picked, code pasted, synced |
| DQ-03 | Force-quit, airplane mode, reopen: everything renders | Pass | Steps 20–22 |
| DQ-04 | Offline expenses and ticks on both phones | Not run | Needs the write path (v0.2+) and a second phone |
| DQ-05 | Same checklist item toggled offline on both phones | Not run | Needs v0.2+ and a second phone |
| DQ-06 | Edit in the Google Sheets app; both phones update | Not run | Later pass, with the second phone |
| DQ-07 | Captive portal / dead endpoint | Not run | Covered by stubbed tests (EC-20); device run later |
| DQ-08 | Directions, Translate, GO, phone links open and return | Partial pass | From the spike page, same phone: L1 transit route from Kyoto Station shows (Oct 15), L4 Translate app opens, L10 `tel:` returns without a reload (spike-2), L2/L3/L5–L9 pass (Oct 14). Not yet tapped from inside Brillo itself |
| DQ-09 | Allergy and hotel cards legible; wake lock or brightness hint | Pass | Steps 14 and 19: allergy card in its "not set up" state with the label words; Kyoto hotel card in Japanese. Arm's-length legibility judged by Jordan, not measured |
| DQ-10 | Large Text, Bold Text, Low Power Mode, cellular only | Not run | Phase 4 hardening |
| DQ-11 | New version → "Update available" → update keeps queued ops | Not run | Needs v0.2+ (outbox). The banner itself was seen in the browser pane (0.1.0 → 0.1.2) |
| DQ-12 | Location allowed and denied on Nearby | Not run | Nearby arrives in v0.4 |
| DQ-13 | Japanese audio offline | Not run | Phrases arrive in v0.4 (spike S8 passed online) |
| DQ-14 | Jordan's phone on its final iOS; at least 5 GB free (EC-40) | **Fail (known)** | Final iOS is 18.1.1 by decision. Free space is under 5 GB, so iOS may clear the app's storage (EC-32). Must be fixed before v0.2 starts queuing writes |

**Issues found:** none new.
