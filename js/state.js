import { kvGet, kvSet, persist } from './db.js';
import { debounce } from './util.js';

export const DEFAULT_FIELDS = ['klatka', 'talia', 'biodra', 'biceps', 'udo', 'łydka'];

export function emptyState() {
  return {
    version: 1,
    exercises: {},
    plan: { push: [], pull: [], fbw: [] },
    sessions: [],
    body: { weights: [], measurements: [], fields: [...DEFAULT_FIELDS] },
    photos: [],
    rewards: [],
    settings: { fbwDay: 2, weekFbw: {}, theme: 'ember', seenLevel: null, seenBadges: null },
    draft: null,
    lastImport: null,
  };
}

export const store = { state: null };

export async function load() {
  const saved = await kvGet('state');
  const base = emptyState();
  store.state = saved
    ? { ...base, ...saved, settings: { ...base.settings, ...saved.settings }, body: { ...base.body, ...saved.body } }
    : base;
  persist();
  return store.state;
}

export const saveNow = () => kvSet('state', store.state);
export const save = debounce(saveNow, 300);

// Zapis przy chowaniu aplikacji, żeby nie zgubić ostatniej serii.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && store.state) saveNow();
});

export function sortSessions() {
  store.state.sessions.sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
}
