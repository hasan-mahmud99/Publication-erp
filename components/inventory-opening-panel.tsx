"use client";

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { parseInventoryOpeningCsv } from '@/lib/inventory-opening-csv';

type Item = { id: string; item_code: string; name: string; tracking_policy: string };
type Warehouse = { id: string; code: string; name: string; status: string };
type Account = { id: string; account_code: string; name: string; account_type: string; is_active: number };
type Opening = { id: string; reference_code: string; opening_date: string; stock_value: string; line_count: number; status: string; reason: string; rejection_reason: string | null; created_by: string; transaction_id: string | null; journal_id: string | null };
type Mapping = Record<'itemCode' | 'warehouseCode' | 'lotNumber' | 'binLocation' | 'quantity' | 'unitCost', string>;
const fields: Array<{ key: keyof Mapping; label: string; required: boolean }> = [
  { key: 'itemCode', label: 'Item code', required: true }, { key: 'warehouseCode', label: 'Warehouse code', required: true },
  { key: 'lotNumber', label: 'Lot number', required: false }, { key: 'binLocation', label: 'Bin location', required: false },
  { key: 'quantity', label: 'Quantity', required: true }, { key: 'unitCost', label: 'Unit cost', required: true },
];
const emptyMapping: Mapping = { itemCode: '', warehouseCode: '', lotNumber: '', binLocation: '', quantity: '', unitCost: '' };
const decimal4 = /^(0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
function downloadTemplate() {
  const content = 'itemCode,warehouseCode,lotNumber,binLocation,quantity,unitCost\r\n';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'inventory-opening-template.csv'; link.click(); URL.revokeObjectURL(url);
}
export function InventoryOpeningPanel({ items, warehouses, onPosted }: { items: Item[]; warehouses: Warehouse[]; onPosted: () => Promise<void> }) {
  const [canRead, setCanRead] = useState(false), [canCreate, setCanCreate] = useState(false), [canApprove, setCanApprove] = useState(false);
  const [userId, setUserId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]), [openings, setOpenings] = useState<Opening[]>([]);
  const [headers, setHeaders] = useState<string[]>([]), [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>(emptyMapping);
  const [referenceCode, setReferenceCode] = useState(''), [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(''), [reviewReason, setReviewReason] = useState('');
  const [inventoryAccountId, setInventoryAccountId] = useState(''), [offsetAccountId, setOffsetAccountId] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    void api<{ data: { role: string; userId: string; permissions: string[] } }>('/auth/me').then(async result => {
      const { role, permissions } = result.data;
      const finance = role === 'Owner' || permissions.includes('finance.read');
      setCanRead(finance); setCanCreate(finance && (role === 'Owner' || permissions.includes('workspace.create')));
      setCanApprove(finance && (role === 'Owner' || permissions.includes('workspace.approve'))); setUserId(result.data.userId);
      if (finance) {
        const [chart, register] = await Promise.all([api<{ data: Account[] }>('/accounts/chart'), api<{ data: Opening[] }>('/inventory/openings')]);
        setAccounts(chart.data); setOpenings(register.data);
      }
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load opening stock'));
  }, []);
  const preview = useMemo(() => {
    const itemByCode = new Map(items.map(row => [row.item_code.toLowerCase(), row]));
    const warehouseByCode = new Map(warehouses.map(row => [row.code.toLowerCase(), row]));
    const seen = new Set<string>(); let total = 0;
    const lines = rows.map((raw, index) => {
      const value = (key: keyof Mapping) => mapping[key] ? (raw[mapping[key]] || '').trim() : '';
      const itemCode = value('itemCode'), warehouseCode = value('warehouseCode'), lotNumber = value('lotNumber'), binLocation = value('binLocation');
      const quantity = value('quantity'), unitCost = value('unitCost');
      const item = itemByCode.get(itemCode.toLowerCase()), warehouse = warehouseByCode.get(warehouseCode.toLowerCase());
      const errors: string[] = [];
      if (!item) errors.push('Unknown item');
      if (!warehouse || warehouse.status !== 'active') errors.push('Unknown or inactive warehouse');
      if (!decimal4.test(quantity) || Number(quantity) <= 0) errors.push('Invalid positive quantity');
      if (!decimal4.test(unitCost) || Number(unitCost) <= 0) errors.push('Invalid positive unit cost');
      if (item?.tracking_policy === 'lot' && !lotNumber) errors.push('Lot required');
      if (item?.tracking_policy === 'none' && (lotNumber || binLocation)) errors.push('Untracked item cannot have lot/bin');
      if (item && !['none', 'lot'].includes(item.tracking_policy)) errors.push('Unsupported tracking policy');
      const key = `${item?.id}:${warehouse?.id}:${lotNumber.toLowerCase()}:${binLocation.toLowerCase()}`;
      if (seen.has(key)) errors.push('Duplicate item/warehouse/lot/bin row'); else seen.add(key);
      if (!errors.length) total += Number(quantity) * Number(unitCost);
      return { index: index + 2, itemCode, warehouseCode, lotNumber, binLocation, quantity, unitCost, itemId: item?.id, warehouseId: warehouse?.id, errors };
    });
    return { lines, errors: lines.filter(row => row.errors.length).length, estimatedValue: total.toFixed(2) };
  }, [items, warehouses, rows, mapping]);
  async function upload(file?: File) {
    if (!file) return;
    setError(''); setNotice('');
    try {
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2_000_000) throw new Error('Choose a CSV file of at most 2 MB');
      const parsed = parseInventoryOpeningCsv(await file.text()); setHeaders(parsed.headers); setRows(parsed.rows);
      setMapping(Object.fromEntries(fields.map(field => [field.key, parsed.headers.find(header => header.replace(/[^a-z0-9]/gi, '').toLowerCase() === field.key.toLowerCase()) ?? ''])) as Mapping);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not parse CSV'); }
  }
  async function submit() {
    setBusy(true); setError(''); setNotice('');
    try {
      const lines = preview.lines.map(row => ({ itemId: row.itemId, warehouseId: row.warehouseId, lotNumber: row.lotNumber || undefined, binLocation: row.binLocation || undefined, quantity: row.quantity, unitCost: row.unitCost }));
      await api('/inventory/openings', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ referenceCode: referenceCode.trim(), openingDate, reason: reason.trim(), inventoryAccountId, offsetAccountId, lines }) });
      setRows([]); setHeaders([]); setNotice('Opening stock submitted for independent approval');
      setOpenings((await api<{ data: Opening[] }>('/inventory/openings')).data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Opening stock submission failed'); }
    finally { setBusy(false); }
  }
  async function decide(id: string, action: 'approve' | 'reject') {
    if (!window.confirm(action === 'approve' ? 'Approve all opening rows and post the inventory and Finance journal?' : 'Reject this opening batch?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/inventory/openings/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, ...(action === 'reject' ? { body: JSON.stringify({ reason: reviewReason.trim() }) } : {}) });
      setReviewReason(''); setOpenings((await api<{ data: Opening[] }>('/inventory/openings')).data); await onPosted();
      setNotice(action === 'approve' ? 'Opening stock and Finance journal posted' : 'Opening stock rejected');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Opening stock review failed'); }
    finally { setBusy(false); }
  }
  if (!canRead) return <section className="panel catalog-form"><h2 className="section-title">Opening stock</h2><p className="muted">Finance access is required for opening stock review and posting.</p>{error && <p className="alert-error">{error}</p>}</section>;
  return <section className="panel catalog-form"><h2 className="section-title">Controlled opening stock import</h2><p className="muted">Use a CSV with one item, warehouse, lot and bin per row. The preview validates current master data. A separate Finance reviewer must approve the entire batch before any movement or journal posts. Existing balances and posted movements cannot be overwritten.</p>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{canCreate && <><div className="button-row"><button className="btn" onClick={downloadTemplate}>Download CSV template</button><label className="field">Opening CSV<input className="input" type="file" accept=".csv,text/csv" onChange={event => void upload(event.target.files?.[0])} /></label></div>{headers.length > 0 && <><h3>Map CSV columns</h3><div className="catalog-form-grid">{fields.map(field => <label className="field" key={field.key}>{field.label}{field.required ? ' *' : ''}<select className="input" value={mapping[field.key]} onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value }))}><option value="">{field.required ? 'Select column' : 'None'}</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><p>{preview.lines.length} rows · {preview.errors} invalid · Estimated valid value {preview.estimatedValue} BDT</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Row</th><th>Item</th><th>Warehouse</th><th>Lot / bin</th><th>Quantity</th><th>Unit cost</th><th>Validation</th></tr></thead><tbody>{preview.lines.slice(0, 100).map(row => <tr key={row.index}><td>{row.index}</td><td>{row.itemCode}</td><td>{row.warehouseCode}</td><td>{row.lotNumber || '—'} / {row.binLocation || '—'}</td><td>{row.quantity}</td><td>{row.unitCost}</td><td>{row.errors.length ? row.errors.join('; ') : 'Valid'}</td></tr>)}</tbody></table></div><p className="muted">First 100 rows shown. The server revalidates all rows and the reviewer rechecks stock before posting.</p></>}
      <div className="catalog-form-grid"><label className="field">Batch reference<input className="input" value={referenceCode} onChange={event => setReferenceCode(event.target.value)} /></label><label className="field">Opening date<input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={openingDate} onChange={event => setOpeningDate(event.target.value)} /></label><label className="field">Reason and source evidence<input className="input" value={reason} minLength={10} maxLength={1000} onChange={event => setReason(event.target.value)} /></label><label className="field">Inventory asset<select className="input" value={inventoryAccountId} onChange={event => setInventoryAccountId(event.target.value)}><option value="">Select account</option>{accounts.filter(row => row.is_active && row.account_type === 'asset').map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label><label className="field">Opening equity offset<select className="input" value={offsetAccountId} onChange={event => setOffsetAccountId(event.target.value)}><option value="">Select account</option>{accounts.filter(row => row.is_active && row.account_type === 'equity').map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy || !rows.length || preview.errors > 0 || fields.some(field => field.required && !mapping[field.key]) || referenceCode.trim().length < 3 || reason.trim().length < 10 || !inventoryAccountId || !offsetAccountId || inventoryAccountId === offsetAccountId} onClick={() => void submit()}>Submit opening batch</button></>}
    <h3 className="section-title">Opening batches</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Rows</th><th>Value</th><th>Status</th><th>Ledger</th><th>Review</th></tr></thead><tbody>{openings.length ? openings.map(row => <tr key={row.id}><td>{row.reference_code}</td><td>{String(row.opening_date).slice(0, 10)}</td><td>{row.line_count}</td><td>{row.stock_value}</td><td>{row.status.replaceAll('_', ' ')}{row.rejection_reason && <> · {row.rejection_reason}</>}</td><td>{row.transaction_id?.slice(0, 8) ?? '—'}{row.journal_id && <> / GL {row.journal_id.slice(0, 8)}</>}</td><td>{row.status === 'pending_approval' && canApprove && row.created_by !== userId ? <><label className="field">Rejection reason<input className="input" value={reviewReason} minLength={10} maxLength={1000} onChange={event => setReviewReason(event.target.value)} /></label><div className="button-row"><button className="btn" disabled={busy || reviewReason.trim().length < 10} onClick={() => void decide(row.id, 'reject')}>Reject</button><button className="btn btn-primary" disabled={busy} onClick={() => void decide(row.id, 'approve')}>Approve &amp; post</button></div></> : row.status === 'pending_approval' && row.created_by === userId ? 'Independent review required' : '—'}</td></tr>) : <tr><td colSpan={7} className="empty">No opening stock batches.</td></tr>}</tbody></table></div>
  </section>;
}
