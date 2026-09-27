import { esc, num, fmtShort, fmtDay } from '../util.js';
import { exerciseHistory, e1rm } from '../stats.js';
import { GROUP_NAMES } from '../importer.js';
import { lineChart } from '../charts.js';
import { fmtSet } from './workout.js';
import { icon } from '../icons.js';

export function render(app) {
  const { state } = app;
  const id = app.params[0];
  const ex = state.exercises[id];
  if (!ex) return '<p>Nie ma takiego ćwiczenia.</p><a href="#/statystyki">Wróć</a>';
  const hist = exerciseHistory(state.sessions, id);
  const points = hist.filter(h => h.e1rm && !h.sets.some(s => s.flag === 'shift' || s.flag === 'reps')).map(h => ({ x: h.date, y: h.e1rm }));
  const weightPts = hist.filter(h => h.maxWeight).map(h => ({ x: h.date, y: h.maxWeight }));
  const volPts = hist.filter(h => h.volume).map(h => ({ x: h.date, y: h.volume }));
  const allSets = hist.flatMap(h => h.sets.filter(s => !s.flag).map(s => ({ ...s, date: h.date })));
  const bestE = allSets.reduce((b, s) => (e1rm(s) ?? 0) > (e1rm(b) ?? 0) ? s : b, allSets[0]);
  const heaviest = allSets.reduce((b, s) => (s.weight ?? 0) > (b?.weight ?? 0) ? s : b, allSets[0]);
  const first = points[0], last = points.at(-1);
  const others = Object.values(state.exercises).filter(x => x.id !== id).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

  return `
    <header class="top"><div><a class="muted small back" href="#/statystyki">${icon.chevronL} Statystyki</a><h1 class="h-ex">${esc(ex.name)}</h1></div></header>
    <div class="metrics">
      <div class="metric"><span>Szac. 1RM teraz</span><b>${last ? num(last.y) + ' kg' : '–'}</b>${first && last && first !== last ? `<em class="${last.y >= first.y ? 'up' : 'down'}">${last.y >= first.y ? '+' : ''}${num((last.y - first.y) / first.y * 100, 0)}% od ${fmtShort(first.x)}</em>` : ''}</div>
      <div class="metric"><span>Najlepsza seria</span><b>${bestE ? fmtSet(bestE) : '–'}</b><em class="muted">${bestE ? fmtShort(bestE.date) : ''}</em></div>
      <div class="metric"><span>Największy ciężar</span><b>${heaviest?.weight ? num(heaviest.weight) + (heaviest.unit === 'stack' ? ' ocz.' : ' kg') : '–'}</b><em class="muted">${heaviest ? fmtShort(heaviest.date) : ''}</em></div>
      <div class="metric"><span>Treningi</span><b>${hist.length}</b></div>
    </div>
    <section class="card"><h3>Szacowany 1RM</h3>${lineChart(points, { label: `Szacowany 1RM: ${ex.name}` })}</section>
    <section class="card"><h3>Największy ciężar</h3>${lineChart(weightPts, { color: 'var(--pull)', label: `Największy ciężar: ${ex.name}` })}</section>
    <section class="card"><h3>Objętość na trening</h3>${lineChart(volPts, { color: 'var(--fbw)', dec: 0, label: `Objętość: ${ex.name}` })}</section>
    <section class="card">
      <h3>Historia</h3>
      <ul class="history">
        ${hist.slice(-15).reverse().map(h => `<li><a href="#/sesja/${encodeURIComponent(h.sessionId)}"><span class="muted small">${fmtDay(h.date)}</span> ${h.sets.map(fmtSet).join(' · ')}</a></li>`).join('')}
      </ul>
    </section>
    <section class="card">
      <h3>Ustawienia ćwiczenia</h3>
      <label class="field">Nazwa <input id="ex-name" value="${esc(ex.name)}"></label>
      <label class="field">Partia
        <select id="ex-group">${GROUP_NAMES.map(g => `<option ${g === ex.group ? 'selected' : ''}>${g}</option>`).join('')}</select>
      </label>
      <label class="field">Połącz z innym ćwiczeniem
        <select id="merge"><option value="">Nie łącz</option>${others.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select>
      </label>
      <p class="small muted">Po połączeniu historia tego ćwiczenia przejdzie do wybranego i będzie jednym wykresem.</p>
      <button class="btn" id="merge-go">Połącz</button>
    </section>`;
}

export function mount(root, app) {
  const { state } = app;
  const id = app.params[0];
  const ex = state.exercises[id];
  if (!ex) return;
  root.onchange = e => {
    if (e.target.id === 'ex-name' && e.target.value.trim()) { ex.name = e.target.value.trim(); app.save(); app.render(); }
    if (e.target.id === 'ex-group') { ex.group = e.target.value; app.save(); }
  };
  root.onclick = e => {
    if (e.target.id !== 'merge-go') return;
    const target = root.querySelector('#merge').value;
    if (!target) { app.toast('Wybierz ćwiczenie do połączenia'); return; }
    if (!confirm(`Połączyć „${ex.name}” z „${state.exercises[target].name}”?`)) return;
    for (const s of state.sessions) for (const x of s.exercises) if (x.exId === id) x.exId = target;
    for (const t of Object.keys(state.plan)) {
      state.plan[t] = state.plan[t].map(p => p.exId === id ? { ...p, exId: target } : p)
        .filter((p, i, arr) => arr.findIndex(q => q.exId === p.exId) === i);
    }
    delete state.exercises[id];
    app.save();
    app.toast('Połączono');
    app.go(`#/cwiczenie/${encodeURIComponent(target)}`);
  };
}
