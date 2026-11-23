"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Layers,
  Search,
  Plus,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  CheckCircle2,
  AlertCircle,
  Building2,
  CreditCard,
  Smartphone,
  BookOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  ExternalLink,
} from 'lucide-react';

type Account = {
  id: string;
  account_code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id?: string | null;
  is_active: number | boolean;
  debit?: number;
  credit?: number;
  net_balance?: number;
};

function formatBdt(val: number | string | null | undefined): string {
  const num = Number(val || 0);
  return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ChartOfAccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('all');
  const [showModal, setShowModal] = useState(false);

  // New account form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('asset');
  const [newParentId, setNewParentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  async function loadAccounts() {
    setLoading(true);
    setError('');
    try {
      const [chartRes, tbRes] = await Promise.all([
        api<{ data: Account[] }>('/accounts/chart'),
        api<{ data: { accounts: Array<{ id: string; debit: number; credit: number }> } }>('/reports/trial-balance').catch(() => ({ data: { accounts: [] } })),
      ]);

      const tbMap = new Map<string, { debit: number; credit: number }>();
      (tbRes.data?.accounts || []).forEach(a => {
        tbMap.set(a.id, { debit: Number(a.debit) || 0, credit: Number(a.credit) || 0 });
      });

      const merged = (chartRes.data || []).map(a => {
        const tb = tbMap.get(a.id) || { debit: 0, credit: 0 };
        const debit = tb.debit;
        const credit = tb.credit;
        // In standard accounting: Assets and Expenses have debit normal balance (debit - credit)
        // Liabilities, Equity, and Revenue have credit normal balance (credit - debit)
        const isDebitNormal = a.account_type === 'asset' || a.account_type === 'expense';
        const net_balance = isDebitNormal ? (debit - credit) : (credit - debit);

        return {
          ...a,
          debit,
          credit,
          net_balance,
        };
      });

      setAccounts(merged);
    } catch (cause: any) {
      setError(cause instanceof Error ? cause.message : 'Could not load chart of accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setFormError('Please enter both account code and account name');
      return;
    }
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    try {
      await api('/accounts/chart', {
        method: 'POST',
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          type: newType,
          parentId: newParentId || null,
        }),
      });
      setFormSuccess(`Account [${newCode.trim().toUpperCase()}] created successfully!`);
      setNewCode('');
      setNewName('');
      setTimeout(() => {
        setShowModal(false);
        setFormSuccess('');
      }, 1200);
      await loadAccounts();
    } catch (err: any) {
      setFormError(err instanceof Error ? err.message : 'Failed to create account head');
    } finally {
      setSubmitting(false);
    }
  }

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      // Hide legacy deactivated DEMO and ACC-FIN- test accounts unless specifically searched
      const isLegacyDemo = !a.is_active || a.account_code.startsWith('ACC-FIN-') || a.account_code.startsWith('DEMO-');
      if (isLegacyDemo && !search.trim()) return false;

      if (typeFilter !== 'all' && a.account_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return a.account_code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [accounts, typeFilter, search]);

  // Totals for top KPI cards
  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let expenses = 0;

    accounts.forEach(a => {
      if (!a.is_active || a.account_code.startsWith('ACC-FIN-') || a.account_code.startsWith('DEMO-')) return;
      if (a.account_type === 'asset') assets += (a.net_balance || 0);
      else if (a.account_type === 'liability') liabilities += (a.net_balance || 0);
      else if (a.account_type === 'equity') equity += (a.net_balance || 0);
      else if (a.account_type === 'revenue') revenue += (a.net_balance || 0);
      else if (a.account_type === 'expense') expenses += (a.net_balance || 0);
    });

    return { assets, liabilities, equity, revenue, expenses };
  }, [accounts]);

  // Group accounts by major account categories
  const categories = useMemo(() => {
    const assetList = filteredAccounts.filter(a => a.account_type === 'asset');
    const liabilityList = filteredAccounts.filter(a => a.account_type === 'liability');
    const equityList = filteredAccounts.filter(a => a.account_type === 'equity');
    const revenueList = filteredAccounts.filter(a => a.account_type === 'revenue');
    const expenseList = filteredAccounts.filter(a => a.account_type === 'expense');

    return [
      {
        key: 'asset',
        title: '1000 — Assets (Cash, Bank, MFS, AR & Inventory)',
        badge: 'Debit Normal Balance',
        badgeColor: '#2563eb',
        badgeBg: '#eff6ff',
        items: assetList,
      },
      {
        key: 'liability',
        title: '2000 — Liabilities (Accounts Payable, Royalties & VAT)',
        badge: 'Credit Normal Balance',
        badgeColor: '#dc2626',
        badgeBg: '#fef2f2',
        items: liabilityList,
      },
      {
        key: 'equity',
        title: '3000 — Equity (Owner Capital & Retained Earnings)',
        badge: 'Credit Normal Balance',
        badgeColor: '#7c3aed',
        badgeBg: '#f5f3ff',
        items: equityList,
      },
      {
        key: 'revenue',
        title: '4000 — Revenue (Trade, Tender, Online & Fair Sales)',
        badge: 'Credit Normal Balance',
        badgeColor: '#16a34a',
        badgeBg: '#ecfdf5',
        items: revenueList,
      },
      {
        key: 'expense',
        title: '5000 / 6000 — Operating & Production Expenses',
        badge: 'Debit Normal Balance',
        badgeColor: '#d97706',
        badgeBg: '#fffbeb',
        items: expenseList,
      },
    ].filter(cat => cat.items.length > 0);
  }, [filteredAccounts]);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'asset':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Asset' };
      case 'liability':
        return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Liability' };
      case 'equity':
        return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', label: 'Equity' };
      case 'revenue':
        return { bg: '#ecfdf5', color: '#15803d', border: '#a7f3d0', label: 'Revenue' };
      case 'expense':
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'Expense' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: type };
    }
  };

  const getAccountIcon = (code: string, type: string) => {
    if (code.includes('BKASH') || code.includes('NAGAD')) return <Smartphone size={15} style={{ color: '#db2777' }} />;
    if (code.includes('DBBL') || code.includes('BRAC') || code.includes('BANK')) return <Building2 size={15} style={{ color: '#2563eb' }} />;
    if (code.includes('CASH')) return <Wallet size={15} style={{ color: '#16a34a' }} />;
    if (type === 'revenue') return <TrendingUp size={15} style={{ color: '#16a34a' }} />;
    if (type === 'expense') return <TrendingDown size={15} style={{ color: '#dc2626' }} />;
    if (type === 'liability') return <CreditCard size={15} style={{ color: '#dc2626' }} />;
    return <Layers size={15} style={{ color: '#64748b' }} />;
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
              Finance & Accounting • Workspace 2
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>
              General Ledger Setup
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Chart of Accounts (COA)
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0, maxWidth: 700 }}>
            Standard publishing account structure, mobile financial services (bKash/Nagad), bank accounts, and live ledger balances.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadAccounts()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 12.5 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', fontSize: 12.5, fontWeight: 700 }}
          >
            <Plus size={15} />
            <span>+ New Account Head</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#991b1b', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TOP 5 CATEGORY KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Assets */}
        <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Assets</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8' }}>1000s</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>
            {formatBdt(totals.assets)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Cash, Bank, bKash, Nagad & AR
          </div>
        </div>

        {/* Liabilities */}
        <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Liabilities</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: '#dc2626' }}>2000s</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>
            {formatBdt(totals.liabilities)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Printers, Royalties & VAT Payable
          </div>
        </div>

        {/* Equity */}
        <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Equity & Capital</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#f5f3ff', color: '#7c3aed' }}>3000s</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>
            {formatBdt(totals.equity)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Owner Capital & Retained
          </div>
        </div>

        {/* Revenue */}
        <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Book Sales Revenue</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#ecfdf5', color: '#16a34a' }}>4000s</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>
            {formatBdt(totals.revenue)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Trade, Tender, Online & Fair
          </div>
        </div>

        {/* Expenses */}
        <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Production & Overhead</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#fffbeb', color: '#d97706' }}>5000/6000s</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>
            {formatBdt(totals.expenses)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Print, Paper, Binding & Rent
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div
        className="panel"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Accounts' },
            { id: 'asset', label: '1000 Assets' },
            { id: 'liability', label: '2000 Liabilities' },
            { id: 'equity', label: '3000 Equity' },
            { id: 'revenue', label: '4000 Revenue' },
            { id: 'expense', label: '5000/6000 Expenses' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id as any)}
              style={{
                border: 'none',
                background: typeFilter === tab.id ? '#0f172a' : '#f1f5f9',
                color: typeFilter === tab.id ? '#ffffff' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input"
            placeholder="Search code or account name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 34, fontSize: 12, paddingLeft: 30, background: '#f8fafc' }}
          />
        </div>
      </div>

      {/* GROUPED CHART OF ACCOUNTS TABLE */}
      {loading ? (
        <div className="panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: 13, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', color: '#2563eb' }} />
          <span>Loading Chart of Accounts & live balances...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: 13, background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
          <Layers size={32} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
          <p style={{ fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>No matching accounts found</p>
          <p style={{ margin: 0, fontSize: 12 }}>Try adjusting your search query or category filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {categories.map(cat => (
            <div
              key={cat.key}
              className="panel"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                overflow: 'hidden',
              }}
            >
              {/* Category Header */}
              <div
                style={{
                  padding: '14px 18px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{cat.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>({cat.items.length} accounts)</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: cat.badgeBg,
                    color: cat.badgeColor,
                  }}
                >
                  {cat.badge}
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '10px 18px', textAlign: 'left', width: 140 }}>Account Code</th>
                      <th style={{ padding: '10px 18px', textAlign: 'left' }}>Account Name & Sub-Ledger</th>
                      <th style={{ padding: '10px 18px', textAlign: 'left', width: 110 }}>Class</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', width: 130 }}>Total Inflow (Dr)</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', width: 130 }}>Total Outflow (Cr)</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', width: 150 }}>Net Balance</th>
                      <th style={{ padding: '10px 18px', textAlign: 'center', width: 90 }}>Status</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', width: 120 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map(acc => {
                      const typeStyle = getTypeStyle(acc.account_type);
                      const isSpecial = acc.account_code.includes('BKASH') || acc.account_code.includes('NAGAD') || acc.account_code.includes('DBBL') || acc.account_code.includes('BRAC');

                      return (
                        <tr
                          key={acc.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSpecial ? '#fafafa' : '#ffffff',
                            transition: 'background 0.1s ease',
                          }}
                        >
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                fontSize: 12,
                                color: '#0f172a',
                                background: '#f1f5f9',
                                padding: '3px 7px',
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              {acc.account_code}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {getAccountIcon(acc.account_code, acc.account_type)}
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{acc.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 5,
                                background: typeStyle.bg,
                                color: typeStyle.color,
                                border: `1px solid ${typeStyle.border}`,
                                textTransform: 'capitalize',
                              }}
                            >
                              {typeStyle.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                            {formatBdt(acc.debit)}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                            {formatBdt(acc.credit)}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                color: (acc.net_balance || 0) > 0 ? '#15803d' : (acc.net_balance || 0) < 0 ? '#dc2626' : '#64748b',
                              }}
                            >
                              {formatBdt(acc.net_balance)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: acc.is_active ? '#ecfdf5' : '#f1f5f9',
                                color: acc.is_active ? '#15803d' : '#94a3b8',
                              }}
                            >
                              {acc.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <Link
                              href={`/finance-accounting/journal-voucher-list?account=${encodeURIComponent(acc.account_code)}`}
                              className="btn btn-xs"
                              style={{
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#2563eb',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 6,
                                padding: '3px 8px',
                              }}
                            >
                              <span>Ledger</span>
                              <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE NEW ACCOUNT HEAD MODAL */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                  + Add New General Ledger Account
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Define an official account head in the Chart of Accounts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAccount} style={{ padding: 20 }}>
              {formError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 16, color: '#991b1b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 12px', marginBottom: 16, color: '#15803d', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={15} />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Account Code *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 1017-UPAY or 5060-PACK"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    required
                    style={{ height: 38, fontSize: 12.5 }}
                  />
                  <span style={{ fontSize: 10.5, color: '#64748b', marginTop: 3, display: 'block' }}>
                    1000s Asset, 2000s Liab, 4000s Rev, 5000s COGS
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Account Class *
                  </label>
                  <select
                    className="input"
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    style={{ height: 38, fontSize: 12.5 }}
                  >
                    <option value="asset">Asset (Cash, Bank, MFS, AR, Stock)</option>
                    <option value="liability">Liability (AP, Royalties, VAT)</option>
                    <option value="equity">Equity (Capital, Retained)</option>
                    <option value="revenue">Revenue (Book Sales, Tender)</option>
                    <option value="expense">Expense (Printing, Paper, Rent)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Account Title / Ledger Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Upay Merchant A/C or Shrink Wrap Packaging Cost"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  style={{ height: 38, fontSize: 12.5 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Parent Account Group (Optional)
                </label>
                <select
                  className="input"
                  value={newParentId}
                  onChange={e => setNewParentId(e.target.value)}
                  style={{ height: 38, fontSize: 12.5 }}
                >
                  <option value="">None (Top-Level Head)</option>
                  {accounts
                    .filter(a => a.is_active && !a.parent_id)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.account_code}] {a.name} ({a.account_type})
                      </option>
                    ))}
                </select>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{ height: 36, padding: '0 16px', fontSize: 12.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={submitting || !newCode.trim() || !newName.trim()}
                  style={{ height: 36, padding: '0 20px', fontSize: 12.5, fontWeight: 700 }}
                >
                  {submitting ? 'Creating...' : 'Save Account Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
