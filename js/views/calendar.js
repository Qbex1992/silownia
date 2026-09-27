import { today, addDays, addMonths, monthStart, weekStart, weekday, fromKey, fmtMonth, fmtDay, DAY_SHORT, DAY_NAMES, TYPES, num, plural } from '../util.js';
import { fbwDayFor, sessionsByDate, plannedDates, sessionVolume } from '../stats.js';
import { icon } from '../icons.js';

export function render(app) {
  const { state } = app;
  const month = app.params[0] ? `${app.params[0]}-01` : monthStart(today());
  const end = addDays(addMonths(month, 1), -1);
  const byDate = sessionsByDate(state.sessions);
  const planned = new Set(plannedDates(state.settings, weekStart(month), addDays(weekStart(end), 6)));
  const trackFrom = state.settings.trackFrom ?? today();
  const t = today();

  const cells = [];
  for (let i = 0; i < weekday(month); i++) cells.push('<div></div>');
  for (let d = month; d <= end; d = addDays(d, 1)) {
    const s = byDate[d]?.[0];
    const isPlanned = planned.has(d);
    const missed = !s && isPlanned && d < t && d >= trackFrom;
    const cls = ['cal-day', s ? `t-${s.type}` : '', !s && isPlanned && d >= t ? 'planned' : '', missed ? 'missed' : '', d === t ? 'today' : ''].join(' ');
    const label = `${fromKey(d).getDate()}${s ? `, ${TYPES[s.type].label}` : isPlanned && d >= t ? ', zaplanowany' : missed ? ', pominięty' : ''}`;
    cells.push(s
      ? `<a class="${cls}" href="#/sesja/${encodeURIComponent(s.id)}" aria-label="${label}"><span>${fromKey(d).getDate()}</span><b>${TYPES[s.type].short}</b></a>`
      : `<div class="${cls}" aria-label="${label}"><span>${fromKey(d).getDate()}</span></div>`);
  }

  const inMonth = state.sessions.filter(s => s.date >= month && s.date <= end);
  const vol = inMonth.reduce((v, s) => v + sessionVolume(s), 0);
  const mon = weekStart(t);
  const weeks = [mon, addDays(mon, 7)];
  const prevMonth = addMonths(month, -1).slice(0, 7);
  const nextMonth = addMonths(month, 1).slice(0, 7);

  return `
    <header class="top"><div><p class="muted small">Kalendarz</p><h1>${fmtMonth(month)}</h1></div></header>
    <div class="month-nav">
      <a class="icon-btn" href="#/kalendarz/${prevMonth}" aria-label="Poprzedni miesiąc">${icon.chevronL}</a>
      <span class="muted small">${inMonth.length} ${plural(inMonth.length, 'trening', 'treningi', 'treningów')} · ${num(vol / 1000, 1)} t</span>
      <a class="icon-btn" href="#/kalendarz/${nextMonth}" aria-label="Następny miesiąc">${icon.chevronR}</a>
    </div>
    <div class="card">
      <div class="cal">${DAY_SHORT.map(d => `<div class="cal-h">${d}</div>`).join('')}${cells.join('')}</div>
      <div class="legend small">
        ${Object.entries(TYPES).map(([k, v]) => `<span><i class="dot t-${k}"></i>${v.label}</span>`).join('')}
        <span><i class="dot planned"></i>zaplanowany</span>
        <span><i class="dot missed"></i>pominięty</span>
      </div>
    </div>
    <section class="card">
      <h3>Trening w tygodniu (FBW)</h3>
      <p class="small muted">Sobota i niedziela są stałe. Wybierz, kiedy robisz FBW.</p>
      ${weeks.map((w, i) => `
        <label class="field inline">${i ? 'Przyszły tydzień' : 'Ten tydzień'} <span class="muted small">(od ${fmtDay(w)})</span>
          <select data-week="${w}">
            ${DAY_NAMES.slice(0, 5).map((n, di) => `<option value="${di}" ${fbwDayFor(state.settings, w) === di ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>`).join('')}
    </section>`;
}

export function mount(root, app) {
  root.onchange = e => {
    const w = e.target.dataset.week;
    if (!w) return;
    app.state.settings.weekFbw[w] = Number(e.target.value);
    app.save();
    app.render();
  };
}
