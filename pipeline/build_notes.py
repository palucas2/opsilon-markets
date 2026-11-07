"""Notes générées à partir des chiffres : note de clôture quotidienne, graphique
du jour, analyse FX, revue hebdomadaire. Tout est archivé dans data/archive/
(versionné dans git) puis recopié dans site/data/ à chaque build.
"""
from __future__ import annotations

import shutil
from datetime import date

import numpy as np
import pandas as pd

import config as C
from common import ARCHIVE, OUT, dstr, human_date, r, read_json, series_clean, write_json, zscore_move
from sources import fred, prices

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
YIELD_T = {"^IRX", "^FVX", "^TNX", "^TYX"}


def _fmt(v, d=2):
    if v is None:
        return "n/a"
    s = f"{abs(v):,.{d}f}"
    return ("+" if v >= 0 else "−") + s


def _pct(v, d=2):
    return _fmt(v, d) + "%"


def _movers(df, pairs, d):
    out = []
    for name, t in pairs:
        s = series_clean(df[t]) if t in df else pd.Series(dtype=float)
        s = s[s.index <= d]
        if len(s) < 3:
            continue
        if t in YIELD_T:
            chg = r((s.iloc[-1] - s.iloc[-2]) * 100, 1)   # basis points
            out.append({"name": name, "close": r(s.iloc[-1], 2), "chg": chg, "unit": "bp", "z": zscore_move(s)[1]})
        else:
            mv, z = zscore_move(s)
            out.append({"name": name, "close": r(s.iloc[-1], 4 if s.iloc[-1] < 10 else 2), "chg": mv, "unit": "%", "z": z})
    return out


