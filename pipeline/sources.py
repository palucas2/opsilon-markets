"""Accès aux sources : Yahoo Finance (yfinance), FRED, World Bank.

Chaque fonction renvoie des objets pandas propres et ne lève jamais
d'exception vers l'appelant : en cas d'échec elle journalise et renvoie
un résultat vide, pour qu'une source en panne ne casse pas tout le site.

OPSILON_MOCK=1 remplace toutes les sources par des données synthétiques
(mêmes formats) : utile pour développer le front hors-ligne.
"""
from __future__ import annotations

import io
import json
import logging
import math
import os
import time
import urllib.request
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

log = logging.getLogger("opsilon")
MOCK = os.environ.get("OPSILON_MOCK") == "1"
UA = {"User-Agent": "Mozilla/5.0 (opsilon-markets data pipeline)"}

_px_cache: dict[tuple, pd.DataFrame] = {}


# ---------------------------------------------------------------------------
# Yahoo Finance
# ---------------------------------------------------------------------------
def prices(tickers, period="2y", start=None) -> pd.DataFrame:
    """Daily closes, one column per ticker (index = Timestamp, tz-naive)."""
    tickers = list(dict.fromkeys(t for t in tickers if t))
    if not tickers:
        return pd.DataFrame()
    key = (tuple(sorted(tickers)), period, start)
    if key in _px_cache:
        return _px_cache[key]
    if MOCK:
        df = _mock_prices(tickers, period, start)
    else:
        df = _yf_download(tickers, period, start)
    _px_cache[key] = df
    return df


def _yf_download(tickers, period, start):
    import yfinance as yf
    out = []
    for i in range(0, len(tickers), 80):
        chunk = tickers[i:i + 80]
        for attempt in range(3):
            try:
                kw = dict(interval="1d", auto_adjust=True, progress=False, threads=True, group_by="column")
                if start:
                    kw["start"] = start
                else:
                    kw["period"] = period
                raw = yf.download(chunk, **kw)
                if raw is None or raw.empty:
                    raise RuntimeError("empty download")
                close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Close"]].rename(columns={"Close": chunk[0]})
                if isinstance(close, pd.Series):
                    close = close.to_frame(chunk[0])
                out.append(close)
                break
            except Exception as e:  # noqa: BLE001
                log.warning("yf.download %s (try %d): %s", chunk[:3], attempt + 1, e)
                time.sleep(3 * (attempt + 1))
    if not out:
        return pd.DataFrame()
    df = pd.concat(out, axis=1)
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    df = df.loc[:, ~df.columns.duplicated()].sort_index()
    return df


def ticker_bundle(symbol: str) -> dict:
    """Fundamentals for one company: info, statements, recommendations, news, earnings dates."""
    if MOCK:
        return _mock_bundle(symbol)
    import yfinance as yf
    t = yf.Ticker(symbol)
    b: dict = {"symbol": symbol}

    def safe(name, fn):
        try:
            b[name] = fn()
        except Exception as e:  # noqa: BLE001
            log.info("%s %s: %s", symbol, name, e)
            b[name] = None

    safe("info", lambda: t.get_info())
    safe("inc", lambda: t.get_income_stmt(pretty=False, freq="yearly"))
    safe("cf", lambda: t.get_cashflow(pretty=False, freq="yearly"))
    safe("bs", lambda: t.get_balance_sheet(pretty=False, freq="yearly"))
    safe("qinc", lambda: t.get_income_stmt(pretty=False, freq="quarterly"))
    safe("recs", lambda: t.get_recommendations())
    safe("news", lambda: t.get_news(count=10))
    safe("edates", lambda: t.get_earnings_dates(limit=8))
    return b


# ---------------------------------------------------------------------------
# FRED (public CSV endpoint, no key)
# ---------------------------------------------------------------------------
_fred_fail = {"n": 0}


def fred(series_id: str, start: str = "1900-01-01") -> pd.Series:
    """FRED series. Uses the official API when FRED_API_KEY is set (reliable from
    GitHub runners); otherwise the public CSV endpoint, with a circuit breaker so
    an unreachable FRED costs seconds, not hours. Falls back to Yahoo/BLS for
    the series that have an equivalent."""
    if MOCK:
        return _mock_fred(series_id, start)
    s = _fred_api(series_id, start) if os.environ.get("FRED_API_KEY") else None
    if s is None or s.empty:
        s = _fred_csv(series_id, start)
    if s.empty:
        s = _fallback(series_id, start)
    return s


