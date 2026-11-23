'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { type Screen } from '@/lib/screens';

export type LotBalanceRow = {
  item_id: string;
  warehouse_id: string;
  item_code: string;
  warehouse_code: string;
  lot_number: string;
  bin_location: string | null;
  on_hand_qty: string;
};

export type ReceiptLotRow = {
  receipt_line_id: string;
  lot_number: string;
  bin_location: string | null;
  accepted_qty: string;
  receipt_id?: string;
  grn_number: string;
  receipt_date: string;
  inventory_transaction_id?: string;
  item_id?: string;
  item_code: string;
  item_name: string;
  warehouse_id?: string;
  warehouse_code: string;
  supplier_name: string;
};

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
  warehouse_type: string;
  status: string;
};

interface BatchLotRegisterViewProps {
  screen: Screen;
  lotBalances: LotBalanceRow[];
  receiptLots: ReceiptLotRow[];
  warehouses: WarehouseOption[];
  analysisWarehouse: string;
  onWarehouseChange: (id: string) => void;
  lotSearch: string;
  onLotSearchChange: (search: string) => void;
  busy: boolean;
  onRefresh: () => Promise<void>;
}

export function BatchLotRegisterView({
  screen,
  lotBalances,
  receiptLots,
  warehouses,
  analysisWarehouse,
  onWarehouseChange,
  lotSearch,
  onLotSearchChange,
  busy,
  onRefresh,
}: BatchLotRegisterViewProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [localSearch, setLocalSearch] = useState(lotSearch);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Filter current lot balances client-side by query
  const filteredCurrentLots = useMemo(() => {
    return lotBalances.filter((row) => {
      if (analysisWarehouse && row.warehouse_id !== analysisWarehouse) return false;
      if (!localSearch.trim()) return true;
      const q = localSearch.toLowerCase();
      return (
        row.item_code.toLowerCase().includes(q) ||
        row.lot_number.toLowerCase().includes(q) ||
        (row.bin_location && row.bin_location.toLowerCase().includes(q)) ||
        row.warehouse_code.toLowerCase().includes(q)
      );
    });
  }, [lotBalances, analysisWarehouse, localSearch]);

  // Filter receipt lots history
  const filteredReceiptLots = useMemo(() => {
    return receiptLots.filter((row) => {
      if (analysisWarehouse && row.warehouse_id !== analysisWarehouse) return false;
      if (!localSearch.trim()) return true;
      const q = localSearch.toLowerCase();
      return (
        row.lot_number.toLowerCase().includes(q) ||
        row.item_code.toLowerCase().includes(q) ||
        row.item_name.toLowerCase().includes(q) ||
        row.grn_number.toLowerCase().includes(q) ||
        row.supplier_name.toLowerCase().includes(q) ||
        (row.bin_location && row.bin_location.toLowerCase().includes(q)) ||
        row.warehouse_code.toLowerCase().includes(q)
      );
    });
  }, [receiptLots, analysisWarehouse, localSearch]);

  // Aggregate Metrics
  const totalActiveLots = useMemo(() => {
    const set = new Set<string>();
    lotBalances.forEach((l) => set.add(l.lot_number));
    return set.size;
  }, [lotBalances]);

  const totalLotTrackedQty = useMemo(() => {
    return lotBalances.reduce((sum, l) => sum + Number(l.on_hand_qty || 0), 0);
  }, [lotBalances]);

  const totalDistinctBins = useMemo(() => {
    const bins = new Set<string>();
    lotBalances.forEach((l) => {
      if (l.bin_location) bins.add(l.bin_location);
    });
    return bins.size;
  }, [lotBalances]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Batch &amp; Lot Register
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#4338ca',
                background: '#e0e7ff',
                padding: '0.15rem 0.55rem',
                borderRadius: '9999px',
              }}
            >
              Traceability Ledger
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Track positive stock by production lot batch, assigned bin locations, and supplier GRN provenance.
          </p>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => void onRefresh()}
          disabled={busy}
          style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
        >
          {busy ? 'Refreshing…' : '🔄 Refresh Lots'}
        </button>
      </div>

      {/* KPI Cards Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Active Batches &amp; Lots
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {totalActiveLots}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Unique production runs tracked on-hand
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Total Lot-Allocated Stock
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0369a1', letterSpacing: '-0.02em' }}>
            {totalLotTrackedQty.toLocaleString()} units
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            {lotBalances.length} distinct lot-bin allocations
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Active Storage Bins
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#166534', letterSpacing: '-0.02em' }}>
            {totalDistinctBins} Bins
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Physical aisle/rack locations occupied
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Procurement Traceability
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', letterSpacing: '-0.02em' }}>
            {receiptLots.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Supplier GRN receipts linked to lot records
          </div>
        </div>
      </div>

      {/* Main Register Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Navigation Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.75rem 1.25rem',
            background: '#f8fafc',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              style={{
                fontSize: '0.825rem',
                fontWeight: activeTab === 'current' ? 600 : 500,
                color: activeTab === 'current' ? '#4338ca' : '#64748b',
                background: activeTab === 'current' ? '#e0e7ff' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              📦 Current On-Hand Lots ({lotBalances.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                fontSize: '0.825rem',
                fontWeight: activeTab === 'history' ? 600 : 500,
                color: activeTab === 'history' ? '#0369a1' : '#64748b',
                background: activeTab === 'history' ? '#e0f2fe' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              📜 GRN Receiving Provenance ({receiptLots.length})
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input"
              value={analysisWarehouse}
              onChange={(e) => onWarehouseChange(e.target.value)}
              style={{ fontSize: '0.825rem', padding: '0.3rem 0.6rem', height: 'auto', minWidth: '160px' }}
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search Lot, Item, GRN, Bin…"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                onLotSearchChange(e.target.value);
              }}
              style={{
                fontSize: '0.825rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                width: '220px',
              }}
            />
          </div>
        </div>

        {/* Tab 1: Current Positive Lot Stock */}
        {activeTab === 'current' && (
          <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
            <table className="data-table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Lot / Batch Number</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Item Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Warehouse</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Bin Location</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Current Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredCurrentLots.length ? (
                  filteredCurrentLots.map((row) => (
                    <tr key={`${row.item_id}:${row.warehouse_id}:${row.lot_number}:${row.bin_location}`}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        <span style={{ fontFamily: 'monospace', color: '#4338ca', background: '#e0e7ff', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                          {row.lot_number}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        {row.item_code}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                        {row.warehouse_code}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ color: row.bin_location ? '#0369a1' : '#94a3b8', fontSize: '0.85rem' }}>
                          {row.bin_location || 'Unassigned'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                        {Number(row.on_hand_qty).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                      No active positive lot balances match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: GRN Receiving Provenance History */}
        {activeTab === 'history' && (
          <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
            <table className="data-table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Lot / Batch</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Item</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Warehouse &amp; Bin</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Accepted Qty</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Supplier Provenance</th>
                  <th style={{ padding: '0.75rem 1rem' }}>GRN Ref</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Receipt Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceiptLots.length ? (
                  filteredReceiptLots.map((row) => (
                    <tr key={row.receipt_line_id}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        <span style={{ fontFamily: 'monospace', color: '#0369a1', background: '#e0f2fe', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                          {row.lot_number}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.item_code}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.item_name}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 500, color: '#334155' }}>{row.warehouse_code}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Bin: {row.bin_location || 'Unassigned'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                        {Number(row.accepted_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        {row.supplier_name || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#0369a1' }}>
                        {row.grn_number}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.825rem' }}>
                        {formatDate(row.receipt_date)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                      📜 No posted procurement receipts with a lot number match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