def build():
    allt = sorted({t for v in C.NOTE_ASSETS.values() for _, t in v} | {t for _, t in C.SECTORS} | set(C.WATCHLIST))
    df = prices(allt, "2y").sort_index()
    spx = series_clean(df.get("^GSPC", pd.Series(dtype=float)))
    if spx.empty:
        return 0
    d = spx.index[-1]
    key = dstr(d)
    sec = {k: _movers(df, v, d) for k, v in C.NOTE_ASSETS.items()}
    sectors = _movers(df, C.SECTORS, d)
    wl = _movers(df, [(t, t) for t in C.WATCHLIST], d)
    wl_valid = [w for w in wl if w["chg"] is not None]
    up = sum(1 for w in wl_valid if w["chg"] > 0.05); down = sum(1 for w in wl_valid if w["chg"] < -0.05)
    gainers = sorted(wl_valid, key=lambda w: -w["chg"])[:5]; losers = sorted(wl_valid, key=lambda w: w["chg"])[:5]

    dgs2 = fred("DGS2", "2024-01-01")
    curve = []
    for name, t in [("3M", "^IRX"), ("2Y", None), ("5Y", "^FVX"), ("10Y", "^TNX"), ("30Y", "^TYX")]:
        if t:
            s = series_clean(df[t]) if t in df else pd.Series(dtype=float)
            s = s[s.index <= d]
        else:
            s = series_clean(dgs2)
        if len(s) > 1:
            curve.append({"tenor": name, "y": r(s.iloc[-1], 3), "chg": r((s.iloc[-1] - s.iloc[-2]) * 100, 1), "prev": r(s.iloc[-2], 3)})

    g = lambda k, n: next((m for m in sec[k] if m["name"] == n), {})
    sp, nq, rut, dji = g("equities", "S&P 500"), g("equities", "Nasdaq 100"), g("equities", "Russell 2000"), g("equities", "Dow Jones")
    vix, vvix = g("volatility", "VIX"), g("volatility", "VVIX")
    dxy, tnx = g("fx", "Dollar index"), g("rates", "US 10Y")
    hyg, gold, wti, btc = g("credit", "High yield (HYG)"), g("commodities", "Gold"), g("commodities", "WTI crude"), g("digital", "Bitcoin")

    # risk score: average of signed z-scores, squashed to [-1, 1]
    comps = [(sp.get("z"), 1), (rut.get("z"), 1), (hyg.get("z"), 1), (vix.get("z"), -1), (gold.get("z"), -0.5)]
    zs = [z * s for z, s in comps if z is not None]
    score = r(np.tanh(np.mean(zs) / 1.5), 2) if zs else 0
    regime = "Risk-on" if score > 0.25 else ("Risk-off" if score < -0.25 else "Neutral")

    s2 = next((c for c in curve if c["tenor"] == "2Y"), None); s10 = next((c for c in curve if c["tenor"] == "10Y"), None)
    steep = r((s10["chg"] - s2["chg"]), 1) if s2 and s10 and s2["chg"] is not None and s10["chg"] is not None else None
    sect_sorted = sorted([s for s in sectors if s["chg"] is not None], key=lambda x: -x["chg"])

    # ---------------- headline + lede
    narrow = sp.get("chg", 0) and sp["chg"] > 0 and down > up
    if narrow:
        head = f"Index gains hide a narrow session: {down} decliners against {up} advancers"
    elif sp.get("chg") is not None and abs(sp["chg"]) >= 1.5:
        head = f"S&P 500 {'jumps' if sp['chg'] > 0 else 'slides'} {abs(sp['chg']):.2f}% as {regime.lower()} flows {'broaden' if (sp['chg'] > 0) == (up > down) else 'split'} across assets"
    elif sect_sorted:
        head = f"{sect_sorted[0]['name']} leads, {sect_sorted[-1]['name'].lower()} lags in a {regime.lower()} session"
    else:
        head = "Markets close mixed"
    lede = (f"The S&P 500 closed {_pct(sp.get('chg'))} and the Nasdaq 100 {_pct(nq.get('chg'))}, with {up} of {len(wl_valid)} watchlist names higher. "
            f"The 10-year yield moved {_fmt(tnx.get('chg'), 1)}bp, the dollar index {_pct(dxy.get('chg'))} and the VIX {_pct(vix.get('chg'))}.")

    take = []
    if narrow or (sp.get("chg") is not None and sp["chg"] < 0 and up > down):
        take.append(f"Breadth and the index disagreed: {up} watchlist names rose and {down} fell while the S&P 500 moved {_pct(sp.get('chg'))}.")
    else:
        take.append(f"Breadth confirmed the index: {up} names up, {down} down, S&P 500 {_pct(sp.get('chg'))}.")
    if steep is not None:
        kind = ("bull" if (s10["chg"] or 0) < 0 else "bear") + ("-steepening" if steep > 0 else "-flattening")
        take.append(f"Treasuries: 2-year {_fmt(s2['chg'], 1)}bp, 10-year {_fmt(s10['chg'], 1)}bp, a {kind} move of {abs(steep):.1f}bp in 2s10s.")
    if dxy.get("chg") is not None:
        take.append(f"The dollar index moved {_pct(dxy['chg'])}" + (f", a {abs(dxy['z']):.1f} standard-deviation day." if dxy.get("z") and abs(dxy["z"]) > 1.5 else "."))
    if vix.get("chg") is not None:
        take.append(f"The VIX closed at {vix.get('close')} ({_pct(vix['chg'])})" + (f" and the VVIX {_pct(vvix.get('chg'))}." if vvix else "."))
    big = sorted([m | {"sec": k} for k, v in sec.items() for m in v if m.get("z") is not None], key=lambda m: -abs(m["z"]))[:3]

    sections = []
    labels = {"equities": "Equities", "rates": "Rates", "credit": "Credit", "fx": "FX", "commodities": "Commodities",
              "volatility": "Volatility", "digital": "Digital assets", "international": "International"}
    for k, lab in labels.items():
        mv = [m for m in sec[k] if m["chg"] is not None]
        if not mv:
            continue
        best = max(mv, key=lambda m: m["chg"]); worst = min(mv, key=lambda m: m["chg"])
        u = mv[0]["unit"]
        b_, w_ = f"{_fmt(best['chg'])}{u}", f"{_fmt(worst['chg'])}{u}"
        if best["chg"] >= 0 and worst["chg"] < 0:
            txt = f"{best['name']} rose the most, {b_}, and {worst['name']} fell the most, {w_}."
        elif worst["chg"] >= 0:
            txt = f"Everything rose: {best['name']} the most, {b_}, and {worst['name']} the least, {w_}."
        else:
            txt = f"Everything fell: {worst['name']} the most, {w_}, and {best['name']} the least, {b_}."
        sections.append({"key": k, "title": lab, "text": txt, "moves": sorted(mv, key=lambda m: -m["chg"])})

    # 1-month correlation snapshot
    corr = None
    try:
        cols = [t for t in ("^GSPC", "TLT", "DX-Y.NYB", "GC=F", "CL=F") if t in df]
        rr = df[cols].ffill().pct_change().iloc[-21:]
        cm = rr.corr()
        corr = {"names": ["S&P 500", "Treasuries", "Dollar", "Gold", "WTI"][:len(cols)], "m": [[r(v, 2) for v in row] for row in cm.values]}
    except Exception:  # noqa: BLE001
        pass

    notes = read_json("notes/index.json", default=[]) or []
    edition = next((n["edition"] for n in notes if n["date"] == key), (max([n["edition"] for n in notes]) + 1) if notes else 1)
    note = {"date": key, "day": DAYS[d.weekday()], "human": human_date(d), "edition": edition, "title": head, "lede": lede,
            "numbers": [{"k": "S&P 500", "v": sp.get("close"), "c": sp.get("chg"), "u": "%"}, {"k": "Nasdaq 100", "v": nq.get("close"), "c": nq.get("chg"), "u": "%"},
                        {"k": "US 10Y yield", "v": tnx.get("close"), "c": tnx.get("chg"), "u": "bp", "suffix": "%"},
                        {"k": "VIX", "v": vix.get("close"), "c": vix.get("chg"), "u": "%"},
                        {"k": "Risk score", "v": score, "label": regime}, {"k": "Breadth", "v": f"{up} / {down}", "label": "up / down"}],
            "takeaways": take, "big": big, "gainers": gainers, "losers": losers, "sectors": sect_sorted, "curve": curve,
            "sections": sections, "corr": corr, "watch": _watch(key)}
    write_json(f"notes/{key}.json", note, base=ARCHIVE)
    notes = [n for n in notes if n["date"] != key] + [{"date": key, "title": head, "edition": edition, "human": human_date(d)}]
    notes.sort(key=lambda n: n["date"], reverse=True)
    write_json("notes/index.json", notes, base=ARCHIVE)

    # ---------------- chart of the day: the section with the most unusual move
    pool = [s for s in sections if any(m.get("z") is not None for m in s["moves"])]
    if pool:
        pick = max(pool, key=lambda s: max(abs(m["z"]) for m in s["moves"] if m.get("z") is not None))
        top = max([m for m in pick["moves"] if m.get("z") is not None], key=lambda m: abs(m["z"]))
        cotd = {"date": key, "human": human_date(d), "title": f"{pick['title']}", "moves": pick["moves"],
                "what": pick["text"], "why": f"{top['name']} moved {_fmt(top['chg'])}{top['unit']}, {abs(top['z']):.1f} standard deviations from its average daily move over the past year, the most unusual move in the close note.",
                "note": head}
        write_json(f"cotd/{key}.json", cotd, base=ARCHIVE)
        ci = [c for c in (read_json("cotd/index.json", default=[]) or []) if c["date"] != key] + [{"date": key, "title": cotd["title"], "human": cotd["human"], "top": top["name"]}]
        ci.sort(key=lambda c: c["date"], reverse=True)
        write_json("cotd/index.json", ci, base=ARCHIVE)

    _fx_note(key, d)
    _weekly(key, d, df)
    _publish()
    return 1


