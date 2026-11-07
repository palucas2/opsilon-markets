"""Assemble le site statique dans dist/ : une page index.html par route,
les assets et les données JSON. À lancer après pipeline/run.py.
"""
from __future__ import annotations

import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
DIST = ROOT / "dist"
DATA = SITE / "data"
ASSET_V = None

LAYOUT = """<!DOCTYPE html>
<html lang="en" data-theme="dark" data-root="{root}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#000000">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23000'/%3E%3Cpath d='M17 6.5a6.5 6.5 0 1 0 0 11M5.5 12H14' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/site.css?v={v}">
<script>(function(){{var t='dark';try{{var s=localStorage.getItem('ops-theme');if(s==='light'||s==='dark')t=s;}}catch(e){{}}document.documentElement.dataset.theme=t;}})();</script>
</head>
<body data-page="{page}" data-section="{section}" data-param="{param}">
<a class="skip" href="#main">Skip to content</a>
<div class="page">
<main id="main" class="{main_cls}"></main>
</div>
<script src="{root}assets/js/{bundle}.js?v={v}"></script>
<script src="{root}assets/js/core.js?v={v}"></script>
</body>
</html>
"""

SECTION_BUNDLE = {"markets": "markets", "tools": "tools", "research": "research", "home": "markets", "info": "research"}


def page(path: str, title: str, page_key: str, section: str, desc: str = "", param: str = "", main_cls: str = "wrap grid12", bundle: str = ""):
    depth = len([p for p in path.strip("/").split("/") if p])
    root = "../" * depth if depth else "./"
    out = DIST / path / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    full = f"{title}: Opsilon Markets" if page_key != "home" else "Opsilon Markets: markets research platform"
    out.write_text(LAYOUT.format(root=root, title=html.escape(full), desc=html.escape(desc or title), page=page_key, section=section,
                                 param=html.escape(param), bundle=bundle or SECTION_BUNDLE[section], v=ASSET_V, main_cls=main_cls))


def load(rel, default=None):
    p = DATA / rel
    try:
        return json.loads(p.read_text())
    except Exception:  # noqa: BLE001
        return default


