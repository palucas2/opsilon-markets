"""Section Commodities : courbes de futures, spreads, fondamentaux, positionnement,
logistique, macro et météo.

Sources (toutes gratuites, sans clé) :
  - Yahoo Finance : contrats à terme continus (=F) et contrats individuels (CLF27.NYM…)
  - CFTC Public Reporting (Socrata) : Commitments of Traders, désagrégé, futures seuls
  - EIA : Weekly Petroleum Status Report (tables 1 et 9) et stockage de gaz (wngsr.json)
  - IMF PortWatch (ArcGIS) : transits quotidiens par détroit et canal
  - Open-Meteo : prévisions 16 jours, ensemble ECMWF 35 jours, archive 10 ans (normales)
  - FRED : commerce extérieur chinois

Chaque bloc est isolé : si une source tombe, le reste est écrit, et le fichier
de la veille reste en place pour le bloc manquant.
"""
from __future__ import annotations

import io
import json
import logging
import math
import re
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

import commodities_config as C
from common import ARCHIVE, CACHE, OUT, dstr, human_date, now_et_label, r, read_json, write_json
from sources import MOCK, UA, _seed, fred

log = logging.getLogger("opsilon")
P = "commodities/"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def _get(url, timeout=30, retries=3, as_json=True, sleep=3):
    last = None
    for a in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", "replace")
            return json.loads(raw) if as_json else raw
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(sleep * (a + 1))
    log.warning("GET %s failed: %s", url[:120], last)
    return None


# ---------------------------------------------------------------------------
# Prices (close + volume)
# ---------------------------------------------------------------------------
_MOCK_LVL = {"CL": 61.5, "BZ": 65.4, "NG": 3.45, "RB": 1.95, "HO": 2.35, "GC": 4000, "SI": 48.0, "HG": 5.05, "PL": 1550, "PA": 1400,
             "ALI": 2650, "TIO": 104, "ZC": 430, "ZW": 535, "ZS": 1120, "ZM": 320, "ZL": 50.5, "KC": 390, "CC": 6200, "SB": 14.8,
             "CT": 64.5, "LE": 228, "HE": 82, "DX-Y.NYB": 99.5, "BDRY": 9.8, "BWET": 70, "FRO": 24, "ZIM": 15, "CNY=X": 7.12,
             "FXI": 39, "^GSPC": 6700}
# curve slope per month (mock): + contango, - backwardation
_MOCK_SLOPE = {"CL": -.006, "BZ": -.005, "NG": .025, "RB": -.01, "HO": -.008, "GC": .0035, "SI": .004, "HG": .002, "ZC": .012,
               "ZW": .011, "ZS": .004, "KC": -.012, "CC": -.02, "SB": .003, "LE": -.004, "HE": .02}


_CONTRACT = re.compile(r"^([A-Z]{1,3})([FGHJKMNQUVXZ])(\d{2})\.(NYM|CMX|CBT|NYB|CME)$")


def _mock_root(t):
    if t.endswith("=F"):
        return t[:-2]
    m = _CONTRACT.match(t)
    return m.group(1) if m else t


def _bdays(years):
    end = pd.Timestamp(date.today()) - pd.Timedelta(days=1)
    return pd.bdate_range(end - pd.Timedelta(days=int(365.25 * years)), end)


def _mock_ohlc(tickers, years):
    idx = _bdays(years)
    close, vol = {}, {}
    for t in tickers:
        root = _mock_root(t)
        rng = np.random.default_rng(_seed(root))
        lvl = _MOCK_LVL.get(root, _MOCK_LVL.get(t, float(np.random.default_rng(_seed(t)).uniform(20, 300))))
        x = np.zeros(len(idx))
        season = 0.04 * np.sin(2 * np.pi * (idx.dayofyear.values + _seed(root) % 365) / 365.25)
        for i in range(1, len(idx)):
            x[i] = x[i - 1] + rng.normal(0.0001, 0.017)
        path = np.exp(x + season)
        path = path / path[-1] * lvl
        if t != front_or_none(t):          # a dated contract: front path times carry
            yy, mm = int(t.split(".")[0][-2:]), C.ALL.index(t.split(".")[0][-3]) + 1
            today = date.today()
            months = (2000 + yy - today.year) * 12 + mm - today.month
            slope = _MOCK_SLOPE.get(root, .003)
            noise = np.random.default_rng(_seed(t)).normal(0, .002, len(idx)).cumsum() * .2
            path = path * (1 + slope * months + noise)
            start_ok = max(0, len(idx) - 260 - 40 * max(months, 0))
            path[:start_ok] = np.nan
            v = np.maximum(50, 150000 * np.exp(-months / 3.5) * rng.uniform(.6, 1.4, len(idx)))
        else:
            v = 200000 * rng.uniform(.6, 1.4, len(idx))
        close[t] = np.round(path, 4)
        vol[t] = np.round(v)
    return pd.DataFrame(close, index=idx), pd.DataFrame(vol, index=idx)


def front_or_none(t):
    return None if _CONTRACT.match(t) else t


def ohlc(tickers, years=2):
    """Daily close and volume, one column per ticker."""
    tickers = list(dict.fromkeys(tickers))
    if MOCK:
        return _mock_ohlc(tickers, years)
    import yfinance as yf
    closes, vols = [], []
    for i in range(0, len(tickers), 60):
        chunk = tickers[i:i + 60]
        for a in range(3):
            try:
                raw = yf.download(chunk, period=f"{years}y", interval="1d", auto_adjust=False, progress=False, threads=True, group_by="column")
                if raw is None or raw.empty:
                    raise RuntimeError("empty")
                c = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Close"]].rename(columns={"Close": chunk[0]})
                v = raw["Volume"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Volume"]].rename(columns={"Volume": chunk[0]})
                closes.append(c); vols.append(v)
                break
            except Exception as e:  # noqa: BLE001
                log.warning("yf ohlc %s (try %d): %s", chunk[:2], a + 1, e)
                time.sleep(4 * (a + 1))
    if not closes:
        return pd.DataFrame(), pd.DataFrame()

    def tidy(frames):
        df = pd.concat(frames, axis=1)
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
        df = df.loc[:, ~df.columns.duplicated()].sort_index()
        df = df[~df.index.duplicated(keep="last")]
        return df[df.index.dayofweek < 5]
    return tidy(closes), tidy(vols)


# ---------------------------------------------------------------------------
# Small maths
# ---------------------------------------------------------------------------
def chg(s, days):
    s = s.dropna()
    if len(s) < 2:
        return None
    if days == 1:
        return r((s.iloc[-1] / s.iloc[-2] - 1) * 100, 2)
    prior = s[s.index <= s.index[-1] - pd.Timedelta(days=days)]
    return r((s.iloc[-1] / prior.iloc[-1] - 1) * 100, 2) if len(prior) else None


def ytd(s):
    s = s.dropna()
    if s.empty:
        return None
    prior = s[s.index < pd.Timestamp(f"{s.index[-1].year}-01-01")]
    return r((s.iloc[-1] / prior.iloc[-1] - 1) * 100, 2) if len(prior) else None


def pctile(s, v):
    s = pd.Series(s).dropna()
    if s.empty or v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return r((s < v).mean() * 100, 0)


def compact(s, dec=4):
    s = s.dropna()
    return {"d": [dstr(d) for d in s.index], "v": [r(x, dec) for x in s.values]}


def weekly(s):
    return s.dropna().resample("W-FRI").last().dropna()


# ---------------------------------------------------------------------------
# 1. Futures curves
# ---------------------------------------------------------------------------
def contract_list(spec, today):
    key, name, grp, root, exch, months, unit, cftc, dec, ahead = spec
    out = []
    if not exch or not months:
        return out
    y, m = today.year, today.month
    for k in range(ahead + 1):
        mm = (m - 1 + k) % 12 + 1
        yy = y + (m - 1 + k) // 12
        code = C.MONTH_CODE[mm]
        if code in months:
            out.append((f"{root}{code}{str(yy)[2:]}.{exch}", yy, mm))
    return out


def label_contract(yy, mm):
    return f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mm - 1]} {str(yy)[2:]}"


