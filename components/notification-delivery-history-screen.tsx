'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Attempt = { id: string; notification_id: string; channel: string; status: string; provider: string | null; error_message: string | null; attempted_at: string; title: string };
export function NotificationDeliveryHistoryScreen() {
  const [rows, setRows] = useState<Attempt[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0), [channel, setChannel] = useState(''), [status, setStatus] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function load(nextOffset = offset) {
    setLoading(true); setError('');
    try { const params = new URLSearchParams({ limit: '20', offset: String(nextOffset) }); if (channel) params.set('channel', channel); if (status) params.set('status', status); const result = await api<{ data: Attempt[]; meta: { total: number } }>(`/notifications/delivery-history?${params}`); setRows(result.data); setTotal(result.meta.total); setOffset(nextOffset); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load delivery history'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0); }, [channel, status]);
  return <>
    <div className="page-heading"><div><h1 className="page-title">Notification Delivery History</h1><p className="muted">Actual delivery attempts for your notifications</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel"><h2 className="section-title">Channel status</h2><p>In-app notifications are available after commit and have a recorded delivery attempt. Email, SMS and push providers are not configured. No external message is represented as sent or delivered.</p></section>
    <section className="panel catalog-form"><div className="catalog-form-grid"><label className="field">Channel<select className="input" value={channel} onChange={event => setChannel(event.target.value)}><option value="">All channels</option><option value="in_app">In-app</option><option value="email">Email</option><option value="sms">SMS</option><option value="web_push">Web push</option></select></label><label className="field">Status<select className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['available', 'skipped', 'queued', 'failed', 'accepted'].map(value => <option key={value}>{value}</option>)}</select></label></div></section>
    {error && <div className="alert-error" role="alert">{error}</div>}
    <section className="panel table-wrap"><h2 className="section-title">Recorded attempts</h2>{loading ? <p>Loading attempts...</p> : <table className="data-table"><thead><tr><th>Notification</th><th>Channel</th><th>Status</th><th>Provider</th><th>Attempted (UTC)</th><th>Error</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.title}</td><td>{row.channel.replaceAll('_', ' ')}</td><td>{row.status}</td><td>{row.provider || '—'}</td><td>{String(row.attempted_at).slice(0, 19)}</td><td>{row.error_message || '—'}</td></tr>) : <tr><td colSpan={6}>No delivery attempts match.</td></tr>}</tbody></table>}<div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} attempts</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>
  </>;
}
