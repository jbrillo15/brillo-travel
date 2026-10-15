"""Copy the repo's publishable files to ~/Library/Caches/brillo-preview/app/
so the browser pane can load them over http://localhost:8787/app/ (the
Desktop can't serve http, and file:// pages can't load sibling scripts).

Only files git would publish are copied (tracked + untracked-not-ignored), so
git-ignored trip data (HANDOFF.md, STATUS.md, private/) never leaves the project.

    python3 tools/sync_preview.py
"""
import pathlib
import shutil
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
dest = pathlib.Path.home() / "Library/Caches/brillo-preview/app"
files = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=root,
                       capture_output=True, text=True, check=True).stdout.split("\n")
if dest.exists():
    shutil.rmtree(dest)
n = 0
for f in filter(None, files):
    src = root / f
    if src.is_file():
        (dest / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest / f)
        n += 1
print(f"{n} files -> {dest}")
