"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InventoryBalanceRow } from './inventory-overview-view';

type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };

interface StockByBookEditionViewProps {
  balances: InventoryBalanceRow[];
  warehouses: Warehouse[];
  busy: boolean;
  onRefresh: () => Promise<void>;
}

export function StockByBookEditionView({
  balances,
  warehouses,
  busy,
  onRefresh,
}: StockByBookEditionViewProps) {
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESERVED'>('ALL');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Filter book balances only
  const bookBalances = useMemo(() => {
    return balances.filter(b => b.book_title || b.edition_id || b.item_type === 'finished_book');
  }, [balances]);

  // KPIs across book balances
  const kpis = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let totalBookValue = 0;
    const titlesSet = new Set<string>();
    const editionsSet = new Set<string>();

    for (const b of bookBalances) {
      const onHand = Number(b.on_hand_qty || 0);
      const res = Number(b.reserved_qty || 0);
      const avail = Number(b.available_qty || 0);
      const cost = Number(b.average_unit_cost || 0);

      totalOnHand += onHand;
      totalReserved += res;
      totalAvailable += avail;
      totalBookValue += onHand * cost;

      if (b.book_title) titlesSet.add(b.book_title);
      if (b.edition_id) editionsSet.add(b.edition_id);
    }

    return {
      totalOnHand,
      totalReserved,
      totalAvailable,
      totalBookValue,
      titleCount: titlesSet.size || bookBalances.length,
      editionCount: editionsSet.size || bookBalances.length,
    };
  }, [bookBalances]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return bookBalances.filter(b => {
      // Warehouse filter
      if (warehouseFilter !== 'ALL' && b.warehouse_id !== warehouseFilter) return false;

      // Format filter
      if (formatFilter !== 'ALL' && (b.format || 'paperback').toLowerCase() !== formatFilter.toLowerCase()) return false;

      // Availability filter
      const onHand = Number(b.on_hand_qty || 0);
      const res = Number(b.reserved_qty || 0);
      if (availabilityFilter === 'IN_STOCK' && onHand <= 0) return false;
      if (availabilityFilter === 'OUT_OF_STOCK' && onHand > 0) return false;
      if (availabilityFilter === 'LOW_STOCK' && (onHand <= 0 || onHand > 200)) return false;
      if (availabilityFilter === 'RESERVED' && res <= 0) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (b.book_title || '').toLowerCase().includes(q);
        const matchAuthor = (b.author_name || '').toLowerCase().includes(q);
        const matchIsbn = (b.isbn || '').toLowerCase().includes(q);
        const matchCode = (b.item_code || '').toLowerCase().includes(q);
        const matchWh = (b.warehouse_name || b.warehouse_code || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchIsbn && !matchCode && !matchWh) {
          return false;
        }
      }

      return true;
    });
  }, [bookBalances, warehouseFilter, formatFilter, availabilityFilter, searchQuery]);

  // Grouped by Edition / Title for the Grouped Matrix View
  const groupedByEdition = useMemo(() => {
    const map = new Map<string, {
      editionKey: string;
      editionId?: string | null;
      bookTitle: string;
      authorName: string;
      isbn: string;
      editionNumber: string;
      format: string;
      itemCode: string;
      unitCost: number;
      totalOnHand: number;
      totalReserved: number;
      totalAvailable: number;
      totalValue: number;
      warehouses: Array<{
        warehouseCode: string;
        warehouseName: string;
        warehouseType: string;
        onHand: number;
        reserved: number;
        available: number;
      }>;
    }>();

    for (const row of filteredRows) {
      const key = row.edition_id || row.item_code;
      const onHand = Number(row.on_hand_qty || 0);
      const res = Number(row.reserved_qty || 0);
      const avail = Number(row.available_qty || 0);
      const cost = Number(row.average_unit_cost || 0);

      if (!map.has(key)) {
        map.set(key, {
          editionKey: key,
          editionId: row.edition_id,
          bookTitle: row.book_title || row.item_name,
          authorName: row.author_name || 'Assigned Author',
          isbn: row.isbn || '—',
          editionNumber: row.edition_number || '1',
          format: row.format || 'Paperback',
          itemCode: row.item_code,
          unitCost: cost,
          totalOnHand: 0,
          totalReserved: 0,
          totalAvailable: 0,
          totalValue: 0,
          warehouses: [],
        });
      }

      const entry = map.get(key)!;
      entry.totalOnHand += onHand;
      entry.totalReserved += res;
      entry.totalAvailable += avail;
      entry.totalValue += onHand * cost;
      entry.warehouses.push({
        warehouseCode: row.warehouse_code,
        warehouseName: row.warehouse_name || row.warehouse_code,
        warehouseType: row.warehouse_type,
        onHand,
        reserved: res,
        available: avail,
      });
    }

    return Array.from(map.values());
  }, [filteredRows]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/inventory-warehouse/inventory-overview" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← Inventory Overview
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Publication Stock by Edition</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>📚</span> Stock by Book &amp; Edition Matrix
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Comprehensive edition stock levels, warehouse distribution, sales order reservation balances, and replenishment visibility.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void onRefresh()}
            disabled={busy}
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}
          >
            🔄 Refresh
          </button>
          <Link
            href="/sales-distribution/sales-order-list"
            className="btn"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🛍️</span> Sales Orders ➔
          </Link>
          <Link
            href="/printing-production/production-receipt"
            className="btn"
            style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📥</span> Accept Finished Goods
          </Link>
          <Link
            href="/inventory-warehouse/inventory-overview"
            className="btn btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📦</span> Full Inventory Overview
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Published Copies On Hand</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>{kpis.totalOnHand.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7' }}>Physical bound books in warehouses</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ready for Commercial Sale</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>{kpis.totalAvailable.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>🟢 Net available for invoice &amp; dispatch</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Committed / In Orders</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpis.totalReserved > 0 ? '#ea580c' : '#64748b', margin: '0.25rem 0' }}>{kpis.totalReserved.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#ea580c' }}>🟠 Reserved for customer delivery</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Finished Books Asset Value</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>BDT {kpis.totalBookValue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Inventory balance capital valuation</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Catalog Coverage</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4f46e5', margin: '0.25rem 0' }}>{kpis.titleCount} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>titles</span></div>
          <div style={{ fontSize: '0.75rem', color: '#4f46e5' }}>{kpis.editionCount} active editions in stock</div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ flex: '2 1 280px' }}>
          <input
            className="input"
            type="text"
            placeholder="🔍 Search book title, author, ISBN, format, or item code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <select
            className="input"
            value={warehouseFilter}
            onChange={e => setWarehouseFilter(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="ALL">🏢 All Warehouses ({warehouses.length})</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <select
            className="input"
            value={availabilityFilter}
            onChange={e => setAvailabilityFilter(e.target.value as any)}
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Availability Levels</option>
            <option value="IN_STOCK">🟢 In Stock (&gt; 0)</option>
            <option value="LOW_STOCK">🟡 Low Stock (&lt; 200)</option>
            <option value="OUT_OF_STOCK">🔴 Out of Stock (0)</option>
            <option value="RESERVED">🟠 Has Orders Reserved</option>
          </select>
        </div>

        <div style={{ flex: '1 1 140px' }}>
          <select
            className="input"
            value={formatFilter}
            onChange={e => setFormatFilter(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Formats</option>
            <option value="paperback">Paperback</option>
            <option value="hardcover">Hardcover</option>
            <option value="deluxe">Deluxe Edition</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              border: 'none',
              background: viewMode === 'grouped' ? '#2563eb' : 'transparent',
              color: viewMode === 'grouped' ? '#fff' : '#475569',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📑 By Title Matrix
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              border: 'none',
              background: viewMode === 'table' ? '#2563eb' : 'transparent',
              color: viewMode === 'table' ? '#fff' : '#475569',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📋 Flat Ledger
          </button>
        </div>

        {(searchQuery || warehouseFilter !== 'ALL' || availabilityFilter !== 'ALL' || formatFilter !== 'ALL') && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearchQuery('');
              setWarehouseFilter('ALL');
              setAvailabilityFilter('ALL');
              setFormatFilter('ALL');
            }}
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
          >
            Reset
          </button>
        )}
      </section>

      {/* VIEW 1: Grouped Matrix View (By Book Title & Edition) */}
      {viewMode === 'grouped' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {groupedByEdition.length > 0 ? (
            groupedByEdition.map(group => (
              <div
                key={group.editionKey}
                style={{
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                }}
              >
                {/* Book Card Top Banner */}
                <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ width: '42px', height: '54px', borderRadius: '4px', background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                      📖
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {group.bookTitle}
                        </h2>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          Edition {group.editionNumber} · {group.format}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#334155', fontWeight: 600 }}>✍️ {group.authorName}</span>
                        <span>•</span>
                        <span style={{ fontFamily: 'monospace' }}>Code: {group.itemCode}</span>
                        {group.isbn && group.isbn !== '—' && (
                          <>
                            <span>•</span>
                            <span>ISBN-13: <strong>{group.isbn}</strong></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Avg Cost: <strong>BDT {group.unitCost.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Totals for Edition */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total In Stock</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{group.totalOnHand.toLocaleString()}</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Ready to Sell</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>{group.totalAvailable.toLocaleString()}</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 600, textTransform: 'uppercase' }}>Reserved</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: group.totalReserved > 0 ? '#ea580c' : '#94a3b8' }}>
                        {group.totalReserved.toLocaleString()}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Asset Value</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                        BDT {group.totalValue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem' }}>
                      {group.totalAvailable > 0 && (
                        <Link
                          href={group.editionId ? `/sales-distribution/create-sales-order?editionId=${encodeURIComponent(group.editionId)}` : `/sales-distribution/create-sales-order`}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', textDecoration: 'none', fontWeight: 700 }}
                          title={`Create Sales Order for ${group.bookTitle}`}
                        >
                          🛍️ Create Order
                        </Link>
                      )}
                      <Link
                        href="/printing-production/production-receipt"
                        className="btn"
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', textDecoration: 'none' }}
                      >
                        📥 Restock
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Warehouse breakdown sub-table */}
                <div style={{ padding: '0.75rem 1.25rem', background: '#fff' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Warehouse Storage &amp; Allocation Breakdown
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {group.warehouses.map((wh, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem 1rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                            {wh.warehouseName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Code: <span style={{ fontFamily: 'monospace' }}>{wh.warehouseCode}</span> · {wh.warehouseType}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                            {wh.onHand.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>copies</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>🟢 {wh.available.toLocaleString()} avail</span>
                            {wh.reserved > 0 && (
                              <span style={{ color: '#ea580c', fontWeight: 600, marginLeft: '0.4rem' }}>
                                🟠 {wh.reserved.toLocaleString()} res
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '3rem', textAlign: 'center', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#334155' }}>No Publication Editions Found</div>
              <p style={{ margin: '0.25rem auto 0 auto', maxWidth: '400px', fontSize: '0.875rem' }}>
                No book editions match your search and filter settings. Restock finished goods via Production Receipt or reset filters.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Flat Ledger View */}
      {viewMode === 'table' && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Book Title &amp; Edition</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Author / Contributor</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ISBN-13 / Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Warehouse</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>On Hand</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ea580c' }}>Reserved</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#16a34a' }}>Available</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Value</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map(row => {
                    const onHand = Number(row.on_hand_qty || 0);
                    const res = Number(row.reserved_qty || 0);
                    const avail = Number(row.available_qty || 0);
                    const cost = Number(row.average_unit_cost || 0);
                    const lineValue = onHand * cost;

                    return (
                      <tr key={`${row.item_id}-${row.warehouse_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.book_title || row.item_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>
                            Ed. {row.edition_number || '1'} ({row.format || 'Paperback'})
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>
                          ✍️ {row.author_name || 'Assigned Author'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{row.isbn || '—'}</div>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>{row.item_code}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{row.warehouse_name || row.warehouse_code}</div>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{row.warehouse_code}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {onHand.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: res > 0 ? '#ea580c' : '#94a3b8' }}>
                          {res > 0 ? res.toLocaleString() : '0'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: avail > 0 ? '#dcfce7' : '#fee2e2',
                            color: avail > 0 ? '#166534' : '#991b1b',
                          }}>
                            {avail > 0 ? `🟢 ${avail.toLocaleString()} ready` : '🔴 0'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569' }}>
                          BDT {cost.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          BDT {lineValue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {avail > 0 && (
                            <Link
                              href={row.edition_id ? `/sales-distribution/create-sales-order?editionId=${encodeURIComponent(row.edition_id)}` : `/sales-distribution/create-sales-order`}
                              className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', textDecoration: 'none' }}
                              title={`Create Sales Order for ${row.book_title || row.item_name}`}
                            >
                              🛍️ Sell
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      No matching edition stock records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
