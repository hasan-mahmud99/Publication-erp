"use client";

import { useEffect, useState, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  FileText,
  Mail,
  Phone,
  MapPin,
  Tag,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
type SupplierForm = {
  code: string;
  name: string;
  legalName: string;
  taxRegistration: string;
  categories: string[];
  businessType: string;
  contactPerson: string;
  phone: string;
  email: string;
  website: string;
  billingAddress: string;
  serviceAddress: string;
  division: string;
  district: string;
  upazila: string;
  postalCode: string;
  country: string;
  paymentTermsDays: number;
  currencyCode: string;
  preferredPaymentMethod: string;
  leadTimeDays: number | null;
  deliveryConditions: string;
  notes: string;
};

const CATEGORIES = [
  'paper',
  'ink',
  'printing_plate',
  'printing_press',
  'binding',
  'cover_material',
  'packaging',
  'stationery',
  'machinery',
  'service',
  'general',
];

const label = (value: string) =>
  String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

const blankForm = (): SupplierForm => ({
  code: '',
  name: '',
  legalName: '',
  taxRegistration: '',
  categories: [],
  businessType: '',
  contactPerson: '',
  phone: '',
  email: '',
  website: '',
  billingAddress: '',
  serviceAddress: '',
  division: '',
  district: '',
  upazila: '',
  postalCode: '',
  country: 'Bangladesh',
  paymentTermsDays: 30,
  currencyCode: 'BDT',
  preferredPaymentMethod: '',
  leadTimeDays: 7,
  deliveryConditions: '',
  notes: '',
});

const textKeys: (keyof SupplierForm)[] = [
  'taxRegistration',
  'businessType',
  'contactPerson',
  'phone',
  'email',
  'website',
  'billingAddress',
  'serviceAddress',
  'division',
  'district',
  'upazila',
  'postalCode',
  'preferredPaymentMethod',
  'deliveryConditions',
  'notes',
];

export function SupplierDirectoryScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Current user permissions
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const canManage = role === 'Owner' || permissions.includes('procurement.manage');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Row | null>(null);
  const [form, setForm] = useState<SupplierForm>(blankForm);

  const [viewingSupplier, setViewingSupplier] = useState<Row | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    jobTitle: '',
    email: '',
    phone: '',
    isPrimary: false,
  });

  async function loadList(page = offset) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        limit: '50',
        offset: String(page),
        sort: 'name',
        direction: 'asc',
      });
      if (search.trim()) query.set('search', search.trim());
      if (statusFilter) query.set('status', statusFilter);
      if (categoryFilter) query.set('category', categoryFilter);

      const result = await api<{ data: { data: Row[]; meta: { total: number } } }>(
        `/procurement/suppliers?${query}`
      );
      setRows(result.data.data || []);
      setTotal(result.data.meta.total || 0);
      setOffset(page);
    } catch (err: any) {
      setError(err?.message || 'Could not load suppliers list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      api<{ data: { data: Row[]; meta: { total: number } } }>(
        '/procurement/suppliers?limit=50&offset=0&sort=name&direction=asc'
      ),
    ])
      .then(([me, list]) => {
        setRole(me.data.role);
        setPermissions(me.data.permissions);
        setRows(list.data.data || []);
        setTotal(list.data.meta.total || 0);
      })
      .catch((err: any) => setError(err?.message || 'Could not load supplier directory'))
      .finally(() => setLoading(false));
  }, []);

  async function openSupplier(id: string) {
    setError('');
    try {
      const res = await api<{ data: Row }>(`/procurement/suppliers/${id}`);
      setViewingSupplier(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load supplier details');
    }
  }

  function startEdit(row: Row | null) {
    const next = blankForm();
    if (row) {
      next.code = row.supplier_code;
      next.name = row.name;
      next.legalName = row.legal_name || row.name;
      next.categories = row.categories || [];
      next.paymentTermsDays = Number(row.payment_terms_days || 0);
      next.currencyCode = row.currency_code || 'BDT';
      next.country = row.country || 'Bangladesh';
      next.leadTimeDays = row.lead_time_days == null ? null : Number(row.lead_time_days);
      for (const key of textKeys) {
        const dbKey = key === 'taxRegistration' ? 'tax_registration' : key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
        (next as any)[key] = row[dbKey] || '';
      }
    } else {
      next.code = `SUP-${Date.now().toString().slice(-4)}`;
    }
    setEditingSupplier(row);
    setForm(next);
    setShowCreateModal(true);
    setNotice('');
    setError('');
  }

  async function saveSupplier(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload: Record<string, unknown> = { ...form };
      for (const key of textKeys) payload[key] = form[key] || null;
      if (!payload.categories || !(payload.categories as string[]).length) {
        payload.categories = ['general'];
      }

      await api<{ data: Row }>(
        editingSupplier ? `/procurement/suppliers/${editingSupplier.id}` : '/procurement/suppliers',
        {
          method: editingSupplier ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      setNotice(editingSupplier ? `Supplier ${form.name} updated.` : `Supplier ${form.name} registered.`);
      setShowCreateModal(false);
      await loadList(editingSupplier ? offset : 0);
    } catch (err: any) {
      setError(err?.message || 'Could not save supplier');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(supplier: Row) {
    setBusy(true);
    setError('');
    try {
      const next = supplier.status === 'active' ? 'inactive' : 'active';
      await api(`/procurement/suppliers/${supplier.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setNotice(`Supplier status changed to ${next}.`);
      if (viewingSupplier && viewingSupplier.id === supplier.id) {
        setViewingSupplier({ ...viewingSupplier, status: next });
      }
      await loadList();
    } catch (err: any) {
      setError(err?.message || 'Could not toggle supplier status');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    if (!viewingSupplier) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ data: Row }>(`/procurement/suppliers/${viewingSupplier.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          ...contactForm,
          jobTitle: contactForm.jobTitle || null,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
        }),
      });
      setViewingSupplier(res.data);
      setContactForm({ name: '', jobTitle: '', email: '', phone: '', isPrimary: false });
      setNotice('Contact person added.');
    } catch (err: any) {
      setError(err?.message || 'Could not add contact');
    } finally {
      setBusy(false);
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = total || rows.length;
    const activeCount = rows.filter(r => r.status === 'active').length;
    const materialCount = rows.filter(r =>
      (r.categories || []).some((c: string) => ['paper', 'ink', 'printing_plate', 'packaging'].includes(c))
    ).length;
    const serviceCount = rows.filter(r =>
      (r.categories || []).some((c: string) => ['printing_press', 'binding', 'service'].includes(c))
    ).length;
    return { totalCount, activeCount, materialCount, serviceCount };
  }, [rows, total]);

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Manage your suppliers, paper mills, printing presses, binders, and materials vendors.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadList()} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {canManage && (
            <button className="btn btn-primary" onClick={() => startEdit(null)}>
              <Plus size={16} />
              <span>+ Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #3b82f6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Total Suppliers
            </span>
            <Building2 size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.totalCount}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Registered vendors & presses</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #10b981',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Active Vendors
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.activeCount}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Eligible for purchase and orders</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #8b5cf6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Material Suppliers
            </span>
            <Layers size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.materialCount}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Paper, ink, plates, board</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #f59e0b',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Press &amp; Binding
            </span>
            <Tag size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.serviceCount}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Printing presses & bindery houses</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 16,
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: '1 1 320px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search code, name, contact, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void loadList(0);
              }}
              style={{ paddingLeft: 36, height: 38 }}
            />
          </div>

          <select
            className="input"
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
            }}
            style={{ width: 170, height: 38 }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
            }}
            style={{ width: 150, height: 38 }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            className="btn btn-primary"
            onClick={() => void loadList(0)}
            disabled={loading}
            style={{ height: 38 }}
          >
            Filter
          </button>
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {total} suppliers registered
        </span>
      </div>

      {/* Main Table */}
      <div className="panel table-wrap" style={{ background: '#fff', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier Code & Name</th>
              <th>Categories</th>
              <th>Primary Contact</th>
              <th>District / Country</th>
              <th>Terms & Currency</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: '#f1f5f9',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          color: '#334155',
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {row.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          <code>{row.supplier_code}</code>
                          {row.legal_name && row.legal_name !== row.name && ` · ${row.legal_name}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                      {(row.categories || []).map((cat: string) => (
                        <span
                          key={cat}
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 600,
                          }}
                        >
                          {label(cat)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      {row.contact_person || '—'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      {row.phone && <span>{row.phone} </span>}
                      {row.email && <span>· {row.email}</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, color: '#334155' }}>{row.district || '—'}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{row.country || 'Bangladesh'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {row.payment_terms_days != null ? `${row.payment_terms_days} days` : '0 days'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{row.currency_code || 'BDT'}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                        background: row.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                        color: row.status === 'active' ? '#065f46' : '#64748b',
                        border: `1px solid ${row.status === 'active' ? '#a7f3d0' : '#cbd5e1'}`,
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => void openSupplier(row.id)}
                        style={{ height: 30, fontSize: 12 }}
                      >
                        Details
                      </button>
                      <Link
                        className="btn btn-sm"
                        href={`/suppliers/supplier-profile-and-ledger?supplier=${row.id}`}
                        style={{ height: 30, fontSize: 12, color: '#2563eb' }}
                      >
                        Ledger
                      </Link>
                      {canManage && (
                        <button
                          className="btn btn-sm"
                          onClick={() => startEdit(row)}
                          style={{ height: 30, fontSize: 12 }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="empty" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  {loading ? 'Loading suppliers...' : 'No suppliers match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="pagination" style={{ marginTop: 12 }}>
        <span>
          {total ? `${offset + 1}–${Math.min(offset + 50, total)} of ${total} suppliers` : '0 results'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            disabled={offset === 0 || loading}
            onClick={() => void loadList(Math.max(0, offset - 50))}
          >
            Previous
          </button>
          <button
            className="btn btn-sm"
            disabled={offset + 50 >= total || loading}
            onClick={() => void loadList(offset + 50)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 780,
              width: '94%',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Enter supplier details, tax registration, and payment terms.
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={saveSupplier} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              <div className="catalog-form-grid">
                <label className="field">
                  Supplier Code
                  <input
                    className="input"
                    required
                    minLength={2}
                    value={form.code}
                    onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </label>

                <label className="field">
                  Display / Trade Name
                  <input
                    className="input"
                    required
                    minLength={2}
                    placeholder="e.g. Partex Paper Mills, Al-Madina Press"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Legal Registered Name
                  <input
                    className="input"
                    required
                    minLength={2}
                    placeholder="e.g. Partex Paper Mills Limited"
                    value={form.legalName}
                    onChange={e => setForm(prev => ({ ...prev, legalName: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Tax Registration (BIN / TIN)
                  <input
                    className="input"
                    placeholder="e.g. 001234567-0101"
                    value={form.taxRegistration}
                    onChange={e => setForm(prev => ({ ...prev, taxRegistration: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Contact Person
                  <input
                    className="input"
                    placeholder="e.g. Md. Rafiqul Islam"
                    value={form.contactPerson}
                    onChange={e => setForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Phone Number
                  <input
                    className="input"
                    placeholder="e.g. +880 1711 000000"
                    value={form.phone}
                    onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Email Address
                  <input
                    className="input"
                    type="email"
                    placeholder="e.g. sales@partexpaper.com"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </label>

                <label className="field">
                  District / City
                  <input
                    className="input"
                    placeholder="e.g. Dhaka, Narayanganj, Chattogram"
                    value={form.district}
                    onChange={e => setForm(prev => ({ ...prev, district: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Credit Terms (Days)
                  <input
                    className="input"
                    type="number"
                    min="0"
                    required
                    value={form.paymentTermsDays}
                    onChange={e => setForm(prev => ({ ...prev, paymentTermsDays: Number(e.target.value) }))}
                  />
                </label>

                <label className="field">
                  Lead Time (Days)
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.leadTimeDays ?? ''}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        leadTimeDays: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className="field">
                  Billing Currency
                  <input
                    className="input"
                    required
                    maxLength={3}
                    value={form.currencyCode}
                    onChange={e => setForm(prev => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))}
                  />
                </label>

                <label className="field">
                  Country
                  <input
                    className="input"
                    required
                    value={form.country}
                    onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                Billing & Factory Address
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Street address, industrial area, post code..."
                  value={form.billingAddress}
                  onChange={e => setForm(prev => ({ ...prev, billingAddress: e.target.value }))}
                />
              </label>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>
                  Supplier Categories (Select all that apply)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => {
                    const selected = form.categories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() =>
                          setForm(prev => ({
                            ...prev,
                            categories: selected
                              ? prev.categories.filter(c => c !== cat)
                              : [...prev.categories, cat],
                          }))
                        }
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: selected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          background: selected ? '#eff6ff' : '#fff',
                          color: selected ? '#1d4ed8' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {selected ? '✓ ' : '+ '}
                        {label(cat)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={busy}
                  style={{ height: 40, padding: '0 18px', borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                  style={{ height: 40, padding: '0 20px', borderRadius: 8, gap: 6 }}
                >
                  <Plus size={16} />
                  <span>{busy ? 'Saving…' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Profile Detail Drawer / Modal */}
      {viewingSupplier && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 740,
              width: '94%',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{viewingSupplier.name}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Code: <code>{viewingSupplier.supplier_code}</code> · Status: <strong style={{ textTransform: 'uppercase' }}>{viewingSupplier.status}</strong>
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setViewingSupplier(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>

            {/* Quick Summary Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                background: '#f8fafc',
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Tax Reg (BIN)</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{viewingSupplier.tax_registration || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Payment Terms</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {viewingSupplier.payment_terms_days ?? 0} days ({viewingSupplier.currency_code || 'BDT'})
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Location</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {viewingSupplier.district || viewingSupplier.country || 'Dhaka'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Categories</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {(viewingSupplier.categories || []).map(label).join(', ') || 'General'}
                </div>
              </div>
            </div>

            {/* Contacts Table */}
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#1e293b' }}>
              Registered Contact Persons
            </h4>
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSupplier.contacts || []).length ? (
                    viewingSupplier.contacts.map((c: Row) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.contact_name}</td>
                        <td>{c.job_title || '—'}</td>
                        <td>{c.phone || '—'}</td>
                        <td>{c.email || '—'}</td>
                        <td>{c.is_primary ? 'Yes' : 'No'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '14px' }}>
                        No separate contact persons listed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Contact Inline Form */}
            {canManage && (
              <form
                onSubmit={handleAddContact}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#475569' }}>
                  + Add New Contact
                </div>
                <div className="catalog-form-grid" style={{ alignItems: 'end' }}>
                  <label className="field" style={{ margin: 0 }}>
                    Name
                    <input
                      className="input"
                      required
                      placeholder="Contact name"
                      value={contactForm.name}
                      onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      style={{ height: 34 }}
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    Phone
                    <input
                      className="input"
                      placeholder="Phone"
                      value={contactForm.phone}
                      onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                      style={{ height: 34 }}
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    Email
                    <input
                      className="input"
                      type="email"
                      placeholder="Email"
                      value={contactForm.email}
                      onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      style={{ height: 34 }}
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    Title
                    <input
                      className="input"
                      placeholder="Job title"
                      value={contactForm.jobTitle}
                      onChange={e => setContactForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                      style={{ height: 34 }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={contactForm.isPrimary}
                      onChange={e => setContactForm(prev => ({ ...prev, isPrimary: e.target.checked }))}
                    />
                    Mark as Primary Contact
                  </label>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={busy || !contactForm.name || (!contactForm.phone && !contactForm.email)}
                    style={{ height: 32 }}
                  >
                    Add Contact
                  </button>
                </div>
              </form>
            )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setViewingSupplier(null)}
                style={{ height: 38, padding: '0 18px', borderRadius: 8 }}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                {canManage && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void toggleStatus(viewingSupplier)}
                    disabled={busy}
                    style={{ height: 38, borderRadius: 8 }}
                  >
                    {viewingSupplier.status === 'active' ? 'Deactivate Supplier' : 'Activate Supplier'}
                  </button>
                )}
                <Link
                  className="btn btn-primary"
                  href={`/suppliers/supplier-profile-and-ledger?supplier=${viewingSupplier.id}`}
                  style={{ height: 38, borderRadius: 8 }}
                >
                  Open Full AP Ledger
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
