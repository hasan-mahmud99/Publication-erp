"use client";

import { useState } from 'react';
import { api, apiFile } from '@/lib/api';

type Field = { key: string; label: string; required?: boolean; aliases?: string[] };
type Definition = { moduleKey: string; entityKey: string; fields: Field[] };
type Job = { id: string; status: string; headers: string[]; totalRows: number; validRows: number; invalidRows: number; duplicateRows: number; rows: { rowNumber: number; mapped: Record<string, string>; status: string; errors: string[] }[] };
const columns = ['referenceCode', 'title', 'submitterName', 'receivedDate', 'synopsis'];
const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
function parseCsv(source: string) {
  const lines: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') { if (quoted && source[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && source[index + 1] === '\n') index++; row.push(value); if (row.some(item => item.trim())) lines.push(row); row = []; value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted cell');
  row.push(value); if (row.some(item => item.trim())) lines.push(row);
  return lines;
}
async function readRows(file: File) {
  let matrix: string[][];
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer() as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Excel file has no worksheet');
    matrix = [];
    sheet.eachRow((row) => { matrix.push((row.values as unknown[]).slice(1).map(value => value == null ? '' : typeof value === 'object' && 'text' in value ? String(value.text) : String(value))); });
  } else if (file.name.toLowerCase().endsWith('.csv')) matrix = parseCsv(await file.text());
  else throw new Error('Use a .csv or .xlsx file');
  if (matrix.length < 2 || matrix.length > 5001) throw new Error('Import needs 1 to 5,000 data rows');
  const headers = matrix[0].map(value => value.trim());
  if (headers.some((value, index) => !value || headers.indexOf(value) !== index)) throw new Error('Headers must be present and unique');
  return { headers, rows: matrix.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']))) };
}

export function EditorialImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Import failed'); } finally { setBusy(false); } }
  async function upload(file: File) { await run(async () => {
    const all = await api<{ data: Definition[] }>('/bulk-imports/definitions');
    const selected = all.data.find(item => item.moduleKey === 'manuscript-editorial' && item.entityKey === 'manuscript-records');
    if (!selected) throw new Error('Manuscript import definition is unavailable');
    const parsed = await readRows(file);
    const created = await api<{ data: Job }>('/bulk-imports', { method: 'POST', body: JSON.stringify({ moduleKey: selected.moduleKey, entityKey: selected.entityKey, fileName: file.name, ...parsed }) });
    setDefinition(selected); setJob(created.data);
    const mapped: Record<string, string> = {};
    for (const field of selected.fields) {
      const aliases = [field.key, field.label, ...(field.aliases || [])].map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const match = parsed.headers.find(header => aliases.includes(header.toLowerCase().replace(/[^a-z0-9]/g, '')));
      if (match) mapped[field.key] = match;
    }
    setMapping(mapped); setStep(1);
  }); }
  function template() {
    const blob = new Blob([columns.map(cell).join(',') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'manuscript-import-template.csv'; anchor.click(); URL.revokeObjectURL(url);
  }
  async function downloadErrors() { if (!job) return; await run(async () => {
    const blob = await apiFile(`/bulk-imports/${job.id}/errors.csv`);
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `manuscript-import-${job.id}-errors.csv`; anchor.click(); URL.revokeObjectURL(url);
  }); }
  return <div className="modal-backdrop"><div className="panel import-modal editorial-import" role="dialog" aria-modal="true" aria-label="Manuscript import">
    <div className="section-head"><div><h2>{'Import manuscripts'}</h2><p>{'CSV or Excel · drafts only'}</p></div><div className="button-row"><button className="btn" onClick={onClose}>{'Close'}</button></div></div>
    {error && <div className="alert-error" role="alert">{error}</div>}
    {step === 0 && <><p>{'Download a template, then upload up to 5,000 records. Imported manuscripts stay in draft until a file version is uploaded and submitted.'}</p><div className="button-row"><button className="btn" onClick={template}>{'Download CSV template'}</button><label className="btn btn-primary">{busy ? 'Reading…' : 'Choose CSV or Excel'}<input type="file" accept=".csv,.xlsx" hidden disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label></div></>}
    {step === 1 && definition && job && <><h3>{'Map columns'}</h3><div className="catalog-form-grid">{definition.fields.map(field => <label className="field" key={field.key}>{field.label}{field.required ? ' *' : ''}<select className="input" value={mapping[field.key] || ''} onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value }))}><option value="">{'Skip'}</option>{job.headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div><button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { const saved = await api<{ data: Job }>(`/bulk-imports/${job.id}/mapping`, { method: 'PUT', body: JSON.stringify({ mapping }) }); setJob(saved.data); setStep(2); })}>{'Save mapping'}</button></>}
    {step === 2 && job && <><p>{job.totalRows} {'rows ready for validation'}</p><button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { const checked = await api<{ data: Job }>(`/bulk-imports/${job.id}/validate`, { method: 'POST' }); setJob(checked.data); setStep(3); })}>{'Validate and preview'}</button></>}
    {step === 3 && job && <><p>{'Valid'}: {job.validRows} · {'Invalid'}: {job.invalidRows} · {'Duplicates'}: {job.duplicateRows}</p><div className="table-wrap"><table className="data-table"><thead><tr><th>{'Row'}</th><th>{'Reference'}</th><th>{'Title'}</th><th>{'Status'}</th><th>{'Errors'}</th></tr></thead><tbody>{job.rows.slice(0, 100).map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.mapped.referenceCode}</td><td>{row.mapped.title}</td><td>{row.status}</td><td>{row.errors.join('; ')}</td></tr>)}</tbody></table></div><p className="muted">{'Preview shows the first 100 rows; the error report includes every invalid or duplicate row.'}</p><div className="button-row">{job.invalidRows + job.duplicateRows > 0 && <button className="btn" onClick={() => void downloadErrors()}>{'Download error CSV'}</button>}<button className="btn btn-primary" disabled={busy || !job.validRows} onClick={() => void run(async () => { const saved = await api<{ data: Job }>(`/bulk-imports/${job.id}/confirm`, { method: 'POST' }); setJob(saved.data); setStep(4); onImported(); })}>{'Commit valid drafts'}</button></div></>}
    {step === 4 && job && <><div className="alert-success" role="status">{job.validRows} {'draft manuscripts imported and audited'}</div><button className="btn btn-primary" onClick={onClose}>{'Done'}</button></>}
  </div></div>;
}
