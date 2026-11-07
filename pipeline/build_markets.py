"""FX, World markets, Central banks, Recession watch."""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

import config as C
from common import change_over, dstr, human_date, now_et_label, r, series_clean, write_json, ytd_change, zscore_move
from sources import fred, prices, worldbank_latest


# ---------------------------------------------------------------- FX
def build_fx():
    tick = [p[2] for p in C.FX_PAIRS]
    df = prices(tick, "2y").ffill()
    pairs, moves, hist = [], {}, {}
    for key, name, yt, quote, dec, group, ccy, inv in C.FX_PAIRS:
        pairs.append({"key": key, "name": name, "quote": quote, "dec": dec, "group": group, "ccy": ccy, "inv": inv})
        s = series_clean(df[yt]) if yt in df else pd.Series(dtype=float)
        d1, z = zscore_move(s)
        moves[key] = {"last": r(s.iloc[-1], dec + 1) if len(s) else None, "d1": d1, "z": z,
                      "w1": change_over(s, 7)[0], "m1": change_over(s, 30)[0], "ytd": ytd_change(s)}
        hist[key] = [r(v, dec + 1) for v in df[yt].tolist()] if yt in df else []
    rates = {}
    for ccy, sid in C.SHORT_RATES.items():
        s = fred(sid, "2023-01-01")
        if len(s):
            rates[ccy] = {"rate": r(s.iloc[-1], 3), "month": s.index[-1].strftime("%Y-%m")}
    asof = human_date(df.index[-1]) if not df.empty else ""
    out = {"asof": asof, "updated": now_et_label(), "pairs": pairs, "moves": moves, "rates": rates,
           "hist": {"dates": [dstr(x) for x in df.index], "series": hist}}
    write_json("fx.json", out)
    return out


# ---------------------------------------------------------------- World
def build_world():
    idx_t = [w[4] for w in C.WORLD]
    fx_t = [w[5] for w in C.WORLD if w[5]]
    df = prices(idx_t + fx_t, "2y").ffill()
    gdp = worldbank_latest("NY.GDP.MKTP.KD.ZG", [w[1] for w in C.WORLD])
    cpi = worldbank_latest("FP.CPI.TOTL.ZG", [w[1] for w in C.WORLD])
    une = worldbank_latest("SL.UEM.TOTL.ZS", [w[1] for w in C.WORLD])
    figures, markets = {}, []
    for iso3, iso2, name, iname, it, ft, inv in C.WORLD:
        markets.append({"iso": iso3, "name": name, "index": iname})
        f = {}
        s = series_clean(df[it]) if it in df else pd.Series(dtype=float)
        when = human_date(s.index[-1]) if len(s) else ""
        if len(s) > 30:
            f["ret1m"] = {"v": r(change_over(s, 30)[0], 2), "when": when, "src": "Yahoo Finance"}
            f["ytd"] = {"v": r(ytd_change(s), 2), "when": when, "src": "Yahoo Finance"}
            vol = s.pct_change().iloc[-63:].std() * np.sqrt(252) * 100
            f["vol3m"] = {"v": r(vol, 2), "when": when, "src": "Yahoo Finance"}
        if ft and ft in df:
            fs = series_clean(df[ft])
            fs = 1 / fs if inv else fs
            f["fx"] = {"v": r(ytd_change(fs), 2), "when": when, "src": "Yahoo Finance, year to date"}
        elif not ft:
            f["fx"] = {"v": 0.0, "when": when, "src": "The dollar itself"}
        y10 = fred(f"IRLTLT01{iso2}M156N", "2023-01-01")
        if len(y10):
            t = y10.index[-1]
            f["y10"] = {"v": r(y10.iloc[-1], 2), "when": f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.month-1]} {t.year}", "src": "OECD via FRED, long-term rate"}
        for k, src, lab in (("gdp", gdp, "World Bank, real GDP growth"), ("cpi", cpi, "World Bank, consumer prices"), ("unemp", une, "World Bank, unemployment")):
            if iso2 in src:
                f[k] = {"v": src[iso2][0], "when": src[iso2][1], "src": lab}
        figures[iso3] = f
    axes = [
        {"k": "ret1m", "label": "Index return, 1 month", "short": "1M return", "move": True},
        {"k": "ytd", "label": "Index return, year to date", "short": "YTD return", "move": True},
        {"k": "vol3m", "label": "Volatility, 3 months", "short": "Volatility", "move": False},
        {"k": "fx", "label": "Currency against the dollar, year to date", "short": "Currency", "move": True},
        {"k": "y10", "label": "10-year government bond yield", "short": "10Y yield", "move": False},
        {"k": "gdp", "label": "GDP growth", "short": "GDP growth", "move": False},
        {"k": "cpi", "label": "Inflation", "short": "Inflation", "move": False},
        {"k": "unemp", "label": "Unemployment", "short": "Unemployment", "move": False},
    ]
    scale = {}
    for a in axes:
        vals = [(iso, figures[iso][a["k"]]["v"]) for iso in figures if a["k"] in figures[iso] and figures[iso][a["k"]]["v"] is not None]
        if vals:
            lo = min(vals, key=lambda x: x[1]); hi = max(vals, key=lambda x: x[1])
            scale[a["k"]] = {"lo": lo[1], "hi": hi[1], "lo_m": lo[0], "hi_m": hi[0]}
    # rebased 1Y index lines for the "each market" section
    lines = {}
    for iso3, *_rest in C.WORLD:
        it = _rest[3]
        if it in df:
            s = series_clean(df[it]); s = s[s.index >= s.index[-1] - pd.Timedelta(days=365)]
            if len(s):
                lines[iso3] = [r(v / s.iloc[0] * 100, 2) for v in s.iloc[::3].tolist()]
    write_json("world.json", {"updated": now_et_label(), "axes": axes, "markets": markets, "figures": figures, "scale": scale, "lines": lines})


