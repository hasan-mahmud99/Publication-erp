'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Coins,
  BookOpen,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
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
  Scale,
  Briefcase,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

type StatementLine = {
  sourceId?: string;
  eventType?: string;
  eventDate?: string;
  title?: string;
  quantity?: number;
  basisAmount?: number;
  royaltyRate?: string;
  royaltyAmount?: number;
  currencyCode?: string;
  status?: string;
};

type PaymentVoucher = {
  journalId?: string;
  voucherRef?: string;
  postingDate?: string;
  amount?: string | number;
  currencyCode?: string;
  description?: string;
};

type StatementRow = {
  id: string;
  statement_ref: string;
  author_id: string;
  author_name: string;
  author_email?: string;
  contract_number: string;
  currency_code: string;
  period_from: string;
  period_to: string;
  gross_royalty: string;
  returns_adjustment: string;
  recouped_amount: string;
  tds_amount: string;
  net_payable: string;
  posted_paid: string;
  outstanding: string;
  settlement_status: 'settled' | 'partial' | 'outstanding';
  primary_book?: string;
  lines: StatementLine[];
  vouchers: PaymentVoucher[];
};

type AuthorSummary = {
  author_id: string;
  author_name: string;
  author_email?: string;
  contracts: string;
  statement_count: number;
  total_gross: number;
  total_recouped: number;
  total_payable: number;
  total_paid: number;
  total_outstanding: number;
};

type BookSummary = {
  book_title: string;
  author_name: string;
  total_copies_sold: number;
  total_gross_royalty: number;
  statement_refs: string;
};

type ReportData = {
  basis: {
    asOf: string;
    rules: string;
    taxCompliance: string;
  };
  summary: {
    totalGrossRoyalty: number;
    totalReturns: number;
    totalRecouped: number;
    totalTdsWithheld: number;
    totalNetPayable: number;
    totalPostedPaid: number;
    totalOutstandingLiability: number;
    statementCount: number;
    outstandingCount: number;
    settledCount: number;
    partialCount: number;
  };
  currencies: Array<{
    currency_code: string;
    statements: number;
    finalized_payable: string;
    posted_paid: string;
    outstanding: string;
  }>;
  statements: StatementRow[];
  authors: AuthorSummary[];
  books: BookSummary[];
  pagination: { total: number; limit: number; offset: number };
  formula: {
    payable: string;
    paid: string;
    outstanding: string;
    tdsCompliance: string;
  };
};

