"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Milestone = { id: string; kind: 'book' | 'fair' | 'campaign'; title: string; start_date: string; end_date: string; status: string };
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export function MarketingLaunchPlannerScreen() {
  const today = new Date();
  const [from, setFrom] = useState(() => localDate(today));
  const [to, setTo] = useState(() => { const end = new Date(); end.setMonth(end.getMonth() + 3); return localDate(end); });
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const result = await api<{ data: Milestone[] }>(`/marketing/launches?from=${from}&to=${to}`); setItems(result.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load launch plans'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <><div className="page-heading"><div><h1 className="page-title">Event/Launch Planner</h1><p className="muted">Book publication plans, registered fair events, and campaign schedules from their source records.</p></div></div>
    <section className="panel catalog-form"><div className="button-row"><label className="field">From<input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field">To<input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label><button className="btn btn-primary" disabled={loading || !from || !to || from > to} onClick={() => void load()}>Apply dates</button></div>{error && <p className="alert-error" role="alert">{error}</p>}{loading && <p className="muted">Loading launch plans...</p>}<div className="table-wrap"><table className="data-table"><thead><tr><th>Start</th><th>End</th><th>Source</th><th>Title</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.length ? items.map(item => <tr key={`${item.kind}-${item.id}`}><td>{item.start_date.slice(0, 10)}</td><td>{item.end_date.slice(0, 10)}</td><td>{item.kind === 'book' ? 'Book plan' : item.kind === 'fair' ? 'Fair event' : 'Campaign plan'}</td><td>{item.title}</td><td>{item.status.replaceAll('_', ' ')}</td><td>{item.kind === 'fair' ? <Link className="btn" href={`/book-fair-events/create-edit-fair?event=${item.id}`}>Open fair</Link> : item.kind === 'campaign' ? <Link className="btn" href={`/marketing-promotions/create-campaign?campaign=${item.id}`}>Open campaign</Link> : <Link className="btn" href={`/publishing-catalog/book-detail-and-timeline?book=${item.id}`}>Open book</Link>}</td></tr>) : <tr><td colSpan={6} className="empty">No source milestones found in this date range.</td></tr>}</tbody></table></div><p className="muted">Publication and campaign dates may be draft plans. The planner does not claim a release or event has occurred.</p></section>
  </>;
}
