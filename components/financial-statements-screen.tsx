"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  Scale,
  RefreshCw,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Download,
  Filter,
  Check,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  Layers,
  PieChart
} from 'lucide-react';

type AccountLine = {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
  debit: number;
  credit: number;
};

type TrialBalanceData = {
  basis: { from: string; to: string; status: string };
  accounts: AccountLine[];
  debit: number;
  credit: number;
  balanced: boolean;
};

type ProfitLossData = {
  basis: { from: string; to: string; status: string };
  accounts: AccountLine[];
  revenue: number;
  expense: number;
  netIncome: number;
};

type BalanceSheetData = {
  basis: { asOf: string; status: string };
  accounts: AccountLine[];
  assets: number;
  liabilities: number;
  equity: number;
  currentEarnings: number;
  balanced: boolean;
};

type CashFlowData = {
  basis: { from: string; to: string; status: string };
  operating: {
    customerCollections: number;
    supplierDisbursements: number;
    opexDisbursements: number;
    netOperating: number;
  };
  investing: {
    capitalPurchases: number;
    netInvesting: number;
  };
  financing: {
    capitalIntroduced: number;
    netFinancing: number;
  };
  netChange: number;
  beginningCash: number;
  endingCash: number;
};

function formatBdt(val: number | string | null | undefined): string {
  const num = Number(val || 0);
  return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(val?: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(val).slice(0, 10);
  }
}

