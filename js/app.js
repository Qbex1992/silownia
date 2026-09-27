import { load, store, save, saveNow, sortSessions } from './state.js';
import { computeGame, THEMES } from './game.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import * as todayView from './views/today.js';
import * as workoutView from './views/workout.js';
import * as calendarView from './views/calendar.js';
import * as statsView from './views/stats.js';
import * as bodyView from './views/body.js';
import * as profileView from './views/profile.js';
import * as sessionView from './views/session.js';
import * as exerciseView from './views/exercise.js';

const routes = {
  dzis: todayView, trening: workoutView, kalendarz: calendarView, statystyki: statsView,
  cialo: bodyView, profil: profileView, sesja: sessionView, cwiczenie: exerciseView,
};
const NAV = [
  ['dzis', 'Dziś', icon.home], ['trening', 'Trening', icon.dumbbell], ['kalendarz', 'Kalendarz', icon.calendar],
  ['statystyki', 'Statystyki', icon.chart], ['cialo', 'Ciało', icon.body],
];
const NAV_PARENT = { profil: 'dzis', sesja: 'kalendarz', cwiczenie: 'statystyki' };

export const app = {
  get state() { return store.state; },
  game: null,
  params: [],
  route: 'dzis',
  save,
  saveNow,
  sortSessions,
  go: hash => { location.hash = hash; },
  render,
  modal,
  closeModal,
  toast,
};

function parseHash() {
  const [name = 'dzis', ...params] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: routes[name] ? name : 'dzis', params };
}

function applyTheme() {
  const t = THEMES.find(x => x.id === store.state.settings.theme && x.level <= app.game.level) ?? THEMES[0];
  document.documentElement.style.setProperty('--accent', t.accent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0e0e10');
}

function render(keepScroll = true) {
  const { name, params } = parseHash();
  app.params = params;
  app.route = name;
  app.game = computeGame(store.state);
  applyTheme();
  const y = window.scrollY;
  const root = document.getElementById('view');
  root.innerHTML = routes[name].render(app);
  routes[name].mount?.(root, app);
  const active = NAV_PARENT[name] ?? name;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.route === active));
  window.scrollTo(0, keepScroll ? y : 0);
  checkMilestones();
}

function checkMilestones() {
  const s = store.state.settings;
  const g = app.game;
  const done = g.badges.filter(b => b.done).map(b => b.id);
  if (s.seenLevel == null) { s.seenLevel = g.level; s.seenBadges = done; save(); return; }
  const newBadges = g.badges.filter(b => b.done && !(s.seenBadges ?? []).includes(b.id));
  if (g.level <= s.seenLevel && !newBadges.length) return;
  if (document.querySelector('dialog[open]')) return;

  const from = s.seenLevel;
  const rewards = store.state.rewards.filter(r => r.level > from && r.level <= g.level && !r.claimedAt);
  const themes = THEMES.filter(t => t.level > from && t.level <= g.level);
  s.seenLevel = Math.max(from, g.level);
  s.seenBadges = done;
  save();

  modal(`
    ${g.level > from ? `
      <div class="levelup">
        <div class="lvl-big">${g.level}</div>
        <h2>Poziom ${g.level}</h2>
        <p class="muted">${esc(g.title)}${g.level - from > 1 ? ` · awans o ${g.level - from} poziomów` : ''}</p>
      </div>` : ''}
    ${rewards.map(r => `<div class="card reward-card">${icon.gift}<div><b>Nagroda za poziom ${r.level}</b><p>${esc(r.text)}</p></div></div>`).join('')}
    ${themes.filter(t => t.level > 1).map(t => `<p class="small">Odblokowany motyw kolorów: <b style="color:${t.accent}">${t.name}</b></p>`).join('')}
    ${newBadges.length ? `<h3>Nowe odznaki</h3><div class="badge-list">${newBadges.map(b => `<span class="chip">${icon.trophy}${esc(b.name)}</span>`).join('')}</div>` : ''}
    <div class="row-end"><button class="btn primary" data-close>Dalej</button></div>
  `);
}

let dialog;
function modal(html, mount) {
  closeModal();
  const d = document.createElement('dialog');
  dialog = d;
  d.className = 'sheet';
  d.innerHTML = `<div class="sheet-body">${html}</div>`;
  document.body.append(d);
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-close]')) closeModal();
  });
  // Zdarzenie 'close' przychodzi asynchronicznie — sprzątamy tylko własne okno, nie następne.
  d.addEventListener('close', () => {
    d.remove();
    if (dialog === d) dialog = null;
  });
  d.showModal();
  mount?.(d);
  return d;
}

function closeModal() {
  const d = dialog;
  dialog = null;
  if (d?.open) d.close();
  else d?.remove();
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

async function start() {
  await load();
  document.getElementById('nav').innerHTML = NAV.map(([r, label, ic]) =>
    `<a href="#/${r}" data-route="${r}">${ic}<span>${label}</span></a>`).join('');
  window.addEventListener('hashchange', () => { closeModal(); render(false); });
  render(false);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
