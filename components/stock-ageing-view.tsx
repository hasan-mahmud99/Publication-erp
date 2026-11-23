'use client';

import React, { useMemo, useState } from 'react';

export interface AgeingStockRow {
  item_id: string;
  item_code: string;
  item_name: string;
  warehouse_id: string;
  warehouse_code: string;
  on_hand_qty: string;
  days_0_30: string;
  days_31_90: string;
  days_91_180: string;
  days_181_365: string;
  days_over_365: string;
  unattributed_qty: string;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

interface StockAgeingViewProps {
  screen: { title: string; description: string; path: string };
  warehouses: WarehouseOption[];
  ageingStock: AgeingStockRow[];
  analysisWarehouse: string;
  setAnalysisWarehouse: (w: string) => void;
  onRefresh: () => Promise<void>;
  busy: boolean;
}

export function StockAgeingView({
  screen,
  warehouses,
  ageingStock,
  analysisWarehouse,
  setAnalysisWarehouse,
  onRefresh,
  busy,
}: StockAgeingViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fresh' | 'normal' | 'maturing' | 'aged' | 'critical'>('all');

  // Aggregate metrics across dataset
  const metrics = useMemo(() => {
    let totalOnHand = 0;
    let total0to30 = 0;
    let total31to90 = 0;
    let total91to180 = 0;
    let total181to365 = 0;
    let totalOver365 = 0;
    let totalUnattributed = 0;

    for (const row of ageingStock) {
      totalOnHand += Number(row.on_hand_qty || 0);
      total0to30 += Number(row.days_0_30 || 0);
      total31to90 += Number(row.days_31_90 || 0);
      total91to180 += Number(row.days_91_180 || 0);
      total181to365 += Number(row.days_181_365 || 0);
      totalOver365 += Number(row.days_over_365 || 0);
      totalUnattributed += Number(row.unattributed_qty || 0);
    }

    const agedRiskUnits = total181to365 + totalOver365;
    const agedRiskPercent = totalOnHand > 0 ? ((agedRiskUnits / totalOnHand) * 100).toFixed(1) : '0';
    const freshPercent = totalOnHand > 0 ? ((total0to30 / totalOnHand) * 100).toFixed(1) : '0';

    return {
      totalItems: ageingStock.length,
      totalOnHand,
      total0to30,
      total31to90,
      total91to180,
      total181to365,
      totalOver365,
      totalUnattributed,
      agedRiskUnits,
      agedRiskPercent,
      freshPercent,
    };
  }, [ageingStock]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return ageingStock.filter(row => {
      // Tab filter
      if (activeTab === 'fresh' && Number(row.days_0_30 || 0) <= 0) return false;
      if (activeTab === 'normal' && Number(row.days_31_90 || 0) <= 0) return false;
      if (activeTab === 'maturing' && Number(row.days_91_180 || 0) <= 0) return false;
      if (activeTab === 'aged' && Number(row.days_181_365 || 0) <= 0) return false;
      if (activeTab === 'critical' && Number(row.days_over_365 || 0) <= 0) return false;

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
  }, [ageingStock, activeTab, searchQuery]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⏳</span>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {screen.title}
            </h1>
            <span style={{
              background: '#f1f5f9',
              color: '#475569',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
            }}>
              {ageingStock.length} Items Monitored
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            FIFO receipt-cohort stock ageing breakdown. Track how long inventory sits across warehouses to mitigate holding costs and obsolescence.
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

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Total Stock Monitored
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            {metrics.totalOnHand.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Across {metrics.totalItems} distinct warehouse balances
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Fresh Stock (0–30 Days)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#166534' }}>
            {metrics.total0to30.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>
            {metrics.freshPercent}% of total on-hand volume
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Active / Normal (31–180 Days)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e40af' }}>
            {(metrics.total31to90 + metrics.total91to180).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            31–90d: {metrics.total31to90.toLocaleString()} | 91–180d: {metrics.total91to180.toLocaleString()}
          </div>
        </div>

        <div style={{
          background: metrics.agedRiskUnits > 0 ? '#fff7ed' : '#ffffff',
          border: `1px solid ${metrics.agedRiskUnits > 0 ? '#fed7aa' : '#e2e8f0'}`,
          borderRadius: '8px',
          padding: '1rem',
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: metrics.agedRiskUnits > 0 ? '#c2410c' : '#64748b',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '0.25rem',
          }}>
            Aged Stock at Risk (&gt;180 Days)
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: metrics.agedRiskUnits > 0 ? '#9a3412' : '#0f172a',
          }}>
            {metrics.agedRiskUnits.toLocaleString()}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: metrics.agedRiskUnits > 0 ? '#ea580c' : '#64748b',
            marginTop: '0.2rem',
          }}>
            {metrics.agedRiskPercent}% of inventory | &gt;365d: {metrics.totalOver365.toLocaleString()} units
          </div>
        </div>
      </div>

      {/* Cohort Composition Ribbon */}
      {metrics.totalOnHand > 0 && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
              Overall Stock Ageing Distribution
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              FIFO Receipt-Cohort Estimate
            </span>
          </div>

          <div style={{
            display: 'flex',
            height: '14px',
            borderRadius: '9999px',
            overflow: 'hidden',
            background: '#f1f5f9',
            marginBottom: '0.75rem',
          }}>
            {metrics.total0to30 > 0 && (
              <div
                title={`0–30 Days: ${metrics.total0to30} units`}
                style={{ width: `${(metrics.total0to30 / metrics.totalOnHand) * 100}%`, background: '#22c55e' }}
              />
            )}
            {metrics.total31to90 > 0 && (
              <div
                title={`31–90 Days: ${metrics.total31to90} units`}
                style={{ width: `${(metrics.total31to90 / metrics.totalOnHand) * 100}%`, background: '#3b82f6' }}
              />
            )}
            {metrics.total91to180 > 0 && (
              <div
                title={`91–180 Days: ${metrics.total91to180} units`}
                style={{ width: `${(metrics.total91to180 / metrics.totalOnHand) * 100}%`, background: '#eab308' }}
              />
            )}
            {metrics.total181to365 > 0 && (
              <div
                title={`181–365 Days: ${metrics.total181to365} units`}
                style={{ width: `${(metrics.total181to365 / metrics.totalOnHand) * 100}%`, background: '#f97316' }}
              />
            )}
            {metrics.totalOver365 > 0 && (
              <div
                title={`>365 Days: ${metrics.totalOver365} units`}
                style={{ width: `${(metrics.totalOver365 / metrics.totalOnHand) * 100}%`, background: '#ef4444' }}
              />
            )}
            {metrics.totalUnattributed > 0 && (
              <div
                title={`Unattributed: ${metrics.totalUnattributed} units`}
                style={{ width: `${(metrics.totalUnattributed / metrics.totalOnHand) * 100}%`, background: '#cbd5e1' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              0–30d ({metrics.total0to30.toLocaleString()})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
              31–90d ({metrics.total31to90.toLocaleString()})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
              91–180d ({metrics.total91to180.toLocaleString()})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />
              181–365d ({metrics.total181to365.toLocaleString()})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              &gt;365d ({metrics.totalOver365.toLocaleString()})
            </span>
            {metrics.totalUnattributed > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} />
                Unattributed ({metrics.totalUnattributed.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
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
            { key: 'all', label: `All Items (${ageingStock.length})` },
            { key: 'fresh', label: '🟢 Fresh (0–30d)' },
            { key: 'normal', label: '🔵 Normal (31–90d)' },
            { key: 'maturing', label: '🟡 Maturing (91–180d)' },
            { key: 'aged', label: '🟠 Aged (181–365d)' },
            { key: 'critical', label: '🔴 Critical (>365d)' },
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

      {/* Main Table */}
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
                  Total On Hand
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>
                  0–30 Days
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#1e40af' }}>
                  31–90 Days
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#854d0e' }}>
                  91–180 Days
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#c2410c' }}>
                  181–365 Days
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#991b1b' }}>
                  &gt; 365 Days
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map(row => {
                  const onHand = Number(row.on_hand_qty || 0);
                  const d0_30 = Number(row.days_0_30 || 0);
                  const d31_90 = Number(row.days_31_90 || 0);
                  const d91_180 = Number(row.days_91_180 || 0);
                  const d181_365 = Number(row.days_181_365 || 0);
                  const dOver365 = Number(row.days_over_365 || 0);

                  const isCritical = dOver365 > 0;
                  const isAged = d181_365 > 0;
                  const isMaturing = d91_180 > 0;
                  const isFresh = d0_30 > 0 && !isCritical && !isAged;

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

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', color: d0_30 > 0 ? '#166534' : '#94a3b8', fontWeight: d0_30 > 0 ? 600 : 400 }}>
                        {d0_30 > 0 ? d0_30.toLocaleString() : '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', color: d31_90 > 0 ? '#1e40af' : '#94a3b8', fontWeight: d31_90 > 0 ? 600 : 400 }}>
                        {d31_90 > 0 ? d31_90.toLocaleString() : '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', color: d91_180 > 0 ? '#854d0e' : '#94a3b8', fontWeight: d91_180 > 0 ? 600 : 400 }}>
                        {d91_180 > 0 ? d91_180.toLocaleString() : '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', color: d181_365 > 0 ? '#c2410c' : '#94a3b8', fontWeight: d181_365 > 0 ? 700 : 400 }}>
                        {d181_365 > 0 ? d181_365.toLocaleString() : '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', verticalAlign: 'middle', color: dOver365 > 0 ? '#dc2626' : '#94a3b8', fontWeight: dOver365 > 0 ? 700 : 400 }}>
                        {dOver365 > 0 ? dOver365.toLocaleString() : '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                        {isCritical ? (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                          }}>
                            🔴 Over 1 Year
                          </span>
                        ) : isAged ? (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            background: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                          }}>
                            🟠 181–365d
                          </span>
                        ) : isMaturing ? (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            background: '#fefce8',
                            color: '#854d0e',
                            border: '1px solid #fef08a',
                          }}>
                            🟡 91–180d
                          </span>
                        ) : isFresh ? (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            background: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                          }}>
                            🟢 Fresh
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}>
                            ⚪ Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    {searchQuery ? 'No stock matching your search filter.' : 'No on-hand stock records found.'}
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
