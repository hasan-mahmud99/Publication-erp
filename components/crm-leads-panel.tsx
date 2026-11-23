"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Lead = { id: string; lead_number: string; lead_name: string; organization_name: string | null; email: string | null; phone: string | null; source: string; interest: string | null; expected_quantity: number | null; priority: string; status: string; assigned_to: string | null; assignee_name: string | null; next_follow_up: string | null; version_no: number; linked_customer_code: string | null };
type Assignee = { id: string; display_name: string };
type Customer = { id: string; customer_code: string; name: string };
type History = { action: string; actor_name: string | null; occurred_at: string; metadata_json: unknown };
const sources = ['website', 'book_fair', 'sales_rep', 'referral', 'institution_visit', 'school_outreach', 'phone_email', 'campaign', 'social', 'online_order', 'distributor', 'other'];
const statuses = ['new', 'contact_attempted', 'contacted', 'qualified', 'unqualified', 'lost', 'on_hold', 'converted'];
const label = (value: string) => value.replaceAll('_', ' ');

export function CrmLeadsPanel({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<History[]>([]);
  const [leadNumber, setLeadNumber] = useState('');
  const [leadName, setLeadName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('book_fair');
  const [interest, setInterest] = useState('');
  const [quantity, setQuantity] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [assignee, setAssignee] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [nextAssignee, setNextAssignee] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [conversionMode, setConversionMode] = useState<'new' | 'existing'>('new');
  const [customerCode, setCustomerCode] = useState('');
  const [customerType, setCustomerType] = useState('bookstore');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMatches, setCustomerMatches] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = rows.find(row => row.id === selectedId);

  async function load() {
    const query = new URLSearchParams({ limit: '20', offset: String(page * 20), q: search });
    if (statusFilter) query.set('status', statusFilter);
    const [leads, people] = await Promise.all([api<{ data: Lead[]; meta: { total: number } }>(`/crm/leads?${query}`), api<{ data: Assignee[] }>('/crm/leads/assignees')]);
    setRows(leads.data); setTotal(leads.meta.total); setAssignees(people.data);
  }
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load leads')); }, [page, search, statusFilter]);
  useEffect(() => {
    if (!selectedId) { setHistory([]); return; }
    void api<{ data: History[] }>(`/crm/leads/${selectedId}/history`).then(result => setHistory(result.data)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load lead history'));
  }, [selectedId]);
  function select(row: Lead) { setSelectedId(row.id); setNextStatus(row.status); setNextAssignee(row.assigned_to || ''); setNextFollowUp(row.next_follow_up?.slice(0, 10) || ''); setCustomerCode(''); setCustomerId(''); setCustomerMatches([]); }
  async function act(action: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function create() {
    await act(async () => {
      await api('/crm/leads', { method: 'POST', body: JSON.stringify({ leadNumber, leadName, organizationName: organizationName || null, email: email || null, phone: phone || null, source, interest: interest || null, expectedQuantity: quantity ? Number(quantity) : null, nextFollowUp: followUp || null, assignedTo: assignee || null, priority: 'normal' }) });
      setLeadNumber(''); setLeadName(''); setOrganizationName(''); setEmail(''); setPhone(''); setInterest(''); setQuantity(''); setFollowUp('');
    }, 'Lead registered');
  }
  async function update() {
    if (!selected) return;
    await act(async () => {
      await api(`/crm/leads/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ version: selected.version_no, status: nextStatus, assignedTo: nextAssignee || null, nextFollowUp: nextFollowUp || null }) });
      const result = await api<{ data: History[] }>(`/crm/leads/${selected.id}/history`); setHistory(result.data);
    }, 'Lead updated');
  }
  async function searchCustomers() {
    setBusy(true); setError('');
    try { const result = await api<{ data: Customer[] }>(`/customers?q=${encodeURIComponent(customerSearch)}&limit=25`); setCustomerMatches(result.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Customer search failed'); }
    finally { setBusy(false); }
  }
  async function convert() {
    if (!selected || !window.confirm(`Convert lead ${selected.lead_number} to a customer?`)) return;
    await act(async () => {
      await api(`/crm/leads/${selected.id}/convert`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ version: selected.version_no, ...(conversionMode === 'existing' ? { customerId } : { newCustomerCode: customerCode, newCustomerType: customerType }) }) });
      setSelectedId(''); setCustomerCode(''); setCustomerId('');
    }, 'Lead converted to customer');
  }

  return <section className="panel catalog-form"><h2 className="section-title">Lead register</h2><p className="muted">Leads stay separate from customers until an authorized conversion. Conversion does not create an order or invoice.</p>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}
    {canCreate && <div className="panel catalog-form"><h3>Register lead</h3><div className="catalog-form-grid">
      <label className="field">Lead reference<input className="input" value={leadNumber} onChange={event => setLeadNumber(event.target.value)} /></label>
      <label className="field">Contact name<input className="input" value={leadName} onChange={event => setLeadName(event.target.value)} /></label>
      <label className="field">Organization<input className="input" value={organizationName} onChange={event => setOrganizationName(event.target.value)} /></label>
      <label className="field">Email<input className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="field">Phone<input className="input" value={phone} onChange={event => setPhone(event.target.value)} /></label>
      <label className="field">Source<select className="input" value={source} onChange={event => setSource(event.target.value)}>{sources.map(item => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      <label className="field">Book interest<input className="input" value={interest} onChange={event => setInterest(event.target.value)} /></label>
      <label className="field">Expected quantity<input className="input" type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <label className="field">Next follow-up<input className="input" type="date" value={followUp} onChange={event => setFollowUp(event.target.value)} /></label>
      <label className="field">Assigned to<select className="input" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">My account</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
    </div><button className="btn btn-primary" disabled={busy || !leadNumber.trim() || !leadName.trim()} onClick={() => void create()}>Register lead</button></div>}
    <div className="button-row"><input className="input" aria-label="Search leads" placeholder="Search leads" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} /><button className="btn" onClick={() => { setPage(0); setSearch(searchDraft); }}>Search</button><select className="input" aria-label="Lead status filter" value={statusFilter} onChange={event => { setPage(0); setStatusFilter(event.target.value); }}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{label(item)}</option>)}</select></div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Lead</th><th>Source</th><th>Owner</th><th>Status</th><th>Follow-up</th><th>Customer</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} onClick={() => select(row)} style={{ cursor: 'pointer' }}><td>{row.lead_number}</td><td>{row.lead_name}</td><td>{label(row.source)}</td><td>{row.assignee_name || 'Unassigned'}</td><td>{label(row.status)}</td><td>{row.next_follow_up?.slice(0, 10) || '—'}</td><td>{row.linked_customer_code || '—'}</td></tr>) : <tr><td colSpan={7} className="empty">No leads found.</td></tr>}</tbody></table></div>
    <div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous leads</button><span>{total} leads · page {page + 1}</span><button className="btn" disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>Next leads</button></div>
    {selected && <div className="panel catalog-form"><h3>{selected.lead_number} · {selected.lead_name}</h3><p>{selected.organization_name || 'No organization'} · {selected.email || selected.phone || 'No contact detail'} · {selected.interest || 'No book interest'} · quantity {selected.expected_quantity || '—'}</p>
      {canUpdate && !['converted', 'lost', 'unqualified'].includes(selected.status) && <div className="catalog-form-grid"><label className="field">Status<select className="input" value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{statuses.filter(item => item !== 'converted').map(item => <option key={item} value={item}>{label(item)}</option>)}</select></label><label className="field">Owner<select className="input" value={nextAssignee} onChange={event => setNextAssignee(event.target.value)}><option value="">Unassigned</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><label className="field">Next follow-up<input className="input" type="date" value={nextFollowUp} onChange={event => setNextFollowUp(event.target.value)} /></label><button className="btn" disabled={busy} onClick={() => void update()}>Save lead</button></div>}
      {canCreate && selected.status === 'qualified' && <div className="panel catalog-form"><h3>Convert qualified lead</h3><label className="field">Conversion target<select className="input" value={conversionMode} onChange={event => setConversionMode(event.target.value as 'new' | 'existing')}><option value="new">Create customer</option><option value="existing">Link existing customer</option></select></label>{conversionMode === 'new' ? <div className="catalog-form-grid"><label className="field">New customer code<input className="input" value={customerCode} onChange={event => setCustomerCode(event.target.value)} /></label><label className="field">Customer type<select className="input" value={customerType} onChange={event => setCustomerType(event.target.value)}>{['bookstore','distributor','school','library','institution','direct','other'].map(item => <option key={item} value={item}>{item}</option>)}</select></label></div> : <><div className="button-row"><input className="input" aria-label="Find existing customer" value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} /><button className="btn" disabled={busy} onClick={() => void searchCustomers()}>Find customer</button></div><label className="field">Existing customer<select className="input" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select a customer</option>{customerMatches.map(item => <option key={item.id} value={item.id}>{item.customer_code} · {item.name}</option>)}</select></label></>}<button className="btn btn-primary" disabled={busy || (conversionMode === 'new' ? !customerCode.trim() : !customerId)} onClick={() => void convert()}>Convert lead</button></div>}
      <h3>Lead history</h3>{history.length ? history.map((item, index) => <p key={`${item.occurred_at}-${index}`}>{item.occurred_at.slice(0, 19)} · {label(item.action)} · {item.actor_name || 'System'}</p>) : <p className="muted">No history recorded.</p>}
    </div>}
  </section>;
}
