"""Streamlit desk dashboard (local): EIA stocks against five years, cracks, curve, COT, weather, edge scorecard.

    pip install streamlit plotly
    python pipeline/run.py commodities trading      # fills the store and the JSON
    streamlit run tools/dashboard.py

The same views live on the site under Trading Part; this one reads the local
store directly, so it also shows Databento / Bloomberg data you have not pushed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from trading import store  # noqa: E402

DATA = ROOT / "site" / "data"
st.set_page_config(page_title="Opsilon desk", layout="wide")
st.title("Opsilon commodity desk")


def j(rel):
    p = DATA / rel
    return json.loads(p.read_text()) if p.exists() else {}


idx, fund = j("trading/index.json"), j("trading/fundamentals.json")
tab1, tab2, tab3, tab4, tab5 = st.tabs(["Edge", "EIA", "Cracks & curve", "COT", "Weather"])

with tab1:
    sc = pd.DataFrame(idx.get("score", []))
    if len(sc):
        st.dataframe(sc[["name", "family", "sharpe_oos", "sharpe_is", "t_nw", "p_perm", "dsr", "max_dd", "verdict"]], use_container_width=True, hide_index=True)
    for p in idx.get("pending", []):
        st.info(f"{p['name']}: {p['why']}")

with tab2:
    stocks = fund.get("stocks", {})
    if stocks:
        k = st.selectbox("Series", list(stocks), format_func=lambda x: stocks[x]["label"])
        h = stocks[k]["hist"]
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=h["d"], y=h["hi"], line=dict(width=0), showlegend=False))
        fig.add_trace(go.Scatter(x=h["d"], y=h["lo"], fill="tonexty", line=dict(width=0), name="5-year range"))
        fig.add_trace(go.Scatter(x=h["d"], y=h["avg"], line=dict(dash="dash"), name="5-year average"))
        fig.add_trace(go.Scatter(x=h["d"], y=h["v"], line=dict(width=3), name="This year"))
        st.plotly_chart(fig, use_container_width=True)

with tab3:
    cr = fund.get("cracks", {})
    if cr:
        fig = go.Figure([go.Scatter(x=v["d"], y=v["v"], name=k) for k, v in cr.items()])
        st.plotly_chart(fig, use_container_width=True)
    c = j("commodities/c/wti.json").get("curve", {})
    if c.get("now"):
        fig = go.Figure([go.Scatter(x=[p["lab"] for p in c[k]], y=[p["px"] for p in c[k]], name=k) for k in ("now", "m1", "m3") if c.get(k)])
        fig.update_layout(title=f"WTI curve: {c.get('shape')}")
        st.plotly_chart(fig, use_container_width=True)
    curve = {i: store.bars(f"CL.c.{i}", "1d") for i in range(6)}
    if all(len(v) for v in curve.values()):
        df = pd.DataFrame({f"CL{i + 1}": v["c"] for i, v in curve.items()}).dropna()
        st.line_chart(df["CL1"] - df["CL2"], height=200)
        st.caption("CL1 − CL2 (Databento / Bloomberg history): above zero = backwardation")

with tab4:
    st.dataframe(pd.DataFrame(fund.get("cot", [])), use_container_width=True, hide_index=True)

with tab5:
    w = fund.get("weather", {})
    if w.get("daily"):
        d = pd.DataFrame(w["daily"]).set_index("d")
        st.line_chart(d[["hdd", "norm"]])
        st.metric("HDD days 6-10", f"{w['hdd_6_10']:.0f}", f"{w['hdd_6_10'] - w['hdd_6_10_norm']:+.0f} vs normal")
