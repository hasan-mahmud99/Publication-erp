"use client";

import { useState, useMemo } from 'react';
import type { Screen } from '@/lib/screens';
import type { InventoryBalanceRow } from './inventory-overview-view';
import { InventoryCountPlanPanel } from './inventory-count-plan-panel';

type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };
type Item = { id: string; item_code: string; name: string; item_type: string; base_uom: string; tracking_policy: string; edition_id: string | null };
type StockCount = { id: string; item_code: string; warehouse_code: string; book_quantity: string; counted_quantity: string; variance_quantity: string; variance_reason: string | null; status: string; created_at: string; created_by: string };
type CountEvidence = { revision: number; book_quantity: string; warehouse_book_qty: string; counted_quantity: string; variance_quantity: string; reason: string | null; counted_by: string; counted_at: string };
type LotBalance = { item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; lot_number: string; bin_location: string | null; on_hand_qty: string };

interface PhysicalStockCountViewProps {
  screen: Screen;
  items: Item[];
  warehouses: Warehouse[];
  balances: InventoryBalanceRow[];
  lotBalances: LotBalance[];
  stockCounts: StockCount[];
  selectedCountId: string;
  countEvidence: CountEvidence[];
  selectedItem: string;
  setSelectedItem: (id: string) => void;
  selectedWarehouse: string;
  setSelectedWarehouse: (id: string) => void;
  countedQuantity: string;
  setCountedQuantity: (qty: string) => void;
  varianceReason: string;
  setVarianceReason: (reason: string) => void;
  transferLotKey: string;
  setTransferLotKey: (key: string) => void;
  recountQuantity: string;
  setRecountQuantity: (qty: string) => void;
  recountReason: string;
  setRecountReason: (reason: string) => void;
  onCreateCount: () => Promise<void>;
  onShowCountEvidence: (id: string) => Promise<void>;
  onSubmitRecount: () => Promise<void>;
  onReviewCount: (id: string, action: 'approve' | 'reject') => Promise<void>;
  onRefresh: () => Promise<void>;
  canWrite: boolean;
  canPost: boolean;
  canFinance: boolean;
  userId: string;
  role?: string;
  busy: boolean;
}

const formatDate = (val: string | null) => (val ? String(val).slice(0, 10) : '—');

