'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

export interface SlowStockRow {
  item_id: string;
  warehouse_id: string;
  item_code: string;
  item_name: string;
  warehouse_code: string;
  on_hand_qty: string;
  reserved_qty: string;
  stock_value: string;
  last_issue_at: string | null;
  first_receipt_at: string | null;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

interface SlowMovingStockViewProps {
  screen: { title: string; description: string; path: string };
  warehouses: WarehouseOption[];
  slowStock: SlowStockRow[];
  analysisWarehouse: string;
  setAnalysisWarehouse: (w: string) => void;
  slowDays: string;
  setSlowDays: (d: string) => void;
  onRefresh: () => Promise<void>;
  busy: boolean;
}

export function SlowMovingStockView({
  screen,
  warehouses,
  slowStock,
  analysisWarehouse,
  setAnalysisWarehouse,
  slowDays,
  setSlowDays,
  onRefresh,
  busy,
}: SlowMovingStockViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'high_value' | 'never_issued' | 'critical'>('all');

  // Calculate days dormant from now
  const calculateDaysDormant = (lastIssue: string | null, firstReceipt: string | null): number => {
    const referenceDate = lastIssue || firstReceipt;
    if (!referenceDate) return 0;
    const diffMs = Date.now() - new Date(referenceDate).getTime();
    return Math.max(0, Math.floor(diffMs / 86400000));
  };

  // Metrics summary
  const metrics = useMemo(() => {
    let totalQuantity = 0;
    let totalTiedUpCapital = 0;
    let maxDormantDays = 0;

    for (const row of slowStock) {
      totalQuantity += Number(row.on_hand_qty || 0);
      totalTiedUpCapital += Number(row.stock_value || 0);
      const days = calculateDaysDormant(row.last_issue_at, row.first_receipt_at);
      if (days > maxDormantDays) maxDormantDays = days;
    }

    return {
      totalItems: slowStock.length,
      totalQuantity,
      totalTiedUpCapital,
      maxDormantDays,
    };
  }, [slowStock]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return slowStock.filter(row => {
      const daysDormant = calculateDaysDormant(row.last_issue_at, row.first_receipt_at);
      const val = Number(row.stock_value || 0);

      // Tab filter
      if (activeTab === 'high_value' && val < 50000) return false;
      if (activeTab === 'never_issued' && row.last_issue_at !== null) return false;
      if (activeTab === 'critical' && daysDormant < 180) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = row.item_code.toLowerCase().includes(q);
        const matchName = row.item_name.toLowerCase().includes(q);
        const matchWh = row.warehouse_code.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchWh) return false;
      }

      return true;
    });
  }, [slowStock, activeTab, searchQuery]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📦</span>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {screen.title}
            </h1>
            <span style={{
              background: '#fef3c7',
              color: '#92400e',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              border: '1px solid #fde68a',
            }}>
              {slowStock.length} Inactive Items
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Detect stagnant inventory without recent sales or issues. Review tied-up capital and plan liquidation, promotions, or warehouse rebalances.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="input"
            style={{ fontSize: '0.85rem', width: 'auto', minWidth: '180px' }}
            value={analysisWarehouse}
            onChange={e => {
              setAnalysisWarehouse(e.target.value);
            }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void onRefresh()}
            style={{ fontSize: '0.85rem' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Inactivity Threshold Quick Selectors */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.85rem 1rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
            Inactivity Period Threshold:
          </span>
          {[
            { days: '30', label: '30 Days' },
            { days: '60', label: '60 Days' },
            { days: '90', label: '90 Days (Standard)' },
            { days: '180', label: '180 Days' },
            { days: '365', label: '1 Year (Critical)' },
          ].map(preset => {
            const isSelected = slowDays === preset.days;
            return (
              <button
                key={preset.days}
                type="button"
                className="btn"
                onClick={() => setSlowDays(preset.days)}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.6rem',
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? '#1e293b' : '#f8fafc',
                  color: isSelected ? '#ffffff' : '#475569',
                  borderColor: isSelected ? '#1e293b' : '#e2e8f0',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Custom:</span>
          <input
            type="number"
            min="1"
            max="3650"
            className="input"
            style={{ width: '80px', fontSize: '0.82rem', padding: '0.25rem 0.5rem' }}
            value={slowDays}
            onChange={e => setSlowDays(e.target.value)}
          />
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>days</span>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Slow-Moving Items
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            {metrics.totalItems.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Dormant for &gt;{slowDays} days
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Total Dormant Quantity
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e40af' }}>
            {metrics.totalQuantity.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Physical units sitting on shelf
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Tied-up Capital Value
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#9a3412' }}>
            BDT {metrics.totalTiedUpCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Holding value at weighted-average cost
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Max Inactivity
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            {metrics.maxDormantDays} Days
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Oldest dormant stock in warehouse
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.85rem',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All Stagnant (${slowStock.length})` },
            { key: 'high_value', label: '💰 High Value (>50k BDT)' },
            { key: 'critical', label: '🔴 Critical Inactivity (>180d)' },
            { key: 'never_issued', label: '⚠️ Never Issued' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              className="btn"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.65rem',
                fontWeight: activeTab === tab.key ? 700 : 500,
                background: activeTab === tab.key ? '#0f172a' : '#ffffff',
                color: activeTab === tab.key ? '#ffffff' : '#475569',
                borderColor: activeTab === tab.key ? '#0f172a' : '#e2e8f0',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: '1 1 220px', maxWidth: '300px' }}>
          <input
            type="text"
            className="input"
            style={{ fontSize: '0.85rem' }}
            placeholder="Search item, title, warehouse..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
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
                  Item Code &amp; Title
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Warehouse
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  On Hand
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Reserved
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                  Tied-Up Capital (BDT)
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Inactivity Status
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Quick Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map(row => {
                  const onHand = Number(row.on_hand_qty || 0);
                  const reserved = Number(row.reserved_qty || 0);
                  const stockVal = Number(row.stock_value || 0);
                  const days = calculateDaysDormant(row.last_issue_at, row.first_receipt_at);

                  return (
                    <tr key={`${row.item_id}-${row.warehouse_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {row.item_code}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {row.item_name}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', fontSize: '0.85rem', color: '#334155' }}>
                        {row.warehouse_code}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 700, color: '#0f172a' }}>
                        {onHand.toLocaleString()}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', color: reserved > 0 ? '#d97706' : '#94a3b8' }}>
                        {reserved > 0 ? reserved.toLocaleString() : '0'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 700, color: '#9a3412' }}>
                        {stockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: days >= 180 ? '#fef2f2' : days >= 90 ? '#fff7ed' : '#fefce8',
                            color: days >= 180 ? '#991b1b' : days >= 90 ? '#c2410c' : '#854d0e',
                            border: `1px solid ${days >= 180 ? '#fecaca' : days >= 90 ? '#fed7aa' : '#fef08a'}`,
                            alignSelf: 'flex-start',
                          }}>
                            {row.last_issue_at ? `Dormant ${days}d since last issue` : `Never issued (${days}d since receipt)`}
                          </span>

                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {row.last_issue_at
                              ? `Last issue: ${new Date(row.last_issue_at).toLocaleDateString()}`
                              : row.first_receipt_at
                              ? `First receipt: ${new Date(row.first_receipt_at).toLocaleDateString()}`
                              : 'No transaction date'}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <Link
                            href="/inventory-warehouse/stock-transfer"
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            title="Transfer stock to a faster-moving regional store or fair"
                          >
                            Transfer 🚚
                          </Link>

                          <Link
                            href="/sales-distribution/create-sales-order"
                            className="btn btn-primary"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            title="Create sales order to liquidate or discount item"
                          >
                            Sell 🏷️
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    {searchQuery
                      ? 'No slow-moving items match your search filter.'
                      : `No inventory found with over ${slowDays} days of inactivity in selected warehouse.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
