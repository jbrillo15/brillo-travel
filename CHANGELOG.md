# Changelog

Versions follow semantic versioning. 0.x during the build; 1.0.0 is the trip
release. The version here must match `js/config.js` and the service worker
cache name (a unit test checks this).

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
