"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type ReceiptRow = {
  id: string;
  return_number: string;
  item_code: string;
  warehouse_code: string;
  lot_number: string | null;
  bin_location: string | null;
  condition_code: string;
  quantity: string;
  status: string;
  cost_amount: string | null;
  created_at: string;
};

type AuthorizedReturn = {
  id: string;
  return_number: string;
  return_date: string;
  customer_name: string;
  invoice_number: string | null;
  status: string;
  requested_quantity: string;
  received_quantity: string;
  pending_receipt_quantity: string;
};

type ReturnDetail = {
  id: string;
  return_number: string;
  lines: Array<{
    id: string;
    invoice_line_id: string;
    book_title: string;
    quantity: number;
    unit_net_receipt: string;
  }>;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
  warehouse_type: string;
};

type DispatchOption = {
  id: string;
  invoice_line_id: string;
  dispatch_number?: string;
  lot_number?: string;
  quantity: string;
  unit_cost: string;
};

export function ReturnsInspectionScreen({ screen }: { screen: Screen }) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [authorizedReturns, setAuthorizedReturns] = useState<AuthorizedReturn[]>([]);
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [returnDetail, setReturnDetail] = useState<ReturnDetail | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);

  // Form State
  const [selectedLineId, setSelectedLineId] = useState('');
  const [dispatchId, setDispatchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [condition, setCondition] = useState<'accepted' | 'damaged'>('accepted');
  const [quantity, setQuantity] = useState('1');
  const [binLocation, setBinLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      // 1. Load existing return receipts
      const recResult = await api<{ data: ReceiptRow[] }>('/inventory/sales-return-receipts');
      setReceipts(recResult.data);

      // 2. Load posted returns available for physical inspection
      const retResult = await api<{ data: { rows: AuthorizedReturn[] } }>('/sales-sources/returns?status=posted&limit=50');
      setAuthorizedReturns(retResult.data.rows);

      // 3. Load active warehouses
      const whResult = await api<{ data: WarehouseOption[] }>('/warehouses');
      setWarehouses(whResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inspection data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // When selected return changes, fetch its lines
  async function selectReturn(id: string) {
    setSelectedReturnId(id);
    setSelectedLineId('');
    setReturnDetail(null);
    if (!id) return;
    try {
      const detail = (await api<{ data: ReturnDetail }>(`/sales-sources/returns/${id}`)).data;
      setReturnDetail(detail);
      if (detail.lines?.length) {
        setSelectedLineId(detail.lines[0].id);
        void loadDispatchesForLine(detail.lines[0].invoice_line_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load return lines');
    }
  }

  async function loadDispatchesForLine(invLineId: string) {
    try {
      const res = await api<{ data: DispatchOption[] }>(`/inventory/sales-dispatches?invoiceLineId=${invLineId}`);
      const list = res.data || [];
      setDispatches(list);
      if (list.length) setDispatchId(list[0].id);
    } catch {
      // If endpoint doesn't support filter, fetch general dispatches
      const res = await api<{ data: DispatchOption[] }>('/inventory/sales-dispatches?limit=100');
      const list = (res.data || []).filter(d => d.invoice_line_id === invLineId);
      setDispatches(list);
      if (list.length) setDispatchId(list[0].id);
    }
  }

  async function handleInspect() {
    if (!selectedLineId || !warehouseId || Number(quantity) <= 0) {
      setError('Please select return line, warehouse, and valid quantity');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      // Find matching dispatch or use the first available dispatch
      let finalDispatchId = dispatchId;
      if (!finalDispatchId && dispatches.length) finalDispatchId = dispatches[0].id;
      if (!finalDispatchId) {
        // Fallback: look up dispatches
        const res = await api<{ data: DispatchOption[] }>('/inventory/sales-dispatches?limit=50');
        if (res.data?.length) finalDispatchId = res.data[0].id;
      }

      await api('/inventory/sales-return-receipts', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          returnLineId: selectedLineId,
          dispatchId: finalDispatchId,
          warehouseId,
          quantity: Number(quantity),
          condition,
          binLocation: binLocation.trim() || null,
        }),
      });

      setNotice(`✓ Physical return inspection recorded (${quantity} pcs as ${condition}). It is now ready for Disposition approval.`);
      setQuantity('1');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record return receipt');
    } finally {
      setSubmitting(false);
    }
  }

  // Filter warehouses according to selected condition
  const availableWarehouses = warehouses.filter(w =>
    condition === 'accepted' ? w.warehouse_type === 'finished_goods' : w.warehouse_type === 'quarantine'
  );

  // Set default warehouse when condition changes
  useEffect(() => {
    if (availableWarehouses.length && !availableWarehouses.some(w => w.id === warehouseId)) {
      setWarehouseId(availableWarehouses[0].id);
    }
  }, [condition, warehouses]);

  // KPI calculations
  const totalRcvd = receipts.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const acceptedCopies = receipts.filter(r => r.condition_code === 'accepted').reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const damagedCopies = receipts.filter(r => r.condition_code === 'damaged').reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const pendingCount = receipts.filter(r => r.status === 'pending_approval').length;

  const filteredReceipts = receipts.filter(r =>
    `${r.return_number} ${r.item_code} ${r.warehouse_code} ${r.condition_code}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      {/* Header */}
      <div className="page-heading" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PackageCheck size={24} color="#2563eb" /> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Warehouse gate receipt, barcode verification, and quality condition grading for authorized customer returns.
          </p>
        </div>
        <div className="button-row" style={{ display: 'flex', gap: 8 }}>
          <Link
            className="btn"
            href="/returns-claims/return-disposition"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Go to Return Disposition</span>
            <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => void loadData()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #f59e0b',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            ⏳ Pending Disposition
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {pendingCount} receipts
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Awaiting stock ledger approval</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #10b981',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            ✓ Grade A (Sellable)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {acceptedCopies} copies
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Designated for Finished Goods</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #ef4444',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
            ⚠️ Grade C (Quarantine)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
            {damagedCopies} copies
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Damaged / defective books</div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #3b82f6',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>
            📦 Total Inspected
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalRcvd} copies
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Lifetime physical return count</div>
        </div>
      </div>

      {/* QC Form Card */}
      <section className="panel" style={{ padding: '24px', borderRadius: 14, marginBottom: '24px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
          Record New Physical Return QC &amp; Gate Receipt
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <label className="field">
            <span>Select Authorized Return</span>
            <select
              className="input"
              value={selectedReturnId}
              onChange={e => void selectReturn(e.target.value)}
            >
              <option value="">Select authorized return…</option>
              {authorizedReturns.map(r => (
                <option key={r.id} value={r.id}>
                  {r.return_number} · {r.customer_name} ({r.requested_quantity} pcs requested)
                </option>
              ))}
            </select>
          </label>

          {returnDetail && (
            <label className="field">
              <span>Select Returned Book Title</span>
              <select
                className="input"
                value={selectedLineId}
                onChange={e => {
                  setSelectedLineId(e.target.value);
                  const line = returnDetail.lines.find(l => l.id === e.target.value);
                  if (line) void loadDispatchesForLine(line.invoice_line_id);
                }}
              >
                {returnDetail.lines.map(line => (
                  <option key={line.id} value={line.id}>
                    {line.book_title} (Max: {line.quantity} pcs)
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>QC Condition Grading</span>
            <select
              className="input"
              value={condition}
              onChange={e => setCondition(e.target.value as 'accepted' | 'damaged')}
            >
              <option value="accepted">Grade A: Fresh / Sellable (Finished Goods)</option>
              <option value="damaged">Grade C: Damaged / Defective (Quarantine Bin)</option>
            </select>
          </label>

          <label className="field">
            <span>Destination Warehouse</span>
            <select
              className="input"
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
            >
              {availableWarehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code}) · {w.warehouse_type}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Actually Received Copies</span>
            <input
              className="input"
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Bin / Shelf Location</span>
            <input
              className="input"
              placeholder="e.g. BIN-A4-02 / QC-BAY-1"
              value={binLocation}
              onChange={e => setBinLocation(e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            className="btn btn-primary"
            disabled={submitting || !selectedLineId || !warehouseId || Number(quantity) <= 0}
            onClick={() => void handleInspect()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CheckCircle2 size={16} />
            <span>{submitting ? 'Recording Receipt…' : 'Confirm QC & Record Gate Receipt'}</span>
          </button>
        </div>
      </section>

      {/* Recent Physical Receipts Table */}
      <section className="panel" style={{ padding: '24px', borderRadius: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Physical Return Gate Receipts ({filteredReceipts.length})
            </h2>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Physical inspection logs awaiting disposition approval or already posted to stock.
            </p>
          </div>
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
            <input
              className="input"
              style={{ paddingLeft: 32, fontSize: 13 }}
              placeholder="Search receipts..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>Item Code</th>
                <th>Warehouse</th>
                <th>Condition</th>
                <th style={{ textAlign: 'right' }}>Received Copies</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Valuation Cost</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.length ? (
                filteredReceipts.map(r => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ color: '#1e3a8a', fontFamily: 'monospace' }}>{r.return_number}</strong>
                    </td>
                    <td>
                      <code>{r.item_code}</code>
                    </td>
                    <td>{r.warehouse_code}</td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: r.condition_code === 'accepted' ? '#ecfdf5' : '#fef2f2',
                          color: r.condition_code === 'accepted' ? '#065f46' : '#991b1b',
                          border: r.condition_code === 'accepted' ? '1px solid #a7f3d0' : '1px solid #fecaca',
                        }}
                      >
                        {r.condition_code === 'accepted' ? 'Grade A (Sellable)' : 'Grade C (Quarantine)'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {Number(r.quantity)} pcs
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: r.status === 'posted' ? '#eff6ff' : '#fffbeb',
                          color: r.status === 'posted' ? '#1d4ed8' : '#92400e',
                          border: r.status === 'posted' ? '1px solid #bfdbfe' : '1px solid #fde68a',
                        }}
                      >
                        {r.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {r.cost_amount ? `${Number(r.cost_amount).toFixed(2)} BDT` : 'Pending review'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'pending_approval' ? (
                        <Link
                          className="btn btn-sm btn-primary"
                          href={`/returns-claims/return-disposition?receiptId=${r.id}`}
                        >
                          Discharge / Post
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Restocked</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty" style={{ textAlign: 'center', padding: '32px' }}>
                    No return inspection receipts found. Record your first inspection above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
