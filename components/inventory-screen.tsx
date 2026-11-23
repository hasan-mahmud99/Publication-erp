"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import { InventoryOpeningPanel } from './inventory-opening-panel';
import { InventoryCountPlanPanel } from './inventory-count-plan-panel';
import { InventorySalesPanel } from './inventory-sales-panel';
import { InventoryLegacyPreviewPanel } from './inventory-legacy-preview-panel';
import { InventoryReorderImportPanel } from './inventory-reorder-import-panel';
import { InventoryOverviewView, type InventoryBalanceRow } from './inventory-overview-view';
import { StockByBookEditionView } from './stock-by-book-edition-view';
import { StockIssueView } from './stock-issue-view';
import { StockTransferView } from './stock-transfer-view';
import { PhysicalStockCountView } from './physical-stock-count-view';
import { StockAgeingView } from './stock-ageing-view';
import { SlowMovingStockView } from './slow-moving-stock-view';
import { InventoryValuationView } from './inventory-valuation-view';
import { BatchLotRegisterView } from './batch-lot-register-view';

type Item = { id: string; item_code: string; name: string; item_type: string; base_uom: string; tracking_policy: string; edition_id: string | null };
type LotBalance = { item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; lot_number: string; bin_location: string | null; on_hand_qty: string };
type Warehouse = { id: string; code: string; name: string; warehouse_type: string; status: string };
type Edition = { id: string; book_title: string; edition_number: string; format: string };
type Balance = InventoryBalanceRow;
type Movement = { id: string; transaction_type: string; document_type: string; document_id: string; status: string; created_at: string; posted_at: string | null };
type MovementLine = { id: string; item_id: string; warehouse_id: string; quantity_delta: string; unit_cost: string | null; lot_number: string | null; bin_location: string | null };
type Reservation = { id: string; item_code: string; warehouse_code: string; quantity: string; consumed_qty: string; status: string; document_type: string; document_id: string; created_at: string };
type Valuation = { item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; on_hand_qty: string; average_unit_cost: string; stock_value: string };
type TransitValuation = { transfer_id: string; item_code: string; source_code: string; destination_code: string; in_transit_qty: string; dispatch_unit_cost: string; stock_value: string; dispatched_at: string };
type Reconciliation = { checked: number; reconciled: boolean; mismatches: Array<{ item_id: string; warehouse_id: string; on_hand_qty: string; ledger_qty: string; reserved_qty: string; reservation_qty: string }> };
type LotReconciliation = { checked: number; reconciled: boolean; mismatches: Array<{ item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; on_hand_qty: string; tagged_qty: string; untagged_qty: string }>; negativeLots: Array<{ item_id: string; warehouse_id: string; lot_number: string; bin_location: string | null; on_hand_qty: string }> };
type GlReconciliation = { checked: number; matched: number; exceptions: number; rows: Array<{ transactionId: string; documentType: string; documentId: string; postedAt: string; stockValue: string; journalId: string | null; status: string }> };
type GlControl = { asOf: string; status: string; warehouseValue: string; inTransitValue: string; inventoryValue: string; glBalance: string; difference: string; foreignCurrencyLines: number; accounts: Array<{ id: string; account_code: string; name: string; bdt_balance: string }> };
type AsOfControl = GlControl & { asOf: string; basis: string; missingCostLines: number; currentLedgerMismatches: number; transferHistoryMismatches: number; warehouseRowCount: number; transitRowCount: number; rowLimit: number; warehouseOffset: number; transitOffset: number; warehouseRows: Array<{ item_id: string; warehouse_id: string; item_code: string; warehouse_code: string; quantity: string; stock_value: string; missing_cost_lines: number }>; transitRows: Array<{ transfer_id: string; item_code: string; quantity: string; stock_value: string }> };
type AdjustmentAccounts = { inventory_account_id: string; shrinkage_account_id: string; surplus_account_id: string };
type ChartAccount = { id: string; account_code: string; name: string; account_type: string; is_active: number };
type Transfer = { id: string; item_code: string; source_code: string; destination_code: string; lot_number: string | null; source_bin: string | null; destination_bin: string | null; quantity: string; received_qty: string; lost_qty: string; in_transit_value: string | null; days_in_transit: number | null; status: string; created_by: string; created_at: string; dispatched_at: string | null; received_at: string | null };
type TransferReceipt = { id: string; quantity: string; transaction_id: string; warehouse_code: string | null; condition_code: 'accepted' | 'damaged'; damage_reason: string | null; received_at: string };
type DamagedReceipt = { id: string; transfer_id: string; transaction_id: string; quantity: string; damage_reason: string; received_at: string; item_code: string; quarantine_code: string; lot_number: string | null };
type TransferDiscrepancy = { id: string; transfer_id: string; reported_qty: string; reason: string; status: string; reported_by: string; reported_at: string; reviewed_at: string | null; review_reason: string | null; journal_id: string | null; item_code: string; source_code: string; destination_code: string };
type QcCase = { id: string; item_code: string; quarantine_code: string; lot_number: string | null; source_bin: string | null; quantity: string; decision: 'release' | 'scrap'; reason: string; destination_code: string | null; status: string; created_by: string; created_at: string; review_reason: string | null; issue_transaction_id: string | null; receipt_transaction_id: string | null; journal_id: string | null };
type StockCount = { id: string; item_code: string; warehouse_code: string; book_quantity: string; counted_quantity: string; variance_quantity: string; variance_reason: string | null; status: string; created_at: string; created_by: string };
type CountEvidence = { revision: number; book_quantity: string; warehouse_book_qty: string; counted_quantity: string; variance_quantity: string; reason: string | null; counted_by: string; counted_at: string };
type MovementAnalysis = { movement_date: string; item_code: string; item_name: string; warehouse_code: string; transaction_type: string; document_type: string; documents: number; quantity_in: string; quantity_out: string };
type SlowStock = { item_id: string; warehouse_id: string; item_code: string; item_name: string; warehouse_code: string; on_hand_qty: string; reserved_qty: string; stock_value: string; last_issue_at: string | null; first_receipt_at: string | null };
type AgeingStock = { item_id: string; warehouse_id: string; item_code: string; item_name: string; warehouse_code: string; on_hand_qty: string; days_0_30: string; days_31_90: string; days_91_180: string; days_181_365: string; days_over_365: string; unattributed_qty: string };
type ReorderPolicy = { item_id: string; warehouse_id: string; item_code: string; item_name: string; warehouse_code: string; minimum_qty: string; target_qty: string; lead_days: number; on_hand_qty: string; reserved_qty: string; available_qty: string; suggested_qty: string };
type ReceiptLot = { receipt_line_id: string; lot_number: string; bin_location: string | null; accepted_qty: string; grn_number: string; receipt_date: string; item_code: string; item_name: string; warehouse_code: string; supplier_name: string };
const date = (value: string | null) => value ? String(value).slice(0, 10) : '—';

