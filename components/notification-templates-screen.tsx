'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type EventKey = 'general_task_assigned' | 'editorial_task_assigned' | 'general_task_due_today' | 'general_task_due_tomorrow';
type Template = { id: string; event_key: EventKey; name: string; version_no: number; title_template: string; body_template: string; status: string; created_by: string; reviewed_by: string | null; review_note: string | null; created_at: string; published_at: string | null };
type EventDefinition = { eventKey: EventKey; allowedVariables: string[] };
type Form = { eventKey: EventKey; name: string; titleTemplate: string; bodyTemplate: string };
const initial: Form = { eventKey: 'general_task_assigned', name: '', titleTemplate: '', bodyTemplate: '' };
const label = (key: string) => key.replaceAll('_', ' ');

export function NotificationTemplatesScreen() {
  const [rows, setRows] = useState<Template[]>([]), [events, setEvents] = useState<EventDefinition[]>([]), [me, setMe] = useState('');
  const [selected, setSelected] = useState<string | null>(null), [form, setForm] = useState<Form>(initial), [note, setNote] = useState('');
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const current = rows.find(row => row.id === selected);
  async function load() {
    setLoading(true); setError('');
    try { const result = await api<{ data: Template[]; events: EventDefinition[] }>('/notifications/templates'); setRows(result.data); setEvents(result.events); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load templates'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); void api<{ data: { userId: string } }>('/auth/me').then(result => setMe(result.data.userId)).catch(() => {}); }, []);
  function choose(row: Template) { setSelected(row.id); setForm({ eventKey: row.event_key, name: row.name, titleTemplate: row.title_template, bodyTemplate: row.body_template }); setPreview(null); setNotice(''); setError(''); }
  function newDraft() { setSelected(null); setForm(initial); setPreview(null); setNotice(''); setError(''); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (current) await api(`/notifications/templates/${current.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else { const result = await api<{ data: { id: string } }>('/notifications/templates', { method: 'POST', body: JSON.stringify(form) }); setSelected(result.data.id); }
      await load(); setNotice(current ? 'Draft updated.' : 'Draft created. Submit it for independent review when ready.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save template'); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    setBusy(true); setError('');
    try { setPreview((await api<{ data: { title: string; body: string } }>('/notifications/templates/preview', { method: 'POST', body: JSON.stringify(form) })).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Preview failed'); }
    finally { setBusy(false); }
  }
  async function transition(action: 'submit' | 'approve' | 'reject' | 'retire') {
    if (!current) return; setBusy(true); setError(''); setNotice('');
    try { await api(`/notifications/templates/${current.id}/${action}`, { method: 'POST', body: JSON.stringify({ note }) }); await load(); setNote(''); setNotice(`Template ${action === 'submit' ? 'submitted' : action === 'approve' ? 'published' : action === 'reject' ? 'rejected' : 'retired'}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Template action failed'); }
    finally { setBusy(false); }
  }
  const editable = !current || current.status === 'draft' && current.created_by === me;
  return <>
    <div className="page-heading"><div><h1 className="page-title">Notification Templates</h1><p className="muted">Versioned English in-app content for supported task events</p></div><div className="button-row"><button className="btn" onClick={() => void load()}>Refresh</button><button className="btn" onClick={newDraft}>New draft</button></div></div>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel"><h2 className="section-title">Template versions</h2>{loading ? <p>Loading templates...</p> : <table className="data-table"><thead><tr><th>Event</th><th>Name</th><th>Version</th><th>Status</th><th>Created (UTC)</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{label(row.event_key)}</td><td>{row.name}</td><td>{row.version_no}</td><td>{row.status}</td><td>{String(row.created_at).slice(0, 19)}</td><td><button className="btn" onClick={() => choose(row)}>Review</button></td></tr>) : <tr><td colSpan={6}>No custom templates yet. The built-in task messages remain active.</td></tr>}</tbody></table>}</section>
    <section className="panel catalog-form"><h2 className="section-title">{current ? `Version ${current.version_no}: ${current.status}` : 'Create draft'}</h2><p className="muted">Only published versions change future notifications. Preview uses sample data and sends nothing.</p><form onSubmit={save}><div className="catalog-form-grid"><label className="field">Event<select className="input" disabled={!editable || !!current} value={form.eventKey} onChange={event => setForm({ ...form, eventKey: event.target.value as EventKey })}>{events.map(item => <option key={item.eventKey} value={item.eventKey}>{label(item.eventKey)}</option>)}</select></label><label className="field">Name<input className="input" required minLength={3} maxLength={120} disabled={!editable} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field">Title<input className="input" required minLength={3} maxLength={200} disabled={!editable} value={form.titleTemplate} onChange={event => setForm({ ...form, titleTemplate: event.target.value })} /></label><label className="field">Body<textarea className="input" required minLength={3} maxLength={1000} disabled={!editable} value={form.bodyTemplate} onChange={event => setForm({ ...form, bodyTemplate: event.target.value })} /></label></div><p>Allowed placeholders: {events.find(item => item.eventKey === form.eventKey)?.allowedVariables.map(value => `{${value}`).map(value => `${value}}`).join(', ') || 'Loading...'}</p><div className="button-row"><button type="button" className="btn" disabled={busy} onClick={() => void showPreview()}>Preview sample</button>{editable && <button className="btn btn-primary" disabled={busy}>Save draft</button>}</div></form>
      {preview && <div className="panel"><h3 className="section-title">Preview only</h3><strong>{preview.title}</strong><p>{preview.body}</p></div>}
      {current && <><p>Creator: {current.created_by}. Reviewer: {current.reviewed_by || 'Pending'}. {current.review_note && `Review note: ${current.review_note}`}</p><label className="field">Action note<input className="input" minLength={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></label><div className="button-row">{current.status === 'draft' && current.created_by === me && <button className="btn" disabled={busy || note.trim().length < 3} onClick={() => void transition('submit')}>Submit for review</button>}{current.status === 'submitted' && current.created_by !== me && <><button className="btn btn-primary" disabled={busy || note.trim().length < 3} onClick={() => void transition('approve')}>Approve and publish</button><button className="btn" disabled={busy || note.trim().length < 3} onClick={() => void transition('reject')}>Reject</button></>}{current.status === 'published' && current.created_by !== me && <button className="btn" disabled={busy || note.trim().length < 3} onClick={() => void transition('retire')}>Retire</button>}</div></>}
    </section>
  </>;
}
