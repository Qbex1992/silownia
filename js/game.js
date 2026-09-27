// Grywalizacja: XP liczone zawsze od nowa z danych, więc edycja historii nie rozjedzie poziomu.
import { weekStart, addDays, today } from './util.js';
import { computePRs, meetsPlan, sessionVolume } from './stats.js';

export const XP = { session: 100, planSet: 5, pr: 50, fullWeek: 150, body: 20 };
export const WEEK_GOAL = 3;

/** Koszt przejścia z poziomu n na n+1 — rośnie z każdym poziomem. */
export const levelCost = n => Math.round(300 * Math.pow(n, 1.3) / 10) * 10;

const TITLES = [
  [1, 'Nowicjusz'], [3, 'Początkujący'], [6, 'Regularny'], [10, 'Wytrwały'],
  [14, 'Żelazny'], [18, 'Stalowy'], [22, 'Tytan'], [27, 'Legenda'],
];
export const titleFor = level => TITLES.filter(([l]) => level >= l).at(-1)[1];

export const THEMES = [
  { id: 'ember', name: 'Żar', level: 1, accent: '#ff6b2c' },
  { id: 'ice', name: 'Lód', level: 5, accent: '#38bdf8' },
  { id: 'forest', name: 'Las', level: 10, accent: '#34d399' },
  { id: 'violet', name: 'Fiolet', level: 15, accent: '#a78bfa' },
  { id: 'gold', name: 'Złoto', level: 20, accent: '#fbbf24' },
  { id: 'blood', name: 'Krew', level: 25, accent: '#f43f5e' },
];

export function levelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= levelCost(level)) { rest -= levelCost(level); level++; }
  return { level, into: rest, need: levelCost(level) };
}

export function weekCounts(sessions) {
  const counts = {};
  for (const s of sessions) counts[weekStart(s.date)] = (counts[weekStart(s.date)] ?? 0) + 1;
  return counts;
}

