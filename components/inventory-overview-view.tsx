"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';

export type InventoryBalanceRow = {
  item_id: string;
  item_code: string;
  item_name: string;
  item_type?: string;
  base_uom?: string;
  edition_id: string | null;
  edition_code?: string;
  format?: string;
  edition_status?: string;
  book_id?: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name?: string;
  warehouse_type: string;
  book_title: string | null;
  author_name?: string | null;
  isbn?: string | null;
  publication_status?: string | null;
  edition_number: string | null;
  on_hand_qty: string;
  reserved_qty: string;
  available_qty: string;
  average_unit_cost: string;
};

type Item = { id: string; item_code: string; name: string; item_type: string; base_uom: string; tracking_policy: string; edition_id: string | null };
type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };
type Movement = { id: string; transaction_type: string; document_type: string; document_id: string; status: string; created_at: string; posted_at: string | null };
type Edition = { id: string; book_title: string; edition_number: string; format: string };
type Reconciliation = { checked: number; reconciled: boolean; mismatches: Array<{ item_id: string; warehouse_id: string; on_hand_qty: string; ledger_qty: string; reserved_qty: string; reservation_qty: string }> };

interface InventoryOverviewViewProps {
  balances: InventoryBalanceRow[];
  items: Item[];
  warehouses: Warehouse[];
  movements: Movement[];
  editions: Edition[];
  reconciliation: Reconciliation | null;
  canWrite: boolean;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onAddItem: (item: { code: string; name: string; type: string; uom: string; tracking: string; editionId: string }) => Promise<void>;
  onAddWarehouse: (wh: { code: string; name: string; type: string }) => Promise<void>;
}

