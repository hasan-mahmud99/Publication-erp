"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type SettlementRow = {
  id: string;
  settlement_number: string;
  credit_note_id: string;
  customer_id: string;
  settlement_type: string;
  amount: string;
  status: string;
  replacement_order_id: string | null;
  replacement_order_number: string | null;
  journal_entry_id: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  customer_name: string;
  customer_type: string;
  credit_note_number: string;
  total_credit_amount: string;
  created_by_name: string | null;
};

type CreditNoteOption = {
  id: string;
  credit_note_number: string;
  customer_name: string;
  total_credit_amount: string;
  settled_amount: string;
};

const money = (val: unknown) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (val: string | null | undefined) => (val ? String(val).slice(0, 10) : '—');

export function ReturnsSettlementScreen({ screen }: { screen: Screen }) {
  const searchParams = useSearchParams();
  const cnParam = searchParams?.get('creditNoteId');

  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [creditNotes, setCreditNotes] = useState<CreditNoteOption[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Settlement Form State
  const [creditNoteId, setCreditNoteId] = useState(cnParam || '');
  const [settlementType, setSettlementType] = useState<'account_credit' | 'cash_refund' | 'bank_refund' | 'replacement_order'>('account_credit');
  const [amount, setAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query.trim()) params.set('q', query.trim());
      if (typeFilter) params.set('settlementType', typeFilter);

      const res = await api<{ data: { rows: SettlementRow[]; total: number } }>(`/returns/settlements?${params}`);
      setRows(res.data.rows);
      setTotal(res.data.total);

      // Load posted credit notes available for settlement
      const cnRes = await api<{ data: { rows: CreditNoteOption[] } }>('/returns/credit-notes?status=posted&limit=100');
      setCreditNotes(cnRes.data.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load settlements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [page, typeFilter]);

  useEffect(() => {
    if (cnParam) {
      setCreditNoteId(cnParam);
      setShowModal(true);
    }
  }, [cnParam]);

  // Set default amount when credit note is selected
  useEffect(() => {
    if (creditNoteId && creditNotes.length) {
      const cn = creditNotes.find(c => c.id === creditNoteId);
      if (cn) {
        const remaining = Math.max(0, Number(cn.total_credit_amount) - Number(cn.settled_amount || 0));
        setAmount(remaining.toFixed(2));
      }
    }
  }, [creditNoteId, creditNotes]);

  async function handleSettle() {
    if (!creditNoteId || Number(amount) <= 0) {
      setError('Please select a credit note and enter a valid settlement amount');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { settlementNumber: string; settlementType: string; replacementOrderId?: string } }>(
        '/returns/settlements',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            creditNoteId,
            settlementType,
            amount: Number(amount),
            paymentReference: paymentReference.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        }
      );
      setNotice(
        `✓ Settlement ${res.data.settlementNumber} recorded successfully (${settlementType.replaceAll('_', ' ')}).` +
          (res.data.replacementOrderId ? ' Replacement Sales Order generated for delivery dispatch.' : '')
      );
      setShowModal(false);
      setCreditNoteId('');
      setAmount('');
      setPaymentReference('');
      setNotes('');
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create settlement');
    } finally {
      setBusy(false);
    }
  }

  // KPI calculations
  const totalSettledAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const accountCreditTotal = rows
    .filter(r => r.settlement_type === 'account_credit')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const refundTotal = rows
    .filter(r => r.settlement_type === 'cash_refund' || r.settlement_type === 'bank_refund')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const replacementOrdersCount = rows.filter(r => r.settlement_type === 'replacement_order').length;

  const renderTypePill = (tp: string) => {
    switch (tp) {
      case 'replacement_order':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
          >
            📦 Replacement Order
          </span>
        );
      case 'cash_refund':
      case 'bank_refund':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            }}
          >
            BDT {tp.replaceAll('_', ' ')}
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
            }}
          >
            ✓ Account Credit
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
            <Wallet size={24} color="#2563eb" /> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Customer settlement register: apply credit notes to customer balance, issue bank refunds, or dispatch free replacement books.
          </p>
        </div>
        <div className="button-row" style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Settle Credit Note</span>
          </button>
          <Link
            className="btn"
            href="/returns-claims/sales-credit-note"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={15} />
            <span>Sales Credit Notes</span>
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => void loadData()}
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
            📜 Total Settled Amount
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {money(totalSettledAmount)} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Across {total} settlement records
          </div>
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
            ✓ Account Credit Balance
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {money(accountCreditTotal)} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Held on customer ledgers</div>
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
            💳 Cash / Bank Refunds
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {money(refundTotal)} BDT
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Disbursed refund vouchers</div>
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
            📦 Free Replacement Orders
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#312e81', marginTop: '4px' }}>
            {replacementOrdersCount} orders
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Dispatched replacement copies</div>
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
            placeholder="Search settlement #, customer, CN #..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void loadData();
            }}
          />
        </div>

        <select
          className="input"
          style={{ width: 200 }}
          value={typeFilter}
          onChange={e => {
            setTypeFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All Settlement Types</option>
          <option value="account_credit">Account Credit</option>
          <option value="cash_refund">Cash Refund</option>
          <option value="bank_refund">Bank Refund</option>
          <option value="replacement_order">Replacement Order</option>
        </select>

        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          Showing {rows.length} of {total} settlements
        </span>
      </section>

      {/* Settlements Table */}
      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '40px' }}>
          Loading settlement register…
        </div>
      ) : (
        <div className="panel table-wrap" style={{ borderRadius: 12, marginBottom: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Settlement #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Credit Note #</th>
                <th>Remedy Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Order / Payment Ref</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong style={{ color: '#1e3a8a', fontFamily: 'monospace' }}>
                        {row.settlement_number}
                      </strong>
                    </td>
                    <td style={{ color: '#64748b' }}>{date(row.created_at)}</td>
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
                        {row.credit_note_number}
                      </span>
                    </td>
                    <td>{renderTypePill(row.settlement_type)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {money(row.amount)} BDT
                    </td>
                    <td>
                      {row.replacement_order_number ? (
                        <Link
                          href={`/sales-distribution/sales-order-detail?orderId=${row.replacement_order_id}`}
                          style={{ color: '#2563eb', fontWeight: 600, fontSize: 12 }}
                        >
                          {row.replacement_order_number}
                        </Link>
                      ) : row.payment_reference ? (
                        <span style={{ fontSize: 12, color: '#334155' }}>{row.payment_reference}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>Ledger Balance</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        ✓ Completed
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty" style={{ textAlign: 'center', padding: '36px' }}>
                    No return settlements recorded yet.
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
          Total {total} settlements · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
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

      {/* Settle Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            style={{
              width: 'min(640px, 94vw)',
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
                  Execute Return Settlement
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  Draw down a posted Sales Credit Note via ledger balance, cash refund, or replacement order.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowModal(false)}
                style={{ padding: '6px 12px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              <label className="field">
                <span>Select Posted Sales Credit Note</span>
                <select
                  className="input"
                  required
                  value={creditNoteId}
                  onChange={e => setCreditNoteId(e.target.value)}
                >
                  <option value="">Select a credit note…</option>
                  {creditNotes.map(cn => (
                    <option key={cn.id} value={cn.id}>
                      {cn.credit_note_number} · {cn.customer_name} (Total: {money(cn.total_credit_amount)} BDT, Settled: {money(cn.settled_amount)} BDT)
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Settlement Remedy Type</span>
                <select
                  className="input"
                  value={settlementType}
                  onChange={e => setSettlementType(e.target.value as any)}
                >
                  <option value="account_credit">Credit on Account (Offset future book invoices)</option>
                  <option value="bank_refund">Bank Refund (EFT / Cheque Payment)</option>
                  <option value="cash_refund">Cash Refund (Petty Cash Disbursed)</option>
                  <option value="replacement_order">Free Replacement Order (Dispatch same titles)</option>
                </select>
              </label>

              <label className="field">
                <span>Settlement Amount (BDT)</span>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </label>

              {settlementType !== 'account_credit' && settlementType !== 'replacement_order' && (
                <label className="field">
                  <span>Cheque / Bank Reference #</span>
                  <input
                    className="input"
                    placeholder="e.g. IBBL Cheque #491028 / Bank EFT TX-991"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                  />
                </label>
              )}

              <label className="field">
                <span>Internal Notes</span>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Record customer authorization note or reference..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || !creditNoteId || Number(amount) <= 0}
                onClick={() => void handleSettle()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircle2 size={16} />
                <span>{busy ? 'Processing…' : 'Confirm Settlement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
