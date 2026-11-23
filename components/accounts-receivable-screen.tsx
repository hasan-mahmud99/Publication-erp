"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  CreditCard,
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
  Wallet,
  Users,
  Smartphone,
  TrendingUp,
  Receipt,
  Download
} from 'lucide-react';

type ArKpis = {
  totalInvoiced: number;
  totalCollected: number;
  totalReceivables: number;
  overdueReceivables: number;
  customersWithDue: number;
  totalInvoices: number;
};

type ArAgeing = {
  current_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
};

type CustomerAr = {
  id: string;
  customer_code: string;
  name: string;
  customer_type: string;
  phone?: string | null;
  email?: string | null;
  credit_limit: number;
  status: string;
  total_invoiced: number;
  total_collected: number;
  outstanding_due: number;
  invoice_count: number;
  ageing: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
};

type OutstandingInvoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_method?: string | null;
  sales_channel: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  days_outstanding: number;
};

type PaymentReceipt = {
  id: string;
  payment_date: string;
  payment_method: string;
  amount: number;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
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

export function AccountsReceivableScreen({ initialTab }: { initialTab?: 'customers' | 'invoices' | 'ageing' | 'receipts' }) {
  const [activeTab, setActiveTab] = useState<'customers' | 'invoices' | 'ageing' | 'receipts'>(initialTab || 'customers');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Main AR Data
  const [kpis, setKpis] = useState<ArKpis>({
    totalInvoiced: 0,
    totalCollected: 0,
    totalReceivables: 0,
    overdueReceivables: 0,
    customersWithDue: 0,
    totalInvoices: 0,
  });

  const [ageing, setAgeing] = useState<ArAgeing>({
    current_0_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
  });

  const [customers, setCustomers] = useState<CustomerAr[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<PaymentReceipt[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(true);
  const [ageingBucketFilter, setAgeingBucketFilter] = useState<'all' | '0_30' | '31_60' | '61_90' | '90_plus'>('all');

  // Payment Collection Modal State
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OutstandingInvoice | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectDate, setCollectDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [collectMethod, setCollectMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank_transfer' | 'cheque'>('bkash');
  const [collectRef, setCollectRef] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{
        data: {
          kpis: ArKpis;
          ageing: ArAgeing;
          customers: CustomerAr[];
          outstandingInvoices: OutstandingInvoice[];
          recentReceipts: PaymentReceipt[];
        };
      }>('/finance/accounts-receivable');

      setKpis(res.data.kpis);
      setAgeing(res.data.ageing);
      setCustomers(res.data.customers);
      setOutstandingInvoices(res.data.outstandingInvoices);
      setRecentReceipts(res.data.recentReceipts);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to load Accounts Receivable data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (filterDueOnly && c.outstanding_due <= 0) return false;
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.customer_code.toLowerCase().includes(term) ||
        (c.phone && c.phone.toLowerCase().includes(term))
      );
    });
  }, [customers, filterDueOnly, searchQuery]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return outstandingInvoices.filter(inv => {
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(term) ||
        inv.customer_name.toLowerCase().includes(term) ||
        inv.customer_code.toLowerCase().includes(term)
      );
    });
  }, [outstandingInvoices, searchQuery]);

  // Open Payment Modal for an invoice
  function handleOpenCollectModal(inv: OutstandingInvoice) {
    setSelectedInvoice(inv);
    setCollectAmount(String(inv.due_amount));
    setCollectDate(new Date().toISOString().slice(0, 10));
    setCollectMethod('bkash');
    setCollectRef('');
    setCollectNotes(`Customer due collection for ${inv.invoice_number}`);
    setModalError('');
    setShowCollectModal(true);
  }

  // Submit Payment Collection
  async function handleSubmitPayment() {
    setModalError('');
    if (!selectedInvoice) return;
    const numAmount = Number(collectAmount);
    if (!numAmount || numAmount <= 0) {
      setModalError('Please enter a valid collection amount greater than 0.');
      return;
    }
    if (numAmount > selectedInvoice.due_amount) {
      setModalError(`Amount cannot exceed outstanding due of ${formatBdt(selectedInvoice.due_amount)}.`);
      return;
    }

    setBusy(true);
    try {
      await api('/finance/accounts-receivable/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          paymentDate: collectDate,
          paymentMethod: collectMethod,
          amount: numAmount,
          referenceNo: collectRef.trim() || undefined,
          notes: collectNotes.trim() || undefined,
        }),
      });

      setNotice(
        `Collected ${formatBdt(numAmount)} for Invoice ${selectedInvoice.invoice_number} via ${collectMethod.toUpperCase()}. Ledger updated.`
      );
      setShowCollectModal(false);
      setSelectedInvoice(null);
      await loadData();
    } catch (e: any) {
      setModalError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setBusy(false);
    }
  }

  // Method Badge Helper
  const getMethodBadge = (method?: string | null) => {
    const m = (method || '').toLowerCase();
    if (m.includes('bkash')) {
      return (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8' }}>
          bKash Merchant
        </span>
      );
    }
    if (m.includes('nagad')) {
      return (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5' }}>
          Nagad Merchant
        </span>
      );
    }
    if (m.includes('bank')) {
      return (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          Bank Transfer (DBBL)
        </span>
      );
    }
    if (m.includes('cheque')) {
      return (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
          Cheque
        </span>
      );
    }
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0' }}>
        Cash in Hand
      </span>
    );
  };

  const totalAgeing = ageing.current_0_30 + ageing.days_31_60 + ageing.days_61_90 + ageing.days_90_plus || 1;
  const pctCurrent = Math.round((ageing.current_0_30 / totalAgeing) * 100);
  const pct31_60 = Math.round((ageing.days_31_60 / totalAgeing) * 100);
  const pct61_90 = Math.round((ageing.days_61_90 / totalAgeing) * 100);
  const pct90Plus = Math.round((ageing.days_90_plus / totalAgeing) * 100);

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
              Accounts Receivable (AR)
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Accounts Receivable (AR)
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Customer Outstanding Dues, Ageing Analysis, Unpaid Invoices & Payment Collections.
          </p>
        </div>

        {/* TOP ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadData()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            href="/sales-distribution/sales-invoice-list"
            className="btn btn-sm"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' }}
          >
            <Receipt size={14} />
            <span>Sales Invoices</span>
          </Link>
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

      {/* TOP 4 AR EXECUTIVE KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Metric 1: Total Outstanding Receivables */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Outstanding Due</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ea580c' }}>
            {formatBdt(kpis.totalReceivables)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Across {kpis.customersWithDue} customer accounts
          </div>
        </div>

        {/* Metric 2: Total Collections */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Collections Realized</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
            {formatBdt(kpis.totalCollected)}
          </div>
          <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: 600 }}>
            Settled via Cash, bKash, Nagad & Bank
          </div>
        </div>

        {/* Metric 3: Total Invoiced Sales */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Invoiced Sales</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {formatBdt(kpis.totalInvoiced)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {kpis.totalInvoices} total sales invoices posted
          </div>
        </div>

        {/* Metric 4: Overdue >30 Days */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Overdue Receivables (&gt;30d)</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: kpis.overdueReceivables > 0 ? '#dc2626' : '#0f172a' }}>
            {formatBdt(kpis.overdueReceivables)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Requires priority follow-up
          </div>
        </div>
      </div>

      {/* AR AGEING SUMMARY STRIP */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
              Accounts Receivable Ageing Profile
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Maturity distribution of outstanding customer balances.
            </p>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
            Total Due: <span style={{ color: '#ea580c' }}>{formatBdt(kpis.totalReceivables)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', marginBottom: 12 }}>
          <div style={{ width: `${pctCurrent}%`, background: '#10b981' }} title={`Current: ${formatBdt(ageing.current_0_30)} (${pctCurrent}%)`} />
          <div style={{ width: `${pct31_60}%`, background: '#f59e0b' }} title={`31-60d: ${formatBdt(ageing.days_31_60)} (${pct31_60}%)`} />
          <div style={{ width: `${pct61_90}%`, background: '#f97316' }} title={`61-90d: ${formatBdt(ageing.days_61_90)} (${pct61_90}%)`} />
          <div style={{ width: `${pct90Plus}%`, background: '#ef4444' }} title={`90+d: ${formatBdt(ageing.days_90_plus)} (${pct90Plus}%)`} />
        </div>

        {/* Ageing 4 Buckets Legend Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 12 }}>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
              <span>Current (0 – 30 Days)</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#15803d', fontSize: 15, marginTop: 4 }}>
              {formatBdt(ageing.current_0_30)}
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400e', fontWeight: 700, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
              <span>31 – 60 Days Due</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#b45309', fontSize: 15, marginTop: 4 }}>
              {formatBdt(ageing.days_31_60)}
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9a3412', fontWeight: 700, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316' }} />
              <span>61 – 90 Days Due</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#c2410c', fontSize: 15, marginTop: 4 }}>
              {formatBdt(ageing.days_61_90)}
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#991b1b', fontWeight: 700, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
              <span>90+ Days (Critical)</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626', fontSize: 15, marginTop: 4 }}>
              {formatBdt(ageing.days_90_plus)}
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'customers' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'customers' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={15} />
          <span>Customer Balances & Ageing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'invoices' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'invoices' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Receipt size={15} />
          <span>Outstanding Invoices ({outstandingInvoices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receipts')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'receipts' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'receipts' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <History size={15} />
          <span>Payment Collection Receipts</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMER BALANCES & STATEMENTS */}
      {activeTab === 'customers' && (
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
                placeholder="Search bookstore, customer code, phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: '100%', paddingLeft: 34, fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={filterDueOnly}
                  onChange={e => setFilterDueOnly(e.target.checked)}
                />
                <span>Show Customers with Outstanding Balance Only</span>
              </label>

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btn btn-sm"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Customers Table */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Customer / Bookstore</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Type</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Invoiced (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Collected (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Due Balance (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Ageing Breakdown</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                        <div>Loading customer receivables...</div>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <Users size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Customers Found</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Try clearing the search query or toggle the outstanding balance filter.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const hasDue = c.outstanding_due > 0;
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{c.customer_code}</span>
                              {c.phone && <span>• {c.phone}</span>}
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', color: '#475569', textTransform: 'capitalize' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              {c.customer_type.replaceAll('_', ' ')}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                            {formatBdt(c.total_invoiced)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#15803d' }}>
                            {formatBdt(c.total_collected)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: hasDue ? '#ea580c' : '#64748b' }}>
                            {formatBdt(c.outstanding_due)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {hasDue ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontFamily: 'monospace' }}>
                                {c.ageing.current_0_30 > 0 && (
                                  <span style={{ padding: '1px 5px', borderRadius: 4, background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0' }} title="0-30 days">
                                    {formatBdt(c.ageing.current_0_30)}
                                  </span>
                                )}
                                {c.ageing.days_31_60 > 0 && (
                                  <span style={{ padding: '1px 5px', borderRadius: 4, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }} title="31-60 days">
                                    {formatBdt(c.ageing.days_31_60)}
                                  </span>
                                )}
                                {c.ageing.days_61_90 > 0 && (
                                  <span style={{ padding: '1px 5px', borderRadius: 4, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }} title="61-90 days">
                                    {formatBdt(c.ageing.days_61_90)}
                                  </span>
                                )}
                                {c.ageing.days_90_plus > 0 && (
                                  <span style={{ padding: '1px 5px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} title="90+ days">
                                    {formatBdt(c.ageing.days_90_plus)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Settled</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {hasDue && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Find first open invoice for this customer
                                    const inv = outstandingInvoices.find(i => i.customer_id === c.id);
                                    if (inv) handleOpenCollectModal(inv);
                                    else {
                                      setActiveTab('invoices');
                                      setSearchQuery(c.name);
                                    }
                                  }}
                                  className="btn btn-sm btn-primary"
                                  style={{ background: '#2563eb', borderColor: '#2563eb', color: '#ffffff', fontSize: 12, padding: '4px 10px' }}
                                >
                                  Collect Payment
                                </button>
                              )}

                              <Link
                                href={`/finance-accounting/general-ledger`}
                                className="btn btn-sm"
                                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', fontSize: 12, padding: '4px 10px', textDecoration: 'none' }}
                              >
                                View GL
                              </Link>
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

      {/* TAB 2: OUTSTANDING INVOICES */}
      {activeTab === 'invoices' && (
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
                placeholder="Search invoice #, customer name, channel..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: '100%', paddingLeft: 34, fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Showing {filteredInvoices.length} outstanding invoice(s)
            </div>
          </div>

          {/* Invoices Table */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Invoice #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Invoice Date</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Customer / Bookstore</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Sales Channel</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Amount (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Paid (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Remaining Due (৳)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Age (Days)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#16a34a' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>All Invoices Fully Settled</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          There are currently no unpaid or outstanding sales invoices.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          <Link href={`/sales-distribution/sales-invoice-list`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                            {inv.invoice_number}
                          </Link>
                        </td>

                        <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(inv.invoice_date)}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{inv.customer_name}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{inv.customer_code}</div>
                        </td>

                        <td style={{ padding: '12px 14px', color: '#475569' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', textTransform: 'capitalize' }}>
                            {inv.sales_channel.replaceAll('_', ' ')}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {formatBdt(inv.total_amount)}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#15803d' }}>
                          {formatBdt(inv.paid_amount)}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ea580c' }}>
                          {formatBdt(inv.due_amount)}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: inv.days_outstanding > 30 ? '#fef2f2' : '#f8fafc',
                              color: inv.days_outstanding > 30 ? '#dc2626' : '#475569',
                              border: inv.days_outstanding > 30 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                            }}
                          >
                            {inv.days_outstanding}d
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenCollectModal(inv)}
                            className="btn btn-sm btn-primary"
                            style={{ background: '#2563eb', borderColor: '#2563eb', color: '#ffffff', fontSize: 12, padding: '4px 12px' }}
                          >
                            Collect Payment
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

      {/* TAB 3: PAYMENT COLLECTION RECEIPTS */}
      {activeTab === 'receipts' && (
        <div>
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
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                  Payment Collection & Settlement Register
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Real-time receipts posted against invoices with automatic GL debit/credit entries.
                </p>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                Total Collected: {formatBdt(kpis.totalCollected)}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Collection Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Invoice #</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Customer / Bookstore</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Payment Method</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Reference / TrxID</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Amount Collected (৳)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <Receipt size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Receipts Recorded</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Payment collections will appear here once recorded.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentReceipts.map(rec => (
                      <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(rec.payment_date)}
                        </td>

                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          {rec.invoice_number}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{rec.customer_name}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{rec.customer_code}</div>
                        </td>

                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {getMethodBadge(rec.payment_method)}
                        </td>

                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#475569' }}>
                          {rec.reference_no || '—'}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#15803d' }}>
                          {formatBdt(rec.amount)}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                          {rec.notes || '—'}
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

      {/* MODAL: COLLECT CUSTOMER PAYMENT */}
      {showCollectModal && selectedInvoice && (
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
              maxWidth: 520,
              overflow: 'hidden',
              margin: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={18} color="#2563eb" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Collect Customer Payment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Invoice Summary Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Invoice Reference:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#2563eb' }}>{selectedInvoice.invoice_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Customer:</span>
                  <strong style={{ color: '#0f172a' }}>{selectedInvoice.customer_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Outstanding Due:</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: 15, color: '#ea580c' }}>
                    {formatBdt(selectedInvoice.due_amount)}
                  </strong>
                </div>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Collection Amount (৳) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    max={selectedInvoice.due_amount}
                    value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: 13, fontWeight: 800, fontFamily: 'monospace', borderRadius: 8, border: '1px solid #cbd5e1', color: '#15803d' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Payment Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={collectDate}
                    onChange={e => setCollectDate(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Payment Method & Deposit Account <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={collectMethod}
                  onChange={e => setCollectMethod(e.target.value as any)}
                  className="input"
                  style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                >
                  <option value="bkash">bKash Merchant Account (01700-112233) — 1015-BKASH</option>
                  <option value="nagad">Nagad Merchant Account (01800-445566) — 1016-NAGAD</option>
                  <option value="cash">Cash in Hand (Head Office & Petty Cash) — 1010-CASH</option>
                  <option value="bank_transfer">Dutch-Bangla Bank Corp (A/C #110.120.485) — 1020-DBBL</option>
                  <option value="cheque">Clearing Cheque Deposit — 1020-DBBL</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Reference No. / TrxID / Cheque #
                </label>
                <input
                  type="text"
                  placeholder="e.g. TrxID 9K88F02, Cheque #099231..."
                  value={collectRef}
                  onChange={e => setCollectRef(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Notes / Narration
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received full due payment at Motijheel office..."
                  value={collectNotes}
                  onChange={e => setCollectNotes(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="btn btn-sm"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleSubmitPayment}
                className="btn btn-sm btn-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 700, padding: '7px 18px' }}
              >
                {busy ? 'Processing...' : 'Confirm & Post Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
