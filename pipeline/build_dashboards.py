"""Les 9 dashboards + le résumé des tuiles de la page /dashboards/."""
from __future__ import annotations

import numpy as np
import pandas as pd

import config as C
from common import RANGE_DAYS, change_over, dstr, human_date, perf_block, r, series_clean, write_json
from sources import fred, prices

META = {
    "sector-heatmap": ("Sector heatmap", "Equities", "Every S&P 500 sector, ranked by the day's move.", "Yahoo Finance, sector ETFs"),
    "volatility-term-structure": ("Volatility term structure", "Cross-asset", "Implied volatility across expiries, and how its shape is shifting.", "Cboe, Yahoo Finance"),
    "global-indices": ("Global indices", "Equities", "Major equity benchmarks across the US, Europe and Asia.", "Yahoo Finance, local closes"),
    "fx-majors": ("FX majors", "Cross-asset", "The dollar against the major currencies.", "Yahoo Finance"),
    "commodities": ("Commodities", "Cross-asset", "Oil, metals and grains, rebased to the same start.", "Futures, Yahoo Finance"),
    "credit-spreads": ("Credit spreads", "Rates", "High yield and investment grade spreads over Treasuries.", "ICE BofA, FRED"),
    "inflation-and-labour": ("Inflation and labour", "Macro", "Inflation prints alongside the monthly jobs report.", "BLS, BEA, FRED"),
    "watchlist-breadth": ("Watchlist breadth", "Equities", "Advancers less decliners across a watchlist of 26 US large caps, session by session.", "Opsilon watchlist, Yahoo Finance"),
    "cross-asset-correlation": ("Cross-asset correlation", "Cross-asset", "How stocks, bonds, the dollar and commodities move together.", "Yahoo Finance, daily returns"),
}


def _base(id_, asof):
    t, cat, lede, src = META[id_]
    return {"id": id_, "title": t, "cat": cat, "lede": lede, "source": src, "asof": asof}


