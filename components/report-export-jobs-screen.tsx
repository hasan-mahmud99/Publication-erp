'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, apiFile } from '@/lib/api';

type Job = { id: string; report_code: string; filters_json: { from: string; to: string; channel?: string }; status: string; row_count: number; created_at: string; completed_at?: string; expires_at?: string; error_message?: string };
export function ReportExportJobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load(nextOffset = offset) {
    setLoading(true); setError('');
    try { const result = await api<{ data: Job[]; meta: { total: number } }>(`/reports/export-jobs?limit=20&offset=${nextOffset}`); setJobs(result.data); setTotal(result.meta.total); setOffset(nextOffset); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load export jobs'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(offset); const timer = setInterval(() => void load(offset), 5000); return () => clearInterval(timer); }, [offset]);
  async function download(job: Job) {
    setError('');
    try { const blob = await apiFile(`/reports/export-jobs/${job.id}/download`); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `sales-returns-${job.id}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Download failed'); }
  }
  async function retry(job: Job) {
    setError('');
    try { await api(`/reports/export-jobs/${job.id}/retry`, { method: 'POST', body: '{}' }); await load(0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not retry export'); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Export Job History</h1><p className="muted">Your permission-checked report exports and their processing status</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}
    {loading && !jobs.length ? <div className="panel empty">Loading export jobs...</div> : <section className="panel table-wrap"><table className="data-table"><thead><tr><th>Created (UTC)</th><th>Report</th><th>Source dates</th><th>Status</th><th>Rows</th><th>Expires (UTC)</th><th>Action</th></tr></thead><tbody>{jobs.length ? jobs.map(job => <tr key={job.id}><td>{String(job.created_at).slice(0, 19)}</td><td>Sales & Returns</td><td>{job.filters_json.from} to {job.filters_json.to}</td><td>{job.status}{job.error_message && <p className="muted">{job.error_message}</p>}</td><td>{job.row_count}</td><td>{job.expires_at ? String(job.expires_at).slice(0, 19) : '-'}</td><td>{job.status === 'ready' && <button className="btn" onClick={() => void download(job)}>Download CSV</button>}{job.status === 'failed' && <button className="btn" onClick={() => void retry(job)}>Retry</button>}</td></tr>) : <tr><td colSpan={7}>No export jobs yet. Create one from the Sales & Returns report.</td></tr>}</tbody></table><div className="button-row"><button className="btn" disabled={!offset} onClick={() => void load(Math.max(0, offset - 20))}>Previous</button><span>{total} jobs</span><button className="btn" disabled={offset + 20 >= total} onClick={() => void load(offset + 20)}>Next</button></div></section>}
    <p className="muted">Downloads expire after seven days. Export creation and download require current sales and export permissions. <Link href="/reports-analytics/sales-and-returns-reports">Open Sales & Returns Reports</Link>.</p>
  </>;
}