def _watch(key):
    """Upcoming items from the calendar file, if it exists."""
    cal = read_json("calendar.json", base=OUT, default={}) or {}
    ev = [e for e in cal.get("events", []) if e["date"] > key and e.get("imp") == "High"][:6]
    return [{"date": e["date"], "title": e["title"], "type": e["type"]} for e in ev]


def _fx_note(key, d):
    fx = read_json("fx.json", base=OUT, default=None)
    if not fx:
        return
    mv = fx["moves"]; pairs = {p["key"]: p for p in fx["pairs"]}
    dxy = mv.get("dxy", {})
    cands = [(k, m) for k, m in mv.items() if k != "dxy" and m.get("z") is not None]
    if not cands:
        return
    k1, m1 = max(cands, key=lambda x: abs(x[1]["z"]))
    rates = fx.get("rates", {})
    title = f"Dollar index {'rises' if (dxy.get('d1') or 0) >= 0 else 'falls'} {abs(dxy.get('d1') or 0):.2f}% as {pairs[k1]['name']} makes the session's biggest move"
    paras = [
        f"The dollar index closed at {dxy.get('last')}, {_pct(dxy.get('d1'))} on the day, {_pct(dxy.get('w1'))} on the week and {_pct(dxy.get('ytd'))} this year.",
        f"{pairs[k1]['name']} moved {_pct(m1['d1'])}, a z-score of {m1['z']:+.2f} against its daily moves over the past year.",
    ]
    us = rates.get("USD", {}).get("rate")
    diffs = []
    for k, p in pairs.items():
        c = p.get("ccy")
        if c and c in rates and us is not None:
            diffs.append((c, r(us - rates[c]["rate"], 2), mv[k].get("m1"), p["name"]))
    if diffs:
        w = max(diffs, key=lambda x: abs(x[1] or 0))
        paras.append(f"The widest gap between US and foreign three-month rates is against the {w[0]}: {w[1]:+.2f} percentage points in favour of the dollar." if w[1] >= 0 else f"The widest gap between US and foreign three-month rates is against the {w[0]}: {abs(w[1]):.2f} percentage points in favour of the {w[0]}.")
    em = [(pairs[k]["name"], m["d1"]) for k, m in mv.items() if pairs[k]["group"] == "em" and m.get("d1") is not None]
    if em:
        e1 = max(em, key=lambda x: abs(x[1]))
        paras.append(f"Among emerging-market pairs, {e1[0]} moved the most, {_pct(e1[1])}.")
    note = {"date": key, "human": human_date(d), "day": DAYS[d.weekday()], "title": title, "lede": paras[0] + " " + paras[1], "paras": paras,
            "table": [{"name": pairs[k]["name"], **m} for k, m in mv.items()], "diffs": [{"ccy": a, "diff": b, "m1": c, "pair": dd} for a, b, c, dd in diffs]}
    write_json(f"fxnotes/{key}.json", note, base=ARCHIVE)
    idx = [n for n in (read_json("fxnotes/index.json", default=[]) or []) if n["date"] != key] + [{"date": key, "title": title, "human": human_date(d), "lede": note["lede"]}]
    idx.sort(key=lambda n: n["date"], reverse=True)
    write_json("fxnotes/index.json", idx, base=ARCHIVE)


