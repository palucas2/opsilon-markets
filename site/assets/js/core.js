/* Opsilon Markets – core: shell, utilities, charts. Exposes window.O */
(function () {
'use strict';
const ROOT = document.documentElement.dataset.root || './';
const BODY = document.body;
const NS = 'http://www.w3.org/2000/svg';
const MIN = '−';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ------------------------------------------------------------------ utils */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const isNum = v => typeof v === 'number' && isFinite(v);
const num = (v, d = 2) => isNum(v) ? (v < 0 ? MIN : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const sgn = (v, d = 2) => isNum(v) ? (v >= 0 ? '+' : MIN) + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const pct = (v, d = 2) => isNum(v) ? sgn(v, d) + '%' : '–';
const cls = v => !isNum(v) ? '' : v >= 0 ? 'mv--up' : 'mv--down';
const mv = (v, d = 2, suf = '%') => isNum(v) ? `<span class="${cls(v)}">${sgn(v, d)}${suf}</span>` : '–';
const money = (v, cur = '$', d = 0) => isNum(v) ? (v < 0 ? MIN : '') + cur + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const big = (bn, cur = '$') => !isNum(bn) ? '–' : Math.abs(bn) >= 1000 ? `${cur}${(bn / 1000).toFixed(2)}tn` : Math.abs(bn) >= 1 ? `${cur}${bn.toFixed(1)}bn` : `${cur}${(bn * 1000).toFixed(0)}m`;
const D = s => s instanceof Date ? s : new Date(String(s).slice(0, 10) + 'T12:00:00');
const fmtD = s => { const d = D(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDS = s => { const d = D(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtM = s => { const d = D(s); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const iso = d => { const x = D(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const ccySym = c => ({ USD: '$', EUR: '€', GBP: '£', GBp: 'GBp ', JPY: '¥', CNY: '¥', HKD: 'HK$', KRW: '₩', TWD: 'NT$', INR: '₹', CHF: 'CHF ', SEK: 'SEK ', DKK: 'DKK ', NOK: 'NOK ', PLN: 'zł ' }[c] ?? (c ? c + ' ' : '$'));
const debounce = (fn, ms = 80) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const cache = {};
async function data(path) {
  if (cache[path]) return cache[path];
  cache[path] = fetch(ROOT + 'data/' + path, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); });
  return cache[path];
}
const uncompact = c => { const out = []; if (!c || !c.d0) return out; let t = D(c.d0).getTime(); c.dd.forEach((g, i) => { t += g * 864e5; out.push([new Date(t), c.v[i]]); }); return out; };
const link = p => ROOT + p;

/* ------------------------------------------------------------------ nav config */
const NAV = [
  { k: 'markets', label: 'Markets', desc: 'Live views of every major market', items: [
    ['dashboards/', 'Dashboards', 'Rates, equities, macro and cross-asset'],
    ['calendar/', 'Calendar', 'Results, central banks and releases, five weeks ahead'],
    ['world/', 'World', 'Twenty-five markets on eight measures'],
    ['fx/', 'FX', 'The dollar, majors and emerging markets'],
    ['commodities/', 'Commodities', 'Curves, positioning, inventories, shipping and weather'],
    ['companies/', 'Companies', 'The 600 largest in the US, Europe and Asia']] },
  { k: 'tools', label: 'Tools', desc: 'Calculators and simulators that run in your browser', items: [
    ['lab/options/', 'Options', 'Payoff diagrams and Black-Scholes'],
    ['lab/bonds/', 'Bonds', 'Price, duration and yield to maturity'],
    ['lab/risk-and-portfolio/', 'Risk & portfolio', 'Correlation, frontier, position sizing'],
    ['lab/valuation-and-growth/', 'Valuation & growth', 'DCF, compounding and real returns'],
    ['simulators/market-replays/', 'Market replays', 'Trade hidden years of real history'],
    ['simulators/strategy-games/', 'Strategy games', 'Run a portfolio through hidden decades']] },
  { k: 'research', label: 'Research', desc: 'Notes and indicators, refreshed after each close', items: [
    ['reports/', 'Daily note', 'Every US session, after the close'],
    ['research/', 'Research Library', 'Weekly reviews and longer work'],
    ['chart-of-the-day/', 'Chart of the day', 'The most unusual move of the session'],
    ['central-banks/', 'Central banks', 'Fed, ECB, BoE and BoJ'],
    ['recession-watch/', 'Recession watch', 'The indicators that lead downturns'],
    ['market-history/', 'Market history', 'Every S&P 500 episode since 1928']] },
];
const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 6.5a6.5 6.5 0 1 0 0 11"/><path d="M5.5 12H14"/></svg>';
const CHEV = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 3.5 5 7l3.5-3.5"/></svg>';
const ARROW = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2.5 7.5 7.5 2.5M3.5 2.5h4v4"/></svg>';

function shell() {
  const sec = BODY.dataset.section;
  if (BODY.dataset.page !== 'home') {
    const hdr = h(`<header class="site-header" id="hdr"><div class="site-header__in">
      <div class="brand"><button class="brand__mark" id="themeBtn" aria-label="Switch light or dark theme" title="Switch theme">${MARK}</button><a href="${link('')}">Opsilon Markets</a></div>
      <nav class="nav" aria-label="Main">${NAV.map(g => `<div class="nav__item"><button class="nav__btn${g.k === sec ? ' is-current' : ''}" aria-haspopup="true">${g.label}${CHEV}</button>
        <div class="mega"><div class="mega__head"><b>${g.label}</b><span>${g.desc}</span></div>${g.items.map(([u, t, d]) => `<a href="${link(u)}"><b>${t}</b><span>${d}</span></a>`).join('')}</div></div>`).join('')}</nav>
      <div class="site-header__tools"><button class="icon-btn" id="searchBtn" aria-label="Search companies"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8.5" cy="8.5" r="5.75"/><path d="m13 13 4.5 4.5" stroke-linecap="round"/></svg></button>
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h14M3 13h14"/></svg></button></div></div></header>`);
    BODY.prepend(hdr);
    const mob = h(`<div class="mobile-nav" id="mobNav">${NAV.map(g => `<h3>${g.label}</h3>${g.items.map(([u, t]) => `<a href="${link(u)}">${t}</a>`).join('')}`).join('')}</div>`);
    BODY.appendChild(mob);
    $('#menuBtn').onclick = () => { mob.classList.toggle('open'); hdr.classList.toggle('menu-open'); };
    const sp = h(`<div class="search-pop" id="searchPop"><input placeholder="Search a company or ticker" aria-label="Search"><div class="search-res"></div></div>`);
    BODY.appendChild(sp);
    $('#searchBtn').onclick = async () => {
      sp.classList.toggle('open'); const inp = $('input', sp); inp.focus();
      const idx = await data('companies/index.json').catch(() => ({ rows: [] }));
      inp.oninput = () => {
        const q = inp.value.trim().toLowerCase();
        const res = q ? idx.rows.filter(r => r.n.toLowerCase().includes(q) || r.t.toLowerCase().startsWith(q)).slice(0, 8) : [];
        $('.search-res', sp).innerHTML = res.map(r => `<a href="${link('companies/' + r.slug + '/')}">${esc(r.n)}<span>${r.t} · ${r.sec}</span></a>`).join('');
      };
    };
    const onS = () => hdr.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', onS, { passive: true }); onS();
    const f = h(`<footer class="site-footer"><div class="wrap"><div class="site-footer__grid">
      <div class="f-brand"><div class="brand"><span class="brand__mark">${MARK}</span>Opsilon Markets</div><p>Research on US and global markets.</p></div>
      <div class="f-links">${NAV.flatMap(g => g.items).map(([u, t]) => `<a href="${link(u)}">${t}</a>`).join('')}<a href="${link('lab/')}">Lab</a><a href="${link('simulators/')}">Simulators</a><a href="${link('sources/')}">Data sources</a><a href="${link('methodology/')}">Methodology</a></div>
      </div><div class="f-bottom"><span>© ${new Date().getFullYear()} Opsilon Markets</span><span>For information only. Not investment advice.</span></div></div></footer>`);
    $('.page').appendChild(f);
  }
  const tb = $('#themeBtn');
  if (tb) tb.onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('ops-theme', t); } catch (e) {} };
  BODY.appendChild(h('<div class="tip" id="tip"></div>'));
  if (BODY.dataset.page !== 'home') sky();
}

function sky() {
  const c = h('<canvas id="sky" aria-hidden="true"></canvas>'); BODY.prepend(c);
  const g = c.getContext('2d'); let st = [];
  const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; st = Array.from({ length: Math.round(innerWidth * innerHeight / 9000) }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: (Math.random() * .9 + .3) * dpr, a: Math.random() * .3 + .04, s: Math.random() * .002 + .0005, p: Math.random() * 6.28 })); };
  size(); addEventListener('resize', debounce(size, 200));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const f = t => { g.clearRect(0, 0, c.width, c.height); const rgb = getComputedStyle(document.documentElement).getPropertyValue('--star').trim(); st.forEach(s => { g.fillStyle = `rgba(${rgb},${s.a * (.6 + .4 * Math.sin(t * s.s + s.p))})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); }); if (!reduce) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

function reveal(root = document) {
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -6% 0px' });
  $$('.rv:not(.in)', root).forEach(e => io.observe(e));
}

/* ------------------------------------------------------------------ tooltip */
function tip(html, x, y) { const t = $('#tip'); t.innerHTML = html; t.classList.add('on'); const r = t.getBoundingClientRect(); let L = x + 14, T = y - r.height - 10; if (L + r.width > innerWidth - 8) L = x - r.width - 14; if (T < 70) T = y + 16; t.style.left = L + 'px'; t.style.top = T + 'px'; }
function untip() { $('#tip')?.classList.remove('on'); }
function bindTip(el, html) { el.addEventListener('mousemove', e => tip(typeof html === 'function' ? html() : html, e.clientX, e.clientY)); el.addEventListener('mouseleave', untip); el.addEventListener('click', e => tip(typeof html === 'function' ? html() : html, e.clientX, e.clientY)); }

/* ------------------------------------------------------------------ page scaffolding */
function main() { return $('main'); }
function head({ crumbs, title, lede, meta, short = true, extra = '' }) {
  return `<header class="page-head rv${short ? ' page-head--short' : ''}">${crumbs ? `<div class="crumbs">${crumbs.map(([u, t]) => u ? `<a href="${link(u)}">${t}</a>` : t).join(' / ')}</div>` : ''}<h1>${title}</h1>${lede ? `<p class="page-lede">${lede}</p>` : ''}${meta ? `<p class="page-meta">${meta}</p>` : ''}${extra}</header>`;
}
function chips(el, opts, val, onChange, { check = false, multi = false } = {}) {
  el.innerHTML = opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; const on = multi ? val.includes(v) : v === val; return `<button class="chip${check ? ' chip--check' : ''}${on ? ' on' : ''}" data-v="${esc(v)}">${l}</button>`; }).join('');
  $$('button', el).forEach(b => b.onclick = () => {
    if (multi) { const v = b.dataset.v; const i = val.indexOf(v); if (i >= 0) { if (val.length > 1) val.splice(i, 1); } else val.push(v); $$('button', el).forEach(x => x.classList.toggle('on', val.includes(x.dataset.v))); onChange(val); }
    else { $$('button', el).forEach(x => x.classList.remove('on')); b.classList.add('on'); onChange(b.dataset.v); }
  });
}
function fail(msg = 'Data not available yet. It appears after the next update.') { return `<p class="empty">${msg}</p>`; }
function sortableTable(tbl, rows, cols, render) {
  let key = null, dir = -1;
  const draw = () => { const r = key == null ? rows : [...rows].sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; }); $('tbody', tbl).innerHTML = r.map(render).join(''); };
  $$('th[data-k]', tbl).forEach(th => { th.classList.add('sortable'); th.onclick = () => { const k = th.dataset.k; dir = key === k ? -dir : (th.dataset.dir ? +th.dataset.dir : -1); key = k; draw(); }; });
  draw(); return draw;
}

/* ------------------------------------------------------------------ charts */
const W = box => Math.max(240, box.clientWidth);
function niceTicks(lo, hi, n = 4) {
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n + .5) || 10 * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const t = [];
  for (let v = a; v <= b + step / 1e6; v += step) t.push(+v.toFixed(10));
  return t;
}

/* line chart: o = {x:[dates], series:[{v,name,dash,area,color,width,dots}], ticks, fmtY, read(i), h, log, shade:[[a,b]], base, zero, xfmt} */
function lineChart(box, o) {
  box.innerHTML = '';
  const w = W(box), hgt = o.h || 200, axW = o.axW ?? 40, top = 8, bot = 22, pw = w - axW - 4, ph = hgt - top - bot;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box);
  const n = o.x.length; if (!n) { box.innerHTML = fail(); return; }
  let all = []; o.series.forEach(s => s.v.forEach(v => isNum(v) && all.push(v)));
  if (o.base != null) all.push(o.base);
  let lo = Math.min(...all), hi = Math.max(...all);
  const T = o.log ? null : (o.ticks || niceTicks(lo, hi, o.nt || 4));
  if (T) { lo = Math.min(lo, T[0]); hi = Math.max(hi, T[T.length - 1]); }
  const tf = o.log ? (v => Math.log(v)) : (v => v);
  const L = tf(o.log ? Math.max(lo, 1e-9) : lo), H = tf(hi);
  const X = i => n === 1 ? pw / 2 : i / (n - 1) * pw;
  const Y = v => top + (1 - (tf(v) - L) / (H - L || 1)) * ph;
  const xs = o.x.map(D);
  (o.shade || []).forEach(([a, b]) => { const ia = xs.findIndex(d => d >= D(a)), ib = xs.findLastIndex ? xs.findLastIndex(d => d <= D(b)) : -1; if (ia >= 0 && ib >= ia) svgEl('rect', { x: X(ia), y: top, width: Math.max(1, X(ib) - X(ia)), height: ph, fill: 'var(--band)' }, svg); });
  const ticks = o.log ? (() => { const t = []; let p = Math.pow(10, Math.floor(Math.log10(lo))); while (p <= hi * 1.01) { [1, 2, 5].forEach(m => { const v = p * m; if (v >= lo * .98 && v <= hi * 1.02) t.push(v); }); p *= 10; } return t.length > 8 ? t.filter((_, i) => i % 2 === 0) : t; })() : T;
  ticks.forEach(t => { svgEl('line', { x1: 0, x2: pw, y1: Y(t), y2: Y(t), class: t === 0 && o.zero !== false && lo < 0 ? 'zero-line' : 'grid-line' }, svg); const tx = svgEl('text', { x: pw + 8, y: Y(t) + 4, class: 'ax' }, svg); tx.textContent = (o.fmtY || (v => v))(t); });
  if (o.base != null) svgEl('line', { x1: 0, x2: pw, y1: Y(o.base), y2: Y(o.base), stroke: 'var(--ink-3)', 'stroke-dasharray': '2 3' }, svg);
  const path = v => { let d = '', pen = false; v.forEach((y, i) => { if (!isNum(y) || (o.log && y <= 0)) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(y).toFixed(1); pen = true; }); return d; };
  o.series.forEach(s => {
    if (s.hidden) return;
    const col = s.color || (s.dash ? 'var(--ink-3)' : 'var(--chart-line)');
    if (s.area) { const fv = s.v.map(v => isNum(v) ? v : null); const first = fv.findIndex(isNum), last = fv.length - 1 - [...fv].reverse().findIndex(isNum); const zy = Y(Math.max(lo, Math.min(hi, s.areaBase ?? 0))); svgEl('path', { d: path(fv) + `L${X(last)},${zy}L${X(first)},${zy}Z`, fill: s.area === true ? 'var(--down-tint)' : s.area }, svg); }
    svgEl('path', { d: path(s.v), fill: 'none', stroke: col, 'stroke-width': s.width || (s.dash ? 1.25 : 1.5), 'stroke-dasharray': s.dash ? '3 2' : 'none', 'stroke-linejoin': 'round', opacity: s.opacity || 1 }, svg);
  });
  (o.hlines || []).forEach(([v, lab]) => { svgEl('line', { x1: 0, x2: pw, y1: Y(v), y2: Y(v), stroke: 'var(--ink-3)', 'stroke-dasharray': '3 3' }, svg); if (lab) { const t = svgEl('text', { x: 4, y: Y(v) - 4, class: 'ax' }, svg); t.textContent = lab; } });
  const xf = o.xfmt || fmtD;
  const xl = o.xlabels || [0, n - 1];
  xl.forEach((i, k) => { const t = svgEl('text', { x: X(i), y: hgt - 4, class: 'ax', 'text-anchor': k === 0 ? 'start' : k === xl.length - 1 ? 'end' : 'middle' }, svg); t.textContent = xf(o.x[i]); });
  if (o.marks) o.marks.forEach(m => { const i = xs.findIndex(d => d >= D(m.d)); if (i < 0) return; svgEl('line', { x1: X(i), x2: X(i), y1: top, y2: top + ph, stroke: 'var(--ink-3)', 'stroke-dasharray': '2 2' }, svg); if (m.label) { const t = svgEl('text', { x: X(i) + 4, y: top + 10, class: 'ax' }, svg); t.textContent = m.label; } });
  if (!o.read) return svg;
  const vline = svgEl('line', { x1: 0, x2: 0, y1: top, y2: top + ph, stroke: 'var(--ink-2)', 'stroke-width': 1 }, svg);
  const dots = o.series.map(s => s.hidden ? null : svgEl('circle', { r: 3.5, fill: s.dash ? 'var(--ground)' : (s.color || 'var(--ink)'), stroke: s.color || 'var(--ink)', 'stroke-width': 1.25 }, svg));
  const set = i => { vline.setAttribute('x1', X(i)); vline.setAttribute('x2', X(i)); o.series.forEach((s, k) => { if (!dots[k]) return; const v = s.v[i]; dots[k].style.display = isNum(v) ? '' : 'none'; if (isNum(v)) { dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(v)); } }); o.read(i); };
  const hit = svgEl('rect', { x: 0, y: 0, width: pw, height: hgt, fill: 'transparent', style: 'cursor:crosshair' }, svg);
  const pick = e => { const r = svg.getBoundingClientRect(); const px = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * w / r.width; set(Math.max(0, Math.min(n - 1, Math.round(px / pw * (n - 1))))); };
  hit.addEventListener('mousemove', pick); hit.addEventListener('touchmove', pick, { passive: true });
  hit.addEventListener('mouseleave', () => set(o.rest ?? n - 1));
  set(o.rest ?? n - 1);
  return svg;
}

/* grouped bars: o = {cats, series:[{type:'out'|'fill'|'dash'|'down'|'line', v, name}], ticks, fmtY, read(i), h} */
function barChart(box, o) {
  box.innerHTML = '';
  const w = W(box), hgt = o.h || 190, axW = 40, top = 8, bot = 26, pw = w - axW - 4, ph = hgt - top - bot;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box);
  const vals = o.series.flatMap(s => s.v).filter(isNum);
  if (!vals.length) { box.innerHTML = fail('No figures reported.'); return () => {}; }
  const T = o.ticks || niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 3);
  const [y0, y1] = [T[0], T[T.length - 1]];
  const Y = v => top + (1 - (v - y0) / (y1 - y0)) * ph; const n = o.cats.length, gw = pw / n;
  const band = svgEl('rect', { x: 0, y: top, width: gw, height: ph, fill: 'var(--band)' }, svg);
  T.forEach(t => { svgEl('line', { x1: 0, x2: pw, y1: Y(t), y2: Y(t), class: t === 0 && y0 < 0 ? 'zero-line' : 'grid-line' }, svg); const tx = svgEl('text', { x: pw + 8, y: Y(t) + 4, class: 'ax' }, svg); tx.textContent = (o.fmtY || (v => v))(t); });
  const bars = o.series.filter(s => s.type !== 'line'); const m = bars.length; const inner = gw * (o.fill || .72); const bw = Math.min(o.maxBw || 44, (inner - (m - 1) * 4) / m); const tot = m * bw + (m - 1) * 4;
  const ST = { out: { fill: 'var(--bar-dark)', stroke: 'var(--ink)' }, fill: { fill: 'var(--ink)', stroke: 'var(--ink)' }, dash: { fill: 'transparent', stroke: 'var(--ink)', 'stroke-dasharray': '3 2' }, down: { fill: 'var(--down)', stroke: 'var(--down)' }, up: { fill: 'var(--up)', stroke: 'var(--up)' } };
  o.cats.forEach((c, i) => {
    const gx = i * gw + (gw - tot) / 2;
    bars.forEach((s, k) => { const v = s.v[i]; if (!isNum(v)) return; const x = gx + k * (bw + 4); const ya = Y(Math.max(0, v)), yb = Y(Math.min(0, v)); const st = s.type === 'sign' ? (v >= 0 ? ST.up : ST.down) : ST[s.type]; svgEl('rect', Object.assign({ x: x + .5, y: ya, width: Math.max(1, bw - 1), height: Math.max(1, yb - ya), 'stroke-width': 1 }, st), svg); });
    if (!o.noLabels) { const l = svgEl('text', { x: i * gw + gw / 2, y: hgt - 6, 'text-anchor': 'middle', class: 'ax', fill: 'var(--ink)' }, svg); l.textContent = (o.catFmt || (x => x))(c, i); }
  });
  o.series.filter(s => s.type === 'line').forEach(s => { svgEl('path', { d: s.v.map((v, i) => (i ? 'L' : 'M') + (i * gw + gw / 2) + ',' + Y(v ?? 0)).join(''), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }, svg); s.v.forEach((v, i) => isNum(v) && svgEl('circle', { cx: i * gw + gw / 2, cy: Y(v), r: 3.5, fill: 'var(--ink)' }, svg)); });
  const set = i => { band.setAttribute('x', i * gw); o.read && o.read(i); };
  o.cats.forEach((c, i) => { const r = svgEl('rect', { x: i * gw, y: 0, width: gw, height: hgt, fill: 'transparent', style: 'cursor:pointer' }, svg); r.addEventListener('mouseenter', () => set(i)); r.addEventListener('click', () => set(i)); });
  svg.addEventListener('mouseleave', () => set(o.rest ?? n - 1));
  set(o.sel ?? o.rest ?? n - 1);
  return set;
}

/* ranked horizontal bars around zero: rows = [[name, value]] */
function hbars(box, rows, { fmt = v => pct(v), labelW = 130, h = 26 } = {}) {
  box.innerHTML = '';
  const w = W(box), valW = 70, pw = w - labelW - valW, hgt = rows.length * h + 4;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, height: hgt }, box);
  const mx = Math.max(1e-9, ...rows.map(r => Math.abs(r[1] || 0)));
  const hasNeg = rows.some(r => (r[1] || 0) < 0), hasPos = rows.some(r => (r[1] || 0) > 0);
  const z = labelW + (hasNeg && hasPos ? pw / 2 : hasNeg ? pw : 0);
  const sc = (hasNeg && hasPos ? pw / 2 : pw) / mx;
  svgEl('line', { x1: z, x2: z, y1: 0, y2: hgt, class: 'zero-line' }, svg);
  rows.forEach(([n, v], i) => {
    const y = i * h + 4;
    const t = svgEl('text', { x: 0, y: y + h / 2 + 2, 'font-size': 13, fill: 'var(--ink)' }, svg); t.textContent = n;
    if (isNum(v)) { const bw = Math.abs(v) * sc; svgEl('rect', { x: v >= 0 ? z : z - bw, y: y + 5, width: Math.max(1, bw), height: h - 12, fill: v >= 0 ? 'var(--up)' : 'var(--down)', opacity: .9 }, svg); }
    const vt = svgEl('text', { x: w, y: y + h / 2 + 2, 'font-size': 13, 'text-anchor': 'end', fill: v >= 0 ? 'var(--up-text)' : 'var(--down-text)' }, svg); vt.textContent = isNum(v) ? fmt(v) : '–';
  });
}

function spark(box, v, { h = 60, v2 = null, dash2 = true } = {}) {
  lineChart(box, { x: v.map((_, i) => i), series: [{ v }, ...(v2 ? [{ v: v2, dash: dash2 }] : [])], h, axW: 0, xlabels: [], ticks: niceTicks(Math.min(...v.filter(isNum), ...(v2 || []).filter(isNum)), Math.max(...v.filter(isNum), ...(v2 || []).filter(isNum)), 2), fmtY: () => '' });
}

function heatColor(v, scale = 2.5) {
  if (!isNum(v)) return 'var(--band)';
  const a = Math.min(1, Math.abs(v) / scale) * .75 + .2;
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(v >= 0 ? '--heat-up' : '--heat-down').trim();
  return `rgba(${rgb},${a})`;
}

function onResize(fn) { let last = innerWidth; addEventListener('resize', debounce(() => { if (Math.abs(innerWidth - last) > 4) { last = innerWidth; fn(); } }, 120)); }

window.O = { ROOT, $, $$, h, esc, svgEl, isNum, num, sgn, pct, cls, mv, money, big, D, fmtD, fmtDS, fmtM, iso, MONTHS, DAYS, ccySym, debounce, data, uncompact, link,
  tip, untip, bindTip, main, head, chips, fail, sortableTable, lineChart, barChart, hbars, spark, heatColor, niceTicks, onResize, reveal, ARROW, MIN, NAV, W };

/* boot */
shell();
const page = BODY.dataset.page;
document.addEventListener('DOMContentLoaded', () => {});
window.addEventListener('load', () => {});
queueMicrotask(async () => {
  const fn = (window.PAGES || {})[page];
  if (fn) { try { await fn(BODY.dataset.param); } catch (e) { console.error(e); main().insertAdjacentHTML('beforeend', fail('Something went wrong while loading this page.')); } }
  reveal();
});
})();
