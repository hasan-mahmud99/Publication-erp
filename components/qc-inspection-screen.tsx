'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const todayDate = () => new Date().toISOString().slice(0, 10);
const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function QcInspectionScreen({ screen }: { screen?: Screen }) {
  // Master records
  const [orders, setOrders] = useState<Row[]>([]);
  const [operations, setOperations] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [dispositions, setDispositions] = useState<Row[]>([]);
  const [resolutions, setResolutions] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);

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
  const [activeTab, setActiveTab] = useState<'inspections' | 'resolutions' | 'dispositions'>('inspections');

  // Form states for Recording QC Inspection (Auto-filled)
  const [formRef, setFormRef] = useState('');
  const [formDate, setFormDate] = useState(todayDate());
  const [formInspectedQty, setFormInspectedQty] = useState<number>(0);
  const [formAcceptedQty, setFormAcceptedQty] = useState<number>(0);
  const [formRejectedQty, setFormRejectedQty] = useState<number>(0);
  const [formDamagedQty, setFormDamagedQty] = useState<number>(0);
  const [formPendingQty, setFormPendingQty] = useState<number>(0);
  const [formDefectNote, setFormDefectNote] = useState('');

  // Selected Order & Batch Exact Yield Tracking
  const [selectedOrderFinishingOutput, setSelectedOrderFinishingOutput] = useState<number>(0);
  const [selectedOrderPriorInspected, setSelectedOrderPriorInspected] = useState<number>(0);
  const [selectedOrderAvailableToInspect, setSelectedOrderAvailableToInspect] = useState<number>(0);

  // Form states for Pending Resolution
  const [resolutionInspectionId, setResolutionInspectionId] = useState('');
  const [resolutionQty, setResolutionQty] = useState<number>(1);
  const [resolutionAccepted, setResolutionAccepted] = useState<number>(1);
  const [resolutionRejected, setResolutionRejected] = useState<number>(0);
  const [resolutionDamaged, setResolutionDamaged] = useState<number>(0);
  const [resolutionNote, setResolutionNote] = useState('Senior QA re-inspection: copies verified and accepted.');

  // Form states for Scrap Disposition
  const [dispositionInspectionId, setDispositionInspectionId] = useState('');
  const [dispositionRef, setDispositionRef] = useState('');
  const [dispositionCategory, setDispositionCategory] = useState<'rejected' | 'damaged'>('rejected');
  const [dispositionReason, setDispositionReason] = useState('printing_defect');
  const [dispositionQty, setDispositionQty] = useState<number>(1);
  const [dispositionExplanation, setDispositionExplanation] = useState('Scrap disposal authorized after full production QA run.');

  // Decision Note for Approvals
  const [decisionNote, setDecisionNote] = useState('Approved per quality assurance publishing standards.');

  // Permissions
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);

  // Check if order has already been completed and received into inventory
  const isCompletedInInventory = (o: Row | null | undefined) => {
    if (!o) return false;
    return o.status === 'complete' || (Number(o.received_qty || 0) >= Number(o.planned_qty || 0) && Number(o.planned_qty || 0) > 0);
  };

  const activeOrders = orders.filter(o => !isCompletedInInventory(o));
  const completedOrders = orders.filter(o => isCompletedInInventory(o));

  // Load all initial records
  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [orderRes, opRes, inspRes, dispRes, resRes, rcptRes, meRes] = await Promise.all([
        api<{ data: { data: Row[] } }>('/production/print-orders?limit=100&offset=0'),
        api<{ data: Row[] }>('/production/operations'),
        api<{ data: Row[] }>('/production/inspections'),
        api<{ data: Row[] }>('/production/qc-dispositions'),
        api<{ data: Row[] }>('/production/qc-resolutions'),
        api<{ data: Row[] }>('/production/receipts'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);

      const ordList = orderRes.data.data || [];
      setOrders(ordList);
      setOperations(opRes.data || []);
      setInspections(inspRes.data || []);
      setDispositions(dispRes.data || []);
      setResolutions(resRes.data || []);
      setReceipts(rcptRes.data || []);

      const isAllowed = (p: string) => meRes.data.role === 'Owner' || (meRes.data.permissions || []).includes(p);
      setCanManage(isAllowed('production.manage'));
      setCanApprove(isAllowed('production.approve'));

      const activeList = ordList.filter(o => !isCompletedInInventory(o));
      const targetId = selectedOrderId || (activeList.length > 0 ? activeList[0].id : (ordList.length > 0 ? ordList[0].id : ''));
      if (targetId) {
        await selectOrder(targetId, ordList, opRes.data || [], inspRes.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load QC inspection records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  // Handle Order Selection and Auto-Filling All QC Fields
  async function selectOrder(id: string, currentOrders = orders, currentOps = operations, currentInsps = inspections) {
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

      const ord = orderRes.data;
      setOrderDetail(ord);
      const bList = batchRes.data || [];
      setBatches(bList);

      const openBatch = bList.find((b: Row) => b.status === 'open') || bList[0];
      const targetBatchId = openBatch?.id || '';
      if (openBatch) {
        setSelectedBatchId(targetBatchId);
      }

      // Auto-calculate finished output and prefill QC Form
      autoFillFormForOrder(id, ord, targetBatchId, openBatch, currentOps, currentInsps);
    } catch (err: any) {
      setError(err?.message || 'Could not load print order details.');
    }
  }

  // Auto-fill QC form based on live finishing output & prior inspections
  function autoFillFormForOrder(
    ordId: string,
    ordObj: Row | null,
    batchId: string,
    batchObj?: Row,
    opsList = operations,
    inspsList = inspections
  ) {
    const orderNumber = ordObj?.print_order_number || 'PO';
    const cleanDate = todayDate().replace(/-/g, '').slice(2);
    setFormRef(`QC-${orderNumber}-${cleanDate}`);
    setFormDate(todayDate());

    // Calculate exact finishing output for this order / batch
    // Floor operations can have batch_id matching or null (order-level)
    const orderFinishingOps = opsList.filter(o => o.print_order_id === ordId && o.stage === 'finishing');
    const batchFinishingOps = orderFinishingOps.filter(o => !batchId || !o.batch_id || o.batch_id === batchId);
    const finishingOutput = batchFinishingOps.length > 0
      ? batchFinishingOps.reduce((sum, o) => sum + Number(o.output_qty || 0), 0)
      : orderFinishingOps.reduce((sum, o) => sum + Number(o.output_qty || 0), 0);

    // Calculate how many copies have already been inspected
    const relevantInsps = inspsList.filter(i => i.print_order_id === ordId && (!batchId || !i.batch_id || i.batch_id === batchId));
    const priorInspected = relevantInsps.reduce((sum, i) => sum + Number(i.inspected_qty || 0), 0);

    const availableToInspect = Math.max(0, finishingOutput - priorInspected);

    setSelectedOrderFinishingOutput(finishingOutput);
    setSelectedOrderPriorInspected(priorInspected);
    setSelectedOrderAvailableToInspect(availableToInspect);

    // Suggested inspection quantity strictly uses the exact floor outcome (e.g. 388), NEVER falling back to planned (400)
    let suggestedQty = 0;
    if (finishingOutput > 0) {
      suggestedQty = availableToInspect;
    } else {
      suggestedQty = 0;
    }

    setFormInspectedQty(suggestedQty);
    setFormAcceptedQty(suggestedQty);
    setFormRejectedQty(0);
    setFormDamagedQty(0);
    setFormPendingQty(0);
    setFormDefectNote('');
  }

  // When user switches batch dropdown
  function handleBatchChange(bId: string) {
    setSelectedBatchId(bId);
    const bObj = batches.find(b => b.id === bId);
    autoFillFormForOrder(selectedOrderId, orderDetail, bId, bObj);
  }

  // Balance calculation
  const outcomeTotal = formAcceptedQty + formRejectedQty + formDamagedQty + formPendingQty;
  const isOutcomeBalanced = formInspectedQty > 0 && outcomeTotal === formInspectedQty;
  const outcomeDiff = formInspectedQty - outcomeTotal;

  // Preset Ratio Helpers
  function setAllAccepted() {
    setFormAcceptedQty(formInspectedQty);
    setFormRejectedQty(0);
    setFormDamagedQty(0);
    setFormPendingQty(0);
  }

  function setStandardScrap(percent = 2) {
    const scrap = Math.max(1, Math.round((formInspectedQty * percent) / 100));
    const accepted = Math.max(0, formInspectedQty - scrap);
    setFormAcceptedQty(accepted);
    setFormRejectedQty(scrap);
    setFormDamagedQty(0);
    setFormPendingQty(0);
  }

  function autoBalanceAccepted() {
    const others = formRejectedQty + formDamagedQty + formPendingQty;
    const remaining = Math.max(0, formInspectedQty - others);
    setFormAcceptedQty(remaining);
  }

  // Handle Save Inspection
  async function handleSubmitInspection(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !selectedBatchId) {
      setError('Please select an active print order and production batch.');
      return;
    }
    if (!isOutcomeBalanced) {
      setError(`Outcome total (${outcomeTotal}) must equal inspected quantity (${formInspectedQty}). Click Auto-Balance.`);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/production/inspections', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrderId,
          batchId: selectedBatchId,
          reference: formRef,
          inspectionDate: formDate,
          inspectedQty: Number(formInspectedQty),
          acceptedQty: Number(formAcceptedQty),
          rejectedQty: Number(formRejectedQty),
          damagedQty: Number(formDamagedQty),
          pendingQty: Number(formPendingQty),
          defectNote: formDefectNote || undefined,
        }),
      });

      setNotice(`Inspection ${formRef} recorded successfully (${formAcceptedQty} accepted, ${formRejectedQty} rejected).`);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to save QC inspection.');
    } finally {
      setBusy(false);
    }
  }

  // 1-Click Approve Inspection
  async function handleApproveInspection(inspId: string, ref: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/production/inspections/${inspId}/approve`, {
        method: 'POST',
        body: '{}',
      });
      setNotice(`QC Inspection ${ref} approved. Ready for finished goods warehouse receipt.`);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve QC inspection.');
    } finally {
      setBusy(false);
    }
  }

  // 1-Click Receive and Post to Warehouse Inventory
  async function handleReceiveToInventory(insp: Row) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ quantity: number; reference: string }>(`/production/inspections/${insp.id}/receive-to-inventory`, {
        method: 'POST',
        body: '{}',
      });
      setNotice(`✅ Successfully received ${res.quantity} copies into warehouse inventory! Receipt ${res.reference} posted.`);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to receive into warehouse inventory.');
    } finally {
      setBusy(false);
    }
  }

  // Handle Request Resolution
  async function handleCreateResolution(e: React.FormEvent) {
    e.preventDefault();
    if (!resolutionInspectionId) {
      setError('Please choose an inspection with pending copies.');
      return;
    }
    if (resolutionAccepted + resolutionRejected + resolutionDamaged !== resolutionQty) {
      setError('Resolution outcomes must equal the resolved quantity.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/production/qc-resolutions', {
        method: 'POST',
        body: JSON.stringify({
          inspectionId: resolutionInspectionId,
          resolvedQty: Number(resolutionQty),
          acceptedQty: Number(resolutionAccepted),
          rejectedQty: Number(resolutionRejected),
          damagedQty: Number(resolutionDamaged),
          note: resolutionNote,
        }),
      });
      setNotice('QC resolution submitted for approval.');
      setResolutionInspectionId('');
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit QC resolution.');
    } finally {
      setBusy(false);
    }
  }

  // Handle Approve Resolution
  async function handleApproveResolution(resId: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/production/qc-resolutions/${resId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: decisionNote }),
      });
      setNotice('QC resolution approved.');
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve QC resolution.');
    } finally {
      setBusy(false);
    }
  }

  // Handle Create Disposition
  async function handleCreateDisposition(e: React.FormEvent) {
    e.preventDefault();
    if (!dispositionInspectionId) {
      setError('Please choose an approved inspection for scrap disposition.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/production/qc-dispositions', {
        method: 'POST',
        body: JSON.stringify({
          inspectionId: dispositionInspectionId,
          reference: dispositionRef,
          category: dispositionCategory,
          reasonCode: dispositionReason,
          quantity: Number(dispositionQty),
          treatment: 'scrap',
          explanation: dispositionExplanation,
        }),
      });
      setNotice(`QC loss disposition ${dispositionRef} recorded.`);
      setDispositionRef('');
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to record QC disposition.');
    } finally {
      setBusy(false);
    }
  }

  // Handle Approve Disposition
  async function handleApproveDisposition(dispId: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/production/qc-dispositions/${dispId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: decisionNote }),
      });
      setNotice('QC loss disposition approved for scrap treatment.');
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve disposition.');
    } finally {
      setBusy(false);
    }
  }

  // Statistics
  const relevantInspections = useMemo(() => {
    return inspections.filter(i => !selectedOrderId || i.print_order_id === selectedOrderId);
  }, [inspections, selectedOrderId]);

  const stats = useMemo(() => {
    const totalInspected = relevantInspections.reduce((s, i) => s + Number(i.inspected_qty || 0), 0);
    const totalAccepted = relevantInspections.reduce((s, i) => s + Number(i.effective_accepted_qty || 0), 0);
    const totalRejected = relevantInspections.reduce((s, i) => s + Number(i.effective_rejected_qty || 0), 0);
    const totalDamaged = relevantInspections.reduce((s, i) => s + Number(i.effective_damaged_qty || 0), 0);
    const totalPending = relevantInspections.reduce((s, i) => s + Number(i.effective_pending_qty || 0), 0);
    const passRate = totalInspected > 0 ? Math.round((totalAccepted / totalInspected) * 100) : 100;

    // Remaining accepted that haven't been received into warehouse yet
    const totalReceived = receipts
      .filter(r => !selectedOrderId || r.print_order_id === selectedOrderId)
      .reduce((s, r) => s + Number(r.quantity || 0), 0);
    const unreceivedAccepted = Math.max(0, totalAccepted - totalReceived);

    return { totalInspected, totalAccepted, totalRejected, totalDamaged, totalPending, passRate, unreceivedAccepted };
  }, [relevantInspections, receipts, selectedOrderId]);

  // Active finishing output counter (exact physical books yielded from shop floor bindery)
  const finishingOutput = useMemo(() => {
    const orderOps = operations.filter(o => o.stage === 'finishing' && (!selectedOrderId || o.print_order_id === selectedOrderId));
    if (selectedBatchId) {
      const batchOps = orderOps.filter(o => !o.batch_id || o.batch_id === selectedBatchId);
      if (batchOps.length > 0) {
        return batchOps.reduce((s, o) => s + Number(o.output_qty || 0), 0);
      }
    }
    return orderOps.reduce((s, o) => s + Number(o.output_qty || 0), 0);
  }, [operations, selectedOrderId, selectedBatchId]);

  const activeOrderObj = orders.find(o => o.id === selectedOrderId);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/printing-production/wip-tracking" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← WIP Tracking
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Quality Assurance</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🔍</span> Quality Control (QC) & Inspection Register
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Inspect finished books from the bindery line, verify quality standards, and authorize warehouse inventory acceptance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void loadInitial()}
            disabled={loading}
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}
          >
            🔄 Refresh
          </button>
          <Link
            href="/printing-production/production-receipt"
            className="btn"
            style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📥</span> Finished Goods Receipt ➔
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}
      {notice && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#dcfce7', border: '1px solid #4ade80', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {notice}</span>
          <button type="button" onClick={() => setNotice('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* KPI Overview Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Finishing Output (Ready)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>{finishingOutput.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Physical books produced on floor</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Accepted (Passed QA)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>{stats.totalAccepted.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>{stats.passRate}% Quality Yield Rate</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Rejected & Damaged (Loss)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', margin: '0.25rem 0' }}>{(stats.totalRejected + stats.totalDamaged).toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{stats.totalRejected} rejected · {stats.totalDamaged} damaged</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Awaiting Warehouse Receipt</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.unreceivedAccepted > 0 ? '#2563eb' : '#64748b', margin: '0.25rem 0' }}>{stats.unreceivedAccepted.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>Passed QA; ready to stock</div>
        </div>
      </section>

      {/* Main Order Context Bar */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Select Active Print Order
            </label>
            <select
              className="input"
              value={selectedOrderId}
              onChange={e => void selectOrder(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <optgroup label="⚙️ Active In-Production Orders (Inspectable)">
                {activeOrders.map(o => {
                  const finishedCopies = operations
                    .filter(op => op.print_order_id === o.id && op.stage === 'finishing')
                    .reduce((sum, op) => sum + Number(op.output_qty || 0), 0);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.print_order_number} — {o.book_title} ({finishedCopies > 0 ? `🎯 ${finishedCopies} finished outcome (Exact)` : `Plan: ${o.planned_qty}`})
                    </option>
                  );
                })}
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
          </div>

          <div style={{ flex: '1 1 240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                Production Batch
              </label>
              {batches.length === 0 && selectedOrderId && (
                <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>Auto-generating batch...</span>
              )}
            </div>
            <select
              className="input"
              value={selectedBatchId}
              onChange={e => handleBatchChange(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              {batches.length === 0 ? (
                <option value="">No batches available</option>
              ) : (
                batches.map(b => {
                  const bFinished = operations
                    .filter(op => op.stage === 'finishing' && (op.batch_id === b.id || (!op.batch_id && op.print_order_id === selectedOrderId)))
                    .reduce((sum, op) => sum + Number(op.output_qty || 0), 0);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.batch_ref} — {bFinished > 0 ? `🎯 ${bFinished} finished (Exact floor count)` : `${b.planned_qty} planned`} ({b.status === 'open' ? '🟢 Open' : 'Closed'})
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        {/* Inventory Completion Notice Banner */}
        {isCompletedInInventory(orderDetail || activeOrderObj) && (
          <div style={{ margin: '1rem 0', padding: '1rem 1.25rem', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📦</span>
              <div>
                <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.95rem' }}>
                  Print Order Fully Produced &amp; Received into Inventory
                </div>
                <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: '2px' }}>
                  All <strong>{(orderDetail || activeOrderObj)?.received_qty || (orderDetail || activeOrderObj)?.planned_qty}</strong> finished copies have completed QA and are posted in <strong>{(orderDetail || activeOrderObj)?.target_warehouse_name || 'Dhaka Main Warehouse'}</strong>. No further inspection is required.
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
                📄 View Receipts
              </Link>
            </div>
          </div>
        )}

        {/* Selected Order Highlights */}
        {activeOrderObj && (
          <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Book Title: </span>
              <strong style={{ color: '#0f172a' }}>{activeOrderObj.book_title}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Order Planned: </span>
              <strong>{Number(activeOrderObj.planned_qty).toLocaleString()} copies</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Floor Finishing Outcome: </span>
              <strong style={{ color: finishingOutput > 0 ? '#16a34a' : '#d97706' }}>
                {finishingOutput.toLocaleString()} copies (Exact)
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Prior QC Inspected: </span>
              <strong style={{ color: selectedOrderPriorInspected > 0 ? '#2563eb' : '#64748b' }}>
                {selectedOrderPriorInspected.toLocaleString()} copies
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Available to Inspect: </span>
              <strong style={{ color: selectedOrderAvailableToInspect > 0 ? '#16a34a' : '#64748b' }}>
                {selectedOrderAvailableToInspect > 0
                  ? `${selectedOrderAvailableToInspect.toLocaleString()} copies (Ready)`
                  : (finishingOutput > 0 ? '0 copies (All Inspected)' : '0 copies (No finishing yet)')}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Order Status: </span>
              <span style={{
                display: 'inline-block',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: activeOrderObj.status === 'in_progress' ? '#e0f2fe' : '#dcfce7',
                color: activeOrderObj.status === 'in_progress' ? '#075985' : '#166534',
              }}>
                {human(activeOrderObj.status)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Seamless Record Inspection Form */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {isCompletedInInventory(orderDetail || activeOrderObj) ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>Inspection Complete — Order Stored in Warehouse Inventory</div>
            <div style={{ fontSize: '0.875rem', color: '#475569', maxWidth: '640px', margin: '0.5rem auto 1.25rem auto', lineHeight: '1.5' }}>
              All <strong>{(orderDetail || activeOrderObj)?.received_qty || (orderDetail || activeOrderObj)?.planned_qty}</strong> finished copies for {(orderDetail || activeOrderObj)?.print_order_number} have already passed QA and been posted into <strong>{(orderDetail || activeOrderObj)?.target_warehouse_name || 'Dhaka Main Warehouse'}</strong>. This print order is completed and cannot receive additional inspection entries.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/inventory-warehouse/inventory-balance-inquiry" className="btn btn-primary" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
                🔍 View Stock in Inventory Balance
              </Link>
              <Link href="/printing-production/production-receipt" className="btn" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
                📄 View Production Receipts
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              ⚡ Record Quality Inspection (Exact Floor Outcome)
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#64748b' }}>
              Quantities strictly reflect actual finished floor outcomes ({finishingOutput > 0 ? `${finishingOutput} physical copies produced from bindery` : 'no finishing output logged yet'}).
            </p>
          </div>

          {/* Quick presets & exact outcome buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {finishingOutput > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const target = selectedOrderAvailableToInspect > 0 ? selectedOrderAvailableToInspect : finishingOutput;
                  setFormInspectedQty(target);
                  setFormAcceptedQty(target);
                  setFormRejectedQty(0);
                  setFormDamagedQty(0);
                  setFormPendingQty(0);
                }}
                style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 0.75rem' }}
                title="Fill with exact physical finishing outcome from shop floor"
              >
                🎯 Use Exact Floor Outcome ({selectedOrderAvailableToInspect > 0 ? selectedOrderAvailableToInspect : finishingOutput})
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={setAllAccepted}
              style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem' }}
            >
              ✅ 100% Passed
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setStandardScrap(2)}
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem' }}
            >
              ⚠️ 2% Defect Scrap
            </button>
            <button
              type="button"
              className="btn"
              onClick={autoBalanceAccepted}
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem' }}
            >
              ⚖️ Auto-Balance
            </button>
          </div>
        </div>

        {/* Floor outcome & Inspection status banner */}
        {finishingOutput > 0 && selectedOrderAvailableToInspect === 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.85rem', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <strong>All {finishingOutput} finished copies from the shop floor have already been inspected for this order.</strong>
              <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '2px' }}>
                Prior inspections: {selectedOrderPriorInspected} copies. To record an additional inspection entry or re-test, enter a quantity or click "Use Exact Floor Outcome".
              </div>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFormInspectedQty(finishingOutput);
                setFormAcceptedQty(finishingOutput);
                setFormRejectedQty(0);
                setFormDamagedQty(0);
                setFormPendingQty(0);
              }}
              style={{ background: '#2563eb', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: '4px' }}
            >
              🎯 Re-Inspect Full Batch ({finishingOutput})
            </button>
          </div>
        )}

        {finishingOutput === 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.85rem', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <strong>⚠️ No floor finishing output has been logged yet for this order.</strong>
              <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px' }}>
                In the publishing process, bound books must be completed in the Finishing stage before QA inspection.
              </div>
            </div>
            <Link
              href="/printing-production/wip-tracking"
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
            >
              ⚙️ Go to WIP Floor Tracking
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmitInspection}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                QC Reference Number *
              </label>
              <input
                className="input"
                type="text"
                required
                value={formRef}
                onChange={e => setFormRef(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Inspection Date *
              </label>
              <input
                className="input"
                type="date"
                required
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.3rem' }}>
                Total Inspected Quantity *
              </label>
              <input
                className="input"
                type="number"
                required
                min="1"
                value={formInspectedQty}
                onChange={e => {
                  const val = Number(e.target.value);
                  setFormInspectedQty(val);
                  setFormAcceptedQty(Math.max(0, val - (formRejectedQty + formDamagedQty + formPendingQty)));
                }}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700 }}
              />
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>
                Floor outcome: <strong>{finishingOutput} copies</strong> {selectedOrderAvailableToInspect > 0 ? `(${selectedOrderAvailableToInspect} uninspected ready)` : '(all inspected)'}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.3rem' }}>
                🟢 Accepted (Passed QA) *
              </label>
              <input
                className="input"
                type="number"
                required
                min="0"
                value={formAcceptedQty}
                onChange={e => setFormAcceptedQty(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #86efac', fontWeight: 700, color: '#16a34a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.3rem' }}>
                🔴 Rejected (Scrap) *
              </label>
              <input
                className="input"
                type="number"
                required
                min="0"
                value={formRejectedQty}
                onChange={e => setFormRejectedQty(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fca5a5', fontWeight: 700, color: '#dc2626' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#d97706', marginBottom: '0.3rem' }}>
                🟠 Damaged (Handling) *
              </label>
              <input
                className="input"
                type="number"
                required
                min="0"
                value={formDamagedQty}
                onChange={e => setFormDamagedQty(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fcd34d', fontWeight: 700, color: '#d97706' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed', marginBottom: '0.3rem' }}>
                🟣 Pending (Hold QA) *
              </label>
              <input
                className="input"
                type="number"
                required
                min="0"
                value={formPendingQty}
                onChange={e => setFormPendingQty(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #d8b4fe', fontWeight: 700, color: '#7c3aed' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
              Defect Observations & QA Notes
            </label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Clean registration, perfect lamination, binding spine adhesion verified."
              value={formDefectNote}
              onChange={e => setFormDefectNote(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* Balance Status & Submit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
              <span>Outcome Total: <strong>{outcomeTotal}</strong> / {formInspectedQty}</span>
              {isOutcomeBalanced ? (
                <span style={{ color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  ✓ Quantities Balanced
                </span>
              ) : (
                <span style={{ color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  ⚠️ Difference: {outcomeDiff > 0 ? `+${outcomeDiff}` : outcomeDiff} (Click Auto-Balance)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !isOutcomeBalanced || formInspectedQty <= 0}
                style={{ background: isOutcomeBalanced ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', fontWeight: 700, padding: '0.6rem 1.25rem', borderRadius: '6px', cursor: isOutcomeBalanced ? 'pointer' : 'not-allowed' }}
              >
                {busy ? 'Saving...' : '💾 Save QC Inspection Draft'}
              </button>
            </div>
          </div>
        </form>
          </>
        )}
      </section>

      {/* Tabs for Registers */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('inspections')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inspections' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'inspections' ? 700 : 500,
            color: activeTab === 'inspections' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📋 Inspection Register ({relevantInspections.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolutions')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'resolutions' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'resolutions' ? 700 : 500,
            color: activeTab === 'resolutions' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          🟣 Pending QC Resolutions ({resolutions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dispositions')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'dispositions' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'dispositions' ? 700 : 500,
            color: activeTab === 'dispositions' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          🔴 Wastage & Loss Dispositions ({dispositions.length})
        </button>
      </div>

      {/* TAB 1: Inspection Register */}
      {activeTab === 'inspections' && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Reference</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Order</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Inspected</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#16a34a' }}>Accepted</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#dc2626' }}>Rejected</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#d97706' }}>Damaged</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#7c3aed' }}>Pending</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {relevantInspections.length > 0 ? (
                  relevantInspections.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        {row.reference}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        {row.print_order_number}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {String(row.inspection_date || row.created_at || '').slice(0, 10)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {Number(row.inspected_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>
                        {Number(row.effective_accepted_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: Number(row.effective_rejected_qty) > 0 ? '#dc2626' : '#64748b' }}>
                        {Number(row.effective_rejected_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: Number(row.effective_damaged_qty) > 0 ? '#d97706' : '#64748b' }}>
                        {Number(row.effective_damaged_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: Number(row.effective_pending_qty) > 0 ? '#7c3aed' : '#64748b' }}>
                        {Number(row.effective_pending_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: row.status === 'approved' ? '#dcfce7' : '#fef3c7',
                          color: row.status === 'approved' ? '#166534' : '#92400e',
                        }}>
                          {row.status === 'approved' ? '🟢 Approved' : '🟡 Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {(() => {
                          const linkedReceipt = receipts.find(r => r.inspection_id === row.id && r.status === 'posted');
                          return (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              {canApprove && row.status === 'draft' && (
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={busy}
                                  onClick={() => void handleApproveInspection(row.id, row.reference)}
                                  style={{ background: '#16a34a', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  ✅ Approve QC
                                </button>
                              )}
                              {row.status === 'approved' && !linkedReceipt && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={busy}
                                  onClick={() => void handleReceiveToInventory(row)}
                                  style={{ background: '#0284c7', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Post accepted units directly to warehouse inventory"
                                >
                                  ⚡ Receive &amp; Post to Inventory
                                </button>
                              )}
                              {linkedReceipt && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                  }}>
                                    📦 In Inventory ({linkedReceipt.quantity} units)
                                  </span>
                                  <Link
                                    href="/inventory-warehouse/inventory-balance-inquiry"
                                    className="btn"
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', textDecoration: 'none' }}
                                  >
                                    🔍 Check Stock
                                  </Link>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      No QC inspection records found for this order. Fill the form above to record an inspection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Pending Resolutions */}
      {activeTab === 'resolutions' && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0' }}>
            Resolve Pending Quarantine Copies
          </h2>
          <form onSubmit={handleCreateResolution} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Inspection with Pending Copies *
                </label>
                <select
                  className="input"
                  required
                  value={resolutionInspectionId}
                  onChange={e => {
                    setResolutionInspectionId(e.target.value);
                    const insp = inspections.find(i => i.id === e.target.value);
                    if (insp) {
                      const pQty = Number(insp.effective_pending_qty || 1);
                      setResolutionQty(pQty);
                      setResolutionAccepted(pQty);
                      setResolutionRejected(0);
                      setResolutionDamaged(0);
                    }
                  }}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">Select an inspection</option>
                  {inspections.filter(i => i.status === 'approved' && Number(i.effective_pending_qty) > 0 && (!selectedOrderId || i.print_order_id === selectedOrderId)).map(i => (
                    <option key={i.id} value={i.id}>
                      {i.reference} ({i.effective_pending_qty} copies pending)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Resolved Total *
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  required
                  value={resolutionQty}
                  onChange={e => setResolutionQty(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.3rem' }}>
                  Accepted Quantity *
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  required
                  value={resolutionAccepted}
                  onChange={e => setResolutionAccepted(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.3rem' }}>
                  Rejected Quantity *
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  required
                  value={resolutionRejected}
                  onChange={e => setResolutionRejected(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d97706', marginBottom: '0.3rem' }}>
                  Damaged Quantity *
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  required
                  value={resolutionDamaged}
                  onChange={e => setResolutionDamaged(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Resolution Explanation & Findings *
              </label>
              <input
                className="input"
                type="text"
                required
                minLength={10}
                value={resolutionNote}
                onChange={e => setResolutionNote(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !resolutionInspectionId || resolutionAccepted + resolutionRejected + resolutionDamaged !== resolutionQty}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, padding: '0.5rem 1rem' }}
            >
              Submit Resolution
            </button>
          </form>

          {/* Resolutions Register */}
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Inspection</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Resolved</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#16a34a' }}>Accepted</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#dc2626' }}>Rejected</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#d97706' }}>Damaged</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {resolutions.filter(r => !selectedOrderId || r.print_order_id === selectedOrderId).map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{r.inspection_reference}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{r.resolved_qty}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#16a34a' }}>{r.accepted_qty}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#dc2626' }}>{r.rejected_qty}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#d97706' }}>{r.damaged_qty}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: r.status === 'approved' ? '#dcfce7' : '#fef3c7',
                        color: r.status === 'approved' ? '#166534' : '#92400e',
                      }}>
                        {human(r.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {canApprove && r.status === 'pending_approval' && (
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void handleApproveResolution(r.id)}
                          style={{ background: '#16a34a', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem' }}
                        >
                          Approve Resolution
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: Loss Dispositions */}
      {activeTab === 'dispositions' && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0' }}>
            Scrap Treatment & Loss Dispositions
          </h2>
          <form onSubmit={handleCreateDisposition} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Approved QC Inspection *
                </label>
                <select
                  className="input"
                  required
                  value={dispositionInspectionId}
                  onChange={e => {
                    setDispositionInspectionId(e.target.value);
                    const insp = inspections.find(i => i.id === e.target.value);
                    if (insp) {
                      setDispositionRef(`DISP-${insp.reference}`);
                      const loss = Number(insp.effective_rejected_qty || insp.effective_damaged_qty || 1);
                      setDispositionQty(loss > 0 ? loss : 1);
                    }
                  }}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">Select QC inspection</option>
                  {inspections.filter(i => i.status === 'approved' && (Number(i.effective_rejected_qty) > 0 || Number(i.effective_damaged_qty) > 0) && (!selectedOrderId || i.print_order_id === selectedOrderId)).map(i => (
                    <option key={i.id} value={i.id}>
                      {i.reference} ({i.effective_rejected_qty} rejected · {i.effective_damaged_qty} damaged)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Disposition Reference *
                </label>
                <input
                  className="input"
                  type="text"
                  required
                  value={dispositionRef}
                  onChange={e => setDispositionRef(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Category *
                </label>
                <select
                  className="input"
                  value={dispositionCategory}
                  onChange={e => setDispositionCategory(e.target.value as 'rejected' | 'damaged')}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="rejected">Rejected Copies</option>
                  <option value="damaged">Damaged Copies</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Reason Code *
                </label>
                <select
                  className="input"
                  value={dispositionReason}
                  onChange={e => setDispositionReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {['printing_defect', 'binding_defect', 'cover_damage', 'lamination_damage', 'wrong_page_sequence', 'trimming_damage', 'handling_damage', 'other'].map(v => (
                    <option key={v} value={v}>{human(v)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Quantity *
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  required
                  value={dispositionQty}
                  onChange={e => setDispositionQty(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Explanation *
              </label>
              <input
                className="input"
                type="text"
                required
                minLength={10}
                value={dispositionExplanation}
                onChange={e => setDispositionExplanation(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !dispositionInspectionId}
              style={{ background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600, padding: '0.5rem 1rem' }}
            >
              Request Scrap Disposition
            </button>
          </form>

          {/* Disposition Register */}
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Reference</th>
                  <th style={{ padding: '0.75rem 1rem' }}>QC Inspection</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Quantity</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {dispositions.filter(d => !selectedOrderId || d.print_order_id === selectedOrderId).map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{d.reference}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{d.inspection_reference}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{human(d.category)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{human(d.reason_code)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#dc2626' }}>{d.quantity}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: d.status === 'approved' ? '#dcfce7' : '#fef3c7',
                        color: d.status === 'approved' ? '#166534' : '#92400e',
                      }}>
                        {human(d.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {canApprove && d.status === 'pending_approval' && (
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => void handleApproveDisposition(d.id)}
                          style={{ background: '#16a34a', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem' }}
                        >
                          Approve Scrap
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
