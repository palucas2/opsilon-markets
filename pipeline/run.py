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


def probe():
    """Log which sources answer from this machine (5 s each)."""
    import urllib.request
    from sources import MOCK
    if MOCK:
        return
    for name, url in [("Yahoo", "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5d&interval=1d"),
                      ("FRED csv", "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2026-01-01"),
                      ("FRED api", "https://api.stlouisfed.org/fred/series?series_id=DGS10"),
                      ("BLS", "https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000"),
                      ("World Bank", "https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrnev=1")]:
        t0 = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (opsilon-markets)"})
            with urllib.request.urlopen(req, timeout=8) as r:
                log.info("probe %-10s HTTP %s in %.1fs", name, r.status, time.time() - t0)
        except Exception as e:  # noqa: BLE001
            log.info("probe %-10s FAILED in %.1fs: %s", name, time.time() - t0, str(e)[:80])


def main(only=None):
    ensure_dirs()
    probe()
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
