"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import { ManualSalesOrderForm } from '@/components/manual-sales-order-form';
import { SalesOrderEditForm } from '@/components/sales-order-edit-form';

type Order = {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  currency_code: string;
  total_amount: string;
  customer_name: string;
  quotation_id: string | null;
  quotation_number: string | null;
  line_count: number;
  quantity: number;
};

type OrderSummary = {
  total: number;
  draft: number;
  confirmed: number;
  fulfilled: number;
  cancelled: number;
  draftValue: string;
};

type OrderDetail = Order & {
  version_no: number;
  created_by: string | null;
  customer_id: string;
  customer_code?: string;
  invoice?: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total_amount: string;
    sales_channel: string;
    status: string;
    posted_at: string;
    payment_status?: string;
    payment_method?: string;
    paid_amount?: string | number;
    due_amount?: string | number;
    payment_reference?: string | null;
  } | null;
  lines: Array<{
    id: string;
    book_title: string;
    edition_code: string | null;
    edition_id: string;
    quantity: number;
    unit_list_price: string;
    discount_bps: number;
    net_amount: string;
    available_stock?: string | number;
    on_hand_stock?: string | number;
  }>;
};

type Revision = {
  version: number;
  changedAt: string;
  snapshot: {
    header: { order_number: string; total_amount: string };
    lines: Array<{ edition_id: string; quantity: number; unit_list_price: string; net_amount: string }>;
  };
};

type Quote = {
  id: string;
  quotation_number: string;
  customer_name: string;
  total_amount: string;
  valid_until: string;
  status?: string;
};

