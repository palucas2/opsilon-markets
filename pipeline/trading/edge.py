"""Is there an edge? The statistics behind every verdict on the site.

For a daily return series r (net of costs) produced by a strategy:

  Sharpe, CAGR, max drawdown, hit rate, turnover
  Newey-West t-stat of the mean (autocorrelation-robust, 10 lags)
  Out-of-sample split: first 60 % in sample, last 40 % out of sample.
      A rule whose Sharpe collapses out of sample was fitted to noise.
  Permutation test: the positions are shifted in time by random circular
      offsets (keeps the exposure and autocorrelation, destroys the timing).
      p = share of shuffles that do as well as the real strategy. This is the
      most direct test of an *inefficiency*: does knowing the signal beat holding
      the same positions at random dates?
  Stationary block bootstrap p-value of the mean (Politis & Romano 1994).
  Deflated Sharpe ratio (Bailey & López de Prado 2014): the probability that the
      true Sharpe is above zero once you account for the number of variants tried,
      skewness and fat tails.

Verdict:
  Edge      OOS Sharpe > 0.3, NW t > 2, permutation p < 0.05, DSR > 0.90
  Weak      at least two of the four
  No edge   otherwise
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats as st

ANN = 252


def sharpe(r):
    r = pd.Series(r).dropna()
    sd = r.std()
    return float(r.mean() / sd * math.sqrt(ANN)) if sd and len(r) > 20 else float("nan")


def nw_tstat(r, lags=10):
    r = np.asarray(pd.Series(r).dropna(), dtype=float)
    n = len(r)
    if n < 30:
        return float("nan")
    e = r - r.mean()
    s = e @ e / n
    for l in range(1, lags + 1):
        w = 1 - l / (lags + 1)
        s += 2 * w * (e[l:] @ e[:-l]) / n
    se = math.sqrt(max(s, 1e-18) / n)
    return float(r.mean() / se)


def max_dd(r):
    eq = (1 + pd.Series(r).fillna(0)).cumprod()
    return float((eq / eq.cummax() - 1).min())


def block_bootstrap_p(r, n=1000, block=20, seed=7):
    r = np.asarray(pd.Series(r).dropna(), dtype=float)
    if len(r) < 60:
        return float("nan")
    rng = np.random.default_rng(seed)
    x = r - r.mean()          # under the null the mean is zero
    T, obs = len(x), r.mean()
    cnt = 0
    nb = int(T / block * 3) + 10
    for _ in range(n):
        lens = rng.geometric(1 / block, nb)
        starts = rng.integers(0, T, nb)
        cum = np.cumsum(lens)
        k = int(np.searchsorted(cum, T)) + 1
        lens, starts = lens[:k], starts[:k]
        offs = np.arange(cum[k - 1]) - np.repeat(cum[:k] - lens, lens)
        idx = (np.repeat(starts, lens) + offs)[:T] % T
        cnt += x[idx].mean() >= obs
    return float((cnt + 1) / (n + 1))


def permutation_p(pos: pd.DataFrame | pd.Series, rets: pd.DataFrame | pd.Series, cost_fn, n=500, seed=11, min_shift=60):
    """Circular time shifts of the whole position matrix against the returns."""
    pos = pos.to_frame() if isinstance(pos, pd.Series) else pos
    rets = rets.to_frame() if isinstance(rets, pd.Series) else rets
    P, R = pos.fillna(0).values, rets.reindex(pos.index).fillna(0).values
    T = len(P)
    if T < 2 * min_shift + 50:
        return float("nan")
    real = sharpe(_pnl(P, R, cost_fn))
    rng = np.random.default_rng(seed)
    cnt = 0
    for _ in range(n):
        k = int(rng.integers(min_shift, T - min_shift))
        cnt += sharpe(_pnl(np.roll(P, k, axis=0), R, cost_fn)) >= real
    return float((cnt + 1) / (n + 1))


def _pnl(P, R, cost_fn):
    gross = (P[:-1] * R[1:]).sum(axis=1)
    turn = np.abs(np.diff(P, axis=0))
    return gross - cost_fn(turn)


def deflated_sharpe(r, n_trials, sr_var_trials=None):
    """Probability that the true (non-annualised) Sharpe exceeds the best you would expect from n_trials of noise."""
    r = pd.Series(r).dropna()
    T = len(r)
    if T < 60 or r.std() == 0:
        return float("nan")
    sr = r.mean() / r.std()
    g3, g4 = st.skew(r), st.kurtosis(r, fisher=False)
    v = sr_var_trials if sr_var_trials else 1 / T
    em = 0.5772156649
    N = max(int(n_trials), 2)
    sr0 = math.sqrt(v) * ((1 - em) * st.norm.ppf(1 - 1 / N) + em * st.norm.ppf(1 - 1 / (N * math.e)))
    den = math.sqrt(max(1e-12, 1 - g3 * sr + (g4 - 1) / 4 * sr ** 2))
    return float(st.norm.cdf((sr - sr0) * math.sqrt(T - 1) / den))


def evaluate(net: pd.Series, *, pos=None, rets=None, cost_fn=None, n_trials=50, split=0.6, perm=True):
    """All the statistics for one strategy's daily net returns."""
    net = net.dropna()
    net = net[net.index >= net.ne(0).idxmax()] if net.ne(0).any() else net
    if len(net) < 120:
        return {"n": len(net), "verdict": "Not enough data"}
    cut = net.index[int(len(net) * split)]
    ins, oos = net[net.index < cut], net[net.index >= cut]
    res = {
        "n": len(net), "start": net.index[0].strftime("%Y-%m-%d"), "end": net.index[-1].strftime("%Y-%m-%d"), "split": cut.strftime("%Y-%m-%d"),
        "sharpe": sharpe(net), "sharpe_is": sharpe(ins), "sharpe_oos": sharpe(oos),
        "ann_ret": float(net.mean() * ANN * 100), "ann_vol": float(net.std() * math.sqrt(ANN) * 100),
        "max_dd": max_dd(net) * 100, "hit": float((net[net != 0] > 0).mean() * 100) if (net != 0).any() else None,
        "t_nw": nw_tstat(net), "p_boot": block_bootstrap_p(net, n=400),
        "dsr": deflated_sharpe(net, n_trials),
        "skew": float(st.skew(net)), "days_active": float((net != 0).mean() * 100),
    }
    res["p_perm"] = permutation_p(pos, rets, cost_fn, n=300) if (perm and pos is not None and rets is not None and cost_fn) else None
    res["verdict"] = verdict(res)
    eq = (1 + net).cumprod()
    w = eq.resample("W-FRI").last().dropna()
    res["eq"] = {"d": [d.strftime("%Y-%m-%d") for d in w.index], "v": [round(float(x), 4) for x in w.values]}
    yr = net.groupby(net.index.year).apply(lambda x: (1 + x).prod() - 1) * 100
    res["years"] = {str(k): round(float(v), 1) for k, v in yr.items()}
    return res


def verdict(s):
    ok = [
        _gt(s.get("sharpe_oos"), .3),
        _gt(s.get("t_nw"), 2),
        s.get("p_perm") is not None and not math.isnan(s["p_perm"]) and s["p_perm"] < .05,
        _gt(s.get("dsr"), .90),
    ]
    if all(ok):
        return "Edge"
    if sum(ok) >= 2:
        return "Weak"
    return "No edge"


def _gt(x, t):
    return x is not None and not (isinstance(x, float) and math.isnan(x)) and x > t