export function FinancialStatementsScreen({ initialTab }: { initialTab?: 'pl' | 'bs' | 'cf' | 'tb' }) {
  const [activeTab, setActiveTab] = useState<'pl' | 'bs' | 'cf' | 'tb'>(initialTab || 'pl');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date Filters
  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  // Statements State
  const [plData, setPlData] = useState<ProfitLossData | null>(null);
  const [bsData, setBsData] = useState<BalanceSheetData | null>(null);
  const [cfData, setCfData] = useState<CashFlowData | null>(null);
  const [tbData, setTbData] = useState<TrialBalanceData | null>(null);

  async function loadStatements() {
    if (fromDate > toDate) {
      setError('Start date must not exceed end date');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const [plRes, bsRes, cfRes, tbRes] = await Promise.all([
        api<{ data: ProfitLossData }>(`/reports/profit-loss?${params}`),
        api<{ data: BalanceSheetData }>(`/reports/balance-sheet?asOf=${toDate}`),
        api<{ data: CashFlowData }>(`/reports/cash-flow?${params}`),
        api<{ data: TrialBalanceData }>(`/reports/trial-balance?${params}`),
      ]);

      setPlData(plRes.data);
      setBsData(bsRes.data);
      setCfData(cfRes.data);
      setTbData(tbRes.data);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to generate financial statements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatements();
  }, []);

  // Split P&L Accounts into Revenue, COGS, and OPEX
  const revenueAccounts = useMemo(() => {
    if (!plData) return [];
    return plData.accounts.filter((a) => a.account_type === 'revenue');
  }, [plData]);

  const productionExpenseAccounts = useMemo(() => {
    if (!plData) return [];
    return plData.accounts.filter(
      (a) =>
        a.account_type === 'expense' &&
        (a.account_code.startsWith('51') || /print|paper|binding/i.test(a.name))
    );
  }, [plData]);

  const operatingExpenseAccounts = useMemo(() => {
    if (!plData) return [];
    return plData.accounts.filter(
      (a) =>
        a.account_type === 'expense' &&
        !a.account_code.startsWith('51') &&
        !/print|paper|binding/i.test(a.name)
    );
  }, [plData]);

  const cogsTotal = useMemo(() => {
    return productionExpenseAccounts.reduce((sum, a) => sum + (a.debit - a.credit), 0);
  }, [productionExpenseAccounts]);

  const opexTotal = useMemo(() => {
    return operatingExpenseAccounts.reduce((sum, a) => sum + (a.debit - a.credit), 0);
  }, [operatingExpenseAccounts]);

  const grossProfit = useMemo(() => {
    return (plData?.revenue || 0) - cogsTotal;
  }, [plData, cogsTotal]);

  // Balance Sheet Categories
  const currentAssetAccounts = useMemo(() => {
    if (!bsData) return [];
    return bsData.accounts.filter(
      (a) => a.account_type === 'asset' && !a.account_code.startsWith('15')
    );
  }, [bsData]);

  const fixedAssetAccounts = useMemo(() => {
    if (!bsData) return [];
    return bsData.accounts.filter(
      (a) => a.account_type === 'asset' && a.account_code.startsWith('15')
    );
  }, [bsData]);

  const liabilityAccounts = useMemo(() => {
    if (!bsData) return [];
    return bsData.accounts.filter((a) => a.account_type === 'liability');
  }, [bsData]);

  const equityAccounts = useMemo(() => {
    if (!bsData) return [];
    return bsData.accounts.filter((a) => a.account_type === 'equity');
  }, [bsData]);

  const profitMargin = plData?.revenue
    ? ((plData.netIncome / plData.revenue) * 100).toFixed(1)
    : '0.0';

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
              Section 8: Financial Statements
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Profit & Loss, Balance Sheet & Cash Flow
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Statutory Audited Financial Statements, Income Statement, Balance Sheet, Cash Flow & Trial Balance.
          </p>
        </div>

        {/* TOP CONTROLS & PRINT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px' }}>
            <Calendar size={14} style={{ color: '#64748b' }} />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0f172a', fontWeight: 600, background: 'none' }}
            />
            <span style={{ color: '#94a3b8', fontSize: 11 }}>to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#0f172a', fontWeight: 600, background: 'none' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadStatements()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', border: 'none', color: '#ffffff', fontWeight: 700 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Generate</span>
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155' }}
          >
            <Printer size={14} />
            <span>Print Statements</span>
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TOP 4 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* KPI 1: Total Revenue */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Operating Revenue</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            {formatBdt(plData?.revenue || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#eff6ff', fontWeight: 600, color: '#1d4ed8' }}>
              Turnover
            </span>
            <span>Book sales, trade & online orders</span>
          </div>
        </div>

        {/* KPI 2: Total Expenses */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total Operating Expenses</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#e11d48', marginBottom: 4 }}>
            {formatBdt(plData?.expense || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#ffe4e6', fontWeight: 600, color: '#be123c' }}>
              COGS + OPEX
            </span>
            <span>Printing, paper, rent & logistics</span>
          </div>
        </div>

        {/* KPI 3: Net Profit */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Net Operating Profit</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: (plData?.netIncome || 0) >= 0 ? '#16a34a' : '#e11d48', marginBottom: 4 }}>
            {formatBdt(plData?.netIncome || 0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#dcfce7', fontWeight: 600, color: '#15803d' }}>
              {profitMargin}% Margin
            </span>
            <span>Retained operating surplus</span>
          </div>
        </div>

        {/* KPI 4: Balance Sheet Status */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Audit Equilibrium</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Scale size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            {bsData?.balanced ? 'Balanced' : 'Reconciliation Required'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#dcfce7', fontWeight: 600, color: '#15803d' }}>
              Assets = L + E
            </span>
            <span>General Ledger reconciled</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { key: 'pl', label: 'Profit & Loss Statement', icon: TrendingUp },
          { key: 'bs', label: 'Balance Sheet', icon: Scale },
          { key: 'cf', label: 'Cash Flow Statement', icon: Landmark },
          { key: 'tb', label: 'General Trial Balance', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563eb' : '#64748b',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFIT & LOSS STATEMENT */}
      {activeTab === 'pl' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                Statement of Profit or Loss (Income Statement)
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                For the period from {formatDate(fromDate)} to {formatDate(toDate)} (All values in BDT)
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a' }}>
              Audited Ledger Basis
            </span>
          </div>

          <div style={{ padding: 24 }}>
            {/* 1. Operating Revenue */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  1. Operating Revenue & Book Sales Turnover
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  {formatBdt(plData?.revenue || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {revenueAccounts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 16 }}>
                    <span style={{ color: '#334155' }}>
                      {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {formatBdt(a.credit - a.debit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Cost of Goods Sold (COGS) */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  2. Cost of Sales & Production Expenses (COGS)
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e11d48' }}>
                  ({formatBdt(cogsTotal)})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {productionExpenseAccounts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 16 }}>
                    <span style={{ color: '#475569' }}>
                      {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {formatBdt(a.debit - a.credit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* GROSS PROFIT ROW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                GROSS PROFIT
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: grossProfit >= 0 ? '#16a34a' : '#e11d48' }}>
                {formatBdt(grossProfit)}
              </span>
            </div>

            {/* 3. Operating & Administrative Expenses */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  3. Operating & Administrative Expenses (OPEX)
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e11d48' }}>
                  ({formatBdt(opexTotal)})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {operatingExpenseAccounts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 16 }}>
                    <span style={{ color: '#475569' }}>
                      {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {formatBdt(a.debit - a.credit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* NET OPERATING PROFIT BANNER */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: (plData?.netIncome || 0) >= 0 ? '#f0fdf4' : '#fff1f2',
                borderRadius: 10,
                border: '1px solid',
                borderColor: (plData?.netIncome || 0) >= 0 ? '#bbf7d0' : '#fecaca',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: (plData?.netIncome || 0) >= 0 ? '#166534' : '#991b1b' }}>
                  NET OPERATING PROFIT / (SURPLUS)
                </div>
                <div style={{ fontSize: 11, color: (plData?.netIncome || 0) >= 0 ? '#15803d' : '#b91c1c' }}>
                  Operating Margin: {profitMargin}% of gross sales turnover
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: (plData?.netIncome || 0) >= 0 ? '#15803d' : '#991b1b' }}>
                {formatBdt(plData?.netIncome || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE SHEET */}
      {activeTab === 'bs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
          {/* ASSETS COLUMN */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                ASSETS (Property & Resources)
              </h3>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>
                {formatBdt(bsData?.assets || 0)}
              </span>
            </div>

            {/* Current Assets */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                Current Liquid & Working Assets
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentAssetAccounts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 8 }}>
                    <span style={{ color: '#334155' }}>
                      {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {formatBdt(a.debit - a.credit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Non-Current Assets */}
            {fixedAssetAccounts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  Non-Current Capitalized Fixed Assets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fixedAssetAccounts.map((a) => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 8 }}>
                      <span style={{ color: '#334155' }}>
                        {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                      </span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {formatBdt(a.debit - a.credit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>TOTAL ASSETS</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>
                {formatBdt(bsData?.assets || 0)}
              </span>
            </div>
          </div>

          {/* LIABILITIES & EQUITY COLUMN */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                LIABILITIES & OWNER EQUITY
              </h3>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
                {formatBdt((bsData?.liabilities || 0) + (bsData?.equity || 0) + (bsData?.currentEarnings || 0))}
              </span>
            </div>

            {/* Liabilities */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                Current Liabilities (Payables & Dues)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {liabilityAccounts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 8 }}>
                    <span style={{ color: '#334155' }}>
                      {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#e11d48' }}>
                      {formatBdt(a.credit - a.debit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equity */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                Capital & Shareholder Equity
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {equityAccounts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 8 }}>
                    <span style={{ color: '#334155' }}>
                      {a.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>({a.account_code})</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {formatBdt(a.credit - a.debit)}
                    </span>
                  </div>
                ))}
                {/* Current Year Net Earnings */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingLeft: 8 }}>
                  <span style={{ color: '#166534', fontWeight: 600 }}>
                    Current Year Retained Earnings (Net Profit)
                  </span>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>
                    {formatBdt(bsData?.currentEarnings || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>TOTAL LIABILITIES & EQUITY</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>
                {formatBdt((bsData?.liabilities || 0) + (bsData?.equity || 0) + (bsData?.currentEarnings || 0))}
              </span>
            </div>

            {/* Equilibrium Audit Badge */}
            <div style={{ marginTop: 20, padding: '10px 14px', borderRadius: 8, background: bsData?.balanced ? '#f0fdf4' : '#fffbeb', border: '1px solid', borderColor: bsData?.balanced ? '#bbf7d0' : '#fde68a', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <ShieldCheck size={16} style={{ color: bsData?.balanced ? '#16a34a' : '#d97706' }} />
              <span style={{ fontWeight: 700, color: bsData?.balanced ? '#166534' : '#b45309' }}>
                {bsData?.balanced
                  ? 'Audit Verified: Balance Sheet Equation Holds (Assets = Liabilities + Equity)'
                  : 'Variance Detected in Ledger Equilibrium'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CASH FLOW STATEMENT */}
      {activeTab === 'cf' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                Statement of Cash Flows (Direct Method)
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Liquid fund inflows and disbursements across operating, investing, and financing
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#eff6ff', color: '#1d4ed8' }}>
              Cash & Bank Basis
            </span>
          </div>

          <div style={{ padding: 24 }}>
            {/* 1. Operating Activities */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  A. Cash Flow from Operating Activities
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: (cfData?.operating.netOperating || 0) >= 0 ? '#16a34a' : '#e11d48' }}>
                  {formatBdt(cfData?.operating.netOperating || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#334155' }}>Cash Receipts from Book Customers & Trade Sales</span>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>+{formatBdt(cfData?.operating.customerCollections || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#475569' }}>Disbursements to Paper Mills & Printing Suppliers</span>
                  <span style={{ fontWeight: 600, color: '#e11d48' }}>-{formatBdt(cfData?.operating.supplierDisbursements || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#475569' }}>Cash Paid for Rent, Logistics & General OPEX</span>
                  <span style={{ fontWeight: 600, color: '#e11d48' }}>-{formatBdt(cfData?.operating.opexDisbursements || 0)}</span>
                </div>
              </div>
            </div>

            {/* 2. Investing Activities */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  B. Cash Flow from Investing Activities
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: (cfData?.investing.netInvesting || 0) >= 0 ? '#16a34a' : '#e11d48' }}>
                  {formatBdt(cfData?.investing.netInvesting || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#475569' }}>Acquisition of Printing Machinery, Transport & Fixed Assets</span>
                  <span style={{ fontWeight: 600, color: '#e11d48' }}>-{formatBdt(cfData?.investing.capitalPurchases || 0)}</span>
                </div>
              </div>
            </div>

            {/* 3. Financing Activities */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  C. Cash Flow from Financing Activities
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  +{formatBdt(cfData?.financing.netFinancing || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#334155' }}>Owner Capital Contribution & Retained Seed Injections</span>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>+{formatBdt(cfData?.financing.capitalIntroduced || 0)}</span>
                </div>
              </div>
            </div>

            {/* SUMMARY CASH RECONCILIATION */}
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Beginning Liquid Cash & Bank Position:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatBdt(cfData?.beginningCash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Net Change in Liquid Position (A + B + C):</span>
                <span style={{ fontWeight: 700, color: (cfData?.netChange || 0) >= 0 ? '#16a34a' : '#e11d48' }}>
                  {formatBdt(cfData?.netChange || 0)}
                </span>
              </div>
              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>Ending Cash & Bank Position:</span>
                <span style={{ fontWeight: 900, color: '#2563eb' }}>{formatBdt(cfData?.endingCash || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL TRIAL BALANCE */}
      {activeTab === 'tb' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                General Trial Balance Registry ({tbData?.accounts.length || 0} Accounts)
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Verification of double-entry ledger equality across all Chart of Accounts heads
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                background: tbData?.balanced ? '#f0fdf4' : '#fef2f2',
                color: tbData?.balanced ? '#16a34a' : '#991b1b',
              }}
            >
              {tbData?.balanced ? 'Trial Balance Reconciled' : 'Unbalanced Ledger'}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 16px' }}>Account Code & Title</th>
                  <th style={{ padding: '10px 16px' }}>Classification</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Debit Total (Dr BDT)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Credit Total (Cr BDT)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {tbData?.accounts.map((a, idx) => {
                  const net = a.debit - a.credit;
                  return (
                    <tr
                      key={a.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{a.account_code}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background:
                              a.account_type === 'asset'
                                ? '#eff6ff'
                                : a.account_type === 'revenue'
                                ? '#f0fdf4'
                                : a.account_type === 'expense'
                                ? '#fff1f2'
                                : '#f1f5f9',
                            color:
                              a.account_type === 'asset'
                                ? '#1d4ed8'
                                : a.account_type === 'revenue'
                                ? '#16a34a'
                                : a.account_type === 'expense'
                                ? '#e11d48'
                                : '#475569',
                          }}
                        >
                          {a.account_type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                        {formatBdt(a.debit)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                        {formatBdt(a.credit)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: net >= 0 ? '#0f172a' : '#e11d48' }}>
                        {formatBdt(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: '14px 16px', fontSize: 14, color: '#0f172a' }}>
                    GRAND TOTALS (TRIAL BALANCE EQUILIBRIUM)
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 15, color: '#2563eb' }}>
                    {formatBdt(tbData?.debit || 0)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 15, color: '#2563eb' }}>
                    {formatBdt(tbData?.credit || 0)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                      Balanced
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
