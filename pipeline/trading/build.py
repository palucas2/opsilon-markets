"""Trading Part: fetch, test, simulate, write site/data/trading/*.json.

Run alone:  python pipeline/run.py trading
"""
from __future__ import annotations

import logging
import math
import time
from datetime import date, timedelta

import numpy as np
import pandas as pd

from common import now_et_label, write_json
from sources import MOCK

from . import config as K
from . import edge, intraday, sources, store, strategies

log = logging.getLogger("opsilon")
P = "trading/"


def _clean(x, d=3):
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return x
    return None if math.isnan(f) or math.isinf(f) else round(f, d)


def _step(label, fn, status):
    t0 = time.time()
    try:
        res = fn()
        status.append({"step": label, "ok": True, "msg": res if isinstance(res, str) else "ok", "secs": round(time.time() - t0, 1)})
        return res
    except Exception as e:  # noqa: BLE001
        log.warning("trading %s failed: %s", label, e)
        status.append({"step": label, "ok": False, "msg": str(e)[:160], "secs": round(time.time() - t0, 1)})
        return None


# ---------------------------------------------------------------------------
def fundamentals_view(close: pd.DataFrame, wx):
    out = {"stocks": {}}
    for name, (_, _, _, label, unit) in sources.EIA_SERIES.items():
        df = store.frame(name)
        if df.empty:
            continue
        s = df.set_index("period")["value"]
        last = s[s.index >= s.index[-1] - pd.Timedelta(days=371)]
        wk = s.index.isocalendar().week
        rows = []
        for t, v in last.items():
            w = t.isocalendar().week
            past = s[(s.index < t - pd.Timedelta(days=300)) & (s.index >= t - pd.Timedelta(days=365 * 5 + 20)) & (np.abs(wk - w) <= 0)]
            rows.append((t, v, past.mean() if len(past) else None, past.min() if len(past) else None, past.max() if len(past) else None))
        t, v, a, lo, hi = rows[-1]
        chg = float(s.iloc[-1] - s.iloc[-2])
        out["stocks"][name] = {"label": label, "unit": unit, "week": t.strftime("%Y-%m-%d"), "published": df["published"].iloc[-1].strftime("%Y-%m-%d %H:%M"),
                               "last": _clean(v, 1), "chg": _clean(chg, 1), "avg5": _clean(a, 1), "vs5": _clean((v / a - 1) * 100, 1) if a else None,
                               "hist": {"d": [x[0].strftime("%Y-%m-%d") for x in rows], "v": [_clean(x[1], 1) for x in rows],
                                        "avg": [_clean(x[2], 1) for x in rows], "lo": [_clean(x[3], 1) for x in rows], "hi": [_clean(x[4], 1) for x in rows]}}
    # cracks
    need = {"wti", "gasoline", "heatingoil"}
    if need <= set(close.columns):
        c = close[list(need)].dropna().iloc[-520:]
        cr = {"crack321": (2 * c.gasoline * 42 + c.heatingoil * 42) / 3 - c.wti, "gas_crack": c.gasoline * 42 - c.wti, "diesel_crack": c.heatingoil * 42 - c.wti}
        out["cracks"] = {k: {"d": [d.strftime("%Y-%m-%d") for d in v.index], "v": [_clean(x, 2) for x in v.values],
                             "last": _clean(v.iloc[-1], 2), "z60": _clean((v.iloc[-1] - v.iloc[-60:].mean()) / v.iloc[-60:].std(), 2)} for k, v in cr.items()}
    # COT
    cot = []
    for k in K.DAILY_UNIVERSE:
        df = store.frame(f"cot_mm_pct_{k}")
        if len(df) < 10:
            continue
        s = df.set_index("period")["value"]
        s3 = s[s.index >= s.index[-1] - pd.Timedelta(days=3 * 365)]
        cot.append({"key": k, "asof": s.index[-1].strftime("%Y-%m-%d"), "mm_pct": _clean(s.iloc[-1], 1), "chg1w": _clean(s.iloc[-1] - s.iloc[-2], 1),
                    "chg4w": _clean(s.iloc[-1] - s.iloc[-5], 1) if len(s) > 5 else None, "pctile": _clean((s3 < s.iloc[-1]).mean() * 100, 0)})
    out["cot"] = cot
    # crops
    crops = []
    for name in sources.NASS:
        df = store.frame(name)
        if df.empty:
            continue
        s = df.set_index("period")["value"]
        same = s[(s.index.year < s.index[-1].year) & (np.abs(s.index.dayofyear - s.index[-1].dayofyear) <= 4) & (s.index.year >= s.index[-1].year - 5)]
        crops.append({"key": name, "week": s.index[-1].strftime("%Y-%m-%d"), "last": _clean(s.iloc[-1], 0), "chg": _clean(s.iloc[-1] - s.iloc[-2], 0) if len(s) > 1 else None,
                      "avg5": _clean(same.mean(), 0) if len(same) else None})
    out["crops"] = crops
    if isinstance(wx, dict):
        out["weather"] = wx
        h = store.series("wx_hdd_6_10")
        out["weather"]["hdd_rev"] = _clean(h.iloc[-1] - h.iloc[-2], 1) if len(h) > 1 else None
    return out


