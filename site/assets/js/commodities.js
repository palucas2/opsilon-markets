/* Opsilon Markets – Commodities: board, term structure, spreads, supply and demand,
   logistics, positioning, dollar and China, weather, seasonality, and one page per market. */
window.PAGES = Object.assign(window.PAGES || {}, (function () {
const O = () => window.O;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUB = [
  ['commodities/', 'Overview'], ['commodities/term-structure/', 'Term structure'], ['commodities/spreads/', 'Spreads'],
  ['commodities/fundamentals/', 'Supply & demand'], ['commodities/logistics/', 'Logistics'], ['commodities/positioning/', 'Positioning'],
  ['commodities/macro/', 'Dollar, China & news'], ['commodities/weather/', 'Weather'], ['commodities/seasonality/', 'Seasonality']];

function subnav(active) {
  const o = O();
  return `<nav class="subnav col-full rv" aria-label="Commodities">${SUB.map(([u, t]) => `<a class="chip${u === active ? ' on' : ''}" href="${o.link(u)}">${t}</a>`).join('')}</nav>`;
}
const px = (v, dec) => O().num(v, dec ?? 2);
const doyLabel = d => { const dt = new Date(2025, 0, d); return `${dt.getDate()} ${MON[dt.getMonth()]}`; };
function sparkSvg(v, w = 92, h = 26) {
  const o = O(); const a = v.filter(o.isNum); if (a.length < 2) return '';
  const lo = Math.min(...a), hi = Math.max(...a), n = v.length;
  let d = '', pen = false; v.forEach((y, i) => { if (!o.isNum(y)) { pen = false; return; } d += (pen ? 'L' : 'M') + (i / (n - 1) * w).toFixed(1) + ',' + (2 + (1 - (y - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1); pen = true; });
  const up = a[a.length - 1] >= a[0];
  return `<svg class="spk" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="${up ? 'var(--up)' : 'var(--down)'}" stroke-width="1.3"/></svg>`;
}
function pbar(p, flag) {
  const o = O(); if (!o.isNum(p)) return '–';
  const c = p >= 90 ? 'var(--up)' : p <= 10 ? 'var(--down)' : 'var(--ink)';
  return `<span class="pbar" title="${Math.round(p)}th percentile"><i style="left:calc(${p}% - 1px);background:${c}"></i></span><span class="tnum">${Math.round(p)}</span>`;
}
function shapeTag(s) { if (!s) return '–'; const c = s === 'Backwardation' ? 'st-up' : s === 'Contango' ? 'st-down' : ''; return `<span class="badge ${c}">${s}</span>`; }
function statusTag(s) { const c = /Severe/.test(s) ? 'st-down' : /Disrupt/.test(s) ? 'st-warn' : /Above/.test(s) ? 'st-up' : ''; return `<span class="badge ${c}">${s}</span>`; }
function kv(name, val, sub = '') { return `<div><div class="kpi__name">${name}</div><div class="kpi__level">${val}</div>${sub ? `<div class="kpi__chg">${sub}</div>` : ''}</div>`; }
function legend(items) { return `<div class="legend">${items.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join('')}</div>`; }
function rangeCut(dates, rg) { if (rg === 'All') return 0; const days = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, '2Y': 730, '3Y': 1096, '5Y': 1826 }[rg]; const last = O().D(dates[dates.length - 1]).getTime(); const i = dates.findIndex(d => O().D(d).getTime() >= last - days * 864e5); return Math.max(0, i); }
function xl(n, k = 4) { if (n < 2) return [0]; const out = []; for (let i = 0; i < k; i++) out.push(Math.round(i * (n - 1) / (k - 1))); return [...new Set(out)]; }
function units(u, v, dec) { const o = O(); if (!o.isNum(v)) return '–'; if (u.startsWith('$/')) return '$' + o.num(v, dec); if (u.startsWith('¢/')) return o.num(v, dec) + '¢'; return o.num(v, dec); }
function k(v) { const o = O(); if (!o.isNum(v)) return '–'; const a = Math.abs(v); return (v < 0 ? o.MIN : '') + (a >= 1e6 ? (a / 1e6).toFixed(2) + 'm' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'k' : a.toFixed(0)); }
function ks(v) { const o = O(); if (!o.isNum(v)) return '–'; return (v >= 0 ? '+' : '') + k(v).replace(o.MIN, o.MIN); }
function sideCal(cal, n = 8) {
  const o = O(); if (!cal?.length) return '';
  return `<h2 class="side-title" style="margin-top:34px">Release calendar</h2><div class="list" style="margin-top:0;border-top:0">${cal.slice(0, n).map(c => `<div><span class="t" style="font-size:14px">${c.big ? '<b>' : ''}${o.esc(c.what)}${c.big ? '</b>' : ''}<span class="d" style="display:block">${o.esc(c.mk)}</span></span><span class="m">${o.fmtDS(c.d)}, ${c.t}</span></div>`).join('')}</div>`;
}
async function load(path) { return O().data('commodities/' + path).catch(() => null); }

/* ================================================================== OVERVIEW */
async function commodities() {
  const o = O(); const m = o.main();
  const d = await load('index.json');
  if (!d) { m.innerHTML = o.head({ title: 'Commodities' }) + subnav('commodities/') + o.fail(); return; }
  m.innerHTML = o.head({ title: 'Commodities', short: false, lede: 'Twenty-three futures markets read the way a desk reads them: price, the shape of the curve, who is positioned, what the season says and what moves the physical market.', meta: `Yahoo Finance, CFTC, EIA, IMF PortWatch, Open-Meteo. Figures to the close of ${d.asof}. Updated ${d.updated}.` }) +
    subnav('commodities/') +
    `<div class="col-main rv">
      ${d.signals.length ? `<section class="sec"><h2>What stands out</h2><div class="list">${d.signals.map(s => `<a href="${o.link('commodities/' + s.key + '/')}"><span class="t"><b>${o.esc(s.name)}</b>. ${o.esc(s.text)}</span><span class="m">${s.kind}</span></a>`).join('')}</div></section>` : ''}
      <section class="sec"><h2>The board</h2><p class="lede" style="font-size:14px">Front-month futures. Curve: front against the contract about six months out, annualised (positive = backwardation, the front trades above later months). Positioning: managed-money net position against its three-year range. Seasonal: year-to-date change against the five-year average path at today's date.</p>
        <div class="ctl__row" id="grp" style="margin-top:18px"></div>
        <div class="tbl-wrap"><table class="tbl" id="board"><thead><tr><th data-k="name" data-dir="1" class="l">Market</th><th data-k="last">Last</th><th data-k="d1">Day</th><th data-k="m1">Month</th><th data-k="ytd">Year to date</th><th data-k="roll">Curve</th><th data-k="cot_pctile">Positioning</th><th data-k="sea_dev">Seasonal</th><th class="l">3 months</th></tr></thead><tbody></tbody></table></div>
        <p class="src">Click a column to sort. Aluminium and iron ore have no dated curve or COT report in the free sources used.</p></section>
      <section class="sec"><h2>Moves</h2><div class="ctl__row" id="rg" style="margin-top:12px"></div><div id="heat" style="margin-top:20px"></div></section>
      <section class="sec"><h2>Backwardation and contango</h2><p class="lede" style="font-size:14px">Annualised carry from the front to about six months out. Backwardation (right) signals tight prompt supply; deep contango (left) signals surplus and storage being paid for.</p><div class="chart-box" id="carry"></div></section>
      <section class="sec"><h2>Where the money is</h2><p class="lede" style="font-size:14px">Managed-money net position as a percentile of its three-year range. Above 90 or below 10, the trade is crowded and the risk of a squeeze rises.</p><div class="chart-box" id="crowd"></div></section>
    </div>
    <aside class="col-side rv"><h2 class="side-title">Benchmarks</h2><ul class="kpi" id="side"></ul><p class="side-src">Front-month futures, Yahoo Finance.</p>${sideCal(d.calendar)}</aside>`;
  const rows = d.rows;
  const R = Object.fromEntries(rows.map(r => [r.key, r]));
  o.$('#side').innerHTML = ['wti', 'brent', 'natgas', 'gold', 'copper', 'corn'].filter(x => R[x]).map(x => { const r = R[x]; return `<li class="kpi__item"><a href="${o.link('commodities/' + x + '/')}"><span class="kpi__name">${r.name}</span><span class="kpi__level" style="display:block">${units(r.unit, r.last, r.dec)}</span><span class="kpi__chg">${o.mv(r.d1)} on the day</span></a></li>`; }).join('');
  let grp = 'All';
  const render = r => `<tr><td class="l"><a href="${o.link('commodities/' + r.key + '/')}">${r.name}</a><small>${r.unit} · ${r.ticker}</small></td><td>${px(r.last, r.dec)}</td><td>${o.mv(r.d1)}</td><td>${o.mv(r.m1)}</td><td>${o.mv(r.ytd)}</td>
    <td>${r.shape ? `${o.mv(r.roll, 1)}<small>${r.shape}</small>` : '–'}</td><td style="white-space:nowrap">${pbar(r.cot_pctile)}${r.cot_flag ? `<small>${r.cot_flag}</small>` : ''}</td><td>${o.isNum(r.sea_dev) ? o.mv(r.sea_dev, 1, 'pt') : '–'}</td><td class="l">${sparkSvg(r.spark)}</td></tr>`;
  let redraw;
  const drawBoard = () => { const list = grp === 'All' ? rows : rows.filter(r => r.group === grp); redraw = o.sortableTable(o.$('#board'), list, null, render); };
  o.chips(o.$('#grp'), ['All', ...d.groups], grp, v => { grp = v; drawBoard(); });
  drawBoard();
  let rg = 'm1';
  const drawHeat = () => {
    const sc = { d1: 2.5, w1: 5, m1: 10, ytd: 30, y1: 40 }[rg];
    o.$('#heat').innerHTML = d.groups.map(g => `<h3 style="margin:18px 0 8px;font-size:14px">${g}</h3><div class="heat">${rows.filter(r => r.group === g).map(r => `<a href="${o.link('commodities/' + r.key + '/')}" style="background:${o.heatColor(r[rg], sc)};padding:8px 10px;font-size:13px;line-height:1.35;min-height:58px;color:#fff">${r.name}<b>${o.pct(r[rg])}</b></a>`).join('')}</div>`).join('');
  };
  o.chips(o.$('#rg'), [['d1', 'Day'], ['w1', 'Week'], ['m1', 'Month'], ['ytd', 'Year to date'], ['y1', 'One year']], rg, v => { rg = v; drawHeat(); });
  drawHeat();
  const drawBars = () => {
    o.hbars(o.$('#carry'), rows.filter(r => o.isNum(r.roll)).sort((a, b) => b.roll - a.roll).map(r => [r.name, r.roll]), { labelW: 150, fmt: v => o.sgn(v, 1) + '%' });
    o.hbars(o.$('#crowd'), rows.filter(r => o.isNum(r.cot_pctile)).sort((a, b) => b.cot_pctile - a.cot_pctile).map(r => [r.name, r.cot_pctile - 50]), { labelW: 150, fmt: v => Math.round(v + 50) + 'th' });
  };
  drawBars(); o.onResize(drawBars);
}

/* ================================================================== ONE MARKET */
async function commodity(key) {
  const o = O(); const m = o.main();
  const c = await load(`c/${key}.json`);
  if (!c) { m.innerHTML = o.head({ title: 'Commodity' }) + subnav('') + o.fail(); return; }
  const U = v => units(c.unit, v, c.dec);
  m.innerHTML = o.head({ crumbs: [['commodities/', 'Commodities'], [null, c.group]], title: c.name, short: false, lede: `${c.ticker} front-month future, in ${c.unit}. Price, curve, positioning, seasonality and the dollar link in one place.`, meta: `Yahoo Finance, CFTC. Close of ${o.fmtD(c.asof)}. Updated ${c.updated}.` }) +
    subnav('') +
    `<div class="col-main rv">
     <section class="sec"><h2>Price</h2><div class="ctl__row" id="prg" style="margin-top:12px"></div><div class="chart-box" id="pch"></div><p class="readout" id="prd"></p>
       <h3 style="margin-top:26px">Realised volatility, 20 days</h3><div class="chart-box" id="rvch"></div><p class="readout" id="rvr"></p></section>
     <section class="sec" id="s-curve"><h2>Term structure</h2><div class="kstrip" id="cstrip"></div><div class="chart-box" id="cch"></div>${legend([['l', 'Today'], ['ld', 'One month ago'], ['ld', 'Three months ago (lighter)']])}<p class="readout" id="crd"></p>
       <h3 style="margin-top:26px">Volume by expiry</h3><p class="lede" style="font-size:14px">Contracts traded in the last session: where the liquidity sits along the curve.</p><div class="chart-box" id="vch"></div>
       <div id="calbox"></div></section>
     <section class="sec" id="s-cot"><h2>Positioning</h2><div class="kstrip" id="pstrip"></div><div class="chart-box" id="cotch"></div>${legend([['l', 'Managed money (funds)'], ['ld', 'Producers and merchants']])}<p class="readout" id="cotr"></p>
       <h3 style="margin-top:26px">Open interest</h3><div class="chart-box" id="oich"></div><p class="readout" id="oir"></p><p class="src">CFTC disaggregated Commitments of Traders, futures only, positions as of each Tuesday.</p></section>
     <section class="sec" id="s-sea"><h2>Seasonality</h2><p class="lede" id="seal" style="font-size:14px"></p><div class="chart-box" id="sch"></div>${legend([['l', 'This year'], ['ld', 'Five-year average'], ['ld', 'Ten-year average (lighter)']])}<p class="readout" id="srd"></p></section>
     <section class="sec" id="s-dxy"><h2>The dollar link</h2><div class="kstrip" id="dstrip"></div><div class="chart-box" id="dch"></div><p class="readout" id="drd"></p><p class="src">Rolling 60-day correlation of daily returns with the ICE dollar index (DXY). Negative: the market tends to rise when the dollar falls.</p></section>
    </div>
    <aside class="col-side rv"><h2 class="side-title">${c.name}</h2><ul class="kpi">
      <li class="kpi__item"><span class="kpi__name">Last</span><span class="kpi__level">${U(c.last)}</span><span class="kpi__chg">${o.mv(c.d1)} on the day</span></li>
      <li class="kpi__item"><span class="kpi__name">Week</span><span class="kpi__level">${o.mv(c.w1)}</span></li>
      <li class="kpi__item"><span class="kpi__name">Month</span><span class="kpi__level">${o.mv(c.m1)}</span></li>
      <li class="kpi__item"><span class="kpi__name">Year to date</span><span class="kpi__level">${o.mv(c.ytd)}</span></li>
      <li class="kpi__item"><span class="kpi__name">One year</span><span class="kpi__level">${o.mv(c.y1)}</span></li>
      <li class="kpi__item"><span class="kpi__name">Day's move</span><span class="kpi__level">${o.isNum(c.z) ? o.sgn(c.z) + 'σ' : '–'}</span><span class="kpi__chg">against a year of moves</span></li>
      <li class="kpi__item"><span class="kpi__name">52-week range</span><span class="kpi__level">${o.isNum(c.pos52) ? c.pos52 + '%' : '–'}</span><span class="kpi__chg">${px(c.lo52, c.dec)} to ${px(c.hi52, c.dec)}</span></li>
      <li class="kpi__item"><span class="kpi__name">Volatility, 20 days</span><span class="kpi__level">${o.isNum(c.rv20) ? o.num(c.rv20, 0) + '%' : '–'}</span><span class="kpi__chg">${o.isNum(c.rv_pctile) ? c.rv_pctile + 'th percentile, 3 years' : ''}</span></li>
    </ul><p class="side-src">${c.unit}. Front-month future ${c.ticker}, Yahoo Finance.</p></aside>`;

  // price
  const H = c.hist; let prg = '1Y';
  const drawPrice = () => { const a = rangeCut(H.d, prg); const x = H.d.slice(a), v = H.v.slice(a); o.lineChart(o.$('#pch'), { x, series: [{ v, width: 1.6 }], h: 240, read: i => o.$('#prd').innerHTML = `${o.fmtD(x[i])}: ${U(v[i])}` });
    const rv = H.rv.slice(a); o.lineChart(o.$('#rvch'), { x, series: [{ v: rv }], h: 140, fmtY: t => t + '%', read: i => o.$('#rvr').innerHTML = `${o.fmtD(x[i])}: ${o.isNum(rv[i]) ? o.num(rv[i], 1) + '% annualised' : '–'}` }); };
  o.chips(o.$('#prg'), ['3M', '6M', '1Y', '2Y', '5Y'], prg, v => { prg = v; drawPrice(); });

  // curve
  const cv = c.curve || {};
  const drawCurve = () => {
    if (!cv.now?.length) { o.$('#s-curve').innerHTML = `<h2>Term structure</h2>${o.fail('No dated contracts are published for this market in the free sources used.')}`; return; }
    o.$('#cstrip').innerHTML = kv('Shape', cv.shape || '–') + kv('Front less next', o.isNum(cv.m1m2) ? o.sgn(cv.m1m2, c.dec) : '–', `${cv.now[0].lab} – ${cv.now[1]?.lab || ''}`) + kv('Front vs six months', o.pct(cv.m1_six_pct), `${cv.front} against ${cv.six}`) + kv('Carry, annualised', o.isNum(cv.roll) ? o.mv(cv.roll, 1) : '–', 'positive = backwardation');
    const labs = cv.now.map(p => p.lab); const pick = arr => labs.map(l => (arr.find(p => p.lab === l) || {}).px ?? null);
    const now = cv.now.map(p => p.px), m1 = pick(cv.m1 || []), m3 = pick(cv.m3 || []);
    o.lineChart(o.$('#cch'), { x: labs, xfmt: x => x, xlabels: xl(labs.length, Math.min(6, labs.length)), h: 230, series: [{ v: m3, dash: true, opacity: .45 }, { v: m1, dash: true }, { v: now, width: 2 }],
      read: i => o.$('#crd').innerHTML = `${labs[i]}: ${U(now[i])}${o.isNum(m1[i]) ? `, a month ago ${U(m1[i])}` : ''}${o.isNum(m3[i]) ? `, three months ago ${U(m3[i])}` : ''}` , rest: 0 });
    const vol = cv.now.map(p => p.vol);
    o.barChart(o.$('#vch'), { cats: labs, series: [{ type: 'out', v: vol }], h: 150, catFmt: (l, i) => (i % Math.ceil(labs.length / 8) === 0 ? l : ''), fmtY: v => k(v), rest: 0, read: () => {} });
    if (c.cal) {
      const cl = c.cal;
      o.$('#calbox').innerHTML = `<h3 style="margin-top:26px">Calendar spread: ${cl.a} less ${cl.b}</h3><p class="lede" style="font-size:14px">The same two contracts over their shared history. Above zero, the nearer contract is dearer (backwardation). Today at the ${cl.pctile ?? '–'}th percentile of the past year.</p><div class="chart-box" id="calch"></div><p class="readout" id="calr"></p>`;
      o.lineChart(o.$('#calch'), { x: cl.d, series: [{ v: cl.v, area: cl.v[cl.v.length - 1] >= 0 ? 'var(--up-tint)' : 'var(--down-tint)' }], h: 170, read: i => o.$('#calr').innerHTML = `${o.fmtD(cl.d[i])}: ${o.sgn(cl.v[i], c.dec)}` });
    }
  };

  // positioning
  const drawCot = () => {
    const cb = c.cot; if (!cb) { o.$('#s-cot').innerHTML = `<h2>Positioning</h2>${o.fail('The CFTC does not publish a Commitments of Traders report for this market.')}`; return; }
    o.$('#pstrip').innerHTML = kv('Funds, net', k(cb.mm_net), `${ks(cb.mm_chg)} on the week`) + kv('Share of open interest', o.isNum(cb.mm_pct_oi) ? o.sgn(cb.mm_pct_oi, 1) + '%' : '–') + kv('Three-year percentile', o.isNum(cb.pctile3y) ? Math.round(cb.pctile3y) + 'th' : '–', cb.flag || (o.isNum(cb.z3y) ? `z-score ${o.sgn(cb.z3y)}` : '')) + kv('Producers, net', k(cb.prod_net), 'hedgers');
    const h = cb.hist; const a = Math.max(0, h.d.length - 156); const x = h.d.slice(a);
    const mm = h.mm.slice(a), pr = h.prod.slice(a), oi = h.oi.slice(a);
    o.lineChart(o.$('#cotch'), { x, series: [{ v: pr, dash: true }, { v: mm, width: 1.8 }], h: 220, fmtY: v => k(v), read: i => o.$('#cotr').innerHTML = `Week of ${o.fmtD(x[i])}: funds ${k(mm[i])}, producers ${k(pr[i])}` });
    o.lineChart(o.$('#oich'), { x, series: [{ v: oi }], h: 140, fmtY: v => k(v), read: i => o.$('#oir').innerHTML = `${o.fmtD(x[i])}: ${k(oi[i])} contracts open` });
  };

  // seasonality
  const drawSea = () => {
    const s = c.season; if (!s) { o.$('#s-sea').innerHTML = `<h2>Seasonality</h2>${o.fail('Not enough history.')}`; return; }
    o.$('#seal').innerHTML = `Change from the first close of each year. Thin grey lines: the 10th and 90th percentile paths of the last ten years (${s.years10?.[0]}–${s.years10?.[1]}). ${o.isNum(s.dev5) ? `This year is ${o.sgn(s.dev5, 1)} points ${s.dev5 >= 0 ? 'above' : 'below'} the five-year path at today's date.` : ''} ${o.isNum(s.fwd30_avg) ? `Over the next 30 days it has moved ${o.sgn(s.fwd30_avg, 1)}% on average, rising in ${s.fwd30_up} of the last ${s.fwd30_n} years.` : ''}`;
    const x = s.grid;
    o.lineChart(o.$('#sch'), { x, xfmt: doyLabel, xlabels: xl(x.length, 5), h: 240, fmtY: t => t + '%',
      series: [{ v: s.hi10, color: 'var(--ink-3)', opacity: .35, width: 1 }, { v: s.lo10, color: 'var(--ink-3)', opacity: .35, width: 1 }, { v: s.avg10, dash: true, opacity: .5 }, { v: s.avg5, dash: true }, { v: s.cur, width: 2 }],
      read: i => o.$('#srd').innerHTML = `${doyLabel(x[i])}: ${s.cur_year} ${o.isNum(s.cur[i]) ? o.pct(s.cur[i]) : '–'}, five-year average ${o.pct(s.avg5?.[i])}, ten-year ${o.pct(s.avg10?.[i])}`, rest: s.today_i });
  };

  // dollar
  const drawDxy = () => {
    const dx = c.dxy; if (!dx?.roll) { o.$('#s-dxy').innerHTML = `<h2>The dollar link</h2>${o.fail()}`; return; }
    o.$('#dstrip').innerHTML = kv('Correlation, 60 days', o.num(dx.corr60)) + kv('Correlation, one year', o.num(dx.corr1y)) + kv('Beta to the dollar', o.isNum(dx.beta1y) ? o.num(dx.beta1y) : '–', '% move per 1% in DXY');
    o.lineChart(o.$('#dch'), { x: dx.roll.d, series: [{ v: dx.roll.v }], h: 170, ticks: [-1, -.5, 0, .5, 1], fmtY: v => v, read: i => o.$('#drd').innerHTML = `${o.fmtD(dx.roll.d[i])}: ${o.num(dx.roll.v[i])}` });
  };
  const all = () => { drawPrice(); drawCurve(); drawCot(); drawSea(); drawDxy(); };
  all(); o.onResize(all);
}

/* ================================================================== SECTION PAGES */
const SEC = {
  'term-structure': ['Term structure', 'Every curve on one page: which markets pay to hold, which pay to wait, and how far the front has moved against later months.'],
  spreads: ['Spreads', 'Refining and crushing margins, and the relative-value ratios desks watch, against five years of history.'],
  fundamentals: ['Supply & demand', 'US inventories and flows from the EIA, natural gas storage against the five-year average, and the dates of the big balance reports.'],
  logistics: ['Logistics', 'Daily ship transits through the straits and canals that carry oil, gas and grain, and the freight markets that price them.'],
  positioning: ['Positioning', 'Who holds what: funds against producers in every CFTC market, with the extremes that often precede reversals.'],
  macro: ['Dollar, China & news', 'The dollar, the Chinese demand barometers and a filtered feed of sanctions, supply and shipping headlines.'],
  weather: ['Weather', 'Temperature and rainfall against ten-year normals for gas-demand cities and the main crop regions, out to five weeks.'],
  seasonality: ['Seasonality', 'This year against the five- and ten-year average paths, and what the next 30 days have usually brought.'],
};

async function commsec(id) {
  const o = O(); const m = o.main();
  const [title, lede] = SEC[id];
  const head = meta => o.head({ crumbs: [['commodities/', 'Commodities'], [null, title]], title, short: false, lede, meta }) + subnav(`commodities/${id}/`);
  await ({ 'term-structure': secCurves, spreads: secSpreads, fundamentals: secFund, logistics: secLog, positioning: secPos, macro: secMacro, weather: secWeather, seasonality: secSeason })[id](m, head);
}

async function secCurves(m, head) {
  const o = O(); const [d, sp] = await Promise.all([load('index.json'), load('spreads.json')]);
  if (!d) { m.innerHTML = head('') + o.fail(); return; }
  const rows = d.rows.filter(r => r.shape);
  m.innerHTML = head(`Dated futures, Yahoo Finance. Close of ${d.asof}.`) + `<div class="col-main rv">
    <section class="sec"><h2>Curves compared</h2><p class="lede" style="font-size:14px">Each curve rebased to its front contract = 100, by months to expiry.</p><div class="ctl__row" id="cg" style="margin-top:14px"></div><div class="chart-box" id="cmp"></div><div id="cleg"></div><p class="readout" id="cmr"></p></section>
    <section class="sec"><h2>Every curve</h2><div class="tbl-wrap"><table class="tbl" id="ct"><thead><tr><th class="l" data-k="name" data-dir="1">Market</th><th data-k="shape" class="l">Shape</th><th data-k="m1_six_pct">Front vs 6 months</th><th data-k="roll">Carry, annualised</th><th data-k="pct">Spread percentile</th></tr></thead><tbody></tbody></table></div><p class="src">Spread percentile: the front-to-six-month spread of the same two contracts against its past year.</p></section>
    <section class="sec"><h2>How to read a curve</h2><div class="prose"><p>Backwardation, the front above later months, means buyers pay up for barrels or bushels now: inventories are thin and holding a long position earns the roll. Contango, the front below later months, means the market is paying for storage: supply is ample, and a long position loses the roll each month.</p><p>The curve often turns before the price. A front that starts to weaken against later months while the price still rises is a warning that the physical market is loosening.</p></div></section>
    </div><aside class="col-side rv"><h2 class="side-title">Steepest</h2><div id="steep"></div></aside>`;
  const P = Object.fromEntries((sp?.calendar || []).map(x => [x.key, x.pctile]));
  rows.forEach(r => r.pct = P[r.key]);
  o.sortableTable(o.$('#ct'), rows, null, r => `<tr><td class="l"><a href="${o.link('commodities/' + r.key + '/')}">${r.name}</a></td><td class="l">${shapeTag(r.shape)}</td><td>${o.mv(r.m1_six_pct)}</td><td>${o.mv(r.roll, 1)}</td><td style="white-space:nowrap">${pbar(r.pct)}</td></tr>`);
  const sorted = [...rows].sort((a, b) => b.roll - a.roll);
  o.$('#steep').innerHTML = `<ul class="kpi">${[...sorted.slice(0, 3), ...sorted.slice(-3).reverse()].map(r => `<li class="kpi__item"><a href="${o.link('commodities/' + r.key + '/')}"><span class="kpi__name">${r.name}</span><span class="kpi__level" style="display:block">${o.mv(r.roll, 1)}</span><span class="kpi__chg">${r.shape}</span></a></li>`).join('')}</ul><p class="side-src">Annualised carry. Top: most backwardated. Bottom: deepest contango.</p>`;
  const groups = [...new Set(rows.map(r => r.group))]; let g = groups[0];
  const cache = {};
  const draw = async () => {
    const list = rows.filter(r => r.group === g);
    await Promise.all(list.map(async r => { cache[r.key] = cache[r.key] || await load(`c/${r.key}.json`); }));
    const mo = lab => { const [mm, yy] = lab.split(' '); return (2000 + +yy) * 12 + MON.indexOf(mm); };
    const N = 24; const x = [...Array(N + 1).keys()];
    const cols = ['var(--ink)', 'var(--up)', 'var(--down)', 'var(--ink-3)', '#d29b2a'];
    const series = list.map((r, i) => { const cv = cache[r.key]?.curve?.now || []; if (!cv.length) return { v: [] }; const f = mo(cv[0].lab), base = cv[0].px; const v = x.map(() => null); cv.forEach(p => { const k2 = mo(p.lab) - f; if (k2 <= N) v[k2] = p.px / base * 100; }); return { v, color: cols[i % cols.length], width: 1.6, name: r.name }; });
    // connect gaps by linear interpolation for display
    series.forEach(s => { const v = s.v; let a = -1; v.forEach((y, j) => { if (o.isNum(y)) { if (a >= 0 && j - a > 1) for (let t = a + 1; t < j; t++) v[t] = v[a] + (y - v[a]) * (t - a) / (j - a); a = j; } }); });
    o.lineChart(o.$('#cmp'), { x, xfmt: v => v === 0 ? 'Front' : `+${v}m`, xlabels: [0, 6, 12, 18, 24], h: 250, series, base: 100, read: i => o.$('#cmr').innerHTML = `${i === 0 ? 'Front' : i + ' months out'}: ${series.map(s => o.isNum(s.v[i]) ? `${s.name} ${o.num(s.v[i], 1)}` : '').filter(Boolean).join(', ')}`, rest: 6 });
    o.$('#cleg').innerHTML = `<div class="legend">${series.map(s => `<span><i style="width:14px;height:0;border-top:2px solid ${s.color};vertical-align:3px"></i>${s.name}</span>`).join('')}</div>`;
  };
  o.chips(o.$('#cg'), groups, g, v => { g = v; draw(); }); draw(); o.onResize(draw);
}

async function secSpreads(m, head) {
  const o = O(); const d = await load('spreads.json');
  if (!d) { m.innerHTML = head('') + o.fail(); return; }
  m.innerHTML = head(`Front-month futures, Yahoo Finance. Updated ${d.updated}.`) + `<div class="col-main rv">
    <section class="sec"><h2>Margins and ratios</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Spread</th><th>Last</th><th>Week</th><th>Month</th><th>5-year average</th><th>5-year percentile</th></tr></thead><tbody>${d.spreads.map(s => `<tr><td class="l">${s.name}<small>${s.unit}</small></td><td>${o.num(s.last, 2)}</td><td>${o.mv(s.w1, 2, '')}</td><td>${o.mv(s.m1, 2, '')}</td><td>${o.num(s.avg5, 2)}</td><td style="white-space:nowrap">${pbar(s.pctile5)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="sec"><h2>History</h2><div class="ctl"><select class="inp" id="ss">${d.spreads.map(s => `<option value="${s.key}">${s.name}</option>`).join('')}</select></div><p class="lede" id="sw" style="font-size:14px"></p><div class="ctl__row" id="srg" style="margin-top:12px"></div><div class="chart-box" id="sch"></div>${legend([['l', 'Spread'], ['ld', 'Five-year average']])}<p class="readout" id="srd"></p></section>
    <section class="sec"><h2>Calendar spreads</h2><p class="lede" style="font-size:14px">Front contract less the contract about six months out, and where it sits in its past year.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Market</th><th class="l">Contracts</th><th>Spread</th><th class="l">Shape</th><th>Percentile, 1 year</th></tr></thead><tbody>${d.calendar.map(c => `<tr><td class="l"><a href="${o.link('commodities/' + c.key + '/')}">${c.name}</a></td><td class="l">${c.a} – ${c.b}</td><td>${o.sgn(c.last, 3)}<small>${c.unit}</small></td><td class="l">${shapeTag(c.shape)}</td><td style="white-space:nowrap">${pbar(c.pctile)}</td></tr>`).join('')}</tbody></table></div></section>
    </div><aside class="col-side rv"><h2 class="side-title">How they are built</h2><div class="prose" style="font-size:14px"><p>3-2-1 crack: (2 × RBOB × 42 + 1 × ULSD × 42 − 3 × WTI) ÷ 3.</p><p>Soybean crush: meal × 0.022 + oil × 0.11 − soybeans, in dollars a bushel.</p><p>Ratios use front-month prices in their quoted units. Copper / gold is multiplied by 1,000.</p></div></aside>`;
  const S = Object.fromEntries(d.spreads.map(s => [s.key, s])); let key = d.spreads[0]?.key, rg = '2Y';
  const draw = () => { const s = S[key]; if (!s) return; o.$('#sw').textContent = s.what; const a = rangeCut(s.hist.d, rg); const x = s.hist.d.slice(a), v = s.hist.v.slice(a);
    o.lineChart(o.$('#sch'), { x, series: [{ v: x.map(() => s.avg5), dash: true }, { v, width: 1.6 }], h: 240, read: i => o.$('#srd').innerHTML = `${o.fmtD(x[i])}: ${o.num(v[i], 2)} ${s.unit}` }); };
  o.$('#ss').onchange = e => { key = e.target.value; draw(); };
  o.chips(o.$('#srg'), ['6M', '1Y', '2Y', '5Y'], rg, v => { rg = v; draw(); }); draw(); o.onResize(draw);
}

async function secFund(m, head) {
  const o = O(); const d = await load('fundamentals.json');
  if (!d?.eia) { m.innerHTML = head('') + o.fail(); return; }
  const e = d.eia, st = e.stocks || {}, fl = e.flows || {}, gas = e.gas;
  const SN = [['crude', 'Commercial crude'], ['spr', 'Strategic reserve (SPR)'], ['gasoline', 'Gasoline'], ['distillate', 'Distillates'], ['jet', 'Jet fuel'], ['propane', 'Propane'], ['total_ex_spr', 'All oils, excluding SPR']];
  const FN = [['production', 'Crude production', 'k b/d'], ['runs', 'Refinery crude runs', 'k b/d'], ['utilization', 'Refinery utilisation', '%'], ['crude_imports', 'Crude imports', 'k b/d'], ['crude_exports', 'Crude exports', 'k b/d'], ['net_imports', 'Net imports, all oils', 'k b/d'], ['demand', 'Products supplied (demand)', 'k b/d'], ['gasoline_demand', 'Gasoline demand', 'k b/d'], ['distillate_demand', 'Distillate demand', 'k b/d'], ['jet_demand', 'Jet fuel demand', 'k b/d']];
  m.innerHTML = head(`EIA Weekly Petroleum Status Report, week to ${e.week}; Weekly Natural Gas Storage Report. Updated ${d.updated}.`) + `<div class="col-main rv">
    <section class="sec"><h2>US oil inventories</h2><p class="lede" style="font-size:14px">Million barrels, week to ${e.week}.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Stock</th><th>Level</th><th>Week</th><th>Year ago</th><th>Against a year ago</th></tr></thead><tbody>${SN.filter(([k2]) => st[k2]).map(([k2, n]) => { const x = st[k2]; return `<tr><td class="l">${n}</td><td>${o.num(x.now, 1)}</td><td>${x.chg >= 0 ? `<span class="mv--down">${o.sgn(x.chg, 1)}</span>` : `<span class="mv--up">${o.sgn(x.chg, 1)}</span>`}</td><td>${o.num(x.yr, 1)}</td><td>${o.pct(x.yr_pct, 1)}</td></tr>`; }).join('')}</tbody></table></div><p class="src">A draw (stocks falling) is shown in green because it is bullish for prices; a build in red.</p></section>
    <section class="sec"><h2>Flows</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Flow</th><th>This week</th><th>Last week</th><th>Year ago</th><th>4-week average</th></tr></thead><tbody>${FN.filter(([k2]) => fl[k2]).map(([k2, n, u]) => { const x = fl[k2]; const dec = u === '%' ? 1 : 0; return `<tr><td class="l">${n}<small>${u}</small></td><td>${o.num(x.now, dec)}</td><td>${o.num(x.wk, dec)}</td><td>${o.num(x.yr, dec)}</td><td>${o.num(x.avg4, dec)}</td></tr>`; }).join('')}</tbody></table></div></section>
    ${gas ? `<section class="sec"><h2>Natural gas in storage</h2><p class="lede" style="font-size:14px">Billion cubic feet, week to ${o.fmtD(gas.week)}, released ${gas.released}.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Region</th><th>Level</th><th>Week</th><th>Five-year average</th><th>Against the average</th><th>Against a year ago</th></tr></thead><tbody>${gas.regions.map(x => `<tr><td class="l">${x.name}</td><td>${o.num(x.now, 0)}</td><td>${o.sgn(x.chg, 0)}</td><td>${o.num(x.avg5, 0)}</td><td>${o.mv(x.vs5, 1)}</td><td>${o.mv(x.vsyr, 1)}</td></tr>`).join('')}</tbody></table></div><div class="chart-box" id="gbar"></div></section>` : ''}
    <section class="sec"><h2>History</h2><p class="lede" style="font-size:14px" id="hl"></p><div class="ctl"><select class="inp" id="hs"></select></div><div class="chart-box" id="hch"></div><p class="readout" id="hr"></p></section>
    <section class="sec"><h2>Global balances</h2><div class="prose"><p>The monthly balance reports set the supply and demand narrative. Their figures are not published in a free machine-readable form, so the dates are tracked here and the reports linked at the source.</p><ul>
      <li><a href="https://www.usda.gov/oce/commodity/wasde" target="_blank" rel="noopener"><b>USDA WASDE</b></a>: world grain, oilseed, cotton, sugar and livestock balances, monthly at 12:00 ET. ${(d.calendar || []).filter(c => /WASDE/.test(c.what)).map(c => 'Next: ' + o.fmtD(c.d) + '.').slice(0, 1).join('')}</li>
      <li><a href="https://www.opec.org/monthly-oil-market-report.html" target="_blank" rel="noopener"><b>OPEC Monthly Oil Market Report</b></a>: demand forecasts and secondary-source production of every member, mid-month.</li>
      <li><a href="https://www.iea.org/topics/oil-market-report" target="_blank" rel="noopener"><b>IEA Oil Market Report</b></a>: world supply, demand and OECD stocks, mid-month.</li>
      <li><a href="https://www.eia.gov/outlooks/steo/" target="_blank" rel="noopener"><b>EIA Short-Term Energy Outlook</b></a>: US and world oil and gas balances, early each month.</li>
      <li><a href="https://www.lme.com/en/market-data/reports-and-data/warehouse-and-stocks-reports" target="_blank" rel="noopener"><b>LME warehouse stocks</b></a>: daily base-metal inventories and cancelled warrants (subscription data; follow COMEX copper's curve on this site as a proxy).</li></ul></div></section>
    </div><aside class="col-side rv"><h2 class="side-title">This week</h2><ul class="kpi">
      ${st.crude ? `<li class="kpi__item"><span class="kpi__name">Commercial crude</span><span class="kpi__level">${o.sgn(st.crude.chg, 1)}m bbl</span><span class="kpi__chg">${o.num(st.crude.now, 1)}m in store</span></li>` : ''}
      ${st.gasoline ? `<li class="kpi__item"><span class="kpi__name">Gasoline</span><span class="kpi__level">${o.sgn(st.gasoline.chg, 1)}m bbl</span></li>` : ''}
      ${st.distillate ? `<li class="kpi__item"><span class="kpi__name">Distillates</span><span class="kpi__level">${o.sgn(st.distillate.chg, 1)}m bbl</span></li>` : ''}
      ${fl.utilization ? `<li class="kpi__item"><span class="kpi__name">Refinery utilisation</span><span class="kpi__level">${o.num(fl.utilization.now, 1)}%</span></li>` : ''}
      ${gas ? `<li class="kpi__item"><span class="kpi__name">Gas injection</span><span class="kpi__level">${o.sgn(gas.regions[0].chg, 0)} bcf</span><span class="kpi__chg">${o.pct(gas.regions[0].vs5, 1)} vs 5-year</span></li>` : ''}
    </ul>${sideCal(d.calendar, 10)}</aside>`;
  if (gas) { const draw = () => o.hbars(o.$('#gbar'), gas.regions.map(x => [x.name, x.vs5]), { labelW: 190, fmt: v => o.sgn(v, 1) + '%' }); draw(); o.onResize(draw); }
  const H = d.hist || [];
  const opts = [['crude', 'Commercial crude, m bbl'], ['gasoline', 'Gasoline, m bbl'], ['distillate', 'Distillates, m bbl'], ['spr', 'SPR, m bbl'], ['gas', 'Natural gas storage, bcf'], ['utilization', 'Refinery utilisation, %'], ['production', 'Crude production, k b/d'], ['demand', 'Products supplied, k b/d']];
  if (H.length < 3) { o.$('#hl').textContent = `The weekly snapshots are archived from the first update on; ${H.length} week${H.length === 1 ? '' : 's'} so far. The chart fills in as the weeks pass.`; }
  else o.$('#hl').textContent = `Every weekly report archived since ${o.fmtD(H[0].w)}.`;
  o.$('#hs').innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const draw = () => { const k2 = o.$('#hs').value; if (H.length < 2) { o.$('#hch').innerHTML = ''; return; } const x = H.map(h => h.w), v = H.map(h => h[k2] ?? null); o.lineChart(o.$('#hch'), { x, series: [{ v, width: 1.6 }], h: 200, read: i => o.$('#hr').innerHTML = `Week to ${o.fmtD(x[i])}: ${o.num(v[i], 1)}` }); };
  o.$('#hs').onchange = draw; draw(); o.onResize(draw);
}

async function secLog(m, head) {
  const o = O(); const d = await load('logistics.json');
  if (!d) { m.innerHTML = head('') + o.fail(); return; }
  const cps = d.chokepoints || [];
  m.innerHTML = head(`IMF PortWatch (satellite AIS ship tracking), Yahoo Finance. Updated ${d.updated}.`) + `<div class="col-main rv">
    <section class="sec"><h2>Chokepoints</h2><p class="lede" style="font-size:14px">Ships transiting each day, seven-day average, against the average of the past year.${d.chokepoints_stale ? ' PortWatch did not answer on the last update: figures from the previous one.' : ''}</p>
      ${cps.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Passage</th><th class="l">Status</th><th>Ships a day</th><th>Against 1-year average</th><th>Against a year ago</th><th>Tankers a day</th></tr></thead><tbody>${cps.map(c => `<tr><td class="l">${c.name}<small>${o.esc(c.why)}</small></td><td class="l">${statusTag(c.status)}</td><td>${o.num(c.a7, 1)}</td><td>${o.mv(c.vs_avg, 1)}</td><td>${o.mv(c.yoy, 1)}</td><td>${o.num(c.tank7, 1)}</td></tr>`).join('')}</tbody></table></div><p class="src">Data to ${o.fmtD(cps[0].asof)}. PortWatch publishes with a lag of a few days.</p>
      <div class="ctl"><select class="inp" id="cs">${cps.map(c => `<option value="${c.key}">${c.name}</option>`).join('')}</select></div><div class="chart-box" id="cch"></div>${legend([['l', 'All ships'], ['ld', 'Tankers']])}<p class="readout" id="crd"></p>` : o.fail('PortWatch data not available yet.')}</section>
    <section class="sec"><h2>Freight</h2><p class="lede" style="font-size:14px">The Baltic indices themselves are licensed; these listed instruments track them.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Instrument</th><th>Last</th><th>Day</th><th>Month</th><th>3 months</th><th>One year</th></tr></thead><tbody>${d.freight.map(f => `<tr><td class="l">${f.name}<small>${o.esc(f.what)}</small></td><td>${o.num(f.last, 2)}</td><td>${o.mv(f.d1)}</td><td>${o.mv(f.m1)}</td><td>${o.mv(f.m3)}</td><td>${o.mv(f.y1)}</td></tr>`).join('')}</tbody></table></div>
      <div class="ctl"><select class="inp" id="fs">${d.freight.map(f => `<option value="${f.t}">${f.name}</option>`).join('')}</select></div><div class="chart-box" id="fch"></div><p class="readout" id="frd"></p></section>
    </div><aside class="col-side rv"><h2 class="side-title">Status</h2><ul class="kpi">${cps.map(c => `<li class="kpi__item"><span class="kpi__name">${c.name}</span><span class="kpi__level">${o.isNum(c.vs_avg) ? o.mv(c.vs_avg, 0) : '–'}</span><span class="kpi__chg">${c.status}</span></li>`).join('')}</ul><p class="side-src">Seven-day average of daily transits against the past year.</p></aside>`;
  const C = Object.fromEntries(cps.map(c => [c.key, c])); const F = Object.fromEntries(d.freight.map(f => [f.t, f]));
  const draw = () => {
    if (cps.length) { const c = C[o.$('#cs').value]; o.lineChart(o.$('#cch'), { x: c.hist.d, series: [{ v: c.hist.tk, dash: true }, { v: c.hist.v, width: 1.6 }], h: 220, read: i => o.$('#crd').innerHTML = `${o.fmtD(c.hist.d[i])}: ${o.num(c.hist.v[i], 1)} ships a day, ${o.num(c.hist.tk[i], 1)} tankers` }); }
    if (d.freight.length) { const f = F[o.$('#fs').value]; o.lineChart(o.$('#fch'), { x: f.hist.d, series: [{ v: f.hist.v, width: 1.6 }], h: 200, read: i => o.$('#frd').innerHTML = `${o.fmtD(f.hist.d[i])}: ${o.num(f.hist.v[i], 2)}` }); }
  };
  if (cps.length) o.$('#cs').onchange = draw; if (d.freight.length) o.$('#fs').onchange = draw; draw(); o.onResize(draw);
}

async function secPos(m, head) {
  const o = O(); const d = await load('positioning.json');
  if (!d?.rows?.length) { m.innerHTML = head('') + o.fail(); return; }
  m.innerHTML = head(`CFTC disaggregated Commitments of Traders, futures only, positions as of ${o.fmtD(d.rows[0].asof)}. Updated ${d.updated}.`) + `<div class="col-main rv">
    <section class="sec"><h2>Funds against producers</h2><p class="lede" style="font-size:14px">Managed money: hedge funds and CTAs. Producers: commercial hedgers, usually short. Percentile: the funds' net position against its three-year range.</p><div class="ctl__row" id="pg" style="margin-top:14px"></div>
      <div class="tbl-wrap"><table class="tbl" id="pt"><thead><tr><th class="l" data-k="name" data-dir="1">Market</th><th data-k="mm_net">Funds, net</th><th data-k="mm_chg">Week</th><th data-k="mm_pct_oi">% of open interest</th><th data-k="pctile3y">Percentile, 3 years</th><th data-k="prod_net">Producers, net</th><th data-k="oi">Open interest</th><th data-k="oi_chg_pct">OI, week</th><th class="l">Funds, 3 years</th></tr></thead><tbody></tbody></table></div>
      <p class="src">Open interest rising with price confirms a move with new money; falling open interest during a rally points to short covering.</p></section>
    <section class="sec"><h2>Crowding</h2><div class="chart-box" id="pc"></div></section>
    </div><aside class="col-side rv"><h2 class="side-title">Extremes</h2><div id="ext"></div></aside>`;
  let g = 'All'; const groups = ['All', ...new Set(d.rows.map(r => r.group))];
  const render = r => `<tr><td class="l"><a href="${o.link('commodities/' + r.key + '/')}">${r.name}</a>${r.flag ? `<small>${r.flag}</small>` : ''}</td><td>${k(r.mm_net)}</td><td>${ks(r.mm_chg)}</td><td>${o.isNum(r.mm_pct_oi) ? o.sgn(r.mm_pct_oi, 1) + '%' : '–'}</td><td style="white-space:nowrap">${pbar(r.pctile3y)}</td><td>${k(r.prod_net)}</td><td>${k(r.oi)}</td><td>${o.mv(r.oi_chg_pct, 1)}</td><td class="l">${sparkSvg(r.hist_mm)}</td></tr>`;
  const drawT = () => o.sortableTable(o.$('#pt'), g === 'All' ? d.rows : d.rows.filter(r => r.group === g), null, render);
  o.chips(o.$('#pg'), groups, g, v => { g = v; drawT(); }); drawT();
  const ex = d.rows.filter(r => r.flag);
  o.$('#ext').innerHTML = ex.length ? `<ul class="kpi">${ex.map(r => `<li class="kpi__item"><a href="${o.link('commodities/' + r.key + '/')}"><span class="kpi__name">${r.name}</span><span class="kpi__level" style="display:block">${Math.round(r.pctile3y)}th</span><span class="kpi__chg">${r.flag}</span></a></li>`).join('')}</ul>` : '<p class="muted" style="font-size:14px;margin-top:12px">No market is at a three-year extreme this week.</p>';
  const drawC = () => o.hbars(o.$('#pc'), [...d.rows].filter(r => o.isNum(r.pctile3y)).sort((a, b) => b.pctile3y - a.pctile3y).map(r => [r.name, r.pctile3y - 50]), { labelW: 150, fmt: v => Math.round(v + 50) + 'th' });
  drawC(); o.onResize(drawC);
}

async function secMacro(m, head) {
  const o = O(); const d = await load('macro.json');
  if (!d) { m.innerHTML = head('') + o.fail(); return; }
  const dl = d.dollar, ch = d.china || {};
  m.innerHTML = head(`Yahoo Finance, FRED (OECD trade data). Updated ${d.updated}.`) + `<div class="col-main rv">
    ${dl ? `<section class="sec"><h2>The dollar</h2><p class="lede" style="font-size:14px">Most commodities are priced in dollars: a weaker dollar makes them cheaper for everyone else and tends to lift prices. The link breaks when supply shocks dominate.</p><div class="kstrip">${kv('Dollar index', o.num(dl.last, 2), `${o.mv(dl.d1)} on the day`) + kv('Dollar, year to date', o.mv(dl.ytd)) + kv('Commodity basket, YTD', o.mv(dl.basket_ytd), 'equal weight, 23 futures') + kv('Correlation, 60 days', o.num(dl.corr60), `five-year average ${o.num(dl.corr_avg5)}`)}</div>
      <h3 style="margin-top:26px">Basket against the dollar, rebased</h3><div class="chart-box" id="bch"></div>${legend([['l', 'Commodity basket'], ['ld', 'Dollar index']])}<p class="readout" id="brd"></p>
      <h3 style="margin-top:26px">Rolling correlation, 60 days</h3><div class="chart-box" id="rch"></div><p class="readout" id="rrd"></p>
      <h3 style="margin-top:26px">Each market's link to the dollar, one year</h3><div class="chart-box" id="cch"></div></section>` : ''}
    <section class="sec"><h2>China</h2><p class="lede" style="font-size:14px">The largest buyer of copper, iron ore, soybeans and crude: these markets are the quickest read of its physical demand.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Market</th><th>Last</th><th>Day</th><th>Month</th><th>Year to date</th><th>One year</th></tr></thead><tbody>${(ch.markets || []).map(x => `<tr><td class="l">${x.name}<small>${o.esc(x.what)}</small></td><td>${o.num(x.last, x.t === 'CNY=X' ? 4 : 2)}</td><td>${o.mv(x.d1)}</td><td>${o.mv(x.m1)}</td><td>${o.mv(x.ytd)}</td><td>${o.mv(x.y1)}</td></tr>`).join('')}</tbody></table></div>
      <div class="ctl"><select class="inp" id="chs">${(ch.markets || []).map(x => `<option value="${x.t}">${x.name}</option>`).join('')}</select></div><div class="chart-box" id="chch"></div><p class="readout" id="chr"></p>
      ${(ch.trade || []).length ? `<h3 style="margin-top:26px">Trade, change on a year earlier</h3><p class="lede" style="font-size:14px">${ch.trade.map(t => `${t.name}: ${o.pct(t.yoy, 1)} in ${t.last_month} ($${o.num(t.last_bn, 0)}bn)`).join('. ')}.</p><div class="chart-box" id="trch"></div>${legend([['l', 'Imports'], ['ld', 'Exports']])}<p class="readout" id="trr"></p>` : ''}</section>
    <section class="sec"><h2>Headlines</h2><p class="lede" style="font-size:14px">Commodity news from Yahoo Finance, tagged by theme. Pick a theme to filter.</p><div class="ctl__row" id="nt" style="margin-top:14px"></div><div class="list" id="nl"></div></section>
    </div><aside class="col-side rv"><h2 class="side-title">China barometers</h2><ul class="kpi">${(ch.markets || []).map(x => `<li class="kpi__item"><span class="kpi__name">${x.name}</span><span class="kpi__level">${o.mv(x.m1)}</span><span class="kpi__chg">over a month</span></li>`).join('')}</ul></aside>`;
  const draw = () => {
    if (dl) {
      const p = dl.pair; o.lineChart(o.$('#bch'), { x: p.d, series: [{ v: p.x, dash: true }, { v: p.b, width: 1.6 }], h: 220, base: 100, read: i => o.$('#brd').innerHTML = `${o.fmtD(p.d[i])}: basket ${o.num(p.b[i], 1)}, dollar ${o.num(p.x[i], 1)}` });
      o.lineChart(o.$('#rch'), { x: dl.roll.d, series: [{ v: dl.roll.v }], h: 160, ticks: [-1, -.5, 0, .5, 1], read: i => o.$('#rrd').innerHTML = `${o.fmtD(dl.roll.d[i])}: ${o.num(dl.roll.v[i])}` });
      o.hbars(o.$('#cch'), dl.table.map(t => [t.name, t.corr]), { labelW: 150, fmt: v => o.num(v) });
    }
    const M = Object.fromEntries((ch.markets || []).map(x => [x.t, x])); const x = M[o.$('#chs')?.value];
    if (x) o.lineChart(o.$('#chch'), { x: x.hist.d, series: [{ v: x.hist.v, width: 1.6 }], h: 200, read: i => o.$('#chr').innerHTML = `${o.fmtD(x.hist.d[i])}: ${o.num(x.hist.v[i], 4)}` });
    const tr = ch.trade || []; if (tr.length) { const imp = tr[0], exp = tr[1]; const xs = imp.hist.d; const em = exp ? Object.fromEntries(exp.hist.d.map((dd, i) => [dd, exp.hist.v[i]])) : {}; const ev = xs.map(dd => em[dd] ?? null);
      o.lineChart(o.$('#trch'), { x: xs, xfmt: o.fmtM, series: [{ v: ev, dash: true }, { v: imp.hist.v, width: 1.6 }], h: 190, fmtY: t => t + '%', read: i => o.$('#trr').innerHTML = `${o.fmtM(xs[i])}: imports ${o.pct(imp.hist.v[i], 1)}, exports ${o.pct(ev[i], 1)}` }); }
  };
  if (o.$('#chs')) o.$('#chs').onchange = draw; draw(); o.onResize(draw);
  const N = d.news || []; const tags = ['All', ...[...new Set(N.flatMap(n => n.tags))]]; let tg = 'All';
  const ago = s => { const t = new Date(s).getTime(); if (!isFinite(t)) return ''; const mm = (Date.now() - t) / 6e4; return mm < 60 ? Math.max(1, Math.round(mm)) + ' min ago' : mm < 1440 ? Math.round(mm / 60) + ' h ago' : Math.round(mm / 1440) + ' d ago'; };
  const drawN = () => { const list = tg === 'All' ? N : N.filter(n => n.tags.includes(tg)); o.$('#nl').innerHTML = list.length ? list.slice(0, 40).map(n => `<a href="${o.esc(n.u || '#')}" target="_blank" rel="noopener"><span class="t">${o.esc(n.t)}<span class="d" style="display:block">${o.esc(n.p)}${n.tags.length ? ' · ' + n.tags.join(', ') : ''}</span></span><span class="m">${ago(n.d)}</span></a>`).join('') : o.fail('No headline in this theme today.'); };
  o.chips(o.$('#nt'), tags.map(t => [t, t === 'All' ? `All <small>${N.length}</small>` : `${t} <small>${N.filter(n => n.tags.includes(t)).length}</small>`]), tg, v => { tg = v; drawN(); }); drawN();
}

async function secWeather(m, head) {
  const o = O(); const d = await load('weather.json');
  if (!d?.locs?.length) { m.innerHTML = head('') + o.fail(); return; }
  const s = d.summary || {};
  const an = v => o.isNum(v) ? `<span class="${v >= 0 ? 'mv--down' : 'mv--up'}" style="color:${v >= 0 ? 'var(--down-text)' : '#4aa3ff'}">${o.sgn(v, 1)}°C</span>` : '–';
  const pp = v => o.isNum(v) ? `${Math.round(v)}%` : '–';
  const rowsFor = role => d.locs.filter(l => l.role === role).map(l => `<tr data-k="${l.key}"><td class="l">${l.name}<small>${o.esc(l.markets)}</small></td><td>${an(l.w1_2?.t_anom)}</td><td>${an(l.w3_5?.t_anom)}</td>${role === 'gas' ? `<td>${o.num(l.w1_2?.hdd, 0)}<small>normal ${o.num(l.w1_2?.hdd_n, 0)}</small></td><td>${o.num(l.w1_2?.cdd, 0)}<small>normal ${o.num(l.w1_2?.cdd_n, 0)}</small></td>` : `<td>${o.num(l.w1_2?.p, 0)} mm<small>${pp(l.w1_2?.p_pct)} of normal</small></td><td>${o.num(l.w3_5?.p, 0)} mm<small>${pp(l.w3_5?.p_pct)} of normal</small></td>`}</tr>`).join('');
  m.innerHTML = head(`Open-Meteo: 16-day forecast, then the ECMWF ensemble mean to day 35; normals from ten years of ERA5 reanalysis. Updated ${d.updated}.`) + `<div class="col-main rv">
    <section class="sec"><h2>Gas and power demand</h2><p class="lede" style="font-size:14px">Heating degree days (HDD): how far the daily mean falls below 18°C, summed. More HDD than normal means more gas burnt for heat; cooling degree days (CDD) do the same for air conditioning in summer.</p>
      <div class="kstrip">${kv('US HDD, next 14 days', o.num(s.us_hdd, 0), `normal ${o.num(s.us_hdd_n, 0)}`) + kv('US HDD, weeks 3 to 5', o.num(s.us_hdd35, 0), `normal ${o.num(s.us_hdd35_n, 0)}`) + kv('Europe HDD, next 14 days', o.num(s.eu_hdd, 0), `normal ${o.num(s.eu_hdd_n, 0)}`) + kv('US CDD, next 14 days', o.num(s.us_cdd, 0), `normal ${o.num(s.us_cdd_n, 0)}`)}</div>
      <div class="tbl-wrap"><table class="tbl wx"><thead><tr><th class="l">City</th><th>Weeks 1–2</th><th>Weeks 3–5</th><th>HDD, 14 days</th><th>CDD, 14 days</th></tr></thead><tbody>${rowsFor('gas')}</tbody></table></div><p class="src">US total: New York, Chicago, Atlanta and Dallas. Europe: London and Berlin. Temperature columns: mean against the ten-year normal for the same dates.</p></section>
    <section class="sec"><h2>Crop regions</h2><p class="lede" style="font-size:14px">Rainfall against normal matters most during planting, flowering and grain fill: dry spells in the US summer, in Brazil from October to March, in West Africa during the cocoa main crop.</p>
      <div class="tbl-wrap"><table class="tbl wx"><thead><tr><th class="l">Region</th><th>Weeks 1–2</th><th>Weeks 3–5</th><th>Rain, 14 days</th><th>Rain, weeks 3–5</th></tr></thead><tbody>${rowsFor('crop')}</tbody></table></div></section>
    <section class="sec"><h2>Daily outlook</h2><div class="ctl"><select class="inp" id="ws">${d.locs.map(l => `<option value="${l.key}">${l.name}</option>`).join('')}</select></div>
      <h3 style="margin-top:20px">Temperature</h3><div class="chart-box" id="wt"></div>${legend([['l', 'Forecast'], ['ld', 'Ten-year normal']])}<p class="readout" id="wtr"></p>
      <h3 style="margin-top:26px">Rainfall</h3><div class="chart-box" id="wp"></div><p class="readout" id="wpr"></p><p class="src">The dashed vertical line marks the switch from the deterministic forecast to the ensemble mean, which smooths day-to-day detail.</p></section>
    </div><aside class="col-side rv"><h2 class="side-title">Biggest anomalies</h2><ul class="kpi" id="wside"></ul><p class="side-src">Mean temperature against normal, next 14 days.</p></aside>`;
  const L = Object.fromEntries(d.locs.map(l => [l.key, l]));
  o.$('#wside').innerHTML = [...d.locs].filter(l => o.isNum(l.w1_2?.t_anom)).sort((a, b) => Math.abs(b.w1_2.t_anom) - Math.abs(a.w1_2.t_anom)).slice(0, 6).map(l => `<li class="kpi__item"><span class="kpi__name">${l.name}</span><span class="kpi__level">${an(l.w1_2.t_anom)}</span><span class="kpi__chg">${o.esc(l.markets)}</span></li>`).join('');
  o.$$('.wx tbody tr').forEach(tr => { tr.style.cursor = 'pointer'; tr.onclick = () => { o.$('#ws').value = tr.dataset.k; draw(); o.$('#ws').scrollIntoView({ behavior: 'smooth', block: 'center' }); }; });
  const draw = () => {
    const l = L[o.$('#ws').value]; const x = l.days; const mk = l.ens_from < x.length ? [{ d: x[l.ens_from], label: 'Ensemble' }] : [];
    o.lineChart(o.$('#wt'), { x, xfmt: o.fmtDS, xlabels: xl(x.length, 5), series: [{ v: l.nt, dash: true }, { v: l.t, width: 1.8 }], h: 200, fmtY: t => t + '°', marks: mk, read: i => o.$('#wtr').innerHTML = `${o.fmtD(x[i])}: ${o.num(l.t[i], 1)}°C, normal ${o.num(l.nt[i], 1)}°C` });
    o.barChart(o.$('#wp'), { cats: x, series: [{ type: 'out', v: l.p }, { type: 'line', v: l.np }], h: 160, catFmt: (dd, i) => i % 7 === 0 ? o.fmtDS(dd) : '', fmtY: v => v + 'mm', rest: 0, read: i => o.$('#wpr').innerHTML = `${o.fmtD(x[i])}: ${o.num(l.p[i], 1)} mm, normal ${o.num(l.np[i], 1)} mm` });
  };
  o.$('#ws').onchange = draw; draw(); o.onResize(draw);
}

async function secSeason(m, head) {
  const o = O(); const d = await load('index.json');
  if (!d) { m.innerHTML = head('') + o.fail(); return; }
  m.innerHTML = head(`Front-month futures, Yahoo Finance, since ${new Date().getFullYear() - 10}. Close of ${d.asof}.`) + `<div class="col-main rv">
    <section class="sec"><h2>One market</h2><div class="ctl"><select class="inp" id="ss">${d.rows.map(r => `<option value="${r.key}">${r.name}</option>`).join('')}</select></div><p class="lede" id="sl" style="font-size:14px"></p><div class="chart-box" id="sch"></div>${legend([['l', 'This year'], ['l', 'Last year (lighter)'], ['ld', 'Five-year average'], ['ld', 'Ten-year average (lighter)']])}<p class="readout" id="srd"></p></section>
    <section class="sec"><h2>Every market at today's date</h2><div class="tbl-wrap"><table class="tbl" id="st"><thead><tr><th class="l" data-k="name" data-dir="1">Market</th><th data-k="sea_cur">This year</th><th data-k="sea_avg5">Five-year path</th><th data-k="sea_dev">Gap</th><th data-k="sea_fwd">Next 30 days, average</th><th data-k="sea_up">Years up</th></tr></thead><tbody></tbody></table></div><p class="src">This year and the five-year path: change since the first close of the year. Next 30 days: average move over the coming 30 calendar days in each of the past ten years.</p></section>
    </div><aside class="col-side rv"><h2 class="side-title">Seasonal tailwinds</h2><div id="tw"></div></aside>`;
  o.sortableTable(o.$('#st'), d.rows, null, r => `<tr><td class="l"><a href="${o.link('commodities/' + r.key + '/')}">${r.name}</a></td><td>${o.pct(r.sea_cur, 1)}</td><td>${o.pct(r.sea_avg5, 1)}</td><td>${o.isNum(r.sea_dev) ? o.mv(r.sea_dev, 1, 'pt') : '–'}</td><td>${o.mv(r.sea_fwd, 1)}</td><td>${o.isNum(r.sea_up) ? `${r.sea_up} of ${r.sea_n}` : '–'}</td></tr>`);
  const tw = [...d.rows].filter(r => o.isNum(r.sea_fwd)).sort((a, b) => b.sea_fwd - a.sea_fwd);
  o.$('#tw').innerHTML = `<ul class="kpi">${[...tw.slice(0, 3), ...tw.slice(-3).reverse()].map(r => `<li class="kpi__item"><a href="${o.link('commodities/' + r.key + '/')}"><span class="kpi__name">${r.name}</span><span class="kpi__level" style="display:block">${o.mv(r.sea_fwd, 1)}</span><span class="kpi__chg">${r.sea_up} of ${r.sea_n} years up</span></a></li>`).join('')}</ul><p class="side-src">Average move over the next 30 days in the past ten years. Top three and bottom three.</p>`;
  const cache = {};
  const draw = async () => {
    const key = o.$('#ss').value; cache[key] = cache[key] || await load(`c/${key}.json`); const s = cache[key]?.season;
    if (!s) { o.$('#sch').innerHTML = o.fail('Not enough history.'); return; }
    o.$('#sl').innerHTML = `${o.isNum(s.dev5) ? `${s.cur_year} is ${o.sgn(s.dev5, 1)} points ${s.dev5 >= 0 ? 'above' : 'below'} the five-year path (${s.years5?.[0]}–${s.years5?.[1]}) at today's date.` : ''} ${o.isNum(s.fwd30_avg) ? `The next 30 days have averaged ${o.sgn(s.fwd30_avg, 1)}%, with gains in ${s.fwd30_up} of ${s.fwd30_n} years.` : ''}`;
    const x = s.grid;
    o.lineChart(o.$('#sch'), { x, xfmt: doyLabel, xlabels: xl(x.length, 5), h: 260, fmtY: t => t + '%', series: [{ v: s.last, opacity: .35, width: 1.2 }, { v: s.avg10, dash: true, opacity: .5 }, { v: s.avg5, dash: true }, { v: s.cur, width: 2 }],
      read: i => o.$('#srd').innerHTML = `${doyLabel(x[i])}: ${s.cur_year} ${o.pct(s.cur?.[i])}, ${s.cur_year - 1} ${o.pct(s.last?.[i])}, five-year ${o.pct(s.avg5?.[i])}, ten-year ${o.pct(s.avg10?.[i])}`, rest: s.today_i });
  };
  o.$('#ss').onchange = draw; draw(); o.onResize(draw);
}

return { commodities, commodity, commsec };
})());
