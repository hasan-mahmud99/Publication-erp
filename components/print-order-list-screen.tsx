"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

type OrderForm = {
  printOrderNumber: string;
  editionId: string;
  specVersionId: string;
  bomVersionId: string;
  printerId: string | null;
  targetWarehouseId: string;
  plannedQty: number;
  runType: 'first_print' | 'reprint' | 'revised_edition';
  printingMethod: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  orderDate: string;
  plannedStart: string;
  dueDate: string;
  estimatedCost: number | null;
  currencyCode: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (): OrderForm => ({
  printOrderNumber: '',
  editionId: '',
  specVersionId: '',
  bomVersionId: '',
  printerId: null,
  targetWarehouseId: '',
  plannedQty: 1000,
  runType: 'first_print',
  printingMethod: 'offset',
  priority: 'normal',
  orderDate: today(),
  plannedStart: today(),
  dueDate: today(),
  estimatedCost: null,
  currencyCode: 'BDT',
});

const human = (val: string) => (val || '').replaceAll('_', ' ');

export function PrintOrderListScreen({ screen }: { screen: Screen }) {
  const [orders, setOrders] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [runTypeFilter, setRunTypeFilter] = useState('');

  const [choices, setChoices] = useState<{ editions: Row[]; suppliers: Row[]; warehouses: Row[]; items: Row[] }>({
    editions: [],
    suppliers: [],
    warehouses: [],
    items: [],
  });
  const [specs, setSpecs] = useState<Row[]>([]);
  const [boms, setBoms] = useState<Row[]>([]);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null);
  const [editingOrder, setEditingOrder] = useState<Row | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState<OrderForm>(blankForm);

  // Workflow Action Note
  const [decisionNote, setDecisionNote] = useState('');

  // Permissions & State
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canCost, setCanCost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        limit: '25',
        offset: String(offset),
      });
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (runTypeFilter) params.set('runType', runTypeFilter);

      const [listRes, choicesRes, specsRes, bomsRes, meRes] = await Promise.all([
        api<{ data: { data: Row[]; meta: { total: number } } }>(`/production/print-orders?${params}`),
        api<{ data: { editions: Row[]; suppliers: Row[]; warehouses: Row[]; items: Row[] } }>('/production/choices'),
        api<{ data: Row[] }>('/production/specifications'),
        api<{ data: Row[] }>('/production/boms'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);

      setOrders(listRes.data.data);
      setTotal(listRes.data.meta.total);
      setChoices(choicesRes.data);
      setSpecs(specsRes.data);
      setBoms(bomsRes.data);

      const isAllowed = (perm: string) =>
        meRes.data.role === 'Owner' || meRes.data.permissions.includes(perm);
      setCanManage(isAllowed('production.manage'));
      setCanApprove(isAllowed('production.approve'));
      setCanCost(isAllowed('production.cost'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load print orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [offset, statusFilter, runTypeFilter, screen.id]);

  async function openOrderDetail(id: string) {
    setError('');
    try {
      const res = await api<{ data: Row }>(`/production/print-orders/${id}`);
      setSelectedOrder(res.data);
      setDecisionNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order details');
    }
  }

  function startCreate() {
    setEditingOrder(null);
    setForm({
      ...blankForm(),
      printOrderNumber: `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    });
    setError('');
    setShowFormModal(true);
  }

  function startEdit(row: Row) {
    setEditingOrder(row);
    setForm({
      printOrderNumber: row.print_order_number,
      editionId: row.edition_id,
      specVersionId: row.spec_version_id || '',
      bomVersionId: row.bom_version_id || '',
      printerId: row.printer_id || null,
      targetWarehouseId: row.target_warehouse_id || '',
      plannedQty: Number(row.planned_qty),
      runType: row.run_type,
      printingMethod: row.printing_method || 'offset',
      priority: row.priority || 'normal',
      orderDate: row.order_date ? String(row.order_date).slice(0, 10) : today(),
      plannedStart: row.planned_start ? String(row.planned_start).slice(0, 10) : today(),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : today(),
      estimatedCost: row.estimated_cost == null ? null : Number(row.estimated_cost),
      currencyCode: row.currency_code || 'BDT',
    });
    setError('');
    setShowFormModal(true);
  }

  async function handleSaveOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (editingOrder) {
        await api(`/production/print-orders/${editingOrder.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...form, revisionNo: editingOrder.revision_no }),
        });
        setNotice(`Order ${form.printOrderNumber} updated successfully.`);
      } else {
        await api('/production/print-orders', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setNotice(`Print order ${form.printOrderNumber} registered successfully.`);
      }

      setShowFormModal(false);
      setEditingOrder(null);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save print order');
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickSetupSpecAndBom(editionId: string) {
    if (!editionId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const rawItem = choices.items?.[0];
      const warehouse = choices.warehouses?.[0];

      let specVersionId = eligibleSpecs[0]?.version_id;
      if (!specVersionId) {
        const specRef = `SPEC-${String(Date.now()).slice(-6)}`;
        const specRes = await api<{ data: Row }>('/production/specifications', {
          method: 'POST',
          body: JSON.stringify({
            specRef,
            editionId,
            printingMethod: 'offset',
            interiorPages: 192,
            trimWidthMm: 140,
            trimHeightMm: 215,
            interiorPaperGsm: 80,
            interiorColors: 1,
            coverPaperGsm: 300,
            coverColors: 4,
            bindingType: 'perfect',
            finishing: 'Matte Lamination + Spot UV',
            notes: 'Standard trade paperback specification',
          }),
        });
        const specData = specRes.data;
        await api(`/production/specifications/${specData.id}/versions/${specData.currentVersion.id}/submit`, {
          method: 'POST',
        });
        const appRes = await api<{ data: Row }>(
          `/production/specifications/${specData.id}/versions/${specData.currentVersion.id}/approve`,
          {
            method: 'POST',
            body: JSON.stringify({ note: 'Physical specification verified and approved for press run.' }),
          }
        );
        specVersionId = appRes.data.currentVersion.id;
      }

      let bomVersionId = eligibleBoms[0]?.version_id;
      if (!bomVersionId && rawItem && warehouse) {
        const bomRef = `BOM-${String(Date.now()).slice(-6)}`;
        const bomRes = await api<{ data: Row }>('/production/boms', {
          method: 'POST',
          body: JSON.stringify({
            bomRef,
            editionId,
            notes: 'Standard trade paper BOM',
            lines: [
              {
                itemId: rawItem.id,
                warehouseId: warehouse.id,
                quantityPerCopy: 0.04,
                wastagePercent: 3,
                notes: 'Interior text paper stock',
              },
            ],
          }),
        });
        const bomData = bomRes.data;
        await api(`/production/boms/${bomData.id}/versions/${bomData.currentVersion.id}/submit`, {
          method: 'POST',
        });
        const appBomRes = await api<{ data: Row }>(
          `/production/boms/${bomData.id}/versions/${bomData.currentVersion.id}/approve`,
          {
            method: 'POST',
            body: JSON.stringify({ note: 'Bill of materials verified against warehouse stock.' }),
          }
        );
        bomVersionId = appBomRes.data.currentVersion.id;
      }

      setNotice('Standard physical specification and BOM created & approved!');
      await loadOrders();
      setForm(p => ({
        ...p,
        specVersionId: specVersionId || p.specVersionId,
        bomVersionId: bomVersionId || p.bomVersionId,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick setup failed');
    } finally {
      setBusy(false);
    }
  }

  async function executeOrderAction(action: string) {
    if (!selectedOrder) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const needsNote = ['approve', 'return', 'hold', 'cancel'].includes(action);
      const res = await api<{ data: Row }>(`/production/print-orders/${selectedOrder.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(needsNote ? { note: decisionNote.trim() } : {}),
      });
      setSelectedOrder(res.data);
      setDecisionNote('');
      setNotice(`Order ${selectedOrder.print_order_number} ${human(action)} transition completed.`);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} order`);
    } finally {
      setBusy(false);
    }
  }

  // Eligible specs and BOMs for active form
  const eligibleSpecs = useMemo(
    () => specs.filter(s => s.edition_id === form.editionId && s.status === 'approved'),
    [specs, form.editionId]
  );
  const eligibleBoms = useMemo(
    () => boms.filter(b => b.edition_id === form.editionId && b.status === 'approved'),
    [boms, form.editionId]
  );

  // Overall counts for KPI calculation
  const totalCount = total;
  const pendingCount = orders.filter(o => o.status === 'pending_approval').length;
  const inProgressCount = orders.filter(o => ['scheduled', 'in_progress'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'complete').length;

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Directory and lifecycle management of print runs, vendor press assignments, and delivery schedules.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startCreate}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>➕</span>
              <span>New Print Order</span>
            </button>
          )}
          <button type="button" className="btn" onClick={() => void loadOrders()}>
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

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div
          className="panel"
          onClick={() => {
            setStatusFilter('');
            setOffset(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: statusFilter === '' ? '4px solid #4f46e5' : '4px solid transparent',
            background: statusFilter === '' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            📦 Total Print Orders
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Click to view all records
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setStatusFilter('pending_approval');
            setOffset(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: statusFilter === 'pending_approval' ? '4px solid #f59e0b' : '4px solid transparent',
            background: statusFilter === 'pending_approval' ? 'var(--panel-active-bg, #fffbeb)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            ⏳ Pending Approval
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Awaiting editorial/production sign-off
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setStatusFilter('scheduled');
            setOffset(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: statusFilter === 'scheduled' ? '4px solid #0ea5e9' : '4px solid transparent',
            background: statusFilter === 'scheduled' ? 'var(--panel-active-bg, #f0f9ff)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
            🚀 Scheduled &amp; Running
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>
            {inProgressCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            On active press schedule
          </div>
        </div>

        <div
          className="panel"
          onClick={() => {
            setStatusFilter('complete');
            setOffset(0);
          }}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: statusFilter === 'complete' ? '4px solid #10b981' : '4px solid transparent',
            background: statusFilter === 'complete' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            ✅ Completed Orders
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {completedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Finished goods received
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel" style={{ padding: '20px' }}>
        {/* Search and Filters Toolbar */}
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
                placeholder="🔍 Search order #, book, or printer..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setOffset(0);
                    void loadOrders();
                  }
                }}
                style={{ fontSize: '13px' }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setOffset(0);
                  void loadOrders();
                }}
              >
                Search
              </button>
            </div>

            <select
              className="input"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              style={{ fontSize: '13px', width: '160px' }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="input"
              value={runTypeFilter}
              onChange={e => {
                setRunTypeFilter(e.target.value);
                setOffset(0);
              }}
              style={{ fontSize: '13px', width: '150px' }}
            >
              <option value="">All Run Types</option>
              <option value="first_print">First Print</option>
              <option value="reprint">Reprint</option>
              <option value="revised_edition">Revised Edition</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {orders.length} of {total} orders
            </span>
            <Link
              href="/printing-production/production-planning-board"
              className="btn btn-sm"
              style={{ fontSize: '12px', textDecoration: 'none' }}
            >
              📊 Planning Board
            </Link>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
            Loading print orders…
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>Order Number</th>
                  <th>Book Title &amp; Edition</th>
                  <th style={{ width: '110px' }}>Run Type</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Planned Qty</th>
                  <th>Printer / Facility</th>
                  <th style={{ width: '105px' }}>Start Date</th>
                  <th style={{ width: '105px' }}>Due Date</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th style={{ width: '85px' }}>Priority</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length ? (
                  orders.map(row => {
                    const isOverdue =
                      row.due_date &&
                      new Date(row.due_date) < new Date() &&
                      row.status !== 'complete';

                    return (
                      <tr key={row.id}>
                        <td>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {row.print_order_number}
                          </code>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {row.book_title || 'Untitled Book'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Edition {row.edition_number || '1'}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {human(row.run_type)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                          {Number(row.planned_qty).toLocaleString()}
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          {row.printer_name || <span className="muted">Internal Press</span>}
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>
                          {row.planned_start ? String(row.planned_start).slice(0, 10) : '—'}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ color: isOverdue ? '#dc2626' : '#64748b', fontWeight: isOverdue ? 700 : 400 }}>
                            {row.due_date ? String(row.due_date).slice(0, 10) : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              background:
                                row.status === 'complete'
                                  ? '#ecfdf5'
                                  : row.status === 'in_progress' || row.status === 'scheduled'
                                  ? '#eff6ff'
                                  : row.status === 'pending_approval'
                                  ? '#fffbeb'
                                  : row.status === 'on_hold' || row.status === 'cancelled'
                                  ? '#fef2f2'
                                  : '#f3f4f6',
                              color:
                                row.status === 'complete'
                                  ? '#065f46'
                                  : row.status === 'in_progress' || row.status === 'scheduled'
                                  ? '#1e40af'
                                  : row.status === 'pending_approval'
                                  ? '#92400e'
                                  : row.status === 'on_hold' || row.status === 'cancelled'
                                  ? '#991b1b'
                                  : '#4b5563',
                            }}
                          >
                            {human(row.status)}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              background:
                                row.priority === 'urgent'
                                  ? '#fef2f2'
                                  : row.priority === 'high'
                                  ? '#fffbeb'
                                  : '#f3f4f6',
                              color:
                                row.priority === 'urgent'
                                  ? '#dc2626'
                                  : row.priority === 'high'
                                  ? '#d97706'
                                  : '#4b5563',
                            }}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => void openOrderDetail(row.id)}
                              style={{ padding: '3px 8px', fontSize: '12px' }}
                            >
                              Details
                            </button>
                            {canManage && row.status === 'draft' && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => startEdit(row)}
                                style={{ padding: '3px 8px', fontSize: '12px' }}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="empty" style={{ padding: '30px', textAlign: 'center' }}>
                      No print orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="catalog-pagination" style={{ marginTop: '16px' }}>
          <span>
            {total} total orders · Page {Math.floor(offset / 25) + 1} of {Math.max(1, Math.ceil(total / 25))}
          </span>
          <div className="button-row">
            <button
              type="button"
              className="btn"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn"
              disabled={offset + 25 >= total}
              onClick={() => setOffset(offset + 25)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Order Modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                paddingBottom: '14px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    Print Order: {selectedOrder.print_order_number}
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                      background: '#e0e7ff',
                      color: '#3730a3',
                    }}
                  >
                    {human(selectedOrder.status)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px' }}>
                  <strong>{selectedOrder.book_title}</strong> (Edition {selectedOrder.edition_number}) •{' '}
                  <span style={{ fontWeight: 600 }}>{Number(selectedOrder.planned_qty).toLocaleString()} copies</span> •{' '}
                  {human(selectedOrder.run_type)}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedOrder(null)}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Context Summary Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '18px',
              }}
            >
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Print Facility
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {selectedOrder.printer_name || 'Internal Press'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Specification Sheet
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {selectedOrder.spec?.version_no ? `Version ${selectedOrder.spec.version_no}` : 'Custom / None'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Bill of Materials (BOM)
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {selectedOrder.bom?.version_no ? `BOM v${selectedOrder.bom.version_no}` : 'Standard'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Schedule Due Date
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {selectedOrder.due_date ? String(selectedOrder.due_date).slice(0, 10) : '—'}
                </div>
              </div>
            </div>

            {/* Material Readiness */}
            {selectedOrder.requirements && selectedOrder.requirements.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                    Materials Requirement &amp; Stock Availability
                  </h4>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: selectedOrder.materialReady ? '#ecfdf5' : '#fef2f2',
                      color: selectedOrder.materialReady ? '#065f46' : '#991b1b',
                    }}
                  >
                    {selectedOrder.materialReady ? '✓ Material Available' : '⚠️ Shortage Flagged'}
                  </span>
                </div>

                <div className="table-wrap">
                  <table className="data-table" style={{ margin: 0, fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Material Item</th>
                        <th>Required Qty</th>
                        <th>Issued Qty</th>
                        <th>Remaining</th>
                        <th>Available in Stock</th>
                        <th>Shortage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.requirements.map((req: Row, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{req.itemCode} - {req.itemName}</td>
                          <td>{req.requiredQty} {req.uom}</td>
                          <td>{req.issuedQty}</td>
                          <td>{req.remainingQty}</td>
                          <td>{req.availableQty}</td>
                          <td style={{ color: Number(req.shortageQty) > 0 ? '#dc2626' : 'inherit', fontWeight: Number(req.shortageQty) > 0 ? 700 : 400 }}>
                            {req.shortageQty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Workflow Action Buttons */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '8px' }}>
                Workflow Lifecycle Actions
              </div>

              {canManage && selectedOrder.status === 'draft' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void executeOrderAction('submit')}
                  >
                    📤 Submit for Approval
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSelectedOrder(null);
                      startEdit(selectedOrder);
                    }}
                  >
                    ✏️ Edit Draft
                  </button>
                </div>
              )}

              {canApprove && selectedOrder.status === 'pending_approval' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      Approval / Return Note (Minimum 10 characters)
                    </span>
                    <input
                      className="input"
                      placeholder="e.g. Approved for printing per budget allocation"
                      value={decisionNote}
                      onChange={e => setDecisionNote(e.target.value)}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || decisionNote.trim().length < 10}
                      onClick={() => void executeOrderAction('approve')}
                    >
                      ✅ Approve Print Order
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || decisionNote.trim().length < 10}
                      onClick={() => void executeOrderAction('return')}
                    >
                      ↩️ Return to Draft
                    </button>
                  </div>
                </div>
              )}

              {canManage && selectedOrder.status === 'approved' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void executeOrderAction('schedule')}
                  >
                    📅 Schedule Order on Press
                  </button>
                </div>
              )}

              {canManage && selectedOrder.status === 'scheduled' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    className="input"
                    placeholder="Reason for placing on hold (minimum 10 chars)..."
                    value={decisionNote}
                    onChange={e => setDecisionNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || decisionNote.trim().length < 10}
                    onClick={() => void executeOrderAction('hold')}
                  >
                    ⏸️ Place on Hold
                  </button>
                </div>
              )}

              {canManage && selectedOrder.status === 'on_hold' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void executeOrderAction('resume')}
                >
                  ▶️ Resume Schedule
                </button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Print Order Modal */}
      {showFormModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setShowFormModal(false);
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingOrder ? `✏️ Edit Print Order: ${form.printOrderNumber}` : '➕ Create New Print Order'}
              </h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowFormModal(false)}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOrder}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Order Number *</span>
                    <input
                      className="input"
                      required
                      disabled={Boolean(editingOrder)}
                      value={form.printOrderNumber}
                      onChange={e => setForm(p => ({ ...p, printOrderNumber: e.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Run Type</span>
                    <select
                      className="input"
                      value={form.runType}
                      onChange={e => setForm(p => ({ ...p, runType: e.target.value as any }))}
                    >
                      <option value="first_print">First Print</option>
                      <option value="reprint">Reprint</option>
                      <option value="revised_edition">Revised Edition</option>
                    </select>
                  </label>
                </div>

                {/* Edition with plus button */}
                <label className="field">
                  <span style={{ fontWeight: 600 }}>Book Edition *</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      className="input"
                      required
                      value={form.editionId}
                      onChange={e =>
                        setForm(p => ({
                          ...p,
                          editionId: e.target.value,
                          specVersionId: '',
                          bomVersionId: '',
                        }))
                      }
                      style={{ flex: 1 }}
                    >
                      <option value="">Select Book Edition</option>
                      {choices.editions.map((ed: Row) => (
                        <option key={ed.id} value={ed.id}>
                          {ed.book_title} (Edition {ed.edition_number})
                        </option>
                      ))}
                    </select>
                    <Link
                      href="/publishing-catalog/create-edit-edition"
                      className="btn btn-sm btn-primary"
                      title="Register New Edition"
                      style={{ padding: '6px 10px', textDecoration: 'none' }}
                      target="_blank"
                    >
                      ➕
                    </Link>
                  </div>
                </label>

                {/* Specification & BOM with plus buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Approved Specification *</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        className="input"
                        required
                        disabled={!form.editionId}
                        value={form.specVersionId}
                        onChange={e => setForm(p => ({ ...p, specVersionId: e.target.value }))}
                        style={{ flex: 1 }}
                      >
                        <option value="">Choose Specification</option>
                        {eligibleSpecs.map(s => (
                          <option key={s.version_id} value={s.version_id}>
                            {s.reference} (v{s.version_no})
                          </option>
                        ))}
                      </select>
                      <Link
                        href="/printing-production/print-specification-sheet"
                        className="btn btn-sm"
                        title="Open Specifications"
                        style={{ padding: '6px 10px', textDecoration: 'none' }}
                        target="_blank"
                      >
                        ➕
                      </Link>
                    </div>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Approved BOM *</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        className="input"
                        required
                        disabled={!form.editionId}
                        value={form.bomVersionId}
                        onChange={e => setForm(p => ({ ...p, bomVersionId: e.target.value }))}
                        style={{ flex: 1 }}
                      >
                        <option value="">Choose BOM</option>
                        {eligibleBoms.map(b => (
                          <option key={b.version_id} value={b.version_id}>
                            {b.reference} (v{b.version_no})
                          </option>
                        ))}
                      </select>
                      <Link
                        href="/printing-production/bom-and-material-requirement"
                        className="btn btn-sm"
                        title="Open Bill of Materials"
                        style={{ padding: '6px 10px', textDecoration: 'none' }}
                        target="_blank"
                      >
                        ➕
                      </Link>
                    </div>
                  </label>
                </div>

                {form.editionId && (!eligibleSpecs.length || !eligibleBoms.length) && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: '#92400e',
                    }}
                  >
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span>⚠️</span>
                      <span>Missing Pre-requisites for this Edition</span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', lineHeight: 1.4, color: '#78350f' }}>
                      A print order requires both an <strong>Approved Physical Specification</strong> (paper GSM, trim size, binding) and an <strong>Approved Bill of Materials</strong> (inventory paper &amp; raw materials).
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {!eligibleSpecs.length && (
                        <Link
                          href="/printing-production/print-specification-sheet"
                          target="_blank"
                          className="btn btn-sm"
                          style={{ fontSize: '11px', textDecoration: 'none', background: '#ffffff' }}
                        >
                          📄 Open Specification Sheet
                        </Link>
                      )}
                      {!eligibleBoms.length && (
                        <Link
                          href="/printing-production/bom-and-material-requirement"
                          target="_blank"
                          className="btn btn-sm"
                          style={{ fontSize: '11px', textDecoration: 'none', background: '#ffffff' }}
                        >
                          📦 Open BOM &amp; Materials
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={busy}
                        onClick={() => void handleQuickSetupSpecAndBom(form.editionId)}
                        style={{ fontSize: '11px' }}
                      >
                        ⚡ Auto-Setup Standard Spec &amp; BOM
                      </button>
                    </div>
                  </div>
                )}

                {/* Printer & Warehouse with plus buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Printer / Press Supplier</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        className="input"
                        value={form.printerId || ''}
                        onChange={e => setForm(p => ({ ...p, printerId: e.target.value || null }))}
                        style={{ flex: 1 }}
                      >
                        <option value="">Internal Press / Unassigned</option>
                        {choices.suppliers.map((s: Row) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <Link
                        href="/suppliers/supplier-directory"
                        className="btn btn-sm"
                        title="Manage Suppliers"
                        style={{ padding: '6px 10px', textDecoration: 'none' }}
                        target="_blank"
                      >
                        ➕
                      </Link>
                    </div>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Destination Warehouse *</span>
                    <select
                      className="input"
                      required
                      value={form.targetWarehouseId}
                      onChange={e => setForm(p => ({ ...p, targetWarehouseId: e.target.value }))}
                    >
                      <option value="">Select Warehouse</option>
                      {choices.warehouses.map((w: Row) => (
                        <option key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Planned Copies *</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      className="input"
                      value={form.plannedQty}
                      onChange={e => setForm(p => ({ ...p, plannedQty: Number(e.target.value) }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Priority</span>
                    <select
                      className="input"
                      value={form.priority}
                      onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Est. Cost (BDT)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="Optional"
                      value={form.estimatedCost ?? ''}
                      onChange={e =>
                        setForm(p => ({
                          ...p,
                          estimatedCost: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Order Date</span>
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.orderDate}
                      onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Planned Start</span>
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.plannedStart}
                      onChange={e => setForm(p => ({ ...p, plannedStart: e.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Due Date</span>
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.dueDate}
                      onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="button-row" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowFormModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !eligibleSpecs.length || !eligibleBoms.length || !form.targetWarehouseId}
                >
                  {busy ? 'Saving…' : editingOrder ? 'Save Changes' : 'Create Print Order Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
