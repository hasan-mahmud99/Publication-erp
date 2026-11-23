'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type Row = Record<string, string>;
type Choice = Record<string, any>;
type Line = { itemId: string; warehouseId: string; quantityPerCopy: number; wastagePercent: number; notes: string };
type PreviewRow = { rowNumber: number; material: string; warehouse: string; quantity: string; wastage: string; errors: string[] };
const fields = [
  { key: 'materialCode', label: 'Material code' },
  { key: 'warehouseCode', label: 'Warehouse code' },
  { key: 'quantityPerCopy', label: 'Quantity per copy' },
  { key: 'wastagePercent', label: 'Wastage percent' },
  { key: 'notes', label: 'Notes (optional)' },
] as const;
const cell = (value: unknown) => { const raw = String(value ?? ''); const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
const download = (name: string, content: BlobPart, mime: string) => { const url = URL.createObjectURL(new Blob([content], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const matrix: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index++; row.push(value); if (row.some(part => part.trim())) matrix.push(row); row = []; value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted cell');
  row.push(value); if (row.some(part => part.trim())) matrix.push(row);
  const headers = (matrix.shift() || []).map(value => value.trim().replace(/^\uFEFF/, ''));
  if (!headers.length || new Set(headers).size !== headers.length || headers.some(value => !value)) throw new Error('CSV needs unique, nonempty column headers');
  return { headers, rows: matrix.map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()]))) };
}
async function parseFile(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text());
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Select a CSV or XLSX file');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0]; if (!sheet) throw new Error('XLSX file has no worksheet');
  const header = sheet.getRow(1); const headers = Array.from({ length: header.cellCount }, (_, index) => header.getCell(index + 1).text.trim());
  if (!headers.length || new Set(headers).size !== headers.length || headers.some(value => !value)) throw new Error('XLSX needs unique, nonempty first-row headers');
  const rows: Row[] = [];
  for (let index = 2; index <= sheet.rowCount; index++) { const source = sheet.getRow(index); const values = Object.fromEntries(headers.map((name, column) => [name, source.getCell(column + 1).text.trim()])); if (Object.values(values).some(Boolean)) rows.push(values); }
  return { headers, rows };
}

