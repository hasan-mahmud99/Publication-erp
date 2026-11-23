"use client";

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Session = { id: string; user_id: string; email: string; display_name: string; issued_at: string; expires_at: string; revoked_at: string | null; active: number; current: boolean };
const time = (value: string) => String(value).slice(0, 19).replace('T', ' ');

export function AdminSessionScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSessions((await api<{ data: Session[] }>('/admin/sessions')).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load sessions'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function revoke(id: string) {
    if (!window.confirm('Revoke this session now? The user will need to sign in again.')) return;
    setBusy(id); setError(''); setNotice('');
    try { await api(`/admin/sessions/${id}/revoke`, { method: 'POST' }); setNotice('Session revoked'); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not revoke session'); }
    finally { setBusy(''); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Session & MFA Policy</h1><p className="muted">Review organization sessions and revoke access. MFA policy is not configured.</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    <section className="panel catalog-form"><h2 className="section-title">Multi-factor authentication</h2><p className="muted">MFA enrolment and enforcement are unavailable. No account is represented as MFA protected.</p></section>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {loading ? <div className="panel empty">Loading sessions…</div> : <div className="panel table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Issued (UTC)</th><th>Expires (UTC)</th><th>Status</th><th>Action</th></tr></thead><tbody>{sessions.length ? sessions.map(session => {
      const active = session.active === 1;
      return <tr key={session.id}><td>{session.display_name}<br /><span className="muted">{session.email}</span></td><td>{time(session.issued_at)}</td><td>{time(session.expires_at)}</td><td>{session.revoked_at ? 'Revoked' : active ? session.current ? 'Current session' : 'Active' : 'Expired'}</td><td><button className="btn" disabled={!active || session.current || !!busy} onClick={() => void revoke(session.id)}>Revoke</button></td></tr>;
    }) : <tr><td colSpan={5} className="empty">No sessions recorded.</td></tr>}</tbody></table></div>}
  </>;
}
