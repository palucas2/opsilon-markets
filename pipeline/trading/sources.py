"""Fetchers for the Trading Part. Each one writes into the point-in-time store
and returns a short status line. Every fetcher is isolated: one failing source
never stops the others.

Publication times (ET), used as `published`:
  EIA petroleum (WPSR)   Wednesday 10:30, about the week to the previous Friday
  EIA gas storage        Thursday 10:30, about the week to the previous Friday
  CFTC COT               Friday 15:30, about the previous Tuesday
  USDA crop progress     Monday 16:00, about the week to Sunday
  WASDE                  12:00 on the published date
A federal holiday in the release week pushes the release one business day later.
"""
from __future__ import annotations

import io
import json
import logging
import os
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar

from common import ROOT
from sources import MOCK, UA, _seed

from . import config as K
from . import store

log = logging.getLogger("opsilon")
_HOL = None


def _holidays():
    global _HOL
    if _HOL is None:
        _HOL = set(USFederalHolidayCalendar().holidays("1990-01-01", "2035-12-31").date)
    return _HOL


def _release(period: date, days_after: int, hhmm: str) -> str:
    """Release timestamp: `days_after` the period, +1 business day per holiday between."""
    d = period + timedelta(days=days_after)
    hol = _holidays()
    n = sum(1 for k in range(1, days_after + 1) if (period + timedelta(days=k)) in hol)
    for _ in range(n):
        d += timedelta(days=1)
        while d.weekday() >= 5 or d in hol:
            d += timedelta(days=1)
    return f"{d.isoformat()} {hhmm}"


def _get(url, as_json=True, timeout=40, retries=3, binary=False):
    last = None
    for a in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                raw = r.read()
            if binary:
                return raw
            txt = raw.decode("utf-8-sig", "replace")
            return json.loads(txt) if as_json else txt
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (a + 1))
    log.warning("trading GET %s failed: %s", url.split("api_key")[0][:110], last)
    return None


# ---------------------------------------------------------------------------
# EIA
# ---------------------------------------------------------------------------
EIA_SERIES = {
    # store name: (EIA series id, dnav folder, days from period to release, label, unit)
    "eia_crude": ("PET.WCESTUS1.W", "pet", 5, "Commercial crude stocks", "mb"),
    "eia_cushing": ("PET.W_EPC0_SAX_YCUOK_MBBL.W", "pet", 5, "Cushing crude stocks", "mb"),
    "eia_gasoline": ("PET.WGTSTUS1.W", "pet", 5, "Gasoline stocks", "mb"),
    "eia_distillate": ("PET.WDISTUS1.W", "pet", 5, "Distillate stocks", "mb"),
    "eia_util": ("PET.WPULEUS3.W", "pet", 5, "Refinery utilisation", "%"),
    "eia_prod": ("PET.WCRFPUS2.W", "pet", 5, "Crude production", "kb/d"),
    "eia_gas": ("NG.NW2_EPG0_SWO_R48_BCF.W", "ng", 6, "Working gas in storage, Lower 48", "bcf"),
}


def _eia_api(sid):
    k = K.key("EIA_API_KEY")
    if not k:
        return None
    j = _get(f"https://api.eia.gov/v2/seriesid/{sid}?api_key={k}")
    try:
        rows = j["response"]["data"]
        return pd.Series({pd.Timestamp(r["period"]): float(r["value"]) for r in rows if r.get("value") not in (None, "")}).sort_index()
    except Exception:  # noqa: BLE001
        return None


def _eia_xls(sid, folder):
    code = sid.split(".")[1]
    raw = _get(f"https://www.eia.gov/dnav/{folder}/hist_xls/{code}w.xls", binary=True, timeout=60)
    if not raw:
        return None
    try:
        df = pd.read_excel(io.BytesIO(raw), sheet_name="Data 1", skiprows=2)
        df = df.dropna()
        return pd.Series(df.iloc[:, 1].astype(float).values, index=pd.to_datetime(df.iloc[:, 0])).sort_index()
    except Exception as e:  # noqa: BLE001
        log.warning("EIA xls %s: %s", code, e)
        return None


