"use client";

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type AuditRow = { id: string; actor_name: string | null; actor_id: string | null; action: string; entity_type: string; entity_id: string; occurred_at: string };
type Result = { rows: AuditRow[]; total: number };

export function AdminAuditScreen() {
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Result>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ q: applied, limit: '25', offset: String(page * 25) });
      const response = await api<{ data: Result }>(`/admin/audit-logs?${params}`);
      setResult(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load audit history');
    } finally { setLoading(false); }
  }, [applied, page]);
  useEffect(() => { void load(); }, [load]);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Audit Log Explorer</h1><p className="muted">Read-only organization audit history. Event details and credentials are not exported here.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel catalog-form"><div className="button-row"><input className="input" aria-label="Search audit action or entity" placeholder="Search action or entity" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setPage(0); setApplied(query); } }} /><button className="btn" onClick={() => { setPage(0); setApplied(query); }}>Search</button></div></section>
    {error && <p className="alert-error" role="alert">{error}</p>}
    {loading ? <div className="panel empty">Loading audit history…</div> : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Entity</th><th>Record ID</th></tr></thead><tbody>{result.rows.length ? result.rows.map(row => <tr key={row.id}><td>{String(row.occurred_at).slice(0, 19).replace('T', ' ')}</td><td>{row.actor_name || row.actor_id || 'System'}</td><td>{row.action}</td><td>{row.entity_type}</td><td><code>{row.entity_id}</code></td></tr>) : <tr><td colSpan={5} className="empty">No audit events match this search.</td></tr>}</tbody></table></div>}
    <div className="button-row"><button className="btn" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{result.total} events · page {page + 1}</span><button className="btn" disabled={loading || (page + 1) * 25 >= result.total} onClick={() => setPage(page + 1)}>Next</button></div>
  </>;
}
