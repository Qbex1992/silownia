import { esc, num, fmtDate, TYPES, today } from '../util.js';
import { sessionVolume, computePRs } from '../stats.js';
import { icon } from '../icons.js';

const FLAG = { shift: 'kolumny mogą być przesunięte', reps: 'podejrzana liczba powtórzeń' };

export function render(app) {
  const { state } = app;
  const s = state.sessions.find(x => x.id === app.params[0]);
  if (!s) return '<p>Nie ma takiego treningu.</p><a href="#/kalendarz">Wróć do kalendarza</a>';
  const prs = computePRs(state.sessions).events.filter(p => p.sessionId === s.id).map(p => p.exId);
  const unitHead = ex => ex.sets[0]?.unit === 'stack' ? 'ocz.' : ex.sets[0]?.unit === 'sec' ? 'kg' : 'kg';
  return `
    <header class="top">
      <div><a class="muted small back" href="#/kalendarz/${s.date.slice(0, 7)}">${icon.chevronL} Kalendarz</a>
      <h1>${TYPES[s.type].label} <span class="muted h-sub">${s.label ? esc(s.label) : ''}</span></h1></div>
    </header>
    <div class="card">
      <label class="field inline">Data <input type="date" id="s-date" value="${s.date}" max="${today()}"></label>
      <label class="field inline">Rodzaj
        <select id="s-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === s.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      </label>
      <p class="small muted">${fmtDate(s.date)} · ${num(sessionVolume(s) / 1000, 2)} t objętości${s.durationMin ? ` · ${s.durationMin} min` : ''}${s.source === 'import' ? ' · z Excela' : ''}</p>
      ${s.note ? `<p class="small">${icon.note} ${esc(s.note)}</p>` : ''}
    </div>
    ${s.exercises.map((ex, i) => `
      <article class="card ex" data-ex="${i}">
        <div class="ex-head"><h3><a href="#/cwiczenie/${encodeURIComponent(ex.exId)}">${esc(state.exercises[ex.exId]?.name ?? ex.exId)}</a></h3>
          ${prs.includes(ex.exId) ? `<span class="chip pr">${icon.trophy} Rekord</span>` : ''}</div>
        ${ex.scheme ? `<p class="small muted">Plan ${esc(ex.scheme)}</p>` : ''}
        <div class="sets">
          <div class="set head edit"><span></span><span>${unitHead(ex)}</span><span>powt.</span><span>RPE</span></div>
          ${ex.sets.map((st, j) => `
            <div class="set edit ${st.flag ? 'flagged' : ''}" data-set="${j}">
              <span class="n">${j + 1}</span>
              <input inputmode="decimal" data-f="weight" value="${st.weight ?? ''}" aria-label="Ciężar serii ${j + 1}">
              <input inputmode="decimal" data-f="reps" value="${st.reps ?? ''}" aria-label="Powtórzenia serii ${j + 1}">
              <input inputmode="decimal" data-f="rpe" value="${st.rpe ?? ''}" placeholder="–" aria-label="RPE serii ${j + 1}">
            </div>
            ${st.note || st.flag ? `<p class="set-note small ${st.flag ? 'warn' : 'muted'}">${[st.note, st.flag ? FLAG[st.flag] : ''].filter(Boolean).map(esc).join(' · ')}${st.flag ? ` <button class="link-btn" data-clear="${j}">OK, jest dobrze</button>` : ''}</p>` : ''}
          `).join('')}
        </div>
        ${ex.note ? `<p class="small muted">${icon.note} ${esc(ex.note)}</p>` : ''}
      </article>`).join('')}
    <button class="btn danger wide" id="del">${icon.trash} Usuń trening</button>`;
}

export function mount(root, app) {
  const { state } = app;
  const s = state.sessions.find(x => x.id === app.params[0]);
  if (!s) return;
  root.onchange = e => {
    const t = e.target;
    if (t.id === 's-date' && t.value) { s.date = t.value; app.sortSessions(); }
    else if (t.id === 's-type') s.type = t.value;
    else if (t.dataset.f) {
      const ex = s.exercises[Number(t.closest('[data-ex]').dataset.ex)];
      const set = ex.sets[Number(t.closest('[data-set]').dataset.set)];
      const v = Number(t.value.replace(',', '.'));
      set[t.dataset.f] = t.value.trim() === '' || Number.isNaN(v) ? null : v;
      delete set.flag;
    } else return;
    app.save();
    app.render();
  };
  root.onclick = e => {
    const clear = e.target.closest('[data-clear]');
    if (clear) {
      const ex = s.exercises[Number(clear.closest('[data-ex]').dataset.ex)];
      delete ex.sets[Number(clear.dataset.clear)].flag;
      app.save(); app.render();
      return;
    }
    if (e.target.closest('#del') && confirm('Usunąć ten trening na stałe?')) {
      state.sessions.splice(state.sessions.indexOf(s), 1);
      app.save();
      app.go(`#/kalendarz/${s.date.slice(0, 7)}`);
    }
  };
}
