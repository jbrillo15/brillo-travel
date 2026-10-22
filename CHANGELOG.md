# Changelog

Versions follow semantic versioning. 0.x during the build; 1.0.0 is the trip
release. The version here must match `js/config.js` and the service worker
cache name (a unit test checks this).

## 0.2.1 (staging)

Fixes from the Oct 21 production-readiness check, before the first PROD release.

- **Adding a list item and saving an edit work again.** Add item did nothing and Save on the edit screen did nothing, on every browser. The tests filled the field in a way that hid it; they now type into the real fields.
- **A setup code only works on its own site.** The test app (STAGING) refuses the real-trip code and says to open the other Brillo icon, and the real-trip app refuses a test code, so test builds can never write to the real sheet. A pointer saved before this change is ignored.
- **The edit screen keeps what you typed.** A background sync, or switching to another app and back, no longer redraws the form and loses unsaved text.
- If the item was deleted on the other phone while its edit screen was open, Save now says so instead of doing nothing.
- **Save sends only what you changed.** It no longer sends back an older name when the other phone renamed the item meanwhile, and no longer blanks an owner, bag or due date the form can't show.
- Script 0.2.1: a change is refused (it shows under Sync issues) when a column it writes is missing or renamed, instead of being dropped while reporting success. Before writing, the script re-checks that the row still holds the item's ID, and checks again between the parts of one change, so someone sorting the tab at that moment can't put it on the wrong row. Only the changed cells are written.

## 0.2.0 (staging)

- **Lists:** the Pre-trip, Packing, Departure day and Return packing checklists from the sheet, shared by both phones. Tap a row to tick it; add items, edit owner, bag, due date and notes, or delete one (it stays in the sheet, marked Deleted). Packing can be grouped by bag with a count per bag. Overdue items are marked in amber, and overdue Pre-trip items show on Today, where they can be ticked.
- **Changes work offline.** Every change is saved on the phone first and shows at once, marked "Waiting to sync". Brillo sends queued changes, then fetches the sheet, a couple of seconds after a change and at every usual sync. Changes are never dropped on their own: one the sheet refuses waits under Sync issues until you retry or discard it.
- If both phones change the same item, the later change wins on both.
- While the app and the sheet's script don't match, nothing is sent, and that state is remembered after the app closes. With a script older than 0.2.0, changes wait on the phone with a banner saying so.
- The sync line counts queued changes ("2 changes waiting", "Offline · 2 changes saved on this phone").
- Script 0.2.0: writes (`mutate`) with each change applied once, the newest edit winning, rows found by ID, and text always stored as text. `resetStaging` clears only the live tests' own rows.

## 0.1.4 (staging)

- Today: the day line ("Day 2 of 8 · Osaka") moves under the greeting on one full line, so it no longer wraps beside the station mark.
- A day in a city without a line color (say a Nara day trip) gets its initial in a gray ring instead of the blue travel-day badge, so blue means travel days only.
- Before and after the trip, the header mark is announced as "Trip starts Nov 18" or "Trip complete" instead of "Travel day".
- The station letter is lighter than the day number, so Osaka's "O" never reads as a zero.
- The yen pictogram shows a ¥.

## 0.1.3 (staging)

- New look, design 0.5 "Metro", based on Tokyo and Osaka Metro signs: a neutral charcoal shell, city colors from real rail lines (Osaka Sennichimae pink, Kyoto Karasuma green, Tokyo Hanzomon purple, Shinkansen blue for travel days), flat panels with hairlines and a faint city light at the top.
- Station marks: each day's badge is a white disc ringed in the line color, with the city's initial over the day number (K 03). Trip shows each city's name in Japanese too.
- The day is drawn as a metro map: a thick line with white stations, gold for Now. Now / Next is a flat panel with a gold top band.
- Solid pictograms on line-color tiles, in the style of Japanese public signs; all 29 redrawn.
- Type is Avenir Next, built into iPhone. No web font downloads.
- The screen entrance animation is new; nothing animates continuously.

## 0.1.2 (staging)

- If the sheet's script speaks a different API version than the app, Brillo keeps showing the saved plan, says which side needs updating ("App and sheet don't match"), and stops retrying until the next normal sync (HANDOFF §13). Settings shows the script's version next to the app's.
- Stronger tests: no skipped or repeated trip day across the flight and the zone switch, no app file reading the phone's own time zone, Today re-deriving after midnight on return (EC-04); merged cells and formula results (EC-13); a second snapshot during ID assignment (EC-17).
- RUNBOOK: token rotation (B4) written out with `tools/rotate_token.py`; phone setup (B5) and script deploy (B6) split to one action per step, with the UTF-8 copy fix.

## 0.1.1 (staging)

- After a successful setup-code paste, the "Setup code needed" banner no longer lingers until the next screen change. Found in the first live end-to-end check.

## 0.1.0 (staging)

Phase 1, the read path (HANDOFF §14).

- Installable home-screen app shell with an offline service worker. Updates wait until you tap Update.
- Setup by pasting a setup code inside the installed app; "Whose phone is this?".
- Pull-only sync from the sheet, with a status line, a Sheet problem banner, and Data health.
- Today: before the trip (countdown, next pre-trip items, packing progress, to-book items), travel day (flights with zones and layover), in trip (Now / Next, the day as a train line, tonight's hotel, Route home after 6 PM), after the trip (summary).
- Trip: day list, day detail, item detail with transit Directions, taxi card and booking ref.
- Cards: allergy card (not-set-up state until the verified text is in the sheet), hotel card in Japanese with +81 dialing, taxi card, booking refs grouped in fours. Wake lock or a brightness hint.
- Info (basic) and Settings, with staging-only Developer tools (simulated Japan time, reset local data).
- Script: snapshot with ensureIds under the script lock; the V-01 to V-12 checks are shared with the phone through `js/parse.js` (deployed as `Parse.gs`).
- Lists, Budget and Nearby show what's coming in v0.2 to v0.4.

## Earlier (Phase 0)

- Phase 0: project scaffold, RUNBOOK, ISSUES log.
- Staging secrets moved from `local/secrets.json` to `~/.config/brillo-travel/secrets.json` (root CLAUDE.md: no secrets under Desktop). README and RUNBOOK updated.