def _fred_api(series_id, start):
    url = (f"https://api.stlouisfed.org/fred/series/observations?series_id={series_id}"
           f"&api_key={os.environ['FRED_API_KEY']}&file_type=json&observation_start={start}")
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                js = json.loads(r.read().decode())
            obs = [(o["date"], o["value"]) for o in js.get("observations", []) if o["value"] not in (".", "")]
            if not obs:
                return pd.Series(dtype=float)
            idx = pd.to_datetime([d for d, _ in obs])
            return pd.Series([float(v) for _, v in obs], index=idx)
        except Exception as e:  # noqa: BLE001
            log.warning("FRED API %s (try %d): %s", series_id, attempt + 1, e)
            time.sleep(1.5)
    return None


def _fred_csv(series_id, start):
    if _fred_fail["n"] >= 3:
        return pd.Series(dtype=float)
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}"
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as r:
            df = pd.read_csv(io.StringIO(r.read().decode()))
        df.columns = ["date", "v"]
        df["date"] = pd.to_datetime(df["date"])
        df["v"] = pd.to_numeric(df["v"], errors="coerce")
        _fred_fail["n"] = 0
        return df.dropna().set_index("date")["v"]
    except Exception as e:  # noqa: BLE001
        _fred_fail["n"] += 1
        log.warning("FRED CSV %s: %s%s", series_id, e, " (FRED unreachable: skipping the CSV endpoint for this run)" if _fred_fail["n"] >= 3 else "")
        return pd.Series(dtype=float)


# Equivalents when FRED is unreachable
_YAHOO_EQ = {"GS10": "^TNX", "DGS10": "^TNX", "DGS5": "^FVX", "TB3MS": "^IRX", "DGS3MO": "^IRX", "DGS30": "^TYX"}
_BLS_EQ = {"CPIAUCSL": "CUSR0000SA0", "CPILFESL": "CUSR0000SA0L1E", "PAYEMS": "CES0000000001", "UNRATE": "LNS14000000"}


def _fallback(series_id, start):
    try:
        if series_id in _YAHOO_EQ:
            s = series_close(_YAHOO_EQ[series_id], "max")
            s = s[s.index >= pd.Timestamp(start)]
            return s.resample("MS").mean() if series_id in ("GS10", "TB3MS") else s
        if series_id == "T10Y3M":
            a, b = series_close("^TNX", "max"), series_close("^IRX", "max")
            s = (a - b).dropna()
            return s[s.index >= pd.Timestamp(start)]
        if series_id in _BLS_EQ:
            return bls(_BLS_EQ[series_id], start)
        if series_id == "SAHMREALTIME":
            u = bls("LNS14000000", "1968-01-01")
            if u.empty:
                return u
            m3 = u.rolling(3).mean()
            sahm = (m3 - m3.shift(1).rolling(12).min()).dropna()
            return sahm[sahm.index >= pd.Timestamp(start)].round(2)
    except Exception as e:  # noqa: BLE001
        log.warning("fallback %s: %s", series_id, e)
    return pd.Series(dtype=float)


def series_close(ticker, period="max"):
    df = prices([ticker], period)
    return df[ticker].dropna() if ticker in df else pd.Series(dtype=float)


_bls_cache: dict = {}


def bls(series_id, start="1990-01-01"):
    """BLS public API v1 (no key): monthly series, 10 years per request."""
    y0 = max(int(start[:4]), 1948)
    for (sid, yy), s in _bls_cache.items():
        if sid == series_id and yy <= y0:
            return s[s.index >= pd.Timestamp(start)]
    y1 = date.today().year
    out = {}
    key = os.environ.get("BLS_API_KEY")
    step = 20 if key else 10
    for a in range(y0, y1 + 1, step):
        b = min(y1, a + step - 1)
        body = {"seriesid": [series_id], "startyear": str(a), "endyear": str(b)}
        if key:
            body["registrationkey"] = key
        url = f"https://api.bls.gov/publicAPI/v{'2' if key else '1'}/timeseries/data/"
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**UA, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                js = json.loads(r.read().decode())
            for row in js["Results"]["series"][0]["data"]:
                if row["period"].startswith("M") and row["period"] != "M13":
                    out[pd.Timestamp(f"{row['year']}-{row['period'][1:]}-01")] = float(row["value"])
        except Exception as e:  # noqa: BLE001
            log.warning("BLS %s %s-%s: %s", series_id, a, b, e)
            break
    s = pd.Series(out).sort_index() if out else pd.Series(dtype=float)
    _bls_cache[(series_id, y0)] = s
    return s[s.index >= pd.Timestamp(start)] if len(s) else s


