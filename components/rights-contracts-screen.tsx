"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  Upload,
  Download,
  Calendar,
  Layers,
  ShieldCheck,
  Edit3,
  DollarSign,
  Settings,
} from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Grant = {
  bookId: string;
  rightType: string;
  permittedUse: string;
  territory: string;
  languageCode: string;
  formatCode: string;
  exclusive: boolean;
  startDate: string;
  endDate: string | null;
};

type Terms = {
  contractNumber: string;
  title: string;
  contractType: string;
  authorId: string;
  publisherId: string;
  startDate: string;
  endDate: string | null;
  currencyCode: string;
  notes: string | null;
  rights: Grant[];
};

type Row = Record<string, any>;
const root = '/authors-contracts-rights';
const typeOptions = [
  'publishing_agreement',
  'author_royalty',
  'translation',
  'illustration',
  'editorial_service',
  'rights_licence',
  'rights_assignment',
  'co_publication',
  'other',
];
const rightOptions = [
  'print',
  'digital',
  'translation',
  'audiobook',
  'reprint',
  'distribution',
  'adaptation',
  'other',
];

const date = (value: unknown) => (value ? String(value).slice(0, 10) : '—');
const label = (value: string) => String(value || '').replaceAll('_', ' ');

const blankGrant = (): Grant => ({
  bookId: '',
  rightType: 'print',
  permittedUse: '',
  territory: 'BD',
  languageCode: 'ALL',
  formatCode: 'print',
  exclusive: true,
  startDate: '',
  endDate: null,
});

const blankTerms = (): Terms => ({
  contractNumber: '',
  title: '',
  contractType: 'publishing_agreement',
  authorId: '',
  publisherId: '',
  startDate: '',
  endDate: null,
  currencyCode: 'BDT',
  notes: null,
  rights: [blankGrant()],
});

function renderStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9',
    color = '#475569',
    border = '#cbd5e1';
  if (s === 'approved' || s === 'active') {
    bg = '#ecfdf5';
    color = '#065f46';
    border = '#a7f3d0';
  } else if (s === 'draft') {
    bg = '#f0f9ff';
    color = '#0369a1';
    border = '#bae6fd';
  } else if (s === 'pending_approval' || s === 'review') {
    bg = '#fffbeb';
    color = '#92400e';
    border = '#fde68a';
  } else if (s === 'terminated' || s === 'suspended' || s === 'rejected' || s === 'expired') {
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
      {label(s)}
    </span>
  );
}

