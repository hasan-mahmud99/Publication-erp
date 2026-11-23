'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Settings = { timezone: string; quietStart: string | null; quietEnd: string | null; channels: { inApp: boolean; email: boolean; sms: boolean; webPush: boolean } };

export function NotificationDeliverySettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const result = (await api<{ data: Settings }>('/notifications/delivery-settings')).data; setSettings(result); setStart(result.quietStart || ''); setEnd(result.quietEnd || ''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load delivery settings'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(quietStart: string | null, quietEnd: string | null) {
    setBusy(true); setError(''); setNotice('');
    try { const result = (await api<{ data: Settings }>('/notifications/delivery-settings', { method: 'PUT', body: JSON.stringify({ quietStart, quietEnd }) })).data; setSettings(result); setStart(result.quietStart || ''); setEnd(result.quietEnd || ''); setNotice('Delivery settings saved.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save delivery settings'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Alert Delivery Preferences</h1><p className="muted">Choose when optional task reminders may reach your in-app inbox</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel"><h2 className="section-title">Available channels</h2>{loading ? <p>Loading channels...</p> : <table className="data-table"><thead><tr><th>Channel</th><th>Availability</th></tr></thead><tbody><tr><td>In-app</td><td>{settings?.channels.inApp ? 'Available' : 'Unavailable'}</td></tr><tr><td>Email</td><td>Not configured</td></tr><tr><td>SMS</td><td>Not configured</td></tr><tr><td>Web push</td><td>Not configured</td></tr></tbody></table>}<p className="muted">External delivery is disabled until a provider is approved and configured. No email, SMS or push message is sent by these settings.</p></section>
    <section className="panel catalog-form"><h2 className="section-title">Reminder quiet hours</h2><p>Optional due-today and due-tomorrow reminders wait until quiet hours end. Task assignment alerts continue immediately. Timezone: {settings?.timezone || 'Loading...'}. The reminder worker checks every five minutes.</p><div className="catalog-form-grid"><label className="field">Quiet hours start<input className="input" type="time" value={start} onChange={event => setStart(event.target.value)} /></label><label className="field">Quiet hours end<input className="input" type="time" value={end} onChange={event => setEnd(event.target.value)} /></label></div><div className="button-row"><button className="btn btn-primary" disabled={busy || !start || !end || start === end} onClick={() => void save(start, end)}>Save quiet hours</button><button className="btn" disabled={busy} onClick={() => void save(null, null)}>Clear quiet hours</button></div></section>
  </>;
}
