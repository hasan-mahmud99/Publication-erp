"use client";

import { useEffect, useState } from 'react';
import { api, apiFile } from '@/lib/api';
import Link from 'next/link';
import type { Screen } from '@/lib/screens';
import { BulkImportWizard } from '@/components/bulk-import-wizard';
import { Customer360Panel } from '@/components/customer-360-panel';
import { CrmLeadsPanel } from '@/components/crm-leads-panel';
import { CrmFollowupsPanel } from '@/components/crm-followups-panel';
import { CrmCasesPanel } from '@/components/crm-cases-panel';
import { CrmTerritoryAssignmentPanel } from '@/components/crm-territory-assignment-panel';
import { CrmSegmentsPanel } from '@/components/crm-segments-panel';

type Customer = { id: string; customer_code: string; customer_type: string; name: string; email: string | null; phone: string | null; credit_limit: string; status: string; version_no: number; segment_id: string | null; territory_id: string | null; segment_name?: string | null; territory_name?: string | null };
type Master = { id: string; code: string; name: string };
type Contact = { id: string; name: string; role_name: string | null; email: string | null; phone: string | null; status: string };
type Address = { id: string; address_type: string; line1: string; city: string | null; district: string | null; status: string; is_default: number | boolean };
type Activity = { id: string; activity_type: string; summary: string; occurred_at: string; author_name: string };
type Case = { id: string; case_type: string; subject: string; status: string; resolution: string | null; version_no: number; customer_name: string };
type Opportunity = { id: string; title: string; stage: string; expected_value: string; expected_close: string | null; version_no: number; customer_name: string };
type Duplicate = { first_id: string; first_code: string; first_name: string; second_id: string; second_code: string; second_name: string; match_basis: string };
type DuplicatePolicy = { matchEmail: boolean; matchPhone: boolean; matchName: boolean; enforcement: 'warn' | 'block' };
type DuplicateCandidate = { id: string; customer_code: string; name: string; match_basis: string };
type Summary = { customers: number; activeCustomers: number; openCases: number; openOpportunities: number };
const date = (value?: string | null) => value ? String(value).slice(0, 10) : '—';

