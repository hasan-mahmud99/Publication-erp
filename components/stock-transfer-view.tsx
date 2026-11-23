"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Screen } from '@/lib/screens';
import type { InventoryBalanceRow } from './inventory-overview-view';

type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };
type Item = { id: string; item_code: string; name: string; item_type: string; base_uom: string; tracking_policy: string; edition_id: string | null };
type Transfer = {
  id: string;
  item_code: string;
  source_code: string;
  destination_code: string;
  lot_number: string | null;
  source_bin: string | null;
  destination_bin: string | null;
  quantity: string;
  received_qty: string;
  lost_qty: string;
  in_transit_value: string | null;
  days_in_transit: number | null;
  status: string;
  created_by: string;
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
};
type TransferReceipt = { id: string; quantity: string; transaction_id: string; warehouse_code: string | null; condition_code: 'accepted' | 'damaged'; damage_reason: string | null; received_at: string };
type TransferDiscrepancy = { id: string; transfer_id: string; reported_qty: string; reason: string; status: string; reported_by: string; reported_at: string; reviewed_at: string | null; review_reason: string | null; journal_id: string | null; item_code: string; source_code: string; destination_code: string };
type LotBalance = { item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; lot_number: string; bin_location: string | null; on_hand_qty: string };

interface StockTransferViewProps {
  screen: Screen;
  transfers: Transfer[];
  transferReceipts: TransferReceipt[];
  transferDiscrepancies: TransferDiscrepancy[];
  selectedTransferId: string;
  items: Item[];
  warehouses: Warehouse[];
  balances: InventoryBalanceRow[];
  lotBalances: LotBalance[];
  selectedItem: string;
  setSelectedItem: (id: string) => void;
  selectedWarehouse: string;
  setSelectedWarehouse: (id: string) => void;
  destinationWarehouse: string;
  setDestinationWarehouse: (id: string) => void;
  transferQuantity: string;
  setTransferQuantity: (qty: string) => void;
  transferLotKey: string;
  setTransferLotKey: (key: string) => void;
  destinationBin: string;
  setDestinationBin: (bin: string) => void;
  receiptQuantities: Record<string, string>;
  setReceiptQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  damagedQuantity: string;
  setDamagedQuantity: (qty: string) => void;
  damageWarehouse: string;
  setDamageWarehouse: (id: string) => void;
  damageReason: string;
  setDamageReason: (reason: string) => void;
  shortageReason: string;
  setShortageReason: (reason: string) => void;
  reviewReason: string;
  setReviewReason: (reason: string) => void;
  onSelectTransferId: (id: string) => void;
  onCreateTransfer: () => Promise<void>;
  onAdvanceTransfer: (id: string, action: 'approve' | 'dispatch' | 'receive' | 'receive-damaged') => Promise<void>;
  onReportShortage: (id: string) => Promise<void>;
  onReviewShortage: (id: string, action: 'dismiss' | 'write-off') => Promise<void>;
  onRefresh: () => Promise<void>;
  canWrite: boolean;
  canPost: boolean;
  canFinance: boolean;
  userId: string;
  role?: string;
  busy: boolean;
}

const formatDate = (val: string | null) => (val ? String(val).slice(0, 10) : '—');

