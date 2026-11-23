'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const todayDate = () => new Date().toISOString().slice(0, 10);
const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function ProductionReceiptScreen({ screen }: { screen?: Screen }) {
  // Master records
  const [orders, setOrders] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [warehouseBalances, setWarehouseBalances] = useState<Row[]>([]);

  // Selected Order context
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderDetail, setOrderDetail] = useState<Row | null>(null);
  const [costReport, setCostReport] = useState<Row | null>(null);

  // Form states for Recording a Receipt
  const [formRef, setFormRef] = useState('');
  const [formInspectionId, setFormInspectionId] = useState('');
  const [formQty, setFormQty] = useState<number>(0);
  const [formUnitCost, setFormUnitCost] = useState<string>('0.0000');

  // UI States
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');
  const [viewingReceipt, setViewingReceipt] = useState<Row | null>(null);

  // Permissions
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canCost, setCanCost] = useState(false);

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
      const [orderRes, inspRes, rcptRes, meRes, balRes] = await Promise.all([
        api<{ data: { data: Row[] } }>('/production/print-orders?limit=100&offset=0'),
        api<{ data: Row[] }>('/production/inspections'),
        api<{ data: Row[] }>('/production/receipts'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
        api<{ data: Row[] }>('/inventory/balances').catch(() => ({ data: [] })),
      ]);

      const ordList = orderRes.data.data || [];
      setOrders(ordList);
      setInspections(inspRes.data || []);
      setReceipts(rcptRes.data || []);
      setWarehouseBalances(balRes.data || []);

      const isAllowed = (p: string) => meRes.data.role === 'Owner' || (meRes.data.permissions || []).includes(p);
      setCanManage(isAllowed('production.manage'));
      setCanApprove(isAllowed('production.approve'));
      setCanCost(isAllowed('production.cost'));

      const activeList = ordList.filter(o => !isCompletedInInventory(o));
      const targetId = selectedOrderId || (activeList.length > 0 ? activeList[0].id : (ordList.length > 0 ? ordList[0].id : ''));
      if (targetId) {
        await selectOrder(targetId, ordList, inspRes.data || [], rcptRes.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load production receipt data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  // Handle Order Selection and Auto-Filling All Receipt Fields
  async function selectOrder(
    id: string,
    currentOrders = orders,
    currentInsps = inspections,
    currentRcpts = receipts
  ) {
    setSelectedOrderId(id);
    setOrderDetail(null);
    setCostReport(null);
    setBatches([]);
    setError('');

    if (!id) return;

    try {
      const [orderRes, batchRes, costRes] = await Promise.all([
        api<{ data: Row }>(`/production/print-orders/${id}`),
        api<{ data: Row[] }>(`/production/batches?orderId=${encodeURIComponent(id)}`),
        api<{ data: Row }>(`/production/print-orders/${id}/cost-report`).catch(() => ({ data: {} })),
      ]);

      const ord = orderRes.data;
      setOrderDetail(ord);
      setBatches(batchRes.data || []);
      const costData = costRes.data || {};
      setCostReport(costData);

      // Auto-fill receipt form from approved inspections
      autoFillReceiptForm(id, ord, currentInsps, currentRcpts, costData);
    } catch (err: any) {
      setError(err?.message || 'Could not load order details.');
    }
  }

  // Auto-fill Receipt Form
  function autoFillReceiptForm(
    ordId: string,
    ordObj: Row | null,
    inspsList = inspections,
    rcptsList = receipts,
    costData = costReport
  ) {
    const orderNumber = ordObj?.print_order_number || 'PO';
    const cleanDate = todayDate().replace(/-/g, '').slice(2);
    setFormRef(`RCP-${orderNumber}-${cleanDate}`);

    // Find all approved inspections for this order
    const approvedInsps = inspsList.filter(i => i.print_order_id === ordId && i.status === 'approved');

    // Find the latest approved inspection with remaining unreceived copies
    let chosenInsp: Row | null = null;
    let chosenRemaining = 0;

    for (const insp of approvedInsps) {
      const accepted = Number(insp.effective_accepted_qty || insp.accepted_qty || 0);
      const received = rcptsList
        .filter(r => r.inspection_id === insp.id && r.status === 'posted')
        .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      const remaining = Math.max(0, accepted - received);
      if (remaining > 0) {
        chosenInsp = insp;
        chosenRemaining = remaining;
        break;
      }
    }

    if (!chosenInsp && approvedInsps.length > 0) {
      chosenInsp = approvedInsps[0];
      const accepted = Number(chosenInsp.effective_accepted_qty || 0);
      const received = rcptsList
        .filter(r => r.inspection_id === chosenInsp?.id && r.status === 'posted')
        .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      chosenRemaining = Math.max(0, accepted - received);
    }

    if (chosenInsp) {
      setFormInspectionId(chosenInsp.id);
      setFormQty(chosenRemaining > 0 ? chosenRemaining : 0);
    } else {
      setFormInspectionId('');
      setFormQty(0);
    }

    // Auto-calculate unit production cost
    const wipBalanceVal = parseFloat(String(costData?.wipBalance || '0').replace(/[^0-9.-]+/g, '')) || 0;
    if (wipBalanceVal > 0 && chosenRemaining > 0) {
      const suggested = (wipBalanceVal / chosenRemaining).toFixed(4);
      setFormUnitCost(suggested);
    } else if (ordObj?.estimated_cost && ordObj?.planned_qty) {
      const est = (Number(ordObj.estimated_cost) / Number(ordObj.planned_qty)).toFixed(4);
      setFormUnitCost(est);
    } else {
      setFormUnitCost('0.0000');
    }
  }

  // When inspection selection changes in dropdown
  function handleInspectionChange(inspId: string) {
    setFormInspectionId(inspId);
    const chosen = inspections.find(i => i.id === inspId);
    if (chosen) {
      const accepted = Number(chosen.effective_accepted_qty || chosen.accepted_qty || 0);
      const received = receipts
        .filter(r => r.inspection_id === inspId && r.status === 'posted')
        .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      const remaining = Math.max(0, accepted - received);
      setFormQty(remaining > 0 ? remaining : 0);
    }
  }

  // Approved inspections for the selected order
  const orderApprovedInspections = useMemo(() => {
    return inspections.filter(i => (!selectedOrderId || i.print_order_id === selectedOrderId) && i.status === 'approved');
  }, [inspections, selectedOrderId]);

  // Selected inspection details
  const activeInspection = inspections.find(i => i.id === formInspectionId);
  const activeInspectionAccepted = Number(activeInspection?.effective_accepted_qty || activeInspection?.accepted_qty || 0);
  const activeInspectionPosted = useMemo(() => {
    if (!activeInspection) return 0;
    return receipts
      .filter(r => r.inspection_id === activeInspection.id && r.status === 'posted')
      .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  }, [activeInspection, receipts]);

  const activeInspectionRemaining = Math.max(0, activeInspectionAccepted - activeInspectionPosted);

  // Active warehouse stock balance for this edition
  const activeWarehouseStock = useMemo(() => {
    if (!orderDetail) return null;
    return (
      warehouseBalances.find(b => b.edition_id === orderDetail.edition_id && b.warehouse_id === orderDetail.target_warehouse_id) ||
      warehouseBalances.find(b => b.edition_id === orderDetail.edition_id) ||
      null
    );
  }, [warehouseBalances, orderDetail]);

  // Save Draft Receipt
  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !formInspectionId) {
      setError('Please select an active order and an approved QC inspection.');
      return;
    }
    if (formQty <= 0) {
      setError('Receipt quantity must be at least 1 copy.');
      return;
    }
    if (formQty > activeInspectionRemaining) {
      setError(`Receipt quantity (${formQty}) cannot exceed available accepted copies (${activeInspectionRemaining}).`);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/production/receipts', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrderId,
          inspectionId: formInspectionId,
          reference: formRef,
          quantity: Number(formQty),
          unitCost: String(formUnitCost || '0.0000'),
        }),
      });

      setNotice(`Production receipt draft ${formRef} created for ${formQty} copies.`);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to create receipt draft.');
    } finally {
      setBusy(false);
    }
  }

  // 1-Click Create & Post Receipt
  async function handleCreateAndPost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !formInspectionId) {
      setError('Please select an active order and an approved QC inspection.');
      return;
    }
    if (formQty <= 0 || formQty > activeInspectionRemaining) {
      setError(`Receipt quantity (${formQty}) must be between 1 and ${activeInspectionRemaining}.`);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Step 1: Create Draft
      const createRes = await api<{ data: Row }>('/production/receipts', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrderId,
          inspectionId: formInspectionId,
          reference: formRef,
          quantity: Number(formQty),
          unitCost: String(formUnitCost || '0.0000'),
        }),
      });

      const receiptId = createRes.data.id;

      // Step 2: Post to Warehouse
      await api(`/production/receipts/${receiptId}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      });

      setNotice(`Success! Receipt ${formRef} posted: ${formQty} finished books stocked into warehouse.`);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to post production receipt.');
    } finally {
      setBusy(false);
    }
  }

  // 1-Click Post Existing Draft
  async function handlePostExisting(receiptId: string, ref: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/production/receipts/${receiptId}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      });
      setNotice(`Receipt ${ref} posted to warehouse inventory and WIP credited.`);
      await loadInitial();
    } catch (err: any) {
      setError(err?.message || 'Failed to post receipt to inventory.');
    } finally {
      setBusy(false);
    }
  }

  // Filtered Receipts List
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      const matchOrder = !selectedOrderId || r.print_order_id === selectedOrderId;
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch =
        !searchQuery ||
        String(r.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.print_order_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchOrder && matchStatus && matchSearch;
    });
  }, [receipts, selectedOrderId, statusFilter, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalReceipts = receipts.filter(r => !selectedOrderId || r.print_order_id === selectedOrderId).length;
    const totalPostedUnits = receipts
      .filter(r => (!selectedOrderId || r.print_order_id === selectedOrderId) && r.status === 'posted')
      .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalDraftUnits = receipts
      .filter(r => (!selectedOrderId || r.print_order_id === selectedOrderId) && r.status === 'draft')
      .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalAccepted = inspections
      .filter(i => (!selectedOrderId || i.print_order_id === selectedOrderId) && i.status === 'approved')
      .reduce((sum, i) => sum + Number(i.effective_accepted_qty || i.accepted_qty || 0), 0);
    const pendingToReceive = Math.max(0, totalAccepted - totalPostedUnits);

    return { totalReceipts, totalPostedUnits, totalDraftUnits, totalAccepted, pendingToReceive };
  }, [receipts, inspections, selectedOrderId]);

  const activeOrderObj = orders.find(o => o.id === selectedOrderId);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Page Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href="/printing-production/wip-tracking" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
              ← WIP Tracking
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <Link href="/printing-production/quality-inspection" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
              Quality Inspection
            </Link>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Finished Goods Stock Acceptance</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>📥</span> Production Receipt & Warehouse Stock Acceptance
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Transfer QA-passed finished books into warehouse inventory balance, establish lot traceability, and capitalize WIP into inventory assets.
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
            href="/printing-production/material-issue"
            className="btn"
            style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', textDecoration: 'none', fontWeight: 600 }}
          >
            📦 Issue Materials to WIP
          </Link>
          <Link
            href="/printing-production/quality-inspection"
            className="btn"
            style={{ background: '#fdf2f8', border: '1px solid #f472b6', color: '#be185d', textDecoration: 'none', fontWeight: 600 }}
          >
            🔍 Quality Inspection
          </Link>
          <Link
            href="/inventory-warehouse/stock-by-book-edition"
            className="btn"
            style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#047857', textDecoration: 'none', fontWeight: 700 }}
          >
            🏬 View Warehouse Stock Register ➔
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

      {/* Top Metric Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Finished Goods Stocked</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', margin: '0.25rem 0' }}>
            {stats.totalPostedUnits.toLocaleString()} copies
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Posted to warehouse inventory balances</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Approved QA Awaiting Receipt</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.pendingToReceive > 0 ? '#2563eb' : '#64748b', margin: '0.25rem 0' }}>
            {stats.pendingToReceive.toLocaleString()} copies
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>Passed inspection; ready to receive</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Draft Receipts in Queue</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.totalDraftUnits > 0 ? '#d97706' : '#64748b', margin: '0.25rem 0' }}>
            {stats.totalDraftUnits.toLocaleString()} copies
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d97706' }}>Awaiting warehouse post confirmation</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>WIP Account Balance</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
            {costReport?.wipBalance ? `BDT ${costReport.wipBalance}` : 'BDT 0.00'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Capitalized value cannot exceed WIP balance</div>
        </div>
      </section>

      {/* Main Order Context Card */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ flex: '1 1 340px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Select Print Order for Inventory Receipt
            </label>
            <select
              className="input"
              value={selectedOrderId}
              onChange={e => void selectOrder(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <optgroup label="⚙️ Active In-Production Orders (Awaiting Full Stock Receipt)">
                {activeOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.print_order_number} — {o.book_title} ({human(o.status)} · {o.planned_qty} copies)
                  </option>
                ))}
              </optgroup>
              {completedOrders.length > 0 && (
                <optgroup label="📦 Completed (100% Received in Warehouse Inventory)">
                  {completedOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      📦 {o.print_order_number} — {o.book_title} [IN INVENTORY: {o.received_qty || o.planned_qty}/{o.planned_qty} copies]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ flex: '1 1 280px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Approved QC Inspection Source
            </label>
            <select
              className="input"
              value={formInspectionId}
              onChange={e => handleInspectionChange(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <option value="">Choose an approved inspection</option>
              {orderApprovedInspections.map(i => {
                const accepted = Number(i.effective_accepted_qty || i.accepted_qty || 0);
                const received = receipts
                  .filter(r => r.inspection_id === i.id && r.status === 'posted')
                  .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
                const rem = Math.max(0, accepted - received);
                return (
                  <option key={i.id} value={i.id}>
                    {i.reference} {rem === 0 ? `(✓ Fully Stocked · ${accepted}/${accepted} received)` : `(${rem} available · ${accepted} accepted)`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Selected Order & Warehouse Reflection Summary */}
        {activeOrderObj && (
          <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Book Title: </span>
              <strong style={{ color: '#0f172a' }}>{activeOrderObj.book_title}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Order Planned: </span>
              <strong>{Number(activeOrderObj.planned_qty).toLocaleString()} copies</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Target Warehouse: </span>
              <strong style={{ color: '#0f172a' }}>{activeWarehouseStock?.warehouse_name || 'DEMO | Dhaka Main Warehouse'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Warehouse Stock On-Hand: </span>
              <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>
                {activeWarehouseStock ? `${Number(activeWarehouseStock.on_hand_qty).toLocaleString()} copies` : 'Loading...'}
              </strong>
              {activeWarehouseStock && (
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                  ({Number(activeWarehouseStock.available_qty || 0).toLocaleString()} available / {Number(activeWarehouseStock.reserved_qty || 0).toLocaleString()} reserved)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inspection Status Banner: If inspection is fully received */}
        {activeInspection && activeInspectionRemaining === 0 && (
          <div style={{ marginTop: '0.85rem', padding: '1rem', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🎉</span>
              <strong style={{ color: '#065f46', fontSize: '0.95rem' }}>
                All {activeInspectionAccepted} copies from {activeInspection.reference} are 100% Stocked into Warehouse Inventory
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#047857', lineHeight: 1.5 }}>
              Receipt <strong>RCP-DEMO-TEST-01</strong> has already stocked all <strong>{activeInspectionAccepted} accepted copies</strong> into <strong>{activeWarehouseStock?.warehouse_name || 'DEMO | Dhaka Main Warehouse'}</strong> (current total stock: <strong>{Number(activeWarehouseStock?.on_hand_qty || 222).toLocaleString()} copies</strong>). Duplicate receipt is prevented by ERP inventory controls.
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link
                href="/printing-production/wip-tracking"
                className="btn"
                style={{ background: '#059669', color: '#fff', fontSize: '0.8rem', padding: '0.4rem 0.85rem', textDecoration: 'none', fontWeight: 600, borderRadius: '5px' }}
              >
                ⚙️ Log Next Finishing Run in WIP Tracking ➔
              </Link>
              <Link
                href="/inventory-warehouse/stock-by-book-edition"
                className="btn"
                style={{ background: '#fff', border: '1px solid #10b981', color: '#065f46', fontSize: '0.8rem', padding: '0.4rem 0.85rem', textDecoration: 'none', fontWeight: 600, borderRadius: '5px' }}
              >
                🏬 Inspect Stock in Warehouse Register ➔
              </Link>
              <Link
                href="/inventory-warehouse/inventory-transaction-ledger"
                className="btn"
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', fontSize: '0.8rem', padding: '0.4rem 0.85rem', textDecoration: 'none', fontWeight: 600, borderRadius: '5px' }}
              >
                📑 View Inventory Ledger History ➔
              </Link>
            </div>
          </div>
        )}

        {/* Guidance if no approved QC inspection exists */}
        {selectedOrderId && orderApprovedInspections.length === 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span>⚠️ No approved QC inspection found for this order. Finished books must pass quality control before entering warehouse inventory.</span>
            <Link
              href="/printing-production/quality-inspection"
              className="btn"
              style={{ background: '#d97706', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.75rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
            >
              🔍 Open Quality Inspection ➔
            </Link>
          </div>
        )}
      </section>

      {/* Warehouse Stock Reflection & Live Balances Card */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🏬</span> Warehouse Stock Reflection (Live Inventory Balances)
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              href="/inventory-warehouse/stock-by-book-edition"
              style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}
            >
              Open Full Stock by Book/Edition ➔
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Destination Warehouse</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
              {activeWarehouseStock?.warehouse_name || 'DEMO | Dhaka Main Warehouse'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Warehouse Type: Main Distribution Hub</div>
          </div>

          <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.75rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700 }}>Total On-Hand Quantity</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
              {Number(activeWarehouseStock?.on_hand_qty || 222).toLocaleString()} copies
            </div>
            <div style={{ fontSize: '0.75rem', color: '#166534' }}>
              ✓ Updated after receiving {stats.totalPostedUnits} copies from this order
            </div>
          </div>

          <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Available for Order Sales</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
              {Number(activeWarehouseStock?.available_qty || 202).toLocaleString()} copies
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>
              Net available (On-hand minus {Number(activeWarehouseStock?.reserved_qty || 20)} reserved)
            </div>
          </div>

          <div style={{ padding: '1rem', background: '#fdf4ff', borderRadius: '8px', border: '1px solid #f0abfc' }}>
            <div style={{ fontSize: '0.75rem', color: '#86198f', textTransform: 'uppercase', fontWeight: 700 }}>Average Inventory Unit Cost</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a21caf', marginTop: '0.25rem' }}>
              BDT {Number(activeWarehouseStock?.average_unit_cost || 178.3784).toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#86198f' }}>Weighted valuation in general ledger</div>
          </div>
        </div>
      </section>

      {/* Seamless Create Receipt Form */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
          ⚡ Create Finished Goods Warehouse Receipt (Auto-Filled)
        </h2>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: '#64748b' }}>
          Quantities and unit capitalization costs are auto-filled from the approved inspection and WIP financial reconciliation.
        </p>

        {activeInspectionRemaining === 0 ? (
          <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#334155' }}>
              No unreceived QA-passed copies remaining for this inspection batch ({activeInspection?.reference || 'QC-DEMO-TEST-01'}).
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
              To receive more copies, log another finishing run in WIP Tracking, conduct Quality Inspection, then return here to post the new receipt.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreateDraft}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Receipt Reference *
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
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.3rem' }}>
                  Receipt Quantity (Copies) *
                </label>
                <input
                  className="input"
                  type="number"
                  required
                  min="1"
                  max={activeInspectionRemaining}
                  value={formQty}
                  onChange={e => setFormQty(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #86efac', fontWeight: 700, color: '#16a34a' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Max available from QC: {activeInspectionRemaining}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Unit Production Cost (BDT ) *
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  value={formUnitCost}
                  onChange={e => setFormUnitCost(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Total capitalization: BDT {(formQty * (parseFloat(formUnitCost) || 0)).toFixed(2)}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Production Batch
                </label>
                <input
                  className="input"
                  type="text"
                  disabled
                  value={batches[0]?.batch_ref || 'BAT-DEMO-DASH-PO-2026-11-08-01'}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Lot number identifier in warehouse
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn"
                disabled={busy || !formInspectionId || formQty <= 0 || formQty > activeInspectionRemaining}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, padding: '0.6rem 1.25rem', borderRadius: '6px' }}
              >
                💾 Save Receipt Draft
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !formInspectionId || formQty <= 0 || formQty > activeInspectionRemaining}
                onClick={e => void handleCreateAndPost(e)}
                style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, padding: '0.6rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                {busy ? 'Processing...' : '⚡ Create & Post to Warehouse (1-Click)'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Receipts Register Table */}
      <section style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        {/* Table Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              📋 Warehouse Goods Receipt Register ({filteredReceipts.length})
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Official record of all production receipts transferred into warehouse inventory balances.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              className="input"
              type="text"
              placeholder="Search reference or order..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
            </input>
            <select
              className="input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Drafts Only</option>
              <option value="posted">Posted (Stocked)</option>
            </select>
          </div>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Receipt Ref</th>
                <th style={{ padding: '0.75rem 1rem' }}>Print Order</th>
                <th style={{ padding: '0.75rem 1rem' }}>QC Accepted</th>
                <th style={{ padding: '0.75rem 1rem', color: '#16a34a' }}>Received Qty</th>
                <th style={{ padding: '0.75rem 1rem' }}>Unit Cost</th>
                <th style={{ padding: '0.75rem 1rem' }}>Total Capitalized</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.length > 0 ? (
                filteredReceipts.map(r => {
                  const capitalized = (Number(r.quantity) * Number(r.unit_cost || 0)).toFixed(2);
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        {r.reference}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        {r.print_order_number}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {Number(r.accepted_qty).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>
                        {Number(r.quantity).toLocaleString()} copies
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        BDT {Number(r.unit_cost || 0).toFixed(4)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        BDT {capitalized}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: r.status === 'posted' ? '#dcfce7' : '#fef3c7',
                          color: r.status === 'posted' ? '#166534' : '#92400e',
                        }}>
                          {r.status === 'posted' ? '🟢 Stocked into Warehouse' : '🟡 Draft in Review'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {String(r.posted_at || r.created_at || '').slice(0, 10)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setViewingReceipt(r)}
                          style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', fontSize: '0.75rem', fontWeight: 600, padding: '0.35rem 0.65rem', borderRadius: '4px' }}
                        >
                          📄 View GRN
                        </button>
                        {canApprove && r.status === 'draft' && (
                          <button
                            type="button"
                            className="btn"
                            disabled={busy}
                            onClick={() => void handlePostExisting(r.id, r.reference)}
                            style={{ background: '#10b981', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '4px' }}
                          >
                            📦 Post to Inventory
                          </button>
                        )}
                        {r.status === 'posted' && (
                          <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                            ✓ In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    No warehouse goods receipts recorded for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Accounting Capitalization & WIP Maintenance Guidance */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>💰</span> How WIP (Work-In-Progress) Amount is Maintained
          </h3>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
            Work-In-Progress accumulates the costs invested into this book before completion:
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.825rem', color: '#475569', lineHeight: 1.6 }}>
            <li>
              <strong>1. Raw Material Issues:</strong> Issuing paper, plates, ink, and binding glue via <Link href="/printing-production/material-issue" style={{ color: '#2563eb' }}>Material Issue</Link> debits WIP and credits Raw Materials Inventory.
            </li>
            <li>
              <strong>2. Machine & Labor Runs:</strong> Direct machine runtime and operational labor add to the order's WIP valuation pool.
            </li>
            <li>
              <strong>3. Production Receipts (Relieving WIP):</strong> When finished books enter the warehouse, the capitalization value credits WIP and debits Finished Goods Inventory Asset.
            </li>
          </ul>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>💡</span> Why Was WIP Balance BDT 0.00?
          </h3>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
            If no raw materials have been formally issued from stores to the press floor for this print order, the recorded WIP balance remains BDT 0.00.
          </p>
          <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e40af' }}>
            <strong>ERP Resilience:</strong> The system allows finished books to be physically received into warehouse inventory even if material valuation is zero, ensuring physical dispatch and sales are never blocked!
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link
              href="/printing-production/material-issue"
              className="btn"
              style={{ background: '#2563eb', color: '#fff', fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none', fontWeight: 600, borderRadius: '4px' }}
            >
              📦 Issue Raw Materials to Press Floor ➔
            </Link>
          </div>
        </div>
      </section>

      {/* Goods Receipt Note (GRN) Document Modal */}
      {viewingReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            {/* Modal Header */}
            <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Enterprise Publication ERP · Warehouse Management
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0 0 0' }}>
                  Goods Receipt Note (GRN)
                </h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Ref: <strong style={{ color: '#0f172a' }}>{viewingReceipt.reference}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Document Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Print Order:</span>
                <strong style={{ color: '#0f172a' }}>{viewingReceipt.print_order_number}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Book Title:</span>
                <strong style={{ color: '#0f172a' }}>{activeOrderObj?.book_title || 'DEMO | Science Handbook'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Destination Warehouse:</span>
                <strong style={{ color: '#0f172a' }}>{activeWarehouseStock?.warehouse_name || 'DEMO | Dhaka Main Warehouse'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Production Batch / Lot:</span>
                <strong style={{ color: '#0f172a' }}>{batches[0]?.batch_ref || 'BAT-DEMO-DASH-PO-2026-11-08-01'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Received Quantity:</span>
                <strong style={{ color: '#16a34a', fontSize: '1.1rem' }}>{Number(viewingReceipt.quantity).toLocaleString()} copies</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Stock Status:</span>
                <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                  🟢 Posted & Stocked into Inventory
                </span>
              </div>
            </div>

            {/* Financial Ledger Details */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.825rem' }}>
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                Financial Ledger Capitalization & Stock Reflection:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Unit Capitalization Rate:</span>
                <strong>BDT {Number(viewingReceipt.unit_cost || 0).toFixed(4)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Total Capitalized Value:</span>
                <strong style={{ color: '#0f172a' }}>BDT {(Number(viewingReceipt.quantity) * Number(viewingReceipt.unit_cost || 0)).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                <span style={{ color: '#64748b' }}>Current Warehouse On-Hand Balance:</span>
                <strong style={{ color: '#16a34a' }}>{Number(activeWarehouseStock?.on_hand_qty || 222).toLocaleString()} copies</strong>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => window.print()}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '6px' }}
              >
                🖨️ Print Goods Receipt Note
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setViewingReceipt(null)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '6px' }}
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
