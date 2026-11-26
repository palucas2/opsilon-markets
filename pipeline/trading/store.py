"""Point-in-time store (SQLite).

Every fundamental observation is kept with two dates:
  period     the date the figure is about (week ending, report date, crop week)
  published  when the market could first see it (ET timestamp)
A backtest asks `asof(series, t)`: the latest figure *published* before t. That
is what stops look-ahead: a COT report about Tuesday is unknown until Friday
15:30 ET, the EIA crude figure for the week to Friday is unknown until Wednesday
10:30 ET.

Prices live in `bars` (daily or intraday, any source). The file sits in
data/cache/trading.sqlite, which GitHub Actions keeps between runs.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pandas as pd

from common import CACHE

DB = CACHE / "trading.sqlite"

SCHEMA = """
CREATE TABLE IF NOT EXISTS obs (
  source TEXT, series TEXT, period TEXT, published TEXT, value REAL,
  PRIMARY KEY (source, series, period)
);
CREATE INDEX IF NOT EXISTS obs_pub ON obs(series, published);
CREATE TABLE IF NOT EXISTS bars (
  symbol TEXT, freq TEXT, ts TEXT, o REAL, h REAL, l REAL, c REAL, v REAL, src TEXT,
  PRIMARY KEY (symbol, freq, ts)
);
CREATE TABLE IF NOT EXISTS events (
  day TEXT, time_et TEXT, name TEXT, tier INTEGER, PRIMARY KEY (day, name)
);
CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT, opened TEXT, closed TEXT, symbol TEXT, side TEXT, qty INTEGER,
  entry REAL, exit REAL, stop REAL, setup TEXT, reason TEXT, pnl REAL, r REAL, lesson TEXT
);
"""


@contextmanager
def db(path: Path = DB):
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def put_obs(source: str, series: str, rows):
    """rows: iterable of (period 'YYYY-MM-DD', published 'YYYY-MM-DD HH:MM', value)."""
    rows = [(source, series, p, pub, None if v is None else float(v)) for p, pub, v in rows]
    if not rows:
        return 0
    with db() as con:
        con.executemany("INSERT OR REPLACE INTO obs VALUES (?,?,?,?,?)", rows)
    return len(rows)


def series(series: str, by: str = "period") -> pd.Series:
    """Full history of a series, indexed by period (or by publication time)."""
    with db() as con:
        df = pd.read_sql("SELECT period, published, value FROM obs WHERE series=? ORDER BY period", con, params=(series,))
    if df.empty:
        return pd.Series(dtype=float)
    idx = pd.to_datetime(df[by])
    return pd.Series(df["value"].values, index=idx, name=series)


def frame(series_name: str) -> pd.DataFrame:
    with db() as con:
        df = pd.read_sql("SELECT period, published, value FROM obs WHERE series=? ORDER BY period", con, params=(series_name,))
    df["period"] = pd.to_datetime(df["period"])
    df["published"] = pd.to_datetime(df["published"])
    return df


def asof(series_name: str, when) -> float | None:
    """Latest value of `series_name` that had been published at `when`."""
    with db() as con:
        row = con.execute("SELECT value FROM obs WHERE series=? AND published<=? ORDER BY period DESC LIMIT 1",
                          (series_name, pd.Timestamp(when).strftime("%Y-%m-%d %H:%M"))).fetchone()
    return row[0] if row else None


def known_daily(series_name: str, index: pd.DatetimeIndex, cutoff: str = "16:00") -> pd.Series:
    """Point-in-time daily series: for each trading day, the latest value published before `cutoff` ET that day."""
    df = frame(series_name)
    if df.empty:
        return pd.Series(index=index, dtype=float)
    t = pd.DataFrame({"t": pd.to_datetime([f"{d:%Y-%m-%d} {cutoff}" for d in index])}, index=index)
    m = pd.merge_asof(t.sort_values("t"), df.sort_values("published")[["published", "value"]], left_on="t", right_on="published")
    return pd.Series(m["value"].values, index=index)


def put_bars(symbol: str, freq: str, df: pd.DataFrame, src: str):
    if df is None or df.empty:
        return 0
    d = df.copy()
    d.index = pd.to_datetime(d.index)
    rows = [(symbol, freq, ts.isoformat(), *(float(d.at[ts, c]) if c in d and pd.notna(d.at[ts, c]) else None for c in "ohlcv"), src)
            for ts in d.index]
    with db() as con:
        con.executemany("INSERT OR REPLACE INTO bars VALUES (?,?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def bars(symbol: str, freq: str) -> pd.DataFrame:
    with db() as con:
        df = pd.read_sql("SELECT ts,o,h,l,c,v,src FROM bars WHERE symbol=? AND freq=? ORDER BY ts", con, params=(symbol, freq))
    if df.empty:
        return df
    df.index = pd.to_datetime(df.pop("ts"), utc=True if freq != "1d" else None, format="ISO8601")
    return df


def put_events(rows):
    with db() as con:
        con.executemany("INSERT OR REPLACE INTO events VALUES (?,?,?,?)", rows)


def events(start: str, end: str) -> pd.DataFrame:
    with db() as con:
        return pd.read_sql("SELECT * FROM events WHERE day BETWEEN ? AND ? ORDER BY day, time_et", con, params=(start, end))


def inventory() -> list[dict]:
    """What the store holds: one line per series / symbol (for the Data & stack page)."""
    out = []
    with db() as con:
        for s, src, n, a, b, p in con.execute("SELECT series, source, COUNT(*), MIN(period), MAX(period), MAX(published) FROM obs GROUP BY series, source"):
            out.append({"kind": "fundamental", "name": s, "source": src, "n": n, "first": a, "last": b, "published": p})
        for s, f, src, n, a, b in con.execute("SELECT symbol, freq, src, COUNT(*), MIN(ts), MAX(ts) FROM bars GROUP BY symbol, freq, src"):
            out.append({"kind": "prices", "name": f"{s} {f}", "source": src, "n": n, "first": a[:16], "last": b[:16]})
    return out
