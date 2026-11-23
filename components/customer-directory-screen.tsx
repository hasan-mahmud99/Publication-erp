"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

export type Customer = {
  id: string;
  customer_code: string;
  customer_type: string;
  name: string;
  email: string | null;
  phone: string | null;
  credit_limit: string;
  status: string;
  version_no: number;
  segment_id: string | null;
  territory_id: string | null;
  segment_name?: string | null;
  territory_name?: string | null;
};

export type Territory = {
  id: string;
  code: string;
  name: string;
};

export type Contact = {
  id: string;
  name: string;
  role_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

export type Address = {
  id: string;
  address_type: string;
  line1: string;
  city: string | null;
  district: string | null;
  is_default: number | boolean;
  status: string;
};

export type Activity = {
  id: string;
  activity_type: string;
  summary: string;
  occurred_at: string;
  author_name: string;
};

export type SalesHistory = {
  orders: Array<{ id: string; order_number: string; order_date: string; status: string; total_amount: string }>;
  invoices: Array<{ id: string; invoice_number: string; invoice_date: string; status: string; total_amount: string; dispatched_copies: string }>;
  returns: Array<{ id: string; return_number: string; return_date: string; status: string; invoice_number: string | null }>;
  truncated: { orders: boolean; invoices: boolean; returns: boolean };
};

export type Preferences = {
  emailOptIn: boolean;
  smsOptIn: boolean;
  phoneOptIn: boolean;
  version: number;
  configured: boolean;
};

export type DuplicateCandidate = {
  id: string;
  customer_code: string;
  name: string;
  match_basis: string;
};

export type DuplicatePolicy = {
  matchEmail: boolean;
  matchPhone: boolean;
  matchName: boolean;
  enforcement: 'warn' | 'block';
};

const CUSTOMER_TYPES = [
  { id: 'all', label: 'All Customer Types' },
  { id: 'bookstore', label: 'Bookstore / Retailer', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'distributor', label: 'Distributor / Wholesaler', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'school', label: 'School / College', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'library', label: 'Library / Institutional', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'institution', label: 'Public Institution', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { id: 'direct', label: 'Direct Reader', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' }
];

export function CustomerDirectoryScreen({ screen }: { screen: Screen }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [me, setMe] = useState<{ userId: string; role: string; permissions: string[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTerritory, setSelectedTerritory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Customer 360 Modal / Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'contacts' | 'sales' | 'returns' | 'activities' | 'preferences'>('overview');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesHistory | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // New Customer Form Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    type: 'bookstore',
    email: '',
    phone: '',
    creditLimit: '100000',
    territoryId: '',
    addressLine: '',
    addressCity: 'Dhaka'
  });
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>({ matchEmail: true, matchPhone: true, matchName: true, enforcement: 'warn' });
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  // Edit Customer Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'bookstore',
    email: '',
    phone: '',
    creditLimit: '0',
    status: 'active',
    territoryId: ''
  });

  // Add Contact Modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', role: 'Manager', email: '', phone: '' });

  // Add Address Modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({ type: 'shipping', line1: '', city: 'Dhaka', district: '' });

  // Activity Log State
  const [activityType, setActivityType] = useState<'call' | 'note' | 'meeting' | 'email'>('call');
  const [activitySummary, setActivitySummary] = useState('');

  const canManage = me?.role === 'Owner' || Boolean(me?.permissions.includes('workspace.update'));

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [custRes, terrRes, meRes] = await Promise.all([
        api<{ data: Customer[] }>('/customers?limit=200'),
        api<{ data: Territory[] }>('/crm/territories'),
        api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me')
      ]);
      const list = custRes.data || [];
      setCustomers(list);
      setTerritories(terrRes.data || []);
      setMe(meRes.data);

      // Check if URL has ?customer=ID
      if (typeof window !== 'undefined') {
        const queryCustId = new URLSearchParams(window.location.search).get('customer');
        if (queryCustId) {
          const matched = list.find(c => c.id === queryCustId);
          if (matched) {
            void openCustomer360(matched);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load customer directory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch =
        !search.trim() ||
        c.customer_code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.territory_name && c.territory_name.toLowerCase().includes(search.toLowerCase()));

      const matchesType = selectedType === 'all' || c.customer_type === selectedType;
      const matchesTerritory = selectedTerritory === 'all' || c.territory_id === selectedTerritory;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchesSearch && matchesType && matchesTerritory && matchesStatus;
    });
  }, [customers, search, selectedType, selectedTerritory, statusFilter]);

  // Executive Metrics
  const metrics = useMemo(() => {
    const active = customers.filter(c => c.status === 'active');
    const totalCredit = active.reduce((sum, c) => sum + (parseFloat(c.credit_limit) || 0), 0);
    const bookstoreCount = customers.filter(c => c.customer_type === 'bookstore').length;
    const distributorCount = customers.filter(c => c.customer_type === 'distributor').length;
    const instCount = customers.filter(c => ['school', 'library', 'institution'].includes(c.customer_type)).length;

    return {
      total: customers.length,
      activeCount: active.length,
      totalCreditFormatted: (totalCredit / 100000).toFixed(1) + ' Lac ৳',
      bookstoreCount,
      distributorCount,
      instCount
    };
  }, [customers]);

  // Load Customer 360 Details
  async function openCustomer360(customer: Customer) {
    setSelectedCustomer(customer);
    setProfileTab('overview');
    setProfileLoading(true);
    try {
      const [contactsRes, addrsRes, actsRes, histRes, prefsRes] = await Promise.all([
        api<{ data: Contact[] }>(`/customers/${customer.id}/contacts`),
        api<{ data: Address[] }>(`/customers/${customer.id}/addresses`),
        api<{ data: Activity[] }>(`/customers/${customer.id}/activities`),
        api<{ data: SalesHistory }>(`/sales/customers/${customer.id}/history`).catch(() => ({ data: { orders: [], invoices: [], returns: [], truncated: { orders: false, invoices: false, returns: false } } })),
        api<{ data: Preferences }>(`/customers/${customer.id}/communication-preferences`).catch(() => null)
      ]);
      setContacts(contactsRes.data || []);
      setAddresses(addrsRes.data || []);
      setActivities(actsRes.data || []);
      setSalesHistory(histRes.data);
      if (prefsRes?.data) setPreferences(prefsRes.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load customer 360 profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  // Create Customer with Duplicate Check
  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    // Pre-flight duplicate check
    if (!duplicateConfirmed) {
      try {
        const check = (await api<{ data: { policy: DuplicatePolicy; matches: DuplicateCandidate[] } }>('/crm/duplicates/check', {
          method: 'POST',
          body: JSON.stringify({
            name: createForm.name.trim(),
            email: createForm.email.trim() || '',
            phone: createForm.phone.trim() || ''
          })
        })).data;

        if (check.matches.length > 0) {
          setDuplicateCandidates(check.matches);
          setDuplicatePolicy(check.policy);
          setDuplicateConfirmed(true);
          setBusy(false);
          return;
        }
      } catch (checkErr) {
        // proceed if check endpoint unblocked
      }
    }

    try {
      const res = await api<{ data: { id: string } }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          code: createForm.code.trim(),
          name: createForm.name.trim(),
          type: createForm.type,
          email: createForm.email.trim() || null,
          phone: createForm.phone.trim() || null,
          creditLimit: createForm.creditLimit,
          territoryId: createForm.territoryId || null
        })
      });

      // If initial address provided, save it
      if (createForm.addressLine.trim()) {
        await api(`/customers/${res.data.id}/addresses`, {
          method: 'POST',
          body: JSON.stringify({
            type: 'shipping',
            line1: createForm.addressLine.trim(),
            city: createForm.addressCity.trim() || null,
            isDefault: true
          })
        }).catch(() => null);
      }

      setNotice(`Customer ${createForm.name} created successfully.`);
      setShowCreateModal(false);
      setDuplicateCandidates([]);
      setDuplicateConfirmed(false);
      setCreateForm({
        code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        type: 'bookstore',
        email: '',
        phone: '',
        creditLimit: '100000',
        territoryId: '',
        addressLine: '',
        addressCity: 'Dhaka'
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create customer.');
    } finally {
      setBusy(false);
    }
  }

  // Edit Customer
  function openEdit(customer: Customer) {
    setEditForm({
      name: customer.name,
      type: customer.customer_type,
      email: customer.email || '',
      phone: customer.phone || '',
      creditLimit: customer.credit_limit || '0',
      status: customer.status,
      territoryId: customer.territory_id || ''
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/customers/${selectedCustomer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: selectedCustomer.version_no,
          name: editForm.name.trim(),
          type: editForm.type,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          creditLimit: editForm.creditLimit,
          status: editForm.status,
          territoryId: editForm.territoryId || null
        })
      });
      setNotice(`Customer account updated.`);
      setShowEditModal(false);
      await loadData();
      const updatedCustRes = await api<{ data: Customer }>(`/customers/${selectedCustomer.id}`);
      setSelectedCustomer(updatedCustRes.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to update customer.');
    } finally {
      setBusy(false);
    }
  }

  // Add Contact
  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    setBusy(true);
    try {
      await api(`/customers/${selectedCustomer.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          name: contactForm.name.trim(),
          roleName: contactForm.role.trim() || null,
          email: contactForm.email.trim() || null,
          phone: contactForm.phone.trim() || null
        })
      });
      setShowContactModal(false);
      setContactForm({ name: '', role: 'Manager', email: '', phone: '' });
      const cRes = await api<{ data: Contact[] }>(`/customers/${selectedCustomer.id}/contacts`);
      setContacts(cRes.data || []);
      setNotice('New contact person added.');
    } catch (err: any) {
      setError(err?.message || 'Failed to add contact.');
    } finally {
      setBusy(false);
    }
  }

  // Add Address
  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    setBusy(true);
    try {
      await api(`/customers/${selectedCustomer.id}/addresses`, {
        method: 'POST',
        body: JSON.stringify({
          type: addressForm.type,
          line1: addressForm.line1.trim(),
          city: addressForm.city.trim() || null,
          district: addressForm.district.trim() || null,
          isDefault: addresses.length === 0
        })
      });
      setShowAddressModal(false);
      setAddressForm({ type: 'shipping', line1: '', city: 'Dhaka', district: '' });
      const aRes = await api<{ data: Address[] }>(`/customers/${selectedCustomer.id}/addresses`);
      setAddresses(aRes.data || []);
      setNotice('New address registered.');
    } catch (err: any) {
      setError(err?.message || 'Failed to add address.');
    } finally {
      setBusy(false);
    }
  }

  // Log Activity
  async function handleLogActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer || !activitySummary.trim()) return;
    setBusy(true);
    try {
      await api(`/customers/${selectedCustomer.id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          type: activityType,
          summary: activitySummary.trim()
        })
      });
      setActivitySummary('');
      const actsRes = await api<{ data: Activity[] }>(`/customers/${selectedCustomer.id}/activities`);
      setActivities(actsRes.data || []);
      setNotice('Activity logged.');
    } catch (err: any) {
      setError(err?.message || 'Failed to record activity.');
    } finally {
      setBusy(false);
    }
  }

  // Save Communication Preferences
  async function handleSavePreferences(prefs: Preferences) {
    if (!selectedCustomer) return;
    setBusy(true);
    try {
      const res = await api<{ data: Preferences }>(`/customers/${selectedCustomer.id}/communication-preferences`, {
        method: 'PUT',
        body: JSON.stringify({
          version: prefs.version,
          emailOptIn: prefs.emailOptIn,
          smsOptIn: prefs.smsOptIn,
          phoneOptIn: prefs.phoneOptIn
        })
      });
      setPreferences(res.data);
      setNotice('Communication preferences saved.');
    } catch (err: any) {
      setError(err?.message || 'Could not save preferences.');
    } finally {
      setBusy(false);
    }
  }

  // Export CSV
  async function handleExportCsv() {
    setBusy(true);
    try {
      const blob = await apiFile('/sales/customers/export.csv');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers_directory_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setError(err?.message || 'Could not export customer CSV.');
    } finally {
      setBusy(false);
    }
  }

  const getTypeMeta = (type: string) => {
    return CUSTOMER_TYPES.find(t => t.id === type) || { id: type, label: type, color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            Customer Profile
          </h1>
          <p className="muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            Customer Directory &amp; 360&deg; Trade Hub: bookstores, distributors, schools, and institutional accounts.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void loadData()}
            disabled={loading || busy}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void handleExportCsv()}
            disabled={busy}
          >
            Export CSV
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setDuplicateCandidates([]);
                setDuplicateConfirmed(false);
                setShowCreateModal(true);
              }}
              style={{ fontWeight: 600 }}
            >
              + New Customer
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '1rem' }}>
          {notice}
        </div>
      )}

      {/* 4 Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Trade Customers</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>{metrics.total}</div>
          <div style={{ fontSize: '0.78rem', color: '#16a34a' }}>{metrics.activeCount} active trade accounts</div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Credit Allocated</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>{metrics.totalCreditFormatted}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Total authorized receivables credit</div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Bookstores &amp; Retail</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563eb', margin: '0.2rem 0' }}>{metrics.bookstoreCount}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Verified retail bookstore stockists</div>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Wholesalers &amp; Inst.</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#059669', margin: '0.2rem 0' }}>
            {metrics.distributorCount + metrics.instCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{metrics.distributorCount} Distributors &bull; {metrics.instCount} Institutions</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search */}
          <div style={{ minWidth: '240px', flex: '1 1 260px' }}>
            <input
              id="cust-search-input"
              name="custSearch"
              type="text"
              className="input"
              placeholder="Search by code, bookstore name, phone, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Type Filter Chips */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {CUSTOMER_TYPES.slice(0, 5).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedType === t.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: selectedType === t.id ? '#eff6ff' : '#ffffff',
                  color: selectedType === t.id ? '#1d4ed8' : '#64748b'
                }}
              >
                {t.label.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Territory Dropdown */}
          <div>
            <select
              id="cust-territory-select"
              name="custTerritory"
              className="input"
              value={selectedTerritory}
              onChange={e => setSelectedTerritory(e.target.value)}
              style={{ minWidth: '170px' }}
            >
              <option value="all">All Territories</option>
              {territories.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div className="table-wrap">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.78rem', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem' }}>CUSTOMER &amp; CODE</th>
                <th style={{ padding: '0.75rem 1rem' }}>TYPE</th>
                <th style={{ padding: '0.75rem 1rem' }}>PRIMARY CONTACT</th>
                <th style={{ padding: '0.75rem 1rem' }}>SALES TERRITORY</th>
                <th style={{ padding: '0.75rem 1rem' }}>CREDIT LIMIT</th>
                <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    Loading customer directory...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(cust => {
                  const typeMeta = getTypeMeta(cust.customer_type);
                  const territoryObj = territories.find(t => t.id === cust.territory_id);

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => void openCustomer360(cust)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        background: selectedCustomer?.id === cust.id ? '#f0fdf4' : 'transparent'
                      }}
                      className="hover:bg-slate-50"
                    >
                      {/* Name & Code */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{cust.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {cust.customer_code}
                        </div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: typeMeta.color,
                            background: typeMeta.bg,
                            border: `1px solid ${typeMeta.border}`
                          }}
                        >
                          {typeMeta.label}
                        </span>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ color: '#0f172a', fontWeight: 500 }}>
                          {cust.phone || '—'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {cust.email || 'No email'}
                        </div>
                      </td>

                      {/* Territory */}
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        {territoryObj ? territoryObj.name : 'Unassigned'}
                      </td>

                      {/* Credit Limit */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        ৳{parseFloat(cust.credit_limit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: cust.status === 'active' ? '#dcfce7' : '#fee2e2',
                            color: cust.status === 'active' ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {cust.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void openCustomer360(cust)}
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          Open 360&deg;
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER 360° PROFILE DRAWER / MODAL */}
      {selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setSelectedCustomer(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 820,
              width: '95%',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: 14,
              padding: 24,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 className="section-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    Customer 360 &middot; {selectedCustomer.customer_code}
                  </h2>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      ...getTypeMeta(selectedCustomer.customer_type)
                    }}
                  >
                    {getTypeMeta(selectedCustomer.customer_type).label}
                  </span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: selectedCustomer.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: selectedCustomer.status === 'active' ? '#15803d' : '#b91c1c'
                    }}
                  >
                    {selectedCustomer.status}
                  </span>
                </div>
                <div style={{ margin: '4px 0 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>
                  {selectedCustomer.name}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {canManage && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => openEdit(selectedCustomer)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Edit Account
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelectedCustomer(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Phone</div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{selectedCustomer.phone || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Email</div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{selectedCustomer.email || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Credit Limit</div>
                <div style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.95rem' }}>
                  ৳{parseFloat(selectedCustomer.credit_limit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Territory</div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                  {territories.find(t => t.id === selectedCustomer.territory_id)?.name || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Sub-tabs inside 360 Profile */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: '0.5rem', marginBottom: 16 }}>
              {(['overview', 'contacts', 'sales', 'returns', 'activities', 'preferences'] as const).map(tabKey => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setProfileTab(tabKey)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    border: 'none',
                    background: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    color: profileTab === tabKey ? '#2563eb' : '#64748b',
                    borderBottom: profileTab === tabKey ? '2px solid #2563eb' : '2px solid transparent',
                    marginBottom: '-2px',
                    textTransform: 'capitalize'
                  }}
                >
                  {tabKey === 'overview' ? 'Overview' :
                   tabKey === 'contacts' ? `Contacts & Addresses (${contacts.length + addresses.length})` :
                   tabKey === 'sales' ? 'Sales' :
                   tabKey === 'returns' ? 'Returns' :
                   tabKey === 'activities' ? `Activities (${activities.length})` : 'Preferences'}
                </button>
              ))}
            </div>

            {profileLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading customer details...</div>
            ) : (
              <div>
                {/* SUB-TAB: OVERVIEW */}
                {profileTab === 'overview' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Relationship</h3>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem' }}>{contacts.length} contacts &bull; {addresses.length} addresses</p>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem' }}>Configured credit limit: {selectedCustomer.credit_limit} BDT</p>
                      <p className="muted" style={{ margin: '8px 0 0 0', fontSize: '0.78rem' }}>Available credit and receivables are calculated from posted invoices.</p>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Recent work</h3>
                      {activities.slice(0, 4).map(act => (
                        <div key={act.id} style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                          {act.occurred_at.slice(0, 10)} &bull; <strong style={{ textTransform: 'capitalize' }}>{act.activity_type}</strong>: {act.summary}
                        </div>
                      ))}
                      {activities.length === 0 && <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>No activities recorded.</p>}
                    </div>
                  </div>
                )}

                {/* SUB-TAB: CONTACTS & ADDRESSES */}
                {profileTab === 'contacts' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {/* Contacts List */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                          Authorized Contacts
                        </h3>
                        {canManage && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setShowContactModal(true)}
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            + Add Contact
                          </button>
                        )}
                      </div>

                      {contacts.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>No contacts recorded.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {contacts.map(ct => (
                            <div key={ct.id} style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{ct.name}</div>
                              <div style={{ color: '#475569', fontSize: '0.75rem' }}>{ct.role_name || 'Contact Person'}</div>
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 4, color: '#64748b', fontSize: '0.75rem' }}>
                                <span>📞 {ct.phone || '—'}</span>
                                <span>✉️ {ct.email || '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delivery & Billing Addresses */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                          Addresses &amp; Godowns
                        </h3>
                        {canManage && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setShowAddressModal(true)}
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            + Add Address
                          </button>
                        )}
                      </div>

                      {addresses.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>No addresses recorded.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {addresses.map(ad => (
                            <div key={ad.id} style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong style={{ textTransform: 'capitalize', color: '#0f172a' }}>{ad.address_type} Address</strong>
                                {Boolean(ad.is_default) && (
                                  <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                                    DEFAULT
                                  </span>
                                )}
                              </div>
                              <div style={{ color: '#334155', marginTop: 3 }}>{ad.line1}</div>
                              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                {ad.city ? `${ad.city}, Bangladesh` : 'Bangladesh'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB: SALES */}
                {profileTab === 'sales' && (
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>
                      Invoice sources
                    </h3>
                    <p className="muted" style={{ margin: '0 0 12px 0', fontSize: '0.8rem' }}>
                      Source totals are not paid revenue or outstanding receivables.
                    </p>

                    {salesHistory?.invoices.length === 0 && salesHistory?.orders.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No invoice sources recorded.</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                              <th style={{ padding: '6px 10px' }}>INVOICE #</th>
                              <th style={{ padding: '6px 10px' }}>DATE</th>
                              <th style={{ padding: '6px 10px' }}>DISPATCHED COPIES</th>
                              <th style={{ padding: '6px 10px' }}>SOURCE TOTAL</th>
                              <th style={{ padding: '6px 10px' }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salesHistory?.invoices.map(inv => (
                              <tr key={inv.id}>
                                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{inv.invoice_number}</td>
                                <td style={{ padding: '6px 10px' }}>{inv.invoice_date.slice(0, 10)}</td>
                                <td style={{ padding: '6px 10px' }}>{inv.dispatched_copies} dispatched copies</td>
                                <td style={{ padding: '6px 10px', fontWeight: 700 }}>{inv.total_amount} BDT</td>
                                <td style={{ padding: '6px 10px', textTransform: 'uppercase' }}>{inv.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB: RETURNS */}
                {profileTab === 'returns' && (
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                      Customer Returns
                    </h3>

                    {(!salesHistory?.returns || salesHistory.returns.length === 0) ? (
                      <p className="muted" style={{ fontSize: '0.82rem' }}>No returns recorded.</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                              <th style={{ padding: '6px 10px' }}>RETURN #</th>
                              <th style={{ padding: '6px 10px' }}>DATE</th>
                              <th style={{ padding: '6px 10px' }}>INVOICE</th>
                              <th style={{ padding: '6px 10px' }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salesHistory.returns.map(ret => (
                              <tr key={ret.id}>
                                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{ret.return_number}</td>
                                <td style={{ padding: '6px 10px' }}>{ret.return_date.slice(0, 10)}</td>
                                <td style={{ padding: '6px 10px' }}>{ret.invoice_number || 'unreferenced'}</td>
                                <td style={{ padding: '6px 10px', textTransform: 'uppercase' }}>{ret.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB: ACTIVITIES */}
                {profileTab === 'activities' && (
                  <div>
                    {canManage && (
                      <form onSubmit={handleLogActivity} style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Log New Activity:</span>
                          {(['call', 'meeting', 'note', 'email'] as const).map(act => (
                            <button
                              key={act}
                              type="button"
                              onClick={() => setActivityType(act)}
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                textTransform: 'capitalize',
                                border: activityType === act ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                background: activityType === act ? '#eff6ff' : '#ffffff',
                                color: activityType === act ? '#1d4ed8' : '#64748b',
                                cursor: 'pointer'
                              }}
                            >
                              {act}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Discussed textbook order and delivery schedule..."
                            className="input"
                            value={activitySummary}
                            onChange={e => setActivitySummary(e.target.value)}
                            style={{ flex: 1, fontSize: '0.82rem' }}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={busy || !activitySummary.trim()}
                            style={{ fontSize: '0.8rem' }}
                          >
                            Log
                          </button>
                        </div>
                      </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {activities.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>No activities recorded.</p>
                      ) : (
                        activities.map(act => (
                          <div key={act.id} style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                              <span>
                                <strong style={{ textTransform: 'capitalize', color: '#0f172a' }}>{act.activity_type}</strong> &bull; {act.summary}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                {act.occurred_at.slice(0, 10)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                              Logged by: {act.author_name}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB: PREFERENCES */}
                {profileTab === 'preferences' && (
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>
                      Communication preferences
                    </h3>
                    <p className="muted" style={{ margin: '0 0 12px 0', fontSize: '0.8rem' }}>
                      {preferences?.configured ? 'Preferences recorded.' : 'No preferences recorded; all channels are opted out by default.'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0', maxWidth: 360 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(preferences?.emailOptIn)}
                          disabled={!canManage}
                          onChange={e => preferences && setPreferences({ ...preferences, emailOptIn: e.target.checked })}
                        />
                        <span>Email opt-in</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(preferences?.smsOptIn)}
                          disabled={!canManage}
                          onChange={e => preferences && setPreferences({ ...preferences, smsOptIn: e.target.checked })}
                        />
                        <span>SMS opt-in</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(preferences?.phoneOptIn)}
                          disabled={!canManage}
                          onChange={e => preferences && setPreferences({ ...preferences, phoneOptIn: e.target.checked })}
                        />
                        <span>Phone opt-in</span>
                      </label>

                      {canManage && preferences && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => void handleSavePreferences(preferences)}
                          style={{ marginTop: 8, fontSize: '0.8rem' }}
                        >
                          Save preferences
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOMER */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 12,
              padding: 24,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                New customer
              </h2>
              <button
                type="button"
                className="btn"
                onClick={() => setShowCreateModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            {/* Potential Duplicates Warning */}
            {duplicateCandidates.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.85rem', marginBottom: 14 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 700, color: '#b45309' }}>
                  Potential duplicate customers
                </h3>
                {duplicateCandidates.map(c => (
                  <p key={c.id} style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#92400e' }}>
                    {c.customer_code} &bull; {c.name} (matched by {c.match_basis})
                  </p>
                ))}
                <p className="muted" style={{ margin: '6px 0 0 0', fontSize: '0.75rem' }}>
                  {duplicatePolicy.enforcement === 'block'
                    ? 'Creation is blocked by the organization policy.'
                    : 'Review these records. If this is a separate customer, click Create customer again to confirm.'}
                </p>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="create-cust-code">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Code</span>
                  <input
                    id="create-cust-code"
                    type="text"
                    required
                    className="input"
                    value={createForm.code}
                    onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                </label>

                <label className="field" htmlFor="create-cust-type">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Type</span>
                  <select
                    id="create-cust-type"
                    className="input"
                    value={createForm.type}
                    onChange={e => setCreateForm({ ...createForm, type: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {CUSTOMER_TYPES.filter(t => t.id !== 'all').map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field" htmlFor="create-cust-name">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name</span>
                <input
                  id="create-cust-name"
                  type="text"
                  required
                  placeholder="e.g. Batighar Bookshop"
                  className="input"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="create-cust-phone">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone</span>
                  <input
                    id="create-cust-phone"
                    type="text"
                    placeholder="e.g. 01711-234567"
                    className="input"
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="field" htmlFor="create-cust-email">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email</span>
                  <input
                    id="create-cust-email"
                    type="email"
                    placeholder="e.g. books@batighar.com"
                    className="input"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="create-cust-credit">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Credit limit</span>
                  <input
                    id="create-cust-credit"
                    type="number"
                    min="0"
                    step="1000"
                    className="input"
                    value={createForm.creditLimit}
                    onChange={e => setCreateForm({ ...createForm, creditLimit: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="field" htmlFor="create-cust-territory">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Territory</span>
                  <select
                    id="create-cust-territory"
                    className="input"
                    value={createForm.territoryId}
                    onChange={e => setCreateForm({ ...createForm, territoryId: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Unassigned</option>
                    {territories.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field" htmlFor="create-cust-address">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Primary Delivery Godown Address</span>
                <input
                  id="create-cust-address"
                  type="text"
                  placeholder="e.g. 14 Banglabazar Book Market, Dhaka"
                  className="input"
                  value={createForm.addressLine}
                  onChange={e => setCreateForm({ ...createForm, addressLine: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !createForm.code.trim() || !createForm.name.trim() || (duplicateCandidates.length > 0 && duplicatePolicy.enforcement === 'block')}
                >
                  {busy ? 'Saving...' : 'Create customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CUSTOMER */}
      {showEditModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 12,
              padding: 24,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Edit Account: {selectedCustomer.customer_code}
              </h2>
              <button
                type="button"
                className="btn"
                onClick={() => setShowEditModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="field" htmlFor="edit-cust-name">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name *</span>
                <input
                  id="edit-cust-name"
                  type="text"
                  required
                  className="input"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="edit-cust-type">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Customer Type</span>
                  <select
                    id="edit-cust-type"
                    className="input"
                    value={editForm.type}
                    onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {CUSTOMER_TYPES.filter(t => t.id !== 'all').map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="edit-cust-status">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</span>
                  <select
                    id="edit-cust-status"
                    className="input"
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="edit-cust-phone">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone</span>
                  <input
                    id="edit-cust-phone"
                    type="text"
                    className="input"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="field" htmlFor="edit-cust-email">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email</span>
                  <input
                    id="edit-cust-email"
                    type="email"
                    className="input"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="edit-cust-credit">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Credit Limit (BDT ৳)</span>
                  <input
                    id="edit-cust-credit"
                    type="number"
                    min="0"
                    step="1000"
                    className="input"
                    value={editForm.creditLimit}
                    onChange={e => setEditForm({ ...editForm, creditLimit: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="field" htmlFor="edit-cust-territory">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Territory</span>
                  <select
                    id="edit-cust-territory"
                    className="input"
                    value={editForm.territoryId}
                    onChange={e => setEditForm({ ...editForm, territoryId: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Unassigned</option>
                    {territories.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowEditModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !editForm.name.trim()}
                >
                  {busy ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CONTACT */}
      {showContactModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowContactModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: '92%',
              borderRadius: 12,
              padding: 20,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Add Authorized Contact
            </h3>
            <form onSubmit={handleAddContact} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="field" htmlFor="contact-name-input">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name *</span>
                <input
                  id="contact-name-input"
                  type="text"
                  required
                  placeholder="e.g. Mr. Rafiqul Islam"
                  className="input"
                  value={contactForm.name}
                  onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <label className="field" htmlFor="contact-role-input">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Role / Designation</span>
                <input
                  id="contact-role-input"
                  type="text"
                  placeholder="e.g. Store Manager, Accounts Head"
                  className="input"
                  value={contactForm.role}
                  onChange={e => setContactForm({ ...contactForm, role: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <label className="field" htmlFor="contact-phone-input">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone</span>
                <input
                  id="contact-phone-input"
                  type="text"
                  placeholder="e.g. 01819-345678"
                  className="input"
                  value={contactForm.phone}
                  onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <label className="field" htmlFor="contact-email-input">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email</span>
                <input
                  id="contact-email-input"
                  type="email"
                  placeholder="e.g. rafiq@example.com"
                  className="input"
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => setShowContactModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !contactForm.name.trim()}>Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ADDRESS */}
      {showAddressModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowAddressModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: '92%',
              borderRadius: 12,
              padding: 20,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Add Delivery / Godown Address
            </h3>
            <form onSubmit={handleAddAddress} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="field" htmlFor="addr-type-select">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Address Type</span>
                <select
                  id="addr-type-select"
                  className="input"
                  value={addressForm.type}
                  onChange={e => setAddressForm({ ...addressForm, type: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="shipping">Delivery / Godown Address</option>
                  <option value="billing">Billing Office Address</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="field" htmlFor="addr-line-input">
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Address Line *</span>
                <input
                  id="addr-line-input"
                  type="text"
                  required
                  placeholder="e.g. 28 Banglabazar, 2nd Floor, Press Building"
                  className="input"
                  value={addressForm.line1}
                  onChange={e => setAddressForm({ ...addressForm, line1: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="field" htmlFor="addr-city-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>City / Division</span>
                  <input
                    id="addr-city-input"
                    type="text"
                    placeholder="e.g. Dhaka"
                    className="input"
                    value={addressForm.city}
                    onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="field" htmlFor="addr-district-input">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>District</span>
                  <input
                    id="addr-district-input"
                    type="text"
                    placeholder="e.g. Kotwali, Dhaka"
                    className="input"
                    value={addressForm.district}
                    onChange={e => setAddressForm({ ...addressForm, district: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => setShowAddressModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !addressForm.line1.trim()}>Save Address</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
