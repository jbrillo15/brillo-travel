"""Live check of a deployed script (HANDOFF §12 L2 live, minimal).

Reads ~/.config/brillo-travel/secrets.json, posts a snapshot request, and
prints only non-secret facts: ok, env, server version, row counts and issue
IDs. The token and script URL are never printed.

    python3 tools/live_check.py            # staging
"""
import collections
import json
import pathlib
import sys
import urllib.request

env = sys.argv[1] if len(sys.argv) > 1 else "staging"
if env != "staging":
    sys.exit("Live checks run against staging only (HANDOFF §18 rule 5).")
cfg = json.loads(pathlib.Path("~/.config/brillo-travel/secrets.json").expanduser().read_text())[env]


def post(body):
    req = urllib.request.Request(cfg["apiUrl"], data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "text/plain;charset=utf-8"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


res = post({"token": cfg["token"], "action": "snapshot", "device": "live-check", "appVersion": "0.1.0"})
if not res.get("ok"):
    sys.exit(f"FAIL: ok=false code={res.get('code')} message={res.get('message')}")
data = res.get("data")
if not isinstance(data, dict):
    sys.exit("FAIL: ok=true but no data (is the old spike script still deployed?)")
print(f"ok=true env={res.get('env')} serverVersion={res.get('serverVersion')} api={res.get('api')}")
for k in ["itinerary", "hotels", "transportation", "expenses", "ideas", "checklists", "phrases"]:
    rows = data.get(k)
    missing_ids = sum(1 for r in rows if not r.get("id")) if isinstance(rows, list) else "-"
    print(f"  {k:15} rows={len(rows) if isinstance(rows, list) else 'UNREADABLE'} without_id={missing_ids}")
s = data.get("settings") or {}
print(f"  settings: trip {s.get('tripStart')}..{s.get('tripEnd')} tz={s.get('tripTz')} "
      f"allergenWords={'set' if s.get('allergenWords') else 'missing'}")
issues = res.get("issues") or []
counts = collections.Counter((i["severity"], i["id"]) for i in issues)
print(f"issues: {len(issues)}  " + ", ".join(f"{sev} {iid} x{n}" for (sev, iid), n in sorted(counts.items())))
bad = post({"token": cfg["token"] + "x", "action": "snapshot"})
print(f"wrong token refused: {bad.get('code') == 'AUTH'}")
echo = post({"token": cfg["token"], "action": "ping", "echo": "日本語 🍣"})
print(f"Japanese + emoji round trip: {echo.get('echo') == '日本語 🍣'}")
