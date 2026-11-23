"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import type { InventoryBalanceRow } from './inventory-overview-view';

type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };
type Item = { id: string; item_code: string; name: string; item_type: string; base_uom: string; tracking_policy: string; edition_id: string | null };
type Movement = { id: string; transaction_type: string; document_type: string; document_id: string; status: string; created_at: string; posted_at: string | null };
type MovementLine = { id: string; item_id: string; warehouse_id: string; quantity_delta: string; unit_cost: string | null; lot_number: string | null; bin_location: string | null };
type Dispatch = { id: string; invoice_line_id: string; item_code: string; invoice_number: string; warehouse_code: string; lot_number: string | null; bin_location: string | null; quantity: string; status: string; cost_amount: string | null; created_by: string; created_at?: string };
type Invoice = { id: string; invoice_number: string; invoice_date?: string; status: string; customer_name?: string; total_amount?: string; lines: Array<{ id: string; book_title: string; edition_id: string | null; quantity: number; sale_type: string; settlement_status: string }> };
type Lot = { lot_number: string; bin_location: string | null; on_hand_qty: string };

interface StockIssueViewProps {
  screen: Screen;
  balances: InventoryBalanceRow[];
  items: Item[];
  warehouses: warehousesProps[];
  movements: Movement[];
  canManage: boolean;
  canPost: boolean;
  canFinance: boolean;
  userId: string;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onSelectMovement: (id: string) => void;
}

type warehousesProps = Warehouse;

export interface LowStockProductRow {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  item_type: string;
  edition_id: string | null;
  edition_code?: string;
  book_title: string | null;
  author_name?: string | null;
  isbn?: string | null;
  edition_number?: string | null;
  format?: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name?: string;
  warehouse_type: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
}

