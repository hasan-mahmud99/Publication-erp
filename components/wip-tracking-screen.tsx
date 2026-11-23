'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const todayDate = () => new Date().toISOString().slice(0, 10);
const futureDate = (days = 14) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const STAGES = [
  { id: 'prepress', label: '1. Pre-Press (Plates & CTP)', short: 'Pre-Press', icon: '🖨️', color: '#6366f1', bg: '#e0e7ff', desc: 'Digital plate imaging, imposition proofing & CTP' },
  { id: 'printing', label: '2. Printing (Offset Runs)', short: 'Printing', icon: '⚙️', color: '#2563eb', bg: '#dbeafe', desc: 'Sheetfed offset press running inner signatures & covers' },
  { id: 'binding', label: '3. Binding & Assembly', short: 'Binding', icon: '📖', color: '#d97706', bg: '#fef3c7', desc: 'Folding, gathering, section sewing & perfect binding' },
  { id: 'finishing', label: '4. Finishing & Trimming', short: 'Finishing', icon: '✂️', color: '#16a34a', bg: '#dcfce7', desc: 'Lamination, foil stamping & 3-knife final trimming' },
] as const;

type StageType = typeof STAGES[number]['id'];

const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function WipTrackingScreen({ screen }: { screen?: Screen }) {
  // Master records
  const [orders, setOrders] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [issues, setIssues] = useState<Row[]>([]);

  // Selected Order context
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderDetail, setOrderDetail] = useState<Row | null>(null);
  const [batches, setBatches] = useState<Row[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // UI States
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filtering & Tabs
  const [activeTab, setActiveTab] = useState<'log' | 'pipeline' | 'batches'>('log');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [activeOperationDetail, setActiveOperationDetail] = useState<Row | null>(null);

  // Form states for Recording an Operation
  const [formOrderId, setFormOrderId] = useState('');
  const [formBatchId, setFormBatchId] = useState('');
  const [formStage, setFormStage] = useState<StageType>('prepress');
  const [formDate, setFormDate] = useState(todayDate());
  const [formInputQty, setFormInputQty] = useState<number>(500);
  const [formOutputQty, setFormOutputQty] = useState<number>(490);
  const [formRejectedQty, setFormRejectedQty] = useState<number>(10);
  const [formNote, setFormNote] = useState('');

  // Form states for Quick Batch
  const [batchRef, setBatchRef] = useState('');
  const [batchPlannedQty, setBatchPlannedQty] = useState(1000);
  const [batchPlannedStart, setBatchPlannedStart] = useState(todayDate());
  const [batchPlannedEnd, setBatchPlannedEnd] = useState(futureDate(14));

  // Permissions
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);

  const isCompletedInInventory = (o: Row | null | undefined) => {
    if (!o) return false;
    return o.status === 'complete' || (Number(o.received_qty || 0) >= Number(o.planned_qty || 0) && Number(o.planned_qty || 0) > 0);
  };

  const activeOrders = orders.filter(o => !isCompletedInInventory(o));
  const completedOrders = orders.filter(o => isCompletedInInventory(o));

  // Load initial data
  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [orderRes, opRes, issueRes, meRes] = await Promise.all([
        api<{ data: { data: Row[] } }>('/production/print-orders?limit=100&offset=0'),
        api<{ data: Row[] }>('/production/operations'),
        api<{ data: Row[] }>('/production/material-issues'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);

      const ordList = orderRes.data.data || [];
      setOrders(ordList);
      setOperations(opRes.data || []);
      setIssues(issueRes.data || []);

      const isAllowed = (p: string) => meRes.data.role === 'Owner' || (meRes.data.permissions || []).includes(p);
      setCanManage(isAllowed('production.manage'));
      setCanApprove(isAllowed('production.approve'));

      const activeList = ordList.filter(o => !isCompletedInInventory(o));
      const targetId = selectedOrderId || (activeList.length > 0 ? activeList[0].id : (ordList.length > 0 ? ordList[0].id : ''));
      if (targetId) {
        await selectOrder(targetId);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load WIP tracking data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  // Select an order and fetch live details & batches
  async function selectOrder(id: string) {
    setSelectedOrderId(id);
    setOrderDetail(null);
    setBatches([]);
    setSelectedBatchId('');
    setError('');

    if (!id) return;

    try {
      const [orderRes, batchRes] = await Promise.all([
        api<{ data: Row }>(`/production/print-orders/${id}`),
        api<{ data: Row[] }>(`/production/batches?orderId=${encodeURIComponent(id)}`),
      ]);

      setOrderDetail(orderRes.data);
      const bList = batchRes.data || [];
      setBatches(bList);

      const openBatch = bList.find((b: Row) => b.status === 'open') || bList[0];
      if (openBatch) {
        setSelectedBatchId(openBatch.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load print order details.');
    }
  }

  // Calculate stage summary for the selected order / batch
  const stageStats = useMemo(() => {
    const relevantOps = operations.filter(op => !selectedOrderId || op.print_order_id === selectedOrderId);
    const result: Record<StageType, { input: number; output: number; rejected: number; yieldRate: number }> = {
      prepress: { input: 0, output: 0, rejected: 0, yieldRate: 100 },
      printing: { input: 0, output: 0, rejected: 0, yieldRate: 100 },
      binding: { input: 0, output: 0, rejected: 0, yieldRate: 100 },
      finishing: { input: 0, output: 0, rejected: 0, yieldRate: 100 },
    };

    for (const s of STAGES) {
      const ops = relevantOps.filter(o => o.stage === s.id);
      const input = ops.reduce((sum, o) => sum + Number(o.input_qty || 0), 0);
      const output = ops.reduce((sum, o) => sum + Number(o.output_qty || 0), 0);
      const rejected = ops.reduce((sum, o) => sum + Number(o.rejected_qty || 0), 0);
      const yieldRate = input > 0 ? Math.round((output / input) * 100) : 100;
      result[s.id] = { input, output, rejected, yieldRate };
    }

    return result;
  }, [operations, selectedOrderId]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    const relevantOps = operations.filter(op => !selectedOrderId || op.print_order_id === selectedOrderId);
    const totalOps = relevantOps.length;
    const prepressOutput = stageStats.prepress.output;
    const printingOutput = stageStats.printing.output;
    const bindingOutput = stageStats.binding.output;
    const finishingOutput = stageStats.finishing.output;
    const totalRejected = stageStats.prepress.rejected + stageStats.printing.rejected + stageStats.binding.rejected + stageStats.finishing.rejected;
    const plannedQty = orderDetail?.planned_qty || 0;
    const overallProgress = plannedQty > 0 ? Math.min(100, Math.round((finishingOutput / plannedQty) * 100)) : 0;

    return { totalOps, prepressOutput, printingOutput, bindingOutput, finishingOutput, totalRejected, plannedQty, overallProgress };
  }, [operations, selectedOrderId, stageStats, orderDetail]);

  // Helper to open the Record Operation modal
  async function handleOpenRecordModal(targetStage?: StageType) {
    setError('');
    setNotice('');

    const currentOrder = orders.find(o => o.id === selectedOrderId);
    if (currentOrder && isCompletedInInventory(currentOrder)) {
      setError('This print order is 100% completed and stored in warehouse inventory. No further floor operations can be logged.');
      return;
    }

    const activeOrds = orders.filter(o => !isCompletedInInventory(o));
    const ordId = selectedOrderId || (activeOrds.length > 0 ? activeOrds[0].id : (orders.length > 0 ? orders[0].id : ''));
    setFormOrderId(ordId);

    const stageToSet = targetStage || 'prepress';
    setFormStage(stageToSet);
    setFormDate(todayDate());

    setShowOperationModal(true);

    if (ordId) {
      await handleModalOrderChange(ordId, stageToSet);
    }
  }

  // Handle changing order inside the operation modal
  async function handleModalOrderChange(newOrderId: string, currentStage?: StageType) {
    setFormOrderId(newOrderId);
    if (!newOrderId) return;

    try {
      const [orderRes, batchRes] = await Promise.all([
        api<{ data: Row }>(`/production/print-orders/${newOrderId}`),
        api<{ data: Row[] }>(`/production/batches?orderId=${encodeURIComponent(newOrderId)}`),
      ]);

      setOrderDetail(orderRes.data);
      const bList = batchRes.data || [];
      setBatches(bList);

      const openBatch = bList.find((b: Row) => b.status === 'open') || bList[0];
      if (openBatch) {
        setFormBatchId(openBatch.id);
        computeStageAvailable(currentStage || formStage, openBatch, newOrderId);
      } else {
        setFormBatchId('');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load order details.');
    }
  }

  // Compute available input limits based on preceding stage output
  function computeStageAvailable(stage: StageType, batchObj?: Row, ordId?: string) {
    const oId = ordId || formOrderId;
    const bId = batchObj?.id || formBatchId;
    const bObj = batchObj || batches.find(b => b.id === bId);
    const planned = bObj?.planned_qty || 500;

    const relevantOps = operations.filter(o => o.print_order_id === oId && (!bId || o.batch_id === bId));

    if (stage === 'prepress') {
      const priorPrepress = relevantOps.filter(o => o.stage === 'prepress').reduce((s, o) => s + Number(o.input_qty || 0), 0);
      const available = Math.max(0, planned - priorPrepress);
      setFormInputQty(available > 0 ? available : planned);
      setFormOutputQty(available > 0 ? available : planned);
      setFormRejectedQty(0);
    } else {
      const stageOrder: StageType[] = ['prepress', 'printing', 'binding', 'finishing'];
      const priorStageIndex = stageOrder.indexOf(stage) - 1;
      const priorStage = stageOrder[priorStageIndex];

      const priorOutput = relevantOps.filter(o => o.stage === priorStage).reduce((s, o) => s + Number(o.output_qty || 0), 0);
      const currentInput = relevantOps.filter(o => o.stage === stage).reduce((s, o) => s + Number(o.input_qty || 0), 0);
      const available = Math.max(0, priorOutput - currentInput);

      const defaultInput = available > 0 ? available : Math.min(100, planned);
      setFormInputQty(defaultInput);
      setFormOutputQty(defaultInput);
      setFormRejectedQty(0);
    }
  }

  // When stage changes in form
  function handleFormStageChange(stage: StageType) {
    setFormStage(stage);
    computeStageAvailable(stage);
  }

  // Handle Submit Operation
  async function submitOperation(e: React.FormEvent) {
    e.preventDefault();
    if (!formOrderId || !formBatchId) {
      setError('Please select an order and an open production batch.');
      return;
    }

    if (formOutputQty + formRejectedQty > formInputQty) {
      setError('Output quantity + Rejected quantity cannot exceed Input quantity.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/production/operations', {
        method: 'POST',
        body: JSON.stringify({
          orderId: formOrderId,
          batchId: formBatchId,
          stage: formStage,
          operationDate: formDate,
          inputQty: Number(formInputQty),
          outputQty: Number(formOutputQty),
          rejectedQty: Number(formRejectedQty),
          note: formNote || undefined,
        }),
      });

      setNotice(`Recorded ${human(formStage)} run: ${formOutputQty} good units output (${formRejectedQty} rejected).`);
      setShowOperationModal(false);
      setFormNote('');
      await loadInitial();
      if (selectedOrderId) await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to record operation.');
    } finally {
      setBusy(false);
    }
  }

  // Schedule Print Order Shortcut
  async function handleScheduleOrder() {
    if (!selectedOrderId) return;
    setBusy(true);
    setError('');
    try {
      await api(`/production/print-orders/${selectedOrderId}/fast-schedule`, {
        method: 'POST',
        body: '{}',
      });
      setNotice('Print order scheduled for production.');
      await selectOrder(selectedOrderId);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule print order.');
    } finally {
      setBusy(false);
    }
  }

  // Open Quick Batch Modal
  function handleOpenCreateBatch() {
    const orderObj = orders.find(o => o.id === selectedOrderId);
    const ordNum = orderObj?.print_order_number || 'PO';
    setBatchRef(`BATCH-${ordNum}-${String(batches.length + 1).padStart(2, '0')}`);
    setBatchPlannedQty(orderObj?.planned_qty || 1000);
    setBatchPlannedStart(orderObj?.planned_start ? String(orderObj.planned_start).slice(0, 10) : todayDate());
    setBatchPlannedEnd(orderObj?.due_date ? String(orderObj.due_date).slice(0, 10) : futureDate(14));
    setShowBatchModal(true);
  }

  // Submit Quick Batch Creation
  async function submitCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId) {
      setError('Select a print order first.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await api<{ data: Row }>('/production/batches', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrderId,
          batchRef,
          plannedQty: Number(batchPlannedQty),
          plannedStart: batchPlannedStart,
          plannedEnd: batchPlannedEnd,
        }),
      });

      setNotice(`Production batch "${batchRef}" opened successfully.`);
      setShowBatchModal(false);
      await selectOrder(selectedOrderId);
      if (res.data?.id) {
        setSelectedBatchId(res.data.id);
        setFormBatchId(res.data.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create production batch.');
    } finally {
      setBusy(false);
    }
  }

  // Filtered Operations log
  const filteredOperations = useMemo(() => {
    return operations.filter(row => {
      if (selectedOrderId && row.print_order_id !== selectedOrderId) return false;
      if (stageFilter !== 'all' && row.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = String(row.print_order_number || '').toLowerCase().includes(q);
        const matchesNote = String(row.note || '').toLowerCase().includes(q);
        const matchesStage = String(row.stage || '').toLowerCase().includes(q);
        return matchesRef || matchesNote || matchesStage;
      }
      return true;
    });
  }, [operations, selectedOrderId, stageFilter, searchQuery]);

  const activeOrderObj = orders.find(o => o.id === selectedOrderId);
  const openBatches = batches.filter(b => b.status === 'open');

  return (
    <div style={{ padding: '0 0 3rem 0' }}>
      {/* Header */}
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
              Work-in-Progress (WIP) & Press Tracking
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
              Shop Floor Execution
            </span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Track manufacturing progression across Pre-Press, Offset Printing, Binding, and Finishing with yield analysis and machine logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void loadInitial()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🔄</span> Refresh
          </button>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleOpenRecordModal()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              <span>⚙️</span> Record Press Operation
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}>✕</button>
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#dcfce7', border: '1px solid #4ade80', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {notice}</span>
          <button onClick={() => setNotice('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6366f1', marginBottom: '0.25rem' }}>
            🖨️ Pre-Press Output
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>{kpis.prepressOutput.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Plates & CTP verified</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', marginBottom: '0.25rem' }}>
            ⚙️ Offset Printing Output
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563eb' }}>{kpis.printingOutput.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Press signatures printed</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#d97706', marginBottom: '0.25rem' }}>
            📖 Binding & Assembly
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#d97706' }}>{kpis.bindingOutput.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Gathered & bound copies</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#16a34a', marginBottom: '0.25rem' }}>
            ✂️ Finishing & Trimmed
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a' }}>{kpis.finishingOutput.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            {kpis.plannedQty > 0 ? `${kpis.overallProgress}% of ${kpis.plannedQty} planned copies` : 'Ready for QC'}
          </div>
        </div>
      </section>

      {/* Order Context & Master Selector */}
      <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: selectedOrderId ? '1rem' : 0 }}>
          <div style={{ flex: '1 1 320px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Select Print Order
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                className="input"
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                value={selectedOrderId}
                onChange={e => void selectOrder(e.target.value)}
              >
                <option value="">-- All Print Orders (Global Pipeline) --</option>
                <optgroup label="⚙️ Active In-Production Orders">
                  {activeOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.print_order_number} — {o.book_title} ({human(o.status)} · {o.planned_qty} copies)
                    </option>
                  ))}
                </optgroup>
                {completedOrders.length > 0 && (
                  <optgroup label="📦 Completed (Already in Warehouse Inventory)">
                    {completedOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        📦 {o.print_order_number} — {o.book_title} [IN INVENTORY: {o.received_qty || o.planned_qty}/{o.planned_qty} copies]
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <Link
                href="/printing-production/create-print-order"
                className="btn"
                title="Create a new print order"
                style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
              >
                ➕
              </Link>
            </div>
          </div>

          {selectedOrderId && activeOrderObj && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['draft', 'pending_approval', 'approved'].includes(activeOrderObj.status) && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleScheduleOrder()}
                  disabled={busy}
                  style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', fontWeight: 600 }}
                  title="Schedule order to authorize shop floor runs and material issues"
                >
                  ⚡ Schedule Order for Production
                </button>
              )}

              {canManage && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleOpenCreateBatch()}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                >
                  ➕ Open Production Batch
                </button>
              )}

              <Link
                href={`/printing-production/material-issue`}
                className="btn"
                style={{ background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                📦 Raw Material Issues
              </Link>

              <Link
                href={`/printing-production/quality-inspection`}
                className="btn"
                style={{ background: '#fdf2f8', border: '1px solid #f472b6', color: '#be185d', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                🔍 Quality Inspection (QC)
              </Link>

              <Link
                href={`/printing-production/production-receipt`}
                className="btn"
                style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#047857', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                📥 Finished Goods Receipt
              </Link>
            </div>
          )}
        </div>

        {/* Completed in Inventory Banner */}
        {selectedOrderId && isCompletedInInventory(orderDetail || activeOrderObj) && (
          <div style={{ margin: '1rem 0', padding: '1rem 1.25rem', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📦</span>
              <div>
                <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.95rem' }}>
                  Print Order Fully Produced &amp; Received into Inventory
                </div>
                <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: '2px' }}>
                  All <strong>{(orderDetail || activeOrderObj)?.received_qty || (orderDetail || activeOrderObj)?.planned_qty}</strong> finished copies have been manufactured, passed QA, and posted to <strong>{(orderDetail || activeOrderObj)?.target_warehouse_name || 'Dhaka Main Warehouse'}</strong>. No further floor operations can be logged.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                href="/inventory-warehouse/inventory-balance-inquiry"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', textDecoration: 'none' }}
              >
                🔍 View Warehouse Stock
              </Link>
              <Link
                href="/printing-production/production-receipt"
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', textDecoration: 'none' }}
              >
                📄 View Production Receipts
              </Link>
            </div>
          </div>
        )}

        {/* Selected Order Summary Card */}
        {selectedOrderId && activeOrderObj && (
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Book Title</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{activeOrderObj.book_title}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Planned Print Run</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{Number(activeOrderObj.planned_qty).toLocaleString()} copies</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Order Status</div>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: activeOrderObj.status === 'scheduled' ? '#dcfce7' : activeOrderObj.status === 'in_progress' ? '#e0f2fe' : '#fef3c7',
                  color: activeOrderObj.status === 'scheduled' ? '#166534' : activeOrderObj.status === 'in_progress' ? '#075985' : '#92400e',
                }}>
                  {human(activeOrderObj.status)}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Active Batches</div>
              <div style={{ fontWeight: 600, color: openBatches.length > 0 ? '#166534' : '#d97706' }}>
                {openBatches.length > 0 ? `${openBatches.length} Open Batch(es)` : 'No Open Batch'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Target Completion</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{activeOrderObj.due_date ? String(activeOrderObj.due_date).slice(0, 10) : 'TBD'}</div>
            </div>
          </div>
        )}
      </section>

      {/* Interactive 4-Stage Visual Pipeline */}
      <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
              Shop Floor Manufacturing Pipeline
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Sequential flow of book production from prepress digital plates to final trimming.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {STAGES.map((s, idx) => {
            const data = stageStats[s.id];
            const hasPriorOutput = idx === 0 || stageStats[STAGES[idx - 1].id].output > 0;

            return (
              <div
                key={s.id}
                style={{
                  background: '#f8fafc',
                  border: `1px solid ${s.color}30`,
                  borderTop: `4px solid ${s.color}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                      {s.icon} {s.short}
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: s.bg, color: s.color, fontWeight: 700 }}>
                      Stage {idx + 1}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.75rem 0', minHeight: '32px' }}>
                    {s.desc}
                  </p>

                  <div style={{ background: '#fff', borderRadius: '6px', padding: '0.6rem', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#64748b' }}>Input:</span>
                      <strong>{data.input.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#16a34a' }}>Good Output:</span>
                      <strong style={{ color: '#16a34a' }}>{data.output.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#dc2626' }}>Spoilage / Scrap:</span>
                      <strong style={{ color: data.rejected > 0 ? '#dc2626' : '#64748b' }}>{data.rejected.toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Yield bar */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                      <span>Stage Yield:</span>
                      <span style={{ fontWeight: 700, color: s.color }}>{data.input > 0 ? `${data.yieldRate}%` : 'Pending'}</span>
                    </div>
                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${data.input > 0 ? data.yieldRate : 0}%`, height: '100%', background: s.color }} />
                    </div>
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleOpenRecordModal(s.id)}
                    disabled={busy || !hasPriorOutput}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: hasPriorOutput ? s.bg : '#f1f5f9',
                      color: hasPriorOutput ? s.color : '#94a3b8',
                      border: `1px solid ${s.color}40`,
                    }}
                  >
                    ⚡ Log {s.short} Run
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {stageStats.finishing.output > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.85rem 1.25rem', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #6ee7b7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem' }}>
                🎉 Finishing Run Completed ({stageStats.finishing.output.toLocaleString()} books ready)
              </div>
              <div style={{ fontSize: '0.825rem', color: '#047857' }}>
                Books have passed folding, binding, and trimming. Next step: Log Quality Inspection (QC) to record accepted vs rejected copies before stocking into the finished goods warehouse.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                href="/printing-production/quality-inspection"
                className="btn"
                style={{ background: '#059669', color: '#fff', border: 'none', fontWeight: 600, padding: '0.45rem 0.85rem', textDecoration: 'none' }}
              >
                🔍 Proceed to Quality Inspection ➔
              </Link>
              <Link
                href="/printing-production/production-receipt"
                className="btn"
                style={{ background: '#fff', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 600, padding: '0.45rem 0.85rem', textDecoration: 'none' }}
              >
                📥 Finished Goods Receipt
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('log')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'log' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'log' ? 700 : 500,
            color: activeTab === 'log' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📋 Operations Register ({filteredOperations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pipeline')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pipeline' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'pipeline' ? 700 : 500,
            color: activeTab === 'pipeline' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📊 Spoilage & Yield Analysis
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'batches' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'batches' ? 700 : 500,
            color: activeTab === 'batches' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          🏷️ Production Batches ({batches.length})
        </button>
      </div>

      {/* TAB 1: Operations Register */}
      {activeTab === 'log' && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flex: '1 1 320px' }}>
              <input
                className="input"
                type="text"
                placeholder="Search by order #, machine, or operator note..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <select
                className="input"
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value)}
                style={{ width: '180px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="all">All Stages</option>
                <option value="prepress">Pre-Press Only</option>
                <option value="printing">Printing Only</option>
                <option value="binding">Binding Only</option>
                <option value="finishing">Finishing Only</option>
              </select>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Showing {filteredOperations.length} of {operations.length} press operations
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Print Order #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Stage</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Operation Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Input Qty</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Good Output</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Scrap / Rejection</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Yield %</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Operator / Shift Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredOperations.length > 0 ? (
                  filteredOperations.map(op => {
                    const stageDef = STAGES.find(s => s.id === op.stage) || STAGES[0];
                    const input = Number(op.input_qty || 0);
                    const output = Number(op.output_qty || 0);
                    const yieldRate = input > 0 ? Math.round((output / input) * 100) : 100;

                    return (
                      <tr key={op.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                          {op.print_order_number}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: stageDef.bg,
                            color: stageDef.color,
                          }}>
                            {stageDef.icon} {stageDef.short}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                          {String(op.operation_date || '').slice(0, 10)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                          {input.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>
                          {output.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: Number(op.rejected_qty) > 0 ? '#dc2626' : '#64748b' }}>
                          {Number(op.rejected_qty).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: yieldRate >= 95 ? '#16a34a' : yieldRate >= 85 ? '#d97706' : '#dc2626' }}>
                          {yieldRate}%
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {op.note || '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      {loading ? 'Loading operations...' : 'No press operations recorded yet. Click "Record Press Operation" to log shop floor progress.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Yield & Spoilage Analysis */}
      {activeTab === 'pipeline' && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 className="section-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 600 }}>
            Stage-by-Stage Yield & Waste Analysis
          </h2>
          <p className="muted" style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem' }}>
            Identify which press or finishing process generates scrap to optimize setup allowances and ink/paper utilization.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {STAGES.map(s => {
              const data = stageStats[s.id];
              return (
                <div key={s.id} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong>{s.icon} {s.label}</strong>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{data.yieldRate}% Yield</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Input: <strong>{data.input}</strong> | Output: <strong>{data.output}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#dc2626', marginBottom: '0.75rem' }}>
                    Scrap / Defect: <strong>{data.rejected} units</strong> ({data.input > 0 ? ((data.rejected / data.input) * 100).toFixed(1) : '0'}%)
                  </div>
                  <div style={{ height: '8px', background: '#fee2e2', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${data.yieldRate}%`, height: '100%', background: '#16a34a' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: Production Batches */}
      {activeTab === 'batches' && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Production Batches & Schedule
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Batches governing shop floor operations, schedules, and traceability.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenCreateBatch()}
              >
                ➕ Open New Batch
              </button>
            )}
          </div>

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Batch Reference</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Planned Qty</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Schedule Window</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.length > 0 ? (
                  batches.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{b.batch_ref}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{Number(b.planned_qty).toLocaleString()} copies</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {String(b.planned_start).slice(0, 10)} to {String(b.planned_end).slice(0, 10)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: b.status === 'open' ? '#dcfce7' : '#f1f5f9',
                          color: b.status === 'open' ? '#166534' : '#64748b',
                        }}>
                          {b.status === 'open' ? '🟢 Open (Active)' : 'Closed'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setSelectedBatchId(b.id);
                            void handleOpenRecordModal('prepress');
                          }}
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                        >
                          ⚡ Log Operation
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No batches found for this print order. Click "Open New Batch" to begin recording production.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================
          MODAL 1: Record Production Operation
      ======================================================== */}
      {showOperationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '640px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  Record Press Operation
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Log units processed through shop floor machinery and track spoilage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOperationModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitOperation} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Print Order */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Print Order <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    className="input"
                    required
                    value={formOrderId}
                    onChange={e => void handleModalOrderChange(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Choose Print Order --</option>
                    <optgroup label="⚙️ Active In-Production Orders">
                      {activeOrders.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.print_order_number} — {o.book_title} ({human(o.status)})
                        </option>
                      ))}
                    </optgroup>
                    {completedOrders.length > 0 && (
                      <optgroup label="📦 Completed (In Inventory - Cannot Log Operations)">
                        {completedOrders.map(o => (
                          <option key={o.id} value={o.id} disabled>
                            📦 {o.print_order_number} — {o.book_title} (Completed in Inventory)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Production Batch */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      Production Batch <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateBatch()}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ➕ Quick Batch
                    </button>
                  </div>
                  <select
                    className="input"
                    required
                    value={formBatchId}
                    onChange={e => {
                      setFormBatchId(e.target.value);
                      computeStageAvailable(formStage, batches.find(b => b.id === e.target.value));
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Select Open Batch --</option>
                    {batches.filter(b => b.status === 'open').map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batch_ref} ({b.planned_qty} copies)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stage Selection */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Manufacturing Stage <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                    {STAGES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleFormStageChange(s.id)}
                        style={{
                          padding: '0.6rem 0.4rem',
                          borderRadius: '6px',
                          border: formStage === s.id ? `2px solid ${s.color}` : '1px solid #cbd5e1',
                          background: formStage === s.id ? s.bg : '#fff',
                          color: formStage === s.id ? s.color : '#475569',
                          fontWeight: formStage === s.id ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                        <span>{s.short}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Operation Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Operation Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    className="input"
                    required
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Input Quantity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      Input Quantity <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => computeStageAvailable(formStage)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ⚡ Max Available
                    </button>
                  </div>
                  <input
                    className="input"
                    required
                    type="number"
                    min="1"
                    value={formInputQty}
                    onChange={e => {
                      const inp = Number(e.target.value) || 0;
                      setFormInputQty(inp);
                      setFormOutputQty(Math.max(0, inp - formRejectedQty));
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Output Quantity */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.25rem' }}>
                    Good Output Quantity <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    className="input"
                    required
                    type="number"
                    min="0"
                    max={formInputQty}
                    value={formOutputQty}
                    onChange={e => {
                      const out = Number(e.target.value) || 0;
                      setFormOutputQty(out);
                      setFormRejectedQty(Math.max(0, formInputQty - out));
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Rejected Quantity */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>
                    Rejected / Scrap Quantity <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    className="input"
                    required
                    type="number"
                    min="0"
                    max={formInputQty}
                    value={formRejectedQty}
                    onChange={e => {
                      const rej = Number(e.target.value) || 0;
                      setFormRejectedQty(rej);
                      setFormOutputQty(Math.max(0, formInputQty - rej));
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Shift / Press / Operator Notes */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Operator & Press Notes
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Heidelberg XL 75, Morning Shift, Operator Rafiq; plates aligned accurately."
                    value={formNote}
                    onChange={e => setFormNote(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowOperationModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !formBatchId}
                  style={{ fontWeight: 600 }}
                >
                  {busy ? 'Recording...' : 'Save Press Operation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: Quick Create Batch
      ======================================================== */}
      {showBatchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Open Production Batch</h3>
              <button type="button" onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={submitCreateBatch} style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Batch Reference</label>
                <input
                  className="input"
                  required
                  value={batchRef}
                  onChange={e => setBatchRef(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Planned Copies</label>
                <input
                  className="input"
                  required
                  type="number"
                  min="1"
                  value={batchPlannedQty}
                  onChange={e => setBatchPlannedQty(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Planned Start</label>
                  <input
                    className="input"
                    required
                    type="date"
                    value={batchPlannedStart}
                    onChange={e => setBatchPlannedStart(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Planned End</label>
                  <input
                    className="input"
                    required
                    type="date"
                    value={batchPlannedEnd}
                    onChange={e => setBatchPlannedEnd(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowBatchModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Creating...' : 'Open Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