def curve_at(contracts, closes, when, max_stale=6):
    pts = []
    for t, yy, mm in contracts:
        if t not in closes:
            continue
        s = closes[t].dropna()
        s = s[s.index <= when]
        if s.empty or (when - s.index[-1]).days > max_stale:
            continue
        pts.append({"t": t, "lab": label_contract(yy, mm), "y": yy, "m": mm, "px": float(s.iloc[-1])})
    return pts


def curve_metrics(pts, today):
    if len(pts) < 2:
        return {}
    f = pts[0]
    m_of = lambda p: (p["y"] - f["y"]) * 12 + p["m"] - f["m"]
    six = min(pts[1:], key=lambda p: abs(m_of(p) - 6))
    twelve = min(pts[1:], key=lambda p: abs(m_of(p) - 12))
    n6 = max(1, m_of(six))
    roll = (f["px"] / six["px"] - 1) * 12 / n6 * 100       # annualised; + = backwardation
    m1m2 = f["px"] - pts[1]["px"]
    shape = "Backwardation" if roll > 1 else "Contango" if roll < -1 else "Flat"
    # mixed: front in one direction, back in the other
    if len(pts) >= 4:
        back = (twelve["px"] - six["px"])
        front = (six["px"] - f["px"])
        if front * back < 0 and abs(back) / f["px"] > .01 and abs(front) / f["px"] > .01:
            shape = "Mixed"
    return {"front": f["lab"], "six": six["lab"], "twelve": twelve["lab"], "m1m2": r(m1m2, 4), "m1_six": r(f["px"] - six["px"], 4),
            "m1_six_pct": r((f["px"] / six["px"] - 1) * 100, 2), "roll": r(roll, 2), "shape": shape}


# ---------------------------------------------------------------------------
# 2. COT
# ---------------------------------------------------------------------------
COT_FIELDS = ["report_date_as_yyyy_mm_dd", "cftc_contract_market_code", "open_interest_all",
              "m_money_positions_long_all", "m_money_positions_short_all", "m_money_positions_spread",
              "prod_merc_positions_long", "prod_merc_positions_short", "swap_positions_long_all", "swap__positions_short_all",
              "other_rept_positions_long", "other_rept_positions_short", "nonrept_positions_long_all", "nonrept_positions_short_all",
              "traders_m_money_long_all", "traders_m_money_short_all"]


def cot_all(codes, years=5):
    if MOCK:
        return _mock_cot(codes, years)
    start = (date.today() - timedelta(days=int(365.25 * years))).isoformat()
    where = f"report_date_as_yyyy_mm_dd >= '{start}T00:00:00.000' AND cftc_contract_market_code in({','.join(repr(c) for c in codes)})"
    rows, off = [], 0
    while True:
        q = urllib.parse.urlencode({"$select": ",".join(COT_FIELDS), "$where": where, "$order": "report_date_as_yyyy_mm_dd",
                                    "$limit": 5000, "$offset": off})
        j = _get("https://publicreporting.cftc.gov/resource/72hh-3qpy.json?" + q, timeout=60)
        if not j:
            break
        rows += j
        if len(j) < 5000:
            break
        off += 5000
    if not rows:
        return {}
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["report_date_as_yyyy_mm_dd"].str[:10])
    for c in COT_FIELDS[2:]:
        df[c] = pd.to_numeric(df.get(c), errors="coerce")
    return {code: g.set_index("date").sort_index() for code, g in df.groupby("cftc_contract_market_code")}


def _mock_cot(codes, years):
    idx = pd.date_range(pd.Timestamp(date.today()) - pd.Timedelta(days=int(365.25 * years)), pd.Timestamp(date.today()), freq="W-TUE")
    out = {}
    for c in codes:
        rng = np.random.default_rng(_seed("cot" + c))
        oi = 400000 * np.exp(np.cumsum(rng.normal(0, .02, len(idx))))
        mm = np.cumsum(rng.normal(0, .025, len(idx)))
        mm = (mm - mm.mean()) / (mm.std() or 1) * .12
        ml = oi * (.15 + np.maximum(mm, 0)); ms = oi * (.08 + np.maximum(-mm, 0))
        pl = oi * (.25 - mm * .6); ps = oi * (.35 + mm * .6)
        df = pd.DataFrame({"open_interest_all": oi, "m_money_positions_long_all": ml, "m_money_positions_short_all": ms,
                           "m_money_positions_spread": oi * .1, "prod_merc_positions_long": pl, "prod_merc_positions_short": ps,
                           "swap_positions_long_all": oi * .1, "swap__positions_short_all": oi * .12,
                           "other_rept_positions_long": oi * .1, "other_rept_positions_short": oi * .08,
                           "nonrept_positions_long_all": oi * .05, "nonrept_positions_short_all": oi * .06,
                           "traders_m_money_long_all": 60 + 20 * mm, "traders_m_money_short_all": 40 - 20 * mm}, index=idx)
        out[c] = df.round(0)
    return out


def cot_block(df):
    if df is None or df.empty:
        return None
    mm = df["m_money_positions_long_all"] - df["m_money_positions_short_all"]
    pr = df["prod_merc_positions_long"] - df["prod_merc_positions_short"]
    sw = df["swap_positions_long_all"] - df["swap__positions_short_all"]
    ot = df["other_rept_positions_long"] - df["other_rept_positions_short"]
    nr = df["nonrept_positions_long_all"] - df["nonrept_positions_short_all"]
    oi = df["open_interest_all"]
    mm_pct_oi = mm / oi * 100
    last3 = mm[mm.index >= mm.index[-1] - pd.Timedelta(days=3 * 365)]
    p = pctile(last3.iloc[:-1], float(mm.iloc[-1]))
    z = (mm.iloc[-1] - last3.mean()) / last3.std() if last3.std() else None
    flag = "Crowded long" if p is not None and p >= 90 else "Crowded short" if p is not None and p <= 10 else None
    return {
        "asof": dstr(df.index[-1]),
        "mm_net": r(mm.iloc[-1], 0), "mm_chg": r(mm.iloc[-1] - mm.iloc[-2], 0) if len(mm) > 1 else None,
        "mm_long": r(df["m_money_positions_long_all"].iloc[-1], 0), "mm_short": r(df["m_money_positions_short_all"].iloc[-1], 0),
        "mm_pct_oi": r(mm_pct_oi.iloc[-1], 1), "pctile3y": p, "z3y": r(z, 2), "flag": flag,
        "prod_net": r(pr.iloc[-1], 0), "swap_net": r(sw.iloc[-1], 0), "oi": r(oi.iloc[-1], 0),
        "oi_chg": r(oi.iloc[-1] - oi.iloc[-2], 0) if len(oi) > 1 else None,
        "oi_chg_pct": r((oi.iloc[-1] / oi.iloc[-2] - 1) * 100, 1) if len(oi) > 1 and oi.iloc[-2] else None,
        "traders_long": r(df["traders_m_money_long_all"].iloc[-1], 0), "traders_short": r(df["traders_m_money_short_all"].iloc[-1], 0),
        "hist": {"d": [dstr(d) for d in df.index], "mm": [r(x, 0) for x in mm], "prod": [r(x, 0) for x in pr], "swap": [r(x, 0) for x in sw],
                 "other": [r(x, 0) for x in ot], "nonrep": [r(x, 0) for x in nr], "oi": [r(x, 0) for x in oi]},
    }


