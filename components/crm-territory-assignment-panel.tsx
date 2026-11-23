"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Customer = { id: string; customer_code: string; name: string; territory_id: string | null; version_no: number; status: string };
type Territory = { id: string; code: string; name: string };
type Assignee = { id: string; display_name: string };
type Assignment = { id: string; territory_id: string; territory_name: string; representative_id: string; representative_name: string; effective_at: string; ended_at: string | null; assigned_by_name: string; reason: string };
export function CrmTerritoryAssignmentPanel({ canUpdate }: { canUpdate: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [territoryId, setTerritoryId] = useState('');
  const [representativeId, setRepresentativeId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function loadOptions() {
    const [customerResult, territoryResult, people] = await Promise.all([api<{ data: Customer[] }>(`/customers?q=${encodeURIComponent(search)}&limit=50`), api<{ data: Territory[] }>('/crm/territories'), api<{ data: Assignee[] }>('/crm/leads/assignees')]);
    setCustomers(customerResult.data); setTerritories(territoryResult.data); setAssignees(people.data);
  }
  async function loadCustomer(id: string) {
    const [customer, assignments] = await Promise.all([api<{ data: Customer }>(`/customers/${id}`), api<{ data: Assignment[] }>(`/crm/assignments?customerId=${id}`)]);
    setSelected(customer.data); setHistory(assignments.data);
    setTerritoryId(assignments.data[0]?.ended_at ? customer.data.territory_id || '' : assignments.data[0]?.territory_id || customer.data.territory_id || '');
    setRepresentativeId(assignments.data.find(item => !item.ended_at)?.representative_id || '');
  }
  useEffect(() => { void loadOptions().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load assignment options')); }, [search]);
  useEffect(() => { if (!customerId) { setSelected(null); setHistory([]); return; } void loadCustomer(customerId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load customer assignment')); }, [customerId]);
  async function save() {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/crm/assignments', { method: 'POST', body: JSON.stringify({ customerId: selected.id, customerVersion: selected.version_no, territoryId, representativeId, reason }) });
      await loadCustomer(selected.id); setReason(''); setNotice('Territory and representative assigned');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Assignment failed'); }
    finally { setBusy(false); }
  }
  return <section className="panel catalog-form"><h2 className="section-title">Customer territory and sales representative</h2><p className="muted">Assignment changes update the Customer Master and retain an effective-dated history.</p>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    <div className="button-row"><input className="input" aria-label="Find assignment customer" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Customer name or code" /><button className="btn" onClick={() => setSearch(searchDraft)}>Find customer</button></div><label className="field">Customer<select className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map(item => <option key={item.id} value={item.id}>{item.customer_code} · {item.name}</option>)}</select></label>
    {selected && <><p>{selected.customer_code} · {selected.name} · {selected.status}</p>{canUpdate && <div className="catalog-form-grid"><label className="field">Territory<select className="input" value={territoryId} onChange={event => setTerritoryId(event.target.value)}><option value="">Select territory</option>{territories.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="field">Sales representative<select className="input" value={representativeId} onChange={event => setRepresentativeId(event.target.value)}><option value="">Select representative</option>{assignees.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label><label className="field">Assignment reason<input className="input" value={reason} onChange={event => setReason(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || !territoryId || !representativeId || !reason.trim() || selected.status !== 'active'} onClick={() => void save()}>Save assignment</button></div>}
      <h3>Assignment history</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Territory</th><th>Representative</th><th>Effective</th><th>Ended</th><th>Assigned by</th><th>Reason</th></tr></thead><tbody>{history.length ? history.map(item => <tr key={item.id}><td>{item.territory_name}</td><td>{item.representative_name}</td><td>{item.effective_at.slice(0, 19)}</td><td>{item.ended_at?.slice(0, 19) || 'Current'}</td><td>{item.assigned_by_name}</td><td>{item.reason}</td></tr>) : <tr><td colSpan={6} className="empty">No recorded assignments yet.</td></tr>}</tbody></table></div>
    </>}
  </section>;
}