export function InventoryScreen({ screen }: { screen: Screen }) {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedTransferId, setSelectedTransferId] = useState('');
  const [transferReceipts, setTransferReceipts] = useState<TransferReceipt[]>([]);
  const [damagedReceipts, setDamagedReceipts] = useState<DamagedReceipt[]>([]);
  const [transferDiscrepancies, setTransferDiscrepancies] = useState<TransferDiscrepancy[]>([]);
  const [qcCases, setQcCases] = useState<QcCase[]>([]);
  const [qcDecision, setQcDecision] = useState<'release' | 'scrap'>('release');
  const [qcQuantity, setQcQuantity] = useState('');
  const [qcReason, setQcReason] = useState('');
  const [qcDestination, setQcDestination] = useState('');
  const [qcDestinationBin, setQcDestinationBin] = useState('');
  const [qcReviewReason, setQcReviewReason] = useState('');
  const [shortageReason, setShortageReason] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [damagedQuantity, setDamagedQuantity] = useState('');
  const [damageWarehouse, setDamageWarehouse] = useState('');
  const [damageReason, setDamageReason] = useState('');
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [selectedCountId, setSelectedCountId] = useState('');
  const [countEvidence, setCountEvidence] = useState<CountEvidence[]>([]);
  const [recountQuantity, setRecountQuantity] = useState('');
  const [recountReason, setRecountReason] = useState('');
  const [valuation, setValuation] = useState<Valuation[]>([]);
  const [transitValuation, setTransitValuation] = useState<TransitValuation[]>([]);
  const [valuationTotals, setValuationTotals] = useState<{ on_hand_value: string; in_transit_value: string } | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [lotReconciliation, setLotReconciliation] = useState<LotReconciliation | null>(null);
  const [glReconciliation, setGlReconciliation] = useState<GlReconciliation | null>(null);
  const [glControl, setGlControl] = useState<GlControl | null>(null);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [asOfControl, setAsOfControl] = useState<AsOfControl | null>(null);
  const [asOfWarehouseOffset, setAsOfWarehouseOffset] = useState(0);
  const [asOfTransitOffset, setAsOfTransitOffset] = useState(0);
  const [adjustmentAccounts, setAdjustmentAccounts] = useState<AdjustmentAccounts | null>(null);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [inventoryAccountId, setInventoryAccountId] = useState('');
  const [shrinkageAccountId, setShrinkageAccountId] = useState('');
  const [surplusAccountId, setSurplusAccountId] = useState('');
  const [movementAnalysis, setMovementAnalysis] = useState<MovementAnalysis[]>([]);
  const [slowStock, setSlowStock] = useState<SlowStock[]>([]);
  const [ageingStock, setAgeingStock] = useState<AgeingStock[]>([]);
  const [reorderPolicies, setReorderPolicies] = useState<ReorderPolicy[]>([]);
  const [receiptLots, setReceiptLots] = useState<ReceiptLot[]>([]);
  const [lotBalances, setLotBalances] = useState<LotBalance[]>([]);
  const [transferLotKey, setTransferLotKey] = useState('');
  const [destinationBin, setDestinationBin] = useState('');
  const [transferFilter, setTransferFilter] = useState<'all' | 'in_transit'>('all');
  const [lotSearch, setLotSearch] = useState('');
  const [minimumQty, setMinimumQty] = useState('');
  const [targetQty, setTargetQty] = useState('');
  const [leadDays, setLeadDays] = useState('0');
  const [analysisFrom, setAnalysisFrom] = useState('');
  const [analysisTo, setAnalysisTo] = useState('');
  const [analysisWarehouse, setAnalysisWarehouse] = useState('');
  const [slowDays, setSlowDays] = useState('90');
  const [selectedMovementId, setSelectedMovementId] = useState('');
  const [movementLines, setMovementLines] = useState<MovementLine[]>([]);
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('finished_book');
  const [itemUom, setItemUom] = useState('copy');
  const [itemTracking, setItemTracking] = useState('none');
  const [itemEdition, setItemEdition] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseType, setWarehouseType] = useState('finished_goods');
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [countedQuantity, setCountedQuantity] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const canWrite = role === 'Owner' || permissions.includes('workspace.create') || permissions.includes('workspace.update') || permissions.includes('inventory.manage');
  const canManage = role === 'Owner' || permissions.includes('workspace.update') || permissions.includes('sales.manage') || permissions.includes('inventory.manage');
  const canPost = role === 'Owner' || permissions.includes('workspace.approve') || permissions.includes('sales.approve') || permissions.includes('inventory.approve');
  const canFinance = role === 'Owner' || permissions.includes('finance.read');

  async function loadAnalytics() {
    const warehouse = analysisWarehouse ? `&warehouseId=${encodeURIComponent(analysisWarehouse)}` : '';
    if (screen.title === 'Inventory Movement Analysis') {
      const query = `${analysisFrom ? `&from=${analysisFrom}` : ''}${analysisTo ? `&to=${analysisTo}` : ''}${warehouse}`;
      const result = await api<{ data: { rows: MovementAnalysis[] } }>(`/inventory/movement-analysis?${query.slice(1)}`);
      setMovementAnalysis(result.data.rows);
    } else if (screen.title === 'Slow-Moving Stock') {
      const result = await api<{ data: { rows: SlowStock[] } }>(`/inventory/slow-moving?days=${encodeURIComponent(slowDays)}${warehouse}`);
      setSlowStock(result.data.rows);
    } else if (screen.title === 'Stock Ageing') {
      const result = await api<{ data: { rows: AgeingStock[] } }>(`/inventory/ageing?${warehouse.slice(1)}`);
      setAgeingStock(result.data.rows);
    } else if (screen.title === 'Reorder Planning') {
      const result = await api<{ data: ReorderPolicy[] }>('/inventory/reorder-policies');
      setReorderPolicies(result.data);
    } else if (screen.title === 'Batch/Lot Register' || screen.title === 'Stock by Warehouse/Bin') {
      const query = `${lotSearch ? `search=${encodeURIComponent(lotSearch)}` : ''}${warehouse ? `${lotSearch ? '&' : ''}${warehouse.slice(1)}` : ''}`;
      const [result, balances] = await Promise.all([
        api<{ data: { rows: ReceiptLot[] } }>(`/inventory/receipt-lots?${query}`),
        api<{ data: LotBalance[] }>(`/inventory/lots?${analysisWarehouse ? `warehouseId=${encodeURIComponent(analysisWarehouse)}` : ''}`),
      ]);
      setReceiptLots(result.data.rows);
      setLotBalances(balances.data);
    }
  }

  async function refresh() {
    const title = screen.title;
    const needs = (...titles: string[]) => titles.includes(title);
    const itemNeeded = needs('Inventory Overview', 'Inventory Transaction Ledger', 'Goods Receipt', 'Stock Issue', 'Stock Adjustment', 'Stock Transfer', 'Physical Stock Count', 'Stock Reconciliation', 'Reorder Planning', 'Quarantine & Damaged Stock');
    const warehouseNeeded = itemNeeded || needs('Inventory Movement Analysis', 'Stock Ageing', 'Slow-Moving Stock', 'Batch/Lot Register', 'Stock by Warehouse/Bin', 'Quarantine & Damaged Stock');
    const movementNeeded = needs('Inventory Overview', 'Inventory Transaction Ledger', 'Goods Receipt', 'Stock Issue', 'Stock Adjustment');
    const transferNeeded = needs('Stock Transfer', 'Transfer Approval & Receipt', 'In-Transit Stock');
    const countNeeded = needs('Physical Stock Count', 'Stock Count Variance Approval');
    const principalNeeded = needs('Inventory Overview', 'Reserved & Available Stock', 'Stock Transfer', 'Transfer Approval & Receipt', 'Physical Stock Count', 'Stock Count Variance Approval', 'Reorder Planning', 'Inventory Valuation', 'Stock Reconciliation', 'Quarantine & Damaged Stock');
    const [itemResult, warehouseResult, editionResult, balanceResult, movementResult, reservationResult, transferResult, countResult, valuationResult, reconciliationResult, me] = await Promise.all([
      itemNeeded ? api<{ data: Item[] }>('/items') : null,
      warehouseNeeded ? api<{ data: Warehouse[] }>('/warehouses') : null,
      needs('Inventory Overview') ? api<{ data: Edition[] }>('/editions?limit=100') : null,
      needs('Inventory Overview', 'Stock by Book/Edition', 'Stock by Warehouse/Bin', 'Quarantine & Damaged Stock', 'Reserved & Available Stock', 'Stock Issue', 'Stock Transfer', 'Physical Stock Count') ? api<{ data: Balance[] }>('/inventory/balances') : null,
      movementNeeded ? api<{ data: Movement[] }>(`/inventory/transactions?limit=100${title === 'Goods Receipt' ? '&type=receipt' : title === 'Stock Issue' ? '&type=issue' : title === 'Stock Adjustment' ? '&type=adjustment' : ''}`) : null,
      needs('Reserved & Available Stock') ? api<{ data: Reservation[] }>('/inventory/reservations') : null,
      transferNeeded ? api<{ data: Transfer[] }>(title === 'In-Transit Stock' ? '/inventory/transfers?limit=100&activeTransit=true' : '/inventory/transfers?limit=100') : null,
      countNeeded ? api<{ data: StockCount[] }>(title === 'Stock Count Variance Approval' ? '/inventory/counts?limit=100&status=pending_approval' : '/inventory/counts?limit=100') : null,
      needs('Inventory Valuation') ? api<{ data: { rows: Valuation[]; inTransitRows: TransitValuation[]; totals: { on_hand_value: string; in_transit_value: string } } }>('/inventory/valuation') : null,
      needs('Inventory Overview', 'Stock Reconciliation') ? api<{ data: Reconciliation }>('/inventory/reconciliation') : null,
      principalNeeded ? api<{ data: { role: string; userId: string; permissions: string[] } }>('/auth/me') : null,
    ]);
    if (itemResult) { setItems(itemResult.data); setSelectedItem(current => current || itemResult.data[0]?.id || ''); }
    if (warehouseResult) { setWarehouses(warehouseResult.data); setSelectedWarehouse(current => current || warehouseResult.data[0]?.id || ''); setDestinationWarehouse(current => current || warehouseResult.data.find(item => item.id !== warehouseResult.data[0]?.id)?.id || ''); }
    if (editionResult) setEditions(editionResult.data);
    if (balanceResult) setBalances(balanceResult.data);
    if (movementResult) setMovements(movementResult.data);
    if (reservationResult) setReservations(reservationResult.data);
    if (transferResult) setTransfers(transferResult.data);
    if (transferNeeded) setTransferDiscrepancies((await api<{ data: TransferDiscrepancy[] }>('/inventory/transfer-discrepancies')).data);
    if (needs('Quarantine & Damaged Stock')) setDamagedReceipts((await api<{ data: DamagedReceipt[] }>('/inventory/damaged-receipts')).data);
    if (needs('Quarantine & Damaged Stock')) setQcCases((await api<{ data: QcCase[] }>('/inventory/qc-cases')).data);
    if (countResult) setStockCounts(countResult.data);
    if (valuationResult) { setValuation(valuationResult.data.rows); setTransitValuation(valuationResult.data.inTransitRows); setValuationTotals(valuationResult.data.totals); }
    if (reconciliationResult) setReconciliation(reconciliationResult.data);
    if (needs('Stock Reconciliation')) {
      const result = await api<{ data: LotReconciliation }>('/inventory/lot-reconciliation');
      setLotReconciliation(result.data);
    }
    if (me) { setRole(me.data.role); setUserId(me.data.userId); setPermissions(me.data.permissions); }
    if (me && (me.data.role === 'Owner' || me.data.permissions.includes('finance.read'))) {
      if (needs('Inventory Valuation', 'Stock Reconciliation')) setAsOfControl((await api<{ data: AsOfControl }>(`/inventory/as-of-control?asOf=${encodeURIComponent(asOfDate)}&warehouseOffset=${asOfWarehouseOffset}&transitOffset=${asOfTransitOffset}`)).data);
      if (needs('Stock Reconciliation')) {
        const [result, control] = await Promise.all([api<{ data: GlReconciliation }>('/inventory/gl-reconciliation'), api<{ data: GlControl }>('/inventory/gl-control')]);
        setGlReconciliation(result.data); setGlControl(control.data);
      }
      if (needs('Inventory Valuation', 'Stock Count Variance Approval')) {
        const [config, accounts] = await Promise.all([
          api<{ data: AdjustmentAccounts | null }>('/inventory/adjustment-accounts'),
          api<{ data: ChartAccount[] }>('/accounts/chart'),
        ]);
        setAdjustmentAccounts(config.data); setChartAccounts(accounts.data);
        setInventoryAccountId(config.data?.inventory_account_id ?? '');
        setShrinkageAccountId(config.data?.shrinkage_account_id ?? '');
        setSurplusAccountId(config.data?.surplus_account_id ?? '');
      }
    }
    await loadAnalytics();
  }
  useEffect(() => { void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load inventory')).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!selectedMovementId) { setMovementLines([]); return; }
    void api<{ data: { lines: MovementLine[] } }>(`/inventory/transactions/${selectedMovementId}`).then(result => setMovementLines(result.data.lines)).catch(() => setError('Could not load transaction lines'));
  }, [selectedMovementId]);
  useEffect(() => {
    if (!selectedTransferId) { setTransferReceipts([]); return; }
    void api<{ data: TransferReceipt[] }>(`/inventory/transfers/${selectedTransferId}/receipts`).then(result => setTransferReceipts(result.data)).catch(() => setError('Could not load transfer receipts'));
  }, [selectedTransferId, transfers]);
  useEffect(() => { setTransferLotKey(''); }, [selectedItem, selectedWarehouse]);
  useEffect(() => {
    if (!['Stock Transfer', 'Physical Stock Count', 'Quarantine & Damaged Stock'].includes(screen.title) || !selectedItem || !selectedWarehouse || items.find(item => item.id === selectedItem)?.tracking_policy !== 'lot') return;
    void api<{ data: LotBalance[] }>(`/inventory/lots?itemId=${encodeURIComponent(selectedItem)}&warehouseId=${encodeURIComponent(selectedWarehouse)}`).then(result => setLotBalances(result.data)).catch(() => setError('Could not load available lots'));
  }, [screen.title, selectedItem, selectedWarehouse, transfers, items]);
  async function act(task: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function applyAsOfDate(warehouseOffset = 0, transitOffset = 0, requestedDate = asOfDate) {
    await act(async () => {
      const report = (await api<{ data: AsOfControl }>(`/inventory/as-of-control?asOf=${encodeURIComponent(requestedDate)}&warehouseOffset=${warehouseOffset}&transitOffset=${transitOffset}`)).data;
      setAsOfControl(report); setAsOfWarehouseOffset(report.warehouseOffset); setAsOfTransitOffset(report.transitOffset);
    }, 'As-of control report updated');
  }
  async function exportAsOfCsv() {
    await act(async () => {
      const reportDate = asOfControl?.asOf ?? asOfDate;
      const file = await apiFile(`/inventory/as-of-control?asOf=${encodeURIComponent(reportDate)}&format=csv`);
      const url = URL.createObjectURL(file), link = document.createElement('a');
      link.href = url; link.download = `inventory-as-of-${reportDate}.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'As-of report exported');
  }
  async function addItem() {
    await act(async () => {
      await api('/items', { method: 'POST', body: JSON.stringify({ code: itemCode.trim(), name: itemName.trim(), type: itemType, uom: itemUom.trim(), trackingPolicy: itemTracking, editionId: itemEdition || null }) });
      setItemCode(''); setItemName(''); setItemEdition(''); await refresh();
    }, 'Item created');
  }
  async function addWarehouse() {
    await act(async () => {
      await api('/warehouses', { method: 'POST', body: JSON.stringify({ code: warehouseCode.trim(), name: warehouseName.trim(), type: warehouseType }) });
      setWarehouseCode(''); setWarehouseName(''); await refresh();
    }, 'Warehouse created');
  }
  async function releaseReservation(id: string) {
    if (!window.confirm('Release this reservation?')) return;
    await act(async () => { await api(`/inventory/reservations/${id}/release`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } }); await refresh(); }, 'Reservation released');
  }
  async function createTransfer() {
    await act(async () => {
      const allocation = transferLotKey ? JSON.parse(transferLotKey) as [string, string | null] : null;
      await api('/inventory/transfers', { method: 'POST', body: JSON.stringify({ itemId: selectedItem, sourceWarehouseId: selectedWarehouse, destinationWarehouseId: destinationWarehouse, quantity: transferQuantity, ...(allocation ? { lotNumber: allocation[0], sourceBin: allocation[1] ?? undefined, destinationBin: destinationBin.trim() || undefined } : {}) }) });
      setTransferQuantity(''); await refresh();
    }, 'Draft transfer created');
  }
  async function advanceTransfer(id: string, action: 'approve' | 'dispatch' | 'receive' | 'receive-damaged') {
    const message = action === 'approve' ? 'Approve this transfer for dispatch?' : action === 'dispatch' ? 'Dispatch stock to the in-transit ledger?' : action === 'receive-damaged' ? 'Receive damaged stock into quarantine with the recorded reason?' : 'Receive the specified quantity into the destination warehouse?';
    if (!window.confirm(message)) return;
    await act(async () => {
      await api(`/inventory/transfers/${id}/${action === 'receive-damaged' ? 'receive' : action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, ...(action === 'receive' ? { body: JSON.stringify(receiptQuantities[id] ? { quantity: receiptQuantities[id] } : {}) } : action === 'receive-damaged' ? { body: JSON.stringify({ quantity: damagedQuantity, condition: 'damaged', quarantineWarehouseId: damageWarehouse, damageReason: damageReason.trim() }) } : {}) });
      if (action === 'receive-damaged') { setDamagedQuantity(''); setDamageReason(''); }
      setReceiptQuantities(current => ({ ...current, [id]: '' }));
      await refresh();
    }, action === 'approve' ? 'Transfer approved' : action === 'dispatch' ? 'Transfer dispatched' : 'Transfer receipt posted');
  }
  async function reportShortage(id: string) {
    if (!window.confirm('Report all outstanding stock on this transfer as missing and pause further receipts pending independent review?')) return;
    await act(async () => {
      await api(`/inventory/transfers/${id}/discrepancy`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: shortageReason.trim() }) });
      setShortageReason(''); await refresh();
    }, 'Transfer shortage reported for review');
  }
  async function reviewShortage(id: string, action: 'dismiss' | 'write-off') {
    if (!window.confirm(action === 'write-off' ? 'Approve the shortage loss and post a balanced Finance journal?' : 'Dismiss the shortage report and allow receipts to resume?')) return;
    await act(async () => {
      await api(`/inventory/transfer-discrepancies/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: reviewReason.trim() }) });
      setReviewReason(''); await refresh();
    }, action === 'write-off' ? 'Shortage written off with Finance journal' : 'Shortage dismissed; receiving may resume');
  }
  async function createQcCase() {
    await act(async () => {
      const allocation = transferLotKey ? JSON.parse(transferLotKey) as [string, string | null] : null;
      await api('/inventory/qc-cases', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ itemId: selectedItem, quarantineWarehouseId: selectedWarehouse, lotNumber: allocation?.[0], sourceBin: allocation?.[1] ?? undefined, quantity: qcQuantity, decision: qcDecision, reason: qcReason.trim(), ...(qcDecision === 'release' ? { destinationWarehouseId: qcDestination, destinationBin: qcDestinationBin.trim() || undefined } : {}) }) });
      setQcQuantity(''); setQcReason(''); await refresh();
    }, 'QC decision submitted for independent review');
  }
  async function reviewQcCase(id: string, action: 'approve-release' | 'approve-scrap' | 'reject') {
    if (!window.confirm(action === 'reject' ? 'Reject this QC decision?' : action === 'approve-scrap' ? 'Approve scrap, post stock issue and Finance journal?' : 'Approve release into allocatable stock?')) return;
    await act(async () => {
      await api(`/inventory/qc-cases/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: qcReviewReason.trim() }) });
      setQcReviewReason(''); await refresh();
    }, action === 'reject' ? 'QC decision rejected' : 'QC decision approved and stock movement posted');
  }
  async function createCount() {
    await act(async () => {
      const allocation = transferLotKey ? JSON.parse(transferLotKey) as [string, string | null] : null;
      await api('/inventory/counts', { method: 'POST', body: JSON.stringify({ itemId: selectedItem, warehouseId: selectedWarehouse, countedQuantity, reason: varianceReason.trim() || null, ...(allocation ? { lotNumber: allocation[0], binLocation: allocation[1] ?? undefined } : {}) }) });
      setCountedQuantity(''); setVarianceReason(''); await refresh();
    }, 'Count submitted for approval');
  }
  async function showCountEvidence(id: string) {
    await act(async () => {
      const result = await api<{ data: CountEvidence[] }>(`/inventory/counts/${id}/evidence`);
      setSelectedCountId(id); setCountEvidence(result.data); setRecountQuantity(''); setRecountReason('');
    }, 'Count evidence loaded');
  }
  async function submitRecount() {
    await act(async () => {
      await api(`/inventory/counts/${selectedCountId}/recount`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ countedQuantity: recountQuantity, reason: recountReason.trim() }) });
      const result = await api<{ data: CountEvidence[] }>(`/inventory/counts/${selectedCountId}/evidence`);
      setCountEvidence(result.data); setRecountQuantity(''); setRecountReason(''); await refresh();
    }, 'Recount recorded; independent variance approval is still required');
  }
  async function saveReorderPolicy() {
    await act(async () => {
      await api('/inventory/reorder-policies', { method: 'PUT', body: JSON.stringify({ itemId: selectedItem, warehouseId: selectedWarehouse, minimumQty, targetQty, leadDays: Number(leadDays) }) });
      await loadAnalytics();
    }, 'Reorder policy saved');
  }
  async function saveAdjustmentAccounts() {
    await act(async () => {
      await api('/inventory/adjustment-accounts', { method: 'PUT', body: JSON.stringify({ inventoryAccountId, shrinkageAccountId, surplusAccountId }) });
      await refresh();
    }, 'Adjustment account mapping saved');
  }
  async function removeReorderPolicy(row: ReorderPolicy) {
    if (!window.confirm(`Remove reorder policy for ${row.item_code} in ${row.warehouse_code}?`)) return;
    await act(async () => {
      await api(`/inventory/reorder-policies/${row.item_id}/${row.warehouse_id}`, { method: 'DELETE' });
      await loadAnalytics();
    }, 'Reorder policy removed');
  }
  async function reviewCount(id: string, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reason for rejection') : null;
    if (action === 'reject' && !reason?.trim()) return;
    if (action === 'approve' && !window.confirm('Approve and post this stock variance?')) return;
    await act(async () => {
      await api(`/inventory/counts/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, ...(action === 'reject' ? { body: JSON.stringify({ reason: reason!.trim() }) } : {}) });
      await refresh();
    }, action === 'approve' ? 'Count approved and variance posted' : 'Count rejected');
  }

  const itemSelector = <label className="field">Item<select className="input" value={selectedItem} onChange={event => setSelectedItem(event.target.value)}><option value="">Select item</option>{items.map(item => <option key={item.id} value={item.id}>{item.item_code} · {item.name}</option>)}</select></label>;
  const warehouseSelector = <label className="field">Warehouse<select className="input" value={selectedWarehouse} onChange={event => setSelectedWarehouse(event.target.value)}><option value="">Select warehouse</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>;
  const balanceTable = (rows: Balance[]) => <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Average cost</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={`${row.item_id}-${row.warehouse_id}`}><td>{row.book_title ? `${row.book_title} · Edition ${row.edition_number}` : `${row.item_code} · ${row.item_name}`}</td><td>{row.warehouse_code}</td><td>{row.on_hand_qty}</td><td>{row.reserved_qty}</td><td>{row.available_qty}</td><td>{row.average_unit_cost}</td></tr>) : <tr><td colSpan={6} className="empty">No stock balances yet.</td></tr>}</tbody></table></div>;
  const movementTable = <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Type</th><th>Source document</th><th>Created</th><th>Status</th><th>Action</th></tr></thead><tbody>{movements.length ? movements.map(row => <tr key={row.id}><td>{row.transaction_type}</td><td>{row.document_type} · {row.document_id.slice(0, 8)}</td><td>{date(row.created_at)}</td><td>{row.status}</td><td><button className="btn" onClick={() => setSelectedMovementId(row.id)}>Lines</button></td></tr>) : <tr><td colSpan={5} className="empty">No stock movements yet.</td></tr>}</tbody></table></div>;
  const transferTable = (rows: Transfer[]) => <><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>From</th><th>To</th><th>Ordered</th><th>Received</th><th>Lost</th><th>In transit value</th><th>Transit days</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map(row => {
    const remaining = Number(row.quantity) - Number(row.received_qty);
    const reviewing = screen.title === 'Transfer Approval & Receipt' || screen.title === 'Stock Transfer';
    const dispatching = screen.title === 'Stock Transfer';
    return <tr key={row.id}><td>{row.item_code}{row.lot_number && <small className="muted"> / {row.lot_number} ({row.source_bin || 'Unassigned'} → {row.destination_bin || 'Unassigned'})</small>}</td><td>{row.source_code}</td><td>{row.destination_code}</td><td>{row.quantity}</td><td>{row.received_qty}</td><td>{row.lost_qty}</td><td>{['in_transit', 'partially_received'].includes(row.status) ? row.in_transit_value ?? '—' : '—'}</td><td>{['in_transit', 'partially_received'].includes(row.status) ? row.days_in_transit ?? 0 : '—'}</td><td>{row.status.replaceAll('_', ' ')}</td><td>{date(row.created_at)}</td><td><div className="button-row"><button className="btn" onClick={() => setSelectedTransferId(row.id)}>Receipts</button>{reviewing && canPost && row.status === 'draft' && (role === 'Owner' || row.created_by !== userId) && <button className="btn btn-primary" disabled={busy} onClick={() => void advanceTransfer(row.id, 'approve')}>Approve</button>}{reviewing && row.status === 'draft' && role !== 'Owner' && row.created_by === userId && <span className="muted">Independent approval required</span>}{dispatching && canPost && row.status === 'approved' && <button className="btn btn-primary" disabled={busy} onClick={() => void advanceTransfer(row.id, 'dispatch')}>Dispatch</button>}{reviewing && canPost && ['in_transit', 'partially_received'].includes(row.status) && !transferDiscrepancies.some(report => report.transfer_id === row.id && report.status === 'open') && <><input className="input" type="number" min="0.0001" max={remaining} step="0.0001" aria-label={`Receipt quantity for ${row.item_code}`} placeholder={`Remaining ${remaining}`} value={receiptQuantities[row.id] ?? ''} onChange={event => setReceiptQuantities(current => ({ ...current, [row.id]: event.target.value }))} /><button className="btn btn-primary" disabled={busy || (receiptQuantities[row.id] !== undefined && receiptQuantities[row.id] !== '' && (Number(receiptQuantities[row.id]) <= 0 || Number(receiptQuantities[row.id]) > remaining))} onClick={() => void advanceTransfer(row.id, 'receive')}>Receive</button></>}</div></td></tr>;
  }) : <tr><td colSpan={11} className="empty">No transfers found.</td></tr>}</tbody></table></div>{selectedTransferId && <section className="panel catalog-form"><h2 className="section-title">Transfer receipt history</h2>{transferReceipts.length ? transferReceipts.map(row => <p key={row.id}>{date(row.received_at)} · {row.quantity} units · {row.condition_code} at {row.warehouse_code || 'destination'} · Ledger {row.transaction_id.slice(0, 8)}{row.damage_reason && <> · Reason: {row.damage_reason}</>}</p>) : <p className="empty">No receipts posted yet.</p>}{screen.title === 'Transfer Approval & Receipt' && canPost && transfers.some(row => row.id === selectedTransferId && ['in_transit', 'partially_received'].includes(row.status)) && <><h3 className="section-title">Receive damaged stock into quarantine</h3><p className="muted">Damaged stock remains valued on hand but cannot be reserved or issued for production. The receipt and reason are recorded against this transfer.</p><div className="catalog-form-grid"><label className="field">Damaged quantity<input className="input" type="number" min="0.0001" max={Number(transfers.find(row => row.id === selectedTransferId)?.quantity ?? 0) - Number(transfers.find(row => row.id === selectedTransferId)?.received_qty ?? 0)} step="0.0001" value={damagedQuantity} onChange={event => setDamagedQuantity(event.target.value)} /></label><label className="field">Quarantine warehouse<select className="input" value={damageWarehouse} onChange={event => setDamageWarehouse(event.target.value)}><option value="">Select quarantine warehouse</option>{warehouses.filter(row => row.warehouse_type === 'quarantine' && row.status === 'active').map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label className="field">Damage reason<input className="input" value={damageReason} onChange={event => setDamageReason(event.target.value)} minLength={10} maxLength={1000} /></label></div><button className="btn btn-primary" disabled={busy || !damagedQuantity || Number(damagedQuantity) <= 0 || Number(damagedQuantity) > Number(transfers.find(row => row.id === selectedTransferId)?.quantity ?? 0) - Number(transfers.find(row => row.id === selectedTransferId)?.received_qty ?? 0) || !damageWarehouse || damageReason.trim().length < 10} onClick={() => void advanceTransfer(selectedTransferId, 'receive-damaged')}>Receive damaged stock</button></>}</section>}</>;

  const selectedTransfer = transfers.find(row => row.id === selectedTransferId);
  const openTransferDiscrepancy = transferDiscrepancies.find(row => row.transfer_id === selectedTransferId && row.status === 'open');
  const discrepancyPanel = <section className="panel catalog-form"><h2 className="section-title">In-transit shortage investigation</h2><p className="muted">Reporting a shortage pauses receiving while the outstanding quantity remains in transit. A different reviewer can dismiss the report when stock is found. A Finance-authorized reviewer can write off confirmed loss against the configured inventory and shrinkage accounts in an open fiscal period.</p>{selectedTransfer && ['in_transit', 'partially_received'].includes(selectedTransfer.status) && !openTransferDiscrepancy && canWrite && <><h3>Report outstanding quantity for {selectedTransfer.item_code}</h3><label className="field">Investigation reason<input className="input" value={shortageReason} minLength={10} maxLength={1000} onChange={event => setShortageReason(event.target.value)} /></label><button className="btn" disabled={busy || shortageReason.trim().length < 10} onClick={() => void reportShortage(selectedTransfer.id)}>Report shortage</button></>}{transferDiscrepancies.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Route</th><th>Quantity</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{transferDiscrepancies.map(row => <tr key={row.id}><td>{row.item_code}</td><td>{row.source_code} → {row.destination_code}</td><td>{row.reported_qty}</td><td>{row.reason}</td><td>{row.status.replaceAll('_', ' ')}{row.journal_id && <small className="muted"> · Journal {row.journal_id.slice(0, 8)}</small>}</td><td>{row.status === 'open' && canPost && (role === 'Owner' || row.reported_by !== userId) ? <><label className="field">Decision reason<input className="input" value={reviewReason} minLength={10} maxLength={1000} onChange={event => setReviewReason(event.target.value)} /></label><div className="button-row"><button className="btn" disabled={busy || reviewReason.trim().length < 10} onClick={() => void reviewShortage(row.id, 'dismiss')}>Dismiss</button>{canFinance && <button className="btn btn-primary" disabled={busy || reviewReason.trim().length < 10} onClick={() => void reviewShortage(row.id, 'write-off')}>Approve write-off</button>}</div></> : row.status === 'open' && role !== 'Owner' && row.reported_by === userId ? 'Independent review required' : row.review_reason || '—'}</td></tr>)}</tbody></table></div> : <p className="empty">No transfer shortages reported.</p>}</section>;

  const qcPanel = <><section className="panel catalog-form"><h2 className="section-title">Quarantine QC decisions</h2><p className="muted">Release moves stock to an allocatable warehouse; scrap removes stock and posts a Finance journal. Both need a separate reviewer. Pending quantities cannot exceed held stock.</p>{canWrite && <><div className="catalog-form-grid">{itemSelector}<label className="field">Quarantine warehouse<select className="input" value={selectedWarehouse} onChange={event => setSelectedWarehouse(event.target.value)}><option value="">Select quarantine warehouse</option>{warehouses.filter(row => row.warehouse_type === 'quarantine' && row.status === 'active').map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>{items.find(row => row.id === selectedItem)?.tracking_policy === 'lot' && <label className="field">Held lot and bin<select className="input" value={transferLotKey} onChange={event => setTransferLotKey(event.target.value)}><option value="">Select lot</option>{lotBalances.filter(row => row.item_id === selectedItem && row.warehouse_id === selectedWarehouse).map(row => <option key={`${row.lot_number}:${row.bin_location}`} value={JSON.stringify([row.lot_number, row.bin_location])}>{row.lot_number} / {row.bin_location || 'Unassigned'} / {row.on_hand_qty}</option>)}</select></label>}<label className="field">Quantity<input className="input" type="number" min="0.0001" step="0.0001" value={qcQuantity} onChange={event => setQcQuantity(event.target.value)} /></label><label className="field">Disposition<select className="input" value={qcDecision} onChange={event => setQcDecision(event.target.value as 'release' | 'scrap')}><option value="release">Release</option><option value="scrap">Scrap</option></select></label>{qcDecision === 'release' && <><label className="field">Release warehouse<select className="input" value={qcDestination} onChange={event => setQcDestination(event.target.value)}><option value="">Select destination</option>{warehouses.filter(row => row.status === 'active' && !['quarantine', 'consignment', 'wip'].includes(row.warehouse_type)).map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>{items.find(row => row.id === selectedItem)?.tracking_policy === 'lot' && <label className="field">Destination bin<input className="input" value={qcDestinationBin} onChange={event => setQcDestinationBin(event.target.value)} /></label>}</>}<label className="field">QC evidence and reason<input className="input" minLength={10} maxLength={1000} value={qcReason} onChange={event => setQcReason(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !selectedItem || !warehouses.some(row => row.id === selectedWarehouse && row.warehouse_type === 'quarantine') || !qcQuantity || Number(qcQuantity) <= 0 || qcReason.trim().length < 10 || (qcDecision === 'release' && !qcDestination) || (items.find(row => row.id === selectedItem)?.tracking_policy === 'lot' && !transferLotKey)} onClick={() => void createQcCase()}>Submit QC decision</button></>}</section><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item / lot</th><th>Quarantine</th><th>Quantity</th><th>Decision</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{qcCases.length ? qcCases.map(row => <tr key={row.id}><td>{row.item_code}{row.lot_number && <> / {row.lot_number} / {row.source_bin || 'Unassigned'}</>}</td><td>{row.quarantine_code}</td><td>{row.quantity}</td><td>{row.decision}{row.destination_code && <> → {row.destination_code}</>}</td><td>{row.reason}</td><td>{row.status.replaceAll('_', ' ')}{row.journal_id && <small className="muted"> · Journal {row.journal_id.slice(0, 8)}</small>}</td><td>{row.status === 'pending_approval' && canPost && (role === 'Owner' || row.created_by !== userId) ? <><label className="field">Review reason<input className="input" minLength={10} maxLength={1000} value={qcReviewReason} onChange={event => setQcReviewReason(event.target.value)} /></label><div className="button-row"><button className="btn" disabled={busy || qcReviewReason.trim().length < 10} onClick={() => void reviewQcCase(row.id, 'reject')}>Reject</button>{(row.decision === 'release' || canFinance) && <button className="btn btn-primary" disabled={busy || qcReviewReason.trim().length < 10} onClick={() => void reviewQcCase(row.id, row.decision === 'release' ? 'approve-release' : 'approve-scrap')}>Approve {row.decision}</button>}</div></> : row.status === 'pending_approval' && role !== 'Owner' && role !== 'Owner' && row.created_by === userId ? 'Independent review required' : row.review_reason || '—'}</td></tr>) : <tr><td colSpan={7} className="empty">No QC decisions recorded.</td></tr>}</tbody></table></div></>;

  const countTable = (approvalQueue: boolean) => <section className="panel catalog-form">
    <h2 className="section-title">{approvalQueue ? 'Pending variance reviews' : 'Physical count history'}</h2>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>Book quantity</th><th>Counted</th><th>Variance</th><th>Reason</th><th>Status</th><th>Evidence</th>{approvalQueue && <th>Decision</th>}</tr></thead><tbody>
      {stockCounts.length ? stockCounts.map(row => <tr key={row.id}><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.book_quantity}</td><td>{row.counted_quantity}</td><td>{row.variance_quantity}</td><td>{row.variance_reason || '—'}</td><td>{row.status.replace('_', ' ')}</td><td><button className="btn" disabled={busy} onClick={() => void showCountEvidence(row.id)}>History / recount</button></td>{approvalQueue && <td>{canPost && (role === 'Owner' || row.created_by !== userId) ? <div className="button-row">{canFinance ? <button className="btn btn-primary" disabled={busy} onClick={() => void reviewCount(row.id, 'approve')}>Approve &amp; post</button> : <span className="muted">Finance access required to post</span>}<button className="btn" disabled={busy} onClick={() => void reviewCount(row.id, 'reject')}>Reject</button></div> : row.created_by === userId ? 'Independent review required' : 'Approval permission required'}</td>}</tr>) : <tr><td colSpan={approvalQueue ? 9 : 8} className="empty">{approvalQueue ? 'No pending count variances.' : 'No physical counts yet.'}</td></tr>}
    </tbody></table></div>
    {selectedCountId && stockCounts.some(row => row.id === selectedCountId) && <div className="panel catalog-form"><h3>Count evidence and cut-offs</h3><p className="muted">Each recount records a new stock snapshot. A changed balance blocks approval until the item is physically recounted.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Revision</th><th>Counted at</th><th>Book</th><th>Counted</th><th>Variance</th><th>Reason</th></tr></thead><tbody>{countEvidence.length ? countEvidence.map(row => <tr key={row.revision}><td>{row.revision}</td><td>{String(row.counted_at)}</td><td>{row.book_quantity}</td><td>{row.counted_quantity}</td><td>{row.variance_quantity}</td><td>{row.reason || '—'}</td></tr>) : <tr><td colSpan={6}>Legacy count: evidence was not recorded separately.</td></tr>}</tbody></table></div>{canWrite && stockCounts.find(row => row.id === selectedCountId)?.status === 'pending_approval' && <div className="catalog-form-grid"><label className="field">Recounted quantity<input className="input" type="number" min="0" step="0.0001" value={recountQuantity} onChange={event => setRecountQuantity(event.target.value)} /></label><label className="field">Recount reason<input className="input" minLength={10} maxLength={500} value={recountReason} onChange={event => setRecountReason(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || recountQuantity === '' || recountReason.trim().length < 10} onClick={() => void submitRecount()}>Record recount</button></div>}</div>}
  </section>;
  const reportWarehouse = <label className="field">Warehouse<select className="input" value={analysisWarehouse} onChange={event => setAnalysisWarehouse(event.target.value)}><option value="">All warehouses</option>{warehouses.map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>;
  const reportRefresh = <button className="btn btn-primary" disabled={busy} onClick={() => void act(loadAnalytics, 'Report updated')}>Apply filters</button>;
  const visibleLotBalances = lotBalances.filter(row => !lotSearch || `${row.item_code} ${row.lot_number} ${row.bin_location ?? ''}`.toLowerCase().includes(lotSearch.toLowerCase()));
  const currentLotTable = <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>Lot</th><th>Bin</th><th>Current quantity</th></tr></thead><tbody>{visibleLotBalances.length ? visibleLotBalances.map(row => <tr key={`${row.item_id}:${row.warehouse_id}:${row.lot_number}:${row.bin_location}`}><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.lot_number}</td><td>{row.bin_location || 'Unassigned'}</td><td>{row.on_hand_qty}</td></tr>) : <tr><td colSpan={5} className="empty">No positive lot-tracked stock matches these filters.</td></tr>}</tbody></table></div>;
  const lotTable = <div className="panel table-wrap"><table className="data-table"><thead><tr><th>Lot</th><th>Item</th><th>Warehouse</th><th>Receiving bin</th><th>Accepted</th><th>Supplier</th><th>GRN</th><th>Receipt date</th></tr></thead><tbody>{receiptLots.length ? receiptLots.map(row => <tr key={row.receipt_line_id}><td>{row.lot_number}</td><td>{row.item_code} · {row.item_name}</td><td>{row.warehouse_code}</td><td>{row.bin_location || 'Unassigned'}</td><td>{row.accepted_qty}</td><td>{row.supplier_name}</td><td>{row.grn_number}</td><td>{date(row.receipt_date)}</td></tr>) : <tr><td colSpan={8} className="empty">No posted procurement receipts with a lot number match these filters.</td></tr>}</tbody></table></div>;
  const adjustmentConfigSection = canFinance && <section className="panel catalog-form"><h2 className="section-title">Stock adjustment accounting</h2><p className="muted">A nonzero count variance requires an open fiscal period and a balanced journal. The mapping locks after the first posted count adjustment.</p><p>Current mapping: {adjustmentAccounts ? 'Configured' : 'Not configured'}</p>{canPost && <><div className="catalog-form-grid"><label className="field">Inventory asset<select className="input" value={inventoryAccountId} onChange={event => setInventoryAccountId(event.target.value)}><option value="">Select account</option>{chartAccounts.filter(row => row.is_active && row.account_type === 'asset').map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label><label className="field">Shrinkage expense<select className="input" value={shrinkageAccountId} onChange={event => setShrinkageAccountId(event.target.value)}><option value="">Select account</option>{chartAccounts.filter(row => row.is_active && row.account_type === 'expense').map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label><label className="field">Surplus income<select className="input" value={surplusAccountId} onChange={event => setSurplusAccountId(event.target.value)}><option value="">Select account</option>{chartAccounts.filter(row => row.is_active && row.account_type === 'revenue').map(row => <option key={row.id} value={row.id}>{row.account_code} · {row.name}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy || !inventoryAccountId || !shrinkageAccountId || !surplusAccountId} onClick={() => void saveAdjustmentAccounts()}>Save mapping</button></>}</section>;

  const lotReconciliationPanel = <section className="panel catalog-form"><h2 className="section-title">Lot and bin ledger reconciliation</h2><p>{lotReconciliation?.checked ?? 0} tracked item and warehouse balances checked. {lotReconciliation?.reconciled ? 'Tagged lots match warehouse balances.' : 'Lot differences require review.'}</p>{lotReconciliation?.mismatches.map((row, index) => <p key={index}>{row.item_code} / {row.warehouse_code}: warehouse {row.on_hand_qty}, tagged {row.tagged_qty}, untagged {row.untagged_qty}</p>)}{lotReconciliation?.negativeLots.map((row, index) => <p key={`negative-${index}`}>Negative lot {row.lot_number} / {row.bin_location || 'Unassigned'}: {row.on_hand_qty}</p>)}</section>;
  const glControlPanel = <section className="panel catalog-form"><h2 className="section-title">Current inventory GL control</h2><p className="muted">Current weighted-average warehouse value plus stock in transit is compared with posted BDT balances in configured inventory control accounts. Historical opening balances or foreign currency entries may require review. This is not an as-of period close.</p><p>Status: {glControl?.status.replaceAll('_', ' ') ?? 'Loading'}</p><div className="stat-grid"><div className="panel stat"><div className="stat-label">Warehouse</div><div className="stat-value">{glControl?.warehouseValue ?? '—'}</div></div><div className="panel stat"><div className="stat-label">In transit</div><div className="stat-value">{glControl?.inTransitValue ?? '—'}</div></div><div className="panel stat"><div className="stat-label">GL control</div><div className="stat-value">{glControl?.glBalance ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Difference</div><div className="stat-value">{glControl?.difference ?? '—'}</div></div></div>{glControl?.foreignCurrencyLines ? <p>{glControl.foreignCurrencyLines} foreign currency journal lines need conversion before comparison.</p> : null}{glControl?.accounts.map(row => <p key={row.id}>{row.account_code} — {row.name}: {row.bdt_balance}</p>)}</section>;
  const asOfPanel = <section className="panel catalog-form"><h2 className="section-title">As-of inventory and GL control</h2><p className="muted">{asOfControl?.basis || 'Posted movements and Finance journals are compared at the selected cut-off.'}</p><div className="button-row"><label className="field">As-of date<input className="input" type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} /></label><button className="btn btn-primary" disabled={busy || !asOfDate} onClick={() => void applyAsOfDate()}>Apply cut-off</button></div><p>Status: {asOfControl?.status.replaceAll('_', ' ') ?? 'Loading'}{asOfControl && <> · {asOfControl.currentLedgerMismatches} current stock/ledger gaps · {asOfControl.transferHistoryMismatches} transfer-history gaps · {asOfControl.missingCostLines} movement lines without cost</>}</p><div className="stat-grid"><div className="panel stat"><div className="stat-label">Warehouse</div><div className="stat-value">{asOfControl?.warehouseValue ?? '—'}</div></div><div className="panel stat"><div className="stat-label">In transit</div><div className="stat-value">{asOfControl?.inTransitValue ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Posted GL</div><div className="stat-value">{asOfControl?.glBalance ?? '—'}</div></div><div className="panel stat"><div className="stat-label">Difference</div><div className="stat-value">{asOfControl?.difference ?? '—'}</div></div></div><p className="muted">{asOfControl?.warehouseRowCount ?? 0} warehouse rows and {asOfControl?.transitRowCount ?? 0} in-transit rows at this cut-off. Use the page controls below to inspect all detail rows, or export the full report.</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>Quantity</th><th>Ledger value</th><th>Missing costs</th></tr></thead><tbody>{asOfControl?.warehouseRows.length ? asOfControl.warehouseRows.map(row => <tr key={`${row.item_id}-${row.warehouse_id}`}><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.quantity}</td><td>{row.stock_value}</td><td>{row.missing_cost_lines}</td></tr>) : <tr><td colSpan={5} className="empty">No posted warehouse movements by this date.</td></tr>}</tbody></table></div>{Boolean(asOfControl?.transitRows.length) && <div className="table-wrap"><table className="data-table"><thead><tr><th>Transfer</th><th>Item</th><th>Outstanding</th><th>Transit value</th></tr></thead><tbody>{asOfControl!.transitRows.map(row => <tr key={row.transfer_id}><td>{row.transfer_id.slice(0, 8)}</td><td>{row.item_code}</td><td>{row.quantity}</td><td>{row.stock_value}</td></tr>)}</tbody></table></div>}</section>;
  let content: React.ReactNode;
  switch (screen.title) {
    case 'Inventory Overview':
      content = (
        <InventoryOverviewView
          balances={balances}
          items={items}
          warehouses={warehouses}
          movements={movements}
          editions={editions}
          reconciliation={reconciliation}
          canWrite={canWrite}
          busy={busy}
          onRefresh={refresh}
          onAddItem={async (item) => {
            await act(async () => {
              await api('/items', {
                method: 'POST',
                body: JSON.stringify({
                  code: item.code,
                  name: item.name,
                  type: item.type,
                  uom: item.uom,
                  trackingPolicy: item.tracking,
                  editionId: item.editionId || null,
                }),
              });
              await refresh();
            }, 'Item created');
          }}
          onAddWarehouse={async (wh) => {
            await act(async () => {
              await api('/warehouses', {
                method: 'POST',
                body: JSON.stringify({
                  code: wh.code,
                  name: wh.name,
                  type: wh.type,
                }),
              });
              await refresh();
            }, 'Warehouse created');
          }}
        />
      );
      break;
    case 'Stock by Book/Edition':
      content = (
        <StockByBookEditionView
          balances={balances}
          warehouses={warehouses}
          busy={busy}
          onRefresh={refresh}
        />
      );
      break;
    case 'Stock by Warehouse/Bin':
      content = <>{balanceTable(balances)}<section className="panel catalog-form"><h2 className="section-title">Recorded receiving bins</h2><p className="muted">Bin locations below come from posted procurement receipts. Current lot-tracked stock includes tagged receipts, transfers, material issues and returns. Legacy untagged stock remains at warehouse level.</p></section>{currentLotTable}{lotTable}</>;
      break;
    case 'Batch/Lot Register':
        content = (
          <BatchLotRegisterView
            screen={screen}
            lotBalances={lotBalances}
            receiptLots={receiptLots}
            warehouses={warehouses}
            analysisWarehouse={analysisWarehouse}
            onWarehouseChange={setAnalysisWarehouse}
            lotSearch={lotSearch}
            onLotSearchChange={setLotSearch}
            busy={busy}
            onRefresh={refresh}
          />
        );
        break;
    case 'Quarantine & Damaged Stock':
      content = <><section className="panel catalog-form"><h2 className="section-title">Held stock</h2><p className="muted">Quarantine stock remains on hand and valued but has no available quantity. Damaged transfer receipts are recorded with their original transfer, lot and receiving reason. A later release or disposal requires a separately approved stock workflow.</p></section>{balanceTable(balances.filter(row => row.warehouse_type === 'quarantine'))}<h2 className="section-title">Damaged transfer receipts</h2><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Lot</th><th>Quarantine</th><th>Quantity</th><th>Reason</th><th>Transfer</th><th>Received</th></tr></thead><tbody>{damagedReceipts.length ? damagedReceipts.map(row => <tr key={row.id}><td>{row.item_code}</td><td>{row.lot_number || '—'}</td><td>{row.quarantine_code}</td><td>{row.quantity}</td><td>{row.damage_reason}</td><td>{row.transfer_id.slice(0, 8)}</td><td>{date(row.received_at)}</td></tr>) : <tr><td colSpan={7} className="empty">No damaged transfer receipts recorded.</td></tr>}</tbody></table></div></>;
      break;
    case 'Inventory Transaction Ledger':
      content = <>{movementTable}{selectedMovementId && <section className="panel catalog-form"><h2 className="section-title">Movement lines</h2>{movementLines.map(line => <p key={line.id}>{items.find(item => item.id === line.item_id)?.item_code || line.item_id} · {warehouses.find(item => item.id === line.warehouse_id)?.code || line.warehouse_id} · {line.quantity_delta} @ {line.unit_cost ?? 'pending'}{line.lot_number && <span> / Lot {line.lot_number} / Bin {line.bin_location || 'Unassigned'}</span>}</p>)}</section>}</>;
      break;
    case 'Goods Receipt':
      content = <><section className="panel catalog-form"><h2 className="section-title">Source-linked receipts</h2><p className="muted">Approved production and customer return documents post stock receipts.</p><div className="button-row"><Link className="btn btn-primary" href="/printing-production/production-receipt">Production receipt</Link></div></section><InventorySalesPanel mode="return" onPosted={refresh} />{movementTable}</>;
      break;
    case 'Stock Issue':
      content = (
        <StockIssueView
          screen={screen}
          balances={balances}
          items={items}
          warehouses={warehouses}
          movements={movements}
          canManage={canManage}
          canPost={canPost}
          canFinance={canFinance}
          userId={userId}
          busy={busy}
          onRefresh={refresh}
          onSelectMovement={setSelectedMovementId}
        />
      );
      break;
    case 'Stock Adjustment':
      content = <><section className="panel catalog-form"><h2 className="section-title">Approved stock adjustments</h2><p className="muted">Submit a physical count with a variance reason. An independent reviewer must approve it before the stock ledger changes.</p><div className="button-row"><Link className="btn btn-primary" href="/inventory-warehouse/physical-stock-count">Submit physical count</Link><Link className="btn" href="/inventory-warehouse/stock-count-variance-approval">Review count variances</Link></div></section>{movementTable}</>;
      break;
    case 'Reserved & Available Stock':
      content = <><section className="panel catalog-form"><h2 className="section-title">Source-linked reservations</h2><p className="muted">Available quantity is on-hand stock less active reservations. Production order reservations are managed from the material workflow so their stock issue and WIP accounting stay linked.</p><Link className="btn btn-primary" href="/printing-production/material-issue">Production material workflow</Link></section>{balanceTable(balances)}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>Source</th><th>Reserved</th><th>Consumed</th><th>Status</th><th>Action</th></tr></thead><tbody>{reservations.length ? reservations.map(row => <tr key={row.id}><td>{row.item_code}</td><td>{row.warehouse_code}</td><td>{row.document_type} · {row.document_id.slice(0, 8)}</td><td>{row.quantity}</td><td>{row.consumed_qty}</td><td>{row.status}</td><td>{canManage && row.status === 'active' && row.document_type !== 'print_order' && <button className="btn" disabled={busy} onClick={() => void releaseReservation(row.id)}>Release</button>}</td></tr>) : <tr><td colSpan={7} className="empty">No reservations yet.</td></tr>}</tbody></table></div></>;
      break;
    case 'Inventory Valuation':
        content = (
          <InventoryValuationView
            screen={screen}
            valuation={valuation}
            transitValuation={transitValuation}
            valuationTotals={valuationTotals}
            busy={busy}
            onRefresh={refresh}
          />
        );
        break;
    case 'Stock Reconciliation':
      content = <section className="panel catalog-form"><h2 className="section-title">{reconciliation?.reconciled ? 'Ledger and balances match' : 'Differences require review'}</h2><p>{reconciliation?.checked ?? 0} item and warehouse balances checked.</p>{reconciliation?.mismatches.map((row, index) => <p key={index}>{items.find(item => item.id === row.item_id)?.item_code || row.item_id} · {warehouses.find(item => item.id === row.warehouse_id)?.code || row.warehouse_id}: on hand {row.on_hand_qty}, ledger {row.ledger_qty}, reserved {row.reserved_qty}, reservation total {row.reservation_qty}</p>)}</section>;
      break;
    case 'Inventory Movement Analysis':
      content = <><section className="panel catalog-form"><h2 className="section-title">Posted movement activity</h2><div className="catalog-form-grid">{reportWarehouse}<label className="field">From date<input className="input" type="date" value={analysisFrom} onChange={event => setAnalysisFrom(event.target.value)} /></label><label className="field">To date<input className="input" type="date" value={analysisTo} onChange={event => setAnalysisTo(event.target.value)} /></label></div>{reportRefresh}<p className="muted">Only posted stock ledger entries are included. Up to 500 grouped rows are shown.</p></section><div className="panel table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Item</th><th>Warehouse</th><th>Movement</th><th>Source</th><th>Documents</th><th>In</th><th>Out</th></tr></thead><tbody>{movementAnalysis.length ? movementAnalysis.map((row, index) => <tr key={`${row.movement_date}-${row.item_code}-${row.warehouse_code}-${row.document_type}-${index}`}><td>{date(row.movement_date)}</td><td>{row.item_code} · {row.item_name}</td><td>{row.warehouse_code}</td><td>{row.transaction_type}</td><td>{row.document_type}</td><td>{row.documents}</td><td>{row.quantity_in}</td><td>{row.quantity_out}</td></tr>) : <tr><td colSpan={8} className="empty">No posted movements match these filters.</td></tr>}</tbody></table></div></>;
      break;
    case 'Slow-Moving Stock':
      content = (
        <SlowMovingStockView
          screen={screen}
          warehouses={warehouses}
          slowStock={slowStock}
          analysisWarehouse={analysisWarehouse}
          setAnalysisWarehouse={setAnalysisWarehouse}
          slowDays={slowDays}
          setSlowDays={setSlowDays}
          onRefresh={loadAnalytics}
          busy={busy}
        />
      );
      break;
    case 'Stock Ageing':
      content = (
        <StockAgeingView
          screen={screen}
          warehouses={warehouses}
          ageingStock={ageingStock}
          analysisWarehouse={analysisWarehouse}
          setAnalysisWarehouse={setAnalysisWarehouse}
          onRefresh={loadAnalytics}
          busy={busy}
        />
      );
      break;
    case 'Reorder Planning':
      content = <>{canManage && <section className="panel catalog-form"><h2 className="section-title">Reorder policy</h2><div className="catalog-form-grid">{itemSelector}{warehouseSelector}<label className="field">Minimum available quantity<input className="input" type="number" min="0" step="0.0001" value={minimumQty} onChange={event => setMinimumQty(event.target.value)} /></label><label className="field">Target available quantity<input className="input" type="number" min="0.0001" step="0.0001" value={targetQty} onChange={event => setTargetQty(event.target.value)} /></label><label className="field">Lead time (days)<input className="input" type="number" min="0" max="3650" value={leadDays} onChange={event => setLeadDays(event.target.value)} /></label></div><button className="btn btn-primary" disabled={busy || !selectedItem || !selectedWarehouse || minimumQty === '' || targetQty === '' || Number(targetQty) <= Number(minimumQty)} onClick={() => void saveReorderPolicy()}>Save policy</button><p className="muted">Suggestions use on-hand minus reserved stock. Review actual demand and supplier lead time before placing supplier orders.</p></section>}<div className="panel table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Warehouse</th><th>Available</th><th>Minimum</th><th>Target</th><th>Lead days</th><th>Suggested quantity</th><th>Action</th></tr></thead><tbody>{reorderPolicies.length ? reorderPolicies.map(row => <tr key={`${row.item_id}-${row.warehouse_id}`}><td>{row.item_code} · {row.item_name}</td><td>{row.warehouse_code}</td><td>{row.available_qty}</td><td>{row.minimum_qty}</td><td>{row.target_qty}</td><td>{row.lead_days}</td><td>{row.suggested_qty}</td><td><div className="button-row">{canManage && <><button className="btn" onClick={() => { setSelectedItem(row.item_id); setSelectedWarehouse(row.warehouse_id); setMinimumQty(row.minimum_qty); setTargetQty(row.target_qty); setLeadDays(String(row.lead_days)); }}>Edit</button><button className="btn" disabled={busy} onClick={() => void removeReorderPolicy(row)}>Remove</button></>}{Number(row.suggested_qty) > 0 && <Link className="btn btn-primary" href="/suppliers/supplier-directory">View Suppliers</Link>}</div></td></tr>) : <tr><td colSpan={8} className="empty">No reorder policies configured yet.</td></tr>}</tbody></table></div></>;
      content = <>{content}{canManage && <InventoryReorderImportPanel items={items} warehouses={warehouses} onImported={loadAnalytics} />}</>;
      break;
    case 'Stock Transfer':
      content = (
        <StockTransferView
          screen={screen}
          transfers={transfers}
          transferReceipts={transferReceipts}
          transferDiscrepancies={transferDiscrepancies}
          selectedTransferId={selectedTransferId}
          items={items}
          warehouses={warehouses}
          balances={balances}
          lotBalances={lotBalances}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          selectedWarehouse={selectedWarehouse}
          setSelectedWarehouse={setSelectedWarehouse}
          destinationWarehouse={destinationWarehouse}
          setDestinationWarehouse={setDestinationWarehouse}
          transferQuantity={transferQuantity}
          setTransferQuantity={setTransferQuantity}
          transferLotKey={transferLotKey}
          setTransferLotKey={setTransferLotKey}
          destinationBin={destinationBin}
          setDestinationBin={setDestinationBin}
          receiptQuantities={receiptQuantities}
          setReceiptQuantities={setReceiptQuantities}
          damagedQuantity={damagedQuantity}
          setDamagedQuantity={setDamagedQuantity}
          damageWarehouse={damageWarehouse}
          setDamageWarehouse={setDamageWarehouse}
          damageReason={damageReason}
          setDamageReason={setDamageReason}
          shortageReason={shortageReason}
          setShortageReason={setShortageReason}
          reviewReason={reviewReason}
          setReviewReason={setReviewReason}
          onSelectTransferId={setSelectedTransferId}
          onCreateTransfer={createTransfer}
          onAdvanceTransfer={advanceTransfer}
          onReportShortage={reportShortage}
          onReviewShortage={reviewShortage}
          onRefresh={refresh}
          canWrite={canWrite}
          canPost={canPost}
          canFinance={canFinance}
          userId={userId}
          role={role}
          busy={busy}
        />
      );
      break;
    case 'Transfer Approval & Receipt':
    case 'In-Transit Stock':
      content = transferTable(screen.title === 'In-Transit Stock' ? transfers.filter(row => ['in_transit', 'partially_received'].includes(row.status)) : transfers);
      break;
    case 'Physical Stock Count':
      content = (
        <PhysicalStockCountView
          screen={screen}
          items={items}
          warehouses={warehouses}
          balances={balances}
          lotBalances={lotBalances}
          stockCounts={stockCounts}
          selectedCountId={selectedCountId}
          countEvidence={countEvidence}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          selectedWarehouse={selectedWarehouse}
          setSelectedWarehouse={setSelectedWarehouse}
          countedQuantity={countedQuantity}
          setCountedQuantity={setCountedQuantity}
          varianceReason={varianceReason}
          setVarianceReason={setVarianceReason}
          transferLotKey={transferLotKey}
          setTransferLotKey={setTransferLotKey}
          recountQuantity={recountQuantity}
          setRecountQuantity={setRecountQuantity}
          recountReason={recountReason}
          setRecountReason={setRecountReason}
          onCreateCount={createCount}
          onShowCountEvidence={showCountEvidence}
          onSubmitRecount={submitRecount}
          onReviewCount={reviewCount}
          onRefresh={refresh}
          canWrite={canWrite}
          canPost={canPost}
          canFinance={canFinance}
          userId={userId}
          role={role}
          busy={busy}
        />
      );
      break;
    case 'Stock Count Variance Approval':
      content = <><p className="muted">Review current book quantity against the counted quantity. Another user must decide; approval rechecks stock and posts an immutable variance movement.</p>{countTable(true)}</>;
      break;
    default:
      content = <p className="empty">Inventory screen is being prepared.</p>;
  }
  if (screen.title === 'Stock Count Variance Approval') content = <>{content}{adjustmentConfigSection}</>;
  if (['Stock Transfer', 'Transfer Approval & Receipt', 'In-Transit Stock'].includes(screen.title)) content = <>{content}{discrepancyPanel}</>;
  if (screen.title === 'Quarantine & Damaged Stock') content = <>{content}{qcPanel}</>;
  if (screen.title === 'Inventory Transaction Ledger') content = <>{content}<InventoryOpeningPanel items={items} warehouses={warehouses} onPosted={refresh} /></>;
  const asOfPageActions = asOfControl && <section className="panel catalog-form"><div className="button-row"><button className="btn" disabled={busy || !asOfDate} onClick={() => void exportAsOfCsv()}>Export all as CSV</button></div><div className="button-row"><span>Warehouse rows {asOfControl.warehouseRowCount ? asOfControl.warehouseOffset + 1 : 0}–{Math.min(asOfControl.warehouseOffset + asOfControl.rowLimit, asOfControl.warehouseRowCount)} of {asOfControl.warehouseRowCount}</span><button className="btn" disabled={busy || asOfControl.warehouseOffset === 0} onClick={() => void applyAsOfDate(Math.max(0, asOfControl.warehouseOffset - asOfControl.rowLimit), asOfControl.transitOffset, asOfControl.asOf)}>Previous warehouse page</button><button className="btn" disabled={busy || asOfControl.warehouseOffset + asOfControl.rowLimit >= asOfControl.warehouseRowCount} onClick={() => void applyAsOfDate(asOfControl.warehouseOffset + asOfControl.rowLimit, asOfControl.transitOffset, asOfControl.asOf)}>Next warehouse page</button></div><div className="button-row"><span>Transit rows {asOfControl.transitRowCount ? asOfControl.transitOffset + 1 : 0}–{Math.min(asOfControl.transitOffset + asOfControl.rowLimit, asOfControl.transitRowCount)} of {asOfControl.transitRowCount}</span><button className="btn" disabled={busy || asOfControl.transitOffset === 0} onClick={() => void applyAsOfDate(asOfControl.warehouseOffset, Math.max(0, asOfControl.transitOffset - asOfControl.rowLimit), asOfControl.asOf)}>Previous transit page</button><button className="btn" disabled={busy || asOfControl.transitOffset + asOfControl.rowLimit >= asOfControl.transitRowCount} onClick={() => void applyAsOfDate(asOfControl.warehouseOffset, asOfControl.transitOffset + asOfControl.rowLimit, asOfControl.asOf)}>Next transit page</button></div></section>;
  if (canFinance && screen.title === 'Stock Reconciliation') content = <>{content}{asOfPanel}{asOfPageActions}</>;
  if (screen.title === 'Stock Reconciliation') content = <>{content}{lotReconciliationPanel}{canFinance && <InventoryLegacyPreviewPanel />}{canFinance && glControlPanel}{canFinance ? <section className="panel catalog-form"><h2 className="section-title">Inventory movement to GL reconciliation</h2><p className="muted">Checks up to 500 recent posted source-linked movements against their posted, balanced and unreversed journal and inventory account entry. This does not replace a period-end GL control account reconciliation.</p><p>{glReconciliation?.matched ?? 0} matched · {glReconciliation?.exceptions ?? 0} exceptions from {glReconciliation?.checked ?? 0} movements</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Source</th><th>Posted</th><th>Stock value</th><th>Journal</th><th>Result</th></tr></thead><tbody>{glReconciliation?.rows.length ? glReconciliation.rows.map(row => <tr key={row.transactionId}><td>{row.documentType} · {row.documentId.slice(0, 8)}</td><td>{date(row.postedAt)}</td><td>{row.stockValue}</td><td>{row.journalId?.slice(0, 8) ?? 'Missing'}</td><td>{row.status.replaceAll('_', ' ')}</td></tr>) : <tr><td colSpan={5} className="empty">No source-linked posted movements to reconcile.</td></tr>}</tbody></table></div></section> : <section className="panel catalog-form"><p>Finance access is required for the journal reconciliation.</p></section>}</>;
  if (['Inventory Overview', 'Stock by Book/Edition', 'Stock Issue', 'Stock Transfer', 'Physical Stock Count', 'Stock Ageing', 'Slow-Moving Stock', 'Inventory Valuation', 'Batch/Lot Register'].includes(screen.title)) {
    return (
      <div suppressHydrationWarning>
        {error && <div className="alert-error" role="alert" style={{ margin: '1rem 1.5rem 0' }}>⚠️ {error}</div>}
        {notice && <div className="alert-success" role="status" style={{ margin: '1rem 1.5rem 0' }}>✅ {notice}</div>}
        {loading ? <div className="panel empty" suppressHydrationWarning style={{ margin: '3rem auto', textAlign: 'center' }}>Loading publication stock data…</div> : content}
      </div>
    );
  }

  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{screen.description}</p></div><button className="btn" onClick={() => void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Refresh failed'))}>Refresh</button></div>{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{loading ? <div className="panel empty">Loading inventory…</div> : content}</>;
}
