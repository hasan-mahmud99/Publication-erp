"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  ArrowRight,
  Building2,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  Plus,
  Layers,
  ShieldCheck,
  Scale,
  Receipt,
  BookOpen,
  Smartphone,
} from 'lucide-react';

type Month = {
  month: string;
  revenue: number;
  expense: number;
};

type Summary = {
  basis: {
    from: string;
    to: string;
    journalStatus: string;
  };
  postedJournals: number;
  draftJournals: number;
  openPeriods: number;
  revenue: number;
  expense: number;
  netIncome: number;
  trialDebit: number;
  trialCredit: number;
  trialBalanced: boolean;
  monthly: Month[];
};

type JournalEntry = {
  id: string;
  entry_number: string;
  posting_date: string;
  description: string;
  status: string;
  source_type?: string | null;
  total_debit?: string | number;
};

type TrialAccount = {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
  debit: number;
  credit: number;
};

type AccountItem = {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
};

function formatBdt(val: number | string | null | undefined): string {
  const num = Number(val || 0);
  return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  const str = String(val).slice(0, 10);
  try {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return str;
  }
}

export function FinanceDashboardScreen() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const [data, setData] = useState<Summary | null>(null);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<TrialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch summary, recent journals, and trial balance accounts
  async function loadDashboard(start: string, end: string) {
    setLoading(true);
    setError('');
    try {
      const [dashRes, journalRes, tbRes] = await Promise.all([
        api<{ data: Summary }>(`/finance/dashboard?from=${start}&to=${end}`),
        api<{ data: JournalEntry[] }>('/journal-entries?limit=8'),
        api<{ data: { accounts: TrialAccount[] } }>(`/reports/trial-balance?from=${start}&to=${end}`).catch(() => ({ data: { accounts: [] } })),
      ]);
      setData(dashRes.data);
      setRecentJournals(journalRes.data || []);
      setAccounts(tbRes.data?.accounts || []);
    } catch (cause: any) {
      setError(cause instanceof Error ? cause.message : 'Could not load finance dashboard records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(from, to);
  }, []);

  // Compute live cash, bank & MFS accounts directly from double-entry trial balance
  const cashBankAccounts = useMemo(() => {
    return accounts
      .filter(a =>
        a.account_type === 'asset' &&
        !a.account_code.startsWith('DEMO-') &&
        !a.name.startsWith('DEMO') &&
        (a.account_code.startsWith('1010') ||
         a.account_code.startsWith('1015') ||
         a.account_code.startsWith('1016') ||
         a.account_code.startsWith('1020') ||
         a.account_code.startsWith('1030') ||
         a.account_code.includes('BKASH') ||
         a.account_code.includes('NAGAD') ||
         a.name.toLowerCase().includes('cash') ||
         a.name.toLowerCase().includes('bank') ||
         a.name.toLowerCase().includes('bkash') ||
         a.name.toLowerCase().includes('nagad'))
      )
      .map(a => ({
        ...a,
        balance: Number(a.debit) - Number(a.credit),
      }));
  }, [accounts]);

  const totalCashBank = useMemo(() => {
    return cashBankAccounts.reduce((sum, a) => sum + a.balance, 0);
  }, [cashBankAccounts]);

  const totalArDue = useMemo(() => {
    const arAccounts = accounts.filter(a => a.account_code.startsWith('1040') || a.name.toLowerCase().includes('receivable'));
    return arAccounts.reduce((sum, a) => sum + (Number(a.debit) - Number(a.credit)), 0);
  }, [accounts]);

  // Quick preset handler
  function handlePreset(type: 'year' | 'quarter' | 'month') {
    const curYear = now.getFullYear();
    const todayStr = new Date().toISOString().slice(0, 10);
    if (type === 'year') {
      const start = `${curYear}-01-01`;
      setFrom(start);
      setTo(todayStr);
      void loadDashboard(start, todayStr);
    } else if (type === 'quarter') {
      const start = `${curYear}-07-01`; // Q3 academic rush
      setFrom(start);
      setTo(todayStr);
      void loadDashboard(start, todayStr);
    } else if (type === 'month') {
      const curMonth = String(now.getMonth() + 1).padStart(2, '0');
      const start = `${curYear}-${curMonth}-01`;
      setFrom(start);
      setTo(todayStr);
      void loadDashboard(start, todayStr);
    }
  }

  // Monthly Chart max calculations
  const maxMonthlyVal = useMemo(() => {
    if (!data?.monthly || data.monthly.length === 0) return 1;
    return Math.max(1, ...data.monthly.flatMap(m => [Math.abs(m.revenue), Math.abs(m.expense)]));
  }, [data?.monthly]);

  // Net Profit Margin
  const profitMarginPct = useMemo(() => {
    if (!data || data.revenue <= 0) return 0;
    return Math.round((data.netIncome / data.revenue) * 100);
  }, [data]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
              Finance & Accounting
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>
              Executive Financial Health
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Finance Dashboard
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Real-time book sales revenue, printing & paper expenses, cash runway, and double-entry trial balance.
          </p>
        </div>

        {/* TOP ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadDashboard(from, to)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            href="/finance-accounting/create-journal-voucher"
            className="btn btn-sm btn-primary"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb' }}
          >
            <Plus size={16} />
            <span>New Journal Voucher</span>
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* DATE FILTER & PRESET CONTROLS BAR */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginRight: 4 }}>Date Range:</span>
          <button
            type="button"
            onClick={() => handlePreset('year')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}
          >
            Full Year {now.getFullYear()}
          </button>
          <button
            type="button"
            onClick={() => handlePreset('quarter')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}
          >
            Academic Peak (Q3–Q4)
          </button>
          <button
            type="button"
            onClick={() => handlePreset('month')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}
          >
            This Month
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              className="input"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={{ height: 34, fontSize: 12, background: '#ffffff', color: '#0f172a' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              className="input"
              value={to}
              onChange={e => setTo(e.target.value)}
              style={{ height: 34, fontSize: 12, background: '#ffffff', color: '#0f172a' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => void loadDashboard(from, to)}
            disabled={loading || !from || !to || from > to}
            style={{ height: 34, padding: '0 14px', fontSize: 12 }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* TOP 4 EXECUTIVE FINANCIAL CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Metric 1: Revenue */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Book Sales Revenue</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {formatBdt(data?.revenue)}
          </div>
          <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            <span>Posted trade & institutional sales</span>
          </div>
        </div>

        {/* Metric 2: Operating Expenses */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Operating & Production Cost</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>
            {formatBdt(data?.expense)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Paper, printing, royalties & logistics
          </div>
        </div>

        {/* Metric 3: Net Profit */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Publishing Profit</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
            {formatBdt(data?.netIncome)}
          </div>
          <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: 700 }}>
            {profitMarginPct}% Net Operating Margin
          </div>
        </div>

        {/* Metric 4: Cash & Bank Liquidity */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Cash & Bank Balance</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>
            {formatBdt(totalCashBank)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Across {cashBankAccounts.length} active banking & cash accounts
          </div>
        </div>
      </div>

      {/* LEDGER INTEGRITY & FISCAL STATUS BANNER */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
        }}
      >
        {/* Integrity 1: Trial Balance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: data?.trialBalanced ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: data?.trialBalanced ? '#10b981' : '#dc2626' }}>
            <Scale size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Trial Balance Integrity</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: data?.trialBalanced ? '#15803d' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
              {data?.trialBalanced ? '✓ Perfect Balance' : '⚠ Out of Balance'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Dr {formatBdt(data?.trialDebit)} = Cr {formatBdt(data?.trialCredit)}
            </div>
          </div>
        </div>

        {/* Integrity 2: Posted Journals */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Posted Journals</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              {data?.postedJournals || 0} Posted Vouchers
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {data?.draftJournals || 0} drafts awaiting posting
            </div>
          </div>
        </div>

        {/* Integrity 3: Accounts Receivable Due */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Accounts Receivable (AR)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              {formatBdt(totalArDue)} Due
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              From posted trade invoices
            </div>
          </div>
        </div>

        {/* Integrity 4: Fiscal Periods */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Fiscal Periods</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              {data?.openPeriods || 0} Open Accounting Periods
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              Posting window is open
            </div>
          </div>
        </div>

        {/* Integrity 5: Quick Statements Link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <Link
            href="/finance-accounting/profit-and-loss-balance-sheet-cash-flow"
            className="btn btn-sm"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#2563eb', border: '1px solid #bfdbfe', background: '#eff6ff' }}
          >
            <span>Open P&L & Balance Sheet</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* TWO COLUMN GRID: MONTHLY TREND + BANK ACCOUNTS LIQUIDITY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 20, marginBottom: 20 }}>
        {/* LEFT: MONTHLY REVENUE VS EXPENSE TREND */}
        <div
          className="panel"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                Monthly Book Sales vs. Operating Expenses
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                Visual cashflow magnitude across academic publishing months.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: '#2563eb' }} />
                <span style={{ fontWeight: 600, color: '#475569' }}>Revenue</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: '#dc2626' }} />
                <span style={{ fontWeight: 600, color: '#475569' }}>Expense</span>
              </div>
            </div>
          </div>

          {/* Monthly Rows */}
          {data?.monthly && data.monthly.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.monthly.map(item => {
                const revWidth = Math.min(100, Math.round((Math.abs(item.revenue) / maxMonthlyVal) * 100));
                const expWidth = Math.min(100, Math.round((Math.abs(item.expense) / maxMonthlyVal) * 100));
                const monthNet = item.revenue - item.expense;

                return (
                  <div key={item.month} style={{ borderBottom: '1px solid #f8fafc', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.month}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: monthNet >= 0 ? '#15803d' : '#dc2626' }}>
                        Net: {formatBdt(monthNet)}
                      </span>
                    </div>

                    {/* Revenue Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ width: 55, fontSize: 11, color: '#64748b', fontWeight: 600 }}>Sales:</span>
                      <div style={{ flex: 1, background: '#f1f5f9', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${revWidth}%`, height: '100%', background: '#2563eb', borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 90, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#1e293b' }}>
                        {formatBdt(item.revenue)}
                      </span>
                    </div>

                    {/* Expense Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 55, fontSize: 11, color: '#64748b', fontWeight: 600 }}>Expense:</span>
                      <div style={{ flex: 1, background: '#f1f5f9', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${expWidth}%`, height: '100%', background: '#dc2626', borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 90, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#1e293b' }}>
                        {formatBdt(item.expense)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No monthly posted entries in this range.
            </div>
          )}
        </div>

        {/* RIGHT: CASH & BANK ACCOUNTS OVERVIEW */}
        <div
          className="panel"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Cash & Bank Liquidity
            </h3>
            <Link
              href="/finance-accounting/cash-and-bank-accounts"
              style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
            >
              Manage Accounts →
            </Link>
          </div>

          {/* Dynamic Real Cash & Bank Accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cashBankAccounts.length > 0 ? (
              cashBankAccounts.map(acc => {
                const isMfs = acc.account_code.includes('BKASH') || acc.account_code.includes('NAGAD');
                const isBank = acc.account_code.includes('DBBL') || acc.account_code.includes('BRAC') || acc.name.toLowerCase().includes('bank');
                const badgeText = acc.account_code.includes('BKASH')
                  ? 'bKash MFS'
                  : acc.account_code.includes('NAGAD')
                  ? 'Nagad MFS'
                  : acc.account_code.includes('1010')
                  ? 'Petty Cash'
                  : acc.account_code.includes('1020')
                  ? 'Corporate CD'
                  : acc.account_code.includes('1030')
                  ? 'Operations'
                  : 'Asset';
                const badgeBg = isMfs
                  ? '#fdf2f8'
                  : acc.account_code.includes('1010')
                  ? '#fef3c7'
                  : acc.account_code.includes('1020')
                  ? '#eff6ff'
                  : '#f5f3ff';
                const badgeColor = isMfs
                  ? '#db2777'
                  : acc.account_code.includes('1010')
                  ? '#b45309'
                  : acc.account_code.includes('1020')
                  ? '#1d4ed8'
                  : '#6d28d9';
                const Icon = isMfs ? Smartphone : isBank ? (acc.account_code.includes('1030') ? CreditCard : Building2) : Wallet;

                return (
                  <div key={acc.id} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={16} style={{ color: badgeColor }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{acc.name}</span>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: badgeBg, color: badgeColor }}>
                        {badgeText}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 6 }}>
                      A/C Code: {acc.account_code} • Inflow: {formatBdt(acc.debit)} | Outflow: {formatBdt(acc.credit)}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: acc.balance >= 0 ? '#15803d' : '#dc2626' }}>
                      {formatBdt(acc.balance)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                No active cash or bank accounts found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECENT POSTED JOURNAL VOUCHERS TABLE */}
      <div
        className="panel"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
              Recent Journal Vouchers
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Double-entry postings from sales invoices, vendor payments, and inventory adjustments.
            </p>
          </div>
          <Link
            href="/finance-accounting/journal-voucher-list"
            className="btn btn-sm"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
          >
            <span>View All Journals</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Voucher Number</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Posting Date</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Description / Transaction Source</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Amount (BDT)</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Status</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Audit</th>
              </tr>
            </thead>
            <tbody>
              {recentJournals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px 14px', textAlign: 'center', color: '#64748b' }}>
                    No journal vouchers recorded yet.
                  </td>
                </tr>
              ) : (
                recentJournals.map(j => (
                  <tr key={j.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                      <Link href={`/finance-accounting/journal-entry-detail?journal=${j.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {j.entry_number}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>
                      {formatDate(j.posting_date)}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                      {j.description}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#15803d' }}>
                      {formatBdt(j.total_debit || 0)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          background: j.status === 'posted' ? '#ecfdf5' : '#fff7ed',
                          color: j.status === 'posted' ? '#15803d' : '#c2410c',
                        }}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <Link
                        href={`/finance-accounting/journal-entry-detail?journal=${j.id}`}
                        style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK HUB: THE 8 CORE FINANCE WORKSPACES */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
          Finance & Accounting Workspaces
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Link
            href="/finance-accounting/chart-of-accounts"
            style={{ textDecoration: 'none', background: '#ffffff', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>2. Chart of Accounts</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Account heads & categories</div>
            </div>
            <ArrowRight size={14} style={{ color: '#94a3b8' }} />
          </Link>

          <Link
            href="/finance-accounting/journal-voucher-list"
            style={{ textDecoration: 'none', background: '#ffffff', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>3. Journal & General Ledger</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Double-entry postings</div>
            </div>
            <ArrowRight size={14} style={{ color: '#94a3b8' }} />
          </Link>

          <Link
            href="/finance-accounting/accounts-receivable"
            style={{ textDecoration: 'none', background: '#ffffff', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>4. Accounts Receivable (AR)</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Bookstore dues & receipts</div>
            </div>
            <ArrowRight size={14} style={{ color: '#94a3b8' }} />
          </Link>

          <Link
            href="/finance-accounting/accounts-payable"
            style={{ textDecoration: 'none', background: '#ffffff', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>5. Accounts Payable (AP)</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Printer & paper payments</div>
            </div>
            <ArrowRight size={14} style={{ color: '#94a3b8' }} />
          </Link>

          <Link
            href="/finance-accounting/cash-and-bank-accounts"
            style={{ textDecoration: 'none', background: '#ffffff', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>6. Cash & Bank Management</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Accounts & reconciliation</div>
            </div>
            <ArrowRight size={14} style={{ color: '#94a3b8' }} />
          </Link>

          <Link
            href="/finance-accounting/profit-and-loss-balance-sheet-cash-flow"
            style={{ textDecoration: 'none', background: '#ffffff', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0f172a' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>8. Financial Statements</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>P&L, Balance Sheet, Cash Flow</div>
            </div>
            <ArrowRight size={14} style={{ color: '#94a3b8' }} />
          </Link>
        </div>
      </div>
    </div>
  );
}
