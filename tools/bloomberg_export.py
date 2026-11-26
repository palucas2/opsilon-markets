"""Bloomberg → Opsilon: tick, minute and daily-curve history for the backtests.

Run on a machine with a logged-in Bloomberg terminal (ESSEC's trading room,
for example). It writes Parquet files into data/import/ in the format the
pipeline ingests (symbol, freq, ts, o, h, l, c, v). Commit them, or copy them
to your Mac, and the next `python pipeline/run.py trading` loads them into the
point-in-time store.

    pip install blpapi --index-url=https://blpapi.bloomberg.com/repository/releases/python/simple/ pandas pyarrow

    python tools/bloomberg_export.py curve  --root CL --depth 12 --start 2010-01-01
    python tools/bloomberg_export.py bars   --ticker "CL1 Comdty" --days 140 --interval 1
    python tools/bloomberg_export.py ticks  --ticker "CLF7 Comdty" --days 5

Names written:
    generic CL1…CL12 daily  → CL.c.0 … CL.c.11, freq 1d   (feeds the carry test)
    minute bars             → CL.c.0, freq 1m              (feeds the intraday backtester)
    ticks                   → <ticker>, freq tick, plus a 1-minute resample as CL.c.0 1m

Limits to know: Bloomberg keeps roughly six months of tick history and a few
years of minute bars; requests are per security and the script splits them by day.
On a generic ticker (CL1 Comdty) intraday history follows the contract that is
generic first *today*; for clean history across rolls pass dated contracts
(--ticker "CLZ6 Comdty") and stitch them, or use Databento's continuous symbols.

Excel alternative (Bloomberg add-in), for the daily curve:
    =BDH("CL1 Comdty","PX_LAST","01/01/2010","","Dir=V","Dts=S")
    … one column per CL1…CL12, then save as CSV with columns ts, c and a symbol column (CL.c.0 …),
    freq = 1d, and drop it in data/import/. For intraday bars in Excel, see HELP DAPI <GO> on the terminal.
"""
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "data" / "import"


def session():
    import blpapi
    s = blpapi.Session()
    if not s.start() or not s.openService("//blp/refdata"):
        raise SystemExit("No Bloomberg session: is the terminal running and logged in?")
    return s, s.getService("//blp/refdata")


def _events(s):
    import blpapi
    while True:
        ev = s.nextEvent(500)
        for msg in ev:
            yield msg
        if ev.eventType() == blpapi.Event.RESPONSE:
            return


def curve(root: str, depth: int, start: str, yellow: str = "Comdty"):
    s, ref = session()
    rows = []
    for i in range(1, depth + 1):
        req = ref.createRequest("HistoricalDataRequest")
        req.getElement("securities").appendValue(f"{root}{i} {yellow}")
        for f in ("PX_OPEN", "PX_HIGH", "PX_LOW", "PX_LAST", "PX_VOLUME"):
            req.getElement("fields").appendValue(f)
        req.set("startDate", start.replace("-", ""))
        req.set("endDate", dt.date.today().strftime("%Y%m%d"))
        req.set("periodicitySelection", "DAILY")
        s.sendRequest(req)
        for msg in _events(s):
            if not msg.hasElement("securityData"):
                continue
            fd = msg.getElement("securityData").getElement("fieldData")
            for k in range(fd.numValues()):
                e = fd.getValueAsElement(k)
                g = lambda f: e.getElementAsFloat(f) if e.hasElement(f) else None
                rows.append({"symbol": f"{root}.c.{i - 1}", "freq": "1d", "ts": pd.Timestamp(e.getElementAsDatetime("date")),
                             "o": g("PX_OPEN"), "h": g("PX_HIGH"), "l": g("PX_LOW"), "c": g("PX_LAST"), "v": g("PX_VOLUME")})
    df = pd.DataFrame(rows)
    return _write(df, f"bbg_curve_{root}")


