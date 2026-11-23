"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { parseInventoryOpeningCsv } from '@/lib/inventory-opening-csv';

type Item = { id: string; item_code: string; name: string; tracking_policy: string; item_type: string; edition_id: string | null };
type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };
type Member = { id: string; display_name: string; email: string };
type Scope = { itemId: string; lotNumber?: string | null; binLocation?: string | null };
type Lot = { lot_number: string; bin_location: string | null; on_hand_qty: string };
type CountLine = { id: string; item_code: string; item_name: string; lot_number: string | null; bin_location: string | null; snapshot_quantity: string | null; counted_quantity: string | null; variance_reason: string | null; stock_count_id: string | null; decision_status: string | null; evidence: Array<{ revision: number; counted_quantity: string; reason: string | null; counted_at: string }> };
type Plan = { id: string; plan_number: string; count_type: string; planned_date: string; warehouse_id: string; warehouse_code: string; supervisor_id: string; teamUserIds: string[]; status: string; line_count?: number; counted_count?: number; approved_count?: number; rejected_count?: number; lines?: CountLine[] };
type SheetImport = { id: string; file_name: string; row_count: number; imported_by: string; imported_at: string };
type SheetField = 'lineId' | 'countedQuantity' | 'reason';
const kinds = [
  ['full_warehouse', 'Full warehouse'], ['cycle', 'Cycle count'], ['bin', 'Bin count'], ['raw_material', 'Raw materials'],
  ['book_edition', 'Book edition'], ['fair_closing', 'Book fair closing'], ['investigation', 'Special investigation'],
] as const;