def _mock_weekly(name, start="2010-01-01"):
    idx = pd.date_range(start, pd.Timestamp(date.today()) - pd.Timedelta(days=6), freq="W-FRI")
    rng = np.random.default_rng(_seed(name))
    doy = idx.dayofyear.values
    base = {"eia_crude": 430, "eia_cushing": 35, "eia_gasoline": 225, "eia_distillate": 125, "eia_util": 90, "eia_prod": 12500, "eia_gas": 2800}.get(name, 100)
    amp = {"eia_gas": 1100, "eia_util": 4, "eia_prod": 300}.get(name, base * .06)
    v = base + amp * np.cos(2 * np.pi * (doy - (70 if name == "eia_gas" else 120)) / 365.25) + np.cumsum(rng.normal(0, base * .004, len(idx)))
    if name == "eia_prod":
        v = v + np.linspace(-3500, 1000, len(idx))
    return pd.Series(np.round(v, 1), index=idx)


def fetch_eia():
    got = []
    for name, (sid, folder, lag, label, unit) in EIA_SERIES.items():
        s = _mock_weekly(name) if MOCK else (_eia_api(sid))
        src = "mock" if MOCK else "eia-api"
        if not MOCK and (s is None or s.empty):
            s, src = _eia_xls(sid, folder), "eia-xls"
        if s is None or s.empty:
            continue
        store.put_obs(src, name, [(d.date().isoformat(), _release(d.date(), lag, "10:30"), v) for d, v in s.items()])
        got.append(name)
    return f"EIA: {len(got)}/{len(EIA_SERIES)} series"


# ---------------------------------------------------------------------------
# CFTC COT (disaggregated, futures only) – reuses the commodities fetcher
# ---------------------------------------------------------------------------
def fetch_cot(years=16):
    import build_commodities as BC
    import commodities_config as C
    codes = {spec[7]: spec[0] for spec in C.UNIVERSE if spec[7] and spec[0] in K.DAILY_UNIVERSE}
    data = BC.cot_all(list(codes), years=years)
    n = 0
    for code, df in data.items():
        key = codes.get(code)
        if not key or df.empty:
            continue
        mm = df["m_money_positions_long_all"] - df["m_money_positions_short_all"]
        pr = df["prod_merc_positions_long"] - df["prod_merc_positions_short"]
        oi = df["open_interest_all"]
        rows = lambda s: [(d.date().isoformat(), _release(d.date(), 3, "15:30"), v) for d, v in s.dropna().items()]
        store.put_obs("cftc", f"cot_mm_pct_{key}", rows(mm / oi * 100))
        store.put_obs("cftc", f"cot_prod_pct_{key}", rows(pr / oi * 100))
        store.put_obs("cftc", f"cot_mm_net_{key}", rows(mm))
        store.put_obs("cftc", f"cot_oi_{key}", rows(oi))
        n += 1
    return f"COT: {n} markets"


# ---------------------------------------------------------------------------
# USDA NASS crop progress / condition
# ---------------------------------------------------------------------------
NASS = {
    "usda_corn_ge": ("CORN - CONDITION, MEASURED IN PCT EXCELLENT", "CORN - CONDITION, MEASURED IN PCT GOOD"),
    "usda_soy_ge": ("SOYBEANS - CONDITION, MEASURED IN PCT EXCELLENT", "SOYBEANS - CONDITION, MEASURED IN PCT GOOD"),
    "usda_wwheat_ge": ("WHEAT, WINTER - CONDITION, MEASURED IN PCT EXCELLENT", "WHEAT, WINTER - CONDITION, MEASURED IN PCT GOOD"),
    "usda_corn_planted": ("CORN - PROGRESS, MEASURED IN PCT PLANTED",),
    "usda_corn_harvested": ("CORN, GRAIN - PROGRESS, MEASURED IN PCT HARVESTED",),
    "usda_soy_planted": ("SOYBEANS - PROGRESS, MEASURED IN PCT PLANTED",),
}


