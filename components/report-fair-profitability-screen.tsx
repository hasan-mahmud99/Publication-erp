'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Calendar,
  Search,
  Download,
  Printer,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ChevronRight,
  Info,
  ExternalLink,
  ShieldCheck,
  Eye,
  X,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  FileText,
  AlertCircle,
  HelpCircle,
  Briefcase,
  Store,
  BookOpen,
  PieChart,
  Truck,
  Layers,
  ShoppingBag,
  Coins,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';

type FairKpis = {
  totalFairSales: number;
  grossSales: number;
  totalDiscounts: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  netOperatingProfit: number;
  netMarginPct: number;
  overallRoiPct: number;
  totalCopiesSold: number;
  totalReceipts: number;
  avgOrderValue: number;
  activeFairsCount: number;
};

type FairEventMatrixRow = {
  id: string;
  eventCode: string;
  name: string;
  eventType: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  status: string;
  managerName: string;
  boothCount: number;
  salesTarget: number;
  budgetAmount: number;
  grossSales: number;
  discountAmount: number;
  netSales: number;
  targetAchievementPct: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  budgetVariance: number;
  netProfit: number;
  netMarginPct: number;
  roiPct: number;
  copiesSold: number;
  receiptCount: number;
  avgTicket: number;
};

type TopBookRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  editionId: string;
  copiesSold: number;
  avgUnitPrice: number;
  totalDiscount: number;
  totalNetSales: number;
  unitCost: number;
  totalCogs: number;
  grossMargin: number;
  marginPct: number;
  allocatedCopies: number;
  sellThroughPct: number;
};

type ExpenseCategoryRow = {
  categoryKey: string;
  categoryName: string;
  voucherCount: number;
  totalAmount: number;
  sharePct: number;
};

type PaymentMethodRow = {
  paymentMethod: string;
  label: string;
  receiptCount: number;
  totalAmount: number;
  sharePct: number;
};

type StockTraceRow = {
  eventId: string;
  eventCode: string;
  eventName: string;
  allocatedQty: number;
  soldQty: number;
  returnedQty: number;
  inStallQty: number;
  shrinkageQty: number;
  sellThroughPct: number;
  reconciliationStatus: string;
};

type FairReportData = {
  kpis: FairKpis;
  eventsMatrix: FairEventMatrixRow[];
  topSellingBooks: TopBookRow[];
  expensesByCategory: ExpenseCategoryRow[];
  paymentMethodBreakdown: PaymentMethodRow[];
  stockTrace: StockTraceRow[];
};

