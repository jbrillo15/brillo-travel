# Fixing Brillo during the trip (no laptop)

For a **Claude Code cloud session** started from the Claude mobile app while
we're in Japan. That session works on a fresh copy of this GitHub repo. It
does **not** have the Mac's private notes, ship checks, secrets or the sheet
connectors, so this file is its whole brief. The repo is public: nothing here
names bookings, sheets or accounts, and nothing you commit may either.

## 1. First, decide what kind of change it is

| Problem | Fix | Code? |
|---|---|---|
| A time, place, booking or list item is wrong | Edit the Google Sheet in the Sheets app. Phones pick it up on the next sync (open the app or tap **Sync now**) | No |
| The app is broken: it won't open, won't sync, or shows the wrong day (**P0**) | Code fix, this file | Yes |
| A screen is wrong or awkward but the app works (**P1/P2**) | Write it down for after the trip | No |
| The sheet's Apps Script needs a change | Don't, from a phone. Use the Sheets app and the printed fallbacks | — |

**Trip rule:** only P0 fixes during the trip, and only when Jordan says yes in
the chat. Sheet data is not the cloud session's job; it has no access to it.

## 2. Rules for the cloud session

1. **Ask Jordan before every push.** Show him the diff summary in plain words first.
2. **Commit identity:** before the first commit, run
   `git config user.name jbrillo15` and
   `git config user.email 255970211+jbrillo15@users.noreply.github.com`.
   Check `git log --format='%an <%ae>'` before pushing.
3. **No trip data in commits:** no booking numbers, hotel names, addresses,
   phone numbers, sheet links, email addresses, tokens or script URLs. Test
   fixtures use fake values. Scan the diff before every push.
4. **Smallest possible change.** No refactors, no new features, no design changes.
5. **Version bump:** every release changes `js/config.js`, the `VERSION` in
   `sw.js` and the top entry of `CHANGELOG.md` to the same patch version
   (for example 0.3.1 → 0.3.2). Phones only offer the update when it changes.
6. **Never touch `server/Code.gs`** in a trip fix. The live script can't be
   redeployed from a phone, and the app checks that it's compatible with the script.
7. **Staging first, then the real site.** See §3.

## 3. Steps

1. Reproduce the problem from Jordan's description and find the cause in the code.
2. Fix it and bump the patch version (rule 5).
3. Check every changed `.js` file parses: `node --check <file>`, if Node is there.
4. If the cloud machine has a headless browser, open `tests/tests.html` and
   `tests/e2e.html` and read `window.__TEST_RESULTS__`. If not, say so plainly.
   The phone check in step 6 is the real test.
5. Ask Jordan, then push to the **staging** repo
   (`jbrillo15/brillo-travel-staging`, branch `main`). Pages publishes in about
   a minute.
6. Jordan opens **Brillo TEST** (the icon with the orange ribbon), taps
   **Update** when it appears, and checks that the problem is gone.
7. Ask Jordan, then push the same commit to the **real** repo
   (`jbrillo15/brillo-travel`, branch `main`).
8. Both phones open **Brillo** and tap **Update**.

**Roll back:** `git revert <commit>`, bump the version again, and push to
both repos. Phones tap **Update**. Data lives in the sheet, so nothing is lost.

**If Brillo itself is gone or broken on a phone:** see RUNBOOK B8. Re-add it
from the real site and paste the setup code saved in the Passwords app.

## 4. Before the trip: set-up and a practice run (by Nov 11)

1. In the Claude app, connect GitHub and give it access to **both** repos
   (`brillo-travel-staging` and `brillo-travel`).
2. Create a cloud environment for the staging repo. Check that a cloud session
   can push to both repos.
3. **Practice run, from the phone only:** start a cloud session, point it at
   this file, and ask for a harmless change on staging (for example, a
   CHANGELOG wording fix with a patch bump). Check that **Brillo TEST** offers the
   update and shows the new version under Info → Settings. Don't push the
   practice change to the real site.
4. Note anything that didn't work in this file, so the trip version is right.
5. Keep **Brillo TEST** on Jordan's phone through the trip. It's the only way
   to check a fix before the real app gets it.
