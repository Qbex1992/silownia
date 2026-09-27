// Import historii z arkusza „PUSH PULL FBW”: jedna zakładka = jeden tydzień, sekcje PUSH / PULL / FBW.
import { addDays, sentence } from './util.js';

const SECTION = { PUSH: 'push', PULL: 'pull', FBW: 'fbw' };
const PAIRS = [['G', 'H'], ['I', 'J'], ['K', 'L'], ['M', 'N'], ['O', 'P']];
/** Dzień tygodnia względem niedzieli danej zakładki: sobota −1, niedziela 0, środa −4. */
const OFFSET = { push: -1, pull: 0, fbw: -4 };

const GROUPS = [
  ['łydki', /WSPIĘCI/],
  ['dolny grzbiet', /WYPROST\S* TUŁOWIA/],
  ['triceps', /FRANCUSK|WYPROSTY RAMIEN|TRICEPS|PUSHDOWN/],
  ['barki', /OHP|WZNOSY|WYCISKANIE (SZTANGI|HANTLI|NA MASZYNIE) SIEDZĄC|SHOULDER/],
  ['nogi', /PRZYSIAD|HACK|SUWNIC|WYPYCHANIE|WYPROSTY SIEDZĄC|LEG|RDL|PODUDZI|MARTW/],
  ['biceps', /UGINANIE (SZTANGI|HANTLI|NA MODLITEWNIKU)|MODLITEWNIK|BICEPS|CURL/],
  ['plecy', /WIOSŁ|ŚCIĄG|DRĄŻ|SZRUGS|PULL|ROW/],
  ['klatka', /WYCISK|ROZPIĘT|CHEST|KLAT|ŁAWK|PRESS/],
];

export const GROUP_NAMES = ['klatka', 'plecy', 'barki', 'biceps', 'triceps', 'nogi', 'łydki', 'dolny grzbiet', 'inne'];

export function guessGroup(name) {
  const key = normalizeName(name);
  return GROUPS.find(([, re]) => re.test(key))?.[0] ?? 'inne';
}

export const normalizeName = s => String(s).toLocaleUpperCase('pl').replace(/\s+/g, ' ').replace(/\s+\)/g, ')').trim();

export function parseScheme(raw) {
  return String(raw ?? '').split('/').map(x => parseInt(x, 10)).filter(n => n > 0);
}

