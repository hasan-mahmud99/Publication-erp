"use client";

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Building2,
  Wallet,
  Smartphone,
  CreditCard,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  DollarSign,
  ArrowUpDown,
  Check,
  Calendar,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  FileCheck,
  FileText,
  BadgeAlert,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Landmark
} from 'lucide-react';

type CashBankKpis = {
  totalLiquidFunds: number;
  corporateBankBalance: number;
  mfsWalletBalance: number;
  cashInHand: number;
  activeAccountsCount: number;
  unreconciledCount: number;
};

type AccountItem = {
  id: string;
  code: string;
  name: string;
  type: 'bank' | 'mfs' | 'cash' | 'cod';
  currency: string;
  accountNumber: string;
  branch: string;
  routingNo: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  statementBalance: number;
  lastReconciledDate: string;
  status: 'active' | 'inactive';
};

type TransactionItem = {
  id: string;
  journalId: string;
  entryNumber: string;
  postingDate: string;
  description: string;
  sourceType: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  postedAt: string;
};

type ContraTransferItem = {
  journalId: string;
  entryNumber: string;
  postingDate: string;
  description: string;
  amount: number;
  toAccount: string;
  fromAccount: string;
  status: string;
  postedAt: string;
};

type CounterpartAccount = {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
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

export function CashBankScreen({ initialTab }: { initialTab?: 'portfolio' | 'transactions' | 'reconciliation' | 'transfers' }) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'transactions' | 'reconciliation' | 'transfers'>(initialTab || 'portfolio');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Main Data States
  const [kpis, setKpis] = useState<CashBankKpis>({
    totalLiquidFunds: 0,
    corporateBankBalance: 0,
    mfsWalletBalance: 0,
    cashInHand: 0,
    activeAccountsCount: 0,
    unreconciledCount: 0,
  });

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>([]);
  const [contraTransfers, setContraTransfers] = useState<ContraTransferItem[]>([]);
  const [counterparts, setCounterparts] = useState<CounterpartAccount[]>([]);

  // Filter States
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'bank' | 'mfs' | 'cash' | 'cod'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxAccount, setSelectedTxAccount] = useState<string>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'inflow' | 'outflow'>('all');

  // Modal: Contra Transfer
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferRef, setTransferRef] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferError, setTransferError] = useState('');

  // Modal: Direct Voucher
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherType, setVoucherType] = useState<'payment' | 'receipt'>('payment');
  const [voucherBankId, setVoucherBankId] = useState('');
  const [voucherCounterId, setVoucherCounterId] = useState('');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [voucherParty, setVoucherParty] = useState('');
  const [voucherRef, setVoucherRef] = useState('');
  const [voucherNarration, setVoucherNarration] = useState('');
  const [voucherError, setVoucherError] = useState('');

  // Modal: Bank Reconciliation
  const [showReconModal, setShowReconModal] = useState(false);
  const [reconAccount, setReconAccount] = useState<AccountItem | null>(null);
  const [reconDate, setReconDate] = useState(new Date().toISOString().slice(0, 10));
  const [reconBalance, setReconBalance] = useState('');
  const [reconNotes, setReconNotes] = useState('');
  const [reconError, setReconError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{
        data: {
          kpis: CashBankKpis;
          accounts: AccountItem[];
          recentTransactions: TransactionItem[];
          contraTransfers: ContraTransferItem[];
          counterpartAccounts: CounterpartAccount[];
        };
      }>('/finance/cash-bank-accounts');

      setKpis(res.data.kpis);
      setAccounts(res.data.accounts);
      setRecentTransactions(res.data.recentTransactions);
      setContraTransfers(res.data.contraTransfers);
      setCounterparts(res.data.counterpartAccounts);

      if (res.data.accounts.length >= 2) {
        if (!transferFrom) setTransferFrom(res.data.accounts[0].id);
        if (!transferTo) setTransferTo(res.data.accounts[1].id);
      }
      if (res.data.accounts.length > 0 && !voucherBankId) {
        setVoucherBankId(res.data.accounts[0].id);
      }
      if (res.data.counterpartAccounts?.length > 0 && !voucherCounterId) {
        setVoucherCounterId(res.data.counterpartAccounts[0].id);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load cash and bank accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (accountTypeFilter !== 'all' && a.type !== accountTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.name.toLowerCase().includes(q);
        const matchCode = a.code.toLowerCase().includes(q);
        const matchAccNo = a.accountNumber.toLowerCase().includes(q);
        const matchBranch = a.branch.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchAccNo && !matchBranch) return false;
      }
      return true;
    });
  }, [accounts, accountTypeFilter, searchQuery]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      if (selectedTxAccount !== 'all' && tx.accountId !== selectedTxAccount) return false;
      if (txTypeFilter === 'inflow' && tx.debit <= 0) return false;
      if (txTypeFilter === 'outflow' && tx.credit <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchJv = tx.entryNumber.toLowerCase().includes(q);
        const matchAcc = tx.accountName.toLowerCase().includes(q);
        if (!matchDesc && !matchJv && !matchAcc) return false;
      }
      return true;
    });
  }, [recentTransactions, selectedTxAccount, txTypeFilter, searchQuery]);

  // Handle Contra Transfer Submission
  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTransferError('');
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      setTransferError('Please enter a valid transfer amount greater than 0');
      return;
    }
    if (transferFrom === transferTo) {
      setTransferError('Source and destination accounts must be different');
      return;
    }

    setBusy(true);
    try {
      const res = await api<{
        data: {
          journalNumber: string;
          amount: number;
          fromAccount: string;
          toAccount: string;
          postingDate: string;
        };
      }>('/finance/cash-bank-accounts/transfer', {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId: transferFrom,
          toAccountId: transferTo,
          amount: amt,
          transferDate,
          referenceNo: transferRef.trim() || undefined,
          description: transferDesc.trim() || undefined,
        }),
      });

      setShowTransferModal(false);
      setTransferAmount('');
      setTransferRef('');
      setTransferDesc('');
      setNotice(
        `Contra Transfer recorded! Posted Journal Voucher: ${res.data.journalNumber}. Moved ${formatBdt(amt)} from ${res.data.fromAccount} to ${res.data.toAccount}.`
      );
      await loadData();
    } catch (err: any) {
      setTransferError(err instanceof Error ? err.message : 'Failed to execute transfer');
    } finally {
      setBusy(false);
    }
  }

  // Handle Direct Voucher Submission
  async function submitDirectVoucher(e: React.FormEvent) {
    e.preventDefault();
    setVoucherError('');
    const amt = parseFloat(voucherAmount);
    if (!amt || amt <= 0) {
      setVoucherError('Please enter a valid amount');
      return;
    }
    if (!voucherBankId || !voucherCounterId) {
      setVoucherError('Please select both the Cash/Bank and Counterpart accounts');
      return;
    }

    setBusy(true);
    try {
      const res = await api<{
        data: {
          voucherNumber: string;
          journalNumber: string;
          voucherType: string;
          amount: number;
          bankAccount: string;
          counterAccount: string;
        };
      }>('/finance/cash-bank-accounts/direct-voucher', {
        method: 'POST',
        body: JSON.stringify({
          voucherType,
          bankAccountId: voucherBankId,
          counterAccountId: voucherCounterId,
          amount: amt,
          voucherDate,
          partyName: voucherParty.trim() || undefined,
          referenceNo: voucherRef.trim() || undefined,
          narration: voucherNarration.trim() || undefined,
        }),
      });

      setShowVoucherModal(false);
      setVoucherAmount('');
      setVoucherParty('');
      setVoucherRef('');
      setVoucherNarration('');
      setNotice(
        `${voucherType === 'receipt' ? 'Direct Receipt' : 'Payment Voucher'} ${res.data.voucherNumber} created! Journal ${res.data.journalNumber} posted (${formatBdt(amt)}).`
      );
      await loadData();
    } catch (err: any) {
      setVoucherError(err instanceof Error ? err.message : 'Failed to record direct voucher');
    } finally {
      setBusy(false);
    }
  }

  // Handle Bank Reconciliation
  async function submitReconciliation(e: React.FormEvent) {
    e.preventDefault();
    if (!reconAccount) return;
    setReconError('');
    const stmtBal = parseFloat(reconBalance);
    if (isNaN(stmtBal)) {
      setReconError('Please enter a valid statement balance');
      return;
    }

    setBusy(true);
    try {
      await api('/finance/cash-bank-accounts/reconcile', {
        method: 'POST',
        body: JSON.stringify({
          accountId: reconAccount.id,
          statementDate: reconDate,
          statementBalance: stmtBal,
          notes: reconNotes.trim() || undefined,
        }),
      });

      setShowReconModal(false);
      setNotice(`Bank Reconciliation checkpoint recorded for ${reconAccount.name} as of ${formatDate(reconDate)}.`);
      await loadData();
    } catch (err: any) {
      setReconError(err instanceof Error ? err.message : 'Failed to save reconciliation');
    } finally {
      setBusy(false);
    }
  }

  const selectedFromAccountObj = accounts.find((a) => a.id === transferFrom);
  const selectedToAccountObj = accounts.find((a) => a.id === transferTo);
  const selectedVoucherBankObj = accounts.find((a) => a.id === voucherBankId);
  const selectedVoucherCounterObj = counterparts.find((c) => c.id === voucherCounterId);

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
              Section 6: Cash & Bank Accounts
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Cash & Bank Accounts Management
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Corporate Bank Accounts, MFS Merchant Wallets, Petty Cash, Contra Fund Transfers & Bank Reconciliation.
          </p>
        </div>

        {/* TOP ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadData()}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowVoucherModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
          >
            <FileText size={14} />
            <span>Direct Inflow / Outflow</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setShowTransferModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
          >
            <ArrowRightLeft size={14} />
            <span>Contra Fund Transfer</span>
          </button>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {notice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* TOP 4 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* KPI 1: Total Liquid Funds */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total Liquid Funds</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Landmark size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            {formatBdt(kpis.totalLiquidFunds)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', fontWeight: 600, color: '#334155' }}>
              {kpis.activeAccountsCount} Accounts
            </span>
            <span>All banks, MFS & cash desk</span>
          </div>
        </div>

        {/* KPI 2: Corporate Bank Accounts */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Corporate Bank Balances</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginBottom: 4 }}>
            {formatBdt(kpis.corporateBankBalance)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#dcfce7', fontWeight: 600, color: '#15803d' }}>
              DBBL & BRAC
            </span>
            <span>Operating & settlement accounts</span>
          </div>
        </div>

        {/* KPI 3: MFS Merchant Wallets */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>MFS Merchant Wallets</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
              <Smartphone size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#db2777', marginBottom: 4 }}>
            {formatBdt(kpis.mfsWalletBalance)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#fce7f3', fontWeight: 600, color: '#be185d' }}>
              bKash + Nagad
            </span>
            <span>E-Commerce PGW settlement</span>
          </div>
        </div>

        {/* KPI 4: Cash in Hand & Safe */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Cash in Hand & Petty Cash</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginBottom: 4 }}>
            {formatBdt(kpis.cashInHand)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#fef3c7', fontWeight: 600, color: '#b45309' }}>
              Head Office Safe
            </span>
            <span>Banglabazar counter & petty</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { key: 'portfolio', label: 'Accounts Portfolio', icon: Landmark, count: accounts.length },
          { key: 'transactions', label: 'Cash & Bank Ledger Register', icon: FileText, count: recentTransactions.length },
          { key: 'reconciliation', label: 'Bank Reconciliation', icon: ShieldCheck, count: accounts.filter((a) => a.type === 'bank').length },
          { key: 'transfers', label: 'Contra Fund Transfers', icon: ArrowRightLeft, count: contraTransfers.length },
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
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: isActive ? '#eff6ff' : '#f1f5f9',
                  color: isActive ? '#2563eb' : '#64748b',
                  fontWeight: 600,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACCOUNTS PORTFOLIO */}
      {activeTab === 'portfolio' && (
        <div>
          {/* Filtering Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(['all', 'bank', 'mfs', 'cash', 'cod'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccountTypeFilter(t)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: accountTypeFilter === t ? '#2563eb' : '#e2e8f0',
                    background: accountTypeFilter === t ? '#eff6ff' : '#ffffff',
                    color: accountTypeFilter === t ? '#1d4ed8' : '#64748b',
                  }}
                >
                  {t === 'all'
                    ? 'All Portfolios'
                    : t === 'bank'
                    ? 'Corporate Banks'
                    : t === 'mfs'
                    ? 'MFS Wallets'
                    : t === 'cash'
                    ? 'Cash in Hand'
                    : 'Courier COD'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 260 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search account name, code, A/C #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    outline: 'none',
                    background: '#ffffff',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cards Showcase for Top Accounts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
            {filteredAccounts.slice(0, 4).map((acc) => {
              const isBank = acc.type === 'bank';
              const isMfs = acc.type === 'mfs';
              const isCash = acc.type === 'cash';

              return (
                <div
                  key={acc.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    padding: 18,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                            {acc.code}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: isBank ? '#eff6ff' : isMfs ? '#fdf2f8' : isCash ? '#fef3c7' : '#f1f5f9',
                              color: isBank ? '#1d4ed8' : isMfs ? '#db2777' : isCash ? '#b45309' : '#475569',
                            }}
                          >
                            {acc.type.toUpperCase()}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          {acc.name}
                        </h3>
                      </div>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: isBank ? '#eff6ff' : isMfs ? '#fdf2f8' : '#fef3c7',
                          color: isBank ? '#2563eb' : isMfs ? '#db2777' : '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isBank ? <Building2 size={16} /> : isMfs ? <Smartphone size={16} /> : <Wallet size={16} />}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Account Number:</span>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{acc.accountNumber}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Branch / Desk:</span>
                        <span style={{ color: '#475569' }}>{acc.branch}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Routing No:</span>
                        <span style={{ color: '#475569' }}>{acc.routingNo}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Current GL Balance:</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: acc.balance >= 0 ? '#0f172a' : '#e11d48' }}>
                        {formatBdt(acc.balance)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferFrom(acc.id);
                          setShowTransferModal(true);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <ArrowRightLeft size={13} />
                        <span>Transfer</span>
                      </button>

                      {isBank && (
                        <button
                          type="button"
                          onClick={() => {
                            setReconAccount(acc);
                            setReconBalance(String(acc.balance));
                            setShowReconModal(true);
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <ShieldCheck size={13} />
                          <span>Reconcile</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Table of All Accounts */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                All Cash, Bank & Wallet Ledgers ({filteredAccounts.length})
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                All balances reflect verified double-entry General Ledger postings
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '10px 16px' }}>Account Code & Name</th>
                    <th style={{ padding: '10px 16px' }}>Type</th>
                    <th style={{ padding: '10px 16px' }}>Account Number</th>
                    <th style={{ padding: '10px 16px' }}>Branch / Routing</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total Debits (Dr)</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total Credits (Cr)</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Net GL Balance</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                        No accounts match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc, idx) => (
                      <tr
                        key={acc.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{acc.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{acc.code}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background:
                                acc.type === 'bank'
                                  ? '#eff6ff'
                                  : acc.type === 'mfs'
                                  ? '#fdf2f8'
                                  : acc.type === 'cash'
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                              color:
                                acc.type === 'bank'
                                  ? '#1d4ed8'
                                  : acc.type === 'mfs'
                                  ? '#db2777'
                                  : acc.type === 'cash'
                                  ? '#b45309'
                                  : '#475569',
                            }}
                          >
                            {acc.type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>
                          {acc.accountNumber}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>
                          <div>{acc.branch}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Routing: {acc.routingNo}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                          {formatBdt(acc.totalDebit)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e11d48', fontWeight: 600 }}>
                          {formatBdt(acc.totalCredit)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                          {formatBdt(acc.balance)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a' }}>
                            Active
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferFrom(acc.id);
                                setShowTransferModal(true);
                              }}
                              title="Contra Transfer"
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                color: '#334155',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Transfer
                            </button>
                            {acc.type === 'bank' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReconAccount(acc);
                                  setReconBalance(String(acc.balance));
                                  setShowReconModal(true);
                                }}
                                title="Reconcile with Statement"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                Reconcile
                              </button>
                            )}
                          </div>
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

      {/* TAB 2: CASH & BANK TRANSACTIONS REGISTER */}
      {activeTab === 'transactions' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Account:</span>
                <select
                  value={selectedTxAccount}
                  onChange={(e) => setSelectedTxAccount(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="all">All Cash & Bank Accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Flow:</span>
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="all">All (Inflows & Outflows)</option>
                  <option value="inflow">Inflow Only (Debits)</option>
                  <option value="outflow">Outflow Only (Credits)</option>
                </select>
              </div>
            </div>

            <div style={{ position: 'relative', width: 280 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search description, voucher #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 12,
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 16px' }}>Date</th>
                  <th style={{ padding: '10px 16px' }}>Voucher / JV #</th>
                  <th style={{ padding: '10px 16px' }}>Account</th>
                  <th style={{ padding: '10px 16px' }}>Narration / Description</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Inflow (Dr)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Outflow (Cr)</th>
                  <th style={{ padding: '10px 16px' }}>Source / Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      No transactions recorded for the selected account filter.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {formatDate(tx.postingDate)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          {tx.entryNumber}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{tx.accountName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{tx.accountCode}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', maxWidth: 360 }}>
                        {tx.description}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {tx.debit > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ArrowDownLeft size={13} />
                            +{formatBdt(tx.debit)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>
                        {tx.credit > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ArrowUpRight size={13} />
                            -{formatBdt(tx.credit)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background:
                              tx.sourceType === 'contra_transfer'
                                ? '#eff6ff'
                                : tx.sourceType === 'supplier_payment'
                                ? '#fef2f2'
                                : tx.sourceType === 'customer_payment'
                                ? '#f0fdf4'
                                : '#f1f5f9',
                            color:
                              tx.sourceType === 'contra_transfer'
                                ? '#1d4ed8'
                                : tx.sourceType === 'supplier_payment'
                                ? '#991b1b'
                                : tx.sourceType === 'customer_payment'
                                ? '#166534'
                                : '#475569',
                          }}
                        >
                          {tx.sourceType ? tx.sourceType.replace('_', ' ').toUpperCase() : 'JOURNAL'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a' }}>
                          Posted
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

      {/* TAB 3: BANK RECONCILIATION WORKSPACE */}
      {activeTab === 'reconciliation' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {accounts
              .filter((a) => a.type === 'bank')
              .map((bankAcc) => {
                const bookBalance = bankAcc.balance;
                const statementBalance = bankAcc.statementBalance;
                const diff = bookBalance - statementBalance;
                const isReconciled = Math.abs(diff) < 0.01;

                return (
                  <div
                    key={bankAcc.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8' }}>
                            {bankAcc.code}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>Corporate Bank</span>
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {bankAcc.name}
                        </h3>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: isReconciled ? '#f0fdf4' : '#fffbeb',
                          color: isReconciled ? '#166534' : '#b45309',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {isReconciled ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        <span>{isReconciled ? 'Reconciled' : 'Variance Detected'}</span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>General Ledger Book Balance:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{formatBdt(bookBalance)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Bank Statement Balance:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{formatBdt(statementBalance)}</span>
                      </div>
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Reconciliation Variance:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: isReconciled ? '#16a34a' : '#e11d48' }}>
                          {formatBdt(diff)}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>A/C Number:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>{bankAcc.accountNumber}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Branch:</span>
                        <span style={{ color: '#475569' }}>{bankAcc.branch}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Last Verified Date:</span>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>{formatDate(bankAcc.lastReconciledDate)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReconAccount(bankAcc);
                        setReconBalance(String(bankAcc.balance));
                        setShowReconModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <ShieldCheck size={14} />
                      <span>Perform Bank Reconciliation</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: CONTRA FUND TRANSFERS REGISTER */}
      {activeTab === 'transfers' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Contra Fund Transfers Register ({contraTransfers.length})
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Internal liquidity sweeps, bank withdrawals, and MFS pool transfers.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowTransferModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#ffffff', fontSize: 12 }}
            >
              <Plus size={14} />
              <span>Record Contra Transfer</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 16px' }}>Voucher #</th>
                  <th style={{ padding: '10px 16px' }}>Date</th>
                  <th style={{ padding: '10px 16px' }}>From Account (Credit)</th>
                  <th style={{ padding: '10px 16px' }}>To Account (Debit)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Transfer Amount</th>
                  <th style={{ padding: '10px 16px' }}>Narration & References</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {contraTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      No contra fund transfers found in the current fiscal period.
                    </td>
                  </tr>
                ) : (
                  contraTransfers.map((c, idx) => (
                    <tr
                      key={c.journalId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          {c.entryNumber}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        {formatDate(c.postingDate)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e11d48' }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>{c.fromAccount}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>{c.toAccount}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                        {formatBdt(c.amount)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', maxWidth: 360 }}>
                        {c.description}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a' }}>
                          Posted
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

      {/* MODAL A: NEW CONTRA FUND TRANSFER */}
      {showTransferModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              maxWidth: 580,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Internal Fund Transfer (Contra Voucher)
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                  Move liquidity between corporate bank, petty cash, or MFS wallets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitTransfer} style={{ padding: 20 }}>
              {transferError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                  {transferError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* From Account */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    From Account (Credit / Outflow) *
                  </label>
                  <select
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({formatBdt(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Account */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    To Account (Debit / Inflow) *
                  </label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({formatBdt(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Transfer Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                  />
                  {/* Quick amount chips */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {[10000, 50000, 100000, 250000].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setTransferAmount(String(quick))}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        +{quick / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Reference & Narration */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Reference No. (Cheque # / BEFTN / Trx ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-882710 or BKASH-TXN-991"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Purpose / Narration
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replenish Banglabazar cash safe from corporate bank account"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              {/* Double Entry Live Preview Box */}
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0', marginBottom: 18, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Live Double-Entry Journal Voucher Preview:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>
                  <span>Dr. {selectedToAccountObj ? selectedToAccountObj.name : 'Destination Account'}</span>
                  <span>{formatBdt(parseFloat(transferAmount) || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 600 }}>
                  <span style={{ paddingLeft: 16 }}>Cr. {selectedFromAccountObj ? selectedFromAccountObj.name : 'Source Account'}</span>
                  <span>{formatBdt(parseFloat(transferAmount) || 0)}</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={busy}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {busy ? 'Processing...' : 'Post Contra Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL B: BANK RECONCILIATION */}
      {showReconModal && reconAccount && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Bank Reconciliation Checkpoint
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                  {reconAccount.name} ({reconAccount.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReconModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitReconciliation} style={{ padding: 20 }}>
              {reconError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                  {reconError}
                </div>
              )}

              <div style={{ background: '#eff6ff', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#1e40af' }}>Current GL Book Balance:</span>
                  <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{formatBdt(reconAccount.balance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3b82f6' }}>
                  <span>Account Number:</span>
                  <span>{reconAccount.accountNumber}</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Statement Cut-off Date *
                </label>
                <input
                  type="date"
                  required
                  value={reconDate}
                  onChange={(e) => setReconDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Bank Statement Closing Balance (BDT) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={reconBalance}
                  onChange={(e) => setReconBalance(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Reconciliation Notes & Discrepancy Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Reconciled with DBBL Corporate e-Statement #110.120.4852. All cheques cleared."
                  value={reconNotes}
                  onChange={(e) => setReconNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowReconModal(false)}
                  disabled={busy}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {busy ? 'Saving...' : 'Confirm Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL C: DIRECT VOUCHER (INFLOW / OUTFLOW) */}
      {showVoucherModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              maxWidth: 580,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Direct Cash/Bank Voucher
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                  Direct payment voucher (expense) or receipt voucher (inflow).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitDirectVoucher} style={{ padding: 20 }}>
              {voucherError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                  {voucherError}
                </div>
              )}

              {/* Voucher Type Selector */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setVoucherType('payment')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: voucherType === 'payment' ? '#e11d48' : '#e2e8f0',
                    background: voucherType === 'payment' ? '#fff1f2' : '#ffffff',
                    color: voucherType === 'payment' ? '#e11d48' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowUpRight size={14} />
                  <span>Payment / Outflow Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherType('receipt')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: voucherType === 'receipt' ? '#16a34a' : '#e2e8f0',
                    background: voucherType === 'receipt' ? '#f0fdf4' : '#ffffff',
                    color: voucherType === 'receipt' ? '#16a34a' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowDownLeft size={14} />
                  <span>Receipt / Inflow Voucher</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Bank / Cash Account */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Cash / Bank Account *
                  </label>
                  <select
                    value={voucherBankId}
                    onChange={(e) => setVoucherBankId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({formatBdt(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Counterpart Account */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Counterpart Account ({voucherType === 'payment' ? 'Expense' : 'Income'}) *
                  </label>
                  <select
                    value={voucherCounterId}
                    onChange={(e) => setVoucherCounterId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {counterparts.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.account_code}] {c.name} ({c.account_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Voucher Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 15000"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Voucher Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Payee & Reference */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    {voucherType === 'payment' ? 'Payee / Beneficiary' : 'Payer / Source'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Courier Service, Utility Office"
                    value={voucherParty}
                    onChange={(e) => setVoucherParty(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Reference / Receipt #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-9901 or REC-4410"
                    value={voucherRef}
                    onChange={(e) => setVoucherRef(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Narration / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Office courier and delivery expenses for publication manuscripts"
                  value={voucherNarration}
                  onChange={(e) => setVoucherNarration(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              {/* Double-entry preview */}
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0', marginBottom: 18, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Double-Entry Ledger Posting:
                </div>
                {voucherType === 'receipt' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>
                      <span>Dr. {selectedVoucherBankObj ? selectedVoucherBankObj.name : 'Cash / Bank Account'} (Inflow)</span>
                      <span>{formatBdt(parseFloat(voucherAmount) || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontWeight: 600 }}>
                      <span style={{ paddingLeft: 16 }}>Cr. {selectedVoucherCounterObj ? selectedVoucherCounterObj.name : 'Counterpart Account'}</span>
                      <span>{formatBdt(parseFloat(voucherAmount) || 0)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontWeight: 600, marginBottom: 4 }}>
                      <span>Dr. {selectedVoucherCounterObj ? selectedVoucherCounterObj.name : 'Counterpart Account'} (Expense)</span>
                      <span>{formatBdt(parseFloat(voucherAmount) || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 600 }}>
                      <span style={{ paddingLeft: 16 }}>Cr. {selectedVoucherBankObj ? selectedVoucherBankObj.name : 'Cash / Bank Account'} (Outflow)</span>
                      <span>{formatBdt(parseFloat(voucherAmount) || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  disabled={busy}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: voucherType === 'receipt' ? '#16a34a' : '#2563eb',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {busy ? 'Processing...' : voucherType === 'receipt' ? 'Post Receipt Voucher' : 'Post Payment Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
