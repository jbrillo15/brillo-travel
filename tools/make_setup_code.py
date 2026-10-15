"""Copy a Brillo Travel setup code to the clipboard without ever printing it.

Reads ~/.config/brillo-travel/secrets.json ({env: {apiUrl, token}}) and builds
the base64 JSON blob {env, apiUrl, token} that a phone pastes in Settings
(HANDOFF §7). Nothing secret is printed; only the character count.

    python3 tools/make_setup_code.py            # staging
    python3 tools/make_setup_code.py prod
"""
import base64
import json
import pathlib
import subprocess
import sys

env = sys.argv[1] if len(sys.argv) > 1 else "staging"
secrets = json.loads(pathlib.Path("~/.config/brillo-travel/secrets.json").expanduser().read_text())
if env not in secrets:
    sys.exit(f"No '{env}' entry in secrets.json")
cfg = secrets[env]
blob = json.dumps({"env": env, "apiUrl": cfg["apiUrl"], "token": cfg["token"]}, separators=(",", ":"))
code = base64.b64encode(blob.encode("utf-8")).decode("ascii")
subprocess.run(["pbcopy"], input=code.encode("ascii"), check=True)
print(f"{env} setup code copied to the clipboard ({len(code)} characters). Paste it now.")
