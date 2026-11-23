"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Users,
  Store,
  DollarSign,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  Edit3,
  ChevronRight,
  LayoutGrid,
  List,
  Building2,
  Tag,
  ShieldCheck,
  FileText,
  X,
  Sparkles,
  ArrowUpRight,
  Layers,
  ChevronDown,
  RotateCcw,
  Check,
  TrendingUp,
  Trash2,
  Lock,
  Printer,
  CreditCard,
  Smartphone,
  Receipt,
  ShoppingCart,
  BarChart3,
  Wallet,
  BookOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type Event = {
  id: string;
  event_code: string;
  name_en: string;
  event_type: string;
  organizer_name: string | null;
  description: string | null;
  event_year: number;
  venue: string;
  venue_address: string | null;
  city: string | null;
  timezone: string;
  setup_start_date: string | null;
  start_date: string;
  end_date: string;
  dismantle_date: string | null;
  manager_id: string | null;
  finance_owner_id: string | null;
  warehouse_coordinator_id: string | null;
  sales_target: string;
  budget_amount: string;
  status: string;
  version_no: number;
  created_by: string;
  manager_name?: string;
  booth_count?: number;
};

type History = {
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_name: string;
  occurred_at: string;
};

type Booth = {
  id: string;
  booth_code: string;
  booth_name: string;
  booth_type: string;
  zone: string | null;
  manager_name: string | null;
  stock_warehouse_id?: string | null;
  stock_warehouse_name: string | null;
  status: string;
};

type Staff = {
  id: string;
  booth_id: string;
  booth_code: string;
  user_id: string;
  staff_name: string;
  staff_role: string;
  shift_start: string;
  shift_end: string;
  status: string;
};

type Option = { id: string; display_name?: string; code?: string; name?: string };

type Form = {
  code: string;
  name: string;
  type: string;
  organizerName: string;
  description: string;
  year: string;
  venue: string;
  venueAddress: string;
  city: string;
  timezone: string;
  setupStartDate: string;
  startDate: string;
  endDate: string;
  dismantleDate: string;
  managerId: string;
  financeOwnerId: string;
  warehouseCoordinatorId: string;
  salesTarget: string;
  budgetAmount: string;
};

const blank = (): Form => ({
  code: '',
  name: '',
  type: 'book_fair',
  organizerName: '',
  description: '',
  year: String(new Date().getFullYear()),
  venue: '',
  venueAddress: '',
  city: '',
  timezone: 'Asia/Dhaka',
  setupStartDate: '',
  startDate: '',
  endDate: '',
  dismantleDate: '',
  managerId: '',
  financeOwnerId: '',
  warehouseCoordinatorId: '',
  salesTarget: '0',
  budgetAmount: '0',
});

const fmt = (value?: string | null) => (value ? value.slice(0, 10) : '—');
const money = (val: unknown) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

const types = [
  { value: 'book_fair', label: 'Book Fair (বইমেলা)', icon: '🎪' },
  { value: 'education_fair', label: 'Education Fair', icon: '🎓' },
  { value: 'institutional_event', label: 'Institutional Event', icon: '🏛️' },
  { value: 'launch', label: 'Book Launch', icon: '🚀' },
  { value: 'exhibition', label: 'Exhibition', icon: '🎨' },
  { value: 'other', label: 'Other Event', icon: '📌' },
];

const boothTypes = ['standard', 'shared', 'corner', 'pavilion', 'temporary_counter', 'institutional_desk', 'other'];
const staffRoles = [
  'event_manager',
  'booth_manager',
  'salesperson',
  'cashier',
  'inventory_custodian',
  'shift_supervisor',
  'finance_reviewer',
  'stock_receiver',
  'support',
];

function renderStatusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    draft: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Draft' },
    submitted: { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd', label: 'Submitted' },
    approved: { bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd', label: 'Approved' },
    rejected: { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', label: 'Rejected' },
    setup: { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'In Setup' },
    ready: { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7', label: 'Ready' },
    active: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Live / Active' },
    completed: { bg: '#f0fdfa', color: '#0f766e', border: '#5eead4', label: 'Completed' },
    closed: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'Closed' },
    cancelled: { bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8', label: 'Cancelled' },
  };
  const match = map[status?.toLowerCase()] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: status };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11.5,
        fontWeight: 600,
        background: match.bg,
        color: match.color,
        border: `1px solid ${match.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: match.color,
        }}
      />
      {match.label}
    </span>
  );
}

function getEventTiming(startDate: string, endDate: string) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now > end) {
    return { label: 'Past Event', color: '#64748b', bg: '#f1f5f9' };
  } else if (now >= start && now <= end) {
    return { label: 'Live Now', color: '#15803d', bg: '#dcfce7' };
  } else {
    const diffDays = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      return { label: `In ${diffDays} days`, color: '#b45309', bg: '#fef3c7' };
    }
    return { label: `Starts ${startDate.slice(0, 10)}`, color: '#475569', bg: '#f1f5f9' };
  }
}

export function FairEventScreen({ screen }: { screen: Screen }) {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedId, setSelectedId] = useState('');
  const [detailTab, setDetailTab] = useState<'overview' | 'booths' | 'staff' | 'history'>('overview');
  const [detail, setDetail] = useState<{ event: Event; history: History[] } | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [me, setMe] = useState<{ userId: string; role: string; permissions: string[] } | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [reason, setReason] = useState('');
  const [booth, setBooth] = useState({ code: '', name: '', type: 'standard', zone: '', managerId: '', stockWarehouseId: '' });
  const [assignment, setAssignment] = useState({ boothId: '', userId: '', role: 'salesperson', shiftStart: '', shiftEnd: '' });
  const [inspectBooth, setInspectBooth] = useState<Booth | null>(null);
  const [showAddBoothModal, setShowAddBoothModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = me?.role === 'Owner' || Boolean(me?.permissions.includes('fair.manage'));
  const canApprove = me?.role === 'Owner' || Boolean(me?.permissions.includes('fair.approve'));
  const selected = detail?.event.id === selectedId ? detail.event : null;
  const formMode = screen.title === 'Create/Edit Fair';
  const boothMode = screen.title === 'Fair Setup & Booth';
  const allocationMode = screen.title === 'Fair Stock Allocation';
  const salesMode = screen.title === 'Fair Sales Entry';
  const postFairStockMode = screen.title === 'Post-Fair Stock Reconciliation';
  const reportsMode = screen.title === 'Fair Reports' || screen.title === 'Fair Profitability Report' || screen.title === 'Fair Expense Register' || screen.title === 'Fair Discount Approval';

  type StockOverview = {
    event: Event;
    booths: Booth[];
    currentStock: Array<{
      item_id: string;
      item_code: string;
      item_name: string;
      warehouse_id: string;
      warehouse_name: string;
      booth_code?: string;
      booth_name?: string;
      on_hand_qty: number;
      average_unit_cost: number;
    }>;
    transfers: Array<{
      id: string;
      item_id: string;
      source_warehouse_id: string;
      destination_warehouse_id: string;
      quantity: number;
      received_qty: number;
      status: string;
      created_at: string;
      dispatched_at?: string;
      received_at?: string;
      item_code: string;
      item_name: string;
      source_warehouse_name: string;
      destination_warehouse_name: string;
      booth_code?: string;
      booth_name?: string;
    }>;
    availableStock: Array<{
      warehouse_id: string;
      warehouse_name: string;
      warehouse_code: string;
      item_id: string;
      item_code: string;
      item_name: string;
      on_hand_qty: number;
      average_unit_cost: number;
    }>;
  };

  type SalesOverview = {
    event: Event;
    booths: Booth[];
    availableStock: Array<{
      item_id: string;
      warehouse_id: string;
      on_hand_qty: number;
      average_unit_cost: number;
      item_code: string;
      item_name: string;
      warehouse_name: string;
      booth_id: string;
      booth_code: string;
      booth_name: string;
      cover_price: number;
    }>;
    recentReceipts: Array<{
      id: string;
      receipt_number: string;
      receipt_date: string;
      customer_name: string | null;
      customer_phone: string | null;
      subtotal: number;
      discount_percent: number;
      discount_amount: number;
      total_amount: number;
      payment_method: string;
      cash_tendered: number | null;
      change_due: number | null;
      notes: string | null;
      status: string;
      created_at: string;
      booth_id: string;
      booth_code: string;
      booth_name: string;
      cashier_name: string;
      lines: Array<{
        id: string;
        receipt_id: string;
        item_id: string;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        discount_amount: number;
        line_total: number;
        item_code: string;
        item_name: string;
      }>;
    }>;
    kpis: {
      totalRevenue: number;
      totalCopiesSold: number;
      totalReceipts: number;
      cashTotal: number;
      mfsTotal: number;
      cardTotal: number;
    };
  };

  const [stockData, setStockData] = useState<StockOverview | null>(null);
  const [stockSearch, setStockSearch] = useState('');
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [inspectTransfer, setInspectTransfer] = useState<any | null>(null);
  const [allocateForm, setAllocateForm] = useState({
    destinationWarehouseId: '',
    sourceWarehouseId: '',
    itemId: '',
    quantity: '',
    autoReceive: true,
  });
  const [activeStockTab, setActiveStockTab] = useState<'stock' | 'transfers'>('stock');
  const [stallFilter, setStallFilter] = useState('');
  const [transferFilter, setTransferFilter] = useState<'all' | 'pending' | 'received'>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('');

  // Sales Mode State
  const [salesData, setSalesData] = useState<SalesOverview | null>(null);
  const [selectedBoothId, setSelectedBoothId] = useState('');
  const [cart, setCart] = useState<Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    maxQty: number;
  }>>([]);
  const [saleCustomer, setSaleCustomer] = useState({
    name: '',
    phone: '',
    paymentMethod: 'cash' as 'cash' | 'bkash' | 'nagad' | 'card',
    discountPercent: '25',
    cashTendered: '',
    notes: '',
  });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [inspectReceipt, setInspectReceipt] = useState<any | null>(null);
  const [salesTab, setSalesTab] = useState<'receipts' | 'catalog'>('receipts');

  // Post-Fair Stock Reconciliation State
  type PostFairOverview = {
    event: Event;
    booths: Booth[];
    centralWarehouses: Array<{
      id: string;
      code: string;
      name: string;
      warehouse_type: string;
    }>;
    stockSummary: Array<{
      booth_id: string;
      booth_code: string;
      booth_name: string;
      warehouse_id: string;
      warehouse_name: string;
      item_id: string;
      item_code: string;
      item_name: string;
      edition_id: string;
      current_stall_qty: number;
      average_unit_cost: number;
      cover_price: number;
      allocated_qty: number;
      sold_qty: number;
      returned_qty: number;
    }>;
    returnTransfers: Array<{
      id: string;
      item_id: string;
      source_warehouse_id: string;
      destination_warehouse_id: string;
      quantity: number;
      received_qty: number;
      status: string;
      created_at: string;
      received_at: string;
      item_code: string;
      item_name: string;
      source_warehouse_name: string;
      destination_warehouse_name: string;
      booth_code: string;
      booth_name: string;
      returned_by_name?: string;
    }>;
    kpis: {
      totalAllocatedCopies: number;
      totalCopiesSold: number;
      totalCurrentInStall: number;
      totalReturnedCopies: number;
      totalRemainingValue: number;
    };
  };

  const [postFairData, setPostFairData] = useState<PostFairOverview | null>(null);
  const [returnDestWarehouseId, setReturnDestWarehouseId] = useState('');
  const [returnBoothFilter, setReturnBoothFilter] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [activeReturnTab, setActiveReturnTab] = useState<'return' | 'history'>('return');
  const [returnInputs, setReturnInputs] = useState<Record<string, { sound: string; damaged: string; notes: string }>>({});
  const [returnNotes, setReturnNotes] = useState('');

  type FairReportsOverview = {
    event: Event;
    financialSummary: {
      grossSales: number;
      totalDiscounts: number;
      netSales: number;
      totalMemos: number;
      totalCopiesSold: number;
      salesTarget: number;
      budgetAmount: number;
      targetAchievementPct: number;
      cogs: number;
      grossProfit: number;
      grossMarginPct: number;
      totalExpenses: number;
      netProfit: number;
      netMarginPct: number;
      roiPct: number;
    };
    salesByPaymentMethod: Array<{
      paymentMethod: string;
      memoCount: number;
      totalAmount: number;
      sharePct: number;
    }>;
    dailySalesTrend: Array<{
      saleDate: string;
      memoCount: number;
      netSales: number;
      discountAmount: number;
      copiesSold: number;
    }>;
    boothPerformance: Array<{
      boothId: string;
      boothNumber: string;
      boothName: string;
      boothType: string;
      inChargeName: string | null;
      memoCount: number;
      copiesSold: number;
      netSales: number;
      avgTicket: number;
    }>;
    topSellingBooks: Array<{
      itemId: string;
      itemCode: string;
      itemName: string;
      copiesSold: number;
      avgUnitPrice: number;
      totalDiscount: number;
      totalNetSales: number;
    }>;
    expenses: Array<{
      id: string;
      expenseCategory: string;
      description: string;
      amount: number;
      expenseDate: string;
      paidTo: string | null;
      paymentMethod: string;
      receiptRef: string | null;
      createdAt: string;
    }>;
    inventoryAudit: {
      totalAllocated: number;
      totalCopiesSold: number;
      totalInStall: number;
      totalReturned: number;
      reconciliationStatus: string;
    };
  };

  const [reportsData, setReportsData] = useState<FairReportsOverview | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<'profitability' | 'sales' | 'booths' | 'inventory'>('profitability');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expenseCategory: 'Stall Rent & Space',
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paidTo: '',
    paymentMethod: 'cash',
    receiptRef: '',
  });


  async function loadEvents() {
    const params = new URLSearchParams({ q: search, limit: '25', offset: String(page * 25) });
    if (statusFilter) params.set('status', statusFilter);
    const result = await api<{ data: Event[]; meta: { total: number } }>(`/fair/events?${params}`);
    setEvents(result.data);
    setTotal(result.meta.total);
  }

  async function loadDetail(id: string) {
    const [eventResult, boothResult, staffResult] = await Promise.all([
      api<{ data: { event: Event; history: History[] } }>(`/fair/events/${id}`),
      api<{ data: Booth[] }>(`/fair/events/${id}/booths`),
      api<{ data: Staff[] }>(`/fair/events/${id}/staff`),
    ]);
    setDetail(eventResult.data);
    setBooths(boothResult.data);
    setStaff(staffResult.data);
    const row = eventResult.data.event;
    setForm({
      code: row.event_code,
      name: row.name_en,
      type: row.event_type,
      organizerName: row.organizer_name || '',
      description: row.description || '',
      year: String(row.event_year),
      venue: row.venue,
      venueAddress: row.venue_address || '',
      city: row.city || '',
      timezone: row.timezone,
      setupStartDate: fmt(row.setup_start_date) === '—' ? '' : fmt(row.setup_start_date),
      startDate: fmt(row.start_date),
      endDate: fmt(row.end_date),
      dismantleDate: fmt(row.dismantle_date) === '—' ? '' : fmt(row.dismantle_date),
      managerId: row.manager_id || '',
      financeOwnerId: row.finance_owner_id || '',
      warehouseCoordinatorId: row.warehouse_coordinator_id || '',
      salesTarget: String(row.sales_target),
      budgetAmount: String(row.budget_amount),
    });
  }

  useEffect(() => {
    setMounted(true);
    const eventId = new URLSearchParams(window.location.search).get('event');
    if (eventId) setSelectedId(eventId);
    void Promise.all([
      api<{ data: { userId: string; role: string; permissions: string[] } }>('/auth/me'),
      api<{ data: { users: Option[]; warehouses: Option[] } }>('/fair/options'),
    ])
      .then(([user, options]) => {
        setMe(user.data);
        setUsers(options.data.users);
        setWarehouses(options.data.warehouses);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load fair options'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadEvents().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load fair events'));
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setBooths([]);
      setStaff([]);
      setStockData(null);
      setSalesData(null);
      setReportsData(null);
      setForm(blank());
      return;
    }
    void loadDetail(selectedId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load fair event'));
    if (allocationMode) {
      void loadStockOverview(selectedId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load fair stock overview'));
    }
    if (salesMode) {
      void loadSalesOverview(selectedId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load fair sales overview'));
    }
    if (postFairStockMode) {
      void loadPostFairOverview(selectedId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load post-fair stock overview'));
    }
    if (reportsMode) {
      void loadFairReports(selectedId).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load fair reports'));
    }
  }, [selectedId, allocationMode, salesMode, postFairStockMode, reportsMode]);

  useEffect(() => {
    if ((boothMode || allocationMode || salesMode || postFairStockMode || reportsMode) && !selectedId && events.length > 0) {
      const activeOrFirst = events.find(e => e.status !== 'closed') || events[0];
      if (activeOrFirst) setSelectedId(activeOrFirst.id);
    }
  }, [events, boothMode, allocationMode, salesMode, postFairStockMode, reportsMode, selectedId]);


  async function loadFairReports(id: string) {
    const result = await api<{ data: FairReportsOverview }>(`/fair/events/${id}/reports`);
    setReportsData(result.data);
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setBusy(true);
      setError('');
      await api(`/fair/events/${selectedId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(expenseForm),
      });
      setNotice('Fair operational expense recorded successfully');
      setExpenseModalOpen(false);
      setExpenseForm({
        expenseCategory: 'Stall Rent & Space',
        description: '',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paidTo: '',
        paymentMethod: 'cash',
        receiptRef: '',
      });
      await loadFairReports(selectedId);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Could not save fair expense');
    } finally {
      setBusy(false);
    }
  }

  async function loadPostFairOverview(id: string) {
    const result = await api<{ data: PostFairOverview }>(`/fair/events/${id}/post-fair-stock`);
    setPostFairData(result.data);
    if (result.data.centralWarehouses.length > 0) {
      setReturnDestWarehouseId(prev => prev || result.data.centralWarehouses[0].id);
    }
    const initialInputs: Record<string, { sound: string; damaged: string; notes: string }> = {};
    for (const row of result.data.stockSummary) {
      const key = `${row.booth_id}_${row.item_id}`;
      const onHand = Math.max(0, Math.floor(Number(row.current_stall_qty || 0)));
      initialInputs[key] = {
        sound: String(onHand),
        damaged: '0',
        notes: '',
      };
    }
    setReturnInputs(initialInputs);
  }

  async function executePostFairReturn() {
    if (!selected) return;
    if (!returnDestWarehouseId) {
      setError('Please select a destination central warehouse to receive the returned stock.');
      return;
    }
    const availableBooths = postFairData?.booths || [];
    const activeBoothId = returnBoothFilter || (availableBooths.length > 0 ? availableBooths[0].id : '');
    if (!activeBoothId) {
      setError('No stall/booth available for return.');
      return;
    }

    const boothItems = (postFairData?.stockSummary || []).filter(s => s.booth_id === activeBoothId);
    if (boothItems.length === 0) {
      setError('No books found for this stall to return.');
      return;
    }

    const itemsToReturn: Array<{ itemId: string; soundQty: number; damagedQty: number; lostQty: number; notes: string | null }> = [];
    for (const item of boothItems) {
      const key = `${item.booth_id}_${item.item_id}`;
      const val = returnInputs[key] || { sound: '0', damaged: '0', notes: '' };
      const soundQty = Math.max(0, parseInt(val.sound, 10) || 0);
      const damagedQty = Math.max(0, parseInt(val.damaged, 10) || 0);
      const onHand = Math.max(0, Math.floor(Number(item.current_stall_qty || 0)));
      const lostQty = Math.max(0, onHand - (soundQty + damagedQty));

      if (soundQty + damagedQty > onHand) {
        setError(`Cannot return/write off ${soundQty + damagedQty} copies for "${item.item_name}" because only ${onHand} copies remain in the stall.`);
        return;
      }

      if (soundQty > 0 || damagedQty > 0 || lostQty > 0) {
        itemsToReturn.push({
          itemId: item.item_id,
          soundQty,
          damagedQty,
          lostQty,
          notes: val.notes || null,
        });
      }
    }

    if (itemsToReturn.length === 0) {
      setError('No quantities specified for return or write-off.');
      return;
    }

    const destWh = (postFairData?.centralWarehouses || []).find(w => w.id === returnDestWarehouseId);
    const destName = destWh ? destWh.name : 'Central Warehouse';
    const totalSound = itemsToReturn.reduce((sum, i) => sum + i.soundQty, 0);
    const totalDamaged = itemsToReturn.reduce((sum, i) => sum + i.damagedQty, 0);
    const totalLost = itemsToReturn.reduce((sum, i) => sum + i.lostQty, 0);

    const confirmMsg = `Confirm Post-Fair Stock Reconciliation:\n\n• Sound Return to ${destName}: ${totalSound} copies\n• Damaged Copies: ${totalDamaged} copies\n• Missing / Shrinkage: ${totalLost} copies\n\nSound copies will be restocked to ${destName} and stall balances updated. Proceed?`;
    if (!window.confirm(confirmMsg)) return;

    await act(async () => {
      await api(
        `/fair/events/${selected.id}/post-fair-stock/return`,
        {
          method: 'POST',
          body: JSON.stringify({
            destinationWarehouseId: returnDestWarehouseId,
            boothId: activeBoothId,
            notes: returnNotes || null,
            items: itemsToReturn,
          }),
        }
      );
      setReturnNotes('');
      await loadPostFairOverview(selected.id);
    }, `Successfully returned ${totalSound} copies to ${destName}!`);
  }

  async function loadStockOverview(id: string) {
    const result = await api<{ data: StockOverview }>(`/fair/events/${id}/stock`);
    setStockData(result.data);
  }

  async function allocateStock() {
    if (!selected) return;
    if (!allocateForm.destinationWarehouseId || !allocateForm.sourceWarehouseId || !allocateForm.itemId || !allocateForm.quantity) {
      setError('Please select destination stall, source warehouse, book item, and valid quantity');
      return;
    }
    await act(async () => {
      await api(`/fair/events/${selected.id}/stock-allocate`, {
        method: 'POST',
        body: JSON.stringify({
          sourceWarehouseId: allocateForm.sourceWarehouseId,
          destinationWarehouseId: allocateForm.destinationWarehouseId,
          itemId: allocateForm.itemId,
          quantity: Number(allocateForm.quantity),
          autoReceive: allocateForm.autoReceive,
        }),
      });
      setAllocateForm({ destinationWarehouseId: '', sourceWarehouseId: '', itemId: '', quantity: '', autoReceive: true });
      setShowAllocateModal(false);
      await loadStockOverview(selected.id);
    }, 'Stock allocated to fair stall successfully');
  }

  async function receiveTransfer(transferId: string) {
    if (!selected) return;
    await act(async () => {
      await api(`/fair/events/${selected.id}/transfers/${transferId}/receive`, { method: 'POST' });
      if (inspectTransfer?.id === transferId) setInspectTransfer(null);
      await loadStockOverview(selected.id);
    }, 'Stock transfer received into fair stall warehouse');
  }

  async function cancelTransfer(transferId: string) {
    if (!selected) return;
    if (!window.confirm('Are you sure you want to cancel this stock transfer?')) return;
    await act(async () => {
      await api(`/fair/events/${selected.id}/transfers/${transferId}`, { method: 'DELETE' });
      if (inspectTransfer?.id === transferId) setInspectTransfer(null);
      await loadStockOverview(selected.id);
    }, 'Stock transfer cancelled successfully');
  }

  async function loadSalesOverview(id: string) {
    const result = await api<{ data: SalesOverview }>(`/fair/events/${id}/sales`);
    setSalesData(result.data);
    if (!selectedBoothId && result.data.booths?.length > 0) {
      const firstWithStock = result.data.booths.find(b => b.stock_warehouse_id) || result.data.booths[0];
      if (firstWithStock) setSelectedBoothId(firstWithStock.id);
    }
  }

  function addToCart(book: any) {
    const existingIndex = cart.findIndex(c => c.itemId === book.item_id);
    const maxQty = Number(book.on_hand_qty);
    if (existingIndex >= 0) {
      const current = cart[existingIndex];
      if (current.quantity < maxQty) {
        const next = [...cart];
        next[existingIndex] = { ...current, quantity: current.quantity + 1 };
        setCart(next);
      } else {
        setNotice(`Maximum available copies (${maxQty}) reached for ${book.item_name}`);
      }
    } else {
      setCart([
        ...cart,
        {
          itemId: book.item_id,
          itemCode: book.item_code,
          itemName: book.item_name,
          quantity: 1,
          unitPrice: Number(book.cover_price || 250),
          discountPercent: Number(saleCustomer.discountPercent || 25),
          maxQty,
        },
      ]);
    }
  }

  function updateCartItem(index: number, patch: Partial<{ quantity: number; unitPrice: number; discountPercent: number }>) {
    const next = [...cart];
    const item = next[index];
    let qty = patch.quantity !== undefined ? patch.quantity : item.quantity;
    if (qty > item.maxQty) qty = item.maxQty;
    if (qty < 1) qty = 1;
    next[index] = { ...item, ...patch, quantity: qty };
    setCart(next);
  }

  function applyGlobalDiscount(pct: number) {
    setSaleCustomer({ ...saleCustomer, discountPercent: String(pct) });
    setCart(cart.map(c => ({ ...c, discountPercent: pct })));
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
  }

  async function submitSale() {
    if (!selected) return;
    if (!selectedBoothId) {
      setError('Please select an active stall / counter');
      return;
    }
    if (cart.length === 0) {
      setError('Cart is empty. Add at least one book to complete the sale');
      return;
    }
    const currentSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const currentDiscount = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.discountPercent) / 100, 0);
    const currentNetTotal = Math.max(0, currentSubtotal - currentDiscount);

    if (saleCustomer.paymentMethod === 'cash' && saleCustomer.cashTendered && Number(saleCustomer.cashTendered) < currentNetTotal) {
      setError(`Cash tendered (৳ ${money(saleCustomer.cashTendered)}) is less than total payable (৳ ${money(currentNetTotal)})`);
      return;
    }

    await act(async () => {
      const result = await api<{ data: any }>(`/fair/events/${selected.id}/sales`, {
        method: 'POST',
        body: JSON.stringify({
          boothId: selectedBoothId,
          customerName: saleCustomer.name || null,
          customerPhone: saleCustomer.phone || null,
          paymentMethod: saleCustomer.paymentMethod,
          discountPercent: Number(saleCustomer.discountPercent || 0),
          cashTendered: saleCustomer.paymentMethod === 'cash' && saleCustomer.cashTendered ? Number(saleCustomer.cashTendered) : null,
          notes: saleCustomer.notes || null,
          items: cart.map(c => ({
            itemId: c.itemId,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            discountPercent: c.discountPercent,
          })),
        }),
      });

      const currentBooth = (salesData?.booths || []).find(b => b.id === selectedBoothId);
      const tender = saleCustomer.cashTendered ? Number(saleCustomer.cashTendered) : null;
      const change = tender !== null && tender >= currentNetTotal ? tender - currentNetTotal : 0;

      const newReceipt = {
        id: result.data.receiptId,
        receipt_number: result.data.receiptNumber,
        receipt_date: new Date().toISOString().slice(0, 10),
        customer_name: saleCustomer.name || null,
        customer_phone: saleCustomer.phone || null,
        subtotal: currentSubtotal,
        discount_percent: Number(saleCustomer.discountPercent || 0),
        discount_amount: currentDiscount,
        total_amount: currentNetTotal,
        payment_method: saleCustomer.paymentMethod,
        cash_tendered: tender,
        change_due: change,
        notes: saleCustomer.notes || null,
        status: 'completed',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        booth_name: currentBooth?.booth_name || 'Fair Stall',
        booth_code: currentBooth?.booth_code || 'B-01',
        cashier_name: me?.role || 'Cashier',
        lines: cart.map(c => ({
          item_name: c.itemName,
          item_code: c.itemCode,
          quantity: c.quantity,
          unit_price: c.unitPrice,
          discount_percent: c.discountPercent,
          discount_amount: (c.quantity * c.unitPrice * c.discountPercent) / 100,
          line_total: c.quantity * c.unitPrice - (c.quantity * c.unitPrice * c.discountPercent) / 100,
        })),
      };

      setInspectReceipt(newReceipt);
      clearCart();
      setSaleCustomer({ name: '', phone: '', paymentMethod: 'cash', discountPercent: '25', cashTendered: '', notes: '' });
      await loadSalesOverview(selected.id);
    }, 'Sale completed successfully! Receipt generated.');
  }

  async function voidReceipt(receiptId: string, receiptNumber: string) {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to void receipt #${receiptNumber}? The sold books will be returned to the stall stock.`)) {
      return;
    }
    await act(async () => {
      await api(`/fair/events/${selected.id}/sales/${receiptId}/void`, { method: 'POST' });
      if (inspectReceipt?.id === receiptId) setInspectReceipt(null);
      await loadSalesOverview(selected.id);
    }, `Receipt #${receiptNumber} voided and stock restored.`);
  }

  async function act(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await loadEvents();
      if (selectedId) await loadDetail(selectedId);
      setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  function payload() {
    return {
      ...form,
      year: Number(form.year),
      organizerName: form.organizerName || null,
      description: form.description || null,
      venueAddress: form.venueAddress || null,
      city: form.city || null,
      setupStartDate: form.setupStartDate || null,
      dismantleDate: form.dismantleDate || null,
      managerId: form.managerId || null,
      financeOwnerId: form.financeOwnerId || null,
      warehouseCoordinatorId: form.warehouseCoordinatorId || null,
    };
  }

  async function saveEvent() {
    await act(async () => {
      const result = await api<{ data: { id: string } }>(
        selected ? `/fair/events/${selected.id}` : '/fair/events',
        {
          method: selected ? 'PATCH' : 'POST',
          body: JSON.stringify(selected ? { ...payload(), version: selected.version_no } : payload()),
        }
      );
      if (!selected) setSelectedId(result.data.id);
    }, selected ? 'Fair event updated' : 'Fair event created as draft');
  }

  async function transition(status: string) {
    if (!selected) return;
    await act(async () => {
      await api(`/fair/events/${selected.id}/${['approved', 'rejected'].includes(status) ? 'review' : 'transition'}`, {
        method: 'POST',
        body: JSON.stringify({ version: selected.version_no, status, reason: reason || null }),
      });
      setReason('');
    }, `Fair event moved to ${label(status)}`);
  }

  async function handleCloseFair() {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to close "${selected.name_en}"? Closing marks this book fair event as concluded.`)) {
      return;
    }
    await act(async () => {
      await api(`/fair/events/${selected.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Fair closed by management' }),
      });
      setReason('');
    }, 'Fair event closed successfully');
  }

  async function handleDeleteFair() {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${selected.name_en}"? All associated stalls, shifts, and event configurations will be removed. This cannot be undone.`)) {
      return;
    }
    const idToDelete = selected.id;
    setSelectedId('');
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/fair/events/${idToDelete}`, { method: 'DELETE' });
      await loadEvents();
      setNotice('Fair event deleted successfully');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function addBooth() {
    if (!selected) return;
    await act(async () => {
      await api(`/fair/events/${selected.id}/booths`, {
        method: 'POST',
        body: JSON.stringify({
          code: booth.code,
          name: booth.name,
          type: booth.type,
          zone: booth.zone || null,
          managerId: booth.managerId || null,
          stockWarehouseId: booth.stockWarehouseId || null,
        }),
      });
      setBooth({ code: '', name: '', type: 'standard', zone: '', managerId: '', stockWarehouseId: '' });
      setShowAddBoothModal(false);
    }, 'Booth created successfully');
  }

  async function deleteBooth(boothId: string, boothCode: string) {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to delete booth "${boothCode}"? All staff shifts assigned to this booth will also be removed.`)) {
      return;
    }
    await act(async () => {
      await api(`/fair/events/${selected.id}/booths/${boothId}`, { method: 'DELETE' });
      if (inspectBooth?.id === boothId) setInspectBooth(null);
    }, 'Booth deleted successfully');
  }

  async function addStaff() {
    if (!selected) return;
    await act(async () => {
      await api(`/fair/events/${selected.id}/staff`, {
        method: 'POST',
        body: JSON.stringify(assignment),
      });
      setAssignment({ boothId: '', userId: '', role: 'salesperson', shiftStart: '', shiftEnd: '' });
      setShowAddStaffModal(false);
    }, 'Staff shift assigned successfully');
  }

  async function deleteStaffShift(staffId: string, staffName: string) {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to remove the shift assignment for "${staffName}"?`)) {
      return;
    }
    await act(async () => {
      await api(`/fair/events/${selected.id}/staff/${staffId}`, { method: 'DELETE' });
    }, 'Staff shift removed successfully');
  }

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (typeFilter && e.event_type !== typeFilter) return false;
      return true;
    });
  }, [events, typeFilter]);

  // Aggregate metrics
  const totalFairs = total || events.length;
  const activeFairs = events.filter(e => ['approved', 'setup', 'ready', 'active'].includes(e.status)).length;
  const totalBooths = events.reduce((sum, e) => sum + (e.booth_count || 0), 0);
  const totalSalesTarget = events.reduce((sum, e) => sum + Number(e.sales_target || 0), 0);
  const totalBudget = events.reduce((sum, e) => sum + Number(e.budget_amount || 0), 0);

  const stockSummary = useMemo(() => {
    if (!stockData) return { totalOnHand: 0, totalInTransit: 0, totalValuation: 0, boothCount: 0 };
    const totalOnHand = (stockData.currentStock || []).reduce((sum, item) => sum + Number(item.on_hand_qty || 0), 0);
    const totalInTransit = (stockData.transfers || [])
      .filter(t => ['draft', 'approved', 'in_transit'].includes(t.status))
      .reduce((sum, t) => sum + (Number(t.quantity || 0) - Number(t.received_qty || 0)), 0);
    const totalValuation = (stockData.currentStock || []).reduce(
      (sum, item) => sum + Number(item.on_hand_qty || 0) * Number(item.average_unit_cost || 0),
      0
    );
    const boothCount = (stockData.booths || []).filter(b => b.stock_warehouse_id).length;
    return { totalOnHand, totalInTransit, totalValuation, boothCount };
  }, [stockData]);

  const uniqueSourceWarehouses = useMemo(() => {
    if (!stockData?.availableStock) return [];
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; code: string }> = [];
    for (const item of stockData.availableStock) {
      if (!seen.has(item.warehouse_id)) {
        seen.add(item.warehouse_id);
        list.push({ id: item.warehouse_id, name: item.warehouse_name, code: item.warehouse_code });
      }
    }
    return list;
  }, [stockData]);

  const availableItemsForSelectedSource = useMemo(() => {
    if (!stockData?.availableStock || !allocateForm.sourceWarehouseId) return [];
    return stockData.availableStock.filter(item => item.warehouse_id === allocateForm.sourceWarehouseId);
  }, [stockData, allocateForm.sourceWarehouseId]);

  const selectedItemStock = useMemo(() => {
    if (!availableItemsForSelectedSource || !allocateForm.itemId) return null;
    return availableItemsForSelectedSource.find(item => item.item_id === allocateForm.itemId) || null;
  }, [availableItemsForSelectedSource, allocateForm.itemId]);

  const filteredCurrentStock = useMemo(() => {
    if (!stockData?.currentStock) return [];
    let list = stockData.currentStock;
    if (stallFilter) {
      list = list.filter(item => item.warehouse_id === stallFilter);
    }
    if (stockStatusFilter) {
      list = list.filter(item => {
        const qty = Number(item.on_hand_qty || 0);
        if (stockStatusFilter === 'optimal') return qty > 15;
        if (stockStatusFilter === 'low') return qty > 0 && qty <= 15;
        if (stockStatusFilter === 'out') return qty <= 0;
        return true;
      });
    }
    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase().trim();
      list = list.filter(
        item =>
          item.item_code?.toLowerCase().includes(q) ||
          item.item_name?.toLowerCase().includes(q) ||
          item.booth_name?.toLowerCase().includes(q) ||
          item.warehouse_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [stockData, stockSearch, stallFilter, stockStatusFilter]);

  const filteredTransfers = useMemo(() => {
    if (!stockData?.transfers) return [];
    let list = stockData.transfers;
    if (transferFilter === 'pending') {
      list = list.filter(t => t.status !== 'received');
    } else if (transferFilter === 'received') {
      list = list.filter(t => t.status === 'received');
    }
    return list;
  }, [stockData, transferFilter]);

  const availableBooksForSelectedBooth = useMemo(() => {
    if (!salesData?.availableStock) return [];
    let list = salesData.availableStock;
    if (selectedBoothId) {
      list = list.filter(item => item.booth_id === selectedBoothId);
    }
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      list = list.filter(
        item =>
          item.item_code?.toLowerCase().includes(q) ||
          item.item_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [salesData, selectedBoothId, catalogSearch]);

  const filteredSalesReceipts = useMemo(() => {
    if (!salesData?.recentReceipts) return [];
    let list = salesData.recentReceipts;
    if (selectedBoothId) {
      list = list.filter(r => r.booth_id === selectedBoothId);
    }
    if (receiptSearch.trim()) {
      const q = receiptSearch.toLowerCase().trim();
      list = list.filter(
        r =>
          r.receipt_number?.toLowerCase().includes(q) ||
          r.customer_name?.toLowerCase().includes(q) ||
          r.customer_phone?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [salesData, selectedBoothId, receiptSearch]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const cartDiscount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.discountPercent || 0)) / 100, 0);
  }, [cart]);

  const cartNetTotal = Math.max(0, cartSubtotal - cartDiscount);

  const cashChangeDue = useMemo(() => {
    if (saleCustomer.paymentMethod !== 'cash') return 0;
    const tendered = Number(saleCustomer.cashTendered || 0);
    return tendered >= cartNetTotal ? tendered - cartNetTotal : 0;
  }, [saleCustomer.paymentMethod, saleCustomer.cashTendered, cartNetTotal]);

  const filteredReturnSummary = useMemo(() => {
    if (!postFairData?.stockSummary) return [];
    let list = postFairData.stockSummary;
    if (returnBoothFilter) {
      list = list.filter(item => item.booth_id === returnBoothFilter);
    }
    if (returnSearch.trim()) {
      const q = returnSearch.toLowerCase().trim();
      list = list.filter(
        item =>
          item.item_code?.toLowerCase().includes(q) ||
          item.item_name?.toLowerCase().includes(q) ||
          item.booth_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [postFairData, returnBoothFilter, returnSearch]);

  if (!mounted) {
    return (
      <div style={{ minHeight: 450, padding: '20px 0' }} suppressHydrationWarning>
        <div className="page-heading" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🎪</span> {screen.title}
            </h1>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Loading event workspace...
            </p>
          </div>
        </div>
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: '#64748b', borderRadius: 12 }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: '#3b82f6' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Initializing fair workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning>
      {/* Page Header */}
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🎪</span> {screen.title}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {formMode
              ? 'Configure fair dates, city, venue, sales targets, and designated coordinators.'
              : boothMode
              ? 'Setup event stalls, pavilions, linked warehouse stock locations, and staff shifts.'
              : allocationMode
              ? 'Dispatch finished books to event stalls, track in-transit stock, and inspect fair warehouse balances.'
              : salesMode
              ? 'Direct stall retail sales counter, Boi Mela discount presets, cash & digital MFS payments, and live thermal receipts.'
              : postFairStockMode
              ? 'Audit and return unsold books from fair stalls back to central warehouse, write off damaged copies, and reconcile inventory.'
              : 'Enterprise book fair registry, venue logistics, stall allocation, and event operations.'}
          </p>
        </div>

        <div className="button-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            className="btn btn-primary"
            href="/book-fair-events/create-edit-fair"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Register New Fair</span>
          </Link>
          <Link
            className="btn"
            href="/book-fair-events/fair-setup-and-booth"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              background: boothMode ? '#eff6ff' : undefined,
              borderColor: boothMode ? '#3b82f6' : undefined,
              color: boothMode ? '#1d4ed8' : undefined,
              fontWeight: boothMode ? 700 : undefined,
            }}
          >
            <Store size={15} />
            <span>Booth Setup</span>
          </Link>
          <Link
            className="btn"
            href="/book-fair-events/fair-stock-allocation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              background: allocationMode ? '#eff6ff' : undefined,
              borderColor: allocationMode ? '#3b82f6' : undefined,
              color: allocationMode ? '#1d4ed8' : undefined,
              fontWeight: allocationMode ? 700 : undefined,
            }}
          >
            <Layers size={15} />
            <span>Stock Allocation</span>
          </Link>
          <Link
            className="btn"
            href="/book-fair-events/fair-sales-entry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              background: salesMode ? '#eff6ff' : undefined,
              borderColor: salesMode ? '#3b82f6' : undefined,
              color: salesMode ? '#1d4ed8' : undefined,
              fontWeight: salesMode ? 700 : undefined,
            }}
          >
            <Receipt size={15} />
            <span>Sales Counter</span>
          </Link>
          <Link
            className="btn"
            href={`/book-fair-events/fair-reports${selected ? `?event=${selected.id}` : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              background: reportsMode ? '#eff6ff' : undefined,
              borderColor: reportsMode ? '#3b82f6' : undefined,
              color: reportsMode ? '#1d4ed8' : undefined,
              fontWeight: reportsMode ? 700 : undefined,
            }}
          >
            <BarChart3 size={15} />
            <span>Fair Reports</span>
          </Link>
          <Link
            className="btn"
            href={`/book-fair-events/post-fair-stock-reconciliation${selected ? `?event=${selected.id}` : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              background: postFairStockMode ? '#eff6ff' : undefined,
              borderColor: postFairStockMode ? '#3b82f6' : undefined,
              color: postFairStockMode ? '#1d4ed8' : undefined,
              fontWeight: postFairStockMode ? 700 : undefined,
            }}
          >
            <RotateCcw size={15} />
            <span>Post-Fair Return</span>
          </Link>
          <button
            className="btn"
            onClick={() => void loadEvents().catch(cause => setError(cause instanceof Error ? cause.message : 'Refresh failed'))}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Refresh fair events"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert-success" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {/* KPI Overview Cards (on Fair List view) */}
      {!formMode && !boothMode && !allocationMode && !salesMode && !postFairStockMode && !reportsMode && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            className="panel"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #3b82f6',
              background: 'var(--surface)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Registered Events
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {totalFairs} Fairs
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Active in Dhaka, Chittagong &amp; Regional Fairs
            </div>
          </div>

          <div
            className="panel"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #10b981',
              background: 'var(--surface)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} /> Active &amp; Prepared
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#065f46', marginTop: 4 }}>
              {activeFairs} Events
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Approved, in setup, or operational
            </div>
          </div>

          <div
            className="panel"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #8b5cf6',
              background: 'var(--surface)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Store size={14} /> Stalls &amp; Pavilions
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#4c1d95', marginTop: 4 }}>
              {totalBooths} Booths
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Configured retail sales counters
            </div>
          </div>

          <div
            className="panel"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #f59e0b',
              background: 'var(--surface)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} /> Planned Sales Target
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
              ৳ {money(totalSalesTarget)}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Budget: ৳ {money(totalBudget)} BDT
            </div>
          </div>
        </div>
      )}

      {/* Main Fair List View */}
      {!formMode && !boothMode && !allocationMode && !salesMode && !postFairStockMode && !reportsMode && (
        <>
          {/* Filter & Search Bar */}
          <section className="panel" style={{ padding: '18px 22px', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 320px' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                  <input
                    className="input"
                    style={{ paddingLeft: 32, fontSize: 13 }}
                    placeholder="Search by code, title, venue, or city..."
                    value={searchDraft}
                    onChange={event => setSearchDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        setPage(0);
                        setSearch(searchDraft);
                      }
                    }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setPage(0);
                    setSearch(searchDraft);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                >
                  <Search size={14} />
                  <span>Search</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  className="input"
                  style={{ fontSize: 13, width: 160 }}
                  value={statusFilter}
                  onChange={e => {
                    setPage(0);
                    setStatusFilter(e.target.value);
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="setup">In Setup</option>
                  <option value="ready">Ready</option>
                  <option value="active">Live / Active</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  className="input"
                  style={{ fontSize: 13, width: 170 }}
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                >
                  <option value="">All Event Types</option>
                  {types.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>

                {(search || statusFilter || typeFilter) && (
                  <button
                    className="btn"
                    onClick={() => {
                      setSearchDraft('');
                      setSearch('');
                      setStatusFilter('');
                      setTypeFilter('');
                      setPage(0);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                    title="Reset all filters"
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>
                )}

                {/* View Mode Toggle */}
                <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setViewMode('table')}
                    style={{
                      padding: '6px 10px',
                      background: viewMode === 'table' ? '#e2e8f0' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Table view"
                  >
                    <List size={16} color={viewMode === 'table' ? '#1e293b' : '#64748b'} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    style={{
                      padding: '6px 10px',
                      background: viewMode === 'grid' ? '#e2e8f0' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Grid view"
                  >
                    <LayoutGrid size={16} color={viewMode === 'grid' ? '#1e293b' : '#64748b'} />
                  </button>
                </div>
              </div>
            </div>

            {/* Event List Table */}
            {viewMode === 'table' ? (
              <div className="table-wrap" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Event &amp; Code</th>
                      <th style={{ width: '13%' }}>Type</th>
                      <th style={{ width: '16%' }}>Venue &amp; City</th>
                      <th style={{ width: '15%' }}>Dates &amp; Timing</th>
                      <th style={{ width: '12%' }}>Manager</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Booths</th>
                      <th style={{ width: '11%' }}>Status</th>
                      <th style={{ width: '9%', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                          Loading fair events...
                        </td>
                      </tr>
                    ) : filteredEvents.length ? (
                      filteredEvents.map(item => {
                        const isSelected = selectedId === item.id;
                        const timing = getEventTiming(item.start_date, item.end_date);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            style={{
                              background: isSelected ? '#eff6ff' : undefined,
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>
                                  {types.find(t => t.value === item.event_type)?.icon || '🎪'}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                                    {item.name_en}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                                    {item.event_code} · {item.event_year}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: '#475569' }}>
                                {label(item.event_type)}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#1e293b', fontSize: 12.5 }}>
                                <MapPin size={13} color="#64748b" />
                                <span>{item.venue}</span>
                              </div>
                              {item.city && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    fontSize: 10.5,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    marginTop: 3,
                                  }}
                                >
                                  {item.city}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: 12, color: '#334155' }}>
                                {fmt(item.start_date)} – {fmt(item.end_date)}
                              </div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: 10.5,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: timing.bg,
                                  color: timing.color,
                                  fontWeight: 600,
                                  marginTop: 3,
                                }}
                              >
                                {timing.label}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Users size={13} color="#64748b" />
                                <span style={{ fontSize: 12, color: item.manager_name ? '#1e293b' : '#94a3b8' }}>
                                  {item.manager_name || 'Unassigned'}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 9999,
                                  background: item.booth_count ? '#eff6ff' : '#f1f5f9',
                                  color: item.booth_count ? '#1d4ed8' : '#64748b',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                }}
                              >
                                {item.booth_count ?? 0}
                              </span>
                            </td>
                            <td>{renderStatusBadge(item.status)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(item.id);
                                }}
                                style={{
                                  fontSize: 11.5,
                                  padding: '4px 10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Eye size={13} />
                                <span>Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                          No fair events match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid / Cards View */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 16,
                }}
              >
                {filteredEvents.map(item => {
                  const isSelected = selectedId === item.id;
                  const timing = getEventTiming(item.start_date, item.end_date);
                  return (
                    <div
                      key={item.id}
                      className="panel"
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        background: isSelected ? '#f8fafc' : 'var(--surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                            {item.event_code}
                          </span>
                          {renderStatusBadge(item.status)}
                        </div>

                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                          {item.name_en}
                        </h3>

                        <div style={{ display: 'grid', gap: 6, fontSize: 12.5, color: '#475569', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} color="#64748b" />
                            <span>{item.venue}{item.city ? `, ${item.city}` : ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={14} color="#64748b" />
                            <span>{fmt(item.start_date)} – {fmt(item.end_date)}</span>
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: timing.bg, color: timing.color, fontSize: 10.5, fontWeight: 600 }}>
                              {timing.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={14} color="#64748b" />
                            <span>Manager: <strong>{item.manager_name || 'Unassigned'}</strong></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Store size={14} color="#64748b" />
                            <span>Booths: <strong>{item.booth_count ?? 0} stalls</strong></span>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Planned Target</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                            ৳ {money(item.sales_target)}
                          </div>
                        </div>

                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(item.id);
                          }}
                          style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid #e2e8f0',
                fontSize: 13,
                color: '#64748b',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                Showing <strong>{filteredEvents.length}</strong> of <strong>{total}</strong> fair events (Page {page + 1})
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            </div>
          </section>

          {/* Selected Event Detail & Operations Modal Dialog */}
          {selected && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px',
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setSelectedId('');
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  maxWidth: '920px',
                  width: '100%',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                }}
              >
                {/* Modal Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '18px 24px',
                    background: '#f8fafc',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 24 }}>
                        {types.find(t => t.value === selected.event_type)?.icon || '🎪'}
                      </span>
                      <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        {selected.name_en}
                      </h2>
                      {renderStatusBadge(selected.status)}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Code: <strong>{selected.event_code}</strong> · Type: {label(selected.event_type)} · Venue: {selected.venue}
                      {selected.city ? ` (${selected.city})` : ''} · Year: {selected.event_year}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Link
                      className="btn btn-sm"
                      href={`/book-fair-events/create-edit-fair?event=${selected.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Edit3 size={14} />
                      <span>Edit Event</span>
                    </Link>
                    <button
                      className="btn btn-sm"
                      onClick={() => setSelectedId('')}
                      title="Close pop-up"
                      style={{ padding: '6px 8px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Operations & Close / Delete Action Toolbar */}
                <div
                  style={{
                    padding: '12px 24px',
                    background: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  {/* Left: Operational Modules */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Modules:
                    </span>
                    <Link className="btn btn-sm" href={`/book-fair-events/fair-setup-and-booth?event=${selected.id}`}>
                      Booths &amp; Staff ➔
                    </Link>
                    <Link className="btn btn-sm" href={`/book-fair-events/fair-stock-allocation?event=${selected.id}`}>
                      Stock Allocation ➔
                    </Link>
                    <Link className="btn btn-sm" href={`/book-fair-events/fair-sales-entry?event=${selected.id}`}>
                      Fair Sales Counter ➔
                    </Link>
                    <Link className="btn btn-sm" href={`/book-fair-events/post-fair-stock-reconciliation?event=${selected.id}`}>
                      Post-Fair Return ➔
                    </Link>
                  </div>

                  {/* Right: Close Fair / Delete Fair buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {canManage && selected.status !== 'closed' && (
                      <button
                        className="btn"
                        onClick={handleCloseFair}
                        disabled={busy}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fcd34d',
                        }}
                        title="Close this book fair event"
                      >
                        <Lock size={14} />
                        <span>Close Fair</span>
                      </button>
                    )}

                    {canManage && ['closed', 'cancelled', 'draft'].includes(selected.status) && (
                      <button
                        className="btn"
                        onClick={handleDeleteFair}
                        disabled={busy}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                        }}
                        title="Permanently delete this fair event"
                      >
                        <Trash2 size={14} />
                        <span>Delete Fair</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Modal Scrollable Content */}
                <div
                  style={{
                    padding: '20px 24px',
                    overflowY: 'auto',
                    flex: '1 1 auto',
                  }}
                >
                  {/* Detail Tabs Bar */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      borderBottom: '1px solid #e2e8f0',
                      marginBottom: 18,
                    }}
                  >
                    {[
                      { key: 'overview', label: 'Event Logistics & Plans', count: null },
                      { key: 'booths', label: 'Booths & Stalls', count: booths.length },
                      { key: 'staff', label: 'Staff Shifts', count: staff.length },
                      { key: 'history', label: 'Audit History', count: detail?.history.length ?? 0 },
                    ].map(tab => {
                      const isActive = detailTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setDetailTab(tab.key as any)}
                          style={{
                            padding: '8px 14px',
                            background: 'none',
                            border: 'none',
                            borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                            color: isActive ? '#2563eb' : '#64748b',
                            fontWeight: isActive ? 700 : 500,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span>{tab.label}</span>
                          {tab.count !== null && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '1px 6px',
                                borderRadius: 9999,
                                background: isActive ? '#dbeafe' : '#f1f5f9',
                                color: isActive ? '#1d4ed8' : '#64748b',
                              }}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab 1: Overview */}
                  {detailTab === 'overview' && (
                    <div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: 14,
                          marginBottom: 18,
                        }}
                      >
                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Venue &amp; Location
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                            {selected.venue}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            {selected.venue_address || 'No specific street address'} · {selected.city || 'National'}
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Operational Dates
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                            {fmt(selected.start_date)} to {fmt(selected.end_date)}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            Setup: {fmt(selected.setup_start_date)} · Dismantle: {fmt(selected.dismantle_date)}
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Event Manager
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                            {selected.manager_name || 'Unassigned'}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            Organizer: {selected.organizer_name || 'In-house'}
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Financial Targets
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                            ৳ {money(selected.sales_target)}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            Operating Budget: ৳ {money(selected.budget_amount)}
                          </div>
                        </div>
                      </div>

                      {selected.description && (
                        <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Event Description &amp; Scope
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#334155' }}>{selected.description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Booths */}
                  {detailTab === 'booths' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                          Configured Booths &amp; Stalls ({booths.length})
                        </span>
                        <Link
                          className="btn btn-sm btn-primary"
                          href={`/book-fair-events/fair-setup-and-booth?event=${selected.id}`}
                        >
                          <Plus size={13} />
                          <span>Manage / Add Booths</span>
                        </Link>
                      </div>

                      <div className="table-wrap" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Booth Code</th>
                              <th>Booth Name</th>
                              <th>Type</th>
                              <th>Zone</th>
                              <th>Booth Manager</th>
                              <th>Stock Location (Warehouse)</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {booths.length ? (
                              booths.map(b => (
                                <tr key={b.id}>
                                  <td>
                                    <strong>{b.booth_code}</strong>
                                  </td>
                                  <td>{b.booth_name}</td>
                                  <td>{label(b.booth_type)}</td>
                                  <td>{b.zone || '—'}</td>
                                  <td>{b.manager_name || 'Unassigned'}</td>
                                  <td>{b.stock_warehouse_name || <span style={{ color: '#d97706' }}>Not Assigned</span>}</td>
                                  <td>{renderStatusBadge(b.status)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                                  No booths have been configured for this fair yet.{' '}
                                  <Link
                                    href={`/book-fair-events/fair-setup-and-booth?event=${selected.id}`}
                                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
                                  >
                                    Configure booths now ➔
                                  </Link>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Staff Shifts */}
                  {detailTab === 'staff' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                          Assigned Staff &amp; Cashier Shifts ({staff.length})
                        </span>
                        <Link
                          className="btn btn-sm btn-primary"
                          href={`/book-fair-events/fair-setup-and-booth?event=${selected.id}`}
                        >
                          <Plus size={13} />
                          <span>Assign Shift</span>
                        </Link>
                      </div>

                      <div className="table-wrap" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Booth</th>
                              <th>Staff Member</th>
                              <th>Role</th>
                              <th>Shift Start</th>
                              <th>Shift End</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staff.length ? (
                              staff.map(s => (
                                <tr key={s.id}>
                                  <td>
                                    <strong>{s.booth_code}</strong>
                                  </td>
                                  <td>{s.staff_name}</td>
                                  <td>
                                    <span
                                      style={{
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        background: s.staff_role === 'cashier' ? '#ecfdf5' : '#f1f5f9',
                                        color: s.staff_role === 'cashier' ? '#047857' : '#475569',
                                      }}
                                    >
                                      {label(s.staff_role)}
                                    </span>
                                  </td>
                                  <td>{s.shift_start.replace('T', ' ')}</td>
                                  <td>{s.shift_end.replace('T', ' ')}</td>
                                  <td>{renderStatusBadge(s.status)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                                  No staff shifts assigned yet.{' '}
                                  <Link
                                    href={`/book-fair-events/fair-setup-and-booth?event=${selected.id}`}
                                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
                                  >
                                    Assign staff shifts ➔
                                  </Link>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 4: History */}
                  {detailTab === 'history' && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 }}>
                        Event Audit &amp; State Change Log ({detail?.history.length ?? 0})
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {detail?.history.length ? (
                          detail.history.map((h, idx) => (
                            <div
                              key={`${h.occurred_at}-${idx}`}
                              style={{
                                padding: '12px 16px',
                                background: '#f8fafc',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: 12.5,
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{label(h.action)}</span>
                                {h.from_status && (
                                  <span style={{ color: '#64748b', marginLeft: 6 }}>
                                    ({label(h.from_status)} ➔ {label(h.to_status || '')})
                                  </span>
                                )}
                                {h.reason && (
                                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                    Reason: <em>"{h.reason}"</em>
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', color: '#64748b', fontSize: 11.5 }}>
                                <div>{h.actor_name}</div>
                                <div>{h.occurred_at.slice(0, 19).replace('T', ' ')}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                            No audit history recorded yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Event Code: <strong style={{ color: '#0f172a' }}>{selected.event_code}</strong>
                  </div>
                  <button className="btn" onClick={() => setSelectedId('')}>
                    Close Window
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Form Mode: Create/Edit Fair Event */}
      {formMode && (
        <section className="panel catalog-form" style={{ padding: 24, borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>
                {selected ? `Edit Event: ${selected.event_code}` : 'Register New Fair Event'}
              </h2>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Fill in fair details, venue location, schedule, leadership team, and commercial targets.
              </p>
            </div>
            <Link className="btn" href="/book-fair-events/fair-event-list">
              Back to Fair List
            </Link>
          </div>

          <div className="catalog-form-grid">
            <label className="field">
              <span>Event Code *</span>
              <input
                className="input"
                placeholder="e.g. FAIR-2027-EKUSHEY"
                value={form.code}
                disabled={!canManage || Boolean(selected && !['draft', 'rejected'].includes(selected.status))}
                onChange={event => setForm({ ...form, code: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Event Name *</span>
              <input
                className="input"
                placeholder="e.g. Amar Ekushey Boi Mela 2027"
                value={form.name}
                disabled={!canManage}
                onChange={event => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Event Type *</span>
              <select
                className="input"
                value={form.type}
                disabled={!canManage}
                onChange={event => setForm({ ...form, type: event.target.value })}
              >
                {types.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Event Year *</span>
              <input
                className="input"
                type="number"
                min="2000"
                max="2100"
                value={form.year}
                disabled={!canManage}
                onChange={event => setForm({ ...form, year: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Organizer / Sponsor</span>
              <input
                className="input"
                placeholder="e.g. Bangla Academy & Publishers Guild"
                value={form.organizerName}
                disabled={!canManage}
                onChange={event => setForm({ ...form, organizerName: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Venue Name *</span>
              <input
                className="input"
                placeholder="e.g. Suhrawardy Udyan & Bangla Academy"
                value={form.venue}
                disabled={!canManage}
                onChange={event => setForm({ ...form, venue: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Venue Address</span>
              <input
                className="input"
                placeholder="e.g. Dhaka University Campus, Shahbagh"
                value={form.venueAddress}
                disabled={!canManage}
                onChange={event => setForm({ ...form, venueAddress: event.target.value })}
              />
            </label>

            <label className="field">
              <span>City</span>
              <input
                className="input"
                placeholder="e.g. Dhaka, Chittagong, Sylhet"
                value={form.city}
                disabled={!canManage}
                onChange={event => setForm({ ...form, city: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Timezone</span>
              <input
                className="input"
                value={form.timezone}
                disabled={!canManage}
                onChange={event => setForm({ ...form, timezone: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Setup Start Date</span>
              <input
                className="input"
                type="date"
                value={form.setupStartDate}
                disabled={!canManage}
                onChange={event => setForm({ ...form, setupStartDate: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Event Opening Date *</span>
              <input
                className="input"
                type="date"
                value={form.startDate}
                disabled={!canManage}
                onChange={event => setForm({ ...form, startDate: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Event Closing Date *</span>
              <input
                className="input"
                type="date"
                value={form.endDate}
                disabled={!canManage}
                onChange={event => setForm({ ...form, endDate: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Dismantling Date</span>
              <input
                className="input"
                type="date"
                value={form.dismantleDate}
                disabled={!canManage}
                onChange={event => setForm({ ...form, dismantleDate: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Event Manager</span>
              <select
                className="input"
                value={form.managerId}
                disabled={!canManage}
                onChange={event => setForm({ ...form, managerId: event.target.value })}
              >
                <option value="">Select manager</option>
                {users.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.display_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Finance Owner</span>
              <select
                className="input"
                value={form.financeOwnerId}
                disabled={!canManage}
                onChange={event => setForm({ ...form, financeOwnerId: event.target.value })}
              >
                <option value="">Unassigned</option>
                {users.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.display_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Warehouse Coordinator</span>
              <select
                className="input"
                value={form.warehouseCoordinatorId}
                disabled={!canManage}
                onChange={event => setForm({ ...form, warehouseCoordinatorId: event.target.value })}
              >
                <option value="">Unassigned</option>
                {users.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.display_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Planned Sales Target (BDT)</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.salesTarget}
                disabled={!canManage}
                onChange={event => setForm({ ...form, salesTarget: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Planned Budget (BDT)</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.budgetAmount}
                disabled={!canManage}
                onChange={event => setForm({ ...form, budgetAmount: event.target.value })}
              />
            </label>
          </div>

          <label className="field" style={{ marginTop: 14 }}>
            <span>Event Description &amp; Instructions</span>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              disabled={!canManage}
              onChange={event => setForm({ ...form, description: event.target.value })}
            />
          </label>

          {canManage && (!selected || ['draft', 'rejected'].includes(selected.status)) && (
            <div style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                disabled={busy || !form.code.trim() || !form.name.trim() || !form.venue.trim() || !form.startDate || !form.endDate}
                onClick={() => void saveEvent()}
              >
                {selected ? 'Save Event Updates' : 'Create Draft Event'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Booth Mode: Fair Setup & Booths */}
      {boothMode && (
        <section className="panel" style={{ padding: 24, borderRadius: 14 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🎪</span>
                <span>{selected ? `${selected.name_en} · Stalls & Shifts` : 'Fair Booth & Staff Setup'}</span>
              </h2>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Configure retail stalls, pavilions, assigned fair stock locations, and daily cashier shifts.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {selected && canManage && selected.status !== 'closed' && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddBoothModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  >
                    <Plus size={15} />
                    <span>Add Booth</span>
                  </button>
                  <button
                    className="btn"
                    onClick={() => setShowAddStaffModal(true)}
                    disabled={booths.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    title={booths.length === 0 ? 'Create a booth first before assigning shifts' : 'Assign staff shift'}
                  >
                    <Users size={15} />
                    <span>Assign Shift</span>
                  </button>
                </>
              )}
              <Link className="btn" href="/book-fair-events/fair-event-list" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span>Fair Event List</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Event Selector & Overview Card */}
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: '#f8fafc',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: selected ? 16 : 0 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                Active Fair Event:
              </label>
              <select
                className="input"
                style={{ flex: '1 1 360px', maxWidth: 540, fontSize: 13 }}
                value={selectedId}
                onChange={event => setSelectedId(event.target.value)}
              >
                <option value="">— Select an Event to Configure Booths &amp; Staff —</option>
                {events.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.event_code} · {item.name_en} ({label(item.status)})
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div
                style={{
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {selected.name_en}
                    </span>
                    {renderStatusBadge(selected.status)}
                    <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                      {selected.event_code}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} color="#64748b" /> {selected.venue}{selected.city ? `, ${selected.city}` : ''}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} color="#64748b" /> {fmt(selected.start_date)} – {fmt(selected.end_date)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} color="#64748b" /> Manager: <strong>{selected.manager_name || 'Unassigned'}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {canManage && selected.status !== 'closed' && (
                    <button
                      className="btn btn-sm"
                      onClick={handleCloseFair}
                      disabled={busy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fcd34d',
                      }}
                      title="Close this fair event"
                    >
                      <Lock size={13} />
                      <span>Close Fair</span>
                    </button>
                  )}

                  {canManage && ['closed', 'cancelled', 'draft'].includes(selected.status) && (
                    <button
                      className="btn btn-sm"
                      onClick={handleDeleteFair}
                      disabled={busy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                      }}
                      title="Permanently delete this fair event"
                    >
                      <Trash2 size={13} />
                      <span>Delete Fair</span>
                    </button>
                  )}

                  <Link className="btn btn-sm" href={`/book-fair-events/fair-stock-allocation?event=${selected.id}`}>
                    Stock Allocation ➔
                  </Link>
                  <Link className="btn btn-sm" href={`/book-fair-events/fair-sales-entry?event=${selected.id}`}>
                    Sales Counter ➔
                  </Link>
                </div>
              </div>
            )}
          </div>

          {selected ? (
            <>
              {/* Event KPI Metrics Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #3b82f6', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={13} /> Total Booths
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {booths.length} Stalls
                  </div>
                </div>

                <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #10b981', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} /> Assigned Shifts
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46', marginTop: 4 }}>
                    {staff.length} Staff
                  </div>
                </div>

                <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #8b5cf6', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} /> Active Cashiers
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#4c1d95', marginTop: 4 }}>
                    {staff.filter(s => s.staff_role === 'cashier' && s.status === 'active').length} Cashiers
                  </div>
                </div>

                <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #f59e0b', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={13} /> Linked Stock Warehouses
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
                    {booths.filter(b => b.stock_warehouse_name).length} Warehouses
                  </div>
                </div>
              </div>

              {/* Booths Table Section */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={16} />
                    <span>Configured Booths &amp; Stalls ({booths.length})</span>
                  </h3>
                  {canManage && selected.status !== 'closed' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowAddBoothModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Plus size={14} />
                      <span>Add New Booth</span>
                    </button>
                  )}
                </div>

                <div className="table-wrap" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '12%' }}>Code</th>
                        <th style={{ width: '22%' }}>Booth Name</th>
                        <th style={{ width: '13%' }}>Type</th>
                        <th style={{ width: '14%' }}>Zone</th>
                        <th style={{ width: '14%' }}>Booth Manager</th>
                        <th style={{ width: '15%' }}>Stock Warehouse</th>
                        <th style={{ width: '10%' }}>Status</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {booths.length ? (
                        booths.map(item => (
                          <tr
                            key={item.id}
                            onClick={() => setInspectBooth(item)}
                            style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                          >
                            <td>
                              <strong style={{ fontFamily: 'monospace', color: '#2563eb' }}>{item.booth_code}</strong>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.booth_name}</span>
                            </td>
                            <td>{label(item.booth_type)}</td>
                            <td>{item.zone || '—'}</td>
                            <td>{item.manager_name || <span style={{ color: '#94a3b8' }}>Unassigned</span>}</td>
                            <td>
                              {item.stock_warehouse_name ? (
                                <span style={{ color: '#065f46', fontWeight: 500 }}>{item.stock_warehouse_name}</span>
                              ) : (
                                <span style={{ color: '#d97706', fontSize: 11.5 }}>⚠️ Not Linked</span>
                              )}
                            </td>
                            <td>{renderStatusBadge(item.status)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => setInspectBooth(item)}
                                  style={{ padding: '3px 8px', fontSize: 11.5 }}
                                  title="View booth info and assigned staff"
                                >
                                  <Eye size={12} />
                                  <span>Details</span>
                                </button>
                                {canManage && selected.status !== 'closed' && (
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => void deleteBooth(item.id, item.booth_code)}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: 11.5,
                                      color: '#b91c1c',
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                    }}
                                    title="Delete this booth"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                            No booths have been configured for this fair yet.{' '}
                            {canManage && selected.status !== 'closed' && (
                              <button
                                onClick={() => setShowAddBoothModal(true)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                Create the first booth now ➔
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Staff Shifts Table Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={16} />
                    <span>Assigned Staff &amp; Cashier Shifts ({staff.length})</span>
                  </h3>
                  {canManage && selected.status !== 'closed' && booths.length > 0 && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowAddStaffModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Plus size={14} />
                      <span>Assign Staff Shift</span>
                    </button>
                  )}
                </div>

                <div className="table-wrap" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Booth</th>
                        <th style={{ width: '22%' }}>Staff Member</th>
                        <th style={{ width: '15%' }}>Role</th>
                        <th style={{ width: '18%' }}>Shift Start</th>
                        <th style={{ width: '18%' }}>Shift End</th>
                        <th style={{ width: '12%' }}>Status</th>
                        <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.length ? (
                        staff.map(item => (
                          <tr key={item.id}>
                            <td>
                              <strong style={{ fontFamily: 'monospace' }}>{item.booth_code}</strong>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.staff_name}</span>
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: item.staff_role === 'cashier' ? '#ecfdf5' : item.staff_role.includes('manager') ? '#f5f3ff' : '#f1f5f9',
                                  color: item.staff_role === 'cashier' ? '#047857' : item.staff_role.includes('manager') ? '#6d28d9' : '#475569',
                                }}
                              >
                                {label(item.staff_role)}
                              </span>
                            </td>
                            <td>{item.shift_start.replace('T', ' ')}</td>
                            <td>{item.shift_end.replace('T', ' ')}</td>
                            <td>{renderStatusBadge(item.status)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {canManage && selected.status !== 'closed' ? (
                                <button
                                  className="btn btn-sm"
                                  onClick={() => void deleteStaffShift(item.id, item.staff_name)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: 11.5,
                                    color: '#b91c1c',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                  }}
                                  title="Remove this shift assignment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                            No staff shifts assigned yet.{' '}
                            {canManage && selected.status !== 'closed' && booths.length > 0 && (
                              <button
                                onClick={() => setShowAddStaffModal(true)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                Assign a shift now ➔
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🎪</span>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>
                No Fair Event Selected
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                Please select an active fair event from the dropdown above to view or configure stalls and staff schedules.
              </p>
            </div>
          )}

          {/* Modal 1: Inspect Booth Pop-up Modal */}
          {inspectBooth && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 20,
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setInspectBooth(null);
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  maxWidth: '700px',
                  width: '100%',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '18px 24px',
                    background: '#f8fafc',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 22 }}>🏪</span>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        {inspectBooth.booth_name}
                      </h2>
                      {renderStatusBadge(inspectBooth.status)}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Code: <strong style={{ color: '#2563eb', fontFamily: 'monospace' }}>{inspectBooth.booth_code}</strong> · Type: {label(inspectBooth.booth_type)} · Event: {selected?.name_en}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => setInspectBooth(null)} style={{ padding: '6px 8px' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: '1 1 auto' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Zone / Location
                      </span>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                        {inspectBooth.zone || 'No specific zone'}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Booth Manager
                      </span>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                        {inspectBooth.manager_name || 'Unassigned'}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Fair Stock Warehouse
                      </span>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: inspectBooth.stock_warehouse_name ? '#065f46' : '#d97706', marginTop: 4 }}>
                        {inspectBooth.stock_warehouse_name || 'Not Linked'}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Shifts for this Booth */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                      Assigned Staff for this Booth ({staff.filter(s => s.booth_id === inspectBooth.id).length})
                    </div>
                    {staff.filter(s => s.booth_id === inspectBooth.id).length ? (
                      <div className="table-wrap" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Staff Member</th>
                              <th>Role</th>
                              <th>Shift Start</th>
                              <th>Shift End</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staff
                              .filter(s => s.booth_id === inspectBooth.id)
                              .map(s => (
                                <tr key={s.id}>
                                  <td><strong>{s.staff_name}</strong></td>
                                  <td>
                                    <span
                                      style={{
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        background: s.staff_role === 'cashier' ? '#ecfdf5' : '#f1f5f9',
                                        color: s.staff_role === 'cashier' ? '#047857' : '#475569',
                                      }}
                                    >
                                      {label(s.staff_role)}
                                    </span>
                                  </td>
                                  <td>{s.shift_start.replace('T', ' ')}</td>
                                  <td>{s.shift_end.replace('T', ' ')}</td>
                                  <td>{renderStatusBadge(s.status)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: 18, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                        No staff shifts assigned specifically to this stall.
                      </div>
                    )}
                  </div>

                  {/* Quick Modules Shortcuts for this Booth */}
                  {selected && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        padding: 12,
                        background: '#eff6ff',
                        borderRadius: 8,
                        border: '1px solid #bfdbfe',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                        Booth Actions:
                      </span>
                      <Link className="btn btn-sm" href={`/book-fair-events/fair-stock-allocation?event=${selected.id}`}>
                        Allocate Stock ➔
                      </Link>
                      <Link className="btn btn-sm" href={`/book-fair-events/fair-sales-entry?event=${selected.id}`}>
                        Launch Sales Counter ➔
                      </Link>
                      <Link className="btn btn-sm" href={`/book-fair-events/post-fair-stock-reconciliation?event=${selected.id}`}>
                        Post-Fair Return ➔
                      </Link>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    {canManage && selected && selected.status !== 'closed' && (
                      <button
                        className="btn"
                        onClick={() => void deleteBooth(inspectBooth.id, inspectBooth.booth_code)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Delete Booth</span>
                      </button>
                    )}
                  </div>
                  <button className="btn" onClick={() => setInspectBooth(null)}>
                    Close Window
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal 2: Add Booth Pop-up Modal */}
          {showAddBoothModal && selected && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 20,
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setShowAddBoothModal(false);
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  maxWidth: '560px',
                  width: '100%',
                  padding: 24,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🏪</span> Add New Booth / Stall
                  </h3>
                  <button className="btn btn-sm" onClick={() => setShowAddBoothModal(false)} style={{ padding: '4px 8px' }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                  <label className="field">
                    <span>Booth Code *</span>
                    <input
                      className="input"
                      placeholder="e.g. B-01, PAV-02"
                      value={booth.code}
                      onChange={event => setBooth({ ...booth, code: event.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>Booth Name *</span>
                    <input
                      className="input"
                      placeholder="e.g. Literature & Fiction Pavilion"
                      value={booth.name}
                      onChange={event => setBooth({ ...booth, name: event.target.value })}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field">
                      <span>Booth Type</span>
                      <select
                        className="input"
                        value={booth.type}
                        onChange={event => setBooth({ ...booth, type: event.target.value })}
                      >
                        {boothTypes.map(item => (
                          <option key={item} value={item}>
                            {label(item)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Zone</span>
                      <input
                        className="input"
                        placeholder="e.g. Zone A, Stall 12"
                        value={booth.zone}
                        onChange={event => setBooth({ ...booth, zone: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Booth Manager</span>
                    <select
                      className="input"
                      value={booth.managerId}
                      onChange={event => setBooth({ ...booth, managerId: event.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {users.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Fair Stock Location (Warehouse)</span>
                    <select
                      className="input"
                      value={booth.stockWarehouseId}
                      onChange={event => setBooth({ ...booth, stockWarehouseId: event.target.value })}
                    >
                      <option value="">Assign warehouse later</option>
                      {warehouses.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn" onClick={() => setShowAddBoothModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !booth.code.trim() || !booth.name.trim()}
                    onClick={() => void addBooth()}
                  >
                    Create Booth
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal 3: Assign Staff Shift Pop-up Modal */}
          {showAddStaffModal && selected && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 20,
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setShowAddStaffModal(false);
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  maxWidth: '560px',
                  width: '100%',
                  padding: 24,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>👥</span> Assign Authorized Staff Shift
                  </h3>
                  <button className="btn btn-sm" onClick={() => setShowAddStaffModal(false)} style={{ padding: '4px 8px' }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                  <label className="field">
                    <span>Booth / Stall *</span>
                    <select
                      className="input"
                      value={assignment.boothId}
                      onChange={event => setAssignment({ ...assignment, boothId: event.target.value })}
                    >
                      <option value="">Select booth</option>
                      {booths.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.booth_code} · {item.booth_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Staff Member *</span>
                    <select
                      className="input"
                      value={assignment.userId}
                      onChange={event => setAssignment({ ...assignment, userId: event.target.value })}
                    >
                      <option value="">Select member</option>
                      {users.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Staff Role *</span>
                    <select
                      className="input"
                      value={assignment.role}
                      onChange={event => setAssignment({ ...assignment, role: event.target.value })}
                    >
                      {staffRoles.map(item => (
                        <option key={item} value={item}>
                          {label(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="field">
                      <span>Shift Start *</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={assignment.shiftStart}
                        onChange={event => setAssignment({ ...assignment, shiftStart: event.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Shift End *</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={assignment.shiftEnd}
                        onChange={event => setAssignment({ ...assignment, shiftEnd: event.target.value })}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn" onClick={() => setShowAddStaffModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={
                      busy ||
                      !assignment.boothId ||
                      !assignment.userId ||
                      !assignment.shiftStart ||
                      !assignment.shiftEnd
                    }
                    onClick={() => void addStaff()}
                  >
                    Assign Shift
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Allocation Mode: Fair Stock Allocation */}
      {allocationMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div
            className="panel"
            style={{
              padding: '20px 24px',
              borderRadius: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>📦</span>
                <h2 className="section-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selected ? `${selected.name_en} · Stock Management` : 'Fair Stock Allocation'}
                </h2>
              </div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Dispatch finished books to event stalls, track in-transit transfers, and inspect live stall balances.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {selected && canManage && selected.status !== 'closed' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const firstBoothWithWarehouse = (stockData?.booths || []).find(b => b.stock_warehouse_id);
                    const firstSourceWarehouse = uniqueSourceWarehouses[0];
                    setAllocateForm({
                      destinationWarehouseId: firstBoothWithWarehouse?.stock_warehouse_id || '',
                      sourceWarehouseId: firstSourceWarehouse?.id || '',
                      itemId: '',
                      quantity: '',
                      autoReceive: true,
                    });
                    setShowAllocateModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, boxShadow: '0 2px 8px rgba(35,71,165,0.25)' }}
                >
                  <Plus size={15} />
                  <span>+ Allocate Stock to Fair</span>
                </button>
              )}
              {selected && (
                <Link
                  className="btn"
                  href={`/book-fair-events/fair-setup-and-booth?event=${selected.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <Store size={14} />
                  <span>Booth Setup</span>
                </Link>
              )}
              <Link className="btn" href="/book-fair-events/fair-event-list" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span>Fair Event List</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Master 2-Column Responsive Workspace Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(330px, 380px) minmax(0, 1fr)',
              gap: 22,
              alignItems: 'start',
            }}
          >
            {/* LEFT COLUMN: Event Selector, KPIs, Stalls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Event Selector Card */}
              <div
                className="panel"
                style={{
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Active Fair Event
                  </label>
                  {selected && renderStatusBadge(selected.status)}
                </div>
                <select
                  className="input"
                  style={{ width: '100%', fontSize: 13, marginBottom: 12 }}
                  value={selectedId}
                  onChange={event => setSelectedId(event.target.value)}
                >
                  <option value="">— Select an Event —</option>
                  {events.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.event_code} · {item.name_en} ({label(item.status)})
                    </option>
                  ))}
                </select>

                {selected && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'grid', gap: 7, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                      {selected.name_en}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                      <MapPin size={13} />
                      <span>{selected.venue}{selected.city ? `, ${selected.city}` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                      <Calendar size={13} />
                      <span>{fmt(selected.start_date)} to {fmt(selected.end_date)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                      <DollarSign size={13} />
                      <span>Target: ৳ {money(selected.sales_target)}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                      {canManage && selected.status !== 'closed' && (
                        <button
                          className="btn btn-sm"
                          onClick={() => void handleCloseFair()}
                          style={{
                            flex: 1,
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fff7ed',
                            color: '#c2410c',
                            borderColor: '#fed7aa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}
                        >
                          <Lock size={12} />
                          <span>Close Fair</span>
                        </button>
                      )}
                      {canManage && (selected.status === 'closed' || selected.status === 'draft') && (
                        <button
                          className="btn btn-sm"
                          onClick={() => void handleDeleteFair()}
                          style={{
                            flex: 1,
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fef2f2',
                            color: '#b91c1c',
                            borderColor: '#fca5a5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Delete Fair</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 4 Reactive KPI Cards in 2x2 Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    borderLeft: '4px solid #10b981',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={13} /> On Hand
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {stockSummary.totalOnHand.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    copies at stalls
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    borderLeft: '4px solid #f59e0b',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={13} /> In-Transit
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {stockSummary.totalInTransit.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    pending arrival
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    borderLeft: '4px solid #3b82f6',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <DollarSign size={13} /> Valuation
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    ৳ {money(stockSummary.totalValuation)}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    stock asset value
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    borderLeft: '4px solid #8b5cf6',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Store size={13} /> Stalls
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {stockSummary.boothCount} Active
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    with warehouse
                  </div>
                </div>
              </div>

              {/* Event Stalls Breakdown Card */}
              <div
                className="panel"
                style={{
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={14} color="#64748b" />
                    <span>Event Stalls &amp; Live Stock</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 7px', borderRadius: 999 }}>
                    {(stockData?.booths || []).length}
                  </span>
                </div>

                {(stockData?.booths || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(stockData?.booths || []).map(b => {
                      const boothStockCount = (stockData?.currentStock || [])
                        .filter(item => item.warehouse_id === b.stock_warehouse_id)
                        .reduce((sum, item) => sum + Number(item.on_hand_qty || 0), 0);
                      const isFiltered = stallFilter === b.stock_warehouse_id;

                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            if (b.stock_warehouse_id) {
                              setStallFilter(isFiltered ? '' : b.stock_warehouse_id);
                            }
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: `1px solid ${isFiltered ? '#3b82f6' : '#e2e8f0'}`,
                            background: isFiltered ? '#eff6ff' : '#f8fafc',
                            cursor: b.stock_warehouse_id ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                              {b.booth_name}
                            </div>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: 4 }}>
                              {b.booth_code}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11.5 }}>
                            <span style={{ color: '#64748b' }}>
                              {b.stock_warehouse_name || 'No warehouse linked'}
                            </span>
                            <span style={{ fontWeight: 700, color: boothStockCount > 0 ? '#059669' : '#94a3b8' }}>
                              {boothStockCount.toLocaleString()} copies
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    No stalls configured for this fair yet.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Tabbed Workspaces (Current Stock vs Dispatch History) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tab Navigation Bar */}
              <div
                className="panel"
                style={{
                  padding: '6px 8px',
                  borderRadius: 12,
                  display: 'flex',
                  gap: 8,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveStockTab('stock')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeStockTab === 'stock' ? '#ffffff' : 'transparent',
                    color: activeStockTab === 'stock' ? '#1d4ed8' : '#64748b',
                    boxShadow: activeStockTab === 'stock' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 16 }}>📚</span>
                  <span>Current Stall Inventory</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: activeStockTab === 'stock' ? '#eff6ff' : '#e2e8f0',
                      color: activeStockTab === 'stock' ? '#1d4ed8' : '#64748b',
                    }}
                  >
                    {filteredCurrentStock.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStockTab('transfers')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeStockTab === 'transfers' ? '#ffffff' : 'transparent',
                    color: activeStockTab === 'transfers' ? '#1d4ed8' : '#64748b',
                    boxShadow: activeStockTab === 'transfers' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 16 }}>🚚</span>
                  <span>Transfer &amp; Dispatch History</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: activeStockTab === 'transfers' ? '#eff6ff' : '#e2e8f0',
                      color: activeStockTab === 'transfers' ? '#1d4ed8' : '#64748b',
                    }}
                  >
                    {filteredTransfers.length}
                  </span>
                </button>
              </div>

              {/* TAB 1 CONTENT: Current Stall Inventory */}
              {activeStockTab === 'stock' && (
                <div className="panel" style={{ padding: '20px 22px', borderRadius: 14 }}>
                  {/* Filter & Search Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                      <div style={{ position: 'relative', minWidth: 260, flex: '1 1 260px' }}>
                        <Search size={15} style={{ position: 'absolute', left: 11, top: 13, color: '#94a3b8' }} />
                        <input
                          className="input"
                          placeholder="Search title, SKU, or stall..."
                          style={{ paddingLeft: 34, fontSize: 13 }}
                          value={stockSearch}
                          onChange={e => setStockSearch(e.target.value)}
                        />
                      </div>

                      <select
                        className="input"
                        style={{ width: 'auto', minWidth: 180, fontSize: 13 }}
                        value={stallFilter}
                        onChange={e => setStallFilter(e.target.value)}
                      >
                        <option value="">— All Stalls &amp; Warehouses —</option>
                        {(stockData?.booths || [])
                          .filter(b => b.stock_warehouse_id)
                          .map(b => (
                            <option key={b.id} value={b.stock_warehouse_id || ''}>
                              {b.booth_name} ({b.booth_code})
                            </option>
                          ))}
                      </select>

                      <select
                        className="input"
                        style={{ width: 'auto', minWidth: 150, fontSize: 13 }}
                        value={stockStatusFilter}
                        onChange={e => setStockStatusFilter(e.target.value)}
                      >
                        <option value="">— All Stock Levels —</option>
                        <option value="optimal">Optimal (&gt;15)</option>
                        <option value="low">Low Stock (1-15)</option>
                        <option value="out">Out of Stock (0)</option>
                      </select>

                      {(stockSearch || stallFilter || stockStatusFilter) && (
                        <button
                          className="btn"
                          onClick={() => {
                            setStockSearch('');
                            setStallFilter('');
                            setStockStatusFilter('');
                          }}
                          style={{ fontSize: 12, padding: '0 12px' }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>

                    {canManage && selected && selected.status !== 'closed' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const firstBoothWithWarehouse = (stockData?.booths || []).find(b => b.stock_warehouse_id);
                          const firstSourceWarehouse = uniqueSourceWarehouses[0];
                          setAllocateForm({
                            destinationWarehouseId: firstBoothWithWarehouse?.stock_warehouse_id || '',
                            sourceWarehouseId: firstSourceWarehouse?.id || '',
                            itemId: '',
                            quantity: '',
                            autoReceive: true,
                          });
                          setShowAllocateModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                      >
                        <Plus size={14} />
                        <span>Allocate Stock</span>
                      </button>
                    )}
                  </div>

                  {filteredCurrentStock.length > 0 ? (
                    <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 130 }}>Item SKU</th>
                            <th>Book Title</th>
                            <th>Stall / Fair Warehouse</th>
                            <th style={{ textAlign: 'right', width: 140 }}>On-Hand Stock</th>
                            <th style={{ textAlign: 'right', width: 130 }}>Avg Unit Cost</th>
                            <th style={{ textAlign: 'right', width: 140 }}>Total Value</th>
                            <th style={{ textAlign: 'center', width: 120 }}>Stock Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCurrentStock.map((row, idx) => {
                            const qty = Number(row.on_hand_qty || 0);
                            const cost = Number(row.average_unit_cost || 0);
                            const val = qty * cost;
                            return (
                              <tr key={`${row.warehouse_id}-${row.item_id}-${idx}`}>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>
                                    {row.item_code}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5 }}>
                                    {row.item_name}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Store size={13} color="#64748b" />
                                    <span style={{ fontSize: 12.5, fontWeight: 500, color: '#334155' }}>
                                      {row.booth_name ? `${row.booth_name} (${row.booth_code})` : row.warehouse_name}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span
                                    style={{
                                      padding: '3px 10px',
                                      borderRadius: 6,
                                      background: qty > 10 ? '#ecfdf5' : '#fffbeb',
                                      color: qty > 10 ? '#047857' : '#b45309',
                                      fontWeight: 700,
                                      fontSize: 13,
                                    }}
                                  >
                                    {qty.toLocaleString()} copies
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 13, color: '#475569' }}>
                                  ৳ {money(cost)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: 13.5 }}>
                                  ৳ {money(val)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 9999,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background: qty > 15 ? '#ecfdf5' : qty > 0 ? '#eff6ff' : '#fef2f2',
                                      color: qty > 15 ? '#047857' : qty > 0 ? '#1d4ed8' : '#b91c1c',
                                    }}
                                  >
                                    {qty > 15 ? 'Optimal' : qty > 0 ? 'Low Stock' : 'Out of Stock'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                            <td colSpan={3} style={{ color: '#0f172a' }}>
                              Total Filtered Inventory ({filteredCurrentStock.length} titles)
                            </td>
                            <td style={{ textAlign: 'right', color: '#047857' }}>
                              {filteredCurrentStock.reduce((s, r) => s + Number(r.on_hand_qty || 0), 0).toLocaleString()} copies
                            </td>
                            <td></td>
                            <td style={{ textAlign: 'right', color: '#0f172a' }}>
                              ৳ {money(filteredCurrentStock.reduce((s, r) => s + Number(r.on_hand_qty || 0) * Number(r.average_unit_cost || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 36,
                        background: '#f8fafc',
                        borderRadius: 10,
                        border: '1px dashed #cbd5e1',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                        No stock matches current filters
                      </div>
                      <p style={{ color: '#64748b', fontSize: 12.5, margin: '6px 0 16px', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                        {stockSearch || stallFilter
                          ? 'Try clearing your search term or selecting a different stall.'
                          : 'Allocate books from your central warehouse to stock up your book fair booths.'}
                      </p>
                      {canManage && selected && selected.status !== 'closed' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            const firstBoothWithWarehouse = (stockData?.booths || []).find(b => b.stock_warehouse_id);
                            const firstSourceWarehouse = uniqueSourceWarehouses[0];
                            setAllocateForm({
                              destinationWarehouseId: firstBoothWithWarehouse?.stock_warehouse_id || '',
                              sourceWarehouseId: firstSourceWarehouse?.id || '',
                              itemId: '',
                              quantity: '',
                              autoReceive: true,
                            });
                            setShowAllocateModal(true);
                          }}
                        >
                          + Allocate Stock to Fair
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2 CONTENT: Transfer & Dispatch History */}
              {activeStockTab === 'transfers' && (
                <div className="panel" style={{ padding: '20px 22px', borderRadius: 14 }}>
                  {/* Filter Toolbar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setTransferFilter('all')}
                        style={{
                          background: transferFilter === 'all' ? '#2347a5' : '#fff',
                          color: transferFilter === 'all' ? '#fff' : '#334155',
                          borderColor: transferFilter === 'all' ? '#2347a5' : 'var(--line)',
                          fontWeight: 600,
                        }}
                      >
                        All Transfers ({stockData?.transfers?.length || 0})
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setTransferFilter('pending')}
                        style={{
                          background: transferFilter === 'pending' ? '#d97706' : '#fff',
                          color: transferFilter === 'pending' ? '#fff' : '#334155',
                          borderColor: transferFilter === 'pending' ? '#d97706' : 'var(--line)',
                          fontWeight: 600,
                        }}
                      >
                        In-Transit / Pending ({(stockData?.transfers || []).filter(t => t.status !== 'received').length})
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setTransferFilter('received')}
                        style={{
                          background: transferFilter === 'received' ? '#059669' : '#fff',
                          color: transferFilter === 'received' ? '#fff' : '#334155',
                          borderColor: transferFilter === 'received' ? '#059669' : 'var(--line)',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Received ({(stockData?.transfers || []).filter(t => t.status === 'received').length})
                      </button>
                    </div>

                    {canManage && selected && selected.status !== 'closed' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const firstBoothWithWarehouse = (stockData?.booths || []).find(b => b.stock_warehouse_id);
                          const firstSourceWarehouse = uniqueSourceWarehouses[0];
                          setAllocateForm({
                            destinationWarehouseId: firstBoothWithWarehouse?.stock_warehouse_id || '',
                            sourceWarehouseId: firstSourceWarehouse?.id || '',
                            itemId: '',
                            quantity: '',
                            autoReceive: true,
                          });
                          setShowAllocateModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                      >
                        <Plus size={14} />
                        <span>New Dispatch</span>
                      </button>
                    )}
                  </div>

                  {filteredTransfers.length > 0 ? (
                    <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 120 }}>Transfer Ref</th>
                            <th>Book Title &amp; SKU</th>
                            <th>Origin ➔ Destination</th>
                            <th style={{ textAlign: 'right', width: 130 }}>Transfer Qty</th>
                            <th style={{ textAlign: 'center', width: 120 }}>Status</th>
                            <th style={{ width: 170 }}>Timeline</th>
                            <th style={{ textAlign: 'right', width: 160 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTransfers.map(t => {
                            const isFullyReceived = t.status === 'received';
                            return (
                              <tr key={t.id}>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb', fontSize: 12 }}>
                                    #{t.id.slice(0, 8).toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5 }}>
                                    {t.item_name}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'monospace' }}>
                                    {t.item_code}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: 12.5, color: '#334155' }}>
                                    <span style={{ color: '#64748b' }}>From:</span> {t.source_warehouse_name}
                                  </div>
                                  <div style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600 }}>
                                    <span style={{ color: '#64748b' }}>To:</span> {t.booth_name ? `${t.booth_name} (${t.booth_code})` : t.destination_warehouse_name}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                                    {Number(t.quantity).toLocaleString()} copies
                                  </div>
                                  {isFullyReceived ? (
                                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                                      ✓ Received
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
                                      Pending: {Number(t.quantity) - Number(t.received_qty)}
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {renderStatusBadge(t.status)}
                                </td>
                                <td style={{ fontSize: 12, color: '#64748b' }}>
                                  <div>Created: {t.created_at}</div>
                                  {t.received_at && <div style={{ color: '#059669' }}>Received: {t.received_at}</div>}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {!isFullyReceived && canManage && (
                                      <button
                                        className="btn btn-sm"
                                        onClick={() => void receiveTransfer(t.id)}
                                        style={{
                                          fontSize: 11.5,
                                          padding: '3px 8px',
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          borderColor: '#6ee7b7',
                                          fontWeight: 600,
                                        }}
                                        title="Confirm arrival and receive stock into stall"
                                      >
                                        Receive Stock
                                      </button>
                                    )}

                                    <button
                                      className="btn btn-sm"
                                      onClick={() => setInspectTransfer(t)}
                                      style={{ fontSize: 11.5, padding: '3px 8px' }}
                                      title="View full transfer details"
                                    >
                                      <Eye size={13} />
                                      <span>Details</span>
                                    </button>

                                    {!isFullyReceived && canManage && (
                                      <button
                                        className="btn btn-sm"
                                        onClick={() => void cancelTransfer(t.id)}
                                        style={{
                                          fontSize: 11.5,
                                          padding: '3px 8px',
                                          color: '#b91c1c',
                                          borderColor: '#fca5a5',
                                          background: '#fff',
                                        }}
                                        title="Cancel and void transfer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: 36, background: '#f8fafc', borderRadius: 10, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                      No transfers found for the selected filter.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal 1: Allocate Stock Pop-up Modal */}
          {showAllocateModal && selected && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 20,
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setShowAllocateModal(false);
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  maxWidth: '580px',
                  width: '100%',
                  padding: 24,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📦</span> Allocate Stock to Fair Stall
                  </h3>
                  <button className="btn btn-sm" onClick={() => setShowAllocateModal(false)} style={{ padding: '4px 8px' }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
                  <label className="field">
                    <span>Destination Fair Stall / Warehouse *</span>
                    <select
                      className="input"
                      value={allocateForm.destinationWarehouseId}
                      onChange={e => setAllocateForm({ ...allocateForm, destinationWarehouseId: e.target.value })}
                    >
                      <option value="">— Select Destination Stall Warehouse —</option>
                      {(stockData?.booths || [])
                        .filter(b => b.stock_warehouse_id)
                        .map(b => (
                          <option key={b.id} value={b.stock_warehouse_id || ''}>
                            {b.booth_name} ({b.booth_code}) — {b.stock_warehouse_name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Source Central Warehouse *</span>
                    <select
                      className="input"
                      value={allocateForm.sourceWarehouseId}
                      onChange={e =>
                        setAllocateForm({
                          ...allocateForm,
                          sourceWarehouseId: e.target.value,
                          itemId: '',
                        })
                      }
                    >
                      <option value="">— Select Source Warehouse —</option>
                      {uniqueSourceWarehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Book Title / Item *</span>
                    <select
                      className="input"
                      value={allocateForm.itemId}
                      disabled={!allocateForm.sourceWarehouseId}
                      onChange={e => setAllocateForm({ ...allocateForm, itemId: e.target.value })}
                    >
                      <option value="">
                        {!allocateForm.sourceWarehouseId
                          ? '— Select source warehouse first —'
                          : availableItemsForSelectedSource.length === 0
                          ? '— No stock balances found in this warehouse —'
                          : '— Select a Book —'}
                      </option>
                      {availableItemsForSelectedSource.map(item => (
                        <option key={item.item_id} value={item.item_id}>
                          [{item.item_code}] {item.item_name} (Available: {Number(item.on_hand_qty).toLocaleString()} copies · ৳ {money(item.average_unit_cost)}/unit)
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedItemStock && (
                    <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12.5, color: '#1e40af' }}>
                      <strong>Available in source:</strong> {Number(selectedItemStock.on_hand_qty).toLocaleString()} copies | <strong>Avg Unit Cost:</strong> ৳ {money(selectedItemStock.average_unit_cost)}
                    </div>
                  )}

                  <label className="field">
                    <span>Quantity to Allocate *</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max={selectedItemStock ? Number(selectedItemStock.on_hand_qty) : undefined}
                      placeholder="e.g. 50"
                      value={allocateForm.quantity}
                      onChange={e => setAllocateForm({ ...allocateForm, quantity: e.target.value })}
                    />
                  </label>

                  <div
                    style={{
                      padding: 12,
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <input
                      id="autoReceive"
                      type="checkbox"
                      checked={allocateForm.autoReceive}
                      onChange={e => setAllocateForm({ ...allocateForm, autoReceive: e.target.checked })}
                      style={{ marginTop: 3 }}
                    />
                    <label htmlFor="autoReceive" style={{ fontSize: 12.5, color: '#334155', cursor: 'pointer' }}>
                      <strong style={{ color: '#0f172a' }}>Instant Dispatch &amp; Receive to Stall</strong>
                      <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                        Stock will immediately be deducted from the central warehouse and added to the fair stall inventory ready for retail sale (bypasses in-transit delay).
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn" onClick={() => setShowAllocateModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={Boolean(
                      busy ||
                      !allocateForm.destinationWarehouseId ||
                      !allocateForm.sourceWarehouseId ||
                      !allocateForm.itemId ||
                      !allocateForm.quantity ||
                      Number(allocateForm.quantity) <= 0 ||
                      (selectedItemStock && Number(allocateForm.quantity) > Number(selectedItemStock.on_hand_qty))
                    )}
                    onClick={() => void allocateStock()}
                  >
                    {allocateForm.autoReceive ? 'Dispatch & Receive to Stall' : 'Create In-Transit Dispatch'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal 2: Transfer Details Pop-up Modal */}
          {inspectTransfer && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 20,
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setInspectTransfer(null);
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  maxWidth: '540px',
                  width: '100%',
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🚚</span> Transfer #{inspectTransfer.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Fair stock dispatch transaction
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => setInspectTransfer(null)} style={{ padding: '4px 8px' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Book Title</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>{inspectTransfer.item_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>SKU: {inspectTransfer.item_code}</div>
                    </div>

                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Transfer Status</div>
                      <div style={{ marginTop: 6 }}>{renderStatusBadge(inspectTransfer.status)}</div>
                      <div style={{ fontSize: 11.5, color: '#0f172a', marginTop: 6, fontWeight: 600 }}>
                        Quantity: {Number(inspectTransfer.quantity).toLocaleString()} copies
                      </div>
                    </div>

                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Source Warehouse</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{inspectTransfer.source_warehouse_name}</div>
                    </div>

                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Destination Stall</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>
                        {inspectTransfer.booth_name ? `${inspectTransfer.booth_name} (${inspectTransfer.booth_code})` : inspectTransfer.destination_warehouse_name}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 14, background: '#f1f5f9', borderRadius: 8, fontSize: 12, color: '#475569', display: 'grid', gap: 6 }}>
                    <div><strong>Created:</strong> {inspectTransfer.created_at}</div>
                    {inspectTransfer.dispatched_at && <div><strong>Dispatched:</strong> {inspectTransfer.dispatched_at}</div>}
                    {inspectTransfer.received_at && <div><strong>Received:</strong> {inspectTransfer.received_at}</div>}
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    {inspectTransfer.status !== 'received' && canManage && (
                      <button
                        className="btn"
                        onClick={() => void cancelTransfer(inspectTransfer.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Cancel Transfer</span>
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {inspectTransfer.status !== 'received' && canManage && (
                      <button
                        className="btn btn-primary"
                        onClick={() => void receiveTransfer(inspectTransfer.id)}
                        style={{ fontSize: 12.5 }}
                      >
                        Receive Stock Now
                      </button>
                    )}
                    <button className="btn" onClick={() => setInspectTransfer(null)}>
                      Close Window
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales Mode: Fair Sales Entry & POS Register */}
      {salesMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div
            className="panel"
            style={{
              padding: '18px 24px',
              borderRadius: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>⚡</span>
                <h2 className="section-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selected ? `${selected.name_en} · Point of Sale Counter` : 'Fair Sales Register'}
                </h2>
                {selected && renderStatusBadge(selected.status)}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Direct stall book sales, 25% Ekushey fair discount presets, instant thermal cash memo generation &amp; real-time warehouse stock deduction.
              </div>
            </div>

            {/* Event & Counter Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Event:
                </label>
                <select
                  className="input"
                  style={{ width: 'auto', minWidth: 200, fontSize: 13, fontWeight: 600 }}
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.event_code} - {ev.name_en} ({label(ev.status)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Counter:
                </label>
                <select
                  className="input"
                  style={{ width: 'auto', minWidth: 200, fontSize: 13, fontWeight: 600 }}
                  value={selectedBoothId}
                  onChange={e => {
                    setSelectedBoothId(e.target.value);
                    setCart([]);
                  }}
                >
                  <option value="">— All Stalls / Counters —</option>
                  {(salesData?.booths || []).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.booth_name} ({b.booth_code}) {b.stock_warehouse_id ? '' : '⚠️ (No Warehouse)'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn"
                onClick={() => selected && void loadSalesOverview(selected.id)}
                disabled={busy}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                title="Refresh stall stock & sales"
              >
                <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {selected ? (
            /* 2-COLUMN SPLIT WORKSPACE */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(380px, 440px) 1fr',
                gap: 20,
                alignItems: 'start',
              }}
            >
              {/* LEFT COLUMN: Fast POS Register & Cart */}
              <div
                className="panel"
                style={{
                  padding: '20px 22px',
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                }}
              >
                {/* Cart Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShoppingCart size={18} color="#2563eb" />
                      <span>POS Sales Counter</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {selectedBoothId
                        ? `Serving from: ${(salesData?.booths || []).find(b => b.id === selectedBoothId)?.booth_name || 'Stall'}`
                        : 'Select a counter above to begin selling'}
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <button
                      className="btn btn-sm"
                      onClick={clearCart}
                      style={{ fontSize: 11.5, color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick Book Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                    ⚡ Scan / Select Available Stall Book:
                  </label>
                  <select
                    className="input"
                    style={{ fontSize: 13, background: '#f8fafc' }}
                    value=""
                    onChange={e => {
                      const book = availableBooksForSelectedBooth.find(b => b.item_id === e.target.value);
                      if (book) addToCart(book);
                    }}
                  >
                    <option value="">
                      {availableBooksForSelectedBooth.length === 0
                        ? '— No books in stock at this stall —'
                        : `— Click to pick book (${availableBooksForSelectedBooth.length} available) —`}
                    </option>
                    {availableBooksForSelectedBooth.map(book => (
                      <option key={`${book.warehouse_id}-${book.item_id}`} value={book.item_id}>
                        {book.item_code} · {book.item_name} (Stock: {book.on_hand_qty} | ৳{money(book.cover_price)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cart Items List */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fafbfc', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#f1f5f9',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      display: 'grid',
                      gridTemplateColumns: '1fr 60px 65px 70px 24px',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span>Item</span>
                    <span style={{ textAlign: 'center' }}>Qty</span>
                    <span style={{ textAlign: 'right' }}>Price</span>
                    <span style={{ textAlign: 'right' }}>Total</span>
                    <span></span>
                  </div>

                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {cart.length > 0 ? (
                      cart.map((item, idx) => {
                        const lineSub = item.quantity * item.unitPrice;
                        const lineDisc = (lineSub * item.discountPercent) / 100;
                        const lineTot = lineSub - lineDisc;
                        return (
                          <div
                            key={item.itemId}
                            style={{
                              padding: '10px 12px',
                              borderBottom: idx === cart.length - 1 ? 'none' : '1px solid #e2e8f0',
                              display: 'grid',
                              gridTemplateColumns: '1fr 60px 65px 70px 24px',
                              gap: 8,
                              alignItems: 'center',
                              background: '#fff',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.25 }}>
                                {item.itemName}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                                {item.itemCode}
                              </div>
                            </div>

                            {/* Qty Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                              <button
                                type="button"
                                onClick={() => updateCartItem(idx, { quantity: item.quantity - 1 })}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  border: '1px solid #cbd5e1',
                                  background: '#f8fafc',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                }}
                              >
                                -
                              </button>
                              <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartItem(idx, { quantity: item.quantity + 1 })}
                                disabled={item.quantity >= item.maxQty}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  border: '1px solid #cbd5e1',
                                  background: '#f8fafc',
                                  fontSize: 12,
                                  cursor: item.quantity >= item.maxQty ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  opacity: item.quantity >= item.maxQty ? 0.4 : 1,
                                }}
                              >
                                +
                              </button>
                            </div>

                            {/* Price */}
                            <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
                              ৳{money(item.unitPrice)}
                            </div>

                            {/* Total */}
                            <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                              ৳{money(lineTot)}
                            </div>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeFromCart(idx)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                              title="Remove item"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                        <ShoppingCart size={28} style={{ opacity: 0.35, margin: '0 auto 8px' }} />
                        <div>Counter cart is empty</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>Select a book above or click "+ Add to Cart" from the stall inventory tab</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ekushey Discount Presets */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      🌟 Boi Mela Discount Preset:
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                      {saleCustomer.discountPercent}% OFF
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[0, 15, 20, 25, 30].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyGlobalDiscount(pct)}
                        style={{
                          flex: 1,
                          padding: '6px 4px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          border: saleCustomer.discountPercent === String(pct) ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: saleCustomer.discountPercent === String(pct) ? '#eff6ff' : '#fff',
                          color: saleCustomer.discountPercent === String(pct) ? '#1d4ed8' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {pct === 25 ? '25% ⭐' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Billing Summary Box */}
                <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#64748b' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>৳ {money(cartSubtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#059669' }}>
                    <span>Fair Discount ({saleCustomer.discountPercent}%):</span>
                    <span style={{ fontWeight: 600 }}>- ৳ {money(cartDiscount)}</span>
                  </div>
                  <div
                    style={{
                      borderTop: '2px dashed #cbd5e1',
                      paddingTop: 8,
                      marginTop: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Net Payable:</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>
                      ৳ {money(cartNetTotal)}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                    Payment Method:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {[
                      { id: 'cash', label: 'Cash', icon: '💵' },
                      { id: 'bkash', label: 'bKash', icon: '📱' },
                      { id: 'nagad', label: 'Nagad', icon: '📱' },
                      { id: 'card', label: 'Card', icon: '💳' },
                    ].map(pm => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setSaleCustomer({ ...saleCustomer, paymentMethod: pm.id as any })}
                        style={{
                          padding: '8px 4px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          border: saleCustomer.paymentMethod === pm.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: saleCustomer.paymentMethod === pm.id ? '#eff6ff' : '#fff',
                          color: saleCustomer.paymentMethod === pm.id ? '#1d4ed8' : '#475569',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <span>{pm.icon}</span>
                        <span>{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* If Cash Payment: Tendered & Change */}
                {saleCustomer.paymentMethod === 'cash' && (
                  <div style={{ padding: 12, background: '#f1f5f9', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                          Cash Tendered:
                        </label>
                        <input
                          type="number"
                          className="input"
                          placeholder="৳ 0.00"
                          style={{ fontSize: 13, fontWeight: 700 }}
                          value={saleCustomer.cashTendered}
                          onChange={e => setSaleCustomer({ ...saleCustomer, cashTendered: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setSaleCustomer({ ...saleCustomer, cashTendered: String(Math.ceil(cartNetTotal)) })}
                          style={{ fontSize: 11, padding: '6px 8px' }}
                        >
                          Exact
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setSaleCustomer({ ...saleCustomer, cashTendered: '500' })}
                          style={{ fontSize: 11, padding: '6px 8px' }}
                        >
                          ৳500
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setSaleCustomer({ ...saleCustomer, cashTendered: '1000' })}
                          style={{ fontSize: 11, padding: '6px 8px' }}
                        >
                          ৳1000
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Change to Return:</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: cashChangeDue > 0 ? '#1d4ed8' : '#64748b' }}>
                        ৳ {money(cashChangeDue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Optional Customer info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                      Customer Name (Opt)
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Tanvir Ahmed"
                      style={{ fontSize: 12 }}
                      value={saleCustomer.name}
                      onChange={e => setSaleCustomer({ ...saleCustomer, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                      Mobile / Phone (Opt)
                    </label>
                    <input
                      className="input"
                      placeholder="017xxxxxxxx"
                      style={{ fontSize: 12 }}
                      value={saleCustomer.phone}
                      onChange={e => setSaleCustomer({ ...saleCustomer, phone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Complete Sale CTA */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submitSale}
                  disabled={cart.length === 0 || busy}
                  style={{
                    padding: '14px',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 10,
                    background: cart.length > 0 ? '#16a34a' : undefined,
                    borderColor: cart.length > 0 ? '#15803d' : undefined,
                  }}
                >
                  <Receipt size={18} />
                  <span>
                    {busy
                      ? 'Processing Sale...'
                      : cart.length > 0
                      ? `Complete Sale (৳ ${money(cartNetTotal)})`
                      : 'Cart Empty'}
                  </span>
                </button>
              </div>

              {/* RIGHT COLUMN: 4 KPIs & Interactive Tabbed Workspace */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 4 KPIs */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                      Today's Fair Revenue
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46', marginTop: 3 }}>
                      ৳ {money(salesData?.kpis?.totalRevenue || 0)}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Gross receipts collected</div>
                  </div>

                  <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>
                      Copies Sold Today
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af', marginTop: 3 }}>
                      {(salesData?.kpis?.totalCopiesSold || 0).toLocaleString()} books
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Direct counter sales</div>
                  </div>

                  <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase' }}>
                      Receipts Issued
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#5b21b6', marginTop: 3 }}>
                      {(salesData?.kpis?.totalReceipts || 0).toLocaleString()} bills
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Printed thermal memos</div>
                  </div>

                  <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                      Payment Breakdown
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
                      Cash: ৳{money(salesData?.kpis?.cashTotal || 0)}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                      MFS (bKash/Nagad): ৳{money(salesData?.kpis?.mfsTotal || 0)}
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div
                  className="panel"
                  style={{
                    padding: '6px 8px',
                    borderRadius: 12,
                    display: 'flex',
                    gap: 8,
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSalesTab('receipts')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: salesTab === 'receipts' ? '#ffffff' : 'transparent',
                      color: salesTab === 'receipts' ? '#1d4ed8' : '#64748b',
                      boxShadow: salesTab === 'receipts' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <span>🧾</span>
                    <span>Today's Sales Receipts</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: salesTab === 'receipts' ? '#eff6ff' : '#e2e8f0',
                        color: salesTab === 'receipts' ? '#1d4ed8' : '#64748b',
                      }}
                    >
                      {filteredSalesReceipts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSalesTab('catalog')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: salesTab === 'catalog' ? '#ffffff' : 'transparent',
                      color: salesTab === 'catalog' ? '#1d4ed8' : '#64748b',
                      boxShadow: salesTab === 'catalog' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <span>📚</span>
                    <span>Available Stall Books</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: salesTab === 'catalog' ? '#eff6ff' : '#e2e8f0',
                        color: salesTab === 'catalog' ? '#1d4ed8' : '#64748b',
                      }}
                    >
                      {availableBooksForSelectedBooth.length}
                    </span>
                  </button>
                </div>

                {/* TAB 1: Today's Receipts */}
                {salesTab === 'receipts' && (
                  <div className="panel" style={{ padding: '18px 20px', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
                        <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: '#94a3b8' }} />
                        <input
                          className="input"
                          placeholder="Search receipt #, customer, or phone..."
                          style={{ paddingLeft: 34, fontSize: 12.5 }}
                          value={receiptSearch}
                          onChange={e => setReceiptSearch(e.target.value)}
                        />
                      </div>
                      {receiptSearch && (
                        <button className="btn btn-sm" onClick={() => setReceiptSearch('')}>
                          Clear
                        </button>
                      )}
                    </div>

                    {filteredSalesReceipts.length > 0 ? (
                      <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 130 }}>Receipt #</th>
                              <th style={{ width: 90 }}>Time</th>
                              <th>Stall</th>
                              <th>Customer</th>
                              <th style={{ textAlign: 'center', width: 90 }}>Items</th>
                              <th style={{ textAlign: 'right', width: 110 }}>Total</th>
                              <th style={{ textAlign: 'center', width: 90 }}>Method</th>
                              <th style={{ textAlign: 'center', width: 90 }}>Status</th>
                              <th style={{ textAlign: 'center', width: 120 }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSalesReceipts.map(rc => (
                              <tr key={rc.id}>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e40af', fontSize: 12 }}>
                                    #{rc.receipt_number}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: '#64748b' }}>
                                  {rc.created_at?.slice(11, 16) || rc.receipt_date}
                                </td>
                                <td>
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#334155' }}>
                                    {rc.booth_name} ({rc.booth_code})
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                                    {rc.customer_name || 'Walk-in Patron'}
                                  </div>
                                  {rc.customer_phone && (
                                    <div style={{ fontSize: 11, color: '#64748b' }}>{rc.customer_phone}</div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600 }}>
                                  {rc.lines?.reduce((s, l) => s + Number(l.quantity), 0) || 1}
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                  ৳ {money(rc.total_amount)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      background: rc.payment_method === 'cash' ? '#ecfdf5' : '#eff6ff',
                                      color: rc.payment_method === 'cash' ? '#047857' : '#1d4ed8',
                                    }}
                                  >
                                    {rc.payment_method}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: rc.status === 'completed' ? '#f0fdf4' : '#fef2f2',
                                      color: rc.status === 'completed' ? '#15803d' : '#b91c1c',
                                    }}
                                  >
                                    {rc.status}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => setInspectReceipt(rc)}
                                      style={{ fontSize: 11, padding: '3px 8px' }}
                                      title="Print or view receipt slip"
                                    >
                                      <Printer size={13} />
                                      <span>Slip</span>
                                    </button>
                                    {rc.status === 'completed' && canManage && (
                                      <button
                                        className="btn btn-sm"
                                        onClick={() => void voidReceipt(rc.id, rc.receipt_number)}
                                        style={{ fontSize: 11, padding: '3px 6px', color: '#b91c1c', borderColor: '#fca5a5' }}
                                        title="Void receipt and restore stock"
                                      >
                                        <RotateCcw size={13} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 12.5, background: '#f8fafc', borderRadius: 8 }}>
                        No sales receipts found for this counter today.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Available Stall Books */}
                {salesTab === 'catalog' && (
                  <div className="panel" style={{ padding: '18px 20px', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
                        <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: '#94a3b8' }} />
                        <input
                          className="input"
                          placeholder="Search title or SKU in stall inventory..."
                          style={{ paddingLeft: 34, fontSize: 12.5 }}
                          value={catalogSearch}
                          onChange={e => setCatalogSearch(e.target.value)}
                        />
                      </div>
                      {catalogSearch && (
                        <button className="btn btn-sm" onClick={() => setCatalogSearch('')}>
                          Clear
                        </button>
                      )}
                    </div>

                    {availableBooksForSelectedBooth.length > 0 ? (
                      <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 120 }}>Item SKU</th>
                              <th>Book Title</th>
                              <th style={{ textAlign: 'right', width: 110 }}>Stall Stock</th>
                              <th style={{ textAlign: 'right', width: 110 }}>Cover Price</th>
                              <th style={{ textAlign: 'right', width: 120 }}>Fair Price ({saleCustomer.discountPercent}%)</th>
                              <th style={{ textAlign: 'center', width: 110 }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableBooksForSelectedBooth.map(book => {
                              const listPrice = Number(book.cover_price || 250);
                              const discPct = Number(saleCustomer.discountPercent || 25);
                              const netPrice = listPrice - (listPrice * discPct) / 100;
                              const stockQty = Number(book.on_hand_qty || 0);
                              return (
                                <tr key={`${book.warehouse_id}-${book.item_id}`}>
                                  <td>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e293b', fontSize: 12 }}>
                                      {book.item_code}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                                      {book.item_name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                      {book.booth_name} ({book.booth_code})
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <span
                                      style={{
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: stockQty > 10 ? '#ecfdf5' : '#fffbeb',
                                        color: stockQty > 10 ? '#047857' : '#b45309',
                                      }}
                                    >
                                      {stockQty} copies
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: 12.5, color: '#64748b' }}>
                                    ৳ {money(listPrice)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#059669' }}>
                                    ৳ {money(netPrice)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      onClick={() => addToCart(book)}
                                      disabled={stockQty <= 0}
                                      style={{ fontSize: 11.5, padding: '3px 10px', gap: 4 }}
                                    >
                                      <Plus size={13} />
                                      <span>Add to Cart</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 12.5, background: '#f8fafc', borderRadius: 8 }}>
                        No books available in this stall inventory matching your filter.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 12, color: '#64748b' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎪</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>
                Select a Fair Event from the dropdown above
              </div>
            </div>
          )}

          {/* Modal: Thermal Receipt / Cash Memo Modal */}
          {inspectReceipt && (
            <div
              className="modal-backdrop"
              onClick={() => setInspectReceipt(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 9999,
                padding: 16,
              }}
            >
              <div
                className="panel"
                onClick={e => e.stopPropagation()}
                style={{
                  width: 'min(440px, 98vw)',
                  background: '#ffffff',
                  borderRadius: 14,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header Actions */}
                <div
                  style={{
                    padding: '12px 18px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={15} color="#2563eb" />
                    <span>Fair Cash Memo / Receipt</span>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => setInspectReceipt(null)}
                    style={{ padding: '3px 8px' }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Printable Cash Memo Body */}
                <div
                  id="printable-fair-receipt"
                  style={{
                    padding: '24px 28px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 12,
                    color: '#0f172a',
                    background: '#fff',
                  }}
                >
                  {/* Publisher / Fair Banner */}
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {selected?.organizer_name || 'DEMO PUBLISHERS LTD.'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
                      {selected?.name_en || 'Amar Ekushey Book Fair'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Stall: {inspectReceipt.booth_name} ({inspectReceipt.booth_code})
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {selected?.venue} · {selected?.city}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />

                  {/* Metadata */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                    <div><strong>Receipt:</strong> #{inspectReceipt.receipt_number}</div>
                    <div style={{ textAlign: 'right' }}><strong>Date:</strong> {inspectReceipt.receipt_date}</div>
                    <div><strong>Cashier:</strong> {inspectReceipt.cashier_name || 'Cashier'}</div>
                    <div style={{ textAlign: 'right' }}><strong>Time:</strong> {inspectReceipt.created_at?.slice(11, 19) || ''}</div>
                    {inspectReceipt.customer_name && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <strong>Customer:</strong> {inspectReceipt.customer_name} {inspectReceipt.customer_phone ? `(${inspectReceipt.customer_phone})` : ''}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />

                  {/* Line Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 35px 55px 65px', fontWeight: 700, fontSize: 11 }}>
                      <span>Book</span>
                      <span style={{ textAlign: 'center' }}>Qty</span>
                      <span style={{ textAlign: 'right' }}>Price</span>
                      <span style={{ textAlign: 'right' }}>Total</span>
                    </div>

                    {(inspectReceipt.lines || []).map((line: any, idx: number) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 35px 55px 65px', fontSize: 11.5, alignItems: 'start' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{line.item_name}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{line.item_code}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>{line.quantity}</div>
                        <div style={{ textAlign: 'right' }}>৳{money(line.unit_price)}</div>
                        <div style={{ textAlign: 'right', fontWeight: 600 }}>৳{money(line.line_total)}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }} />

                  {/* Totals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>৳ {money(inspectReceipt.subtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                      <span>Fair Discount ({inspectReceipt.discount_percent}%):</span>
                      <span>- ৳ {money(inspectReceipt.discount_amount)}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 14,
                        fontWeight: 900,
                        borderTop: '1px solid #0f172a',
                        paddingTop: 6,
                        marginTop: 4,
                      }}
                    >
                      <span>NET TOTAL:</span>
                      <span>৳ {money(inspectReceipt.total_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginTop: 4 }}>
                      <span>Paid via:</span>
                      <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{inspectReceipt.payment_method}</span>
                    </div>
                    {inspectReceipt.cash_tendered && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                          <span>Cash Tendered:</span>
                          <span>৳ {money(inspectReceipt.cash_tendered)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                          <span>Change Returned:</span>
                          <span>৳ {money(inspectReceipt.change_due)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ borderTop: '1px dashed #cbd5e1', margin: '14px 0 10px' }} />

                  <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                    <div>Thank you for celebrating literature!</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>Please retain this receipt for any fair counter claims.</div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div
                  style={{
                    padding: '12px 18px',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => setInspectReceipt(null)}
                    style={{ fontSize: 12.5 }}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.print()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                  >
                    <Printer size={14} />
                    <span>Print Cash Memo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post-Fair Stock Reconciliation Mode */}
      {postFairStockMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div
            className="panel"
            style={{
              padding: '18px 24px',
              borderRadius: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>↩️</span>
                <h2 className="section-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selected ? `${selected.name_en} · Post-Fair Stock Return & Reconciliation` : 'Post-Fair Stock Reconciliation'}
                </h2>
                {selected && renderStatusBadge(selected.status)}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Reconcile stall inventory, return unsold books back to central warehouse, and audit damaged/shrinkage copies.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {selected && (
                <Link
                  className="btn"
                  href={`/book-fair-events/fair-stock-allocation?event=${selected.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                >
                  <Layers size={14} />
                  <span>Stock Allocation</span>
                </Link>
              )}
              {selected && (
                <Link
                  className="btn"
                  href={`/book-fair-events/fair-sales-entry?event=${selected.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                >
                  <Receipt size={14} />
                  <span>Sales Counter</span>
                </Link>
              )}
              <Link
                className="btn"
                href="/book-fair-events/fair-event-list"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
              >
                <span>Fair Event List</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Top 4 Summary KPI Cards */}
          {selected && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              <div
                className="panel"
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  borderLeft: '4px solid #3b82f6',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} /> Total Dispatched to Stalls
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {postFairData?.kpis.totalAllocatedCopies ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Allocated from central warehouse
                </div>
              </div>

              <div
                className="panel"
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  borderLeft: '4px solid #10b981',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Receipt size={14} /> Copies Sold at Counter
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                  {postFairData?.kpis.totalCopiesSold ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Sold via POS sales memos
                </div>
              </div>

              <div
                className="panel"
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  borderLeft: '4px solid #f59e0b',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={14} /> Current Stall Balance
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#b45309', marginTop: 4 }}>
                  {postFairData?.kpis.totalCurrentInStall ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Remaining awaiting return
                </div>
              </div>

              <div
                className="panel"
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  borderLeft: '4px solid #8b5cf6',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={14} /> Restocked to Central
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#6d28d9', marginTop: 4 }}>
                  {postFairData?.kpis.totalReturnedCopies ?? 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Valuation: ৳ {money(postFairData?.kpis.totalRemainingValue ?? 0)}
                </div>
              </div>
            </div>
          )}

          {/* Master 2-Column Responsive Workspace Grid (Matching Allocation & POS screens) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(330px, 380px) minmax(0, 1fr)',
              gap: 22,
              alignItems: 'start',
            }}
          >
            {/* LEFT COLUMN: Event Selector, Return Dispatch Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Card 1: Event Selector & Details */}
              <div
                className="panel"
                style={{
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Active Fair Event
                  </label>
                  {selected && renderStatusBadge(selected.status)}
                </div>
                <select
                  className="input"
                  style={{ width: '100%', fontSize: 13, marginBottom: 12 }}
                  value={selectedId}
                  onChange={event => setSelectedId(event.target.value)}
                >
                  <option value="">— Select an Event —</option>
                  {events.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.event_code} · {item.name_en} ({label(item.status)})
                    </option>
                  ))}
                </select>

                {selected && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'grid', gap: 7, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                      {selected.name_en}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                      <MapPin size={13} />
                      <span>{selected.venue}{selected.city ? `, ${selected.city}` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                      <Calendar size={13} />
                      <span>{fmt(selected.start_date)} to {fmt(selected.end_date)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                      <DollarSign size={13} />
                      <span>Target: ৳ {money(selected.sales_target)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Return Dispatch Parameters & Actions */}
              {selected && (
                <div
                  className="panel"
                  style={{
                    padding: '20px',
                    borderRadius: 12,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={16} color="#2563eb" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Return Destination
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Primary Central Warehouse:
                    </label>
                    <select
                      className="input"
                      style={{ width: '100%', fontSize: 12.5, fontWeight: 600 }}
                      value={returnDestWarehouseId}
                      onChange={e => setReturnDestWarehouseId(e.target.value)}
                    >
                      <option value="">-- Choose Destination Warehouse --</option>
                      {(postFairData?.centralWarehouses || []).map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Reconcile Stall / Pavilion:
                    </label>
                    <select
                      className="input"
                      style={{ width: '100%', fontSize: 12.5 }}
                      value={returnBoothFilter}
                      onChange={e => setReturnBoothFilter(e.target.value)}
                    >
                      <option value="">All Stalls &amp; Pavilions</option>
                      {(postFairData?.booths || []).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.booth_name} ({b.booth_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Dispatch Notes / Audit Memo:
                    </label>
                    <input
                      className="input"
                      style={{ width: '100%', fontSize: 12.5 }}
                      placeholder="e.g. End of fair stall return, audited by manager"
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                    />
                  </div>

                  {/* Live Dispatch Summary Box */}
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Dispatch Totals:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#475569' }}>Sound Returning:</span>
                      <strong style={{ color: '#2563eb' }}>
                        {Object.values(returnInputs).reduce((sum, v) => sum + (parseInt(v.sound, 10) || 0), 0)} copies
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#475569' }}>Damaged Write-off:</span>
                      <strong style={{ color: '#dc2626' }}>
                        {Object.values(returnInputs).reduce((sum, v) => sum + (parseInt(v.damaged, 10) || 0), 0)} copies
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={executePostFairReturn}
                    disabled={busy || !returnDestWarehouseId}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                    }}
                  >
                    <RotateCcw size={15} />
                    <span>Confirm Return to Central</span>
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Tabs, Filters & Tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selected ? (
                <>
                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setActiveReturnTab('return')}
                      style={{
                        borderRadius: '8px 8px 0 0',
                        borderBottom: activeReturnTab === 'return' ? '3px solid #2563eb' : '3px solid transparent',
                        background: activeReturnTab === 'return' ? '#eff6ff' : 'transparent',
                        color: activeReturnTab === 'return' ? '#1d4ed8' : '#64748b',
                        fontWeight: activeReturnTab === 'return' ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Stall Stock Reconciliation ({filteredReturnSummary.length})</span>
                    </button>

                    <button
                      className="btn btn-sm"
                      onClick={() => setActiveReturnTab('history')}
                      style={{
                        borderRadius: '8px 8px 0 0',
                        borderBottom: activeReturnTab === 'history' ? '3px solid #2563eb' : '3px solid transparent',
                        background: activeReturnTab === 'history' ? '#eff6ff' : 'transparent',
                        color: activeReturnTab === 'history' ? '#1d4ed8' : '#64748b',
                        fontWeight: activeReturnTab === 'history' ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Clock size={14} />
                      <span>Return History ({postFairData?.returnTransfers?.length ?? 0})</span>
                    </button>
                  </div>

                  {/* Tab 1: Reconciliation & Return Form */}
                  {activeReturnTab === 'return' && (
                    <section className="panel" style={{ padding: '20px 22px', borderRadius: 14 }}>
                      {/* Filter Bar */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginBottom: 16,
                          paddingBottom: 14,
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                          <input
                            className="input"
                            style={{ paddingLeft: 30, fontSize: 12.5 }}
                            placeholder="Search title, SKU, or stall..."
                            value={returnSearch}
                            onChange={e => setReturnSearch(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ fontSize: 11.5 }}
                            onClick={() => {
                              const updated = { ...returnInputs };
                              for (const row of filteredReturnSummary) {
                                const key = `${row.booth_id}_${row.item_id}`;
                                const onHand = Math.max(0, Math.floor(Number(row.current_stall_qty || 0)));
                                updated[key] = {
                                  sound: String(onHand),
                                  damaged: '0',
                                  notes: updated[key]?.notes || '',
                                };
                              }
                              setReturnInputs(updated);
                            }}
                          >
                            ✓ Auto-fill All Sound
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ fontSize: 11.5 }}
                            onClick={() => {
                              const updated = { ...returnInputs };
                              for (const row of filteredReturnSummary) {
                                const key = `${row.booth_id}_${row.item_id}`;
                                updated[key] = {
                                  sound: '0',
                                  damaged: '0',
                                  notes: '',
                                };
                              }
                              setReturnInputs(updated);
                            }}
                          >
                            ✕ Clear Inputs
                          </button>
                        </div>
                      </div>

                      {/* Stock Table */}
                      <div className="table-wrap">
                        <table className="data-table" style={{ fontSize: 12.5, width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Item SKU &amp; Book Title</th>
                              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Fair Stall</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 80 }}>Allocated</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 70 }}>Sold</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 100 }}>In-Stall Stock</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 110 }}>Return Sound</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 95 }}>Damaged</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 120 }}>Missing / Var.</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 90 }}>Quick Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReturnSummary.length === 0 ? (
                              <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
                                  No stall inventory found matching the criteria.
                                </td>
                              </tr>
                            ) : (
                              filteredReturnSummary.map(row => {
                                const key = `${row.booth_id}_${row.item_id}`;
                                const inputVal = returnInputs[key] || { sound: '0', damaged: '0', notes: '' };
                                const sound = Math.max(0, parseInt(inputVal.sound, 10) || 0);
                                const damaged = Math.max(0, parseInt(inputVal.damaged, 10) || 0);
                                const onHand = Math.max(0, Math.floor(Number(row.current_stall_qty || 0)));
                                const missing = onHand - (sound + damaged);
                                const isOver = sound + damaged > onHand;

                                return (
                                  <tr key={key} style={{ background: isOver ? '#fff1f2' : undefined }}>
                                    <td style={{ padding: '10px 14px' }}>
                                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.item_name}</div>
                                      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                        <span>{row.item_code}</span>
                                        <span>·</span>
                                        <span>Cover: ৳{money(row.cover_price)}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <div style={{ fontWeight: 500, color: '#334155' }}>{row.booth_name}</div>
                                      <div style={{ fontSize: 11, color: '#64748b' }}>Code: {row.booth_code}</div>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                                      {Math.floor(Number(row.allocated_qty || 0))}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                                      {Math.floor(Number(row.sold_qty || 0))}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <span
                                        style={{
                                          padding: '3px 9px',
                                          borderRadius: 12,
                                          fontWeight: 700,
                                          fontSize: 12,
                                          background: onHand > 0 ? '#eff6ff' : '#f1f5f9',
                                          color: onHand > 0 ? '#1d4ed8' : '#64748b',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {onHand} copies
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max={onHand}
                                        className="input"
                                        style={{
                                          width: 80,
                                          textAlign: 'center',
                                          padding: '4px 6px',
                                          fontSize: 13,
                                          fontWeight: 700,
                                          borderColor: isOver ? '#ef4444' : undefined,
                                        }}
                                        value={inputVal.sound}
                                        onChange={e => {
                                          setReturnInputs({
                                            ...returnInputs,
                                            [key]: {
                                              ...inputVal,
                                              sound: e.target.value,
                                            },
                                          });
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max={onHand}
                                        className="input"
                                        style={{
                                          width: 75,
                                          textAlign: 'center',
                                          padding: '4px 6px',
                                          fontSize: 13,
                                          fontWeight: 600,
                                          color: damaged > 0 ? '#b91c1c' : undefined,
                                          borderColor: damaged > 0 ? '#fca5a5' : undefined,
                                        }}
                                        value={inputVal.damaged}
                                        onChange={e => {
                                          setReturnInputs({
                                            ...returnInputs,
                                            [key]: {
                                              ...inputVal,
                                              damaged: e.target.value,
                                            },
                                          });
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      {isOver ? (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                                          Exceeds Stock!
                                        </span>
                                      ) : missing === 0 ? (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          <CheckCircle2 size={13} /> Reconciled
                                        </span>
                                      ) : missing > 0 ? (
                                        <span
                                          style={{
                                            padding: '2px 8px',
                                            borderRadius: 8,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: '#fef2f2',
                                            color: '#b91c1c',
                                            border: '1px solid #fecaca',
                                          }}
                                        >
                                          -{missing} Missing
                                        </span>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        className="btn btn-sm"
                                        style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                                        onClick={() => {
                                          setReturnInputs({
                                            ...returnInputs,
                                            [key]: {
                                              ...inputVal,
                                              sound: String(onHand),
                                              damaged: '0',
                                            },
                                          });
                                        }}
                                      >
                                        All Sound
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* Tab 2: Return Transfers History */}
                  {activeReturnTab === 'history' && (
                    <section className="panel" style={{ padding: '20px 22px', borderRadius: 14 }}>
                      <div style={{ marginBottom: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                          Historical Stall Returns to Central Warehouse
                        </h3>
                        <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
                          Verified stock transfers dispatched from fair booths back to primary warehouse storage.
                        </p>
                      </div>

                      <div className="table-wrap">
                        <table className="table" style={{ fontSize: 12.5 }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Transfer Ref</th>
                              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Book Title &amp; SKU</th>
                              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Source Stall ➔ Destination Warehouse</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Returned Qty</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Timeline &amp; Returned By</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(!postFairData?.returnTransfers || postFairData.returnTransfers.length === 0) ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
                                  No return transfers recorded yet for this fair event.
                                </td>
                              </tr>
                            ) : (
                              postFairData.returnTransfers.map(tr => (
                                <tr key={tr.id}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                                      {tr.id.slice(0, 8).toUpperCase()}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{tr.item_name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>{tr.item_code}</div>
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontSize: 12, color: '#475569' }}>
                                      From: <strong>{tr.booth_name || tr.source_warehouse_name}</strong>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#1e40af', marginTop: 2 }}>
                                      To: <strong>{tr.destination_warehouse_name}</strong>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#2563eb' }}>
                                    {Math.floor(Number(tr.quantity || 0))} copies
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <span
                                      style={{
                                        padding: '2px 8px',
                                        borderRadius: 12,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      <Check size={12} /> {tr.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', fontSize: 11.5, color: '#64748b' }}>
                                    <div>{tr.received_at || tr.created_at}</div>
                                    {tr.returned_by_name && (
                                      <div style={{ color: '#334155', marginTop: 2 }}>By: {tr.returned_by_name}</div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div style={{ padding: 48, textAlign: 'center', background: '#f8fafc', borderRadius: 14, color: '#64748b', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>↩️</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>
                    Select a Fair Event to Reconcile
                  </div>
                  <p style={{ margin: '6px auto 0', maxWidth: 420, fontSize: 13 }}>
                    Choose a book fair event from the dropdown on the left to view stall balances and return unsold books to the central warehouse.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Fair Reports Mode - Unified Comprehensive Operations & Profitability Suite */}
      {reportsMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div
            className="panel"
            style={{
              padding: '18px 24px',
              borderRadius: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <BarChart3 size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {selected ? `${selected.name_en} · Comprehensive Fair Operations Report` : 'Select a Book Fair Event'}
                  </h2>
                  {selected && (
                    <span
                      className="badge"
                      style={{
                        background: selected.status === 'active' ? '#ecfdf5' : '#eff6ff',
                        color: selected.status === 'active' ? '#065f46' : '#1e40af',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {label(selected.status)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                  Executive P&L summary, stall commercial performance, expense vouchers, and central warehouse stock audit.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Printer size={15} />
                <span>Export / Print Report</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setExpenseModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Plus size={15} />
                <span>Add Fair Expense</span>
              </button>

              {selected && (
                <Link
                  className="btn"
                  href={`/book-fair-events/fair-sales-entry?event=${selected.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <Receipt size={14} />
                  <span>Sales POS</span>
                </Link>
              )}
              {selected && (
                <Link
                  className="btn"
                  href={`/book-fair-events/post-fair-stock-reconciliation?event=${selected.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <RotateCcw size={14} />
                  <span>Stock Return</span>
                </Link>
              )}
            </div>
          </div>

          {/* Event Selector & Event Meta Bar */}
          <div
            className="panel"
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                Active Fair:
              </span>
              <select
                className="input"
                style={{ maxWidth: 420, height: 38, fontSize: 13, fontWeight: 600 }}
                value={selectedId || ''}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">— Choose a Book Fair Event —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.event_code} · {ev.name_en} ({label(ev.status)})
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="#64748b" />
                  <span>{selected.venue}{selected.city ? `, ${selected.city}` : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} color="#64748b" />
                  <span>{fmt(selected.start_date)} to {fmt(selected.end_date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={14} color="#64748b" />
                  <span>Sales Target: <strong>৳{money(selected.sales_target)}</strong></span>
                </div>
              </div>
            )}
          </div>

          {selected && reportsData ? (
            <>
              {/* Top 4 Executive KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: 14,
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    borderLeft: '4px solid #3b82f6',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Net Sales Revenue
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: reportsData.financialSummary.targetAchievementPct >= 100 ? '#ecfdf5' : '#eff6ff',
                        color: reportsData.financialSummary.targetAchievementPct >= 100 ? '#059669' : '#2563eb',
                      }}
                    >
                      {reportsData.financialSummary.targetAchievementPct.toFixed(1)}% Target
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                    ৳ {money(reportsData.financialSummary.netSales)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{reportsData.financialSummary.totalMemos.toLocaleString()} memos issued</span>
                    <span>{reportsData.financialSummary.totalCopiesSold.toLocaleString()} copies</span>
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    borderLeft: '4px solid #10b981',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Gross Commercial Profit
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#ecfdf5',
                        color: '#059669',
                      }}
                    >
                      {reportsData.financialSummary.grossMarginPct.toFixed(1)}% Margin
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                    ৳ {money(reportsData.financialSummary.grossProfit)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    COGS (Print Cost): ৳ {money(reportsData.financialSummary.cogs)}
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    borderLeft: '4px solid #f59e0b',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Operating Expenses
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#fffbeb',
                        color: '#b45309',
                      }}
                    >
                      {reportsData.expenses.length} Vouchers
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                    ৳ {money(reportsData.financialSummary.totalExpenses)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Stall rent, decor, freight & staff stipends
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    borderLeft: `4px solid ${reportsData.financialSummary.netProfit >= 0 ? '#8b5cf6' : '#ef4444'}`,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: reportsData.financialSummary.netProfit >= 0 ? '#7c3aed' : '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Net Operating Profit
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: reportsData.financialSummary.netProfit >= 0 ? '#f5f3ff' : '#fef2f2',
                        color: reportsData.financialSummary.netProfit >= 0 ? '#6d28d9' : '#b91c1c',
                      }}
                    >
                      {reportsData.financialSummary.netMarginPct.toFixed(1)}% Net
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: reportsData.financialSummary.netProfit >= 0 ? '#0f172a' : '#b91c1c', marginTop: 6 }}>
                    ৳ {money(reportsData.financialSummary.netProfit)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Operating ROI: {reportsData.financialSummary.roiPct.toFixed(1)}% on expenses
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', paddingBottom: 2 }}>
                {[
                  { key: 'profitability', label: 'Financial Profitability & Expense Ledger', icon: DollarSign },
                  { key: 'sales', label: 'Commercial Sales & POS Analytics', icon: ShoppingCart },
                  { key: 'booths', label: 'Stall & Pavilion Breakdown', icon: Store },
                  { key: 'inventory', label: 'Stock Movement & Reconciliation Audit', icon: Layers },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeReportTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveReportTab(tab.key as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        borderRadius: '9px 9px 0 0',
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#1d4ed8' : '#64748b',
                        background: isActive ? '#fff' : 'transparent',
                        border: '1px solid',
                        borderColor: isActive ? '#e2e8f0' : 'transparent',
                        borderBottomColor: isActive ? '#fff' : 'transparent',
                        marginBottom: -1,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={15} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Financial Profitability & Expense Ledger */}
              {activeReportTab === 'profitability' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.4fr)', gap: 18 }}>
                  {/* P&L Statement Panel */}
                  <section className="panel" style={{ padding: '22px 24px', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarSign size={16} color="#2563eb" />
                        <span>Fair P&L Income Statement</span>
                      </h3>
                      <span className="badge badge-green">Audited Real-time</span>
                    </div>

                    <table className="data-table" style={{ width: '100%' }}>
                      <tbody>
                        <tr style={{ background: '#f8fafc' }}>
                          <td style={{ fontWeight: 600, color: '#334155' }}>Gross Counter Sales (Before Discount)</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            ৳ {money(reportsData.financialSummary.grossSales)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: '#dc2626', paddingLeft: 24 }}>
                            Less: Promotional Discounts & Fair Concessions
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                            - ৳ {money(reportsData.financialSummary.totalDiscounts)}
                          </td>
                        </tr>
                        <tr style={{ background: '#eff6ff', borderTop: '2px solid #bfdbfe' }}>
                          <td style={{ fontWeight: 700, color: '#1d4ed8' }}>= Net Sales Revenue</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#1d4ed8', fontSize: 15 }}>
                            ৳ {money(reportsData.financialSummary.netSales)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: '#b45309', paddingLeft: 24 }}>
                            Less: Cost of Goods Sold (Unit Printing Cost)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                            - ৳ {money(reportsData.financialSummary.cogs)}
                          </td>
                        </tr>
                        <tr style={{ background: '#ecfdf5', borderTop: '2px solid #a7f3d0' }}>
                          <td style={{ fontWeight: 700, color: '#065f46' }}>
                            = Gross Commercial Profit ({reportsData.financialSummary.grossMarginPct.toFixed(1)}%)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#065f46', fontSize: 15 }}>
                            ৳ {money(reportsData.financialSummary.grossProfit)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: '#dc2626', paddingLeft: 24 }}>
                            Less: Total Operational Fair Expenses
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                            - ৳ {money(reportsData.financialSummary.totalExpenses)}
                          </td>
                        </tr>
                        <tr
                          style={{
                            background: reportsData.financialSummary.netProfit >= 0 ? '#f5f3ff' : '#fef2f2',
                            borderTop: '2px solid #ddd6fe',
                            borderBottom: '2px solid #ddd6fe',
                          }}
                        >
                          <td style={{ fontWeight: 800, color: reportsData.financialSummary.netProfit >= 0 ? '#6d28d9' : '#b91c1c', fontSize: 14 }}>
                            = Net Event Operating Profit ({reportsData.financialSummary.netMarginPct.toFixed(1)}%)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: reportsData.financialSummary.netProfit >= 0 ? '#6d28d9' : '#b91c1c', fontSize: 17 }}>
                            ৳ {money(reportsData.financialSummary.netProfit)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12.5, color: '#475569', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, textAlign: 'center' }}>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Sales Target</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 2 }}>৳ {money(reportsData.financialSummary.salesTarget)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Expense Budget</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 2 }}>৳ {money(reportsData.financialSummary.budgetAmount)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Overall ROI</div>
                        <div style={{ fontWeight: 700, color: reportsData.financialSummary.roiPct >= 0 ? '#059669' : '#dc2626', marginTop: 2 }}>
                          {reportsData.financialSummary.roiPct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Operational Expense Register */}
                  <section className="panel" style={{ padding: '22px 24px', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Wallet size={16} color="#d97706" />
                          <span>Fair Operational Expense Ledger</span>
                        </h3>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Itemized expenditures for stall rent, logistics, decorations, and staff meals.
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() => setExpenseModalOpen(true)}
                        style={{ height: 32, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Plus size={13} />
                        <span>Add Expense</span>
                      </button>
                    </div>

                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Description</th>
                            <th>Paid To</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportsData.expenses.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                                No expenses logged for this fair yet.
                              </td>
                            </tr>
                          ) : (
                            reportsData.expenses.map(exp => (
                              <tr key={exp.id}>
                                <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                                  {fmt(exp.expenseDate)}
                                </td>
                                <td>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background:
                                        exp.expenseCategory.includes('Rent') ? '#eff6ff' :
                                        exp.expenseCategory.includes('Decor') ? '#fdf2f8' :
                                        exp.expenseCategory.includes('Staff') ? '#ecfdf5' : '#f1f5f9',
                                      color:
                                        exp.expenseCategory.includes('Rent') ? '#1d4ed8' :
                                        exp.expenseCategory.includes('Decor') ? '#be185d' :
                                        exp.expenseCategory.includes('Staff') ? '#047857' : '#475569',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {exp.expenseCategory}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{exp.description}</div>
                                  {exp.receiptRef && (
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Ref: {exp.receiptRef}</div>
                                  )}
                                </td>
                                <td style={{ color: '#475569' }}>
                                  {exp.paidTo || '—'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                  ৳ {money(exp.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                            <td colSpan={4} style={{ fontWeight: 700, color: '#0f172a' }}>
                              Total Fair Operating Expenses ({reportsData.expenses.length} vouchers)
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: 14 }}>
                              ৳ {money(reportsData.financialSummary.totalExpenses)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* Tab 2: Commercial Sales & POS Analytics */}
              {activeReportTab === 'sales' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 18 }}>
                  {/* Daily Sales Trend & Payment Mix */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Payment Method Breakdown */}
                    <section className="panel" style={{ padding: '20px 22px', background: '#fff' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CreditCard size={16} color="#2563eb" />
                        <span>Payment Method Distribution</span>
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                        {reportsData.salesByPaymentMethod.map(pm => (
                          <div
                            key={pm.paymentMethod}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                              {label(pm.paymentMethod)}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                              ৳ {money(pm.totalAmount)}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 600, marginTop: 2 }}>
                              {pm.sharePct.toFixed(1)}% ({pm.memoCount} memos)
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Stacked Progress Bar */}
                      <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', display: 'flex', background: '#f1f5f9' }}>
                        {reportsData.salesByPaymentMethod.map((pm, i) => {
                          const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                          return (
                            <div
                              key={pm.paymentMethod}
                              title={`${label(pm.paymentMethod)}: ৳${money(pm.totalAmount)} (${pm.sharePct.toFixed(1)}%)`}
                              style={{
                                width: `${pm.sharePct}%`,
                                background: colors[i % colors.length],
                              }}
                            />
                          );
                        })}
                      </div>
                    </section>

                    {/* Daily Sales Trend Table */}
                    <section className="panel" style={{ padding: '20px 22px', background: '#fff' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={16} color="#059669" />
                        <span>Daily Sales Timeline</span>
                      </h3>

                      <div className="table-wrap">
                        <table className="data-table" style={{ fontSize: 12.5 }}>
                          <thead>
                            <tr>
                              <th>Sales Date</th>
                              <th style={{ textAlign: 'center' }}>Memos</th>
                              <th style={{ textAlign: 'center' }}>Copies Sold</th>
                              <th style={{ textAlign: 'right' }}>Discounts Given</th>
                              <th style={{ textAlign: 'right' }}>Net Sales</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportsData.dailySalesTrend.length === 0 ? (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                                  No daily sales transactions logged.
                                </td>
                              </tr>
                            ) : (
                              reportsData.dailySalesTrend.map(row => (
                                <tr key={row.saleDate}>
                                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.saleDate}</td>
                                  <td style={{ textAlign: 'center' }}>{row.memoCount}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>
                                    {row.copiesSold} copies
                                  </td>
                                  <td style={{ textAlign: 'right', color: '#dc2626' }}>
                                    ৳ {money(row.discountAmount)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                    ৳ {money(row.netSales)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  {/* Top Selling Titles Leaderboard */}
                  <section className="panel" style={{ padding: '20px 22px', background: '#fff' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BookOpen size={16} color="#7c3aed" />
                      <span>Best-Selling Books at Fair</span>
                    </h3>

                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>Book Title & SKU</th>
                            <th style={{ textAlign: 'center' }}>Sold</th>
                            <th style={{ textAlign: 'right' }}>Avg Price</th>
                            <th style={{ textAlign: 'right' }}>Total Net Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportsData.topSellingBooks.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                                No book sales logged for this fair yet.
                              </td>
                            </tr>
                          ) : (
                            reportsData.topSellingBooks.map((book, idx) => (
                              <tr key={book.itemId}>
                                <td style={{ fontWeight: 700, color: idx < 3 ? '#d97706' : '#64748b' }}>
                                  {idx + 1}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{book.itemName}</div>
                                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                                    {book.itemCode}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontWeight: 700,
                                      fontSize: 12,
                                      background: '#ecfdf5',
                                      color: '#047857',
                                    }}
                                  >
                                    {book.copiesSold}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', color: '#475569' }}>
                                  ৳ {money(book.avgUnitPrice)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                  ৳ {money(book.totalNetSales)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* Tab 3: Stall & Pavilion Breakdown */}
              {activeReportTab === 'booths' && (
                <section className="panel" style={{ padding: '22px 24px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Store size={16} color="#2563eb" />
                        <span>Fair Stalls & Pavilions Commercial Performance</span>
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Comparison of sales revenue, copies sold, customer ticket sizes, and booth manager assignments.
                      </div>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table" style={{ fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th>Stall Code & Name</th>
                          <th>Type</th>
                          <th>Manager / In-Charge</th>
                          <th style={{ textAlign: 'center' }}>Memos Issued</th>
                          <th style={{ textAlign: 'center' }}>Copies Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Net Sales</th>
                          <th style={{ textAlign: 'right' }}>Avg Ticket Size</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsData.boothPerformance.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
                              No stalls registered for this event yet.
                            </td>
                          </tr>
                        ) : (
                          reportsData.boothPerformance.map(b => (
                            <tr key={b.boothId}>
                              <td>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.boothName}</div>
                                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>Code: {b.boothNumber}</div>
                              </td>
                              <td>
                                <span className="badge" style={{ textTransform: 'capitalize' }}>
                                  {label(b.boothType)}
                                </span>
                              </td>
                              <td style={{ color: '#475569' }}>
                                {b.inChargeName || 'Unassigned'}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                {b.memoCount}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                                {b.copiesSold} copies
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                                ৳ {money(b.netSales)}
                              </td>
                              <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                                ৳ {money(b.avgTicket)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <Link
                                  className="btn"
                                  href={`/book-fair-events/fair-sales-entry?event=${selected.id}&booth=${b.boothId}`}
                                  style={{ height: 30, padding: '0 10px', fontSize: 11.5 }}
                                >
                                  Open POS
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Tab 4: Stock Movement & Reconciliation Audit */}
              {activeReportTab === 'inventory' && (
                <section className="panel" style={{ padding: '22px 24px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={16} color="#059669" />
                        <span>Central Warehouse Stock Audit & Reconciliation</span>
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Full lifecycle tracking: dispatched books from main warehouse vs sales vs returns vs stall balance.
                      </div>
                    </div>

                    <Link
                      className="btn btn-primary"
                      href={`/book-fair-events/post-fair-stock-reconciliation?event=${selected.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                    >
                      <RotateCcw size={14} />
                      <span>Reconcile & Return Stock</span>
                    </Link>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                    <div style={{ padding: '16px 18px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        1. Total Dispatched to Fair
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                        {reportsData.inventoryAudit.totalAllocated.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        From central warehouse
                      </div>
                    </div>

                    <div style={{ padding: '16px 18px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                        2. Sold at Counter
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                        {reportsData.inventoryAudit.totalCopiesSold.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        Verified via sales memos
                      </div>
                    </div>

                    <div style={{ padding: '16px 18px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                        3. Current In-Stall Balance
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                        {reportsData.inventoryAudit.totalInStall.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        Awaiting post-fair return
                      </div>
                    </div>

                    <div style={{ padding: '16px 18px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
                        4. Restocked to Central
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
                        {reportsData.inventoryAudit.totalReturned.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>copies</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        Returned in sound condition
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '18px 20px', borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <ShieldCheck size={28} color="#2563eb" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 14 }}>
                          Stock Reconciliation Status: {reportsData.inventoryAudit.reconciliationStatus}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#3b82f6', marginTop: 2 }}>
                          {reportsData.inventoryAudit.totalInStall === 0
                            ? 'All dispatched inventory has been accounted for between sales and central returns.'
                            : `${reportsData.inventoryAudit.totalInStall} copies remain at fair stalls. Restock them to central warehouse after the fair concludes.`}
                        </div>
                      </div>
                    </div>

                    <Link
                      className="btn btn-primary"
                      href={`/book-fair-events/post-fair-stock-reconciliation?event=${selected.id}`}
                      style={{ height: 36, fontSize: 12.5 }}
                    >
                      Audit Stall Inventory
                    </Link>
                  </div>
                </section>
              )}
            </>
          ) : (
            <div style={{ padding: 48, textAlign: 'center', background: '#f8fafc', borderRadius: 14, color: '#64748b', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>
                Select a Fair Event to View Reports
              </div>
              <p style={{ margin: '6px auto 0', maxWidth: 420, fontSize: 13 }}>
                Choose a book fair event from the dropdown selector above to analyze profitability, retail memos, booth metrics, and operational expenses.
              </p>
            </div>
          )}

          {/* Add Fair Expense Modal */}
          {expenseModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                className="panel"
                style={{
                  width: 'min(540px, 95vw)',
                  background: '#fff',
                  borderRadius: 14,
                  padding: 24,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Record Fair Expense</h3>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Post direct operational expense to event ledger</div>
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => setExpenseModalOpen(false)}
                    style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer' }}
                  >
                    <X size={18} color="#64748b" />
                  </button>
                </div>

                <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label className="field">
                    <span>Expense Category *</span>
                    <select
                      className="input"
                      required
                      value={expenseForm.expenseCategory}
                      onChange={e => setExpenseForm({ ...expenseForm, expenseCategory: e.target.value })}
                    >
                      <option value="Stall Rent & Space">Stall Rent & Space</option>
                      <option value="Booth Decoration & Fabrication">Booth Decoration & Fabrication</option>
                      <option value="Staff Meals & Stipends">Staff Meals & Stipends</option>
                      <option value="Transport & Freight">Transport & Freight</option>
                      <option value="Marketing & Banners">Marketing & Banners</option>
                      <option value="Electricity & Utilities">Electricity & Utilities</option>
                      <option value="Permits & Security">Permits & Security</option>
                      <option value="Miscellaneous / Other">Miscellaneous / Other</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Description / Details *</span>
                    <input
                      className="input"
                      required
                      placeholder="e.g. Pavilion banner fabrication and lighting setup"
                      value={expenseForm.description}
                      onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label className="field">
                      <span>Amount (৳) *</span>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={expenseForm.amount}
                        onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Expense Date *</span>
                      <input
                        className="input"
                        type="date"
                        required
                        value={expenseForm.expenseDate}
                        onChange={e => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label className="field">
                      <span>Paid To (Vendor / Person)</span>
                      <input
                        className="input"
                        placeholder="e.g. Creative Signage Ltd"
                        value={expenseForm.paidTo}
                        onChange={e => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Payment Method</span>
                      <select
                        className="input"
                        value={expenseForm.paymentMethod}
                        onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                      >
                        <option value="cash">Cash</option>
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span>Receipt / Voucher Reference No.</span>
                    <input
                      className="input"
                      placeholder="e.g. VCH-2027-042"
                      value={expenseForm.receiptRef}
                      onChange={e => setExpenseForm({ ...expenseForm, receiptRef: e.target.value })}
                    />
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setExpenseModalOpen(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy}
                    >
                      {busy ? 'Saving...' : 'Record Expense'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