def fred_release_dates(release_id: int, start: date, end: date) -> list[str]:
    """Upcoming release dates (needs FRED_API_KEY; returns [] otherwise)."""
    key = os.environ.get("FRED_API_KEY")
    if MOCK or not key:
        return []
    url = (f"https://api.stlouisfed.org/fred/release/dates?release_id={release_id}&api_key={key}"
           f"&file_type=json&include_release_dates_with_no_data=true"
           f"&realtime_start={start.isoformat()}&realtime_end={end.isoformat()}")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            js = json.loads(r.read().decode())
        return [d["date"] for d in js.get("release_dates", []) if start.isoformat() <= d["date"] <= end.isoformat()]
    except Exception as e:  # noqa: BLE001
        log.warning("FRED release %s: %s", release_id, e)
        return []


# ---------------------------------------------------------------------------
# World Bank (annual indicators)
# ---------------------------------------------------------------------------
def worldbank_latest(indicator: str, iso2_list: list[str]) -> dict:
    """{iso2: (value, year)} for the latest non-null observation."""
    if MOCK:
        rng = np.random.default_rng(_seed(indicator))
        base = {"NY.GDP.MKTP.KD.ZG": (2, 2), "FP.CPI.TOTL.ZG": (4, 4), "SL.UEM.TOTL.ZS": (6, 3)}[indicator]
        return {c: (round(float(abs(rng.normal(*base))), 2), "2025") for c in iso2_list}
    out = {}
    codes = ";".join(iso2_list)
    url = f"https://api.worldbank.org/v2/country/{codes}/indicator/{indicator}?format=json&per_page=2000&mrnev=1"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
            js = json.loads(r.read().decode())
        for row in js[1] or []:
            if row.get("value") is not None:
                out[row["country"]["id"]] = (round(float(row["value"]), 2), row["date"])
    except Exception as e:  # noqa: BLE001
        log.warning("World Bank %s: %s", indicator, e)
    return out


# ---------------------------------------------------------------------------
# Mock data (deterministic, realistic-looking)
# ---------------------------------------------------------------------------
_MOCK_LEVEL = {
    "^GSPC": 7350, "^SP500TR": 15000, "^NDX": 26900, "^DJI": 46000, "^RUT": 2750, "^IXIC": 24500,
    "^VIX": 22, "^VIX9D": 23, "^VIX3M": 23, "^VIX6M": 23.5, "^VVIX": 110, "^MOVE": 95,
    "^IRX": 3.9, "^FVX": 4.2, "^TNX": 4.5, "^TYX": 4.9, "DX-Y.NYB": 101, "EURUSD=X": 1.11,
    "JPY=X": 152, "GBPUSD=X": 1.30, "CHF=X": 0.84, "CAD=X": 1.38, "AUDUSD=X": 0.66, "NZDUSD=X": 0.6,
    "CNY=X": 7.15, "MXN=X": 18.9, "BRL=X": 5.4, "INR=X": 86, "KRW=X": 1400, "ZAR=X": 17.8, "TRY=X": 41,
    "CL=F": 88, "BZ=F": 92, "GC=F": 3400, "SI=F": 38, "HG=F": 4.9, "NG=F": 3.6, "PL=F": 1300, "ZC=F": 430, "ZW=F": 540,
    "BTC-USD": 105000, "ETH-USD": 3900, "SOL-USD": 190, "TLT": 88, "HYG": 79, "JNK": 96, "LQD": 109,
}


def _seed(s):
    import zlib
    return zlib.crc32(str(s).encode())


def _bdays(period, start):
    end = pd.Timestamp(date.today()) - pd.offsets.BDay(0)
    if start:
        st = pd.Timestamp(start)
    else:
        n = {"1mo": 31, "3mo": 92, "6mo": 183, "1y": 366, "2y": 731, "5y": 1827, "10y": 3653, "max": 36000}.get(period, 731)
        st = end - pd.Timedelta(days=n)
    if period == "max" and not start:
        st = pd.Timestamp("1927-12-30")
    return pd.bdate_range(st, end)


