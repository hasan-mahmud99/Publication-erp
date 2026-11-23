'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = Record<string, any>;
const date = (value: unknown) => String(value || '').slice(0, 10);
export function WorkflowInboxScreen({ mode }: { mode: 'inbox' | 'history' }) {
  const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(''), [applied, setApplied] = useState('');
  const [detail, setDetail] = useState<Row | null>(null), [note, setNote] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load(nextOffset = offset, query = applied) {
    setLoading(true); setError('');
    try { const result = await api<{ data: Row[]; meta: { total: number } }>(`/workflow/${mode}?limit=20&offset=${nextOffset}&search=${encodeURIComponent(query)}`); setRows(result.data); setTotal(result.meta.total); setOffset(nextOffset); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load workflow records'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0, ''); setDetail(null); }, [mode]);
  async function open(id: string) {
    setError(''); setNotice('');
    try { setDetail((await api<{ data: Row }>(`/workflow/requests/${id}`)).data); setNote(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open request'); }
  }
  async function decide(action: 'approve' | 'reject') {
    if (!detail) return;
    setBusy(true); setError(''); setNotice('');
    try { const result = await api<{ data: Row }>(`/workflow/requests/${detail.id}/${action}`, { method: 'POST', body: JSON.stringify({ note: note.trim() }) }); setDetail(result.data); setNotice(`Requisition ${result.data.status}. Source status and audit history updated.`); await load(0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Decision failed'); }
    finally { setBusy(false); }
  }
  const inbox = mode === 'inbox';
  return <>
    <div className="page-heading"><div><h1 className="page-title">{inbox ? 'Approval Inbox' : 'Workflow History'}</h1><p className="muted">{inbox ? 'Submitted purchase requisitions eligible for your independent review' : 'Purchase requisitions you submitted or decided'}</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel catalog-form"><label className="field">Search reference or purpose<input className="input" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setApplied(search.trim()); void load(0, search.trim()); } }} /></label><button className="btn" onClick={() => { setApplied(search.trim()); void load(0, search.trim()); }}>Search</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel">{notice}</div>}
    <section className="panel table-wrap"><h2 className="section-title">{inbox ? 'Pending my action' : 'Completed decisions'}</h2>{loading ? <p>Loading requests...</p> : <table className="data-table"><thead><tr><th>Reference</th><th>Purpose</th><th>Amount</th><th>Priority</th><th>{inbox ? 'Submitted' : 'Decided'}</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.reference}</td><td>{row.purpose}</td><td>BDT {row.amount}</td><td>{row.priority || '-'}</td><td>{date(inbox ? row.submitted_at : row.decided_at)}</td><td>{row.status}</td><td><button className="btn" onClick={() => void open(row.id)}>Review</button></td></tr>) : <tr><td colSpan={7}>No {inbox ? 'actionable' : 'completed'} requisitions match.</td></tr>}</tbody></table>}<div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} requests</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>
    {detail && <section className="panel catalog-form"><h2 className="section-title">{detail.requisition_number}</h2><p>{detail.purpose}</p><p>Status: {detail.status}. Estimated total: BDT {detail.estimated_total}. Department: {detail.department || 'Not set'}. Branch: {detail.branch_name || 'Organization-wide'}.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Quantity</th><th>Estimated amount</th></tr></thead><tbody>{detail.lines?.map((line: Row) => <tr key={line.id}><td>{line.item_code} - {line.item_name}</td><td>{line.quantity} {line.uom}</td><td>BDT {line.estimated_amount}</td></tr>)}</tbody></table></div><h3 className="section-title">Audit history</h3>{detail.history?.map((event: Row, index: number) => <p key={index}>{date(event.occurred_at)} - {event.action} - {event.actor_id.slice(0, 8)}{event.metadata?.note ? `: ${event.metadata.note}` : ''}</p>)}<Link href="/procurement-suppliers/purchase-requisition-list">Open source register</Link>{inbox && detail.status === 'submitted' && <div className="catalog-form"><label className="field">Decision comment<input className="input" minLength={10} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Explain the decision (at least 10 characters)" /></label><div className="button-row"><button className="btn btn-primary" disabled={busy || note.trim().length < 10} onClick={() => void decide('approve')}>Approve</button><button className="btn" disabled={busy || note.trim().length < 10} onClick={() => void decide('reject')}>Reject</button></div></div>}</section>}
    <p className="muted">This inbox currently integrates purchase requisitions through their existing source approval service. Other modules retain their own approval screens until their source contracts are integrated.</p>
  </>;
}