def _weekly(key, d, df):
    """On the last session of a week, write a weekly review into the research library."""
    nxt = d + pd.offsets.BDay(1)
    if nxt.isocalendar()[1] == d.isocalendar()[1] and d.weekday() != 4:
        return
    rows = []
    for k, pairs in C.NOTE_ASSETS.items():
        for name, t in pairs:
            s = series_clean(df[t]) if t in df else pd.Series(dtype=float)
            s = s[s.index <= d]
            wk = s[s.index <= d - pd.Timedelta(days=7)]
            if len(s) and len(wk):
                chg = (s.iloc[-1] - wk.iloc[-1]) * 100 if t in YIELD_T else (s.iloc[-1] / wk.iloc[-1] - 1) * 100
                rows.append({"group": k, "name": name, "close": r(s.iloc[-1], 2), "chg": r(chg, 2), "unit": "bp" if t in YIELD_T else "%"})
    if not rows:
        return
    eq = [x for x in rows if x["group"] in ("equities", "international") and x["unit"] == "%"]
    best = max(eq, key=lambda x: x["chg"]); worst = min(eq, key=lambda x: x["chg"])
    title = f"Week to {human_date(d)}: {best['name']} {_pct(best['chg'])}, {worst['name']} {_pct(worst['chg'])}"
    rep = {"id": f"weekly-{key}", "date": key, "human": human_date(d), "kind": "Weekly review", "topics": ["Equities", "Rates", "FX", "Commodities"],
           "title": title, "summary": f"Every major asset over the week, from the {human_date(d - pd.Timedelta(days=7))} close.", "rows": rows}
    write_json(f"research/{rep['id']}.json", rep, base=ARCHIVE)
    idx = [x for x in (read_json("research/index.json", default=[]) or []) if x["id"] != rep["id"]] + [{k: rep[k] for k in ("id", "date", "human", "kind", "topics", "title", "summary")}]
    idx.sort(key=lambda x: x["date"], reverse=True)
    write_json("research/index.json", idx, base=ARCHIVE)


def _publish():
    """Copy archived notes into the served data folder."""
    for sub in ("notes", "cotd", "fxnotes", "research"):
        src = ARCHIVE / sub
        if src.exists():
            dst = OUT / sub
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