def _mock_prices(tickers, period, start):
    idx = _bdays(period, start)
    cols = {}
    for t in tickers:
        rng = np.random.default_rng(_seed(t))
        lvl = _MOCK_LEVEL.get(t, float(rng.uniform(20, 600)))
        vol = 0.012 if not t.startswith("^VIX") else 0.05
        if t in ("^GSPC", "^SP500TR", "^IXIC", "^N225", "^STOXX50E") and len(idx) > 5000:
            # long history: drift so 1928 ~ 17 and today ~ lvl
            n = len(idx)
            drift = math.log(lvl / 17.0) / n
            r = rng.normal(drift, 0.011, n)
            # inject crashes
            for yr, depth in [(1929, -0.55), (1937, -0.4), (1973, -0.35), (1987, -0.25), (2000, -0.3), (2008, -0.45), (2020, -0.3), (2022, -0.2)]:
                pos = idx.searchsorted(pd.Timestamp(f"{yr}-09-01"))
                if 0 < pos < n - 120:
                    r[pos:pos + 120] += depth / 120
                    r[pos + 120:pos + 400] -= depth / 280 * 0.9
            path = np.exp(np.cumsum(r))
            path = path / path[-1] * lvl
        else:
            r = rng.normal(0.0002, vol, len(idx))
            if t.startswith("^VIX") or t in ("^VVIX", "^MOVE"):
                x = np.zeros(len(idx)); x[0] = 0
                for i in range(1, len(idx)):
                    x[i] = x[i - 1] * 0.97 + rng.normal(0, 0.06)
                path = lvl * np.exp(x)
            else:
                path = np.exp(np.cumsum(r))
                path = path / path[-1] * lvl
        cols[t] = np.round(path, 4)
    return pd.DataFrame(cols, index=idx)


def _mock_fred(sid, start):
    rng = np.random.default_rng(_seed(sid))
    monthly = sid in ("CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE", "PAYEMS", "UNRATE", "SAHMREALTIME", "USREC") or sid.startswith(("IR3TIB", "IRLTLT"))
    weekly = sid in ("ICSA", "NFCI")
    st = max(pd.Timestamp(start), pd.Timestamp("1970-01-01"))
    idx = pd.date_range(st, pd.Timestamp(date.today()), freq="MS" if monthly else ("W-SAT" if weekly else "B"))
    n = len(idx)
    if sid in ("CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE"):
        v = 40 * np.exp(np.cumsum(rng.normal(0.0032, 0.002, n)))
    elif sid == "PAYEMS":
        v = 70000 + np.cumsum(rng.normal(130, 120, n))
    elif sid == "UNRATE":
        v = np.clip(5 + np.cumsum(rng.normal(0, 0.12, n)) * 0.3, 3.4, 10)
    elif sid == "SAHMREALTIME":
        v = np.clip(np.abs(rng.normal(0.15, 0.2, n)), 0, 3)
    elif sid == "USREC":
        v = np.zeros(n)
        for a, b in [("1973-12", "1975-03"), ("1980-01", "1980-07"), ("1981-07", "1982-11"), ("1990-07", "1991-03"), ("2001-03", "2001-11"), ("2007-12", "2009-06"), ("2020-02", "2020-04")]:
            v[(idx >= pd.Timestamp(a)) & (idx <= pd.Timestamp(b))] = 1
    elif sid == "ICSA":
        v = 300000 + np.cumsum(rng.normal(0, 4000, n)); v = np.clip(v, 190000, 700000)
    elif sid == "NFCI":
        v = np.cumsum(rng.normal(0, 0.03, n)) * 0.3 - 0.4
    elif sid == "T10Y3M":
        v = 1.2 + np.cumsum(rng.normal(0, 0.03, n)) * 0.4
    elif sid.startswith("BAML"):
        base = {"BAMLH0A0HYM2": 3.3, "BAMLC0A0CM": 0.95, "BAMLC0A4CBBB": 1.2, "BAMLH0A1HYBB": 2.2, "BAMLH0A3HYC": 8.5, "BAMLHE00EHYIOAS": 3.2, "BAMLEMCBPIOAS": 1.9}.get(sid, 2)
        x = np.zeros(n)
        for i in range(1, n):
            x[i] = x[i - 1] * 0.995 + rng.normal(0, 0.012)
        v = base * np.exp(x)
    elif sid in ("DFEDTARU", "DFEDTARL", "ECBDFR"):
        v = np.full(n, {"DFEDTARU": 4.0, "DFEDTARL": 3.75, "ECBDFR": 2.5}[sid])
    elif sid.startswith(("IR3TIB", "IRLTLT")):
        v = np.clip(3 + np.cumsum(rng.normal(0, 0.08, n)) * 0.2, -0.5, 12)
    elif sid in ("GS10", "TB3MS"):
        v = np.clip(4 + np.cumsum(rng.normal(0, 0.15, n)) * 0.3, 0.1, 15)
    else:
        v = rng.normal(0, 1, n).cumsum()
    return pd.Series(np.round(v, 4), index=idx)


