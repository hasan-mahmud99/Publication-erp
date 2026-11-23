"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type CreditNoteRow = {
  id: string;
  credit_note_number: string;
  return_id: string;
  customer_id: string;
  invoice_id: string | null;
  credit_date: string;
  subtotal_amount: string;
  vat_amount: string;
  total_credit_amount: string;
  status: string;
  mushak_number: string | null;
  reason: string | null;
  created_at: string;
  customer_name: string;
  customer_type: string;
  return_number: string;
  invoice_number: string | null;
  line_count: number;
  settled_amount: string;
};

type CreditNoteDetail = {
  id: string;
  credit_note_number: string;
  return_id: string;
  customer_name: string;
  customer_type: string;
  customer_code: string;
  invoice_number: string | null;
  invoice_date: string | null;
  return_number: string;
  return_date: string;
  return_reason: string | null;
  credit_date: string;
  subtotal_amount: string;
  vat_amount: string;
  total_credit_amount: string;
  status: string;
  mushak_number: string | null;
  reason: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
  lines: Array<{
    id: string;
    book_title: string;
    edition_code: string | null;
    edition_title: string | null;
    quantity: number;
    unit_price: string;
    net_unit_price: string;
    line_total: string;
  }>;
  settlements: Array<{
    id: string;
    settlement_number: string;
    settlement_type: string;
    amount: string;
    status: string;
    created_at: string;
    created_by_name: string | null;
  }>;
};

type AuthorizedReturnOption = {
  id: string;
  return_number: string;
  return_date: string;
  customer_name: string;
  invoice_number: string | null;
  requested_quantity: string;
  proposed_credit: string;
};

const money = (val: unknown) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (val: string | null | undefined) => (val ? String(val).slice(0, 10) : '—');