export function ProductionBomImport({ editionId, items, warehouses, onApply }: { editionId: string; items: Choice[]; warehouses: Choice[]; onApply: (lines: Line[]) => void }) {
  const [headers, setHeaders] = useState<string[]>([]), [rows, setRows] = useState<Row[]>([]), [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]), [validLines, setValidLines] = useState<Line[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function template(format: 'csv' | 'xlsx') {
    const names = fields.map(field => field.key);
    if (format === 'csv') { download('production-bom-lines.csv', `${names.map(cell).join(',')}\n`, 'text/csv;charset=utf-8'); return; }
    const ExcelJS = (await import('exceljs')).default; const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('BOM Lines'); sheet.addRow(names); sheet.getRow(1).font = { bold: true }; sheet.columns.forEach(column => { column.width = 24; });
    const buffer = await workbook.xlsx.writeBuffer(); download('production-bom-lines.xlsx', buffer as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  async function upload(file: File) {
    setError(''); setPreview([]); setValidLines([]);
    if (file.size > 5_000_000) { setError('Maximum file size is 5 MB'); return; }
    try { const parsed = await parseFile(file); if (!parsed.rows.length || parsed.rows.length > 100) throw new Error('Import 1 to 100 BOM lines per file'); setHeaders(parsed.headers); setRows(parsed.rows); setMapping(Object.fromEntries(fields.map(field => [field.key, parsed.headers.find(header => header.toLowerCase().replace(/[^a-z0-9]/g, '') === field.key.toLowerCase()) || '']))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read file'); }
  }
  async function validate() {
    setError(''); setPreview([]); setValidLines([]);
    if (!editionId) { setError('Choose an edition before validating BOM lines'); return; }
    if (fields.slice(0, 4).some(field => !mapping[field.key])) { setError('Map material, warehouse, quantity and wastage columns'); return; }
    const seen = new Set<string>(), lines: Line[] = [];
    const result = rows.map((source, index) => {
      const material = (source[mapping.materialCode] || '').trim(), warehouse = (source[mapping.warehouseCode] || '').trim();
      const quantity = (source[mapping.quantityPerCopy] || '').trim(), wastage = (source[mapping.wastagePercent] || '').trim();
      const item = items.find(row => String(row.item_code).toLowerCase() === material.toLowerCase());
      const location = warehouses.find(row => String(row.code).toLowerCase() === warehouse.toLowerCase());
      const errors: string[] = [];
      if (!item) errors.push('Unknown material code'); if (!location) errors.push('Unknown warehouse code');
      if (!/^\d+(?:\.\d{1,4})?$/.test(quantity) || Number(quantity) <= 0 || Number(quantity) > 1_000_000) errors.push('Quantity must be positive with at most four decimals');
      if (!/^\d+(?:\.\d{1,2})?$/.test(wastage) || Number(wastage) > 100) errors.push('Wastage must be 0 to 100 with at most two decimals');
      const key = `${item?.id}:${location?.id}`; if (item && location && seen.has(key)) errors.push('Duplicate material and warehouse'); if (item && location) seen.add(key);
      const notes = (source[mapping.notes] || '').trim(); if (notes.length > 500) errors.push('Notes exceed 500 characters');
      if (!errors.length && item && location) lines.push({ itemId: item.id, warehouseId: location.id, quantityPerCopy: Number(quantity), wastagePercent: Number(wastage), notes });
      return { rowNumber: index + 2, material, warehouse, quantity, wastage, errors };
    });
    setPreview(result);
    if (result.some(row => row.errors.length)) return;
    setBusy(true);
    try { await api('/production/boms/import-preview', { method: 'POST', body: JSON.stringify({ editionId, lines }) }); setValidLines(lines); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Server validation failed'); }
    finally { setBusy(false); }
  }
  function errorsCsv() { download('production-bom-import-errors.csv', [[...fields.map(field => field.key), 'sourceRow', 'errors'].map(cell).join(','), ...preview.filter(row => row.errors.length).map(row => [row.material, row.warehouse, row.quantity, row.wastage, '', row.rowNumber, row.errors.join('; ')].map(cell).join(','))].join('\n'), 'text/csv;charset=utf-8'); }
  return <section className="panel catalog-form"><h3 className="section-title">Import BOM lines from CSV or XLSX</h3><p className="muted">Map columns, preview errors, then place validated lines into this draft. Saving and independent approval follow the normal BOM workflow.</p><div className="button-row"><button type="button" className="btn" onClick={() => void template('csv')}>CSV template</button><button type="button" className="btn" onClick={() => void template('xlsx')}>XLSX template</button></div><label className="field">Source file<input className="input" type="file" accept=".csv,.xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>{error && <div className="alert-error" role="alert">{error}</div>}{headers.length > 0 && <><div className="catalog-form-grid">{fields.map(field => <label className="field" key={field.key}>{field.label}<select className="input" value={mapping[field.key] || ''} onChange={event => { setMapping(current => ({ ...current, [field.key]: event.target.value })); setValidLines([]); }}><option value="">Do not map</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><button type="button" className="btn" disabled={busy} onClick={() => void validate()}>Validate {rows.length} rows</button></>}{preview.length > 0 && <><p>{preview.filter(row => !row.errors.length).length} valid / {preview.filter(row => row.errors.length).length} invalid rows</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Row</th><th>Material</th><th>Warehouse</th><th>Quantity</th><th>Wastage %</th><th>Errors</th></tr></thead><tbody>{preview.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.material}</td><td>{row.warehouse}</td><td>{row.quantity}</td><td>{row.wastage}</td><td>{row.errors.join('; ') || 'Valid'}</td></tr>)}</tbody></table></div>{preview.some(row => row.errors.length) && <button type="button" className="btn" onClick={errorsCsv}>Download error CSV</button>}{validLines.length > 0 && <button type="button" className="btn btn-primary" onClick={() => onApply(validLines)}>Use validated lines in draft</button>}</>}</section>;
}
