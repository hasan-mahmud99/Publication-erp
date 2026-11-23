'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Notice = { id: string; category: string; priority: string; title: string; body: string; created_at: string; read_at: string | null; archived_at: string | null; action_path?: string | null };
const changed = () => window.dispatchEvent(new Event('notifications:changed'));
export function NotificationCenterScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Notice[]>([]), [selected, setSelected] = useState<Notice | null>(null);
  const [total, setTotal] = useState(0), [unread, setUnread] = useState(0), [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('all'), [category, setCategory] = useState(''), [search, setSearch] = useState(''), [applied, setApplied] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load(nextOffset = offset, query = applied) {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ status, category, search: query, limit: '20', offset: String(nextOffset) });
      const [feed, count] = await Promise.all([api<{ data: Notice[]; meta: { total: number } }>(`/notifications?${params}`), api<{ data: { unread: number } }>('/notifications/unread-count')]);
      setRows(feed.data); setTotal(feed.meta.total); setUnread(count.data.unread); setOffset(nextOffset); changed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load notifications'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0, ''); }, [status, category]);
  async function open(id: string) {
    setError(''); setNotice('');
    try { setSelected((await api<{ data: Notice }>(`/notifications/${id}`)).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Notification is unavailable'); }
  }
  async function act(id: string, action: 'read' | 'unread' | 'archive' | 'restore') {
    setBusy(true); setError('');
    try { const result = await api<{ data: Notice }>(`/notifications/${id}/${action}`, { method: 'POST', body: '{}' }); setSelected(result.data); setNotice(`Notification ${action === 'read' ? 'marked as read' : action === 'unread' ? 'marked as unread' : action === 'archive' ? 'archived' : 'restored'}.`); await load(0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Notification action failed'); }
    finally { setBusy(false); }
  }
  async function markAll() {
    setBusy(true); setError('');
    try { const result = await api<{ data: { updated: number } }>('/notifications/mark-all-read', { method: 'POST', body: '{}' }); setNotice(`${result.data.updated} notifications marked as read.`); await load(0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read'); }
    finally { setBusy(false); }
  }
  async function follow() {
    if (!selected) return;
    if (!selected.action_path) { setError('This source record is unavailable or you no longer have access.'); return; }
    if (!selected.read_at) await act(selected.id, 'read');
    router.push(selected.action_path);
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Notification Center</h1><p className="muted">Your in-app alerts · {unread} unread</p></div><div className="button-row"><button className="btn" onClick={() => void load()}>Refresh</button><button className="btn" disabled={busy || !unread} onClick={() => void markAll()}>Mark all read</button></div></div>
    <section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">Status<select className="input" value={status} onChange={event => setStatus(event.target.value)}>{['all', 'unread', 'read', 'archived'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field">Category<select className="input" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option><option value="task_assignment">Task assignment</option><option value="task_reminder">Task reminder</option></select></label><label className="field">Search title or message<input className="input" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setApplied(search.trim()); void load(0, search.trim()); } }} /></label></div><button className="btn" onClick={() => { setApplied(search.trim()); void load(0, search.trim()); }}>Search</button></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel table-wrap"><h2 className="section-title">Personal feed</h2>{loading ? <p>Loading notifications...</p> : <table className="data-table"><thead><tr><th>Title</th><th>Message</th><th>Category</th><th>Created (UTC)</th><th>Read</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><strong>{row.title}</strong></td><td>{row.body}</td><td>{row.category.replaceAll('_', ' ')}</td><td>{String(row.created_at).slice(0, 19)}</td><td>{row.read_at ? 'Yes' : 'No'}</td><td><button className="btn" onClick={() => void open(row.id)}>Open</button></td></tr>) : <tr><td colSpan={6}>No notifications match these filters.</td></tr>}</tbody></table>}<div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} notifications</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>
    {selected && <section className="panel catalog-form"><h2 className="section-title">{selected.title}</h2><p>{selected.body}</p><p>Category: {selected.category.replaceAll('_', ' ')}. Priority: {selected.priority}. Created: {String(selected.created_at).slice(0, 19)} UTC.</p><div className="button-row"><button className="btn btn-primary" disabled={busy || !selected.action_path} onClick={() => void follow()}>Open related record</button><button className="btn" disabled={busy} onClick={() => void act(selected.id, selected.read_at ? 'unread' : 'read')}>{selected.read_at ? 'Mark unread' : 'Mark read'}</button><button className="btn" disabled={busy} onClick={() => void act(selected.id, selected.archived_at ? 'restore' : 'archive')}>{selected.archived_at ? 'Restore' : 'Archive'}</button></div>{!selected.action_path && <p className="muted">The related record is unavailable or you no longer have access.</p>}</section>}
    <p className="muted">In-app delivery is active. Email, SMS and push are not configured and are never reported as delivered. <Link href="/notifications-tasks/notification-delivery-history">View delivery history</Link>.</p>
  </>;
}
