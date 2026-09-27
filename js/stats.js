import { addDays, addMonths, today, weekStart, weekday, monthStart, fmtShort, fmtMonthShort, fmtDay, fmtMonth } from './util.js';
import { parseScheme } from './importer.js';

export const setVolume = s => (s.unit === 'kg' && s.reps && s.weight) ? s.reps * s.weight * (s.perSide ? 2 : 1) : 0;

/** Szacowany ciężar maksymalny (wzór Epleya). Tylko serie w kg, 1–20 powtórzeń. */
export const e1rm = s => (s.unit === 'kg' && s.weight && s.reps >= 1 && s.reps <= 20)
  ? s.weight * (1 + (s.reps === 1 ? 0 : s.reps / 30))
  : null;

export const sessionVolume = session => session.exercises.reduce((v, e) => v + e.sets.reduce((a, s) => a + setVolume(s), 0), 0);
export const sessionSets = session => session.exercises.reduce((n, e) => n + e.sets.length, 0);

export function bestSet(sets) {
  let best = null, bestV = -1;
  for (const s of sets) {
    const v = e1rm(s) ?? (s.weight ?? 0);
    if (v > bestV) { best = s; bestV = v; }
  }
  return best;
}

/** Czy seria spełnia plan (powtórzenia ≥ docelowe z zapisu 12/10/8). */
export function meetsPlan(scheme, set, idx) {
  const t = parseScheme(scheme);
  if (!t.length || set.reps == null || set.unit === 'sec') return null;
  return set.reps >= (t[idx] ?? t[t.length - 1]);
}

/**
 * Rekordy osobiste chronologicznie. PR = nowy najwyższy szacowany 1RM
 * (albo ciężar, gdy ćwiczenie jest liczone w oczkach). Pierwsze wystąpienie ćwiczenia nie jest rekordem.
 */
export function computePRs(sessions) {
  const best = {};
  const events = [];
  for (const session of sessions) {
    for (const ex of session.exercises) {
      let top = null, topSet = null;
      for (const s of ex.sets) {
        if (s.flag === 'shift' || s.flag === 'reps') continue;
        const v = e1rm(s) ?? (s.unit === 'stack' ? s.weight : null);
        if (v != null && (top == null || v > top)) { top = v; topSet = s; }
      }
      if (top == null) continue;
      const prev = best[ex.exId];
      // Rekord liczy się od +0,5 kg szacowanego 1RM, żeby nie nagradzać szumu zaokrągleń.
      if (prev != null && top >= prev + 0.5) {
        events.push({ date: session.date, sessionId: session.id, exId: ex.exId, value: top, prev, set: topSet });
      }
      if (prev == null || top > prev) best[ex.exId] = top;
    }
  }
  return { events, best };
}

export function exerciseHistory(sessions, exId) {
  const out = [];
  for (const session of sessions) {
    const ex = session.exercises.find(e => e.exId === exId);
    if (!ex || !ex.sets.length) continue;
    const top = bestSet(ex.sets);
    out.push({
      date: session.date, sessionId: session.id, sets: ex.sets, scheme: ex.scheme,
      e1rm: e1rm(top), top,
      maxWeight: Math.max(...ex.sets.map(s => s.weight ?? 0)),
      volume: ex.sets.reduce((a, s) => a + setVolume(s), 0),
    });
  }
  return out;
}

export function lastPerformance(sessions, exId, beforeDate = '9999') {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (s.date > beforeDate) continue;
    const ex = s.exercises.find(e => e.exId === exId);
    if (ex?.sets.length) return { date: s.date, sets: ex.sets, scheme: ex.scheme };
  }
  return null;
}

/** Dzień FBW dla tygodnia zaczynającego się w poniedziałek `monday`. */
export const fbwDayFor = (settings, monday) => settings.weekFbw?.[monday] ?? settings.fbwDay ?? 2;

export function plannedDates(settings, from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 5 || wd === 6 || wd === fbwDayFor(settings, weekStart(d))) out.push(d);
  }
  return out;
}

/** Zakres okresu: kind = week | month | half | year, offset 0 = bieżący, −1 = poprzedni… */
export function periodRange(kind, offset = 0, ref = today()) {
  if (kind === 'week') {
    const from = addDays(weekStart(ref), 7 * offset);
    return { from, to: addDays(from, 6), label: `${fmtDay(from)} – ${fmtDay(addDays(from, 6))}` };
  }
  if (kind === 'month') {
    const from = addMonths(monthStart(ref), offset);
    return { from, to: addDays(addMonths(from, 1), -1), label: fmtMonth(from) };
  }
  const months = kind === 'half' ? 6 : 12;
  const end = addMonths(monthStart(ref), 1 + offset * months);
  const from = addMonths(end, -months);
  const to = addDays(end, -1);
  return { from, to, label: `${fmtMonth(from)} – ${fmtMonth(to)}` };
}

export function summarize(state, from, to) {
  const sessions = state.sessions.filter(s => s.date >= from && s.date <= to);
  const end = to < today() ? to : today();
  // Plan liczymy dopiero od tygodnia pierwszego zapisanego treningu.
  const first = state.sessions[0] ? weekStart(state.sessions[0].date) : today();
  const start = from > first ? from : first;
  const planned = start <= end ? plannedDates(state.settings, start, end).length : 0;
  let volume = 0, rpeSum = 0, rpeN = 0, planOk = 0, planN = 0, sets = 0;
  const groups = {};
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const group = state.exercises[ex.exId]?.group ?? 'inne';
      ex.sets.forEach((set, i) => {
        const v = setVolume(set);
        volume += v;
        groups[group] = (groups[group] ?? 0) + v;
        sets++;
        if (set.rpe) { rpeSum += set.rpe; rpeN++; }
        const ok = meetsPlan(ex.scheme, set, i);
        if (ok != null) { planN++; if (ok) planOk++; }
      });
    }
  }
  const prs = computePRs(state.sessions).events.filter(e => e.date >= from && e.date <= to);
  return {
    sessions, count: sessions.length, planned, volume, sets,
    rpe: rpeN ? rpeSum / rpeN : null,
    completion: planned ? Math.min(1, sessions.length / planned) : null,
    planRate: planN ? planOk / planN : null,
    groups, prs,
  };
}

/** Słupki objętości: tydzień → treningi, miesiąc → tygodnie, pół roku / rok → miesiące. */
export function volumeBars(state, kind, from, to) {
  const inRange = state.sessions.filter(s => s.date >= from && s.date <= to);
  if (kind === 'week') {
    return inRange.map(s => ({ label: fmtShort(s.date), value: sessionVolume(s), type: s.type }));
  }
  const buckets = [];
  if (kind === 'month') {
    for (let d = weekStart(from); d <= to; d = addDays(d, 7)) buckets.push({ from: d, to: addDays(d, 6), label: fmtShort(d < from ? from : d) });
  } else {
    for (let d = from; d <= to; d = addMonths(d, 1)) buckets.push({ from: d, to: addDays(addMonths(d, 1), -1), label: fmtMonthShort(d) });
  }
  return buckets.map(b => ({
    label: b.label,
    value: inRange.filter(s => s.date >= b.from && s.date <= b.to).reduce((v, s) => v + sessionVolume(s), 0),
  }));
}

export function sessionsByDate(sessions) {
  const map = {};
  for (const s of sessions) (map[s.date] ??= []).push(s);
  return map;
}

