'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Clock,
  Search,
  Download,
  Printer,
  RefreshCw,
  Filter,
  Calendar,
  ArrowUpRight,
  ChevronRight,
  Info,
  ExternalLink,
  ShieldCheck,
  Eye,
  X,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  FileText,
  AlertCircle,
  HelpCircle,
  Briefcase
} from 'lucide-react';

type CohortBreakdown = {
  current_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total: number;
};

type AgeingSummary = {
  totalReceivables: number;
  totalPayables: number;
  netWorkingCapitalGap: number;
  totalOverdueReceivables: number;
  totalOverduePayables: number;
  criticalReceivables90Plus: number;
  criticalPayables90Plus: number;
  highRiskCustomerCount: number;
  overdueSupplierCount: number;
  totalDebtorCustomers: number;
  totalCreditorSuppliers: number;
  arCohorts: CohortBreakdown;
  apCohorts: CohortBreakdown;
};

type CustomerAgeingRow = {
  id: string;
  customer_code: string;
  name: string;
  customer_type: string;
  credit_limit: number;
  phone?: string | null;
  email?: string | null;
  total_receivable: number;
  current_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  overdue_amount: number;
  overdue_ratio: number;
  credit_limit_utilization: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  invoice_count: number;
  oldest_days: number;
};

type SupplierAgeingRow = {
  id: string;
  supplier_code: string;
  name: string;
  category: string;
  categories: string[];
  payment_terms_days: number;
  phone?: string | null;
  email?: string | null;
  total_payable: number;
  current_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  overdue_amount: number;
  overdue_ratio: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  bill_count: number;
  oldest_days: number;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  customer_type: string;
  total_amount: number;
  due_amount: number;
  currency_code: string;
  status: string;
  sales_channel: string;
  days_outstanding: number;
  cohort: '0_30' | '31_60' | '61_90' | '90_plus';
  is_overdue: boolean;
};

type BillRow = {
  id: string;
  bill_number: string;
  supplier_invoice_number: string;
  purchase_order_id: string;
  po_number: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  category: string;
  categories: string[];
  invoice_date: string;
  due_date: string;
  currency_code: string;
  base_amount: number;
  paid_amount: number;
  credited_amount: number;
  outstanding_amount: number;
  days_outstanding: number;
  cohort: '0_30' | '31_60' | '61_90' | '90_plus';
  is_overdue: boolean;
  status: string;
};

type ReportApiResponse = {
  asOf: string;
  summary: AgeingSummary;
  customers: CustomerAgeingRow[];
  suppliers: SupplierAgeingRow[];
  invoices: InvoiceRow[];
  bills: BillRow[];
};

