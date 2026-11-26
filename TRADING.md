# Trading Part — commodity desk

The **Trading Part** tab of Opsilon Markets (`/trading/`) answers one question: *is there an edge, and can it pass a Topstep combine?*

| Page | What it shows |
|---|---|
| Overview | Edge scorecard of every daily strategy, intraday setups with their combine pass rate, no-trade windows, 6–10 day weather |
| Edge tests | One page per strategy: idea, papers, equity curve with the out-of-sample split, years, Sharpe by market |
| Intraday & Topstep | Backtest of every setup on micros, P&L by hour, 2,000 simulated combines, last trades |
| Fundamentals | EIA stocks vs 5-year range, crack spreads, COT changes, crop condition, gas-weighted HDD |
| Sizing | Stop in ticks → number of micros for $150–250 of risk |
| Journal | Setup / reason / result / lesson, stats by setup and by hour, CSV export (kept in the browser) |
| Data & stack | Last run per source, API keys set or not, what the point-in-time store holds, tools |

## How it runs

Every weekday at 22:30 UTC, GitHub Actions runs `pipeline/run.py`; the `trading` step:

1. **Fetches** into the point-in-time store `data/cache/trading.sqlite` (kept by the Actions cache):
   EIA weekly (API v2 with `EIA_API_KEY`, else EIA's public XLS history), CFTC COT disaggregated (futures only),
   USDA NASS crop progress (`NASS_API_KEY`), NOAA GFS 16-day forecast via Open-Meteo (HDD/CDD, corn-belt rain),
   tier-1 calendar (EIA, COT, WASDE, FOMC, CPI/NFP via `FRED_API_KEY`), Yahoo daily prices, Yahoo 5-minute bars
   (60 days, **appended every night so the history grows**), Databento (`DATABENTO_API_KEY`), and any file in `data/import/`.
2. **Tests** the daily strategies (`pipeline/trading/strategies.py`) with `pipeline/trading/edge.py`.
3. **Backtests** the intraday setups and runs the Topstep simulator (`pipeline/trading/intraday.py`).
4. Writes `site/data/trading/*.json`, which the tab reads.

### Point in time
Every figure is stored with `period` (what it is about) and `published` (when the market saw it):
EIA crude Wednesday 10:30 ET, EIA gas Thursday 10:30, COT Friday 15:30, crop progress Monday 16:00, shifted a business
day per federal holiday. Strategies read `store.known_daily(...)`: nothing enters a position before it was public.

### What "edge" means
Net of costs, a strategy is marked **Edge** only if all four hold:
- Sharpe > 0.3 on the last 40 % of the history (out of sample),
- Newey-West t-stat of the mean > 2,
- timing p < 0.05: the real positions beat 300 random circular time shifts of the same positions,
- deflated Sharpe > 0.90 (Bailey & López de Prado), counting every variant tried.

Two or three → **Weak**. Intraday setups: t > 2 on R per trade, placebo p < 0.05 (same entries, random direction),
average R > 0.1 and at least 30 trades.

### Strategies tested (and the papers)
| Key | Strategy | Source |
|---|---|---|
| tsmom | Time-series momentum, 12 m | Moskowitz, Ooi & Pedersen (2012) |
| xsmom | Cross-sectional momentum 12-1 | Miffre & Rallis (2007) |
| hp | Hedging pressure (COT) | Basu & Miffre (2013) |
| cotrev | Fund-flow reversal (COT) | Kang, Rouwenhorst & Tang (2020) |
| eia / eiagas | Inventory surprise drift | Halova, Kurov & Kucher (2014) |
| gasstor | Gas storage vs 5-year norm | Gorton, Hayashi & Rouwenhorst (2013) |
| season | Calendar-month seasonality | Sørensen (2002) |
| crackmr | Crack / crush / Brent-WTI mean reversion | processing-margin reversion |
| carry | Roll yield (needs CL2… history) | Koijen et al. (2018), Szymanowska et al. (2014) |

Intraday: opening-range breakout, EIA 10:30 ET breakout, intraday momentum into the settle (Gao, Han, Li & Zhou 2018), VWAP reversion.

To add your own paper's idea: write a function returning a `Spec` in `strategies.py`, add it to `all_specs`, add the reference to `config.PAPERS`.

## Keys (all optional) — GitHub → Settings → Secrets and variables → Actions

| Secret | Where | Unlocks |
|---|---|---|
| `EIA_API_KEY` | eia.gov/opendata/register.php (free) | EIA via the API instead of XLS |
| `NASS_API_KEY` | quickstats.nass.usda.gov/api (free) | Crop progress and condition |
| `FRED_API_KEY` | fred.stlouisfed.org (free) | Exact CPI / NFP / GDP dates |
| `DATABENTO_API_KEY` | databento.com (pay per request) | 2 years of CME minute bars, CL/NG/GC curves → carry test and serious intraday tests |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | @BotFather | Alerts |

Variable `DATABENTO_MAX_USD` (default 5) caps the Databento spend per run: the cost is checked before each request.

## Local tools (`tools/`)

```bash
pip install -r requirements.txt -r requirements-local.txt
cp .env.example .env            # fill in the keys, then: set -a; source .env; set +a
python pipeline/run.py commodities trading
```

| Tool | Command |
|---|---|
| Bloomberg → backtests | `python tools/bloomberg_export.py curve --root CL --depth 12` · `bars --ticker "CL1 Comdty" --days 140` · `ticks --ticker "CLF7 Comdty"` (on a terminal; writes `data/import/*.parquet`) |
| Ollama on your papers | `ollama pull nomic-embed-text && ollama pull qwen2.5:14b` then `python tools/ollama_papers.py index ~/commodity-papers`, `ask "…"`, `strategies` |
| MCP server for Claude | `python tools/opsilon_mcp.py` (config snippet in the file) |
| Telegram alerts | `.github/workflows/alerts.yml` every 15 min; test with `DRY_RUN=1 python tools/telegram_alerts.py` |
| Streamlit dashboard | `streamlit run tools/dashboard.py` |
| Journal | `python tools/journal.py add …` · `import journal.csv` · `stats` |

Ollama note: it does not retrain a model on PDFs. `ollama_papers.py` does retrieval (embeddings + the closest
passages in the prompt), which is what makes a local model answer *from your papers* with sources.

## Topstep rules
`pipeline/trading/config.py → TOPSTEP`: $50K, target $3,000, trailing max loss $2,000 on the end-of-day high
(locked at the start balance), daily loss limit $1,000, consistency 55 %, contract caps, flat by 15:10 CT.
**Check them against topstep.com before relying on the simulator: Topstep changes its rules.**

## Known limits
- Yahoo `=F` series are not roll-adjusted: returns beyond 7 rolling standard deviations are zeroed as roll gaps (logged on Data & stack). Databento or Bloomberg curves fix this.
- 60 days of Yahoo 5-minute bars give ~40 sessions: too few trades for an intraday verdict until the store has grown or Databento/Bloomberg data is added.
- No consensus forecasts for EIA: the surprise is measured against the seasonal norm of the past five years.
- The weather-revision edge (change in the 6–10 day HDD forecast) needs a forecast archive: the store records one value per day from now on.
