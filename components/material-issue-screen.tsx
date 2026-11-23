'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Row = Record<string, any>;

const todayDate = () => new Date().toISOString().slice(0, 10);
const futureDate = (days = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const human = (val: string) => String(val || '').replaceAll('_', ' ');

export function MaterialIssueScreen({ screen }: { screen?: Screen }) {
  // Master data
  const [orders, setOrders] = useState<Row[]>([]);
  const [issues, setIssues] = useState<Row[]>([]);
  const [returns, setReturns] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [rawItems, setRawItems] = useState<Row[]>([]);

  // Selected Order context
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderDetail, setOrderDetail] = useState<Row | null>(null);
  const [reservations, setReservations] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // Permissions & UI states
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filtering & Tabs
  const [activeTab, setActiveTab] = useState<'issues' | 'bom' | 'reservations' | 'returns'>('issues');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [activeIssueDetail, setActiveIssueDetail] = useState<Row | null>(null);

  // Issue Form state
  const [formOrderId, setFormOrderId] = useState('');
  const [formBatchId, setFormBatchId] = useState('');
  const [formMaterialKey, setFormMaterialKey] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formReference, setFormReference] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formMaterialLots, setFormMaterialLots] = useState<Row[]>([]);
  const [formLotKey, setFormLotKey] = useState('');

  // Batch Form state
  const [batchRef, setBatchRef] = useState('');
  const [batchPlannedQty, setBatchPlannedQty] = useState(1000);
  const [batchPlannedStart, setBatchPlannedStart] = useState(todayDate());
  const [batchPlannedEnd, setBatchPlannedEnd] = useState(futureDate(14));

  // Release reservation state
  const [releaseNote, setReleaseNote] = useState('');

  // Return state
  const [returnIssueLineId, setReturnIssueLineId] = useState('');
  const [returnRef, setReturnRef] = useState('');
  const [returnQty, setReturnQty] = useState('1');
  const [returnReason, setReturnReason] = useState('');

  // Load baseline data
  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [orderRes, issueRes, returnRes, whRes, itemRes, meRes] = await Promise.all([
        api<{ data: { data: Row[] } }>('/production/print-orders?limit=100&offset=0'),
        api<{ data: Row[] }>('/production/material-issues'),
        api<{ data: Row[] }>('/production/material-returns'),
        api<{ data: Row[] }>('/warehouses'),
        api<{ data: Row[] }>('/items'),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me'),
      ]);

      setOrders(orderRes.data.data || []);
      setIssues(issueRes.data || []);
      setReturns(returnRes.data || []);
      setWarehouses(whRes.data || []);
      setRawItems((itemRes.data || []).filter(i => i.item_type === 'raw_material'));

      const isAllowed = (p: string) => meRes.data.role === 'Owner' || (meRes.data.permissions || []).includes(p);
      setCanManage(isAllowed('production.manage'));
      setCanApprove(isAllowed('production.approve'));

      // If there's an active selected order, refresh its details
      if (selectedOrderId) {
        await selectOrder(selectedOrderId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load material issue records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  // Select an order and fetch live BOM requirements, reservations, and batches
  async function selectOrder(id: string) {
    setSelectedOrderId(id);
    setOrderDetail(null);
    setReservations([]);
    setBatches([]);
    setSelectedBatchId('');
    setError('');

    if (!id) return;

    try {
      const [orderRes, resRes, batchRes] = await Promise.all([
        api<{ data: Row }>(`/production/print-orders/${id}`),
        api<{ data: Row[] }>(`/production/print-orders/${id}/reservations`),
        api<{ data: Row[] }>(`/production/batches?orderId=${encodeURIComponent(id)}`),
      ]);

      setOrderDetail(orderRes.data);
      setReservations(resRes.data || []);
      const bList = batchRes.data || [];
      setBatches(bList);

      const openBatch = bList.find((b: Row) => b.status === 'open');
      if (openBatch) {
        setSelectedBatchId(openBatch.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load print order requirements.');
    }
  }

  // Pre-fill and open Create Issue Modal
  async function handleOpenCreateIssue(preselectedMaterialKey?: string) {
    setError('');
    setNotice('');
    const ordId = selectedOrderId || (orders.length > 0 ? orders[0].id : '');
    setFormOrderId(ordId);

    // Auto-generate reference
    const orderObj = orders.find(o => o.id === ordId);
    const orderNum = orderObj ? orderObj.print_order_number : 'PO';
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormReference(`ISS-${orderNum}-${rand}`);
    setFormNote('');

    setShowIssueModal(true);

    if (ordId) {
      await handleModalOrderChange(ordId, preselectedMaterialKey);
    }
  }

  // Handle switching order inside the modal
  async function handleModalOrderChange(newOrderId: string, preselectedMaterialKey?: string) {
    setFormOrderId(newOrderId);
    if (!newOrderId) {
      setFormMaterialKey('');
      setFormBatchId('');
      return;
    }

    try {
      const [orderRes, resRes, batchRes] = await Promise.all([
        api<{ data: Row }>(`/production/print-orders/${newOrderId}`),
        api<{ data: Row[] }>(`/production/print-orders/${newOrderId}/reservations`),
        api<{ data: Row[] }>(`/production/batches?orderId=${encodeURIComponent(newOrderId)}`),
      ]);

      const details = orderRes.data;
      setOrderDetail(details);
      setReservations(resRes.data || []);
      const bList = batchRes.data || [];
      setBatches(bList);

      // Pre-select open batch
      const openBatch = bList.find((b: Row) => b.status === 'open') || bList[0];
      if (openBatch) {
        setFormBatchId(openBatch.id);
      } else {
        setFormBatchId('');
      }

      // Pre-select material
      const reqs = details.requirements || [];
      if (preselectedMaterialKey) {
        setFormMaterialKey(preselectedMaterialKey);
        const line = reqs.find((r: Row) => `${r.itemId}:${r.warehouseId}` === preselectedMaterialKey);
        if (line) {
          setFormQuantity(String(Number(line.remainingQty) > 0 ? line.remainingQty : '1'));
        }
      } else if (reqs.length > 0) {
        const availableLine = reqs.find((r: Row) => Number(r.remainingQty) > 0) || reqs[0];
        const key = `${availableLine.itemId}:${availableLine.warehouseId}`;
        setFormMaterialKey(key);
        setFormQuantity(String(Number(availableLine.remainingQty) > 0 ? availableLine.remainingQty : '1'));
      } else {
        setFormMaterialKey('');
        setFormQuantity('1');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load order details for material issue.');
    }
  }

  // Auto-setup BOM and spec for orders that lack them
  async function handleAutoSetupBomForOrder(targetOrderId: string) {
    if (!targetOrderId) return;
    setBusy(true);
    setError('');
    try {
      // Find order
      const orderObj = orders.find(o => o.id === targetOrderId) || orderDetail;
      if (!orderObj?.edition_id) throw new Error('Edition not found for this print order');

      // 1. Create or get approved spec
      const specRef = `SPEC-${orderObj.print_order_number || 'AUTO'}`;
      let specRes = await api<{ data: Row }>('/production/specifications', {
        method: 'POST',
        body: JSON.stringify({
          specRef,
          editionId: orderObj.edition_id,
          printingMethod: 'offset',
          interiorPages: 240,
          trimWidthMm: 148,
          trimHeightMm: 210,
          interiorPaperGsm: 70,
          interiorColors: 1,
          coverPaperGsm: 300,
          coverColors: 4,
          bindingType: 'perfect',
          finishing: 'Matte Lamination',
        }),
      }).catch(async () => {
        const list = await api<{ data: Row[] }>(`/production/specifications?editionId=${orderObj.edition_id}`);
        return { data: list.data[0] };
      });

      const specMaster = specRes.data;
      const specVer = (specMaster.versions || []).find((v: Row) => v.status === 'approved') || (specMaster.versions || [])[0];
      if (specVer && specVer.status !== 'approved') {
        if (specVer.status === 'draft') {
          await api(`/production/specifications/${specMaster.id}/versions/${specVer.id}/submit`, { method: 'POST', body: '{}' }).catch(() => {});
        }
        await api(`/production/specifications/${specMaster.id}/versions/${specVer.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ note: 'Approved standard spec for print production' }),
        }).catch(() => {});
      }

      // 2. Ensure raw warehouse and raw materials
      const primaryWh = warehouses.find(w => !['quarantine', 'consignment', 'wip'].includes(w.warehouse_type)) || warehouses[0];
      const rawItem = rawItems[0] || (await api<{ data: Row[] }>('/items')).data.find((i: Row) => i.item_type === 'raw_material');

      if (!primaryWh || !rawItem) {
        throw new Error('Please ensure at least one raw warehouse and raw material item exist in the ERP.');
      }

      // 3. Create or get approved BOM
      const bomRef = `BOM-${orderObj.print_order_number || 'AUTO'}`;
      let bomRes = await api<{ data: Row }>('/production/boms', {
        method: 'POST',
        body: JSON.stringify({
          bomRef,
          editionId: orderObj.edition_id,
          lines: [
            {
              itemId: rawItem.id,
              warehouseId: primaryWh.id,
              quantityPerCopy: 0.08,
              wastagePercent: 5,
              notes: 'Primary interior book paper stock',
            },
          ],
        }),
      }).catch(async () => {
        const list = await api<{ data: Row[] }>(`/production/boms?editionId=${orderObj.edition_id}`);
        return { data: list.data[0] };
      });

      const bomMaster = bomRes.data;
      const bomVer = (bomMaster.versions || []).find((v: Row) => v.status === 'approved') || (bomMaster.versions || [])[0];
      if (bomVer && bomVer.status !== 'approved') {
        if (bomVer.status === 'draft') {
          await api(`/production/boms/${bomMaster.id}/versions/${bomVer.id}/submit`, { method: 'POST', body: '{}' }).catch(() => {});
        }
        await api(`/production/boms/${bomMaster.id}/versions/${bomVer.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ note: 'Approved standard BOM for production issue' }),
        }).catch(() => {});
      }

      // 4. Update the print order draft or schedule it
      if (orderObj.status === 'draft') {
        await api(`/production/print-orders/${targetOrderId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            printOrderNumber: orderObj.print_order_number,
            editionId: orderObj.edition_id,
            specVersionId: specVer.id,
            bomVersionId: bomVer.id,
            plannedQty: orderObj.planned_qty,
            runType: orderObj.run_type || 'first_print',
            printingMethod: orderObj.printing_method || 'offset',
            priority: orderObj.priority || 'normal',
            orderDate: orderObj.order_date ? String(orderObj.order_date).slice(0, 10) : todayDate(),
            plannedStart: orderObj.planned_start ? String(orderObj.planned_start).slice(0, 10) : todayDate(),
            dueDate: orderObj.due_date ? String(orderObj.due_date).slice(0, 10) : futureDate(14),
            targetWarehouseId: primaryWh.id,
            currencyCode: orderObj.currency_code || 'BDT',
            revisionNo: orderObj.revision_no || 1,
          }),
        }).catch(() => {});
      }

      // 5. Ensure batch exists
      const existingBatches = await api<{ data: Row[] }>(`/production/batches?orderId=${targetOrderId}`);
      if (!existingBatches.data || existingBatches.data.length === 0) {
        await api('/production/batches', {
          method: 'POST',
          body: JSON.stringify({
            orderId: targetOrderId,
            batchRef: `BATCH-${orderObj.print_order_number}-01`,
            plannedQty: orderObj.planned_qty,
            plannedStart: todayDate(),
            plannedEnd: futureDate(14),
          }),
        }).catch(() => {});
      }

      setNotice('Standard BOM, Physical Spec, and Production Batch linked successfully!');
      await handleModalOrderChange(targetOrderId);
      await loadInitial();
      if (selectedOrderId) await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to auto-setup BOM.');
    } finally {
      setBusy(false);
    }
  }

  // Load lots whenever form material key changes
  useEffect(() => {
    setFormLotKey('');
    setFormMaterialLots([]);
    if (!formMaterialKey) return;

    const [itemId, warehouseId] = formMaterialKey.split(':');
    if (!itemId || !warehouseId) return;

    void api<{ data: Row[] }>(`/inventory/lots?itemId=${encodeURIComponent(itemId)}&warehouseId=${encodeURIComponent(warehouseId)}`)
      .then(res => setFormMaterialLots(res.data || []))
      .catch(() => setFormMaterialLots([]));
  }, [formMaterialKey]);

  // Handle Create Issue Submit
  async function submitCreateIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!formOrderId || !formBatchId || !formMaterialKey) {
      setError('Please select an order, an open batch, and a BOM material.');
      return;
    }

    const [itemId, warehouseId] = formMaterialKey.split(':');
    const linePayload: Row = {
      itemId,
      warehouseId,
      quantity: formQuantity,
    };

    if (formLotKey) {
      try {
        const [lotNumber, binLocation] = JSON.parse(formLotKey);
        if (lotNumber) linePayload.lotNumber = lotNumber;
        if (binLocation) linePayload.binLocation = binLocation;
      } catch {
        // ignore
      }
    }

    setBusy(true);
    setError('');
    try {
      await api('/production/material-issues', {
        method: 'POST',
        body: JSON.stringify({
          orderId: formOrderId,
          batchId: formBatchId,
          reference: formReference,
          note: formNote,
          lines: [linePayload],
        }),
      });

      setNotice(`Material issue ${formReference} created successfully in Draft.`);
      setShowIssueModal(false);
      await loadInitial();
      if (selectedOrderId) await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to create material issue draft.');
    } finally {
      setBusy(false);
    }
  }

  // Post Issue action (deducts stock and records WIP journal)
  async function handlePostIssue(issueId: string, issueRef: string) {
    if (!confirm(`Post material issue "${issueRef}" to inventory?\n\nThis will permanently deduct raw materials from stock, allocate lots/bins, and book the Work-in-Progress (WIP) accounting journal.`)) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api(`/production/material-issues/${issueId}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      });

      setNotice(`Material issue "${issueRef}" posted successfully. Stock deducted and WIP journal booked.`);
      await loadInitial();
      if (selectedOrderId) await selectOrder(selectedOrderId);
      if (showInspectModal) setShowInspectModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to post material issue.');
    } finally {
      setBusy(false);
    }
  }

  // Open Quick Batch Modal
  function handleOpenCreateBatch() {
    setError('');
    setNotice('');
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
      setError('Select an order before opening a production batch.');
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

      setNotice(`Production batch "${batchRef}" created successfully.`);
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

  // Reserve remaining BOM materials
  async function handleReserveMaterials() {
    if (!selectedOrderId) return;
    setBusy(true);
    setError('');
    try {
      await api(`/production/print-orders/${selectedOrderId}/reserve-materials`, {
        method: 'POST',
        body: '{}',
      });
      setNotice('Remaining BOM materials successfully reserved from available stock.');
      await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to reserve materials.');
    } finally {
      setBusy(false);
    }
  }

  // Release unused reservations
  async function submitReleaseReservations(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || releaseNote.trim().length < 10) {
      setError('A justification note of at least 10 characters is required to release reservations.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api(`/production/print-orders/${selectedOrderId}/release-materials`, {
        method: 'POST',
        body: JSON.stringify({ note: releaseNote.trim() }),
      });
      setNotice('Unused material reservations released back to free warehouse stock.');
      setShowReleaseModal(false);
      setReleaseNote('');
      await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to release reservations.');
    } finally {
      setBusy(false);
    }
  }

  // Schedule Print Order Shortcut (if status is approved/planned)
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

  // Inspect issue details
  async function handleInspectIssue(issueId: string) {
    setError('');
    try {
      const res = await api<{ data: Row }>(`/production/material-issues/${issueId}`);
      setActiveIssueDetail(res.data);
      setShowInspectModal(true);
    } catch (err: any) {
      setError(err?.message || 'Could not load issue lines.');
    }
  }

  // Open Return Modal
  function handleOpenReturn(issueLineId: string, itemCode: string, qty: string) {
    setReturnIssueLineId(issueLineId);
    setReturnRef(`RET-${Math.floor(1000 + Math.random() * 9000)}`);
    setReturnQty(qty || '1');
    setReturnReason('');
    setShowReturnModal(true);
  }

  // Submit Unused Material Return
  async function submitCreateReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnIssueLineId || returnReason.trim().length < 10) {
      setError('Please provide a detailed reason (at least 10 characters) for the unused material return.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/production/material-returns', {
        method: 'POST',
        body: JSON.stringify({
          issueLineId: returnIssueLineId,
          reference: returnRef,
          quantity: returnQty,
          reason: returnReason.trim(),
        }),
      });

      setNotice(`Material return draft "${returnRef}" created.`);
      setShowReturnModal(false);
      await loadInitial();
      if (selectedOrderId) await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to create material return draft.');
    } finally {
      setBusy(false);
    }
  }

  // Post Material Return (restores stock & reverses WIP)
  async function handlePostReturn(returnId: string, ref: string) {
    if (!confirm(`Post unused material return "${ref}" to stock?\n\nThis will restore the materials to warehouse stock and credit WIP back to raw material inventory.`)) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api(`/production/material-returns/${returnId}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      });
      setNotice(`Material return "${ref}" posted to stock and WIP reversed.`);
      await loadInitial();
      if (selectedOrderId) await selectOrder(selectedOrderId);
    } catch (err: any) {
      setError(err?.message || 'Failed to post material return.');
    } finally {
      setBusy(false);
    }
  }

  // Filtered Issues list
  const filteredIssues = useMemo(() => {
    return issues.filter(row => {
      if (selectedOrderId && row.print_order_id !== selectedOrderId) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = String(row.reference || '').toLowerCase().includes(q);
        const matchesOrder = String(row.print_order_number || '').toLowerCase().includes(q);
        const matchesNote = String(row.note || '').toLowerCase().includes(q);
        return matchesRef || matchesOrder || matchesNote;
      }
      return true;
    });
  }, [issues, selectedOrderId, statusFilter, searchQuery]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const relevantIssues = selectedOrderId ? issues.filter(i => i.print_order_id === selectedOrderId) : issues;
    const totalCount = relevantIssues.length;
    const postedCount = relevantIssues.filter(i => i.status === 'posted').length;
    const draftCount = relevantIssues.filter(i => i.status === 'draft').length;
    const activeResCount = reservations.filter(r => r.status === 'active').length;
    return { totalCount, postedCount, draftCount, activeResCount };
  }, [issues, selectedOrderId, reservations]);

  const activeOrderObj = orders.find(o => o.id === selectedOrderId);
  const openBatches = batches.filter(b => b.status === 'open');

  return (
    <div style={{ padding: '0 0 3rem 0' }}>
      {/* Page Header */}
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
              Material Issue & Raw Material Dispatch
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
              Shop Floor & WIP
            </span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Requisition, allocate, and issue raw materials (paper, board, ink, lamination) to the press floor with live stock deduction and WIP capitalization.
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
              onClick={() => handleOpenCreateIssue()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              <span>➕</span> Issue Material to Press
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
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.25rem' }}>
            Total Material Issues
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>{kpis.totalCount}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Recorded for print runs</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#16a34a', marginBottom: '0.25rem' }}>
            Posted & Capitalized
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a' }}>{kpis.postedCount}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Deducted from stock & WIP debited</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#d97706', marginBottom: '0.25rem' }}>
            Draft Issues Pending Post
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#d97706' }}>{kpis.draftCount}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Awaiting store manager post</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', marginBottom: '0.25rem' }}>
            Active Stock Reservations
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563eb' }}>{kpis.activeResCount}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>BOM materials locked in warehouse</div>
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
                <option value="">-- All Print Orders (Global View) --</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.print_order_number} — {o.book_title} ({human(o.status)} · {o.planned_qty} copies)
                  </option>
                ))}
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
              {activeOrderObj.status !== 'scheduled' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleScheduleOrder()}
                  disabled={busy}
                  style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', fontWeight: 600 }}
                  title="Scheduled status is required before issuing raw materials"
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

              {canManage && activeOrderObj.status === 'scheduled' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleReserveMaterials()}
                  disabled={busy}
                  style={{ background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8' }}
                >
                  🔒 Reserve BOM Stock
                </button>
              )}

              {canApprove && reservations.some(r => r.status === 'active') && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowReleaseModal(true)}
                  style={{ background: '#fff1f2', border: '1px solid #fca5a5', color: '#be123c' }}
                >
                  🔓 Release Reservations
                </button>
              )}
            </div>
          )}
        </div>

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
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Due Date</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{activeOrderObj.due_date ? String(activeOrderObj.due_date).slice(0, 10) : 'TBD'}</div>
            </div>
          </div>
        )}
      </section>

      {/* Approved BOM Requirements Table (when order is selected) */}
      {selectedOrderId && orderDetail && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Approved BOM Requirements & Issue Fulfillment
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Total raw materials authorized by the approved BOM vs quantities already issued to the shop floor.
              </p>
            </div>
            {canManage && activeOrderObj?.status === 'scheduled' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenCreateIssue()}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
              >
                ⚡ Issue Material
              </button>
            )}
          </div>

          {orderDetail.requirements && orderDetail.requirements.length > 0 ? (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Raw Material</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Warehouse</th>
                    <th style={{ padding: '0.75rem 1rem' }}>BOM Required</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Free Stock</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Reserved</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Issued to Press</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Remaining</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Fulfillment</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetail.requirements.map((req: Row, idx: number) => {
                    const reqQty = Number(req.requiredQty || 0);
                    const issuedQty = Number(req.issuedQty || 0);
                    const remaining = Number(req.remainingQty || 0);
                    const percent = reqQty > 0 ? Math.min(100, Math.round((issuedQty / reqQty) * 100)) : 0;
                    const materialKey = `${req.itemId}:${req.warehouseId}`;

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          <div>{req.itemName}</div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.itemCode}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {req.warehouseCode}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          {req.requiredQty} {req.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: Number(req.availableQty) > 0 ? '#16a34a' : '#dc2626' }}>
                          {req.availableQty}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#2563eb' }}>
                          {req.reservedQty}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                          {req.issuedQty} {req.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>
                          {remaining.toFixed(4)} {req.uom}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#16a34a' : '#2563eb' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, width: '32px' }}>{percent}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          {canManage && activeOrderObj?.status === 'scheduled' && remaining > 0 ? (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleOpenCreateIssue(materialKey)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                            >
                              ⚡ Issue Stock
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              {remaining <= 0 ? '✓ Fulfilled' : 'Schedule first'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '1.25rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>⚠️ No Bill of Materials (BOM) Linked to this Order</strong>
                <span style={{ fontSize: '0.85rem', color: '#78350f' }}>An approved BOM is required to calculate paper, cover board, and binding requirements before issuing stock.</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void handleAutoSetupBomForOrder(selectedOrderId)}
                style={{ background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 600 }}
              >
                ⚡ Auto-Setup Standard BOM & Stock
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('issues')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'issues' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'issues' ? 700 : 500,
            color: activeTab === 'issues' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          📋 Material Issue Register ({filteredIssues.length})
        </button>

        {selectedOrderId && (
          <button
            type="button"
            onClick={() => setActiveTab('reservations')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'reservations' ? '3px solid #2563eb' : '3px solid transparent',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'reservations' ? 700 : 500,
              color: activeTab === 'reservations' ? '#2563eb' : '#64748b',
              cursor: 'pointer',
            }}
          >
            🔒 Stock Reservations ({reservations.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'returns' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'returns' ? 700 : 500,
            color: activeTab === 'returns' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
          }}
        >
          ↩️ Unused Material Returns ({returns.length})
        </button>
      </div>

      {/* TAB 1: Material Issue Register */}
      {activeTab === 'issues' && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flex: '1 1 300px' }}>
              <input
                className="input"
                type="text"
                placeholder="Search by issue ref, order #, or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <select
                className="input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{ width: '160px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Drafts Only</option>
                <option value="posted">Posted (To WIP)</option>
              </select>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Showing {filteredIssues.length} of {issues.length} material issues
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Issue Reference</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Print Order #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Created At</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Notes</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.length > 0 ? (
                  filteredIssues.map(issue => (
                    <tr key={issue.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        {issue.reference}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: 500, color: '#334155' }}>{issue.print_order_number}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: issue.status === 'posted' ? '#dcfce7' : '#fef3c7',
                          color: issue.status === 'posted' ? '#166534' : '#92400e',
                        }}>
                          {issue.status === 'posted' ? '✓ Posted (To WIP)' : '⏳ Draft Pending Post'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {String(issue.created_at || '').slice(0, 16).replace('T', ' ')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.note || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void handleInspectIssue(issue.id)}
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                          >
                            🔍 Inspect Lines
                          </button>

                          {canApprove && issue.status === 'draft' && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busy}
                              onClick={() => void handlePostIssue(issue.id, issue.reference)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#16a34a', borderColor: '#16a34a' }}
                            >
                              ⚡ Post Issue
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      {loading ? 'Loading material issues...' : 'No material issues found matching your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Reservations */}
      {activeTab === 'reservations' && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Raw Material Stock Reservations
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Quantities locked in warehouse exclusively for print order {activeOrderObj?.print_order_number}.
              </p>
            </div>
            {canManage && activeOrderObj?.status === 'scheduled' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleReserveMaterials()}
                disabled={busy}
              >
                🔒 Reserve Remaining BOM Stock
              </button>
            )}
          </div>

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Material</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Warehouse</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reserved Qty</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Consumed by Issues</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Remaining Locked</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length > 0 ? (
                  reservations.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {r.item_name} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({r.item_code})</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{r.warehouse_code}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{r.quantity}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#16a34a' }}>{r.consumed_qty}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb' }}>{r.remaining_qty}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: r.status === 'active' ? '#e0f2fe' : '#f1f5f9',
                          color: r.status === 'active' ? '#0369a1' : '#64748b',
                        }}>
                          {human(r.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No active material reservations for this order. Click "Reserve Remaining BOM Stock" to lock inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: Returns */}
      {activeTab === 'returns' && (
        <section className="panel" style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Unused Material Returns to Warehouse
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Restores leftover raw stock from the press floor to warehouse inventory and credits WIP accounting.
              </p>
            </div>
          </div>

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Return Reference</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Print Order #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Batch</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Material</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Quantity Returned</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {returns.length > 0 ? (
                  returns.map(ret => (
                    <tr key={ret.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{ret.reference}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{ret.print_order_number}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{ret.batch_ref}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{ret.item_code} ({ret.warehouse_code})</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>{ret.quantity}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{ret.reason}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: ret.status === 'posted' ? '#dcfce7' : '#fef3c7',
                          color: ret.status === 'posted' ? '#166534' : '#92400e',
                        }}>
                          {human(ret.status)}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        {canApprove && ret.status === 'draft' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy}
                            onClick={() => void handlePostReturn(ret.id, ret.reference)}
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                          >
                            Post Return
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No material returns recorded. To return unused paper, inspect a posted issue and click "Return Unused".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================
          MODAL 1: Create Material Issue
      ======================================================== */}
      {showIssueModal && (
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
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  Issue Material to Press Floor
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Allocates raw stock from warehouse and prepares the WIP capitalization journal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitCreateIssue} style={{ padding: '1.5rem' }}>
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
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.print_order_number} — {o.book_title} ({human(o.status)})
                      </option>
                    ))}
                  </select>
                  {orderDetail && orderDetail.status !== 'scheduled' && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef3c7', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', color: '#92400e' }}>
                      <span>⚠️ Order is {human(orderDetail.status)}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api(`/production/print-orders/${formOrderId}/fast-schedule`, { method: 'POST', body: '{}' });
                            await handleModalOrderChange(formOrderId);
                          } catch (err: any) {
                            setError(err?.message || 'Failed to schedule');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ⚡ Schedule Order
                      </button>
                    </div>
                  )}
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
                    onChange={e => setFormBatchId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Select Open Batch --</option>
                    {batches.filter(b => b.status === 'open').map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batch_ref} ({b.planned_qty} copies)
                      </option>
                    ))}
                  </select>
                  {batches.filter(b => b.status === 'open').length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
                      ⚠️ No open batch for this order. Click "➕ Quick Batch" to open one.
                    </div>
                  )}
                </div>

                {/* Raw Material (from BOM) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      BOM Raw Material Line <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <Link
                      href="/printing-production/bom-and-material-requirement"
                      target="_blank"
                      style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                    >
                      ➕ BOM Register
                    </Link>
                  </div>

                  {orderDetail?.requirements && orderDetail.requirements.length > 0 ? (
                    <select
                      className="input"
                      required
                      value={formMaterialKey}
                      onChange={e => {
                        setFormMaterialKey(e.target.value);
                        if (orderDetail?.requirements) {
                          const line = orderDetail.requirements.find((r: Row) => `${r.itemId}:${r.warehouseId}` === e.target.value);
                          if (line && Number(line.remainingQty) > 0) {
                            setFormQuantity(String(line.remainingQty));
                          }
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Choose BOM Material --</option>
                      {orderDetail.requirements.map((req: Row) => (
                        <option key={`${req.itemId}:${req.warehouseId}`} value={`${req.itemId}:${req.warehouseId}`}>
                          {req.itemName} ({req.itemCode}) — Req: {req.requiredQty} {req.uom} | Free: {req.availableQty} | Rem: {req.remainingQty} {req.uom}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: '0.85rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                        ⚠️ <strong>No BOM linked to this order.</strong> Raw materials must be configured in an approved BOM before issuing.
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || !formOrderId}
                        onClick={() => void handleAutoSetupBomForOrder(formOrderId)}
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem', background: '#7c3aed', borderColor: '#7c3aed' }}
                      >
                        ⚡ Auto-Setup Standard BOM & Stock
                      </button>
                    </div>
                  )}
                </div>

                {/* Issue Quantity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      Issue Quantity <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    {orderDetail?.requirements && formMaterialKey && (
                      <button
                        type="button"
                        onClick={() => {
                          const line = orderDetail.requirements.find((r: Row) => `${r.itemId}:${r.warehouseId}` === formMaterialKey);
                          if (line && line.remainingQty > 0) setFormQuantity(String(line.remainingQty));
                        }}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ⚡ Fill Remaining
                      </button>
                    )}
                  </div>
                  <input
                    className="input"
                    required
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={formQuantity}
                    onChange={e => setFormQuantity(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Reference */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Issue Reference <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    className="input"
                    required
                    type="text"
                    value={formReference}
                    onChange={e => setFormReference(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Source Lot & Bin (if tracked) */}
                {formMaterialLots.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Source Lot & Bin Location <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      className="input"
                      required
                      value={formLotKey}
                      onChange={e => setFormLotKey(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">-- Select an Available Lot & Bin --</option>
                      {formMaterialLots.map((lot, lIdx) => (
                        <option key={lIdx} value={JSON.stringify([lot.lot_number, lot.bin_location])}>
                          Lot: {lot.lot_number} | Bin: {lot.bin_location || 'General'} | Available: {lot.on_hand_qty}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Dispatch & Press Notes
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Dispatched to Heidelberg Press 1; verified undamaged."
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
                  onClick={() => setShowIssueModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !formBatchId || (formMaterialLots.length > 0 && !formLotKey)}
                  style={{ fontWeight: 600 }}
                >
                  {busy ? 'Saving...' : 'Create Issue Draft'}
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

      {/* ========================================================
          MODAL 3: Inspect Material Issue Details
      ======================================================== */}
      {showInspectModal && activeIssueDetail && (
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
            maxWidth: '680px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Issue Lines: {activeIssueDetail.reference}
                </h3>
                <span style={{
                  display: 'inline-block',
                  marginTop: '0.25rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: activeIssueDetail.status === 'posted' ? '#dcfce7' : '#fef3c7',
                  color: activeIssueDetail.status === 'posted' ? '#166534' : '#92400e',
                }}>
                  {activeIssueDetail.status === 'posted' ? 'Posted to WIP' : 'Draft'}
                </span>
              </div>
              <button type="button" onClick={() => setShowInspectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.25rem' }}>✕</button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#475569' }}>
                <strong>Print Order:</strong> {activeIssueDetail.print_order_number} &nbsp;|&nbsp;
                <strong>Date:</strong> {String(activeIssueDetail.created_at || '').slice(0, 16).replace('T', ' ')}
                {activeIssueDetail.note && <div style={{ marginTop: '0.25rem' }}><strong>Note:</strong> {activeIssueDetail.note}</div>}
              </div>

              <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Material</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Warehouse</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Quantity Issued</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>Lot / Bin</th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeIssueDetail.lines || []).map((line: Row) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>
                          {line.item_name} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({line.item_code})</span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>{line.warehouse_code}</td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#0f172a' }}>{line.quantity}</td>
                        <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {line.lot_number ? `Lot: ${line.lot_number} / Bin: ${line.bin_location || 'Unassigned'}` : 'Untracked'}
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                          {activeIssueDetail.status === 'posted' && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                setShowInspectModal(false);
                                handleOpenReturn(line.id, line.item_code, line.quantity);
                              }}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              ↩️ Return Unused
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                💡 <strong>Financial Impact:</strong> Once posted, this issue generates an automated accounting journal:
                <br />• <code>Debit: Work-in-Progress (WIP) Inventory</code>
                <br />• <code>Credit: Raw Materials Inventory</code>
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn" onClick={() => setShowInspectModal(false)}>Close</button>
              {canApprove && activeIssueDetail.status === 'draft' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handlePostIssue(activeIssueDetail.id, activeIssueDetail.reference)}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  ⚡ Post to Inventory & WIP
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: Release Reservations
      ======================================================== */}
      {showReleaseModal && (
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#be123c' }}>Release Material Reservations</h3>
              <button type="button" onClick={() => setShowReleaseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={submitReleaseReservations} style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: 0 }}>
                This will unlock all reserved BOM raw materials back into free warehouse stock.
              </p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Release Reason / Justification (min 10 characters) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  className="input"
                  required
                  minLength={10}
                  placeholder="e.g. Press run scaled down; materials released for other orders."
                  value={releaseNote}
                  onChange={e => setReleaseNote(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowReleaseModal(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ background: '#be123c', color: '#fff' }} disabled={busy || releaseNote.trim().length < 10}>
                  {busy ? 'Releasing...' : 'Release Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: Unused Material Return
      ======================================================== */}
      {showReturnModal && (
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
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Record Unused Material Return</h3>
              <button type="button" onClick={() => setShowReturnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={submitCreateReturn} style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Return Reference</label>
                <input
                  className="input"
                  required
                  value={returnRef}
                  onChange={e => setReturnRef(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Unused Quantity</label>
                <input
                  className="input"
                  required
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={returnQty}
                  onChange={e => setReturnQty(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Return Reason (min 10 characters) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  className="input"
                  required
                  minLength={10}
                  placeholder="e.g. Leftover cover art card paper returned to warehouse A."
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowReturnModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || returnReason.trim().length < 10}>
                  {busy ? 'Saving...' : 'Create Return Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
