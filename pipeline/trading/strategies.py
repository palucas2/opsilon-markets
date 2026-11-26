"""Daily commodity strategies from the literature, written so they can be tested
for an edge. Every strategy returns a Spec: a position matrix (rows = days,
columns = markets, position held from that day's close to the next), the
matching return matrix and a cost function. Fundamentals are read point in
time from the store: a figure enters a position only from the close of the
day it was published.

Positions are volatility-scaled to 10 % a year per market and divided by the
square root of the number of markets, so portfolios run near 10 % volatility
and strategies are comparable.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import config as K
from . import store

TARGET_VOL = 0.10


@dataclass
class Spec:
    key: str
    name: str
    family: str
    idea: str
    pos: pd.DataFrame
    rets: pd.DataFrame
    cost_bps: pd.Series
    freq: str = "daily"
    notes: list = field(default_factory=list)

    def cost_fn(self):
        c = (self.cost_bps.reindex(self.pos.columns).fillna(3) / 1e4).values
        return lambda turn: turn @ c

    def net(self):
        P, R = self.pos.fillna(0), self.rets.reindex(self.pos.index).fillna(0)
        gross = (P.shift(1) * R).sum(axis=1)
        turn = P.diff().abs().fillna(0)
        cost = (turn * (self.cost_bps.reindex(P.columns).fillna(3) / 1e4)).sum(axis=1)
        return (gross - cost.shift(0)).iloc[1:]

    def by_market(self):
        P, R = self.pos.fillna(0), self.rets.reindex(self.pos.index).fillna(0)
        out = {}
        for c in P.columns:
            g = P[c].shift(1) * R[c] - P[c].diff().abs().fillna(0) * self.cost_bps.get(c, 3) / 1e4
            out[c] = g.iloc[1:]
        return out


# ---------------------------------------------------------------------------
def clean_returns(close: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    """Daily returns of continuous front futures. Yahoo's =F series are not roll-adjusted:
    a roll shows up as a jump. Returns above 7 rolling standard deviations are treated
    as roll gaps and set to zero (logged), which is crude but removes the worst bias."""
    r = close.pct_change(fill_method=None)
    sd = r.rolling(120, min_periods=40).std().shift(1)
    jump = (r.abs() > 7 * sd) & sd.notna()
    notes = [f"{c}: {int(jump[c].sum())} roll-like jumps zeroed" for c in r.columns if jump[c].sum()]
    r = r.mask(jump, 0.0)
    r = r.clip(-0.35, 0.35)       # NYMEX WTI April 2020 and similar prints
    return r, notes


def vol_scale(sig: pd.DataFrame, r: pd.DataFrame, cap=3.0) -> pd.DataFrame:
    vol = r.ewm(span=60, min_periods=40).std() * np.sqrt(252)
    lev = (TARGET_VOL / vol).clip(upper=cap)
    n = sig.notna().sum(axis=1).replace(0, np.nan)
    return (sig * lev).div(np.sqrt(n), axis=0)       # sqrt(N): about 10 % portfolio vol if markets are weakly correlated


def month_end_hold(sig: pd.DataFrame) -> pd.DataFrame:
    """Rebalance on the last trading day of each month, hold in between."""
    me = sig.index.to_series().groupby(sig.index.to_period("M")).transform("max") == sig.index.to_series()
    return sig.where(me).ffill()


def terciles(score: pd.DataFrame) -> pd.DataFrame:
    rk = score.rank(axis=1, pct=True)
    return (rk > 2 / 3).astype(float) - (rk <= 1 / 3).astype(float) + 0 * score


def _costs(cols):
    return pd.Series({c: K.COST_BPS.get(c, 3) for c in cols})


# ---------------------------------------------------------------------------
# 1. Time-series momentum (Moskowitz, Ooi & Pedersen 2012)
def tsmom(close, r):
    sig = np.sign(close / close.shift(252) - 1)
    sig = month_end_hold(sig)
    return Spec("tsmom", "Time-series momentum, 12 months", "Trend", "Long markets up over the past year, short those down; monthly, volatility-scaled.",
                vol_scale(sig, r), r, _costs(close.columns))


# 2. Cross-sectional momentum (Miffre & Rallis 2007)
def xsmom(close, r):
    score = close.shift(21) / close.shift(252) - 1
    sig = month_end_hold(terciles(score))
    return Spec("xsmom", "Cross-sectional momentum, 12-1 months", "Trend", "Each month, long the best third of the past year (skipping the last month), short the worst third.",
                vol_scale(sig, r), r, _costs(close.columns))


# 3. Hedging pressure (Basu & Miffre 2013)
def _pit(name, index):
    return store.known_daily(name, index, cutoff="16:00")


def hedging_pressure(close, r):
    mm = pd.DataFrame({c: _pit(f"cot_mm_pct_{c}", close.index) for c in close.columns})
    if mm.notna().sum().sum() < 500:
        return None
    wk = mm.index.dayofweek == 4
    sig = terciles(mm).where(pd.Series(wk, index=mm.index), np.nan).ffill()
    return Spec("hp", "Hedging pressure (COT)", "Positioning", "Weekly: long the third of markets where funds hold the largest net long as a share of open interest (producers most hedged), short the smallest.",
                vol_scale(sig, r), r, _costs(close.columns), freq="weekly")


# 4. Speculator flow reversal (Kang, Rouwenhorst & Tang 2020)
def cot_reversal(close, r):
    mm = pd.DataFrame({c: _pit(f"cot_mm_pct_{c}", close.index) for c in close.columns})
    if mm.notna().sum().sum() < 500:
        return None
    chg = mm - mm.shift(5)
    wk = pd.Series(mm.index.dayofweek == 4, index=mm.index)
    sig = (-terciles(chg)).where(wk, np.nan).ffill()
    return Spec("cotrev", "Fund-flow reversal (COT)", "Positioning", "Weekly: short the third of markets funds bought most in the last report, long the third they sold most (liquidity provision).",
                vol_scale(sig, r), r, _costs(close.columns), freq="weekly")


# 5. EIA inventory surprise drift (Halova, Kurov & Kucher 2014)
def _seasonal_surprise(df: pd.DataFrame, years=5):
    """Weekly change against the average change for the same week in the prior `years` years (no consensus needed)."""
    s = df.set_index("period")["value"]
    d = s.diff()
    wk = d.index.isocalendar().week.values
    exp = []
    for i, (t, w) in enumerate(zip(d.index, wk)):
        past = d[(d.index < t - pd.Timedelta(days=300)) & (d.index >= t - pd.Timedelta(days=365 * years + 20))]
        pw = past[np.abs(past.index.isocalendar().week.values - w) <= 1]
        exp.append(pw.mean() if len(pw) >= 3 else np.nan)
    sur = d - np.array(exp)
    z = sur / sur.rolling(104, min_periods=40).std().shift(1)
    out = pd.DataFrame({"sur": sur, "z": z}).reindex(s.index)
    out["published"] = df.set_index("period")["published"]
    return out.dropna()


def eia_drift(close, r, series="eia_crude", market="wti", hold=5, thr=1.0, key="eia", name="EIA crude surprise drift"):
    df = store.frame(series)
    if len(df) < 200 or market not in close.columns:
        return None
    s = _seasonal_surprise(df)
    sig = pd.Series(np.nan, index=close.index)
    for _, row in s.iterrows():
        if abs(row.z) < thr:
            continue
        day = row.published.normalize()
        loc = close.index.searchsorted(day)
        if loc >= len(close.index):
            continue
        sig.iloc[loc:loc + hold] = -np.sign(row.z)      # build = bearish, draw = bullish
    sig = sig.fillna(0)
    sub = r[[market]]
    pos = vol_scale(sig.to_frame(market), sub) * 1.0
    return Spec(key, name, "Fundamentals", f"After a weekly {series.replace('eia_', '')} change more than one standard deviation away from the seasonal norm, trade against the build (with the draw) from the release-day close for {hold} days.",
                pos, sub, _costs([market]), freq="event")


# 6. Gas storage deficit momentum (Gorton, Hayashi & Rouwenhorst 2013, inventories)
def gas_storage(close, r):
    df = store.frame("eia_gas")
    if len(df) < 300 or "natgas" not in close.columns:
        return None
    s = df.set_index("period")["value"]
    pubs = df.set_index("period")["published"]
    wk = s.index.isocalendar().week.values
    avg5 = []
    for t, w in zip(s.index, wk):
        past = s[(s.index < t - pd.Timedelta(days=300)) & (s.index >= t - pd.Timedelta(days=365 * 5 + 20))]
        pw = past[np.abs(past.index.isocalendar().week.values - w) <= 1]
        avg5.append(pw.mean() if len(pw) >= 4 else np.nan)
    dev = (s - np.array(avg5)) / np.array(avg5) * 100
    sig_w = -np.sign(dev - dev.shift(4))            # deficit widening = bullish
    sig = pd.Series(np.nan, index=close.index)
    for t, v in sig_w.dropna().items():
        loc = close.index.searchsorted(pubs[t].normalize())
        if loc < len(sig):
            sig.iloc[loc] = v
    sig = sig.ffill().fillna(0)
    sub = r[["natgas"]]
    return Spec("gasstor", "Gas storage against five-year norm", "Fundamentals", "Weekly: long natural gas when storage is falling further below (or rising less above) its five-year average over four weeks, short when the surplus grows.",
                vol_scale(sig.to_frame("natgas"), sub), sub, _costs(["natgas"]), freq="weekly")


# 7. Seasonality (Sørensen 2002)
def seasonality(close, r, years=10, min_years=5):
    m = (1 + r).groupby(r.index.to_period("M")).prod() - 1
    sig_m = pd.DataFrame(index=m.index, columns=m.columns, dtype=float)
    for i, p in enumerate(m.index):
        past = m[(m.index.month == p.month) & (m.index < p) & (m.index >= p - 12 * years)]
        ok = past.notna().sum() >= min_years
        mu, sd = past.mean(), past.std()
        t = mu / (sd / np.sqrt(past.notna().sum()))
        sig_m.loc[p] = np.where(ok & (t.abs() > 1.0), np.sign(mu), 0.0)
    sig = sig_m.reindex(r.index.to_period("M")).set_axis(r.index)
    return Spec("season", "Calendar-month seasonality", "Seasonal", "Each month, trade in the direction of that calendar month's average return over the previous ten years, only where it has been consistent (t > 1).",
                vol_scale(sig, r), r, _costs(close.columns), freq="monthly")


# 8. Processing-margin mean reversion: crack, crush, Brent-WTI
def spread_mr(close, entry=2.0, exit_=0.5, look=60):
    legs = {
        "crack321": (lambda c: (2 * c["gasoline"] * 42 + c["heatingoil"] * 42) / 3 - c["wti"], "wti", 3, ["wti", "gasoline", "heatingoil"]),
        "crush": (lambda c: c["soymeal"] * .022 + c["soyoil"] * .11 - c["soybeans"] / 100, "soybeans", 4, ["soymeal", "soyoil", "soybeans"]),
        "brent_wti": (lambda c: c["brent"] - c["wti"], "wti", 3, ["brent", "wti"]),
    }
    pos, rets, costs = {}, {}, {}
    for k, (f, base, legs_n, need) in legs.items():
        if not set(need) <= set(close.columns):
            continue
        sp = f(close).dropna()
        b = close[base].reindex(sp.index) / (100 if base == "soybeans" else 1)
        ret = sp.diff() / b.shift(1)
        sd = ret.rolling(120, min_periods=40).std().shift(1)
        ret = ret.mask(ret.abs() > 7 * sd, 0).clip(-.2, .2)
        z = (sp - sp.rolling(look).mean()) / sp.rolling(look).std()
        p = pd.Series(np.nan, index=sp.index)
        p[z > entry] = -1; p[z < -entry] = 1; p[z.abs() < exit_] = 0
        p = p.ffill().fillna(0)
        pos[k], rets[k], costs[k] = p, ret, K.COST_BPS.get(base, 3) * legs_n
    if not pos:
        return None
    P, R = pd.DataFrame(pos), pd.DataFrame(rets)
    vol = R.ewm(span=60, min_periods=40).std() * np.sqrt(252)
    P = (P * (TARGET_VOL / vol).clip(upper=3)).div(np.sqrt(P.shape[1]))
    return Spec("crackmr", "Margin mean reversion (crack, crush, Brent-WTI)", "Relative value", "Fade the 3-2-1 crack, the soybean crush and Brent less WTI when they sit more than two standard deviations from their 60-day mean; exit near the mean.",
                P, R, pd.Series(costs))


# 9. Carry / roll yield (Koijen et al. 2018) – needs CL1/CL2 history (Databento or Bloomberg)
CARRY_ROOTS = {"wti": "CL", "natgas": "NG", "gold": "GC"}


def carry(close, r):
    sig, rr = {}, {}
    for k, root in CARRY_ROOTS.items():
        a, b = store.bars(f"{root}.c.0", "1d"), store.bars(f"{root}.c.1", "1d")
        if len(a) < 500 or len(b) < 500:
            continue
        a, b = a["c"], b["c"]
        a.index, b.index = a.index.tz_localize(None).normalize() if a.index.tz else a.index.normalize(), b.index.tz_localize(None).normalize() if b.index.tz else b.index.normalize()
        roll = np.log(a / b) * 12
        sig[k] = np.sign(roll)
        rr[k] = r[k] if k in r else a.pct_change()
    if not sig:
        return None
    S = month_end_hold(pd.DataFrame(sig))
    R = pd.DataFrame(rr).reindex(S.index)
    return Spec("carry", "Carry (roll yield)", "Carry", "Long markets in backwardation (front above second month), short those in contango; monthly.",
                vol_scale(S, R), R, _costs(S.columns), freq="monthly")


def all_specs(close: pd.DataFrame):
    r, notes = clean_returns(close)
    out = []
    for f in (lambda: tsmom(close, r), lambda: xsmom(close, r), lambda: hedging_pressure(close, r), lambda: cot_reversal(close, r),
              lambda: eia_drift(close, r), lambda: eia_drift(close, r, "eia_gas", "natgas", key="eiagas", name="EIA gas storage surprise drift"),
              lambda: gas_storage(close, r), lambda: seasonality(close, r), lambda: spread_mr(close), lambda: carry(close, r)):
        try:
            s = f()
        except Exception as e:  # noqa: BLE001
            import logging, traceback
            logging.getLogger("opsilon").warning("strategy failed: %s\n%s", e, traceback.format_exc())
            s = None
        if s is not None:
            out.append(s)
    return out, notes
