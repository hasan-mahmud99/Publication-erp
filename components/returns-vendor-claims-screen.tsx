"use client";

import { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  FileText,
  Printer,
  Truck,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = {
  id: string;
  claim_number: string;
  source_type: string;
  source_number: string;
  supplier_name: string;
  reported_date: string;
  quantity: number;
  claim_amount?: string | number;
  remedy_type?: string;
  reason: string;
  evidence_reference: string;
  status: string;
  created_by: string;
  review_reason: string | null;
};

const initialForm = {
  claimNumber: '',
  sourceType: 'printer_order' as 'printer_order' | 'supplier_po',
  sourceNumber: '',
  reportedDate: new Date().toISOString().slice(0, 10),
  quantity: '10',
  claimAmount: '0.00',
  remedyType: 'debit_note' as 'debit_note' | 'replacement_reprint' | 'rework',
  reason: '',
  evidenceReference: '',
};

function renderStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9', color = '#475569', border = '#cbd5e1';
  if (s === 'approved' || s === 'reviewed') {
    bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
  } else if (s === 'requested') {
    bg = '#fffbeb'; color = '#92400e'; border = '#fde68a';
  } else if (s === 'settled') {
    bg = '#eff6ff'; color = '#1e40af'; border = '#bfdbfe';
  } else if (s === 'rejected') {
    bg = '#fef2f2'; color = '#991b1b'; border = '#fecaca';
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
        color,
        border: `1px solid ${border}`,
      }}
    >
      {s.replaceAll('_', ' ')}
    </span>
  );
}

