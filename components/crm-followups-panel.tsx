"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Followup = { id: string; customer_id: string; customer_name: string; subject: string; due_date: string; assigned_to: string; assignee_name: string; status: string; outcome: string | null; version_no: number };
type Assignee = { id: string; display_name: string };

export function CrmFollowupsPanel({ customerId, canCreate, canUpdate }: { customerId: string; canCreate: boolean; canUpdate: boolean }) {
  const [rows, setRows] = useState<Followup[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [mine, setMine] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [outcome, setOutcome] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = rows.find(row => row.id === selectedId);
  async function load() {
    const params = new URLSearchParams({ customerId, mine: String(mine), limit: '100' });
    const [tasks, people] = await Promise.all([api<{ data: Followup[] }>(`/crm/followups?${params}`), api<{ data: Assignee[] }>('/crm/leads/assignees')]);
    setRows(tasks.data); setAssignees(people.data);
  }
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load follow-ups')); }, [customerId, mine]);
  async function act(action: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function create() {
    await act(async () => { await api('/crm/followups', { method: 'POST', body: JSON.stringify({ customerId, subject, dueDate, assignedTo: assignee || undefined }) }); setSubject(''); setDueDate(''); }, 'Follow-up assigned');
  }
  async function update(status: 'open' | 'completed' | 'cancelled') {
    if (!selected) return;
    await act(async () => { await api(`/crm/followups/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ version: selected.version_no, status, dueDate: newDueDate || undefined, assignedTo: newAssignee || undefined, outcome: outcome || undefined }) }); setSelectedId(''); setOutcome(''); }, status === 'open' ? 'Follow-up updated' : `Follow-up ${status}`);
  }
  return <section className="panel catalog-form"><h2 className="section-title">Customer follow-ups</h2><p className="muted">Assigned tasks have a due date and a recorded outcome. Completed and cancelled tasks remain in the history.</p>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {canCreate && <div className="catalog-form-grid"><label className="field">Follow-up subject<input className="input" value={subject} onChange={event => setSubject(event.target.value)} /></label><label className="field">Due date<input className="input" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label><label className="field">Assign to<select className="input" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">My account</option>{assignees.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label><button className="btn btn-primary" disabled={busy || !subject.trim() || !dueDate} onClick={() => void create()}>Assign follow-up</button></div>}
    <label className="field"><input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)} /> My assigned tasks only</label>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Subject</th><th>Due</th><th>Owner</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{rows.length ? rows.map(item => <tr key={item.id} onClick={() => { setSelectedId(item.id); setNewDueDate(item.due_date.slice(0, 10)); setNewAssignee(item.assigned_to); setOutcome(item.outcome || ''); }} style={{ cursor: 'pointer' }}><td>{item.subject}</td><td>{item.due_date.slice(0, 10)}</td><td>{item.assignee_name}</td><td>{item.status}</td><td>{item.outcome || '—'}</td></tr>) : <tr><td colSpan={5} className="empty">No follow-ups recorded.</td></tr>}</tbody></table></div>
    {selected && selected.status === 'open' && canUpdate && <div className="panel catalog-form"><h3>Update: {selected.subject}</h3><div className="catalog-form-grid"><label className="field">Revised due date<input className="input" type="date" value={newDueDate} onChange={event => setNewDueDate(event.target.value)} /></label><label className="field">Assigned to<select className="input" value={newAssignee} onChange={event => setNewAssignee(event.target.value)}>{assignees.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label><label className="field">Outcome or cancellation reason<input className="input" value={outcome} onChange={event => setOutcome(event.target.value)} /></label></div><div className="button-row"><button className="btn" disabled={busy} onClick={() => void update('open')}>Save changes</button><button className="btn btn-primary" disabled={busy || !outcome.trim()} onClick={() => void update('completed')}>Complete follow-up</button><button className="btn" disabled={busy || !outcome.trim()} onClick={() => void update('cancelled')}>Cancel follow-up</button></div></div>}
  </section>;
}