def build():
    tiles = []
    # ---------------------------------------------------------- perf-type
    groups = {
        "sector-heatmap": (C.SECTORS, None),
        "global-indices": (C.GLOBAL_INDICES, None),
        "fx-majors": ([(n, t) for n, t, _ in C.FX_MAJORS_DASH], [inv for _, _, inv in C.FX_MAJORS_DASH]),
    }
    for id_, (pairs, inv) in groups.items():
        names = [p[0] for p in pairs]; cols = [p[1] for p in pairs]
        df = prices(cols, "2y")
        blk = perf_block(df, names, cols, invert=inv)
        asof = human_date(df.dropna(how="all").index[-1]) if not df.empty else ""
        d = _base(id_, asof) | {"kind": "perf"} | blk
        if id_ == "fx-majors":
            d["sign"] = True
        write_json(f"dashboards/{id_}.json", d)
        vals = blk["ranges"]["1D"]["values"]
        tiles.append(_perf_tile(d, vals))

    # ---------------------------------------------------------- commodities
    names = [n for n, _ in C.COMMODITIES]; cols = [t for _, t in C.COMMODITIES]
    df = prices(cols, "2y").ffill()
    d = _base("commodities", human_date(df.index[-1]) if not df.empty else "") | {
        "kind": "lines", "rebase": True, "dates": [dstr(x) for x in df.index], "ranges": ["1M", "3M", "6M", "1Y", "2Y"],
        "series": [{"name": n, "values": [r(v, 3) for v in df[c].tolist()] if c in df else [], "on": i < 2} for i, (n, c) in enumerate(zip(names, cols))]}
    write_json("dashboards/commodities.json", d)
    m1 = {n: change_over(df[c], 30)[0] if c in df else None for n, c in zip(names, cols)}
    tiles.append({"id": "commodities", "title": META["commodities"][0], "cat": "Cross-asset", "src": f"{META['commodities'][3]}, {d['asof']}",
                  "rows": [[n, v] for n, v in m1.items()], "head": _best(m1, "1 month")})

    # ---------------------------------------------------------- credit
    ser = {n: fred(sid, "2024-01-01") for n, sid in C.CREDIT_SPREADS}
    cdf = pd.DataFrame(ser).sort_index().ffill()
    cdf = cdf[cdf.index >= cdf.index[-1] - pd.Timedelta(days=760)] if not cdf.empty else cdf
    d = _base("credit-spreads", human_date(cdf.index[-1]) if not cdf.empty else "") | {
        "kind": "lines", "unit": "%", "dec": 2, "dates": [dstr(x) for x in cdf.index], "ranges": ["1M", "3M", "6M", "1Y", "2Y"],
        "series": [{"name": n, "values": [r(v, 3) for v in cdf[n].tolist()] if n in cdf else [], "on": i < 2} for i, (n, _) in enumerate(C.CREDIT_SPREADS)]}
    write_json("dashboards/credit-spreads.json", d)
    hy = cdf["High yield"] if "High yield" in cdf else pd.Series(dtype=float)
    ig = cdf["Investment grade"] if "Investment grade" in cdf else pd.Series(dtype=float)
    tiles.append({"id": "credit-spreads", "title": "Credit spreads", "cat": "Rates", "src": f"ICE BofA, FRED, {d['asof']}",
                  "spark": [r(v, 3) for v in hy.iloc[-130:].tolist()], "spark2": [r(v, 3) for v in ig.iloc[-130:].tolist()],
                  "head": {"label": "High yield", "value": r(hy.iloc[-1], 2) if len(hy) else None, "unit": "%",
                           "chg": r((hy.iloc[-1] - hy.iloc[-22]) * 100, 0) if len(hy) > 22 else None, "chg_unit": "bp in a month"}})

    # ---------------------------------------------------------- vol curve
    vt = [t for _, t, _ in C.VOL_CURVE]
    vdf = prices(vt, "2y").ffill().dropna()
    if not vdf.empty:
        last = vdf.iloc[-1]
        comp = {}
        for rg in ("1W", "1M", "3M", "6M", "1Y"):
            past = vdf[vdf.index <= vdf.index[-1] - pd.Timedelta(days=RANGE_DAYS[rg])]
            if not past.empty:
                comp[rg] = {"date": dstr(past.index[-1]), "values": [r(past.iloc[-1][t], 2) for t in vt]}
        d = _base("volatility-term-structure", human_date(vdf.index[-1])) | {
            "kind": "curve", "labels": [l for l, _, _ in C.VOL_CURVE], "days": [dd for _, _, dd in C.VOL_CURVE],
            "date": dstr(vdf.index[-1]), "values": [r(last[t], 2) for t in vt], "compare": comp, "dec": 2,
            "hist": {"dates": [dstr(x) for x in vdf.index], "series": [[r(v, 2) for v in vdf[t].tolist()] for t in vt]}}
        write_json("dashboards/volatility-term-structure.json", d)
        wk = comp.get("1W", {}).get("values", [None] * 4)
        tiles.append({"id": "volatility-term-structure", "title": "Volatility term structure", "cat": "Cross-asset",
                      "src": f"Cboe, Yahoo Finance, {d['asof']}", "labels": ["9 days", "1 month", "3 months", "6 months"],
                      "values": d["values"], "compare": wk, "compare_date": human_date(comp["1W"]["date"]) if "1W" in comp else "",
                      "head": {"label": "VIX", "value": d["values"][1], "chg": r(d["values"][1] - wk[1], 2) if wk[1] else None,
                               "inverted": bool(d["values"][0] and d["values"][1] and d["values"][0] > d["values"][1])}})

    # ---------------------------------------------------------- macro
    cpi = fred(C.MACRO["cpi"], "2015-01-01"); core = fred(C.MACRO["core"], "2015-01-01")
    pce = fred(C.MACRO["pce"], "2015-01-01"); cpce = fred(C.MACRO["corepce"], "2015-01-01")
    pay = fred(C.MACRO["payems"], "2015-01-01"); un = fred(C.MACRO["unrate"], "2015-01-01")
    yoy = lambda s: (s / s.shift(12) - 1) * 100
    mdf = pd.DataFrame({"cpi": yoy(cpi), "core": yoy(core), "pce": yoy(pce), "corepce": yoy(cpce), "jobs": pay.diff(), "unrate": un})
    mdf = mdf[mdf.index >= mdf.index.max() - pd.DateOffset(months=62)] if not mdf.empty else mdf
    if not mdf.empty:
        d = _base("inflation-and-labour", (lambda t: f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.month-1]} {t.year}")(cpi.index[-1]) if len(cpi) else "") | {
            "kind": "macro", "dates": [dstr(x) for x in mdf.index], "ranges": ["1Y", "2Y", "5Y"],
            "measures": [{"name": "CPI", "values": [r(v, 2) for v in mdf["cpi"]]}, {"name": "Core CPI", "values": [r(v, 2) for v in mdf["core"]]},
                         {"name": "PCE", "values": [r(v, 2) for v in mdf["pce"]]}, {"name": "Core PCE", "values": [r(v, 2) for v in mdf["corepce"]]}],
            "jobs": [r(v, 0) for v in mdf["jobs"]], "unrate": [r(v, 1) for v in mdf["unrate"]]}
        write_json("dashboards/inflation-and-labour.json", d)
        lastc = mdf["cpi"].dropna()
        tiles.append({"id": "inflation-and-labour", "title": "Inflation and labour", "cat": "Macro", "src": f"BLS, FRED, {d['asof']}",
                      "head": {"label": "CPI", "value": r(lastc.iloc[-1], 1) if len(lastc) else None, "unit": "% a year",
                               "prev": r(lastc.iloc[-2], 1) if len(lastc) > 1 else None},
                      "bars": [r(v, 0) for v in mdf["jobs"].iloc[-12:]], "line": [r(v, 2) for v in mdf["cpi"].iloc[-12:]],
                      "unrate": r(mdf["unrate"].dropna().iloc[-1], 1) if mdf["unrate"].notna().any() else None,
                      "jobs_last": r(mdf["jobs"].dropna().iloc[-1], 0) if mdf["jobs"].notna().any() else None})

    # ---------------------------------------------------------- breadth
    wdf = prices(C.WATCHLIST, "6mo").dropna(how="all")
    ret = wdf.pct_change()
    sessions = []
    for ts, row in ret.iloc[1:].iterrows():
        vals = row.dropna()
        sessions.append([dstr(ts), int((vals > 0.0005).sum()), int((vals < -0.0005).sum()), int(((vals.abs()) <= 0.0005).sum())])
    sessions = sessions[-66:]
    d = _base("watchlist-breadth", human_date(wdf.index[-1]) if not wdf.empty else "") | {"kind": "breadth", "sessions": sessions, "ranges": ["1M", "3M"], "names": C.WATCHLIST}
    write_json("dashboards/watchlist-breadth.json", d)
    if sessions:
        lastb = sessions[-1]
        tiles.append({"id": "watchlist-breadth", "title": "Watchlist breadth", "cat": "Equities", "src": f"Yahoo Finance, {d['asof']}",
                      "net": [s[1] - s[2] for s in sessions[-22:]], "head": {"label": "Net breadth", "value": lastb[1] - lastb[2], "up": lastb[1], "down": lastb[2]}})

    # ---------------------------------------------------------- correlation
    names = [n for n, _, _ in C.CROSS_ASSET]; short = [s for _, s, _ in C.CROSS_ASSET]; cols = [t for _, _, t in C.CROSS_ASSET]
    xdf = prices(cols, "2y").ffill().dropna()
    rets = xdf.pct_change().dropna()
    windows = {}
    for rg, n in (("1M", 21), ("3M", 63), ("6M", 126), ("1Y", 252)):
        sub = rets.iloc[-n:]
        if len(sub) > 5:
            m = sub[cols].corr().values
            windows[rg] = {"sessions": len(sub), "from": dstr(sub.index[0]), "matrix": [[r(v, 2) for v in row] for row in m]}
    # rolling 3M correlation of each pair with the S&P 500 (weekly samples)
    roll = {}
    for c, nm in zip(cols[1:], names[1:]):
        rc = rets[cols[0]].rolling(63).corr(rets[c]).dropna()
        rc = rc.iloc[::5]
        roll[nm] = [r(v, 2) for v in rc.tolist()]
    rdates = [dstr(x) for x in rets[cols[0]].rolling(63).corr(rets[cols[1]]).dropna().index[::5]]
    d = _base("cross-asset-correlation", human_date(xdf.index[-1]) if not xdf.empty else "") | {
        "kind": "matrix", "names": names, "short": short, "windows": windows, "rolling": {"dates": rdates, "series": roll}}
    write_json("dashboards/cross-asset-correlation.json", d)
    if "3M" in windows:
        tiles.append({"id": "cross-asset-correlation", "title": "Cross-asset correlation", "cat": "Cross-asset", "src": f"Yahoo Finance, {d['asof']}",
                      "short": short, "matrix": windows["3M"]["matrix"],
                      "head": {"label": "S&P 500 and long Treasuries, 3 months", "value": windows["3M"]["matrix"][0][1]}})

    order = list(META.keys())
    tiles.sort(key=lambda t: order.index(t["id"]))
    asof = next((t.get("src", "").split(", ")[-1] for t in tiles if t.get("src")), "")
    write_json("dashboards/index.json", {"asof": asof, "tiles": tiles, "meta": {k: {"title": v[0], "cat": v[1], "lede": v[2], "source": v[3]} for k, v in META.items()}})
    return len(tiles)


def _best(m: dict, label):
    vals = {k: v for k, v in m.items() if v is not None}
    if not vals:
        return {}
    k = max(vals, key=lambda x: abs(vals[x]))
    return {"label": k, "value": vals[k], "period": label}


def _perf_tile(d, vals):
    names = d["names"]
    pairs = [(n, v) for n, v in zip(names, vals) if v is not None]
    pairs.sort(key=lambda x: -x[1])
    up = sum(1 for _, v in pairs if v > 0)
    weakest = pairs[-1] if pairs else (None, None)
    strongest = pairs[0] if pairs else (None, None)
    return {"id": d["id"], "title": d["title"], "cat": d["cat"], "src": f"{d['source']}, {d['asof']}", "rows": pairs,
            "up": up, "n": len(pairs), "weakest": weakest, "strongest": strongest}
