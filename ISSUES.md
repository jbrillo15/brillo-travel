# Issues

Severity (HANDOFF §12): **P0** blocks trip use, loses or corrupts data, or the
allergy card is wrong or unreachable · **P1** core flow broken, no workaround ·
**P2** wrong but has a workaround, or confusing · **P3** cosmetic.

Zero open P0/P1 is required for every release.

| ID | Sev | Found in | Summary | Steps to reproduce | Status | Fixed in |
|---|---|---|---|---|---|---|
| I-1 | P1 | spike-1, iOS 18.1.1 | Google Maps transit-directions link (AC-I2) marked as not working | Spike L1 → Open | Open: needs a description of what happened, then a retest | — |
| I-2 | P2 | spike-1, iOS 18.1.1 | `googletranslate://` app link didn't switch apps; app presence unknown | Spike L4 → Open | Open: retest with the app installed; website fallback works | — |
| I-3 | P3 | spike-1 | Spike page blamed a later relaunch on the last link tapped (`tel:` prompt never hides the page), so L10 showed a false "reloaded" | Spike L10 → Cancel → force-quit within 15 min → reopen | Fixed; L10 needs a retest | spike-2 |
| I-4 | P2 | O-12 data check | APA's only listed phone is a 0570 Navi Dial number, which may not connect from a US phone or data-only eSIM | Hotel card → call | Open: hotel card shows a hint (Phase 1) | — |