# ---------------------------------------------------------------- Central banks
def build_central_banks():
    today = pd.Timestamp(date.today())
    banks = []
    for b in C.CENTRAL_BANKS:
        steps = [list(x) for x in b["steps"]]
        lower = None
        asof = steps[-1][0]
        try:
            if "fred_upper" in b:
                up = fred(b["fred_upper"], "2019-01-01"); lo = fred(b["fred_lower"], "2019-01-01")
                if len(up):
                    steps = _to_steps(up); lower = _to_steps(lo); asof = dstr(up.index[-1])
            elif "fred" in b:
                s = fred(b["fred"], "2019-01-01")
                if len(s):
                    steps = _to_steps(s); asof = dstr(s.index[-1])
        except Exception:  # noqa: BLE001
            pass
        last_move = None
        if len(steps) >= 2:
            last_move = {"date": steps[-1][0], "bp": round((steps[-1][1] - steps[-2][1]) * 100)}
        nxt = next((m for m in b["meetings"] if pd.Timestamp(m) >= today), None)
        banks.append({"key": b["key"], "name": b["name"], "full": b["full"], "label": b["label"], "rate": steps[-1][1],
                      "lower": lower[-1][1] if lower else None, "asof": asof, "steps": steps, "lowerSteps": lower,
                      "last": last_move, "next": nxt, "days": (pd.Timestamp(nxt) - today).days if nxt else None, "meetings": b["meetings"]})
    write_json("central-banks.json", {"updated": now_et_label(), "from": "2019-01-01", "banks": banks})
    return banks


def _to_steps(s: pd.Series):
    s = series_clean(s)
    s = s[s.index >= "2019-01-01"]
    out = []
    prev = None
    for d, v in s.items():
        v = round(float(v), 4)
        if prev is None or v != prev:
            out.append([dstr(d), v]); prev = v
    return out


# ---------------------------------------------------------------- Recession watch
def build_recession():
    out = {"updated": now_et_label()}
    def pack(s, every=1, dec=2):
        s = series_clean(s).iloc[::every]
        return {"dates": [dstr(x) for x in s.index], "values": [r(v, dec) for v in s.tolist()]}
    wk = lambda s: s.resample("W-FRI").last().dropna() if len(s) else s
    curve = fred(C.RECESSION["curve"], "1982-01-01")
    out["curve"] = pack(wk(curve))
    out["sahm"] = pack(fred(C.RECESSION["sahm"], "1970-01-01"))
    claims = fred(C.RECESSION["claims"], "1970-01-01")
    out["claims"] = pack(claims / 1000, dec=0)
    out["claims4"] = pack((claims / 1000).rolling(4).mean().dropna(), dec=1)
    hy = fred(C.RECESSION["hy"], "1997-01-01")
    out["hy"] = pack(wk(hy))
    out["nfci"] = pack(fred(C.RECESSION["nfci"], "1971-01-01"))
    rec = fred(C.RECESSION["rec"], "1960-01-01")
    periods, start = [], None
    for d, v in rec.items():
        if v == 1 and start is None:
            start = d
        if v == 0 and start is not None:
            periods.append([dstr(start), dstr(d - pd.DateOffset(months=1))]); start = None
    if start is not None:
        periods.append([dstr(start), dstr(rec.index[-1])])
    out["rec"] = periods

    def latest(key, rule, unit, dec=2):
        p = out[key]
        if not p["values"]:
            return {"key": key, "latest": None}
        v = p["values"][-1]
        prev_i = max(0, len(p["values"]) - (5 if key in ("curve", "claims", "hy", "nfci") else 2))
        return {"key": key, "latest": v, "date": p["dates"][-1], "prev": p["values"][prev_i], "signal": rule(v), "unit": unit}
    out["readings"] = [
        latest("curve", lambda v: "Inverted" if v < 0 else "Positive", "pp"),
        latest("sahm", lambda v: "Triggered" if v >= 0.5 else "Not triggered", "pp"),
        latest("claims", lambda v: "Elevated" if v >= 300 else "Low", "k"),
        latest("hy", lambda v: "Stress" if v >= 6 else ("Watch" if v >= 4.5 else "Calm"), "%"),
        latest("nfci", lambda v: "Tighter than average" if v > 0 else "Looser than average", ""),
    ]
    write_json("recession.json", out)
