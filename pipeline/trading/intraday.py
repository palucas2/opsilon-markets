"""Intraday backtester (one script for every setup) and the Topstep combine simulator.

Backtester rules
  - Times in Central Time. No position after 15:10 CT: anything open is closed at the 15:10 bar.
  - Micro contracts. Size = as many contracts as keep the stop's dollar risk within 150-250 $
    (a trade that needs more than 250 $ for one contract is skipped and counted).
  - Costs: round-turn commission and fees per contract, plus 1 tick of slippage per side on
    market and stop fills (targets are limit orders: no slippage).
  - When stop and target sit inside the same bar, the stop is assumed hit first (pessimistic).
  - No new entry from 5 minutes before to 15 minutes after a tier-1 release, except for the
    setups built to trade the release.

Edge test per setup
  - t-stat and block-bootstrap p-value of the average R per trade.
  - Placebo: the same entries with the direction flipped at random, 1,000 times. If the real
    setup does not beat most of the coin flips, the entry has no directional information.

Topstep simulator
  - Trailing maximum loss on the end-of-day high, locked at the starting balance once reached,
    breached intraday (using each trade's worst open loss).
  - Daily loss limit (day stopped), consistency rule (best day under 55 % of total profit before
    the account can pass), contract caps.
  - Monte Carlo over the backtest's own days: share of combines passed, failed, still running
    after 60 trading days, and the median number of days to pass.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config as K

CT = "America/Chicago"
MICRO_OF = {"CL=F": "MCL", "GC=F": "MGC", "NG=F": "MNG", "SI=F": "SIL", "HG=F": "MHG",
            "CL.c.0": "MCL", "GC.c.0": "MGC", "NG.c.0": "MNG", "MCL.c.0": "MCL", "MGC.c.0": "MGC"}


def hm(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


@dataclass
class Plan:
    day: pd.Timestamp
    setup: str
    side: int            # +1 long, -1 short
    entry_i: int         # bar index of the fill (entry at that bar's open if market, or at `entry` if stop)
    entry: float
    stop: float
    target: float | None
    exit_by: int         # minutes after midnight CT: time exit
    order: str = "stop"  # "stop" (breakout) or "market"


# ---------------------------------------------------------------------------
# Setups: each gets one session's bars (CT index) and returns at most one Plan
# ---------------------------------------------------------------------------
def _mins(idx):
    return idx.hour * 60 + idx.minute


def setup_orb(day, b, sess, tick, R=2.0, range_min=15, last_entry="10:30"):
    """Opening range breakout: range of the first 15 minutes after the pit open, stop order on either side."""
    m = _mins(b.index)
    o = hm(sess["open"])
    rng = b[(m >= o) & (m < o + range_min)]
    if len(rng) < 2:
        return None
    hi, lo = rng["h"].max(), rng["l"].min()
    if (hi - lo) / tick < 8:
        lo, hi = (hi + lo) / 2 - 4 * tick, (hi + lo) / 2 + 4 * tick
    after = np.where((m >= o + range_min) & (m <= hm(last_entry)))[0]
    for i in after:
        if b["h"].iat[i] > hi:
            return Plan(day, "orb", 1, i, hi + tick, lo - tick, hi + tick + R * (hi - lo + 2 * tick), hm("13:30"))
        if b["l"].iat[i] < lo:
            return Plan(day, "orb", -1, i, lo - tick, hi + tick, lo - tick - R * (hi - lo + 2 * tick), hm("13:30"))
    return None


def setup_eia(day, b, sess, tick, R=2.0):
    """EIA release breakout: 09:30-09:35 CT bar (10:30 ET). Crude on Wednesdays, gas on Thursdays."""
    m = _mins(b.index)
    bar = b[(m >= hm("09:30")) & (m < hm("09:35"))]
    if bar.empty:
        return None
    hi, lo = bar["h"].max(), bar["l"].min()
    after = np.where((m >= hm("09:35")) & (m <= hm("10:00")))[0]
    for i in after:
        if b["h"].iat[i] > hi:
            return Plan(day, "eia", 1, i, hi + tick, lo - tick, hi + tick + R * (hi - lo + 2 * tick), hm("11:30"))
        if b["l"].iat[i] < lo:
            return Plan(day, "eia", -1, i, lo - tick, hi + tick, lo - tick - R * (hi - lo + 2 * tick), hm("11:30"))
    return None


def setup_imom(day, b, sess, tick):
    """Intraday momentum (Gao, Han, Li & Zhou 2018): the first half hour's direction, traded into the settlement."""
    m = _mins(b.index)
    o, s = hm(sess["open"]), hm(sess["settle"])
    first = b[(m >= o) & (m < o + 30)]
    i_in = np.where(m >= s - 30)[0]
    if len(first) < 3 or not len(i_in):
        return None
    ret = first["c"].iat[-1] / first["o"].iat[0] - 1
    if abs(ret) < 0.001:
        return None
    i = i_in[0]
    side = 1 if ret > 0 else -1
    px = b["o"].iat[i]
    risk = max(10 * tick, 0.5 * (first["h"].max() - first["l"].min()))
    return Plan(day, "imom", side, i, px, px - side * risk, None, s, order="market")


