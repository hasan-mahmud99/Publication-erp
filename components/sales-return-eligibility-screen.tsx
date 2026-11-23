"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  HelpCircle,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Invoice = { id: string; invoice_number: string };
type RecentInvoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  sales_channel: string;
  quantity: number;
  total_amount: string;
  currency_code: string;
  status: string;
  line_count?: number;
};
type Eligibility = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  currency_code: string;
  lines: Array<{
    invoice_line_id: string;
    book_title: string;
    sold_quantity: number;
    claimed_quantity: number;
    eligible_quantity: number;
    unit_net_receipt: string;
    sale_type: string;
  }>;
};

const CHANNEL_OPTIONS = [
  { value: '', label: 'All Channels' },
  { value: 'bookstore', label: 'Bookstore' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'institution', label: 'Institution' },
  { value: 'online', label: 'Online / eCommerce' },
  { value: 'direct', label: 'Direct' },
  { value: 'fair', label: 'Book Fair' },
];

const REASON_OPTIONS = [
  { value: 'unsold_consignment', label: 'Unsold Academic / Consignment Stock Return' },
  { value: 'transit_damage', label: 'Transit / Courier Moisture Damage' },
  { value: 'printing_defect', label: 'Printing / Binding Defect' },
  { value: 'wrong_title_shipped', label: 'Incorrect Title or Edition Shipped' },
  { value: 'customer_cancellation', label: 'Customer Order Cancellation' },
  { value: 'other', label: 'Other Documented Reason' },
];

const money = (val: unknown) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (val: string | null | undefined) => (val ? String(val).slice(0, 10) : '—');

const getChannelBadge = (ch: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    bookstore: { bg: '#ecfdf5', color: '#047857', label: 'Bookstore' },
    wholesale: { bg: '#f3e8ff', color: '#7e22ce', label: 'Wholesale' },
    institution: { bg: '#e0f2fe', color: '#0369a1', label: 'Institution' },
    online: { bg: '#eff6ff', color: '#1d4ed8', label: 'Online' },
    direct: { bg: '#fef3c7', color: '#b45309', label: 'Direct' },
    fair: { bg: '#fce7f3', color: '#be185d', label: 'Book Fair' },
  };
  const match = map[ch?.toLowerCase()] || { bg: '#f1f5f9', color: '#475569', label: ch || 'General' };
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: match.bg,
        color: match.color,
        textTransform: 'capitalize',
        display: 'inline-block',
      }}
    >
      {match.label}
    </span>
  );
};

