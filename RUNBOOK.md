# Runbook

Step-by-step instructions for the things only Jordan does: accounts, passwords,
tokens and deployments. The builder never types a password or token into any
site (HANDOFF §11). Each step says what to send back to the builder, and
none of those things is a secret.

**Never paste a token into chat.** Tokens go into Script Properties, the
macOS keychain, or `~/.config/brillo-travel/secrets.json`, and nowhere else.

---

## Part A · One-time setup (Phase 0)

### A1. GitHub account ✅ (Oct 13: using Jordan's personal account `jbrillo15`)

1. ~~Create an account~~ Using the existing personal account `jbrillo15`.
2. Turn on two-factor authentication if it isn't already (Settings → Password and authentication).
3. **Hide your email from public commits:** Settings → **Emails** → tick **Keep my email addresses private** and **Block command line pushes that expose my email**. ✅ Noreply address received Oct 13.

**Send the builder:** that `…@users.noreply.github.com` address. It goes on every commit, so your real email never appears in the public repo.

### A2. Create the two repositories

Do this twice, once for each name:

| Repo name | Purpose |
|---|---|
| `brillo-travel-staging` | test copy; phones point here until v0.2 |
| `brillo-travel` | the real app |

1. Top-right **+** → **New repository**.
2. Owner `jbrillo15`, name as above, **Public**.
3. **Leave everything else unticked:** no README, no .gitignore, no license. (The builder pushes those.)
4. **Create repository.**

GitHub Pages gets switched on in A7, after the first push, because it needs files to exist first.

### A3. Create a personal access token so git can push

This is the password git uses. It's scoped to just these two repos.

1. GitHub → your avatar → **Settings** → **Developer settings** (bottom of the left menu) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Name: `brillo-mac`. Expiration: **Custom → Jan 31, 2027** (past the trip).
3. Repository access: **Only select repositories** → pick `brillo-travel` and `brillo-travel-staging`.
4. Permissions → Repository permissions → **Contents: Read and write**. (Metadata: Read-only gets added automatically.)
5. **Generate token.** Copy it. GitHub shows it only once.
6. Store it: the builder will give you one `git push` command to run in a Terminal tab. When it asks:
   - Username: `jbrillo15`
   - Password: **paste the token** (nothing appears as you paste; that's normal)

   macOS saves it in your keychain, so you won't be asked again.

**Send the builder:** "token stored." (Not the token.)

### A4. Make the staging copy of the sheet

1. Open **JAPAN 2026** in a browser on your Mac.
2. **File → Make a copy.** Name: `JAPAN 2026 — STAGING`. Folder: your own Drive. Leave "share with the same people" **unticked**.
3. Open the copy. Check the title bar says STAGING. **From here on, everything in A5–A6 happens in the STAGING copy.**

**Send the builder:** the staging sheet's link. (The builder reads it to propose the new tab layout. It never writes to Lindsay's real sheet without your OK and a backup.)

### A5. Generate the staging API token

In the Terminal panel, run:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))" | pbcopy
```

That copies a random 43-character token to your clipboard without showing it. Use it right away in A6.

### A6. Deploy the spike script to the STAGING sheet

This tiny script (`server/spike.gs`) proves the app can talk to the sheet. The real one replaces it in Phase 1.

1. In the **STAGING** sheet: **Extensions → Apps Script**.
2. Delete whatever is in `Code.gs`, paste the full contents of `server/spike.gs`, click **Save** (disk icon).
3. Left sidebar → **Project Settings** (gear) → scroll to **Script Properties** → **Add script property**:
   - `API_TOKEN` = paste the token from A5
   - `ENV` = `staging`
   - **Save script properties.**
4. Top-right **Deploy → New deployment** → gear next to "Select type" → **Web app**.
   - Description: `spike`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. **Deploy** → **Authorize access** → choose your Google account → if you see "Google hasn't verified this app," click **Advanced → Go to (project name) (unsafe)**. That warning appears because you wrote the script yourself; it's expected.
6. Copy the **Web app URL** (ends in `/exec`).
7. Save the URL and token on your Mac only. In the Terminal panel, run:

```bash
open -e ~/.config/brillo-travel/secrets.json
```

   TextEdit opens a template. Replace the two `PASTE …` placeholders (keep the quotes), then save and close. This file lives outside the project folder, so it never reaches GitHub or iCloud.

**Send the builder:** "spike deployed."

### A7. Turn on GitHub Pages (after the builder's first push)

For each repo: **Settings → Pages** → Source **Deploy from a branch** → Branch **main**, folder **/ (root)** → **Save**. After a minute the site is live at:

- `https://jbrillo15.github.io/brillo-travel-staging/`
- `https://jbrillo15.github.io/brillo-travel/`