const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function SalesOrderScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const creating = screen.title === 'Create Sales Order';
  const detailPage = screen.title === 'Sales Order Detail';

  const [rows, setRows] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState('');
  const [quoteDetail, setQuoteDetail] = useState<any>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [page, setPage] = useState(0);
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const canManage = role === 'Owner' || permissions.includes('sales.manage');

  async function load() {
    if (creating) {
      const result = (await api<{ data: { rows: Quote[] } }>('/sales/quotations?limit=100')).data;
      setQuotes((result.rows || []).filter(r => r.status !== 'rejected'));
      return;
    }
    const params = new URLSearchParams({ limit: '25', offset: String(page * 25), sort });
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);

    const [list, metrics] = await Promise.all([
      api<{ data: { rows: Order[]; total: number } }>(`/sales/orders?${params}`),
      api<{ data: OrderSummary }>('/sales/orders/summary'),
    ]);
    setRows(list.data.rows);
    setTotal(list.data.total);
    setSummary(metrics.data);
  }

  useEffect(() => {
    void api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me')
      .then(result => {
        setUserId(result.data.userId);
        setRole(result.data.role);
        setPermissions(result.data.permissions);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load permissions'));
  }, []);

  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get('order');
    if (order) setSelectedId(order);
  }, []);

  useEffect(() => {
    if (creating && quotes.length) {
      const qParam = new URLSearchParams(window.location.search).get('quote');
      if (qParam && quotes.some(q => q.id === qParam)) {
        setSelectedQuote(qParam);
      }
    }
  }, [creating, quotes]);

  useEffect(() => {
    if (selectedQuote && !orderNumber) {
      const found = quotes.find(q => q.id === selectedQuote);
      if (found) {
        setOrderNumber(`SO-${found.quotation_number}`);
      }
    }
  }, [selectedQuote, quotes, orderNumber]);

  useEffect(() => {
    if (!selectedQuote) {
      setQuoteDetail(null);
      return;
    }
    void api<{ data: any }>(`/sales/quotations/${selectedQuote}`)
      .then(res => setQuoteDetail(res.data))
      .catch(() => setQuoteDetail(null));
  }, [selectedQuote]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load Sales orders'))
      .finally(() => setLoading(false));
  }, [creating, page, search, statusFilter, sort]);

  useEffect(() => {
    if (selectedId) {
      void api<{ data: OrderDetail }>(`/sales/orders/${selectedId}`)
        .then(result => setDetail(result.data))
        .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load Sales order'));
    }
  }, [selectedId]);

  useEffect(() => {
    if (!detail) {
      setRevisions([]);
      return;
    }
    void api<{ data: Revision[] }>(`/sales/orders/${detail.id}/revisions`)
      .then(result => setRevisions(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load order versions'));
  }, [detail?.id, detail?.version_no]);

  async function exportCsv() {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      const blob = await apiFile(`/sales/orders/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales-orders.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export Sales orders');
    } finally {
      setBusy(false);
    }
  }

  async function downloadInvoicePdf(orderId = detail?.id, orderNo = detail?.order_number) {
    if (!orderId) return;
    setBusy(true);
    setError('');
    try {
      const blob = await apiFile(`/sales/orders/${orderId}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${String(orderNo || 'order').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download Sales invoice PDF');
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder(id = detail?.id) {
    if (!id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ data: { status: string; totalShortage: number; lineReports: any[] } }>(`/sales/orders/${id}/confirm`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      if (res.data.totalShortage > 0) {
        setNotice(`Order confirmed! Stock reserved in warehouse where available. Note: ${res.data.totalShortage} copies have warehouse stock shortage and will require printing or restocking.`);
      } else {
        setNotice('Order confirmed! Stock successfully reserved in warehouse inventory.');
      }
      await load();
      if (selectedId === id || detail?.id === id) {
        const refreshed = await api<{ data: OrderDetail }>(`/sales/orders/${id}`);
        setDetail(refreshed.data);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm order');
    } finally {
      setBusy(false);
    }
  }

  async function fulfillOrder(id = detail?.id) {
    if (!id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api<{ data: { status: string; transactionId: string } }>(`/sales/orders/${id}/fulfill`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setNotice('Order fulfilled & dispatched! Physical stock has been successfully deducted from warehouse inventory.');
      await load();
      if (selectedId === id || detail?.id === id) {
        const refreshed = await api<{ data: OrderDetail }>(`/sales/orders/${id}`);
        setDetail(refreshed.data);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not fulfill order');
    } finally {
      setBusy(false);
    }
  }

  async function unconfirmOrder(id = detail?.id) {
    if (!id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api<{ data: { status: string } }>(`/sales/orders/${id}/unconfirm`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setNotice('Order returned to draft. Reserved stock has been released in warehouse.');
      await load();
      if (selectedId === id || detail?.id === id) {
        const refreshed = await api<{ data: OrderDetail }>(`/sales/orders/${id}`);
        setDetail(refreshed.data);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unconfirm order');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/sales/orders/${detail.id}/cancel`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setNotice('Sales order cancelled. Any stock reservations have been released.');
      setCancelReason('');
      await load();
      setDetail((await api<{ data: OrderDetail }>(`/sales/orders/${detail.id}`)).data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not cancel order');
    } finally {
      setBusy(false);
    }
  }

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'cancelled':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' };
      case 'draft':
        return { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };
      case 'confirmed':
        return { bg: '#fffbeb', text: '#92400e', border: '#fde68a' };
      case 'fulfilled':
      case 'complete':
      case 'posted':
      case 'accepted':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
      default:
        return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
    }
  };

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Commercial order execution and delivery schedules connected with live warehouse inventory.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            className="btn"
            href="/sales-distribution/sales-order-list"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📋 Orders List
          </Link>
          <Link
            className="btn btn-primary"
            href="/sales-distribution/create-sales-order"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span>
            <span>New Sales Order</span>
          </Link>
          {!creating && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void exportCsv()}
            >
              📥 Export CSV
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {/* KPI Cards (Matches Printing & Production standard) */}
      {!creating && !detailPage && summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          <div
            className="panel"
            onClick={() => {
              setStatusFilter('');
              setPage(0);
            }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: statusFilter === '' ? '4px solid #4f46e5' : '4px solid transparent',
              background: statusFilter === '' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              📦 Total Orders
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
              {summary.total}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              All sales orders
            </div>
          </div>

          <div
            className="panel"
            onClick={() => {
              setStatusFilter('draft');
              setPage(0);
            }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: statusFilter === 'draft' ? '4px solid #0ea5e9' : '4px solid transparent',
              background: statusFilter === 'draft' ? 'var(--panel-active-bg, #f0f9ff)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
              📝 Draft Orders
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
              {summary.draft}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Pending confirmation
            </div>
          </div>

          <div
            className="panel"
            onClick={() => {
              setStatusFilter('confirmed');
              setPage(0);
            }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: statusFilter === 'confirmed' ? '4px solid #f59e0b' : '4px solid transparent',
              background: statusFilter === 'confirmed' ? 'var(--panel-active-bg, #fffbeb)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
              ⏳ Confirmed Orders
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
              {summary.confirmed || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Stock reserved in warehouse
            </div>
          </div>

          <div
            className="panel"
            onClick={() => {
              setStatusFilter('fulfilled');
              setPage(0);
            }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: statusFilter === 'fulfilled' ? '4px solid #10b981' : '4px solid transparent',
              background: statusFilter === 'fulfilled' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
              🚚 Fulfilled Orders
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
              {summary.fulfilled || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Dispatched &amp; stock deducted
            </div>
          </div>

          <div
            className="panel"
            onClick={() => {
              setStatusFilter('cancelled');
              setPage(0);
            }}
            style={{
              padding: '16px 20px',
              cursor: 'pointer',
              borderLeft: statusFilter === 'cancelled' ? '4px solid #ef4444' : '4px solid transparent',
              background: statusFilter === 'cancelled' ? 'var(--panel-active-bg, #fef2f2)' : undefined,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
              🚫 Cancelled
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
              {summary.cancelled}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Archived drafts
            </div>
          </div>
        </div>
      )}

      {/* Form when creating */}
      {creating && !loading && <ManualSalesOrderForm canManage={canManage} />}

      {/* Main Table View */}
      {!creating && !loading && (
        <div className="panel" style={{ padding: '20px' }}>
          {/* Search & Filters Toolbar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '6px', minWidth: '280px' }}>
                <input
                  className="input"
                  placeholder="🔍 Search order # or customer..."
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      setPage(0);
                      setSearch(query.trim());
                    }
                  }}
                  style={{ fontSize: '13px' }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPage(0);
                    setSearch(query.trim());
                  }}
                >
                  Search
                </button>
              </div>

              <select
                className="input"
                value={statusFilter}
                onChange={event => {
                  setStatusFilter(event.target.value);
                  setPage(0);
                }}
                style={{ fontSize: '13px', width: 'auto' }}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft Orders</option>
                <option value="confirmed">Confirmed Orders</option>
                <option value="fulfilled">Fulfilled Orders</option>
                <option value="cancelled">Cancelled Orders</option>
              </select>

              <select
                className="input"
                value={sort}
                onChange={event => {
                  setSort(event.target.value);
                  setPage(0);
                }}
                style={{ fontSize: '13px', width: 'auto' }}
              >
                <option value="date_desc">Newest date</option>
                <option value="date_asc">Oldest date</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
              </select>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Showing <strong>{rows.length}</strong> of <strong>{total}</strong> sales orders
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Source Quotation</th>
                  <th>Lines / Quantity</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map(row => {
                    const badge = getStatusBadgeStyle(row.status);
                    const formattedTotal = parseFloat(row.total_amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                    return (
                      <tr key={row.id}>
                        <td>
                          <code
                            style={{
                              fontSize: '12px',
                              background: '#f1f5f9',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              color: '#1e293b',
                            }}
                          >
                            {row.order_number}
                          </code>
                        </td>
                        <td>{String(row.order_date).slice(0, 10)}</td>
                        <td>
                          <strong>{row.customer_name}</strong>
                        </td>
                        <td>
                          {row.quotation_number ? (
                            <code
                              style={{
                                fontSize: '11px',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {row.quotation_number}
                            </code>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Direct Order</span>
                          )}
                        </td>
                        <td>
                          {row.line_count} titles · {row.quantity} pcs
                        </td>
                        <td>
                          <strong>{formattedTotal} {row.currency_code}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {human(row.status)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            {canManage && row.status === 'draft' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                title="Confirm order & reserve stock"
                                onClick={() => void confirmOrder(row.id)}
                              >
                                Confirm
                              </button>
                            )}
                            {canManage && row.status === 'confirmed' && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600 }}
                                title="Fulfill order & deduct physical stock"
                                onClick={() => void fulfillOrder(row.id)}
                              >
                                Fulfill
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                setSelectedId(row.id);
                                if (!detailPage) {
                                  router.push(`/sales-distribution/sales-order-detail?order=${row.id}`);
                                }
                              }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              title="Download PDF Invoice"
                              onClick={() => void downloadInvoicePdf(row.id, row.order_number)}
                            >
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="empty" style={{ textAlign: 'center', padding: '32px' }}>
                      No sales orders match the active search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {rows.length ? page * 25 + 1 : 0} to {Math.min((page + 1) * 25, total)} of {total} records · Page {page + 1}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page === 0}
                onClick={() => setPage(current => current - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={(page + 1) * 25 >= total}
                onClick={() => setPage(current => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View */}
      {detail && (() => {
        const gross = (detail.lines || []).reduce(
          (sum, l) => sum + (parseFloat(l.unit_list_price) || 0) * (Number(l.quantity) || 0),
          0
        );
        const net = parseFloat(detail.total_amount) || 0;
        const discount = Math.max(0, gross - net);
        const totalUnits = (detail.lines || []).reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
        const badge = getStatusBadgeStyle(detail.status);

        return (
          <div style={{ marginTop: '24px' }}>
            {/* Breadcrumb sub-nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '13px' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setDetail(null);
                  setSelectedId('');
                  if (detailPage) router.push('/sales-distribution/sales-order-list');
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                ← Back to Orders List
              </button>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#64748b' }}>Order Execution Workspace</span>
            </div>

            {/* Header Panel */}
            <div className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      Sales Order {detail.order_number}
                    </h2>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {detail.status}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '14px' }}>
                    Customer: <strong>{detail.customer_name}</strong> {detail.customer_code ? `(${detail.customer_code})` : ''} · Total: <strong>{detail.total_amount} {detail.currency_code}</strong>
                  </p>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                    Source quotation: {detail.quotation_number ? <strong>{detail.quotation_number}</strong> : 'Manual Direct Order'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {canManage && detail.status === 'draft' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void confirmOrder(detail.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>✅</span>
                      <span>Confirm Order (Reserve Stock)</span>
                    </button>
                  )}
                  {canManage && (detail.status === 'draft' || detail.status === 'confirmed') && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void fulfillOrder(detail.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ecfdf5',
                        borderColor: '#a7f3d0',
                        color: '#065f46',
                        fontWeight: 700,
                      }}
                    >
                      <span>🚚</span>
                      <span>Fulfill &amp; Dispatch (Deduct Stock)</span>
                    </button>
                  )}
                  {canManage && detail.status === 'confirmed' && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void unconfirmOrder(detail.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>↩️</span>
                      <span>Return to Draft</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void downloadInvoicePdf(detail.id, detail.order_number)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>📄</span>
                    <span>Download Invoice (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Status and Inventory Connection Callout */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  background: detail.status === 'fulfilled' ? '#ecfdf5' : detail.status === 'confirmed' ? '#fffbeb' : '#f0f9ff',
                  border: `1px solid ${detail.status === 'fulfilled' ? '#a7f3d0' : detail.status === 'confirmed' ? '#fde68a' : '#bae6fd'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <strong style={{ color: detail.status === 'fulfilled' ? '#065f46' : detail.status === 'confirmed' ? '#92400e' : '#0369a1' }}>
                    {detail.status === 'fulfilled'
                      ? '✓ Inventory Dispatched & Deducted'
                      : detail.status === 'confirmed'
                      ? '⏳ Confirmed & Reserved in Inventory'
                      : 'ℹ️ Draft Order Status'}
                  </strong>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#475569' }}>
                    {detail.status === 'fulfilled'
                      ? 'Physical books have been deducted from warehouse inventory. All balances reflect the dispatch.'
                      : detail.status === 'confirmed'
                      ? 'Stock is reserved in the warehouse so no other order can take it. Click "Fulfill & Dispatch" once goods leave the warehouse floor.'
                      : 'Creating an order in draft does not deduct stock. Click "Confirm Order" to reserve stock, or "Fulfill & Dispatch" to deduct stock immediately.'}
                  </p>
                </div>
                <Link
                  className="btn"
                  href="/inventory-warehouse/inventory-balance-inquiry"
                  style={{ background: '#fff', fontSize: '12px', fontWeight: 600 }}
                >
                  View Inventory Balances ➔
                </Link>
              </div>

              {/* Linked Invoice Banner with direct link to Sales Reports */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>
                    ✓ Linked Commercial Invoice: INV-{detail.order_number}
                  </span>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
                    Status: <strong style={{ color: '#16a34a' }}>POSTED</strong> · Channel: <strong>{detail.invoice?.sales_channel || 'direct'}</strong> · Amount: <strong>{detail.total_amount} BDT</strong> · Posted to live sales & returns registers
                  </p>
                </div>
                <Link
                  className="btn"
                  href="/reports-analytics/sales-and-returns-reports"
                  style={{ borderColor: '#cbd5e1', background: '#fff', fontSize: '12px', fontWeight: 600 }}
                >
                  View in Sales &amp; Returns Reports ➔
                </Link>
              </div>

              {/* Payment & Due Settlement Status */}
              {detail.invoice && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: (Number(detail.invoice.due_amount) || 0) > 0 ? '#fffbeb' : '#ecfdf5',
                    border: (Number(detail.invoice.due_amount) || 0) > 0 ? '1px solid #fde68a' : '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '16px' }}>
                      {detail.invoice.payment_method === 'bkash' ? '📱' :
                       detail.invoice.payment_method === 'nagad' ? '📱' :
                       detail.invoice.payment_method === 'cash' ? '💵' :
                       detail.invoice.payment_method === 'bank_transfer' ? '🏦' :
                       detail.invoice.payment_method === 'cheque' ? '📜' : '📋'}
                    </span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        Settlement Method: <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{String(detail.invoice.payment_method || 'credit').replace('_', ' ')}</span>
                        {detail.invoice.payment_reference && (
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>(Ref: {detail.invoice.payment_reference})</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Paid Amount: <strong style={{ color: '#059669' }}>৳{parseFloat(String(detail.invoice.paid_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> |
                        Due Amount: <strong style={{ color: (Number(detail.invoice.due_amount) || 0) > 0 ? '#b91c1c' : '#059669' }}>৳{parseFloat(String(detail.invoice.due_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: detail.invoice.payment_status === 'paid' ? '#dcfce7' : detail.invoice.payment_status === 'partial' ? '#dbeafe' : '#fef2f2',
                        color: detail.invoice.payment_status === 'paid' ? '#15803d' : detail.invoice.payment_status === 'partial' ? '#1d4ed8' : '#b91c1c',
                        border: detail.invoice.payment_status === 'paid' ? '1px solid #86efac' : detail.invoice.payment_status === 'partial' ? '1px solid #93c5fd' : '1px solid #fca5a5',
                      }}
                    >
                      {detail.invoice.payment_status === 'paid' ? '✓ Fully Paid' : detail.invoice.payment_status === 'partial' ? '⚡ Partial Due' : '⚠️ Due on Credit'}
                    </span>
                    <Link
                      className="btn btn-sm"
                      href={`/sales-distribution/sales-invoice-list?invoice=${encodeURIComponent(detail.invoice.invoice_number)}`}
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Manage Invoicing &amp; Collection ➔
                    </Link>
                  </div>
                </div>
              )}

              {/* KPI Cards inside Detail View */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px',
                  marginTop: '20px',
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #4f46e5',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                    📦 Total Volume
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {totalUnits} copies
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    {detail.lines.length} distinct titles
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #0ea5e9',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
                    🏷️ Gross Catalog Value
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
                    {gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Standard MRP catalog list
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #f59e0b',
                    background: '#fffbeb',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                    ✨ Commercial Discount
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309', marginTop: '4px' }}>
                    - {discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Agreed quotation discount savings
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #10b981',
                    background: '#ecfdf5',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                    💳 Net Payable Total
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
                    {net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Final commercial invoice amount
                  </div>
                </div>
              </div>

              {/* Itemized Lines Table */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', color: '#0f172a' }}>
                  Ordered Items, Commercial Lines &amp; Inventory Availability
                </h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>#</th>
                        <th>Book Title &amp; Edition</th>
                        <th style={{ textAlign: 'right' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Warehouse Stock</th>
                        <th style={{ textAlign: 'right' }}>List Price (MRP)</th>
                        <th style={{ textAlign: 'right' }}>Discount</th>
                        <th style={{ textAlign: 'right' }}>Net Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Line Net Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((line, idx) => {
                        const qty = Number(line.quantity) || 0;
                        const listPrice = parseFloat(line.unit_list_price) || 0;
                        const discBps = Number(line.discount_bps) || 0;
                        const netAmt = parseFloat(line.net_amount) || 0;
                        const grossLine = listPrice * qty;
                        const discAmt = Math.max(0, grossLine - netAmt);
                        const netUnit = qty > 0 ? netAmt / qty : listPrice;
                        const avail = parseFloat(String(line.available_stock ?? '0'));
                        const isShort = qty > avail;

                        return (
                          <tr key={line.id}>
                            <td className="muted">{idx + 1}</td>
                            <td>
                              <strong>{line.book_title}</strong>
                              <span className="muted" style={{ display: 'block', fontSize: '12px' }}>
                                {line.edition_code || line.edition_id}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: !isShort ? '#ecfdf5' : '#fffbeb',
                                  color: !isShort ? '#065f46' : '#92400e',
                                  border: `1px solid ${!isShort ? '#a7f3d0' : '#fde68a'}`,
                                }}
                              >
                                {avail > 0 ? `${avail} pcs avail` : '0 pcs in stock'}
                                {isShort && (
                                  <span style={{ display: 'block', color: '#b45309', fontSize: '10px' }}>
                                    (Short: {qty - avail})
                                  </span>
                                )}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{listPrice.toFixed(2)} BDT</td>
                            <td style={{ textAlign: 'right', color: '#d97706' }}>
                              {(discBps / 100).toFixed(1)}%{' '}
                              <span className="muted" style={{ fontSize: '11px' }}>
                                (-{discAmt.toFixed(2)})
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{netUnit.toFixed(2)} BDT</td>
                            <td style={{ textAlign: 'right' }}>
                              <strong>{netAmt.toFixed(2)} BDT</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ marginTop: '10px', fontSize: '12px' }}>
                  Fulfilling the order directly issues stock and records an inventory issue transaction in the warehouse ledger.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {!creating &&
        detail &&
        canManage &&
        detail.status === 'draft' &&
        !detail.quotation_id &&
        detail.created_by === userId && (
          <SalesOrderEditForm
            key={`${detail.id}:${detail.version_no}`}
            order={detail}
            onSaved={() => {
              void load();
              void api<{ data: OrderDetail }>(`/sales/orders/${detail.id}`)
                .then(result => setDetail(result.data))
                .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not reload order'));
            }}
          />
        )}

      {!creating &&
        detail &&
        canManage &&
        ['draft', 'confirmed'].includes(detail.status) && (
          <section className="panel catalog-form" style={{ marginTop: '20px' }}>
            <h2 className="section-title">Cancel Sales Order</h2>
            <p className="muted">
              Cancelling releases any reserved warehouse inventory and stops the order. The cancellation reason is logged in the audit trail.
            </p>
            <label className="field">
              Cancellation reason
              <input
                className="input"
                placeholder="Enter reason for order cancellation (min 10 characters)..."
                value={cancelReason}
                onChange={event => setCancelReason(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy || cancelReason.trim().length < 10}
              onClick={() => void cancel()}
            >
              Cancel Order
            </button>
          </section>
        )}

      {!creating && detail && (
        <section className="panel catalog-form" style={{ marginTop: '20px' }}>
          <h2 className="section-title">Saved order versions</h2>
          <p className="muted">
            Manual draft edits recalculate Catalog list prices. Accepted-quotation order terms remain locked.
          </p>
          {revisions.length ? (
            revisions.map(revision => (
              <details key={revision.version} style={{ marginBottom: '8px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                  Version {revision.version} · {revision.snapshot.header.total_amount} BDT ·{' '}
                  {String(revision.changedAt).slice(0, 19).replace('T', ' ')}
                </summary>
                <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', marginTop: '6px' }}>
                  <p style={{ margin: '0 0 4px' }}>Order number: {revision.snapshot.header.order_number}</p>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {revision.snapshot.lines.map(line => (
                      <li key={line.edition_id}>
                        Edition {line.edition_id} · {line.quantity} × {line.unit_list_price} BDT · {line.net_amount} BDT
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))
          ) : (
            <p className="muted">No saved version snapshots are available for this order.</p>
          )}
        </section>
      )}
    </>
  );
}