def _mock_bundle(symbol):
    rng = np.random.default_rng(_seed(symbol))
    rev = float(rng.uniform(15, 420))
    g = rng.normal(0.07, 0.08, 4)
    revs = [rev / np.prod(1 + g[i:]) for i in range(4)] + [rev]
    revs = revs[1:]
    m = float(rng.uniform(0.06, 0.35))
    years = [pd.Timestamp(f"{y}-12-31") for y in (2022, 2023, 2024, 2025)]
    ni = [r * m * rng.uniform(0.85, 1.1) for r in revs]
    inc = pd.DataFrame({y: {"TotalRevenue": r * 1e9, "NetIncome": n * 1e9, "CostOfRevenue": r * 0.5e9, "ResearchAndDevelopment": r * 0.07e9,
                            "SellingGeneralAndAdministration": r * 0.08e9, "TaxProvision": n * 0.2e9, "DilutedEPS": n / 14, "OperatingIncome": r * (m + 0.05) * 1e9}
                        for y, r, n in zip(years, revs, ni)})
    cf = pd.DataFrame({y: {"OperatingCashFlow": n * 1.2e9, "CapitalExpenditure": -r * 0.04e9, "FreeCashFlow": (n * 1.2 - r * 0.04) * 1e9,
                           "CashDividendsPaid": -n * 0.15e9, "RepurchaseOfCapitalStock": -n * 0.5e9} for y, r, n in zip(years, revs, ni)})
    bs = pd.DataFrame({y: {"CashCashEquivalentsAndShortTermInvestments": r * 0.15e9, "TotalDebt": r * 0.25e9, "StockholdersEquity": r * 0.3e9}
                       for y, r in zip(years, revs)})
    qy = [pd.Timestamp(d) for d in ("2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30")]
    qinc = pd.DataFrame({q: {"TotalRevenue": rev / 4 * rng.uniform(0.85, 1.25) * 1e9, "DilutedEPS": ni[-1] / 56 * rng.uniform(0.8, 1.3)} for q in qy})
    price = float(rng.uniform(20, 600))
    shares = rev * 1e9 / price * rng.uniform(1.5, 8)
    sectors = list(("Technology", "Financial Services", "Industrials", "Healthcare", "Consumer Cyclical", "Consumer Defensive", "Energy", "Communication Services", "Utilities", "Basic Materials"))
    info = {"longName": f"{symbol.split('.')[0].title()} Holdings", "shortName": symbol, "sector": sectors[_seed(symbol) % len(sectors)],
            "industry": "Diversified", "currency": "USD", "financialCurrency": "USD", "exchange": "NMS", "marketCap": price * shares,
            "sharesOutstanding": shares, "trailingPE": float(rng.uniform(8, 60)), "trailingEps": price / rng.uniform(10, 50),
            "revenueGrowth": float(g[-1]), "operatingMargins": m + 0.05, "debtToEquity": float(rng.uniform(5, 200)),
            "dividendRate": price * 0.01, "dividendYield": float(rng.uniform(0, 3)), "totalDebt": rev * 0.25e9, "totalCash": rev * 0.15e9,
            "freeCashflow": ni[-1] * 1e9, "fiftyTwoWeekLow": price * 0.7, "fiftyTwoWeekHigh": price * 1.05, "currentPrice": price}
    recs = pd.DataFrame([{"period": "0m", "strongBuy": int(rng.integers(0, 15)), "buy": int(rng.integers(3, 20)), "hold": int(rng.integers(2, 15)),
                          "sell": int(rng.integers(0, 4)), "strongSell": int(rng.integers(0, 2))}])
    now = datetime.utcnow()
    news = [{"content": {"title": f"{info['longName']}: headline number {i + 1} about the quarter", "pubDate": (now - timedelta(hours=i * 3 + 1)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                         "provider": {"displayName": "Yahoo Finance"}, "canonicalUrl": {"url": "https://finance.yahoo.com/"}}} for i in range(6)]
    nxt = pd.Timestamp(date.today()) + pd.Timedelta(days=int(rng.integers(-6, 34)))
    ed = pd.DataFrame({"EPS Estimate": [1.2, 1.1, 1.0], "Reported EPS": [np.nan, 1.15, 0.98], "Surprise(%)": [np.nan, 4.5, -2.0]},
                      index=pd.DatetimeIndex([nxt.replace(hour=16), nxt - pd.Timedelta(days=91), nxt - pd.Timedelta(days=182)]).tz_localize("America/New_York"))
    ed.index.name = "Earnings Date"
    return {"symbol": symbol, "info": info, "inc": inc, "cf": cf, "bs": bs, "qinc": qinc, "recs": recs, "news": news, "edates": ed}
