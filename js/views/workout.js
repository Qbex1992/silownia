import { esc, uid, today, weekday, weekStart, fmtDay, fmtShort, num, plural, TYPES } from '../util.js';
import { parseScheme, guessGroup, normalizeName, GROUP_NAMES } from '../importer.js';
import { lastPerformance, computePRs, e1rm, sessionVolume } from '../stats.js';
import { computeGame } from '../game.js';
import { icon } from '../icons.js';

const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const REST_CHOICES = [[90, '1:30'], [120, '2 min'], [180, '3 min']];
let timerHandle;

export function suggestType(state) {
  const d = today();
  const wd = weekday(d);
  const done = new Set(state.sessions.filter(s => s.date >= weekStart(d)).map(s => s.type));
  if (wd === 5) return done.has('push') ? 'pull' : 'push';
  if (wd === 6) return done.has('pull') ? 'push' : 'pull';
  return 'fbw';
}

function restSeconds(rest) {
  const m = String(rest ?? '').match(/(\d+)/);
  return m ? Number(m[1]) * 60 : 120;
}

function draftExercise(state, exId, scheme = '', rest = '') {
  const last = lastPerformance(state.sessions, exId);
  const targets = parseScheme(scheme);
  const n = targets.length || last?.sets.length || 3;
  return {
    exId, scheme, rest, note: '',
    sets: Array.from({ length: n }, (_, i) => {
      const prev = last?.sets[i] ?? last?.sets.at(-1);
      return {
        reps: null, weight: prev?.weight ?? null, unit: prev?.unit ?? 'kg', perSide: prev?.perSide ?? false,
        rpe: null, done: false, target: targets[i] ?? targets.at(-1) ?? prev?.reps ?? null,
      };
    }),
  };
}

export function startDraft(app, type) {
  const { state } = app;
  state.draft = {
    id: uid(), type, date: today(), startedAt: Date.now(), restEnd: null,
    exercises: state.plan[type].map(p => draftExercise(state, p.exId, p.scheme, p.rest)),
  };
  app.saveNow();
}

const fmtSet = s => s.unit === 'sec'
  ? `${num(s.reps)} s${s.weight ? ` × ${num(s.weight)}` : ''}`
  : `${num(s.reps)}×${num(s.weight)}${s.unit === 'stack' ? ' ocz.' : ''}${s.perSide ? '×2' : ''}`;
export { fmtSet };

function exerciseCard(state, ex, i, bestMap) {
  const info = state.exercises[ex.exId] ?? { name: ex.exId };
  const last = lastPerformance(state.sessions, ex.exId);
  const best = bestMap[ex.exId];
  const newBest = ex.sets.some(s => s.done && e1rm(s) && best && e1rm(s) > best + 0.01);
  const unitLabel = ex.sets[0]?.unit === 'stack' ? 'ocz.' : 'kg';
  const allDone = ex.sets.length && ex.sets.every(s => s.done);
  return `<article class="card ex ${allDone ? 'complete' : ''}" data-ex="${i}">
    <div class="ex-head">
      <div>
        <h3>${esc(info.name)}</h3>
        <p class="small muted">${ex.scheme ? `Plan ${esc(ex.scheme)}` : 'Bez planu'}${ex.rest ? ` · przerwa ${esc(ex.rest)}` : ''}</p>
      </div>
      <button class="icon-btn" data-act="remove-ex" aria-label="Usuń ćwiczenie z treningu">${icon.x}</button>
    </div>
    ${last ? `<p class="small last">Ostatnio ${fmtShort(last.date)}: ${last.sets.map(fmtSet).join(' · ')}</p>` : ''}
    ${newBest ? `<span class="chip pr">${icon.trophy} Nowy rekord</span>` : ''}
    <div class="sets">
      <div class="set head"><span></span><span>${unitLabel}</span><span>powt.</span><span>RPE</span><span></span></div>
      ${ex.sets.map((s, j) => `
        <div class="set ${s.done ? 'done' : ''}" data-set="${j}">
          <span class="n">${j + 1}</span>
          <input inputmode="decimal" data-f="weight" value="${s.weight ?? ''}" placeholder="–" aria-label="Ciężar serii ${j + 1}">
          <input inputmode="numeric" data-f="reps" value="${s.reps ?? ''}" placeholder="${s.target ?? '–'}" aria-label="Powtórzenia serii ${j + 1}">
          <select data-f="rpe" aria-label="RPE serii ${j + 1}">
            <option value="">–</option>
            ${RPE.map(r => `<option value="${r}" ${s.rpe === r ? 'selected' : ''}>${num(r)}</option>`).join('')}
          </select>
          <button class="check" data-act="done" aria-pressed="${s.done}" aria-label="Seria ${j + 1} zrobiona">${icon.check}</button>
        </div>`).join('')}
    </div>
    <div class="ex-actions">
      <button class="link-btn" data-act="add-set">${icon.plus} Seria</button>
      ${ex.sets.length > 1 ? `<button class="link-btn" data-act="del-set">Usuń ostatnią</button>` : ''}
      <button class="link-btn" data-act="note">${icon.note} Notatka</button>
    </div>
    ${ex.note || ex.showNote ? `<textarea data-f="note" rows="2" placeholder="Np. technika poprawiona, ławka na 2 poziomie">${esc(ex.note)}</textarea>` : ''}
  </article>`;
}

