'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { type Screen } from '@/lib/screens';

export type ValuationRow = {
  item_id: string;
  warehouse_id: string;
  item_code: string;
  warehouse_code: string;
  on_hand_qty: string;
  average_unit_cost: string;
  stock_value: string;
};

export type TransitValuationRow = {
  transfer_id: string;
  item_code: string;
  source_code: string;
  destination_code: string;
  in_transit_qty: string;
  dispatch_unit_cost: string;
  stock_value: string;
  dispatched_at: string;
};

interface InventoryValuationViewProps {
  screen: Screen;
  valuation: ValuationRow[];
  transitValuation: TransitValuationRow[];
  valuationTotals: { on_hand_value: string; in_transit_value: string } | null;
  busy: boolean;
  onRefresh: () => Promise<void>;
}

export function InventoryValuationView({
  screen,
  valuation,
  transitValuation,
  valuationTotals,
  busy,
  onRefresh,
}: InventoryValuationViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'books' | 'raw' | 'transit'>('all');
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');

  // Format currency helpers
  const formatBDT = (amount: number | string | null | undefined) => {
    const val = Number(amount ?? 0);
    if (isNaN(val)) return '0.00 BDT ';
    return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT `;
  };

  const formatCompactBDT = (amount: number | string | null | undefined) => {
    const val = Number(amount ?? 0);
    if (isNaN(val)) return '0.00 BDT ';
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr BDT `;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} Lac BDT `;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k BDT `;
    return `${val.toFixed(2)} BDT `;
  };

  const isBook = (code: string) => code.startsWith('BK-') || code.includes('BK') || code.includes('ITEM');
  const isRaw = (code: string) => code.startsWith('RAW-') || code.includes('MAT');

  // Distinct warehouses for filtering
  const warehouses = useMemo(() => {
    const set = new Set<string>();
    valuation.forEach((r) => set.add(r.warehouse_code));
    return Array.from(set).sort();
  }, [valuation]);

  // Filtered warehouse valuation rows
  const filteredValuation = useMemo(() => {
    return valuation.filter((row) => {
      if (warehouseFilter !== 'ALL' && row.warehouse_code !== warehouseFilter) return false;
      if (activeTab === 'books' && !isBook(row.item_code)) return false;
      if (activeTab === 'raw' && !isRaw(row.item_code)) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesCode = row.item_code.toLowerCase().includes(query);
        const matchesWh = row.warehouse_code.toLowerCase().includes(query);
        if (!matchesCode && !matchesWh) return false;
      }
      return true;
    });
  }, [valuation, activeTab, warehouseFilter, search]);

  // Filtered transit rows
  const filteredTransit = useMemo(() => {
    return transitValuation.filter((row) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        row.item_code.toLowerCase().includes(query) ||
        row.source_code.toLowerCase().includes(query) ||
        row.destination_code.toLowerCase().includes(query) ||
        row.transfer_id.toLowerCase().includes(query)
      );
    });
  }, [transitValuation, search]);

  // Summary figures
  const warehouseTotalVal = Number(valuationTotals?.on_hand_value ?? 0);
  const transitTotalVal = Number(valuationTotals?.in_transit_value ?? 0);
  const grandTotalVal = warehouseTotalVal + transitTotalVal;

  const totalOnHandUnits = useMemo(() => {
    return valuation.reduce((sum, r) => sum + Number(r.on_hand_qty || 0), 0);
  }, [valuation]);

  const bookValuationSum = useMemo(() => {
    return valuation.filter((r) => isBook(r.item_code)).reduce((sum, r) => sum + Number(r.stock_value || 0), 0);
  }, [valuation]);

  const rawValuationSum = useMemo(() => {
    return valuation.filter((r) => isRaw(r.item_code)).reduce((sum, r) => sum + Number(r.stock_value || 0), 0);
  }, [valuation]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Inventory Valuation
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#0369a1',
                background: '#e0f2fe',
                padding: '0.15rem 0.55rem',
                borderRadius: '9999px',
              }}
            >
              AVCO Basis
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Real-time weighted-average cost valuation across central warehouses and dispatched stock in transit.
          </p>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => void onRefresh()}
          disabled={busy}
          style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
        >
          {busy ? 'Refreshing…' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* 4 Financial KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Grand Total Asset Value */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: '12px',
            padding: '1.15rem 1.25rem',
            color: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Total Inventory Assets
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#38bdf8' }}>
            {formatBDT(grandTotalVal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
            ≈ {formatCompactBDT(grandTotalVal)} · {totalOnHandUnits.toLocaleString()} total units
          </div>
        </div>

        {/* Physical Warehouse Stock */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.15rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Physical Warehouse Stock
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
            {formatBDT(warehouseTotalVal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Sitting in {warehouses.length || 1} storage facilities
          </div>
        </div>

        {/* Books vs Raw Breakdown */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.15rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Finished Books vs. Materials
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
              {formatCompactBDT(bookValuationSum)}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Books</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706' }}>
              {formatCompactBDT(rawValuationSum)}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Materials</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.45rem' }}>
            {valuation.length} active inventory balance lines
          </div>
        </div>

        {/* Goods In Transit */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.15rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Goods In-Transit
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', color: transitTotalVal > 0 ? '#b45309' : '#0f172a' }}>
            {formatBDT(transitTotalVal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            {transitValuation.length} active shipments between branches
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Navigation Tabs & Controls Toolbar */}
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
              onClick={() => setActiveTab('all')}
              style={{
                fontSize: '0.825rem',
                fontWeight: activeTab === 'all' ? 600 : 500,
                color: activeTab === 'all' ? '#0284c7' : '#64748b',
                background: activeTab === 'all' ? '#e0f2fe' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              📊 All Items ({valuation.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('books')}
              style={{
                fontSize: '0.825rem',
                fontWeight: activeTab === 'books' ? 600 : 500,
                color: activeTab === 'books' ? '#166534' : '#64748b',
                background: activeTab === 'books' ? '#dcfce7' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              📚 Finished Books Only
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              style={{
                fontSize: '0.825rem',
                fontWeight: activeTab === 'raw' ? 600 : 500,
                color: activeTab === 'raw' ? '#d97706' : '#64748b',
                background: activeTab === 'raw' ? '#fef3c7' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              🏭 Raw Materials
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transit')}
              style={{
                fontSize: '0.825rem',
                fontWeight: activeTab === 'transit' ? 600 : 500,
                color: activeTab === 'transit' ? '#b45309' : '#64748b',
                background: activeTab === 'transit' ? '#fef3c7' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              🚚 In-Transit Transfers ({transitValuation.length})
            </button>
          </div>

          {/* Search & Warehouse Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {activeTab !== 'transit' && warehouses.length > 1 && (
              <select
                className="input"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                style={{ fontSize: '0.825rem', padding: '0.3rem 0.6rem', height: 'auto', minWidth: '150px' }}
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder="Search code or warehouse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                fontSize: '0.825rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                width: '210px',
              }}
            />
          </div>
        </div>

        {/* Tab 1, 2, 3: Warehouse Valuation Table */}
        {activeTab !== 'transit' && (
          <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
            <table className="data-table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Item Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Warehouse</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>On-Hand Qty</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Avg Unit Cost</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredValuation.length ? (
                  filteredValuation.map((row) => {
                    const itemIsBook = isBook(row.item_code);
                    return (
                      <tr key={`${row.item_id}-${row.warehouse_id}`}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          <span style={{ color: itemIsBook ? '#0369a1' : '#b45309' }}>
                            {row.item_code}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                              background: itemIsBook ? '#dcfce7' : '#fef3c7',
                              color: itemIsBook ? '#166534' : '#92400e',
                            }}
                          >
                            {itemIsBook ? 'Finished Book' : 'Raw Material'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                          {row.warehouse_code}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                          {Number(row.on_hand_qty).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                          {formatBDT(row.average_unit_cost)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {formatBDT(row.stock_value)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                      No inventory balances found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: In-Transit Valuation Table */}
        {activeTab === 'transit' && (
          <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
            <table className="data-table" style={{ margin: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Transfer Ref</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Item Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Source ➔ Destination</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>In-Transit Qty</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Dispatch Cost</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Transit Value</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Dispatched Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransit.length ? (
                  filteredTransit.map((row) => (
                    <tr key={row.transfer_id}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <Link
                          href={`/inventory-warehouse/stock-transfer`}
                          style={{ color: '#0284c7', textDecoration: 'underline' }}
                        >
                          {row.transfer_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{row.item_code}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{row.source_code}</span>
                        <span style={{ color: '#94a3b8', margin: '0 0.35rem' }}>➔</span>
                        <span style={{ fontWeight: 600, color: '#0369a1' }}>{row.destination_code}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#d97706' }}>
                        {Number(row.in_transit_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                        {formatBDT(row.dispatch_unit_cost)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatBDT(row.stock_value)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.825rem' }}>
                        {new Date(row.dispatched_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                      🚚 No shipments currently in transit between warehouses.
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