function formatBDT(amount: number | null | undefined): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return 'BDT ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportCustomerSupplierAgeingScreen() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [asOf, setAsOf] = useState(today);
  const [appliedAsOf, setAppliedAsOf] = useState(today);
  const [entityType, setEntityType] = useState<'all' | 'customer' | 'supplier'>('all');
  const [bucket, setBucket] = useState<'all' | '0_30' | '31_60' | '61_90' | '90_plus'>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'customers' | 'suppliers' | 'trace'>('summary');
  const [traceSubTab, setTraceSubTab] = useState<'invoices' | 'bills'>('invoices');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportApiResponse | null>(null);

  // Drilldown Modal
  const [drilldownEntity, setDrilldownEntity] = useState<{
    type: 'customer' | 'supplier';
    id: string;
    code: string;
    name: string;
    items: (InvoiceRow | BillRow)[];
  } | null>(null);

  const loadData = useCallback(async (cutoffDate: string, currentBucket: string, currentSearch: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cutoffDate) params.set('asOf', cutoffDate);
      if (currentBucket && currentBucket !== 'all') params.set('bucket', currentBucket);
      if (currentSearch.trim()) params.set('search', currentSearch.trim());

      const res = await api<{ data: ReportApiResponse }>(`/reports/customer-supplier-ageing?${params.toString()}`);
      setData(res.data);
      setAppliedAsOf(cutoffDate);
    } catch (err: any) {
      console.error('Failed to load ageing reports:', err);
      setError(err?.message || 'Failed to load customer/supplier ageing report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(asOf, bucket, search);
  }, []);

  const handleApplyFilter = () => {
    loadData(asOf, bucket, search);
  };

  const handleReset = () => {
    setAsOf(today);
    setBucket('all');
    setSearch('');
    setEntityType('all');
    loadData(today, 'all', '');
  };

  const handleExportCsv = () => {
    if (!data) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `CUSTOMER & SUPPLIER AGEING REPORT - AS OF ${appliedAsOf}\n\n`;

    // Summary Section
    csvContent += `EXECUTIVE SUMMARY\n`;
    csvContent += `Total Customer Receivables (AR),${data.summary.totalReceivables}\n`;
    csvContent += `Total Supplier Payables (AP),${data.summary.totalPayables}\n`;
    csvContent += `Net Working Capital Gap,${data.summary.netWorkingCapitalGap}\n`;
    csvContent += `Total Overdue Receivables,${data.summary.totalOverdueReceivables}\n`;
    csvContent += `Total Overdue Payables,${data.summary.totalOverduePayables}\n`;
    csvContent += `Critical 90+ Days AR,${data.summary.criticalReceivables90Plus}\n`;
    csvContent += `Critical 90+ Days AP,${data.summary.criticalPayables90Plus}\n\n`;

    // Customer AR Section
    csvContent += `CUSTOMER RECEIVABLES (AR) AGEING\n`;
    csvContent += `Customer Code,Customer Name,Type,Credit Limit,Current (0-30d),31-60 Days,61-90 Days,90+ Days Overdue,Total Receivable,Overdue Ratio %,Risk Level\n`;
    data.customers.forEach(c => {
      csvContent += `"${c.customer_code}","${c.name}","${c.customer_type}",${c.credit_limit},${c.current_0_30},${c.days_31_60},${c.days_61_90},${c.days_90_plus},${c.total_receivable},${c.overdue_ratio}%,${c.risk_level.toUpperCase()}\n`;
    });
    csvContent += `\n`;

    // Supplier AP Section
    csvContent += `SUPPLIER PAYABLES (AP) AGEING\n`;
    csvContent += `Supplier Code,Supplier Name,Category,Payment Terms,Current (0-30d),31-60 Days,61-90 Days,90+ Days,Total Payable,Overdue Amount,Risk Level\n`;
    data.suppliers.forEach(s => {
      csvContent += `"${s.supplier_code}","${s.name}","${s.category}",${s.payment_terms_days} days,${s.current_0_30},${s.days_31_60},${s.days_61_90},${s.days_90_plus},${s.total_payable},${s.overdue_amount},${s.risk_level.toUpperCase()}\n`;
    });
    csvContent += `\n`;

    // Itemized Unpaid Invoices
    csvContent += `OUTSTANDING CUSTOMER INVOICES\n`;
    csvContent += `Invoice Number,Invoice Date,Due Date,Customer Code,Customer Name,Total Amount,Days Aged,Cohort\n`;
    data.invoices.forEach(i => {
      csvContent += `"${i.invoice_number}",${i.invoice_date},${i.due_date},"${i.customer_code}","${i.customer_name}",${i.total_amount},${i.days_outstanding},${i.cohort}\n`;
    });
    csvContent += `\n`;

    // Itemized Unpaid Bills
    csvContent += `OUTSTANDING SUPPLIER BILLS\n`;
    csvContent += `Bill Number,Supplier Invoice #,PO Number,Supplier Code,Supplier Name,Category,Invoice Date,Due Date,Base Amount,Outstanding Amount,Days Aged,Cohort\n`;
    data.bills.forEach(b => {
      csvContent += `"${b.bill_number}","${b.supplier_invoice_number}","${b.po_number}","${b.supplier_code}","${b.supplier_name}","${b.category}",${b.invoice_date},${b.due_date},${b.base_amount},${b.outstanding_amount},${b.days_outstanding},${b.cohort}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customer-supplier-ageing-report-${appliedAsOf}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenCustomerDrilldown = (customer: CustomerAgeingRow) => {
    if (!data) return;
    const items = data.invoices.filter(i => i.customer_id === customer.id);
    setDrilldownEntity({
      type: 'customer',
      id: customer.id,
      code: customer.customer_code,
      name: customer.name,
      items,
    });
  };

  const handleOpenSupplierDrilldown = (supplier: SupplierAgeingRow) => {
    if (!data) return;
    const items = data.bills.filter(b => b.supplier_id === supplier.id);
    setDrilldownEntity({
      type: 'supplier',
      id: supplier.id,
      code: supplier.supplier_code,
      name: supplier.name,
      items,
    });
  };

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    if (entityType === 'supplier') return [];
    return data.customers;
  }, [data?.customers, entityType]);

  const filteredSuppliers = useMemo(() => {
    if (!data?.suppliers) return [];
    if (entityType === 'customer') return [];
    return data.suppliers;
  }, [data?.suppliers, entityType]);

  const filteredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    return data.invoices;
  }, [data?.invoices]);

  const filteredBills = useMemo(() => {
    if (!data?.bills) return [];
    return data.bills;
  }, [data?.bills]);

  return (
    <div className="space-y-6 pb-12 print:p-0">
      {/* Top Banner & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
              Dual-Track Enterprise Ageing
            </span>
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Accounts Receivable &amp; Payable
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Customer & Supplier Ageing Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Comprehensive Accounts Receivable (AR) and Accounts Payable (AP) ageing analysis by overdue cohorts with working capital liquidity assessment.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => loadData(asOf, bucket, search)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!data || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={!data || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Printer className="h-4 w-4 text-white" />
            Print Report
          </button>
        </div>
      </div>

      {/* Inter-Module Quick Navigation Hub */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-200 print:hidden">
        <span className="font-semibold text-slate-700 px-2 flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5 text-slate-500" />
          Related Workspaces:
        </span>
        <Link
          href="/finance-accounting/accounts-receivable"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-indigo-700 border border-slate-200 shadow-xs hover:bg-indigo-50"
        >
          <DollarSign className="h-3 w-3" />
          Finance Accounts Receivable
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/sales-distribution/sales-invoice-list"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-blue-700 border border-slate-200 shadow-xs hover:bg-blue-50"
        >
          <FileText className="h-3 w-3" />
          Sales Invoice Registry
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/crm-customers/customer-profile"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-emerald-700 border border-slate-200 shadow-xs hover:bg-emerald-50"
        >
          <Users className="h-3 w-3" />
          Customer Directory & Limits
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/procurement-suppliers/supplier-directory"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-amber-700 border border-slate-200 shadow-xs hover:bg-amber-50"
        >
          <Building2 className="h-3 w-3" />
          Supplier Directory & Terms
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/procurement-suppliers/supplier-bill-register"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-rose-700 border border-slate-200 shadow-xs hover:bg-rose-50"
        >
          <Scale className="h-3 w-3" />
          Supplier Bill Register
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs print:hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* As Of Cutoff Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ageing Cutoff Date (As Of)
            </label>
            <div className="relative">
              <input
                type="date"
                value={asOf}
                onChange={e => setAsOf(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Entity Scope
            </label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Customers & Suppliers Combined</option>
              <option value="customer">Customers Only (AR Receivables)</option>
              <option value="supplier">Suppliers Only (AP Payables)</option>
            </select>
          </div>

          {/* Ageing Bucket */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ageing Cohort Filter
            </label>
            <select
              value={bucket}
              onChange={e => setBucket(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Ageing Buckets</option>
              <option value="0_30">Current (0-30 Days)</option>
              <option value="31_60">31 - 60 Days Overdue</option>
              <option value="61_90">61 - 90 Days Overdue</option>
              <option value="90_plus">90+ Days Critical Overdue</option>
            </select>
          </div>

          {/* Search Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Search Accounts / Docs
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Code, Name, Inv #, PO #..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilter()}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Filter Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyFilter}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Apply Filter
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none"
              title="Reset Filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Active Filter Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Active Criteria:</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
            As of: <strong className="text-slate-900">{appliedAsOf}</strong>
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
            Scope: <strong className="text-slate-900 capitalize">{entityType}</strong>
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
            Bucket: <strong className="text-slate-900">{bucket === 'all' ? 'All Cohorts' : bucket.replace('_', '-')}</strong>
          </span>
          {search && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700 ring-1 ring-amber-600/20">
              Search: "{search}"
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Error loading ageing report</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => loadData(asOf, bucket, search)}
            className="text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 5 Executive KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* KPI 1: Total Customer Receivables (AR) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Receivables (AR)
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatBDT(data?.summary?.totalReceivables)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-blue-700">{data?.summary?.totalDebtorCustomers || 0}</span> debtor accounts
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">Current: {formatBDT(data?.summary?.arCohorts?.current_0_30)}</span>
          </div>
        </div>

        {/* KPI 2: Total Supplier Payables (AP) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Payables (AP)
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatBDT(data?.summary?.totalPayables)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-purple-700">{data?.summary?.totalCreditorSuppliers || 0}</span> vendor accounts
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">Current: {formatBDT(data?.summary?.apCohorts?.current_0_30)}</span>
          </div>
        </div>

        {/* KPI 3: Net Working Capital Gap (AR - AP) */}
        <div className={`rounded-xl border p-4 shadow-xs ${
          (data?.summary?.netWorkingCapitalGap || 0) >= 0 
            ? 'border-emerald-200 bg-emerald-50/40' 
            : 'border-rose-200 bg-rose-50/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Working Capital Liquidity
            </span>
            <div className={`rounded-lg p-2 ${
              (data?.summary?.netWorkingCapitalGap || 0) >= 0 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-rose-100 text-rose-700'
            }`}>
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold tracking-tight ${
              (data?.summary?.netWorkingCapitalGap || 0) >= 0 ? 'text-emerald-900' : 'text-rose-900'
            }`}>
              {formatBDT(data?.summary?.netWorkingCapitalGap)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
            {(data?.summary?.netWorkingCapitalGap || 0) >= 0 ? (
              <span className="text-emerald-700">Net Asset Surplus (Liquid Margin)</span>
            ) : (
              <span className="text-rose-700">Liability Gap (Action Required)</span>
            )}
          </div>
        </div>

        {/* KPI 4: 90+ Days Critical Overdue */}
        <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              90+ Days Critical Overdue
            </span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-rose-700">
              {formatBDT((data?.summary?.criticalReceivables90Plus || 0) + (data?.summary?.criticalPayables90Plus || 0))}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <span>AR: <strong className="text-rose-700">{formatBDT(data?.summary?.criticalReceivables90Plus)}</strong></span>
            <span>•</span>
            <span>AP: <strong className="text-slate-700">{formatBDT(data?.summary?.criticalPayables90Plus)}</strong></span>
          </div>
        </div>

        {/* KPI 5: High-Risk Management Accounts */}
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              High-Risk Accounts
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-amber-900">
              {(data?.summary?.highRiskCustomerCount || 0) + (data?.summary?.overdueSupplierCount || 0)}
            </span>
            <span className="text-xs font-semibold text-amber-700">Accounts Flagged</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-amber-800 font-medium">{data?.summary?.highRiskCustomerCount || 0} Customers</span>
            <span>•</span>
            <span className="text-slate-600">{data?.summary?.overdueSupplierCount || 0} Suppliers overdue</span>
          </div>
        </div>
      </div>

      {/* Comparative Cohort Visual Distribution Bars */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Customer Receivables Cohort Distribution Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                Customer Receivables (AR) Cohort Breakdown
              </h2>
              <p className="text-xs text-slate-500">Total BDT {formatBDT(data?.summary?.totalReceivables)} across ageing brackets</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {data?.summary?.totalDebtorCustomers || 0} Debtors
            </span>
          </div>

          {/* Stacked Cohort Progress Bar */}
          <div className="h-5 w-full bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
            {data?.summary?.totalReceivables ? (
              <>
                <div
                  style={{ width: `${((data.summary.arCohorts.current_0_30 / data.summary.totalReceivables) * 100) || 0}%` }}
                  className="bg-emerald-500 hover:bg-emerald-600 transition-all"
                  title={`Current (0-30d): ${formatBDT(data.summary.arCohorts.current_0_30)}`}
                />
                <div
                  style={{ width: `${((data.summary.arCohorts.days_31_60 / data.summary.totalReceivables) * 100) || 0}%` }}
                  className="bg-amber-400 hover:bg-amber-500 transition-all"
                  title={`31-60 Days: ${formatBDT(data.summary.arCohorts.days_31_60)}`}
                />
                <div
                  style={{ width: `${((data.summary.arCohorts.days_61_90 / data.summary.totalReceivables) * 100) || 0}%` }}
                  className="bg-orange-500 hover:bg-orange-600 transition-all"
                  title={`61-90 Days: ${formatBDT(data.summary.arCohorts.days_61_90)}`}
                />
                <div
                  style={{ width: `${((data.summary.arCohorts.days_90_plus / data.summary.totalReceivables) * 100) || 0}%` }}
                  className="bg-rose-600 hover:bg-rose-700 transition-all"
                  title={`90+ Days Critical: ${formatBDT(data.summary.arCohorts.days_90_plus)}`}
                />
              </>
            ) : (
              <div className="w-full bg-slate-200 text-center text-[10px] text-slate-500 leading-5">No Receivables Data</div>
            )}
          </div>

          {/* Legend Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-medium">Current (0-30d)</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{formatBDT(data?.summary?.arCohorts?.current_0_30)}</p>
              <p className="text-[10px] text-slate-400">
                {data?.summary?.totalReceivables ? `${Math.round((data.summary.arCohorts.current_0_30 / data.summary.totalReceivables) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="font-medium">31-60 Days</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{formatBDT(data?.summary?.arCohorts?.days_31_60)}</p>
              <p className="text-[10px] text-slate-400">
                {data?.summary?.totalReceivables ? `${Math.round((data.summary.arCohorts.days_31_60 / data.summary.totalReceivables) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
                <span className="font-medium">61-90 Days</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{formatBDT(data?.summary?.arCohorts?.days_61_90)}</p>
              <p className="text-[10px] text-slate-400">
                {data?.summary?.totalReceivables ? `${Math.round((data.summary.arCohorts.days_61_90 / data.summary.totalReceivables) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-2">
              <div className="flex items-center gap-1.5 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600 shrink-0" />
                <span className="font-semibold">90+ Days Critical</span>
              </div>
              <p className="mt-1 font-bold text-rose-900">{formatBDT(data?.summary?.arCohorts?.days_90_plus)}</p>
              <p className="text-[10px] text-rose-500">
                {data?.summary?.totalReceivables ? `${Math.round((data.summary.arCohorts.days_90_plus / data.summary.totalReceivables) * 100)}%` : '0%'}
              </p>
            </div>
          </div>
        </div>

        {/* Supplier Payables Cohort Distribution Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-purple-600" />
                Supplier Payables (AP) Cohort Breakdown
              </h2>
              <p className="text-xs text-slate-500">Total BDT {formatBDT(data?.summary?.totalPayables)} across ageing brackets</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
              {data?.summary?.totalCreditorSuppliers || 0} Creditors
            </span>
          </div>

          {/* Stacked Cohort Progress Bar */}
          <div className="h-5 w-full bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
            {data?.summary?.totalPayables ? (
              <>
                <div
                  style={{ width: `${((data.summary.apCohorts.current_0_30 / data.summary.totalPayables) * 100) || 0}%` }}
                  className="bg-teal-500 hover:bg-teal-600 transition-all"
                  title={`Current (0-30d): ${formatBDT(data.summary.apCohorts.current_0_30)}`}
                />
                <div
                  style={{ width: `${((data.summary.apCohorts.days_31_60 / data.summary.totalPayables) * 100) || 0}%` }}
                  className="bg-amber-400 hover:bg-amber-500 transition-all"
                  title={`31-60 Days: ${formatBDT(data.summary.apCohorts.days_31_60)}`}
                />
                <div
                  style={{ width: `${((data.summary.apCohorts.days_61_90 / data.summary.totalPayables) * 100) || 0}%` }}
                  className="bg-orange-500 hover:bg-orange-600 transition-all"
                  title={`61-90 Days: ${formatBDT(data.summary.apCohorts.days_61_90)}`}
                />
                <div
                  style={{ width: `${((data.summary.apCohorts.days_90_plus / data.summary.totalPayables) * 100) || 0}%` }}
                  className="bg-rose-600 hover:bg-rose-700 transition-all"
                  title={`90+ Days Critical: ${formatBDT(data.summary.apCohorts.days_90_plus)}`}
                />
              </>
            ) : (
              <div className="w-full bg-slate-200 text-center text-[10px] text-slate-500 leading-5">No Payables Data</div>
            )}
          </div>

          {/* Legend Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500 shrink-0" />
                <span className="font-medium">Current (0-30d)</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{formatBDT(data?.summary?.apCohorts?.current_0_30)}</p>
              <p className="text-[10px] text-slate-400">
                {data?.summary?.totalPayables ? `${Math.round((data.summary.apCohorts.current_0_30 / data.summary.totalPayables) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="font-medium">31-60 Days</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{formatBDT(data?.summary?.apCohorts?.days_31_60)}</p>
              <p className="text-[10px] text-slate-400">
                {data?.summary?.totalPayables ? `${Math.round((data.summary.apCohorts.days_31_60 / data.summary.totalPayables) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
                <span className="font-medium">61-90 Days</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{formatBDT(data?.summary?.apCohorts?.days_61_90)}</p>
              <p className="text-[10px] text-slate-400">
                {data?.summary?.totalPayables ? `${Math.round((data.summary.apCohorts.days_61_90 / data.summary.totalPayables) * 100)}%` : '0%'}
              </p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-2">
              <div className="flex items-center gap-1.5 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600 shrink-0" />
                <span className="font-semibold">90+ Days Critical</span>
              </div>
              <p className="mt-1 font-bold text-rose-900">{formatBDT(data?.summary?.apCohorts?.days_90_plus)}</p>
              <p className="text-[10px] text-rose-500">
                {data?.summary?.totalPayables ? `${Math.round((data.summary.apCohorts.days_90_plus / data.summary.totalPayables) * 100)}%` : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('summary')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'summary'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Scale className="h-4 w-4" />
            Working Capital & Liquidity Matrix
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'customers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Customer Receivables Register (AR)
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {filteredCustomers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Supplier Payables Register (AP)
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {filteredSuppliers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('trace')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'trace'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Outstanding Invoices & Bills Trace
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {filteredInvoices.length + filteredBills.length}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: WORKING CAPITAL & LIQUIDITY MATRIX */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Side-by-Side Comparative Matrix Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70">
              <h2 className="text-sm font-semibold text-slate-900">
                Net Working Capital Cohort Comparison (AR vs AP)
              </h2>
              <p className="text-xs text-slate-500">
                Detailed comparison of receivables inflows vs payables outflows across aging horizons as of {appliedAsOf}.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">Ageing Cohort</th>
                    <th className="py-3 px-4 text-right">Customer Receivables (AR)</th>
                    <th className="py-3 px-4 text-right">Supplier Payables (AP)</th>
                    <th className="py-3 px-4 text-right">Net Liquidity Gap</th>
                    <th className="py-3 px-4 text-center">Liquidity Health</th>
                    <th className="py-3 px-4 text-left">Enterprise Strategic Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {/* Row 1: Current (0-30 Days) */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Current (0 - 30 Days)
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {formatBDT(data?.summary?.arCohorts?.current_0_30)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {formatBDT(data?.summary?.apCohorts?.current_0_30)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                      {formatBDT((data?.summary?.arCohorts?.current_0_30 || 0) - (data?.summary?.apCohorts?.current_0_30 || 0))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                        Healthy Inflow
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      Standard payment collection schedule; maintain routine supplier payment cadence.
                    </td>
                  </tr>

                  {/* Row 2: 31-60 Days */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      31 - 60 Days Overdue
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {formatBDT(data?.summary?.arCohorts?.days_31_60)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {formatBDT(data?.summary?.apCohorts?.days_31_60)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${
                      ((data?.summary?.arCohorts?.days_31_60 || 0) - (data?.summary?.apCohorts?.days_31_60 || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {formatBDT((data?.summary?.arCohorts?.days_31_60 || 0) - (data?.summary?.apCohorts?.days_31_60 || 0))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10">
                        Attention Required
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      Issue automated collection reminders to bookstores; negotiate supplier grace terms.
                    </td>
                  </tr>

                  {/* Row 3: 61-90 Days */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                      61 - 90 Days Overdue
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {formatBDT(data?.summary?.arCohorts?.days_61_90)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      {formatBDT(data?.summary?.apCohorts?.days_61_90)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${
                      ((data?.summary?.arCohorts?.days_61_90 || 0) - (data?.summary?.apCohorts?.days_61_90 || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {formatBDT((data?.summary?.arCohorts?.days_61_90 || 0) - (data?.summary?.apCohorts?.days_61_90 || 0))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10">
                        Elevated Risk
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      Place customer credit on conditional hold; prioritize printing press settlements.
                    </td>
                  </tr>

                  {/* Row 4: 90+ Days Critical */}
                  <tr className="bg-rose-50/20 hover:bg-rose-50/40">
                    <td className="py-3.5 px-4 font-bold text-rose-900 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                      90+ Days Critical Overdue
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-700">
                      {formatBDT(data?.summary?.arCohorts?.days_90_plus)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-700">
                      {formatBDT(data?.summary?.apCohorts?.days_90_plus)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${
                      ((data?.summary?.arCohorts?.days_90_plus || 0) - (data?.summary?.apCohorts?.days_90_plus || 0)) >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {formatBDT((data?.summary?.arCohorts?.days_90_plus || 0) - (data?.summary?.apCohorts?.days_90_plus || 0))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-700/20">
                        Critical Action
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-rose-800">
                      Escalate to legal/bad-debt provisioning; review supplier dispute hold notes.
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="py-4 px-4 uppercase tracking-wider text-xs">Total Working Capital</td>
                    <td className="py-4 px-4 text-right text-base text-blue-800">
                      {formatBDT(data?.summary?.totalReceivables)}
                    </td>
                    <td className="py-4 px-4 text-right text-base text-purple-800">
                      {formatBDT(data?.summary?.totalPayables)}
                    </td>
                    <td className={`py-4 px-4 text-right text-base ${
                      (data?.summary?.netWorkingCapitalGap || 0) >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {formatBDT(data?.summary?.netWorkingCapitalGap)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ${
                        (data?.summary?.netWorkingCapitalGap || 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {(data?.summary?.netWorkingCapitalGap || 0) >= 0 ? 'Net Surplus' : 'Funding Deficit'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-normal text-slate-600">
                      Total liquid asset backing exceeds short-term operating liabilities.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Strategic Insights Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
                <ShieldCheck className="h-4 w-4" />
                Credit Risk Guidelines
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Low Risk:</strong> Customer balance strictly within 30 days and below approved credit limit.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Moderate Risk:</strong> Dues aged between 31-60 days; automated statement reminders triggered.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Critical Risk:</strong> Any balance exceeding 90 days overdue or utilization surpassing 100%.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-purple-700 font-semibold text-sm">
                <Building2 className="h-4 w-4" />
                Supplier Terms Alignment
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Paper Mills:</strong> Typically enforce strict 30-day payment terms to unlock reel allocations.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Printing Presses:</strong> Stage settlements linked to job acceptance and delivered copies.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Binding Houses:</strong> Bi-weekly disbursement schedule based on finished book delivery.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <TrendingUp className="h-4 w-4" />
                Working Capital Optimization
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Target Days Sales Outstanding (DSO) below 42 days across wholesale channels.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Maintain Days Payable Outstanding (DPO) near 35-45 days to optimize cash conversion cycle.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>Accelerate distributor collections before large seasonal production print runs.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER RECEIVABLES (AR) AGEING REGISTER */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Customer Receivables Ageing Register
              </h2>
              <p className="text-xs text-slate-500">
                Itemized debtor accounts with credit limits, utilization percentages, and aged debt cohorts.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong>{filteredCustomers.length}</strong> debtor accounts
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">Customer Code & Name</th>
                    <th className="py-3 px-4 text-left">Type</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4 text-right">Current (0-30d)</th>
                    <th className="py-3 px-4 text-right">31-60 Days</th>
                    <th className="py-3 px-4 text-right">61-90 Days</th>
                    <th className="py-3 px-4 text-right">90+ Days</th>
                    <th className="py-3 px-4 text-right">Total Due</th>
                    <th className="py-3 px-4 text-center">Overdue Ratio</th>
                    <th className="py-3 px-4 text-center">Risk Level</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-sm text-slate-500">
                        No customer accounts match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            href="/crm-customers/customer-profile"
                            className="font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                          >
                            {c.name}
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </Link>
                          <div className="text-xs text-slate-500 font-mono">{c.customer_code}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">
                            {c.customer_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-medium">
                          {c.credit_limit > 0 ? (
                            <div>
                              <span>{formatBDT(c.credit_limit)}</span>
                              <div className="text-[10px] text-slate-400">
                                {c.credit_limit_utilization}% used
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Not Set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatBDT(c.current_0_30)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-amber-700">
                          {formatBDT(c.days_31_60)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-orange-700">
                          {formatBDT(c.days_61_90)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-700">
                          {formatBDT(c.days_90_plus)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatBDT(c.total_receivable)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.overdue_ratio > 50
                              ? 'bg-rose-100 text-rose-700'
                              : c.overdue_ratio > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {c.overdue_ratio}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                            c.risk_level === 'critical'
                              ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-600/20'
                              : c.risk_level === 'high'
                              ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-600/20'
                              : c.risk_level === 'moderate'
                              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-600/20'
                              : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20'
                          }`}>
                            {c.risk_level.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenCustomerDrilldown(c)}
                            className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 border border-slate-200 shadow-2xs hover:bg-indigo-50"
                          >
                            <Eye className="h-3 w-3" />
                            Invoices ({c.invoice_count})
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIER PAYABLES (AP) AGEING REGISTER */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Supplier Payables Ageing Register
              </h2>
              <p className="text-xs text-slate-500">
                Itemized creditor accounts with procurement category, payment terms, and aged liability cohorts.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong>{filteredSuppliers.length}</strong> creditor accounts
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">Supplier Code & Name</th>
                    <th className="py-3 px-4 text-left">Category</th>
                    <th className="py-3 px-4 text-center">Payment Terms</th>
                    <th className="py-3 px-4 text-right">Current (0-30d)</th>
                    <th className="py-3 px-4 text-right">31-60 Days</th>
                    <th className="py-3 px-4 text-right">61-90 Days</th>
                    <th className="py-3 px-4 text-right">90+ Days</th>
                    <th className="py-3 px-4 text-right">Total Payable</th>
                    <th className="py-3 px-4 text-center">Overdue Status</th>
                    <th className="py-3 px-4 text-center">Risk Level</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-sm text-slate-500">
                        No supplier accounts match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            href="/procurement-suppliers/supplier-directory"
                            className="font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                          >
                            {s.name}
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </Link>
                          <div className="text-xs text-slate-500 font-mono">{s.supplier_code}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 capitalize">
                            {s.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-xs font-medium text-slate-600">
                          {s.payment_terms_days || 30} Days Net
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatBDT(s.current_0_30)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-amber-700">
                          {formatBDT(s.days_31_60)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-orange-700">
                          {formatBDT(s.days_61_90)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-700">
                          {formatBDT(s.days_90_plus)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatBDT(s.total_payable)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            s.overdue_amount > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {s.overdue_amount > 0 ? `${formatBDT(s.overdue_amount)} Overdue` : 'Within Terms'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                            s.risk_level === 'critical'
                              ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-600/20'
                              : s.risk_level === 'high'
                              ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-600/20'
                              : s.risk_level === 'moderate'
                              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-600/20'
                              : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20'
                          }`}>
                            {s.risk_level.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenSupplierDrilldown(s)}
                            className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 border border-slate-200 shadow-2xs hover:bg-indigo-50"
                          >
                            <Eye className="h-3 w-3" />
                            Bills ({s.bill_count})
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OUTSTANDING INVOICES & BILLS TRACE */}
      {activeTab === 'trace' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Itemized Invoices & Bills Trace
              </h2>
              <p className="text-xs text-slate-500">
                Direct granular trace of unpaid documents with days aged, due dates, and cross-module linkages.
              </p>
            </div>

            {/* Sub-toggle between Invoices and Bills */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                onClick={() => setTraceSubTab('invoices')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  traceSubTab === 'invoices'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Customer Invoices ({filteredInvoices.length})
              </button>
              <button
                onClick={() => setTraceSubTab('bills')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  traceSubTab === 'bills'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Supplier Bills ({filteredBills.length})
              </button>
            </div>
          </div>

          {traceSubTab === 'invoices' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-left">Invoice Number</th>
                      <th className="py-3 px-4 text-left">Customer</th>
                      <th className="py-3 px-4 text-left">Invoice Date</th>
                      <th className="py-3 px-4 text-left">Due Date</th>
                      <th className="py-3 px-4 text-right">Days Aged</th>
                      <th className="py-3 px-4 text-center">Cohort</th>
                      <th className="py-3 px-4 text-right">Total Invoiced</th>
                      <th className="py-3 px-4 text-right">Outstanding Due</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-sm text-slate-500">
                          No unpaid invoices match the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                            <Link href="/sales-distribution/sales-invoice-list" className="hover:underline flex items-center gap-1">
                              {inv.invoice_number}
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{inv.customer_name}</div>
                            <div className="text-xs text-slate-500 font-mono">{inv.customer_code}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{inv.invoice_date}</td>
                          <td className="py-3 px-4 text-slate-600">{inv.due_date}</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-800">
                            {inv.days_outstanding} days
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                              inv.cohort === '90_plus'
                                ? 'bg-rose-100 text-rose-800'
                                : inv.cohort === '61_90'
                                ? 'bg-orange-100 text-orange-800'
                                : inv.cohort === '31_60'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {inv.cohort === '0_30' ? '0-30d' : inv.cohort.replace('_', '-')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatBDT(inv.total_amount)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatBDT(inv.due_amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              inv.is_overdue
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                            }`}>
                              {inv.is_overdue ? 'Overdue' : 'Current'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {traceSubTab === 'bills' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-left">Bill / PO Number</th>
                      <th className="py-3 px-4 text-left">Supplier</th>
                      <th className="py-3 px-4 text-left">Category</th>
                      <th className="py-3 px-4 text-left">Invoice Date</th>
                      <th className="py-3 px-4 text-left">Due Date</th>
                      <th className="py-3 px-4 text-right">Days Aged</th>
                      <th className="py-3 px-4 text-center">Cohort</th>
                      <th className="py-3 px-4 text-right">Base Amount</th>
                      <th className="py-3 px-4 text-right">Outstanding Payable</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredBills.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-sm text-slate-500">
                          No unpaid supplier bills match the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBills.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                            <Link href="/procurement-suppliers/supplier-bill-register" className="hover:underline flex items-center gap-1">
                              {b.bill_number}
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </Link>
                            <div className="text-xs text-slate-500 font-normal">PO: {b.po_number}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{b.supplier_name}</div>
                            <div className="text-xs text-slate-500 font-mono">{b.supplier_code}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 capitalize">
                              {b.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{b.invoice_date}</td>
                          <td className="py-3 px-4 text-slate-600">{b.due_date}</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-800">
                            {b.days_outstanding} days
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                              b.cohort === '90_plus'
                                ? 'bg-rose-100 text-rose-800'
                                : b.cohort === '61_90'
                                ? 'bg-orange-100 text-orange-800'
                                : b.cohort === '31_60'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {b.cohort === '0_30' ? '0-30d' : b.cohort.replace('_', '-')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatBDT(b.base_amount)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatBDT(b.outstanding_amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              b.is_overdue
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                            }`}>
                              {b.is_overdue ? 'Overdue' : 'Within Terms'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRILLDOWN DETAIL MODAL */}
      {drilldownEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    {drilldownEntity.type === 'customer' ? 'Customer Invoice Ledger' : 'Supplier Bill Ledger'}
                  </span>
                  <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                    {drilldownEntity.code}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {drilldownEntity.name}
                </h3>
              </div>
              <button
                onClick={() => setDrilldownEntity(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Total linked documents: <strong>{drilldownEntity.items.length}</strong></span>
                <span>Cutoff: <strong>{appliedAsOf}</strong></span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Document #</th>
                      <th className="py-2.5 px-3 text-left">Issue Date</th>
                      <th className="py-2.5 px-3 text-left">Due Date</th>
                      <th className="py-2.5 px-3 text-right">Days Aged</th>
                      <th className="py-2.5 px-3 text-center">Cohort</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {drilldownEntity.items.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">
                          {item.invoice_number || item.bill_number}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.invoice_date}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.due_date}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{item.days_outstanding}d</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            item.cohort === '90_plus'
                              ? 'bg-rose-100 text-rose-800'
                              : item.cohort === '61_90'
                              ? 'bg-orange-100 text-orange-800'
                              : item.cohort === '31_60'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.cohort === '0_30' ? '0-30d' : item.cohort.replace('_', '-')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatBDT(item.due_amount || item.outstanding_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.is_overdue
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.is_overdue ? 'Overdue' : 'Within Terms'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-end">
              <button
                onClick={() => setDrilldownEntity(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
