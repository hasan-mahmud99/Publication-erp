"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
type Advance = {
  advanceRef: string;
  contractId: string;
  authorId: string;
  bookId: string | null;
  advanceType: string;
  requestedAmount: number;
  currencyCode: string;
  requestedDate: string;
  reason: string;
};

const blank = (): Advance => ({
  advanceRef: '',
  contractId: '',
  authorId: '',
  bookId: null,
  advanceType: 'recoupable',
  requestedAmount: 0,
  currencyCode: 'BDT',
  requestedDate: '',
  reason: '',
});

const date = (value: unknown) => (value ? String(value).slice(0, 10) : '—');
const label = (value: string) => String(value || '').replaceAll('_', ' ');

function renderStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9',
    color = '#475569',
    border = '#cbd5e1';
  if (s === 'approved' || s === 'fully_paid' || s === 'settled') {
    bg = '#ecfdf5';
    color = '#065f46';
    border = '#a7f3d0';
  } else if (s === 'draft' || s === 'partial_paid') {
    bg = '#f0f9ff';
    color = '#0369a1';
    border = '#bae6fd';
  } else if (s === 'pending_approval' || s === 'unpaid') {
    bg = '#fffbeb';
    color = '#92400e';
    border = '#fde68a';
  } else if (s === 'rejected' || s === 'void' || s === 'cancelled') {
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

export function RightsAdvancesScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [contracts, setContracts] = useState<Row[]>([]);
  const [authors, setAuthors] = useState<Row[]>([]);
  const [books, setBooks] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [form, setForm] = useState<Advance>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState({
    amount: '',
    postingDate: '',
    debitAccountId: '',
    creditAccountId: '',
    memo: '',
  });
  const [paymentKey, setPaymentKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = role === 'Owner' || permissions.includes('rights.manage');
  const canApprove = role === 'Owner' || permissions.includes('rights.approve');
  const canCreateVoucher =
    role === 'Owner' ||
    (permissions.includes('rights.manage') &&
      permissions.includes('workspace.create') &&
      permissions.includes('finance.read'));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const a = params.get('author');
    const c = params.get('contract');
    if (a || c) {
      setForm(prev => ({
        ...prev,
        advanceRef: prev.advanceRef || `ADV-${Date.now().toString().slice(-6)}`,
        authorId: a || prev.authorId,
        contractId: c || prev.contractId,
        requestedDate: prev.requestedDate || new Date().toISOString().slice(0, 10),
      }));
      setFormOpen(true);
    }
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      const [list, contractList, choices, me] = await Promise.all([
        api<{ data: { data: Row[]; meta: { total: number } } }>(`/rights/advances?${params}`),
        api<{ data: { data: Row[] } }>('/rights/contracts?limit=100'),
        api<{ data: { authors: Row[]; books: Row[] } }>('/rights/contract-choices'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setRows(list.data.data);
      setTotal(list.data.meta.total);
      setContracts(contractList.data.data.filter(item => ['approved', 'active'].includes(item.status)));
      setAuthors(choices.data.authors);
      setBooks(choices.data.books);
      setRole(me.data.role);
      setPermissions(me.data.permissions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load advance requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, page, query, status]);

  async function select(id: string) {
    setFormOpen(false);
    setError('');
    try {
      setDetail((await api<{ data: Row }>(`/rights/advances/${id}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load advance request');
    }
  }

  function change<K extends keyof Advance>(key: K, value: Advance[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setDetail(null);
    setForm({
      ...blank(),
      advanceRef: `ADV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      requestedDate: new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function startEdit() {
    if (!detail) return;
    setForm({
      advanceRef: detail.advance_ref,
      contractId: detail.contract_id,
      authorId: detail.author_id,
      bookId: detail.book_id,
      advanceType: detail.advance_type,
      requestedAmount: Number(detail.requested_amount),
      currencyCode: detail.currency_code,
      requestedDate: date(detail.requested_date),
      reason: detail.reason,
    });
    setFormOpen(true);
  }

  function chooseContract(id: string) {
    const contract = contracts.find(item => item.id === id);
    setForm(current => ({
      ...current,
      contractId: id,
      authorId: contract?.author_id || '',
      bookId: contract?.terms?.rights?.[0]?.bookId || null,
      currencyCode: contract?.terms?.currencyCode || 'BDT',
      requestedDate: contract?.terms?.startDate || '',
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ data: Row }>(detail ? `/rights/advances/${detail.id}` : '/rights/advances', {
        method: detail ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          bookId: form.bookId || null,
          ...(detail ? { revisionNo: detail.revision_no } : {}),
        }),
      });
      setDetail(result.data);
      setFormOpen(false);
      setNotice('Advance request draft saved. No payment has been posted.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save advance request');
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: 'submit' | 'approve' | 'return' | 'reject') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body =
        kind === 'approve'
          ? { note: decision.trim() }
          : kind === 'return' || kind === 'reject'
          ? { reason: decision.trim() }
          : undefined;
      const result = await api<{ data: Row }>(`/rights/advances/${detail.id}/${kind}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      setDetail(result.data);
      setDecision('');
      setNotice(
        kind === 'approve'
          ? 'Advance request approved. Finance payment has not been posted.'
          : kind === 'submit'
          ? 'Advance request submitted for approval.'
          : kind === 'return'
          ? 'Advance request returned to draft.'
          : 'Advance request rejected.'
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete advance action');
    } finally {
      setBusy(false);
    }
  }

  async function openPayment() {
    if (!detail) return;
    setError('');
    try {
      const result = await api<{ data: Row[] }>('/accounts/chart');
      setAccounts(result.data.filter(item => item.is_active));
      setPayment({
        amount: String(
          Math.max(
            0,
            Number(detail.payment?.amountAwaitingPayment || 0) - Number(detail.payment?.pendingAmount || 0)
          )
        ),
        postingDate: new Date().toISOString().slice(0, 10),
        debitAccountId: '',
        creditAccountId: '',
        memo: `Author advance ${detail.advance_ref} disbursement`,
      });
      setPaymentKey(crypto.randomUUID());
      setPaymentOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load Finance accounts');
    }
  }

  async function createPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/rights/advances/${detail.id}/payment-vouchers`, {
        method: 'POST',
        headers: { 'Idempotency-Key': paymentKey },
        body: JSON.stringify({ ...payment, amount: Number(payment.amount) }),
      });
      const refreshed = await api<{ data: Row }>(`/rights/advances/${detail.id}`);
      setDetail(refreshed.data);
      setPaymentOpen(false);
      setNotice('Payment voucher draft created. A different Finance approver must post it.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create payment voucher');
    } finally {
      setBusy(false);
    }
  }

  async function voidPayment(voucherId: string) {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDetail(
        (await api<{ data: Row }>(`/rights/advances/${detail.id}/payment-vouchers/${voucherId}/void`, {
          method: 'POST',
        })).data
      );
      setNotice('Unposted voucher voided.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not void voucher');
    } finally {
      setBusy(false);
    }
  }

  const contract = contracts.find(item => item.id === form.contractId);
  const availableBooks = contract?.terms?.rights?.map((item: Row) => item.bookId) || [];

  // KPI Calculations
  const totalCount = total;
  const pendingCount = rows.filter(r => r.status === 'pending_approval').length;
  const approvedCount = rows.filter(r => r.status === 'approved').length;
  const totalPaidSum = rows.reduce((sum, r) => sum + (Number(r.payment?.paidAmount) || 0), 0);

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
                <ArrowLeft size={14} /> Back to Advance Register
              </button>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>{detail.advance_ref}</span>
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>💰</span> {detail && !formOpen ? `Advance ${detail.advance_ref}` : screen.title}
          </h1>
          <p className="muted">
            Contract-linked advance royalties, disbursement vouchers, and sales recoupment ledger.
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
              <span>Create Advance Request</span>
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
          <strong>Finance payments and royalty recoupment:</strong> Only posted Finance vouchers count as paid. Recoupment occurs automatically against finalized author royalty statements.
        </span>
      </div>

      {/* KPI Cards */}
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
            💰 Total Advance Requests
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Registered requests in ledger
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
            ⏳ Pending Approval
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Awaiting executive review
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
            ✅ Approved Advances
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {approvedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Cleared for payment voucher
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
            💵 Disbursed on Page
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#5b21b6', marginTop: '4px' }}>
            BDT {totalPaidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Sum of posted payments
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
          Loading advance requests…
        </div>
      ) : !detail || formOpen ? (
        /* Advances List View */
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
                    placeholder="🔍 Search advance, author or contract..."
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
                  {['draft', 'pending_approval', 'approved', 'rejected'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong> requests
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Advance Reference</th>
                  <th>Author</th>
                  <th>Contract / Book</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Awaiting</th>
                  <th>Approval Status</th>
                  <th>Payment Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.advance_ref}</strong>
                          <span
                            style={{
                              background: '#f1f5f9',
                              padding: '1px 6px',
                              borderRadius: 3,
                              fontSize: 10,
                              textTransform: 'uppercase',
                              fontWeight: 600,
                              color: '#475569',
                              width: 'fit-content',
                            }}
                          >
                            {label(item.advance_type)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{item.author_name}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{item.contract_number}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{item.book_title || 'Contract level'}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {item.currency_code} {Number(item.requested_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div>{item.currency_code} {Number(item.payment.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{item.payment.paymentCount} posted</div>
                      </td>
                      <td style={{ textAlign: 'right', color: item.payment.amountAwaitingPayment > 0 ? '#b45309' : '#059669', fontWeight: 600 }}>
                        {item.payment.amountAwaitingPayment == null
                          ? '—'
                          : `${item.currency_code} ${Number(item.payment.amountAwaitingPayment).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td>{renderStatusPill(item.status)}</td>
                      <td>{renderStatusPill(item.payment.paymentStatus)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm" onClick={() => void select(item.id)}>
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="empty">
                      No advance requests match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} requests · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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
        /* Detail View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Card */}
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
                    {detail.advance_ref}
                  </h2>
                  {renderStatusPill(detail.status)}
                  {renderStatusPill(detail.payment.paymentStatus)}
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                  Author: <strong>{detail.author_name}</strong> · Contract: <strong>{detail.contract_number}</strong>
                  {detail.book_title && ` · Book: ${detail.book_title}`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canManage && detail.status === 'draft' && (
                  <>
                    <button className="btn" onClick={startEdit}>
                      Edit Draft
                    </button>
                    <button className="btn btn-primary" disabled={busy} onClick={() => void action('submit')}>
                      Submit for Approval
                    </button>
                  </>
                )}
                {canCreateVoucher &&
                  detail.status === 'approved' &&
                  Number(detail.payment.amountAwaitingPayment) > Number(detail.payment.pendingAmount) && (
                    <button
                      className="btn btn-primary"
                      onClick={() => void openPayment()}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <CreditCard size={15} />
                      <span>Create Payment Voucher Draft</span>
                    </button>
                  )}
              </div>
            </div>

            {/* Approval Decision Box */}
            {canApprove && detail.status === 'pending_approval' && (
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
                  ✍️ Author Advance Approval Decision
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Decision note or approval reason (min 10 characters)..."
                    value={decision}
                    onChange={e => setDecision(e.target.value)}
                    style={{ flex: 1, minWidth: 260 }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('approve')}
                  >
                    Approve Advance
                  </button>
                  <button
                    className="btn"
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('return')}
                  >
                    Return to Draft
                  </button>
                  <button
                    className="btn"
                    style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                    disabled={busy || decision.trim().length < 10}
                    onClick={() => void action('reject')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* 4 Financial Metric Cards */}
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
                  Requested Amount
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {detail.currency_code} {Number(detail.requested_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Type: {label(detail.advance_type)}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Paid by Finance
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                  {detail.currency_code} {Number(detail.payment.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {detail.payment.paymentCount} posted vouchers ({detail.payment.pendingCount} drafts)
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Recouped via Sales
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
                  {detail.currency_code} {Number(detail.payment.recoupedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Across {detail.payment.recoupmentCount} finalized statements
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Unrecouped Balance
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: Number(detail.payment.unrecoupedBalance) > 0 ? '#b45309' : '#059669',
                    marginTop: 2,
                  }}
                >
                  {detail.payment.unrecoupedBalance == null
                    ? 'N/A'
                    : `${detail.currency_code} ${Number(detail.payment.unrecoupedBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {label(detail.payment.recoupmentStatus)}
                </div>
              </div>
            </div>

            {/* Business Reason */}
            {detail.reason && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '12px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#334155',
                }}
              >
                <strong style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>
                  Business Reason &amp; Milestones
                </strong>
                {detail.reason}
              </div>
            )}
          </div>

          {/* Payment Vouchers Table */}
          <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Linked Finance Payment Vouchers ({detail.payments?.length || 0})
            </h2>
            {detail.payments?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Journal Entry</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Posting Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((item: Row) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.entry_number}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {item.currency_code} {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td>{date(item.posting_date)}</td>
                        <td>{renderStatusPill(item.effective_status)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Link
                              className="btn btn-sm"
                              href={`/finance-accounting/journal-entry-detail?journal=${item.journal_id}`}
                            >
                              View Journal
                            </Link>
                            {canCreateVoucher && item.effective_status === 'draft' && (
                              <button
                                className="btn btn-sm"
                                style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                                disabled={busy}
                                onClick={() => void voidPayment(item.id)}
                              >
                                Void Draft
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No payment vouchers linked yet. Click "Create Payment Voucher Draft" above when approved.
              </p>
            )}
          </div>

          {/* Audit History */}
          <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#475569' }}>
              Advance Audit Trail
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
        </div>
      )}

      {/* Create / Edit Advance Modal */}
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
              width: 'min(720px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={22} color="#059669" />
                {detail ? 'Edit Advance Request' : 'New Author Advance Request'}
              </h2>
              <button className="btn icon-btn" type="button" onClick={() => setFormOpen(false)}>
                ✕
              </button>
            </div>

            <div className="catalog-form-grid">
              <label className="field">
                Advance reference
                <input
                  className="input"
                  required
                  disabled={!!detail}
                  value={form.advanceRef}
                  onChange={event => change('advanceRef', event.target.value)}
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
                Recipient Author
                <select
                  className="input"
                  required
                  value={form.authorId}
                  onChange={event => change('authorId', event.target.value)}
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
                Book (optional for contract author)
                <select
                  className="input"
                  value={form.bookId || ''}
                  onChange={event => change('bookId', event.target.value || null)}
                >
                  <option value="">Contract level</option>
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
                Advance type
                <select
                  className="input"
                  value={form.advanceType}
                  onChange={event => change('advanceType', event.target.value)}
                >
                  {['signing', 'milestone', 'recoupable', 'nonrecoupable', 'other'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Requested amount
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.requestedAmount || ''}
                  onChange={event => change('requestedAmount', Number(event.target.value))}
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

              <label className="field">
                Requested date
                <input
                  className="input"
                  type="date"
                  required
                  value={form.requestedDate}
                  onChange={event => change('requestedDate', event.target.value)}
                />
              </label>
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              Business reason &amp; contractual justification
              <textarea
                className="input"
                required
                minLength={10}
                maxLength={2000}
                rows={3}
                value={form.reason}
                onChange={event => change('reason', event.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn" type="button" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? 'Saving…' : 'Save Advance Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Payment Voucher Modal */}
      {detail && paymentOpen && (
        <div
          className="modal-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) setPaymentOpen(false);
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
            className="panel modal"
            onSubmit={event => void createPayment(event)}
            style={{
              width: 'min(680px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={22} color="#4f46e5" /> Draft Finance Payment Voucher
              </h2>
              <button className="btn icon-btn" type="button" onClick={() => setPaymentOpen(false)}>
                ✕
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
              Select debit and credit accounts under your approved chart of accounts. Creates a balanced journal entry draft; a separate Finance officer must post it.
            </p>
            <div className="catalog-form-grid">
              <label className="field">
                Payment amount ({detail.currency_code})
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  max={Number(detail.payment.amountAwaitingPayment) - Number(detail.payment.pendingAmount)}
                  step="0.01"
                  required
                  value={payment.amount}
                  onChange={event => setPayment(current => ({ ...current, amount: event.target.value }))}
                />
              </label>

              <label className="field">
                Posting date
                <input
                  className="input"
                  type="date"
                  required
                  value={payment.postingDate}
                  onChange={event => setPayment(current => ({ ...current, postingDate: event.target.value }))}
                />
              </label>

              <label className="field">
                Debit account
                <select
                  className="input"
                  required
                  value={payment.debitAccountId}
                  onChange={event => setPayment(current => ({ ...current, debitAccountId: event.target.value }))}
                >
                  <option value="">Select debit account</option>
                  {accounts.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.account_code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Credit account
                <select
                  className="input"
                  required
                  value={payment.creditAccountId}
                  onChange={event => setPayment(current => ({ ...current, creditAccountId: event.target.value }))}
                >
                  <option value="">Select credit account</option>
                  {accounts.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.account_code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              Payment memo
              <input
                className="input"
                required
                minLength={5}
                maxLength={400}
                value={payment.memo}
                onChange={event => setPayment(current => ({ ...current, memo: event.target.value }))}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn" type="button" onClick={() => setPaymentOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create Voucher Draft'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