function renderRemedyPill(remedy?: string) {
  const r = String(remedy || 'debit_note').toLowerCase();
  let label = 'Debit Note';
  let bg = '#eff6ff';
  let color = '#1d4ed8';
  if (r === 'replacement_reprint') {
    label = 'Free Reprint';
    bg = '#fdf4ff';
    color = '#86198f';
  } else if (r === 'rework') {
    label = 'Re-bind / Rework';
    bg = '#fefce8';
    color = '#854d0e';
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11.5px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '6px',
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

export function ReturnsVendorClaimsScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [userId, setUserId] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [createBusy, setCreateBusy] = useState(false);

  const [reviewing, setReviewing] = useState<{ row: Row; action: 'review' | 'reject' } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [meRes, claimsRes] = await Promise.all([
        api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me'),
        api<{ data: Row[] }>('/returns/vendor-claims'),
      ]);
      setUserId(meRes.data.userId);
      setCanManage(meRes.data.role === 'Owner' || meRes.data.permissions.includes('sales.manage'));
      setCanApprove(meRes.data.role === 'Owner' || meRes.data.permissions.includes('sales.approve'));
      setRows(claimsRes.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load vendor claims.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch =
        !search ||
        r.claim_number.toLowerCase().includes(search.toLowerCase()) ||
        r.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        r.source_number.toLowerCase().includes(search.toLowerCase()) ||
        r.reason.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchSource = sourceTypeFilter === 'ALL' || r.source_type.toLowerCase() === sourceTypeFilter.toLowerCase();
      return matchSearch && matchStatus && matchSource;
    });
  }, [rows, search, statusFilter, sourceTypeFilter]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const requested = rows.filter(r => r.status === 'requested').length;
    const approved = rows.filter(r => r.status === 'approved' || r.status === 'reviewed').length;
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.claim_amount || 0), 0);
    return { total, requested, approved, totalAmount };
  }, [rows]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/returns/vendor-claims', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          claimAmount: Number(form.claimAmount || 0),
        }),
      });
      setNotice(`Vendor claim ${form.claimNumber} logged successfully for independent investigation.`);
      setShowCreateModal(false);
      setForm({ ...initialForm, claimNumber: `VC-${Date.now().toString().slice(-4)}` });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not create vendor claim.');
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleDecide() {
    if (!reviewing || reviewReason.trim().length < 10) return;
    setDecideBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/returns/vendor-claims/${reviewing.row.id}/${reviewing.action}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: reviewReason.trim() }),
      });
      setNotice(
        `Claim ${reviewing.row.claim_number} ${
          reviewing.action === 'review' ? 'marked reviewed & accepted' : 'rejected'
        }.`
      );
      setReviewing(null);
      setReviewReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not process vendor claim decision.');
    } finally {
      setDecideBusy(false);
    }
  }

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Track and recover costs from printing and binding defects, paper wastage, or vendor procurement quality issues.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {canManage && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setForm({ ...initialForm, claimNumber: `CLM-${Date.now().toString().slice(-4)}` });
                setShowCreateModal(true);
              }}
            >
              <Plus size={16} />
              <span>+ Create Vendor Claim</span>
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

      {/* 4 KPI Cards */}
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
              Total Claims Logged
            </span>
            <FileText size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.total}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Across printers & suppliers</span>
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
              Pending Investigation
            </span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.requested}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Awaiting QC & management signoff</span>
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
              Reviewed / Accepted
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.approved}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Remedy confirmed by vendor</span>
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
              Total Claim Value
            </span>
            <DollarSign size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Estimated recovery amount</span>
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
              placeholder="Search by claim #, vendor, order, reason..."
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
            <option value="requested">Requested</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            className="input"
            value={sourceTypeFilter}
            onChange={e => setSourceTypeFilter(e.target.value)}
            style={{ width: 170, height: 38 }}
          >
            <option value="ALL">All Sources</option>
            <option value="printer_order">Printing Press</option>
            <option value="supplier_po">Material Supplier PO</option>
          </select>
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {filteredRows.length} {filteredRows.length === 1 ? 'claim' : 'claims'} found
        </span>
      </div>

      {/* Main Table */}
      <div className="panel table-wrap" style={{ background: '#fff', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Claim Ref & Date</th>
              <th>Vendor / Supplier</th>
              <th>Source Order</th>
              <th>Qty Defective</th>
              <th>Claim Amount</th>
              <th>Remedy & Defect Description</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.claim_number}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {String(row.reported_date).slice(0, 10)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.supplier_name}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {row.source_type === 'printer_order' ? (
                        <Printer size={14} color="#6366f1" />
                      ) : (
                        <Truck size={14} color="#059669" />
                      )}
                      <span style={{ fontWeight: 600 }}>{row.source_number}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                      {row.source_type.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#b91c1c' }}>{row.quantity} units</strong>
                  </td>
                  <td>
                    <strong>
                      BDT {Number(row.claim_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ marginBottom: 4 }}>{renderRemedyPill(row.remedy_type)}</div>
                    <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>{row.reason}</div>
                    {row.evidence_reference && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Ref/Photos: <code>{row.evidence_reference}</code>
                      </div>
                    )}
                    {row.review_reason && (
                      <div style={{ fontSize: 11, color: '#0369a1', marginTop: 3 }}>
                        <strong>Decision note:</strong> {row.review_reason}
                      </div>
                    )}
                  </td>
                  <td>{renderStatusPill(row.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {canApprove && row.status === 'requested' && row.created_by !== userId ? (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setReviewing({ row, action: 'review' })}
                          style={{ height: 30, fontSize: 12 }}
                        >
                          Review
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => setReviewing({ row, action: 'reject' })}
                          style={{ height: 30, fontSize: 12, color: '#b91c1c' }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="empty" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No vendor claims match the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 650, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Log Vendor Quality Claim</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Directly links defective returns to the Printer Print Order or Supplier PO.
                </p>
              </div>
              <button
                className="btn"
                style={{ border: 'none', padding: 6 }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="catalog-form-grid">
                <label className="field">
                  Source Order Type
                  <select
                    className="input"
                    value={form.sourceType}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        sourceType: e.target.value as any,
                        sourceNumber: '',
                      }))
                    }
                  >
                    <option value="printer_order">Printer Print Order (Printing & Production)</option>
                    <option value="supplier_po">Purchase Order (Procurement & Materials)</option>
                  </select>
                </label>

                <label className="field">
                  Source Order # (PO- / PR-)
                  <input
                    className="input"
                    required
                    placeholder={form.sourceType === 'printer_order' ? 'e.g. PR-2026-0001' : 'e.g. PO-2026-0001'}
                    value={form.sourceNumber}
                    onChange={e => setForm(prev => ({ ...prev, sourceNumber: e.target.value.trim() }))}
                  />
                </label>

                <label className="field">
                  Claim Reference #
                  <input
                    className="input"
                    required
                    value={form.claimNumber}
                    onChange={e => setForm(prev => ({ ...prev, claimNumber: e.target.value.toUpperCase() }))}
                  />
                </label>

                <label className="field">
                  Reported Date
                  <input
                    className="input"
                    type="date"
                    required
                    value={form.reportedDate}
                    onChange={e => setForm(prev => ({ ...prev, reportedDate: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Defective Quantity (Units/Copies)
                  <input
                    className="input"
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </label>

                <label className="field">
                  Estimated Claim Amount (BDT)
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.claimAmount}
                    onChange={e => setForm(prev => ({ ...prev, claimAmount: e.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                Preferred Vendor Remedy
                <select
                  className="input"
                  value={form.remedyType}
                  onChange={e => setForm(prev => ({ ...prev, remedyType: e.target.value as any }))}
                >
                  <option value="debit_note">Debit Note (Deduct from vendor payables)</option>
                  <option value="replacement_reprint">Free Replacement Reprint (Printer re-runs run at no cost)</option>
                  <option value="rework">Rework & Re-bind (Vendor fixes binding at their cost)</option>
                </select>
              </label>

              <label className="field">
                Specific Defect Reason & Quality Findings
                <textarea
                  className="input"
                  rows={3}
                  required
                  minLength={10}
                  placeholder="e.g. Pages 33-48 missing due to incorrect signature folding at bindery; cover lamination peeling off."
                  value={form.reason}
                  onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </label>

              <label className="field">
                Evidence Reference (QC Log #, Photos Link, Sample Bin)
                <input
                  className="input"
                  required
                  placeholder="e.g. QC-INSP-2026-089 / Sample stored in Quarantine Bin Q-01"
                  value={form.evidenceReference}
                  onChange={e => setForm(prev => ({ ...prev, evidenceReference: e.target.value }))}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createBusy}>
                  {createBusy ? 'Submitting…' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review / Reject Decision Modal */}
      {reviewing && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {reviewing.action === 'review' ? 'Accept & Confirm Remedy' : 'Reject Vendor Claim'}
              </h3>
              <button
                className="btn"
                style={{ border: 'none', padding: 6 }}
                onClick={() => {
                  setReviewing(null);
                  setReviewReason('');
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              Claim <strong>{reviewing.row.claim_number}</strong> against{' '}
              <strong>{reviewing.row.supplier_name}</strong> for{' '}
              <strong>{reviewing.row.quantity} units</strong> (Order: {reviewing.row.source_number}).
            </p>

            <label className="field">
              {reviewing.action === 'review' ? 'Acceptance / Remedy Approval Note' : 'Rejection Justification'}
              <textarea
                className="input"
                rows={3}
                required
                minLength={10}
                placeholder="Provide at least 10 characters detailing the resolution or rejection reason..."
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
              />
            </label>

            <div className="modal-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setReviewing(null);
                  setReviewReason('');
                }}
                disabled={decideBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={reviewing.action === 'review' ? 'btn btn-primary' : 'btn'}
                style={reviewing.action === 'reject' ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' } : {}}
                disabled={decideBusy || reviewReason.trim().length < 10}
                onClick={() => void handleDecide()}
              >
                {decideBusy ? 'Saving…' : reviewing.action === 'review' ? 'Confirm Acceptance' : 'Reject Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