def setup_vwap(day, b, sess, tick, k_in=2.0, k_stop=3.0):
    """VWAP reversion: fade a move of two session standard deviations away from VWAP between 09:00 and 12:00 CT."""
    m = _mins(b.index)
    o = hm(sess["open"])
    s = b[m >= o]
    if len(s) < 20:
        return None
    tp = (s["h"] + s["l"] + s["c"]) / 3
    v = s["v"].replace(0, np.nan).fillna(1)
    vwap = (tp * v).cumsum() / v.cumsum()
    dev = (s["c"] - vwap)
    sd = dev.expanding(12).std()
    ms = _mins(s.index)
    for j in range(len(s) - 1):
        if not (hm("09:00") <= ms[j] <= hm("12:00")) or not np.isfinite(sd.iat[j]) or sd.iat[j] <= 0:
            continue
        z = dev.iat[j] / sd.iat[j]
        if abs(z) >= k_in:
            side = -1 if z > 0 else 1
            i = b.index.get_loc(s.index[j + 1])
            px = b["o"].iat[i]
            stop = vwap.iat[j] + np.sign(z) * k_stop * sd.iat[j]
            if (stop - px) * side >= 0:
                return None
            return Plan(day, "vwap", side, i, px, stop, vwap.iat[j], hm("13:30"), order="market")
    return None


SETUPS = {
    "orb": ("Opening range breakout", setup_orb, False, "Break of the first 15 minutes after the pit open, stop on the other side, target 2R."),
    "eia": ("EIA 10:30 ET breakout", setup_eia, True, "Crude on Wednesdays, gas on Thursdays: break of the release bar, target 2R, out by 11:30 CT."),
    "imom": ("Intraday momentum into the settle", setup_imom, False, "Gao et al. (2018): first half-hour direction, traded over the last 30 minutes before settlement."),
    "vwap": ("VWAP reversion", setup_vwap, False, "Fade a two-standard-deviation stretch from session VWAP between 09:00 and 12:00 CT, target VWAP."),
}


# ---------------------------------------------------------------------------
def _blackouts(events: pd.DataFrame):
    out = []
    if events is None or events.empty:
        return out
    for _, e in events[events.tier == 1].iterrows():
        t = pd.Timestamp(f"{e.day} {e.time_et}", tz="America/New_York").tz_convert(CT)
        out.append((t - pd.Timedelta(minutes=K.BLACKOUT["before"]), t + pd.Timedelta(minutes=K.BLACKOUT["after"]), e["name"]))
    return out


def _simulate(plan: Plan, b, spec, side=None):
    """Fill and manage one plan on its session's bars. Returns per-contract result in $ and ticks."""
    name, _, _, _, tick, tv, rt_cost, _ = spec
    side = plan.side if side is None else side
    flip = side != plan.side
    entry = plan.entry
    stop = plan.stop if not flip else plan.entry + (plan.entry - plan.stop)
    target = plan.target if (plan.target is None or not flip) else plan.entry + (plan.entry - plan.target)
    flat = hm(K.TOPSTEP["flat_by"])
    m = _mins(b.index)
    slip = K.SLIPPAGE_TICKS * tick
    fill = entry + side * slip
    worst = 0.0
    exit_px, why = None, None
    i0 = plan.entry_i
    for i in range(i0, len(b)):
        if m[i] >= flat or m[i] >= plan.exit_by:
            exit_px, why = b["o"].iat[i] - side * slip, "flat 15:10" if m[i] >= flat else "time"
            break
        hi, lo = b["h"].iat[i], b["l"].iat[i]
        adverse = lo if side > 0 else hi
        worst = min(worst, (adverse - fill) * side)
        if (side > 0 and lo <= stop) or (side < 0 and hi >= stop):
            exit_px, why = stop - side * slip, "stop"
            worst = min(worst, (exit_px - fill) * side)
            break
        if target is not None and ((side > 0 and hi >= target) or (side < 0 and lo <= target)):
            exit_px, why = target, "target"
            break
    if exit_px is None:
        exit_px, why = b["c"].iat[-1] - side * slip, "session end"
    ticks = (exit_px - fill) * side / tick
    risk_ticks = abs(fill - stop) / tick + K.SLIPPAGE_TICKS
    return {"pnl1": ticks * tv - rt_cost, "mae1": worst / tick * tv - rt_cost, "risk1": risk_ticks * tv + rt_cost,
            "ticks": ticks, "exit": why, "exit_px": exit_px, "fill": fill, "stop": stop}


