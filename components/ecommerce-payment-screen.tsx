'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, apiFile } from '@/lib/api';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
  Download,
  Eye,
  Send,
  Zap,
  Building,
  Smartphone,
  ShieldCheck
} from 'lucide-react';

type Provider = {
  provider: 'bkash' | 'nagad' | 'sslcommerz' | 'bank_transfer';
  methods: string[];
  mode: 'disabled' | 'sandbox_mock';
  liveAvailable: false;
};

type Payment = {
  id: string;
  sales_order_id: string;
  order_number: string;
  provider: string;
  payment_method: string;
  amount: string;
  currency_code: string;
  status: string;
  created_at: string;
  journal_id?: string | null;
  bank_reference: string | null;
  review_note: string | null;
  submitted_at?: string | null;
};

type Identity = { role: string; permissions: string[]; userId?: string };

const providerNames: Record<string, { name: string; type: string; color: string; bg: string }> = {
  bkash: { name: 'bKash MFS', type: 'Mobile Financial Service', color: '#e11d48', bg: '#ffe4e6' },
  nagad: { name: 'Nagad MFS', type: 'Postal MFS', color: '#ea580c', bg: '#ffedd5' },
  sslcommerz: { name: 'SSLCOMMERZ', type: 'Gateway (Debit/Credit Cards)', color: '#2563eb', bg: '#eff6ff' },
  bank_transfer: { name: 'Bank Wire / EFT', type: 'Direct Corporate Deposit', color: '#0891b2', bg: '#ecfeff' },
  courier_cod: { name: 'Courier COD', type: 'Cash on Delivery Clearing', color: '#7c3aed', bg: '#f5f3ff' },
};

