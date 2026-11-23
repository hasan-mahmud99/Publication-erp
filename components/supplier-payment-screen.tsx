"use client";

import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  CreditCard,
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
  Split,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;
const today = () => new Date().toISOString().slice(0, 10);

function renderRequestStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9', color = '#475569', border = '#cbd5e1';
  if (s === 'approved') {
    bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
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

function renderVoucherStatusPill(status: string) {
  const s = String(status || 'not_prepared').toLowerCase();
  let bg = '#f1f5f9', color = '#64748b', border = '#cbd5e1', label = 'Not Prepared';
  if (s === 'posted') {
    bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0'; label = 'Posted';
  } else if (s === 'draft') {
    bg = '#eff6ff'; color = '#1d4ed8'; border = '#bfdbfe'; label = 'Voucher Draft';
  } else if (s === 'reversed') {
    bg = '#fef2f2'; color = '#991b1b'; border = '#fecaca'; label = 'Reversed';
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

export function SupplierPaymentScreen({ screen }: { screen: Screen }) {
  const isAdvancePage = screen.title === 'Supplier Advance Register';
  const paymentType = isAdvancePage ? 'advance' : 'settlement';
  const queryParam = isAdvancePage ? '?type=advance' : '';

  const [payments, setPayments] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [bills, setBills] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);

  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userId, setUserId] = useState('');

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');

  // Allocation form states
  const [allocationBillId, setAllocationBillId] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const createAttempt = useRef<{ body: string; key: string } | null>(null);
  const allocationAttempt = useRef<{ body: string; key: string } | null>(null);
  const voucherAttempt = useRef<{ id: string; key: string } | null>(null);

  const canFinance = role === 'Owner' || permissions.includes('procurement.finance');
  const canApprove = role === 'Owner' || permissions.includes('procurement.approve');
  const canPostVoucher =
    role === 'Owner' || (permissions.includes('finance.read') && permissions.includes('workspace.approve'));

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [meRes, paymentsRes, suppliersRes] = await Promise.all([
        api<{ data: Row }>('/auth/me'),
        api<{ data: Row[] }>(`/procurement/payments${queryParam}`),
        api<{ data: { data: Row[] } }>('/procurement/suppliers?limit=100'),
      ]);
      setRole(meRes.data.role);
      setPermissions(meRes.data.permissions || []);
      setUserId(meRes.data.userId);
      setPayments(paymentsRes.data || []);
      setSuppliers(suppliersRes.data.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load payments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [screen.id]);

  async function openDetail(id: string) {
    try {
      const next = (await api<{ data: Row }>(`/procurement/payments/${id}`)).data;
      setDetail(next);
      setSupplierId(next.supplier_id);
      if (next.journal_status === 'posted') {
        await loadOutstandingBills(next.supplier_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not open payment detail');
    }
  }

  async function loadOutstandingBills(id: string) {
    if (!id) {
      setBills([]);
      return;
    }
    try {
      const res = await api<{ data: Row[] }>(`/procurement/payments/outstanding/${id}`);
      setBills(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load outstanding bills');
    }
  }

  async function handleCreatePayment(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = JSON.stringify({
        supplierId,
        paymentType,
        paymentDate,
        amount,
        purpose,
      });

      if (createAttempt.current?.body !== body) {
        createAttempt.current = { body, key: crypto.randomUUID() };
      }

      const next = (
        await api<{ data: Row }>('/procurement/payments', {
          method: 'POST',
          headers: { 'idempotency-key': createAttempt.current.key },
          body,
        })
      ).data;

      createAttempt.current = null;
      setNotice(`Draft ${isAdvancePage ? 'advance' : 'settlement'} request ${next.payment_number} created.`);
      setShowCreateModal(false);
      setAmount('');
      setPurpose('');
      await loadData();
      setDetail(next);
    } catch (err: any) {
      setError(err?.message || 'Could not create payment request');
    } finally {
      setBusy(false);
    }
  }

  async function transitionPayment(action: 'submit' | 'approve') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = (
        await api<{ data: Row }>(`/procurement/payments/${detail.id}/${action}`, {
          method: 'POST',
          body: '{}',
        })
      ).data;
      setDetail(next);
      setNotice(
        action === 'approve'
          ? 'Approved request prepared a draft Finance voucher. A Finance poster can now post it.'
          : 'Payment request submitted for approval.'
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || `Could not ${action} payment request`);
    } finally {
      setBusy(false);
    }
  }

  async function postFinanceVoucher() {
    if (!detail?.journal_id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const attempt =
        voucherAttempt.current?.id === detail.journal_id
          ? voucherAttempt.current!
          : { id: detail.journal_id, key: crypto.randomUUID() };
      voucherAttempt.current = attempt;

      await api(`/journal-entries/${detail.journal_id}/post`, {
        method: 'POST',
        headers: { 'idempotency-key': attempt.key },
        body: '{}',
      });
      voucherAttempt.current = null;
      setNotice('Finance voucher posted. Payment funds are now active and allocatable.');
      await openDetail(detail.id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not post voucher');
    } finally {
      setBusy(false);
    }
  }

  async function handleAllocate(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = JSON.stringify({
        paymentId: detail.id,
        billId: allocationBillId,
        amount: allocationAmount,
      });

      if (allocationAttempt.current?.body !== body) {
        allocationAttempt.current = { body, key: crypto.randomUUID() };
      }

      const next = (
        await api<{ data: Row }>('/procurement/payments/allocate', {
          method: 'POST',
          headers: { 'idempotency-key': allocationAttempt.current.key },
          body,
        })
      ).data;

      allocationAttempt.current = null;
      setNotice('Payment allocated to bill with balanced AP / prepayment journal entry.');
      setAllocationBillId('');
      setAllocationAmount('');
      setDetail(next);
      await loadOutstandingBills(next.supplier_id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not allocate payment to bill');
    } finally {
      setBusy(false);
    }
  }

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchSearch =
        !search ||
        p.payment_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.purpose?.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || p.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [payments, search, statusFilter]);

  const kpis = useMemo(() => {
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalAllocated = payments.reduce((sum, p) => sum + Number(p.allocated_amount || 0), 0);
    const totalAvailable = payments.reduce((sum, p) => sum + Number(p.available_amount || 0), 0);
    const pendingVoucher = payments.filter(p => p.status === 'approved' && p.journal_status !== 'posted').length;
    return { totalAmount, totalAllocated, totalAvailable, pendingVoucher };
  }, [payments]);

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            {isAdvancePage
              ? 'Request and authorize supplier advances, generate finance vouchers, and track unapplied credit.'
              : 'Allocate posted vendor settlements and advance payments directly against unpaid supplier bills.'}
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
                setPaymentDate(today());
                setShowCreateModal(true);
              }}
            >
              <Plus size={16} />
              <span>+ Request {isAdvancePage ? 'Advance' : 'Payment'}</span>
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
              Total {isAdvancePage ? 'Advances' : 'Payments'}
            </span>
            <Wallet size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Total disbursement requests</span>
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
              Allocated to Bills
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalAllocated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Applied to reduce AP liability</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #8b5cf6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Unapplied / Available
            </span>
            <DollarSign size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Funds ready for bill allocation</span>
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
              Pending Vouchers
            </span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.pendingVoucher}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Awaiting Finance ledger posting</span>
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
              placeholder="Search payment #, supplier, purpose..."
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
          </select>
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {filteredPayments.length} records found
        </span>
      </div>

      {/* Main Table */}
      <div className="panel table-wrap" style={{ background: '#fff', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref # &amp; Date</th>
              <th>Supplier Name</th>
              <th>Amount (BDT)</th>
              <th>Purpose &amp; Note</th>
              <th>Request Status</th>
              <th>Finance Voucher</th>
              <th>Allocated</th>
              <th>Available</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length ? (
              filteredPayments.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.payment_number}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      {String(row.payment_date).slice(0, 10)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.supplier_name}</div>
                  </td>
                  <td>
                    <strong style={{ color: '#0f172a', fontSize: 14 }}>
                      BDT {Number(row.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    <div style={{ fontSize: 12.5, color: '#334155' }}>{row.purpose}</div>
                  </td>
                  <td>{renderRequestStatusPill(row.status)}</td>
                  <td>{renderVoucherStatusPill(row.journal_status)}</td>
                  <td>
                    <span style={{ color: '#15803d' }}>
                      BDT {Number(row.allocated_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: Number(row.available_amount) > 0 ? '#8b5cf6' : '#64748b' }}>
                      BDT {Number(row.available_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => void openDetail(row.id)}
                      style={{ height: 30, fontSize: 12 }}
                    >
                      Detail &amp; Allocate
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="empty" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No payment records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Payment Modal */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 9999,
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: 620,
              width: '100%',
              backgroundColor: '#ffffff',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              border: '1px solid #cbd5e1',
              padding: 0,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 10000,
              opacity: 1,
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
                backgroundColor: '#f8fafc',
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
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    Request Supplier {isAdvancePage ? 'Advance' : 'Payment'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Generates an advance voucher request for Finance approval.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  borderRadius: 8,
                  padding: 8,
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreatePayment} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: '#ffffff', background: '#ffffff' }}>
              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  Supplier / Press <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <select
                  className="input"
                  required
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_code} · {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    Disbursement Date <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    style={{ height: 42, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
                  />
                </label>

                <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    Amount (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontWeight: 700,
                        color: '#64748b',
                        fontSize: 13,
                        pointerEvents: 'none',
                      }}
                    >
                      BDT 
                    </span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="e.g. 50000"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      style={{ height: 42, paddingLeft: 46, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </label>
              </div>

              <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  Payment Purpose / Work Reference <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <textarea
                  className="input"
                  rows={3}
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="e.g. 50% mobilization advance for 80gsm book paper purchase order PO-2026-0012..."
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  style={{ borderRadius: 8, padding: 12, resize: 'vertical', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: 13.5 }}
                />
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Minimum 10 characters explaining work order or paper supply reference.
                </span>
              </label>

              {/* Modal Actions Footer */}
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
                  style={{ height: 40, padding: '0 18px', borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !supplierId || !amount || purpose.trim().length < 10}
                  style={{ height: 40, padding: '0 20px', borderRadius: 8, gap: 6 }}
                >
                  <Plus size={16} />
                  <span>{busy ? 'Submitting…' : 'Create Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Detail & Bill Allocation Modal */}
      {detail && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 9999,
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: 780,
              width: '100%',
              backgroundColor: '#ffffff',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              border: '1px solid #cbd5e1',
              padding: 0,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 10000,
              opacity: 1,
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
                backgroundColor: '#f8fafc',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <CreditCard size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                      Payment {detail.payment_number}
                    </h3>
                    {renderRequestStatusPill(detail.status)}
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                    Supplier: <strong style={{ color: '#1e293b' }}>{detail.supplier_name}</strong> · Type: <span style={{ textTransform: 'capitalize' }}>{detail.payment_type}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  borderRadius: 8,
                  padding: 8,
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                }}
                onClick={() => setDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              {/* Quick Stats Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Total Amount</span>
                  <strong style={{ fontSize: 17, color: '#0f172a', marginTop: 4, display: 'block' }}>
                    BDT {Number(detail.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Allocated</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: '#15803d', marginTop: 4, display: 'block' }}>
                    BDT {Number(detail.allocated_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Unapplied Balance</span>
                  <strong style={{ fontSize: 17, color: '#8b5cf6', marginTop: 4, display: 'block' }}>
                    BDT {Number(detail.available_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Voucher Status</span>
                  <div style={{ marginTop: 4 }}>
                    {renderVoucherStatusPill(detail.journal_status)}
                  </div>
                </div>
              </div>

              {/* Purpose Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Payment Purpose / Reference
                </span>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#1e293b', lineHeight: 1.5 }}>
                  {detail.purpose}
                </p>
              </div>

              {/* Action Bar for Status Workflow */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  padding: '14px 18px',
                  background: '#f1f5f9',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                }}
              >
                {canFinance && detail.status === 'draft' && detail.created_by === userId && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => void transitionPayment('submit')}
                    style={{ height: 36, borderRadius: 8 }}
                  >
                    Submit Request for Approval
                  </button>
                )}

                {canApprove && detail.status === 'submitted' && detail.created_by !== userId && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => void transitionPayment('approve')}
                    style={{ height: 36, borderRadius: 8 }}
                  >
                    Approve &amp; Prepare Finance Voucher
                  </button>
                )}

                {canPostVoucher && detail.status === 'approved' && detail.journal_status === 'draft' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => void postFinanceVoucher()}
                    style={{ height: 36, borderRadius: 8 }}
                  >
                    Post Finance Voucher to Ledger
                  </button>
                )}

                {detail.journal_status === 'posted' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#065f46', fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Finance voucher posted. Funds are active in accounts payable ledger.</span>
                  </div>
                )}
              </div>

              {/* Allocate to Outstanding Bills Section */}
              {detail.journal_status === 'posted' && Number(detail.available_amount) > 0 && canFinance && (
                <form
                  onSubmit={handleAllocate}
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Split size={16} color="#15803d" />
                    <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#166534' }}>
                      Allocate Available Balance to Unpaid Bill
                    </h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.8fr) minmax(140px, 1fr) auto', gap: 12, alignItems: 'end' }}>
                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Select Unpaid Bill</span>
                      <select
                        className="input"
                        required
                        value={allocationBillId}
                        onChange={e => {
                          setAllocationBillId(e.target.value);
                          const b = bills.find(x => x.id === e.target.value);
                          if (b) {
                            const maxAlloc = Math.min(Number(b.outstanding_amount), Number(detail.available_amount));
                            setAllocationAmount(String(maxAlloc));
                          }
                        }}
                        style={{ height: 40, background: '#fff' }}
                      >
                        <option value="">Choose Bill</option>
                        {bills
                          .filter(b => Number(b.outstanding_amount) > 0)
                          .map(b => (
                            <option key={b.id} value={b.id}>
                              {b.bill_number} · Inv #{b.supplier_invoice_number} (BDT {Number(b.outstanding_amount).toLocaleString()} due)
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Amount (BDT)</span>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={detail.available_amount}
                        required
                        value={allocationAmount}
                        onChange={e => setAllocationAmount(e.target.value)}
                        style={{ height: 40, background: '#fff' }}
                      />
                    </label>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy || !allocationBillId || !allocationAmount}
                      style={{ height: 40, borderRadius: 8, padding: '0 16px' }}
                    >
                      Confirm Allocation
                    </button>
                  </div>
                </form>
              )}

              {/* Allocation History */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1e293b' }}>
                    Allocations History
                  </h4>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {(detail.allocations || []).length} recorded
                  </span>
                </div>
                <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 10 }}>
                  <table className="data-table">
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th>Bill #</th>
                        <th>Supplier Invoice #</th>
                        <th>Amount Allocated</th>
                        <th>Journal Voucher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.allocations || []).length ? (
                        detail.allocations.map((a: Row) => (
                          <tr key={a.id}>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{a.bill_number}</strong>
                            </td>
                            <td>{a.supplier_invoice_number}</td>
                            <td>
                              <strong style={{ color: '#15803d' }}>
                                BDT {Number(a.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </strong>
                            </td>
                            <td>
                              <code>{a.journal_id}</code>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                            No bill allocations made yet. Funds remain unapplied.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setDetail(null)}
                style={{ height: 38, padding: '0 20px', borderRadius: 8 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
