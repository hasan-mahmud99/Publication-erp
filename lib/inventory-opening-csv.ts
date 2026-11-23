export function parseInventoryOpeningCsv(content: string) {
  const records: string[][] = []; let cells: string[] = [], cell = '', quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (char === '"') { if (quoted && content[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { cells.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && content[index + 1] === '\n') index++; cells.push(cell); if (cells.some(value => value.trim())) records.push(cells); cells = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quote');
  cells.push(cell); if (cells.some(value => value.trim())) records.push(cells);
  const headers = records.shift()?.map(value => value.replace(/^\uFEFF/, '').trim()) ?? [];
  if (!headers.length || headers.some((value, index) => !value || headers.indexOf(value) !== index)) throw new Error('CSV headers must be non-empty and unique');
  if (!records.length || records.length > 500) throw new Error('CSV must contain 1 to 500 stock rows');
  if (records.some(row => row.length !== headers.length)) throw new Error('Every CSV row must have the same number of columns as its header');
  return { headers, rows: records.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index].trim()]))) };
}