export function EcommercePaymentScreen() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [me, setMe] = useState<Identity | null>(null);

  // Filters & selection
  const [providerTab, setProviderTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage = me?.role === 'Owner' || !!me?.permissions.includes('ecommerce.manage');
  const canReview = me?.role === 'Owner' || !!me?.permissions.includes('ecommerce.payment_review');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [providerRes, paymentRes, identityRes] = await Promise.all([
        api<{ data: Provider[] }>('/ecommerce/payment-providers'),
        api<{ data: Payment[] }>('/ecommerce/payments'),
        api<{ data: Identity }>('/auth/me').catch(() => ({ data: { role: 'Owner', permissions: ['ecommerce.manage', 'ecommerce.payment_review'] } })),
      ]);
      setProviders(Array.isArray(providerRes.data) ? providerRes.data : []);
      setPayments(Array.isArray(paymentRes.data) ? paymentRes.data : []);
      setMe(identityRes.data);
    } catch (cause: any) {
      setError(cause?.message || 'Could not load payment reconciliation records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Post payment to General Ledger
  async function handlePostToGL(payment: Payment) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: any }>(`/ecommerce/payments/${payment.id}/post-to-finance`, {
        method: 'POST',
      });
      await loadData();
      setNotice(`Payment settled to General Ledger! Created Journal Voucher ${res.data.entryNumber} (Net Deposit: BDT ${Number(res.data.netDeposit).toLocaleString()}, Gateway Fee: BDT ${Number(res.data.gatewayFee).toLocaleString()}).`);
    } catch (cause: any) {
      setError(cause?.message || 'GL posting failed');
    } finally {
      setBusy(false);
    }
  }

  // Review bank deposit slip
  async function handleReviewEvidence(decision: 'approve' | 'reject') {
    if (!selectedPayment) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/ecommerce/payments/${selectedPayment.id}/bank-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          note: reviewNote.trim() || `${decision === 'approve' ? 'Approved' : 'Rejected'} by authorized finance reviewer.`,
        }),
      });
      setShowReviewModal(false);
      setSelectedPayment(null);
      setReviewNote('');
      await loadData();
      setNotice(`Bank payment evidence marked as ${decision === 'approve' ? 'Approved' : 'Rejected'}.`);
    } catch (cause: any) {
      setError(cause?.message || 'Bank review decision failed');
    } finally {
      setBusy(false);
    }
  }

  const safePayments = Array.isArray(payments) ? payments : [];

  const filteredPayments = safePayments.filter((p) => {
    if (providerTab !== 'ALL' && p.provider !== providerTab) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchOrder = p.order_number?.toLowerCase().includes(q);
      const matchRef = p.bank_reference?.toLowerCase().includes(q);
      if (!matchOrder && !matchRef) return false;
    }
    return true;
  });

  const totalAmount = safePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const settledCount = safePayments.filter((p) => Boolean(p.journal_id)).length;
  const pendingBankReviewCount = safePayments.filter((p) => p.status === 'bank_proof_submitted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#16a34a' }}>
              FINANCE &amp; GENERAL LEDGER CLEARING
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#dcfce7',
                color: '#15803d',
              }}
            >
              MFS &amp; Gateway Settlement
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Online Payment Reconciliation &amp; GL Settlement
          </h1>
          <p className="muted">
            Reconcile payments collected via bKash, Nagad, SSLCOMMERZ, and Bank Wire. Settle net revenues to Finance General Ledger with 1-click balanced journal entries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notices */}
      {error && (
        <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {notice && (
        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="panel stat">
          <div className="stat-label">Total Online Collections</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            BDT {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-note">{safePayments.length} transactions recorded</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Settled to Finance GL</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {settledCount} / {safePayments.length}
          </div>
          <div className="stat-note">Posted to MFS (1110) &amp; Sales (4100)</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Bank Slips Under Review</div>
          <div className="stat-value" style={{ color: pendingBankReviewCount > 0 ? '#dc2626' : '#64748b' }}>
            {pendingBankReviewCount}
          </div>
          <div className="stat-note">Maker-checker deposit verification</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Supported Gateways</div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>4 Channels</div>
          <div className="stat-note">bKash, Nagad, SSLCOMMERZ, Bank Wire</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="panel" style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Provider Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: 'All Providers' },
              { key: 'bkash', label: 'bKash MFS' },
              { key: 'nagad', label: 'Nagad MFS' },
              { key: 'sslcommerz', label: 'SSLCOMMERZ' },
              { key: 'bank_transfer', label: 'Bank Wire / EFT' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className="btn"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderColor: providerTab === tab.key ? '#2563eb' : '#e2e8f0',
                  background: providerTab === tab.key ? '#eff6ff' : '#ffffff',
                  color: providerTab === tab.key ? '#1d4ed8' : '#64748b',
                }}
                onClick={() => setProviderTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            className="input"
            placeholder="Search by Sales Order # or Bank Ref..."
            style={{ width: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Payment Transactions Table */}
      <div className="panel table-wrap" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Reconciliation Register &amp; Settlement Queue
          </h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {filteredPayments.length} payment records
          </span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Provider &amp; Method</th>
              <th>Collection Amount</th>
              <th>Gateway State</th>
              <th>GL Journal Voucher</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  Loading payment intents...
                </td>
              </tr>
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  No payment intents match the selected filters.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => {
                const meta = providerNames[p.provider] || { name: p.provider, type: p.payment_method, color: '#475569', bg: '#f1f5f9' };
                const isSettled = Boolean(p.journal_id);
                const isBankProof = p.status === 'bank_proof_submitted';

                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/ecommerce-digital/online-order-detail?order=${p.sales_order_id}`}
                        style={{ color: '#2563eb', fontWeight: 700 }}
                      >
                        {p.order_number}
                      </Link>
                      {p.bank_reference && (
                        <p className="muted" style={{ fontSize: 11.5, margin: '2px 0 0' }}>
                          Ref: {p.bank_reference}
                        </p>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: meta.bg,
                          color: meta.color,
                        }}
                      >
                        {meta.name}
                      </span>
                      <p className="muted" style={{ fontSize: 11.5, margin: '2px 0 0' }}>
                        Method: {p.payment_method}
                      </p>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>
                        BDT {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          background:
                            p.status === 'sandbox_success' || p.status === 'bank_reviewed'
                              ? '#dcfce7'
                              : p.status === 'bank_proof_submitted'
                              ? '#fef3c7'
                              : '#fee2e2',
                          color:
                            p.status === 'sandbox_success' || p.status === 'bank_reviewed'
                              ? '#15803d'
                              : p.status === 'bank_proof_submitted'
                              ? '#b45309'
                              : '#b91c1c',
                        }}
                      >
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {isSettled ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>✓ Settled to GL</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                          Pending Settlement
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#64748b' }}>
                        <Clock size={13} />
                        <span>{String(p.created_at).slice(0, 10)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {isBankProof && canReview && (
                          <button
                            className="btn"
                            style={{ fontSize: 12, padding: '4px 8px', borderColor: '#d97706', color: '#b45309' }}
                            onClick={() => {
                              setSelectedPayment(p);
                              setShowReviewModal(true);
                            }}
                          >
                            <Eye size={13} />
                            <span>Review Slip</span>
                          </button>
                        )}

                        {!isSettled && canManage && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: '4px 10px', background: '#16a34a', borderColor: '#15803d' }}
                            disabled={busy}
                            onClick={() => void handlePostToGL(p)}
                          >
                            <Zap size={13} />
                            <span>⚡ Post to GL</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Review Bank Evidence Modal */}
      {showReviewModal && selectedPayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={18} color="#0891b2" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Review Bank Deposit Evidence</h3>
              </div>
              <button type="button" className="btn" onClick={() => setShowReviewModal(false)}>
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: 13, border: '1px solid #e2e8f0' }}>
              <div>Order: <strong>{selectedPayment.order_number}</strong></div>
              <div>Amount: <strong>BDT {Number(selectedPayment.amount).toLocaleString()}</strong></div>
              <div>Bank Reference: <code>{selectedPayment.bank_reference || 'N/A'}</code></div>
            </div>

            <label className="field">
              <span>Reviewer Note:</span>
              <textarea
                className="input"
                rows={3}
                placeholder="Audit notes (e.g. Verified with City Bank corporate statement)..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="btn"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                disabled={busy}
                onClick={() => void handleReviewEvidence('reject')}
              >
                Reject Evidence
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#16a34a' }}
                disabled={busy}
                onClick={() => void handleReviewEvidence('approve')}
              >
                Approve Deposit Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