/** Wyciąga liczbę z zapisu w stylu '27..5', '30 5', '10.', '12,5', '7kg(upadek)'. */
function cleanNumber(s) {
  let t = s.replace(',', '.').replace(/\.{2,}/g, '.').replace(/\.$/, '').trim();
  const split = t.match(/^(\d+)\.?\s+(\d)$/);
  if (split) t = `${split[1]}.${split[2]}`;
  const m = t.match(/^\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function splitNote(raw) {
  const s = String(raw ?? '').trim();
  const notes = [];
  const body = s.replace(/\(([^)]*)\)/g, (_, n) => { if (n.trim()) notes.push(n.trim()); return ' '; }).trim();
  return { s, body, note: notes.join(', ') };
}

export function parseWeight(raw) {
  const { s, body, note } = splitNote(raw);
  if (!s) return null;
  const lower = body.toLowerCase().replace(',', '.');
  const unit = /oczk/.test(lower) ? 'stack' : 'kg';
  const bare = lower.replace(/kg|oczk[oa]/g, ' ').replace(/\s+/g, ' ').trim();
  // „2x55” / „45x2” = ciężar na stronę maszyny.
  const side = bare.match(/^(?:2\s*x\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*x\s*2)$/);
  if (side) return { value: Number(side[1] ?? side[2]), unit, perSide: true, note, fixed: false, raw: s };
  const value = cleanNumber(bare);
  const plain = /^\d+(\.\d+)?$/.test(bare);
  const leftover = bare.replace(/^[\d.\s]+/, '').trim();
  return {
    value, unit, perSide: false,
    note: [note, leftover].filter(Boolean).join(', '),
    fixed: value != null && !plain && !leftover,
    raw: s,
  };
}

export function parseReps(raw) {
  const { s, body, note } = splitNote(raw);
  if (!s) return null;
  const lower = body.toLowerCase();
  const unit = /sek|sec|\ds\b/.test(lower) ? 'sec' : 'reps';
  const value = cleanNumber(lower.replace(/sek\.?|sec\.?|s\b/g, ' ').trim());
  const hasText = /[a-ząćęłńóśźż]/i.test(lower.replace(/sek|sec/g, ''));
  return { value, unit, note, hasText, raw: s };
}

/**
 * @param sheets wynik readWorkbook
 * @param lastSunday 'RRRR-MM-DD' — niedziela ostatniej zakładki
 */
export function importWorkbook(sheets, lastSunday) {
  const weeks = sheets.filter(s => s.rows.some(r => SECTION[normalizeName(r.cells.B ?? '')]));
  const exercises = {};
  const sessions = [];
  const report = [];
  const plan = { push: [], pull: [], fbw: [] };
  const prevSets = {};
  let duplicates = 0;
  let weekNo = 0;

  weeks.forEach((sheet, i) => {
    const sunday = addDays(lastSunday, -7 * (weeks.length - 1 - i));
    const deload = /deload/i.test(sheet.name);
    const label = deload ? 'Deload' : `Tydzień ${++weekNo}`;
    const byType = {};
    let section = null;
    const isLast = i === weeks.length - 1;

    for (const { cells } of sheet.rows) {
      const b = normalizeName(cells.B ?? '');
      if (SECTION[b]) { section = SECTION[b]; continue; }
      if (/^(GIGA|BRZUCH|CARDIO)/.test(b)) { section = null; continue; }
      if (!section) continue;

      const session = byType[section] ??= {
        id: `imp-${i}-${section}`, date: addDays(sunday, OFFSET[section]), type: section,
        source: 'import', label, deload, exercises: [], note: '',
      };

      if (!b) {
        // Wiersz bez ćwiczenia, ale z uwagą (np. „krótkie przerwy czas gonił”).
        const text = Object.entries(cells).filter(([col]) => col !== 'A').map(([, v]) => v).join(' ').trim();
        if (text) session.note = [session.note, text].filter(Boolean).join('; ');
        continue;
      }
      if (!cells.A && !cells.E) continue;

      const name = sentence(b);
      const exId = b;
      exercises[exId] ??= { id: exId, name, group: guessGroup(b) };
      const scheme = String(cells.E ?? '').trim();
      const targets = parseScheme(scheme);
      if (isLast) plan[section].push({ exId, scheme, rest: String(cells.D ?? '').trim() });

      const sets = [];
      const notes = [];
      PAIRS.forEach(([rc, wc], idx) => {
        const rRaw = cells[rc], wRaw = cells[wc];
        if (rRaw == null && wRaw == null) return;
        const ctx = { week: label, sessionId: session.id, date: session.date, type: section, exercise: name };
        // Kolumny M+ często niosą notatkę zamiast 4. serii.
        if (idx >= 3 && wRaw == null) { notes.push(String(rRaw).trim()); return; }
        const reps = parseReps(rRaw);
        const weight = parseWeight(wRaw);
        const set = {
          reps: reps?.value ?? null,
          weight: weight?.value ?? null,
          unit: reps?.unit === 'sec' ? 'sec' : (weight?.unit ?? 'kg'),
          perSide: weight?.perSide ?? false,
          rpe: null,
          note: [reps?.note, weight?.note].filter(Boolean).join(', '),
        };
        if (set.reps == null && set.weight == null) {
          notes.push([rRaw, wRaw].filter(Boolean).join(' '));
          return;
        }
        const target = targets[idx] ?? targets[targets.length - 1];
        if (weight?.fixed) report.push({ ...ctx, kind: 'fix', text: `ciężar „${weight.raw}” odczytany jako ${weight.value}` });
        if (set.reps != null && !Number.isInteger(set.reps)) {
          set.flag = 'shift';
          report.push({ ...ctx, kind: 'warn', text: `seria ${idx + 1}: ${set.reps} powtórzeń — kolumny mogą być przesunięte` });
        } else if (set.unit === 'reps' && target && set.reps > target * 2.5) {
          const firstTwo = Number(String(set.reps).slice(0, String(target).length));
          if (firstTwo === target) {
            report.push({ ...ctx, kind: 'fix', text: `seria ${idx + 1}: „${set.reps}” powtórzeń poprawione na ${target}` });
            set.reps = target;
          } else {
            set.flag = 'reps';
            report.push({ ...ctx, kind: 'warn', text: `seria ${idx + 1}: ${set.reps} powtórzeń przy planie ${target} — sprawdź` });
          }
        }
        sets.push(set);
      });

      if (!sets.length && !notes.length) continue;
      const signature = JSON.stringify(sets.map(s => [s.reps, s.weight]));
      if (sets.length >= 2 && prevSets[`${section}|${exId}`] === signature) duplicates++;
      prevSets[`${section}|${exId}`] = signature;
      if (sets.length) session.exercises.push({ exId, scheme, sets, note: notes.join('; ') });
    }

    for (const type of ['fbw', 'push', 'pull']) {
      if (byType[type]?.exercises.length) sessions.push(byType[type]);
    }
  });

  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return {
    exercises, sessions, plan, report, duplicates,
    weeks: weeks.length,
    sets: sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    from: sessions[0]?.date, to: sessions.at(-1)?.date,
  };
}
