"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserCheck,
  BookOpen,
  FileText,
  DollarSign,
  Plus,
  Download,
  RefreshCw,
  Search,
  ArrowLeft,
  Archive,
  Edit3,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
const roles = [
  'author',
  'co_author',
  'translator',
  'editor',
  'illustrator',
  'compiler',
  'photographer',
  'foreword_writer',
  'academic_contributor',
  'other',
];

const date = (value: unknown) => (value ? String(value).slice(0, 10) : '—');
const authorRoute = '/authors-contracts-rights/author-profile';

function renderStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9',
    color = '#475569',
    border = '#cbd5e1';
  if (s === 'active' || s === 'approved' || s === 'published') {
    bg = '#ecfdf5';
    color = '#065f46';
    border = '#a7f3d0';
  } else if (s === 'draft' || s === 'pending') {
    bg = '#f0f9ff';
    color = '#0369a1';
    border = '#bae6fd';
  } else if (s === 'pending_approval') {
    bg = '#fffbeb';
    color = '#92400e';
    border = '#fde68a';
  } else if (s === 'archived' || s === 'suspended' || s === 'inactive' || s === 'terminated') {
    bg = '#fef2f2';
    color = '#991b1b';
    border = '#fecaca';
  }
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: '999px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: bg,
        color: color,
        border: `1px solid ${border}`,
      }}
    >
      {s.replaceAll('_', ' ')}
    </span>
  );
}