# ---------------------------------------------------------------------------
# 3. Seasonality
# ---------------------------------------------------------------------------
def seasonality(s):
    """Path of each calendar year as % change from the year's first close, on a day-of-year grid."""
    s = s.dropna()
    if len(s) < 400:
        return None
    daily = s.resample("D").last().ffill()
    cur_y = s.index[-1].year
    grid = list(range(1, 366, 3))
    paths = {}
    for y in range(cur_y - 10, cur_y + 1):
        ys = daily[daily.index.year == y]
        if len(ys) < 30:
            continue
        base = ys.iloc[0]
        doy = ys.index.dayofyear
        v = pd.Series((ys.values / base - 1) * 100, index=doy)
        paths[y] = [r(v.get(g), 2) if g in v.index else None for g in grid]
    past = [y for y in paths if y < cur_y]
    def avg(years):
        arr = np.array([[np.nan if x is None else x for x in paths[y]] for y in years if y in paths], dtype=float)
        if not len(arr):
            return None
        return [r(x, 2) for x in np.nanmean(arr, axis=0)]
    def band(years, q):
        arr = np.array([[np.nan if x is None else x for x in paths[y]] for y in years if y in paths], dtype=float)
        return [r(x, 2) for x in np.nanpercentile(arr, q, axis=0)] if len(arr) else None
    last5, last10 = past[-5:], past[-10:]
    cur = paths.get(cur_y)
    today_doy = s.index[-1].dayofyear
    gi = max(0, min(len(grid) - 1, (today_doy - 1) // 3))
    a5 = avg(last5)
    dev = None
    if cur and a5 and cur[gi] is not None and a5[gi] is not None:
        dev = r(cur[gi] - a5[gi], 2)
    # average return over the next 30 days in past years, from today's date
    fwd = []
    for y in past[-10:]:
        ys = daily[daily.index.year == y]
        try:
            a = ys[ys.index.dayofyear >= today_doy].iloc[0]
            b = daily[daily.index >= ys[ys.index.dayofyear >= today_doy].index[0] + pd.Timedelta(days=30)].iloc[0]
            fwd.append((b / a - 1) * 100)
        except Exception:  # noqa: BLE001
            pass
    return {"grid": grid, "cur_year": cur_y, "cur": cur, "last": paths.get(cur_y - 1), "avg5": a5, "avg10": avg(last10),
            "lo10": band(last10, 10), "hi10": band(last10, 90), "years5": [last5[0], last5[-1]] if last5 else None,
            "years10": [last10[0], last10[-1]] if last10 else None, "dev5": dev, "today_i": gi,
            "fwd30_avg": r(np.mean(fwd), 2) if fwd else None, "fwd30_up": int(sum(1 for x in fwd if x > 0)), "fwd30_n": len(fwd)}


# ---------------------------------------------------------------------------
# 4. EIA weekly
# ---------------------------------------------------------------------------
def _csv_rows(txt):
    import csv
    return list(csv.reader(io.StringIO(txt)))


def _num(x):
    try:
        return float(str(x).replace(",", ""))
    except Exception:  # noqa: BLE001
        return None


def eia_weekly():
    if MOCK:
        return _mock_eia()
    out = {}
    t1 = _get("https://ir.eia.gov/wpsr/table1.csv", as_json=False)
    if t1:
        rows = _csv_rows(t1)
        hdr = rows[0]
        want = {"Crude Oil": "crude_total", "Commercial (Excluding SPR)": "crude", "Strategic Petroleum Reserve (SPR)": "spr",
                "Total Motor Gasoline": "gasoline", "Distillate Fuel Oil": "distillate", "Kerosene-Type Jet Fuel": "jet",
                "Propane/Propylene": "propane", "Total Stocks (Excluding SPR)": "total_ex_spr"}
        stocks = {}
        for row in rows[1:]:
            k = want.get(row[0].strip())
            if k and k not in stocks:
                stocks[k] = {"now": _num(row[1]), "wk": _num(row[2]), "chg": _num(row[3]), "yr": _num(row[5]), "yr_pct": _num(row[7])}
        out["week"] = hdr[1]
        out["stocks"] = stocks
    t9 = _get("https://ir.eia.gov/wpsr/table9.csv", as_json=False)
    if t9:
        rows = _csv_rows(t9)
        hdr = rows[0]
        want = {("Crude Oil Production", "Domestic Production"): "production",
                ("Refiner Inputs and Utilization", "Crude Oil Inputs"): "runs",
                ("Refiner Inputs and Utilization", "Percent Utilization"): "utilization",
                ("Imports", "Total Crude Oil Incl SPR"): "crude_imports", ("Exports", "Crude Oil"): "crude_exports",
                ("Net Imports (Incl SPR)", "Total"): "net_imports",
                ("Product Supplied", "Total Product Supplied"): "demand", ("Product Supplied", "Finished Motor Gasoline"): "gasoline_demand",
                ("Product Supplied", "Distillate Fuel Oil"): "distillate_demand", ("Product Supplied", "Kerosene-Type Jet Fuel"): "jet_demand"}
        flows = {}
        for row in rows[1:]:
            if len(row) < 6:
                continue
            k = want.get((row[0].strip(), row[1].strip()))
            if k and k not in flows:
                # columns: this week, last week, year ago, two years ago, 4-week avg this year, 4-week avg last year
                flows[k] = {"now": _num(row[2]), "wk": _num(row[3]), "yr": _num(row[4]), "avg4": _num(row[6]) if len(row) > 6 else None,
                            "avg4_yr": _num(row[7]) if len(row) > 7 else None}
        out["flows"] = flows
        out["flows_hdr"] = hdr[2:8]
    ng = _get("https://ir.eia.gov/ngs/wngsr.json")
    if ng:
        regs = []
        for s in ng.get("series", []):
            d = s.get("data") or []
            c = s.get("calculated") or {}
            regs.append({"name": s.get("name", "").replace("total lower 48 states", "Lower 48").title().replace("Lower 48", "Lower 48"),
                         "now": d[0][1] if d else None, "wk": d[1][1] if len(d) > 1 else None, "yr": d[2][1] if len(d) > 2 else None,
                         "chg": c.get("net_change"), "avg5": c.get("5yr-avg"), "vs5": c.get("pct-chg_5yr-avg"), "vsyr": c.get("pct-change_yrago")})
        out["gas"] = {"week": ng.get("current_week"), "released": (ng.get("release_date") or "")[:11], "regions": regs}
    return out


def _mock_eia():
    return {"week": "10/30/26", "stocks": {"crude_total": {"now": 691.9, "wk": 693.2, "chg": -1.3, "yr": 830.8, "yr_pct": -16.7},
            "crude": {"now": 409.8, "wk": 410.6, "chg": -0.9, "yr": 421.2, "yr_pct": -2.7}, "spr": {"now": 282.2, "wk": 282.6, "chg": -0.4, "yr": 409.6, "yr_pct": -31.1},
            "gasoline": {"now": 209.0, "wk": 209.2, "chg": -0.2, "yr": 206.0, "yr_pct": 1.4}, "distillate": {"now": 99.3, "wk": 102.8, "chg": -3.6, "yr": 111.5, "yr_pct": -11.0},
            "jet": {"now": 41.8, "wk": 42.2, "chg": -0.4, "yr": 41.7, "yr_pct": 0.2}, "propane": {"now": 104.1, "wk": 105.7, "chg": -1.6, "yr": 106.1, "yr_pct": -1.9},
            "total_ex_spr": {"now": 1204.4, "wk": 1212.6, "chg": -8.2, "yr": 1269.4, "yr_pct": -5.1}},
            "flows": {"production": {"now": 14003, "wk": 13992, "yr": 13651, "avg4": 13736, "avg4_yr": 13640}, "runs": {"now": 16725, "wk": 16526, "yr": 15256},
                      "utilization": {"now": 94.5, "wk": 92.8, "yr": 88.0}, "crude_imports": {"now": 6374, "wk": 6374, "yr": 6100},
                      "crude_exports": {"now": 3675, "wk": 4854, "yr": 4000}, "net_imports": {"now": -3086, "wk": -4839, "yr": -2000},
                      "demand": {"now": 21962, "wk": 20209, "yr": 20900}, "gasoline_demand": {"now": 8808, "wk": 8358, "yr": 8700},
                      "distillate_demand": {"now": 4439, "wk": 4207, "yr": 4000}, "jet_demand": {"now": 1728, "wk": 1679, "yr": 1700}},
            "gas": {"week": "2026-10-30", "released": "2026-Nov-05", "regions": [
                {"name": "Lower 48", "now": 3801, "wk": 3724, "yr": 3910, "chg": 77, "avg5": 3747, "vs5": 1.4, "vsyr": -2.8},
                {"name": "East Region", "now": 900, "wk": 885, "yr": 930, "chg": 15, "avg5": 890, "vs5": 1.1, "vsyr": -3.2},
                {"name": "Midwest Region", "now": 1090, "wk": 1070, "yr": 1120, "chg": 20, "avg5": 1080, "vs5": 0.9, "vsyr": -2.7},
                {"name": "South Central Region", "now": 1230, "wk": 1205, "yr": 1260, "chg": 25, "avg5": 1200, "vs5": 2.5, "vsyr": -2.4}]}}


def eia_history(snap):
    """Archive each weekly snapshot (committed) so the history grows; return the series."""
    if not snap or not snap.get("stocks"):
        return []
    try:
        wk = datetime.strptime(snap["week"], "%m/%d/%y").date().isoformat()
    except Exception:  # noqa: BLE001
        wk = date.today().isoformat()
    hist = read_json("commodities/eia_weekly.json", default=[]) or []
    row = {"w": wk, **{k: v.get("now") for k, v in snap["stocks"].items()},
           **{k: v.get("now") for k, v in (snap.get("flows") or {}).items()},
           "gas": next((x["now"] for x in (snap.get("gas") or {}).get("regions", []) if x["name"] == "Lower 48"), None)}
    hist = [h for h in hist if h.get("w") != wk] + [row]
    hist.sort(key=lambda h: h["w"])
    if not MOCK:
        write_json("commodities/eia_weekly.json", hist[-520:], base=ARCHIVE)
    return hist


# ---------------------------------------------------------------------------
# 5. Chokepoints (IMF PortWatch)
# ---------------------------------------------------------------------------
PW = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"


def portwatch(days=400):
    if MOCK:
        return _mock_portwatch(days)
    start = (date.today() - timedelta(days=days)).isoformat()
    rows, off = [], 0
    for _ in range(20):
        q = urllib.parse.urlencode({"where": f"date >= DATE '{start}'", "outFields": "date,portname,n_total,n_tanker,n_dry_bulk,n_container,capacity_tanker,capacity",
                                    "orderByFields": "date", "resultOffset": off, "resultRecordCount": 2000, "f": "json"})
        j = _get(PW + "?" + q, timeout=60, sleep=20)
        if not j or "features" not in j:
            if j and j.get("error"):
                log.warning("PortWatch: %s", j["error"].get("message"))
            break
        feats = [f["attributes"] for f in j["features"]]
        rows += feats
        if not j.get("exceededTransferLimit") and len(feats) < 2000:
            break
        off += len(feats)
        time.sleep(2)
    if not rows:
        return None
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], unit="ms", errors="coerce") if np.issubdtype(df["date"].dtype, np.number) else pd.to_datetime(df["date"], errors="coerce")
    return df.dropna(subset=["date"])