export function render(app) {
  const { state } = app;
  const draft = state.draft;
  clearInterval(timerHandle);

  if (!draft) {
    const type = suggestType(state);
    return `
      <header class="top"><div><p class="muted small">${fmtDay(today())}</p><h1>Trening</h1></div></header>
      <p class="muted">Wybierz trening. Ciężary podpowiem z ostatniego razu.</p>
      <div class="type-pick">
        ${Object.entries(TYPES).map(([t, v]) => `
          <button class="card type-card t-${t} ${t === type ? 'suggested' : ''}" data-start="${t}">
            <b>${v.label}</b>
            <span class="small muted">${state.plan[t].length} ${plural(state.plan[t].length, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')}</span>
            ${t === type ? '<span class="small accent">Na dziś</span>' : ''}
          </button>`).join('')}
      </div>`;
  }

  const { best } = computePRs(state.sessions);
  const doneEx = draft.exercises.filter(e => e.sets.length && e.sets.every(s => s.done)).length;
  return `
    <header class="top">
      <div>
        <label class="muted small date-edit">Data <input type="date" data-f="date" value="${draft.date}" max="${today()}"></label>
        <h1>${TYPES[draft.type].label}</h1>
      </div>
      <span class="goal">${doneEx}/${draft.exercises.length}</span>
    </header>
    <div id="rest" class="rest ${draft.restEnd ? '' : 'hidden'}" role="timer" aria-live="off">
      <div class="rest-top">
        ${icon.timer}<b id="rest-left">0:00</b>
        <button class="link-btn" data-act="rest-plus">+30 s</button>
        <button class="link-btn" data-act="rest-stop">Stop</button>
      </div>
      <div class="rest-pick" role="group" aria-label="Długość przerwy">
        ${REST_CHOICES.map(([sec, label]) => `<button data-act="rest-set" data-sec="${sec}" class="${draft.restLen === sec ? 'on' : ''}" aria-pressed="${draft.restLen === sec}">${label}</button>`).join('')}
      </div>
    </div>
    ${draft.exercises.map((ex, i) => exerciseCard(state, ex, i, best)).join('')}
    <button class="btn wide" data-act="add-ex">${icon.plus} Dodaj ćwiczenie</button>
    <div class="finish-bar">
      <button class="btn ghost" data-act="cancel">Anuluj</button>
      <button class="btn primary" data-act="finish">Zakończ trening</button>
    </div>`;
}

function tickRest(app) {
  const draft = app.state.draft;
  const box = document.getElementById('rest');
  if (!draft?.restEnd || !box) return;
  const left = Math.round((draft.restEnd - Date.now()) / 1000);
  const el = document.getElementById('rest-left');
  if (left <= 0) {
    el.textContent = 'Czas na serię';
    box.classList.add('over');
    if (!draft.restBuzzed) { navigator.vibrate?.([300, 150, 300, 150, 300]); draft.restBuzzed = true; }
    return;
  }
  box.classList.remove('over');
  el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function parseNum(v) {
  const n = Number(String(v).replace(',', '.').trim());
  return String(v).trim() === '' || Number.isNaN(n) ? null : n;
}

export function mount(root, app) {
  const { state } = app;
  if (state.draft?.restEnd) {
    tickRest(app);
    timerHandle = setInterval(() => tickRest(app), 1000);
  }

  root.onclick = e => {
    const start = e.target.closest('[data-start]');
    if (start) { startDraft(app, start.dataset.start); app.render(false); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const draft = state.draft;
    const exEl = btn.closest('[data-ex]');
    const ex = exEl ? draft.exercises[Number(exEl.dataset.ex)] : null;
    const act = btn.dataset.act;

    if (act === 'done') {
      const set = ex.sets[Number(btn.closest('[data-set]').dataset.set)];
      set.done = !set.done;
      if (set.done) {
        if (set.reps == null) set.reps = set.target;
        // Ostatnio wybrana przerwa dla tego ćwiczenia, a jeśli brak — pierwsza liczba z planu („2-3 min” → 2 min).
        const len = state.settings.restByEx?.[ex.exId] ?? restSeconds(ex.rest);
        Object.assign(draft, { restStart: Date.now(), restLen: len, restEnd: Date.now() + len * 1000, restEx: ex.exId, restBuzzed: false });
      }
    } else if (act === 'add-set') {
      const prev = ex.sets.at(-1);
      ex.sets.push({ ...(prev ?? { unit: 'kg', perSide: false }), reps: null, rpe: null, done: false, target: prev?.target ?? null });
    } else if (act === 'del-set') {
      ex.sets.pop();
    } else if (act === 'note') {
      ex.showNote = true;
    } else if (act === 'remove-ex') {
      if (ex.sets.some(s => s.done) && !confirm('Usunąć ćwiczenie razem z odhaczonymi seriami?')) return;
      draft.exercises.splice(Number(exEl.dataset.ex), 1);
    } else if (act === 'rest-set') {
      // Przerwa liczona od odhaczenia serii; wybór zapamiętujemy dla ćwiczenia.
      const sec = Number(btn.dataset.sec);
      Object.assign(draft, { restLen: sec, restEnd: (draft.restStart ?? Date.now()) + sec * 1000, restBuzzed: false });
      if (draft.restEx) (state.settings.restByEx ??= {})[draft.restEx] = sec;
    } else if (act === 'rest-plus') {
      draft.restEnd = Math.max(draft.restEnd, Date.now()) + 30000;
      draft.restBuzzed = false;
    } else if (act === 'rest-stop') {
      draft.restEnd = null;
    } else if (act === 'add-ex') {
      return addExerciseDialog(app);
    } else if (act === 'cancel') {
      if (!confirm('Anulować trening? Wpisane serie przepadną.')) return;
      state.draft = null;
    } else if (act === 'finish') {
      return finishDialog(app);
    }
    app.save();
    app.render();
  };

  root.oninput = e => {
    const f = e.target.dataset.f;
    if (!f || !state.draft) return;
    const draft = state.draft;
    if (f === 'date') { draft.date = e.target.value || today(); app.save(); return; }
    const ex = draft.exercises[Number(e.target.closest('[data-ex]').dataset.ex)];
    if (f === 'note') { ex.note = e.target.value; app.save(); return; }
    const set = ex.sets[Number(e.target.closest('[data-set]').dataset.set)];
    set[f] = parseNum(e.target.value);
    app.save();
  };
}

function addExerciseDialog(app) {
  const { state } = app;
  const draft = state.draft;
  const inDraft = new Set(draft.exercises.map(e => e.exId));
  const byGroup = {};
  for (const ex of Object.values(state.exercises)) if (!inDraft.has(ex.id)) (byGroup[ex.group] ??= []).push(ex);
  app.modal(`
    <h2>Dodaj ćwiczenie</h2>
    <label class="field">Z listy
      <select id="pick"><option value="">Wybierz…</option>
        ${GROUP_NAMES.filter(g => byGroup[g]).map(g => `<optgroup label="${g}">${byGroup[g].sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}
      </select>
    </label>
    <label class="field">Albo nowe <input id="newname" placeholder="Wiosłowanie sztangą w opadzie"></label>
    <label class="field">Plan serii <input id="scheme" placeholder="12/10/8" inputmode="text"></label>
    <label class="check-row"><input type="checkbox" id="toplan" checked> Dodaj też do planu ${TYPES[draft.type].label}</label>
    <p class="error" id="err" hidden>Wybierz ćwiczenie albo wpisz nazwę.</p>
    <div class="row-end"><button class="btn ghost" data-close>Anuluj</button><button class="btn primary" id="ok">Dodaj</button></div>
  `, dlg => {
    dlg.querySelector('#ok').onclick = () => {
      const picked = dlg.querySelector('#pick').value;
      const name = dlg.querySelector('#newname').value.trim();
      if (!picked && !name) { dlg.querySelector('#err').hidden = false; return; }
      let exId = picked;
      if (!exId) {
        exId = normalizeName(name);
        state.exercises[exId] ??= { id: exId, name: name.charAt(0).toLocaleUpperCase('pl') + name.slice(1), group: guessGroup(name) };
      }
      const scheme = dlg.querySelector('#scheme').value.trim();
      draft.exercises.push(draftExercise(state, exId, scheme, '2 min'));
      if (dlg.querySelector('#toplan').checked && !state.plan[draft.type].some(p => p.exId === exId)) {
        state.plan[draft.type].push({ exId, scheme, rest: '2 min' });
      }
      app.save();
      app.closeModal();
      app.render();
    };
  });
}

function finishDialog(app) {
  const { state } = app;
  const draft = state.draft;
  const done = draft.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const undone = draft.exercises.reduce((n, e) => n + e.sets.filter(s => !s.done && s.reps != null).length, 0);
  if (!done) { app.toast('Odhacz przynajmniej jedną serię'); return; }
  const noRpe = draft.exercises.reduce((n, e) => n + e.sets.filter(s => s.done && !s.rpe).length, 0);
  app.modal(`
    <h2>Zakończyć trening?</h2>
    <p>${done} ${plural(done, 'seria zapisana', 'serie zapisane', 'serii zapisanych')}.</p>
    ${undone ? `<p class="small muted">${undone} ${plural(undone, 'wpisana seria nie jest odhaczona', 'wpisane serie nie są odhaczone', 'wpisanych serii nie jest odhaczonych')} i nie trafi do historii.</p>` : ''}
    ${noRpe ? `<p class="small muted">${noRpe} ${plural(noRpe, 'seria nie ma', 'serie nie mają', 'serii nie ma')} RPE. Możesz je jeszcze uzupełnić.</p>` : ''}
    <div class="row-end"><button class="btn ghost" data-close>Wróć</button><button class="btn primary" id="save">Zapisz trening</button></div>
  `, dlg => { dlg.querySelector('#save').onclick = () => saveSession(app); });
}

function saveSession(app) {
  const { state } = app;
  const draft = state.draft;
  const before = computeGame(state);
  const session = {
    id: draft.id, date: draft.date, type: draft.type, source: 'app', createdAt: Date.now(),
    durationMin: Math.round((Date.now() - draft.startedAt) / 60000),
    note: '',
    exercises: draft.exercises
      .map(e => ({ exId: e.exId, scheme: e.scheme, note: e.note, sets: e.sets.filter(s => s.done).map(({ done, target, ...s }) => s) }))
      .filter(e => e.sets.length),
  };
  state.sessions.push(session);
  app.sortSessions();
  state.draft = null;
  app.saveNow();

  const after = computeGame(state);
  const prs = after.prs.filter(p => p.sessionId === session.id);
  const gained = after.xp - before.xp;
  app.modal(`
    <div class="levelup">
      <div class="xp-gain">+${gained} XP</div>
      <h2>Trening zapisany</h2>
      <p class="muted">${session.exercises.length} ${plural(session.exercises.length, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')} · ${num(sessionVolume(session) / 1000, 2)} t objętości · ${session.durationMin} min</p>
    </div>
    ${prs.length ? `<h3>Rekordy</h3><ul class="plain">${prs.map(p => `<li>${icon.trophy} ${esc(state.exercises[p.exId]?.name)}: ${num(p.value)} kg 1RM (było ${num(p.prev)})</li>`).join('')}</ul>` : ''}
    ${after.weekCount === 3 && before.weekCount === 2 ? `<p class="chip ok">${icon.flame} Tydzień 3/3 zaliczony, +150 XP</p>` : ''}
    <div class="row-end"><button class="btn primary" data-close id="ok">Gotowe</button></div>
  `, dlg => { dlg.addEventListener('close', () => app.go('#/dzis')); });
}
