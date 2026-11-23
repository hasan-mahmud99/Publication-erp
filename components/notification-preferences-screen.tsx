'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Preferences = { taskAssignment: { enabled: boolean; configurable: false }; taskReminder: { enabled: boolean; configurable: true; updatedAt: string | null }; email: { configured: false }; sms: { configured: false }; webPush: { configured: false } };
export function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<Preferences | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() { setLoading(true); setError(''); try { setPrefs((await api<{ data: Preferences }>('/notifications/preferences')).data); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load preferences'); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function setReminder(enabled: boolean) { setBusy(true); setError(''); setNotice(''); try { setPrefs((await api<{ data: Preferences }>('/notifications/preferences/task-reminder', { method: 'PUT', body: JSON.stringify({ enabled }) })).data); setNotice('Reminder preference saved and audited.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save reminder preference'); } finally { setBusy(false); } }
  return <>
    <div className="page-heading"><div><h1 className="page-title">User Notification Preferences</h1><p className="muted">Control optional alerts for your own account</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    {loading ? <section className="panel">Loading preferences...</section> : prefs && <><section className="panel catalog-form"><h2 className="section-title">In-app notifications</h2><label className="field"><input type="checkbox" checked={prefs.taskAssignment.enabled} disabled /> Task assignment alerts · required</label><p>Assignments remain visible so recipients can find work assigned to them.</p><label className="field"><input type="checkbox" checked={prefs.taskReminder.enabled} disabled={busy} onChange={event => void setReminder(event.target.checked)} /> General task due-date reminders</label><p className="muted">Changes apply to future reminders. Existing notifications remain in your feed.</p></section><section className="panel"><h2 className="section-title">External channels</h2><p>Email, SMS and web push providers are not configured. They cannot be enabled here, and no external delivery is claimed.</p></section></>}
  </>;
}