export function InventoryCountPlanPanel({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [sheetImports, setSheetImports] = useState<SheetImport[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<Record<string, string>[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [sheetMapping, setSheetMapping] = useState<Record<SheetField, string>>({ lineId: 'lineId', countedQuantity: 'countedQuantity', reason: 'reason' });
  const [planNumber, setPlanNumber] = useState(() => `CNT-${Date.now()}`);
  const [countType, setCountType] = useState<Plan['count_type']>('cycle');
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [teamUserIds, setTeamUserIds] = useState<string[]>([]);
  const [itemId, setItemId] = useState('');
  const [lotValue, setLotValue] = useState('');
  const [lots, setLots] = useState<Lot[]>([]);
  const [scope, setScope] = useState<Scope[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canManage = role === 'Owner' || permissions.includes('workspace.update');

  async function load() {
    const [itemResult, warehouseResult, memberResult, planResult, me] = await Promise.all([
      api<{ data: Item[] }>('/items'), api<{ data: Warehouse[] }>('/warehouses'),
      api<{ data: Member[] }>('/inventory/count-team-members'), api<{ data: Plan[] }>('/inventory/count-plans'),
      api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me'),
    ]);
    setItems(itemResult.data); setWarehouses(warehouseResult.data); setMembers(memberResult.data); setPlans(planResult.data);
    setUserId(me.data.userId); setRole(me.data.role); setPermissions(me.data.permissions);
    setSupervisorId(current => current || me.data.userId); setTeamUserIds(current => current.length ? current : [me.data.userId]);
    setWarehouseId(current => current || warehouseResult.data[0]?.id || ''); setItemId(current => current || itemResult.data[0]?.id || '');
  }
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load count plans')); }, []);
  useEffect(() => {
    setLotValue(''); setLots([]);
    if (!itemId || !warehouseId || items.find(item => item.id === itemId)?.tracking_policy !== 'lot') return;
    void api<{ data: Lot[] }>(`/inventory/lots?itemId=${itemId}&warehouseId=${warehouseId}`).then(result => setLots(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load lots'));
  }, [itemId, warehouseId, items]);
  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(success); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function openPlan(id: string) {
    await run(async () => {
      const [plan, imports] = await Promise.all([api<{ data: Plan }>(`/inventory/count-plans/${id}`), api<{ data: SheetImport[] }>(`/inventory/count-plans/${id}/imports`)]);
      setSelectedPlan(plan.data); setSheetImports(imports.data); setSheetRows([]); setSheetHeaders([]); setSheetName('');
    }, 'Count sheet loaded');
  }
  function downloadSheet() {
    if (!selectedPlan?.lines) return;
    const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['lineId', 'itemCode', 'lotNumber', 'binLocation', 'frozenQuantity', 'countedQuantity', 'reason'], ...selectedPlan.lines.map(line => [line.id, line.item_code, line.lot_number, line.bin_location, line.snapshot_quantity, '', ''])];
    const url = URL.createObjectURL(new Blob([`\uFEFF${rows.map(row => row.map(cell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `count-${selectedPlan.plan_number}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function uploadSheet(file?: File) {
    if (!file) return;
    setError(''); setNotice('');
    try {
      if (file.size > 1024 * 1024) throw new Error('Count CSV must be at most 1 MB');
      const parsed = parseInventoryOpeningCsv(await file.text());
      setSheetName(file.name); setSheetHeaders(parsed.headers); setSheetRows(parsed.rows);
      setSheetMapping({ lineId: parsed.headers.includes('lineId') ? 'lineId' : '', countedQuantity: parsed.headers.includes('countedQuantity') ? 'countedQuantity' : '', reason: parsed.headers.includes('reason') ? 'reason' : '' });
    } catch (reason) { setSheetRows([]); setSheetHeaders([]); setError(reason instanceof Error ? reason.message : 'Could not read count CSV'); }
  }
  const sheetPreview = sheetRows.map((row, index) => {
    const lineId = row[sheetMapping.lineId] || '', countedQuantity = row[sheetMapping.countedQuantity] || '', reason = row[sheetMapping.reason] || '';
    const line = selectedPlan?.lines?.find(item => item.id === lineId);
    const errors: string[] = [];
    if (!line) errors.push('Line is not on this count plan');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(countedQuantity)) errors.push('Use a nonnegative quantity with at most four decimals');
    if (line && countedQuantity && Number(countedQuantity) !== Number(line.snapshot_quantity) && !reason.trim()) errors.push('Explain the variance');
    if (sheetRows.some((other, position) => position < index && other[sheetMapping.lineId] === lineId)) errors.push('Duplicate line');
    return { index: index + 2, lineId, itemCode: line?.item_code || '', countedQuantity, reason, errors };
  });
  async function importSheet() {
    if (!selectedPlan) return;
    await run(async () => {
      await api(`/inventory/count-plans/${selectedPlan.id}/imports`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ fileName: sheetName, lines: sheetPreview.map(row => ({ lineId: row.lineId, countedQuantity: row.countedQuantity, reason: row.reason || null })) }) });
      const [plan, imports] = await Promise.all([api<{ data: Plan }>(`/inventory/count-plans/${selectedPlan.id}`), api<{ data: SheetImport[] }>(`/inventory/count-plans/${selectedPlan.id}/imports`)]);
      setSelectedPlan(plan.data); setSheetImports(imports.data); setSheetRows([]); setSheetHeaders([]); setSheetName(''); await load();
    }, 'Count sheet imported atomically with line evidence');
  }
  function addScope() {
    if (!itemId) return;
    const item = items.find(row => row.id === itemId);
    const allocation = lotValue ? JSON.parse(lotValue) as [string, string | null] : null;
    if (item?.tracking_policy === 'lot' && !allocation) { setError('Choose a lot and bin for this tracked item'); return; }
    const next = { itemId, lotNumber: allocation?.[0] ?? null, binLocation: allocation?.[1] ?? null };
    if (scope.some(row => row.itemId === next.itemId && row.lotNumber === next.lotNumber && row.binLocation === next.binLocation)) { setError('This item and lot is already in the scope'); return; }
    setScope(current => [...current, next]); setError('');
  }
  async function createPlan() {
    await run(async () => {
      const result = await api<{ data: { id: string } }>('/inventory/count-plans', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ planNumber: planNumber.trim(), countType, plannedDate, warehouseId, supervisorId, teamUserIds, lines: countType === 'full_warehouse' ? [] : scope }) });
      await load(); setSelectedPlan((await api<{ data: Plan }>(`/inventory/count-plans/${result.data.id}`)).data); setPlanNumber(`CNT-${Date.now()}`); setScope([]);
    }, 'Stock count plan scheduled');
  }
  async function transition(action: 'start' | 'submit' | 'cancel') {
    if (!selectedPlan) return;
    const reason = action === 'cancel' ? window.prompt('Why is this count being cancelled?') : null;
    if (action === 'cancel' && (!reason || reason.trim().length < 10)) return;
    await run(async () => {
      await api(`/inventory/count-plans/${selectedPlan.id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(action === 'cancel' ? { reason: reason!.trim() } : {}) });
      setSelectedPlan((await api<{ data: Plan }>(`/inventory/count-plans/${selectedPlan.id}`)).data); await load();
      if (action === 'submit') await onSubmitted();
    }, action === 'submit' ? 'Count sent for independent variance approval' : action === 'start' ? 'Count started; scoped stock is frozen' : 'Count cancelled; stock freeze released');
  }
  async function recordLine(lineId: string) {
    if (!selectedPlan) return;
    await run(async () => {
      await api(`/inventory/count-plans/${selectedPlan.id}/lines/${lineId}/count`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ countedQuantity: quantities[lineId], reason: reasons[lineId]?.trim() || null }) });
      setSelectedPlan((await api<{ data: Plan }>(`/inventory/count-plans/${selectedPlan.id}`)).data);
      setQuantities(current => ({ ...current, [lineId]: '' })); setReasons(current => ({ ...current, [lineId]: '' })); await load();
    }, 'Physical count recorded with revision history');
  }
  return <section className="panel catalog-form">
    <h2 className="section-title">Scheduled stock count plans</h2>
    <p className="muted">Starting a plan freezes on-hand stock, reservations and cost for its item and warehouse scopes. Assigned team members record counts; the supervisor submits every completed line for independent review.</p>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}
    {canCreate && <div className="panel catalog-form"><h3>Create count plan</h3><div className="catalog-form-grid">
      <label className="field">Plan number<input className="input" value={planNumber} maxLength={80} onChange={event => setPlanNumber(event.target.value)} /></label>
      <label className="field">Count type<select className="input" value={countType} onChange={event => setCountType(event.target.value)}>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field">Scheduled date<input className="input" type="date" value={plannedDate} onChange={event => setPlannedDate(event.target.value)} /></label>
      <label className="field">Warehouse<select className="input" value={warehouseId} onChange={event => { setWarehouseId(event.target.value); setScope([]); }}><option value="">Select warehouse</option>{warehouses.filter(row => row.status === 'active').map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <label className="field">Supervisor<select className="input" value={supervisorId} onChange={event => { setSupervisorId(event.target.value); setTeamUserIds(current => current.includes(event.target.value) ? current : [...current, event.target.value]); }}><option value="">Select supervisor</option>{members.map(row => <option key={row.id} value={row.id}>{row.display_name} · {row.email}</option>)}</select></label>
    </div><fieldset className="field"><legend>Assigned count team</legend><div className="button-row">{members.map(row => <label key={row.id}><input type="checkbox" checked={teamUserIds.includes(row.id)} disabled={row.id === supervisorId} onChange={event => setTeamUserIds(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} /> {row.display_name}</label>)}</div></fieldset>
    {countType !== 'full_warehouse' && <><div className="catalog-form-grid"><label className="field">Scope item<select className="input" value={itemId} onChange={event => setItemId(event.target.value)}><option value="">Select item</option>{items.map(row => <option key={row.id} value={row.id}>{row.item_code} · {row.name}</option>)}</select></label>{items.find(row => row.id === itemId)?.tracking_policy === 'lot' && <label className="field">Lot and bin<select className="input" value={lotValue} onChange={event => setLotValue(event.target.value)}><option value="">Select lot</option>{lots.map(row => <option key={`${row.lot_number}:${row.bin_location}`} value={JSON.stringify([row.lot_number, row.bin_location])}>{row.lot_number} / {row.bin_location || 'Unassigned'} / {row.on_hand_qty}</option>)}</select></label>}<button className="btn" disabled={!itemId || scope.length >= 200} onClick={addScope}>Add scope line</button></div><div className="button-row">{scope.map((row, index) => <button key={`${row.itemId}:${row.lotNumber}:${row.binLocation}`} className="btn" onClick={() => setScope(current => current.filter((_, position) => position !== index))}>{items.find(item => item.id === row.itemId)?.item_code} {row.lotNumber || ''} {row.binLocation || ''} ×</button>)}</div></>}
    <button className="btn btn-primary" disabled={busy || !planNumber.trim() || !warehouseId || !supervisorId || (countType !== 'full_warehouse' && !scope.length)} onClick={() => void createPlan()}>Schedule count</button></div>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Plan</th><th>Type</th><th>Warehouse</th><th>Scheduled</th><th>Progress</th><th>Status</th><th>Action</th></tr></thead><tbody>{plans.length ? plans.map(plan => <tr key={plan.id}><td>{plan.plan_number}</td><td>{plan.count_type.replaceAll('_', ' ')}</td><td>{plan.warehouse_code}</td><td>{String(plan.planned_date).slice(0, 10)}</td><td>{Number(plan.counted_count || 0)} / {Number(plan.line_count || 0)} counted · {Number(plan.approved_count || 0)} approved</td><td>{plan.status.replaceAll('_', ' ')}</td><td><button className="btn" disabled={busy} onClick={() => void openPlan(plan.id)}>Open sheet</button></td></tr>) : <tr><td colSpan={7} className="empty">No scheduled count plans.</td></tr>}</tbody></table></div>
    {selectedPlan && <div className="panel catalog-form"><h3>{selectedPlan.plan_number} · {selectedPlan.status.replaceAll('_', ' ')}</h3><p className="muted">{selectedPlan.warehouse_code} · {selectedPlan.count_type.replaceAll('_', ' ')} · {selectedPlan.lines?.length ?? 0} scope lines</p><div className="button-row">{canManage && (selectedPlan.supervisor_id === userId || role === 'Owner') && selectedPlan.status === 'planned' && <button className="btn btn-primary" disabled={busy} onClick={() => void transition('start')}>Start and freeze scope</button>}{canManage && (selectedPlan.supervisor_id === userId || role === 'Owner') && selectedPlan.status === 'in_progress' && <button className="btn btn-primary" disabled={busy || selectedPlan.lines?.some(line => line.counted_quantity == null)} onClick={() => void transition('submit')}>Submit for approval</button>}{canManage && (selectedPlan.supervisor_id === userId || role === 'Owner') && ['planned', 'in_progress'].includes(selectedPlan.status) && <button className="btn" disabled={busy} onClick={() => void transition('cancel')}>Cancel count</button>}</div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Lot / bin</th><th>Frozen book qty</th><th>Counted</th><th>Evidence</th><th>Action</th></tr></thead><tbody>{selectedPlan.lines?.length ? selectedPlan.lines.map(line => <tr key={line.id}><td>{line.item_code} · {line.item_name}</td><td>{line.lot_number || '—'} / {line.bin_location || '—'}</td><td>{line.snapshot_quantity ?? 'Not started'}</td><td>{line.counted_quantity ?? 'Pending'}</td><td>{line.evidence.map(row => <div key={row.revision}>#{row.revision}: {row.counted_quantity} · {String(row.counted_at).slice(0, 19)}{row.reason ? ` · ${row.reason}` : ''}</div>)}</td><td>{selectedPlan.status === 'in_progress' && canCreate && selectedPlan.teamUserIds.includes(userId) ? <><label className="field">Physical quantity<input className="input" type="number" min="0" step="0.0001" value={quantities[line.id] ?? ''} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} /></label><label className="field">Variance / recount reason<input className="input" maxLength={500} value={reasons[line.id] ?? ''} onChange={event => setReasons(current => ({ ...current, [line.id]: event.target.value }))} /></label><button className="btn" disabled={busy || quantities[line.id] === undefined || quantities[line.id] === ''} onClick={() => void recordLine(line.id)}>Record count</button></> : line.stock_count_id ? <Link className="btn" href="/inventory-warehouse/stock-count-variance-approval">{line.decision_status?.replaceAll('_', ' ') || 'Review variance'}</Link> : '—'}</td></tr>) : <tr><td colSpan={6} className="empty">Scope lines are generated when a full-warehouse count starts.</td></tr>}</tbody></table></div>
      {selectedPlan.status === 'in_progress' && canCreate && selectedPlan.teamUserIds.includes(userId) && <section className="panel catalog-form"><h4>Import count sheet</h4><p className="muted">Download this plan's line IDs, record physical counts in the CSV, then map and preview the columns. The server writes every valid row in one transaction and rejects a repeated sheet.</p><div className="button-row"><button className="btn" onClick={downloadSheet}>Download count CSV template</button><label className="field">Count CSV<input className="input" type="file" accept=".csv,text/csv" onChange={event => void uploadSheet(event.target.files?.[0])} /></label></div>{sheetHeaders.length > 0 && <><div className="catalog-form-grid">{(['lineId', 'countedQuantity', 'reason'] as const).map(field => <label className="field" key={field}>{field}<select className="input" value={sheetMapping[field]} onChange={event => setSheetMapping(current => ({ ...current, [field]: event.target.value }))}><option value="">{field === 'reason' ? 'No reason column' : 'Select column'}</option>{sheetHeaders.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><p>{sheetPreview.length} rows · {sheetPreview.filter(row => row.errors.length).length} invalid</p><div className="table-wrap"><table className="data-table"><thead><tr><th>CSV row</th><th>Item</th><th>Line ID</th><th>Counted</th><th>Validation</th></tr></thead><tbody>{sheetPreview.slice(0, 100).map(row => <tr key={row.index}><td>{row.index}</td><td>{row.itemCode}</td><td>{row.lineId}</td><td>{row.countedQuantity}</td><td>{row.errors.join('; ') || 'Valid'}</td></tr>)}</tbody></table></div><button className="btn btn-primary" disabled={busy || !sheetPreview.length || sheetPreview.length > 200 || sheetPreview.some(row => row.errors.length) || !sheetMapping.lineId || !sheetMapping.countedQuantity} onClick={() => void importSheet()}>Import validated count sheet</button></>}</section>}
      <h4>Count sheet import history</h4><div className="table-wrap"><table className="data-table"><thead><tr><th>File</th><th>Rows</th><th>Imported</th><th>By</th></tr></thead><tbody>{sheetImports.length ? sheetImports.map(row => <tr key={row.id}><td>{row.file_name}</td><td>{row.row_count}</td><td>{String(row.imported_at).slice(0, 19)}</td><td>{row.imported_by.slice(0, 8)}</td></tr>) : <tr><td colSpan={4} className="empty">No imported count sheets.</td></tr>}</tbody></table></div>
    </div>}
  </section>;
}
