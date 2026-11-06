"""Market history (S&P 500 depuis 1928) + données des simulateurs."""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

import config as C
from common import dstr, human_date, r, series_clean, write_json
from episodes_text import TEXT
from sources import fred, prices


def _compact(s: pd.Series, dec=2):
    """{"d0": first date, "dd": day gaps, "v": values} – about 3x smaller than ISO dates."""
    s = series_clean(s)
    if s.empty:
        return {"d0": None, "dd": [], "v": []}
    days = (s.index - s.index[0]).days.values
    gaps = np.diff(days, prepend=0).tolist()
    return {"d0": dstr(s.index[0]), "dd": [int(g) for g in gaps], "v": [r(v, dec) for v in s.tolist()]}


def build():
    raw = prices(list(C.HISTORY_INDICES.values()), "max")
    spx = series_clean(raw.get(C.HISTORY_INDICES["spx"], pd.Series(dtype=float)))
    if spx.empty:
        return 0
    asof = human_date(spx.index[-1])

    # ---------------------------------------------- total-return S&P (simulators)
    tr = series_clean(raw.get(C.HISTORY_INDICES["spxtr"], pd.Series(dtype=float)))
    daily_div = 1.04 ** (1 / 252) - 1           # approximation before 1988 (documented on the page)
    synth = spx * (1 + daily_div) ** np.arange(len(spx))
    if len(tr):
        first = tr.index[0]
        scale = tr.iloc[0] / synth[synth.index <= first].iloc[-1]
        spx_tr = pd.concat([synth[synth.index < first] * scale, tr])
    else:
        spx_tr = synth
    write_json("sims/spx.json", {"name": "S&P 500", "note": "with dividends", "asof": asof, **_compact(spx_tr, 2)})
    for key, name in (("ndq", "Nasdaq"), ("sx5e", "Euro Stoxx 50"), ("nky", "Nikkei 225")):
        s = series_clean(raw.get(C.HISTORY_INDICES[key], pd.Series(dtype=float)))
        if len(s):
            write_json(f"sims/{key}.json", {"name": name, "note": "prices only", "asof": asof, **_compact(s, 2)})

    # ---------------------------------------------- portfolio builder (monthly)
    stk = spx_tr.resample("ME").last().pct_change()
    gs10 = fred("GS10", "1953-01-01")
    if len(gs10):
        y = gs10.resample("ME").last() / 100
        bond = []
        for i in range(1, len(y)):
            c, yn = y.iloc[i - 1], y.iloc[i]
            n = 20 - 1 / 6   # semiannual periods left after one month
            pv = (c / 2) * (1 - (1 + yn / 2) ** (-n)) / (yn / 2) + (1 + yn / 2) ** (-n) if yn > 0 else 1 + c * n / 2
            bond.append((y.index[i], pv - 1 + c / 12))
        bser = pd.Series([b for _, b in bond], index=[d for d, _ in bond])
        j = pd.concat([stk, bser], axis=1, join="inner").dropna()
        write_json("sims/portfolio.json", {"start": dstr(j.index[0]), "stocks": [r(v, 5) for v in j.iloc[:, 0]], "bonds": [r(v, 5) for v in j.iloc[:, 1]], "cash": 0.02})

    # ---------------------------------------------- market history
    eps = []
    starts = [int(s.split("-")[0]) for s, _ in C.EPISODES]
    for i, (slug, title) in enumerate(C.EPISODES):
        a = pd.Timestamp(f"{starts[i]}-01-01")
        b = pd.Timestamp(f"{starts[i + 1]}-01-01") if i + 1 < len(starts) else spx.index[-1] + pd.Timedelta(days=1)
        w = spx[(spx.index >= a) & (spx.index < b)]
        if len(w) < 20:
            continue
        dd = w / w.cummax() - 1
        low_d = dd.idxmin()
        peak_d = w[w.index <= low_d].idxmax()
        peak, low = w[peak_d], w[low_d]
        after = spx[(spx.index > low_d) & (spx >= peak)]
        rec_d = after.index[0] if len(after) else None
        sess_low = int(((spx.index > peak_d) & (spx.index <= low_d)).sum())
        ep = {"slug": slug, "title": title, "n": i + 1, "from": dstr(w.index[0]), "to": dstr(w.index[-1]),
              "peak_d": dstr(peak_d), "peak": r(peak, 2), "low_d": dstr(low_d), "low": r(low, 2),
              "fall": r((low / peak - 1) * 100, 1), "m_low": r((low_d - peak_d).days / 30.44, 0), "s_low": sess_low,
              "rec_d": dstr(rec_d) if rec_d is not None else None,
              "m_rec": r((rec_d - low_d).days / 30.44, 0) if rec_d is not None else None,
              "ret": r((w.iloc[-1] / w.iloc[0] - 1) * 100, 1), "text": TEXT.get(slug, "")}
        eps.append(ep)
        end_chart = max(w.index[-1], rec_d if rec_d is not None else w.index[-1])
        end_chart = min(end_chart, w.index[0] + pd.DateOffset(years=8))
        ws = spx[(spx.index >= w.index[0]) & (spx.index <= end_chart)]
        write_json(f"history/{slug}.json", {**ep, "asof": asof, "series": _compact(ws, 2)})
    weekly = spx.resample("W-FRI").last().dropna()
    write_json("history/index.json", {"asof": asof, "episodes": eps, "series": _compact(weekly, 2)})
    return len(eps)
