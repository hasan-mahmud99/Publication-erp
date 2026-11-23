"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Book = { id: string; book_code: string | null; title: string };
type Discontinuation = { id: string; book_id: string; book_code: string | null; title: string; publisher_name: string | null; reason: string; remaining_stock_policy: string; status: string; requested_at: string; decided_at: string | null; decision_note: string | null; open_print_orders: number; on_hand_qty: string };
type Candidate = { book_a_id: string; book_a_code: string | null; book_a_title: string; book_a_publisher_id: string | null; book_a_language: string; book_a_authors: string | null; book_b_id: string; book_b_code: string | null; book_b_title: string; book_b_publisher_id: string | null; book_b_language: string; book_b_authors: string | null; decision: string | null; decision_reason: string | null; reviewer_name: string | null };

export function CatalogReviewScreen({ screen }: { screen: Screen }) {
  const isDiscontinued = screen.title === 'Discontinued Titles';
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [reason, setReason] = useState('');
  const [stockPolicy, setStockPolicy] = useState('hold_existing');
  const [decisionNote, setDecisionNote] = useState('');
  const [rows, setRows] = useState<Discontinuation[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reviewPair, setReviewPair] = useState('');
  const [reviewDecision, setReviewDecision] = useState('needs_investigation');
  const [reviewReason, setReviewReason] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');
  const canApprove = role === 'Owner' || permissions.includes('workspace.approve');
  async function load() {
    setLoading(true); setError('');
    try {
      const me = await api<{ data: { role: string; permissions: string[] } }>('/auth/me');
      setRole(me.data.role); setPermissions(me.data.permissions);
      if (isDiscontinued) {
        const [result, active] = await Promise.all([
          api<{ data: Discontinuation[] }>('/catalog/discontinuations'),
          api<{ data: Book[] }>('/books?status=active&limit=100'),
        ]);
        setRows(result.data); setBooks(active.data);
        setBookId(current => active.data.some(item => item.id === current) ? current : active.data[0]?.id || '');
      } else {
        const result = await api<{ data: Candidate[] }>('/catalog/duplicate-candidates');
        setCandidates(result.data);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load catalog review data'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [screen.id]);
  async function act(request: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await request(); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed'); }
    finally { setBusy(false); }
  }
  const selectedCandidate = candidates.find(item => `${item.book_a_id}:${item.book_b_id}` === reviewPair);
  return <>
    <div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{isDiscontinued ? 'Review title lifecycle decisions without deleting publication history.' : 'Review probable duplicate books before any catalog change.'}</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div role="alert" className="alert-error">{error}</div>}{notice && <div role="status" className="alert-success">{notice}</div>}
    {isDiscontinued ? <>
      {canUpdate && <section className="panel catalog-form"><h2 className="section-title">Request discontinuation</h2><div className="catalog-form-grid"><label className="field">Active book<select className="input" value={bookId} onChange={event => setBookId(event.target.value)}>{books.map(item => <option key={item.id} value={item.id}>{item.book_code || '—'} · {item.title}</option>)}</select></label><label className="field">Remaining stock policy<select className="input" value={stockPolicy} onChange={event => setStockPolicy(event.target.value)}><option value="hold_existing">Hold existing stock</option><option value="sell_existing">Allow selling existing stock</option></select></label></div><label className="field">Reason<textarea className="input" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} /></label><p className="muted">Open print orders must be resolved before approval. Existing stock is retained.</p><button className="btn btn-primary" disabled={busy || !bookId || reason.trim().length < 10} onClick={() => void act(async () => { await api('/catalog/discontinuations', { method: 'POST', body: JSON.stringify({ bookId, reason: reason.trim(), remainingStockPolicy: stockPolicy }) }); setReason(''); }, 'Discontinuation request recorded.')}>Submit request</button></section>}
      <section className="panel catalog-form"><h2 className="section-title">Title lifecycle register</h2>{canApprove && <label className="field">Decision or reactivation note<input className="input" value={decisionNote} maxLength={1000} onChange={event => setDecisionNote(event.target.value)} placeholder="Explain the decision (at least 10 characters for reactivation)" /></label>}<div className="table-wrap"><table className="data-table"><thead><tr><th>Book</th><th>Status</th><th>Reason</th><th>Stock policy</th><th>On hand</th><th>Open print orders</th><th>Requested</th><th>Actions</th></tr></thead><tbody>{rows.length ? rows.map(item => <tr key={item.id}><td><Link href={`/publishing-catalog/book-detail-and-timeline?book=${item.book_id}`}>{item.book_code || '—'} · {item.title}</Link><div className="muted">{item.publisher_name || 'No publisher'}</div></td><td>{item.status}</td><td>{item.reason}{item.decision_note && <div className="muted">Decision: {item.decision_note}</div>}</td><td>{item.remaining_stock_policy.replaceAll('_', ' ')}</td><td>{item.on_hand_qty}</td><td>{item.open_print_orders}</td><td>{String(item.requested_at).slice(0, 10)}</td><td>{canApprove && item.status === 'pending' ? <div className="button-row"><button className="btn btn-primary" disabled={busy || decisionNote.trim().length < 5 || item.open_print_orders > 0} onClick={() => void act(() => api(`/catalog/discontinuations/${item.id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'approved', note: decisionNote.trim() }) }), 'Title discontinued.')}>Approve</button><button className="btn" disabled={busy || decisionNote.trim().length < 5} onClick={() => void act(() => api(`/catalog/discontinuations/${item.id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'rejected', note: decisionNote.trim() }) }), 'Request rejected.')}>Reject</button></div> : canApprove && item.status === 'approved' ? <button className="btn" disabled={busy || decisionNote.trim().length < 10} onClick={() => void act(() => api(`/catalog/discontinuations/${item.id}/reactivate`, { method: 'POST', body: JSON.stringify({ reason: decisionNote.trim() }) }), 'Title reactivated.')}>Reactivate</button> : '—'}</td></tr>) : <tr><td className="empty" colSpan={8}>{loading ? 'Loading requests…' : 'No discontinuation requests yet.'}</td></tr>}</tbody></table></div></section>
    </> : <>
      <p className="muted">Exact normalized title matches are candidates, not confirmed duplicates. ISBN conflicts are blocked at identifier registration. This review records a decision and does not merge books.</p>
      <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Book A</th><th>Book B</th><th>Publisher</th><th>Author</th><th>Language</th><th>Review</th></tr></thead><tbody>{candidates.length ? candidates.map(item => <tr key={`${item.book_a_id}:${item.book_b_id}`}><td><Link href={`/publishing-catalog/book-detail-and-timeline?book=${item.book_a_id}`}>{item.book_a_code || '—'} · {item.book_a_title}</Link></td><td><Link href={`/publishing-catalog/book-detail-and-timeline?book=${item.book_b_id}`}>{item.book_b_code || '—'} · {item.book_b_title}</Link></td><td>{item.book_a_publisher_id && item.book_a_publisher_id === item.book_b_publisher_id ? 'Same' : 'Different or missing'}</td><td>{item.book_a_authors && item.book_a_authors === item.book_b_authors ? 'Same' : 'Different or missing'}</td><td>{item.book_a_language === item.book_b_language ? 'Same' : 'Different'}</td><td><button className="btn" onClick={() => { setReviewPair(`${item.book_a_id}:${item.book_b_id}`); setReviewDecision(item.decision || 'needs_investigation'); setReviewReason(item.decision_reason || ''); }}>{item.decision || 'Review'}</button></td></tr>) : <tr><td className="empty" colSpan={6}>{loading ? 'Looking for candidates…' : 'No matching title pairs.'}</td></tr>}</tbody></table></div>
      {selectedCandidate && <section className="panel catalog-form"><h2 className="section-title">Review selected pair</h2><p>{selectedCandidate.book_a_title} · {selectedCandidate.book_a_code || '—'} / {selectedCandidate.book_b_title} · {selectedCandidate.book_b_code || '—'}</p><p className="muted">Previous reviewer: {selectedCandidate.reviewer_name || 'None'}</p><label className="field">Decision<select className="input" value={reviewDecision} onChange={event => setReviewDecision(event.target.value)}><option value="needs_investigation">Needs investigation</option><option value="keep_separate">Keep separate</option><option value="false_positive">False positive</option></select></label><label className="field">Reason<textarea className="input" rows={3} maxLength={1000} value={reviewReason} onChange={event => setReviewReason(event.target.value)} /></label>{canApprove && <button className="btn btn-primary" disabled={busy || reviewReason.trim().length < 10} onClick={() => void act(() => api('/catalog/duplicate-decisions', { method: 'POST', body: JSON.stringify({ bookAId: selectedCandidate.book_a_id, bookBId: selectedCandidate.book_b_id, decision: reviewDecision, reason: reviewReason.trim() }) }), 'Duplicate review saved.')}>Save review</button>}</section>}
    </>}
  </>;
}