export function CrmScreen({ screen }: { screen: Screen }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [salesTypeFilter, setSalesTypeFilter] = useState('');
  const [salesTerritoryFilter, setSalesTerritoryFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [segments, setSegments] = useState<Master[]>([]);
  const [territories, setTerritories] = useState<Master[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>({ matchEmail: true, matchPhone: true, matchName: true, enforcement: 'warn' });
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateSignature, setDuplicateSignature] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showSalesImport, setShowSalesImport] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState('bookstore');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [segmentId, setSegmentId] = useState('');
  const [territoryId, setTerritoryId] = useState('');
  const [editSegmentId, setEditSegmentId] = useState('');
  const [editTerritoryId, setEditTerritoryId] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('0');
  const [editStatus, setEditStatus] = useState('active');
  const [editType, setEditType] = useState('bookstore');
  const [masterCode, setMasterCode] = useState('');
  const [masterName, setMasterName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressType, setAddressType] = useState('billing');
  const [addressLine, setAddressLine] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [activitySummary, setActivitySummary] = useState('');
  const [caseType, setCaseType] = useState('complaint');
  const [caseSubject, setCaseSubject] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [opportunityTitle, setOpportunityTitle] = useState('');
  const [opportunityValue, setOpportunityValue] = useState('0');
  const [opportunityClose, setOpportunityClose] = useState('');
  const canCreate = role === 'Owner' || permissions.includes('workspace.create');
  const canImportSales = role === 'Owner' || ['sales.read', 'sales.manage', 'imports.read', 'imports.create', 'imports.confirm'].every(permission => permissions.includes(permission));
  const canUpdate = role === 'Owner' || permissions.includes('workspace.update');
  const canSetDuplicatePolicy = role === 'Owner' || permissions.includes('workspace.approve');
  const selected = selectedCustomer?.id === selectedId ? selectedCustomer : null;

  async function loadBase() {
    const customerParams = new URLSearchParams({ q: search, limit: '25', offset: String(page * 25) });
    if (screen.title === 'Customer/Distributor Directory') {
      if (salesTypeFilter) customerParams.set('type', salesTypeFilter);
      if (salesTerritoryFilter) customerParams.set('territoryId', salesTerritoryFilter);
    }
    const [customerResult, segmentResult, territoryResult, summaryResult, duplicateResult, policyResult, me] = await Promise.all([
      api<{ data: Customer[]; meta: { total: number } }>(`/customers?${customerParams}`),
      api<{ data: Master[] }>('/crm/segments'),
      api<{ data: Master[] }>('/crm/territories'),
      api<{ data: Summary }>('/crm/summary'),
      api<{ data: Duplicate[] }>('/crm/duplicates'),
      api<{ data: DuplicatePolicy }>('/crm/duplicates/policy'),
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
    ]);
    setCustomers(customerResult.data); setTotal(customerResult.meta.total);
    setSegments(segmentResult.data); setTerritories(territoryResult.data);
    setSummary(summaryResult.data); setDuplicates(duplicateResult.data); setDuplicatePolicy(policyResult.data);
    setRole(me.data.role); setPermissions(me.data.permissions);
    setSelectedId(current => current || customerResult.data[0]?.id || '');
  }
  async function loadDetails(customerId: string) {
    const [customerResult, contactResult, addressResult, activityResult, caseResult, opportunityResult] = await Promise.all([
      api<{ data: Customer }>(`/customers/${customerId}`),
      api<{ data: Contact[] }>(`/customers/${customerId}/contacts`),
      api<{ data: Address[] }>(`/customers/${customerId}/addresses`),
      api<{ data: Activity[] }>(`/customers/${customerId}/activities`),
      api<{ data: Case[] }>(`/crm/cases?customerId=${customerId}&limit=100`),
      api<{ data: Opportunity[] }>(`/crm/opportunities?customerId=${customerId}&limit=100`),
    ]);
    setSelectedCustomer(customerResult.data); setEditSegmentId(customerResult.data.segment_id || ''); setEditTerritoryId(customerResult.data.territory_id || '');
    setEditName(customerResult.data.name); setEditEmail(customerResult.data.email || ''); setEditPhone(customerResult.data.phone || '');
    setEditCreditLimit(String(customerResult.data.credit_limit)); setEditStatus(customerResult.data.status); setEditType(customerResult.data.customer_type);
    setContacts(contactResult.data); setAddresses(addressResult.data); setActivities(activityResult.data);
    setCases(caseResult.data); setOpportunities(opportunityResult.data);
  }
  useEffect(() => {
    const customerId = new URLSearchParams(window.location.search).get('customer');
    if (customerId) setSelectedId(customerId);
  }, []);
  useEffect(() => { void loadBase().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load CRM data')).finally(() => setLoading(false)); }, [page, search, salesTypeFilter, salesTerritoryFilter]);
  useEffect(() => {
    if (!selectedId) return;
    void loadDetails(selectedId).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load customer details'));
  }, [selectedId]);
  async function act(task: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function addCustomer() {
    const signature = JSON.stringify([code.trim(), name.trim(), email.trim(), phone.trim()]);
    if (signature !== duplicateSignature) {
      setBusy(true); setError(''); setNotice('');
      try {
        const check = (await api<{ data: { policy: DuplicatePolicy; matches: DuplicateCandidate[] } }>('/crm/duplicates/check', { method: 'POST', body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }) })).data;
        setDuplicateCandidates(check.matches); setDuplicateSignature(signature);
        if (check.matches.length) { setNotice(`${check.matches.length} potential customer match${check.matches.length === 1 ? '' : 'es'} found. Review before creating this record.`); if (check.policy.enforcement === 'block') setError('The organization policy blocks creating a matching customer.'); return; }
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Duplicate check failed'); return; }
      finally { setBusy(false); }
    }
    if (duplicateCandidates.length && duplicatePolicy.enforcement === 'block') return;
    await act(async () => {
      const result = await api<{ data: { id: string } }>('/customers', { method: 'POST', body: JSON.stringify({ code, name, type: customerType, email: email || null, phone: phone || null, creditLimit, segmentId: segmentId || null, territoryId: territoryId || null }) });
      setCode(''); setName(''); setEmail(''); setPhone(''); setCreditLimit('0'); setDuplicateCandidates([]); setDuplicateSignature('');
      setSearch(''); setSearchDraft(''); setPage(0); await loadBase(); setSelectedId(result.data.id); await loadDetails(result.data.id);
    }, 'Customer created');
  }
  async function updateCustomer() {
    if (!selected) return;
    await act(async () => {
      await api(`/customers/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ version: selected.version_no, name: editName, type: editType, email: editEmail || null, phone: editPhone || null, creditLimit: editCreditLimit, status: editStatus, segmentId: editSegmentId || null, territoryId: editTerritoryId || null }) });
      await loadDetails(selected.id); await loadBase();
    }, 'Customer updated');
  }
  async function addMaster(kind: 'segments' | 'territories') {
    await act(async () => {
      await api(`/crm/${kind}`, { method: 'POST', body: JSON.stringify({ code: masterCode, name: masterName }) });
      setMasterCode(''); setMasterName(''); await loadBase();
    }, kind === 'segments' ? 'Segment created' : 'Territory created');
  }
  async function saveDuplicatePolicy() {
    await act(async () => {
      await api('/crm/duplicates/policy', { method: 'PUT', body: JSON.stringify(duplicatePolicy) });
      await loadBase();
    }, 'Duplicate matching policy saved');
  }
  async function addContact() {
    await act(async () => {
      await api(`/customers/${selectedId}/contacts`, { method: 'POST', body: JSON.stringify({ name: contactName, roleName: contactRole || null, email: contactEmail || null, phone: contactPhone || null }) });
      setContactName(''); setContactRole(''); setContactEmail(''); setContactPhone(''); await loadDetails(selectedId);
    }, 'Contact added');
  }
  async function addAddress() {
    await act(async () => {
      await api(`/customers/${selectedId}/addresses`, { method: 'POST', body: JSON.stringify({ type: addressType, line1: addressLine, city: addressCity || null, isDefault: true }) });
      setAddressLine(''); setAddressCity(''); await loadDetails(selectedId);
    }, 'Address added');
  }
  async function setContactStatus(item: Contact) {
    await act(async () => {
      await api(`/crm/contacts/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: item.status === 'active' ? 'inactive' : 'active' }) });
      await loadDetails(selectedId);
    }, 'Contact status updated');
  }
  async function saveContactEdit() {
    if (!editingContact) return;
    await act(async () => {
      await api(`/crm/contacts/${editingContact.id}`, { method: 'PATCH', body: JSON.stringify({ name: editingContact.name, roleName: editingContact.role_name || null, email: editingContact.email || null, phone: editingContact.phone || null }) });
      setEditingContact(null); await loadDetails(selectedId);
    }, 'Contact updated');
  }
  async function saveAddressEdit() {
    if (!editingAddress) return;
    await act(async () => {
      await api(`/crm/addresses/${editingAddress.id}`, { method: 'PATCH', body: JSON.stringify({ type: editingAddress.address_type, line1: editingAddress.line1, city: editingAddress.city || null, district: editingAddress.district || null }) });
      setEditingAddress(null); await loadDetails(selectedId);
    }, 'Address updated');
  }
  async function setAddressStatus(item: Address) {
    await act(async () => {
      await api(`/crm/addresses/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: item.status === 'active' ? 'inactive' : 'active' }) });
      await loadDetails(selectedId);
    }, 'Address status updated');
  }
  async function setDefaultAddress(item: Address) {
    await act(async () => {
      await api(`/crm/addresses/${item.id}/default`, { method: 'PATCH' });
      await loadDetails(selectedId);
    }, 'Default address updated');
  }
  async function addActivity() {
    await act(async () => {
      await api(`/customers/${selectedId}/activities`, { method: 'POST', body: JSON.stringify({ type: activityType, summary: activitySummary }) });
      setActivitySummary(''); await loadDetails(selectedId);
    }, 'Activity recorded');
  }
  async function addCase() {
    await act(async () => {
      await api('/crm/cases', { method: 'POST', body: JSON.stringify({ customerId: selectedId, type: caseType, subject: caseSubject, description: caseDescription || null }) });
      setCaseSubject(''); setCaseDescription(''); await loadDetails(selectedId); await loadBase();
    }, 'Case opened');
  }
  async function advanceCase(item: Case, status: string) {
    const resolution = status === 'resolved' ? window.prompt('Resolution') : item.resolution;
    if (status === 'resolved' && !resolution?.trim()) return;
    await act(async () => {
      await api(`/crm/cases/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, resolution, version: item.version_no }) });
      await loadDetails(selectedId); await loadBase();
    }, 'Case status updated');
  }
  async function addOpportunity() {
    await act(async () => {
      await api('/crm/opportunities', { method: 'POST', body: JSON.stringify({ customerId: selectedId, title: opportunityTitle, expectedValue: opportunityValue, expectedClose: opportunityClose || null }) });
      setOpportunityTitle(''); setOpportunityValue('0'); setOpportunityClose(''); await loadDetails(selectedId); await loadBase();
    }, 'Opportunity created');
  }
  async function advanceOpportunity(item: Opportunity, stage: string) {
    await act(async () => {
      await api(`/crm/opportunities/${item.id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage, version: item.version_no }) });
      await loadDetails(selectedId); await loadBase();
    }, 'Opportunity stage updated');
  }

  const customerSelector = <label className="field">Customer<select className="input" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">Select customer</option>{selected && !customers.some(item => item.id === selected.id) && <option value={selected.id}>{selected.customer_code} · {selected.name}</option>}{customers.map(item => <option key={item.id} value={item.id}>{item.customer_code} · {item.name}</option>)}</select></label>;
  const customerList = <><div className="panel catalog-form"><div className="button-row"><input className="input" placeholder="Search customers" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} /><button className="btn" onClick={() => { setPage(0); setSearch(searchDraft); }}>Search</button></div></div><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Segment</th><th>Territory</th><th>Status</th></tr></thead><tbody>{customers.length ? customers.map(item => <tr key={item.id} onClick={() => setSelectedId(item.id)} style={{ cursor: 'pointer' }}><td>{item.customer_code}</td><td>{item.name}</td><td>{item.customer_type}</td><td>{item.segment_name || '—'}</td><td>{item.territory_name || '—'}</td><td>{item.status}</td></tr>) : <tr><td colSpan={6} className="empty">No customers found.</td></tr>}</tbody></table></div><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{total} customers · page {page + 1}</span><button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div></>;
  async function exportSalesCustomers() {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ q: search });
      if (salesTypeFilter) params.set('type', salesTypeFilter);
      if (salesTerritoryFilter) params.set('territoryId', salesTerritoryFilter);
      const blob = await apiFile(`/sales/customers/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'sales-customers.csv'; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not export Sales customers'); }
    finally { setBusy(false); }
  }
  const segmentSelector = <label className="field">Segment<select className="input" value={segmentId} onChange={event => setSegmentId(event.target.value)}><option value="">None</option>{segments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const territorySelector = <label className="field">Territory<select className="input" value={territoryId} onChange={event => setTerritoryId(event.target.value)}><option value="">None</option>{territories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const editSegmentSelector = <label className="field">Segment<select className="input" value={editSegmentId} onChange={event => setEditSegmentId(event.target.value)}><option value="">None</option>{segments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const editTerritorySelector = <label className="field">Territory<select className="input" value={editTerritoryId} onChange={event => setEditTerritoryId(event.target.value)}><option value="">None</option>{territories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  let content: React.ReactNode;
  switch (screen.title) {
    case 'CRM Dashboard':
      content = <><div className="stat-grid"><div className="panel stat"><div className="stat-label">Customers</div><div className="stat-value">{summary?.customers ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Active customers</div><div className="stat-value">{summary?.activeCustomers ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Open cases</div><div className="stat-value">{summary?.openCases ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Open opportunities</div><div className="stat-value">{summary?.openOpportunities ?? '—'}</div></div></div><CrmLeadsPanel canCreate={canCreate} canUpdate={canUpdate} />{customerList}</>;
      break;
    case 'Customer/Distributor Directory':
    case 'Customer Profile':
      content = <>{canCreate && <section className="panel catalog-form"><h2 className="section-title">New customer</h2><div className="catalog-form-grid"><label className="field">Code<input className="input" value={code} onChange={event => setCode(event.target.value)} /></label><label className="field">Name<input className="input" value={name} onChange={event => setName(event.target.value)} /></label><label className="field">Type<select className="input" value={customerType} onChange={event => setCustomerType(event.target.value)}>{['bookstore','distributor','school','library','institution','direct','other'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field">Email<input className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="field">Phone<input className="input" value={phone} onChange={event => setPhone(event.target.value)} /></label><label className="field">Credit limit<input className="input" type="number" min="0" step="0.01" value={creditLimit} onChange={event => setCreditLimit(event.target.value)} /></label>{segmentSelector}{territorySelector}</div><button className="btn btn-primary" disabled={busy || !code.trim() || !name.trim()} onClick={() => void addCustomer()}>Create customer</button><p className="muted">Credit-limit enforcement against receivables is pending the sales and finance posting workflow.</p></section>}{customerList}{selected && <section className="panel catalog-form"><h2 className="section-title">Edit {selected.customer_code}</h2>{canUpdate ? <><div className="catalog-form-grid"><label className="field">Name<input className="input" value={editName} onChange={event => setEditName(event.target.value)} /></label><label className="field">Type<select className="input" value={editType} onChange={event => setEditType(event.target.value)}>{['bookstore','distributor','school','library','institution','direct','other'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field">Email<input className="input" type="email" value={editEmail} onChange={event => setEditEmail(event.target.value)} /></label><label className="field">Phone<input className="input" value={editPhone} onChange={event => setEditPhone(event.target.value)} /></label><label className="field">Credit limit<input className="input" type="number" min="0" step="0.01" value={editCreditLimit} onChange={event => setEditCreditLimit(event.target.value)} /></label><label className="field">Status<select className="input" value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>{editSegmentSelector}{editTerritorySelector}</div><button className="btn" disabled={busy || !editName.trim()} onClick={() => void updateCustomer()}>Save customer</button></> : <p>{selected.name} · {selected.customer_type} · {selected.status}</p>}</section>}</>;
      if (screen.title === 'Customer/Distributor Directory' && selected) content = <>{content}<section className="panel catalog-form"><h2 className="section-title">Sales account contacts and addresses</h2><p>Credit limit: {selected.credit_limit} BDT · Status: {selected.status}</p><div className="catalog-report-grid"><div><h3>Contacts</h3>{contacts.length ? contacts.map(item => <p key={item.id}>{item.name} · {item.role_name || 'Contact'} · {item.email || item.phone || 'No contact detail'}</p>) : <p className="muted">No contacts recorded.</p>}</div><div><h3>Addresses</h3>{addresses.length ? addresses.map(item => <p key={item.id}>{item.address_type} · {item.line1}, {item.city || ''}</p>) : <p className="muted">No addresses recorded.</p>}</div></div><div className="button-row"><Link className="btn" href={`/crm-customers/customer-contacts-and-addresses?customer=${selected.id}`}>Manage contacts and addresses</Link><Link className="btn" href={`/sales-distribution/customer-order-history?customer=${selected.id}`}>View Sales history</Link></div></section></>;
      if (screen.title === 'Customer Profile' && duplicateCandidates.length && duplicateSignature === JSON.stringify([code.trim(), name.trim(), email.trim(), phone.trim()])) content = <>{content}<section className="panel catalog-form"><h2 className="section-title">Potential duplicate customers</h2>{duplicateCandidates.map(item => <p key={item.id}>{item.customer_code} · {item.name} · matched by {item.match_basis}</p>)}<p className="muted">{duplicatePolicy.enforcement === 'block' ? 'Creation is blocked by the organization policy.' : 'Review these records. If this is a separate customer, click Create customer again to confirm.'}</p></section></>;
      if (screen.title === 'Customer Profile' && selected) content = <>{content}<Customer360Panel key={selected.id} customerId={selected.id} name={selected.name} code={selected.customer_code} type={selected.customer_type} status={selected.status} creditLimit={selected.credit_limit} contacts={contacts} addresses={addresses} activities={activities} cases={cases} opportunities={opportunities} canViewSales={role === 'Owner' || permissions.includes('sales.read')} canUpdate={canUpdate} /></>;
      if (screen.title === 'Customer/Distributor Directory') content = <>
        <section className="panel catalog-form"><div className="catalog-form-grid">
          <label className="field">Filter customer type<select className="input" value={salesTypeFilter} onChange={event => { setSalesTypeFilter(event.target.value); setPage(0); }}><option value="">All types</option>{['bookstore','distributor','school','library','institution','direct','other'].map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="field">Filter sales territory<select className="input" value={salesTerritoryFilter} onChange={event => { setSalesTerritoryFilter(event.target.value); setPage(0); }}><option value="">All territories</option>{territories.map(territory => <option key={territory.id} value={territory.id}>{territory.name}</option>)}</select></label>
        </div><div className="button-row"><button className="btn" disabled={busy} onClick={() => void exportSalesCustomers()}>Export customers CSV</button>{canImportSales && <button className="btn" onClick={() => setShowSalesImport(true)}>Import customers CSV</button>}</div></section>{content}{showSalesImport && <BulkImportWizard moduleKey="sales-distribution" allowedEntityKeys={['customers-retailers-distributors']} onClose={() => setShowSalesImport(false)} onImported={() => { setShowSalesImport(false); void loadBase().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not reload customers')); }} />}</>;
      break;
    case 'Customer Contacts & Addresses':
      content = <>{customerSelector}{selectedId && <>{canCreate && <div className="catalog-report-grid"><section className="panel catalog-form"><h2 className="section-title">Add contact</h2><label className="field">Name<input className="input" value={contactName} onChange={event => setContactName(event.target.value)} /></label><label className="field">Role<input className="input" value={contactRole} onChange={event => setContactRole(event.target.value)} /></label><label className="field">Email<input className="input" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} /></label><label className="field">Phone<input className="input" value={contactPhone} onChange={event => setContactPhone(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || !contactName.trim()} onClick={() => void addContact()}>Add contact</button></section><section className="panel catalog-form"><h2 className="section-title">Add default address</h2><label className="field">Type<select className="input" value={addressType} onChange={event => setAddressType(event.target.value)}><option value="billing">Billing</option><option value="shipping">Shipping</option><option value="other">Other</option></select></label><label className="field">Address line<input className="input" value={addressLine} onChange={event => setAddressLine(event.target.value)} /></label><label className="field">City<input className="input" value={addressCity} onChange={event => setAddressCity(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || !addressLine.trim()} onClick={() => void addAddress()}>Add address</button></section></div>}<div className="catalog-report-grid"><section className="panel catalog-form"><h2 className="section-title">Contacts</h2>{contacts.length ? contacts.map(item => <p key={item.id}>{item.name} · {item.role_name || 'Contact'} · {item.email || item.phone || 'No contact detail'} · {item.status} {canUpdate && <button className="btn" disabled={busy} onClick={() => setEditingContact({ ...item })}>Edit contact</button>}{canUpdate && <button className="btn" disabled={busy} onClick={() => void setContactStatus(item)}>{item.status === 'active' ? 'Deactivate' : 'Activate'}</button>}</p>) : <p className="muted">No contacts yet.</p>}</section><section className="panel catalog-form"><h2 className="section-title">Addresses</h2>{addresses.length ? addresses.map(item => <p key={item.id}>{item.address_type} · {item.line1}, {item.city || ''} {canUpdate && <button className="btn" disabled={busy} onClick={() => setEditingAddress({ ...item })}>Edit address</button>}{canUpdate && <button className="btn" disabled={busy || (Boolean(item.is_default) && item.status === 'active')} onClick={() => void setAddressStatus(item)}>{item.status === 'active' ? 'Deactivate' : 'Activate'}</button>}{item.is_default ? '(default)' : canUpdate && <button className="btn" disabled={busy} onClick={() => void setDefaultAddress(item)}>Make default</button>}</p>) : <p className="muted">No addresses yet.</p>}</section></div></>}</>;
      content = <>{content}{editingContact && <section className="panel catalog-form"><h2 className="section-title">Edit contact</h2><div className="catalog-form-grid"><label className="field">Contact name<input className="input" value={editingContact.name} onChange={event => setEditingContact({ ...editingContact, name: event.target.value })} /></label><label className="field">Contact role<input className="input" value={editingContact.role_name || ''} onChange={event => setEditingContact({ ...editingContact, role_name: event.target.value })} /></label><label className="field">Contact email<input className="input" type="email" value={editingContact.email || ''} onChange={event => setEditingContact({ ...editingContact, email: event.target.value })} /></label><label className="field">Contact phone<input className="input" value={editingContact.phone || ''} onChange={event => setEditingContact({ ...editingContact, phone: event.target.value })} /></label></div><div className="button-row"><button className="btn btn-primary" disabled={busy || !editingContact.name.trim()} onClick={() => void saveContactEdit()}>Save contact</button><button className="btn" onClick={() => setEditingContact(null)}>Cancel</button></div></section>}{editingAddress && <section className="panel catalog-form"><h2 className="section-title">Edit address</h2><div className="catalog-form-grid"><label className="field">Address type<select className="input" value={editingAddress.address_type} onChange={event => setEditingAddress({ ...editingAddress, address_type: event.target.value })}>{['billing','shipping','other'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field">Address line<input className="input" value={editingAddress.line1} onChange={event => setEditingAddress({ ...editingAddress, line1: event.target.value })} /></label><label className="field">City<input className="input" value={editingAddress.city || ''} onChange={event => setEditingAddress({ ...editingAddress, city: event.target.value })} /></label><label className="field">District<input className="input" value={editingAddress.district || ''} onChange={event => setEditingAddress({ ...editingAddress, district: event.target.value })} /></label></div><div className="button-row"><button className="btn btn-primary" disabled={busy || !editingAddress.line1.trim()} onClick={() => void saveAddressEdit()}>Save address</button><button className="btn" onClick={() => setEditingAddress(null)}>Cancel</button></div></section>}</>;
      break;
    case 'Customer Segmentation':
    case 'Territory & Sales Assignment': {
      const kind = screen.title === 'Customer Segmentation' ? 'segments' : 'territories';
      const rows = kind === 'segments' ? segments : territories;
      content = <>{canCreate && <section className="panel catalog-form"><h2 className="section-title">New {kind === 'segments' ? 'segment' : 'territory'}</h2><div className="catalog-form-grid"><label className="field">Code<input className="input" value={masterCode} onChange={event => setMasterCode(event.target.value)} /></label><label className="field">Name<input className="input" value={masterName} onChange={event => setMasterName(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !masterCode.trim() || !masterName.trim()} onClick={() => void addMaster(kind)}>Create</button></section>}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td></tr>)}</tbody></table></div><p className="muted">Assign a segment or territory from Customer Profile.</p></>;
      if (kind === 'territories') content = <>{content}<CrmTerritoryAssignmentPanel canUpdate={canUpdate} /></>;
      if (kind === 'segments') content = <>{content}<CrmSegmentsPanel segments={segments} territories={territories} canUpdate={canUpdate} /></>;
      break;
    }
    case 'Customer Activity Timeline':
      content = <>{customerSelector}{selectedId && <>{canCreate && <section className="panel catalog-form"><h2 className="section-title">Record activity</h2><div className="catalog-form-grid"><label className="field">Type<select className="input" value={activityType} onChange={event => setActivityType(event.target.value)}>{['note','call','email','meeting'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field">Summary<input className="input" value={activitySummary} onChange={event => setActivitySummary(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !activitySummary.trim()} onClick={() => void addActivity()}>Record</button></section>}<section className="panel catalog-form"><h2 className="section-title">Timeline</h2>{activities.length ? activities.map(item => <p key={item.id}>{date(item.occurred_at)} · {item.activity_type} · {item.summary} · {item.author_name}</p>) : <p className="muted">No activity recorded.</p>}</section></>}</>;
      content = <>{content}{selectedId && <CrmFollowupsPanel customerId={selectedId} canCreate={canCreate} canUpdate={canUpdate} />}</>;
      break;
    case 'Complaints & Disputes':
      content = <>{customerSelector}{selectedId && <CrmCasesPanel customerId={selectedId} canCreate={canCreate} canUpdate={canUpdate} canApprove={canSetDuplicatePolicy} onChange={async () => { await loadDetails(selectedId); await loadBase(); }} />}</>;
      break;
    case 'Opportunity Pipeline':
      content = <>{customerSelector}{selectedId && <>{canCreate && <section className="panel catalog-form"><h2 className="section-title">New opportunity</h2><div className="catalog-form-grid"><label className="field">Title<input className="input" value={opportunityTitle} onChange={event => setOpportunityTitle(event.target.value)} /></label><label className="field">Expected value<input className="input" type="number" min="0" step="0.01" value={opportunityValue} onChange={event => setOpportunityValue(event.target.value)} /></label><label className="field">Expected close<input className="input" type="date" value={opportunityClose} onChange={event => setOpportunityClose(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !opportunityTitle.trim()} onClick={() => void addOpportunity()}>Create opportunity</button></section>}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Title</th><th>Stage</th><th>Expected value</th><th>Close</th><th>Action</th></tr></thead><tbody>{opportunities.length ? opportunities.map(item => <tr key={item.id}><td>{item.title}</td><td>{item.stage}</td><td>{item.expected_value}</td><td>{date(item.expected_close)}</td><td>{canUpdate && <div className="button-row">{item.stage === 'lead' && <button className="btn" disabled={busy} onClick={() => void advanceOpportunity(item, 'qualified')}>Qualify</button>}{item.stage === 'qualified' && <button className="btn" disabled={busy} onClick={() => void advanceOpportunity(item, 'proposal')}>Proposal</button>}{item.stage === 'proposal' && <button className="btn btn-primary" disabled={busy} onClick={() => void advanceOpportunity(item, 'won')}>Won</button>}{!['won','lost'].includes(item.stage) && <button className="btn" disabled={busy} onClick={() => void advanceOpportunity(item, 'lost')}>Lost</button>}</div>}</td></tr>) : <tr><td colSpan={5} className="empty">No opportunities.</td></tr>}</tbody></table></div></>}</>;
      break;
    case 'Customer Duplicate Review':
      content = <><p className="muted">Potential duplicates use matching email, phone or normalized name. Review them before changing records; automatic merge is not available.</p><div className="panel table-wrap"><table className="data-table"><thead><tr><th>First customer</th><th>Second customer</th><th>Match</th></tr></thead><tbody>{duplicates.length ? duplicates.map(item => <tr key={`${item.first_id}-${item.second_id}`}><td>{item.first_code} · {item.first_name}</td><td>{item.second_code} · {item.second_name}</td><td>{item.match_basis}</td></tr>) : <tr><td colSpan={3} className="empty">No possible duplicates found.</td></tr>}</tbody></table></div></>;
      content = <>{content}<section className="panel catalog-form"><h2 className="section-title">Duplicate matching policy</h2><div className="catalog-form-grid"><label className="field"><input type="checkbox" checked={duplicatePolicy.matchEmail} disabled={!canSetDuplicatePolicy} onChange={event => setDuplicatePolicy(current => ({ ...current, matchEmail: event.target.checked }))} /> Match email</label><label className="field"><input type="checkbox" checked={duplicatePolicy.matchPhone} disabled={!canSetDuplicatePolicy} onChange={event => setDuplicatePolicy(current => ({ ...current, matchPhone: event.target.checked }))} /> Match phone</label><label className="field"><input type="checkbox" checked={duplicatePolicy.matchName} disabled={!canSetDuplicatePolicy} onChange={event => setDuplicatePolicy(current => ({ ...current, matchName: event.target.checked }))} /> Match name</label><label className="field">Enforcement<select className="input" value={duplicatePolicy.enforcement} disabled={!canSetDuplicatePolicy} onChange={event => setDuplicatePolicy(current => ({ ...current, enforcement: event.target.value as DuplicatePolicy['enforcement'] }))}><option value="warn">Warn and require review</option><option value="block">Block matching records</option></select></label></div>{canSetDuplicatePolicy && <button className="btn btn-primary" disabled={busy || !(duplicatePolicy.matchEmail || duplicatePolicy.matchPhone || duplicatePolicy.matchName)} onClick={() => void saveDuplicatePolicy()}>Save policy</button>}</section></>;
      break;
    default:
      content = <p className="empty">CRM screen is being prepared.</p>;
  }
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{screen.description}</p></div><button className="btn" onClick={() => void loadBase().catch(reason => setError(reason instanceof Error ? reason.message : 'Refresh failed'))}>Refresh</button></div>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{loading ? <div className="panel empty">Loading CRM…</div> : content}</>;
}
