"""Make a new Brillo Travel API token without ever printing it (RUNBOOK B4).

Generates a random token, saves it as {env}.token in
~/.config/brillo-travel/secrets.json (mode 600), and copies it to the
clipboard so it can be pasted into the script's API_TOKEN property. Prints
only the character count.

    python3 tools/rotate_token.py            # staging
    python3 tools/rotate_token.py prod
"""
import json
import os
import pathlib
import secrets
import subprocess
import sys

env = sys.argv[1] if len(sys.argv) > 1 else "staging"
if env not in ("staging", "prod"):
    sys.exit("Use staging or prod")
path = pathlib.Path("~/.config/brillo-travel/secrets.json").expanduser()
data = json.loads(path.read_text())
if env not in data or "apiUrl" not in data[env]:
    sys.exit(f"No '{env}' entry with an apiUrl in secrets.json")

token = secrets.token_urlsafe(32)
# Keep the old one: if the paste into API_TOKEN never happens, B4 says how to restore it.
if data[env].get("token"):
    data[env]["previousToken"] = data[env]["token"]
data[env]["token"] = token
tmp = path.with_suffix(".tmp")
fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    json.dump(data, f, indent=2)
os.replace(tmp, path)
os.chmod(path, 0o600)
subprocess.run(["pbcopy"], input=token.encode("ascii"), check=True)
print(f"New {env} token saved and copied to the clipboard ({len(token)} characters). Paste it into API_TOKEN now.")
