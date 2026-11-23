'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Stage = { code: string; name: string; roleId: string; sequence: number };
type Draft = { id: string; code: string; name: string; document_type: string; description: string | null; stages: Stage[]; revision: number; updated_at: string };
type Role = { id: string; name: string };
const blank = () => ({ code: '', name: '', documentType: 'purchase_requisition', description: '', stages: [{ code: 'REVIEW', name: 'Independent review', roleId: '', sequence: 1 }] as Stage[] });
export function WorkflowRuleBuilderScreen() {
  const [drafts, setDrafts] = useState<Draft[]>([]), [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null), [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try {
      const [definitions, orgRoles] = await Promise.all([api<{ data: Draft[] }>('/workflow/definition-drafts'), api<{ data: Role[] }>('/admin/roles')]);
      setDrafts(definitions.data); setRoles(orgRoles.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load workflow drafts'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function edit(draft: Draft) { setEditing(draft); setForm({ code: draft.code, name: draft.name, documentType: draft.document_type, description: draft.description || '', stages: draft.stages }); setError(''); setNotice(''); }
  function newDraft() { setEditing(null); setForm(blank()); setError(''); setNotice(''); }
  function changeStage(index: number, values: Partial<Stage>) { setForm(current => ({ ...current, stages: current.stages.map((stage, i) => i === index ? { ...stage, ...values } : stage) })); }
  function reorder(index: number, direction: -1 | 1) { setForm(current => { const stages = [...current.stages]; const next = index + direction; if (next < 0 || next >= stages.length) return current; [stages[index], stages[next]] = [stages[next], stages[index]]; return { ...current, stages: stages.map((stage, i) => ({ ...stage, sequence: i + 1 })) }; }); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const payload = { ...form, stages: form.stages.map((stage, index) => ({ ...stage, sequence: index + 1 })), ...(editing ? { revision: editing.revision } : {}) };
      const result = await api<{ data: Draft }>(editing ? `/workflow/definition-drafts/${editing.id}` : '/workflow/definition-drafts', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      edit(result.data); setNotice('Workflow draft saved and audited. It is not active for source approvals.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save workflow draft'); }
    finally { setSaving(false); }
  }
  return <>
    <div className="page-heading"><div><h1 className="page-title">Approval Rule Builder</h1><p className="muted">Design and validate approval stages before source integration</p></div><button className="btn" onClick={newDraft}>New draft</button></div>
    <section className="panel"><h2 className="section-title">Draft configuration only</h2><p>Saved definitions are not published or executed. Current procurement approvals continue to use their source service and purchase order role limits. Publishing requires source binding, independent policy approval, version locking, and a verified routing engine.</p></section>
    {error && <div className="alert-error" role="alert">{error}</div>}{notice && <div className="panel" role="status">{notice}</div>}
    <section className="panel table-wrap"><h2 className="section-title">Saved drafts</h2>{loading ? <p>Loading drafts...</p> : <table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Document type</th><th>Stages</th><th>Revision</th><th>Action</th></tr></thead><tbody>{drafts.length ? drafts.map(row => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.document_type}</td><td>{row.stages.length}</td><td>{row.revision}</td><td><button className="btn" onClick={() => edit(row)}>Edit</button></td></tr>) : <tr><td colSpan={6}>No workflow drafts saved.</td></tr>}</tbody></table>}</section>
    <section className="panel catalog-form"><h2 className="section-title">{editing ? `Edit ${editing.code} · revision ${editing.revision}` : 'Create draft'}</h2><form onSubmit={save}><div className="catalog-form-grid"><label className="field">Workflow code<input className="input" required pattern="[A-Z][A-Z0-9_-]{2,63}" value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label><label className="field">Workflow name<input className="input" required minLength={3} maxLength={200} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field">Document type code<input className="input" required pattern="[a-z][a-z0-9_]{2,79}" value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })} /></label><label className="field">Description<input className="input" maxLength={1000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label></div><h3 className="section-title">Ordered approval stages</h3>{form.stages.map((stage, index) => <div className="catalog-form-grid" key={index}><label className="field">Stage code<input className="input" required pattern="[A-Z][A-Z0-9_-]{1,31}" value={stage.code} onChange={event => changeStage(index, { code: event.target.value.toUpperCase() })} /></label><label className="field">Stage name<input className="input" required minLength={2} value={stage.name} onChange={event => changeStage(index, { name: event.target.value })} /></label><label className="field">Approver role<select className="input" required value={stage.roleId} onChange={event => changeStage(index, { roleId: event.target.value })}><option value="">Choose role</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><div className="button-row"><button className="btn" type="button" disabled={index === 0} onClick={() => reorder(index, -1)}>Move up</button><button className="btn" type="button" disabled={index === form.stages.length - 1} onClick={() => reorder(index, 1)}>Move down</button><button className="btn" type="button" disabled={form.stages.length === 1} onClick={() => setForm(current => ({ ...current, stages: current.stages.filter((_, i) => i !== index) }))}>Remove</button></div></div>)}<div className="button-row"><button className="btn" type="button" disabled={form.stages.length >= 12} onClick={() => setForm(current => ({ ...current, stages: [...current.stages, { code: '', name: '', roleId: '', sequence: current.stages.length + 1 }] }))}>Add stage</button><button className="btn btn-primary" disabled={saving}>Save draft</button></div></form></section>
  </>;
}
