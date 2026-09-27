// Minimalny czytnik .xlsx bez bibliotek: rozpakowanie ZIP (DecompressionStream) + parsowanie XML arkuszy.

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readZip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();

  let eocd = buffer.byteLength - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('To nie jest plik .xlsx.');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = {};
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    entries[name] = { method, data: bytes.subarray(start, start + size) };
    p += 46 + nameLen + extraLen + commentLen;
  }

  return async name => {
    const e = entries[name];
    if (!e) return null;
    return decoder.decode(e.method === 0 ? e.data : await inflateRaw(e.data));
  };
}

const parseXml = text => new DOMParser().parseFromString(text, 'application/xml');

function cellText(si) {
  // Tekst komórki może być podzielony na fragmenty (<r><t>); pomijamy podpowiedzi fonetyczne <rPh>.
  return [...si.getElementsByTagName('t')]
    .filter(t => t.parentElement?.localName !== 'rPh')
    .map(t => t.textContent).join('');
}

/**
 * Zwraca arkusze w kolejności z pliku: [{ name, rows: [{ r: 5, cells: { A: '1', B: 'OHP', … } }] }]
 */
export async function readWorkbook(buffer) {
  const read = readZip(buffer);
  const workbook = parseXml(await read('xl/workbook.xml'));
  const rels = parseXml(await read('xl/_rels/workbook.xml.rels'));
  const sharedXml = await read('xl/sharedStrings.xml');
  const shared = sharedXml ? [...parseXml(sharedXml).getElementsByTagName('si')].map(cellText) : [];

  const targets = {};
  for (const rel of rels.getElementsByTagName('Relationship')) {
    targets[rel.getAttribute('Id')] = rel.getAttribute('Target').replace(/^\/?xl\//, '');
  }

  const sheets = [];
  for (const sheet of workbook.getElementsByTagName('sheet')) {
    const rid = sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const xml = await read('xl/' + targets[rid]);
    if (!xml) continue;
    const rows = [];
    for (const row of parseXml(xml).getElementsByTagName('row')) {
      const cells = {};
      for (const c of row.getElementsByTagName('c')) {
        const type = c.getAttribute('t');
        let value;
        if (type === 's') value = shared[Number(c.getElementsByTagName('v')[0]?.textContent)];
        else if (type === 'inlineStr') value = cellText(c);
        else value = c.getElementsByTagName('v')[0]?.textContent;
        if (value == null || String(value).trim() === '') continue;
        // Liczby zapisane binarnie bywają w stylu 21.249999999999996.
        if (!type && /^-?\d+\.\d{6,}$/.test(value)) value = String(Math.round(Number(value) * 1000) / 1000);
        cells[c.getAttribute('r').replace(/\d+/g, '')] = String(value);
      }
      if (Object.keys(cells).length) rows.push({ r: Number(row.getAttribute('r')), cells });
    }
    sheets.push({ name: sheet.getAttribute('name'), rows });
  }
  return sheets;
}