export function ReportFairProfitabilityScreen() {
  const [data, setData] = useState<FairReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'matrix' | 'books' | 'expenses' | 'stock'>('matrix');

  // Drilldown Modal
  const [drilldownEvent, setDrilldownEvent] = useState<FairEventMatrixRow | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedEventId !== 'all') params.append('eventId', selectedEventId);
      if (selectedCity !== 'all') params.append('city', selectedCity);
      if (selectedEventType !== 'all') params.append('eventType', selectedEventType);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api<{ data: FairReportData }>(`/reports/fair-profitability${queryString}`);
      if (res && res.data) {
        setData(res.data);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (err: any) {
      console.error('Failed to load fair profitability report:', err);
      setError(err?.message || 'Unable to retrieve fair profitability report.');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, selectedCity, selectedEventType, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const fmtMoney = (val: number | undefined | null) => {
    const num = Number(val || 0);
    return `BDT ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtPercent = (val: number | undefined | null) => {
    const num = Number(val || 0);
    return `${num.toFixed(1)}%`;
  };

  // Distinct cities from matrix
  const distinctCities = useMemo(() => {
    if (!data?.eventsMatrix) return [];
    const set = new Set<string>();
    data.eventsMatrix.forEach(e => {
      if (e.city && e.city !== '—') set.add(e.city);
    });
    return Array.from(set);
  }, [data?.eventsMatrix]);

  // Distinct events for dropdown
  const allEventsList = useMemo(() => {
    if (!data?.eventsMatrix) return [];
    return data.eventsMatrix.map(e => ({ id: e.id, name: e.name, code: e.eventCode }));
  }, [data?.eventsMatrix]);

  // Filtered Matrix Rows for table display
  const filteredEvents = useMemo(() => {
    if (!data?.eventsMatrix) return [];
    let list = [...data.eventsMatrix];
    if (selectedEventId !== 'all') {
      list = list.filter(e => e.id === selectedEventId);
    }
    if (selectedCity !== 'all') {
      list = list.filter(e => e.city.toLowerCase() === selectedCity.toLowerCase());
    }
    if (selectedEventType !== 'all') {
      list = list.filter(e => e.eventType === selectedEventType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.eventCode.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.eventsMatrix, selectedEventId, selectedCity, selectedEventType, searchQuery]);

  // Filtered Top Books
  const filteredBooks = useMemo(() => {
    if (!data?.topSellingBooks) return [];
    if (!searchQuery.trim()) return data.topSellingBooks;
    const q = searchQuery.toLowerCase();
    return data.topSellingBooks.filter(b =>
      b.itemName.toLowerCase().includes(q) ||
      b.itemCode.toLowerCase().includes(q)
    );
  }, [data?.topSellingBooks, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return;
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'matrix') {
      csvContent += 'Event Code,Event Name,Type,Venue,City,Start Date,End Date,Status,Sales Target (BDT),Target Pct,Gross Sales (BDT),Discounts (BDT),Net Sales (BDT),COGS (BDT),Gross Margin Pct,Operating Expenses (BDT),Net Profit (BDT),Net Margin Pct,ROI Pct,Copies Sold,Receipts\n';
      filteredEvents.forEach(e => {
        csvContent += `"${e.eventCode}","${e.name}","${e.eventType}","${e.venue}","${e.city}","${e.startDate}","${e.endDate}","${e.status}",${e.salesTarget},"${e.targetAchievementPct.toFixed(1)}%",${e.grossSales},${e.discountAmount},${e.netSales},${e.cogs},"${e.grossMarginPct.toFixed(1)}%",${e.operatingExpenses},${e.netProfit},"${e.netMarginPct.toFixed(1)}%","${e.roiPct.toFixed(1)}%",${e.copiesSold},${e.receiptCount}\n`;
      });
    } else if (activeTab === 'books') {
      csvContent += 'Item Code,Book Title,Copies Sold,Avg List Price (BDT),Total Net Sales (BDT),Unit Cost (BDT),Total COGS (BDT),Gross Margin (BDT),Gross Margin Pct,Allocated Copies,Sell-Through Pct\n';
      filteredBooks.forEach(b => {
        csvContent += `"${b.itemCode}","${b.itemName}",${b.copiesSold},${b.avgUnitPrice},${b.totalNetSales},${b.unitCost},${b.totalCogs},${b.grossMargin},"${b.marginPct.toFixed(1)}%",${b.allocatedCopies},"${b.sellThroughPct.toFixed(1)}%"\n`;
      });
    } else if (activeTab === 'expenses') {
      csvContent += 'Expense Category,Vouchers Count,Total Amount (BDT),Share Pct\n';
      data.expensesByCategory.forEach(c => {
        csvContent += `"${c.categoryName}",${c.voucherCount},${c.totalAmount},"${c.sharePct.toFixed(1)}%"\n`;
      });
    } else {
      csvContent += 'Event Code,Event Name,Allocated Qty,Sold Qty,Returned Qty,In-Stall Qty,Shrinkage Qty,Sell-Through Pct,Reconciliation Status\n';
      data.stockTrace.forEach(s => {
        csvContent += `"${s.eventCode}","${s.eventName}",${s.allocatedQty},${s.soldQty},${s.returnedQty},${s.inStallQty},${s.shrinkageQty},"${s.sellThroughPct.toFixed(1)}%","${s.reconciliationStatus}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `book_fair_profitability_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSelectedEventId('all');
    setSelectedCity('all');
    setSelectedEventType('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header with Title & Global Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Book/Fair Profitability Reports
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Audited Ledger
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Event-level P&L, direct catalog production costs, stall operational overheads, and title margin analytics across publishing fairs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchReport()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : 'text-gray-500'}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-gray-500" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* 2. Cross-Module Links Navigation Hub */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-100 rounded-xl p-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-900">
            <Store className="w-4 h-4 text-blue-600" />
            <span>Inter-Module Connections & Workspaces</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/book-fair-events/fair-event-list"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <Calendar className="w-3.5 h-3.5" />
              Fair Events
              <ChevronRight className="w-3 h-3 text-blue-400" />
            </Link>
            <Link
              href="/book-fair-events/fair-setup-and-booth"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <Building2 className="w-3.5 h-3.5" />
              Stall & Booths
              <ChevronRight className="w-3 h-3 text-blue-400" />
            </Link>
            <Link
              href="/book-fair-events/fair-stock-allocation"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <Truck className="w-3.5 h-3.5" />
              Stock Allocation
              <ChevronRight className="w-3 h-3 text-blue-400" />
            </Link>
            <Link
              href="/book-fair-events/fair-sales-entry"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              POS Sales Entry
              <ChevronRight className="w-3 h-3 text-blue-400" />
            </Link>
            <Link
              href="/book-fair-events/post-fair-stock-reconciliation"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Post-Fair Returns
              <ChevronRight className="w-3 h-3 text-blue-400" />
            </Link>
            <Link
              href="/finance-accounting/general-ledger"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <FileText className="w-3.5 h-3.5" />
              Finance GL
              <ChevronRight className="w-3 h-3 text-blue-400" />
            </Link>
            <Link
              href="/publishing-catalog/book-catalog-list"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition font-medium"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Book Catalog
              <ExternalLink className="w-3 h-3 text-blue-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Executive KPI Cards (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Net Fair Sales */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-blue-300 transition">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Fair Net Sales</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">
            {fmtMoney(data?.kpis?.totalFairSales)}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Gross: {fmtMoney(data?.kpis?.grossSales)}</span>
            <span className="text-amber-600 font-medium">Disc: -{fmtMoney(data?.kpis?.totalDiscounts)}</span>
          </div>
        </div>

        {/* Card 2: Fair Operating Expenses */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-amber-300 transition">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Operating Expenses</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">
            {fmtMoney(data?.kpis?.totalExpenses)}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Stall, logistics & staff</span>
            <span className="text-gray-600 font-medium">{data?.expensesByCategory?.length || 0} Categories</span>
          </div>
        </div>

        {/* Card 3: Net Operating Profit */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-emerald-300 transition">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Net Operating Profit</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-xl font-bold tracking-tight ${(data?.kpis?.netOperatingProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtMoney(data?.kpis?.netOperatingProfit)}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Net Margin</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {fmtPercent(data?.kpis?.netMarginPct)}
            </span>
          </div>
        </div>

        {/* Card 4: Overall Fair ROI */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-indigo-300 transition">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Overall Fair ROI</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-indigo-700 tracking-tight">
            {fmtPercent(data?.kpis?.overallRoiPct)}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Return on Stall Expense</span>
            <span className="text-indigo-600 font-medium">Gross: {fmtPercent(data?.kpis?.grossMarginPct)}</span>
          </div>
        </div>

        {/* Card 5: Total Copies Sold & Memos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-purple-300 transition">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Volumes & Memos</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <BookOpen className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">
            {(data?.kpis?.totalCopiesSold || 0).toLocaleString()} <span className="text-sm font-normal text-gray-500">Copies</span>
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>{data?.kpis?.totalReceipts || 0} POS Memos</span>
            <span className="text-purple-700 font-medium">Avg: {fmtMoney(data?.kpis?.avgOrderValue)}</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Event Picker */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Fair Events ({data?.eventsMatrix?.length || 0})</option>
              {allEventsList.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </option>
              ))}
            </select>
          </div>

          {/* City / Venue */}
          <div className="w-full sm:w-[160px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">City / Region</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Cities</option>
              {distinctCities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div className="w-full sm:w-[160px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="book_fair">Book Fair</option>
              <option value="education_fair">Education Fair</option>
              <option value="institutional_event">Institutional</option>
              <option value="launch">Book Launch</option>
              <option value="exhibition">Exhibition</option>
            </select>
          </div>

          {/* Date Range From */}
          <div className="w-full sm:w-[140px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date Range To */}
          <div className="w-full sm:w-[140px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Search Query */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search event, venue, book title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Reset button */}
          <div className="flex items-end pt-5">
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 text-xs text-gray-500">
          <span className="font-medium text-gray-700">Quick Presets:</span>
          <button
            onClick={() => { setFromDate('2026-01-01'); setToDate('2026-12-31'); setSelectedCity('all'); }}
            className="hover:text-blue-600 underline"
          >
            2026 Fair Season
          </button>
          <span>•</span>
          <button
            onClick={() => { setSelectedCity('Dhaka'); }}
            className="hover:text-blue-600 underline"
          >
            Dhaka Events Only
          </button>
          <span>•</span>
          <button
            onClick={() => { setSelectedCity('Chattogram'); }}
            className="hover:text-blue-600 underline"
          >
            Chattogram Boi Mela
          </button>
          <span>•</span>
          <button
            onClick={() => { setSelectedEventType('book_fair'); }}
            className="hover:text-blue-600 underline"
          >
            Book Fairs Only
          </button>
        </div>
      </div>

      {/* 5. Modern Tab Navigation (4 Tabs) */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'matrix'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Event Profitability & ROI Matrix</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
              {filteredEvents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'books'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Book Title Fair Profitability</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
              {filteredBooks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'expenses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Cost Center & Payment Channels</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
              {data?.expensesByCategory?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'stock'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Stock Trace & Sell-Through</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
              {data?.stockTrace?.length || 0}
            </span>
          </button>
        </nav>
      </div>

      {/* 6. Tab Contents */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">Calculating book fair profitability metrics...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-red-800">Error Loading Report</h3>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={() => fetchReport()}
            className="mt-4 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Retry Calculation
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: Event Profitability & ROI Matrix */}
          {activeTab === 'matrix' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Event-by-Event Profitability & ROI Matrix</h3>
                  <p className="text-xs text-gray-500">Comparative revenue, direct item cost, operational expenses, and net returns by book fair</p>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  Showing {filteredEvents.length} events
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3.5">Event / Fair Name</th>
                      <th className="px-4 py-3.5">Venue & City</th>
                      <th className="px-4 py-3.5 text-right">Target (BDT)</th>
                      <th className="px-4 py-3.5 text-right">Net Sales (BDT)</th>
                      <th className="px-4 py-3.5 text-right">Direct COGS</th>
                      <th className="px-4 py-3.5 text-right">Stall Expense</th>
                      <th className="px-4 py-3.5 text-right">Net Profit</th>
                      <th className="px-4 py-3.5 text-right">Margin %</th>
                      <th className="px-4 py-3.5 text-right">Fair ROI %</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                          No fair events match the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-blue-50/40 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-gray-900">{evt.name}</div>
                            <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>{evt.eventCode}</span>
                              <span>•</span>
                              <span>{evt.startDate} to {evt.endDate}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-gray-600">
                            <div className="truncate max-w-[160px] font-medium text-gray-800" title={evt.venue}>{evt.venue}</div>
                            <div className="text-[11px] text-gray-500">{evt.city} • {evt.boothCount} Stall(s)</div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-600">
                            <div>{fmtMoney(evt.salesTarget)}</div>
                            <div className="text-[11px] text-gray-500">
                              Ach: <span className="font-semibold text-blue-700">{fmtPercent(evt.targetAchievementPct)}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold text-gray-900">
                            <div>{fmtMoney(evt.netSales)}</div>
                            <div className="text-[11px] text-gray-400 font-normal">
                              {evt.copiesSold} copies • {evt.receiptCount} memos
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-600">
                            {fmtMoney(evt.cogs)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-amber-700 font-medium">
                            <div>{fmtMoney(evt.operatingExpenses)}</div>
                            <div className="text-[10px] text-gray-400">
                              Budget: {fmtMoney(evt.budgetAmount)}
                            </div>
                          </td>

                          <td className={`px-4 py-3.5 text-right whitespace-nowrap font-bold ${evt.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {fmtMoney(evt.netProfit)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${evt.netMarginPct >= 20 ? 'bg-emerald-50 text-emerald-700' : evt.netMarginPct > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                              {fmtPercent(evt.netMarginPct)}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-bold">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${evt.roiPct >= 100 ? 'bg-indigo-50 text-indigo-700' : evt.roiPct > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {fmtPercent(evt.roiPct)}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              evt.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : evt.status === 'active'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {evt.status}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => setDrilldownEvent(evt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredEvents.length > 0 && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-xs text-gray-900">
                      <tr>
                        <td className="px-4 py-3.5">
                          Portfolio Total ({filteredEvents.length} Events)
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">—</td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {fmtMoney(filteredEvents.reduce((s, e) => s + e.salesTarget, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-blue-700">
                          {fmtMoney(filteredEvents.reduce((s, e) => s + e.netSales, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {fmtMoney(filteredEvents.reduce((s, e) => s + e.cogs, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-amber-700">
                          {fmtMoney(filteredEvents.reduce((s, e) => s + e.operatingExpenses, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-emerald-700">
                          {fmtMoney(filteredEvents.reduce((s, e) => s + e.netProfit, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {fmtPercent(data?.kpis?.netMarginPct)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-indigo-700">
                          {fmtPercent(data?.kpis?.overallRoiPct)}
                        </td>
                        <td colSpan={2} className="px-4 py-3.5"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Book Title Fair Profitability */}
          {activeTab === 'books' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Book Title Profitability & Sell-Through at Fairs</h3>
                  <p className="text-xs text-gray-500">Unit-level sales performance, estimated production cost, gross profit contribution, and stall sell-through</p>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {filteredBooks.length} book titles ranked
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3.5">Item Code & Title</th>
                      <th className="px-4 py-3.5 text-right">Copies Sold</th>
                      <th className="px-4 py-3.5 text-right">Avg Retail Price</th>
                      <th className="px-4 py-3.5 text-right">Total Net Sales (BDT)</th>
                      <th className="px-4 py-3.5 text-right">Unit Print Cost</th>
                      <th className="px-4 py-3.5 text-right">Total COGS (BDT)</th>
                      <th className="px-4 py-3.5 text-right">Gross Contribution</th>
                      <th className="px-4 py-3.5 text-right">Margin %</th>
                      <th className="px-4 py-3.5 text-right">Allocated Qty</th>
                      <th className="px-4 py-3.5 text-right">Sell-Through %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredBooks.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                          No book title records found.
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((book) => (
                        <tr key={book.itemId} className="hover:bg-blue-50/40 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-gray-900">{book.itemName}</div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">{book.itemCode}</div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-bold text-gray-900 whitespace-nowrap">
                            {book.copiesSold.toLocaleString()} units
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-600">
                            {fmtMoney(book.avgUnitPrice)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-bold text-blue-700">
                            {fmtMoney(book.totalNetSales)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-500">
                            {fmtMoney(book.unitCost)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-600">
                            {fmtMoney(book.totalCogs)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold text-emerald-700">
                            {fmtMoney(book.grossMargin)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              {fmtPercent(book.marginPct)}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap text-gray-600">
                            {book.allocatedCopies.toLocaleString()} units
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap font-bold text-indigo-700">
                            {book.allocatedCopies > 0 ? fmtPercent(book.sellThroughPct) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Cost Center & Payment Channels */}
          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Center / Expense Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-amber-600" />
                    Fair Expense Cost Center Distribution
                  </h3>
                  <p className="text-xs text-gray-500">Itemized overheads including stall rental, carpentry setup, freight and staff honorariums</p>
                </div>

                <div className="space-y-3">
                  {data?.expensesByCategory?.map((cat) => (
                    <div key={cat.categoryKey} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
                        <span>{cat.categoryName}</span>
                        <span className="text-gray-900 font-bold">{fmtMoney(cat.totalAmount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, cat.sharePct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5">
                        <span>{cat.voucherCount} Expense Voucher(s)</span>
                        <span className="font-semibold text-amber-700">{fmtPercent(cat.sharePct)} of Total Cost</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between text-xs font-bold text-gray-900">
                  <span>Total Recorded Fair Expenses:</span>
                  <span>{fmtMoney(data?.kpis?.totalExpenses)}</span>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    POS Payment Channel Collection Split
                  </h3>
                  <p className="text-xs text-gray-500">Breakdown of gross fair collection across physical Cash, bKash, Nagad, and Card swipe terminals</p>
                </div>

                <div className="space-y-3">
                  {data?.paymentMethodBreakdown?.map((pm) => (
                    <div key={pm.paymentMethod} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
                        <span>{pm.label}</span>
                        <span className="text-blue-700 font-bold">{fmtMoney(pm.totalAmount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, pm.sharePct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5">
                        <span>{pm.receiptCount} Completed Receipts</span>
                        <span className="font-semibold text-blue-700">{fmtPercent(pm.sharePct)} of Revenue</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between text-xs font-bold text-gray-900">
                  <span>Total Net Sales Collection:</span>
                  <span>{fmtMoney(data?.kpis?.totalFairSales)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Stock Trace & Sell-Through */}
          {activeTab === 'stock' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Fair Stock Trace & Post-Fair Reconciliation</h3>
                  <p className="text-xs text-gray-500">Warehouse allocation, on-site sales, returned sound units, shrinkage and stall reconciliation</p>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {data?.stockTrace?.length || 0} event audits
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3.5">Event Name</th>
                      <th className="px-4 py-3.5 text-right">Allocated Qty</th>
                      <th className="px-4 py-3.5 text-right">Copies Sold</th>
                      <th className="px-4 py-3.5 text-right">Sound Returned</th>
                      <th className="px-4 py-3.5 text-right">Current On-Stall</th>
                      <th className="px-4 py-3.5 text-right">Shrinkage / Loss</th>
                      <th className="px-4 py-3.5 text-right">Sell-Through Rate</th>
                      <th className="px-4 py-3.5 text-center">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {data?.stockTrace?.map((row) => (
                      <tr key={row.eventId} className="hover:bg-blue-50/40 transition">
                        <td className="px-4 py-3.5 font-semibold text-gray-900">
                          <div>{row.eventName}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{row.eventCode}</div>
                        </td>

                        <td className="px-4 py-3.5 text-right text-gray-700 whitespace-nowrap">
                          {row.allocatedQty.toLocaleString()} units
                        </td>

                        <td className="px-4 py-3.5 text-right font-bold text-blue-700 whitespace-nowrap">
                          {row.soldQty.toLocaleString()} units
                        </td>

                        <td className="px-4 py-3.5 text-right text-emerald-700 font-medium whitespace-nowrap">
                          {row.returnedQty.toLocaleString()} units
                        </td>

                        <td className="px-4 py-3.5 text-right text-amber-700 whitespace-nowrap">
                          {row.inStallQty.toLocaleString()} units
                        </td>

                        <td className="px-4 py-3.5 text-right text-red-600 whitespace-nowrap">
                          {row.shrinkageQty > 0 ? `${row.shrinkageQty} units` : '0'}
                        </td>

                        <td className="px-4 py-3.5 text-right font-bold text-indigo-700 whitespace-nowrap">
                          {row.allocatedQty > 0 ? fmtPercent(row.sellThroughPct) : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.reconciliationStatus === 'Fully Reconciled'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.reconciliationStatus.includes('Active')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {row.reconciliationStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 7. Drilldown Modal */}
      {drilldownEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-start justify-between bg-gray-50/80">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">{drilldownEvent.name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-100 text-blue-800">
                    {drilldownEvent.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  {drilldownEvent.eventCode} • {drilldownEvent.venue}, {drilldownEvent.city} • {drilldownEvent.startDate} to {drilldownEvent.endDate}
                </p>
              </div>
              <button
                onClick={() => setDrilldownEvent(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-gray-700">
              {/* Event P&L Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                  <div className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">Gross Sales</div>
                  <div className="text-base font-bold text-blue-900 mt-1">{fmtMoney(drilldownEvent.grossSales)}</div>
                  <div className="text-[10px] text-blue-600 mt-0.5">Discount: -{fmtMoney(drilldownEvent.discountAmount)}</div>
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
                  <div className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Net Sales</div>
                  <div className="text-base font-bold text-emerald-900 mt-1">{fmtMoney(drilldownEvent.netSales)}</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">{drilldownEvent.copiesSold} Copies Sold</div>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100">
                  <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Stall Overhead</div>
                  <div className="text-base font-bold text-amber-900 mt-1">{fmtMoney(drilldownEvent.operatingExpenses)}</div>
                  <div className="text-[10px] text-amber-600 mt-0.5">Budget: {fmtMoney(drilldownEvent.budgetAmount)}</div>
                </div>

                <div className="bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
                  <div className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider">Net Return (ROI)</div>
                  <div className="text-base font-bold text-indigo-900 mt-1">{fmtPercent(drilldownEvent.roiPct)}</div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">Profit: {fmtMoney(drilldownEvent.netProfit)}</div>
                </div>
              </div>

              {/* Event Detail Specifications */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 font-medium">Event Manager</div>
                  <div className="font-semibold text-gray-900 mt-0.5">{drilldownEvent.managerName}</div>
                </div>
                <div>
                  <div className="text-gray-500 font-medium">Allocated Stalls</div>
                  <div className="font-semibold text-gray-900 mt-0.5">{drilldownEvent.boothCount} Stall / Pavilion(s)</div>
                </div>
                <div>
                  <div className="text-gray-500 font-medium">Sales Target Achievement</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {fmtMoney(drilldownEvent.netSales)} / {fmtMoney(drilldownEvent.salesTarget)} ({fmtPercent(drilldownEvent.targetAchievementPct)})
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 font-medium">Expense Budget Variance</div>
                  <div className={`font-semibold mt-0.5 ${drilldownEvent.budgetVariance <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {drilldownEvent.budgetVariance <= 0 ? 'Within Budget (Savings)' : 'Budget Overage'}: {fmtMoney(Math.abs(drilldownEvent.budgetVariance))}
                  </div>
                </div>
              </div>

              {/* Action Buttons to Dedicated Workspaces */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Jump to Fair operational screens:
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/book-fair-events/fair-setup-and-booth`}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                  >
                    View Booth Setup
                  </Link>
                  <Link
                    href={`/book-fair-events/fair-sales-entry`}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                  >
                    Open Counter POS
                  </Link>
                  <button
                    onClick={() => setDrilldownEvent(null)}
                    className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
