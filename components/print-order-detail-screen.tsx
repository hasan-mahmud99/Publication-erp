'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function PrintOrderDetailScreen({ screen }: { screen?: Screen }) {
  // Master orders list
  const [orders, setOrders] = useState<Row[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Selected Order details & telemetry
  const [detail, setDetail] = useState<Row | null>(null);
  const [costReport, setCostReport] = useState<Row | null>(null);
  const [operations, setOperations] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [materialIssues, setMaterialIssues] = useState<Row[]>([]);

  // Permissions & notes
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // UI States
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = role === 'Owner' || permissions.includes('production.manage');
  const canApprove = role === 'Owner' || permissions.includes('production.approve');
  const canCost = role === 'Owner' || permissions.includes('production.cost');

  // Load initial orders list
  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, meRes] = await Promise.all([
        api<{ data: { data: Row[] } }>('/production/print-orders?limit=100&offset=0'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);
      const list = ordersRes.data.data || [];
      setOrders(list);
      setRole(meRes.data.role);
      setPermissions(meRes.data.permissions || []);

      const targetId = selectedOrderId || (list.length > 0 ? list[0].id : '');
      if (targetId) {
        await selectOrder(targetId);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load print order details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, [screen?.id]);

  // Load selected order details and all associated live WIP records
  async function selectOrder(id: string) {
    setSelectedOrderId(id);
    setDetail(null);
    setCostReport(null);
    setOperations([]);
    setInspections([]);
    setReceipts([]);
    setMaterialIssues([]);
    setError('');
    if (!id) return;

    try {
      const [orderRes, costRes, opsRes, inspsRes, rcptsRes, issuesRes] = await Promise.all([
        api<{ data: Row }>(`/production/print-orders/${id}`),
        api<{ data: Row }>(`/production/print-orders/${id}/cost-report`).catch(() => ({ data: {} })),
        api<{ data: Row[] }>(`/production/operations?orderId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })),
        api<{ data: Row[] }>(`/production/inspections?orderId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })),
        api<{ data: Row[] }>(`/production/receipts?orderId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })),
        api<{ data: Row[] }>(`/production/material-issues?orderId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })),
      ]);

      setDetail(orderRes.data);
      setCostReport(costRes.data || {});
      setOperations(opsRes.data || []);
      setInspections(inspsRes.data || []);
      setReceipts(rcptsRes.data || []);
      setMaterialIssues(issuesRes.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load order details.');
    }
  }

  // Handle Workflow Status Actions (submit, approve, return, schedule, start, hold, resume, complete)
  async function act(action: string) {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const decisionNote =
        note.trim() ||
        (action === 'approve'
          ? 'Approved: Production order verified with valid BOM, specifications, and scheduling limits.'
          : action === 'schedule'
          ? 'Scheduled: Press slot allotted and dates verified.'
          : action === 'start'
          ? 'Production run started on press floor.'
          : action === 'complete'
          ? 'Production run completed and verified against warehouse receipts.'
          : action === 'hold'
          ? 'Temporarily placed on hold for press schedule review.'
          : 'Standard production order signoff');

      const res = await api<{ data: Row }>(`/production/print-orders/${detail.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          ['approve', 'return', 'hold', 'cancel', 'complete'].includes(action) ? { note: decisionNote } : {}
        ),
      });

      setDetail(res.data);
      setNote('');
      setNotice(`Print order transition '${human(action)}' succeeded.`);
      await selectOrder(detail.id);
    } catch (err: any) {
      setError(err?.message || `Could not complete '${action}' on order.`);
    } finally {
      setBusy(false);
    }
  }

  // Calculate live WIP quantitative telemetry
  const wipStats = useMemo(() => {
    const plannedQty = Number(detail?.planned_qty || 0);

    // Operations output by stage
    const prepressOutput = operations.filter(o => o.stage === 'prepress').reduce((s, o) => s + Number(o.output_qty || 0), 0);
    const printingOutput = operations.filter(o => o.stage === 'printing').reduce((s, o) => s + Number(o.output_qty || 0), 0);
    const bindingOutput = operations.filter(o => o.stage === 'binding').reduce((s, o) => s + Number(o.output_qty || 0), 0);
    const finishingOutput = operations.filter(o => o.stage === 'finishing').reduce((s, o) => s + Number(o.output_qty || 0), 0);
    const totalDefects = operations.reduce((s, o) => s + Number(o.rejected_qty || 0), 0);

    // QC Inspections
    const totalInspected = inspections.reduce((s, i) => s + Number(i.inspected_qty || 0), 0);
    const totalAccepted = inspections.reduce((s, i) => s + Number(i.effective_accepted_qty || i.accepted_qty || 0), 0);
    const totalQcRejected = inspections.reduce((s, i) => s + Number(i.effective_rejected_qty || i.rejected_qty || 0), 0);

    // Warehouse Goods Receipts
    const postedReceipts = receipts.filter(r => r.status === 'posted');
    const totalStockedQty = postedReceipts.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const stockedPercent = plannedQty > 0 ? Math.min(100, Math.round((totalStockedQty / plannedQty) * 100)) : 0;

    // Material issues
    const postedIssues = materialIssues.filter(i => i.status === 'posted');

    return {
      plannedQty,
      prepressOutput,
      printingOutput,
      bindingOutput,
      finishingOutput,
      totalDefects,
      totalInspected,
      totalAccepted,
      totalQcRejected,
      totalStockedQty,
      stockedPercent,
      postedIssues,
    };
  }, [detail, operations, inspections, receipts, materialIssues]);

  // Compute Dynamic Lifecycle Stages from real WIP operations & database state
  const dynamicStages = useMemo(() => {
    if (!detail) return [];

    const status = detail.status;
    const { plannedQty, finishingOutput, totalAccepted, totalStockedQty, stockedPercent, postedIssues } = wipStats;

    // Stage 1: Order Draft & Setup
    const s1 = {
      id: 'spec_bom',
      title: '1. Specs & BOM',
      desc: detail.spec && detail.bom ? `v${detail.spec.version_no} Spec · v${detail.bom.version_no} BOM` : 'Technical setup required',
      state: detail.spec && detail.bom ? 'completed' : 'pending',
      metric: `${detail.spec?.terms?.trimWidthMm || 148}×${detail.spec?.terms?.trimHeightMm || 210}mm`,
      tag: detail.spec && detail.bom ? '✓ Ready' : 'Setup Required',
      link: '/printing-production/print-specification-sheet',
    };

    // Stage 2: Technical QA & Approval
    const isApprovedOrBeyond = ['approved', 'scheduled', 'in_progress', 'closed', 'complete'].includes(status);
    const s2 = {
      id: 'approval',
      title: '2. Pre-Press Approval',
      desc: isApprovedOrBeyond ? 'Pre-press approval granted' : status === 'pending_approval' ? 'Awaiting signoff' : 'Draft stage',
      state: isApprovedOrBeyond ? 'completed' : status === 'pending_approval' ? 'active' : 'pending',
      metric: isApprovedOrBeyond ? 'Approved' : status === 'pending_approval' ? 'In Review' : 'Draft',
      tag: isApprovedOrBeyond ? '✓ Approved' : status === 'pending_approval' ? '⏳ Reviewing' : 'Pending',
      link: '#',
    };

    // Stage 3: Calendar Scheduling
    const isScheduledOrBeyond = ['scheduled', 'in_progress', 'closed', 'complete'].includes(status);
    const s3 = {
      id: 'scheduling',
      title: '3. Press Schedule',
      desc: isScheduledOrBeyond ? `Scheduled: ${String(detail.planned_start || '').slice(0, 10)} to ${String(detail.due_date || '').slice(0, 10)}` : 'Awaiting calendar slot',
      state: isScheduledOrBeyond ? 'completed' : status === 'approved' ? 'ready' : 'pending',
      metric: detail.planned_start ? String(detail.planned_start).slice(0, 10) : '—',
      tag: isScheduledOrBeyond ? '✓ Scheduled' : status === 'approved' ? '⚡ Ready to Schedule' : 'Pending',
      link: '/printing-production/production-planning-board',
    };

    // Stage 4: Raw Material Floor Issue
    const hasIssuedMaterials = postedIssues.length > 0;
    const hasActiveWip = operations.length > 0 || hasIssuedMaterials;
    const s4 = {
      id: 'materials',
      title: '4. Material Issue',
      desc: hasIssuedMaterials ? `${postedIssues.length} issues posted to floor` : hasActiveWip ? 'Floor materials utilized' : 'Paper & plates pending issue',
      state: hasIssuedMaterials || hasActiveWip ? 'completed' : ['scheduled', 'in_progress'].includes(status) ? 'ready' : 'pending',
      metric: hasIssuedMaterials ? `${postedIssues.length} issues` : (hasActiveWip ? 'Active Floor' : 'Pending'),
      tag: hasIssuedMaterials ? `✓ ${postedIssues.length} Issued` : hasActiveWip ? '✓ Active WIP' : '⚡ Issue Needed',
      link: '/printing-production/material-issue',
    };

    // Stage 5: Press Floor WIP Runs (Printing, Binding, Finishing)
    const isWipFinished = finishingOutput >= plannedQty && plannedQty > 0;
    const hasWipRuns = operations.length > 0;
    const s5 = {
      id: 'wip_ops',
      title: '5. Floor WIP Runs',
      desc: isWipFinished ? `${finishingOutput} copies finished (100%)` : hasWipRuns ? `${finishingOutput} / ${plannedQty} copies finished` : 'Prepress, printing & binding',
      state: isWipFinished ? 'completed' : hasWipRuns ? 'active' : ['scheduled', 'in_progress'].includes(status) ? 'ready' : 'pending',
      metric: finishingOutput > 0 ? `${finishingOutput} finished` : `${operations.length} operations`,
      tag: isWipFinished ? '✓ 100% Finished' : hasWipRuns ? `⏳ ${finishingOutput} Finished` : 'Pending',
      link: '/printing-production/wip-tracking',
    };

    // Stage 6: Quality Control (QC Inspection)
    const isQcFull = totalAccepted >= plannedQty && plannedQty > 0;
    const hasQc = totalAccepted > 0;
    const s6 = {
      id: 'qc',
      title: '6. QC Inspection',
      desc: isQcFull ? `All ${totalAccepted} copies QA passed` : hasQc ? `${totalAccepted} accepted copies ready` : (finishingOutput > 0 ? `${finishingOutput} copies awaiting QC` : 'Defect inspection'),
      state: isQcFull ? 'completed' : hasQc ? 'active' : finishingOutput > 0 ? 'ready' : 'pending',
      metric: totalAccepted > 0 ? `${totalAccepted} passed` : `${inspections.length} inspected`,
      tag: isQcFull ? '✓ 100% QA Passed' : hasQc ? `✓ ${totalAccepted} Passed` : finishingOutput > 0 ? '⚡ Ready for QC' : 'Pending',
      link: '/printing-production/quality-inspection',
    };

    // Stage 7: Warehouse Stock Acceptance
    const isStockedFull = totalStockedQty >= plannedQty && plannedQty > 0;
    const hasStocked = totalStockedQty > 0;
    const s7 = {
      id: 'stock',
      title: '7. Warehouse Stock',
      desc: isStockedFull ? `${totalStockedQty} copies stocked into inventory` : hasStocked ? `${totalStockedQty} / ${plannedQty} copies stocked (${stockedPercent}%)` : (totalAccepted > 0 ? `${totalAccepted} QA copies awaiting receipt` : 'Stock intake'),
      state: isStockedFull ? 'completed' : hasStocked ? 'active' : totalAccepted > 0 ? 'ready' : 'pending',
      metric: `${totalStockedQty} / ${plannedQty}`,
      tag: isStockedFull ? '✓ 100% Stocked' : hasStocked ? `🟢 ${totalStockedQty} Stocked (${stockedPercent}%)` : totalAccepted > 0 ? '⚡ Ready to Stock' : 'Pending',
      link: '/printing-production/production-receipt',
    };

    // Stage 8: Order Completion / Closeout
    const isClosed = ['closed', 'complete'].includes(status);
    const s8 = {
      id: 'closeout',
      title: '8. Closeout & Done',
      desc: isClosed ? 'Order closed & financially reconciled' : isStockedFull ? 'Target fulfilled, ready to close' : `In production (${stockedPercent}% fulfilled)`,
      state: isClosed ? 'completed' : isStockedFull ? 'ready' : 'pending',
      metric: isClosed ? 'Closed' : `${stockedPercent}% Fulfilled`,
      tag: isClosed ? '✓ Closed' : isStockedFull ? '🏁 Ready to Close' : 'In Progress',
      link: '/printing-production/production-variance-review',
    };

    return [s1, s2, s3, s4, s5, s6, s7, s8];
  }, [detail, wipStats, operations, inspections, receipts, materialIssues]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }} suppressHydrationWarning>
      {/* Page Header & Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <Link href="/printing-production/print-order-list" style={{ color: '#2563eb', textDecoration: 'none' }}>
              ← Print Orders List
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <Link href="/printing-production/production-planning-board" style={{ color: '#2563eb', textDecoration: 'none' }}>
              Planning Board
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b' }}>Order Execution Workspace</span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🖨️</span> Print Order Detail
          </h1>
          <p className="muted" style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Dynamic end-to-end production control: physical specs, BOM requirements, press scheduling, and live WIP telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void selectOrder(selectedOrderId)}
            disabled={loading}
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}
          >
            🔄 Refresh
          </button>
          <Link
            href="/printing-production/create-print-order"
            className="btn"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}
          >
            + New Print Order
          </Link>
          <Link
            href="/printing-production/wip-tracking"
            className="btn"
            style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', textDecoration: 'none', fontWeight: 600 }}
          >
            ⚙️ WIP Tracking ➔
          </Link>
          <Link
            href="/printing-production/production-receipt"
            className="btn"
            style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#047857', textDecoration: 'none', fontWeight: 700 }}
          >
            📥 Stock to Warehouse ➔
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#dcfce7', border: '1px solid #4ade80', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ {notice}</span>
          <button type="button" onClick={() => setNotice('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Order Selector Card */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: '1 1 340px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Select Active Print Order to Inspect & Manage
            </label>
            <select
              className="input"
              value={selectedOrderId}
              onChange={e => void selectOrder(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: '0.9rem' }}
            >
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.print_order_number} — {o.book_title} (Ed. {o.edition_number} · {human(o.status)} · {o.planned_qty} copies)
                </option>
              ))}
            </select>
          </div>

          {detail && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Current Status</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '50px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    background:
                      detail.status === 'in_progress'
                        ? '#dcfce7'
                        : detail.status === 'scheduled'
                        ? '#eff6ff'
                        : detail.status === 'approved'
                        ? '#f0fdf4'
                        : detail.status === 'closed' || detail.status === 'complete'
                        ? '#e2e8f0'
                        : '#fef3c7',
                    color:
                      detail.status === 'in_progress'
                        ? '#166534'
                        : detail.status === 'scheduled'
                        ? '#1e40af'
                        : detail.status === 'approved'
                        ? '#15803d'
                        : detail.status === 'closed' || detail.status === 'complete'
                        ? '#334155'
                        : '#92400e',
                  }}
                >
                  {detail.status === 'in_progress'
                    ? '🟢 In Progress (Floor WIP Active)'
                    : detail.status === 'closed' || detail.status === 'complete'
                    ? '🏁 Complete & Closed'
                    : human(detail.status)}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Run Priority</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: detail.priority === 'urgent' ? '#fee2e2' : '#f1f5f9',
                    color: detail.priority === 'urgent' ? '#991b1b' : '#334155',
                  }}
                >
                  {human(detail.priority)}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DYNAMIC PRODUCTION LIFECYCLE PROGRESS STEPPER */}
      {detail && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                ⚡ Dynamic Production Lifecycle & WIP Stepper
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Live reflection of physical pre-press, printing, binding, QA inspection, and warehouse stock acceptance.
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
              Fulfillment: {wipStats.totalStockedQty} / {wipStats.plannedQty} copies ({wipStats.stockedPercent}%)
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', alignItems: 'stretch' }}>
            {dynamicStages.map(st => {
              const isDone = st.state === 'completed';
              const isActive = st.state === 'active';
              const isReady = st.state === 'ready';

              const bgColor = isDone ? '#f0fdf4' : isActive ? '#eff6ff' : isReady ? '#fffbeb' : '#f8fafc';
              const borderColor = isDone ? '#86efac' : isActive ? '#3b82f6' : isReady ? '#fde68a' : '#e2e8f0';
              const badgeBg = isDone ? '#dcfce7' : isActive ? '#dbeafe' : isReady ? '#fef3c7' : '#f1f5f9';
              const badgeColor = isDone ? '#166534' : isActive ? '#1e40af' : isReady ? '#92400e' : '#64748b';

              return (
                <div
                  key={st.id}
                  style={{
                    padding: '0.85rem 0.65rem',
                    borderRadius: '8px',
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: isDone ? '#16a34a' : isActive ? '#2563eb' : isReady ? '#d97706' : '#cbd5e1',
                          color: '#fff',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isDone ? '✓' : isActive ? '⏳' : isReady ? '⚡' : '○'}
                      </span>

                      <span
                        style={{
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          background: badgeBg,
                          color: badgeColor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {st.tag}
                      </span>
                    </div>

                    <strong style={{ display: 'block', fontSize: '0.825rem', color: isDone ? '#166534' : isActive ? '#1e40af' : '#0f172a', marginBottom: '0.2rem' }}>
                      {st.title}
                    </strong>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', lineHeight: 1.3 }}>
                      {st.desc}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Metric</span>
                    <strong style={{ fontSize: '0.75rem', color: '#334155' }}>{st.metric}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dynamic Overall Fulfillment Progress Bar */}
          <div style={{ marginTop: '1.25rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 600, color: '#334155' }}>
                Order Physical Stock Fulfillment Progress ({wipStats.stockedPercent}%):
              </span>
              <strong style={{ color: wipStats.totalStockedQty > 0 ? '#16a34a' : '#64748b' }}>
                {wipStats.totalStockedQty.toLocaleString()} / {wipStats.plannedQty.toLocaleString()} Copies Stocked
              </strong>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${wipStats.stockedPercent}%`,
                  background: wipStats.stockedPercent >= 100 ? '#16a34a' : '#3b82f6',
                  borderRadius: '999px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* LIVE WIP FLOOR STAGE DRILLDOWN & OUTPUT PIPELINE */}
      {detail && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>⚙️</span> Live WIP Operations Pipeline (Floor Tracking)
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Real-time operational output count recorded at each press and post-press station.
              </span>
            </div>
            <Link
              href="/printing-production/wip-tracking"
              className="btn"
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}
            >
              + Log Operation Run in WIP Tracking ➔
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
            {/* Stage A: Pre-press */}
            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Stage 1: Pre-Press</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {wipStats.prepressOutput} plates
              </div>
              <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>✓ Plates imaged & checked</span>
            </div>

            {/* Stage B: Printing */}
            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Stage 2: Press Run</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                {wipStats.printingOutput} sheets
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Offset sheetfed press runs</span>
            </div>

            {/* Stage C: Binding */}
            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Stage 3: Binding</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.2rem' }}>
                {wipStats.bindingOutput} copies
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Folding, gathering & adhesive</span>
            </div>

            {/* Stage D: Finishing */}
            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Stage 4: Finishing</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                {wipStats.finishingOutput} copies
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>3-knife trim & lamination</span>
            </div>

            {/* Stage E: QC Inspection */}
            <div style={{ padding: '0.85rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '0.75rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700 }}>Stage 5: QA Passed</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                {wipStats.totalAccepted} copies
              </div>
              <span style={{ fontSize: '0.75rem', color: '#166534' }}>
                ({wipStats.totalQcRejected} rejected scrap)
              </span>
            </div>

            {/* Stage F: In Warehouse */}
            <div style={{ padding: '0.85rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '0.75rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Stage 6: Warehouse Stock</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e40af', marginTop: '0.2rem' }}>
                {wipStats.totalStockedQty} copies
              </div>
              <span style={{ fontSize: '0.75rem', color: '#1e40af' }}>
                In {detail.target_warehouse_name || 'Main Warehouse'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* LIFECYCLE STATUS EXPLANATION & ACTION CONTROLS */}
      {detail && (
        <section style={{ background: '#f8fafc', borderRadius: '10px', padding: '1.25rem', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🚦</span> Print Order Status Controls & Lifecycle Rules
              </h2>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                When status transitions occur and how to change status between <strong>Scheduled</strong>, <strong>In Progress</strong>, and <strong>Complete</strong>.
              </p>
            </div>
          </div>

          {/* Explanation Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#2563eb', display: 'block', marginBottom: '0.2rem' }}>📅 When is status "Scheduled"?</strong>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.4 }}>
                When an approved print order is assigned a planned start date, due date, and capacity slot on the press schedule.
              </p>
            </div>

            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#16a34a', display: 'block', marginBottom: '0.2rem' }}>⚙️ When is status "In Progress"?</strong>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.4 }}>
                Automatically when raw materials are issued or the first WIP operation run is logged on the press floor (or via "Start Floor Run" button).
              </p>
            </div>

            <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>🏁 When is status "Complete / Closed"?</strong>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.4 }}>
                When the target copies (500 copies) have been received into the warehouse inventory and final closeout is executed.
              </p>
            </div>
          </div>

          {/* Action Buttons for Changing Status */}
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Current Status: </span>
              <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{human(detail.status).toUpperCase()}</strong>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Draft actions */}
              {canManage && detail.status === 'draft' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void act('submit')}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem' }}
                >
                  🚀 Submit Order for Approval
                </button>
              )}

              {/* Pending approval actions */}
              {canApprove && detail.status === 'pending_approval' && (
                <>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void act('return')}
                    style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    ↩️ Return to Draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void act('approve')}
                    style={{ background: '#10b981', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    ✅ Approve Order
                  </button>
                </>
              )}

              {/* Approved actions */}
              {canManage && detail.status === 'approved' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void act('schedule')}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  📅 Schedule Order for Press Floor
                </button>
              )}

              {/* Scheduled actions */}
              {canManage && detail.status === 'scheduled' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void act('start')}
                    style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                  >
                    ▶️ Start Floor Operations (Mark In Progress)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void act('hold')}
                    style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    ⏸️ Place on Hold
                  </button>
                </>
              )}

              {/* In Progress actions */}
              {canManage && detail.status === 'in_progress' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void act('complete')}
                    style={{ background: '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem' }}
                  >
                    🏁 Mark Complete & Close Order
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void act('hold')}
                    style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    ⏸️ Place on Hold
                  </button>
                </>
              )}

              {/* On Hold actions */}
              {canManage && detail.status === 'on_hold' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void act('resume')}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  ▶️ Resume Active Schedule
                </button>
              )}

              {/* Closed status badge */}
              {['closed', 'complete'].includes(detail.status) && (
                <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>
                  ✓ Order Archived & Closed
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Main Order Details & Specifications Grid */}
      {detail && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Card 1: Core Order Parameters */}
          <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📄</span> Print Order Specifications
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Book Title:</span>
                <strong style={{ color: '#0f172a' }}>{detail.book_title} (Ed. {detail.edition_number})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Planned Run Quantity:</span>
                <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{Number(detail.planned_qty).toLocaleString()} copies</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Run Type:</span>
                <strong style={{ color: '#0f172a' }}>{human(detail.run_type)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Printer / Facility:</span>
                <strong style={{ color: '#0f172a' }}>{detail.printer_name || 'Internal Press Facility'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Target Warehouse:</span>
                <strong style={{ color: '#0f172a' }}>{detail.target_warehouse_name || 'DEMO | Dhaka Main Warehouse'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Timeline Schedule:</span>
                <span>
                  Start <strong>{String(detail.planned_start || '').slice(0, 10)}</strong> · Due <strong>{String(detail.due_date || '').slice(0, 10)}</strong>
                </span>
              </div>
              {canCost && detail.estimated_cost != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.2rem' }}>
                  <span style={{ color: '#64748b' }}>Budgeted Estimated Cost:</span>
                  <strong style={{ color: '#0f172a' }}>BDT {Number(detail.estimated_cost).toLocaleString()} {detail.currency_code}</strong>
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Physical Specs & BOM Snapshot */}
          <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📐</span> Approved Physical Specification & BOM
            </h2>

            {detail.spec ? (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                    Physical Specification (v{detail.spec.version_no})
                  </strong>
                  <Link href="/printing-production/print-specification-sheet" style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 600 }}>
                    View Full Spec ➔
                  </Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Trim Dimensions: </span>
                    <strong>{detail.spec.terms?.trimWidthMm} × {detail.spec.terms?.trimHeightMm} mm</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Interior Pages: </span>
                    <strong>{detail.spec.terms?.interiorPages} pp ({detail.spec.terms?.interiorColors} Color)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Interior Stock: </span>
                    <strong>{detail.spec.terms?.interiorPaperGsm} GSM Book Paper</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Cover Stock: </span>
                    <strong>{detail.spec.terms?.coverPaperGsm} GSM ({detail.spec.terms?.coverColors} Color)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Binding: </span>
                    <strong>{human(detail.spec.terms?.bindingType)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Finishing: </span>
                    <strong>{detail.spec.terms?.finishing || 'Standard Trimming'}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '6px', color: '#92400e', fontSize: '0.8rem', marginBottom: '1rem' }}>
                ⚠️ No approved specification linked.
              </div>
            )}

            {detail.bom ? (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                    Bill of Materials (BOM v{detail.bom.version_no})
                  </strong>
                  <Link href="/printing-production/bom-and-material-requirement" style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 600 }}>
                    View Full BOM ➔
                  </Link>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>
                  Defines raw paper sheets, printing ink, binding glue, and laminates per copy with allowance for scrap wastage.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ padding: '0.2rem 0.5rem', background: '#e2e8f0', borderRadius: '4px', fontWeight: 600 }}>
                    {detail.bom.terms?.lines?.length || 0} Material Components
                  </span>
                  <span style={{ padding: '0.2rem 0.5rem', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: 700 }}>
                    ✓ Approved Version
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '6px', color: '#92400e', fontSize: '0.8rem' }}>
                ⚠️ No approved BOM linked.
              </div>
            )}
          </section>
        </div>
      )}

      {/* Raw Material Requirements & Availability Table */}
      {detail && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📦</span> Raw Material Requirements & Store Availability
              </h2>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Calculated demand based on {detail.planned_qty} copies + scrap wastage allowances.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '50px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: detail.materialReady ? '#dcfce7' : '#fee2e2',
                  color: detail.materialReady ? '#166534' : '#991b1b',
                }}
              >
                {detail.materialReady ? '🟢 All Materials Available in Store' : '⚠️ Material Shortage Detected'}
              </span>

              <Link
                href="/printing-production/material-issue"
                className="btn btn-primary"
                style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', padding: '0.4rem 0.85rem', textDecoration: 'none', borderRadius: '5px' }}
              >
                📦 Issue Materials to Press Floor ➔
              </Link>
            </div>
          </div>

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Material Item</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Source Store</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Gross Required</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#16a34a' }}>Issued to Floor</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Remaining to Issue</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Store Available</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Shortage</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.requirements && detail.requirements.length > 0 ? (
                  detail.requirements.map((line: Row, index: number) => {
                    const hasShortage = Number(line.shortageQty || 0) > 0;
                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                          {line.itemCode}
                          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>
                            {line.itemName}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                          {line.warehouseCode}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          {line.requiredQty} {line.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>
                          {line.issuedQty} {line.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>
                          {line.remainingQty} {line.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#2563eb', fontWeight: 600 }}>
                          {line.availableQty} {line.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: hasShortage ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          {hasShortage ? `${line.shortageQty} ${line.uom}` : '0.0000'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: hasShortage ? '#fee2e2' : '#dcfce7',
                              color: hasShortage ? '#991b1b' : '#166534',
                            }}
                          >
                            {hasShortage ? '⚠️ Shortage' : '✓ In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No raw material requirements recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Order Events & Audit Trail */}
      {detail && (
        <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
            📜 Order Lifecycle Audit Trail & Events ({detail.events?.length || 0})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {detail.events && detail.events.length > 0 ? (
              detail.events.map((event: Row, index: number) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.825rem',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0f172a' }}>{event.action}</strong>
                    {event.details?.note && (
                      <span style={{ color: '#475569', marginLeft: '0.5rem' }}>
                        — {event.details.note}
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    {String(event.occurred_at || '').slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                No events recorded yet.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
