"""Helpers partagés : écriture JSON, calcul de variations, formats de date."""
from __future__ import annotations

import json
import math
import os
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data"          # generated JSON served with the site
ARCHIVE = ROOT / "data" / "archive"   # committed in git: notes that must persist
CACHE = ROOT / "data" / "cache"       # kept between runs by actions/cache: fundamentals

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
RANGE_DAYS = {"1D": 1, "1W": 7, "1M": 30, "3M": 91, "6M": 182, "1Y": 365, "2Y": 730, "5Y": 1826}


def _clean(o):
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, (pd.Timestamp, datetime, date)):
        return o.strftime("%Y-%m-%d")
    return o


def write_json(rel: str, obj, base: Path = OUT):
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(_clean(obj), f, separators=(",", ":"), ensure_ascii=False)
    return p


def read_json(rel: str, base: Path = ARCHIVE, default=None):
    p = base / rel
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:  # noqa: BLE001
            return default
    return default


def r(x, d=2):
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, d)


def dstr(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m-%d")


def human_date(ts) -> str:
    t = pd.Timestamp(ts)
    return f"{t.day} {MONTHS[t.month - 1]} {t.year}"


def series_clean(s: pd.Series) -> pd.Series:
    return s.dropna().sort_index() if s is not None else pd.Series(dtype=float)


def change_over(s: pd.Series, days: int, pct=True):
    """Change from the last close on/before (last date - days) to the last close."""
    s = series_clean(s)
    if len(s) < 2:
        return None, None, None
    end_d = s.index[-1]
    if days == 1:
        a, b = s.iloc[-2], s.iloc[-1]
        start_d = s.index[-2]
    else:
        target = end_d - pd.Timedelta(days=days)
        prior = s[s.index <= target]
        if prior.empty:
            return None, None, None
        a, b, start_d = prior.iloc[-1], s.iloc[-1], prior.index[-1]
    v = (b / a - 1) * 100 if pct else (b - a)
    return r(v, 3), dstr(start_d), dstr(end_d)


def ytd_change(s: pd.Series, pct=True):
    s = series_clean(s)
    if s.empty:
        return None
    y = s.index[-1].year
    prior = s[s.index < pd.Timestamp(f"{y}-01-01")]
    if prior.empty:
        return None
    a, b = prior.iloc[-1], s.iloc[-1]
    return r((b / a - 1) * 100 if pct else b - a, 3)


def perf_block(df: pd.DataFrame, names: list[str], cols: list[str], ranges=("1D", "1M", "3M", "6M", "1Y"), invert=None):
    """Structure 'perf' used by ranked/rebased dashboards."""
    invert = invert or [False] * len(cols)
    out = {}
    for rg in ranges:
        vals, frm, to = [], [], []
        for c, inv in zip(cols, invert):
            s = df[c] if c in df else pd.Series(dtype=float)
            if inv:
                s = 1 / series_clean(s)
            v, a, b = change_over(s, RANGE_DAYS[rg])
            vals.append(v); frm.append(a); to.append(b)
        out[rg] = {"values": vals, "from": frm, "to": to}
    hist_df = df[[c for c in cols if c in df]].copy()
    for c, inv in zip(cols, invert):
        if inv and c in hist_df:
            hist_df[c] = 1 / hist_df[c]
    hist_df = hist_df.ffill().dropna(how="all")
    hist = {"dates": [dstr(d) for d in hist_df.index],
            "series": [[r(v, 5) for v in hist_df[c].tolist()] if c in hist_df else [] for c in cols]}
    return {"names": names, "ranges": out, "hist": hist}


def ensure_dirs():
    OUT.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)


def zscore_move(s: pd.Series, window=252):
    """Today's daily % move and its z-score against the past year of moves."""
    s = series_clean(s)
    if len(s) < 30:
        return None, None
    ret = s.pct_change().dropna() * 100
    last = ret.iloc[-1]
    hist = ret.iloc[-window - 1:-1]
    sd = hist.std()
    z = (last - hist.mean()) / sd if sd and sd > 0 else None
    return r(last, 3), r(z, 2)


def now_et_label():
    try:
        from zoneinfo import ZoneInfo
        t = datetime.now(ZoneInfo("America/New_York"))
    except Exception:  # noqa: BLE001
        t = datetime.utcnow()
    h = t.hour % 12 or 12
    return f"{t.day} {MONTHS[t.month - 1]} {t.year}, {h}:{t.minute:02d} {'am' if t.hour < 12 else 'pm'} ET"
