'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  FileEdit,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  X,
  FileText,
  Filter,
  ShieldAlert,
} from 'lucide-react';

type Adjustment = {
  id: string;
  adjustment_type: 'decreasing' | 'increasing';
  note_type: 'credit_note' | 'debit_note';
  mushak_number: string | null;
  reference_invoice_id: string | null;
  reference_invoice_no: string;
  party_name: string;
  original_amount: number;
  adjusted_amount: number;
  tax_adjustment_amount: number;
  reason: string;
  status: 'pending_review' | 'approved' | 'rejected';
  statutory_window_days: number;
  created_at: string;
};

export function TaxAdjustmentScreen() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [decideModal, setDecideModal] = useState<Adjustment | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

  // Create Form
  const [adjustmentType, setAdjustmentType] = useState<'decreasing' | 'increasing'>('decreasing');
  const [noteType, setNoteType] = useState<'credit_note' | 'debit_note'>('credit_note');
  const [referenceInvoiceNo, setReferenceInvoiceNo] = useState('');
  const [partyName, setPartyName] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [taxAdjustmentAmount, setTaxAdjustmentAmount] = useState('');
  const [reason, setReason] = useState('');

  async function loadAdjustments() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: Adjustment[] }>('/tax/adjustments');
      setAdjustments(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load tax adjustments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdjustments();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: Adjustment }>('/tax/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          adjustmentType,
          noteType,
          referenceInvoiceNo,
          partyName,
          originalAmount: Number(originalAmount),
          adjustedAmount: Number(adjustedAmount),
          taxAdjustmentAmount: Number(taxAdjustmentAmount),
          reason,
        }),
      });
      setNotice(`Adjustment request created. Awaiting independent reviewer approval.`);
      setShowCreateModal(false);
      resetForm();
      await loadAdjustments();
    } catch (err: any) {
      setError(err?.message || 'Could not submit tax adjustment');
    } finally {
      setBusy(false);
    }
  }

  async function handleDecide(decision: 'approve' | 'reject') {
    if (!decideModal) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/tax/adjustments/${decideModal.id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ note: decisionNote }),
      });
      setNotice(`Adjustment ${decision === 'approve' ? 'approved and Mushak statutory note generated' : 'rejected'}.`);
      setDecideModal(null);
      setDecisionNote('');
      await loadAdjustments();
    } catch (err: any) {
      setError(err?.message || `Could not ${decision} adjustment`);
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setReferenceInvoiceNo('');
    setPartyName('');
    setOriginalAmount('');
    setAdjustedAmount('');
    setTaxAdjustmentAmount('');
    setReason('');
  }

  const safeAdjustments = Array.isArray(adjustments) ? adjustments : [];
  const filtered = safeAdjustments.filter((a) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && a.adjustment_type !== typeFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#d97706' }}>
              VAT Act 2012 Sec 41 &amp; 42 · Statutory Note Review
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#fef3c7',
                color: '#b45309',
              }}
            >
              90-Day Statutory Limitation
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Credit/Debit Note Tax Review
          </h1>
          <p className="muted">
            Maker-checker verification queue for increasing (Mushak 6.8) and decreasing (Mushak 6.7) tax adjustments within the mandatory 90-day NBR statutory window.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadAdjustments()}>
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>New Adjustment Request</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="panel stat">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: '#d97706' }}>
            {safeAdjustments.filter((a) => a.status === 'pending_review').length}
          </div>
          <div className="stat-note">Maker-checker approval needed</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Decreasing Adjustments (Mushak 6.7)</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            {safeAdjustments.filter((a) => a.adjustment_type === 'decreasing').length}
          </div>
          <div className="stat-note">Reduces Net VAT Payable</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Increasing Adjustments (Mushak 6.8)</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>
            {safeAdjustments.filter((a) => a.adjustment_type === 'increasing').length}
          </div>
          <div className="stat-note">Increases Net VAT Payable</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Approved &amp; Incorporated</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {safeAdjustments.filter((a) => a.status === 'approved').length}
          </div>
          <div className="stat-note">Posted to Mushak 9.1</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="panel" style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'pending_review', 'approved', 'rejected'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: statusFilter === st ? '#2563eb' : '#e2e8f0',
                  background: statusFilter === st ? '#eff6ff' : '#ffffff',
                  color: statusFilter === st ? '#1d4ed8' : '#64748b',
                  textTransform: 'capitalize',
                }}
              >
                {String(st || '').replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {['ALL', 'decreasing', 'increasing'].map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setTypeFilter(tp)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: typeFilter === tp ? '#0f172a' : '#e2e8f0',
                  background: typeFilter === tp ? '#0f172a' : '#ffffff',
                  color: typeFilter === tp ? '#ffffff' : '#64748b',
                  textTransform: 'capitalize',
                }}
              >
                {tp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Adjustment Queue Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Adjustment Reference</th>
                <th>Type / Document</th>
                <th>Original Invoice</th>
                <th>Counterparty</th>
                <th>Value Adjusted (BDT )</th>
                <th>Tax Adjustment (BDT)</th>
                <th>Statutory Window</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    Loading tax adjustments...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    No tax adjustments found.
                  </td>
                </tr>
              ) : (
                filtered.map((adj) => (
                  <tr key={adj.id}>
                    <td>
                      <strong style={{ color: '#0f172a', fontSize: 13.5 }}>
                        {adj.mushak_number || 'Pending Assignment'}
                      </strong>
                      <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>
                        {adj.reason}
                      </small>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: adj.adjustment_type === 'decreasing' ? '#eff6ff' : '#fef2f2',
                          color: adj.adjustment_type === 'decreasing' ? '#1d4ed8' : '#dc2626',
                          border: `1px solid ${adj.adjustment_type === 'decreasing' ? '#bfdbfe' : '#fecaca'}`,
                        }}
                      >
                        {adj.note_type === 'credit_note' ? 'Mushak 6.7 (Credit Note)' : 'Mushak 6.8 (Debit Note)'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {adj.reference_invoice_no}
                      </span>
                      <small style={{ display: 'block', color: '#64748b' }}>
                        Orig: BDT {Number(adj.original_amount).toLocaleString()}
                      </small>
                    </td>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{adj.party_name}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        BDT {Number(adj.adjusted_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: adj.adjustment_type === 'decreasing' ? '#15803d' : '#dc2626',
                        }}
                      >
                        {adj.adjustment_type === 'decreasing' ? '-' : '+'} BDT 
                        {Number(adj.tax_adjustment_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          color: adj.statutory_window_days <= 15 ? '#dc2626' : '#475569',
                          fontWeight: adj.statutory_window_days <= 15 ? 700 : 500,
                        }}
                      >
                        <Clock size={13} />
                        {adj.statutory_window_days} days left
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background:
                            adj.status === 'approved'
                              ? '#dcfce7'
                              : adj.status === 'rejected'
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            adj.status === 'approved'
                              ? '#15803d'
                              : adj.status === 'rejected'
                              ? '#b91c1c'
                              : '#b45309',
                          border: `1px solid ${
                            adj.status === 'approved'
                              ? '#86efac'
                              : adj.status === 'rejected'
                              ? '#fca5a5'
                              : '#fde68a'
                          }`,
                        }}
                      >
                        {String(adj.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {adj.status === 'pending_review' ? (
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                          onClick={() => setDecideModal(adj)}
                        >
                          Review &amp; Decide
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ADJUSTMENT MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 640,
              width: '95%',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Create Tax Adjustment Request
              </h3>
              <button
                className="btn"
                style={{ width: 34, height: 34, padding: 0 }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  Adjustment Type <span style={{ color: '#ef4444' }}>*</span>
                  <select
                    className="input"
                    value={adjustmentType}
                    onChange={(e) => {
                      const val = e.target.value as 'decreasing' | 'increasing';
                      setAdjustmentType(val);
                      setNoteType(val === 'decreasing' ? 'credit_note' : 'debit_note');
                    }}
                  >
                    <option value="decreasing">Decreasing Adjustment (Credit Note - Mushak 6.7)</option>
                    <option value="increasing">Increasing Adjustment (Debit Note - Mushak 6.8)</option>
                  </select>
                </label>

                <label className="field">
                  Note Type
                  <input
                    type="text"
                    className="input"
                    disabled
                    value={noteType === 'credit_note' ? 'Mushak 6.7 Credit Note' : 'Mushak 6.8 Debit Note'}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label className="field">
                  Original Invoice # <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    placeholder="e.g. INV-2026-0120"
                    value={referenceInvoiceNo}
                    onChange={(e) => setReferenceInvoiceNo(e.target.value)}
                  />
                </label>
                <label className="field">
                  Party Name (Customer / Supplier) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    className="input"
                    required
                    placeholder="e.g. Dhaka Central Book Depot"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <label className="field">
                  Original Amount (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    placeholder="50000"
                  />
                </label>
                <label className="field">
                  Adjusted Base (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={adjustedAmount}
                    onChange={(e) => {
                      setAdjustedAmount(e.target.value);
                      setTaxAdjustmentAmount((Number(e.target.value) * 0.15).toFixed(2));
                    }}
                    placeholder="10000"
                  />
                </label>
                <label className="field">
                  Tax Adjustment (BDT ) <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={taxAdjustmentAmount}
                    onChange={(e) => setTaxAdjustmentAmount(e.target.value)}
                    placeholder="1500"
                  />
                </label>
              </div>

              <label className="field">
                Reason &amp; Legal Justification <span style={{ color: '#ef4444' }}>*</span>
                <textarea
                  className="input"
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Damaged books returned within 90-day statutory window under VAT Act 2012 Sec 41..."
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {busy ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECISION MODAL */}
      {decideModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 540,
              width: '95%',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.28)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Review Tax Adjustment
              </h3>
              <button
                className="btn"
                style={{ width: 34, height: 34, padding: 0 }}
                onClick={() => setDecideModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div><strong>Party:</strong> {decideModal.party_name}</div>
                <div><strong>Ref Invoice:</strong> {decideModal.reference_invoice_no}</div>
                <div><strong>Adjustment Type:</strong> {decideModal.adjustment_type}</div>
                <div><strong>Tax Effect:</strong> BDT {Number(decideModal.tax_adjustment_amount).toLocaleString()}</div>
                <div><strong>Reason:</strong> {decideModal.reason}</div>
              </div>

              <label className="field">
                Reviewer Note / SRO Compliance Verification
                <input
                  type="text"
                  className="input"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="e.g. Verified original invoice and goods return challan within 90 days."
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleDecide('reject')}
                  disabled={busy}
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Reject Adjustment
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleDecide('approve')}
                  disabled={busy}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  Approve &amp; Issue Mushak Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
