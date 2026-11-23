"use client";

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Health = { databaseReachable: boolean; activeSessions: number; recordedNotificationJobs: number; latestNotificationJobStart: string | null; observedAt: string };

export function AdminHealthScreen() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setHealth((await api<{ data: Health }>('/admin/system-health')).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Health check failed'); setHealth(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <>
    <div className="page-heading"><div><h1 className="page-title">System Health & Job Monitoring</h1><p className="muted">Live application database and recorded job diagnostics for this organization.</p></div><button className="btn" onClick={() => void load()}>Refresh checks</button></div>
    {error && <p className="alert-error" role="alert">{error}</p>}
    {loading ? <div className="panel empty">Checking system health…</div> : health && <>
      <div className="stat-grid"><div className="panel stat"><div className="stat-label">Database</div><div className="stat-value">{health.databaseReachable ? 'Reachable' : 'Unavailable'}</div></div><div className="panel stat"><div className="stat-label">Active sessions</div><div className="stat-value">{health.activeSessions}</div></div><div className="panel stat"><div className="stat-label">Recorded notification jobs</div><div className="stat-value">{health.recordedNotificationJobs}</div></div></div>
      <section className="panel catalog-form"><h2 className="section-title">Check details</h2><p>Observed at {health.observedAt.slice(0, 19).replace('T', ' ')} UTC.</p><p>Latest recorded notification job: {health.latestNotificationJobStart ? String(health.latestNotificationJobStart).slice(0, 19).replace('T', ' ') + ' UTC' : 'None recorded'}</p><p className="muted">These checks do not verify backups, delivery providers, or disaster recovery.</p></section>
    </>}
  </>;
}
