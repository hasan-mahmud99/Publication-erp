"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Row = Record<string, any>;
type Valuation = {
  basis: string;
  rows: Row[];
  inTransitRows: Row[];
  totals: { on_hand_value: string; in_transit_value: string };
};

const day = (value: unknown) => String(value || '').slice(0, 10);
const money = (value: unknown) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactMoney = (val: number) => {
  if (val >= 10000000) return `BDT ${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `BDT ${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `BDT ${(val / 1000).toFixed(1)}k`;
  return `BDT ${val.toFixed(0)}`;
};
const qty = (value: unknown) => Math.round(Number(value || 0)).toLocaleString();

function currentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

function getPresetRange(preset: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = fmt(now);

  switch (preset) {
    case 'this_month': {
      const y = now.getFullYear();
      const m = pad(now.getMonth() + 1);
      return { from: `${y}-${m}-01`, to: today };
    }
    case 'last_30_days': {
      const past = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return { from: fmt(past), to: today };
    }
    case 'last_90_days': {
      const past = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      return { from: fmt(past), to: today };
    }
    case 'ytd': {
      return { from: `${now.getFullYear()}-01-01`, to: today };
    }
    case 'all_time': {
      return { from: `${now.getFullYear() - 2}-01-01`, to: today };
    }
    default:
      return null;
  }
}

export function ReportInventoryScreen() {
  const initial = getPresetRange('last_90_days') || currentMonth();
  const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string>('last_90_days');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'books' | 'raw'>('all');
  const [stockHealthFilter, setStockHealthFilter] = useState<'all' | 'healthy' | 'low' | 'reserved' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [balances, setBalances] = useState<Row[]>([]);
  const [movements, setMovements] = useState<Row[]>([]);
  const [reconciliation, setReconciliation] = useState<{ checked: number; reconciled: boolean; mismatches: Row[] } | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [canViewCost, setCanViewCost] = useState(false);

  const [activeTab, setActiveTab] = useState<'balances' | 'movements' | 'reconciliation' | 'valuation'>('balances');
  const [balancePage, setBalancePage] = useState(0);
  const [movementPage, setMovementPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');

  const pageSize = 20;

  async function load() {
    if (from && to && from > to) {
      setError('Start date must not exceed end date');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (warehouseId) params.set('warehouseId', warehouseId);

      const [me, warehouseResult, balanceResult, movementResult, reconcileResult] = await Promise.all([
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
        api<{ data: Row[] }>('/warehouses'),
        api<{ data: Row[] }>('/inventory/balances'),
        api<{ data: { rows: Row[] } }>(`/inventory/movement-analysis?${params}`),
        api<{ data: { checked: number; reconciled: boolean; mismatches: Row[] } }>('/inventory/reconciliation'),
      ]);

      const cost = me.data.role === 'Owner' || me.data.permissions.includes('finance.read');
      setCanViewCost(cost);
      setWarehouses(warehouseResult.data);
      setBalances(balanceResult.data);
      setMovements(movementResult.data.rows);
      setReconciliation(reconcileResult.data);

      if (cost) {
        try {
          const valRes = await api<{ data: Valuation }>('/inventory/valuation');
          setValuation(valRes.data);
        } catch {
          setValuation(null);
        }
      } else {
        setValuation(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Inventory report failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [warehouseId, from, to]);

  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const range = getPresetRange(preset);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
      setMovementPage(0);
    }
  };

  const handleResetFilters = () => {
    const range = getPresetRange('last_90_days') || currentMonth();
    setWarehouseId('');
    setItemTypeFilter('all');
    setStockHealthFilter('all');
    setSearchQuery('');
    setFrom(range.from);
    setTo(range.to);
    setActivePreset('last_90_days');
    setBalancePage(0);
    setMovementPage(0);
  };

  // Filtered Balances
  const filteredBalances = useMemo(() => {
    return balances.filter(row => {
      // Warehouse filter
      if (warehouseId && row.warehouse_id !== warehouseId) return false;

      // Item type filter
      const isBook = Boolean(row.book_title || row.edition_id);
      if (itemTypeFilter === 'books' && !isBook) return false;
      if (itemTypeFilter === 'raw' && isBook) return false;

      // Stock health filter
      const onHand = Number(row.on_hand_qty || 0);
      const available = Number(row.available_qty || 0);
      const reserved = Number(row.reserved_qty || 0);

      if (stockHealthFilter === 'healthy' && available < 100) return false;
      if (stockHealthFilter === 'low' && (available >= 50 || available <= 0)) return false;
      if (stockHealthFilter === 'reserved' && reserved <= 0) return false;
      if (stockHealthFilter === 'out' && onHand > 0) return false;

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = String(row.item_code || '').toLowerCase().includes(q);
        const matchesTitle = String(row.book_title || row.item_name || '').toLowerCase().includes(q);
        const matchesWarehouse = String(row.warehouse_name || row.warehouse_code || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesWarehouse) return false;
      }

      return true;
    });
  }, [balances, warehouseId, itemTypeFilter, stockHealthFilter, searchQuery]);

  // Key Aggregations
  const totalOnHandUnits = useMemo(
    () => filteredBalances.reduce((acc, row) => acc + Number(row.on_hand_qty || 0), 0),
    [filteredBalances]
  );
  const totalReservedUnits = useMemo(
    () => filteredBalances.reduce((acc, row) => acc + Number(row.reserved_qty || 0), 0),
    [filteredBalances]
  );
  const totalAvailableUnits = useMemo(
    () => filteredBalances.reduce((acc, row) => acc + Number(row.available_qty || 0), 0),
    [filteredBalances]
  );
  const totalStockValue = useMemo(() => {
    return filteredBalances.reduce((acc, row) => {
      const qtyVal = Number(row.on_hand_qty || 0);
      const cost = Number(row.average_unit_cost || 0);
      return acc + (qtyVal * cost);
    }, 0);
  }, [filteredBalances]);

  // Movement Aggregations
  const totalQuantityIn = useMemo(
    () => movements.reduce((acc, m) => acc + Number(m.quantity_in || 0), 0),
    [movements]
  );
  const totalQuantityOut = useMemo(
    () => movements.reduce((acc, m) => acc + Number(m.quantity_out || 0), 0),
    [movements]
  );

  // Warehouse breakdown for charts
  const warehouseStockBreakdown = useMemo(() => {
    const map = new Map<string, { code: string; name: string; id: string; onHand: number; reserved: number; available: number }>();
    for (const b of balances) {
      const code = b.warehouse_code || 'Unknown';
      const existing = map.get(code) || {
        code,
        name: b.warehouse_name || code,
        id: b.warehouse_id,
        onHand: 0,
        reserved: 0,
        available: 0,
      };
      existing.onHand += Number(b.on_hand_qty || 0);
      existing.reserved += Number(b.reserved_qty || 0);
      existing.available += Number(b.available_qty || 0);
      map.set(code, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.onHand - a.onHand);
  }, [balances]);

  const maxWarehouseOnHand = Math.max(1, ...warehouseStockBreakdown.map(w => w.onHand));
  const activeWarehouseObj = warehouses.find(w => w.id === warehouseId);

  // CSV Export functions
  const exportStockCsv = () => {
    try {
      const headers = ['Item Code', 'Item Name', 'Book Title', 'Edition', 'Warehouse Code', 'Warehouse Name', 'On Hand', 'Reserved', 'Available', 'Avg Unit Cost BDT', 'Total Value BDT'];
      const rows = filteredBalances.map(r => [
        `"${r.item_code || ''}"`,
        `"${r.item_name || ''}"`,
        `"${r.book_title || ''}"`,
        `"${r.edition_number || ''}"`,
        `"${r.warehouse_code || ''}"`,
        `"${r.warehouse_name || ''}"`,
        r.on_hand_qty || 0,
        r.reserved_qty || 0,
        r.available_qty || 0,
        r.average_unit_cost || 0,
        (Number(r.on_hand_qty || 0) * Number(r.average_unit_cost || 0)).toFixed(2),
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-stock-${warehouseId ? (activeWarehouseObj?.code || 'warehouse') : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportNotice('Stock balances CSV exported successfully.');
    } catch {
      setError('Failed to export stock CSV.');
    }
  };

  const exportMovementsCsv = () => {
    try {
      const headers = ['Movement Date', 'Item Code', 'Item Name', 'Warehouse', 'Transaction Type', 'Document Type', 'Documents', 'Quantity In', 'Quantity Out'];
      const rows = movements.map(m => [
        `"${day(m.movement_date)}"`,
        `"${m.item_code || ''}"`,
        `"${m.item_name || ''}"`,
        `"${m.warehouse_code || ''}"`,
        `"${m.transaction_type || ''}"`,
        `"${m.document_type || ''}"`,
        m.documents || 1,
        m.quantity_in || 0,
        m.quantity_out || 0,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-movements-${from}-to-${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportNotice('Movement history CSV exported successfully.');
    } catch {
      setError('Failed to export movements CSV.');
    }
  };

  // Pagination slices
  const paginatedBalances = filteredBalances.slice(balancePage * pageSize, (balancePage + 1) * pageSize);
  const totalBalancePages = Math.max(1, Math.ceil(filteredBalances.length / pageSize));

  const paginatedMovements = movements.slice(movementPage * pageSize, (movementPage + 1) * pageSize);
  const totalMovementPages = Math.max(1, Math.ceil(movements.length / pageSize));

  return (
    <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Quick Action Hub */}
      <div className="page-heading" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px' }}>
              INVENTORY TELEMETRY
            </span>
            <span className="badge badge-green">Live Ledger &amp; Stock Balance</span>
            {activeWarehouseObj && (
              <span className="badge badge-blue">Warehouse: {activeWarehouseObj.code}</span>
            )}
          </div>
          <h1 className="page-title">Inventory Reports &amp; Stock Analysis</h1>
          <p className="muted">
            Real-time physical warehouse stock balances, posted movement ledger, and statutory reconciliation controls.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => void load()}
            disabled={loading}
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={exportStockCsv}
            disabled={!filteredBalances.length}
          >
            <span>⬇</span>
            <span>Export Stock CSV</span>
          </button>

          <button
            type="button"
            className="btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={exportMovementsCsv}
            disabled={!movements.length}
          >
            <span>📋</span>
            <span>Export Movements CSV</span>
          </button>

          <Link className="btn" href="/inventory-warehouse/stock-by-book-edition">
            Stock Register ➔
          </Link>
        </div>
      </div>

      {error && <div className="alert-error" role="alert">{error}</div>}
      {exportNotice && (
        <div className="alert-success" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Telemetry KPI Strip */}
      <div className="stat-grid" style={{ marginTop: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="panel stat">
          <div className="stat-label">TOTAL PHYSICAL ON-HAND</div>
          <div className="stat-value" style={{ color: '#047857' }}>
            {qty(totalOnHandUnits)}
          </div>
          <div className="stat-sub muted">{filteredBalances.length} stock/location pairs</div>
        </div>

        <div className="panel stat">
          <div className="stat-label">AVAILABLE FOR SALE</div>
          <div className="stat-value" style={{ color: 'var(--brand)' }}>
            {qty(totalAvailableUnits)}
          </div>
          <div className="stat-sub muted">Net unreserved physical stock</div>
        </div>

        <div className="panel stat">
          <div className="stat-label">RESERVED ALLOCATIONS</div>
          <div className="stat-value" style={{ color: totalReservedUnits > 0 ? '#b45309' : 'var(--text)' }}>
            {qty(totalReservedUnits)}
          </div>
          <div className="stat-sub muted">
            {totalOnHandUnits > 0 ? `${((totalReservedUnits / totalOnHandUnits) * 100).toFixed(1)}% of total stock` : 'Orders & Fairs'}
          </div>
        </div>

        <div className="panel stat">
          <div className="stat-label">TOTAL STOCK VALUE (BDT)</div>
          <div className="stat-value" style={{ color: '#0f766e' }}>
            {canViewCost ? `BDT ${money(totalStockValue)}` : 'Restricted'}
          </div>
          <div className="stat-sub muted">
            {canViewCost ? 'Weighted-average cost basis' : 'Requires Finance permission'}
          </div>
        </div>

        <div className="panel stat">
          <div className="stat-label">LEDGER RECONCILIATION</div>
          <div className="stat-value compact" style={{ color: reconciliation?.reconciled ? '#047857' : '#dc2626' }}>
            {reconciliation?.reconciled ? 'Matched' : 'Exceptions'}
          </div>
          <div className="stat-sub muted">
            {reconciliation ? `${reconciliation.mismatches.length} mismatches / ${reconciliation.checked} checked` : 'Auditing…'}
          </div>
        </div>
      </div>

      {/* Seamless Filter Section */}
      <section className="panel" style={{ padding: '18px 20px', borderRadius: '12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Row 1: Category, Health Switches & Movement Date Presets */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
          
          {/* Item Category Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Category:
            </span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'books', label: '📚 Finished Books' },
                { id: 'raw', label: '📄 Raw Materials' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: itemTypeFilter === opt.id ? 700 : 500,
                    border: 'none',
                    background: itemTypeFilter === opt.id ? '#fff' : 'transparent',
                    color: itemTypeFilter === opt.id ? 'var(--brand)' : '#475569',
                    cursor: 'pointer',
                    boxShadow: itemTypeFilter === opt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  onClick={() => { setItemTypeFilter(opt.id as any); setBalancePage(0); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Health Level Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Stock Level:
            </span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'healthy', label: '🟢 Healthy (>100)' },
                { id: 'low', label: '🟡 Low Stock (<50)' },
                { id: 'reserved', label: '🔵 Has Reservations' },
                { id: 'out', label: '🔴 Out of Stock' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: stockHealthFilter === opt.id ? 700 : 500,
                    border: 'none',
                    background: stockHealthFilter === opt.id ? '#fff' : 'transparent',
                    color: stockHealthFilter === opt.id ? 'var(--brand)' : '#475569',
                    cursor: 'pointer',
                    boxShadow: stockHealthFilter === opt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  onClick={() => { setStockHealthFilter(opt.id as any); setBalancePage(0); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Movement Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Period:
            </span>
            {[
              { id: 'this_month', label: 'This Month' },
              { id: 'last_30_days', label: '30 Days' },
              { id: 'last_90_days', label: '90 Days' },
              { id: 'all_time', label: 'All Time' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: activePreset === p.id ? 700 : 500,
                  border: '1px solid',
                  borderColor: activePreset === p.id ? 'var(--brand)' : 'var(--line)',
                  background: activePreset === p.id ? 'var(--brand)' : '#f8fafc',
                  color: activePreset === p.id ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
                onClick={() => handleApplyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Warehouse Dropdown, Live Search & Movement Custom Date Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.4fr) minmax(200px, 1.3fr) minmax(140px, 1fr) minmax(140px, 1fr) auto auto', gap: '12px', alignItems: 'flex-end' }}>
          
          <label className="field" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Warehouse Facility</span>
              {warehouseId && (
                <button
                  type="button"
                  onClick={() => { setWarehouseId(''); setBalancePage(0); }}
                  style={{ fontSize: '11px', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Clear ✕
                </button>
              )}
            </div>
            <select
              className="input"
              value={warehouseId}
              onChange={e => { setWarehouseId(e.target.value); setBalancePage(0); }}
              style={{ fontWeight: warehouseId ? 700 : 400 }}
            >
              <option value="">🏢 All Warehouses ({balances.length} items)</option>
              {warehouses.map(w => {
                const count = balances.filter(b => b.warehouse_id === w.id).length;
                return (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_type === 'fair' ? '🎪' : '📦'} {w.code} · {w.name.replace('DEMO | ', '')} ({count} items)
                  </option>
                );
              })}
            </select>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Search SKU, Title, or Warehouse</span>
            <input
              className="input"
              type="text"
              placeholder="e.g. Science Handbook, BK1, Art Card..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setBalancePage(0); }}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Movements From</span>
            <input
              className="input"
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setActivePreset('custom'); setMovementPage(0); }}
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Movements To</span>
            <input
              className="input"
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setActivePreset('custom'); setMovementPage(0); }}
            />
          </label>

          <button
            type="button"
            className="btn btn-primary"
            style={{ height: '40px', padding: '0 20px', fontWeight: 700 }}
            onClick={() => void load()}
            disabled={loading}
          >
            Apply Filters
          </button>

          <button
            type="button"
            className="btn"
            style={{ height: '40px', padding: '0 16px' }}
            onClick={handleResetFilters}
          >
            Reset
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--muted)', paddingTop: '4px' }}>
          <span>
            Displaying: <strong>{filteredBalances.length}</strong> of {balances.length} stock pairs
            {warehouseId && <> · Facility: <strong>{activeWarehouseObj?.name}</strong></>}
            {searchQuery && <> · Query: &quot;<strong>{searchQuery}</strong>&quot;</>}
          </span>
          <span>Dates filter posted movements. Physical stock balances reflect current live ledger state.</span>
        </div>
      </section>

      {/* Visual Analytics & Simple Charts Section */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        
        {/* Chart 1: Stock Distribution by Warehouse */}
        <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  Warehouse Stock Distribution
                </h3>
                <small className="muted">Physical on-hand volume across storage locations</small>
              </div>
              <span className="badge badge-blue">{warehouseStockBreakdown.length} Facilities</span>
            </div>

            {warehouseStockBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {warehouseStockBreakdown.map(wh => {
                  const pct = totalOnHandUnits > 0 ? ((wh.onHand / totalOnHandUnits) * 100).toFixed(1) : '0';
                  const isSelected = warehouseId === wh.id;

                  return (
                    <div
                      key={wh.code}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onClick={() => { setWarehouseId(isSelected ? '' : wh.id); setBalancePage(0); }}
                      title={`Click to filter by ${wh.name}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--brand)' : '#1e293b' }}>
                          {wh.code} · {wh.name.replace('DEMO | ', '')} {isSelected && '(Filtered)'}
                        </span>
                        <span>
                          <strong>{qty(wh.onHand)} pcs</strong> <span className="muted" style={{ fontSize: '11px' }}>({pct}%)</span>
                        </span>
                      </div>

                      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isSelected ? 'var(--brand)' : 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                        <span>Available: {qty(wh.available)}</span>
                        {wh.reserved > 0 && <span style={{ color: '#b45309' }}>Reserved: {qty(wh.reserved)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel empty" style={{ minHeight: '120px', display: 'grid', placeItems: 'center' }}>
                No warehouse stock records found.
              </div>
            )}
          </div>

          {/* Allocation & Availability Ratio Meter */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              <span>Stock Availability vs. Commitments</span>
              <span style={{ color: totalReservedUnits > 0 ? '#b45309' : '#047857' }}>
                {totalOnHandUnits > 0 ? `${((totalAvailableUnits / totalOnHandUnits) * 100).toFixed(1)}% Available` : '0%'}
              </span>
            </div>
            <div style={{ display: 'flex', height: '10px', width: '100%', borderRadius: '5px', overflow: 'hidden', background: '#e2e8f0' }}>
              <div
                style={{ width: `${totalOnHandUnits > 0 ? (totalAvailableUnits / totalOnHandUnits) * 100 : 100}%`, background: '#059669' }}
                title="Available Unreserved Stock"
              />
              <div
                style={{ width: `${totalOnHandUnits > 0 ? (totalReservedUnits / totalOnHandUnits) * 100 : 0}%`, background: '#f59e0b' }}
                title="Reserved Stock"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              <span>Available: {qty(totalAvailableUnits)}</span>
              <span>Reserved: {qty(totalReservedUnits)}</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Movement Velocity & Inflow vs Outflow */}
        <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  Movement Inflow &amp; Outflow Analysis
                </h3>
                <small className="muted">Posted stock transfers, receipts, and dispatches in period</small>
              </div>
              <span className="badge badge-green">{movements.length} Movements</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Total Inflow (+ Receipts)
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                  +{qty(totalQuantityIn)}
                </div>
                <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                  Production &amp; Opening Stock
                </div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  Total Outflow (- Issues)
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                  -{qty(totalQuantityOut)}
                </div>
                <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                  Dispatches &amp; Transfers Out
                </div>
              </div>
            </div>

            {/* Recent Movement Activity Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Recent Movement Transactions:
              </span>
              {movements.slice(0, 4).map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <strong>{m.item_code}</strong> · <span className="muted">{m.warehouse_code}</span>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {day(m.movement_date)} · {m.document_type || m.transaction_type}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {Number(m.quantity_in || 0) > 0 && (
                      <span style={{ fontWeight: 700, color: '#047857' }}>+{qty(m.quantity_in)}</span>
                    )}
                    {Number(m.quantity_out || 0) > 0 && (
                      <span style={{ fontWeight: 700, color: '#dc2626' }}>-{qty(m.quantity_out)}</span>
                    )}
                  </div>
                </div>
              ))}
              {movements.length === 0 && (
                <div className="panel empty" style={{ minHeight: '80px', display: 'grid', placeItems: 'center' }}>
                  No posted movements in the selected date span.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '12px' }}
              onClick={() => setActiveTab('movements')}
            >
              View Full Movement Ledger ({movements.length}) ➔
            </button>
          </div>
        </div>
      </section>

      {/* Tabbed Detailed Registers */}
      <section className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'balances', label: `Stock Balances (${filteredBalances.length})` },
              { id: 'movements', label: `Posted Movements (${movements.length})` },
              { id: 'reconciliation', label: `Reconciliation Audit (${reconciliation?.mismatches.length || 0})` },
              ...(valuation ? [{ id: 'valuation', label: 'Valuation Ledger' }] : []),
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  border: 'none',
                  background: activeTab === tab.id ? '#eff6ff' : 'transparent',
                  color: activeTab === tab.id ? 'var(--brand)' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'balances' && (
            <span className="badge badge-blue">Page {balancePage + 1} of {totalBalancePages}</span>
          )}
          {activeTab === 'movements' && (
            <span className="badge badge-green">Page {movementPage + 1} of {totalMovementPages}</span>
          )}
        </div>

        {/* Tab 1: Current Stock Balances Table */}
        {activeTab === 'balances' && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item SKU</th>
                    <th>Book / Item Description</th>
                    <th>Warehouse Facility</th>
                    <th>On Hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    {canViewCost && <th>Avg Cost (BDT)</th>}
                    {canViewCost && <th>Stock Value (BDT)</th>}
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBalances.length ? (
                    paginatedBalances.map(row => {
                      const onHand = Number(row.on_hand_qty || 0);
                      const reserved = Number(row.reserved_qty || 0);
                      const available = Number(row.available_qty || 0);
                      const cost = Number(row.average_unit_cost || 0);
                      const val = onHand * cost;
                      const isBook = Boolean(row.book_title || row.edition_id);

                      return (
                        <tr key={`${row.item_id}-${row.warehouse_id}`}>
                          <td>
                            <strong>{row.item_code}</strong>
                            <div>
                              <span className={`badge ${isBook ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                                {isBook ? 'Book' : 'Raw Material'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <strong>{row.book_title || row.item_name}</strong>
                            {row.edition_number && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Edition {row.edition_number}</div>
                            )}
                          </td>
                          <td>
                            <strong>{row.warehouse_code}</strong>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{row.warehouse_name}</div>
                          </td>
                          <td>
                            <strong style={{ fontSize: '13.5px' }}>{qty(onHand)}</strong>
                          </td>
                          <td>
                            {reserved > 0 ? (
                              <span style={{ color: '#b45309', fontWeight: 600 }}>{qty(reserved)}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge ${available >= 100 ? 'badge-green' : available > 0 ? 'badge-amber' : 'badge-red'}`}
                              style={{ fontWeight: 700 }}
                            >
                              {qty(available)} pcs
                            </span>
                          </td>
                          {canViewCost && (
                            <td className="muted">BDT {money(cost)}</td>
                          )}
                          {canViewCost && (
                            <td>
                              <strong style={{ color: '#047857' }}>BDT {money(val)}</strong>
                            </td>
                          )}
                          <td style={{ textAlign: 'right' }}>
                            <Link
                              className="btn"
                              href={`/inventory-warehouse/stock-by-book-edition?item=${row.item_code}`}
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              Stock Details ➔
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={canViewCost ? 9 : 7} className="empty">
                        No stock records match the selected warehouse and category filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="btn"
                disabled={balancePage === 0}
                onClick={() => setBalancePage(p => p - 1)}
              >
                Previous
              </button>
              <span className="muted" style={{ fontSize: '12px' }}>
                Showing {balancePage * pageSize + 1}–{Math.min(filteredBalances.length, (balancePage + 1) * pageSize)} of {filteredBalances.length}
              </span>
              <button
                type="button"
                className="btn"
                disabled={(balancePage + 1) * pageSize >= filteredBalances.length}
                onClick={() => setBalancePage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Tab 2: Posted Movement Ledger Table */}
        {activeTab === 'movements' && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item SKU</th>
                    <th>Item Description</th>
                    <th>Warehouse</th>
                    <th>Transaction Type</th>
                    <th>Document Reference</th>
                    <th>Inflow (+ Qty)</th>
                    <th>Outflow (- Qty)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.length ? (
                    paginatedMovements.map((row, index) => {
                      const qtyIn = Number(row.quantity_in || 0);
                      const qtyOut = Number(row.quantity_out || 0);
                      return (
                        <tr key={index}>
                          <td>{day(row.movement_date)}</td>
                          <td><strong>{row.item_code}</strong></td>
                          <td>{row.item_name}</td>
                          <td><span className="badge badge-blue">{row.warehouse_code}</span></td>
                          <td>
                            <span className={`badge ${row.transaction_type === 'receipt' ? 'badge-green' : row.transaction_type === 'dispatch' ? 'badge-amber' : 'badge-blue'}`}>
                              {row.transaction_type}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {row.document_type || 'Manual movement'} ({row.documents} doc)
                          </td>
                          <td>
                            {qtyIn > 0 ? (
                              <strong style={{ color: '#047857' }}>+{qty(qtyIn)}</strong>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            {qtyOut > 0 ? (
                              <strong style={{ color: '#dc2626' }}>-{qty(qtyOut)}</strong>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="empty">
                        No posted movements recorded in this date span.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="btn"
                disabled={movementPage === 0}
                onClick={() => setMovementPage(p => p - 1)}
              >
                Previous
              </button>
              <span className="muted" style={{ fontSize: '12px' }}>
                Showing {movementPage * pageSize + 1}–{Math.min(movements.length, (movementPage + 1) * pageSize)} of {movements.length}
              </span>
              <button
                type="button"
                className="btn"
                disabled={(movementPage + 1) * pageSize >= movements.length}
                onClick={() => setMovementPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Tab 3: Ledger Reconciliation & Audits */}
        {activeTab === 'reconciliation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: reconciliation?.reconciled ? '#f0fdf4' : '#fffbeb', border: '1px solid', borderColor: reconciliation?.reconciled ? '#bbf7d0' : '#fde68a', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: reconciliation?.reconciled ? '#166534' : '#92400e' }}>
                  {reconciliation?.reconciled ? '✓ All Physical Balances Match Control Ledger' : '⚠ Discrepancies Detected During Reconciliation'}
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: reconciliation?.reconciled ? '#15803d' : '#b45309' }}>
                  Audited <strong>{reconciliation?.checked ?? 0}</strong> item-warehouse ledger pairs against physical movement journals.
                </p>
              </div>

              <Link className="btn btn-primary" href="/reports-analytics/data-quality-and-reconciliation-report">
                Detailed Audit Control Report ➔
              </Link>
            </div>

            {reconciliation && reconciliation.mismatches.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item ID</th>
                      <th>Warehouse ID</th>
                      <th>Physical On-Hand</th>
                      <th>Reserved Units</th>
                      <th>Ledger Account Balance</th>
                      <th>Discrepancy Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliation.mismatches.map((m, idx) => {
                      const onHand = Number(m.on_hand_qty || 0);
                      const ledger = Number(m.ledger_qty || 0);
                      const delta = onHand - ledger;

                      return (
                        <tr key={idx}>
                          <td><code>{m.item_id}</code></td>
                          <td><code>{m.warehouse_id}</code></td>
                          <td><strong>{qty(onHand)}</strong></td>
                          <td>{qty(m.reserved_qty)}</td>
                          <td>{qty(ledger)}</td>
                          <td>
                            <span className="badge badge-red" style={{ fontWeight: 700 }}>
                              {delta > 0 ? `+${qty(delta)}` : qty(delta)} variance
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Valuation Ledger */}
        {activeTab === 'valuation' && valuation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                Valuation Accounting Basis
              </h4>
              <p style={{ margin: '4px 0 10px', fontSize: '12.5px', color: 'var(--muted)' }}>
                {valuation.basis}. Current live snapshot; requires authorized Finance read access.
              </p>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>CURRENT ON-HAND VALUE</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857' }}>
                    BDT {money(valuation.totals.on_hand_value)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>IN-TRANSIT VALUE</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#b45309' }}>
                    BDT {money(valuation.totals.in_transit_value)}
                  </div>
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Warehouse Facility</th>
                    <th>On-Hand Quantity</th>
                    <th>Weighted Avg Cost (BDT)</th>
                    <th>Calculated Stock Value (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {valuation.rows.slice(0, 50).map(row => (
                    <tr key={`${row.item_id}-${row.warehouse_id}`}>
                      <td><strong>{row.item_code}</strong></td>
                      <td>{row.warehouse_code}</td>
                      <td>{qty(row.on_hand_qty)}</td>
                      <td>BDT {money(row.average_unit_cost)}</td>
                      <td><strong style={{ color: '#047857' }}>BDT {money(row.stock_value)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {valuation.rows.length > 50 && (
              <p className="muted" style={{ fontSize: '12px' }}>
                Showing top 50 valued items. Download full CSV for complete inventory valuation.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Statutory Caveat & Footer Info */}
      <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '12px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span>
          Audited against <code>stock_balances</code>, <code>inventory_transaction_lines</code>, and <code>warehouses</code>. Transfers between warehouses preserve historical cost layers.
        </span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/reports-analytics/report-center" style={{ fontWeight: 600, color: 'var(--brand)' }}>
            Report Center ➔
          </Link>
          <Link href="/inventory-warehouse/warehouse-list" style={{ fontWeight: 600, color: 'var(--brand)' }}>
            Warehouses Management ➔
          </Link>
        </div>
      </div>
    </div>
  );
}
