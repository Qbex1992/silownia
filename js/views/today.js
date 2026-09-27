import { esc, today, weekStart, addDays, weekday, DAY_SHORT, fmtDate, fmtDay, num, signed, plural, TYPES, fromKey } from '../util.js';
import { quoteOfDay } from '../quotes.js';
import { WEEK_GOAL } from '../game.js';
import { fbwDayFor, sessionsByDate, sessionVolume, summarize, periodRange } from '../stats.js';
import { icon } from '../icons.js';
import { startDraft, suggestType } from './workout.js';

function weekStrip(state) {
  const mon = weekStart(today());
  const byDate = sessionsByDate(state.sessions);
  const fbw = fbwDayFor(state.settings, mon);
  return DAY_SHORT.map((d, i) => {
    const date = addDays(mon, i);
    const done = byDate[date]?.[0];
    const planned = i === 5 || i === 6 || i === fbw;
    const cls = ['day', done ? `t-${done.type}` : planned ? 'planned' : '', date === today() ? 'today' : ''].join(' ');
    return `<div class="${cls}"><span>${d}</span><b>${done ? TYPES[done.type].short : fromKey(date).getDate()}</b></div>`;
  }).join('');
}

function summaryCard(state, kind, title) {
  const cur = periodRange(kind, -1);
  const prev = periodRange(kind, -2);
  const a = summarize(state, cur.from, cur.to);
  if (!a.count) return '';
  const b = summarize(state, prev.from, prev.to);
  const dv = b.volume ? (a.volume - b.volume) / b.volume * 100 : null;
  return `<a class="card link summary" href="#/statystyki/${kind}/-1">
    <div class="card-head"><h3>${title}</h3><span class="muted small">${esc(cur.label)}</span></div>
    <div class="stats3">
      <div><span class="muted small">Treningi</span><b>${a.count}${a.planned ? `/${a.planned}` : ''}</b></div>
      <div><span class="muted small">Objętość</span><b>${num(a.volume / 1000, 1)} t</b>${dv != null ? `<em class="${dv >= 0 ? 'up' : 'down'}">${signed(dv, 0)}%</em>` : ''}</div>
      <div><span class="muted small">Rekordy</span><b>${a.prs.length}</b></div>
    </div>
  </a>`;
}

export function render(app) {
  const { state, game } = app;
  const q = quoteOfDay();
  const last = state.sessions.at(-1);
  const d = today();
  const type = suggestType(state);
  const nextLevelIn = game.need - game.into;
  const draft = state.draft;
  const doneToday = state.sessions.findLast(s => s.date === d);

  const summaries = [];
  if (weekday(d) <= 2) summaries.push(summaryCard(state, 'week', 'Podsumowanie tygodnia'));
  if (Number(d.slice(8)) <= 7) summaries.push(summaryCard(state, 'month', 'Podsumowanie miesiąca'));
  const m = d.slice(5, 7);
  if ((m === '01' || m === '07') && Number(d.slice(8)) <= 14) summaries.push(summaryCard(state, 'half', 'Podsumowanie półrocza'));
  if (m === '01' && Number(d.slice(8)) <= 14) summaries.push(summaryCard(state, 'year', 'Podsumowanie roku'));

  return `
  <header class="top">
    <div><p class="muted small">${fmtDate(d)}</p><h1>Dziś</h1></div>
    <a class="level-pill" href="#/profil" aria-label="Profil, poziom ${game.level}">
      <span class="ring" style="--p:${game.into / game.need}"><b>${game.level}</b></span>
    </a>
  </header>

  <figure class="card quote">
    <blockquote>${esc(q.text)}</blockquote>
    <figcaption>${esc(q.author)}</figcaption>
  </figure>

  ${!state.sessions.length ? `
    <div class="card empty">
      <h3>Wczytaj swoją historię</h3>
      <p class="muted">Zaimportuj arkusz z treningami, a od razu zobaczysz wykresy, rekordy i swój poziom.</p>
      <a class="btn primary" href="#/profil/import">${icon.upload} Importuj z Excela</a>
    </div>` : ''}

  <section class="card">
    <div class="card-head">
      <h3>Ten tydzień</h3>
      <span class="goal ${game.weekCount >= WEEK_GOAL ? 'ok' : ''}">${game.weekCount}/${WEEK_GOAL}</span>
    </div>
    <div class="week-strip">${weekStrip(state)}</div>
    <p class="small muted streak">${icon.flame} ${game.streak
      ? `Seria: ${game.streak} ${plural(game.streak, 'pełny tydzień', 'pełne tygodnie', 'pełnych tygodni')} z rzędu`
      : 'Zrób 3 treningi w tym tygodniu, żeby zacząć serię'}${game.bestStreak > game.streak ? ` · rekord ${game.bestStreak}` : ''}</p>
  </section>

  ${draft ? `
    <a class="btn primary big" href="#/trening">${icon.dumbbell} Wróć do treningu: ${TYPES[draft.type].label}</a>` : doneToday ? `
    <div class="card done-today">${icon.check}<div><b>Dziś zaliczone: ${TYPES[doneToday.type].label}</b>
      <p class="small muted">Dodatkowy trening: ${Object.keys(TYPES).map(t => `<button class="link-btn" data-start="${t}">${TYPES[t].label}</button>`).join(' · ')}</p></div></div>` : `
    <button class="btn primary big" data-start="${type}">${icon.dumbbell} Zacznij trening: ${TYPES[type].label}</button>
    <div class="alt-start">Albo:
      ${Object.keys(TYPES).filter(t => t !== type).map(t => `<button class="link-btn" data-start="${t}">${TYPES[t].label}</button>`).join(' · ')}
    </div>`}

  <a class="card link xp-card" href="#/profil">
    <div class="card-head"><h3>Poziom ${game.level} · ${esc(game.title)}</h3><span class="muted small">${num(game.xp, 0)} XP</span></div>
    <div class="bar"><i style="width:${(game.into / game.need * 100).toFixed(1)}%"></i></div>
    <p class="small muted">Do poziomu ${game.level + 1}: ${num(nextLevelIn, 0)} XP, czyli około ${Math.max(1, Math.ceil(nextLevelIn / 170))} ${plural(Math.max(1, Math.ceil(nextLevelIn / 170)), 'trening', 'treningi', 'treningów')}</p>
  </a>

  ${summaries.join('')}

  ${last ? `
    <a class="card link" href="#/sesja/${encodeURIComponent(last.id)}">
      <div class="card-head"><h3>Ostatni trening</h3><span class="tag t-${last.type}">${TYPES[last.type].label}</span></div>
      <p>${fmtDay(last.date)} · ${last.exercises.length} ${plural(last.exercises.length, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')} · ${num(sessionVolume(last) / 1000, 1)} t</p>
    </a>` : ''}
  `;
}

export function mount(root, app) {
  root.onclick = e => {
    const b = e.target.closest('[data-start]');
    if (b) { startDraft(app, b.dataset.start); app.go('#/trening'); }
  };
}