def _nass(short_desc, k):
    q = urllib.parse.urlencode({"key": k, "short_desc": short_desc, "agg_level_desc": "NATIONAL", "freq_desc": "WEEKLY",
                                "year__GE": "2005", "format": "JSON"})
    j = _get("https://quickstats.nass.usda.gov/api/api_GET/?" + q, timeout=60)
    if not j or "data" not in j:
        return pd.Series(dtype=float)
    s = {}
    for r in j["data"]:
        try:
            s[pd.Timestamp(r["week_ending"])] = float(str(r["Value"]).replace(",", ""))
        except Exception:  # noqa: BLE001
            pass
    return pd.Series(s).sort_index()


def fetch_usda():
    k = K.key("NASS_API_KEY")
    if not k and not MOCK:
        return "USDA: skipped (no NASS_API_KEY)"
    n = 0
    for name, descs in NASS.items():
        if MOCK:
            idx = pd.date_range("2010-04-01", date.today(), freq="W-SUN")
            idx = idx[(idx.month >= 5) & (idx.month <= 10)]
            rng = np.random.default_rng(_seed(name))
            s = pd.Series(np.clip(65 + np.cumsum(rng.normal(0, 1.2, len(idx))) * .3, 30, 80), index=idx)
        else:
            parts = [_nass(d, k) for d in descs]
            s = sum(parts) if len(parts) > 1 else parts[0]
            s = s.dropna()
        if s.empty:
            continue
        store.put_obs("usda-nass", name, [(d.date().isoformat(), _release(d.date(), 1, "16:00"), v) for d, v in s.items()])
        n += 1
    return f"USDA: {n}/{len(NASS)} series"


# ---------------------------------------------------------------------------
# NOAA GFS (via Open-Meteo): 6-10 day HDD/CDD for gas, rain for the corn belt.
# One observation per run day is kept, so a forecast archive builds up night
# after night (that archive is what a weather-revision edge test needs).
# ---------------------------------------------------------------------------
GAS_CITIES = [("New York", 40.71, -74.01, .20), ("Chicago", 41.88, -87.63, .16), ("Boston", 42.36, -71.06, .07),
              ("Philadelphia", 39.95, -75.17, .08), ("Detroit", 42.33, -83.05, .08), ("Atlanta", 33.75, -84.39, .09),
              ("Dallas", 32.78, -96.80, .11), ("Houston", 29.76, -95.37, .09), ("Minneapolis", 44.98, -93.27, .06),
              ("Columbus", 39.96, -83.00, .06)]
GRAIN_CITIES = [("Des Moines", 41.59, -93.62), ("Champaign", 40.12, -88.24), ("Omaha", 41.26, -95.93), ("Indianapolis", 39.77, -86.16)]


def _om(url):
    return _get(url, timeout=40)


