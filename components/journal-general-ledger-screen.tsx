"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  BookOpen,
  Search,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Filter,
  DollarSign,
  Layers,
  Building2,
  Calendar,
  X,
  ExternalLink,
  Printer,
  ChevronRight,
  ArrowUpDown,
  History,
  AlertTriangle,
  RotateCcw,
  Check,
  CreditCard,
  Wallet
} from 'lucide-react';

type Journal = {
  id: string;
  entry_number: string;
  posting_date: string;
  status: 'draft' | 'posted';
  description: string;
  source_type?: string | null;
  source_id?: string | null;
  posted_at?: string | null;
  total_debit: number;
  total_credit: number;
  line_count: number;
};

type JournalLine = {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: string | number;
  credit: string | number;
  cost_center_code?: string | null;
};

type JournalDetail = {
  id: string;
  entry_number: string;
  posting_date: string;
  status: 'draft' | 'posted';
  description: string;
  source_type?: string | null;
  source_id?: string | null;
  posted_at?: string | null;
  lines: JournalLine[];
};

type Account = {
  id: string;
  account_code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_active: number | boolean;
};

type CostCenter = {
  code: string;
  name: string;
  status: string;
};

type LedgerLine = {
  journal_id: string;
  entry_number: string;
  posting_date: string;
  description: string;
  source_type?: string | null;
  source_id?: string | null;
  line_id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type?: string;
  debit: number;
  credit: number;
  cost_center_code?: string | null;
};

