'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = Record<string, any>;
export function WorkflowApprovalLimitsScreen({ mode }: { mode: 'matrix' | 'simulator' }) {
  const [limits, setLimits] = useState<Row[]>([]), [roles, setRoles] = useState<Row[]>([]);
  const [role, setRole] = useState(''), [amount, setAmount] = useState(''), [makerSelf, setMakerSelf] = useState(false), [userId, setUserId] = useState('');
  const [isOwner, setIsOwner] = useState(false), [result, setResult] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const [me, current] = await Promise.all([api<{ data: { role: string; userId: string } }>('/auth/me'), api<{ data: Row[] }>('/procurement/approval-limits')]);
      setUserId(me.data.userId); setIsOwner(me.data.role === 'Owner'); setLimits(current.data);
      if (me.data.role === 'Owner') setRoles((await api<{ data: Row[] }>('/admin/roles')).data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load purchase order limits'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [mode]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api(`/procurement/approval-limits/${role}`, { method: 'PUT', body: JSON.stringify({ maxAmount: amount }) }); setNotice('Purchase order role limit saved and audited.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save limit'); }
    finally { setBusy(false); }
  }
  async function simulate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const params = new URLSearchParams({ amount }); if (makerSelf) params.set('makerId', userId); setResult((await api<{ data: Row }>(`/workflow/limits/simulate?${params}`)).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not simulate limit'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">{mode === 'matrix' ? 'Approval Matrix' : 'Approval Limit Simulator'}</h1><p className="muted">Current purchase order role limits enforced by the Procurement approval service</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel">{notice}</div>}
    {mode === 'matrix' ? <><section className="panel table-wrap"><h2 className="section-title">Active purchase order limits</h2>{loading ? <p>Loading limits...</p> : <table className="data-table"><thead><tr><th>Role</th><th>Maximum approval amount</th><th>Updated (UTC)</th></tr></thead><tbody>{limits.length ? limits.map(row => <tr key={row.role_id}><td>{row.role_name}</td><td>BDT {row.max_amount}</td><td>{String(row.updated_at).slice(0, 19)}</td></tr>) : <tr><td colSpan={3}>No purchase order limits configured. Approvals above an unconfigured limit remain blocked.</td></tr>}</tbody></table>}</section>{isOwner && <section className="panel catalog-form"><h2 className="section-title">Configure role limit</h2><form onSubmit={save}><div className="catalog-form-grid"><label className="field">Approver role<select className="input" required value={role} onChange={event => setRole(event.target.value)}><option value="">Choose role</option>{roles.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="field">Maximum amount (BDT)<input className="input" type="number" required min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy}>Save limit</button></form></section>}</> : <section className="panel catalog-form"><h2 className="section-title">Check my current purchase order limit</h2><form onSubmit={simulate}><label className="field">Purchase order amount (BDT)<input className="input" type="number" required min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label><label className="field"><input type="checkbox" checked={makerSelf} onChange={event => setMakerSelf(event.target.checked)} /> I created this purchase order</label><button className="btn btn-primary" disabled={busy}>Simulate</button></form>{result && <div className="panel"><h3 className="section-title">{result.eligible ? 'Limit and maker-checker checks pass' : 'Approval blocked by limit or maker-checker'}</h3><p>Eligible roles: {result.eligibleRoles.length ? result.eligibleRoles.join(', ') : 'None'}.</p><p>{result.caveat}</p></div>}</section>}
    <p className="muted">This screen covers the existing purchase order approval rule only. Other document types, branch thresholds and risk-based routing are not yet configured centrally. <Link href="/procurement-suppliers/purchase-order-list">Open purchase orders</Link>.</p>
  </>;
}