def fetch_weather():
    today = date.today()
    if MOCK:
        rng = np.random.default_rng(_seed("wx" + today.isoformat()))
        hdd = float(np.clip(18 + rng.normal(0, 4), 0, None)) * 5
        out = {"hdd_6_10": hdd, "hdd_6_10_norm": 92.0, "cdd_6_10": 2.0, "cdd_6_10_norm": 3.0, "rain_6_10": 9.0, "rain_6_10_norm": 11.0,
               "daily": [{"d": (today + timedelta(days=i)).isoformat(), "hdd": round(16 + 4 * np.sin(i / 3) + rng.normal(0, 1), 1), "norm": 17.5} for i in range(16)]}
    else:
        dates = [today + timedelta(days=i) for i in range(16)]
        hdd = np.zeros(16); cdd = np.zeros(16); nh = np.zeros(16); nc = np.zeros(16); wsum = 0
        for name, la, lo, w in GAS_CITIES:
            f = _om(f"https://api.open-meteo.com/v1/forecast?latitude={la}&longitude={lo}&daily=temperature_2m_mean&temperature_unit=fahrenheit"
                    f"&forecast_days=16&models=gfs_seamless&timezone=America/New_York")
            a = _om(f"https://archive-api.open-meteo.com/v1/archive?latitude={la}&longitude={lo}&daily=temperature_2m_mean&temperature_unit=fahrenheit"
                    f"&start_date={today.year - 10}-01-01&end_date={today - timedelta(days=7)}&timezone=America/New_York")
            if not f or not a:
                continue
            t = np.array([x if x is not None else np.nan for x in f["daily"]["temperature_2m_mean"]][:16], dtype=float)
            arch = pd.Series(a["daily"]["temperature_2m_mean"], index=pd.to_datetime(a["daily"]["time"]), dtype=float).dropna()
            clim = arch.groupby(arch.index.dayofyear).mean().rolling(7, center=True, min_periods=1).mean()
            norm = np.array([clim.get(pd.Timestamp(d).dayofyear, np.nan) for d in dates])
            hdd += w * np.maximum(65 - t, 0); cdd += w * np.maximum(t - 65, 0)
            nh += w * np.maximum(65 - norm, 0); nc += w * np.maximum(norm - 65, 0); wsum += w
        if not wsum:
            return "Weather: failed"
        hdd, cdd, nh, nc = hdd / wsum, cdd / wsum, nh / wsum, nc / wsum
        rain = np.zeros(16); rn = np.zeros(16); k = 0
        for name, la, lo in GRAIN_CITIES:
            f = _om(f"https://api.open-meteo.com/v1/forecast?latitude={la}&longitude={lo}&daily=precipitation_sum&forecast_days=16&models=gfs_seamless")
            a = _om(f"https://archive-api.open-meteo.com/v1/archive?latitude={la}&longitude={lo}&daily=precipitation_sum"
                    f"&start_date={today.year - 10}-01-01&end_date={today - timedelta(days=7)}")
            if not f or not a:
                continue
            p = np.array([x or 0 for x in f["daily"]["precipitation_sum"]][:16], dtype=float)
            arch = pd.Series(a["daily"]["precipitation_sum"], index=pd.to_datetime(a["daily"]["time"]), dtype=float).fillna(0)
            clim = arch.groupby(arch.index.dayofyear).mean().rolling(15, center=True, min_periods=1).mean()
            rain += p; rn += np.array([clim.get(pd.Timestamp(d).dayofyear, 0) for d in dates]); k += 1
        rain, rn = (rain / k, rn / k) if k else (rain, rn)
        sl = slice(6, 11)
        out = {"hdd_6_10": float(hdd[sl].sum()), "hdd_6_10_norm": float(nh[sl].sum()), "cdd_6_10": float(cdd[sl].sum()),
               "cdd_6_10_norm": float(nc[sl].sum()), "rain_6_10": float(rain[sl].sum()) if k else None, "rain_6_10_norm": float(rn[sl].sum()) if k else None,
               "daily": [{"d": d.isoformat(), "hdd": round(float(hdd[i]), 1), "norm": round(float(nh[i]), 1), "cdd": round(float(cdd[i]), 1)} for i, d in enumerate(dates)]}
    pub = f"{today.isoformat()} 07:00"
    for k2 in ["hdd_6_10", "hdd_6_10_norm", "cdd_6_10", "cdd_6_10_norm", "rain_6_10", "rain_6_10_norm"]:
        if out.get(k2) is not None:
            store.put_obs("noaa-gfs", "wx_" + k2, [(today.isoformat(), pub, out[k2])])
    return out


