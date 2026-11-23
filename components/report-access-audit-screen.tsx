"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Row = { id: string; actor_id: string; action: string; entity_type: string; metadata_json: Record<string, unknown>; occurred_at: string };
export function ReportAccessAuditScreen() {
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [action, setAction] = useState('');
  const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load(nextOffset = offset) {
    if (from && to && from > to) { setError('Start date must not exceed end date'); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '50', offset: String(nextOffset) });
      if (from) params.set('from', from); if (to) params.set('to', to); if (action) params.set('action', action);
      const result = await api<{ data: Row[]; meta: { total: number } }>(`/reports/access-audit?${params}`);
      setRows(result.data); setTotal(result.meta.total); setOffset(nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load report access history'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0); }, []);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Report Access Audit</h1><p className="muted">Restricted audit trail for new report catalog views, sales report views and CSV exports</p></div></div>
    <section className="panel catalog-form"><h2 className="section-title">Audit filters</h2><div className="catalog-form-grid"><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label className="field">Action<select className="input" value={action} onChange={event => setAction(event.target.value)}><option value="">All</option><option value="VIEW">View</option><option value="EXPORT">Export</option>{["CREATE","UPDATE","PAUSE","RESUME","DELETE","RETRY","RUN"].map(value => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label></div><button className="btn btn-primary" onClick={() => void load(0)}>Apply filters</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{loading ? <div className="panel empty">Loading audit events…</div> : <><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Time (UTC)</th><th>Action</th><th>Report</th><th>Actor</th><th>Scope</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{String(row.occurred_at).slice(0, 19)}</td><td>{row.action}</td><td>{row.entity_type.replaceAll('_', ' ')}</td><td>{row.actor_id.slice(0, 8)}</td><td>{row.metadata_json?.from ? `${row.metadata_json.from} to ${row.metadata_json.to}` : String(row.metadata_json?.scheduleId || row.metadata_json?.sourceJobId || row.metadata_json?.printOrderId || row.metadata_json?.asOf || 'Catalog')}</td></tr>) : <tr><td colSpan={5}>No report access events match these filters.</td></tr>}</tbody></table></div><div className="button-row"><button className="btn" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - 50))}>Previous</button><span>{total} events</span><button className="btn" disabled={offset + 50 >= total} onClick={() => void load(offset + 50)}>Next</button></div><p className="muted">Coverage includes the new Report Center, Sales & Returns, Catalog, Edition, Production Cost, Royalty Liability and scheduling APIs. Legacy Finance and Inventory report views are not yet included.</p></>}
  </>;
}
