"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Dispatch = { id: string; invoice_number: string; item_code: string; warehouse_code: string; quantity: string; status: string; created_by: string; unit_cost: string | null; cost_amount: string | null; created_at: string; review_reason: string | null };
type InvoiceLine = { id: string; book_title: string; edition_id: string | null; quantity: number; sale_type: string; settlement_status: string };
type Invoice = { invoice_number: string; lines: InvoiceLine[] };
type Stock = { warehouse_id: string; warehouse_code: string; warehouse_name: string; available_qty: string; on_hand_qty: string; reserved_qty: string; tracking_policy: string };

export function SalesDispatchScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Dispatch[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineId, setLineId] = useState('');
  const [stock, setStock] = useState<Stock[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lotNumber, setLotNumber] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [reason, setReason] = useState('');
  const [identity, setIdentity] = useState<{ userId: string; role: string; permissions: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedLine = invoice?.lines.find(line => line.id === lineId);
  const selectedStock = stock.find(row => row.warehouse_id === warehouseId);
  const canManage = identity?.role === 'Owner' || identity?.permissions.includes('sales.manage');
  const canReject = identity?.role === 'Owner' || identity?.permissions.includes('sales.approve');
  const canApprove = (identity?.role === 'Owner' || identity?.permissions.includes('sales.approve')) && (identity?.role === 'Owner' || identity?.permissions.includes('finance.read'));
  async function load() { setRows((await api<{ data: Dispatch[] }>('/inventory/sales-dispatches')).data); }
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load dispatches')); void api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me').then(result => setIdentity(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load permissions')); }, []);
  useEffect(() => {
    if (!selectedLine?.edition_id) { setStock([]); setWarehouseId(''); return; }
    let active = true;
    void api<{ data: Stock[] }>(`/inventory/sales-dispatches/options?editionId=${selectedLine.edition_id}`).then(result => { if (active) { setStock(result.data); setWarehouseId(''); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load stock'); });
    return () => { active = false; };
  }, [selectedLine?.edition_id]);
  async function lookup() {
    setBusy(true); setError(''); setInvoice(null); setLineId('');
    try { setInvoice((await api<{ data: Invoice }>(`/sales-sources/invoices/by-number/${encodeURIComponent(invoiceNumber.trim())}`)).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not find posted invoice'); }
    finally { setBusy(false); }
  }
  async function requestDispatch() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/inventory/sales-dispatches', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ invoiceLineId: lineId, warehouseId, quantity, lotNumber: lotNumber.trim() || null, binLocation: binLocation.trim() || null }) });
      setNotice('Dispatch request submitted for independent stock review.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request dispatch'); }
    finally { setBusy(false); }
  }
  async function review(id: string, action: 'approve' | 'reject') {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/inventory/sales-dispatches/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: reason.trim() }) });
      setNotice(action === 'approve' ? 'Stock issue and COGS journal posted.' : 'Dispatch request rejected.'); setReason(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review dispatch'); }
    finally { setBusy(false); }
  }
  const eligibleLines = invoice?.lines.filter(line => line.edition_id && ['normal', 'standard'].includes(line.sale_type) && line.settlement_status === 'settled') ?? [];
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">Invoice-linked stock issue requests, independent review and posted COGS records.</p></div><button className="btn" onClick={() => void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not refresh dispatches'))}>Refresh</button></div>
    <p className="panel">This register uses the existing posted-invoice stock workflow. Order-linked picking, carrier tracking and delivery confirmation are still pending.</p>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    <section className="panel catalog-form"><h2 className="section-title">Request stock dispatch</h2><div className="catalog-form-grid"><label className="field">Posted invoice number<input className="input" value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} /></label><button className="btn" disabled={busy || invoiceNumber.trim().length < 2} onClick={() => void lookup()}>Load invoice lines</button></div>
      {invoice && <><div className="catalog-form-grid"><label className="field">Eligible invoice line<select className="input" value={lineId} onChange={event => { setLineId(event.target.value); setWarehouseId(''); }}><option value="">Select book line</option>{eligibleLines.map(line => <option key={line.id} value={line.id}>{line.book_title} - {line.quantity} invoiced copies</option>)}</select></label><label className="field">Warehouse and available stock<select className="input" value={warehouseId} onChange={event => setWarehouseId(event.target.value)}><option value="">Select warehouse</option>{stock.map(row => <option key={row.warehouse_id} value={row.warehouse_id}>{row.warehouse_code} - {row.available_qty} available</option>)}</select></label></div>
        {invoice && !eligibleLines.length && <p className="muted">No settled, normal, edition-linked invoice lines can use this stock workflow.</p>}
        <div className="catalog-form-grid"><label className="field">Dispatch quantity<input className="input" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><label className="field">Lot number<input className="input" value={lotNumber} onChange={event => setLotNumber(event.target.value)} /></label><label className="field">Bin location<input className="input" value={binLocation} onChange={event => setBinLocation(event.target.value)} /></label></div>
        {selectedStock && <p className="muted">On hand {selectedStock.on_hand_qty}, reserved {selectedStock.reserved_qty}, available {selectedStock.available_qty}. Tracking: {selectedStock.tracking_policy}.</p>}
        <button className="btn btn-primary" disabled={!canManage || busy || !lineId || !warehouseId || !Number.isInteger(quantity) || quantity <= 0 || quantity > Number(selectedStock?.available_qty ?? 0) || (selectedStock?.tracking_policy === 'lot' && !lotNumber.trim())} onClick={() => void requestDispatch()}>Submit dispatch request</button></>}
    </section>
    <section className="panel catalog-form"><h2 className="section-title">Dispatch requests and postings</h2><label className="field">Review reason (at least 10 characters)<input className="input" value={reason} onChange={event => setReason(event.target.value)} /></label><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Item</th><th>Warehouse</th><th>Quantity</th><th>Status</th><th>COGS</th><th>Review</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.invoice_number}</td><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.quantity}</td><td>{row.status}</td><td>{row.cost_amount ?? 'Not posted'}</td><td>{row.status === 'pending_approval' && row.created_by !== identity?.userId ? <div className="button-row"><button className="btn btn-primary" disabled={!canApprove || busy || reason.trim().length < 10} onClick={() => void review(row.id, 'approve')}>Approve and post</button><button className="btn" disabled={!canReject || busy || reason.trim().length < 10} onClick={() => void review(row.id, 'reject')}>Reject</button></div> : row.review_reason || '-'}</td></tr>) : <tr><td colSpan={7} className="empty">No Sales dispatch requests yet.</td></tr>}</tbody></table></div></section>
  </>;
}
