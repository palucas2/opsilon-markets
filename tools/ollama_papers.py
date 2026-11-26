"""Your commodity papers → a local model that answers from them (Ollama, on your Mac).

Ollama does not retrain a model on PDFs. What works, and what this script
does, is retrieval: every paper is cut into passages, each passage is turned
into a vector by an embedding model, and a question pulls the closest
passages into the prompt of a chat model. The answers then cite your papers.

    ollama pull nomic-embed-text
    ollama pull qwen2.5:14b          # or llama3.1:8b on a smaller Mac
    pip install pypdf numpy requests

    python tools/ollama_papers.py index ~/commodity-papers
    python tools/ollama_papers.py ask "Does the basis predict returns in energy futures?"
    python tools/ollama_papers.py strategies          # one JSON card per paper → data/papers/strategies.json
    python tools/ollama_papers.py modelfile           # writes a Modelfile: `ollama create opsilon-commodities -f Modelfile`

The strategies file lists, for each paper, the signal, the markets, the
holding period, the data needed and the result the authors report. Compare it
with pipeline/trading/config.py (PAPERS) to see which ideas are not tested yet.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import requests

HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
EMBED = os.environ.get("OLLAMA_EMBED", "nomic-embed-text")
CHAT = os.environ.get("OLLAMA_MODEL", "qwen2.5:14b")
DIR = Path(__file__).resolve().parent.parent / "data" / "papers"
IDX = DIR / "index.npz"
META = DIR / "chunks.json"


def pdf_text(p: Path) -> str:
    from pypdf import PdfReader
    try:
        return "\n".join((pg.extract_text() or "") for pg in PdfReader(str(p)).pages)
    except Exception as e:  # noqa: BLE001
        print(f"  skipped {p.name}: {e}")
        return ""


def chunks(text: str, size=1200, overlap=200):
    text = re.sub(r"\s+", " ", text)
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i + size])
        i += size - overlap
    return [c for c in out if len(c) > 200]


def embed(texts):
    vecs = []
    for t in texts:
        r = requests.post(f"{HOST}/api/embeddings", json={"model": EMBED, "prompt": t}, timeout=120)
        r.raise_for_status()
        vecs.append(r.json()["embedding"])
    v = np.array(vecs, dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def index(folder: str):
    folder = Path(folder).expanduser()
    files = sorted([*folder.rglob("*.pdf"), *folder.rglob("*.txt"), *folder.rglob("*.md")])
    if not files:
        raise SystemExit(f"No PDF, txt or md in {folder}")
    meta, texts = [], []
    for p in files:
        txt = pdf_text(p) if p.suffix == ".pdf" else p.read_text(errors="ignore")
        cs = chunks(txt)
        print(f"{p.name}: {len(cs)} passages")
        meta += [{"paper": p.name, "i": k, "text": c} for k, c in enumerate(cs)]
        texts += cs
    DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(IDX, v=embed(texts))
    META.write_text(json.dumps(meta))
    print(f"{len(meta)} passages from {len(files)} papers indexed → {IDX}")


def retrieve(q, k=8):
    v = np.load(IDX)["v"]
    meta = json.loads(META.read_text())
    s = v @ embed([q])[0]
    return [meta[i] | {"score": float(s[i])} for i in np.argsort(-s)[:k]]


def chat(prompt, fmt=None):
    body = {"model": CHAT, "prompt": prompt, "stream": False, "options": {"temperature": 0.1, "num_ctx": 16384}}
    if fmt:
        body["format"] = fmt
    r = requests.post(f"{HOST}/api/generate", json=body, timeout=600)
    r.raise_for_status()
    return r.json()["response"]


SYSTEM = ("You are the research assistant of Opsilon, a quantitative commodity desk. Answer only from the passages given, "
          "name the paper for each claim, and say plainly when the passages do not answer the question.")


def ask(q):
    ctx = retrieve(q)
    prompt = SYSTEM + "\n\n" + "\n\n".join(f"[{c['paper']}] {c['text']}" for c in ctx) + f"\n\nQuestion: {q}\nAnswer:"
    print(chat(prompt))
    print("\nSources: " + ", ".join(dict.fromkeys(c["paper"] for c in ctx)))


def strategies():
    meta = json.loads(META.read_text())
    papers = sorted(set(m["paper"] for m in meta))
    out = []
    for p in papers:
        text = " ".join(m["text"] for m in meta if m["paper"] == p)[:24000]
        prompt = (SYSTEM + "\n\nPaper: " + p + "\n" + text + "\n\nExtract every trading strategy this paper tests or proposes. Return JSON "
                  '{"paper": str, "strategies": [{"name": str, "signal": str, "markets": str, "rebalance": str, "holding": str, '
                  '"data_needed": [str], "reported_result": str, "testable_with": "daily prices|COT|EIA|USDA|weather|curve|intraday|other"}]}')
        try:
            card = json.loads(chat(prompt, fmt="json"))
        except Exception as e:  # noqa: BLE001
            card = {"paper": p, "error": str(e)}
        print(p, "→", len(card.get("strategies", [])), "strategies")
        out.append(card)
    (DIR / "strategies.json").write_text(json.dumps(out, indent=2))
    print(f"→ {DIR / 'strategies.json'}")


def modelfile():
    Path("Modelfile").write_text(f'FROM {CHAT}\nPARAMETER temperature 0.1\nPARAMETER num_ctx 16384\nSYSTEM """{SYSTEM}"""\n')
    print("Modelfile written. Then: ollama create opsilon-commodities -f Modelfile")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "index" and len(sys.argv) > 2:
        index(sys.argv[2])
    elif cmd == "ask" and len(sys.argv) > 2:
        ask(" ".join(sys.argv[2:]))
    elif cmd == "strategies":
        strategies()
    elif cmd == "modelfile":
        modelfile()
    else:
        print(__doc__)
