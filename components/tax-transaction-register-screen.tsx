"use client";

import { useEffect, useState, useMemo, type FormEvent } from 'react';
import {
  FileText,
  Search,
  Plus,
  RefreshCw,
  Download,
  DollarSign,
  TrendingUp,
  Receipt,
  Building2,
  Calendar,
  X,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';

type TransactionRow = {
  id: string;
  transaction_number: string;
  transaction_date: string;
  source_type: string;
  source_id: string | null;
  source_reference: string;
  entity_type: string;
  entity_name: string;
  entity_bin_tin: string | null;
  tax_kind: string;
  tax_treatment: string;
  base_amount: string | number;
  tax_rate_percent: string | number;
  tax_amount: string | number;
  vds_amount: string | number;
  rebate_admissible: string | number;
  gl_journal_id: string | null;
  mushak_document_id: string | null;
  status: string;
  created_at: string;
};

type TaxSummary = {
  outputVat: number;
  inputVat: number;
  totalVds: number;
  totalTds: number;
  admissibleRebate: number;
  netVatPayable: number;
};

export function TaxTransactionRegisterScreen() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalForm, setModalForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    sourceType: 'sales_invoice',
    sourceReference: '',
    entityType: 'customer',
    entityName: '',
    entityBinTin: '',
    taxKind: 'VAT' as 'VAT' | 'VDS' | 'TDS',
    taxTreatment: 'taxable',
    baseAmount: '',
    taxRatePercent: '15',
    taxAmount: '',
    vdsAmount: '0',
    rebateAdmissible: '0',
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (fromDate) queryParams.set('fromDate', fromDate);
      if (toDate) queryParams.set('toDate', toDate);
      if (kindFilter !== 'ALL') queryParams.set('taxKind', kindFilter);
      if (sourceFilter !== 'ALL') queryParams.set('sourceType', sourceFilter);
      queryParams.set('limit', '100');

      const [txRes, sumRes] = await Promise.all([
        api<{ data: { rows: TransactionRow[]; total: number } }>(`/tax/transactions?${queryParams}`),
        api<{ data: TaxSummary }>('/tax/summary'),
      ]);

      setRows(txRes.data.rows || []);
      setSummary(sumRes.data || null);
    } catch (err: any) {
      setError(err?.message || 'Could not load tax transactions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [kindFilter, sourceFilter, fromDate, toDate]);

  const filteredRows = useMemo(() => {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!search.trim()) return safeRows;
    const q = search.toLowerCase();
    return safeRows.filter(r =>
      (r.transaction_number?.toLowerCase() || '').includes(q) ||
      (r.source_reference?.toLowerCase() || '').includes(q) ||
      (r.entity_name?.toLowerCase() || '').includes(q) ||
      (r.entity_bin_tin && r.entity_bin_tin.toLowerCase().includes(q))
    );
  }, [rows, search]);

  async function handleCreateTx(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/tax/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...modalForm,
          baseAmount: Number(modalForm.baseAmount || 0),
          taxRatePercent: Number(modalForm.taxRatePercent || 0),
          taxAmount: Number(modalForm.taxAmount || 0),
          vdsAmount: Number(modalForm.vdsAmount || 0),
          rebateAdmissible: Number(modalForm.rebateAdmissible || 0),
        }),
      });

      setNotice('Tax transaction recorded in official register.');
      setShowCreateModal(false);
      setModalForm({
        transactionDate: new Date().toISOString().slice(0, 10),
        sourceType: 'sales_invoice',
        sourceReference: '',
        entityType: 'customer',
        entityName: '',
        entityBinTin: '',
        taxKind: 'VAT',
        taxTreatment: 'taxable',
        baseAmount: '',
        taxRatePercent: '15',
        taxAmount: '',
        vdsAmount: '0',
        rebateAdmissible: '0',
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to record tax transaction');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!filteredRows.length) return;
    const headers = [
      'Tx #',
      'Date',
      'Source Type',
      'Reference #',
      'Entity Name',
      'BIN/TIN',
      'Tax Kind',
      'Base (BDT)',
      'Rate %',
      'Tax (BDT)',
      'VDS (BDT)',
      'Status',
    ];
    const csvContent = [
      headers.join(','),
      ...filteredRows.map(r =>
        [
          r.transaction_number,
          String(r.transaction_date).slice(0, 10),
          r.source_type,
          `"${r.source_reference}"`,
          `"${r.entity_name}"`,
          r.entity_bin_tin || '',
          r.tax_kind,
          Number(r.base_amount).toFixed(2),
          Number(r.tax_rate_percent).toFixed(2),
          Number(r.tax_amount).toFixed(2),
          Number(r.vds_amount).toFixed(2),
          r.status,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tax-Transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <div className="page-heading" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Tax Transaction Register</h1>
          <p className="muted">
            Official chronological audit ledger of all Input Tax, Output Tax, VDS, and TDS events.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn" onClick={exportCsv} disabled={!filteredRows.length}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Record Tax Entry</span>
          </button>
        </div>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* 5 KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="panel stat" style={{ borderLeft: '4px solid #3b82f6', padding: '14px 18px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Output VAT (Sales)</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px', color: '#0f172a' }}>
            BDT {Number(summary?.outputVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>Mushak 6.3 commercial supplies</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #10b981', padding: '14px 18px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Input VAT (Purchases)</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px', color: '#0f172a' }}>
            BDT {Number(summary?.inputVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Paper &amp; Press procurements</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #f59e0b', padding: '14px 18px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>VDS Withheld</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px', color: '#0f172a' }}>
            BDT {Number(summary?.totalVds || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>Deducted from supplier bills</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #8b5cf6', padding: '14px 18px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TDS Withheld</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px', color: '#0f172a' }}>
            BDT {Number(summary?.totalTds || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>Author Royalties &amp; Contracts</span>
        </div>

        <div className="panel stat" style={{ borderLeft: '4px solid #ef4444', padding: '14px 18px', background: '#fff', borderRadius: 10 }}>
          <span className="stat-label" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Net Monthly VAT Payable</span>
          <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px', color: '#dc2626' }}>
            BDT {Number(summary?.netVatPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Treasury A-Challan Target</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          background: '#fff',
          borderRadius: 10,
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: '1 1 340px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 260 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search Ref #, Entity, BIN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 38 }}
            />
          </div>

          <select
            className="input"
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value)}
            style={{ width: 130, height: 38 }}
          >
            <option value="ALL">All Kinds</option>
            <option value="VAT">VAT Only</option>
            <option value="VDS">VDS Only</option>
            <option value="TDS">TDS Only</option>
          </select>

          <select
            className="input"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ width: 170, height: 38 }}
          >
            <option value="ALL">All Sources</option>
            <option value="sales_invoice">Sales Invoices</option>
            <option value="supplier_bill">Supplier Bills</option>
            <option value="royalty_disbursement">Author Royalties</option>
            <option value="debit_credit_note">Credit/Debit Notes</option>
          </select>

          <input
            type="date"
            className="input"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ width: 140, height: 38 }}
            title="From Date"
          />

          <input
            type="date"
            className="input"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ width: 140, height: 38 }}
            title="To Date"
          />
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {filteredRows.length} transactions recorded
        </span>
      </div>

      {/* Main Table */}
      <div className="panel table-wrap" style={{ background: '#fff', borderRadius: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tx # &amp; Date</th>
              <th>Source / Ref</th>
              <th>Entity (Customer / Supplier)</th>
              <th>Tax Kind</th>
              <th>Taxable Base (BDT)</th>
              <th>Rate %</th>
              <th>Tax Amount (BDT)</th>
              <th>VDS Deducted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.transaction_number}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{String(row.transaction_date).slice(0, 10)}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.source_reference}</div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                      {String(row.source_type || '').replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.entity_name}</div>
                    {row.entity_bin_tin && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>BIN/TIN: {row.entity_bin_tin}</div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: row.tax_kind === 'VAT' ? '#eff6ff' : row.tax_kind === 'VDS' ? '#fef3c7' : '#f3e8ff',
                        color: row.tax_kind === 'VAT' ? '#1d4ed8' : row.tax_kind === 'VDS' ? '#b45309' : '#7e22ce',
                      }}
                    >
                      {row.tax_kind}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#0f172a' }}>
                      BDT {Number(row.base_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td>{Number(row.tax_rate_percent || 0).toFixed(2)}%</td>
                  <td>
                    <strong style={{ color: Number(row.tax_amount) > 0 ? '#15803d' : '#64748b' }}>
                      BDT {Number(row.tax_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </td>
                  <td>
                    <span style={{ color: Number(row.vds_amount) > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>
                      BDT {Number(row.vds_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: '#ecfdf5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0',
                        textTransform: 'uppercase',
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="empty" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No tax transactions match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Tax Entry Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 680,
              width: '94%',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              border: '1px solid #e2e8f0',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    Record Tax Transaction
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    Log an official input/output tax event or withholding entry into the statutory register.
                  </p>
                </div>
              </div>
              <button
                className="btn"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTx} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="catalog-form-grid" style={{ gap: 14 }}>
                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Transaction Date <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="date"
                    required
                    value={modalForm.transactionDate}
                    onChange={e => setModalForm(prev => ({ ...prev, transactionDate: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Tax Kind <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <select
                    className="input"
                    value={modalForm.taxKind}
                    onChange={e => setModalForm(prev => ({ ...prev, taxKind: e.target.value as any }))}
                    style={{ height: 42, borderRadius: 8 }}
                  >
                    <option value="VAT">VAT (Value Added Tax)</option>
                    <option value="VDS">VDS (Tax Deducted at Source on VAT)</option>
                    <option value="TDS">TDS (Tax Deducted at Source on Income)</option>
                  </select>
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Source Type <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <select
                    className="input"
                    value={modalForm.sourceType}
                    onChange={e => setModalForm(prev => ({ ...prev, sourceType: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  >
                    <option value="sales_invoice">Sales Invoice</option>
                    <option value="supplier_bill">Supplier / Press Bill</option>
                    <option value="royalty_disbursement">Author Royalty</option>
                    <option value="debit_credit_note">Credit / Debit Note</option>
                  </select>
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Reference Document # <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    required
                    placeholder="e.g. INV-2026-0042, BILL-9901"
                    value={modalForm.sourceReference}
                    onChange={e => setModalForm(prev => ({ ...prev, sourceReference: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Party / Entity Name <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    required
                    placeholder="e.g. Partex Paper, Al-Madina Press"
                    value={modalForm.entityName}
                    onChange={e => setModalForm(prev => ({ ...prev, entityName: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Entity BIN or TIN</span>
                  <input
                    className="input"
                    placeholder="e.g. 001928374-0101"
                    value={modalForm.entityBinTin}
                    onChange={e => setModalForm(prev => ({ ...prev, entityBinTin: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Taxable Base Amount (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 100000"
                    value={modalForm.baseAmount}
                    onChange={e => {
                      const base = Number(e.target.value || 0);
                      const rate = Number(modalForm.taxRatePercent || 0);
                      const calcTax = Math.round(base * (rate / 100) * 100) / 100;
                      setModalForm(prev => ({
                        ...prev,
                        baseAmount: e.target.value,
                        taxAmount: String(calcTax),
                      }));
                    }}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Tax Rate %</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={modalForm.taxRatePercent}
                    onChange={e => {
                      const rate = Number(e.target.value || 0);
                      const base = Number(modalForm.baseAmount || 0);
                      const calcTax = Math.round(base * (rate / 100) * 100) / 100;
                      setModalForm(prev => ({
                        ...prev,
                        taxRatePercent: e.target.value,
                        taxAmount: String(calcTax),
                      }));
                    }}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Calculated Tax Amount (BDT) <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={modalForm.taxAmount}
                    onChange={e => setModalForm(prev => ({ ...prev, taxAmount: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>

                <label className="field">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>VDS Amount (if applicable)</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalForm.vdsAmount}
                    onChange={e => setModalForm(prev => ({ ...prev, vdsAmount: e.target.value }))}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={busy}
                  style={{ height: 40, padding: '0 18px', borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !modalForm.sourceReference || !modalForm.entityName || !modalForm.baseAmount}
                  style={{ height: 40, padding: '0 20px', borderRadius: 8, gap: 6 }}
                >
                  <Plus size={16} />
                  <span>{busy ? 'Recording…' : 'Record Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
