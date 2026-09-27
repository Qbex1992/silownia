// Wykresy SVG bez bibliotek: linia (postęp w czasie) i słupki (objętość).
import { fromKey, fmtShort, num, esc } from './util.js';

function niceTicks(min, max, count = 3) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** points: [{ x: 'RRRR-MM-DD', y: liczba }] */
export function lineChart(points, { height = 160, color = 'var(--accent)', unit = '', dec = 1, label = 'Wykres' } = {}) {
  if (points.length < 2) return '<p class="muted small">Za mało danych na wykres.</p>';
  const W = 340, H = height, L = 36, R = 12, T = 12, B = 22;
  const xs = points.map(p => fromKey(p.x).getTime());
  const ys = points.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const padY = (max - min) * 0.12;
  min -= padY; max += padY;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = t => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  const area = `${path}L${X(xs.at(-1)).toFixed(1)} ${H - B}L${X(xs[0]).toFixed(1)} ${H - B}Z`;
  const grid = niceTicks(min, max).map(v => `
    <line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>
    <text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="axis">${num(v, dec)}</text>`).join('');
  const last = points.at(-1);
  const dots = points.length <= 40
    ? points.map((p, i) => `<circle cx="${X(xs[i])}" cy="${Y(p.y)}" r="2.5" fill="${color}"/>`).join('')
    : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}">
    ${grid}
    <path d="${area}" fill="${color}" opacity=".1"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <circle cx="${X(xs.at(-1))}" cy="${Y(last.y)}" r="4.5" fill="${color}"/>
    <text x="${L}" y="${H - 5}" class="axis">${fmtShort(points[0].x)}</text>
    <text x="${W - R}" y="${H - 5}" text-anchor="end" class="axis">${fmtShort(last.x)}</text>
  </svg>`;
}

/** bars: [{ label, value, color? }] */
export function barChart(bars, { height = 150, unit = 'kg', label = 'Wykres słupkowy' } = {}) {
  if (!bars.length || bars.every(b => !b.value)) return '<p class="muted small">Brak treningów w tym okresie.</p>';
  const W = 340, H = height, L = 4, R = 4, T = 18, B = 20;
  const max = Math.max(...bars.map(b => b.value)) || 1;
  const slot = (W - L - R) / bars.length;
  const bw = Math.min(34, slot * 0.68);
  const every = Math.ceil(bars.length / 8);
  const body = bars.map((b, i) => {
    const h = (b.value / max) * (H - T - B);
    const x = L + slot * i + (slot - bw) / 2;
    const showValue = bars.length <= 8 && b.value;
    return `<rect x="${x}" y="${H - B - h}" width="${bw}" height="${Math.max(h, b.value ? 2 : 0)}" rx="3" fill="${b.color ?? 'var(--accent)'}"/>
      ${showValue ? `<text x="${x + bw / 2}" y="${H - B - h - 5}" text-anchor="middle" class="axis">${num(b.value / 1000, 1)} t</text>` : ''}
      ${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" class="axis">${esc(b.label)}</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