export function RightsAuthorsScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const profilePage = screen.title === 'Author Profile';
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [form, setForm] = useState<Record<string, string>>({ status: 'active' });
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['author']);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = role === 'Owner' || permissions.includes('rights.manage');
  const canSeeContact = role === 'Owner' || permissions.includes('rights.sensitive');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (roleFilter) params.set('role', roleFilter);
      const [listing, me] = await Promise.all([
        api<{ data: { data: Row[]; meta: { total: number } } }>(`/rights/authors?${params}`),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setRows(listing.data.data);
      setTotal(listing.data.meta.total);
      setRole(me.data.role);
      setPermissions(me.data.permissions);
      const wanted = new URLSearchParams(window.location.search).get('author');
      if (profilePage) setSelectedId(current => wanted || current || listing.data.data[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load authors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, page, query, status, roleFilter]);

  useEffect(() => {
    if (!profilePage || !selectedId) {
      setDetail(null);
      return;
    }
    void api<{ data: Row }>(`/rights/authors/${selectedId}`)
      .then(result => setDetail(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load author profile'));
  }, [profilePage, selectedId]);

  const value = (key: string) => form[key] || '';
  const change = (key: string, next: string) => setForm(current => ({ ...current, [key]: next }));

  function startCreate() {
    setForm({ status: 'active' });
    setSelectedRoles(['author']);
    setFormOpen(true);
    setNotice('');
  }

  function startEdit(author: Row) {
    setSelectedId(author.id);
    setForm({
      authorCode: author.author_code || '',
      name: author.name || '',
      email: author.email || '',
      phone: author.phone || '',
      penName: author.pen_name || '',
      biography: author.biography || '',
      status: author.status || 'active',
    });
    setSelectedRoles(author.roles?.length ? author.roles : ['author']);
    setFormOpen(true);
    setNotice('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRoles.length) {
      setError('Select at least one contributor role');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const editing = profilePage && detail && formOpen;
      const body = {
        authorCode: value('authorCode').trim(),
        name: value('name').trim(),
        email: value('email').trim() || null,
        phone: value('phone').trim() || null,
        penName: value('penName').trim() || null,
        biography: value('biography').trim() || null,
        roles: selectedRoles,
        status: value('status'),
        ...(editing ? { versionNo: detail.version_no || 1 } : {}),
      };
      const path = editing ? `/rights/authors/${detail.id}` : '/rights/authors';
      const result = await api<{ data: Row }>(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setNotice(
        result.data.duplicateNameWarning
          ? 'Author saved. A matching name already exists; review for a possible duplicate.'
          : editing
          ? 'Author profile updated'
          : 'Author created'
      );
      setFormOpen(false);
      setSelectedId(result.data.id);
      setDetail(result.data);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save author');
    } finally {
      setBusy(false);
    }
  }

  async function exportAuthors() {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (roleFilter) params.set('role', roleFilter);
      const file = await apiFile(`/rights/authors/export.csv?${params}`);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'authors.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export authors');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(author: Row) {
    if (!window.confirm(`Are you sure you want to archive author "${author.name}"?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: Row }>(`/rights/authors/${author.id}`);
      const a = res.data;
      const body = {
        authorCode: a.author_code || 'Unassigned',
        name: a.name,
        email: a.email || null,
        phone: a.phone || null,
        penName: a.pen_name || null,
        biography: a.biography || null,
        roles: a.roles?.length ? a.roles : ['author'],
        status: 'archived',
        versionNo: a.version_no || 1,
      };
      await api(`/rights/authors/${author.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setNotice(`Author "${a.name}" has been archived successfully.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not archive author');
    } finally {
      setBusy(false);
    }
  }

  const archiveFilteredRows = rows.filter(a => {
    if (!archiveSearch.trim()) return true;
    const term = archiveSearch.toLowerCase();
    return (
      (a.name && a.name.toLowerCase().includes(term)) ||
      (a.author_code && a.author_code.toLowerCase().includes(term))
    );
  });

  const archiveModal = archiveModalOpen && (
    <div
      className="modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) setArchiveModalOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive size={20} color="#b91c1c" /> Archive Author Records
          </h2>
          <button className="btn icon-btn" onClick={() => setArchiveModalOpen(false)}>
            ✕
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
          Archived authors remain in the system for historic contracts, royalty reporting, and publication audit logs, but cannot be selected for new agreements.
        </p>
        <div style={{ marginBottom: 16 }}>
          <input
            className="input"
            type="search"
            placeholder="🔍 Search author code or name…"
            value={archiveSearch}
            onChange={e => setArchiveSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap" style={{ flex: 1, maxHeight: '45vh', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Author Name</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {archiveFilteredRows.length ? (
                archiveFilteredRows.map(author => (
                  <tr key={author.id}>
                    <td>
                      <code>{author.author_code || 'Unassigned'}</code>
                    </td>
                    <td>
                      <strong>{author.name}</strong>
                    </td>
                    <td>{renderStatusPill(author.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {author.status === 'archived' ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          Already archived
                        </span>
                      ) : (
                        <button
                          className="btn btn-sm"
                          style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                          disabled={busy}
                          onClick={() => void handleArchive(author)}
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty">
                    No authors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={() => setArchiveModalOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const field = (key: string, label: string, type = 'text', required = false) => (
    <label className="field" key={key}>
      {label}
      <input
        className="input"
        type={type}
        required={required}
        maxLength={key === 'authorCode' ? 80 : 255}
        value={value(key)}
        onChange={event => change(key, event.target.value)}
      />
    </label>
  );

  const formPanel = formOpen && canManage && (
    <div
      className="modal-backdrop"
      onClick={event => {
        if (event.target === event.currentTarget) setFormOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <section
        className="panel modal"
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: 24,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={profilePage && detail ? 'Edit author profile' : 'Create author'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} color="#4f46e5" />
            {profilePage && detail ? 'Edit Author Profile' : 'Create New Author / Contributor'}
          </h2>
          <button className="btn icon-btn" type="button" aria-label="Close" onClick={() => setFormOpen(false)}>
            ✕
          </button>
        </div>
        <form onSubmit={event => void save(event)}>
          <div className="catalog-form-grid">
            {field('authorCode', 'Author code', 'text', true)}
            {field('name', 'Full name', 'text', true)}
            {field('penName', 'Pen name / Pseudonym')}
            <label className="field">
              Profile status
              <select className="input" value={value('status')} onChange={event => change('status', event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            {field('email', 'Email (confidential)', 'email')}
            {field('phone', 'Phone (confidential)', 'tel')}
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            Biography &amp; literary background
            <textarea
              className="input"
              rows={4}
              maxLength={10000}
              value={value('biography')}
              onChange={event => change('biography', event.target.value)}
            />
          </label>
          <fieldset className="panel" style={{ marginTop: 16, padding: 16, borderRadius: 8 }}>
            <legend style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>Contributor Roles</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
              {roles.map(item => (
                <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(item)}
                    onChange={event =>
                      setSelectedRoles(current =>
                        event.target.checked ? [...current, item] : current.filter(r => r !== item)
                      )
                    }
                  />{' '}
                  <span style={{ textTransform: 'capitalize' }}>{item.replaceAll('_', ' ')}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button className="btn" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save Author Profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  // Overall KPI counts
  const totalCount = total;
  const activeCount = rows.filter(r => r.status === 'active').length;
  const withContractsCount = rows.filter(r => (Number(r.active_contract_count) || 0) > 0).length;
  const archivedCount = rows.filter(r => r.status === 'archived').length;

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          {profilePage && detail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              <Link
                href="/authors-contracts-rights/author-directory"
                style={{
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} /> Back to Author Directory
              </Link>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>{detail.name}</span>
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✍️</span> {profilePage && detail ? `Author Profile · ${detail.name}` : screen.title}
          </h1>
          <p className="muted">
            {profilePage
              ? 'Comprehensive author ledger: biographical metadata, active agreements, catalog books, and royalty balances.'
              : 'Directory of primary authors, translators, illustrators, academic contributors, and legal rights holders.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!profilePage && (
            <>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startCreate}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} />
                  <span>New Author</span>
                </button>
              )}
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void exportAuthors()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} />
                <span>Export CSV</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
          Loading authors…
        </div>
      ) : profilePage ? (
        <>
          {/* Author Switcher Dropdown */}
          <div className="panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontWeight: 600, fontSize: 13, color: '#334155' }}>
              <span>Switch Author Profile:</span>
              <select
                className="input"
                value={selectedId}
                onChange={event => {
                  setSelectedId(event.target.value);
                  setFormOpen(false);
                  router.replace(`${authorRoute}?author=${event.target.value}`);
                }}
                style={{ maxWidth: 360, fontSize: 13 }}
              >
                <option value="">Select an author…</option>
                {rows.map(author => (
                  <option key={author.id} value={author.id}>
                    {author.name} ({author.author_code || 'Unassigned'})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {detail ? (
            <>
              {/* Financial & Operational KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                  marginBottom: '20px',
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #4f46e5',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
                    📚 Published Titles
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {detail.books?.length || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Assigned catalog books
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #10b981',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                    📜 Active Contracts
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
                    {detail.contracts?.filter((c: Row) => ['active', 'approved'].includes(c.status)).length || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    of {detail.contracts?.length || 0} total agreements
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #8b5cf6',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase' }}>
                    💰 Advances Disbursed
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#5b21b6', marginTop: '4px' }}>
                    BDT {Number(detail.financialSummary?.totalAdvancesPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Total advance royalties paid
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: Number(detail.financialSummary?.totalUnrecoupedAdvance || 0) > 0 ? '4px solid #f59e0b' : '4px solid #10b981',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: Number(detail.financialSummary?.totalUnrecoupedAdvance || 0) > 0 ? '#d97706' : '#059669', textTransform: 'uppercase' }}>
                    ⏳ Unrecouped Advance
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: Number(detail.financialSummary?.totalUnrecoupedAdvance || 0) > 0 ? '#92400e' : '#065f46', marginTop: '4px' }}>
                    BDT {Number(detail.financialSummary?.totalUnrecoupedAdvance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Remaining recovery balance
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {canManage && (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => startEdit(detail)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit3 size={15} />
                      <span>Edit Author Profile</span>
                    </button>
                    <Link
                      className="btn"
                      href={`/authors-contracts-rights/create-edit-contract?author=${detail.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={15} />
                      <span>Draft Contract for Author</span>
                    </Link>
                    <Link
                      className="btn"
                      href={`/authors-contracts-rights/advance-payment-register?author=${detail.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <DollarSign size={15} />
                      <span>Request Advance Royalty</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Bio & Assigned Books Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {/* Author Info Card */}
                <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>{detail.name}</h2>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <code>{detail.author_code || 'Code pending'}</code>
                        {detail.pen_name && (
                          <span style={{ fontSize: 13, color: '#64748b' }}>
                            · Pen name: <strong>{detail.pen_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    {renderStatusPill(detail.status)}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                      Roles &amp; Classification
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {detail.roles?.length ? (
                        detail.roles.map((r: string) => (
                          <span
                            key={r}
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              textTransform: 'capitalize',
                            }}
                          >
                            {r.replaceAll('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="muted" style={{ fontSize: 13 }}>
                          Not classified
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                      Biography
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', margin: 0 }}>
                      {detail.biography || 'No biography recorded for this author.'}
                    </p>
                  </div>

                  {canSeeContact && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '12px 16px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#475569',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>
                        🔒 Confidential Contact Details
                      </strong>
                      <div>
                        Email: <strong>{detail.email || 'None on file'}</strong> · Phone: <strong>{detail.phone || 'None on file'}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned Titles Card */}
                <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BookOpen size={18} color="#0284c7" /> Assigned Works ({detail.books?.length || 0})
                    </h2>
                  </div>
                  {detail.books?.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Book Title</th>
                            <th>Role</th>
                            <th>Editions</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.books.map((book: Row) => (
                            <tr key={`${book.id}-${book.contributor_role}`}>
                              <td>
                                <Link
                                  href={`/publishing-catalog/book-detail-and-timeline?book=${book.id}`}
                                  style={{ color: '#0284c7', fontWeight: 600 }}
                                >
                                  {book.title}
                                </Link>
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>{book.contributor_role?.replaceAll('_', ' ')}</td>
                              <td>{book.edition_count}</td>
                              <td>{renderStatusPill(book.publication_status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      No books currently assigned to this author in the catalog.
                    </p>
                  )}
                </div>
              </div>

              {/* Author Contracts Section */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={18} color="#4f46e5" /> Author Agreements &amp; Contracts ({detail.contracts?.length || 0})
                    </h2>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Formal publishing contracts and rights assignments registered under this author
                    </p>
                  </div>
                  {canManage && (
                    <Link
                      className="btn btn-sm btn-primary"
                      href={`/authors-contracts-rights/create-edit-contract?author=${detail.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} />
                      <span>New Agreement</span>
                    </Link>
                  )}
                </div>
                {detail.contracts?.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Contract Number</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.contracts.map((contract: Row) => (
                          <tr key={contract.id}>
                            <td>
                              <strong>{contract.contract_number}</strong>
                            </td>
                            <td>{date(contract.start_date)}</td>
                            <td>{date(contract.end_date)}</td>
                            <td>{renderStatusPill(contract.status)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <Link
                                className="btn btn-sm"
                                href={`/authors-contracts-rights/contract-detail-and-amendments?contract=${contract.id}`}
                              >
                                View Contract
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No contracts recorded for this author.
                  </p>
                )}
              </div>

              {/* Advance Royalties Section */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DollarSign size={18} color="#059669" /> Advance Royalties Ledger ({detail.advances?.length || 0})
                    </h2>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Upfront advances disbursed, recouped against sales, and remaining balances
                    </p>
                  </div>
                  {canManage && (
                    <Link
                      className="btn btn-sm"
                      href={`/authors-contracts-rights/advance-payment-register?author=${detail.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} />
                      <span>Request Advance</span>
                    </Link>
                  )}
                </div>
                {detail.advances?.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Requested</th>
                          <th style={{ textAlign: 'right' }}>Paid</th>
                          <th style={{ textAlign: 'right' }}>Recouped</th>
                          <th style={{ textAlign: 'right' }}>Unrecouped Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.advances.map((adv: Row) => (
                          <tr key={adv.id}>
                            <td>
                              <strong>{adv.advance_ref}</strong>
                            </td>
                            <td>{date(adv.requested_date)}</td>
                            <td style={{ textAlign: 'right' }}>
                              {adv.currency_code} {Number(adv.requested_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {adv.currency_code} {Number(adv.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {adv.currency_code} {Number(adv.recouped_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 600,
                                color: adv.unrecouped_balance > 0 ? '#b45309' : '#166534',
                              }}
                            >
                              {adv.currency_code} {Number(adv.unrecouped_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td>{renderStatusPill(adv.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No advance royalties requested or paid for this author.
                  </p>
                )}
              </div>

              {/* Royalty Statements History */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={18} color="#2563eb" /> Royalty Settlement Statements ({detail.statements?.length || 0})
                    </h2>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Itemized statements, deductions, advance recoupment, and net author payables
                    </p>
                  </div>
                  {canManage && (
                    <Link
                      className="btn btn-sm"
                      href={`/authors-contracts-rights/royalty-statement-and-payment-history?author=${detail.id}`}
                    >
                      <span>Open Statements Register</span>
                    </Link>
                  )}
                </div>
                {detail.statements?.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Statement Ref</th>
                          <th>Period</th>
                          <th style={{ textAlign: 'right' }}>Sales Royalty</th>
                          <th style={{ textAlign: 'right' }}>Returns</th>
                          <th style={{ textAlign: 'right' }}>Advance Recouped</th>
                          <th style={{ textAlign: 'right' }}>Net Payable</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.statements.map((stmt: Row) => (
                          <tr key={stmt.id}>
                            <td>
                              <strong>{stmt.statement_ref}</strong>
                            </td>
                            <td>
                              {date(stmt.period_from)} to {date(stmt.period_to)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {stmt.currency_code} {Number(stmt.gross_royalty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {stmt.currency_code} {Number(stmt.return_adjustment).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {stmt.currency_code} {Number(stmt.recouped_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>
                              {stmt.currency_code} {Number(stmt.net_payable).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td>{renderStatusPill(stmt.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No royalty statements generated yet for this author.
                  </p>
                )}
              </div>

              {/* Audit Trail */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#475569' }}>
                  Author Profile Audit Trail
                </h2>
                {detail.activity?.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                    {detail.activity.map((item: Row, index: number) => (
                      <div
                        key={`${item.occurred_at}-${index}`}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '10px 14px',
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>{item.action}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{date(item.occurred_at)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No profile activity recorded.
                  </p>
                )}
              </div>

              {formPanel}
            </>
          ) : (
            <div className="panel empty">Select an author from the dropdown above.</div>
          )}
        </>
      ) : (
        /* Author Directory View */
        <>
          {/* Top KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            <div
              className="panel"
              onClick={() => {
                setStatus('');
                setPage(0);
              }}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                borderLeft: status === '' ? '4px solid #4f46e5' : '4px solid transparent',
                background: status === '' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
                👥 Total Authors
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Registered in publication directory
              </div>
            </div>

            <div
              className="panel"
              onClick={() => {
                setStatus('active');
                setPage(0);
              }}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                borderLeft: status === 'active' ? '4px solid #10b981' : '4px solid transparent',
                background: status === 'active' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                ✅ Active Contributors
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
                {activeCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Eligible for contract agreements
              </div>
            </div>

            <div
              className="panel"
              style={{
                padding: '16px 20px',
                borderLeft: '4px solid #0ea5e9',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                📜 Under Active Contract
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
                {withContractsCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Authors with active agreements
              </div>
            </div>

            <div
              className="panel"
              onClick={() => {
                setStatus('archived');
                setPage(0);
              }}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                borderLeft: status === 'archived' ? '4px solid #b91c1c' : '4px solid transparent',
                background: status === 'archived' ? 'var(--panel-active-bg, #fef2f2)' : undefined,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' }}>
                📁 Archived Records
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
                {archivedCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Retained for historical audit
              </div>
            </div>
          </div>

          {/* Filters & Action Bar */}
          <div className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
                <div style={{ display: 'flex', gap: '6px', minWidth: '260px' }}>
                  <input
                    className="input"
                    value={queryInput}
                    onChange={event => setQueryInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        setPage(0);
                        setQuery(queryInput.trim());
                      }
                    }}
                    placeholder="🔍 Search author code, name or pen name..."
                    style={{ fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPage(0);
                      setQuery(queryInput.trim());
                    }}
                  >
                    Search
                  </button>
                </div>

                <select
                  className="input"
                  value={status}
                  onChange={event => {
                    setPage(0);
                    setStatus(event.target.value);
                  }}
                  style={{ fontSize: '13px', width: 'auto' }}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  className="input"
                  value={roleFilter}
                  onChange={event => {
                    setPage(0);
                    setRoleFilter(event.target.value);
                  }}
                  style={{ fontSize: '13px', width: 'auto' }}
                >
                  <option value="">All Contributor Roles</option>
                  {roles.map(item => (
                    <option key={item} value={item}>
                      {item.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>

                {canManage && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setArchiveSearch('');
                      setArchiveModalOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Archive size={14} />
                    <span>Archive Tool</span>
                  </button>
                )}
              </div>

              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong> authors
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Author / Pen Name</th>
                  <th>Classification</th>
                  <th style={{ textAlign: 'center' }}>Catalog Books</th>
                  <th style={{ textAlign: 'center' }}>Active Contracts</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(author => (
                    <tr key={author.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{author.name}</strong>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <code>{author.author_code || 'Unassigned'}</code>
                            {author.pen_name && (
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                ({author.pen_name})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {author.roles?.slice(0, 2).map((item: string) => (
                            <span
                              key={item}
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                textTransform: 'capitalize',
                              }}
                            >
                              {item.replaceAll('_', ' ')}
                            </span>
                          ))}
                          {(author.roles?.length || 0) > 2 && (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              +{author.roles.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{author.book_count || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{author.active_contract_count || 0}</td>
                      <td>{renderStatusPill(author.status)}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{date(author.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          className="btn btn-sm"
                          href={`${authorRoute}?author=${author.id}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>Profile</span>
                          <ExternalLink size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="empty">
                      No authors match these search filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} authors · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
            </span>
            <div className="button-row">
              <button className="btn" disabled={page === 0} onClick={() => setPage(value => value - 1)}>
                Previous
              </button>
              <button
                className="btn"
                disabled={(page + 1) * 25 >= total}
                onClick={() => setPage(value => value + 1)}
              >
                Next
              </button>
            </div>
          </div>

          {formPanel}
          {archiveModal}
        </>
      )}
    </>
  );
}
