"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Row = Record<string, any>;
const day = (value: unknown) => String(value || '').slice(0, 10);
export function HrSalaryPanel({ employeeId, canManage, canApprove, userId, onUpdated }: { employeeId: string; canManage: boolean; canApprove: boolean; userId: string; onUpdated: () => void }) {
  const [history, setHistory] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [proposedSalary, setProposedSalary] = useState('');
  const [reason, setReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [events, changes] = await Promise.all([api<{ data: Row[] }>(`/hr/employees/${employeeId}/salary-history`), api<{ data: Row[] }>(`/hr/employees/${employeeId}/salary-requests`)]);
      setHistory(events.data); setRequests(changes.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load salary history'); }
  }
  useEffect(() => { void load(); }, [employeeId]);
  async function submit(path: string, body: Record<string, unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setNotice(message); await load(); onUpdated(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Salary request failed'); }
    finally { setBusy(false); }
  }
  return <section className="panel catalog-form">
    <h2 className="section-title">Salary change requests and history</h2>
    <p className="muted">Base salary changes require a separate reviewer. An approved change becomes effective on the review date and records the previous and new amounts. Existing payroll runs may block approval.</p>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}
    {canManage && <div><div className="catalog-form-grid"><label className="field">Proposed monthly salary (BDT)<input className="input" type="number" min="0" step="0.01" value={proposedSalary} onChange={event => setProposedSalary(event.target.value)} /></label><label className="field">Salary change reason<input className="input" value={reason} onChange={event => setReason(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !proposedSalary || reason.trim().length < 10} onClick={() => void submit(`/hr/employees/${employeeId}/salary-requests`, { proposedSalary, reason }, 'Salary change submitted for independent review')}>Request salary change</button></div>}
    {canApprove && <label className="field">Salary review note<input className="input" value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></label>}
    <h3 className="section-title">Requests</h3><div className="table-wrap"><table className="data-table"><thead><tr>{['Previous', 'Proposed', 'Reason', 'Status', 'Decision'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{requests.length ? requests.map(row => <tr key={row.id}><td>{row.previous_salary}</td><td>{row.proposed_salary}</td><td>{row.reason}</td><td>{row.status}</td><td>{row.status === 'pending' && canApprove && row.requested_by !== userId ? <div className="button-row">{(['approve', 'reject'] as const).map(decision => <button className="btn" key={decision} disabled={busy || reviewNote.trim().length < 10} onClick={() => void submit(`/hr/salary-requests/${row.id}/review`, { decision, note: reviewNote }, `Salary request ${decision}d`)}>{decision}</button>)}</div> : row.review_note || '—'}</td></tr>) : <tr><td colSpan={5} className="empty">No salary change requests yet.</td></tr>}</tbody></table></div>
    <h3 className="section-title">Recorded salary events</h3><div className="table-wrap"><table className="data-table"><thead><tr>{['Effective', 'Event', 'Previous', 'New salary'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{history.length ? history.map(row => <tr key={row.id}><td>{day(row.effective_date)}</td><td>{row.event_type.replaceAll('_', ' ')}</td><td>{row.old_salary ?? '—'}</td><td>{row.new_salary}</td></tr>) : <tr><td colSpan={4} className="empty">No salary events recorded for this employee. Earlier salary changes cannot be reconstructed.</td></tr>}</tbody></table></div>
  </section>;
}
