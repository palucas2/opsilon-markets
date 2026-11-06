/* Opsilon Markets – Tools: Lab calculators and simulators */
window.PAGES = Object.assign(window.PAGES || {}, (function () {
const O = () => window.O;

const TOOLS = {
  'options-payoff': ['Options payoff diagram', 'options', 'Pick a strategy and see its profit or loss at expiry, and today, across prices of the underlying.'],
  'black-scholes': ['Black-Scholes pricer', 'options', 'Price a European call or put and read its Greeks: how its value moves with the price, time, volatility and rates.'],
  'bond-calculator': ['Bond price and duration', 'bonds', 'Price a fixed-coupon bond from its yield, and see how much the price moves when the yield does.'],
  'yield-to-maturity': ['Yield to maturity', 'bonds', 'Solve for the yield a bond pays from its price, coupon and maturity.'],
  'risk-correlation': ['Risk and correlation', 'risk-and-portfolio', 'Pick companies and see how they move together, how volatile each is, and how risky they are as one portfolio.'],
  'efficient-frontier': ['Two-asset efficient frontier', 'risk-and-portfolio', 'Mix two assets and see every combination of risk and return, and the mix with the least risk.'],
  'position-sizing': ['Position sizing', 'risk-and-portfolio', 'How many shares to buy for the loss you are willing to accept if your stop is hit.'],
  'dcf': ['Discounted cash flow', 'valuation-and-growth', 'Value a business from the cash it is expected to generate, and see how much of the value lies beyond ten years.'],
  'compound-growth': ['Compound growth', 'valuation-and-growth', 'See how a starting sum and a monthly addition grow at a steady annual return.'],
  'real-return': ['Real return', 'valuation-and-growth', 'What a nominal return is worth after inflation and tax.'],
};
const CATS = {
  'options': ['Options', 'Two options calculators: a strategy’s profit or loss at expiry and today, and the Black-Scholes value of a call or put with its Greeks.'],
  'bonds': ['Bonds', 'Two bond calculators: a fixed-coupon bond’s price, duration and convexity from its yield, and its yield to maturity from its price.'],
  'risk-and-portfolio': ['Risk & portfolio', 'How companies move together, how two assets mix into a frontier of risk and return, and how large a position can be for the loss you accept.'],
  'valuation-and-growth': ['Valuation & growth', 'A business valued from its cash flows, a sum compounding at a steady return, and what a return is worth after inflation and tax.'],
};
const PRIV = 'Every tool runs in your browser: nothing you enter is sent or stored.';

function cardFor(id) { const o = O(); const t = TOOLS[id]; return `<a class="card" href="${o.link('lab/' + id + '/')}"><h3>${t[0]}</h3><p>${t[2]}</p><span class="meta">${id === 'risk-correlation' ? 'Yahoo Finance closes, calculated in your browser' : 'Calculator, runs in your browser'}</span></a>`; }

async function lab() {
  const o = O(); const m = o.main();
  m.innerHTML = o.head({ title: 'Lab', lede: 'Interactive quant tools. Change the inputs, watch the result move. ' + PRIV }) +
    `<div class="col-full">${Object.entries(CATS).map(([k, [t]]) => `<section class="sec rv" style="border:0;padding-top:30px"><h2><a href="${o.link('lab/' + k + '/')}">${t}</a></h2><div class="cards">${Object.keys(TOOLS).filter(x => TOOLS[x][1] === k).map(cardFor).join('')}</div></section>`).join('')}
    <section class="sec rv" style="border:0;padding-top:30px"><h2><a href="${o.link('simulators/')}">Simulators</a></h2><div class="cards"><a class="card" href="${o.link('simulators/trading-simulator/')}"><h3>Trading Simulator</h3><p>Two hidden years of a real index, played day by day.</p><span class="meta">Market replay</span></a><a class="card" href="${o.link('simulators/panic-test/')}"><h3>Panic Test</h3><p>Sit through one of the great falls, without being told which.</p><span class="meta">Market replay</span></a><a class="card" href="${o.link('simulators/portfolio-builder/')}"><h3>Portfolio Builder</h3><p>Run a mix of stocks, bonds and cash through ten hidden years.</p><span class="meta">Strategy game</span></a></div></section></div>`;
}
async function labcat(k) {
  const o = O(); const [t, lede] = CATS[k];
  o.main().innerHTML = o.head({ crumbs: [['lab/', 'Lab'], [null, 'Tools']], title: t, lede: lede + ' ' + PRIV }) + `<div class="col-full rv"><div class="cards">${Object.keys(TOOLS).filter(x => TOOLS[x][1] === k).map(cardFor).join('')}</div></div>`;
}

/* ---------- generic form helpers ---------- */
function fields(defs) { return `<div class="three" style="margin-top:22px">${defs.map(([id, lab, val, extra = '']) => `<label class="field">${lab}<input id="${id}" type="number" value="${val}" step="any" ${extra}></label>`).join('')}</div>`; }
const val = id => +O().$('#' + id).value;
function live(ids, fn) { ids.forEach(id => O().$('#' + id)?.addEventListener('input', fn)); fn(); O().onResize(fn); }
function out(items) { return `<div class="kstrip">${items.map(([k, v, s = '']) => `<div><span class="kpi__name">${k}</span><div class="kpi__level">${v}</div><div class="kpi__chg muted">${s}</div></div>`).join('')}</div>`; }

/* ---------- maths ---------- */
const N = x => { const a1 = .254829592, a2 = -.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = .3275911; const s = x < 0 ? -1 : 1; const z = Math.abs(x) / Math.SQRT2; const t = 1 / (1 + p * z); const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z); return .5 * (1 + s * y); };
const npdf = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
function bs(S, K, T, r, v, q, call) {
  if (T <= 0 || v <= 0) { const intr = call ? Math.max(0, S - K) : Math.max(0, K - S); return { p: intr, d: call ? (S > K ? 1 : 0) : (S < K ? -1 : 0), g: 0, v: 0, t: 0, rho: 0 }; }
  const d1 = (Math.log(S / K) + (r - q + v * v / 2) * T) / (v * Math.sqrt(T)), d2 = d1 - v * Math.sqrt(T);
  const p = call ? S * Math.exp(-q * T) * N(d1) - K * Math.exp(-r * T) * N(d2) : K * Math.exp(-r * T) * N(-d2) - S * Math.exp(-q * T) * N(-d1);
  const delta = call ? Math.exp(-q * T) * N(d1) : Math.exp(-q * T) * (N(d1) - 1);
  const gamma = Math.exp(-q * T) * npdf(d1) / (S * v * Math.sqrt(T));
  const vega = S * Math.exp(-q * T) * npdf(d1) * Math.sqrt(T) / 100;
  const theta = (call ? (-S * Math.exp(-q * T) * npdf(d1) * v / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2) + q * S * Math.exp(-q * T) * N(d1)) : (-S * Math.exp(-q * T) * npdf(d1) * v / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2) - q * S * Math.exp(-q * T) * N(-d1))) / 365;
  const rho = (call ? K * T * Math.exp(-r * T) * N(d2) : -K * T * Math.exp(-r * T) * N(-d2)) / 100;
  return { p, d: delta, g: gamma, v: vega, t: theta, rho, d1, d2 };
}
function bondPrice(face, cpn, y, years, freq) { const n = Math.round(years * freq), c = face * cpn / freq, i = y / freq; let p = 0, dur = 0, conv = 0; for (let k = 1; k <= n; k++) { const cf = c + (k === n ? face : 0); const df = Math.pow(1 + i, -k); p += cf * df; dur += (k / freq) * cf * df; conv += cf * df * k * (k + 1) / Math.pow(freq, 2); } const mac = dur / p; return { p, mac, mod: mac / (1 + i), conv: conv / (p * Math.pow(1 + i, 2)) }; }