export function StockTransferView({
  screen,
  transfers,
  transferReceipts,
  transferDiscrepancies,
  selectedTransferId,
  items,
  warehouses,
  balances,
  lotBalances,
  selectedItem,
  setSelectedItem,
  selectedWarehouse,
  setSelectedWarehouse,
  destinationWarehouse,
  setDestinationWarehouse,
  transferQuantity,
  setTransferQuantity,
  transferLotKey,
  setTransferLotKey,
  destinationBin,
  setDestinationBin,
  receiptQuantities,
  setReceiptQuantities,
  damagedQuantity,
  setDamagedQuantity,
  damageWarehouse,
  setDamageWarehouse,
  damageReason,
  setDamageReason,
  shortageReason,
  setShortageReason,
  reviewReason,
  setReviewReason,
  onSelectTransferId,
  onCreateTransfer,
  onAdvanceTransfer,
  onReportShortage,
  onReviewShortage,
  onRefresh,
  canWrite,
  canPost,
  canFinance,
  userId,
  role,
  busy,
}: StockTransferViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'in_transit' | 'pending' | 'received'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Find source stock balance for live available feedback
  const sourceBalance = useMemo(() => {
    if (!selectedItem || !selectedWarehouse) return null;
    return balances.find(b => b.item_id === selectedItem && b.warehouse_id === selectedWarehouse) || null;
  }, [balances, selectedItem, selectedWarehouse]);

  const sourceAvailableQty = sourceBalance ? Number(sourceBalance.available_qty || 0) : 0;

  // Key metrics
  const metrics = useMemo(() => {
    const inTransit = transfers.filter(r => ['in_transit', 'partially_received'].includes(r.status));
    const pending = transfers.filter(r => r.status === 'draft');
    const received = transfers.filter(r => r.status === 'received');

    return {
      total: transfers.length,
      inTransitCount: inTransit.length,
      pendingCount: pending.length,
      receivedCount: received.length,
    };
  }, [transfers]);

  // Filtered rows
  const filteredTransfers = useMemo(() => {
    return transfers.filter(row => {
      // Tab filter
      if (activeTab === 'in_transit' && !['in_transit', 'partially_received'].includes(row.status)) return false;
      if (activeTab === 'pending' && row.status !== 'draft') return false;
      if (activeTab === 'received' && row.status !== 'received') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchItem = row.item_code.toLowerCase().includes(query);
        const matchSource = row.source_code.toLowerCase().includes(query);
        const matchDest = row.destination_code.toLowerCase().includes(query);
        const matchStatus = row.status.toLowerCase().includes(query);
        if (!matchItem && !matchSource && !matchDest && !matchStatus) return false;
      }

      return true;
    });
  }, [transfers, activeTab, searchQuery]);

  const selectedTransfer = transfers.find(row => row.id === selectedTransferId);
  const openTransferDiscrepancy = transferDiscrepancies.find(
    row => row.transfer_id === selectedTransferId && row.status === 'open'
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🚚</span>
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
              {transfers.length} Transfers Recorded
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Initiate stock transfers, monitor shipments in transit, and confirm destination warehouse receipts.
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
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{ fontSize: '0.85rem' }}
            >
              {showCreateForm ? '✕ Close Form' : '+ New Transfer Request'}
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
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Total Transfers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{metrics.total}</div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>📦</span>
        </div>

        <div style={{
          flex: '1 1 200px',
          background: metrics.inTransitCount > 0 ? '#eff6ff' : '#ffffff',
          border: '1px solid',
          borderColor: metrics.inTransitCount > 0 ? '#bfdbfe' : '#e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: metrics.inTransitCount > 0 ? '#1d4ed8' : '#64748b', fontWeight: 500 }}>In-Transit Shipments</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: metrics.inTransitCount > 0 ? '#1e40af' : '#0f172a' }}>
              {metrics.inTransitCount}
            </div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>🚚</span>
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
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Received &amp; Completed</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>{metrics.receivedCount}</div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
        </div>
      </div>

      {/* New Transfer Card (Toggleable) */}
      {showCreateForm && canWrite && (
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
              Create Stock Transfer Request
            </h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.825rem', margin: '0 0 1rem' }}>
            Transfer stock from one active warehouse to another. Draft transfers must be approved before dispatch.
          </p>

          <div className="catalog-form-grid" style={{ marginBottom: '1rem' }}>
            {/* Source Warehouse */}
            <label className="field">
              Source Warehouse (Origin)
              <select
                className="input"
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
              >
                <option value="">Select origin warehouse</option>
                {warehouses.filter(w => w.status === 'active' && w.warehouse_type !== 'quarantine').map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Item */}
            <label className="field">
              Item to Transfer
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

            {/* Destination Warehouse */}
            <label className="field">
              Destination Warehouse
              <select
                className="input"
                value={destinationWarehouse}
                onChange={e => setDestinationWarehouse(e.target.value)}
              >
                <option value="">Select destination</option>
                {warehouses
                  .filter(w => w.status === 'active' && w.id !== selectedWarehouse && w.warehouse_type !== 'quarantine')
                  .map(w => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
              </select>
            </label>

            {/* Quantity */}
            <label className="field">
              Quantity to Transfer
              <input
                className="input"
                type="number"
                min="0.0001"
                step="0.0001"
                value={transferQuantity}
                onChange={e => setTransferQuantity(e.target.value)}
                placeholder="e.g. 50"
              />
              {selectedItem && selectedWarehouse && (
                <small style={{ color: sourceAvailableQty > 0 ? '#166534' : '#dc2626', fontWeight: 600, display: 'block', marginTop: '0.25rem' }}>
                  Available in origin: {sourceAvailableQty} units
                </small>
              )}
            </label>

            {/* Lot & Bin (if lot tracked) */}
            {items.find(i => i.id === selectedItem)?.tracking_policy === 'lot' && (
              <>
                <label className="field">
                  Source Lot and Bin
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
                          Lot {row.lot_number} / Bin {row.bin_location || 'Unassigned'} ({row.on_hand_qty} avail)
                        </option>
                      ))}
                  </select>
                </label>

                <label className="field">
                  Destination Bin
                  <input
                    className="input"
                    value={destinationBin}
                    onChange={e => setDestinationBin(e.target.value)}
                    placeholder="e.g. Aisle-3-Bin-4"
                  />
                </label>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy ||
              !selectedItem ||
              !selectedWarehouse ||
              !destinationWarehouse ||
              selectedWarehouse === destinationWarehouse ||
              !transferQuantity ||
              Number(transferQuantity) <= 0 ||
              (items.find(i => i.id === selectedItem)?.tracking_policy === 'lot' && !transferLotKey)
            }
            onClick={() => void onCreateTransfer()}
          >
            Create Draft Transfer
          </button>
        </section>
      )}

      {/* Control Bar: Filters & Search */}
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
            onClick={() => setActiveTab('all')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'all' ? 600 : 400,
              background: activeTab === 'all' ? '#ffffff' : 'transparent',
              color: activeTab === 'all' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            All Transfers ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('in_transit')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'in_transit' ? 600 : 400,
              background: activeTab === 'in_transit' ? '#ffffff' : 'transparent',
              color: activeTab === 'in_transit' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'in_transit' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            🚚 In-Transit ({metrics.inTransitCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'pending' ? 600 : 400,
              background: activeTab === 'pending' ? '#ffffff' : 'transparent',
              color: activeTab === 'pending' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'pending' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            ⏳ Pending Approval ({metrics.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('received')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: 'none',
              fontWeight: activeTab === 'received' ? 600 : 400,
              background: activeTab === 'received' ? '#ffffff' : 'transparent',
              color: activeTab === 'received' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'received' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            ✅ Completed ({metrics.receivedCount})
          </button>
        </div>

        <div style={{ flex: '1 1 220px', maxWidth: '320px' }}>
          <input
            type="text"
            className="input"
            style={{ fontSize: '0.85rem' }}
            placeholder="Search item, route, status..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Transfers Table */}
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
                  Item &amp; Lot
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Route
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Ordered Qty
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Received / In-Transit
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Transit Status
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Date
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.length > 0 ? (
                filteredTransfers.map(row => {
                  const remaining = Number(row.quantity) - Number(row.received_qty);
                  const isInTransit = ['in_transit', 'partially_received'].includes(row.status);

                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Item */}
                      <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                          {row.item_code}
                        </div>
                        {row.lot_number && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Lot: {row.lot_number} ({row.source_bin || 'Unassigned'} ➔ {row.destination_bin || 'Unassigned'})
                          </div>
                        )}
                      </td>

                      {/* Route */}
                      <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{row.source_code}</span>
                          <span style={{ color: '#94a3b8' }}>➔</span>
                          <span style={{ fontWeight: 600, color: '#0369a1' }}>{row.destination_code}</span>
                        </div>
                      </td>

                      {/* Ordered Qty */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 600 }}>
                        {Number(row.quantity).toLocaleString()}
                      </td>

                      {/* Received / In-Transit */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: Number(row.received_qty) > 0 ? '#166534' : '#64748b' }}>
                          {Number(row.received_qty).toLocaleString()} rec&apos;d
                        </div>
                        {isInTransit && (
                          <div style={{ fontSize: '0.75rem', color: '#d97706' }}>
                            {remaining.toLocaleString()} in transit ({row.days_in_transit ?? 0}d)
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: row.status === 'received' ? '#dcfce7' : isInTransit ? '#eff6ff' : row.status === 'draft' ? '#fef9c3' : '#f1f5f9',
                          color: row.status === 'received' ? '#166534' : isInTransit ? '#1d4ed8' : row.status === 'draft' ? '#854d0e' : '#475569',
                          border: `1px solid ${row.status === 'received' ? '#bbf7d0' : isInTransit ? '#bfdbfe' : row.status === 'draft' ? '#fde047' : '#e2e8f0'}`,
                        }}>
                          {row.status.replaceAll('_', ' ')}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#64748b', verticalAlign: 'middle' }}>
                        {formatDate(row.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => onSelectTransferId(row.id)}
                          >
                            Receipts
                          </button>

                          {canPost && row.status === 'draft' && (role === 'Owner' || row.created_by !== userId) && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busy}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => void onAdvanceTransfer(row.id, 'approve')}
                            >
                              Approve
                            </button>
                          )}

                          {row.status === 'draft' && role !== 'Owner' && row.created_by === userId && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#b45309',
                                background: '#fef3c7',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              title="Dual-control governance requires another user to approve this transfer"
                            >
                              🔒 Independent approval required
                            </span>
                          )}

                          {canPost && row.status === 'approved' && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busy}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => void onAdvanceTransfer(row.id, 'dispatch')}
                            >
                              Dispatch 🚚
                            </button>
                          )}

                          {canPost && isInTransit && (
                            <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                className="input"
                                type="number"
                                min="0.0001"
                                max={remaining}
                                step="0.0001"
                                placeholder={`Qty (${remaining})`}
                                style={{ width: '85px', fontSize: '0.75rem', padding: '0.2rem 0.35rem' }}
                                value={receiptQuantities[row.id] ?? ''}
                                onChange={e => setReceiptQuantities(curr => ({ ...curr, [row.id]: e.target.value }))}
                              />
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={
                                  busy ||
                                  (receiptQuantities[row.id] !== undefined &&
                                    receiptQuantities[row.id] !== '' &&
                                    (Number(receiptQuantities[row.id]) <= 0 || Number(receiptQuantities[row.id]) > remaining))
                                }
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => void onAdvanceTransfer(row.id, 'receive')}
                              >
                                Receive 📥
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    No stock transfers match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Transfer Receipt Details */}
      {selectedTransferId && (
        <section className="panel catalog-form" style={{ marginTop: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 className="section-title" style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Transfer Receipt History (ID: {selectedTransferId.slice(0, 8)})
            </h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => onSelectTransferId('')}
            >
              ✕ Close
            </button>
          </div>

          {transferReceipts.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Received Qty</th>
                    <th>Condition</th>
                    <th>Destination Warehouse</th>
                    <th>Ledger Transaction</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transferReceipts.map(rec => (
                    <tr key={rec.id}>
                      <td>{formatDate(rec.received_at)}</td>
                      <td style={{ fontWeight: 600, color: '#166534' }}>{rec.quantity} units</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: rec.condition_code === 'accepted' ? '#dcfce7' : '#fee2e2',
                          color: rec.condition_code === 'accepted' ? '#166534' : '#991b1b',
                        }}>
                          {rec.condition_code}
                        </span>
                      </td>
                      <td>{rec.warehouse_code || 'Destination'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{rec.transaction_id.slice(0, 8)}</td>
                      <td>{rec.damage_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No physical receipts posted for this transfer yet.</p>
          )}

          {canPost && selectedTransfer && ['in_transit', 'partially_received'].includes(selectedTransfer.status) && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Receive Damaged Stock into Quarantine
              </h3>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                Damaged transfer stock is quarantined for inspection and excluded from available salable inventory.
              </p>
              <div className="catalog-form-grid">
                <label className="field">
                  Damaged Quantity
                  <input
                    className="input"
                    type="number"
                    min="0.0001"
                    max={Number(selectedTransfer.quantity) - Number(selectedTransfer.received_qty)}
                    step="0.0001"
                    value={damagedQuantity}
                    onChange={e => setDamagedQuantity(e.target.value)}
                  />
                </label>
                <label className="field">
                  Quarantine Warehouse
                  <select
                    className="input"
                    value={damageWarehouse}
                    onChange={e => setDamageWarehouse(e.target.value)}
                  >
                    <option value="">Select quarantine location</option>
                    {warehouses.filter(w => w.warehouse_type === 'quarantine' && w.status === 'active').map(w => (
                      <option key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Damage Reason
                  <input
                    className="input"
                    value={damageReason}
                    onChange={e => setDamageReason(e.target.value)}
                    placeholder="e.g. Carton crushed during transport"
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  busy ||
                  !damagedQuantity ||
                  Number(damagedQuantity) <= 0 ||
                  !damageWarehouse ||
                  damageReason.trim().length < 5
                }
                onClick={() => void onAdvanceTransfer(selectedTransfer.id, 'receive-damaged')}
              >
                Post Damaged Receipt
              </button>
            </div>
          )}
        </section>
      )}

      {/* Shortage Investigation (E2E-compliant container) */}
      <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
        <section className="panel catalog-form" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <h2 className="section-title" style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            In-transit shortage investigation
          </h2>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 1rem' }}>
            Report missing transfer shipments to pause receiving until an independent review or write-off is authorized.
          </p>

          {selectedTransfer && ['in_transit', 'partially_received'].includes(selectedTransfer.status) && !openTransferDiscrepancy && canWrite && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                Report Shortage on Transfer {selectedTransfer.id.slice(0, 8)} ({selectedTransfer.item_code})
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <label className="field" style={{ flex: 1, margin: 0 }}>
                  Investigation Reason
                  <input
                    className="input"
                    value={shortageReason}
                    onChange={e => setShortageReason(e.target.value)}
                    placeholder="Describe discrepancy / missing cartons"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || shortageReason.trim().length < 10}
                  onClick={() => void onReportShortage(selectedTransfer.id)}
                >
                  Report Shortage
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Route</th>
                  <th>Reported Qty</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision Review</th>
                </tr>
              </thead>
              <tbody>
                {transferDiscrepancies.length > 0 ? (
                  transferDiscrepancies.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontFamily: 'monospace' }}>{row.item_code}</td>
                      <td>{row.source_code} ➔ {row.destination_code}</td>
                      <td style={{ fontWeight: 600, color: '#dc2626' }}>{row.reported_qty}</td>
                      <td>{row.reason}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: row.status === 'open' ? '#fee2e2' : '#f1f5f9',
                          color: row.status === 'open' ? '#991b1b' : '#475569',
                        }}>
                          {row.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {row.status === 'open' && canPost && (role === 'Owner' || row.reported_by !== userId) ? (
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <input
                              className="input"
                              placeholder="Review reason"
                              style={{ width: '130px', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                              value={reviewReason}
                              onChange={e => setReviewReason(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                              onClick={() => void onReviewShortage(row.id, 'dismiss')}
                            >
                              Dismiss
                            </button>
                            {canFinance && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                                onClick={() => void onReviewShortage(row.id, 'write-off')}
                              >
                                Write-Off
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {row.review_reason || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      No open transfer shortages reported.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
