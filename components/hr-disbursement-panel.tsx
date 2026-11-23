"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Row = Record<string, any>;
export function HrDisbursementPanel({ runs, canManage, canApprove, userId }: { runs: Row[]; canManage: boolean; canApprove: boolean; userId: string }) {
  const [plans, setPlans] = useState<Row[]>([]);
  const [runId, setRunId] = useState('');
  const [channel, setChannel] = useState('manual_bank');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try { setPlans((await api<{ data: Row[] }>('/hr/disbursement-plans')).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load disbursement plans'); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(path: string, body: Record<string, unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Plan operation failed'); }
    finally { setBusy(false); }
  }
  return <section className="panel catalog-form">
    <h2 className="section-title">Salary disbursement plans</h2>
    <p className="muted">Planning and independent review only. No salary transfer, bank instruction, payroll lock, or accounting journal is created. Real payment is disabled until approved policy and integration controls exist.</p>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}
    {canManage && <div className="catalog-form-grid"><label className="field">Plan payroll period<select className="input" value={runId} onChange={event => setRunId(event.target.value)}><option value="">Select provisional run</option>{runs.map(run => <option key={run.id} value={run.id}>{String(run.period_start).slice(0, 10)} to {String(run.period_end).slice(0, 10)}</option>)}</select></label><label className="field">Planned channel<select className="input" value={channel} onChange={event => setChannel(event.target.value)}><option value="manual_bank">Manual bank</option><option value="external_provider">External provider</option></select></label><button className="btn btn-primary" disabled={busy || !runId} onClick={() => void submit('/hr/disbursement-plans', { runId, paymentChannel: channel }, 'Planning draft created; no payment executed')}>Create planning draft</button></div>}
    {canApprove && <label className="field">Review note<input className="input" value={note} onChange={event => setNote(event.target.value)} /></label>}
    <div className="table-wrap"><table className="data-table"><thead><tr>{['Period', 'Channel', 'Employees', 'Planned net (BDT)', 'Status', 'Review'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{plans.length ? plans.map(plan => <tr key={plan.id}><td>{String(plan.period_start).slice(0, 10)} to {String(plan.period_end).slice(0, 10)}</td><td>{plan.payment_channel.replaceAll('_', ' ')}</td><td>{plan.employee_count}</td><td>{Number(plan.net_total).toFixed(2)}</td><td>{plan.status} · unpaid</td><td>{plan.status === 'draft' && canApprove && plan.created_by !== userId ? <div className="button-row"><button className="btn" disabled={busy || note.trim().length < 10} onClick={() => void submit(`/hr/disbursement-plans/${plan.id}/review`, { decision: 'review', note }, 'Plan reviewed; payment remains disabled')}>Review</button><button className="btn" disabled={busy || note.trim().length < 10} onClick={() => void submit(`/hr/disbursement-plans/${plan.id}/review`, { decision: 'reject', note }, 'Plan rejected')}>Reject</button></div> : plan.review_note || '—'}</td></tr>) : <tr><td colSpan={6} className="empty">No salary disbursement plans yet.</td></tr>}</tbody></table></div>
  </section>;
}
