'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type AuditRow = { id: string; action: string; entity_type: string; entity_id: string; metadata_json: unknown; occurred_at: string; actor_name: string; actor_email: string };
type AuditResult = { rows: AuditRow[]; total: number; page: number; pageSize: number; entityTypes: string[] };
const formatDate = (value: string) => String(value).replace('T', ' ').slice(0, 19);

export function FinanceAuditScreen() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [entityType, setEntityType] = useState(''); const [action, setAction] = useState('');
  const [filters, setFilters] = useState({ from: '', to: '', entityType: '', action: '' });
  const [page, setPage] = useState(1); const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      const response = await api<{ data: AuditResult }>(`/finance/audit?${params}`);
      setResult(response.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load Finance audit records'); }
    finally { setLoading(false); }
  }, [filters, page]);
  useEffect(() => { void load(); }, [load]);
  function apply() { if (from && to && from > to) { setError('End date must follow start date'); return; } setPage(1); setFilters({ from, to, entityType, action }); }
  const pages = Math.max(1, Math.ceil((result?.total || 0) / 25));
  return <>
    <div className="page-heading"><div><h1 className="page-title">Financial Audit Trail</h1><p className="muted">Recorded Finance actions for this organization, with actor and source references.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel catalog-form"><h2 className="section-title">Find audit records</h2><div className="catalog-form-grid">
      <label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label className="field">To<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
      <label className="field">Entity type<select className="input" value={entityType} onChange={event => setEntityType(event.target.value)}><option value="">All Finance entities</option>{result?.entityTypes.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="field">Action<input className="input" value={action} onChange={event => setAction(event.target.value)} placeholder="For example, POST" /></label>
    </div><button className="btn btn-primary" onClick={apply}>Apply filters</button></section>
    {error && <p className="alert-error" role="alert">{error}</p>}
    <section className="panel table-wrap"><h2 className="section-title">Audit records</h2>{loading ? <p>Loading Finance audit records...</p> : <><p className="muted">{result?.total || 0} records · Page {page} of {pages}</p><table className="data-table"><thead><tr><th>When (UTC)</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reference</th></tr></thead><tbody>{result?.rows.length ? result.rows.map(row => <tr key={row.id}><td>{formatDate(row.occurred_at)}</td><td>{row.actor_name}<br /><span className="muted">{row.actor_email}</span></td><td>{row.action}</td><td>{row.entity_type.replaceAll('_', ' ')}</td><td>{row.entity_type === 'journal_entry' ? <Link href={`/finance-accounting/journal-entry-detail?journal=${row.entity_id}`}>{row.entity_id}</Link> : row.entity_id}</td></tr>) : <tr><td colSpan={5} className="empty">No Finance audit records match these filters.</td></tr>}</tbody></table></>}</section>
    <div className="button-row"><button className="btn" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></div>
  </>;
}
