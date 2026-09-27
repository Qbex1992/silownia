export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const pad = n => String(n).padStart(2, '0');

// Daty trzymamy jako lokalne klucze 'RRRR-MM-DD', żeby uniknąć przesunięć stref czasowych.
export const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => toKey(new Date());
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
export const addMonths = (k, n) => { const d = fromKey(k); d.setDate(1); d.setMonth(d.getMonth() + n); return toKey(d); };
/** 0 = poniedziałek … 6 = niedziela */
export const weekday = k => (fromKey(k).getDay() + 6) % 7;
export const weekStart = k => addDays(k, -weekday(k));
export const monthStart = k => k.slice(0, 8) + '01';
export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);

export const DAY_NAMES = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
export const DAY_SHORT = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'];
export const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export const fmtDate = k => { const d = fromKey(k); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtDay = k => { const d = fromKey(k); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
export const fmtShort = k => { const d = fromKey(k); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
export const fmtMonth = k => { const d = fromKey(k); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtMonthShort = k => MONTHS_SHORT[fromKey(k).getMonth()];

export const num = (n, dec = 1) => (n == null || Number.isNaN(n))
  ? '–'
  : Number(n).toLocaleString('pl-PL', { maximumFractionDigits: dec });

export const signed = (n, dec = 1) => (n > 0 ? '+' : n < 0 ? '−' : '±') + num(Math.abs(n), dec);

/** Odmiana: plural(5, 'trening', 'treningi', 'treningów') */
export function plural(n, one, few, many) {
  const a = Math.abs(n);
  if (a === 1) return one;
  const d = a % 10, t = a % 100;
  return (d >= 2 && d <= 4 && !(t >= 12 && t <= 14)) ? few : many;
}

const ACRONYMS = new Set(['OHP', 'RDL', 'FBW', 'TRX']);
/** 'WYCISKANIE PŁASKA ŁAWKA' → 'Wyciskanie płaska ławka', skróty zostają wielkimi literami. */
export function sentence(s) {
  const words = String(s).trim().replace(/\s+/g, ' ').split(' ');
  const out = words.map(w => ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w.toLocaleLowerCase('pl')).join(' ');
  return out.charAt(0).toLocaleUpperCase('pl') + out.slice(1);
}

export const TYPES = {
  push: { label: 'Push', short: 'P' },
  pull: { label: 'Pull', short: 'L' },
  fbw: { label: 'FBW', short: 'F' },
};

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
