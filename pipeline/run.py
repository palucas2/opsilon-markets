"""Point d'entrée : python pipeline/run.py [module ...]

Sans argument, construit tout. Chaque module est isolé : une erreur est
journalisée et le reste du site continue de se construire.
"""
from __future__ import annotations

import json
import logging
import sys
import time
import traceback
from datetime import datetime

from common import OUT, ensure_dirs, now_et_label, write_json

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("opsilon")

import build_companies, build_dashboards, build_history, build_markets, build_notes  # noqa: E402

STEPS = [
    ("dashboards", build_dashboards.build),
    ("fx", build_markets.build_fx),
    ("world", build_markets.build_world),
    ("central-banks", build_markets.build_central_banks),
    ("recession", build_markets.build_recession),
    ("companies", build_companies.build),     # also writes calendar.json
    ("history", build_history.build),
    ("notes", build_notes.build),             # needs fx.json and calendar.json
]


def main(only=None):
    ensure_dirs()
    status = {}
    for name, fn in STEPS:
        if only and name not in only:
            continue
        t0 = time.time()
        try:
            res = fn()
            status[name] = {"ok": True, "secs": round(time.time() - t0, 1), "result": res if isinstance(res, (int, str)) else None}
            log.info("✓ %s (%.1fs)", name, time.time() - t0)
        except Exception as e:  # noqa: BLE001
            status[name] = {"ok": False, "secs": round(time.time() - t0, 1), "error": str(e)}
            log.error("✗ %s: %s\n%s", name, e, traceback.format_exc())
    prev = {}
    p = OUT / "status.json"
    if p.exists():
        try:
            prev = json.loads(p.read_text()).get("steps", {})
        except Exception:  # noqa: BLE001
            pass
    write_json("status.json", {"updated": now_et_label(), "utc": datetime.utcnow().isoformat(timespec="minutes"), "steps": prev | status})
    failed = [k for k, v in status.items() if not v["ok"]]
    if failed:
        log.warning("failed steps: %s", failed)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or None))
