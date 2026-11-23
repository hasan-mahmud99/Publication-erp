'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = { id: string; reference: string; purpose: string; amount: string; required_date: string; reviewer_count: number; days_past_required: number; missing_independent_reviewer: boolean; past_required_date: boolean };
export function WorkflowExceptionScreen() {
  const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0), [search, setSearch] = useState(''), [applied, setApplied] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load(nextOffset = offset, query = applied) {
    setLoading(true); setError('');
    try {
      const result = await api<{ data: Row[]; meta: { total: number } }>(`/workflow/exceptions?limit=20&offset=${nextOffset}&search=${encodeURIComponent(query)}`);
      setRows(result.data); setTotal(result.meta.total); setOffset(nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load workflow exceptions'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0, ''); }, []);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Workflow Exception Queue</h1><p className="muted">Source-backed purchase requisitions needing administrative attention</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel"><h2 className="section-title">Detected exceptions</h2><p>Rows are derived from current submitted requisitions. A missing independent reviewer means no active user other than the requester has both procurement read and approval authority. A missed required date is a business deadline, not a configured approval SLA. Resolve access through authorized role administration or decide the requisition through its source workflow; this screen does not change permissions or approve records.</p></section>
    <section className="panel catalog-form"><label className="field">Search reference or purpose<input className="input" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setApplied(search.trim()); void load(0, search.trim()); } }} /></label><button className="btn" onClick={() => { setApplied(search.trim()); void load(0, search.trim()); }}>Search</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}
    <section className="panel table-wrap"><h2 className="section-title">Open exceptions</h2>{loading ? <p>Loading exceptions...</p> : <table className="data-table"><thead><tr><th>Reference</th><th>Purpose</th><th>Detected issue</th><th>Reviewers</th><th>Required date (UTC)</th><th>Amount</th><th>Source</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.reference}</td><td>{row.purpose}</td><td>{[row.missing_independent_reviewer ? 'No independent reviewer' : '', row.past_required_date ? `${row.days_past_required} day(s) past required date` : ''].filter(Boolean).join('; ')}</td><td>{row.reviewer_count}</td><td>{String(row.required_date).slice(0, 10)}</td><td>BDT {row.amount}</td><td><Link href="/procurement-suppliers/purchase-requisition-list">Open register</Link></td></tr>) : <tr><td colSpan={7}>No submitted requisitions currently match these exception checks.</td></tr>}</tbody></table>}<div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} exceptions</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>
    <p className="muted">This is a live detection view, not a durable exception case register. Source modules beyond Procurement, recovery actions, assignment and exception audit are pending.</p>
  </>;
}
