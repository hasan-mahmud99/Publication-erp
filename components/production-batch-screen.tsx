'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
const human = (value: string) => String(value || '').replaceAll('_', ' ');
export function ProductionBatchScreen({ screen }: { screen: Screen }) {
  const [orders, setOrders] = useState<Row[]>([]), [batches, setBatches] = useState<Row[]>([]), [detail, setDetail] = useState<Row | null>(null);
  const [orderId, setOrderId] = useState(''), [reference, setReference] = useState(''), [plannedQty, setPlannedQty] = useState(1), [start, setStart] = useState(''), [end, setEnd] = useState(''), [note, setNote] = useState('');
  const [canManage, setCanManage] = useState(false), [canApprove, setCanApprove] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const [orderResult, batchResult, me] = await Promise.all([api<{ data: { data: Row[] } }>('/production/print-orders?limit=100&offset=0'), api<{ data: Row[] }>('/production/batches'), api<{ data: { role: string; permissions: string[] } }>('/auth/me')]);
      setOrders(orderResult.data.data); setBatches(batchResult.data); setCanManage(me.data.role === 'Owner' || me.data.permissions.includes('production.manage')); setCanApprove(me.data.role === 'Owner' || me.data.permissions.includes('production.approve'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load production batches'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [screen.id]);
  async function open(id: string) { setError(''); try { setDetail((await api<{ data: Row }>(`/production/batches/${id}`)).data); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load batch history'); } }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const result = (await api<{ data: Row }>('/production/batches', { method: 'POST', body: JSON.stringify({ orderId, batchRef: reference, plannedQty, plannedStart: start, plannedEnd: end }) })).data; setDetail(result); setNotice('Production batch created. Operations, QC and receipts can now reference it.'); setReference(''); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create batch'); }
    finally { setBusy(false); }
  }
  async function close() {
    if (!detail) return; setBusy(true); setError(''); setNotice('');
    try { setDetail((await api<{ data: Row }>(`/production/batches/${detail.id}/close`, { method: 'POST', body: JSON.stringify({ note }) })).data); setNotice('Batch closed after independent reconciliation.'); setNote(''); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Batch cannot be closed'); }
    finally { setBusy(false); }
  }
  const selectedOrder = orders.find(row => row.id === orderId);
  const allocated = batches.filter(row => row.print_order_id === orderId).reduce((sum, row) => sum + Number(row.planned_qty), 0);
  return <><div className="page-heading"><div><h1 className="page-title">Production Batch History</h1><p className="muted">Trace partial print runs from material issue through operation, QC and finished-goods receipt.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}
    <section className="panel catalog-form"><label className="field">Print order<select className="input" value={orderId} onChange={event => { setOrderId(event.target.value); setDetail(null); const order = orders.find(row => row.id === event.target.value); setStart(String(order?.planned_start || '').slice(0, 10)); setEnd(String(order?.due_date || '').slice(0, 10)); }}><option value="">All orders</option>{orders.map(row => <option key={row.id} value={row.id}>{row.print_order_number} - {row.book_title}</option>)}</select></label>{selectedOrder && <p>{allocated} copies allocated to batches of {selectedOrder.planned_qty} planned.</p>}</section>
    {canManage && selectedOrder?.status === 'scheduled' && <section className="panel catalog-form"><h2 className="section-title">Open production batch</h2><form onSubmit={create}><div className="catalog-form-grid"><label className="field">Unique batch reference<input className="input" required value={reference} onChange={event => setReference(event.target.value)} /></label><label className="field">Batch planned copies<input className="input" required type="number" min="1" max={Number(selectedOrder.planned_qty) - allocated} value={plannedQty} onChange={event => setPlannedQty(Number(event.target.value))} /></label><label className="field">Planned start<input className="input" required type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label className="field">Planned end<input className="input" required type="date" value={end} onChange={event => setEnd(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || allocated >= Number(selectedOrder.planned_qty)}>Create batch</button></form></section>}
    <section className="panel table-wrap"><table className="data-table"><thead><tr><th>Batch</th><th>Order</th><th>Edition</th><th>Plan</th><th>Finished</th><th>Received</th><th>Dates</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={9}>Loading batches...</td></tr> : batches.filter(row => !orderId || row.print_order_id === orderId).length ? batches.filter(row => !orderId || row.print_order_id === orderId).map(row => <tr key={row.id}><td>{row.batch_ref}</td><td>{row.print_order_number}</td><td>{row.book_title} / {row.edition_number}</td><td>{row.planned_qty}</td><td>{row.finished_qty}</td><td>{row.received_qty}</td><td>{String(row.planned_start).slice(0, 10)} to {String(row.planned_end).slice(0, 10)}</td><td>{human(row.status)}</td><td><button className="btn" onClick={() => void open(row.id)}>Trace batch</button></td></tr>) : <tr><td colSpan={9}>No batches for this order.</td></tr>}</tbody></table></section>
    {detail && <section className="panel catalog-form"><h2 className="section-title">{detail.batch_ref} / {human(detail.status)}</h2><p>{detail.print_order_number} / {detail.book_title} / Edition {detail.edition_number}</p><h3 className="section-title">Material issues</h3>{detail.issues.length ? detail.issues.map((row: Row) => <p key={row.id}>{row.reference} / {human(row.status)}</p>) : <p>No material issues linked to this batch.</p>}<h3 className="section-title">Unused material returns</h3>{detail.returns.length ? detail.returns.map((row: Row) => <p key={row.id}>{row.reference} / {row.quantity} returned / {human(row.status)}</p>) : <p>No unused material returns linked to this batch.</p>}<h3 className="section-title">Operation timeline</h3>{detail.operations.length ? detail.operations.map((row: Row) => <p key={row.id}>{String(row.operation_date).slice(0, 10)} / {human(row.stage)} / {row.input_qty} input / {row.output_qty} output / {row.rejected_qty} rejected</p>) : <p>No operations yet.</p>}<h3 className="section-title">QC inspections</h3>{detail.inspections.length ? detail.inspections.map((row: Row) => <p key={row.id}>{row.reference} / {human(row.status)} / {row.accepted_qty} accepted / {row.rejected_qty} rejected / {row.damaged_qty} damaged / {row.pending_qty} pending</p>) : <p>No inspections yet.</p>}<h3 className="section-title">QC loss dispositions</h3>{detail.dispositions.length ? detail.dispositions.map((row: Row) => <p key={row.id}>{row.reference} / {human(row.category)} / {human(row.reason_code)} / {row.quantity} copies / {human(row.status)}</p>) : <p>No rejected or damaged copy dispositions.</p>}<h3 className="section-title">Finished-goods receipts</h3>{detail.receipts.length ? detail.receipts.map((row: Row) => <p key={row.id}>{row.reference} / {row.quantity} copies / {human(row.status)}</p>) : <p>No receipts yet.</p>}{canApprove && detail.status === 'open' && <><label className="field">Independent close note<input className="input" minLength={10} value={note} onChange={event => setNote(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || note.trim().length < 10} onClick={() => void close()}>Close reconciled batch</button></>}</section>}
  </>;
}