def _mock_portwatch(days):
    idx = pd.date_range(pd.Timestamp(date.today()) - pd.Timedelta(days=days), pd.Timestamp(date.today()) - pd.Timedelta(days=4))
    rows = []
    for key, name, _ in C.CHOKEPOINTS:
        rng = np.random.default_rng(_seed(key))
        base = rng.uniform(20, 120)
        drop = .45 if key in ("hormuz", "bab", "suez") else 0
        for i, d in enumerate(idx):
            f = 1 - drop * (1 / (1 + math.exp(-(i - len(idx) * .45) / 6))) + drop * .6 * (1 / (1 + math.exp(-(i - len(idx) * .85) / 6)))
            n = max(0, base * f + rng.normal(0, base * .08))
            rows.append({"date": d, "portname": name, "n_total": round(n), "n_tanker": round(n * .35), "n_dry_bulk": round(n * .3),
                         "n_container": round(n * .2), "capacity_tanker": n * .35 * 90000, "capacity": n * 60000})
    return pd.DataFrame(rows)


def chokepoint_block(df):
    if df is None or df.empty:
        return None
    out = []
    names = df["portname"].dropna().unique().tolist()
    for key, label, why in C.CHOKEPOINTS:
        nm = next((n for n in names if key in n.lower()), None)
        if not nm:
            continue
        g = df[df["portname"] == nm].groupby("date")[["n_total", "n_tanker", "n_dry_bulk", "n_container", "capacity_tanker"]].sum().sort_index()
        if g.empty:
            continue
        g = g[g.index >= g.index[-1] - pd.Timedelta(days=380)]
        tot = g["n_total"].astype(float)
        a7 = tot.rolling(7, min_periods=4).mean()
        last7, prev = a7.iloc[-1], tot.iloc[:-30].mean() if len(tot) > 60 else tot.mean()
        yr = a7[a7.index <= a7.index[-1] - pd.Timedelta(days=365)]
        tk = g["n_tanker"].astype(float).rolling(7, min_periods=4).mean()
        status = "Normal"
        ratio = last7 / prev if prev else None
        if ratio is not None:
            status = "Severely disrupted" if ratio < .6 else "Disrupted" if ratio < .85 else "Above normal" if ratio > 1.15 else "Normal"
        out.append({"key": key, "name": label, "src_name": nm, "why": why, "asof": dstr(g.index[-1]),
                    "a7": r(last7, 1), "avg1y": r(prev, 1), "vs_avg": r((ratio - 1) * 100, 1) if ratio else None,
                    "yoy": r((last7 / yr.iloc[-1] - 1) * 100, 1) if len(yr) and yr.iloc[-1] else None,
                    "tank7": r(tk.iloc[-1], 1), "status": status,
                    "hist": {"d": [dstr(d) for d in a7.index], "v": [r(x, 1) for x in a7.values], "tk": [r(x, 1) for x in tk.values]}})
    return out


