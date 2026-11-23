"use client";

import { useEffect, useState, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Receipt,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  X,
  FileText,
  Building2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const today = () => new Date().toISOString().slice(0, 10);
const due = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

function renderBillStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9', color = '#475569', border = '#cbd5e1';
  if (s === 'posted') {
    bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
  } else if (s === 'approved') {
    bg = '#eff6ff'; color = '#1d4ed8'; border = '#bfdbfe';
  } else if (s === 'submitted') {
    bg = '#fffbeb'; color = '#92400e'; border = '#fde68a';
  } else if (s === 'draft') {
    bg = '#f8fafc'; color = '#64748b'; border = '#cbd5e1';
  }
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {s}
    </span>
  );
}

function renderPaymentStatusPill(status: string) {
  const s = String(status || 'unpaid').toLowerCase();
  let bg = '#fef2f2', color = '#991b1b', border = '#fecaca', label = 'Unpaid';
  if (s === 'paid') {
    bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0'; label = 'Paid';
  } else if (s === 'partially_paid' || s === 'partial') {
    bg = '#fffbeb'; color = '#92400e'; border = '#fde68a'; label = 'Partial';
  }
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        textTransform: 'uppercase',
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  );
}

export function SupplierBillScreen({ screen }: { screen: Screen }) {
  const [bills, setBills] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [receiptLines, setReceiptLines] = useState<Row[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Row | null>(null);

  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userId, setUserId] = useState('');

  // Form states
  const [poId, setPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [postingDate, setPostingDate] = useState(today());
  const [dueDate, setDueDate] = useState(due());

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canFinance = role === 'Owner' || permissions.includes('procurement.finance');
  const canApprove = role === 'Owner' || permissions.includes('procurement.approve');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [meRes, billsRes, poRes] = await Promise.all([
        api<{ data: Row }>('/auth/me'),
        api<{ data: Row[] }>('/procurement/bills'),
        api<{ data: { data: Row[] } }>('/procurement/purchase-orders?status=approved&limit=100'),
      ]);
      setRole(meRes.data.role);
      setPermissions(meRes.data.permissions || []);
      setUserId(meRes.data.userId);
      setBills(billsRes.data || []);
      setOrders(poRes.data.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load supplier bills');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function selectPo(id: string) {
    setPoId(id);
    setReceiptLines([]);
    setQuantities({});
    if (!id) return;
    try {
      const res = await api<{ data: Row[] }>(`/procurement/bills/receipt-lines/${id}`);
      setReceiptLines(res.data || []);
      const initQtys: Record<string, string> = {};
      (res.data || []).forEach(line => {
        initQtys[line.receipt_line_id] = String(line.remaining_qty || 0);
      });
      setQuantities(initQtys);
    } catch (err: any) {
      setError(err?.message || 'Could not load receipt lines');
    }
  }

  async function handleCreateBill(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const lines = Object.entries(quantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([receiptLineId, billedQty]) => ({ receiptLineId, billedQty }));

      const next = (
        await api<{ data: Row }>('/procurement/bills', {
          method: 'POST',
          body: JSON.stringify({
            purchaseOrderId: poId,
            supplierInvoiceNumber: invoiceNumber,
            invoiceDate,
            postingDate,
            dueDate,
            lines,
          }),
        })
      ).data;

      setNotice(`Supplier bill ${next.bill_number} created in draft.`);
      setShowCreateModal(false);
      setPoId('');
      setInvoiceNumber('');
      setReceiptLines([]);
      setQuantities({});
      await loadData();
      setDetail(next);
    } catch (err: any) {
      setError(err?.message || 'Could not create supplier bill');
    } finally {
      setBusy(false);
    }
  }

  async function transitionBill(action: 'submit' | 'approve' | 'post') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = (
        await api<{ data: Row }>(`/procurement/bills/${detail.id}/${action}`, {
          method: 'POST',
          body: '{}',
        })
      ).data;
      setDetail(next);
      setNotice(
        action === 'post'
          ? `Bill ${next.bill_number} posted to Accounts Payable ledger.`
          : `Bill ${next.bill_number} ${action}d.`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || `Could not ${action} bill`);
    } finally {
      setBusy(false);
    }
  }

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchSearch =
        !search ||
        b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
        b.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.supplier_invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        b.po_number?.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || b.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [bills, search, statusFilter]);

  const kpis = useMemo(() => {
    const totalBilled = bills.reduce((sum, b) => sum + Number(b.base_amount || 0), 0);
    const totalPaid = bills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
    const totalOutstanding = bills.reduce((sum, b) => sum + Number(b.outstanding_amount || 0), 0);
    const pendingApproval = bills.filter(b => b.status === 'submitted' || b.status === 'draft').length;
    return { totalBilled, totalPaid, totalOutstanding, pendingApproval };
  }, [bills]);

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Record supplier and printing bills, match against deliveries, approve AP liabilities, and schedule payments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {canFinance && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setInvoiceDate(today());
                setPostingDate(today());
                setDueDate(due());
                setShowCreateModal(true);
              }}
            >
              <Plus size={16} />
              <span>+ Record Supplier Bill</span>
            </button>
          )}
        </div>
      </div>

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

      {/* 4 Financial KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #3b82f6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Total Billed (AP)
            </span>
            <Receipt size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Across all supplier invoices</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #10b981',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Total Paid
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Settled payments to date</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #ef4444',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Outstanding Payable
            </span>
            <DollarSign size={18} color="#ef4444" />
          </div>
          <div
            className="stat-value"
            style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px', color: kpis.totalOutstanding > 0 ? '#b91c1c' : '#0f172a' }}
          >
            BDT {kpis.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Current net liabilities due</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #f59e0b',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Pending Approval
            </span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.pendingApproval}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Draft &amp; submitted bills</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 16,
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: '1 1 320px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search bill #, supplier, invoice #, PO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38 }}
            />
          </div>

          <select
            className="input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 160, height: 38 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="posted">Posted to AP</option>
          </select>
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'} on record
        </span>
      </div>

      {/* Main Table */}
      <div className="panel table-wrap" style={{ background: '#fff', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bill # &amp; Date</th>
              <th>Supplier Name</th>
              <th>Supplier Invoice #</th>
              <th>Due Date</th>
              <th>Billed Amount</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Approval</th>
              <th>Payment</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.length ? (
              filteredBills.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.bill_number}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      {String(row.invoice_date).slice(0, 10)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.supplier_name}</div>
                    {row.po_number && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>PO: {row.po_number}</div>
                    )}
                  </td>
                  <td>
                    <strong>{row.supplier_invoice_number}</strong>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5, color: '#334155' }}>
                      {String(row.due_date).slice(0, 10)}
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: '#0f172a' }}>
                      BDT {Number(row.base_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td>
                    <span style={{ color: '#15803d' }}>
                      BDT {Number(row.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: Number(row.outstanding_amount) > 0 ? '#b91c1c' : '#15803d' }}>
                      BDT {Number(row.outstanding_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td>{renderBillStatusPill(row.status)}</td>
                  <td>{renderPaymentStatusPill(row.payment_status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setDetail(row)}
                        style={{ height: 30, fontSize: 12 }}
                      >
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="empty" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No supplier bills match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Bill Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 780,
              width: '94%',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    Record Supplier Invoice (AP Bill)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Match accepted deliveries and bill quantities for accounts payable recognition.
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBill} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              <div className="catalog-form-grid" style={{ gap: 14 }}>
                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Approved Purchase Order <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <select
                    className="input"
                    required
                    value={poId}
                    onChange={e => void selectPo(e.target.value)}
                    style={{ height: 42, borderRadius: 8 }}
                  >
                    <option value="">Choose Purchase Order</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.po_number} · {o.supplier_name} (BDT {Number(o.total_amount).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Supplier Invoice Number <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    required
                    minLength={2}
                    placeholder="e.g. INV-2026-9901"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Invoice Date <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Due Date <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="date"
                    required
                    min={invoiceDate}
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>
              </div>

              {/* Receipt Lines to Match */}
              {receiptLines.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      Delivered Items &amp; Billing Quantities
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Enter quantities to invoice</span>
                  </div>
                  <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 260, overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead style={{ background: '#f8fafc' }}>
                        <tr>
                          <th>Item Description</th>
                          <th>Delivered</th>
                          <th>Already Billed</th>
                          <th>Remaining</th>
                          <th>Unit Price</th>
                          <th style={{ width: 140 }}>Bill Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptLines.map(line => (
                          <tr key={line.receipt_line_id}>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{line.item_name}</strong>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{line.item_code}</div>
                            </td>
                            <td>{line.accepted_qty}</td>
                            <td>{line.previously_billed}</td>
                            <td>
                              <strong style={{ color: '#2563eb' }}>{line.remaining_qty}</strong>
                            </td>
                            <td>BDT {Number(line.unit_cost).toFixed(2)}</td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                max={line.remaining_qty}
                                step="0.0001"
                                value={quantities[line.receipt_line_id] || '0'}
                                onChange={e =>
                                  setQuantities(prev => ({
                                    ...prev,
                                    [line.receipt_line_id]: e.target.value,
                                  }))
                                }
                                style={{ height: 34, borderRadius: 6 }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {poId && !receiptLines.length && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
                  ⚠️ This purchase order has no posted accepted deliveries available to bill.
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={busy}
                  style={{ height: 40, padding: '0 18px', borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    busy ||
                    !poId ||
                    !invoiceNumber.trim() ||
                    !Object.values(quantities).some(v => Number(v) > 0)
                  }
                  style={{ height: 40, padding: '0 20px', borderRadius: 8, gap: 6 }}
                >
                  <Plus size={16} />
                  <span>{busy ? 'Recording…' : 'Create Draft Bill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Detail Modal */}
      {detail && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 780,
              width: '94%',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                      Supplier Bill {detail.bill_number}
                    </h3>
                    {renderBillStatusPill(detail.status)}
                    {renderPaymentStatusPill(detail.payment_status)}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Supplier: <strong style={{ color: '#1e293b' }}>{detail.supplier_name}</strong> · Inv: {detail.supplier_invoice_number}
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setDetail(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Base Amount</span>
                  <strong style={{ fontSize: 17, color: '#0f172a', marginTop: 4, display: 'block' }}>
                    BDT {Number(detail.base_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Paid Amount</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: '#15803d', marginTop: 4, display: 'block' }}>
                    BDT {Number(detail.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Net Outstanding</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: Number(detail.outstanding_amount) > 0 ? '#b91c1c' : '#15803d', marginTop: 4, display: 'block' }}>
                    BDT {Number(detail.outstanding_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Bill Lines */}
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: '#1e293b' }}>
                  Itemized Billed Deliveries
                </h4>
                <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 10 }}>
                  <table className="data-table">
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th>Item Description</th>
                        <th>Accepted Qty</th>
                        <th>Billed Qty</th>
                        <th>Unit Cost</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.lines || []).length ? (
                        detail.lines.map((l: Row) => (
                          <tr key={l.id}>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{l.item_name}</strong>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{l.item_code}</div>
                            </td>
                            <td>{l.accepted_qty}</td>
                            <td>
                              <strong>{l.billed_qty}</strong>
                            </td>
                            <td>BDT {Number(l.unit_price).toFixed(2)}</td>
                            <td>
                              <strong style={{ color: '#0f172a' }}>BDT {Number(l.line_amount).toLocaleString()}</strong>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                            No bill line breakdown available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer & Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setDetail(null)}
                disabled={busy}
                style={{ height: 38, padding: '0 18px', borderRadius: 8 }}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                {canFinance && detail.status === 'draft' && detail.created_by === userId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void transitionBill('submit')}
                    style={{ height: 38, borderRadius: 8 }}
                  >
                    Submit for Approval
                  </button>
                )}

                {canApprove && detail.status === 'submitted' && detail.created_by !== userId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void transitionBill('approve')}
                    style={{ height: 38, borderRadius: 8 }}
                  >
                    Approve Matched Bill
                  </button>
                )}

                {canFinance && detail.status === 'approved' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void transitionBill('post')}
                    style={{ height: 38, borderRadius: 8 }}
                  >
                    Post GRNI to AP Ledger
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
