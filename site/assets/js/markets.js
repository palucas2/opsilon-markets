/* Opsilon Markets – Markets section: home, dashboards, calendar, world, FX, companies */
window.PAGES = Object.assign(window.PAGES || {}, (function () {
const O = () => window.O;

/* ================================================================== HOME */
async function home() {
  const { h, link, $ } = O();
  document.body.querySelector('main').outerHTML = `<main id="main"><section class="home-hero">
    <canvas id="hero"></canvas>
    <div class="home-top"><a class="brand" href="${link('')}"><span class="brand__mark">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 6.5a6.5 6.5 0 1 0 0 11"/><path d="M5.5 12H14"/></svg>'}</span>Opsilon Markets</a>
      <nav><span>For information only. Not investment advice.</span><a href="${link('sources/')}">Data sources</a><button id="themeBtn2" style="font-size:13px;color:inherit">Theme</button></nav></div>
    <h1>Markets, on the record.</h1>
    <div class="home-links"><div><a href="${link('dashboards/')}">Markets</a><a href="${link('lab/')}">Tools</a></div><div><a href="${link('reports/')}">Research</a><a href="${link('companies/')}">Companies</a></div></div>
  </section></main>`;
  $('#themeBtn2').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('ops-theme', t); } catch (e) {} };
  heroParticles($('#hero'));
}

function heroParticles(c) {
  const g = c.getContext('2d'); let P = [], W = 0, H = 0, dpr = 1, mouse = { x: -1e4, y: -1e4 };
  function build() {
    dpr = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr;
    const off = document.createElement('canvas'); const S = Math.min(W, H) * .62; off.width = S; off.height = S; const o = off.getContext('2d');
    o.strokeStyle = '#fff'; o.lineCap = 'round'; o.lineWidth = S * .09;
    const p = new Path2D('M17 6.5a6.5 6.5 0 1 0 0 11M5.5 12H14'); o.save(); o.scale(S / 24, S / 24); o.lineWidth = 2.1; o.stroke(p); o.restore();
    const img = o.getImageData(0, 0, S, S).data; P = [];
    const step = Math.max(2, Math.round(S / 210));
    for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) if (img[(y * S + x) * 4 + 3] > 128 && Math.random() < .85) {
      const tx = (W - S) / 2 + x + (Math.random() - .5) * step, ty = (H - S) / 2 + y + (Math.random() - .5) * step + 10;
      P.push({ tx, ty, x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, a: Math.random() * .7 + .3, s: Math.random() * 1.1 + .35, ph: Math.random() * 6.28 });
    }
    for (let i = 0; i < P.length * .18; i++) { const a = Math.random() * 6.28, r = Math.min(W, H) * (.32 + Math.random() * .25); P.push({ tx: W / 2 + Math.cos(a) * r * 1.2, ty: H / 2 + Math.sin(a) * r * .8, x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, a: Math.random() * .25, s: Math.random() * .8 + .2, ph: Math.random() * 6.28, dust: 1 }); }
  }
  build(); addEventListener('resize', O().debounce(build, 200));
  c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  c.addEventListener('mouseleave', () => { mouse.x = mouse.y = -1e4; });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function f(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--star').trim();
    for (const p of P) {
      const wob = p.dust ? 14 : 2.2;
      const tx = p.tx + Math.sin(t * .0006 + p.ph) * wob, ty = p.ty + Math.cos(t * .0005 + p.ph * 1.3) * wob;
      p.vx += (tx - p.x) * .012; p.vy += (ty - p.y) * .012;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 9000) { const k = (9000 - d2) / 9000 * 2.4; p.vx += dx / Math.sqrt(d2 + 1) * k; p.vy += dy / Math.sqrt(d2 + 1) * k; }
      p.vx *= .86; p.vy *= .86; p.x += p.vx; p.y += p.vy;
      g.fillStyle = `rgba(${rgb},${p.a * (.75 + .25 * Math.sin(t * .002 + p.ph))})`;
      g.fillRect(p.x, p.y, p.s, p.s);
    }
    if (!reduce) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}

/* ================================================================== DASHBOARDS INDEX */
const READ = {
  'sector-heatmap': 'Each sector is tracked through its Select Sector SPDR fund. A sector rising while most others fall points to rotation rather than a broad move; when every tile shares a colour, the day was driven by the market as a whole, usually rates or risk appetite.',
  'volatility-term-structure': 'Implied volatility usually rises with the expiry: investors pay more to insure further out. When short-dated volatility climbs above longer-dated volatility the curve is inverted, a sign that the market is pricing stress now rather than later.',
  'global-indices': 'Each index is shown in its own currency, so moves mix local equity performance with nothing of the exchange rate. Rebasing all the lines to the same start makes their paths directly comparable.',
  'fx-majors': 'Every bar is the currency against the dollar: positive means the currency gained and the dollar lost. When all six move the same way, the move is about the dollar itself; when they split, it is about each economy.',
  'commodities': 'Prices are front-month futures, rolled by the exchange, so a contract change can leave a small step in a line. Rebasing makes the energy, metals and grain complexes comparable on one scale.',
  'credit-spreads': 'A spread is the extra yield over Treasuries that investors demand to hold corporate debt. Spreads widen when default risk or risk aversion rises, often before equities fall, and narrow when credit is easy.',
  'inflation-and-labour': 'Inflation is the change in prices over twelve months. Payrolls are the monthly change in jobs, the figure markets watch most closely on the first Friday of the month. Together they frame what the Fed can do next.',
  'watchlist-breadth': 'Breadth counts how many names rose against how many fell. An index rising on narrow breadth depends on a few large companies; a cumulative line that falls while the index rises is a classic warning sign.',
  'cross-asset-correlation': 'Correlation runs from −1, opposite moves, to +1, identical moves. Stocks and bonds usually move against each other when growth drives markets and together when inflation does.',
};

async function dashboards() {
  const o = O(); const m = o.main();
  const d = await o.data('dashboards/index.json').catch(() => null);
  if (!d) { m.innerHTML = o.head({ title: 'Dashboards' }) + o.fail(); return; }
  const cats = ['All', 'Rates', 'Macro', 'Equities', 'Cross-asset'];
  const count = c => c === 'All' ? d.tiles.length : d.tiles.filter(t => t.cat === c).length;
  m.innerHTML = o.head({ title: 'Dashboards', lede: 'Interactive views across rates, equities, macro and cross-asset. Open any one for its full history.', meta: `Figures to the close of ${d.asof}. Each tile names its own source and date.` }) +
    `<div class="col-full rv"><div class="ctl__row chips-lg" id="cats"></div><p class="page-meta" id="showing"></p><div class="tiles" id="tiles"></div></div>`;
  const draw = c => {
    const list = d.tiles.filter(t => c === 'All' || t.cat === c);
    o.$('#showing').textContent = `Showing ${list.length === d.tiles.length ? 'all ' : ''}${list.length} dashboard${list.length > 1 ? 's' : ''}`;
    const box = o.$('#tiles'); box.innerHTML = '';
    list.forEach(t => { const el = o.h(`<a class="tile" href="${o.link('dashboards/' + t.id + '/')}"><div class="tile__top"><h3>${t.title}</h3>${o.ARROW}</div><div class="tile__head"></div><div class="tile__sub"></div><div class="tile__body"></div><div class="tile__src">${t.cat}. ${t.src}</div></a>`); box.appendChild(el); tileBody(el, t); });
  };
  o.chips(o.$('#cats'), cats.map(c => [c, `${c} <small>${count(c)}</small>`]), 'All', draw);
  draw('All');
}

function tileBody(el, t) {
  const o = O(); const H = o.$('.tile__head', el), S = o.$('.tile__sub', el), B = o.$('.tile__body', el);
  if (t.rows && (t.id === 'sector-heatmap')) {
    const w = t.weakest, s = t.strongest;
    H.innerHTML = `${w[0]} ${o.mv(w[1])}`; S.innerHTML = `Weakest of ${t.n} sectors. ${t.up} of ${t.n} rose; ${s[0]} ${o.mv(s[1])} led.`;
    B.innerHTML = `<div class="heat">${t.rows.map(([n, v]) => `<div style="background:${o.heatColor(v)}">${n.replace('Cons. discretionary', 'Cons. disc.').replace('Communications', 'Comms').replace('Cons. staples', 'Staples')}<b>${o.pct(v)}</b></div>`).join('')}</div>`;
  } else if (t.rows && (t.id === 'global-indices' || t.id === 'fx-majors')) {
    const w = t.rows.reduce((a, b) => Math.abs(b[1]) > Math.abs(a[1]) ? b : a, t.rows[0] || ['', 0]);
    if (t.id === 'fx-majors') { const up = t.rows.filter(r => r[1] < 0).length; H.innerHTML = `Dollar ${o.mv(-(t.rows.reduce((a, r) => a + r[1], 0) / t.rows.length))}`; S.innerHTML = `Average against the majors. Largest move: ${w[0]} ${o.mv(w[1])}. Stronger against ${up} of ${t.n}.`; }
    else { H.innerHTML = `${t.weakest[0]} ${o.mv(t.weakest[1])}`; S.innerHTML = `Weakest of ${t.n} benchmarks. ${t.up} of ${t.n} rose; ${t.strongest[0]} ${o.mv(t.strongest[1])} led.`; }
    const box = o.h('<div></div>'); B.appendChild(box); requestAnimationFrame(() => o.hbars(box, t.rows, { labelW: 120, h: 24 }));
  } else if (t.id === 'commodities') {
    H.innerHTML = t.head.label ? `${t.head.label} ${o.mv(t.head.value)}` : ''; S.textContent = 'Largest move of nine futures over one month.';
    const box = o.h('<div></div>'); B.appendChild(box); requestAnimationFrame(() => o.hbars(box, t.rows.sort((a, b) => (b[1] ?? -1e9) - (a[1] ?? -1e9)).slice(0, 7), { labelW: 110, h: 24 }));
  } else if (t.id === 'credit-spreads') {
    if (t.head.etf) { H.innerHTML = `High yield ${o.mv(t.head.m1)}`; S.textContent = 'HYG over a month. Dashed: 7–10 year Treasuries (IEF).'; }
    else { H.innerHTML = `High yield ${o.num(t.head.value)}%`; S.innerHTML = `${o.isNum(t.head.chg) ? `<span class="${t.head.chg > 0 ? 'mv--down' : 'mv--up'}">${o.sgn(t.head.chg, 0)}bp</span> in a month. ` : ''}Dashed: investment grade.`; }
    const box = o.h('<div></div>'); B.appendChild(box); requestAnimationFrame(() => o.spark(box, t.spark, { h: 150, v2: t.spark2 }));
  } else if (t.id === 'volatility-term-structure') {
    H.innerHTML = `VIX ${o.num(t.head.value)}`; S.innerHTML = `${o.isNum(t.head.chg) ? `${o.mv(t.head.chg, 2, '')} points since ${t.compare_date}. ` : ''}${t.head.inverted ? 'The 9-day sits above the 1-month: the front of the curve is inverted.' : 'The curve slopes upward, the normal shape.'}`;
    const box = o.h('<div></div>'); B.appendChild(box); requestAnimationFrame(() => o.lineChart(box, { x: t.labels, series: [{ v: t.values, width: 2 }, { v: t.compare, dash: true }], h: 150, xfmt: x => x, xlabels: [0, 1, 2, 3], nt: 3, fmtY: v => v }));
  } else if (t.id === 'inflation-and-labour') {
    H.innerHTML = `CPI ${o.num(t.head.value, 1)}% a year`; S.innerHTML = `Unemployment ${o.num(t.unrate, 1)}%. Payrolls ${o.sgn(t.jobs_last, 0)}k last month.`;
    const box = o.h('<div></div>'); B.appendChild(box); requestAnimationFrame(() => o.barChart(box, { cats: t.bars.map((_, i) => i), series: [{ type: 'sign', v: t.bars }], h: 150, noLabels: true, fmtY: v => v + 'k' }));
  } else if (t.id === 'watchlist-breadth') {
    H.innerHTML = `Net breadth ${o.sgn(t.head.value, 0)}`; S.textContent = `${t.head.up} up, ${t.head.down} down in the last session.`;
    const box = o.h('<div></div>'); B.appendChild(box); requestAnimationFrame(() => o.barChart(box, { cats: t.net.map((_, i) => i), series: [{ type: 'sign', v: t.net }], h: 150, noLabels: true }));
  } else if (t.id === 'cross-asset-correlation') {
    H.innerHTML = `${o.num(t.head.value)}`; S.textContent = `${t.head.label}.`;
    B.innerHTML = corrTable(t.short, t.matrix, true);
  }
}