# ---------------------------------------------------------------------------
# 6. Weather (Open-Meteo)
# ---------------------------------------------------------------------------
def _om(url, params):
    return _get(url + "?" + urllib.parse.urlencode(params), timeout=90, sleep=5)


def weather():
    locs = C.WEATHER
    if MOCK:
        return _mock_weather(locs)
    lat = ",".join(str(l[2]) for l in locs)
    lon = ",".join(str(l[3]) for l in locs)
    fc = _om("https://api.open-meteo.com/v1/forecast", {"latitude": lat, "longitude": lon, "daily": "temperature_2m_mean,precipitation_sum",
                                                         "forecast_days": 16, "timezone": "UTC"})
    ens = _om("https://ensemble-api.open-meteo.com/v1/ensemble", {"latitude": lat, "longitude": lon, "daily": "temperature_2m_mean,precipitation_sum",
                                                                  "models": "ecmwf_ifs025", "forecast_days": 35, "timezone": "UTC"})
    normals = _normals(locs)
    ok = lambda x: isinstance(x, dict) and isinstance(x.get("daily"), dict)
    fc = fc if isinstance(fc, list) else [fc]
    if not any(ok(x) for x in fc):
        log.warning("Open-Meteo forecast unavailable: %s", str(fc)[:160])
        return None
    ens = ens if isinstance(ens, list) else [ens] * len(locs)
    if not any(ok(x) for x in ens):
        log.warning("Open-Meteo ensemble unavailable: %s", str(ens[:1])[:160])
        ens = [None] * len(locs)
    out = []
    for i, l in enumerate(locs):
        f = fc[i]["daily"] if i < len(fc) and ok(fc[i]) else None
        if not f:
            continue
        days = f["time"]
        t = f["temperature_2m_mean"]; p = f["precipitation_sum"]
        e = ens[i]["daily"] if i < len(ens) and ok(ens[i]) else None
        if e:
            def mean_members(var):
                cols = [k for k in e if k.startswith(var)]
                arr = np.array([[np.nan if v is None else v for v in e[k]] for k in cols], dtype=float)
                return np.nanmean(arr, axis=0)
            et, ep = mean_members("temperature_2m_mean"), mean_members("precipitation_sum")
            for k, d in enumerate(e["time"]):
                if d > days[-1]:
                    days.append(d); t.append(r(et[k], 1)); p.append(r(ep[k], 1))
        out.append(_loc_block(l, days, t, p, normals.get(l[0]), ens_from=16))
    return {"asof": date.today().isoformat(), "locs": out}


def _normals(locs):
    """Daily normals (10 years, ±3-day smoothing) by day of year; cached for a week."""
    cache = CACHE / "commodities_normals.json"
    try:
        c = json.loads(cache.read_text())
        if c.get("built") and (date.today() - date.fromisoformat(c["built"])).days < 7 and all(l[0] in c["n"] for l in locs):
            return c["n"]
    except Exception:  # noqa: BLE001
        pass
    end = date.today() - timedelta(days=7)
    start = date(end.year - 10, end.month, 1)
    res = {}
    for l in locs:
        j = _om("https://archive-api.open-meteo.com/v1/archive", {"latitude": l[2], "longitude": l[3], "start_date": start.isoformat(),
                                                                 "end_date": end.isoformat(), "daily": "temperature_2m_mean,precipitation_sum", "timezone": "UTC"})
        if not j or "daily" not in j:
            continue
        df = pd.DataFrame({"t": j["daily"]["temperature_2m_mean"], "p": j["daily"]["precipitation_sum"]}, index=pd.to_datetime(j["daily"]["time"]))
        doy = df.groupby(df.index.dayofyear).mean()
        doy = doy.reindex(range(1, 367)).interpolate()
        sm = pd.concat([doy.iloc[-3:], doy, doy.iloc[:3]]).rolling(7, center=True).mean().iloc[3:-3]
        res[l[0]] = {"t": [r(x, 2) for x in sm["t"].values], "p": [r(x, 2) for x in sm["p"].values]}
        time.sleep(1)
    if res:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps({"built": date.today().isoformat(), "n": res}))
    return res


def _loc_block(l, days, t, p, nrm, ens_from):
    key, name, lat, lon, role, mk = l
    doy = [pd.Timestamp(d).dayofyear for d in days]
    nt = [nrm["t"][x - 1] if nrm else None for x in doy]
    npr = [nrm["p"][x - 1] if nrm else None for x in doy]
    hdd = [max(0, 18 - v) if v is not None else None for v in t]
    cdd = [max(0, v - 18) if v is not None else None for v in t]
    nhdd = [max(0, 18 - v) if v is not None else None for v in nt]
    ncdd = [max(0, v - 18) if v is not None else None for v in nt]

    def seg(a, b):
        tt = [x for x in t[a:b] if x is not None]; nn = [x for x in nt[a:b] if x is not None]
        pp = [x for x in p[a:b] if x is not None]; nq = [x for x in npr[a:b] if x is not None]
        hd = sum(x for x in hdd[a:b] if x is not None); nh = sum(x for x in nhdd[a:b] if x is not None)
        cd = sum(x for x in cdd[a:b] if x is not None); nc = sum(x for x in ncdd[a:b] if x is not None)
        return {"t_anom": r(np.mean(tt) - np.mean(nn), 1) if tt and nn else None, "p": r(sum(pp), 0) if pp else None,
                "p_norm": r(sum(nq), 0) if nq else None, "p_pct": r(sum(pp) / sum(nq) * 100, 0) if pp and nq and sum(nq) > 0 else None,
                "hdd": r(hd, 0), "hdd_n": r(nh, 0), "cdd": r(cd, 0), "cdd_n": r(nc, 0)}
    return {"key": key, "name": name, "role": role, "markets": mk, "days": days, "t": t, "p": p, "nt": nt, "np": npr,
            "ens_from": min(ens_from, len(days)), "w1_2": seg(0, 14), "w3_5": seg(14, 35) if len(days) > 16 else None}


def _mock_weather(locs):
    out = []
    days = [(date.today() + timedelta(days=k)).isoformat() for k in range(35)]
    for l in locs:
        rng = np.random.default_rng(_seed(l[0]))
        north = l[2] > 0
        base = 24 - abs(l[2]) * .35 + (-9 if north else 4)
        nt = [round(base - (.12 * k if north else -.08 * k), 1) for k in range(35)]
        t = [round(x + rng.normal(1.8 if l[0] in ("nyc", "chi") else -1.2, 2.0), 1) for x in nt]
        p = [round(max(0.0, float(rng.gamma(.6, 4))), 1) for _ in range(35)]
        nrm_t, nrm_p = [None] * 366, [None] * 366
        for k, d in enumerate(days):
            j = pd.Timestamp(d).dayofyear - 1
            nrm_t[j], nrm_p[j] = nt[k], 2.5
        out.append(_loc_block(l, days, t, p, {"t": nrm_t, "p": nrm_p}, 16))
    return {"asof": date.today().isoformat(), "locs": out}


