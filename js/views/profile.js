import { esc, num, plural, today, addDays, weekday, fmtShort, fmtDate, uid, DAY_NAMES, TYPES } from '../util.js';
import { THEMES, XP, levelCost } from '../game.js';
import { readWorkbook } from '../xlsx.js';
import { importWorkbook } from '../importer.js';
import { photoGet, photoSet, photoClear } from '../db.js';
import { emptyState } from '../state.js';
import { icon } from '../icons.js';

const lastSunday = () => { const d = today(); return addDays(d, -((weekday(d) + 1) % 7)); };

function importSection(state) {
  const r = state.lastImport;
  const fixes = r?.report.filter(x => x.kind === 'fix') ?? [];
  const warns = r?.report.filter(x => x.kind === 'warn') ?? [];
  return `
    <section class="card" id="import">
      <h3>Import z Excela</h3>
      <p class="small muted">Arkusz z zakładkami tygodni (PUSH / PULL / FBW). W pliku nie ma dat, więc podaj niedzielę ostatniego tygodnia. Wcześniejsze tygodnie cofnę co 7 dni: sobota Push, niedziela Pull, środa FBW.</p>
      <label class="field inline">Ostatni trening (niedziela) <input type="date" id="imp-date" value="${lastSunday()}"></label>
      <label class="btn primary file-btn">${icon.upload} Wybierz plik .xlsx<input type="file" id="imp-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
      ${r ? `
        <div class="import-report">
          <p class="small">Ostatni import: ${r.weeks} ${plural(r.weeks, 'tydzień', 'tygodnie', 'tygodni')}, ${r.sessions} treningów, ${r.sets} serii (${fmtShort(r.from)} – ${fmtShort(r.to)}).</p>
          ${warns.length ? `<h4>Do sprawdzenia (${warns.length})</h4><ul class="plain small">${warns.map(w => `<li><a href="#/sesja/${encodeURIComponent(w.sessionId)}">${esc(w.week)}, ${TYPES[w.type].label}: ${esc(w.exercise)}</a> — ${esc(w.text)}</li>`).join('')}</ul>` : ''}
          ${fixes.length ? `<details><summary class="small">Poprawione automatycznie (${fixes.length})</summary><ul class="plain small">${fixes.map(w => `<li>${esc(w.week)}, ${esc(w.exercise)}: ${esc(w.text)}</li>`).join('')}</ul></details>` : ''}
          ${r.duplicates ? `<p class="small muted">${r.duplicates} ${plural(r.duplicates, 'ćwiczenie ma', 'ćwiczenia mają', 'ćwiczeń ma')} serie identyczne jak tydzień wcześniej. Mogą to być wiersze skopiowane bez zmian. Są zapisane normalnie i oznaczone w szczegółach treningu.</p>` : ''}
        </div>` : ''}
    </section>`;
}

function planSection(state) {
  return `
    <section class="card">
      <h3>Plan treningowy</h3>
      <p class="small muted">Kolejność i serie, które podpowiadam na treningu. Ćwiczenia dodasz też w trakcie treningu.</p>
      ${Object.entries(TYPES).map(([t, v]) => `
        <h4>${v.label}</h4>
        <ol class="plan-list">
          ${state.plan[t].map((p, i) => `
            <li data-type="${t}" data-i="${i}">
              <span>${esc(state.exercises[p.exId]?.name ?? p.exId)}</span>
              <input value="${esc(p.scheme)}" data-plan-scheme aria-label="Serie i powtórzenia" placeholder="12/10/8">
              <button class="icon-btn sm" data-plan="up" aria-label="W górę" ${i ? '' : 'disabled'}>${icon.chevronL}</button>
              <button class="icon-btn sm" data-plan="del" aria-label="Usuń z planu">${icon.x}</button>
            </li>`).join('') || '<li class="muted small">Pusto</li>'}
        </ol>`).join('')}
    </section>`;
}

