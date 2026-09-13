// Minimal RFC 4180 CSV parser. Rebrickable part names contain commas and
// double quotes ("Brick Sloped Inverted 45° 2 x 2 [Ovoid Bottom Pin, ...]"),
// so a split(',') is not enough. Returns an array of objects keyed by header.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows;
  return body
    .filter(cells => cells.length > 1 || cells[0] !== '')
    .map(cells => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
}
