"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Case = { id: string; case_type: string; subject: string; description: string | null; status: string; resolution: string | null; assigned_to: string | null; assignee_name: string | null; due_date: string | null; escalated_at: string | null; version_no: number };
type Assignee = { id: string; display_name: string };
type Event = { action: string; metadata_json: unknown; actor_name: string | null; occurred_at: string };
export function CrmCasesPanel({ customerId, canCreate, canUpdate, canApprove, onChange }: { customerId: string; canCreate: boolean; canUpdate: boolean; canApprove: boolean; onChange: () => Promise<void> }) {
  const [rows, setRows] = useState<Case[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [type, setType] = useState('complaint');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [resolution, setResolution] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = rows.find(row => row.id === selectedId);
  async function load() {
    const [cases, people] = await Promise.all([api<{ data: Case[] }>(`/crm/cases?customerId=${customerId}&limit=100`), api<{ data: Assignee[] }>('/crm/leads/assignees')]);
    setRows(cases.data); setAssignees(people.data);
  }
  async function loadHistory(id: string) { const result = await api<{ data: Event[] }>(`/crm/cases/${id}/history`); setEvents(result.data); }
  useEffect(() => { setSelectedId(''); void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load cases')); }, [customerId]);
  function select(item: Case) { setSelectedId(item.id); setEditAssignee(item.assigned_to || ''); setEditDueDate(item.due_date?.slice(0, 10) || ''); setResolution(item.resolution || ''); void loadHistory(item.id).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load case history')); }
  async function act(action: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); if (selectedId) await loadHistory(selectedId); await onChange(); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function create() { await act(async () => { await api('/crm/cases', { method: 'POST', body: JSON.stringify({ customerId, type, subject, description: description || null, dueDate: dueDate || null, assignedTo: assignee || undefined }) }); setSubject(''); setDescription(''); setDueDate(''); }, 'Case opened'); }
  async function assign() { if (!selected) return; await act(async () => { await api(`/crm/cases/${selected.id}/assignment`, { method: 'PATCH', body: JSON.stringify({ version: selected.version_no, assignedTo: editAssignee, dueDate: editDueDate || null }) }); }, 'Case assignment updated'); }
  async function changeStatus(status: 'in_review' | 'resolved' | 'closed') { if (!selected) return; await act(async () => { await api(`/crm/cases/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ version: selected.version_no, status, resolution: status === 'resolved' ? resolution : undefined }) }); }, `Case ${status.replace('_', ' ')}`); }
  async function escalate() { if (!selected) return; await act(async () => { await api(`/crm/cases/${selected.id}/escalate`, { method: 'POST', body: JSON.stringify({ version: selected.version_no, reason: escalationReason }) }); setEscalationReason(''); }, 'Case escalated'); }
  return <section className="panel catalog-form"><h2 className="section-title">Customer cases</h2>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {canCreate && <div className="panel catalog-form"><h3>Open case</h3><div className="catalog-form-grid"><label className="field">Case type<select className="input" value={type} onChange={event => setType(event.target.value)}><option value="complaint">Complaint</option><option value="dispute">Dispute</option></select></label><label className="field">Case subject<input className="input" value={subject} onChange={event => setSubject(event.target.value)} /></label><label className="field">Description<input className="input" value={description} onChange={event => setDescription(event.target.value)} /></label><label className="field">Due date<input className="input" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label><label className="field">Assign to<select className="input" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">My account</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy || !subject.trim()} onClick={() => void create()}>Open case</button></div>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Type</th><th>Subject</th><th>Owner</th><th>Due</th><th>Status</th><th>Escalation</th></tr></thead><tbody>{rows.length ? rows.map(item => <tr key={item.id} onClick={() => select(item)} style={{ cursor: 'pointer' }}><td>{item.case_type}</td><td>{item.subject}</td><td>{item.assignee_name || 'Unassigned'}</td><td>{item.due_date?.slice(0, 10) || '—'}</td><td>{item.status.replace('_', ' ')}</td><td>{item.escalated_at ? 'Escalated' : '—'}</td></tr>) : <tr><td colSpan={6} className="empty">No cases recorded.</td></tr>}</tbody></table></div>
    {selected && <div className="panel catalog-form"><h3>{selected.subject}</h3><p>{selected.description || 'No description recorded.'}</p><p>Status: {selected.status.replace('_', ' ')} · Owner: {selected.assignee_name || 'Unassigned'} · Due: {selected.due_date?.slice(0, 10) || '—'}</p>{selected.resolution && <p>Resolution: {selected.resolution}</p>}
      {canUpdate && selected.status !== 'closed' && <div className="catalog-form-grid"><label className="field">Case owner<select className="input" value={editAssignee} onChange={event => setEditAssignee(event.target.value)}>{assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><label className="field">Case due date<input className="input" type="date" value={editDueDate} onChange={event => setEditDueDate(event.target.value)} /></label><button className="btn" disabled={busy || !editAssignee} onClick={() => void assign()}>Save assignment</button></div>}
      {canUpdate && ['open', 'in_review'].includes(selected.status) && <><label className="field">Resolution<input className="input" value={resolution} onChange={event => setResolution(event.target.value)} /></label><div className="button-row">{selected.status === 'open' && <button className="btn" disabled={busy} onClick={() => void changeStatus('in_review')}>Start review</button>}<button className="btn btn-primary" disabled={busy || !resolution.trim()} onClick={() => void changeStatus('resolved')}>Resolve case</button></div></>}
      {canUpdate && selected.status === 'resolved' && <button className="btn" disabled={busy} onClick={() => void changeStatus('closed')}>Close case</button>}
      {canApprove && ['open', 'in_review'].includes(selected.status) && !selected.escalated_at && <div className="button-row"><input className="input" aria-label="Escalation reason" placeholder="Escalation reason" value={escalationReason} onChange={event => setEscalationReason(event.target.value)} /><button className="btn" disabled={busy || !escalationReason.trim()} onClick={() => void escalate()}>Escalate case</button></div>}
      <h3>Case history</h3>{events.length ? events.map((event, index) => <p key={`${event.occurred_at}-${index}`}>{event.occurred_at.slice(0, 19)} · {event.action.replaceAll('_', ' ')} · {event.actor_name || 'System'}</p>) : <p className="muted">No events recorded.</p>}
    </div>}
  </section>;
}