# ---------------------------------------------------------------------------
# Tier-1 calendar
# ---------------------------------------------------------------------------
def build_calendar(weeks_back=8, weeks_ahead=6):
    import commodities_config as C
    from sources import fred_release_dates
    start, end = date.today() - timedelta(weeks=weeks_back), date.today() + timedelta(weeks=weeks_ahead)
    rows = []
    d = start
    hol = _holidays()
    while d <= end:
        if d.weekday() < 5 and d not in hol:
            if d.weekday() == 2:
                rows.append((d.isoformat(), "10:30", "EIA petroleum status (WPSR)", 1))
            if d.weekday() == 3:
                rows.append((d.isoformat(), "10:30", "EIA gas storage", 1))
            if d.weekday() == 4:
                rows.append((d.isoformat(), "15:30", "CFTC Commitments of Traders", 2))
            if d.weekday() == 0 and 4 <= d.month <= 11:
                rows.append((d.isoformat(), "16:00", "USDA crop progress", 2))
        d += timedelta(days=1)
    # a holiday pushes the EIA releases one day: shift Wed/Thu items in holiday weeks
    fixed = []
    for day, t, n, tier in rows:
        dd = date.fromisoformat(day)
        mon = dd - timedelta(days=dd.weekday())
        if n.startswith("EIA") and any((mon + timedelta(days=k)) in hol for k in range(dd.weekday() + 1)):
            dd += timedelta(days=1)
        fixed.append((dd.isoformat(), t, n, tier))
    rows = fixed
    rows += [(x, "12:00", "WASDE", 1) for x in C.WASDE if start.isoformat() <= x <= end.isoformat()]
    rows += [(x, "14:00", "FOMC decision", 1) for x in K.FOMC if start.isoformat() <= x <= end.isoformat()]
    rows += [(x, "08:00", "OPEC+ meeting", 1) for x in K.OPEC if start.isoformat() <= x <= end.isoformat()]
    got_fred = False
    for rid, (name, t) in K.FRED_RELEASES.items():
        ds = fred_release_dates(rid, start, end)
        got_fred |= bool(ds)
        rows += [(x, t, name, 1) for x in ds]
    if not got_fred:  # payrolls: first Friday of the month (rule of thumb when FRED is unavailable)
        m = date(start.year, start.month, 1)
        while m <= end:
            f = m + timedelta(days=(4 - m.weekday()) % 7)
            if start <= f <= end:
                rows.append((f.isoformat(), "08:30", "Payrolls (NFP), estimated date", 1))
            m = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
    store.put_events(rows)
    return sorted(rows)


# ---------------------------------------------------------------------------
# Prices
# ---------------------------------------------------------------------------
def daily_prices(years=20):
    """Continuous front-month closes for the daily universe (Yahoo), one column per key."""
    import build_commodities as BC
    import commodities_config as C
    spec = {s[0]: s for s in C.UNIVERSE}
    tick = {k: C.front_ticker(spec[k][3]) for k in K.DAILY_UNIVERSE if k in spec}
    close, _ = BC.ohlc(list(tick.values()), years=years)
    if close.empty:
        return close
    inv = {v: k for k, v in tick.items()}
    return close.rename(columns=inv)[[k for k in tick if tick[k] in close.columns]]


def _mock_intraday(sym, days=60, step=5):
    """Synthetic 5-minute bars, 17:00-16:00 CT Globex session, with an open burst and EIA-day noise."""
    rng = np.random.default_rng(_seed("intra" + sym))
    lvl = {"CL=F": 62.0, "GC=F": 4050.0, "NG=F": 3.4, "SI=F": 49.0, "HG=F": 5.0}.get(sym, 100.0)
    out = []
    end = pd.Timestamp(date.today(), tz="America/Chicago")
    days_idx = pd.bdate_range(end - pd.Timedelta(days=int(days * 1.45)), end - pd.Timedelta(days=1))
    p = lvl
    for d in days_idx:
        ts = pd.date_range(d + pd.Timedelta(hours=7), d + pd.Timedelta(hours=15, minutes=55), freq=f"{step}min", tz="America/Chicago")
        hr = ts.hour + ts.minute / 60
        vol = .0009 * (1 + 1.5 * ((hr >= 8) & (hr < 9)) + 3 * ((d.weekday() == 2) & (hr >= 9.5) & (hr < 10)))
        drift = rng.normal(0, .002)
        r = rng.normal(drift / len(ts), vol)
        c = p * np.exp(np.cumsum(r))
        o = np.r_[p, c[:-1]]
        hi = np.maximum(o, c) * (1 + np.abs(rng.normal(0, vol / 2)))
        lo = np.minimum(o, c) * (1 - np.abs(rng.normal(0, vol / 2)))
        out.append(pd.DataFrame({"o": o, "h": hi, "l": lo, "c": c, "v": rng.integers(200, 3000, len(ts))}, index=ts))
        p = c[-1]
    return pd.concat(out).tz_convert("UTC")