# ---------------------------------------------------------------------------
def build():
    status = []
    if MOCK:
        # mock runs start from a clean store so the synthetic data does not linger in your real cache
        if store.DB.exists():
            store.DB.unlink()
    _step("EIA weekly", sources.fetch_eia, status)
    _step("CFTC COT", sources.fetch_cot, status)
    _step("USDA NASS", sources.fetch_usda, status)
    wx = _step("NOAA GFS weather", sources.fetch_weather, status)
    _step("Tier-1 calendar", lambda: f"{len(sources.build_calendar())} events", status)
    _step("Intraday (Yahoo 5m)", sources.fetch_intraday_yahoo, status)
    _step("Databento", sources.fetch_databento, status)
    _step("Imports (Bloomberg, TopstepX)", sources.ingest_imports, status)
    close = _step("Daily prices", lambda: sources.daily_prices(), status)
    if close is None or isinstance(close, str):
        close = pd.DataFrame()

    # ----------------------------------------------------------- daily edge tests
    specs, notes = strategies.all_specs(close) if not close.empty else ([], [])
    n_trials = max(10, len(specs) * 3)
    score, detail = [], {}
    for s in specs:
        t0 = time.time()
        net = s.net()
        ev = edge.evaluate(net, pos=s.pos, rets=s.rets, cost_fn=s.cost_fn(), n_trials=n_trials)
        bym = {}
        for mkt, x in s.by_market().items():
            x = x.dropna()
            if (x != 0).sum() > 60:
                bym[mkt] = {"sharpe": _clean(edge.sharpe(x[x.index >= x.ne(0).idxmax()]), 2), "ret": _clean(x.mean() * 252 * 100 * math.sqrt(len(s.pos.columns)), 1)}
        row = {"key": s.key, "name": s.name, "family": s.family, "idea": s.idea, "freq": s.freq, "papers": K.PAPERS.get(s.key, K.PAPERS.get("eia") if s.key.startswith("eia") else []),
               **{k: _clean(v) for k, v in ev.items() if k not in ("eq", "years")}}
        score.append(row)
        detail[s.key] = {**row, "eq": ev.get("eq"), "years": ev.get("years"), "markets": bym}
        log.info("edge %-8s %s in %.0fs", s.key, ev.get("verdict"), time.time() - t0)
    pending = [{"key": "carry", "name": "Carry (roll yield)", "why": "Needs the history of the second and later contracts (CL2, NG2, GC2): add DATABENTO_API_KEY or export them from a Bloomberg terminal with tools/bloomberg_export.py."}] if not any(s.key == "carry" for s in specs) else []
    if not any(s.key == "hp" for s in specs):
        pending.append({"key": "hp", "name": "COT strategies", "why": "CFTC history not reached on this run."})

    # ----------------------------------------------------------- intraday
    ev_df = store.events((date.today() - timedelta(days=800)).isoformat(), (date.today() + timedelta(days=60)).isoformat())
    intra = {}
    for sym in ["CL.c.0", "CL=F", "GC.c.0", "GC=F", "NG.c.0", "NG=F"]:
        root = sym.split(".")[0].split("=")[0]
        if any(v.get("root") == root for v in intra.values()):
            continue                            # prefer Databento minute bars over Yahoo when both exist
        freq = "1m" if ".c." in sym else "5m"
        b = store.bars(sym, freq)
        if len(b) < 500:
            continue
        trades, skipped = intraday.backtest(b, sym, ev_df)
        per = {}
        for key, (label, _, news, desc) in intraday.SETUPS.items():
            t = trades[trades.setup == key] if len(trades) else trades
            if not len(t):
                continue
            st = intraday.setup_stats(t)
            st["topstep"] = intraday.combine_montecarlo(t)
            per[key] = {"label": label, "desc": desc, "news": news, **{k: (_clean(v) if not isinstance(v, (dict, list)) else v) for k, v in st.items()}}
        allst = intraday.setup_stats(trades) if len(trades) else {"n": 0}
        allst["topstep"] = intraday.combine_montecarlo(trades) if len(trades) else None
        src = b["src"].iloc[-1] if "src" in b else ""
        intra[sym] = {"root": root, "micro": intraday.MICRO_OF.get(sym), "src": src, "freq": freq, "bars": len(b),
                      "from": b.index[0].strftime("%Y-%m-%d"), "to": b.index[-1].strftime("%Y-%m-%d"), "skipped": skipped,
                      "setups": per, "all": {k: (_clean(v) if not isinstance(v, (dict, list)) else v) for k, v in allst.items()},
                      "last_trades": trades.tail(40).round(3).to_dict("records") if len(trades) else []}

    # ----------------------------------------------------------- calendar ahead
    cal = store.events(date.today().isoformat(), (date.today() + timedelta(days=21)).isoformat())
    cal_rows = [{"day": r.day, "t": r.time_et, "name": r["name"], "tier": int(r.tier)} for _, r in cal.iterrows()]

    fund = _step("Fundamentals view", lambda: fundamentals_view(close, wx), status) or {}
    keys = {k: bool(K.key(k)) for k in K.KEYS}
    stack = {"keys": [{"name": k, "set": v, "what": K.KEYS[k]} for k, v in keys.items()], "status": status, "inventory": store.inventory(), "notes": notes}

    verdicts = [x["verdict"] for x in score]
    upd = now_et_label()
    write_json(P + "index.json", {"updated": upd, "mock": MOCK, "asof": close.index[-1].strftime("%Y-%m-%d") if len(close) else None,
                                  "score": score, "pending": pending, "n_trials": n_trials, "calendar": cal_rows,
                                  "counts": {v: verdicts.count(v) for v in set(verdicts)},
                                  "intraday": [{"sym": s, "micro": v["micro"], "src": v["src"], "verdicts": {k: x["verdict"] for k, x in v["setups"].items()},
                                                "pass": (v["all"].get("topstep") or {}).get("pass")} for s, v in intra.items()],
                                  "weather": {k: v for k, v in (fund.get("weather") or {}).items() if k != "daily"}})
    write_json(P + "edge.json", {"updated": upd, "detail": detail, "n_trials": n_trials, "notes": notes})
    write_json(P + "intraday.json", {"updated": upd, "symbols": intra, "rules": K.TOPSTEP, "risk": [K.RISK_MIN, K.RISK_MAX],
                                     "contracts": {k: {"name": v[0], "tick": v[4], "tv": v[5], "cost": v[6], "group": v[7]} for k, v in K.CONTRACTS.items()}})
    write_json(P + "fundamentals.json", {"updated": upd, **fund})
    write_json(P + "stack.json", {"updated": upd, **stack, "contracts": {k: {"name": v[0], "tick": v[4], "tv": v[5], "cost": v[6]} for k, v in K.CONTRACTS.items()}})
    return f"{len(score)} strategies, {len(intra)} intraday symbols"
