"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Quote = { id: string; quotation_number: string; customer_name: string; discount_amount: string; created_by: string };
type Override = { quotation_id: string; quotation_number: string; customer_name: string; max_line_discount_bps: number; discount_amount: string; status: string; requested_by: string; request_reason: string; review_reason: string | null; quotation_status: string };
type Identity = { userId: string; role: string; permissions: string[] };

export function SalesDiscountScreen({ screen }: { screen: Screen }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [policy, setPolicy] = useState(0);
  const [policyInput, setPolicyInput] = useState('0');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [quoteId, setQuoteId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canManage = identity?.role === 'Owner' || identity?.permissions.includes('sales.manage');
  const canApprove = identity?.role === 'Owner' || identity?.permissions.includes('sales.approve');
  async function load() {
    const [policyResult, quoteResult, overrideResult] = await Promise.all([
      api<{ data: { max_discount_bps: number } }>('/sales/discounts/policy'),
      api<{ data: { rows: Quote[] } }>('/sales/quotations?status=pending_approval&limit=100'),
      api<{ data: Override[] }>('/sales/discounts/overrides'),
    ]);
    setPolicy(Number(policyResult.data.max_discount_bps)); setPolicyInput(String(Number(policyResult.data.max_discount_bps) / 100));
    setQuotes(quoteResult.data.rows); setOverrides(overrideResult.data);
  }
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load discount controls')); void api<{ data: Identity }>('/auth/me').then(result => setIdentity(result.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load permissions')); }, []);
  async function configure() {
    setBusy(true); setError(''); setNotice('');
    try { await api('/sales/discounts/policy', { method: 'PUT', body: JSON.stringify({ maxDiscountBps: Math.round(Number(policyInput) * 100) }) }); setNotice('Discount ceiling updated for future quotation decisions.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update policy'); }
    finally { setBusy(false); }
  }
  async function request() {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/sales/discounts/overrides/${quoteId}/request`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: requestReason.trim() }) }); setNotice('Discount override sent for independent review.'); setRequestReason(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request override'); }
    finally { setBusy(false); }
  }
  async function review(id: string, action: 'approve' | 'reject') {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/sales/discounts/overrides/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: reviewReason.trim() }) }); setNotice(`Discount override ${action}d.`); setReviewReason(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review override'); }
    finally { setBusy(false); }
  }
  const requestable = quotes.filter(row => row.created_by === identity?.userId && Number(row.discount_amount) > 0 && !overrides.some(item => item.quotation_id === row.id));
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">Control quotation line discounts above the organization ceiling before quote approval.</p></div><Link className="btn" href="/sales-distribution/sales-quotation-list">Quotation list</Link></div>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    <section className="panel catalog-form"><h2 className="section-title">Discount policy</h2><p>Current maximum line discount without a separate override: {(policy / 100).toFixed(2)}%. When no policy is configured, the limit is 0%.</p>{identity?.role === 'Owner' && <div className="catalog-form-grid"><label className="field">Maximum line discount %<input className="input" type="number" min="0" max="100" step="0.01" value={policyInput} onChange={event => setPolicyInput(event.target.value)} /></label><button className="btn" disabled={busy || !Number.isFinite(Number(policyInput)) || Number(policyInput) < 0 || Number(policyInput) > 100} onClick={() => void configure()}>Save policy</button></div>}</section>
    <section className="panel catalog-form"><h2 className="section-title">Request an override</h2><div className="catalog-form-grid"><label className="field">My submitted discounted quotation<select className="input" value={quoteId} onChange={event => setQuoteId(event.target.value)}><option value="">Select quotation</option>{requestable.map(row => <option key={row.id} value={row.id}>{row.quotation_number} - {row.customer_name} - {row.discount_amount} BDT discount</option>)}</select></label><label className="field">Business reason<input className="input" value={requestReason} onChange={event => setRequestReason(event.target.value)} /></label></div><button className="btn btn-primary" disabled={!canManage || busy || !quoteId || requestReason.trim().length < 10} onClick={() => void request()}>Request independent review</button><p className="muted">The server checks each line against the current ceiling. Quotations already inside policy do not need an override.</p></section>
    <section className="panel catalog-form"><h2 className="section-title">Override decisions</h2><label className="field">Review reason (at least 10 characters)<input className="input" value={reviewReason} onChange={event => setReviewReason(event.target.value)} /></label><div className="table-wrap"><table className="data-table"><thead><tr><th>Quotation</th><th>Customer</th><th>Maximum line discount</th><th>Requested reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>{overrides.length ? overrides.map(row => <tr key={row.quotation_id}><td>{row.quotation_number}</td><td>{row.customer_name}</td><td>{(Number(row.max_line_discount_bps) / 100).toFixed(2)}%</td><td>{row.request_reason}</td><td>{row.status}</td><td>{row.status === 'pending' && row.requested_by !== identity?.userId ? <div className="button-row"><button className="btn btn-primary" disabled={!canApprove || busy || reviewReason.trim().length < 10} onClick={() => void review(row.quotation_id, 'approve')}>Approve override</button><button className="btn" disabled={!canApprove || busy || reviewReason.trim().length < 10} onClick={() => void review(row.quotation_id, 'reject')}>Reject</button></div> : row.review_reason || '-'}</td></tr>) : <tr><td colSpan={6} className="empty">No discount override requests yet.</td></tr>}</tbody></table></div></section>
  </>;
}
