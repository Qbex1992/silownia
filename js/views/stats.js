import { esc, num, signed, fmtShort, weekStart, TYPES } from '../util.js';
import { periodRange, summarize, volumeBars, exerciseHistory } from '../stats.js';
import { GROUP_NAMES } from '../importer.js';
import { barChart } from '../charts.js';
import { icon } from '../icons.js';

const KINDS = { week: 'Tydzień', month: 'Miesiąc', half: 'Pół roku', year: 'Rok' };
const TYPE_COLOR = { push: 'var(--push)', pull: 'var(--pull)', fbw: 'var(--fbw)' };

function delta(a, b, { pct = true, dec = 0, invert = false } = {}) {
  if (a == null || b == null || (!b && pct)) return '<em class="muted">—</em>';
  const d = pct ? (a - b) / b * 100 : a - b;
  if (Math.abs(d) < 0.05) return '<em class="muted">bez zmian</em>';
  const good = invert ? d < 0 : d > 0;
  return `<em class="${good ? 'up' : 'down'}">${signed(d, dec)}${pct ? '%' : ''}</em>`;
}

export function render(app) {
  const { state } = app;
  const kind = KINDS[app.params[0]] ? app.params[0] : 'month';
  const offset = Math.min(0, Number(app.params[1] ?? 0) || 0);
  const cur = periodRange(kind, offset);
  const prev = periodRange(kind, offset - 1);
  const a = summarize(state, cur.from, cur.to);
  // Porównujemy tylko z okresem, który w całości mieści się w historii — inaczej wychodzi +3000%.
  const firstDate = state.sessions[0]?.date;
  const comparable = firstDate && prev.from >= weekStart(firstDate);
  const b = comparable ? summarize(state, prev.from, prev.to) : {};
  const bars = volumeBars(state, kind, cur.from, cur.to).map(x => ({ ...x, color: x.type ? TYPE_COLOR[x.type] : undefined }));
  const groupMax = Math.max(1, ...Object.values(a.groups));

  const exIds = [...new Set(a.sessions.flatMap(s => s.exercises.map(e => e.exId)))];
  const exRows = exIds.map(id => {
    const hist = exerciseHistory(state.sessions, id);
    const inCur = hist.filter(h => h.date >= cur.from && h.date <= cur.to && h.e1rm);
    const before = hist.filter(h => h.date < cur.from && h.e1rm).at(-1);
    const best = inCur.length ? Math.max(...inCur.map(h => h.e1rm)) : null;
    return { id, ex: state.exercises[id], best, before: before?.e1rm ?? null };
  }).sort((x, y) => GROUP_NAMES.indexOf(x.ex?.group) - GROUP_NAMES.indexOf(y.ex?.group) || (x.ex?.name ?? '').localeCompare(y.ex?.name ?? '', 'pl'));

  return `
    <header class="top"><div><p class="muted small">Statystyki</p><h1>${KINDS[kind]}</h1></div></header>
    <nav class="tabs" aria-label="Okres">
      ${Object.entries(KINDS).map(([k, v]) => `<a href="#/statystyki/${k}/0" class="${k === kind ? 'on' : ''}">${v}</a>`).join('')}
    </nav>
    <div class="month-nav">
      <a class="icon-btn" href="#/statystyki/${kind}/${offset - 1}" aria-label="Poprzedni okres">${icon.chevronL}</a>
      <span class="small">${esc(cur.label)}</span>
      ${offset < 0 ? `<a class="icon-btn" href="#/statystyki/${kind}/${offset + 1}" aria-label="Następny okres">${icon.chevronR}</a>` : '<span class="icon-btn"></span>'}
    </div>

    <div class="metrics">
      <div class="metric"><span>Treningi</span><b>${a.count}${a.planned ? `<small>/${a.planned}</small>` : ''}</b>${delta(a.count, b.count, { pct: false })}</div>
      <div class="metric"><span>Objętość</span><b>${num(a.volume / 1000, 1)} t</b>${delta(a.volume, b.volume)}</div>
      <div class="metric"><span>Średnie RPE</span><b>${a.rpe ? num(a.rpe, 1) : '–'}</b>${a.rpe && b.rpe ? delta(a.rpe, b.rpe, { pct: false, dec: 1 }) : '<em class="muted">wpisuj RPE w treningu</em>'}</div>
      <div class="metric"><span>Serie wg planu</span><b>${a.planRate != null ? num(a.planRate * 100, 0) + '%' : '–'}</b>${a.planRate != null && b.planRate != null ? delta(a.planRate * 100, b.planRate * 100, { pct: false }) : ''}</div>
      <div class="metric"><span>Rekordy</span><b>${a.prs.length}</b>${delta(a.prs.length, b.prs?.length, { pct: false })}</div>
      <div class="metric"><span>Serie</span><b>${a.sets}</b>${delta(a.sets, b.sets)}</div>
    </div>
    <p class="small muted">${comparable ? `Porównanie z poprzednim okresem: ${esc(prev.label)}.` : 'Brak pełnych danych z poprzedniego okresu, więc bez porównania.'}</p>

    <section class="card">
      <h3>Objętość</h3>
      ${barChart(bars, { label: `Objętość treningowa: ${cur.label}` })}
      ${kind === 'week' ? `<div class="legend small">${Object.entries(TYPES).map(([k, v]) => `<span><i class="dot t-${k}"></i>${v.label}</span>`).join('')}</div>` : ''}
    </section>

    ${Object.keys(a.groups).length ? `
    <section class="card">
      <h3>Objętość wg partii</h3>
      ${GROUP_NAMES.filter(g => a.groups[g]).map(g => `
        <div class="hbar"><span>${g}</span><div><i style="width:${(a.groups[g] / groupMax * 100).toFixed(1)}%"></i></div><b>${num(a.groups[g] / 1000, 1)} t</b></div>`).join('')}
    </section>` : ''}

    ${a.prs.length ? `
    <section class="card">
      <h3>Rekordy w tym okresie</h3>
      <ul class="plain">
        ${a.prs.slice(-10).reverse().map(p => `<li><a href="#/cwiczenie/${encodeURIComponent(p.exId)}">${icon.trophy} ${esc(state.exercises[p.exId]?.name)}</a> <span class="muted small">${fmtShort(p.date)} · ${num(p.value)} kg (${signed(p.value - p.prev)})</span></li>`).join('')}
      </ul>
      ${a.prs.length > 10 ? `<p class="small muted">i ${a.prs.length - 10} więcej</p>` : ''}
    </section>` : ''}

    ${exRows.length ? `
    <section class="card">
      <h3>Ćwiczenia</h3>
      <p class="small muted">Szacowany ciężar maksymalny (1RM) w tym okresie i zmiana względem wcześniejszego wyniku.</p>
      <ul class="ex-list">
        ${exRows.map(r => `<li><a href="#/cwiczenie/${encodeURIComponent(r.id)}">
          <span><b>${esc(r.ex?.name ?? r.id)}</b><small class="muted">${esc(r.ex?.group ?? '')}</small></span>
          <span class="right">${r.best ? `${num(r.best)} kg` : '–'} ${r.best && r.before ? delta(r.best, r.before, { pct: false, dec: 1 }) : ''}</span>
        </a></li>`).join('')}
      </ul>
    </section>` : `<p class="muted">Brak treningów w tym okresie.</p>`}
  `;
}

