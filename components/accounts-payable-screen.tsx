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
  TrendingDown,
  Receipt,
  Download
} from 'lucide-react';

type ApKpis = {
  totalBilled: number;
  totalPaid: number;
  totalPayables: number;
  overduePayables: number;
  suppliersWithDue: number;
  totalBills: number;
};

type ApAgeing = {
  current_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
};

type SupplierAp = {
  id: string;
  supplier_code: string;
  name: string;
  legal_name: string;
  contact_person: string;
  phone: string;
  email: string;
  category: string;
  payment_terms_days: number;
  total_billed: number;
  total_paid: number;
  outstanding_due: number;
  bill_count: number;
  ageing: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
};

type OutstandingBill = {
  id: string;
  bill_number: string;
  supplier_invoice_number: string;
  po_number: string;
  invoice_date: string;
  due_date: string;
  base_amount: number;
  paid_amount: number;
  due_amount: number;
  days_outstanding: number;
  days_overdue: number;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  status: 'unpaid' | 'partial' | 'paid';
};

type PaymentVoucher = {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_type: string;
  amount: number;
  purpose: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  journal_number?: string | null;
  journal_id?: string | null;
};

type BankAccount = {
  id: string;
  code: string;
  name: string;
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

export function AccountsPayableScreen({ initialTab }: { initialTab?: 'suppliers' | 'bills' | 'ageing' | 'payments' }) {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'bills' | 'ageing' | 'payments'>(initialTab || 'suppliers');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Main AP Data
  const [kpis, setKpis] = useState<ApKpis>({
    totalBilled: 0,
    totalPaid: 0,
    totalPayables: 0,
    overduePayables: 0,
    suppliersWithDue: 0,
    totalBills: 0,
  });

  const [ageing, setAgeing] = useState<ApAgeing>({
    current_0_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
  });

  const [suppliers, setSuppliers] = useState<SupplierAp[]>([]);
  const [outstandingBills, setOutstandingBills] = useState<OutstandingBill[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentVoucher[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [ageingBucketFilter, setAgeingBucketFilter] = useState<'all' | '0_30' | '31_60' | '61_90' | '90_plus'>('all');

  // Payment Settlement Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<OutstandingBill | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<'bank_transfer' | 'cheque' | 'cash' | 'bkash' | 'nagad'>('bank_transfer');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{
        data: {
          kpis: ApKpis;
          ageing: ApAgeing;
          suppliers: SupplierAp[];
          outstandingBills: OutstandingBill[];
          recentPayments: PaymentVoucher[];
          bankAccounts: BankAccount[];
        };
      }>('/finance/accounts-payable');

      setKpis(res.data.kpis);
      setAgeing(res.data.ageing);
      setSuppliers(res.data.suppliers || []);
      setOutstandingBills(res.data.outstandingBills || []);
      setRecentPayments(res.data.recentPayments || []);
      setBankAccounts(res.data.bankAccounts || []);

      if (res.data.bankAccounts?.length && !selectedBankId) {
        setSelectedBankId(res.data.bankAccounts[0].id);
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to load Accounts Payable ledger');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.supplier_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_person.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDue = !filterDueOnly || s.outstanding_due > 0;
      const matchesCat = categoryFilter === 'all' || s.category === categoryFilter;

      let matchesAgeing = true;
      if (ageingBucketFilter === '0_30') matchesAgeing = s.ageing.current_0_30 > 0;
      if (ageingBucketFilter === '31_60') matchesAgeing = s.ageing.days_31_60 > 0;
      if (ageingBucketFilter === '61_90') matchesAgeing = s.ageing.days_61_90 > 0;
      if (ageingBucketFilter === '90_plus') matchesAgeing = s.ageing.days_90_plus > 0;

      return matchesSearch && matchesDue && matchesCat && matchesAgeing;
    });
  }, [suppliers, searchQuery, filterDueOnly, categoryFilter, ageingBucketFilter]);

  // Filtered Outstanding Bills
  const filteredBills = useMemo(() => {
    return outstandingBills.filter(b => {
      return (
        !searchQuery ||
        b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.supplier_invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.supplier_code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [outstandingBills, searchQuery]);

  // Unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach(s => { if (s.category) set.add(s.category); });
    return Array.from(set);
  }, [suppliers]);

  function openPayModalForBill(bill: OutstandingBill) {
    setSelectedBill(bill);
    setPayAmount(String(bill.due_amount));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod('bank_transfer');
    setPayRef('');
    setPayNotes(`Settlement of Bill ${bill.supplier_invoice_number || bill.bill_number}`);
    setModalError('');
    setShowPayModal(true);
  }

  function openPayModalForSupplier(supplier: SupplierAp) {
    const firstBill = outstandingBills.find(b => b.supplier_id === supplier.id);
    if (firstBill) {
      openPayModalForBill(firstBill);
    } else {
      alert(`Supplier ${supplier.name} has no outstanding bills pending payment.`);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBill) return;

    const amountNum = Number(payAmount);
    if (!amountNum || amountNum <= 0) {
      setModalError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (amountNum > selectedBill.due_amount + 0.01) {
      setModalError(`Payment amount (${formatBdt(amountNum)}) cannot exceed the remaining due of ${formatBdt(selectedBill.due_amount)}.`);
      return;
    }

    setBusy(true);
    setModalError('');
    try {
      const res = await api<{
        data: {
          paymentId: string;
          paymentNumber: string;
          journalNumber: string;
          amount: number;
          newRemainingDue: number;
        };
      }>('/finance/accounts-payable/payments', {
        method: 'POST',
        body: JSON.stringify({
          billId: selectedBill.id,
          paymentDate: payDate,
          amount: amountNum,
          paymentMethod: payMethod,
          bankAccountId: selectedBankId || undefined,
          referenceNo: payRef.trim() || undefined,
          notes: payNotes.trim() || undefined,
        }),
      });

      setShowPayModal(false);
      setNotice(
        `Supplier Payment ${res.data.paymentNumber} recorded successfully! Posted Journal Voucher: ${res.data.journalNumber}. Remaining Due: ${formatBdt(res.data.newRemainingDue)}`
      );
      await loadData();
    } catch (err: any) {
      setModalError(err instanceof Error ? err.message : 'Failed to record supplier payment');
    } finally {
      setBusy(false);
    }
  }

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
              Section 5: Accounts Payable
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Accounts Payable & Supplier Ledger
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Vendor Balances, Outstanding Bills, Ageing Analysis & Supplier Payment Vouchers.
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

          {outstandingBills.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => openPayModalForBill(outstandingBills[0])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
            >
              <CreditCard size={15} />
              <span>Record Supplier Payment</span>
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
        {/* Metric 1: Total Billed */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Supplier Bills</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {formatBdt(kpis.totalBilled)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {kpis.totalBills} total purchase bills received
          </div>
        </div>

        {/* Metric 2: Settled / Paid */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Settled / Paid</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
            {formatBdt(kpis.totalPaid)}
          </div>
          <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: 600 }}>
            Settled via Bank, Cheque &amp; Cash
          </div>
        </div>

        {/* Metric 3: Total Payables (Due) */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Outstanding Payables (Due)</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: kpis.totalPayables > 0 ? '#b45309' : '#0f172a' }}>
            {formatBdt(kpis.totalPayables)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Pending payout across {kpis.suppliersWithDue} suppliers
          </div>
        </div>

        {/* Metric 4: Overdue Payables */}
        <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Overdue Payables</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: kpis.overduePayables > 0 ? '#dc2626' : '#0f172a' }}>
            {formatBdt(kpis.overduePayables)}
          </div>
          <div style={{ fontSize: 12, color: kpis.overduePayables > 0 ? '#dc2626' : '#64748b', marginTop: 4, fontWeight: kpis.overduePayables > 0 ? 600 : 400 }}>
            {kpis.overduePayables > 0 ? 'Exceeded agreed vendor credit terms' : 'All accounts within credit terms'}
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'suppliers' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'suppliers' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Building2 size={15} />
          <span>Supplier Payables Directory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'bills' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'bills' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileText size={15} />
          <span>Outstanding Bills Register ({outstandingBills.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ageing')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ageing' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'ageing' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Clock size={15} />
          <span>Payables Ageing Analysis</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'payments' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'payments' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CreditCard size={15} />
          <span>Settlement &amp; Payment Vouchers</span>
        </button>
      </div>

      {/* TAB 1: SUPPLIER DIRECTORY */}
      {activeTab === 'suppliers' && (
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
                placeholder="Search supplier name, code, contact person..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: '100%', paddingLeft: 34, fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {categories.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="input"
                    style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={filterDueOnly}
                  onChange={e => setFilterDueOnly(e.target.checked)}
                  style={{ borderRadius: 4 }}
                />
                <span style={{ fontWeight: 600 }}>Outstanding Balance Only</span>
              </label>

              {(searchQuery || !filterDueOnly || categoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterDueOnly(false);
                    setCategoryFilter('all');
                  }}
                  className="btn btn-sm"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Suppliers Table */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Supplier Details</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Category &amp; Terms</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Contact Info</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Billed</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Paid</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Outstanding Due</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                        <div>Loading accounts payable suppliers...</div>
                      </td>
                    </tr>
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <Building2 size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Suppliers Found</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          No vendors matched your filter criteria.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(s => {
                      const hasDue = s.outstanding_due > 0;
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>
                                {s.supplier_code}
                              </span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{s.bill_count} bills</span>
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
                              {s.category}
                            </span>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                              Terms: Net {s.payment_terms_days} days
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#334155' }}>
                            <div style={{ fontWeight: 600 }}>{s.contact_person}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.phone}</div>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                            {formatBdt(s.total_billed)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#15803d' }}>
                            {formatBdt(s.total_paid)}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: hasDue ? '#b45309' : '#15803d' }}>
                              {formatBdt(s.outstanding_due)}
                            </div>
                            {hasDue && (
                              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', marginTop: 3 }}>
                                Payment Pending
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {hasDue ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => openPayModalForSupplier(s)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11.5, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
                              >
                                <CreditCard size={13} />
                                <span>Pay Due</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={14} /> Settled
                              </span>
                            )}
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

      {/* TAB 2: OUTSTANDING BILLS */}
      {activeTab === 'bills' && (
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
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Bill &amp; Invoice #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Supplier</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>PO Reference</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Bill Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Due Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Bill</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Paid</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Due Amount</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#15803d' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>All Supplier Bills are Settled!</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          There are currently no unpaid or outstanding vendor invoices.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map(b => {
                      const isOverdue = b.days_overdue > 0;
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                              {b.supplier_invoice_number || b.bill_number}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              Internal: {b.bill_number}
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.supplier_name}</div>
                            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{b.supplier_code}</div>
                          </td>

                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11.5, color: '#475569' }}>
                            {b.po_number}
                          </td>

                          <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {formatDate(b.invoice_date)}
                          </td>

                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ color: isOverdue ? '#dc2626' : '#475569', fontWeight: isOverdue ? 700 : 400 }}>
                              {formatDate(b.due_date)}
                            </div>
                            {isOverdue && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>
                                {b.days_overdue} days overdue
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                            {formatBdt(b.base_amount)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#15803d' }}>
                            {formatBdt(b.paid_amount)}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#b45309' }}>
                            {formatBdt(b.due_amount)}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => openPayModalForBill(b)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11.5, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
                            >
                              <CreditCard size={13} />
                              <span>Settle Bill</span>
                            </button>
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

      {/* TAB 3: AGEING ANALYSIS */}
      {activeTab === 'ageing' && (
        <div>
          {/* Ageing 4 Bucket KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            {/* Current 0-30 */}
            <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current (0 - 30 Days)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{formatBdt(ageing.current_0_30)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Regular credit period</div>
            </div>

            {/* 31-60 Days */}
            <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>31 - 60 Days</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{formatBdt(ageing.days_31_60)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Attention required</div>
            </div>

            {/* 61-90 Days */}
            <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>61 - 90 Days</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c2410c', marginTop: 4 }}>{formatBdt(ageing.days_61_90)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Escalation needed</div>
            </div>

            {/* 90+ Days */}
            <div className="panel" style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #fecaca', background: '#fff5f5' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>90+ Days (Critical)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{formatBdt(ageing.days_90_plus)}</div>
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, fontWeight: 600 }}>Urgent vendor settlement</div>
            </div>
          </div>

          {/* Ageing Breakdown Table */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Supplier Name</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Category</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>0 - 30 Days</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>31 - 60 Days</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>61 - 90 Days</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>90+ Days</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Total Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.filter(s => s.outstanding_due > 0).map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{s.supplier_code}</div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                          {s.category}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: s.ageing.current_0_30 > 0 ? '#15803d' : '#94a3b8' }}>
                        {formatBdt(s.ageing.current_0_30)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: s.ageing.days_31_60 > 0 ? '#b45309' : '#94a3b8' }}>
                        {formatBdt(s.ageing.days_31_60)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: s.ageing.days_61_90 > 0 ? '#c2410c' : '#94a3b8' }}>
                        {formatBdt(s.ageing.days_61_90)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: s.ageing.days_90_plus > 0 ? 800 : 400, color: s.ageing.days_90_plus > 0 ? '#dc2626' : '#94a3b8' }}>
                        {formatBdt(s.ageing.days_90_plus)}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                        {formatBdt(s.outstanding_due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SETTLEMENT & PAYMENT VOUCHERS */}
      {activeTab === 'payments' && (
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
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Payment Voucher #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Supplier</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Purpose / Narration</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Journal Voucher</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                        <CreditCard size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>No Payment Vouchers Found</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Payment vouchers will appear here when bills are settled.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          {p.payment_number}
                        </td>

                        <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(p.payment_date)}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.supplier_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{p.supplier_code}</div>
                        </td>

                        <td style={{ padding: '12px 14px', color: '#475569', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.purpose}>
                          {p.purpose}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>
                          {formatBdt(p.amount)}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {p.journal_number ? (
                            <Link
                              href="/finance-accounting/journal-voucher-list"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 11.5, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                            >
                              <span>{p.journal_number}</span>
                              <ExternalLink size={12} />
                            </Link>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                          )}
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

      {/* RECORD SUPPLIER PAYMENT MODAL */}
      {showPayModal && selectedBill && (
        <div className="modal-backdrop" onClick={() => !busy && setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                  Record Supplier Settlement Voucher
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                  Settle bill and post double-entry voucher to General Ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                disabled={busy}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12.5 }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleRecordPayment}>
              {/* Bill Details Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Supplier:</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{selectedBill.supplier_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Invoice / Bill Number:</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                    {selectedBill.supplier_invoice_number || selectedBill.bill_number}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Total Bill Amount:</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{formatBdt(selectedBill.base_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>Remaining Due:</span>
                  <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, color: '#b45309' }}>
                    {formatBdt(selectedBill.due_amount)}
                  </span>
                </div>
              </div>

              {/* Amount & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Settlement Amount (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedBill.due_amount}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    required
                    className="input"
                    style={{ width: '100%', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    required
                    className="input"
                    style={{ width: '100%', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Payment Method & Bank Account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Payment Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="input"
                    style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    <option value="bank_transfer">Bank Transfer (BEFTN / RTGS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash in Hand / Counter</option>
                    <option value="bkash">bKash Corporate</option>
                    <option value="nagad">Nagad Corporate</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Disbursing Cash/Bank Account *
                  </label>
                  <select
                    value={selectedBankId}
                    onChange={e => setSelectedBankId(e.target.value)}
                    className="input"
                    style={{ width: '100%', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference & Notes */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Cheque / Transaction Reference Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-991204 / BEFTN-PADMA-884"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Narration / Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: 12.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Live Double-Entry Posting Preview */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 11.5 }}>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                  ⚡ Automated Double-Entry Journal Voucher:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534' }}>
                  <span>Dr. 2010-AP (Accounts Payable):</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatBdt(payAmount || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534', marginTop: 2 }}>
                  <span>Cr. Disbursing Bank / Cash Account:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatBdt(payAmount || 0)}</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowPayModal(false)}
                  disabled={busy}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
                >
                  {busy ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                  <span>Confirm &amp; Post to GL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