---

## Part B · Recurring procedures

*Filled in as each phase lands. Stubs below so nothing is forgotten.*

### B1. Back up the real sheet (before every release that changes the script or the schema, and before the first prod write)

1. Open **JAPAN 2026** → **File → Version history → Name current version** → e.g. `Before Brillo v0.2`.
2. **File → Make a copy** → `JAPAN 2026 — backup YYYY-MM-DD` (today's date). Don't share it.

### B2. Redeploy an Apps Script change (keeps the same URL)

**Deploy → Manage deployments** → pencil (Edit) → Version: **New version** → **Deploy**. Never use "New deployment" for an update; that creates a new URL and every phone would need a new setup code.

### B3. Roll back

- *Script:* Manage deployments → Edit → pick the previous version → Deploy.
- *Front end:* the builder re-pushes the previous release with a bumped patch number, so phones get a normal "Update available."
- *Data:* File → Version history → open the named version → **Restore this version**, or copy tabs back from the backup copy.

### B4. Rotate the token

Do this if a setup code leaks (sent to the wrong person, left in a thread) or a
phone is lost. Until each phone pastes the new code it shows "Setup code
needed"; its saved plan stays on the phone (EC-26).

1. In the Terminal panel run `python3 ~/Desktop/Claude/Projects/Personal/brillo-travel/tools/rotate_token.py` (add `prod` at the end for the real sheet). It saves the new token and copies it without showing it.
2. Open the sheet (STAGING or the real one).
3. Click **Extensions → Apps Script**.
4. In the left sidebar, click **Project Settings** (the gear).
5. Scroll to **Script Properties** and click **Edit script properties**.
6. Click into the `API_TOKEN` value box.
7. Press Cmd+A, then Cmd+V.
8. Click **Save script properties**.
9. Close the Apps Script tab. No redeploy is needed; the script reads the property on every call.
10. Tell the builder "token rotated". The builder runs `python3 tools/live_check.py` (staging only) to confirm the new token works and the old one is refused.
11. Run B5 step 1, then step 2, for each phone.
12. On each phone, open **Brillo**, tap the **ⓘ** button on Today, then tap **Settings**.
13. Switch to Messages, long-press the setup-code message, and tap **Copy**.
14. Back in Brillo, tap the **Replace setup code** box, then tap **Paste**.
15. Wait for the pill to say **Synced just now**, then delete the setup-code message.

If you stop after step 1 without saving the new token in step 8, tell the
builder. `secrets.json` keeps the old token as `previousToken`, so the builder
can put it back and the phones keep working.

### B5. Set up a phone

**Do B6 first** if the script changed: a phone set up against an old script
version gets no trip data.

The setup code connects the installed app to one sheet. It must be pasted
**inside the home-screen app**, because iOS keeps Safari's storage separate (EC-30).

1. On the Mac, run this in the Terminal panel. It copies the code without showing it:
   `python3 ~/Desktop/Claude/Projects/Personal/brillo-travel/tools/make_setup_code.py`
   (add `prod` at the end for the real app).
2. In Messages, open the thread with the phone's owner, press Cmd+V, and send.
3. On the phone, in Messages, tap the app's link (or type it into Safari): staging `https://jbrillo15.github.io/brillo-travel-staging/`, prod `https://jbrillo15.github.io/brillo-travel/`.
4. Tap the Share button (square with an up arrow).
5. Scroll down and tap **Add to Home Screen**.
6. Leave "Open as Web App" on if it appears, and tap **Add**.
7. Open **Brillo** from the home screen.
8. Pick the phone's owner in "Whose phone is this?".
9. Switch to Messages and long-press the setup-code message.
10. Tap **Copy**.
11. Back in Brillo, tap the **Setup code** box.
12. Tap **Paste**. The box clears itself and Today appears.
13. Wait for the pill under the greeting to say **Synced just now** (up to 20 seconds).
14. Delete the setup-code message from the thread.

### B6. Deploy to staging / prod

**Front end:** the builder commits, checks the author is `jbrillo15` with the
noreply email, asks Jordan, then pushes (staging repo first; prod only after an
approved release). GitHub Pages publishes in about a minute. Phones show
"Update available" and update only when someone taps it.

**Script** (only when `server/Code.gs` or `js/parse.js` changed). The script is
two files: `Code.gs` and `Parse.gs` (an exact copy of `js/parse.js`).

0. **Real sheet only:** do B1 (named version + backup copy) first. The first snapshot writes IDs into rows that lack them.
1. Open the sheet (STAGING or the real one).
2. Click **Extensions → Apps Script**.
3. Click **Code.gs** in the file list.
4. Click into the editor.
5. Press Cmd+A, then Delete.
6. In the Terminal panel run `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pbcopy < ~/Desktop/Claude/Projects/Personal/brillo-travel/server/Code.gs`. (Without the UTF-8 part, Japanese and symbols arrive garbled.)
7. Click into the editor and press Cmd+V.
8. If there's no **Parse.gs** in the file list: click **+** next to Files, choose **Script**, type `Parse` and press Return.
9. Click **Parse.gs** in the file list.
10. Click into the editor.
11. Press Cmd+A, then Delete.
12. In the Terminal panel run `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pbcopy < ~/Desktop/Claude/Projects/Personal/brillo-travel/js/parse.js`.
13. Click into the editor and press Cmd+V.
14. Press Cmd+S.
15. Click **Deploy → Manage deployments**.
16. Click the pencil (Edit) on the existing deployment.
17. Under Version, choose **New version**.
18. In Description, type `vX.Y.Z`.
19. Click **Deploy** (B2: never "New deployment").
20. If Google asks you to authorize again: choose your account, then **Advanced → Go to (project name) (unsafe) → Allow**.
21. Tell the builder "script deployed". The builder runs `python3 tools/live_check.py` (staging only), which prints ok, env, row counts and issues, never the token.

The first snapshot after a deploy writes IDs into any rows that lack them (ID column only, empty cells only).

### B7. First PROD setup (once, for v0.2.0)

Connects the real **JAPAN 2026** sheet to the PROD app. Jordan does Parts 1–2
and 4 on the Mac in Chrome, signed in as the account that edits JAPAN 2026.
The builder does Part 3. About 30 minutes. Do it all on one day: the first
phone sync writes IDs into every row, so the backup must be fresh.

**Part 1 · Back up the real sheet**

1. Open **JAPAN 2026**.
2. Click **File → Version history → Name current version**, type `Before Brillo PROD`, click **Save**.
3. Click **File → Make a copy**, name it `JAPAN 2026 — backup YYYY-MM-DD` (today), click **Make a copy**. Don't share it.
4. Close the copy's tab and go back to JAPAN 2026.

**Part 2 · Put the script on the real sheet**

5. Click **Extensions → Apps Script**. A project named **Untitled project** opens, containing only an empty `function myFunction() {}`. If you see any other name or code, stop and tell the builder: the sheet already has a script, and step 7 would erase it.
6. Click the project name at the top left ("Untitled project"), type `Brillo PROD`, click **Rename**.
7. Click into the `Code.gs` editor, press Cmd+A, then Delete.
8. In the Terminal panel run `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pbcopy < ~/Desktop/Claude/Projects/Personal/brillo-travel/server/Code.gs`
9. Click into the editor and press Cmd+V.
10. Click **+** next to Files, choose **Script**, type `Parse`, press Return.
11. Click into the new `Parse.gs` editor, press Cmd+A, then Delete.
12. In the Terminal panel run `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pbcopy < ~/Desktop/Claude/Projects/Personal/brillo-travel/js/parse.js`
13. Click into the editor, press Cmd+V, then Cmd+S.
13a. Tell the builder "pasted". The builder confirms through Claude in Chrome that both files match the repo exactly (a checksum). If either doesn't match, redo steps 7–13.
14. In the Terminal panel run `python3 ~/Desktop/Claude/Projects/Personal/brillo-travel/tools/setup_prod.py token`. It saves a new prod token on the Mac and copies it without showing it.
15. In Apps Script's left sidebar, click **Project Settings** (the gear).
16. Scroll to **Script Properties** and click **Add script property**.
17. Property: `API_TOKEN`. Value: click the box and press Cmd+V.
18. Click **Add script property** again. Property: `ENV`. Value: `prod`.
19. Click **Save script properties**.
20. Click **Deploy → New deployment** (top right). This is the only time you use "New deployment".
21. Click the gear next to "Select type" and choose **Web app**.
22. Description: `v0.2.0`. Execute as: **Me**. Who has access: **Anyone**.
23. Click **Deploy**.
24. Click **Authorize access**, choose your account, click **Advanced → Go to Brillo PROD (unsafe) → Allow**. (The warning is expected: you wrote the script.)
25. Under "Web app", click **Copy** next to the URL that ends in `/exec`.
26. In the Terminal panel run `python3 ~/Desktop/Claude/Projects/Personal/brillo-travel/tools/setup_prod.py url`. It saves the URL and clears the clipboard.
27. Tell the builder "prod script deployed".

If step 26 says the clipboard has no web app URL, redo step 25 and run it again.
If you stop between steps 14 and 19, just rerun step 14 later: until the URL is
saved, it makes a fresh token.

**Part 3 · Publish the PROD site (builder)**

28. The builder adds the `prod` remote (`jbrillo15/brillo-travel`), checks the author and the trip-data scan, asks Jordan, and pushes the release.
29. Jordan: on github.com open **jbrillo15/brillo-travel → Settings → Pages**, set Source **Deploy from a branch**, Branch **main**, folder **/ (root)**, click **Save**.
30. The builder confirms `https://jbrillo15.github.io/brillo-travel/` serves the release.

**Part 4 · Phones** (each phone, Jordan's first)

31. Run **B5** with `prod` at the end of step 1. Install it as a **new** home-screen app from `https://jbrillo15.github.io/brillo-travel/`; leave the staging icon alone. Nothing carries over between the two.
32. In the new app, tap **ⓘ** on Today, scroll to the bottom, tap **Settings**, and check it says **prod** and **script 0.2.0**, with no Data health errors.
33. Smoke test (DQ-03, DQ-04): on Jordan's phone tick one Pre-trip item, then on Lindsay's phone tap **Sync now** and check it shows ticked. Untick it the same way.
33a. Both phones: press and hold the Brillo icon that shows the orange STAGING ribbon inside, and tap **Delete App**. The real-trip Brillo isn't affected. When Jordan needs the test app again, he re-adds it with B5 (staging) and types the name **Brillo TEST** on the Add to Home Screen screen.
34. Tell the builder "prod phones done". The builder reads the real sheet once (read only) to confirm the IDs and the tick, then tags `v0.2.0`.

The builder never runs `live_check.py`, `tests/live-staging.html` or
`resetStaging` against PROD (the script refuses the last one anyway).

**If step 32 or 33 fails**

1. Stop. Don't tick anything else.
2. In the Brillo PROD Apps Script, click **Deploy → Manage deployments**, select the deployment, and click **Archive**. Both phones are now cut off from the real sheet.
3. Open JAPAN 2026 → **File → Version history → See version history**. Compare it with "Before Brillo PROD". If anything besides the new ID cells changed, open "Before Brillo PROD" and click **Restore this version**.
4. Delete the PROD Brillo icon on both phones.
5. Tell the builder what you saw.

Later script fixes always use **Manage deployments → Edit → New version** (B2), never New deployment.

### B8. Phone trouble in Japan (no Mac)

Before the trip (by Nov 15): save the PROD setup code as an entry in the **Passwords** app on both phones (title "Brillo setup code", password = the code). Make it on the Mac with `make_setup_code.py prod`, AirDrop or paste it into Passwords, then clear the clipboard. The same code already lives inside the app, so this adds little risk.

- **Brillo deleted, or a phone reset or replaced:** in Safari open `https://jbrillo15.github.io/brillo-travel/` → Share → **Add to Home Screen** → open Brillo → pick the phone's owner → open Passwords, copy "Brillo setup code" → paste it into Brillo. Changes that hadn't synced on the old install are gone, so check the list against the sheet.
- **Phone lost or stolen:** on the other phone open **Find My** → Devices → the lost phone → **Erase This Device**. That removes Brillo and its saved code. Keep using Brillo on the other phone, and rotate the token when you're home (B4).
- **Brillo won't sync at all:** the saved copy still works offline. Then use the printed fallbacks (HANDOFF §15) and the Sheets app. No fixes from a hotel room unless it's a P0 and Jordan OKs it.
