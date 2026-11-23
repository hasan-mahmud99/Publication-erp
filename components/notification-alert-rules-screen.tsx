'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Rule = { ruleKey: 'task_due_today' | 'task_due_tomorrow'; name: string; description: string; enabled: boolean; updatedAt: string | null };

export function NotificationAlertRulesScreen() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setRules((await api<{ data: Rule[] }>('/notifications/alert-rules')).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load alert rules'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function setEnabled(rule: Rule) {
    setBusy(rule.ruleKey); setError(''); setNotice('');
    try {
      const result = await api<{ data: Rule[] }>(`/notifications/alert-rules/${rule.ruleKey}`, { method: 'PUT', body: JSON.stringify({ enabled: !rule.enabled }) });
      setRules(result.data); setNotice(`${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save alert rule'); }
    finally { setBusy(null); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Alert Rules</h1><p className="muted">Control the supported task reminder events for this organization</p></div><button className="btn" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel"><h2 className="section-title">Active event rules</h2><p className="muted">Task assignment alerts are mandatory. These two optional reminders use the recipient's reminder preference and the organization's timezone. Only in-app delivery is configured.</p>
      {loading ? <p>Loading rules...</p> : <table className="data-table"><thead><tr><th>Event</th><th>Purpose</th><th>Status</th><th>Last changed (UTC)</th><th>Action</th></tr></thead><tbody>{rules.map(rule => <tr key={rule.ruleKey}><td>{rule.name}</td><td>{rule.description}</td><td>{rule.enabled ? 'Enabled' : 'Disabled'}</td><td>{rule.updatedAt ? String(rule.updatedAt).slice(0, 19) : 'Organization default'}</td><td><button className="btn" disabled={busy !== null} onClick={() => void setEnabled(rule)}>{rule.enabled ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table>}
    </section>
  </>;
}
