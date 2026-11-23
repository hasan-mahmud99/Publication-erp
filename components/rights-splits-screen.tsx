"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calculator,
  Sliders,
  Trash2,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
type Line = { authorId: string; role: string; percentage: number | null; fixedAmount: number | null };
type Plan = {
  splitRef: string;
  contractId: string;
  bookId: string;
  allocationModel: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currencyCode: string;
  lines: Line[];
  notes: string | null;
};

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
const models = ['shared_pool_percentage', 'independent_obligation', 'fixed_amount', 'hybrid'];
const blankLine = (): Line => ({ authorId: '', role: 'author', percentage: 100, fixedAmount: null });
const blank = (): Plan => ({
  splitRef: '',
  contractId: '',
  bookId: '',
  allocationModel: 'shared_pool_percentage',
  effectiveFrom: '',
  effectiveTo: null,
  currencyCode: 'BDT',
  lines: [blankLine()],
  notes: null,
});

const label = (value: string) => String(value || '').replaceAll('_', ' ');
const date = (value: unknown) => (value ? String(value).slice(0, 10) : 'Open ended');

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
  } else if (s === 'pending_approval' || s === 'pending') {
    bg = '#fffbeb';
    color = '#92400e';
    border = '#fde68a';
  } else if (s === 'superseded' || s === 'rejected' || s === 'inactive') {
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

export function RightsSplitsScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [contracts, setContracts] = useState<Row[]>([]);
  const [books, setBooks] = useState<Row[]>([]);
  const [authors, setAuthors] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [form, setForm] = useState<Plan>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [samplePool, setSamplePool] = useState('10000.00');
  const [preview, setPreview] = useState<Row | null>(null);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [decision, setDecision] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = role === 'Owner' || permissions.includes('rights.manage');
  const canApprove = role === 'Owner' || permissions.includes('rights.approve');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      const [list, contractList, choices, me] = await Promise.all([
        api<{ data: { data: Row[]; meta: { total: number } } }>(`/rights/contributor-splits?${params}`),
        api<{ data: { data: Row[] } }>('/rights/contracts?limit=100'),
        api<{ data: { authors: Row[]; books: Row[] } }>('/rights/contract-choices'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setRows(list.data.data);
      setTotal(list.data.meta.total);
      setContracts(contractList.data.data.filter(item => ['approved', 'active'].includes(item.status)));
      setBooks(choices.data.books);
      setAuthors(choices.data.authors);
      setRole(me.data.role);
      setPermissions(me.data.permissions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load contributor splits');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, page, query, status]);

  async function select(id: string) {
    setError('');
    setPreview(null);
    setFormOpen(false);
    try {
      setDetail((await api<{ data: Row }>(`/rights/contributor-splits/${id}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load split plan');
    }
  }

  function change<K extends keyof Plan>(key: K, value: Plan[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setPreview(null);
  }

  function changeLine(index: number, patch: Partial<Line>) {
    setForm(current => ({
      ...current,
      lines: current.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)),
    }));
    setPreview(null);
  }

  function startCreate() {
    setDetail(null);
    setForm({
      ...blank(),
      splitRef: `SPLIT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    setPreview(null);
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function startEdit() {
    if (!detail?.currentVersion) return;
    setForm(detail.currentVersion.terms);
    setPreview(null);
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function chooseContract(id: string) {
    const contract = contracts.find(item => item.id === id);
    setForm(current => ({
      ...current,
      contractId: id,
      bookId: contract?.terms?.rights?.[0]?.bookId || '',
      effectiveFrom: contract?.terms?.startDate || '',
      effectiveTo: contract?.terms?.endDate || null,
      currencyCode: contract?.terms?.currencyCode || 'BDT',
      lines: [{ ...blankLine(), authorId: contract?.author_id || '' }],
    }));
    setPreview(null);
  }

  function chooseModel(model: string) {
    setForm(current => ({
      ...current,
      allocationModel: model,
      lines: current.lines.map(line => ({
        ...line,
        percentage: model === 'fixed_amount' ? null : line.percentage ?? 0,
        fixedAmount: ['fixed_amount', 'hybrid'].includes(model) ? line.fixedAmount ?? 0 : null,
      })),
    }));
    setPreview(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const input = { ...form, effectiveTo: form.effectiveTo || null, notes: form.notes || null };
      const version = detail?.currentVersion;
      let result: { data: Row };
      if (!detail) {
        result = await api('/rights/contributor-splits', { method: 'POST', body: JSON.stringify(input) });
      } else if (version?.status === 'draft') {
        result = await api(`/rights/contributor-splits/${detail.id}/versions/${version.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...input, revisionNo: version.revision_no }),
        });
      } else if (version?.status === 'approved') {
        result = await api(`/rights/contributor-splits/${detail.id}/amendments`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      } else {
        throw new Error('This split plan is awaiting approval.');
      }
      setDetail(result.data);
      setFormOpen(false);
      setNotice('Contributor split draft saved successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save split plan');
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
        `/rights/contributor-splits/${detail.id}/versions/${detail.currentVersion.id}/${kind}`,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }
      );
      setDetail(result.data);
      setDecision('');
      setNotice(
        kind === 'submit'
          ? 'Split plan submitted for independent approval.'
          : kind === 'approve'
          ? 'Split plan approved and active.'
          : 'Split plan returned to draft.'
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete split action');
    } finally {
      setBusy(false);
    }
  }

  async function calculatePreview() {
    setError('');
    setPreview(null);
    setBusy(true);
    try {
      setPreview(
        (await api<{ data: Row }>('/rights/contributor-splits/preview', {
          method: 'POST',
          body: JSON.stringify({ plan: form, samplePool: Number(samplePool) }),
        })).data
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not preview allocation');
    } finally {
      setBusy(false);
    }
  }

  const selectedContract = contracts.find(item => item.id === form.contractId);
  const availableBooks = selectedContract?.terms?.rights?.map((item: Row) => item.bookId) || [];
  const version = detail?.currentVersion;
  const percentTotal = form.lines.reduce((sum, line) => sum + (line.percentage || 0), 0);

  // Overall KPI counts
  const totalCount = total;
  const pendingCount = rows.filter(r => (r.status || '') === 'pending_approval').length;
  const activeCount = rows.filter(r => ['active', 'approved'].includes(r.status || '')).length;
  const draftCount = rows.filter(r => (r.status || '') === 'draft').length;

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          {detail && !formOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ArrowLeft size={14} /> Back to Contributor Splits
              </button>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>{detail.split_ref}</span>
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🤝</span> {detail && !formOpen ? `Split Plan · ${detail.split_ref}` : screen.title}
          </h1>
          <p className="muted">
            Configure collaborative percentage and fixed allocations for co-authors, translators, and illustrators.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startCreate}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>New Split Plan</span>
            </button>
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
            🤝 Total Split Plans
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Registered allocation models
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
            Awaiting editorial sign-off
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
            ✅ Approved Plans
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Active collaborative allocations
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
            📝 Draft Splits
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
            {draftCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Unfinalized split drafts
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
          Loading split plans…
        </div>
      ) : !detail || formOpen ? (
        /* Split Plans List View */
        <>
          {/* Filters Bar */}
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
                    placeholder="🔍 Search split, contract or book..."
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
                  {['draft', 'pending_approval', 'approved', 'superseded'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong> plans
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Split Plan Reference</th>
                  <th>Contract</th>
                  <th>Book Title</th>
                  <th>Allocation Model</th>
                  <th style={{ textAlign: 'center' }}>Contributors</th>
                  <th>Effective Period</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.split_ref}</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Version {item.version_no}</div>
                      </td>
                      <td>
                        <Link
                          href={`/authors-contracts-rights/contract-detail-and-amendments?contract=${item.contract_id}`}
                          style={{ color: '#2563eb', fontWeight: 600 }}
                        >
                          {item.contract_number}
                        </Link>
                      </td>
                      <td>{item.book_title || '—'}</td>
                      <td>
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            textTransform: 'capitalize',
                          }}
                        >
                          {label(item.terms?.allocationModel || '')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.terms?.lines?.length || 0}</td>
                      <td style={{ fontSize: 12 }}>
                        {date(item.terms?.effectiveFrom)} to {date(item.terms?.effectiveTo)}
                      </td>
                      <td>{renderStatusPill(item.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => void select(item.id)}>
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty">
                      No split plans match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} plans · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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
      ) : (
        /* Split Plan Detail View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
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
                    {detail.split_ref}
                  </h2>
                  {renderStatusPill(version?.status || '')}
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                  Contract: <strong>{detail.contract_number}</strong> · Book: <strong>{detail.book_title}</strong> · Version {version?.version_no || 1}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canManage && version?.status === 'draft' && (
                  <>
                    <button className="btn" onClick={startEdit}>
                      Edit Draft
                    </button>
                    <button className="btn btn-primary" disabled={busy} onClick={() => void action('submit')}>
                      Submit for Approval
                    </button>
                  </>
                )}
                {canManage && version?.status === 'approved' && (
                  <button className="btn btn-primary" onClick={startEdit}>
                    Draft Amendment
                  </button>
                )}
              </div>
            </div>

            {/* Approval Decision Box */}
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
                  ✍️ Split Plan Approval Decision
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Decision note or review justification (min 10 characters)..."
                    value={decision}
                    onChange={e => setDecision(e.target.value)}
                    style={{ flex: 1, minWidth: 260 }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('approve')}
                  >
                    Approve Split
                  </button>
                  <button
                    className="btn"
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('return')}
                  >
                    Return Split
                  </button>
                </div>
              </div>
            )}

            {/* 4 Summary Cards */}
            {version && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px',
                  marginBottom: 20,
                }}
              >
                <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Allocation Model
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2, textTransform: 'capitalize' }}>
                    {label(version.terms.allocationModel)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Settlement pool framework
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Contributors
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                    {version.terms.lines?.length || 0} Authors
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Collaborators in pool
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Effective Period
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {date(version.terms.effectiveFrom)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    to {date(version.terms.effectiveTo)}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Pool Currency
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {version.terms.currencyCode || 'BDT'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Disbursement currency
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contributors & Allocations Table */}
          {version && (
            <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
                Contributor Allocation Shares
              </h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contributor Name</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'right' }}>Percentage Share</th>
                      <th style={{ textAlign: 'right' }}>Fixed Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.terms.lines.map((line: Line, index: number) => (
                      <tr key={index}>
                        <td>
                          <strong>{authors.find(item => item.id === line.authorId)?.name || line.authorId}</strong>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{label(line.role)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {line.percentage == null ? '—' : `${line.percentage}%`}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {line.fixedAmount == null ? '—' : `${version.terms.currencyCode} ${line.fixedAmount}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Version History */}
          <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#475569' }}>
              Split Plan Version History
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
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Version {item.version_no}</strong>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Created {date(item.created_at)}</div>
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
        </div>
      )}

      {/* Create / Edit Split Form Modal */}
      {formOpen && canManage && (
        <div
          className="modal-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) setFormOpen(false);
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
          <form
            onSubmit={event => void save(event)}
            className="panel modal"
            style={{
              width: 'min(820px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={22} color="#4f46e5" />
                {!detail
                  ? 'New Contributor Split'
                  : version?.status === 'approved'
                  ? 'Draft Split Amendment'
                  : 'Edit Split Draft'}
              </h2>
              <button className="btn icon-btn" type="button" onClick={() => setFormOpen(false)}>
                ✕
              </button>
            </div>

            <div className="catalog-form-grid">
              <label className="field">
                Split reference
                <input
                  className="input"
                  required
                  disabled={!!detail}
                  value={form.splitRef}
                  onChange={event => change('splitRef', event.target.value)}
                />
              </label>

              <label className="field">
                Approved contract
                <select
                  className="input"
                  required
                  disabled={!!detail}
                  value={form.contractId}
                  onChange={event => chooseContract(event.target.value)}
                >
                  <option value="">Select contract</option>
                  {contracts.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.contract_number} · {item.terms?.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Book
                <select
                  className="input"
                  required
                  disabled={!!detail}
                  value={form.bookId}
                  onChange={event => change('bookId', event.target.value)}
                >
                  <option value="">Select book</option>
                  {books
                    .filter(item => availableBooks.includes(item.id))
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                Allocation model
                <select className="input" value={form.allocationModel} onChange={event => chooseModel(event.target.value)}>
                  {models.map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Effective from
                <input
                  className="input"
                  type="date"
                  required
                  value={form.effectiveFrom}
                  onChange={event => change('effectiveFrom', event.target.value)}
                />
              </label>

              <label className="field">
                Effective to
                <input
                  className="input"
                  type="date"
                  value={form.effectiveTo || ''}
                  onChange={event => change('effectiveTo', event.target.value || null)}
                />
              </label>

              <label className="field">
                Currency
                <input
                  className="input"
                  required
                  maxLength={3}
                  value={form.currencyCode}
                  onChange={event => change('currencyCode', event.target.value.toUpperCase())}
                />
              </label>
            </div>

            {/* Contributors Builder */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Contributors &amp; Shares
                </h3>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    change('lines', [
                      ...form.lines,
                      {
                        authorId: '',
                        role: 'co_author',
                        percentage: form.allocationModel === 'fixed_amount' ? null : 0,
                        fixedAmount: ['fixed_amount', 'hybrid'].includes(form.allocationModel) ? 0 : null,
                      },
                    ])
                  }
                >
                  + Add Contributor
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {form.lines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#334155' }}>Contributor #{index + 1}</strong>
                      {form.lines.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                          onClick={() => change('lines', form.lines.filter((_, at) => at !== index))}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="catalog-form-grid" style={{ margin: 0 }}>
                      <label className="field" style={{ margin: 0 }}>
                        Author / Contributor
                        <select
                          className="input"
                          required
                          value={line.authorId}
                          onChange={event => changeLine(index, { authorId: event.target.value })}
                        >
                          <option value="">Select author</option>
                          {authors.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field" style={{ margin: 0 }}>
                        Role
                        <select
                          className="input"
                          value={line.role}
                          onChange={event => changeLine(index, { role: event.target.value })}
                        >
                          {roles.map(item => (
                            <option key={item} value={item}>
                              {label(item)}
                            </option>
                          ))}
                        </select>
                      </label>

                      {line.percentage != null && (
                        <label className="field" style={{ margin: 0 }}>
                          Percentage (%)
                          <input
                            className="input"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            value={line.percentage}
                            onChange={event => changeLine(index, { percentage: Number(event.target.value) })}
                          />
                        </label>
                      )}

                      {line.fixedAmount != null && (
                        <label className="field" style={{ margin: 0 }}>
                          Fixed Amount ({form.currencyCode})
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            value={line.fixedAmount}
                            onChange={event => changeLine(index, { fixedAmount: Number(event.target.value) })}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: form.allocationModel === 'shared_pool_percentage' && percentTotal !== 100 ? '#b91c1c' : '#059669',
                }}
              >
                Percentage Total: {percentTotal.toFixed(2)}%
                {form.allocationModel === 'shared_pool_percentage'
                  ? ' (Must equal exactly 100% for shared pool)'
                  : ' (Independent obligations)'}
              </div>
            </div>

            {/* Allocation Preview Calculator */}
            {form.allocationModel === 'shared_pool_percentage' && (
              <div
                style={{
                  marginTop: 16,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#334155' }}>
                  Illustrative Pool Allocation Calculator
                </h4>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label className="field" style={{ margin: 0, minWidth: 200 }}>
                    Sample Pool Amount ({form.currencyCode})
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={samplePool}
                      onChange={event => setSamplePool(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void calculatePreview()}
                  >
                    Simulate Allocation
                  </button>
                </div>
                {preview && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#334155', background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Total Simulated: {preview.currencyCode} {preview.allocatedTotal}
                    </div>
                    {preview.lines.map((line: Row) => (
                      <div key={line.authorId} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>{authors.find(author => author.id === line.authorId)?.name || line.authorId}:</span>
                        <strong>{preview.currencyCode} {Number(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="field" style={{ marginTop: 16 }}>
              Notes &amp; editorial agreement comments
              <textarea
                className="input"
                rows={3}
                maxLength={5000}
                value={form.notes || ''}
                onChange={event => change('notes', event.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? 'Saving…' : 'Save Split Draft'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