/** Seria pełnych tygodni (≥3 treningi). Bieżący tydzień liczy się, gdy już ma 3/3. */
export function streaks(sessions) {
  const counts = weekCounts(sessions);
  let current = 0;
  let w = weekStart(today());
  if ((counts[w] ?? 0) < WEEK_GOAL) w = addDays(w, -7);
  while ((counts[w] ?? 0) >= WEEK_GOAL) { current++; w = addDays(w, -7); }

  let best = 0, run = 0;
  const weeks = Object.keys(counts).sort();
  if (weeks.length) {
    for (let d = weeks[0]; d <= weekStart(today()); d = addDays(d, 7)) {
      run = (counts[d] ?? 0) >= WEEK_GOAL ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return { current, best, counts };
}

export function computeGame(state) {
  const sessions = state.sessions;
  const ledger = [];
  const { events: prs } = computePRs(sessions);
  const prBySession = {};
  for (const p of prs) prBySession[p.sessionId] = (prBySession[p.sessionId] ?? 0) + 1;

  const weekSeen = {};
  for (const s of sessions) {
    let planSets = 0;
    for (const ex of s.exercises) ex.sets.forEach((set, i) => { if (meetsPlan(ex.scheme, set, i)) planSets++; });
    const xp = XP.session + planSets * XP.planSet + (prBySession[s.id] ?? 0) * XP.pr;
    ledger.push({ date: s.date, xp, sessionId: s.id, reason: 'trening', planSets, prs: prBySession[s.id] ?? 0 });
    const w = weekStart(s.date);
    weekSeen[w] = (weekSeen[w] ?? 0) + 1;
    if (weekSeen[w] === WEEK_GOAL) ledger.push({ date: s.date, xp: XP.fullWeek, reason: 'pełny tydzień' });
  }

  const bodyDays = new Set([
    ...state.body.weights.map(w => w.date),
    ...state.body.measurements.map(m => m.date),
    ...state.photos.map(p => p.date),
  ]);
  for (const d of bodyDays) ledger.push({ date: d, xp: XP.body, reason: 'pomiary' });

  const xp = ledger.reduce((a, e) => a + e.xp, 0);
  const lvl = levelFromXp(xp);
  const st = streaks(sessions);
  const ctx = {
    sessions: sessions.length, prs: prs.length, level: lvl.level, bestStreak: st.best,
    volume: sessions.reduce((v, s) => v + sessionVolume(s), 0),
    weights: state.body.weights.length, measurements: state.body.measurements.length, photos: state.photos.length,
    doubled: doubledExercise(sessions),
  };
  return {
    xp, ...lvl, title: titleFor(lvl.level), ledger, prs, streak: st.current, bestStreak: st.best,
    weekCount: st.counts[weekStart(today())] ?? 0,
    badges: BADGES.map(b => ({ ...b, done: b.test(ctx), progress: b.progress?.(ctx) })),
  };
}

function doubledExercise(sessions) {
  const first = {}, max = {};
  for (const s of sessions) for (const ex of s.exercises) for (const set of ex.sets) {
    if (set.unit !== 'kg' || !set.weight || set.flag) continue;
    first[ex.exId] ??= set.weight;
    max[ex.exId] = Math.max(max[ex.exId] ?? 0, set.weight);
  }
  return Object.keys(first).some(id => first[id] >= 5 && max[id] >= first[id] * 2);
}

const count = (key, n) => ({ test: c => c[key] >= n, progress: c => Math.min(1, c[key] / n) });

export const BADGES = [
  { id: 's1', name: 'Pierwszy krok', desc: 'Pierwszy zapisany trening', ...count('sessions', 1) },
  { id: 's25', name: 'Rozgrzany', desc: '25 treningów', ...count('sessions', 25) },
  { id: 's100', name: 'Setka', desc: '100 treningów', ...count('sessions', 100) },
  { id: 's250', name: 'Ćwierć tysiąca', desc: '250 treningów', ...count('sessions', 250) },
  { id: 'w4', name: 'Miesiąc bez wymówek', desc: '4 pełne tygodnie z rzędu', ...count('bestStreak', 4) },
  { id: 'w12', name: 'Kwartał dyscypliny', desc: '12 pełnych tygodni z rzędu', ...count('bestStreak', 12) },
  { id: 'w26', name: 'Pół roku', desc: '26 pełnych tygodni z rzędu', ...count('bestStreak', 26) },
  { id: 'w52', name: 'Rok bez przerwy', desc: '52 pełne tygodnie z rzędu', ...count('bestStreak', 52) },
  { id: 'p10', name: 'Łamacz rekordów', desc: '10 rekordów osobistych', ...count('prs', 10) },
  { id: 'p100', name: 'Seryjny rekordzista', desc: '100 rekordów osobistych', ...count('prs', 100) },
  { id: 'v100', name: '100 ton', desc: 'Łącznie 100 000 kg podniesione', ...count('volume', 100000) },
  { id: 'v1000', name: 'Tysiąc ton', desc: 'Łącznie 1 000 000 kg podniesione', ...count('volume', 1000000) },
  { id: 'x2', name: 'Dwa razy mocniej', desc: 'Podwojony ciężar w dowolnym ćwiczeniu', test: c => c.doubled },
  { id: 'b1', name: 'Na wadze', desc: 'Pierwszy pomiar wagi', ...count('weights', 1) },
  { id: 'm4', name: 'Centymetr po centymetrze', desc: '4 pomiary obwodów', ...count('measurements', 4) },
  { id: 'f5', name: 'Kronika', desc: '5 zdjęć sylwetki', ...count('photos', 5) },
  { id: 'l10', name: 'Poziom 10', desc: 'Osiągnij poziom 10', ...count('level', 10) },
  { id: 'l20', name: 'Poziom 20', desc: 'Osiągnij poziom 20', ...count('level', 20) },
];

/** XP i rekordy zdobyte w jednym treningu — do podsumowania po zakończeniu. */
export function sessionReward(game, sessionId) {
  return game.ledger.filter(e => e.sessionId === sessionId);
}
