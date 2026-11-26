/* Opsilon Markets – Trading Part: edge tests, intraday backtests and the Topstep simulator,
   fundamentals dashboard, sizing calculator, trade journal, data and tools. */
window.PAGES = Object.assign(window.PAGES || {}, (function () {
const O = () => window.O;
const SUB = [
  ['trading/', 'Overview'], ['trading/edge/', 'Edge tests'], ['trading/intraday/', 'Intraday & Topstep'],
  ['trading/fundamentals/', 'Fundamentals'], ['trading/sizing/', 'Sizing'], ['trading/journal/', 'Journal'], ['trading/stack/', 'Data & stack']];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const NAMES = { wti: 'WTI crude', brent: 'Brent crude', natgas: 'Natural gas', gasoline: 'RBOB gasoline', heatingoil: 'Heating oil', gold: 'Gold', silver: 'Silver', copper: 'Copper', platinum: 'Platinum',
  corn: 'Corn', wheat: 'Wheat', soybeans: 'Soybeans', soymeal: 'Soybean meal', soyoil: 'Soybean oil', coffee: 'Coffee', cocoa: 'Cocoa', sugar: 'Sugar', cotton: 'Cotton', cattle: 'Live cattle', hogs: 'Lean hogs',
  crack321: '3-2-1 crack', crush: 'Soybean crush', brent_wti: 'Brent less WTI',
  usda_corn_ge: 'Corn, good or excellent', usda_soy_ge: 'Soybeans, good or excellent', usda_wwheat_ge: 'Winter wheat, good or excellent', usda_corn_planted: 'Corn planted', usda_corn_harvested: 'Corn harvested', usda_soy_planted: 'Soybeans planted' };
const nm = k => NAMES[k] || k;

function subnav(active) { const o = O(); return `<nav class="subnav col-full rv" aria-label="Trading Part">${SUB.map(([u, t]) => `<a class="chip${u === active ? ' on' : ''}" href="${o.link(u)}">${t}</a>`).join('')}</nav>`; }
async function load(p) { return O().data('trading/' + p).catch(() => null); }
function badge(v) { const c = v === 'Edge' ? 'st-up' : v === 'Weak' ? 'st-warn' : (v === 'No edge') ? 'st-down' : ''; return `<span class="badge ${c}">${v || '–'}</span>`; }
function kv(name, val, sub = '') { return `<div><div class="kpi__name">${name}</div><div class="kpi__level">${val}</div>${sub ? `<div class="kpi__chg">${sub}</div>` : ''}</div>`; }
const f2 = (v, d = 2) => O().isNum(v) ? O().num(v, d) : '–';
const pv = v => !O().isNum(v) ? '–' : v < 0.001 ? '<0.001' : O().num(v, 3);
function mockNote(d) { return d?.mock ? `<p class="note" style="border:1px solid var(--rule-strong);padding:12px 14px;margin-top:16px;font-size:14px">These figures come from the pipeline's mock mode (synthetic prices). The real verdicts appear after the next GitHub Actions run.</p>` : ''; }
function xl(n, k = 4) { if (n < 2) return [0]; const out = []; for (let i = 0; i < k; i++) out.push(Math.round(i * (n - 1) / (k - 1))); return [...new Set(out)]; }

/* ================================================================== OVERVIEW */
async function tradinghome() {
  const o = O(); const m = o.main();
  const [d, intra] = await Promise.all([load('index.json'), load('intraday.json')]);
  if (!d) { m.innerHTML = o.head({ title: 'Trading Part' }) + subnav('trading/') + o.fail(); return; }
  const c = d.counts || {};
  m.innerHTML = o.head({ title: 'Trading Part', short: false, lede: 'The commodity desk of Opsilon. Strategies from the academic literature tested for an edge on point-in-time data, intraday setups run through the Topstep combine rules, and the fundamentals that move crude, gas, metals and grains.', meta: `Figures to the close of ${d.asof ? o.fmtD(d.asof) : '–'}. Updated ${d.updated}.` }) +
    subnav('trading/') +
    `<div class="col-main rv">${mockNote(d)}
      <section class="sec"><h2>Is there an edge?</h2><div class="kstrip">${kv('Strategies tested', d.score.length)}${kv('Edge', c['Edge'] || 0, 'all four tests passed')}${kv('Weak', c['Weak'] || 0, 'two or three tests')}${kv('No edge', c['No edge'] || 0)}</div>
        <p class="lede" style="font-size:14px;margin-top:16px">Daily strategies, net of costs. Edge means: Sharpe above 0.3 on the last 40% of the data (never used to design the rule), Newey-West t above 2, timing that beats 300 random time shifts of the same positions (p below 0.05), and a deflated Sharpe above 0.90 after accounting for the ${d.n_trials} variants tried.</p>
        <div class="tbl-wrap"><table class="tbl" id="sc"><thead><tr><th class="l" data-k="name" data-dir="1">Strategy</th><th data-k="sharpe_oos">Sharpe, out of sample</th><th data-k="sharpe_is">In sample</th><th data-k="t_nw">t (NW)</th><th data-k="p_perm">Timing p</th><th data-k="dsr">Deflated Sharpe</th><th data-k="max_dd">Max drawdown</th><th class="l" data-k="verdict">Verdict</th></tr></thead><tbody></tbody></table></div>
        ${(d.pending || []).map(p => `<p class="src"><b>${o.esc(p.name)}</b>: not tested yet. ${o.esc(p.why)}</p>`).join('')}</section>
      <section class="sec"><h2>Intraday setups</h2><p class="lede" style="font-size:14px">Micro contracts, $150–250 of risk a trade, flat by 15:10 CT, costs and slippage included. Pass rate: share of 2,000 simulated $50K combines (60 trading days each) that hit the target without breaking a rule.</p><div id="intra"></div></section>
    </div>
    <aside class="col-side rv"><h2 class="side-title">No-trade windows</h2><div class="list" style="margin-top:0;border-top:0" id="cal"></div><p class="side-src">Tier 1 in bold: no new trade from 5 minutes before to 15 minutes after. Times ET.</p>
      <h2 class="side-title" style="margin-top:34px">Weather, days 6–10</h2><ul class="kpi" id="wx"></ul><p class="side-src">NOAA GFS via Open-Meteo. Gas-weighted heating degree days in ten US cities; rain in the corn belt. Normal: ten-year average.</p></aside>`;
  o.sortableTable(o.$('#sc'), d.score, null, r => `<tr><td class="l"><a href="${o.link('trading/edge/')}#${r.key}">${o.esc(r.name)}</a><small>${r.family} · ${r.freq}</small></td><td>${o.mv(r.sharpe_oos, 2, '')}</td><td>${f2(r.sharpe_is)}</td><td>${f2(r.t_nw)}</td><td>${pv(r.p_perm)}</td><td>${f2(r.dsr)}</td><td>${o.isNum(r.max_dd) ? o.num(r.max_dd, 1) + '%' : '–'}</td><td class="l">${badge(r.verdict)}</td></tr>`);
  const cal = d.calendar || [];
  o.$('#cal').innerHTML = cal.length ? cal.slice(0, 12).map(e => `<div><span class="t" style="font-size:14px">${e.tier === 1 ? '<b>' : ''}${o.esc(e.name)}${e.tier === 1 ? '</b>' : ''}</span><span class="m">${WD[(o.D(e.day).getDay() + 6) % 7]} ${o.fmtDS(e.day)}, ${e.t}</span></div>`).join('') : o.fail();
  const w = d.weather || {};
  const dev = (a, b) => o.isNum(a) && o.isNum(b) ? `${o.sgn(a - b, 0)} vs normal (${o.num(b, 0)})` : '';
  o.$('#wx').innerHTML = [['Heating degree days', w.hdd_6_10, w.hdd_6_10_norm, 0], ['Cooling degree days', w.cdd_6_10, w.cdd_6_10_norm, 0], ['Corn-belt rain, mm', w.rain_6_10, w.rain_6_10_norm, 1]]
    .map(([n, a, b, dd]) => `<li class="kpi__item"><span class="kpi__name">${n}</span><span class="kpi__level">${f2(a, dd)}</span><span class="kpi__chg">${dev(a, b)}</span></li>`).join('') +
    (o.isNum(w.hdd_rev) ? `<li class="kpi__item"><span class="kpi__name">HDD revision since yesterday</span><span class="kpi__level">${o.mv(w.hdd_rev, 1, '')}</span><span class="kpi__chg">colder forecast = bullish gas</span></li>` : '');
  const S = intra?.symbols || {};
  o.$('#intra').innerHTML = Object.keys(S).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Contract</th><th class="l">Setup</th><th>Trades</th><th>Avg R</th><th>P&amp;L</th><th>Placebo p</th><th>Pass rate</th><th class="l">Verdict</th></tr></thead><tbody>${Object.entries(S).flatMap(([s, v]) => Object.entries(v.setups).map(([k, x]) => `<tr><td class="l">${v.micro}<small>${v.src} ${v.freq}, ${o.fmtDS(v.from)} to ${o.fmtDS(v.to)}</small></td><td class="l"><a href="${o.link('trading/intraday/')}#${encodeURIComponent(s)}">${o.esc(x.label)}</a></td><td>${x.n}</td><td>${o.mv(x.avg_r, 2, 'R')}</td><td>${o.mv(x.pnl, 0, '$')}</td><td>${pv(x.p_placebo)}</td><td>${o.isNum(x.topstep?.pass) ? o.num(x.topstep.pass, 0) + '%' : '–'}</td><td class="l">${badge(x.verdict)}</td></tr>`)).join('')}</tbody></table></div>` : o.fail('No intraday bars yet: they build up from Yahoo (60 days of 5-minute bars), Databento or a Bloomberg export.');
}

/* ================================================================== EDGE DETAIL */
async function tradingedge() {
  const o = O(); const m = o.main();
  const d = await load('edge.json');
  if (!d) { m.innerHTML = o.head({ title: 'Edge tests' }) + subnav('trading/edge/') + o.fail(); return; }
  const keys = Object.keys(d.detail);
  let cur = (location.hash || '').slice(1); if (!d.detail[cur]) cur = keys[0];
  m.innerHTML = o.head({ crumbs: [['trading/', 'Trading Part'], [null, 'Edge tests']], title: 'Edge tests', short: false, lede: 'Each strategy from the commodity literature, rebuilt on point-in-time data and judged on four tests. In sample is the first 60% of the history; out of sample is the rest.', meta: `Updated ${d.updated}. ${d.n_trials} variants counted for the deflated Sharpe.` }) +
    subnav('trading/edge/') + `<div class="col-full rv"><div class="ctl__row" id="pick" style="margin:6px 0 10px;flex-wrap:wrap"></div></div><div class="col-main rv" id="body"></div><aside class="col-side rv" id="side"></aside>`;
  const draw = () => {
    const x = d.detail[cur]; history.replaceState(null, '', '#' + cur);
    o.$('#body').innerHTML = `<section class="sec"><h2>${o.esc(x.name)}</h2><p class="lede" style="font-size:15px">${o.esc(x.idea)}</p>
      <div class="kstrip">${kv('Verdict', badge(x.verdict))}${kv('Sharpe, out of sample', f2(x.sharpe_oos), `in sample ${f2(x.sharpe_is)}`)}${kv('t (Newey-West)', f2(x.t_nw), 'above 2 to count')}${kv('Timing p', pv(x.p_perm), 'random time shifts')}${kv('Deflated Sharpe', f2(x.dsr), 'above 0.90 to count')}</div>
      <h3 style="margin-top:26px">Growth of 1, net of costs</h3><div class="chart-box" id="eq"></div><p class="readout" id="eqr"></p>
      <h3 style="margin-top:26px">Calendar years</h3><div class="chart-box" id="yr"></div><p class="readout" id="yrr"></p>
      ${Object.keys(x.markets || {}).length > 1 ? `<h3 style="margin-top:26px">Sharpe by market</h3><div class="chart-box" id="mk"></div>` : ''}
      <h3 style="margin-top:26px">Where it comes from</h3><ul class="prose" style="padding-left:18px">${(x.papers || []).map(p => `<li>${o.esc(p)}</li>`).join('')}</ul></section>`;
    o.$('#side').innerHTML = `<h2 class="side-title">Statistics</h2><ul class="kpi">${[['Return a year', o.isNum(x.ann_ret) ? o.pct(x.ann_ret, 1) : '–'], ['Volatility', o.isNum(x.ann_vol) ? o.num(x.ann_vol, 1) + '%' : '–'], ['Full-period Sharpe', f2(x.sharpe)], ['Max drawdown', o.isNum(x.max_dd) ? o.num(x.max_dd, 1) + '%' : '–'], ['Winning days', o.isNum(x.hit) ? o.num(x.hit, 0) + '%' : '–'], ['Days in the market', o.isNum(x.days_active) ? o.num(x.days_active, 0) + '%' : '–'], ['Bootstrap p of the mean', pv(x.p_boot)], ['Skew', f2(x.skew)], ['History', x.start ? `${o.fmtM(x.start)} to ${o.fmtM(x.end)}` : '–'], ['Out of sample from', x.split ? o.fmtD(x.split) : '–']].map(([a, b]) => `<li class="kpi__item"><span class="kpi__name">${a}</span><span class="kpi__level">${b}</span></li>`).join('')}</ul>
      <p class="side-src">Positions volatility-scaled to 10% a year per market. Costs: one tick plus fees per unit traded.</p>`;
    if (x.eq) { const e = x.eq; o.lineChart(o.$('#eq'), { x: e.d, series: [{ v: e.v, width: 1.6 }], h: 240, base: 1, marks: [{ d: x.split, label: 'Out of sample' }], read: i => o.$('#eqr').innerHTML = `${o.fmtD(e.d[i])}: ${o.num(e.v[i], 3)}` }); }
    const ys = Object.keys(x.years || {}); if (ys.length) o.barChart(o.$('#yr'), { cats: ys, series: [{ type: 'sign', v: ys.map(y => x.years[y]) }], h: 170, catFmt: (l, i) => (i % Math.ceil(ys.length / 10) === 0 ? "'" + l.slice(2) : ''), fmtY: v => v + '%', read: i => o.$('#yrr').innerHTML = `${ys[i]}: ${o.pct(x.years[ys[i]], 1)}` });
    const mk = Object.entries(x.markets || {}); if (mk.length > 1) o.hbars(o.$('#mk'), mk.sort((a, b) => (b[1].sharpe ?? -9) - (a[1].sharpe ?? -9)).map(([k, v]) => [nm(k), v.sharpe]), { labelW: 150, fmt: v => o.num(v, 2) });
  };
  o.chips(o.$('#pick'), keys.map(k => [k, d.detail[k].name.split(' (')[0].split(',')[0]]), cur, v => { cur = v; draw(); });
  draw(); o.onResize(draw);
}

/* ================================================================== INTRADAY & TOPSTEP */
async function tradingintraday() {
  const o = O(); const m = o.main();
  const d = await load('intraday.json');
  const S = d?.symbols || {};
  const R = d?.rules || {};
  m.innerHTML = o.head({ crumbs: [['trading/', 'Trading Part'], [null, 'Intraday & Topstep']], title: 'Intraday & Topstep', short: false, lede: 'One backtester for every setup, then every trade list run through the Topstep combine rules. If a setup breaks a rule in the backtest, it breaks the combine.', meta: d ? `Updated ${d.updated}.` : '' }) +
    subnav('trading/intraday/') + `<div class="col-full rv"><div class="ctl__row" id="sym" style="margin:6px 0 10px"></div></div><div class="col-main rv" id="body"></div>
    <aside class="col-side rv"><h2 class="side-title">Combine rules used</h2><ul class="kpi">${[['Account', o.money(R.start_balance)], ['Profit target', o.money(R.profit_target)], ['Trailing max loss', o.money(R.max_loss_trailing), 'on the end-of-day high, locks at the start balance'], ['Daily loss limit', R.daily_loss_limit ? o.money(R.daily_loss_limit) : 'none'], ['Consistency', o.isNum(R.consistency) ? `best day under ${Math.round(R.consistency * 100)}% of profit` : '–'], ['Flat by', (R.flat_by || '') + ' CT'], ['Risk a trade', d ? `${o.money(d.risk[0])}–${o.money(d.risk[1])}` : '–']].map(([a, b, c]) => `<li class="kpi__item"><span class="kpi__name">${a}</span><span class="kpi__level">${b}</span>${c ? `<span class="kpi__chg">${c}</span>` : ''}</li>`).join('')}</ul>
    <p class="side-src">Edit them in pipeline/trading/config.py (TOPSTEP). Check topstep.com: the rules change.</p></aside>`;
  if (!Object.keys(S).length) { o.$('#body').innerHTML = o.fail('No intraday bars yet. They come from Yahoo (60 days of 5-minute bars, accumulated night after night), Databento minute bars, or a Bloomberg export dropped in data/import/.'); return; }
  let cur = decodeURIComponent((location.hash || '').slice(1)); if (!S[cur]) cur = Object.keys(S)[0];
  const draw = () => {
    const v = S[cur]; history.replaceState(null, '', '#' + encodeURIComponent(cur));
    const a = v.all || {}; const ts = a.topstep || {};
    o.$('#body').innerHTML = `<section class="sec"><h2>${v.micro}, all setups</h2><p class="lede" style="font-size:14px">${v.bars.toLocaleString('en-US')} ${v.freq} bars from ${v.src}, ${o.fmtD(v.from)} to ${o.fmtD(v.to)}. Skipped: ${v.skipped.blackout} entries inside a news window, ${v.skipped.too_risky} that needed more than $250 of risk for one contract.</p>
      <div class="kstrip">${kv('Trades', a.n ?? 0)}${kv('Win rate', o.isNum(a.win) ? o.num(a.win, 0) + '%' : '–')}${kv('Avg R', o.isNum(a.avg_r) ? o.num(a.avg_r, 2) : '–')}${kv('P&amp;L', o.mv(a.pnl, 0, '$'))}${kv('Combine pass rate', o.isNum(ts.pass) ? o.num(ts.pass, 0) + '%' : '–', o.isNum(ts.days_to_pass) ? `median ${ts.days_to_pass} days` : '')}</div>
      <div class="chart-box" id="eqa" style="margin-top:18px"></div><p class="readout" id="eqar"></p></section>
      ${Object.entries(v.setups).map(([k, x]) => `<section class="sec"><h2>${o.esc(x.label)} ${badge(x.verdict)}</h2><p class="lede" style="font-size:14px">${o.esc(x.desc)}</p>
        <div class="kstrip">${kv('Trades', x.n)}${kv('Win rate', o.num(x.win, 0) + '%')}${kv('Avg R', o.num(x.avg_r, 2), `t ${f2(x.t)}`)}${kv('Profit factor', f2(x.pf))}${kv('Placebo p', pv(x.p_placebo), 'random direction')}</div>
        <div class="two" style="margin-top:18px;gap:24px"><div><h3>P&amp;L by entry hour, CT</h3><div class="chart-box" id="h-${k}"></div></div><div><h3>Topstep combine, 2,000 runs</h3><div id="t-${k}"></div></div></div>
        <div class="chart-box" id="e-${k}" style="margin-top:14px"></div><p class="readout" id="er-${k}"></p></section>`).join('')}
      <section class="sec"><h2>Last trades</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Day</th><th class="l">Setup</th><th>Side</th><th>Qty</th><th>Entry</th><th>Fill</th><th>Exit</th><th class="l">Why</th><th>R</th><th>P&amp;L</th></tr></thead><tbody>${(v.last_trades || []).slice().reverse().map(t => `<tr><td class="l">${o.fmtDS(t.day)}</td><td class="l">${t.setup}</td><td>${t.side > 0 ? 'Long' : 'Short'}</td><td>${t.qty}</td><td>${t.entry_t}</td><td>${o.num(t.fill, 3)}</td><td>${o.num(t.exit_px, 3)}</td><td class="l">${t.exit}</td><td>${o.mv(t.r, 2, '')}</td><td>${o.mv(t.pnl, 0, '$')}</td></tr>`).join('')}</tbody></table></div></section>`;
    if (a.eq) o.lineChart(o.$('#eqa'), { x: a.eq.d, series: [{ v: a.eq.v, width: 1.6 }], h: 200, base: 0, fmtY: t => '$' + t, read: i => o.$('#eqar').innerHTML = `${o.fmtD(a.eq.d[i])}: ${o.money(a.eq.v[i])} cumulative` });
    Object.entries(v.setups).forEach(([k, x]) => {
      const hrs = Object.keys(x.by_hour || {}).sort((p, q) => p - q);
      o.barChart(o.$('#h-' + k), { cats: hrs, series: [{ type: 'sign', v: hrs.map(h => x.by_hour[h]) }], h: 150, catFmt: l => l + 'h', fmtY: t => '$' + t, read: () => {} });
      const t = x.topstep || {}; const hist = t.historical || {};
      o.$('#t-' + k).innerHTML = `<div class="kstrip kstrip--3">${kv('Pass', o.isNum(t.pass) ? o.num(t.pass, 0) + '%' : '–')}${kv('Fail', o.isNum(t.fail) ? o.num(t.fail, 0) + '%' : '–')}${kv('Still open', o.isNum(t.open) ? o.num(t.open, 0) + '%' : '–', 'after 60 days')}</div>
        <p class="src">${Object.entries(t.fail_why || {}).map(([w, n]) => `Failed on ${o.esc(w)}: ${n} runs.`).join(' ') || 'No failures.'} Run on the real sequence of days: <b>${hist.result || '–'}</b>${hist.days ? ` after ${hist.days} days` : ''}${hist.why ? ` (${hist.why})` : ''}.</p>`;
      if (x.eq) o.lineChart(o.$('#e-' + k), { x: x.eq.d, series: [{ v: x.eq.v, width: 1.5 }], h: 150, base: 0, fmtY: t => '$' + t, read: i => o.$('#er-' + k).innerHTML = `${o.fmtD(x.eq.d[i])}: ${o.money(x.eq.v[i])} cumulative` });
    });
  };
  o.chips(o.$('#sym'), Object.keys(S).map(s => [s, `${S[s].micro} (${S[s].src})`]), cur, v => { cur = v; draw(); });
  draw(); o.onResize(draw);
}

/* ================================================================== FUNDAMENTALS */
async function tradingfund() {
  const o = O(); const m = o.main();
  const d = await load('fundamentals.json');
  if (!d) { m.innerHTML = o.head({ title: 'Fundamentals' }) + subnav('trading/fundamentals/') + o.fail(); return; }
  const st = d.stocks || {};
  m.innerHTML = o.head({ crumbs: [['trading/', 'Trading Part'], [null, 'Fundamentals']], title: 'Fundamentals', short: false, lede: 'What the desk watches before the open: EIA inventories against their five-year range, refining margins, where funds moved last week, crop condition and the 6–10 day weather.', meta: `EIA, CFTC, USDA NASS, NOAA GFS. Updated ${d.updated}.` }) +
    subnav('trading/fundamentals/') +
    `<div class="col-main rv">
      <section class="sec"><h2>EIA inventories against five years</h2><div class="ctl__row" id="sp" style="margin-top:12px;flex-wrap:wrap"></div><div class="kstrip" id="sk" style="margin-top:14px"></div><div class="chart-box" id="sch"></div><div class="legend"><span><i class="l"></i>Last 52 weeks</span><span><i class="ld"></i>Five-year average for the week</span><span><i class="ld"></i>Five-year low and high (lighter)</span></div><p class="readout" id="sr"></p></section>
      <section class="sec"><h2>Refining margins</h2><div class="ctl__row" id="cp" style="margin-top:12px"></div><div class="chart-box" id="cch"></div><p class="readout" id="cr"></p><p class="src">From front-month futures: RBOB and heating oil in $/gal × 42, less WTI, in $/bbl.</p></section>
      <section class="sec"><h2>Where funds moved</h2><p class="lede" style="font-size:14px">Managed-money net position as a share of open interest, from the latest disaggregated Commitments of Traders.</p><div class="tbl-wrap"><table class="tbl" id="cot"><thead><tr><th class="l" data-k="key" data-dir="1">Market</th><th data-k="mm_pct">Net, % of OI</th><th data-k="chg1w">Week</th><th data-k="chg4w">Four weeks</th><th data-k="pctile">3-year percentile</th></tr></thead><tbody></tbody></table></div></section>
      <section class="sec"><h2>Crops</h2><div id="crops"></div><p class="src">USDA NASS Crop Progress, released Mondays at 16:00 ET during the season.</p></section>
      <section class="sec"><h2>Gas-weighted heating degree days, next 16 days</h2><div class="chart-box" id="wch"></div><div class="legend"><span><i class="l"></i>GFS forecast</span><span><i class="ld"></i>Ten-year normal</span></div><p class="readout" id="wr"></p></section>
    </div>
    <aside class="col-side rv"><h2 class="side-title">Latest week</h2><ul class="kpi">${Object.values(st).map(s => `<li class="kpi__item"><span class="kpi__name">${s.label}</span><span class="kpi__level">${o.num(s.last, s.unit === '%' ? 1 : 1)} ${s.unit}</span><span class="kpi__chg">${o.mv(s.chg, 1, '')} on the week${o.isNum(s.vs5) ? `, ${o.pct(s.vs5, 1)} vs 5y` : ''}</span></li>`).join('')}</ul><p class="side-src">Week to ${Object.values(st)[0] ? o.fmtD(Object.values(st)[0].week) : '–'}.</p></aside>`;
  const keys = Object.keys(st); let sk = keys[0];
  const drawS = () => { const s = st[sk]; if (!s) return; const h = s.hist;
    o.$('#sk').innerHTML = kv('Level', `${o.num(s.last, 1)} ${s.unit}`) + kv('Week', o.mv(s.chg, 1, '')) + kv('Five-year average', o.num(s.avg5, 1)) + kv('Against it', o.pct(s.vs5, 1)) + kv('Published', s.published + ' ET');
    o.lineChart(o.$('#sch'), { x: h.d, series: [{ v: h.lo, dash: true, opacity: .4 }, { v: h.hi, dash: true, opacity: .4 }, { v: h.avg, dash: true }, { v: h.v, width: 2 }], h: 240, read: i => o.$('#sr').innerHTML = `${o.fmtD(h.d[i])}: ${o.num(h.v[i], 1)} ${s.unit}, five-year average ${o.num(h.avg[i], 1)} (range ${o.num(h.lo[i], 0)} to ${o.num(h.hi[i], 0)})` }); };
  o.chips(o.$('#sp'), keys.map(k => [k, st[k].label.replace(' stocks', '').replace('Working gas in storage, Lower 48', 'Gas storage')]), sk, v => { sk = v; drawS(); });
  const cr = d.cracks || {}; let ck = 'crack321';
  const drawC = () => { const c = cr[ck]; if (!c) { o.$('#cch').innerHTML = o.fail(); return; } o.lineChart(o.$('#cch'), { x: c.d, series: [{ v: c.v, width: 1.6 }], h: 200, read: i => o.$('#cr').innerHTML = `${o.fmtD(c.d[i])}: $${o.num(c.v[i], 2)}/bbl${i === c.v.length - 1 && o.isNum(c.z60) ? `, ${o.sgn(c.z60)} standard deviations from its 60-day mean` : ''}` }); };
  o.chips(o.$('#cp'), [['crack321', '3-2-1 crack'], ['gas_crack', 'Gasoline crack'], ['diesel_crack', 'Diesel crack']], ck, v => { ck = v; drawC(); });
  o.sortableTable(o.$('#cot'), d.cot || [], null, r => `<tr><td class="l">${nm(r.key)}<small>as of ${o.fmtDS(r.asof)}</small></td><td>${o.num(r.mm_pct, 1)}%</td><td>${o.mv(r.chg1w, 1, 'pt')}</td><td>${o.mv(r.chg4w, 1, 'pt')}</td><td>${o.isNum(r.pctile) ? Math.round(r.pctile) : '–'}</td></tr>`);
  o.$('#crops').innerHTML = (d.crops || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Series</th><th>Latest</th><th>Week</th><th>Five-year average, same week</th></tr></thead><tbody>${d.crops.map(c => `<tr><td class="l">${nm(c.key)}<small>week to ${o.fmtDS(c.week)}</small></td><td>${o.num(c.last, 0)}%</td><td>${o.mv(c.chg, 0, 'pt')}</td><td>${o.isNum(c.avg5) ? o.num(c.avg5, 0) + '%' : '–'}</td></tr>`).join('')}</tbody></table></div>` : o.fail('Add NASS_API_KEY to fetch crop progress.');
  const drawW = () => { const w = d.weather?.daily; if (!w?.length) { o.$('#wch').innerHTML = o.fail(); return; } const x = w.map(r => r.d);
    o.lineChart(o.$('#wch'), { x, series: [{ v: w.map(r => r.norm), dash: true }, { v: w.map(r => r.hdd), width: 2 }], h: 200, shade: [[x[6], x[10]]], read: i => o.$('#wr').innerHTML = `${o.fmtD(x[i])}: ${o.num(w[i].hdd, 1)} HDD, normal ${o.num(w[i].norm, 1)}${i >= 6 && i <= 10 ? ' (days 6–10, shaded)' : ''}` }); };
  const all = () => { drawS(); drawC(); drawW(); }; all(); o.onResize(all);
}

/* ================================================================== SIZING */
async function tradingsizing() {
  const o = O(); const m = o.main();
  const d = await load('intraday.json');
  const C = d?.contracts || { MCL: { name: 'Micro WTI crude', tick: .01, tv: 1, cost: 1.04 }, MGC: { name: 'Micro gold', tick: .1, tv: 1, cost: 1.04 }, MNG: { name: 'Micro Henry Hub gas', tick: .001, tv: 1, cost: 1.04 } };
  const caps = d?.rules?.max_contracts || {};
  m.innerHTML = o.head({ crumbs: [['trading/', 'Trading Part'], [null, 'Sizing']], title: 'Position sizing', short: false, lede: 'Enter the stop in ticks: out comes the number of contracts that keeps the trade between $150 and $250 of risk, slippage and fees included.' }) +
    subnav('trading/sizing/') +
    `<div class="col-main rv"><section class="sec">
      <div class="three" style="margin-top:12px"><label class="field">Contract<select id="c">${Object.entries(C).map(([k, v]) => `<option value="${k}">${k} · ${v.name}</option>`).join('')}</select></label>
      <label class="field">Stop, ticks<input id="s" type="number" value="20" min="1" step="1"></label><label class="field">Entry price (optional)<input id="e" type="number" step="any" placeholder="e.g. 62.40"></label>
      <label class="field">Risk, minimum $<input id="lo" type="number" value="${d?.risk?.[0] ?? 150}"></label><label class="field">Risk, maximum $<input id="hi" type="number" value="${d?.risk?.[1] ?? 250}"></label>
      <label class="field">Side<select id="sd"><option value="1">Long</option><option value="-1">Short</option></select></label></div>
      <div id="res" style="margin-top:22px"></div><div id="px"></div>
      <h3 style="margin-top:30px">Same stop on every contract</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Contract</th><th>Tick</th><th>$ a tick</th><th>Contracts</th><th>Risk</th></tr></thead><tbody id="all"></tbody></table></div>
      <p class="src">Risk per contract = stop ticks × tick value + one tick of slippage on the stop + round-turn fees. Contracts are capped at the Topstep limit for the product.</p></section></div>`;
  const v = id => +o.$('#' + id).value;
  const size = (c, ticks, lo, hi) => { const r1 = (ticks + 1) * c.tv + c.cost; if (r1 > hi) return [0, r1]; const a = Math.max(1, Math.ceil(lo / r1)), b = Math.floor(hi / r1); if (a > b) return [b, r1]; let q = a, mid = (lo + hi) / 2; for (let k = a; k <= b; k++) if (Math.abs(k * r1 - mid) < Math.abs(q * r1 - mid)) q = k; return [q, r1]; };
  const go = () => {
    const k = o.$('#c').value, c = C[k], t = v('s'), lo = v('lo'), hi = v('hi'), e = v('e'), sd = v('sd');
    let [q, r1] = size(c, t, lo, hi); const cap = caps[k]; if (cap && q > cap) q = cap;
    o.$('#res').innerHTML = `<div class="kstrip">${kv('Contracts', q ? q : 'None', q ? '' : 'one contract is above your maximum')}${kv('Risk if stopped', o.money(q * r1), q * r1 < lo && q ? 'below your minimum: widen nothing, take the smaller trade' : '')}${kv('Per contract', o.money(r1, '$', 2))}${kv('Stop distance', o.num(t * c.tick, 4) + ' points')}</div>`;
    o.$('#px').innerHTML = o.isNum(e) && e > 0 && q ? `<div class="kstrip" style="margin-top:12px">${kv('Stop price', o.num(e - sd * t * c.tick, 4))}${kv('1R target', o.num(e + sd * t * c.tick, 4), o.money(q * (t * c.tv - c.cost)))}${kv('2R target', o.num(e + 2 * sd * t * c.tick, 4), o.money(q * (2 * t * c.tv - c.cost)))}${kv('3R target', o.num(e + 3 * sd * t * c.tick, 4), o.money(q * (3 * t * c.tv - c.cost)))}</div>` : '';
    o.$('#all').innerHTML = Object.entries(C).map(([kk, cc]) => { let [qq, rr] = size(cc, t, lo, hi); if (caps[kk] && qq > caps[kk]) qq = caps[kk]; return `<tr><td class="l">${kk}<small>${cc.name}</small></td><td>${cc.tick}</td><td>${o.money(cc.tv, '$', 2)}</td><td>${qq || '–'}</td><td>${qq ? o.money(qq * rr) : '–'}</td></tr>`; }).join('');
  };
  ['c', 's', 'e', 'lo', 'hi', 'sd'].forEach(id => o.$('#' + id).addEventListener('input', go)); go();
}

/* ================================================================== JOURNAL */
const JK = 'ops-journal-v1';
function jload() { try { return JSON.parse(localStorage.getItem(JK) || '[]'); } catch (e) { return []; } }
function jsave(a) { try { localStorage.setItem(JK, JSON.stringify(a)); return true; } catch (e) { return false; } }
const JCOLS = ['date', 'time', 'symbol', 'side', 'qty', 'entry', 'exit', 'stop', 'setup', 'reason', 'lesson'];
async function tradingjournal() {
  const o = O(); const m = o.main();
  const d = await load('intraday.json');
  const C = d?.contracts || { MCL: { tick: .01, tv: 1, cost: 1.04 }, MGC: { tick: .1, tv: 1, cost: 1.04 }, MNG: { tick: .001, tv: 1, cost: 1.04 } };
  m.innerHTML = o.head({ crumbs: [['trading/', 'Trading Part'], [null, 'Journal']], title: 'Trade journal', short: false, lede: 'Setup, reason, result, lesson. P&L and R are worked out from the contract specs; the statistics update as you log.', meta: 'Kept in this browser only. Export to CSV to back it up or move it to another device; the same CSV loads into the local journal (tools/journal.py).' }) +
    subnav('trading/journal/') +
    `<div class="col-main rv"><section class="sec"><h2>Log a trade</h2>
      <div class="three"><label class="field">Date<input id="j-date" type="date"></label><label class="field">Entry time, CT<input id="j-time" type="time" value="08:30"></label><label class="field">Contract<select id="j-symbol">${Object.keys(C).map(k => `<option>${k}</option>`).join('')}</select></label>
      <label class="field">Side<select id="j-side"><option value="1">Long</option><option value="-1">Short</option></select></label><label class="field">Contracts<input id="j-qty" type="number" value="1" min="1"></label><label class="field">Setup<input id="j-setup" list="setups" placeholder="orb, eia, imom, vwap…"><datalist id="setups"><option>orb</option><option>eia</option><option>imom</option><option>vwap</option></datalist></label>
      <label class="field">Entry<input id="j-entry" type="number" step="any"></label><label class="field">Exit<input id="j-exit" type="number" step="any"></label><label class="field">Stop<input id="j-stop" type="number" step="any"></label></div>
      <div class="two" style="margin-top:14px;gap:16px"><label class="field">Reason<input id="j-reason" placeholder="What you saw"></label><label class="field">Lesson<input id="j-lesson" placeholder="What you take from it"></label></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn--sm" id="add">Add trade</button><button class="btn btn--ghost btn--sm" id="exp">Export CSV</button><label class="btn btn--ghost btn--sm" style="cursor:pointer">Import CSV<input id="imp" type="file" accept=".csv" hidden></label></div><p class="src" id="msg"></p></section>
      <section class="sec"><h2>Statistics</h2><div class="kstrip" id="js"></div><div class="two" style="gap:24px;margin-top:18px"><div><h3>P&amp;L by setup</h3><div class="chart-box" id="jsetup"></div></div><div><h3>P&amp;L by entry hour, CT</h3><div class="chart-box" id="jhour"></div></div></div><div class="chart-box" id="jeq" style="margin-top:18px"></div><p class="readout" id="jeqr"></p></section>
      <section class="sec"><h2>Trades</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Date</th><th class="l">Contract</th><th class="l">Setup</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>R</th><th>P&amp;L</th><th class="l">Lesson</th><th></th></tr></thead><tbody id="jt"></tbody></table></div></section></div>`;
  o.$('#j-date').value = o.iso(new Date());
  const calc = t => { const c = C[t.symbol] || { tick: .01, tv: 1, cost: 1 }; const ticks = (t.exit - t.entry) * t.side / c.tick; const pnl = ticks * c.tv * t.qty - c.cost * t.qty; const risk = Math.abs(t.entry - t.stop) / c.tick * c.tv * t.qty; return { pnl, r: risk > 0 ? pnl / risk : null }; };
  let rows = jload();
  const draw = () => {
    const T = rows.map(t => ({ ...t, ...calc(t) })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const n = T.length, w = T.filter(t => t.pnl > 0).length, rs = T.map(t => t.r).filter(o.isNum);
    const tot = T.reduce((s, t) => s + t.pnl, 0);
    o.$('#js').innerHTML = kv('Trades', n) + kv('Win rate', n ? o.num(w / n * 100, 0) + '%' : '–') + kv('Average R', rs.length ? o.num(rs.reduce((a, b) => a + b, 0) / rs.length, 2) : '–') + kv('P&amp;L', o.mv(tot, 0, '$')) + kv('Expectancy', n ? o.money(tot / n, '$', 0) : '–', 'a trade');
    const by = (f) => { const g = {}; T.forEach(t => { const k = f(t); g[k] = (g[k] || 0) + t.pnl; }); return g; };
    const bs = by(t => t.setup || 'none'), bh = by(t => (t.time || '00').slice(0, 2));
    if (n) {
      o.hbars(o.$('#jsetup'), Object.entries(bs).sort((a, b) => b[1] - a[1]), { labelW: 90, fmt: v => o.money(v) });
      const hs = Object.keys(bh).sort(); o.barChart(o.$('#jhour'), { cats: hs, series: [{ type: 'sign', v: hs.map(h => bh[h]) }], h: 150, catFmt: l => l + 'h', fmtY: v => '$' + v, read: () => {} });
      let cum = 0; const eq = T.map(t => (cum += t.pnl)); o.lineChart(o.$('#jeq'), { x: T.map(t => t.date), series: [{ v: eq, width: 1.6 }], h: 180, base: 0, fmtY: v => '$' + v, read: i => o.$('#jeqr').innerHTML = `${o.fmtD(T[i].date)} ${T[i].time}: ${o.money(eq[i])} cumulative` });
    } else { ['#jsetup', '#jhour', '#jeq'].forEach(s => o.$(s).innerHTML = o.fail('Log a trade to see the statistics.')); }
    o.$('#jt').innerHTML = T.slice().reverse().map(t => `<tr><td class="l">${o.fmtDS(t.date)} ${t.time || ''}</td><td class="l">${t.symbol}</td><td class="l">${o.esc(t.setup)}<small>${o.esc(t.reason || '')}</small></td><td>${t.side > 0 ? 'Long' : 'Short'}</td><td>${t.qty}</td><td>${t.entry}</td><td>${t.exit}</td><td>${o.isNum(t.r) ? o.mv(t.r, 2, '') : '–'}</td><td>${o.mv(t.pnl, 0, '$')}</td><td class="l" style="max-width:220px">${o.esc(t.lesson || '')}</td><td><button class="btn btn--ghost btn--sm" data-del="${t.id}" aria-label="Delete">×</button></td></tr>`).join('');
    o.$$('[data-del]').forEach(b => b.onclick = () => { rows = rows.filter(r => String(r.id) !== b.dataset.del); jsave(rows); draw(); });
  };
  o.$('#add').onclick = () => {
    const g = id => o.$('#j-' + id).value; const t = { id: Date.now(), date: g('date'), time: g('time'), symbol: g('symbol'), side: +g('side'), qty: +g('qty'), entry: +g('entry'), exit: +g('exit'), stop: +g('stop'), setup: g('setup'), reason: g('reason'), lesson: g('lesson') };
    if (!t.entry || !t.exit || !t.stop) { o.$('#msg').textContent = 'Entry, exit and stop are needed.'; return; }
    rows.push(t); o.$('#msg').textContent = jsave(rows) ? 'Saved in this browser.' : 'This browser blocks storage: export to CSV before leaving the page.'; ['entry', 'exit', 'stop', 'reason', 'lesson'].forEach(k => o.$('#j-' + k).value = ''); draw();
  };
  const q = s => /[",\n]/.test(String(s ?? '')) ? `"${String(s).replace(/"/g, '""')}"` : String(s ?? '');
  o.$('#exp').onclick = () => { const csv = [JCOLS.join(','), ...rows.map(r => JCOLS.map(k => q(r[k])).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `opsilon-journal-${o.iso(new Date())}.csv`; a.click(); };
  o.$('#imp').onchange = async e => {
    const txt = await e.target.files[0].text(); const lines = txt.trim().split(/\r?\n/); const hdr = lines.shift().split(',');
    const parse = l => { const out = []; let cur = '', inq = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (inq) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inq = false; else cur += ch; } else if (ch === '"') inq = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
    let n = 0; lines.forEach((l, i) => { const v = parse(l); const t = { id: Date.now() + i }; hdr.forEach((h, k) => t[h.trim()] = v[k]); ['side', 'qty', 'entry', 'exit', 'stop'].forEach(k => t[k] = +t[k]); if (t.entry && t.exit) { rows.push(t); n++; } });
    jsave(rows); o.$('#msg').textContent = `${n} trades imported.`; draw();
  };
  draw(); o.onResize(draw);
}

/* ================================================================== DATA & STACK */
const TOOLS = [
  ['Execution', 'TopstepX', 'Topstep\'s own platform: live futures data and order entry for the combine. No long intraday history.'],
  ['Execution', 'Interactive Brokers', 'Alternative broker with an API (TWS / IB Gateway) for live CME data and orders outside the prop account.'],
  ['Intraday history', 'Databento (CME Globex MDP 3.0)', 'Tick, minute and daily bars, continuous CL.c.0, CL.c.1… Paid per request; the pipeline checks the cost first and stops at DATABENTO_MAX_USD.'],
  ['Intraday history', 'Bloomberg terminal', 'Tick and minute history (about six months of ticks) and generic curves CL1…CL12 through tools/bloomberg_export.py (Python blpapi) or the Excel add-in.'],
  ['Intraday history', 'Yahoo Finance', 'Free: daily since 2000, 5-minute bars for the last 60 days only. The pipeline appends them every night so the history grows.'],
  ['Fundamentals', 'EIA', 'Weekly petroleum (Wednesday 10:30 ET) and gas storage (Thursday 10:30 ET). API key free; XLS history files without a key.'],
  ['Fundamentals', 'CFTC Commitments of Traders', 'Disaggregated, futures only, every Friday 15:30 ET about Tuesday.'],
  ['Fundamentals', 'USDA NASS and WASDE', 'Crop progress every Monday 16:00 ET in season (API key free); WASDE monthly at 12:00 ET.'],
  ['Weather', 'NOAA GFS via Open-Meteo', '16-day forecasts, heating and cooling degree days for gas, rain for grains. NOAA CPC 6–10 and 8–14 day outlooks: cpc.ncep.noaa.gov.'],
  ['Calendar', 'FRED release dates and the Fed calendar', 'Tier-1 releases (CPI, payrolls, GDP, FOMC) for the no-trade windows.'],
  ['Research', 'Ollama on your Mac', 'A local model that answers from your commodity papers (tools/ollama_papers.py): retrieval over the PDFs, not a retrain.'],
  ['Automation', 'Telegram bot', 'EIA, COT and tier-1 alerts (tools/telegram_alerts.py, scheduled in GitHub Actions).'],
  ['Automation', 'MCP server', 'tools/opsilon_mcp.py exposes the point-in-time store, the backtests and the sizing to Claude.'],
];
async function tradingstack() {
  const o = O(); const m = o.main();
  const d = await load('stack.json');
  m.innerHTML = o.head({ crumbs: [['trading/', 'Trading Part'], [null, 'Data & stack']], title: 'Data & stack', short: false, lede: 'Which sources answered on the last run, which keys are set, what the point-in-time store holds, and every tool the desk can trade or research with.', meta: d ? `Updated ${d.updated}.` : '' }) +
    subnav('trading/stack/') +
    `<div class="col-main rv">
      <section class="sec"><h2>Last run</h2><div class="list" id="st"></div></section>
      <section class="sec"><h2>API keys</h2><p class="lede" style="font-size:14px">Set as GitHub secrets (Settings → Secrets and variables → Actions) and in a .env file for local runs. None is required.</p><div class="list" id="keys"></div></section>
      <section class="sec"><h2>Point-in-time store</h2><p class="lede" style="font-size:14px">Each figure is stored with the date it is about and the time it was published. Backtests only see what had been published.</p><div class="tbl-wrap"><table class="tbl" id="inv"><thead><tr><th class="l" data-k="name" data-dir="1">Series</th><th class="l" data-k="source">Source</th><th data-k="n">Rows</th><th data-k="first">From</th><th data-k="last">To</th><th class="l" data-k="published">Last published</th></tr></thead><tbody></tbody></table></div></section>
      <section class="sec"><h2>Tools</h2><div class="list">${TOOLS.map(([g, n, t]) => `<div><span class="t"><b>${n}</b>. ${t}</span><span class="m">${g}</span></div>`).join('')}</div></section>
    </div>
    <aside class="col-side rv"><h2 class="side-title">Run locally</h2><div class="prose" style="font-size:14px"><p><code>pip install -r requirements.txt</code></p><p><code>python pipeline/run.py commodities trading</code></p><p><code>streamlit run tools/dashboard.py</code></p><p><code>python tools/ollama_papers.py index ~/commodity-papers</code></p><p>Everything is explained in <code>TRADING.md</code> at the root of the repo.</p></div></aside>`;
  if (!d) { o.$('#st').innerHTML = o.fail(); return; }
  o.$('#st').innerHTML = d.status.map(s => `<div><span class="t">${s.ok ? '' : '<b>'}${o.esc(s.step)}${s.ok ? '' : '</b>'}<span class="d" style="display:block">${o.esc(s.msg)}</span></span><span class="m">${s.ok ? 'ok' : 'failed'}, ${s.secs}s</span></div>`).join('');
  o.$('#keys').innerHTML = d.keys.map(k => `<div><span class="t"><b>${k.name}</b><span class="d" style="display:block">${o.esc(k.what)}</span></span><span class="m">${k.set ? 'set' : 'not set'}</span></div>`).join('');
  o.sortableTable(o.$('#inv'), d.inventory, null, r => `<tr><td class="l">${o.esc(r.name)}</td><td class="l">${o.esc(r.source)}</td><td>${r.n.toLocaleString('en-US')}</td><td>${o.esc(String(r.first).slice(0, 10))}</td><td>${o.esc(String(r.last).slice(0, 10))}</td><td class="l">${o.esc(r.published || '')}</td></tr>`);
}

return { tradinghome, tradingedge, tradingintraday, tradingfund, tradingsizing, tradingjournal, tradingstack };
})());
