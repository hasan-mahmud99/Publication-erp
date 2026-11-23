"use client";

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Receipt,
  Search,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  DollarSign,
  Layers,
  Building2,
  Calendar,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Printer,
  Truck,
  Zap,
  Wrench,
  PieChart,
  HardDrive,
  MapPin,
  ShieldCheck,
  Briefcase
} from 'lucide-react';

type ExpenseKpis = {
  totalOpex: number;
  productionExpenses: number;
  facilityRentExpenses: number;
  logisticsMarketingExpenses: number;
  adminExpenses: number;
  totalFixedAssetCost: number;
  netBookValue: number;
  totalVouchers: number;
};

type ExpenseVoucher = {
  id: string;
  voucherNumber: string;
  expenseDate: string;
  category: string;
  payeeName: string;
  amount: number;
  taxAmount: number;
  referenceNo?: string | null;
  costCenterCode: string;
  costCenterName: string;
  description: string;
  status: string;
  journalId?: string | null;
  expenseAccountCode: string;
  expenseAccountName: string;
  paymentAccountCode: string;
  paymentAccountName: string;
};

type FixedAsset = {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: string;
  accumulatedDepreciation: number;
  currentBookValue: number;
  location: string;
  status: string;
};

type CategoryBreakdown = {
  category: string;
  total: number;
  count: number;
  percentage: number;
};

type CostCenterBreakdown = {
  code: string;
  total: number;
  count: number;
  percentage: number;
};

type CoaAccount = {
  id: string;
  account_code: string;
  name: string;
};

