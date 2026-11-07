/* Opsilon Markets – Research: daily notes, library, chart of the day, central banks, recession watch, market history, info pages */
window.PAGES = Object.assign(window.PAGES || {}, (function () {
const O = () => window.O;
const MONTHS_L = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function byMonth(items, url, extra = () => '') {
  const o = O(); if (!items.length) return o.fail('Nothing published yet. The first edition appears after the next US close.');
  const groups = {}; items.forEach(n => { const d = o.D(n.date); const k = `${MONTHS_L[d.getMonth()]} ${d.getFullYear()}`; (groups[k] = groups[k] || []).push(n); });
  return Object.entries(groups).map(([k, list]) => `<div class="month-h">${k}</div><div class="list" style="margin-top:0;border-top:0">${list.map(n => `<a href="${o.link(url(n))}"><span><span class="t">${o.esc(n.title)}</span>${extra(n)}</span><span class="m">${o.fmtDS(n.date)}</span></a>`).join('')}</div>`).join('');
}

/* ================================================================== DAILY NOTES */
async function reports() {
  const o = O(); const notes = await o.data('notes/index.json').catch(() => []);
  o.main().innerHTML = o.head({ title: 'Daily close notes', lede: `Every US trading day, after the close. ${notes.length} note${notes.length === 1 ? '' : 's'}. Weekly reviews are in the <a href="${o.link('research/')}" style="text-decoration:underline">Research Library</a>.`, meta: 'Generated from Yahoo Finance and FRED figures: every number is computed, every sentence follows from the numbers.' }) +
    `<div class="col-main rv">${notes[0] ? `<a class="box" style="display:block;margin-top:0" href="${o.link('reports/' + notes[0].date + '/')}"><span class="badge">Latest · Edition ${notes[0].edition}</span><h3 style="font-size:22px;letter-spacing:-.02em;margin-top:12px">${o.esc(notes[0].title)}</h3><p class="page-meta">${notes[0].human} · Read the note →</p></a>` : ''}${byMonth(notes, n => 'reports/' + n.date + '/')}</div>`;
}

async function note(date) {
  const o = O(); const m = o.main();
  const [n, idx] = await Promise.all([o.data(`notes/${date}.json`).catch(() => null), o.data('notes/index.json').catch(() => [])]);
  if (!n) { m.innerHTML = o.head({ title: 'Daily note' }) + o.fail(); return; }
  const i = idx.findIndex(x => x.date === date); const prev = idx[i + 1], next = idx[i - 1];
  const num = x => { if (x.k === 'Risk score') return `<div class="kpi__level">${o.sgn(x.v)}</div><div class="kpi__chg">${x.label}</div>`; if (x.k === 'Breadth') return `<div class="kpi__level">${x.v}</div><div class="kpi__chg">${x.label}</div>`; return `<div class="kpi__level">${o.num(x.v)}${x.suffix || ''}</div><div class="kpi__chg">${x.u === 'bp' ? `<span class="${o.cls(x.c)}">${o.sgn(x.c, 1)}bp</span>` : o.mv(x.c)}</div>`; };
  const movesBox = id => `<div class="chart-box" id="${id}"></div>`;
  m.innerHTML = o.head({ crumbs: [['reports/', 'Daily note'], [null, `Edition ${n.edition}`]], title: o.esc(n.title), lede: o.esc(n.lede), meta: `${n.day} ${n.human} · Edition ${n.edition}` }) +
    `<div class="col-main">
     <section class="sec rv"><h2>The session in numbers</h2><div class="kstrip kstrip--3">${n.numbers.map(x => `<div><span class="kpi__name">${x.k}</span>${num(x)}</div>`).join('')}</div><p class="src">Close and daily change, ${n.human}. Yahoo Finance, FRED; risk score and breadth by Opsilon Markets.</p></section>
     <section class="sec rv"><h2>Takeaways</h2><div class="prose"><ul>${n.takeaways.map(t => `<li>${o.esc(t)}</li>`).join('')}</ul></div>${n.big?.length ? `<h3 style="margin-top:24px">The most unusual moves</h3><div class="list">${n.big.map(b => `<div><span>${b.name}</span><span class="m">${b.unit === 'bp' ? `${o.sgn(b.chg, 1)}bp` : o.pct(b.chg)} · z ${o.sgn(b.z)}</span></div>`).join('')}</div>` : ''}</section>
     <section class="sec rv"><h2>Biggest gainers and losers</h2><p class="lede">Across the 26-name watchlist of US large caps.</p><div class="two" style="margin-top:16px"><div>${movesTable(n.gainers)}</div><div>${movesTable(n.losers)}</div></div></section>
     ${n.watch?.length ? `<section class="sec rv"><h2>What we watch</h2><div class="list">${n.watch.map(w => `<div><span>${o.esc(w.title)}<span class="d">${w.type}</span></span><span class="m">${o.fmtDS(w.date)}</span></div>`).join('')}</div></section>` : ''}
     <section class="sec rv"><h2>Equities</h2><h3 style="margin-top:14px">S&P 500 sectors</h3>${movesBox('sec-eq')}</section>
     <section class="sec rv"><h2>Rates</h2><h3 style="margin-top:14px">Treasury yield curve</h3><div class="chart-box" id="curve"></div><div class="legend"><span><i class="l"></i>Today</span><span><i class="ld"></i>Prior close</span></div>${n.curve?.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tenor</th>${n.curve.map(c => `<th>${c.tenor}</th>`).join('')}</tr></thead><tbody><tr><td>Yield</td>${n.curve.map(c => `<td>${o.num(c.y, 2)}%</td>`).join('')}</tr><tr><td>Change</td>${n.curve.map(c => `<td class="${o.cls(c.chg)}">${o.sgn(c.chg, 1)}bp</td>`).join('')}</tr></tbody></table></div>` : ''}</section>
     ${n.sections.map(s => `<section class="sec rv"><h2>${s.title}</h2><p class="lede">${o.esc(s.text)}</p>${movesBox('s-' + s.key)}</section>`).join('')}
     ${n.corr ? `<section class="sec rv"><h2>Correlation</h2><p class="lede">One month of daily returns.</p><div id="corr"></div></section>` : ''}
     <section class="sec rv"><h2>Sources</h2><p class="lede">Yahoo Finance closes for indices, ETFs, futures, currencies and digital assets; FRED for the 2-year Treasury yield. Generated automatically after the US close. For information only. Not investment advice.</p></section>
     <div style="display:flex;justify-content:space-between;margin-top:30px;gap:20px">${prev ? `<a class="btn btn--ghost btn--sm" href="${o.link('reports/' + prev.date + '/')}">← ${prev.human}</a>` : '<span></span>'}${next ? `<a class="btn btn--ghost btn--sm" href="${o.link('reports/' + next.date + '/')}">${next.human} →</a>` : ''}</div></div>
     <aside class="col-side rv"><h2 class="side-title">Edition ${n.edition}</h2><p class="side-src" style="font-size:13px">${n.day} ${n.human}</p><div class="list" style="margin-top:14px">${['Equities', 'Rates', ...n.sections.map(s => s.title)].filter((v, i, a) => a.indexOf(v) === i).map(t => `<div><span class="t">${t}</span></div>`).join('')}</div></aside>`;
  const draw = () => {
    if (n.sectors?.length) o.hbars(o.$('#sec-eq'), n.sectors.map(s => [s.name, s.chg]), { labelW: 150 });
    n.sections.forEach(s => { const el = o.$('#s-' + s.key); if (el) o.hbars(el, s.moves.map(m => [m.name, m.chg]), { labelW: 170, fmt: v => s.moves[0].unit === 'bp' ? o.sgn(v, 1) + 'bp' : o.pct(v) }); });
    if (n.curve?.length) o.lineChart(o.$('#curve'), { x: n.curve.map(c => c.tenor), series: [{ v: n.curve.map(c => c.prev), dash: true }, { v: n.curve.map(c => c.y), width: 2 }], h: 200, xfmt: x => x, xlabels: n.curve.map((_, i) => i), fmtY: t => t + '%' });
    if (n.corr) o.$('#corr').innerHTML = corrHtml(n.corr.names, n.corr.m);
  };
  draw(); o.onResize(draw);
}
function movesTable(list) { const o = O(); return `<div class="tbl-wrap" style="margin-top:0"><table class="tbl"><tbody>${(list || []).map(w => `<tr><td>${w.name}</td><td>${o.num(w.close)}</td><td>${o.mv(w.chg)}</td></tr>`).join('')}</tbody></table></div>`; }
function corrHtml(names, m) { const o = O(); const col = v => { const rgb = getComputedStyle(document.documentElement).getPropertyValue(v >= 0 ? '--heat-up' : '--heat-down').trim(); return `rgba(${rgb},${Math.abs(v || 0) * .8})`; }; return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${names.map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>${m.map((r, i) => `<tr><td>${names[i]}</td>${r.map((v, j) => `<td style="text-align:center;background:${i === j ? 'transparent' : col(v)}">${i === j ? '' : o.num(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }

/* ================================================================== RESEARCH LIBRARY */
async function research() {
  const o = O();
  const [auto, files] = await Promise.all([o.data('research/index.json').catch(() => []), fetch(o.link('research-files/index.json')).then(r => r.ok ? r.json() : []).catch(() => [])]);
  const items = [...files.map(f => ({ ...f, file: true })), ...auto].sort((a, b) => a.date < b.date ? 1 : -1);
  const topics = ['All', ...new Set(items.flatMap(i => i.topics || []))];
  o.main().innerHTML = o.head({ title: 'Research Library', lede: `Weekly market reviews and longer research: written to be kept. ${items.length} report${items.length === 1 ? '' : 's'}.`, meta: `Looking for the daily note? <a href="${o.link('reports/')}" style="text-decoration:underline">All close notes</a>` }) +
    `<div class="col-full rv"><div class="ctl__row" id="tp"></div><div class="cards" id="lib"></div><p class="src">Add your own research: drop a PDF into <code>site/research-files/</code> and list it in <code>site/research-files/index.json</code>.</p></div>`;
  const draw = t => { const list = items.filter(i => t === 'All' || (i.topics || []).includes(t)); o.$('#lib').innerHTML = list.map(i => `<a class="card" href="${i.file ? o.link('research-files/' + i.file_name) : o.link('research/' + i.id + '/')}" ${i.file ? 'target="_blank"' : ''}><span class="badge" style="align-self:flex-start">${i.kind || 'Research'}</span><h3>${o.esc(i.title)}</h3><p>${o.esc(i.summary || '')}</p><span class="meta">${i.human || o.fmtD(i.date)}${i.file ? ' · PDF' : ''}</span></a>`).join('') || o.fail('Nothing here yet. The first weekly review appears after the last session of the week.'); };
  o.chips(o.$('#tp'), topics.map(t => [t, `${t} <small>${t === 'All' ? items.length : items.filter(i => (i.topics || []).includes(t)).length}</small>`]), 'All', draw); draw('All');
}

async function report(id) {
  const o = O(); const r = await o.data(`research/${id}.json`).catch(() => null);
  if (!r) { o.main().innerHTML = o.head({ title: 'Report' }) + o.fail(); return; }
  const groups = {}; r.rows.forEach(x => (groups[x.group] = groups[x.group] || []).push(x));
  const L = { equities: 'US equities', international: 'International equities', rates: 'Treasury yields', credit: 'Credit', fx: 'Currencies', commodities: 'Commodities', volatility: 'Volatility', digital: 'Digital assets' };
  o.main().innerHTML = o.head({ crumbs: [['research/', 'Research Library'], [null, r.kind]], title: o.esc(r.title), lede: o.esc(r.summary), meta: r.human }) +
    `<div class="col-main">${Object.entries(groups).map(([g, rows]) => `<section class="sec rv"><h2>${L[g] || g}</h2><div class="chart-box" id="g-${g}"></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Asset</th><th>Close</th><th>Week</th></tr></thead><tbody>${rows.map(x => `<tr><td>${x.name}</td><td>${o.num(x.close)}</td><td class="${o.cls(x.chg)}">${o.sgn(x.chg)}${x.unit}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}<p class="disclaimer">Generated from Yahoo Finance closes. For information only. Not investment advice.</p></div>`;
  const draw = () => Object.entries(groups).forEach(([g, rows]) => o.hbars(o.$('#g-' + g), rows.map(x => [x.name, x.chg]).sort((a, b) => b[1] - a[1]), { labelW: 170, fmt: v => rows[0].unit === 'bp' ? o.sgn(v, 1) + 'bp' : o.pct(v) }));
  draw(); o.onResize(draw);
}

/* ================================================================== CHART OF THE DAY */
async function cotd(date) {
  const o = O(); const idx = await o.data('cotd/index.json').catch(() => []);
  const d = date || idx[0]?.date;
  const c = d ? await o.data(`cotd/${d}.json`).catch(() => null) : null;
  o.main().innerHTML = o.head({ crumbs: date ? [['chart-of-the-day/', 'Chart of the day'], [null, c?.human || date]] : null, title: 'Chart of the day', lede: 'One chart from each session’s close note, with two lines: what it shows, from its own figures, and why it was chosen.' }) +
    `<div class="col-main">${c ? `<section class="sec rv"><p class="page-meta" style="margin-top:0">${o.DAYS[o.D(c.date).getDay()]} ${c.human}</p><h2 style="font-size:28px">${c.title}</h2><div class="chart-box" id="ch"></div><p class="src">Yahoo Finance, change at the close, ${c.human}.</p><p class="lede" style="color:var(--ink)">${o.esc(c.what)}</p><p class="lede">${o.esc(c.why)}</p><p class="page-meta">From the close note: <a href="${o.link('reports/' + c.date + '/')}" style="text-decoration:underline">${o.esc(c.note)}</a></p></section>` : o.fail()}
     <section class="sec rv"><h2>Every chart</h2>${byMonth(idx, x => 'chart-of-the-day/' + x.date + '/', x => `<span class="d">${x.top || ''}</span>`)}</section>
     <section class="sec rv"><h2>How the chart is chosen</h2><p class="lede">Every move in the close note is compared with the average and spread of that asset’s daily moves over the past year. The chart of the day is the group holding the most unusual move, measured in standard deviations.</p></section></div>`;
  if (c) { const draw = () => o.hbars(o.$('#ch'), c.moves.map(m => [m.name, m.chg]), { labelW: 170, fmt: v => c.moves[0].unit === 'bp' ? o.sgn(v, 1) + 'bp' : o.pct(v) }); draw(); o.onResize(draw); }
}

/* ================================================================== CENTRAL BANKS */
async function centralbanks() {
  const o = O(); const d = await o.data('central-banks.json').catch(() => null);
  if (!d) { o.main().innerHTML = o.head({ title: 'Central banks' }) + o.fail(); return; }
  o.main().innerHTML = o.head({ title: 'Central banks', lede: 'The Fed, the ECB, the Bank of England and the Bank of Japan: each policy rate, its last move and the next decision, and the four rates since 2019.', meta: `Federal Reserve and ECB via FRED; Bank of England and Bank of Japan from their announcements. Updated ${d.updated}.` }) +
    `<div class="col-main"><section class="sec rv"><h2>Policy rates now</h2><p class="lede">Each bank’s policy rate, its last change and the day of its next decision.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bank</th><th>Policy rate</th><th>Last move</th><th>Next meeting</th></tr></thead><tbody>${d.banks.map(b => `<tr><td><b style="font-weight:600">${b.name}</b><small>${b.full}</small></td><td>${o.isNum(b.lower) ? `${o.num(b.lower)} to ${o.num(b.rate)}%` : o.num(b.rate) + '%'}<small>As of ${o.fmtD(b.asof)}</small></td><td>${b.last ? `<span class="${b.last.bp > 0 ? 'mv--down' : 'mv--up'}">${o.sgn(b.last.bp, 0)} bp</span><small>${o.fmtD(b.last.date)}</small>` : '–'}</td><td>${b.next ? `${o.fmtD(b.next)}<small>In ${b.days} day${b.days === 1 ? '' : 's'}</small>` : '–'}</td></tr>`).join('')}</tbody></table></div></section>
     <section class="sec rv"><h2>The four rates since 2019</h2><div class="ctl__row" id="cb" style="margin-top:14px"></div><div class="chart-box" id="ch"></div><div class="legend" id="lg"></div><p class="readout" id="rd"></p></section>
     <section class="sec rv"><h2>How to read it</h2><p class="lede">A policy rate is the price a central bank sets for overnight money. Raising it cools borrowing and spending; cutting it does the reverse. The gap between two banks’ rates is one of the main drivers of their currencies.</p></section>
     <section class="sec rv"><h2>Sources and method</h2><p class="lede">Fed: top and bottom of the federal funds target range (FRED: DFEDTARU, DFEDTARL). ECB: deposit facility rate (FRED: ECBDFR). Bank of England and Bank of Japan: the rate path recorded in the pipeline configuration, updated after each decision. Meeting dates: each bank’s published calendar.</p></section></div>
     <aside class="col-side rv"><h2 class="side-title">Next decisions</h2><ul class="kpi">${d.banks.map(b => `<li class="kpi__item"><span class="kpi__name">${b.name}</span><span class="kpi__level" style="font-size:16px">${b.next ? o.fmtDS(b.next) : '–'}</span><span class="kpi__chg">${b.next ? 'in ' + b.days + ' days' : ''}</span></li>`).join('')}</ul></aside>`;
  let sel = d.banks.map(b => b.key);
  const daily = () => { const start = o.D(d.from), end = new Date(); const xs = []; for (let t = start.getTime(); t <= end.getTime(); t += 7 * 864e5) xs.push(o.iso(new Date(t))); return xs; };
  const xs = daily();
  const val = (steps, x) => { let v = null; for (const [dd, r] of steps) { if (dd <= x) v = r; else break; } return v; };
  const draw = () => {
    const series = d.banks.filter(b => sel.includes(b.key)).map((b, k) => ({ name: b.name, v: xs.map(x => val(b.steps, x)), dash: k % 2 === 1, opacity: k < 2 ? 1 : .6 }));
    o.lineChart(o.$('#ch'), { x: xs, series, h: 260, fmtY: t => t + '%', read: i => o.$('#rd').innerHTML = `${o.fmtD(xs[i])}: ` + series.map(s => `${s.name} ${o.num(s.v[i])}%`).join(', ') });
    o.$('#lg').innerHTML = series.map(s => `<span><i class="${s.dash ? 'ld' : 'l'}"></i>${s.name}</span>`).join('');
  };
  o.chips(o.$('#cb'), d.banks.map(b => [b.key, b.name]), sel, () => draw(), { check: true, multi: true });
  draw(); o.onResize(draw);
}

/* ================================================================== RECESSION WATCH */
async function recession() {
  const o = O(); const d = await o.data('recession.json').catch(() => null);
  if (!d) { o.main().innerHTML = o.head({ title: 'Recession watch' }) + o.fail(); return; }
  const IND = [
    ['curve', '10Y-3M Treasury curve', 'The 10-year Treasury yield less the 3-month bill. Every US recession since the 1960s was preceded by an inversion, a reading below zero, though the lead time has varied from a few months to two years.', v => o.num(v) + 'pp', 'FRED: T10Y3M, weekly', [[0, 'Inversion']]],
    ['sahm', 'Sahm rule', 'The rise of the three-month average unemployment rate above its low of the past twelve months. A rise of 0.5 points or more has marked the early months of every recession since 1970.', v => o.num(v) + 'pp', 'FRED: SAHMREALTIME, monthly', [[0.5, 'Trigger 0.5']]],
    ['claims', 'Initial jobless claims', 'New claims for unemployment insurance each week, in thousands. A sustained rise is one of the earliest signs that firms are laying off workers.', v => o.num(v, 0) + 'k', 'FRED: ICSA, weekly, thousands', []],
    ['hy', 'High-yield credit spread', 'The extra yield investors demand to hold junk bonds over Treasuries. Spreads tend to widen sharply before and during recessions as default risk rises.', v => o.num(v) + '%', 'FRED: BAMLH0A0HYM2, weekly', []],
    ['nfci', 'Chicago Fed National Financial Conditions Index', 'A weekly summary of 105 measures of risk, credit and leverage. Zero is the historical average; positive readings mean tighter than average financial conditions.', v => o.num(v), 'FRED: NFCI, weekly', [[0, 'Average']]],
  ];
  const sig = (k, s) => ({ Inverted: 'mv--down', Triggered: 'mv--down', Elevated: 'mv--down', Stress: 'mv--down', Watch: '', 'Tighter than average': 'mv--down' }[s] || 'mv--up');
  o.main().innerHTML = o.head({ title: 'Recession watch', lede: 'The most watched US recession indicators, each with its latest reading, its history with recessions shaded and its source.', meta: `FRED: Federal Reserve, BLS, Department of Labor, ICE BofA, Chicago Fed, NBER. Updated ${d.updated}.` }) +
    `<div class="col-main"><section class="sec rv"><h2>Latest readings</h2><p class="lede">Each indicator against its own published threshold, where it has one.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicator</th><th>Latest</th><th>Signal</th><th>Date</th></tr></thead><tbody>${d.readings.map(r => { const I = IND.find(x => x[0] === r.key); return `<tr><td><a href="#r-${r.key}">${I[1]}</a></td><td>${o.isNum(r.latest) ? I[3](r.latest) : '–'}</td><td class="${sig(r.key, r.signal)}">${r.signal || '–'}</td><td>${r.date ? o.fmtD(r.date) : '–'}</td></tr>`; }).join('')}</tbody></table></div></section>
     ${IND.map(([k, t, txt, f, src]) => `<section class="sec rv" id="r-${k}"><h2>${t}</h2><p class="lede">${txt}</p><div class="ctl__row" id="rg-${k}" style="margin-top:14px"></div><div class="chart-box" id="c-${k}"></div><p class="readout" id="rd-${k}"></p><p class="src">${src}. Shaded: NBER recessions.</p></section>`).join('')}
     <section class="sec rv"><h2>Limits</h2><p class="lede">No indicator is infallible. The curve stayed inverted for most of 2022–24 without a recession by the NBER’s definition; the Sahm rule can be triggered by a rising labour supply rather than layoffs. Read them together.</p></section></div>
     <aside class="col-side rv"><h2 class="side-title">Signals</h2><ul class="kpi">${d.readings.map(r => { const I = IND.find(x => x[0] === r.key); return `<li class="kpi__item"><span class="kpi__name">${I[1].replace('Chicago Fed National Financial Conditions Index', 'Financial conditions')}</span><span class="kpi__level" style="font-size:16px">${o.isNum(r.latest) ? I[3](r.latest) : '–'}</span><span class="kpi__chg ${sig(r.key, r.signal)}">${r.signal || ''}</span></li>`; }).join('')}</ul></aside>`;
  const st = {};
  const draw = k => { const I = IND.find(x => x[0] === k); const s = k === 'claims' ? d.claims4 : d[k]; if (!s?.dates?.length) { o.$('#c-' + k).innerHTML = o.fail(); return; } const yrs = { '5Y': 5, '20Y': 20, 'All': 200 }[st[k]]; const cut = o.iso(new Date(Date.now() - yrs * 365.25 * 864e5)); const a = Math.max(0, s.dates.findIndex(x => x >= cut)); const xs = s.dates.slice(a), v = s.values.slice(a);
    o.lineChart(o.$('#c-' + k), { x: xs, series: [{ v }], h: 220, shade: d.rec, hlines: I[5], fmtY: t => k === 'claims' ? t + 'k' : t, read: i => o.$('#rd-' + k).innerHTML = `${o.fmtD(xs[i])}: ${I[3](v[i])}` }); };
  IND.forEach(([k]) => { st[k] = '20Y'; o.chips(o.$('#rg-' + k), ['5Y', '20Y', 'All'], '20Y', v => { st[k] = v; draw(k); }); draw(k); });
  o.onResize(() => IND.forEach(([k]) => draw(k)));
}

/* ================================================================== MARKET HISTORY */
async function history() {
  const o = O(); const d = await o.data('history/index.json').catch(() => null);
  if (!d) { o.main().innerHTML = o.head({ title: 'Market history' }) + o.fail(); return; }
  o.main().innerHTML = o.head({ title: 'Market history', lede: `What happened in each stage of the S&P 500 since 1928: ${d.episodes.length} episodes, each with its fall from peak to low, the months to the low and back to the peak, and what happened.`, meta: `S&P 500 daily closes, price only. Yahoo Finance, to ${d.asof}.` }) +
    `<div class="col-full"><section class="sec rv"><h2>The S&P 500 since 1928</h2><p class="lede">Weekly close, log scale. Shaded: the selected episode.</p><div class="chart-box" id="ch"></div><p class="readout" id="rd"></p><div class="chart-box" id="falls"></div><p class="src">S&P 500 daily close, price only (the S&P 90 before March 1957). Yahoo Finance, ^GSPC.</p></section>
     <section class="sec rv"><h2>Every episode</h2><div class="tbl-wrap"><table class="tbl" id="et"><thead><tr><th data-k="n" data-dir="1">#</th><th class="l" data-k="title" data-dir="1">Episode</th><th data-k="fall" data-dir="1">Fall, peak to low</th><th data-k="m_low">Months to the low</th><th data-k="m_rec">Months back to the peak</th><th data-k="ret">Return over the episode</th></tr></thead><tbody></tbody></table></div></section>
     <section class="sec rv"><h2>How the figures are measured</h2><p class="lede">Each episode covers the calendar years named in its title, up to the start of the next. The peak is the highest close before the episode’s deepest fall; the low is the bottom of that fall; the recovery is the first close back at the peak, which can come after the episode ends. Prices only: dividends would shorten every recovery.</p></section></div>`;
  const pts = o.uncompact(d.series); const xs = pts.map(p => p[0]), v = pts.map(p => p[1]);
  let hl = null;
  const draw = () => {
    const shade = hl ? [[hl.peak_d, hl.rec_d || hl.to]] : [];
    o.lineChart(o.$('#ch'), { x: xs, series: [{ v }], h: 300, log: true, shade, fmtY: t => t >= 1000 ? (t / 1000) + 'k' : t, xfmt: x => o.D(x).getFullYear(), xlabels: [0, Math.round(xs.length * .25), Math.round(xs.length * .5), Math.round(xs.length * .75), xs.length - 1], read: i => o.$('#rd').innerHTML = `${o.fmtD(xs[i])}: ${o.num(v[i])}` });
    o.barChart(o.$('#falls'), { cats: d.episodes.map(e => e.n), series: [{ type: 'down', v: d.episodes.map(e => e.fall) }], h: 160, catFmt: (c, i) => i % 4 === 0 ? d.episodes[i].from.slice(0, 4) : '', fmtY: t => t + '%', read: i => { hl = d.episodes[i]; o.$('#rd').innerHTML = `<b style="font-weight:550">${hl.title}</b>: ${o.pct(hl.fall, 1)} from ${o.fmtD(hl.peak_d)} to ${o.fmtD(hl.low_d)}`; }, rest: d.episodes.length - 1 });
  };
  draw(); o.onResize(draw);
  o.sortableTable(o.$('#et'), d.episodes, null, e => `<tr><td>${e.n}</td><td class="l"><a href="${o.link('market-history/' + e.slug + '/')}">${e.title}</a><small>${e.from.slice(0, 4)} to ${e.to.slice(0, 4)}</small></td><td class="mv--down">${o.pct(e.fall, 1)}</td><td>${o.num(e.m_low, 0)}</td><td>${o.isNum(e.m_rec) ? o.num(e.m_rec, 0) : 'Not yet'}</td><td>${o.mv(e.ret, 1)}</td></tr>`);
}

async function episode(slug) {
  const o = O(); const [e, idx] = await Promise.all([o.data(`history/${slug}.json`).catch(() => null), o.data('history/index.json').catch(() => null)]);
  if (!e) { o.main().innerHTML = o.head({ title: 'Market history' }) + o.fail(); return; }
  const list = idx?.episodes || []; const i = list.findIndex(x => x.slug === slug); const prev = list[i - 1], next = list[i + 1];
  o.main().innerHTML = o.head({ crumbs: [['market-history/', 'Market history'], [null, `${e.from.slice(0, 4)} to ${e.to.slice(0, 4)}`]], title: e.title, lede: 'The S&P 500 through the episode, from its peak to its low and back to the peak, and what happened.', meta: `${o.fmtM(e.from)} to ${o.fmtM(e.to)} · Episode ${e.n} of ${list.length} · Fall ${o.pct(e.fall, 1)}` }) +
    `<div class="col-main"><section class="sec rv"><div class="chart-box" id="ch" style="margin-top:0"></div><div class="legend"><span><i class="l"></i>S&P 500, daily close</span><span><i class="ld"></i>The peak’s level</span></div><p class="readout" id="rd"></p><p class="src">S&P 500 daily close, price only. Yahoo Finance, ^GSPC, to ${e.asof}.</p></section>
     <section class="sec rv"><h2>The fall in numbers</h2><div class="kstrip"><div><span class="kpi__name">Fall, peak to low</span><div class="kpi__level mv--down">${o.pct(e.fall, 1)}</div><div class="kpi__chg">${o.fmtDS(e.peak_d)} ${o.D(e.peak_d).getFullYear()} to ${o.fmtD(e.low_d)}</div></div><div><span class="kpi__name">To the low</span><div class="kpi__level">${o.num(e.m_low, 0)} months</div><div class="kpi__chg">${e.s_low} sessions</div></div><div><span class="kpi__name">Back to the peak</span><div class="kpi__level">${o.isNum(e.m_rec) ? o.num(e.m_rec, 0) + ' months' : 'Not yet'}</div><div class="kpi__chg">${e.rec_d ? o.fmtD(e.rec_d) : ''}</div></div><div><span class="kpi__name">Peak</span><div class="kpi__level">${o.num(e.peak)}</div><div class="kpi__chg">Low ${o.num(e.low)}</div></div></div></section>
     <section class="sec rv"><h2>What happened</h2><p class="lede" style="color:var(--ink);max-width:640px">${o.esc(e.text)}</p></section>
     <section class="sec rv"><h2>Play it</h2><p class="lede">Sit through a fall like this one without knowing which it is.</p><div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="${o.link('simulators/panic-test/')}">Panic Test</a><a class="btn btn--ghost" href="${o.link('simulators/trading-simulator/')}">Trading Simulator</a></div></section>
     <div style="display:flex;justify-content:space-between;margin-top:30px;gap:20px">${prev ? `<a class="btn btn--ghost btn--sm" href="${o.link('market-history/' + prev.slug + '/')}">← ${prev.title}</a>` : '<span></span>'}${next ? `<a class="btn btn--ghost btn--sm" href="${o.link('market-history/' + next.slug + '/')}">${next.title} →</a>` : ''}</div></div>`;
  const pts = o.uncompact(e.series); const xs = pts.map(p => p[0]), v = pts.map(p => p[1]);
  const draw = () => o.lineChart(o.$('#ch'), { x: xs, series: [{ v: v.map(() => e.peak), dash: true }, { v, width: 1.6 }], h: 300, marks: [{ d: e.peak_d, label: 'Peak' }, { d: e.low_d, label: 'Low' }, ...(e.rec_d && o.D(e.rec_d) <= xs[xs.length - 1] ? [{ d: e.rec_d, label: 'Back to peak' }] : [])], read: i => o.$('#rd').innerHTML = `${o.fmtD(xs[i])}: ${o.num(v[i])} (${o.mv((v[i] / e.peak - 1) * 100, 1)} against the peak)` });
  draw(); o.onResize(draw);
}

/* ================================================================== INFO PAGES */
async function sources() {
  const o = O(); const st = await o.data('status.json').catch(() => null);
  const S = [['Yahoo Finance', 'Closing prices of equity indices, sector ETFs, volatility indices, currencies, commodity futures, credit ETFs, digital assets and the 600 companies; company fundamentals, analyst recommendations, news and earnings dates.', 'Dashboards, World, FX, Companies, Calendar, Daily note, Chart of the day, Market history, Simulators', 'After each US close; fundamentals in rotation, about 120 companies a day'],
    ['FRED, Federal Reserve Bank of St. Louis', 'Credit spreads (ICE BofA), CPI, PCE, payrolls, unemployment, the yield curve, the Sahm rule, jobless claims, financial conditions, NBER recessions, OECD long-term and short-term interest rates, the Fed and ECB policy rates, 10-year Treasury yields.', 'Dashboards, World, FX, Central banks, Recession watch, Portfolio Builder', 'After each US close'],
    ['CFTC Public Reporting', 'Disaggregated Commitments of Traders, futures only: managed money, producers, swap dealers, other reportables and open interest for 21 commodity futures, five years of weekly reports.', 'Commodities', 'Weekly, positions as of Tuesday, published Friday'],
    ['US Energy Information Administration (EIA)', 'Weekly Petroleum Status Report (inventories, production, refinery runs, imports, exports, products supplied) and the Weekly Natural Gas Storage Report.', 'Commodities: supply & demand', 'Wednesdays and Thursdays; each week is archived so the history grows'],
    ['IMF PortWatch', 'Daily ship transits through the Strait of Hormuz, Bab el-Mandeb, Suez, Panama, Malacca, the Cape of Good Hope, the Bosporus and Gibraltar, from satellite AIS tracking.', 'Commodities: logistics', 'Daily, with a lag of a few days'],
    ['Open-Meteo', '16-day forecasts, the NOAA GEFS ensemble to day 34 and ten years of ERA5 reanalysis for normals, for 17 gas-demand cities and crop regions.', 'Commodities: weather', 'After each US close; normals rebuilt weekly'],
    ['USDA', 'WASDE release dates.', 'Commodities: calendar', 'Edited in the pipeline configuration'],
    ['World Bank', 'Real GDP growth, consumer price inflation and unemployment by country, latest annual figures.', 'World', 'After each US close'],
    ['Central banks', 'Meeting calendars of the Fed, ECB, Bank of England and Bank of Japan; Bank of England and Bank of Japan rate decisions.', 'Central banks, Calendar', 'Edited in the pipeline configuration'],
    ['Opsilon Markets', 'Every calculation: returns, z-scores, correlations, drawdowns, the risk score, breadth, peer comparisons, the DCF model, and all generated text.', 'Everywhere', 'Each build']];
  o.main().innerHTML = o.head({ title: 'Data sources', lede: 'Where every figure on Opsilon Markets comes from, where it is used and how often it is read. Every chart and table also names its source and date.' }) +
    `<div class="col-main"><section class="sec rv"><h2>Sources</h2>${S.map(([n, w, u, f]) => `<div style="padding:20px 0;border-bottom:1px solid var(--rule)"><h3 style="font-size:18px">${n}</h3><p class="lede" style="font-size:15px">${w}</p><p class="page-meta"><b style="font-weight:550">Used in</b> ${u}</p><p class="page-meta"><b style="font-weight:550">Updated</b> ${f}</p></div>`).join('')}</section>
     <section class="sec rv"><h2>Rules we follow</h2><div class="prose"><ul><li>Every number on the site is read from a named source or calculated from one; nothing is typed in by hand except central bank meeting dates and the BoE and BoJ rate paths.</li><li>Every chart shows its source and the date of its last observation.</li><li>Generated text only states what the figures show; it never forecasts or recommends.</li><li>A source that fails leaves the previous figures in place rather than breaking the page.</li></ul></div></section>
     ${st ? `<section class="sec rv"><h2>Last update</h2><p class="lede">${st.updated}</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>Status</th><th>Seconds</th></tr></thead><tbody>${Object.entries(st.steps).map(([k, v]) => `<tr><td>${k}</td><td class="${v.ok ? 'mv--up' : 'mv--down'}">${v.ok ? 'OK' : 'Failed'}</td><td>${v.secs}</td></tr>`).join('')}</tbody></table></div></section>` : ''}</div>`;
}
async function methodology() {
  const o = O();
  const M = [['Returns', 'Price changes from the last close on or before the start of the period to the latest close, without dividends unless stated. Year to date starts from the last close of the previous year.'],
    ['z-scores', 'A day’s move less the average daily move over the previous year, divided by the standard deviation of those moves. Beyond ±2, a move is unusual; beyond ±3, rare.'],
    ['Volatility and beta', 'Volatility is the standard deviation of daily returns, annualised with the square root of 252. Beta is the covariance of a stock’s daily returns with its regional index, divided by the index’s variance, over one year.'],
    ['Risk score', 'The average of the day’s z-scores for the S&P 500, the Russell 2000 and high-yield bonds, less those of the VIX and half of gold’s, squashed between −1 and +1. Above +0.25 the session is risk-on; below −0.25 risk-off.'],
    ['Breadth', 'Advancers and decliners among 26 US large caps; a move within ±0.05% counts as flat.'],
    ['Company valuation', 'P/E on trailing twelve-month diluted EPS. The P/E history divides each month-end close by the last fiscal year’s diluted EPS, assumed known two months after the year ends. The DCF grows free cash flow at the chosen rate for five years, fades it in a straight line to the terminal rate by year ten, and adds a Gordon growth terminal value.'],
    ['Market history', 'Episodes follow calendar years. The peak is the highest close before the episode’s deepest fall, the recovery the first close back at that level.'],
    ['Commodity curves', 'Dated futures contracts from Yahoo Finance; a contract counts only if it traded in the last six days. Carry is the front against the contract nearest to six months out, annualised: (front ÷ deferred − 1) × 12 ÷ months between them. Positive is backwardation. The calendar spread follows the same two contracts over their shared history.'],
    ['Positioning', 'Managed-money net position (long less short) from the CFTC disaggregated report. The percentile ranks this week against the previous three years; above 90 or below 10 is flagged as crowded.'],
    ['Seasonality', 'Each calendar year of the front-month future rebased to its first close, on a grid every three days. Averages over the previous five and ten full years; the next-30-day figure averages the move over the following 30 calendar days in each of the past ten years. Front-month rolls are included.'],
    ['Weather', 'Heating degree days: 18°C less the daily mean temperature, when positive, summed; cooling degree days the reverse. Normals: the ten-year average for each calendar day, smoothed over seven days. Beyond day 16, the NOAA GEFS ensemble mean.'],
    ['Simulators', 'Daily closes; money out of the market earns 2% a year; switches apply from the next close. The S&P 500 uses the total return index from 1988 and adds an approximate 4% yearly dividend before that.']];
  o.main().innerHTML = o.head({ title: 'Methodology', lede: 'How every figure on the site is calculated.' }) + `<div class="col-main">${M.map(([t, x]) => `<section class="sec rv"><h2>${t}</h2><p class="lede">${x}</p></section>`).join('')}<p class="disclaimer">For information only. Not investment advice.</p></div>`;
}

return { reports, note, research, report, cotd, centralbanks, recession, history, episode, sources, methodology };
})());
