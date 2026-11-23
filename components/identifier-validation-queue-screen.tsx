"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Identifier = {
  id: string;
  book_id: string;
  book_title: string;
  book_code?: string | null;
  publisher_name?: string | null;
  edition_id: string;
  edition_code: string | null;
  edition_number: string;
  format: string;
  identifier_type: string;
  identifier_value: string;
  source: string | null;
  issue_date: string | null;
  status: 'pending' | 'validated' | 'rejected';
  created_at?: string;
};

type ValidationEvent = {
  id: string;
  previous_status: string;
  new_status: string;
  comment: string;
  reviewer_email?: string | null;
  occurred_at: string;
};

const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : '—');

// ISBN-13 Checksum Validation Helper
function isValidIsbn13(isbnStr: string): boolean {
  const clean = isbnStr.replace(/[^0-9]/g, '');
  if (clean.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(clean[12], 10);
}

export function IdentifierValidationQueueScreen({ screen }: { screen: Screen }) {
  const router = useRouter();

  // Queue state
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filtering state
  const [statusFilter, setStatusFilter] = useState<'pending' | 'validated' | 'rejected' | ''>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);

  // Selected item & review state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ValidationEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [decision, setDecision] = useState<'validated' | 'rejected'>('validated');
  const [comment, setComment] = useState('');
  const [copied, setCopied] = useState(false);

  // User permissions
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  const canApprove = role === 'Owner' || permissions.includes('workspace.approve');
  const canExport = role === 'Owner' || permissions.includes('exports.create');

  // Stats across the queue
  const [stats, setStats] = useState({ pending: 0, validated: 0, rejected: 0, total: 0 });

  async function loadStats() {
    try {
      const [pendingRes, validatedRes, rejectedRes] = await Promise.all([
        api<{ meta: { total: number } }>('/identifiers?status=pending&limit=1'),
        api<{ meta: { total: number } }>('/identifiers?status=validated&limit=1'),
        api<{ meta: { total: number } }>('/identifiers?status=rejected&limit=1'),
      ]);
      const p = pendingRes.meta.total || 0;
      const v = validatedRes.meta.total || 0;
      const r = rejectedRes.meta.total || 0;
      setStats({ pending: p, validated: v, rejected: r, total: p + v + r });
    } catch {}
  }

  async function loadQueue() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50', offset: String(page * 50) });
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('q', searchQuery);

      const res = await api<{ data: Identifier[]; meta: { total: number } }>(`/identifiers?${params}`);
      setIdentifiers(res.data || []);
      setTotal(res.meta.total || 0);

      // Auto-select first item if none selected or if selected is not in current list
      if (res.data.length > 0) {
        if (!selectedId || !res.data.some(i => i.id === selectedId)) {
          setSelectedId(res.data[0].id);
        }
      } else {
        setSelectedId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load identifier validation queue');
    } finally {
      setLoading(false);
    }
  }

  // Load user info & stats on mount
  useEffect(() => {
    api<{ data: { role: string; permissions: string[] } }>('/auth/me')
      .then(me => {
        setRole(me.data.role);
        setPermissions(me.data.permissions);
      })
      .catch(() => {});
    void loadStats();
  }, []);

  // Reload queue when filters change
  useEffect(() => {
    void loadQueue();
  }, [screen.id, statusFilter, searchQuery, page]);

  // Load history whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    setComment('');
    setDecision('validated');
    api<{ data: ValidationEvent[] }>(`/identifiers/${selectedId}/validations`)
      .then(res => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [selectedId]);

  const selectedItem = identifiers.find(i => i.id === selectedId);

  async function handleRecordDecision() {
    if (!selectedItem || comment.trim().length < 5) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/identifiers/${selectedItem.id}/validations`, {
        method: 'POST',
        body: JSON.stringify({
          status: decision,
          comment: comment.trim(),
        }),
      });
      setNotice(
        decision === 'validated'
          ? `✅ Identifier ${selectedItem.identifier_value} has been internally approved!`
          : `❌ Identifier ${selectedItem.identifier_value} was marked as rejected.`
      );
      setComment('');
      // Refresh stats & queue
      await Promise.all([loadStats(), loadQueue()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to record decision');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCsv() {
    setBusy(true);
    try {
      const blob = await apiFile('/catalog/export.csv?type=identifiers');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'catalog-identifiers-queue.csv';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isIsbn = selectedItem?.identifier_type === 'ISBN';
  const isbnValid = isIsbn && selectedItem ? isValidIsbn13(selectedItem.identifier_value) : null;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">Identifier Validation &amp; Review Queue</h1>
          <p className="muted">
            Editorial compliance workbench to review, verify checksums, and approve ISBN &amp; catalog identifiers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void loadStats();
              void loadQueue();
            }}
          >
            Refresh Queue
          </button>
          <Link className="btn" href="/publishing-catalog/isbn-and-identifier-register">
            Register New ISBN ➔
          </Link>
        </div>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: '14px' }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: '14px' }}>{notice}</div>}

      {/* KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div
          onClick={() => { setStatusFilter('pending'); setPage(0); }}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            background: statusFilter === 'pending' ? '#fef3c7' : '#ffffff',
            border: `2px solid ${statusFilter === 'pending' ? '#f59e0b' : '#e2e8f0'}`,
            borderRadius: '10px',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.04em' }}>
            ⏳ Pending Review
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#92400e', marginTop: '4px' }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
            Awaiting internal decision
          </div>
        </div>

        <div
          onClick={() => { setStatusFilter('validated'); setPage(0); }}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            background: statusFilter === 'validated' ? '#dcfce7' : '#ffffff',
            border: `2px solid ${statusFilter === 'validated' ? '#22c55e' : '#e2e8f0'}`,
            borderRadius: '10px',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.04em' }}>
            ✅ Internally Approved
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
            {stats.validated}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
            Active on editions
          </div>
        </div>

        <div
          onClick={() => { setStatusFilter('rejected'); setPage(0); }}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            background: statusFilter === 'rejected' ? '#fee2e2' : '#ffffff',
            border: `2px solid ${statusFilter === 'rejected' ? '#ef4444' : '#e2e8f0'}`,
            borderRadius: '10px',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#b91c1c', letterSpacing: '0.04em' }}>
            ❌ Rejected / Revoked
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#991b1b', marginTop: '4px' }}>
            {stats.rejected}
          </div>
          <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
            Flagged submissions
          </div>
        </div>

        <div
          onClick={() => { setStatusFilter(''); setPage(0); }}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            background: statusFilter === '' ? '#f1f5f9' : '#ffffff',
            border: `2px solid ${statusFilter === '' ? '#64748b' : '#e2e8f0'}`,
            borderRadius: '10px',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
            📋 Total Tracked
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', marginTop: '4px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            All registered identifiers
          </div>
        </div>
      </div>

      {/* Search & Export Toolbar */}
      <div className="catalog-list-controls" style={{ marginBottom: '16px' }}>
        <input
          className="input"
          placeholder="Filter by ISBN, title, or edition code..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setPage(0);
              setSearchQuery(searchInput.trim());
            }
          }}
        />
        <button
          type="button"
          className="btn"
          onClick={() => {
            setPage(0);
            setSearchQuery(searchInput.trim());
          }}
        >
          Search
        </button>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Showing <strong>{identifiers.length}</strong> of <strong>{total}</strong>
          </span>
          {canExport && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() => void handleExportCsv()}
            >
              📥 Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Main Workbench: Split Master-Detail Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.4fr)', gap: '18px', alignItems: 'start' }}>
        {/* Left Column: Submissions Queue Cards */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {loading ? (
            <div className="panel empty">Loading queue items…</div>
          ) : identifiers.length > 0 ? (
            identifiers.map(item => {
              const isSelected = item.id === selectedId;
              const isPending = item.status === 'pending';
              const isValidated = item.status === 'validated';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? '#ffffff' : '#f8fafc',
                    border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    boxShadow: isSelected ? '0 4px 12px -2px rgba(99, 102, 241, 0.15)' : 'none',
                    borderLeft: `5px solid ${isPending ? '#f59e0b' : isValidated ? '#22c55e' : '#ef4444'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-blue" style={{ fontSize: '11px', fontWeight: 800 }}>
                        {item.identifier_type}
                      </span>
                      <code style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        {item.identifier_value}
                      </code>
                    </div>
                    <span
                      className={`badge ${isPending ? 'badge-amber' : isValidated ? 'badge-green' : 'badge-slate'}`}
                      style={{ fontSize: '10px', textTransform: 'uppercase' }}
                    >
                      {isPending ? '⏳ Pending' : isValidated ? '✅ Approved' : '❌ Rejected'}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '3px' }}>
                    {item.book_title}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>Edition: <strong>{item.edition_code || `Ed #${item.edition_number}`}</strong> ({item.format})</span>
                    {item.source && <span>Agency: <strong>{item.source}</strong></span>}
                    {item.issue_date && <span>Issued: <strong>{day(item.issue_date)}</strong></span>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="panel empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: '28px' }}>🎉</span>
              <p style={{ margin: '8px 0 0', fontWeight: 700, color: '#334155' }}>
                Queue is clear!
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                No identifiers match the selected filter ({statusFilter || 'all'}).
              </p>
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Page {page + 1} of {Math.ceil(total / 50)}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={(page + 1) * 50 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Validation & Review Workbench */}
        {selectedItem ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Selected Identifier Hero Card */}
            <section className="panel catalog-form" style={{ margin: 0, borderTop: '3px solid #6366f1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.04em' }}>
                    Identifier Review Inspection
                  </div>
                  <h2 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
                    {selectedItem.identifier_type}: {selectedItem.identifier_value}
                  </h2>
                </div>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleCopy(selectedItem.identifier_value)}
                  style={{ fontWeight: 600 }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Value'}
                </button>
              </div>

              {/* Format & Checksum Verification Callout */}
              {isIsbn && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: isbnValid ? '#f0fdf4' : '#fee2e2',
                    border: `1px solid ${isbnValid ? '#86efac' : '#fca5a5'}`,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{isbnValid ? '✅' : '⚠️'}</span>
                  <div>
                    <strong style={{ fontSize: '13px', color: isbnValid ? '#166534' : '#991b1b' }}>
                      {isbnValid ? 'Valid ISBN-13 Checksum (EAN-13 Modulo 10 Verified)' : 'Checksum Warning: Invalid check digit for standard ISBN-13'}
                    </strong>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: isbnValid ? '#15803d' : '#b91c1c' }}>
                      {isbnValid
                        ? 'The 13-digit mathematical check digit aligns with international ISBN Agency standards.'
                        : 'Review issuing documents carefully before approving.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Linked Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: '#f8fafc',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Book Title:</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.book_title}</div>
                  {selectedItem.book_code && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>({selectedItem.book_code})</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Target Edition:</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    Edition {selectedItem.edition_number} ({selectedItem.format})
                  </div>
                  {selectedItem.edition_code && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Code: {selectedItem.edition_code}</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Issuing Agency:</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.source || 'Not specified'}</div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Official Issue Date:</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{day(selectedItem.issue_date)}</div>
                </div>
              </div>

              {/* Quick Navigation Links */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <Link
                  className="btn btn-sm"
                  href={`/publishing-catalog/book-detail-and-timeline?book=${selectedItem.book_id}`}
                >
                  📖 View Book Details ➔
                </Link>
                <Link
                  className="btn btn-sm"
                  href={`/publishing-catalog/edition-detail?book=${selectedItem.book_id}&edition=${selectedItem.edition_id}`}
                >
                  📦 View Edition ➔
                </Link>
                <Link
                  className="btn btn-sm"
                  href={`/publishing-catalog/price-list-management?book=${selectedItem.book_id}&edition=${selectedItem.edition_id}`}
                >
                  💰 Set Cover Price ➔
                </Link>
              </div>

              {/* Decision Recording Box */}
              {canApprove && selectedItem.status === 'pending' ? (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    border: '1px solid #86efac',
                    borderRadius: '10px',
                    padding: '18px',
                    marginTop: '12px',
                  }}
                >
                  <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 800, color: '#166534' }}>
                    ⚖️ Record Editorial Approval Decision
                  </h3>

                  {/* Decision Option Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div
                      onClick={() => setDecision('validated')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: decision === 'validated' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                        border: `2px solid ${decision === 'validated' ? '#16a34a' : '#cbd5e1'}`,
                        boxShadow: decision === 'validated' ? '0 4px 6px -1px rgba(22, 163, 74, 0.2)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#15803d' }}>
                        ✅ Approve Assignment
                      </div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                        Validates identifier for public listing and invoices.
                      </div>
                    </div>

                    <div
                      onClick={() => setDecision('rejected')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: decision === 'rejected' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                        border: `2px solid ${decision === 'rejected' ? '#dc2626' : '#cbd5e1'}`,
                        boxShadow: decision === 'rejected' ? '0 4px 6px -1px rgba(220, 38, 38, 0.2)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#b91c1c' }}>
                        ❌ Reject Submission
                      </div>
                      <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                        Flags as duplicate or invalid assignment.
                      </div>
                    </div>
                  </div>

                  {/* Review Note / Evidence Input */}
                  <label className="field" style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        Review Note / Supporting Evidence <span style={{ color: '#dc2626' }}>*</span>
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: comment.trim().length < 5 ? '#dc2626' : '#16a34a',
                        }}
                      >
                        {comment.trim().length}/5 min characters
                      </span>
                    </div>
                    <textarea
                      className="input"
                      rows={3}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder={
                        decision === 'validated'
                          ? 'e.g. Verified with National Book Centre registry; approved for 1st Edition paperback.'
                          : 'e.g. Checksum error or conflict with existing title; rejected for re-issuance.'
                      }
                      style={{ background: '#ffffff', fontSize: '13px', marginTop: '4px' }}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || comment.trim().length < 5}
                    onClick={() => void handleRecordDecision()}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      fontWeight: 800,
                      fontSize: '14px',
                      background: decision === 'validated' ? '#16a34a' : '#dc2626',
                      borderColor: decision === 'validated' ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {busy
                      ? 'Recording decision…'
                      : decision === 'validated'
                      ? '✓ Confirm & Approve Identifier'
                      : '✕ Confirm & Reject Identifier'}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: '8px',
                    background: selectedItem.status === 'validated' ? '#f0fdf4' : '#fee2e2',
                    border: `1px solid ${selectedItem.status === 'validated' ? '#86efac' : '#fca5a5'}`,
                    fontSize: '13px',
                    color: selectedItem.status === 'validated' ? '#166534' : '#991b1b',
                    fontWeight: 600,
                  }}
                >
                  {selectedItem.status === 'validated'
                    ? '✅ This identifier is internally approved and active on this edition.'
                    : '❌ This identifier submission was rejected.'}
                </div>
              )}
            </section>

            {/* Decision History Audit Log */}
            <section className="panel catalog-form" style={{ margin: 0 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#334155' }}>
                📜 Audit Trail &amp; Decision History
              </h3>

              {historyLoading ? (
                <p className="muted">Loading verification events…</p>
              ) : history.length > 0 ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {history.map(evt => (
                    <div
                      key={evt.id}
                      style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>
                        <span>
                          {day(evt.occurred_at)} · Reviewed by <strong>{evt.reviewer_email || 'Authorized Editor'}</strong>
                        </span>
                        <span className="badge badge-slate" style={{ fontSize: '10px' }}>
                          {evt.previous_status} ➔ {evt.new_status}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: '#0f172a', fontWeight: 500 }}>
                        "{evt.comment}"
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                  No previous review events recorded for this identifier.
                </p>
              )}
            </section>
          </div>
        ) : (
          <div className="panel empty" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <span style={{ fontSize: '32px' }}>👈</span>
            <h3 style={{ margin: '10px 0 4px', fontSize: '16px', fontWeight: 800, color: '#334155' }}>
              Select an Identifier from the Queue
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Click any item on the left to verify checksums, inspect edition linkages, and record your review decision.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