export function RightsContractsScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const mode =
    screen.title === 'Contract List'
      ? 'list'
      : screen.title === 'Create/Edit Contract'
      ? 'form'
      : 'detail';

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [choices, setChoices] = useState<{ authors: Row[]; publishers: Row[]; books: Row[] }>({
    authors: [],
    publishers: [],
    books: [],
  });
  const [terms, setTerms] = useState<Terms>(blankTerms);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decision, setDecision] = useState('');
  const [documentKind, setDocumentKind] = useState('signed');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const canManage = role === 'Owner' || permissions.includes('rights.manage');
  const canApprove = role === 'Owner' || permissions.includes('rights.approve');
  const canDownload = role === 'Owner' || permissions.includes('rights.sensitive');

  async function loadList() {
    const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    const result = await api<{ data: { data: Row[]; meta: { total: number } } }>(`/rights/contracts?${params}`);
    setRows(result.data.data);
    setTotal(result.data.meta.total);
    return result.data.data;
  }

  async function loadDetail(id: string) {
    const result = await api<{ data: Row }>(`/rights/contracts/${id}`);
    setDetail(result.data);
    if (result.data.currentVersion?.terms) setTerms(result.data.currentVersion.terms);
    return result.data;
  }

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setLoading(true);
      setError('');
      try {
        const [listing, me, options] = await Promise.all([
          loadList(),
          api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
          api<{ data: { authors: Row[]; publishers: Row[]; books: Row[] } }>('/rights/contract-choices'),
        ]);
        if (cancelled) return;
        setRole(me.data.role);
        setPermissions(me.data.permissions);
        setChoices(options.data);
        const id =
          new URLSearchParams(window.location.search).get('contract') ||
          (mode === 'detail' ? listing[0]?.id : '') ||
          '';
        setSelectedId(id);
        if (id) {
          await loadDetail(id);
        } else {
          setDetail(null);
          const authorParam = new URLSearchParams(window.location.search).get('author');
          setTerms({ ...blankTerms(), ...(authorParam ? { authorId: authorParam } : {}) });
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load contracts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [screen.id, mode, page, search, status]);

  function change<K extends keyof Terms>(key: K, value: Terms[K]) {
    setTerms(current => ({ ...current, [key]: value }));
  }

  function changeGrant(index: number, patch: Partial<Grant>) {
    setTerms(current => ({
      ...current,
      rights: current.rights.map((grant, at) => (at === index ? { ...grant, ...patch } : grant)),
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const input = {
        ...terms,
        endDate: terms.endDate || null,
        notes: terms.notes || null,
        rights: terms.rights.map(grant => ({
          ...grant,
          endDate: grant.endDate || null,
          territory: grant.territory.toUpperCase(),
          languageCode: grant.languageCode.toUpperCase(),
        })),
      };
      let result: { data: Row };
      const version = detail?.currentVersion;
      if (!detail) {
        result = await api('/rights/contracts', { method: 'POST', body: JSON.stringify(input) });
      } else if (version?.status === 'draft') {
        result = await api(`/rights/contracts/${detail.id}/versions/${version.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...input, revisionNo: version.revision_no }),
        });
      } else if (version?.status === 'approved') {
        result = await api(`/rights/contracts/${detail.id}/amendments`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      } else {
        throw new Error('This contract version is awaiting review and cannot be edited.');
      }
      setDetail(result.data);
      setSelectedId(result.data.id);
      setNotice('Contract draft saved successfully.');
      router.push(`${root}/contract-detail-and-amendments?contract=${result.data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save contract');
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: 'submit' | 'approve' | 'return') {
    if (!detail?.currentVersion) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body =
        kind === 'approve'
          ? { note: decision.trim() }
          : kind === 'return'
          ? { reason: decision.trim() }
          : undefined;
      const result = await api<{ data: Row }>(
        `/rights/contracts/${detail.id}/versions/${detail.currentVersion.id}/${kind}`,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }
      );
      setDetail(result.data);
      setDecision('');
      setNotice(
        kind === 'submit'
          ? 'Submitted for independent approval.'
          : kind === 'approve'
          ? 'Contract approved and legal rights activated.'
          : 'Contract returned to draft.'
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete contract action');
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!detail?.currentVersion || !documentFile) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (documentFile.size > 8 * 1024 * 1024) throw new Error('Document must be 8 MB or smaller.');
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Could not read document'));
        reader.readAsDataURL(documentFile);
      });
      const result = await api<{ data: Row }>(
        `/rights/contracts/${detail.id}/versions/${detail.currentVersion.id}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            kind: documentKind,
            fileName: documentFile.name,
            mimeType: documentFile.type || 'text/plain',
            base64,
          }),
        }
      );
      setDetail(result.data);
      setDocumentFile(null);
      setNotice('Document uploaded successfully to the contract version.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not upload document');
    } finally {
      setBusy(false);
    }
  }

  async function download(document: Row) {
    if (!detail) return;
    setError('');
    try {
      const blob = await apiFile(`/rights/contracts/${detail.id}/documents/${document.id}/file`);
      const href = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = href;
      anchor.download = document.file_name;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download document');
    }
  }

  const version = detail?.currentVersion;
  const editing = mode === 'form' && detail;
  const formAllowed = !detail || version?.status === 'draft' || version?.status === 'approved';

  const field = (key: keyof Terms, title: string, type = 'text', required = false, locked = false) => (
    <label className="field" key={key}>
      {title}
      <input
        className="input"
        type={type}
        required={required}
        disabled={locked}
        value={String(terms[key] ?? '')}
        onChange={event => change(key, event.target.value as never)}
      />
    </label>
  );

  // Overall KPI counts
  const totalCount = total;
  const pendingCount = rows.filter(r => (r.version_status || r.status) === 'pending_approval').length;
  const activeCount = rows.filter(r => ['active', 'approved'].includes(r.version_status || r.status)).length;
  const draftCount = rows.filter(r => (r.version_status || r.status) === 'draft').length;

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          {mode !== 'list' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              <Link
                href={`${root}/contract-list`}
                style={{
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} /> Back to Contract List
              </Link>
              {detail && (
                <>
                  <span style={{ color: '#94a3b8' }}>/</span>
                  <span style={{ color: '#64748b' }}>Contract {detail.contract_number}</span>
                </>
              )}
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📜</span>{' '}
            {mode === 'detail' && detail
              ? `Contract ${detail.contract_number}`
              : mode === 'form'
              ? editing
                ? 'Edit Contract Draft'
                : 'Create Publishing Agreement'
              : screen.title}
          </h1>
          <p className="muted">
            {mode === 'form'
              ? 'Draft commercial publishing terms, multi-format rights scopes, and author assignment.'
              : mode === 'detail'
              ? 'Contract terms, rights grants, linked royalty rules, advance payments, and document repository.'
              : 'Directory of publisher-author agreements, legal rights scopes, and version-controlled amendments.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {mode === 'list' && canManage && (
            <Link
              className="btn btn-primary"
              href={`${root}/create-edit-contract`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Create Contract</span>
            </Link>
          )}
          {mode !== 'list' && (
            <Link className="btn" href={`${root}/contract-list`}>
              Contract List
            </Link>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              setError('');
              void (selectedId ? loadDetail(selectedId) : loadList()).catch(reason => setError(reason.message));
            }}
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
          Loading contracts…
        </div>
      ) : mode === 'list' ? (
        /* Contract List View */
        <>
          {/* KPI Stat Cards */}
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
                📜 Total Contracts
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                All registered agreements
              </div>
            </div>

            <div
              className="panel"
              onClick={() => {
                setStatus('pending_approval');
                setPage(0);
              }}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                borderLeft: status === 'pending_approval' ? '4px solid #f59e0b' : '4px solid transparent',
                background: status === 'pending_approval' ? 'var(--panel-active-bg, #fffbeb)' : undefined,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                ⏳ Pending Review
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
                {pendingCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Awaiting legal / editor sign-off
              </div>
            </div>

            <div
              className="panel"
              onClick={() => {
                setStatus('approved');
                setPage(0);
              }}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                borderLeft: status === 'approved' ? '4px solid #10b981' : '4px solid transparent',
                background: status === 'approved' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                ✅ Active &amp; Approved
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
                {activeCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Legally binding active rights
              </div>
            </div>

            <div
              className="panel"
              onClick={() => {
                setStatus('draft');
                setPage(0);
              }}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                borderLeft: status === 'draft' ? '4px solid #0ea5e9' : '4px solid transparent',
                background: status === 'draft' ? 'var(--panel-active-bg, #f0f9ff)' : undefined,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                📝 Draft Agreements
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
                {draftCount}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                Unfinalized contract proposals
              </div>
            </div>
          </div>

          {/* Filters Toolbar */}
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
                    value={searchInput}
                    onChange={event => setSearchInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        setPage(0);
                        setSearch(searchInput.trim());
                      }
                    }}
                    placeholder="🔍 Search contract number, title or author..."
                    style={{ fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPage(0);
                      setSearch(searchInput.trim());
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
                  {[
                    'draft',
                    'pending_approval',
                    'approved',
                    'active',
                    'suspended',
                    'terminated',
                    'expired',
                  ].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong> contracts
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract / Title</th>
                  <th>Author</th>
                  <th>Contract Term</th>
                  <th style={{ textAlign: 'center' }}>Scopes</th>
                  <th style={{ textAlign: 'center' }}>Version</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(row => {
                    const currentStatus = row.version_status || row.status;
                    return (
                      <tr key={row.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <strong style={{ fontSize: 14, color: '#0f172a' }}>{row.contract_number}</strong>
                            <span style={{ fontSize: 13, color: '#334155' }}>{row.title || 'Untitled Agreement'}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              Type: {label(row.contract_type || 'Publishing Agreement')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <strong style={{ fontSize: 13, color: '#1e293b' }}>{row.author_name}</strong>
                            <Link
                              href={`${root}/author-profile?author=${row.author_id}`}
                              style={{ fontSize: 11, color: '#2563eb' }}
                            >
                              View Author
                            </Link>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <div>{date(row.start_date)}</div>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>to {date(row.end_date)}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {row.rights_count ?? 1}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                          v{row.version_no || 1}
                        </td>
                        <td>{renderStatusPill(currentStatus)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            className="btn btn-sm"
                            href={`${root}/contract-detail-and-amendments?contract=${row.id}`}
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="empty">
                      No contracts match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} contracts · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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
        </>
      ) : mode === 'form' ? (
        /* Create / Edit Form View */
        <>
          {!canManage ? (
            <div className="panel empty">You do not have permission to manage contracts.</div>
          ) : !formAllowed ? (
            <div className="panel empty">
              This version is currently awaiting review. Open the contract detail page to approve or return it.
            </div>
          ) : (
            <form onSubmit={event => void save(event)}>
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
                  {editing
                    ? version?.status === 'approved'
                      ? 'Draft Contract Amendment'
                      : 'Edit Contract Draft'
                    : 'Agreement Terms & Parties'}
                </h2>
                <div className="catalog-form-grid">
                  {field('contractNumber', 'Contract number', 'text', true, !!editing)}
                  {field('title', 'Agreement title', 'text', true)}
                  <label className="field">
                    Contract type
                    <select
                      className="input"
                      value={terms.contractType}
                      onChange={event => change('contractType', event.target.value)}
                    >
                      {typeOptions.map(item => (
                        <option key={item} value={item}>
                          {label(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Author / Contributor
                    <select
                      className="input"
                      required
                      disabled={!!editing}
                      value={terms.authorId}
                      onChange={event => change('authorId', event.target.value)}
                    >
                      <option value="">Select author</option>
                      {choices.authors.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.author_code || 'No code'})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Publishing imprint / entity
                    <select
                      className="input"
                      required
                      value={terms.publisherId}
                      onChange={event => change('publisherId', event.target.value)}
                    >
                      <option value="">Select publisher</option>
                      {choices.publishers.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {field('startDate', 'Effective start date', 'date', true)}
                  {field('endDate', 'Expiry date (optional)', 'date')}
                  {field('currencyCode', 'Settlement currency', 'text', true)}
                </div>

                <label className="field" style={{ marginTop: 12 }}>
                  Contract notes &amp; legal clauses
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={5000}
                    value={terms.notes || ''}
                    onChange={event => change('notes', event.target.value)}
                  />
                </label>
              </div>

              {/* Rights Scopes */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                      Rights Granted &amp; Territory Scopes ({terms.rights.length})
                    </h2>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Define specific publishing, translation, digital and audio rights granted by the author
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setTerms(current => ({ ...current, rights: [...current.rights, blankGrant()] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} />
                    <span>Add Rights Scope</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {terms.rights.map((grant, index) => (
                    <div
                      key={index}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '18px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <strong style={{ fontSize: 14, color: '#334155' }}>Scope #{index + 1}</strong>
                        {terms.rights.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                            onClick={() =>
                              setTerms(current => ({
                                ...current,
                                rights: current.rights.filter((_, at) => at !== index),
                              }))
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="catalog-form-grid">
                        <label className="field">
                          Catalog Book
                          <select
                            className="input"
                            required
                            value={grant.bookId}
                            onChange={event => changeGrant(index, { bookId: event.target.value })}
                          >
                            <option value="">Select book</option>
                            {choices.books.map(book => (
                              <option key={book.id} value={book.id}>
                                {book.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          Right Type
                          <select
                            className="input"
                            value={grant.rightType}
                            onChange={event => changeGrant(index, { rightType: event.target.value })}
                          >
                            {rightOptions.map(item => (
                              <option key={item} value={item}>
                                {label(item)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          Format
                          <select
                            className="input"
                            value={grant.formatCode}
                            onChange={event => changeGrant(index, { formatCode: event.target.value })}
                          >
                            {['print', 'ebook', 'audio', 'ALL'].map(item => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          Language Code (EN, BN or ALL)
                          <input
                            className="input"
                            required
                            maxLength={3}
                            value={grant.languageCode}
                            onChange={event => changeGrant(index, { languageCode: event.target.value.toUpperCase() })}
                          />
                        </label>

                        <label className="field">
                          Territory (BD or ALL)
                          <input
                            className="input"
                            required
                            maxLength={8}
                            value={grant.territory}
                            onChange={event => changeGrant(index, { territory: event.target.value.toUpperCase() })}
                          />
                        </label>

                        <div className="field">
                          <span>Exclusivity Scope</span>
                          <label
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              height: 42,
                              padding: '0 14px',
                              background: grant.exclusive ? '#f0fdf4' : '#fff',
                              border: grant.exclusive ? '1.5px solid #86efac' : '1px solid #d0d7e2',
                              borderRadius: 9,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxSizing: 'border-box',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={grant.exclusive}
                              onChange={event => changeGrant(index, { exclusive: event.target.checked })}
                              style={{
                                width: 17,
                                height: 17,
                                cursor: 'pointer',
                                accentColor: '#16a34a',
                                flexShrink: 0,
                                margin: 0,
                              }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 600, color: grant.exclusive ? '#15803d' : '#334155' }}>
                              Exclusive Right
                            </span>
                            <span style={{ fontSize: 11, color: grant.exclusive ? '#16a34a' : '#94a3b8', marginLeft: 'auto' }}>
                              {grant.exclusive ? '🔒 Sole grant' : 'Shared grant'}
                            </span>
                          </label>
                        </div>

                        <label className="field">
                          Scope Start Date
                          <input
                            className="input"
                            type="date"
                            required
                            value={grant.startDate}
                            onChange={event => changeGrant(index, { startDate: event.target.value })}
                          />
                        </label>

                        <label className="field">
                          Scope End Date
                          <input
                            className="input"
                            type="date"
                            value={grant.endDate || ''}
                            onChange={event => changeGrant(index, { endDate: event.target.value || null })}
                          />
                        </label>
                      </div>

                      <label className="field" style={{ marginTop: 8 }}>
                        Permitted Use Specification
                        <input
                          className="input"
                          required
                          minLength={5}
                          maxLength={500}
                          value={grant.permittedUse || ''}
                          onChange={event => changeGrant(index, { permittedUse: event.target.value })}
                          placeholder="Describe the granted scope e.g., First trade paperback edition distribution in Bangladesh"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 24 }}>
                <Link className="btn" href={`${root}/contract-list`}>
                  Cancel
                </Link>
                <button className="btn btn-primary" disabled={busy} type="submit">
                  {busy
                    ? 'Saving…'
                    : editing && version?.status === 'approved'
                    ? 'Create Amendment Draft'
                    : 'Save Contract Draft'}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        /* Contract Detail View */
        <>
          {/* Contract Switcher */}
          <div className="panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontWeight: 600, fontSize: 13, color: '#334155' }}>
              <span>Switch Contract:</span>
              <select
                className="input"
                style={{ maxWidth: 420, fontSize: 13 }}
                value={selectedId}
                onChange={event => {
                  const id = event.target.value;
                  setSelectedId(id);
                  router.replace(`${root}/contract-detail-and-amendments${id ? `?contract=${id}` : ''}`);
                  void (id ? loadDetail(id) : Promise.resolve(setDetail(null)));
                }}
              >
                <option value="">Select a contract…</option>
                {rows.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.contract_number} · {row.author_name} ({label(row.version_status || row.status)})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!detail ? (
            <div className="panel empty">Select a contract from the dropdown to view its terms.</div>
          ) : (
            <>
              {/* Header Card */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexWrap: 'wrap',
                    paddingBottom: 20,
                    borderBottom: '1px solid var(--line, #e2e8f0)',
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        {version?.terms?.title || detail.contract_number}
                      </h2>
                      {renderStatusPill(version?.status || detail.status)}
                    </div>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                      Official Publishing Agreement · Registered in Organization
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canManage && version?.status === 'draft' && (
                      <>
                        <Link
                          className="btn"
                          href={`${root}/create-edit-contract?contract=${detail.id}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit3 size={14} />
                          <span>Edit Draft</span>
                        </Link>
                        <button
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => void action('submit')}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Submit for Approval</span>
                        </button>
                      </>
                    )}
                    {canManage && version?.status === 'approved' && (
                      <Link
                        className="btn btn-primary"
                        href={`${root}/create-edit-contract?contract=${detail.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={14} />
                        <span>Create Amendment</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Reviewer Action Bar */}
                {canApprove && version?.status === 'pending_approval' && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      padding: '16px',
                      marginBottom: 20,
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 13, textTransform: 'uppercase', color: '#92400e', marginBottom: 8 }}>
                      ⚖️ Editorial &amp; Legal Sign-Off Required
                    </strong>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Decision note or review comments..."
                        value={decision}
                        onChange={e => setDecision(e.target.value)}
                        style={{ flex: 1, minWidth: 240 }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void action('approve')}
                      >
                        Approve Contract
                      </button>
                      <button
                        className="btn"
                        style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                        disabled={busy}
                        onClick={() => void action('return')}
                      >
                        Return to Draft
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Contract Number
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {detail.contract_number}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {label(version?.terms?.contractType || 'Publishing Agreement')}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Author / Contributor
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {detail.author_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#2563eb', marginTop: 2 }}>
                      <Link href={`${root}/author-profile?author=${detail.author_id}`}>View Profile</Link>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Agreement Term
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {date(detail.start_date)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      to {date(detail.end_date)} ({version?.terms?.currencyCode || 'BDT'})
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Version &amp; Revision
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      Version {version?.version_no || 1}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Revision #{version?.revision_no || 1}
                    </div>
                  </div>
                </div>

                {version?.terms?.notes && (
                  <div
                    style={{
                      background: '#f1f5f9',
                      borderLeft: '4px solid #3b82f6',
                      padding: '12px 16px',
                      borderRadius: 6,
                      fontSize: 14,
                      color: '#334155',
                      marginTop: 16,
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#1e3a8a', marginBottom: 4 }}>
                      Contract Notes
                    </strong>
                    {version.terms.notes}
                  </div>
                )}
              </div>

              {/* Rights Granted */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
                  Rights Granted &amp; Territory Register ({version?.terms?.rights?.length || 0})
                </h2>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Book</th>
                        <th>Right</th>
                        <th>Permitted Use</th>
                        <th>Territory</th>
                        <th>Format</th>
                        <th>Exclusivity</th>
                        <th>Term</th>
                      </tr>
                    </thead>
                    <tbody>
                      {version?.terms?.rights?.map((grant: Grant, index: number) => {
                        const book = choices.books.find(b => b.id === grant.bookId);
                        return (
                          <tr key={index}>
                            <td>
                              <strong>{book?.title || grant.bookId}</strong>
                            </td>
                            <td>
                              <span
                                style={{
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  textTransform: 'capitalize',
                                }}
                              >
                                {grant.rightType}
                              </span>
                            </td>
                            <td>{grant.permittedUse || '—'}</td>
                            <td>
                              <code>{grant.territory}</code>
                            </td>
                            <td>
                              <code>{grant.formatCode}</code>
                            </td>
                            <td>{grant.exclusive ? 'Exclusive' : 'Non-exclusive'}</td>
                            <td>
                              {date(grant.startDate)} to {date(grant.endDate)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Royalty Rules Section */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Settings size={18} color="#4f46e5" /> Linked Royalty Policies &amp; Rules ({detail.royaltyRules?.length || 0})
                    </h2>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Governing calculation methods, list price percentages, and tiered slabs for this agreement
                    </p>
                  </div>
                  {canManage && (
                    <Link
                      className="btn btn-sm btn-primary"
                      href={`/authors-contracts-rights/royalty-rules-setup?contract=${detail.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} />
                      <span>Setup Royalty Rule</span>
                    </Link>
                  )}
                </div>
                {detail.royaltyRules?.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rule Ref</th>
                          <th>Calculation Method</th>
                          <th>Rate / Slabs</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.royaltyRules.map((rule: Row) => (
                          <tr key={rule.id}>
                            <td>
                              <strong>{rule.rule_ref || 'Legacy Rule'}</strong> (v{rule.version_no})
                            </td>
                            <td style={{ textTransform: 'capitalize' }}>
                              {label(rule.terms?.method || rule.basis || 'Standard')}
                            </td>
                            <td>
                              {rule.terms?.rate != null
                                ? `${Number(rule.terms.rate) * 100}%`
                                : rule.terms?.tiers?.length
                                ? `${rule.terms.tiers.length} tiered slabs`
                                : 'Fixed fee'}
                            </td>
                            <td>{renderStatusPill(rule.version_status || 'active')}</td>
                            <td style={{ textAlign: 'right' }}>
                              <Link
                                className="btn btn-sm"
                                href={`/authors-contracts-rights/royalty-rules-setup?rule=${rule.id}`}
                              >
                                View Rule
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No royalty policy configured for this contract yet. Click "+ Setup Royalty Rule" above to define rates.
                  </p>
                )}
              </div>

              {/* Linked Advances Section */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DollarSign size={18} color="#059669" /> Linked Author Advances ({detail.advances?.length || 0})
                    </h2>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Advance royalties requested, disbursed, and recouped under this agreement
                    </p>
                  </div>
                  {canManage && (
                    <Link
                      className="btn btn-sm btn-primary"
                      href={`/authors-contracts-rights/advance-payment-register?contract=${detail.id}`}
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
                          <th>Advance Ref</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Requested</th>
                          <th style={{ textAlign: 'right' }}>Paid</th>
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
                    No advance payments recorded under this contract.
                  </p>
                )}
              </div>

              {/* Version History & Signed Legal Documents */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {/* Version History */}
                <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={18} color="#0284c7" /> Version History
                  </h2>
                  {detail.versions?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {detail.versions.map((item: Row) => (
                        <div
                          key={item.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#0f172a', fontSize: 13 }}>Version {item.version_no}</strong>
                            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                              Created {date(item.created_at)}
                            </div>
                            {item.decision_note && (
                              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                Note: {item.decision_note}
                              </div>
                            )}
                          </div>
                          {renderStatusPill(item.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      No versions recorded.
                    </p>
                  )}
                </div>

                {/* Signed & Legal Documents */}
                <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} color="#059669" /> Signed Legal Documents
                  </h2>
                  {detail.documents?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                      {detail.documents.map((item: Row) => (
                        <div
                          key={item.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                background: '#e2e8f0',
                                padding: '1px 6px',
                                borderRadius: 3,
                                fontSize: 10,
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                marginRight: 6,
                              }}
                            >
                              {item.kind}
                            </span>
                            <strong style={{ fontSize: 13, color: '#1e293b' }}>{item.file_name}</strong>
                            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                              ({Math.ceil(item.file_size / 1024)} KB)
                            </span>
                          </div>
                          {canDownload && (
                            <button
                              className="btn btn-sm"
                              onClick={() => void download(item)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Download size={13} />
                              <span>Download</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ marginBottom: 16 }}>
                      No agreement documents uploaded yet.
                    </p>
                  )}

                  {canManage && ['draft', 'pending_approval'].includes(version?.status) && (
                    <div style={{ background: '#fafbfe', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 16 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        Upload Agreement Document (PDF, DOCX, TXT)
                      </h4>
                      <div className="catalog-form-grid" style={{ alignItems: 'end' }}>
                        <label className="field" style={{ margin: 0 }}>
                          Document Type
                          <select
                            className="input"
                            value={documentKind}
                            onChange={event => setDocumentKind(event.target.value)}
                          >
                            {['signed', 'draft', 'rights_evidence', 'amendment'].map(item => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field" style={{ margin: 0 }}>
                          Select File
                          <input
                            className="input"
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={event => setDocumentFile(event.target.files?.[0] || null)}
                          />
                        </label>
                        <button
                          className="btn btn-primary"
                          disabled={busy || !documentFile}
                          onClick={() => void upload()}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Upload size={14} />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Trail */}
              <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#475569' }}>
                  Contract Audit Trail
                </h2>
                {detail.activity?.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                    {detail.activity.map((item: Row, index: number) => (
                      <div
                        key={index}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '10px 14px',
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>{label(item.action)}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{date(item.occurred_at)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No activity recorded.
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