export function render(app) {
  const { state, game } = app;
  const rewards = [...state.rewards].sort((a, b) => a.level - b.level);
  const nextThemes = THEMES.filter(t => t.level > game.level);

  return `
    <header class="top"><div><a class="muted small back" href="#/dzis">${icon.chevronL} Dziś</a><h1>Profil</h1></div></header>

    <section class="card profile-head">
      <span class="ring big" style="--p:${game.into / game.need}"><b>${game.level}</b></span>
      <div>
        <h2>${esc(game.title)}</h2>
        <p class="small muted">${num(game.xp, 0)} XP · do poziomu ${game.level + 1}: ${num(game.need - game.into, 0)} XP</p>
        <p class="small">${icon.flame} Seria ${game.streak} ${plural(game.streak, 'tydzień', 'tygodnie', 'tygodni')} · rekord ${game.bestStreak}</p>
      </div>
    </section>

    <details class="card">
      <summary><h3 class="inline">Jak zdobywam XP</h3></summary>
      <ul class="plain small">
        <li>Trening: ${XP.session} XP</li>
        <li>Seria zrobiona zgodnie z planem albo lepiej: +${XP.planSet} XP</li>
        <li>Rekord osobisty (wyższy szacowany 1RM): +${XP.pr} XP</li>
        <li>Pełny tydzień 3/3: +${XP.fullWeek} XP</li>
        <li>Pomiary, waga lub zdjęcie danego dnia: +${XP.body} XP</li>
      </ul>
      <p class="small muted">Każdy poziom kosztuje więcej. Poziom ${game.level} → ${game.level + 1}: ${num(levelCost(game.level), 0)} XP. Poziom ${game.level + 5} → ${game.level + 6}: ${num(levelCost(game.level + 5), 0)} XP.</p>
    </details>

    <section class="card">
      <h3>Nagrody</h3>
      <p class="small muted">Wpisz, czym się nagrodzisz za dany poziom. Przypomnę przy awansie.</p>
      <ul class="rewards">
        ${rewards.map(r => `
          <li class="${r.claimedAt ? 'claimed' : r.level <= game.level ? 'ready' : ''}">
            <span class="lvl">${r.level}</span>
            <span>${esc(r.text)}${r.claimedAt ? `<small class="muted"> · odebrana ${fmtShort(r.claimedAt)}</small>` : ''}</span>
            ${!r.claimedAt && r.level <= game.level ? `<button class="btn sm primary" data-claim="${r.id}">Odebrałem</button>` : ''}
            <button class="icon-btn sm" data-del-reward="${r.id}" aria-label="Usuń nagrodę">${icon.x}</button>
          </li>`).join('')}
      </ul>
      <form class="inline-form" id="f-reward">
        <input name="level" inputmode="numeric" placeholder="Poziom" value="${game.level + 1}" aria-label="Poziom" required>
        <input name="text" placeholder="Nowe rękawiczki" aria-label="Nagroda" required>
        <button class="btn">Dodaj</button>
      </form>
    </section>

    <section class="card">
      <h3>Odznaki <span class="muted small">${game.badges.filter(b => b.done).length}/${game.badges.length}</span></h3>
      <div class="badges">
        ${game.badges.map(b => `
          <div class="badge ${b.done ? 'done' : ''}">
            ${b.done ? icon.trophy : icon.lock}
            <b>${esc(b.name)}</b>
            <small>${esc(b.desc)}</small>
            ${!b.done && b.progress != null ? `<div class="bar thin"><i style="width:${(b.progress * 100).toFixed(0)}%"></i></div>` : ''}
          </div>`).join('')}
      </div>
    </section>

    <section class="card">
      <h3>Motyw kolorów</h3>
      <div class="themes">
        ${THEMES.map(t => `<button class="theme ${state.settings.theme === t.id ? 'on' : ''}" data-theme="${t.id}" ${t.level > game.level ? 'disabled' : ''} style="--c:${t.accent}">
          <i></i>${t.name}${t.level > game.level ? `<small>poziom ${t.level}</small>` : ''}</button>`).join('')}
      </div>
      ${nextThemes.length ? `<p class="small muted">Następny motyw na poziomie ${nextThemes[0].level}.</p>` : ''}
    </section>

    ${planSection(state)}

    <section class="card">
      <h3>Ustawienia</h3>
      <label class="field inline">Domyślny dzień FBW
        <select id="fbw-day">${DAY_NAMES.slice(0, 5).map((n, i) => `<option value="${i}" ${state.settings.fbwDay === i ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
    </section>

    ${importSection(state)}

    <section class="card">
      <h3>Kopia zapasowa</h3>
      <p class="small muted">Dane są tylko w tym telefonie. Rób kopię co jakiś czas i trzymaj ją np. na Dysku Google.</p>
      <label class="check-row"><input type="checkbox" id="with-photos"> Ze zdjęciami (większy plik)</label>
      <div class="btn-row">
        <button class="btn" id="export-json">${icon.download} Zapisz kopię</button>
        <label class="btn file-btn">${icon.upload} Wczytaj kopię<input type="file" id="import-json" accept=".json,application/json" hidden></label>
        <button class="btn" id="export-csv">${icon.download} Eksport do Excela (CSV)</button>
      </div>
      <button class="link-btn danger" id="wipe">Usuń wszystkie dane</button>
    </section>`;
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const blobToDataUrl = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });

function toCsv(state) {
  const n = v => v == null ? '' : String(v).replace('.', ',');
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['data', 'trening', 'ćwiczenie', 'partia', 'seria', 'powtórzenia', 'ciężar', 'jednostka', 'na stronę', 'RPE', 'notatka']];
  for (const s of state.sessions) for (const ex of s.exercises) ex.sets.forEach((st, i) => rows.push([
    s.date, TYPES[s.type].label, q(state.exercises[ex.exId]?.name ?? ex.exId), state.exercises[ex.exId]?.group ?? '',
    i + 1, n(st.reps), n(st.weight), st.unit === 'stack' ? 'oczko' : st.unit === 'sec' ? 's' : 'kg', st.perSide ? 'tak' : '', n(st.rpe), q(st.note),
  ]));
  return '﻿' + rows.map(r => r.join(';')).join('\r\n');
}

async function runImport(app, file, sunday) {
  const { state } = app;
  let result;
  try {
    result = importWorkbook(await readWorkbook(await file.arrayBuffer()), sunday);
  } catch (err) {
    app.toast(`Nie udało się odczytać pliku: ${err.message}`);
    return;
  }
  if (!result.sessions.length) { app.toast('Nie znalazłem w pliku sekcji PUSH / PULL / FBW'); return; }
  const warns = result.report.filter(r => r.kind === 'warn').length;
  const hadImport = state.sessions.some(s => s.source === 'import');
  app.modal(`
    <h2>Import</h2>
    <p>${result.weeks} ${plural(result.weeks, 'tydzień', 'tygodnie', 'tygodni')} · ${result.sessions.length} treningów · ${result.sets} serii</p>
    <p class="small muted">Od ${fmtDate(result.from)} do ${fmtDate(result.to)}. ${Object.keys(result.exercises).length} różnych ćwiczeń.</p>
    ${warns ? `<p class="small">${warns} ${plural(warns, 'wpis', 'wpisy', 'wpisów')} do sprawdzenia, lista pojawi się w profilu.</p>` : ''}
    ${hadImport ? '<p class="small muted">Poprzednio zaimportowane treningi zastąpię nowymi. Treningi zapisane w aplikacji zostają.</p>' : ''}
    <label class="check-row"><input type="checkbox" id="take-plan" ${Object.values(state.plan).every(p => !p.length) ? 'checked' : ''}> Ustaw plan z ostatniego tygodnia</label>
    <div class="row-end"><button class="btn ghost" data-close>Anuluj</button><button class="btn primary" id="go">Importuj</button></div>
  `, dlg => {
    dlg.querySelector('#go').onclick = () => {
      state.sessions = state.sessions.filter(s => s.source !== 'import').concat(result.sessions);
      app.sortSessions();
      for (const [id, ex] of Object.entries(result.exercises)) state.exercises[id] ??= ex;
      if (dlg.querySelector('#take-plan').checked) state.plan = result.plan;
      state.settings.trackFrom = addDays(result.to, 1);
      state.settings.seenLevel = 1;
      state.settings.seenBadges = [];
      state.lastImport = {
        at: today(), weeks: result.weeks, sessions: result.sessions.length, sets: result.sets,
        from: result.from, to: result.to, report: result.report, duplicates: result.duplicates,
      };
      app.saveNow();
      app.closeModal();
      app.go('#/dzis');
    };
  });
}

export function mount(root, app) {
  const { state } = app;
  if (app.params[0] === 'import') setTimeout(() => root.querySelector('#import')?.scrollIntoView({ behavior: 'smooth' }), 50);

  root.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const level = parseInt(f.get('level'), 10);
    const text = String(f.get('text')).trim();
    if (!level || level < 2 || !text) { app.toast('Podaj poziom (od 2) i nagrodę'); return; }
    state.rewards.push({ id: uid(), level, text, claimedAt: null });
    app.save(); app.render();
  };

  root.onchange = async e => {
    const t = e.target;
    if (t.id === 'fbw-day') { state.settings.fbwDay = Number(t.value); app.save(); }
    else if (t.id === 'imp-file' && t.files[0]) runImport(app, t.files[0], root.querySelector('#imp-date').value || lastSunday());
    else if (t.id === 'import-json' && t.files[0]) {
      try {
        const data = JSON.parse(await t.files[0].text());
        if (data.app !== 'silownia' || !data.state) throw new Error('to nie jest kopia tej aplikacji');
        if (!confirm('Wczytać kopię? Obecne dane zostaną zastąpione.')) return;
        if (data.photos) { await photoClear(); for (const p of data.photos) await photoSet(p.id, await (await fetch(p.dataUrl)).blob()); }
        Object.assign(state, emptyState(), data.state, { draft: null });
        app.saveNow();
        app.toast('Kopia wczytana');
        app.go('#/dzis');
      } catch (err) { app.toast(`Nie udało się wczytać kopii: ${err.message}`); }
    } else if (t.dataset.planScheme !== undefined) {
      const li = t.closest('li');
      state.plan[li.dataset.type][Number(li.dataset.i)].scheme = t.value.trim();
      app.save();
    }
  };

  root.onclick = async e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.claim) {
      state.rewards.find(r => r.id === t.dataset.claim).claimedAt = today();
      app.toast('Zasłużona');
    } else if (t.dataset.delReward) {
      state.rewards = state.rewards.filter(r => r.id !== t.dataset.delReward);
    } else if (t.dataset.theme) {
      state.settings.theme = t.dataset.theme;
    } else if (t.dataset.plan) {
      const li = t.closest('li');
      const list = state.plan[li.dataset.type];
      const i = Number(li.dataset.i);
      if (t.dataset.plan === 'del') list.splice(i, 1);
      else if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    } else if (t.id === 'export-json') {
      const withPhotos = root.querySelector('#with-photos').checked;
      const { draft, ...rest } = state;
      const photos = withPhotos
        ? await Promise.all(state.photos.map(async p => ({ id: p.id, dataUrl: await blobToDataUrl(await photoGet(p.id)) })))
        : undefined;
      download(`silownia-kopia-${today()}.json`, JSON.stringify({ app: 'silownia', version: 1, exportedAt: new Date().toISOString(), state: rest, photos }), 'application/json');
      return;
    } else if (t.id === 'export-csv') {
      download(`silownia-treningi-${today()}.csv`, toCsv(state), 'text/csv;charset=utf-8');
      return;
    } else if (t.id === 'wipe') {
      if (!confirm('Usunąć wszystkie treningi, pomiary i zdjęcia? Tego nie da się cofnąć.')) return;
      await photoClear();
      Object.assign(state, emptyState());
      app.saveNow();
      app.go('#/dzis');
      return;
    } else return;
    app.save();
    app.render();
  };
}
