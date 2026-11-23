'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type ExceptionRow = { id: string; reference: string; purpose: string; priority: string; required_date: string; days_past_required: number; amount: string };
export function WorkflowDeadlineScreen() {
  const [rows, setRows] = useState<ExceptionRow[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(''), [applied, setApplied] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load(nextOffset = offset, query = applied) {
    setLoading(true); setError('');
    try {
      const result = await api<{ data: ExceptionRow[]; meta: { total: number } }>(`/workflow/required-date-exceptions?limit=20&offset=${nextOffset}&search=${encodeURIComponent(query)}`);
      setRows(result.data); setTotal(result.meta.total); setOffset(nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load required-date exceptions'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0, ''); }, []);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Overdue &amp; Escalation Report</h1><p className="muted">Submitted purchase requisitions past their business required date</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel"><h2 className="section-title">Approval SLA status</h2><p>No approved workflow SLA or business calendar is configured for these source decisions. The report below uses the requisition's required date; it does not calculate an approval SLA or trigger escalation. Source approvals remain with authorized procurement reviewers.</p></section>
    <section className="panel catalog-form"><label className="field">Search reference or purpose<input className="input" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setApplied(search.trim()); void load(0, search.trim()); } }} /></label><button className="btn" onClick={() => { setApplied(search.trim()); void load(0, search.trim()); }}>Search</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}
    <section className="panel table-wrap"><h2 className="section-title">Past required date</h2>{loading ? <p>Loading requests...</p> : <table className="data-table"><thead><tr><th>Reference</th><th>Purpose</th><th>Priority</th><th>Required date (UTC)</th><th>Days past</th><th>Estimated amount</th><th>Source</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.reference}</td><td>{row.purpose}</td><td>{row.priority}</td><td>{String(row.required_date).slice(0, 10)}</td><td>{row.days_past_required}</td><td>BDT {row.amount}</td><td><Link href="/procurement-suppliers/purchase-requisition-list">Open register</Link></td></tr>) : <tr><td colSpan={7}>No submitted requisitions are past their required date.</td></tr>}</tbody></table>}<div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} exceptions</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>
  </>;
}
