"""Local trade journal (SQLite, same file as the point-in-time store).

    python tools/journal.py add --symbol MCL --side long --qty 3 --entry 62.40 --exit 62.71 --stop 62.20 --setup orb --reason "range break on volume" --lesson "waited for the close above"
    python tools/journal.py import opsilon-journal-2026-11-26.csv     # the CSV exported from the site's Journal page
    python tools/journal.py stats

Stats: win rate, average R, P&L by setup and by entry hour.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

from trading import config as K  # noqa: E402
from trading import store  # noqa: E402


def calc(symbol, side, qty, entry, exit_, stop):
    _, _, _, _, tick, tv, cost, _ = K.CONTRACTS[symbol.upper()]
    sd = 1 if str(side).lower() in ("1", "long", "l", "buy") else -1
    pnl = (exit_ - entry) * sd / tick * tv * qty - cost * qty
    risk = abs(entry - stop) / tick * tv * qty
    return pnl, (pnl / risk if risk else None)


def add(a):
    pnl, r = calc(a.symbol, a.side, a.qty, a.entry, a.exit, a.stop)
    when = a.opened or datetime.now().strftime("%Y-%m-%d %H:%M")
    with store.db() as con:
        con.execute("INSERT INTO journal (opened, closed, symbol, side, qty, entry, exit, stop, setup, reason, pnl, r, lesson) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (when, when, a.symbol.upper(), a.side, a.qty, a.entry, a.exit, a.stop, a.setup, a.reason, pnl, r, a.lesson))
    print(f"P&L {pnl:+.2f} $, {r:+.2f} R" if r is not None else f"P&L {pnl:+.2f} $")


def imp(path):
    df = pd.read_csv(path)
    n = 0
    with store.db() as con:
        for _, t in df.iterrows():
            pnl, r = calc(t.symbol, t.side, int(t.qty), float(t.entry), float(t.exit), float(t.stop))
            when = f"{t.date} {t.get('time', '')}".strip()
            con.execute("INSERT INTO journal (opened, closed, symbol, side, qty, entry, exit, stop, setup, reason, pnl, r, lesson) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (when, when, t.symbol, t.side, int(t.qty), t.entry, t.exit, t.stop, t.get("setup", ""), t.get("reason", ""), pnl, r, t.get("lesson", "")))
            n += 1
    print(f"{n} trades imported")


def stats():
    with store.db() as con:
        df = pd.read_sql("SELECT * FROM journal ORDER BY opened", con)
    if df.empty:
        print("Journal empty.")
        return
    df["hour"] = pd.to_datetime(df.opened, errors="coerce").dt.hour
    print(f"{len(df)} trades · win rate {(df.pnl > 0).mean():.0%} · average R {df.r.mean():+.2f} · P&L {df.pnl.sum():+,.0f} $")
    print("\nBy setup\n", df.groupby("setup").agg(trades=("pnl", "size"), win=("pnl", lambda x: (x > 0).mean()), avg_r=("r", "mean"), pnl=("pnl", "sum")).round(2))
    print("\nBy entry hour\n", df.groupby("hour").agg(trades=("pnl", "size"), avg_r=("r", "mean"), pnl=("pnl", "sum")).round(2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add")
    for f, t in [("symbol", str), ("side", str), ("qty", int), ("entry", float), ("exit", float), ("stop", float)]:
        a.add_argument("--" + f, type=t, required=True)
    for f in ("setup", "reason", "lesson", "opened"):
        a.add_argument("--" + f, default="")
    i = sub.add_parser("import"); i.add_argument("path")
    sub.add_parser("stats")
    x = ap.parse_args()
    {"add": lambda: add(x), "import": lambda: imp(x.path), "stats": stats}[x.cmd]()