export function StockIssueView({
  screen,
  balances,
  items,
  warehouses,
  movements,
  canManage,
  canPost,
  canFinance,
  userId,
  busy,
  onRefresh,
  onSelectMovement,
}: StockIssueViewProps) {
  // Low stock threshold state
  const [thresholdInput, setThresholdInput] = useState<string>('100');
  const [threshold, setThreshold] = useState<number>(100);
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'books' | 'materials'>('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');

  // Sales Dispatch & E2E auxiliary states
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sourceLineId, setSourceLineId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotKey, setLotKey] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Initialize threshold from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('erp_low_stock_threshold');
      if (saved && !isNaN(Number(saved)) && Number(saved) >= 0) {
        setThreshold(Number(saved));
        setThresholdInput(saved);
      }
    }
  }, []);

  const handleThresholdChange = (val: string) => {
    setThresholdInput(val);
    const parsed = Number(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setThreshold(parsed);
      if (typeof window !== 'undefined') {
        localStorage.setItem('erp_low_stock_threshold', String(parsed));
      }
    }
  };

  const setPresetThreshold = (preset: number) => {
    setThreshold(preset);
    setThresholdInput(String(preset));
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_low_stock_threshold', String(preset));
    }
  };

  // Load dispatches in background for auxiliary tool
  useEffect(() => {
    void api<{ data: Dispatch[] }>('/inventory/sales-dispatches')
      .then(res => setDispatches(res.data || []))
      .catch(() => {});
  }, []);

  // Consolidate rows directly from inventory balances
  const productRows: LowStockProductRow[] = useMemo(() => {
    return balances.map(b => {
      const onHand = Number(b.on_hand_qty) || 0;
      const reserved = Number(b.reserved_qty) || 0;
      const avail = Number(b.available_qty) || 0;
      const isBook = Boolean(b.book_title || b.edition_id || b.item_type === 'finished_book' || b.item_type === 'book');

      return {
        id: `${b.item_id}-${b.warehouse_id}`,
        item_id: b.item_id,
        item_code: b.item_code,
        item_name: b.item_name,
        item_type: isBook ? 'finished_book' : (b.item_type || 'raw_material'),
        edition_id: b.edition_id,
        edition_code: b.edition_code,
        book_title: b.book_title,
        author_name: b.author_name,
        isbn: b.isbn,
        edition_number: b.edition_number,
        format: b.format,
        warehouse_id: b.warehouse_id,
        warehouse_code: b.warehouse_code,
        warehouse_name: b.warehouse_name,
        warehouse_type: b.warehouse_type,
        on_hand_qty: onHand,
        reserved_qty: reserved,
        available_qty: avail,
      };
    });
  }, [balances]);

  // Counts for category pills
  const counts = useMemo(() => {
    let booksCount = 0;
    let materialsCount = 0;
    for (const r of productRows) {
      const isBook = Boolean(r.book_title || r.edition_id || r.item_type === 'finished_book' || r.item_type === 'book');
      if (isBook) booksCount++;
      else materialsCount++;
    }
    return { booksCount, materialsCount, total: productRows.length };
  }, [productRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return productRows.filter(row => {
      const isBook = Boolean(row.book_title || row.edition_id || row.item_type === 'finished_book' || row.item_type === 'book');

      // Type filter
      if (filterType === 'books' && !isBook) return false;
      if (filterType === 'materials' && isBook) return false;

      // Warehouse filter
      if (selectedWarehouseId !== 'ALL' && row.warehouse_id !== selectedWarehouseId) return false;

      // Low stock check
      if (onlyLowStock && row.available_qty > threshold) return false;

      // Search query
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (row.book_title || row.item_name || '').toLowerCase().includes(term);
        const matchCode = row.item_code.toLowerCase().includes(term);
        const matchAuthor = (row.author_name || '').toLowerCase().includes(term);
        const matchWh = (row.warehouse_code || '').toLowerCase().includes(term) || (row.warehouse_name || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCode && !matchAuthor && !matchWh) return false;
      }

      return true;
    }).sort((a, b) => a.available_qty - b.available_qty); // Show lowest stock first!
  }, [productRows, filterType, selectedWarehouseId, onlyLowStock, threshold, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const relevant = productRows.filter(row => {
      const isBook = Boolean(row.book_title || row.edition_id || row.item_type === 'finished_book' || row.item_type === 'book');
      if (filterType === 'books') return isBook;
      if (filterType === 'materials') return !isBook;
      return true;
    });

    const outOfStockCount = relevant.filter(r => r.available_qty <= 0).length;
    const lowStockCount = relevant.filter(r => r.available_qty > 0 && r.available_qty <= threshold).length;
    const healthyCount = relevant.filter(r => r.available_qty > threshold).length;

    return {
      total: relevant.length,
      outOfStockCount,
      lowStockCount,
      totalAlerts: outOfStockCount + lowStockCount,
      healthyCount,
    };
  }, [productRows, filterType, threshold]);

  // Dispatch helpers for E2E compliance & auxiliary usage
  async function fetchInvoice(targetNumber?: string) {
    const term = (targetNumber || invoiceId).trim();
    if (!term) return;
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      const suffix = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(term) ? encodeURIComponent(term) : `by-number/${encodeURIComponent(term)}`;
      const res = await api<{ data: Invoice }>(`/sales-sources/invoices/${suffix}`).catch(() => ({ data: null as any }));
      const inv = res.data;
      if (!inv) throw new Error('No posted invoice matches that number');
      if (inv.status !== 'posted') throw new Error('Invoice must be posted before dispatch');
      setInvoice(inv);
      setInvoiceId(inv.invoice_number);
      setNotice('Posted invoice loaded successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setActionBusy(false);
    }
  }

  async function submitDispatchRequest() {
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      const allocation = lotKey ? JSON.parse(lotKey) as [string, string | null] : null;
      await api('/inventory/sales-dispatches', {
        method: 'POST',
        body: JSON.stringify({
          invoiceLineId: sourceLineId,
          warehouseId,
          lotNumber: allocation?.[0] ?? null,
          binLocation: allocation?.[1] ?? null,
          quantity: Number(quantity),
        }),
      });
      setNotice('Dispatch request recorded successfully');
      setInvoice(null);
      setInvoiceId('');
      setQuantity('');
      void api<{ data: Dispatch[] }>('/inventory/sales-dispatches').then(res => setDispatches(res.data || []));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch request failed');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📉</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Low Stock Monitor
            </h1>
            <span style={{
              display: 'inline-block',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: metrics.totalAlerts > 0 ? '#fee2e2' : '#dcfce7',
              color: metrics.totalAlerts > 0 ? '#991b1b' : '#166534',
              border: `1px solid ${metrics.totalAlerts > 0 ? '#fca5a5' : '#86efac'}`,
            }}>
              {metrics.totalAlerts > 0 ? `${metrics.totalAlerts} Alert${metrics.totalAlerts === 1 ? '' : 's'}` : 'Stock Normal'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Track items running low on inventory. Set your custom threshold limit to highlight products needing restock.
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
            <span>🔄</span> Refresh Stock
          </button>
          <Link
            href="/sales-distribution/create-sales-order"
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', textDecoration: 'none' }}
          >
            + Create Sales Order
          </Link>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '1rem' }}>
          ✅ {notice}
        </div>
      )}

      {/* Hero Control Card: Set Threshold Limit & Filters */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
          {/* Threshold Setter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              ⚙️ Low Stock Alert Limit (Threshold Units)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min="0"
                step="1"
                className="input"
                style={{ width: '130px', fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}
                value={thresholdInput}
                onChange={e => handleThresholdChange(e.target.value)}
                placeholder="Limit"
              />
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>copies / units</span>
            </div>
            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '0.2rem' }}>Presets:</span>
              {[25, 50, 100, 200, 500].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPresetThreshold(val)}
                  style={{
                    border: '1px solid',
                    borderColor: threshold === val ? '#0284c7' : '#cbd5e1',
                    background: threshold === val ? '#f0f9ff' : '#f8fafc',
                    color: threshold === val ? '#0369a1' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: threshold === val ? 700 : 500,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Type & Filter Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
              Product Category & Warehouse
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Category Segmented control */}
              <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontWeight: filterType === 'all' ? 600 : 400,
                    background: filterType === 'all' ? '#ffffff' : 'transparent',
                    color: filterType === 'all' ? '#0f172a' : '#64748b',
                    boxShadow: filterType === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  All Items ({counts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('books')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontWeight: filterType === 'books' ? 600 : 400,
                    background: filterType === 'books' ? '#ffffff' : 'transparent',
                    color: filterType === 'books' ? '#0f172a' : '#64748b',
                    boxShadow: filterType === 'books' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  📚 Books ({counts.booksCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('materials')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontWeight: filterType === 'materials' ? 600 : 400,
                    background: filterType === 'materials' ? '#ffffff' : 'transparent',
                    color: filterType === 'materials' ? '#0f172a' : '#64748b',
                    boxShadow: filterType === 'materials' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  📦 Materials ({counts.materialsCount})
                </button>
              </div>

              {/* Warehouse selector */}
              <select
                className="input"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto', minWidth: '150px' }}
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search & Only Low Stock Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
              Search & Display Filter
            </label>
            <input
              type="text"
              className="input"
              style={{ fontSize: '0.85rem' }}
              placeholder="Search title, author, SKU, warehouse..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#1e293b', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={e => setOnlyLowStock(e.target.checked)}
                style={{ width: '15px', height: '15px' }}
              />
              <span style={{ fontWeight: 600 }}>Show ONLY low stock products (≤ {threshold} units)</span>
            </label>
          </div>
        </div>
      </div>

      {/* KPI Overview Pills */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 180px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Active Alert Limit</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{threshold} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>units</span></div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>🎯</span>
        </div>

        <div style={{
          flex: '1 1 180px',
          background: metrics.outOfStockCount > 0 ? '#fff1f2' : '#ffffff',
          border: '1px solid',
          borderColor: metrics.outOfStockCount > 0 ? '#fecdd3' : '#e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: metrics.outOfStockCount > 0 ? '#be123c' : '#64748b', fontWeight: 500 }}>Out of Stock (0 Left)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: metrics.outOfStockCount > 0 ? '#9f1239' : '#0f172a' }}>
              {metrics.outOfStockCount}
            </div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>🔴</span>
        </div>

        <div style={{
          flex: '1 1 180px',
          background: metrics.lowStockCount > 0 ? '#fffbeb' : '#ffffff',
          border: '1px solid',
          borderColor: metrics.lowStockCount > 0 ? '#fde68a' : '#e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: metrics.lowStockCount > 0 ? '#b45309' : '#64748b', fontWeight: 500 }}>Low Stock (≤ {threshold})</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: metrics.lowStockCount > 0 ? '#92400e' : '#0f172a' }}>
              {metrics.lowStockCount}
            </div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        </div>

        <div style={{
          flex: '1 1 180px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Sufficient Stock (&gt; {threshold})</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#166534' }}>{metrics.healthyCount}</div>
          </div>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
        </div>
      </div>

      {/* Low Stock Products Table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <div style={{
          padding: '0.75rem 1.25rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
            {onlyLowStock ? `Products Below Alert Limit (≤ ${threshold} units)` : 'All Inventory Items & Stock Status'}
            <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: '#64748b', fontSize: '0.85rem' }}>
              ({filteredRows.length} item{filteredRows.length === 1 ? '' : 's'})
            </span>
          </h2>
          {onlyLowStock && (
            <button
              type="button"
              onClick={() => setOnlyLowStock(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Show all stock levels
            </button>
          )}
        </div>

        <div className="table-wrap" style={{ margin: 0 }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Product / Item Details
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Warehouse
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Available Stock
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Stock Status
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map(row => {
                  const isOutOfStock = row.available_qty <= 0;
                  const isLowStock = row.available_qty > 0 && row.available_qty <= threshold;

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isOutOfStock ? '#fffbfb' : isLowStock ? '#fffdf7' : '#ffffff',
                      }}
                    >
                      {/* Product details */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.15rem' }}>
                          {row.book_title || row.item_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                            {row.item_code}
                          </span>
                          {row.author_name && <span>👤 {row.author_name}</span>}
                          {row.edition_number && <span>Ed. {row.edition_number}</span>}
                          {row.format && <span>({row.format})</span>}
                          {row.isbn && <span>ISBN: {row.isbn}</span>}
                        </div>
                      </td>

                      {/* Warehouse */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                          {row.warehouse_code}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {row.warehouse_name || row.warehouse_type}
                        </div>
                      </td>

                      {/* Available Stock */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: isOutOfStock ? '#dc2626' : isLowStock ? '#d97706' : '#16a34a',
                        }}>
                          {Math.round(row.available_qty).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          On Hand: {Math.round(row.on_hand_qty)} | Res: {Math.round(row.reserved_qty)}
                        </div>
                      </td>

                      {/* Stock Status Badge & Alert */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        {isOutOfStock ? (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}>
                            <span>🔴</span>
                            <span>Out of Stock (0 left)</span>
                          </div>
                        ) : isLowStock ? (
                          <div style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            gap: '0.15rem',
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}>
                              <span>⚠️</span>
                              <span>Low Stock: {Math.round(row.available_qty)} left</span>
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#b45309', marginLeft: '0.2rem' }}>
                              Below alert limit of {threshold} units
                            </span>
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}>
                            <span>✅</span>
                            <span>Adequate ({Math.round(row.available_qty)} units)</span>
                          </div>
                        )}
                      </td>

                      {/* Restock Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {row.edition_id ? (
                            <Link
                              href="/printing-production/production-receipt"
                              className="btn btn-primary"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.65rem',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              + Restock / Print
                            </Link>
                          ) : (
                            <Link
                              href="/procurement-suppliers/purchase-requisition-list"
                              className="btn btn-primary"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.65rem',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              + Reorder Supply
                            </Link>
                          )}

                          {row.edition_id && row.available_qty > 0 && (
                            <Link
                              href={`/sales-distribution/create-sales-order?editionId=${encodeURIComponent(row.edition_id)}`}
                              className="btn"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.65rem',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🛍️ Sell
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                    <div style={{ fontWeight: 600, color: '#334155', fontSize: '1rem', marginBottom: '0.25rem' }}>
                      {onlyLowStock
                        ? `No products are currently low on stock under ${threshold} units!`
                        : 'No matching items found.'}
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                      {onlyLowStock
                        ? 'All monitored stock balances are above your configured alert threshold.'
                        : 'Try adjusting your search query or warehouse filters.'}
                    </p>
                    {onlyLowStock && (
                      <button
                        type="button"
                        className="btn"
                        style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
                        onClick={() => setOnlyLowStock(false)}
                      >
                        View all stock levels
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auxiliary Operations: Invoice-linked Sales Dispatch (Preserved for workflow & E2E compliance) */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
        <section className="panel catalog-form" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <h2 className="section-title" style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            Invoice-linked sales dispatch
          </h2>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 1rem' }}>
            Verify posted invoice lines to record stock issues directly against customer orders.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1rem', maxWidth: '500px' }}>
            <label className="field" style={{ flex: 1, margin: 0 }}>
              Posted invoice number or ID
              <input
                className="input"
                value={invoiceId}
                onChange={e => setInvoiceId(e.target.value)}
                placeholder="e.g. INV-2026-0001"
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionBusy || !invoiceId.trim()}
              onClick={() => void fetchInvoice()}
            >
              Load posted source
            </button>
          </div>

          {invoice && (
            <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Invoice {invoice.invoice_number} ({invoice.customer_name || 'Customer'})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <label className="field">
                  Select Line Item
                  <select
                    className="input"
                    value={sourceLineId}
                    onChange={e => setSourceLineId(e.target.value)}
                  >
                    <option value="">Select line</option>
                    {invoice.lines.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.book_title} · Qty: {l.quantity} ({l.sale_type})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Issuing Warehouse
                  <select
                    className="input"
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Dispatch Quantity
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={actionBusy || !sourceLineId || !warehouseId || !quantity}
                  onClick={() => void submitDispatchRequest()}
                >
                  Confirm Stock Issue & Dispatch
                </button>
              </div>
            </div>
          )}

          <h2 className="section-title" style={{ marginTop: '1.5rem', fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>
            Sales dispatch register
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Invoice</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.length > 0 ? (
                  dispatches.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'monospace' }}>{d.item_code}</td>
                      <td>{d.invoice_number}</td>
                      <td>{d.warehouse_code}</td>
                      <td style={{ fontWeight: 600 }}>{d.quantity}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: d.status === 'posted' ? '#dcfce7' : '#fef9c3',
                          color: d.status === 'posted' ? '#166534' : '#854d0e',
                        }}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty" style={{ textAlign: 'center', padding: '1.5rem' }}>
                      No sales dispatches recorded yet.
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
