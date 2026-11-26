"""Trading Part: everything you may want to tune lives here.

Contract specs, Topstep combine rules, tier-1 news windows, costs and the
API keys the data layer looks for (read from environment variables, which are
GitHub secrets in Actions and a .env file on your Mac).
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# API keys (none is required: every source has a keyless fallback or is skipped)
# ---------------------------------------------------------------------------
KEYS = {
    "EIA_API_KEY": "EIA API v2, free: https://www.eia.gov/opendata/register.php. Without it the pipeline reads EIA's public XLS history files.",
    "NASS_API_KEY": "USDA NASS Quick Stats, free: https://quickstats.nass.usda.gov/api. Crop progress and condition. Without it, crop progress is skipped.",
    "FRED_API_KEY": "FRED, free: https://fred.stlouisfed.org/docs/api/api_key.html. Exact CPI / payrolls / GDP release dates for the no-trade windows.",
    "DATABENTO_API_KEY": "Databento, paid per request: https://databento.com. CME tick and minute history (GLBX.MDP3) and continuous CL1..CLn curves.",
    "TELEGRAM_BOT_TOKEN": "Telegram bot from @BotFather. Sends EIA, COT and tier-1 alerts.",
    "TELEGRAM_CHAT_ID": "Your channel or chat id for the alerts.",
}


def key(name: str) -> str | None:
    v = os.environ.get(name, "").strip()
    return v or None


# ---------------------------------------------------------------------------
# Contracts traded (micros first: that is what fits a $150-250 risk budget)
# key: (name, yahoo continuous, databento root, bloomberg generic root, tick size, $ per tick, round-turn cost $, group)
# ---------------------------------------------------------------------------
CONTRACTS = {
    "MCL": ("Micro WTI crude", "CL=F", "MCL", "CL", 0.01, 1.00, 1.04, "Energy"),
    "MNG": ("Micro Henry Hub gas", "NG=F", "MNG", "NG", 0.001, 1.00, 1.04, "Energy"),
    "MGC": ("Micro gold", "GC=F", "MGC", "GC", 0.10, 1.00, 1.04, "Metals"),
    "SIL": ("Micro silver (1,000 oz)", "SI=F", "SIL", "SI", 0.005, 5.00, 1.04, "Metals"),
    "MHG": ("Micro copper", "HG=F", "MHG", "HG", 0.0005, 1.25, 1.04, "Metals"),
    "CL": ("WTI crude", "CL=F", "CL", "CL", 0.01, 10.00, 4.40, "Energy"),
    "NG": ("Henry Hub gas", "NG=F", "NG", "NG", 0.001, 10.00, 4.40, "Energy"),
    "GC": ("Gold", "GC=F", "GC", "GC", 0.10, 10.00, 4.40, "Metals"),
}
SLIPPAGE_TICKS = 1          # per side, on top of the round-turn cost, for market/stop orders

# Daily-strategy universe (continuous front futures on Yahoo, keys from commodities_config)
DAILY_UNIVERSE = ["wti", "brent", "natgas", "gasoline", "heatingoil", "gold", "silver", "copper", "platinum",
                  "corn", "wheat", "soybeans", "soymeal", "soyoil", "coffee", "cocoa", "sugar", "cotton", "cattle", "hogs"]
# One-way cost per unit of turnover, in basis points of notional (1 tick + fees, rounded up)
COST_BPS = {"wti": 3, "brent": 3, "natgas": 6, "gasoline": 4, "heatingoil": 4, "gold": 1.5, "silver": 3, "copper": 2.5,
            "platinum": 4, "corn": 3, "wheat": 3, "soybeans": 2, "soymeal": 3, "soyoil": 3, "coffee": 4, "cocoa": 5,
            "sugar": 4, "cotton": 4, "cattle": 2, "hogs": 4}

# ---------------------------------------------------------------------------
# Topstep combine ($50K). Check topstep.com before trusting: the rules change.
# ---------------------------------------------------------------------------
TOPSTEP = {
    "start_balance": 50_000,
    "profit_target": 3_000,
    "max_loss_trailing": 2_000,     # trails the highest end-of-day balance, locks at the start balance
    "daily_loss_limit": 1_000,      # set to None if your account has no daily limit
    "consistency": 0.55,            # best day must stay below this share of total profit
    "max_contracts": {"MCL": 50, "MNG": 50, "MGC": 50, "SIL": 50, "MHG": 50, "CL": 5, "NG": 5, "GC": 5},
    "flat_by": "15:10",             # Central Time
    "min_days": 2,
}

# Risk per trade, dollars (the sizing calculator aims for the middle)
RISK_MIN, RISK_MAX = 150, 250

# ---------------------------------------------------------------------------
# Intraday sessions, Central Time (CME Globex)
# ---------------------------------------------------------------------------
SESSION = {
    "MCL": {"open": "08:00", "settle": "13:30"},   # NYMEX crude settlement 13:28-13:30 CT
    "MNG": {"open": "08:00", "settle": "13:30"},
    "MGC": {"open": "07:20", "settle": "12:30"},
    "SIL": {"open": "07:25", "settle": "12:25"},
    "MHG": {"open": "07:10", "settle": "12:00"},
    "CL": {"open": "08:00", "settle": "13:30"}, "NG": {"open": "08:00", "settle": "13:30"}, "GC": {"open": "07:20", "settle": "12:30"},
}

# ---------------------------------------------------------------------------
# Tier-1 news: no new trades from `before` minutes ahead to `after` minutes after
# ---------------------------------------------------------------------------
BLACKOUT = {"before": 5, "after": 15}
# FOMC statement days (14:00 ET). Fed calendar for 2026-2027.
FOMC = ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
        "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-16", "2027-07-28", "2027-09-22", "2027-11-03", "2027-12-15"]
# FRED release ids for exact dates (8:30 ET): CPI, Employment Situation, GDP, PPI, retail sales
FRED_RELEASES = {10: ("CPI", "08:30"), 50: ("Payrolls (NFP)", "08:30"), 53: ("GDP", "08:30"), 46: ("PPI", "08:30"), 9: ("Retail sales", "08:30")}
# OPEC+ ministerial meetings are announced late: add dates here by hand
OPEC = []

# Literature behind each daily strategy (shown on the site; cross-check against your own papers)
PAPERS = {
    "tsmom": ["Moskowitz, Ooi & Pedersen (2012), Time series momentum, Journal of Financial Economics"],
    "xsmom": ["Miffre & Rallis (2007), Momentum strategies in commodity futures markets, Journal of Banking & Finance"],
    "carry": ["Koijen, Moskowitz, Pedersen & Vrugt (2018), Carry, Journal of Financial Economics",
              "Szymanowska, de Roon, Nijman & van den Goorbergh (2014), An anatomy of commodity futures risk premia, Journal of Finance",
              "Gorton, Hayashi & Rouwenhorst (2013), The fundamentals of commodity futures returns, Review of Finance"],
    "hp": ["Basu & Miffre (2013), Capturing the risk premium of commodity futures: the role of hedging pressure, Journal of Banking & Finance"],
    "cotrev": ["Kang, Rouwenhorst & Tang (2020), A tale of two premiums: the role of hedgers and speculators in commodity futures markets, Journal of Finance"],
    "eia": ["Halova, Kurov & Kucher (2014), Noisy inventory announcements and energy prices, Journal of Futures Markets"],
    "gasstor": ["Gorton, Hayashi & Rouwenhorst (2013): inventory levels against normal predict returns and the basis"],
    "season": ["Sørensen (2002), Modeling seasonality in agricultural commodity futures, Journal of Futures Markets"],
    "crackmr": ["Spread mean reversion on processing margins (crack, crush): refining and crushing capacity pulls margins back"],
    "imom": ["Gao, Han, Li & Zhou (2018), Market intraday momentum, Journal of Financial Economics (tested here on crude and gold)"],
}

# How many variants are tested in total: feeds the deflated Sharpe ratio (multiple-testing haircut)
