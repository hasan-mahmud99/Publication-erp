"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  CreditCard,
  DollarSign,
  Printer,
  Calendar,
} from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
const date = (value: unknown) => (value ? String(value).slice(0, 10) : '—');
const label = (value: string) => String(value || '').replaceAll('_', ' ');
const amount = (value: unknown) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9',
    color = '#475569',
    border = '#cbd5e1';
  if (s === 'finalized' || s === 'posted') {
    bg = '#ecfdf5';
    color = '#065f46';
    border = '#a7f3d0';
  } else if (s === 'draft') {
    bg = '#f0f9ff';
    color = '#0369a1';
    border = '#bae6fd';
  } else if (s === 'submitted') {
    bg = '#fffbeb';
    color = '#92400e';
    border = '#fde68a';
  } else if (s === 'voided' || s === 'void') {
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

export function RightsRoyaltyStatementsScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [contracts, setContracts] = useState<Row[]>([]);
  const [authors, setAuthors] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [form, setForm] = useState({
    statementRef: '',
    contractId: '',
    authorId: '',
    from: '',
    to: '',
  });
  const [payment, setPayment] = useState({
    amount: '',
    postingDate: '',
    debitAccountId: '',
    creditAccountId: '',
    memo: '',
  });
  const [paymentKey, setPaymentKey] = useState('');
  const [note, setNote] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = role === 'Owner' || permissions.includes('rights.manage');
  const canApprove = role === 'Owner' || permissions.includes('rights.approve');
  const canPay =
    canManage &&
    (role === 'Owner' || permissions.includes('finance.read')) &&
    (role === 'Owner' || permissions.includes('workspace.create'));

  async function downloadPdf(id: string, ref: string) {
    setError('');
    try {
      const blob = await apiFile(`/rights/royalty-statements/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `royalty-statement-${ref.replaceAll(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download statement PDF');
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get('contract');
    const a = params.get('author');
    const f = params.get('from');
    const t = params.get('to');
    const shouldCreate = params.get('create');
    if (shouldCreate || c || a || f || t) {
      setForm(prev => ({
        statementRef: prev.statementRef || `STMT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        contractId: c || prev.contractId,
        authorId: a || prev.authorId,
        from: f || prev.from,
        to: t || prev.to,
      }));
      if (shouldCreate) setFormOpen(true);
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
        api<{ data: { data: Row[]; meta: { total: number } } }>(`/rights/royalty-statements?${params}`),
        api<{ data: { data: Row[] } }>('/rights/contracts?limit=100'),
        api<{ data: { authors: Row[] } }>('/rights/contract-choices'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      setRows(list.data.data);
      setTotal(list.data.meta.total);
      setContracts(contractList.data.data.filter(item => ['approved', 'active'].includes(item.status)));
      setAuthors(choices.data.authors);
      setRole(me.data.role);
      setPermissions(me.data.permissions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load royalty statements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [screen.id, page, query, status]);

  async function select(id: string) {
    setFormOpen(false);
    setPaymentOpen(false);
    setError('');
    try {
      setDetail((await api<{ data: Row }>(`/rights/royalty-statements/${id}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load statement');
    }
  }

  function startCreate() {
    setForm({
      statementRef: `STMT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      contractId: '',
      authorId: '',
      from: '',
      to: '',
    });
    setDetail(null);
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ data: Row }>('/rights/royalty-statements', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setDetail(result.data);
      setFormOpen(false);
      setNotice('Statement draft saved from current posted sources. Submit it for independent review.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create statement');
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: 'submit' | 'finalize' | 'return' | 'refresh' | 'void') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDetail(
        (await api<{ data: Row }>(`/rights/royalty-statements/${detail.id}/${kind}`, {
          method: 'POST',
          body: JSON.stringify(kind === 'finalize' || kind === 'return' ? { note: note.trim() } : {}),
        })).data
      );
      setNote('');
      setNotice(
        kind === 'finalize'
          ? 'Statement finalized with locked source lines and reviewed advance recoupment.'
          : kind === 'submit'
          ? 'Statement submitted for independent approval.'
          : kind === 'return'
          ? 'Statement returned for correction.'
          : kind === 'refresh'
          ? 'Draft refreshed from current posted sources.'
          : 'Draft statement voided.'
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete statement action');
    } finally {
      setBusy(false);
    }
  }

  async function startPayment() {
    if (!detail) return;
    setError('');
    try {
      setAccounts((await api<{ data: Row[] }>('/accounts/chart')).data.filter(item => item.is_active));
      setPayment({
        amount: String(
          Math.max(
            0,
            Number(detail.net_payable) -
              Number(detail.payment?.paidAmount || 0) -
              Number(detail.payment?.pendingAmount || 0)
          )
        ),
        postingDate: new Date().toISOString().slice(0, 10),
        debitAccountId: '',
        creditAccountId: '',
        memo: `Royalty statement ${detail.statement_ref} payment`,
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
      await api(`/rights/royalty-statements/${detail.id}/payment-vouchers`, {
        method: 'POST',
        headers: { 'Idempotency-Key': paymentKey },
        body: JSON.stringify({ ...payment, amount: Number(payment.amount) }),
      });
      setDetail((await api<{ data: Row }>(`/rights/royalty-statements/${detail.id}`)).data);
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
        (await api<{ data: Row }>(
          `/rights/royalty-statements/${detail.id}/payment-vouchers/${voucherId}/void`,
          { method: 'POST' }
        )).data
      );
      setNotice('Unposted payment voucher voided.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not void payment voucher');
    } finally {
      setBusy(false);
    }
  }

  // Overall KPI counts
  const totalCount = total;
  const submittedCount = rows.filter(r => r.status === 'submitted').length;
  const finalizedCount = rows.filter(r => r.status === 'finalized').length;
  const pageTotalPayable = rows.reduce((sum, r) => sum + (Number(r.net_payable) || 0), 0);

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
                <ArrowLeft size={14} /> Back to Royalty Statements List
              </button>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>{detail.statement_ref}</span>
            </div>
          )}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📑</span> {detail && !formOpen ? `Statement ${detail.statement_ref}` : screen.title}
          </h1>
          <p className="muted">
            Formal author royalty settlement register, advance recoupment balance, printable statement PDFs, and Finance vouchers.
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
              <span>Create Statement</span>
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
            📑 Total Statements
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Settlement records in register
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setStatus('submitted');
            setPage(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: status === 'submitted' ? '4px solid #f59e0b' : '4px solid transparent',
            background: status === 'submitted' ? 'var(--panel-active-bg, #fffbeb)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            ⏳ Awaiting Approval
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {submittedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Awaiting editorial review
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setStatus('finalized');
            setPage(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: status === 'finalized' ? '4px solid #10b981' : '4px solid transparent',
            background: status === 'finalized' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            ✅ Finalized Statements
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {finalizedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Locked for author disbursement
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
            💰 Page Net Payable
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#5b21b6', marginTop: '4px' }}>
            BDT {pageTotalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Sum of net payable on this page
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
          Loading royalty statements…
        </div>
      ) : !detail || formOpen ? (
        /* Statements List View */
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
                    placeholder="🔍 Search statement, author or contract..."
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
                  {['draft', 'submitted', 'finalized', 'voided'].map(item => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Showing <strong>{rows.length}</strong> of <strong>{total}</strong> statements
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="panel table-wrap" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Statement Ref</th>
                  <th>Recipient / Contract</th>
                  <th>Settlement Period</th>
                  <th style={{ textAlign: 'right' }}>Gross Royalty</th>
                  <th style={{ textAlign: 'right' }}>Returns Adjustment</th>
                  <th style={{ textAlign: 'right' }}>Advance Recouped</th>
                  <th style={{ textAlign: 'right' }}>Net Payable</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.statement_ref}</strong>
                      </td>
                      <td>
                        <div>
                          <strong>{item.author_name}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{item.contract_number}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {date(item.period_from)} to {date(item.period_to)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.currency_code} {amount(item.gross_royalty)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#b91c1c' }}>
                        {item.currency_code} {amount(item.return_adjustment)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#b45309' }}>
                        {item.currency_code} {amount(item.recouped_amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>
                        {item.currency_code} {amount(item.net_payable)}
                      </td>
                      <td>{renderStatusPill(item.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => void select(item.id)}>
                            Details
                          </button>
                          <button
                            className="btn btn-sm"
                            title="Download Official Statement PDF"
                            onClick={() => void downloadPdf(item.id, item.statement_ref)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="empty">
                      No royalty statements match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total} statements · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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
        /* Statement Detail View */
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
                    {detail.statement_ref}
                  </h2>
                  {renderStatusPill(detail.status)}
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                  Author: <strong>{detail.author_name}</strong> · Contract: <strong>{detail.contract_number}</strong> · Period: {date(detail.period_from)} to {date(detail.period_to)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => void downloadPdf(detail.id, detail.statement_ref)}
                >
                  <Download size={15} />
                  <span>Download Statement (PDF)</span>
                </button>
                {canManage && detail.status === 'draft' && (
                  <>
                    <button className="btn" disabled={busy} onClick={() => void action('refresh')}>
                      Refresh Sources
                    </button>
                    <button className="btn btn-primary" disabled={busy} onClick={() => void action('submit')}>
                      Submit for Approval
                    </button>
                    <button className="btn" style={{ color: '#b91c1c' }} disabled={busy} onClick={() => void action('void')}>
                      Void Draft
                    </button>
                  </>
                )}
                {canPay &&
                  detail.status === 'finalized' &&
                  Number(detail.net_payable) >
                    Number(detail.payment?.paidAmount || 0) + Number(detail.payment?.pendingAmount || 0) && (
                    <button
                      className="btn btn-primary"
                      onClick={() => void startPayment()}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <CreditCard size={15} />
                      <span>Create Payment Voucher</span>
                    </button>
                  )}
              </div>
            </div>

            {/* Approval Decision Box */}
            {canApprove && detail.status === 'submitted' && (
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
                  ✍️ Statement Approval Decision
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Approval note or review comments (min 10 characters)..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    style={{ flex: 1, minWidth: 260 }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy || note.trim().length < 10}
                    onClick={() => void action('finalize')}
                  >
                    Approve and Finalize
                  </button>
                  <button
                    className="btn"
                    disabled={busy || note.trim().length < 10}
                    onClick={() => void action('return')}
                  >
                    Return for Correction
                  </button>
                </div>
              </div>
            )}

            {/* 4 Financial KPI Cards */}
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
                  Sales Gross Royalty
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {detail.currency_code} {amount(detail.gross_royalty)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  From eligible book shipments
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Return Adjustments
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#b91c1c', marginTop: 2 }}>
                  {detail.currency_code} {amount(detail.return_adjustment)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Deducted credit notes
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Advance Recouped
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#b45309', marginTop: 2 }}>
                  {detail.currency_code} {amount(detail.recouped_amount)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Applied against advance balance
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Net Author Payable
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8', marginTop: 2 }}>
                  {detail.currency_code} {amount(detail.net_payable)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Net settlement due to author
                </div>
              </div>
            </div>
          </div>

          {/* Saved Source Snapshot Lines */}
          <div className="panel" style={{ padding: '24px', borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Locked Source Lines ({detail.snapshot?.lines?.length || 0})
            </h2>
            {detail.snapshot?.lines?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event Date / Type</th>
                      <th>Source Reference</th>
                      <th>Governing Rule</th>
                      <th style={{ textAlign: 'center' }}>Units</th>
                      <th style={{ textAlign: 'right' }}>Royalty Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.snapshot.lines.map((line: Row, index: number) => (
                      <tr key={`${line.sourceId}-${index}`}>
                        <td>
                          <div>{line.eventDate}</div>
                          <span
                            style={{
                              background: line.eventType?.includes('return') ? '#fef2f2' : '#ecfdf5',
                              color: line.eventType?.includes('return') ? '#991b1b' : '#065f46',
                              padding: '1px 6px',
                              borderRadius: 3,
                              fontSize: 10,
                              textTransform: 'uppercase',
                              fontWeight: 700,
                            }}
                          >
                            {label(line.eventType)}
                          </span>
                        </td>
                        <td>
                          <code>{line.sourceId}</code>
                        </td>
                        <td>
                          <div>{line.ruleRef}</div>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            v{line.ruleVersionId?.slice(0, 8)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{line.quantity}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: Number(line.royaltyAmount) < 0 ? '#b91c1c' : '#059669',
                          }}
                        >
                          {line.currencyCode} {amount(line.royaltyAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No line items snapshot recorded.
              </p>
            )}
          </div>

          {/* Linked Payment Vouchers */}
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
                          {item.currency_code} {amount(item.amount)}
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
                            {canPay && item.effective_status === 'draft' && (
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
                No payment vouchers linked yet. Click "Create Payment Voucher" above when finalized.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Create Statement Modal */}
      {formOpen && (
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
            onSubmit={create}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={22} color="#4f46e5" /> Create Royalty Settlement Draft
              </h2>
              <button className="btn icon-btn" type="button" onClick={() => setFormOpen(false)}>
                ✕
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
              Select agreement, recipient author and settlement period. Current posted sales, credit notes and unrecouped advances will be compiled into a draft.
            </p>
            <div className="catalog-form-grid">
              <label className="field">
                Statement reference
                <input
                  className="input"
                  required
                  minLength={2}
                  maxLength={80}
                  value={form.statementRef}
                  onChange={event => setForm(current => ({ ...current, statementRef: event.target.value }))}
                />
              </label>

              <label className="field">
                Contract
                <select
                  className="input"
                  required
                  value={form.contractId}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      contractId: event.target.value,
                      authorId: contracts.find(item => item.id === event.target.value)?.author_id || '',
                    }))
                  }
                >
                  <option value="">Choose contract</option>
                  {contracts.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.contract_number}
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
                  onChange={event => setForm(current => ({ ...current, authorId: event.target.value }))}
                >
                  <option value="">Choose recipient</option>
                  {authors.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Period From
                <input
                  className="input"
                  type="date"
                  required
                  value={form.from}
                  onChange={event => setForm(current => ({ ...current, from: event.target.value }))}
                />
              </label>

              <label className="field">
                Period To
                <input
                  className="input"
                  type="date"
                  required
                  value={form.to}
                  onChange={event => setForm(current => ({ ...current, to: event.target.value }))}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? 'Saving…' : 'Save Statement Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Payment Voucher Modal */}
      {paymentOpen && detail && (
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
            onSubmit={createPayment}
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
                <CreditCard size={22} color="#4f46e5" /> Payment Voucher for {detail.statement_ref}
              </h2>
              <button className="btn icon-btn" type="button" onClick={() => setPaymentOpen(false)}>
                ✕
              </button>
            </div>
            <div className="catalog-form-grid">
              <label className="field">
                Payment amount ({detail.currency_code})
                <input
                  className="input"
                  type="number"
                  min="0.01"
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
                  <option value="">Choose account</option>
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
                  <option value="">Choose account</option>
                  {accounts.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.account_code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              Memo / Journal description
              <input
                className="input"
                minLength={5}
                maxLength={400}
                required
                value={payment.memo}
                onChange={event => setPayment(current => ({ ...current, memo: event.target.value }))}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn" onClick={() => setPaymentOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? 'Creating…' : 'Create Voucher Draft'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
