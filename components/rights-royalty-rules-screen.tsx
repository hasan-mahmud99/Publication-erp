"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Sliders,
  Layers,
  Edit3,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
type Tier = { from: number; to: number | null; rate: number };
type Rule = {
  ruleRef: string;
  contractId: string;
  bookId: string;
  recipientAuthorId: string;
  method: string;
  rate: number | null;
  fixedAmount: number | null;
  tiers: Tier[];
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  salesChannels: string[];
  returnTreatment: string;
  complimentaryTreatment: string;
  consignmentTreatment: string;
  advanceRecoupment: string;
  roundingMethod: string;
  notes: string | null;
};

const methods = [
  'percentage_list_price',
  'percentage_net_receipts',
  'fixed_per_copy',
  'tiered',
  'fixed_fee',
  'hybrid',
];

const blank = (): Rule => ({
  ruleRef: '',
  contractId: '',
  bookId: '',
  recipientAuthorId: '',
  method: 'percentage_list_price',
  rate: 0.1,
  fixedAmount: null,
  tiers: [],
  currencyCode: 'BDT',
  effectiveFrom: '',
  effectiveTo: null,
  salesChannels: ['all'],
  returnTreatment: 'deduct_eligible_returns',
  complimentaryTreatment: 'exclude',
  consignmentTreatment: 'settled_only',
  advanceRecoupment: 'none',
  roundingMethod: 'half_up_2dp',
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

export function RightsRoyaltyRulesScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [contracts, setContracts] = useState<Row[]>([]);
  const [books, setBooks] = useState<Row[]>([]);
  const [authors, setAuthors] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [form, setForm] = useState<Rule>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [channels, setChannels] = useState('all');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [decision, setDecision] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = role === 'Owner' || permissions.includes('rights.manage');
  const canApprove = role === 'Owner' || permissions.includes('rights.approve');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get('contract');
    const r = params.get('rule');
    if (c) {
      setForm(prev => ({
        ...prev,
        ruleRef: prev.ruleRef || `RULE-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        contractId: c,
        effectiveFrom: prev.effectiveFrom || new Date().toISOString().slice(0, 10),
      }));
      setFormOpen(true);
    } else if (r) {
      setSelectedId(r);
      void select(r);
    }
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      const [listing, contractListing, choices, me] = await Promise.all([
        api<{ data: { data: Row[]; meta: { total: number } } }>(`/rights/royalty-rules?${params}`),
        api<{ data: { data: Row[] } }>('/rights/contracts?limit=100'),
        api<{ data: { authors: Row[]; books: Row[] } }>('/rights/contract-choices'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setRows(listing.data.data);
      setTotal(listing.data.meta.total);
      setContracts(contractListing.data.data.filter(row => ['active', 'approved'].includes(row.status)));
      setBooks(choices.data.books);
      setAuthors(choices.data.authors);
      setRole(me.data.role);
      setPermissions(me.data.permissions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load royalty rules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, page, query, status]);

  async function select(id: string) {
    setSelectedId(id);
    setFormOpen(false);
    setError('');
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      setDetail((await api<{ data: Row }>(`/rights/royalty-rules/${id}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load rule');
    }
  }

  function change<K extends keyof Rule>(key: K, value: Rule[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setDetail(null);
    setSelectedId('');
    setForm({
      ...blank(),
      ruleRef: `RULE-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    setChannels('all');
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function startEdit() {
    if (!detail?.currentVersion) return;
    setForm(detail.currentVersion.terms);
    setChannels(detail.currentVersion.terms.salesChannels.join(', '));
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function chooseContract(id: string) {
    const contract = contracts.find(item => item.id === id);
    setForm(current => ({
      ...current,
      contractId: id,
      recipientAuthorId: contract?.author_id || '',
      bookId: contract?.terms?.rights?.[0]?.bookId || '',
      currencyCode: contract?.terms?.currencyCode || 'BDT',
      effectiveFrom: contract?.terms?.startDate || '',
      effectiveTo: contract?.terms?.endDate || null,
    }));
  }

  function chooseMethod(method: string) {
    setForm(current => ({
      ...current,
      method,
      rate: ['percentage_list_price', 'percentage_net_receipts', 'hybrid'].includes(method)
        ? current.rate ?? 0.1
        : null,
      fixedAmount: ['fixed_per_copy', 'fixed_fee', 'hybrid'].includes(method)
        ? current.fixedAmount ?? 0
        : null,
      tiers:
        method === 'tiered'
          ? current.tiers.length
            ? current.tiers
            : [
                { from: 1, to: 1000, rate: 0.1 },
                { from: 1001, to: null, rate: 0.12 },
              ]
          : [],
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const input = {
        ...form,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
        salesChannels: channels
          .split(',')
          .map(value => value.trim().toLowerCase())
          .filter(Boolean),
      };
      const version = detail?.currentVersion;
      let result: { data: Row };
      if (!detail) {
        result = await api('/rights/royalty-rules', { method: 'POST', body: JSON.stringify(input) });
      } else if (version?.status === 'draft') {
        result = await api(`/rights/royalty-rules/${detail.id}/versions/${version.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...input, revisionNo: version.revision_no }),
        });
      } else if (version?.status === 'approved') {
        result = await api(`/rights/royalty-rules/${detail.id}/amendments`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      } else {
        throw new Error('This rule is awaiting approval.');
      }
      setDetail(result.data);
      setSelectedId(result.data.id);
      setFormOpen(false);
      setNotice('Royalty rule draft saved successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save rule');
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
        `/rights/royalty-rules/${detail.id}/versions/${detail.currentVersion.id}/${kind}`,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }
      );
      setDetail(result.data);
      setDecision('');
      setNotice(
        kind === 'submit'
          ? 'Rule submitted for independent approval.'
          : kind === 'approve'
          ? 'Rule approved and active.'
          : 'Rule returned to draft.'
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete rule action');
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: keyof Rule,
    title: string,
    type = 'text',
    required = false,
    disabled = false
  ) => (
    <label className="field" key={key}>
      {title}
      <input
        className="input"
        type={type}
        step={type === 'number' ? 'any' : undefined}
        min={type === 'number' ? 0 : undefined}
        required={required}
        disabled={disabled}
        value={String(form[key] ?? '')}
        onChange={event =>
          change(
            key,
            (type === 'number'
              ? event.target.value === ''
                ? null
                : Number(event.target.value)
              : event.target.value) as never
          )
        }
      />
    </label>
  );

  const selectedContract = contracts.find(item => item.id === form.contractId);
  const availableBooks = selectedContract?.terms?.rights?.map((item: Row) => item.bookId) || [];
  const version = detail?.currentVersion;

  // KPI Calculations
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
                <ArrowLeft size={14} /> Back to Royalty Rules List
              </button>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>{version?.rule_ref || detail.rule_ref || 'Rule Details'}</span>
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⚙️</span> {detail && !formOpen ? `Royalty Policy · ${version?.rule_ref || detail.rule_ref}` : screen.title}
          </h1>
          <p className="muted">
            Version-controlled royalty policies, calculation methods, tiered slabs, and deduction rules.
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
              <span>Create Royalty Rule</span>
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

      {/* Info Callout */}
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>ℹ️</span>
        <span>
          <strong>Rule Approval &amp; Accrual Policy:</strong> Approved rules define the legal calculation parameters. Royalty accrual and net payables are computed upon verifying eligible warehouse book sales and return transactions.
        </span>
      </div>

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
            ⚙️ Total Rules
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Registered royalty policies
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
            Awaiting editorial approval
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
            ✅ Approved &amp; Active
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Active for calculation engine
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
            📝 Draft Policies
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
            {draftCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Unfinalized policy rules
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
          Loading royalty rules…
        </div>
      ) : !detail || formOpen ? (
        /* Rules List View */
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
                    placeholder="🔍 Search rule ref, contract or book..."
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
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong> rules
              </div>
            </div>
          </div>

          {/* Rules Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Reference</th>
                  <th>Contract</th>
                  <th>Book Title</th>
                  <th>Calculation Method</th>
                  <th>Effective Period</th>
                  <th style={{ textAlign: 'center' }}>Version</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.rule_ref || 'Legacy Rule'}</strong>
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
                          {item.terms ? label(item.terms.method) : label(item.basis || '')}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#475569' }}>
                        {date(item.terms?.effectiveFrom)} to {date(item.terms?.effectiveTo)}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                        v{item.version_no || 1}
                      </td>
                      <td>{renderStatusPill(item.status || 'legacy')}</td>
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
                      No royalty rules match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} rules · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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
        /* Rule Detail View */
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
                    {version?.rule_ref || detail.rule_ref || 'Royalty Policy'}
                  </h2>
                  {renderStatusPill(version?.status || detail.status)}
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                  Contract: <strong>{detail.contract_number}</strong>
                  {detail.book_title && ` · Book: ${detail.book_title}`} · Version {version?.version_no || 1}
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
                    Create Amendment Draft
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
                  ⚖️ Policy Review &amp; Approval Decision
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Decision note or approval justification (min 10 characters)..."
                    value={decision}
                    onChange={e => setDecision(e.target.value)}
                    style={{ flex: 1, minWidth: 260 }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('approve')}
                  >
                    Approve Rule
                  </button>
                  <button
                    className="btn"
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('return')}
                  >
                    Return to Draft
                  </button>
                </div>
              </div>
            )}

            {/* Policy Metric Cards */}
            {version ? (
              <>
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
                      Method &amp; Basis
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2, textTransform: 'capitalize' }}>
                      {label(version.terms.method)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Currency: {version.terms.currencyCode}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Rate / Amount
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                      {version.terms.rate != null
                        ? `${Number(version.terms.rate) * 100}%`
                        : version.terms.fixedAmount != null
                        ? `${version.terms.currencyCode} ${version.terms.fixedAmount}`
                        : version.terms.tiers?.length
                        ? `${version.terms.tiers.length} Tiers`
                        : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Calculated on eligible sales
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Eligible Channels
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {version.terms.salesChannels?.join(', ') || 'All channels'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Trade, online, institutional
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Effective Dates
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                      {date(version.terms.effectiveFrom)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      to {date(version.terms.effectiveTo)}
                    </div>
                  </div>
                </div>

                {/* Deduction Policies Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#334155',
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                      Returns Treatment
                    </span>
                    <strong>{label(version.terms.returnTreatment)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                      Consignment Sales
                    </span>
                    <strong>{label(version.terms.consignmentTreatment)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                      Advance Recoupment
                    </span>
                    <strong>{label(version.terms.advanceRecoupment)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                      Complimentary Copies
                    </span>
                    <strong>{label(version.terms.complimentaryTreatment)}</strong>
                  </div>
                </div>

                {/* Tiered Slabs Table */}
                {version.terms.tiers?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
                      Tiered Royalty Slabs
                    </h3>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>From Copy</th>
                            <th>To Copy</th>
                            <th style={{ textAlign: 'right' }}>Royalty Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {version.terms.tiers.map((tier: Tier, index: number) => (
                            <tr key={index}>
                              <td>{tier.from.toLocaleString()}</td>
                              <td>{tier.to ? tier.to.toLocaleString() : 'Open (and above)'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                {(tier.rate * 100).toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">This legacy rule has no approved version snapshot.</p>
            )}
          </div>

          {/* Version History */}
          <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#475569' }}>
              Policy Version History
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

      {/* Create / Edit Rule Modal */}
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
              width: 'min(760px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={22} color="#4f46e5" />
                {!detail ? 'New Royalty Rule' : version?.status === 'approved' ? 'Draft Rule Amendment' : 'Edit Rule Draft'}
              </h2>
              <button className="btn icon-btn" type="button" onClick={() => setFormOpen(false)}>
                ✕
              </button>
            </div>

            <div className="catalog-form-grid">
              {field('ruleRef', 'Rule reference', 'text', true, !!detail)}

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
                Recipient Author
                <select
                  className="input"
                  required
                  value={form.recipientAuthorId}
                  onChange={event => change('recipientAuthorId', event.target.value)}
                >
                  <option value="">Select author</option>
                  {authors.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Calculation Method
                <select className="input" value={form.method} onChange={event => chooseMethod(event.target.value)}>
                  {methods.map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>

              {form.rate != null && field('rate', 'Rate (e.g., 0.10 for 10%)', 'number', true)}
              {form.fixedAmount != null && field('fixedAmount', 'Fixed amount per copy', 'number', true)}
              {field('currencyCode', 'Currency', 'text', true)}
              {field('effectiveFrom', 'Effective start date', 'date', true)}
              {field('effectiveTo', 'Effective end date (optional)', 'date')}

              <label className="field">
                Sales channels (comma separated)
                <input
                  className="input"
                  required
                  value={channels}
                  onChange={event => setChannels(event.target.value)}
                  placeholder="all, or bookstore, online"
                />
              </label>

              <label className="field">
                Return treatment
                <select
                  className="input"
                  value={form.returnTreatment}
                  onChange={event => change('returnTreatment', event.target.value)}
                >
                  {['deduct_eligible_returns', 'no_return_adjustment'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Complimentary copies
                <select
                  className="input"
                  value={form.complimentaryTreatment}
                  onChange={event => change('complimentaryTreatment', event.target.value)}
                >
                  {['exclude', 'include'].map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Consignment sales
                <select
                  className="input"
                  value={form.consignmentTreatment}
                  onChange={event => change('consignmentTreatment', event.target.value)}
                >
                  {['settled_only', 'include_accepted'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Advance recoupment
                <select
                  className="input"
                  value={form.advanceRecoupment}
                  onChange={event => change('advanceRecoupment', event.target.value)}
                >
                  {['none', 'up_to_payable'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Tiered Slabs builder */}
            {form.method === 'tiered' && (
              <div style={{ marginTop: 16, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#334155' }}>Rate Tiers</h3>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() =>
                      setForm(current => ({
                        ...current,
                        tiers: [...current.tiers, { from: 1, to: null, rate: 0 }],
                      }))
                    }
                  >
                    + Add Tier
                  </button>
                </div>
                {form.tiers.map((tier, index) => (
                  <div className="catalog-form-grid" key={index} style={{ marginBottom: 8, alignItems: 'end' }}>
                    <label className="field" style={{ margin: 0 }}>
                      From unit
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={tier.from}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            tiers: current.tiers.map((item, at) =>
                              at === index ? { ...item, from: Number(event.target.value) } : item
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="field" style={{ margin: 0 }}>
                      To unit (blank for final)
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={tier.to ?? ''}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            tiers: current.tiers.map((item, at) =>
                              at === index
                                ? { ...item, to: event.target.value ? Number(event.target.value) : null }
                                : item
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="field" style={{ margin: 0 }}>
                      Rate (e.g. 0.12)
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={1}
                        step="0.0001"
                        value={tier.rate}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            tiers: current.tiers.map((item, at) =>
                              at === index ? { ...item, rate: Number(event.target.value) } : item
                            ),
                          }))
                        }
                      />
                    </label>
                    {form.tiers.length > 1 && (
                      <button
                        className="btn btn-sm"
                        style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                        type="button"
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            tiers: current.tiers.filter((_, at) => at !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="field" style={{ marginTop: 12 }}>
              Policy notes
              <textarea
                className="input"
                rows={3}
                maxLength={5000}
                value={form.notes || ''}
                onChange={event => change('notes', event.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn" type="button" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? 'Saving…' : 'Save Rule Draft'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
