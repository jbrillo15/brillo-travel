# Brillo Travel

A home-screen web app for Jordan and Lindsay's Japan trip (Nov 18–26, 2026):
today's plan, tonight's hotel in Japanese, shared checklists, a shared budget
and nearby ideas, all working with no signal.

- **Spec / contract:** `HANDOFF.md`. Read it before changing anything. It stays on the Mac only (git-ignored) because it contains booking details.
- **How to deploy, back up, set up a phone:** [RUNBOOK.md](RUNBOOK.md)
- **What changed:** [CHANGELOG.md](CHANGELOG.md) · **Known bugs:** [ISSUES.md](ISSUES.md)
- **Design system:** `docs/DESIGN.md` (Phase 0)

## How it fits together

Plain HTML, CSS and JavaScript served from GitHub Pages. No build step, no
Node, no frameworks. Each file in `js/` is a classic script that attaches to
`window.BT`. Data lives in the Google Sheet "JAPAN 2026"; a small Apps Script
web app bound to the sheet (`server/Code.gs`) is the only thing that reads or
writes it. Each phone keeps a full copy in IndexedDB so the app works offline.

## Running the tests

Open `tests/tests.html` in a browser. Results print on the page and land in
`window.__TEST_RESULTS__`. Everything must pass before a staging deploy.

## Where things live

| What | Where |
|---|---|
| Source code | this folder (iCloud-synced Desktop) |
| Git history | `~/Library/Application Support/brillo-travel/repo.git` (kept off iCloud on purpose; the `.git` file here points to it) |
| Secrets (tokens, script URLs) | `~/.config/brillo-travel/secrets.json` (mode 600, outside iCloud and the repo) |

**This repository is public.** Nothing in it may contain trip data, booking
numbers, tokens or the Apps Script URL. Test fixtures use fake values.