def fetch_intraday_yahoo(symbols=("CL=F", "GC=F", "NG=F", "SI=F", "HG=F")):
    """5-minute bars for the last 60 days, appended to the store each night so the history keeps growing."""
    n = 0
    for sym in symbols:
        if MOCK:
            df = _mock_intraday(sym)
        else:
            import yfinance as yf
            try:
                raw = yf.download(sym, period="60d", interval="5m", progress=False, auto_adjust=False)
            except Exception as e:  # noqa: BLE001
                log.warning("yf intraday %s: %s", sym, e)
                continue
            if raw is None or raw.empty:
                continue
            if isinstance(raw.columns, pd.MultiIndex):
                raw.columns = raw.columns.get_level_values(0)
            df = raw.rename(columns={"Open": "o", "High": "h", "Low": "l", "Close": "c", "Volume": "v"})[list("ohlcv")]
            df.index = pd.to_datetime(df.index, utc=True)
        n += store.put_bars(sym, "5m", df, "mock" if MOCK else "yahoo")
    return f"Intraday Yahoo: {n} bars"


def fetch_databento(roots=("CL", "GC", "NG"), curve_depth=6):
    """Minute bars and continuous curves from Databento (CME Globex MDP 3.0). Paid per request:
    the cost is checked first and the call is skipped above DATABENTO_MAX_USD (default 5 $ per run)."""
    k = K.key("DATABENTO_API_KEY")
    if not k or MOCK:
        return "Databento: skipped (no DATABENTO_API_KEY)"
    try:
        import databento as dbn
    except ImportError:
        return "Databento: package missing (pip install databento)"
    cap = float(os.environ.get("DATABENTO_MAX_USD", "5"))
    cli = dbn.Historical(k)
    spent, n = 0.0, 0
    end = pd.Timestamp.utcnow().floor("D") - pd.Timedelta(days=1)
    jobs = []
    for root in roots:
        last = store.bars(f"{root}.c.0", "1m")
        start = (last.index[-1] + pd.Timedelta(minutes=1)) if len(last) else end - pd.Timedelta(days=365 * 2)
        jobs.append(([f"{root}.c.0"], "ohlcv-1m", start, "1m"))
        lastd = store.bars(f"{root}.c.1", "1d")
        startd = (lastd.index[-1] + pd.Timedelta(days=1)) if len(lastd) else pd.Timestamp("2010-06-06", tz="UTC")
        jobs.append(([f"{root}.c.{i}" for i in range(curve_depth)], "ohlcv-1d", startd, "1d"))
    for syms, schema, start, freq in jobs:
        if start >= end:
            continue
        kw = dict(dataset="GLBX.MDP3", symbols=syms, stype_in="continuous", schema=schema, start=start.isoformat(), end=end.isoformat())
        try:
            cost = cli.metadata.get_cost(**kw)
            if spent + cost > cap:
                log.warning("Databento %s %s skipped: %.2f $ would pass the %.2f $ cap", syms, schema, cost, cap)
                continue
            df = cli.timeseries.get_range(**kw).to_df()
            spent += cost
        except Exception as e:  # noqa: BLE001
            log.warning("Databento %s: %s", syms, e)
            continue
        if df.empty:
            continue
        for sym, g in df.groupby("symbol"):
            g = g.rename(columns={"open": "o", "high": "h", "low": "l", "close": "c", "volume": "v"})
            n += store.put_bars(sym, freq, g[list("ohlcv")], "databento")
    return f"Databento: {n} bars, {spent:.2f} $"


def ingest_imports():
    """Parquet / CSV files exported elsewhere (Bloomberg terminal, TopstepX) dropped in data/import/."""
    folder = ROOT / "data" / "import"
    if not folder.exists():
        return "Imports: none"
    n = 0
    for p in sorted(folder.rglob("*")):
        if p.suffix not in (".parquet", ".csv"):
            continue
        try:
            df = pd.read_parquet(p) if p.suffix == ".parquet" else pd.read_csv(p)
            # expected columns: symbol, freq, ts, o, h, l, c, v (tools/bloomberg_export.py writes exactly this)
            if not {"symbol", "freq", "ts", "c"} <= set(df.columns):
                continue
            df["ts"] = pd.to_datetime(df["ts"], utc=True)
            for (sym, freq), g in df.groupby(["symbol", "freq"]):
                n += store.put_bars(sym, freq, g.set_index("ts"), "bloomberg" if "bbg" in p.name.lower() else "import")
        except Exception as e:  # noqa: BLE001
            log.warning("import %s: %s", p.name, e)
    return f"Imports: {n} bars"