export function ReturnsCreditNoteScreen({ screen }: { screen: Screen }) {
  const searchParams = useSearchParams();
  const returnParam = searchParams?.get('returnId');

  const [rows, setRows] = useState<CreditNoteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [detail, setDetail] = useState<CreditNoteDetail | null>(null);
  const [authorizedReturns, setAuthorizedReturns] = useState<AuthorizedReturnOption[]>([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState(returnParam || '');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0, 10));
  const [vatAmount, setVatAmount] = useState('0.00');
  const [mushakNumber, setMushakNumber] = useState('');
  const [reason, setReason] = useState('Commercial consignment return credit adjustment');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadList() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api<{ data: { rows: CreditNoteRow[]; total: number } }>(`/returns/credit-notes?${params}`);
      setRows(res.data.rows);
      setTotal(res.data.total);

      // Load posted returns for the creation modal
      const retRes = await api<{ data: { rows: AuthorizedReturnOption[] } }>('/sales-sources/returns?status=posted&limit=50');
      setAuthorizedReturns(retRes.data.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load credit notes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [page, statusFilter]);

  useEffect(() => {
    if (returnParam) {
      setSelectedReturnId(returnParam);
      setShowCreateModal(true);
    }
  }, [returnParam]);

  async function view(id: string) {
    setError('');
    try {
      const res = await api<{ data: CreditNoteDetail }>(`/returns/credit-notes/${id}`);
      setDetail(res.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load credit note detail');
    }
  }

  async function handleCreateCreditNote() {
    if (!selectedReturnId) {
      setError('Please select an authorized return');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { id: string; creditNoteNumber: string } }>('/returns/credit-notes', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          returnId: selectedReturnId,
          creditDate,
          vatAmount: Number(vatAmount) || 0,
          mushakNumber: mushakNumber.trim() || undefined,
          reason: reason.trim(),
        }),
      });
      setNotice(`✓ Sales Credit Note ${res.data.creditNoteNumber} created as draft! You can now review and post it.`);
      setShowCreateModal(false);
      await loadList();
      await view(res.data.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create credit note');
    } finally {
      setBusy(false);
    }
  }

  async function handlePostCreditNote(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/returns/credit-notes/${id}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setNotice('✓ Sales Credit Note approved and posted! Accounting journal entry generated (reversing AR & Sales Return).');
      await loadList();
      if (detail?.id === id) await view(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post credit note');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(id: string, cnNumber: string) {
    setBusy(true);
    setError('');
    try {
      const blob = await apiFile(`/returns/credit-notes/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Sales-Credit-Note-${cnNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download credit note PDF');
    } finally {
      setBusy(false);
    }
  }

  // KPI calculations
  const draftCount = rows.filter(r => r.status === 'draft').length;
  const postedCount = rows.filter(r => r.status === 'posted').length;
  const totalCreditAmount = rows.reduce((sum, r) => sum + Number(r.total_credit_amount || 0), 0);
  const totalSettledAmount = rows.reduce((sum, r) => sum + Number(r.settled_amount || 0), 0);

  const renderStatusPill = (st: string) => {
    switch (st) {
      case 'posted':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CheckCircle2 size={12} /> Posted &amp; Active
          </span>
        );
      case 'void':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <XCircle size={12} /> Voided
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Clock size={12} /> Draft
          </span>
        );
    }
  };

  return (
    <>
      {/* Header */}
      <div className="page-heading" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={24} color="#2563eb" /> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            National Board of Revenue (NBR) compliant Sales Credit Notes (Mushak-6.7), ledger reversals, and customer balance adjustments.
          </p>
        </div>
        <div className="button-row" style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Create Credit Note</span>
          </button>
          <Link
            className="btn"
            href="/returns-claims/refund-and-replacement-register"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Settlement Register</span>
            <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => void loadList()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* KPI Cards */}
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
            borderLeft: '4px solid #3b82f6',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>
            📜 Total Credit Notes
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>{total}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Registered credit vouchers</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #10b981',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            ✓ Posted &amp; Active
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>{postedCount}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Legally posted to AR ledger</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #f59e0b',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            ⏳ Draft Notes
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>{draftCount}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Awaiting accounts sign-off</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #6366f1',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
            BDT Total Credit Value (Page)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#312e81', marginTop: '4px' }}>
            {money(totalCreditAmount)} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Settled: {money(totalSettledAmount)} BDT
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section
        className="panel"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--surface)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search CN #, customer, return #..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void loadList();
            }}
          />
        </div>

        <select
          className="input"
          style={{ width: 170 }}
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted &amp; Active</option>
          <option value="void">Void</option>
        </select>

        <input
          className="input"
          type="date"
          style={{ width: 150 }}
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          title="From Date"
        />

        <input
          className="input"
          type="date"
          style={{ width: 150 }}
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          title="To Date"
        />

        <button
          className="btn btn-primary"
          onClick={() => void loadList()}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Filter size={15} />
          <span>Filter</span>
        </button>

        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          Showing {rows.length} of {total} credit notes
        </span>
      </section>

      {/* Credit Notes Table */}
      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '40px' }}>
          Loading credit notes…
        </div>
      ) : (
        <div className="panel table-wrap" style={{ borderRadius: 12, marginBottom: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Credit Note #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Return #</th>
                <th>Original Invoice</th>
                <th>Lines</th>
                <th style={{ textAlign: 'right' }}>Total Credit</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong style={{ color: '#1e3a8a', fontFamily: 'monospace' }}>
                        {row.credit_note_number}
                      </strong>
                      {row.mushak_number && (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.mushak_number}</div>
                      )}
                    </td>
                    <td style={{ color: '#64748b' }}>{date(row.credit_date)}</td>
                    <td>
                      <div>
                        <strong>{row.customer_name}</strong>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                          {row.customer_type}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#2563eb' }}>
                        {row.return_number}
                      </span>
                    </td>
                    <td>
                      {row.invoice_number ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.invoice_number}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>Unreferenced</span>
                      )}
                    </td>
                    <td>{row.line_count || 1} titles</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {money(row.total_credit_amount)} BDT
                    </td>
                    <td>{renderStatusPill(row.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="button-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => void view(row.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} /> View
                        </button>
                        {row.status === 'draft' && (
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy}
                            onClick={() => void handlePostCreditNote(row.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <CheckCircle2 size={13} /> Post
                          </button>
                        )}
                        <button
                          className="btn btn-sm"
                          onClick={() => void downloadPdf(row.id, row.credit_note_number)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Download size={13} /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="empty" style={{ textAlign: 'center', padding: '36px' }}>
                    No sales credit notes recorded. Create one from an authorized return above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Total {total} credit notes · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
        </span>
        <div className="button-row" style={{ display: 'flex', gap: 8 }}>
          <button className="btn" disabled={page === 0} onClick={() => setPage(c => c - 1)}>
            Previous
          </button>
          <button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(c => c + 1)}>
            Next
          </button>
        </div>
      </div>

      {/* Create Credit Note Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            style={{
              width: 'min(680px, 94vw)',
              borderRadius: 16,
              padding: 24,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--line, #e2e8f0)',
                paddingBottom: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Generate Sales Credit Note (Mushak-6.7)
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  Issue an official credit note from an authorized customer return to adjust accounts receivable.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowCreateModal(false)}
                style={{ padding: '6px 12px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              <label className="field">
                <span>Select Authorized Return Source</span>
                <select
                  className="input"
                  required
                  value={selectedReturnId}
                  onChange={e => setSelectedReturnId(e.target.value)}
                >
                  <option value="">Select an authorized return…</option>
                  {authorizedReturns.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.return_number} · {r.customer_name} ({r.requested_quantity} copies, {money(r.proposed_credit)} BDT)
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  <span>Credit Issue Date</span>
                  <input
                    className="input"
                    type="date"
                    required
                    value={creditDate}
                    onChange={e => setCreditDate(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>VAT Adjustment (BDT)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={vatAmount}
                    onChange={e => setVatAmount(e.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>NBR Mushak Number / Reference</span>
                <input
                  className="input"
                  placeholder="e.g. MUSHAK-6.7-2026-0042 (leave empty for auto-generated)"
                  value={mushakNumber}
                  onChange={e => setMushakNumber(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Reason / Commercial Description</span>
                <textarea
                  className="input"
                  rows={2}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || !selectedReturnId}
                onClick={() => void handleCreateCreditNote()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircle2 size={16} />
                <span>{busy ? 'Generating…' : 'Generate Credit Note Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Detail Modal */}
      {detail && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            style={{
              width: 'min(820px, 94vw)',
              borderRadius: 16,
              padding: 24,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--line, #e2e8f0)',
                paddingBottom: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Credit Note: {detail.credit_note_number}
                  </h2>
                  {renderStatusPill(detail.status)}
                </div>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  Issued on {date(detail.credit_date)} · {detail.mushak_number || 'NBR MUSHAK 6.7'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void downloadPdf(detail.id, detail.credit_note_number)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Download size={13} /> PDF
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDetail(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Context Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Customer
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {detail.customer_name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                  {detail.customer_type}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Source Return
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                  {detail.return_number}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Return Date: {date(detail.return_date)}</div>
              </div>

              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Original Invoice
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {detail.invoice_number || 'Direct/Manual'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Date: {date(detail.invoice_date)}</div>
              </div>

              <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 11, color: '#1d4ed8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Credit Amount
                </span>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e3a8a', marginTop: 4 }}>
                  {money(detail.total_credit_amount)} BDT
                </div>
                <div style={{ fontSize: 11, color: '#3b82f6' }}>VAT Included: {money(detail.vat_amount)} BDT</div>
              </div>
            </div>

            {/* Itemized Lines */}
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
              Itemized Return Titles &amp; Financial Adjustment
            </h3>

            <div className="table-wrap" style={{ borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th style={{ textAlign: 'right' }}>Returned Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Net Rate / Copy</th>
                    <th style={{ textAlign: 'right' }}>Line Total (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines?.map(line => (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.book_title}</strong>
                        {line.edition_code && (
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Edition: {line.edition_code}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                        {line.quantity} pcs
                      </td>
                      <td style={{ textAlign: 'right' }}>{money(line.unit_price)}</td>
                      <td style={{ textAlign: 'right' }}>{money(line.net_unit_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {money(line.line_total)} BDT
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Settlements History */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: '#0f172a' }}>
                Settlement History ({detail.settlements?.length || 0})
              </h3>
              {detail.settlements?.length ? (
                <div className="table-wrap" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Settlement #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.settlements.map(s => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.settlement_number}</strong>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{s.settlement_type.replaceAll('_', ' ')}</td>
                          <td>{date(s.created_at)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(s.amount)} BDT</td>
                          <td>
                            <span style={{ color: '#059669', fontWeight: 600 }}>✓ Completed</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  This credit note balance has not been drawn down yet. It is available on the customer&apos;s ledger.
                </p>
              )}
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {detail.status === 'draft' && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void handlePostCreditNote(detail.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle2 size={15} />
                  <span>Approve &amp; Post Credit Note</span>
                </button>
              )}
              {detail.status === 'posted' && (
                <Link
                  className="btn btn-primary"
                  href={`/returns-claims/refund-and-replacement-register?creditNoteId=${detail.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Wallet size={15} />
                  <span>Settle (Refund / Replacement)</span>
                </Link>
              )}
              <button className="btn" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
