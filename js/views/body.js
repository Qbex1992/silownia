import { esc, num, signed, today, fmtShort, fmtDay, addDays, uid } from '../util.js';
import { lineChart } from '../charts.js';
import { photoGet, photoSet, photoDel } from '../db.js';
import { icon } from '../icons.js';

const POSES = { front: 'Przód', side: 'Bok', back: 'Tył' };
const urlCache = new Map();
let ui = { field: null, pose: 'front', a: null, b: null };

async function photoUrl(id) {
  if (!urlCache.has(id)) {
    const blob = await photoGet(id);
    urlCache.set(id, blob ? URL.createObjectURL(blob) : '');
  }
  return urlCache.get(id);
}

async function shrink(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
}

export function render(app) {
  const { state } = app;
  const { weights, measurements, fields } = state.body;
  const w = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const cur = w.at(-1);
  const monthAgo = w.filter(x => x.date <= addDays(today(), -28)).at(-1);
  const m = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const lastM = m.at(-1), prevM = m.at(-2);
  ui.field ??= fields[0];
  const mPts = m.filter(x => x.values[ui.field] != null).map(x => ({ x: x.date, y: x.values[ui.field] }));

  const posePhotos = state.photos.filter(p => p.pose === ui.pose).sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set(posePhotos.map(p => p.date))];
  if (!dates.includes(ui.a) || ui.a === ui.b) ui.a = dates[0] ?? null;
  if (!dates.includes(ui.b) || ui.a === ui.b) ui.b = dates.at(-1) ?? null;
  const pa = posePhotos.find(p => p.date === ui.a), pb = posePhotos.filter(p => p.date === ui.b).at(-1);
  const byDate = {};
  for (const p of [...state.photos].sort((a, b) => b.date.localeCompare(a.date))) (byDate[p.date] ??= []).push(p);

  return `
    <header class="top"><div><p class="muted small">Ciało</p><h1>${cur ? `${num(cur.kg)} kg` : 'Waga i pomiary'}</h1></div>
      ${cur && monthAgo ? `<span class="${cur.kg <= monthAgo.kg ? 'up' : 'muted'} small">${signed(cur.kg - monthAgo.kg)} kg / 4 tyg.</span>` : ''}</header>

    <section class="card">
      <h3>Waga</h3>
      <form class="inline-form" id="f-weight">
        <input type="date" name="date" value="${today()}" max="${today()}" aria-label="Data">
        <input name="kg" inputmode="decimal" placeholder="82,4" aria-label="Waga w kg" required>
        <button class="btn primary">Zapisz</button>
      </form>
      ${lineChart(w.map(x => ({ x: x.date, y: x.kg })), { color: 'var(--pull)', label: 'Waga w czasie' })}
      ${w.length ? `<ul class="history">${w.slice(-5).reverse().map(x => `<li><span>${fmtDay(x.date)}</span><b>${num(x.kg)} kg</b><button class="icon-btn sm" data-del-weight="${x.date}" aria-label="Usuń wpis">${icon.x}</button></li>`).join('')}</ul>` : ''}
    </section>

    <section class="card">
      <div class="card-head"><h3>Pomiary</h3><span class="muted small">${lastM ? `ostatnio ${fmtShort(lastM.date)}` : 'co tydzień'}</span></div>
      <form id="f-meas">
        <input type="date" name="date" value="${today()}" max="${today()}" aria-label="Data pomiaru">
        <div class="meas-grid">
          ${fields.map(f => `<label>${esc(f)}<input name="${esc(f)}" inputmode="decimal" placeholder="${lastM?.values[f] != null ? num(lastM.values[f]) : 'cm'}"></label>`).join('')}
        </div>
        <button class="btn primary">Zapisz pomiary</button>
      </form>
      ${lastM ? `
        <table class="meas-table"><tbody>
          ${fields.filter(f => lastM.values[f] != null).map(f => {
            const d = prevM?.values[f] != null ? lastM.values[f] - prevM.values[f] : null;
            return `<tr><td>${esc(f)}</td><td>${num(lastM.values[f])} cm</td><td class="muted">${d != null ? signed(d) : ''}</td></tr>`;
          }).join('')}
        </tbody></table>
        <div class="tabs small-tabs">${fields.map(f => `<button data-field="${esc(f)}" class="${f === ui.field ? 'on' : ''}">${esc(f)}</button>`).join('')}</div>
        ${lineChart(mPts, { color: 'var(--fbw)', label: `Obwód: ${ui.field}` })}` : ''}
    </section>

    <section class="card">
      <div class="card-head"><h3>Zdjęcia</h3><span class="muted small">zostają tylko w telefonie</span></div>
      <form class="inline-form" id="f-photo">
        <input type="date" name="date" value="${today()}" max="${today()}" aria-label="Data zdjęcia">
        <select name="pose" aria-label="Ujęcie">${Object.entries(POSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <label class="btn primary file-btn">${icon.camera} Dodaj<input type="file" name="file" accept="image/*" hidden></label>
      </form>

      ${state.photos.length ? `
        <div class="tabs small-tabs">${Object.entries(POSES).map(([k, v]) => `<button data-pose="${k}" class="${k === ui.pose ? 'on' : ''}">${v}</button>`).join('')}</div>
        ${dates.length >= 2 ? `
          <div class="compare-pick">
            <select data-cmp="a" aria-label="Zdjęcie przed">${dates.map(d => `<option ${d === ui.a ? 'selected' : ''} value="${d}">${fmtShort(d)}</option>`).join('')}</select>
            <span class="muted small">vs</span>
            <select data-cmp="b" aria-label="Zdjęcie po">${dates.map(d => `<option ${d === ui.b ? 'selected' : ''} value="${d}">${fmtShort(d)}</option>`).join('')}</select>
          </div>
          <div class="compare" style="--pos:50%">
            <img data-photo="${pa.id}" alt="${POSES[ui.pose]}, ${fmtDay(pa.date)}">
            <div class="after"><img data-photo="${pb.id}" alt="${POSES[ui.pose]}, ${fmtDay(pb.date)}"></div>
            <span class="cmp-label l">${fmtShort(pa.date)}</span><span class="cmp-label r">${fmtShort(pb.date)}</span>
            <input type="range" min="0" max="100" value="50" aria-label="Przesuń, żeby porównać">
          </div>` : `<p class="small muted">Dodaj drugie zdjęcie „${POSES[ui.pose].toLowerCase()}” z innego dnia, żeby porównać.</p>`}
        <div class="gallery">
          ${Object.entries(byDate).map(([d, ps]) => `<div class="g-day"><span class="small muted">${fmtShort(d)}</span><div>
            ${ps.map(p => `<figure><img data-photo="${p.id}" alt="${POSES[p.pose]}, ${fmtDay(d)}"><button class="icon-btn sm" data-del-photo="${p.id}" aria-label="Usuń zdjęcie">${icon.x}</button></figure>`).join('')}
          </div></div>`).join('')}
        </div>` : '<p class="small muted">Rób zdjęcia co tydzień lub dwa, w tym samym miejscu i świetle. Porównasz je potem obok siebie.</p>'}
    </section>`;
}

