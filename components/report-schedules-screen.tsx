'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Schedule = { id: string; period_code: string; channel: string | null; frequency: string; run_hour_utc: number; weekday_utc: number | null; status: string; next_run_at: string | null; last_run_at: string | null; error_message: string | null };
type Run = { id: string; status: string; row_count: number; error_message: string | null; created_at: string; completed_at: string | null };
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const label = (value: string) => value.replaceAll('_', ' ');

export function ReportSchedulesScreen() {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [periodCode, setPeriodCode] = useState('previous_day');
  const [frequency, setFrequency] = useState('daily');
  const [runHourUtc, setRunHourUtc] = useState(8);
  const [weekdayUtc, setWeekdayUtc] = useState(1);
  const [channel, setChannel] = useState('');
  const [editingId, setEditingId] = useState('');
  const [runScheduleId, setRunScheduleId] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setRows((await api<{ data: Schedule[] }>('/reports/schedules')).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load schedules'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api(editingId ? `/reports/schedules/${editingId}` : '/reports/schedules', { method: editingId ? 'PATCH' : 'POST', headers: editingId ? {} : { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ periodCode, channel: channel.trim(), frequency, runHourUtc, weekdayUtc: frequency === 'weekly' ? weekdayUtc : null }) }); setEditingId(''); setNotice('Schedule saved. Its CSV jobs will appear in Export Job History after each run.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save schedule'); }
    finally { setBusy(false); }
  }
  async function change(row: Schedule) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/reports/schedules/${row.id}/${row.status === 'active' ? 'pause' : 'resume'}`, { method: 'POST', body: '{}' }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update schedule'); }
    finally { setBusy(false); }
  }
  function edit(row: Schedule) { setEditingId(row.id); setPeriodCode(row.period_code); setFrequency(row.frequency); setRunHourUtc(row.run_hour_utc); setWeekdayUtc(row.weekday_utc ?? 1); setChannel(row.channel || ''); setError(''); setNotice(''); }
  async function remove(row: Schedule) {
    if (!window.confirm('Delete this schedule? Existing export jobs will remain in your history.')) return;
    setBusy(true); setError('');
    try { await api(`/reports/schedules/${row.id}`, { method: 'DELETE' }); if (editingId === row.id) setEditingId(''); if (runScheduleId === row.id) { setRunScheduleId(''); setRuns([]); } await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete schedule'); }
    finally { setBusy(false); }
  }
  async function viewRuns(row: Schedule) {
    setError('');
    try { setRuns((await api<{ data: Run[] }>(`/reports/schedules/${row.id}/runs`)).data); setRunScheduleId(row.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load run history'); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Scheduled Reports</h1><p className="muted">Internal recurring Sales & Returns CSV exports, generated in UTC</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel">{notice}</div>}
    <section className="panel catalog-form"><h2 className="section-title">{editingId ? 'Edit schedule' : 'Create schedule'}</h2><form onSubmit={create}><div className="catalog-form-grid"><label className="field">Period<select className="input" value={periodCode} onChange={event => setPeriodCode(event.target.value)}><option value="previous_day">Previous day</option><option value="previous_7_days">Previous 7 days</option><option value="previous_month">Previous month</option></select></label><label className="field">Frequency<select className="input" value={frequency} onChange={event => setFrequency(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label className="field">Hour (UTC)<input className="input" type="number" min="0" max="23" value={runHourUtc} onChange={event => setRunHourUtc(Number(event.target.value))} /></label>{frequency === 'weekly' && <label className="field">Weekday (UTC)<select className="input" value={weekdayUtc} onChange={event => setWeekdayUtc(Number(event.target.value))}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}<label className="field">Sales channel<input className="input" maxLength={40} value={channel} placeholder="All channels" onChange={event => setChannel(event.target.value)} /></label></div><div className="button-row"><button className="btn btn-primary" disabled={busy}>Save schedule</button>{editingId && <button className="btn" type="button" onClick={() => setEditingId('')}>Cancel edit</button>}</div></form><p className="muted">Generated exports are visible only to the schedule owner. There is no email or external delivery. Current access is checked at every run and download.</p></section>
    <section className="panel table-wrap"><h2 className="section-title">Your schedules</h2>{loading ? <p>Loading schedules...</p> : <table className="data-table"><thead><tr><th>Report</th><th>Period</th><th>Frequency</th><th>Status</th><th>Next run (UTC)</th><th>Last run (UTC)</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>Sales & Returns{row.channel ? ` - ${row.channel}` : ''}</td><td>{label(row.period_code)}</td><td>{row.frequency === 'weekly' ? `${weekdays[row.weekday_utc ?? 0]} at ` : 'Daily at '}{String(row.run_hour_utc).padStart(2, '0')}:00 UTC</td><td>{row.status}{row.error_message && <p className="muted">{row.error_message}</p>}</td><td>{row.next_run_at ? String(row.next_run_at).slice(0, 19) : '-'}</td><td>{row.last_run_at ? String(row.last_run_at).slice(0, 19) : '-'}</td><td><div className="button-row"><button className="btn" disabled={busy} onClick={() => edit(row)}>Edit</button><button className="btn" disabled={busy} onClick={() => void change(row)}>{row.status === 'active' ? 'Pause' : 'Resume'}</button><button className="btn" onClick={() => void viewRuns(row)}>Runs</button><button className="btn" disabled={busy} onClick={() => void remove(row)}>Delete</button></div></td></tr>) : <tr><td colSpan={7}>No schedules yet.</td></tr>}</tbody></table>}</section>
    {runScheduleId && <section className="panel table-wrap"><h2 className="section-title">Execution history</h2><table className="data-table"><thead><tr><th>Queued (UTC)</th><th>Status</th><th>Rows</th><th>Completed (UTC)</th></tr></thead><tbody>{runs.length ? runs.map(run => <tr key={run.id}><td>{String(run.created_at).slice(0, 19)}</td><td>{run.status}{run.error_message && <p>{run.error_message}</p>}</td><td>{run.row_count}</td><td>{run.completed_at ? String(run.completed_at).slice(0, 19) : '-'}</td></tr>) : <tr><td colSpan={4}>This schedule has not run yet.</td></tr>}</tbody></table></section>}
    <p className="muted"><Link href="/reports-analytics/export-job-history">View export job history</Link>.</p>
  </>;
}
