"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Policy = { id: string; policy_kind: string; version_no: number; effective_from: string; effective_to: string; source_reference: string; specification_json: unknown; status: string; created_by: string; review_note?: string | null };
const kinds = ['proration', 'attendance', 'leave_pay', 'overtime', 'tax_withholding', 'benefits', 'bonuses', 'advance_recovery', 'finance_mapping', 'disbursement', 'cost_allocation'];
const day = (value: string) => String(value).slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export function HrPayrollPolicyPanel({ canManage, canApprove, userId }: { canManage: boolean; canApprove: boolean; userId: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [kind, setKind] = useState('proration');
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveTo, setEffectiveTo] = useState(today());
  const [sourceReference, setSourceReference] = useState('');
  const [specification, setSpecification] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try { setPolicies((await api<{ data: Policy[] }>('/hr/payroll-policies')).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load policy versions'); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(path: string, body: Record<string, unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setNotice(message); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Policy request failed'); }
    finally { setBusy(false); }
  }
  function create() {
    let parsed: unknown;
    try { parsed = JSON.parse(specification); }
    catch { setError('Enter a valid JSON object containing the proposed policy values.'); return; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { setError('Policy specification must be a JSON object.'); return; }
    void submit('/hr/payroll-policies', { kind, effectiveFrom, effectiveTo, sourceReference, specification: parsed as Record<string, unknown> }, 'Policy draft submitted for independent review');
  }
  return <section className="panel catalog-form">
    <h2 className="section-title">Versioned payroll policy register</h2>
    <p className="muted">Record the approved source and proposed values for independent review. This register documents configuration; it does not yet apply rules to salary calculations or unlock approval, disbursement or GL posting.</p>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}
    {canManage && <div><div className="catalog-form-grid">
      <label className="field">Policy kind<select className="input" value={kind} onChange={event => setKind(event.target.value)}>{kinds.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="field">Effective from<input className="input" type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} /></label>
      <label className="field">Effective to<input className="input" type="date" value={effectiveTo} onChange={event => setEffectiveTo(event.target.value)} /></label>
      <label className="field">Approved source reference<input className="input" value={sourceReference} onChange={event => setSourceReference(event.target.value)} /></label>
    </div><label className="field">Proposed values (JSON object)<textarea className="input" rows={5} value={specification} onChange={event => setSpecification(event.target.value)} placeholder={'{"basis":"calendar_days","policy_version":"approved-reference"}'} /></label><button className="btn btn-primary" disabled={busy || sourceReference.trim().length < 3 || !specification.trim()} onClick={create}>Submit policy draft</button></div>}
    {canApprove && <label className="field">Policy review note<input className="input" value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></label>}
    <div className="table-wrap"><table className="data-table"><thead><tr>{['Kind', 'Version', 'Effective dates', 'Source', 'Status', 'Review'].map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{policies.length ? policies.map(row => <tr key={row.id}><td>{row.policy_kind.replaceAll('_', ' ')}</td><td>{row.version_no}</td><td>{day(row.effective_from)} – {day(row.effective_to)}</td><td>{row.source_reference}</td><td>{row.status}</td><td>{row.status === 'draft' && canApprove && row.created_by !== userId ? <div className="button-row">{(['approve', 'reject'] as const).map(decision => <button key={decision} className="btn" disabled={busy || reviewNote.trim().length < 10} onClick={() => void submit(`/hr/payroll-policies/${row.id}/review`, { decision, note: reviewNote }, `Policy ${decision}d`)}>{decision}</button>)}</div> : row.review_note || '—'}</td></tr>) : <tr><td colSpan={6} className="empty">No payroll policy versions recorded.</td></tr>}</tbody></table></div>
  </section>;
}