const day = (value: unknown) => String(value || '').slice(0, 10);
const money = (val: unknown) =>
  Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatBDT(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number' ? amount : Number(amount || 0);
  return 'BDT ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportRoyaltyLiabilityScreen() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [asOf, setAsOf] = useState(today);
  const [appliedAsOf, setAppliedAsOf] = useState(today);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'statements' | 'authors' | 'books' | 'basis'>('statements');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Selected statement for detailed drill-down modal
  const [selectedStatement, setSelectedStatement] = useState<StatementRow | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        asOf,
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (periodFilter !== 'all') params.set('period', periodFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await api<{ data: ReportData }>(`/reports/royalty-liability?${params}`);
      setData(res.data);
      setAppliedAsOf(asOf);
    } catch (cause: any) {
      setError(cause?.message || 'Could not load royalty liability report');
    } finally {
      setLoading(false);
    }
  }, [asOf, statusFilter, periodFilter, search, page]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleApplyFilter = () => {
    setPage(1);
    void loadReport();
  };

  const handleReset = () => {
    setAsOf(today);
    setStatusFilter('all');
    setPeriodFilter('all');
    setSearch('');
    setPage(1);
  };

  const exportCSV = () => {
    if (!data?.statements?.length) return;

    const headers = [
      'Statement Ref',
      'Author',
      'Author Email',
      'Contract',
      'Period From',
      'Period To',
      'Primary Book',
      'Gross Royalty (BDT)',
      'Returns Adjustment (BDT)',
      'Advance Recouped (BDT)',
      'TDS Withheld (BDT)',
      'Net Payable (BDT)',
      'Posted Paid (BDT)',
      'Outstanding Liability (BDT)',
      'Settlement Status',
    ];

    const rows = data.statements.map((s) => [
      `"${s.statement_ref}"`,
      `"${s.author_name}"`,
      `"${s.author_email || ''}"`,
      `"${s.contract_number}"`,
      s.period_from,
      s.period_to,
      `"${s.primary_book || ''}"`,
      s.gross_royalty,
      s.returns_adjustment,
      s.recouped_amount,
      s.tds_amount,
      s.net_payable,
      s.posted_paid,
      s.outstanding,
      s.settlement_status.toUpperCase(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Royalty_Liability_Report_${appliedAsOf}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const s = data?.summary;

  return (
    <div className="space-y-6 pb-12 print:p-0">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Statutory Financial Obligations
            </span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-700/10">
              Audited Cutoff
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Royalty Liability Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit finalized author royalty obligations, advance recoupments, statutory TDS withholdings (Section 86), and effective outstanding liabilities.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => void loadReport()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={!data?.statements?.length || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={!data?.statements?.length || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Printer className="h-4 w-4 text-white" />
            Print Report
          </button>
          <Link
            href="/authors-contracts-rights/royalty-statement-and-payment-history"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Coins className="h-4 w-4 text-white" />
            Statements History
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </Link>
        </div>
      </div>

      {/* Inter-Module Quick Navigation Hub */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-200 print:hidden">
        <span className="font-semibold text-slate-700 px-2 flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5 text-slate-500" />
          Related Workspaces:
        </span>
        <Link
          href="/authors-contracts-rights/author-directory"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-emerald-700 border border-slate-200 shadow-xs hover:bg-emerald-50"
        >
          <Users className="h-3 w-3" />
          Author Directory
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/authors-contracts-rights/contract-list"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-indigo-700 border border-slate-200 shadow-xs hover:bg-indigo-50"
        >
          <FileText className="h-3 w-3" />
          Author Contracts & Terms
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/authors-contracts-rights/advance-payment-register"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-purple-700 border border-slate-200 shadow-xs hover:bg-purple-50"
        >
          <Coins className="h-3 w-3" />
          Advance Payment Register
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/authors-contracts-rights/royalty-calculation-preview"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-blue-700 border border-slate-200 shadow-xs hover:bg-blue-50"
        >
          <TrendingUp className="h-3 w-3" />
          Royalty Calculation Engine
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/finance-accounting/journal-voucher-list"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-amber-700 border border-slate-200 shadow-xs hover:bg-amber-50"
        >
          <Building2 className="h-3 w-3" />
          Finance GL Vouchers
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
        <Link
          href="/publishing-catalog/book-catalog-list"
          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-medium text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-100"
        >
          <BookOpen className="h-3 w-3" />
          Book Catalog
          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
        </Link>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Error loading royalty liability report</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => void loadReport()}
            className="text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Interactive Slicing & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs print:hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Search Author, Contract, Title
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Author, contract, statement #, book title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Settlement Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Settlement Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Settlement Statuses</option>
              <option value="outstanding">Outstanding / Unpaid Only</option>
              <option value="partial">Partially Settled Only</option>
              <option value="settled">Fully Settled Only</option>
            </select>
          </div>

          {/* Accounting Period */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Accounting Period
            </label>
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Accounting Periods</option>
              <option value="2026-h1">2026-H1 (Jan - Jun 2026)</option>
              <option value="2025-h2">2025-H2 (Jul - Dec 2025)</option>
              <option value="2025-h1">2025-H1 (Jan - Jun 2025)</option>
            </select>
          </div>

          {/* Cutoff Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Cutoff Date (As Of)
            </label>
            <div className="relative">
              <input
                type="date"
                value={asOf}
                onChange={(e) => {
                  setAsOf(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Filter Badges and Action Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-600">Active Criteria:</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
              Cutoff: <strong className="text-slate-900">{appliedAsOf}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
              Status: <strong className="text-slate-900 capitalize">{statusFilter}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
              Period: <strong className="text-slate-900">{periodFilter === 'all' ? 'All Periods' : periodFilter.toUpperCase()}</strong>
            </span>
            {search && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-800 ring-1 ring-emerald-600/20">
                Search: "{search}"
              </span>
            )}
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* 5 Executive KPI Metric Cards (Responsive Grid) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* KPI 1: Outstanding Royalty Liability */}
        <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Outstanding Liability
            </span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-rose-700">
              {formatBDT(s?.totalOutstandingLiability || 0)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across <strong className="text-rose-700">{s?.outstandingCount || 0} unpaid</strong> &amp; {s?.partialCount || 0} partial statements
          </div>
        </div>

        {/* KPI 2: Gross Royalty Accrued */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Gross Royalty Accrued
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatBDT(s?.totalGrossRoyalty || 0)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total contractual earnings on copies sold
          </div>
        </div>

        {/* KPI 3: Advances Recouped */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Advances Recouped
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-purple-700">
              {formatBDT(s?.totalRecouped || 0)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Offset against author advance payments (Account 1320)
          </div>
        </div>

        {/* KPI 4: Statutory TDS Withheld */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Statutory TDS (10%)
            </span>
            <div className="rounded-lg bg-cyan-50 p-2 text-cyan-600">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatBDT(s?.totalTdsWithheld || 0)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            NBR Income Tax Act 2023 Sec 86/87
          </div>
        </div>

        {/* KPI 5: Net Royalty Paid to Date */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Net Paid to Date
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-emerald-800">
              {formatBDT(s?.totalPostedPaid || 0)}
            </span>
          </div>
          <div className="mt-1 text-xs text-emerald-700 font-medium">
            Settled via posted Finance GL vouchers ({s?.settledCount || 0} settled)
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('statements')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'statements'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Finalized Statements
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {data?.pagination?.total || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('authors')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'authors'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Author Liability Summary
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {data?.authors?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'books'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Title Accruals
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {data?.books?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('basis')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'basis'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Statutory Compliance &amp; Basis
          </button>
        </nav>
      </div>

      {/* TAB 1: Finalized Statements Register */}
      {activeTab === 'statements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Finalized Royalty Statements
              </h2>
              <p className="text-xs text-slate-500">
                Cutoff: {appliedAsOf}. Only legally finalized statements and posted Finance GL vouchers are recognized.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong>{data?.statements?.length || 0}</strong> of <strong>{data?.pagination?.total || 0}</strong> statements
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Statement Ref</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap min-w-[180px]">Author / Recipient</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Contract</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Accounting Period</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap min-w-[200px]">Primary Book Title</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Gross Royalty</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Advance Offset</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Net Payable</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Posted Paid</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Outstanding</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-sm text-slate-500">
                        Loading audited royalty statements...
                      </td>
                    </tr>
                  ) : !data?.statements?.length ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-sm text-slate-500">
                        No finalized royalty statements match these filter criteria.
                      </td>
                    </tr>
                  ) : (
                    data.statements.map((row) => {
                      const isSettled = row.settlement_status === 'settled';
                      const isPartial = row.settlement_status === 'partial';
                      const isOut = row.settlement_status === 'outstanding';

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {row.statement_ref}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Link
                              href="/authors-contracts-rights/author-profile"
                              className="font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                            >
                              {row.author_name}
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </Link>
                            {row.author_email && (
                              <div className="text-xs text-slate-400 font-normal">{row.author_email}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Link
                              href="/authors-contracts-rights/contract-list"
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-700 hover:bg-slate-200"
                            >
                              {row.contract_number}
                              <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                            </Link>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                            {day(row.period_from)} <span className="text-slate-400">→</span> {day(row.period_to)}
                          </td>
                          <td className="py-3 px-4 min-w-[200px]">
                            <Link
                              href="/publishing-catalog/book-catalog-list"
                              className="text-slate-800 hover:text-indigo-600 font-medium truncate block max-w-xs"
                              title={row.primary_book || 'Multi-Title Catalog'}
                            >
                              {row.primary_book || 'Multi-Title Catalog'}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                            {formatBDT(row.gross_royalty)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-purple-700 whitespace-nowrap">
                            {Number(row.recouped_amount) > 0 ? `- ${formatBDT(row.recouped_amount)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatBDT(row.net_payable)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-700 whitespace-nowrap">
                            {Number(row.posted_paid) > 0 ? formatBDT(row.posted_paid) : 'BDT 0.00'}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                            Number(row.outstanding) > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}>
                            {formatBDT(row.outstanding)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                                isSettled
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20'
                                  : isPartial
                                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-600/20'
                                  : 'bg-rose-100 text-rose-800 ring-1 ring-rose-600/20'
                              }`}
                            >
                              {isSettled ? 'SETTLED' : isPartial ? 'PARTIAL' : 'OUTSTANDING'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedStatement(row)}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 border border-slate-200 shadow-2xs hover:bg-emerald-50"
                            >
                              <Eye className="h-3 w-3" />
                              Breakdown
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
              <span className="text-xs text-slate-600">
                Page <strong>{page}</strong> of {Math.max(1, Math.ceil((data?.pagination?.total || 0) / pageSize))} · Total {data?.pagination?.total || 0} statements
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={!data?.pagination || page * pageSize >= data.pagination.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Author Liability Summary */}
      {activeTab === 'authors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Author-wise Liability Aggregation
              </h2>
              <p className="text-xs text-slate-500">
                Consolidated obligations across all contracts and periods for each author.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong>{data?.authors?.length || 0}</strong> authors
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left whitespace-nowrap min-w-[200px]">Author / Contributor</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Active Contracts</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Statements</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Total Gross Accrued</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Advances Recouped</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Total Net Payable</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Total Paid to Date</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Outstanding Liability</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {!data?.authors?.length ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-sm text-slate-500">
                        No author liability records found.
                      </td>
                    </tr>
                  ) : (
                    data.authors.map((a) => {
                      const hasOutstanding = a.total_outstanding > 0;
                      return (
                        <tr key={a.author_id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Link
                              href="/authors-contracts-rights/author-profile"
                              className="font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                            >
                              {a.author_name}
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </Link>
                            {a.author_email && (
                              <div className="text-xs text-slate-400 font-normal">{a.author_email}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Link
                              href="/authors-contracts-rights/contract-list"
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-700 hover:bg-slate-200"
                            >
                              {a.contracts}
                              <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-800 whitespace-nowrap">
                            {a.statement_count}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                            {formatBDT(a.total_gross)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-purple-700 whitespace-nowrap">
                            {a.total_recouped > 0 ? `- ${formatBDT(a.total_recouped)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatBDT(a.total_payable)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-700 whitespace-nowrap">
                            {a.total_paid > 0 ? formatBDT(a.total_paid) : 'BDT 0.00'}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                            hasOutstanding ? 'text-rose-700' : 'text-emerald-700'
                          }`}>
                            {formatBDT(a.total_outstanding)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                                !hasOutstanding
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/20'
                                  : a.total_paid > 0
                                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-600/20'
                                  : 'bg-rose-100 text-rose-800 ring-1 ring-rose-600/20'
                              }`}
                            >
                              {!hasOutstanding ? 'FULLY CLEARED' : a.total_paid > 0 ? 'PARTIAL BALANCE' : 'FULL BALANCE DUE'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Title & Edition Accruals */}
      {activeTab === 'books' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Title &amp; Edition Royalty Generation
              </h2>
              <p className="text-xs text-slate-500">
                Publications ranked by gross author royalties accrued through commercial sales and channel distributions.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong>{data?.books?.length || 0}</strong> titles
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left whitespace-nowrap min-w-[240px]">Publication Title</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Author / Rights Holder</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Copies Sold (Net)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Gross Royalty Generated</th>
                    <th className="py-3 px-4 text-left whitespace-nowrap">Statement Traces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {!data?.books?.length ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                        No book royalty accruals recorded.
                      </td>
                    </tr>
                  ) : (
                    data.books.map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          <Link
                            href="/publishing-catalog/book-catalog-list"
                            className="text-slate-900 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            {b.book_title}
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          <Link
                            href="/authors-contracts-rights/author-profile"
                            className="hover:underline text-emerald-700 font-medium"
                          >
                            {b.author_name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-800 whitespace-nowrap">
                          {b.total_copies_sold.toLocaleString()} copies
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700 whitespace-nowrap">
                          {formatBDT(b.total_gross_royalty)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            {b.statement_refs}
                          </span>
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

      {/* TAB 4: Statutory Compliance & Calculation Basis */}
      {activeTab === 'basis' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Statutory Bangladesh Tax Compliance &amp; Accounting Basis
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  NBR Tax Deduction at Source (TDS / AIT)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Under <strong>Section 86 and 87 of the Bangladesh Income Tax Act 2023</strong> (and NBR Income Tax Rules), the publisher is legally mandated to deduct <strong>10% Tax Deduction at Source (TDS)</strong> on gross royalty fees before disbursement to resident authors (unless a lower-rate exemption certificate from the Commissioner of Taxes is on file). Deducted tax must be deposited via Treasury Challan to NBR within two weeks.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-purple-600" />
                  Advance Payment Recoupment Accounting
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Signing advances paid to authors are debited to <strong>Account 1320 (Author Advance Asset)</strong>. At period cutoff, cumulative sales royalties are credited to earn revenue while offsetting against Account 1320 until the advance is fully recouped. Only net surplus earnings above the advance balance become payable under <strong>Account 2120 (Author Royalty Payable)</strong>.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-emerald-50/50 p-5 border border-emerald-200">
              <h4 className="text-sm font-bold text-emerald-800 mb-2">
                Formal General Ledger (GL) Formulae
              </h4>
              <ul className="space-y-1.5 text-xs text-emerald-900 list-disc pl-5">
                <li>
                  <strong>Finalized Net Payable:</strong> {data?.formula?.payable || 'Gross Royalty less sales return adjustments and advance recoupments.'}
                </li>
                <li>
                  <strong>Posted Paid:</strong> {data?.formula?.paid || 'Linked posted Finance vouchers through cutoff, excluding reversals.'}
                </li>
                <li>
                  <strong>Effective Outstanding Liability:</strong> {data?.formula?.outstanding || 'Finalized payable less qualifying posted vouchers.'}
                </li>
                <li>
                  <strong>Statutory Tax Basis:</strong> {data?.formula?.tdsCompliance || 'NBR Income Tax Act 2023, Section 86.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detailed Statement Breakdown Drawer */}
      {selectedStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Royalty Statement Ledger
                  </span>
                  <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                    {selectedStatement.statement_ref}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                      selectedStatement.settlement_status === 'settled'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedStatement.settlement_status === 'partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedStatement.settlement_status.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Author: {selectedStatement.author_name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Contract: <code className="font-mono text-slate-700">{selectedStatement.contract_number}</code> · Period: {day(selectedStatement.period_from)} to {day(selectedStatement.period_to)}
                </div>
              </div>
              <button
                onClick={() => setSelectedStatement(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Financial 4-Card Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Gross Royalty</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {formatBDT(selectedStatement.gross_royalty)}
                  </div>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase">Advance Offset</div>
                  <div className="text-base font-bold text-purple-800 mt-1">
                    - {formatBDT(selectedStatement.recouped_amount)}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Posted Paid (GL)</div>
                  <div className="text-base font-bold text-emerald-800 mt-1">
                    {formatBDT(selectedStatement.posted_paid)}
                  </div>
                </div>
                <div className={`rounded-xl border p-3 ${
                  Number(selectedStatement.outstanding) > 0
                    ? 'border-rose-200 bg-rose-50/50 text-rose-800'
                    : 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                }`}>
                  <div className="text-[11px] font-semibold uppercase">Outstanding Balance</div>
                  <div className="text-base font-bold mt-1">
                    {formatBDT(selectedStatement.outstanding)}
                  </div>
                </div>
              </div>

              {/* Statement Lines Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Line-by-Line Sales &amp; Accrual Trace
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Publication Title</th>
                        <th className="py-2.5 px-3 text-center">Event Type</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Basis Amount</th>
                        <th className="py-2.5 px-3 text-center">Royalty Rate</th>
                        <th className="py-2.5 px-3 text-right">Accrued Royalty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {selectedStatement.lines.length ? (
                        selectedStatement.lines.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {l.title || 'Book Edition'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                                  l.eventType === 'sales_return'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {l.eventType === 'sales_return' ? 'RETURN' : 'SALE'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium">{l.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{formatBDT(l.basisAmount)}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-xs">{l.royaltyRate || '12.0%'}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              Number(l.royaltyAmount) < 0 ? 'text-rose-700' : 'text-slate-900'
                            }`}>
                              {formatBDT(l.royaltyAmount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                            Consolidated statement without individual transaction splits.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Payment Vouchers (GL History) */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Finance General Ledger Payment Vouchers</span>
                  <Link
                    href="/finance-accounting/journal-voucher-list"
                    className="text-indigo-600 hover:text-indigo-800 normal-case flex items-center gap-1 font-medium"
                  >
                    View All GL Vouchers
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                {selectedStatement.vouchers.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Voucher Number</th>
                          <th className="py-2.5 px-3 text-left">Posting Date</th>
                          <th className="py-2.5 px-3 text-left">Description</th>
                          <th className="py-2.5 px-3 text-right">Disbursed Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {selectedStatement.vouchers.map((v, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">
                              <Link href="/finance-accounting/journal-voucher-list" className="hover:underline">
                                {v.voucherRef || 'JV-ROY-POSTED'}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{v.postingDate || 'Audited'}</td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{v.description || 'Royalty payout'}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              {formatBDT(v.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-rose-600 font-medium bg-rose-50/30">
                    No payment vouchers posted yet. Full net payable of {formatBDT(selectedStatement.net_payable)} remains outstanding.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setSelectedStatement(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
