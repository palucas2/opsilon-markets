"""Pages sociétés (600) + calendrier (résultats, banques centrales, macro).

Les fondamentaux sont lents à récupérer : ils sont mis en cache dans
data/archive/fundamentals/ et rafraîchis par lots tournants (FUND_BATCH par
run, les plus anciens d'abord). Les prix, eux, sont rafraîchis à chaque run.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

import config as C
from common import ARCHIVE, CACHE, change_over, dstr, human_date, now_et_label, r, read_json, series_clean, write_json, ytd_change
from sources import fred_release_dates, prices, ticker_bundle

log = logging.getLogger("opsilon")
FUND_DIR = "fundamentals"


# ------------------------------------------------------------------ helpers
def _row(df, key, scale=1e9, n=4):
    """Last n values of a statement row, oldest first, with column labels."""
    if df is None or not isinstance(df, pd.DataFrame) or df.empty or key not in df.index:
        return None
    s = df.loc[key]
    s = s[sorted(s.index)][-n:]
    return [r(v / scale, 3) if pd.notna(v) else None for v in s.tolist()]


def _mon(c):
    t = pd.Timestamp(c)
    return f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.month-1]} {t.year}"


def process_bundle(b: dict) -> dict:
    info = b.get("info") or {}
    inc, cf, bs, q = b.get("inc"), b.get("cf"), b.get("bs"), b.get("qinc")
    ylab = [_mon(c) for c in sorted(inc.columns)[-4:]] if isinstance(inc, pd.DataFrame) and not inc.empty else []
    years = {"labels": ylab, "rev": _row(inc, "TotalRevenue"), "ni": _row(inc, "NetIncome"), "eps": _row(inc, "DilutedEPS", 1),
             "ocf": _row(cf, "OperatingCashFlow"), "capex": _row(cf, "CapitalExpenditure"), "fcf": _row(cf, "FreeCashFlow"),
             "div": [(-v if v is not None else None) for v in (_row(cf, "CashDividendsPaid") or [])] or None,
             "buy": [(-v if v is not None else None) for v in (_row(cf, "RepurchaseOfCapitalStock") or [])] or None,
             "cash": _row(bs, "CashCashEquivalentsAndShortTermInvestments"), "debt": _row(bs, "TotalDebt"), "equity": _row(bs, "StockholdersEquity"),
             "ends": [dstr(c) for c in sorted(inc.columns)[-4:]] if ylab else []}
    comp = None
    if years["rev"] and years["rev"][-1]:
        rev = years["rev"][-1]
        parts = []
        for k, lab in (("CostOfRevenue", "Cost of revenue"), ("ResearchAndDevelopment", "Research"),
                       ("SellingGeneralAndAdministration", "Sales and admin"), ("TaxProvision", "Tax")):
            v = _row(inc, k)
            if v and v[-1] and v[-1] > 0:
                parts.append([lab, v[-1]])
        ni = years["ni"][-1] if years["ni"] else None
        if ni is not None:
            comp = {"rev": rev, "parts": parts, "ni": ni}
    quarters = None
    if isinstance(q, pd.DataFrame) and not q.empty:
        cols = sorted(q.columns)[-5:]
        quarters = {"labels": [_mon(c) for c in cols],
                    "rev": [r(q.at["TotalRevenue", c] / 1e9, 3) if "TotalRevenue" in q.index and pd.notna(q.at["TotalRevenue", c]) else None for c in cols],
                    "eps": [r(q.at["DilutedEPS", c], 3) if "DilutedEPS" in q.index and pd.notna(q.at["DilutedEPS", c]) else None for c in cols]}
        # same quarter a year earlier, for the YoY readout
        allc = sorted(q.columns)
        if len(allc) >= 5 and "TotalRevenue" in q.index:
            a, bq = q.at["TotalRevenue", allc[-5]], q.at["TotalRevenue", allc[-1]]
            quarters["yoy"] = r((bq / a - 1) * 100, 1) if pd.notna(a) and pd.notna(bq) and a else None
    recs = None
    rc = b.get("recs")
    if isinstance(rc, pd.DataFrame) and not rc.empty:
        row = rc.iloc[0]
        recs = [["Strong buy", int(row.get("strongBuy", 0) or 0)], ["Buy", int(row.get("buy", 0) or 0)], ["Hold", int(row.get("hold", 0) or 0)],
                ["Sell", int(row.get("sell", 0) or 0)], ["Strong sell", int(row.get("strongSell", 0) or 0)]]
    news = []
    for it in (b.get("news") or [])[:8]:
        c = it.get("content", it) if isinstance(it, dict) else {}
        title = c.get("title")
        if not title:
            continue
        url = (c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url") or c.get("link")
        news.append({"t": title, "u": url, "p": (c.get("provider") or {}).get("displayName") or c.get("publisher") or "Yahoo Finance",
                     "d": c.get("pubDate") or c.get("displayTime")})
    earnings = {"next": None, "time": None, "past": []}
    ed = b.get("edates")
    if isinstance(ed, pd.DataFrame) and not ed.empty:
        idx = ed.index
        now = pd.Timestamp.now(tz=idx.tz) if getattr(idx, "tz", None) else pd.Timestamp.now()
        fut = ed[idx >= now - pd.Timedelta(hours=12)]
        if not fut.empty:
            t = fut.index.min()
            earnings["next"] = dstr(t)
            hh = t.hour + t.minute / 60
            earnings["time"] = "Before open" if 0 < hh < 9.5 else ("After close" if hh >= 16 else ("During session" if hh else None))
            earnings["est"] = r(fut.loc[t, "EPS Estimate"], 2) if "EPS Estimate" in fut else None
        past = ed[idx < now - pd.Timedelta(hours=12)]
        for t, row in past.sort_index(ascending=False).iterrows():
            hh = t.hour + t.minute / 60
            tm = "Before open" if 0 < hh < 9.5 else ("After close" if hh >= 16 else ("During session" if hh else None))
            earnings["past"].append([dstr(t), r(row.get("EPS Estimate"), 2), r(row.get("Reported EPS"), 2), tm])
    rate = info.get("dividendRate")
    px_now = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
    if rate and px_now:
        dy = rate / px_now * 100
    elif info.get("trailingAnnualDividendYield") is not None:
        dy = info["trailingAnnualDividendYield"] * 100
    else:
        dy = info.get("dividendYield")   # recent yfinance: already in percent
    if rate is None and dy is None:
        dy = 0.0
    return {
        "name": info.get("longName") or info.get("shortName") or b["symbol"],
        "sector": C.SECTOR_MAP.get(info.get("sector"), info.get("sector") or "Other"), "industry": info.get("industry"),
        "currency": info.get("currency") or "USD", "fcur": info.get("financialCurrency") or info.get("currency") or "USD",
        "exchange": info.get("fullExchangeName") or info.get("exchange"), "shares": info.get("sharesOutstanding"),
        "mcap": info.get("marketCap"), "pe": r(info.get("trailingPE"), 1), "eps": r(info.get("trailingEps"), 2),
        "revg": r((info.get("revenueGrowth") or 0) * 100, 1) if info.get("revenueGrowth") is not None else None,
        "opm": r((info.get("operatingMargins") or 0) * 100, 1) if info.get("operatingMargins") is not None else None,
        "de": r(info.get("debtToEquity"), 0), "dy": r(dy, 2), "divrate": r(rate, 2),
        "debt": r((info.get("totalDebt") or 0) / 1e9, 2) if info.get("totalDebt") else None,
        "cash": r((info.get("totalCash") or 0) / 1e9, 2) if info.get("totalCash") else None,
        "lo52": info.get("fiftyTwoWeekLow"), "hi52": info.get("fiftyTwoWeekHigh"),
        "years": years, "comp": comp, "quarters": quarters, "recs": recs, "news": news, "earnings": earnings,
        "fetched": date.today().isoformat(),
    }


# ------------------------------------------------------------------ refresh
def refresh_fundamentals(universe):
    batch = int(os.environ.get("FUND_BATCH", "120"))
    status = []
    for slug, sym, region, suf in universe:
        cached = read_json(f"{FUND_DIR}/{slug}.json", base=CACHE)
        status.append(((cached or {}).get("fetched", "0000"), slug, sym))
    status.sort()
    have = sum(1 for s_ in status if s_[0] != "0000")
    if have < len(status) * 0.9:          # first runs: fetch everything missing
        batch = max(batch, len(status) - have)
    todo = status[:batch]
    log.info("fundamentals: refreshing %d of %d", len(todo), len(status))
    for _, slug, sym in todo:
        try:
            p = process_bundle(ticker_bundle(sym))
            old = read_json(f"{FUND_DIR}/{slug}.json", base=CACHE) or {}
            for k in ("years", "comp", "quarters", "recs", "earnings"):   # keep old if new fetch came back empty
                if not p.get(k) or (isinstance(p[k], dict) and not any(p[k].values())):
                    p[k] = old.get(k, p.get(k))
            write_json(f"{FUND_DIR}/{slug}.json", p, base=CACHE)
        except Exception as e:  # noqa: BLE001
            log.warning("fundamentals %s: %s", sym, e)
        time.sleep(float(os.environ.get("FUND_SLEEP", "0.25")))


# ------------------------------------------------------------------ build
def build():
    universe = [(s, *C.symbol_from_slug(s)) for s in C.COMPANY_SLUGS]
    refresh_fundamentals(universe)
    fund = {slug: (read_json(f"{FUND_DIR}/{slug}.json", base=CACHE) or {}) for slug, *_ in universe}

    syms = [u[1] for u in universe]
    benches = sorted({C.bench_for(u[3])[1] for u in universe})
    PENCE = {"GBp": ("GBP", 100), "GBX": ("GBP", 100), "ZAc": ("ZAR", 100), "ILA": ("ILS", 100)}
    raw_ccys = {(f.get("currency") or "USD") for f in fund.values()}
    base_ccys = sorted({PENCE.get(c, (c, 1))[0] for c in raw_ccys} - {"USD"})
    ccy_t = {c: f"{c}USD=X" for c in base_ccys}
    px = prices(syms + benches + list(ccy_t.values()), "5y").sort_index()
    fxbase = {"USD": 1.0}
    for c, t in ccy_t.items():
        if t in px and px[t].notna().any():
            fxbase[c] = float(px[t].dropna().iloc[-1])
    fxlast = {}
    for c in raw_ccys:
        b, div = PENCE.get(c, (c, 1))
        if b in fxbase:
            fxlast[c] = fxbase[b] / div

    rows = []
    for slug, sym, region, suf in universe:
        f = fund.get(slug) or {}
        s = series_clean(px[sym]) if sym in px else pd.Series(dtype=float)
        if s.empty:
            continue
        close = s.iloc[-1]
        day = r((s.iloc[-1] / s.iloc[-2] - 1) * 100, 2) if len(s) > 1 else None
        shares = f.get("shares")
        mcap_local = close * shares if shares else f.get("mcap")
        ccy = f.get("currency") or "USD"
        fxr = fxlast.get(ccy) or fxlast.get(ccy.upper()) or 1.0
        mcap_usd = mcap_local * fxr if mcap_local else None
        rows.append({"slug": slug, "t": sym, "n": f.get("name") or sym, "sec": f.get("sector") or "Other", "reg": region, "cur": ccy,
                     "close": r(close, 2), "day": day, "mcap": r(mcap_usd / 1e9, 2) if mcap_usd else None, "pe": f.get("pe"),
                     "g": f.get("revg"), "om": f.get("opm"), "de": f.get("de"), "dy": f.get("dy")})
    rows.sort(key=lambda x: -(x["mcap"] or 0))
    for i, rw in enumerate(rows):
        rw["rank"] = i + 1
    write_json("companies/index.json", {"updated": now_et_label(), "asof": human_date(px.index[-1]) if not px.empty else "", "rows": rows})

    # sector averages of returns, by region
    rets = {}
    for rw in rows:
        s = series_clean(px[rw["t"]])
        rets[rw["slug"]] = [change_over(s, 30)[0], change_over(s, 91)[0], ytd_change(s), change_over(s, 365)[0]]

    for rw in rows:
        try:
            _company_page(rw, fund[rw["slug"]], px, rows, rets)
        except Exception as e:  # noqa: BLE001
            log.warning("company page %s: %s", rw["t"], e)

    build_calendar(universe, fund, rows, px)
    return len(rows)


def _company_page(rw, f, px, rows, rets):
    sym, slug = rw["t"], rw["slug"]
    suf = C.symbol_from_slug(slug)[2]
    bname, bt = C.bench_for(suf)
    s = series_clean(px[sym]); b = series_clean(px[bt]) if bt in px else pd.Series(dtype=float)
    last = s.index[-1]
    s1 = s[s.index > last - pd.Timedelta(days=365)]
    b1 = b[b.index > last - pd.Timedelta(days=365)] if len(b) else b
    # risk
    dr = s1.pct_change().dropna()
    vol = r(dr.std() * np.sqrt(252) * 100, 0) if len(dr) > 20 else None
    bvol, beta = None, None
    if len(b1) > 20:
        br = b1.pct_change().dropna()
        j = pd.concat([dr, br], axis=1, join="inner").dropna()
        if len(j) > 20:
            beta = r(np.cov(j.iloc[:, 0], j.iloc[:, 1])[0, 1] / np.var(j.iloc[:, 1], ddof=1), 2)
        bvol = r(br.std() * np.sqrt(252) * 100, 0)
    # peers: same region + sector
    peers = [x for x in rows if x["reg"] == rw["reg"] and x["sec"] == rw["sec"]][:60]
    peer_rows = [{"t": x["t"], "n": x["n"], "pe": x["pe"], "g": x["g"], "om": x["om"], "de": x["de"], "dy": x["dy"], "slug": x["slug"]} for x in peers]
    # returns table
    sec_rets = [rets[x["slug"]] for x in peers if x["slug"] in rets]
    avg = [r(np.nanmean([v[i] for v in sec_rets if v[i] is not None]), 1) if sec_rets else None for i in range(4)]
    ret_table = [[f["name"] if f.get("name") else sym, [r(v, 1) for v in rets[slug]]],
                 [f"{rw['sec']} average ({len(peers)})", avg],
                 [bname, [r(change_over(b, 30)[0], 1), r(change_over(b, 91)[0], 1), r(ytd_change(b), 1), r(change_over(b, 365)[0], 1)]]]
    # P/E over time: month-end close / last fiscal-year EPS known (report assumed 2 months after year end)
    pe_hist = []
    yrs = f.get("years") or {}
    eps, ends = yrs.get("eps") or [], yrs.get("ends") or []
    if eps and ends:
        known = sorted((pd.Timestamp(e) + pd.Timedelta(days=60), v) for e, v in zip(ends, eps) if v)
        m = s.resample("ME").last().dropna()
        for d, p in m.items():
            ks = [v for kd, v in known if kd <= d]
            if ks and ks[-1] > 0:
                pe_hist.append([dstr(d), r(p / ks[-1], 1)])
    # DCF base
    fcf = (yrs.get("fcf") or [None])[-1]
    debt = (yrs.get("debt") or [None])[-1] or f.get("debt") or 0
    cash = (yrs.get("cash") or [None])[-1] or f.get("cash") or 0
    fcfs = [v for v in (yrs.get("fcf") or []) if v]
    cagr = r(((fcfs[-1] / fcfs[0]) ** (1 / (len(fcfs) - 1)) - 1) * 100, 1) if len(fcfs) >= 2 and fcfs[0] > 0 and fcfs[-1] > 0 else None
    shares_bn = (f.get("shares") or 0) / 1e9
    out = {
        "t": sym, "slug": slug, "name": f.get("name") or sym, "sector": rw["sec"], "industry": f.get("industry"), "region": rw["reg"],
        "exchange": f.get("exchange"), "cur": f.get("currency") or "USD", "fcur": f.get("fcur") or f.get("currency") or "USD",
        "price": rw["close"], "date": dstr(last), "prev": r(s.iloc[-2], 2) if len(s) > 1 else None, "mcap_usd": rw["mcap"], "rank": rw["rank"],
        "shares": r(shares_bn, 4), "pe": f.get("pe"), "eps": f.get("eps"), "revg": f.get("revg"), "opm": f.get("opm"), "de": f.get("de"),
        "dy": f.get("dy"), "divrate": f.get("divrate"), "lo52": r(s1.min(), 2), "hi52": r(s1.max(), 2),
        "debt": debt, "cash": cash, "fcf": fcf, "capex": (yrs.get("capex") or [None])[-1],
        "years": yrs, "comp": f.get("comp"), "quarters": f.get("quarters"), "recs": f.get("recs"), "news": f.get("news") or [],
        "earnings": f.get("earnings"), "peers": peer_rows, "ret": ret_table, "pe_hist": pe_hist,
        "risk": {"vol": vol, "bvol": bvol, "beta": beta},
        "bench": {"name": bname, "dates": [dstr(x) for x in b1.index], "values": [r(v, 2) for v in b1.tolist()]},
        "hist": {"dates": [dstr(x) for x in s1.index], "values": [r(v, 2) for v in s1.tolist()]},
        "dcf": {"fcf": fcf, "nd": r((debt or 0) - (cash or 0), 3), "sh": r(shares_bn, 4), "cagr": cagr},
        "fetched": f.get("fetched"),
    }
    write_json(f"companies/{slug}.json", out)


# ------------------------------------------------------------------ calendar
def build_calendar(universe, fund, rows, px):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    end = monday + timedelta(days=35)
    rank = {rw["slug"]: rw["rank"] for rw in rows}
    events = []
    for slug, sym, region, suf in universe:
        f = fund.get(slug) or {}
        e = f.get("earnings") or {}
        dates = []
        if e.get("next"):
            dates.append((e["next"], e.get("time"), e.get("est"), None))
        for pe_ in (e.get("past") or [])[:1]:
            dates.append((pe_[0], pe_[3] if len(pe_) > 3 else None, pe_[1], pe_[2]))
        for d, tm, est, rep in dates:
            dd = date.fromisoformat(d)
            if not (monday <= dd < end):
                continue
            country = {"US": "US"}.get(region) or _country(suf)
            ev = {"date": d, "time": tm or "Time not given", "type": "Earnings", "region": country, "area": region,
                  "title": f.get("name") or sym, "t": sym, "slug": slug, "imp": "High" if rank.get(slug, 999) <= 25 else "Medium",
                  "prev": None, "actual": rep, "est": est, "src": "Yahoo Finance"}
            past = e.get("past") or []
            older = [p for p in past if p[0] < d]
            if len(older) >= 4:
                ev["prev"] = older[3][2]   # same quarter a year earlier
            s = series_clean(px[sym]) if sym in px else pd.Series(dtype=float)
            if rep is not None and len(s):
                react = _reaction(s, dd, tm)
                bt = C.bench_for(suf)
                bs = series_clean(px[bt[1]]) if bt[1] in px else pd.Series(dtype=float)
                ev["react"] = react; ev["bench"] = bt[0]; ev["breact"] = _reaction(bs, dd, tm) if len(bs) else None
            events.append(ev)
    for b in C.CENTRAL_BANKS:
        for m in b["meetings"]:
            dd = date.fromisoformat(m)
            if monday <= dd < end:
                events.append({"date": m, "time": {"fed": "2:00 pm", "ecb": "8:15 am", "boe": "7:00 am", "boj": "Time not given"}[b["key"]],
                               "type": "Central banks", "region": {"fed": "US", "ecb": "Euro area", "boe": "UK", "boj": "Japan"}[b["key"]],
                               "area": "Macro", "title": f"{b['full'].split(',')[0]} rate decision", "imp": "High", "src": "Official schedule"})
    for rid, name, imp in C.MACRO_RELEASES:
        for d in fred_release_dates(rid, monday, end):
            events.append({"date": d, "time": "8:30 am" if rid not in (13, 91) else "10:00 am", "type": "Macro", "region": "US",
                           "area": "Macro", "title": name, "imp": imp, "src": "FRED release calendar"})
    order = {"Before open": 0, "8:15 am": 1, "7:00 am": 1, "8:30 am": 2, "During session": 3, "10:00 am": 3, "2:00 pm": 4, "After close": 5, "Time not given": 6, "All day": -1}
    events.sort(key=lambda e: (e["date"], order.get(e["time"], 3), e.get("imp") != "High", e["title"]))
    weeks = []
    for i in range(5):
        a = monday + timedelta(days=7 * i)
        weeks.append({"start": a.isoformat(), "end": (a + timedelta(days=6)).isoformat()})
    write_json("calendar.json", {"updated": now_et_label(), "weeks": weeks, "events": events})


def _reaction(s, dd, tm):
    """% move on the first session that could react to the release."""
    ts = pd.Timestamp(dd)
    if tm == "After close":
        after = s[s.index > ts]
        before = s[s.index <= ts]
    else:
        after = s[s.index >= ts]
        before = s[s.index < ts]
    if after.empty or before.empty:
        return None
    return r((after.iloc[0] / before.iloc[-1] - 1) * 100, 2)


def _country(suf):
    return {"SZ": "China", "SS": "China", "HK": "Hong Kong", "KS": "South Korea", "T": "Japan", "TW": "Taiwan", "NS": "India", "BO": "India",
            "L": "UK", "PA": "France", "DE": "Germany", "AS": "Netherlands", "MC": "Spain", "MI": "Italy", "SW": "Switzerland", "ST": "Sweden",
            "CO": "Denmark", "HE": "Finland", "OL": "Norway", "BR": "Belgium", "IR": "Ireland", "VI": "Austria", "WA": "Poland"}.get(suf, "Europe")