def bars(ticker: str, days: int, interval: int, symbol: str | None):
    s, ref = session()
    end = dt.datetime.utcnow().replace(second=0, microsecond=0)
    rows = []
    for d in range(days, 0, -1):
        a = end - dt.timedelta(days=d)
        b = a + dt.timedelta(days=1)
        req = ref.createRequest("IntradayBarRequest")
        req.set("security", ticker)
        req.set("eventType", "TRADE")
        req.set("interval", interval)
        req.set("startDateTime", a)
        req.set("endDateTime", b)
        s.sendRequest(req)
        for msg in _events(s):
            if not msg.hasElement("barData"):
                continue
            arr = msg.getElement("barData").getElement("barTickData")
            for k in range(arr.numValues()):
                e = arr.getValueAsElement(k)
                rows.append({"ts": pd.Timestamp(e.getElementAsDatetime("time")), "o": e.getElementAsFloat("open"), "h": e.getElementAsFloat("high"),
                             "l": e.getElementAsFloat("low"), "c": e.getElementAsFloat("close"), "v": e.getElementAsFloat("volume")})
    df = pd.DataFrame(rows)
    df["symbol"] = symbol or _sym(ticker)
    df["freq"] = f"{interval}m"
    return _write(df, f"bbg_bars_{_safe(ticker)}")


def ticks(ticker: str, days: int, symbol: str | None):
    s, ref = session()
    end = dt.datetime.utcnow().replace(second=0, microsecond=0)
    rows = []
    for d in range(days, 0, -1):
        a = end - dt.timedelta(days=d)
        req = ref.createRequest("IntradayTickRequest")
        req.set("security", ticker)
        req.getElement("eventTypes").appendValue("TRADE")
        req.set("startDateTime", a)
        req.set("endDateTime", a + dt.timedelta(days=1))
        s.sendRequest(req)
        for msg in _events(s):
            if not msg.hasElement("tickData"):
                continue
            arr = msg.getElement("tickData").getElement("tickData")
            for k in range(arr.numValues()):
                e = arr.getValueAsElement(k)
                rows.append({"ts": pd.Timestamp(e.getElementAsDatetime("time")), "c": e.getElementAsFloat("value"), "v": e.getElementAsFloat("size")})
    t = pd.DataFrame(rows)
    if t.empty:
        raise SystemExit("No ticks returned.")
    t["symbol"], t["freq"] = _safe(ticker), "tick"
    t["o"] = t["h"] = t["l"] = t["c"]
    _write(t, f"bbg_ticks_{_safe(ticker)}")
    m = t.set_index("ts")["c"].resample("1min").ohlc().dropna()
    m.columns = ["o", "h", "l", "c"]
    m["v"] = t.set_index("ts")["v"].resample("1min").sum()
    m = m.reset_index()
    m["symbol"], m["freq"] = symbol or _sym(ticker), "1m"
    return _write(m, f"bbg_ticks1m_{_safe(ticker)}")


def _sym(ticker):
    root = ticker.split()[0]
    return f"{root.rstrip('0123456789')}.c.{max(0, int(''.join(ch for ch in root if ch.isdigit()) or 1) - 1)}" if root[-1].isdigit() else _safe(ticker)


def _safe(t):
    return t.replace(" ", "_")


def _write(df, name):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}_{dt.date.today():%Y%m%d}.parquet"
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    df[["symbol", "freq", "ts", "o", "h", "l", "c", "v"]].to_parquet(p, index=False)
    print(f"{len(df):,} rows → {p}")
    return p


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("curve"); c.add_argument("--root", default="CL"); c.add_argument("--depth", type=int, default=12); c.add_argument("--start", default="2010-01-01")
    b = sub.add_parser("bars"); b.add_argument("--ticker", default="CL1 Comdty"); b.add_argument("--days", type=int, default=140); b.add_argument("--interval", type=int, default=1); b.add_argument("--symbol")
    t = sub.add_parser("ticks"); t.add_argument("--ticker", required=True); t.add_argument("--days", type=int, default=5); t.add_argument("--symbol")
    a = ap.parse_args()
    if a.cmd == "curve":
        curve(a.root, a.depth, a.start)
    elif a.cmd == "bars":
        bars(a.ticker, a.days, a.interval, a.symbol)
    else:
        ticks(a.ticker, a.days, a.symbol)
