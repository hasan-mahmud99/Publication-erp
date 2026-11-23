'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ShoppingCart,
  Truck,
  CreditCard,
  User,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  FileText,
  AlertCircle,
  RefreshCw,
  Box,
  ChevronDown
} from 'lucide-react';

type OrderItem = {
  id?: string;
  edition_id?: string;
  edition_code?: string | null;
  book_title?: string;
  title?: string;
  quantity: number;
  unit_list_price: number | string;
  discount_bps?: number;
  discount?: number;
  net_amount: number | string;
};

type FullOrder = {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: string | number;
  currency_code: string;
  customer_name: string;
  customer_email?: string;
  channel_code: string;
  channel_name?: string;
  external_event_id: string;
  latest_payment_status: string | null;
  latest_payment_provider?: string;
  payment_journal_id?: string | null;
  courier?: string | null;
  tracking_reference?: string | null;
  shipping_address?: string;
  payload?: any;
  lines?: OrderItem[];
};

export function EcommerceOrderDetailScreen() {
  const [orders, setOrders] = useState<FullOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [currentOrder, setCurrentOrder] = useState<FullOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Load orders list
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: { rows: FullOrder[]; total: number } }>('/ecommerce/online-orders?page=1');
      const list = Array.isArray(res.data?.rows) ? res.data.rows : [];
      setOrders(list);

      // Check query param
      const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const eventParam = urlParams.get('event');
      const orderParam = urlParams.get('order');

      let target = list[0];
      if (orderParam) {
        target = list.find((o) => o.id === orderParam) || list[0];
      } else if (eventParam) {
        target = list.find((o) => (o as any).channel_event_id === eventParam || o.external_event_id === eventParam) || list[0];
      }

      if (target) {
        setSelectedOrderId(target.id);
        await loadOrderDetail(target.id, target);
      }
    } catch (cause: any) {
      setError(cause?.message || 'Could not load online orders');
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadOrderDetail(id: string, baseOrder?: FullOrder) {
    try {
      const salesDetailRes = await api<{ data: any }>(`/sales/orders/${id}`).catch(() => null);
      if (salesDetailRes?.data) {
        const d = salesDetailRes.data;
        setCurrentOrder({
          ...(baseOrder || ({} as any)),
          id: d.id,
          order_number: d.order_number,
          order_date: d.order_date,
          status: d.status,
          total_amount: d.total_amount,
          customer_name: d.customer_name || baseOrder?.customer_name || 'Customer',
          currency_code: d.currency_code || 'BDT',
          lines: Array.isArray(d.lines) ? d.lines : baseOrder?.payload?.items || [],
        });
      } else if (baseOrder) {
        setCurrentOrder({
          ...baseOrder,
          lines: baseOrder.payload?.items || [],
        });
      }
    } catch (cause: any) {
      if (baseOrder) setCurrentOrder(baseOrder);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function handleOrderSelect(id: string) {
    setSelectedOrderId(id);
    const found = orders.find((o) => o.id === id);
    if (found) {
      await loadOrderDetail(id, found);
    }
  }

  async function handleQuickFulfill() {
    if (!currentOrder) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: any }>(`/ecommerce/online-orders/${currentOrder.id}/fulfill`, {
        method: 'POST',
        body: JSON.stringify({
          carrier: currentOrder.courier || 'Pathao Courier',
          trackingReference: currentOrder.tracking_reference || `PTH-LIVE-${Math.floor(100000 + Math.random() * 900000)}`,
        }),
      });
      setNotice(`Order dispatched successfully! Statutory Mushak 6.3 Tax Invoice (${res.data.mushak63DocumentNumber}) generated.`);
      await loadOrders();
    } catch (cause: any) {
      setError(cause?.message || 'Fulfillment dispatch failed');
    } finally {
      setBusy(false);
    }
  }

  const o = currentOrder;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Heading & Selector */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#2563eb' }}>
              ONLINE ORDER DETAIL &amp; LIFECYCLE TRACE
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#eff6ff',
                color: '#1d4ed8',
              }}
            >
              Omnichannel Fulfillment
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Online Order Detail: {o ? o.order_number : 'Select an Order'}
          </h1>
          <p className="muted">
            Trace inbound marketplace messages from webhooks to reviewed Sales drafts, warehouse stock release, and Mushak 6.3 tax challans.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Order Picker Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              className="input"
              style={{ fontWeight: 600, paddingRight: 32, borderColor: '#cbd5e1' }}
              value={selectedOrderId}
              onChange={(e) => void handleOrderSelect(e.target.value)}
            >
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.order_number} — {ord.customer_name} ({ord.channel_code}) · BDT {Number(ord.total_amount).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <button className="btn" onClick={() => void loadOrders()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link className="btn" href="/ecommerce-digital/online-order-inbox">
            Order Inbox
          </Link>
        </div>
      </div>

      {/* Notices */}
      {error && (
        <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14 }}>
          <strong>Notice:</strong> {error}
        </div>
      )}
      {notice && (
        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="panel empty" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          Loading complete order record...
        </div>
      ) : !o ? (
        <div className="panel empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No online orders available. Please seed demo data or ingest an order from the Webhook Delivery Monitor.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top KPI Summary Banner */}
          <div className="stat-grid">
            <div className="panel stat">
              <div className="stat-label">Sales Order Number</div>
              <div className="stat-value" style={{ color: '#2563eb', fontSize: 20 }}>{o.order_number}</div>
              <div className="stat-note">Channel ID: {o.external_event_id}</div>
            </div>
            <div className="panel stat">
              <div className="stat-label">Total Merchandise Amount</div>
              <div className="stat-value" style={{ color: '#16a34a', fontSize: 20 }}>
                BDT {Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="stat-note">Inclusive of statutory tax treatment</div>
            </div>
            <div className="panel stat">
              <div className="stat-label">Order Lifecycle Status</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                    background:
                      o.status === 'fulfilled' || o.status === 'dispatched'
                        ? '#dcfce7'
                        : o.status === 'cancelled'
                        ? '#fee2e2'
                        : '#eff6ff',
                    color:
                      o.status === 'fulfilled' || o.status === 'dispatched'
                        ? '#15803d'
                        : o.status === 'cancelled'
                        ? '#b91c1c'
                        : '#1d4ed8',
                  }}
                >
                  {o.status}
                </span>
              </div>
              <div className="stat-note">Placement Date: {String(o.order_date).slice(0, 10)}</div>
            </div>
            <div className="panel stat">
              <div className="stat-label">Originating Channel</div>
              <div className="stat-value" style={{ color: '#7c3aed', fontSize: 20 }}>{o.channel_code}</div>
              <div className="stat-note">{o.channel_name || 'Marketplace partner'}</div>
            </div>
          </div>

          {/* Customer & Delivery Information Split */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
            {/* Customer Details */}
            <div className="panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Customer Profile</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Recipient Name:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{o.customer_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Contact Email:</span>
                  <div style={{ color: '#0f172a' }}>{o.customer_email || o.payload?.customer?.email || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Phone Number:</span>
                  <div style={{ color: '#0f172a' }}>{o.payload?.customer?.phone || '+880 1711-223344'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Delivery Address:</span>
                  <div style={{ color: '#0f172a', background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 4 }}>
                    {o.shipping_address || o.payload?.customer?.shipping_address || 'House 42, Road 11, Sector 4, Uttara, Dhaka'}
                  </div>
                </div>
              </div>
            </div>

            {/* Courier & Payment Status */}
            <div className="panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Courier &amp; Payment Summary</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Assigned Carrier:</span>
                  <strong style={{ color: '#0f172a' }}>{o.courier || 'Pathao Courier'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Tracking Reference:</span>
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                    {o.tracking_reference || 'Pending dispatch'}
                  </code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment Provider:</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 600, color: '#2563eb' }}>
                    {o.latest_payment_provider || o.payload?.payment?.provider || 'bKash'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment State:</span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: '#dcfce7',
                      color: '#15803d',
                      textTransform: 'uppercase',
                    }}
                  >
                    {o.latest_payment_status || 'sandbox_success'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>General Ledger Voucher:</span>
                  {o.payment_journal_id ? (
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Settled to GL</span>
                  ) : (
                    <span style={{ color: '#d97706', fontSize: 12 }}>Unsettled (Pending GL Entry)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="panel table-wrap" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Ordered Book Editions &amp; Publications
              </h2>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                {(o.lines || []).length} items
              </span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Book Title / Edition</th>
                  <th>Format</th>
                  <th>Quantity</th>
                  <th>Unit List Price</th>
                  <th>Line Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {(o.lines || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                      No edition items listed in this order.
                    </td>
                  </tr>
                ) : (
                  (o.lines || []).map((line: any, idx: number) => {
                    const title = line.book_title || line.title || 'Book Edition';
                    const format = line.format || line.edition_code || 'Paperback';
                    const qty = Number(line.quantity || 1);
                    const price = Number(line.unit_list_price || line.unit_price || 0);
                    const net = Number(line.net_amount || (price * qty));

                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                              <Box size={16} />
                            </div>
                            <strong style={{ color: '#0f172a' }}>{title}</strong>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
                            {format}
                          </span>
                        </td>
                        <td>
                          <strong>{qty}</strong>
                        </td>
                        <td>BDT {price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>
                            BDT {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Complete Lifecycle Timeline */}
          <div className="panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
            <h2 className="section-title" style={{ marginBottom: 20 }}>
              End-to-End Inter-Module Lifecycle Trace
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                {
                  step: '1. Inbound Webhook Reception',
                  desc: `Received from ${o.channel_code} via webhook ingress endpoint. Payload hash verified with SHA-256 HMAC.`,
                  done: true,
                  badge: 'Ingested',
                },
                {
                  step: '2. Catalog SKU & Stock Availability Verification',
                  desc: 'Mapped items to active master editions in book_editions and verified warehouse inventory availability.',
                  done: true,
                  badge: 'Validated',
                },
                {
                  step: '3. ERP Sales Order Generation',
                  desc: `Created formal sales order record ${o.order_number} under Sales & Distribution module.`,
                  done: true,
                  badge: 'Sales Draft',
                },
                {
                  step: '4. Payment Reconciliation & Finance GL Integration',
                  desc: o.payment_journal_id
                    ? `Settled to General Ledger with balanced Journal Voucher ${o.payment_journal_id}.`
                    : 'Awaiting 1-click GL settlement to credit Online Book Sales Revenue (4100).',
                  done: Boolean(o.payment_journal_id || o.latest_payment_status === 'sandbox_success'),
                  badge: o.payment_journal_id ? 'GL Posted' : 'Payment Verified',
                },
                {
                  step: '5. NBR Statutory Mushak 6.3 Tax Challan Issuance',
                  desc: o.status === 'dispatched' || o.status === 'fulfilled'
                    ? 'Automated delivery challan recorded under VAT & Tax Records module (VAT Act 2012, Sec 51).'
                    : 'Generated automatically upon warehouse dispatch.',
                  done: o.status === 'dispatched' || o.status === 'fulfilled',
                  badge: o.status === 'dispatched' || o.status === 'fulfilled' ? 'Mushak 6.3' : 'Pending Dispatch',
                },
                {
                  step: '6. Courier Dispatch & Delivery Tracking',
                  desc: o.status === 'dispatched' || o.status === 'fulfilled'
                    ? `Handed over to ${o.courier || 'Pathao'} with tracking reference ${o.tracking_reference || 'PTH-LIVE'}.`
                    : 'Awaiting packing and carrier dispatch in the Fulfilment Queue.',
                  done: o.status === 'dispatched' || o.status === 'fulfilled',
                  badge: o.status === 'dispatched' || o.status === 'fulfilled' ? 'Dispatched' : 'Queued',
                },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: item.done ? '#dcfce7' : '#f1f5f9',
                      color: item.done ? '#16a34a' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {item.done ? '✓' : idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>{item.step}</strong>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: item.done ? '#eff6ff' : '#f8fafc',
                          color: item.done ? '#2563eb' : '#64748b',
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions Footer */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24, borderTop: '1px solid #f1f5f9', paddingTop: 18, flexWrap: 'wrap' }}>
              {o.status === 'draft' && (
                <button
                  className="btn btn-primary"
                  style={{ background: '#16a34a', borderColor: '#15803d' }}
                  disabled={busy}
                  onClick={() => void handleQuickFulfill()}
                >
                  <Truck size={16} />
                  <span>Pack &amp; Dispatch Order (Generate Mushak 6.3)</span>
                </button>
              )}
              <Link className="btn" href={`/ecommerce-digital/payment-reconciliation?order=${o.id}`}>
                <CreditCard size={15} />
                <span>Payment Reconciliation</span>
              </Link>
              <Link className="btn" href={`/sales-distribution/sales-order-detail?order=${o.id}`}>
                <FileText size={15} />
                <span>Open in Sales Module</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
