"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Delivery = { dispatch_id: string; invoice_number: string; customer_name: string; item_code: string; warehouse_code: string; quantity: string; delivered_quantity: string; latest_event: string | null };
type Event = { id: string; event_type: string; quantity: string; carrier: string | null; tracking_reference: string | null; recipient_name: string | null; evidence: string | null; note: string | null; recorded_at: string };
type Detail = Delivery & { remaining_quantity: number; events: Event[] };

export function SalesDeliveryScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Delivery[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [eventType, setEventType] = useState<'in_transit' | 'delivered' | 'failed' | 'exception'>('in_transit');
  const [quantity, setQuantity] = useState(0);
  const [carrier, setCarrier] = useState('');
  const [trackingReference, setTrackingReference] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [evidence, setEvidence] = useState('');
  const [note, setNote] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() { setRows((await api<{ data: Delivery[] }>('/sales/deliveries')).data); }
  async function loadDetail(id: string) { setDetail((await api<{ data: Detail }>(`/sales/deliveries/${id}`)).data); }
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load deliveries')); void api<{ data: { role: string; permissions: string[] } }>('/auth/me').then(result => setCanManage(result.data.role === 'Owner' || result.data.permissions.includes('sales.manage'))).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load permissions')); }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load delivery detail')); }, [selectedId]);
  async function record() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/sales/deliveries/${selectedId}/events`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ eventType, quantity: eventType === 'delivered' ? quantity : 0, carrier, trackingReference, recipientName, evidence, note }) });
      setNotice('Delivery event recorded.'); setEvidence(''); setNote(''); setQuantity(0); await Promise.all([load(), loadDetail(selectedId)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record delivery event'); }
    finally { setBusy(false); }
  }
  const valid = canManage && selectedId && !busy && (eventType === 'delivered' ? Number.isInteger(quantity) && quantity > 0 && quantity <= Number(detail?.remaining_quantity ?? 0) && recipientName.trim().length > 0 && evidence.trim().length >= 10 : eventType === 'in_transit' ? Number(detail?.remaining_quantity ?? 0) > 0 && carrier.trim().length > 0 && trackingReference.trim().length > 0 : eventType === 'failed' ? Number(detail?.remaining_quantity ?? 0) > 0 && evidence.trim().length >= 10 : evidence.trim().length >= 10);
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">Track posted dispatches and record carrier, partial delivery, failure and recipient evidence.</p></div><button className="btn" onClick={() => void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not refresh deliveries'))}>Refresh</button></div>
    <p className="panel">Delivery events do not change inventory or create a Sales return. A failed delivery needs a separate, authorized stock and financial resolution.</p>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    <section className="panel catalog-form"><h2 className="section-title">Posted dispatches</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Book item</th><th>Warehouse</th><th>Dispatched</th><th>Delivered</th><th>Latest event</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.dispatch_id}><td>{row.invoice_number}</td><td>{row.customer_name}</td><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.quantity}</td><td>{row.delivered_quantity}</td><td>{row.latest_event || 'Awaiting tracking'}</td><td><button className="btn" onClick={() => setSelectedId(row.dispatch_id)}>Track</button></td></tr>) : <tr><td colSpan={8} className="empty">No posted Sales dispatches to track.</td></tr>}</tbody></table></div></section>
    {detail && <section className="panel catalog-form"><h2 className="section-title">Delivery for {detail.invoice_number}</h2><p>{detail.item_code} - dispatched {detail.quantity}, delivered {detail.delivered_quantity}, remaining {detail.remaining_quantity}</p><div className="catalog-form-grid"><label className="field">Event type<select className="input" value={eventType} onChange={event => setEventType(event.target.value as typeof eventType)}><option value="in_transit">In transit</option><option value="delivered">Delivered copies</option><option value="failed">Delivery failed</option><option value="exception">Exception</option></select></label>{eventType === 'delivered' && <label className="field">Delivered copies<input className="input" type="number" min="1" max={detail.remaining_quantity} step="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label>}<label className="field">Carrier<input className="input" value={carrier} onChange={event => setCarrier(event.target.value)} /></label><label className="field">Tracking reference<input className="input" value={trackingReference} onChange={event => setTrackingReference(event.target.value)} /></label><label className="field">Recipient name<input className="input" value={recipientName} onChange={event => setRecipientName(event.target.value)} /></label><label className="field">Evidence or issue details<input className="input" value={evidence} onChange={event => setEvidence(event.target.value)} /></label><label className="field">Note<input className="input" value={note} onChange={event => setNote(event.target.value)} /></label></div><button className="btn btn-primary" disabled={!valid} onClick={() => void record()}>Record delivery event</button><h3>Delivery event history</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Recorded</th><th>Event</th><th>Quantity</th><th>Carrier / tracking</th><th>Recipient</th><th>Evidence</th></tr></thead><tbody>{detail.events.length ? detail.events.map(row => <tr key={row.id}><td>{String(row.recorded_at).replace('T', ' ').slice(0, 19)}</td><td>{row.event_type}</td><td>{row.quantity}</td><td>{row.carrier || '-'} / {row.tracking_reference || '-'}</td><td>{row.recipient_name || '-'}</td><td>{row.evidence || row.note || '-'}</td></tr>) : <tr><td colSpan={6} className="empty">No delivery events recorded.</td></tr>}</tbody></table></div></section>}
  </>;
}
