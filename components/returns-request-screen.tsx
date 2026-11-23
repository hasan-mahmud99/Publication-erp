"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = {
  id: string;
  return_number: string;
  return_date: string;
  status: string;
  created_by: string;
  customer_name: string;
  customer_type: string;
  invoice_number: string | null;
  sales_channel: string | null;
  requested_quantity: string;
  proposed_credit: string;
  received_quantity: string;
  pending_receipt_quantity: string;
  receipt_status: string;
  financial_status: string;
};

type Detail = {
  id: string;
  return_number: string;
  return_date: string;
  reason: string | null;
  evidence_reference: string | null;
  rejection_reason: string | null;
  status: string;
  customer_name: string;
  invoice_number: string | null;
  created_by: string;
  lines: Array<{
    id: string;
    book_title: string;
    quantity: number;
    sold_quantity: number;
    unit_net_receipt: string;
    net_refund_amount: string;
  }>;
};

const money = (val: unknown) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (val: string | null | undefined) => (val ? String(val).slice(0, 10) : '—');

export function ReturnsRequestScreen({ screen }: { screen: Screen }) {
  const approvalQueue = screen.title === 'Return Approval Queue';
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(approvalQueue ? 'requested' : '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedDates, setAppliedDates] = useState({ fromDate: '', toDate: '' });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [userId, setUserId] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  async function load() {
    const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
    if (search) params.set('q', search);
    if (approvalQueue) params.set('status', 'requested');
    else if (status) params.set('status', status);
    if (appliedDates.fromDate) params.set('fromDate', appliedDates.fromDate);
    if (appliedDates.toDate) params.set('toDate', appliedDates.toDate);
    const result = await api<{ data: { rows: Row[]; total: number } }>(`/sales-sources/returns?${params}`);
    setRows(result.data.rows);
    setTotal(result.data.total);
  }

  useEffect(() => {
    void api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me')
      .then(result => {
        setUserId(result.data.userId);
        setCanApprove(result.data.role === 'Owner' || result.data.permissions.includes('sales.approve'));
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load permissions'));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void load()
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load return requests');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, search, status, appliedDates, approvalQueue]);

  function applyFilters() {
    if (fromDate && toDate && fromDate > toDate) {
      setError('From date must not be after to date');
      return;
    }
    setError('');
    setPage(0);
    setSearch(query.trim());
    setAppliedDates({ fromDate, toDate });
  }

  async function view(id: string) {
    setError('');
    try {
      setDetail((await api<{ data: Detail }>(`/sales-sources/returns/${id}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load return detail');
    }
  }

  async function authorize(row: Row) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/sales-sources/returns/${row.id}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setNotice(`✓ Return request ${row.return_number} authorized successfully. Physical warehouse inspection is now unlocked.`);
      await load();
      if (detail?.id === row.id) await view(row.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not authorize return source');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejecting || rejectionReason.trim().length < 10) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/sales-sources/returns/${rejecting.id}/reject`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      setNotice(`✓ Return request ${rejecting.return_number} rejected. Reason logged for audit.`);
      if (detail?.id === rejecting.id) await view(rejecting.id);
      setRejecting(null);
      setRejectionReason('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reject return source');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (status) params.set('status', status);
      if (appliedDates.fromDate) params.set('fromDate', appliedDates.fromDate);
      if (appliedDates.toDate) params.set('toDate', appliedDates.toDate);
      const blob = await apiFile(`/sales-sources/returns/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales-return-sources.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export return requests');
    } finally {
      setBusy(false);
    }
  }

  // KPI Calculations
  const requestedCount = rows.filter(r => r.status === 'requested').length;
  const postedCount = rows.filter(r => r.status === 'posted').length;
  const totalProposedCredit = rows.reduce((sum, r) => sum + Number(r.proposed_credit || 0), 0);
  const totalRequestedCopies = rows.reduce((sum, r) => sum + Number(r.requested_quantity || 0), 0);

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
            <CheckCircle2 size={12} /> Authorized
          </span>
        );
      case 'rejected':
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
            <XCircle size={12} /> Rejected
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
              background: '#fffbeb',
              color: '#92400e',
              border: '1px solid #fde68a',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Clock size={12} /> Requested
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
            <RotateCcw size={24} color="#2563eb" /> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {approvalQueue
              ? 'Review and authorize commercial book returns against posted sales invoices and return limits.'
              : 'Central register of referenced Sales return requests, gate receipt status, and financial credit flow.'}
          </p>
        </div>
        <div className="button-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!approvalQueue && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void exportCsv()}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}
          <Link
            className="btn btn-primary"
            href="/returns-claims/create-return-request"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Create Return Request</span>
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
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
            📦 Total Return Requests
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>{total}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>All recorded return requests</div>
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
            ⏳ Awaiting Authorization
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {requestedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Pending sales reviewer sign-off</div>
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
            ✓ Authorized Return Sources
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>{postedCount}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Approved for warehouse receipt</div>
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
            BDT Proposed Credit (Page)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#312e81', marginTop: '4px' }}>
            {money(totalProposedCredit)} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {totalRequestedCopies} total return copies
          </div>
        </div>
      </div>

      {/* Reject Reason Modal / Box */}
      {rejecting && (
        <section
          className="panel"
          style={{
            padding: '24px',
            marginBottom: '20px',
            border: '1.5px solid #fecaca',
            background: '#fff7f7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={20} color="#dc2626" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#991b1b' }}>
              Reject Return Request: {rejecting.return_number}
            </h2>
          </div>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
            Please record why this return cannot proceed (e.g., return window expired, books not purchased from
            publisher, or contract return limit exceeded).
          </p>
          <label className="field" style={{ marginBottom: 16 }}>
            <span>Mandatory Rejection Reason (min 10 characters)</span>
            <textarea
              className="input"
              rows={3}
              value={rejectionReason}
              maxLength={1000}
              placeholder="State clear operational / commercial justification for rejecting this request..."
              onChange={event => setRejectionReason(event.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn"
              onClick={() => {
                setRejecting(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </button>
            <button
              className="btn"
              style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
              disabled={busy || rejectionReason.trim().length < 10}
              onClick={() => void reject()}
            >
              Confirm Rejection
            </button>
          </div>
        </section>
      )}

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
            placeholder="Search return #, customer, or invoice..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') applyFilters();
            }}
          />
        </div>

        {!approvalQueue && (
          <select
            className="input"
            style={{ width: 170 }}
            value={status}
            onChange={event => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="posted">Authorized</option>
            <option value="rejected">Rejected</option>
          </select>
        )}

        <input
          className="input"
          type="date"
          style={{ width: 150 }}
          value={fromDate}
          onChange={event => setFromDate(event.target.value)}
          title="From Date"
        />

        <input
          className="input"
          type="date"
          style={{ width: 150 }}
          value={toDate}
          onChange={event => setToDate(event.target.value)}
          title="To Date"
        />

        <button
          className="btn btn-primary"
          onClick={applyFilters}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Filter size={15} />
          <span>Filter</span>
        </button>

        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          Showing {rows.length} of {total} records
        </span>
      </section>

      {/* Return Requests Table */}
      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '40px' }}>
          Loading return requests…
        </div>
      ) : (
        <div className="panel table-wrap" style={{ borderRadius: 12, marginBottom: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>Date</th>
                <th>Customer / Dealer</th>
                <th>Source Invoice</th>
                <th style={{ textAlign: 'right' }}>Requested</th>
                <th style={{ textAlign: 'right' }}>Proposed Credit</th>
                <th>Authorization</th>
                <th>Physical Receipt</th>
                <th>Financial Flow</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong style={{ color: '#1e3a8a', fontFamily: 'monospace' }}>{row.return_number}</strong>
                    </td>
                    <td style={{ color: '#64748b' }}>{date(row.return_date)}</td>
                    <td>
                      <div>
                        <strong>{row.customer_name}</strong>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                          {row.customer_type} {row.sales_channel ? `· ${row.sales_channel}` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.invoice_number ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f172a' }}>
                          {row.invoice_number}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>Unreferenced</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.requested_quantity} pcs</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {money(row.proposed_credit)} BDT
                    </td>
                    <td>{renderStatusPill(row.status)}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: row.receipt_status === 'fully_received' ? '#ecfdf5' : '#f1f5f9',
                          color: row.receipt_status === 'fully_received' ? '#065f46' : '#475569',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      >
                        {row.receipt_status.replaceAll('_', ' ')} ({row.received_quantity} rcvd)
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: row.financial_status === 'credit_note_issued' ? '#eff6ff' : '#f8fafc',
                          color: row.financial_status === 'credit_note_issued' ? '#1d4ed8' : '#64748b',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      >
                        {row.financial_status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="button-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => void view(row.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} /> View
                        </button>
                        {row.status === 'requested' && canApprove && (
                          <>
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={busy}
                              onClick={() => void authorize(row)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <CheckCircle2 size={13} /> Authorize
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ color: '#dc2626' }}
                              disabled={busy}
                              onClick={() => {
                                setRejecting(row);
                                setRejectionReason('');
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="empty" style={{ textAlign: 'center', padding: '36px' }}>
                    No return requests found matching these filters.
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
          Total {total} requests · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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

      {/* Return Request Detail Drawer / Modal */}
      {detail && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            style={{
              width: 'min(800px, 94vw)',
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
                    Return Request: {detail.return_number}
                  </h2>
                  {renderStatusPill(detail.status)}
                </div>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  Created on {date(detail.return_date)} for {detail.customer_name}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setDetail(null)}
                style={{ padding: '6px 12px' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Context Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Source Invoice
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {detail.invoice_number || 'Direct/Unreferenced'}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Evidence / Challan
                </span>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {detail.evidence_reference || 'None recorded'}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Return Reason
                </span>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 4, fontWeight: 500 }}>
                  {detail.reason || 'General return'}
                </div>
              </div>
            </div>

            {/* Itemized Books Table */}
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
              Itemized Return Titles ({detail.lines?.length || 0})
            </h3>
            <div className="table-wrap" style={{ borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Book Title</th>
                    <th style={{ textAlign: 'right' }}>Sold Qty</th>
                    <th style={{ textAlign: 'right' }}>Return Qty</th>
                    <th style={{ textAlign: 'right' }}>Net Receipt / Copy</th>
                    <th style={{ textAlign: 'right' }}>Refund Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines?.map(line => (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.book_title}</strong>
                      </td>
                      <td style={{ textAlign: 'right', color: '#64748b' }}>{line.sold_quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{line.quantity} pcs</td>
                      <td style={{ textAlign: 'right' }}>{money(line.unit_net_receipt)} BDT</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {money(line.net_refund_amount)} BDT
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rejection Note if Rejected */}
            {detail.status === 'rejected' && detail.rejection_reason && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                <strong>Rejection Reason:</strong> {detail.rejection_reason}
              </div>
            )}

            {/* Actions in Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {detail.status === 'posted' && (
                <Link
                  className="btn btn-primary"
                  href={`/returns-claims/sales-credit-note?returnId=${detail.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileText size={15} />
                  <span>Generate Credit Note Draft</span>
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
