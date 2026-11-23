"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Warehouse = { id: string; code: string; warehouse_type: string; status: string };
type Account = { id: string; account_code: string; name: string; account_type: string; is_active: number };
type Dispatch = { id: string; invoice_line_id: string; item_code: string; invoice_number: string; warehouse_code: string; lot_number: string | null; bin_location: string | null; quantity: string; status: string; cost_amount: string | null; created_by: string };
type Receipt = { id: string; return_line_id: string; dispatch_id: string; return_number: string; item_code: string; warehouse_code: string; condition_code: string; quantity: string; status: string; cost_amount: string | null; created_by: string };
type Invoice = { id: string; invoice_number: string; status: string; lines: Array<{ id: string; book_title: string; edition_id: string | null; quantity: number; sale_type: string; settlement_status: string }> };
type Return = { id: string; return_number: string; status: string; lines: Array<{ id: string; invoice_line_id: string; quantity: number }> };
type Lot = { lot_number: string; bin_location: string | null; on_hand_qty: string };

export function InventorySalesPanel({ mode, onPosted, requestOnly = false }: { mode: 'dispatch' | 'return'; onPosted: () => Promise<void>; requestOnly?: boolean }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mapping, setMapping] = useState<{ inventory_account_id: string; cogs_account_id: string } | null>(null);
  const [assetId, setAssetId] = useState('');
  const [cogsId, setCogsId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [returnId, setReturnId] = useState('');
  const [salesReturn, setSalesReturn] = useState<Return | null>(null);
  const [sourceLineId, setSourceLineId] = useState('');
  const [dispatchId, setDispatchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<'accepted' | 'damaged'>('accepted');
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotKey, setLotKey] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const allowed = (permission: string) => role === 'Owner' || permissions.includes(permission);
  const canManage = allowed('sales.manage');
  const canApprove = !requestOnly && allowed('sales.approve') && allowed('finance.read');
  const canConfigure = !requestOnly && allowed('workspace.update') && allowed('finance.read');

  async function load() {
    const [me, dispatchResult, receiptResult] = await Promise.all([
      api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me'),
      api<{ data: Dispatch[] }>('/inventory/sales-dispatches'),
      api<{ data: Receipt[] }>('/inventory/sales-return-receipts'),
    ]);
    setUserId(me.data.userId); setRole(me.data.role); setPermissions(me.data.permissions);
    setDispatches(dispatchResult.data); setReceipts(receiptResult.data);
    if (me.data.role === 'Owner' || me.data.permissions.includes('workspace.read')) {
      setWarehouses((await api<{ data: Warehouse[] }>('/warehouses')).data);
    }
    if (me.data.role === 'Owner' || (me.data.permissions.includes('finance.read') && me.data.permissions.includes('workspace.read'))) {
      const [accountResult, mappingResult] = await Promise.all([
        api<{ data: Account[] }>('/accounts/chart'),
        api<{ data: { inventory_account_id: string; cogs_account_id: string } | null }>('/inventory/sales-accounts'),
      ]);
      setAccounts(accountResult.data); setMapping(mappingResult.data);
      setAssetId(mappingResult.data?.inventory_account_id || ''); setCogsId(mappingResult.data?.cogs_account_id || '');
    }
  }
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load sales stock')); }, []);
  useEffect(() => {
    setLots([]); setLotKey('');
    if (mode !== 'dispatch' || !sourceLineId || !warehouseId) return;
    void api<{ data: Array<{ edition_id: string | null; id: string; tracking_policy: string }> }>('/items').then(async result => {
      const line = invoice?.lines.find(row => row.id === sourceLineId);
      const item = result.data.find(row => row.edition_id && row.edition_id === line?.edition_id);
      if (item?.tracking_policy === 'lot') setLots((await api<{ data: Lot[] }>(`/inventory/lots?itemId=${item.id}&warehouseId=${warehouseId}`)).data);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load available lots'));
  }, [mode, invoice, sourceLineId, warehouseId]);
  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(success); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function findSource() {
    await run(async () => {
      const term = (mode === 'dispatch' ? invoiceId : returnId).trim();
      const source = mode === 'dispatch' ? 'invoices' : 'returns';
      const suffix = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(term) ? encodeURIComponent(term) : `by-number/${encodeURIComponent(term)}`;
      if (mode === 'dispatch') { const result = (await api<{ data: Invoice }>(`/sales-sources/${source}/${suffix}`)).data; setInvoice(result); setSourceLineId(''); if (result.status !== 'posted') throw new Error('Invoice must be posted before dispatch'); }
      else { const result = (await api<{ data: Return }>(`/sales-sources/${source}/${suffix}`)).data; setSalesReturn(result); setSourceLineId(''); if (result.status !== 'posted') throw new Error('Sales return must be posted before receipt'); }
    }, 'Posted source loaded');
  }
  async function saveAccounts() {
    await run(async () => { await api('/inventory/sales-accounts', { method: 'PUT', body: JSON.stringify({ inventoryAccountId: assetId, cogsAccountId: cogsId }) }); await load(); }, 'Sales stock accounts configured');
  }
  async function request() {
    await run(async () => {
      const allocation = lotKey ? JSON.parse(lotKey) as [string, string | null] : null;
      const path = mode === 'dispatch' ? '/inventory/sales-dispatches' : '/inventory/sales-return-receipts';
      const body = mode === 'dispatch'
        ? { invoiceLineId: sourceLineId, warehouseId, quantity: Number(quantity), lotNumber: allocation?.[0] || null, binLocation: allocation?.[1] || null }
        : { returnLineId: sourceLineId, dispatchId, warehouseId, quantity: Number(quantity), condition };
      await api(path, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) });
      setQuantity(''); await load();
    }, 'Stock request sent for independent approval');
  }
  async function review(id: string, action: 'approve' | 'reject') {
    await run(async () => {
      const path = mode === 'dispatch' ? 'sales-dispatches' : 'sales-return-receipts';
      await api(`/inventory/${path}/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: reviewReason.trim() }) });
      await load(); if (action === 'approve') await onPosted();
    }, action === 'approve' ? 'Stock and accounting journal posted' : 'Request rejected');
  }
  const options = mode === 'dispatch' ? warehouses.filter(row => row.status === 'active' && ['finished_goods', 'fair'].includes(row.warehouse_type)) : warehouses.filter(row => row.status === 'active' && row.warehouse_type === (condition === 'accepted' ? 'finished_goods' : 'quarantine'));
  const sourceLines = mode === 'dispatch' ? invoice?.lines.filter(row => ['normal', 'standard'].includes(row.sale_type) && row.settlement_status === 'settled' && row.edition_id) || [] : salesReturn?.lines || [];
  const records = mode === 'dispatch' ? dispatches : receipts;
  return <>
    {error && <p className="alert alert-error" role="alert">{error}</p>}{notice && <p className="alert alert-success" role="status">{notice}</p>}
    {canConfigure && <section className="panel catalog-form"><h2 className="section-title">Sales stock accounting</h2><p className="muted">Approved dispatches debit COGS and credit inventory. Accepted or damaged returns reverse that cost at the original dispatch rate. An open fiscal period is required.</p>{!mapping && <div className="catalog-form-grid"><label className="field">Inventory asset<select className="input" value={assetId} onChange={event => setAssetId(event.target.value)}><option value="">Select asset</option>{accounts.filter(row => row.account_type === 'asset' && row.is_active).map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label><label className="field">Cost of goods sold<select className="input" value={cogsId} onChange={event => setCogsId(event.target.value)}><option value="">Select expense</option>{accounts.filter(row => row.account_type === 'expense' && row.is_active).map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label><button className="btn" disabled={busy || !assetId || !cogsId || assetId === cogsId} onClick={() => void saveAccounts()}>Save accounts</button></div>}{mapping && <p>Inventory: {accounts.find(row => row.id === mapping.inventory_account_id)?.account_code || mapping.inventory_account_id} · COGS: {accounts.find(row => row.id === mapping.cogs_account_id)?.account_code || mapping.cogs_account_id}</p>}</section>}
    {canManage && <section className="panel catalog-form"><h2 className="section-title">{mode === 'dispatch' ? 'Invoice-linked sales dispatch' : 'Approved customer return receipt'}</h2><p className="muted">{mode === 'dispatch' ? 'Use a posted invoice with a settled normal sale and an edition-linked finished book. Select a sellable warehouse and available lot if tracked.' : 'Use a posted sales return and its original posted dispatch. Accepted copies enter finished goods; damaged copies enter quarantine.'}</p><div className="catalog-form-grid"><label className="field">{mode === 'dispatch' ? 'Posted invoice number or ID' : 'Posted sales return number or ID'}<input className="input" value={mode === 'dispatch' ? invoiceId : returnId} onChange={event => mode === 'dispatch' ? setInvoiceId(event.target.value) : setReturnId(event.target.value)} placeholder="Enter posted source number" /></label><button className="btn" disabled={busy || !(mode === 'dispatch' ? invoiceId : returnId)} onClick={() => void findSource()}>Load posted source</button></div>{sourceLines.length > 0 && <div className="catalog-form-grid"><label className="field">Source line<select className="input" value={sourceLineId} onChange={event => setSourceLineId(event.target.value)}><option value="">Select line</option>{sourceLines.map(row => <option key={row.id} value={row.id}>{mode === 'dispatch' ? `${(row as Invoice['lines'][number]).book_title} · ${row.quantity} copies · ${row.id.slice(0, 8)}` : `${row.quantity} returned copies · ${row.id.slice(0, 8)}`}</option>)}</select></label>{mode === 'return' && <label className="field">Original posted dispatch<select className="input" value={dispatchId} onChange={event => setDispatchId(event.target.value)}><option value="">Select dispatch</option>{dispatches.filter(row => row.status === 'posted' && row.invoice_line_id === salesReturn?.lines.find(line => line.id === sourceLineId)?.invoice_line_id).map(row => <option key={row.id} value={row.id}>{row.item_code} · {row.quantity} copies · {row.id.slice(0, 8)}</option>)}</select></label>}{mode === 'return' && <label className="field">Condition<select className="input" value={condition} onChange={event => { setCondition(event.target.value as 'accepted' | 'damaged'); setWarehouseId(''); }}><option value="accepted">Accepted for sale</option><option value="damaged">Damaged / quarantine</option></select></label>}<label className="field">Warehouse<select className="input" value={warehouseId} onChange={event => setWarehouseId(event.target.value)}><option value="">Select warehouse</option>{options.map(row => <option key={row.id} value={row.id}>{row.code} · {row.warehouse_type}</option>)}</select></label>{mode === 'dispatch' && lots.length > 0 && <label className="field">Lot and bin<select className="input" value={lotKey} onChange={event => setLotKey(event.target.value)}><option value="">Select lot</option>{lots.map(row => <option key={`${row.lot_number}-${row.bin_location}`} value={JSON.stringify([row.lot_number, row.bin_location])}>{row.lot_number} · {row.bin_location || 'Unassigned'} · {row.on_hand_qty} on hand</option>)}</select></label>}<label className="field">Quantity<input className="input" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label></div>}{sourceLines.length > 0 && <button className="btn btn-primary" disabled={busy || !sourceLineId || !warehouseId || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 || (mode === 'return' && !dispatchId) || (mode === 'dispatch' && lots.length > 0 && !lotKey)} onClick={() => void request()}>Request independent approval</button>}</section>}
    <section className="panel catalog-form"><h2 className="section-title">{mode === 'dispatch' ? 'Sales dispatch register' : 'Customer return receipt register'}</h2>{canApprove && <label className="field">Review reason<input className="input" value={reviewReason} onChange={event => setReviewReason(event.target.value)} placeholder="At least 10 characters" /></label>}<div className="table-wrap"><table className="data-table"><thead><tr><th>Source</th><th>Item</th><th>Warehouse</th><th>Quantity</th><th>Condition / lot</th><th>Status</th><th>Cost</th><th>Action</th></tr></thead><tbody>{records.length ? records.map(row => <tr key={row.id}><td>{mode === 'dispatch' ? (row as Dispatch).invoice_number : (row as Receipt).return_number}</td><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.quantity}</td><td>{mode === 'dispatch' ? (row as Dispatch).lot_number || 'Untracked' : (row as Receipt).condition_code}</td><td>{row.status}</td><td>{row.cost_amount || 'Pending'}</td><td>{canApprove && row.status === 'pending_approval' && row.created_by !== userId ? <div className="button-row"><button className="btn btn-primary" disabled={busy || reviewReason.trim().length < 10} onClick={() => void review(row.id, 'approve')}>Approve and post</button><button className="btn" disabled={busy || reviewReason.trim().length < 10} onClick={() => void review(row.id, 'reject')}>Reject</button></div> : '—'}</td></tr>) : <tr><td colSpan={8} className="empty">No sales stock requests yet.</td></tr>}</tbody></table></div></section>
  </>;
}