# ---------------------------------------------------------------------------
# 7. News
# ---------------------------------------------------------------------------
def news():
    if MOCK:
        return [{"t": "Tanker traffic through Hormuz recovers as insurers cut war-risk premiums", "u": "#", "p": "Reuters", "d": datetime.utcnow().isoformat(), "tags": ["Routes", "Geopolitics"], "m": ["CL=F"]},
                {"t": "Chile copper mine strike enters second week", "u": "#", "p": "Bloomberg", "d": datetime.utcnow().isoformat(), "tags": ["Supply"], "m": ["HG=F"]},
                {"t": "OPEC+ weighs pause in output increases for first quarter", "u": "#", "p": "Reuters", "d": datetime.utcnow().isoformat(), "tags": ["OPEC+"], "m": ["CL=F"]},
                {"t": "US widens sanctions on Russian oil shippers", "u": "#", "p": "FT", "d": datetime.utcnow().isoformat(), "tags": ["Sanctions", "Routes"], "m": ["BZ=F"]},
                {"t": "Gold steadies near record as dollar slips", "u": "#", "p": "Yahoo Finance", "d": datetime.utcnow().isoformat(), "tags": [], "m": ["GC=F"]}]
    import yfinance as yf
    seen, items = set(), []
    for t in C.NEWS_TICKERS:
        try:
            raw = yf.Ticker(t).get_news(count=20) or []
        except Exception as e:  # noqa: BLE001
            log.info("news %s: %s", t, e)
            continue
        for it in raw:
            c = it.get("content", it) if isinstance(it, dict) else {}
            title = c.get("title")
            if not title or title in seen:
                if title in seen:
                    for x in items:
                        if x["t"] == title and t not in x["m"]:
                            x["m"].append(t)
                continue
            seen.add(title)
            url = (c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url") or c.get("link")
            low = (title + " " + (c.get("summary") or "")).lower()
            tags = [tg for tg, words in C.NEWS_TAGS if any(w in low for w in words)]
            items.append({"t": title, "u": url, "p": (c.get("provider") or {}).get("displayName") or c.get("publisher") or "Yahoo Finance",
                          "d": c.get("pubDate") or c.get("displayTime"), "tags": tags, "m": [t]})
        time.sleep(.5)
    items.sort(key=lambda x: str(x.get("d") or ""), reverse=True)
    return items[:80]


# ---------------------------------------------------------------------------
# Spreads
# ---------------------------------------------------------------------------
def spread_series(cl):
    g = lambda t: cl[t] if t in cl else pd.Series(dtype=float)
    out = {
        "crack321": (2 * g("RB=F") * 42 + g("HO=F") * 42 - 3 * g("CL=F")) / 3,
        "crack_gas": g("RB=F") * 42 - g("CL=F"),
        "crack_dist": g("HO=F") * 42 - g("CL=F"),
        "crush": g("ZM=F") * 0.022 + g("ZL=F") * 0.11 - g("ZS=F") / 100,
        "brent_wti": g("BZ=F") - g("CL=F"),
        "gold_silver": g("GC=F") / g("SI=F"),
        "copper_gold": g("HG=F") / g("GC=F") * 1000,
        "soy_corn": g("ZS=F") / g("ZC=F"),
    }
    return {k: v.dropna() for k, v in out.items()}


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
def build():
    today = date.today()
    asof_label = now_et_label()
    specs = C.UNIVERSE

    # ---- continuous fronts + macro tickers (12y for seasonality)
    fronts = [f"{s[3]}=F" for s in specs]
    extra = ["DX-Y.NYB", "^GSPC"] + [t for t, _, _ in C.FREIGHT] + [t for t, _, _ in C.CHINA]
    cl_long, vol_long = ohlc(list(dict.fromkeys(fronts + extra)), years=12)
    if cl_long.empty:
        raise RuntimeError("no futures prices")
    cl_long = cl_long.ffill(limit=3)
    cl = cl_long[cl_long.index >= cl_long.index[-1] - pd.Timedelta(days=5 * 366)]

    # ---- dated contracts (1y of history each)
    contracts = {s[0]: contract_list(s, today) for s in specs}
    all_c = [t for lst in contracts.values() for t, _, _ in lst]
    ccl, cvol = ohlc(all_c, years=1) if all_c else (pd.DataFrame(), pd.DataFrame())
    log.info("commodities: %d fronts, %d/%d dated contracts with data", cl.shape[1], ccl.shape[1] if not ccl.empty else 0, len(all_c))

    # ---- COT
    codes = [s[7] for s in specs if s[7]]
    try:
        cot = cot_all(codes)
    except Exception as e:  # noqa: BLE001
        log.warning("COT failed: %s", e)
        cot = {}

    dxy = cl_long.get("DX-Y.NYB", pd.Series(dtype=float)).dropna()
    dxy_ret = dxy.pct_change()

    rows, details = [], {}
    for s in specs:
        key, name, grp, root, exch, months, unit, cftc, dec, ahead = s
        ft = f"{root}=F"
        px = cl_long.get(ft, pd.Series(dtype=float)).dropna()
        if px.empty:
            continue
        last_d = px.index[-1]
        vol = vol_long.get(ft, pd.Series(dtype=float)).reindex(px.index)
        ret = px.pct_change()
        rv20 = ret.iloc[-21:].std() * math.sqrt(252) * 100 if len(ret) > 25 else None
        rv_hist = ret.rolling(20).std() * math.sqrt(252) * 100
        z = None
        if len(ret) > 260:
            h = ret.iloc[-253:-1]
            z = (ret.iloc[-1] - h.mean()) / h.std() if h.std() else None
        # curve
        lst = contracts.get(key, [])
        cur = curve_at(lst, ccl, last_d) if lst and not ccl.empty else []
        c1m = curve_at(lst, ccl, last_d - pd.Timedelta(days=30)) if cur else []
        c3m = curve_at(lst, ccl, last_d - pd.Timedelta(days=91)) if cur else []
        cm = curve_metrics(cur, today) if cur else {}
        vols = []
        for p in cur:
            vv = cvol.get(p["t"]) if not cvol.empty else None
            vols.append(r(float(vv.dropna().iloc[-1]) if vv is not None and len(vv.dropna()) else None, 0))
        # calendar spread history (fixed contracts: front vs ~6 months out)
        cal = None
        if len(cur) >= 3 and cm:
            a_t = cur[0]["t"]; b_t = next(p["t"] for p in cur if p["lab"] == cm["six"])
            sp = (ccl[a_t] - ccl[b_t]).dropna()
            if len(sp) > 20:
                cal = {"a": cur[0]["lab"], "b": cm["six"], "d": [dstr(d) for d in sp.index], "v": [r(x, 4) for x in sp.values],
                       "pctile": pctile(sp.iloc[:-1], float(sp.iloc[-1]))}
            # roll-yield history from the generic chain is not available; keep the fixed-contract spread
        # COT
        cb = cot_block(cot.get(cftc)) if cftc else None
        # seasonality
        sea = seasonality(px)
        # dollar correlation
        corr60 = corr1y = beta1y = None
        rc = None
        if len(dxy_ret.dropna()) > 300:
            j = pd.concat([ret, dxy_ret], axis=1, keys=["a", "b"]).dropna()
            j = j[j.index >= j.index[-1] - pd.Timedelta(days=3 * 365)]
            if len(j) > 260:
                corr60 = r(j["a"].iloc[-60:].corr(j["b"].iloc[-60:]), 2)
                corr1y = r(j["a"].iloc[-252:].corr(j["b"].iloc[-252:]), 2)
                cv = np.cov(j["a"].iloc[-252:], j["b"].iloc[-252:])
                beta1y = r(cv[0, 1] / cv[1, 1], 2) if cv[1, 1] else None
                roll = j["a"].rolling(60).corr(j["b"]).dropna()
                rw = roll.resample("W-FRI").last().dropna()
                rc = {"d": [dstr(d) for d in rw.index], "v": [r(x, 3) for x in rw.values]}
        hi52 = px[px.index >= last_d - pd.Timedelta(days=365)]
        row = {"key": key, "name": name, "group": grp, "unit": unit, "dec": dec, "ticker": ft, "asof": dstr(last_d),
               "last": r(px.iloc[-1], 4), "d1": chg(px, 1), "w1": chg(px, 7), "m1": chg(px, 30), "m3": chg(px, 91), "ytd": ytd(px), "y1": chg(px, 365),
               "z": r(z, 2), "rv20": r(rv20, 1), "rv_pctile": pctile(rv_hist.iloc[-756:-1], rv20) if rv20 else None,
               "hi52": r(hi52.max(), 4), "lo52": r(hi52.min(), 4), "pos52": r((px.iloc[-1] - hi52.min()) / (hi52.max() - hi52.min()) * 100, 0) if hi52.max() > hi52.min() else None,
               "shape": cm.get("shape"), "roll": cm.get("roll"), "m1_six_pct": cm.get("m1_six_pct"),
               "cot_net": cb["mm_net"] if cb else None, "cot_pctile": cb["pctile3y"] if cb else None, "cot_flag": cb["flag"] if cb else None,
               "cot_pct_oi": cb["mm_pct_oi"] if cb else None, "sea_dev": sea["dev5"] if sea else None,
               "sea_fwd": sea["fwd30_avg"] if sea else None,
               "sea_avg5": (sea["avg5"][sea["today_i"]] if sea and sea.get("avg5") else None), "sea_cur": (sea["cur"][sea["today_i"]] if sea and sea.get("cur") else None),
               "sea_up": sea["fwd30_up"] if sea else None, "sea_n": sea["fwd30_n"] if sea else None, "dxy_corr": corr1y, "spark": [r(x, 4) for x in px.iloc[-66:].values]}
        rows.append(row)
        hist = px[px.index >= last_d - pd.Timedelta(days=5 * 366)]
        details[key] = {**row, "curve": {"now": [{"lab": p["lab"], "px": r(p["px"], 4), "vol": vols[i]} for i, p in enumerate(cur)],
                                          "m1": [{"lab": p["lab"], "px": r(p["px"], 4)} for p in c1m],
                                          "m3": [{"lab": p["lab"], "px": r(p["px"], 4)} for p in c3m], **cm},
                        "cal": cal, "cot": cb, "season": sea, "dxy": {"corr60": corr60, "corr1y": corr1y, "beta1y": beta1y, "roll": rc},
                        "hist": {"d": [dstr(d) for d in hist.index], "v": [r(x, 4) for x in hist.values],
                                 "vol": [r(x, 0) if x == x else None for x in vol.reindex(hist.index).values],
                                 "rv": [r(x, 1) if x == x else None for x in rv_hist.reindex(hist.index).values]}}


    # ---- spreads
    sp_out = []
    sps = spread_series(cl)
    for key, name, unit, what in C.SPREADS:
        s = sps.get(key)
        if s is None or len(s) < 30:
            continue
        s5 = s[s.index >= s.index[-1] - pd.Timedelta(days=5 * 366)]
        sp_out.append({"key": key, "name": name, "unit": unit, "what": what, "last": r(s.iloc[-1], 3),
                       "w1": r(s.iloc[-1] - s[s.index <= s.index[-1] - pd.Timedelta(days=7)].iloc[-1], 3) if len(s) > 10 else None,
                       "m1": r(s.iloc[-1] - s[s.index <= s.index[-1] - pd.Timedelta(days=30)].iloc[-1], 3) if len(s) > 30 else None,
                       "avg5": r(s5.mean(), 3), "pctile5": pctile(s5.iloc[:-1], float(s.iloc[-1])),
                       "hist": {"d": [dstr(d) for d in s5.index], "v": [r(x, 3) for x in s5.values]}})
    # calendar spreads table (from curves)
    cal_rows = [{"key": k, "name": d["name"], "a": d["cal"]["a"], "b": d["cal"]["b"], "last": d["cal"]["v"][-1], "pctile": d["cal"]["pctile"],
                 "unit": d["unit"], "shape": d["curve"].get("shape"), "roll": d["curve"].get("roll")}
                for k, d in details.items() if d.get("cal")]
    write_json(P + "spreads.json", {"updated": asof_label, "spreads": sp_out, "calendar": cal_rows})

    # ---- positioning summary
    pos = []
    for k, d in details.items():
        cb = d.get("cot")
        if not cb:
            continue
        pos.append({"key": k, "name": d["name"], "group": d["group"], **{x: cb[x] for x in ("asof", "mm_net", "mm_chg", "mm_pct_oi", "pctile3y", "z3y", "flag",
                    "prod_net", "swap_net", "oi", "oi_chg", "oi_chg_pct", "traders_long", "traders_short")},
                    "m1": d["m1"], "hist_mm": cb["hist"]["mm"][-156:], "hist_d": cb["hist"]["d"][-156:]})
    write_json(P + "positioning.json", {"updated": asof_label, "rows": pos})

    # ---- fundamentals (EIA)
    try:
        snap = eia_weekly()
        hist = eia_history(snap)
        if snap:
            write_json(P + "fundamentals.json", {"updated": asof_label, "eia": snap, "hist": hist,
                                                 "calendar": release_calendar(today)})
    except Exception as e:  # noqa: BLE001
        log.warning("EIA block failed: %s", e)

    # ---- logistics
    try:
        cp = chokepoint_block(portwatch())
    except Exception as e:  # noqa: BLE001
        log.warning("PortWatch block failed: %s", e)
        cp = None
    fr = []
    for t, name, what in C.FREIGHT:
        s = cl_long.get(t, pd.Series(dtype=float)).dropna()
        if s.empty:
            continue
        s2 = s[s.index >= s.index[-1] - pd.Timedelta(days=2 * 366)]
        fr.append({"t": t, "name": name, "what": what, "last": r(s.iloc[-1], 2), "d1": chg(s, 1), "m1": chg(s, 30), "m3": chg(s, 91), "y1": chg(s, 365),
                   "hist": {"d": [dstr(d) for d in s2.index], "v": [r(x, 3) for x in s2.values]}})
    prev = None
    try:
        prev = json.loads((OUT / (P + "logistics.json")).read_text())
    except Exception:  # noqa: BLE001
        pass
    write_json(P + "logistics.json", {"updated": asof_label, "chokepoints": cp if cp else (prev or {}).get("chokepoints"),
                                      "chokepoints_stale": not bool(cp) and bool((prev or {}).get("chokepoints")), "freight": fr})

    # ---- macro: dollar, China, news
    macro = {"updated": asof_label}
    if not dxy.empty:
        # equal-weight basket of front futures (daily rebalanced) vs dollar index
        rets = cl[[f"{s[3]}=F" for s in specs if f"{s[3]}=F" in cl]].pct_change()
        bask = (1 + rets.mean(axis=1, skipna=True)).cumprod() * 100
        j = pd.concat([bask, dxy], axis=1, keys=["b", "d"]).dropna()
        j2 = j[j.index >= j.index[-1] - pd.Timedelta(days=3 * 366)]
        rc = j["b"].pct_change().rolling(60).corr(j["d"].pct_change()).dropna()
        rcw = rc[rc.index >= rc.index[-1] - pd.Timedelta(days=5 * 366)].resample("W-FRI").last().dropna()
        macro["dollar"] = {"last": r(dxy.iloc[-1], 2), "d1": chg(dxy, 1), "m1": chg(dxy, 30), "ytd": ytd(dxy), "y1": chg(dxy, 365),
                           "basket_m1": chg(bask, 30), "basket_ytd": ytd(bask), "corr60": r(rc.iloc[-1], 2) if len(rc) else None,
                           "corr_avg5": r(rcw.mean(), 2) if len(rcw) else None,
                           "pair": {"d": [dstr(d) for d in j2.index], "b": [r(x, 2) for x in (j2["b"] / j2["b"].iloc[0] * 100)], "x": [r(x, 2) for x in (j2["d"] / j2["d"].iloc[0] * 100)]},
                           "roll": {"d": [dstr(d) for d in rcw.index], "v": [r(x, 3) for x in rcw.values]},
                           "table": sorted([{"key": x["key"], "name": x["name"], "corr": details[x["key"]]["dxy"]["corr1y"], "corr60": details[x["key"]]["dxy"]["corr60"],
                                             "beta": details[x["key"]]["dxy"]["beta1y"]} for x in rows if details[x["key"]]["dxy"]["corr1y"] is not None], key=lambda z: z["corr"])}
    ch = []
    for t, name, what in C.CHINA:
        s = cl_long.get(t, pd.Series(dtype=float)).dropna()
        if s.empty:
            continue
        s2 = s[s.index >= s.index[-1] - pd.Timedelta(days=2 * 366)]
        ch.append({"t": t, "name": name, "what": what, "last": r(s.iloc[-1], 4), "d1": chg(s, 1), "m1": chg(s, 30), "ytd": ytd(s), "y1": chg(s, 365),
                   "hist": {"d": [dstr(d) for d in s2.index], "v": [r(x, 4) for x in s2.values]}})
    trade = []
    for sid, name in C.CHINA_FRED:
        try:
            s = fred(sid, "2015-01-01").dropna()
        except Exception:  # noqa: BLE001
            s = pd.Series(dtype=float)
        if len(s) < 13:
            continue
        yoy = (s / s.shift(12) - 1) * 100
        yoy = yoy.dropna()
        yoy = yoy[yoy.index >= pd.Timestamp("2019-01-01")]
        trade.append({"id": sid, "name": name, "last_month": s.index[-1].strftime("%b %Y"), "last_bn": r(s.iloc[-1] / 1e9, 1), "yoy": r(yoy.iloc[-1], 1) if len(yoy) else None,
                      "hist": {"d": [dstr(d) for d in yoy.index], "v": [r(x, 1) for x in yoy.values]}})
    macro["china"] = {"markets": ch, "trade": trade}
    try:
        macro["news"] = news()
    except Exception as e:  # noqa: BLE001
        log.warning("news failed: %s", e)
        macro["news"] = []
    write_json(P + "macro.json", macro)

    # ---- weather
    try:
        w = weather()
        if w and w.get("locs"):
            gas = [l for l in w["locs"] if l["role"] == "gas"]
            def agg(ids, seg, f):
                v = [l[seg][f] for l in gas if l["key"] in ids and l.get(seg) and l[seg].get(f) is not None]
                return r(sum(v), 0) if v else None
            us = ["nyc", "chi", "atl", "dal"]; eu = ["lon", "ber"]
            w["summary"] = {"us_hdd": agg(us, "w1_2", "hdd"), "us_hdd_n": agg(us, "w1_2", "hdd_n"), "us_cdd": agg(us, "w1_2", "cdd"), "us_cdd_n": agg(us, "w1_2", "cdd_n"),
                            "eu_hdd": agg(eu, "w1_2", "hdd"), "eu_hdd_n": agg(eu, "w1_2", "hdd_n"),
                            "us_hdd35": agg(us, "w3_5", "hdd"), "us_hdd35_n": agg(us, "w3_5", "hdd_n")}
            w["updated"] = asof_label
            write_json(P + "weather.json", w)
    except Exception as e:  # noqa: BLE001
        log.warning("weather failed: %s", e)

    # ---- per-commodity files and index
    for k, d in details.items():
        write_json(P + f"c/{k}.json", {**d, "updated": asof_label})
    signals = []
    for x in rows:
        d = details[x["key"]]
        if x["cot_flag"]:
            signals.append((3, {"key": x["key"], "name": x["name"], "kind": "Positioning", "text": f"{x['cot_flag']}: managed money net at the {int(x['cot_pctile'])}th percentile of three years."}))
        if x["z"] is not None and abs(x["z"]) >= 2.5:
            signals.append((4, {"key": x["key"], "name": x["name"], "kind": "Move", "text": f"Day's move of {x['d1']:+.2f}% is {abs(x['z']):.1f} standard deviations from the year's norm."}))
        se = d.get("season")
        if se and se.get("cur") and se.get("hi10") and se.get("lo10"):
            i = se["today_i"]; c_, hi, lo = se["cur"][i], se["hi10"][i], se["lo10"][i]
            if None not in (c_, hi, lo) and (c_ > hi or c_ < lo):
                signals.append((1, {"key": x["key"], "name": x["name"], "kind": "Seasonal", "text": f"Year to date {c_:+.1f}% is {'above' if c_ > hi else 'below'} the range of nine years in ten at this date."}))
        if x["rv_pctile"] is not None and x["rv_pctile"] >= 95:
            signals.append((2, {"key": x["key"], "name": x["name"], "kind": "Volatility", "text": f"20-day realised volatility of {x['rv20']:.0f}% is in the top 5% of three years."}))
        cal = d.get("cal")
        if cal and cal.get("pctile") is not None and (cal["pctile"] >= 97 or cal["pctile"] <= 3) and len(cal["v"]) > 120:
            signals.append((2, {"key": x["key"], "name": x["name"], "kind": "Curve", "text": f"The {cal['a']}–{cal['b']} spread is at a one-year {'high' if cal['pctile'] >= 97 else 'low'}: the front is {'tightening' if cal['pctile'] >= 97 else 'loosening'} against later months."}))
    signals = [s_ for _, s_ in sorted(signals, key=lambda z: -z[0])][:10]
    write_json(P + "index.json", {"updated": asof_label, "asof": human_date(max(pd.Timestamp(x["asof"]) for x in rows)), "groups": C.GROUPS,
                                  "rows": rows, "signals": signals, "calendar": release_calendar(today)})
    return len(rows)


def release_calendar(today):
    """Scheduled releases over the next five weeks."""
    out = []
    for k in range(0, 36):
        d = today + timedelta(days=k)
        wd = d.weekday()
        if wd == 2:
            out.append({"d": d.isoformat(), "t": "10:30 ET", "what": "EIA weekly petroleum status", "mk": "Crude, gasoline, distillates"})
        if wd == 3:
            out.append({"d": d.isoformat(), "t": "10:30 ET", "what": "EIA natural gas storage", "mk": "Natural gas"})
            out.append({"d": d.isoformat(), "t": "08:30 ET", "what": "USDA export sales", "mk": "Grains, oilseeds, cotton"})
        if wd == 4:
            out.append({"d": d.isoformat(), "t": "15:30 ET", "what": "CFTC Commitments of Traders", "mk": "All futures (positions as of Tuesday)"})
        if wd == 0:
            out.append({"d": d.isoformat(), "t": "16:00 ET", "what": "USDA crop progress (in season)", "mk": "Corn, soybeans, wheat, cotton"})
        if wd == 1:
            out.append({"d": d.isoformat(), "t": "16:30 ET", "what": "API weekly crude inventories", "mk": "Crude"})
        if d.isoformat() in C.WASDE:
            out.append({"d": d.isoformat(), "t": "12:00 ET", "what": "USDA WASDE", "mk": "World grain, oilseed, cotton, sugar and livestock balances", "big": True})
    return out