type DraftLine = {
  accountId: string;
  debit: string;
  credit: string;
  costCenterCode: string;
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

export function JournalGeneralLedgerScreen({ initialTab }: { initialTab?: 'vouchers' | 'ledger' }) {
  const [activeTab, setActiveTab] = useState<'vouchers' | 'ledger' | 'reversals'>(initialTab || 'vouchers');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // User auth info
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  // Base Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalStats, setJournalStats] = useState({
    totalVouchers: 0,
    postedCount: 0,
    draftCount: 0,
    totalVolume: 0,
  });

  // Vouchers Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'draft'>('all');
  const [voucherFrom, setVoucherFrom] = useState('');
  const [voucherTo, setVoucherTo] = useState('');

  // General Ledger State
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [glFrom, setGlFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [glTo, setGlTo] = useState(new Date().toISOString().slice(0, 10));
  const [ledgerData, setLedgerData] = useState<LedgerLine[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<{
    total: number;
    periodDebit: number;
    periodCredit: number;
    account: Account | null;
    openingBalance: { debit: number; credit: number; net: number };
  }>({
    total: 0,
    periodDebit: 0,
    periodCredit: 0,
    account: null,
    openingBalance: { debit: 0, credit: 0, net: 0 },
  });
  const [glLoading, setGlLoading] = useState(false);

  // New Journal Entry Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPostingDate, setNewPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [newDescription, setNewDescription] = useState('');
  const [newLines, setNewLines] = useState<DraftLine[]>([
    { accountId: '', debit: '', credit: '', costCenterCode: '' },
    { accountId: '', debit: '', credit: '', costCenterCode: '' },
  ]);
  const [modalError, setModalError] = useState('');

  // Voucher Detail Drawer / Modal
  const [inspectJournalId, setInspectJournalId] = useState<string | null>(null);
  const [inspectJournal, setInspectJournal] = useState<JournalDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Reversal Modal
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reversalReason, setReversalReason] = useState('');
  const [reversalJournalId, setReversalJournalId] = useState<string | null>(null);

  const canCreate = role === 'Owner' || permissions.includes('workspace.create') || permissions.includes('finance.manage');
  const canPost = role === 'Owner' || permissions.includes('workspace.approve') || permissions.includes('finance.manage');

  // Load Journals
  async function loadJournals() {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (voucherFrom) params.set('from', voucherFrom);
      if (voucherTo) params.set('to', voucherTo);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await api<{
        data: Journal[];
        meta: { total: number; stats?: typeof journalStats };
      }>(`/journal-entries?${params.toString()}`);

      setJournals(res.data || []);
      if (res.meta?.stats) {
        setJournalStats(res.meta.stats);
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to load journals');
    }
  }

  // Load Accounts & Cost Centers
  async function loadMetadata() {
    try {
      const [accRes, ccRes, meRes] = await Promise.all([
        api<{ data: Account[] }>('/accounts/chart'),
        api<{ data: CostCenter[] }>('/finance/cost-centers').catch(() => ({ data: [] })),
        api<{ data: { role: string; permissions: string[] } }>('/auth/me').catch(() => ({ data: { role: '', permissions: [] } })),
      ]);
      setAccounts(accRes.data || []);
      setCostCenters(ccRes.data || []);
      setRole(meRes.data.role);
      setPermissions(meRes.data.permissions || []);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to load metadata');
    }
  }

  // Load General Ledger
  async function loadGeneralLedger() {
    setGlLoading(true);
    try {
      const params = new URLSearchParams({ from: glFrom, to: glTo, limit: '200' });
      if (selectedAccountId) params.set('accountId', selectedAccountId);

      const res = await api<{
        data: LedgerLine[];
        meta: {
          total: number;
          periodDebit: number;
          periodCredit: number;
          account: Account | null;
          openingBalance: { debit: number; credit: number; net: number };
        };
      }>(`/general-ledger?${params.toString()}`);

      setLedgerData(res.data || []);
      if (res.meta) {
        setLedgerMeta(res.meta);
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to load General Ledger');
    } finally {
      setGlLoading(false);
    }
  }

  // Initial Load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadMetadata(), loadJournals()]);
      setLoading(false);
    }
    void init();
  }, []);

  // Reload journals on filter change
  useEffect(() => {
    if (!loading) {
      void loadJournals();
    }
  }, [statusFilter, voucherFrom, voucherTo]);

  // Load General Ledger when tab is active or account changes
  useEffect(() => {
    if (activeTab === 'ledger') {
      void loadGeneralLedger();
    }
  }, [activeTab, selectedAccountId]);

  // Fetch Voucher Detail when selected
  useEffect(() => {
    if (!inspectJournalId) {
      setInspectJournal(null);
      return;
    }
    setInspectLoading(true);
    api<{ data: JournalDetail }>(`/journal-entries/${inspectJournalId}`)
      .then(res => setInspectJournal(res.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load voucher detail'))
      .finally(() => setInspectLoading(false));
  }, [inspectJournalId]);

  // Live balance calculation for New Voucher Form
  const newVoucherTotals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    newLines.forEach(l => {
      debits += Number(l.debit) || 0;
      credits += Number(l.credit) || 0;
    });
    const difference = Math.abs(debits - credits);
    const balanced = difference < 0.005 && debits > 0;
    return { debits, credits, difference, balanced };
  }, [newLines]);

  function updateDraftLine(index: number, field: keyof DraftLine, value: string) {
    setNewLines(curr =>
      curr.map((line, idx) => (idx === index ? { ...line, [field]: value } : line))
    );
  }

  function addDraftLine() {
    setNewLines(curr => [...curr, { accountId: '', debit: '', credit: '', costCenterCode: '' }]);
  }

  function removeDraftLine(index: number) {
    if (newLines.length <= 2) return;
    setNewLines(curr => curr.filter((_, idx) => idx !== index));
  }

  async function handleCreateJournal(postDirectly = false) {
    setModalError('');
    if (!newDescription.trim()) {
      setModalError('Please enter a description / narration for this voucher.');
      return;
    }
    if (newLines.some(l => !l.accountId)) {
      setModalError('All voucher lines must have an account head selected.');
      return;
    }
    if (!newVoucherTotals.balanced) {
      setModalError(`Voucher is not balanced! Difference is ${formatBdt(newVoucherTotals.difference)}.`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        postingDate: newPostingDate,
        description: newDescription.trim(),
        postNow: postDirectly,
        lines: newLines.map(l => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          ...(l.costCenterCode ? { costCenterCode: l.costCenterCode } : {}),
        })),
      };

      const res = await api<{ data: { id: string; entryNumber: string; status: string } }>(
        '/journal-entries',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setNotice(
        postDirectly
          ? `Journal Voucher ${res.data.entryNumber} created and posted successfully!`
          : `Journal Voucher ${res.data.entryNumber} saved as draft.`
      );
      setShowNewModal(false);
      setNewDescription('');
      setNewLines([
        { accountId: '', debit: '', credit: '', costCenterCode: '' },
        { accountId: '', debit: '', credit: '', costCenterCode: '' },
      ]);
      await loadJournals();
      if (activeTab === 'ledger') await loadGeneralLedger();
    } catch (e: any) {
      setModalError(e instanceof Error ? e.message : 'Failed to save voucher');
    } finally {
      setBusy(false);
    }
  }

  async function handlePostJournal(id: string) {
    if (!window.confirm('Are you sure you want to post this Journal Voucher? Posted lines become immutable.')) {
      return;
    }
    setBusy(true);
    try {
      await api(`/journal-entries/${id}/post`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setNotice('Journal Voucher posted to General Ledger.');
      await loadJournals();
      if (inspectJournalId === id) {
        const updated = await api<{ data: JournalDetail }>(`/journal-entries/${id}`);
        setInspectJournal(updated.data);
      }
      if (activeTab === 'ledger') await loadGeneralLedger();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to post voucher');
    } finally {
      setBusy(false);
    }
  }

  async function handleReverseJournal() {
    if (!reversalJournalId) return;
    if (!reversalReason.trim()) {
      alert('Please enter a reason for reversing this voucher.');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ data: { id: string; entryNumber: string } }>(
        `/journal-entries/${reversalJournalId}/reverse`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            postingDate: reversalDate,
            description: reversalReason.trim(),
          }),
        }
      );
      setNotice(`Reversal Voucher ${res.data.entryNumber} created and posted.`);
      setShowReversalModal(false);
      setReversalReason('');
      setReversalJournalId(null);
      await loadJournals();
      if (activeTab === 'ledger') await loadGeneralLedger();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to reverse voucher');
    } finally {
      setBusy(false);
    }
  }

  // Calculate Running Balance for General Ledger
  const ledgerWithRunningBalance = useMemo(() => {
    let running = ledgerMeta.openingBalance.net;
    const isDebitNormal = !ledgerMeta.account || ['asset', 'expense'].includes(ledgerMeta.account.account_type);

    return ledgerData.map(line => {
      if (isDebitNormal) {
        running += line.debit - line.credit;
      } else {
        running += line.credit - line.debit;
      }
      return {
        ...line,
        runningBalance: running,
      };
    });
  }, [ledgerData, ledgerMeta]);

  // Source Type Badge Helper
  const getSourceBadge = (source?: string | null) => {
    switch (source) {
      case 'sales_invoice':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            Sales Invoice
          </span>
        );
      case 'customer_payment':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0' }}>
            Customer Due Collection
          </span>
        );
      case 'customer_collection':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            MFS / Merchant Collection
          </span>
        );
      case 'ecommerce':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
            E-Commerce Web Sales
          </span>
        );
      case 'fair_sales_receipt':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
            Boi Mela POS
          </span>
        );
      case 'journal_reversal':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            Journal Reversal
          </span>
        );
      case 'sales_credit_note':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
            Credit Note
          </span>
        );
      case 'sales_return_receipt':
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fefce8', color: '#a16207', border: '1px solid #fef08a' }}>
            Sales Return
          </span>
        );
      default:
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
            Manual Journal Voucher
          </span>
        );
    }
  };

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
              Voucher Registry & Ledger
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Journal & General Ledger
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Voucher Registry, Multi-line Journal Entries, Cost Centre Allocation & General Ledger Book.
          </p>
        </div>

        {/* TOP ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              void loadJournals();
              if (activeTab === 'ledger') void loadGeneralLedger();
            }}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155' }}
          >
            <RefreshCw size={14} className={busy ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canCreate && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowNewModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
            >
              <Plus size={16} />
              <span>New Journal Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* TOP 4 EXECUTIVE KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Metric 1: Total Vouchers */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Journal Vouchers</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {journalStats.totalVouchers.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Audit-trailed double entries
          </div>
        </div>

        {/* Metric 2: Posted */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Posted to General Ledger</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
            {journalStats.postedCount.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: 600 }}>
            Immutable official postings
          </div>
        </div>

        {/* Metric 3: Draft Pending */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Draft Vouchers Pending</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: journalStats.draftCount > 0 ? '#b45309' : '#0f172a' }}>
            {journalStats.draftCount.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Awaiting checker review
          </div>
        </div>

        {/* Metric 4: Total Volume */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Journal Volume</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>
            {formatBdt(journalStats.totalVolume)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Total posted debits
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('vouchers')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vouchers' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'vouchers' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileText size={15} />
          <span>Journal Vouchers Register</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'ledger' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <BookOpen size={15} />
          <span>General Ledger Book</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reversals')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reversals' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'reversals' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <RotateCcw size={15} />
          <span>Reversals & Audit Trail</span>
        </button>
      </div>

      {/* TAB 1: JOURNAL VOUCHERS REGISTER */}
      {activeTab === 'vouchers' && (
        <div>
          {/* Filter Bar */}
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
              gap: 12,
            }}
          >
            <div style={{ flex: '1 1 320px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search voucher #, description, customer, source..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void loadJournals()}
                className="input"
                style={{ width: '100%', paddingLeft: 34, fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="input"
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="posted">Posted Only</option>
                  <option value="draft">Draft Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>From:</span>
                <input
                  type="date"
                  value={voucherFrom}
                  onChange={e => setVoucherFrom(e.target.value)}
                  className="input"
                  style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>To:</span>
                <input
                  type="date"
                  value={voucherTo}
                  onChange={e => setVoucherTo(e.target.value)}
                  className="input"
                  style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <button
                type="button"
                onClick={() => void loadJournals()}
                className="btn btn-sm btn-primary"
                style={{ background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
              >
                Apply
              </button>

              {(searchQuery || statusFilter !== 'all' || voucherFrom || voucherTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setVoucherFrom('');
                    setVoucherTo('');
                  }}
                  className="btn btn-sm"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Vouchers Table */}
          <div
            className="panel"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Voucher Number</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Posting Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Type / Source</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Narration / Description</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Debit (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Credit (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                        <div>Loading journal vouchers...</div>
                      </td>
                    </tr>
                  ) : journals.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <FileText size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Journal Vouchers Found</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          No vouchers matched the selected filter criteria.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    journals.map(j => {
                      const isPosted = j.status === 'posted';
                      return (
                        <tr key={j.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              type="button"
                              onClick={() => setInspectJournalId(j.id)}
                              style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', cursor: 'pointer', textAlign: 'left' }}
                            >
                              {j.entry_number}
                            </button>
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                              {j.line_count} line items
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {formatDate(j.posting_date)}
                          </td>

                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {getSourceBadge(j.source_type)}
                          </td>

                          <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.description}>
                            {j.description}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>
                            {formatBdt(j.total_debit)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                            {formatBdt(j.total_credit)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 12,
                                background: isPosted ? '#ecfdf5' : '#fffbeb',
                                color: isPosted ? '#15803d' : '#b45309',
                                border: isPosted ? '1px solid #bbf7d0' : '1px solid #fde68a',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {isPosted ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              <span>{isPosted ? 'Posted' : 'Draft'}</span>
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => setInspectJournalId(j.id)}
                                className="btn btn-sm"
                                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', fontSize: 12, padding: '4px 10px' }}
                              >
                                View Lines
                              </button>

                              {!isPosted && canPost && (
                                <button
                                  type="button"
                                  onClick={() => handlePostJournal(j.id)}
                                  className="btn btn-sm btn-primary"
                                  style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontSize: 12, padding: '4px 10px' }}
                                >
                                  Post
                                </button>
                              )}

                              {isPosted && j.source_type !== 'journal_reversal' && canPost && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReversalJournalId(j.id);
                                    setReversalReason(`Reversal of ${j.entry_number}: correction`);
                                    setShowReversalModal(true);
                                  }}
                                  className="btn btn-sm"
                                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '4px 8px' }}
                                  title="Post Reversal Voucher"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>
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

      {/* TAB 2: GENERAL LEDGER BOOK */}
      {activeTab === 'ledger' && (
        <div>
          {/* Filter Bar */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Select Ledger Account Head:
              </label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="input"
                style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
              >
                <option value="">— All Ledger Accounts (Combined Posting View) —</option>
                <optgroup label="Asset Accounts (1000s)">
                  {accounts.filter(a => a.account_type === 'asset').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Liability Accounts (2000s)">
                  {accounts.filter(a => a.account_type === 'liability').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Equity Accounts (3000s)">
                  {accounts.filter(a => a.account_type === 'equity').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Revenue Accounts (4000s)">
                  {accounts.filter(a => a.account_type === 'revenue').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Expense Accounts (5000s)">
                  {accounts.filter(a => a.account_type === 'expense').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  From:
                </label>
                <input
                  type="date"
                  value={glFrom}
                  onChange={e => setGlFrom(e.target.value)}
                  className="input"
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  To:
                </label>
                <input
                  type="date"
                  value={glTo}
                  onChange={e => setGlTo(e.target.value)}
                  className="input"
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <button
                type="button"
                onClick={() => void loadGeneralLedger()}
                className="btn btn-sm btn-primary"
                style={{ background: '#2563eb', borderColor: '#2563eb', color: '#ffffff', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Filter size={14} />
                <span>Generate Ledger</span>
              </button>
            </div>
          </div>

          {/* Account Overview Header Card if specific account chosen */}
          {ledgerMeta.account && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #bfdbfe',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 20,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>
                      {ledgerMeta.account.account_code}
                    </span>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {ledgerMeta.account.name}
                    </h2>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                      {ledgerMeta.account.account_type}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                    Ledger Statement from {formatDate(glFrom)} to {formatDate(glTo)}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, fontSize: 12 }}>
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>Opening Balance</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                      {formatBdt(ledgerMeta.openingBalance.net)}
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>Period Debits</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                      {formatBdt(ledgerMeta.periodDebit)}
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>Period Credits</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                      {formatBdt(ledgerMeta.periodCredit)}
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <div style={{ color: '#1d4ed8', fontSize: 11, fontWeight: 700 }}>Closing Balance</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1e40af', marginTop: 2 }}>
                      {formatBdt(
                        ['asset', 'expense'].includes(ledgerMeta.account.account_type)
                          ? ledgerMeta.openingBalance.net + ledgerMeta.periodDebit - ledgerMeta.periodCredit
                          : ledgerMeta.openingBalance.net + ledgerMeta.periodCredit - ledgerMeta.periodDebit
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div
            className="panel"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Posting Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Voucher #</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Account Head</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Description / Narration</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Cost Centre</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Debit (Dr)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Credit (Cr)</th>
                    {selectedAccountId && (
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Running Net Balance</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row if Account Selected */}
                  {selectedAccountId && (
                    <tr style={{ background: '#f8fafc', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#64748b' }}>{formatDate(glFrom)}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>—</td>
                      <td style={{ padding: '10px 16px', color: '#475569' }}>
                        {ledgerMeta.account?.account_code} · {ledgerMeta.account?.name}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#1d4ed8', fontStyle: 'italic' }}>
                        Opening Balance B/F (as of {formatDate(glFrom)})
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>—</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>
                        {ledgerMeta.openingBalance.debit > 0 ? formatBdt(ledgerMeta.openingBalance.debit) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>
                        {ledgerMeta.openingBalance.credit > 0 ? formatBdt(ledgerMeta.openingBalance.credit) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                        {formatBdt(ledgerMeta.openingBalance.net)}
                      </td>
                    </tr>
                  )}

                  {glLoading ? (
                    <tr>
                      <td colSpan={selectedAccountId ? 8 : 7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                        <div>Generating General Ledger...</div>
                      </td>
                    </tr>
                  ) : ledgerWithRunningBalance.length === 0 ? (
                    <tr>
                      <td colSpan={selectedAccountId ? 8 : 7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <BookOpen size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Ledger Transactions in Selected Range</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Try expanding the date range or select a different account head.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ledgerWithRunningBalance.map(item => (
                      <tr key={item.line_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(item.posting_date)}
                        </td>

                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => setInspectJournalId(item.journal_id)}
                            style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', cursor: 'pointer' }}
                          >
                            {item.entry_number}
                          </button>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', marginRight: 6 }}>
                            {item.account_code}
                          </span>
                          <span>{item.account_name}</span>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#334155', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                          {item.description}
                        </td>

                        <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {item.cost_center_code ? (
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}>
                              {item.cost_center_code}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>
                          {item.debit > 0 ? formatBdt(item.debit) : '—'}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                          {item.credit > 0 ? formatBdt(item.credit) : '—'}
                        </td>

                        {selectedAccountId && (
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                            {formatBdt(item.runningBalance)}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Footer Totals */}
                {ledgerData.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800, color: '#0f172a' }}>
                      <td colSpan={5} style={{ padding: '12px 16px', textAlign: 'right', textTransform: 'uppercase', fontSize: 11.5, color: '#475569' }}>
                        Period Movement Totals:
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#15803d' }}>
                        {formatBdt(ledgerMeta.periodDebit)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#0284c7' }}>
                        {formatBdt(ledgerMeta.periodCredit)}
                      </td>
                      {selectedAccountId && (
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#1e40af', background: '#eff6ff' }}>
                          {formatBdt(
                            ledgerMeta.account && ['asset', 'expense'].includes(ledgerMeta.account.account_type)
                              ? ledgerMeta.openingBalance.net + ledgerMeta.periodDebit - ledgerMeta.periodCredit
                              : ledgerMeta.openingBalance.net + ledgerMeta.periodCredit - ledgerMeta.periodDebit
                          )}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REVERSALS & AUDIT TRAIL */}
      {activeTab === 'reversals' && (
        <div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={16} color="#dc2626" />
              <span>Journal Reversals Register</span>
            </h2>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>
              GAAP/IFRS compliant reversing entries. Once a voucher is posted, it cannot be deleted; corrections are recorded as an auditable reversal voucher.
            </p>
          </div>

          <div
            className="panel"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Reversal Voucher #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Posting Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Reason / Narration</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Reversed Amount</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.filter(j => j.source_type === 'journal_reversal').length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <RotateCcw size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Journal Reversals on Record</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          All posted journals are in original state without contra cancellations.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    journals
                      .filter(j => j.source_type === 'journal_reversal')
                      .map(j => (
                        <tr key={j.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                            {j.entry_number}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#475569' }}>
                            {formatDate(j.posting_date)}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                            {j.description}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                            {formatBdt(j.total_debit)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                              Reversed
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setInspectJournalId(j.id)}
                              className="btn btn-sm"
                              style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', fontSize: 12, padding: '4px 10px' }}
                            >
                              Inspect Lines
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

      {/* MODAL: CREATE NEW JOURNAL ENTRY */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: 860,
              overflow: 'hidden',
              margin: 'auto',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#2563eb" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Create New Journal Voucher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Header Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Posting Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={newPostingDate}
                    onChange={e => setNewPostingDate(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'block' }}>
                    Must fall within an open fiscal period.
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Description / Narration <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Office supplies purchase, bank transfer..."
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Lines Breakdown Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                    Voucher Debits & Credits Breakdown
                  </span>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>
                    Minimum 2 balanced lines required
                  </span>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Account Head</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Cost Centre (Optional)</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right', width: 130 }}>Debit (৳)</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right', width: 130 }}>Credit (৳)</th>
                        <th style={{ padding: '10px 10px', width: 40, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newLines.map((line, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={line.accountId}
                              onChange={e => updateDraftLine(idx, 'accountId', e.target.value)}
                              className="input"
                              style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                            >
                              <option value="">Select Account Head...</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.account_code} · {a.name} ({a.account_type})
                                </option>
                              ))}
                            </select>
                          </td>

                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={line.costCenterCode}
                              onChange={e => updateDraftLine(idx, 'costCenterCode', e.target.value)}
                              className="input"
                              style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                            >
                              <option value="">None (Head Office General)</option>
                              {costCenters.map(cc => (
                                <option key={cc.code} value={cc.code}>
                                  {cc.code} · {cc.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={line.debit}
                              onChange={e => {
                                updateDraftLine(idx, 'debit', e.target.value);
                                if (Number(e.target.value) > 0) {
                                  updateDraftLine(idx, 'credit', '');
                                }
                              }}
                              className="input"
                              style={{ width: '100%', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', color: '#15803d' }}
                            />
                          </td>

                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={line.credit}
                              onChange={e => {
                                updateDraftLine(idx, 'credit', e.target.value);
                                if (Number(e.target.value) > 0) {
                                  updateDraftLine(idx, 'debit', '');
                                }
                              }}
                              className="input"
                              style={{ width: '100%', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0284c7' }}
                            />
                          </td>

                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeDraftLine(idx)}
                              disabled={newLines.length <= 2}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: newLines.length <= 2 ? 'not-allowed' : 'pointer' }}
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={addDraftLine}
                    className="btn btn-sm"
                    style={{ background: '#ffffff', border: '1px dashed #cbd5e1', color: '#334155', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>Add Another Line</span>
                  </button>
                </div>
              </div>

              {/* Real-time Balancing Indicator Banner */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 10,
                  border: newVoucherTotals.balanced ? '1px solid #bbf7d0' : '1px solid #fde68a',
                  background: newVoucherTotals.balanced ? '#ecfdf5' : '#fffbeb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {newVoucherTotals.balanced ? (
                    <CheckCircle2 size={18} color="#15803d" />
                  ) : (
                    <AlertTriangle size={18} color="#b45309" />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: newVoucherTotals.balanced ? '#15803d' : '#92400e' }}>
                      {newVoucherTotals.balanced
                        ? 'Voucher is Perfectly Balanced'
                        : 'Voucher is Out of Balance'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                      {newVoucherTotals.balanced
                        ? 'Total Debits equal Total Credits. Eligible for instant ledger posting.'
                        : `Difference of ${formatBdt(newVoucherTotals.difference)} must be reconciled.`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'monospace', fontSize: 12.5 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Total Debit:</span>
                    <strong style={{ color: '#15803d', fontSize: 14 }}>{formatBdt(newVoucherTotals.debits)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Total Credit:</span>
                    <strong style={{ color: '#0284c7', fontSize: 14 }}>{formatBdt(newVoucherTotals.credits)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="btn btn-sm"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleCreateJournal(false)}
                className="btn btn-sm"
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600 }}
              >
                Save as Draft
              </button>

              {canPost && (
                <button
                  type="button"
                  disabled={busy || !newVoucherTotals.balanced}
                  onClick={() => handleCreateJournal(true)}
                  className="btn btn-sm btn-primary"
                  style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 700 }}
                >
                  {busy ? 'Posting...' : 'Post Journal Voucher'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: VIEW VOUCHER DETAIL */}
      {inspectJournalId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: 780,
              overflow: 'hidden',
              margin: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#2563eb" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Journal Voucher</span>
                  <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{inspectJournal?.entry_number}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectJournalId(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {inspectLoading || !inspectJournal ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                  <div>Loading voucher details...</div>
                </div>
              ) : (
                <>
                  {/* Header Meta Info */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Posting Date</span>
                      <strong style={{ color: '#0f172a', marginTop: 2, display: 'block' }}>{formatDate(inspectJournal.posting_date)}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Status</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          background: inspectJournal.status === 'posted' ? '#ecfdf5' : '#fff7ed',
                          color: inspectJournal.status === 'posted' ? '#15803d' : '#c2410c',
                          display: 'inline-block',
                          marginTop: 2,
                        }}
                      >
                        {inspectJournal.status}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Source Document</span>
                      <div style={{ marginTop: 2 }}>{getSourceBadge(inspectJournal.source_type)}</div>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Posted At</span>
                      <span style={{ fontFamily: 'monospace', color: '#475569', marginTop: 2, display: 'block' }}>
                        {inspectJournal.posted_at ? formatDate(inspectJournal.posted_at) : '—'}
                      </span>
                    </div>

                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Narration / Description</span>
                      <p style={{ color: '#0f172a', fontWeight: 600, margin: '2px 0 0', fontSize: 12.5 }}>{inspectJournal.description}</p>
                    </div>
                  </div>

                  {/* Lines Breakdown */}
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', margin: '0 0 8px' }}>
                      Account Head Distribution
                    </h4>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Account Code</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Account Name</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Cost Centre</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Debit (৳)</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Credit (৳)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectJournal.lines.map(line => (
                            <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                                {line.account_code}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: 600 }}>
                                {line.account_name}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>
                                {line.cost_center_code ? (
                                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                                    {line.cost_center_code}
                                  </span>
                                ) : (
                                  <span>—</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>
                                {Number(line.debit) > 0 ? formatBdt(line.debit) : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                                {Number(line.credit) > 0 ? formatBdt(line.credit) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800, color: '#0f172a' }}>
                            <td colSpan={3} style={{ padding: '10px 14px', textAlign: 'right', textTransform: 'uppercase', fontSize: 11.5, color: '#475569' }}>
                              Voucher Total:
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#15803d' }}>
                              {formatBdt(
                                inspectJournal.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#0284c7' }}>
                              {formatBdt(
                                inspectJournal.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-sm"
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={14} />
                <span>Print Voucher Slip</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setInspectJournalId(null)}
                  className="btn btn-sm"
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' }}
                >
                  Close
                </button>

                {inspectJournal?.status === 'draft' && canPost && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handlePostJournal(inspectJournal.id)}
                    className="btn btn-sm btn-primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 700 }}
                  >
                    Post to General Ledger
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVERSE JOURNAL VOUCHER */}
      {showReversalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={18} color="#dc2626" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  Reverse Journal Voucher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReversalModal(false)}
                style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12.5 }}>
              <p style={{ color: '#475569', margin: 0 }}>
                This will generate and post a mirror-opposite contra journal voucher reversing all debit and credit lines of this voucher to restore ledger balances.
              </p>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Reversal Posting Date:
                </label>
                <input
                  type="date"
                  value={reversalDate}
                  onChange={e => setReversalDate(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Reason for Reversal:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inadvertent duplicate entry, amount error..."
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowReversalModal(false)}
                className="btn btn-sm"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy || !reversalReason.trim()}
                onClick={handleReverseJournal}
                className="btn btn-sm"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#ffffff', fontWeight: 700 }}
              >
                {busy ? 'Processing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
