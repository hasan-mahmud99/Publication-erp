"use client";

import { useEffect, useState, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  PackageCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  X,
  FileText,
  Building2,
  Calendar,
  Warehouse,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Printer,
  Trash2,
  Layers,
  Truck,
  Box,
  ShoppingCart,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const today = () => new Date().toISOString().slice(0, 10);
const inSevenDays = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

type OrderLine = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  baseUom?: string;
  orderedQty: string;
  unitCost: string;
  warehouseId?: string;
};

function renderStatusPill(status: string) {
  const s = String(status || '').toLowerCase();
  let bg = '#f1f5f9', color = '#475569', border = '#cbd5e1';
  if (s === 'approved') {
    bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
  } else if (s === 'submitted') {
    bg = '#eff6ff'; color = '#1d4ed8'; border = '#bfdbfe';
  } else if (s === 'draft') {
    bg = '#fffbeb'; color = '#92400e'; border = '#fde68a';
  } else if (s === 'closed') {
    bg = '#f8fafc'; color = '#334155'; border = '#94a3b8';
  }
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {s}
    </span>
  );
}

export function SupplierOrderScreen({ screen }: { screen: Screen }) {
  const [orders, setOrders] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<Row[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Direct Order Form
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [deliveryDate, setDeliveryDate] = useState(inSevenDays());
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [deliveryAmount, setDeliveryAmount] = useState('0.00');
  const [orderNotes, setOrderNotes] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([
    { itemId: '', orderedQty: '100', unitCost: '3200.00' },
  ]);

  // Fast Receive Form
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveDate, setReceiveDate] = useState(today());
  const [deliveryNote, setDeliveryNote] = useState('');
  const [receiveLines, setReceiveLines] = useState<Record<string, { received: string; accepted: string; rejected: string; reason: string }>>({});

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, supsRes, itemsRes, whRes] = await Promise.all([
        api<{ data: { data: Row[]; meta: { total: number } } }>('/procurement/purchase-orders?limit=100'),
        api<{ data: { data: Row[] } }>('/procurement/suppliers?limit=100'),
        api<{ data: Row[] }>('/items?limit=100'),
        api<{ data: Row[] }>('/warehouses'),
      ]);

      setOrders(ordersRes.data?.data || []);
      setSuppliers(supsRes.data?.data || []);
      setItems(itemsRes.data || []);
      const whList = whRes.data || [];
      setWarehouses(whList);
      if (whList.length && !defaultWarehouseId) {
        setDefaultWarehouseId(whList[0].id);
        setReceiveWarehouseId(whList[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load supplier orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filter raw materials and paper items for selection
  const rawMaterialItems = useMemo(() => {
    return items.filter(
      item => item.item_type === 'raw_material' || item.item_type === 'supply' || item.item_code?.includes('MAT')
    );
  }, [items]);

  // Live Line Subtotal calculation
  const lineSubtotal = (qty: string, cost: string) => {
    const q = parseFloat(qty) || 0;
    const c = parseFloat(cost) || 0;
    return q * c;
  };

  // Grand Total calculation
  const calculations = useMemo(() => {
    const grossSubtotal = lines.reduce(
      (sum, l) => sum + lineSubtotal(l.orderedQty, l.unitCost),
      0
    );
    const discount = parseFloat(discountAmount) || 0;
    const tax = parseFloat(taxAmount) || 0;
    const freight = parseFloat(deliveryAmount) || 0;
    const netTotal = Math.max(0, grossSubtotal - discount + tax + freight);
    return { grossSubtotal, discount, tax, freight, netTotal };
  }, [lines, discountAmount, taxAmount, deliveryAmount]);

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    const sup = suppliers.find(s => s.id === id);
    if (sup?.payment_terms_days) {
      setPaymentTermsDays(Number(sup.payment_terms_days));
    }
  }

  function handleLineItemChange(index: number, itemId: string) {
    const selected = items.find(i => i.id === itemId);
    setLines(prev =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              itemId,
              itemCode: selected?.item_code,
              itemName: selected?.name,
              baseUom: selected?.base_uom || 'Ream',
            }
          : l
      )
    );
  }

  function updateLine(index: number, field: keyof OrderLine, value: string) {
    setLines(prev =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    setLines(prev => [
      ...prev,
      { itemId: rawMaterialItems[0]?.id || '', orderedQty: '50', unitCost: '3000.00' },
    ]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCreateOrder(e: FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }
    if (!lines.length || lines.some(l => !l.itemId || parseFloat(l.orderedQty) <= 0)) {
      setError('Please provide valid items and quantities');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        supplierId,
        orderDate,
        deliveryDate,
        warehouseId: defaultWarehouseId || undefined,
        paymentTermsDays: Number(paymentTermsDays),
        discountAmount: calculations.discount.toFixed(2),
        taxAmount: calculations.tax.toFixed(2),
        deliveryAmount: calculations.freight.toFixed(2),
        notes: orderNotes,
        lines: lines.map(l => ({
          itemId: l.itemId,
          orderedQty: Number(l.orderedQty).toFixed(4),
          unitCost: Number(l.unitCost).toFixed(4),
          warehouseId: l.warehouseId || defaultWarehouseId || undefined,
        })),
      };

      const res = await api<{ data: Row }>('/procurement/purchase-orders/direct', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setNotice(`Order ${res.data.po_number} created successfully! Total: BDT ${res.data.total_amount}`);
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not create purchase order');
    } finally {
      setBusy(false);
    }
  }

  async function openOrderDetail(id: string) {
    setError('');
    try {
      const res = await api<{ data: Row }>(`/procurement/purchase-orders/${id}`);
      setSelectedOrder(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load order details');
    }
  }

  function initiateReceive(order: Row) {
    setSelectedOrder(order);
    const initialMap: Record<string, any> = {};
    (order.lines || []).forEach((l: any) => {
      initialMap[l.id] = {
        received: l.ordered_qty,
        accepted: l.ordered_qty,
        rejected: '0',
        reason: '',
      };
    });
    setReceiveLines(initialMap);
    setShowReceiveModal(true);
  }

  async function handleFastReceive(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!receiveWarehouseId) {
      setError('Please select receiving warehouse');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        warehouseId: receiveWarehouseId,
        receiptDate: receiveDate,
        deliveryNote: deliveryNote || undefined,
        lines: Object.entries(receiveLines).map(([purchaseOrderLineId, values]) => ({
          purchaseOrderLineId,
          receivedQty: Number(values.received || 0).toFixed(4),
          acceptedQty: Number(values.accepted || 0).toFixed(4),
          rejectedQty: Number(values.rejected || 0).toFixed(4),
          rejectionReason: values.reason || undefined,
        })),
      };

      const res = await api<{ data: Row }>(
        `/procurement/purchase-orders/${selectedOrder.id}/fast-receive`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setNotice(
        `Delivery received and stock updated successfully! GRN: ${res.data.grn_number}. Raw materials are now on-hand in warehouse.`
      );
      setShowReceiveModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not process goods receipt');
    } finally {
      setBusy(false);
    }
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        !search.trim() ||
        o.po_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.supplier_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  // Executive KPI summary
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter(o => o.status === 'approved' || o.status === 'submitted').length;
    const totalSpend = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const closedOrders = orders.filter(o => o.status === 'closed').length;
    return { totalOrders, activeOrders, totalSpend, closedOrders };
  }, [orders]);

  return (
    <>
      {/* Page Heading */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Directly order paper, art card, cover board, and raw materials from mills and suppliers with live calculation and automated stock-in.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setNotice('');
              setShowCreateModal(true);
            }}
          >
            <Plus size={15} />
            <span>New Material Order</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert-success" role="alert" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* 4 Executive KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #3b82f6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Total Material Orders
            </span>
            <PackageCheck size={18} color="#3b82f6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.totalOrders}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Total POs generated</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #f59e0b',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Pending Delivery
            </span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.activeOrders}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Awaiting warehouse arrival</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #10b981',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Total Order Spend
            </span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            BDT {kpis.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Cumulative purchase value</span>
        </div>

        <div
          className="panel stat"
          style={{
            borderLeft: '4px solid #8b5cf6',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Fulfilled Orders
            </span>
            <CheckCircle2 size={18} color="#8b5cf6" />
          </div>
          <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
            {kpis.closedOrders}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Delivered &amp; settled</span>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
          <input
            className="input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search PO #, supplier name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input"
          style={{ width: 170 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="closed">Closed</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          <strong>{filteredOrders.length}</strong> orders found
        </span>
      </div>

      {/* Orders Table */}
      <div className="panel" style={{ background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>PO # &amp; DATE</th>
              <th style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>SUPPLIER</th>
              <th style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>DUE DATE</th>
              <th style={{ padding: '12px 16px', fontSize: 12, color: '#475569', textAlign: 'right' }}>TOTAL AMOUNT</th>
              <th style={{ padding: '12px 16px', fontSize: 12, color: '#475569', textAlign: 'center' }}>STATUS</th>
              <th style={{ padding: '12px 16px', fontSize: 12, color: '#475569', textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  {loading ? 'Loading material purchase orders...' : 'No purchase orders found.'}
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{order.po_number}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {String(order.order_date).slice(0, 10)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{order.supplier_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{order.supplier_code}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#334155' }}>
                    {order.delivery_date ? String(order.delivery_date).slice(0, 10) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                    BDT {Number(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {renderStatusPill(order.status)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          await openOrderDetail(order.id);
                          setShowPrintModal(true);
                        }}
                        title="Print / View Order Sheet"
                      >
                        <Printer size={13} />
                        <span>PO Sheet</span>
                      </button>

                      {order.status === 'approved' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={async () => {
                            await openOrderDetail(order.id);
                            initiateReceive(order);
                          }}
                          title="Receive Goods into Warehouse"
                        >
                          <Truck size={13} />
                          <span>Receive (GRN)</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MATERIAL ORDER MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 920,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              border: '1px solid #e2e8f0',
              padding: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    Place Direct Material Purchase Order
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Order paper reams, boards, inks, or supplies with real-time financial calculation.
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowCreateModal(false)}
                disabled={busy}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: 24 }}>
              {/* Top Row: Supplier & Dates */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Select Supplier / Paper Mill *
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={supplierId}
                    onChange={e => handleSupplierChange(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Order Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%' }}
                    value={orderDate}
                    onChange={e => setOrderDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Expected Delivery Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%' }}
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Target Warehouse *
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={defaultWarehouseId}
                    onChange={e => setDefaultWarehouseId(e.target.value)}
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material Lines Table */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="field-label" style={{ fontWeight: 700, fontSize: 14 }}>
                    Ordered Raw Materials (Items &amp; Quantities)
                  </label>
                  <button type="button" className="btn btn-sm" onClick={addLine}>
                    <Plus size={13} />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px' }}>RAW MATERIAL ITEM</th>
                        <th style={{ padding: '10px 12px', width: 120 }}>QUANTITY</th>
                        <th style={{ padding: '10px 12px', width: 140 }}>UNIT RATE (BDT )</th>
                        <th style={{ padding: '10px 12px', width: 140, textAlign: 'right' }}>LINE SUBTOTAL</th>
                        <th style={{ padding: '10px 12px', width: 50, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              className="input"
                              style={{ width: '100%', fontSize: 13 }}
                              value={line.itemId}
                              onChange={e => handleLineItemChange(idx, e.target.value)}
                              required
                            >
                              <option value="">-- Select Material / Paper / Board --</option>
                              {rawMaterialItems.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.item_code} | {item.name} ({item.base_uom})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              className="input"
                              style={{ width: '100%', fontSize: 13 }}
                              value={line.orderedQty}
                              onChange={e => updateLine(idx, 'orderedQty', e.target.value)}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input"
                              style={{ width: '100%', fontSize: 13 }}
                              value={line.unitCost}
                              onChange={e => updateLine(idx, 'unitCost', e.target.value)}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                            BDT {lineSubtotal(line.orderedQty, line.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {lines.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeLine(idx)}
                                style={{ color: '#ef4444' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation Box */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: 20,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 18,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Order Instructions &amp; Specifications
                  </label>
                  <textarea
                    className="input"
                    rows={4}
                    style={{ width: '100%', fontSize: 13 }}
                    placeholder="e.g. 100 GSM Art paper, 23x36 reel/sheet, unloading included, delivery by Friday afternoon."
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                  />
                  <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
                    Credit Terms: <strong>{paymentTermsDays} days</strong> | Currency: <strong>BDT</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Items Gross Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>
                      BDT {calculations.grossSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Trade Discount (BDT ):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      style={{ width: 120, height: 30, textAlign: 'right', fontSize: 13 }}
                      value={discountAmount}
                      onChange={e => setDiscountAmount(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Government VAT / Tax (BDT ):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      style={{ width: 120, height: 30, textAlign: 'right', fontSize: 13 }}
                      value={taxAmount}
                      onChange={e => setTaxAmount(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Freight / Unloading (BDT ):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      style={{ width: 120, height: 30, textAlign: 'right', fontSize: 13 }}
                      value={deliveryAmount}
                      onChange={e => setDeliveryAmount(e.target.value)}
                    />
                  </div>

                  <div
                    style={{
                      borderTop: '1.5px solid #cbd5e1',
                      marginTop: 6,
                      paddingTop: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    <span>Net Order Payable:</span>
                    <span style={{ color: '#047857' }}>
                      BDT {calculations.netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || calculations.netTotal <= 0}
                >
                  {busy ? 'Placing Order...' : 'Place Material Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAST RECEIVE / GRN MODAL */}
      {showReceiveModal && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 800,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Receive Material Delivery (GRN) — {selectedOrder.po_number}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Vendor: <strong>{selectedOrder.supplier_name}</strong> | Stock will be credited to warehouse immediately.
                </p>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setShowReceiveModal(false)}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFastReceive} style={{ padding: 24 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Receiving Warehouse *
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={receiveWarehouseId}
                    onChange={e => setReceiveWarehouseId(e.target.value)}
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%' }}
                    value={receiveDate}
                    onChange={e => setReceiveDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="field-label" style={{ fontWeight: 600 }}>
                    Vendor Delivery Chalan / Note #
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="e.g. CHALAN-2026-99"
                    value={deliveryNote}
                    onChange={e => setDeliveryNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Items Verification Table */}
              <div style={{ marginBottom: 20 }}>
                <label className="field-label" style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>
                  Verify Received Quantities
                </label>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px' }}>MATERIAL ITEM</th>
                        <th style={{ padding: '10px 12px', width: 110 }}>ORDERED</th>
                        <th style={{ padding: '10px 12px', width: 130 }}>RECEIVED</th>
                        <th style={{ padding: '10px 12px', width: 130 }}>ACCEPTED (STOCK-IN)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.lines || []).map((line: any) => {
                        const state = receiveLines[line.id] || {
                          received: line.ordered_qty,
                          accepted: line.ordered_qty,
                        };
                        return (
                          <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{line.item_name}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                Code: {line.item_code} | UOM: {line.base_uom}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                              {Number(line.ordered_qty).toLocaleString()} {line.base_uom}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="input"
                                style={{ width: '100%', fontSize: 13 }}
                                value={state.received}
                                onChange={e => {
                                  const val = e.target.value;
                                  setReceiveLines(prev => ({
                                    ...prev,
                                    [line.id]: {
                                      ...prev[line.id],
                                      received: val,
                                      accepted: val,
                                    },
                                  }));
                                }}
                                required
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="input"
                                style={{ width: '100%', fontSize: 13, borderColor: '#10b981' }}
                                value={state.accepted}
                                onChange={e => {
                                  const val = e.target.value;
                                  setReceiveLines(prev => ({
                                    ...prev,
                                    [line.id]: {
                                      ...prev[line.id],
                                      accepted: val,
                                    },
                                  }));
                                }}
                                required
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowReceiveModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Processing GRN...' : 'Confirm Delivery & Stock In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT / ORDER SHEET PREVIEW MODAL */}
      {showPrintModal && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 850,
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Official Material Purchase Order Sheet
              </h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPrintModal(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Order Sheet */}
            <div style={{ padding: 32, color: '#0f172a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    ENTERPRISE PUBLISHING HOUSE
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
                    Central Printing, Production &amp; Material Procurement Division<br />
                    Dhaka, Bangladesh | E-mail: procurement@publishing-erp.local
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>
                    PURCHASE ORDER
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    PO #: {selectedOrder.po_number}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Date: {String(selectedOrder.order_date).slice(0, 10)}
                  </div>
                </div>
              </div>

              {/* Vendor & Delivery Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    SUPPLIER DETAILS
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedOrder.supplier_name}</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    Code: {selectedOrder.supplier_code}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Payment Terms: {selectedOrder.payment_terms_days ?? 30} Days
                  </div>
                </div>

                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    DELIVERY SPECIFICATIONS
                  </div>
                  <div style={{ fontSize: 13 }}>
                    Expected Delivery: <strong>{selectedOrder.delivery_date ? String(selectedOrder.delivery_date).slice(0, 10) : 'Immediate'}</strong>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    Currency: <strong>{selectedOrder.currency_code || 'BDT'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Notes: {selectedOrder.decision_note || 'Standard packaging and delivery condition.'}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>#</th>
                    <th style={{ padding: '10px 12px' }}>MATERIAL DESCRIPTION</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>QUANTITY</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>RATE (BDT)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>AMOUNT (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.lines || []).map((l: any, i: number) => {
                    const lineAmt = Number(l.ordered_qty || 0) * Number(l.unit_cost || 0);
                    return (
                      <tr key={l.id || i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 12px' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{l.item_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Item Code: {l.item_code}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {Number(l.ordered_qty).toLocaleString()} {l.base_uom}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          BDT {Number(l.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          BDT {lineAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Grand Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
                <div style={{ width: 300, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Discount:</span>
                    <span>- BDT {Number(selectedOrder.discount_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Tax / VAT:</span>
                    <span>+ BDT {Number(selectedOrder.tax_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Carriage / Freight:</span>
                    <span>+ BDT {Number(selectedOrder.delivery_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0f172a',
                      paddingTop: 8,
                      marginTop: 4,
                      fontSize: 16,
                      fontWeight: 800,
                    }}
                  >
                    <span>Total Order Value:</span>
                    <span>BDT {Number(selectedOrder.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60 }}>
                <div style={{ textAlign: 'center', width: 200, borderTop: '1px solid #64748b', paddingTop: 8, fontSize: 12 }}>
                  Prepared By
                </div>
                <div style={{ textAlign: 'center', width: 200, borderTop: '1px solid #64748b', paddingTop: 8, fontSize: 12 }}>
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
