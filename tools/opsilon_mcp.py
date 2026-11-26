"""MCP server: gives Claude (desktop app, Claude Code) direct access to the
Trading Part: the point-in-time store, the edge scorecard, the intraday
results, the sizing rule, the no-trade calendar and the journal.

    pip install mcp pandas numpy
    python tools/opsilon_mcp.py            # stdio server

Claude desktop: Settings → Developer → Edit config, then add

    "mcpServers": {
      "opsilon": {
        "command": "python3",
        "args": ["/Users/<you>/opsilon-markets/tools/opsilon_mcp.py"]
      }
    }

Run `python pipeline/run.py trading` once first so the store and the JSON exist.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

try:                                    # mcp 2.x
    from mcp.server.mcpserver import MCPServer as FastMCP  # noqa: E402
except ImportError:                     # mcp 1.x
    from mcp.server.fastmcp import FastMCP  # noqa: E402

from trading import config as K  # noqa: E402
from trading import store  # noqa: E402

DATA = ROOT / "site" / "data" / "trading"
mcp = FastMCP("opsilon-trading")


def _j(name):
    p = DATA / name
    return json.loads(p.read_text()) if p.exists() else {}


@mcp.tool()
def edge_scorecard() -> list[dict]:
    """Every daily commodity strategy tested, with out-of-sample Sharpe, Newey-West t, timing p-value, deflated Sharpe and verdict."""
    keep = ("key", "name", "family", "sharpe_oos", "sharpe_is", "t_nw", "p_perm", "dsr", "max_dd", "verdict", "papers")
    return [{k: r.get(k) for k in keep} for r in _j("index.json").get("score", [])]


@mcp.tool()
def intraday_results(symbol: str = "") -> dict:
    """Intraday setups per contract: trades, average R, placebo p-value, Topstep pass rate. Symbol e.g. 'CL=F' or 'CL.c.0'; empty = all."""
    s = _j("intraday.json").get("symbols", {})
    pick = {k: v for k, v in s.items() if not symbol or k == symbol}
    return {k: {"micro": v["micro"], "from": v["from"], "to": v["to"],
                "setups": {n: {f: x.get(f) for f in ("n", "win", "avg_r", "pnl", "p_placebo", "verdict")} | {"pass_rate": (x.get("topstep") or {}).get("pass")}
                           for n, x in v["setups"].items()}} for k, v in pick.items()}


@mcp.tool()
def list_series() -> list[dict]:
    """What the point-in-time store holds: EIA, COT, USDA, weather series and price bars."""
    return store.inventory()


@mcp.tool()
def get_series(name: str, start: str = "2020-01-01") -> list[dict]:
    """History of one fundamental series (e.g. eia_crude, eia_gas, cot_mm_pct_wti, usda_corn_ge) with period and publication time."""
    df = store.frame(name)
    df = df[df.period >= start]
    return [{"period": p.strftime("%Y-%m-%d"), "published": q.strftime("%Y-%m-%d %H:%M"), "value": v} for p, q, v in df.itertuples(index=False)]


@mcp.tool()
def value_as_of(name: str, when: str) -> float | None:
    """The latest value of a series that had been published at `when` (ET, 'YYYY-MM-DD HH:MM'). No look-ahead."""
    return store.asof(name, when)


@mcp.tool()
def no_trade_windows(start: str, end: str) -> list[dict]:
    """Tier-1 and tier-2 releases between two dates (ET): EIA, COT, WASDE, FOMC, CPI, payrolls."""
    return store.events(start, end).to_dict("records")


@mcp.tool()
def size_position(contract: str, stop_ticks: float, risk_min: float = K.RISK_MIN, risk_max: float = K.RISK_MAX) -> dict:
    """Number of contracts for a stop in ticks, keeping risk between risk_min and risk_max dollars (slippage and fees included)."""
    name, _, _, _, tick, tv, cost, _ = K.CONTRACTS[contract.upper()]
    from trading.intraday import size_for
    r1 = (stop_ticks + 1) * tv + cost
    q = size_for(r1, risk_min, risk_max)
    if q == 0:
        return {"contracts": 0, "risk_per_contract": r1, "note": "one contract is above the maximum risk"}
    q = min(q, K.TOPSTEP["max_contracts"].get(contract.upper(), q))
    return {"contract": name, "contracts": q, "risk": round(q * r1, 2), "risk_per_contract": round(r1, 2)}


@mcp.tool()
def journal_add(opened: str, symbol: str, side: str, qty: int, entry: float, exit: float, stop: float, setup: str, reason: str = "", lesson: str = "") -> dict:
    """Log a trade in the local journal (side 'long' or 'short'). P&L and R are computed from the contract specs."""
    _, _, _, _, tick, tv, cost, _ = K.CONTRACTS[symbol.upper()]
    sd = 1 if side.lower().startswith("l") else -1
    pnl = (exit - entry) * sd / tick * tv * qty - cost * qty
    risk = abs(entry - stop) / tick * tv * qty
    r = pnl / risk if risk else None
    with store.db() as con:
        con.execute("INSERT INTO journal (opened, closed, symbol, side, qty, entry, exit, stop, setup, reason, pnl, r, lesson) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (opened, opened, symbol.upper(), side, qty, entry, exit, stop, setup, reason, pnl, r, lesson))
    return {"pnl": round(pnl, 2), "r": None if r is None else round(r, 2)}


if __name__ == "__main__":
    mcp.run()
