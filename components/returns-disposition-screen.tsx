"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  Filter,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Warehouse,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Receipt = {
  id: string;
  return_number: string;
  item_code: string;
  warehouse_code: string;
  condition_code: string;
  quantity: string;
  status: string;
  cost_amount: string | null;
  lot_number: string | null;
  bin_location: string | null;
  created_at: string;
  review_reason: string | null;
};

export function ReturnsDispositionScreen({ screen }: { screen: Screen }) {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Review Dialog State
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [reviewReason, setReviewReason] = useState('Quality inspection verified, restocked according to condition code');

  async function loadReceipts() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: Receipt[] }>('/inventory/sales-return-receipts');
      setRows(res.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load return receipts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReceipts();
  }, []);

  async function handleDecide() {
    if (!activeReceipt) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/inventory/sales-return-receipts/${activeReceipt.id}/${actionType}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: reviewReason.trim() }),
      });
      setNotice(
        actionType === 'approve'
          ? `✓ Return receipt for ${activeReceipt.return_number} approved and posted! Stock balances incremented and inventory journal posted.`
          : `✓ Return receipt for ${activeReceipt.return_number} rejected.`
      );
      setActiveReceipt(null);
      await loadReceipts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process disposition decision');
    } finally {
      setBusy(false);
    }
  }

  const posted = rows.filter(row => row.status === 'posted');
  const accepted = posted
    .filter(row => row.condition_code === 'accepted')
    .reduce((sum, row) => sum + Number(row.quantity), 0);
  const damaged = posted
    .filter(row => row.condition_code === 'damaged')
    .reduce((sum, row) => sum + Number(row.quantity), 0);
  const pendingCount = rows.filter(row => row.status === 'pending_approval').length;

  const filtered = rows.filter(row => {
    const matchesSearch = `${row.return_number} ${row.item_code} ${row.warehouse_code}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesStatus = !statusFilter || row.status === statusFilter;
    const matchesCondition = !conditionFilter || row.condition_code === conditionFilter;
    return matchesSearch && matchesStatus && matchesCondition;
  });

  return (
    <>
      {/* Header */}
      <div className="page-heading" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Boxes size={24} color="#2563eb" /> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Authorize physical return stock routing into sellable Finished Goods or quarantine write-off.
          </p>
        </div>
        <div className="button-row" style={{ display: 'flex', gap: 8 }}>
          <Link
            className="btn"
            href="/inventory-warehouse/quarantine-and-damaged-stock"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Quarantine Workflow</span>
            <ExternalLink size={14} />
          </Link>
          <Link
            className="btn btn-primary"
            href="/returns-claims/sales-credit-note"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Issue Credit Notes</span>
            <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => void loadReceipts()}
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
            borderLeft: '4px solid #f59e0b',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            ⏳ Pending Disposition
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Awaiting storekeeper release</div>
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
            ✓ Restocked to Finished Goods
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {accepted} copies
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Sellable inventory restored</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #ef4444',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
            🔒 Held in Quarantine
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
            {damaged} copies
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Damaged books isolated</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #3b82f6',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>
            📦 Total Physical Receipts
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {rows.length}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Gate inspection transactions</div>
        </div>
      </div>

      {/* Decision Modal / Box */}
      {activeReceipt && (
        <section
          className="panel"
          style={{
            padding: '24px',
            borderRadius: 14,
            marginBottom: '20px',
            border: actionType === 'approve' ? '2px solid #a7f3d0' : '2px solid #fecaca',
            background: actionType === 'approve' ? '#f0fdf4' : '#fff7f7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {actionType === 'approve' ? <CheckCircle2 size={22} color="#059669" /> : <AlertTriangle size={22} color="#dc2626" />}
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: actionType === 'approve' ? '#065f46' : '#991b1b' }}>
              {actionType === 'approve' ? 'Approve & Restock to Warehouse' : 'Reject Physical Receipt'}: {activeReceipt.return_number}
            </h2>
          </div>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
            Approving this receipt will immediately increment on-hand inventory stock in{' '}
            <strong>{activeReceipt.warehouse_code}</strong> by <strong>{Number(activeReceipt.quantity)} copies</strong> and
            generate the corresponding COGS / Inventory asset journal entry.
          </p>

          <label className="field" style={{ marginBottom: 16 }}>
            <span>Approval / Review Reason (Mandatory)</span>
            <input
              className="input"
              value={reviewReason}
              onChange={e => setReviewReason(e.target.value)}
              placeholder="Record reason or note for ledger audit..."
            />
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setActiveReceipt(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || reviewReason.trim().length < 5}
              onClick={() => void handleDecide()}
              style={{
                background: actionType === 'approve' ? '#059669' : '#dc2626',
                borderColor: actionType === 'approve' ? '#059669' : '#dc2626',
              }}
            >
              {busy ? 'Processing…' : actionType === 'approve' ? 'Confirm Approval & Post to Stock' : 'Confirm Rejection'}
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
            placeholder="Search return #, item code, warehouse..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <select
          className="input"
          style={{ width: 170 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="pending_approval">Pending Review</option>
          <option value="posted">Posted to Stock</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          className="input"
          style={{ width: 170 }}
          value={conditionFilter}
          onChange={e => setConditionFilter(e.target.value)}
        >
          <option value="">All Conditions</option>
          <option value="accepted">Grade A: Sellable</option>
          <option value="damaged">Grade C: Quarantine</option>
        </select>

        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          Showing {filtered.length} of {rows.length} receipts
        </span>
      </section>

      {/* Disposition Table */}
      {loading ? (
        <div className="panel empty" style={{ textAlign: 'center', padding: '40px' }}>
          Loading return receipts…
        </div>
      ) : (
        <div className="panel table-wrap" style={{ borderRadius: 12, marginBottom: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>Item Code</th>
                <th>Warehouse</th>
                <th>Condition</th>
                <th style={{ textAlign: 'right' }}>Copies</th>
                <th>Receipt Status</th>
                <th style={{ textAlign: 'right' }}>Valuation Cost (BDT)</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong style={{ color: '#1e3a8a', fontFamily: 'monospace' }}>{row.return_number}</strong>
                    </td>
                    <td>
                      <code>{row.item_code}</code>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{row.warehouse_code}</span>
                      {row.bin_location && <div style={{ fontSize: 11, color: '#94a3b8' }}>Bin: {row.bin_location}</div>}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: row.condition_code === 'accepted' ? '#ecfdf5' : '#fef2f2',
                          color: row.condition_code === 'accepted' ? '#065f46' : '#991b1b',
                          border: row.condition_code === 'accepted' ? '1px solid #a7f3d0' : '1px solid #fecaca',
                        }}
                      >
                        {row.condition_code === 'accepted' ? 'Grade A (Sellable)' : 'Grade C (Quarantine)'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {Number(row.quantity)} pcs
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: row.status === 'posted' ? '#eff6ff' : '#fffbeb',
                          color: row.status === 'posted' ? '#1d4ed8' : '#92400e',
                          border: row.status === 'posted' ? '1px solid #bfdbfe' : '1px solid #fde68a',
                        }}
                      >
                        {row.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {row.cost_amount ? `${Number(row.cost_amount).toFixed(2)} BDT` : 'Pending review'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.status === 'pending_approval' ? (
                        <div className="button-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setActiveReceipt(row);
                              setActionType('approve');
                              setReviewReason('Quality inspection verified, restocked according to condition code');
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <CheckCircle2 size={13} /> Restock
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => {
                              setActiveReceipt(row);
                              setActionType('reject');
                              setReviewReason('');
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Posted to Ledger</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty" style={{ textAlign: 'center', padding: '36px' }}>
                    No return receipts match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