/* ---------- tools ---------- */
const TOOL_FN = {
  'options-payoff'(box) {
    const o = O();
    const STRATS = { 'Long call': [['C', 1, 0]], 'Long put': [['P', 1, 0]], 'Short call': [['C', -1, 0]], 'Short put': [['P', -1, 0]], 'Covered call': [['S', 1, 0], ['C', -1, 1]], 'Protective put': [['S', 1, 0], ['P', 1, -1]], 'Bull call spread': [['C', 1, 0], ['C', -1, 1]], 'Bear put spread': [['P', 1, 0], ['P', -1, -1]], 'Long straddle': [['C', 1, 0], ['P', 1, 0]], 'Long strangle': [['C', 1, 1], ['P', 1, -1]], 'Iron condor': [['P', 1, -2], ['P', -1, -1], ['C', -1, 1], ['C', 1, 2]], 'Butterfly': [['C', 1, -1], ['C', -2, 0], ['C', 1, 1]] };
    let strat = 'Long call';
    box.innerHTML = `<div class="ctl"><div class="ctl__lab">Strategy</div><div class="ctl__row" id="st"></div></div>${fields([['S', 'Underlying price', 100], ['K', 'Central strike', 100], ['W', 'Strike spacing', 10], ['T', 'Days to expiry', 30], ['V', 'Volatility, %', 25], ['R', 'Rate, %', 4]])}<div class="chart-box" id="ch"></div><div class="legend"><span><i class="l"></i>At expiry</span><span><i class="ld"></i>Today</span></div><p class="readout" id="rd"></p><div id="legs"></div><div id="res"></div>`;
    o.chips(o.$('#st'), Object.keys(STRATS), strat, v => { strat = v; go(); });
    const go = () => {
      const S = val('S'), K = val('K'), W = val('W'), T = val('T') / 365, v = val('V') / 100, r = val('R') / 100;
      const legs = STRATS[strat].map(([t, q, off]) => ({ t, q, k: K + off * W }));
      legs.forEach(l => l.prem = l.t === 'S' ? S : bs(S, l.k, T, r, v, 0, l.t === 'C').p);
      const cost = legs.reduce((a, l) => a + l.q * l.prem, 0);
      const xs = []; for (let i = 0; i <= 120; i++) xs.push(S * (.5 + i / 120));
      const pay = (x, T2) => legs.reduce((a, l) => a + l.q * ((l.t === 'S' ? x : T2 > 0 ? bs(x, l.k, T2, r, v, 0, l.t === 'C').p : (l.t === 'C' ? Math.max(0, x - l.k) : Math.max(0, l.k - x)))), 0) - cost;
      const ex = xs.map(x => pay(x, 0)), td = xs.map(x => pay(x, T));
      o.lineChart(o.$('#ch'), { x: xs, series: [{ v: td, dash: true }, { v: ex, width: 2 }], h: 260, xfmt: x => o.num(x, 0), xlabels: [0, 30, 60, 90, 120], zero: true, fmtY: t => t, read: i => o.$('#rd').innerHTML = `Underlying at ${o.num(xs[i])}: ${o.mv(ex[i], 2, '')} at expiry, ${o.mv(td[i], 2, '')} today` });
      const be = []; for (let i = 1; i < ex.length; i++) if ((ex[i - 1] < 0) !== (ex[i] < 0)) be.push(xs[i - 1] + (xs[i] - xs[i - 1]) * (-ex[i - 1]) / (ex[i] - ex[i - 1]));
      const mx = Math.max(...ex), mn = Math.min(...ex);
      o.$('#legs').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Leg</th><th>Strike</th><th>Quantity</th><th>Price</th></tr></thead><tbody>${legs.map(l => `<tr><td>${{ C: 'Call', P: 'Put', S: 'Shares' }[l.t]}</td><td>${l.t === 'S' ? '–' : o.num(l.k)}</td><td>${l.q > 0 ? 'Buy ' : 'Sell '}${Math.abs(l.q)}</td><td>${o.num(l.prem)}</td></tr>`).join('')}</tbody></table></div>`;
      o.$('#res').innerHTML = out([['Net cost', o.num(cost), cost >= 0 ? 'paid' : 'received'], ['Maximum profit', mx > S * 2 * .45 && ex[ex.length - 1] > ex[ex.length - 2] + 1e-9 ? 'Unlimited' : o.num(mx), 'in the chart range'], ['Maximum loss', ex[0] < ex[1] - 1e-9 && mn === ex[0] && legs.some(l => l.q < 0 && l.t === 'P') ? o.num(mn) : o.num(mn), 'in the chart range'], ['Break-even', be.length ? be.map(b => o.num(b)).join(', ') : '–', 'at expiry']]);
    };
    live(['S', 'K', 'W', 'T', 'V', 'R'], go);
  },
  'black-scholes'(box) {
    const o = O(); let type = 'Call';
    box.innerHTML = `<div class="ctl"><div class="ctl__row" id="ty"></div></div>${fields([['S', 'Underlying price', 100], ['K', 'Strike', 100], ['T', 'Days to expiry', 90], ['V', 'Volatility, %', 22], ['R', 'Risk-free rate, %', 4], ['Q', 'Dividend yield, %', 0]])}<div id="res"></div><h3 style="margin-top:28px">Value across the price of the underlying</h3><div class="chart-box" id="ch"></div><div class="legend"><span><i class="l"></i>Value today</span><span><i class="ld"></i>Value at expiry</span></div><p class="readout" id="rd"></p>`;
    o.chips(o.$('#ty'), ['Call', 'Put'], type, v => { type = v; go(); });
    const go = () => {
      const S = val('S'), K = val('K'), T = val('T') / 365, v = val('V') / 100, r = val('R') / 100, q = val('Q') / 100, call = type === 'Call';
      const x = bs(S, K, T, r, v, q, call);
      o.$('#res').innerHTML = out([['Value', o.num(x.p, 3)], ['Delta', o.num(x.d, 3), 'per 1 move in the price'], ['Gamma', o.num(x.g, 4), 'change in delta'], ['Vega', o.num(x.v, 3), 'per 1 point of volatility'], ['Theta', o.num(x.t, 3), 'per day'], ['Rho', o.num(x.rho, 3), 'per 1 point of rates']]);
      const xs = []; for (let i = 0; i <= 100; i++) xs.push(S * (.5 + i / 100));
      const now = xs.map(s => bs(s, K, T, r, v, q, call).p), ex = xs.map(s => call ? Math.max(0, s - K) : Math.max(0, K - s));
      o.lineChart(o.$('#ch'), { x: xs, series: [{ v: ex, dash: true }, { v: now, width: 2 }], h: 240, xfmt: s => o.num(s, 0), xlabels: [0, 25, 50, 75, 100], read: i => o.$('#rd').innerHTML = `Underlying at ${o.num(xs[i])}: ${o.num(now[i], 3)} today, ${o.num(ex[i], 3)} at expiry` });
    };
    live(['S', 'K', 'T', 'V', 'R', 'Q'], go);
  },
  'bond-calculator'(box) {
    const o = O();
    box.innerHTML = `${fields([['F', 'Face value', 100], ['C', 'Coupon, % a year', 4.5], ['Y', 'Yield, % a year', 4.25], ['N', 'Years to maturity', 10], ['M', 'Coupons a year', 2, 'min="1" max="12"']])}<div id="res"></div><h3 style="margin-top:28px">Price against yield</h3><div class="chart-box" id="ch"></div><div class="legend"><span><i class="l"></i>Price</span><span><i class="ld"></i>Duration estimate</span></div><p class="readout" id="rd"></p>`;
    const go = () => {
      const F = val('F'), c = val('C') / 100, y = val('Y') / 100, n = val('N'), m = Math.max(1, Math.round(val('M')));
      const b = bondPrice(F, c, y, n, m), up = bondPrice(F, c, y + .01, n, m).p;
      o.$('#res').innerHTML = out([['Price', o.num(b.p, 3), b.p > F ? 'above par' : b.p < F ? 'below par' : 'at par'], ['Macaulay duration', o.num(b.mac, 2) + ' yrs'], ['Modified duration', o.num(b.mod, 2), '% price change per 1pp of yield'], ['Convexity', o.num(b.conv, 1)], ['If the yield rises 1pp', o.num(up, 2), o.pct((up / b.p - 1) * 100)]]);
      const ys = []; for (let i = 0; i <= 80; i++) ys.push(Math.max(.0001, y - .04 + i * .001));
      const ps = ys.map(yy => bondPrice(F, c, yy, n, m).p), est = ys.map(yy => b.p * (1 - b.mod * (yy - y)));
      o.lineChart(o.$('#ch'), { x: ys, series: [{ v: est, dash: true }, { v: ps, width: 2 }], h: 240, xfmt: v => o.num(v * 100, 1) + '%', xlabels: [0, 20, 40, 60, 80], read: i => o.$('#rd').innerHTML = `At ${o.num(ys[i] * 100, 2)}%: price ${o.num(ps[i], 2)}, duration estimate ${o.num(est[i], 2)}` });
    };
    live(['F', 'C', 'Y', 'N', 'M'], go);
  },
  'yield-to-maturity'(box) {
    const o = O();
    box.innerHTML = `${fields([['P', 'Price', 96.5], ['F', 'Face value', 100], ['C', 'Coupon, % a year', 4], ['N', 'Years to maturity', 7], ['M', 'Coupons a year', 2]])}<div id="res"></div>`;
    const go = () => {
      const P = val('P'), F = val('F'), c = val('C') / 100, n = val('N'), m = Math.max(1, Math.round(val('M')));
      let lo = -.5, hi = 2; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; bondPrice(F, c, mid, n, m).p > P ? lo = mid : hi = mid; }
      const y = (lo + hi) / 2, b = bondPrice(F, c, y, n, m), cy = F * c / P;
      o.$('#res').innerHTML = out([['Yield to maturity', o.num(y * 100, 3) + '%', 'a year, compounded ' + m + 'x'], ['Current yield', o.num(cy * 100, 3) + '%', 'coupon over price'], ['Pull to par', o.num((F - P), 2), P < F ? 'gain at maturity' : 'loss at maturity'], ['Modified duration', o.num(b.mod, 2)]]);
    };
    live(['P', 'F', 'C', 'N', 'M'], go);
  },
  async 'risk-correlation'(box) {
    const o = O();
    const idx = await o.data('companies/index.json').catch(() => null);
    if (!idx) { box.innerHTML = o.fail(); return; }
    let sel = idx.rows.filter(r => ['AAPL', 'MSFT', 'JPM', 'XOM', 'JNJ'].includes(r.t)).map(r => r.slug);
    if (sel.length < 2) sel = idx.rows.slice(0, 5).map(r => r.slug);
    box.innerHTML = `<div class="ctl"><input class="inp" id="q" placeholder="Add a company" style="width:100%;max-width:420px"><div class="search-res" id="qr"></div></div><div class="ctl__row" id="sel" style="margin-top:12px"></div><div id="res"></div><h3 style="margin-top:28px">Correlation of daily returns, 1 year</h3><div id="mat"></div><h3 style="margin-top:28px">Each company</h3><div id="tab"></div>`;
    o.$('#q').oninput = e => { const q = e.target.value.trim().toLowerCase(); o.$('#qr').innerHTML = q ? idx.rows.filter(r => !sel.includes(r.slug) && (r.n.toLowerCase().includes(q) || r.t.toLowerCase().startsWith(q))).slice(0, 6).map(r => `<a href="#" data-s="${r.slug}">${o.esc(r.n)}<span>${r.t}</span></a>`).join('') : ''; o.$$('#qr a').forEach(a => a.onclick = ev => { ev.preventDefault(); if (sel.length < 10) sel.push(a.dataset.s); o.$('#q').value = ''; o.$('#qr').innerHTML = ''; go(); }); };
    const go = async () => {
      o.$('#sel').innerHTML = sel.map(s => { const r = idx.rows.find(x => x.slug === s); return `<button class="chip chip--check on" data-s="${s}">${r ? r.t : s} ×</button>`; }).join('');
      o.$$('#sel button').forEach(b => b.onclick = () => { if (sel.length > 2) { sel = sel.filter(x => x !== b.dataset.s); go(); } });
      const cs = await Promise.all(sel.map(s => o.data(`companies/${s}.json`).catch(() => null)));
      const ok = cs.filter(Boolean); if (ok.length < 2) { o.$('#res').innerHTML = o.fail(); return; }
      const dates = ok.map(c => new Set(c.hist.dates)); const common = ok[0].hist.dates.filter(d => dates.every(s => s.has(d)));
      const R = ok.map(c => { const mp = Object.fromEntries(c.hist.dates.map((d, i) => [d, c.hist.values[i]])); const v = common.map(d => mp[d]); return v.slice(1).map((x, i) => x / v[i] - 1); });
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length; const cov = (a, b) => { const ma = mean(a), mb = mean(b); return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (a.length - 1); };
      const C = R.map(a => R.map(b => cov(a, b))); const vol = C.map((r, i) => Math.sqrt(r[i] * 252));
      const corr = C.map((r, i) => r.map((v, j) => v / Math.sqrt(C[i][i] * C[j][j])));
      const n = ok.length, w = 1 / n; let pv = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pv += w * w * C[i][j]; const pvol = Math.sqrt(pv * 252);
      const avgVol = mean(vol); let avgC = 0, k = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { avgC += corr[i][j]; k++; }
      o.$('#res').innerHTML = out([['Portfolio volatility', o.num(pvol * 100, 1) + '%', 'equal weights, a year'], ['Average volatility alone', o.num(avgVol * 100, 1) + '%'], ['Diversification benefit', o.num((avgVol - pvol) * 100, 1) + 'pp'], ['Average correlation', o.num(avgC / k)]]);
      const names = ok.map(c => c.t);
      const col = v => { const rgb = getComputedStyle(document.documentElement).getPropertyValue(v >= 0 ? '--heat-up' : '--heat-down').trim(); return `rgba(${rgb},${Math.abs(v) * .8})`; };
      o.$('#mat').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th>${names.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${corr.map((r, i) => `<tr><td>${names[i]}</td>${r.map((v, j) => `<td style="text-align:center;background:${i === j ? 'transparent' : col(v)}">${i === j ? '' : o.num(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="src">${common.length} common trading days to ${o.fmtD(common[common.length - 1])}. Yahoo Finance closes, local currency.</p>`;
      o.$('#tab').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Volatility</th><th>Return, 1 year</th><th>Beta to its index</th></tr></thead><tbody>${ok.map((c, i) => `<tr><td><a href="${o.link('companies/' + c.slug + '/')}">${o.esc(c.name)}</a></td><td>${o.num(vol[i] * 100, 1)}%</td><td>${o.mv((c.hist.values[c.hist.values.length - 1] / c.hist.values[0] - 1) * 100, 1)}</td><td>${o.num(c.risk?.beta)}</td></tr>`).join('')}</tbody></table></div>`;
    };
    go();
  },
  'efficient-frontier'(box) {
    const o = O();
    box.innerHTML = `${fields([['R1', 'Asset A return, %', 8], ['V1', 'Asset A volatility, %', 16], ['R2', 'Asset B return, %', 4], ['V2', 'Asset B volatility, %', 6], ['C', 'Correlation', -0.2, 'min="-1" max="1" step="0.05"'], ['RF', 'Risk-free rate, %', 3]])}<div id="res"></div><div class="chart-box" id="ch"></div><p class="readout" id="rd"></p>`;
    const go = () => {
      const r1 = val('R1') / 100, v1 = val('V1') / 100, r2 = val('R2') / 100, v2 = val('V2') / 100, c = Math.max(-1, Math.min(1, val('C'))), rf = val('RF') / 100;
      const pts = []; for (let i = 0; i <= 100; i++) { const w = i / 100; const r = w * r1 + (1 - w) * r2; const v = Math.sqrt(w * w * v1 * v1 + (1 - w) ** 2 * v2 * v2 + 2 * w * (1 - w) * c * v1 * v2); pts.push({ w, r, v, s: (r - rf) / v }); }
      const mv = pts.reduce((a, b) => b.v < a.v ? b : a), ms = pts.reduce((a, b) => b.s > a.s ? b : a);
      o.$('#res').innerHTML = out([['Least-risk mix', `${Math.round(mv.w * 100)}% A`, `${o.num(mv.r * 100, 1)}% return, ${o.num(mv.v * 100, 1)}% volatility`], ['Best Sharpe mix', `${Math.round(ms.w * 100)}% A`, `Sharpe ratio ${o.num(ms.s, 2)}`]]);
      const box2 = o.$('#ch'); box2.innerHTML = ''; const w = o.W(box2), hgt = 280, pad = 40; const svg = o.svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box2);
      const tx = o.niceTicks(0, Math.max(...pts.map(p => p.v)) * 100, 4), ty = o.niceTicks(Math.min(0, ...pts.map(p => p.r * 100)), Math.max(...pts.map(p => p.r * 100)), 4);
      const X = v => pad + (v * 100 - tx[0]) / (tx[tx.length - 1] - tx[0]) * (w - pad * 2), Y = r => 10 + (1 - (r * 100 - ty[0]) / (ty[ty.length - 1] - ty[0])) * (hgt - 40);
      ty.forEach(t => { o.svgEl('line', { x1: pad, x2: w - pad, y1: Y(t / 100), y2: Y(t / 100), class: 'grid-line' }, svg); const l = o.svgEl('text', { x: w - pad + 6, y: Y(t / 100) + 4, class: 'ax' }, svg); l.textContent = t + '%'; });
      tx.forEach(t => { const l = o.svgEl('text', { x: X(t / 100), y: hgt - 10, class: 'ax', 'text-anchor': 'middle' }, svg); l.textContent = t + '%'; });
      o.svgEl('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p.v) + ',' + Y(p.r)).join(''), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
      [[mv, 'Least risk'], [ms, 'Best Sharpe'], [pts[0], 'B'], [pts[100], 'A']].forEach(([p, l]) => { o.svgEl('circle', { cx: X(p.v), cy: Y(p.r), r: 4.5, fill: 'var(--ink)' }, svg); const t = o.svgEl('text', { x: X(p.v) + 8, y: Y(p.r) - 6, class: 'ax', fill: 'var(--ink)' }, svg); t.textContent = l; });
      const ax = o.svgEl('text', { x: pad, y: hgt - 10, class: 'ax', 'text-anchor': 'start' }, svg); ax.textContent = '';
      o.$('#rd').textContent = 'Horizontal axis: volatility. Vertical axis: expected return.';
    };
    live(['R1', 'V1', 'R2', 'V2', 'C', 'RF'], go);
  },
  'position-sizing'(box) {
    const o = O();
    box.innerHTML = `${fields([['A', 'Account size', 50000], ['R', 'Risk per trade, % of account', 1], ['E', 'Entry price', 100], ['S', 'Stop price', 94], ['T', 'Target price', 115]])}<div id="res"></div>`;
    const go = () => {
      const A = val('A'), r = val('R') / 100, E = val('E'), S = val('S'), T = val('T'); const risk = Math.abs(E - S); const cash = A * r; const sh = risk > 0 ? Math.floor(cash / risk) : 0; const pos = sh * E;
      o.$('#res').innerHTML = out([['Shares to buy', sh.toLocaleString('en-US')], ['Position size', o.money(pos), `${o.num(pos / A * 100, 1)}% of the account`], ['Loss if stopped', o.money(sh * risk), `${o.num(r * 100, 2)}% of the account`], ['Gain at target', o.money(sh * Math.abs(T - E))], ['Reward to risk', risk ? o.num(Math.abs(T - E) / risk, 2) + ' : 1' : '–']]);
    };
    live(['A', 'R', 'E', 'S', 'T'], go);
  },
  'dcf'(box) {
    const o = O();
    box.innerHTML = `${fields([['F', 'Free cash flow this year, bn', 10], ['G', 'Growth, years 1 to 5, %', 8], ['R', 'Discount rate, %', 9], ['T', 'Growth after year 10, %', 2.5], ['D', 'Net debt, bn', 5], ['S', 'Shares, bn', 1]])}<div id="res"></div><div class="chart-box" id="ch"></div><p class="src">Growth fades in a straight line from year 6 to year 10, then grows at the terminal rate for ever (Gordon growth).</p>`;
    const go = () => {
      let f = val('F'); const g1 = val('G') / 100, r = val('R') / 100, gT = val('T') / 100, nd = val('D'), sh = val('S'); const pv = [];
      for (let t = 1; t <= 10; t++) { const g = t <= 5 ? g1 : g1 + (gT - g1) * (t - 5) / 5; f *= 1 + g; pv.push(f / Math.pow(1 + r, t)); }
      const tv = r > gT ? f * (1 + gT) / (r - gT) / Math.pow(1 + r, 10) : NaN; const ev = pv.reduce((a, b) => a + b, 0) + tv;
      o.$('#res').innerHTML = out([['Enterprise value', o.num(ev, 1) + 'bn'], ['Equity value', o.num(ev - nd, 1) + 'bn'], ['Value per share', o.num((ev - nd) / sh, 2)], ['After year 10', o.num(tv / ev * 100, 0) + '%', 'of the value']]);
      o.barChart(o.$('#ch'), { cats: [...pv.map((_, i) => String(i + 1)), 'After 10'], series: [{ type: 'out', v: [...pv, tv] }], h: 200, read: i => {} });
    };
    live(['F', 'G', 'R', 'T', 'D', 'S'], go);
  },
  'compound-growth'(box) {
    const o = O();
    box.innerHTML = `${fields([['P', 'Starting sum', 10000], ['M', 'Monthly addition', 500], ['R', 'Return, % a year', 7], ['Y', 'Years', 25], ['I', 'Inflation, % a year', 2]])}<div id="res"></div><div class="chart-box" id="ch"></div><div class="legend"><span><i class="l"></i>Value</span><span><i class="ld"></i>Money put in</span></div><p class="readout" id="rd"></p>`;
    const go = () => {
      const P = val('P'), M = val('M'), r = val('R') / 100, Y = Math.max(1, Math.min(80, Math.round(val('Y')))), inf = val('I') / 100; const mr = Math.pow(1 + r, 1 / 12) - 1;
      let v = P, inn = P; const vs = [P], is = [P], xs = [0];
      for (let mth = 1; mth <= Y * 12; mth++) { v = v * (1 + mr) + M; inn += M; if (mth % 12 === 0) { vs.push(v); is.push(inn); xs.push(mth / 12); } }
      const real = v / Math.pow(1 + inf, Y);
      o.$('#res').innerHTML = out([['Final value', o.money(v)], ['Money put in', o.money(inn)], ['Growth earned', o.money(v - inn), `${o.num((v - inn) / v * 100, 0)}% of the final value`], ['In today’s money', o.money(real), `after ${o.num(inf * 100, 1)}% inflation`]]);
      o.lineChart(o.$('#ch'), { x: xs, series: [{ v: is, dash: true }, { v: vs, width: 2 }], h: 240, xfmt: x => 'Year ' + x, fmtY: t => t >= 1e6 ? (t / 1e6) + 'm' : t >= 1e3 ? (t / 1e3) + 'k' : t, read: i => o.$('#rd').innerHTML = `Year ${xs[i]}: ${o.money(vs[i])}, of which ${o.money(is[i])} put in` });
    };
    live(['P', 'M', 'R', 'Y', 'I'], go);
  },
  'real-return'(box) {
    const o = O();
    box.innerHTML = `${fields([['N', 'Nominal return, % a year', 7], ['I', 'Inflation, % a year', 2.5], ['T', 'Tax on gains, %', 30], ['Y', 'Years', 10], ['A', 'Amount', 10000]])}<div id="res"></div>`;
    const go = () => {
      const n = val('N') / 100, i = val('I') / 100, t = val('T') / 100, Y = val('Y'), A = val('A');
      const real = (1 + n) / (1 + i) - 1, after = n * (1 - t), realAfter = (1 + after) / (1 + i) - 1;
      o.$('#res').innerHTML = out([['Real return', o.pct(real * 100), 'a year, before tax'], ['After tax', o.pct(after * 100), 'nominal, a year'], ['Real, after tax', o.pct(realAfter * 100), 'a year'], [`${Y} years on ${o.money(A)}`, o.money(A * Math.pow(1 + realAfter, Y)), 'in today’s money, after tax']]);
    };
    live(['N', 'I', 'T', 'Y', 'A'], go);
  },
};

async function tool(id) {
  const o = O(); const t = TOOLS[id];
  o.main().innerHTML = o.head({ crumbs: [['lab/', 'Lab'], ['lab/' + t[1] + '/', CATS[t[1]][0]]], title: t[0], lede: t[2] }) +
    `<div class="col-main rv" id="tool"></div><aside class="col-side rv"><h2 class="side-title">About this tool</h2><p class="side-src" style="font-size:13px">${PRIV} The figures are illustrations, not advice: real markets have fees, taxes, gaps and changing volatility.</p><h2 class="side-title" style="margin-top:28px">More tools</h2><div class="list" style="margin-top:0">${Object.keys(TOOLS).filter(x => x !== id && TOOLS[x][1] === t[1]).map(x => `<a href="${o.link('lab/' + x + '/')}"><span class="t">${TOOLS[x][0]}</span></a>`).join('')}</div></aside>`;
  await TOOL_FN[id](o.$('#tool'));
}

/* ================================================================== SIMULATORS */
async function simulators() {
  const o = O();
  o.main().innerHTML = o.head({ title: 'Simulators', lede: 'Play through real market history and test your decisions. Every simulator runs in your browser; your results stay on your device.' }) +
    `<div class="col-full"><section class="sec rv" style="border:0;padding-top:20px"><h2><a href="${o.link('simulators/market-replays/')}">Market replays</a></h2><div class="cards">${simCards('market-replays')}</div></section><section class="sec rv" style="border:0;padding-top:20px"><h2><a href="${o.link('simulators/strategy-games/')}">Strategy games</a></h2><div class="cards">${simCards('strategy-games')}</div></section></div>`;
}
function simCards(cat) {
  const o = O();
  const C = { 'market-replays': [['trading-simulator', 'Trading Simulator', 'Two hidden years of the S&P 500, Nasdaq, Euro Stoxx 50 or Nikkei, played day by day. Stay in or move to cash, and see if you can beat the index.', 'S&P 500 with dividends since 1928; other indices prices only'], ['panic-test', 'Panic Test', 'Start at the last high before one of the great falls of the market you pick. Sell when you can’t take any more, buy back when you are ready.', 'Every fall of 25% or more on record']], 'strategy-games': [['portfolio-builder', 'Portfolio Builder', 'Split $10,000 between US stocks, bonds and cash and run it through ten hidden years, against the classic 60/40.', 'S&P 500 with dividends, 10-year Treasuries from FRED']] };
  return C[cat].map(([u, t, d, m]) => `<a class="card" href="${o.link('simulators/' + u + '/')}"><h3>${t}</h3><p>${d}</p><span class="meta">${m}</span></a>`).join('');
}
async function simcat(k) {
  const o = O(); const T = { 'market-replays': ['Market replays', 'Real market history, played day by day: two hidden years to trade, and one of the great crashes to sit through.'], 'strategy-games': ['Strategy games', 'Run a portfolio of stocks, bonds and cash through ten hidden years.'] }[k];
  o.main().innerHTML = o.head({ crumbs: [['simulators/', 'Simulators'], [null, T[0]]], title: T[0], lede: T[1] + ' Every simulator runs in your browser; your results stay on your device.' }) + `<div class="col-full rv"><div class="cards">${simCards(k)}</div></div>`;
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function trading(mode) {
  const o = O(); const panic = mode === 'panic';
  const title = panic ? 'Panic Test' : 'Trading Simulator';
  o.main().innerHTML = o.head({ crumbs: [['simulators/', 'Simulators'], ['simulators/market-replays/', 'Market replays']], title }) +
    `<div class="col-main rv"><div class="sim-bar"><div class="ctl__row" id="mode"></div><div class="ctl__row" id="mkt"></div><span class="sim-score" id="score">0.0 pts</span></div>
     <div class="sim-stage"><div class="chart-box" id="ch" style="margin-top:0"></div><div id="strip" style="height:8px;margin-top:8px;display:flex"></div>
     <div class="sim-bar"><button class="btn" id="start">Start</button><button class="btn btn--ghost" id="sw" disabled>${panic ? 'Sell' : 'Go to cash'}</button><span class="ctl__row" id="spd"></span></div>
     <div class="sim-legend"><span><i class="l" style="display:inline-block;width:14px;border-top:2px solid var(--ink);vertical-align:3px;margin-right:6px"></i>You</span><span><i style="display:inline-block;width:14px;border-top:1.5px dashed var(--ink-3);vertical-align:3px;margin-right:6px"></i>${panic ? 'Holding on' : 'The index'}</span><span>Space: switch · P: pause · 1–4: speed</span></div></div>
     <div class="sim-result" id="res"></div>
     <section class="sec" style="margin-top:24px"><h2>How it works</h2><div class="prose">${panic ? `<p>You hold $10,000 at the last high before one of the great falls of the market you pick: every fall of 25% or more on record. You are not told which. The chart moves forward one trading day at a time, for three years. Sell when you can’t take any more and buy back when you are ready, as often as you like.</p><p>Your rival holds on: the same $10,000, never sold. At the end you see what your decisions cost or earned, how deep the fall went and how long the market took to regain its high.</p>` : `<p>You start with $10,000 in the market on the first day of a two-year stretch picked from its history, without being told which. The chart moves forward one trading day at a time. Press the button, or the space bar, to go to cash or back into the market, as often as you like. Your rival, the index, buys on the first day and never sells.</p><p>At the end, 1,000 random players who were invested for the same number of days and traded as often as you show whether your result was skill or luck: beat 90% of them and it was skill.</p>`}<p>The S&P 500 includes dividends: the S&P 500 Total Return index from 1988, and an approximation of 4% a year before that. The Nasdaq, the Euro Stoxx 50 and the Nikkei are prices only. Cash earns a flat 2% a year. A switch takes effect from the next day’s close. No fees, no taxes.</p></div></section>
     <p class="disclaimer">For information and education only. Not investment advice.</p></div>`;
  const MK = [['spx', 'S&P 500'], ['ndq', 'Nasdaq'], ['sx5e', 'Euro Stoxx 50'], ['nky', 'Nikkei 225']];
  let mk = 'spx', daily = true, speed = 2, game = null, timer = null;
  o.chips(o.$('#mode'), [['d', 'Today’s challenge'], ['r', 'Random period']], 'd', v => { daily = v === 'd'; });
  o.chips(o.$('#mkt'), MK, mk, v => { mk = v; });
  o.chips(o.$('#spd'), [['1', '1x'], ['2', '2x'], ['3', '4x'], ['4', '8x']], '2', v => { speed = +v; restartTimer(); });
  const load = async () => o.uncompact(await o.data(`sims/${mk}.json`));
  const pickWindow = (pts) => {
    const today = new Date(); const rnd = daily ? seeded(+o.iso(today).replace(/-/g, '') * (MK.findIndex(x => x[0] === mk) + 7) * (panic ? 3 : 1)) : Math.random;
    if (panic) {
      const eps = []; let peak = pts[0][1], pi = 0, inFall = false, low = 1e18;
      pts.forEach(([d, v], i) => { if (v >= peak) { if (inFall && low / peak <= .75) eps.push(pi); peak = v; pi = i; inFall = false; low = 1e18; } else { inFall = true; low = Math.min(low, v); } });
      if (inFall && low / peak <= .75) eps.push(pi);
      const ok = eps.filter(i => i + 30 < pts.length);
      if (!ok.length) return [0, Math.min(pts.length - 1, 756)];
      const s = ok[Math.floor(rnd() * ok.length)]; return [s, Math.min(pts.length - 1, s + 756)];
    }
    const len = 504; const s = Math.floor(rnd() * (pts.length - len - 1)); return [s, s + len];
  };
  const draw = () => {
    if (!game) { o.$('#ch').innerHTML = '<div style="height:300px;display:grid;place-items:center;color:var(--ink-3)">Press Start</div>'; return; }
    const g = game; const k = g.i + 1;
    const xs = g.pts.slice(0, k).map(p => p[0]);
    const you = g.you.slice(0, k), idx = g.idx.slice(0, k);
    const pad = Math.max(0, g.n - k);
    const X = [...xs, ...Array(pad).fill(null).map((_, j) => new Date(xs[xs.length - 1].getTime() + (j + 1) * 864e5))];
    const fill = v => [...v, ...Array(pad).fill(null)];
    o.lineChart(o.$('#ch'), { x: X, series: [{ v: fill(idx), dash: true }, { v: fill(you), width: 2.2 }], h: 300, xlabels: [], fmtY: t => '$' + (t / 1000).toFixed(0) + 'k' });
    o.$('#strip').innerHTML = g.state.slice(0, k).map(s => `<i style="flex:1;background:${s ? 'var(--ink)' : 'var(--band)'}"></i>`).join('') + `<i style="flex:${pad}"></i>`;
    const sc = (you[you.length - 1] / idx[idx.length - 1] - 1) * 100; o.$('#score').innerHTML = `${o.sgn(sc, 1)} pts against ${panic ? 'holding' : 'the index'}`;
  };
  const step = () => {
    const g = game; if (!g || g.paused) return;
    if (g.i >= g.n - 1) return end();
    const i = g.i + 1; const r = g.pts[i][1] / g.pts[i - 1][1] - 1; const cash = Math.pow(1.02, 1 / 252) - 1;
    g.you[i] = g.you[i - 1] * (1 + (g.state[i - 1] ? r : cash)); g.idx[i] = g.idx[i - 1] * (1 + r); g.state[i] = g.want; g.i = i; draw();
  };
  const restartTimer = () => { clearInterval(timer); if (game && !game.done) timer = setInterval(step, [0, 120, 60, 28, 10][speed]); };
  const end = () => {
    clearInterval(timer); const g = game; g.done = true; o.$('#sw').disabled = true; o.$('#start').textContent = 'Play again';
    const you = g.you[g.n - 1], idx = g.idx[g.n - 1]; const d0 = g.pts[0][0], d1 = g.pts[g.n - 1][0];
    const inDays = g.state.slice(0, g.n - 1).filter(Boolean).length; const switches = g.state.slice(1).filter((s, i) => s !== g.state[i]).length;
    let beat = 0; const rets = g.pts.slice(1).map((p, i) => p[1] / g.pts[i][1] - 1);
    for (let k = 0; k < 1000; k++) { const st = Array(g.n - 1).fill(0); const pos = new Set(); while (pos.size < inDays) pos.add(Math.floor(Math.random() * (g.n - 1))); pos.forEach(p => st[p] = 1); let v = 10000; st.forEach((s, j) => v *= 1 + (s ? rets[j] : Math.pow(1.02, 1 / 252) - 1)); if (you > v) beat++; }
    const peak = Math.max(...g.pts.map(p => p[1])), low = Math.min(...g.pts.map(p => p[1]));
    o.$('#res').innerHTML = `<h2>${you >= idx ? 'You beat ' + (panic ? 'holding on' : 'the index') : (panic ? 'Holding on' : 'The index') + ' won'}</h2><p class="lede">The period ran from ${o.fmtD(d0)} to ${o.fmtD(d1)}${panic ? `: the market fell ${o.num((low / g.pts[0][1] - 1) * 100, 1)}% from its high at the worst point` : ''}.</p>` +
      `<div class="kstrip"><div><span class="kpi__name">You</span><div class="kpi__level">${o.money(you)}</div><div class="kpi__chg">${o.mv((you / 1e4 - 1) * 100, 1)}</div></div><div><span class="kpi__name">${panic ? 'Holding on' : 'The index'}</span><div class="kpi__level">${o.money(idx)}</div><div class="kpi__chg">${o.mv((idx / 1e4 - 1) * 100, 1)}</div></div><div><span class="kpi__name">Days invested</span><div class="kpi__level">${inDays} of ${g.n - 1}</div><div class="kpi__chg">${switches} switches</div></div><div><span class="kpi__name">Random players beaten</span><div class="kpi__level">${(beat / 10).toFixed(0)}%</div><div class="kpi__chg">${beat >= 900 ? 'Skill' : beat >= 500 ? 'Better than chance' : 'Luck, or less'}</div></div></div>`;
    try { const k = 'ops-sim-' + mode; const best = JSON.parse(localStorage.getItem(k) || '[]'); best.push({ d: o.iso(new Date()), s: (you / idx - 1) * 100 }); localStorage.setItem(k, JSON.stringify(best.slice(-50))); } catch (e) {}
  };
  const start = async () => {
    o.$('#res').innerHTML = ''; o.$('#start').textContent = 'Loading…';
    const pts = await load().catch(() => null); if (!pts || pts.length < 600) { o.$('#res').innerHTML = o.fail(); o.$('#start').textContent = 'Start'; return; }
    const [a, b] = pickWindow(pts); const w = pts.slice(a, b + 1);
    game = { pts: w, n: w.length, i: 0, you: [1e4], idx: [1e4], state: [1], want: 1, paused: false, done: false };
    o.$('#sw').disabled = false; o.$('#sw').textContent = panic ? 'Sell' : 'Go to cash'; o.$('#start').textContent = 'Restart'; draw(); restartTimer();
  };
  const switchPos = () => { if (!game || game.done) return; game.want = game.want ? 0 : 1; o.$('#sw').textContent = game.want ? (panic ? 'Sell' : 'Go to cash') : (panic ? 'Buy back' : 'Back into the market'); };
  o.$('#start').onclick = start; o.$('#sw').onclick = switchPos;
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space') { e.preventDefault(); switchPos(); } if (e.key === 'p' || e.key === 'P') { if (game) game.paused = !game.paused; } if (['1', '2', '3', '4'].includes(e.key)) { speed = +e.key; restartTimer(); o.$$('#spd .chip').forEach(c => c.classList.toggle('on', c.dataset.v === e.key)); } });
  draw();
}

async function portfolio() {
  const o = O();
  o.main().innerHTML = o.head({ crumbs: [['simulators/', 'Simulators'], ['simulators/strategy-games/', 'Strategy games']], title: 'Portfolio Builder' }) +
    `<div class="col-main rv"><div class="mix"><span>Stocks</span><input type="range" id="ws" min="0" max="100" step="5" value="60"><b id="vs" class="tnum">60%</b></div><div class="mix"><span>Bonds</span><input type="range" id="wb" min="0" max="100" step="5" value="30"><b id="vb" class="tnum">30%</b></div><div class="mix"><span>Cash</span><span class="muted" style="font-size:13px">takes what is left</span><b id="vc" class="tnum">10%</b></div>
     <div class="ctl"><div class="ctl__lab">Rebalance</div><div class="ctl__row" id="rb"></div></div>
     <div class="sim-bar"><button class="btn" id="run">Run ten years</button><button class="btn btn--ghost" id="new">New hidden years</button></div>
     <div class="sim-stage"><div class="chart-box" id="ch" style="margin-top:0"></div><div class="sim-legend"><span>— Your mix</span><span>- - The classic 60/40</span></div></div><div id="res" class="sim-result"></div>
     <section class="sec" style="margin-top:24px"><h2>How it works</h2><div class="prose"><p>Ten years are picked at random from US history since 1954, without their dates. Your $10,000 is split between stocks, bonds and cash as you choose; cash takes whatever stocks and bonds leave. Without rebalancing the mix drifts with the markets; rebalancing resets it every twelve months. The dashed line is the classic 60/40, 60% stocks and 40% bonds rebalanced every year.</p><p>Stocks are the S&P 500 with dividends. Bonds are a 10-year US Treasury bought each month at par, its return the coupon plus the price change as yields move, from FRED. Cash earns a flat 2% a year. Monthly returns; no fees, no taxes.</p></div></section><p class="disclaimer">For information and education only. Not investment advice.</p></div>`;
  const d = await o.data('sims/portfolio.json').catch(() => null);
  if (!d) { o.$('#res').innerHTML = o.fail(); return; }
  let rb = 'Every year', start = null;
  o.chips(o.$('#rb'), ['Never', 'Every year'], rb, v => { rb = v; });
  const sync = () => { let s = +o.$('#ws').value, b = +o.$('#wb').value; if (s + b > 100) { b = 100 - s; o.$('#wb').value = b; } o.$('#vs').textContent = s + '%'; o.$('#vb').textContent = b + '%'; o.$('#vc').textContent = (100 - s - b) + '%'; };
  o.$('#ws').oninput = sync; o.$('#wb').oninput = () => { let s = +o.$('#ws').value, b = +o.$('#wb').value; if (s + b > 100) { s = 100 - b; o.$('#ws').value = s; } sync(); };
  const pick = () => { start = Math.floor(Math.random() * (d.stocks.length - 120)); };
  const sim = (ws, wb, reb) => { const cm = Math.pow(1 + d.cash, 1 / 12) - 1; let a = [ws, wb, 1 - ws - wb].map(x => x * 1e4); const out = [1e4]; for (let k = 0; k < 120; k++) { const i = start + k; a = [a[0] * (1 + d.stocks[i]), a[1] * (1 + d.bonds[i]), a[2] * (1 + cm)]; const t = a[0] + a[1] + a[2]; if (reb && (k + 1) % 12 === 0) a = [ws * t, wb * t, (1 - ws - wb) * t]; out.push(t); } return out; };
  const run = () => {
    if (start == null) pick(); const ws = +o.$('#ws').value / 100, wb = +o.$('#wb').value / 100;
    const you = sim(ws, wb, rb === 'Every year'), cl = sim(.6, .4, true);
    const xs = you.map((_, i) => i);
    o.lineChart(o.$('#ch'), { x: xs, series: [{ v: cl, dash: true }, { v: you, width: 2.2 }], h: 280, xlabels: [0, 120], xfmt: i => i ? 'Year 10' : 'Year 0', fmtY: t => '$' + (t / 1000).toFixed(0) + 'k' });
    const dd = v => { let mx = 0, w = 0; v.forEach(x => { mx = Math.max(mx, x); w = Math.min(w, x / mx - 1); }); return w * 100; };
    const cagr = v => (Math.pow(v[v.length - 1] / v[0], 1 / 10) - 1) * 100;
    const y0 = new Date(o.D(d.start).getTime() + start * 30.44 * 864e5).getFullYear();
    o.$('#res').innerHTML = `<div class="kstrip"><div><span class="kpi__name">Your mix</span><div class="kpi__level">${o.money(you[120])}</div><div class="kpi__chg">${o.pct(cagr(you), 1)} a year</div></div><div><span class="kpi__name">Deepest fall</span><div class="kpi__level mv--down">${o.pct(dd(you), 1)}</div></div><div><span class="kpi__name">The 60/40</span><div class="kpi__level">${o.money(cl[120])}</div><div class="kpi__chg">${o.pct(cagr(cl), 1)} a year, fall ${o.pct(dd(cl), 1)}</div></div><div><span class="kpi__name">The hidden years</span><div class="kpi__level"><button class="btn btn--ghost btn--sm" id="rev">Reveal</button></div></div></div>`;
    o.$('#rev').onclick = e => { e.target.outerHTML = `${y0} to ${y0 + 9}`; };
  };
  o.$('#run').onclick = run; o.$('#new').onclick = () => { pick(); run(); };
  pick(); run(); o.onResize(run);
}

return { lab, labcat, tool, simulators, simcat, trading, portfolio };
})());
