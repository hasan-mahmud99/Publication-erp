'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Candidate = { id: string; display_name: string };
type Delegation = { id: string; delegator_id: string; delegate_id: string; delegator_name: string; delegate_name: string; document_type: string; effective_from: string; effective_to: string; reason: string; max_amount: string | null; status: string; operationally_active: false; decision_note: string | null };
export function WorkflowDelegationScreen() {
  const [rows, setRows] = useState<Delegation[]>([]), [candidates, setCandidates] = useState<Candidate[]>([]);
  const [me, setMe] = useState({ userId: '', role: '' }), [selected, setSelected] = useState<Delegation | null>(null);
  const [form, setForm] = useState({ delegateId: '', effectiveFrom: '', effectiveTo: '', reason: '', maxAmount: '' });
  const [note, setNote] = useState(''), [filter, setFilter] = useState('all'), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const [identity, records, users] = await Promise.all([api<{ data: { userId: string; role: string } }>('/auth/me'), api<{ data: Delegation[] }>('/workflow/delegations'), api<{ data: Candidate[] }>('/workflow/delegation-candidates')]);
      setMe(identity.data); setRows(records.data); setCandidates(users.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load delegations'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ data: Delegation }>('/workflow/delegations', { method: 'POST', body: JSON.stringify({ delegateId: form.delegateId, documentType: 'purchase_requisition', effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo, reason: form.reason, ...(form.maxAmount ? { maxAmount: form.maxAmount } : {}) }) });
      setSelected(result.data); setNotice('Delegation request saved as a draft. It grants no approval authority.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create delegation request'); }
    finally { setBusy(false); }
  }
  async function act(action: 'submit' | 'approve' | 'reject' | 'revoke') {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ data: Delegation }>(`/workflow/delegations/${selected.id}/${action}`, { method: 'POST', body: JSON.stringify({ note }) });
      setSelected(result.data); setNote(''); setNotice(`Delegation request ${result.data.status}. No source approval authority was transferred.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Delegation action failed'); }
    finally { setBusy(false); }
  }
  const visible = filter === 'all' ? rows : rows.filter(row => row.status === filter);
  const canReview = selected?.status === 'submitted' && me.role === 'Owner' && selected.delegator_id !== me.userId && selected.delegate_id !== me.userId;
  return <>
    <div className="page-heading"><div><h1 className="page-title">Delegation Setup</h1><p className="muted">Request and independently review temporary approver substitutions</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel"><h2 className="section-title">Operational boundary</h2><p>Delegation records are audited but do not currently change source approval permissions or task ownership. The delegate must already hold procurement approval permission. An approved record remains inactive until source decision services can enforce its scope and record both actors.</p></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel catalog-form"><h2 className="section-title">New delegation request</h2><form onSubmit={create}><div className="catalog-form-grid"><label className="field">Delegate<select className="input" required value={form.delegateId} onChange={event => setForm({ ...form, delegateId: event.target.value })}><option value="">Choose an authorized reviewer</option>{candidates.map(user => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><label className="field">Effective from (UTC)<input className="input" type="date" required value={form.effectiveFrom} onChange={event => setForm({ ...form, effectiveFrom: event.target.value })} /></label><label className="field">Effective to (UTC)<input className="input" type="date" required min={form.effectiveFrom} value={form.effectiveTo} onChange={event => setForm({ ...form, effectiveTo: event.target.value })} /></label><label className="field">Maximum amount (BDT, optional)<input className="input" type="number" min="0.01" step="0.01" value={form.maxAmount} onChange={event => setForm({ ...form, maxAmount: event.target.value })} /></label><label className="field">Reason<input className="input" required minLength={10} maxLength={1000} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></label></div><button className="btn btn-primary" disabled={busy}>Save request</button></form></section>
    <section className="panel table-wrap"><div className="page-heading"><h2 className="section-title">Delegation register</h2><label className="field">Status<select className="input" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All</option>{['draft', 'submitted', 'approved', 'rejected', 'revoked'].map(status => <option key={status}>{status}</option>)}</select></label></div>{loading ? <p>Loading delegations...</p> : <table className="data-table"><thead><tr><th>Delegator</th><th>Delegate</th><th>Document</th><th>Effective dates (UTC)</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.length ? visible.map(row => <tr key={row.id}><td>{row.delegator_name}</td><td>{row.delegate_name}</td><td>{row.document_type}</td><td>{String(row.effective_from).slice(0, 10)} to {String(row.effective_to).slice(0, 10)}</td><td>{row.status}</td><td><button className="btn" onClick={() => { setSelected(row); setNote(''); }}>Review</button></td></tr>) : <tr><td colSpan={6}>No delegation requests match.</td></tr>}</tbody></table>}</section>
    {selected && <section className="panel catalog-form"><h2 className="section-title">Request details</h2><p>{selected.delegator_name} to {selected.delegate_name}. {selected.reason}</p><p>Document: {selected.document_type}. Amount cap: {selected.max_amount ? `BDT ${selected.max_amount}` : 'Not specified'}. Status: {selected.status}. Operationally active: No.</p>{selected.decision_note && <p>Decision note: {selected.decision_note}</p>}{canReview && <label className="field">Independent review note<input className="input" minLength={10} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>}<div className="button-row">{selected.status === 'draft' && selected.delegator_id === me.userId && <button className="btn btn-primary" disabled={busy} onClick={() => void act('submit')}>Submit for review</button>}{canReview && <><button className="btn btn-primary" disabled={busy || note.trim().length < 10} onClick={() => void act('approve')}>Approve record</button><button className="btn" disabled={busy || note.trim().length < 10} onClick={() => void act('reject')}>Reject</button></>}{['draft', 'submitted', 'approved'].includes(selected.status) && (selected.delegator_id === me.userId || me.role === 'Owner') && <button className="btn" disabled={busy} onClick={() => void act('revoke')}>Revoke</button>}</div></section>}
  </>;
}
