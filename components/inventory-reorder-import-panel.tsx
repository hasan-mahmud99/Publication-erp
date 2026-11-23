"use client";

import { useState } from 'react';
import { api } from '@/lib/api';
import { parseInventoryOpeningCsv } from '@/lib/inventory-opening-csv';

const fields = ['itemCode', 'warehouseCode', 'minimumQty', 'targetQty', 'leadDays'] as const;
type Field = typeof fields[number];
type Row = Record<string, string>;
type ImportRecord = { id: string; file_name: string; row_count: number; imported_at: string };

export function InventoryReorderImportPanel({ items, warehouses, onImported }: {
  items: Array<{ item_code: string }>;
  warehouses: Array<{ code: string; status: string }>;
  onImported: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>({ itemCode: '', warehouseCode: '', minimumQty: '', targetQty: '', leadDays: '' });
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadFile(file?: File) {
    setError(''); setNotice(''); setRows([]);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1_000_000) { setError('Choose a CSV file no larger than 1 MB.'); return; }
    try {
      const parsed = parseInventoryOpeningCsv(await file.text());
      setFileName(file.name); setHeaders(parsed.headers); setRows(parsed.rows);
      setMapping(Object.fromEntries(fields.map(field => [field, parsed.headers.includes(field) ? field : ''])) as Record<Field, string>);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read CSV'); }
  }
  const mapped = fields.every(field => mapping[field]) && new Set(fields.map(field => mapping[field])).size === fields.length;
  const itemCodes = new Set(items.map(item => item.item_code));
  const warehouseCodes = new Set(warehouses.filter(row => row.status === 'active').map(row => row.code));
  const seen = new Set<string>();
  const preview = mapped ? rows.map((row, index) => {
    const values = Object.fromEntries(fields.map(field => [field, row[mapping[field]]?.trim() ?? ''])) as Record<Field, string>;
    const pair = JSON.stringify([values.itemCode, values.warehouseCode]);
    const errors: string[] = [];
    if (!itemCodes.has(values.itemCode)) errors.push('Unknown item');
    if (!warehouseCodes.has(values.warehouseCode)) errors.push('Unknown or inactive warehouse');
    if (seen.has(pair)) errors.push('Duplicate item and warehouse');
    seen.add(pair);
    if (!/^\d+(\.\d{1,4})?$/.test(values.minimumQty) || !/^\d+(\.\d{1,4})?$/.test(values.targetQty) || Number(values.targetQty) <= Number(values.minimumQty)) errors.push('Target must exceed a nonnegative minimum (up to four decimals)');
    if (!/^\d+$/.test(values.leadDays) || Number(values.leadDays) > 3650) errors.push('Lead days must be 0 to 3650');
    return { line: index + 2, values, errors };
  }) : [];
  const invalidCount = preview.filter(row => row.errors.length).length;

  async function refreshHistory() {
    try { setHistory((await api<{ data: ImportRecord[] }>('/inventory/reorder-policies/imports')).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load import history'); }
  }
  async function commit() {
    if (!mapped || !preview.length || invalidCount || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ data: { id: string; rowCount: number } }>('/inventory/reorder-policies/imports', {
        method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ fileName, rows: preview.map(({ values }) => ({ ...values, leadDays: Number(values.leadDays) })) }),
      });
      setNotice(`Imported ${result.data.rowCount} reorder policies. Reference: ${result.data.id}`);
      setRows([]); setFileName(''); await onImported(); await refreshHistory();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Import failed'); }
    finally { setBusy(false); }
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([`${fields.join(',')}\n`], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = 'inventory-reorder-policies.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="panel catalog-form">
    <h2 className="section-title">Reorder policy CSV import</h2>
    <p className="muted">Download the template, map columns and review every row. Import updates policies atomically; it does not change stock balances.</p>
    <div className="button-row"><button className="btn" onClick={downloadTemplate}>Download CSV template</button><button className="btn" onClick={() => void refreshHistory()}>Import history</button></div>
    <label className="field">Reorder CSV<input className="input" type="file" accept=".csv,text/csv" onChange={event => void loadFile(event.target.files?.[0])} /></label>
    {headers.length > 0 && <><div className="catalog-form-grid">{fields.map(field => <label className="field" key={field}>{field}<select className="input" value={mapping[field]} onChange={event => setMapping(current => ({ ...current, [field]: event.target.value }))}><option value="">Choose column</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
      <p>{rows.length} rows · {invalidCount} invalid</p>
      {mapped && <div className="table-wrap"><table className="data-table"><thead><tr><th>CSV line</th><th>Item</th><th>Warehouse</th><th>Minimum</th><th>Target</th><th>Lead days</th><th>Validation</th></tr></thead><tbody>{preview.map(row => <tr key={row.line}><td>{row.line}</td><td>{row.values.itemCode}</td><td>{row.values.warehouseCode}</td><td>{row.values.minimumQty}</td><td>{row.values.targetQty}</td><td>{row.values.leadDays}</td><td>{row.errors.join('; ') || 'Ready'}</td></tr>)}</tbody></table></div>}
      <button className="btn btn-primary" disabled={!mapped || invalidCount > 0 || busy} onClick={() => void commit()}>Import validated policies</button>
    </>}
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {history.length > 0 && <div className="table-wrap"><table className="data-table"><thead><tr><th>File</th><th>Rows</th><th>Imported</th><th>Reference</th></tr></thead><tbody>{history.map(row => <tr key={row.id}><td>{row.file_name}</td><td>{row.row_count}</td><td>{String(row.imported_at).slice(0, 19)}</td><td>{row.id}</td></tr>)}</tbody></table></div>}
  </section>;
}
