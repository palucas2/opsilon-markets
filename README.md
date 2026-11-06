# Opsilon Markets

Plateforme de recherche sur les marchés, inspirée d'andramarkets.com : dashboards, calendrier, marchés mondiaux, FX, 600 sociétés, outils quant, simulateurs, note de clôture quotidienne, banques centrales, indicateurs de récession et histoire du S&P 500 depuis 1928.

Le site est **statique** (HTML + JS, hébergé gratuitement sur GitHub Pages). Les **données** sont récupérées chaque soir par un pipeline Python (Yahoo Finance, FRED, Banque mondiale) lancé par GitHub Actions, qui reconstruit et redéploie le site.

## Comment ça tourne

```
22:30 UTC, du lundi au vendredi (GitHub Actions)
  └─ pipeline/run.py        récupère et calcule → site/data/*.json
  └─ build_site.py          assemble les ~690 pages → dist/
  └─ deploy                 publie dist/ sur GitHub Pages
```

- Chaque étape du pipeline est isolée : si une source tombe, l'étape échoue seule et les chiffres de la veille restent en ligne (ils sont gardés dans le cache d'Actions).
- Les **fondamentaux** des 600 sociétés (comptes, analystes, news, dates de résultats) sont lents à récupérer : ils sont rafraîchis par lots tournants de 120 sociétés par soir. Au tout premier lancement, les 600 sont récupérées d'un coup.
- Les **notes** (note de clôture, graphique du jour, analyse FX, revue hebdo) sont archivées dans `data/archive/` et commitées dans le repo par le bot : elles s'accumulent jour après jour.
- L'état de la dernière mise à jour est visible sur la page **Data sources** du site.

## Lancer à la main

- **Depuis GitHub** : onglet *Actions* → *Update data and deploy* → *Run workflow* (on peut y choisir le nombre de sociétés à rafraîchir).
- **En local** :

```bash
pip install -r requirements.txt
python pipeline/run.py            # tout (≈ 20–40 min la première fois, à cause des 600 sociétés)
python pipeline/run.py fx world   # seulement certaines étapes
python build_site.py
cd dist && python -m http.server 8000   # puis http://localhost:8000
```

`OPSILON_MOCK=1 python pipeline/run.py` génère des données factices (mêmes formats) pour travailler sur le design sans réseau.

## Réglages

| Quoi | Où |
|---|---|
| Tickers, indices, devises, séries FRED, liste des 600 sociétés | `pipeline/config.py` |
| Taux et dates de réunion BoE / BoJ (à mettre à jour après chaque décision) | `pipeline/config.py` → `CENTRAL_BANKS` |
| Publications macro US dans le calendrier | secret GitHub `FRED_API_KEY` (clé gratuite sur fred.stlouisfed.org) |
| Fondamentaux rafraîchis par soir | variable `FUND_BATCH` (défaut 120) |
| Tes propres PDF dans la Research Library | dépose-les dans `site/research-files/` et liste-les dans `site/research-files/index.json` |

Format d'une entrée de `site/research-files/index.json` :

```json
[{"file_name": "ma-these-nvda.pdf", "title": "Nvidia : la thèse", "date": "2026-11-10",
  "kind": "Research", "topics": ["Equities"], "summary": "Une phrase de résumé."}]
```

## Structure

```
pipeline/            récupération et calculs (Python)
  config.py          tout ce qu'on récupère
  sources.py         Yahoo Finance, FRED, Banque mondiale (+ mode mock)
  build_*.py         un module par partie du site
  run.py             orchestration
site/assets/         design system (site.css) et JS par section
  js/core.js         menu, graphiques, utilitaires
  js/markets.js      accueil, dashboards, calendrier, World, FX, sociétés
  js/tools.js        Lab (10 calculateurs) et simulateurs
  js/research.js     notes, bibliothèque, graphique du jour, banques centrales, récession, histoire
build_site.py        génère une page par route dans dist/
.github/workflows/   mise à jour quotidienne et déploiement
```

Pour information uniquement. Pas un conseil en investissement.
