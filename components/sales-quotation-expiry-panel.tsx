"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Extension = { status: string; request_reason: string; requested_until: string; requested_by: string; review_reason: string | null; reviewed_at: string | null };
const date = (value: string) => String(value).slice(0, 10);

export function SalesQuotationExpiryPanel({ id, validUntil, status, creatorId, userId, canManage, canApprove }: { id: string; validUntil: string; status: string; creatorId: string; userId: string; canManage: boolean; canApprove: boolean }) {
  const [extension, setExtension] = useState<Extension | null>(null);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState('');
  const [requestedUntil, setRequestedUntil] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const expired = date(validUntil) < new Date().toISOString().slice(0, 10);
  async function load() { setExtension((await api<{ data: Extension | null }>(`/sales/quotations/${id}/expiry-override`)).data); }
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load expiry extension')); }, [id]);
  if (!expired && !extension) return null;
  async function act(action: 'request' | 'approve' | 'reject') {
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/sales/quotations/${id}/expiry-override${action === 'request' ? '' : `/${action}`}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(action === 'request' ? { reason: reason.trim(), requestedUntil } : { reason: decision.trim() }) });
      await load(); setNotice(action === 'request' ? 'Extension submitted for independent review.' : `Extension ${action}d.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update expiry extension'); }
    finally { setBusy(false); }
  }
  return <section className="panel catalog-form"><h2 className="section-title">Quotation expiry extension</h2><p>Original offer valid until {date(validUntil)}. An expired offer needs independent approval before submission, approval, customer acceptance or order conversion.</p>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {extension ? <><p>Status: <strong>{extension.status}</strong> · Requested until {date(extension.requested_until)}</p><p>Request: {extension.request_reason}</p>{extension.review_reason && <p>Review: {extension.review_reason}</p>}{extension.status === 'pending' && canApprove && userId !== creatorId && userId !== extension.requested_by && <><label className="field">Independent decision reason<input className="input" value={decision} onChange={event => setDecision(event.target.value)} /></label><div className="button-row"><button className="btn btn-primary" disabled={busy || decision.trim().length < 10} onClick={() => void act('approve')}>Approve extension</button><button className="btn" disabled={busy || decision.trim().length < 10} onClick={() => void act('reject')}>Reject extension</button></div></>}</>
      : expired && !['converted', 'rejected'].includes(status) && canManage && userId === creatorId ? <><label className="field">Extension reason<input className="input" value={reason} onChange={event => setReason(event.target.value)} /></label><label className="field">Requested valid until<input className="input" type="date" min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} value={requestedUntil} onChange={event => setRequestedUntil(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || reason.trim().length < 10 || requestedUntil <= new Date().toISOString().slice(0, 10)} onClick={() => void act('request')}>Request extension</button></> : <p className="muted">A new quotation is required unless the creator requests an extension and a different reviewer approves it.</p>}
  </section>;
}
