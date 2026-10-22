"""First PROD setup helper (RUNBOOK B7). Never prints a token or the script URL.

    python3 tools/setup_prod.py token   # new prod token: saved, then copied to the clipboard
    python3 tools/setup_prod.py url     # saves the /exec URL now on the clipboard, then clears it

Writes ~/.config/brillo-travel/secrets.json (mode 600) under "prod":
{apiUrl, token}. The staging entry is left untouched.
"""
import json
import os
import pathlib
import re
import secrets
import subprocess
import sys

PATH = pathlib.Path("~/.config/brillo-travel/secrets.json").expanduser()
URL_RE = re.compile(r"^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$")


def load():
    return json.loads(PATH.read_text()) if PATH.exists() else {}


def save(data):
    PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = PATH.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, PATH)
    os.chmod(PATH, 0o600)


step = sys.argv[1] if len(sys.argv) > 1 else ""
data = load()
prod = data.setdefault("prod", {})

if step == "token":
    # Until the URL is saved, setup isn't finished, so rerunning just makes a fresh token.
    if prod.get("token") and prod.get("apiUrl"):
        sys.exit("A prod token already exists. To replace it, use tools/rotate_token.py prod (RUNBOOK B4).")
    token = secrets.token_urlsafe(32)
    prod["token"] = token
    save(data)
    subprocess.run(["pbcopy"], input=token.encode("ascii"), check=True)
    print(f"Prod token saved and copied ({len(token)} characters). Paste it into API_TOKEN now.")
elif step == "url":
    url = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout.strip()
    if not URL_RE.match(url):
        sys.exit("The clipboard doesn't hold a web app URL (https://script.google.com/macros/s/…/exec). Copy it again and rerun.")
    prod["apiUrl"] = url
    save(data)
    subprocess.run(["pbcopy"], input=b"", check=True)
    ready = "token" in prod
    print("Prod URL saved; clipboard cleared." + ("" if ready else " The token is still missing: run the token step."))
else:
    sys.exit("Use: python3 tools/setup_prod.py token | url")