function corrTable(names, m, small) {
  const o = O();
  const col = v => { const rgb = getComputedStyle(document.documentElement).getPropertyValue(v >= 0 ? '--heat-up' : '--heat-down').trim(); return `rgba(${rgb},${Math.abs(v) * .8})`; };
  return `<table class="tbl" style="${small ? 'font-size:12px' : ''}"><thead><tr><th></th>${names.map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>${m.map((row, i) => `<tr><td>${names[i]}</td>${row.map((v, j) => `<td style="background:${i === j ? 'transparent' : col(v)};text-align:center">${i === j ? '' : o.num(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/* ================================================================== DASHBOARD DETAIL */
async function dashboard(id) {
  const o = O(); const m = o.main();
  const d = await o.data(`dashboards/${id}.json`).catch(() => null);
  if (!d) { m.innerHTML = o.head({ title: id }) + o.fail(); return; }
  m.innerHTML = o.head({ crumbs: [['dashboards/', 'Dashboards'], [null, d.cat]], title: d.title, lede: d.lede, meta: `${d.source}. As of ${d.asof}.` }) +
    `<div class="col-main rv"><div id="ctl"></div><div class="chart-box" id="ch"></div><div id="leg"></div><p class="readout" id="rd"></p>
     <section class="sec" style="margin-top:28px;border-top:1px solid var(--rule);padding-top:28px"><h2>Latest</h2><div id="tbl"></div></section>
     <section class="sec"><h2>How to read it</h2><p class="lede">${READ[id] || ''}</p></section>
     <section class="sec"><h2>Source</h2><p class="lede">${d.source}. Data refreshed after each US close. As of ${d.asof}.</p></section></div>
     <aside class="col-side rv"><h2 class="side-title">Latest</h2><div id="side"></div></aside>`;
  ({ perf: dashPerf, lines: dashLines, curve: dashCurve, macro: dashMacro, breadth: dashBreadth, matrix: dashMatrix })[d.kind](d);
}

function ctlRow(label, id) { return `<div class="ctl"><div class="ctl__lab">${label}</div><div class="ctl__row" id="${id}"></div></div>`; }
function sliceFrom(dates, from) { const i = dates.findIndex(x => x >= from); return i < 0 ? 0 : i; }
function rangeStart(dates, rg) { const days = { '1D': 1, '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '2Y': 730, '5Y': 1826 }[rg]; const last = O().D(dates[dates.length - 1]); return O().iso(new Date(last.getTime() - days * 864e5)); }

function dashPerf(d) {
  const o = O(); const st = { view: 'Ranked', rg: '1D', show: d.names.slice(), from: null };
  o.$('#ctl').innerHTML = ctlRow('View', 'cv') + `<div class="ctl"><div class="ctl__lab">Range</div><div class="ctl__row"><span id="cr" class="ctl__row"></span><label class="field" style="flex-direction:row;align-items:center;gap:10px;margin-left:8px">From <input type="date" id="cf"></label></div></div>` + ctlRow('Show', 'cs');
  o.chips(o.$('#cv'), ['Ranked', 'Rebased'], st.view, v => { st.view = v; draw(); });
  o.chips(o.$('#cr'), Object.keys(d.ranges), st.rg, v => { st.rg = v; st.from = null; o.$('#cf').value = ''; draw(); });
  o.chips(o.$('#cs'), d.names, st.show, () => draw(), { check: true, multi: true });
  o.$('#cf').onchange = e => { st.from = e.target.value || null; draw(); };
  const draw = () => {
    const box = o.$('#ch'); const idx = d.names.map((n, i) => i).filter(i => st.show.includes(d.names[i]));
    const H = d.hist; const from = st.from || (st.rg === '1D' ? rangeStart(H.dates, '1W') : rangeStart(H.dates, st.rg));
    const a = sliceFrom(H.dates, from); const dates = H.dates.slice(a);
    const perf = i => { if (st.from) { const s = H.series[i]; const v0 = s.slice(a).find(o.isNum); const v1 = s[s.length - 1]; return v0 ? (v1 / v0 - 1) * 100 : null; } return d.ranges[st.rg].values[i]; };
    if (st.view === 'Ranked') {
      const rows = idx.map(i => [d.names[i], perf(i)]).sort((x, y) => (y[1] ?? -1e9) - (x[1] ?? -1e9));
      o.hbars(box, rows, { labelW: 150 });
      o.$('#leg').innerHTML = ''; o.$('#rd').innerHTML = `${st.from ? 'From ' + o.fmtD(st.from) : st.rg === '1D' ? 'Last session' : st.rg} to ${o.fmtD(H.dates[H.dates.length - 1])}.`;
    } else {
      const series = idx.map((i, k) => { const s = H.series[i].slice(a); const v0 = s.find(o.isNum); return { name: d.names[i], v: s.map(v => o.isNum(v) && v0 ? v / v0 * 100 : null), dash: k % 2 === 1, opacity: k < 2 ? 1 : .55 }; });
      o.lineChart(box, { x: dates, series, base: 100, h: 260, read: i => o.$('#rd').innerHTML = `${o.fmtD(dates[i])}: ` + series.map(s => `${s.name} ${o.num(s.v[i], 1)}`).join(', ') });
      o.$('#leg').innerHTML = `<div class="legend">${series.map(s => `<span><i class="${s.dash ? 'ld' : 'l'}"></i>${s.name}</span>`).join('')}</div>`;
    }
  };
  draw(); o.onResize(draw);
  const rg = Object.keys(d.ranges);
  o.$('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${d.id === 'fx-majors' ? 'Currency against the dollar' : 'Name'}</th>${rg.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>${d.names.map((n, i) => `<tr><td>${n}</td>${rg.map(r => `<td>${o.mv(d.ranges[r].values[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const v = d.ranges['1D'].values.map((x, i) => [d.names[i], x]).filter(x => o.isNum(x[1])).sort((a, b) => b[1] - a[1]);
  o.$('#side').innerHTML = v.length ? `<ul class="kpi"><li class="kpi__item"><span class="kpi__name">Strongest</span><span class="kpi__level">${v[0][0]}</span><span class="kpi__chg">${o.mv(v[0][1])}</span></li><li class="kpi__item"><span class="kpi__name">Weakest</span><span class="kpi__level">${v[v.length - 1][0]}</span><span class="kpi__chg">${o.mv(v[v.length - 1][1])}</span></li><li class="kpi__item"><span class="kpi__name">Rose</span><span class="kpi__level">${v.filter(x => x[1] > 0).length} of ${v.length}</span></li><li class="kpi__item"><span class="kpi__name">Average</span><span class="kpi__level">${o.mv(v.reduce((a, x) => a + x[1], 0) / v.length)}</span></li></ul><p class="side-src">${d.source}, ${d.asof}. Last session.</p>` : o.fail();
}

function dashLines(d) {
  const o = O(); const views = d.rebase ? ['Rebased', 'Ranked'] : ['Levels', 'Change'];
  const st = { view: views[0], rg: '6M', show: d.series.filter(s => s.on).map(s => s.name), from: null };
  o.$('#ctl').innerHTML = ctlRow('View', 'cv') + `<div class="ctl"><div class="ctl__lab">Range</div><div class="ctl__row"><span id="cr" class="ctl__row"></span><label class="field" style="flex-direction:row;align-items:center;gap:10px;margin-left:8px">From <input type="date" id="cf"></label></div></div>` + ctlRow('Show', 'cs');
  o.chips(o.$('#cv'), views, st.view, v => { st.view = v; draw(); });
  o.chips(o.$('#cr'), d.ranges, st.rg, v => { st.rg = v; st.from = null; o.$('#cf').value = ''; draw(); });
  o.chips(o.$('#cs'), d.series.map(s => s.name), st.show, () => draw(), { check: true, multi: true });
  o.$('#cf').onchange = e => { st.from = e.target.value || null; draw(); };
  const unit = d.unit || '';
  const draw = () => {
    const from = st.from || rangeStart(d.dates, st.rg); const a = sliceFrom(d.dates, from); const dates = d.dates.slice(a);
    const sel = d.series.filter(s => st.show.includes(s.name));
    const box = o.$('#ch');
    if (st.view === 'Ranked') {
      const rows = sel.map(s => { const v = s.values.slice(a); const v0 = v.find(o.isNum); const v1 = [...v].reverse().find(o.isNum); return [s.name, v0 ? (v1 / v0 - 1) * 100 : null]; }).sort((x, y) => (y[1] ?? -1e9) - (x[1] ?? -1e9));
      o.hbars(box, rows, { labelW: 150 }); o.$('#leg').innerHTML = ''; o.$('#rd').textContent = `Change from ${o.fmtD(dates[0])} to ${o.fmtD(dates[dates.length - 1])}.`; return;
    }
    const series = sel.map((s, k) => { const v = s.values.slice(a); const v0 = v.find(o.isNum); let vv = v; if (st.view === 'Rebased') vv = v.map(x => o.isNum(x) && v0 ? x / v0 * 100 : null); if (st.view === 'Change') vv = v.map(x => o.isNum(x) && o.isNum(v0) ? (x - v0) * 100 : null); return { name: s.name, v: vv, dash: k % 2 === 1, opacity: k < 2 ? 1 : .6 }; });
    const f = st.view === 'Change' ? (v => o.sgn(v, 0) + 'bp') : st.view === 'Rebased' ? (v => o.num(v, 1)) : (v => o.num(v, d.dec ?? 2) + unit);
    o.lineChart(box, { x: dates, series, h: 260, base: st.view === 'Rebased' ? 100 : st.view === 'Change' ? 0 : null, fmtY: st.view === 'Change' ? (v => v + 'bp') : st.view === 'Rebased' ? (v => v) : (v => v + unit),
      read: i => o.$('#rd').innerHTML = `${o.fmtD(dates[i])}: ` + series.map(s => `${s.name} ${f(s.v[i])}`).join(', ') });
    o.$('#leg').innerHTML = `<div class="legend">${series.map(s => `<span><i class="${s.dash ? 'ld' : 'l'}"></i>${s.name}</span>`).join('')}</div>`;
  };
  draw(); o.onResize(draw);
  const last = d.dates.length - 1;
  const chg = (s, days) => { const t = rangeStart(d.dates, days); const i = sliceFrom(d.dates, t); const a = s.values[i], b = s.values[last]; return o.isNum(a) && o.isNum(b) ? (d.rebase ? (b / a - 1) * 100 : (b - a) * 100) : null; };
  const cf = v => d.rebase ? o.mv(v) : o.isNum(v) ? `<span class="${v > 0 ? 'mv--down' : 'mv--up'}">${o.sgn(v, 0)}bp</span>` : '–';
  o.$('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Series</th><th>Last</th><th>1M</th><th>3M</th><th>1Y</th></tr></thead><tbody>${d.series.map(s => `<tr><td>${s.name}</td><td>${o.num(s.values[last], d.dec ?? 2)}${unit}</td><td>${cf(chg(s, '1M'))}</td><td>${cf(chg(s, '3M'))}</td><td>${cf(chg(s, '1Y'))}</td></tr>`).join('')}</tbody></table></div>`;
  o.$('#side').innerHTML = `<ul class="kpi">${d.series.slice(0, 4).map(s => `<li class="kpi__item"><span class="kpi__name">${s.name}</span><span class="kpi__level">${o.num(s.values[last], d.dec ?? 2)}${unit}</span><span class="kpi__chg">${cf(chg(s, '1M'))} in a month</span></li>`).join('')}</ul><p class="side-src">${d.source}, ${d.asof}.</p>`;
}

function dashCurve(d) {
  const o = O(); const st = { view: 'Curve', cmp: '1W' };
  o.$('#ctl').innerHTML = ctlRow('View', 'cv') + ctlRow('Compare with', 'cc');
  o.chips(o.$('#cv'), ['Curve', 'Change', 'Over time'], st.view, v => { st.view = v; draw(); });
  o.chips(o.$('#cc'), Object.keys(d.compare), st.cmp, v => { st.cmp = v; draw(); });
  const names = { '9D': '9 days', '1M': '1 month', '3M': '3 months', '6M': '6 months' };
  const draw = () => {
    const c = d.compare[st.cmp] || { values: [], date: '' }; const box = o.$('#ch');
    if (st.view === 'Curve') {
      o.lineChart(box, { x: d.labels, series: [{ v: d.values, width: 2 }, { v: c.values, dash: true }], h: 260, xfmt: x => names[x] || x, xlabels: d.labels.map((_, i) => i), read: i => o.$('#rd').innerHTML = `${names[d.labels[i]]}: ${o.num(d.values[i])} on ${o.fmtD(d.date)}, ${o.num(c.values[i])} on ${o.fmtD(c.date)}` });
      o.$('#leg').innerHTML = `<div class="legend"><span><i class="l"></i>${o.fmtD(d.date)}</span><span><i class="ld"></i>${o.fmtD(c.date)}</span></div>`;
    } else if (st.view === 'Change') {
      o.barChart(box, { cats: d.labels.map(l => names[l]), series: [{ type: 'sign', v: d.values.map((v, i) => o.isNum(v) && o.isNum(c.values[i]) ? +(v - c.values[i]).toFixed(2) : null) }], h: 240, read: i => o.$('#rd').innerHTML = `${names[d.labels[i]]}: ${o.sgn(d.values[i] - c.values[i])} points since ${o.fmtD(c.date)}` });
      o.$('#leg').innerHTML = '';
    } else {
      const H = d.hist; const series = H.series.map((v, k) => ({ name: names[d.labels[k]], v, dash: k > 1, opacity: k === 1 ? 1 : .7 }));
      o.lineChart(box, { x: H.dates, series, h: 260, read: i => o.$('#rd').innerHTML = `${o.fmtD(H.dates[i])}: ` + series.map(s => `${s.name} ${o.num(s.v[i])}`).join(', ') });
      o.$('#leg').innerHTML = `<div class="legend">${series.map(s => `<span><i class="${s.dash ? 'ld' : 'l'}"></i>${s.name}</span>`).join('')}</div>`;
    }
  };
  draw(); o.onResize(draw);
  o.$('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Expiry</th><th>Now</th>${Object.keys(d.compare).map(k => `<th>${k} ago</th>`).join('')}</tr></thead><tbody>${d.labels.map((l, i) => `<tr><td>${names[l]}</td><td>${o.num(d.values[i])}</td>${Object.values(d.compare).map(c => `<td>${o.num(c.values[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const inv = d.values[0] > d.values[1];
  o.$('#side').innerHTML = `<ul class="kpi"><li class="kpi__item"><span class="kpi__name">VIX</span><span class="kpi__level">${o.num(d.values[1])}</span></li><li class="kpi__item"><span class="kpi__name">Shape</span><span class="kpi__level">${inv ? 'Inverted' : 'Upward'}</span></li><li class="kpi__item"><span class="kpi__name">9-day less 1-month</span><span class="kpi__level">${o.sgn(d.values[0] - d.values[1])}</span></li><li class="kpi__item"><span class="kpi__name">6-month less 1-month</span><span class="kpi__level">${o.sgn(d.values[3] - d.values[1])}</span></li></ul><p class="side-src">${d.source}, ${d.asof}.</p>`;
}

function dashMacro(d) {
  const o = O(); const st = { view: 'Inflation and jobs', rg: '2Y', show: ['CPI', 'Core CPI'] };
  o.$('#ctl').innerHTML = ctlRow('View', 'cv') + ctlRow('Range', 'cr') + ctlRow('Inflation measures', 'cs');
  o.chips(o.$('#cv'), ['Inflation and jobs', 'Unemployment'], st.view, v => { st.view = v; draw(); });
  o.chips(o.$('#cr'), d.ranges, st.rg, v => { st.rg = v; draw(); });
  o.chips(o.$('#cs'), d.measures.map(m => m.name), st.show, () => draw(), { check: true, multi: true });
  const draw = () => {
    const n = { '1Y': 12, '2Y': 24, '5Y': 60 }[st.rg]; const a = Math.max(0, d.dates.length - n); const dates = d.dates.slice(a); const box = o.$('#ch');
    if (st.view === 'Unemployment') {
      const v = d.unrate.slice(a); o.lineChart(box, { x: dates, series: [{ v, width: 2 }], h: 240, xfmt: o.fmtM, fmtY: x => x + '%', read: i => o.$('#rd').innerHTML = `${o.fmtM(dates[i])}: unemployment ${o.num(v[i], 1)}%` }); o.$('#leg').innerHTML = ''; return;
    }
    const ms = d.measures.filter(m => st.show.includes(m.name)).map((m, k) => ({ name: m.name, v: m.values.slice(a), dash: k % 2 === 1 }));
    box.innerHTML = '<div id="m1"></div><div id="m2" style="margin-top:18px"></div>';
    const jobs = d.jobs.slice(a);
    const rd = i => o.$('#rd').innerHTML = `${o.fmtM(dates[i])}: ` + ms.map(m => `${m.name} ${o.num(m.v[i])}%`).join(', ') + `; payrolls ${o.sgn(jobs[i], 0)}k`;
    o.lineChart(o.$('#m1'), { x: dates, series: ms, h: 200, xfmt: o.fmtM, fmtY: x => x + '%', hlines: [[2, 'Fed target 2%']], read: rd });
    o.barChart(o.$('#m2'), { cats: dates, series: [{ type: 'sign', v: jobs }], h: 140, noLabels: true, fmtY: x => x + 'k', read: rd });
    o.$('#leg').innerHTML = `<div class="legend">${ms.map(m => `<span><i class="${m.dash ? 'ld' : 'l'}"></i>${m.name}, % a year</span>`).join('')}<span><i class="sw-fill" style="background:var(--up)"></i>Payrolls, monthly change, thousands</span></div>`;
  };
  draw(); o.onResize(draw);
  const L = d.dates.length - 1;
  o.$('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th>${d.measures.map(m => `<th>${m.name}</th>`).join('')}<th>Payrolls</th><th>Unemployment</th></tr></thead><tbody>${[0, 1, 2, 3, 4, 5].map(k => L - k).filter(i => i >= 0).map(i => `<tr><td>${o.fmtM(d.dates[i])}</td>${d.measures.map(m => `<td>${o.isNum(m.values[i]) ? o.num(m.values[i]) + '%' : '–'}</td>`).join('')}<td>${o.isNum(d.jobs[i]) ? o.sgn(d.jobs[i], 0) + 'k' : '–'}</td><td>${o.isNum(d.unrate[i]) ? o.num(d.unrate[i], 1) + '%' : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  const lastI = v => { for (let i = v.length - 1; i >= 0; i--) if (o.isNum(v[i])) return i; return -1; };
  o.$('#side').innerHTML = `<ul class="kpi">${d.measures.map(m => { const i = lastI(m.values); return i < 0 ? '' : `<li class="kpi__item"><span class="kpi__name">${m.name}, ${o.fmtM(d.dates[i])}</span><span class="kpi__level">${o.num(m.values[i])}%</span><span class="kpi__chg">${o.num(m.values[i - 1])}% before</span></li>`; }).join('')}<li class="kpi__item"><span class="kpi__name">Payrolls</span><span class="kpi__level">${o.sgn(d.jobs[L], 0)}k</span></li><li class="kpi__item"><span class="kpi__name">Unemployment</span><span class="kpi__level">${o.num(d.unrate[L], 1)}%</span></li></ul><p class="side-src">${d.source}. As of ${d.asof}.</p>`;
}

function dashBreadth(d) {
  const o = O(); const st = { view: 'Net', rg: '3M' };
  o.$('#ctl').innerHTML = ctlRow('View', 'cv') + ctlRow('Range', 'cr');
  o.chips(o.$('#cv'), ['Net', 'Cumulative'], st.view, v => { st.view = v; draw(); });
  o.chips(o.$('#cr'), d.ranges, st.rg, v => { st.rg = v; draw(); });
  const draw = () => {
    const s = d.sessions.slice(st.rg === '1M' ? -22 : -66); const net = s.map(x => x[1] - x[2]); const box = o.$('#ch');
    const rd = i => o.$('#rd').innerHTML = `${o.fmtD(s[i][0])}: ${s[i][1]} up, ${s[i][2]} down, ${s[i][3]} flat. Net ${o.sgn(net[i], 0)}`;
    if (st.view === 'Net') o.barChart(box, { cats: s.map(x => x[0]), series: [{ type: 'sign', v: net }], h: 240, noLabels: true, read: rd });
    else { let c = 0; const cum = net.map(v => c += v); o.lineChart(box, { x: s.map(x => x[0]), series: [{ v: cum, width: 2 }], h: 240, read: rd }); }
    o.$('#leg').innerHTML = '';
  };
  draw(); o.onResize(draw);
  const last = d.sessions.slice(-10).reverse();
  o.$('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Session</th><th>Up</th><th>Down</th><th>Flat</th><th>Net</th></tr></thead><tbody>${last.map(x => `<tr><td>${o.fmtD(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${o.mv(x[1] - x[2], 0, '')}</td></tr>`).join('')}</tbody></table></div><p class="src">Watchlist: ${d.names.join(', ')}.</p>`;
  const L = d.sessions[d.sessions.length - 1] || ['', 0, 0, 0]; const m = d.sessions.slice(-22).reduce((a, x) => a + x[1] - x[2], 0);
  o.$('#side').innerHTML = `<ul class="kpi"><li class="kpi__item"><span class="kpi__name">Last session</span><span class="kpi__level">${o.sgn(L[1] - L[2], 0)}</span><span class="kpi__chg">${L[1]} up, ${L[2]} down</span></li><li class="kpi__item"><span class="kpi__name">Net, 1 month</span><span class="kpi__level">${o.sgn(m, 0)}</span></li></ul><p class="side-src">${d.source}, ${d.asof}.</p>`;
}

function dashMatrix(d) {
  const o = O(); const st = { view: 'Matrix', w: '3M' };
  o.$('#ctl').innerHTML = ctlRow('View', 'cv') + ctlRow('Window', 'cw');
  o.chips(o.$('#cv'), ['Matrix', 'Rolling'], st.view, v => { st.view = v; draw(); });
  o.chips(o.$('#cw'), Object.keys(d.windows), st.w, v => { st.w = v; draw(); });
  const draw = () => {
    const box = o.$('#ch');
    if (st.view === 'Matrix') { const w = d.windows[st.w]; box.innerHTML = corrTable(d.names, w.matrix); o.$('#rd').textContent = `${w.sessions} sessions from ${o.fmtD(w.from)}.`; o.$('#leg').innerHTML = ''; }
    else { const R = d.rolling; const series = Object.entries(R.series).map(([n, v], k) => ({ name: n, v, dash: k % 2 === 1, opacity: k < 2 ? 1 : .6 })); o.lineChart(box, { x: R.dates, series, h: 260, ticks: [-1, -.5, 0, .5, 1], read: i => o.$('#rd').innerHTML = `${o.fmtD(R.dates[i])}, 3-month correlation with the S&P 500: ` + series.map(s => `${s.name} ${o.num(s.v[i])}`).join(', ') }); o.$('#leg').innerHTML = `<div class="legend">${series.map(s => `<span><i class="${s.dash ? 'ld' : 'l'}"></i>${s.name}</span>`).join('')}</div>`; }
  };
  draw(); o.onResize(draw);
  o.$('#tbl').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>With the S&P 500</th>${Object.keys(d.windows).map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${d.names.slice(1).map((n, i) => `<tr><td>${n}</td>${Object.values(d.windows).map(w => `<td>${o.num(w.matrix[0][i + 1])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const m = d.windows['3M']?.matrix; o.$('#side').innerHTML = m ? `<ul class="kpi">${d.names.slice(1).map((n, i) => `<li class="kpi__item"><span class="kpi__name">S&P 500 and ${n}</span><span class="kpi__level">${o.num(m[0][i + 1])}</span></li>`).join('')}</ul><p class="side-src">3 months of daily returns. ${d.source}, ${d.asof}.</p>` : '';
}

/* ================================================================== CALENDAR */
async function calendar() {
  const o = O(); const m = o.main();
  const d = await o.data('calendar.json').catch(() => null);
  if (!d) { m.innerHTML = o.head({ title: 'Calendar' }) + o.fail(); return; }
  const st = { w: 0, type: 'All', region: 'All', imp: 'All', tz: 'New York' };
  m.innerHTML = o.head({ title: 'Calendar', lede: 'Results of the 600 largest companies in the US, Europe and Asia, central bank decisions and US data releases, five weeks ahead. Times in New York and Paris.', meta: `Updated ${d.updated}.`, short: true }) +
    `<div class="col-full rv"><div class="ctl"><div class="ctl__row" id="cw"></div></div>
     <div class="two" style="max-width:900px">${ctlRow('Type', 'ct')}${ctlRow('Region', 'cg')}</div><div class="two" style="max-width:900px">${ctlRow('Importance', 'ci')}${ctlRow('Time zone', 'cz')}</div>
     <p class="page-meta" id="cnt"></p><div class="tbl-wrap"><table class="tbl" id="ctab"><thead><tr><th class="l">Time</th><th class="l">Event</th><th class="l">Region</th><th class="l">Importance</th><th class="l">Previous</th><th class="l">Actual</th></tr></thead><tbody></tbody></table></div>
     <section class="sec" style="margin-top:30px"><h2>Sources</h2><p class="lede">Earnings dates and EPS: Yahoo Finance, refreshed in rotation. Central bank meetings: each bank's published schedule. US releases: FRED release calendar (needs a free FRED API key in the repository secrets).</p></section></div>`;
  const wl = d.weeks.map((w, i) => [String(i), i === 0 ? `This week, ${o.fmtDS(w.start)} to ${o.fmtDS(w.end)}` : i === 1 ? `Next week, ${o.fmtDS(w.start)} to ${o.fmtDS(w.end)}` : `${o.fmtDS(w.start)} to ${o.fmtDS(w.end)}`]);
  o.chips(o.$('#cw'), wl, '0', v => { st.w = +v; draw(); });
  o.chips(o.$('#ct'), ['All', 'Macro', 'Central banks', 'Earnings'], 'All', v => { st.type = v; draw(); });
  o.chips(o.$('#cg'), ['All', 'US', 'Europe', 'Asia', 'Macro'], 'All', v => { st.region = v; draw(); });
  o.chips(o.$('#ci'), ['All', 'High'], 'All', v => { st.imp = v; draw(); });
  o.chips(o.$('#cz'), ['New York', 'Paris'], 'New York', v => { st.tz = v; draw(); });
  const tz = t => { if (st.tz === 'New York' || !/^\d/.test(t)) return t; const [hm, ap] = t.split(' '); let [H, M] = hm.split(':').map(Number); if (ap === 'pm' && H !== 12) H += 12; if (ap === 'am' && H === 12) H = 0; H = (H + 6) % 24; return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
  const draw = () => {
    const w = d.weeks[st.w];
    const ev = d.events.filter(e => e.date >= w.start && e.date <= w.end && (st.type === 'All' || e.type === st.type) && (st.region === 'All' || e.area === st.region || e.region === st.region) && (st.imp === 'All' || e.imp === st.imp));
    o.$('#cnt').textContent = `Showing ${ev.length} event${ev.length === 1 ? '' : 's'} this week`;
    let day = '', html = '';
    ev.forEach(e => {
      if (e.date !== day) { day = e.date; const dd = o.D(day); html += `<tr class="grp"><td colspan="6">${o.DAYS[dd.getDay()]} ${dd.getDate()} ${o.MONTHS[dd.getMonth()]}</td></tr>`; }
      const title = e.slug ? `<a href="${o.link('companies/' + e.slug + '/')}">${o.esc(e.title)}, ${e.t}</a>` : o.esc(e.title);
      const tags = e.type === 'Earnings' ? `<span class="tag">Quarterly results</span>` : `<span class="tag">${e.type}</span>`;
      const prev = o.isNum(e.prev) ? `EPS ${o.num(e.prev)}, a year earlier` : (o.isNum(e.est) ? `Estimate ${o.num(e.est)}` : '');
      const act = o.isNum(e.actual) ? `EPS ${o.num(e.actual)}${o.isNum(e.est) ? `<small>Estimate ${o.num(e.est)}</small>` : ''}${o.isNum(e.react) ? `<small>First session ${o.mv(e.react)}, ${e.bench} ${o.mv(e.breact)}</small>` : ''}` : (e.date < o.iso(new Date()) && e.type === 'Earnings' ? '<span class="muted">Figures pending</span>' : '');
      html += `<tr><td class="l">${tz(e.time)}</td><td class="l">${title}<small>${e.src}</small>${tags}</td><td class="l">${e.region}</td><td class="l">${e.imp === 'High' ? '<b style="font-weight:600">High</b>' : e.imp}</td><td class="l">${prev}</td><td class="l">${act}</td></tr>`;
    });
    o.$('#ctab tbody').innerHTML = html || `<tr><td colspan="6" class="l">${o.fail('No events match these filters.')}</td></tr>`;
  };
  draw();
}

/* ================================================================== WORLD */
async function world() {
  const o = O(); const m = o.main();
  const d = await o.data('world.json').catch(() => null);
  if (!d) { m.innerHTML = o.head({ title: 'World markets' }) + o.fail(); return; }
  let sel = ['USA', 'DEU', 'JPN'];
  m.innerHTML = o.head({ title: 'World markets', lede: 'Twenty-five markets on the same eight measures: how their stock markets and currencies have done, how volatile they are, what their governments pay to borrow, and how their economies are growing, pricing and hiring.', meta: `Yahoo Finance, OECD via FRED, World Bank. Updated ${d.updated}.` }) +
    `<div class="col-main rv"><div class="ctl"><div class="ctl__lab">Compare up to three</div><div class="ctl__row" id="cm"></div></div><div class="chart-box" id="radar"></div><div class="legend" id="rleg"></div>
     <section class="sec" style="margin-top:28px"><h2>Each market</h2><p class="lede">The index over the past year, rebased to 100.</p><div class="cards" id="mk" style="grid-template-columns:repeat(3,1fr)"></div></section>
     <section class="sec"><h2>Every figure</h2><div id="ftab"></div></section>
     <section class="sec"><h2>How to read it</h2><p class="lede">Each axis of the radar runs from the lowest figure among the 25 markets, at the centre, to the highest, at the edge. A larger shape is not better or worse: it simply sits higher on each measure.</p></section></div>
     <aside class="col-side rv"><h2 class="side-title">The scale</h2><ul class="kpi" id="scale"></ul><p class="side-src">Each axis runs from the lowest figure among the 25 markets, near the centre, to the highest, at the edge.</p></aside>`;
  const name = iso => d.markets.find(x => x.iso === iso)?.name || iso;
  o.$('#scale').innerHTML = d.axes.map(a => { const s = d.scale[a.k]; return s ? `<li class="kpi__item"><span class="kpi__name">${a.short}</span><span class="kpi__level" style="font-size:16px">${a.move ? o.mv(s.lo) : o.num(s.lo) + '%'} to ${a.move ? o.mv(s.hi) : o.num(s.hi) + '%'}</span><span class="kpi__chg">${name(s.lo_m)} to ${name(s.hi_m)}</span></li>` : ''; }).join('');
  const drawRadar = () => {
    const box = o.$('#radar'); box.innerHTML = ''; const w = Math.min(o.W(box), 560), hgt = w * .86, cx = w / 2, cy = hgt / 2, R = Math.min(cx, cy) - 60;
    const svg = o.svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt, style: `max-width:${w}px` }, box);
    const n = d.axes.length, ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
    [.25, .5, .75, 1].forEach(f => o.svgEl('circle', { cx, cy, r: R * f, fill: 'none', stroke: 'var(--chart-grid)' }, svg));
    d.axes.forEach((a, i) => { const x = cx + Math.cos(ang(i)) * R, y = cy + Math.sin(ang(i)) * R; o.svgEl('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--chart-grid)' }, svg); const t = o.svgEl('text', { x: cx + Math.cos(ang(i)) * (R + 18), y: cy + Math.sin(ang(i)) * (R + 18) + 4, class: 'ax', 'text-anchor': Math.abs(Math.cos(ang(i))) < .2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end' }, svg); t.textContent = a.short; });
    sel.forEach((iso, k) => {
      const f = d.figures[iso] || {};
      const pts = d.axes.map((a, i) => { const s = d.scale[a.k]; const v = f[a.k]?.v; const t = o.isNum(v) && s ? (v - s.lo) / (s.hi - s.lo || 1) : null; return t == null ? null : [cx + Math.cos(ang(i)) * R * (.08 + .92 * t), cy + Math.sin(ang(i)) * R * (.08 + .92 * t), a, v]; });
      const valid = pts.filter(Boolean);
      o.svgEl('path', { d: valid.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join('') + 'Z', fill: k === 0 ? 'var(--band)' : 'none', stroke: 'var(--ink)', 'stroke-width': k === 0 ? 2 : 1.4, 'stroke-dasharray': ['none', '5 3', '1.5 3'][k] }, svg);
      valid.forEach(p => { const c = o.svgEl('circle', { cx: p[0], cy: p[1], r: 3.5, fill: 'var(--ink)', style: 'cursor:pointer' }, svg); o.bindTip(c, `<b>${name(iso)}</b><br>${p[2].label}: ${o.num(p[3])}%`); });
    });
    o.$('#rleg').innerHTML = sel.map((iso, k) => `<span><i class="${k ? 'ld' : 'l'}" style="${k === 2 ? 'border-top-style:dotted' : ''}"></i>${name(iso)}</span>`).join('');
  };
  const cm = o.$('#cm');
  cm.innerHTML = d.markets.map(x => `<button class="chip chip--check${sel.includes(x.iso) ? ' on' : ''}" data-v="${x.iso}">${x.name}</button>`).join('');
  o.$$('button', cm).forEach(b => b.onclick = () => { const v = b.dataset.v; if (sel.includes(v)) { if (sel.length > 1) sel = sel.filter(x => x !== v); } else { sel.push(v); if (sel.length > 3) sel.shift(); } o.$$('button', cm).forEach(x => x.classList.toggle('on', sel.includes(x.dataset.v))); drawRadar(); });
  drawRadar(); o.onResize(drawRadar);
  o.$('#mk').innerHTML = d.markets.map(x => { const f = d.figures[x.iso] || {}; return `<div class="card" data-iso="${x.iso}"><h3>${x.name}</h3><p>${x.index}</p><div class="bignum" style="font-size:20px">${o.mv(f.ytd?.v)} <span class="muted" style="font-size:13px">this year</span></div><div class="sp"></div><div class="meta">${f.ytd?.when || ''}</div></div>`; }).join('');
  requestAnimationFrame(() => o.$$('#mk .card').forEach(c => { const l = d.lines[c.dataset.iso]; if (l) o.spark(o.$('.sp', c), l, { h: 56 }); }));
  o.$('#ftab').innerHTML = `<div class="tbl-wrap"><table class="tbl" id="wt"><thead><tr><th data-k="name" data-dir="1">Market</th>${d.axes.map(a => `<th data-k="${a.k}">${a.short}</th>`).join('')}</tr></thead><tbody></tbody></table></div><p class="src">Hover a figure for its date and source.</p>`;
  const rows = d.markets.map(x => Object.assign({ name: x.name, iso: x.iso }, Object.fromEntries(d.axes.map(a => [a.k, d.figures[x.iso]?.[a.k]?.v ?? null]))));
  o.sortableTable(o.$('#wt'), rows, null, r => `<tr><td>${r.name}</td>${d.axes.map(a => { const f = d.figures[r.iso]?.[a.k]; return `<td title="${f ? f.when + ', ' + f.src : ''}">${f ? (a.move ? o.mv(f.v) : o.num(f.v) + '%') : '–'}</td>`; }).join('')}</tr>`);
}

/* ================================================================== FX */
async function fx() {
  const o = O(); const m = o.main();
  const [d, notes] = await Promise.all([o.data('fx.json').catch(() => null), o.data('fxnotes/index.json').catch(() => [])]);
  if (!d) { m.innerHTML = o.head({ title: 'FX' }) + o.fail(); return; }
  const last = notes[0];
  m.innerHTML = o.head({ title: 'FX', lede: 'The dollar, the G10 majors and the main emerging-market currencies: a daily analysis after the US close, generated from the figures, and the latest moves.', meta: `Yahoo Finance, OECD via FRED. Updated ${d.updated}.` }) +
    `<div class="col-main rv">${last ? `<section class="sec"><h2>Latest analysis</h2><a class="box" style="display:block" href="${o.link('fx/' + last.date + '/')}"><h3 style="font-size:20px;letter-spacing:-.01em">${o.esc(last.title)}</h3><p class="lede">${o.esc(last.lede)}</p><p class="page-meta">${last.human} · Read the analysis →</p></a></section>` : ''}
     <section class="sec"><h2>Majors and emerging markets</h2><div id="ptab"></div></section>
     <section class="sec"><h2>Charts</h2><h3 style="margin-top:18px">The dollar index</h3><div class="ctl__row" id="dr" style="margin-top:12px"></div><div class="chart-box" id="dxy"></div><p class="readout" id="dxr"></p>
       <h3 style="margin-top:30px">Pairs</h3><div class="ctl"><select class="inp" id="psel"></select></div><div class="chart-box" id="pch"></div><p class="readout" id="pr"></p>
       <h3 style="margin-top:30px">Moves</h3><p class="lede" style="font-size:14px">Each currency against the dollar: positive means the currency gained.</p><div class="ctl__row" id="mr" style="margin-top:12px"></div><div class="chart-box" id="mvs"></div>
       <h3 style="margin-top:30px">Moves and rate differentials</h3><p class="lede" style="font-size:14px">Three-month rate of each currency less the US rate, against the currency's move over a month.</p><div class="chart-box" id="sc"></div></section>
     <section class="sec"><h2>Every analysis</h2><div id="all"></div></section></div>
     <aside class="col-side rv"><h2 class="side-title">The dollar</h2><ul class="kpi" id="side"></ul><p class="side-src">Dollar index (DXY), ICE via Yahoo Finance.</p></aside>`;
  const P = Object.fromEntries(d.pairs.map(p => [p.key, p]));
  const row = p => { const x = d.moves[p.key]; return `<tr><td>${p.name}<small>${p.quote}</small></td><td>${o.num(x.last, p.dec)}</td><td>${o.mv(x.d1)}</td><td>${o.mv(x.w1)}</td><td>${o.mv(x.m1)}</td><td>${o.mv(x.ytd)}</td></tr>`; };
  const grp = (g, t) => `<tr class="grp"><td colspan="6">${t}</td></tr>` + d.pairs.filter(p => p.group === g).map(row).join('');
  o.$('#ptab').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pair</th><th>Last</th><th>Day</th><th>Week</th><th>Month</th><th>Year to date</th></tr></thead><tbody>${grp('dollar', 'The dollar')}${grp('major', 'G10 majors')}${grp('em', 'Emerging markets')}</tbody></table></div><p class="src">Changes in the quoted pair. For USD/XXX pairs, a rise means a stronger dollar.</p>`;
  const H = d.hist;
  const dx = d.moves.dxy;
  o.$('#side').innerHTML = `<li class="kpi__item"><span class="kpi__name">Dollar index</span><span class="kpi__level">${o.num(dx.last)}</span><span class="kpi__chg">${o.mv(dx.d1)} on the day</span></li><li class="kpi__item"><span class="kpi__name">Week</span><span class="kpi__level">${o.mv(dx.w1)}</span></li><li class="kpi__item"><span class="kpi__name">Month</span><span class="kpi__level">${o.mv(dx.m1)}</span></li><li class="kpi__item"><span class="kpi__name">Year to date</span><span class="kpi__level">${o.mv(dx.ytd)}</span></li>${d.rates.USD ? `<li class="kpi__item"><span class="kpi__name">US 3-month rate</span><span class="kpi__level">${o.num(d.rates.USD.rate)}%</span><span class="kpi__chg">${d.rates.USD.month}</span></li>` : ''}`;
  let rg = '1Y', pk = 'eurusd', mr = 'm1';
  const drawDxy = () => { const a = sliceFrom(H.dates, rangeStart(H.dates, rg)); const x = H.dates.slice(a), v = H.series.dxy.slice(a); o.lineChart(o.$('#dxy'), { x, series: [{ v, width: 1.6 }], h: 220, read: i => o.$('#dxr').innerHTML = `${o.fmtD(x[i])}: ${o.num(v[i])}` }); };
  const drawPair = () => { const p = P[pk]; const x = H.dates, v = H.series[pk]; o.lineChart(o.$('#pch'), { x, series: [{ v }], h: 220, read: i => o.$('#pr').innerHTML = `${o.fmtD(x[i])}: ${p.name} ${o.num(v[i], p.dec)}` }); };
  const drawMoves = () => { const rows = d.pairs.filter(p => p.ccy).map(p => { const v = d.moves[p.key][mr]; return [p.ccy, o.isNum(v) ? (p.inv ? ((1 / (1 + v / 100)) - 1) * 100 : v) : null]; }).sort((a, b) => (b[1] ?? -1e9) - (a[1] ?? -1e9)); o.hbars(o.$('#mvs'), rows, { labelW: 60 }); };
  const drawScatter = () => {
    const box = o.$('#sc'); box.innerHTML = ''; const us = d.rates.USD?.rate; if (!o.isNum(us)) { box.innerHTML = o.fail(); return; }
    const pts = d.pairs.filter(p => p.ccy && d.rates[p.ccy]).map(p => { const v = d.moves[p.key].m1; return { c: p.ccy, x: d.rates[p.ccy].rate - us, y: o.isNum(v) ? (p.inv ? ((1 / (1 + v / 100)) - 1) * 100 : v) : null }; }).filter(p => o.isNum(p.y));
    const w = o.W(box), hgt = 260, pad = 36; const svg = o.svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const tx = o.niceTicks(Math.min(...xs, 0), Math.max(...xs, 0), 4), ty = o.niceTicks(Math.min(...ys, 0), Math.max(...ys, 0), 4);
    const X = v => pad + (v - tx[0]) / (tx[tx.length - 1] - tx[0]) * (w - pad * 2), Y = v => 10 + (1 - (v - ty[0]) / (ty[ty.length - 1] - ty[0])) * (hgt - 40);
    ty.forEach(t => { o.svgEl('line', { x1: pad, x2: w - pad, y1: Y(t), y2: Y(t), class: t === 0 ? 'zero-line' : 'grid-line' }, svg); const l = o.svgEl('text', { x: w - pad + 6, y: Y(t) + 4, class: 'ax' }, svg); l.textContent = t + '%'; });
    tx.forEach(t => { o.svgEl('line', { x1: X(t), x2: X(t), y1: 10, y2: hgt - 30, class: t === 0 ? 'zero-line' : 'grid-line' }, svg); const l = o.svgEl('text', { x: X(t), y: hgt - 12, class: 'ax', 'text-anchor': 'middle' }, svg); l.textContent = (t > 0 ? '+' : '') + t + 'pp'; });
    pts.forEach(p => { const c = o.svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: 5, fill: 'var(--ink)' }, svg); const l = o.svgEl('text', { x: X(p.x) + 8, y: Y(p.y) + 4, class: 'ax', fill: 'var(--ink)' }, svg); l.textContent = p.c; o.bindTip(c, `${p.c}: rate gap ${o.sgn(p.x)}pp, 1 month ${o.pct(p.y)}`); });
  };
  o.chips(o.$('#dr'), ['1M', '3M', '6M', '1Y', '2Y'], rg, v => { rg = v; drawDxy(); });
  o.$('#psel').innerHTML = d.pairs.filter(p => p.key !== 'dxy').map(p => `<option value="${p.key}">${p.name}</option>`).join(''); o.$('#psel').onchange = e => { pk = e.target.value; drawPair(); };
  o.chips(o.$('#mr'), [['d1', 'Day'], ['w1', 'Week'], ['m1', 'Month'], ['ytd', 'Year to date']], mr, v => { mr = v; drawMoves(); });
  const all = () => { drawDxy(); drawPair(); drawMoves(); drawScatter(); }; all(); o.onResize(all);
  o.$('#all').innerHTML = noteList(notes, n => 'fx/' + n.date + '/');
}

function noteList(notes, url) {
  const o = O(); if (!notes.length) return o.fail('No analysis yet.');
  let mon = '', html = '';
  notes.forEach(n => { const mm = o.fmtM(n.date); if (mm !== mon) { mon = mm; html += `<div class="month-h">${(['January','February','March','April','May','June','July','August','September','October','November','December'])[o.D(n.date).getMonth()]} ${o.D(n.date).getFullYear()}</div><div class="list" style="margin-top:0;border-top:0">`; }
    html += `<a href="${o.link(url(n))}"><span class="t">${o.esc(n.title)}</span><span class="m">${o.fmtDS(n.date)}</span></a>`;
    const next = notes[notes.indexOf(n) + 1]; if (!next || o.fmtM(next.date) !== mon) html += '</div>'; });
  return html;
}

async function fxnote(date) {
  const o = O(); const m = o.main();
  const n = await o.data(`fxnotes/${date}.json`).catch(() => null);
  if (!n) { m.innerHTML = o.head({ title: 'FX analysis' }) + o.fail(); return; }
  m.innerHTML = o.head({ crumbs: [['fx/', 'FX'], [null, 'Analysis']], title: o.esc(n.title), lede: o.esc(n.lede), meta: `${n.day} ${n.human}. Generated from Yahoo Finance and FRED figures after the US close.` }) +
    `<div class="col-main rv"><section class="sec prose">${n.paras.map(p => `<p>${o.esc(p)}</p>`).join('')}</section>
     <section class="sec"><h2>Every pair</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pair</th><th>Last</th><th>Day</th><th>z-score</th><th>Week</th><th>Month</th><th>Year to date</th></tr></thead><tbody>${n.table.map(r => `<tr><td>${r.name}</td><td>${o.num(r.last, 4)}</td><td>${o.mv(r.d1)}</td><td>${o.num(r.z)}</td><td>${o.mv(r.w1)}</td><td>${o.mv(r.m1)}</td><td>${o.mv(r.ytd)}</td></tr>`).join('')}</tbody></table></div><p class="src">z-score: the day's move against the average and spread of daily moves over the past year.</p></section>
     ${n.diffs?.length ? `<section class="sec"><h2>Rate differentials</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Currency</th><th>US rate less foreign rate</th><th>Pair, 1 month</th></tr></thead><tbody>${n.diffs.map(x => `<tr><td>${x.ccy}</td><td>${o.sgn(x.diff)}pp</td><td>${o.mv(x.m1)}</td></tr>`).join('')}</tbody></table></div><p class="src">Three-month interbank rates, OECD via FRED, latest month.</p></section>` : ''}
     <p class="disclaimer">Generated automatically from the figures. For information only. Not investment advice.</p></div>`;
}

/* ================================================================== COMPANIES */
async function companies() {
  const o = O(); const m = o.main();
  const d = await o.data('companies/index.json').catch(() => null);
  if (!d) { m.innerHTML = o.head({ title: 'Companies' }) + o.fail(); return; }
  const st = { reg: 'All', sec: 'All', q: '', n: 100 };
  m.innerHTML = o.head({ title: 'Companies', lede: 'The 200 largest companies in the US, in Europe and across the main Asian markets, ranked by market value in dollars. Each has a page with its valuation, its peers, where its revenue goes and how the shares have done against the market.', meta: `Closes of ${d.asof}. Updated ${d.updated}.` }) +
    `<div class="col-full rv"><div class="ctl"><input class="inp" id="q" placeholder="Search a company or ticker" style="width:100%;max-width:420px;height:46px"></div>
     <div class="ctl"><div class="ctl__row" id="cr"></div></div><div class="ctl"><div class="ctl__row" id="cs"></div></div>
     <p class="page-meta" id="cnt"></p><div class="tbl-wrap"><table class="tbl" id="ct"><thead><tr><th data-k="rank" data-dir="1">Rank</th><th class="l" data-k="n" data-dir="1">Company</th><th class="l" data-k="sec" data-dir="1">Sector</th><th data-k="close">Close</th><th data-k="day">Day</th><th data-k="mcap">Market value</th><th data-k="pe">P/E</th></tr></thead><tbody></tbody></table></div>
     <div style="margin-top:18px"><button class="btn btn--ghost btn--sm" id="more">Show more</button></div></div>`;
  const regs = ['All', 'US', 'Europe', 'Asia'];
  const secs = ['All', ...[...new Set(d.rows.map(r => r.sec))].sort((a, b) => d.rows.filter(r => r.sec === b).length - d.rows.filter(r => r.sec === a).length)];
  o.chips(o.$('#cr'), regs.map(r => [r, `${r === 'All' ? 'All markets' : r} <small>${r === 'All' ? d.rows.length : d.rows.filter(x => x.reg === r).length}</small>`]), 'All', v => { st.reg = v; st.n = 100; draw(); });
  o.chips(o.$('#cs'), secs.map(s => [s, `${s === 'All' ? 'All sectors' : s} <small>${s === 'All' ? d.rows.length : d.rows.filter(x => x.sec === s).length}</small>`]), 'All', v => { st.sec = v; st.n = 100; draw(); });
  o.$('#q').oninput = e => { st.q = e.target.value.trim().toLowerCase(); st.n = 100; draw(); };
  o.$('#more').onclick = () => { st.n += 100; draw(); };
  let rows = [];
  const render = r => `<tr><td>${r.rank}</td><td class="l"><a href="${o.link('companies/' + r.slug + '/')}">${o.esc(r.n)}</a><small>${r.t}</small></td><td class="l">${r.sec}</td><td>${o.ccySym(r.cur)}${o.num(r.close)}</td><td>${o.mv(r.day)}</td><td>${o.big(r.mcap)}</td><td>${o.isNum(r.pe) && r.pe > 0 && r.pe < 1000 ? o.num(r.pe, 1) + 'x' : '–'}</td></tr>`;
  let redraw;
  const draw = () => {
    const all = d.rows.filter(r => (st.reg === 'All' || r.reg === st.reg) && (st.sec === 'All' || r.sec === st.sec) && (!st.q || r.n.toLowerCase().includes(st.q) || r.t.toLowerCase().startsWith(st.q)));
    rows.length = 0; rows.push(...all.slice(0, st.n));
    o.$('#cnt').textContent = `Showing ${Math.min(st.n, all.length)} of ${all.length} companies`;
    o.$('#more').style.display = all.length > st.n ? '' : 'none';
    redraw ? redraw() : (redraw = o.sortableTable(o.$('#ct'), rows, null, render));
  };
  draw();
}

/* ================================================================== COMPANY PAGE */
async function company(slug) {
  const o = O(); const m = o.main();
  const c = await o.data(`companies/${slug}.json`).catch(() => null);
  if (!c) { m.innerHTML = o.head({ title: slug.toUpperCase() }) + o.fail(); return; }
  const cs = o.ccySym(c.cur), fs = o.ccySym(c.fcur);
  const chg = o.isNum(c.prev) ? c.price - c.prev : null, chgp = o.isNum(c.prev) ? (c.price / c.prev - 1) * 100 : null;
  const y = c.years || {}; const L = (y.labels || []).length - 1;
  const lastY = y.labels?.[L] || '';
  const k = (n, l, s) => `<li class="kpi__item"><span class="kpi__name">${n}</span><span class="kpi__level">${l}</span><span class="kpi__chg">${s || ''}</span></li>`;
  const cagr = c.dcf?.cagr;
  m.className = 'wrap grid12';
  m.innerHTML = `<header class="page-head rv co-head" style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;max-width:none">
    <div><div class="crumbs"><a href="${o.link('companies/')}">Companies</a> / ${c.sector}</div><h1>${o.esc(c.name)}</h1>
    <div style="display:flex;align-items:baseline;gap:14px;margin-top:14px;flex-wrap:wrap"><span class="tnum" style="font-size:30.72px;font-weight:540;letter-spacing:-.03em">${cs}${o.num(c.price)}</span><span style="font-size:16px;color:var(--ink-2)">${o.mv(chg, 2, '')} (${o.mv(chgp)}) on the day</span></div>
    <div class="page-meta">Close ${o.fmtD(c.date)}. ${c.t}${c.exchange ? ', ' + c.exchange : ''}. Yahoo Finance.</div>
    <p class="page-lede">${c.sector}${c.industry ? ', ' + c.industry : ''}.${o.isNum(y.rev?.[L]) ? ` Revenue of ${fs}${o.num(y.rev[L], 1)}bn in the year to ${lastY}${o.isNum(c.revg) ? `, ${c.revg >= 0 ? 'up' : 'down'} ${o.num(Math.abs(c.revg), 1)}%` : ''}${o.isNum(c.opm) ? `, with an operating margin of ${o.num(c.opm, 1)}%` : ''}.` : ''}</p>
    <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap"><button class="btn" id="watch">Add to watchlist</button><a class="btn btn--ghost" href="${o.link('calendar/')}">Results calendar</a></div></div>
    <div class="co-tick" style="font-size:clamp(48px,7vw,96px);font-weight:640;letter-spacing:-.05em;line-height:1;text-align:right">${c.t.split('.')[0].slice(0, 6)}</div></header>
  <aside class="col-side rv" style="grid-row:2/span 2"><h2 class="side-title">Key figures</h2><ul class="kpi">
    ${k('Market value', o.big(c.mcap_usd), `Rank ${c.rank} of 600, in dollars`)}
    ${k('P/E, last 12 months', o.isNum(c.pe) && c.pe > 0 ? o.num(c.pe, 1) + 'x' : '–', o.isNum(c.eps) ? `EPS ${cs}${o.num(c.eps)}` : '')}
    ${k('Revenue growth', o.mv(c.revg, 1), `Year to ${lastY}`)}
    ${k('Operating margin', o.isNum(c.opm) ? o.num(c.opm, 1) + '%' : '–', 'Last 12 months')}
    ${k('Free cash flow', o.isNum(c.fcf) ? `${fs}${o.num(c.fcf, 1)}bn` : '–', o.isNum(c.capex) ? `After ${fs}${o.num(Math.abs(c.capex), 1)}bn capex` : '')}
    ${k('Net debt', o.isNum(c.dcf?.nd) ? `${fs}${o.num(c.dcf.nd, 1)}bn` : '–', `${fs}${o.num(c.debt, 1)}bn debt, ${fs}${o.num(c.cash, 1)}bn cash`)}
    ${k('Dividend yield', o.isNum(c.dy) ? o.num(c.dy) + '%' : '–', o.isNum(c.divrate) ? `${cs}${o.num(c.divrate)} a share` : '')}
    ${k('52-week range', `${cs}${o.num(c.lo52, 0)}–${o.num(c.hi52, 0)}`, `Close ${cs}${o.num(c.price)}`)}
  </ul><p class="side-src">Yahoo Finance: annual report for the year to ${lastY}, close of ${o.fmtD(c.date)}. Fundamentals refreshed ${c.fetched ? o.fmtD(c.fetched) : 'in rotation'}.</p></aside>
  <div class="col-main" id="cm"></div>`;
  const cm = o.$('#cm'); const S = (id, h2, lede, inner, src) => `<section class="sec rv" id="s-${id}"><h2>${h2}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}${inner}${src ? `<p class="src">${src}</p>` : ''}</section>`;
  cm.innerHTML =
    S('peers', 'Against its peers', `${o.esc(c.name)} (filled) against the other ${Math.max(0, (c.peers || []).length - 1)} ${c.sector.toLowerCase()} companies in its region. Tap or hover a dot to read it.`, '<div class="chart-box" id="peers"></div><p class="note">Dashed tick: the median. A dashed dot sits beyond the axis, which spans the middle 90% of values.</p>', 'Yahoo Finance. P/E on the last four quarters; revenue growth and operating margin on the latest figures; debt to equity at the last balance sheet.') +
    S('dcf', 'Valuation', 'A ten-year discounted cash flow model on the last reported free cash flow. Every assumption is on the page: move it and the value follows.', dcfHtml(), `Base: free cash flow of ${fs}${o.num(c.dcf?.fcf, 1)}bn in the year to ${lastY}, net debt of ${fs}${o.num(c.dcf?.nd, 1)}bn, ${o.num(c.dcf?.sh, 2)}bn shares. Growth fades in a straight line from year 6 to year 10. An Opsilon Markets model, not a recommendation.`) +
    S('pe', 'Valuation over time', 'The price to earnings ratio at each month end, on the last fiscal year’s diluted earnings per share known at the time, against its average over the period.', '<div class="chart-box" id="pe"></div><div class="legend"><span><i class="l"></i>P/E</span><span><i class="ld"></i>Average</span></div><p class="readout" id="pe-r"></p>', 'Month-end closes and annual reports, via Yahoo Finance.') +
    S('comp', 'Where revenue goes', c.comp ? `Of every 100 of revenue in the year to ${lastY}, ${o.esc(c.name)} kept ${Math.round(c.comp.ni / c.comp.rev * 100)} as net income.` : '', '<div class="chart-box" id="comp"></div><table class="tbl" id="compT" style="font-size:13px"></table>', `Annual report for the year to ${lastY}, via Yahoo Finance.`) +
    S('rp', `Revenue and profit, ${(y.labels || []).length} years`, `Revenue and net income each fiscal year, in billions of ${c.fcur}. Tap or hover a year to read it.`, '<div class="chart-box" id="rp"></div><div class="legend"><span><i class="sw-out"></i>Revenue</span><span><i class="sw-fill"></i>Net income</span></div><p class="readout" id="rp-r"></p>', 'Annual reports, via Yahoo Finance.') +
    S('q', 'Last 5 quarters', `Revenue in billions of ${c.fcur} and diluted earnings per share, quarter by quarter.`, '<div class="two" style="margin-top:24px"><div><div style="font-size:14px;font-weight:550">Revenue</div><div class="chart-box" id="qr" style="margin-top:12px"></div></div><div><div style="font-size:14px;font-weight:550">Earnings per share</div><div class="chart-box" id="qe" style="margin-top:12px"></div></div></div><p class="readout" id="q-r"></p>', 'Quarterly reports, via Yahoo Finance. Quarters are named by the month they end.') +
    S('cf', 'Cash flow and investment', `Cash from operations, what went into capital spending, and the free cash flow left, in billions of ${c.fcur}.`, '<div class="chart-box" id="cf"></div><div class="legend"><span><i class="sw-out"></i>Cash from operations</span><span><i class="sw-down"></i>Capital spending</span><span><i class="sw-fill"></i>Free cash flow</span></div><p class="readout" id="cf-r"></p>', 'Annual reports, via Yahoo Finance.') +
    S('bs', 'Balance sheet', `Cash and short-term investments, debt and shareholders’ equity at each fiscal year end, in billions of ${c.fcur}.`, '<div class="chart-box" id="bs"></div><div class="legend"><span><i class="sw-out"></i>Cash and investments</span><span><i class="sw-fill"></i>Debt</span><span><i class="sw-dash"></i>Equity</span></div><p class="readout" id="bs-r"></p>', 'Annual reports, via Yahoo Finance.') +
    S('sh', 'Returns to shareholders', `Dividends paid and shares bought back each fiscal year, against net income, in billions of ${c.fcur}.`, '<div class="chart-box" id="sh"></div><div class="legend"><span><i class="sw-fill"></i>Dividends</span><span><i class="sw-out"></i>Buybacks</span><span><i class="l"></i>Net income</span></div><p class="readout" id="sh-r"></p>', 'Annual reports, via Yahoo Finance.') +
    S('ret', 'Share price returns', `Price change over each period to the close of ${o.fmtD(c.date)}, without dividends.`, `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>1 month</th><th>3 months</th><th>Year to date</th><th>1 year</th></tr></thead><tbody>${(c.ret || []).map(([n, v]) => `<tr><td>${o.esc(n)}</td>${(v || []).map(x => `<td>${o.mv(x, 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, 'Yahoo Finance daily closes, in local currency. The sector average is the simple average of its peers.') +
    S('mkt', 'Against the market', `${o.esc(c.name)} and the ${c.bench.name} over the past year, both rebased to 100, each in its own currency.`, `<div class="chart-box" id="mkt"></div><div class="legend"><span><i class="l"></i>${o.esc(c.name)}</span><span><i class="ld"></i>${c.bench.name}</span></div><p class="readout" id="mkt-r"></p>`, `Yahoo Finance, daily closes to ${o.fmtD(c.date)}.`) +
    S('risk', 'Risk', 'How much the shares move, and how far they have fallen from their high over the past year.', '<div class="kstrip" id="rk"></div><div class="chart-box" id="dd"></div><p class="readout" id="dd-r"></p>', `Yahoo Finance daily closes. Beta from daily returns against the ${c.bench.name}.`) +
    S('news', 'News', `The latest headlines on ${o.esc(c.name)}. Each opens on its publisher’s site.`, `<div class="list">${(c.news || []).map(n => `<a href="${o.esc(n.u || '#')}" target="_blank" rel="noopener"><span class="t">${o.esc(n.t)}</span><span class="m">${o.esc(n.p)}${n.d ? ' · ' + ago(n.d) : ''} ${o.ARROW}</span></a>`).join('') || '<div><span class="muted">No recent headlines.</span></div>'}</div>`, 'Yahoo Finance company news, refreshed with the fundamentals. Opsilon Markets does not write or check these headlines.') +
    S('an', 'What analysts say', c.recs ? `The recommendations of the ${c.recs.reduce((a, r) => a + r[1], 0)} analysts who cover ${o.esc(c.name)}.` : 'No analyst coverage reported.', c.recs ? recoHtml(c.recs) : '', 'Yahoo Finance recommendation trends. Not a recommendation from Opsilon Markets.') +
    S('ahead', 'Ahead', c.earnings?.next ? `Next results on ${o.fmtD(c.earnings.next)}${c.earnings.time ? ', ' + c.earnings.time.toLowerCase() : ''}${o.isNum(c.earnings.est) ? `. Analysts expect EPS of ${cs}${o.num(c.earnings.est)}` : ''}.` : 'No results date in the calendar yet. It appears here once the company or Yahoo Finance posts one.', '') +
    '<p class="disclaimer">For information only. Not investment advice.</p>';

  const wb = o.$('#watch'); let wl = []; try { wl = JSON.parse(localStorage.getItem('ops-watch') || '[]'); } catch (e) {}
  const setW = () => { const on = wl.includes(slug); wb.textContent = on ? 'In your watchlist ✓' : 'Add to watchlist'; wb.className = on ? 'btn btn--ghost' : 'btn'; };
  wb.onclick = () => { wl = wl.includes(slug) ? wl.filter(x => x !== slug) : [...wl, slug]; try { localStorage.setItem('ops-watch', JSON.stringify(wl)); } catch (e) {} setW(); }; setW();

  const draws = [];
  const add = f => { draws.push(f); f(); };
  add(() => drawPeers(c));
  setupDcf(c, add);
  add(() => { const pe = c.pe_hist || []; if (!pe.length) { o.$('#pe').innerHTML = o.fail('Not enough history.'); return; } const v = pe.map(p => p[1]); const avg = v.reduce((a, b) => a + b, 0) / v.length; o.lineChart(o.$('#pe'), { x: pe.map(p => p[0]), series: [{ v }, { v: v.map(() => avg), dash: true }], h: 180, xfmt: o.fmtM, fmtY: t => t + 'x', read: i => o.$('#pe-r').innerHTML = `${o.fmtM(pe[i][0])}: P/E ${o.num(v[i], 1)}x, average ${o.num(avg, 1)}x` }); });
  add(() => drawComp(c));
  if (y.labels?.length) {
    add(() => o.barChart(o.$('#rp'), { cats: y.labels, series: [{ type: 'out', v: y.rev || [] }, { type: 'fill', v: y.ni || [] }], fmtY: t => fs + t, read: i => { const g = i && y.rev?.[i - 1] ? (y.rev[i] / y.rev[i - 1] - 1) * 100 : null; o.$('#rp-r').innerHTML = `${y.labels[i]}: Revenue ${fs}${o.num(y.rev?.[i], 1)}bn, Net income ${fs}${o.num(y.ni?.[i], 1)}bn${o.isNum(y.ni?.[i]) && y.rev?.[i] ? `, net margin ${o.num(y.ni[i] / y.rev[i] * 100, 1)}%` : ''}.${o.isNum(g) ? ` Revenue ${o.mv(g, 1)} on the year before` : ''}`; } }));
    add(() => o.barChart(o.$('#cf'), { cats: y.labels, series: [{ type: 'out', v: y.ocf || [] }, { type: 'down', v: y.capex || [] }, { type: 'fill', v: y.fcf || [] }], fmtY: t => (t < 0 ? o.MIN : '') + fs + Math.abs(t), read: i => o.$('#cf-r').innerHTML = `${y.labels[i]}: Cash from operations ${fs}${o.num(y.ocf?.[i], 1)}bn, Capital spending ${o.num(y.capex?.[i], 1)}bn, Free cash flow ${fs}${o.num(y.fcf?.[i], 1)}bn` }));
    add(() => o.barChart(o.$('#bs'), { cats: y.labels, series: [{ type: 'out', v: y.cash || [] }, { type: 'fill', v: y.debt || [] }, { type: 'dash', v: y.equity || [] }], fmtY: t => fs + t, h: 180, read: i => o.$('#bs-r').innerHTML = `${y.labels[i]}: Cash and investments ${fs}${o.num(y.cash?.[i], 1)}bn, Debt ${fs}${o.num(y.debt?.[i], 1)}bn, Equity ${fs}${o.num(y.equity?.[i], 1)}bn` }));
    add(() => o.barChart(o.$('#sh'), { cats: y.labels, series: [{ type: 'fill', v: y.div || [] }, { type: 'out', v: y.buy || [] }, { type: 'line', v: y.ni || [] }], fmtY: t => fs + t, h: 180, read: i => { const po = ((y.div?.[i] || 0) + (y.buy?.[i] || 0)) / (y.ni?.[i] || NaN) * 100; o.$('#sh-r').innerHTML = `${y.labels[i]}: Dividends ${fs}${o.num(y.div?.[i], 1)}bn, Buybacks ${fs}${o.num(y.buy?.[i], 1)}bn, Net income ${fs}${o.num(y.ni?.[i], 1)}bn.${o.isNum(po) ? ` Paid out ${Math.round(po)}% of net income` : ''}`; } }));
  } else ['rp', 'cf', 'bs', 'sh'].forEach(id => o.$('#' + id).innerHTML = o.fail('Annual figures not available yet.'));
  if (c.quarters?.labels?.length) {
    const Q = c.quarters; let lock = false, A, B;
    const rd = i => o.$('#q-r').innerHTML = `${Q.labels[i]}: Revenue ${fs}${o.num(Q.rev[i], 1)}bn, EPS ${fs}${o.num(Q.eps[i])}.` + (i === Q.labels.length - 1 && o.isNum(Q.yoy) ? ` Revenue ${o.mv(Q.yoy, 1)} on a year earlier` : '');
    const short = l => l.replace(' 20', ' ’');
    add(() => { A = o.barChart(o.$('#qr'), { cats: Q.labels, catFmt: short, series: [{ type: 'out', v: Q.rev }], h: 170, fill: .82, fmtY: t => fs + t, read: i => { rd(i); if (!lock && B) { lock = true; B(i); lock = false; } } });
      B = o.barChart(o.$('#qe'), { cats: Q.labels, catFmt: short, series: [{ type: 'fill', v: Q.eps }], h: 170, fill: .82, fmtY: t => fs + t, read: i => { rd(i); if (!lock && A) { lock = true; A(i); lock = false; } } }); });
  }
  add(() => { const hs = c.hist, bm = c.bench; if (!hs?.values?.length) return; const bmap = Object.fromEntries(bm.dates.map((d, i) => [d, bm.values[i]])); let lastB = null; const bv = hs.dates.map(d => (lastB = bmap[d] ?? lastB)); const a0 = hs.values[0], b0 = bv.find(o.isNum); const a = hs.values.map(v => v / a0 * 100), b = bv.map(v => o.isNum(v) ? v / b0 * 100 : null);
    o.lineChart(o.$('#mkt'), { x: hs.dates, series: [{ v: b, dash: true }, { v: a }], base: 100, h: 200, read: i => o.$('#mkt-r').innerHTML = `${o.fmtD(hs.dates[i])}: ${o.esc(c.name)} ${cs}${o.num(hs.values[i])} (${o.mv(a[i] - 100, 1)}), ${bm.name} ${o.num(bv[i], 0)} (${o.mv(b[i] - 100, 1)})` }); });
  add(() => { const v = c.hist?.values || []; if (!v.length) return; let mx = -Infinity, mxI = 0; const dd = [], pk = []; v.forEach((p, i) => { if (p >= mx) { mx = p; mxI = i; } dd.push((p / mx - 1) * 100); pk.push(mxI); }); let mi = 0; dd.forEach((x, i) => { if (x < dd[mi]) mi = i; });
    o.$('#rk').innerHTML = `<div><span class="kpi__name">Volatility, 1 year</span><div class="kpi__level">${o.num(c.risk.vol, 0)}%</div><div class="kpi__chg">Annualised daily moves; the ${c.bench.name} moved ${o.num(c.risk.bvol, 0)}%</div></div><div><span class="kpi__name">Beta to the ${c.bench.name}</span><div class="kpi__level">${o.num(c.risk.beta)}</div><div class="kpi__chg">1.0 moves with the market</div></div><div><span class="kpi__name">Deepest fall, 1 year</span><div class="kpi__level mv--down">${o.pct(dd[mi], 1)}</div><div class="kpi__chg">${o.fmtD(c.hist.dates[pk[mi]])} to ${o.fmtD(c.hist.dates[mi])}</div></div><div><span class="kpi__name">Below its high</span><div class="kpi__level ${dd[dd.length - 1] < 0 ? 'mv--down' : ''}">${o.pct(dd[dd.length - 1], 1)}</div><div class="kpi__chg">Against the year’s highest close</div></div>`;
    const lo = Math.min(...dd); const T = o.niceTicks(lo, 0, 3);
    o.lineChart(o.$('#dd'), { x: c.hist.dates, series: [{ v: dd, area: true }], ticks: T, h: 180, fmtY: t => (t < 0 ? o.MIN : '') + Math.abs(t) + '%', read: i => o.$('#dd-r').innerHTML = `${o.fmtD(c.hist.dates[i])}: ` + (dd[i] === 0 ? 'at its high so far' : `<span class="mv--down">${o.pct(dd[i], 1)}</span> below the high so far`) }); });
  o.onResize(() => draws.forEach(f => f()));
}

function ago(s) { const t = new Date(s).getTime(); if (!isFinite(t)) return ''; const m = (Date.now() - t) / 6e4; if (m < 60) return Math.max(1, Math.round(m)) + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago'; return Math.round(m / 1440) + ' d ago'; }

function recoHtml(r) {
  const tot = r.reduce((a, b) => a + b[1], 0) || 1;
  const cols = ['var(--ink)', 'color-mix(in srgb,var(--ink) 66%,var(--ground))', 'color-mix(in srgb,var(--ink) 40%,var(--ground))', 'color-mix(in srgb,var(--ink) 24%,var(--ground))', 'color-mix(in srgb,var(--ink) 14%,var(--ground))'];
  return `<div style="display:flex;height:22px;margin-top:22px;gap:2px">${r.map(([n, v], i) => v ? `<span style="flex:${v};background:${cols[i]}" title="${n}: ${v} of ${tot}"></span>` : '').join('')}</div><div class="legend">${r.map(([n, v], i) => `<span><i style="background:${cols[i]}"></i>${n} <b style="color:var(--ink);font-weight:500">${v}</b></span>`).join('')}</div>`;
}

function quantile(a, q) { const s = [...a].sort((x, y) => x - y); const p = (s.length - 1) * q, b = Math.floor(p), r = p - b; return s[b + 1] !== undefined ? s[b] + r * (s[b + 1] - s[b]) : s[b]; }
function drawPeers(c) {
  const o = O(); const box = o.$('#peers'); box.innerHTML = ''; const P = c.peers || [];
  if (P.length < 3) { box.innerHTML = o.fail('Not enough peers in its region and sector.'); return; }
  const w = o.W(box), rowH = 60, hgt = rowH * 5; const svg = o.svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box);
  const M = [{ k: 'pe', name: 'P/E, last 12 months', fmt: v => o.num(v, 1) + 'x', tail: ', lower is cheaper', f: v => v > 0 && v < 2000 }, { k: 'g', name: 'Revenue growth', fmt: v => o.pct(v, 1), tail: '', col: true }, { k: 'om', name: 'Operating margin', fmt: v => o.num(v, 1) + '%', tail: '' }, { k: 'de', name: 'Debt to equity', fmt: v => o.num(v, 0) + '%', tail: ', lower is safer' }, { k: 'dy', name: 'Dividend yield', fmt: v => o.num(v) + '%', tail: '' }];
  M.forEach((m, ri) => {
    const y0 = ri * rowH; const vals = P.map(p => p[m.k]).filter(v => o.isNum(v) && (!m.f || m.f(v)));
    const t = o.svgEl('text', { x: 0, y: y0 + 16, 'font-size': 11, 'font-weight': 550, fill: 'var(--ink)' }, svg); t.textContent = m.name;
    const me = P.find(p => p.t === c.t) || {}; const a = me[m.k];
    const lab = o.svgEl('text', { x: w, y: y0 + 16, 'font-size': 11, 'text-anchor': 'end', fill: 'var(--ink-2)' }, svg); lab.textContent = o.isNum(a) ? `${c.name.split(' ')[0]} ${m.fmt(a)}${m.tail}` : 'n/a';
    o.svgEl('line', { x1: 0, x2: w, y1: y0 + 40, y2: y0 + 40, class: 'grid-line' }, svg);
    if (vals.length < 2) return;
    const lo = quantile(vals, .05), hi = quantile(vals, .95), med = quantile(vals, .5); const pad = 8, X = v => pad + (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1) * (w - 2 * pad);
    o.svgEl('line', { x1: X(med), x2: X(med), y1: y0 + 32, y2: y0 + 48, stroke: 'var(--ink-3)', 'stroke-dasharray': '2 2' }, svg);
    [...P].reverse().forEach(p => { const v = p[m.k]; if (!o.isNum(v) || (m.f && !m.f(v))) return; const mine = p.t === c.t, out = v < lo || v > hi;
      const ci = o.svgEl('circle', { cx: X(v), cy: y0 + 40, r: mine ? 6 : 5, fill: mine ? 'var(--ink)' : 'var(--ground)', stroke: mine ? 'var(--ink)' : 'var(--ink-3)', 'stroke-width': 1.5, style: 'cursor:pointer' }, svg);
      if (out) ci.setAttribute('stroke-dasharray', '2 2');
      o.bindTip(ci, `<b style="font-weight:550">${o.esc(p.n)}</b><br>${m.name}: ${m.fmt(v)}<br><span style="color:var(--ink-2)">Median ${m.fmt(med)}</span>`);
      ci.addEventListener('dblclick', () => location.href = o.link('companies/' + p.slug + '/')); });
  });
}

function drawComp(c) {
  const o = O(); const box = o.$('#comp'), T = o.$('#compT'); box.innerHTML = ''; T.innerHTML = '';
  if (!c.comp) { box.innerHTML = o.fail('Breakdown not available.'); return; }
  const w = o.W(box), hgt = 32; const svg = o.svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box);
  const items = [...c.comp.parts.map((p, i) => ({ n: p[0], v: p[1], col: `color-mix(in srgb,var(--down) ${[88, 58, 44, 34][i] || 30}%,var(--ground))` })), { n: 'Net income', v: c.comp.ni, col: `color-mix(in srgb,var(--up) 78%,var(--ground))`, ni: 1 }];
  const fs = o.ccySym(c.fcur); let x = 0;
  items.forEach(it => { const share = Math.max(0, it.v / c.comp.rev), bw = share * w; const r = o.svgEl('rect', { x, y: 0, width: Math.max(0, bw - 1.5), height: hgt, fill: it.col }, svg); if (share >= .075 && bw > 30) { const t = o.svgEl('text', { x: x + 6, y: 20, 'font-size': 11, 'font-weight': 550, fill: 'rgba(0,0,0,.78)' }, svg); t.textContent = Math.round(share * 100) + '%'; } o.bindTip(r, `${it.n}<br>${fs}${o.num(it.v, 1)}bn, ${Math.round(share * 100)}% of revenue`); x += bw;
    T.insertAdjacentHTML('beforeend', `<tr><td style="${it.ni ? 'font-weight:550' : ''}"><i style="display:inline-block;width:10px;height:10px;margin-right:9px;background:${it.col}"></i>${it.n}</td><td>${fs}${o.num(it.v, 1)}bn</td><td class="muted" style="width:120px">${Math.round(share * 100)}% of revenue</td></tr>`); });
}

function dcfHtml() {
  return `<div class="two" style="margin-top:24px"><div><label style="display:block;margin-bottom:22px"><span style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink-2);margin-bottom:10px"><span>Cash flow growth, years 1 to 5</span><output id="o-g" style="color:var(--ink)"></output></span><input type="range" id="i-g" min="-5" max="35" step="0.5" value="10"></label>
  <label style="display:block;margin-bottom:22px"><span style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink-2);margin-bottom:10px"><span>Discount rate</span><output id="o-r" style="color:var(--ink)"></output></span><input type="range" id="i-r" min="6" max="13" step="0.25" value="9"></label>
  <label style="display:block;margin-bottom:22px"><span style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink-2);margin-bottom:10px"><span>Growth after year 10</span><output id="o-t" style="color:var(--ink)"></output></span><input type="range" id="i-t" min="0" max="4.5" step="0.25" value="3"></label>
  <button class="btn btn--ghost btn--sm" id="dcfReset">Reset assumptions</button></div>
  <div><div style="padding-bottom:14px"><div class="kpi__name">Value per share on these assumptions</div><div class="bignum" id="d-v" style="font-size:26px;margin:4px 0 6px"></div><div class="kpi__name" id="d-vs"></div></div><div style="padding-top:14px;border-top:1px solid var(--rule)"><div class="kpi__name">Growth the price implies</div><div class="bignum" id="d-i" style="font-size:26px;margin:4px 0 6px"></div><div class="kpi__name" id="d-is"></div></div></div></div><div class="chart-box" id="dcfBars"></div>`;
}

function dcfCalc(base, g1, r, gT) { let f = base.fcf; const pv = []; for (let t = 1; t <= 10; t++) { const g = t <= 5 ? g1 : g1 + (gT - g1) * (t - 5) / 5; f *= 1 + g; pv.push(f / Math.pow(1 + r, t)); } const tv = f * (1 + gT) / (r - gT) / Math.pow(1 + r, 10); const ev = pv.reduce((a, b) => a + b, 0) + tv; return { v: (ev - base.nd) / base.sh, share: tv / ev, pv, tv }; }

function setupDcf(c, add) {
  const o = O(); const base = c.dcf || {}; const price = c.price;
  const fxAdj = c.fcur !== c.cur ? null : 1;   // statements and price in different currencies: show value in statement currency
  if (!o.isNum(base.fcf) || !o.isNum(base.sh) || base.sh <= 0 || base.fcf <= 0) { o.$('#s-dcf .two').outerHTML = o.fail('The model needs positive free cash flow and a share count.'); o.$('#dcfBars').remove(); return; }
  const iG = o.$('#i-g'), iR = o.$('#i-r'), iT = o.$('#i-t'); const fs = o.ccySym(c.fcur);
  const implied = (r, t) => { let lo = -.5, hi = 1.5; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; dcfCalc(base, m, r, t).v < price ? lo = m : hi = m; } return lo; };
  const upd = () => {
    const g = +iG.value / 100, r = +iR.value / 100, t = +iT.value / 100;
    o.$('#o-g').textContent = o.pct(g * 100, 1) + ' a year'; o.$('#o-r').textContent = o.num(r * 100) + '%'; o.$('#o-t').textContent = o.num(t * 100) + '% a year';
    const x = dcfCalc(base, g, r, t); const diff = (x.v / price - 1) * 100;
    o.$('#d-v').textContent = x.v > 0 ? fs + Math.round(x.v).toLocaleString('en-US') : 'Below zero';
    o.$('#d-vs').textContent = fxAdj ? `${Math.abs(Math.round(diff))}% ${diff < 0 ? 'below' : 'above'} the ${o.ccySym(c.cur)}${o.num(price)} close. ${Math.round(x.share * 100)}% of it comes after year 10.` : `In ${c.fcur}, the reporting currency; the shares trade in ${c.cur}. ${Math.round(x.share * 100)}% of it comes after year 10.`;
    if (fxAdj) { const im = implied(r, t) * 100; o.$('#d-i').textContent = o.pct(im, 1) + ' a year'; o.$('#d-is').textContent = `Cash flow growth in years 1 to 5 that makes the model equal the price, at a ${o.num(r * 100)}% discount rate.${o.isNum(base.cagr) ? ` Over the last fiscal years free cash flow grew ${o.pct(base.cagr, 1)} a year.` : ''}`; }
    else { o.$('#d-i').textContent = '–'; o.$('#d-is').textContent = 'Not shown when the statements and the shares use different currencies.'; }
    bars(x);
  };
  const bars = x => { const box = o.$('#dcfBars'); box.innerHTML = ''; const w = o.W(box), hgt = 150, top = 18, bot = 20, ph = hgt - top - bot; const svg = o.svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box); const vals = [...x.pv, x.tv]; const mx = Math.max(...vals); const n = 11, gap = 6, bw = (w - gap * (n - 1)) / n;
    vals.forEach((v, i) => { const xx = i * (bw + gap), bh = Math.max(1, v / mx * ph), yy = top + ph - bh, last = i === 10; o.svgEl('rect', { x: xx + .5, y: yy, width: bw - 1, height: bh, fill: last ? 'var(--ink)' : 'var(--bar-dark)', stroke: 'var(--ink)' }, svg); if (i === 0 || i === 9 || i === 10) { const t = o.svgEl('text', { x: xx + bw / 2, y: yy - 5, 'text-anchor': 'middle', class: 'ax', fill: 'var(--ink)' }, svg); t.textContent = fs + Math.round(v) + 'bn'; } const l = o.svgEl('text', { x: xx + bw / 2, y: hgt - 4, 'text-anchor': 'middle', class: 'ax' }, svg); l.textContent = last ? 'After 10' : i + 1; }); };
  [iG, iR, iT].forEach(i => i.addEventListener('input', upd));
  o.$('#dcfReset').onclick = () => { iG.value = 10; iR.value = 9; iT.value = 3; upd(); };
  add(upd);
}

return { home, dashboards, dashboard, calendar, world, fx, fxnote, companies, company };
})());
