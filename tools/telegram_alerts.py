"""Telegram alerts for the commodity desk.

Run every 15 minutes on weekdays (GitHub Actions: .github/workflows/alerts.yml).
Each run looks at the time in New York and sends what is due, once:

  - 30 minutes before every tier-1 release: the no-trade window
  - EIA petroleum (Wednesday, after 10:30 ET): crude, Cushing, gasoline, distillate against the
    seasonal norm, with the surprise in standard deviations
  - EIA gas storage (Thursday, after 10:30 ET): injection or withdrawal against the five-year norm
  - COT (Friday, after 15:30 ET): the biggest managed-money moves of the week

Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (and EIA_API_KEY if you have one).
Test without sending:  DRY_RUN=1 python tools/telegram_alerts.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

from trading import sources, store, strategies  # noqa: E402

ET = ZoneInfo("America/New_York")
STATE = ROOT / "data" / "cache" / "alerts_state.json"
NAMES = {"wti": "WTI", "brent": "Brent", "natgas": "Gas", "gasoline": "RBOB", "heatingoil": "ULSD", "gold": "Gold", "silver": "Silver",
         "copper": "Copper", "corn": "Corn", "wheat": "Wheat", "soybeans": "Soybeans", "coffee": "Coffee", "cocoa": "Cocoa", "sugar": "Sugar"}


def send(text: str):
    if os.environ.get("DRY_RUN") == "1":
        print("---\n" + text)
        return True
    tok, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not tok or not chat:
        print("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set")
        return False
    data = urllib.parse.urlencode({"chat_id": chat, "text": text, "parse_mode": "HTML", "disable_web_page_preview": "true"}).encode()
    with urllib.request.urlopen(f"https://api.telegram.org/bot{tok}/sendMessage", data=data, timeout=20) as r:
        return r.status == 200


def _state():
    try:
        return json.loads(STATE.read_text())
    except Exception:  # noqa: BLE001
        return {}


def _surprise_line(series, label, unit):
    df = store.frame(series)
    if len(df) < 120:
        return None, None
    s = strategies._seasonal_surprise(df)
    last = df.iloc[-1]
    chg = df["value"].iloc[-1] - df["value"].iloc[-2]
    z = s["z"].iloc[-1] if len(s) else float("nan")
    exp = chg - s["sur"].iloc[-1] if len(s) else float("nan")
    return f"{label}: {chg:+.1f} {unit} (seasonal norm {exp:+.1f}, surprise {z:+.1f}σ)", last["period"].date()


def eia_message():
    sources.fetch_eia()
    lines, wk = [], None
    for k, lab, u in [("eia_crude", "Crude", "mb"), ("eia_cushing", "Cushing", "mb"), ("eia_gasoline", "Gasoline", "mb"), ("eia_distillate", "Distillate", "mb")]:
        l, w = _surprise_line(k, lab, u)
        if l:
            lines.append(l); wk = wk or w
    if not lines:
        return None, None
    return wk, f"<b>EIA petroleum</b>, week to {wk}\n" + "\n".join(lines) + "\nBuild above norm = bearish, draw = bullish."


def gas_message():
    sources.fetch_eia()
    l, wk = _surprise_line("eia_gas", "Storage change", "bcf")
    if not l:
        return None, None
    df = store.frame("eia_gas")
    return wk, f"<b>EIA gas storage</b>, week to {wk}\n{l}\nLevel {df['value'].iloc[-1]:,.0f} bcf"


def cot_message():
    sources.fetch_cot(years=2)
    moves = []
    for k, n in NAMES.items():
        df = store.frame(f"cot_mm_pct_{k}")
        if len(df) > 2:
            moves.append((df["value"].iloc[-1] - df["value"].iloc[-2], n, df["value"].iloc[-1], df["period"].iloc[-1].date()))
    if not moves:
        return None, None
    moves.sort(key=lambda x: -abs(x[0]))
    wk = moves[0][3]
    return wk, f"<b>COT</b>, positions on {wk}\nManaged money, net % of open interest:\n" + "\n".join(f"{n}: {v:+.1f} pt → {lvl:.1f}%" for v, n, lvl, _ in moves[:6])


def main():
    now = datetime.now(ET)
    st = _state()
    sent = set(st.get("sent", []))
    out = []
    if now.weekday() < 5:
        sources.build_calendar(weeks_back=0, weeks_ahead=1)
        today = store.events(now.date().isoformat(), now.date().isoformat())
        for _, e in today[today.tier == 1].iterrows():
            t = datetime.fromisoformat(f"{e.day} {e.time_et}").replace(tzinfo=ET)
            key = f"pre:{e.day}:{e['name']}"
            if timedelta(0) <= t - now <= timedelta(minutes=30) and key not in sent:
                a, b = (t - timedelta(minutes=5)).strftime("%H:%M"), (t + timedelta(minutes=15)).strftime("%H:%M")
                out.append((key, f"⏸ <b>{e['name']}</b> at {e.time_et} ET. No new trade {a}–{b} ET."))
        hm = now.hour * 60 + now.minute
        jobs = [(2, 10 * 60 + 33, "eia", eia_message), (3, 10 * 60 + 33, "gas", gas_message), (4, 15 * 60 + 33, "cot", cot_message),
                (0, 15 * 60 + 33, "cot", cot_message)]          # COT moves to Monday after a holiday week
        for wd, after, tag, fn in jobs:
            if now.weekday() == wd and after <= hm <= after + 120:
                wk, msg = fn()
                key = f"{tag}:{wk}"
                if msg and wk and key not in sent and (now.date() - wk).days <= 7:
                    out.append((key, msg))
    for key, msg in out:
        if send(msg):
            sent.add(key)
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({"sent": sorted(sent)[-300:], "last_run": now.isoformat()}))
    print(f"{len(out)} alert(s)")


if __name__ == "__main__":
    main()