def size_for(risk1, lo=None, hi=None):
    """Contracts keeping risk inside [lo, hi], as close to the middle as possible; 0 if one contract is above hi."""
    lo, hi = lo or K.RISK_MIN, hi or K.RISK_MAX
    if risk1 <= 0 or risk1 > hi:
        return 0
    a, b = max(1, math.ceil(lo / risk1)), int(hi // risk1)
    if a > b:
        return b
    mid = (lo + hi) / 2
    return min(range(a, b + 1), key=lambda q: abs(q * risk1 - mid))


def backtest(bars_utc: pd.DataFrame, symbol: str, events: pd.DataFrame | None = None, setups=None):
    micro = MICRO_OF.get(symbol, "MCL")
    spec = K.CONTRACTS[micro]
    tick = spec[4]
    sess = K.SESSION[micro]
    b_all = bars_utc.tz_convert(CT) if bars_utc.index.tz else bars_utc.tz_localize("UTC").tz_convert(CT)
    b_all = b_all[["o", "h", "l", "c", "v"]].dropna(subset=["c"])
    bo = _blackouts(events)
    trades, skipped = [], {"too_risky": 0, "blackout": 0}
    for day, b in b_all.groupby(b_all.index.date):
        if pd.Timestamp(day).weekday() >= 5:
            continue
        b = b[_mins(b.index) >= hm("06:00")]
        if len(b) < 30:
            continue
        for key, (label, fn, news, _) in SETUPS.items():
            if setups and key not in setups:
                continue
            if key == "eia" and not ((micro in ("MCL", "CL") and pd.Timestamp(day).weekday() == 2) or (micro in ("MNG", "NG") and pd.Timestamp(day).weekday() == 3)):
                continue
            plan = fn(pd.Timestamp(day), b, sess, tick)
            if plan is None:
                continue
            t_in = b.index[plan.entry_i]
            if not news and any(a <= t_in <= z for a, z, _ in bo):
                skipped["blackout"] += 1
                continue
            res = _simulate(plan, b, spec)
            qty = size_for(res["risk1"])
            if qty == 0:
                skipped["too_risky"] += 1
                continue
            qty = min(qty, K.TOPSTEP["max_contracts"].get(micro, qty))
            alt = _simulate(plan, b, spec, side=-plan.side)
            trades.append({"day": str(day), "setup": key, "symbol": micro, "side": plan.side, "qty": qty,
                           "entry_t": t_in.strftime("%H:%M"), "hour": t_in.hour, "wd": t_in.weekday(),
                           "fill": res["fill"], "exit_px": res["exit_px"], "exit": res["exit"],
                           "pnl": res["pnl1"] * qty, "mae": min(0.0, res["mae1"] * qty), "risk": res["risk1"] * qty,
                           "r": res["pnl1"] / res["risk1"], "r_flip": alt["pnl1"] / alt["risk1"]})
    return pd.DataFrame(trades), skipped


# ---------------------------------------------------------------------------
def setup_stats(t: pd.DataFrame, n_placebo=1000, seed=3):
    if t.empty:
        return {"n": 0, "verdict": "No trades"}
    r = t["r"].values
    n = len(r)
    wins, losses = t.loc[t.pnl > 0, "pnl"].sum(), -t.loc[t.pnl < 0, "pnl"].sum()
    tstat = float(r.mean() / (r.std(ddof=1) / math.sqrt(n))) if n > 2 and r.std() > 0 else float("nan")
    rng = np.random.default_rng(seed)
    flips = rng.random((n_placebo, n)) < 0.5
    plac = np.where(flips, t["r_flip"].values, r).mean(axis=1)
    p_placebo = float(((plac >= r.mean()).sum() + 1) / (n_placebo + 1))
    boot = np.array([rng.choice(r - r.mean(), n).mean() for _ in range(1000)])
    p_boot = float(((boot >= r.mean()).sum() + 1) / 1001)
    out = {"n": n, "win": float((t.pnl > 0).mean() * 100), "avg_r": float(r.mean()), "exp": float(t.pnl.mean()),
           "pf": float(wins / losses) if losses else None, "pnl": float(t.pnl.sum()), "t": tstat, "p_placebo": p_placebo, "p_boot": p_boot,
           "by_hour": {str(h): round(float(g.pnl.sum()), 0) for h, g in t.groupby("hour")},
           "by_wd": {str(w): round(float(g.pnl.sum()), 0) for w, g in t.groupby("wd")},
           "exits": t["exit"].value_counts().to_dict()}
    ok = [n >= 30, tstat > 2, p_placebo < .05, out["avg_r"] > .1]
    out["verdict"] = "Edge" if all(ok) else ("Too few trades" if n < 30 else "Weak" if sum(ok[1:]) >= 2 else "No edge")
    eq = t.groupby("day").pnl.sum().cumsum()
    out["eq"] = {"d": list(eq.index), "v": [round(float(x), 0) for x in eq.values]}
    return out


# ---------------------------------------------------------------------------
# Topstep combine
# ---------------------------------------------------------------------------
def _day_arrays(t: pd.DataFrame):
    """One tuple (pnl, mae, qty, cap) of numpy arrays per trading day, trades in time order."""
    caps = K.TOPSTEP["max_contracts"]
    out = []
    for _, g in t.sort_values(["day", "entry_t"]).groupby("day"):
        out.append((g.pnl.values.astype(float), g.mae.values.astype(float), g.qty.values, np.array([caps.get(s, 10 ** 9) for s in g.symbol])))
    return out


EMPTY = (np.zeros(0), np.zeros(0), np.zeros(0), np.zeros(0))


def combine_run(days, rules=None):
    """Run one combine over a sequence of trading days (tuples from _day_arrays, in order)."""
    R = rules or K.TOPSTEP
    start = R["start_balance"]
    dll = R.get("daily_loss_limit")
    bal, eod_high = start, start
    best_day = 0.0
    for k, (pnl, mae, qty, cap) in enumerate(days, 1):
        mll = min(start, eod_high - R["max_loss_trailing"])
        day_pnl = 0.0
        for j in range(len(pnl)):
            if qty[j] > cap[j]:
                return {"result": "fail", "days": k, "why": "contract cap"}
            if bal + day_pnl + mae[j] <= mll:
                return {"result": "fail", "days": k, "why": "trailing max loss"}
            if dll and day_pnl + mae[j] <= -dll:
                day_pnl = -dll
                break
            day_pnl += pnl[j]
            if dll and day_pnl <= -dll:
                break
        bal += day_pnl
        if bal <= mll:
            return {"result": "fail", "days": k, "why": "trailing max loss"}
        eod_high = max(eod_high, bal)
        best_day = max(best_day, day_pnl)
        profit = bal - start
        if profit >= R["profit_target"] and k >= R["min_days"] and best_day <= R["consistency"] * profit:
            return {"result": "pass", "days": k}
    return {"result": "open", "days": len(days), "profit": bal - start}


def combine_montecarlo(t: pd.DataFrame, n=2000, horizon=60, seed=5):
    if t.empty:
        return None
    by_day = _day_arrays(t)
    n_days = max(1, len(pd.bdate_range(t["day"].min(), t["day"].max())))
    p_trade_day = min(1.0, len(by_day) / n_days)
    rng = np.random.default_rng(seed)
    res = []
    for _ in range(n):
        pick = rng.integers(len(by_day), size=horizon)
        on = rng.random(horizon) < p_trade_day
        res.append(combine_run([by_day[i] if o else EMPTY for i, o in zip(pick, on)]))
    df = pd.DataFrame(res)
    passed = df[df.result == "pass"]
    fails = df[df.result == "fail"]
    return {"n": n, "horizon": horizon, "pass": float((df.result == "pass").mean() * 100), "fail": float((df.result == "fail").mean() * 100),
            "open": float((df.result == "open").mean() * 100), "days_to_pass": float(passed.days.median()) if len(passed) else None,
            "fail_why": fails["why"].value_counts().to_dict() if len(fails) else {}, "historical": combine_run(by_day)}
