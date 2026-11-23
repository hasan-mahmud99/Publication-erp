"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Segment = { id: string; code: string; name: string };
type Territory = { id: string; code: string; name: string };
type Customer = { id: string; customer_code: string; name: string; customer_type: string; status: string };
type Definition = { mode: 'static' | 'dynamic'; customerType: string | null; territoryId: string | null; customerStatus: string | null; version: number; lastRecalculatedAt: string | null };
type Details = { segment: Segment; definition: Definition; members: Array<Customer & { source: string }>; total: number };
export function CrmSegmentsPanel({ segments, territories, canUpdate }: { segments: Segment[]; territories: Territory[]; canUpdate: boolean }) {
  const [segmentId, setSegmentId] = useState('');
  const [details, setDetails] = useState<Details | null>(null);
  const [mode, setMode] = useState<'static' | 'dynamic'>('static');
  const [customerType, setCustomerType] = useState('');
  const [territoryId, setTerritoryId] = useState('');
  const [customerStatus, setCustomerStatus] = useState('');
  const [preview, setPreview] = useState<{ customers: Customer[]; total: number } | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load(id: string) {
    const result = await api<{ data: Details }>(`/crm/segments/${id}/details`);
    setDetails(result.data); setMode(result.data.definition.mode); setCustomerType(result.data.definition.customerType || ''); setTerritoryId(result.data.definition.territoryId || ''); setCustomerStatus(result.data.definition.customerStatus || '');
  }
  useEffect(() => { if (!segmentId) { setDetails(null); return; } setPreview(null); void load(segmentId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load segment')); }, [segmentId]);
  async function act(action: () => Promise<void>, message: string) {
    if (!segmentId) return; setBusy(true); setError(''); setNotice('');
    try { await action(); await load(segmentId); setNotice(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function saveRules() {
    if (!details) return;
    await act(async () => { await api(`/crm/segments/${segmentId}/rules`, { method: 'PUT', body: JSON.stringify({ version: details.definition.version, mode, operator: 'equals', customerType: mode === 'dynamic' ? customerType || null : null, territoryId: mode === 'dynamic' ? territoryId || null : null, customerStatus: mode === 'dynamic' ? customerStatus || null : null }) }); setPreview(null); }, 'Segment rules saved');
  }
  async function previewRules() {
    if (!segmentId) return; setBusy(true); setError('');
    try { const result = await api<{ data: { customers: Customer[]; total: number } }>(`/crm/segments/${segmentId}/preview`); setPreview(result.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Preview failed'); }
    finally { setBusy(false); }
  }
  async function recalculate() {
    if (!details) return;
    await act(async () => { await api(`/crm/segments/${segmentId}/recalculate`, { method: 'POST', body: JSON.stringify({ version: details.definition.version }) }); }, 'Dynamic membership recalculated');
  }
  async function searchCustomers() { setBusy(true); setError(''); try { const result = await api<{ data: Customer[] }>(`/customers?q=${encodeURIComponent(searchDraft)}&limit=50`); setCustomers(result.data); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Customer search failed'); } finally { setBusy(false); } }
  async function addMember() { await act(async () => { await api(`/crm/segments/${segmentId}/members`, { method: 'POST', body: JSON.stringify({ customerId }) }); setCustomerId(''); }, 'Customer added to segment'); }
  async function removeMember(id: string) { await act(async () => { await api(`/crm/segments/${segmentId}/members/${id}`, { method: 'DELETE' }); }, 'Customer removed from segment'); }
  return <section className="panel catalog-form"><h2 className="section-title">Segment membership and rules</h2><p className="muted">Dynamic rules use actual customer type, territory and status. Membership does not grant communication consent.</p>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    <label className="field">Segment<select className="input" value={segmentId} onChange={event => setSegmentId(event.target.value)}><option value="">Select segment</option>{segments.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
    {details && <><div className="catalog-form-grid"><label className="field">Membership mode<select className="input" value={mode} disabled={!canUpdate || details.definition.version > 0} onChange={event => setMode(event.target.value as 'static' | 'dynamic')}><option value="static">Static</option><option value="dynamic">Dynamic</option></select></label>{mode === 'dynamic' && <><label className="field">Customer type<select className="input" value={customerType} disabled={!canUpdate} onChange={event => setCustomerType(event.target.value)}><option value="">Any type</option>{['bookstore','distributor','school','library','institution','direct','other'].map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="field">Territory<select className="input" value={territoryId} disabled={!canUpdate} onChange={event => setTerritoryId(event.target.value)}><option value="">Any territory</option>{territories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Customer status<select className="input" value={customerStatus} disabled={!canUpdate} onChange={event => setCustomerStatus(event.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></>}</div>{canUpdate && <button className="btn" disabled={busy || (mode === 'dynamic' && !customerType && !territoryId && !customerStatus)} onClick={() => void saveRules()}>Save segment rules</button>}
      {details.definition.mode === 'dynamic' ? <div className="button-row"><button className="btn" disabled={busy} onClick={() => void previewRules()}>Preview matches</button>{canUpdate && <button className="btn btn-primary" disabled={busy} onClick={() => void recalculate()}>Recalculate membership</button>}{details.definition.lastRecalculatedAt && <span>Last calculated: {details.definition.lastRecalculatedAt.slice(0, 19)}</span>}</div> : canUpdate && <div className="button-row"><input className="input" aria-label="Find segment customer" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Customer name or code" /><button className="btn" disabled={busy} onClick={() => void searchCustomers()}>Find customer</button><select className="input" aria-label="Static member customer" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map(item => <option key={item.id} value={item.id}>{item.customer_code} · {item.name}</option>)}</select><button className="btn btn-primary" disabled={busy || !customerId} onClick={() => void addMember()}>Add member</button></div>}
      {preview && <div className="panel catalog-form"><h3>Rule preview · {preview.total} matching customers</h3>{preview.customers.map(item => <p key={item.id}>{item.customer_code} · {item.name} · {item.customer_type} · {item.status}</p>)}{!preview.customers.length && <p className="muted">No customers match the saved rules.</p>}{preview.total > preview.customers.length && <p className="muted">Showing the first {preview.customers.length} matches.</p>}</div>}
      <h3>Current members · {details.total}</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Customer</th><th>Type</th><th>Status</th><th>Source</th><th>Action</th></tr></thead><tbody>{details.members.length ? details.members.map(item => <tr key={item.id}><td>{item.customer_code}</td><td>{item.name}</td><td>{item.customer_type}</td><td>{item.status}</td><td>{item.source}</td><td>{canUpdate && item.source === 'static' && <button className="btn" disabled={busy} onClick={() => void removeMember(item.id)}>Remove</button>}</td></tr>) : <tr><td colSpan={6} className="empty">No members recorded.</td></tr>}</tbody></table></div>{details.total > details.members.length && <p className="muted">Showing the first {details.members.length} members.</p>}</>}
  </section>;
}
