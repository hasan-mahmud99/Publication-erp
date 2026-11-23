"use client";

import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, Download, Edit3, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { allScreens, type Screen } from '@/lib/screens';
import { api } from '@/lib/api';
import { draftSpecFor, type DraftField } from '@/lib/workflow-specs';
import { WorkspaceScreen } from './workspace-screen';

type Draft = { id: string; data: Record<string, any>; status: string; created_at: string; updated_at: string };
const show = (value: unknown) => value == null || value === '' ? '—' : String(value);
const date = (value: unknown) => value ? String(value).slice(0, 10) : 'Unscheduled';

export function DraftWorkflowScreen({ screen }: { screen: Screen }) {
  const spec = draftSpecFor(screen);
  const [records, setRecords] = useState<Draft[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(spec.mode === 'form' || spec.mode === 'setup');
  const [selectedId, setSelectedId] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [showLegacy, setShowLegacy] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');
  const selected = records.find(row => row.id === selectedId) || records[0];
  const moduleScreens = allScreens.filter(item => item.moduleSlug === screen.moduleSlug);
  const screenIndex = moduleScreens.findIndex(item => item.id === screen.id);
  const previous = moduleScreens[screenIndex - 1];
  const next = moduleScreens[screenIndex + 1];
  const statusField = spec.fields.find(field => field.type === 'select');
  const numericField = spec.fields.find(field => field.type === 'number');

  async function load() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ screenId: screen.id, limit: '100' });
      if (query) params.set('q', query);
      const result = await api<{ data: Draft[]; meta: { total: number } }>(`/workspace/${screen.resource}?${params}`);
      setRecords(result.data); setTotal(result.meta.total);
      setSelectedId(current => result.data.some(row => row.id === current) ? current : result.data[0]?.id || '');
      const me = await api<{ data: { role: string; permissions: string[] } }>('/auth/me');
      setRole(me.data.role); setPermissions(me.data.permissions);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load draft records'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [screen.id, query]);

  function beginEdit(row: Draft) {
    setEditingId(row.id);
    setForm(Object.fromEntries(spec.fields.map(field => [field.key, String(row.data[field.key] ?? '')])));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetForm() { setForm({}); setEditingId(''); setShowForm(spec.mode === 'form' || spec.mode === 'setup'); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    for (const field of spec.fields) if (field.required && !String(form[field.key] || '').trim()) { setError(`${field.label} is required`); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const first = spec.fields[0];
      const body = { ...form, name: form[first.key] || screen.title, screenId: screen.id, screenTitle: screen.title, status: 'draft' };
      await api(`/workspace/${screen.resource}${editingId ? `/${editingId}` : ''}`, { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setNotice(editingId ? 'Draft updated' : 'Draft recorded'); resetForm(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save draft'); }
    finally { setSaving(false); }
  }
  function input(field: DraftField) {
    const value = form[field.key] || '';
    const update = (next: string) => setForm(current => ({ ...current, [field.key]: next }));
    return <label className="field" key={field.key}>{field.label}{field.type === 'select' ? <select className="input" required={field.required} value={value} onChange={event => update(event.target.value)}><option value="">Choose</option>{field.options?.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select> : field.type === 'textarea' ? <textarea className="input" rows={3} value={value} required={field.required} onChange={event => update(event.target.value)} /> : <input className="input" type={field.type || 'text'} value={value} required={field.required} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? 'any' : undefined} onChange={event => update(event.target.value)} />}</label>;
  }
  function exportDrafts() {
    const fields = spec.fields;
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [fields.map(field => escape(field.label)).join(','), ...records.map(row => fields.map(field => escape(row.data[field.key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${screen.slug}-drafts.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }
  const formPanel = (canCreate || (editingId && canUpdate)) && showForm ? <section className="panel catalog-form draft-form"><div className="draft-panel-head"><div><div className="eyebrow">{editingId ? 'UPDATE PREPARATION RECORD' : spec.primaryAction.toUpperCase()}</div><h2 className="section-title">{spec.focus}</h2></div><button className="btn" type="button" onClick={() => { setShowForm(false); setEditingId(''); setForm({}); }}>Close</button></div><p className="muted">{spec.purpose}</p><form onSubmit={event => void save(event)}><div className="catalog-form-grid">{spec.fields.map(input)}</div><div className="button-row"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update preparation record' : spec.primaryAction}</button></div></form></section> : null;
  const columns = spec.fields.slice(0, 3);
  const table = <div className="panel table-wrap"><table className="data-table"><thead><tr>{columns.map(field => <th key={field.key}>{field.label}</th>)}<th>Recorded</th><th>Action</th></tr></thead><tbody>{records.length ? records.map(row => <tr key={row.id}>{columns.map(field => <td key={field.key}>{field.type === 'date' ? date(row.data[field.key]) : show(row.data[field.key])}</td>)}<td>{date(row.created_at)}</td><td>{canUpdate && <button className="btn" type="button" onClick={() => beginEdit(row)}><Edit3 size={13} /> Edit</button>}</td></tr>) : <tr><td colSpan={columns.length + 2} className="empty">No draft {spec.recordLabel} records on this screen yet.</td></tr>}</tbody></table></div>;
  const searchBar = <div className="draft-search"><label className="field">Find {spec.recordLabel} records<div className="search-control"><Search size={14} /><input className="input" value={queryInput} onChange={event => setQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setQuery(queryInput.trim()); }} placeholder={`Search ${spec.fields[0].label.toLowerCase()} or related details`} /></div></label><button className="btn" type="button" onClick={() => setQuery(queryInput.trim())}>Search</button>{query && <button className="btn" type="button" onClick={() => { setQuery(''); setQueryInput(''); }}>Clear</button>}</div>;
  let main: React.ReactNode;
  if (spec.mode === 'form') {
    main = <>{canCreate && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}{formPanel}<div className="section-head"><h2 className="section-title">Recent {spec.recordLabel} drafts</h2><span className="badge">{total} recorded</span></div>{table}</>;
  } else if (spec.mode === 'directory') {
    main = <><div className="section-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}</div>{formPanel}{searchBar}<div className="draft-directory">{records.length ? records.map(row => <article className="panel draft-directory-card" key={row.id}><div className="draft-directory-avatar">{String(row.data[spec.fields[0].key] || '?').charAt(0).toUpperCase()}</div><div><h3>{show(row.data[spec.fields[0].key])}</h3>{spec.fields.slice(1, 4).map(field => <p key={field.key}><span>{field.label}</span>{show(row.data[field.key])}</p>)}</div>{canUpdate && <button className="btn" onClick={() => beginEdit(row)}>Edit entry</button>}</article>) : <div className="panel empty">No {spec.recordLabel} entries have been prepared.</div>}</div></>;
  } else if (spec.mode === 'register') {
    const latest = records[0];
    main = <><div className="draft-register-head"><div><span className="eyebrow">REGISTER VIEW</span><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div><div><strong>{total}</strong><small>draft entries</small></div></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}{formPanel}<div className="draft-register-summary"><span>Primary key: <strong>{spec.fields[0].label}</strong></span><span>{spec.dateKey ? `Date: ${spec.fields.find(field => field.key === spec.dateKey)?.label}` : `Latest: ${latest ? date(latest.created_at) : 'none'}`}</span>{numericField && <span>{numericField.label}: <strong>{records.reduce((value, row) => value + (Number(row.data[numericField.key]) || 0), 0).toLocaleString('en-US')}</strong></span>}</div>{searchBar}{table}</>;
  } else if (spec.mode === 'transaction') {
    main = <><div className="draft-transaction-head"><div><span className="eyebrow">PREPARATION ONLY</span><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div><span className="badge badge-amber">No posting</span></div><div className="draft-transaction-checks">{spec.fields.filter(field => field.required).slice(0, 4).map(field => <span key={field.key}>{field.label}</span>)}</div>{canCreate && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}{formPanel}<div className="section-head"><h2 className="section-title">Prepared entries</h2><span className="badge">{total} drafts</span></div>{table}</>;
  } else if (spec.mode === 'setup') {
    const latest = records[0];
    main = <><section className="panel draft-config-summary"><div><div className="eyebrow">CONFIGURATION CHECK</div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div><span className="badge">{latest ? 'Draft saved' : 'No configuration draft'}</span></section>{canCreate && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}{formPanel}<div className="section-head"><h2 className="section-title">Configuration points</h2></div><div className="draft-check-grid">{spec.fields.filter(field => field.required).map(field => <div className="panel draft-check" key={field.key}><span>{latest?.data[field.key] ? '✓' : '○'}</span><div><strong>{field.label}</strong><small>{latest?.data[field.key] ? show(latest.data[field.key]) : 'Needs a draft value'}</small></div></div>)}</div><div className="section-head"><h2 className="section-title">Saved versions</h2></div>{table}</>;
  } else if (spec.mode === 'board') {
    const values = [...new Set([...(statusField?.options || ['to_do', 'in_progress', 'blocked', 'done']), ...records.map(row => String(row.data[statusField?.key || 'progress'] || 'unassigned'))])];
    main = <><div className="section-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}</div>{formPanel}<div className="draft-board">{values.map(value => <section className="draft-board-lane" key={value}><h3>{value.replaceAll('_', ' ')} <span>{records.filter(row => String(row.data[statusField?.key || 'progress'] || 'unassigned') === value).length}</span></h3>{records.filter(row => String(row.data[statusField?.key || 'progress'] || 'unassigned') === value).map(row => <article className="panel draft-board-card" key={row.id}><strong>{show(row.data[spec.fields[0].key])}</strong><p>{spec.fields.slice(1, 3).map(field => show(row.data[field.key])).join(' · ')}</p>{canUpdate && <button className="btn" onClick={() => beginEdit(row)}>Update work item</button>}</article>)}{!records.some(row => String(row.data[statusField?.key || 'progress'] || 'unassigned') === value) && <p className="draft-board-empty">No items in this stage</p>}</section>)}</div></>;
  } else if (spec.mode === 'comparison') {
    main = <><div className="section-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}</div>{formPanel}<div className="draft-comparison-grid"><section className="panel draft-comparison-card"><span className="eyebrow">BASIS</span><h3>{spec.fields[0].label}</h3><strong>{selected ? show(selected.data[spec.fields[0].key]) : 'No comparison recorded'}</strong><p className="muted">{spec.fields[1]?.label}: {selected ? show(selected.data[spec.fields[1]?.key]) : '—'}</p></section><section className="panel draft-comparison-card"><span className="eyebrow">ASSESSMENT</span><h3>{spec.fields[2]?.label || 'Finding'}</h3><strong>{selected ? show(selected.data[spec.fields[2]?.key]) : 'Awaiting input'}</strong><p className="muted">{spec.fields.at(-1)?.label}: {selected ? show(selected.data[spec.fields.at(-1)!.key]) : '—'}</p></section></div><div className="section-head"><h2 className="section-title">Comparison records</h2></div>{searchBar}{table}</>;
  } else if (spec.mode === 'history') {
    const ordered = [...records].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    main = <><div className="section-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}</div>{formPanel}<div className="draft-timeline">{ordered.length ? ordered.map(row => <article className="panel draft-timeline-item" key={row.id}><time>{date(row.updated_at)}</time><div><strong>{show(row.data[spec.fields[0].key])}</strong><p>{spec.fields.slice(1, 3).map(field => `${field.label}: ${show(row.data[field.key])}`).join(' · ')}</p></div>{canUpdate && <button className="btn" onClick={() => beginEdit(row)}>View / edit</button>}</article>) : <div className="panel empty">No {spec.recordLabel} history has been recorded.</div>}</div></>;
  } else if (spec.mode === 'export') {
    main = <><section className="panel draft-export-panel"><div className="eyebrow">SCREEN-SCOPED EXPORT</div><h2 className="section-title">{spec.focus}</h2><p className="muted">Export only the preparation records shown on this screen. This is not a posted-transaction report.</p><div className="draft-export-fields">{spec.fields.map(field => <span key={field.key}>{field.label}</span>)}</div><button className="btn btn-primary" onClick={exportDrafts} disabled={!records.length}><Download size={14}/>Download {records.length} draft rows</button></section>{formPanel}<div className="section-head"><h2 className="section-title">Export preview</h2></div>{table}</>;
  } else if (spec.mode === 'detail') {
    main = <><div className="draft-split"><section className="panel catalog-form"><h2 className="section-title">Select a {spec.recordLabel}</h2>{searchBar}<div className="draft-record-picker">{records.length ? records.map(row => <button key={row.id} className={`btn ${selected?.id === row.id ? 'draft-selected' : ''}`} type="button" onClick={() => setSelectedId(row.id)}>{show(row.data[spec.fields[0].key])}<ArrowUpRight size={13} /></button>) : <p className="muted">No screen-specific drafts yet.</p>}</div></section><section className="panel catalog-form"><h2 className="section-title">Record details</h2>{selected ? <><dl className="draft-detail-list">{spec.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.type === 'date' ? date(selected.data[field.key]) : show(selected.data[field.key])}</dd></div>)}</dl>{canUpdate && <button className="btn" type="button" onClick={() => beginEdit(selected)}>Edit draft</button>}</> : <p className="muted">Choose a record to see its details.</p>}</section></div>{formPanel}</>;
  } else if (spec.mode === 'calendar') {
    const sorted = [...records].sort((a, b) => String(a.data[spec.dateKey || '']).localeCompare(String(b.data[spec.dateKey || ''])));
    main = <><div className="section-head"><h2 className="section-title">Upcoming dates</h2>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} />Add date</button>}</div>{formPanel}<div className="draft-calendar-list">{sorted.length ? sorted.map(row => <section key={row.id} className="panel draft-calendar-item"><div className="draft-calendar-date">{date(row.data[spec.dateKey || ''])}</div><div><strong>{show(row.data[spec.fields[0].key])}</strong><p className="muted">{spec.focus}</p></div>{canUpdate && <button className="btn" onClick={() => beginEdit(row)}>Edit</button>}</section>) : <div className="panel empty">No dated drafts yet. Add a date to begin planning.</div>}</div></>;
  } else if (spec.mode === 'report') {
    const filled = records.filter(row => spec.fields.every(field => !field.required || String(row.data[field.key] || '').trim())).length;
    const sum = numericField ? records.reduce((value, row) => value + (Number(row.data[numericField.key]) || 0), 0) : null;
    const pastDue = spec.dateKey ? records.filter(row => row.data[spec.dateKey!] && String(row.data[spec.dateKey!]).slice(0, 10) < new Date().toISOString().slice(0, 10)).length : null;
    main = <><div className="section-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div>{canCreate && <button className="btn" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}</div><div className="draft-report-grid"><div className="panel stat"><div className="stat-label">Prepared {spec.recordLabel} rows</div><div className="stat-value">{total}</div><div className="stat-note">Draft inputs only</div></div><div className="panel stat"><div className="stat-label">{numericField ? numericField.label : spec.dateKey ? 'Dated rows in the past' : 'Required fields complete'}</div><div className="stat-value">{sum !== null ? sum.toLocaleString('en-US') : pastDue ?? filled}</div><div className="stat-note">From {records.length} loaded rows</div></div><section className="panel draft-report-panel"><h2 className="section-title">Input completeness</h2><div className="draft-progress"><span style={{ width: `${records.length ? filled / records.length * 100 : 0}%` }} /></div><p className="muted">{filled} of {records.length} loaded rows have required fields. Posted source transactions are not included.</p></section></div>{formPanel}{searchBar}{table}</>;
  } else if (spec.mode === 'queue') {
    const pending = statusField ? records.filter(row => ['pending', 'in_review', 'on_hold'].includes(String(row.data[statusField.key]))).length : records.length;
    main = <><div className="draft-queue-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted">{spec.purpose}</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14}/>{spec.primaryAction}</button>}</div><div className="draft-queue-summary"><span><strong>{total}</strong> total draft items</span><span><strong>{pending}</strong> pending in loaded items</span><span><strong>{spec.fields.filter(field => field.required).length}</strong> required data points</span></div>{formPanel}{searchBar}<div className="draft-split"><section className="panel draft-queue-list"><h3>{spec.recordLabel} queue</h3>{records.length ? records.map(row => <button key={row.id} type="button" className={`draft-queue-row ${selected?.id === row.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(row.id)}><strong>{show(row.data[spec.fields[0].key])}</strong><span>{statusField ? show(row.data[statusField.key]).replaceAll('_', ' ') : date(row.created_at)}</span></button>) : <p className="muted">No {spec.recordLabel} items await review.</p>}</section><section className="panel draft-queue-detail"><h3>Selected item</h3>{selected ? <><dl className="draft-detail-list">{spec.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.type === 'date' ? date(selected.data[field.key]) : show(selected.data[field.key])}</dd></div>)}</dl>{canUpdate && <button className="btn" onClick={() => beginEdit(selected)}>Edit preparation data</button>}</> : <p className="muted">Choose an item to inspect its data.</p>}</section></div></>;
  } else {
    main = <><div className="section-head"><div><h2 className="section-title">{spec.focus}</h2><p className="muted small">{total} screen-specific draft records</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} />Add draft</button>}</div>{formPanel}{searchBar}{table}</>;
  }
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{spec.purpose}</p></div><span className="badge badge-amber">Draft workspace</span></div><nav className="draft-route-trail" aria-label="Module workflow">{previous && <Link href={previous.path}>← {previous.title}</Link>}<strong>{screen.title}</strong>{next && <Link href={next.path}>{next.title} →</Link>}</nav><div className="draft-scope-note">This view saves preparation records for {screen.title}. Formal transaction, approval and integration rules still require dedicated implementation.</div>{error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="alert-success" role="status">{notice}</div>}{loading ? <div className="panel empty">Loading {spec.recordLabel} drafts…</div> : main}<section className="panel draft-legacy"><button className="btn" type="button" aria-expanded={showLegacy} onClick={() => setShowLegacy(value => !value)}><ChevronDown size={14} />{showLegacy ? 'Hide earlier shared records' : 'Open earlier shared records'}</button><p className="muted">Older module-level records are preserved separately from this screen's drafts.</p></section>{showLegacy && <div className="legacy-workspace"><WorkspaceScreen screen={screen} /></div>}</>;
}
