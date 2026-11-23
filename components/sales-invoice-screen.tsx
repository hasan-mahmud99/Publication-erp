"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  status: string;
  sales_channel: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  currency_code: string;
  line_count: number;
  quantity: number;
  payment_status?: 'unpaid' | 'partial' | 'paid';
  payment_method?: string;
  paid_amount?: string | number;
  due_amount?: string | number;
  payment_reference?: string | null;
};

type PaymentRecord = {
  id: string;
  payment_date: string;
  payment_method: string;
  amount: string | number;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
};

type Detail = Invoice & {
  customer_code?: string;
  customer_type?: string;
  customer_phone?: string;
  customer_email?: string;
  lines: Array<{
    id: string;
    book_title: string;
    edition_code?: string | null;
    edition_number?: string | null;
    format?: string | null;
    quantity: number;
    unit_list_price: string;
    unit_net_receipt: string;
    sale_type: string;
    settlement_status: string;
  }>;
  payments?: PaymentRecord[];
};

const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function SalesInvoiceScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [channel, setChannel] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ fromDate: '', toDate: '', channel: '', paymentStatus: '' });
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [collectSuccessMsg, setCollectSuccessMsg] = useState('');

  // Payment Collection Modal State
  const [collectTarget, setCollectTarget] = useState<Invoice | Detail | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('bkash');
  const [collectDate, setCollectDate] = useState('');
  const [collectRef, setCollectRef] = useState('');
  const [collectNotes, setCollectNotes] = useState('');
  const [collectBusy, setCollectBusy] = useState(false);

  // Auto-load invoice if ?invoice=... query parameter is present in URL
  useEffect(() => {
    const invParam = new URLSearchParams(window.location.search).get('invoice');
    if (!invParam) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invParam);
    if (isUuid) {
      void view(invParam);
    } else {
      void api<{ data: Detail }>(`/sales-sources/invoices/by-number/${encodeURIComponent(invParam)}`)
        .then(res => setDetail(res.data))
        .catch(() => {});
    }
  }, []);

  // Keyboard shortcut to close popup modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (search) params.set('q', search);
      if (status) params.set('status', status);
      if (appliedFilters.paymentStatus) params.set('paymentStatus', appliedFilters.paymentStatus);
      if (appliedFilters.fromDate) params.set('fromDate', appliedFilters.fromDate);
      if (appliedFilters.toDate) params.set('toDate', appliedFilters.toDate);
      if (appliedFilters.channel) params.set('channel', appliedFilters.channel);

      const result = await api<{ data: { rows: Invoice[]; total: number } }>(`/sales-sources/invoices?${params}`);
      setRows(result.data.rows);
      setTotal(result.data.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, [page, search, status, appliedFilters]);

  function applyFilters() {
    if (fromDate && toDate && fromDate > toDate) {
      setError('From date must not be after to date');
      return;
    }
    setError('');
    setPage(0);
    setSearch(query.trim());
    setAppliedFilters({ fromDate, toDate, channel: channel.trim(), paymentStatus: paymentStatusFilter });
  }

  function openCollectModal(inv: Invoice | Detail) {
    setCollectTarget(inv);
    const due = Math.max(0, parseFloat(String(inv.due_amount ?? inv.total_amount)) || 0);
    setCollectAmount(String(due.toFixed(2)));
    setCollectMethod('bkash');
    setCollectDate(new Date().toISOString().slice(0, 10));
    setCollectRef('');
    setCollectNotes('');
  }

  async function submitPaymentCollection() {
    if (!collectTarget) return;
    const amountNum = parseFloat(collectAmount);
    const dueMax = parseFloat(String(collectTarget.due_amount ?? collectTarget.total_amount)) || 0;
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid collection amount greater than 0');
      return;
    }
    if (amountNum > dueMax + 0.01) {
      setError(`Collection amount cannot exceed outstanding due of ৳${dueMax.toFixed(2)}`);
      return;
    }

    setCollectBusy(true);
    setError('');
    try {
      const res = await api<{ data: Detail }>(`/sales-sources/invoices/${collectTarget.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: collectDate || new Date().toISOString().slice(0, 10),
          paymentMethod: collectMethod,
          amount: amountNum,
          referenceNo: collectRef.trim() || undefined,
          notes: collectNotes.trim() || undefined,
        }),
      });

      setCollectSuccessMsg(`✓ Payment of ৳${amountNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} successfully collected via ${collectMethod.toUpperCase()} and posted to GL!`);
      setTimeout(() => setCollectSuccessMsg(''), 6000);
      setCollectTarget(null);

      if (detail && detail.id === collectTarget.id) {
        setDetail(res.data);
      }
      await loadInvoices();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to record payment collection');
    } finally {
      setCollectBusy(false);
    }
  }

  async function view(id: string) {
    setError('');
    try {
      setDetail((await api<{ data: Detail }>(`/sales-sources/invoices/${id}`)).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load invoice');
    }
  }

  async function downloadInvoicePdf(id: string, invoiceNumber: string) {
    setDownloadingId(id);
    setError('');
    try {
      const blob = await apiFile(`/sales-sources/invoices/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${String(invoiceNumber || 'sales-invoice').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (status) params.set('status', status);
      if (appliedFilters.paymentStatus) params.set('paymentStatus', appliedFilters.paymentStatus);
      if (appliedFilters.fromDate) params.set('fromDate', appliedFilters.fromDate);
      if (appliedFilters.toDate) params.set('toDate', appliedFilters.toDate);
      if (appliedFilters.channel) params.set('channel', appliedFilters.channel);
      const blob = await apiFile(`/sales-sources/invoices/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales-invoice-sources.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export invoice sources');
    } finally {
      setExporting(false);
    }
  }

  const getStatusBadgeStyle = (stat: string) => {
    switch (stat) {
      case 'posted':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
      case 'draft':
        return { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };
      default:
        return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
    }
  };

  const getPaymentBadge = (pStat?: string) => {
    switch (pStat) {
      case 'paid':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'Paid in Full' };
      case 'partial':
        return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', label: 'Partial Due' };
      case 'unpaid':
      default:
        return { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5', label: 'Due / Unpaid' };
    }
  };

  const getMethodBadge = (m?: string) => {
    switch (m) {
      case 'bkash':
        return { icon: '📱', label: 'bKash Merchant', color: '#e11d48' };
      case 'nagad':
        return { icon: '📱', label: 'Nagad Merchant', color: '#ea580c' };
      case 'cash':
        return { icon: '💵', label: 'Cash in Hand', color: '#059669' };
      case 'bank_transfer':
        return { icon: '🏦', label: 'Bank (DBBL)', color: '#2563eb' };
      case 'cheque':
        return { icon: '📜', label: 'Cheque', color: '#7c3aed' };
      case 'credit':
      default:
        return { icon: '📋', label: 'Credit / Due', color: '#64748b' };
    }
  };

  const totalPosted = rows.filter(r => r.status === 'posted').length;
  const totalDraft = rows.filter(r => r.status === 'draft').length;
  const pageTotalSum = rows.reduce((acc, r) => acc + (parseFloat(r.total_amount) || 0), 0);
  const totalPaidSum = rows.reduce((acc, r) => acc + (parseFloat(String(r.paid_amount || 0)) || 0), 0);
  const totalDueSum = rows.reduce((acc, r) => acc + (parseFloat(String(r.due_amount || 0)) || 0), 0);
  const totalFullyPaidCount = rows.filter(r => r.payment_status === 'paid').length;
  const totalPendingDueCount = rows.filter(r => r.payment_status === 'unpaid' || r.payment_status === 'partial').length;

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Commercial sales invoice register and itemized book billing lines.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            disabled={exporting}
            onClick={() => void exportCsv()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📥</span>
            <span>Export Source CSV</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void loadInvoices()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {collectSuccessMsg && (
        <div className="alert-success" role="status" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{collectSuccessMsg}</span>
          <button type="button" className="btn" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={() => setCollectSuccessMsg('')}>✕ Dismiss</button>
        </div>
      )}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
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
          These records represent commercial sales invoices with real-time settlement tracking (Cash in Hand, bKash, Nagad, Bank DBBL, Cheque, and Accounts Receivable Due). Dues can be collected directly.
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
            setPaymentStatusFilter('');
            setAppliedFilters({ fromDate: '', toDate: '', channel: '', paymentStatus: '' });
            setPage(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: (status === '' && paymentStatusFilter === '') ? '4px solid #4f46e5' : '4px solid transparent',
            background: (status === '' && paymentStatusFilter === '') ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            📄 Total Invoices
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {total}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            All commercial billing records
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #0284c7',
            background: '#f0f9ff',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase' }}>
            💰 Page Billed Value
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0c4a6e', marginTop: '4px' }}>
            {pageTotalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Sum of current page total
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setPaymentStatusFilter('paid');
            setAppliedFilters(prev => ({ ...prev, paymentStatus: 'paid' }));
            setPage(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: paymentStatusFilter === 'paid' ? '4px solid #10b981' : '4px solid transparent',
            background: paymentStatusFilter === 'paid' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            🟢 Collected &amp; Paid
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {totalPaidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {totalFullyPaidCount} invoices fully settled
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setPaymentStatusFilter('unpaid');
            setAppliedFilters(prev => ({ ...prev, paymentStatus: 'unpaid' }));
            setPage(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: (paymentStatusFilter === 'unpaid' || paymentStatusFilter === 'partial') ? '4px solid #ef4444' : '4px solid transparent',
            background: (paymentStatusFilter === 'unpaid' || paymentStatusFilter === 'partial') ? '#fef2f2' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
            ⚠️ Outstanding Due
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
            {totalDueSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {totalPendingDueCount} pending dues · Click to filter
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel" style={{ padding: '20px' }}>
        {/* Filters Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
            <div style={{ display: 'flex', gap: '6px', minWidth: '220px' }}>
              <input
                className="input"
                placeholder="🔍 Search invoice or customer..."
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') applyFilters();
                }}
                style={{ fontSize: '13px' }}
              />
              <button type="button" className="btn" onClick={applyFilters}>
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
              <option value="draft">Draft</option>
              <option value="posted">Posted Source</option>
            </select>

            <select
              className="input"
              value={paymentStatusFilter}
              onChange={event => {
                setPage(0);
                setPaymentStatusFilter(event.target.value);
                setAppliedFilters(prev => ({ ...prev, paymentStatus: event.target.value }));
              }}
              style={{ fontSize: '13px', width: 'auto', fontWeight: 600 }}
            >
              <option value="">All Payments</option>
              <option value="paid">✓ Fully Paid</option>
              <option value="partial">⚡ Partial Due</option>
              <option value="unpaid">⚠️ Outstanding Due</option>
            </select>

            <input
              className="input"
              type="date"
              title="From date"
              value={fromDate}
              onChange={event => setFromDate(event.target.value)}
              style={{ fontSize: '13px', width: 'auto' }}
            />
            <input
              className="input"
              type="date"
              title="To date"
              value={toDate}
              onChange={event => setToDate(event.target.value)}
              style={{ fontSize: '13px', width: 'auto' }}
            />

            <input
              className="input"
              placeholder="Filter channel..."
              value={channel}
              maxLength={40}
              onChange={event => setChannel(event.target.value)}
              style={{ fontSize: '13px', width: '120px' }}
            />

            <button type="button" className="btn" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>

          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{rows.length}</strong> of <strong>{total}</strong> invoices
          </div>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div className="panel empty" style={{ textAlign: 'center', padding: '32px' }}>
            Loading invoices...
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map(row => {
                    const badge = getStatusBadgeStyle(row.status);
                    return (
                      <tr key={row.id}>
                        <td>
                          <code
                            style={{
                              fontSize: '12px',
                              background: '#f1f5f9',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              color: '#1e293b',
                            }}
                          >
                            {row.invoice_number}
                          </code>
                        </td>
                        <td>{String(row.invoice_date).slice(0, 10)}</td>
                        <td>
                          <strong>{row.customer_name}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '12px',
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: '#475569',
                            }}
                          >
                            {row.sales_channel}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const mb = getMethodBadge(row.payment_method);
                            return (
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  background: '#f8fafc',
                                  padding: '3px 7px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  color: mb.color,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>{mb.icon}</span>
                                <span>{mb.label}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>
                            {parseFloat(row.total_amount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            {row.currency_code}
                          </strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            ৳{parseFloat(String(row.paid_amount || 0)).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {(() => {
                            const due = parseFloat(String(row.due_amount || 0));
                            return (
                              <span style={{ color: due > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                ৳{due.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          {(() => {
                            const pb = getPaymentBadge(row.payment_status);
                            return (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: pb.bg,
                                  color: pb.text,
                                  border: `1px solid ${pb.border}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {pb.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => void view(row.id)}
                            title="View full invoice details popup"
                          >
                            👁️ View
                          </button>
                          {parseFloat(String(row.due_amount || 0)) > 0.005 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              style={{ marginLeft: '6px', background: '#059669', borderColor: '#059669' }}
                              onClick={() => openCollectModal(row)}
                              title="Record payment collection against due"
                            >
                              💳 Collect
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ marginLeft: '6px' }}
                            disabled={downloadingId === row.id}
                            onClick={() => void downloadInvoicePdf(row.id, row.invoice_number)}
                            title="Download invoice PDF"
                          >
                            {downloadingId === row.id ? '⏳' : '📄 PDF'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="empty" style={{ textAlign: 'center', padding: '32px' }}>
                      No invoice sources match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Showing {rows.length ? page * 25 + 1 : 0} to {Math.min((page + 1) * 25, total)} of {total} invoice sources · Page {page + 1}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={page === 0}
              onClick={() => setPage(current => current - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={(page + 1) * 25 >= total}
              onClick={() => setPage(current => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Detail Pop-up Modal Dialog */}
      {detail && (() => {
        const badge = getStatusBadgeStyle(detail.status);
        const totalQty = (detail.lines || []).reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
        const grossTotal = (detail.lines || []).reduce((sum, l) => sum + (parseFloat(l.unit_list_price) || 0) * (Number(l.quantity) || 0), 0);
        const netTotal = parseFloat(detail.total_amount) || 0;
        const discountTotal = Math.max(0, grossTotal - (parseFloat(detail.subtotal) || netTotal));

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-invoice-title"
            onClick={e => {
              if (e.target === e.currentTarget) setDetail(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                maxWidth: '920px',
                width: '100%',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden',
              }}
            >
              {/* Sticky Modal Header */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <h2 id="modal-invoice-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Commercial Invoice {detail.invoice_number}
                  </h2>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {human(detail.status)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={downloadingId === detail.id}
                    onClick={() => void downloadInvoicePdf(detail.id, detail.invoice_number)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{downloadingId === detail.id ? '⏳' : '📥'}</span>
                    <span>{downloadingId === detail.id ? 'Generating PDF...' : 'Download Invoice (PDF)'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setDetail(null)}
                    title="Close (Esc)"
                    style={{ padding: '6px 12px', fontWeight: 600 }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Whom to sell / Customer & Billing Info Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                    padding: '16px 20px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      👤 Whom To Sell (Billed Customer)
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                      {detail.customer_name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {detail.customer_code && (
                        <span style={{ fontSize: '12px', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Code: {detail.customer_code}
                        </span>
                      )}
                      {detail.customer_type && (
                        <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>
                          {detail.customer_type}
                        </span>
                      )}
                    </div>
                    {(detail.customer_phone || detail.customer_email) && (
                      <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '8px' }}>
                        {detail.customer_phone && <div>📞 {detail.customer_phone}</div>}
                        {detail.customer_email && <div>✉️ {detail.customer_email}</div>}
                      </div>
                    )}
                  </div>

                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📋 Invoice Details & Channel
                    </div>
                    <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '13px' }}>
                      <span className="muted">Invoice Date:</span>
                      <strong>{String(detail.invoice_date).slice(0, 10)}</strong>

                      <span className="muted">Sales Channel:</span>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#2563eb' }}>
                        {detail.sales_channel}
                      </span>

                      <span className="muted">Currency:</span>
                      <strong>{detail.currency_code} (Bangladeshi Taka)</strong>

                      {detail.status === 'posted' && (
                        <>
                          <span className="muted">Report Status:</span>
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            ✓ Posted to Sales & Returns Reports
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment & Due Settlement Status Banner */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '8px',
                    background: (parseFloat(String(detail.due_amount || 0)) > 0.005) ? '#fffbeb' : '#ecfdf5',
                    border: (parseFloat(String(detail.due_amount || 0)) > 0.005) ? '1px solid #fde68a' : '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '32px' }}>
                      {detail.payment_method === 'bkash' ? '📱' :
                       detail.payment_method === 'nagad' ? '📱' :
                       detail.payment_method === 'cash' ? '💵' :
                       detail.payment_method === 'bank_transfer' ? '🏦' :
                       detail.payment_method === 'cheque' ? '📜' : '📋'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                          Settlement Method: {String(detail.payment_method || 'credit').toUpperCase().replace('_', ' ')}
                        </span>
                        {(() => {
                          const pb = getPaymentBadge(detail.payment_status);
                          return (
                            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: pb.bg, color: pb.text, border: `1px solid ${pb.border}` }}>
                              {pb.label}
                            </span>
                          );
                        })()}
                      </div>
                      {detail.payment_reference && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Ref / TrxID: <strong>{detail.payment_reference}</strong>
                        </div>
                      )}
                      <div style={{ fontSize: '13px', marginTop: '4px', color: '#334155' }}>
                        Billed Total: <strong>৳{parseFloat(detail.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> |
                        Collected Paid: <strong style={{ color: '#059669' }}>৳{parseFloat(String(detail.paid_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> |
                        Remaining Due: <strong style={{ color: parseFloat(String(detail.due_amount || 0)) > 0.005 ? '#dc2626' : '#059669' }}>৳{parseFloat(String(detail.due_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    {parseFloat(String(detail.due_amount || 0)) > 0.005 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => openCollectModal(detail)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669', padding: '8px 16px', fontWeight: 600 }}
                      >
                        <span>💳</span>
                        <span>Record Payment / Collect Due</span>
                      </button>
                    ) : (
                      <span style={{ color: '#15803d', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: '#dcfce7', padding: '6px 12px', borderRadius: '6px', border: '1px solid #86efac' }}>
                        <span>✓</span> <span>All Dues Fully Settled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* KPI Financial Overview Cards */}
                <div className="stat-grid" style={{ margin: 0 }}>
                  <div className="panel stat" style={{ background: '#f8fafc', padding: '14px 18px' }}>
                    <div className="stat-label">Total Volume</div>
                    <div className="stat-value">{totalQty} copies</div>
                    <span className="muted" style={{ fontSize: '12px' }}>{(detail.lines || []).length} book titles</span>
                  </div>
                  <div className="panel stat" style={{ background: '#f8fafc', padding: '14px 18px' }}>
                    <div className="stat-label">Catalog Gross</div>
                    <div className="stat-value">{grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</div>
                  </div>
                  <div className="panel stat" style={{ background: '#f8fafc', padding: '14px 18px' }}>
                    <div className="stat-label">Commercial Discount</div>
                    <div className="stat-value" style={{ color: '#d97706' }}>
                      - {discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                    </div>
                  </div>
                  <div className="panel stat" style={{ background: '#f8fafc', padding: '14px 18px' }}>
                    <div className="stat-label">Net Payable Total</div>
                    <div className="stat-value" style={{ color: '#16a34a' }}>
                      {parseFloat(detail.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                    </div>
                  </div>
                </div>

                {/* Book Items Breakdown Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, textTransform: 'uppercase', color: '#334155' }}>
                      📚 Billed Book Editions ({(detail.lines || []).length})
                    </h3>
                    <span className="muted" style={{ fontSize: '12px' }}>
                      Amounts in {detail.currency_code}
                    </span>
                  </div>

                  <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36px' }}>#</th>
                          <th>Book Title & Edition</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>List Price</th>
                          <th style={{ textAlign: 'right' }}>Discount</th>
                          <th style={{ textAlign: 'right' }}>Net Unit Price</th>
                          <th style={{ textAlign: 'right' }}>Net Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.lines || []).map((line, idx) => {
                          const qty = Number(line.quantity) || 0;
                          const listPrice = parseFloat(line.unit_list_price) || 0;
                          const unitNet = parseFloat(line.unit_net_receipt) || listPrice;
                          const lineGross = listPrice * qty;
                          const lineNet = unitNet * qty;
                          const lineDisc = Math.max(0, lineGross - lineNet);
                          const discPct = lineGross > 0 ? (lineDisc / lineGross) * 100 : 0;

                          return (
                            <tr key={line.id || idx}>
                              <td className="muted">{idx + 1}</td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>{line.book_title}</strong>
                                <span className="muted" style={{ display: 'block', fontSize: '12px' }}>
                                  {line.edition_code || (line.format ? `Edition · ${line.format}` : 'Standard Edition')}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                              <td style={{ textAlign: 'right' }}>{listPrice.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: '#d97706' }}>
                                {discPct > 0 ? (
                                  <>
                                    {discPct.toFixed(1)}% <span className="muted" style={{ fontSize: '11px' }}>(-{lineDisc.toFixed(2)})</span>
                                  </>
                                ) : (
                                  '0%'
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>{unitNet.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <strong>{lineNet.toFixed(2)} BDT</strong>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'capitalize',
                                    background: line.settlement_status === 'settled' ? '#ecfdf5' : '#f1f5f9',
                                    color: line.settlement_status === 'settled' ? '#065f46' : '#475569',
                                  }}
                                >
                                  {line.settlement_status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Subtotal, Tax, and Grand Total Box */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '16px 20px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '420px' }}>
                    💡 Official commercial invoice issued by Publisher ERP. Revenue recognition and accounts receivable settlement are reconciled through Finance &amp; Accounting.
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Subtotal Ex-Tax: <strong>{parseFloat(detail.subtotal).toFixed(2)} BDT</strong>
                    </div>
                    {(() => {
                      const taxVal = parseFloat(detail.tax_amount || '0');
                      const subVal = parseFloat(detail.subtotal || '0');
                      const taxRate = subVal > 0 ? ((taxVal / subVal) * 100).toFixed(1) : '0.0';
                      return (
                        <div style={{ fontSize: '13px', color: taxVal > 0 ? '#b45309' : '#64748b' }}>
                          Tax / VAT {taxVal > 0 ? `(${taxRate}% Taxable)` : '(0% - Exempt Supplies)'}: <strong>{taxVal.toFixed(2)} BDT</strong>
                        </div>
                      );
                    })()}
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '4px' }}>
                      Grand Total: <span style={{ color: '#16a34a' }}>{parseFloat(detail.total_amount).toFixed(2)} {detail.currency_code}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Collection Receipts History Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, textTransform: 'uppercase', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🧾</span> Payment Collection Receipts ({detail.payments?.length || 0})
                    </h3>
                    <span className="muted" style={{ fontSize: '12px' }}>
                      Double-entry postings recorded in Cash Book &amp; General Ledger
                    </span>
                  </div>

                  {detail.payments && detail.payments.length > 0 ? (
                    <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: '36px' }}>#</th>
                            <th>Receipt Date</th>
                            <th>Payment Method</th>
                            <th style={{ textAlign: 'right' }}>Collected Amount</th>
                            <th>Reference / TrxID</th>
                            <th>Notes</th>
                            <th>Recorded At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.payments.map((p, idx) => (
                            <tr key={p.id || idx}>
                              <td className="muted">{idx + 1}</td>
                              <td><strong>{String(p.payment_date).slice(0, 10)}</strong></td>
                              <td>
                                <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, color: '#1e293b' }}>
                                  {getMethodBadge(p.payment_method).icon} {getMethodBadge(p.payment_method).label}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                ৳{parseFloat(String(p.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td><code>{p.reference_no || '—'}</code></td>
                              <td className="muted" style={{ fontSize: '12px' }}>{p.notes || '—'}</td>
                              <td className="muted" style={{ fontSize: '11px' }}>{String(p.created_at).slice(0, 19).replace('T', ' ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                      No cash or digital receipts recorded yet. This invoice is currently open on credit terms.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={downloadingId === detail.id}
                    onClick={() => void downloadInvoicePdf(detail.id, detail.invoice_number)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{downloadingId === detail.id ? '⏳' : '📥'}</span>
                    <span>Download Official PDF Invoice</span>
                  </button>
                  <Link
                    href="/reports-analytics/sales-and-returns-reports"
                    className="btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>📊</span>
                    <span>View in Sales &amp; Returns Reports</span>
                  </Link>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => setDetail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Collection Pop-up Modal */}
      {collectTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-collect-title"
          onClick={e => {
            if (e.target === e.currentTarget) setCollectTarget(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💳</span>
                <h3 id="modal-collect-title" style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Collect Due Payment: {collectTarget.invoice_number}
                </h3>
              </div>
              <button type="button" className="btn" onClick={() => setCollectTarget(null)} style={{ padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Due Summary */}
              <div style={{ padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, color: '#1e40af' }}>
                  Customer: {collectTarget.customer_name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', color: '#1e3a8a', flexWrap: 'wrap', gap: '6px' }}>
                  <span>Billed Total: ৳{parseFloat(collectTarget.total_amount).toFixed(2)}</span>
                  <span>Paid: ৳{parseFloat(String(collectTarget.paid_amount || 0)).toFixed(2)}</span>
                  <strong style={{ color: '#dc2626' }}>Outstanding Due: ৳{parseFloat(String(collectTarget.due_amount ?? collectTarget.total_amount)).toFixed(2)}</strong>
                </div>
              </div>

              {/* Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Payment Date *</span>
                  <input
                    type="date"
                    className="input"
                    value={collectDate}
                    onChange={e => setCollectDate(e.target.value)}
                    style={{ fontSize: '13px' }}
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Payment Method *</span>
                  <select
                    className="input"
                    value={collectMethod}
                    onChange={e => setCollectMethod(e.target.value)}
                    style={{ fontWeight: 600, fontSize: '13px' }}
                  >
                    <option value="bkash">📱 bKash Merchant</option>
                    <option value="nagad">📱 Nagad Merchant</option>
                    <option value="cash">💵 Cash in Hand</option>
                    <option value="bank_transfer">🏦 Bank (DBBL)</option>
                    <option value="cheque">📜 Cheque</option>
                  </select>
                </label>
              </div>

              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Collection Amount (৳) *</span>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max={parseFloat(String(collectTarget.due_amount ?? collectTarget.total_amount))}
                  step="0.01"
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}
                />
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Transaction / Cheque / Slip Ref No.</span>
                <input
                  className="input"
                  placeholder={collectMethod === 'bkash' ? 'e.g. bKash TrxID (BL991AX4)' : collectMethod === 'nagad' ? 'e.g. Nagad TrxID (NGD8821)' : 'e.g. Cheque No / Slip Ref'}
                  value={collectRef}
                  onChange={e => setCollectRef(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Notes (Optional)</span>
                <input
                  className="input"
                  placeholder="e.g. Received at Central Cash Counter"
                  value={collectNotes}
                  onChange={e => setCollectNotes(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </label>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setCollectTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={collectBusy}
                onClick={() => void submitPaymentCollection()}
                style={{ background: '#059669', borderColor: '#059669', fontWeight: 600 }}
              >
                {collectBusy ? 'Posting to GL...' : '✓ Confirm & Post Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