export function InventoryOverviewView({
  balances,
  items,
  warehouses,
  movements,
  editions,
  reconciliation,
  canWrite,
  busy,
  onRefresh,
  onAddItem,
  onAddWarehouse,
}: InventoryOverviewViewProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESERVED'>('ALL');
  const [activeTab, setActiveTab] = useState<'all' | 'books' | 'raw' | 'quarantine'>('all');

  // Form Collapsible
  const [showItemForm, setShowItemForm] = useState(false);
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);

  // New Item State
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('finished_book');
  const [newUom, setNewUom] = useState('copies');
  const [newTracking, setNewTracking] = useState('none');
  const [newEdition, setNewEdition] = useState('');

  // New Warehouse State
  const [newWhCode, setNewWhCode] = useState('');
  const [newWhName, setNewWhName] = useState('');
  const [newWhType, setNewWhType] = useState('finished_goods');

  // KPI Calculations
  const stats = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let totalValuation = 0;
    const distinctBooks = new Set<string>();

    for (const b of balances) {
      const onHand = Number(b.on_hand_qty || 0);
      const res = Number(b.reserved_qty || 0);
      const avail = Number(b.available_qty || 0);
      const cost = Number(b.average_unit_cost || 0);

      totalOnHand += onHand;
      totalReserved += res;
      totalAvailable += avail;
      totalValuation += onHand * cost;

      if (b.book_title || b.edition_id) {
        distinctBooks.add(b.edition_id || b.item_code);
      }
    }

    return {
      totalOnHand,
      totalReserved,
      totalAvailable,
      totalValuation,
      bookCount: distinctBooks.size,
      warehouseCount: warehouses.length,
      itemCount: items.length,
      draftMovements: movements.filter(m => m.status === 'draft').length,
    };
  }, [balances, warehouses, items, movements]);

  // Filtered Balances
  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      // Tab filter
      if (activeTab === 'books' && b.item_type !== 'finished_book' && !b.book_title && !b.edition_id) return false;
      if (activeTab === 'raw' && b.item_type === 'finished_book') return false;
      if (activeTab === 'quarantine' && b.warehouse_type !== 'quarantine') return false;

      // Warehouse filter
      if (warehouseFilter !== 'ALL' && b.warehouse_id !== warehouseFilter) return false;

      // Type filter
      if (itemTypeFilter !== 'ALL' && b.item_type !== itemTypeFilter) return false;

      // Status filter
      const onHand = Number(b.on_hand_qty || 0);
      const reserved = Number(b.reserved_qty || 0);
      if (stockStatusFilter === 'IN_STOCK' && onHand <= 0) return false;
      if (stockStatusFilter === 'OUT_OF_STOCK' && onHand > 0) return false;
      if (stockStatusFilter === 'LOW_STOCK' && (onHand <= 0 || onHand > 100)) return false;
      if (stockStatusFilter === 'RESERVED' && reserved <= 0) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (b.book_title || '').toLowerCase().includes(q);
        const matchItemName = (b.item_name || '').toLowerCase().includes(q);
        const matchItemCode = (b.item_code || '').toLowerCase().includes(q);
        const matchAuthor = (b.author_name || '').toLowerCase().includes(q);
        const matchIsbn = (b.isbn || '').toLowerCase().includes(q);
        const matchWh = (b.warehouse_name || b.warehouse_code || '').toLowerCase().includes(q);
        if (!matchTitle && !matchItemName && !matchItemCode && !matchAuthor && !matchIsbn && !matchWh) {
          return false;
        }
      }

      return true;
    });
  }, [balances, activeTab, warehouseFilter, itemTypeFilter, stockStatusFilter, searchQuery]);

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    await onAddItem({
      code: newCode.trim(),
      name: newName.trim(),
      type: newType,
      uom: newUom.trim(),
      tracking: newTracking,
      editionId: newEdition,
    });
    setNewCode('');
    setNewName('');
    setNewEdition('');
    setShowItemForm(false);
  }

  async function handleCreateWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!newWhCode.trim() || !newWhName.trim()) return;
    await onAddWarehouse({
      code: newWhCode.trim(),
      name: newWhName.trim(),
      type: newWhType,
    });
    setNewWhCode('');
    setNewWhName('');
    setShowWarehouseForm(false);
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/dashboard" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← Dashboard
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Inventory &amp; Warehouse</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>📦</span> Inventory Overview &amp; Stock Control
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Real-time warehouse stock balances, active publication inventories, asset valuations, and movement readiness.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            href="/inventory-warehouse/stock-by-book-edition"
            className="btn"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📚</span> View Stock by Book/Edition ➔
          </Link>
          <Link
            href="/printing-production/production-receipt"
            className="btn"
            style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📥</span> Receive Finished Goods
          </Link>
          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowItemForm(!showItemForm)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>➕</span> Add Item
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Physical Stock</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>{stats.totalOnHand.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7' }}>Units on hand across all warehouses</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Available to Ship / Sell</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>{stats.totalAvailable.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>🟢 Unreserved &amp; allocatable</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Committed / Reserved</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.totalReserved > 0 ? '#ea580c' : '#64748b', margin: '0.25rem 0' }}>{stats.totalReserved.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#ea580c' }}>🟠 Allocated to sales &amp; WIP</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Stock Valuation</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>BDT {stats.totalValuation.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Weighted average asset value</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Publication Titles &amp; Items</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4f46e5', margin: '0.25rem 0' }}>{stats.bookCount} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>titles ({stats.itemCount} items)</span></div>
          <div style={{ fontSize: '0.75rem', color: '#4f46e5' }}>Across {stats.warehouseCount} active warehouses</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ledger Reconciliation</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: reconciliation?.reconciled ? '#16a34a' : '#ea580c', margin: '0.25rem 0' }}>
            {reconciliation?.reconciled ? '✓ Matched' : '⚠️ Review'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {stats.draftMovements > 0 ? `${stats.draftMovements} pending draft movements` : 'All physical stock balances synced'}
          </div>
        </div>
      </section>

      {/* Collapsible New Item Form Drawer */}
      {showItemForm && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #3b82f6', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>✨ Register New Master Inventory Item</h2>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Create finished books, raw materials (paper/board/glue), or packaging supplies.</p>
            </div>
            <button type="button" onClick={() => setShowItemForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
          </div>
          <form onSubmit={handleCreateItem}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Item Code *</label>
                <input className="input" type="text" required placeholder="e.g. BK-LIT-003 or RAW-PAP-80G" value={newCode} onChange={e => setNewCode(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Item Name / Title *</label>
                <input className="input" type="text" required placeholder="Full product or raw material name" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Item Category *</label>
                <select className="input" value={newType} onChange={e => setNewType(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="finished_book">📚 Finished Book</option>
                  <option value="raw_material">📄 Raw Material (Paper/Card/Glue)</option>
                  <option value="supply">📦 Packaging &amp; Warehouse Supply</option>
                  <option value="other">Other Asset</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Base UOM *</label>
                <input className="input" type="text" required placeholder="copies, reams, kg, sheets" value={newUom} onChange={e => setNewUom(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Tracking Policy</label>
                <select className="input" value={newTracking} onChange={e => setNewTracking(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="none">Standard Inventory (No lot tagging)</option>
                  <option value="lot">Lot / Batch Tracked (Mandatory for Raw Materials)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Linked Book Edition (Optional)</label>
                <select className="input" value={newEdition} onChange={e => setNewEdition(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">None (Non-book item)</option>
                  {editions.map(ed => (
                    <option key={ed.id} value={ed.id}>
                      {ed.book_title} (Ed. {ed.edition_number} · {ed.format})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowItemForm(false)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !newCode.trim() || !newName.trim()}>💾 Save Master Item</button>
            </div>
          </form>
        </section>
      )}

      {/* Collapsible New Warehouse Form Drawer */}
      {showWarehouseForm && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #10b981', marginBottom: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>🏢 Register New Physical Warehouse / Location</h2>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Configure storage zones, book fair booths, or quarantine inspection bins.</p>
            </div>
            <button type="button" onClick={() => setShowWarehouseForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
          </div>
          <form onSubmit={handleCreateWarehouse}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Warehouse Code *</label>
                <input className="input" type="text" required placeholder="e.g. WH-DHAKA-CENTRAL" value={newWhCode} onChange={e => setNewWhCode(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Warehouse Name *</label>
                <input className="input" type="text" required placeholder="e.g. Dhaka Central Distribution Center" value={newWhName} onChange={e => setNewWhName(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Warehouse Purpose / Type *</label>
                <select className="input" value={newWhType} onChange={e => setNewWhType(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="finished_goods">🏢 Finished Goods (Main Commercial Stock)</option>
                  <option value="raw_material">📄 Raw Materials (Paper &amp; Bindery)</option>
                  <option value="quarantine">🔒 Quarantine (QA Rejections &amp; Damaged)</option>
                  <option value="consignment">🤝 Consignment Stock (Customer Held)</option>
                  <option value="fair">🎪 Book Fair / Temporary Booth</option>
                  <option value="wip">⚙️ Work In Progress (Shop Floor)</option>
                  <option value="other">Other Facility</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowWarehouseForm(false)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !newWhCode.trim() || !newWhName.trim()}>💾 Save Warehouse</button>
            </div>
          </form>
        </section>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'all' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'all' ? 700 : 500,
            color: activeTab === 'all' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📦 All Inventory ({balances.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('books')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'books' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'books' ? 700 : 500,
            color: activeTab === 'books' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📚 Finished Books Only ({balances.filter(b => b.item_type === 'finished_book' || b.book_title).length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('raw')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'raw' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'raw' ? 700 : 500,
            color: activeTab === 'raw' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📄 Raw Materials &amp; Paper ({balances.filter(b => b.item_type !== 'finished_book' && !b.book_title).length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quarantine')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'quarantine' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'quarantine' ? 700 : 500,
            color: activeTab === 'quarantine' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          🔒 Quarantined / Damaged ({balances.filter(b => b.warehouse_type === 'quarantine').length})
        </button>

        {canWrite && !showWarehouseForm && (
          <button
            type="button"
            onClick={() => setShowWarehouseForm(true)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            🏢 + Add Warehouse
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ flex: '2 1 280px', position: 'relative' }}>
          <input
            className="input"
            type="text"
            placeholder="🔍 Search title, author, ISBN, item code, or warehouse..."
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
            value={itemTypeFilter}
            onChange={e => setItemTypeFilter(e.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Categories</option>
            <option value="finished_book">📚 Finished Books</option>
            <option value="raw_material">📄 Raw Materials</option>
            <option value="supply">📦 Supplies</option>
          </select>
        </div>

        <div style={{ flex: '1 1 160px' }}>
          <select
            className="input"
            value={stockStatusFilter}
            onChange={e => setStockStatusFilter(e.target.value as any)}
            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="IN_STOCK">🟢 In Stock (&gt; 0)</option>
            <option value="LOW_STOCK">🟡 Low Stock (&lt; 100)</option>
            <option value="OUT_OF_STOCK">🔴 Out of Stock (0)</option>
            <option value="RESERVED">🟠 Has Reserved Stock</option>
          </select>
        </div>

        {(searchQuery || warehouseFilter !== 'ALL' || itemTypeFilter !== 'ALL' || stockStatusFilter !== 'ALL') && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearchQuery('');
              setWarehouseFilter('ALL');
              setItemTypeFilter('ALL');
              setStockStatusFilter('ALL');
            }}
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
          >
            Reset Filters
          </button>
        )}
      </section>

      {/* Main Inventory Balance Table */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Showing <strong>{filteredBalances.length}</strong> of <strong>{balances.length}</strong> stock records
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              href="/inventory-warehouse/stock-transfer"
              className="btn"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
            >
              🚚 Transfer Stock
            </Link>
            <Link
              href="/inventory-warehouse/inventory-transaction-ledger"
              className="btn"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
            >
              📑 Audit Transaction Ledger
            </Link>
          </div>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Item / Publication</th>
                <th style={{ padding: '0.75rem 1rem' }}>Warehouse / Location</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>On Hand</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ea580c' }}>Reserved</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#16a34a' }}>Available</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Unit Cost</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Value</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.length > 0 ? (
                filteredBalances.map(row => {
                  const onHand = Number(row.on_hand_qty || 0);
                  const reserved = Number(row.reserved_qty || 0);
                  const available = Number(row.available_qty || 0);
                  const cost = Number(row.average_unit_cost || 0);
                  const lineValue = onHand * cost;
                  const isFinishedBook = Boolean(row.book_title || row.item_type === 'finished_book');

                  return (
                    <tr key={`${row.item_id}-${row.warehouse_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                          {row.book_title ? row.book_title : row.item_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                            {row.item_code}
                          </span>
                          {row.author_name && (
                            <span style={{ color: '#475569' }}>✍️ {row.author_name}</span>
                          )}
                          {row.edition_number && (
                            <span style={{ color: '#0284c7', fontWeight: 600 }}>Ed. {row.edition_number} ({row.format || 'paperback'})</span>
                          )}
                          {row.isbn && (
                            <span style={{ color: '#64748b' }}>ISBN: {row.isbn}</span>
                          )}
                          <span style={{
                            display: 'inline-block',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: isFinishedBook ? '#e0f2fe' : '#f1f5f9',
                            color: isFinishedBook ? '#0369a1' : '#475569',
                          }}>
                            {isFinishedBook ? 'Finished Book' : 'Raw Material'}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>
                          {row.warehouse_name || row.warehouse_code}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: row.warehouse_type === 'quarantine' ? '#fee2e2' : row.warehouse_type === 'raw_material' ? '#fef3c7' : '#ecfdf5',
                            color: row.warehouse_type === 'quarantine' ? '#991b1b' : row.warehouse_type === 'raw_material' ? '#92400e' : '#065f46',
                          }}>
                            {row.warehouse_type === 'quarantine' ? '🔒 Quarantine' : row.warehouse_type === 'raw_material' ? '📄 Raw Material Store' : '🏢 Finished Goods'}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {onHand.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{row.base_uom || 'copies'}</span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: reserved > 0 ? '#ea580c' : '#94a3b8' }}>
                        {reserved > 0 ? (
                          <span style={{ background: '#fff7ed', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid #ffedd5' }}>
                            {reserved.toLocaleString()}
                          </span>
                        ) : '0'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          background: available > 0 ? '#dcfce7' : '#fee2e2',
                          color: available > 0 ? '#166534' : '#991b1b',
                        }}>
                          {available > 0 ? `🟢 ${available.toLocaleString()} ready` : '🔴 0 available'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#475569' }}>
                        BDT {cost.toFixed(2)}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        BDT {lineValue.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {isFinishedBook && available > 0 && (
                            <Link
                              href={row.edition_id ? `/sales-distribution/create-sales-order?editionId=${encodeURIComponent(row.edition_id)}` : `/sales-distribution/create-sales-order`}
                              className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', textDecoration: 'none' }}
                              title={`Create Sales Order for ${row.book_title || row.item_name}`}
                            >
                              🛍️ Sell
                            </Link>
                          )}
                          <Link
                            href="/inventory-warehouse/stock-transfer"
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', textDecoration: 'none' }}
                            title="Transfer Stock to another warehouse"
                          >
                            🚚 Transfer
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    No inventory balance records match your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