def main():
    global ASSET_V
    import hashlib, time
    ASSET_V = hashlib.md5(str(time.time()).encode()).hexdigest()[:8]
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    shutil.copytree(SITE / "assets", DIST / "assets")
    if DATA.exists():
        shutil.copytree(DATA, DIST / "data")
    if (SITE / "research-files").exists():
        shutil.copytree(SITE / "research-files", DIST / "research-files")
    (DIST / ".nojekyll").write_text("")

    # ---------------- Markets
    page("", "Opsilon Markets", "home", "home", "Markets, on the record.", main_cls="")
    page("dashboards", "Dashboards", "dashboards", "markets", "Interactive views across rates, equities, macro and cross-asset.")
    for d in ["sector-heatmap", "volatility-term-structure", "global-indices", "fx-majors", "commodities", "credit-spreads",
              "inflation-and-labour", "watchlist-breadth", "cross-asset-correlation"]:
        page(f"dashboards/{d}", d.replace("-", " ").capitalize(), "dashboard", "markets", param=d)
    page("calendar", "Calendar", "calendar", "markets", "Results, central banks and releases, five weeks ahead.")
    page("world", "World markets", "world", "markets", "Twenty-five markets on the same eight measures.")
    page("fx", "FX", "fx", "markets", "The dollar, the G10 majors and the main emerging-market currencies.")
    for n in load("fxnotes/index.json", []) or []:
        page(f"fx/{n['date']}", n["title"], "fxnote", "markets", param=n["date"])
    page("commodities", "Commodities", "commodities", "markets", "Futures curves, spreads, inventories, positioning, shipping, weather and seasonality.", bundle="commodities")
    for sid, t in [("term-structure", "Term structure"), ("spreads", "Spreads"), ("fundamentals", "Supply & demand"), ("logistics", "Logistics"),
                   ("positioning", "Positioning"), ("macro", "Dollar, China & news"), ("weather", "Weather"), ("seasonality", "Seasonality")]:
        page(f"commodities/{sid}", f"Commodities: {t}", "commsec", "markets", param=sid, bundle="commodities")
    for row in (load("commodities/index.json", {}) or {}).get("rows", []):
        page(f"commodities/{row['key']}", row["name"], "commodity", "markets", f"{row['name']} futures: price, curve, positioning and seasonality.", param=row["key"], bundle="commodities")
    page("companies", "Companies", "companies", "markets", "The 600 largest companies in the US, Europe and Asia.")
    for row in (load("companies/index.json", {}) or {}).get("rows", []):
        page(f"companies/{row['slug']}", f"{row['n']} ({row['t']})", "company", "markets", param=row["slug"])

    # ---------------- Tools
    page("lab", "Lab", "lab", "tools", "Interactive quant tools.")
    for c in ["options", "bonds", "risk-and-portfolio", "valuation-and-growth"]:
        page(f"lab/{c}", c.replace("-and-", " & ").replace("-", " ").capitalize(), "labcat", "tools", param=c)
    for t in ["options-payoff", "black-scholes", "bond-calculator", "yield-to-maturity", "risk-correlation", "efficient-frontier",
              "position-sizing", "dcf", "compound-growth", "real-return"]:
        page(f"lab/{t}", t.replace("-", " ").capitalize(), "tool", "tools", param=t)
    page("simulators", "Simulators", "simulators", "tools")
    page("simulators/market-replays", "Market replays", "simcat", "tools", param="market-replays")
    page("simulators/strategy-games", "Strategy games", "simcat", "tools", param="strategy-games")
    page("simulators/trading-simulator", "Trading Simulator", "trading", "tools", param="trading")
    page("simulators/panic-test", "Panic Test", "trading", "tools", param="panic")
    page("simulators/portfolio-builder", "Portfolio Builder", "portfolio", "tools")

    # ---------------- Research
    page("reports", "Daily close notes", "reports", "research")
    for n in load("notes/index.json", []) or []:
        page(f"reports/{n['date']}", n["title"], "note", "research", param=n["date"])
    page("research", "Research Library", "research", "research")
    for r in load("research/index.json", []) or []:
        page(f"research/{r['id']}", r["title"], "report", "research", param=r["id"])
    page("chart-of-the-day", "Chart of the day", "cotd", "research")
    for c in load("cotd/index.json", []) or []:
        page(f"chart-of-the-day/{c['date']}", f"Chart of the day, {c['human']}", "cotd", "research", param=c["date"])
    page("central-banks", "Central banks", "centralbanks", "research")
    page("recession-watch", "Recession watch", "recession", "research")
    page("market-history", "Market history", "history", "research")
    for e in (load("history/index.json", {}) or {}).get("episodes", []):
        page(f"market-history/{e['slug']}", e["title"], "episode", "research", param=e["slug"])
    page("sources", "Data sources", "sources", "info")
    page("methodology", "Methodology", "methodology", "info")
    (DIST / "404.html").write_text("""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not found: Opsilon Markets</title>
<script>var p=location.pathname.split('/').filter(Boolean);var base=location.hostname.endsWith('github.io')&&p.length?'/'+p[0]+'/':'/';</script>
<style>body{background:#000;color:#e9eceb;font-family:Helvetica,Arial,sans-serif;display:grid;place-items:center;height:100vh;margin:0}a{color:inherit}</style></head>
<body><div><h1 style="font-weight:500">Page not found</h1><p><a id="h" href="/">Back to Opsilon Markets</a></p></div><script>document.getElementById('h').href=base;</script></body></html>""")
    n = sum(1 for _ in DIST.rglob("index.html"))
    print(f"built {n} pages into {DIST}")


if __name__ == "__main__":
    main()