type CostCenter = {
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

export function ExpenseRegisterScreen({ initialTab }: { initialTab?: 'vouchers' | 'analytics' | 'fixed-assets' | 'cost-centers' }) {
  const [activeTab, setActiveTab] = useState<'vouchers' | 'analytics' | 'fixed-assets' | 'cost-centers'>(initialTab || 'vouchers');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Main Data States
  const [kpis, setKpis] = useState<ExpenseKpis>({
    totalOpex: 0,
    productionExpenses: 0,
    facilityRentExpenses: 0,
    logisticsMarketingExpenses: 0,
    adminExpenses: 0,
    totalFixedAssetCost: 0,
    netBookValue: 0,
    totalVouchers: 0,
  });

  const [vouchers, setVouchers] = useState<ExpenseVoucher[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [costCenterBreakdown, setCostCenterBreakdown] = useState<CostCenterBreakdown[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<CoaAccount[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<CoaAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  // Filter States
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [costCenterFilter, setCostCenterFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal: New Expense Voucher
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [expAccountId, setExpAccountId] = useState('');
  const [pmtAccountId, setPmtAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [payeeName, setPayeeName] = useState('');
  const [category, setCategory] = useState('Printing & Production');
  const [costCenterCode, setCostCenterCode] = useState('CC-PRODUCTION');
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');
  const [modalError, setModalError] = useState('');

  // Modal: Capitalize Asset
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('Printing Machinery');
  const [assetCost, setAssetCost] = useState('');
  const [assetDate, setAssetDate] = useState(new Date().toISOString().slice(0, 10));
  const [usefulLife, setUsefulLife] = useState('5');
  const [assetLocation, setAssetLocation] = useState('Banglabazar Production Facility');
  const [assetModalError, setAssetModalError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{
        data: {
          kpis: ExpenseKpis;
          vouchers: ExpenseVoucher[];
          fixedAssets: FixedAsset[];
          categoryBreakdown: CategoryBreakdown[];
          costCenterBreakdown: CostCenterBreakdown[];
          expenseAccounts: CoaAccount[];
          paymentAccounts: CoaAccount[];
          costCenters: CostCenter[];
        };
      }>('/finance/expense-register');

      setKpis(res.data.kpis);
      setVouchers(res.data.vouchers);
      setFixedAssets(res.data.fixedAssets);
      setCategoryBreakdown(res.data.categoryBreakdown);
      setCostCenterBreakdown(res.data.costCenterBreakdown);
      setExpenseAccounts(res.data.expenseAccounts);
      setPaymentAccounts(res.data.paymentAccounts);
      setCostCenters(res.data.costCenters);

      if (res.data.expenseAccounts.length > 0 && !expAccountId) {
        setExpAccountId(res.data.expenseAccounts[0].id);
      }
      if (res.data.paymentAccounts.length > 0 && !pmtAccountId) {
        setPmtAccountId(res.data.paymentAccounts[0].id);
      }
      if (res.data.costCenters.length > 0 && !costCenterCode) {
        setCostCenterCode(res.data.costCenters[0].code);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load expense register');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (costCenterFilter !== 'all' && v.costCenterCode !== costCenterFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = v.voucherNumber.toLowerCase().includes(q);
        const matchPayee = v.payeeName.toLowerCase().includes(q);
        const matchDesc = v.description.toLowerCase().includes(q);
        const matchHead = v.expenseAccountName.toLowerCase().includes(q);
        if (!matchNum && !matchPayee && !matchDesc && !matchHead) return false;
      }
      return true;
    });
  }, [vouchers, categoryFilter, costCenterFilter, searchQuery]);

  // Handle Record Expense Voucher
  async function submitVoucher(e: React.FormEvent) {
    e.preventDefault();
    setModalError('');
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) {
      setModalError('Please enter a valid amount greater than 0');
      return;
    }
    if (!expAccountId || !pmtAccountId) {
      setModalError('Please select both the expense account and payment account');
      return;
    }

    setBusy(true);
    try {
      const res = await api<{
        data: {
          voucherNumber: string;
          journalNumber: string;
          amount: number;
          payeeName: string;
          category: string;
        };
      }>('/finance/expense-register/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          expenseAccountId: expAccountId,
          paymentAccountId: pmtAccountId,
          amount: amtNum,
          expenseDate,
          payeeName: payeeName.trim(),
          category,
          costCenterCode,
          referenceNo: referenceNo.trim() || undefined,
          description: description.trim(),
        }),
      });

      setShowVoucherModal(false);
      setAmount('');
      setPayeeName('');
      setReferenceNo('');
      setDescription('');
      setNotice(
        `Expense Voucher ${res.data.voucherNumber} created! Posted Journal Voucher: ${res.data.journalNumber}. Total: ${formatBdt(amtNum)}.`
      );
      await loadData();
    } catch (err: any) {
      setModalError(err instanceof Error ? err.message : 'Failed to record expense voucher');
    } finally {
      setBusy(false);
    }
  }

  // Handle Capitalize Asset
  async function submitAsset(e: React.FormEvent) {
    e.preventDefault();
    setAssetModalError('');
    const costNum = parseFloat(assetCost);
    if (!costNum || costNum <= 0) {
      setAssetModalError('Please enter a valid acquisition cost');
      return;
    }

    setBusy(true);
    try {
      const res = await api<{
        data: {
          assetCode: string;
          name: string;
          purchaseCost: number;
        };
      }>('/finance/expense-register/fixed-assets', {
        method: 'POST',
        body: JSON.stringify({
          name: assetName.trim(),
          category: assetCategory,
          purchaseDate: assetDate,
          purchaseCost: costNum,
          usefulLifeYears: parseInt(usefulLife) || 5,
          location: assetLocation.trim(),
        }),
      });

      setShowAssetModal(false);
      setAssetName('');
      setAssetCost('');
      setNotice(`Fixed Asset ${res.data.assetCode} (${res.data.name}) capitalized at ${formatBdt(costNum)}.`);
      await loadData();
    } catch (err: any) {
      setAssetModalError(err instanceof Error ? err.message : 'Failed to capitalize fixed asset');
    } finally {
      setBusy(false);
    }
  }

  const selectedExpObj = expenseAccounts.find((a) => a.id === expAccountId);
  const selectedPmtObj = paymentAccounts.find((a) => a.id === pmtAccountId);

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
              Section 7: Expense Register & Capital Assets
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Expense Register & Fixed Assets
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            Operational Expenses, Production Cost Allocations, Cost Centres & Capitalized Asset Register.
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
            onClick={() => setShowAssetModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
          >
            <HardDrive size={14} />
            <span>+ Capitalize Asset</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setShowVoucherModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }}
          >
            <Receipt size={14} />
            <span>+ Record Expense Voucher</span>
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
        {/* KPI 1: Total OPEX */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total Operational Expenses</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            {formatBdt(kpis.totalOpex)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', fontWeight: 600, color: '#334155' }}>
              {kpis.totalVouchers} Vouchers
            </span>
            <span>Recorded & posted to GL</span>
          </div>
        </div>

        {/* KPI 2: Production & Printing Costs */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Production & Paper Costs</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Printer size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginBottom: 4 }}>
            {formatBdt(kpis.productionExpenses)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#dcfce7', fontWeight: 600, color: '#15803d' }}>
              COGS
            </span>
            <span>Paper reams, off-set & binding</span>
          </div>
        </div>

        {/* KPI 3: Facility, Logistics & Rent */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Facility & Logistics</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginBottom: 4 }}>
            {formatBdt(kpis.facilityRentExpenses + kpis.logisticsMarketingExpenses)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#fef3c7', fontWeight: 600, color: '#b45309' }}>
              Banglabazar Hub
            </span>
            <span>Rent, utilities & courier delivery</span>
          </div>
        </div>

        {/* KPI 4: Fixed Assets Portfolio */}
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Capitalized Fixed Assets</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
              <HardDrive size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#db2777', marginBottom: 4 }}>
            {formatBdt(kpis.totalFixedAssetCost)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#fce7f3', fontWeight: 600, color: '#be185d' }}>
              NBV: {formatBdt(kpis.netBookValue)}
            </span>
            <span>Press machinery, van & IT</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { key: 'vouchers', label: 'Expense Vouchers Register', icon: Receipt, count: vouchers.length },
          { key: 'analytics', label: 'Cost Category Analytics', icon: PieChart, count: categoryBreakdown.length },
          { key: 'fixed-assets', label: 'Fixed Assets Register', icon: HardDrive, count: fixedAssets.length },
          { key: 'cost-centers', label: 'Cost Centre Allocation', icon: Briefcase, count: costCenterBreakdown.length },
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

      {/* TAB 1: EXPENSE VOUCHERS REGISTER */}
      {activeTab === 'vouchers' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="all">All Categories</option>
                  <option value="Printing & Production">Printing & Production</option>
                  <option value="Facility & Rent">Facility & Rent</option>
                  <option value="Logistics & Freight">Logistics & Freight</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Marketing & Book Fair">Marketing & Book Fair</option>
                  <option value="Admin & Office">Admin & Office</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Cost Centre:</span>
                <select
                  value={costCenterFilter}
                  onChange={(e) => setCostCenterFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="all">All Cost Centres</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.code}>
                      {cc.code} - {cc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ position: 'relative', width: 280 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search voucher #, payee, narration..."
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

          {/* Vouchers Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 16px' }}>Voucher #</th>
                  <th style={{ padding: '10px 16px' }}>Date</th>
                  <th style={{ padding: '10px 16px' }}>Category</th>
                  <th style={{ padding: '10px 16px' }}>Payee / Vendor</th>
                  <th style={{ padding: '10px 16px' }}>Expense Account (Dr)</th>
                  <th style={{ padding: '10px 16px' }}>Paid Via (Cr)</th>
                  <th style={{ padding: '10px 16px' }}>Cost Centre</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount (BDT)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      No expense vouchers match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v, idx) => (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                          {v.voucherNumber}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {formatDate(v.expenseDate)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background:
                              v.category === 'Printing & Production'
                                ? '#f0fdf4'
                                : v.category === 'Facility & Rent'
                                ? '#eff6ff'
                                : v.category === 'Logistics & Freight'
                                ? '#fef3c7'
                                : '#f1f5f9',
                            color:
                              v.category === 'Printing & Production'
                                ? '#166534'
                                : v.category === 'Facility & Rent'
                                ? '#1d4ed8'
                                : v.category === 'Logistics & Freight'
                                ? '#b45309'
                                : '#475569',
                          }}
                        >
                          {v.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{v.payeeName}</div>
                        <div style={{ fontSize: 11, color: '#64748b', maxWidth: 260, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {v.description}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#334155' }}>
                        <div>{v.expenseAccountName}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.expenseAccountCode}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#334155' }}>
                        <div>{v.paymentAccountName}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{v.paymentAccountCode}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', fontWeight: 600 }}>
                          {v.costCenterCode}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                        {formatBdt(v.amount)}
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

      {/* TAB 2: COST CATEGORY ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Category Distribution Breakdown */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>
              Spending Breakdown by Category
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {categoryBreakdown.map((c) => (
                <div key={c.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{c.category}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {formatBdt(c.total)} ({c.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(4, c.percentage))}%`,
                        height: '100%',
                        background: '#2563eb',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Centre Allocation Breakdown */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>
              Cost Centre Allocation Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {costCenterBreakdown.map((cc) => (
                <div key={cc.code}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{cc.code}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {formatBdt(cc.total)} ({cc.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(4, cc.percentage))}%`,
                        height: '100%',
                        background: '#16a34a',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FIXED ASSETS REGISTER */}
      {activeTab === 'fixed-assets' && (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Capitalized Fixed Assets Registry ({fixedAssets.length})
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Printing machinery, warehouse racking, delivery transport & editorial IT assets.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowAssetModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#ffffff', fontSize: 12 }}
            >
              <Plus size={14} />
              <span>Capitalize Asset</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 16px' }}>Asset Code</th>
                  <th style={{ padding: '10px 16px' }}>Asset Name & Category</th>
                  <th style={{ padding: '10px 16px' }}>Acquisition Date</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Original Cost</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Useful Life</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Acc. Depreciation</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Net Book Value</th>
                  <th style={{ padding: '10px 16px' }}>Location</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {fixedAssets.map((fa, idx) => (
                  <tr
                    key={fa.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                        {fa.assetCode}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{fa.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{fa.category}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {formatDate(fa.purchaseDate)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {formatBdt(fa.purchaseCost)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#475569' }}>
                      {fa.usefulLifeYears} Years
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e11d48', fontWeight: 600 }}>
                      -{formatBdt(fa.accumulatedDepreciation)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#16a34a' }}>
                      {formatBdt(fa.currentBookValue)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} style={{ color: '#94a3b8' }} />
                        <span>{fa.location}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#f0fdf4', color: '#16a34a' }}>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COST CENTRE ALLOCATIONS */}
      {activeTab === 'cost-centers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {costCenters.map((cc) => {
            const ccStats = costCenterBreakdown.find((b) => b.code === cc.code) || { total: 0, count: 0, percentage: 0 };
            return (
              <div
                key={cc.id}
                style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  padding: 18,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8' }}>
                      {cc.code}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '6px 0 0' }}>
                      {cc.name}
                    </h3>
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                    <Briefcase size={16} />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Total Expenditures:</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{formatBdt(ccStats.total)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                    <span>Share of Total OPEX:</span>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>{ccStats.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL A: NEW EXPENSE VOUCHER */}
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
              maxWidth: 600,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Record Operational Expense Voucher
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                  Creates an audited expense voucher and posts double-entry GL journal lines.
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

            <form onSubmit={submitVoucher} style={{ padding: 20 }}>
              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                  {modalError}
                </div>
              )}

              {/* Expense Account & Payment Account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Expense Account (Dr) *
                  </label>
                  <select
                    value={expAccountId}
                    onChange={(e) => setExpAccountId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Paid From (Cr) *
                  </label>
                  <select
                    value={pmtAccountId}
                    onChange={(e) => setPmtAccountId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 25000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                  />
                  {/* Quick amount chips */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {[5000, 10000, 25000, 50000].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setAmount(String(quick))}
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
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Payee & Reference */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Payee / Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Padma Printers or DESCO"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Bill / Receipt Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9918 or BILL-441"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Category & Cost Centre */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    <option value="Printing & Production">Printing & Production</option>
                    <option value="Facility & Rent">Facility & Rent</option>
                    <option value="Logistics & Freight">Logistics & Freight</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Marketing & Book Fair">Marketing & Book Fair</option>
                    <option value="Admin & Office">Admin & Office</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Cost Centre *
                  </label>
                  <select
                    value={costCenterCode}
                    onChange={(e) => setCostCenterCode(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.code}>
                        {cc.code} - {cc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Description / Narration *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paper purchase for reprint of Science Handbook"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              {/* Live Double Entry Box */}
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0', marginBottom: 18, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Live Double-Entry Journal Posting:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: 600, marginBottom: 4 }}>
                  <span>Dr. {selectedExpObj ? selectedExpObj.name : 'Expense Account'}</span>
                  <span>{formatBdt(parseFloat(amount) || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 600 }}>
                  <span style={{ paddingLeft: 16 }}>Cr. {selectedPmtObj ? selectedPmtObj.name : 'Payment Account'}</span>
                  <span>{formatBdt(parseFloat(amount) || 0)}</span>
                </div>
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
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {busy ? 'Processing...' : 'Post Expense Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL B: CAPITALIZE FIXED ASSET */}
      {showAssetModal && (
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
              maxWidth: 540,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Capitalize New Fixed Asset
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                  Register machinery, vehicles, infrastructure or IT hardware into the fixed asset ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssetModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitAsset} style={{ padding: 20 }}>
              {assetModalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                  {assetModalError}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Asset Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Komori Lithrone 5-Color Offset Press"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Asset Category *
                  </label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    <option value="Printing Machinery">Printing Machinery</option>
                    <option value="Binding Machinery">Binding Machinery</option>
                    <option value="Warehouse Infrastructure">Warehouse Infrastructure</option>
                    <option value="Vehicles & Transport">Vehicles & Transport</option>
                    <option value="IT & Design Hardware">IT & Design Hardware</option>
                    <option value="Office Furniture">Office Furniture</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Acquisition Cost (BDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 3500000"
                    value={assetCost}
                    onChange={(e) => setAssetCost(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Acquisition Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={assetDate}
                    onChange={(e) => setAssetDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Useful Life (Years) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={usefulLife}
                    onChange={(e) => setUsefulLife(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Facility / Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Banglabazar Production Facility"
                  value={assetLocation}
                  onChange={(e) => setAssetLocation(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAssetModal(false)}
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
                  {busy ? 'Processing...' : 'Capitalize Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