const parseKg = v => { const n = Number(String(v).replace(',', '.')); return String(v).trim() && !Number.isNaN(n) ? n : null; };

export function mount(root, app) {
  const { state } = app;
  root.querySelectorAll('img[data-photo]').forEach(async img => { img.src = await photoUrl(img.dataset.photo); });

  root.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (e.target.id === 'f-weight') {
      const kg = parseKg(f.get('kg'));
      if (!kg || kg < 30 || kg > 300) { app.toast('Wpisz wagę w kg, np. 82,4'); return; }
      const date = f.get('date') || today();
      state.body.weights = state.body.weights.filter(x => x.date !== date).concat({ date, kg });
    } else if (e.target.id === 'f-meas') {
      const values = {};
      for (const field of state.body.fields) { const v = parseKg(f.get(field)); if (v != null) values[field] = v; }
      if (!Object.keys(values).length) { app.toast('Wpisz przynajmniej jeden obwód'); return; }
      const date = f.get('date') || today();
      const existing = state.body.measurements.find(x => x.date === date);
      if (existing) Object.assign(existing.values, values);
      else state.body.measurements.push({ date, values });
    }
    app.save();
    app.toast('Zapisano');
    app.render();
  };

  root.onchange = async e => {
    const t = e.target;
    if (t.name === 'file' && t.files[0]) {
      const form = t.form;
      const blob = await shrink(t.files[0]);
      const id = uid();
      await photoSet(id, blob);
      const date = form.date.value || today();
      state.photos.push({ id, date, pose: form.pose.value });
      ui.pose = form.pose.value;
      ui.a = ui.b = null;
      app.save();
      app.toast('Zdjęcie dodane');
      app.render();
    } else if (t.dataset.cmp) {
      ui[t.dataset.cmp] = t.value;
      app.render();
    }
  };

  root.oninput = e => {
    if (e.target.type === 'range') e.target.closest('.compare').style.setProperty('--pos', `${e.target.value}%`);
  };

  root.onclick = async e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.field) { ui.field = t.dataset.field; app.render(); }
    else if (t.dataset.pose) { ui.pose = t.dataset.pose; ui.a = ui.b = null; app.render(); }
    else if (t.dataset.delWeight && confirm('Usunąć ten pomiar wagi?')) {
      state.body.weights = state.body.weights.filter(x => x.date !== t.dataset.delWeight);
      app.save(); app.render();
    } else if (t.dataset.delPhoto && confirm('Usunąć to zdjęcie?')) {
      await photoDel(t.dataset.delPhoto);
      state.photos = state.photos.filter(p => p.id !== t.dataset.delPhoto);
      app.save(); app.render();
    }
  };
}
