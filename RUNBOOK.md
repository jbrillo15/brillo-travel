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