export function SalesReturnEligibilityScreen({ screen }: { screen: Screen }) {
  const [number, setNumber] = useState('');
  const [result, setResult] = useState<Eligibility | null>(null);
  const [returnNumber, setReturnNumber] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reasonCategory, setReasonCategory] = useState('unsold_consignment');
  const [reasonDetails, setReasonDetails] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [requested, setRequested] = useState<Record<string, { quantity: number; refund: string }>>({});
  const [canManage, setCanManage] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Recent Sales Invoices selector state
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [totalInvoicesCount, setTotalInvoicesCount] = useState(0);

  async function loadRecentInvoices(customParams?: {
    q?: string;
    channel?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    setInvoicesLoading(true);
    try {
      const q = customParams?.q !== undefined ? customParams.q : filterQuery;
      const channel = customParams?.channel !== undefined ? customParams.channel : filterChannel;
      const fromDate = customParams?.fromDate !== undefined ? customParams.fromDate : filterFromDate;
      const toDate = customParams?.toDate !== undefined ? customParams.toDate : filterToDate;

      const params = new URLSearchParams({
        status: 'posted',
        limit: '20',
      });
      if (q.trim()) params.append('q', q.trim());
      if (channel) params.append('channel', channel);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const res = await api<{ data: { rows: RecentInvoice[]; total: number } }>(
        `/sales-sources/invoices?${params.toString()}`
      );
      setInvoices(res.data?.rows || []);
      setTotalInvoicesCount(res.data?.total || 0);
    } catch (err) {
      console.error('Could not load recent invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  }

  useEffect(() => {
    void api<{ data: { role: string; permissions: string[] } }>('/auth/me')
      .then(response =>
        setCanManage(response.data.role === 'Owner' || response.data.permissions.includes('sales.manage'))
      )
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load Sales permissions'));

    // Generate auto return number
    const seq = String(Date.now()).slice(-4);
    setReturnNumber(`RET-${new Date().getFullYear()}-${seq}`);

    // Load initial recent invoices
    void loadRecentInvoices();
  }, []);

  async function lookup(targetInvoiceNumber?: string) {
    const invNum = (targetInvoiceNumber ?? number).trim();
    if (invNum.length < 2) return;
    setBusy(true);
    setError('');
    setResult(null);
    setRequested({});
    try {
      const invoice = (
        await api<{ data: Invoice }>(`/sales-sources/invoices/by-number/${encodeURIComponent(invNum)}`)
      ).data;
      const elig = (await api<{ data: Eligibility }>(`/sales-sources/returns/eligibility/${invoice.id}`)).data;
      setResult(elig);
      setNumber(invNum);

      // Initialize default quantities
      const initialReq: Record<string, { quantity: number; refund: string }> = {};
      for (const line of elig.lines) {
        initialReq[line.invoice_line_id] = { quantity: 0, refund: '0.00' };
      }
      setRequested(initialReq);

      setTimeout(() => {
        document.getElementById('return-config-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not check return eligibility for this invoice number');
    } finally {
      setBusy(false);
    }
  }

  const selected =
    result?.lines
      .filter(line => (requested[line.invoice_line_id]?.quantity ?? 0) > 0)
      .map(line => ({
        invoiceLineId: line.invoice_line_id,
        quantity: requested[line.invoice_line_id].quantity,
        netRefundAmount: Number(requested[line.invoice_line_id].refund),
      })) ?? [];

  const fullReason = `${reasonCategory}: ${reasonDetails.trim()}`;
  const valid =
    result &&
    canManage &&
    returnNumber.trim().length >= 2 &&
    fullReason.trim().length >= 10 &&
    returnDate >= String(result.invoice_date).slice(0, 10) &&
    selected.length > 0 &&
    selected.every(line => {
      const source = result.lines.find(row => row.invoice_line_id === line.invoiceLineId)!;
      return (
        Number.isInteger(line.quantity) &&
        line.quantity > 0 &&
        line.quantity <= Number(source.eligible_quantity) &&
        Number.isFinite(line.netRefundAmount) &&
        line.netRefundAmount >= 0 &&
        line.netRefundAmount <= Number(source.unit_net_receipt) * line.quantity + 0.05
      );
    });

  async function createReturn() {
    if (!result || !valid) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = (
        await api<{ data: { return_number: string; status: string } }>('/returns/requests', {
          method: 'POST',
          body: JSON.stringify({
            invoiceId: result.id,
            returnNumber: returnNumber.trim(),
            returnDate,
            reason: fullReason,
            evidenceReference: evidenceReference.trim() || undefined,
            lines: selected,
          }),
        })
      ).data;

      setNotice(`✓ Return request ${created.return_number} submitted successfully! It is now in the Return Approval Queue.`);
      setReturnNumber(`RET-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
      setRequested({});
      setReasonDetails('');
      setEvidenceReference('');
      setResult((await api<{ data: Eligibility }>(`/sales-sources/returns/eligibility/${result.id}`)).data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request return');
    } finally {
      setBusy(false);
    }
  }

  const totalEligibleCopies = result?.lines.reduce((sum, l) => sum + Number(l.eligible_quantity || 0), 0) ?? 0;
  const totalSelectedCopies = selected.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
  const totalSelectedRefund = selected.reduce((sum, l) => sum + Number(l.netRefundAmount || 0), 0);

  return (
    <>
      {/* Header */}
      <div className="page-heading" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={24} color="#2563eb" /> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Check book return eligibility against original posted Sales Invoices and draft verified Return Requests.
          </p>
        </div>
        <div className="button-row" style={{ display: 'flex', gap: 8 }}>
          <Link
            className="btn"
            href="/returns-claims/return-request-list"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            <span>Return Request List</span>
          </Link>
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
          <div style={{ fontWeight: 600 }}>{notice}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/returns-claims/return-request-list"
              className="btn btn-sm btn-primary"
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              Authorize in Return Request List ➔
            </Link>
            <Link
              href="/returns-claims/return-inspection"
              className="btn btn-sm"
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              Gate Inspection &amp; Restock ➔
            </Link>
          </div>
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
            📋 Policy Window
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>90 Days Active</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Standard publisher consignment term</div>
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
            📚 Eligible for Return
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {result ? `${totalEligibleCopies} copies` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Remaining unreturned invoice copies</div>
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
            ✓ Selected for Return
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#312e81', marginTop: '4px' }}>
            {totalSelectedCopies} pcs
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Value: {money(totalSelectedRefund)} BDT
          </div>
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
            🔒 Inspection Guard
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>Multi-stage QC</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Restocking only after physical inspection</div>
        </div>
      </div>

      {/* Invoice Lookup & Recent Invoices Section */}
      <section className="panel" style={{ padding: '24px', borderRadius: 14, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
              Step 1: Select Original Sales Invoice
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Select an invoice from recent posted sales below, or filter by channel, customer, date, or invoice number.
            </p>
          </div>
          <button
            className="btn"
            onClick={() => void loadRecentInvoices()}
            disabled={invoicesLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Refresh recent invoices list"
          >
            <RefreshCw size={14} className={invoicesLoading ? 'animate-spin' : ''} />
            <span>Refresh Sales</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            padding: '16px',
            background: 'var(--surface, #f8fafc)',
            borderRadius: 10,
            border: '1px solid var(--line, #e2e8f0)',
            marginBottom: 16,
            alignItems: 'flex-end',
          }}
        >
          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Search Invoice / Customer</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
              <input
                className="input"
                style={{ paddingLeft: 30, fontSize: 13 }}
                placeholder="Invoice # or customer name..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void loadRecentInvoices({ q: filterQuery });
                }}
              />
            </div>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Sales Channel</span>
            <select
              className="input"
              style={{ fontSize: 13 }}
              value={filterChannel}
              onChange={e => {
                const val = e.target.value;
                setFilterChannel(val);
                void loadRecentInvoices({ channel: val });
              }}
            >
              {CHANNEL_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>From Date</span>
            <input
              type="date"
              className="input"
              style={{ fontSize: 13 }}
              value={filterFromDate}
              onChange={e => setFilterFromDate(e.target.value)}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>To Date</span>
            <input
              type="date"
              className="input"
              style={{ fontSize: 13 }}
              value={filterToDate}
              onChange={e => setFilterToDate(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
              onClick={() => void loadRecentInvoices()}
              disabled={invoicesLoading}
            >
              <Filter size={14} />
              <span>Filter</span>
            </button>
            <button
              className="btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13 }}
              onClick={() => {
                setFilterQuery('');
                setFilterChannel('');
                setFilterFromDate('');
                setFilterToDate('');
                void loadRecentInvoices({ q: '', channel: '', fromDate: '', toDate: '' });
              }}
              title="Reset all filters"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Recent Posted Sales Invoices ({invoices.length} displayed{totalInvoicesCount > invoices.length ? ` of ${totalInvoicesCount}` : ''})
            </span>
            {result && (
              <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                ✓ Currently Returning: <strong>{result.invoice_number}</strong>
              </span>
            )}
          </div>

          <div className="table-wrap" style={{ borderRadius: 10, border: '1px solid #e2e8f0', maxHeight: 360, overflowY: 'auto' }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>Invoice #</th>
                  <th style={{ width: '13%' }}>Date</th>
                  <th style={{ width: '24%' }}>Customer</th>
                  <th style={{ width: '14%' }}>Channel</th>
                  <th style={{ width: '11%', textAlign: 'right' }}>Sold Qty</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Total (BDT)</th>
                  <th style={{ width: '16%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoicesLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                      Loading recent sales invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No posted sales invoices match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => {
                    const isSelected = result?.invoice_number === inv.invoice_number || result?.id === inv.id;
                    return (
                      <tr
                        key={inv.id}
                        style={{
                          background: isSelected ? '#f0fdf4' : undefined,
                          transition: 'background 0.2s',
                        }}
                      >
                        <td>
                          <strong style={{ color: isSelected ? '#15803d' : '#0f172a' }}>
                            {inv.invoice_number}
                          </strong>
                        </td>
                        <td style={{ fontSize: 13, color: '#475569' }}>{date(inv.invoice_date)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{inv.customer_name}</div>
                        </td>
                        <td>{getChannelBadge(inv.sales_channel)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                          {inv.quantity ?? '—'} pcs
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {money(inv.total_amount)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isSelected ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                borderRadius: 6,
                                fontWeight: 600,
                                fontSize: 11.5,
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Selected</span>
                            </span>
                          ) : (
                            <button
                              className="btn btn-primary"
                              disabled={busy}
                              onClick={() => void lookup(inv.invoice_number)}
                              style={{
                                fontSize: 11.5,
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span>Select for Return</span>
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Secondary: Manual Direct Lookup */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--surface, #f8fafc)',
            borderRadius: 8,
            border: '1px solid var(--line, #e2e8f0)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Or lookup by exact Invoice Number:
          </span>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
            <input
              className="input"
              style={{ paddingLeft: 30, fontSize: 12.5 }}
              placeholder="e.g. DEMO-DASH-INV-2026-11-12..."
              value={number}
              onChange={event => setNumber(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void lookup();
              }}
            />
          </div>
          <button
            className="btn"
            disabled={busy || number.trim().length < 2}
            onClick={() => void lookup()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
          >
            <Search size={14} />
            <span>{busy ? 'Verifying...' : 'Check Invoice'}</span>
          </button>
        </div>
      </section>

      {/* Invoice Details & Lines */}
      {result && (
        <section id="return-config-section" className="panel" style={{ padding: '24px', borderRadius: 14, marginBottom: '20px' }}>
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
                Invoice: {result.invoice_number}
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                Customer: <strong>{result.customer_name}</strong> · Invoiced Date: {date(result.invoice_date)}
              </p>
            </div>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ✓ Invoiced &amp; Delivered
            </span>
          </div>

          <div className="table-wrap" style={{ borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Book Title</th>
                  <th>Sale Type</th>
                  <th style={{ textAlign: 'right' }}>Sold Qty</th>
                  <th style={{ textAlign: 'right' }}>Prior Returns</th>
                  <th style={{ textAlign: 'right' }}>Eligible Qty</th>
                  <th style={{ textAlign: 'right' }}>Net Rate / Copy</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map(line => (
                  <tr key={line.invoice_line_id}>
                    <td>
                      <strong>{line.book_title}</strong>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: '#64748b' }}>{line.sale_type}</td>
                    <td style={{ textAlign: 'right' }}>{line.sold_quantity}</td>
                    <td style={{ textAlign: 'right', color: line.claimed_quantity > 0 ? '#d97706' : '#64748b' }}>
                      {line.claimed_quantity}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      {line.eligible_quantity} pcs
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {money(line.unit_net_receipt)} {result.currency_code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step 2: Return Configuration Form */}
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 16px', color: '#0f172a' }}>
            Step 2: Configure Return Quantities &amp; Reason
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <label className="field">
              <span>Return Request Reference</span>
              <input
                className="input"
                required
                value={returnNumber}
                onChange={event => setReturnNumber(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Return Date</span>
              <input
                className="input"
                type="date"
                required
                min={String(result.invoice_date).slice(0, 10)}
                value={returnDate}
                onChange={event => setReturnDate(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Return Reason Classification</span>
              <select
                className="input"
                value={reasonCategory}
                onChange={event => setReasonCategory(event.target.value)}
              >
                {REASON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Evidence / Courier Challan #</span>
              <input
                className="input"
                placeholder="e.g. SA Paribahan Memo 4912 / Photo link"
                value={evidenceReference}
                onChange={event => setEvidenceReference(event.target.value)}
              />
            </label>
          </div>

          <label className="field" style={{ marginBottom: 20 }}>
            <span>Detailed Remarks / Justification (Min 10 characters)</span>
            <textarea
              className="input"
              rows={2}
              required
              placeholder="State condition of books, packaging, or why the return was authorized..."
              value={reasonDetails}
              onChange={event => setReasonDetails(event.target.value)}
            />
          </label>

          {/* Book-by-Book Line Input */}
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#1e293b' }}>
            Select Return Copies &amp; Proposed Net Refund
          </h3>

          <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
            {result.lines
              .filter(line => Number(line.eligible_quantity) > 0)
              .map(line => {
                const currentQty = requested[line.invoice_line_id]?.quantity ?? 0;
                const unitNet = Number(line.unit_net_receipt || 0);

                const handleQtyChange = (newQty: number) => {
                  const clamped = Math.min(Math.max(0, newQty), line.eligible_quantity);
                  const autoRefund = (clamped * unitNet).toFixed(2);
                  setRequested(c => ({
                    ...c,
                    [line.invoice_line_id]: { quantity: clamped, refund: autoRefund },
                  }));
                };

                return (
                  <div
                    key={line.invoice_line_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 2fr) minmax(130px, 1fr) minmax(160px, 1.2fr)',
                      gap: 16,
                      alignItems: 'center',
                      padding: '14px 18px',
                      background: currentQty > 0 ? '#eff6ff' : '#f8fafc',
                      borderRadius: 10,
                      border: currentQty > 0 ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>{line.book_title}</strong>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Eligible: <strong>{line.eligible_quantity} pcs</strong> · Rate: {money(unitNet)}{' '}
                        {result.currency_code}/copy
                      </div>
                    </div>

                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: 11 }}>Return Copies</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max={line.eligible_quantity}
                        step="1"
                        value={currentQty}
                        onChange={event => handleQtyChange(Number(event.target.value))}
                      />
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: 11 }}>Proposed Refund ({result.currency_code})</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max={(unitNet * currentQty + 0.05).toFixed(2)}
                        step="0.01"
                        value={requested[line.invoice_line_id]?.refund ?? '0.00'}
                        onChange={event =>
                          setRequested(c => ({
                            ...c,
                            [line.invoice_line_id]: {
                              quantity: currentQty,
                              refund: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                );
              })}
          </div>

          {/* Submit Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 16,
              borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontSize: 13, color: '#64748b' }}>Total Selected:</span>{' '}
              <strong style={{ fontSize: 16, color: '#1e3a8a' }}>{totalSelectedCopies} copies</strong>
              {' · '}
              <strong style={{ fontSize: 16, color: '#059669' }}>
                {money(totalSelectedRefund)} {result.currency_code}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link className="btn" href="/returns-claims/return-request-list">
                Cancel
              </Link>
              <button
                className="btn btn-primary"
                disabled={!valid || busy}
                onClick={() => void createReturn()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircle2 size={16} />
                <span>{busy ? 'Submitting…' : 'Submit Return Request'}</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
