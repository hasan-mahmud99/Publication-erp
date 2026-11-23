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

export function ProductionPlanningBoardScreen({ screen }: { screen: Screen }) {
  const [board, setBoard] = useState<Row | null>(null);
  const [orders, setOrders] = useState<Row[]>([]);
  const [choices, setChoices] = useState<{ editions: Row[]; suppliers: Row[]; warehouses: Row[]; items: Row[] }>({
    editions: [],
    suppliers: [],
    warehouses: [],
    items: [],
  });
  const [specs, setSpecs] = useState<Row[]>([]);
  const [boms, setBoms] = useState<Row[]>([]);

  // View state
  const [activeTab, setActiveTab] = useState<'board' | 'capacity'>('board');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<OrderForm>(blankForm);

  // Capacity config
  const [capacityResource, setCapacityResource] = useState('internal');
  const [capacityLimit, setCapacityLimit] = useState(2);

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

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [boardRes, listRes, choicesRes, specsRes, bomsRes, meRes] = await Promise.all([
        api<{ data: Row }>('/production/board'),
        api<{ data: { data: Row[]; meta: { total: number } } }>('/production/print-orders?limit=100'),
        api<{ data: { editions: Row[]; suppliers: Row[]; warehouses: Row[]; items: Row[] } }>('/production/choices'),
        api<{ data: Row[] }>('/production/specifications'),
        api<{ data: Row[] }>('/production/boms'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);

      setBoard(boardRes.data);
      setOrders(listRes.data.data);
      setChoices(choicesRes.data);
      setSpecs(specsRes.data);
      setBoms(bomsRes.data);

      const isAllowed = (perm: string) =>
        meRes.data.role === 'Owner' || meRes.data.permissions.includes(perm);
      setCanManage(isAllowed('production.manage'));
      setCanApprove(isAllowed('production.approve'));
      setCanCost(isAllowed('production.cost'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load production board');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [screen.id]);

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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} order`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCapacity(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/production/capacity-rules/${capacityResource}`, {
        method: 'PUT',
        body: JSON.stringify({ maxParallelOrders: capacityLimit }),
      });
      setNotice('Production concurrent capacity rule updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save capacity rule');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/production/print-orders', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      setShowCreateModal(false);
      setCreateForm(blankForm());
      setNotice('New print order draft registered successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create print order');
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
      await loadData();
      setCreateForm(p => ({
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

  // Eligible specs and BOMs for create form
  const eligibleSpecs = useMemo(
    () => specs.filter(s => s.edition_id === createForm.editionId && s.status === 'approved'),
    [specs, createForm.editionId]
  );
  const eligibleBoms = useMemo(
    () => boms.filter(b => b.edition_id === createForm.editionId && b.status === 'approved'),
    [boms, createForm.editionId]
  );

  // Filtered orders for board
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch =
        !searchQuery.trim() ||
        o.print_order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.book_title && o.book_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.printer_name && o.printer_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        selectedStatusFilter === 'all' || o.status === selectedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, selectedStatusFilter]);

  // Aggregate Board Stats
  const totalOrders = board?.totals?.orders || orders.length;
  const plannedCopies = Number(board?.totals?.plannedCopies || 0);
  const delayedOrders = Number(board?.totals?.delayed || 0);
  const inProgressOrders = orders.filter(o => o.status === 'in_progress').length;

  // Pipeline Stage Groups
  const STAGES = [
    { key: 'planned', label: 'Draft & Planned', color: '#6366f1', bg: '#eef2ff' },
    { key: 'pending_approval', label: 'Pending Approval', color: '#f59e0b', bg: '#fffbeb' },
    { key: 'approved', label: 'Approved (Ready)', color: '#0ea5e9', bg: '#f0f9ff' },
    { key: 'scheduled', label: 'Scheduled', color: '#8b5cf6', bg: '#f5f3ff' },
    { key: 'in_progress', label: 'In Production (WIP)', color: '#10b981', bg: '#ecfdf5' },
    { key: 'complete', label: 'Completed', color: '#059669', bg: '#f0fdf4' },
    { key: 'on_hold', label: 'On Hold', color: '#dc2626', bg: '#fef2f2' },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">
            Executive master scheduling, press capacity tracking, and workflow pipeline for edition print orders.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCreateForm({
                  ...blankForm(),
                  printOrderNumber: `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
                });
                setShowCreateModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>➕</span>
              <span>New Print Order</span>
            </button>
          )}
          <button type="button" className="btn" onClick={() => void loadData()}>
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
          onClick={() => setSelectedStatusFilter('all')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: selectedStatusFilter === 'all' ? '4px solid #4f46e5' : '4px solid transparent',
            background: selectedStatusFilter === 'all' ? 'var(--panel-active-bg, #f5f3ff)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            📋 Total Active Orders
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {totalOrders}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Across all production stages
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase' }}>
            📚 Planned Print Volume
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0c4a6e', marginTop: '4px' }}>
            {plannedCopies.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 500 }}>copies</span>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Committed press demand
          </div>
        </div>

        <div
          className="panel"
          onClick={() => setSelectedStatusFilter('in_progress')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            borderLeft: selectedStatusFilter === 'in_progress' ? '4px solid #10b981' : '4px solid transparent',
            background: selectedStatusFilter === 'in_progress' ? 'var(--panel-active-bg, #ecfdf5)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
            ⏳ Active In-Production
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46', marginTop: '4px' }}>
            {inProgressOrders}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            Currently on press / binding
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderLeft: delayedOrders > 0 ? '4px solid #dc2626' : '4px solid #10b981',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: delayedOrders > 0 ? '#b91c1c' : '#059669',
              textTransform: 'uppercase',
            }}
          >
            {delayedOrders > 0 ? '⚠️ Schedule Delays' : '✅ On-Time Pace'}
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: delayedOrders > 0 ? '#991b1b' : '#065f46',
              marginTop: '4px',
            }}
          >
            {delayedOrders} {delayedOrders === 1 ? 'order' : 'orders'}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {delayedOrders > 0 ? 'Past planned due date' : 'Zero overdue milestones'}
          </div>
        </div>
      </div>

      {/* Main View Mode Selector & Search */}
      <div
        className="panel"
        style={{
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setActiveTab('board')}
            style={{
              background: activeTab === 'board' ? '#4f46e5' : undefined,
              color: activeTab === 'board' ? '#ffffff' : undefined,
              fontWeight: activeTab === 'board' ? 700 : 400,
            }}
          >
            📊 Pipeline Board View
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setActiveTab('capacity')}
            style={{
              background: activeTab === 'capacity' ? '#4f46e5' : undefined,
              color: activeTab === 'capacity' ? '#ffffff' : undefined,
              fontWeight: activeTab === 'capacity' ? 700 : 400,
            }}
          >
            ⚙️ Press Capacity Rules
          </button>
        </div>

        {activeTab === 'board' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              className="input"
              placeholder="🔍 Search order #, book, or printer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '280px', fontSize: '13px' }}
            />
            <select
              className="input"
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              style={{ fontSize: '13px', width: '160px' }}
            >
              <option value="all">All Stages</option>
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Pipeline Kanban Board */}
      {activeTab === 'board' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div className="panel empty" style={{ padding: '40px', textAlign: 'center' }}>
              Loading production pipeline…
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {STAGES.map(stage => {
                const stageOrders = filteredOrders.filter(o => o.status === stage.key);
                return (
                  <div
                    key={stage.key}
                    className="panel"
                    style={{
                      padding: '16px',
                      background: '#fcfcfd',
                      borderTop: `4px solid ${stage.color}`,
                      minHeight: '260px',
                    }}
                  >
                    {/* Stage Header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>
                        {stage.label}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: stage.bg,
                          color: stage.color,
                        }}
                      >
                        {stageOrders.length}
                      </span>
                    </div>

                    {/* Order Cards in Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {stageOrders.length === 0 ? (
                        <div
                          style={{
                            padding: '24px 12px',
                            textAlign: 'center',
                            color: '#9ca3af',
                            fontSize: '12px',
                            border: '1px dashed #e5e7eb',
                            borderRadius: '6px',
                          }}
                        >
                          No orders in {stage.label.toLowerCase()}
                        </div>
                      ) : (
                        stageOrders.map(order => {
                          const isDelayed =
                            order.due_date &&
                            new Date(order.due_date) < new Date() &&
                            order.status !== 'complete';
                          return (
                            <div
                              key={order.id}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '6px',
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    background: '#f1f5f9',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {order.print_order_number}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    textTransform: 'uppercase',
                                    background:
                                      order.priority === 'urgent'
                                        ? '#fef2f2'
                                        : order.priority === 'high'
                                        ? '#fffbeb'
                                        : '#f3f4f6',
                                    color:
                                      order.priority === 'urgent'
                                        ? '#dc2626'
                                        : order.priority === 'high'
                                        ? '#d97706'
                                        : '#4b5563',
                                  }}
                                >
                                  {order.priority}
                                </span>
                              </div>

                              <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}>
                                {order.book_title || 'Untitled Book'}{' '}
                                <span style={{ color: '#64748b', fontSize: '12px' }}>
                                  (Ed. {order.edition_number || '1'})
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  marginBottom: '8px',
                                }}
                              >
                                <span style={{ fontWeight: 600, color: '#0284c7' }}>
                                  📦 {Number(order.planned_qty).toLocaleString()} copies
                                </span>
                                <span>•</span>
                                <span>{human(order.run_type)}</span>
                              </div>

                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#475569',
                                  background: '#f8fafc',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  marginBottom: '8px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span>🏢 {order.printer_name || 'Internal Press'}</span>
                                <span style={{ color: isDelayed ? '#dc2626' : 'inherit', fontWeight: isDelayed ? 700 : 400 }}>
                                  Due: {order.due_date ? String(order.due_date).slice(0, 10) : '—'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => void openOrderDetail(order.id)}
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  Inspect Details 🔍
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Press & Printer Capacity Rules */}
      {activeTab === 'capacity' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
          <div className="panel" style={{ padding: '20px' }}>
            <h2 className="section-title" style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
              Configured Press Capacity Rules
            </h2>
            <p className="muted" style={{ margin: '0 0 16px 0', fontSize: '13px' }}>
              Scheduling algorithms assess maximum concurrent active orders to prevent press overload and delivery bottlenecks.
            </p>

            {board?.capacityRules?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Resource Key</th>
                      <th>Facility / Vendor Name</th>
                      <th>Max Concurrent Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.capacityRules.map((rule: Row) => (
                      <tr key={rule.resource_key}>
                        <td>
                          <code>{rule.resource_key}</code>
                        </td>
                        <td style={{ fontWeight: 600 }}>{rule.resource_name || 'Internal Press'}</td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: '#ecfdf5',
                              color: '#065f46',
                            }}
                          >
                            {rule.max_parallel_orders} parallel orders
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px' }}>
                No custom capacity rules configured yet. The system defaults to unassessed capacity.
              </div>
            )}
          </div>

          {canApprove && (
            <div className="panel" style={{ padding: '20px', borderTop: '4px solid #4f46e5' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>
                Set Capacity Threshold
              </h3>
              <form onSubmit={handleSaveCapacity}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Facility / Printer</span>
                    <select
                      className="input"
                      value={capacityResource}
                      onChange={e => setCapacityResource(e.target.value)}
                    >
                      <option value="internal">Internal Press</option>
                      {choices.suppliers.map((s: Row) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Max Concurrent Active Orders</span>
                    <input
                      type="number"
                      required
                      min="1"
                      max="1000"
                      className="input"
                      value={capacityLimit}
                      onChange={e => setCapacityLimit(Number(e.target.value))}
                    />
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      System checks this threshold before transitioning orders to scheduled.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy}
                    style={{ marginTop: '8px' }}
                  >
                    {busy ? 'Saving…' : 'Save Capacity Rule'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal / Workbench */}
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
                    Materials Requirement & Stock Availability
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

      {/* Create Print Order Modal */}
      {showCreateModal && (
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
            if (e.target === e.currentTarget) setShowCreateModal(false);
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
                ➕ Create New Print Order
              </h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowCreateModal(false)}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Order Number *</span>
                    <input
                      className="input"
                      required
                      value={createForm.printOrderNumber}
                      onChange={e => setCreateForm(p => ({ ...p, printOrderNumber: e.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Run Type</span>
                    <select
                      className="input"
                      value={createForm.runType}
                      onChange={e => setCreateForm(p => ({ ...p, runType: e.target.value as any }))}
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
                      value={createForm.editionId}
                      onChange={e =>
                        setCreateForm(p => ({
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
                        disabled={!createForm.editionId}
                        value={createForm.specVersionId}
                        onChange={e => setCreateForm(p => ({ ...p, specVersionId: e.target.value }))}
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
                        disabled={!createForm.editionId}
                        value={createForm.bomVersionId}
                        onChange={e => setCreateForm(p => ({ ...p, bomVersionId: e.target.value }))}
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

                {createForm.editionId && (!eligibleSpecs.length || !eligibleBoms.length) && (
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
                      A print order requires both an <strong>Approved Physical Specification</strong> (paper GSM, trim size, binding) and an <strong>Approved Bill of Materials</strong> (inventory paper & raw materials).
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
                        onClick={() => void handleQuickSetupSpecAndBom(createForm.editionId)}
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
                        value={createForm.printerId || ''}
                        onChange={e => setCreateForm(p => ({ ...p, printerId: e.target.value || null }))}
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
                        href="/procurement-suppliers/supplier-directory"
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
                      value={createForm.targetWarehouseId}
                      onChange={e => setCreateForm(p => ({ ...p, targetWarehouseId: e.target.value }))}
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
                      value={createForm.plannedQty}
                      onChange={e => setCreateForm(p => ({ ...p, plannedQty: Number(e.target.value) }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Priority</span>
                    <select
                      className="input"
                      value={createForm.priority}
                      onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value as any }))}
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
                      value={createForm.estimatedCost ?? ''}
                      onChange={e =>
                        setCreateForm(p => ({
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
                      value={createForm.orderDate}
                      onChange={e => setCreateForm(p => ({ ...p, orderDate: e.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Planned Start</span>
                    <input
                      type="date"
                      required
                      className="input"
                      value={createForm.plannedStart}
                      onChange={e => setCreateForm(p => ({ ...p, plannedStart: e.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Due Date</span>
                    <input
                      type="date"
                      required
                      className="input"
                      value={createForm.dueDate}
                      onChange={e => setCreateForm(p => ({ ...p, dueDate: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="button-row" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
                  disabled={busy || !eligibleSpecs.length || !eligibleBoms.length || !createForm.targetWarehouseId}
                >
                  {busy ? 'Saving…' : 'Create Print Order Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
