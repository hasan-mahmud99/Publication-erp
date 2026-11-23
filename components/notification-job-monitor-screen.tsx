'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Run = { id: string; status: string; started_at: string; finished_at: string | null; scanned_count: number; created_count: number; skipped_count: number; error_message: string | null };
export function NotificationJobMonitorScreen() {
  const [rows, setRows] = useState<Run[]>([]), [total, setTotal] = useState(0), [offset, setOffset] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load(nextOffset = offset) {
    setLoading(true); setError('');
    try { const result = await api<{ data: Run[]; meta: { total: number } }>(`/notifications/jobs?limit=20&offset=${nextOffset}`); setRows(result.data); setTotal(result.meta.total); setOffset(nextOffset); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load job runs'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0); }, []);
  async function runNow() {
    setBusy(true); setError(''); setNotice('');
    try { const result = await api<{ data: { status: string; scanned: number; created: number; skipped: number } }>('/notifications/jobs/reminders/run', { method: 'POST', body: '{}' }); setNotice(result.data.status === 'running_elsewhere' ? 'A reminder run is already active.' : `Reminder run finished: ${result.data.scanned} scanned, ${result.data.created} new in-app alerts, ${result.data.skipped} skipped or already recorded.`); await load(0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Reminder run failed'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Scheduled Job Monitor</h1><p className="muted">Tenant-scoped task reminder runs</p></div><div className="button-row"><button className="btn" onClick={() => void load()}>Refresh</button><button className="btn btn-primary" disabled={busy} onClick={() => void runNow()}>Run reminders now</button></div></div>
    <section className="panel"><h2 className="section-title">Reminder schedule</h2><p>The server checks active general tasks every five minutes for due-today and due-tomorrow alerts in the organization's configured timezone. A database lock and unique event key prevent duplicate in-app notifications. Optional reminders follow each recipient's preference. No email, SMS or push job is active.</p></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel table-wrap"><h2 className="section-title">Run history</h2>{loading ? <p>Loading runs...</p> : <table className="data-table"><thead><tr><th>Started (UTC)</th><th>Status</th><th>Scanned</th><th>Created</th><th>Skipped</th><th>Finished (UTC)</th><th>Error</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{String(row.started_at).slice(0, 19)}</td><td>{row.status}</td><td>{row.scanned_count}</td><td>{row.created_count}</td><td>{row.skipped_count}</td><td>{row.finished_at ? String(row.finished_at).slice(0, 19) : 'Running'}</td><td>{row.error_message || '—'}</td></tr>) : <tr><td colSpan={7}>No reminder job runs recorded yet.</td></tr>}</tbody></table>}<div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} runs</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>
  </>;
}