export function PhysicalStockCountView({
  screen,
  items,
  warehouses,
  balances,
  lotBalances,
  stockCounts,
  selectedCountId,
  countEvidence,
  selectedItem,
  setSelectedItem,
  selectedWarehouse,
  setSelectedWarehouse,
  countedQuantity,
  setCountedQuantity,
  varianceReason,
  setVarianceReason,
  transferLotKey,
  setTransferLotKey,
  recountQuantity,
  setRecountQuantity,
  recountReason,
  setRecountReason,
  onCreateCount,
  onShowCountEvidence,
  onSubmitRecount,
  onReviewCount,
  onRefresh,
  canWrite,
  canPost,
  canFinance,
  userId,
  role,
  busy,
}: PhysicalStockCountViewProps) {
  const [activeTab, setActiveTab] = useState<'register' | 'pending_variance' | 'plans'>('register');
  const [showDirectCountForm, setShowDirectCountForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Live book quantity calculation for selected item and warehouse
  const liveBalance = useMemo(() => {
    if (!selectedItem || !selectedWarehouse) return null;
    return balances.find(b => b.item_id === selectedItem && b.warehouse_id === selectedWarehouse) || null;
  }, [balances, selectedItem, selectedWarehouse]);

  const liveBookQty = liveBalance ? Number(liveBalance.on_hand_qty || 0) : 0;
  const countedNum = countedQuantity.trim() !== '' ? Number(countedQuantity) : null;
  const liveVariance = countedNum !== null ? countedNum - liveBookQty : null;

  // Key metrics
  const metrics = useMemo(() => {
    const pending = stockCounts.filter(c => c.status === 'pending_approval');
    const withVariance = stockCounts.filter(c => Number(c.variance_quantity) !== 0);
    const matched = stockCounts.filter(c => Number(c.variance_quantity) === 0);

    return {
      total: stockCounts.length,
      pendingCount: pending.length,
      withVarianceCount: withVariance.length,
      matchedCount: matched.length,
    };
  }, [stockCounts]);

  // Filtered counts
  const filteredCounts = useMemo(() => {
    return stockCounts.filter(row => {
      // Tab filter
      if (activeTab === 'pending_variance' && row.status !== 'pending_approval') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchItem = row.item_code.toLowerCase().includes(query);
        const matchWh = row.warehouse_code.toLowerCase().includes(query);
        const matchReason = (row.variance_reason || '').toLowerCase().includes(query);
        const matchStatus = row.status.toLowerCase().includes(query);
        if (!matchItem && !matchWh && !matchReason && !matchStatus) return false;
      }

      return true;
    });
  }, [stockCounts, activeTab, searchQuery]);

  const selectedCount = stockCounts.find(c => c.id === selectedCountId);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📋</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {screen.title}
            </h1>
            <span style={{
              display: 'inline-block',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
            }}>
              {stockCounts.length} Counts Recorded
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Conduct physical inventory stock checks, identify shelf variances, and audit independent approvals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void onRefresh()}
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span>🔄</span> Refresh
          </button>
          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowDirectCountForm(!showDirectCountForm)}
              style={{ fontSize: '0.85rem' }}
            >
              {showDirectCountForm ? '✕ Close Form' : '+ Record Physical Count'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 200px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Total Counts</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{metrics.total}</div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>📑</span>
        </div>

        <div style={{
          flex: '1 1 200px',
          background: metrics.pendingCount > 0 ? '#fffbeb' : '#ffffff',
          border: '1px solid',
          borderColor: metrics.pendingCount > 0 ? '#fde68a' : '#e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: metrics.pendingCount > 0 ? '#b45309' : '#64748b', fontWeight: 500 }}>Pending Review</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: metrics.pendingCount > 0 ? '#92400e' : '#0f172a' }}>
              {metrics.pendingCount}
            </div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
        </div>

        <div style={{
          flex: '1 1 200px',
          background: metrics.withVarianceCount > 0 ? '#fff1f2' : '#ffffff',
          border: '1px solid',
          borderColor: metrics.withVarianceCount > 0 ? '#fecdd3' : '#e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: metrics.withVarianceCount > 0 ? '#be123c' : '#64748b', fontWeight: 500 }}>Variances Found</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: metrics.withVarianceCount > 0 ? '#9f1239' : '#0f172a' }}>
              {metrics.withVarianceCount}
            </div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        </div>

        <div style={{
          flex: '1 1 200px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Exact Matches (0 Variance)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>{metrics.matchedCount}</div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
        </div>
      </div>

      {/* Record Physical Count Form (Toggleable) */}
      {showDirectCountForm && canWrite && (
        <section className="panel catalog-form" style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 className="section-title" style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              Submit Physical Count
            </h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setShowDirectCountForm(false)}
            >
              Cancel
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.825rem', margin: '0 0 1rem' }}>
            Input counted stock from physical warehouse checks. If variance exists, specify an explicit reason before independent review.
          </p>

          <div className="catalog-form-grid" style={{ marginBottom: '1rem' }}>
            {/* Warehouse Selector */}
            <label className="field">
              Warehouse Location
              <select
                className="input"
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {warehouses.filter(w => w.status === 'active').map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Item Selector */}
            <label className="field">
              Item / Publication
              <select
                className="input"
                value={selectedItem}
                onChange={e => setSelectedItem(e.target.value)}
              >
                <option value="">Select item</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.item_code} · {it.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Lot / Bin if lot tracked */}
            {items.find(i => i.id === selectedItem)?.tracking_policy === 'lot' && (
              <label className="field">
                Counted Lot &amp; Bin
                <select
                  className="input"
                  value={transferLotKey}
                  onChange={e => setTransferLotKey(e.target.value)}
                >
                  <option value="">Select lot</option>
                  {lotBalances
                    .filter(row => row.item_id === selectedItem && row.warehouse_id === selectedWarehouse)
                    .map(row => (
                      <option
                        key={`${row.lot_number}:${row.bin_location}`}
                        value={JSON.stringify([row.lot_number, row.bin_location])}
                      >
                        Lot {row.lot_number} / Bin {row.bin_location || 'Unassigned'} ({row.on_hand_qty} on hand)
                      </option>
                    ))}
                </select>
              </label>
            )}

            {/* Physical Counted Quantity */}
            <label className="field">
              Counted Physical Quantity
              <input
                className="input"
                type="number"
                min="0"
                step="0.0001"
                value={countedQuantity}
                onChange={e => setCountedQuantity(e.target.value)}
                placeholder="e.g. 195"
              />
              {selectedItem && selectedWarehouse && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#475569' }}>Current System Stock: </span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{liveBookQty} units</span>
                </div>
              )}
            </label>
          </div>

          {/* Real-time Live Variance Calculation Display */}
          {liveVariance !== null && selectedItem && selectedWarehouse && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: liveVariance === 0 ? '#f0fdf4' : liveVariance < 0 ? '#fff1f2' : '#eff6ff',
              border: `1px solid ${liveVariance === 0 ? '#bbf7d0' : liveVariance < 0 ? '#fecdd3' : '#bfdbfe'}`,
            }}>
              <span style={{ fontSize: '1.2rem' }}>
                {liveVariance === 0 ? '✅' : liveVariance < 0 ? '⚠️' : 'ℹ️'}
              </span>
              <div>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: liveVariance === 0 ? '#166534' : liveVariance < 0 ? '#9f1239' : '#1e40af',
                }}>
                  {liveVariance === 0
                    ? 'Exact Match: Physical count matches system book balance.'
                    : liveVariance < 0
                    ? `Physical Shortage: ${liveVariance} units (System: ${liveBookQty}, Shelf: ${countedNum})`
                    : `Physical Surplus: +${liveVariance} units (System: ${liveBookQty}, Shelf: ${countedNum})`}
                </div>
                {liveVariance !== 0 && (
                  <div style={{ fontSize: '0.75rem', color: liveVariance < 0 ? '#be123c' : '#1d4ed8' }}>
                    An explicit variance reason is required before submission.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Variance Reason Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="field">
              Variance / Count Reason {liveVariance !== 0 && liveVariance !== null && <span style={{ color: '#dc2626' }}>*</span>}
              <input
                className="input"
                value={varianceReason}
                onChange={e => setVarianceReason(e.target.value)}
                placeholder={liveVariance !== 0 ? 'e.g. Damaged in transit, miscounted previous lot' : 'Optional notes'}
              />
            </label>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy ||
              !selectedItem ||
              !selectedWarehouse ||
              countedQuantity === '' ||
              (liveVariance !== null && liveVariance !== 0 && !varianceReason.trim()) ||
              (items.find(i => i.id === selectedItem)?.tracking_policy === 'lot' && !transferLotKey)
            }
            onClick={() => void onCreateCount()}
          >
            Submit Count for Approval
          </button>
        </section>
      )}

      {/* Control Bar: Tabs & Search */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'register' ? 600 : 400,
              background: activeTab === 'register' ? '#ffffff' : 'transparent',
              color: activeTab === 'register' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'register' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            Physical Counts Register ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending_variance')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'pending_variance' ? 600 : 400,
              background: activeTab === 'pending_variance' ? '#ffffff' : 'transparent',
              color: activeTab === 'pending_variance' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'pending_variance' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            ⏳ Pending Variance Reviews ({metrics.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'plans' ? 600 : 400,
              background: activeTab === 'plans' ? '#ffffff' : 'transparent',
              color: activeTab === 'plans' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'plans' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            📅 Scheduled Count Plans
          </button>
        </div>

        {activeTab !== 'plans' && (
          <div style={{ flex: '1 1 220px', maxWidth: '320px' }}>
            <input
              type="text"
              className="input"
              style={{ fontSize: '0.85rem' }}
              placeholder="Search item, warehouse, reason..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'plans' ? (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <InventoryCountPlanPanel onSubmitted={onRefresh} />
        </div>
      ) : (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div className="table-wrap" style={{ margin: 0 }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Item Code
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Warehouse
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Book Quantity
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Counted
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Variance
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Reason
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Status
                  </th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCounts.length > 0 ? (
                  filteredCounts.map(row => {
                    const varianceNum = Number(row.variance_quantity || 0);

                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {row.item_code}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', color: '#334155', fontSize: '0.85rem' }}>
                          {row.warehouse_code}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 600 }}>
                          {Number(row.book_quantity).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 600, color: '#0f172a' }}>
                          {Number(row.counted_quantity).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: varianceNum === 0 ? '#f0fdf4' : varianceNum < 0 ? '#fee2e2' : '#eff6ff',
                            color: varianceNum === 0 ? '#166534' : varianceNum < 0 ? '#991b1b' : '#1e40af',
                            border: `1px solid ${varianceNum === 0 ? '#bbf7d0' : varianceNum < 0 ? '#fecaca' : '#bfdbfe'}`,
                          }}>
                            {varianceNum > 0 ? `+${varianceNum}` : varianceNum}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', fontSize: '0.8rem', color: '#64748b' }}>
                          {row.variance_reason || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: row.status === 'approved' ? '#dcfce7' : row.status === 'pending_approval' ? '#fef9c3' : '#fee2e2',
                            color: row.status === 'approved' ? '#166534' : row.status === 'pending_approval' ? '#854d0e' : '#991b1b',
                          }}>
                            {row.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn"
                              disabled={busy}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => void onShowCountEvidence(row.id)}
                            >
                              Evidence / Recount
                            </button>

                            {row.status === 'pending_approval' && row.created_by === userId && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: '#b45309',
                                  background: '#fef3c7',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #fde68a',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  cursor: 'help',
                                }}
                                title="Enterprise Internal Control: You recorded this count. Under segregation of duties (4-eyes principle), an independent supervisor or finance reviewer must approve the variance."
                              >
                                🔒 Independent Review Required
                              </span>
                            )}

                            {canPost && row.status === 'pending_approval' && (role === 'Owner' || row.created_by !== userId) && (
                              <>
                                {canFinance ? (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={busy}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                    onClick={() => void onReviewCount(row.id, 'approve')}
                                  >
                                    Approve &amp; Post
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', padding: '0.2rem 0.4rem' }}>
                                    Finance role required to post
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={busy}
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                  onClick={() => void onReviewCount(row.id, 'reject')}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      {activeTab === 'pending_variance'
                        ? 'No count variances currently awaiting approval.'
                        : 'No physical stock counts recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Count Evidence and Recount Card */}
      {selectedCountId && selectedCount && (
        <section className="panel catalog-form" style={{ marginTop: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 className="section-title" style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Count Audit Evidence &amp; Recounts (Item: {selectedCount.item_code})
            </h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => void onShowCountEvidence('')}
            >
              ✕ Close
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
            Each recount saves an audit revision snapshot. Changed stock balances require independent recount verification before variance posting.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Counted Date &amp; Time</th>
                  <th>System Book Qty</th>
                  <th>Counted Qty</th>
                  <th>Variance</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {countEvidence.length ? (
                  countEvidence.map(ev => (
                    <tr key={ev.revision}>
                      <td>#{ev.revision}</td>
                      <td>{String(ev.counted_at).slice(0, 19)}</td>
                      <td>{ev.book_quantity}</td>
                      <td style={{ fontWeight: 600 }}>{ev.counted_quantity}</td>
                      <td style={{ fontWeight: 700, color: Number(ev.variance_quantity) < 0 ? '#dc2626' : Number(ev.variance_quantity) > 0 ? '#2563eb' : '#166534' }}>
                        {ev.variance_quantity}
                      </td>
                      <td>{ev.reason || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                      Initial count: single baseline revision recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canWrite && selectedCount.status === 'pending_approval' && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Record Physical Recount
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label className="field">
                  Recounted Quantity
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={recountQuantity}
                    onChange={e => setRecountQuantity(e.target.value)}
                  />
                </label>
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  Recount Evidence &amp; Reason
                  <input
                    className="input"
                    value={recountReason}
                    onChange={e => setRecountReason(e.target.value)}
                    placeholder="e.g. Recounted by Lead Warehouse Supervisor with warehouse team"
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || recountQuantity === '' || recountReason.trim().length < 10}
                onClick={() => void onSubmitRecount()}
              >
                Record Recount Revision
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
