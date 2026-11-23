'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import { ProductionBomImport } from './production-bom-import';

type Row = Record<string, any>;
type Line = { itemId: string; warehouseId: string; quantityPerCopy: number; wastagePercent: number; notes: string };
type Form = { bomRef: string; editionId: string; notes: string; lines: Line[] };
const newLine = (): Line => ({ itemId: '', warehouseId: '', quantityPerCopy: 1, wastagePercent: 0, notes: '' });
const blank = (): Form => ({ bomRef: '', editionId: '', notes: '', lines: [newLine()] });
const human = (value: string) => value.replaceAll('_', ' ');

export function ProductionBomScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]), [choices, setChoices] = useState<{ editions: Row[]; items: Row[]; warehouses: Row[] }>({ editions: [], items: [], warehouses: [] });
  const [detail, setDetail] = useState<Row | null>(null), [form, setForm] = useState<Form>(blank), [editing, setEditing] = useState(false);
  const [canManage, setCanManage] = useState(false), [canApprove, setCanApprove] = useState(false), [note, setNote] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const [list, options, me] = await Promise.all([api<{ data: Row[] }>('/production/boms'), api<{ data: typeof choices }>('/production/choices'), api<{ data: { role: string; permissions: string[] } }>('/auth/me')]);
      setRows(list.data); setChoices(options.data); setCanManage(me.data.role === 'Owner' || me.data.permissions.includes('production.manage')); setCanApprove(me.data.role === 'Owner' || me.data.permissions.includes('production.approve'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load BOMs'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [screen.id]);
  async function open(id: string) { setEditing(false); try { setDetail((await api<{ data: Row }>(`/production/boms/${id}`)).data); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load BOM'); } }
  function changeLine(index: number, key: keyof Line, value: string | number) { setForm(current => ({ ...current, lines: current.lines.map((line, i) => i === index ? { ...line, [key]: value } : line) })); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const version = detail?.currentVersion;
      const draft = version?.status === 'draft';
      const path = !detail ? '/production/boms' : draft ? `/production/boms/${detail.id}/versions/${version.id}` : `/production/boms/${detail.id}/amendments`;
      const result = await api<{ data: Row }>(path, { method: draft ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, ...(draft ? { revisionNo: version.revision_no } : {}) }) });
      setDetail(result.data); setEditing(false); setNotice('BOM draft saved. Independent approval is required before print order use.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save BOM'); }
    finally { setBusy(false); }
  }
  async function decide(action: 'submit' | 'approve' | 'return') {
    if (!detail) return; setBusy(true); setError(''); setNotice('');
    try { setDetail((await api<{ data: Row }>(`/production/boms/${detail.id}/versions/${detail.currentVersion.id}/${action}`, { method: 'POST', body: JSON.stringify(action === 'submit' ? {} : { note: note.trim() }) })).data); setNote(''); setNotice(`BOM ${human(action)} completed.`); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete review'); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><h1 className="page-title">BOM &amp; Material Requirement</h1><p className="muted">Versioned material quantities and explicit wastage allowances per copy.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}
    {canManage && <button className="btn btn-primary" onClick={() => { setDetail(null); setForm(blank()); setEditing(true); }}>Create BOM</button>}
    <section className="panel table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Book / edition</th><th>Version</th><th>Status</th><th>Materials</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Loading BOMs...</td></tr> : rows.length ? rows.map(row => <tr key={row.id}><td>{row.reference}</td><td>{row.book_title} / {row.edition_number}</td><td>{row.version_no}</td><td>{human(row.status)}</td><td>{row.terms.lines.length}</td><td><button className="btn" onClick={() => void open(row.id)}>Details</button></td></tr>) : <tr><td colSpan={6}>No BOMs yet.</td></tr>}</tbody></table></section>
    {editing && <section className="panel catalog-form"><h2 className="section-title">{detail ? detail.currentVersion.status === 'draft' ? 'Edit BOM draft' : 'Amend approved BOM' : 'New BOM'}</h2><form onSubmit={save}><div className="catalog-form-grid"><label className="field">Reference<input className="input" required value={form.bomRef} disabled={!!detail} onChange={event => setForm({ ...form, bomRef: event.target.value })} /></label><label className="field">Edition<select className="input" required disabled={!!detail} value={form.editionId} onChange={event => setForm({ ...form, editionId: event.target.value })}><option value="">Choose edition</option>{choices.editions.map(row => <option key={row.id} value={row.id}>{row.book_title} / {row.edition_number}</option>)}</select></label><label className="field">Notes<textarea className="input" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label></div><h3 className="section-title">Material lines</h3>{form.lines.map((line, index) => <div className="catalog-form-grid" key={index}><label className="field">Material<select className="input" required value={line.itemId} onChange={event => changeLine(index, 'itemId', event.target.value)}><option value="">Choose material</option>{choices.items.map(row => <option key={row.id} value={row.id}>{row.item_code} - {row.name} ({row.base_uom})</option>)}</select></label><label className="field">Source warehouse<select className="input" required value={line.warehouseId} onChange={event => changeLine(index, 'warehouseId', event.target.value)}><option value="">Choose warehouse</option>{choices.warehouses.map(row => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select></label><label className="field">Quantity per copy<input className="input" required type="number" min="0.0001" step="0.0001" value={line.quantityPerCopy} onChange={event => changeLine(index, 'quantityPerCopy', Number(event.target.value))} /></label><label className="field">Wastage %<input className="input" required type="number" min="0" max="100" step="0.01" value={line.wastagePercent} onChange={event => changeLine(index, 'wastagePercent', Number(event.target.value))} /></label><label className="field">Line notes<input className="input" value={line.notes} onChange={event => changeLine(index, 'notes', event.target.value)} /></label><button type="button" className="btn" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}>Remove line</button></div>)}<div className="button-row"><button type="button" className="btn" onClick={() => setForm({ ...form, lines: [...form.lines, newLine()] })}>Add material</button><button className="btn btn-primary" disabled={busy}>Save draft</button><button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button></div></form></section>}
    {editing && canManage && <ProductionBomImport editionId={form.editionId} items={choices.items} warehouses={choices.warehouses} onApply={lines => { setForm(current => ({ ...current, lines })); setNotice(`${lines.length} validated BOM lines added to the draft. Save and submit the draft for independent approval.`); }} />}
    {detail && !editing && <section className="panel catalog-form"><h2 className="section-title">{detail.reference} / version {detail.currentVersion.version_no}</h2><p>{detail.book_title} / Edition {detail.edition_number} / {human(detail.currentVersion.status)}</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Warehouse</th><th>Per copy</th><th>Wastage %</th><th>Notes</th></tr></thead><tbody>{detail.currentVersion.terms.lines.map((line: Line, index: number) => <tr key={index}><td>{choices.items.find(row => row.id === line.itemId)?.name || line.itemId}</td><td>{choices.warehouses.find(row => row.id === line.warehouseId)?.name || line.warehouseId}</td><td>{line.quantityPerCopy}</td><td>{line.wastagePercent}</td><td>{line.notes}</td></tr>)}</tbody></table></div>{canManage && ['draft', 'approved'].includes(detail.currentVersion.status) && <button className="btn" onClick={() => { setForm(detail.currentVersion.terms); setEditing(true); }}>{detail.currentVersion.status === 'draft' ? 'Edit draft' : 'Create amendment'}</button>}{canManage && detail.currentVersion.status === 'draft' && <button className="btn btn-primary" disabled={busy} onClick={() => void decide('submit')}>Submit for approval</button>}{canApprove && detail.currentVersion.status === 'pending_approval' && <><label className="field">Decision note<input className="input" minLength={10} value={note} onChange={event => setNote(event.target.value)} /></label><div className="button-row"><button className="btn btn-primary" disabled={busy || note.trim().length < 10} onClick={() => void decide('approve')}>Approve version</button><button className="btn" disabled={busy || note.trim().length < 10} onClick={() => void decide('return')}>Return to draft</button></div></>}<h3 className="section-title">Version history</h3>{detail.versions.map((version: Row) => <p key={version.id}>Version {version.version_no} / {human(version.status)}</p>)}</section>}
  </>;
}
