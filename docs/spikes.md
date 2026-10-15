# Phase 0 spikes

HANDOFF §14 (Phase 0) requires each iPhone capability the app depends on to
pass or have a documented workaround before Phase 1. The test page is
`spike/` (live on staging Pages at `/brillo-travel-staging/spike/`). It records
results in IndexedDB and exports them with "Copy results"; nothing secret is
included.

## Runs

| Run | Phone | iOS | Mode | Date | Result |
|---|---|---|---|---|---|
| 1 | Jordan | 18.1.1 (22B91) | Home-screen app | Oct 14, 2026 | 16 of 18 marked pass. L1 failed (cause unknown), L4 inconclusive, L10 needs a retest (spike bug, see below) |
| 2 | Jordan | 18.1.1 | Home-screen app | after spike-2 is pushed | **Not run yet:** retest L1, L4 and L10 |
| 3 | Jordan | 26.x | Home-screen app | after the iOS update (O-2) | **Not run yet** (EC-40) |
| 4 | Lindsay | 26.6.2 | Home-screen app | when she's back | **Not run yet** |

Local check before the phone run (browser pane, `http://localhost:8787`, Oct 14):
the service worker took control, the page reloaded with the server stopped,
IndexedDB kept its counter across reloads, bad and prod setup codes were
rejected with plain messages, a failed POST reported "Network error" without
hanging, and there was no horizontal scroll at 375 px. The live POST was tested
on the phone only, because the token never goes into the browser pane.

## Results, run 1 (Jordan, iOS 18.1.1)

| ID | Capability | Result | Detail (from the copied results) | Decision for Phase 1 |
|---|---|---|---|---|
| S1 | Install, standalone | Pass | Full-screen from the home-screen icon | As specified (DQ-01) |
| S2 | IndexedDB survives force-quit | Pass | 2 opens recorded with the first-open time kept; `storage.persist()` granted; quota about 39 GB | As specified (EC-32) |
| S3 | Offline service worker | Pass (marked by Jordan) | Shell cached, page controlled by the service worker; Jordan marked it after opening in airplane mode | As specified |
| S4 | Paste setup code inside the installed app | Pass | Saved; the box clears so the code never stays on screen | As specified (EC-30). Keep the self-clearing box |
| S5 | POST to Apps Script from Pages | Pass | Correct token: `ok`, `env=staging`, 1.8 s. Japanese and emoji intact. Wrong token: `AUTH`, 1.1 s | As specified. Text/plain POST with redirect follow works |
| L1 | Maps transit directions (`/maps/dir/?api=1…&travelmode=transit`) | **Fail** | Returned without a reload. What it showed isn't recorded | Pending Jordan's description, then retest |
| L2 | Maps search (`/maps/search/?api=1`) | Pass | Returned without a reload | As specified |
| L3 | Maps place link | Pass | Returned without a reload | As specified |
| L4 | Translate app scheme `googletranslate://` | **Inconclusive** | Marked "Didn't"; no app switch was recorded. Unknown whether the Translate app is installed | Retest with the app installed (the offline pack needs the app, D9). Until then the website link is the fallback |
| L5 | Translate website | Pass | Returned without a reload | Fallback |
| L6 | GO website `go.goinc.jp` | Pass | Opened; whether it hands off to the GO app is unknown (app presence not recorded) | Use it, with the App Store page as fallback |
| L7 | GO App Store page (`id1254341709`) | Pass | Returned without a reload | Fallback |
| L8 | Tokyo Disney Resort website | Pass | Same caveat as L6 | Use it |
| L9 | TDR App Store page (`id1313147771`) | Pass | Returned without a reload | Fallback |
| L10 | `tel:` link | Pass, **reload result unreliable** | Marked pass. The "page reloaded" note is most likely a spike-1 bug: the call prompt never hides the page, so the pending note stayed until the force-quit relaunch in the S3 test, which then got logged as an L10 reload. Only 2 opens were recorded, which fits that explanation | Fixed in spike-2 (marking a link clears its note). Retest L10 alone |
| S7 | Geolocation | Pass | First fix 5.1 s at 8 m; second request answered in 5 ms (cached position) | As specified (timeout 8 s, `maximumAge` 60 s). Whether iOS re-prompts across launches (EC-35) is still untested |
| S8 | ja-JP speech | Pass | Japanese voices present (Kyoko and others); playback finished | As specified; hide the button when no `ja` voice (AC-C3) |
| S9 | Screen wake lock | Pass (marked by Jordan) | Lock released after 2 min. Only meaningful if Auto-Lock was set shorter than 2 min; not recorded | Recheck on iOS 26; keep the brightness hint as fallback (EC-37) |

## Open follow-ups

1. **L1:** find out what the transit-directions link did (wrong app, web page, no transit mode, or nothing), then choose a fix: drop `travelmode`, use `comgooglemaps://` if the Maps app is installed, or fall back to the search link.
2. **L4 and L10:** retest on spike-2. For L4, note whether Google Translate is installed.
3. **Repeat on iOS 26** (Jordan, after O-2) and on **Lindsay's phone**, noting the Auto-Lock setting for S9.
4. **GO and Tokyo Disney Resort app hand-off:** retest L6 and L8 with both apps installed, **before the Nov 11 freeze** (Appendix A currently schedules the installs for Nov 13).
